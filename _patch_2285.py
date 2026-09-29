# -*- coding: utf-8 -*-
"""Сборка 22.09-85: атрибуты ГРП — количество исполнителей + состав по профессиям."""
import io, sys

def patch(path, pairs):
    with io.open(path, encoding='utf-8') as f:
        code = f.read()
    for old, new, tag in pairs:
        cnt = code.count(old)
        assert cnt == 1, '%s: anchor count=%d for %r' % (path, cnt, tag)
        code = code.replace(old, new, 1)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print('patched', path)

# ============================== work_db.js ==============================
PATCH_DB = []

old_defaults = '''      op_journal:           false,       // запись в оперативном журнале
      passport_entry:       false,       // запись в эксплуатационном паспорте
      scan_attach:          false        // присоединение сканов
    };'''
new_defaults = '''      op_journal:           false,       // запись в оперативном журнале
      passport_entry:       false,       // запись в эксплуатационном паспорте
      scan_attach:          false,       // присоединение сканов
      crew_size:            0,           // количество исполнителей (общее) — Сборка 22.09-85
      crew:                 []           // состав: [{prof:'...', grade:'3', count:2}]
    };'''
PATCH_DB.append((old_defaults, new_defaults, '_newAttrDefaults + crew'))

old_bool = """    function toBool(v) { return v === true || v === 'true' || v === 'on' || v === '1' || v === 1; }
    function toNum(v, dflt) { var n = parseFloat(v); return isFinite(n) ? n : (dflt != null ? dflt : 0); }"""
new_bool = """    function toBool(v) { return v === true || v === 'true' || v === 'on' || v === '1' || v === 1; }
    function toNum(v, dflt) { var n = parseFloat(v); return isFinite(n) ? n : (dflt != null ? dflt : 0); }
    // Сборка 22.09-85: состав исполнителей [{prof, grade, count}]
    function toCrew(v) {
      var arr = [];
      if (v == null || v === '') return arr;
      if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return arr; } }
      if (!Array.isArray(v)) return arr;
      v.forEach(function (e) {
        if (!e) return;
        if (typeof e === 'string') e = { prof: e, grade: '', count: 1 };
        var cnt = parseInt(e.count, 10);
        var it = {
          prof: String(e.prof != null ? e.prof : '').trim(),
          grade: String(e.grade != null ? e.grade : '').replace(/[^0-9]/g, ''),
          count: isFinite(cnt) && cnt > 0 ? cnt : 0
        };
        if (it.prof || it.count) arr.push(it);
      });
      return arr;
    }"""
PATCH_DB.append((old_bool, new_bool, '_parseNewAttrs toCrew helper'))

old_ret = """      op_journal:              toBool(d.op_journal),
      passport_entry:          toBool(d.passport_entry),
      scan_attach:             toBool(d.scan_attach)
    };"""
new_ret = """      op_journal:              toBool(d.op_journal),
      passport_entry:          toBool(d.passport_entry),
      scan_attach:             toBool(d.scan_attach),
      crew_size:               Math.max(0, Math.round(toNum(d.crew_size, 0))),
      crew:                    toCrew(d.crew)
    };"""
PATCH_DB.append((old_ret, new_ret, '_parseNewAttrs return +crew'))

patch('/home/user/root_index/work_db.js', PATCH_DB)

# ============================== app.js ==============================
PATCH_APP = []

# --- 1. helpers before openWorkModal ---
old_mw = '  function openWorkModal(mode, wid) {'
new_mw = '''  // === Исполнители ГРП: общее количество + состав бригады (Сборка 22.09-85) ===
  // Хранится в виде работы: crew_size (число) и crew [{prof, grade, count}].
  var CREW_PROF_DEFAULTS = ['Слесарь газоиспользующего оборудования', 'Электрогазосварщик', 'Наладчик КИПиА', 'Машинист экскаватора', 'Водитель автомобиля'];
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
  }

  function openWorkModal(mode, wid) {'''
