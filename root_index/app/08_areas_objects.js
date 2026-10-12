  /* ── часть 08 · app/08_areas_objects.js — справочники: участки, зоны, объекты, карточка вида работ ── */
  /* =====================================================================
     СПРАВОЧНИК: УЧАСТКИ
     ===================================================================== */
  function renderAreasRefTab(admin, tabsHtml) {
    var areas = window.SP_AREAS ? SP_AREAS.getAll() : [];
    var masters = getMasters();
    var html = '<div style="margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">';
    html += '<span class="sub" style="font-size:12px;color:var(--muted)">Всего участков: ' + areas.length + '</span>';
    html += '<div style="flex:1"></div>';
    html += '<button class="btn ghost" data-action="dl-areas-excel" style="border:1px solid var(--line);background:var(--card);padding:7px 11px;font-size:12.5px;display:inline-flex;align-items:center;gap:6px;" title="Скачать список участков в Excel">📥 Экспорт участков (Excel)</button>';
    html += '<button class="btn ghost" data-action="ul-areas-excel" style="border:1px solid var(--line);background:var(--card);padding:7px 11px;font-size:12.5px;display:inline-flex;align-items:center;gap:6px;" title="Загрузить участки из Excel (добавятся новые)">📤 Импорт участков (Excel)</button>';
    if (admin) html += '<button class="btn primary" data-action="new-area">' + IC.plus + ' Добавить участок</button>';
    html += '</div>';
    html += tabsHtml;

    html += '<div class="card"><table class="dt"><thead><tr><th>Участок</th><th>Видов работ</th><th>Мастеров</th>' + (admin ? '<th style="text-align:right">Действия</th>' : '') + '</tr></thead><tbody>';
    if (!areas.length) html += '<tr><td colspan="' + (admin ? 4 : 3) + '" class="empty">Справочник участков пуст. Добавьте участок или загрузите из Excel.</td></tr>';
    areas.forEach(function (a) {
      var wc = 0;
      try { wc = WORK.getWorks(a.name).length; } catch (e) {}
      var mc = masters.filter(function (m) { return m.area === a.name; }).length;
      html += '<tr><td><b>' + esc(a.name) + '</b></td><td>' + wc + '</td><td>' + mc + '</td>';
      if (admin) html += '<td style="text-align:right;white-space:nowrap"><button class="btn sm" data-action="edit-area" data-aid="' + esc(a.id) + '">Изменить</button> <button class="btn sm" data-action="del-area" data-aid="' + esc(a.id) + '" style="color:var(--red)">Удалить</button></td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  // Модал добавления/переименования участка
  function openAreaModal(mode, aid) {
    S.areaModalMode = mode; S.areaModalAid = aid || null;
    var a = null;
    if (mode === 'edit' && window.SP_AREAS) {
      SP_AREAS.getAll().forEach(function (x) { if (x.id === aid) a = x; });
    }
    var html = '<div class="modal-h"><h3>' + (mode === 'edit' ? 'Изменение участка' : 'Новый участок') + '</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    html += '<div class="fld"><label>Название участка</label><input id="am-name" value="' + (a ? esc(a.name) : '') + '" placeholder="Например: УБиРОГС-2 / Центральный"></div>';
    if (mode === 'edit') html += '<div class="calc">ℹ️ При переименовании автоматически обновляются виды работ и пользователи этого участка.</div>';
    else html += '<div class="calc">ℹ️ После создания участка добавьте для него виды работ (вкладка «Виды работ») или загрузите их из Excel.</div>';
    html += '</div><div class="modal-f"><button class="btn" data-action="close-modal">Отмена</button><button class="btn primary" data-action="save-area">' + (mode === 'edit' ? 'Сохранить' : 'Добавить участок') + '</button></div>';
    modal.style.width = '80%'; modal.style.maxWidth = '80%'; // 22.09-107: карточки справочников — 80% по центру
    modal.innerHTML = html; overlay.classList.add('show');
    var inp = document.getElementById('am-name');
    if (inp) { inp.focus(); inp.select(); }
  }
  function saveArea() {
    var el = document.getElementById('am-name');
    var name = el ? el.value.trim() : '';
    if (!name) { toast('err', 'Введите название участка'); return; }
    if (S.areaModalMode === 'edit') {
      var res = SP_AREAS.renameArea(S.areaModalAid, name);
      if (!res.ok) { toast('err', res.error); return; }
      if (WORK.renameArea) WORK.renameArea(res.oldName, res.name);
      // Пользователи участка переносятся на новое название
      (DB.getUsers() || []).forEach(function (u) {
        if (u && u.area === res.oldName) {
          var p = DB.updateUser(u.id, { area: res.name });
          if (p && p.catch) p.catch(function () {});
        }
      });
      if (S.workArea === res.oldName) S.workArea = res.name;
      if (S.dashArea === res.oldName) S.dashArea = res.name;
      logAction('Изменение участка', res.oldName + ' → ' + res.name);
      toast('ok', '✓ Участок переименован: ' + res.oldName + ' → ' + res.name);
    } else {
      var r = SP_AREAS.addArea(name);
      if (!r.ok) { toast('err', r.error); return; }
      if (WORK.ensureArea) WORK.ensureArea(r.area.name);
      logAction('Добавление участка', r.area.name);
      toast('ok', 'Участок «' + r.area.name + '» добавлен');
    }
    overlay.classList.remove('show'); modal.style.width = ''; modal.style.maxWidth = ''; // 22.09-107
    refresh();
  }
  function delAreaAction(aid) {
    var a = null;
    if (window.SP_AREAS) SP_AREAS.getAll().forEach(function (x) { if (x.id === aid) a = x; });
    if (!a) return;
    var users = (DB.getUsers() || []).filter(function (u) { return u && u.area === a.name; });
    if (users.length) {
      toast('err', '❌ К участку «' + a.name + '» привязаны пользователи: ' + users.map(function (u) { return u.full_name; }).join(', ') + '. Сначала измените им участок.');
      return;
    }
    var wc = 0;
    try { wc = WORK.getWorks(a.name).length; } catch (e) {}
    return spConfirm('Удалить участок «' + a.name + '»?' + (wc ? '\n\nТакже будут удалены его виды работ: ' + wc + ' шт.' : ''), { title: 'Удаление участка', ok: 'Удалить', danger: true }, function () { // 22.09-244: оформленное окно
    if (WORK.deleteArea) WORK.deleteArea(a.name);
    SP_AREAS.deleteArea(aid);
    if (S.workArea === a.name) S.workArea = null;
    if (S.dashArea === a.name) S.dashArea = null;
    logAction('Удаление участка', a.name);
    toast('ok', 'Участок «' + a.name + '» удалён');
    refresh();
    });
  }
  // Экспорт участков в Excel
  function exportAreasExcel() {
    if (!window.XLSX) { ensureXlsxRetry(exportAreasExcel); return; } // ленивая загрузка xlsx
    var areas = window.SP_AREAS ? SP_AREAS.getAll() : [];
    var masters = getMasters();
    var data = [['Участок', 'Видов работ', 'Мастеров']];
    areas.forEach(function (a) {
      var wc = 0;
      try { wc = WORK.getWorks(a.name).length; } catch (e) {}
      data.push([a.name, wc, masters.filter(function (m) { return m.area === a.name; }).length]);
    });
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 32 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Участки');
    var fileName = 'Участки_' + key(TODAY) + '.xlsx';
    try {
      XLSX.writeFile(wb, fileName);
      toast('ok', '📥 Скачан файл: ' + fileName + ' (' + areas.length + ' участков)');
    } catch (err) { toast('err', 'Ошибка: ' + err.message); }
  }

  // Экспорт справочника объектов (ГРП/ШРП) в Excel
  /* ================= ОБЛАСТИ: цвета ================= */
  var ZONE_COLORS = ['#0d9488', '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0284c7', '#475569',
    '#9333ea', '#059669', '#4f46e5', '#e11d48', '#d97706', '#84cc16', '#0891b2', '#be123c', '#4338ca', '#065f46'];
  function zoneIsColor(c) { return !!(c && /^#[0-9a-fA-F]{3,8}$/.test(c)); }
  // Цвет области на карте: свой цвет → по типу (ГРП синий, ШРП фиолетовый, Область бирюзовый, прочие серый)
  function zoneColorOf(o) {
    if (o && zoneIsColor(o.color)) return o.color;
    if (o && o.type === 'ГРП') return '#2563eb';
    if (o && o.type === 'ШРП') return '#7c3aed';
    if (o && o.type === 'ГРС') return '#0891b2';
    if (o && o.type === 'ПГРП') return '#d97706';
    if (!o || o.type === 'Область') return '#0d9488';
    return '#64748b';
  }
  // Палитра цветов области (модалка + оверлей рисования)
  function zonePaletteHtml(sel) {
    var s = zoneIsColor(sel) ? sel.toLowerCase() : '#0d9488';
    var h = '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">';
    for (var i = 0; i < ZONE_COLORS.length; i++) {
      h += '<button type="button" class="zc-sw' + (ZONE_COLORS[i].toLowerCase() === s ? ' on' : '') + '" data-zc="' + ZONE_COLORS[i] + '" title="Цвет ' + ZONE_COLORS[i] + '" style="background:' + ZONE_COLORS[i] + '"></button>';
    }
    h += '<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--muted)">свой <input type="color" class="zc-custom" value="' + (/^#[0-9a-fA-F]{6}$/.test(s) ? s : '#0d9488') + '"></span>';
    h += '</div>';
    return h;
  }
  // Выбор цвета области: обновляем палитры (модалка + оверлей рисования) и превью контура
  function zoneSetColor(c) {
    if (!zoneIsColor(c)) return;
    S.zoneColor = c;
    var roots = [document.getElementById('modal'), document.getElementById('zone-draw-overlay')];
    for (var r = 0; r < roots.length; r++) {
      var root = roots[r];
      if (!root) continue;
      var sws = root.querySelectorAll('.zc-sw');
      for (var i = 0; i < sws.length; i++) {
        if ((sws[i].getAttribute('data-zc') || '').toLowerCase() === c.toLowerCase()) sws[i].classList.add('on');
        else sws[i].classList.remove('on');
      }
      var ci = root.querySelector('.zc-custom');
      if (ci) ci.value = c;
    }
    if (zmState.layer) { zmSyncPreview(); } // перекрасить превью и вершины
  }
  // Слушатели палитры (клики по образцам + свой цвет)
  function wireZoneColors(root) {
    if (!root) return;
    var sws = root.querySelectorAll('.zc-sw');
    for (var i = 0; i < sws.length; i++) {
      sws[i].addEventListener('click', function () { zoneSetColor(this.getAttribute('data-zc')); });
    }
    var ci = root.querySelector('.zc-custom');
    if (ci) ci.addEventListener('input', function () { zoneSetColor(this.value); });
  }
  // Счётчик точек контура в модалке
  function zonePolyCnt(fieldId) {
    fieldId = fieldId || 'am-poly';
    var el = document.getElementById(fieldId);
    var n = el ? parsePolyText(el.value).length : 0;
    var c = document.getElementById(fieldId + '-cnt');
    if (c) c.textContent = n ? (n + ' точек') : 'нет точек';
  }

  /* ================= ОБЛАСТИ: рисование контура на карте ================= */
  // Оверлей поверх модалки: клик по карте = вершина контура. Защита от
  // зависаний (паттерн livemap): ОДИН map.events.add('click'), все
  // гео-объекты interactivityModel 'default#transparent', балунов НЕТ,
  // счётчик и подсказки — только DOM. Существующие объекты и области — фоном.
  var zmState = { map: null, pts: [], layer: null, ctx: [], fieldId: 'am-poly' };

  function zmDestroy() {
    if (zmState.layer) { try { zmState.layer.destroy(); } catch (e) {} zmState.layer = null; }
    try { if (zmState.map) zmState.map.destroy(); } catch (e) {}
    zmState.map = null; zmState.pts = []; zmState.ctx = [];
    var ov = document.getElementById('zone-draw-overlay'); if (ov) ov.remove();
  }
  function zmColor() { return zoneIsColor(S.zoneColor) ? S.zoneColor : '#0d9488'; }
  function zmCounter() {
    var el = document.getElementById('zm-cnt'); if (el) el.textContent = String(zmState.pts.length);
    var btn = document.getElementById('zm-apply'); if (btn) btn.innerHTML = '✓ Готово (' + zmState.pts.length + ')';
  }
  // Всё рисование — в СОБСТВЕННОМ SVG-слое (фон: существующие области/точки;
  // превью: линия с 2 точек, заливка с 3 точек; вершины — нумерованные
  // кружки). Векторные слои Яндекс.Карт не используем — на части машин они
  // не отрисовываются. При пане/зуме слой сам перерисовывается (boundschange).
  function zmSyncPreview() {
    try {
      if (!zmState.layer) return;
      var color = zmColor();
      var items = zmState.ctx.slice(); // фон: существующие объекты (не меняются)
      var coords = zmState.pts;
      if (coords.length >= 3) {
        items.push({ kind: 'poly', pts: coords, color: color, fillOp: 0.16, strokeOp: 0.95, strokeW: 3 });
      } else if (coords.length === 2) {
        items.push({ kind: 'poly', pts: coords, color: color, fillOp: 0, strokeOp: 0.95, strokeW: 3 });
      }
      for (var j = 0; j < coords.length; j++) {
        items.push({ kind: 'dot', lat: +coords[j][0], lng: +coords[j][1], color: color, label: String(j + 1), r: 9 });
      }
      zmState.layer.set(items);
    } catch (e) { /* превью не может ломать карту */ }
  }
  function zmAddPt(lat, lng) {
    if (!zmState.map) return;
    zmState.pts.push([+lat, +lng]);
    zmSyncPreview();
    zmCounter();
  }
  function zmUndo() {
    if (!zmState.pts.length) return;
    zmState.pts.pop();
    zmSyncPreview(); zmCounter();
  }
  function zmClear() {
    if (!zmState.pts.length) return;
    zmState.pts = [];
    zmSyncPreview(); zmCounter();
  }
  function zmApply() {
    if (zmState.pts.length < 3) { toast('err', 'Нужно минимум 3 точки — кликните по карте ещё ' + (3 - zmState.pts.length) + ' ' + ((3 - zmState.pts.length) === 1 ? 'раз' : 'раза')); return; }
    var ta = document.getElementById(zmState.fieldId || 'am-poly');
    if (ta) ta.value = zmState.pts.map(function (p) { return (+p[0]).toFixed(6) + ', ' + (+p[1]).toFixed(6); }).join('\n');
    zonePolyCnt(zmState.fieldId);
    toast('ok', '✓ Контур области: ' + zmState.pts.length + ' точек — не забудьте сохранить');
    zmDestroy();
  }
  function openZoneDraw(fieldId) {
    zmDestroy();
    zmState.fieldId = fieldId || 'am-poly'; // поле контура (модалка области или карточка объекта)
    refreshObjects();
    var withCoords = OBJECTS.filter(function (o) { return o && o.lat != null && o.lng != null; });
    var withPoly = OBJECTS.filter(function (o) { return o && o.poly && o.poly.length >= 3; });
    // правка существующей области: стартуем с её текущего контура
    var startPts = [];
    var ta = document.getElementById(zmState.fieldId);
    if (ta) parsePolyText(ta.value).forEach(function (p) { startPts.push([+p[0], +p[1]]); });
    var ov = document.createElement('div');
    ov.id = 'zone-draw-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,39,64,.72);z-index:400;display:flex;align-items:stretch;justify-content:center;padding:14px';
    ov.innerHTML =
      '<div style="position:relative;width:100%;max-width:1200px;background:var(--card);border-radius:14px;box-shadow:0 20px 60px rgba(15,39,64,.4);display:flex;flex-direction:column;overflow:hidden">' +
        '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line);flex:0 0 auto;flex-wrap:wrap">' +
          '<h3 style="margin:0;font-size:14.5px;color:var(--ink);white-space:nowrap">✏️ Рисование области</h3>' +
          '<span style="font-size:12.5px;color:var(--muted)">клик по карте — вершина контура</span>' +
          '<span style="display:inline-flex;align-items:center;gap:6px;margin-left:auto">' + zonePaletteHtml(S.zoneColor) + '</span>' +
          '<span style="font-size:12.5px;color:var(--muted);white-space:nowrap">точек: <b id="zm-cnt" style="color:var(--ink)">0</b></span>' +
          '<button type="button" id="zm-undo" title="Убрать последнюю точку" style="white-space:nowrap;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">↩ Точка</button>' +
          '<button type="button" id="zm-clear" title="Убрать все точки" style="white-space:nowrap;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--red);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">🗑 Очистить</button>' +
          '<button type="button" id="zm-apply" title="Применить контур и вернуться к карточке области" style="white-space:nowrap;padding:6px 12px;border:1px solid #2563eb;border-radius:8px;background:#2563eb;color:#fff;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">✓ Готово (0)</button>' +
          '<button type="button" id="zm-close" title="Закрыть без сохранения" style="border:none;background:none;cursor:pointer;font-size:19px;color:#64748b;font-family:inherit;line-height:1;padding:2px 6px">×</button>' +
        '</div>' +
        '<div id="zm-canvas" style="flex:1 1 auto;min-height:0;background:var(--panel-2)"></div>' +
        '<div style="padding:6px 14px;border-top:1px solid var(--line);font-size:12px;color:var(--muted);flex:0 0 auto">Клик по карте — добавить вершину · «↩ Точка» — убрать последнюю · «✓ Готово» — применить контур к карточке области. Цвет выбирается круглыми образцами слева.</div>' +
      '</div>';
    document.body.appendChild(ov);
    wireZoneColors(ov);
    ov.querySelector('#zm-close').addEventListener('click', function () {
      if (!zmState.pts.length) { zmDestroy(); return; }
      spConfirm('Закрыть рисование? Несохранённый контур (' + zmState.pts.length + ' точек) будет потерян.', { title: 'Рисование зоны', ok: 'Закрыть', danger: true }, function () { zmDestroy(); }); // 22.09-244
    });
    ov.querySelector('#zm-undo').addEventListener('click', function () { zmUndo(); });
    ov.querySelector('#zm-clear').addEventListener('click', function () {
      if (!zmState.pts.length) { zmClear(); return; }
      spConfirm('Убрать все точки контура?', { title: 'Рисование зоны', ok: 'Убрать', danger: true }, function () { zmClear(); }); // 22.09-244
    });
    ov.querySelector('#zm-apply').addEventListener('click', function () { zmApply(); });
    var canvas = ov.querySelector('#zm-canvas');
    if (canvas) canvas.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;height:100%;padding:30px">' +
      '<div class="skel" style="width:75%;height:26px"></div><div class="skel" style="width:55%;height:26px"></div><div class="skel" style="width:85%;height:26px"></div>' +
      '<div style="font-size:12.5px;font-weight:700;color:var(--muted);margin-top:4px">⏳ Загружаем карту…</div></div>';
    ensureYandex(function () {
      if (!document.getElementById('zone-draw-overlay')) return; // окно уже закрыли
      var holder = ov.querySelector('#zm-canvas');
      if (!holder) return;
      holder.innerHTML = '';
      try {
        var map = new ymaps.Map(holder, {
          center: [53.9023, 27.5619], zoom: 11,
          controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
        }, { suppressMapOpenBlock: true });
        zmState.map = map;
        var b1 = null, b2 = null;
        function grow(pt) {
          if (!b1) { b1 = [pt[0], pt[1]]; b2 = [pt[0], pt[1]]; return; }
          if (pt[0] < b1[0]) b1[0] = pt[0];
          if (pt[0] > b2[0]) b2[0] = pt[0];
          if (pt[1] < b1[1]) b1[1] = pt[1];
          if (pt[1] > b2[1]) b2[1] = pt[1];
        }
        // --- фон: существующие области и точки — тоже своим SVG-слоем ---
        var layer = ymSvgLayer(map, holder);
        zmState.layer = layer;
        var ctxItems = [];
        withPoly.forEach(function (o) {
          try {
            var ring = o.poly.map(function (p) { return [+p[0], +p[1]]; });
            ctxItems.push({ kind: 'poly', pts: ring, color: zoneColorOf(o), fillOp: 0.10, strokeOp: 0.55, strokeW: 2 });
            ring.forEach(grow);
          } catch (e) {}
        });
        withCoords.forEach(function (o) {
          try {
            ctxItems.push({ kind: 'dot', lat: +o.lat, lng: +o.lng, color: omTypeColor(o.type), label: objNumOf(o) || '·', r: 11 });
            grow([+o.lat, +o.lng]);
          } catch (e) {}
        });
        // стартовый контур (правка существующей области)
        startPts.forEach(function (p) { grow(p); });
        zmState.pts = startPts.slice();
        zmState.ctx = ctxItems;
        zmSyncPreview();
        zmCounter();
        // масштаб: по стартовому контуру, иначе по всем объектам
        if (b1 && (startPts.length > 1 || withCoords.length + withPoly.length > 1)) {
          try { map.setBounds([b1, b2], { checkZoomRange: true, zoomMargin: 60 }); } catch (e) {}
        } else if (startPts.length === 1) {
          map.setCenter(startPts[0], 15);
        }
        // --- ЕДИНСТВЕННЫЙ обработчик кликов: добавить вершину ---
        map.events.add('click', function (e) {
          try {
            var c = (e && e.get) ? e.get('coords') : null;
            if (!c || !isFinite(c[0]) || !isFinite(c[1])) return;
            zmAddPt(c[0], c[1]);
          } catch (err) { /* клик не может ломать карту */ }
        });
      } catch (e) {
        toast('err', 'Не удалось открыть карту рисования');
        zmDestroy();
      }
    }, function () {
      toast('err', 'Карта недоступна — проверьте интернет');
      zmDestroy();
    });
  }

  /* ================= ВЫБОР ТОЧКИ НА КАРТЕ (карточка объекта) ================= */
  // Оверлей с картой: клик выбирает точку (для Широты/Долготы объекта).
  // Паттерн анти-зависания: ОДИН map.events.add('click'), без балунов,
  // контекст и маркер — в собственном SVG-слое.
  var ppState = { map: null, layer: null, pt: null, ctx: [] };

  function ppDestroy() {
    if (ppState.layer) { try { ppState.layer.destroy(); } catch (e) {} ppState.layer = null; }
    try { if (ppState.map) ppState.map.destroy(); } catch (e) {}
    ppState.map = null; ppState.pt = null; ppState.ctx = [];
    var ov = document.getElementById('obj-point-overlay'); if (ov) ov.remove();
  }
  function ppRedraw() {
    try {
      var items = ppState.ctx.slice();
      if (ppState.pt) items.push({ kind: 'dot', lat: ppState.pt[0], lng: ppState.pt[1], color: '#dc2626', label: '•', r: 12 });
      if (ppState.layer) ppState.layer.set(items);
      var btn = document.getElementById('pp-apply');
      if (btn) { btn.innerHTML = ppState.pt ? '✓ Готово' : '✓ Готово (кликните по карте)'; btn.disabled = !ppState.pt; }
    } catch (e) {}
  }
  // startLat/startLng — текущие координаты (если заданы — центр карты и предвыбор)
  function openPointPick(startLat, startLng, onApply) {
    ppDestroy();
    refreshObjects();
    var withCoords = OBJECTS.filter(function (o) { return o && o.lat != null && o.lng != null; });
    var withPoly = OBJECTS.filter(function (o) { return o && o.poly && o.poly.length >= 3; });
    var ov = document.createElement('div');
    ov.id = 'obj-point-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,39,64,.72);z-index:400;display:flex;align-items:stretch;justify-content:center;padding:14px';
    ov.innerHTML =
      '<div style="position:relative;width:100%;max-width:1200px;background:var(--card);border-radius:14px;box-shadow:0 20px 60px rgba(15,39,64,.4);display:flex;flex-direction:column;overflow:hidden">' +
        '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line);flex:0 0 auto;flex-wrap:wrap">' +
          '<h3 style="margin:0;font-size:14.5px;color:var(--ink);white-space:nowrap">📍 Выбор точки на карте</h3>' +
          '<span style="font-size:12.5px;color:var(--muted)">кликните по карте — координаты подставятся в карточку объекта</span>' +
          '<button type="button" id="pp-apply" disabled style="margin-left:auto;white-space:nowrap;padding:7px 14px;border:1px solid #2563eb;border-radius:8px;background:#2563eb;color:#fff;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer">✓ Готово (кликните по карте)</button>' +
          '<button type="button" id="pp-close" title="Закрыть без выбора" style="border:none;background:none;cursor:pointer;font-size:19px;color:#64748b;font-family:inherit;line-height:1;padding:2px 6px">×</button>' +
        '</div>' +
        '<div id="pp-canvas" style="flex:1 1 auto;min-height:0;background:var(--panel-2)"></div>' +
        '<div style="padding:6px 14px;border-top:1px solid var(--line);font-size:12px;color:var(--muted);flex:0 0 auto">Клик по карте — выбрать точку (повторный клик переносит её). Существующие объекты показаны фоном.</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('#pp-close').addEventListener('click', function () { ppDestroy(); });
    ov.querySelector('#pp-apply').addEventListener('click', function () {
      if (!ppState.pt) { toast('err', 'Сначала кликните по карте — выберите точку'); return; }
      var p = [ppState.pt[0], ppState.pt[1]];
      ppDestroy();
      try { onApply(p[0], p[1]); } catch (e) {}
    });
    var canvas = ov.querySelector('#pp-canvas');
    if (canvas) canvas.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;height:100%;padding:30px">' +
      '<div class="skel" style="width:75%;height:26px"></div><div class="skel" style="width:55%;height:26px"></div><div class="skel" style="width:85%;height:26px"></div>' +
      '<div style="font-size:12.5px;font-weight:700;color:var(--muted);margin-top:4px">⏳ Загружаем карту…</div></div>';
    ensureYandex(function () {
      if (!document.getElementById('obj-point-overlay')) return;
      var holder = ov.querySelector('#pp-canvas');
      if (!holder) return;
      holder.innerHTML = '';
      try {
        var map = new ymaps.Map(holder, {
          center: [53.9023, 27.5619], zoom: 11,
          controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
        }, { suppressMapOpenBlock: true });
        ppState.map = map;
        var layer = ymSvgLayer(map, holder);
        ppState.layer = layer;
        var ctxItems = [];
        var b1 = null, b2 = null;
        function grow(pt) {
          if (!b1) { b1 = [pt[0], pt[1]]; b2 = [pt[0], pt[1]]; return; }
          if (pt[0] < b1[0]) b1[0] = pt[0];
          if (pt[0] > b2[0]) b2[0] = pt[0];
          if (pt[1] < b1[1]) b1[1] = pt[1];
          if (pt[1] > b2[1]) b2[1] = pt[1];
        }
        withPoly.forEach(function (o) {
          try {
            var ring = o.poly.map(function (p) { return [+p[0], +p[1]]; });
            ctxItems.push({ kind: 'poly', pts: ring, color: zoneColorOf(o), fillOp: 0.10, strokeOp: 0.55, strokeW: 2 });
            ring.forEach(grow);
          } catch (e) {}
        });
        withCoords.forEach(function (o) {
          try {
            ctxItems.push({ kind: 'dot', lat: +o.lat, lng: +o.lng, color: omTypeColor(o.type), label: objNumOf(o) || '·', r: 11 });
            grow([+o.lat, +o.lng]);
          } catch (e) {}
        });
        ppState.ctx = ctxItems;
        if (startLat != null && startLng != null && isFinite(+startLat) && isFinite(+startLng)) {
          ppState.pt = [+startLat, +startLng]; // предвыбор текущей точки
          map.setCenter([+startLat, +startLng], 16);
        } else if (b1 && withCoords.length + withPoly.length > 1) {
          try { map.setBounds([b1, b2], { checkZoomRange: true, zoomMargin: 60 }); } catch (e) {}
        }
        ppRedraw();
        // ЕДИНСТВЕННЫЙ обработчик кликов: выбрать/перенести точку
        map.events.add('click', function (e) {
          try {
            var c = (e && e.get) ? e.get('coords') : null;
            if (!c || !isFinite(c[0]) || !isFinite(c[1])) return;
            ppState.pt = [+c[0], +c[1]];
            ppRedraw();
          } catch (err) { /* клик не может ломать карту */ }
        });
      } catch (e) {
        toast('err', 'Не удалось открыть карту выбора точки');
        ppDestroy();
      }
    }, function () {
      toast('err', 'Карта недоступна — проверьте интернет');
      ppDestroy();
    });
  }

  /* ================= ОБЛАСТИ: модалка + сохранение ================= */
  function openZoneModal(mode, oid) {
    S.zoneModalMode = mode; S.zoneModalOid = oid || null;
    var o = (mode === 'edit' && oid) ? OBJ_MAP[oid] : null;
    var type = o ? (o.type || 'Область') : 'Область';
    var num = o ? objNumOf(o) : '';
    var addr = o ? (o.addr || '') : '';
    var descr = o ? (o.descr || '') : '';
    var lat = (o && o.lat != null) ? o.lat : '';
    var lng = (o && o.lng != null) ? o.lng : '';
    var polyTxt = o && o.poly ? o.poly.map(function (p) { return (+p[0]).toFixed(6) + ', ' + (+p[1]).toFixed(6); }).join('\n') : '';
    S.zoneColor = (o && zoneIsColor(o.color)) ? o.color : (o ? zoneColorOf(o) : '#0d9488');
    var html = '<div class="modal-h"><h3>' + (mode === 'edit' ? 'Изменение области' : 'Новая область') + '</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    html += '<div class="fld"><label>Тип</label><select id="am-type">';
    OBJ_TYPES.forEach(function (t) { html += '<option value="' + t + '"' + (t === type ? ' selected' : '') + '>' + t + '</option>'; });
    html += '</select></div>';
    html += '<div class="fld"><label>Номер / шифр <span style="font-weight:400;color:#64748b;font-size:12px">— необязательно</span></label><input id="am-num" value="' + esc(num) + '" placeholder="например, Г-101"></div>';
    html += '</div>';
    html += '<div class="fld"><label>Наименование</label><input id="am-addr" value="' + esc(addr) + '" placeholder="Зона обслуживания, просека, трасса…"></div>';
    html += '<div class="fld"><label>Описание</label><textarea id="am-desc" rows="2" style="width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:8px;font-family:inherit;font-size:12.5px;box-sizing:border-box;resize:vertical" placeholder="Показывается в карточке области при нажатии на карте">' + esc(descr) + '</textarea></div>';
    html += '<div class="fld"><label>Цвет области на карте</label>' + zonePaletteHtml(S.zoneColor) + '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    html += '<div class="fld"><label>Широта центра <span style="font-weight:400;color:#64748b;font-size:12px">— необязательно</span></label><input id="am-lat" type="text" value="' + (lat === '' ? '' : lat) + '" placeholder="53.90228"></div>';
    html += '<div class="fld"><label>Долгота центра <span style="font-weight:400;color:#64748b;font-size:12px">— необязательно</span></label><input id="am-lng" type="text" value="' + (lng === '' ? '' : lng) + '" placeholder="27.56190"></div>';
    html += '</div>';
    html += '<div class="fld"><div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><label style="margin:0;flex:1">Контур области (полигон) — <span id="am-poly-cnt" style="font-weight:800;color:var(--ink)">нет точек</span></label>';
    html += '<button type="button" class="btn primary" data-action="zone-draw" style="white-space:nowrap;padding:7px 12px;font-size:12.5px" title="Открыть карту и начертить контур кликами — точки подставятся в это поле">✏️ Нарисовать на карте</button></div>';
    html += '<textarea id="am-poly" rows="6" style="width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:8px;font-family:monospace;font-size:12.5px;box-sizing:border-box" placeholder="53.90228, 27.56190&#10;53.90431, 27.56512&#10;53.90011, 27.56788&#10;(минимум 3 точки)">' + esc(polyTxt) + '</textarea></div>';
    html += '<div class="calc">🗺 Нажмите «✏️ Нарисовать на карте» и кликайте по карте — каждая точка станет вершиной контура. Можно ввести координаты вручную или импортировать готовые контуры из KML/KMZ на вкладке «Области».</div>';
    html += '</div><div class="modal-f"><button class="btn" data-action="close-modal">Отмена</button><button class="btn primary" data-action="save-zone">' + (mode === 'edit' ? 'Сохранить' : 'Добавить область') + '</button></div>';
    modal.style.width = '80%'; modal.style.maxWidth = '80%'; // 22.09-107: карточки справочников — 80% по центру
    modal.innerHTML = html; overlay.classList.add('show');
    wireZoneColors(modal);
    var polyTa = document.getElementById('am-poly');
    if (polyTa) polyTa.addEventListener('input', zonePolyCnt);
    zonePolyCnt();
    var inp = document.getElementById('am-addr');
    if (inp && mode !== 'edit') inp.focus();
  }

  // Разбор текста полигона: строки «lat, lng» (или «lat lng», разделитель ; тоже поддерживается)
  function parsePolyText(txt) {
    var pts = [];
    String(txt || '').split(/[\n;]+/).forEach(function (line) {
      var mm = line.trim().match(/^(-?\d+[.,]?\d*)\s*[ ,\t]\s*(-?\d+[.,]?\d*)$/);
      if (mm) {
        var a = parseFloat(mm[1].replace(',', '.')), b = parseFloat(mm[2].replace(',', '.'));
        if (isFinite(a) && isFinite(b)) pts.push([a, b]);
      }
    });
    return pts;
  }

  function saveZone() {
    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
    var type = val('am-type'), num = val('am-num'), addr = val('am-addr'), descr = val('am-desc');
    var latS = val('am-lat').replace(',', '.'), lngS = val('am-lng').replace(',', '.');
    var poly = parsePolyText(val('am-poly'));
    if (!addr && !num) { toast('err', 'Укажите наименование или шифр области'); return; }
    if (poly.length < 3) { toast('err', 'Контур области: нужно минимум 3 точки (получено ' + poly.length + ') — нарисуйте область на карте или импортируйте KML'); return; }
    if (latS && isNaN(parseFloat(latS))) { toast('err', 'Широта должна быть числом'); return; }
    if (lngS && isNaN(parseFloat(lngS))) { toast('err', 'Долгота должна быть числом'); return; }
    var lat = latS ? parseFloat(latS) : null, lng = lngS ? parseFloat(lngS) : null;
    var color = zoneIsColor(S.zoneColor) ? S.zoneColor : '';
    var data = { type: type, num: num, addr: addr, descr: descr, color: color, lat: lat, lng: lng, poly: poly };
    if (S.zoneModalMode === 'edit') {
      OBJECTS_DB.updateObject(S.zoneModalOid, data);
      logAction('Изменение области', addr || num);
      toast('ok', '✓ Область обновлена');
    } else {
      OBJECTS_DB.addObject(data);
      logAction('Добавление области', addr || num);
      toast('ok', '✓ Область добавлена (' + poly.length + ' точек)');
    }
    refreshObjects();
    overlay.classList.remove('show'); modal.style.width = ''; modal.style.maxWidth = ''; // 22.09-107
    renderRefs();
  }

  /* ================= ОБЛАСТИ: импорт KML / KMZ ================= */
  // KMZ — zip-архив с .kml внутри; разархивируем сами (без библиотек):
  // поиск центрального каталога → запись .kml → DecompressionStream('deflate-raw')
  function kmzExtractKml(buf) {
    return new Promise(function (resolve, reject) {
      try {
        var u8 = new Uint8Array(buf);
        // EOCD (0x06054b50) ищем с конца
        var eocd = -1;
        for (var i = u8.length - 22; i >= 0; i--) {
          if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 0x05 && u8[i + 3] === 0x06) { eocd = i; break; }
        }
        if (eocd < 0) return reject(new Error('это не KMZ-архив'));
        var dv = new DataView(buf);
        var cdOff = dv.getUint32(eocd + 16, true);
        var p = cdOff;
        var kmlEntry = null;
        while (p < eocd) {
          if (dv.getUint32(p, true) !== 0x02014b50) break;
          var method = dv.getUint16(p + 10, true);
          var compSize = dv.getUint32(p + 20, true);
          var nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), cmtLen = dv.getUint16(p + 32, true);
          var lho = dv.getUint32(p + 42, true);
          var name = '';
          for (var c = 0; c < nameLen; c++) name += String.fromCharCode(u8[p + 46 + c]);
          if (/\.kml$/i.test(name) && !kmlEntry) kmlEntry = { method: method, compSize: compSize, lho: lho };
          p += 46 + nameLen + extraLen + cmtLen;
        }
        if (!kmlEntry) return reject(new Error('в KMZ нет .kml файла'));
        // локальный заголовок → данные
        var lnLen = dv.getUint16(kmlEntry.lho + 26, true), lextLen = dv.getUint16(kmlEntry.lho + 28, true);
        var dataStart = kmlEntry.lho + 30 + lnLen + lextLen;
        var raw = u8.subarray(dataStart, dataStart + kmlEntry.compSize);
        if (kmlEntry.method === 0) return resolve(new TextDecoder().decode(raw)); // без сжатия
        if (kmlEntry.method !== 8) return reject(new Error('неизвестный метод сжатия KMZ'));
        if (typeof DecompressionStream === 'undefined') return reject(new Error('браузер не поддерживает распаковку KMZ — распакуйте архив и загрузите .kml'));
        new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer().then(function (out) {
          resolve(new TextDecoder().decode(out));
        }, function () { reject(new Error('не удалось распаковать KMZ')); });
      } catch (e) { reject(e); }
    });
  }

  // KML → области: каждый Placemark с Polygon/LinearRing или LineString
  function importAreasFromKml(kmlText, sourceName) {
    try {
      var doc = new DOMParser().parseFromString(kmlText, 'text/xml');
      if (doc.getElementsByTagName('parsererror').length) { toast('err', 'Не удалось разобрать KML (ошибка XML)'); return; }
      var placemarks = doc.getElementsByTagName('Placemark');
      var added = 0, updated = 0, skippedPts = 0;
      refreshObjects();
      for (var i = 0; i < placemarks.length; i++) {
        var pm = placemarks[i];
        var name = '';
        var nmEl = pm.getElementsByTagName('name')[0];
        if (nmEl) name = (nmEl.textContent || '').trim();
        // описание Placemark (CDATA/текст) → в карточку области
        var descr = '';
        var dsEl = pm.getElementsByTagName('description')[0];
        if (dsEl) descr = (dsEl.textContent || '').trim();
        // координаты: Polygon > outerBoundaryIs > LinearRing > coordinates ИЛИ LineString > coordinates
        var coordsEl = null;
        var rings = pm.getElementsByTagName('LinearRing');
        var lines = pm.getElementsByTagName('LineString');
        var pts = pm.getElementsByTagName('Point');
        if (rings.length) coordsEl = rings[0].getElementsByTagName('coordinates')[0];
        else if (lines.length) coordsEl = lines[0].getElementsByTagName('coordinates')[0];
        else if (pts.length) { skippedPts++; continue; } // точки — не области
        if (!coordsEl || !coordsEl.textContent) continue;
        // «lng,lat[,alt] lng,lat[,alt] …» → [[lat,lng],…]
        var poly = [];
        coordsEl.textContent.trim().split(/\s+/).forEach(function (tok) {
          var xyz = tok.split(',');
          var la = parseFloat(xyz[1]), ln = parseFloat(xyz[0]);
          if (isFinite(la) && isFinite(ln)) poly.push([la, ln]);
        });
        if (poly.length < 3) continue;
        // замкнуть линию (LineString без замыкания)
        if (poly[0][0] !== poly[poly.length - 1][0] || poly[0][1] !== poly[poly.length - 1][1]) poly.push([poly[0][0], poly[0][1]]);
        // существующая область с таким названием → обновить контур
        // (refreshObjects на каждой итерации: зона, добавленная этим же
        // импортом выше по файлу, тоже находится по имени)
        refreshObjects();
        var ex = null;
        for (var j = 0; j < OBJECTS.length; j++) {
          if (OBJECTS[j].poly && String(OBJECTS[j].addr || '').trim().toLowerCase() === name.toLowerCase()) { ex = OBJECTS[j]; break; }
        }
        if (ex) {
          OBJECTS_DB.updateObject(ex.id, { poly: poly, addr: name || ex.addr, descr: descr || (ex.descr || '') });
          updated++;
        } else {
          OBJECTS_DB.addObject({ type: 'Область', num: '', addr: name || 'Область из ' + (sourceName || 'KML'), descr: descr, color: '', lat: null, lng: null, poly: poly });
          added++;
        }
      }
      refreshObjects();
      logAction('Импорт областей из KML/KMZ', 'добавлено: ' + added + ', обновлено: ' + updated + (skippedPts ? ', точек пропущено: ' + skippedPts : ''));
      toast('ok', '🛰 Импорт областей: добавлено ' + added + ', обновлено ' + updated + (skippedPts ? ', пропущено точек (не области): ' + skippedPts : ''));
      S.objTab = 'areas';
      renderRefs();
    } catch (e) {
      toast('err', 'Ошибка импорта KML: ' + e.message);
    }
  }

  function handleAreasKmlFile(file) {
    var isKmz = /\.kmz$/i.test(file.name || '');
    var reader = new FileReader();
    reader.onload = function (e) {
      if (isKmz) {
        kmzExtractKml(e.target.result).then(function (kmlText) {
          importAreasFromKml(kmlText, file.name);
        }, function (err) { toast('err', 'KMZ: ' + err.message); });
      } else {
        importAreasFromKml(String(e.target.result || ''), file.name);
      }
    };
    reader.onerror = function () { toast('err', 'Не удалось прочитать файл'); };
    if (isKmz) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  }

  function exportObjectsExcel() {
    if (!window.XLSX) { ensureXlsxRetry(exportObjectsExcel); return; } // ленивая загрузка xlsx
    refreshObjects();
    var data = [['Тип', 'Номер', 'Адрес', 'Широта', 'Долгота', 'Полигон', 'Описание', 'Цвет']];
    OBJECTS.forEach(function (o) {
      data.push([o.type || 'Объект', objNumOf(o), o.addr || '', (o.lat != null ? o.lat : ''), (o.lng != null ? o.lng : ''),
        (o.poly && o.poly.length >= 3) ? o.poly.map(function (p) { return (+p[0]).toFixed(6) + ',' + (+p[1]).toFixed(6); }).join('; ') : '',
        o.descr || '', o.color || '']);
    });
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 10 }, { wch: 8 }, { wch: 42 }, { wch: 12 }, { wch: 12 }, { wch: 60 }, { wch: 40 }, { wch: 9 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Объекты');
    var fileName = 'Объекты_ГРП_ШРП_' + key(TODAY) + '.xlsx';
    try {
      XLSX.writeFile(wb, fileName);
      toast('ok', '📥 Скачан файл: ' + fileName + ' (' + OBJECTS.length + ' объектов)');
    } catch (err) { toast('err', 'Ошибка: ' + err.message); }
  }

  /* =====================================================================
     СПРАВОЧНИК: ОБЪЕКТЫ (ГРП / ШРП)
     ===================================================================== */
  var OBJ_TYPES = ['ГРП', 'ШРП', 'ГРС', 'ПГРП', 'Трасса', 'Просека', 'Область'];
  var OBJ_GAS_TYPES = ['ГРП', 'ШРП', 'ГРС', 'ПГРП']; // нумеруемые точки газоснабжения (справочник + карта + графики)
  function isGasType(t) { return OBJ_GAS_TYPES.indexOf(t) !== -1; }
  function renderObjectsRefTab(admin, tabsHtml) {
    refreshObjects();
    var objs = OBJECTS.slice();
    var grp = S.objTab || 'grp'; // grp | shrp | other
    var hasPoly = function (o) { return !!(o.poly && o.poly.length >= 3); };
    // Вкладка «Области» — только объекты ТИПА «Область». Нарисованное во вкладке
    // «Прочие» (трасса, просека…) остаётся в «Прочих» — с пометкой «◻ область».
    var areasL = objs.filter(function (o) { return o.type === 'Область' && hasPoly(o); });
    var grps = objs.filter(function (o) { return o.type === 'ГРП'; });
    var shrps = objs.filter(function (o) { return o.type === 'ШРП'; });
    var grss = objs.filter(function (o) { return o.type === 'ГРС'; });
    var pgrps = objs.filter(function (o) { return o.type === 'ПГРП'; });
    var others = objs.filter(function (o) { return !isGasType(o.type) && o.type !== 'Область'; });
    function byNum(a, b) {
      var na = parseInt(objNumOf(a), 10) || 0, nb = parseInt(objNumOf(b), 10) || 0;
      return (na - nb) || String(objNumOf(a)).localeCompare(String(objNumOf(b)), 'ru');
    }
    grps.sort(byNum); shrps.sort(byNum); grss.sort(byNum); pgrps.sort(byNum); others.sort(function (a, b) { return String(a.addr || '').localeCompare(String(b.addr || ''), 'ru'); });

    var html = '<div style="margin-bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">';
    html += '<span class="sub" style="font-size:12px;color:var(--muted)">ГРП: ' + grps.length + ' · ШРП: ' + shrps.length + ' · ГРС: ' + grss.length + ' · ПГРП: ' + pgrps.length + ' · Прочих: ' + others.length + ' · Областей: ' + areasL.length + '</span>';
    html += '<div style="flex:1"></div>';
    html += '<button class="btn ghost" data-action="dl-objects-excel" style="border:1px solid var(--line);background:var(--card);padding:7px 11px;font-size:12.5px;display:inline-flex;align-items:center;gap:6px;" title="Скачать справочник объектов (ГРП/ШРП) в Excel">📥 Экспорт объектов (Excel)</button>';
    html += '<button class="btn ghost" data-action="ul-objects-excel" style="border:1px solid var(--line);background:var(--card);padding:7px 11px;font-size:12.5px;display:inline-flex;align-items:center;gap:6px;" title="Загрузить объекты из Excel (новые добавятся, существующие обновятся)">📤 Импорт объектов (Excel)</button>';
    if (admin) html += '<button class="btn primary" data-action="new-object">' + IC.plus + ' Добавить объект</button>';
    html += '</div>';
    html += tabsHtml;

    // Подразделы: ГРП / ШРП / Прочие
    html += '<div class="tabs" style="margin-bottom:12px">';
    html += '<button class="' + (grp === 'grp' ? 'on' : '') + '" data-action="obj-subtab" data-sub="grp">🏭 ГРП (' + grps.length + ')</button>';
    html += '<button class="' + (grp === 'shrp' ? 'on' : '') + '" data-action="obj-subtab" data-sub="shrp">🏘 ШРП (' + shrps.length + ')</button>';
    html += '<button class="' + (grp === 'grs' ? 'on' : '') + '" data-action="obj-subtab" data-sub="grs">⛽ ГРС (' + grss.length + ')</button>';
    html += '<button class="' + (grp === 'pgrp' ? 'on' : '') + '" data-action="obj-subtab" data-sub="pgrp">🏗 ПГРП (' + pgrps.length + ')</button>';
    html += '<button class="' + (grp === 'other' ? 'on' : '') + '" data-action="obj-subtab" data-sub="other">📦 Прочие (' + others.length + ')</button>';
    html += '<button class="' + (grp === 'areas' ? 'on' : '') + '" data-action="obj-subtab" data-sub="areas">🗺 Области (' + areasL.length + ')</button>';
    html += '</div>';

    if (grp === 'areas') {
      // ---------- ВКЛАДКА «ОБЛАСТИ»: полигоны + импорт Excel / KML / KMZ ----------
      html += '<div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap">';
      if (admin) html += '<button class="btn primary" data-action="new-zone">' + IC.plus + ' Добавить область</button>';
      html += '<button class="btn ghost" data-action="ul-areas-excel" style="border:1px solid var(--line);background:var(--card);padding:7px 11px;font-size:12.5px;display:inline-flex;align-items:center;gap:6px" title="Импорт областей из Excel (колонка «Полигон»: lat,lng; lat,lng; …)">📤 Импорт Excel</button>';
      html += '<button class="btn ghost" data-action="ul-areas-kml" style="border:1px solid var(--line);background:var(--card);padding:7px 11px;font-size:12.5px;display:inline-flex;align-items:center;gap:6px" title="Импорт областей из KML или KMZ (Google Earth, Яндекс.Карты): полигоны и линии">🛰 Импорт KML/KMZ</button>';
      html += '<input type="file" id="areas-kml-file" accept=".kml,.kmz" style="display:none">';
      html += '</div>';
      // наименование области (для сортировки и фильтра)
      function znm(o) { return (o.type === 'Область' || !objNumOf(o)) ? (o.addr || 'Без названия') : ((o.type || 'Область') + (objNumOf(o) ? ' №' + objNumOf(o) : '')); }
      // сортировка по наименованию от А до Я
      areasL.sort(function (a, b) { return znm(a).localeCompare(znm(b), 'ru'); });
      // буквенный фильтр А–Я (стандартный): «Все» + буквы, у которых есть области
      var zfLetters = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЫЭЮЯ';
      var zfCounts = {};
      areasL.forEach(function (o) { var c = (znm(o).charAt(0) || '?').toUpperCase().replace('Ё', 'Е'); zfCounts[c] = (zfCounts[c] || 0) + 1; });
      var zfActive = S.zoneLetter || '';
      if (zfActive) {
        areasL = areasL.filter(function (o) { var c = (znm(o).charAt(0) || '?').toUpperCase().replace('Ё', 'Е'); return c === zfActive; });
      }
      html += '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:10px;align-items:center">';
      html += '<button type="button" data-action="zone-letter" data-l="" title="Показать все области" style="padding:4px 10px;border:1px solid ' + (!zfActive ? '#2563eb' : 'var(--line)') + ';border-radius:6px;background:' + (!zfActive ? '#2563eb' : 'var(--card)') + ';color:' + (!zfActive ? '#fff' : 'var(--ink)') + ';font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer">Все</button>';
      for (var zi = 0; zi < zfLetters.length; zi++) {
        var zl = zfLetters.charAt(zi);
        var zc = zfCounts[zl] || 0;
        var zon = zfActive === zl;
        html += '<button type="button" data-action="zone-letter" data-l="' + zl + '"' + (zc ? '' : ' disabled') + ' title="На «' + zl + '» — ' + zc + '" style="min-width:27px;padding:4px 2px;border:1px solid ' + (zon ? '#2563eb' : 'var(--line)') + ';border-radius:6px;background:' + (zon ? '#2563eb' : 'var(--card)') + ';color:' + (zon ? '#fff' : (zc ? 'var(--ink)' : 'var(--muted)')) + ';font-family:inherit;font-size:12.5px;font-weight:700;cursor:' + (zc ? 'pointer' : 'default') + ';opacity:' + (zc ? 1 : 0.35) + '">' + zl + '</button>';
      }
      html += '</div>';
      html += '<div class="card"><table class="dt"><thead><tr><th>Наименование</th><th>Описание</th><th>Точек</th><th>Центр</th>' + (admin ? '<th style="text-align:right">Действия</th>' : '') + '</tr></thead><tbody>';
      if (!areasL.length) {
        html += '<tr><td colspan="' + (admin ? 5 : 4) + '" class="empty">' + (zfActive ? 'Областей на букву «' + esc(zfActive) + '» нет.' : 'Областей пока нет. Нажмите «Добавить область» (можно начертить контур прямо на карте) или импортируйте из KML/KMZ / Excel.') + '</td></tr>';
      }
      areasL.forEach(function (o) {
        var nm = znm(o);
        // центр полигона (среднее вершин)
        var clat = 0, clng = 0;
        o.poly.forEach(function (p) { clat += +p[0]; clng += +p[1]; });
        clat = (clat / o.poly.length).toFixed(5); clng = (clng / o.poly.length).toFixed(5);
        var zc = zoneColorOf(o);
        html += '<tr>';
        html += '<td><span title="Цвет области на карте" style="display:inline-block;width:11px;height:11px;border-radius:3px;background:' + zc + ';box-shadow:inset 0 0 0 1px rgba(15,39,64,.25);margin-right:7px;vertical-align:baseline"></span><b>' + esc(nm) + '</b>' + (o.lat != null && o.lng != null ? ' <span style="font-size:11.5px;color:var(--muted)">+ точка</span>' : '') + '</td>';
        html += '<td style="max-width:320px">' + (o.descr ? esc(o.descr) : '<span style="color:var(--muted)">—</span>') + '</td>';
        html += '<td style="font-weight:700">' + o.poly.length + '</td>';
        html += '<td style="font-size:12px;color:var(--muted)">📍 ' + clat + ', ' + clng + '</td>';
        if (admin) html += '<td style="text-align:right;white-space:nowrap"><button class="btn sm" data-action="edit-zone" data-oid="' + esc(o.id) + '">Изменить</button> <button class="btn sm" data-action="del-object" data-oid="' + esc(o.id) + '" style="color:var(--red)">Удалить</button></td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      html += '<div class="calc" style="margin-top:10px">🗺 Области показываются на странице «Карта объектов» (цвет и описание — из карточки области, области всегда под точками ГРП/ШРП). Нажмите «Добавить область», чтобы начертить контур прямо на карте, или импортируйте готовые контуры из KML/KMZ (Google Earth, Яндекс.Карты, SAS.Planet): каждый полигон/линия становится областью, совпадение по названию обновляет существующую.</div>';
      // слушатель файла KML/KMZ навешиваем после записи DOM (renderRefs соберёт и вставит этот html)
      setTimeout(function () {
        var kmlInput = document.getElementById('areas-kml-file');
        if (kmlInput && !kmlInput.__wkBound) {
          kmlInput.__wkBound = 1;
          kmlInput.addEventListener('change', function (e) {
            var f = e.target.files && e.target.files[0];
            if (f) handleAreasKmlFile(f);
            kmlInput.value = '';
          });
        }
      }, 0);
      return html;
    }
    var list = grp === 'grp' ? grps : (grp === 'shrp' ? shrps : (grp === 'grs' ? grss : (grp === 'pgrp' ? pgrps : others)));
    var typeLabel = grp === 'grp' ? 'ГРП' : (grp === 'shrp' ? 'ШРП' : (grp === 'grs' ? 'ГРС' : (grp === 'pgrp' ? 'ПГРП' : null)));
    html += '<div class="card"><table class="dt"><thead><tr>';
    html += typeLabel ? '<th>Номер</th><th>Адрес</th>' : '<th>Тип</th><th>Наименование / адрес</th>';
    html += '<th>Координаты</th>';
    // Атрибуты — только для ГРП/ШРП/ПГРП (Сборка 21.09-24)
    if (typeLabel && window.SP_OBJ_ATTRS && SP_OBJ_ATTRS.supportsAttrs(typeLabel)) {
      html += '<th>Атрибуты</th>';
    }
    html += (admin ? '<th style="text-align:right">Действия</th>' : '');
    html += '</tr></thead><tbody>';
    var colCount = typeLabel ? (SP_OBJ_ATTRS && SP_OBJ_ATTRS.supportsAttrs(typeLabel) ? (admin ? 5 : 4) : (admin ? 4 : 3)) : (admin ? 4 : 3);
    if (!list.length) {
      html += '<tr><td colspan="' + colCount + '" class="empty">' + (typeLabel ? 'Объектов типа ' + typeLabel + ' пока нет. Нажмите «Добавить объект».' : 'Прочих объектов нет') + '</td></tr>';
    }
    list.forEach(function (o) {
      var n = objNumOf(o);
      var areaBadge = (o.poly && o.poly.length >= 3) ? ' <span style="font-size:11.5px;color:#0d9488;font-weight:800" title="Область на карте: ' + o.poly.length + ' точек">◻ обл.</span>' : '';
      html += '<tr>';
      if (typeLabel) html += '<td><b>' + typeLabel + (n ? ' №' + esc(n) : '') + '</b></td><td>' + esc(o.addr || '—') + '</td>';
      else html += '<td><b>' + esc(o.type || 'Объект') + '</b></td><td>' + esc(o.addr || '—') + '</td>';
      html += '<td style="font-size:12px;color:var(--muted)">' + (o.lat != null && o.lng != null
        ? '📍 ' + (+o.lat).toFixed(5) + ', ' + (+o.lng).toFixed(5)
        : (hasPoly(o) ? '<span style="color:#0d9488;font-weight:700">◻ область · ' + o.poly.length + ' точек</span>' : '<span style="color:var(--yellow)">не заданы</span>')) + areaBadge + '</td>';
      if (typeLabel && window.SP_OBJ_ATTRS && SP_OBJ_ATTRS.supportsAttrs(typeLabel)) {
        html += '<td style="font-size:12px">' + SP_OBJ_ATTRS.renderSummary(o) + '</td>';
      }
      if (admin) html += '<td style="text-align:right;white-space:nowrap"><button class="btn sm" data-action="edit-object" data-oid="' + esc(o.id) + '">Изменить</button> <button class="btn sm" data-action="del-object" data-oid="' + esc(o.id) + '" style="color:var(--red)">Удалить</button></td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  // Модал добавления/изменения объекта
  function openObjectModal(mode, oid) {
    S.objModalMode = mode; S.objModalOid = oid || null;
    var o = (mode === 'edit' && oid) ? OBJ_MAP[oid] : null;
    var type = o ? (o.type || 'ГРП') : (S.objTab === 'shrp' ? 'ШРП' : (S.objTab === 'grs' ? 'ГРС' : (S.objTab === 'pgrp' ? 'ПГРП' : 'ГРП')));
    var num = o ? objNumOf(o) : '';
    var addr = o ? objStreetAddr(o) : '';
    var lat = (o && o.lat != null) ? o.lat : '';
    var lng = (o && o.lng != null) ? o.lng : '';
    var polyTxt = o && o.poly ? o.poly.map(function (p) { return (+p[0]).toFixed(6) + ', ' + (+p[1]).toFixed(6); }).join('\n') : '';
    // Ответственный за объект — из «Пользователей» (активные, по алфавиту)
    var respUsers = (DB.getUsers() || []).filter(function (u) { return u && u.active !== false; });
    respUsers.sort(function (a, b) { return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ru'); });
    var respOpts = '<option value="">— не назначен —</option>';
    respUsers.forEach(function (u) {
      var lbl = u.prof || (ROLE_INFO[u.role] ? ROLE_INFO[u.role].label : u.role);
      respOpts += '<option value="' + esc(u.id) + '"' + (o && o.respId === u.id ? ' selected' : '') + '>' + esc(u.full_name) + ' · ' + esc(lbl) + '</option>';
    });
    // 22.09-161: текущий ответственный может быть уволен (до даты увольнения он ещё отвечает)
    // или отключён — оставляем его выбранным, иначе сохранение карточки снимет его раньше срока
    if (o && o.respId && !respUsers.some(function (u) { return u.id === o.respId; })) {
      var _curU = DB.getUser(o.respId);
      var _curLbl = _curU ? (_curU.full_name + (_curU.fired ? ' · уволен с ' + fmtDmyIso(_curU.fired_date || '') : ' · отключён')) : (o.respName || o.respId);
      respOpts += '<option value="' + esc(o.respId) + '" selected>' + esc(_curLbl) + '</option>';
    }
    // форма объекта: точка или область (для ГРП/ШРП — всегда точка)
    S.objKind = (!isGasType(type) && o && o.poly && o.poly.length >= 3) ? 'area' : 'point';
    var html = '<div class="modal-h"><h3>' + (mode === 'edit' ? 'Изменение объекта' : 'Новый объект') + '</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    html += '<div class="fld"><label>Тип объекта</label><select id="om-type">';
    OBJ_TYPES.forEach(function (t) { html += '<option value="' + t + '"' + (t === type ? ' selected' : '') + '>' + t + '</option>'; });
    html += '</select></div>';
    html += '<div class="fld"><label id="om-num-label">Номер</label><input id="om-num" value="' + esc(num) + '" placeholder="например, 12"></div>';
    html += '</div>';
    html += '<div class="fld"><label>Адрес</label><input id="om-addr" value="' + esc(addr) + '" placeholder="ул. Ленина, 5"></div>';
    html += '<div class="fld"><label>Ответственный</label><select id="om-resp">' + respOpts + '</select></div>';
    // ----- АТРИБУТЫ ГРП/ШРП/ПГРП (Сборка 21.09-24, открыты по умолчанию) -----
    // Только для типов ГРП/ШРП/ПГРП. Отображаются прямо в карточке без
    // сворачивания — пользователь должен видеть все свойства сразу.
    if (window.SP_OBJ_ATTRS && SP_OBJ_ATTRS.supportsAttrs(type)) {
      html += '<div id="oa-section" style="display:block;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)">';
      html += '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">📋 Атрибуты объекта</div>';
      html += SP_OBJ_ATTRS.renderForm(o, type, null);
      html += '</div>';
    }
    // форма: точка или область (только для типов вне ГРП/ШРП)
    html += '<div class="fld" id="om-kind-box"><label>Форма объекта</label><div style="display:flex;gap:8px">' +
      '<button type="button" id="om-kind-point" class="btn" style="flex:1;justify-content:center">📍 Точка</button>' +
      '<button type="button" id="om-kind-area" class="btn" style="flex:1;justify-content:center">🗺 Область</button></div></div>';
    // секция точки: координаты + выбор на карте
    html += '<div id="om-point-sec">';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    html += '<div class="fld"><label>Широта (lat)</label><input id="om-lat" type="text" value="' + (lat === '' ? '' : lat) + '" placeholder="53.90228"></div>';
    html += '<div class="fld"><label>Долгота (lng)</label><input id="om-lng" type="text" value="' + (lng === '' ? '' : lng) + '" placeholder="27.56190"></div>';
    html += '</div>';
    html += '<div class="fld"><button type="button" class="btn primary" data-action="om-pick-point" style="width:100%;justify-content:center;padding:8px 12px;font-size:12.5px" title="Открыть карту и кликнуть точку — координаты подставятся автоматически">📍 Выбрать на карте</button></div>';
    html += '</div>';
    // секция области: контур + рисование на карте
    html += '<div id="om-area-sec">';
    html += '<div class="fld"><div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><label style="margin:0;flex:1">Контур области — <span id="om-poly-cnt" style="font-weight:800;color:var(--ink)">нет точек</span></label>' +
      '<button type="button" class="btn primary" data-action="om-draw-area" style="white-space:nowrap;padding:7px 12px;font-size:12.5px" title="Открыть карту и начертить контур кликами">✏️ Нарисовать на карте</button></div>' +
      '<textarea id="om-poly" rows="5" style="width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:8px;font-family:monospace;font-size:12.5px;box-sizing:border-box" placeholder="53.90228, 27.56190&#10;53.90431, 27.56512&#10;53.90011, 27.56788&#10;(минимум 3 точки)">' + esc(polyTxt) + '</textarea></div>';
    html += '</div>';
    html += '<div class="calc" id="om-hint">📍 Нажмите «Выбрать на карте» и кликните точку — координаты подставятся сами. Или введите их вручную. Для ГРП/ШРП и обычных объектов это точка на карте.</div>';
    html += '</div><div class="modal-f"><button class="btn" data-action="close-modal">Отмена</button><button class="btn primary" data-action="save-object">' + (mode === 'edit' ? 'Сохранить' : 'Добавить объект') + '</button></div>';
    // Ширина модалки: для ГРП/ШРП/ПГРП — 880px (вмещает 2-колоночные атрибуты),
    // для остальных типов — 620px (как было).
    modal.style.width = '80%'; modal.style.maxWidth = '80%'; // 22.09-107: карточки справочников — 80% по центру
    modal.innerHTML = html; overlay.classList.add('show');
    // переключение формы: точка/область по типу объекта
    var typeSel = document.getElementById('om-type'), numLabel = document.getElementById('om-num-label');
    function syncNumLabel() {
      if (!numLabel) return;
      var t = typeSel ? typeSel.value : 'ГРП';
      numLabel.textContent = (t === 'Трасса' || t === 'Просека') ? 'Номер / шифр (необязательно)' : 'Номер ' + t;
    }
    function omSyncKind() {
      var t = typeSel ? typeSel.value : 'ГРП';
      var isGas = isGasType(t);
      if (isGas) S.objKind = 'point';
      else if (t === 'Область') S.objKind = 'area'; // тип «Область» — всегда область
      var kbox = document.getElementById('om-kind-box');
      var psec = document.getElementById('om-point-sec');
      var asec = document.getElementById('om-area-sec');
      var hint = document.getElementById('om-hint');
      var kb = document.getElementById('om-kind-point'), ab = document.getElementById('om-kind-area');
      if (kbox) kbox.style.display = (isGas || t === 'Область') ? 'none' : '';
      if (psec) psec.style.display = S.objKind === 'point' ? '' : 'none';
      if (asec) asec.style.display = S.objKind === 'area' ? '' : 'none';
      if (kb) { kb.style.background = S.objKind === 'point' ? '#2563eb' : ''; kb.style.color = S.objKind === 'point' ? '#fff' : ''; kb.style.borderColor = S.objKind === 'point' ? '#2563eb' : ''; }
      if (ab) { ab.style.background = S.objKind === 'area' ? '#2563eb' : ''; ab.style.color = S.objKind === 'area' ? '#fff' : ''; ab.style.borderColor = S.objKind === 'area' ? '#2563eb' : ''; }
      if (hint) hint.innerHTML = S.objKind === 'area'
        ? '🗺 Нажмите «✏️ Нарисовать на карте» и кликайте по карте — каждая точка станет вершиной контура. Область появится на вкладке «Области» и на «Карте объектов».'
        : '📍 Нажмите «Выбрать на карте» и кликните точку — координаты подставятся сами. Или введите их вручную.';
    }
    if (typeSel) {
      typeSel.addEventListener('change', function () { syncNumLabel(); omSyncKind(); refreshAttrsSection(); });
      var kb = document.getElementById('om-kind-point'), ab = document.getElementById('om-kind-area');
      if (kb) kb.addEventListener('click', function () { S.objKind = 'point'; omSyncKind(); });
      if (ab) ab.addEventListener('click', function () { S.objKind = 'area'; omSyncKind(); });
    }
    // При смене типа (например, ГРП → Трасса) перестраиваем секцию атрибутов
    function refreshAttrsSection() {
      if (!window.SP_OBJ_ATTRS) return;
      var cur = typeSel ? typeSel.value : type;
      var sec = document.getElementById('oa-section');
      // Атрибуты только для ГРП/ШРП/ПГРП — для остальных секцию скрываем
      if (SP_OBJ_ATTRS.supportsAttrs(cur)) {
        var html2 = SP_OBJ_ATTRS.renderForm(o, cur, null);
        if (sec) { sec.innerHTML = '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">📋 Атрибуты объекта</div>' + html2; sec.style.display = 'block'; }
      } else {
        if (sec) { sec.innerHTML = ''; sec.style.display = 'none'; }
      }
      // Ширина модалки зависит от типа
      modal.style.width = '80%'; modal.style.maxWidth = '80%'; // 22.09-107: ширина не зависит от секций
    }
    var polyTa = document.getElementById('om-poly');
    if (polyTa) polyTa.addEventListener('input', function () { zonePolyCnt('om-poly'); });
    syncNumLabel();
    omSyncKind();
    zonePolyCnt('om-poly');
    var inp = document.getElementById('om-num');
    if (inp && mode !== 'edit') inp.focus();
  }
  function saveObject() {
    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
    var type = val('om-type'), num = val('om-num'), addr = val('om-addr');
    var isArea = (!isGasType(type) && S.objKind === 'area');
    var poly = null;
    if (isArea) {
      poly = parsePolyText(val('om-poly'));
      if (poly.length < 3) { toast('err', 'Для области нарисуйте контур на карте (нужно минимум 3 точки, получено ' + poly.length + ')'); return; }
    }
    var latS = isArea ? '' : val('om-lat').replace(',', '.'), lngS = isArea ? '' : val('om-lng').replace(',', '.');
    if (isGasType(type) && !num) { toast('err', 'Укажите номер объекта (' + type + ')'); return; }
    if (!addr && !num) { toast('err', 'Укажите адрес или номер объекта'); return; }
    if (latS && isNaN(parseFloat(latS))) { toast('err', 'Широта должна быть числом, например 53.90228'); return; }
    if (lngS && isNaN(parseFloat(lngS))) { toast('err', 'Долгота должна быть числом, например 27.56190'); return; }
    var lat = latS ? parseFloat(latS) : null, lng = lngS ? parseFloat(lngS) : null;
    if (isArea) { lat = null; lng = null; }
    if ((lat != null && (lat < 53 || lat > 54.5)) || (lng != null && (lng < 26.5 || lng > 28.5))) {
      return spConfirm('Координаты (' + lat + ', ' + lng + ') выходят за пределы Минска и окрестностей. Всё равно сохранить?', { title: 'Координаты объекта', ok: 'Всё равно сохранить', danger: true }, saveObjectGo); // 22.09-244
    }
    return saveObjectGo();
    function saveObjectGo() { // 22.09-244: сохранение — после подтверждения (если оно нужно)
    var respId = val('om-resp');
    var respName = '';
    if (respId) { (DB.getUsers() || []).forEach(function (u) { if (u && u.id === respId) respName = u.full_name || ''; }); }
    // Атрибуты ГРП/ШРП/ПГРП (Сборка 21.09-24)
    var attrs = null;
    var respHistory = null;
    if (window.SP_OBJ_ATTRS && SP_OBJ_ATTRS.supportsAttrs(type)) {
      var formEl = document.getElementById('oa-section');
      if (formEl) {
        var collected = SP_OBJ_ATTRS.collectForm(formEl);
        // Валидация
        var errs = SP_OBJ_ATTRS.validate(collected.attrs);
        if (errs.length) {
          toast('err', '⚠ Атрибуты: ' + errs[0] + (errs.length > 1 ? ' (+' + (errs.length - 1) + ' ошибок)' : ''));
          // Откроем секцию, чтобы пользователь увидел ошибку
          var sec = document.getElementById('oa-section');
          if (sec) sec.style.display = 'block';
          return;
        }
        attrs = collected.attrs;
        // Синхронизируем respId/respName с выбранным в атрибутах ответственным
        // (если в атрибутах выбран другой — он «главный», а om-resp дублирует)
        var respFromAttrs = attrs.respUid;
        if (respFromAttrs && (!respId || respId !== respFromAttrs)) {
          respId = respFromAttrs;
          (DB.getUsers() || []).forEach(function (u) { if (u && u.id === respId) respName = u.full_name || ''; });
        }
        // История ответственного — при смене добавляем запись
        if (S.objModalMode === 'edit') {
          var oldObj = OBJ_MAP[S.objModalOid];
          if (oldObj) {
            var oldCur = SP_OBJ_ATTRS.getRespCurrent(oldObj);
            if ((!oldCur && respId) || (oldCur && oldCur.uid !== respId)) {
              respHistory = (Array.isArray(oldObj.respHistory) ? oldObj.respHistory.slice() : []);
              // Закрыть текущего
              for (var hh = 0; hh < respHistory.length; hh++) {
                if (respHistory[hh].to == null) {
                  respHistory[hh].to = new Date().toISOString().slice(0, 10);
                }
              }
              // Добавить нового (если выбран)
              if (respId) {
                respHistory.push({ uid: respId, name: respName || '', from: new Date().toISOString().slice(0, 10), to: null });
              }
            } else {
              respHistory = oldObj.respHistory || [];   // без изменений
            }
          }
        } else {
          // Новый объект — создаём первую запись истории
          if (respId) {
            respHistory = [{ uid: respId, name: respName || '', from: new Date().toISOString().slice(0, 10), to: null }];
          } else {
            respHistory = [];
          }
        }
      }
    }
    var data = { type: type, num: num, addr: addr, lat: lat, lng: lng, poly: poly, respId: respId, respName: respName };
    if (attrs) data.attrs = attrs;
    if (respHistory) data.respHistory = respHistory;
    if (S.objModalMode === 'edit') {
      var old = OBJ_MAP[S.objModalOid];
      OBJECTS_DB.updateObject(S.objModalOid, data);
      refreshObjects();
      // Синхронизация привязанных задач: адрес и координаты из справочника
      var newAddr = objFullAddr(OBJ_MAP[S.objModalOid]);
      var changed = 0;
      S.tasks.forEach(function (t) {
        if (t && t.o === S.objModalOid) {
          var upd = { addr: newAddr };
          if (lat != null && lng != null) { upd.lat = lat; upd.lng = lng; upd.coord_src = 'object'; }
          Object.assign(t, upd);
          if (TASKS_DB) TASKS_DB.updateTask(t.id, upd);
          changed++;
        }
      });
      logAction('Изменение объекта', (old ? objFullAddr(old) : '?') + ' → ' + newAddr);
      toast('ok', changed ? '✓ Объект обновлён (синхронизировано задач: ' + changed + ')' : '✓ Объект обновлён');
    } else {
      var o = OBJECTS_DB.addObject(data);
      refreshObjects();
      logAction('Добавление объекта', objFullAddr(o));
      toast('ok', 'Объект «' + esc(objFullAddr(o)) + '» добавлен');
    }
    overlay.classList.remove('show'); modal.style.width = ''; modal.style.maxWidth = ''; // 22.09-107
    // вкладка после сохранения — по ТИПУ объекта (нарисованная во «вкладке
    // прочих» область остаётся в «Прочих», тип «Область» — на вкладке «Области»)
    if (type === 'Область') S.objTab = 'areas';
    else if (type === 'ГРП') S.objTab = 'grp';
    else if (type === 'ШРП') S.objTab = 'shrp';
    else if (type === 'ГРС') S.objTab = 'grs';
    else if (type === 'ПГРП') S.objTab = 'pgrp';
    else S.objTab = 'other';
    renderRefs();
    }
  }
  function delObjectAction(oid) {
    var o = OBJ_MAP[oid]; if (!o) return;
    var linked = S.tasks.filter(function (t) { return t && t.o === oid; }).length;
    return spConfirm('Удалить объект «' + objFullAddr(o) + '»?' + (linked ? '\n\nПривязанных задач: ' + linked + ' — в них останется только текст адреса (точка на карте будет строиться по геокодеру).' : ''), { title: 'Удаление объекта', ok: 'Удалить', danger: true }, function () { // 22.09-244: оформленное окно
    OBJECTS_DB.deleteObject(oid);
    refreshObjects();
    logAction('Удаление объекта', objFullAddr(o));
    toast('ok', 'Объект «' + esc(objFullAddr(o)) + '» удалён');
    renderRefs();
    });
  }


  /* ---------- МОДАЛ: ВИД РАБОТЫ (с атрибутами УБиРОГС) ---------- */
  // === Исполнители ГРП: общее количество + состав бригады (Сборка 22.09-85) ===
  // Хранится в виде работы: crew_size (число) и crew [{prof, grade, count}].
  // Профессия + разряд упакованы в value через \u0001 (Сборка 22.09-86: выбор СТРОГО из справочника «Профессии»)
  function crewProfOptions(cur) {
    var list = [];
    try { if (window.SP_PROFS && SP_PROFS.getAll) list = SP_PROFS.getAll(); } catch (e) {}
    list = list.slice().sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'ru') || ((a.grade || 0) - (b.grade || 0)); });
    var h = '', found = false;
    list.forEach(function (p) {
      var v = p.name + '\u0001' + p.grade;
      var on = cur && cur.prof === p.name && String(cur.grade || '') === String(p.grade);
      if (on) found = true;
      h += '<option value="' + esc(v) + '"' + (on ? ' selected' : '') + '>' + esc(p.name) + (p.grade ? ' — ' + p.grade + ' разряд' : '') + '</option>';
    });
    // Значение из старых данных, которого уже нет в справочнике — показываем с пометкой
    if (cur && cur.prof && !found) {
      h += '<option value="' + esc(cur.prof + '\u0001' + (cur.grade || '')) + '" selected>⚠ ' + esc(cur.prof) + (cur.grade ? ' — ' + esc(String(cur.grade)) + ' разряд' : '') + ' (нет в справочнике)</option>';
    }
    return h;
  }
  function crewRowHtml(it) {
    it = it || {};
    var h = '<div data-crew-row style="display:flex;gap:6px;align-items:center;margin-bottom:5px">';
    h += '<select data-crew-prof style="flex:1;min-width:200px"><option value="">— выберите профессию —</option>' + crewProfOptions(it.prof ? it : null) + '</select>';
    h += '<input data-crew-count type="number" min="0" step="1" value="' + (it.count != null ? it.count : 1) + '" style="width:60px" title="Количество работников этой профессии">';
    h += '<button type="button" data-crew-rm class="btn sm" style="color:var(--red);padding:2px 9px" title="Убрать строку">✕</button>';
    h += '</div>';
    return h;
  }
  function crewRefreshHint() {
    var sizeEl = document.getElementById('wm-crew-size');
    var hintEl = document.getElementById('wm-crew-hint');
    if (!sizeEl || !hintEl) return;
    var size = parseInt(sizeEl.value, 10); if (!isFinite(size) || size < 0) size = 0;
    var sum = 0;
    document.querySelectorAll('#wm-crew-rows [data-crew-count]').forEach(function (el) {
      var n = parseInt(el.value, 10); if (isFinite(n) && n > 0) sum += n;
    });
    hintEl.textContent = 'Распределено: ' + sum + ' из ' + size;
    hintEl.style.color = (sum === size) ? (size > 0 ? '#15803d' : '#94a3b8') : (sum > size ? '#b91c1c' : '#b45309');
  }
  function initCrewEditor(crew, size) {
    var box = document.getElementById('wm-crew-rows');
    if (!box) return;
    var rows = (crew && crew.length) ? crew : [];
    if (!rows.length && size > 0) rows = [{ prof: '', grade: '', count: size }];
    box.innerHTML = rows.map(function (it) { return crewRowHtml(it); }).join('');
    var addBtn = document.getElementById('wm-crew-add');
    if (addBtn) addBtn.addEventListener('click', function () {
      box.insertAdjacentHTML('beforeend', crewRowHtml({ prof: '', grade: '', count: 1 }));
      crewRefreshHint();
    });
    box.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-crew-rm]') : null;
      if (!b) return;
      var row = b.parentNode;
      if (row && row.parentNode) row.parentNode.removeChild(row);
      crewRefreshHint();
    });
    box.addEventListener('input', function () { crewRefreshHint(); });
    box.addEventListener('change', function () { crewRefreshHint(); });
    var sizeEl = document.getElementById('wm-crew-size');
    if (sizeEl) sizeEl.addEventListener('input', function () {
      var n = parseInt(sizeEl.value, 10);
      if (isFinite(n) && n > 0 && !box.querySelector('[data-crew-row]')) {
        box.innerHTML = crewRowHtml({ prof: '', grade: '', count: n });
      }
      crewRefreshHint();
    });
    crewRefreshHint();
  }
  function crewCollect() {
    var out = [];
    var skipped = 0;
    document.querySelectorAll('#wm-crew-rows [data-crew-row]').forEach(function (row) {
      var pEl = row.querySelector('[data-crew-prof]');
      var cEl = row.querySelector('[data-crew-count]');
      var cnt = cEl ? parseInt(cEl.value, 10) : 0;
      if (!isFinite(cnt) || cnt < 0) cnt = 0;
      var raw = pEl ? String(pEl.value || '') : '';
      var sepAt = raw.indexOf('\u0001');
      var it = sepAt >= 0
        ? { prof: raw.slice(0, sepAt), grade: raw.slice(sepAt + 1), count: cnt }
        : { prof: raw, grade: '', count: cnt };
      if (!it.prof && it.count > 0) skipped++;
      if (it.prof) out.push(it);
    });
    out.skipped = skipped; // строки с количеством, но без профессии — не сохраняются, предупредим
    return out;
  }

  /* ===== 22.09-112: переименование группы работ — для всех работ группы сразу ===== */
  function openGroupRenameModal(path) {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    var p = normGroupPath(path);
    if (!p) return;
    var affected = groupPathAffected(WORK.getWorks(S.workArea), p);
    S.grpRenamePath = p;
    var h = '<div class="modal-h"><h3>Переименование группы работ</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    h += '<div class="fld"><label>Текущее наименование</label><input value="' + esc(p) + '" disabled style="opacity:.65"></div>';
    h += '<div class="fld"><label>Новое наименование</label><input id="grm-name" value="' + esc(p) + '" autocomplete="off"></div>';
    h += '<div style="font-size:12px;color:var(--muted);line-height:1.55">Наименование изменится сразу у всех работ группы — затронуто работ: <b style="color:var(--ink)">' + affected + '</b> (включая подгруппы).<br>' +
      'Подгруппа задаётся через « / » (косая черта с пробелом) — например, <b>Обслуживание ГРП / Зима</b> перенесёт эту группу в подгруппу «Зима» внутри «Обслуживание ГРП».<br>' +
      'Если указать наименование уже существующей группы — группы объединятся.</div>';
    h += '</div><div class="modal-f"><button class="btn" data-action="close-modal">Отмена</button><button class="btn primary" data-action="grp-rename-save">Переименовать</button></div>';
    modal.innerHTML = h; overlay.classList.add('show');
    var inp = document.getElementById('grm-name'); if (inp) { inp.focus(); inp.select(); }
  }
  function saveGroupRename() {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    var op = S.grpRenamePath; if (!op) return;
    var el = document.getElementById('grm-name');
    var np = normGroupPath(el ? el.value : '');
    if (!np) { toast('err', 'Введите наименование группы'); return; }
    if (np === op) { overlay.classList.remove('show'); return; }
    var n = WORK.renameGroup(S.workArea, op, np);
    if (!S.refsOpen) S.refsOpen = {};
    delete S.refsOpen[op]; S.refsOpen[np] = true;
    overlay.classList.remove('show');
    if (n > 0) { toast('ok', 'Группа переименована · обновлено работ: ' + n); logAction('Переименование группы работ', op + ' → ' + np + ' (' + n + ' шт.)'); }
    else toast('warn', 'Работы этой группы не найдены');
    renderRefs();
  }

  /* ===== 22.09-137: СВОЙСТВА ГРУППЫ РАБОТ =====
     «📡 Телеметрия»: работы группы подбираются только объектам с ТМ; в режиме
     «Работы с ТМ» — подбираются только объектам с телеметрией; «Без телеметрии» —
     только объектам без ТМ. Прочие свойства — простые метки для наглядности.
     Свойства записываются на все работы группы и её подгрупп (group_flags —
     синхронизируются с сервером вместе с работами). Карточка доступна только
     на участке «ГРП» (22.09-144). */
  function openGroupPropsModal(path) {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    // 22.09-144: карточка свойств групп — только участок «ГРП»
    if (S.workArea !== 'ГРП') { toast('warn', '🏷 Свойства групп доступны только на участке «ГРП»'); return; }
    var p = normGroupPath(path);
    if (!p) return;
    var area = S.workArea;
    var flags = []; try { flags = (WORK.groupFlagsOf && WORK.groupFlagsOf(area, p)) || []; } catch (e) {}
    function hasFlag(f) { var x = String(f).toLowerCase(); return flags.some(function (s) { return String(s || '').trim().toLowerCase() === x; }); }
    // 22.09-144: системные метки — «Работы с ТМ» (старое имя «Телеметрия») и
    // «Без телеметрии»; «ГРП» упразднена и в «Другие свойства» не поднимается
    var others = flags.filter(function (s) {
      var x = String(s || '').trim().toLowerCase();
      return x !== 'телеметрия' && x !== 'работы с тм' && x !== 'без телеметрии' && s.trim() !== 'ГРП';
    });
    var affected = groupPathAffected(WORK.getWorks(area), p);
    S.grpPropsPath = p;
    var h = '<div class="modal-h"><h3>🏷 Свойства группы работ</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:4px">' + esc(p) + '</div>';
    h += '<div style="font-size:12.5px;color:var(--muted);margin-bottom:12px">Свойства применятся ко всем работам группы и её подгрупп (затронуто работ: <b>' + affected + '</b>).</div>';
    var tmOn = hasFlag('Работы с ТМ') || hasFlag('Телеметрия'), noTmOn = hasFlag('Без телеметрии');
    h += '<label class="cb" style="display:block;font-size:12.5px;line-height:1.5;margin-bottom:10px"><input type="checkbox" id="gp-tm"' + (tmOn ? ' checked' : '') + '> 📡 <b>Работы с ТМ</b> — работы группы подбираются только объектам С телеметрией</label>';
    h += '<label class="cb" style="display:block;font-size:12.5px;line-height:1.5;margin-bottom:12px"><input type="checkbox" id="gp-notm"' + (noTmOn ? ' checked' : '') + '> 🚫📡 <b>Без телеметрии</b> — работы группы подбираются только объектам БЕЗ телеметрии</label>';
    h += '<div class="fld"><label>Другие свойства (через запятую) <span style="color:#94a3b8;font-weight:500">— просто метки для наглядности, на автоподбор не влияют</span></label><input id="gp-other" value="' + esc(others.join(', ')) + '" placeholder="напр.: Зима, Капремонт" autocomplete="off"></div>';
    h += '</div><div class="modal-f"><button class="btn" data-action="close-modal">Отмена</button><button class="btn primary" data-action="grp-props-save">Сохранить</button></div>';
    modal.innerHTML = h; overlay.classList.add('show');
    // «Работы с ТМ» и «Без телеметрии» взаимоисключают друг друга
    var tmEl = document.getElementById('gp-tm'), noEl = document.getElementById('gp-notm');
    if (tmEl && noEl) {
      tmEl.addEventListener('change', function () { if (tmEl.checked) noEl.checked = false; });
      noEl.addEventListener('change', function () { if (noEl.checked) tmEl.checked = false; });
    }
  }
  function saveGroupProps() {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    var p = S.grpPropsPath || '';
    if (!p) return;
    function chk(id) { var el = document.getElementById(id); return el ? el.checked : false; }
    var flags = [];
    if (chk('gp-tm')) flags.push('Работы с ТМ');
    if (chk('gp-notm')) flags.push('Без телеметрии');
    var oEl = document.getElementById('gp-other');
    var extra = (oEl ? oEl.value : '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    extra.forEach(function (s) {
      var x = s.toLowerCase();
      if (x === 'телеметрия' || x === 'работы с тм') { // системная — нормализуем имя
        if (flags.indexOf('Работы с ТМ') === -1) flags.push('Работы с ТМ');
        return;
      }
      if (x === 'без телеметрии') {
        if (flags.indexOf('Без телеметрии') === -1) flags.push('Без телеметрии');
        return;
      }
      if (flags.indexOf(s) === -1) flags.push(s);
    });
    var n = 0;
    try { n = WORK.setGroupFlags(S.workArea, p, flags); } catch (e) { toast('err', 'Не удалось сохранить свойства группы'); return; }
    logAction('Свойства группы работ', p + ': ' + (flags.join(', ') || 'нет'));
    overlay.classList.remove('show');
    toast('ok', '🏷 Свойства группы «' + p + '» обновлены' + (n ? ' (работ затронуто: ' + n + ')' : ' (без изменений)'));
    renderRefs();
  }

  /* 22.09-206: ПРОВОДИТСЯ СОВМЕСТНО — выбираются ГРУППЫ работ участка ГРП
     (раньше, с 22.09-162, — отдельные виды работ). joint_with теперь хранит пути
     групп «Группа / Подгруппа»; старые записи с id видов работ показываем с ⚠,
     чтобы их можно было снять. Окно выбора — поверх карточки (overlay2).
     wmJointGroups — список групп участка; wmJointLegacyName — подпись старой
     записи; wmJointSelBoxHtml — компактный список выбранных в карточке работы;
     openWmJointPickModal — окно с чекбоксами; saveWmJointPick — перенос в список. */
  function wmJointGroups(area) { // уникальные непустые группы работ участка, по алфавиту
    var out = [];
    try {
      (WORK.getWorks(area) || []).forEach(function (ww) {
        var g = (ww && ww.group != null) ? String(ww.group).trim() : '';
        if (g && out.indexOf(g) < 0) out.push(g);
      });
    } catch (e) {}
    out.sort();
    return out;
  }
  function wmJointLegacyName(id) { // подпись старой записи (id вида работы)
    var lw = null; try { lw = WORK.getWorkById && WORK.getWorkById(id); } catch (e) {}
    return lw ? lw.name : String(id);
  }
  function wmJointSelBoxHtml(area, wid) {
    var sel = (S.wmJointSel || []).filter(function (x) { return x !== wid; });
    if (!sel.length) return '<div style="color:#94a3b8;font-size:12px;padding:5px 2px">— группы не выбраны — нажмите «📋 Выбор групп»</div>';
    var groups = wmJointGroups(area);
    var h2 = '';
    sel.forEach(function (g) {
      if (groups.indexOf(g) >= 0) {
        h2 += '<div style="display:flex;align-items:center;gap:6px;padding:3px 2px;font-size:12px;border-bottom:1px dashed var(--line)"><span style="flex:1"><b style="color:var(--ink)">' + esc(g) + '</b><span style="color:#64748b"> · группа работ</span></span></div>';
      } else {
        h2 += '<div style="display:flex;align-items:center;gap:6px;padding:3px 2px;font-size:12px;border-bottom:1px dashed var(--line)"><span style="flex:1"><b style="color:#92400e">' + esc(wmJointLegacyName(g)) + '</b><span style="color:#b45309"> · ⚠ старый выбор (вид работы)</span></span></div>';
      }
    });
    return h2;
  }
  function openWmJointPickModal() {
    var overlay2 = document.getElementById('overlay2'), modal2 = document.getElementById('modal2');
    if (!overlay2 || !modal2) return;
    var area = S.workArea, wid = S.workModalWid;
    var groups = wmJointGroups(area);
    var gcnt = {};
    try {
      (WORK.getWorks(area) || []).forEach(function (ww) {
        var g = (ww && ww.group != null) ? String(ww.group).trim() : '';
        if (g) gcnt[g] = (gcnt[g] || 0) + 1;
      });
    } catch (e) {}
    var sel = (S.wmJointSel || []).filter(function (x) { return x !== wid; });
    var h = '<div class="modal-h"><h3>Проводится совместно — выбор групп работ</h3><button class="x" data-action="close-modal2">×</button></div><div class="modal-b">';
    h += '<div style="font-size:12.5px;color:var(--muted);margin-bottom:10px;line-height:1.5">Отметьте галочками группы работ участка ГРП, которые проводятся совместно с этой работой (можно одну или несколько), затем нажмите «Сохранить» — выбранные появятся в списке «Проводится совместно».</div>';
    h += '<div style="max-height:46vh;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:6px;background:#fff">';
    if (!groups.length && !sel.length) {
      h += '<div style="color:#94a3b8;font-size:12.5px;padding:14px;text-align:center">На участке ГРП нет групп работ</div>';
    } else {
      groups.forEach(function (g) {
        var on = sel.indexOf(g) >= 0;
        h += '<label class="cb" style="display:flex;align-items:center;gap:7px;padding:5px 6px;border-radius:6px;font-size:12.5px;cursor:pointer">';
        h += '<input type="checkbox" data-j2="' + esc(g) + '"' + (on ? ' checked' : '') + '><span style="flex:1"><b style="color:var(--ink)">' + esc(g) + '</b><span style="color:#64748b"> · работ: ' + (gcnt[g] || 0) + '</span></span></label>';
      });
      // legacy: ранее выбранные ВИДЫ работ (старый формат записей) — строка с ⚠, галочку можно снять
      sel.forEach(function (id) {
        if (groups.indexOf(id) >= 0) return;
        h += '<label class="cb" style="display:flex;align-items:center;gap:7px;padding:5px 6px;border-radius:6px;font-size:12.5px;cursor:pointer">';
        h += '<input type="checkbox" data-j2="' + esc(id) + '" checked><span style="flex:1"><b style="color:#92400e">' + esc(wmJointLegacyName(id)) + '</b><span style="color:#b45309"> · ⚠ старый выбор (вид работы)</span></span></label>';
      });
    }
    h += '</div></div>';
    h += '<div class="modal-f"><button class="btn" data-action="close-modal2">Отмена</button><button class="btn primary" data-action="save-joint-pick">Сохранить</button></div>';
    modal2.style.width = ''; modal2.style.maxWidth = ''; // 22.09-235: ширина по умолчанию (не наследуем от широких окон)
    modal2.innerHTML = h;
    overlay2.classList.add('show');
  }
  function saveWmJointPick() {
    var overlay2 = document.getElementById('overlay2'), modal2 = document.getElementById('modal2');
    var sel = [];
    if (modal2) modal2.querySelectorAll('[data-j2]').forEach(function (n) { if (n.checked) sel.push(n.getAttribute('data-j2')); });
    S.wmJointSel = sel;
    if (overlay2) overlay2.classList.remove('show');
    // перерисовать компактный список в карточке работы
    var box = document.getElementById('wm-joint-sel');
    if (box) box.innerHTML = wmJointSelBoxHtml(S.workArea, S.workModalWid);
    toast('ok', '✓ Совместных групп выбрано: ' + sel.length);
  }

  function openWorkModal(mode, wid) {
    var area = S.workArea;
    var w = mode === 'edit' ? WORK.getWork(area, wid) : null;
    var title = (mode === 'edit' ? 'Редактирование работы' : 'Новая работа') + ' · ' + area;
    // 22.09-112: «Группа работ» — два поля (группа + необязательная подгруппа);
    // в базе это по-прежнему одна строка group = «Группа / Подгруппа».
    // 22.09-208: добавлена НАДГРУППА (группа групп работ) — третье поле сверху,
    // путь становится «Надгруппа / Группа / Подгруппа»; старые работы с 1–2 сегментами не меняются.
    var grpPreset = S.workPresetGroup || ''; S.workPresetGroup = '';
    var grpVal = '', subVal = '', supVal = '';
    var grpSrc = normGroupPath(w && w.group ? w.group : grpPreset);
    // 22.09-208: три уровня — «Надгруппа / Группа / Подгруппа»; данные с 1–2 сегментами — как раньше
    if (grpSrc) {
      var grpSegs = grpSrc.split(' / ');
      if (grpSegs.length >= 3) { supVal = grpSegs[0]; grpVal = grpSegs[1]; subVal = grpSegs.slice(2).join(' / '); }
      else { grpVal = grpSegs[0] || ''; subVal = grpSegs.slice(1).join(' / '); }
    }
    var grpLists = groupSuggest(area);
    function dlOptsHtml(arr) { return arr.map(function (v) { return '<option value="' + esc(v) + '">'; }).join(''); }
    var h = '<div class="modal-h"><h3>' + esc(title) + '</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    h += '<div class="attr-row">' +
      '<div class="fld"><label>Надгруппа <span style="color:#94a3b8;font-weight:500">(группа групп работ — необязательно)</span></label><input id="wm-supergroup" list="wm-sup-dl" autocomplete="off" value="' + esc(supVal) + '" placeholder="Без надгруппы"><datalist id="wm-sup-dl">' + dlOptsHtml(grpLists.tops) + '</datalist></div>' +
      '<div class="fld"><label>Группа работ</label><input id="wm-group" list="wm-grp-dl" autocomplete="off" value="' + esc(grpVal) + '" placeholder="Напр.: Благоустройство"><datalist id="wm-grp-dl">' + dlOptsHtml(grpLists.tops) + '</datalist></div>';
    h += '<div class="fld"><label>Подгруппа <span style="color:#94a3b8;font-weight:500">(необязательно, напр.: Лето / Зима)</span></label><input id="wm-subgroup" list="wm-sub-dl" autocomplete="off" value="' + esc(subVal) + '" placeholder="Без подгруппы"><datalist id="wm-sub-dl">' + dlOptsHtml(grpLists.subsFor(grpVal)) + '</datalist></div></div>';
    h += '<div class="fld"><label>Название работы</label><input id="wm-name" value="' + (w ? esc(w.name) : '') + '" placeholder="Напр.: Укладка асфальта"></div>';
    // 22.09-95: «Норма времени, ч» и «Единица измерения» из карточки убраны —
    // нормы живут отдельно (загружаются импортом норм), здесь только вид работы.
    // 22.09-84: блок «Атрибуты УБиРОГС» — ТОЛЬКО для участка УБиРОГС.
    // Для ГРП ниже свой блок «Атрибуты ГРП», у остальных — пока нет атрибутов.
    if (area === 'УБиРОГС') {
    h += '<div style="background:var(--panel-2);border:1px solid var(--line);border-radius:8px;padding:12px;margin-bottom:14px;">';
    h += '<div style="font-size:12px;font-weight:700;color:var(--ink);margin-bottom:10px;">⚙️ Атрибуты УБиРОГС</div>';
    h += '<div class="attr-row"><div class="fld"><label class="cb"><input type="checkbox" id="wm-permit" ' + (w && w.needs_permit ? 'checked' : '') + '> Требуется ордер</label></div>';
    h += '<div class="fld"><label class="cb"><input type="checkbox" id="wm-snow" ' + (w && w.depends_on_snow ? 'checked' : '') + '> Зависит от снегопада</label></div></div>';
    h += '<div class="attr-row"><div class="fld"><label>Мин. температура, °C</label><input id="wm-temp" type="number" value="' + (w && w.min_temp != null ? w.min_temp : -50) + '" placeholder="-50 = без ограничений"></div>';
    h += '<div class="fld"><label>Сезон</label><select id="wm-season">';
    ['Круглый год', 'Зима', 'Лето', 'Весна-осень'].forEach(function (s) { h += '<option value="' + s + '"' + (w && w.season === s ? ' selected' : '') + '>' + s + '</option>'; });
    h += '</select></div></div>';
    h += '<div class="attr-row"><div class="fld"><label>Требуемая техника</label><input id="wm-equip" value="' + (w ? esc(w.equipment || '—') : '—') + '" placeholder="Экскаватор, КДМ, ..."></div>';
    h += '<div class="fld"><label>Кол-во исполнителей (мин / оптим.)</label><div style="display:flex;gap:8px"><input id="wm-minw" type="number" min="1" value="' + (w ? (w.min_workers || 1) : 2) + '" style="flex:1" placeholder="мин"><input id="wm-optw" type="number" min="1" value="' + (w ? (w.opt_workers || 2) : 3) + '" style="flex:1" placeholder="опт"></div></div></div>';
    h += '</div>';
    } // if (area === 'УБиРОГС')

    // === Атрибуты по «4 Атрибуты видов работ.htm» (Сборка 22.09-29) ===
    // 22.09-84: этот блок — ТОЛЬКО для участка ГРП
    if (area === 'ГРП') {
    h += '<div style="background:#eef6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin-bottom:14px;">';
    h += '<div style="font-size:12px;font-weight:700;color:#1d4ed8;margin-bottom:10px;">📋 Атрибуты ГРП</div>';
    // 22.09-205: норма времени и единица измерения задаются прямо в карточке вида работ ГРП
    // (текстовое поле нормы — чтобы принимать и запятую «0,15»; при сохранении приводится к числу)
    h += '<div class="attr-row"><div class="fld"><label>Норма времени (чел/ч на единицу)</label><input id="wm-norm" type="text" inputmode="decimal" value="' + ((w && w.norm != null && w.norm !== '') ? w.norm : 1) + '" placeholder="напр.: 0,15"></div>' +
      '<div class="fld"><label>Единица измерения</label><input id="wm-unit" list="wm-unit-dl" autocomplete="off" value="' + esc((w && w.unit) || 'объект') + '" placeholder="объект"><datalist id="wm-unit-dl">' +
      ['объект', 'шт', 'м', 'м2', 'км', 'компл.', 'ч'].map(function (u) { return '<option value="' + u + '">'; }).join('') +
      '</datalist></div></div>';

    // 1. Категория объекта обслуживания (мульти-чекбоксы)
    var curCats = (w && w.object_categories) || [];
    var cats = ['ГРП', 'ШРП', 'ПГРП', 'ГРС', 'Узел учёта газа', 'Иное']; // 22.09-98: газопроводы убраны из категорий объекта обслуживания
    h += '<div class="fld"><label>Категория объекта обслуживания <span style="color:#94a3b8;font-weight:500">(можно выбрать несколько)</span></label>';
    h += '<div id="wm-cats" style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;">';
    cats.forEach(function (c) {
      var on = curCats.indexOf(c) >= 0;
      h += '<label class="cb" style="background:' + (on ? '#dbeafe' : '#fff') + ';border:1px solid ' + (on ? '#2563eb' : '#e2e8f0') + ';border-radius:6px;padding:4px 9px;cursor:pointer;font-size:12px;font-weight:600;color:#1e3a8a;">';
      h += '<input type="checkbox" data-cat="' + esc(c) + '"' + (on ? ' checked' : '') + ' style="margin-right:5px;">' + esc(c) + '</label>';
    });
    h += '</div></div>';

    // 2. Доступно подразделениям (мульти-чекбоксы — участки)
    var curDeps = (w && w.departments) || [];
    var deps = [];
    try { if (window.SP_AREAS && typeof SP_AREAS.getAreas === 'function') deps = SP_AREAS.getAreas(); } catch (e) {}
    h += '<div class="fld"><label>Доступно подразделениям <span style="color:#94a3b8;font-weight:500">(Справочник Подразделения)</span></label>';
    h += '<div id="wm-deps" style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;">';
    (deps && deps.length ? deps : ['УБиРОГС']).forEach(function (d) {
      var on = curDeps.indexOf(d) >= 0;
      h += '<label class="cb" style="background:' + (on ? '#dbeafe' : '#fff') + ';border:1px solid ' + (on ? '#2563eb' : '#e2e8f0') + ';border-radius:6px;padding:4px 9px;cursor:pointer;font-size:12px;font-weight:600;color:#1e3a8a;">';
      h += '<input type="checkbox" data-dep="' + esc(d) + '"' + (on ? ' checked' : '') + ' style="margin-right:5px;">' + esc(d) + '</label>';
    });
    h += '</div></div>';

    // 2.5. Сезон проведения (Сборка 22.09-113): выбор сезона — зима / лето (круглый год — по умолчанию)
    var seasonOpts = ['Круглый год', 'Зима', 'Лето'];
    var curSeason = (w && w.season) || 'Круглый год';
    if (seasonOpts.indexOf(curSeason) === -1) seasonOpts.push(curSeason); // значение вне списка (старое) — не теряем
    h += '<div class="fld" style="max-width:280px"><label>Сезон проведения</label><select id="wm-season">' +
      seasonOpts.map(function (s) { return '<option value="' + s + '"' + (curSeason === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
      '</select></div>';

    // 3. Периодичность (22.09-107: во всю ширину, реквизит отсчёта — отдельным блоком под ней)
    h += '<div class="fld"><label>Периодичность выполнения</label><div style="display:flex;gap:10px;max-width:520px">' +
      '<label style="flex:1;font-size:12px;font-weight:700;color:var(--muted)">Периодичность, месяцев' +
      '<input id="wm-period-value" type="number" min="0" step="1" value="' + (w && w.periodicity_value ? w.periodicity_value : '') + '" placeholder="напр.: 12" style="margin-top:3px"></label>' +
      '<label style="flex:1;font-size:12px;font-weight:700;color:var(--muted)">Отклонение, дней' +
      '<input id="wm-period-dev" type="number" min="0" step="1" value="' + ((w && w.periodicity_dev) || '') + '" placeholder="напр.: 2" style="margin-top:3px"></label>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--muted);margin-top:4px">Шаг серии = периодичность − отклонение (как в настройке периодичности в графике работ)</div></div>';
    h += '<div class="fld" style="max-width:520px"><label>Реквизит отсчёта для выполнения работ</label><select id="wm-period-basis"><option value="prev_date"' + (w && w.periodicity_basis === 'prev_date' ? ' selected' : '') + '>Дата предыдущего выполнения</option><option value="commissioning_date"' + (w && w.periodicity_basis === 'commissioning_date' ? ' selected' : '') + '>Дата ввода в эксплуатацию</option><option value="service_life_end"' + (w && w.periodicity_basis === 'service_life_end' ? ' selected' : '') + '>Дата окончания срока службы оборудования</option></select></div>';

    // 22.09-206: блок «Виды работ, от которых отсчёт периодичности» удалён из
    // карточки по требованию — параметр больше не редактируется; старые значения
    // у существующих работ сохраняются (updateWork не затирает непереданные поля).

    /* 6. Проводится совместно.
       22.09-162: инлайн-чекбоксы заменены на компактный список выбранных +
       кнопку «📋 Выбор работ», открывающую отдельное окно поверх карточки:
       в нём — те же чекбоксы; «Сохранить» переносит выбор в список ниже,
       «Отмена» — закрывает без изменений.
       22.09-206: выбираются ГРУППЫ работ (раньше — отдельные виды работ). */
    var curJoint = [];
    try {
      var _jwOld = w && w.joint_with;
      if (Array.isArray(_jwOld)) curJoint = _jwOld.slice();
      else if (_jwOld) curJoint = [_jwOld];
      // 22.09-159: сама работа не может быть совместной сама себе
      if (wid) curJoint = curJoint.filter(function (x) { return x !== wid; });
    } catch (e) {}
    S.wmJointSel = curJoint.slice(); // выбор правится через окно; saveWork читает его
    h += '<div class="fld"><label>Проводится совместно <span style="color:#94a3b8;font-weight:500">(группы работ участка ГРП, можно выбрать несколько)</span></label>';
    h += '<div style="display:flex;gap:8px;align-items:flex-start">';
    h += '<div id="wm-joint-sel" style="flex:1;min-height:38px;max-height:120px;overflow:auto;border:1px solid var(--line);border-radius:6px;padding:4px 6px;background:#fff;">' + wmJointSelBoxHtml(area, wid) + '</div>';
    h += '<button type="button" data-action="wm-joint-pick" style="flex:0 0 auto;white-space:nowrap;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer" title="Открыть окно выбора совместных групп работ — галочками отметить одну или несколько, затем «Сохранить»">📋 Выбор групп</button>';
    h += '</div></div>';

    // 7. Операции (список значений — через запятую)
    h += '<div class="fld"><label>Операции <span style="color:#94a3b8;font-weight:500">(список значений, через запятую)</span></label>';
    h += '<input id="wm-operations" value="' + esc(((w && w.operations) || []).join(', ')) + '" placeholder="напр.: Подготовка, Монтаж, Проверка"></div>';


    // 8.2. Количество линий редуцирования (Сборка 22.09-87)
    h += '<div class="fld" style="max-width:280px"><label>Кол-во линий редуцирования (шт)</label><input id="wm-lines" type="number" min="0" step="1" value="' + ((w && w.lines_count) || 0) + '" placeholder="0 — не задано"></div>';

    // 8.3. Связь с объектом для автоподбора (Сборка 22.09-115): телеметрия, диагностика, отопление
    var telNames = [];
    try { telNames = telemetryNames(); } catch (e) {}
    h += '<div class="fld" style="background:#fff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px">';
    h += '<label style="font-size:12px;font-weight:700;color:#1e3a8a;margin-bottom:8px;display:block">🔌 Связь с оборудованием объекта — для автоподбора в графике</label>';
    h += '<div class="attr-row"><div class="fld"><label>Телеметрия на объекте</label><select id="wm-tel-req">' +
      '<option value=""' + (!w || !w.telemetry_req ? ' selected' : '') + '>Не важно (работа для любых объектов)</option>' +
      '<option value="equipped"' + (w && w.telemetry_req === 'equipped' ? ' selected' : '') + '>Только объекты, оборудованные телеметрией</option>' +
      '<option value="not_equipped"' + (w && w.telemetry_req === 'not_equipped' ? ' selected' : '') + '>Только объекты БЕЗ телеметрии</option>' +
      '</select></div>';
    h += '<div class="fld"><label>Тип телеметрии <span style="color:#94a3b8;font-weight:500">(если выбран — по типу и наличию)</span></label><select id="wm-tel-type"><option value="">— любой тип —</option>';
    telNames.forEach(function (t) { h += '<option value="' + esc(t) + '"' + (w && w.telemetry_type === t ? ' selected' : '') + '>' + esc(t) + '</option>'; });
    if (w && w.telemetry_type && telNames.indexOf(w.telemetry_type) < 0) h += '<option value="' + esc(w.telemetry_type) + '" selected>' + esc(w.telemetry_type) + ' ⚠ (нет в списке)</option>';
    h += '</select></div></div>';
    h += '<div class="attr-row"><div class="fld"><label class="cb"><input type="checkbox" id="wm-diag" ' + (w && w.diag_equipment ? 'checked' : '') + '> С использованием приборного диагностического оборудования <span style="color:#94a3b8;font-weight:500">(добавляется объектам с видом обслуживания «Region-gas»)</span></label></div>';
    h += '<div class="fld"><label class="cb"><input type="checkbox" id="wm-heatreq" ' + (w && w.heating_req ? 'checked' : '') + '> ТО отопительного оборудования <span style="color:#94a3b8;font-weight:500">(только объектам с отоплением — ГРП)</span></label></div></div>';
    h += '</div>';

    // 8.5. Исполнители: общее количество + состав бригады по профессиям (Сборка 22.09-85)
    h += '<div class="fld" style="background:#fff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px">';
    h += '<label style="font-size:12px;font-weight:700;color:#1e3a8a;margin-bottom:8px;display:block">👷 Количество исполнителей и состав бригады</label>';
    h += '<label style="font-size:12.5px;font-weight:600;color:#475569">Количество исполнителей (общее)</label>';
    h += '<input id="wm-crew-size" type="number" min="0" step="1" value="' + ((w && w.crew_size) || 0) + '" placeholder="напр.: 3" style="width:120px;margin:2px 0 8px">';
    h += '<div style="font-size:12.5px;font-weight:600;color:#475569;margin-bottom:5px">Работники будут: <span style="color:#94a3b8;font-weight:500">(профессия из справочника «Профессии» — количество)</span></div>';
    h += '<div id="wm-crew-rows"></div>';
    var crewProfsCount = 0;
    try { if (window.SP_PROFS && SP_PROFS.getAll) crewProfsCount = SP_PROFS.getAll().length; } catch (e) {}
    if (!crewProfsCount) h += '<div style="font-size:12.5px;color:#92400e;background:#fef9c3;border:1px solid #fde68a;border-radius:6px;padding:6px 9px;margin:2px 0 6px">⚠️ Справочник «Профессии» пока пуст — сначала добавьте профессии: «Справочники» → «Профессии».</div>';
    h += '<div style="display:flex;gap:12px;align-items:center;margin-top:4px;flex-wrap:wrap">';
    h += '<button type="button" id="wm-crew-add" class="btn sm" style="border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;font-weight:600">＋ Добавить профессию</button>';
    h += '<span id="wm-crew-hint" style="font-size:12.5px;font-weight:600"></span>';
    h += '</div>';
    h += '</div>';

    // 9. Показатели эксплуатации
    h += '<div class="fld"><label>Показатели эксплуатации (контролируемые) <span style="color:#94a3b8;font-weight:500">(список значений)</span></label>';
    h += '<input id="wm-indicators" value="' + esc(((w && w.indicators) || []).join(', ')) + '" placeholder="напр.: Давление, Температура, Расход"></div>';

    // 10. Перечень печатных форм
    h += '<div class="fld"><label>Перечень печатных форм <span style="color:#94a3b8;font-weight:500">(список, через запятую)</span></label>';
    h += '<input id="wm-printforms" value="' + esc(((w && w.print_forms) || []).join(', ')) + '" placeholder="напр.: Акт осмотра, Протокол измерений"></div>';

    // 11-13. Чекбоксы: журнал, паспорт, сканы
    h += '<div class="attr-row"><div class="fld"><label class="cb"><input type="checkbox" id="wm-opjournal" ' + (w && w.op_journal ? 'checked' : '') + '> Записи в оперативном журнале</label></div>';
    h += '<div class="fld"><label class="cb"><input type="checkbox" id="wm-passport" ' + (w && w.passport_entry ? 'checked' : '') + '> Записи в эксплуатационном паспорте</label></div>';
    h += '</div>';
    h += '<div class="fld"><label class="cb"><input type="checkbox" id="wm-scanattach" ' + (w && w.scan_attach ? 'checked' : '') + '> Присоединение отсканированных подписанных документов</label></div>';

    h += '</div>';
    } // if (area === 'ГРП')

    h += '</div><div class="modal-f"><button class="btn" data-action="close-modal">Отмена</button><button class="btn primary" data-action="save-work">Сохранить</button></div>';
    modal.style.width = '80%'; modal.style.maxWidth = '80%'; // 22.09-100: карточка редактирования работ — 80% ширины, по центру
    modal.innerHTML = h; overlay.classList.add('show');
    S.workModalMode = mode; S.workModalWid = wid;
    if (area === 'ГРП') initCrewEditor(w && w.crew, (w && w.crew_size) || 0);
    // 22.09-112: подсказки подгрупп — для введённой группы; из «＋» у группы фокус — подгруппа/название
    var wmGrpInp = document.getElementById('wm-group');
    if (wmGrpInp) wmGrpInp.addEventListener('input', function () {
      var dl = document.getElementById('wm-sub-dl');
      if (dl) dl.innerHTML = dlOptsHtml(grpLists.subsFor(wmGrpInp.value));
    });
    if (mode === 'new' && grpPreset) {
      var focEl = document.getElementById(subVal ? 'wm-name' : 'wm-subgroup');
      if (focEl) focEl.focus();
    }
  }
  function saveWork() {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    var area = S.workArea, mode = S.workModalMode, wid = S.workModalWid;
    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
    function chk(id) { var el = document.getElementById(id); return el ? el.checked : false; }
    function arrFromAttr(attr) {
      var out = [];
      try {
        var nodes = document.querySelectorAll('[data-' + attr + ']');
        nodes.forEach(function (n) { if (n.checked) out.push(n.getAttribute('data-' + attr)); });
      } catch (e) {}
      return out;
    }
    var name = val('wm-name');
    if (!name) { toast('err', 'Введите название работы'); return; }
    // 22.09-84: атрибутные блоки — только у своего участка. На чужих участках
    // поля НЕ РЕНДЕРЯТСЯ, поэтому при ПРАВКЕ сохраняем старые значения (иначе
    // бы затёрлись дефолтами), при СОЗДАНИИ — дефолтные.
    var oldW = (mode === 'edit' && wid) ? WORK.getWork(area, wid) : null;
    // 22.09-95: полей нормы в карточке больше нет — значения сохраняем из старой
    // 22.09-205: для участка ГРП поля нормы и единицы возвращены в карточку (см. блок «Атрибуты ГРП» и ветку сохранения ниже).
    // записи (правка), для новой работы — дефолт 1 ч/объект (обновится импортом).
    var data = {
      group: (function () { // 22.09-112/208: «Надгруппа / Группа / Подгруппа» с нормализацией разделителя
        var sp = normGroupPath(val('wm-supergroup'));
        var gg = normGroupPath(val('wm-group'));
        var ss = normGroupPath(val('wm-subgroup'));
        var parts = [];
        if (sp) parts.push(sp);
        if (gg) parts.push(gg);
        if (ss) parts.push(ss);
        return parts.length ? parts.join(' / ') : 'Без группы';
      })(), name: name,
      norm: oldW ? oldW.norm : 1, unit: oldW ? oldW.unit : 'объект'
    };
    // Блок 1 («Атрибуты УБиРОГС»): ордер/снег/температура/сезон/техника/исполнители
    if (area === 'УБиРОГС') {
      data.needs_permit = chk('wm-permit'); data.depends_on_snow = chk('wm-snow');
      data.min_temp = parseFloat(val('wm-temp')) || -50; data.season = val('wm-season');
      data.equipment = val('wm-equip') || '—';
      data.min_workers = parseInt(val('wm-minw')) || 1; data.opt_workers = parseInt(val('wm-optw')) || 2;
    } else if (oldW) {
      ['needs_permit', 'depends_on_snow', 'min_temp', 'season', 'equipment', 'min_workers', 'opt_workers']
        .forEach(function (k) { if (oldW[k] !== undefined) data[k] = oldW[k]; });
    } else {
      data.needs_permit = false; data.depends_on_snow = false;
      data.min_temp = -50; data.season = 'Круглый год'; data.equipment = '—';
      data.min_workers = 1; data.opt_workers = 2;
    }
    // Блок 2 («Атрибуты ГРП», по «4 Атрибуты видов работ.htm»)
    if (area === 'ГРП') {
      data.object_categories = arrFromAttr('cat');
      data.departments = arrFromAttr('dep');
      data.season = val('wm-season') || 'Круглый год'; // 22.09-113: сезон в атрибутах ГРП
      // 22.09-205: норма времени и единица — из полей карточки (принимаем и запятую)
      var _normRaw = String(val('wm-norm')).replace(',', '.');
      var _normV = parseFloat(_normRaw);
      data.norm = (_normRaw !== '' && isFinite(_normV) && _normV >= 0) ? _normV : (oldW ? oldW.norm : 1);
      data.unit = val('wm-unit') || (oldW ? oldW.unit : 'объект');
      data.periodicity_value = parseInt(val('wm-period-value')) || 0;
      data.periodicity_dev = parseInt(val('wm-period-dev'), 10);
      if (!isFinite(data.periodicity_dev) || data.periodicity_dev < 0) data.periodicity_dev = 0;
      data.periodicity_unit = val('wm-period-unit') || 'мес';
      // 22.09-206: блок «Виды работ, от которых отсчёт периодичности» удалён из карточки —
      // поле больше не собираем; старые значения у существующих работ сохраняются.
      data.periodicity_basis = val('wm-period-basis') || 'prev_date';
      // 22.09-162: совместные собираются в окне выбора (S.wmJointSel);
      // 22.09-206: теперь это пути ГРУПП работ; запас — старые инлайн-чекбоксы data-joint
      data.joint_with = (Array.isArray(S.wmJointSel) ? S.wmJointSel.slice() : arrFromAttr('joint')).filter(function (x) { return x !== wid; }); // 22.09-159: без самой работы
      data.operations = val('wm-operations').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      data.indicators = val('wm-indicators').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      data.print_forms = val('wm-printforms').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      data.op_journal = chk('wm-opjournal');
      data.passport_entry = chk('wm-passport');
      data.scan_attach = chk('wm-scanattach');
      // Сборка 22.09-87: количество линий редуцирования
      data.lines_count = parseInt(val('wm-lines'), 10);
      if (!isFinite(data.lines_count) || data.lines_count < 0) data.lines_count = 0;
      // Сборка 22.09-115: связь с оборудованием объекта (автоподбор)
      data.telemetry_req = val('wm-tel-req');
      data.telemetry_type = val('wm-tel-type');
      data.diag_equipment = chk('wm-diag');
      data.heating_req = chk('wm-heatreq');
      // Сборка 22.09-85: исполнители — общее количество + состав по профессиям
      data.crew = crewCollect();
      if (data.crew.skipped) toast('warn', '⚠️ Строк с количеством, но без профессии не сохранено: ' + data.crew.skipped);
      data.crew_size = parseInt(val('wm-crew-size'), 10);
      if (!isFinite(data.crew_size) || data.crew_size < 0) data.crew_size = 0;
      var crewSum = data.crew.reduce(function (a, e) { return a + (e.count || 0); }, 0);
      if (data.crew_size > 0) { data.min_workers = data.crew_size; data.opt_workers = data.crew_size; }
      if (data.crew_size > 0 && crewSum !== data.crew_size) {
        toast('warn', '⚠️ Состав исполнителей (' + crewSum + ') не совпадает с общим количеством (' + data.crew_size + ')');
      }
    } else if (oldW) {
      ['object_categories', 'departments', 'periodicity_value', 'periodicity_unit',
        'periodicity_depends_on', 'periodicity_basis', 'joint_with', 'operations', 'periodicity_dev',
        'indicators', 'print_forms', 'op_journal', 'passport_entry', 'scan_attach',
        'crew_size', 'crew', 'lines_count', 'telemetry_req', 'telemetry_type', 'diag_equipment', 'heating_req']
        .forEach(function (k) { if (oldW[k] !== undefined) data[k] = oldW[k]; });
    } // при создании на прочих участках — пропуск: work_db сам поставит дефолты
    var savedW = null;
    if (mode === 'edit') { savedW = WORK.updateWork(area, wid, data); logAction('Изменение вида работы', data.name);
        toast('ok', 'Работа обновлена'); }
    else { savedW = WORK.addWork(area, data); logAction('Добавление вида работы', data.name);
        toast('ok', 'Работа добавлена на участок ' + area); }
    // 22.09-137: наследование свойств группы (🏷 «Телеметрия»/«ГРП»/метки):
    // новая работа получает пометки своей группы; при переезде в другую
    // группу — пометки новой группы (пометки старой затираются).
    try {
      if (savedW && savedW.id && WORK.groupFlagsOf) {
        var _gfOwn = Array.isArray(savedW.group_flags) ? savedW.group_flags : [];
        var _gfNew = WORK.groupFlagsOf(area, data.group, savedW.id) || [];
        if (JSON.stringify(_gfOwn) !== JSON.stringify(_gfNew)) WORK.updateWork(area, savedW.id, { group_flags: _gfNew });
      }
    } catch (e) {}
    overlay.classList.remove('show'); modal.style.width = ''; modal.style.maxWidth = ''; renderRefs();
  }
  function delWork(wid) {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    var w = WORK.getWork(S.workArea, wid); if (!w) return;
    return spConfirm('Удалить работу «' + w.name + '» с участка ' + S.workArea + '?', { title: 'Удаление вида работы', ok: 'Удалить', danger: true }, function () { // 22.09-244: оформленное окно
    WORK.deleteWork(S.workArea, wid); toast('ok', 'Работа удалена'); renderRefs();
    });
  }

