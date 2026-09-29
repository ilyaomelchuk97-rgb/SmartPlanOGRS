# -*- coding: utf-8 -*-
import io

def patch(path, pairs):
    with io.open(path, encoding="utf-8") as f:
        code = f.read()
    for old, new, tag, exp in pairs:
        cnt = code.count(old)
        assert cnt == exp, "%s: anchor count=%d (expected %d) for %r" % (path, cnt, exp, tag)
        code = code.replace(old, new)
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(code)
    print("patched", path)

# ============================== db.js (ensureSeed, две ветки — разные отступы) ==============================
patch('/home/user/root_index/db.js', [(
    "            window.SP_AREAS ? window.SP_AREAS.ensureSeed() : Promise.resolve(),\n            window.SP_USERS_DB.ensureSeed(),",
    "            window.SP_AREAS ? window.SP_AREAS.ensureSeed() : Promise.resolve(),\n            window.SP_PROFS ? window.SP_PROFS.ensureSeed() : Promise.resolve(),\n            window.SP_USERS_DB.ensureSeed(),",
    'ensureSeed online +SP_PROFS', 1),
    ("          window.SP_AREAS ? window.SP_AREAS.ensureSeed() : Promise.resolve(),\n          window.SP_USERS_DB.ensureSeed(),",
     "          window.SP_AREAS ? window.SP_AREAS.ensureSeed() : Promise.resolve(),\n          window.SP_PROFS ? window.SP_PROFS.ensureSeed() : Promise.resolve(),\n          window.SP_USERS_DB.ensureSeed(),",
     'ensureSeed offline +SP_PROFS', 1)])

# ============================== index.html ==============================
patch('/home/user/index.html', [(
    '<script src="root_index/areas_db.js"></script>\n<script src="root_index/work_db.js"></script>',
    '<script src="root_index/areas_db.js"></script>\n<script src="root_index/professions_db.js"></script>\n<script src="root_index/work_db.js"></script>',
    'script include professions_db.js', 1),
    ('<div id="build-marker" style="margin-top:12px;text-align:center;font-size:10.5px;color:#94a3b8">Сборка 22.09-85 · атрибуты ГРП: количество исполнителей + состав бригады (профессия, разряд, кол-во), бейдж 👥 в справочнике</div>',
     '<div id="build-marker" style="margin-top:12px;text-align:center;font-size:10.5px;color:#94a3b8">Сборка 22.09-86 · справочник «Профессии» (наименование + разряд 3–6) перед «Видами работ»; состав исполнителей ГРП — выбор строго из справочника</div>',
     'build-marker 22.09-86', 1)])

# ============================== app.js ==============================
PATCH = []

# --- 1. вкладки: «Профессии» перед «Виды работ» ---
PATCH.append((
    "var refsTabsHtml = '<div class=\"tabs\">' + tabBtn('tree', 'Виды работ') + tabBtn('norms', 'Нормы времени') + tabBtn('areas', 'Участки') + tabBtn('objects', 'Объекты (ГРП/ШРП/ГРС/ПГРП)') + '</div>';",
    "var refsTabsHtml = '<div class=\"tabs\">' + tabBtn('profs', 'Профессии') + tabBtn('tree', 'Виды работ') + tabBtn('norms', 'Нормы времени') + tabBtn('areas', 'Участки') + tabBtn('objects', 'Объекты (ГРП/ШРП/ГРС/ПГРП)') + '</div>';",
    'tabs +profs first', 1))

# --- 2. ветка рендера профессий ---
PATCH.append((
    """    var html = '';

    if (S.refsTab === 'areas') {""",
    """    var html = '';

    if (S.refsTab === 'profs') {
      html += renderProfsTab(admin, refsTabsHtml);
      view.innerHTML = html;
      return;
    }
    if (S.refsTab === 'areas') {""",
    'renderRefs branch profs', 1))

