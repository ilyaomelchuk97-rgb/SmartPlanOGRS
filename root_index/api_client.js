/* ============================================================
   SmartPlan — HTTP API клиент (api_client.js)
   ------------------------------------------------------------
   Сборка 22.09-25: миграция с локального файла и общего сервера
   на Render.com + PostgreSQL. Все CRUD-операции теперь идут
   через REST API. localStorage используется только как кэш
   для офлайн-чтения и для мгновенного UI-отклика.

   Возможности:
   · SP_API.baseUrl — базовый URL (определяется автоматически:
     если открыто на Render — same origin; иначе из SP_CONFIG).
   · SP_API.token    — текущий session token (хранится в localStorage).
   · SP_API.login(login, password) — вход, возвращает user + token.
   · SP_API.logout()                — выход, очищает token.
   · SP_API.get(section)            — GET /api/<section>
   · SP_API.upsert(section, record) — POST /api/<section>
   · SP_API.syncPush(section, record) — общее сохранение раздела (22.09-254: только
     изменённые записи и только после первой синхронизации с сервером)
   · SP_API.delete(section, id)     — DELETE /api/<section>/:id
   · SP_API.sync(since)             — GET /api/sync?since=<ts>
   · SP_API.audit(limit, since)     — GET /api/audit
   · SP_API.errorsPush/errorsGet/errorsClear — общий лог ошибок (со всех устройств)
   · SP_API.health()                — GET /healthz

   Ошибки:
   · Все методы возвращают Promise<{ ok, ... }> — НЕ throw'ят.
   · При сетевой ошибке — возвращают { ok: false, err: '...' }.
   ============================================================ */
