/*
 * confirm.js — ตรรกะยืนยันการกินยา, แจ้ง Caregiver, สถานะรายวัน (ไม่แตะ DOM)
 *
 * Covers: FR-04, FR-05  ·  BR-10, BR-11, BR-12, BR-13, BR-14, BR-15, BR-16
 *
 * state = object ธรรมดา { [mealId]: record } — ฟังก์ชันในไฟล์นี้ "แก้ state ที่ส่งเข้ามา" แล้วคืน
 * { ok, reason?, action?, events[] } โดย events คือสิ่งที่หน้าจอต้องแสดง/ส่ง เช่น แจ้ง Caregiver
 * เวลาเป็นนาทีนับจากเที่ยงคืน (ดู reminder.js) · ต้องโหลด reminder.js ก่อนไฟล์นี้
 */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var reminder = isNode ? require('./reminder.js') : root.MedMind && root.MedMind.reminder;
  if (!reminder) throw new Error('โหลด reminder.js ก่อน confirm.js');
  var api = factory(reminder);
  if (isNode) {
    module.exports = api;
  } else {
    root.MedMind = root.MedMind || {};
    root.MedMind.confirm = api;
  }
})(typeof self !== 'undefined' ? self : this, function (reminder) {
  'use strict';

  /** BR-14: ข้อความสถานะที่ Caregiver/Senior เห็น */
  var LABELS = Object.freeze({
    confirmed: 'กินแล้ว',
    confirmed_late: 'กินแล้ว (ยืนยันช้า)',
    unconfirmed: 'ยังไม่ยืนยัน',
    waiting: 'รอถึงเวลา',
    // ไม่อยู่ใน BR-14 — ใช้ช่วง T..T+15 ที่กำลังเตือนอยู่ (ดูหมายเหตุตอนส่งงาน)
    reminding: 'กำลังเตือน'
  });

  /** FR-05 ✗4 */
  var EMPTY_DAY_MESSAGE = 'ยังไม่มีมื้อยาวันนี้';

  function newRecord() {
    return {
      confirmedAt: null,
      confirmedLate: false,
      confirmationLog: [], // NFR-07: ต้องมีรายการเดียวต่อมื้อ
      notYetRounds: [],
      unconfirmedNoticeAt: null, // BR-13: แจ้ง "ยังไม่ยืนยันการกินยา" ไปเมื่อไร (ครั้งเดียวต่อมื้อ)
      confirmedNoticeAt: null
    };
  }

  function getRecord(state, meal) {
    if (!state[meal.id]) state[meal.id] = newRecord();
    return state[meal.id];
  }

  /** BR-15: ยืนยันได้ตั้งแต่ถึง T จนก่อนเวลาที่ช่วงยืนยันช้าปิด */
  function canConfirm(meal, meals, now) {
    if (now < meal.time) return { ok: false, reason: 'not_due' };
    if (now >= reminder.lateWindowEnd(meal, meals)) return { ok: false, reason: 'window_closed' };
    return { ok: true };
  }

  /** BR-13: แจ้ง "ยังไม่ยืนยันการกินยา" ครั้งเดียวต่อมื้อ ห้ามใช้คำว่า "ไม่ได้กิน" */
  function notifyUnconfirmed(rec, meal, now) {
    if (rec.unconfirmedNoticeAt !== null) return [];
    rec.unconfirmedNoticeAt = now;
    return [{
      type: 'notify_caregiver',
      kind: 'unconfirmed',
      mealId: meal.id,
      at: now,
      text: 'ยังไม่ยืนยันการกินยา (มื้อ ' + meal.label + ')'
    }];
  }

  /**
   * BR-10 / BR-12 / BR-15: "กินแล้ว" 1 แตะ = ยืนยันทั้งมื้อ + บันทึกเวลา + หยุดเตือน
   * กดซ้ำไม่บันทึกซ้ำ · หลัง T+15 = ยืนยันช้า (+ แจ้ง Caregiver "ยืนยันการกินยาแล้ว เวลา …")
   */
  function confirmMeal(state, meal, meals, now) {
    var rec = getRecord(state, meal);
    if (rec.confirmedAt !== null) return { ok: true, duplicate: true, events: [] };

    var check = canConfirm(meal, meals, now);
    if (!check.ok) return { ok: false, reason: check.reason, events: [] };

    var late = now >= meal.time + reminder.EXPIRE_OFFSET;
    rec.confirmedAt = now;
    rec.confirmedLate = late;
    rec.confirmationLog.push({ at: now, late: late });

    var events = [];
    // ยืนยันช้า (BR-15) หรือเคยแจ้ง "ยังไม่ยืนยัน" ไปแล้ว → Caregiver ต้องได้ข้อความตามหลัง
    if (late || rec.unconfirmedNoticeAt !== null) {
      rec.confirmedNoticeAt = now;
      events.push({
        type: 'notify_caregiver',
        kind: 'confirmed',
        mealId: meal.id,
        at: now,
        late: late,
        text: 'ยืนยันการกินยาแล้ว เวลา ' + reminder.formatTime(now)
      });
    }
    return { ok: true, duplicate: false, late: late, events: events };
  }

  /**
   * BR-11: กด "ยังไม่กิน"
   * รอบ 1–2 → รอรอบถัดไป · รอบ 3 (T+10) → แจ้ง Caregiver ทันที (ไม่รอ T+15)
   */
  function pressNotYet(state, meal, meals, now) {
    if (reminder.isConfirmed(state, meal)) return { ok: false, reason: 'already_confirmed', events: [] };
    var round = reminder.currentRound(meal, now);
    if (round === 0) return { ok: false, reason: 'not_due', events: [] };
    if (round >= 4) return { ok: false, reason: 'reminder_over', events: [] };

    var rec = getRecord(state, meal);
    rec.notYetRounds.push(round);
    if (round < 3) {
      return {
        ok: true,
        action: 'wait_next_round',
        nextAt: meal.time + reminder.ROUND_OFFSETS[round],
        events: []
      };
    }
    return { ok: true, action: 'notify_caregiver', events: notifyUnconfirmed(rec, meal, now) };
  }

  /**
   * BR-13: เรียกทุกครั้งที่เวลาเดิน — ถึง T+15 ยังไม่ยืนยัน → แจ้ง Caregiver 1 ครั้งต่อมื้อ
   * (ถ้าแจ้งไปแล้วตาม BR-11 ที่ T+10 จะไม่แจ้งซ้ำ)
   */
  function tick(state, meals, now) {
    var events = [];
    meals.forEach(function (meal) {
      if (reminder.isConfirmed(state, meal)) return;
      if (now < meal.time + reminder.EXPIRE_OFFSET) return;
      events = events.concat(notifyUnconfirmed(getRecord(state, meal), meal, now));
    });
    return events;
  }

  /** BR-14: สถานะของมื้อ ณ เวลา now */
  function mealStatus(state, meal, now) {
    var rec = state[meal.id];
    var code;
    var time = null;
    if (rec && rec.confirmedAt !== null) {
      code = rec.confirmedLate ? 'confirmed_late' : 'confirmed';
      time = reminder.formatTime(rec.confirmedAt);
    } else if (now < meal.time) {
      code = 'waiting';
    } else if (now < meal.time + reminder.EXPIRE_OFFSET) {
      code = 'reminding';
    } else {
      code = 'unconfirmed';
    }
    return { code: code, label: LABELS[code], time: time };
  }

  /** FR-05: หน้าสถานะรายวันของ Caregiver — ว่าง = แสดง EMPTY_DAY_MESSAGE */
  function dailyStatus(state, meals, now) {
    return meals
      .slice()
      .sort(function (a, b) { return a.time - b.time; })
      .map(function (meal) {
        return { meal: meal, status: mealStatus(state, meal, now) };
      });
  }

  /**
   * FR-04: หน้าแรกของ Senior — มื้อของวัน + สถานะ
   * showConfirmButton = มื้อที่ยังไม่ยืนยัน อยู่หลัง T+15 และยังอยู่ในช่วงยืนยันช้า (BR-15)
   */
  function seniorHome(state, meals, now) {
    return dailyStatus(state, meals, now).map(function (row) {
      var meal = row.meal;
      var overdue = row.status.code === 'unconfirmed';
      row.showConfirmButton = overdue && canConfirm(meal, meals, now).ok;
      return row;
    });
  }

  return {
    LABELS: LABELS,
    EMPTY_DAY_MESSAGE: EMPTY_DAY_MESSAGE,
    canConfirm: canConfirm,
    confirmMeal: confirmMeal,
    pressNotYet: pressNotYet,
    tick: tick,
    mealStatus: mealStatus,
    dailyStatus: dailyStatus,
    seniorHome: seniorHome
  };
});
