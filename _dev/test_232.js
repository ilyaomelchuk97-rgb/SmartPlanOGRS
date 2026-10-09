// Тест сборки 22.09-232:
//  Логи ошибок должны сохраняться в ОБЩИЙ список со всех устройств,
//  на которых происходят ошибки (сервер + отправка с клиента + показ
//  общего списка на странице «Логи ошибок»).
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
const api = fs.readFileSync('/home/user/root_index/api_client.js', 'utf8');
const elog = fs.readFileSync('/home/user/root_index/error_log.js', 'utf8');
const srv = fs.readFileSync('/home/user/server/server.js', 'utf8');
const route = fs.readFileSync('/home/user/server/routes/errors.js', 'utf8');
const init = fs.readFileSync('/home/user/server/migrations/init.js', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }
function one(s, sub) { return s.split(sub).length - 1 === 1; }

const m = app.match(/var SP_BUILD = '22\.09-(\d+)';/);
ok(m && +m[1] >= 232, 'номер сборки поднят (' + (m && m[1]) + ')');

// 1) Сервер: таблица и роут общего лога
ok(init.indexOf('CREATE TABLE IF NOT EXISTS error_log') >= 0, 'сервер: таблица error_log в схеме');
ok(init.indexOf('client_ts   BIGINT') >= 0 && init.indexOf('"where"     TEXT') >= 0, 'сервер: колонки времени клиента и «где» (экранировано)');
ok(init.indexOf('CREATE INDEX IF NOT EXISTS idx_error_log_ts') >= 0, 'сервер: индекс по времени');
ok(srv.indexOf("const errorsRoutes = require('./routes/errors');") >= 0 && srv.indexOf("app.use('/api/errors', requireAuth, errorsRoutes(pool));") >= 0, 'сервер: роут /api/errors подключён с авторизацией');
ok(route.indexOf("router.post('/'") >= 0 && route.indexOf('INSERT INTO error_log') >= 0, 'сервер: приём пачки записей (POST)');
ok(route.indexOf("router.get('/'") >= 0 && route.indexOf('ORDER BY id DESC') >= 0, 'сервер: выдача общего списка (GET, новые сверху)');
ok(route.indexOf("router.delete('/'") >= 0 && route.indexOf("только для администратора") >= 0, 'сервер: очистка — только admin');
ok(route.indexOf('OFFSET 5000') >= 0, 'сервер: авто-обрезка хвоста (максимум 5000 записей)');

// 2) Клиент: отправка записей в общий список
ok(api.indexOf('function errorsPush(entries)') >= 0 && api.indexOf("request('POST', '/errors'") >= 0, 'клиент: SP_API.errorsPush');
ok(api.indexOf('function errorsGet(limit, since)') >= 0 && api.indexOf("request('GET', '/errors'") >= 0, 'клиент: SP_API.errorsGet');
ok(api.indexOf('function errorsClear()') >= 0 && api.indexOf("request('DELETE', '/errors')") >= 0, 'клиент: SP_API.errorsClear');
ok(elog.indexOf("var LS_DEV_KEY = 'smartplan_error_device_id';") >= 0, 'клиент: уникальный код устройства');
ok(elog.indexOf('function deviceName()') >= 0 && elog.indexOf('function deviceId()') >= 0, 'клиент: короткое имя устройства (браузер/ОС)');
ok(elog.indexOf('synced: false') >= 0 && elog.indexOf('function push()') >= 0, 'клиент: новые записи помечаются к отправке и уходят push()');
ok(elog.indexOf('SP_API.errorsPush(batch)') >= 0, 'клиент: отправка пачкой на сервер');
ok(elog.indexOf("window.addEventListener('online'") >= 0 && elog.indexOf('PUSH_RETRY') >= 0, 'клиент: повтор при появлении сети и периодически');
ok(elog.indexOf('getToken && SP_API.getToken()') >= 0, 'клиент: без входа на сайт не шлём (уйдёт после входа)');

// 3) app.js: общий список на странице и сборка в записи
ok(app.indexOf('window.SP_BUILD = SP_BUILD') >= 0, 'app: сборка доступна логу ошибок (window.SP_BUILD)');
ok(app.indexOf('SP_API.errorsGet(500, 0)') >= 0, 'app: страница грузит ОБЩИЙ лог со всех устройств');
ok(app.indexOf('Загружаю общий лог ошибок со всех устройств') >= 0, 'app: состояние загрузки общего списка');
ok(app.indexOf('<th style="width:210px">Устройство</th>') >= 0, 'app: колонка «Устройство» в общем списке');
ok(app.indexOf("l.user_name || l.user_login || 'это устройство'") >= 0, 'app: видно пользователя устройства');
ok(app.indexOf('Очистить ОБЩИЙ лог ошибок на сервере? Он удалится у ВСЕХ устройств сразу.') >= 0, 'app: очистка общего списка (с предупреждением)');
ok(app.indexOf('SP_ERRORS.push();') >= 0, 'app: тестовая ошибка сразу уходит в общий список');

// 4) Регрессии прошлых сборок
ok(app.indexOf('>⟲ Отмена последнего действия</button>') >= 0, '231: кнопка отмены');
ok(app.indexOf('function wxBlurCloudsHtml(count) {') >= 0, '231: облачный фон прогноза');
ok(app.indexOf('function _ojSticky(t1, t2) {') >= 0, '230: объект = один день');
ok(app.indexOf('function openWorkBulkModal() {') >= 0, '229: групповое изменение работ');
ok(app.indexOf('АВТОР И ПРАВООБЛАДАТЕЛЬ: Омельчук Илья Анатольевич') >= 0, '228: скрытая метка авторства');
ok(data.indexOf('{n:228') < 0, '228: в журнале изменений НЕТ записи (скрытая сборка)');
ok(app.indexOf('function gwFindPlanTask(oid, wid, occIso) {') >= 0, '227: защита от дублей задач');

// 5) Метки сборки и журнал
ok(index.indexOf('Сборка 22.09-' + (m && m[1])) >= 0, 'метка сборки на экране входа');
ok((index.match(/\?v=22\.09-/g) || []).length === 17 && index.indexOf('?v=22.09-' + (m && m[1])) >= 0, 'все 17 script-тегов с новой версией');
ok(data.indexOf('{n:232, d:"2026-10-09"') >= 0, 'запись 232 в журнале изменений (до предыдущей старшей)');
ok(data.indexOf('{n:232') < data.indexOf('{n:231'), 'запись 232 стоит выше 231 (новые сверху)');

console.log('----------------------------------------');
console.log('TEST 232 TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
