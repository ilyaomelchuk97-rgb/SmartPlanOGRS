// Тест сборки 22.09-219:
//  1) карточка работника в «Графиках смен» — 200 px, длинное ФИО расширяет карточку;
//  2) фото-аватар: загрузка админом в карточке пользователя, показ в кружках везде;
//  3) из меню «Администрирование» убраны «Тест проезда» и «Тест зависимости»;
//  4) новый экран «Журнал изменений» (дата·сборка·описание, SP_CHANGELOG в data.js);
//  5) шапка — только номер сборки (история переехала в журнал).
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }

// 1) карточка 200 px
ok(app.indexOf('avaHtml(u, 34, 12.5)') >= 0, 'карточка: аватар на месте (ширину уточнила сборка 222 — см. test_222)');
ok(app.indexOf("flex:0 0 auto;width:168px;border:1px solid var(--line);border-bottom:4px solid ' + (u.color || '#94a3b8') + ';border-radius:12px") === -1, 'старая ширина 168 px у карточки графика убрана');
ok(true, 'обрезка ФИО: сборка 222 вернула троеточие (см. test_222)');

// 2) аватары
ok(app.indexOf('function avaHtml(u, d, fs, extra)') >= 0, 'хелпер кружка-аватара');
ok(app.indexOf("avaHtml(u, 34, 12.5)") >= 0, 'аватар в карточке «Графиков смен»');
ok(app.indexOf("avaHtml(u, 36, 13.5)") >= 0, 'аватар в карточке «Работников»');
ok(app.indexOf("avaHtml(u, 28, 10.5)") >= 0, 'аватар в таблице «Пользователей»');
ok(app.indexOf("_avEl.style.backgroundImage = 'url(' + u.avatar + ')'") >= 0, 'аватар в шапке справа вверху');
ok(app.indexOf('id="um-ava-file"') >= 0 && app.indexOf('um-ava-upload') >= 0 && app.indexOf('um-ava-remove') >= 0, 'блок загрузки фото в карточке пользователя');
ok(app.indexOf('function avaAttachFromFile(uid, file)') >= 0 && app.indexOf('cv.toDataURL') >= 0, 'фото уменьшается до 128×128 на клиенте');
ok(app.indexOf('function saveUserAvatar(uid, dataUrl)') >= 0 && app.indexOf("DB.updateUser(uid, { avatar: dataUrl || null })") >= 0, 'сохранение фото в учётку');
ok(app.indexOf("SP_API.upsert('users', su)") >= 0, 'фото уходит на сервер даже у стандартных пользователей');

// 3) меню без тестов, с журналом
ok(index.indexOf('data-screen="testmap"') === -1, 'меню: «Тест проезда» убран');
ok(index.indexOf('data-screen="testdep"') === -1, 'меню: «Тест зависимости» убран');
ok(index.indexOf('data-screen="changelog"') >= 0, 'меню: «Журнал изменений» добавлен');
ok(app.indexOf("else if (S.screen === 'testmap') renderTestMap();") >= 0 && app.indexOf("else if (S.screen === 'testdep') renderTestDep();") >= 0, 'страницы тестов в коде оставлены (сам полигон не ломался)');

// 4) журнал изменений
ok(app.indexOf("changelog: 'Журнал изменений',") >= 0, 'экран в TITLES');
ok(app.indexOf('function renderChangelog()') >= 0, 'рендер журнала');
ok(app.indexOf("else if (S.screen === 'changelog') renderChangelog();") >= 0, 'подключение рендера');
ok(app.indexOf("(name === 'users' || name === 'logs' || name === 'changelog')") >= 0, 'экран — только админу');
ok(data.indexOf('window.SP_CHANGELOG') >= 0, 'массив истории в data.js');
ok(data.indexOf('{n:219,') >= 0 && data.indexOf('{n:25,') >= 0, 'в журнале и старая 25-я, и новая 219-я');
ok((data.match(/\{n:\d+,/g) || []).length >= 140, 'старые записи перенесены (не меньше 140)');
ok(app.indexOf('НОВЫЕ СБОРКИ ДОПИСЫВАТЬ СЮДА') === -1 || data.indexOf('НОВЫЕ СБОРКИ ДОПИСЫВАТЬ СЮДА') >= 0, 'памятка «новые сборки — сюда»');

// 5) шапка
ok(/var SP_BUILD = '22\.09-\d+';/.test(app), 'константа текущей сборки (SP_BUILD) существует');
ok(app.indexOf("_crEl.textContent = 'Сборка ' + SP_BUILD;") >= 0, 'шапка показывает только номер сборки');
ok(app.indexOf('_cr.slice(0, _cut)') === -1, 'старая обрезка истории 214 убрана');
ok(app.indexOf('История изменений системы: Администрирование → Журнал изменений') >= 0, 'подсказка шапки ведёт в журнал');

// 6) метки версий (механизм: маркер с номером на входе, у скриптов — одна версия ?v=)
ok(index.indexOf('id="build-marker"') >= 0 && /Сборка 22\.09-\d+/.test(index), 'метка сборки на экране входа');
const _vs = (index.match(/\?v=22\.09-(\d+)"/g) || []);
ok(_vs.length === 17 && _vs.every(x => x === _vs[0]), 'все 17 скриптов с единой версией ?v=');

console.log('----------------------------------------');
if (fail) { console.log('FAILURES: ' + fail); process.exit(1); }
console.log('ALL 219 TESTS PASSED (' + pass + ')');
