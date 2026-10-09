// Тест сборки 22.09-224:
//  Задачи привязаны к календарной дате: служебная запись-якорь дня в базе задач,
//  при новом дне все смещения пересчитываются один раз (на всех устройствах).
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const tasks = fs.readFileSync('/home/user/root_index/tasks_db.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }
function cnt(sub) { return app.split(sub).length - 1; }

// сборка
ok(/var SP_BUILD = '22\.09-\d+';/.test(app), 'константа сборки (SP_BUILD) на месте');

// 1) якорь дат в приложении
ok(app.indexOf("var ANCHOR_TASK_ID = 't_day_anchor';") >= 0, 'есть служебная запись-якорь дат');
ok(app.indexOf('function rebaseTaskDaysToToday() {') >= 0, 'перебазирование дат реализовано');
ok(app.indexOf('day_anchor: todayK') >= 0 && app.indexOf('t.d -= delta') >= 0 && app.indexOf('t.dl -= delta') >= 0, 'новый день — смещения d/dl пересчитываются');
ok(app.indexOf('delta <= 0) return 0;') >= 0, 'защита: часы устройства «назад» — не трогаем');
ok(app.indexOf("TASKS_DB.addTask({ id: ANCHOR_TASK_ID") >= 0, 'первый запуск — якорь на сегодня, без сдвига');

// 2) точки вызова
ok(cnt('rebaseTaskDaysToToday();') >= 2, 'перебазирование вызывается при входе и при обновлении (' + cnt('rebaseTaskDaysToToday();') + ' шт)');

// 3) якорь не задача
ok(tasks.indexOf("function getTasks() { return init().tasks.filter(function (t) { return t && t.id !== 't_day_anchor'; }); }") >= 0, 'якорь не попадает в списки задач (tasks_db)');

// 4) регрессии на месте
ok(app.indexOf('function taskDurHours(t) {') >= 0, '223: длительность задачи');
ok(app.indexOf('СОВМЕСТНЫЕ работы одного объекта') >= 0, '223: совместные — единым блоком');

// 5) сборка/метки/журнал
const m = app.match(/var SP_BUILD = '22\.09-(\d+)';/);
ok(m && +m[1] >= 224, 'номер сборки поднят (' + (m && m[1]) + ')');
ok(index.indexOf('id="build-marker"') >= 0 && index.indexOf('Сборка 22.09-' + (m && m[1])) >= 0, 'метка сборки на экране входа');
ok((index.match(/\?v=22\.09-/g) || []).length === 17 && index.indexOf('?v=22.09-' + (m && m[1])) >= 0, 'все 17 script-тегов с новой версией');
ok(data.indexOf('{n:224, d:"2026-10-08"') >= 0, 'запись 224 в журнале изменений');

console.log('----------------------------------------');
console.log('TEST_224 TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
