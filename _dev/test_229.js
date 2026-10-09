// Тест сборки 22.09-229:
//  Справочник «Виды работ» — групповое изменение: галочки у работ + ☑ у
//  группы (все работы с подгруппами), панель «Изменить выбранные», окно с
//  применением отмеченных атрибутов ко всем выбранным (надгруппа/группа,
//  сезон, мин. температура, норма, единица, исполнители, численность,
//  техника) + связи «Проводится совместно» кнопками «Заменить»/«Добавить».
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }
function cnt(sub) { return app.split(sub).length - 1; }

// 1) выбор работ
ok(/var SP_BUILD = '22\.09-\d+';/.test(app), 'константа сборки (SP_BUILD) на месте');
ok(cnt('data-action="wsel-toggle"') === 1, 'галочка у каждой работы в дереве');
ok(cnt('data-action="grp-selall"') === 1, 'кнопка ☑ у группы (все работы с подгруппами)');
ok(app.indexOf("g.indexOf(path + ' / ') === 0") >= 0, '☑ группы захватывает и подгруппы');
ok(cnt('function grpSelAll(path) {') === 1 && app.indexOf('var allOn = true;') >= 0, 'повторное нажатие ☑ снимает отметку группы');
ok(cnt('function wselBarHtml() {') === 1 && app.indexOf('id="wsel-bar"') >= 0 && app.indexOf('✏ Изменить выбранные') >= 0, 'панель «Выбрано работ… Изменить выбранные» внизу экрана');
ok(app.indexOf("S.workArea = e.target.value; S.wsel = {}; renderRefs();") >= 0, 'смена участка сбрасывает галочки');
ok(app.indexOf("☑ Групповое изменение</button>") >= 0, 'кнопка «☑ Групповое изменение» в шапке вкладки');

// 2) окно групповой правки
ok(cnt('function openWorkBulkModal() {') === 1 && app.indexOf('☑ Групповое изменение работ · ') >= 0, 'окно групповой правки с числом выбранных');
['wb-on-super', 'wb-on-group'].forEach(function (id) {
  ok(app.indexOf("fldRow('" + id + "',") >= 0, 'атрибут с галочкой применения: ' + id);
});
// 237: атрибуты — из описания полей участка (как в карточке), галочка у каждого
ok(app.indexOf("fldRow('wb-on-' + f.k,") >= 0, 'атрибуты участка — с галочкой применения (237)');
['season', 'min_temp', 'norm', 'unit', 'min_workers', 'crew_size', 'equipment'].forEach(function (k) {
  ok(app.indexOf("{ k: '" + k + "'") >= 0, 'атрибут в описании полей (237): ' + k);
});
ok(app.indexOf('id="wb-on-joint"') >= 0, 'атрибут с галочкой применения: wb-on-joint');
ok(app.indexOf('data-action="wbulk-jt"') >= 0 && app.indexOf('S.wmBulkJoint') >= 0, 'выбор связанных групп работ в окне');
ok(cnt('data-action="wbulk-j-replace"') === 1 && cnt('data-action="wbulk-j-add"') === 1, 'кнопки «🤝 Заменить связи» и «🤝 Добавить связи»');
ok(app.indexOf('будут ОЧИЩЕНЫ у всех выбранных работ') >= 0, 'очистка связей пустым выбором — с подтверждением');

// 3) применение
ok(cnt('function workBulkApply(jointMode) {') === 1, 'функция применения групповой правки');
ok(app.indexOf("jointMode === 'add' ? ex.slice() : []") >= 0 || app.indexOf("(jointMode === 'add') ? ex.slice() : []") >= 0, '«Добавить» — к имеющимся; «Заменить» — заново');
ok(app.indexOf("g !== id && merged.indexOf(g) === -1") >= 0, 'связи без дублей и без самоссылки');
ok(app.indexOf("if (set.crew_size != null && set.crew_size > 0) { patch.min_workers = set.crew_size; patch.opt_workers = set.crew_size; }") >= 0, 'численность бригады — как в карточке (главнее мин/опт)');
ok(app.indexOf('WORK.groupFlagsOf(area, patch.group') >= 0, 'переезд в другую группу обновляет пометки группы (наследование)');
ok(app.indexOf("logAction('Групповое изменение работ'") >= 0, 'действие пишется в журнал');
ok(app.indexOf("if (doGroup && !newGroup)") >= 0 && app.indexOf("if (!grp) { fails++; return; }") >= 0, 'группа не может стать пустой — защита');
ok(cnt("a === 'grp-selall'") >= 1 && cnt("a === 'wsel-toggle'") >= 1 && cnt("a === 'wsel-open'") >= 1, 'действия подключены в диспетчер');

// 4) регрессии
ok(app.indexOf('function gwFindPlanTask(oid, wid, occIso) {') >= 0, '227: защита от дублей задач');
ok(app.indexOf('АВТОР И ПРАВООБЛАДАТЕЛЬ: Омельчук Илья Анатольевич') >= 0, '228: скрытая метка авторства');
ok(app.indexOf('function planUndoApply() {') >= 0, '225: отмена действий');

// 5) сборка/метки/журнал
const m = app.match(/var SP_BUILD = '22\.09-(\d+)';/);
ok(m && +m[1] >= 229, 'номер сборки поднят (' + (m && m[1]) + ')');
ok(index.indexOf('id="build-marker"') >= 0 && index.indexOf('Сборка 22.09-' + (m && m[1])) >= 0, 'метка сборки на экране входа');
ok((index.match(/\?v=22\.09-/g) || []).length === 17 && index.indexOf('?v=22.09-' + (m && m[1])) >= 0, 'все 17 script-тегов с новой версией');
ok(data.indexOf('{n:229, d:"2026-10-09"') >= 0, 'запись 229 в журнале изменений');
ok(data.indexOf('{n:228') === -1, 'скрытая сборка 228 по-прежнему без записи в журнале');

console.log('----------------------------------------');
console.log('TEST_229 TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
