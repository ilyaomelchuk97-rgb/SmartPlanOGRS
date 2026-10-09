'use strict';
/* Smoke: загрузка всех модулей, вход, свайп экранов, целевые проверки (206/207) */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = '/home/user/root_index';
const AREAS_SCHEMA = 1;
const FILES = ['config.js','data.js','users_db.js','grp_norms_seed.js','areas_db.js','professions_db.js','work_db.js','objects_db.js','workers_db.js','tasks_db.js','db.js','object_attrs.js','error_log.js','api_client.js','sync_polling.js','zip_util.js','app.js'];

let fails = 0, passes = 0;
function ok(cond, name) { if (cond) { passes++; console.log('ok - ' + name); } else { fails++; console.log('FAIL - ' + name); } }

/* ---------- DOM stub ---------- */
function makeElStub(tag) {
  const t = function () {};
  t.__v = '';
  if (tag) t.tagName = String(tag).toUpperCase();
  const cache = {};
  const p = new Proxy(t, {
    get(tt, k) {
      if (k === Symbol.iterator || k === Symbol.toPrimitive || k === 'then') return undefined;
      if (k === 'children' || k === 'options') return [];
      if (k in tt) return tt[k];
      if (!(k in cache)) cache[k] = makeElStub();
      return cache[k];
    },
    set(tt, k, v) { tt[k] = v; if (typeof v === 'string') tt.__v = v; return true; },
    has() { return true; },
    apply() { return p; }
  });
  return p;
}
const elCache = {};
const documentStub = {
  readyState: 'complete',
  getElementById(id) { id = String(id); if (!elCache[id]) elCache[id] = makeElStub(); return elCache[id]; },
  createElement(t) { return makeElStub(t); },
  createTextNode(t) { return { text: t }; },
  createDocumentFragment() { return makeElStub(); },
  querySelector() { return makeElStub(); },
  querySelectorAll() { return []; },
  addEventListener() {}, removeEventListener() {},
  body: makeElStub('body'), head: makeElStub('head'), documentElement: makeElStub('html'),
  hidden: false
};

/* ---------- localStorage stub ---------- */
const store = new Map();
function seed(k, v) { store.set(k, typeof v === 'string' ? v : JSON.stringify(v)); }
const localStorageStub = {
  getItem(k) { k = String(k); return store.has(k) ? store.get(k) : null; },
  setItem(k, v) { store.set(String(k), String(v)); },
  removeItem(k) { store.delete(String(k)); },
  clear() { store.clear(); },
  key(i) { return Array.from(store.keys())[i] || null; },
  get length() { return store.size; }
};

/* ---------- seeds ---------- */
const NOW = new Date(); const Y = NOW.getFullYear();
function isoOf(off) { const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + off); const m = ('0' + (d.getMonth() + 1)).slice(-2), dd = ('0' + d.getDate()).slice(-2); return d.getFullYear() + '-' + m + '-' + dd; }
seed('smartplan_grp_norms_v1', '1');
seed('smartplan_areas_db', { schema: AREAS_SCHEMA, areas: [ { id: 'a_ubirogs', name: 'УБиРОГС' }, { id: 'a_grp', name: 'ГРП' } ] });
// 22.09-223: свой каталог видов работ (минимальный): w7 (состав 2 чел.), пара «совместных» и обычная большая
seed('smartplan_work_catalog', { schema: 5, areas: { 'УБиРОГС': [
  { id: 'w7', group: 'Покраска', name: 'Покраска газопровода', norm: 0.15, unit: 'м2', needs_permit: false, depends_on_snow: false, min_temp: 5, season: 'Лето', equipment: 'Автовышка', min_workers: 2, opt_workers: 3, crew_size: 0, crew: [] },
  { id: 'w_j1', group: 'Тест совместных', name: 'Совместная работа А', norm: 6, unit: 'объект', needs_permit: false, depends_on_snow: false, min_temp: -50, season: 'Круглый год', equipment: '—', min_workers: 1, opt_workers: 1, crew_size: 1, crew: [], joint_with: ['w_j2'] },
  { id: 'w_j2', group: 'Тест совместных', name: 'Совместная работа Б', norm: 6, unit: 'объект', needs_permit: false, depends_on_snow: false, min_temp: -50, season: 'Круглый год', equipment: '—', min_workers: 1, opt_workers: 1, crew_size: 1, crew: [], joint_with: [] },
  { id: 'w_big', group: 'Тест совместных', name: 'Обычная большая работа', norm: 6, unit: 'объект', needs_permit: false, depends_on_snow: false, min_temp: -50, season: 'Круглый год', equipment: '—', min_workers: 1, opt_workers: 1, crew_size: 1, crew: [] }
] } });
seed('smartplan_users_db', { schema: 3, users: [
  { id: 'a_admin', login: 'admin', password: 'x', plain_password: 'x', full_name: 'Админ Смоук', role: 'admin', area: 'Все участки', color: '#0f2740', active: true },
  { id: 'm_smoke1', login: 'm1', password: 'x', full_name: 'Мастер Один', role: 'master', area: 'УБиРОГС', color: '#15803d', active: true },
  { id: 'm_smoke2', login: 'm2', password: 'x', full_name: 'Мастер Два', role: 'master', area: 'УБиРОГС', color: '#1d4ed8', active: true, avatar: 'data:image/png;base64,SMOKEAVA' },
  { id: 'sl_smoke', login: 'sl', password: 'x', full_name: 'Слесарь Смоук', role: 'slesar', area: 'УБиРОГС', color: '#64748b', active: true },
  { id: 'n_smoke', login: 'n', password: 'x', full_name: 'Начальник Смоук', role: 'nach', area: 'УБиРОГС', color: '#92400e', active: true },
  { id: 'sm_smoke', login: 'sm', password: 'x', full_name: 'Стмастер Смоук', role: 'smaster', area: 'УБиРОГС', color: '#6d28d9', active: true }
]});
seed('smartplan_workers_db', { schema: 1, workers: {
  m_smoke1: { hours: 12, sched: '2/2', cycle: '2026-01-05', brigade: null, prof: '', comment: '', abs: {} },
  m_smoke2: { hours: 8, sched: '5/2', cycle: '2026-01-05', brigade: null, prof: '', comment: '', abs: {} },
  sl_smoke: { hours: 12, sched: '2/2', cycle: '2026-01-05', brigade: 'm_smoke1', prof: '', comment: '', abs: {} }
}});
const T0 = NOW.getTime() - 5 * 86400000;
function mkTask(id, st, offDay, extra) {
  return Object.assign({
    id: id, name: 'Задача ' + id, type: 'work', m: 'm_smoke1', w: 'w7', o: 'o1',
    oname: 'Смоук Объект Один', addr: 'ул. Смоук, 1', area: 'УБиРОГС',
    s: st, status: st, d: offDay, dl: offDay + 1, dl_date: isoOf(offDay + 1), date: isoOf(offDay),
    priority: 2, created_at: T0, seq: 1
  }, extra || {});
}
seed('smartplan_tasks_db', { schema: 3, tasks: [
  mkTask('t_today1', 'open', 0),
  mkTask('t_today2', 'open', 0),
  mkTask('t_done', 'done', -1, { finished_at: T0 + 3600000 }),
  mkTask('t_ocdone', 'done', -2, { w: 'w7', started_at: T0, finished_at: T0 + 1800000 })
]});
seed('smartplan_graphs', [
  { id: 'g_smoke', name: 'Смоук график', year: Y, objs: [
    { name: 'Смоук Объект Один', type: 'Просека', works: [
      { sid: 's1', wid: 'w7', period: 1, dev: 0, first: '', occs: [
        { date: Y + '-05-10' },
        { date: Y + '-06-20', wid: 'w7', tid: 't_ocdone' }
      ]}
    ]}
  ]}
]);
seed('smartplan_session', 'a_admin');
seed('smartplan_logged_in', '1');

/* ---------- sandbox ---------- */
const noop = () => {};
const pending = () => new Promise(() => {});
const sandbox = {
  console, localStorage: localStorageStub, document: documentStub,
  navigator: { onLine: true, userAgent: 'smoke', serviceWorker: { register: noop, addEventListener: noop, controller: null }, clipboard: { writeText: () => Promise.resolve() }, mediaDevices: null },
  location: { origin: 'http://smoke.local', href: 'http://smoke.local/', pathname: '/', search: '', hash: '', replace: noop, assign: noop, reload: noop },
  history: { pushState: noop, replaceState: noop, back: noop },
  screen: { width: 1280, height: 800 }, name: '',
  performance: { now: () => 0 },
  fetch: pending,
  setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
  requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
  confirm: () => true, alert: noop, prompt: () => '',
  addEventListener: noop, removeEventListener: noop, dispatchEvent: () => true,
  matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
  crypto: { getRandomValues(a) { for (let i = 0; i < a.length; i++) a[i] = (i * 37 + 11) & 255; return a; } },
  btoa: (s) => Buffer.from(String(s), 'binary').toString('base64'),
  atob: (s) => Buffer.from(String(s), 'base64').toString('binary'),
  TextEncoder, TextDecoder, Intl, URL, URLSearchParams, FormData, Blob, FileReader: function () {}, XMLHttpRequest: function () {},
  Notification: makeElStub(), ymaps: makeElStub(), L: makeElStub(), maplibregl: makeElStub(), XLSX: makeElStub(), XLSX_STYLE: makeElStub(), JSZip: makeElStub()
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.top = sandbox; sandbox.parent = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);

