/*
 * เทสต์ของ js/core/role.js — เลือกบทบาทก่อนเข้าแอป (ผู้สูงอายุ / ผู้ดูแล) · FR-01
 * รัน: npm test
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const role = require('../js/core/role.js');

/** sessionStorage จำลอง · broken = เบราว์เซอร์ที่เก็บข้อมูลไม่ได้ (เช่น โหมดส่วนตัวบางแบบ) */
function fakeStorage(broken = false) {
  const data = {};
  return {
    data,
    getItem: (k) => { if (broken) throw new Error('blocked'); return k in data ? data[k] : null; },
    setItem: (k, v) => { if (broken) throw new Error('blocked'); data[k] = String(v); }
  };
}
/** location จำลอง — จำว่าถูกส่งไปหน้าไหน */
function fakeLocation(search = '') {
  return { search, went: null, replace(url) { this.went = url; } };
}

test('มี 2 บทบาท: ผู้สูงอายุ → index.html · ผู้ดูแล → caregiver.html', () => {
  assert.equal(role.pageFor('senior'), 'index.html');
  assert.equal(role.pageFor('caregiver'), 'caregiver.html');
  assert.equal(role.pageFor('admin'), null);
  assert.equal(role.isRole('toString'), false);
});

test('ยังไม่เลือกบทบาท → เปิดหน้าแอปแล้วถูกส่งไปหน้าเลือกบทบาทก่อน', () => {
  const loc = fakeLocation();
  assert.equal(role.guard('caregiver', fakeStorage(), loc), true);
  assert.equal(loc.went, 'role.html');
});

test('เลือกผู้ดูแลแล้ว → เข้าหน้าผู้ดูแลได้ · แต่เข้าหน้าผู้สูงอายุในแท็บเดียวกันไม่ได้', () => {
  const s = fakeStorage();
  assert.equal(role.choose('caregiver', s), 'caregiver.html');
  assert.equal(s.data[role.KEY], 'caregiver');
  assert.equal(role.guard('caregiver', s, fakeLocation()), false);
  const loc = fakeLocation();
  assert.equal(role.guard('senior', s, loc), true);
  assert.equal(loc.went, 'role.html');
});

test('เก็บบทบาทไม่ได้ → แนบ ?as= ไปกับลิงก์ หน้าแอปยังเปิดได้', () => {
  const s = fakeStorage(true);
  assert.equal(role.choose('senior', s), 'index.html?as=senior');
  assert.equal(role.guard('senior', s, fakeLocation('?as=senior')), false);
  assert.equal(role.guard('caregiver', s, fakeLocation('?as=senior')), true);
});

test('หน้าดูทั้ง 2 บทบาท (demo.html) เปิดแต่ละจอด้วย ?as= → ผ่านทั้งคู่', () => {
  const s = fakeStorage();
  assert.equal(role.guard('senior', s, fakeLocation('?as=senior')), false);
  assert.equal(role.guard('caregiver', s, fakeLocation('?as=caregiver')), false);
  assert.equal(role.roleFromSearch('?x=1&as=caregiver'), 'caregiver');
  assert.equal(role.roleFromSearch('?as=admin'), null);
});

test('บทบาทแปลกในที่เก็บ / เลือกบทบาทผิด → ไม่รับ', () => {
  const s = fakeStorage();
  s.setItem(role.KEY, 'admin');
  assert.equal(role.read(s), null);
  assert.throws(() => role.choose('admin', s), /บทบาทไม่ถูกต้อง/);
});
