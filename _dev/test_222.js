// Тест сборки 22.09-222:
//  Карточка работника в «Графиках смен» — не шире 200 пикселей;
//  длинные ФИО и должность обрезаются с троеточием, как было раньше
//  (полный текст — в подсказке при наведении).
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }
function cnt(sub) { return app.split(sub).length - 1; }

// сборка
ok(/var SP_BUILD = '22\.09-\d+';/.test(app), 'константа сборки (SP_BUILD) на месте');

// 1) ширина карточки — максимум 200 px
ok(app.indexOf("flex:0 0 auto;width:200px;max-width:200px;border:1px solid var(--line);border-bottom:4px solid") >= 0, 'карточка: ширина ровно 200 px, не больше');
ok(app.indexOf('min-width:200px;width:max-content') === -1, 'расширение карточки по ФИО убрано');

// 2) ФИО и должность — обрезка с троеточием, как раньше
ok(app.indexOf("white-space:nowrap;overflow:hidden;text-overflow:ellipsis\">' + esc(u.full_name) + '</b>'") >= 0, 'длинное ФИО обрезается с троеточием');
ok(app.indexOf("font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis\">' + esc(prof)") >= 0, 'должность обрезается с троеточием');

// 3) полный текст — в подсказке при наведении
ok(app.indexOf("<b title=\"' + esc(u.full_name) + '\"") >= 0, 'полное ФИО — в подсказке при наведении');
ok(app.indexOf("<span title=\"' + esc(prof) + (isMaster ? ' · мастер' : '')") >= 0, 'полная должность — в подсказке при наведении');

// 4) регрессия 221 на месте (окно «Изменить график» по списку бригад)
ok(app.indexOf("S.schEdMode = (S.screen === 'schedules' && S.schMode) ? String(S.schMode) : 'all';") >= 0, 'рендер окна редактора помнит выбранную бригаду (221)');
ok(cnt('S.schEd = null; S.schEdAll = null; S.schEdDay = null; S.schEdMode = null;') === 2, 'сброс режима окна (221)');

// 5) сборка/метки/журнал
const m = app.match(/var SP_BUILD = '22\.09-(\d+)';/);
ok(m && +m[1] >= 222, 'номер сборки поднят (' + (m && m[1]) + ')');
ok(index.indexOf('id="build-marker"') >= 0 && index.indexOf('Сборка 22.09-' + (m && m[1])) >= 0, 'метка сборки на экране входа');
ok((index.match(/\?v=22\.09-/g) || []).length === 17 && index.indexOf('?v=22.09-' + (m && m[1])) >= 0, 'все 17 script-тегов с новой версией');
ok(data.indexOf('{n:222, d:"2026-10-08"') >= 0, 'запись 222 в журнале изменений');

console.log('----------------------------------------');
console.log('TEST_222 TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
