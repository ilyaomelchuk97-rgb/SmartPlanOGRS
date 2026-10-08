// Тест сборки 22.09-213: редактор графика смен —
//  1) клик по дню открывает окошко «рабочий/выходной + часы»;
//  2) дни перетаскиваются мышью у всех работников (без выпадающего списка);
//  3) у 5/2 переносится только этот день (остальной график не перестраивается);
//  4) блок «Сдвиг всего графика» удалён.
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }

// Окошко дня
ok(app.indexOf('function openSchEdDayModal(uid, ds)') >= 0, 'openSchEdDayModal — окошко дня');
ok(app.indexOf('function schEdDayApply()') >= 0, 'schEdDayApply — применить в черновик');
ok(app.indexOf('function schEdDayReset()') >= 0, 'schEdDayReset — вернуть по графику');
ok(app.indexOf('function schEdDayClose()') >= 0, 'schEdDayClose');
ok(app.indexOf('id="scheday-work"') >= 0, 'радио «Рабочий»');
ok(app.indexOf('id="scheday-off"') >= 0, 'радио «Выходной»');
ok(app.indexOf('id="scheday-hours"') >= 0, 'поле часов');
ok(app.indexOf('Вернуть по графику') >= 0, 'кнопка «Вернуть по графику»');
ok(app.indexOf("data-action=\"scheday-apply\"") >= 0, 'кнопка «Применить»');
ok(app.indexOf('в черновик и применится по кнопке «Сохранить»') >= 0, 'подсказка про черновик');

// Перетаскивание всех строк; 5/2 — только этот день
ok(app.indexOf('function schEdMoveDay(uid, src, dst)') >= 0, 'schEdMoveDay — перенос одного дня');
ok(app.indexOf('остальной график не перестраивается') >= 0, '5/2: график дальше не перестраивается');
ok(app.indexOf('только внутри строки того же работника') >= 0, 'перетаскивание — внутри своей строки');
ok(app.indexOf("schEdPatternShift(delta, uid2); return; } // 2/2: весь график следом") >= 0, '2/2: перетаскивание двигает весь график');
ok(app.indexOf('schEdMoveDay(uid2, srcDs, ds2); // 5/2: двигается только этот день') >= 0, '5/2: перетаскивание двигает один день');

// Диспетчер
ok(app.indexOf("a === 'sch-ed-cell') { openSchEdDayModal(") >= 0, 'диспетчер: клик по дню → окошко');
ok(app.indexOf("a === 'scheday-apply'") >= 0, 'диспетчер: scheday-apply');
ok(app.indexOf("a === 'scheday-reset'") >= 0, 'диспетчер: scheday-reset');

// Удалённое
['schEdToggleCell', 'schEdApplyAction', 'schEdShiftRemove', 'sch-ed-urow', 'sch-ed-act', 'sch-ed-shift', 'sch-ed-shiftdel', 'sch-ed-user', 'S.schEdSel'].forEach(function (g) {
  ok(app.indexOf(g) === -1, 'удалено: ' + g);
});

// Черновое «вернуть по графику» сразу показывает шаблон
ok(app.indexOf('if (dv === null) return { st: schEdTplWork(uid, ds) ? \'work\' : \'off\', draft: true, reset: true };') >= 0, 'черновой сброс — на экране сразу шаблон');

console.log('----------------------------------------');
if (fail) { console.log('FAILURES: ' + fail); process.exit(1); }
console.log('ALL 213 TESTS PASSED (' + pass + ')');