window.SP_API = (function () {
  'use strict';

  var LS_TOKEN = 'smartplan_api_token';
  var LS_USER  = 'smartplan_api_user';
  // 22.09-243: номер этой вкладки — сервер помечает им уведомления об изменениях,
  // чтобы вкладка не перезагружала данные из-за собственных правок
  var CLIENT_ID = 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  // Базовый URL: same-origin если открыто на Render, иначе из SP_CONFIG
  function getBaseUrl() {
    if (window.SP_CONFIG && SP_CONFIG.apiBase) return SP_CONFIG.apiBase;
    // На Render сайт обслуживается тем же Express-сервером → '/api'
    return window.location.origin + '/api';
  }

  function getToken() {
    try { return window.localStorage.getItem(LS_TOKEN); } catch (e) { return null; }
  }
  function setToken(t) {
    try {
      if (t) window.localStorage.setItem(LS_TOKEN, t);
      else window.localStorage.removeItem(LS_TOKEN);
    } catch (e) {}
  }
  function getUser() {
    try {
      var raw = window.localStorage.getItem(LS_USER);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function setUser(u) {
    try {
      if (u) window.localStorage.setItem(LS_USER, JSON.stringify(u));
      else window.localStorage.removeItem(LS_USER);
    } catch (e) {}
  }

  // Универсальный fetch — оборачивает ответ, никогда не throw'ает
  function request(method, path, body, opts) {
    opts = opts || {};
    var url = getBaseUrl() + path;
    var headers = { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Client-Id': CLIENT_ID,
      'X-SP-Build': String(window.SP_BUILD || '') }; // 22.09-254: сервер принимает изменения только от актуальной версии сайта
    var token = getToken();
    if (token && !opts.noAuth) headers['Authorization'] = 'Bearer ' + token;

    return fetch(url, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit',
      cache: 'no-store'
    })
    .then(function (r) {
      return r.text().then(function (txt) {
        var json = null;
        try { json = txt ? JSON.parse(txt) : null; } catch (e) {}
        if (!r.ok) {
          // 401 — токен протух, чистим
          if (r.status === 401) { setToken(null); setUser(null); }
          return json || { ok: false, err: 'HTTP ' + r.status, _status: r.status };
        }
        return json || { ok: true };
      });
    })
    .catch(function (e) {
      return { ok: false, err: e && e.message ? e.message : String(e), _network: true };
    });
  }

  /* ---------- ПУБЛИЧНЫЕ МЕТОДЫ ---------- */
  function health() {
    var base = getBaseUrl().replace(/\/api$/, ''); // 22.09-262: база на Cloudflare — проверяем её, а не Render
    return fetch(base + '/healthz', { cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, data: j }; }); })
      .catch(function (e) { return { ok: false, err: e.message }; });
  }

  function login(login, password) {
    return request('POST', '/auth/login', { login: login, password: password }, { noAuth: true })
      .then(function (r) {
        if (r && r.ok && r.token) {
          setToken(r.token);
          setUser(r.user);
        }
        return r;
      });
  }

  function logout() {
    return request('POST', '/auth/logout', null).finally(function () {
      setToken(null);
      setUser(null);
    });
  }

  function me() {
    return request('GET', '/auth/me');
  }

  function get(section) {
    return request('GET', '/' + section);
  }

  /* ---------- 22.09-254: БЕЗОПАСНАЯ ОТПРАВКА ИЗМЕНЕНИЙ ----------
     Раньше каждое сохранение раздела (виды работ, задачи, объекты, графики…) отправляло
     на сервер ВСЕ записи из памяти браузера. Браузер со СТАРОЙ копией (например, вчерашний
     вход на другом компьютере) при открытии сайта затирал на сервере всё, что сделано
     позже, — так пропадали настройки видов работ и норм времени. Теперь:
     · общие сохранения разделов (syncPush) ничего не отправляют, пока сайт не получил с
       сервера актуальные данные (первая синхронизация после входа/открытия);
     · отправляются только записи, изменённые в этом браузере (сравнение с последней
       версией, полученной от сервера), — неизменённое не уходит вовсе;
     · вместе с записью уходит номер версии, на которой основано изменение (base): если
       на сервере запись новее (её изменили на другом устройстве), сервер её НЕ затирает
       (ответ 409), сайт подтягивает актуальную версию и предупреждает;
     · правки одной записи уходят по очереди (следующая — с номером версии после первой). */
  var SHADOW = {};   // 'раздел|id' → JSON версии, известной серверу ('#deleted' — удалена)
  var VER = {};      // 'раздел|id' → updated_at (мс) этой версии на сервере
  var INFLIGHT = {}; // 'раздел|id' → { p, rec, json, after } — отправка в пути
  var _conflictToastAt = 0;
  // JSON с упорядоченными ключами, без служебных полей (_…) — для сравнения версий
  function canon(v) {
    if (v === null || v === undefined || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    var ks = Object.keys(v).filter(function (k) { return k.charAt(0) !== '_' && v[k] !== undefined && typeof v[k] !== 'function'; }).sort();
    return '{' + ks.map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
  }
  function keyOf(section, id) { return section + '|' + id; }
  // версия записи, пришедшая с сервера (синхронизация /api/sync, ответы сервера)
  function noteServer(section, rec) {
    if (!rec || rec.id == null) return;
    var k = keyOf(section, rec.id);
    if (typeof rec._updated_at === 'number' && isFinite(rec._updated_at)) VER[k] = rec._updated_at;
    SHADOW[k] = rec._deleted ? '#deleted' : canon(rec);
  }
  function syncReady() {
    try { return !!(window.SP_SYNC_POLL && typeof SP_SYNC_POLL.isReady === 'function' && SP_SYNC_POLL.isReady()); } catch (e) { return false; }
  }
  function onConflict(section, record, r) {
    try { if (window.SP_SYNC_POLL && SP_SYNC_POLL.kick) SP_SYNC_POLL.kick(); } catch (e) {}
    // автоматическая запись до получения актуальных данных (служебные пересчёты при входе) —
    // отказ сервера ожидаем и правилен: без предупреждений и записей в лог
    if (!syncReady() || record.id === 't_day_anchor') return;
    try {
      if (window.SP_ERRORS && SP_ERRORS.log) SP_ERRORS.log('warn', 'sync.conflict', 'Запись изменена на другом устройстве — не перезаписана старой копией: ' + section + ' ' + record.id,
        { section: section, id: record.id, name: record.name || record.full_name || record.addr || '' });
    } catch (e) {}
    var now = Date.now();
    if (now - _conflictToastAt > 8000 && typeof window.SP_toast === 'function') {
      _conflictToastAt = now;
      try {
        var nm = String(record.name || record.full_name || record.addr || '').slice(0, 80);
        window.SP_toast('warn', '⚠ ' + (nm ? '«' + nm.replace(/[<>&]/g, '') + '» — ' : '') + 'эти данные изменены на другом устройстве: загружена актуальная версия. Если ваше изменение пропало — повторите его.');
      } catch (e) {}
    }
  }
  /* ---------- 22.09-261: ОЧЕРЕДЬ ОТПРАВКИ (outbox) на случай спящего/недоступного сервера ----------
     Бесплатный Render засыпает через 15 минут без посетителей; во время сна запросы получают
     404/таймаут. Правка, сделанная в этот момент (вид работы, норма, пользователь…), раньше
     терялась: оставалась только в этом браузере, а на сервере и у других — старое значение
     («настройки пропадают»). Теперь запись попадает в очередь localStorage и автоматически
     уходит при следующем удачном опросе сервера. Если за это время запись изменили на другом
     устройстве (сервер новее) — отправка отклоняется конфликтом и применяется серверная версия. */
  var OUTBOX_KEY = 'smartplan_outbox_records';
  var _flushing = false;
  function outboxRead() { try { var a = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function outboxWrite(q) { try { if (q.length > 200) q = q.slice(-200); localStorage.setItem(OUTBOX_KEY, JSON.stringify(q)); } catch (e) {} }
  // сервер «лежит» (сон Render / сеть упала) — 404/408/5xx/сеть; 400/401/409 — НЕ сон
  function isServerDown(r) { return !!(r && (r._network || r._status === 404 || r._status === 408 || r._status >= 500)); }
  function outboxPush(section, record, base) {
    try {
      var q = outboxRead();
      for (var i = q.length - 1; i >= 0; i--) if (q[i].s === section && q[i].id === record.id) q.splice(i, 1); // свежая версия заменяет старую
      q.push({ s: section, id: record.id, d: record, base: (typeof base === 'number' && isFinite(base)) ? base : null, ts: Date.now() });
      outboxWrite(q);
    } catch (e) {}
  }
  function outboxFlush() {
    if (_flushing) return;
    try {
      if (!getToken()) return;
      if (!outboxRead().length) return;
      _flushing = true;
      (function next() {
        var it = outboxRead()[0];
        if (!it) { _flushing = false; return; }
        sendOne(it.s, it.d, canon(it.d), it.base, true).then(function (r) { // canon — чтобы после отправки тень версии была честной
          if (r && (r.ok || r.unchanged || r.conflict)) {
            var cur = outboxRead();
            for (var i = 0; i < cur.length; i++) if (cur[i].s === it.s && cur[i].id === it.id) { cur.splice(i, 1); break; }
            outboxWrite(cur);
            next();
          } else {
            _flushing = false; // сервер ещё спит (404/5xx/сеть) или 401 — повторим при следующем удачном опросе
          }
        }).catch(function () { _flushing = false; });
      })();
    } catch (e) { _flushing = false; }
  }
  try { if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('online', function () { try { outboxFlush(); } catch (e) {} }); } catch (e) {}

  function sendOne(section, record, json, baseOverride, fromQueue) {
    var k = keyOf(section, record.id);
    // base — версия, которую этот браузер знает; если он её ещё не получал от сервера
    // (до первой синхронизации), пишем как раньше (без проверки) — иначе правка, сделанная
    // в первые секунды после входа, терялась (409 + подмена на серверную версию)
    var base = (typeof baseOverride === 'number' && isFinite(baseOverride)) ? baseOverride
      : ((typeof VER[k] === 'number' && isFinite(VER[k])) ? VER[k] : null);
    return request('POST', '/' + section, { id: record.id, data: record, base: base }).then(function (r) {
      if (r && r.ok) {
        var rr = r.record || r.user;
        if (rr && typeof rr._updated_at === 'number' && isFinite(rr._updated_at)) VER[k] = rr._updated_at;
        SHADOW[k] = json;
      } else if (r && r.conflict) {
        // запись на сервере новее: эту (устаревшую) версию и всё, что стояло за ней в очереди,
        // НЕ отправляем; в браузер сразу кладём актуальную версию с сервера
        var q = INFLIGHT[k];
        if (q) { q.rec = null; q.json = null; q.cancel = true; }
        var applied = false;
        try { if (r.record && window.SP_SYNC_POLL && SP_SYNC_POLL.applyRemote) applied = SP_SYNC_POLL.applyRemote(section, [r.record]) || true; } catch (eA) {}
        if (!applied && r.record) noteServer(section, r.record);
        onConflict(section, record, r);
      } else if (isServerDown(r) && !fromQueue) {
        // 22.09-261: сервер заснул/недоступен — запись в очередь, уйдёт при следующем удачном опросе
        outboxPush(section, record, VER[k]);
      }
      return r;
    });
  }
  function startSend(section, k, record, json) {
    var q = { p: null, rec: null, json: null, after: null };
    INFLIGHT[k] = q;
    q.p = sendOne(section, record, json).then(function (r) {
      if (INFLIGHT[k] === q && !q.after) delete INFLIGHT[k];
      return r;
    });
    return q.p;
  }
  // Отправить одну запись (явное изменение пользователя)
  function upsert(section, record) {
    if (!record || record.id == null || record.id === '') return Promise.resolve({ ok: false, err: 'нет id' });
    var k = keyOf(section, record.id);
    var json = canon(record);
    var q = INFLIGHT[k];
    if (q && !q.cancel) { // эта запись уже отправляется — новая версия уйдёт сразу после (с новым номером версии)
      q.rec = record; q.json = json;
      return q.after || (q.after = q.p.then(function () {
        if (INFLIGHT[k] === q) delete INFLIGHT[k];
        if (q.cancel || !q.rec) return { ok: false, conflict: true, cancelled: true }; // основана на устаревшей версии
        if (SHADOW[k] === q.json) return { ok: true, unchanged: true };
        return startSend(section, k, q.rec, q.json);
      }));
    }
    if (SHADOW[k] === json) return Promise.resolve({ ok: true, unchanged: true }); // сервер уже знает эту версию
    return startSend(section, k, record, json);
  }
  // Общее сохранение раздела: только после первой синхронизации и только изменённое
  function syncPush(section, record) {
    if (!syncReady()) return Promise.resolve({ ok: true, skipped: true });
    return upsert(section, record);
  }

  function update(section, id, record, expectedUpdatedAt) {
    var body = { data: record };
    if (expectedUpdatedAt) body.expected_updated_at = expectedUpdatedAt;
    return request('PUT', '/' + section + '/' + encodeURIComponent(id), body);
  }

  function del(section, id) {
    var k = keyOf(section, id);
    return request('DELETE', '/' + section + '/' + encodeURIComponent(id)).then(function (r) {
      if (r && r.ok) { // 22.09-254: сервер знает, что запись удалена
        SHADOW[k] = '#deleted';
        if (r.record && typeof r.record._updated_at === 'number') VER[k] = r.record._updated_at;
      }
      return r;
    });
  }

  // 22.09-267: инструменты администратора
  function adminStatus() { return request('GET', '/admin/status'); }
  function backupNow() { return request('POST', '/admin/backup', {}); }
  function auditByObject(objectId, limit) {
    return request('GET', '/audit?object_id=' + encodeURIComponent(objectId) + '&limit=' + (limit || 50));
  }

  function sync(since) {
    return request('GET', '/sync?since=' + (since || 0));
  }

  function audit(limit, since) {
    var q = [];
    if (limit) q.push('limit=' + limit);
    if (since) q.push('since=' + since);
    return request('GET', '/audit' + (q.length ? '?' + q.join('&') : ''));
  }

  // 22.09-232: ОБЩИЙ лог ошибок со всех устройств
  function errorsPush(entries) {
    if (!Array.isArray(entries) || !entries.length) return Promise.resolve({ ok: true, inserted: 0 });
    return request('POST', '/errors', { entries: entries });
  }
  function errorsGet(limit, since) {
    var q = [];
    if (limit) q.push('limit=' + limit);
    if (since) q.push('since=' + since);
    return request('GET', '/errors' + (q.length ? '?' + q.join('&') : ''));
  }
  function errorsClear() {
    return request('DELETE', '/errors');
  }

  // 22.09-243: адрес постоянного соединения для мгновенных уведомлений (SSE)
  function eventsUrl() {
    var t = getToken();
    return t ? getBaseUrl() + '/events?token=' + encodeURIComponent(t) + '&cid=' + encodeURIComponent(CLIENT_ID) : '';
  }
  function clientId() { return CLIENT_ID; }

  // 22.09-242: копии графиков на сервере (общие для всех устройств)
  function snapsList(gid) { return request('GET', '/graph_snaps?gid=' + encodeURIComponent(gid)); }
  function snapGet(id) { return request('GET', '/graph_snaps/' + encodeURIComponent(id)); }
  function snapPut(rec) { return request('POST', '/graph_snaps', rec); }
  function snapDel(id) { return request('DELETE', '/graph_snaps/' + encodeURIComponent(id)); }

  return {
    baseUrl: getBaseUrl,
    health: health,
    login: login,
    logout: logout,
    me: me,
    get: get,
    upsert: upsert,
    syncPush: syncPush,
    outboxFlush: outboxFlush, // 22.09-261: отправить записи из очереди (вызывается при удачном опросе сервера)     // 22.09-254: общее сохранение раздела — только изменённое и только после синхронизации
    noteServer: noteServer, // 22.09-254: версия записи с сервера (вызывает синхронизация)
    canon: canon,
    update: update,
    del: del,
    sync: sync,
    status: adminStatus,            // 22.09-267
    backupNow: backupNow,           // 22.09-267
    auditByObject: auditByObject,   // 22.09-267
    audit: audit,
    errorsPush: errorsPush,
    errorsGet: errorsGet,
    errorsClear: errorsClear,
    eventsUrl: eventsUrl,
    clientId: clientId,
    snapsList: snapsList,
    snapGet: snapGet,
    snapPut: snapPut,
    snapDel: snapDel,
    getToken: getToken,
    setToken: setToken,
    getUser: getUser,
    setUser: setUser,
    // служебное
    _request: request
  };
})();