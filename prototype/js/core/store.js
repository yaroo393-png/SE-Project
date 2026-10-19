/*
 * store.js — สัญญาข้อมูลร่วมของ prototype: ชื่อ key ใน localStorage + เวลามื้ออาหาร
 *
 * Covers: BR-05 (Caregiver ตั้งเวลามื้อเช้า/กลางวัน/เย็น + เวลาเข้านอน) · ข้อมูลอยู่ในเบราว์เซอร์ ไม่มี server (เกณฑ์ prototype ข้อ ②)
 * หน้าผู้สูงอายุ (index.html) กับหน้าผู้ดูแล (caregiver.html) เปิดคนละแท็บในเบราว์เซอร์เดียวกันจะเห็นข้อมูลชุดเดียวกัน
 * ทุกฟีเจอร์อ่าน/เขียนผ่านไฟล์นี้ เพื่อให้ใช้ชื่อ key และรูปข้อมูลเดียวกัน — ถ้าจะเพิ่ม/เปลี่ยน key ให้แก้ที่นี่และบอกทีมใน PR
 *
 * ใช้ได้ทั้งในเบราว์เซอร์ (window.MedMind.store ผูกกับ localStorage) และใน Node (require → createStore(storage) ใส่ storage จำลอง)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.MedMind = root.MedMind || {};
    var storage = null;
    try { storage = root.localStorage; } catch (e) { storage = null; }
    root.MedMind.store = api.createStore(storage);
    root.MedMind.store.createStore = api.createStore;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** ชื่อ key ทั้งหมดใน localStorage (ค่าเดิมของหน้า demo คงไว้ เพื่อไม่ให้ข้อมูลที่บันทึกแล้วหาย) */
  var KEYS = Object.freeze({
    medicines: 'medmind-meds',       // รายการยา (ฟีเจอร์จัดการยา FR-02)
    pairing: 'medmind-pairing',      // การจับคู่ (FR-01)
    taken: 'medmind-taken',          // การยืนยันกินยาของวัน (FR-04)
    mealTimes: 'medmind-meal-times'  // เวลามื้ออาหาร (BR-05)
  });

  /** ค่าเริ่มต้นเมื่อ Caregiver ยังไม่ได้ตั้งเวลามื้อ — ตรงกับตัวอย่างใน SRS (FR-02 ✓6: เช้า 07:00) */
  var DEFAULT_MEAL_TIMES = Object.freeze({ morning: '07:00', noon: '12:00', evening: '18:00', bedtime: '21:00' });
  var MEAL_KEYS = Object.freeze(['morning', 'noon', 'evening', 'bedtime']);

  function isTime(text) {
    return typeof text === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(text);
  }

  /** เวลามื้อครบ 4 ช่องและเป็นรูป HH:MM ทุกช่อง */
  function validMealTimes(times) {
    return !!times && MEAL_KEYS.every(function (k) { return isTime(times[k]); });
  }

  /** storage = อะไรก็ได้ที่มี getItem / setItem (localStorage หรือของจำลองในเทสต์) · null = ไม่มีที่เก็บ (โหมดส่วนตัวบางเบราว์เซอร์) */
  function createStore(storage) {
    function readJSON(key, fallback) {
      try {
        var raw = storage ? storage.getItem(key) : null;
        return raw === null || raw === undefined ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    }
    function writeJSON(key, value) {
      try {
        if (storage) storage.setItem(key, JSON.stringify(value));
        return !!storage;
      } catch (e) {
        return false;
      }
    }

    return {
      KEYS: KEYS,
      DEFAULT_MEAL_TIMES: DEFAULT_MEAL_TIMES,
      readJSON: readJSON,
      writeJSON: writeJSON,
      /** เวลามื้อที่ Caregiver ตั้งไว้ · ยังไม่ตั้งหรือข้อมูลเสีย → ค่าเริ่มต้น (isDefault = true ให้หน้าจอบอกผู้ใช้) */
      readMealTimes: function () {
        var saved = readJSON(KEYS.mealTimes, null);
        if (validMealTimes(saved)) {
          return { morning: saved.morning, noon: saved.noon, evening: saved.evening, bedtime: saved.bedtime, isDefault: false };
        }
        return { morning: DEFAULT_MEAL_TIMES.morning, noon: DEFAULT_MEAL_TIMES.noon, evening: DEFAULT_MEAL_TIMES.evening, bedtime: DEFAULT_MEAL_TIMES.bedtime, isDefault: true };
      },
      /** บันทึกเวลามื้อ · คืน { ok, reason } — ไม่บันทึกถ้าช่องไหนไม่ใช่ HH:MM */
      saveMealTimes: function (times) {
        if (!validMealTimes(times)) return { ok: false, reason: 'invalid_time' };
        var clean = { morning: times.morning, noon: times.noon, evening: times.evening, bedtime: times.bedtime };
        return writeJSON(KEYS.mealTimes, clean) ? { ok: true } : { ok: false, reason: 'storage_unavailable' };
      }
    };
  }

  return { KEYS: KEYS, DEFAULT_MEAL_TIMES: DEFAULT_MEAL_TIMES, MEAL_KEYS: MEAL_KEYS, isTime: isTime, validMealTimes: validMealTimes, createStore: createStore };
});
