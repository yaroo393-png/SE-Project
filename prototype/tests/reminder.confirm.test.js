/*
 * เทสต์ของ reminder.js + confirm.js — AC ของ FR-03 (ข้อ 1–4), FR-04 (ข้อ 1–6), FR-05 บางข้อ และ BR-06
 * รัน: node --test prototype/tests/reminder.confirm.test.js
 * เวลาเป็นนาทีนับจากเที่ยงคืน ใช้ t('08:03') แทนนาฬิกาจำลอง
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const reminder = require('../js/logic/reminder.js');
const confirm = require('../js/logic/confirm.js');

const t = reminder.parseTime;
const SETTINGS = { morning: '08:00', noon: '12:00', evening: '18:00', bedtime: '21:00' };

function dose(name, timing, pills = 1) {
  return { id: name, name, pills, caution: 'ข้อควรระวัง ' + name, contraindication: 'ข้อห้าม ' + name, timing };
}
const after = (slot) => ({ type: 'after', slot });
const before = (slot, minutesBefore) => ({ type: 'before', slot, minutesBefore });

/** มื้อ 08:00 มียา 2 ตัว + มื้อ 12:00 (ใช้กับ FR-03 ✓1, FR-04) */
function dayFixture() {
  const { meals } = reminder.buildMeals(
    [dose('A', after('morning')), dose('B', after('morning')), dose('C', after('noon'))],
    SETTINGS
  );
  return { meals, breakfast: meals[0], lunch: meals[1], state: {} };
}

// ---------- BR-06: เวลาเตือนจากฉลากเท่านั้น ----------
test('BR-06: หลังอาหารเช้า, เช้า 07:00 → เตือน 07:00 (FR-02 ✓6)', () => {
  const s = { ...SETTINGS, morning: '07:00' };
  assert.equal(reminder.reminderTime(dose('x', after('morning')), s), t('07:00'));
});

test('BR-06: ก่อนอาหารเช้า 30 นาที, เช้า 07:00 → เตือน 06:30 (FR-02 ✓8)', () => {
  const s = { ...SETTINGS, morning: '07:00' };
  assert.equal(reminder.reminderTime(dose('x', before('morning', 30)), s), t('06:30'));
});

test('BR-06: ก่อนนอน, เข้านอน 21:00 → เตือน 21:00 (FR-02 ✓9)', () => {
  assert.equal(reminder.reminderTime(dose('x', { type: 'bedtime' }), SETTINGS), t('21:00'));
});

test('BR-06: ก่อนอาหารไม่ระบุจำนวนนาที → null ไม่เดา (FR-02 ✗10) และไม่ถูกจัดเป็นมื้อ', () => {
  const d = dose('x', { type: 'before', slot: 'morning' });
  assert.equal(reminder.reminderTime(d, SETTINGS), null);
  const { meals, needsReview } = reminder.buildMeals([d], SETTINGS);
  assert.equal(meals.length, 0);
  assert.deepEqual(needsReview, [d]);
});

test('BR-06: ยาที่เวลาเตือนตรงกันรวมเป็นมื้อเดียว และมื้อเรียงตามเวลา', () => {
  const { meals } = reminder.buildMeals(
    [dose('noon', after('noon')), dose('A', after('morning')), dose('B', after('morning'))],
    SETTINGS
  );
  assert.equal(meals.length, 2);
  assert.equal(meals[0].label, '08:00');
  assert.deepEqual(meals[0].doses.map((d) => d.name), ['A', 'B']);
  assert.equal(meals[1].label, '12:00');
});

// ---------- FR-03 ----------
test('FR-03 ✓1: ถึง 08:00 → เสียงเตือน 1 ครั้ง + แสดงยาทั้ง 2 ตัวของมื้อในหน้าเดียว', () => {
  const { meals, state, breakfast } = dayFixture();
  const r = reminder.dueReminders(meals, state, t('08:00'));
  assert.equal(r.sound, true);
  assert.deepEqual(r.firing.map((f) => [f.meal.id, f.round]), [[breakfast.id, 1]]);
  assert.equal(r.display.length, 1);
  assert.equal(r.display[0].doses.length, 2);
  for (const d of r.display[0].doses) {
    assert.ok(d.name && d.pills && d.caution && d.contraindication);
  }
});

