// Тест сборки 22.09-225:
//  Отмена последних действий в планировании (как в Excel): стек снимков задач,
//  кнопка «⟲ Отмена» в строке календаря + Ctrl+Z на странице планирования.
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }
function cnt(sub) { return app.split(sub).length - 1; }

// сборка
ok(/var SP_BUILD = '22\.09-\d+';/.test(app), 'константа сборки (SP_BUILD) на месте');

// 1) стек отмены
ok(app.indexOf('var PLAN_UNDO_MAX = 30;') >= 0 && app.indexOf('function planUndoStack() {') >= 0, 'стек отмены (до 30 снимков)');
ok(app.indexOf('function planUndoPush(label) {') >= 0 && app.indexOf('function planUndoApply() {') >= 0, 'функции снимка и отката');
ok(app.indexOf('TASKS_DB.reloadFromCloud') >= 0, 'откат восстанавливает задачи из снимка');

// 2) снимки делаются перед действиями
ok(app.indexOf("planUndoPush('перенос задачи «'") >= 0, 'снимок перед перетаскиванием карточки');
ok(app.indexOf("planUndoPush('редактирование задачи «'") >= 0, 'снимок перед правкой задачи в карточке');
ok(app.indexOf("planUndoPush('⚡ «Оптимизировать работы»") >= 0, 'снимок перед оптимизацией (вся — одним шагом)');

// 3) управление
ok(app.indexOf('data-action="cal-undo"') >= 0 && app.indexOf("a === 'cal-undo'") >= 0, 'кнопка «⟲ Отмена» в строке календаря + диспетчер');
ok(app.indexOf("addEventListener('keydown', function (e) {") >= 0 && app.indexOf("S.screen !== 'calendar'") >= 0, 'Ctrl+Z на странице планирования');

// 4) регрессии
ok(app.indexOf('function rebaseTaskDaysToToday() {') >= 0, '224: привязка дат на месте');
ok(app.indexOf('СОВМЕСТНЫЕ работы одного объекта') >= 0, '223: совместные — единым блоком');

// 5) сборка/метки/журнал
const m = app.match(/var SP_BUILD = '22\.09-(\d+)';/);
ok(m && +m[1] >= 225, 'номер сборки поднят (' + (m && m[1]) + ')');
ok(index.indexOf('id="build-marker"') >= 0 && index.indexOf('Сборка 22.09-' + (m && m[1])) >= 0, 'метка сборки на экране входа');
ok((index.match(/\?v=22\.09-/g) || []).length === 17 && index.indexOf('?v=22.09-' + (m && m[1])) >= 0, 'все 17 script-тегов с новой версией');
ok(data.indexOf('{n:225, d:"2026-10-08"') >= 0, 'запись 225 в журнале изменений');

console.log('----------------------------------------');
console.log('TEST_225 TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
