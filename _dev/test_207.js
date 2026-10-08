'use strict';
/* 22.09-207 статические якоря */
var fs = require('fs');
var app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
var wdb = fs.readFileSync('/home/user/root_index/workers_db.js', 'utf8');
var fail = 0;
function ok(cond, name) { if (cond) { console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }

// workers_db: хранилище ручных изменений дней
ok(wdb.indexOf('function setDayOverride(uid, dateStr, ov)') >= 0, 'workers_db: setDayOverride');
ok(wdb.indexOf('overrides: {}') >= 0, 'workers_db: overrides в дефолтах');
ok(wdb.indexOf('setDayOverride: setDayOverride') >= 0, 'workers_db: экспорт setDayOverride');

// логика: переопределения учитываются
ok(app.indexOf('var ov = wd.overrides && wd.overrides[dateStr];') >= 0, 'wkIsWorking: учёт override');
ok(app.indexOf('var ov = wd.overrides && wd.overrides[ds];') >= 0, 'schDayHours: учёт override');
ok(app.indexOf('var _mcOv = wd.overrides && wd.overrides[key(d)];') >= 0, 'masterCapacity: учёт override');

// UI (22.09-211 заменил встроенный режим на окно редактора — см. test_211)
ok(app.indexOf('изменён вручную') >= 0, 'маркер ручного изменения в подсказке');

// окно редактора и сохранение
ok(app.indexOf('function openSchDayEditModal(uid, ds)') >= 0, 'окно редактора дня');
ok(app.indexOf('function schBrigadeOfUser(u)') >= 0, 'помощник бригады');
ok(app.indexOf('function schDayEditSave(reset)') >= 0, 'сохранение редактора');
ok(app.indexOf('⚠ Отработанные (прошедшие) дни не редактируются') >= 0, 'защита прошедших дней');
ok(app.indexOf('Применить ко всей бригаде (') >= 0, 'галочка бригады');
ok(app.indexOf('sch-day-work') >= 0 && app.indexOf('sch-day-off') >= 0 && app.indexOf('sch-day-hours') >= 0, 'элементы окна');
ok(app.indexOf("a === 'sch-day-edit'") >= 0 && app.indexOf("a === 'sch-day-save'") >= 0 && app.indexOf("a === 'sch-day-reset'") >= 0, 'диспетчер действий');
ok(app.indexOf('Вернуть стандарт') >= 0, 'кнопка сброса к стандарту');

console.log(fail ? ('FAILED: ' + fail) : 'ALL 207 TESTS PASSED');
process.exit(fail ? 1 : 0);
