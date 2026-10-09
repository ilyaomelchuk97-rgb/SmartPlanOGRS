// Тест сборки 22.09-223:
//  1) норма времени = суммарные человеко-часы всей бригады: загрузка дня =
//     норма × объём / число исполнителей из карточки вида работ; в карточках — общая норма;
//  2) «Оптимизировать работы»: совместные (🤝) работы — единым блоком и всегда
//     в один день, даже если часов мастеру не хватает; одиночные — как раньше.
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }
function cnt(sub) { return app.split(sub).length - 1; }

// сборка
ok(/var SP_BUILD = '22\.09-\d+';/.test(app), 'константа сборки (SP_BUILD) на месте');

// 1) хелперы числа исполнителей и длительности
ok(app.indexOf('function workCrewCount(w) {') >= 0, 'хелпер числа исполнителей по карточке вида работ');
ok(app.indexOf('function taskDurHours(t) {') >= 0, 'хелпер длительности задачи');
ok(app.indexOf('sum += (w.norm * vol) / workCrewCount(w);') >= 0 && app.indexOf('return (w.norm * vol0) / workCrewCount(w);') >= 0, 'длительность = норма × объём / исполнителей');
ok(app.indexOf('function taskHours(t) {') >= 0 && app.indexOf('sum += w.norm * vol;') >= 0, 'общая норма (taskHours) не тронута — в карточках как раньше');

// 2) загрузка дня — длительностью
ok(app.indexOf('sum += taskDurHours(t); }); // 22.09-223: загрузка = длительность') >= 0, 'loadForDay считает длительностями');
ok(app.indexOf('(isDone(t) ? 0 : taskDurHours(t))') >= 0, 'полоса дня в панели мониторинга — длительность');
ok(cnt('hours: taskDurHours(t)') >= 2, 'точки маршрутов — длительностью стоянки (' + cnt('hours: taskDurHours(t)') + ' шт)');
ok(app.indexOf('Math.round(taskDurHours(t) * 60)') >= 0, 'блоки ганта дня — по длительности');
ok(cnt('hours: taskHours(t)') === 0, 'старые taskHours из точек маршрутов убраны');

// 3) оптимизатор: совместные работы — единым блоком
ok(app.indexOf('СОВМЕСТНЫЕ работы одного объекта') >= 0 && app.indexOf('function _ojPair(t1, t2) {') >= 0, 'оптимизатор ищет совместные пары (как в графике — id или группа)');
ok(app.indexOf('u.isJoint = u.tasks.length > 1;') >= 0 && app.indexOf('a.isJoint ? -1 : 1') >= 0, 'совместные блоки собираются и обрабатываются первыми');
ok(app.indexOf('if (!u.isJoint && curLoad > 0 && curLoad + h > masterCapacity(m.id, d)) continue;') >= 0, 'проверка вместимости только для одиночных задач');
ok(app.indexOf('dayLoad[dOff] = (dayLoad[dOff] || 0) + taskDurHours(t);') >= 0, 'занятое время на дне — длительностями');
ok(app.indexOf('остаются в один день, даже если часов не хватает') >= 0, 'тост оптимизации сообщает про совместные работы');

// 4) регрессии на месте
ok(app.indexOf('S.schEdMode = (S.screen === \'schedules\' && S.schMode)') >= 0, '221: окно «Изменить график» по списку бригад');
ok(app.indexOf('width:200px;max-width:200px;') >= 0, '222: карточка работника — не шире 200 px');

// 5) сборка/метки/журнал
const m = app.match(/var SP_BUILD = '22\.09-(\d+)';/);
ok(m && +m[1] >= 223, 'номер сборки поднят (' + (m && m[1]) + ')');
ok(index.indexOf('id="build-marker"') >= 0 && index.indexOf('Сборка 22.09-' + (m && m[1])) >= 0, 'метка сборки на экране входа');
ok((index.match(/\?v=22\.09-/g) || []).length === 17 && index.indexOf('?v=22.09-' + (m && m[1])) >= 0, 'все 17 script-тегов с новой версией');
ok(data.indexOf('{n:223, d:"2026-10-08"') >= 0, 'запись 223 в журнале изменений');

console.log('----------------------------------------');
console.log('TEST_223 TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
