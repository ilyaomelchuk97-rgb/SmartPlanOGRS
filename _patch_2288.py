# -*- coding: utf-8 -*-
"""Сборка 22.09-88: встроенные нормы ГРП — работы и профессии есть «из коробки» после обновления."""
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

# ============================== professions_db.js ==============================
patch('/home/user/root_index/professions_db.js', [(
    "  var GRADES = [3, 4, 5, 6]; // допустимые разряды",
    """  var GRADES = [3, 4, 5, 6]; // допустимые разряды
  // Сборка 22.09-88: стандартные профессии из «Сопоставление видов работ и норма времени».
  // Фиксированные id — одинаковы на всех устройствах (upsert по id, дублей не будет).
  var DEFAULTS = [
    { id: 'p_canon_sgio3',      name: 'Слесарь газоиспользующего оборудования', grade: 3 },
    { id: 'p_canon_sgio4',      name: 'Слесарь газоиспользующего оборудования', grade: 4 },
    { id: 'p_canon_sgio5',      name: 'Слесарь газоиспользующего оборудования', grade: 5 },
    { id: 'p_canon_sgio6',      name: 'Слесарь газоиспользующего оборудования', grade: 6 },
    { id: 'p_canon_nal_kipia4', name: 'Наладчик КИПиА',                         grade: 4 },
    { id: 'p_canon_nal_kipia5', name: 'Наладчик КИПиА',                         grade: 5 },
    { id: 'p_canon_sl_kipia4',  name: 'Слесарь КИПиА',                          grade: 4 },
    { id: 'p_canon_sl_kipia5',  name: 'Слесарь КИПиА',                          grade: 5 }
  ];""",
    'profs DEFAULTS', 1),
    ("""  function ensureSeed() { init(); return Promise.resolve(init()); }""",
     """  function ensureSeed() {
    var db = init();
    // Сборка 22.09-88: посев стандартных профессий — ОДИН РАЗ на устройстве
    // (флаг smartplan_profs_seed_v1). Дубликаты по (имя+разряд) не создаются.
    try {
      if (!localStorage.getItem('smartplan_profs_seed_v1')) {
        var changed = 0;
        DEFAULTS.forEach(function (d) {
          if (findDup(d.name, d.grade)) return;
          db.professions.push({ id: d.id, name: d.name, grade: d.grade, created: Date.now() });
          changed++;
        });
        try { localStorage.setItem('smartplan_profs_seed_v1', '1'); } catch (e) {}
        if (changed) save(db);
      }
    } catch (e) {}
    return Promise.resolve(db);
  }""",
     'profs ensureSeed', 1)])

# ============================== work_db.js ==============================
patch('/home/user/root_index/work_db.js', [(
    """      }
    });
    save(db);
    return Promise.resolve(db);
  }""",
    """      }
    });
    // Сборка 22.09-88: встроенная библиотека норм ГРП — 112 видов работ из файла
    // «Сопоставление видов работ и норма времени» (grp_norms_seed.js).
    // Посев ОДИН РАЗ на устройстве (флаг smartplan_grp_norms_v1); работы,
    // уже существующие по названию (напр., после импорта из Excel), не дублируются.
    try {
      if (window.SP_GRP_NORMS_SEED && !localStorage.getItem('smartplan_grp_norms_v1')) {
        var SG = window.SP_GRP_NORMS_SEED;
        var PS = SG.profs || [], TT = SG.types || [''];
        if (!db.areas['ГРП']) db.areas['ГРП'] = [];
        var have = {};
        db.areas['ГРП'].forEach(function (w) { if (w && w.name) have[String(w.name).trim()] = 1; });
        (SG.rows || []).forEach(function (r, idx) {
          var name = String(r[1] || '').trim();
          if (!name || have[name]) return;
          have[name] = 1;
          var crew = (r[5] || []).map(function (c) {
            var p = PS[c[0]] || { name: '?', grade: 0 };
            return { prof: p.name, grade: String(p.grade), count: c[1] };
          });
          var crewSize = crew.reduce(function (a, e) { return a + e.count; }, 0);
          var typ = TT[r[4]] || '';
          db.areas['ГРП'].push(Object.assign({
            id: 'w_grp_norm_' + (idx + 1),
            group: (SG.groups && SG.groups[r[0]]) || 'Без группы',
            name: name,
            norm: r[2] / 1000,
            unit: 'объект',
            needs_permit: false, depends_on_snow: false, min_temp: -50,
            season: 'Круглый год', equipment: '—',
            min_workers: crewSize || 1, opt_workers: crewSize || 1
          }, _newAttrDefaults(), {
            object_categories: typ ? [typ] : [],
            lines_count: r[3] || 0,
            crew_size: crewSize,
            crew: crew
          }));
        });
        try { localStorage.setItem('smartplan_grp_norms_v1', '1'); } catch (e2) {}
      }
    } catch (e) {}
    save(db);
    return Promise.resolve(db);
  }""",
    'work_db ensureSeed +ГРП norms', 1)])

# ============================== index.html ==============================
patch('/home/user/index.html', [(
    '<script src="root_index/areas_db.js"></script>',
    '<script src="root_index/grp_norms_seed.js"></script>\n<script src="root_index/areas_db.js"></script>',
    'include seed js', 1),
    ('<div id="build-marker" style="margin-top:12px;text-align:center;font-size:10.5px;color:#94a3b8">Сборка 22.09-87 · импорт норм ГРП из Excel («Загрузить работы (Excel)»): работы + профессии + исполнители; атрибут «Кол-во линий редуцирования»</div>',
     '<div id="build-marker" style="margin-top:12px;text-align:center;font-size:10.5px;color:#94a3b8">Сборка 22.09-88 · нормы ГРП встроены: 112 видов работ и 8 профессий появятся на ГРП сразу после обновления</div>',
     'index marker 22.09-88', 1)])

# ============================== app.js (маркер) ==============================
patch('/home/user/root_index/app.js', [(
    "    objmap: ['Карта объектов', 'Сборка 22.09-87 · импорт норм ГРП из Excel (работы + профессии + исполнители) и новый атрибут «Кол-во линий редуцирования» у атрибутов ГРП'],",
    "    objmap: ['Карта объектов', 'Сборка 22.09-88 · нормы ГРП встроены в приложение: 112 видов работ + 8 профессий из «Сопоставление видов работ и норма времени»'],",
    'app marker 22.09-88', 1)])

print('ALL PATCHES OK')
