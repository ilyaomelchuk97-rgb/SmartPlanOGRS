// Тест сборки 22.09-212: окно редактора графика смен выглядит как общая таблица
// «Графики смен» (шапка с числами месяца, колонка ФИО, цветные квадратики),
// в каждом рабочем квадратике написаны часы.
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }

// 1) Новая таблица в окне
ok(app.indexOf('22.09-212: сетка окна = та же таблица') >= 0, 'комментарий сборки 22.09-212');
ok(app.indexOf('var colW = 26;') >= 0, 'квадратики окна — 26px (под часы)');
ok(app.indexOf('function schEdTd(xu, isSelRow, dd)') >= 0, 'schEdTd — ячейка дня окна');
ok(app.indexOf('function schEdTr(xu, isMaster)') >= 0, 'schEdTr — строка работника окна');
ok(app.indexOf('Бригада / работник</th>') >= 0, 'шапка таблицы окна — «Бригада / работник»');
ok(app.indexOf('font-size:8.5px;font-weight:800;color:#14532d') >= 0, 'часы внутри квадратика');
ok(app.indexOf('schDayHours(xu, ds)') >= 0, 'часы других строк — по их графику');
ok(app.indexOf('schEdDefHours(uid, ds, xu)') >= 0, 'часы редактируемой строки — с учётом черновика');
ok(app.indexOf(' data-sch-day="\' + ds + \'"') >= 0, 'ячейки редактируемой строки несут data-sch-day (клик/перетаскивание)');

// 2) Переключение работника по клику на ФИО
ok(app.indexOf("isSelRow ? '' : 'sch-ed-urow'") >= 0, 'клик по ФИО — действие sch-ed-urow');
ok(app.indexOf("a === 'sch-ed-urow'") >= 0, 'диспетчер: sch-ed-urow');
ok(app.indexOf('· редактируется</span>') >= 0, 'пометка «редактируется» в строке');

// 3) Старая недельная сетка убрана
ok(app.indexOf('width:46px;height:40px') === -1, 'старых квадратиков 46px нет');
ok(app.indexOf("var DOWS = ['Пн'") === -1, 'шапки Пн..Вс в окне нет');
ok(app.indexOf("modal.style.width = 'min(1180px,96vw)'") >= 0, 'ширина окна под таблицу (1180px)');

// 4) Остальное поведение окна сохранено
ok(app.indexOf('💾 Сохранить') >= 0, 'кнопка «Сохранить» на месте');
ok(app.indexOf('🔁 Сдвиг всего графика (2/2)') >= 0, 'блок сдвига графика 2/2 на месте');

console.log('----------------------------------------');
if (fail) { console.log('FAILURES: ' + fail); process.exit(1); }
console.log('ALL 212 TESTS PASSED (' + pass + ')');
