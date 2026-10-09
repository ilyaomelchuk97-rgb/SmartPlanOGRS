// Тест сборки 22.09-231:
//  1) Кнопка отмены в планировании переименована в «⟲ Отмена последнего действия».
//  2) В панели мониторинга фон открытых карточек прогноза погоды — та же
//     анимация погоды с облачками, что над ними: облачков больше (26),
//     во весь блок и размыты по всему блоку (css blur).
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }
function cnt(sub) { return app.split(sub).length - 1; }

ok(/var SP_BUILD = '22\.09-\d+';/.test(app), 'константа сборки (SP_BUILD) на месте');

// 1) переименование кнопки
ok(cnt('>⟲ Отмена последнего действия</button>') === 1, 'кнопка переименована в «⟲ Отмена последнего действия»');
ok(cnt('>⟲ Отмена</button>') === 0, 'старой короткой подписи больше нет');
ok(app.indexOf('data-action="cal-undo"') >= 0 && app.indexOf("a === 'cal-undo'") >= 0, 'механика отмены (кнопка + Ctrl+Z) не тронута');

// 2) облачный фон прогноза
ok(cnt('function wxBlurCloudsHtml(count) {') === 1 && app.indexOf('<div class="wx-bgclouds">') >= 0, 'генератор размытых облачков для фона прогноза');
ok(app.indexOf("cAnim = i % 2 === 0 ? 'wxCloudRight' : 'wxCloudLeft'") >= 0, 'та же анимация облачков, что над карточками');
ok(app.indexOf('wxBlurCloudsHtml(26)') >= 0, 'облачков больше (26)');
ok(app.indexOf('dd.insertBefore(_cl.firstChild, dd.firstChild);') >= 0, 'слой облачков вставляется фоном в блок прогноза');
ok(app.indexOf('top:' + "' + cTop + '" + '%') >= 0 || app.indexOf("style=\"top:' + cTop + '%") >= 0, 'облачка распределены по всему блоку (top 0–100%)');
ok(index.indexOf('.wx-bgclouds{') >= 0 && index.indexOf('filter:blur(8px)') >= 0, 'css: размытие по всему блоку (blur 8px)');

// 3) регрессии
ok(app.indexOf('function _ojSticky(t1, t2) {') >= 0, '230: объект = один день при оптимизации');
ok(app.indexOf('function openWorkBulkModal() {') >= 0, '229: групповое изменение видов работ');
ok(app.indexOf('АВТОР И ПРАВООБЛАДАТЕЛЬ: Омельчук Илья Анатольевич') >= 0, '228: скрытая метка авторства');
ok(app.indexOf('function gwFindPlanTask(oid, wid, occIso) {') >= 0, '227: защита от дублей задач');

// 4) сборка/метки/журнал
const m = app.match(/var SP_BUILD = '22\.09-(\d+)';/);
ok(m && +m[1] >= 231, 'номер сборки поднят (' + (m && m[1]) + ')');
ok(index.indexOf('id="build-marker"') >= 0 && index.indexOf('Сборка 22.09-' + (m && m[1])) >= 0, 'метка сборки на экране входа');
ok((index.match(/\?v=22\.09-/g) || []).length === 17 && index.indexOf('?v=22.09-' + (m && m[1])) >= 0, 'все 17 script-тегов с новой версией');
ok(data.indexOf('{n:231, d:"2026-10-09"') >= 0, 'запись 231 в журнале изменений');

console.log('----------------------------------------');
console.log('TEST_231 TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