# --- 3. функции справочника профессий перед «УЧАСТКИ» ---
PATCH.append((
    """  /* =====================================================================
     СПРАВОЧНИК: УЧАСТКИ
     ===================================================================== */
  function renderAreasRefTab(admin, tabsHtml) {""",
    """  /* =====================================================================
     СПРАВОЧНИК: ПРОФЕССИИ (Сборка 22.09-86)
     ===================================================================== */
  function renderProfsTab(admin, tabsHtml) {
    var profs = window.SP_PROFS ? SP_PROFS.getAll() : [];
    profs.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'ru') || ((a.grade || 0) - (b.grade || 0)); });
    var html = '<div style="margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">';
    html += '<span class="sub" style="font-size:12px;color:var(--muted)">Всего профессий: ' + profs.length + '</span>';
    html += '<div style="flex:1"></div>';
    if (admin) html += '<button class="btn primary" data-action="new-prof">' + IC.plus + ' Добавить профессию</button>';
    html += '</div>';
    html += tabsHtml;
    html += '<div class="card"><table class="dt"><thead><tr><th>Наименование профессии</th><th>Разряд</th>' + (admin ? '<th style="text-align:right">Действия</th>' : '') + '</tr></thead><tbody>';
    if (!profs.length) html += '<tr><td colspan="' + (admin ? 3 : 2) + '" class="empty">Справочник профессий пуст. ' + (admin ? 'Нажмите «Добавить профессию».' : '') + '</td></tr>';
    profs.forEach(function (p) {
      html += '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(String(p.grade)) + ' разряд</td>';
      if (admin) html += '<td style="text-align:right;white-space:nowrap"><button class="btn sm" data-action="edit-prof" data-pid="' + esc(p.id) + '">Изменить</button> <button class="btn sm" data-action="del-prof" data-pid="' + esc(p.id) + '" style="color:var(--red)">Удалить</button></td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  // Модал добавления/изменения профессии: наименование + разряд (3–6)
  function openProfModal(mode, pid) {
    S.profModalMode = mode; S.profModalPid = pid || null;
    var p = (mode === 'edit' && window.SP_PROFS) ? SP_PROFS.getById(pid) : null;
    var html = '<div class="modal-h"><h3>' + (mode === 'edit' ? 'Изменение профессии' : 'Новая профессия') + '</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    html += '<div class="fld"><label>Наименование профессии</label><input id="pm-name" value="' + (p ? esc(p.name) : '') + '" placeholder="Например: Слесарь газоиспользующего оборудования"></div>';
    html += '<div class="fld"><label>Разряд</label><select id="pm-grade">';
    html += '<option value="">— выберите разряд —</option>';
    (window.SP_PROFS ? SP_PROFS.GRADES : [3, 4, 5, 6]).forEach(function (g) {
      html += '<option value="' + g + '"' + (p && p.grade === g ? ' selected' : '') + '>' + g + ' разряд</option>';
    });
    html += '</select></div>';
    html += '<div class="calc">ℹ️ Профессии применяются в составе исполнителей работ участка ГРП (выбор — только из этого справочника).</div>';
    html += '</div><div class="modal-f"><button class="btn" data-action="close-modal">Отмена</button><button class="btn primary" data-action="save-prof">' + (mode === 'edit' ? 'Сохранить' : 'Добавить профессию') + '</button></div>';
    modal.style.maxWidth = ''; // сброс автоширины карточки задачи
    modal.innerHTML = html; overlay.classList.add('show');
    var inp = document.getElementById('pm-name');
    if (inp) { inp.focus(); inp.select(); }
  }
  function saveProf() {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    var nEl = document.getElementById('pm-name');
    var gEl = document.getElementById('pm-grade');
    var res = (S.profModalMode === 'edit')
      ? SP_PROFS.updateProf(S.profModalPid, nEl ? nEl.value : '', gEl ? gEl.value : '')
      : SP_PROFS.addProf(nEl ? nEl.value : '', gEl ? gEl.value : '');
    if (!res.ok) { toast('err', res.error); return; }
    logAction(S.profModalMode === 'edit' ? 'Изменение профессии' : 'Добавление профессии', SP_PROFS.label(res.prof));
    toast('ok', S.profModalMode === 'edit' ? 'Профессия изменена' : 'Профессия «' + SP_PROFS.label(res.prof) + '» добавлена');
    overlay.classList.remove('show');
    refresh();
  }
  function delProfAction(pid) {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    if (!window.SP_PROFS) return;
    var p = SP_PROFS.getById(pid);
    if (!p) return;
    // Сколько работ ГРП ссылаются на профессию (по наименованию + разряду)
    var used = 0;
    try {
      (WORK.getWorks('ГРП') || []).forEach(function (w) {
        (w.crew || []).forEach(function (e) {
          if (e && e.prof === p.name && String(e.grade || '') === String(p.grade)) used++;
        });
      });
    } catch (e) {}
    var msg = 'Удалить профессию «' + SP_PROFS.label(p) + '» из справочника?';
    if (used) msg += '\\n\\n⚠️ Она указана в составе исполнителей ' + used + (used === 1 ? ' работы' : ' работ') + ' ГРП — там останется пометка «⚠ нет в справочнике».';
    if (!window.confirm(msg)) return;
    SP_PROFS.deleteProf(pid);
    logAction('Удаление профессии', SP_PROFS.label(p));
    toast('ok', 'Профессия удалена');
    refresh();
  }

  /* =====================================================================
     СПРАВОЧНИК: УЧАСТКИ
     ===================================================================== */
  function renderAreasRefTab(admin, tabsHtml) {""",
    'profs tab + modal functions', 1))

