// Тест сборки 22.09-215: дни каждого работника (мастер и слесарь) меняются
// ИНДИВИДУАЛЬНО — цикл 2/2 больше не наследуется от мастера бригады; при переходе
// workers_db на схему 2 каждому слесарю разово копируется цикл/история его мастера.
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const wdb = fs.readFileSync('/home/user/root_index/workers_db.js', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }

// workers_db: миграция схемы 1 → 2
ok(wdb.indexOf('var SCHEMA = 2;') >= 0, 'workers_db: SCHEMA = 2');
ok(wdb.indexOf('if (db.schema === 1 && db.workers)') >= 0, 'workers_db: блок миграции со схемы 1');
ok(wdb.indexOf('wk.cycle = ow.cycle || wk.cycle;') >= 0, 'workers_db: копия цикла мастера');
ok(wdb.indexOf('wk.cycleHist = (ow.cycleHist || []).map') >= 0, 'workers_db: копия истории сдвигов мастера');
ok(wdb.indexOf('цикл 2/2 больше') >= 0 && wdb.indexOf('ИНДИВИДУАЛЬНО') >= 0, 'workers_db: комментарий 22.09-215');

// app.js: ничего не читает цикл «через бригаду»
ok(app.indexOf('wd.brigade || uid') === -1, 'app.js: наследование цикла через бригаду убрано');
ok(app.indexOf('var cycleStr = wkCycleFrom(uid, dateStr);') >= 0, 'wkIsWorking: цикл самого работника');
ok(app.indexOf('var cycleStr = schEdEffCycle(uid, ds, true);') >= 0, 'schEdTplWork: цикл самого работника');
ok(app.indexOf("cur.cycleOwner = (wkData(uid).sched === '2/2')") >= 0, 'schEdCur: сдвиг разрешён по своему графику');
ok(app.indexOf('if (withDraft && S.schEdAll && S.schEdAll[uid]) extra = S.schEdAll[uid].shifts || [];') >= 0, 'schEdEffCycle: только свои черновые сдвиги');
ok(app.indexOf('SP_WORKERS.addCycleShift(uid, sh.from, sh.cycle)') >= 0, 'schEdSaveAll: сдвиг пишется самому работнику');
ok(app.indexOf('cur.ownerId') === -1, 'app.js: ownerId-логика сдвигов убрана');
ok(app.indexOf('его график едет следом') >= 0, 'легенда окна: у 2/2 едет ЕГО график');

console.log('----------------------------------------');
if (fail) { console.log('FAILURES: ' + fail); process.exit(1); }
console.log('ALL 215 TESTS PASSED (' + pass + ')');
