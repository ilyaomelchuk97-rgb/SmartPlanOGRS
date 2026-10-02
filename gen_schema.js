// Генератор схемы БД SmartPlan (сборка 22.09-139): статичный SVG + HTML-обёртка.
// Связи — ортогональные (только 90°), ключи 🔑/🔗, цветные смысловые блоки.
const fs = require('fs');

const RH = 22, HH = 30, PAD = 10;
const W = 1740, H = 1258;

const GROUPS = {
  ref:  { title: 'СПРАВОЧНИКИ', color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
  obj:  { title: 'ОБЪЕКТЫ ГАЗОРАСПРЕДЕЛЕНИЯ', color: '#ea580c', bg: '#ffedd5', border: '#fdba74' },
  plan: { title: 'ПЛАНИРОВАНИЕ РАБОТ', color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd' },
  pers: { title: 'ПЕРСОНАЛ', color: '#2563eb', bg: '#dbeafe', border: '#93c5fd' },
  aux:  { title: 'СЛУЖЕБНЫЕ (автономные, без связей)', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' }
};

// rows: [поле, тип/ограничение, ключ: 'pk'|'fk'|'', ref]
const TABLES = [
  { id: 'areas', g: 'ref', t: 'areas', s: 'Участки (справочник)', ls: 'smartplan_areas_db', x: 60, y: 60, w: 320, rows: [
    ['id', 'PK · текст', 'pk'], ['name', 'уникальное наименование участка', ''] ] },
  { id: 'professions', g: 'ref', t: 'professions', s: 'Профессии (справочник)', ls: 'smartplan_professions_db', x: 60, y: 180, w: 320, rows: [
    ['id', 'PK · текст', 'pk'], ['name', 'наименование (уник.)', ''], ['kind', '«prof_name» — строки-списки', ''] ] },
  { id: 'telemetry', g: 'ref', t: 'telemetry', s: 'Виды телеметрии', ls: 'smartplan_telemetry', x: 60, y: 320, w: 320, rows: [
    ['id', 'PK · tt_*', 'pk'], ['name', '«ПТК "Индел"», Wago, «ПТК "Сириус"» …', ''] ] },
  { id: 'work_catalog', g: 'ref', t: 'work_catalog', s: 'Виды работ (каталог)', ls: 'smartplan_work_catalog', x: 60, y: 440, w: 340, rows: [
    ['id', 'PK · текст', 'pk'],
    ['area', 'FK → areas.name', 'fk'],
    ['group', '«Группа / Подгруппа» (путь « / »)', ''],
    ['group_flags', 'свойства группы: «Телеметрия», «ГРП», метки', ''],
    ['name', 'наименование работы', ''],
    ['norm / unit', 'норма времени, ед. изм.', ''],
    ['season / min_temp', 'сезон, ограничение по t°', ''],
    ['object_categories[]', 'ГРП/ШРП/ПГРП… (для автоподбора)', ''],
    ['lines_count', 'линий редуцирования', ''],
    ['periodicity_*', 'value / unit / dev / basis (правила серий)', ''],
    ['periodicity_depends_on[]', 'FK → work_catalog.id (самоссылка)', 'fk'],
    ['joint_with[]', 'FK → work_catalog.id (самоссылка)', 'fk'],
    ['telemetry_req', 'с ТМ / без ТМ (для автоподбора)', ''],
    ['telemetry_type', 'FK → telemetry.name', 'fk'],
    ['diag_equipment / heating_req', 'диагностика / ТО отопления', ''],
    ['crew[]: prof / grade / count', 'FK → professions.name', 'fk'],
    ['needs_permit / equipment …', 'ордер, снег, техника, исключения', ''],
    ['rate …', 'дефолты и нормы из библиотеки (112 норм ГРП)', ''] ] },
  { id: 'objects', g: 'obj', t: 'objects', s: 'Объекты (ГРП/ШРП/ГРС/ПГРП)', ls: 'smartplan_objects_db', x: 480, y: 120, w: 300, rows: [
    ['id', 'PK · текст', 'pk'],
    ['type', 'ГРП / ШРП / ПГРП / Трасса…', ''],
    ['num / addr', 'номер, адрес', ''],
    ['lat / lng', 'координаты (карта)', ''],
    ['respId', 'FK → users.id (ответственный)', 'fk'],
    ['respHistory[].uid', 'FK → users.id (история)', 'fk'],
    ['attrs.telemetry', 'FK → telemetry.name', 'fk'],
    ['attrs.serviceKind', 'вид обслуживания (Region-gas)', ''],
    ['attrs.reduceLines / heating', 'линии редуцирования / отопление', ''],
    ['attrs.commissionDate', 'дата ввода — ЯКОРЬ серий из даты ввода', ''],
    ['plan_works[].wid', 'FK → work_catalog.id (общий набор работ)', 'fk'],
    ['plan_works[].period/dev/first', 'настройки серий объекта (22.09-138)', ''] ] },
  { id: 'graphs', g: 'plan', t: 'graphs', s: 'Графики работ (годовые)', ls: 'smartplan_graphs', x: 500, y: 560, w: 310, rows: [
    ['id', 'PK · текст', 'pk'],
    ['name / year', 'наименование, год', ''],
    ['area', 'FK → areas.name', 'fk'],
    ['respId', 'FK → users.id (мастер графика)', 'fk'],
    ['objs[].oid', 'FK → objects.id', 'fk'],
    ['objs[].works[].sid / wid', 'sid — серия · wid — FK → work_catalog.id', 'fk'],
    ['objs[].works[].period/dev/first', 'шаг серии = периодичность − отклонение', ''],
    ['objs[].works[].occs[].date', 'рассчитанные даты (треугольники)', ''],
    ['objs[].works[].occs[].tid', 'FK → tasks.id', 'fk'] ] },
  { id: 'tasks', g: 'plan', t: 'tasks', s: 'Задачи (планирование/календарь)', ls: 'smartplan_tasks_db', x: 880, y: 560, w: 310, rows: [
    ['id', 'PK · текст', 'pk'],
    ['m', 'FK → users.id (мастер)', 'fk'],
    ['slesari[]', 'FK → users.id (бригада)', 'fk'],
    ['o', 'FK → objects.id', 'fk'],
    ['w', 'FK → work_catalog.id', 'fk'],
    ['garea', 'FK → areas.name (участок работ)', 'fk'],
    ['graphId', 'FK → graphs.id', 'fk'],
    ['graphRi / graphSid', 'индекс объекта / sid серии в graphs', ''],
    ['d / dl', 'дата / дедлайн (отклонение серии)', ''],
    ['s / status', 'plan → в работе → done', ''],
    ['volume, norm_result…', 'объём, результат, расчёт подряда', ''],
    ['…служебные поля', 'переносы тянут всю серию в graphs', ''] ] },
  { id: 'users', g: 'pers', t: 'users', s: 'Пользователи (учётные записи)', ls: 'smartplan_users_db', x: 1350, y: 120, w: 300, rows: [
    ['id', 'PK · текст', 'pk'],
    ['login', 'логин (уник.)', ''],
    ['full_name', 'ФИО', ''],
    ['role', 'admin / master / slesar', ''],
    ['area', 'FK → areas.name (свой участок)', 'fk'] ] },
  { id: 'workers', g: 'pers', t: 'workers', s: 'Работники (графики смен)', ls: 'smartplan_workers_db', x: 1350, y: 400, w: 300, rows: [
    ['uid (= id пользователя)', 'PK+FK → users.id', 'pk'],
    ['sched', 'график смен 8ч 5/2, 12ч 2/2', ''],
    ['hours', 'часов в смене', ''],
    ['brigade', 'FK → users.id (мастер бригады)', 'fk'],
    ['abs{}', 'отсутствия по датам (отпуск…)', ''],
    ['leaves[]', 'доп. периоды отсутствий', ''] ] },
  { id: 'holidays', g: 'aux', t: 'holidays', s: 'Праздники', ls: 'smartplan_holidays', x: 70, y: 985, w: 230, rows: [
    ['id («h_MM-DD»)', 'PK', 'pk'], ['date', 'ММ-ДД (без года)', ''], ['name', 'наименование', ''] ] },
  { id: 'logs', g: 'aux', t: 'logs', s: 'Журнал действий (буфер)', ls: 'smartplan_local_logs', x: 340, y: 985, w: 230, rows: [
    ['ts', 'метка времени', ''], ['user / action / details', 'кто / что / детали', ''], ['—', 'локальный буфер (основное — на сервере)', ''], ['—', 'последние ~200 событий', ''] ] },
  { id: 'errlogs', g: 'aux', t: 'errlogs', s: 'Логи ошибок', ls: 'smartplan_errors', x: 610, y: 985, w: 230, rows: [
    ['ts', 'метка времени', ''], ['level / where', 'уровень / модуль', ''], ['msg', 'текст ошибки', ''], ['—', 'локально у пользователя', ''] ] }
];

const T = {}; TABLES.forEach(t => { t.h = HH + t.rows.length * RH + PAD; T[t.id] = t; });
function rowY(t, r) { return t.y + HH + r * RH + RH / 2; }

// Зоны (фон блоків) по охвату таблиц
function zone(list, g, label, lx, ly) {
  const xs = list.map(t => T[t].x - 16), ys = list.map(t => T[t].y - 26);
  const xe = list.map(t => T[t].x + T[t].w + 16), ye = list.map(t => T[t].y + T[t].h + 18);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xe) - Math.min(...xs), h: Math.max(...ye) - Math.min(...ys), g, label, lx, ly };
}
const ZONES = [
  zone(['areas', 'professions', 'telemetry', 'work_catalog'], 'ref', 'СПРАВОЧНИКИ', 0, 0),
  zone(['objects'], 'obj', 'ОБЪЕКТЫ ГАЗОРАСПРЕДЕЛЕНИЯ', 0, 0),
  zone(['graphs', 'tasks'], 'plan', 'ПЛАНИРОВАНИЕ РАБОТ', 0, 0),
  zone(['users', 'workers'], 'pers', 'ПЕРСОНАЛ', 0, 0),
  zone(['holidays', 'logs', 'errlogs'], 'aux', 'СЛУЖЕБНЫЕ (автономные, без связей)', 0, 0)
];

// Связи: массив полилиний [(x,y)...]; label at index точки (примерно старт)
// Доступ к якорям: L/R — левый/правый край строки
function pt(t, r, side) {
  const tab = T[t], y = rowY(tab, r);
  if (side === 'L') return [tab.x, y];
  if (side === 'R') return [tab.x + tab.w, y];
  if (side === 'T') return [tab.x + tab.w / 2, tab.y];
  if (side === 'B') return [tab.x + tab.w / 2, tab.y + tab.h];
}
const LINKS = [
  { pts: [pt('work_catalog', 1, 'L'), [42, rowY(T.work_catalog, 1)], [42, rowY(T.areas, 1)], pt('areas', 1, 'L')], lbl: 'area → areas.name', lblPt: [38, 313, true], c: 'ref' },
  { pts: [pt('work_catalog', 13, 'R'), [467, rowY(T.work_catalog, 13)], [467, rowY(T.telemetry, 0)], pt('telemetry', 0, 'R')], lbl: 'telemetry_type → telemetry.name', lblPt: [461, 564, true], c: 'ref' },
  { pts: [pt('work_catalog', 15, 'L'), [46, rowY(T.work_catalog, 15)], [46, rowY(T.professions, 1)], pt('professions', 1, 'L')], lbl: 'crew[].prof → professions.name', lblPt: [40, 650, true], c: 'ref' },
  { pts: [pt('work_catalog', 10, 'R'), [417, rowY(T.work_catalog, 10)], [417, 472], [400, 472]], lbl: 'depends_on / joint_with → id (self)', lblPt: [411, 650, true], c: 'ref' },
  { pts: [pt('objects', 4, 'R'), [1070, rowY(T.objects, 4)], [1070, 162], [1350, 162]], lbl: 'respId → users.id', lblPt: [925, 241, false], c: 'obj' },
  { pts: [pt('objects', 6, 'L'), [470, rowY(T.objects, 6)], [470, 377], [380, 377]], lbl: 'attrs.telemetry → telemetry.name', lblPt: [463, 335, true], c: 'obj' },
  { pts: [pt('objects', 10, 'L'), [437, rowY(T.objects, 10)], [437, 478], [400, 478]], lbl: 'plan_works.wid → work_catalog.id', lblPt: [430, 442, true], c: 'obj' },
  { pts: [pt('tasks', 3, 'L'), [850, rowY(T.tasks, 3)], [850, 161], pt('objects', 0, 'R')], lbl: 'o → objects.id', lblPt: [843, 414, true], c: 'plan' },
  { pts: [pt('tasks', 4, 'L'), [840, rowY(T.tasks, 4)], [840, 487], [426, 487], [426, 490], [400, 490]], lbl: 'w → work_catalog.id', lblPt: [630, 480, false], c: 'plan' },
  { pts: [pt('tasks', 6, 'L'), [872, rowY(T.tasks, 6)], [872, rowY(T.graphs, 0)], pt('graphs', 0, 'R')], lbl: 'graphId → graphs.id', lblPt: [865, 667, true], c: 'plan' },
  { pts: [pt('graphs', 3, 'R'), [820, rowY(T.graphs, 3)], [820, 545], [1263, 545], [1263, 168], [1350, 168]], lbl: 'respId → users.id', lblPt: [1050, 538, false], c: 'plan' },
  { pts: [pt('graphs', 4, 'L'), [478, rowY(T.graphs, 4)], [478, 432], [630, 432], [630, 424]], lbl: 'objs[].oid → objects.id', lblPt: [471, 560, true], c: 'plan' },
  { pts: [pt('graphs', 5, 'L'), [457, rowY(T.graphs, 5)], [457, 484], [400, 484]], lbl: 'objs[].works[].wid → work_catalog.id', lblPt: [443, 593, true], c: 'plan' },
  { pts: [pt('graphs', 8, 'R'), [826, rowY(T.graphs, 8)], [826, rowY(T.tasks, 0)], pt('tasks', 0, 'L')], lbl: 'occs[].tid → tasks.id', lblPt: [819, 689, true], c: 'plan' },
  { pts: [pt('tasks', 1, 'R'), [1230, rowY(T.tasks, 1)], [1230, 152], [1350, 152]], lbl: 'm → users.id (мастер)', lblPt: [1290, 145, false], c: 'plan' },
  { pts: [pt('workers', 0, 'T'), [1500, 400], [1500, 320], [1460, 320], [1460, 270]], lbl: 'uid → users.id', lblPt: [1480, 313, false], c: 'pers' },
  { pts: [pt('workers', 3, 'L'), [1310, rowY(T.workers, 3)], [1310, 255], [1350, 255]], lbl: 'brigade → users.id', lblPt: [1303, 383, true], c: 'pers' },
  { pts: [pt('users', 4, 'R'), [1694, rowY(T.users, 4)], [1694, 1136], [30, 1136], [30, 118], pt('areas', 1, 'L')], lbl: 'area → areas.name', lblPt: [1240, 1128, false], c: 'pers' },
  // логические (пунктир)
  { pts: [pt('workers', 4, 'L'), [1322, rowY(T.workers, 4)], [1322, 874], [655, 874], [655, 798]], lbl: 'графики смен / отсутствия → сдвиг дат серий (расчёт)', lblPt: [975, 867, false], c: 'aux', dash: true },
  { pts: [pt('tasks', 5, 'L'), [858, rowY(T.tasks, 5)], [858, 900], [52, 900], [52, 129], pt('areas', 1, 'L')], lbl: 'garea → areas.name (участок работ)', lblPt: [640, 892, false], c: 'plan' },
  { pts: [pt('holidays', 1, 'B'), [185, 1150], [1685, 1150], [1685, 507], pt('workers', 3, 'R')], lbl: 'праздники → подсветка дней в «Графиках смен»', lblPt: [930, 1160, false], c: 'aux', dash: true }
];

// ---- Сборка SVG ----
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
let S = [];
S.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Segoe UI',Roboto,Arial,sans-serif">`);
S.push(`<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#475569"/></marker><marker id="arrD" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#94a3b8"/></marker></defs>`);
S.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
S.push(`<text x="${W / 2}" y="26" font-size="21" font-weight="700" fill="#0f172a" text-anchor="middle">Схема баз данных SmartPlan — УП «МИНГАЗ» (сборка 22.09-139)</text>`);
S.push(`<text x="${W / 2}" y="44" font-size="12" fill="#64748b" text-anchor="middle">Каждый блок — отдельная база: запись localStorage в браузере, секция JSONB на сервере Render, синхронизация по id. Все линии связей — с изгибами 90°.</text>`);

// зоны
ZONES.forEach(z => {
  const g = GROUPS[z.g];
  S.push(`<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="14" fill="${g.bg}" stroke="${g.border}" stroke-width="1.6"/>`);
  S.push(`<text x="${z.x + 14}" y="${z.y + 17}" font-size="12" font-weight="800" fill="${g.color}" letter-spacing="1.2">${esc(z.label)}</text>`);
});

// таблицы
TABLES.forEach(t => {
  const g = GROUPS[t.g];
  S.push(`<g>`);
  S.push(`<rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" rx="9" fill="#ffffff" stroke="${g.color}" stroke-width="1.8" filter="drop-shadow(0 1px 2px rgba(15,23,42,.12))"/>`);
  S.push(`<rect x="${t.x}" y="${t.y}" width="${t.w}" height="${HH}" rx="9" fill="${g.color}"/>`);
  S.push(`<rect x="${t.x}" y="${t.y + HH - 9}" width="${t.w}" height="9" fill="${g.color}"/>`);
  S.push(`<text x="${t.x + 10}" y="${t.y + 15}" font-size="13" font-weight="700" fill="#ffffff">🗄 ${esc(t.t)}</text>`);
  S.push(`<text x="${t.x + 10}" y="${t.y + 27}" font-size="9.5" fill="rgba(255,255,255,.88)">${esc(t.s)} · ${esc(t.ls)}</text>`);
  t.rows.forEach((r, i) => {
    const y = t.y + HH + i * RH;
    if (i % 2) S.push(`<rect x="${t.x + 2}" y="${y}" width="${t.w - 4}" height="${RH}" fill="#f8fafc"/>`);
    if (r[2] === 'pk') S.push(`<rect x="${t.x + 2}" y="${y}" width="4" height="${RH}" fill="#f59e0b"/>`);
    if (r[2] === 'fk') S.push(`<rect x="${t.x + 2}" y="${y}" width="4" height="${RH}" fill="#0ea5e9"/>`);
    const name = r[0], type = r[1];
    const leftW = Math.min(name.length * 7.0 + 30, t.w * 0.52);
    S.push(`<text x="${t.x + 12}" y="${y + 15}" font-size="11" font-weight="${r[2] ? '700' : '600'}" fill="#0f172a">${esc(name)}</text>`);
    S.push(`<text x="${t.x + 12 + leftW}" y="${y + 15}" font-size="10" fill="#64748b">${esc(type)}</text>`);
    if (r[2] === 'pk') S.push(`<text x="${t.x + t.w - 40}" y="${y + 15}" font-size="10" font-weight="800" fill="#b45309">🔑 PK</text>`);
    if (r[2] === 'fk') S.push(`<text x="${t.x + t.w - 40}" y="${y + 15}" font-size="10" font-weight="800" fill="#0369a1">🔗 FK</text>`);
  });
  S.push(`</g>`);
});

// связи (поверх таблиц) — line-сегменты + V-стрелка (максимально совместимо с любым рендером SVG)
LINKS.forEach(l => {
  const dash = l.dash ? ' stroke-dasharray="7 5"' : '';
  const col = l.dash ? '#94a3b8' : '#475569';
  const w = l.dash ? 1.8 : 2;
  for (let i = 1; i < l.pts.length; i++) {
    const a = l.pts[i - 1], b = l.pts[i];
    if (a[0] === b[0] && a[1] === b[1]) continue;
    S.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${col}" stroke-width="${w}"${dash}/>`);
  }
  // V-наконечник стрелки по направлению последнего сегмента
  const m = l.pts.length, pe = l.pts[m - 1];
  let pp = l.pts[m - 2];
  for (let i = m - 2; i >= 0; i--) { pp = l.pts[i]; if (pp[0] !== pe[0] || pp[1] !== pe[1]) break; }
  let dx = pe[0] - pp[0], dy = pe[1] - pp[1];
  const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  const ax = pe[0] - dx * 8, ay = pe[1] - dy * 8, px = -dy, py = dx;
  S.push(`<line x1="${pe[0]}" y1="${pe[1]}" x2="${(ax + px * 4).toFixed(1)}" y2="${(ay + py * 4).toFixed(1)}" stroke="${col}" stroke-width="${w}"/>`);
  S.push(`<line x1="${pe[0]}" y1="${pe[1]}" x2="${(ax - px * 4).toFixed(1)}" y2="${(ay - py * 4).toFixed(1)}" stroke="${col}" stroke-width="${w}"/>`);
  const [sx, sy] = l.pts[0];
  S.push(`<circle cx="${sx}" cy="${sy}" r="4" fill="${l.dash ? '#94a3b8' : '#475569'}" stroke="#fff" stroke-width="1.4"/>`);
  // подпись — явная точка lblPt [x, y, rot]; rot=true → вертикально вдоль коридора
  if (l.lblPt) {
    const [lx, ly, rot] = l.lblPt;
    const tr = rot ? ` transform="rotate(-90 ${lx} ${ly})"` : '';
    S.push(`<text x="${lx}" y="${ly}"${tr} font-size="10" font-weight="600" fill="${l.dash ? '#64748b' : '#1e293b'}" text-anchor="middle" style="paint-order:stroke;stroke:#ffffff;stroke-width:3.5;stroke-linejoin:round">${esc(l.lbl)}</text>`);
  }
});

// Легенда
const LG = { x: 40, y: 1175, w: 1660, h: 68 };
S.push(`<rect x="${LG.x}" y="${LG.y}" width="${LG.w}" height="${LG.h}" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.4"/>`);
S.push(`<text x="${LG.x + 14}" y="${LG.y + 22}" font-size="12" font-weight="800" fill="#0f172a">ЛЕГЕНДА:</text>`);
S.push(`<rect x="${LG.x + 90}" y="${LG.y + 10}" width="26" height="15" rx="3" fill="#ffffff" stroke="#f59e0b" stroke-width="2"/><text x="${LG.x + 124}" y="${LG.y + 22}" font-size="11" fill="#334155">— ключевая строка (PK) таблицы</text>`);
S.push(`<rect x="${LG.x + 310}" y="${LG.y + 10}" width="26" height="15" rx="3" fill="#ffffff" stroke="#0ea5e9" stroke-width="2"/><text x="${LG.x + 344}" y="${LG.y + 22}" font-size="11" fill="#334155">— поле связи (FK → база)</text>`);
[[520, 17, '#475569', 2, '', 582, '— ссылочная связь (FK → PK), все изгибы 90°'],
 [868, 17, '#94a3b8', 1.8, ' stroke-dasharray="7 5"', 930, '— логическая связь: не колонка, а влияние при расчётах']].forEach(q => {
  const [ox, oy, cc, ww, dd, tx, cap] = q, y1 = LG.y + oy, x1 = LG.x + ox;
  S.push(`<line x1="${x1}" y1="${y1}" x2="${x1 + 25}" y2="${y1}" stroke="${cc}" stroke-width="${ww}"${dd}/>`);
  S.push(`<line x1="${x1 + 25}" y1="${y1}" x2="${x1 + 25}" y2="${y1 + 9}" stroke="${cc}" stroke-width="${ww}"${dd}/>`);
  S.push(`<line x1="${x1 + 25}" y1="${y1 + 9}" x2="${x1 + 55}" y2="${y1 + 9}" stroke="${cc}" stroke-width="${ww}"${dd}/>`);
  S.push(`<line x1="${x1 + 55}" y1="${y1 + 9}" x2="${x1 + 46}" y2="${y1 + 5}" stroke="${cc}" stroke-width="${ww}"/>`);
  S.push(`<line x1="${x1 + 55}" y1="${y1 + 9}" x2="${x1 + 46}" y2="${y1 + 13}" stroke="${cc}" stroke-width="${ww}"/>`);
  S.push(`<text x="${LG.x + tx}" y="${LG.y + 22}" font-size="11" fill="#334155">${cap}</text>`);
});
S.push(`<text x="${LG.x + 14}" y="${LG.y + 46}" font-size="11" fill="#475569">Цветные зоны — смысловые блоки: справочники · объекты · планирование работ · персонал · служебные. Каждая база скачивается отдельным файлом на странице «Бэкапы БД» (Администрирование, 22.09-139).</text>`);
S.push(`<text x="${LG.x + 14}" y="${LG.y + 62}" font-size="10.5" fill="#94a3b8">Привязка задач к серии: graphId + graphRi + graphSid → graphs.objs[].works[] · якорь серии — attrs.commissionDate / objects.plan_works · общий набор работ объекта действует во всех графиках (22.09-138).</text>`);

S.push('</svg>');
const svg = S.join('\n');
fs.writeFileSync('/home/user/smartplan_db_schema.svg', svg);
const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SmartPlan — схема баз данных (22.09-139)</title>
<style>body{margin:0;background:#e8edf3;padding:18px;display:flex;justify-content:center;font-family:'Segoe UI',Roboto,Arial,sans-serif}
.sheet{background:#fff;border-radius:12px;padding:14px;box-shadow:0 4px 24px rgba(15,23,42,.14);max-width:100%}
svg{max-width:100%;height:auto;display:block}</style></head>
<body><div class="sheet">${svg}</div></body></html>`;
fs.writeFileSync('/home/user/smartplan_db_schema.html', html);
console.log('written: smartplan_db_schema.html + .svg,', svg.length, 'bytes');
