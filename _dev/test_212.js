// Тест сборок 22.09-212/213: окно редактора графика смен выглядит как общая таблица
// «Графики смен» (шапка с числами месяца, колонка ФИО, цветные квадратики),
// в каждом рабочем квадратике написаны часы; правятся ВСЕ строки прямо в таблице.
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }

// 1) Таблица в окне (212)
ok(app.indexOf('22.09-212: сетка окна = та же таблица') >= 0, 'комментарий сборки 22.09-212');
ok(app.indexOf('var colW = 26;') >= 0, 'квадратики окна — 26px (под часы)');
ok(app.indexOf('function schEdTd(xu, dd)') >= 0, 'schEdTd — ячейка дня окна');
ok(app.indexOf('function schEdTr(xu, isMaster)') >= 0, 'schEdTr — строка работника окна');
ok(app.indexOf('Бригада / работник</th>') >= 0, 'шапка таблицы окна — «Бригада / работник»');
ok(app.indexOf('font-size:8.5px;font-weight:800;color:#14532d') >= 0, 'часы внутри квадратика');
ok(app.indexOf('schEdDefHours(xu.id, ds, xu)') >= 0, 'часы строки — по графику/черновику');
ok(app.indexOf("modal.style.width = 'min(1180px,96vw)'") >= 0, 'ширина окна под таблицу (1180px)');

// 2) Правка прямо в таблице (213)
ok(app.indexOf(' data-sch-drag="1"') >= 0, 'перетаскиваемые ячейки помечены data-sch-drag');
ok(app.indexOf('schEdCur(uid2)') >= 0, 'перетаскивание: черновик того работника, чью строку тянут');
ok(app.indexOf('sch-ed-urow') === -1, 'строки-«выбранной»/переключателя больше нет');
ok(app.indexOf('sch-ed-user') === -1, 'выпадающего списка работников нет');
ok(app.indexOf("Выбрано: ' + selN") === -1, 'панели «Выбрано: N» нет');
ok(app.indexOf('🔁 Сдвиг всего графика') === -1, 'блок «Сдвиг всего графика» удалён');

// 3) Поведение окна сохранено
ok(app.indexOf('💾 Сохранить') >= 0, 'кнопка «Сохранить» на месте');
ok(app.indexOf('grid.querySelectorAll(\'[data-sch-drag]\')') >= 0, 'перетаскивание навешано на ячейки таблицы');

console.log('----------------------------------------');
if (fail) { console.log('FAILURES: ' + fail); process.exit(1); }
console.log('ALL 212 TESTS PASSED (' + pass + ')');