PATCH_APP.append((old_mw, new_mw, 'crew helpers + openWorkModal'))

# --- 2. crew UI inside ГРП block, after the norms-time note ---
old_note = '''    h += '<div class="fld" style="background:#f8fafc;border:1px dashed var(--line);border-radius:6px;padding:8px 10px;font-size:11.5px;color:#475569;">';
    h += '<b style="color:#0f2740">📊 Нормы времени</b> — связаны со справочником «Нормы времени». Поле «Норма времени, ч» (выше) — значение по умолчанию.';
    h += '</div>';'''
new_note = '''    h += '<div class="fld" style="background:#f8fafc;border:1px dashed var(--line);border-radius:6px;padding:8px 10px;font-size:11.5px;color:#475569;">';
    h += '<b style="color:#0f2740">📊 Нормы времени</b> — связаны со справочником «Нормы времени». Поле «Норма времени, ч» (выше) — значение по умолчанию.';
    h += '</div>';

    // 8.5. Исполнители: общее количество + состав бригады по профессиям (Сборка 22.09-85)
    h += '<div class="fld" style="background:#fff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px">';
    h += '<label style="font-size:12px;font-weight:700;color:#1e3a8a;margin-bottom:8px;display:block">👷 Количество исполнителей и состав бригады</label>';
    h += '<label style="font-size:11.5px;font-weight:600;color:#475569">Количество исполнителей (общее)</label>';
    h += '<input id="wm-crew-size" type="number" min="0" step="1" value="' + ((w && w.crew_size) || 0) + '" placeholder="напр.: 3" style="width:120px;margin:2px 0 8px">';
    h += '<div style="font-size:11.5px;font-weight:600;color:#475569;margin-bottom:5px">Работники будут: <span style="color:#94a3b8;font-weight:500">(профессия — разряд — количество)</span></div>';
    h += '<div id="wm-crew-rows"></div>';
    h += '<div style="display:flex;gap:12px;align-items:center;margin-top:4px;flex-wrap:wrap">';
    h += '<button type="button" id="wm-crew-add" class="btn sm" style="border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;font-weight:600">＋ Добавить профессию</button>';
    h += '<span id="wm-crew-hint" style="font-size:11.5px;font-weight:600"></span>';
    h += '</div>';
    h += '<datalist id="wm-prof-dl">' + crewProfSuggestions().map(function (p) { return '<option value="' + esc(p) + '">'; }).join('') + '</datalist>';
    h += '</div>';'''
PATCH_APP.append((old_note, new_note, 'crew UI in modal'))

# --- 3. init crew editor after modal render ---
old_open = '''    modal.innerHTML = h; overlay.classList.add('show');
    S.workModalMode = mode; S.workModalWid = wid;
  }
  function saveWork() {'''
new_open = '''    modal.innerHTML = h; overlay.classList.add('show');
    S.workModalMode = mode; S.workModalWid = wid;
    if (area === 'ГРП') initCrewEditor(w && w.crew, (w && w.crew_size) || 0);
  }
  function saveWork() {'''
PATCH_APP.append((old_open, new_open, 'initCrewEditor call'))

# --- 4. saveWork: collect crew (area ГРП) ---
old_save = '''      data.op_journal = chk('wm-opjournal');
      data.passport_entry = chk('wm-passport');
      data.scan_attach = chk('wm-scanattach');
    } else if (oldW) {'''
new_save = '''      data.op_journal = chk('wm-opjournal');
      data.passport_entry = chk('wm-passport');
      data.scan_attach = chk('wm-scanattach');
      // Сборка 22.09-85: исполнители — общее количество + состав по профессиям
      data.crew = crewCollect();
      data.crew_size = parseInt(val('wm-crew-size'), 10);
      if (!isFinite(data.crew_size) || data.crew_size < 0) data.crew_size = 0;
      var crewSum = data.crew.reduce(function (a, e) { return a + (e.count || 0); }, 0);
      if (data.crew_size > 0) { data.min_workers = data.crew_size; data.opt_workers = data.crew_size; }
      if (data.crew_size > 0 && crewSum !== data.crew_size) {
        toast('warn', '⚠️ Состав исполнителей (' + crewSum + ') не совпадает с общим количеством (' + data.crew_size + ')');
      }
    } else if (oldW) {'''
