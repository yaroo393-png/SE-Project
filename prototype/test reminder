/*
 * reminder.js — ตรรกะเวลาเตือน (ไม่แตะ DOM, ไม่เรียก Date.now())
 *
 * Covers: FR-03 (แจ้งเตือนเมื่อถึงมื้อยา)  ·  BR-06, BR-08, BR-09, BR-16
 *
 * เวลาทุกค่าเป็น "นาทีนับจากเที่ยงคืน" ของวันนั้น (0–1439) เพื่อให้จำลอง T, T+5, T+10
 * ในหน้าเว็บและในเทสต์ได้ง่าย · ใช้ได้ทั้งในเบราว์เซอร์ (<script> ธรรมดา → window.MedMind.reminder)
 * และใน Node (require) — ไม่ใช้ ES module เพราะเปิดจาก file:// ไม่ได้
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.MedMind = root.MedMind || {};
    root.MedMind.reminder = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** BR-08: เตือนที่ T, T+5, T+10 (เวลาคงที่จาก T) */
  var ROUND_OFFSETS = Object.freeze([0, 5, 10]);
  /** BR-13: ถึง T+15 ยังไม่ยืนยัน → แจ้ง Caregiver */
  var EXPIRE_OFFSET = 15;
  /** BR-15: ไม่มีมื้อถัดไป → ยืนยันช้าได้ถึง 23:59 (ปิดที่ 24:00) */
  var END_OF_DAY = 1440;

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /** "08:05" → 485 */
  function parseTime(text) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(text));
    if (!m) throw new Error('รูปแบบเวลาไม่ถูกต้อง: ' + text);
    var h = Number(m[1]);
    var min = Number(m[2]);
    if (h > 23 || min > 59) throw new Error('เวลาไม่ถูกต้อง: ' + text);
    return h * 60 + min;
  }

  /** 485 → "08:05" */
  function formatTime(minutes) {
    return pad(Math.floor(minutes / 60)) + ':' + pad(minutes % 60);
  }

  /**
   * BR-06: เวลาเตือนอ้างอิง "คำสั่งบนฉลากเท่านั้น" — ระบบไม่เดา
   *   dose.timing = { type: 'after',   slot: 'morning'|'noon'|'evening' }   → เวลามื้อ
   *               | { type: 'before',  slot: ..., minutesBefore: N }        → เวลามื้อ − N
   *               | { type: 'bedtime' }                                     → เวลาเข้านอน
   * settings = { morning:'07:00', noon:'12:00', evening:'18:00', bedtime:'21:00' }
   * คืน null ถ้าคำนวณไม่ได้ (ฉลากไม่ระบุนาที, ชนิดที่ไม่รองรับ ฯลฯ) → UI แสดง "กรุณาตรวจสอบ"
   */
  function reminderTime(dose, settings) {
    var t = (dose && dose.timing) || {};
    var base;
    if (t.type === 'bedtime') {
      base = settings && settings.bedtime;
      return typeof base === 'string' ? parseTime(base) : null;
    }
    if (t.type === 'after' || t.type === 'before') {
      base = settings && settings[t.slot];
      if (typeof base !== 'string') return null;
      var at = parseTime(base);
      if (t.type === 'after') return at;
      if (!Number.isInteger(t.minutesBefore) || t.minutesBefore <= 0) return null;
      var result = at - t.minutesBefore;
      return result >= 0 ? result : null;
    }
    return null;
  }

  /**
   * BR-06: ยาที่เวลาเตือนตรงกันรวมเป็นมื้อเดียว
   * คืน { meals: [{id, time, label, doses[]}] เรียงตามเวลา, needsReview: [dose] }
   * (needsReview = ยาที่ยังหาเวลาไม่ได้ ต้องให้ Caregiver ตรวจ — BR-04)
   */
  function buildMeals(doses, settings) {
    var groups = {};
    var times = [];
    var needsReview = [];
    doses.forEach(function (dose) {
      var time = reminderTime(dose, settings);
      if (time === null) {
        needsReview.push(dose);
        return;
      }
      if (!groups[time]) {
        groups[time] = [];
        times.push(time);
      }
      groups[time].push(dose);
    });
    times.sort(function (a, b) { return a - b; });
    var meals = times.map(function (time) {
      return {
        id: 'm-' + formatTime(time).replace(':', ''),
        time: time,
        label: formatTime(time),
        doses: groups[time]
      };
    });
    return { meals: meals, needsReview: needsReview };
  }

  /** เวลาของรอบเตือนทั้ง 3 รอบ [T, T+5, T+10] */
  function roundTimes(meal) {
    return ROUND_OFFSETS.map(function (o) { return meal.time + o; });
  }

  /**
   * รอบเตือน ณ เวลา now: 0 = ยังไม่ถึง T · 1 = T..T+4 · 2 = T+5..T+9 · 3 = T+10..T+14 · 4 = หลัง T+15 (หมดรอบเตือน)
   */
  function currentRound(meal, now) {
    var elapsed = now - meal.time;
    if (elapsed < 0) return 0;
    if (elapsed >= EXPIRE_OFFSET) return 4;
    if (elapsed >= ROUND_OFFSETS[2]) return 3;
    if (elapsed >= ROUND_OFFSETS[1]) return 2;
    return 1;
  }

  /** state เป็น object ธรรมดา { [mealId]: { confirmedAt, ... } } (จัดการโดย confirm.js) */
  function isConfirmed(state, meal) {
    var rec = state && state[meal.id];
    return !!rec && rec.confirmedAt !== null && rec.confirmedAt !== undefined;
  }

  /**
   * BR-15: ช่วงยืนยันช้าปิดเมื่อถึงเวลาเตือนของมื้อถัดไปที่เริ่ม "หลัง T+15 ของมื้อนี้"
   * ไม่มี = 24:00 (ยืนยันได้ถึง 23:59) · คืนค่าเป็นเวลาที่ "ปิดแล้ว" (ไม่รวมค่านี้)
   */
  function lateWindowEnd(meal, meals) {
    var end = END_OF_DAY;
    meals.forEach(function (m) {
      if (m.time > meal.time + EXPIRE_OFFSET && m.time < end) end = m.time;
    });
    return end;
  }

  /** มื้อที่กำลังอยู่ในช่วงเตือน (T ≤ now < T+15) และยังไม่ยืนยัน เรียงตามเวลา */
  function activeReminderMeals(meals, state, now) {
    return meals
      .filter(function (m) {
        return !isConfirmed(state, m) && now >= m.time && now < m.time + EXPIRE_OFFSET;
      })
      .sort(function (a, b) { return a.time - b.time; });
  }

  /**
   * BR-08 + BR-09 + BR-16: มีรอบเตือนใดตกในช่วง (prevNow, now] หรือไม่
   * - เตือนเฉพาะมื้อที่ยังไม่ยืนยัน
   * - มีรอบเตือน → firing ไม่ว่าง · sound = true "ครั้งเดียว" แม้หลายมื้อเตือนพร้อมกัน (BR-16)
   * - display = ทุกมื้อที่ยังไม่ยืนยันและยังยืนยันได้ ณ ตอนนี้ เรียงตามเวลา (BR-16 หน้าเตือนแสดงทุกมื้อ)
   * prevNow ใส่ค่าก่อนหน้าได้ถ้าจำลองเวลากระโดด (ค่าเริ่มต้น = now − 1)
   */
  function dueReminders(meals, state, now, prevNow) {
    if (prevNow === undefined) prevNow = now - 1;
    var firing = [];
    meals.forEach(function (meal) {
      if (isConfirmed(state, meal)) return;
      ROUND_OFFSETS.forEach(function (offset, i) {
        var at = meal.time + offset;
        if (at > prevNow && at <= now) firing.push({ meal: meal, round: i + 1, at: at });
      });
    });
    if (firing.length === 0) return { firing: [], display: [], sound: false };
    var display = meals
      .filter(function (m) {
        return !isConfirmed(state, m) && m.time <= now && now < lateWindowEnd(m, meals);
      })
      .sort(function (a, b) { return a.time - b.time; });
    return { firing: firing, display: display, sound: true };
  }

  return {
    ROUND_OFFSETS: ROUND_OFFSETS,
    EXPIRE_OFFSET: EXPIRE_OFFSET,
    END_OF_DAY: END_OF_DAY,
    parseTime: parseTime,
    formatTime: formatTime,
    reminderTime: reminderTime,
    buildMeals: buildMeals,
    roundTimes: roundTimes,
    currentRound: currentRound,
    isConfirmed: isConfirmed,
    lateWindowEnd: lateWindowEnd,
    activeReminderMeals: activeReminderMeals,
    dueReminders: dueReminders
  };
});
