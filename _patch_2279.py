#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""22.09-79: интеграция «Графики смен» → «Планирование / Календарь».
   1) В шапке строки мастера — кликабельное имя + строка «сегодня — рабочий/выходной/отсутствие».
   2) В каждой ячейке (мастер × день) — маленькая цветная полоска состояния смены.
   3) Быстрое всплывающее окно openMasterSchPopup (месячный график работника поверх).
   4) Обработчики master-sch-popup / master-sch-goto.
   5) CSS .cell-sh + build-marker.
"""
import sys, io

APP = '/home/user/root_index/app.js'
IDX = '/home/user/index.html'

src = io.open(APP, encoding='utf-8').read()
orig_len = len(src)

# ---------- 1) Кликабельное имя мастера + строка «сегодня — …» ----------
old1 = """      html += '<div class="mname" style="grid-column:1;grid-row:' + rn + '"><span class="dot" style="background:' + m.color + '"></span><div><div class="nm">' + esc(m.name) + '</div><div class="ar">' + esc(m.area) + '</div></div></div>';"""
new1 = """      // Состояние смены «на сегодня» — цветной текст под участком (данные из workers_db).
      var _tSt = wkDayState(m.id, key(TODAY));
      var _tStClr = _tSt === 'work' ? '#16a34a' : (_tSt === 'abs' ? '#dc2626' : '#94a3b8');
      var _tStIco = _tSt === 'work' ? '●' : (_tSt === 'abs' ? '⛔' : '○');
      var _tStLbl = _tSt === 'work' ? 'сегодня — рабочий' : (_tSt === 'abs' ? 'сегодня — отсутствие' : 'сегодня — выходной');
      html += '<div class="mname" data-action="master-sch-popup" data-uid="' + esc(m.id) + '" title="Открыть график смен — ' + esc(m.name) + '" style="grid-column:1;grid-row:' + rn + ';cursor:pointer"><span class="dot" style="background:' + m.color + '"></span><div><div class="nm">' + esc(m.name) + '</div><div class="ar">' + esc(m.area) + '</div><div class="sh-today" style="font-size:9.5px;font-weight:800;color:' + _tStClr + ';margin-top:1px;line-height:1.2">' + _tStIco + ' ' + _tStLbl + '</div></div></div>';"""
assert old1 in src, "Edit1 anchor not found"
src = src.replace(old1, new1, 1)

# ---------- 2) Метка-состояние в каждой ячейке (мастер × день) ----------
old2 = """        html += '<div class="' + cls + '" style="grid-column:' + (ci + 2) + ';grid-row:' + rn + '" data-master="' + m.id + '" data-off="' + off + '"' + (over ? ' title="Перегрузка: ' + fmtH(load) + ' ч"' : '') + '>';
        if (over) html += '<span class="ov-warn">' + fmtH(load) + 'ч</span>';"""
new2 = """        html += '<div class="' + cls + '" style="grid-column:' + (ci + 2) + ';grid-row:' + rn + '" data-master="' + m.id + '" data-off="' + off + '"' + (over ? ' title="Перегрузка: ' + fmtH(load) + ' ч"' : '') + '>';
        if (over) html += '<span class="ov-warn">' + fmtH(load) + 'ч</span>';
        // Компактная полоска состояния смены в левом верхнем углу ячейки:
        // зелёная — рабочий, серая — выходной, красная — отсутствие по графику (workers_db).
        var _cSt = wkDayState(m.id, key(d));
        var _cTip = _cSt === 'work' ? fmt(d) + ' · рабочий день'
                  : _cSt === 'abs'  ? fmt(d) + ' · отсутствие' + (wkData(m.id).abs[key(d)] ? ' (' + esc(wkData(m.id).abs[key(d)]) + ')' : '')
                  : fmt(d) + ' · выходной';
        html += '<span class="cell-sh ' + _cSt + '" data-action="master-sch-popup" data-uid="' + esc(m.id) + '" title="' + esc(_cTip) + ' — открыть график"></span>';"""
assert old2 in src, "Edit2 anchor not found"
src = src.replace(old2, new2, 1)

# ---------- 3) Функция быстрого окна графика работника ----------
anchor3 = """  function windowTitle(days) {
    if (S.calMode === 'day') return fmt(days[0]) + ' · ' + WD_FULL[days[0].getDay()];
    if (S.calMode === 'week') return fmt(days[0]) + ' — ' + fmt(days[6]);
    return MON_NOM[days[0].getMonth()] + ' ' + days[0].getFullYear();
  }
