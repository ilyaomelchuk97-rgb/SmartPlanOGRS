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
   · SP_API.delete(section, id)     — DELETE /api/<section>/:id
   · SP_API.sync(since)             — GET /api/sync?since=<ts>
   · SP_API.audit(limit, since)     — GET /api/audit
   · SP_API.health()                — GET /healthz

   Ошибки:
   · Все методы возвращают Promise<{ ok, ... }> — НЕ throw'ят.
   · При сетевой ошибке — возвращают { ok: false, err: '...' }.
   ============================================================ */
window.SP_API = (function () {
  'use strict';

  var LS_TOKEN = 'smartplan_api_token';
  var LS_USER  = 'smartplan_api_user';

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
    var headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
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
    var base = window.location.origin;
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

  function upsert(section, record) {
    if (!record || !record.id) return Promise.resolve({ ok: false, err: 'нет id' });
    return request('POST', '/' + section, { id: record.id, data: record });
  }

  function update(section, id, record, expectedUpdatedAt) {
    var body = { data: record };
    if (expectedUpdatedAt) body.expected_updated_at = expectedUpdatedAt;
    return request('PUT', '/' + section + '/' + encodeURIComponent(id), body);
  }

  function del(section, id) {
    return request('DELETE', '/' + section + '/' + encodeURIComponent(id));
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

  return {
    baseUrl: getBaseUrl,
    health: health,
    login: login,
    logout: logout,
    me: me,
    get: get,
    upsert: upsert,
    update: update,
    del: del,
    sync: sync,
    audit: audit,
    getToken: getToken,
    setToken: setToken,
    getUser: getUser,
    setUser: setUser,
    // служебное
    _request: request
  };
})();