# --- 4. диспетчер: действия профессий ---
PATCH.append((
    "    else if (a === 'save-area') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } saveArea(); }",
    """    else if (a === 'save-area') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } saveArea(); }
    // --- Справочник: профессии (Сборка 22.09-86) ---
    else if (a === 'new-prof') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } openProfModal('new'); }
    else if (a === 'edit-prof') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } openProfModal('edit', el.dataset.pid); }
    else if (a === 'del-prof') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } delProfAction(el.dataset.pid); }
    else if (a === 'save-prof') { if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; } saveProf(); }""",
    'dispatcher +prof actions', 1))

# --- 5. строгий выбор: crewProfSuggestions/CREW_PROF_DEFAULTS → crewProfOptions; crewRowHtml — select ---
old_helpers = """  var CREW_PROF_DEFAULTS = ['Слесарь газоиспользующего оборудования', 'Электрогазосварщик', 'Наладчик КИПиА', 'Машинист экскаватора', 'Водитель автомобиля'];
  function crewProfSuggestions() {
    var out = CREW_PROF_DEFAULTS.slice();
    try {
      if (window.WORK && WORK.getWorks) {
        WORK.getWorks('ГРП').forEach(function (w2) {
          (w2.crew || []).forEach(function (e) { if (e && e.prof && out.indexOf(e.prof) < 0) out.push(e.prof); });
        });
      }
    } catch (e) {}
    return out;
  }
  function crewRowHtml(it) {
    it = it || {};
    var h = '<div data-crew-row style="display:flex;gap:6px;align-items:center;margin-bottom:5px">';
    h += '<input data-crew-prof list="wm-prof-dl" value="' + esc(it.prof || '') + '" placeholder="Профессия…" style="flex:1;min-width:140px">';
    h += '<select data-crew-grade style="width:112px">';
    h += '<option value="">без разряда</option>';
    ['2', '3', '4', '5', '6', '7', '8'].forEach(function (g) { h += '<option value="' + g + '"' + (String(it.grade || '') === g ? ' selected' : '') + '>' + g + ' разряд</option>'; });
    h += '</select>';
    h += '<input data-crew-count type="number" min="0" step="1" value="' + (it.count != null ? it.count : 1) + '" style="width:60px" title="Количество работников этой профессии">';
    h += '<button type="button" data-crew-rm class="btn sm" style="color:var(--red);padding:2px 9px" title="Убрать строку">✕</button>';
    h += '</div>';
    return h;
  }"""
new_helpers = """  // Профессия + разряд упакованы в value через \\u0001 (Сборка 22.09-86: выбор СТРОГО из справочника «Профессии»)
  function crewProfOptions(cur) {
    var list = [];
    try { if (window.SP_PROFS && SP_PROFS.getAll) list = SP_PROFS.getAll(); } catch (e) {}
    list = list.slice().sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'ru') || ((a.grade || 0) - (b.grade || 0)); });
    var h = '', found = false;
    list.forEach(function (p) {
      var v = p.name + '\\u0001' + p.grade;
      var on = cur && cur.prof === p.name && String(cur.grade || '') === String(p.grade);
      if (on) found = true;
      h += '<option value="' + esc(v) + '"' + (on ? ' selected' : '') + '>' + esc(p.name) + ' — ' + p.grade + ' разряд</option>';
    });
    // Значение из старых данных, которого уже нет в справочнике — показываем с пометкой
    if (cur && cur.prof && !found) {
      h += '<option value="' + esc(cur.prof + '\\u0001' + (cur.grade || '')) + '" selected>⚠ ' + esc(cur.prof) + (cur.grade ? ' — ' + esc(String(cur.grade)) + ' разряд' : '') + ' (нет в справочнике)</option>';
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
  }"""
PATCH.append((old_helpers, new_helpers, 'crew helpers strict select', 1))

