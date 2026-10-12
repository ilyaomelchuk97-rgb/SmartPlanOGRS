  /* ── часть 12 · app/12_writeoffs.js — списания, «Приступил/Закончил», карточки работ на день, факт работ, окно списания ── */
  /* =====================================================================
     РЕНДЕР: СПИСАНИЯ (закрытые в планировании задачи)
     22.09-181: страница в меню под «Справочниками» — список закрытых задач
     с плановой датой и датой закрытия, поиск сверху; клик по карточке —
     окно с адресом, работой, мастером, слесарями и видами работ.
     ===================================================================== */

  // 22.09-181: проставить/снять дату закрытия задачи (вызывается при отметке «выполнено»)
  function stampTaskDoneDate(t, nowDone) {
    if (!t) return;
    if (nowDone) { if (!t.done_date) t.done_date = key(new Date()); }
    else { delete t.done_date; }
  }

  /* ===== 22.09-190: ФАКТ РАБОТЫ НА ОБЪЕКТЕ — «Приступил» / «Закончил» =====
     Мастер жмёт «Приступил» на объекте — пишется started_at, задача уходит в
     статус «В работе». Жмёт «Закончил» — пишется finished_at, задача
     закрывается (как галочка, с датой закрытия). Галочка «выполнено» без
     кнопок тоже фиксирует время конца. Поля едут в задаче через updateTask —
     синхронизируются сами. */
  function taskStart(id) {
    var t = findTask(id); if (!t || isDone(t)) return;
    if (!canEditTask(t)) { toast('err', 'Нет прав на изменение этой задачи'); return; }
    t.started_at = Date.now();
    t.s = 'progress'; t.status = 'progress';
    if (TASKS_DB) TASKS_DB.updateTask(t.id, t);
    try { S.tasks = TASKS_DB ? TASKS_DB.getTasks() : S.tasks; } catch (e) {}
    var _m = masterById(t.m);
    logAction('Начало работ на объекте', addrOf(t) + ' · ' + (_m ? _m.name : t.m) + ' · ' + fmtClock(t.started_at));
    toast('ok', '▶ Работа начата в ' + fmtClock(t.started_at) + '. По окончании нажмите «Закончил» — запишется время и задача закроется.');
    refresh();
  }
  function taskFinish(id) {
    var t = findTask(id); if (!t || isDone(t)) return;
    if (!canEditTask(t)) { toast('err', 'Нет прав на изменение этой задачи'); return; }
    return spConfirm('Завершить работу и отметить задачу выполненной?\n' + addrOf(t) +
      (t.started_at ? '\nНачата в ' + fmtClock(t.started_at) + ', сейчас ' + fmtClock(Date.now()) : ''), { title: 'Завершение работы', ok: 'Завершить' }, function () { // 22.09-244
    t.finished_at = Date.now();
    t.s = 'done'; t.status = 'done';
    stampTaskDoneDate(t, true);
    if (TASKS_DB) TASKS_DB.updateTask(t.id, t);
    try { S.tasks = TASKS_DB ? TASKS_DB.getTasks() : S.tasks; } catch (e) {}
    var _m = masterById(t.m);
    var fh = taskFactHours(t);
    logAction('Окончание работ на объекте', addrOf(t) + ' · ' + (_m ? _m.name : t.m) + ' · ' + fmtClock(t.finished_at) + (fh != null ? ' · факт ' + fmtH(fh) + ' ч' : ''));
    toast('ok', '✓ Работа завершена в ' + fmtClock(t.finished_at) + (fh != null ? ' · потрачено ' + fmtH(fh) + ' ч' : ''));
    refresh();
    });
  }
  // Ячейка факта в строке задачи блока «Сегодня»: кнопки / пометка / итог
  /* 22.09-248: в блоке «Сегодня» панели мониторинга — только отметка факта, БЕЗ кнопок:
     «Приступил» / «Закончил» нажимают в «Карточках работ на день» (клик по ФИО мастера). */
  function taskDayStatusHtml(t) {
    if (isDone(t)) {
      if (!t.finished_at) return '';
      var span = (t.started_at ? fmtClock(t.started_at) + '–' : '') + fmtClock(t.finished_at);
      var fh0 = taskFactHours(t);
      return '<span style="color:#16a34a;font-weight:700;font-size:12.5px;white-space:nowrap" title="Фактическое время работы на объекте">✓ ' + span + (fh0 != null ? ' (' + fmtH(fh0) + ' ч)' : '') + '</span>';
    }
    return t.started_at ? '<span style="color:#d97706;font-size:12px;font-weight:700;white-space:nowrap" title="Работа начата — ждём окончания">⏳ с ' + fmtClock(t.started_at) + '</span>' : '';
  }

  /* ===== 22.09-191: КАРТОЧКИ РАБОТ НА ДЕНЬ =====
     Клик по ФИО мастера в блоке «Сегодня» панели мониторинга — открывается
     страница: по каждой работе мастера на этот день — своя карточка (адрес,
     виды работ, слесаря, план, крупные кнопки «Приступил»/«Закончил»).
     Мастер видит только свои работы (у него в панели одна строка — его). */
  function wcOpen(mid, dayOff) {
    S.wcMasterId = mid;
    S.wcDayOff = (typeof dayOff === 'number' && isFinite(dayOff)) ? dayOff : 0;
    S.wcBack = S.screen;
    setScreen('workcards');
  }
  // Крупные кнопки факта — в карточке работы
  function wcCtlHtml(t, dayOff) {
    if (isDone(t)) {
      var span = t.finished_at ? ((t.started_at ? fmtClock(t.started_at) + ' – ' : '') + fmtClock(t.finished_at)) : '';
      var fh = taskFactHours(t);
      return '<div style="display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 14px;color:#166534;font-weight:800">✓ Работа закончена' + (span ? ' · ' + span : '') + (fh != null ? ' · ' + fmtH(fh) + ' ч' : '') + '</div>';
    }
    if (dayOff !== 0 || !canEditTask(t)) {
      return t.started_at ? '<div style="color:#d97706;font-weight:700">⏳ Работа начата в ' + fmtClock(t.started_at) + '</div>' : '';
    }
    if (!t.started_at) return '<button type="button" class="btn primary" data-action="task-start" data-tid="' + esc(t.id) + '" style="width:100%;padding:13px;font-size:15px;font-weight:800;background:#16a34a;border-color:#16a34a" title="Нажмите, когда приступили к работе на объекте — запишется время начала">▶ Приступил к работе</button>';
    return '<div style="display:flex;align-items:center;gap:10px"><span style="color:#d97706;font-weight:800;font-size:14px;white-space:nowrap">⏳ работа идёт с ' + fmtClock(t.started_at) + '</span><button type="button" class="btn primary" data-action="task-finish" data-tid="' + esc(t.id) + '" style="flex:1;padding:13px;font-size:15px;font-weight:800;background:#dc2626;border-color:#dc2626" title="Нажмите по окончании работ — запишется время конца и задача закроется">■ Закончил</button></div>';
  }
  function renderWorkCards() {
    var view = document.getElementById('view'); if (!view) return;
    var mid = S.wcMasterId;
    var dayOff = (typeof S.wcDayOff === 'number' && isFinite(S.wcDayOff)) ? S.wcDayOff : 0;
    var m = masterById(mid);
    var mname = m ? m.name : (S.user && String(S.user.id) === String(mid) ? (S.user.full_name || S.user.login || 'я') : (mid || '?'));
    var ts = S.tasks.filter(function (t) { return String(t.m) === String(mid) && t.d === dayOff; }); // 22.09-188: id — строками
    // порядок: в работе → в плане → выполненные
    ts.sort(function (ra, rb) {
      var ka = isDone(ra) ? 2 : (ra.started_at ? 0 : 1);
      var kb = isDone(rb) ? 2 : (rb.started_at ? 0 : 1);
      return ka - kb;
    });
    var dayHtml = dayOff === 0 ? 'сегодня' : esc(fmt(offToDate(dayOff)));
    var html = '<div class="card" style="margin-bottom:12px"><div class="card-b" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
      '<button type="button" class="btn" data-action="wc-back" title="Вернуться назад">← Назад</button>' +
      '<div style="font-size:16px;font-weight:800;color:var(--ink)">📋 ' + esc(mname) + '</div>' +
      '<div style="font-size:12.5px;color:var(--muted);font-weight:700">' + dayHtml + ' · работ: ' + ts.length + '</div></div></div>';
    if (!ts.length) html += '<div class="card"><div class="card-b"><div class="empty">На ' + dayHtml + ' работ нет</div></div></div>';
    ts.forEach(function (t) {
      var w = workOf(t);
      var stCol = isDone(t) ? '#16a34a' : (t.started_at ? '#d97706' : 'var(--muted)');
      html += '<div class="card" style="margin-bottom:12px"><div class="card-b">' +
        '<div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:8px">' +
          '<div style="flex:1;min-width:200px;font-size:14.5px;font-weight:800;color:var(--ink)">🔧 ' + esc(w ? w.name : writeoffWorkNames(t).join(', ') || '?') + '</div>' +
          '<span style="font-size:12px;font-weight:800;color:' + stCol + ';white-space:nowrap">' + esc(statusLabel(t)) + '</span></div>' +
        '<div style="font-size:13px;color:var(--txt);margin-bottom:6px">📍 <b>' + esc(addrOf(t)) + '</b></div>' +
        (t.works && t.works.length > 1 ? '<div style="font-size:12px;color:var(--muted);margin-bottom:6px">виды работ: ' + esc(writeoffWorkNames(t).join(' · ')) + '</div>' : '') +
        '<div style="font-size:12px;color:var(--muted);margin-bottom:6px">👷 ' + esc(writeoffSlesariNames(t) || 'слесаря не указаны') + '</div>' +
        '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);font-weight:600;margin-bottom:10px">' +
          '<span>⏱ план: <b style="color:var(--ink)">' + fmtH(taskHours(t)) + ' ч</b></span>' +
          ((t.volume || 1) > 1 ? '<span>объём: <b style="color:var(--ink)">' + esc(String(t.volume)) + '</b></span>' : '') +
          '<span>дедлайн: <b style="color:' + (t.dl <= 2 ? 'var(--red)' : 'var(--ink)') + '">' + esc(fmtShort(t.dl)) + '</b></span>' +
        '</div>' +
        wcCtlHtml(t, dayOff) +
      '</div></div>';
    });
    view.innerHTML = html;
  }

  /* =====================================================================
     22.09-192: МЕСЯЧНЫЙ ОТЧЁТ «ФАКТ РАБОТ ПО ОБЪЕКТАМ»
     За выбранный месяц по каждому объекту: кто и когда работал (время по
     кнопкам «Приступил»/«Закончил»), фактические часы против плановых.
     Выезд попадает в месяц по отметкам времени или по закрытию задачи;
     закрытые без отметок показаны пометкой «без факта времени».
     ===================================================================== */

  // Ключ месяца 'YYYY-MM' по году/месяцу
  function fmMonthKey(y, m) { return y + '-' + String(m + 1).padStart(2, '0'); }
  // Относится ли задача к месяцу: по отметкам времени или по закрытию (дата закрытия)
  function fmTaskInMonth(t, mk) {
    if (t.started_at && key(new Date(t.started_at)).slice(0, 7) === mk) return true;
    if (t.finished_at && key(new Date(t.finished_at)).slice(0, 7) === mk) return true;
    if (isDone(t) && writeoffCloseIso(t).slice(0, 7) === mk) return true;
    return false;
  }
  // Имя мастера строкой (запасной вариант, когда записи нет в базе пользователей)
  function fmMasterName(t) {
    var m = masterById(t.m);
    if (m) return m.name;
    if (S.user && String(S.user.id) === String(t.m)) return S.user.full_name || S.user.login || 'я';
    return '?';
  }
  // Перелистнуть месяц отчёта
  function fmShift(d) {
    if (S.fmYear == null || S.fmMonth == null) { S.fmYear = TODAY.getFullYear(); S.fmMonth = TODAY.getMonth(); }
    var m = S.fmMonth + d, y = S.fmYear;
    while (m < 0) { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }
    S.fmYear = y; S.fmMonth = m;
    renderFactMonth();
  }

  function renderFactMonth() {
    // 22.09-220: страница «Факт работ по объектам» переехала в окно из панели мониторинга
    // (клик по блоку «Выполнено за месяц»); функционал тот же, цель рендера — окно
    var view = S.factModal ? document.getElementById('modal') : document.getElementById('view'); if (!view) return;
    if (S.fmYear == null || S.fmMonth == null) { S.fmYear = TODAY.getFullYear(); S.fmMonth = TODAY.getMonth(); }
    var mk = fmMonthKey(S.fmYear, S.fmMonth);
    // Выезды месяца — сгруппированы по объектам
    var groups = {}, order = [];
    visibleTasks().forEach(function (t) {
      if (!fmTaskInMonth(t, mk)) return;
      var gk = t.o || ('addr:' + addrOf(t));
      if (!groups[gk]) { groups[gk] = { addr: addrOf(t), rows: [], factH: 0, planH: 0 }; order.push(gk); }
      var fh = taskFactHours(t);
      groups[gk].rows.push({ t: t, fh: fh });
      if (fh != null) groups[gk].factH += fh;
      groups[gk].planH += taskHours(t);
    });
    order.sort(function (a, b) { return groups[a].addr.localeCompare(groups[b].addr, 'ru'); });
    order.forEach(function (gk) {
      groups[gk].rows.sort(function (ra, rb) {
        var da = ra.t.started_at || (ra.t.done_date ? new Date(ra.t.done_date + 'T00:00:00').getTime() : 0);
        var db = rb.t.started_at || (rb.t.done_date ? new Date(rb.t.done_date + 'T00:00:00').getTime() : 0);
        if (da !== db) return da - db;
        return fmMasterName(ra.t).localeCompare(fmMasterName(rb.t), 'ru');
      });
    });
    // Итоги за месяц
    var totFact = 0, totPlan = 0, totVisits = 0, totNoFact = 0;
    order.forEach(function (gk) {
      var g = groups[gk];
      totFact += g.factH; totPlan += g.planH; totVisits += g.rows.length;
      g.rows.forEach(function (r) { if (r.fh == null) totNoFact++; });
    });
    var html = '<div class="card" style="margin-bottom:12px"><div class="card-b">' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<button type="button" class="btn" data-action="fm-prev" title="Предыдущий месяц">‹</button>' +
        '<div style="font-size:16px;font-weight:800;color:var(--ink);min-width:160px;text-align:center">📅 ' + esc(MON_NOM[S.fmMonth]) + ' ' + S.fmYear + '</div>' +
        '<button type="button" class="btn" data-action="fm-next" title="Следующий месяц">›</button>' +
        '<button type="button" class="btn" data-action="fm-cur" title="Вернуться к текущему месяцу">Текущий месяц</button>' +
      '</div>' +
      (order.length ? '<div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:10px;font-size:12.5px;color:var(--muted);font-weight:700">' +
        '<span>объектов: <b style="color:var(--ink)">' + order.length + '</b></span>' +
        '<span>выездов: <b style="color:var(--ink)">' + totVisits + '</b></span>' +
        '<span>⏱ факт: <b style="color:#2563eb">' + fmtH(totFact) + ' ч</b></span>' +
        '<span>план: <b style="color:var(--ink)">' + fmtH(totPlan) + ' ч</b></span>' +
        (totNoFact ? '<span style="color:#d97706" title="Закрыты без отметок «Приступил»/«Закончил» — фактического времени у них нет">без факта времени: ' + totNoFact + '</span>' : '') +
      '</div>' : '') +
    '</div></div>';
    if (!order.length) {
      html += '<div class="card"><div class="card-b"><div class="empty">За ' + MON_NOM[S.fmMonth].toLowerCase() + ' ' + S.fmYear + ' выездов на объекты нет.<br>' +
        '<span style="font-size:12px">Выезд появляется здесь, когда мастер жмёт «Приступил» / «Закончил» в панели мониторинга или задача закрыта галочкой.</span></div></div></div>';
      view.innerHTML = (S.factModal ? ('<div class="modal-h"><h3>📋 Факт работ по объектам</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">' + html + '</div>') : html);
      return;
    }
    order.forEach(function (gk) {
      var g = groups[gk];
      html += '<div class="card" style="margin-bottom:10px"><div class="card-b">' +
        '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:6px">' +
          '<div style="flex:1;min-width:220px;font-size:14px;font-weight:800;color:var(--ink)">📍 ' + esc(g.addr) + '</div>' +
          '<div style="font-size:12px;color:var(--muted);font-weight:700;white-space:nowrap">выездов: ' + g.rows.length +
            ' · ⏱ факт: <b style="color:#2563eb">' + fmtH(g.factH) + ' ч</b>' +
            ' · план: <b style="color:var(--ink)">' + fmtH(g.planH) + ' ч</b></div>' +
        '</div>';
      g.rows.forEach(function (r) {
        var t = r.t, w = workOf(t);
        var dateIso = t.started_at ? key(new Date(t.started_at)) : writeoffCloseIso(t);
        html += '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:7px 0;border-top:1px solid var(--line)">' +
          '<div style="font-size:12.5px;font-weight:800;color:var(--ink);white-space:nowrap;min-width:84px">' + esc(fmtDmyIso(dateIso)) + '</div>' +
          '<div style="flex:1;min-width:220px">' +
            '<div style="font-size:12.5px;color:var(--txt)">🔧 ' + esc((w && w.name) || writeoffWorkNames(t).join(', ') || '?') + '</div>' +
            '<div style="font-size:12.5px;color:var(--muted)">👷 ' + esc(fmMasterName(t)) + '</div>' +
          '</div>' +
          '<div style="font-size:12px;font-weight:700;white-space:nowrap;text-align:right;line-height:1.5">' +
            ((t.started_at || t.finished_at)
              ? '<span style="color:var(--muted)">▶ ' + (t.started_at ? fmtClock(t.started_at) : '?') + ' – ■ ' + (t.finished_at ? fmtClock(t.finished_at) : '…') + '</span><br>' +
                (r.fh != null
                  ? '<span style="color:#2563eb">' + fmtH(r.fh) + ' ч факт</span> <span style="color:var(--muted)">/ ' + fmtH(taskHours(t)) + ' ч план</span>'
                  : '<span style="color:#d97706">в работе</span> <span style="color:var(--muted)">/ ' + fmtH(taskHours(t)) + ' ч план</span>')
              : '<span style="color:#d97706" title="Задача закрыта без отметок «Приступил»/«Закончил» — фактических часов нет">без факта времени</span><br><span style="color:var(--muted)">' + fmtH(taskHours(t)) + ' ч план</span>') +
          '</div>' +
        '</div>';
      });
      html += '</div></div>';
    });
    view.innerHTML = (S.factModal ? ('<div class="modal-h"><h3>📋 Факт работ по объектам</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">' + html + '</div>') : html);
  }

  // Плановая дата задачи ISO ('YYYY-MM-DD'), '' если дня нет
  function writeoffPlanIso(t) { return (t && t.d != null) ? key(offToDate(t.d)) : ''; }
  // Дата закрытия ISO: записанная при закрытии; для старых задач без неё — плановая
  function writeoffCloseIso(t) { return (t && t.done_date) ? t.done_date : writeoffPlanIso(t); }

  // Названия видов работ задачи (для списка и окна списания)
  function writeoffWorkNames(t) {
    if (!t) return [];
    var m = masterById(t.m);
    var area = (t.garea != null && t.garea !== '') ? t.garea : (m ? m.area : null);
    var ids = (t.works && t.works.length) ? t.works : (t.w ? [t.w] : []);
    return ids.map(function (wid) {
      var w = area ? WORK.getWork(area, wid) : WORK_MAP[wid];
      return w ? w.name : String(wid || '?');
    });
  }

  // Слесаря задачи строкой: конкретные ФИО или «Вся бригада участка»
  function writeoffSlesariNames(t) {
    if (!t) return '—';
    if (t.brigade) return 'Вся бригада участка';
    if (t.slesari && t.slesari.length) {
      return t.slesari.map(function (id) { var u = DB.getUser(id); return u ? u.full_name : String(id); }).join(', ');
    }
    return '—';
  }

  // Закрытые задачи, видимые текущей роли: свежие закрытия сверху
  function writeoffDoneTasks() {
    return visibleTasks().filter(function (t) { return isDone(t); }).sort(function (a, b) {
      var ka = writeoffCloseIso(a), kb = writeoffCloseIso(b);
      if (ka !== kb) return ka < kb ? 1 : -1;
      var pa = writeoffPlanIso(a), pb = writeoffPlanIso(b);
      if (pa !== pb) return pa < pb ? 1 : -1;
      return String(a.id).localeCompare(String(b.id));
    });
  }

  function renderWriteoffs() {
    var view = document.getElementById('view'); if (!view) return;
    if (S.woQuery == null) S.woQuery = '';
    var html = '<div class="card" style="margin-bottom:12px"><div class="card-b">' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<input id="wo-search" type="text" value="' + esc(S.woQuery) + '" placeholder="🔍 Поиск: адрес, работа, мастер, слесарь, дата…" style="flex:1;min-width:220px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:13px;font-family:inherit;background:var(--card);color:var(--ink)">' +
        '<span id="wo-count" style="font-size:12px;color:var(--muted);font-weight:700;white-space:nowrap"></span>' +
      '</div></div></div>' +
      '<div id="wo-list"></div>';
    view.innerHTML = html;
    woRenderList();
    var inp = document.getElementById('wo-search');
    if (inp) inp.addEventListener('input', function () { S.woQuery = inp.value; woRenderList(); });
  }

  // Список закрытых задач с учётом строки поиска (перерисовывается без потери фокуса в поле)
  function woRenderList() {
    var host = document.getElementById('wo-list'); if (!host) return;
    var q = (S.woQuery || '').trim().toLowerCase();
    var all = writeoffDoneTasks();
    var items = all;
    if (q) {
      items = all.filter(function (t) {
        var m = masterById(t.m), w = workOf(t);
        var hay = [addrOf(t), w ? w.name : '', m ? m.name : '', writeoffSlesariNames(t),
          writeoffWorkNames(t).join(' '), fmtDmyIso(writeoffPlanIso(t)), fmtDmyIso(writeoffCloseIso(t)),
          writeoffPlanIso(t), writeoffCloseIso(t)].join('\n').toLowerCase();
        return hay.indexOf(q) !== -1;
      });
    }
    var cnt = document.getElementById('wo-count');
    if (cnt) cnt.textContent = q ? ('Найдено: ' + items.length + ' из ' + all.length) : ('Всего: ' + all.length);
    if (!all.length) {
      host.innerHTML = '<div class="card"><div class="card-b"><div class="empty">Закрытых задач пока нет.<br><span style="font-size:12px">Отметьте задачу выполненной в «Планировании» — она появится здесь с датой закрытия.</span></div></div></div>';
      return;
    }
    if (!items.length) {
      host.innerHTML = '<div class="card"><div class="card-b"><div class="empty">По запросу «' + esc(S.woQuery) + '» ничего не найдено.</div></div></div>';
      return;
    }
    var html = '';
    items.forEach(function (t) {
      var w = workOf(t), m = masterById(t.m);
      var planIso = writeoffPlanIso(t), closeIso = writeoffCloseIso(t);
      var legacy = !t.done_date; // задача закрыта до появления даты закрытия — дата по плановой
      html += '<div class="card" style="margin-bottom:10px"><div class="card-b" data-action="wo-open" data-tid="' + esc(t.id) + '" style="cursor:pointer;display:flex;align-items:center;gap:14px;flex-wrap:wrap" title="Нажмите — подробности списания">' +
        '<div style="flex:1;min-width:220px">' +
          '<div style="font-weight:700;color:var(--ink);font-size:13.5px;margin-bottom:3px">📍 ' + esc(addrOf(t)) + '</div>' +
          '<div style="font-size:12px;color:var(--txt);margin-bottom:2px">🔧 ' + esc(w ? w.name : '?') + '</div>' +
          '<div style="font-size:12.5px;color:var(--muted)">👷 ' + esc(m ? m.name : '?') + ' · ' + esc(m ? m.area : '') + '</div>' +
        '</div>' +
        '<div style="text-align:right;font-size:12px;line-height:1.6;white-space:nowrap">' +
          '<div style="color:var(--muted);font-weight:600">📅 План: <b style="color:var(--ink)">' + esc(fmtDmyIso(planIso)) + '</b></div>' +
          '<div style="color:var(--muted);font-weight:600">✅ Закрыта: <b style="color:#16a34a">' + esc(fmtDmyIso(closeIso)) + '</b>' + (legacy ? ' <span style="color:var(--muted)" title="Задача закрыта до появления даты закрытия — показана плановая дата">≈</span>' : '') + '</div>' +
          (t.started_at || t.finished_at ? '<div style="color:var(--muted);font-weight:600" title="Фактическое время работы на объекте (кнопки «Приступил»/«Закончил»)">⏱ Факт: <b style="color:var(--ink)">' + (t.started_at ? fmtClock(t.started_at) : '?') + ' – ' + (t.finished_at ? fmtClock(t.finished_at) : '?') + '</b>' + (taskFactHours(t) != null ? ' · <b style="color:#2563eb">' + fmtH(taskFactHours(t)) + ' ч</b>' : '') + '</div>' : '') +
        '</div></div></div>';
    });
    host.innerHTML = html;
  }

  /* =====================================================================
     22.09-185: ОКНО СПИСАНИЯ — материалы ПО ВИДАМ РАБОТ
     Справа — широкий столбец с материалами из 1С (пока тестовые данные):
     материал, количество, ед. изм., стоимость. Виды работ задачи —
     переключаемые кнопки-тэги: у каждой работы СВОЙ список списания.
     Снизу — блок «Материалы к списанию» выбранной работы: что и сколько
     списываем. Перенос — кнопкой «+» или перетаскиванием строки (как
     задачи в планировании) — материал попадает в выбранную работу.
     ===================================================================== */

  // Тестовые материалы «из 1С» — потом заменятся на реальную выгрузку
  function wo1cMaterials() {
    return [
      { id: 'wm1',  name: 'Труба ПЭ100 SDR11 63 мм',            qty: 48,  unit: 'м',  price: 14.25 },
      { id: 'wm2',  name: 'Труба ПЭ100 SDR17,6 110 мм',         qty: 24,  unit: 'м',  price: 28.60 },
      { id: 'wm3',  name: 'Муфта электросварная 63 мм',         qty: 14,  unit: 'шт', price: 9.80 },
      { id: 'wm4',  name: 'Отвод ПЭ 90° 63 мм',                 qty: 8,   unit: 'шт', price: 11.40 },
      { id: 'wm5',  name: 'Кран шаровой ПЭ Ду 63',              qty: 2,   unit: 'шт', price: 240.00 },
      { id: 'wm6',  name: 'Седелка сварная 110×63',             qty: 6,   unit: 'шт', price: 17.95 },
      { id: 'wm7',  name: 'Лента сигнальная «Газ» 250 мм',      qty: 180, unit: 'м',  price: 0.42 },
      { id: 'wm8',  name: 'Проволока сопроводительная (медь)',  qty: 180, unit: 'м',  price: 0.85 },
      { id: 'wm9',  name: 'Манжета резиновая 110 мм',           qty: 10,  unit: 'шт', price: 6.30 },
      { id: 'wm10', name: 'Паста уплотнительная «Унипак»',      qty: 3,   unit: 'шт', price: 5.55 }
    ];
  }

  function woMatById(id) {
    var list = wo1cMaterials();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  // Цена строкой: 1 234,56 руб.
  function woFmtMoney(n) {
    var v = Math.round((+n || 0) * 100) / 100;
    var parts = v.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join(',') + ' руб.';
  }

  // Количество строкой без лишних нулей: 12,5 / 48
  function woFmtQty(n) {
    var v = Math.round((+n || 0) * 1000) / 1000;
    return String(v).replace('.', ',');
  }

  // Список списания конкретного вида работ текущей задачи (создаётся по требованию)
  function woSelGroup(wi) {
    if (!S.woTid) return [];
    if (!S.woSelByWork) S.woSelByWork = {};
    var g = S.woSelByWork[S.woTid] || (S.woSelByWork[S.woTid] = {});
    return g[wi] || (g[wi] = []);
  }

  // Выбрать вид работ для списания (активный тэг): его список — живая ссылка в S.woSelMats
  function woPickWork(wi) {
    S.woWorkIdx = wi;
    S.woSelMats = woSelGroup(wi);
    woRenderWorks(); woRenderMats(); woRenderSel();
  }

  // Итого по выбранному виду работ (руб.)
  function woSelTotal() {
    var tot = 0;
    (S.woSelMats || []).forEach(function (it) {
      var mat = woMatById(it.id);
      if (mat) tot += mat.price * (+it.qty || 0);
    });
    return tot;
  }

  // Итого по всей задаче — сумма списаний всех видов работ (руб.)
  function woGrandTotal() {
    var tot = 0;
    var g = (S.woSelByWork && S.woTid) ? S.woSelByWork[S.woTid] : null;
    if (g) for (var k in g) {
      (g[k] || []).forEach(function (it) {
        var mat = woMatById(it.id);
        if (mat) tot += mat.price * (+it.qty || 0);
      });
    }
    return tot;
  }

  function woSelHas(id) {
    return (S.woSelMats || []).some(function (it) { return it.id === id; });
  }

  // Виды работ задачи — переключаемые кнопки-тэги; у активной зелёная подсветка, на каждой счётчик позиций
  function woRenderWorks() {
    var host = document.getElementById('wo-works'); if (!host) return;
    var t = findTask(S.woTid); if (!t) return;
    var names = writeoffWorkNames(t);
    if (!names.length) { host.innerHTML = '<div style="color:var(--muted);font-size:12.5px">—</div>'; return; }
    if (S.woWorkIdx == null || S.woWorkIdx < 0 || S.woWorkIdx > names.length - 1) S.woWorkIdx = 0;
    if (!S.woSelMats) S.woSelMats = woSelGroup(S.woWorkIdx);
    var html = '';
    names.forEach(function (name, wi) {
      var cnt = woSelGroup(wi).length;
      var on = wi === S.woWorkIdx;
      html += '<button type="button" data-action="wo-work-pick" data-idx="' + wi + '" title="Списывать материалы по этой работе" style="display:inline-flex;align-items:center;gap:5px;margin:0 6px 6px 0;padding:5px 11px;border:' + (on ? '2px solid #16a34a' : '1px solid var(--line)') + ';border-radius:999px;background:' + (on ? '#dcfce7' : 'var(--card)') + ';color:var(--ink);font-size:12px;font-weight:' + (on ? '800' : '600') + ';cursor:pointer;font-family:inherit">' +
        '🔧 ' + esc(name) +
        '<span style="min-width:17px;text-align:center;background:' + (cnt ? '#16a34a' : '#e2e8f0') + ';color:' + (cnt ? '#fff' : 'var(--muted)') + ';border-radius:999px;padding:1px 5px;font-size:11.5px;font-weight:800">' + cnt + '</span>' +
      '</button>';
    });
    host.innerHTML = html;
  }

  // Правый широкий столбец: материалы из 1С построчно (материал, кол-во, ед., цена)
  function woRenderMats() {
    var host = document.getElementById('wo-mats'); if (!host) return;
    var grid = 'display:grid;grid-template-columns:minmax(0,1fr) 78px 96px 32px;gap:6px;align-items:center';
    var html = '<div style="' + grid + ';padding:6px 10px;background:#f1f5f9;border:1px solid var(--line);border-radius:8px 8px 0 0;font-size:12px;color:var(--muted);font-weight:800;letter-spacing:.4px">' +
      '<div>МАТЕРИАЛ (ИЗ 1С)</div><div style="text-align:right">КОЛ-ВО</div><div style="text-align:right">ЦЕНА</div><div></div></div>';
    var mats = wo1cMaterials();
    mats.forEach(function (mat, mi) {
      var added = woSelHas(mat.id); // галочка — если материал уже есть в ВЫБРАННОЙ работе (в других работах он может быть тоже)
      html += '<div draggable="true" data-wmat="' + mat.id + '" style="' + grid + ';padding:8px 10px;border:1px solid var(--line);border-top:none;background:var(--card);cursor:grab' + (added ? ';opacity:.55' : '') + (mi === mats.length - 1 ? ';border-radius:0 0 8px 8px' : '') + '" title="Перетащите в блок «Материалы к списанию» или нажмите +">' +
        '<div style="font-size:12.5px;color:var(--ink);font-weight:600;line-height:1.3">⠿ ' + esc(mat.name) + '</div>' +
        '<div style="font-size:12px;color:var(--ink);font-weight:600;text-align:right;white-space:nowrap">' + woFmtQty(mat.qty) + ' ' + esc(mat.unit) + '</div>' +
        '<div style="font-size:12px;color:var(--ink);text-align:right;white-space:nowrap">' + esc(woFmtMoney(mat.price)) + '</div>' +
        (added
          ? '<div style="text-align:center;color:#16a34a;font-weight:800" title="Уже есть в списании выбранной работы">✓</div>'
          : '<button type="button" data-action="wo-mat-add" data-mid="' + mat.id + '" title="Добавить к списанию выбранной работы" style="width:28px;height:28px;border:1px solid #16a34a;border-radius:7px;background:#f0fdf4;color:#16a34a;font-size:16px;font-weight:800;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;padding:0">+</button>') +
      '</div>';
    });
    host.innerHTML = html;
    woBindMatsDnD();
  }

  // Нижний блок: материалы к списанию ВЫБРАННОЙ работы (что и сколько списываем)
  function woRenderSel() {
    var host = document.getElementById('wo-sel'); if (!host) return;
    var t = findTask(S.woTid);
    var names = t ? writeoffWorkNames(t) : [];
    var actName = names.length ? names[S.woWorkIdx || 0] : '';
    var tit = document.getElementById('wo-sel-title');
    if (tit) tit.innerHTML = names.length
      ? 'Материалы к списанию — работа <b style="color:#16a34a">«' + esc(actName) + '»</b>:'
      : 'Материалы к списанию (что и сколько списываем):';
    var sel = S.woSelMats || [];
    var html = '';
    if (!sel.length) {
      html = '<div style="padding:16px 10px;text-align:center;color:var(--muted);font-size:12.5px;line-height:1.5">' +
        (names.length ? 'По этой работе пока пусто.<br>' : 'Пока пусто.<br>') +
        'Нажмите <b style="color:#16a34a">+</b> у материала в правом блоке<br>или перетащите его сюда' + (names.length > 1 ? ' — попадёт именно в эту работу.' : '.') + '</div>';
    } else {
      sel.forEach(function (it) {
        var mat = woMatById(it.id); if (!mat) return;
        html += '<div style="display:grid;grid-template-columns:minmax(0,1fr) 96px 92px 26px;gap:6px;align-items:center;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);margin-bottom:6px">' +
          '<div style="font-size:12.5px;color:var(--ink);font-weight:600;line-height:1.3">' + esc(mat.name) + '</div>' +
          '<div style="display:flex;align-items:center;gap:4px"><input type="number" min="0" step="0.01" value="' + String(+it.qty || 0) + '" data-woqty="' + it.id + '" style="width:60px;padding:4px 6px;border:1px solid var(--line);border-radius:6px;font-size:12.5px;font-family:inherit;background:var(--card);color:var(--ink);text-align:right"><span style="font-size:12px;color:var(--muted);font-weight:700">' + esc(mat.unit) + '</span></div>' +
          '<div id="wo-sum-' + it.id + '" style="font-size:12.5px;color:var(--ink);font-weight:700;text-align:right;white-space:nowrap">' + esc(woFmtMoney(mat.price * (+it.qty || 0))) + '</div>' +
          '<button type="button" data-action="wo-mat-del" data-mid="' + it.id + '" title="Убрать из списания" style="width:24px;height:24px;border:none;border-radius:6px;background:transparent;color:#dc2626;font-size:15px;font-weight:800;cursor:pointer;line-height:1;padding:0">×</button>' +
        '</div>';
      });
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 2px 0;font-size:12.5px;font-weight:800;color:var(--ink)"><span style="color:var(--muted);font-weight:700">Итого по работе:</span><span id="wo-total">' + esc(woFmtMoney(woSelTotal())) + '</span></div>';
    }
    host.innerHTML = html;
    // Сводка по всей задаче — только когда видов работ больше одного
    var gr = document.getElementById('wo-grand');
    if (gr) {
      if (names.length > 1) {
        gr.style.display = '';
        gr.innerHTML = '<span style="color:var(--muted);font-weight:700">Всего по задаче (все виды работ):</span> <b id="wo-grand-total" style="color:var(--ink)">' + esc(woFmtMoney(woGrandTotal())) + '</b>';
      } else {
        gr.style.display = 'none';
        gr.innerHTML = '';
      }
    }
    woBindQty();
  }

  // Пересчёт суммы строки, итога по работе и общего итога при изменении количества
  function woBindQty() {
    var host = document.getElementById('wo-sel'); if (!host || !host.querySelectorAll) return;
    var inps = host.querySelectorAll('input[data-woqty]');
    Array.prototype.forEach.call(inps, function (inp) {
      inp.addEventListener('input', function () {
        var id = inp.getAttribute('data-woqty');
        var it = null;
        (S.woSelMats || []).forEach(function (x) { if (x.id === id) it = x; });
        if (!it) return;
        var v = parseFloat(String(inp.value).replace(',', '.'));
        it.qty = (isFinite(v) && v >= 0) ? v : 0;
        var mat = woMatById(it.id);
        var cell = document.getElementById('wo-sum-' + it.id);
        if (cell && mat) cell.textContent = woFmtMoney(mat.price * it.qty);
        var tot = document.getElementById('wo-total');
        if (tot) tot.textContent = woFmtMoney(woSelTotal());
        var gr = document.getElementById('wo-grand-total');
        if (gr) gr.textContent = woFmtMoney(woGrandTotal());
      });
    });
  }

  // Добавить материал к списанию ВЫБРАННОЙ работы (кнопка «+» или перетаскивание)
  function woMatAdd(mid) {
    var mat = woMatById(mid); if (!mat) return;
    if (!S.woSelMats) S.woSelMats = woSelGroup(S.woWorkIdx || 0);
    if (woSelHas(mid)) { toast('ok', '«' + mat.name + '» уже в списании по этой работе'); return; }
    S.woSelMats.push({ id: mid, qty: mat.qty });
    woRenderWorks(); woRenderMats(); woRenderSel();
  }

  function woMatDel(mid) {
    S.woSelMats = (S.woSelMats || []).filter(function (it) { return it.id !== mid; });
    if (S.woTid && S.woSelByWork && S.woSelByWork[S.woTid]) S.woSelByWork[S.woTid][S.woWorkIdx || 0] = S.woSelMats;
    woRenderWorks(); woRenderMats(); woRenderSel();
  }

  // Сохранить списания задачи — в саму задачу (t.writeoffs: {индекс вида работ: [{id, qty}]});
  // изменение задачи уходит в общее облако (синхронизация), переживает перезагрузку
  function woSaveWriteoff() {
    var t = findTask(S.woTid); if (!t) return false;
    var g = (S.woSelByWork && S.woSelByWork[S.woTid]) || {};
    var out = {};
    Object.keys(g).forEach(function (k) {
      var list = (g[k] || []).map(function (it) { return { id: it.id, qty: +it.qty || 0 }; }).filter(function (it) { return !!it.id; });
      if (list.length) out[k] = list;
    });
    if (Object.keys(out).length) t.writeoffs = out; else delete t.writeoffs;
    if (TASKS_DB) TASKS_DB.updateTask(t.id, t);
    toast('ok', '\uD83D\uDCBE Списание сохранено' + (Object.keys(out).length ? '' : ' (пустое — по задаче ничего не выбрано)'));
    return true;
  }

  // Перетаскивание строк из блока 1С в блок «Материалы к списанию» (как карточки в планировании)
  function woBindMatsDnD() {
    var src = document.getElementById('wo-mats');
    if (src && !src.__woWired) {
      src.__woWired = true;
      src.addEventListener('dragstart', function (e) {
        var row = (e.target && e.target.closest) ? e.target.closest('[data-wmat]') : null;
        if (!row) return;
        try { e.dataTransfer.setData('text/plain', row.getAttribute('data-wmat')); e.dataTransfer.effectAllowed = 'copy'; } catch (err) {}
        row.style.opacity = '0.4';
      });
      src.addEventListener('dragend', function () {
        var rows = src.querySelectorAll ? src.querySelectorAll('[data-wmat]') : [];
        Array.prototype.forEach.call(rows, function (r) { r.style.opacity = woSelHas(r.getAttribute('data-wmat')) ? '0.55' : ''; });
      });
      var zone = document.getElementById('wo-sel');
      if (zone && !zone.__woWired) {
        zone.__woWired = true;
        zone.addEventListener('dragover', function (e) {
          e.preventDefault();
          try { e.dataTransfer.dropEffect = 'copy'; } catch (err) {}
          zone.style.borderColor = '#16a34a';
          zone.style.background = '#f0fdf4';
        });
        zone.addEventListener('dragleave', function () {
          zone.style.borderColor = ''; zone.style.background = '';
        });
        zone.addEventListener('drop', function (e) {
          e.preventDefault();
          zone.style.borderColor = ''; zone.style.background = '';
          var mid = '';
          try { mid = e.dataTransfer.getData('text/plain'); } catch (err) {}
          if (mid) woMatAdd(mid);
        });
      }
    }
  }

  // Окно подробностей списания: адрес, работа, мастер, слесаря, даты, виды работ
  function openWriteoffModal(tid) {
    var t = findTask(tid); if (!t) return;
    var w = workOf(t), m = masterById(t.m);
    var planIso = writeoffPlanIso(t), closeIso = writeoffCloseIso(t);
    S.woTid = t.id;
    S.woWorkIdx = 0; // 22.09-185: активный вид работ — первый
    if (!S.woSelByWork) S.woSelByWork = {};
    if (!S.woSelByWork[t.id]) { // 22.09-186: сессионных правок нет — поднять СОХРАНЁННОЕ списание задачи
      S.woSelByWork[t.id] = {};
      if (t.writeoffs) Object.keys(t.writeoffs).forEach(function (k) {
        S.woSelByWork[t.id][k] = (t.writeoffs[k] || []).map(function (it) { return { id: it.id, qty: +it.qty || 0 }; });
      });
    }
    S.woSelMats = woSelGroup(0); // список списания КАЖДОГО вида работ помнится по задаче, пока открыта страница
    function row(lbl, valHtml) {
      return '<div style="display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-bottom:1px dashed var(--line)">' +
        '<div style="font-size:12px;color:var(--muted);font-weight:700;white-space:nowrap">' + lbl + '</div>' +
        '<div style="font-size:13px;color:var(--ink);font-weight:600;text-align:right">'+ valHtml + '</div></div>';
    }
    var h = '<div class="modal-h" style="background:#16a34a;color:#fff"><h3 style="color:#fff">\u2705 Списание задачи</h3><button class="x" data-action="wo-save-close" style="color:#fff">×</button></div>';
    h += '<div class="modal-b">';
    h += '<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start">';
    // левая колонка — данные задачи, виды работ, материалы к списанию
    h += '<div style="flex:1;min-width:290px">';
    h += row('\uD83D\uDCCD Адрес', esc(addrOf(t)));
    // 22.09-194: строка «Работа» под адресом убрана — вид работ выбирается кнопками в блоке «Виды работ» ниже
    h += row('\uD83D\uDC77 Мастер', esc(m ? m.name : '?') + (m && m.area ? ' <span style="color:var(--muted);font-weight:600">(' + esc(m.area) + ')</span>' : ''));
    h += row('\uD83E\uDDF0 Слесаря', esc(writeoffSlesariNames(t)));
    h += row('\uD83D\uDCC5 Плановая дата', esc(fmtDmyIso(planIso)));
    h += row('\u2705 Дата закрытия', '<b style="color:#16a34a">' + esc(fmtDmyIso(closeIso)) + '</b>');
    if (t.started_at || t.finished_at) h += row('\u23F1 Факт работы', (t.started_at ? 'с <b>' + fmtClock(t.started_at) + '</b>' : 'с ?') + ' ' + (t.finished_at ? 'до <b style="color:#16a34a">' + fmtClock(t.finished_at) + '</b>' : 'до …') + (taskFactHours(t) != null ? ' · <b style="color:#2563eb">' + fmtH(taskFactHours(t)) + ' ч</b>' : '')); // 22.09-190
    h += '<div style="margin:14px 0 7px;font-size:12px;color:var(--muted);font-weight:700">Виды работ — выберите, к какой списывать материалы:</div>';
    h += '<div id="wo-works"></div>';
    h += '<div id="wo-sel-title" style="margin:14px 0 7px;font-size:12px;color:var(--muted);font-weight:700">Материалы к списанию:</div>';
    h += '<div id="wo-sel" style="border:2px dashed var(--line);border-radius:10px;padding:8px;min-height:76px"></div>';
    h += '<div id="wo-grand" style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid var(--line);font-size:13px;font-weight:800"></div>';
    h += '</div>';
    // правая широкая колонка — материалы из 1С построчно
    h += '<div style="flex:1.45;min-width:340px">';
    h += '<div style="margin:0 0 7px;font-size:12px;color:var(--muted);font-weight:700">Материалы из 1С (пока тестовые данные):</div>';
    h += '<div id="wo-mats"></div>';
    h += '<div style="margin-top:7px;font-size:12px;color:var(--muted);line-height:1.45">Перенос: нажмите <b style="color:#16a34a">+</b> рядом с материалом или перетащите строку в блок слева — материал попадёт в работу, которая выбрана (подсвечена зелёным). Количество можно изменить в нижнем блоке.</div>';
    h += '</div>';
    h += '</div>';
    h += '</div>';
    h += '<div class="modal-f" style="display:flex;gap:10px;justify-content:flex-end"><button class="btn primary" data-action="wo-save">\uD83D\uDCBE Сохранить</button><button class="btn" data-action="wo-save-close">Закрыть</button></div>';
    modal.style.width = '94%';
    modal.style.maxWidth = '1100px'; // 22.09-183: окно шире — справа столбец с материалами из 1С
    modal.innerHTML = h;
    woRenderWorks();
    woRenderMats();
    woRenderSel();
    overlay.classList.add('show');
  }

