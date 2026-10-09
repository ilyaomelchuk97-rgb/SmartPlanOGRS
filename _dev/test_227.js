// Тест сборки 22.09-227:
//  1) Один объект в нескольких графиках одного года — задачи в планировании
//     НЕ дублируются: серия привязывается к уже существующей задаче
//     (объект+работа+дата), вторая не создаётся; «чужая» задача при
//     пересчёте/удалении серии не удаляется.
//  2) На странице «График работ» справа внизу — предупреждение об объекте
//     в другом графике (название графика, год, ФИО мастера), с крестиком.
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }
function cnt(sub) { return app.split(sub).length - 1; }

// сборка
ok(/var SP_BUILD = '22\.09-\d+';/.test(app), 'константа сборки (SP_BUILD) на месте');

// 1) защита от дублей
ok(cnt('function gwFindPlanTask(oid, wid, occIso) {') === 1, 'поиск существующей задачи (объект+работа+дата)');
ok(app.indexOf("var tiso = t.date || (typeof t.d === 'number' ? key(offToDate(t.d)) : '');") >= 0, 'дата сравнивается и по t.date, и по смещению от сегодняшнего дня');
ok(cnt('if (dupT) { tk = dupT; st.dup++; }') === 1, 'генерация графика: дубль не создаётся — серия привязывается');
ok(cnt('if (dupT2) { tk = dupT2; dupCnt++; }') === 1, 'сохранение периодичности: дубль не создаётся — серия привязывается');
ok(cnt('var st = { created: 0, shifted: 0, fail: 0, dup: 0 };') === 1, 'счётчик привязанных вхождений в генерации');
ok(app.indexOf('dupCnt = 0;') >= 0, 'счётчик привязанных в сохранении периодичности');
ok(cnt('st.dup = (st.dup || 0) + s2.dup;') === 1, 'агрегация привязанных при пересчёте года');

// 2) «чужая» задача не страдает от чужой серии
ok(cnt('if (tk.graphId && tk.graphId !== g.id) { oc.tid = null; st.kept++; return; }') === 1, 'пересчёт года: чужую задачу не удаляет и не отвязывает от её графика');
ok(cnt('if (_kt && _kt.graphId && _kt.graphId !== g.id) { oc.tid = null; return; }') === 1, 'удаление серии: чужую задачу не удаляет');
ok(cnt('if (tk && !isDone(tk) && tk.d < 0 && (!tk.graphId || tk.graphId === g.id))') === 1, 'чистка просроченных: чужую задачу не удаляет');
ok(app.indexOf('уже были в планировании (привязаны из другого графика, не дублируются)') >= 0, 'тост сохранения периодичности сообщает о привязанных (не дублях)');
ok(app.indexOf("уже были в планировании (без дублей): ' + rs.dup") >= 0, 'тост пересчёта года сообщает о привязанных');

// 3) предупреждение справа внизу
ok(cnt('function graphsDupWarnHtml() {') === 1, 'плашка предупреждения');
ok(app.indexOf('id="graph-dup-warn"') >= 0 && app.indexOf('position:fixed;right:12px;bottom:12px;z-index:90;') >= 0, 'плашка закреплена справа внизу экрана');
ok(app.indexOf('мастер: ') >= 0 && app.indexOf('есть ещё в графике:') >= 0, 'в плашке — название графика, год и ФИО мастера');
ok(app.indexOf("return g.id !== GS.cur;") >= 0, 'показываются ДРУГИЕ графики относительно открытого');
ok(cnt('html += graphsDupWarnHtml();') === 1, 'плашка рисуется на странице «График работ»');
ok(cnt("a === 'graph-dup-hide'") >= 1 && app.indexOf('S.graphDupWarnHidden = true') >= 0, 'крестик скрывает плашку до перезахода');
ok(app.indexOf('data-action="graph-dup-hide"') >= 0, 'кнопка-крестик в плашке');

// 4) регрессии
ok(app.indexOf('function graphSnapSave(g, via) {') >= 0, '226: копии графика при печати');
ok(app.indexOf('function planUndoApply() {') >= 0, '225: отмена действий');
ok(app.indexOf('function rebaseTaskDaysToToday() {') >= 0, '224: привязка дат');

// 5) сборка/метки/журнал
const m = app.match(/var SP_BUILD = '22\.09-(\d+)';/);
ok(m && +m[1] >= 227, 'номер сборки поднят (' + (m && m[1]) + ')');
ok(index.indexOf('id="build-marker"') >= 0 && index.indexOf('Сборка 22.09-' + (m && m[1])) >= 0, 'метка сборки на экране входа');
ok((index.match(/\?v=22\.09-/g) || []).length === 17 && index.indexOf('?v=22.09-' + (m && m[1])) >= 0, 'все 17 script-тегов с новой версией');
ok(data.indexOf('{n:227, d:"2026-10-09"') >= 0, 'запись 227 в журнале изменений');

console.log('----------------------------------------');
console.log('TEST_227 TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
