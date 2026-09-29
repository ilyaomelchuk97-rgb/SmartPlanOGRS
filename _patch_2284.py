#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""22.09-84: атрибуты в карточке работы — только у своего участка.
- Блок «⚙️ Атрибуты УБиРОГС» (ордер/снег/температура/сезон/техника/исполнители)
  рендерится ТОЛЬКО для участка «УБиРОГС».
- Блок «📋 Атрибуты (по справочнику УБиРОГС)» (категории/периодичность/печатные формы и т.д.)
  рендерится ТОЛЬКО для участка «ГРП» и переименован в «📋 Атрибуты ГРП».
- У остальных участков атрибутных блоков нет (впереди — свои блоки у каждого).
- saveWork: на несоответствующих участках атрибуты НЕ затираются — при правке
  сохраняются старые значения, при создании — дефолты/пропуск.
- work_db.updateWork: ключи новых атрибутов пишем только если они переданы
  (!== undefined) — страховка от затирания.
- Маркер сборки 22.09-84.
"""
import io, re

APP = '/home/user/root_index/app.js'
WDB = '/home/user/root_index/work_db.js'
IDX = '/home/user/index.html'

src = io.open(APP, encoding='utf-8').read()

def rep(old, new, tag):
    global src
    assert src.count(old) == 1, '%s: matches=%d' % (tag, src.count(old))
    src = src.replace(old, new)
    print('OK:', tag)

# ---------- 1) Блок «Атрибуты УБиРОГС» — только для участка УБиРОГС ----------
rep(
    "    // Атрибуты УБиРОГС\n    h += '<div style=\"background:var(--panel-2);border:1px solid var(--line);border-radius:8px;padding:12px;margin-bottom:14px;\">';",
    "    // 22.09-84: блок «Атрибуты УБиРОГС» — ТОЛЬКО для участка УБиРОГС.\n    // Для ГРП ниже свой блок «Атрибуты ГРП», у остальных — пока нет атрибутов.\n    if (area === 'УБиРОГС') {\n    h += '<div style=\"background:var(--panel-2);border:1px solid var(--line);border-radius:8px;padding:12px;margin-bottom:14px;\">';",
    'block1-open'
)
rep(
    "    h += '</div>';\n\n    // === Атрибуты по «4 Атрибуты видов работ.htm» (Сборка 22.09-29) ===\n    h += '<div style=\"background:#eef6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin-bottom:14px;\">';",
    "    h += '</div>';\n    } // if (area === 'УБиРОГС')\n\n    // === Атрибуты по «4 Атрибуты видов работ.htm» (Сборка 22.09-29) ===\n    // 22.09-84: этот блок — ТОЛЬКО для участка ГРП\n    if (area === 'ГРП') {\n    h += '<div style=\"background:#eef6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin-bottom:14px;\">';",
    'block2-open'
)
rep(
    "    h += '<div style=\"font-size:12px;font-weight:700;color:#1d4ed8;margin-bottom:10px;\">📋 Атрибуты (по справочнику УБиРОГС)</div>';",
    "    h += '<div style=\"font-size:12px;font-weight:700;color:#1d4ed8;margin-bottom:10px;\">📋 Атрибуты ГРП</div>';",
    'block2-title'
)
# Закрываем if после последнего поля блока-2 (scanattach + закрытие панели)
rep(
    "    h += '<div class=\"fld\"><label class=\"cb\"><input type=\"checkbox\" id=\"wm-scanattach\" ' + (w && w.scan_attach ? 'checked' : '') + '> Присоединение отсканированных подписанных документов</label></div>';\n\n    h += '</div>';\n\n    h += '</div><div class=\"modal-f\">",
    "    h += '<div class=\"fld\"><label class=\"cb\"><input type=\"checkbox\" id=\"wm-scanattach\" ' + (w && w.scan_attach ? 'checked' : '') + '> Присоединение отсканированных подписанных документов</label></div>';\n\n    h += '</div>';\n    } // if (area === 'ГРП')\n\n    h += '</div><div class=\"modal-f\">",
    'block2-close'
)

# ---------- 2) saveWork: атрибуты — только по своему участку, без затирания ----------
old_data = """    var data = {
      group: val('wm-group') || 'Без группы', name: name, norm: val('wm-norm'), unit: val('wm-unit'),
      needs_permit: chk('wm-permit'), depends_on_snow: chk('wm-snow'),
      min_temp: parseFloat(val('wm-temp')) || -50, season: val('wm-season'),
      equipment: val('wm-equip') || '—', min_workers: parseInt(val('wm-minw')) || 1, opt_workers: parseInt(val('wm-optw')) || 2,
      // === Атрибуты по «4 Атрибуты видов работ.htm» ===
      object_categories:      arrFromAttr('cat'),
      departments:            arrFromAttr('dep'),
      periodicity_value:      parseInt(val('wm-period-value')) || 0,
      periodicity_unit:       val('wm-period-unit') || 'мес',
      periodicity_depends_on: arrFromAttr('perioddep'),
      periodicity_basis:      val('wm-period-basis') || 'prev_date',
      joint_with:             val('wm-joint'),
      operations:             val('wm-operations').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      indicators:             val('wm-indicators').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      print_forms:            val('wm-printforms').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      op_journal:             chk('wm-opjournal'),
      passport_entry:         chk('wm-passport'),
      scan_attach:            chk('wm-scanattach')
    };"""
new_data = """    var data = {
      group: val('wm-group') || 'Без группы', name: name, norm: val('wm-norm'), unit: val('wm-unit')
    };
    // 22.09-84: атрибутные блоки — только у своего участка. На чужих участках
    // поля НЕ РЕНДЕРЯТСЯ, поэтому при ПРАВКЕ сохраняем старые значения (иначе
    // бы затёрлись дефолтами), при СОЗДАНИИ — дефолтные.
    var oldW = (mode === 'edit' && wid) ? WORK.getWork(area, wid) : null;
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
      data.periodicity_value = parseInt(val('wm-period-value')) || 0;
      data.periodicity_unit = val('wm-period-unit') || 'мес';
      data.periodicity_depends_on = arrFromAttr('perioddep');
      data.periodicity_basis = val('wm-period-basis') || 'prev_date';
      data.joint_with = val('wm-joint');
      data.operations = val('wm-operations').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      data.indicators = val('wm-indicators').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      data.print_forms = val('wm-printforms').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      data.op_journal = chk('wm-opjournal');
      data.passport_entry = chk('wm-passport');
      data.scan_attach = chk('wm-scanattach');
    } else if (oldW) {
      ['object_categories', 'departments', 'periodicity_value', 'periodicity_unit',
        'periodicity_depends_on', 'periodicity_basis', 'joint_with', 'operations',
        'indicators', 'print_forms', 'op_journal', 'passport_entry', 'scan_attach']
        .forEach(function (k) { if (oldW[k] !== undefined) data[k] = oldW[k]; });
    } // при создании на прочих участках — пропуск: work_db сам поставит дефолты"""
