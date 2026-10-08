// Тест сборки 22.09-221:
//  «✏ Изменить график» в «Графиках смен» учитывает список рядом с месяцем:
//  выбрана конкретная бригада — в окне только она; «Все бригады» — все;
//  над таблицей окна — плашка «Показана только бригада: …».
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }
function cnt(sub) { return app.split(sub).length - 1; }

// сборка
ok(/var SP_BUILD = '22\.09-\d+';/.test(app), 'константа сборки (SP_BUILD) на месте');

// 1) при открытии окна запоминается выбранный в списке режим
ok(app.indexOf("S.schEdMode = (S.screen === 'schedules' && S.schMode) ? String(S.schMode) : 'all';") >= 0, 'открытие окна берёт режим из списка рядом с месяцем');

// 2) фильтрация строк окна по режиму
ok(app.indexOf("var curEdMode = S.schEdMode || 'all';") >= 0, 'рендер окна читает запомненный режим');
ok(app.indexOf("if (curEdMode === 'free') {") >= 0 && app.indexOf("curEdMode.indexOf('b:') === 0") >= 0, 'ветки фильтра «без бригады» / «бригада мастера»');
ok(app.indexOf("edRows.filter(function (rw) { return rw.master && rw.master.id === _fMid; })") >= 0, 'фильтр: только выбранная бригада');

// 3) плашка над таблицей
ok(app.indexOf('👥 Показано: ') >= 0, 'плашка «Показано: бригада …» над таблицей');
ok(app.indexOf('Вернитесь на страницу и выберите «Все бригады», чтобы видеть всех') >= 0, 'у плашки — подсказка, как вернуть всех');

// 4) ширина колонки ФИО считается только по видимым строкам
ok(app.indexOf('var poolN = [];') >= 0 && app.indexOf('poolN = poolN.concat(rwN.members);') >= 0, 'ширина колонки ФИО — по видимым работникам');

// 5) режим сбрасывается и по «Сохранить», и по «Отмена»
ok(cnt('S.schEd = null; S.schEdAll = null; S.schEdDay = null; S.schEdMode = null;') === 2, 'режим окна сбрасывается в обоих выходах (2 места)');

// 6) подсказка кнопки на странице про новое поведение
ok(app.indexOf('Если слева в списке выбрана конкретная бригада — в окне будет только она') >= 0, 'у кнопки «✏ Изменить график» — подсказка про выбранную бригаду');

// 7) сборка/метки/журнал
const m = app.match(/var SP_BUILD = '22\.09-(\d+)';/);
ok(m && +m[1] >= 221, 'номер сборки поднят (' + (m && m[1]) + ')');
ok(index.indexOf('id="build-marker"') >= 0 && index.indexOf('Сборка 22.09-' + (m && m[1])) >= 0, 'метка сборки на экране входа');
ok((index.match(/\?v=22\.09-/g) || []).length === 17 && index.indexOf('?v=22.09-' + (m && m[1])) >= 0, 'все 17 script-тегов с новой версией');
ok(data.indexOf('{n:221, d:"2026-10-08"') >= 0, 'запись 221 в журнале изменений');

console.log('----------------------------------------');
console.log('TEST_221 TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
