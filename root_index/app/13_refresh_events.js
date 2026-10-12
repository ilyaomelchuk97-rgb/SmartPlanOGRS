  /* ── часть 13 · app/13_refresh_events.js — перерисовка, перехват ошибок, обработчик нажатий ── */
  function refresh() {
    window.reRenderCurrentScreen = refresh;
    try { rebaseTaskDaysToToday(); } catch (eRb2) {} // 22.09-224: задачи остаются на своих календарных датах
    reconcileFiredResponsibles(); // 22.09-161: уволенных мастеров снять с объектов по дате увольнения
    // Мягкое обновление при синхронизации — только данные, без мигания экрана
    window.onSyncUpdate = function() {
      if (window.SP_TASKS) S.tasks = window.SP_TASKS.getTasks();
      refreshObjects(); // объекты могли прийти с сервера (добавлены другими пользователями)
      // Карта местоположения: данные изменились → плавно перестраиваем маршруты (сигнатура отсеивает пустые обновления)
      if (S.screen === 'livemap') {
        clearTimeout(lmState.refreshTimer);
        lmState.refreshTimer = setTimeout(function () { if (S.screen === 'livemap') renderLiveMap(); }, 2500);
      }
      if (S.user) {
        var fu = DB.getUser(S.user.id);
        if (fu && String(fu.id) === String(S.user.id)) S.user = fu; // 22.09-189
      }
      // Мягкое обновление данных текущего экрана без полной перерисовки
      var rzBadge = document.getElementById('rz-badge');
      if (rzBadge) {
        var redzone = visibleTasks().filter(function (t) { return !isDone(t) && (t.dl <= 2 || t.d < 0); });
        rzBadge.textContent = redzone.length;
      }
      // Дашборд: обновляем KPI числа без перерисовки всей страницы
      if (S.screen === 'dashboard') {
        softUpdateDashboard();
      }
      // Календарь: обновляем только сетку задач, не трогая шапку
      if (S.screen === 'calendar') {
        var _h = S.tasks.map(function(t){return t.id+':'+t.m+':'+t.d+':'+(t.s||t.status);}).sort().join('|');
        if (window._lastTaskHash !== _h) { window._lastTaskHash = _h; var grid = document.getElementById('cal-grid'); if (grid) drawCalendarGrid(); }
      }
      console.log('🔄 Данные обновлены мягко (без перерисовки)');
    };
    var view = document.getElementById('view');
    if (view) view.style.padding = (S.screen === 'livemap' || S.screen === 'objmap') ? '0' : '';
    // Уход со страницы «Карта местоположения» — останавливаем симуляцию и освобождаем карту
    if (name !== 'livemap') {
      lmStopTicker();
      clearTimeout(lmState.refreshTimer);
      if (lmState.ymap) { try { lmState.ymap.destroy(); } catch (e) {} lmState.ymap = null; lmState.token++; }
      lmState.virt = null; // при возврате — снова реальные дата и время
      lmState.pageDate = null;
      S.lmDay = null;
    }
    // Уход со страницы «Карта объектов» — освобождаем карту, SVG-слой и облачко
    if (name !== 'objmap') {
      if (omState.svg) { try { omState.svg.destroy(); } catch (e) {} omState.svg = null; }
      if (omState.map) { try { omState.map.destroy(); } catch (e) {} omState.map = null; }
      omHideTip();
    }
    // Останавливаем молнии при уходе с дашборда (на дашборде renderDashboard перезапустит их)
    if (S.screen !== 'dashboard') { stopLightning(); var _wd = document.getElementById('weather-dropdown'); if (_wd) _wd.classList.remove('open'); }
    // Обновляем задания из БД, чтобы подхватить изменения с сервера (синхронизация)
    if (window.SP_TASKS) S.tasks = window.SP_TASKS.getTasks();
    // Защита сессии: проверяем что текущий пользователь всё ещё активен
    if (S.user) {
      var freshUser = DB.getUser(S.user.id);
      if (freshUser && String(freshUser.id) === String(S.user.id)) { // 22.09-189
        S.user = freshUser; // обновляем данные пользователя, но НЕ меняем сессию
      }
    }
    if (S.screen === 'dashboard') renderDashboard();
    else if (S.screen === 'calendar') renderCalendar();
    else if (S.screen === 'map') renderMap();
    else if (S.screen === 'testmap') renderTestMap();
    else if (S.screen === 'testdep') renderTestDep();
    else if (S.screen === 'objmap') renderObjMap();
    else if (S.screen === 'livemap') renderLiveMap();
    else if (S.screen === 'perms') renderPerms();
    else if (S.screen === 'workers' || S.workersModal) renderWorkers();
    else if (S.screen === 'schedules') renderSchedules();
    else if (S.screen === 'refs') renderRefs();
    else if (S.screen === 'writeoffs') renderWriteoffs(); // 22.09-181
    else if (S.screen === 'workcards') renderWorkCards(); // 22.09-191: карточки работ мастера на день
    else if (S.screen === 'factmonth') renderFactMonth(); // 22.09-192: месячный отчёт фактического времени по объектам
    else if (S.screen === 'users') renderUsers();
    else if (S.screen === 'reports') renderReports();
    else if (S.screen === 'logs') renderLogs();
    else if (S.screen === 'errlogs') renderErrLogs();
    else if (S.screen === 'changelog') renderChangelog(); // 22.09-219
    else if (S.screen === 'backup') renderBackup(); // 22.09-139
    else if (S.screen === 'graphs') renderGraphs();
    // 22.09-220: открытые рабочие окна («Настройки бригад», «Факт работ…») — со страницей под ними
    if (S.workersModal && S.screen !== 'workers') renderWorkers();
    if (S.factModal && S.screen !== 'factmonth') renderFactMonth();
  }

  /* ===== ГЛОБАЛЬНЫЙ ПЕРЕХВАТ ОШИБОК: приложение не «белеет» молча =====
     Плашка-тост + журнал последних ошибок (localStorage, последние 20):
     JSON.parse(localStorage.getItem('smartplan_errors')) */
  (function () {
    function reportErr(kind, msg) {
      try {
        var log = JSON.parse(localStorage.getItem('smartplan_errors') || '[]');
        log.push({ t: Date.now(), kind: kind, msg: String(msg).slice(0, 300) });
        if (log.length > 20) log = log.slice(-20);
        localStorage.setItem('smartplan_errors', JSON.stringify(log));
      } catch (e) {}
      try { toast('err', '⚠ ' + kind + ' — ' + String(msg).slice(0, 120) + '. Если страница работает странно — перезагрузите (F5)'); } catch (e) {}
    }
    window.addEventListener('error', function (e) {
      if (e && e.message) reportErr('Ошибка приложения', e.message);
    });
    window.addEventListener('unhandledrejection', function (e) {
      var r = e && e.reason;
      reportErr('Сбой запроса', (r && r.message) ? r.message : 'неизвестный');
    });
  })();

  // Скрыть boot-сплэш (index.html) — приложение инициализировано
  var _bs = document.getElementById('boot-splash');
  if (_bs) {
    _bs.classList.add('hide');
    setTimeout(function () { if (_bs.parentNode) _bs.parentNode.removeChild(_bs); }, 450);
  }

  document.getElementById('nav').addEventListener('click', function (e) {
    var a = e.target.closest('a[data-screen]'); if (!a) return;
    setScreen(a.dataset.screen);
    // На узких экранах (<1080) сайдбар — overlay; клик по пункту закрывает его
    if (window.innerWidth <= 1080) closeDrawer();
  });

  // === БУРГЕР + КЛИК ВНЕ САЙДБАРА (для overlay-режима на ≤1080px) ===
  function closeDrawer() {
    var sb = document.getElementById('sidebar'); if (sb) sb.classList.remove('open');
    document.body.classList.remove('drawer-open');
  }
  function openDrawer() {
    var sb = document.getElementById('sidebar'); if (sb) sb.classList.add('open');
    document.body.classList.add('drawer-open');
  }
  document.getElementById('burger').addEventListener('click', function () {
    var sb = document.getElementById('sidebar');
    if (!sb) return;
    if (sb.classList.contains('open')) closeDrawer(); else openDrawer();
  });

  // Клик по основному контенту (вне сайдбара) закрывает overlay-сайдбар
  // — работает только при ширине ≤1080px (на десктопе сайдбар всегда видим)
  function isDrawerOpen() { return document.body.classList.contains('drawer-open'); }
  document.addEventListener('click', function (e) {
    if (window.innerWidth > 1080) return;       // десктоп — не трогаем
    if (!isDrawerOpen()) return;                // закрыт — нечего закрывать
    var sb = document.getElementById('sidebar');
    var burger = document.getElementById('burger');
    // клик по самому сайдбару / бургеру не закрывает
    if (sb && sb.contains(e.target)) return;
    if (burger && burger.contains(e.target)) return;
    closeDrawer();
  });
  var baseSel = document.getElementById('base-select');
  if (baseSel) baseSel.addEventListener('change', function (e) { S.baseId = e.target.value; refresh(); });
  overlay.addEventListener('click', function (e) { /* клик мимо окна не закрывает — только кнопкой × или «Отмена» */ });

  document.addEventListener('click', function (e) {
    // Закрытие календаря выбора месяца отчёта при клике вне его
    var rmDd = document.getElementById('report-month-dropdown');
    if (rmDd && rmDd.classList.contains('open') && !rmDd.contains(e.target) && !e.target.closest('[data-action="report-month-toggle"]')) {
      rmDd.classList.remove('open');
    }
    var dmDd = document.getElementById('dash-month-dropdown');
    if (dmDd && dmDd.classList.contains('open') && !dmDd.contains(e.target) && !e.target.closest('[data-action="dash-month-toggle"]')) {
      dmDd.classList.remove('open');
    }
    var usDd = document.getElementById('usr-dd'); // 22.09-106
    if (usDd && usDd.classList.contains('show') && !usDd.contains(e.target) && !e.target.closest('[data-action="usr-menu"]')) {
      usDd.classList.remove('show');
    }
    var el = e.target.closest('[data-action]'); if (!el) return;
    var a = el.dataset.action;
    if (a === 'cal-mode') { S.calMode = el.dataset.mode; renderCalendar(); }
    else if (a === 'cal-prev') { shiftCal(-1); }
    else if (a === 'cal-next') { shiftCal(1); }
    else if (a === 'cal-today') { S.weekShift = 0; S.monthShift = 0; S.dayShift = 0; renderCalendar(); }
    else if (a === 'dash-area-clear') { S.dashArea = null; renderDashboard(); }
    else if (a === 'dash-master-clear') { S.dashMaster = null; renderDashboard(); } // 22.09-193: сброс «КПД мастеров»
    else if (a === 'dash-day-today') { S.dashDayOff = 0; renderDashboard(); } // 22.09-171
    else if (a === 'open-weather') { toggleWeatherDropdown(); }
    else if (a === 'open-wx-map') { openWeatherMap(); }
    else if (a === 'close-wx-map') { closeWeatherMap(); }
    // wx-tl-prev/wx-tl-next/wx-tl-play/wx-basemap — обработчики вешаются НАПРЯМУЮ
    // через addEventListener в openWeatherMap() и initWxTestMap(). Не дублируем
    // здесь, иначе ReferenceError на несуществующих символах ломает клик.
    else if (a === 'open-yandex') { window.open('https://yandex.ru/pogoda/minsk', '_blank'); }
    else if (a === 'open-hourly') { openHourlyWeather(parseInt(el.dataset.off, 10)); }
    else if (a === 'close-hourly') { closeHourlyWeather(); }
    // Клик по имени мастера / полоске состояния в календаре —
    // всплывающий месячный график работника (данные из «Графиков смен»).
    else if (a === 'master-sch-popup') {
      var _msUid = el.dataset.uid;
      var _msBase = (buildDayWindow() || [TODAY])[0];
      openMasterSchPopup(_msUid, _msBase);
    }
    // Кнопка «↗ В “Графики смен”» из popup — открыть раздел и переключить
    // фильтр на бригаду этого мастера (если слесарь — на бригаду его мастера).
    else if (a === 'master-sch-goto') {
      var _gtUid = el.dataset.uid;
      overlay.classList.remove('show');
      modal.style.maxWidth = '';
      var _gtB = wkData(_gtUid).brigade;
      S.schMode = 'b:' + (_gtB || _gtUid);
      setScreen('schedules');
    }
    else if (a === 'kpi-today') { kpiToday(); }
    else if (a === 'kpi-overloads') { kpiOverloads(); }
    else if (a === 'kpi-month') { kpiMonth(); }
    else if (a === 'wk-settings-open') { openWorkersSettingsModal(); } // 22.09-220
    else if (a === 'kpi-permits') { kpiPermits(); }
    else if (a === 'kpi-redzone') { kpiRedzone(); } // 22.09-171
    else if (a === 'new-task') { openTaskModal('new'); }
    else if (a === 'edit-task') {
      if (e.target.closest('.tile-chk') || e.target.closest('[data-action="toggle-done"]')) return;
      var tEdit = findTask(el.dataset.tid);
      if (!tEdit) return;
      if (S.role === 'viewer') { openTaskModal('edit', el.dataset.tid); return; } // режим просмотра
      if (!canEditTask(tEdit)) {
        toast('err', 'У вас нет прав на редактирование этой задачи');
        return;
      }
      openTaskModal('edit', el.dataset.tid);
    }
    else if (a === 'import-tasks-excel') { openTasksExcelModal(); }
    else if (a === 'optimize-works') { optimizeWorksCalendar(); }
    else if (a === 'cal-undo') { planUndoApply(); } // 22.09-225: отмена последнего действия в планировании
    else if (a === 'excel-demo-load') { loadDemoExcelData(); }
    else if (a === 'excel-import-confirm') { confirmExcelImport(); }
    else if (a === 'save-task') { saveTask(); }
    else if (a === 'toggle-done') {
      var tdTask = findTask(el.dataset.tid); if (!tdTask) return;
      if (!canEditTask(tdTask)) { toast('err', 'Нет прав на изменение этой задачи'); el.checked = !el.checked; return; }
      var nowDone = el.checked;
      tdTask.s = nowDone ? 'done' : 'plan';
      tdTask.status = nowDone ? 'done' : 'plan';
      stampTaskDoneDate(tdTask, nowDone); // 22.09-181: дата закрытия для страницы «Списания»
      if (nowDone && !tdTask.finished_at) tdTask.finished_at = Date.now(); // 22.09-190: галочка фиксирует конец, даже если «Приступил» не жали
      if (!nowDone && tdTask.finished_at) delete tdTask.finished_at; // 22.09-190: вернули в план — время окончания сброшено
      if (TASKS_DB) { TASKS_DB.updateTask(tdTask.id, tdTask); }
      invalidateRouteCache(tdTask.m, tdTask.d);
      drawCalendarGrid();
      toast('ok', nowDone ? '✓ Отмечено выполненным' : 'Возвращено в план');
    }
    else if (a === 'task-start') { taskStart(el.dataset.tid); } // 22.09-190: факт начала работ на объекте
    else if (a === 'task-finish') { taskFinish(el.dataset.tid); } // 22.09-190: факт окончания — задача закрывается
    else if (a === 'wc-open') { wcOpen(el.dataset.mid, (typeof S.dashDayOff === 'number' ? S.dashDayOff : 0)); } // 22.09-191: карточки работ мастера на выбранный день
    else if (a === 'wc-back') { setScreen(S.wcBack || 'dashboard'); } // 22.09-191
    else if (a === 'wo-open') { openWriteoffModal(el.dataset.tid); } // 22.09-181
    else if (a === 'fm-prev') { fmShift(-1); } // 22.09-192: месяц назад
    else if (a === 'fm-next') { fmShift(1); } // 22.09-192: месяц вперёд
    else if (a === 'fm-cur') { S.fmYear = TODAY.getFullYear(); S.fmMonth = TODAY.getMonth(); renderFactMonth(); } // 22.09-192: текущий месяц
    else if (a === 'wo-mat-add') { woMatAdd(el.dataset.mid); } // 22.09-183: материал из 1С — в списание (кнопка «+»)
    else if (a === 'wo-mat-del') { woMatDel(el.dataset.mid); } // 22.09-183: убрать материал из списания
    else if (a === 'wo-save') { woSaveWriteoff(); } // 22.09-186: сохранить списания (окно остаётся открытым)
    else if (a === 'wo-save-close') { woSaveWriteoff(); closeTaskObjectPickers(); overlay.classList.remove('show'); modal.style.maxWidth = ''; modal.style.width = ''; S.wkModalUid = null; S.wmJointSel = null; } // 22.09-186: сохранить и закрыть карточку
    else if (a === 'wo-work-pick') { woPickWork(parseInt(el.dataset.idx, 10) || 0); } // 22.09-185: выбор вида работ для списания
    else if (a === 'close-modal') { closeTaskObjectPickers(); overlay.classList.remove('show'); modal.style.maxWidth = ''; modal.style.width = ''; if (S.wkModalUid && S.screen === 'workers') renderWorkers(); S.wkModalUid = null; S.wmJointSel = null; /* 22.09-162 */ S.schEd = null; S.schEdAll = null; S.schEdDay = null; S.schEdMode = null; /* 22.09-211/213 */ S.workersModal = false; S.factModal = false; /* 22.09-220 */ }
    else if (a === 'close-modal2') { var ov2 = document.getElementById('overlay2'); if (ov2) ov2.classList.remove('show'); var md2 = document.getElementById('modal2'); if (md2) { md2.style.width = ''; md2.style.maxWidth = ''; } /* 22.09-235: ширина окна — снова по умолчанию */ if (S.wkModalUid && S.workersModal) { renderWorkers(); } S.wkModalUid = null; /* 22.09-220 */ } // 22.09-162
    else if (a === 'close-modal3') { var ov3 = document.getElementById('overlay3'); if (ov3) ov3.classList.remove('show'); var md3 = document.getElementById('modal3'); if (md3) { md3.style.width = ''; md3.style.maxWidth = ''; } /* 22.09-238: ширина окна — снова по умолчанию */ S.wkDay = null; } // 22.09-220
    else if (a === 'wm-joint-pick') { openWmJointPickModal(); } // 22.09-162
    else if (a === 'save-joint-pick') { saveWmJointPick(); } // 22.09-162
    // ===== Страница «Графики» (Планирование / Графики) =====
    else if (a === 'graphs-new') { openGraphsNewModal(); }
    else if (a === 'graphs-list') { openGraphsListModal(); }
    else if (a === 'graphs-pick') { graphsPick(el.dataset.gid); }
    else if (a === 'graphs-create') { graphsCreate(); }
    else if (a === 'graphs-edit') { e.stopPropagation(); openGraphsEditModal(el.dataset.gid); }
    else if (a === 'graphs-copy') { e.stopPropagation(); graphsCopy(el.dataset.gid); }
    else if (a === 'graphs-del') { e.stopPropagation(); openGraphsDelModal(el.dataset.gid); }
    else if (a === 'graphs-save') { graphsSave(); }
    else if (a === 'graphs-del-confirm') { graphsDelete(); }
    else if (a === 'graphs-del-cancel') { openGraphsListModal(); }
    else if (a === 'graphs-tool') {
      if (el.dataset.tool === 'addobj') { openGraphAddObjsModal(false); }
      else if (el.dataset.tool === 'newobj') { openGraphAddObjsModal(false); } // уже добавленные скрыты
      else if (el.dataset.tool === 'legend') { openGraphLegendModal(); }
      else if (el.dataset.tool === 'snaps') { openGraphSnapsModal(); } // 22.09-226: копии графика
      else if (el.dataset.tool === 'holidays') { openHolidaysModal(); }
      else if (el.dataset.tool === 'period') { openGraphPeriodModal(); }
      else if (el.dataset.tool === 'filter') { openGraphFilterModal(); }
      else if (el.dataset.tool === 'winter') { openGraphWinterModal(); }
      else if (el.dataset.tool === 'delworks') { openGraphDelWorksModal(); }
      else if (el.dataset.tool === 'print') { openGraphPrintModal(); }
      else if (el.dataset.tool === 'labor') { openGraphLaborModal(); } // 22.09-158
    }
    else if (a === 'graphs-add-objs') { graphsAddObjs(); }
    else if (a === 'graphs-del-objs') { graphsDelObjs(); } // 22.09-143
    else if (a === 'gao-mode') { gaoSetMode(el.dataset.m); } // 22.09-143
    else if (a === 'graphs-obj-month') { openGraphObjMonthModal(parseInt(el.dataset.ri, 10) || 0, parseInt(el.dataset.mi, 10) || 0); }
    else if (a === 'graphs-month-view') { openGraphMonthModal(parseInt(el.dataset.mi, 10) || 0); }
    else if (a === 'graphs-print-view') { graphsPrintView(); }
    else if (a === 'graph-snap-preview') { openGraphSnapPreviewModal(el.dataset.sid); } // 22.09-226
    else if (a === 'graph-snap-apply') { graphSnapApply(el.dataset.sid); } // 22.09-226
    else if (a === 'graph-snap-period') { openGraphSnapPeriodModal(el.dataset.sid); } // 22.09-238: периодичность копии — только просмотр
    else if (a === 'graph-snap-del') { graphSnapDelete(el.dataset.sid); } // 22.09-239: удаление копии (ст. мастер, нач. участка, админ)
    else if (a === 'graph-snap-print') { openGraphSnapPrintModal(el.dataset.sid); } // 22.09-240: печать копии — окно настроек
    else if (a === 'graph-snap-print-go') { graphSnapFetch(el.dataset.sid, function (snP) { graphsPrintGo(snP.graph, snP); }); } // 22.09-240/242: без новой копии
    else if (a === 'graph-snap-excel-go') { var _xo = graphPrintOpts(document.getElementById('modal3')); graphSnapFetch(el.dataset.sid, function (snX) { graphsExportExcel(_xo, snX.graph, snX); }); } // 22.09-240/242: без новой копии
    else if (a === 'graph-dup-hide') { S.graphDupWarnHidden = true; renderGraphs(); } // 22.09-227
    else if (a === 'graphs-filter-save') { graphsFilterSave(); }
    else if (a === 'graphs-winter-save') { graphsWinterSave(); }
    else if (a === 'graphs-winter-clear') { graphsWinterClear(); }
    else if (a === 'graphs-delworks-confirm') { graphsDeleteAllWorks(); }
    else if (a === 'graphs-print-go') { graphsPrintGo(); }
    else if (a === 'graphs-excel-go') { graphsExportExcel(graphPrintOpts()); }
    else if (a === 'graphs-period-save') { graphsPeriodSave(); }
    else if (a === 'graphs-labor-objs') { openGraphLaborObjsModal(); } // 22.09-196: окно «Трудоёмкость по объектам»
    else if (a === 'graphs-labor-obj') { S.gloRi = parseInt(el.dataset.ri, 10); gloRender(); } // 22.09-196: внутрь карточки объекта
    else if (a === 'graphs-labor-back') { S.gloRi = -1; gloRender(); } // 22.09-196: назад к списку объектов
    else if (a === 'backup-dl-all') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } backupDownload(null); } // 22.09-139
    else if (a === 'backup-dl-sel') {
      if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
      var _bk = [];
      document.querySelectorAll('[data-bk]').forEach(function (c) { if (c.checked) _bk.push(c.getAttribute('data-bk')); });
      if (!_bk.length) { toast('warn', 'Отметьте базы для выгрузки'); return; }
      backupDownload(_bk);
    }
    else if (a === 'backup-check-all') { document.querySelectorAll('[data-bk]').forEach(function (c) { c.checked = true; }); }
    else if (a === 'backup-check-none') { document.querySelectorAll('[data-bk]').forEach(function (c) { c.checked = false; }); }
    else if (a === 'backup-restore') { var _bf = document.getElementById('backup-file'); if (_bf) _bf.click(); }
    else if (a === 'backup-restore-go') { backupRestoreGo(); }
    else if (a === 'gl-color') { /* цвет обозначения — слушатель на инпуте */ }
    // ===== Страница «Работники» =====
    else if (a === 'wk-month-prev') { wkShiftMonth(-1); }
    else if (a === 'wk-month-next') { wkShiftMonth(1); }
    else if (a === 'wk-open-card') { openWkCardModal(el.dataset.uid, false); }
    else if (a === 'open-my-card') { if (S.user && S.user.id) openWkCardModal(S.user.id, true); } // 22.09-94: кружок-аватар → своя карточка (просмотр)
    else if (a === 'wk-quick-abs') {
      // отсутствие одним кликом — без комментария (комментарий можно добавить повторным кликом по дню)
      if (window.SP_WORKERS) SP_WORKERS.setAbsence(el.dataset.uid, el.dataset.ds, '');
      toast('ok', '✓ Отсутствие отмечено — нажмите на день, чтобы указать причину');
      var _backQ = S.wkModalUid;
      if (S.screen === 'workers' || S.workersModal) renderWorkers();
      else if (S.screen === 'schedules') renderSchedules();
      if (_backQ) openWkCardModal(_backQ);
    }
    else if (a === 'wk-open-day') { openWkDayModal(el.dataset.uid, el.dataset.ds); }
    else if (a === 'sch-day-edit') { openSchDayEditModal(el.dataset.uid, el.dataset.ds); } // 22.09-207
    else if (a === 'sch-day-save') { schDayEditSave(false); } // 22.09-207
    else if (a === 'sch-day-reset') { schDayEditSave(true); } // 22.09-207
    else if (a === 'sch-ed-cell') { openSchEdDayModal(el.dataset.uid, el.getAttribute('data-sch-day')); } // 22.09-213
    else if (a === 'sch-ed-prev') { schEdMonthNav(-1); } // 22.09-211
    else if (a === 'sch-ed-next') { schEdMonthNav(1); } // 22.09-211
    else if (a === 'scheday-apply') { schEdDayApply(); } // 22.09-213
    else if (a === 'scheday-reset') { schEdDayReset(); } // 22.09-213
    else if (a === 'sch-ed-save') { schEdSaveAll(); } // 22.09-211
    else if (a === 'wk-edit-comment') { openWkCommentModal(el.dataset.uid); }
    else if (a === 'wk-day-save') {
      if (S.wkDay && S.wkDay.ds) {
        try { document.getElementById('overlay3').classList.remove('show'); } catch (e) {} // 22.09-220
        var _wdInp = document.getElementById('wk-day-comment');
        if (window.SP_WORKERS) SP_WORKERS.setAbsence(S.wkDay.uid, S.wkDay.ds, _wdInp ? _wdInp.value : '');
        toast('ok', '✓ Отсутствие отмечено');
        var _backUid = S.wkModalUid; S.wkDay = null;
        if (S.screen === 'workers' || S.workersModal) renderWorkers();
        else if (S.screen === 'schedules') renderSchedules();
        if (_backUid) openWkCardModal(_backUid);
        else {
          overlay.classList.remove('show');
          if (S.screen === 'workers' || S.workersModal) renderWorkers();
          else if (S.screen === 'schedules') renderSchedules();
        }
      }
    }
    else if (a === 'wk-day-del') {
      if (S.wkDay && S.wkDay.ds) {
        try { document.getElementById('overlay3').classList.remove('show'); } catch (e) {} // 22.09-220
        if (window.SP_WORKERS) SP_WORKERS.setAbsence(S.wkDay.uid, S.wkDay.ds, null);
        toast('ok', '✓ Отметка отсутствия снята');
        var _backUid2 = S.wkModalUid; S.wkDay = null;
        if (S.screen === 'workers' || S.workersModal) renderWorkers();
        else if (S.screen === 'schedules') renderSchedules();
        if (_backUid2) openWkCardModal(_backUid2);
        else {
          overlay.classList.remove('show');
          if (S.screen === 'workers' || S.workersModal) renderWorkers();
          else if (S.screen === 'schedules') renderSchedules();
        }
      }
    }
    else if (a === 'wk-comment-save') {
      if (S.wkDay && S.wkDay.uid) {
        try { document.getElementById('overlay3').classList.remove('show'); } catch (e) {} // 22.09-220
        var _wcInp = document.getElementById('wk-card-comment');
        if (window.SP_WORKERS) SP_WORKERS.setWorker(S.wkDay.uid, { comment: _wcInp ? _wcInp.value : '' });
        toast('ok', '✓ Комментарий сохранён');
        var _backUid3 = S.wkModalUid; S.wkDay = null;
        if (S.screen === 'workers' || S.workersModal) renderWorkers();
        if (_backUid3) openWkCardModal(_backUid3);
        else { overlay.classList.remove('show'); renderWorkers(); }
      }
    }
    else if (a === 'open-trash') { openTrashModal(); }
    else if (a === 'restore-task') { restoreFromTrash(parseInt(el.dataset.trashIdx, 10)); }
    else if (a === 'purge-trash') { spConfirm('Удалить все задачи из корзины безвозвратно?', { title: 'Очистка корзины', ok: 'Удалить все', danger: true }, purgeTrash); } // 22.09-244
    else if (a === 'new-user') { openUserModal('new'); }
    else if (a === 'edit-user') { openUserModal('edit', el.dataset.uid); }
    else if (a === 'pwd-user') { openUserModal('pwd', el.dataset.uid); }
    else if (a === 'save-user') { saveUser(); }
    else if (a === 'um-ava-upload') { var _avf = document.getElementById('um-ava-file'); if (_avf) { try { _avf.click(); } catch (e) {} } } // 22.09-219
    else if (a === 'um-ava-remove') { var _avU = S.userModalUid; spConfirm('Удалить фото работника?', { title: 'Фото работника', ok: 'Удалить', danger: true }, function () { saveUserAvatar(_avU, null); }); } // 22.09-219/244
    else if (a === 'del-user') { delUser(el.dataset.uid); }
    else if (a === 'fire-user') { openFireUserModal(el.dataset.uid); }
    else if (a === 'confirm-fire-user') { confirmFireUser(); }
    else if (a === 'restore-user') { openRestoreUserModal(el.dataset.uid); }
    else if (a === 'confirm-restore-user') { confirmRestoreUser(); }
    else if (a === 'download-backup') { downloadBackup(); }
    else if (a === 'demo-seed') { seedDemoData(); }
    else if (a === 'restore-backup') { var rf = document.getElementById('restore-file'); if (rf) rf.click(); }
    else if (a === 'restore-backup-go') {
      if (RESTORE_PENDING) {
        var cntR = 0;
        for (var rk in RESTORE_PENDING) {
          if (/^smartplan_/.test(rk)) { try { localStorage.setItem(rk, RESTORE_PENDING[rk]); cntR++; } catch (e) {} }
        }
        RESTORE_PENDING = null;
        try { overlay.classList.remove('show'); } catch (e) {}
        logAction('Восстановление базы из бэкапа', cntR + ' разделов');
        toast('ok', '♻ База восстановлена (' + cntR + ' разделов) — перезагружаю…');
        setTimeout(function () { location.reload(); }, 900);
      }
    }
    else if (a === 'export-db') { exportDb(); }
    else if (a === 'import-db') { var fi = document.getElementById('import-file'); if (fi) fi.click(); }
    else if (a === 'how-transfer') { e.preventDefault(); toast('ok', 'ПЕРЕНОС БАЗЫ: 1) В браузере, где уже есть пользователи → «Экспорт базы» → скачается users_db.json. 2) В новом браузере → «Импорт базы» → выберите этот файл → нажмите ОК (замена). Готово!'); }
    else if (a === 'telemetry-types') { openTelemetryModal(); } // 22.09-111
    else if (a === 'telemetry-add') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } telemetryAddFromModal(); }
    else if (a === 'telemetry-del') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } telemetryDelete(el.dataset.id); }
    else if (a === 'sch-holidays') { openHolidaysModal(); } // 22.09-109
    else if (a === 'holiday-add') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } holidayAddFromModal(); }
    else if (a === 'holiday-del') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } holidayDelete(el.dataset.id); }
    else if (a === 'usr-menu') { // 22.09-106: стрелочка на сенсоре — открыть/закрыть меню пользователя
      var umDd = document.getElementById('usr-dd'); if (umDd) umDd.classList.toggle('show');
    }
    else if (a === 'logout') { doLogout(); } // 22.09-25/247: остановить синхронизацию, выйти (общая функция — и для отказа от cookie)
    else if (a === 'optimize') { autoSchedule(); }
    else if (a === 'build-route') { buildYandexRoute(false); }
    else if (a === 't-map-off') { TS.off = parseInt(el.dataset.off, 10) || 0; renderTestMap(); }
    else if (a === 't-build-route') { buildTestRoute(false); }
    else if (a === 't-build-compare') { buildTestRouteCompare(); }
    else if (a === 'build-route-no-jam') { buildYandexRoute(true); }
    else if (a === 'map-off') { S.mapOff = parseInt(el.dataset.off, 10); renderMap(); }
    else if (a === 'open-route-yandex') { openMapRouteInYandex(); } // 22.09-177
    else if (a === 'refs-tab') { S.refsTab = el.dataset.tab; renderRefs(); }
    else if (a === 'obj-subtab') { S.objTab = el.dataset.sub; renderRefs(); }
    else if (a === 'dl-works-tpl') { downloadRefTemplate('works'); }
    else if (a === 'dl-norms-tpl') { downloadRefTemplate('norms'); }
    else if (a === 'ul-works-excel') { S.excelImportMode = 'works'; var fi = document.getElementById('ref-excel-file'); if (fi) fi.click(); }
    else if (a === 'ul-norms-excel') { S.excelImportMode = 'norms'; var fi = document.getElementById('ref-excel-file'); if (fi) fi.click(); }
    // --- Справочник: участки ---
    else if (a === 'new-area') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } openAreaModal('new'); }
    else if (a === 'edit-area') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } openAreaModal('edit', el.dataset.aid); }
    else if (a === 'del-area') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } delAreaAction(el.dataset.aid); }
    else if (a === 'save-area') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } saveArea(); }
    // --- Справочник: профессии (Сборка 22.09-86) ---
    else if (a === 'new-prof') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } openProfModal('new'); }
    else if (a === 'edit-prof') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } openProfModal('edit', el.dataset.pid); }
    else if (a === 'del-prof') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } delProfAction(el.dataset.pid); }
    else if (a === 'save-prof') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } saveProf(); }
    else if (a === 'dl-areas-excel') { exportAreasExcel(); }
    else if (a === 'ul-areas-excel') { S.excelImportMode = 'areas'; var fiA = document.getElementById('ref-excel-file'); if (fiA) fiA.click(); }
    else if (a === 'dl-objects-excel') { exportObjectsExcel(); }
    else if (a === 'ul-objects-excel') { S.excelImportMode = 'objects'; var fiO = document.getElementById('ref-excel-file'); if (fiO) fiO.click(); }
    // --- Справочник: объекты (ГРП/ШРП) ---
    else if (a === 'new-object') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } openObjectModal('new'); }
    else if (a === 'new-zone') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } openZoneModal('new'); }
    else if (a === 'edit-zone') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } openZoneModal('edit', el.dataset.oid); }
    else if (a === 'save-zone') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } saveZone(); }
    else if (a === 'zone-draw') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } openZoneDraw('am-poly'); }
    else if (a === 'zone-letter') { S.zoneLetter = el.dataset.l || ''; renderRefs(); }
    else if (a === 'om-pick-point') {
      if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
      var la = (document.getElementById('om-lat') || {}).value, lo = (document.getElementById('om-lng') || {}).value;
      var laF = parseFloat(String(la || '').replace(',', '.')), loF = parseFloat(String(lo || '').replace(',', '.'));
      openPointPick(isFinite(laF) ? laF : null, isFinite(loF) ? loF : null, function (lat, lng) {
        var f1 = document.getElementById('om-lat'), f2 = document.getElementById('om-lng');
        if (f1) f1.value = (+lat).toFixed(6);
        if (f2) f2.value = (+lng).toFixed(6);
        toast('ok', '✓ Точка выбрана: ' + (+lat).toFixed(5) + ', ' + (+lng).toFixed(5));
      });
    }
    else if (a === 'om-draw-area') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } openZoneDraw('om-poly'); }
    else if (a === 'ul-areas-excel') { S.excelImportMode = 'objects'; var fiAx = document.getElementById('ref-excel-file'); if (fiAx) fiAx.click(); }
    else if (a === 'ul-areas-kml') { var fiK = document.getElementById('areas-kml-file'); if (fiK) fiK.click(); }
    else if (a === 'edit-object') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } openObjectModal('edit', el.dataset.oid); }
    else if (a === 'del-object') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } delObjectAction(el.dataset.oid); }
    else if (a === 'save-object') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } saveObject(); }
    else if (a === 'toggle-tree') {
      var ul = el.nextElementSibling;
      if (ul) {
        ul.style.display = (ul.style.display === 'none' ? '' : 'none');
        var isClosed = ul.style.display === 'none';
        el.classList.toggle('closed', isClosed);
        if (!S.refsOpen) S.refsOpen = {};
        if (el.dataset.grp) { if (isClosed) delete S.refsOpen[el.dataset.grp]; else S.refsOpen[el.dataset.grp] = true; } // 22.09-96: запоминаем раскрытые группы
      }
    }
    else if (a === 'new-work') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } openWorkModal('new'); }
    else if (a === 'edit-work') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } openWorkModal('edit', el.dataset.wid); }
    else if (a === 'del-work') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } delWork(el.dataset.wid); }
    else if (a === 'grp-rename') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } openGroupRenameModal(el.dataset.path); }
    else if (a === 'grp-rename-save') { saveGroupRename(); }
    else if (a === 'grp-newwork') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } S.workPresetGroup = el.dataset.path || ''; openWorkModal('new'); }
    else if (a === 'grp-selall') { grpSelAll(el.dataset.path); } // 22.09-229
    else if (a === 'wsel-toggle') { // 22.09-229: галочка у работы — панель обновляем без полной перерисовки
      S.wsel = S.wsel || {};
      var _wselWid = el.dataset.wid;
      var _cntBefore = wselSelCount();
      if (el.checked) S.wsel[_wselWid] = 1; else delete S.wsel[_wselWid];
      var _cntAfter = wselSelCount();
      if ((_cntBefore === 0) !== (_cntAfter === 0)) renderRefs();
      else { var _bar = document.getElementById('wsel-bar'); if (_bar) _bar.outerHTML = wselBarHtml(); }
    }
    else if (a === 'wsel-clear') { S.wsel = {}; renderRefs(); } // 22.09-229
    else if (a === 'wsel-open') { openWorkBulkModal(); } // 22.09-229
    else if (a === 'wbulk-jt') { // 22.09-229: галочка группы «Проводится совместно» в окне групповой правки
      S.wmBulkJoint = S.wmBulkJoint || [];
      var _jg = el.dataset.g || '';
      var _jix = S.wmBulkJoint.indexOf(_jg);
      if (el.checked && _jix === -1) S.wmBulkJoint.push(_jg);
      if (!el.checked && _jix !== -1) S.wmBulkJoint.splice(_jix, 1);
    }
    else if (a === 'wbulk-apply') { workBulkApply(''); } // 22.09-229
    else if (a === 'wbulk-j-replace') { workBulkApply('replace'); } // 22.09-229
    else if (a === 'wbulk-j-add') { workBulkApply('add'); } // 22.09-229
    else if (a === 'grp-props') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } openGroupPropsModal(el.dataset.path); } // 22.09-137
    else if (a === 'grp-props-save') { saveGroupProps(); } // 22.09-137
    else if (a === 'save-work') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } saveWork(); }
    else if (a === 'print-report1') { printReport1(); }
    else if (a === 'print-report2') { printReport2(); }
    else if (a === 'print-permit') { printPermitReport(); }
    else if (a === 'print-snow') { printSnowReport(); }
    else if (a === 'print-weather') { printWeatherReport(); }
    else if (a === 'excel-report1') { exportReport1Excel(); }
    else if (a === 'excel-report2') { exportReport2Excel(); }
    else if (a === 'excel-permit') { exportPermitExcel(); }
    else if (a === 'excel-snow') { exportSnowExcel(); }
    else if (a === 'excel-weather') { exportWeatherExcel(); }
    else if (a === 'report-month-toggle') { e.stopPropagation(); toggleReportMonthPicker(); }
    else if (a === 'rm-prev-year') { e.stopPropagation(); rmState.viewYear--; renderReportMonthPicker(); }
    else if (a === 'rm-next-year') { e.stopPropagation(); rmState.viewYear++; renderReportMonthPicker(); }
    else if (a === 'rm-pick') { e.stopPropagation(); pickReportMonth(parseInt(el.dataset.year, 10), parseInt(el.dataset.month, 10)); }
    else if (a === 'rm-close') { e.stopPropagation(); var dd = document.getElementById('report-month-dropdown'); if (dd) dd.classList.remove('open'); }
    else if (a === 'dash-month-toggle') { e.stopPropagation(); toggleDashMonthPicker(el); } // 22.09-171: позиционировать у нажатой кнопки
    else if (a === 'dm-prev-year') { e.stopPropagation(); dmState.viewYear--; renderDashMonthPicker(); }
    else if (a === 'dm-next-year') { e.stopPropagation(); dmState.viewYear++; renderDashMonthPicker(); }
    else if (a === 'dm-pick') { e.stopPropagation(); pickDashMonth(parseInt(el.dataset.year, 10), parseInt(el.dataset.month, 10)); }
    else if (a === 'dm-close') { e.stopPropagation(); var dmDd = document.getElementById('dash-month-dropdown'); if (dmDd) dmDd.classList.remove('open'); }
  });
  function shiftCal(dir) {
    if (S.calMode === 'week') S.weekShift += dir;
    else if (S.calMode === 'month') S.monthShift += dir;
    else S.dayShift += dir;
    renderCalendar();
  }

