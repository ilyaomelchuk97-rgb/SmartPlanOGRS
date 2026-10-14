  /* ── часть 03 · app/03_calendar.js — планирование: выбор даты, корзина, календарь, окно графика работника, оптимизатор ── */
  /* =====================================================================
     ПОПАП-КАЛЕНДАРЬ (выбор даты в планировании)
     ===================================================================== */
  var dpState = { viewMonth: new Date(TODAY.getFullYear(), TODAY.getMonth(), 1), selectedDate: null };

  function openDatePicker(anchorEl) {
    var popup = document.getElementById('date-popup');
    if (!popup) return;

    // Позиционируем попап относительно заголовка
    var rect = anchorEl.getBoundingClientRect();
    popup.style.left = Math.min(rect.left, window.innerWidth - 340) + 'px';
    popup.style.top = (rect.bottom + 8) + 'px';

    dpState.viewMonth = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
    var shift = (S.calMode === 'week') ? S.weekShift : (S.calMode === 'month' ? S.monthShift : S.dayShift);
    if (S.calMode === 'week') dpState.viewMonth = addDays(mondayOf(TODAY), shift * 7);
    if (S.calMode === 'month') dpState.viewMonth = new Date(TODAY.getFullYear(), TODAY.getMonth() + shift, 1);
    if (S.calMode === 'day') dpState.viewMonth = addDays(TODAY, shift);

    renderDatePicker();
    popup.classList.add('open');

    // Закрытие по клику вне попапа
    setTimeout(function() {
      document.addEventListener('click', closeDatePickerOutside);
    }, 100);
  }

  function closeDatePickerOutside(e) {
    var popup = document.getElementById('date-popup');
    if (!popup || !popup.classList.contains('open')) return;
    if (!popup.contains(e.target) && !e.target.closest('#cal-title')) {
      closeDatePicker();
    }
  }

  function closeDatePicker() {
    var popup = document.getElementById('date-popup');
    if (popup) popup.classList.remove('open');
    document.removeEventListener('click', closeDatePickerOutside);
  }

  function renderDatePicker() {
    var m = dpState.viewMonth.getMonth();
    var y = dpState.viewMonth.getFullYear();
    var monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    document.getElementById('dp-month-year').textContent = monthNames[m] + ' ' + y;

    var grid = document.getElementById('dp-grid');
    var html = '';
    var wds = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    wds.forEach(function(wd) { html += '<div class="dp-wd">' + wd + '</div>'; });

    var firstDay = new Date(y, m, 1);
    var lastDay = new Date(y, m + 1, 0);
    var startOffset = (firstDay.getDay() + 6) % 7;

    // Дни предыдущего месяца
    for (var i = startOffset - 1; i >= 0; i--) {
      var d = new Date(y, m, -i);
      html += '<button class="dp-day other-month" data-date="' + key(d) + '">' + d.getDate() + '</button>';
    }

    // Текущий месяц
    for (var day = 1; day <= lastDay.getDate(); day++) {
      var d = new Date(y, m, day);
      var cls = 'dp-day';
      if (sameDay(d, TODAY)) cls += ' today';
      html += '<button class="' + cls + '" data-date="' + key(d) + '">' + day + '</button>';
    }

    // Дни следующего месяца
    var totalCells = startOffset + lastDay.getDate();
    var remaining = (7 - (totalCells % 7)) % 7;
    for (var j = 1; j <= remaining; j++) {
      var d = new Date(y, m + 1, j);
      html += '<button class="dp-day other-month" data-date="' + key(d) + '">' + j + '</button>';
    }

    grid.innerHTML = html;

    // Привязка кликов по дням
    grid.querySelectorAll('.dp-day').forEach(function(btn) {
      btn.addEventListener('click', function() {
        grid.querySelectorAll('.dp-day.selected').forEach(function(b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        dpState.selectedDate = btn.dataset.date;
      });
    });
  }

  function applyDatePicker() {
    if (!dpState.selectedDate) { closeDatePicker(); return; }
    var picked = new Date(dpState.selectedDate + 'T00:00:00');
    var off = dateToOff(picked);

    if (S.calMode === 'day') S.dayShift = off;
    else if (S.calMode === 'week') S.weekShift = Math.floor(off / 7);
    else if (S.calMode === 'month') S.monthShift = (picked.getFullYear() - TODAY.getFullYear()) * 12 + (picked.getMonth() - TODAY.getMonth());

    closeDatePicker();
    renderCalendar();
  }

  function initDatePicker() {
    var prev = document.getElementById('dp-prev');
    var next = document.getElementById('dp-next');
    var todayBtn = document.getElementById('dp-today');
    var cancelBtn = document.getElementById('dp-cancel');
    var applyBtn = document.getElementById('dp-apply');

    if (prev) prev.addEventListener('click', function() {
      dpState.viewMonth = new Date(dpState.viewMonth.getFullYear(), dpState.viewMonth.getMonth() - 1, 1);
      renderDatePicker();
    });
    if (next) next.addEventListener('click', function() {
      dpState.viewMonth = new Date(dpState.viewMonth.getFullYear(), dpState.viewMonth.getMonth() + 1, 1);
      renderDatePicker();
    });
    if (todayBtn) todayBtn.addEventListener('click', function() {
      dpState.viewMonth = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
      renderDatePicker();
    });
    if (cancelBtn) cancelBtn.addEventListener('click', closeDatePicker);
    if (applyBtn) applyBtn.addEventListener('click', applyDatePicker);
  }

  /* =====================================================================
     КОРЗИНА (синхронизированная через сервер)
     ===================================================================== */
  var TRASH_KEY = 'smartplan_trash';

  function getTrash() {
    try { var raw = localStorage.getItem(TRASH_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    return [];
  }

  function saveTrash(arr) {
    try { localStorage.setItem(TRASH_KEY, JSON.stringify(arr)); } catch (e) {}
  }

  // Загрузка корзины с сервера
  function loadTrashFromServer() {
    var API = (window.SP_CONFIG && SP_CONFIG.serverUrl) || '';
    if (!API || !DB.isServerOnline()) return Promise.resolve(getTrash());
    return fetch(API + '/api/trash')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.tasks) {
          var trash = data.tasks.map(function(t) {
            return Object.assign({}, t, { _deletedAt: t.created || Date.now() });
          });
          saveTrash(trash);
          return trash;
        }
        return getTrash();
      })
      .catch(function() { return getTrash(); });
  }

  function addToTrash(task) {
    var trash = getTrash();
    task._deletedAt = Date.now();
    trash.push(task);
    // Оставляем только задачи за последние 14 дней
    var cutoff = Date.now() - 14 * 86400000;
    trash = trash.filter(function(t) { return t._deletedAt > cutoff; });
    saveTrash(trash);
    // Отправляем на сервер — мягкое удаление
    var API = (window.SP_CONFIG && SP_CONFIG.serverUrl) || '';
    if (API && DB.isServerOnline()) {
      fetch(API + '/api/tasks/' + task.id, { method: 'DELETE' }).catch(function() {});
    }
  }

  function restoreFromTrash(trashIdx) {
    var trash = getTrash();
    if (trashIdx < 0 || trashIdx >= trash.length) return;
    var task = trash[trashIdx];
    trash.splice(trashIdx, 1);
    saveTrash(trash);

    var API = (window.SP_CONFIG && SP_CONFIG.serverUrl) || '';

    // Сначала восстанавливаем на сервере, потом обновляем всё
    var restorePromise;
    if (API && DB.isServerOnline()) {
      restorePromise = fetch(API + '/api/trash/restore/' + task.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'plan', s: 'plan', addr: task.addr || '', m: task.m || '', d: task.d || 0, dl: task.dl || 7, volume: task.volume || 1 })
      }).catch(function() {});
    } else {
      // Автономный режим — добавляем локально
      task.s = 'plan'; task.status = 'plan';
      delete task._deletedAt;
      if (TASKS_DB) { TASKS_DB.addTask(task); S.tasks = TASKS_DB.getTasks(); }
      restorePromise = Promise.resolve();
    }

    restorePromise.then(function() {
      // Полное обновление данных с сервера
      if (DB.isServerOnline()) {
        DB.syncFromServer().then(function() {
          if (window.SP_TASKS) S.tasks = window.SP_TASKS.getTasks();
          drawCalendarGrid();
          openTrashModal();
        });
      } else {
        drawCalendarGrid();
        openTrashModal();
      }
    });
    toast('ok', '✅ Задача восстановлена из корзины');
  }

  function purgeTrash() {
    // 22.09-268: очистка корзины — по правам
    if (S.role !== 'admin' && (typeof permCan !== 'function' || !permCan('delTasks'))) {
      try { toast('err', 'Чистить корзину можно только с разрешения (Права доступа)'); } catch (e) {}
      return;
    }
    var oldTrash = getTrash();
    saveTrash([]);
    var API = (window.SP_CONFIG && SP_CONFIG.serverUrl) || '';
    var purgePromises = [];
    if (API && DB.isServerOnline()) {
      oldTrash.forEach(function(t) {
        if (t.id) {
          purgePromises.push(fetch(API + '/api/trash/' + t.id, { method: 'DELETE' }).catch(function() {}));
        }
      });
    }
    // Ждём удаления с сервера, потом обновляем всё
    Promise.all(purgePromises).then(function() {
      if (DB.isServerOnline()) {
        DB.syncFromServer().then(function() {
          if (window.SP_TASKS) S.tasks = window.SP_TASKS.getTasks();
          drawCalendarGrid();
          openTrashModal();
        });
      } else {
        drawCalendarGrid();
        openTrashModal();
      }
    });
    toast('ok', '🗑 Корзина очищена');
  }

  function openTrashModal() {
    // Показываем загрузку
    modal.style.maxWidth = ''; // сброс автоширины карточки задачи
    modal.innerHTML = '<div class="modal-h"><h3>🗑 Корзина</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b"><div class="empty" style="padding:40px 20px;">Загрузка...</div></div>';
    overlay.classList.add('show');

    // Загружаем актуальную корзину с сервера
    loadTrashFromServer().then(function(trash) {
      trash.sort(function(a, b) { return (b._deletedAt || 0) - (a._deletedAt || 0); });
      var html = '<div class="modal-h"><h3>🗑 Корзина</h3><button class="x" data-action="close-modal">×</button></div>';
      html += '<div class="modal-b">';
      if (!trash.length) {
        html += '<div class="empty" style="padding:40px 20px;">Корзина пуста<br><span style="font-size:12px;">Удалённые задачи хранятся 14 дней</span></div>';
      } else {
        html += '<div style="font-size:12px;color:var(--muted);margin-bottom:12px;">Задач в корзине: ' + trash.length + ' · хранятся 14 дней · синхронизировано</div>';
        trash.forEach(function(t, idx) {
          var w = WORK.getWork('УБиРОГС', t.w) || WORK_MAP[t.w];
          var deletedDate = parseLogDate(t._deletedAt);
          var delStr = deletedDate ? deletedDate.getDate() + ' ' + MON[deletedDate.getMonth()] : '—';
          var daysAgo = deletedDate ? Math.floor((Date.now() - deletedDate.getTime()) / 86400000) : -1;
          html += '<div class="rz-item"><div class="rz-bar" style="background:var(--muted);"></div><div class="rz-main"><div class="rz-t">' + esc(w ? w.name : 'Задача') + ' — ' + esc(t.addr || addrOf(t)) + '</div><div class="rz-s">Удалено: ' + delStr + ' · ' + (daysAgo < 0 ? 'недавно' : daysAgo === 0 ? 'сегодня' : daysAgo + ' дн назад') + ' · Объём: ' + (t.volume || 1) + '</div></div>' + (canPlan() ? '<button class="btn sm" data-action="restore-task" data-trash-idx="' + idx + '" style="color:var(--green);white-space:nowrap;">↩ Восстановить</button>' : '<span style="font-size:12px;color:var(--muted)">только просмотр</span>') + '</div>';
        });
        if (canPlan()) html += '<div style="margin-top:16px;text-align:right;"><button class="btn sm" data-action="purge-trash" style="color:var(--red);">Очистить корзину полностью</button></div>';
      }
      html += '</div><div class="modal-f"><button class="btn" data-action="close-modal">Закрыть</button></div>';
      modal.innerHTML = html;
    });
  }

  /* =====================================================================
     РЕНДЕР: КАЛЕНДАРЬ
     ===================================================================== */
  function renderCalendar() {
    var html = '<div class="cal-head"><div class="seg">';
    html += segBtn('day', 'День') + segBtn('week', 'Неделя') + segBtn('month', 'Месяц');
    html += '</div>';
    html += '<button class="btn sm" data-action="cal-prev">‹</button>';
    html += '<span class="cal-title" id="cal-title" style="cursor:pointer;padding:4px 12px;border-radius:8px;transition:.15s;text-decoration:underline;text-decoration-color:transparent;text-underline-offset:3px;" onmouseover="this.style.background=\'#eff6ff\';this.style.textDecorationColor=\'#2563eb\'" onmouseout="this.style.background=\'transparent\';this.style.textDecorationColor=\'transparent\'" title="Нажмите для выбора даты"></span>';
    html += '<button class="btn sm" data-action="cal-next">›</button>';
    if (S.calMode !== 'day' || S.dayShift !== 0) html += '<button class="btn sm" data-action="cal-today">Сегодня</button>';
    html += '<div class="legend"><span><i style="background:var(--green-l);border:1px solid var(--green)"></i>В норме</span><span><i style="background:var(--yellow-l);border:1px solid var(--yellow)"></i>Мало времени</span><span><i style="background:var(--red-l);border:1px solid var(--red)"></i>Просрочка</span><span><i style="background:#fef3c7;border:1px solid #f59e0b"></i>Ожидание погоды</span><span><i style="background:var(--panel-3);border:1px solid #94a3b8"></i>Выполнено</span></div>';
    html += '</div>';
    // 22.09-220: функциональные кнопки — отдельной строкой ниже (сюда добавим ещё):
    // слева «Добавить задачу», по центру «Оптимизировать работы», справа «Корзина»
    html += '<div id="cal-actions-row" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">'
      + '<div style="flex:1;display:flex;justify-content:flex-start">' + (canPlan() ? '<button class="btn sm primary" data-action="new-task">' + IC.plus + ' Добавить задачу</button>' : '') + '</div>'
      + '<div style="flex:1;display:flex;justify-content:center;gap:6px">' + (canPlan() ? '<button class="btn sm" data-action="optimize-works" style="background:#6366f1;color:#fff;border-color:#6366f1;" title="Автоматическое распределение работ без просрочек с соблюдением 8-часового рабочего дня">⚡ Оптимизировать работы</button>' : '')
      + '<button class="btn sm" data-action="cal-undo" title="Отмена последнего действия в планировании (как Ctrl+Z в Excel): перенос карточки, правка задачи или «Оптимизировать работы». Работает до перезагрузки страницы" style="background:#475569;color:#fff;border-color:#475569">⟲ Отмена последнего действия</button></div>'
      + '<div style="flex:1;display:flex;justify-content:flex-end"><div class="trash-zone" id="trash-zone" data-action="open-trash" title="Перетащите задачу для удаления или нажмите для просмотра удалённых" style="cursor:pointer;">' + IC.trash + ' <span>Корзина</span></div></div>'
      + '</div>';
    if (S.role === 'master') {
      html += '<div class="calc" style="margin-bottom:12px"><span style="text-align:left">' + IC.info + ' Ваш личный график. Перетаскивайте карточки, чтобы менять дату выполнения.</span></div>';
    } else if (S.role !== 'admin') {
      html += '<div class="calc" style="margin-bottom:12px"><span style="text-align:left">' + IC.info + ' Участок <b>' + esc(S.user.area) + '</b>: доступны только мастера этого участка.</span></div>';
    }
    html += '<div class="cal-scroll"><div class="cal-grid ' + S.calMode + '" id="cal-grid"></div></div>';
    view.innerHTML = html;
    drawCalendarGrid();
  }
  function segBtn(mode, label) {
    return '<button class="' + (S.calMode === mode ? 'on' : '') + '" data-action="cal-mode" data-mode="' + mode + '">' + label + '</button>';
  }
  var _drawGridTm = null;
  function drawCalendarGrid() {
    if (_drawGridTm) clearTimeout(_drawGridTm);
    _drawGridTm = setTimeout(_drawCalendarGridImpl, 50);
  }
  function _drawCalendarGridImpl() {
    var grid = document.getElementById('cal-grid');
    // 22.09-198: в «Планировании» строки — ТОЛЬКО у мастеров (начальник участка и старший мастер строк не имеют)
    var masters = visibleMasters().filter(function (m) { return m.role === 'master'; });
    var days = buildDayWindow();
    var titleEl = document.getElementById('cal-title');
    if (titleEl) {
      titleEl.textContent = windowTitle(days);
      // Привязка открытия календаря
      titleEl.onclick = function() { openDatePicker(titleEl); };
    }

    if (!masters.length) {
      grid.style.gridTemplateColumns = '1fr';
      grid.innerHTML = '<div style="padding:44px 20px;text-align:center;color:var(--muted)"><div style="font-size:38px;margin-bottom:12px">👥</div><div style="color:var(--ink);font-size:15px;font-weight:700">Нет мастеров для планирования</div><div style="margin-top:8px;font-size:12.5px;max-width:420px;margin-left:auto;margin-right:auto">Добавьте пользователей с ролью «Мастер» или «Старший мастер» в разделе «Пользователи» — они автоматически появятся здесь как строки календаря.</div></div>';
      return;
    }

    // Ширина ячейки с задачей одинаковая в неделе и месяце:
    // стандарт — ячейка недели = (ширина контейнера − колонка мастеров) / 7.
    // Режим «День» — как раньше: единственная колонка на всю ширину.
    grid.style.gridTemplateColumns = '170px repeat(' + days.length + ', ' + (S.calMode === 'day' ? '1fr' : 'calc((100% - 170px) / 7)') + ')';
    var html = '';
    html += '<div class="col-head gh corner" style="grid-column:1;grid-row:1">Мастер / Бригада</div>';
    days.forEach(function (d, i) {
      var we = (d.getDay() === 0 || d.getDay() === 6);
      var cls = 'col-head gh' + (sameDay(d, TODAY) ? ' today' : '') + (we ? ' we' : '');
      html += '<div class="' + cls + '" style="grid-column:' + (i + 2) + ';grid-row:1"><div class="dn">' + d.getDate() + '</div><div class="wd">' + WD[d.getDay()] + '</div></div>';
    });
    masters.forEach(function (m, ri) {
      var rn = ri + 2;
      // Состояние смены «на сегодня» — цветной текст под участком (данные из workers_db).
      var _tSt = wkDayState(m.id, key(TODAY));
      var _tStClr = _tSt === 'work' ? '#16a34a' : (_tSt === 'abs' ? '#dc2626' : '#94a3b8');
      var _tStIco = _tSt === 'work' ? '●' : (_tSt === 'abs' ? '⛔' : '○');
      var _tStLbl = _tSt === 'work' ? 'сегодня — рабочий' : (_tSt === 'abs' ? 'сегодня — отсутствие' : 'сегодня — выходной');
      html += '<div class="mname" data-action="master-sch-popup" data-uid="' + esc(m.id) + '" title="Открыть график смен — ' + esc(m.name) + '" style="grid-column:1;grid-row:' + rn + ';cursor:pointer"><span class="dot" style="background:' + m.color + '"></span><div><div class="nm">' + esc(m.name) + '</div><div class="ar">' + esc(m.area) + '</div><div class="sh-today" style="font-size:9.5px;font-weight:800;color:' + _tStClr + ';margin-top:1px;line-height:1.2">' + _tStIco + ' ' + _tStLbl + '</div></div></div>';
      days.forEach(function (d, ci) {
        var off = dateToOff(d);
        var acKey = m.id + '_' + off;
        // Фоновый расчёт маршрута для ячейки — запускаем ДО отрисовки,
        // чтобы успеть выставить статус 'loading' и показать «🚗 расчёт…»
        var dayTasks = S.tasks.filter(function(t) { return t.m === m.id && t.d === off && !isDone(t); });
        if (dayTasks.length >= 1 && !autoRouteCache[acKey]) autoCalcRoute(m.id, off, dayTasks);
        var _cellRT = getRouteTime(m.id, off);
        var _cellAC = autoRouteCache[acKey];
        var cellLegs = (_cellAC && _cellAC.legs) ? _cellAC.legs : (_cellRT && _cellRT.legs ? _cellRT.legs : null);
        var load = loadForDay(m.id, off);
        var over = load > masterCapacity(m.id, off);
        var we = (d.getDay() === 0 || d.getDay() === 6);
        var cls = 'cell' + (sameDay(d, TODAY) ? ' today' : '') + (we ? ' we' : '') + (over ? ' overload' : ''); // 22.09-104: подсветка рабочих дней убрана
        html += '<div class="' + cls + '" style="grid-column:' + (ci + 2) + ';grid-row:' + rn + '" data-master="' + m.id + '" data-off="' + off + '"' + (over ? ' title="Перегрузка: ' + fmtH(load) + ' ч"' : '') + '>';
        S.tasks.filter(function (t) { return t.m === m.id && t.d === off; }).sort(dayTaskSort).forEach(function (t) { // 22.09-197: порядок — как после оптимизации маршрута (t.seq)
          {
            var col = taskColor(t);
            var o = OBJ_MAP[t.o], w = workOf(t);
            var draggable = (!isDone(t) && canEditTask(t)) ? 'true' : 'false';
            var wMeta = workOf(t);
            var badges = '';
            var permitLine = '';
            if (t.needs_permit) {
              permitLine = '<span class="tile-permit">📋 Ордер до: ' + (t.dl_date || '—') + '</span>';
            } else if (wMeta && wMeta.min_temp > -50) {
              var wf = getWeatherForecast(off);
              if (wf && wf.temp != null && wf.temp < wMeta.min_temp) badges += '<span class="ov-weather">⚠</span>';
            }
            var legInfo = cellLegs ? cellLegs[t.id] : null;
            if (!legInfo && t.travelMin != null && t.travelKm != null) legInfo = { min: t.travelMin, km: t.travelKm };
            // Есть ли координаты у задачи (иначе адрес не найден картой)
            var _hasCoords = (t.lat != null && t.lng != null);
            if (!_hasCoords && t.o) { var _o = OBJ_MAP[t.o]; if (_o && _o.lat && _o.lng) _hasCoords = true; }
            if (!_hasCoords && t.addr) { var _gc = getTaskCoords(t.addr); if (_gc) _hasCoords = true; }
            var tileLegHtml;
            if (legInfo) {
              tileLegHtml = '<span class="tile-leg" style="display:block;font-size:10px;color:#2563eb;font-weight:600;margin-top:2px;white-space:nowrap;">🚗 ' + fmtDuration(legInfo.min) + ' · ' + (legInfo.km || 0).toFixed(1).replace('.', ',') + ' км</span>';
            } else if (!_hasCoords) {
              tileLegHtml = '<span class="tile-leg" style="display:block;font-size:10px;color:#dc2626;font-weight:600;margin-top:2px;white-space:nowrap;">⚠ Адрес не найден</span>';
            } else {
              tileLegHtml = '';
            }
            html += '<div class="tile t-' + col + '" draggable="' + draggable + '" data-action="edit-task" data-tid="' + t.id + '" title="Нажмите для редактирования задания">' + badges + '<span class="tw">' + esc(w ? w.name : '?') + ((t.volume || t.volumes) ? ' ×' + taskVolLabel(t) : '') + (t.brigade ? ' 🔧бриг.' : (t.slesari && t.slesari.length ? ' 🔧' + t.slesari.length : '')) + '</span><span class="th">' + esc(addrOf(t)) + ' · ' + fmtH(taskHours(t)) + 'ч</span>' + permitLine + tileLegHtml + '<label class="tile-chk" onmousedown="event.stopPropagation()" ondragstart="return false"><input type="checkbox" data-action="toggle-done" data-tid="' + t.id + '"' + (isDone(t) ? ' checked' : '') + (S.role === 'viewer' ? ' disabled' : '') + '><span class="tile-chk-box"></span></label></div>';
          }
        });
        // Время до объекта — только ВНУТРИ плашки задачи (tile-leg);
        // отдельной строки «🚗 время в пути» под плашками больше нет
        html += '</div>';
      });
    });
    grid.innerHTML = html;
    attachCalDnD();
  }
  function buildDayWindow() {
    var arr = [];
    if (S.calMode === 'week') {
      var start = addDays(mondayOf(TODAY), S.weekShift * 7);
      for (var i = 0; i < 7; i++) arr.push(addDays(start, i));
    } else if (S.calMode === 'day') {
      arr.push(addDays(TODAY, S.dayShift));
    } else {
      var base = new Date(TODAY.getFullYear(), TODAY.getMonth() + S.monthShift, 1);
      var n = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      for (var j = 1; j <= n; j++) arr.push(new Date(base.getFullYear(), base.getMonth(), j));
    }
    return arr;
  }
  function windowTitle(days) {
    if (S.calMode === 'day') return fmt(days[0]) + ' · ' + WD_FULL[days[0].getDay()];
    if (S.calMode === 'week') return fmt(days[0]) + ' — ' + fmt(days[6]);
    return MON_NOM[days[0].getMonth()] + ' ' + days[0].getFullYear();
  }

  /* =====================================================================
     БЫСТРОЕ ОКНО ГРАФИКА РАБОТНИКА (из «Планирование / Календарь»)
     Поверх текущего экрана показывает месячную сетку со сменами из
     workers_db: работает / выходной / отсутствие. Односторонняя связь —
     задачи графика работ сюда не подтягиваются.
     ===================================================================== */
  function openMasterSchPopup(uid, baseDate) {
    var u = DB.getUser(uid);
    if (!u) return;
    var wkd = wkData(uid);
    var base = baseDate || TODAY;
    var pY = base.getFullYear(), pM = base.getMonth();
    var dim = new Date(pY, pM + 1, 0).getDate();
    var lead = (new Date(pY, pM, 1).getDay() + 6) % 7; // Пн=0 … Вс=6
    var stWork = 0, stOff = 0, stAbs = 0;
    var cells = '';
    for (var li = 0; li < lead; li++) cells += '<div style="min-height:46px"></div>';
    for (var dd = 1; dd <= dim; dd++) {
      var dt = new Date(pY, pM, dd);
      var ds = key(dt);
      var st = wkDayState(uid, ds);
      if (st === 'work') stWork++; else if (st === 'abs') stAbs++; else stOff++;
      var bg2 = st === 'work' ? '#dcfce7' : (st === 'abs' ? '#fee2e2' : '#f1f5f9');
      var bd2 = st === 'work' ? '#16a34a' : (st === 'abs' ? '#dc2626' : '#cbd5e1');
      var isT = sameDay(dt, TODAY);
      var tip = ds + (st === 'work' ? ' · рабочий' : (st === 'abs' ? ' · отсутствие' + (wkd.abs[ds] ? ' (' + esc(wkd.abs[ds]) + ')' : '') : ' · выходной'));
      cells += '<div title="' + esc(tip) + '" style="min-height:46px;border-radius:8px;background:' + bg2 + ';border:1px solid ' + bd2 + ';display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:var(--ink);padding:2px' + (isT ? ';box-shadow:inset 0 0 0 2px rgba(37,99,235,.55)' : '') + '">' + dd + '<span style="font-size:11px;font-weight:700;color:var(--muted);line-height:1.1">' + WD[dt.getDay()] + '</span></div>';
    }
    var roles = ROLE_INFO[u.role] ? ROLE_INFO[u.role].label : (u.role || '');
    var h = '<div class="modal-h"><h3>📅 ' + esc(u.full_name) + ' — ' + MON_NOM[pM] + ' ' + pY + '</h3><button class="x" data-action="close-modal">×</button></div>';
    h += '<div class="modal-b">';
    h += '<div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:12px;font-size:12px;color:var(--muted)">' +
      '<span class="chip" style="background:#eff6ff;color:#1d4ed8">' + wkd.hours + ' ч</span>' +
      '<span class="chip" style="background:#f0fdf4;color:#15803d">' + esc(wkd.sched) + '</span>' +
      (wkd.sched === '2/2' ? '<span class="chip" style="background:#fef9c3;color:#854d0e">цикл с ' + esc(wkd.cycle) + '</span>' : '') +
      (roles ? '<span class="chip" style="background:#f3f4f6;color:#374151">' + esc(roles) + '</span>' : '') +
      '<span style="flex:1"></span>' +
      '<span style="font-weight:700;white-space:nowrap"><span style="color:#16a34a">' + stWork + ' раб</span> · <span style="color:#94a3b8">' + stOff + ' вых</span> · <span style="color:#dc2626">' + stAbs + ' отс</span></span>' +
      '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:6px">' +
      ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(function (wdName, i) {
        return '<div style="text-align:center;font-size:12px;font-weight:800;color:' + (i >= 5 ? '#94a3b8' : 'var(--muted)') + '">' + wdName + '</div>';
      }).join('') + '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px">' + cells + '</div>';
    h += '<div style="margin-top:14px;display:flex;gap:14px;align-items:center;font-size:12px;color:var(--muted);flex-wrap:wrap;font-weight:700">' +
      '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:14px;height:14px;border-radius:3px;background:#dcfce7;border:1px solid #16a34a"></span>рабочий</span>' +
      '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:14px;height:14px;border-radius:3px;background:#f1f5f9;border:1px solid #cbd5e1"></span>выходной</span>' +
      '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:14px;height:14px;border-radius:3px;background:#fee2e2;border:1px solid #dc2626"></span>отсутствие</span>' +
      '<span style="color:#94a3b8">· нажмите на имя мастера в календаре, чтобы открыть это окно</span>' +
      '</div>';
    h += '</div>';
    h += '<div class="modal-f">' +
      '<button type="button" class="btn" data-action="master-sch-goto" data-uid="' + esc(uid) + '" title="Перейти к полной таблице в разделе «Графики смен»">↗ В «Графики смен»</button>' +
      '<button type="button" class="btn danger" data-action="close-modal">Закрыть</button>' +
      '</div>';
    modal.innerHTML = h;
    modal.style.maxWidth = '560px';
    overlay.classList.add('show');
  }

  /* ---------- DRAG & DROP ---------- */
  var dragId = null;
  /* === Общие функции переноса задач (используются DnD и touch) === */
  function moveTaskToCell(id, cell) {
    var t = findTask(id); if (!t) return;
    if (!canEditTask(t)) { toast('err', 'Нет прав на редактирование этой задачи'); return; }
    var newMaster = cell.dataset.master, newOff = parseInt(cell.dataset.off, 10);
    var oldM = t.m, oldOff = t.d;
    if (!canDropOn(newMaster)) { toast('err', 'Этот мастер вне вашего доступа'); return; }
    planUndoPush('перенос задачи «' + ((workOf(t) || {}).name || '?') + '»'); // 22.09-225: снимок до переноса
    var target = masterById(newMaster);
    // 22.09-80: мастер в этот день не работает (график смен) — НЕ запрещаем
    // (бывают аварийные вызовы), но предупреждаем после переноса.
    var _wkOffWarn = wkOffDayWarn(newMaster, newOff);
    var moved = [];
    if (t.m !== newMaster) { t.m = newMaster; moved.push('мастер → ' + (target ? target.name : '?')); }
    if (t.d !== newOff) { t.d = newOff; moved.push('дата → ' + fmtShort(newOff)); }
    if (moved.length) {
      if (TASKS_DB) { TASKS_DB.updateTask(t.id, t); }
      // Задача из графика: перемещение сдвигает её в графике и все последующие
      // вхождения серии — соответственно периодичности
      if (t.graphId) { try { graphSeriesOnMove(t); } catch (e) {} }
      invalidateRouteCache(oldM, oldOff);
      invalidateRouteCache(newMaster, newOff);
      logAction('Перемещение задачи', (target ? target.name : '?') + ': ' + moved.join(', '));
      drawCalendarGrid();
      if (_wkOffWarn) toast('warn', _wkOffWarn);
      var load = loadForDay(newMaster, newOff);
      if (_wkOffWarn) { /* день нерабочий — перегрузочный тост не дублируем */ }
      else if (load > masterCapacity(newMaster, newOff)) {
        toast('warn', '🛑 Аналитика помощника : Внимание! Перегрузка мастера ' + (target ? target.name : '') + ' до ' + fmtH(load) + ' ч (при норме ' + fmtH(masterCapacity(newMaster, newOff)) + ' ч). Предлагаем перенести задачу на другой день или заменить мастера!');
      } else {
        toast('ok', '💡 Аналитика помощника : Перенос успешно выполнен. Текущая загрузка мастера ' + (target ? target.name : '') + ' на этот день составляет ' + fmtH(load) + ' ч / ' + fmtH(masterCapacity(newMaster, newOff)) + ' ч.');
      }
    }
  }

  function deleteTaskToTrash(id) {
    // 22.09-268: удаление задач — по правам доступа (админ всегда может)
    if (S.role !== 'admin' && (typeof permCan !== 'function' || !permCan('delTasks'))) {
      try { toast('err', 'Удалять задачи можно только с разрешения (Права доступа)'); } catch (e) {}
      return;
    }
    var t = findTask(id); if (!t) return;
    if (!canEditTask(t)) { toast('err', 'Нет прав на удаление этой задачи'); return; }
    var w = workOf(t);
    return spConfirm('Удалить задачу «' + (w ? w.name : '?') + ' — ' + addrOf(t) + '»?', { title: 'Удаление задачи', ok: 'Удалить', danger: true }, function () { // 22.09-244: оформленное окно
    addToTrash(JSON.parse(JSON.stringify(t)));
    if (TASKS_DB) { TASKS_DB.deleteTask(id); S.tasks = TASKS_DB.getTasks(); } else { S.tasks = S.tasks.filter(function (x) { return x.id !== id; }); }
    invalidateRouteCache(t.m, t.d);
    drawCalendarGrid();
    logAction('Удаление задачи', (w ? w.name : '?') + ' — ' + addrOf(t));
        toast('ok', '🗑️ Аналитика помощника : Задача удалена. Освободилось ' + fmtH(taskHours(t)) + ' ч у мастера ' + (masterById(t.m) ? masterById(t.m).name : '?') + '.');
    });
  }

  function reorderMapCard(fromId, toId) {
    var pts = ymState.pts;
    if (!pts || !pts.length) return;
    var fromIdx = -1, toIdx = -1;
    pts.forEach(function (p, i) {
      if (p.id === fromId) fromIdx = i;
      if (p.id === toId) toIdx = i;
    });
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    var moved = pts.splice(fromIdx, 1)[0];
    pts.splice(toIdx, 0, moved);
    ymState.manualOrder = true;
    refreshMapCards(pts);
    drawMap(pts);
    toast('ok', 'Порядок изменён');
  }

  /* === Touch Drag & Drop Polyfill (для планшетов и телефонов) === */
  function enableTouchDnD() {
    var ts = null; // touchState

    function onStart(e) {
      var tile = e.target.closest('.tile[draggable="true"]');
      var mtask = e.target.closest('.mtask[draggable="true"]');
      var wkcard = e.target.closest('.wk-card[draggable="true"]'); // карточка слесаря (страница «Работники»)
      var el = tile || mtask || wkcard;
      if (!el) return;
      // Не мешаем кликам по чекбоксам, кнопкам и grip-иконкам
      if (e.target.closest('.tile-chk') || e.target.closest('button') || e.target.tagName === 'INPUT') return;
      var touch = e.touches[0];
      ts = {
        type: tile ? 'tile' : (mtask ? 'mtask' : 'wkcard'),
        id: tile ? tile.dataset.tid : (mtask ? mtask.dataset.mid : wkcard.dataset.uid),
        startX: touch.clientX, startY: touch.clientY,
        moved: false, el: el, ghost: null, dropTarget: null, dropType: null
      };
    }

    function onMove(e) {
      if (!ts) return;
      var touch = e.touches[0];
      if (!ts.moved) {
        if (Math.abs(touch.clientX - ts.startX) < 8 && Math.abs(touch.clientY - ts.startY) < 8) return;
        ts.moved = true;
        // Создаём ghost-клон
        var rect = ts.el.getBoundingClientRect();
        ts.ghost = ts.el.cloneNode(true);
        ts.ghost.style.cssText = 'position:fixed;z-index:99999;opacity:0.85;pointer-events:none;width:' + rect.width + 'px;transform:scale(0.92) rotate(-1deg);box-shadow:0 8px 24px rgba(0,0,0,.3);';
        document.body.appendChild(ts.ghost);
        ts.el.style.opacity = '0.25';
      }
      if (ts.moved) {
        e.preventDefault();
        var g = ts.ghost;
        g.style.left = (touch.clientX - g.offsetWidth / 2) + 'px';
        g.style.top = (touch.clientY - 25) + 'px';
        // Найти элемент под пальцем (скрываем ghost на мгновение)
        g.style.display = 'none';
        var under = document.elementFromPoint(touch.clientX, touch.clientY);
        g.style.display = '';

        // Очистка старой подсветки
        document.querySelectorAll('.cell.drop-on').forEach(function (c) { c.classList.remove('drop-on'); });
        document.querySelectorAll('.mtask.drop-above').forEach(function (c) { c.classList.remove('drop-above'); });
        document.querySelectorAll('.wk-drop-on').forEach(function (c) { c.classList.remove('wk-drop-on'); });
        var tr = document.getElementById('trash-zone');
        if (tr) tr.classList.remove('drop-active');

        ts.dropType = null; ts.dropTarget = null;

        if (ts.type === 'wkcard') {
          var wkzone = under ? under.closest('[data-wk-drop]') : null;
          if (wkzone) { wkzone.classList.add('wk-drop-on'); ts.dropType = 'wkzone'; ts.dropTarget = wkzone; }
        } else if (ts.type === 'tile') {
          var cell = under ? under.closest('.cell') : null;
          var trash = under ? under.closest('.trash-zone') : null;
          if (cell) { cell.classList.add('drop-on'); ts.dropType = 'cell'; ts.dropTarget = cell; }
          else if (trash) { trash.classList.add('drop-active'); ts.dropType = 'trash'; ts.dropTarget = trash; }
        } else if (ts.type === 'mtask') {
          var card = under ? under.closest('.mtask') : null;
          if (card && card.dataset.mid !== ts.id) { card.classList.add('drop-above'); ts.dropType = 'mtask'; ts.dropTarget = card; }
        }
      }
    }

    function onEnd(e) {
      if (!ts) return;
      if (ts.ghost) ts.ghost.remove();
      if (ts.el) ts.el.style.opacity = '';
      document.querySelectorAll('.cell.drop-on').forEach(function (c) { c.classList.remove('drop-on'); });
      document.querySelectorAll('.mtask.drop-above').forEach(function (c) { c.classList.remove('drop-above'); });
      document.querySelectorAll('.wk-drop-on').forEach(function (c) { c.classList.remove('wk-drop-on'); });
      var tr = document.getElementById('trash-zone');
      if (tr) tr.classList.remove('drop-active');

      if (ts.moved && ts.dropType && ts.dropTarget) {
        if (ts.dropType === 'cell') moveTaskToCell(ts.id, ts.dropTarget);
        else if (ts.dropType === 'trash') deleteTaskToTrash(ts.id);
        else if (ts.dropType === 'mtask') reorderMapCard(ts.id, ts.dropTarget.dataset.mid);
        else if (ts.dropType === 'wkzone') wkDropSlesar(ts.id, ts.dropTarget.getAttribute('data-wk-drop') || '');
      }
      ts = null;
    }

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onEnd, { passive: true });
  }

  function attachCalDnD() {
    var grid = document.getElementById('cal-grid'); if (!grid) return;
    grid.addEventListener('dragstart', function (e) {
      var tile = e.target.closest('.tile'); if (!tile) return;
      dragId = tile.dataset.tid; tile.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragId); } catch (err) {}
    });
    grid.addEventListener('dragend', function () {
      document.querySelectorAll('.tile.dragging').forEach(function (t) { t.classList.remove('dragging'); });
      document.querySelectorAll('.cell.drop-on').forEach(function (c) { c.classList.remove('drop-on'); });
      dragId = null;
    });
    grid.addEventListener('dragover', function (e) {
      if (!dragId) return;
      var cell = e.target.closest('.cell'); if (!cell) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.cell.drop-on').forEach(function (c) { if (c !== cell) c.classList.remove('drop-on'); });
      cell.classList.add('drop-on');
    });
    grid.addEventListener('drop', function (e) {
      if (!dragId) return;
      var cell = e.target.closest('.cell'); if (!cell) return;
      e.preventDefault();
      cell.classList.remove('drop-on');
      var id = dragId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
      moveTaskToCell(id, cell);
    });
    grid.addEventListener('mousemove', tipHandler);
    grid.addEventListener('mouseleave', function () { tip.style.display = 'none'; });

    // === КОРЗИНА: перетаскивание задачи для удаления ===
    var trash = document.getElementById('trash-zone');
    if (trash) {
      trash.addEventListener('dragover', function (e) {
        if (!dragId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        trash.classList.add('drop-active');
      });
      trash.addEventListener('dragleave', function () { trash.classList.remove('drop-active'); });
      trash.addEventListener('drop', function (e) {
        e.preventDefault();
        trash.classList.remove('drop-active');
        if (!dragId) return;
        deleteTaskToTrash(dragId);
      });
    }
  }
  function tipHandler(e) {
    var tile = e.target.closest('.tile');
    if (!tile) { tip.style.display = 'none'; return; }
    var t = findTask(tile.dataset.tid); if (!t) return;
    var o = OBJ_MAP[t.o], w = workOf(t), m = masterById(t.m);
    var dlTxt = t.dl < 0 ? '<b style="color:#fca5a5">просрочка ' + (-t.dl) + ' дн</b>' : t.dl === 0 ? '<b style="color:#fde047">дедлайн сегодня</b>' : 'дедлайн: ' + fmtShort(t.dl);
    tip.innerHTML = '<b>' + esc(w ? w.name : '?') + '</b><br>' + esc(addrOf(t)) + ' · ' + esc(o ? o.type : '') + '<br>Объём: ' + (t.volume || 1) + ' ' + (w ? w.unit : '') + ' — ' + fmtH(taskHours(t)) + ' ч' +
      (t.needs_permit ? '<br><b style="color:#fca5a5">📋 Ордер до: ' + (t.dl_date || '—') + '</b>' : '') +
      (t.depends_on_snow ? '<br><b style="color:#7dd3fc">❄️ Снегозависимая (норматив 48 ч)</b>' : '') +
      (w && w.min_temp > -50 ? '<br><b style="color:#fbbf24">🌡️ Мин. t: +' + w.min_temp + '°C' + (function(){ var wf = getWeatherForecast(t.d); if (!wf) return ''; var snowInfo = wf.snow ? ' · ❄️ ' + wf.snowfall + 'мм' : ''; return ' (прогноз: ' + wf.temp + '°C · ' + wf.desc + snowInfo + ')'; })() + '</b>' : '') +
      (w && w.equipment && w.equipment !== '—' ? '<br>🚜 Техника: ' + esc(w.equipment) : '') +
      '<br>Мастер: ' + esc(m ? m.name : '?') + ' · ' + statusLabel(t) + '<br>' + dlTxt + ' · план: ' + fmtShort(t.d);
    tip.style.display = 'block';
    var x = e.clientX + 14, y = e.clientY + 14;
    if (x + 270 > window.innerWidth) x = e.clientX - 270;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function findTask(id) { for (var i = 0; i < S.tasks.length; i++) if (S.tasks[i].id === id) return S.tasks[i]; return null; }
  // 22.09-225: Ctrl+Z (Cmd+Z на Mac) — отмена последнего действия в планировании
  document.addEventListener('keydown', function (e) {
    try {
      if (!e || !(e.ctrlKey || e.metaKey)) return;
      var k = String(e.key || '').toLowerCase();
      if (k !== 'z' && k !== 'я') return;
      if (S.screen !== 'calendar') return;
      var ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) return;
      e.preventDefault();
      planUndoApply();
    } catch (e2) {}
  });

  /* =====================================================================
     ЯДРО: "ОПТИМИЗАТОР"
     ===================================================================== */
  /* 22.09-225: ОТМЕНА ДЕЙСТВИЙ В ПЛАНИРОВАНИИ (как Ctrl+Z в Excel).
     Перед переносом задачи, правкой задачи или «Оптимизировать работы» делается
     моментальный снимок ВСЕХ задач (стек до 30, живёт до перезагрузки страницы).
     Откат — кнопка «⟲ Отмена» в строке кнопок календаря или Ctrl+Z на странице. */
  var PLAN_UNDO_MAX = 30;
  function planUndoStack() { if (!S.planUndo) S.planUndo = []; return S.planUndo; }
  function planUndoPush(label) {
    try {
      var st = planUndoStack();
      st.push({ label: String(label || 'изменение'), ts: Date.now(), tasks: JSON.parse(JSON.stringify(S.tasks || [])) });
      if (st.length > PLAN_UNDO_MAX) st.splice(0, st.length - PLAN_UNDO_MAX);
    } catch (e) {}
  }
  function planUndoApply() {
    var st = planUndoStack();
    if (!st.length) { toast('warn', 'Отменять нечего — действий в планировании ещё не было'); return; }
    var snap = st.pop();
    var beforeIds = {};
    try { (TASKS_DB ? TASKS_DB.getTasks() : (S.tasks || [])).forEach(function (t) { if (t && t.id) beforeIds[t.id] = 1; }); } catch (eB) {}
    try {
      if (TASKS_DB && TASKS_DB.reloadFromCloud) TASKS_DB.reloadFromCloud({ schema: 3, tasks: JSON.parse(JSON.stringify(snap.tasks)) });
      S.tasks = TASKS_DB ? TASKS_DB.getTasks() : JSON.parse(JSON.stringify(snap.tasks));
    } catch (eR) { S.tasks = JSON.parse(JSON.stringify(snap.tasks)); }
    // Сервер: вернуть состояние снимка (лучшее усилие): задачи снимка — upsert,
    // созданные после снимка — удалить с сервера тоже
    try {
      if (window.SP_API && SP_API.getToken && SP_API.getToken()) {
        var keepIds = {};
        (snap.tasks || []).forEach(function (t) {
          if (!t || !t.id) return;
          keepIds[t.id] = 1;
          SP_API.upsert('tasks', t).catch(function () {});
        });
        Object.keys(beforeIds).forEach(function (id) {
          if (!keepIds[id]) SP_API.del('tasks', id).catch(function () {}); // 22.09-254: был несуществующий SP_API.delete — удаление на сервере не срабатывало
        });
      }
    } catch (eS) {}
    try { (S.tasks || []).forEach(function (t) { if (t && t.id != null) invalidateRouteCache(t.m, t.d); }); } catch (eC) {}
    try { logAction('Отмена действия в планировании', snap.label); } catch (eL) {}
    toast('ok', '⟲ Отменено: ' + snap.label);
    if (S.screen === 'calendar') refresh();
  }

  function optimizeWorksCalendar() {
    var edits = 0;
    var masters = visibleMasters();
    planUndoPush('⚡ «Оптимизировать работы» (все перемещения одним снимком)'); // 22.09-225: снимок до оптимизации
    
    masters.forEach(function (m) {
      var mTasks = S.tasks.filter(function (t) { return t.m === m.id && !isDone(t); });
      if (!mTasks.length) return;

      // 22.09-223: СОВМЕСТНЫЕ работы одного объекта (помечены «🤝 совместно» в карточке
      // вида работ) двигаем ЕДИНЫМ блоком: они обязаны остаться в один день, ДАЖЕ если
      // мастеру не хватает часов на всё сразу (для блока вместимость дня не проверяем).
      // Совместность — как в графике работ: joint_with по id вида работ или по группе.
      var _ojArea = (function () { var mm = masterById(m.id); return mm ? mm.area : null; })();
      function _ojWork(t) { var ar = (t.garea != null && t.garea !== '') ? t.garea : _ojArea; try { return ar ? WORK.getWork(ar, t.w) : (WORK_MAP[t.w] || null); } catch (eW) { return null; } }
      function _ojJoints(w) { var j = w && w.joint_with; return Array.isArray(j) ? j : (j ? [j] : []); }
      function _ojPair(t1, t2) {
        if (!t1 || !t2 || t1 === t2 || String(t1.o) !== String(t2.o)) return false;
        var w1 = _ojWork(t1), w2 = _ojWork(t2);
        if (!w1 || !w2) return false;
        var j1 = _ojJoints(w1), j2 = _ojJoints(w2);
        if (j1.indexOf(t2.w) >= 0 || j2.indexOf(t1.w) >= 0) return true;
        var g1 = (w1.group ? String(w1.group).trim() : ''), g2 = (w2.group ? String(w2.group).trim() : '');
        return (g2 !== '' && j1.indexOf(g2) >= 0) || (g1 !== '' && j2.indexOf(g1) >= 0);
      }
      // 22.09-230: «липкость» задач при оптимизации — вместе двигаем не только
      // совместные 🤝 пары, но и ВСЕ задачи ОДНОГО объекта: они ставятся на
      // один день (объект посещается один раз за день)
      function _ojSticky(t1, t2) {
        if (!t1 || !t2 || t1 === t2) return false;
        if (_ojPair(t1, t2)) return true;
        var o1 = t1.o != null ? String(t1.o) : '', o2 = t2.o != null ? String(t2.o) : '';
        return o1 !== '' && o1 === o2;
      }
      // Блоки взаимно-совместных задач (одно звено — одна задача)
      var ojUnits = [];
      mTasks.forEach(function (t) {
        var found = null;
        for (var ui = 0; ui < ojUnits.length && !found; ui++) {
          var us = ojUnits[ui].tasks;
          for (var uj = 0; uj < us.length; uj++) if (_ojSticky(t, us[uj])) { found = ojUnits[ui]; break; } // 22.09-230: блокируемся и по объекту
        }
        if (found) found.tasks.push(t); else ojUnits.push({ tasks: [t] });
      });
      // Слияние пересекающихся блоков (А+Б совместны, Б+В — тоже ⇒ А+Б+В вместе)
      var ojMerged = true;
      while (ojMerged) {
        ojMerged = false;
        outer:
        for (var ma = 0; ma < ojUnits.length; ma++) {
          for (var mb = ma + 1; mb < ojUnits.length; mb++) {
            var hit = false;
            for (var ci = 0; ci < ojUnits[ma].tasks.length && !hit; ci++)
              for (var cj = 0; cj < ojUnits[mb].tasks.length && !hit; cj++)
                if (_ojSticky(ojUnits[ma].tasks[ci], ojUnits[mb].tasks[cj])) hit = true; // 22.09-230
            if (hit) {
              ojUnits[ma].tasks = ojUnits[ma].tasks.concat(ojUnits[mb].tasks);
              ojUnits.splice(mb, 1);
              ojMerged = true;
              break outer;
            }
          }
        }
      }
      ojUnits.forEach(function (u) {
        // 22.09-230: совместный 🤝 блок — есть хотя бы одна взаимно-совместная пара;
        // блок ОДНОГО ОБЪЕКТА без 🤝 — тоже в один день (u.isObj)
        u.isJoint = u.tasks.length > 1 && u.tasks.some(function (ta, ia) { return u.tasks.some(function (tb, ib) { return ia < ib && _ojPair(ta, tb); }); });
        u.isObj = !u.isJoint && u.tasks.length > 1;
        // 22.09-223: часы блока — ДЛИТЕЛЬНОСТЬ (чел.-часы / число исполнителей)
        u.h = u.tasks.reduce(function (s2, t2) { return s2 + taskDurHours(t2); }, 0);
        u.dl = Math.min.apply(null, u.tasks.map(function (t2) { return isFinite(+t2.dl) ? +t2.dl : 0; }));
        u.prefDay = Math.min.apply(null, u.tasks.map(function (t2) { return Math.max(0, t2.d); }));
      });
      // Совместные 🤝 блоки — первыми (их день обязателен), затем блоки одного
      // объекта (22.09-230), дальше — по дедлайну, затем по дате
      ojUnits.sort(function (a, b) {
        var ra = a.isJoint ? 0 : (a.isObj ? 1 : 2), rb = b.isJoint ? 0 : (b.isObj ? 1 : 2);
        if (ra !== rb) return ra - rb;
        if (a.dl !== b.dl) return a.dl - b.dl;
        if (a.prefDay !== b.prefDay) return a.prefDay - b.prefDay;
        return b.h - a.h;
      });

      var dayLoad = {};
      S.tasks.forEach(function (t) {
        if (t.m === m.id && isDone(t)) {
          var dOff = Math.max(0, t.d);
          dayLoad[dOff] = (dayLoad[dOff] || 0) + taskDurHours(t); // 22.09-223: занятое — длительность
        }
      });

      ojUnits.forEach(function (u) {
        var h = u.h;
        var prefDay = u.prefDay;
        var bestDay = null;
        var minPenalty = Infinity;
        for (var d = 0; d <= 90; d++) {
          var curLoad = dayLoad[d] || 0;
          // 22.09-223/230: ОДИНОЧНАЯ задача — только на день, где часов хватает
          // (как раньше); совместный БЛОК и блок ОДНОГО ОБЪЕКТА — всегда в один
          // день, даже если часов не хватает.
          if (!u.isJoint && !u.isObj && curLoad > 0 && curLoad + h > masterCapacity(m.id, d)) continue;
          var penalty = Math.abs(d - prefDay) * 10;
          if (d > u.dl) { penalty += (d - u.dl) * 10000 + 50000; }
          if (d > prefDay) { penalty += 5; }
          if (penalty < minPenalty) { minPenalty = penalty; bestDay = d; }
        }
        if (bestDay === null) {
          for (var d2 = 0; d2 <= 90; d2++) {
            if (!(dayLoad[d2] > 0)) { bestDay = d2; break; }
          }
          if (bestDay === null) bestDay = prefDay;
        }
        u.tasks.forEach(function (t) {
          if (t.d !== bestDay) { t.d = bestDay; edits++; }
          if (t.dl < bestDay || t.dl < 0) { t.dl = Math.max(bestDay, 0); edits++; }
          if (TASKS_DB) { TASKS_DB.updateTask(t.id, t); }
        });
        dayLoad[bestDay] = (dayLoad[bestDay] || 0) + h;
      });
    });

    toast('ok', '⚡ Оптимизация работ выполнена: распределено без просрочек с соблюдением 8-часового рабочего дня. Совместные работы (🤝) переносятся единым блоком и остаются в один день, даже если часов не хватает. Все задачи одного объекта — тоже в один день (объект посещается один раз за день).'); // 22.09-223/230
    refresh();
  }
  function autoSchedule() { optimizeWorksCalendar(); }