test('FR-03 ✗2: ยังไม่ยืนยัน → แจ้งซ้ำที่ 08:05 และ 08:10 พร้อมเสียง', () => {
  const { meals, state } = dayFixture();
  const r5 = reminder.dueReminders(meals, state, t('08:05'));
  assert.equal(r5.sound, true);
  assert.equal(r5.firing[0].round, 2);
  const r10 = reminder.dueReminders(meals, state, t('08:10'));
  assert.equal(r10.sound, true);
  assert.equal(r10.firing[0].round, 3);
});

test('FR-03: เวลาที่ไม่ใช่รอบเตือน (08:03, 08:15) ไม่มีเสียงเตือนซ้ำ', () => {
  const { meals, state } = dayFixture();
  assert.equal(reminder.dueReminders(meals, state, t('08:03')).sound, false);
  assert.equal(reminder.dueReminders(meals, state, t('08:15')).sound, false);
});

test('FR-03 ✓3: ยืนยันแล้ว → ถึงรอบถัดไปไม่แจ้งซ้ำ', () => {
  const { meals, state, breakfast } = dayFixture();
  confirm.confirmMeal(state, breakfast, meals, t('08:03'));
  assert.equal(reminder.dueReminders(meals, state, t('08:05')).sound, false);
  assert.equal(reminder.dueReminders(meals, state, t('08:10')).sound, false);
});

test('FR-03 ✗4 / BR-16: มื้อ A 06:45 ยังไม่ยืนยัน + มื้อ B 07:00 → หน้าเตือนแสดงทั้ง 2 มื้อเรียงตามเวลา เสียงครั้งเดียว', () => {
  const s = { ...SETTINGS, morning: '07:00' };
  const { meals } = reminder.buildMeals(
    [dose('A', before('morning', 15)), dose('B', after('morning'))],
    s
  );
  const [mealA, mealB] = meals;
  assert.equal(mealA.label, '06:45');
  assert.equal(mealB.label, '07:00');

  const state = {};
  const r = reminder.dueReminders(meals, state, t('07:00'));
  assert.equal(r.sound, true);
  assert.deepEqual(r.display.map((m) => m.label), ['06:45', '07:00']);
  assert.deepEqual(r.firing.map((f) => f.meal.id), [mealB.id]); // รอบของ A หมดแล้ว

  // มื้อ A แจ้ง Caregiver ที่ 07:00 ตามรอบของตัวเอง (T+15) — มื้อ B ยังไม่แจ้ง
  const events = confirm.tick(state, meals, t('07:00'));
  assert.deepEqual(events.map((e) => e.mealId), [mealA.id]);

  // ยืนยันมื้อ A ไม่ทำให้มื้อ B ถูกยืนยันไปด้วย (ปุ่มแยกกัน)
  confirm.confirmMeal(state, mealA, meals, t('07:01'));
  assert.equal(reminder.isConfirmed(state, mealA), true);
  assert.equal(reminder.isConfirmed(state, mealB), false);
});

// ---------- FR-04 ----------
test('FR-04 ✓1: เตือนมื้อ 08:00 อยู่ กด "กินแล้ว" 08:03 → สถานะ "กินแล้ว" + 08:03 และหยุดเตือน', () => {
  const { meals, state, breakfast } = dayFixture();
  const res = confirm.confirmMeal(state, breakfast, meals, t('08:03'));
  assert.equal(res.ok, true);
  assert.equal(res.late, false);
  assert.deepEqual(res.events, []); // ยืนยันทันเวลา ไม่แจ้ง Caregiver (FR-05 ✓1)
  const status = confirm.mealStatus(state, breakfast, t('08:03'));
  assert.equal(status.code, 'confirmed');
  assert.equal(status.label, 'กินแล้ว');
  assert.equal(status.time, '08:03');
  assert.equal(reminder.activeReminderMeals(meals, state, t('08:04')).length, 0);
});

test('FR-04 ✗2 / NFR-07: กด "กินแล้ว" ซ้ำ → ไม่สร้างบันทึกซ้ำ', () => {
  const { meals, state, breakfast } = dayFixture();
  confirm.confirmMeal(state, breakfast, meals, t('08:03'));
  const again = confirm.confirmMeal(state, breakfast, meals, t('08:07'));
  assert.equal(again.ok, true);
  assert.equal(again.duplicate, true);
  assert.equal(state[breakfast.id].confirmedAt, t('08:03'));
  assert.equal(state[breakfast.id].confirmationLog.length, 1);
});

test('FR-04 ✓3: เตือนรอบแรก 08:00 กด "ยังไม่กิน" → เตือนอีกครั้ง 08:05 (ไม่แจ้ง Caregiver)', () => {
  const { meals, state, breakfast } = dayFixture();
  const res = confirm.pressNotYet(state, breakfast, meals, t('08:00'));
  assert.equal(res.ok, true);
  assert.equal(res.action, 'wait_next_round');
  assert.equal(res.nextAt, t('08:05'));
  assert.deepEqual(res.events, []);
  assert.equal(reminder.dueReminders(meals, state, t('08:05')).sound, true);
});

