/*
 * เทสต์ของ js/logic/labelForm.js — ร่างจากฉลาก → ค่าในฟอร์มเพิ่มยา · FR-02 ✓1, ✗3, ✗4, ✗10 · BR-04, BR-06
 * ใช้ labelParser + reminder ของจริง เพื่อเทสต์ต่อกันทั้งสาย (ข้อความฉลาก → ฟอร์ม)
 * รัน: npm test
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { toForm, timingText } = require('../js/logic/labelForm.js');
const { parseLabel } = require('../js/logic/labelParser.js');
const reminder = require('../js/logic/reminder.js');

const MEALS = { morning: '07:00', noon: '12:00', evening: '18:00', bedtime: '21:00' };
const form = (text, meals = MEALS) => toForm(parseLabel(text).draft, meals, reminder);

test('FR-02 ✓1 + ✓6: ฉลากชัด "หลังอาหารเช้า" → เติมครบ เวลา 07:00', () => {
  const f = form('AMLODIPINE 5 MG TAB\nรับประทานครั้งละ 1 เม็ด\nหลังอาหาร เช้า');
  assert.deepEqual(f.fields, { name: 'AMLODIPINE 5 MG', dose: '1 เม็ด', time: '07:00', instruction: 'after' });
  assert.deepEqual(f.missing, []);
  assert.equal(f.unsupported, null);
});

test('FR-02 ✓8: "ก่อนอาหารเช้า 30 นาที" + เช้า 07:00 → 06:30', () => {
  const f = form('OMEPRAZOLE 20 MG CAP\nครั้งละ 1 แคปซูล\nก่อนอาหารเช้า 30 นาที');
  assert.equal(f.fields.time, '06:30');
  assert.equal(f.fields.instruction, 'before');
});

test('FR-02 ✓9: "ก่อนนอน" + เข้านอน 21:00 → 21:00', () => {
  const f = form('CHLORPHENIRAMINE 4 MG\nครั้งละ 1 เม็ด ก่อนนอน');
  assert.equal(f.fields.time, '21:00');
  assert.deepEqual(f.timings, ['ก่อนนอน (21:00)']);
});

test('BR-06: เวลาเตือนตามเวลามื้อที่ผู้ดูแลตั้ง ไม่ใช่ค่าตายตัว', () => {
  const f = form('AMLODIPINE 5 MG\nครั้งละ 1 เม็ด หลังอาหารเช้า', { ...MEALS, morning: '08:15' });
  assert.equal(f.fields.time, '08:15');
});

test('FR-02 ✗3 / BR-04: อ่านชื่อยาและจำนวนเม็ดไม่ได้ → ช่องว่าง + อยู่ใน missing (ไม่เดา)', () => {
  const f = form('ร บ ป ร ะ … เม็ด\nหลังอาหาร เย็น');
  assert.equal(f.fields.name, '');
  assert.equal(f.fields.dose, '');
  assert.equal(f.fields.time, '18:00');
  assert.deepEqual(f.missing, ['name', 'dose']);
});

test('FR-02 ✗10: "ก่อนอาหาร" ไม่ระบุนาที → เวลาว่าง (ไม่เดา) + แสดง "… นาที"', () => {
  const f = form('GLICLAZIDE 80 MG\nครั้งละ 1 เม็ด ก่อนอาหารเช้า');
  assert.equal(f.fields.time, '');
  assert.ok(f.missing.includes('time'));
  assert.deepEqual(f.timings, ['ก่อนอาหารเช้า … นาที']);
});

test('ฉลากหลายมื้อ → เติมมื้อแรก และคืนรายการทุกมื้อให้หน้าจอแสดง', () => {
  const f = form('METFORMIN 500 MG\nครั้งละ 2 เม็ด\nหลังอาหาร เช้า - เย็น');
  assert.equal(f.fields.time, '07:00');
  assert.deepEqual(f.timings, ['หลังอาหารเช้า (07:00)', 'หลังอาหารเย็น (18:00)']);
});

test('FR-02 ✗4 / BR-07: ยาเมื่อมีอาการ → unsupported (หน้าจอต้องห้ามบันทึก)', () => {
  const f = form('PARACETAMOL 500 MG\nครั้งละ 1-2 เม็ด ทุก 4-6 ชั่วโมง เวลาปวด หรือมีไข้');
  assert.equal(f.unsupported, 'ระบบยังไม่รองรับยาเมื่อมีอาการ');
});

test('BR-04: ช่องที่ระบบแก้คำที่อ่านเพี้ยนให้ → เติมค่าแต่อยู่ใน unsure (หน้าจอเน้นให้ตรวจ)', () => {
  const f = form('AMLODIP INE 5 MG\nรับประทานครั้งละ | เม็ด หลังอาหารเช้า');
  assert.equal(f.fields.name, 'AMLODIPINE 5 MG');
  assert.equal(f.fields.dose, '1 เม็ด');
  assert.deepEqual(f.unsure, ['name', 'dose']);
  assert.deepEqual(f.missing, []);
});

test('ร่างว่าง (กรอกเอง) → ทุกช่องว่าง', () => {
  const f = toForm({ name: '', pills: null, timings: [] }, MEALS, reminder);
  assert.deepEqual(f.missing, ['name', 'dose', 'time', 'instruction']);
  assert.equal(timingText(null), '…');
});
