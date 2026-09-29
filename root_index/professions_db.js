/* ============================================================
   SmartPlan — БАЗА ДАННЫХ ПРОФЕССИЙ (professions_db.js)
   ------------------------------------------------------------
   Справочник «Профессии» (22.09-86): наименование + разряд
   (3–6; с 22.09-89 разряд НЕОБЯЗАТЕЛЕН — «без разряда»).
   Список-подсказка названий (22.09-89): стандартные названия
   профессий (список от заказчика) + введённые вручную — именно
   он показывается выпадающим списком в карточке профессии;
   названия можно удалять, введённые вручную запоминаются,
   дубликаты не добавляются.
   Хранение: localStorage + синхронизация с сервером (REST).
   Формат: { schema: 1,
     professions: [{id, name, grade: 3..6|'', created}],
     profNames:   [{id: 'pn_*', kind: 'prof_name', name, created}] }
   ============================================================ */
window.SP_PROFS = (function () {
  'use strict';
  var KEY = 'smartplan_professions_db';
  var SCHEMA = 1;
  var GRADES = [3, 4, 5, 6]; // допустимые разряды ('' = без разряда)

  // Стандартные профессии из «Сопоставление видов работ…» (22.09-88)
  var DEFAULTS = [
    { id: 'p_canon_sgio3',      name: 'Слесарь газоиспользующего оборудования', grade: 3 },
    { id: 'p_canon_sgio4',      name: 'Слесарь газоиспользующего оборудования', grade: 4 },
    { id: 'p_canon_sgio5',      name: 'Слесарь газоиспользующего оборудования', grade: 5 },
    { id: 'p_canon_sgio6',      name: 'Слесарь газоиспользующего оборудования', grade: 6 },
    { id: 'p_canon_nal_kipia4', name: 'Наладчик КИПиА',                         grade: 4 },
    { id: 'p_canon_nal_kipia5', name: 'Наладчик КИПиА',                         grade: 5 },
    { id: 'p_canon_sl_kipia4',  name: 'Слесарь КИПиА',                          grade: 4 },
    { id: 'p_canon_sl_kipia5',  name: 'Слесарь КИПиА',                          grade: 5 }
  ];

  // Сборка 22.09-89: стандартный список названий профессий (от заказчика, по картинке)
  // + каноничные названия из справочника. Фиксированные id = без дублей между устройствами.
  var STANDARD_PROF_NAMES = [
    'Оператор персональных электронно-вычислительных машин',
    'Подсобный рабочий',
    'Начальник отдела',
    'Инженер',
    'Руководитель группы',
    'Техник',
    'Начальник участка',
    'Старший мастер',
    'Мастер',
    'Электрогазосварщик',
    'Монтажник наружных трубопроводов',
    'Слесарь по обслуживанию и ремонту наружных газопроводов',
    'Руководитель сектора',
    'Наладчик контрольно-измерительных приборов и автоматики',
    'Слесарь по контрольно-измерительным приборам и автоматике',
    'Слесарь по обслуживанию и ремонту газоиспользующего оборудования',
    'Каменщик',
    'Маляр',
    'Плотник',
    'Штукатур',
    'Дорожный рабочий',
    // каноничные названия из справочника норм (чтобы сразу были в списке)
    'Слесарь газоиспользующего оборудования',
    'Наладчик КИПиА',
    'Слесарь КИПиА'
  ];

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
    if (!db) { db = { schema: SCHEMA, professions: [], profNames: [] }; memoryDB = db; }
    else {
      if (db.schema !== SCHEMA) {
        // обновление кода не теряет данные: снимок в smartplan_prev_, перенос в новую схему
        try { if (db.professions) localStorage.setItem('smartplan_prev_' + KEY, JSON.stringify(db)); } catch (e) {}
        db.schema = SCHEMA;
      }
      if (!db.professions) db.professions = [];
      if (!db.profNames) db.profNames = []; // список-подсказка названий (22.09-89)
      memoryDB = db;
    }
    return memoryDB;
  }
  function reloadFromCloud(cloudData) {
    if (!cloudData) return;
    if (!Array.isArray(cloudData.professions) && !Array.isArray(cloudData.profNames)) return;
    memoryDB = {
      schema: SCHEMA,
      professions: Array.isArray(cloudData.professions) ? cloudData.professions : [],
      profNames: Array.isArray(cloudData.profNames) ? cloudData.profNames : []
    };
    try { localStorage.setItem(KEY, JSON.stringify(memoryDB)); } catch (e) {}
  }
  function newId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function newNameId() { return 'pn' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function syncWithServer(db) {
    if (!window.SP_API || !window.SP_API.getToken || !window.SP_API.getToken()) return;
    (db.professions || []).forEach(function (p) {
      if (!p || !p.id) return;
      window.SP_API.upsert('professions', Object.assign({}, p)).catch(function (e) {
        if (window.SP_ERRORS && SP_ERRORS.log) SP_ERRORS.log('warn', 'profs.sync', e && e.err || e);
      });
    });
    (db.profNames || []).forEach(function (n) {
      if (!n || !n.id) return;
      window.SP_API.upsert('professions', Object.assign({ kind: 'prof_name' }, n)).catch(function (e) {
        if (window.SP_ERRORS && SP_ERRORS.log) SP_ERRORS.log('warn', 'profnames.sync', e && e.err || e);
      });
    });
  }

  function normName(s) { return String(s || '').trim().replace(/\s+/g, ' '); }
  // Сборка 22.09-89: разряд необязателен — '' («без разряда») или число 3–6
  function validGrade(g) {
    if (g === '' || g == null) return '';
    var n = parseInt(g, 10);
    return GRADES.indexOf(n) >= 0 ? n : null;
  }
  function ensureSeed() {
    var db = init();
    // Посев стандартных профессий — один раз на устройстве (флаг).
    try {
      if (!localStorage.getItem('smartplan_profs_seed_v1')) {
        var changed = 0;
        DEFAULTS.forEach(function (d) {
          if (findDup(d.name, d.grade)) return;
          db.professions.push({ id: d.id, name: d.name, grade: d.grade, created: Date.now() });
          changed++;
        });
        try { localStorage.setItem('smartplan_profs_seed_v1', '1'); } catch (e) {}
        if (changed) save(db);
      }
    } catch (e) {}
    // Посев стандартного списка названий — один раз на устройстве (22.09-89).
    try {
      if (!localStorage.getItem('smartplan_prof_names_seed_v1')) {
        var changedN = 0;
        STANDARD_PROF_NAMES.forEach(function (nm, idx) {
          if (findNameDup(nm)) return;
          db.profNames.push({ id: 'pn_std_' + (idx + 1), kind: 'prof_name', name: nm, created: Date.now() });
          changedN++;
        });
        try { localStorage.setItem('smartplan_prof_names_seed_v1', '1'); } catch (e) {}
        if (changedN) save(db);
      }
    } catch (e) {}
    return Promise.resolve(db);
  }

  // ---------- Справочник профессий ----------
  function getAll() { return init().professions.map(function (p) { return Object.assign({}, p); }); }
  function getById(id) {
    var arr = init().professions;
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return Object.assign({}, arr[i]);
    return null;
  }
  // Дубликат по (наименование + разряд), регистронезависимо
  function findDup(name, grade, exceptId) {
    var n = normName(name).toLowerCase();
    var g = String(grade == null ? '' : grade);
    var arr = init().professions;
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i];
      if (!p || (exceptId && p.id === exceptId)) continue;
      if (String(p.name || '').toLowerCase() === n && String(p.grade == null ? '' : p.grade) === g) return p;
    }
    return null;
  }
  function label(p) { return p && p.grade ? (p.name + ' — ' + p.grade + ' разряд') : (p ? p.name : ''); }

  function addProf(name, grade) {
    name = normName(name);
    var g = validGrade(grade);
    if (!name) return { ok: false, error: 'Введите наименование профессии' };
    if (g === null) return { ok: false, error: 'Разряд — только 3–6 или «без разряда»' };
    if (findDup(name, g)) return { ok: false, error: 'Профессия «' + label({ name: name, grade: g }) + '» — уже есть в справочнике' };
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
    if (g === null) return { ok: false, error: 'Разряд — только 3–6 или «без разряда»' };
    var db = init();
    var idx = -1;
    for (var i = 0; i < db.professions.length; i++) if (db.professions[i].id === id) { idx = i; break; }
    if (idx < 0) return { ok: false, error: 'Профессия не найдена' };
    if (findDup(name, g, id)) return { ok: false, error: 'Профессия «' + label({ name: name, grade: g }) + '» — уже есть в справочнике' };
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

  // ---------- Список-подсказка названий (выпадающий список, 22.09-89) ----------
  function findNameDup(name) {
    var n = normName(name).toLowerCase();
    var arr = init().profNames;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && String(arr[i].name || '').toLowerCase() === n) return arr[i];
    }
    return null;
  }
  // Список названий для выпадающего списка: подсказка + названия из справочника
  function getNameList() {
    var map = {};
    init().profNames.forEach(function (n) {
      if (n && n.name) map[String(n.name).toLowerCase()] = n.name;
    });
    init().professions.forEach(function (p) {
      if (p && p.name && !map[String(p.name).toLowerCase()]) map[String(p.name).toLowerCase()] = p.name;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return String(a).localeCompare(String(b), 'ru'); });
  }
  // Запомнить название, введённое вручную (если его ещё нет — добавить в список)
  function addProfName(name) {
    name = normName(name);
    if (!name) return { ok: false };
    if (findNameDup(name)) return { ok: true, existed: true };
    var db = init();
    var rec = { id: newNameId(), kind: 'prof_name', name: name, created: Date.now() };
    db.profNames.push(rec);
    save(db);
    return { ok: true, name: rec };
  }
  // Удалить название из списка-подсказки (записи справочника удаляются отдельно)
  function deleteProfNameByName(name) {
    var n = normName(name).toLowerCase();
    var db = init();
    var removed = [];
    db.profNames = db.profNames.filter(function (e) {
      var hit = e && String(e.name || '').toLowerCase() === n;
      if (hit) removed.push(e);
      return !hit;
    });
    save(db);
    if (window.SP_API && window.SP_API.getToken && window.SP_API.getToken()) {
      removed.forEach(function (e) {
        window.SP_API.del('professions', e.id).catch(function (err) {
          if (window.SP_ERRORS && SP_ERRORS.log) SP_ERRORS.log('warn', 'profnames.del', err && err.err || err);
        });
      });
    }
    return removed.length;
  }

  return {
    ensureSeed: ensureSeed, getAll: getAll, getById: getById, findDup: findDup,
    addProf: addProf, updateProf: updateProf, deleteProf: deleteProf,
    getNameList: getNameList, addProfName: addProfName, deleteProfNameByName: deleteProfNameByName,
    reloadFromCloud: reloadFromCloud, GRADES: GRADES.slice(), label: label
  };
})();
