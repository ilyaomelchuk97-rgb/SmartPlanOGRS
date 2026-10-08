'use strict';
/* 22.09-208 статические якоря (надгруппы работ) */
var fs = require('fs');
var app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
var fail = 0;
function ok(cond, name) { if (cond) { console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }

ok(app.indexOf('id="wm-supergroup"') >= 0, 'карточка работы: поле «Надгруппа» есть');
ok(app.indexOf('(группа групп работ — необязательно)') >= 0, 'подпись поля надгруппы');
ok(app.indexOf('Без надгруппы') >= 0, 'placeholder надгруппы');
ok(app.indexOf('id="wm-sup-dl"') >= 0, 'datalist надгрупп');
ok(app.indexOf('if (grpSegs.length >= 3) { supVal = grpSegs[0]; grpVal = grpSegs[1];') >= 0, 'разбор пути на 3 уровня');
ok(app.indexOf("var sp = normGroupPath(val('wm-supergroup'));") >= 0, 'saveWork читает надгруппу');
ok(app.indexOf('if (sp) parts.push(sp);') >= 0 && app.indexOf("return parts.length ? parts.join(' / ') : 'Без группы';") >= 0, 'состав пути из 3 полей');
ok(app.indexOf('22.09-208: добавлена НАДГРУППА') >= 0, 'пометка 208 у карточки');
ok(app.indexOf('for (var i = 0; i < parts.length - 1; i++) {') >= 0, 'groupSuggest: подгруппы любого уровня');
ok(app.indexOf('var tSegs = normGroupPath(top).split(\' / \');') >= 0, 'subsFor по последнему сегменту');
console.log(fail ? ('FAILED: ' + fail) : 'ALL 208 TESTS PASSED');
process.exit(fail ? 1 : 0);
