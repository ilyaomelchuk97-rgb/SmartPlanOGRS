// Тест сборки 22.09-234:
//  Карта маршрутов: «BRouter: failed to fetch» — расчёт маршрута теперь идёт
//  через наш сервер (/api/route/brouter), запасной путь — напрямую на brouter.de.
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
const srv = fs.readFileSync('/home/user/server/server.js', 'utf8');
const route = fs.readFileSync('/home/user/server/routes/route.js', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }

const m = app.match(/var SP_BUILD = '22\.09-(\d+)';/);
ok(m && +m[1] >= 234, 'номер сборки поднят (' + (m && m[1]) + ')');

// 1) клиент: прокси-первый вызов + запасной прямой
ok(app.indexOf("var viaProxy = '/api/route/brouter?' + qs;") >= 0, 'клиент: сперва — наш сервер (/api/route/brouter)');
ok(app.indexOf("var direct = 'https://brouter.de/brouter?' + qs;") >= 0, 'клиент: запасной прямой вызов brouter.de');
ok(app.indexOf('getJson(viaProxy, true, function (e1, res1) {') >= 0, 'клиент: прокси вызывается первым (с токеном)');
ok(app.indexOf('getJson(direct, false, function (e2, res2) {') >= 0, 'клиент: при сбое прокси — автоматический прямой вызов');
ok(app.indexOf("'Authorization': 'Bearer ' + SP_API.getToken()") >= 0, 'клиент: прокси зовётся с токеном входа');
ok(app.indexOf("cb({ ok: true, by: 'brouter-car-eco'") >= 0 && app.indexOf('trackLegMeters(geom, wps)') >= 0, 'клиент: разбор ответа (km/legs/пробки) не изменился');

// 2) сервер: прокси-роут
ok(srv.indexOf("const routeRoutes = require('./routes/route');") >= 0 && srv.indexOf("app.use('/api/route', requireAuth, routeRoutes());") >= 0, 'сервер: роут /api/route подключён с авторизацией');
ok(route.indexOf("router.get('/brouter'") >= 0 && route.indexOf('https://brouter.de/brouter?lonlats=') >= 0, 'сервер: GET-прокси к brouter.de');
ok(route.indexOf('ALLOWED_PROFILES') >= 0 && route.indexOf("'car-eco': 1") >= 0, 'сервер: белый список профилей');
ok(route.indexOf('MAX_POINTS = 60') >= 0 && route.indexOf('bad lonlats') >= 0, 'сервер: проверка координат (≤60 точек)');
ok(route.indexOf('TIMEOUT_MS = 25000') >= 0 && route.indexOf('brouter upstream:') >= 0, 'сервер: таймаут и внятные ошибки апстрима');

// 3) регрессии
ok(app.indexOf("dashboard: 'Панель мониторинга',") >= 0, '233: TITLES — простые заголовки');
ok(app.indexOf('SP_API.errorsGet(500, 0)') >= 0, '232: общий лог ошибок');
ok(app.indexOf('>⟲ Отмена последнего действия</button>') >= 0, '231: кнопка отмены');
ok(app.indexOf('function _ojSticky(t1, t2) {') >= 0, '230: объект = один день');
ok(app.indexOf('function openWorkBulkModal() {') >= 0, '229: групповое изменение работ');
ok(app.indexOf('АВТОР И ПРАВООБЛАДАТЕЛЬ: Омельчук Илья Анатольевич') >= 0, '228: скрытая метка авторства');
ok(data.indexOf('{n:228') < 0, '228: в журнале нет записи (скрытая сборка)');

// 4) метки и журнал
ok(index.indexOf('Сборка 22.09-' + (m && m[1])) >= 0, 'метка сборки на экране входа');
ok((index.match(/\?v=22\.09-/g) || []).length === 17 && index.indexOf('?v=22.09-' + (m && m[1])) >= 0, 'все 17 script-тегов с новой версией');
ok(data.indexOf('{n:234, d:"2026-10-09"') >= 0 && data.indexOf('{n:234') < data.indexOf('{n:233'), 'запись 234 в журнале изменений (выше 233)');

console.log('----------------------------------------');
console.log('TEST 234 TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