/* ---------- boot ---------- */
(async () => {
  for (const f of FILES) {
    let code = fs.readFileSync(path.join(DIR, f), 'utf8');
    if (f === 'app.js') {
      const pos = code.lastIndexOf('})();');
      code = code.slice(0, pos) + ';window.__probe={S:S,GS:GS,TITLES:TITLES,refresh:refresh,renderDashboard:renderDashboard,visibleMasters:visibleMasters,enterApp:enterApp,setScreen:setScreen,kpiTasks:kpiTasks,kpiMasters:kpiMasters,dayTaskSort:dayTaskSort,_drawCalendarGridImpl:_drawCalendarGridImpl,fmtH3:fmtH3,openGraphLaborModal:openGraphLaborModal,gwWorkTipHtml:gwWorkTipHtml,graphsFind:graphsFind,schDayHours:schDayHours,openWorkModal:openWorkModal,openWmJointPickModal:openWmJointPickModal,wmJointSelBoxHtml:wmJointSelBoxHtml,openSchEditorModal:openSchEditorModal,schEdPatternShift:schEdPatternShift,schEdMoveDay:schEdMoveDay,openSchEdDayModal:openSchEdDayModal,schEdDayApply:schEdDayApply,schEdDayReset:schEdDayReset,schEdCur:schEdCur,schEdSaveAll:schEdSaveAll,wkCycleFrom:wkCycleFrom,gwJointAlign:gwJointAlign,gprFirstFromServiceLife:gprFirstFromServiceLife,gwGenObjSeries:gwGenObjSeries,gwNextISO:gwNextISO,gprRowHtml:gprRowHtml,wkDayState:wkDayState,masterCapacity:masterCapacity,offToDate:offToDate,schCellHtml:schCellHtml,openSchDayEditModal:openSchDayEditModal,schDayEditSave:schDayEditSave,SP_BUILD:SP_BUILD,avaHtml:avaHtml,applyUser:applyUser,openUserModal:openUserModal,saveUserAvatar:saveUserAvatar,openWorkersSettingsModal:openWorkersSettingsModal,openFactMonthModal:openFactMonthModal,kpiMonth:kpiMonth,openWkCardModal:openWkCardModal,taskDurHours:taskDurHours,workCrewCount:workCrewCount,loadForDay:loadForDay,optimizeWorksCalendar:optimizeWorksCalendar,taskHours:taskHours,rebaseTaskDaysToToday:rebaseTaskDaysToToday,moveTaskToCell:moveTaskToCell,planUndoApply:planUndoApply,graphSnapSave:graphSnapSave,graphSnapsLoad:graphSnapsLoad,openGraphSnapsModal:openGraphSnapsModal,graphSnapApply:graphSnapApply,gwFindPlanTask:gwFindPlanTask,graphsDupWarnHtml:graphsDupWarnHtml,graphYearResync:graphYearResync,graphsLoad:graphsLoad,graphsSaveList:graphsSaveList,renderRefs:renderRefs,toggleWeatherDropdown:toggleWeatherDropdown,wxBlurCloudsHtml:wxBlurCloudsHtml,openWorkBulkModal:openWorkBulkModal,workBulkApply:workBulkApply,grpSelAll:grpSelAll,wselSelCount:wselSelCount,brouterCarDayRoute:brouterCarDayRoute,openGraphSnapPreviewModal:openGraphSnapPreviewModal,gwYearGridHtml:gwYearGridHtml,snapIterLabel:snapIterLabel,key:key};' + code.slice(pos);
    }
    vm.runInContext(code, sandbox, { filename: f });
  }
  await new Promise(r => setTimeout(r, 60));
  const P = sandbox.__probe || sandbox.window.__probe;
  if (!P) { console.log('FAIL - probe not exported'); process.exit(1); }
  const user = sandbox.SP_USERS_DB.getUser('a_admin');
  P.enterApp(user);
  ok(true, 'boot + enterApp');

  /* ---------- свайп экранов ---------- */
  const scrErrs = [];
  const SCREENS = ['dashboard','calendar','graphs','map','objmap','testmap','testdep','livemap','perms','refs','writeoffs','workcards','factmonth','workers','schedules','users','reports','logs','changelog'];
  for (const s of SCREENS) {
    try { P.setScreen(s); if (s === 'calendar') P._drawCalendarGridImpl(); }
    catch (e) { scrErrs.push(s + ': ' + (e && e.message || e)); }
  }
  ok(scrErrs.length === 0, 'свайп ' + SCREENS.length + ' экранов без ошибок' + (scrErrs.length ? ' -> ' + scrErrs.join(' | ') : ''));

  const viewHtml = () => String(elCache.view && elCache.view.__v || '');

  /* ---------- дашборд ---------- */
  try { P.setScreen('dashboard'); } catch (e) {}
  let hv = viewHtml();
  ok(hv.indexOf('⚡ КПД мастеров') >= 0, 'дашборд: карточка «⚡ КПД мастеров»');
  ok(hv.indexOf('id="dash-master"') > hv.indexOf('⚡ КПД мастеров') && hv.indexOf('⚡ КПД мастеров') >= 0, 'дашборд: селектор КПД в заголовке карточки');
  ok(P.kpiMasters().some(m => m.id === 'm_smoke1'), 'kpiMasters содержит m_smoke1');

  /* ---------- календарь: только мастера ---------- */
  try { P.setScreen('calendar'); P._drawCalendarGridImpl(); } catch (e) {}
  const calHtml = viewHtml() + '\n' + String(elCache['cal-grid'] && elCache['cal-grid'].__v || '');
  ok(calHtml.indexOf('Мастер Один') >= 0, 'календарь: мастер виден');
  ok(calHtml.indexOf('Слесарь Смоук') === -1, 'календарь: слесарь не выводится');

  /* ---------- трудоёмкость графика ---------- */
  try { sandbox.SP_WORK.updateWork('УБиРОГС', 'w7', { norm: 0.125 }); } catch (e) {}
  P.GS.cur = 'g_smoke';
  try { P.openGraphLaborModal(); } catch (e) { console.log('labor err', e && e.message); }
  const laborHtml = String(elCache.modal && elCache.modal.__v || '');
  ok(laborHtml.indexOf('📍 По объектам</button>') >= 0, 'трудоёмкость: кнопка «📍 По объектам»');
  ok(laborHtml.indexOf('0,125') >= 0, 'трудоёмкость: формат до 3 знаков (0,125)');

  /* ---------- подсказки треугольников ---------- */
  const g = P.graphsFind('g_smoke');
  ok(!!g, 'график g_smoke найден');
  const ob = g.objs[0], wrk = ob.works[0];
  const tip1 = P.gwWorkTipHtml(g, ob, wrk, wrk.occs[0]);
  const tip2 = P.gwWorkTipHtml(g, ob, wrk, wrk.occs[1]);
  ok(tip1.indexOf('Трудоёмкость:') >= 0 && tip1.indexOf('0,125') >= 0, 'тултип: трудоёмкость у обычного проведения');
  ok(tip1.indexOf('факт:') === -1, 'тултип: у невыполненного нет факта');
  ok(tip2.indexOf('✔ Выполнена') >= 0 && tip2.indexOf('факт: 0,5 чел/ч') >= 0, 'тултип: у выполненного есть факт 0,5');

  /* ---------- графики смен: часы в title ---------- */
  const um1 = sandbox.SP_USERS_DB.getUser('m_smoke1');
  const um2 = sandbox.SP_USERS_DB.getUser('m_smoke2');
  const usl = sandbox.SP_USERS_DB.getUser('sl_smoke');
  ok(P.schDayHours(um1, '2026-10-03') === 12, 'schDayHours: мастер 12ч');
  ok(P.schDayHours(usl, '2026-10-03') === 11.5, 'schDayHours: слесарь 11.5ч');
  ok(P.schDayHours(um2, '2026-10-05') === 8.25, 'schDayHours: 8ч пн–чт = 8.25');
  ok(P.schDayHours(um2, '2026-10-09') === 7, 'schDayHours: 8ч пятница = 7');

  /* ---------- атрибуты объекта без «Ответственного» ---------- */
  const formHtml = sandbox.SP_OBJ_ATTRS.renderForm({ attrs: {} }, 'ГРП');
  ok(formHtml.length > 0 && formHtml.indexOf('Ответственный за безопасную эксплуатацию') === -1 && formHtml.indexOf('История ответственного') === -1, 'атрибуты объекта: блока «Ответственный» нет');
  ok(formHtml.indexOf('Дата ввода в эксплуатацию') >= 0, 'атрибуты объекта: остальные поля на месте');

  /* ---------- 206: карточка вида работ ГРП ---------- */
  P.S.workArea = 'ГРП';
  try { P.openWorkModal('new'); } catch (e) { console.log('openWorkModal new err', e && e.message); }
  let mh = String(elCache.modal && elCache.modal.__v || '');
  ok(mh.indexOf('Виды работ, от которых отсчёт периодичности') === -1, '206: блок отсчёта периодичности удалён из карточки');
  ok(mh.indexOf('wm-period-deps') === -1, '206: контейнер wm-period-deps отсутствует');
  ok(mh.indexOf('id="wm-norm"') >= 0 && mh.indexOf('id="wm-unit"') >= 0, '206: поля нормы и единицы на месте');
  ok(mh.indexOf('(группы работ участка ГРП, можно выбрать несколько)') >= 0, '206: подпись «Проводится совместно» — группы работ');
  ok(mh.indexOf('📋 Выбор групп</button>') >= 0, '206: кнопка «📋 Выбор групп»');
  const wg = sandbox.SP_WORK.addWork('ГРП', { name: 'Смоук работа ГРП', group: 'Смоук Группа ГРП', norm: 0.125, unit: 'шт' });
  try { P.openWorkModal('edit', wg.id); } catch (e) { console.log('openWorkModal edit err', e && e.message); }
  mh = String(elCache.modal && elCache.modal.__v || '');
  ok(mh.indexOf('value="0.125"') >= 0 && mh.indexOf('value="шт"') >= 0, '206: правка — норма 0.125 и единица шт подставлены');
  P.S.wmJointSel = [];
  try { P.openWmJointPickModal(); } catch (e) { console.log('joint pick err', e && e.message); }
  const jh = String(elCache.modal2 && elCache.modal2.__v || '');
  ok(jh.indexOf('Проводится совместно — выбор групп работ') >= 0, '206: окно выбора — заголовок про группы');
  ok(jh.indexOf('Смоук Группа ГРП') >= 0, '206: в окне выбора — группа работ');
  ok(P.wmJointSelBoxHtml('ГРП', null).indexOf('— группы не выбраны') >= 0, '206: пустой список совместных — про группы');
  P.S.wmJointSel = ['Смоук Группа ГРП'];
  ok(P.wmJointSelBoxHtml('ГРП', null).indexOf('Смоук Группа ГРП') >= 0, '206: выбранная группа видна в списке');
  P.S.wmJointSel = ['w_no_such_id'];
  ok(P.wmJointSelBoxHtml('ГРП', null).indexOf('⚠ старый выбор') >= 0, '206: legacy id — строка с ⚠');
  P.S.wmJointSel = [];
  const wA = sandbox.SP_WORK.addWork('ГРП', { name: 'Смоук А', group: 'ГР Смоук А', norm: 1 });
  const wB = sandbox.SP_WORK.addWork('ГРП', { name: 'Смоук Б', group: 'ГР Смоук Б', norm: 1, joint_with: ['ГР Смоук А'] });
  const ws = [{ wid: wA.id, period: 1, occs: [{ date: '2026-05-05' }] }, { wid: wB.id, period: 1, occs: [{ date: '2026-05-20' }] }];
  ok(P.gwJointAlign(ws, 'ГРП') === 1 && ws[1].occs[0].date === '2026-05-05', '206: совместные по группе — перенос');
  const wC = sandbox.SP_WORK.addWork('ГРП', { name: 'Смоук В', group: 'ГР Смоук В', norm: 1 });
  const ws2 = [{ wid: wA.id, period: 1, occs: [{ date: '2026-05-05' }] }, { wid: wC.id, period: 1, occs: [{ date: '2026-05-21' }] }];
  ok(P.gwJointAlign(ws2, 'ГРП') === 0 && ws2[1].occs[0].date === '2026-05-21', '206: несвязанные группы — без переноса');
  sandbox.SP_WORK.updateWork('ГРП', wC.id, { joint_with: [wA.id] });
  const ws3 = [{ wid: wA.id, period: 1, occs: [{ date: '2026-05-05' }] }, { wid: wC.id, period: 1, occs: [{ date: '2026-05-22' }] }];
  ok(P.gwJointAlign(ws3, 'ГРП') === 1 && ws3[1].occs[0].date === '2026-05-05', '206: legacy-совместные по id — перенос');

  /* ---------- УБиРОГС: блоков ГРП нет ---------- */
  P.S.workArea = 'УБиРОГС';
  try { P.openWorkModal('new'); } catch (e) {}
  mh = String(elCache.modal && elCache.modal.__v || '');
  ok(mh.indexOf('id="wm-norm"') === -1 && mh.indexOf('Проводится совместно') === -1, 'УБиРОГС: блоков ГРП в карточке нет');

  /* ---------- 207: редактирование графика смен ---------- */
  // будущая суббота (выходной по 5/2) и будущий будний день
  function futIso(wantDow) { for (let i = 7; i < 40; i++) { const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + i); if (d.getDay() === wantDow) { const m = ('0' + (d.getMonth() + 1)).slice(-2), dd = ('0' + d.getDate()).slice(-2); return d.getFullYear() + '-' + m + '-' + dd; } } }
  const pastIso = isoOf(-9);
  const satIso = futIso(6), wedIso = futIso(3);
  ok(P.wkDayState('m_smoke2', satIso) === 'off', '207: суббота по 5/2 — выходной');
  sandbox.SP_WORKERS.setDayOverride('m_smoke2', satIso, { s: 'work', h: 9 });
  ok(P.wkDayState('m_smoke2', satIso) === 'work', '207: ручное добавление рабочего дня к графику');
  ok(P.schDayHours(um2, satIso) === 9, '207: ручные часы дня (9) в подсказке');
  // masterCapacity: будний день стал выходным
  const wedOff = Math.round((new Date(wedIso + 'T00:00:00') - new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate())) / 86400000);
  const capBefore = P.masterCapacity('m_smoke2', wedOff);
  sandbox.SP_WORKERS.setDayOverride('m_smoke2', wedIso, { s: 'off' });
  ok(capBefore > 0 && P.masterCapacity('m_smoke2', wedOff) === 0, '207: перенос рабочего дня — ёмкость стала 0');
  const wm = { y: NOW.getFullYear(), m: NOW.getMonth() };
  const futD = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + 10);
  const cellO = P.schCellHtml(um2, satIso, 'work', '#dcfce7', '#16a34a', 18, wm, futD.getDate());
  ok(cellO.indexOf('изменён вручную') >= 0, '207: маркер ручного изменения в ячейке');
  try { P.setScreen('schedules'); } catch (e) { console.log('sched render err', e && e.message); }
  hv = viewHtml();
  ok(hv.indexOf('data-action="sch-ed-open"') >= 0, '211: кнопка открывает окно редактора');
  // окно редактора дня + сохранение (один работник)
  const d1 = isoOf(12);
  sandbox.SP_WORKERS.setDayOverride('m_smoke2', d1, null);
  try { P.openSchDayEditModal('m_smoke2', d1); } catch (e) { console.log('day edit err', e && e.message); }
  const dm = String(elCache.modal && elCache.modal.__v || '');
  ok(dm.indexOf('Изменение дня') >= 0 && dm.indexOf('sch-day-work') >= 0 && dm.indexOf('sch-day-hours') >= 0, '207: окно редактора дня открывается');
  documentStub.getElementById('sch-day-off').checked = true; documentStub.getElementById('sch-day-hours').value = '';
  P.S.schDay = { uid: 'm_smoke2', ds: d1 };
  try { P.schDayEditSave(false); } catch (e) { console.log('day save err', e && e.message); }
  ok((sandbox.SP_WORKERS.getWorker('m_smoke2').overrides || {})[d1] && sandbox.SP_WORKERS.getWorker('m_smoke2').overrides[d1].s === 'off', '207: сохранение — день стал выходным');
  P.S.schDay = { uid: 'm_smoke2', ds: d1 };
  try { P.schDayEditSave(true); } catch (e) {}
  ok(!(sandbox.SP_WORKERS.getWorker('m_smoke2').overrides || {})[d1], '207: возврат к стандарту — override снят');
  // бригадное применение
  const d2 = isoOf(15);
  documentStub.getElementById('sch-day-off').checked = false; documentStub.getElementById('sch-day-work').checked = true; documentStub.getElementById('sch-day-hours').value = '10'; documentStub.getElementById('sch-day-brig').checked = true;
  P.S.schDay = { uid: 'm_smoke1', ds: d2 };
  try { P.schDayEditSave(false); } catch (e) { console.log('day save2 err', e && e.message); }
  const oM = (sandbox.SP_WORKERS.getWorker('m_smoke1').overrides || {})[d2];
  const oS = (sandbox.SP_WORKERS.getWorker('sl_smoke').overrides || {})[d2];
  ok(oM && oM.s === 'work' && oM.h === 10 && oS && oS.s === 'work' && oS.h === 10, '207: применение ко всей бригаде (мастер + слесарь)');
  // защита прошедших дней в окне
  try { P.openSchDayEditModal('m_smoke2', pastIso); } catch (e) {}
  ok(P.S.schDay == null, '207: прошедший день — окно не открывается (мягкий отказ)');
  P.S.schEdit = false;

  /* ---------- 208: надгруппы работ ---------- */
  const wD = sandbox.SP_WORK.addWork('ГРП', { name: 'Смоук глубокая работа', group: 'Ремонты Смоук / ГРП Смоук / Лето', norm: 1 });
  P.S.workArea = 'ГРП';
  try { P.openWorkModal('edit', wD.id); } catch (e) { console.log('openWorkModal 208 err', e && e.message); }
  mh = String(elCache.modal && elCache.modal.__v || '');
  ok(mh.indexOf('id="wm-supergroup"') >= 0, '208: поле «Надгруппа» в карточке');
  ok(mh.indexOf('value="Ремонты Смоук"') >= 0 && mh.indexOf('value="ГРП Смоук"') >= 0 && mh.indexOf('value="Лето"') >= 0, '208: три уровня разобраны в поля');
  P.S.refsTab = 'tree';
  try { P.setScreen('refs'); } catch (e) { console.log('refs 208 err', e && e.message); }
  hv = viewHtml();
  ok(hv.indexOf('Ремонты Смоук') >= 0 && hv.indexOf('ГРП Смоук') >= 0 && hv.indexOf('Лето') >= 0, '208: дерево справочника — 3 уровня');
  const wS1 = sandbox.SP_WORK.addWork('ГРП', { name: 'Смоук простая работа', group: 'ГРП Смоук', norm: 1 });
  mh = String(elCache.modal && elCache.modal.__v || '');
  ok(mh.indexOf('value="ГРП Смоук"') >= 0, '208: работа без надгруппы — группа на месте');

  /* ---------- 209: планирование от окончания срока службы ---------- */
  const formHtml2 = sandbox.SP_OBJ_ATTRS.renderForm({ attrs: {} }, 'ГРП');
  ok(formHtml2.indexOf('Дата окончания срока службы') >= 0, '209: карточка объекта — поле даты срока службы');
  P.S.workArea = 'ГРП';
  try { P.openWorkModal('new'); } catch (e) {}
  mh = String(elCache.modal && elCache.modal.__v || '');
  ok(mh.indexOf('value="service_life_end"') >= 0 && mh.indexOf('Дата окончания срока службы оборудования</option>') >= 0, '209: карточка вида работ — вариант отсчёта «срок службы»');
  const wLE = sandbox.SP_WORK.addWork('ГРП', { name: 'Смоук срок службы', group: 'ГР Смоук А', norm: 1, periodicity_basis: 'service_life_end' });
  const wBO = sandbox.SP_WORK.addWork('ГРП', { name: 'Смоук bogus', group: 'ГР Смоук А', norm: 1, periodicity_basis: 'bogus' });
  ok(wLE.periodicity_basis === 'service_life_end' && wBO.periodicity_basis === 'prev_date', '209: значение реквизита сохраняется/валидируется');
  ok(P.gprFirstFromServiceLife({ serviceLifeEnd: '2031-03-15' }) === '2031-03-15', '209: якорь — абсолютная дата объекта');
  ok(P.gprFirstFromServiceLife({ serviceLifeEnd: '2031-3-5' }) === '' && P.gprFirstFromServiceLife({}) === '', '209: якорь — невалидная дата отброшена');
  const g209 = { id: 'gx209', name: 'X', year: Y, area: 'ГРП', respId: 'm_smoke1', objs: [] };
  const ob209 = { oid: null, name: 'Смоук Объект 209', type: 'ГРП' };
  const wrkF = { sid: 's1', wid: wLE.id, period: 60, dev: 0, first: (Y + 5) + '-03-15', occs: [] };
  let st209 = P.gwGenObjSeries(g209, 0, 'ГРП', ob209, wrkF, false);
  ok(st209.created === 0 && st209.fail === 0 && wrkF.occs.length === 0, '209: будущий срок службы — тихо, без ошибки и без проведений');
  const wrkC = { sid: 's1', wid: wBO.id, period: 60, dev: 0, first: (Y + 5) + '-03-15', occs: [] };
  st209 = P.gwGenObjSeries(g209, 0, 'ГРП', ob209, wrkC, false);
  ok(st209.fail === 1, '209: контроль — будущий якорь у обычного отсчёта по-прежнему считается ошибкой');
  const wrkP = { sid: 's1', wid: wLE.id, period: 60, dev: 0, first: Y + '-03-15', occs: [] };
  st209 = P.gwGenObjSeries(g209, 0, 'ГРП', ob209, wrkP, false);
  ok(st209.fail === 0 && wrkP.occs.length === 1, '209: срок службы в этом году — ровно одно проведение (дальше через 60 мес)');

  /* ---------- 210: дробная периодичность ---------- */
  ok(P.gwNextISO(Y + '-01-10', 0.5, 0) === Y + '-01-25', '210: шаг 0,5 мес = ~15 дней');
  ok(P.gwNextISO(Y + '-01-10', 1.5, 0) === Y + '-02-25', '210: шаг 1,5 мес = месяц + ~15 дней');
  ok(P.gwNextISO(Y + '-01-31', 1, 0) === Y + '-02-28', '210: целый месяц — как раньше (31 янв → 28 фев)');
  ok(P.gwNextISO(Y + '-01-10', 2, 3) === Y + '-03-07', '210: целое + отклонение — как раньше');
  const wrkHalf = { sid: 's1', wid: wA.id, period: 0.5, dev: 0, first: Y + '-01-10', occs: [] };
  const stH = P.gwGenObjSeries(g209, 0, 'ГРП', ob209, wrkHalf, false);
  ok(stH.fail === 0 && wrkHalf.occs.length >= 2, '210: серия с 0,5 мес строится');
  function dDiff(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }
  if (wrkHalf.occs.length >= 2) {
    const dd = dDiff(wrkHalf.occs[0].date, wrkHalf.occs[1].date);
    ok(dd >= 13 && dd <= 17, '210: интервал между проведениями ~15 дней (' + dd + ')');
  }
  const rowHtml = P.gprRowHtml('ГРП', 0, 0, { sid: 's1', wid: wA.id, period: 0.5, dev: 0, first: '' });
  ok(rowHtml.indexOf('inputmode="decimal"') >= 0 && rowHtml.indexOf('value="0,5"') >= 0, '210: поле периодичности — значение 0,5 с запятой');

  /* ---------- 211/212/213: окно редактора графика смен ---------- */
  try { P.openSchEditorModal(); } catch (e) { console.log('schEd open err', e && e.message); }
  let eh = String(elCache.modal && elCache.modal.__v || '');
  ok(eh.indexOf('Изменение графика смен') >= 0 && eh.indexOf('💾 Сохранить') >= 0, '211: окно редактора открывается (есть «Сохранить»)');
  ok(eh.indexOf('<table') >= 0 && eh.indexOf('Бригада / работник') >= 0, '212: в окне таблица как в «Графиках смен»');
  ok(eh.indexOf('data-sch-day=') >= 0, '212: ячейки дней с датами');
  ok(eh.indexOf('>8,25<') >= 0 && eh.indexOf('>12<') >= 0 && eh.indexOf('>11,5<') >= 0, '212: в квадратиках написаны часы (8,25 / 12 / 11,5)');
  ok(String(elCache.modal.style.width || '') === '90vw', '216: окно редактора — 90% ширины экрана, по центру');
  ok(eh.indexOf('sch-ed-user') === -1, '213: выпадающего списка работников нет');
  ok(eh.indexOf('Сдвиг всего графика') === -1, '213: блока «Сдвиг всего графика» нет');
  ok(eh.indexOf('Выбрано:') === -1, '213: панели «Выбрано» нет');
  // 213: клик по дню — окошко «рабочий/выходной + часы» (m_smoke2, суббота — выходной по 5/2)
  sandbox.SP_WORKERS.setDayOverride('m_smoke2', satIso, null);
  try { P.openSchEdDayModal('m_smoke2', satIso); } catch (e) { console.log('day modal err', e && e.message); }
  let dh = String(elCache.modal2 && elCache.modal2.__v || '');
  ok(dh.indexOf('scheday-work') >= 0 && dh.indexOf('scheday-off') >= 0 && dh.indexOf('scheday-hours') >= 0 && dh.indexOf('Применить') >= 0, '213: клик по дню — окошко рабочий/выходной + часы');
  documentStub.getElementById('scheday-work').checked = true;
  documentStub.getElementById('scheday-off').checked = false;
  documentStub.getElementById('scheday-hours').value = '6';
  P.schEdDayApply();
  ok(Object.keys(((P.S.schEdAll || {})['m_smoke2'] || { draft: {} }).draft || {}).length === 1, '211: действие — в черновике');
  ok(!(sandbox.SP_WORKERS.getWorker('m_smoke2').overrides || {})[satIso], '211: до «Сохранить» данные не меняются');
  P.schEdSaveAll();
  let ov2 = (sandbox.SP_WORKERS.getWorker('m_smoke2').overrides || {})[satIso];
  ok(ov2 && ov2.s === 'work' && ov2.h === 6, '211: «Сохранить» применило: суббота — рабочая, 6 ч');
  // 213: перетаскивание дня (5/2): суббота → воскресенье — переносится только этот день
  const sunIso2 = (function () { const d = new Date(satIso + 'T00:00:00'); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); })();
  P.schEdMoveDay('m_smoke2', satIso, sunIso2);
  P.schEdSaveAll();
  ov2 = (sandbox.SP_WORKERS.getWorker('m_smoke2').overrides || {})[satIso];
  let ov3 = (sandbox.SP_WORKERS.getWorker('m_smoke2').overrides || {})[sunIso2];
  ok(ov2 && ov2.s === 'off' && ov3 && ov3.s === 'work' && ov3.h === 6, '213: перетаскивание дня (5/2) — перенёсся только этот день');
  // 213: «Вернуть по графику» через окошко снимает ручное изменение
  try { P.openSchEdDayModal('m_smoke2', satIso); } catch (e) {}
  P.schEdDayReset();
  P.schEdSaveAll();
  ov2 = (sandbox.SP_WORKERS.getWorker('m_smoke2').overrides || {})[satIso];
  ok(!ov2 || !ov2.s, '213: «Вернуть по графику» сняло ручное изменение (суббота)');
  sandbox.SP_WORKERS.setDayOverride('m_smoke2', satIso, null);
  sandbox.SP_WORKERS.setDayOverride('m_smoke2', sunIso2, null);
  // мастер 2/2: сдвиг ВСЕГО графика перетаскиванием
  let bnd = null;
  for (let i = 3; i < 30; i++) {
    const d2 = isoOf(i), d1 = isoOf(i - 1);
    const ovr = sandbox.SP_WORKERS.getWorker('m_smoke1').overrides || {};
    if (ovr[d2] || ovr[d1]) continue;
    if (P.wkDayState('m_smoke1', d2) === 'work' && P.wkDayState('m_smoke1', d1) === 'off') { bnd = d2; break; }
  }
  ok(!!bnd, '211: найдена граница цикла (' + bnd + ')');
  P.schEdPatternShift(1, 'm_smoke1');
  P.schEdSaveAll();
  const hist1 = sandbox.SP_WORKERS.getWorker('m_smoke1').cycleHist || [];
  ok(hist1.length === 1 && hist1[0].from === isoOf(0), '211: сдвиг записан (cycleHist, с сегодняшнего дня)');
  ok(P.wkDayState('m_smoke1', bnd) === 'off', '211: весь график передвинулся следом');
  P.schEdPatternShift(-1, 'm_smoke1');
  P.schEdSaveAll();
  ok((sandbox.SP_WORKERS.getWorker('m_smoke1').cycleHist || []).length === 1, '213: обратный сдвиг — запись истории обновлена (тиража записей нет)');
  ok(P.wkDayState('m_smoke1', bnd) === 'work', '211: график вернулся как был');
  sandbox.SP_WORKERS.removeCycleShift('m_smoke1', hist1[0].from);
  const _h2 = sandbox.SP_WORKERS.getWorker('m_smoke1').cycleHist || [];
  if (_h2[0]) sandbox.SP_WORKERS.removeCycleShift('m_smoke1', _h2[0].from);

  /* ---------- 215: дни каждого работника меняются индивидуально ---------- */
  try { P.openSchEditorModal(); } catch (e) {}
  P.schEdPatternShift(1, 'm_smoke1');
  P.schEdSaveAll();
  ok(P.wkDayState('m_smoke1', bnd) === 'off', '215: сдвиг мастера — его график сдвинулся');
  ok(P.wkDayState('sl_smoke', bnd) === 'work', '215: график слесаря бригады НЕ изменился (индивидуально)');
  (function () {
    var raw = null; try { raw = JSON.parse(store.get('smartplan_workers_db')); } catch (e) {}
    ok(raw && raw.schema === 2, '215: workers_db переведена на схему 2 (цикл у каждого свой)');
    ok(raw && raw.workers && raw.workers.sl_smoke && raw.workers.sl_smoke.cycle === '2026-01-05', '215: у слесаря — собственная запись цикла (скопирована)');
  })();
  P.schEdPatternShift(1, 'sl_smoke');
  P.schEdSaveAll();
  ok(P.wkDayState('sl_smoke', bnd) === 'off', '215: сдвиг слесаря — его график сдвинулся');
  ok((sandbox.SP_WORKERS.getWorker('m_smoke1').cycleHist || []).length === 1, '215: запись мастера слесарем не затронута');
  sandbox.SP_WORKERS.removeCycleShift('m_smoke1', isoOf(0));
  sandbox.SP_WORKERS.removeCycleShift('sl_smoke', isoOf(0));
  sandbox.SP_WORKERS.setDayOverride('m_smoke1', bnd, null);
  sandbox.SP_WORKERS.setDayOverride('sl_smoke', bnd, null);

  /* ---------- 217: часы за месяц/год; в окне нет пустых столбиков ---------- */
  try { P.openSchEditorModal(); } catch (e) {}
  const eh217 = String(elCache.modal && elCache.modal.__v || '');
  ok(eh217.indexOf('Бригада / работник</th><th title="') >= 0, '217: в окне редактора нет пустых столбиков перед 1-м числом');
  try { P.setScreen('schedules'); } catch (e) {}
  const hv217 = viewHtml();
  const _fmt2 = v => String(Math.round((+v || 0) * 1000) / 1000).replace('.', ',');
  const _u2 = { id: 'm_smoke2', role: 'master' }; // ожидание считаем тем же движком (учёт ручных изменений)
  let expM = 0;
  { const dimM = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= dimM; d++) { const ds = NOW.getFullYear() + '-' + ('0' + (NOW.getMonth() + 1)).slice(-2) + '-' + ('0' + d).slice(-2);
      if (P.wkDayState('m_smoke2', ds) === 'work') expM += P.schDayHours(_u2, ds); } }
  ok(hv217.indexOf('⏱ ' + _fmt2(expM) + ' ч') >= 0, '217: карточка — часы за месяц (' + _fmt2(expM) + ' ч)');
  ok(hv217.indexOf('Количество рабочих часов за') >= 0, '217: у карточек — подсказка про часы за период');
  let expY = 0;
  for (let mm = 0; mm < 12; mm++) { const dimY = new Date(NOW.getFullYear(), mm + 1, 0).getDate();
    for (let d = 1; d <= dimY; d++) { const ds = NOW.getFullYear() + '-' + ('0' + (mm + 1)).slice(-2) + '-' + ('0' + d).slice(-2);
      if (P.wkDayState('m_smoke2', ds) === 'work') expY += P.schDayHours(_u2, ds); } }
  ok(hv217.indexOf('⏱ часы') >= 0, '217: в годовой таблице — колонка «часы за год»');
  ok(hv217.indexOf('⏱ ' + _fmt2(expY) + ' ч') >= 0, '217: часы за год посчитаны (' + _fmt2(expY) + ' ч)');

  /* ---------- 219: шапка — только номер сборки; история — в «Журнале изменений» ---------- */
  try { P.setScreen('schedules'); } catch (e) {}
  const _crEl = elCache['screen-crumb'] || {};
  const _crTxt = String(_crEl.textContent || '');
  const _crTitle = String(_crEl.title || '');
  ok(_crTxt === 'Сборка ' + P.SP_BUILD, '219: в шапке страницы — только номер сборки (без длинных описаний)');
  ok(_crTitle.indexOf('Журнал изменений') >= 0, '219: подсказка шапки ведёт в «Журнал изменений»');
  try { P.setScreen('changelog'); } catch (e) { console.log('changelog err', e && e.message); }
  const hv219 = viewHtml();
  ok(hv219.indexOf('Журнал изменений') >= 0 && hv219.indexOf('Что изменилось') >= 0, '219: журнал изменений открывается');
  ok(hv219.indexOf('>22.09-219<') >= 0 && hv219.indexOf('текущая') >= 0, '219: текущая сборка подсвечена в журнале');
  ok((sandbox.SP_CHANGELOG || []).length >= 140 && hv219.indexOf('>22.09-25<') >= 0, '219: старые записи перенесены в журнал (' + (sandbox.SP_CHANGELOG || []).length + ' шт)');

  /* ---------- 218: в прошедшие дни можно поправить часы ---------- */
  try { P.openSchEditorModal(); } catch (e) { console.log('schEd open err', e && e.message); }
  // прошедший рабочий день без ручных изменений (5/2 — будни) и прошедший выходной
  let pastW = null, pastO = null, pastWInMonth = false;
  {
    const ovr = sandbox.SP_WORKERS.getWorker('m_smoke2').overrides || {};
    for (let i = 1; i <= 10; i++) {
      const ds = isoOf(-i);
      if (ovr[ds]) continue;
      const stt = P.wkDayState('m_smoke2', ds);
      if (stt === 'work' && !pastW) pastW = ds;
      if (stt === 'off' && !pastO) pastO = ds;
      if (pastW && pastO) break;
    }
    if (pastW) {
      const yy = NOW.getFullYear(), mm0 = NOW.getMonth();
      pastWInMonth = pastW.slice(0, 7) === yy + '-' + ('0' + (mm0 + 1)).slice(-2);
    }
  }
  ok(!!pastW, '218: найден прошедший рабочий день (' + pastW + ')');
  if (pastWInMonth) {
    const eh218 = String(elCache.modal && elCache.modal.__v || '');
    ok(eh218.indexOf('data-action="sch-ed-cell" data-uid="m_smoke2" data-sch-day="' + pastW + '"') >= 0, '218: прошедший день кликабелен в таблице окна');
  } else { ok(true, '218: прошедший день кликабелен (в текущем месяце нет, пропуск проверки таблицы)'); }
  // окошко дня: радио выключены, редактируются только часы
  try { P.openSchEdDayModal('m_smoke2', pastW); } catch (e) { console.log('day modal err', e && e.message); }
  let dh218 = String(elCache.modal2 && elCache.modal2.__v || '');
  ok(dh218.indexOf('id="scheday-work"') >= 0 && dh218.indexOf(' checked disabled') >= 0, '218: у прошедшего рабочего дня «рабочий» выбран, радио выключены');
  ok(dh218.indexOf('Прошедший день: здесь можно поправить только количество часов') >= 0, '218: подсказка «поправить только часы»');
  documentStub.getElementById('scheday-work').checked = true;
  documentStub.getElementById('scheday-off').checked = false;
  documentStub.getElementById('scheday-hours').value = '9,5';
  P.schEdDayApply();
  const dr218 = ((P.S.schEdAll || {})['m_smoke2'] || { draft: {} }).draft || {};
  ok(dr218[pastW] && dr218[pastW].s === 'work' && dr218[pastW].h === 9.5, '218: часы прошедшего дня в черновике (9,5)');
  // текущий/будущий день — радио по-прежнему активны
  try { P.openSchEdDayModal('m_smoke2', isoOf(0)); } catch (e) {}
  const dh218b = String(elCache.modal2 && elCache.modal2.__v || '');
  ok(dh218b.indexOf('id="scheday-work"') >= 0 && dh218b.indexOf(' checked disabled') === -1, '218: у сегодняшнего дня радио активны, как раньше');
  P.schEdDayReset(); // закрыть окошко (draft=null — на данных не отразится)
  P.schEdSaveAll();
  const ov218 = (sandbox.SP_WORKERS.getWorker('m_smoke2').overrides || {})[pastW];
  ok(ov218 && ov218.s === 'work' && ov218.h === 9.5, '218: «Сохранить» записало часы в прошедший день');
  // прошедший выходной — окошко не открывается
  if (pastO) {
    try { P.openSchEdDayModal('m_smoke2', pastO); } catch (e) {}
    ok(P.S.schEdDay === null, '218: прошедший выходной не открывается (менять нечего)');
  } else { ok(true, '218: прошедший выходной не открывается (в диапазоне не было, пропуск)'); }
  sandbox.SP_WORKERS.setDayOverride('m_smoke2', pastW, null);

  /* ---------- 219: карточка 200 px и фото-аватары везде ---------- */
  try { P.setScreen('schedules'); } catch (e) {}
  const hvS219 = viewHtml();
  ok(hvS219.indexOf('width:200px;max-width:200px') >= 0 && hvS219.indexOf('text-overflow:ellipsis') >= 0, '222: карточка в «Графиках смен» — не шире 200 px, ФИО/должность обрезаются');
  ok(hvS219.indexOf('<img src="data:image/png;base64,SMOKEAVA"') >= 0, '219: в карточке «Графиков смен» — фото-аватар');
  try { P.setScreen('workers'); } catch (e) {}
  ok(viewHtml().indexOf('<img src="data:image/png;base64,SMOKEAVA"') >= 0, '219: в карточке «Работников» — фото-аватар');
  try { P.setScreen('users'); } catch (e) {}
  ok(viewHtml().indexOf('<img src="data:image/png;base64,SMOKEAVA"') >= 0, '219: в таблице «Пользователей» — фото-аватар');
  try { P.openUserModal('edit', 'm_smoke2'); } catch (e) { console.log('userModal err', e && e.message); }
  const umh = String(elCache.modal && elCache.modal.__v || '');
  ok(umh.indexOf('id="um-ava-file"') >= 0 && umh.indexOf('um-ava-upload') >= 0, '219: в карточке пользователя — блок загрузки фото');
  ok(umh.indexOf('Заменить фото') >= 0 && umh.indexOf('um-ava-remove') >= 0, '219: фото уже есть — доступны «Заменить»/«Удалить»');
  ok(P.avaHtml({ full_name: 'Без Фото', color: '#111111' }, 34, 12.5).indexOf('<img') === -1, '219: без фото кружок — инициалы, как раньше');
  ok(P.avaHtml({ color: '#111111', avatar: 'data:image/jpeg;base64,ZZZ' }, 34, 12.5).indexOf('<img src="data:image/jpeg;base64,ZZZ"') >= 0, '219: с фото кружок — картинка');
  const _admUser = P.S.user;
  try { P.S.user = um2; P.applyUser(); } catch (e) { console.log('applyUser err', e && e.message); }
  ok(String(((elCache['av'] || {}).style || {}).backgroundImage || '').indexOf('SMOKEAVA') >= 0, '219: в шапке справа вверху — фото вошедшего пользователя');
  try { P.S.user = _admUser; P.applyUser(); } catch (e) {}
  ok(String(((elCache['av'] || {}).style || {}).backgroundImage || '').indexOf('SMOKEAVA') === -1, '219: у пользователя без фото в шапке — инициалы');

  /* ---------- 220: переносы страниц в окна + строка кнопок планирования ---------- */
  try { P.setScreen('calendar'); } catch (e) {}
  const hvCal220 = viewHtml();
  const iRow220 = hvCal220.indexOf('id="cal-actions-row"');
  const iNew220 = hvCal220.indexOf('data-action="new-task"');
  const iOpt220 = hvCal220.indexOf('data-action="optimize-works"');
  const iTr220 = hvCal220.indexOf('id="trash-zone"');
  ok(iRow220 >= 0 && iRow220 < iNew220 && iNew220 < iOpt220 && iOpt220 < iTr220, '220: планирование — кнопки отдельной строкой: задача слева, оптимизация по центру, корзина справа');
  try { P.setScreen('dashboard'); } catch (e) {}
  ok(viewHtml().indexOf('Выполнено за месяц') >= 0, '220: блок «Выполнено за месяц» в панели мониторинга на месте');
  try { P.kpiMonth(); } catch (e) { console.log('kpiMonth err', e && e.message); }
  const fm220 = String(elCache.modal && elCache.modal.__v || '');
  ok(fm220.indexOf('Факт работ по объектам') >= 0 && fm220.indexOf('Предыдущий месяц') >= 0, '220: клик по блоку — окно «Факт работ по объектам»');
  ok(P.S.factModal === true && String(elCache.modal.style.width || '') === '90vw', '220: окно факта — 90% ширины экрана');
  P.S.factModal = false; try { elCache.overlay.classList.remove('show'); } catch (e) {}
  try { P.setScreen('schedules'); } catch (e) {}
  ok(viewHtml().indexOf('data-action="wk-settings-open"') >= 0 && viewHtml().indexOf('Настройки бригад') >= 0, '220: в «Графиках смен» появилась кнопка «Настройки бригад»');
  try { P.openWorkersSettingsModal(); } catch (e) { console.log('wkSet err', e && e.message); }
  ok(String(elCache.modal && elCache.modal.__v || '').indexOf('<h3>⚙ Настройки бригад</h3>') >= 0 && String(elCache.modal.__v).indexOf('Бригада мастера') >= 0, '220: окно «Настройки бригад» = функционал страницы «Работники»');
  ok(P.S.workersModal === true && String(elCache.modal.style.width || '') === '90vw', '220: окно настроек бригад — 90% ширины');
  try { P.openWkCardModal('m_smoke1', false); } catch (e) { console.log('wkCard err', e && e.message); }
  ok(String(elCache.modal2 && elCache.modal2.__v || '').indexOf('Мастер Один') >= 0, '220: карточка работника — вторым окном поверх настроек');
  ok(String(elCache.modal && elCache.modal.__v || '').indexOf('<h3>⚙ Настройки бригад</h3>') >= 0, '220: окно «Настройки бригад» под карточкой не затёрто');
  ok(String(elCache.modal2.style.maxWidth || '') === '560px', '220: ширина карточки работника как раньше (560 px)');
  P.S.wkModalUid = null; P.S.workersModal = false;
  try { elCache.overlay.classList.remove('show'); elCache.overlay2.classList.remove('show'); elCache.modal.style.width = ''; elCache.modal.style.maxWidth = ''; } catch (e) {}

  /* ---------- 221: «✏ Изменить график» по выбранной в списке бригаде ---------- */
  try { P.S.screen = 'schedules'; } catch (e) {}
  P.S.schMode = 'b:m_smoke2';
  try { P.openSchEditorModal(); } catch (e) { console.log('schEd open err', e && e.message); }
  const eh221 = String(elCache.modal && elCache.modal.__v || '');
  ok(eh221.indexOf('Мастер Два') >= 0, '221: выбрана бригада — её мастер в окне');
  ok(eh221.indexOf('Мастер Один') === -1 && eh221.indexOf('Слесарь Смоук') === -1, '221: выбрана бригада — чужих работников в окне нет');
  ok(eh221.indexOf('👥 Показано: бригада Мастер Два') >= 0, '221: над таблицей — плашка «Показано: бригада …»');
  try { P.schEdSaveAll(); } catch (e) { console.log('schEd save err', e && e.message); }
  ok(P.S.schEd === null && P.S.schEdMode === null, '221: «Сохранить» закрывает окно и сбрасывает режим');
  P.S.schMode = 'all';
  try { P.openSchEditorModal(); } catch (e) { console.log('schEd open err', e && e.message); }
  const eh221b = String(elCache.modal && elCache.modal.__v || '');
  ok(eh221b.indexOf('Мастер Один') >= 0 && eh221b.indexOf('Мастер Два') >= 0 && eh221b.indexOf('Слесарь Смоук') >= 0, '221: «Все бригады» — в окне все, как раньше');
  ok(eh221b.indexOf('👥 Показано:') === -1, '221: «Все бригады» — плашки нет');
  try { P.schEdSaveAll(); } catch (e) {}
  P.S.schMode = 'free';
  try { P.openSchEditorModal(); } catch (e) {}
  const eh221c = String(elCache.modal && elCache.modal.__v || '');
  ok(eh221c.indexOf('Мастер Один') === -1 && eh221c.indexOf('Мастер Два') === -1 && eh221c.indexOf('Слесарь Смоук') === -1, '221: «Только без бригады» — чужих строк нет');
  try { P.schEdSaveAll(); } catch (e) {}
  P.S.schMode = 'all';
  try { elCache.modal.style.width = ''; elCache.modal.style.maxWidth = ''; } catch (e) {}

  /* ---------- 223: загрузка = норма / исполнители; совместные — в один день ---------- */
  ok(P.workCrewCount({ crew_size: 2 }) === 2, '223: число исполнителей — из поля «Количество исполнителей»');
  ok(P.workCrewCount({ crew: [{ prof: 'x', count: 3 }] }) === 3, '223: число исполнителей — сумма по составу');
  ok(P.workCrewCount({ min_workers: 4 }) === 4 && P.workCrewCount({}) === 1, '223: число исполнителей — «мин.» из карточки, иначе 1');
  ok(Math.abs(P.taskHours({ m: 'm_smoke1', w: 'w7', o: 'o1', volume: 2 }) - 0.25) < 1e-6, '223: в карточке — общая норма (0,125 × 2 = 0,25 чел.-ч)');
  ok(Math.abs(P.taskDurHours({ m: 'm_smoke1', w: 'w7', o: 'o1', volume: 2 }) - 0.125) < 1e-6, '223: длительность задачи = норма × объём / исполнителей (0,25 / 2 = 0,125 ч)');
  P.S.tasks.push({ id: 't_dur_sm', name: 'ДлитСмоук', type: 'work', m: 'm_smoke2', w: 'w7', o: 'o1', s: 'plan', status: 'plan', volume: 10, d: 0, dl: 1, priority: 2, created_at: T0, seq: 1 });
  ok(Math.abs(P.loadForDay('m_smoke2', 0) - 0.625) < 1e-6, '223: загрузка дня мастера — длительностями (1,25 чел.-ч / 2 = 0,625 ч)');
  P.S.tasks = P.S.tasks.filter(function (x) { return x.id !== 't_dur_sm'; });
  // совместные: 2 работы по 6 ч (пометка «🤝») + одиночная 6 ч; ёмкость дня 8 ч —
  // после «Оптимизировать работы» совместные остаются в один день, одиночная — на другой
  const _tJA = { id: 't_jA_sm', name: 'СовмА', type: 'work', m: 'm_smoke2', w: 'w_j1', o: 'o_joint', s: 'plan', status: 'plan', volume: 1, d: 0, dl: 1, priority: 2, created_at: T0, seq: 1 };
  const _tJB = { id: 't_jB_sm', name: 'СовмБ', type: 'work', m: 'm_smoke2', w: 'w_j2', o: 'o_joint', s: 'plan', status: 'plan', volume: 1, d: 0, dl: 1, priority: 2, created_at: T0, seq: 1 };
  const _tBG = { id: 't_bg_sm', name: 'Одиночная', type: 'work', m: 'm_smoke2', w: 'w_big', o: 'o_joint', s: 'plan', status: 'plan', volume: 1, d: 0, dl: 1, priority: 2, created_at: T0, seq: 1 };
  const _tSL = { id: 't_alone_sm', name: 'ОдиночнаяЧужойОбъект', type: 'work', m: 'm_smoke2', w: 'w_big', o: 'o_alone', s: 'plan', status: 'plan', volume: 1, d: 0, dl: 1, priority: 2, created_at: T0, seq: 1 };
  P.S.tasks.push(_tJA, _tJB, _tBG, _tSL);
  try { P.optimizeWorksCalendar(); } catch (e) { console.log('optimize err', e && e.message); }
  ok(_tJA.d === _tJB.d, '223: совместные выполнения — в один день, хотя мастеру не хватает часов');
  ok(_tBG.d === _tJA.d, '230: работы ОДНОГО объекта — в один день (блок объекта), хоть мастеру и не хватает часов');
  ok(_tSL.d !== _tJA.d, '223/230: одиночная задача ДРУГОГО объекта ушла с переполненного дня (правило для одиночных не изменилось)');
  P.S.tasks = P.S.tasks.filter(function (x) { return ['t_jA_sm', 't_jB_sm', 't_bg_sm', 't_alone_sm'].indexOf(x.id) === -1; });
  (function () { try { var raw = JSON.parse(store.get('smartplan_tasks_db')); if (raw && raw.tasks) { raw.tasks = raw.tasks.filter(function (x) { return ['t_jA_sm', 't_jB_sm', 't_bg_sm', 't_alone_sm', 't_dur_sm'].indexOf(x.id) === -1; }); seed('smartplan_tasks_db', raw); } } catch (e) {} })();

  /* ---------- 224: задачи привязаны к календарной дате (якорь дня) ---------- */
  const _tA1 = sandbox.SP_TASKS.getTask('t_today1');
  const _dBefore = _tA1.d;
  // первый вызов: якоря нет — создаётся на сегодня, задачи НЕ сдвигаются
  let _rb1 = 0; try { _rb1 = P.rebaseTaskDaysToToday(); } catch (e) { console.log('rebase err', e && e.message); }
  const _anch = sandbox.SP_TASKS.getTask('t_day_anchor');
  ok(!!_anch && _anch.day_anchor === isoOf(0), '224: запись-якорь создана на сегодня');
  ok(_rb1 === 0 && _tA1.d === _dBefore, '224: первый запуск — задачи не сдвигаются');
  ok(!(sandbox.SP_TASKS.getTasks().some(function (x) { return x.id === 't_day_anchor'; })), '224: якорь не попадает в списки задач');
  // якорь «вчера» → наступил новый день: все смещения уменьшаются на 1 (задача остаётся на своей дате)
  sandbox.SP_TASKS.updateTask('t_day_anchor', { day_anchor: isoOf(-1) });
  try { P.rebaseTaskDaysToToday(); } catch (e) {}
  ok(_tA1.d === _dBefore - 1, '224: новый день — смещение уменьшилось на 1 (задача на своей дате)');
  ok(sandbox.SP_TASKS.getTask('t_day_anchor').day_anchor === isoOf(0), '224: якорь переставлен на сегодня');
  try { P.rebaseTaskDaysToToday(); } catch (e) {}
  ok(_tA1.d === _dBefore - 1, '224: повторный вызов в тот же день — ничего не двигает');
  sandbox.SP_TASKS.updateTask('t_today1', { d: _dBefore });

  /* ---------- 225: отмена последнего действия в планировании (как Ctrl+Z) ---------- */
  const _uT = sandbox.SP_TASKS.getTask('t_today1');
  const _uM0 = _uT.m, _uD0 = _uT.d;
  const _uStack = function () { return P.S.planUndo || []; };
  // перенос карточки на другого мастера/день
  try { P.moveTaskToCell('t_today1', { dataset: { master: 'm_smoke2', off: '3' } }); } catch (e) { console.log('move err', e && e.message); }
  ok(_uStack().length >= 1, '225: перед переносом сделан моментальный снимок');
  ok(_uT.m === 'm_smoke2' && _uT.d === 3, '225: перенос выполнен');
  try { P.planUndoApply(); } catch (e) { console.log('undo err', e && e.message); }
  const _uT2 = sandbox.SP_TASKS.getTask('t_today1');
  ok(_uT2.m === _uM0 && _uT2.d === _uD0, '225: «⟲ Отмена» вернула задачу на место');
  // оптимизация — одним снимком
  const _nUndo0 = _uStack().length;
  try { P.optimizeWorksCalendar(); } catch (e) {}
  ok(_uStack().length === _nUndo0 + 1, '225: «Оптимизировать работы» тоже кладёт снимок');
  try { P.planUndoApply(); } catch (e) {}
  // стек пуст → повторная отмена ничего не ломает
  const _len1 = _uStack().length;
  try { P.planUndoApply(); } catch (e) {}
  ok(_uStack().length <= _len1, '225: повторная отмена на пустом стеке — без сбоев');

  /* ---------- 226: копии графика при печати + восстановление ---------- */
  store.set('smartplan_graphs_cur', 'g_smoke');
  try { P.setScreen('graphs'); } catch (e) { console.log('graphs err', e && e.message); }
  const _gS = P.graphsFind('g_smoke');
  let _snap = null;
  try { _snap = P.graphSnapSave(_gS, 'смоук-печать'); } catch (e) { console.log('snap err', e && e.message); }
  ok(!!_snap && P.graphSnapsLoad('g_smoke').length === 1, '226: при печати графика сохраняется его полная копия');
  ok(_snap && _snap.graph && _snap.graph.id === 'g_smoke' && _snap.objsCount === (_gS.objs || []).length, '226: в копии — весь график (объекты и работы)');
  try { P.openGraphSnapsModal(); } catch (e) { console.log('snaps modal err', e && e.message); }
  const _snh = String(elCache.modal && elCache.modal.__v || '');
  ok(_snh.indexOf('Копии графика') >= 0 && _snh.indexOf('graph-snap-preview') >= 0 && _snh.indexOf('graph-snap-apply') >= 0, '226: окно копий — список с «Просмотр»/«Применить»');
  ok(_snh.indexOf('выстраиваются заново по датам') >= 0, '226/230: подсказка — задания выстраиваются по восстановленному графику');
  // «Применить» — график заменяется копией
  try { P.graphSnapApply(_snap.id); } catch (e) { console.log('snap apply err', e && e.message); }
  const _gS2 = P.graphsFind('g_smoke');
  ok(!!_gS2 && _gS2.restored_from === _snap.ts && _gS2.id === 'g_smoke', '226: «Применить» восстановило график из копии (та же ссылка-источник)');
  elCache.overlay.classList.remove('show');
  store.delete('smartplan_graphs_cur');

  /* ---------- 227: объект в двух графиках одного года — задачи не дублируются + предупреждение ---------- */
  (function () {
    // у объекта смоук-графика появляется oid; добавляем второй график с ТЕМ ЖЕ объектом и тем же годом
    var gl = P.graphsLoad();
    var g1 = null;
    for (var i = 0; i < gl.length; i++) if (gl[i].id === 'g_smoke') g1 = gl[i];
    g1.objs[0].oid = 'o_sm1';
    var gDup = { id: 'g_smoke_dup', name: 'Дубль график', year: Y, respName: 'Мастер Дымов', objs: [
      { oid: 'o_sm1', name: 'Смоук Объект Один', type: 'Просека', works: [] }
    ] };
    gl.push(gDup);
    try { P.graphsSaveList(gl); } catch (e) { console.log('saveList err', e && e.message); }

    var n0 = sandbox.SP_TASKS.getTasks().length;
    var wrk1 = { sid: 's_src', wid: 'w7', period: 400, dev: 0, first: isoOf(10), occs: [] };
    var st1 = P.gwGenObjSeries(g1, 0, 'УБиРОГС', g1.objs[0], wrk1, false);
    ok(st1.created === 1 && (st1.dup || 0) === 0, '227: первый график создал задачу серии (привязанных 0)');
    var tid1 = wrk1.occs[0] && wrk1.occs[0].tid;
    var wrkD = { sid: 's_dup', wid: 'w7', period: 400, dev: 0, first: isoOf(10), occs: [] };
    var st2 = P.gwGenObjSeries(gDup, 0, 'УБиРОГС', gDup.objs[0], wrkD, false);
    ok(st2.created === 0 && st2.dup === 1, '227: второй график — задача НЕ продублирована (привязана к существующей)');
    ok(wrkD.occs[0].tid === tid1, '227: вхождение второго графика ссылается на задачу первого');
    ok(sandbox.SP_TASKS.getTasks().length === n0 + 1, '227: в планировании осталась ОДНА задача вместо двух');
    // пересчёт года второго графика: «родная» задача первого графика не удаляется
    gDup.objs[0].works = [wrkD];
    var rs = P.graphYearResync(gDup, 'all');
    ok(!!sandbox.SP_TASKS.getTask(tid1), '227: пересчёт года другого графика не удалил задачу первого');
    ok((rs.created || 0) === 0 && (rs.dup || 0) === 1 && wrkD.occs[0].tid === tid1, '227: после пересчёта — снова привязка, без дубля');
    // плашка-предупреждение справа внизу
    P.GS.cur = 'g_smoke';
    P.S.graphDupWarnHidden = false;
    var wh = P.graphsDupWarnHtml();
    ok(wh.indexOf('graph-dup-warn') >= 0 && wh.indexOf('Дубль график') >= 0 && wh.indexOf('Мастер Дымов') >= 0 && wh.indexOf(String(Y)) >= 0, '227: предупреждение — название другого графика, год, ФИО мастера');
    P.S.graphDupWarnHidden = true;
    ok(P.graphsDupWarnHtml() === '', '227: крестик скрывает предупреждение до перезахода на страницу');
    P.S.graphDupWarnHidden = false;
    // без дубль-графика предупреждения нет
    P.graphsSaveList(P.graphsLoad().filter(function (x) { return x.id !== 'g_smoke_dup'; }));
    ok(P.graphsDupWarnHtml() === '', '227: дублей нет — предупреждение не показывается');
    try { sandbox.SP_TASKS.hardDeleteTask(tid1); } catch (e) {}
  })();

  /* ---------- 229: групповое изменение видов работ ---------- */
  (function () {
    var WK = sandbox.SP_WORK;
    // исходники для отката
    var _ow7 = WK.getWork('УБиРОГС', 'w7');
    var _oj1 = WK.getWork('УБиРОГС', 'w_j1');
    var _o7 = { norm: _ow7.norm, season: _ow7.season, min_temp: _ow7.min_temp, group: _ow7.group };
    var _o1 = { norm: _oj1.norm, season: _oj1.season, min_temp: _oj1.min_temp, joint_with: (_oj1.joint_with || []).slice() };
    P.S.role = 'admin';
    P.S.refsTab = 'tree';
    P.S.workArea = 'УБиРОГС';
    P.S.wsel = {};
    P.renderRefs();
    var rh = viewHtml();
    ok(rh.indexOf('data-action="wsel-toggle"') >= 0 && rh.indexOf('data-action="grp-selall"') >= 0 && rh.indexOf('☑ Групповое изменение') >= 0, '229: галочки у работ, ☑ у групп и кнопка «Групповое изменение»');
    // ☑ у группы — все её работы сразу
    P.grpSelAll('Тест совместных');
    ok(P.wselSelCount() === 3, '229: ☑ у группы отметил все её работы (3 шт.)');
    ok(viewHtml().indexOf('wsel-bar') >= 0 && viewHtml().indexOf('✏ Изменить выбранные') >= 0, '229: панель «Выбрано… Изменить выбранные» появилась внизу');
    P.grpSelAll('Тест совместных');
    ok(P.wselSelCount() === 0 && viewHtml().indexOf('wsel-bar') === -1, '229: повторный ☑ снял отметку — панель скрылась');
    // окно групповой правки — участок УБиРОГС: атрибуты как в карточке УБиРОГС (237)
    P.S.wsel = { w7: 1, w_j1: 1, w_j2: 1 };
    P.openWorkBulkModal();
    var mh229 = String(elCache.modal && elCache.modal.__v || '');
    ok(mh229.indexOf('Групповое изменение работ · 3 шт.') >= 0 && mh229.indexOf('wb-on-season') >= 0 && mh229.indexOf('wb-on-needs_permit') >= 0 && mh229.indexOf('wb-on-depends_on_snow') >= 0, '229/237: окно правки УБиРОГС — атрибуты УБиРОГС (ордер, снегопад, сезон…)');
    ok(mh229.indexOf('wbulk-j-replace') < 0 && mh229.indexOf('wb-on-norm') < 0, '229/237: у УБиРОГС нет нормы и связей — их нет и в карточке УБиРОГС');
    // применение атрибутов УБиРОГС (сезон, температура); «чужая» норма не применяется
    var geb = function (id) { return documentStub.getElementById(id); };
    geb('wb-on-season').checked = true; geb('wb-v-season').value = 'Зима';
    geb('wb-on-min_temp').checked = true; geb('wb-v-min_temp').value = '-10';
    geb('wb-on-norm').checked = true; geb('wb-v-norm').value = '0,25';
    var _n7 = WK.getWork('УБиРОГС', 'w7').norm;
    P.workBulkApply('');
    var w7n = WK.getWork('УБиРОГС', 'w7'), wj1n = WK.getWork('УБиРОГС', 'w_j1'), wbn = WK.getWork('УБиРОГС', 'w_big');
    ok(w7n.season === 'Зима' && w7n.min_temp === -10 && wj1n.season === 'Зима' && wj1n.min_temp === -10, '229: сезон/температура применились ко всем выбранным');
    ok(w7n.norm === _n7, '237: норма (атрибут ГРП) у работ УБиРОГС не изменилась');
    ok(wbn.season !== 'Зима', '229: невыбранная работа не изменилась');
    // связи «Проводится совместно» — атрибут ГРП: у УБиРОГС не применяются
    var _jw0 = JSON.stringify(WK.getWork('УБиРОГС', 'w_j1').joint_with || []);
    geb('wb-on-joint').checked = true;
    P.S.wmBulkJoint = ['ГруппаДым'];
    P.workBulkApply('replace');
    ok(JSON.stringify(WK.getWork('УБиРОГС', 'w_j1').joint_with || []) === _jw0, '237: связи у УБиРОГС не тронуты (только у ГРП)');
    geb('wb-on-joint').checked = false; P.S.wmBulkJoint = [];
    // перемещение в другую группу
    P.S.wsel = { w7: 1 };
    ['wb-on-season', 'wb-on-min_temp', 'wb-on-norm', 'wb-on-joint'].forEach(function (id) { geb(id).checked = false; });
    geb('wb-on-group').checked = true; geb('wb-group-group').value = 'НоваяГруппа';
    P.workBulkApply('');
    ok(String(WK.getWork('УБиРОГС', 'w7').group).indexOf('НоваяГруппа') >= 0, '229: работа перемещена в другую группу');
    geb('wb-on-group').checked = false;
    // откат сидов
    WK.updateWork('УБиРОГС', 'w7', { norm: _o7.norm, season: _o7.season, min_temp: _o7.min_temp, group: _o7.group });
    WK.updateWork('УБиРОГС', 'w_j1', { norm: _o1.norm, season: _o1.season, min_temp: _o1.min_temp, joint_with: _o1.joint_with });
    WK.updateWork('УБиРОГС', 'w_j2', { norm: 6, season: 'Круглый год', min_temp: -50 });
    P.S.wsel = {};
  })();

  /* ---------- 230: восстановление графика из копии — задания выстраиваются по графику ---------- */
  (function () {
    var T = sandbox.SP_TASKS;
    var undo0 = (P.S.planUndo || []).length;
    var g230 = { id: 'g_230', name: 'График 230', year: Y, respId: 'm_smoke1', objs: [
      { oid: 'o_230', name: 'Объект 230', type: 'ГРП', works: [
        { sid: 's230', wid: 'w7', period: 400, dev: 0, first: isoOf(15), occs: [{ date: isoOf(15), wid: 'w7', tid: 't_old230' }] }
      ] }
    ] };
    T.addTask({ id: 't_old230', type: 'work', m: 'm_smoke1', o: 'o_230', w: 'w7', s: 'plan', status: 'plan', volume: 1, d: 40, dl: 41, dl_date: isoOf(41) }); // «съехавшая» с даты графика
    var gl = P.graphsLoad(); gl.push(g230); P.graphsSaveList(gl);
    var snap = P.graphSnapSave(P.graphsFind('g_230'), 'смоук-230');
    g230.objs[0].works = []; // график «испорчен» относительно копии
    P.graphsSaveList(P.graphsLoad().map(function (x) { return x.id === 'g_230' ? g230 : x; }));
    P.GS.cur = 'g_230';
    try { P.graphSnapApply(snap.id); } catch (e) { console.log('snap apply 230 err', e && e.message); }
    var t230 = T.getTasks().filter(function (x) { return x.o === 'o_230' && x.w === 'w7'; });
    var g230r = P.graphsFind('g_230');
    var occDate = g230r && g230r.objs[0] && g230r.objs[0].works[0] && g230r.objs[0].works[0].occs[0] ? g230r.objs[0].works[0].occs[0].date : '?';
    ok(t230.length === 1 && P.key(P.offToDate(t230[0].d)) === occDate && t230[0].d !== 40, '230: задание выстроено по дате восстановленного графика (' + occDate + '), а не на съехавшей дате');
    ok((P.S.planUndo || []).length === undo0 + 1, '230: перед восстановлением сделан снимок для «⟲ Отмена»');
    try { P.planUndoApply(); } catch (e) {}
    P.graphsSaveList(P.graphsLoad().filter(function (x) { return x.id !== 'g_230'; }));
    (T.getTasks() || []).filter(function (x) { return x.o === 'o_230'; }).forEach(function (x) { try { T.hardDeleteTask(x.id); } catch (e) {} });
    try { T.hardDeleteTask('t_old230'); } catch (e) {}
    P.GS.cur = null;
  })();

  /* ---------- 231: «Отмена последнего действия» + облачный фон прогноза ---------- */
  (function () {
    var ch = P.wxBlurCloudsHtml(26);
    ok(ch.indexOf('wx-bgclouds') >= 0 && (ch.split('wx-cloud').length - 1) === 26, '231: фон прогноза — размытые облачка во весь блок, облачков больше (26 шт.)');
    ok(ch.indexOf('wxCloudRight') >= 0 && ch.indexOf('wxCloudLeft') >= 0, '231: облачка плывут той же анимацией, что над карточками');
    var dd = documentStub.getElementById('weather-dropdown');
    dd.classList = { contains: function () { return false; }, add: noop, remove: noop };
    try { P.toggleWeatherDropdown(); } catch (e) { console.log('wx dd err', e && e.message); }
    ok(String(dd.__v).indexOf('wd-day') >= 0 && String(dd.__v).indexOf('open-hourly') >= 0, '231: карточки прогноза погоды открываются');
  })();

  /* ---------- 232: общий лог ошибок со всех устройств ---------- */
  (function () {
    var E = sandbox.window.SP_ERRORS;
    ok(typeof E.push === 'function', '232: у лога ошибок есть отправка на сервер (push)');
    ok(typeof sandbox.window.SP_API.errorsPush === 'function' && typeof sandbox.window.SP_API.errorsGet === 'function' && typeof sandbox.window.SP_API.errorsClear === 'function', '232: SP_API умеет общий лог (push/get/clear)');
    E.clear();
    E.log('warn', 'smoke.232', 'проверка общего лога');
    var arr = E.getAll();
    ok(arr.length === 1 && arr[0].msg === 'проверка общего лога', '232: запись пишется в локальный резерв');
    ok(typeof arr[0].device === 'string' && arr[0].device.length > 0, '232: у записи есть устройство (' + arr[0].device + ')');
    ok(/^22\.09-\d+$/.test(arr[0].build || ''), '232: у записи есть версия сборки (' + arr[0].build + ')');
    ok(arr[0].synced === false, '232: новая запись ждёт отправки на сервер');
    E.clear();
    ok(E.getAll().length === 0, '232: локальный резерв очищается');
  })();

  /* ---------- 233: техническая чистка — заголовки страниц остались на месте ---------- */
  (function () {
    ok(P.TITLES && P.TITLES.dashboard === 'Панель мониторинга' && P.TITLES.refs === 'Справочники' && P.TITLES.schedules === 'Графики смен' && P.TITLES.backup === 'Бэкапы баз данных', '233: заголовки страниц на месте после чистки');
    var tEl = documentStub.getElementById('screen-title');
    tEl.textContent = '';
    try { P.setScreen('refs'); } catch (e) { console.log('refs render err 233', e && e.message); }
    ok(tEl.textContent === 'Справочники', '233: шапка страницы берёт заголовок из TITLES');
    var crEl = documentStub.getElementById('screen-crumb');
    ok(String(crEl.textContent).indexOf('Сборка 22.09-') === 0, '233: в шапке — номер текущей сборки');
  })();

  /* ---------- 234: BRouter — сперва через наш сервер, запасной путь напрямую ---------- */
  (function () {
    ok(typeof P.brouterCarDayRoute === 'function', '234: модуль расчёта маршрута на месте');
    var src = String(P.brouterCarDayRoute);
    ok(src.indexOf('/api/route/brouter?') >= 0, '234: расчёт сперва идёт через наш сервер (прокси)');
    ok(src.indexOf('https://brouter.de/brouter?') >= 0, '234: запасной прямой вызов оставлен');
    ok(src.indexOf('handle(res1)') >= 0 && src.indexOf('handle(res2)') >= 0, '234: оба пути ведут в единый разбор ответа');
  })();

  /* ---------- 235: просмотр копии графика — окно в виде самого графика ---------- */
  (function () {
    var g235 = { id: 'g_235', name: 'График 235', year: Y, area: 'УБиРОГС', respId: 'm_smoke1', respName: 'Мастер Смоук', objs: [
      { oid: 'o_235a', name: 'ГРП-235, ул. Тестовая, 1', type: 'ГРП', works: [
        { sid: 's235', wid: 'w7', period: 3, dev: 0, first: '', occs: [{ date: Y + '-02-10', wid: 'w7' }, { date: Y + '-05-12', wid: 'w7' }] }
      ] },
      { oid: 'o_235b', name: 'ГРП-скрытый', type: 'ГРП', hide: true, works: [] }
    ] };
    var gl = P.graphsLoad(); gl.push(g235); P.graphsSaveList(gl);
    P.GS.cur = 'g_235';
    var sn = P.graphSnapSave(P.graphsFind('g_235'), 'смоук-235');
    var m2 = documentStub.getElementById('modal2');
    try { P.openGraphSnapPreviewModal(sn.id); } catch (e) { console.log('preview 235 err', e && e.message); }
    var hv = String(m2.__v || '');
    ok(hv.indexOf('gw-grid') >= 0 && hv.indexOf('gw-corner') >= 0 && hv.indexOf('Январь') >= 0 && hv.indexOf('Декабрь') >= 0, '235: просмотр копии — таблица графика «объекты × месяцы»');
    ok(hv.indexOf('ГРП-235, ул. Тестовая, 1') >= 0 && (hv.split('gw-tri-w').length - 1) === 2, '235: в просмотре — объекты и треугольники работ, как в графике');
    ok(hv.indexOf('gt-mid') >= 0 && hv.indexOf('График 235') >= 0 && hv.indexOf('Мастер Смоук') >= 0, '235: шапка как у графика — год, мастер, наименование');
    ok(hv.indexOf('gw-ro') >= 0 && hv.indexOf('data-action="graphs-obj-month"') < 0 && hv.indexOf('data-action="graphs-month-view"') < 0, '235: только просмотр — ячейки и месяцы не нажимаются');
    ok(hv.indexOf('ГРП-скрытый') < 0 && hv.indexOf('Объектов скрыто фильтром графика: 1') >= 0, '235: скрытые фильтром объекты — как в графике, с пометкой');
    ok(hv.indexOf('Обозначения работ') >= 0 && hv.indexOf('data-action="graph-snap-apply"') >= 0, '235: обозначения работ и кнопка «Применить эту копию»');
    ok(String(m2.style.width).indexOf('1500px') >= 0, '235: окно просмотра — широкое, во всю страницу');
    var mainH = P.gwYearGridHtml(P.graphsFind('g_235'), false);
    ok(mainH.indexOf('data-action="graphs-obj-month"') >= 0 && mainH.indexOf('gw-ro') < 0, '235: на странице «График работ» ячейки по-прежнему нажимаются');
    P.graphsSaveList(P.graphsLoad().filter(function (x) { return x.id !== 'g_235'; }));
    P.GS.cur = null;
  })();

  /* ---------- 236: копии графика — «Первая итерация», «Вторая итерация», … ---------- */
  (function () {
    ok(P.snapIterLabel(1) === 'Первая итерация' && P.snapIterLabel(2) === 'Вторая итерация' && P.snapIterLabel(3) === 'Третья итерация', '236: подписи «Первая/Вторая/Третья итерация»');
    ok(P.snapIterLabel(21) === 'Двадцать первая итерация' && P.snapIterLabel(40) === 'Сороковая итерация' && P.snapIterLabel(123) === 'Сто двадцать третья итерация', '236: составные порядковые (21, 40, 123) — грамотно');
    var g236 = { id: 'g_236', name: 'График 236', year: Y, area: 'УБиРОГС', respId: 'm_smoke1', respName: 'Мастер Смоук', objs: [
      { oid: 'o_236', name: 'ГРП-236', type: 'ГРП', works: [{ sid: 's236', wid: 'w7', period: 3, dev: 0, first: '', occs: [{ date: Y + '-03-03', wid: 'w7' }] }] }
    ] };
    var gl = P.graphsLoad(); gl.push(g236); P.graphsSaveList(gl);
    P.GS.cur = 'g_236';
    var s1 = P.graphSnapSave(P.graphsFind('g_236'), 'печать графика');
    var s2 = P.graphSnapSave(P.graphsFind('g_236'), 'печать графика');
    ok(s1 && s1.iter === 1 && s2 && s2.iter === 2, '236: первая сохранённая копия — №1, следующая — №2');
    try { P.openGraphSnapsModal(); } catch (e) { console.log('snaps 236 err', e && e.message); }
    var lh = String(elCache.modal && elCache.modal.__v || '');
    ok(lh.indexOf('Первая итерация') >= 0 && lh.indexOf('Вторая итерация') >= 0, '236: в списке копий — «Первая итерация» и «Вторая итерация»');
    ok(lh.indexOf('data-sid="' + s2.id + '"') >= 0 && lh.indexOf('data-sid="' + s2.id + '"') < lh.indexOf('data-sid="' + s1.id + '"'), '236: порядок списка прежний — новые сверху');
    try { P.openGraphSnapPreviewModal(s1.id); } catch (e) {}
    ok(String(documentStub.getElementById('modal2').__v || '').indexOf('Первая итерация — копия графика от') >= 0, '236: окно просмотра подписано номером итерации');
    // вытеснение старых (хранится до 20) — номера не сдвигаются
    for (var k = 0; k < 20; k++) P.graphSnapSave(P.graphsFind('g_236'), 'печать графика');
    var arr = P.graphSnapsLoad('g_236');
    ok(arr.length === 20 && arr[0].iter === 22 && arr[19].iter === 3, '236: после вытеснения старых номера не сдвигаются (сверху «22-я», снизу «3-я»)');
    ok(P.graphSnapSave(P.graphsFind('g_236'), 'печать графика').iter === 23, '236: следующая копия продолжает счёт (№23)');
    // копии, сохранённые до сборки 236 (без номера), — номера по времени сохранения
    var all = JSON.parse(store.get('smartplan_graph_snaps_v1') || '{}');
    all.g_236_old = [
      { id: 'sn_c', ts: 3000, via: 'печать', graph: g236 },
      { id: 'sn_b', ts: 2000, via: 'печать', graph: g236 },
      { id: 'sn_a', ts: 1000, via: 'печать', graph: g236 }
    ];
    store.set('smartplan_graph_snaps_v1', JSON.stringify(all));
    var old = P.graphSnapsLoad('g_236_old');
    var byId = {}; old.forEach(function (x) { byId[x.id] = x.iter; });
    ok(byId.sn_a === 1 && byId.sn_b === 2 && byId.sn_c === 3, '236: старые копии без номера пронумерованы по времени (самая ранняя — «Первая итерация»)');
    var again = JSON.parse(store.get('smartplan_graph_snaps_v1') || '{}').g_236_old || [];
    ok(again.every(function (x) { return +x.iter > 0; }), '236: номера старых копий сохранены (больше не меняются)');
    var all2 = JSON.parse(store.get('smartplan_graph_snaps_v1') || '{}'); delete all2.g_236; delete all2.g_236_old;
    store.set('smartplan_graph_snaps_v1', JSON.stringify(all2));
    P.graphsSaveList(P.graphsLoad().filter(function (x) { return x.id !== 'g_236'; }));
    P.GS.cur = null;
    elCache.overlay.classList.remove('show');
  })();

  /* ---------- 237: групповое изменение — атрибуты как в карточке выбранного участка ---------- */
  (function () {
    var WK = sandbox.SP_WORK;
    var geb = function (id) { return documentStub.getElementById(id); };
    P.S.role = 'admin'; P.S.refsTab = 'tree';
    // --- ГРП ---
    var g1 = WK.addWork('ГРП', { name: 'Групповая ГРП 1', group: 'Г237', norm: 1, unit: 'объект', object_categories: ['ГРП'], operations: ['Осмотр'] });
    var g2 = WK.addWork('ГРП', { name: 'Групповая ГРП 2', group: 'Г237', norm: 1, unit: 'объект', object_categories: ['ШРП'] });
    var g3 = WK.addWork('ГРП', { name: 'Групповая ГРП 3 (не выбрана)', group: 'Г237', norm: 1 });
    P.S.workArea = 'ГРП';
    P.S.wsel = {}; P.S.wsel[g1.id] = 1; P.S.wsel[g2.id] = 1;
    P.openWorkBulkModal();
    var mh = String(elCache.modal && elCache.modal.__v || '');
    ok(mh.indexOf('📋 Атрибуты ГРП') >= 0 && mh.indexOf('Групповое изменение работ · 2 шт. · ГРП') >= 0, '237: ГРП — окно с блоком «📋 Атрибуты ГРП»');
    ok(['norm', 'unit', 'object_categories', 'departments', 'season', 'periodicity_value', 'periodicity_dev', 'periodicity_basis', 'operations', 'lines_count', 'telemetry_req', 'telemetry_type', 'diag_equipment', 'heating_req', 'crew_size', 'crew', 'indicators', 'print_forms', 'op_journal', 'passport_entry', 'scan_attach'].every(function (k) { return mh.indexOf('id="wb-on-' + k + '"') >= 0; }), '237: ГРП — все атрибуты карточки ГРП (21 шт.)');
    ok(mh.indexOf('wb-on-needs_permit') < 0 && mh.indexOf('wb-on-min_temp') < 0 && mh.indexOf('wb-on-equipment') < 0, '237: ГРП — без атрибутов УБиРОГС (ордер, температура, техника)');
    ok(mh.indexOf('wbulk-j-replace') >= 0 && mh.indexOf('wbulk-j-add') >= 0 && mh.indexOf('id="wm-crew-rows"') >= 0, '237: ГРП — связи «Проводится совместно» и редактор состава бригады');
    // применение
    geb('wb-on-norm').checked = true; geb('wb-v-norm').value = '0,2';
    geb('wb-on-periodicity_value').checked = true; geb('wb-v-periodicity_value').value = '6';
    geb('wb-on-periodicity_basis').checked = true; geb('wb-v-periodicity_basis').value = 'commissioning_date';
    geb('wb-on-diag_equipment').checked = true; geb('wb-v-diag_equipment').value = '1';
    geb('wb-on-operations').checked = true; geb('wb-v-operations').value = 'Проверка, Осмотр'; geb('wb-m-operations').value = 'add';
    geb('wb-on-crew_size').checked = true; geb('wm-crew-size').value = '3';
    geb('wb-on-object_categories').checked = true; geb('wb-m-object_categories').value = 'add';
    var _qsa = documentStub.querySelectorAll;
    documentStub.querySelectorAll = function (sel) {
      if (sel === '[data-wbm="object_categories"]') return [{ checked: true, getAttribute: function () { return 'ГРС'; } }, { checked: false, getAttribute: function () { return 'Иное'; } }];
      return _qsa.call(documentStub, sel);
    };
    try { P.workBulkApply(''); } finally { documentStub.querySelectorAll = _qsa; }
    var r1 = WK.getWork('ГРП', g1.id), r2 = WK.getWork('ГРП', g2.id), r3 = WK.getWork('ГРП', g3.id);
    ok(Math.abs(r1.norm - 0.2) < 1e-9 && Math.abs(r2.norm - 0.2) < 1e-9, '237: норма (с запятой) — у обеих выбранных работ ГРП');
    ok(r1.periodicity_value === 6 && r2.periodicity_basis === 'commissioning_date', '237: периодичность и реквизит отсчёта применились');
    ok(r1.diag_equipment === true && r2.diag_equipment === true, '237: «Да/Нет» — диагностическое оборудование');
    ok(JSON.stringify(r1.operations) === JSON.stringify(['Осмотр', 'Проверка']) && JSON.stringify(r2.operations) === JSON.stringify(['Проверка', 'Осмотр']), '237: список «Операции» — добавлено к имеющимся без дублей');
    ok(JSON.stringify(r1.object_categories) === JSON.stringify(['ГРП', 'ГРС']) && JSON.stringify(r2.object_categories) === JSON.stringify(['ШРП', 'ГРС']), '237: категории — отмеченная добавлена к имеющимся');
    ok(r1.crew_size === 3 && r1.min_workers === 3 && r1.opt_workers === 3, '237: кол-во исполнителей — как в карточке (мин/опт = общему)');
    ok(r3.norm === 1 && !r3.diag_equipment, '237: невыбранная работа ГРП не изменилась');
    // «убрать указанные» и связи у ГРП
    ['wb-on-norm', 'wb-on-periodicity_value', 'wb-on-periodicity_basis', 'wb-on-diag_equipment', 'wb-on-crew_size', 'wb-on-object_categories'].forEach(function (id) { geb(id).checked = false; });
    geb('wb-m-operations').value = 'remove'; geb('wb-v-operations').value = 'Осмотр';
    P.workBulkApply('');
    ok(JSON.stringify(WK.getWork('ГРП', g1.id).operations) === JSON.stringify(['Проверка']), '237: «убрать указанные» — значение убрано из списка');
    geb('wb-on-operations').checked = false;
    geb('wb-on-joint').checked = true; P.S.wmBulkJoint = ['Г237-связь'];
    P.workBulkApply('add');
    ok((WK.getWork('ГРП', g2.id).joint_with || []).indexOf('Г237-связь') >= 0, '237: у ГРП «Добавить связи» работает');
    P.workBulkApply('replace');
    ok(JSON.stringify(WK.getWork('ГРП', g1.id).joint_with || []) === JSON.stringify(['Г237-связь']), '237: у ГРП «Заменить связи» работает');
    geb('wb-on-joint').checked = false; P.S.wmBulkJoint = [];
    // --- прочий участок: собственных атрибутов в карточке нет — только структура ---
    var o1 = WK.addWork('Прочий 237', { name: 'Работа прочего участка', group: 'ГП237' });
    P.S.workArea = 'Прочий 237';
    P.S.wsel = {}; P.S.wsel[o1.id] = 1;
    P.openWorkBulkModal();
    var mo = String(elCache.modal && elCache.modal.__v || '');
    ok(mo.indexOf('нет собственных атрибутов') >= 0 && mo.indexOf('wb-on-season') < 0 && mo.indexOf('wb-on-norm') < 0 && mo.indexOf('wbulk-j-add') < 0, '237: прочий участок — только «Структура» (атрибутов в карточке нет)');
    geb('wb-on-sub').checked = true; geb('wb-sub-group').value = 'Зима';
    P.workBulkApply('');
    ok(WK.getWork('Прочий 237', o1.id).group === 'ГП237 / Зима', '237: подгруппа задаётся группой (структура «Группа / Подгруппа»)');
    geb('wb-on-sub').checked = false;
    // уборка
    [g1, g2, g3].forEach(function (w) { try { WK.deleteWork('ГРП', w.id); } catch (e) {} });
    try { WK.deleteWork('Прочий 237', o1.id); } catch (e) {}
    P.S.wsel = {}; P.S.workArea = 'УБиРОГС';
    elCache.overlay.classList.remove('show');
  })();

  console.log('----------------------------------------');
  console.log('SMOKE TOTAL: ' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('SMOKE CRASH:', e && e.stack || e); process.exit(1); });
