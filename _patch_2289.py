# -*- coding: utf-8 -*-
"""Сборка 22.09-89: карточка профессии — название из выпадающего списка (стандартные + вручную
добавленные, удаление из списка, антидубли) или вручную; разряд стал необязательным («без разряда»)."""
import io

def patch(path, pairs):
    with io.open(path, encoding='utf-8') as f:
        code = f.read()
    for old, new, tag, exp in pairs:
        cnt = code.count(old)
        assert cnt == exp, '%s: anchor count=%d (expected %d) for %r' % (path, cnt, exp, tag)
        code = code.replace(old, new)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print('patched', path)

# ============================== sync_polling.js ==============================
patch('/home/user/root_index/sync_polling.js', [(
    """    if (sec === 'professions') {
      // { schema: 1, professions: [{id, name, grade, ...}, ...] } — как участки (Сборка 22.09-86)
      var curP = lsRead(lsKey);
      if (!curP || typeof curP !== 'object') curP = { schema: 1, professions: [] };
      if (!Array.isArray(curP.professions)) curP.professions = [];
      var idxP = -1;
      for (var kp = 0; kp < curP.professions.length; kp++) {
        if (curP.professions[kp] && curP.professions[kp].id === rec.id) { idxP = kp; break; }
      }
      if (rec._deleted) {
        if (idxP >= 0) curP.professions.splice(idxP, 1);
      } else {
        if (idxP >= 0) curP.professions[idxP] = data;
        else curP.professions.push(data);
      }
      curP.schema = 1;
      curP.updated_at = Date.now();
      lsWrite(lsKey, curP);
      return true;
    }""",
    """    if (sec === 'professions') {
      // { schema: 1, professions: [...], profNames: [...] } (Сборка 22.09-86/89)
      // kind:'prof_name' → названия списка-подсказки; иначе → записи справочника.
      var curP = lsRead(lsKey);
      if (!curP || typeof curP !== 'object') curP = { schema: 1, professions: [], profNames: [] };
      if (!Array.isArray(curP.professions)) curP.professions = [];
      if (!Array.isArray(curP.profNames)) curP.profNames = [];
      var arrP = (data.kind === 'prof_name') ? curP.profNames : curP.professions;
      var idxP = -1;
      for (var kp = 0; kp < arrP.length; kp++) {
        if (arrP[kp] && arrP[kp].id === rec.id) { idxP = kp; break; }
      }
      if (rec._deleted) {
        if (idxP >= 0) arrP.splice(idxP, 1);
      } else {
        if (idxP >= 0) arrP[idxP] = data;
        else arrP.push(data);
      }
      curP.schema = 1;
      curP.updated_at = Date.now();
      lsWrite(lsKey, curP);
      return true;
    }""",
    'applyOne professions +profNames', 1)])

# ============================== app.js ==============================
PATCH = []

# --- 1. таблица: «без разряда» ---
PATCH.append((
    """      html += '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(String(p.grade)) + ' разряд</td>';""",
    """      html += '<tr><td><b>' + esc(p.name) + '</b></td><td>' + (p.grade ? esc(String(p.grade)) + ' разряд' : '<span style="color:#94a3b8">без разряда</span>') + '</td>';""",
    'table grade optional', 1))

# --- 2. crewProfOptions: подпись без разряда ---
PATCH.append((
    """      h += '<option value="' + esc(v) + '"' + (on ? ' selected' : '') + '>' + esc(p.name) + ' — ' + p.grade + ' разряд</option>';""",
    """      h += '<option value="' + esc(v) + '"' + (on ? ' selected' : '') + '>' + esc(p.name) + (p.grade ? ' — ' + p.grade + ' разряд' : '') + '</option>';""",
    'crewOptions label no-grade', 1))

# --- 3. openProfModal: выпадающий список + удаление из списка + разряд необязателен ---
PATCH.append((
    """  function openProfModal(mode, pid) {
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
    if (inp) { inp.focus(); inp.select(); }""",
    """  // Список названий для выпадающего списка карточки профессии (Сборка 22.09-89)
  function profNameListOptionsHtml() {
    var names = [];
    try { if (window.SP_PROFS && SP_PROFS.getNameList) names = SP_PROFS.getNameList(); } catch (e) {}
    return names.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
  }
  function openProfModal(mode, pid) {
    S.profModalMode = mode; S.profModalPid = pid || null;
    var p = (mode === 'edit' && window.SP_PROFS) ? SP_PROFS.getById(pid) : null;
    var html = '<div class="modal-h"><h3>' + (mode === 'edit' ? 'Изменение профессии' : 'Новая профессия') + '</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    html += '<div class="fld"><label>Наименование профессии</label>';
    html += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">';
    html += '<select id="pm-name-list" style="flex:1"><option value="">— выбрать из списка —</option>' + profNameListOptionsHtml() + '</select>';
    if (mode !== 'edit') html += '<button type="button" id="pm-namedel" class="btn sm" style="color:var(--red);padding:5px 10px;white-space:nowrap" title="Удалить выбранное название из списка">🗑 Удалить</button>';
    html += '</div>';
    html += '<input id="pm-name" value="' + (p ? esc(p.name) : '') + '" placeholder="…или впишите вручную, напр.: Слесарь газоиспользующего оборудования"></div>';
    html += '<div class="fld"><label>Разряд <span style="color:#94a3b8;font-weight:500">(необязательно)</span></label><select id="pm-grade">';
    html += '<option value=""' + (p && !p.grade ? ' selected' : '') + '>без разряда</option>';
    (window.SP_PROFS ? SP_PROFS.GRADES : [3, 4, 5, 6]).forEach(function (g) {
      html += '<option value="' + g + '"' + (p && p.grade === g ? ' selected' : '') + '>' + g + ' разряд</option>';
    });
    html += '</select></div>';
    html += '<div class="calc">ℹ️ Профессии применяются в составе исполнителей работ участка ГРП. Название можно выбрать из списка или вписать вручную — вписанное запомнится в списке.</div>';
    html += '</div><div class="modal-f"><button class="btn" data-action="close-modal">Отмена</button><button class="btn primary" data-action="save-prof">' + (mode === 'edit' ? 'Сохранить' : 'Добавить профессию') + '</button></div>';
    modal.style.maxWidth = ''; // сброс автоширины карточки задачи
    modal.innerHTML = html; overlay.classList.add('show');
    var listEl = document.getElementById('pm-name-list');
    var nameEl = document.getElementById('pm-name');
    if (listEl && nameEl) listEl.addEventListener('change', function () {
      if (listEl.value) nameEl.value = listEl.value;
      nameEl.focus(); nameEl.select();
    });
    var delNameBtn = document.getElementById('pm-namedel');
    if (delNameBtn) delNameBtn.addEventListener('click', function () { delProfNameFromModal(); });
    if (nameEl) { nameEl.focus(); nameEl.select(); }""",
    'openProfModal dropdown', 1))

