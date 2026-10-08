// Тест сборки 22.09-217:
//  1) карточка работника в «Графиках смен» — количество рабочих часов за выбранный месяц;
//  2) в «Графике за год» справа — колонка с рабочими часами за выбранный год;
//  3) в окне редактора убраны пустые столбики перед 1-м числом.
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }

// Карточка работника
ok(app.indexOf('var pW = 0, pO = 0, pA = 0, pH = 0;') >= 0, 'карточка: счётчик часов pH');
ok(app.indexOf('pH += schDayHours(u, ds);') >= 0, 'карточка: часы (год)');
ok(app.indexOf('pH += schDayHours(u, ds2);') >= 0, 'карточка: часы (месяц)');
ok(app.indexOf('Количество рабочих часов за') >= 0, 'карточка: подсказка про часы за период');
ok(app.indexOf('⏱ \' + fmtH3(pH) + \' ч') >= 0, 'карточка: вывод ⏱ X ч');

// Годовая таблица
ok(app.indexOf('⏱ часы<br>за год</th>') >= 0, 'годовая таблица: колонка «часы за год»');
ok(app.indexOf('var yH = 0; // 22.09-217: рабочие часы за год') >= 0, 'годовая таблица: счётчик yH');
ok(app.indexOf('{ mw++; yH += schDayHours(u, ds); }') >= 0, 'годовая таблица: сумма часов по рабочим дням');
ok(app.indexOf('⏱ \' + fmtH3(yH) + \' ч') >= 0, 'годовая таблица: вывод часов за год');

// Окно редактора: без пустых столбиков
ok(app.indexOf('22.09-217: пустые столбики «сдвига первой недели»') >= 0, 'комментарий про пустые столбики');
ok(app.indexOf("min-width:' + (nameColW + dim * colW + 2) + 'px") >= 0, 'ширина таблицы окна — без сдвига');
ok(app.indexOf('for (var li2 = 0; li2 < lead; li2++)') === -1, 'пустых столбиков шапки нет');
ok(app.indexOf('for (var li = 0; li < lead; li++) tds') === -1, 'пустых ячеек строк нет');

console.log('----------------------------------------');
if (fail) { console.log('FAILURES: ' + fail); process.exit(1); }
console.log('ALL 217 TESTS PASSED (' + pass + ')');
