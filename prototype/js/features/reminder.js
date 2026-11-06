/*
 * features/reminder.js — สะพานเชื่อมหน้าเว็บ (UI) กับตรรกะ reminder.js / confirm.js
 *
 * Covers: FR-03 / FR-04  ·  BR-08, BR-09, BR-15, BR-16, NFR-02, NFR-07
 *
 * ไฟล์นี้ "ไม่คิดกฎเอง" — ทุกกฎมาจาก window.MedMind.reminder และ window.MedMind.confirm
 * หน้าที่ของไฟล์นี้มีแค่
 *   1) นาฬิกาจำลอง (เดโม +1 / +5 นาที) — เวลาเป็นนาทีนับจากเที่ยงคืน
 *   2) เรียก dueReminders() ทุกครั้งที่เวลาเดิน แล้วเล่นเสียง "ครั้งเดียว" (BR-16)
 *   3) ส่งปุ่ม กินแล้ว / ยังไม่กิน ไปที่ confirmMeal() / pressNotYet()
 *   4) สรุปสถานะจาก seniorHome() ให้หน้าจอวาดตาม
 * เบราว์เซอร์ต้องการให้ผู้ใช้แตะหน้าจอ 1 ครั้งก่อนจึงจะเล่นเสียงได้ (autoplay policy)
 * ต้องโหลดหลัง logic/reminder.js และ logic/confirm.js
 */
(function (root) {
  'use strict';

  var M = root.MedMind;
  if (!M || !M.reminder || !M.confirm) throw new Error('โหลด logic/reminder.js และ logic/confirm.js ก่อน features/reminder.js');
  var reminder = M.reminder;
  var confirm = M.confirm;

  // ยาตัวอย่าง (สมมติ) — ฉลากสั่ง "หลังอาหารเช้า" → เตือนที่เวลามื้อเช้า 07:00
  var SETTINGS = { morning: '07:00', noon: '12:00', evening: '18:00', bedtime: '21:00' };
  var DEMO_START = reminder.parseTime('06:58'); // เริ่มก่อน T 2 นาที จะเห็น T, T+5, T+10 ครบ

  var meals = [];
  var state = {};
  var now = DEMO_START;
  var log = []; // บันทึกเหตุการณ์ที่หน้าจอควรแสดง (เช่น แจ้ง Caregiver)
  var audioCtx = null;
  var soundUnlocked = false;

  function setup(doses) {
    var built = reminder.buildMeals(doses || [{ name: 'AMLODIPINE', timing: { type: 'after', slot: 'morning' } }], SETTINGS);
    meals = built.meals;
  }
  setup();

  function mainMeal() { return meals[0]; }

  /** ปลดล็อกเสียง: ต้องเรียกจากการแตะของผู้ใช้ (เรียกครั้งแรกครั้งเดียวพอ) */
  function unlockSound() {
    if (soundUnlocked) return;
    try {
      var A = root.AudioContext || root.webkitAudioContext;
      if (!A) return;
      audioCtx = audioCtx || new A();
      if (audioCtx.resume) audioCtx.resume();
      soundUnlocked = audioCtx.state === 'running' || audioCtx.state === 'suspended';
    } catch (e) { soundUnlocked = false; }
  }

  /** เล่นเสียงเตือน 1 ครั้ง — ถ้ายังไม่ได้แตะหน้าจอจะไม่เล่น (แต่หน้าจอยังเตือนด้วยภาพ) */
  function playSound() {
    if (!audioCtx || audioCtx.state !== 'running') return false;
    try {
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = 523.25;
      g.gain.setValueAtTime(0.08, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 0.6);
      return true;
    } catch (e) { return false; }
  }

  /**
   * เดินเวลา minutes นาที แล้วถามตรรกะว่ามีอะไรต้องเกิดขึ้น
   * คืน { due, events, soundPlayed } — due มาจาก reminder.dueReminders
   */
  function advance(minutes) {
    var prev = now;
    now = Math.min(reminder.END_OF_DAY - 1, now + minutes);
    var events = confirm.tick(state, meals, now); // BR-13: T+15 แจ้ง Caregiver
    log = log.concat(events);
    var due = reminder.dueReminders(meals, state, now, prev);
    var played = due.sound ? playSound() : false; // BR-16: เสียงครั้งเดียว
    return { due: due, events: events, soundPlayed: played };
  }

  /** ปุ่ม "กินแล้ว" → confirm.confirmMeal (กดซ้ำ = duplicate ไม่บันทึกซ้ำ) */
  function confirmTaken() {
    var res = confirm.confirmMeal(state, mainMeal(), meals, now);
    log = log.concat(res.events || []);
    return res;
  }

  /** ปุ่ม "ยังไม่กิน" → confirm.pressNotYet */
  function notYet() {
    var res = confirm.pressNotYet(state, mainMeal(), meals, now);
    log = log.concat(res.events || []);
    return res;
  }

  function reset() {
    state = {};
    log = [];
    now = DEMO_START;
  }

  /** สรุปให้หน้าจอ: อ่านจาก seniorHome() เท่านั้น ไม่คำนวณสถานะเอง */
  function snapshot() {
    var meal = mainMeal();
    var rows = confirm.seniorHome(state, meals, now);
    var row = rows[0];
    var rec = state[meal.id] || null;
    var code = row.status.code;
    var round = reminder.currentRound(meal, now);
    var canConfirm = confirm.canConfirm(meal, meals, now);
    return {
      now: now,
      nowText: reminder.formatTime(now),
      rows: rows,
      emptyMessage: rows.length ? '' : confirm.EMPTY_DAY_MESSAGE,
      code: code,
      confirmed: code === 'confirmed' || code === 'confirmed_late',
      late: code === 'confirmed_late',
      confirmedAt: row.status.time || '',
      round: Math.max(1, Math.min(3, round)),
      unconfirmed: code === 'unconfirmed' && canConfirm.ok,
      lateWindowClosed: code === 'unconfirmed' && !canConfirm.ok,
      escalated: !!rec && rec.notYetRounds.indexOf(3) !== -1 && code !== 'confirmed' && code !== 'confirmed_late',
      showConfirmButton: row.showConfirmButton,
      log: log.slice()
    };
  }

  M.features = M.features || {};
  M.features.reminder = {
    SETTINGS: SETTINGS,
    meals: function () { return meals; },
    setup: setup,
    unlockSound: unlockSound,
    advance: advance,
    confirmTaken: confirmTaken,
    notYet: notYet,
    reset: reset,
    snapshot: snapshot
  };

  // แตะหน้าจอครั้งแรก = ปลดล็อกเสียง (ข้อกำหนด issue #49)
  if (root.document) {
    root.document.addEventListener('pointerdown', unlockSound, { once: true, capture: true });
    root.document.addEventListener('keydown', unlockSound, { once: true, capture: true });
  }
})(typeof self !== 'undefined' ? self : this);