# --- 4. удаление названия из выпадающего списка (перед saveProf) ---
PATCH.append((
    "  function saveProf() {",
    """  // Удалить выбранное название из выпадающего списка (Сборка 22.09-89).
  // Если в справочнике есть записи с этим названием — удаляются и они (с подтверждением),
  // иначе название всё равно осталось бы видно через них.
  function delProfNameFromModal() {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    var listEl = document.getElementById('pm-name-list');
    var name = listEl ? listEl.value : '';
    if (!name) { toast('warn', 'Сначала выберите название в списке'); return; }
    if (!window.SP_PROFS) return;
    var entries = SP_PROFS.getAll().filter(function (p) { return p.name === name; });
    var msg;
    if (entries.length) {
      // есть записи справочника — предупреждаем и считаем использование в работах ГРП
      var used = 0;
      try {
        (WORK.getWorks('ГРП') || []).forEach(function (w) {
          (w.crew || []).forEach(function (e) { if (e && e.prof === name) used++; });
        });
      } catch (e) {}
      msg = 'Удалить название «' + name + '» из списка вместе с ' + entries.length +
        (entries.length === 1 ? ' записью' : ' записями') + ' справочника?';
      if (used) msg += '\\n\\n⚠️ Оно указано в составе исполнителей ' + used + (used === 1 ? ' работы' : ' работ') + ' ГРП — там останется пометка «⚠ нет в справочнике».';
    } else {
      msg = 'Убрать название «' + name + '» из списка?';
    }
    if (!window.confirm(msg)) return;
    SP_PROFS.deleteProfNameByName(name);
    entries.forEach(function (e2) { SP_PROFS.deleteProf(e2.id); });
    logAction('Удаление названия профессии из списка', name);
    toast('ok', entries.length ? 'Название и записи справочника удалены' : 'Название убрано из списка');
    // перерисовать сам выпадающий список (оставаясь в карточке)
    if (listEl) listEl.innerHTML = '<option value="">— выбрать из списка —</option>' + profNameListOptionsHtml();
  }
  function saveProf() {""",
    'delProfNameFromModal', 1))

# --- 5. saveProf: запомнить вписанное вручную название ---
PATCH.append((
    """    if (!res.ok) { toast('err', res.error); return; }
    logAction(S.profModalMode === 'edit' ? 'Изменение профессии' : 'Добавление профессии', SP_PROFS.label(res.prof));""",
    """    if (!res.ok) { toast('err', res.error); return; }
    try { if (res.prof && res.prof.name && SP_PROFS.addProfName) SP_PROFS.addProfName(res.prof.name); } catch (e) {}
    logAction(S.profModalMode === 'edit' ? 'Изменение профессии' : 'Добавление профессии', SP_PROFS.label(res.prof));""",
    'saveProf remember name', 1))

# --- 6. маркер ---
PATCH.append((
    "    objmap: ['Карта объектов', 'Сборка 22.09-88 · нормы ГРП встроены в приложение: 112 видов работ + 8 профессий из «Сопоставление видов работ и норма времени»'],",
    "    objmap: ['Карта объектов', 'Сборка 22.09-89 · профессии: название из выпадающего списка (стандартные + свои, с удалением) или вручную; разряд необязателен («без разряда»)'],",
    'app marker 22.09-89', 1))

patch('/home/user/root_index/app.js', PATCH)

# ============================== index.html ==============================
patch('/home/user/index.html', [(
    '<div id="build-marker" style="margin-top:12px;text-align:center;font-size:10.5px;color:#94a3b8">Сборка 22.09-88 · нормы ГРП встроены: 112 видов работ и 8 профессий появятся на ГРП сразу после обновления</div>',
    '<div id="build-marker" style="margin-top:12px;text-align:center;font-size:10.5px;color:#94a3b8">Сборка 22.09-89 · профессии: название из выпадающего списка или вручную, удаление из списка, «без разряда»</div>',
    'index marker 22.09-89', 1)])

print('ALL PATCHES OK')
