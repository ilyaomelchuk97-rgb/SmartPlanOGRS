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
   · зелёный «в сети · N с назад» — при успешных опросах
   · жёлтый «нет связи (N/3)» — при ошибках
   · красный «сервер недоступен» — после 3 ошибок подряд
   ============================================================ */
window.SP_SYNC_POLL = (function () {
  'use strict';

  var POLL_INTERVAL = 1000;     // 1 сек
  var ERROR_RETRY = 3000;       // при ошибке — 3 сек
  var MAX_ERRORS_INDICATOR = 3; // после 3 ошибок — красный

  // Маппинг: section → ключ в localStorage
  // sections: ключи из sync.js (SECTIONS)
  var LS_KEYS = {
    objects: 'smartplan_objects_db',
    tasks: 'smartplan_tasks_db',
    users: 'smartplan_users_db',
    areas: 'smartplan_areas_db',
    workers: 'smartplan_workers_db',
    work_catalog: 'smartplan_work_catalog',
    graphs: 'smartplan_graphs'
  };

  var state = {
    timer: null,
    lastTs: 0,
    inFlight: false,
    errors: 0,
    lastPoll: 0,
    stopped: false,
    onChange: null
  };

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
    var dot = document.getElementById('sync-dot');
    var txt = document.getElementById('sync-text');
    var box = document.getElementById('sync-indicator');
    if (!dot || !txt) return;
    if (mode === 'connected') {
      dot.style.background = '#16a34a';
      txt.textContent = info.online ? ('Сервер: в сети · ' + info.online + ' онлайн') : 'Сервер: в сети';
      txt.style.color = '#166534';
      if (box) box.title = 'Real-time синхронизация · последний опрос ' + fmtAgo(state.lastPoll) + ' назад';
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
      if (box) box.title = 'Сервер Render недоступен';
    } else if (mode === 'offline') {
      dot.style.background = '#94a3b8';
      txt.textContent = 'Сервер: выход';
      txt.style.color = '#64748b';
    }
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

    // Извлечь данные без служебных полей
    var data = Object.assign({}, rec);
    delete data._deleted;
    delete data._updated_at;

    if (sec === 'graphs') {
      // graphs — массив в localStorage
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
    try { if (window.SP_WORKERS && SP_WORKERS.reloadFromCloud) SP_WORKERS.reloadFromCloud(lsRead(LS_KEYS.workers)); } catch (e) {}
    try { if (window.SP_WORK && SP_WORK.reloadFromCloud) SP_WORK.reloadFromCloud(lsRead(LS_KEYS.work_catalog)); } catch (e) {}
    // graphs — без reloadFromCloud, у него graphsLoad() читает localStorage
  }

  // Один цикл опроса
  function tick() {
    if (state.stopped) return;
    if (state.inFlight) return;
    if (!window.SP_API || !window.SP_API.getToken || !window.SP_API.getToken()) {
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
        var changed = applyChanges(r.sections);
        if (changed) {
          refreshModules();
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
    LS_KEYS: LS_KEYS,
    applyOne: applyOne,
    onChange: function (cb) { state.onChange = cb; }
  };
})();