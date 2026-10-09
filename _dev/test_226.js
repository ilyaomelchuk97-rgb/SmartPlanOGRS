// Тест сборки 22.09-226:
//  «Печать графика» автоматически сохраняет полную копию графика;
//  справа от «Обозначения работ» — кнопка «Копии»: список сохранений,
//  предпросмотр и «Применить» (восстановление текущего графика из копии).
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }
function cnt(sub) { return app.split(sub).length - 1; }

// сборка
ok(/var SP_BUILD = '22\.09-\d+';/.test(app), 'константа сборки (SP_BUILD) на месте');

// 1) хранилище копий
ok(app.indexOf("var GRAPH_SNAPS_KEY = 'smartplan_graph_snaps_v1';") >= 0 && app.indexOf('function graphSnapSave(g, via) {') >= 0, 'хранилище копий графика при печати');
ok(app.indexOf('arr.length > 20') >= 0, 'хранится до 20 последних копий на график');

// 2) копия создаётся при обеих точках печати
ok(app.indexOf("graphSnapSave(g, 'печать графика');") >= 0, 'копия при кнопке «Печать графика» на панели');
ok(app.indexOf("graphSnapSave(g, 'печать из окна просмотра');") >= 0, 'копия при «Распечатать» из окон объекта/месяца');

// 3) кнопка и окно восстановления
ok(app.indexOf("{ tool: 'snaps', tip: '22.09-226: Копии графика") >= 0, 'кнопка «Копии» справа от «Обозначения работ»');
ok(app.indexOf("el.dataset.tool === 'snaps'") >= 0 && app.indexOf('function openGraphSnapsModal() {') >= 0, 'окно со списком сохранений');
ok(app.indexOf('function openGraphSnapPreviewModal(sid) {') >= 0 && app.indexOf('function graphSnapApply(sid) {') >= 0, 'просмотр копии и применение');
ok(app.indexOf("a === 'graph-snap-preview'") >= 0 && app.indexOf("a === 'graph-snap-apply'") >= 0, 'действия окна подключены в диспетчер');
ok(app.indexOf('restored_from = sn.ts') >= 0, 'при применении помечается источник восстановления');

// 4) регрессии
ok(app.indexOf('function planUndoApply() {') >= 0, '225: отмена действий');
ok(app.indexOf('function rebaseTaskDaysToToday() {') >= 0, '224: привязка дат');

// 5) сборка/метки/журнал
const m = app.match(/var SP_BUILD = '22\.09-(\d+)';/);
ok(m && +m[1] >= 226, 'номер сборки поднят (' + (m && m[1]) + ')');
ok(index.indexOf('id="build-marker"') >= 0 && index.indexOf('Сборка 22.09-' + (m && m[1])) >= 0, 'метка сборки на экране входа');
ok((index.match(/\?v=22\.09-/g) || []).length === 17 && index.indexOf('?v=22.09-' + (m && m[1])) >= 0, 'все 17 script-тегов с новой версией');
ok(data.indexOf('{n:226,') >= 0, 'запись 226 в журнале изменений');

console.log('----------------------------------------');
console.log('TEST_226 TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
