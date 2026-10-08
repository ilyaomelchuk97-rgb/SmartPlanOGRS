'use strict';
/* 22.09-209 статические якоря (планирование от окончания срока службы) */
var fs = require('fs');
var app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
var oa = fs.readFileSync('/home/user/root_index/object_attrs.js', 'utf8');
var wdb = fs.readFileSync('/home/user/root_index/work_db.js', 'utf8');
var fail = 0;
function ok(cond, name) { if (cond) { console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }

ok(oa.indexOf("key: 'serviceLifeEnd'") >= 0 && oa.indexOf('Дата окончания срока службы') >= 0, 'атрибуты объекта: поле «Дата окончания срока службы»');
ok(app.indexOf('function gprFirstFromServiceLife(attrs)') >= 0, 'помощник gprFirstFromServiceLife');
ok(app.indexOf('АБСОЛЮТНАЯ дата') >= 0, 'дата — абсолютная (разово к дате)');
ok(app.indexOf("w.periodicity_basis === 'service_life_end') ? gprFirstFromServiceLife(attrs)") >= 0, 'автоподбор: якорь от срока службы');
ok(app.indexOf('<option value="service_life_end"') >= 0 && app.indexOf('Дата окончания срока службы оборудования</option>') >= 0, 'карточка вида работ: третий вариант отсчёта');
ok(wdb.indexOf("'service_life_end'") >= 2, 'work_db: значение сохраняется');
ok(app.indexOf("if (_bs === 'service_life_end') return st;") >= 0, 'будущий якорь — тихо, не ошибка');
ok(app.indexOf('22.09-209') >= 4, 'пометки 22.09-209');
console.log(fail ? ('FAILED: ' + fail) : 'ALL 209 TESTS PASSED');
process.exit(fail ? 1 : 0);
