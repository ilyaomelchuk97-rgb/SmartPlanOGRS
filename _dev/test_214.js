// Тест сборки 22.09-214: шапка страницы показывает только описание ТЕКУЩЕЙ сборки —
// накопленная история «Ранее, …» больше не вытесняет кнопки шапки; полный текст —
// в подсказке при наведении на строку описания.
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }

ok(app.indexOf('22.09-214: в шапке — только описание ТЕКУЩЕЙ сборки') >= 0, 'комментарий сборки 22.09-214');
ok(app.indexOf("_cr.indexOf(' Ранее, ')") >= 0, 'обрезка цепочки «Ранее, …»');
ok(app.indexOf('_cr.slice(0, _cut)') >= 0, 'показывается только первая (текущая) запись');
ok(app.indexOf("_cr.slice(0, 200).replace(/\\s+\\S*$/, '') + '…'") >= 0, 'дополнительный потолок ~200 символов + …');
ok(app.indexOf('_crEl.title = ') >= 0, 'полный текст — в подсказке при наведении');
ok(app.indexOf('История изменений страницы:') >= 0, 'заголовок подсказки');
ok(app.indexOf("document.getElementById('screen-title').textContent = (TITLES[name] || ['', ''])[0];") >= 0, 'заголовок страницы (строка 1) без изменений');

console.log('----------------------------------------');
if (fail) { console.log('FAILURES: ' + fail); process.exit(1); }
console.log('ALL 214 TESTS PASSED (' + pass + ')');