PATCH_APP.append((old_save, new_save, 'saveWork crew collect'))

# --- 5. preserve crew keys on other areas ---
old_keys = """      ['object_categories', 'departments', 'periodicity_value', 'periodicity_unit',
        'periodicity_depends_on', 'periodicity_basis', 'joint_with', 'operations',
        'indicators', 'print_forms', 'op_journal', 'passport_entry', 'scan_attach']
        .forEach(function (k) { if (oldW[k] !== undefined) data[k] = oldW[k]; });"""
new_keys = """      ['object_categories', 'departments', 'periodicity_value', 'periodicity_unit',
        'periodicity_depends_on', 'periodicity_basis', 'joint_with', 'operations',
        'indicators', 'print_forms', 'op_journal', 'passport_entry', 'scan_attach',
        'crew_size', 'crew']
        .forEach(function (k) { if (oldW[k] !== undefined) data[k] = oldW[k]; });"""
PATCH_APP.append((old_keys, new_keys, 'preserve list +crew'))

# --- 6. badge in refs tree ---
old_badge = """          if (w.joint_with) attr += ' <span class="snow-badge" title="Проводится совместно">🤝 совместно</span>';"""
new_badge = """          if (w.joint_with) attr += ' <span class="snow-badge" title="Проводится совместно">🤝 совместно</span>';
          // Сборка 22.09-85: бейдж исполнителей (общее число + состав в подсказке)
          if (w.crew_size) {
            var crewDesc = (w.crew || []).filter(function (e) { return e && e.prof; })
              .map(function (e) { return e.prof + (e.grade ? ' · ' + e.grade + ' разряд' : '') + ' × ' + e.count; }).join('; ');
            attr += ' <span class="permit-badge" title="Исполнители — ' + w.crew_size + ' чел.' + (crewDesc ? ': ' + esc(crewDesc) : '') + '">👥 ' + w.crew_size + '</span>';
          }"""
PATCH_APP.append((old_badge, new_badge, 'refs tree crew badge'))

# --- 7. marker ---
old_mk = """    objmap: ['Карта объектов', 'Сборка 22.09-84 · атрибуты карточки работы только у своего участка: УБиРОГС — свой блок, ГРП — «Атрибуты ГРП», у остальных без атрибутов'],"""
new_mk = """    objmap: ['Карта объектов', 'Сборка 22.09-85 · атрибуты ГРП: количество исполнителей + состав бригады по профессиям (разряд, кол-во), подсказка «распределено X из N»'],"""
PATCH_APP.append((old_mk, new_mk, 'app marker 22.09-85'))

patch('/home/user/root_index/app.js', PATCH_APP)

# ============================== index.html ==============================
PATCH_HTML = []
old_hmk = """<div id="build-marker" style="margin-top:12px;text-align:center;font-size:10.5px;color:#94a3b8">Сборка 22.09-84 · карточка работы: атрибуты только у своего участка — ⚙️ у УБиРОГС, 📋 «Атрибуты ГРП» у ГРП, у остальных без атрибутов</div>"""
new_hmk = """<div id="build-marker" style="margin-top:12px;text-align:center;font-size:10.5px;color:#94a3b8">Сборка 22.09-85 · атрибуты ГРП: количество исполнителей + состав бригады (профессия, разряд, кол-во), бейдж 👥 в справочнике</div>"""
PATCH_HTML.append((old_hmk, new_hmk, 'index marker'))
patch('/home/user/index.html', PATCH_HTML)

print('ALL PATCHES OK')
