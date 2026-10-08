'use strict';
/* 22.09-211 статические якоря (окно редактора графика смен) */
var fs = require('fs');
var app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
var wdb = fs.readFileSync('/home/user/root_index/workers_db.js', 'utf8');
var fail = 0;
function ok(cond, name) { if (cond) { console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }

// workers_db
ok(wdb.indexOf('function addCycleShift(uid, from, cycle)') >= 0, 'workers_db: addCycleShift');
ok(wdb.indexOf('function removeCycleShift(uid, from)') >= 0, 'workers_db: removeCycleShift');
ok(wdb.indexOf('addCycleShift: addCycleShift, removeCycleShift: removeCycleShift,') >= 0, 'workers_db: экспорты');
ok(wdb.indexOf('cycleHist: []') >= 0, 'workers_db: cycleHist в дефолтах');

// движок: цикл через историю сдвигов
ok(app.indexOf('function wkCycleFrom(uid, dateStr)') >= 0, 'wkCycleFrom — цикл на дату');
ok(app.indexOf('var cycleStr = wkCycleFrom(uid, dateStr);') >= 0, 'wkIsWorking: через cycleHist (своя запись, 215)');
ok(app.indexOf('wkCycleFrom(masterId, key(d))') >= 0, 'masterCapacity: через cycleHist');

// откат встроенного режима
ok(app.indexOf("if (canDay) act = 'sch-day-edit';") === -1, 'ячейка: встроенный режим убран');
ok(app.indexOf('data-action="sch-ed-open"') >= 0, 'кнопка открывает окно редактора');
ok(app.indexOf('✏ Изменение: вкл') === -1, 'старой подписи режима нет');

// окно редактора (22.09-213: сигнатуры обновлены — без выбора работника из списка)
ok(app.indexOf('function openSchEditorModal()') >= 0, 'openSchEditorModal (без uid — правим всех в таблице)');
ok(app.indexOf('function schEdRender()') >= 0, 'schEdRender');
ok(app.indexOf('function schEdPatternShift(dlt, uid)') >= 0, 'schEdPatternShift (сдвиг 2/2 перетаскиванием)');
ok(app.indexOf('function schEdSaveAll()') >= 0, 'schEdSaveAll');
ok(app.indexOf('💾 Сохранить') >= 0, 'кнопка «Сохранить» в окне');
ok(app.indexOf('весь график следом') >= 0, 'перетаскивание 2/2 — весь график следом');
ok(app.indexOf('// 2/2: весь график следом') >= 0, 'перетаскивание 2/2 = сдвиг графика (комментарий)');
ok(app.indexOf('Отработанные (прошедшие) дни не редактируются') >= 0, 'защита прошедших дней');
["a === 'sch-ed-cell'", "a === 'sch-ed-save'", "a === 'sch-ed-prev'", "a === 'sch-ed-next'"].forEach(function (a2, i) {
  ok(app.indexOf(a2) >= 0, 'диспетчер: ' + a2);
});
ok(app.indexOf('S.schEdAll = null;') >= 0, 'очистка черновика');
console.log(fail ? ('FAILED: ' + fail) : 'ALL 211 TESTS PASSED');
process.exit(fail ? 1 : 0);
