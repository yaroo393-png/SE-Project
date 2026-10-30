'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pairing = require('../js/logic/pairing.js');
const storeModule = require('../js/core/store.js');

function fakeStorage() {
  const data = {};

  return {
    data,

    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key)
        ? data[key]
        : null;
    },

    setItem(key, value) {
      data[key] = String(value);
    }
  };
}

test('สร้างรหัสเชิญเป็นตัวเลข 6 หลักและหมดอายุใน 10 นาที', () => {
  const invite = pairing.createInvite({
    now: 1_000,
    random: 123456
  });

  assert.match(invite.code, /^\d{6}$/);
  assert.equal(invite.code.length, 6);
  assert.equal(invite.createdAt, 1_000);
  assert.equal(invite.expiresAt, 601_000);
  assert.equal(invite.consent, false);
  assert.equal(invite.used, false);
  assert.equal(invite.paired, false);
});

test('รหัสยังไม่หมดอายุก่อนครบ 10 นาที และหมดอายุเมื่อถึงเวลา', () => {
  const invite = pairing.createInvite({
    now: 1_000,
    random: 123456
  });

  assert.equal(pairing.isExpired(invite, 600_999), false);
  assert.equal(pairing.isExpired(invite, 601_000), true);
});


test('Senior ยินยอมแล้ว → บันทึก consent ลงข้อมูล invite', () => {
  const storage = fakeStorage();
  const store = storeModule.createStore(storage);

  const invite = pairing.createInvite({
    now: 1_000,
    random: 123456
  });

  assert.equal(
    store.writeJSON(store.KEYS.pairing, invite),
    true
  );

  const result = pairing.setConsent({
    store,
    consent: true
  });

  assert.equal(result.ok, true);
  assert.equal(result.invite.consent, true);

  const saved = store.readJSON(store.KEYS.pairing, null);
  assert.equal(saved.consent, true);
});


test('Senior ยินยอมแล้ว + รหัสถูกต้อง → จับคู่สำเร็จและใช้รหัสแล้ว', () => {
  const store = storeModule.createStore(fakeStorage());

  const invite = pairing.createInvite({
    now: 1_000,
    random: 123456
  });

  store.writeJSON(store.KEYS.pairing, invite);

  const consentResult = pairing.setConsent({
    store,
    consent: true
  });

  assert.equal(consentResult.ok, true);

  const result = pairing.acceptInvite({
    store,
    now: 2_000,
    code: '123456'
  });

  assert.equal(result.ok, true);
  assert.equal(result.invite.used, true);
  assert.equal(result.invite.paired, true);
});


//ถ้ายังไม่ยินยอม
test('Senior ยังไม่ยินยอม → จับคู่ไม่ได้', () => {
  const store = storeModule.createStore(fakeStorage());

  const invite = pairing.createInvite({
    now: 1_000,
    random: 123456
  });

  store.writeJSON(store.KEYS.pairing, invite);

  const result = pairing.acceptInvite({
    store,
    now: 2_000,
    code: '123456'
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'consent_required');
});


//รหัสผิด
test('รหัสผิด → จับคู่ไม่ได้', () => {
  const store = storeModule.createStore(fakeStorage());

  const invite = pairing.createInvite({
    now: 1_000,
    random: 123456
  });

  store.writeJSON(store.KEYS.pairing, invite);

  pairing.setConsent({
    store,
    consent: true
  });

  const result = pairing.acceptInvite({
    store,
    now: 2_000,
    code: '999999'
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_code');
});


//รหัสหมดอายุ
test('รหัสหมดอายุ → จับคู่ไม่ได้', () => {
  const store = storeModule.createStore(fakeStorage());

  const invite = pairing.createInvite({
    now: 1_000,
    random: 123456
  });

  store.writeJSON(store.KEYS.pairing, invite);

  pairing.setConsent({
    store,
    consent: true
  });

  const result = pairing.acceptInvite({
    store,
    now: 601_000,
    code: '123456'
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'expired_code');
});



//รหัสใช้แล้ว
test('รหัสถูกใช้แล้ว → จับคู่ซ้ำไม่ได้', () => {
  const store = storeModule.createStore(fakeStorage());

  const invite = pairing.createInvite({
    now: 1_000,
    random: 123456
  });

  store.writeJSON(store.KEYS.pairing, invite);

  pairing.setConsent({
    store,
    consent: true
  });

  const first = pairing.acceptInvite({
    store,
    now: 2_000,
    code: '123456'
  });

  assert.equal(first.ok, true);

  const second = pairing.acceptInvite({
    store,
    now: 3_000,
    code: '123456'
  });

  assert.equal(second.ok, false);
  assert.equal(second.reason, 'already_paired');
});


//ยกเลิกโดยไม่ยืนยัน → ไม่ล้างข้อมูลเดิม
test('ยกเลิกโดยไม่ยืนยัน → ไม่ล้างข้อมูลเดิม', () => {
  const storage = fakeStorage();
  const store = storeModule.createStore(storage);

  const invite = pairing.createInvite({
    now: 1_000,
    random: 123456
  });

  store.writeJSON(store.KEYS.pairing, invite);
  store.writeJSON(store.KEYS.medicines, [
    { name: 'ยาความดัน' }
  ]);
  store.writeJSON(store.KEYS.taken, {
    date: '2026-10-29',
    times: ['08:00']
  });

  const result = pairing.disconnect({
    store,
    confirmed: false,
    now: 2_000,
    random: 654321
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not_confirmed');

  assert.deepEqual(
    store.readJSON(store.KEYS.pairing, null),
    invite
  );

  assert.deepEqual(
    store.readJSON(store.KEYS.medicines, null),
    [{ name: 'ยาความดัน' }]
  );

  assert.deepEqual(
    store.readJSON(store.KEYS.taken, null),
    {
      date: '2026-10-29',
      times: ['08:00']
    }
  );
});


//ยกเลิกโดยยืนยันแล้ว → ล้างข้อมูลเดิม
test('ยกเลิกและยืนยัน → ล้างข้อมูลยา ประวัติ และสร้าง invite ใหม่', () => {
  const storage = fakeStorage();
  const store = storeModule.createStore(storage);

  const oldInvite = pairing.createInvite({
    now: 1_000,
    random: 123456
  });

  store.writeJSON(store.KEYS.pairing, oldInvite);
  store.writeJSON(store.KEYS.medicines, [
    { name: 'ยาความดัน' }
  ]);
  store.writeJSON(store.KEYS.taken, {
    date: '2026-10-29',
    times: ['08:00']
  });

  const result = pairing.disconnect({
    store,
    confirmed: true,
    now: 2_000,
    random: 654321
  });

  assert.equal(result.ok, true);
  assert.notEqual(result.invite.code, oldInvite.code);
  assert.equal(result.invite.paired, false);
  assert.equal(result.invite.used, false);
  assert.equal(result.invite.consent, false);

  assert.deepEqual(
    store.readJSON(store.KEYS.medicines, null),
    []
  );

  assert.deepEqual(
    store.readJSON(store.KEYS.taken, null),
    []
  );

  assert.deepEqual(
    store.readJSON(store.KEYS.pairing, null),
    result.invite
  );
});
