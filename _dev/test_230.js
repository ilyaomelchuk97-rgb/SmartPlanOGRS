// Тест сборки 22.09-230:
//  1) Восстановление графика из копии: задания в планировании выстраиваются
//     обратно согласно графику (невыполненные пересоздаются по датам копии,
//     выполненные остаются в истории, дубли не создаются; отмена — «⟲ Отмена»).
//  2) «Оптимизировать работы»: все задачи ОДНОГО объекта — в один день
//     (объект посещается один раз за день), как и совместные 🤝 блоки.
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }
function cnt(sub) { return app.split(sub).length - 1; }

ok(/var SP_BUILD = '22\.09-\d+';/.test(app), 'константа сборки (SP_BUILD) на месте');

// 1) восстановление графика выстраивает задания
ok(app.indexOf("planUndoPush('♻ восстановление графика «'") >= 0, 'перед восстановлением — снимок для «⟲ Отмена»');
ok(app.indexOf("rs = graphYearResync(restored, 'all')") >= 0, 'серии восстановленного графика пересчитываются (задания выстраиваются по датам копии)');
ok(app.indexOf('📅 Задания в планировании выстроены по графику: создано ') >= 0, 'тост — сколько заданий создано/убрано/сохранено');
ok(app.indexOf('уже существовали (без дублей)') >= 0, 'дубли при восстановлении не создаются (22.09-227)');
ok(app.indexOf('задания в планировании при этом выстраиваются заново по датам восстановленного графика') >= 0, 'подсказка в окне «Копии» — о выстраивании заданий');
ok(app.indexOf('Задания в планировании не пересоздаются') === -1, 'старое «задания не пересоздаются» убрано из подтверждения');
ok(app.indexOf("if (S.screen === 'calendar') { try { refresh(); } catch (eC) {} }") >= 0, 'календарь обновляется после восстановления');

// 2) оптимизатор: один объект = один день
ok(cnt('function _ojSticky(t1, t2) {') === 1 && app.indexOf("o1 !== '' && o1 === o2") >= 0, 'блокировка задач одного объекта в единый блок');
ok(app.indexOf('u.isObj = !u.isJoint && u.tasks.length > 1;') >= 0, 'флаг блока одного объекта (без 🤝)');
ok(app.indexOf('var ra = a.isJoint ? 0 : (a.isObj ? 1 : 2)') >= 0, 'блоки объекта — после совместных 🤝, раньше одиночных');
ok(app.indexOf('if (!u.isJoint && !u.isObj && curLoad > 0 && curLoad + h > masterCapacity(m.id, d)) continue;') >= 0, 'в один день даже если часов не хватает (как совместные)');
ok(app.indexOf('Все задачи одного объекта — тоже в один день (объект посещается один раз за день)') >= 0, 'тост оптимизации сообщает про единый день объекта');
ok(cnt('_ojSticky(t, us[uj])') === 1 && cnt('_ojSticky(ojUnits[ma].tasks[ci], ojUnits[mb].tasks[cj])') === 1, 'объединение блоков идёт и по объекту');

// 3) регрессии
ok(app.indexOf('function openWorkBulkModal() {') >= 0, '229: групповое изменение видов работ');
ok(app.indexOf('АВТОР И ПРАВООБЛАДАТЕЛЬ: Омельчук Илья Анатольевич') >= 0, '228: скрытая метка авторства');
ok(app.indexOf('function gwFindPlanTask(oid, wid, occIso) {') >= 0, '227: защита от дублей задач');
ok(app.indexOf('function planUndoApply() {') >= 0, '225: отмена действий');

// 4) сборка/метки/журнал
const m = app.match(/var SP_BUILD = '22\.09-(\d+)';/);
ok(m && +m[1] >= 230, 'номер сборки поднят (' + (m && m[1]) + ')');
ok(index.indexOf('id="build-marker"') >= 0 && index.indexOf('Сборка 22.09-' + (m && m[1])) >= 0, 'метка сборки на экране входа');
ok((index.match(/\?v=22\.09-/g) || []).length === 17 && index.indexOf('?v=22.09-' + (m && m[1])) >= 0, 'все 17 script-тегов с новой версией');
ok(data.indexOf('{n:230, d:"2026-10-09"') >= 0, 'запись 230 в журнале изменений');

console.log('----------------------------------------');
console.log('TEST_230 TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