test('FR-04 ✗4: เตือนรอบสุดท้าย 08:10 กด "ยังไม่กิน" → แจ้ง Caregiver ทันที (ไม่รอ 08:15)', () => {
  const { meals, state, breakfast } = dayFixture();
  const res = confirm.pressNotYet(state, breakfast, meals, t('08:10'));
  assert.equal(res.action, 'notify_caregiver');
  assert.equal(res.events.length, 1);
  assert.match(res.events[0].text, /ยังไม่ยืนยันการกินยา/);
  assert.doesNotMatch(res.events[0].text, /ไม่ได้กิน/);
  // FR-05 ✓5: ถึง 08:15 ไม่แจ้งซ้ำ
  assert.deepEqual(confirm.tick(state, meals, t('08:15')), []);
});

test('FR-04 ✓5 / FR-05 ✓6: ไม่ยืนยันจนเลย 08:15 → กด "กินแล้ว" จากหน้าแรก 08:40 = "กินแล้ว (ยืนยันช้า)" + แจ้ง Caregiver', () => {
  const { meals, state, breakfast } = dayFixture();
  const notices = confirm.tick(state, meals, t('08:15'));
  assert.equal(notices.length, 1);

  const home = confirm.seniorHome(state, meals, t('08:40'));
  assert.equal(home[0].status.code, 'unconfirmed');
  assert.equal(home[0].showConfirmButton, true);

  const res = confirm.confirmMeal(state, breakfast, meals, t('08:40'));
  assert.equal(res.ok, true);
  assert.equal(res.late, true);
  assert.equal(res.events[0].text, 'ยืนยันการกินยาแล้ว เวลา 08:40');
  const status = confirm.mealStatus(state, breakfast, t('08:40'));
  assert.equal(status.code, 'confirmed_late');
  assert.equal(status.label, 'กินแล้ว (ยืนยันช้า)');
  assert.equal(status.time, '08:40');
});

test('FR-04 ✗6 / BR-15: เลยเวลาเตือนมื้อถัดไป (12:00) พยายามยืนยันมื้อ 08:00 → ไม่ได้ สถานะคง "ยังไม่ยืนยัน"', () => {
  const { meals, state, breakfast } = dayFixture();
  assert.equal(confirm.confirmMeal({}, breakfast, meals, t('11:59')).ok, true); // ก่อน 12:00 ยังได้
  const res = confirm.confirmMeal(state, breakfast, meals, t('12:00'));
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'window_closed');
  assert.equal(confirm.mealStatus(state, breakfast, t('12:00')).code, 'unconfirmed');
  assert.equal(confirm.seniorHome(state, meals, t('12:00'))[0].showConfirmButton, false);
});

test('BR-15: ไม่มีมื้อถัดไป → ยืนยันช้าได้ถึง 23:59', () => {
  const { meals, lunch } = dayFixture();
  assert.equal(confirm.confirmMeal({}, lunch, meals, t('23:59')).ok, true);
});

test('BR-15: ยืนยันก่อนถึงเวลามื้อไม่ได้', () => {
  const { meals, state, breakfast } = dayFixture();
  const res = confirm.confirmMeal(state, breakfast, meals, t('07:59'));
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'not_due');
});

// ---------- FR-05 / BR-13 / BR-14 ที่เกี่ยวกับ FR-03/04 ----------
test('FR-05 ✓1: Senior ยืนยัน 08:12 → ถึง 08:15 ไม่แจ้ง Caregiver', () => {
  const { meals, state, breakfast } = dayFixture();
  confirm.confirmMeal(state, breakfast, meals, t('08:12'));
  assert.deepEqual(confirm.tick(state, meals, t('08:15')), []);
});

test('FR-05 ✗2 / BR-13: ไม่มีการยืนยัน → 08:15 แจ้ง "ยังไม่ยืนยันการกินยา" ครั้งเดียว ไม่ใช้คำว่า "ไม่ได้กิน"', () => {
  const { meals, state } = dayFixture();
  const first = confirm.tick(state, meals, t('08:15'));
  assert.equal(first.length, 1);
  assert.match(first[0].text, /ยังไม่ยืนยันการกินยา/);
  assert.doesNotMatch(first[0].text, /ไม่ได้กิน/);
  assert.deepEqual(confirm.tick(state, meals, t('08:16')), []); // ไม่แจ้งซ้ำ
});

