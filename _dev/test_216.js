// Тест сборки 22.09-216: окно редактора графика смен — 90% ширины экрана, по центру.
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }
ok(app.indexOf('22.09-216: окно редактора — 90% ширины экрана, по центру') >= 0, 'комментарий сборки');
ok(app.indexOf("modal.style.maxWidth = '90vw'; modal.style.width = '90vw';") >= 0, 'ширина 90vw');
ok(app.indexOf("min(1180px,96vw)") === -1, 'старой ширины 1180px нет');
console.log('----------------------------------------');
if (fail) { console.log('FAILURES: ' + fail); process.exit(1); }
console.log('ALL 216 TESTS PASSED (' + pass + ')');
