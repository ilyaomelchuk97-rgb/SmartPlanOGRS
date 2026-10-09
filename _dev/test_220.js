// Тест сборки 22.09-220:
//  1) «Факт работ по объектам» — окном из блока «Выполнено за месяц» (блок считает как раньше);
//  2) «Планирование»: «Добавить задачу» / «Оптимизировать работы» / «Корзина» — отдельной строкой (слева/центр/справа);
//  3) страница «Работники» — окном «Настройки бригад» из «Графиков смен» (функционал без изменений);
//  4) из меню убраны «Работники» и «Факт работ по объектам»; запись в журнал изменений.
const fs = require('fs');
const app = fs.readFileSync('/home/user/root_index/app.js', 'utf8');
const data = fs.readFileSync('/home/user/root_index/data.js', 'utf8');
const index = fs.readFileSync('/home/user/index.html', 'utf8');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('ok - ' + name); } else { fail++; console.log('FAIL - ' + name); } }
function cnt(sub) { return app.split(sub).length - 1; }

// сборка
ok(/var SP_BUILD = '22\.09-\d+';/.test(app), 'константа сборки (SP_BUILD) на месте');

// 1) факт работ — окно из дашборда
ok(app.indexOf("var view = S.factModal ? document.getElementById('modal') : document.getElementById('view'); if (!view) return;") >= 0, 'рендер факта работ умеет в окно');
ok(cnt('Факт работ по объектам</h3>') === 2, 'обе ветки факта (пустой/непустой месяц) обёрнуты окном');
ok(app.indexOf("openKpiPopup('Выполнено за месяц (") === -1 && app.indexOf("openKpiPopup('Выполнено за месяц', '#16a34a', null)") === -1, 'старый список месяца по клику убран');
ok(app.indexOf('function openFactMonthModal()') >= 0 && app.indexOf("openFactMonthModal();\n  }") >= 0, 'kpiMonth открывает окно «Факт работ по объектам»');
ok(app.indexOf("html += kpi(pct + '%', 'Выполнено за месяц'") >= 0, 'сама карточка «Выполнено за месяц» считает, как раньше');

// 2) строка кнопок планирования
ok(app.indexOf('id="cal-actions-row"') >= 0, 'строка функциональных кнопок планирования');
ok(app.indexOf("justify-content:flex-start\">' + (canPlan() ? '<button class=\"btn sm primary\" data-action=\"new-task\"") >= 0, '«Добавить задачу» — слева');
ok(app.indexOf("justify-content:center;gap:6px\">' + (canPlan() ? '<button class=\"btn sm\" data-action=\"optimize-works\"") >= 0, '«Оптимизировать работы» — по центру (с 225 — рядом кнопка «⟲ Отмена»)');
ok(app.indexOf('justify-content:flex-end\"><div class="trash-zone" id="trash-zone"') >= 0, '«Корзина» — справа');
ok(app.indexOf("if (canPlan()) {\n      html += '<button class=\"btn sm primary\" data-action=\"new-task\">" + "'") === -1, 'старые кнопки в шапке календаря убраны');

// 3) настройки бригад
ok(app.indexOf('function openWorkersSettingsModal()') >= 0, 'открыватель окна «Настройки бригад»');
ok(app.indexOf("var v = S.workersModal ? document.getElementById('modal') : document.getElementById('view');") >= 0, 'рендер работников умеет в окно');
ok(app.indexOf('<h3>⚙ Настройки бригад</h3>') >= 0, 'заголовок окна настроек бригад');
ok(app.indexOf('data-action="wk-settings-open"') >= 0 && app.indexOf("a === 'wk-settings-open'") >= 0, 'кнопка «Настройки бригад» в «Графиках смен» + диспетчер');
ok(app.indexOf("if (S.screen === 'workers') renderWorkers();") === -1, 'все перерисовки учитывают окно настроек');
ok(cnt("if (S.screen === 'workers' || S.workersModal) renderWorkers();") >= 8, 'перерисовки работников работают и в окне (' + cnt("if (S.screen === 'workers' || S.workersModal) renderWorkers();") + ' шт)');
ok(app.indexOf("var _wko2 = !!S.workersModal;") >= 0 && app.indexOf("document.getElementById('modal2') : modal") >= 0, 'карточка работника из окна — вторым окном');
ok(cnt("document.getElementById('modal3') : modal") === 2, 'день отсутствия и комментарий — третьим окном');
ok(app.indexOf("a === 'close-modal3'") >= 0, 'закрытие третьего окна');
ok(cnt("document.getElementById('overlay3').classList.remove('show')") === 3, '3-й уровень прячется после сохранений (день×2, комментарий)');
ok(app.indexOf('S.workersModal = false; S.factModal = false;') >= 0, 'флаги окон сбрасываются при закрытии');
ok(app.indexOf('if (S.workersModal && S.screen !== ') >= 0 && app.indexOf('if (S.factModal && S.screen !== ') >= 0, 'refresh перерисовывает открытые окна');
ok(index.indexOf('id="overlay3"') >= 0 && index.indexOf('#overlay3.overlay{z-index:300}') >= 0, 'третий уровень окон в index.html');

// 4) меню и журнал
ok(index.indexOf('data-screen="workers"') === -1, 'меню: «Работники» убраны');
ok(index.indexOf('data-screen="factmonth"') === -1, 'меню: «Факт работ по объектам» убран');
ok(app.indexOf("else if (S.screen === 'workers' || S.workersModal) renderWorkers();") >= 0 && app.indexOf("else if (S.screen === 'factmonth') renderFactMonth();") >= 0, 'страницы в коде оставлены (внутренние переходы не ломаны)');
ok(data.indexOf('{n:220,') >= 0, 'запись 22.09-220 в журнале изменений');
ok(/Сборка 22\.09-\d+/.test(index) && (index.match(/\?v=22\.09-(\d+)"/g) || []).length === 17, 'метка сборки на входе + 17 скриптов ?v=');

console.log('----------------------------------------');
if (fail) { console.log('FAILURES: ' + fail); process.exit(1); }
console.log('ALL 220 TESTS PASSED (' + pass + ')');