test('BR-14 / FR-05 ✓3: หน้าสถานะรายวันแสดงทุกมื้อ — รอถึงเวลา / ยังไม่ยืนยัน', () => {
  const { meals, state } = dayFixture();
  const rows = confirm.dailyStatus(state, meals, t('09:00'));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].status.label, 'ยังไม่ยืนยัน'); // 08:00 เลย T+15 แล้ว
  assert.equal(rows[1].status.label, 'รอถึงเวลา'); // 12:00
});

test('FR-05 ✗4: ยังไม่มีมื้อยาในวัน → รายการว่างและมีข้อความ empty state', () => {
  assert.deepEqual(confirm.dailyStatus({}, [], t('09:00')), []);
  assert.equal(confirm.EMPTY_DAY_MESSAGE, 'ยังไม่มีมื้อยาวันนี้');
});

test('BR-16: มื้อซ้อนกันนับช่วงยืนยันช้าแยกกัน (มื้อ 07:10 ปิดช่วงยืนยันช้าของมื้อ 06:45)', () => {
  const { meals } = reminder.buildMeals(
    [
      { id: 'a', name: 'a', pills: 1, timing: { type: 'before', slot: 'morning', minutesBefore: 15 } },
      { id: 'b', name: 'b', pills: 1, timing: { type: 'after', slot: 'noon' } }
    ],
    { ...SETTINGS, morning: '07:00', noon: '07:10' }
  );
  const [a, b] = meals;
  assert.equal(reminder.lateWindowEnd(a, meals), t('07:10')); // มื้อ b เริ่มหลัง 07:00 (= T+15 ของ a)
  assert.equal(reminder.lateWindowEnd(b, meals), reminder.END_OF_DAY);
  assert.equal(confirm.confirmMeal({}, a, meals, t('07:10')).ok, false);
  assert.equal(confirm.confirmMeal({}, b, meals, t('07:10')).ok, true);
});

// ───────── issue #49 (FR-03 + FR-04 ต่อหน้าเว็บ): AC ที่ยังไม่มีเทสต์ครอบ ─────────

test('FR-03 / BR-08: นาฬิกาจำลองเดินทีละนาที → เตือนเฉพาะ T, T+5, T+10 (รวม 3 ครั้ง) เสียง 1 ครั้งต่อรอบ', () => {
  const { meals } = reminder.buildMeals([dose('a', after('morning'), 1)], SETTINGS);
  const meal = meals[0];
  const rounds = [];
  for (let now = meal.time - 3; now <= meal.time + 20; now++) {
    const due = reminder.dueReminders(meals, {}, now); // prevNow = now - 1 เหมือนปุ่ม +1 นาที
    if (due.firing.length) {
      assert.equal(due.sound, true);
      rounds.push(now - meal.time);
    } else {
      assert.equal(due.sound, false);
    }
  }
  assert.deepEqual(rounds, [0, 5, 10]);
});

test('FR-03: ข้ามเวลาด้วยปุ่ม +5 (prevNow→now) ยังเจอรอบเตือนที่ตกในช่วงนั้น', () => {
  const { meals } = reminder.buildMeals([dose('a', after('morning'), 1)], SETTINGS);
  const T = meals[0].time;
  const due = reminder.dueReminders(meals, {}, T + 5, T); // กด +5 จาก T
  assert.equal(due.firing.length, 1);
  assert.equal(due.firing[0].round, 2);
  assert.equal(reminder.dueReminders(meals, {}, T + 5, T + 5).sound, false); // เวลาไม่เดิน ไม่เตือนซ้ำ
});

test('FR-04 ✓3: "ยังไม่กิน" รอบ 2 (08:05) → เตือนอีกครั้ง 08:10 และไม่แจ้ง Caregiver', () => {
  const { meals } = reminder.buildMeals([dose('a', after('morning'), 1)], SETTINGS);
  const [meal] = meals;
  const state = {};
  const res = confirm.pressNotYet(state, meal, meals, meal.time + 5);
  assert.equal(res.ok, true);
  assert.equal(res.action, 'wait_next_round');
  assert.equal(res.nextAt, meal.time + 10);
  assert.deepEqual(res.events, []);
});