"""
new3 = anchor3 + """
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
      cells += '<div title="' + esc(tip) + '" style="min-height:46px;border-radius:8px;background:' + bg2 + ';border:1px solid ' + bd2 + ';display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:var(--ink);padding:2px' + (isT ? ';box-shadow:inset 0 0 0 2px rgba(37,99,235,.55)' : '') + '">' + dd + '<span style="font-size:9.5px;font-weight:700;color:var(--muted);line-height:1.1">' + WD[dt.getDay()] + '</span></div>';
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
        return '<div style="text-align:center;font-size:11px;font-weight:800;color:' + (i >= 5 ? '#94a3b8' : 'var(--muted)') + '">' + wdName + '</div>';
      }).join('') + '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px">' + cells + '</div>';
    h += '<div style="margin-top:14px;display:flex;gap:14px;align-items:center;font-size:11px;color:var(--muted);flex-wrap:wrap;font-weight:700">' +
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
"""
assert anchor3 in src, "Edit3 anchor not found"
src = src.replace(anchor3, new3, 1)

# ---------- 4) Обработчики действий ----------
old4 = """    else if (a === 'close-hourly') { closeHourlyWeather(); }
    else if (a === 'kpi-today') { kpiToday(); }"""
new4 = """    else if (a === 'close-hourly') { closeHourlyWeather(); }
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
    else if (a === 'kpi-today') { kpiToday(); }"""
assert old4 in src, "Edit4 anchor not found"
src = src.replace(old4, new4, 1)

# ---------- 5) build-marker в TITLES ----------
old5 = """    objmap: ['Карта объектов', 'Сборка 22.09-78 · графики смен: вычищены все дубликаты функций, добавлен программный fallback в schCollectMonth для печати/Excel'],"""
new5 = """    objmap: ['Карта объектов', 'Сборка 22.09-79 · календарь планирования связан с графиками смен: метка состояния в каждой ячейке + всплывающий месячный график работника по клику на имя'],"""
assert old5 in src, "Edit5 anchor not found"
src = src.replace(old5, new5, 1)

io.open(APP, 'w', encoding='utf-8').write(src)
print(f"app.js: {orig_len} -> {len(src)} (+{len(src)-orig_len} bytes)")

# ===================== index.html =====================
idx = io.open(IDX, encoding='utf-8').read()
idx_orig = len(idx)

# CSS для .cell .cell-sh + .sh-today hover (рядом с .ov-warn)
old_c = "  .cell .ov-warn{position:absolute;top:2px;right:3px;font-size:9px;font-weight:800;color:#fff;background:var(--red);border-radius:5px;padding:0 4px}"
new_c = """  .cell .ov-warn{position:absolute;top:2px;right:3px;font-size:9px;font-weight:800;color:#fff;background:var(--red);border-radius:5px;padding:0 4px}
  /* Сборка 22.09-79: компактная метка смены из «Графиков смен» в углу ячейки */
  .cell .cell-sh{position:absolute;top:0;left:0;width:24px;height:4px;border-radius:0 0 4px 0;z-index:2;cursor:pointer}
  .cell .cell-sh.work{background:#16a34a}
  .cell .cell-sh.off{background:#cbd5e1}
  .cell .cell-sh.abs{background:#dc2626}
  .mname .sh-today{transition:opacity .15s}
  .mname[data-action="master-sch-popup"]:hover .nm{text-decoration:underline;text-underline-offset:2px}"""
assert old_c in idx, "CSS anchor not found"
idx = idx.replace(old_c, new_c, 1)

# build-marker
import re
m = re.search(r'(<div[^>]*id="build-marker"[^>]*>)(.*?)(</div>)', idx, re.S)
if m:
    idx = idx[:m.start(2)] + 'Сборка 22.09-79 · календарь ↔ графики смен: метка в ячейке + быстрое окно по клику на имя мастера' + idx[m.end(2):]
    print("index.html build-marker updated")
else:
    print("WARN: #build-marker not found in index.html")

io.open(IDX, 'w', encoding='utf-8').write(idx)
print(f"index.html: {idx_orig} -> {len(idx)} (+{len(idx)-idx_orig} bytes)")
print("OK")
