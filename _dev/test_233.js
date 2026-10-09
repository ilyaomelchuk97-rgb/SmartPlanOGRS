// Тест сборки 22.09-233 — техническая чистка:
//  1) TITLES: убраны мёртвые длинные описания (второй элемент не использовался
//     с 22.09-219) — остались простые заголовки; шапка страницы не изменилась.
//  2) Сервер: удалён несмонтированный отладочный роут _debug_users.
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
const srv = fs.readFileSync('/home/user/server/server.js', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }

const m = app.match(/var SP_BUILD = '22\.09-(\d+)';/);
ok(m && +m[1] >= 233, 'номер сборки поднят (' + (m && m[1]) + ')');

// 1) TITLES
ok(app.indexOf("dashboard: 'Панель мониторинга',") >= 0, 'заголовок панели сохранён');
ok(app.indexOf("backup: 'Бэкапы баз данных'") >= 0, 'заголовок бэкапов сохранён');
ok(app.indexOf('(TITLES[name] || \'\')') >= 0, 'шапка берёт простой заголовок');
ok(app.indexOf("(TITLES[name] || ['', ''])[0]") < 0, 'старого обращения к элементу [0] нет');
ok(app.indexOf('Сборка 22.09-176 · исправлена загрузка 3D-планеты') < 0, 'мёртвые старые описания из TITLES вычищены');
ok(app.indexOf('Сборка 22.09-218 · в окне «✏ Изменить график»') < 0, 'длинные строки истории из TITLES вычищены');

// 2) сервер: отладочный роут удалён
ok(srv.indexOf('_debug_users') < 0, 'server.js: мёртвый require отладочного роута убран');
ok(!fs.existsSync('/home/user/server/routes/_debug_users.js'), 'файл _debug_users.js удалён');

// 3) регрессии
ok(app.indexOf('SP_API.errorsGet(500, 0)') >= 0 && app.indexOf('<th style="width:210px">Устройство</th>') >= 0, '232: общий лог ошибок со всех устройств');
ok(app.indexOf('>⟲ Отмена последнего действия</button>') >= 0, '231: кнопка отмены');
ok(app.indexOf('function wxBlurCloudsHtml(count) {') >= 0, '231: облачный фон прогноза');
ok(app.indexOf('function _ojSticky(t1, t2) {') >= 0, '230: объект = один день');
ok(app.indexOf('function openWorkBulkModal() {') >= 0, '229: групповое изменение работ');
ok(app.indexOf('АВТОР И ПРАВООБЛАДАТЕЛЬ: Омельчук Илья Анатольевич') >= 0, '228: скрытая метка авторства');
ok(data.indexOf('{n:228') < 0, '228: в журнале нет записи (скрытая сборка)');
ok(app.indexOf('function gwFindPlanTask(oid, wid, occIso) {') >= 0, '227: защита от дублей задач');

// 4) метки и журнал
ok(index.indexOf('Сборка 22.09-' + (m && m[1])) >= 0, 'метка сборки на экране входа');
ok((index.match(/\?v=22\.09-/g) || []).length === 17 && index.indexOf('?v=22.09-' + (m && m[1])) >= 0, 'все 17 script-тегов с новой версией');
ok(data.indexOf('{n:233, d:"2026-10-09"') >= 0 && data.indexOf('{n:233') < data.indexOf('{n:232'), 'запись 233 в журнале изменений (выше 232)');

console.log('----------------------------------------');
console.log('TEST 233 TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
