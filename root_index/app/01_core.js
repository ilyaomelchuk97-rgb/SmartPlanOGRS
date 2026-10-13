  /* ── часть 01 · app/01_core.js — ядро: общие данные, помощники, состояние, погода, заголовки, значки ── */
  var D = window.SP || {};
  var DB = window.SP_DB;
  var WORK = window.SP_WORK;
  var OBJECTS_DB = window.SP_OBJECTS;
  var TASKS_DB = window.SP_TASKS;
  /* 22.09-224: ПРИВЯЗКА ЗАДАЧ К КАЛЕНДАРНОЙ ДАТЕ.
     Дата задачи хранится СМЕЩЕНИЕМ от «сегодня» (t.d = 0 — сегодня), а «сегодня»
     считается при каждой загрузке страницы заново — поэтому каждое утро все
     задачи «перепрыгивали» на день вперёд. Теперь в базе задач лежит служебная
     запись-якорь (id = t_day_anchor) с датой, на которую смещения актуальны.
     При входе и при обновлении данных: если якорь отстаёт от сегодняшнего дня —
     все смещения (d и dl) один раз уменьшаются на разницу дней, якорь переставляется
     на сегодня. Запись-якорь синхронизируется с сервером, как обычная запись,
     поэтому перебазирование выполняется один раз на всех устройствах. */
  var ANCHOR_TASK_ID = 't_day_anchor';
  // 22.09-257: доступ из sync_polling.js — повторное перебазирование после получения данных с сервера
  try { window.rebaseTaskDays = rebaseTaskDaysToToday; } catch (eExp) {}
  /* 22.09-257: когда разрешено перебазирование дат задач. Раньше оно работало при входе ДО
     получения данных с сервера: на пустом/новом браузере оно создавало якорь «сегодня» и ПИСАЛО
     его на сервер, затирая настоящий якорь (от него отсчитываются даты ВСЕХ задач) — после
     синхронизации сдвиг уже не производился и задачи уходили не на свои календарные даты.
     Теперь: без связи с сервером (локальный режим / сервер недоступен) — как раньше, сразу;
     при живой связи — только после первой синхронизации (её вызывает sync_polling.js). */
  function rebaseAllowed() {
    try {
      if (!window.SP_API || !SP_API.getToken || !SP_API.getToken()) return true;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
      var st = (window.SP_SYNC_POLL && SP_SYNC_POLL.status) ? SP_SYNC_POLL.status() : null;
      if (st && (st.errors || 0) >= 3) return true; // сервер недоступен — работаем по локальной копии
      return !!(st && st.ready);
    } catch (e) { return false; }
  }
  function rebaseTaskDaysToToday() {
    if (!TASKS_DB || !TASKS_DB.getTask || !TASKS_DB.getTasks || !TASKS_DB.updateTask) return 0;
    var todayK = key(TODAY);
    var rec = null;
    try { rec = TASKS_DB.getTask(ANCHOR_TASK_ID); } catch (e) {}
    if (!rec) {
      // Первый запуск после обновления: якоримся на сегодня БЕЗ сдвига —
      // текущие смещения считаем верными именно на сегодняшний день.
      try { TASKS_DB.addTask({ id: ANCHOR_TASK_ID, day_anchor: todayK, is_day_anchor: true, name: 'якорь дат (служебная запись — не удалять)' }); } catch (eA) {}
      return 0;
    }
    var anchored = String(rec.day_anchor || '');
    if (anchored === todayK) return 0;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(anchored)) {
      try { rec.day_anchor = todayK; TASKS_DB.updateTask(ANCHOR_TASK_ID, { day_anchor: todayK }); } catch (e2) {}
      return 0;
    }
    var delta = Math.round((new Date(todayK + 'T00:00:00') - new Date(anchored + 'T00:00:00')) / 86400000);
    if (!isFinite(delta) || delta <= 0) return 0; // часы устройства «назад» — не трогаем (защита)
    var tasks = TASKS_DB.getTasks(); // ЖИВАЯ ссылка на массив базы — меняем на месте
    var moved = 0;
    tasks.forEach(function (t) {
      if (!t || t.id === ANCHOR_TASK_ID) return;
      var ch = false;
      if (typeof t.d === 'number' && isFinite(t.d)) { t.d -= delta; ch = true; }
      if (typeof t.dl === 'number' && isFinite(t.dl)) { t.dl -= delta; ch = true; }
      if (ch) { t.updated_at = Date.now(); moved++; }
    });
    rec.day_anchor = todayK; rec.updated_at = Date.now();
    try { TASKS_DB.updateTask(ANCHOR_TASK_ID, rec); } catch (e3) {} // ОДИН save (и одна синхронизация базы) на всех
    try { logAction('Перебазирование дат задач', 'якорь ' + anchored + ' → ' + todayK + ' · задач, сдвинутых на ' + delta + ' дн: ' + moved); } catch (e4) {}
    return moved;
  }
  var OBJECTS = OBJECTS_DB ? OBJECTS_DB.getObjects() : (D.OBJECTS || []);
  var WORK_TREE = D.WORK_TREE || [], WORK_MAP = D.WORK_MAP || {}, OBJ_MAP = D.OBJ_MAP || {};
  OBJECTS.forEach(function(o) { OBJ_MAP[o.id] = o; });

  // Мастера/бригады берутся из БД пользователей (роль master/smaster)
  function getMasters() { return DB.getMasters(); }

  // Описание ролей и участков
  var ROLE_INFO = {
    admin:    { label: 'Администратор',     cls: 'navy' },
    nach:     { label: 'Начальник участка', cls: 'blue' },
    smaster:  { label: 'Старший мастер',    cls: 'purple' },
    engineer: { label: 'Инженер',           cls: 'orange' },  // Сборка 22.09-26: права как у старшего мастера
    master:   { label: 'Мастер',            cls: 'teal' },
    slesar:   { label: 'Слесарь',           cls: 'teal' },
    viewer:   { label: 'Начальник СЭОГС',   cls: 'slate' }
  };
  // Профессии штатного списка — варианты РОЛИ при создании пользователя
  // (без повторов с базовыми ролями). key — внутренняя роль = права в системе:
  // рабочие профессии → слесарь (работают в бригадах), специалисты и руководители
  // отдела → просмотр, «Заместитель начальника СЭОГС» — права как у начальника
  // СЭОГС (просмотр), руководитель группы → мастер.
  var ROLE_EXTRA = [
    { label: 'Заместитель начальника СЭОГС', key: 'viewer' },
    { label: 'Начальник отдела', key: 'viewer' },
    { label: 'Руководитель группы', key: 'master' },
    { label: 'Руководитель сектора', key: 'viewer' },
    { label: 'Инженер', key: 'engineer' },  // Сборка 22.09-26: права как у старшего мастера на участке
    { label: 'Техник', key: 'viewer' },
    { label: 'Оператор персональных электронно-вычислительных машин', key: 'viewer' },
    { label: 'Электрогазосварщик', key: 'slesar' },
    { label: 'Монтажник наружных трубопроводов', key: 'slesar' },
    { label: 'Слесарь по обслуживанию и ремонту наружных газопроводов', key: 'slesar' },
    { label: 'Наладчик контрольно-измерительных приборов и автоматики', key: 'slesar' },
    { label: 'Слесарь по контрольно-измерительным приборам и автоматике', key: 'slesar' },
    { label: 'Слесарь по обслуживанию и ремонту газоиспользующего оборудования', key: 'slesar' },
    { label: 'Каменщик', key: 'slesar' },
    { label: 'Маляр', key: 'slesar' },
    { label: 'Плотник', key: 'slesar' },
    { label: 'Штукатур', key: 'slesar' },
    { label: 'Дорожный рабочий', key: 'slesar' },
    { label: 'Столяр', key: 'slesar' },
    { label: 'Подсобный рабочий', key: 'slesar' }
  ];
  // Роль-ключ и название по выбору из списка ролей (базовая роль или профессия)
  function roleKeyOfSel(v) {
    if (ROLE_INFO[v]) return v;
    for (var i = 0; i < ROLE_EXTRA.length; i++) if (ROLE_EXTRA[i].label === v) return ROLE_EXTRA[i].key;
    return 'master';
  }
  function roleProfOfSel(v) { return ROLE_INFO[v] ? '' : v; } // базовая роль → без приставки-профессии

  // Роль «Слесарь»: доступ только к трём картам (просмотр)
  function isSlesar() { return S.role === 'slesar'; }
  var SLESAR_SCREENS = { map: 1, livemap: 1, objmap: 1 };
  // Список участков — из справочника (areas_db.js); fallback — каталог работ
  function areasList() {
    try {
      if (window.SP_AREAS && typeof window.SP_AREAS.getAreas === 'function') {
        var a = window.SP_AREAS.getAreas();
        if (a && a.length) return a;
      }
      if (WORK && typeof WORK.getAreas === 'function') {
        var w = WORK.getAreas();
        if (w && w.length) return w;
      }
    } catch (e) {}
    return ['УБиРОГС'];
  }

  // ---------- Объекты (ГРП/ШРП): номер и полный адрес ----------
  // Номер: явное поле num либо извлечение из старого адреса «ГРП-12, ул. …»
  function objNumOf(o) {
    if (!o) return '';
    if (o.num != null && String(o.num) !== '') return String(o.num);
    var m = /^(ГРП|ШРП|ГРС|ПГРП)\s*-?\s*(\d+)/i.exec(o.addr || '');
    return m ? m[2] : '';
  }
  // Полный адрес: «ГРП-3, пр. Независимости, 76» (для новых объектов) либо старый формат addr
  function objFullAddr(o) {
    if (!o) return '?';
    var n = objNumOf(o);
    if (n) return (o.type || 'ГРП') + '-' + n + (o.addr ? ', ' + o.addr : '');
    return o.addr || 'Без адреса';
  }
  // Адрес без префикса «ГРП-N, » — для формы редактирования
  function objStreetAddr(o) {
    if (!o) return '';
    var m = /^(ГРП|ШРП|ГРС|ПГРП)\s*-?\s*\d+\s*,\s*/i.exec(o.addr || '');
    if (m && o.num == null) return (o.addr || '').slice(m[0].length); // старый формат: срезаем префикс
    return o.addr || '';
  }
  // Короткий адрес объекта для карточки задачи: «ГРП №5» (без улицы).
  // Если номера нет (Просека, Трасса…) — полный адрес справочника.
  function objShortAddr(o) {
    if (!o) return '?';
    var n = objNumOf(o);
    return n ? (o.type || 'ГРП') + ' №' + n : objFullAddr(o);
  }
  // Поиск объекта справочника по адресу (поддерживает старый формат «ГРП-3, ул. …»
  // и новый — addr хранит только улицу, полный адрес собирается как «ГРП-3, улица»)
  function findObjectByAddr(addr) {
    if (!addr) return null;
    var a = String(addr).toLowerCase().trim();
    if (!a) return null;
    // быстрый путь: индекс точных совпадений (адресов сотни — перебор не нужен)
    if (OBJ_ADDR_INDEX && OBJ_ADDR_INDEX[a]) return OBJ_ADDR_INDEX[a];
    for (var i = 0; i < OBJECTS.length; i++) {
      var o = OBJECTS[i];
      var full = objFullAddr(o).toLowerCase();
      var shortA = objShortAddr(o).toLowerCase();
      var street = String(o.addr || '').toLowerCase();
      if (full === a || shortA === a || (street && street === a)) return o;
      // частичное совпадение (защита от коротких обрывков — минимум 5 символов)
      if (a.length >= 5) {
        if (full.indexOf(a) !== -1 || a.indexOf(full) !== -1) return o;
        if (street && (street.indexOf(a) !== -1 || a.indexOf(street) !== -1)) return o;
      }
    }
    return null;
  }
  // Перечитать справочник объектов из БД (после добавления/изменения/удаления)
  var OBJ_ADDR_INDEX = {}; // индекс адресов → объект (точные совпадения, O(1))
  function refreshObjects() {
    var arr = OBJECTS_DB ? OBJECTS_DB.getObjects() : [];
    OBJECTS.length = 0;
    for (var i = 0; i < arr.length; i++) OBJECTS.push(arr[i]);
    Object.keys(OBJ_MAP).forEach(function (k) { delete OBJ_MAP[k]; });
    OBJECTS.forEach(function (o) { OBJ_MAP[o.id] = o; });
    // индекс: полный адрес, улица и короткая форма «ГРП №N» (в нижнем регистре)
    OBJ_ADDR_INDEX = {};
    OBJECTS.forEach(function (o) {
      try {
        var full = objFullAddr(o).toLowerCase();
        var shortA = objShortAddr(o).toLowerCase();
        var street = String(o.addr || '').toLowerCase();
        OBJ_ADDR_INDEX[full] = o;
        if (shortA) OBJ_ADDR_INDEX[shortA] = o;
        if (street) OBJ_ADDR_INDEX[street] = o;
      } catch (e) {}
    });
  }

  // Базы (отправные точки маршрутов)
  var BASES = [
    { id: 'b1', name: 'г. Минск, ул. Ботаническая 11', lat: 53.9060, lng: 27.6027 },
    { id: 'b2', name: 'г. Минск, ул. Волгоградская 3А', lat: 53.929192, lng: 27.623294 }
  ];

  /* ---------- УТИЛИТЫ ДАТ ---------- */
  var TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
  var WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  var WD_FULL = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
  var MON = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  var MON_NOM = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function offToDate(off) { return addDays(TODAY, off); }
  function key(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fmtDmyIso(iso) { // 'YYYY-MM-DD' → 'DD.MM.YYYY' (22.09-161)
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '.' + m[2] + '.' + m[1] : (iso || '—');
  }
  function sameDay(a, b) { return key(a) === key(b); }
  function dateToOff(d) { return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - TODAY) / 86400000); }
  function mondayOf(d) { var x = new Date(d); var day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x; }
  function fmt(d) { return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
  function fmtShort(off) { var d = offToDate(off); return d.getDate() + ' ' + MON[d.getMonth()]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtH(h) { return (Math.round(h * 10) / 10).toString().replace('.', ','); }
  function fmtClock(ms) { var d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); } // 22.09-190: «10:24»
  function taskFactHours(t) { return (t && t.started_at && t.finished_at && t.finished_at >= t.started_at) ? (t.finished_at - t.started_at) / 3600000 : null; } // 22.09-190: фактические часы работы на объекте
  function initials(name) {
    if (!name) return '?';
    var p = name.replace(/[^А-Яа-яA-Za-z\s.]/g, '').split(/\s+/).filter(Boolean);
    return ((p[0] || '')[0] || '') + ((p[1] || '')[0] || '');
  }
  // 22.09-219: кружок работника — фото (u.avatar, dataURL), иначе инициалы, как раньше
  function avaHtml(u, d, fs, extra) {
    var st = 'width:' + d + 'px;height:' + d + 'px;border-radius:50%;background:' + ((u && u.color) || '#94a3b8') + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:' + fs + 'px;flex:0 0 auto;overflow:hidden;' + (extra || '');
    if (u && u.avatar) return '<span style="' + st + '"><img src="' + u.avatar + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block"></span>';
    return '<span style="' + st + '">' + esc(initials(u && u.full_name)) + '</span>';
  }

  /* ---------- СОСТОЯНИЕ ---------- */
  var S = {
    screen: 'dashboard',
    user: null,           // вошедший пользователь
    role: 'master',       // admin | nach | smaster | master
    curMaster: 'm1',
    calMode: 'week',      // week | month | day
    weekShift: 0, monthShift: 0, dayShift: 0,
    mapOff: 0,
    mapProvider: 'brouter-car-eco', // 22.09-179: единственный роутер карты маршрутов
    mapSel: {},
    baseId: 'b1',
    dashArea: null, // выбранный участок на панели мониторинга: действует во всех вкладках (кроме карты местоположения); null = все участки
    dashMaster: null, // 22.09-193: выбранный мастер в списке «КПД мастеров» на панели мониторинга; null = все мастера
    refsTab: 'tree',
    wsel: {},            // 22.09-229: отмеченные галочками виды работ для группового изменения (id → 1)
    workArea: null, workModalMode: 'new', workModalWid: null,
    userModalMode: 'new', userModalUid: null,
    reportMonth: null, // {year, month} — выбранный отчётный месяц; null = текущий
    dashMonth: null,   // {year, month} — выбранный месяц для панели аналитики; null = текущий
    dashDayOff: 0,     // 22.09-171: выбранный день блока «Сегодня» на панели мониторинга (0 = сегодня)
    tasks: TASKS_DB ? TASKS_DB.getTasks() : (D.TASK_SEED || []).map(function (t, i) {
      var o = OBJ_MAP[t.o] || null;
      var tm = 15;
      if (o && o.lat && o.lng) {
        var distKmVal = distKm(BASES[0], { lat: o.lat, lng: o.lng }) * 1.4;
        tm = Math.max(1, Math.round(distKmVal / 55 * 60));
      }
      return Object.assign({ id: 't' + (i + 1), travelMin: tm }, t);
    })
  };
  // 22.09-179: роутер карты маршрутов ОДИН — BRouter car (economic);
  // старое сохранённое значение (из времён выбора) затираем
  try {
    S.mapProvider = 'brouter-car-eco';
    localStorage.setItem('smartplan_map_provider', S.mapProvider);
  } catch (e) {}
  var CAP = 8; // ФРВ: рабочий день = 8 ч (Пн–Чт)
  function dayCapacity(off) { return offToDate(off).getDay() === 5 ? 7.25 : 8; } // Пт=7.25, остальное=8

  /* ---------- РАБОТНИКИ: время работы, график, отсутствия ----------
     Страница «Работники» хранит настройки в SP_WORKERS (workers_db.js).
     Фонд времени КОНКРЕТНОГО работника на день:
       · 8 ч  → стандарт (8, в пятницу 7,25);
       · 12 ч → всегда 12;
       · день отсутствия (календарь работника) → 0;
       · график 2/2 → 2 рабочих дня, 2 выходных (цикл от даты «cycle»). */
  function wkData(uid) {
    var d = (window.SP_WORKERS ? SP_WORKERS.getWorker(uid) : null);
    return d || { hours: 8, sched: '5/2', cycle: '2026-01-05', brigade: null, comment: '', abs: {} };
  }
  function wkIsAbsent(uid, off) {
    var a = wkData(uid).abs;
    return !!(a && a[key(offToDate(off))] !== undefined); // '' (без причины) — тоже отсутствие
  }
  // Принимает либо off (как у wkIsAbsent), либо dateStr 'YYYY-MM-DD'
  function wkIsAbsentDs(uid, dateStr) {
    var a = wkData(uid).abs;
    return !!(a && a[dateStr] !== undefined);
  }
  // Рабочий ли день по графику работника (без учёта отсутствий — их накладываем отдельно).
  // 5/2: ПН–ПТ работа, СБ–ВС отдых. 2/2: считаем дни от cycle (2 раб / 2 вых).
  // Для 2/2 cycle берём общий на бригаду — у мастера бригады (если работник в бригаде).
  function wkIsWorking(uid, dateStr) {
    var wd = wkData(uid);
    // 22.09-207: ручное изменение дня (рабочий/выходной) — важнее шаблона графика
    var ov = wd.overrides && wd.overrides[dateStr];
    if (ov && (ov.s === 'work' || ov.s === 'off')) return ov.s === 'work';
    var sched = wd.sched || '5/2';
    var parts = dateStr.split('-');
    var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    if (sched === '5/2') {
      var dow = d.getDay(); // 0=вс, 6=сб
      return dow !== 0 && dow !== 6;
    }
    if (sched === '2/2') {
      // 22.09-215: цикл — ИНДИВИДУАЛЬНЫЙ у каждого работника (слесарь больше не следует
      // за циклом мастера; его запись получила копию цикла при миграции workers_db v2).
      // 22.09-211: с учётом истории сдвигов (cycleHist) — сдвиг действует со своей даты
      var cycleStr = wkCycleFrom(uid, dateStr);
      var cParts = cycleStr.split('-');
      var c = new Date(+cParts[0], +cParts[1] - 1, +cParts[2]);
      var days = Math.floor((d - c) / 86400000);
      if (days < 0) {
        // До начала цикла — рабочий день считается по 5/2 (привычный дефолт)
        var dow2 = d.getDay();
        return dow2 !== 0 && dow2 !== 6;
      }
      // Цикл 4 дня: 0,1 — работа; 2,3 — отдых.
      return (days % 4) < 2;
    }
    return true;
  }
  // Итоговое состояние дня: 'work' (рабочий по графику), 'off' (выходной), 'abs' (отсутствие).
  function wkDayState(uid, dateStr) {
    if (wkIsAbsentDs(uid, dateStr)) return 'abs';
    return wkIsWorking(uid, dateStr) ? 'work' : 'off';
  }
  // Бригада мастера (страница «Работники»): слесари, приписанные к нему перетаскиванием
  function wkBrigadeOf(masterId) {
    if (!masterId) return [];
    return (DB.getUsers() || []).filter(function (u) {
      return u && u.role === 'slesar' && u.active && wkData(u.id).brigade === masterId;
    });
  }
  // Профессия работника (страница «Работники»; без профессии — должность по роли)
  function wkProfLabel(u) {
    // профессия хранится у пользователя («Пользователи»/«Работники»); запас — старое поле workers_db
    if (u && u.prof) return u.prof;
    var wd = wkData(u.id);
    return wd.prof || wkRoleLabel(u.role);
  }
  function masterCapacity(masterId, off) {
    var wd = wkData(masterId);
    var d = offToDate(off);
    if (wd.abs && wd.abs[key(d)] !== undefined) return 0; // работник отсутствует (комментарий может быть пустым)
    // 22.09-207: ручное изменение дня (выходной — 0 часов; рабочий — заданные часы)
    var _mcOv = wd.overrides && wd.overrides[key(d)];
    if (_mcOv && _mcOv.s === 'off') return 0;
    if (_mcOv && _mcOv.s === 'work' && isFinite(+_mcOv.h) && +_mcOv.h > 0) return +_mcOv.h;
    // ОДИНОЧНЫЙ мастер (в бригаде не поставлены люди): норма дня — всегда из его
    // карточки (8 или 12 ч), график 2/2 норму НЕ обнуляет — он работает каждый день.
    var solo = wkBrigadeOf(masterId).length === 0;
    if (wd.sched === '2/2' && !solo) {
      // бригада со сменным графиком: цикл 4 дня (2 рабочих + 2 выходных), отсчёт от cycle
      var c = new Date(wkCycleFrom(masterId, key(d)) + 'T00:00:00'); // 22.09-211: с учётом сдвигов цикла
      if (!isNaN(c.getTime())) {
        var idx = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) -
          new Date(c.getFullYear(), c.getMonth(), c.getDate())) / 86400000);
        if (((idx % 4) + 4) % 4 >= 2) return 0; // выходной по графику 2/2
      }
    }
    return wd.hours === 12 ? 12 : dayCapacity(off);
  }

  /* ---------- ПРАВА ДОСТУПА (иерархия) ----------
     admin   — видит и редактирует ВСЁ (все участки)
     nach    — видит и редактирует только мастеров СВОЕГО участка
     smaster — то же, что nach: только мастеров своего участка
     master  — видит и редактирует ТОЛЬКО СЕБЯ
  */
  // Создание планов и запуск оптимизатора — админ / нач. участка / ст. мастер
  function canPlan() { return S.role === 'admin' || S.role === 'nach' || S.role === 'smaster' || S.role === 'engineer'; }
  // Может ли пользователь редактировать конкретную задачу
  function canEditTask(t) {
    if (!t) return false;
    if (S.role === 'viewer' || S.role === 'slesar') return false;   // только просмотр
    if (S.role === 'admin') return true;                       // всё
    if (S.role === 'master') return S.user && t.m === S.user.id;         // только себя
    var m = masterById(t.m);                                   // nach / smaster — свой участок
    return !!m && S.user && m.area === S.user.area;
  }
  // Может ли пользователь перетаскивать задачи на строку этого мастера
  function canDropOn(masterId) {
    if (S.role === 'viewer') return false;                 // только просмотр
    if (S.role === 'admin') return true;
    if (S.role === 'master') return S.user && masterId === S.user.id;
    var m = masterById(masterId);
    return !!m && S.user && m.area === S.user.area;                       // nach / smaster
  }
  // Мастера по роли БЕЗ фильтра участка с панели мониторинга.
  // Использует ТОЛЬКО карта местоположения: там ВСЕГДА все участки —
  // админ, начальник участка и нач. СЭОГС видят всех мастеров независимо
  // от выбранного на дашборде участка; мастер — сам; смастер/слесарь — свой участок.
  function roleMasters() {
    var all = getMasters();
    if (S.role === 'admin' || S.role === 'viewer' || S.role === 'nach') return all;
    if (S.role === 'master') {
      var rml = all.filter(function (m) { return S.user && String(m.id) === String(S.user.id); }); // 22.09-188: id сравниваем строками
      if (!rml.length) rml = [woSelfMaster()]; // 22.09-189: страховка — вошедший мастер видит себя даже при устаревшей базе
      return rml;
    }
    return all.filter(function (m) { return S.user && m.area === S.user.area; }); // smaster, slesar
  }
  // Действует ли фильтр участка с панели мониторинга (админ / начальник участка / нач. СЭОГС)
  function dashAreaActive() {
    return !!S.dashArea && (S.role === 'admin' || S.role === 'nach' || S.role === 'viewer');
  }
  // Выбранный на панели мониторинга участок (S.dashArea) действует во ВСЕХ вкладках —
  // календарь, карта маршрутов, отчёты, карточка задачи и т.д. показывают данные
  // только выбранного участка (админ и начальник участка выбирают участок на дашборде;
  // «Все участки» = без фильтра). ИСКЛЮЧЕНИЕ — карта местоположения: там все участки
  // (renderLiveMap использует roleMasters, фильтр не применяется).
  function visibleMasters() {
    var all = getMasters();
    var list;
    if (S.role === 'admin' || S.role === 'viewer') list = all;
    else if (S.role === 'master') list = all.filter(function (m) { return S.user && String(m.id) === String(S.user.id); }); // 22.09-188
    else list = all.filter(function (m) { return S.user && m.area === S.user.area; }); // nach, smaster, slesar
    if (dashAreaActive()) list = all.filter(function (m) { return m.area === S.dashArea; });
    // 22.09-189: СТРАХОВКА — вошедший мастер всегда видит себя, даже если локальная
    // база пользователей устарела или его записи в ней нет (иначе — «мастер не видит свои работы»)
    if (S.user && S.role === 'master' && !dashAreaActive() && !list.some(function (m) { return String(m.id) === String(S.user.id); })) {
      list = list.concat([woSelfMaster()]);
    }
    return list;
  }
  // Псевдо-карточка вошедшего мастера из данных сессии (когда его записи нет в локальной базе)
  function woSelfMaster() {
    return { id: S.user.id, name: S.user.full_name || S.user.login || '?', full_name: S.user.full_name || S.user.login || '?', role: S.user.role, area: S.user.area || '', color: S.user.color || '#2563eb', active: true };
  }
  function visibleTasks() {
    var ids = {}; visibleMasters().forEach(function (m) { ids[m.id] = 1; });
    return S.tasks.filter(function (t) { return ids[t.m]; });
  }
  function masterById(id) { var u = DB.getUser(id); return u ? Object.assign({}, u, { name: u.full_name }) : null; }
  // Адрес задачи: из объекта или из введённого вручную
  function addrOf(t) { var o = OBJ_MAP[t.o]; return t.addr || (o ? objFullAddr(o) : '?'); }
  // Вид работы для задачи: берётся из каталога участка мастера (виды работ разные по участкам)
  function workOf(t) {
    if (!t) return null;
    var m = masterById(t.m);
    var area = (t.garea != null && t.garea !== '') ? t.garea : (m ? m.area : null); // garea — участок графика (задачи из графиков)
    if (t.works && t.works.length > 1) {
      var names = [], totalNorm = 0, units = [];
      t.works.forEach(function(wid) {
        var w = area ? WORK.getWork(area, wid) : WORK_MAP[wid];
        if (w) {
          names.push(w.name);
          totalNorm += w.norm;
          if (units.indexOf(w.unit) === -1) units.push(w.unit);
        }
      });
      return { id: t.works[0], name: names.join(' + '), norm: totalNorm, unit: units.join('/') || 'объект', group: 'Комплексные работы' };
    }
    if (m && m.area) { var w = WORK.getWork(m.area, t.w); if (w) return w; }
    return WORK_MAP[t.w] || null;
  }

  /* ---------- ЛОГИКА ЗАДАЧ (с объёмом, погодой, техникой) ---------- */
  // Расчёт трудозатрат: норма × объём (по единице измерения)
  // Подпись объёма задачи: свои объёмы у каждого вида работ → «2/50», иначе один
  function taskVolLabel(t) {
    if (t && t.volumes && t.volumes.length > 1) return t.volumes.join('/');
    return (t && t.volume != null) ? t.volume : 1;
  }
  function taskHours(t) {
    if (!t) return 0;
    var vol0 = parseFloat(t.volume) || 1;
    if (t.works && t.works.length > 0) {
      var m = masterById(t.m);
      var area = m ? m.area : null;
      var sum = 0;
      t.works.forEach(function(wid, i) {
        var w = area ? WORK.getWork(area, wid) : null;
        if (w) {
          // СВОЙ объём у каждого вида работ; fallback — общий объём задачи (старые записи)
          var vol = (t.volumes && t.volumes.length > i && parseFloat(t.volumes[i]) > 0) ? parseFloat(t.volumes[i]) : vol0;
          sum += w.norm * vol;
        }
      });
      return sum;
    }
    var w = workOf(t);
    if (!w) return 0;
    return w.norm * vol0;
  }
  /* 22.09-223: норма времени в справочнике — СУММАРНЫЕ человеко-часы ВСЕГО состава
     исполнителей (они работают параллельно: 2 слесаря по 1 часу делают работу за 1 час,
     а трудозатраты — 2 чел.-ч). В карточках по-прежнему показываем ОБЩУЮ норму
     (taskHours), а ЗАГРУЗКА дня мастера — это ДЛИТЕЛЬНОСТЬ работы: норма / число
     исполнителей. Число исполнителей берём из карточки вида работ: «Количество
     исполнителей» (crew_size), иначе сумма по составу (crew), иначе «Кол-во
     исполнителей (мин)» (min_workers), иначе 1. */
  function workCrewCount(w) {
    if (!w) return 1;
    var n = parseInt(w.crew_size, 10);
    if (isFinite(n) && n > 0) return n;
    var s = 0;
    (w.crew || []).forEach(function (e) { var c = parseInt(e && e.count, 10); if (isFinite(c) && c > 0) s += c; });
    if (s > 0) return s;
    var mn = parseInt(w.min_workers, 10);
    if (isFinite(mn) && mn > 1) return mn;
    return 1;
  }
  // Длительность задачи в часах (сколько реально занят мастер): человеко-часы / исполнителей
  function taskDurHours(t) {
    if (!t) return 0;
    var vol0 = parseFloat(t.volume) || 1;
    if (t.works && t.works.length > 0) {
      var md = masterById(t.m);
      var area = (t.garea != null && t.garea !== '') ? t.garea : (md ? md.area : null);
      var sum = 0;
      t.works.forEach(function(wid, i) {
        var w = area ? WORK.getWork(area, wid) : null;
        if (w) {
          // СВОЙ объём у каждого вида работ; fallback — общий объём задачи (как в taskHours)
          var vol = (t.volumes && t.volumes.length > i && parseFloat(t.volumes[i]) > 0) ? parseFloat(t.volumes[i]) : vol0;
          sum += (w.norm * vol) / workCrewCount(w);
        }
      });
      return sum;
    }
    var w = workOf(t);
    if (!w) return 0;
    return (w.norm * vol0) / workCrewCount(w);
  }

  // Проверка погодного ограничения

  // === ЗАГРУЗКА ПРОГНОЗА ПОГОДЫ ИЗ ЯНДЕКС.ПОГОДЫ / OPEN-METEO ===
  // Кэш: { 'YYYY-MM-DD': { temp: 15, snow: true, snowfall: 2.5, code: 61, desc: 'Снег' }, ... }
  var weatherCache = {};
  var weatherLoaded = false;
  var weatherLoading = false;

  // Запрос к Open-Meteo (бесплатный API, поддерживает CORS, данные эквивалентны Яндекс.Погоде)
  var WX_CACHE_KEY = 'smartplan_weather_cache';
  var WX_CACHE_KEY_V2 = 'smartplan_weather_cache_v2';
  // Описания погоды, которые ГАРАНТИРОВАННО приходят из Open-Meteo (decodeWeatherCode).
  // Если в кэше лежит что-то другое ("Прохладно/Тепло/Холодно" — это dummy из старой версии),
  // такой кэш считаем мусором.
  var WX_REAL_DESCS = ['Ясно','Облачно','Морось','Дождь','Снег','Ливень','Снег с ливнем','Гроза','Без осадков'];
  function _wxIsValid(d) {
    if (!d) return false;
    if (d._dummy) return false;
    if (typeof d.code !== 'number') return false;
    if (!d.date) return false;  // старый кэш без date (до коммита 6222a15) считаем мусором
    if (WX_REAL_DESCS.indexOf(d.desc) === -1) return false;  // dummy-описание
    return true;
  }
  function wxCacheGet() {
    try {
      // Сначала пробуем новый ключ v2
      var c = JSON.parse(localStorage.getItem(WX_CACHE_KEY_V2) || 'null');
      if (!c) {
        // Миграция со старого ключа: читаем, валидируем, перекладываем в v2
        c = JSON.parse(localStorage.getItem(WX_CACHE_KEY) || 'null');
        if (c && c.days) {
          var valid = c.days.filter(_wxIsValid);
          if (valid.length >= 5) {
            // Переложим в v2 — этого достаточно, чтобы не потерять данные
            try { localStorage.setItem(WX_CACHE_KEY_V2, JSON.stringify({ ts: c.ts || Date.now(), days: valid })); } catch (e) {}
          }
          // Старый ключ больше не нужен
          try { localStorage.removeItem(WX_CACHE_KEY); } catch (e) {}
          if (valid.length === 0) return null;
          return valid;
        }
        return null;
      }
      if (c && c.days && (Date.now() - c.ts) < 60 * 60 * 1000) {
        var validDays = c.days.filter(_wxIsValid);
        return validDays.length ? validDays : null;
      }
    } catch (e) {}
    return null;
  }
  function wxCacheSet(days) {
    try {
      // Сохраняем только валидные записи (на случай если кто-то передаст мусор)
      var valid = days.filter(_wxIsValid);
      localStorage.setItem(WX_CACHE_KEY_V2, JSON.stringify({ ts: Date.now(), days: valid }));
      // Подчищаем старый ключ, если остался
      try { localStorage.removeItem(WX_CACHE_KEY); } catch (e) {}
    } catch (e) {}
  }
  function loadWeatherFromOpenMeteo() {
    var lat = (window.SP_CONFIG && SP_CONFIG.weatherLat) || 53.9023;
    var lng = (window.SP_CONFIG && SP_CONFIG.weatherLng) || 27.5619;
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng +
      '&daily=temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_sum,weather_code,sunrise,sunset,windspeed_10m_max' +
      '&hourly=temperature_2m,precipitation_probability,snowfall,rain,weather_code' +
      '&timezone=Europe%2FMinsk&forecast_days=15';
    return fetch(url).then(function(r) { return r.json(); }).then(function(data) {
      if (!data || !data.daily) throw new Error('Нет данных о погоде');
      var days = data.daily.time || [];
      days.forEach(function(dateStr, i) {
        var tMax = data.daily.temperature_2m_max[i];
        var tMin = data.daily.temperature_2m_min[i];
        var avgTemp = Math.round(((tMax + tMin) / 2) * 10) / 10;
        var snowfall = data.daily.snowfall_sum[i] || 0;
        var precip = data.daily.precipitation_sum[i] || 0;
        var code = data.daily.weather_code[i] || 0;
        var info = decodeWeatherCode(code);
        
        // Почасовые данные (сопоставляем по дате дня — надёжнее, чем по индексу)
        var hourlyArr = [];
        if (data.hourly && data.hourly.time) {
          for (var h = 0; h < data.hourly.time.length; h++) {
            var hTime = data.hourly.time[h];
            // Сравниваем префикс даты "YYYY-MM-DD" с текущим днём
            if (hTime && hTime.indexOf(dateStr) === 0) {
              var hr = parseInt(hTime.substring(11, 13), 10);
              var t = data.hourly.temperature_2m[h];
              var hCode = data.hourly.weather_code[h] || 0;
              var hInfo = decodeWeatherCode(hCode);
              var hSnow = data.hourly.snowfall ? (data.hourly.snowfall[h] || 0) : 0;
              var hRain = data.hourly.rain ? (data.hourly.rain[h] || 0) : 0;
              var hProb = data.hourly.precipitation_probability ? (data.hourly.precipitation_probability[h] || 0) : 0;
              hourlyArr.push({
                hour: hr,
                temp: Math.round((t != null ? t : 0) * 10) / 10,
                desc: hInfo.desc,
                snow: hInfo.snow,
                snowfall: hSnow,
                rain: hRain,
                precipProb: hProb
              });
            }
          }
        }

        weatherCache[dateStr] = {
          temp: avgTemp,
          tempMax: tMax, tempMin: tMin,
          snow: snowfall > 0 || info.snow,
          snowfall: snowfall,
          rain: Math.max(0, precip - snowfall * 10), // мм дождя (снег в см → ~10мм/см)
          precip: precip,
          code: code,
          date: dateStr,
          desc: info.desc,
          wind: data.daily.windspeed_10m_max ? (data.daily.windspeed_10m_max[i] || 0) : 0,
          sunrise: data.daily.sunrise[i],
          sunset: data.daily.sunset[i],
          hourly: hourlyArr
        };
      });
      weatherLoaded = true;
    });
  }

  // Запрос к Яндекс.Погоде (требует API-ключ, может блокироваться CORS)
  function loadWeatherFromYandex() {
    var lat = (window.SP_CONFIG && SP_CONFIG.weatherLat) || 53.9023;
    var lng = (window.SP_CONFIG && SP_CONFIG.weatherLng) || 27.5619;
    var apiKey = '';
    var url = 'https://api.weather.yandex.ru/v2/forecast?lat=' + lat + '&lon=' + lng + '&limit=14&hours=false&extra=true';
    return fetch(url, {
      headers: {}
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (!data || !data.forecasts) throw new Error('Нет данных Яндекс.Погоды');
      data.forecasts.forEach(function(day) {
        var avg = day.parts && day.parts.day ? Math.round(day.parts.day.temp_avg * 10) / 10 : 0;
        var snow = false;
        var precip = 0;
        if (day.parts && day.parts.day) {
          var p = day.parts.day.prec_type; // 0 - нет, 1 - дождь, 2 - снег
          snow = (p === 2);
          precip = day.parts.day.prec_mm || 0;
        }
        weatherCache[day.date] = {
          temp: avg,
          snow: snow,
          snowfall: snow ? precip : 0,
          precip: precip,
          code: snow ? 75 : p === 1 ? 61 : 0,
          desc: snow ? 'Снег' : p === 1 ? 'Дождь' : 'Без осадков'
        };
      });
      weatherLoaded = true;
    });
  }

  // Загрузка прогноза погоды (главная функция)
  // ВАЖНО: сначала ВСЕГДА пробуем свежий запрос к Open-Meteo. Кэш используем
  // только как fallback при ошибке сети. Это гарантирует, что пользователь
  // увидит актуальный прогноз, а не устаревший кэш (в т.ч. если в нём лежат
  // dummy-записи «Прохладно» от предыдущих версий).
  function loadWeatherForecast() {
    if (weatherLoading) return Promise.resolve();

    // Предварительно подгружаем валидный кэш — он пригодится, если API недоступен
    var cachedDays = wxCacheGet();
    if (cachedDays && cachedDays.length) {
      cachedDays.forEach(function (d) { weatherCache[d.date] = d; });
      console.log('Кэш погоды (localStorage):', cachedDays.length, 'дней');
    }

    weatherLoading = true;
    var provider = (window.SP_CONFIG && SP_CONFIG.weatherProvider) || 'open-meteo';
    var yandexKey = (window.SP_CONFIG && SP_CONFIG.weatherApiKey) || '';

    var promise;
    if (provider === 'yandex' && yandexKey) {
      promise = loadWeatherFromYandex().catch(function(e) {
        console.warn('Яндекс.Погода недоступна, fallback на Open-Meteo:', e.message);
        return loadWeatherFromOpenMeteo();
      });
    } else {
      promise = loadWeatherFromOpenMeteo();
    }

    return promise.then(function() {
      weatherLoading = false;
      try { // сохранить в кэш на час
        var daysArr = Object.keys(weatherCache).map(function (k) { return weatherCache[k]; });
        if (daysArr.length) wxCacheSet(daysArr);
      } catch (e) {}
      console.log('Погода загружена:', Object.keys(weatherCache).length, 'дней');
      // Перерисовка текущего экрана для обновления погодных меток
      if (typeof window.reRenderCurrentScreen === 'function') {
        setTimeout(window.reRenderCurrentScreen, 100);
      }
    }).catch(function(err) {
      weatherLoading = false;
      console.error('Ошибка загрузки погоды:', err);
      // Если API упал — оставляем в weatherCache то, что было в кэше (если есть)
      // Если кэша нет — getWeatherForecast создаст dummy при первом запросе
      if (Object.keys(weatherCache).length && typeof window.reRenderCurrentScreen === 'function') {
        setTimeout(window.reRenderCurrentScreen, 100);
      }
    });
  }

  // Декодирование кода погоды Open-Meteo / WMO
  function decodeWeatherCode(code) {
    if (code === 0) return { desc: 'Ясно', snow: false };
    if (code <= 3) return { desc: 'Облачно', snow: false };
    if (code >= 51 && code <= 57) return { desc: 'Морось', snow: false };
    if (code >= 61 && code <= 67) return { desc: 'Дождь', snow: false };
    if (code >= 71 && code <= 77) return { desc: 'Снег', snow: true };
    if (code >= 80 && code <= 82) return { desc: 'Ливень', snow: false };
    if (code === 85 || code === 86) return { desc: 'Снег с ливнем', snow: true };
    if (code >= 95) return { desc: 'Гроза', snow: false };
    return { desc: 'Без осадков', snow: false };
  }

  // Синхронное чтение прогноза из кэша (вызывается из UI)
  // Если данных с сервера нет — генерирует правдоподобные данные, чтобы UI не ломался
  function getWeatherForecast(dayOff) {
    var d = offToDate(dayOff);
    var k = key(d);
    var cached = weatherCache[k];
    // Если в кэше лежат реальные данные (не dummy) — отдаём их
    if (cached && !cached._dummy) return cached;

    // Генерация запасных данных (если API недоступен или день не пришёл).
    // ВАЖНО: НЕ сохраняем dummy в weatherCache — иначе при асинхронной загрузке
    // (когда пользователь открыл дашборд/дропдаун раньше, чем пришёл ответ Open-Meteo)
    // dummy «затирает» реальные данные, и пользователь видит «Прохладно» вместо
    // нормального прогноза. Помечаем _dummy:true — loadWeatherForecast может
    // потом перезаписать или оставить.
    var month = d.getMonth();
    var temp;
    if (month === 11 || month === 0 || month === 1) temp = -5 - Math.floor(Math.random() * 10);
    else if (month >= 2 && month <= 4) temp = 5 + Math.floor(Math.random() * 8);
    else if (month >= 5 && month <= 7) temp = 18 + Math.floor(Math.random() * 10);
    else temp = 8 + Math.floor(Math.random() * 7);

    // dummy-описание (используется ТОЛЬКО если API не ответил и кэша нет).
    // Реальный прогноз Open-Meteo приходит сюда сам через loadWeatherForecast()
    // — после этого dummy-запись больше не возвращается.
    var desc = 'Без осадков';

    // Почасовые данные (реалистичная кривая температуры: минимум ~5:00, максимум ~15:00)
    var dummyHourly = [];
    for (var h = 0; h < 24; h++) {
      var curve = Math.sin((h - 9) * Math.PI / 12);
      var hTemp = Math.round((temp + curve * 4) * 10) / 10;
      dummyHourly.push({ hour: h, temp: hTemp, desc: desc, snow: false, snowfall: 0, rain: 0, precipProb: 0 });
    }

    var dummyWf = {
      temp: temp,
      desc: desc,
      snowfall: 0,
      rain: 0,
      precip: 0,
      wind: 3,
      hourly: dummyHourly,
      sunrise: key(d) + 'T06:00',
      sunset: key(d) + 'T20:00',
      date: key(d),
      _dummy: true
    };

    // Не сохраняем в weatherCache — пусть реальный API перезапишет.
    // Если API никогда не ответит — каждый вызов getWeatherForecast будет
    // генерировать свежий dummy (это нормально для fallback'а).
    return dummyWf;
  }

  // Проверка наличия снегопада в день (для снегозависимых работ)

  // Расчёт дедлайна для снегозависимых работ
  // Если есть данные о снегопаде — дедлайн = дата снегопада + 48ч норматива

  // Поиск последнего снегопада в прогнозе (для снегозависимых задач без даты)

  // Определение приоритета задачи
  function taskColor(t) {
    if (t.status === 'done' || t.s === 'done') return 'done';
    // Проверка погодного ограничения (температура)
    var w = workOf(t);
    if (w && w.min_temp > -50) {
      var wf = getWeatherForecast(t.d);
      if (wf && wf.temp != null && wf.temp < w.min_temp) return 'weather';
    }
    if (t.d < 0) return 'red';
    if (t.dl < 0) return 'red';
    if (t.dl <= 2) return 'yellow';
    return 'green';
  }
  function statusLabel(t) {
    var s = t.s || t.status;
    return s === 'done' ? 'Выполнено' : s === 'progress' ? 'В работе' : 'В плане';
  }
  function isDone(t) { return (t.s || t.status) === 'done'; }
  function loadForDay(masterId, off) {
    var sum = 0;
    S.tasks.forEach(function (t) { if (t.m === masterId && t.d === off && !isDone(t)) sum += taskDurHours(t); }); // 22.09-223: загрузка = длительность (норма делится на исполнителей)
    return sum;
  }

  /* ---------- DOM ---------- */
  var view = document.getElementById('view');
  var tip = document.getElementById('tip');
  var overlay = document.getElementById('overlay');
  var modal = document.getElementById('modal');
  // Тач-устройство (планшет без мыши): наведения нет, поэтому подменю
  // «Графики» держим раскрытым всегда (см. body.touch-ui в index.html)
  if (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
    document.body.classList.add('touch-ui');
  }

  // 22.09-219: номер текущей сборки — показывается в шапке страницы и метке на экране входа.
  // Описания изменений больше НЕ пишутся в шапку — они в журнале (SP_CHANGELOG, data.js).
  var SP_BUILD = '22.09-264';
  try { window.SP_BUILD = SP_BUILD; } catch (eWB) {} // сборка видна логу ошибок (error_log.js)
  // Скрытая метка авторства (видна только в консоли разработчика, F12):
  // сайт SmartPlan создан Омельчуком Ильёй Анатольевичем, оператором ПЭВМ УП «МИНГАЗ»; все права защищены (© 2026)
  try { console.log('%cSmartPlan © 2026 Омельчук Илья Анатольевич · оператор ПЭВМ УП «МИНГАЗ» · все права защищены', 'color:#64748b;font-size:12px'); } catch (eC) {}
  var TITLES = {
    dashboard: 'Панель мониторинга',
    calendar: 'Планирование / Календарь',
    graphs: 'Планирование / График работ',
    map: 'Карта маршрутов',
    objmap: 'Карта объектов',
    testmap: 'Тест проезда',
    testdep: 'Тест зависимости',
    livemap: 'Карта местоположения',
    perms: 'Разрешения',
    refs: 'Справочники',
    writeoffs: 'Списания',
    workcards: 'Карточки работ на день',
    factmonth: 'Факт работ по объектам',
    workers: 'Работники',
    schedules: 'Графики смен',
    adminctl: 'Управление администрированием',
    users: 'Пользователи',
    reports: 'Отчёты',
    logs: 'Журнал действий',
    changelog: 'Журнал изменений',
    backup: 'Бэкапы баз данных'
  };

  /* ---------- ИКОНКИ ---------- */
  var IC = {
    warn: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h7l-1 8 10-12h-7z"/></svg>',
    route: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3.5 3.5 0 000-7H9a3.5 3.5 0 010-7h6.5"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    download: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
    upload: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>',
    grip: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>'
  };

