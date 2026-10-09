// Тест сборки 22.09-228 (СКРЫТАЯ, без записи в «Журнале изменений»):
//  скрытая отметка об авторстве — сайт создан Омельчуком Ильёй
//  Анатольевичем, оператором ПЭВМ УП «МИНГАЗ»; все права защищены (© 2026).
//  Отметка: HTML-комментарий в коде страницы, meta-теги author/copyright,
//  шапки ключевых js-файлов, подпись в консоли разработчика (F12).
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const sw = fs.readFileSync('/home/user/root_index/sw.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }

const FIO = 'Омельчук Илья Анатольевич';
const FIO_GEN = 'Омельчуком Ильёй Анатольевичем';

// 1) index.html — скрытый комментарий в коде страницы (Ctrl+U)
ok(index.indexOf('АВТОР И ПРАВООБЛАДАТЕЛЬ: Омельчук Илья Анатольевич, оператор ПЭВМ') >= 0, 'index.html: комментарий с ФИО и должностью автора');
ok(index.indexOf('ВСЕ ПРАВА ЗАЩИЩЕНЫ') >= 0 && index.indexOf('© 2026 Омельчук И.А.') >= 0, 'index.html: знак охраны авторского права © 2026');
ok(index.indexOf('<meta name="author" content="' + FIO + ' — оператор ПЭВМ УП «МИНГАЗ»">') >= 0, 'index.html: meta author');
ok(index.indexOf('<meta name="copyright" content="© 2026 ' + FIO + ' (УП «МИНГАЗ»). Все права защищены">') >= 0, 'index.html: meta copyright');

// 2) js-файлы — шапки с авторством
ok(app.indexOf('АВТОР И ПРАВООБЛАДАТЕЛЬ: Омельчук Илья Анатольевич') >= 0, 'app.js: шапка с авторством');
ok(data.indexOf('АВТОР И ПРАВООБЛАДАТЕЛЬ: Омельчук Илья Анатольевич') >= 0, 'data.js: шапка с авторством');
ok(sw.indexOf('АВТОР И ПРАВООБЛАДАТЕЛЬ: Омельчук Илья Анатольевич') >= 0, 'sw.js: шапка с авторством');

// 3) подпись в консоли браузера (F12)
ok(app.indexOf('SmartPlan © 2026 ' + FIO + ' · оператор ПЭВМ УП «МИНГАЗ» · все права защищены') >= 0, 'подпись автора в консоли разработчика');
ok(app.indexOf('создан ' + FIO_GEN + ', оператором ПЭВМ УП «МИНГАЗ»') >= 0, 'пояснение к скрытой метке');

// 4) скрытость: в журнале изменений записи 228 НЕТ, метка сборки нейтральная
ok(data.indexOf('{n:228') === -1, 'в «Журнал изменений» запись НЕ добавлена (скрытая сборка)');
ok(index.indexOf('id="build-marker"') >= 0, 'метка сборки на экране входа на месте');
const mm = index.match(/Сборка 22\.09-228([^<]*)/);
ok(mm && mm[1].indexOf('Омельчук') === -1 && mm[1].indexOf('автор') === -1, 'метка сборки нейтральная (без упоминания авторства на экране)');

// 5) сборка/ссылки
const m = app.match(/var SP_BUILD = '22\.09-(\d+)';/);
ok(m && +m[1] >= 228, 'номер сборки поднят (' + (m && m[1]) + ')');
ok(index.indexOf('Сборка 22.09-' + (m && m[1])) >= 0, 'номер сборки виден в метке экрана входа');
ok((index.match(/\?v=22\.09-/g) || []).length === 17 && index.indexOf('?v=22.09-' + (m && m[1])) >= 0, 'все 17 script-тегов с новой версией');

// 6) регрессии
ok(app.indexOf('function gwFindPlanTask(oid, wid, occIso) {') >= 0, '227: защита от дублей задач');
ok(app.indexOf('function graphSnapSave(g, via) {') >= 0, '226: копии графика');
ok(app.indexOf('function planUndoApply() {') >= 0, '225: отмена действий');

console.log('----------------------------------------');
console.log('TEST_228 TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
