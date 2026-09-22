/* ============================================================
   SmartPlan — real-time polling (sync_polling.js)
   ------------------------------------------------------------
   Сборка 22.09-25: каждую секунду опрашивает сервер Render
   через /api/sync?since=<timestamp> и применяет полученные
   изменения к локальным модулям (*_db.js). Это даёт эффект
   «каждый видит, что делает другой человек» без WebSocket.

   Поведение:
   · if (!token) — ничего не делает (до логина)
   · if (token)   — каждую 1000 мс fetch /api/sync?since=<lastTs>
   · При получении — apply: для каждого раздела обновляет
     записи в localStorage + вызывает соответствующий
     модуль (SP_OBJECTS.reloadFromCloud и т.д.) + перерисовывает UI.
   · Если fetch упал — ретрай через 3 сек.
   · При выходе (logout) — polling останавливается.

   Индикатор в топбаре (#sync-dot, #sync-text):
   · серый «подключение…» — при инициализации
   · зелёный «в сети · 3 с ●» — при успешных опросах
   · жёлтый «нет связи · 5 с» — при ошибках (с ретраем)
   · красный «сервер недоступен» — после 3 ошибок подряд
   ============================================================ */
window.SP_SYNC_POLL = (function () {
  'use strict';

  var POLL_INTERVAL = 1000;     // 1 сек
  var ERROR_RETRY = 3000;       // при ошибке — 3 сек
  var MAX_ERRORS_INDICATOR = 3; // после 3 ошибок — красный индикатор

  var state = {
    timer: null,
    lastTs: 0,
    inFlight: false,
    errors: 0,
    online: 0,
    stopped: false,
    onChange: null  // callback при изменениях
  };

  function fmtAgo(ts) {
    if (!ts) return '—';
    var dt = Math.round((Date.now() - ts) / 1000);
    if (dt < 1) return 'только что';
    if (dt < 60) return dt + ' с';
    if (dt < 3600) return Math.round(dt / 60) + ' мин';
    return Math.round(dt / 3600) + ' ч';
  }

  // Обновить индикатор в топбаре
  function updateIndicator(mode, info) {
    info = info || {};
    var dot = document.getElementById('sync-dot');
    var txt = document.getElementById('sync-text');
    var box = document.getElementById('sync-indicator');
    if (!dot || !txt) return;
    var title = box ? box.getAttribute('data-title-base') || '' : '';
    if (mode === 'connected') {
      dot.style.background = '#16a34a';
      txt.textContent = info.online ? ('Сервер: в сети · ' + info.online + ' онлайн') : 'Сервер: в сети';
      txt.style.color = '#166534';
      if (box) box.title = 'Real-time синхронизация активна · последний опрос ' + fmtAgo(state.lastPoll) + ' назад';
    } else if (mode === 'connecting') {
      dot.style.background = '#94a3b8';
      txt.textContent = 'Сервер: подключение…';
      txt.style.color = '#64748b';
      if (box) box.title = 'Подключение к серверу Render…';
    } else if (mode === 'warn') {
      dot.style.background = '#f59e0b';
      txt.textContent = 'Нет связи (' + (info.attempt || 1) + '/3)';
      txt.style.color = '#92400e';
      if (box) box.title = 'Проблемы со связью — пробую ещё раз';
    } else if (mode === 'error') {
      dot.style.background = '#dc2626';
      txt.textContent = 'Сервер недоступен';
      txt.style.color = '#7f1d1d';
      if (box) box.title = 'Сервер Render недоступен — пробую каждые ' + (ERROR_RETRY/1000) + ' с';
    } else if (mode === 'offline') {
      dot.style.background = '#94a3b8';
      txt.textContent = 'Сервер: выход';
      txt.style.color = '#64748b';
    }
  }

  // Применить полученные изменения к локальной БД и UI
  function applyChanges(sections) {
    if (!sections || typeof sections !== 'object') return;
    var counts = {};
    var dirty = false;
    Object.keys(sections).forEach(function (sec) {
      var records = sections[sec];
      if (!Array.isArray(records) || !records.length) return;
      counts[sec] = 0;
      // Получаем текущее состояние из localStorage
      var lsKey = 'smartplan_' + sec + '_db';
      var current = null;
      try { current = JSON.parse(localStorage.getItem(lsKey) || 'null'); } catch (e) {}
      if (!current) return;

      // Перебираем записи — обновляем или удаляем
      records.forEach(function (rec) {
        if (!rec || !rec.id) return;
        if (sec === 'graphs') {
          // graphs — массив
          if (rec._deleted) {
            current = (current || []).filter(function (g) { return g.id !== rec.id; });
          } else {
            var idx = -1;
            for (var i = 0; i < current.length; i++) if (current[i].id === rec.id) { idx = i; break; }
            // Берём rec и убираем служебные поля
            var c = Object.assign({}, rec);
            delete c._deleted; delete c._updated_at;
            if (idx >= 0) current[idx] = c;
            else current.push(c);
          }
          counts[sec]++;
          dirty = true;
        } else if (current && current[sec.replace(/s$/, '')] || sec === 'users' || sec === 'areas' || sec === 'workers' || sec === 'work_catalog' || sec === 'tasks' || sec === 'objects') {
          // Остальные разделы — { schema, <field>: {...} } или просто массив
          var field = secToField(sec);
          var coll = current[field];
          if (!coll) return;
          if (sec === 'tasks' || sec === 'objects') {
            // массив
            if (rec._deleted) {
              for (var j = coll.length - 1; j >= 0; j--) {
                if (coll[j] && coll[j].id === rec.id) { coll.splice(j, 1); break; }
              }
            } else {
              var found = false;
              for (var k = 0; k < coll.length; k++) {
                if (coll[k] && coll[k].id === rec.id) { coll[k] = Object.assign({}, rec, { id: rec.id });
                  delete coll[k]._deleted; delete coll[k]._updated_at; found = true; break; }
              }
              if (!found) {
                var c2 = Object.assign({}, rec);
                delete c2._deleted; delete c2._updated_at;
                coll.push(c2);
              }
            }
            counts[sec]++;
            dirty = true;
          } else if (sec === 'users') {
            // users: { schema, users: { uid: {...} } }
            if (rec._deleted) { delete coll.users[rec.id]; }
            else {
              var c3 = Object.assign({}, rec);
              delete c3._deleted; delete c3._updated_at;
              coll.users[rec.id] = c3;
            }
            counts[sec]++;
            dirty = true;
          } else if (sec === 'areas' || sec === 'workers' || sec === 'work_catalog') {
            // { schema, <field>: { id: {...} } } — map
            if (rec._deleted) { delete coll[rec.id]; }
            else {
              var c4 = Object.assign({}, rec);
              delete c4._deleted; delete c4._updated_at;
              coll[rec.id] = c4;
            }
            counts[sec]++;
            dirty = true;
          }
        }
      });

      if (counts[sec]) {
        try { localStorage.setItem(lsKey, JSON.stringify(current)); } catch (e) {}
      }
    });

    if (dirty) {
      // Обновить модули
      try { if (window.SP_OBJECTS && SP_OBJECTS.reloadFromCloud) SP_OBJECTS.reloadFromCloud(loadLS('smartplan_objects_db')); } catch (e) {}
      try { if (window.SP_TASKS && SP_TASKS.reloadFromCloud) SP_TASKS.reloadFromCloud(loadLS('smartplan_tasks_db')); } catch (e) {}
      try { if (window.SP_USERS_DB && SP_USERS_DB.reloadFromCloud) SP_USERS_DB.reloadFromCloud(loadLS('smartplan_users_db')); } catch (e) {}
      try { if (window.SP_AREAS && SP_AREAS.reloadFromCloud) SP_AREAS.reloadFromCloud(loadLS('smartplan_areas_db')); } catch (e) {}
      try { if (window.SP_WORKERS && SP_WORKERS.reloadFromCloud) SP_WORKERS.reloadFromCloud(loadLS('smartplan_workers_db')); } catch (e) {}
      try { if (window.SP_WORK && SP_WORK.reloadFromCloud) SP_WORK.reloadFromCloud(loadLS('smartplan_work_catalog')); } catch (e) {}
      try { if (window.SP_GRAPHS && SP_GRAPHS.reloadFromCloud) SP_GRAPHS.reloadFromCloud(loadLS('smartplan_graphs')); } catch (e) {}
      // Перерисовать UI (не сбрасывая открытую модалку)
      try {
        var ov = document.getElementById('overlay');
        if (!ov || !ov.classList.contains('show')) {
          if (typeof refresh === 'function') refresh();
        }
      } catch (e) {}

      // Колбэк на изменения (например, для журнала)
      if (typeof state.onChange === 'function') {
        try { state.onChange(counts); } catch (e) {}
      }
    }
  }

  function secToField(sec) {
    return {
      'tasks': 'tasks',
      'objects': 'objects',
      'users': 'users',
      'areas': 'areas',
      'workers': 'workers',
      'work_catalog': 'areas',
      'graphs': null
    }[sec];
  }

  function loadLS(k) {
    try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; }
  }

  // Один цикл опроса
  function tick() {
    if (state.stopped) return;
    if (state.inFlight) return;
    if (!window.SP_API || !window.SP_API.getToken || !window.SP_API.getToken()) {
      // нет авторизации — не опрашиваем
      updateIndicator('offline');
      return;
    }
    state.inFlight = true;
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
        state.lastTs = r.now || Date.now();
        updateIndicator('connected', { online: r.online ? r.online.length : 0 });
        applyChanges(r.sections);
      })
      ['catch'](function () {
        state.errors++;
        if (state.errors >= MAX_ERRORS_INDICATOR) updateIndicator('error');
        else updateIndicator('warn', { attempt: state.errors });
      })
      .then(function () {
        state.inFlight = false;
        // Планируем следующий тик
        if (!state.stopped) {
          var delay = state.errors > 0 ? ERROR_RETRY : POLL_INTERVAL;
          state.timer = setTimeout(tick, delay);
        }
      });
  }

  function init() {
    if (state.timer) return;
    state.stopped = false;
    state.lastTs = 0;
    state.errors = 0;
    updateIndicator('connecting');
    // Первый опрос сразу
    setTimeout(tick, 500);
  }

  function stop() {
    state.stopped = true;
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
    updateIndicator('offline');
  }

  function status() {
    return {
      lastTs: state.lastTs,
      errors: state.errors,
      inFlight: state.inFlight,
      stopped: state.stopped,
      online: state.online
    };
  }

  return {
    init: init,
    stop: stop,
    status: status,
    POLL_INTERVAL: POLL_INTERVAL,
    onChange: function (cb) { state.onChange = cb; }
  };
})();