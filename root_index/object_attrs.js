/* ============================================================
   SmartPlan — АТРИБУТЫ ОБЪЕКТОВ ГРП/ШРП/ПГРП (object_attrs.js)
   ------------------------------------------------------------
   Сборка 21.09-24: добавляет 24 атрибута вкладки «Общее»
   для объектов газораспределительной системы УП «МИНГАЗ».

   Схема хранения:
   · В smartplan_objects_db — каждый объект получает
     дополнительный вложенный объект `attrs` (опциональный).
   · История ответственного — отдельный массив
     `respHistory: [{uid, name, from, to}], где to=null
     для текущего ответственного.
   · Старые объекты без `attrs` автоматически получают
     `attrs: {}` при первом обращении.

   API модуля:
   · SCHEMA   — описание всех полей (label, type, options, unit, hint)
   · getAttrs(o) — взять атрибуты объекта (с дефолтами)
   · setAttrs(o, data) — установить все атрибуты
   · renderForm(o, onChange) — отрендерить HTML формы для модалки
   · collectForm(formEl) — собрать данные из формы → {data, history, errors}
   · renderSummary(o) — компактный показ в таблице справочника
   · getRespCurrent(o) — текущий ответственный (uid, name)
   · addRespAssignment(o, uid, dateIso) — назначить нового (старый → to=date)
   · getRespHistory(o) — массив назначений по убыванию даты

   Совместимость: schema 2 → 3 (добавлены опциональные `attrs`,
   `respHistory`, и расширенный набор полей в самом объекте).
   ============================================================ */
