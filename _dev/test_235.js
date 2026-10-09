// Тест сборки 22.09-235:
//  Просмотр сохранённой копии графика: окно поверх страницы, внутри — сам график
//  (та же таблица «объекты × месяцы» с треугольниками), а не перечень работ.
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }
function cnt(sub) { return app.split(sub).length - 1; }

const m = app.match(/var SP_BUILD = '22\.09-(\d+)';/);
ok(m && +m[1] >= 235, 'номер сборки поднят (' + (m && m[1]) + ')');

// 1) общий построитель таблицы графика
ok(cnt('function gwYearGridHtml(g, ro) {') === 1, 'общая функция таблицы графика (страница + окно копии)');
ok(cnt('gwYearGridHtml(g, false);') === 1, 'страница «График работ» строит таблицу через общую функцию');
ok(cnt('gwYearGridHtml(g, true)') === 1, 'окно копии строит ту же таблицу в режиме «только просмотр»');
ok(app.indexOf("(ro ? '' : ' data-action=\"graphs-obj-month\"") >= 0 && app.indexOf("(ro ? '' : ' data-action=\"graphs-month-view\"") >= 0, 'в режиме просмотра ячейки и месяцы не нажимаются');
ok(app.indexOf("'<div class=\"gw-scroll' + (ro ? ' gw-ro' : '') + '\"><div class=\"gw-grid\">'") >= 0, 'класс gw-ro для режима просмотра');
ok(index.indexOf('.gw-ro .gw-c,.gw-ro .gw-m{cursor:default}') >= 0 && index.indexOf('.gw-ro .gw-c:hover{background:var(--card)}') >= 0, 'css: в просмотре ячейки не выглядят «нажимаемыми»');

// 2) окно просмотра копии
ok(cnt('function openGraphSnapPreviewModal(sid) {') === 1, 'окно просмотра копии на месте');
ok(app.indexOf("' — копия графика от ' + esc(_snapDT(sn.ts))") >= 0, 'заголовок окна — «… — копия графика от …» (236: с номером итерации)');
ok(app.indexOf('<div class="gtb" style="justify-content:center"><div class="gt-mid">') >= 0, 'шапка как у графика (год, мастер, наименование)');
ok(app.indexOf("modal2.style.width = 'min(1500px,96vw)'; modal2.style.maxWidth = '96vw';") >= 0, 'широкое окно поверх страницы');
ok(cnt('function gwSnapLegendHtml(g) {') === 1 && app.indexOf('gwSnapLegendHtml(g);') >= 0, 'обозначения работ под таблицей');
ok(app.indexOf('>⤺ Применить эту копию</button>') >= 0, 'кнопка «Применить эту копию» в окне просмотра');
ok(app.indexOf('Объектов скрыто фильтром графика: ') >= 0, 'пометка о скрытых фильтром объектах');
ok(app.indexOf("' · вхождений: '") < 0, 'старый перечень работ («вхождений: N») убран');
ok(app.indexOf('title="Открыть эту копию в виде графика (только просмотр)">👁 Просмотр</button>') >= 0, 'подсказка кнопки «Просмотр» в списке копий');

// 3) ширина второго окна не «наследуется» другими окнами
ok(app.indexOf("var md2 = document.getElementById('modal2'); if (md2) { md2.style.width = ''; md2.style.maxWidth = ''; }") >= 0, 'при закрытии окна ширина возвращается по умолчанию');
ok(app.indexOf("modal2.style.width = ''; modal2.style.maxWidth = ''; // 22.09-235") >= 0, 'окно выбора совместных работ не наследует ширину');

// 4) регрессии
ok(app.indexOf("var viaProxy = '/api/route/brouter?' + qs;") >= 0, '234: маршрут через наш сервер');
ok(app.indexOf("dashboard: 'Панель мониторинга',") >= 0, '233: TITLES — простые заголовки');
ok(app.indexOf('SP_API.errorsGet(500, 0)') >= 0, '232: общий лог ошибок');
ok(app.indexOf('function graphSnapApply(sid) {') >= 0 && app.indexOf("rs = graphYearResync(restored, 'all')") >= 0, '230: применение копии выстраивает задания');
ok(app.indexOf('АВТОР И ПРАВООБЛАДАТЕЛЬ: Омельчук Илья Анатольевич') >= 0, '228: скрытая метка авторства');
ok(data.indexOf('{n:228') < 0, '228: в журнале нет записи (скрытая сборка)');

// 5) метки и журнал
ok(index.indexOf('Сборка 22.09-' + (m && m[1])) >= 0, 'метка сборки на экране входа');
ok((index.match(/\?v=22\.09-/g) || []).length === 17 && index.indexOf('?v=22.09-' + (m && m[1])) >= 0, 'все 17 script-тегов с новой версией');
ok(data.indexOf('{n:235, d:"2026-10-09"') >= 0 && data.indexOf('{n:235') < data.indexOf('{n:234'), 'запись 235 в журнале изменений (выше 234)');

console.log('----------------------------------------');
console.log('TEST 235 TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
