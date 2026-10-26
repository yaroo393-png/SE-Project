/*
 * เทสต์ FR-02 ของ Rossatorn Sangkaew / IDK-SleepyBro
 * ตรวจร่าง เวลา การยืนยัน และการคงข้อมูลยาอื่น — ไม่ใช้ DOM/นาฬิกาจริง
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const medication = require('../js/logic/medication.js');
const reminder = require('../js/logic/reminder.js');
const { createStore, KEYS } = require('../js/core/store.js');

function fixture(initial) {
  const data = Object.assign({}, initial);
  let writes = 0;
  const storage = {
    getItem: (key) => Object.hasOwn(data, key) ? data[key] : null,
    setItem: (key, value) => { data[key] = value; writes++; }
  };
  return { store: createStore(storage), data, writes: () => writes };
}

function draft(overrides) {
  return Object.assign({
    name: 'ยาตัวอย่าง', pills: 1,
    timings: [{ type: 'after', slot: 'morning' }],
    caution: '', contraindication: '', unsupported: null
  }, overrides);
}

function save(value, store, id = 'medicine-a') {
  return medication.saveMedication(value, store, reminder, { id, reviewed: true });
}

test('FR-02 ✓2: บันทึกค่าร่างที่ผู้ดูแลแก้แล้ว พร้อมข้อควรระวังและข้อห้ามใช้', () => {
  const f = fixture();
  const value = draft({ name: ' ยาที่ตรวจแล้ว ', pills: 2, caution: 'ระวังง่วง', contraindication: 'แพ้ยานี้' });
  const result = save(value, f.store);
  assert.equal(result.ok, true);
  assert.equal(result.medicines[0].name, 'ยาที่ตรวจแล้ว');
  assert.equal(result.medicines[0].dose, '2 เม็ด');
  assert.equal(result.medicines[0].caution, 'ระวังง่วง');
  assert.equal(result.medicines[0].contraindication, 'แพ้ยานี้');
  assert.deepEqual(f.store.readJSON(KEYS.medicines), result.medicines);
  value.name = 'เปลี่ยนหลังบันทึก';
  value.timings[0].slot = 'evening';
  assert.equal(result.medicines[0].name, 'ยาที่ตรวจแล้ว');
  assert.equal(result.medicines[0].timing.slot, 'morning');
});

test('FR-02 ✗3: ช่องบังคับไม่ครบ → มี error รายช่อง และไม่บันทึก', () => {
  const f = fixture();
  const result = save(draft({ name: ' ', pills: null, timings: [] }), f.store);
  assert.equal(result.ok, false);
  for (const key of ['name', 'pills', 'timings']) assert.ok(result.errors[key]);
  assert.equal(f.writes(), 0);
});

test('BR-05: ไม่มีข้อควรระวัง/ข้อห้ามบนฉลาก → ไม่บังคับและไม่แต่งข้อความเพิ่ม', () => {
  const f = fixture();
  const result = save(draft(), f.store);
  assert.equal(result.ok, true);
  assert.equal(result.medicines[0].caution, '');
  assert.equal(result.medicines[0].contraindication, '');
});

test('BR-07: จำนวนเม็ดต้องเป็นจำนวนเต็มมากกว่า 0 ทั้งค่าหลักและรายมื้อ', () => {
  for (const pills of [null, '', '1', 0, -1, 0.5, NaN, Infinity]) {
    assert.equal(medication.validateDraft(draft({ pills })).ok, false);
  }
  assert.ok(medication.validateDraft(draft({ timings: [{ type: 'bedtime', pills: 0.5 }] })).errors['timing.0.pills']);
});

test('FR-02 ✓6 / BR-05: ตั้งเวลามื้อครั้งแรกแล้วหลังอาหารเช้าเตือน 07:00', () => {
  const f = fixture();
  assert.equal(f.store.saveMealTimes({ morning: '07:00', noon: '12:00', evening: '18:00', bedtime: '21:00' }).ok, true);
  const result = save(draft(), f.store);
  assert.equal(result.ok, true);
  assert.equal(result.medicines[0].time, '07:00');
});

test('FR-02 ✗7: ตรวจร่าง/ดูเวลาก่อนกดยกเลิก → รายการที่เคยมีและจำนวนการเขียนไม่เปลี่ยน', () => {
  const initial = [{ id: 'old', name: 'ยาเดิม', dose: '1 เม็ด', time: '12:00', instruction: 'after' }];
  const f = fixture({ [KEYS.medicines]: JSON.stringify(initial) });
  const value = draft();
  assert.equal(medication.validateDraft(value).ok, true);
  assert.equal(medication.preview(value, f.store.readMealTimes(), reminder).ok, true);
  // หน้าจอปิดร่างโดยไม่เรียก saveMedication; preview ไม่มีผลข้างเคียง
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.store.readJSON(KEYS.medicines), initial);
});

test('FR-02 ✓8: ก่อนอาหารเช้า 30 นาที เช้า 07:00 → preview และค่าบันทึกคือ 06:30', () => {
  const f = fixture();
  const value = draft({ timings: [{ type: 'before', slot: 'morning', minutesBefore: 30 }] });
  const preview = medication.preview(value, f.store.readMealTimes(), reminder);
  assert.equal(preview.reminders[0].time, '06:30');
  assert.equal(save(value, f.store).medicines[0].time, '06:30');
});

test('FR-02 ✓9: ก่อนนอนไม่ต้องเลือกมื้ออาหาร ใช้เวลาเข้านอน 21:00', () => {
  const f = fixture();
  const result = save(draft({ timings: [{ type: 'bedtime' }] }), f.store);
  assert.equal(result.ok, true);
  assert.equal(result.medicines[0].time, '21:00');
  assert.equal(result.medicines[0].instruction, 'bedtime');
});

test('FR-02 ✗10: ก่อนอาหารไม่ระบุนาที → ไม่เดา และไม่บันทึก', () => {
  for (const minutesBefore of [null, '', undefined, 0, -1, 0.5, '30']) {
    const f = fixture();
    const result = save(draft({ timings: [{ type: 'before', slot: 'morning', minutesBefore }] }), f.store);
    assert.equal(result.ok, false);
    assert.ok(result.errors['timing.0.minutesBefore']);
    assert.equal(f.writes(), 0);
  }
});

test('BR-04 / NFR-06: ร่างถูกต้องแต่ยังไม่ยืนยัน → ไม่บันทึกอัตโนมัติ', () => {
  const f = fixture();
  const result = medication.saveMedication(draft(), f.store, reminder, { id: 'medicine-a' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.reviewed);
  assert.equal(f.writes(), 0);
});

test('BR-07: ยาเมื่อมีอาการ/ยาน้ำ/ยาครึ่งเม็ด → ไม่สร้างตาราง', () => {
  for (const [unsupported, message] of [
    ['prn', 'ระบบยังไม่รองรับยาเมื่อมีอาการ'],
    ['liquid', 'ระบบยังไม่รองรับยาน้ำ'],
    ['half', 'ระบบยังไม่รองรับยาครึ่งเม็ด']
  ]) {
    const f = fixture();
    const result = save(draft({ unsupported }), f.store);
    assert.equal(result.ok, false);
    assert.equal(result.errors.unsupported, message);
    assert.equal(f.writes(), 0);
  }
});

test('หลายมื้อจากฉลาก: เช้า 2 เม็ด เย็น 1 เม็ด เก็บเวลาทั้งคู่และยังอ่านด้วย schema เดิมได้', () => {
  const f = fixture();
  const result = save(draft({ pills: 2, timings: [
    { type: 'after', slot: 'morning' }, { type: 'after', slot: 'evening', pills: 1 }
  ] }), f.store);
  assert.equal(result.ok, true);
  assert.deepEqual(result.medicines.map((m) => [m.time, m.dose]), [['07:00', '2 เม็ด'], ['18:00', '1 เม็ด']]);
  assert.deepEqual(result.medicines.map((m) => m.medicationId), ['medicine-a', 'medicine-a']);
  assert.equal(new Set(result.medicines.map((m) => m.id)).size, 2);
});

test('แก้ยาหลายมื้อโดย medicationId → แทนทั้งกลุ่มและไม่ทำยาอื่นหายแม้ชื่อซ้ำ', () => {
  const f = fixture();
  save(draft({ timings: [{ type: 'after', slot: 'morning' }, { type: 'after', slot: 'evening' }] }), f.store);
  save(draft(), f.store, 'medicine-b');
  const untouched = f.store.readJSON(KEYS.medicines).find((m) => m.medicationId === 'medicine-b');
  const result = save(draft({ pills: 3, timings: [{ type: 'bedtime' }] }), f.store);
  assert.equal(result.medicines.length, 2);
  assert.deepEqual(result.medicines.find((m) => m.medicationId === 'medicine-b'), untouched);
  assert.equal(result.medicines.find((m) => m.medicationId === 'medicine-a').time, '21:00');
});

test('ลบยาโดย id ของหนึ่งมื้อ → ลบทั้งกลุ่ม ไม่ลบยาชื่อซ้ำตัวอื่น', () => {
  const f = fixture();
  save(draft({ timings: [{ type: 'after', slot: 'morning' }, { type: 'after', slot: 'evening' }] }), f.store);
  save(draft(), f.store, 'medicine-b');
  const result = medication.deleteMedication('medicine-a-0', f.store);
  assert.equal(result.ok, true);
  assert.equal(result.medicines.length, 1);
  assert.equal(result.medicines[0].medicationId, 'medicine-b');
});

test('รายการเดิมที่มี id แต่ไม่มี medicationId ยังแก้/ลบได้ และคง field ของยาอื่น', () => {
  const old = [{ id: 'old', name: 'เดิม', dose: '1 เม็ด', time: '12:00', instruction: 'after' },
    { id: 'other', name: 'อื่น', time: '18:00', extra: 'เก็บไว้' }];
  const f = fixture({ [KEYS.medicines]: JSON.stringify(old) });
  assert.equal(save(draft(), f.store, 'old').ok, true);
  assert.deepEqual(f.store.readJSON(KEYS.medicines).find((m) => m.id === 'other'), old[1]);
  assert.equal(medication.deleteMedication('other', f.store).ok, true);
});

test('เวลาอาหารผิด/ก่อนอาหารลบจนข้ามวัน → มี error เวลาและไม่เขียน', () => {
  const f = fixture();
  const value = draft({ timings: [{ type: 'before', slot: 'morning', minutesBefore: 600 }] });
  const result = save(value, f.store);
  assert.equal(result.ok, false);
  assert.ok(result.errors['timing.0.time']);
  assert.equal(f.writes(), 0);
  assert.equal(medication.preview(draft(), { morning: '25:00' }, reminder).ok, false);
});

test('มื้อ/ชนิดผิดหรือว่าง → บอกตำแหน่งให้ UI เน้นตรวจ โดยไม่เดามื้อ', () => {
  const result = medication.validateDraft(draft({ timings: [null, { type: 'after', slot: 'brunch' }] }));
  assert.equal(result.ok, false);
  assert.ok(result.errors['timing.0.type']);
  assert.ok(result.errors['timing.1.slot']);
});

test('storage ใช้ไม่ได้ → รายงานข้อผิดพลาดแทนการอ้างว่าบันทึก/ลบสำเร็จ', () => {
  const store = createStore(null);
  assert.equal(save(draft(), store).ok, false);
  const f = fixture();
  save(draft(), f.store);
  f.store.writeJSON = () => false;
  assert.equal(medication.deleteMedication('medicine-a', f.store).ok, false);
  assert.equal(f.store.readJSON(KEYS.medicines).length, 1);
});

test('รายการใน storage ผิดชนิด → ไม่เขียนทับข้อมูลเดิม', () => {
  const f = fixture({ [KEYS.medicines]: '{"unexpected":true}' });
  assert.equal(save(draft(), f.store).ok, false);
  assert.equal(medication.deleteMedication('medicine-a', f.store).ok, false);
  assert.equal(f.writes(), 0);
});

test('ลบ id ที่ไม่มี หรือบันทึกไม่มี id → ไม่เขียน storage', () => {
  const f = fixture();
  assert.equal(medication.deleteMedication('missing', f.store).ok, false);
  assert.equal(medication.saveMedication(draft(), f.store, reminder, { reviewed: true }).ok, false);
  assert.equal(f.writes(), 0);
});

test('ลบโดยไม่ส่ง id → ไม่ลบรายการเก่าที่ไม่มี id', () => {
  const old = [{ name: 'ยาเดิม', dose: '1 เม็ด', time: '07:00', instruction: 'after' }];
  const f = fixture({ [KEYS.medicines]: JSON.stringify(old) });
  for (const id of [undefined, null, '', ' ']) assert.equal(medication.deleteMedication(id, f.store).ok, false);
  assert.deepEqual(f.store.readJSON(KEYS.medicines), old);
  assert.equal(f.writes(), 0);
});

test('แก้ยาเก่าไม่มี id ด้วย legacyIndex → แทนเฉพาะแถวที่เลือกแม้ชื่อเหมือนกัน', () => {
  const old = [
    { name: 'ยาเดิม', dose: '1 เม็ด', time: '07:00', instruction: 'after' },
    { name: 'ยาเดิม', dose: '2 เม็ด', time: '18:00', instruction: 'after' }
  ];
  const f = fixture({ [KEYS.medicines]: JSON.stringify(old) });
  const result = medication.saveMedication(draft({ pills: 3 }), f.store, reminder, {
    id: 'legacy-0', legacyIndex: 0, reviewed: true
  });
  assert.equal(result.ok, true);
  assert.equal(result.medicines.length, 2);
  assert.deepEqual(result.medicines[0], old[1]);
  assert.equal(result.medicines[1].medicationId, 'legacy-0');
  assert.equal(result.medicines[1].dose, '3 เม็ด');
});

test('ลบยาเก่าไม่มี id ด้วย legacyIndex → ลบเฉพาะแถว ไม่ลบทุกชื่อซ้ำ', () => {
  const old = [
    { name: 'ยาเดิม', dose: '1 เม็ด', time: '07:00' },
    { name: 'ยาเดิม', dose: '2 เม็ด', time: '18:00' }
  ];
  const f = fixture({ [KEYS.medicines]: JSON.stringify(old) });
  const result = medication.deleteMedication('legacy-1', f.store, { legacyIndex: 1 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.medicines, [old[0]]);
});

test('legacyIndex ผิด/ชี้รายการที่มี id แล้ว → ไม่เขียนทับหรือย้ายข้อมูลเงียบ ๆ', () => {
  const old = [{ name: 'ยาเดิม' }, { id: 'known', name: 'มี id แล้ว' }, { medicationId: 'group', name: 'มีกลุ่มแล้ว' }];
  for (const legacyIndex of [-1, 0.5, '0', 1, 2, 3, null]) {
    const f = fixture({ [KEYS.medicines]: JSON.stringify(old) });
    assert.equal(medication.saveMedication(draft(), f.store, reminder, { id: 'new', legacyIndex, reviewed: true }).ok, false);
    assert.equal(medication.deleteMedication('legacy-' + legacyIndex, f.store, { legacyIndex }).ok, false);
    assert.deepEqual(f.store.readJSON(KEYS.medicines), old);
    assert.equal(f.writes(), 0);
  }
  const empty = fixture();
  assert.equal(medication.saveMedication(draft(), empty.store, reminder, { id: 'new', legacyIndex: 0, reviewed: true }).ok, false);
  assert.equal(empty.writes(), 0);
});

test('แก้ยา legacy โดย id ซ้ำกลุ่มที่มีอยู่ → ไม่สร้างกลุ่มซ้ำ', () => {
  const old = [{ name: 'ยังไม่มี id' }, { id: 'legacy-0-0', medicationId: 'legacy-0', name: 'แก้ไปแล้ว' }];
  const f = fixture({ [KEYS.medicines]: JSON.stringify(old) });
  const result = medication.saveMedication(draft(), f.store, reminder, { id: 'legacy-0', legacyIndex: 0, reviewed: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.id);
  assert.equal(f.writes(), 0);
});

test('อ่านเวลามื้อแล้ว storage โยนข้อผิดพลาด → คืน error ให้ UI แทนการล้ม', () => {
  const f = fixture();
  f.store.readMealTimes = () => { throw new Error('storage unavailable'); };
  const result = save(draft(), f.store);
  assert.equal(result.ok, false);
  assert.ok(result.errors.storage);
  assert.equal(f.writes(), 0);
});

test('BR-06: เปลี่ยนเวลามื้อแล้ว resolveTimes ใช้เวลาล่าสุดกับทุกคำสั่ง โดยไม่แก้รายการเดิม', () => {
  const rows = [
    { id: 'after', time: '07:00', timing: { type: 'after', slot: 'morning' } },
    { id: 'before', time: '06:30', timing: { type: 'before', slot: 'morning', minutesBefore: 30 } },
    { id: 'bedtime', time: '21:00', timing: { type: 'bedtime' } }
  ];
  const original = JSON.parse(JSON.stringify(rows));
  const times = { morning: '08:00', noon: '12:00', evening: '18:00', bedtime: '22:30' };
  const resolved = medication.resolveTimes(rows, times, reminder);
  assert.deepEqual(resolved.map((row) => row.time), ['08:00', '07:30', '22:30']);
  assert.ok(resolved.every((row) => row.needsReview === false));
  assert.deepEqual(rows, original);
  assert.notEqual(resolved[0], rows[0]);
});

test('resolveTimes คงรายการเก่าที่มีแต่เวลา ไม่เดาว่าเป็นมื้อใดและไม่เขียน storage', () => {
  const rows = [{ name: 'ยาเก่า', time: '10:15', instruction: 'any' }];
  const f = fixture({ [KEYS.medicines]: JSON.stringify(rows) });
  const resolved = medication.resolveTimes(f.store.readJSON(KEYS.medicines), f.store.readMealTimes(), reminder);
  assert.deepEqual(resolved, rows);
  assert.deepEqual(f.store.readJSON(KEYS.medicines), rows);
  assert.equal(f.writes(), 0);
});

test('resolveTimes คำนวณไม่ได้หลังเปลี่ยนมื้อ → ห้ามใช้เวลาเก่าและรอผู้ดูแลตรวจ', () => {
  const times = { morning: '00:15', noon: '12:00', evening: '18:00', bedtime: '25:00' };
  const rows = [
    { time: '06:30', timing: { type: 'before', slot: 'morning', minutesBefore: 30 } },
    { time: '21:00', timing: { type: 'bedtime' } },
    { time: '07:00', timing: { type: 'after', slot: 'unknown' } },
    { time: '07:00', timing: null }
  ];
  const resolved = medication.resolveTimes(rows, times, reminder);
  assert.ok(resolved.every((row) => row.time === '' && row.needsReview === true));
  assert.deepEqual(rows.map((row) => row.time), ['06:30', '21:00', '07:00', '07:00']);
});

test('resolveTimes ป้องกันรายการผิดชนิด และไม่ทิ้งแถวอื่นเงียบ ๆ', () => {
  assert.deepEqual(medication.resolveTimes(null, {}, reminder), []);
  assert.deepEqual(medication.resolveTimes([null, 'invalid', { name: 'ยาเดิม', time: '12:00' }], {}, reminder),
    [null, 'invalid', { name: 'ยาเดิม', time: '12:00' }]);
});