window.SP_OBJ_ATTRS = (function () {
  'use strict';

  // Типы атрибутов: text, number, date, select, list, checkbox, refUser, multiline
  // — text:        одна строка
  // — number:      целое число (или дробное, если step != 1)
  // — date:        <input type="date">
  // — select:      выпадающий список (один выбор)
  // — list:        выпадающий список с числами/диапазоном (1-6 и т.п.)
  // — checkbox:    да/нет
  // — refUser:     ссылка на пользователя (выпадающий список из smartplan_users_db)
  // — multiline:   многострочный текст

  /* ---------- СХЕМА ВСЕХ АТРИБУТОВ ---------- */
  var SCHEMA = [
    // Группа 1: «Идентификация»
    { key: 'linesCount',       group: 'Идентификация', label: 'Кол-во линий', type: 'list', list: [1,2,3,4,5,6], unit: 'шт' },
    { key: 'poo',              group: 'Идентификация', label: 'Номер ПОО', type: 'text' },
    { key: 'commissionDate',   group: 'Идентификация', label: 'Дата ввода в эксплуатацию', type: 'date' },
    // Группа 2: «Статус»
    { key: 'status',           group: 'Статус', label: 'Статус', type: 'select', options: ['Проектируется','Строится','В эксплуатации','Реконструкция','Консервация','Ликвидирован'] },
    { key: 'balance',          group: 'Статус', label: 'Находится на балансе', type: 'select', options: ['УП «МИНГАЗ»','Иная организация'] },
    { key: 'serviceOrg',       group: 'Статус', label: 'Обслуживающая организация', type: 'select', options: ['УП «МИНГАЗ»','Иная организация'] },
    // Группа 3: «Документация»
    { key: 'archiveITD',       group: 'Документация', label: 'Архивный номер ИТД', type: 'text' },
    { key: 'archivePTU',       group: 'Документация', label: 'Архивный номер ПТУ', type: 'text' },
    { key: 'commissionOrder',  group: 'Документация', label: 'Номер и дата приказа о вводе в эксплуатацию', type: 'text', placeholder: '№ … от …', multiline: true },
    { key: 'pnrDate',          group: 'Документация', label: 'Дата ПНР', type: 'date' },
    { key: 'urgRef',           group: 'Документация', label: 'Ссылка на объект УРГ', type: 'text', placeholder: 'URL или ID' },
    // Группа 4: «Ответственный» — особый случай: история + текущий
    { key: 'respUid',          group: 'Ответственный', label: 'Ответственный за безопасную эксплуатацию', type: 'refUser', hint: 'В карточке отображается ответственный на момент просмотра. История — ниже.' },
    // Группа 5: «Технические характеристики»
    { key: 'serviceKind',      group: 'Технические', label: 'Вид обслуживания', type: 'select', options: ['REGION-gaz','Без ИПК'] },
    { key: 'reduceLines',      group: 'Технические', label: 'Кол-во линий редуцирования', type: 'list', list: [1,2,3,4,5,6], unit: 'шт' },
    { key: 'capacity',         group: 'Технические', label: 'Расчетная пропускная способность', type: 'number', step: 1, unit: 'м³' },
    { key: 'winterFlow',       group: 'Технические', label: 'Расход зимой', type: 'number', step: 1, unit: 'м³/ч' },
    { key: 'summerFlow',       group: 'Технические', label: 'Расход летом', type: 'number', step: 1, unit: 'м³/ч' },
    { key: 'distIn',           group: 'Технические', label: 'Расстояние до отключающего устройства на входе', type: 'number', step: 1, unit: 'м', longLabel: true },
    { key: 'distOut',          group: 'Технические', label: 'Расстояние до отключающего устройства на выходе', type: 'number', step: 1, unit: 'м', longLabel: true },
    { key: 'heating',          group: 'Технические', label: 'Вид отопления', type: 'select', options: ['Газовое','Электрическое'], hideFor: ['ШРП'], hint: 'Отсутствует у категории ШРП' },
    { key: 'telemetryKey',     group: 'Технические', label: 'Вид ключа шкафа телеметрии', type: 'select', options: ['1','2','3'] },
    // Группа 6: «Дополнительно»
    { key: 'candles',          group: 'Дополнительно', label: 'Свечи', type: 'number', step: 1, unit: 'шт' },
    { key: 'odorControl',      group: 'Дополнительно', label: 'Объект для контроля интенсивности запаха газа', type: 'checkbox' }
  ];

  // Построим быстрый lookup по ключу
  var SCHEMA_BY_KEY = {};
  SCHEMA.forEach(function (f) { SCHEMA_BY_KEY[f.key] = f; });

  /* ---------- УТИЛИТЫ ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function isGasType(t) {
    return t === 'ГРП' || t === 'ШРП' || t === 'ГРС' || t === 'ПГРП';
  }
  // Атрибуты показываются только для ГРП/ШРП/ПГРП
  function supportsAttrs(t) {
    return t === 'ГРП' || t === 'ШРП' || t === 'ПГРП';
  }

  function defaultAttrs() {
    var o = {};
    SCHEMA.forEach(function (f) {
      if (f.type === 'list') o[f.key] = '';
      else if (f.type === 'checkbox') o[f.key] = false;
      else o[f.key] = '';
    });
    return o;
  }

  /* ---------- ГЕТТЕРЫ/СЕТТЕРЫ ДЛЯ ОБЪЕКТА ---------- */
  // Возвращает копию атрибутов (с дефолтами для отсутствующих полей)
  function getAttrs(o) {
    if (!o) return defaultAttrs();
    var a = o.attrs || {};
    var r = defaultAttrs();
    SCHEMA.forEach(function (f) { if (a[f.key] !== undefined) r[f.key] = a[f.key]; });
    return r;
  }

  // Возвращает историю ответственного (массив)
  function getRespHistory(o) {
    if (!o) return [];
    if (!Array.isArray(o.respHistory)) return [];
    // Сортируем по убыванию даты начала
    return o.respHistory.slice().sort(function (a, b) {
      return String(b.from || '').localeCompare(String(a.from || ''));
    });
  }

  // Текущий ответственный: последний в истории с to=null|undefined
  function getRespCurrent(o) {
    var h = getRespHistory(o);
    for (var i = 0; i < h.length; i++) {
      if (h[i].to == null) return { uid: h[i].uid, name: h[i].name, from: h[i].from };
    }
    // Если истории нет, берём из старых плоских полей (миграция)
    if (o && o.respId) return { uid: o.respId, name: o.respName || '', from: null };
    return null;
  }

  /* ---------- НАЗНАЧЕНИЕ НОВОГО ОТВЕТСТВЕННОГО ----------
     Алгоритм:
     1. Найти текущего (to=null) — закрыть: поставить to=fromIso (если fromIso
        раньше даты начала — clamp до from).
     2. Добавить новую запись {uid, name, from: fromIso, to: null}.
     3. Также обновить плоские respId/respName (для совместимости с кодом,
        который их читает — карта объектов и пр.). */
  function addRespAssignment(o, uid, name, fromIso) {
    if (!o) return;
    if (!Array.isArray(o.respHistory)) o.respHistory = [];
    var from = fromIso || new Date().toISOString().slice(0, 10);
    // Закрываем текущего
    for (var i = 0; i < o.respHistory.length; i++) {
      if (o.respHistory[i].to == null) {
        var curFrom = o.respHistory[i].from || from;
        if (curFrom > from) curFrom = from; // на всякий случай
        o.respHistory[i].to = from;
      }
    }
    o.respHistory.push({ uid: uid, name: name || '', from: from, to: null });
    // Дублируем в плоские поля для обратной совместимости
    o.respId = uid;
    o.respName = name || '';
  }

  /* ---------- РЕНДЕР ФОРМЫ (модалка) ----------
     containerEl — DOM-элемент, куда положить форму.
     onChange — callback (key, value) при изменении полей. */
  function renderForm(o, type, onChange) {
    if (!supportsAttrs(type)) return '';
    var attrs = getAttrs(o);
    var users = (window.DB && DB.getUsers) ? DB.getUsers() : [];
    var groups = {};
    SCHEMA.forEach(function (f) {
      // ШРП: скрыть «Вид отопления»
      if (f.hideFor && f.hideFor.indexOf(type) >= 0) return;
      (groups[f.group] = groups[f.group] || []).push(f);
    });
    var groupOrder = ['Идентификация','Статус','Документация','Ответственный','Технические','Дополнительно'];

    var out = '';
    out += '<div id="oa-fields">';
    groupOrder.forEach(function (gname) {
      var items = groups[gname];
      if (!items || !items.length) return;
      out += '<fieldset style="border:1px solid var(--line);border-radius:8px;padding:8px 12px 12px;margin:0 0 12px">';
      out += '<legend style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.4px;padding:0 6px">' + esc(gname) + '</legend>';
      // 2-колоночная сетка внутри fieldset — чтобы всё помещалось в широкую модалку
      out += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 14px">';
      items.forEach(function (f) {
        out += '<div class="fld" style="margin-bottom:0">';
        out += '<label style="font-size:12px">' + esc(f.label) + (f.unit ? ' <span style="color:var(--muted);font-weight:400">(' + esc(f.unit) + ')</span>' : '') + '</label>';
        out += renderField(f, attrs[f.key], users, o);
        if (f.hint) out += '<div style="font-size:11px;color:var(--muted);margin-top:3px">' + esc(f.hint) + '</div>';
        out += '</div>';
      });
      out += '</div></fieldset>';
    });
    out += '</div>';

    // История ответственного (если есть записи)
    var hist = getRespHistory(o);
    if (hist.length) {
      out += '<fieldset style="border:1px solid #fef3c7;background:#fffbeb;border-radius:8px;padding:8px 12px 10px;margin:0 0 12px">';
      out += '<legend style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.4px;padding:0 6px">История ответственного</legend>';
      out += '<div style="display:flex;flex-direction:column;gap:4px">';
      hist.forEach(function (r) {
        var cur = r.to == null;
        out += '<div style="font-size:12px;padding:4px 8px;border-radius:6px;' +
          (cur ? 'background:#dcfce7;color:#14532d;font-weight:700' : 'background:#f1f5f9;color:#475569') +
          '">';
        out += esc(r.name || r.uid || '—') + ' · ' +
          (cur ? 'с ' + esc(r.from || '?') : esc((r.from || '?') + ' — ' + (r.to || '?')));
        if (cur) out += ' <span style="font-size:10px;background:#16a34a;color:#fff;padding:1px 5px;border-radius:3px;margin-left:4px">сейчас</span>';
        out += '</div>';
      });
      out += '</div></fieldset>';
    }
    return out;
  }

  function renderField(f, val, users, o) {
    var id = 'oa-' + f.key;
    var cur = (val == null) ? '' : val;
    if (f.type === 'select') {
      var s = '<select id="' + id + '" data-oa-key="' + esc(f.key) + '"><option value="">— не указано —</option>';
      f.options.forEach(function (opt) {
        s += '<option value="' + esc(opt) + '"' + (String(cur) === opt ? ' selected' : '') + '>' + esc(opt) + '</option>';
      });
      s += '</select>';
      return s;
    }
    if (f.type === 'list') {
      var s2 = '<select id="' + id + '" data-oa-key="' + esc(f.key) + '"><option value="">—</option>';
      f.list.forEach(function (opt) {
        s2 += '<option value="' + esc(opt) + '"' + (String(cur) === String(opt) ? ' selected' : '') + '>' + esc(opt) + '</option>';
      });
      s2 += '</select>';
      return s2;
    }
    if (f.type === 'checkbox') {
      var checked = cur === true || cur === 'true' || cur === 'on' || cur === 1;
      return '<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">' +
        '<input type="checkbox" id="' + id + '" data-oa-key="' + esc(f.key) + '"' + (checked ? ' checked' : '') + '>' +
        '<span style="font-size:13px">' + (cur ? 'Да' : 'Нет') + '</span></label>';
    }
    if (f.type === 'date') {
      return '<input type="date" id="' + id + '" data-oa-key="' + esc(f.key) + '" value="' + esc(cur) + '">';
    }
    if (f.type === 'number') {
      return '<input type="number" id="' + id + '" data-oa-key="' + esc(f.key) + '"' +
        ' step="' + (f.step || 1) + '" value="' + esc(cur) + '" placeholder="' + esc(f.placeholder || '') + '">';
    }
    if (f.type === 'refUser') {
      var s3 = '<select id="' + id + '" data-oa-key="' + esc(f.key) + '" data-oa-special="respUser"><option value="">— не назначен —</option>';
      var active = (users || []).filter(function (u) { return u && u.active !== false; });
      active.sort(function (a, b) { return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ru'); });
      active.forEach(function (u) {
        var role = (window.ROLE_INFO && ROLE_INFO[u.role]) ? ROLE_INFO[u.role].label : u.role;
        s3 += '<option value="' + esc(u.id) + '"' + (cur === u.id ? ' selected' : '') + '>' +
          esc(u.full_name) + ' · ' + esc(role) + '</option>';
      });
      s3 += '</select>';
      // Если был назначен ранее — рядом с выбором покажем дату начала (если известна)
      var cur0 = getRespCurrent(o || {});
      if (cur0 && cur0.from) {
        s3 += '<div style="font-size:11px;color:var(--muted);margin-top:4px">Текущий назначен с <b>' + esc(cur0.from) + '</b>. При смене будет записана история.</div>';
      }
      return s3;
    }
    if (f.multiline) {
      return '<textarea id="' + id + '" data-oa-key="' + esc(f.key) + '" rows="2" placeholder="' + esc(f.placeholder || '') + '" style="width:100%;padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box;resize:vertical">' + esc(cur) + '</textarea>';
    }
    return '<input type="text" id="' + id + '" data-oa-key="' + esc(f.key) + '" value="' + esc(cur) + '" placeholder="' + esc(f.placeholder || '') + '">';
  }

  /* ---------- СБОР ДАННЫХ ИЗ ФОРМЫ ----------
     Возвращает { attrs, respChanged }.
     respChanged=true если пользователь сменил ответственного — нужно вызвать
     addRespAssignment с новым uid/name/даты. */
  function collectForm(formEl) {
    var out = {};
    var respChanged = null;
    var inputs = formEl.querySelectorAll('[data-oa-key]');
    inputs.forEach(function (el) {
      var key = el.getAttribute('data-oa-key');
      var special = el.getAttribute('data-oa-special');
      if (el.type === 'checkbox') {
        out[key] = el.checked;
      } else if (special === 'respUser') {
        out[key] = el.value;
      } else {
        out[key] = el.value;
      }
    });
    return { attrs: out, respChanged: respChanged };
  }

  /* ---------- КОМПАКТНЫЙ РЕНДЕР ДЛЯ ТАБЛИЦЫ ---------- */
  function renderSummary(o) {
    if (!supportsAttrs(o && o.type)) return '—';
    var attrs = getAttrs(o);
    var parts = [];
    if (attrs.status) parts.push('<span style="display:inline-block;padding:1px 6px;background:' + statusColor(attrs.status) + ';color:#fff;border-radius:3px;font-size:10px;font-weight:600">' + esc(attrs.status) + '</span>');
    if (attrs.commissionDate) parts.push('<span style="font-size:11px;color:#64748b">📅 ' + esc(attrs.commissionDate) + '</span>');
    if (attrs.winterFlow || attrs.summerFlow) {
      var f = (attrs.winterFlow || '?') + '/' + (attrs.summerFlow || '?');
      parts.push('<span style="font-size:11px;color:#0c4a6e">💨 ' + f + ' м³/ч</span>');
    }
    if (attrs.odorControl) parts.push('<span style="font-size:11px;color:#7c2d12" title="Контроль запаха газа">👃</span>');
    if (!parts.length) return '<span style="color:var(--muted);font-size:11px">нет атрибутов</span>';
    return parts.join(' ');
  }
  function statusColor(s) {
    if (s === 'В эксплуатации') return '#16a34a';
    if (s === 'Проектируется') return '#7c3aed';
    if (s === 'Строится') return '#2563eb';
    if (s === 'Реконструкция') return '#f59e0b';
    if (s === 'Консервация') return '#64748b';
    if (s === 'Ликвидирован') return '#dc2626';
    return '#475569';
  }

  /* ---------- ВАЛИДАЦИЯ ---------- */
  function validate(attrs) {
    var errors = [];
    SCHEMA.forEach(function (f) {
      if (f.type === 'number') {
        var v = attrs[f.key];
        if (v !== '' && v != null && isNaN(parseFloat(v))) {
          errors.push('«' + f.label + '» должно быть числом');
        }
        if (v !== '' && parseFloat(v) < 0) {
          errors.push('«' + f.label + '» не может быть отрицательным');
        }
      }
      if (f.type === 'date') {
        var d = attrs[f.key];
        if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          errors.push('«' + f.label + '» — некорректная дата');
        }
      }
    });
    return errors;
  }

  /* ---------- ПУБЛИЧНЫЙ API ---------- */
  return {
    SCHEMA: SCHEMA,
    SCHEMA_BY_KEY: SCHEMA_BY_KEY,
    supportsAttrs: supportsAttrs,
    isGasType: isGasType,
    getAttrs: getAttrs,
    getRespHistory: getRespHistory,
    getRespCurrent: getRespCurrent,
    addRespAssignment: addRespAssignment,
    renderForm: renderForm,
    renderField: renderField,
    collectForm: collectForm,
    renderSummary: renderSummary,
    validate: validate,
    defaultAttrs: defaultAttrs
  };
})();