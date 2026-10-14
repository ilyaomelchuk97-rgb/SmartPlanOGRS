  /* ── часть 21 · app/21_myday.js — «Мои задания»: мобильный экран работника — задачи на сегодня крупными карточками, кнопки «В работе» / «Выполнено» (22.09-266) ── */
/* ============================================================
   22.09-266: страница «Мои задания» — для телефона.
   · Слесарю: задачи на сегодня, где он в списке исполнителей (t.slesari).
   · Мастеру и остальным: задачи на сегодня, где он ответственный (t.m).
   · Крупные карточки: объект, вид работы, объём, статус.
   · Кнопки: «▶ В работе» и «✓ Выполнено» — отметка уходит на сервер
     (её сразу видят мастер и диспетчер) и пишется в журнал действий.
   · У слесаря это экран по умолчанию (открывается сразу после входа).
   ============================================================ */
  function myDayTasks() {
    var my = (S.user && S.user.id) ? String(S.user.id) : '';
    if (!my) return [];
    var all = (window.SP_TASKS ? SP_TASKS.getTasks() : (S.tasks || [])) || [];
    var mine = all.filter(function (t) {
      if (!t || !t.id || t.id === 't_day_anchor' || isDone(t)) return false;
      if (typeof t.d !== 'number' || t.d !== 0) return false;      // только сегодня
      if (S.role === 'slesar') {
        return Array.isArray(t.slesari) && t.slesari.some(function (id) { return String(id) === my; });
      }
      return String(t.m) === my;                                   // мастер видит свои задачи дня
    });
    return mine.sort(function (a, b) {
      var sa = (typeof a.seq === 'number') ? a.seq : 999, sb = (typeof b.seq === 'number') ? b.seq : 999;
      if (sa !== sb) return sa - sb;
      return String(a.o || '').localeCompare(String(b.o || ''));
    });
  }
  function myDayObject(t) {
    try {
      var o = (window.SP_OBJECTS && SP_OBJECTS.getObject) ? SP_OBJECTS.getObject(t.o) : null;
      if (!o && OBJ_MAP) o = OBJ_MAP[t.o];
      return o || null;
    } catch (e) { return null; }
  }
  function myDayWorkName(t) {
    try {
      if (WORK_MAP && WORK_MAP[t.w]) return WORK_MAP[t.w].name || t.w;
    } catch (e) {}
    return t.w || '—';
  }
  function myDayCard(t) {
    var o = myDayObject(t);
    var addr = o ? objFullAddr(o) : (t.addr || 'Объект ?');
    var wname = myDayWorkName(t);
    var vol = (t.volume && t.volume !== 1) ? (' · объём ' + t.volume) : '';
    var st = (t.s || t.status || 'plan');
    var chip = st === 'progress'
      ? '<span class="md-st md-st-p">▶ в работе</span>'
      : '<span class="md-st md-st-pl">в плане</span>';
    var btnProg = (st === 'progress') ? '' : '<button class="md-btn md-btn-p" data-action="myday-progress" data-tid="' + esc(t.id) + '">▶ В работе</button>';
    return '<div class="md-card">' +
      '<div class="md-top"><div class="md-addr">' + esc(addr) + '</div>' + chip + '</div>' +
      '<div class="md-work">' + esc(wname) + vol + '</div>' +
      '<div class="md-acts">' + btnProg +
        '<button class="md-btn md-btn-ok" data-action="myday-done" data-tid="' + esc(t.id) + '">✓ Выполнено</button>' +
        '<button class="md-btn md-btn-m" data-action="myday-map" title="Открыть карту маршрутов">📍</button>' +
      '</div></div>';
  }
  function renderMyDay() {
    try {
      var view = document.getElementById('view');
      if (!view) return;
      var list = myDayTasks();
      var all = (window.SP_TASKS ? SP_TASKS.getTasks() : (S.tasks || [])) || [];
      var my = (S.user && S.user.id) ? String(S.user.id) : '';
      var doneToday = all.filter(function (t) {
        if (!t || isDone(t) !== true) return false;
        if (typeof t.d !== 'number' || t.d !== 0) return false;
        if (S.role === 'slesar') return Array.isArray(t.slesari) && t.slesari.some(function (id) { return String(id) === my; });
        return String(t.m) === my;
      }).length;
      var head = '<div class="md-head"><div class="md-h-t">Мои задания на сегодня</div>' +
        '<div class="md-h-s">' + (list.length ? ('осталось: ' + list.length) : 'всё выполнено') +
        (doneToday ? (' · выполнено сегодня: ' + doneToday) : '') + '</div></div>';
      if (!list.length) {
        view.innerHTML = head + uiEmpty('🎉', 'На сегодня заданий нет', 'Все работы на сегодня выполнены или ещё не назначены. Загляните позже или откройте «Карту маршрутов».', 'Открыть карту', 'myday-map');
        return;
      }
      view.innerHTML = head + '<div class="md-list">' + list.map(myDayCard).join('') + '</div>';
    } catch (e) {
      try { toast('err', 'Ошибка страницы «Мои задания»: ' + String(e && e.message || e)); } catch (e2) {}
    }
  }
  // доступ из других частей и автотестов
  window.SP_MYDAY = { tasks: myDayTasks, render: renderMyDay, set: myDaySet };
  function myDaySet(tid, st) {
    try {
      if (!tid) return;
      var t = (window.SP_TASKS ? SP_TASKS.getTasks() : []).filter(function (x) { return x.id === tid; })[0];
      if (!t) return;
      if (st === 'done') {
        TASKS_DB.updateTask(tid, { s: 'done', status: 'done', done_at: Date.now(), done_by: (S.user && S.user.full_name) || '' });
        logAction('Отметка «выполнено» (Мои задания)', myDayWorkName(t) + ' · ' + (myDayObject(t) ? objFullAddr(myDayObject(t)) : t.o));
        toast('ok', '✓ Работа отмечена выполненной — мастер увидит отметку');
      } else {
        TASKS_DB.updateTask(tid, { s: 'progress', status: 'progress', started_at: Date.now() });
        logAction('Отметка «в работе» (Мои задания)', myDayWorkName(t));
        toast('ok', '▶ Отмечено «в работе»');
      }
      renderMyDay();
    } catch (e) { try { toast('err', 'Не удалось отметить: ' + String(e && e.message || e)); } catch (e2) {} }
  }
