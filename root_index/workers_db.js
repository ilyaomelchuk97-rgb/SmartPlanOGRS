/* ============================================================
   SmartPlan — БАЗА ДАННЫХ РАБОТНИКОВ (workers_db.js)
   ------------------------------------------------------------
   Графики работы, время (8/12 ч), бригады, отсутствия и
   комментарии работников (мастера, слесаря, руководители).
   Хранение: localStorage + синхронизация с сервером по REST.
   Ключ работника = id пользователя из users_db.
   Формат: { schema: 2, workers: { uid: {
     hours: 8|12, sched: '5/2'|'2/2', cycle: 'YYYY-MM-DD',
     brigade: null|masterUid, comment: '', abs: { 'YYYY-MM-DD': 'причина' },
     overrides: { 'YYYY-MM-DD': { s:'work'|'off', h:часы|null } } — 22.09-207: ручные изменения дней,
     cycleHist: [ { from:'YYYY-MM-DD', cycle:'YYYY-MM-DD' } ] — 22.09-211: сдвиги цикла 2/2 (действуют с даты from)
   } } }
   22.09-215 (schema 2): дни каждого работника меняются ИНДИВИДУАЛЬНО — цикл 2/2 больше
   НЕ наследуется от мастера бригады. При переходе со схемы 1 каждому слесарю бригады
   разово копируются текущие cycle/cycleHist его мастера в его собственную запись —
   календари при этом не меняются, дальнейшие правки влияют только на своего человека.
   ============================================================ */
window.SP_WORKERS = (function () {
  'use strict';
  var KEY = 'smartplan_workers_db';
  var SCHEMA = 2;

  var memoryDB = null;
  function load() {
    if (memoryDB) return memoryDB;
    try { var raw = localStorage.getItem(KEY); if (raw) memoryDB = JSON.parse(raw); } catch (e) {}
    return memoryDB;
  }
  function save(db) {
    memoryDB = db;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {}
    syncWithServer(db);
  }
  function init() {
    var db = load();
    if (!db) { db = { schema: SCHEMA, workers: {} }; memoryDB = db; }
    else if (db.schema !== SCHEMA || !db.workers) {
      // обновление кода не теряет данные: снимок в smartplan_prev_, перенос в новую схему
      try { if (db.workers) localStorage.setItem('smartplan_prev_' + KEY, JSON.stringify(db)); } catch (e) {}
      if (db.schema === 1 && db.workers) {
        // 22.09-215: цикл 2/2 больше не наследуется от мастера — разово копируем каждому
        // слесарю бригады текущий цикл/историю его мастера в его собственную запись.
        Object.keys(db.workers).forEach(function (uid) {
          var wk = db.workers[uid];
          if (wk && wk.brigade && !(wk.cycleHist && wk.cycleHist.length) && db.workers[wk.brigade]) {
            var ow = db.workers[wk.brigade];
            wk.cycle = ow.cycle || wk.cycle;
            wk.cycleHist = (ow.cycleHist || []).map(function (s) { return { from: s.from, cycle: s.cycle }; });
          }
        });
      }
      db.schema = SCHEMA;
      if (!db.workers) db.workers = {};
      memoryDB = db;
      try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} // 22.09-215: сохранить миграцию сразу
    }
    return memoryDB;
  }
  function defaults() {
    return { hours: 8, sched: '5/2', cycle: '2026-01-05', brigade: null, prof: '', comment: '', abs: {}, overrides: {}, cycleHist: [] };
  }
  // Настройки работника (с значениями по умолчанию — копия)
  function getWorker(uid) {
    var db = init();
    var w = db.workers[uid];
    return Object.assign(defaults(), w || {});
  }
  // Частичное обновление настроек
  function setWorker(uid, patch) {
    var db = init();
    var merged = Object.assign(getWorker(uid), patch || {});
    db.workers[uid] = merged;
    save(db);
    return merged;
  }
  // Отсутствие: comment = null → снять отметку, иначе отметить (с комментарием или без)
  function setAbsence(uid, dateStr, comment) {
    var w = getWorker(uid);
    if (comment === null || comment === undefined) delete w.abs[dateStr];
    else w.abs[dateStr] = String(comment || '');
    return setWorker(uid, { abs: w.abs });
  }
  /* 22.09-207: ручное изменение конкретного дня графика смен.
     ov = { s:'work'|'off', h:часы|null } — зафиксировать состояние дня;
     ov = null — вернуть день к стандартному графику. */
  function setDayOverride(uid, dateStr, ov) {
    var w = getWorker(uid);
    if (!w.overrides) w.overrides = {};
    if (ov && ov.s === 'work') {
      var h = parseFloat(String(ov.h).replace(',', '.'));
      var rec = { s: 'work' };
      if (isFinite(h) && h > 0 && h <= 24) rec.h = Math.round(h * 100) / 100;
      w.overrides[dateStr] = rec;
    } else if (ov && ov.s === 'off') {
      w.overrides[dateStr] = { s: 'off' };
    } else {
      delete w.overrides[dateStr];
    }
    return setWorker(uid, { overrides: w.overrides });
  }
  /* 22.09-211: СДВИГ ЦИКЛА графика 2/2. Запись { from, cycle }: начиная с даты
     from цикл считается от новой даты cycle; дни РАНЬШЕ from считаются по-старому
     (отработанные дни не меняются). */
  function addCycleShift(uid, from, cycle) {
    var w = getWorker(uid);
    if (!w.cycleHist) w.cycleHist = [];
    w.cycleHist = w.cycleHist.filter(function (x) { return x && x.from !== from; });
    w.cycleHist.push({ from: String(from), cycle: String(cycle) });
    w.cycleHist.sort(function (a, b) { return a.from < b.from ? -1 : (a.from > b.from ? 1 : 0); });
    return setWorker(uid, { cycleHist: w.cycleHist });
  }
  function removeCycleShift(uid, from) {
    var w = getWorker(uid);
    if (!w.cycleHist) w.cycleHist = [];
    w.cycleHist = w.cycleHist.filter(function (x) { return x && x.from !== from; });
    return setWorker(uid, { cycleHist: w.cycleHist });
  }
  function reloadFromCloud(db) {
    if (db && db.workers) {
      memoryDB = { schema: SCHEMA, workers: db.workers };
      try { localStorage.setItem(KEY, JSON.stringify(memoryDB)); } catch (e) {}
    }
  }
  function syncWithServer(db) {
    // Сборка 22.09-26: SP_API.upsert
    if (!window.SP_API || !window.SP_API.getToken || !window.SP_API.getToken()) return;
    if (db && db.workers) {
      Object.keys(db.workers).forEach(function (uid) {
        var w = Object.assign({ id: uid }, db.workers[uid]);
        window.SP_API.upsert('workers', w).catch(function (e) {
          if (window.SP_ERRORS && SP_ERRORS.log) SP_ERRORS.log('warn', 'workers.sync', e && e.err || e);
        });
      });
    }
  }

  return {
    KEY: KEY, SCHEMA: SCHEMA,
    getWorker: getWorker, setWorker: setWorker, setAbsence: setAbsence, setDayOverride: setDayOverride,
    addCycleShift: addCycleShift, removeCycleShift: removeCycleShift,
    reloadFromCloud: reloadFromCloud
  };
})();
