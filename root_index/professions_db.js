/* ============================================================
   SmartPlan — БАЗА ДАННЫХ ПРОФЕССИЙ (professions_db.js)
   ------------------------------------------------------------
   Справочник «Профессии» (Сборка 22.09-86): наименование
   профессии + разряд (3–6). Используется в карточке работ ГРП
   (состав бригады исполнителей) — выбор строго из справочника.
   Хранение: localStorage + синхронизация с сервером (REST),
   как у участков (areas_db.js).
   Формат: { schema: 1, professions: [{id, name, grade, created}] }
   ============================================================ */
window.SP_PROFS = (function () {
  'use strict';
  var KEY = 'smartplan_professions_db';
  var SCHEMA = 1;
  var GRADES = [3, 4, 5, 6]; // допустимые разряды

  var memoryDB = null;
  function load() {
    if (memoryDB) return memoryDB;
    try { var raw = localStorage.getItem(KEY); if (raw) memoryDB = JSON.parse(raw); } catch (e) {}
    return memoryDB;
  }
  function save(db) {
    memoryDB = db;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {}
    // автосинхронизация при любом save()
    if (window.SP_API && window.SP_API.getToken && window.SP_API.getToken()) {
      syncWithServer(db);
    }
  }
  function init() {
    var db = load();
    if (!db) { db = { schema: SCHEMA, professions: [] }; memoryDB = db; }
    else if (db.schema !== SCHEMA) {
      // обновление кода не теряет данные: снимок в smartplan_prev_, перенос в новую схему
      try { if (db.professions) localStorage.setItem('smartplan_prev_' + KEY, JSON.stringify(db)); } catch (e) {}
      db.schema = SCHEMA;
      if (!db.professions) db.professions = [];
      memoryDB = db;
    }
    return memoryDB;
  }
  function reloadFromCloud(cloudData) {
    if (cloudData && Array.isArray(cloudData.professions)) {
      memoryDB = { schema: SCHEMA, professions: cloudData.professions };
      try { localStorage.setItem(KEY, JSON.stringify(memoryDB)); } catch (e) {}
    }
  }
  function newId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function syncWithServer(db) {
    if (!window.SP_API || !window.SP_API.getToken || !window.SP_API.getToken()) return;
    (db.professions || []).forEach(function (p) {
      if (!p || !p.id) return;
      window.SP_API.upsert('professions', Object.assign({}, p)).catch(function (e) {
        if (window.SP_ERRORS && SP_ERRORS.log) SP_ERRORS.log('warn', 'profs.sync', e && e.err || e);
      });
    });
  }

  function normName(s) { return String(s || '').trim().replace(/\s+/g, ' '); }
  function validGrade(g) {
    var n = parseInt(g, 10);
    return GRADES.indexOf(n) >= 0 ? n : null;
  }
  function ensureSeed() { init(); return Promise.resolve(init()); }

  function getAll() { return init().professions.map(function (p) { return Object.assign({}, p); }); }
  function getById(id) {
    var arr = init().professions;
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return Object.assign({}, arr[i]);
    return null;
  }
  // Дубликат по (наименование + разряд), регистронезависимо
  function findDup(name, grade, exceptId) {
    var n = normName(name).toLowerCase();
    var g = String(grade);
    var arr = init().professions;
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i];
      if (!p || (exceptId && p.id === exceptId)) continue;
      if (String(p.name || '').toLowerCase() === n && String(p.grade) === g) return p;
    }
    return null;
  }
  function label(p) { return p ? (p.name + ' — ' + p.grade + ' разряд') : ''; }

  function addProf(name, grade) {
    name = normName(name);
    var g = validGrade(grade);
    if (!name) return { ok: false, error: 'Введите наименование профессии' };
    if (g === null) return { ok: false, error: 'Выберите разряд (от 3 до 6)' };
    if (findDup(name, g)) return { ok: false, error: 'Профессия «' + name + '», ' + g + ' разряд — уже есть в справочнике' };
    var db = init();
    var p = { id: newId(), name: name, grade: g, created: Date.now() };
    db.professions.push(p);
    save(db); // save() сама синхронизирует с сервером
    return { ok: true, prof: p };
  }
  function updateProf(id, name, grade) {
    name = normName(name);
    var g = validGrade(grade);
    if (!name) return { ok: false, error: 'Введите наименование профессии' };
    if (g === null) return { ok: false, error: 'Выберите разряд (от 3 до 6)' };
    var db = init();
    var idx = -1;
    for (var i = 0; i < db.professions.length; i++) if (db.professions[i].id === id) { idx = i; break; }
    if (idx < 0) return { ok: false, error: 'Профессия не найдена' };
    if (findDup(name, g, id)) return { ok: false, error: 'Профессия «' + name + '», ' + g + ' разряд — уже есть в справочнике' };
    db.professions[idx].name = name;
    db.professions[idx].grade = g;
    save(db);
    return { ok: true, prof: Object.assign({}, db.professions[idx]) };
  }
  function deleteProf(id) {
    var db = init();
    db.professions = db.professions.filter(function (p) { return p && p.id !== id; });
    save(db);
    if (window.SP_API && window.SP_API.getToken && window.SP_API.getToken()) {
      window.SP_API.del('professions', id).catch(function (e) {
        if (window.SP_ERRORS && SP_ERRORS.log) SP_ERRORS.log('warn', 'profs.del', e && e.err || e);
      });
    }
  }

  return {
    ensureSeed: ensureSeed, getAll: getAll, getById: getById, findDup: findDup,
    addProf: addProf, updateProf: updateProf, deleteProf: deleteProf,
    reloadFromCloud: reloadFromCloud, GRADES: GRADES.slice(), label: label
  };
})();