# --- 6. crewCollect: распаковка select + пропуск строк без профессии ---
old_collect = """  function crewCollect() {
    var out = [];
    document.querySelectorAll('#wm-crew-rows [data-crew-row]').forEach(function (row) {
      var pEl = row.querySelector('[data-crew-prof]');
      var gEl = row.querySelector('[data-crew-grade]');
      var cEl = row.querySelector('[data-crew-count]');
      var cnt = cEl ? parseInt(cEl.value, 10) : 0;
      if (!isFinite(cnt) || cnt < 0) cnt = 0;
      var it = { prof: pEl ? pEl.value.trim() : '', grade: gEl ? gEl.value : '', count: cnt };
      if (it.prof || it.count) out.push(it);
    });
    return out;
  }"""
new_collect = """  function crewCollect() {
    var out = [];
    var skipped = 0;
    document.querySelectorAll('#wm-crew-rows [data-crew-row]').forEach(function (row) {
      var pEl = row.querySelector('[data-crew-prof]');
      var cEl = row.querySelector('[data-crew-count]');
      var cnt = cEl ? parseInt(cEl.value, 10) : 0;
      if (!isFinite(cnt) || cnt < 0) cnt = 0;
      var raw = pEl ? String(pEl.value || '') : '';
      var sepAt = raw.indexOf('\\u0001');
      var it = sepAt >= 0
        ? { prof: raw.slice(0, sepAt), grade: raw.slice(sepAt + 1), count: cnt }
        : { prof: raw, grade: '', count: cnt };
      if (!it.prof && it.count > 0) skipped++;
      if (it.prof) out.push(it);
    });
    out.skipped = skipped; // строки с количеством, но без профессии — не сохраняются, предупредим
    return out;
  }"""
PATCH.append((old_collect, new_collect, 'crewCollect strict', 1))

# --- 7. разметка модалки: подпись, заметка о пустом справочнике, убрать datalist ---
old_markup = """    h += '<div style="font-size:11.5px;font-weight:600;color:#475569;margin-bottom:5px">Работники будут: <span style="color:#94a3b8;font-weight:500">(профессия — разряд — количество)</span></div>';
    h += '<div id="wm-crew-rows"></div>';
    h += '<div style="display:flex;gap:12px;align-items:center;margin-top:4px;flex-wrap:wrap">';"""
new_markup = """    h += '<div style="font-size:11.5px;font-weight:600;color:#475569;margin-bottom:5px">Работники будут: <span style="color:#94a3b8;font-weight:500">(профессия из справочника «Профессии» — количество)</span></div>';
    h += '<div id="wm-crew-rows"></div>';
    var crewProfsCount = 0;
    try { if (window.SP_PROFS && SP_PROFS.getAll) crewProfsCount = SP_PROFS.getAll().length; } catch (e) {}
    if (!crewProfsCount) h += '<div style="font-size:11.5px;color:#92400e;background:#fef9c3;border:1px solid #fde68a;border-radius:6px;padding:6px 9px;margin:2px 0 6px">⚠️ Справочник «Профессии» пока пуст — сначала добавьте профессии: «Справочники» → «Профессии».</div>';
    h += '<div style="display:flex;gap:12px;align-items:center;margin-top:4px;flex-wrap:wrap">';"""
PATCH.append((old_markup, new_markup, 'modal label + empty-profs note', 1))

PATCH.append((
    """    h += '<datalist id="wm-prof-dl">' + crewProfSuggestions().map(function (p) { return '<option value="' + esc(p) + '">'; }).join('') + '</datalist>';
""",
    "",
    'remove datalist', 1))

# --- 8. saveWork: предупреждение о пропущенных строках ---
PATCH.append((
    """      data.crew = crewCollect();
      data.crew_size = parseInt(val('wm-crew-size'), 10);""",
    """      data.crew = crewCollect();
      if (data.crew.skipped) toast('warn', '⚠️ Строк с количеством, но без профессии не сохранено: ' + data.crew.skipped);
      data.crew_size = parseInt(val('wm-crew-size'), 10);""",
    'saveWork skipped warning', 1))

# --- 9. маркер ---
PATCH.append((
    "    objmap: ['Карта объектов', 'Сборка 22.09-85 · атрибуты ГРП: количество исполнителей + состав бригады по профессиям (разряд, кол-во), подсказка «распределено X из N»'],",
    "    objmap: ['Карта объектов', 'Сборка 22.09-86 · справочник «Профессии» перед «Видами работ» (наименование + разряд 3–6); состав исполнителей ГРП — выбор строго из справочника'],",
    'app marker 22.09-86', 1))

patch('/home/user/root_index/app.js', PATCH)
print('ALL PATCHES OK')
