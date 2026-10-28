/*
 * medication.js — ตรวจร่างยา คำนวณเวลา และบันทึก/ลบผ่าน store กลาง (ไม่แตะ DOM/นาฬิกา)
 * Covers: FR-02 ✓2, ✗3, ✓6, ✗7, ✓8, ✓9, ✗10 · BR-03–07 · NFR-06
 * ผู้รับผิดชอบ: Rossatorn Sangkaew / IDK-SleepyBro
 * ร่างใช้ชื่อช่องเดียวกับ labelParser; ข้อควรระวัง/ข้อห้ามใช้ไม่บังคับตาม BR-05
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.MedMind = root.MedMind || {};
    root.MedMind.medication = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SLOTS = ['morning', 'noon', 'evening'];
  var UNSUPPORTED = {
    prn: 'ระบบยังไม่รองรับยาเมื่อมีอาการ',
    liquid: 'ระบบยังไม่รองรับยาน้ำ',
    half: 'ระบบยังไม่รองรับยาครึ่งเม็ด'
  };

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function wholePills(value) {
    return Number.isSafeInteger(value) && value > 0;
  }

  /** ตรวจเฉพาะร่าง ไม่อ่าน/เขียน storage; errors ใช้ key แบบเดียวกับ missing ของ parser */
  function validateDraft(draft) {
    var d = draft || {};
    var errors = {};
    if (!text(d.name)) errors.name = 'กรุณาตรวจสอบชื่อยา';
    if (!wholePills(d.pills)) errors.pills = 'จำนวนเม็ดต้องเป็นจำนวนเต็มมากกว่า 0';
    if (d.unsupported) errors.unsupported = UNSUPPORTED[d.unsupported] || 'ระบบยังไม่รองรับยานี้';
    if (!Array.isArray(d.timings) || d.timings.length === 0) {
      errors.timings = 'กรุณาตรวจสอบมื้อ/เวลา';
    } else {
      d.timings.forEach(function (timing, index) {
        var t = timing || {};
        var key = 'timing.' + index;
        if (['after', 'before', 'bedtime'].indexOf(t.type) === -1) {
          errors[key + '.type'] = 'กรุณาตรวจสอบเวลากินตามฉลาก';
        }
        if ((t.type === 'after' || t.type === 'before') && SLOTS.indexOf(t.slot) === -1) {
          errors[key + '.slot'] = 'กรุณาตรวจสอบมื้อ';
        }
        if (t.type === 'before' && (!Number.isSafeInteger(t.minutesBefore) || t.minutesBefore <= 0)) {
          errors[key + '.minutesBefore'] = 'กรุณาตรวจสอบจำนวนนาทีก่อนอาหาร';
        }
        if (t.pills !== undefined && !wholePills(t.pills)) {
          errors[key + '.pills'] = 'จำนวนเม็ดต่อมื้อต้องเป็นจำนวนเต็มมากกว่า 0';
        }
      });
    }
    return { ok: Object.keys(errors).length === 0, errors: errors };
  }

  /** ใช้ reminder ของทีมคำนวณทุกมื้อ; ยังไม่บันทึก และไม่เดาเวลาที่คำนวณไม่ได้ */
  function preview(draft, mealTimes, reminder) {
    var checked = validateDraft(draft);
    if (!checked.ok) return { ok: false, errors: checked.errors, reminders: [] };
    var errors = {};
    var reminders = [];
    draft.timings.forEach(function (timing, index) {
      var at = null;
      try {
        at = reminder.reminderTime({ timing: timing }, mealTimes);
      } catch (e) {
        at = null;
      }
      if (!Number.isInteger(at) || at < 0 || at >= 1440) {
        errors['timing.' + index + '.time'] = 'กรุณาตรวจสอบเวลามื้อและจำนวนนาที';
        return;
      }
      reminders.push({
        timing: Object.assign({}, timing),
        time: reminder.formatTime(at),
        pills: timing.pills === undefined ? draft.pills : timing.pills
      });
    });
    return { ok: Object.keys(errors).length === 0, errors: errors, reminders: reminders };
  }

  /**
   * คำนวณเวลาแสดงผลจากเวลามื้อล่าสุด โดยไม่แก้/เขียนรายการต้นฉบับ
   * รายการเก่าที่ไม่มี timing คงเวลาเดิม; คำนวณไม่ได้ต้องรอตรวจ ไม่ใช้เวลาเก่าเตือนแทน
   */
  function resolveTimes(rows, mealTimes, reminder) {
    if (!Array.isArray(rows)) return [];
    return rows.map(function (row) {
      if (!row || typeof row !== 'object') return row;
      var resolved = Object.assign({}, row);
      if (!Object.prototype.hasOwnProperty.call(row, 'timing')) return resolved;
      var at = null;
      try {
        at = reminder.reminderTime({ timing: row.timing }, mealTimes);
        if (Number.isInteger(at) && at >= 0 && at < 1440) {
          resolved.time = reminder.formatTime(at);
          resolved.needsReview = false;
          return resolved;
        }
      } catch (e) {
        // เวลาเสียหรือคำสั่งไม่ครบให้แสดง "กรุณาตรวจสอบ" แทนการใช้เวลาเดิม
      }
      resolved.time = '';
      resolved.needsReview = true;
      return resolved;
    });
  }

  /** อ่านรายการเดิมโดยไม่เปลี่ยนข้อมูล; ข้อมูลที่ไม่ใช่ array จะไม่ถูกเขียนทับ */
  function readMedicines(store) {
    try {
      var medicines = store.readJSON(store.KEYS.medicines, []);
      return Array.isArray(medicines) ? medicines : null;
    } catch (e) {
      return null;
    }
  }

  function writeMedicines(store, medicines) {
    try {
      return store.writeJSON(store.KEYS.medicines, medicines) === true;
    } catch (e) {
      return false;
    }
  }

  /** รายการเก่าที่ยังไม่มี id ต้องชี้ตำแหน่งเดิมอย่างชัดเจน ห้ามเดาจากชื่อยา */
  function validLegacyIndex(medicines, index) {
    if (!Number.isInteger(index) || index < 0 || index >= medicines.length) return false;
    var medicine = medicines[index];
    return !!medicine && !Object.prototype.hasOwnProperty.call(medicine, 'id') &&
      !Object.prototype.hasOwnProperty.call(medicine, 'medicationId');
  }

  /**
   * เรียกเมื่อ Caregiver ตรวจร่างแล้วกดบันทึกเท่านั้น (reviewed: true)
   * options.id มาจากหน้าจอ; ใช้ id เดิมตอนแก้ไขเพื่อแทนทั้งกลุ่มโดยไม่แตะยาอื่น
   * หนึ่งแถวต่อมื้อยังมี name/dose/time/instruction แบบเดิม; medicationId ผูกมื้อของยาตัวเดียวกัน
   */
  function saveMedication(draft, store, reminder, options) {
    var opts = options || {};
    var mealTimes;
    try {
      mealTimes = store.readMealTimes();
    } catch (e) {
      return { ok: false, errors: { storage: 'อ่านเวลามื้อไม่ได้ กรุณาลองใหม่' } };
    }
    var result = preview(draft, mealTimes, reminder);
    if (opts.reviewed !== true) result.errors.reviewed = 'ผู้ดูแลต้องตรวจและกดยืนยันก่อนบันทึก';
    if (!text(opts.id)) result.errors.id = 'ไม่พบรหัสรายการยา';
    if (Object.keys(result.errors).length) return { ok: false, errors: result.errors };

    var previous = readMedicines(store);
    if (previous === null) return { ok: false, errors: { storage: 'อ่านรายการยาไม่ได้ กรุณาลองใหม่' } };
    var id = text(opts.id);
    var legacy = opts.legacyIndex !== undefined;
    if (legacy && !validLegacyIndex(previous, opts.legacyIndex)) {
      return { ok: false, errors: { legacyIndex: 'รายการยาเดิมเปลี่ยนไป กรุณาเปิดฟอร์มใหม่' } };
    }
    if (legacy && previous.some(function (medicine) { return medicine && (medicine.id === id || medicine.medicationId === id); })) {
      return { ok: false, errors: { id: 'รหัสรายการยาซ้ำ กรุณาเปิดฟอร์มใหม่' } };
    }
    var additions = result.reminders.map(function (entry, index) {
      return {
        id: id + '-' + index,
        medicationId: id,
        name: text(draft.name),
        dose: entry.pills + ' เม็ด',
        pills: entry.pills,
        time: entry.time,
        instruction: entry.timing.type,
        timing: entry.timing,
        caution: text(draft.caution),
        contraindication: text(draft.contraindication)
      };
    });
    var next = previous.filter(function (medicine, index) {
      if (legacy) return index !== opts.legacyIndex;
      return !medicine || (medicine.medicationId !== id && medicine.id !== id);
    }).concat(additions);
    if (!writeMedicines(store, next)) {
      return { ok: false, errors: { storage: 'บันทึกไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บแล้วลองใหม่' } };
    }
    return { ok: true, errors: {}, medicines: next, medicine: additions, reminders: result.reminders };
  }

  /** ลบทั้งกลุ่มยาโดย id เท่านั้น ชื่อซ้ำกันจึงไม่ทำให้ลบยาตัวอื่น */
  function deleteMedication(id, store, options) {
    if (!text(id)) return { ok: false, errors: { id: 'ไม่พบรหัสรายการยา' } };
    var previous = readMedicines(store);
    if (previous === null) return { ok: false, errors: { storage: 'อ่านรายการยาไม่ได้ กรุณาลองใหม่' } };
    var opts = options || {};
    if (opts.legacyIndex !== undefined) {
      if (!validLegacyIndex(previous, opts.legacyIndex)) {
        return { ok: false, errors: { legacyIndex: 'รายการยาเดิมเปลี่ยนไป กรุณาเปิดรายการใหม่' } };
      }
      var remaining = previous.filter(function (medicine, index) { return index !== opts.legacyIndex; });
      if (!writeMedicines(store, remaining)) return { ok: false, errors: { storage: 'ลบไม่ได้ กรุณาลองใหม่' } };
      return { ok: true, errors: {}, medicines: remaining };
    }
    var found = previous.find(function (medicine) {
      return medicine && (medicine.id === id || medicine.medicationId === id);
    });
    if (!found) return { ok: false, errors: { id: 'ไม่พบรายการยา' } };
    var groupId = found.medicationId || found.id;
    var next = previous.filter(function (medicine) {
      return !medicine || (medicine.medicationId !== groupId && medicine.id !== groupId);
    });
    if (!writeMedicines(store, next)) return { ok: false, errors: { storage: 'ลบไม่ได้ กรุณาลองใหม่' } };
    return { ok: true, errors: {}, medicines: next };
  }

  return { validateDraft: validateDraft, preview: preview, resolveTimes: resolveTimes, saveMedication: saveMedication, deleteMedication: deleteMedication };
});