test('FR-04: กด "ยังไม่กิน" ก่อนถึงเวลา / หลังหมดรอบเตือน / หลังยืนยันแล้ว → ไม่รับ', () => {
  const { meals } = reminder.buildMeals([dose('a', after('morning'), 1)], SETTINGS);
  const [meal] = meals;
  assert.equal(confirm.pressNotYet({}, meal, meals, meal.time - 1).reason, 'not_due');
  assert.equal(confirm.pressNotYet({}, meal, meals, meal.time + 15).reason, 'reminder_over');
  const state = {};
  confirm.confirmMeal(state, meal, meals, meal.time + 1);
  assert.equal(confirm.pressNotYet(state, meal, meals, meal.time + 2).reason, 'already_confirmed');
});

test('BR-13: แจ้ง "ยังไม่ยืนยัน" ที่ T+10 แล้ว ถึง T+15 ไม่แจ้งซ้ำ และยืนยันช้าทีหลังส่งข้อความตามหลังให้ Caregiver', () => {
  const { meals } = reminder.buildMeals([dose('a', after('morning'), 1)], SETTINGS);
  const [meal] = meals;
  const state = {};
  const first = confirm.pressNotYet(state, meal, meals, meal.time + 10);
  assert.equal(first.events.length, 1);
  assert.equal(confirm.tick(state, meals, meal.time + 15).length, 0);
  const late = confirm.confirmMeal(state, meal, meals, meal.time + 20);
  assert.equal(late.late, true);
  assert.equal(late.events[0].kind, 'confirmed');
  assert.equal(state[meal.id].confirmationLog.length, 1);
});

test('FR-04 ✗2 / NFR-07: กดซ้ำหลังยืนยันช้า → duplicate, เวลาเดิม, ไม่แจ้ง Caregiver ซ้ำ', () => {
  const { meals } = reminder.buildMeals([dose('a', after('morning'), 1)], SETTINGS);
  const [meal] = meals;
  const state = {};
  confirm.confirmMeal(state, meal, meals, meal.time + 30);
  const again = confirm.confirmMeal(state, meal, meals, meal.time + 45);
  assert.equal(again.duplicate, true);
  assert.deepEqual(again.events, []);
  assert.equal(state[meal.id].confirmedAt, meal.time + 30);
  assert.equal(state[meal.id].confirmationLog.length, 1);
});

test('FR-04 ✓5: หน้าแรก Senior — ปุ่ม "กินแล้ว" โผล่เฉพาะมื้อที่เลย T+15 และยังยืนยันได้; หายเมื่อยืนยัน', () => {
  const { meals } = reminder.buildMeals([dose('a', after('morning'), 1)], SETTINGS);
  const [meal] = meals;
  const state = {};
  assert.equal(confirm.seniorHome(state, meals, meal.time - 10)[0].showConfirmButton, false); // รอถึงเวลา
  assert.equal(confirm.seniorHome(state, meals, meal.time + 5)[0].showConfirmButton, false); // กำลังเตือน (ใช้หน้าเตือน)
  const overdue = confirm.seniorHome(state, meals, meal.time + 15)[0];
  assert.equal(overdue.status.code, 'unconfirmed');
  assert.equal(overdue.showConfirmButton, true);
  confirm.confirmMeal(state, meal, meals, meal.time + 16);
  const done = confirm.seniorHome(state, meals, meal.time + 17)[0];
  assert.equal(done.status.code, 'confirmed_late');
  assert.equal(done.showConfirmButton, false);
});

test('FR-04 ✓1: ยืนยันที่ T+14 ยังเป็น "กินแล้ว" (ไม่ช้า) และไม่แจ้ง Caregiver; T+15 พอดีนับว่าช้า', () => {
  const { meals } = reminder.buildMeals([dose('a', after('morning'), 1)], SETTINGS);
  const [meal] = meals;
  const onTime = confirm.confirmMeal({}, meal, meals, meal.time + 14);
  assert.equal(onTime.late, false);
  assert.deepEqual(onTime.events, []);
  assert.equal(confirm.confirmMeal({}, meal, meals, meal.time + 15).late, true);
});

test('FR-03 ✓3: ยืนยันระหว่างเตือนแล้ว display ว่าง — มื้อที่ยืนยันไม่ถูกแสดงอีก', () => {
  const { meals } = reminder.buildMeals([dose('a', after('morning'), 1)], SETTINGS);
  const [meal] = meals;
  const state = {};
  confirm.confirmMeal(state, meal, meals, meal.time + 1);
  const due = reminder.dueReminders(meals, state, meal.time + 5, meal.time + 4);
  assert.deepEqual(due, { firing: [], display: [], sound: false });
  assert.deepEqual(reminder.activeReminderMeals(meals, state, meal.time + 5), []);
});
