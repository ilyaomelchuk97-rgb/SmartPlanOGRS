/* ============================================================
   SmartPlan — real-time polling (sync_polling.js)
   ------------------------------------------------------------
   Сборка 22.09-26: каждую секунду опрашивает сервер Render
   через /api/sync?since=<timestamp> и применяет полученные
   изменения к локальным модулям (*_db.js, graphsSaveList).
   Это даёт эффект «каждый видит, что делает другой человек».

   Поведение:
   · if (!token) — ничего не делает (до логина)
   · if (token)   — каждую 1000 мс fetch /api/sync?since=<lastTs>
   · При получении — apply: для каждого раздела обновляет
     записи в localStorage + вызывает соответствующий модуль.
   · Если fetch упал — ретрай через 3 сек.
   · При выходе (logout) — polling останавливается.

   Индикатор в топбаре (#sync-dot, #sync-text):
   · серый «подключение…» — при инициализации
   · зелёный «в сети» — при успешных опросах
   · жёлтый «нет связи (N/3)» — при ошибках
   · красный «сервер недоступен» — после 3 ошибок подряд
   ============================================================ */
window.SP_SYNC_POLL = (function () {
  'use strict';

  var POLL_INTERVAL = 1000;     // 1 сек — если мгновенные уведомления недоступны (как раньше)
  var POLL_SLOW = 30000;        // 22.09-243: 30 сек — запасная проверка, пока работают мгновенные уведомления
  var ERROR_RETRY = 3000;       // при ошибке — 3 сек
  var MAX_ERRORS_INDICATOR = 3; // после 3 ошибок — красный

  // Маппинг: section → ключ в localStorage
  // sections: ключи из sync.js (SECTIONS)
  var LS_KEYS = {
    objects: 'smartplan_objects_db',
    tasks: 'smartplan_tasks_db',
    users: 'smartplan_users_db',
    areas: 'smartplan_areas_db',
    professions: 'smartplan_professions_db',
    workers: 'smartplan_workers_db',
    work_catalog: 'smartplan_work_catalog',
    graphs: 'smartplan_graphs',
    holidays: 'smartplan_holidays', // 22.09-109
    telemetry: 'smartplan_telemetry', // 22.09-111: виды телеметрии
    messages: 'smartplan_messages', // 22.09-264: объявления администратора
    settings: 'smartplan_settings' // 22.09-268: общие настройки (права доступа)
  };

  var state = {
    timer: null,
    lastTs: 0,
    inFlight: false,
    errors: 0,
    lastPoll: 0,
    stopped: false,
    ready: false,       // 22.09-254: первая полная синхронизация после входа/открытия получена
    onChange: null,
    online: [],         // массив {id, full_name, role, login, last_seen}
    es: null,           // 22.09-243: постоянное соединение (EventSource)
    sseUp: false,       // соединение открыто — изменения приходят мгновенно
    kickTimer: null,
    kickPending: false,
    sseRetry: null
  };

  /* 22.09-243: МГНОВЕННЫЕ ОБНОВЛЕНИЯ. Сервер сам сообщает «изменился раздел X» по постоянному
     соединению (/api/events) — сайт сразу забирает новое (/api/sync). Пока соединение открыто,
     опрос — раз в 30 сек (запасной); если соединение недоступно — как раньше, каждую секунду. */
  function kick() {
    if (state.stopped) return;
    if (state.kickTimer) return;
    state.kickTimer = setTimeout(function () {
      state.kickTimer = null;
      if (state.inFlight) { state.kickPending = true; return; }
      if (state.timer) { clearTimeout(state.timer); state.timer = null; }
      tick();
    }, 150);
  }
  function startSSE() {
    stopSSE();
    if (state.stopped || typeof window.EventSource !== 'function') return;
    if (!window.SP_API || !window.SP_API.eventsUrl) return;
    var url = window.SP_API.eventsUrl();
    if (!url) return;
    var es;
    try { es = new window.EventSource(url); } catch (e) { return; }
    state.es = es;
    es.onopen = function () {
      state.sseUp = true;
      kick(); // после (пере)подключения — сразу забрать всё, что изменилось за время обрыва
    };
    es.addEventListener('change', function (ev) {
      var d = null;
      try { d = JSON.parse(ev.data); } catch (e) {}
      if (d && d.by && window.SP_API.clientId && d.by === window.SP_API.clientId()) return; // своя правка
      kick();
    });
    es.onerror = function () {
      state.sseUp = false; // пока нет соединения — частый опрос, как раньше
      if (es.readyState === 2) { // закрыто окончательно (например, устарел токен) — новая попытка позже
        stopSSE();
        if (!state.stopped) state.sseRetry = setTimeout(startSSE, 30000);
      }
    };
  }
  function stopSSE() {
    if (state.sseRetry) { clearTimeout(state.sseRetry); state.sseRetry = null; }
    if (state.es) { try { state.es.close(); } catch (e) {} }
    state.es = null;
    state.sseUp = false;
  }

  // Геттер для UI (дропдаун в топбаре)
  function getOnline() { return state.online.slice(); }

  function fmtAgo(ts) {
    if (!ts) return '—';
    var dt = Math.round((Date.now() - ts) / 1000);
    if (dt < 1) return 'только что';
    if (dt < 60) return dt + ' с';
    if (dt < 3600) return Math.round(dt / 60) + ' мин';
    return Math.round(dt / 3600) + ' ч';
  }

  function updateIndicator(mode, info) {
    info = info || {};
    state.mode = mode; // 22.09-271: режим виден мини-окошку в шапке
    var dot = document.getElementById('sync-dot');
    var txt = document.getElementById('sync-text'); // 22.09-273: кнопка без текста — элемента может не быть
    var box = document.getElementById('sync-indicator');
    if (!dot) return;
    // 22.09-271: кружок мигает — зелёный в сети, оранжевый при подключении/сбоях, красный без связи
    if (mode === 'connected') {
      dot.style.background = '#16a34a';
      dot.style.animationDuration = '1.8s';
      if (txt) txt.textContent = 'Сервер: в сети';
      if (txt) txt.style.color = 'var(--green)';
      box.title = '';
    } else if (mode === 'connecting') {
      dot.style.background = '#f59e0b';
      dot.style.animationDuration = '1s';
      if (txt) txt.textContent = 'Сервер: подключение…';
      if (txt) txt.style.color = 'var(--yellow)';
      box.title = '';
    } else if (mode === 'warn') {
      dot.style.background = '#f59e0b';
      dot.style.animationDuration = '0.8s';
      if (txt) txt.textContent = 'Нет связи (' + (info.attempt || 1) + '/3)';
      if (txt) txt.style.color = 'var(--yellow)';
      box.title = '';
    } else if (mode === 'error') {
      dot.style.background = '#dc2626';
      dot.style.animationDuration = '0.7s';
      if (txt) txt.textContent = 'Сервер недоступен';
      if (txt) txt.style.color = 'var(--red)';
      box.title = '';
    } else if (mode === 'offline') {
      dot.style.background = '#dc2626';
      dot.style.animationDuration = '1.2s';
      if (txt) txt.textContent = 'Сервер: не в сети';
      if (txt) txt.style.color = 'var(--muted)';
      box.title = '';
    }
    // обновить открытое мини-окошко, если оно показано
    try { if (typeof window.spTipRefreshServer === 'function') window.spTipRefreshServer(); } catch (e) {}
  }

  // Утилита — записать в localStorage и пометить dirty
  function lsWrite(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function lsRead(key) {
    try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
    catch (e) { return null; }
  }

  /* ---------- APPLY: применить записи из /api/sync к локальной БД ---------- */
  function applyOne(sec, rec) {
    if (!rec || !rec.id) return false;
    var lsKey = LS_KEYS[sec];
    if (!lsKey) return false;
    // 22.09-254: запомнить версию записи на сервере — от неё считаются «изменённые в этом браузере»
    try { if (window.SP_API && SP_API.noteServer) SP_API.noteServer(sec, rec); } catch (eN) {}

    // Извлечь данные без служебных полей
    var data = Object.assign({}, rec);
    delete data._deleted;
    delete data._updated_at;

    if (sec === 'graphs' || sec === 'holidays' || sec === 'telemetry' || sec === 'messages' || sec === 'settings') { // 22.09-264/268
      // graphs / holidays / telemetry — массив записей в localStorage
      var list = lsRead(lsKey);
      if (!Array.isArray(list)) list = [];
      var idx = -1;
      for (var i = 0; i < list.length; i++) if (list[i].id === rec.id) { idx = i; break; }
      if (rec._deleted) {
        if (idx >= 0) list.splice(idx, 1);
      } else {
        if (idx >= 0) list[idx] = data;
        else list.push(data);
      }
      lsWrite(lsKey, list);
      return true;
    }

    if (sec === 'objects' || sec === 'tasks') {
      // { schema, <field>: [...] }
      var current = lsRead(lsKey);
      if (!current || typeof current !== 'object') current = { schema: 3 };
      var field = sec === 'tasks' ? 'tasks' : 'objects';
      if (!Array.isArray(current[field])) current[field] = [];
      var idx2 = -1;
      for (var j = 0; j < current[field].length; j++) {
        if (current[field][j] && current[field][j].id === rec.id) { idx2 = j; break; }
      }
      if (rec._deleted) {
        if (idx2 >= 0) current[field].splice(idx2, 1);
      } else {
        if (idx2 >= 0) current[field][idx2] = data;
        else current[field].push(data);
      }
      current.schema = 3;
      current.updated_at = Date.now();
      lsWrite(lsKey, current);
      return true;
    }

    if (sec === 'users') {
      // { schema: 3, users: [ {id, login, ...}, ... ] } — МАССИВ (не объект)
      var curU = lsRead(lsKey);
      if (!curU || typeof curU !== 'object') curU = { schema: 3, users: [] };
      if (!Array.isArray(curU.users)) {
        // миграция со старой схемы (объект-словарь) в массив
        var arr = [];
        if (curU.users && typeof curU.users === 'object') {
          Object.keys(curU.users).forEach(function (k) {
            var item = curU.users[k];
            if (item && typeof item === 'object' && !item.id) item.id = k;
            if (item) arr.push(item);
          });
        }
        curU.users = arr;
      }
      var idxU = -1;
      for (var u = 0; u < curU.users.length; u++) {
        if (curU.users[u] && curU.users[u].id === rec.id) { idxU = u; break; }
      }
      if (rec._deleted) {
        if (idxU >= 0) curU.users.splice(idxU, 1);
      } else {
        if (idxU >= 0) curU.users[idxU] = data;
        else curU.users.push(data);
      }
      // 22.09-258: убрать локальных «тестовых» пользователей (seed), чей логин занят другим
      // (пришедшим с сервера) пользователем — иначе в списке было по 2 записи с одним логином
      // (локальный «master» из посева + настоящий u_master с сервера). Удаляем только если на
      // этого пользователя не ссылаются локальные задачи (иначе — оставляем как есть).
      (function (list) {
        if (!Array.isArray(list)) return;
        var byLogin = {};
        list.forEach(function (x) { if (x && x.login && !x.seed) byLogin[String(x.login).toLowerCase()] = 1; });
        for (var i = list.length - 1; i >= 0; i--) {
          var uu = list[i];
          if (!uu || !uu.seed || !uu.login || !byLogin[String(uu.login).toLowerCase()]) continue;
          var refs = 0;
          try {
            (window.SP_TASKS && SP_TASKS.getTasks() ? SP_TASKS.getTasks() : []).forEach(function (t) {
              if (t && (String(t.m) === String(uu.id) || (Array.isArray(t.slesari) && t.slesari.indexOf(uu.id) !== -1))) refs++;
            });
          } catch (e) {}
          if (!refs) list.splice(i, 1);
        }
      })(curU.users);
      curU.schema = 3;
      curU.updated_at = Date.now();
      lsWrite(lsKey, curU);
      return true;
    }

    if (sec === 'areas') {
      // { schema: 1, areas: [{id, name, ...}, ...] }
      var curA = lsRead(lsKey);
      if (!curA || typeof curA !== 'object') curA = { schema: 1, areas: [] };
      if (!Array.isArray(curA.areas)) curA.areas = [];
      var idx3 = -1;
      for (var k = 0; k < curA.areas.length; k++) {
        if (curA.areas[k] && curA.areas[k].id === rec.id) { idx3 = k; break; }
      }
      if (rec._deleted) {
        if (idx3 >= 0) curA.areas.splice(idx3, 1);
      } else {
        if (idx3 >= 0) curA.areas[idx3] = data;
        else curA.areas.push(data);
      }
      curA.schema = 1;
      curA.updated_at = Date.now();
      lsWrite(lsKey, curA);
      return true;
    }

    if (sec === 'professions') {
      // { schema: 1, professions: [...], profNames: [...] } (Сборка 22.09-86/89)
      // kind:'prof_name' → названия списка-подсказки; иначе → записи справочника.
      var curP = lsRead(lsKey);
      if (!curP || typeof curP !== 'object') curP = { schema: 1, professions: [], profNames: [] };
      if (!Array.isArray(curP.professions)) curP.professions = [];
      if (!Array.isArray(curP.profNames)) curP.profNames = [];
      var arrP = (data.kind === 'prof_name') ? curP.profNames : curP.professions;
      var idxP = -1;
      for (var kp = 0; kp < arrP.length; kp++) {
        if (arrP[kp] && arrP[kp].id === rec.id) { idxP = kp; break; }
      }
      if (rec._deleted) {
        if (idxP >= 0) arrP.splice(idxP, 1);
      } else {
        if (idxP >= 0) arrP[idxP] = data;
        else arrP.push(data);
      }
      curP.schema = 1;
      curP.updated_at = Date.now();
      lsWrite(lsKey, curP);
      return true;
    }

    if (sec === 'workers') {
      // { schema: 1, workers: { uid: {hours, sched, ...} } }
      var curW = lsRead(lsKey);
      if (!curW || typeof curW !== 'object') curW = { schema: 1, workers: {} };
      if (!curW.workers || typeof curW.workers !== 'object') curW.workers = {};
      if (rec._deleted) {
        delete curW.workers[rec.id];
      } else {
        curW.workers[rec.id] = data;
      }
      curW.schema = 1;
      curW.updated_at = Date.now();
      lsWrite(lsKey, curW);
      return true;
    }

    if (sec === 'work_catalog') {
      // { schema: 5, areas: { 'Участок': [{...}, ...] } }
      var curWc = lsRead(lsKey);
      if (!curWc || typeof curWc !== 'object') curWc = { schema: 5, areas: {} };
      if (!curWc.areas || typeof curWc.areas !== 'object') curWc.areas = {};
      // Ищем в каком участке лежит работа
      var foundArea = null;
      var foundIdx = -1;
      Object.keys(curWc.areas).forEach(function (areaName) {
        var arr = curWc.areas[areaName];
        if (!Array.isArray(arr)) return;
        for (var m = 0; m < arr.length; m++) {
          if (arr[m] && arr[m].id === rec.id) { foundArea = areaName; foundIdx = m; break; }
        }
      });
      if (rec._deleted) {
        if (foundArea && foundIdx >= 0) curWc.areas[foundArea].splice(foundIdx, 1);
      } else {
        if (foundArea && foundIdx >= 0) {
          curWc.areas[foundArea][foundIdx] = data;
        } else {
          // Новая работа — кладём в первый попавшийся участок или в 'УБиРОГС'
          var target = data.area || Object.keys(curWc.areas)[0] || 'УБиРОГС';
          if (!curWc.areas[target]) curWc.areas[target] = [];
          curWc.areas[target].push(data);
        }
      }
      curWc.schema = 5;
      curWc.updated_at = Date.now();
      lsWrite(lsKey, curWc);
      return true;
    }

    return false;
  }

  // Применить изменения ко всем разделам разом
  function applyChanges(sections) {
    if (!sections || typeof sections !== 'object') return false;
    var dirty = false;
    Object.keys(sections).forEach(function (sec) {
      var records = sections[sec];
      if (!Array.isArray(records)) return;
      records.forEach(function (rec) {
        if (applyOne(sec, rec)) dirty = true;
      });
    });
    return dirty;
  }

  // Обновить in-memory cache модулей после записи в localStorage
  function refreshModules() {
    try { if (window.SP_OBJECTS && SP_OBJECTS.reloadFromCloud) SP_OBJECTS.reloadFromCloud(lsRead(LS_KEYS.objects)); } catch (e) {}
    try { if (window.SP_TASKS && SP_TASKS.reloadFromCloud) SP_TASKS.reloadFromCloud(lsRead(LS_KEYS.tasks)); } catch (e) {}
    try { if (window.SP_USERS_DB && SP_USERS_DB.reloadFromCloud) SP_USERS_DB.reloadFromCloud(lsRead(LS_KEYS.users)); } catch (e) {}
    try { if (window.SP_AREAS && SP_AREAS.reloadFromCloud) SP_AREAS.reloadFromCloud(lsRead(LS_KEYS.areas)); } catch (e) {}
    try { if (window.SP_PROFS && SP_PROFS.reloadFromCloud) SP_PROFS.reloadFromCloud(lsRead(LS_KEYS.professions)); } catch (e) {}
    try { if (window.SP_WORKERS && SP_WORKERS.reloadFromCloud) SP_WORKERS.reloadFromCloud(lsRead(LS_KEYS.workers)); } catch (e) {}
    try { if (window.SP_WORK && SP_WORK.reloadFromCloud) SP_WORK.reloadFromCloud(lsRead(LS_KEYS.work_catalog)); } catch (e) {}
    // graphs — без reloadFromCloud, у него graphsLoad() читает localStorage
  }

  // 22.09-254: применить записи с сервера немедленно — например, когда сервер отказал в записи
  // («на сервере версия новее»): браузер сразу показывает актуальные данные вместо устаревших
  function applyRemote(sec, records) {
    var changed = false;
    (Array.isArray(records) ? records : []).forEach(function (rec) { if (applyOne(sec, rec)) changed = true; });
    if (changed) {
      refreshModules();
      try { if (typeof window.onSyncUpdate === 'function') setTimeout(window.onSyncUpdate, 30); } catch (e) {}
    }
    return changed;
  }

  // Один цикл опроса
  function tick() {
    if (state.stopped) return;
    if (state.inFlight) return;
    if (!window.SP_API || !window.SP_API.getToken || !window.SP_API.getToken()) {
      updateIndicator('offline');
      // 22.09-101: токен потерян навсегда (устарел/сброшен) — после 3 тактов
      // просим войти заново, иначе приложение молча остаётся без синхронизации.
      state.noTokenTicks = (state.noTokenTicks || 0) + 1;
      if (state.noTokenTicks >= 3 && typeof window.SP_FORCE_RELOGIN === 'function') {
        state.noTokenTicks = -1e9; // один раз — без цикла
        try { window.SP_FORCE_RELOGIN(); } catch (e) {}
      }
      return;
    }
    state.noTokenTicks = 0;
    state.inFlight = true;
    var wasInitial = state.lastTs === 0; // 22.09-254: полная загрузка всех разделов
    window.SP_API.sync(state.lastTs)
      .then(function (r) {
        if (state.stopped) return;
        if (!r || !r.ok) {
          state.errors++;
          if (state.errors >= MAX_ERRORS_INDICATOR) updateIndicator('error');
          else updateIndicator('warn', { attempt: state.errors });
          return;
        }
        state.errors = 0;
        state.lastPoll = Date.now();
        // 22.09-261: сервер доступен — отправить накопившиеся записи (правки, сделанные, пока он спал)
        try { if (window.SP_API && SP_API.outboxFlush) SP_API.outboxFlush(); } catch (eFl) {}
        state.lastTs = r.now || Date.now();
        state.online = Array.isArray(r.online) ? r.online.slice() : [];
        updateIndicator('connected', { online: state.online.length });
        // Если открыт дропдаун — обновим его (без перезакрытия)
        try { if (typeof window.__syncRefreshDropdown === 'function') window.__syncRefreshDropdown(); } catch (e) {}
        var changed = applyChanges(r.sections);
        // 22.09-264: объявления администратора — всплывающее окно и список у админа
        try { if (window.SP_ANN && SP_ANN.afterSync) SP_ANN.afterSync(); } catch (eAnn) {}
        // 22.09-254: актуальные данные с сервера получены — с этого момента разрешено отправлять
        // изменения разделов (до этого браузер мог держать устаревшую копию и затереть ею сервер)
        if (wasInitial) state.ready = true; // 22.09-254
        // 22.09-257: перебазирование дат задач — ПОЛУЧИВ данные с сервера и ОБНОВИВ память модулей
        // (раньше работало до синхронизации: на новом браузере создавало якорь «сегодня» и ПИСАЛО
        // его на сервер, затирая настоящий якорь, от которого отсчитываются даты ВСЕХ задач;
        // при разных якорях на разных компьютерах задачи уходили не на свои календарные даты)
        if (wasInitial) {
          if (changed) refreshModules();
          try { if (typeof window.rebaseTaskDays === 'function') window.rebaseTaskDays(); } catch (eRb2) {}
        }
        if (changed) {
          refreshModules();
          // 22.09-266: сообщить приложению «данные изменились» — мягкое обновление экрана
          // (раньше этого не было: изменения с сервера не доходили до открытой страницы
          //  до её перерисовки — например, новые задачи в «Мои задания»)
          try { if (typeof window.onSyncUpdate === 'function') window.onSyncUpdate(); } catch (eSU) {}
          // Перерисовать UI (без сброса открытой модалки)
          try {
            var ov = document.getElementById('overlay');
            if (!ov || !ov.classList.contains('show')) {
              if (typeof refresh === 'function') refresh();
            }
          } catch (e) {}
          // Коллбэк на изменения
          if (typeof state.onChange === 'function') {
            try { state.onChange(r.sections); } catch (e) {}
          }
        }
      })
      ['catch'](function () {
        state.errors++;
        if (state.errors >= MAX_ERRORS_INDICATOR) updateIndicator('error');
        else updateIndicator('warn', { attempt: state.errors });
      })
      .then(function () {
        state.inFlight = false;
        if (!state.stopped) {
          var delay = state.errors > 0 ? ERROR_RETRY : (state.sseUp ? POLL_SLOW : POLL_INTERVAL); // 22.09-243
          if (state.kickPending) { state.kickPending = false; delay = 0; } // пришло уведомление во время запроса
          state.timer = setTimeout(tick, delay);
        }
      });
  }

  function init() {
    if (state.timer) return;
    state.stopped = false;
    state.ready = false; // 22.09-254
    state.lastTs = 0;
    state.errors = 0;
    updateIndicator('connecting');
    setTimeout(tick, 500);
    startSSE(); // 22.09-243
  }

  function stop() {
    state.stopped = true;
    state.ready = false; // 22.09-254: после выхода/перезапуска — снова ждать актуальных данных
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
    if (state.kickTimer) { clearTimeout(state.kickTimer); state.kickTimer = null; }
    stopSSE(); // 22.09-243
    updateIndicator('offline');
  }

  function status() {
    return {
      lastTs: state.lastTs,
      errors: state.errors,
      inFlight: state.inFlight,
      stopped: state.stopped,
      online: state.online,
      live: state.sseUp, // 22.09-243: мгновенные уведомления работают
      ready: state.ready, // 22.09-254: актуальные данные получены
      mode: state.mode || 'connecting', // 22.09-271: режим индикатора сервера
      lastPoll: state.lastPoll // 22.09-271: время последнего удачного опроса
    };
  }

  return {
    init: init,
    stop: stop,
    status: status,
    POLL_INTERVAL: POLL_INTERVAL,
    POLL_SLOW: POLL_SLOW,
    kick: kick,
    isReady: function () { return !!state.ready; }, // 22.09-254
    LS_KEYS: LS_KEYS,
    applyOne: applyOne,
    applyRemote: applyRemote, // 22.09-254
    getOnline: getOnline,
    onChange: function (cb) { state.onChange = cb; }
  };
})();