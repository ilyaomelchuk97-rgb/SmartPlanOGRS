// Тест сборки 22.09-237:
//  «Групповое изменение работ» — параметры согласно выбранного участка: ГРП — атрибуты ГРП,
//  УБиРОГС — атрибуты УБиРОГС (как в карточке вида работ), у прочих — только структура.
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }
function cnt(sub) { return app.split(sub).length - 1; }

const m = app.match(/var SP_BUILD = '22\.09-(\d+)';/);
ok(m && +m[1] >= 237, 'номер сборки поднят (' + (m && m[1]) + ')');

// 1) описание полей по участкам — сверяем с карточкой вида работ (openWorkModal/saveWork)
ok(cnt('function wbulkFieldsFor(area) {') === 1 && cnt('function wbulkCtrlHtml(f) {') === 1, 'описание полей по участку и элементы ввода');
const i0 = app.indexOf('function wbulkFieldsFor(area) {');
const i1 = app.indexOf('function wbulkCtrlHtml(f) {');
const spec = app.slice(i0, i1);
const grpPart = spec.slice(spec.indexOf("if (area === 'ГРП') {"), spec.indexOf("if (area === 'УБиРОГС') return ["));
const ubPart = spec.slice(spec.indexOf("if (area === 'УБиРОГС') return ["));
// ГРП: ключи, которые сохраняет карточка ГРП (saveWork, блок «Атрибуты ГРП»)
['norm', 'unit', 'object_categories', 'departments', 'season', 'periodicity_value', 'periodicity_dev', 'periodicity_basis', 'operations', 'lines_count', 'telemetry_req', 'telemetry_type', 'diag_equipment', 'heating_req', 'crew_size', 'crew', 'indicators', 'print_forms', 'op_journal', 'passport_entry', 'scan_attach'].forEach(function (k) {
  ok(grpPart.indexOf("{ k: '" + k + "'") >= 0, 'ГРП: атрибут карточки ГРП «' + k + '»');
});
['needs_permit', 'depends_on_snow', 'min_temp', 'equipment', 'min_workers'].forEach(function (k) {
  ok(grpPart.indexOf("{ k: '" + k + "'") < 0, 'ГРП: нет атрибута УБиРОГС «' + k + '»');
});
// УБиРОГС: ключи карточки УБиРОГС
['needs_permit', 'depends_on_snow', 'min_temp', 'season', 'equipment', 'min_workers'].forEach(function (k) {
  ok(ubPart.indexOf("{ k: '" + k + "'") >= 0, 'УБиРОГС: атрибут карточки УБиРОГС «' + k + '»');
});
['norm', 'object_categories', 'periodicity_value', 'crew_size', 'telemetry_req'].forEach(function (k) {
  ok(ubPart.indexOf("{ k: '" + k + "'") < 0, 'УБиРОГС: нет атрибута ГРП «' + k + '»');
});
ok(ubPart.indexOf("'Весна-осень'") >= 0 && grpPart.indexOf("'Весна-осень'") < 0, 'сезоны — как в карточках (у УБиРОГС есть «Весна-осень», у ГРП — нет)');
ok(spec.indexOf("['service_life_end', 'Дата окончания срока службы оборудования']") >= 0, 'ГРП: реквизит отсчёта — все 3 варианта карточки');
ok(spec.indexOf("    ];\n    return [];\n  }") >= 0, 'прочие участки — без собственных атрибутов');

// 2) окно
ok(app.indexOf('var fields = wbulkFieldsFor(area); // 22.09-237') >= 0, 'окно строится по атрибутам участка');
ok(app.indexOf("var hasJoint = isGrp; // «Проводится совместно» — атрибут карточки ГРП") >= 0, 'связи «Проводится совместно» — только у ГРП');
ok(app.indexOf("fldRow('wb-on-sub', 'Подгруппа") >= 0, 'структура: добавлена подгруппа');
ok(app.indexOf("(isGrp ? '📋 Атрибуты ГРП' : '⚙️ Атрибуты ' + esc(area))") >= 0, 'заголовок блока — по участку');
ok(app.indexOf('в карточке вида работ нет собственных атрибутов') >= 0, 'пояснение для участков без атрибутов');
ok(app.indexOf("initCrewEditor(null, 0); // состав бригады") >= 0, 'состав бригады — тот же редактор, что в карточке ГРП');
ok(app.indexOf('<option value="add">добавить к имеющимся</option>') >= 0 && app.indexOf('<option value="remove">убрать указанные</option>') >= 0, 'списки: заменить / добавить / убрать');

// 3) применение
ok(app.indexOf('var fields = wbulkFieldsFor(area);\n    var set = {}, ops = [], errs = [], fieldsLog = [], crewSkipped = 0;') >= 0, 'применяются только атрибуты текущего участка');
ok(app.indexOf("var doJoint = hasJoint && (jointMode === 'replace' || jointMode === 'add') && on('wb-on-joint');") >= 0, 'связи применяются только у ГРП');
ok(app.indexOf("у всех выбранных работ будут ОЧИЩЕНЫ: ") >= 0, 'очистка списков пустым «заменить» — с подтверждением');
ok(app.indexOf("if (doSub) subs = newSub; // пусто — без подгруппы") >= 0, 'подгруппа применяется');
ok(app.indexOf('function on(id) { var el = document.getElementById(id); return !!(el && el.checked === true); }') >= 0, 'строгая проверка галочек (без ложных срабатываний)');

// 4) регрессии
ok(app.indexOf('function snapIterLabel(n) {') >= 0, '236: «Первая итерация»…');
ok(app.indexOf('function gwYearGridHtml(g, ro) {') >= 0, '235: просмотр копии в виде графика');
ok(app.indexOf("var viaProxy = '/api/route/brouter?' + qs;") >= 0, '234: маршрут через наш сервер');
ok(app.indexOf('function openWorkModal(mode, wid) {') >= 0 && app.indexOf("if (area === 'УБиРОГС') {") >= 0 && app.indexOf("if (area === 'ГРП') {") >= 0, 'карточка вида работ не тронута');
ok(app.indexOf('АВТОР И ПРАВООБЛАДАТЕЛЬ: Омельчук Илья Анатольевич') >= 0, '228: скрытая метка авторства');
ok(data.indexOf('{n:228') < 0, '228: в журнале нет записи (скрытая сборка)');

// 5) метки и журнал
ok(index.indexOf('Сборка 22.09-' + (m && m[1])) >= 0, 'метка сборки на экране входа');
ok((index.match(/\?v=22\.09-/g) || []).length === 17 && index.indexOf('?v=22.09-' + (m && m[1])) >= 0, 'все 17 script-тегов с новой версией');
ok(data.indexOf('{n:237, d:"2026-10-09"') >= 0 && data.indexOf('{n:237') < data.indexOf('{n:236'), 'запись 237 в журнале изменений (выше 236)');

console.log('----------------------------------------');
console.log('TEST 237 TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
