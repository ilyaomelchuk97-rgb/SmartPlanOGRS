'use strict';
/* 22.09-210 статические якоря (дробная периодичность в графике работ) */
var fs = require('fs');
var app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
var fail = 0;
function ok(cond, name) { if (cond) { console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }

ok(app.indexOf("period: parseInt(pInp && pInp.value, 10) || 0,") === -1, 'старый parseInt периодичности убран');
ok(app.indexOf("var _perRaw = String(pInp && pInp.value != null ? pInp.value : '').trim().replace(',', '.');") >= 0, 'парсинг с запятой/точкой');
ok(app.indexOf('Math.round(_perV * 10) / 10') >= 0, 'один знак после запятой');
ok(app.indexOf('function gwNextISO(iso, period, dev)') >= 0 && app.indexOf('var frac = Math.round((per - whole) * 10) / 10;') >= 0, 'gwNextISO: дробная часть');
ok(app.indexOf('Math.round(frac * 30.4375)') >= 0, 'дробная часть — в дни');
ok(app.indexOf("0,5 мес ≈ 15 дней") >= 0, 'комментарий про 0,5 мес');
ok(app.indexOf('data-gpr-p=') >= 0 && app.indexOf('inputmode="decimal" placeholder="—"') >= 0, 'поле периодичности — текстовое decimal');
ok(app.indexOf('Периодичность, месяцев — целое или дробное с одним знаком (например 0,5)') >= 0, 'подсказка поля обновлена');
ok(app.indexOf("String(wrk.period).replace('.', ',')") >= 0, 'значение показывается с запятой');
ok(app.indexOf("'<br>Периодичность: ' + fmtH3(wrk.period) + ' мес'") >= 0, 'тултип показывает дробную периодичность');
console.log(fail ? ('FAILED: ' + fail) : 'ALL 210 TESTS PASSED');
process.exit(fail ? 1 : 0);
