// Тест шапки (механика 22.09-214 ЗАМЕНЕНА сборкой 22.09-219):
// 214 показывала в шапке описание текущей сборки с обрезкой «Ранее, …».
// С 219 в шапке — только номер сборки, а вся история — в «Журнале изменений».
// Здесь проверяем лишь, что старая обрезка 214 полностью убрана.
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }

ok(app.indexOf("_cr.indexOf(' Ранее, ')") === -1, 'обрезка цепочки «Ранее, …» убрана (214 → 219)');
ok(app.indexOf('_cr.slice(0, _cut)') === -1, 'срез первой записи 214 убран');
ok(app.indexOf("История изменений страницы:") === -1, 'старая подсказка 214 убрана');
ok(app.indexOf("_crEl.textContent = 'Сборка ' + SP_BUILD;") >= 0, 'теперь в шапке — номер сборки (219)');
ok(app.indexOf("document.getElementById('screen-title').textContent = (TITLES[name] || ['', ''])[0];") >= 0, 'заголовок страницы (строка 1) без изменений');

console.log('----------------------------------------');
if (fail) { console.log('FAILURES: ' + fail); process.exit(1); }
console.log('ALL 214→219 TESTS PASSED (' + pass + ')');
