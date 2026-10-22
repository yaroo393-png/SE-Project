/*
 * labelForm.js — แปลง "ร่างข้อมูลยา" จาก labelParser → ค่าที่จะเติมในฟอร์มเพิ่มยาของหน้าผู้ดูแล (ไม่แตะ DOM)
 *
 * Covers: FR-02 (✓1, ✗3, ✗4, ✗10) · BR-04 (ช่องที่อ่านไม่ได้ = ว่าง ไม่เดา) · BR-06 (เวลาเตือนคำนวณจากเวลามื้อ)
 * ฟอร์มตอนนี้มี 4 ช่อง: name (ชื่อยา), dose (ขนาดยา เช่น "1 เม็ด"), time (HH:MM), instruction ('after' | 'before' | 'any')
 * เวลาเตือนคำนวณด้วย reminder.reminderTime() ของฟีเจอร์เตือน (FR-03) — ส่ง reminder เข้ามาเป็นพารามิเตอร์ จึงเทสต์แยกได้
 *
 * ใช้ได้ทั้งในเบราว์เซอร์ (window.MedMind.labelForm) และใน Node (require)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.MedMind = root.MedMind || {};
    root.MedMind.labelForm = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SLOT_LABELS = Object.freeze({ morning: 'เช้า', noon: 'กลางวัน', evening: 'เย็น' });

  /** FR-02 ✗4 / BR-07: ยาที่ MVP ยังไม่รองรับ — ข้อความตาม SRS */
  var UNSUPPORTED = Object.freeze({
    prn: 'ระบบยังไม่รองรับยาเมื่อมีอาการ',
    liquid: 'ระบบยังไม่รองรับยาน้ำ',
    half: 'ระบบยังไม่รองรับยาครึ่งเม็ด'
  });

  /** ชื่อช่องในฟอร์ม → คำที่แสดงใน "กรุณาตรวจสอบ: …" */
  var FIELD_LABELS = Object.freeze({ name: 'ชื่อยา', dose: 'ขนาดยา', time: 'เวลา', instruction: 'คำแนะนำ' });

  /** มื้อหนึ่งมื้อ → ข้อความอ่านง่าย เช่น "ก่อนอาหารเช้า 30 นาที" (ช่องที่ฉลากไม่ระบุแสดง "…") */
  function timingText(t) {
    if (!t) return '…';
    if (t.type === 'bedtime') return 'ก่อนนอน';
    var slot = SLOT_LABELS[t.slot] || '…';
    if (t.type === 'before') return 'ก่อนอาหาร' + slot + ' ' + (t.minutesBefore ? t.minutesBefore + ' นาที' : '… นาที');
    if (t.type === 'after') return 'หลังอาหาร' + slot;
    return '…';
  }

  /** ชนิดมื้อ → ค่าใน <select name="instruction"> ของฟอร์ม · ก่อนนอน ไม่มีตัวเลือกตรง ๆ จึงใช้ "ตามแพทย์สั่ง" + เวลาเข้านอน */
  function instructionOf(t) {
    if (!t) return '';
    if (t.type === 'after') return 'after';
    if (t.type === 'before') return 'before';
    if (t.type === 'bedtime') return 'any';
    return '';
  }

  /**
   * draft = ผลของ labelParser.parseLabel().draft
   * mealTimes = { morning, noon, evening, bedtime } แบบ "HH:MM" (จาก store.readMealTimes())
   * reminder = โมดูล reminder.js (ใช้ reminderTime + formatTime)
   * คืน {
   *   fields: { name, dose, time, instruction }   ค่าที่จะเติม — ช่องที่อ่านไม่ได้เป็น '' (BR-04)
   *   missing: ['name', 'dose', 'time', ...]      ช่องที่ต้องให้ผู้ดูแลกรอก/ตรวจ
   *   unsure: ['name', 'dose']                    ช่องที่มีค่า แต่ระบบแก้คำที่ OCR อ่านเพี้ยนให้ → ต้องตรวจให้ตรงฉลาก
   *   timings: ['หลังอาหารเช้า (07:00)', ...]      ทุกมื้อที่อ่านได้ (ฟอร์มรับได้ทีละมื้อ)
   *   unsupported: ข้อความ | null                 FR-02 ✗4 → ห้ามบันทึก
   * }
   */
  function toForm(draft, mealTimes, reminder) {
    var d = draft || {};
    var timings = Array.isArray(d.timings) ? d.timings : [];
    var first = timings[0] || null;
    var at = first ? reminder.reminderTime({ timing: first }, mealTimes) : null;

    var fields = {
      name: d.name ? String(d.name) : '',
      dose: Number.isInteger(d.pills) && d.pills > 0 ? d.pills + ' เม็ด' : '',
      time: at === null || at === undefined ? '' : reminder.formatTime(at),
      instruction: instructionOf(first)
    };
    var missing = Object.keys(FIELD_LABELS).filter(function (k) { return fields[k] === ''; });
    var unsure = (Array.isArray(d.unsure) ? d.unsure : [])
      .map(function (k) { return k === 'pills' ? 'dose' : k; })
      .filter(function (k) { return fields[k]; });

    return {
      fields: fields,
      missing: missing,
      unsure: unsure,
      timings: timings.map(function (t) {
        var time = reminder.reminderTime({ timing: t }, mealTimes);
        return timingText(t) + (time === null ? '' : ' (' + reminder.formatTime(time) + ')');
      }),
      unsupported: d.unsupported ? (UNSUPPORTED[d.unsupported] || 'ระบบยังไม่รองรับยานี้') : null
    };
  }

  return { toForm: toForm, timingText: timingText, FIELD_LABELS: FIELD_LABELS, UNSUPPORTED: UNSUPPORTED };
});
