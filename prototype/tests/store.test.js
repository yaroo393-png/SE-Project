/*
 * เทสต์ของ js/core/store.js — ชื่อ key ร่วม + เวลามื้ออาหาร (BR-05)
 * รัน: npm test
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore, KEYS, DEFAULT_MEAL_TIMES, isTime } = require('../js/core/store.js');

/** localStorage จำลองสำหรับเทสต์ */
function fakeStorage(initial) {
  const data = Object.assign({}, initial);
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data
  };
}

test('ยังไม่ตั้งเวลามื้อ → ค่าเริ่มต้น (เช้า 07:00 ตาม FR-02 ✓6) และบอกว่าเป็นค่าเริ่มต้น', () => {
  const t = createStore(fakeStorage()).readMealTimes();
  assert.deepEqual(t, { morning: '07:00', noon: '12:00', evening: '18:00', bedtime: '21:00', isDefault: true });
});

test('BR-05: บันทึกเวลามื้อแล้วอ่านกลับได้ค่าเดิม', () => {
  const storage = fakeStorage();
  const store = createStore(storage);
  assert.deepEqual(store.saveMealTimes({ morning: '06:30', noon: '11:45', evening: '17:30', bedtime: '20:00' }), { ok: true });
  assert.deepEqual(store.readMealTimes(), { morning: '06:30', noon: '11:45', evening: '17:30', bedtime: '20:00', isDefault: false });
  assert.ok(KEYS.mealTimes in storage.data);
});

test('เวลาไม่ครบหรือผิดรูป → ไม่บันทึก', () => {
  const store = createStore(fakeStorage());
  assert.deepEqual(store.saveMealTimes({ morning: '07:00', noon: '12:00', evening: '18:00' }), { ok: false, reason: 'invalid_time' });
  assert.deepEqual(store.saveMealTimes({ morning: '7:00', noon: '12:00', evening: '18:00', bedtime: '21:00' }), { ok: false, reason: 'invalid_time' });
  assert.equal(store.readMealTimes().isDefault, true);
});

test('ข้อมูลใน storage เสีย (ไม่ใช่ JSON) → ใช้ค่าเริ่มต้น ไม่ error', () => {
  const store = createStore(fakeStorage({ [KEYS.mealTimes]: '{เสีย' }));
  assert.equal(store.readMealTimes().morning, DEFAULT_MEAL_TIMES.morning);
});

test('ไม่มี storage (เช่น โหมดส่วนตัวบางเบราว์เซอร์) → อ่านได้ค่าเริ่มต้น บันทึกไม่สำเร็จแต่ไม่ error', () => {
  const store = createStore(null);
  assert.equal(store.readMealTimes().isDefault, true);
  assert.deepEqual(store.saveMealTimes(DEFAULT_MEAL_TIMES), { ok: false, reason: 'storage_unavailable' });
});

test('key เดิมของหน้า demo ไม่เปลี่ยน (ข้อมูลที่บันทึกไว้แล้วไม่หาย)', () => {
  assert.equal(KEYS.medicines, 'medmind-meds');
  assert.equal(KEYS.pairing, 'medmind-pairing');
  assert.equal(KEYS.taken, 'medmind-taken');
  assert.equal(isTime('23:59'), true);
  assert.equal(isTime('24:00'), false);
});
