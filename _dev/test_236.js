// Тест сборки 22.09-236:
//  Копии графика подписаны по порядку сохранения: самая первая — «Первая итерация»,
//  дальше «Вторая итерация» и так далее. Номер закрепляется за копией и не сдвигается.
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }
function cnt(sub) { return app.split(sub).length - 1; }

const m = app.match(/var SP_BUILD = '22\.09-(\d+)';/);
ok(m && +m[1] >= 236, 'номер сборки поднят (' + (m && m[1]) + ')');

// 1) порядковая подпись — проверяем саму функцию
const i0 = app.indexOf('  function snapIterLabel(n) {');
const i1 = app.indexOf('  /* 22.09-236: наибольший номер итерации');
ok(i0 > 0 && i1 > i0, 'функция подписи итерации на месте');
let snapIterLabel = null;
try { eval(app.slice(i0, i1).replace('function snapIterLabel', 'snapIterLabel = function')); } catch (e) { console.log(e); }
const cases = { 1: 'Первая итерация', 2: 'Вторая итерация', 3: 'Третья итерация', 4: 'Четвёртая итерация', 10: 'Десятая итерация', 11: 'Одиннадцатая итерация', 20: 'Двадцатая итерация', 21: 'Двадцать первая итерация', 40: 'Сороковая итерация', 99: 'Девяносто девятая итерация', 100: 'Сотая итерация', 101: 'Сто первая итерация', 123: 'Сто двадцать третья итерация', 200: 'Двухсотая итерация', 1000: '1000-я итерация' };
Object.keys(cases).forEach(function (n) {
  ok(snapIterLabel && snapIterLabel(+n) === cases[n], n + ' → «' + cases[n] + '»' + (snapIterLabel ? ' (есть: «' + snapIterLabel(+n) + '»)' : ''));
});

// 2) номер копии
ok(app.indexOf('iter: graphSnapsMaxIter(arr) + 1,') >= 0, 'новая копия получает следующий номер (по наибольшему)');
ok(cnt('function graphSnapsMaxIter(arr) {') === 1 && cnt('function graphSnapsNumber(arr) {') === 1, 'помощники нумерации на месте');
ok(app.indexOf('.sort(function (x, y) { return (+x.ts || 0) - (+y.ts || 0); })') >= 0, 'старые копии нумеруются по времени сохранения');
ok(app.indexOf('if (a.some(function (sn) { return sn && !(+sn.iter > 0); })) {') >= 0, 'нумерация старых копий — один раз при загрузке, с сохранением');

// 3) подписи в интерфейсе
ok(app.indexOf("esc(snapIterLabel(sn.iter)) + ' <span style=\"font-weight:600;color:var(--muted)\">· ' + esc(_snapDT(sn.ts))") >= 0, 'список копий: «N-я итерация · дата»');
ok(app.indexOf('Копии подписаны по порядку сохранения: самая первая — «Первая итерация»') >= 0, 'подсказка в окне копий');
ok(app.indexOf("<h3>👁 ' + esc(snapIterLabel(sn.iter)) + ' — копия графика от '") >= 0, 'заголовок окна просмотра с номером итерации');
ok(app.indexOf("window.confirm('Применить копию «' + snapIterLabel(sn.iter) + '» от '") >= 0, 'подтверждение применения с номером итерации');
ok(app.indexOf("'» восстановлен из копии «' + snapIterLabel(sn.iter) + '».'") >= 0, 'сообщение после применения с номером итерации');
ok(app.indexOf("g.name + ' · ' + snapIterLabel(sn.iter) + ' · копия от '") >= 0, 'журнал действий с номером итерации');

// 4) регрессии
ok(app.indexOf('function gwYearGridHtml(g, ro) {') >= 0, '235: просмотр копии в виде графика');
ok(app.indexOf("var viaProxy = '/api/route/brouter?' + qs;") >= 0, '234: маршрут через наш сервер');
ok(app.indexOf('SP_API.errorsGet(500, 0)') >= 0, '232: общий лог ошибок');
ok(app.indexOf("rs = graphYearResync(restored, 'all')") >= 0, '230: применение копии выстраивает задания');
ok(app.indexOf('АВТОР И ПРАВООБЛАДАТЕЛЬ: Омельчук Илья Анатольевич') >= 0, '228: скрытая метка авторства');
ok(data.indexOf('{n:228') < 0, '228: в журнале нет записи (скрытая сборка)');

// 5) метки и журнал
ok(index.indexOf('Сборка 22.09-' + (m && m[1])) >= 0, 'метка сборки на экране входа');
ok((index.match(/\?v=22\.09-/g) || []).length === 17 && index.indexOf('?v=22.09-' + (m && m[1])) >= 0, 'все 17 script-тегов с новой версией');
ok(data.indexOf('{n:236, d:"2026-10-09"') >= 0 && data.indexOf('{n:236') < data.indexOf('{n:235'), 'запись 236 в журнале изменений (выше 235)');

console.log('----------------------------------------');
console.log('TEST 236 TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