rep(old_data, new_data, 'saveWork-data')

# ---------- 3) build-marker ----------
rep(
    "    objmap: ['Карта объектов', 'Сборка 22.09-83 · создан участок «ГРП» (на сервере и в сиде); починена синхронизация участков — save() падал без syncWithServer'],",
    "    objmap: ['Карта объектов', 'Сборка 22.09-84 · атрибуты карточки работы только у своего участка: УБиРОГС — свой блок, ГРП — «Атрибуты ГРП», у остальных без атрибутов'],",
    'build-marker'
)

io.open(APP, 'w', encoding='utf-8').write(src)
print('app.js patched')

# ---------- 4) work_db: updateWork — не трогаем незаданные ключи ----------
wsrc = io.open(WDB, encoding='utf-8').read()
old_upd = """      var na = _parseNewAttrs(data);
      Object.keys(na).forEach(function (k) { arr[i][k] = na[k]; });"""
new_upd = """      var na = _parseNewAttrs(data);
      // Сборка 22.09-84: не переданные ключи атрибутов НЕ перезаписываем —
      // у участков со скрытым блоком (openWorkModal) старые значения сохраняются.
      Object.keys(na).forEach(function (k) { if (data[k] !== undefined) arr[i][k] = na[k]; });"""
assert wsrc.count(old_upd) == 1
wsrc = wsrc.replace(old_upd, new_upd)
io.open(WDB, 'w', encoding='utf-8').write(wsrc)
print('work_db.js patched')

# ---------- 5) index.html build-marker ----------
idx = io.open(IDX, encoding='utf-8').read()
m = re.search(r'(<div[^>]*id="build-marker"[^>]*>)(.*?)(</div>)', idx, re.S)
assert m, 'build-marker not found'
idx = idx[:m.start(2)] + 'Сборка 22.09-84 · карточка работы: атрибуты только у своего участка — ⚙️ у УБиРОГС, 📋 «Атрибуты ГРП» у ГРП, у остальных без атрибутов' + idx[m.end(2):]
io.open(IDX, 'w', encoding='utf-8').write(idx)
print('markers updated; DONE')
