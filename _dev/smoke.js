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
seed('smartplan_users_db', { schema: 3, users: [
  { id: 'a_admin', login: 'admin', password: 'x', plain_password: 'x', full_name: 'Админ Смоук', role: 'admin', area: 'Все участки', color: '#0f2740', active: true },
  { id: 'm_smoke1', login: 'm1', password: 'x', full_name: 'Мастер Один', role: 'master', area: 'УБиРОГС', color: '#15803d', active: true },
  { id: 'm_smoke2', login: 'm2', password: 'x', full_name: 'Мастер Два', role: 'master', area: 'УБиРОГС', color: '#1d4ed8', active: true },
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
      code = code.slice(0, pos) + ';window.__probe={S:S,GS:GS,TITLES:TITLES,refresh:refresh,renderDashboard:renderDashboard,visibleMasters:visibleMasters,enterApp:enterApp,setScreen:setScreen,kpiTasks:kpiTasks,kpiMasters:kpiMasters,dayTaskSort:dayTaskSort,_drawCalendarGridImpl:_drawCalendarGridImpl,fmtH3:fmtH3,openGraphLaborModal:openGraphLaborModal,gwWorkTipHtml:gwWorkTipHtml,graphsFind:graphsFind,schDayHours:schDayHours,openWorkModal:openWorkModal,openWmJointPickModal:openWmJointPickModal,wmJointSelBoxHtml:wmJointSelBoxHtml,openSchEditorModal:openSchEditorModal,schEdToggleCell:schEdToggleCell,schEdApplyAction:schEdApplyAction,schEdPatternShift:schEdPatternShift,schEdShiftRemove:schEdShiftRemove,schEdSaveAll:schEdSaveAll,wkCycleFrom:wkCycleFrom,gwJointAlign:gwJointAlign,gprFirstFromServiceLife:gprFirstFromServiceLife,gwGenObjSeries:gwGenObjSeries,gwNextISO:gwNextISO,gprRowHtml:gprRowHtml,wkDayState:wkDayState,masterCapacity:masterCapacity,offToDate:offToDate,schCellHtml:schCellHtml,openSchDayEditModal:openSchDayEditModal,schDayEditSave:schDayEditSave,key:key};' + code.slice(pos);
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
  const SCREENS = ['dashboard','calendar','graphs','map','objmap','testmap','testdep','livemap','perms','refs','writeoffs','workcards','factmonth','workers','schedules','users','reports','logs'];
  for (const s of SCREENS) {
    try { P.setScreen(s); if (s === 'calendar') P._drawCalendarGridImpl(); }
    catch (e) { scrErrs.push(s + ': ' + (e && e.message || e)); }
  }
  ok(scrErrs.length === 0, 'свайп 18 экранов без ошибок' + (scrErrs.length ? ' -> ' + scrErrs.join(' | ') : ''));

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

  /* ---------- 211: окно редактора графика смен ---------- */
  try { P.openSchEditorModal('m_smoke2'); } catch (e) { console.log('schEd open err', e && e.message); }
  let eh = String(elCache.modal && elCache.modal.__v || '');
  ok(eh.indexOf('Изменение графика смен') >= 0 && eh.indexOf('💾 Сохранить') >= 0, '211: окно редактора открывается (есть «Сохранить»)');
  ok(eh.indexOf('Сдвиг всего графика') === -1, '211: у графика 5/2 блока сдвига цикла нет');
  // 212: окно выглядит как общая таблица «Графики смен», в квадратиках — часы
  ok(eh.indexOf('<table') >= 0 && eh.indexOf('Бригада / работник') >= 0, '212: в окне таблица как в «Графиках смен»');
  ok(eh.indexOf('data-sch-day=') >= 0, '212: редактируемая строка содержит ячейки дней');
  ok(eh.indexOf('>8,25<') >= 0 && eh.indexOf('>12<') >= 0 && eh.indexOf('>11,5<') >= 0, '212: в квадратиках написаны часы (8,25 / 12 / 11,5)');
  // черновик → Сохранить: выходной день делаем рабочим с 6 ч
  sandbox.SP_WORKERS.setDayOverride('m_smoke2', satIso, null);
  try { P.openSchEditorModal('m_smoke2'); } catch (e) {}
  P.schEdToggleCell('m_smoke2', satIso);
  documentStub.getElementById('sch-ed-hours').value = '6';
  P.schEdApplyAction('work');
  ok(Object.keys(P.S.schEdAll['m_smoke2'].draft).length === 1, '211: действие — в черновике');
  ok(!(sandbox.SP_WORKERS.getWorker('m_smoke2').overrides || {})[satIso], '211: до «Сохранить» данные не меняются');
  P.schEdSaveAll();
  let ov2 = (sandbox.SP_WORKERS.getWorker('m_smoke2').overrides || {})[satIso];
  ok(ov2 && ov2.s === 'work' && ov2.h === 6, '211: «Сохранить» применило: суббота — рабочая, 6 ч');
  // перенос дня: суббота → воскресенье (5/2, кнопкой +1)
  try { P.openSchEditorModal('m_smoke2'); } catch (e) {}
  P.schEdToggleCell('m_smoke2', satIso);
  P.schEdApplyAction('moveR');
  P.schEdSaveAll();
  ov2 = (sandbox.SP_WORKERS.getWorker('m_smoke2').overrides || {})[satIso];
  const sunIso = (function () { const d = new Date(satIso + 'T00:00:00'); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); })();
  let ov3 = (sandbox.SP_WORKERS.getWorker('m_smoke2').overrides || {})[sunIso];
  ok(ov2 && ov2.s === 'off' && ov3 && ov3.s === 'work' && ov3.h === 6, '211: перенос рабочего дня кнопкой (+1 день)');
  sandbox.SP_WORKERS.setDayOverride('m_smoke2', satIso, null);
  sandbox.SP_WORKERS.setDayOverride('m_smoke2', sunIso, null);
  // мастер 2/2: сдвиг ВСЕГО графика
  try { P.openSchEditorModal('m_smoke1'); } catch (e) {}
  eh = String(elCache.modal && elCache.modal.__v || '');
  ok(eh.indexOf('Сдвиг всего графика') >= 0, '211: у графика 2/2 есть блок сдвига всего графика');
  let bnd = null;
  for (let i = 3; i < 30; i++) {
    const d2 = isoOf(i), d1 = isoOf(i - 1);
    const ovr = sandbox.SP_WORKERS.getWorker('m_smoke1').overrides || {};
    if (ovr[d2] || ovr[d1]) continue;
    if (P.wkDayState('m_smoke1', d2) === 'work' && P.wkDayState('m_smoke1', d1) === 'off') { bnd = d2; break; }
  }
  ok(!!bnd, '211: найдена граница цикла (' + bnd + ')');
  P.schEdPatternShift(1);
  P.schEdSaveAll();
  const hist1 = sandbox.SP_WORKERS.getWorker('m_smoke1').cycleHist || [];
  ok(hist1.length === 1 && hist1[0].from === isoOf(0), '211: сдвиг записан (cycleHist, с сегодняшнего дня)');
  ok(P.wkDayState('m_smoke1', bnd) === 'off', '211: весь график передвинулся следом');
  try { P.openSchEditorModal('m_smoke1'); } catch (e) {}
  P.schEdShiftRemove(hist1[0].from);
  P.schEdSaveAll();
  ok((sandbox.SP_WORKERS.getWorker('m_smoke1').cycleHist || []).length === 0, '211: сдвиг удалён');
  ok(P.wkDayState('m_smoke1', bnd) === 'work', '211: график вернулся как был');

  console.log('----------------------------------------');
  console.log('SMOKE TOTAL: ' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('SMOKE CRASH:', e && e.stack || e); process.exit(1); });
