/*
 * seniorReminder.js — ต่อ reminder.js / confirm.js เข้ากับหน้าเว็บจริง (app.js)
 *
 * Covers: FR-03 / FR-04 · BR-08, BR-09, BR-11, BR-13, BR-15, BR-16 · NFR-02, NFR-07
 *
 * ลำดับโหลดใน HTML: reminder.js → confirm.js → seniorReminder.js → app.js
 * - ตรรกะเวลา/ยืนยันทั้งหมดอยู่ใน reminder.js / confirm.js (ไฟล์นี้ไม่คิดเอง แค่เรียกและวาดหน้าจอ)
 * - อ่านรายการยาจาก app.js ผ่าน config.getMedicines() แล้วรวมยาเวลาเดียวกันเป็น "มื้อ" (BR-06)
 * - เก็บสถานะใน localStorage เพื่อให้จอผู้สูงอายุและจอ Caregiver (demo.html) ใช้ข้อมูลชุดเดียวกัน
 * - จอผู้สูงอายุเป็นฝ่ายเดินเวลา/เตือน/ส่ง event · จอ Caregiver (readOnly) อ่านอย่างเดียว
 */
(function (root) {
  'use strict';

  var R = root.MedMind && root.MedMind.reminder;
  var C = root.MedMind && root.MedMind.confirm;
  if (!R || !C) {
    if (root.console) root.console.warn('seniorReminder.js: ต้องโหลด reminder.js และ confirm.js ก่อน');
    return;
  }

  var K_STATE = 'medmind-confirm';
  var K_EVENTS = 'medmind-events';
  var K_OFFSET = 'medmind-demo-offset';
  var WATCHED_KEYS = [K_STATE, K_EVENTS, K_OFFSET, 'medmind-taken', 'medmind-meds', 'medmind-pairing'];

  var TEXT = {
    th: {
      title: 'ถึงเวลากินยาแล้ว',
      caution: 'ข้อควรระวัง:',
      contra: 'ข้อห้ามใช้:',
      emptyDay: 'ยังไม่มีมื้อยาวันนี้',
      meal: function (t) { return 'มื้อ ' + t + ' น.'; },
      round: function (n) { return 'เตือนครั้งที่ ' + n + ' จาก 3'; },
      yes: 'กินแล้ว',
      no: 'ยังไม่กิน',
      late: 'กินแล้ว (ยืนยันช้า)',
      demoAria: 'เวลาจำลองสำหรับ demo',
      clock: 'เวลาจำลอง',
      step1: '+1 นาที',
      step5: '+5 นาที',
      setTime: 'ตั้งเวลา',
      realTime: 'เวลาจริง',
      resetDemo: 'ล้างสถานะ demo',
      updates: 'อัปเดตจากผู้สูงอายุ',
      evUnconfirmed: function (m) { return 'ยังไม่ยืนยันการกินยา (มื้อ ' + m + ')'; },
      evConfirmed: function (t) { return 'ยืนยันการกินยาแล้ว เวลา ' + t; },
      status: { confirmed: 'กินแล้ว', confirmed_late: 'กินแล้ว (ยืนยันช้า)', unconfirmed: 'ยังไม่ยืนยัน', waiting: 'รอถึงเวลา', reminding: 'กำลังเตือน' },
      confirmMsg: {
        duplicate: 'ยืนยันมื้อนี้ไปแล้วค่ะ',
        late: 'บันทึกแล้ว (ยืนยันช้า)',
        ok: 'บันทึกมื้อยานี้แล้วค่ะ',
        not_due: 'ยังไม่ถึงเวลามื้อนี้ค่ะ',
        window_closed: 'หมดเวลายืนยันมื้อนี้แล้วค่ะ',
        fail: 'ยืนยันไม่ได้ในตอนนี้'
      },
      notYetMsg: {
        wait: function (t) { return 'ได้ค่ะ จะเตือนอีกครั้งเวลา ' + t + ' น.'; },
        notify: 'แจ้งผู้ดูแลให้ทราบแล้ว กินแล้วอย่าลืมกด "กินแล้ว"',
        later: 'ได้ค่ะ ยืนยันช้าได้จากหน้าแรก',
        fail: 'กดไม่ได้ในตอนนี้'
      }
    },
    en: {
      title: 'Time for your medicine',
      caution: 'Caution:',
      contra: 'Do not use:',
      emptyDay: 'No doses scheduled today',
      meal: function (t) { return 'Dose at ' + t; },
      round: function (n) { return 'Reminder ' + n + ' of 3'; },
      yes: 'I have taken it',
      no: 'Not yet',
      late: 'Taken (late)',
      demoAria: 'Demo clock',
      clock: 'Demo time',
      step1: '+1 min',
      step5: '+5 min',
      setTime: 'Set time',
      realTime: 'Real time',
      resetDemo: 'Reset demo',
      updates: 'Updates from Somphon',
      evUnconfirmed: function (m) { return 'Dose at ' + m + ' is not confirmed yet'; },
      evConfirmed: function (t) { return 'Dose confirmed at ' + t; },
      status: { confirmed: 'Taken', confirmed_late: 'Taken (late)', unconfirmed: 'Not confirmed', waiting: 'Upcoming', reminding: 'Reminding' },
      confirmMsg: {
        duplicate: 'This dose is already confirmed.',
        late: 'Recorded (late confirmation)',
        ok: 'Dose recorded.',
        not_due: 'It is not time for this dose yet.',
        window_closed: 'The confirmation window for this dose has closed.',
        fail: 'Cannot confirm right now'
      },
      notYetMsg: {
        wait: function (t) { return 'OK, I will remind you again at ' + t; },
        notify: 'Your caregiver has been told. Tap "I have taken it" once you have.',
        later: 'OK. You can still confirm from the home page.',
        fail: 'Cannot do that right now'
      }
    }
  };

  /** ชื่อ field ของข้อควรระวัง/ข้อห้ามใช้ในข้อมูลยา (BR-05, BR-09) — ถ้าข้อมูลยาใช้ชื่ออื่น แก้ที่นี่ที่เดียว */
  var CAUTION_FIELDS = ['caution', 'warning', 'precaution'];
  var CONTRA_FIELDS = ['contraindication', 'contraindications', 'prohibition'];

  var cfg = null;
  var records = {};      // state ของ confirm.js { [mealId]: record }
  var events = [];       // เหตุการณ์ที่ส่งถึง Caregiver (วันนี้)
  var offset = 0;        // ส่วนต่างนาทีของนาฬิกาจำลองจากเวลาจริง
  var lastNow = null;
  var shown = [];        // id มื้อที่หน้าเตือนต้องแสดง (BR-16)
  var snooze = {};       // { mealId: เวลา(นาที)ที่จะกลับมาเตือน } หลังกด "ยังไม่กิน"
  var audioCtx = null;
  var overlay = null;
  var demoHost = null;
  var demoMin = false;
  var started = false;
  var loadedDate = null;

  // ---------- helper ----------
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dateKey() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function realMinutes() {
    var d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
  function readJSON(key) {
    try {
      var raw = root.localStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch (e) { return null; }
  }
  function writeJSON(key, value) {
    try { root.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ใช้ต่อได้โดยไม่เก็บ */ }
  }
  function lang() {
    return cfg && cfg.getLang && cfg.getLang() === 'en' ? 'en' : 'th';
  }
  function T(l) { return TEXT[l || lang()]; }
  function pick(obj, keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = obj[keys[i]];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  }

  function loadAll() {
    loadedDate = dateKey();
    var s = readJSON(K_STATE);
    records = s && s.date === dateKey() && s.records && typeof s.records === 'object' ? s.records : {};
    var e = readJSON(K_EVENTS);
    events = e && e.date === dateKey() && Array.isArray(e.items) ? e.items : [];
    var o = readJSON(K_OFFSET);
    offset = o && o.date === dateKey() && isFinite(Number(o.minutes)) ? Number(o.minutes) : 0;
  }
  function saveRecords() { writeJSON(K_STATE, { date: dateKey(), records: records }); }
  function saveEvents() { writeJSON(K_EVENTS, { date: dateKey(), items: events }); }
  function saveOffset() { writeJSON(K_OFFSET, { date: dateKey(), minutes: offset }); }

  // ---------- เวลา (นาฬิกาจำลอง) ----------
  function nowMinutes() {
    return Math.max(0, Math.min(R.END_OF_DAY - 1, realMinutes() + offset));
  }
  function nowText() { return R.formatTime(nowMinutes()); }
  function setOffset(value) {
    var real = realMinutes();
    offset = Math.max(-real, Math.min(R.END_OF_DAY - 1 - real, value));
    saveOffset();
  }

  // ---------- มื้อยา ----------
  function meals() {
    var groups = {};
    var order = [];
    (cfg ? cfg.getMedicines() : []).forEach(function (m) {
      var mins;
      try { mins = R.parseTime(String(m.time || '').trim()); } catch (e) { return; }
      if (!groups[mins]) { groups[mins] = []; order.push(mins); }
      groups[mins].push({ name: m.name, detail: m.dose || '', caution: pick(m, CAUTION_FIELDS), contraindication: pick(m, CONTRA_FIELDS) });
    });
    order.sort(function (a, b) { return a - b; });
    return order.map(function (mins) {
      return { id: 'm-' + R.formatTime(mins).replace(':', ''), time: mins, label: R.formatTime(mins), doses: groups[mins] };
    });
  }
  function findByTime(ms, timeText) {
    var mins;
    try { mins = R.parseTime(String(timeText)); } catch (e) { return null; }
    for (var i = 0; i < ms.length; i++) if (ms[i].time === mins) return ms[i];
    return null;
  }
  function findById(ms, id) {
    for (var i = 0; i < ms.length; i++) if (ms[i].id === id) return ms[i];
    return null;
  }

  // ---------- event ถึง Caregiver ----------
  function logEvents(list, ms) {
    list.forEach(function (ev) {
      var meal = findById(ms, ev.mealId);
      events.push({ kind: ev.kind, mealLabel: meal ? meal.label : ev.mealId, at: ev.at });
    });
    if (list.length) saveEvents();
  }

  // ---------- เสียง (เล่นได้หลังผู้ใช้แตะหน้าจอ 1 ครั้ง) ----------
  function unlockAudio() {
    if (audioCtx) return;
    var Ctx = root.AudioContext || root.webkitAudioContext;
    if (!Ctx) return;
    try {
      audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { audioCtx = null; }
  }
  function beep() {
    if (!audioCtx) return;
    for (var i = 0; i < 3; i++) {
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      var t0 = audioCtx.currentTime + i * 0.4;
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.3);
    }
  }

  // ---------- เดินเวลา / เตือน ----------
  function addShown(id) { if (shown.indexOf(id) === -1) shown.push(id); }

  /** คืน true ถ้ามีอะไรเปลี่ยนที่หน้าจอต้องวาดใหม่ */
  function check() {
    if (!cfg || cfg.readOnly) return false;
    if (loadedDate !== dateKey()) {                      // ข้ามเที่ยงคืน → เริ่มวันใหม่
      loadAll();
      shown = [];
      snooze = {};
      lastNow = null;
    }
    var now = nowMinutes();
    var ms = meals();
    var prev = lastNow === null ? now : Math.min(lastNow, now);
    var changed = now !== lastNow;
    lastNow = now;

    var evs = C.tick(records, ms, now);                 // BR-13: ถึง T+15 ยังไม่ยืนยัน → แจ้ง Caregiver
    if (evs.length) { logEvents(evs, ms); saveRecords(); changed = true; }

    var due = R.dueReminders(ms, records, now, prev);   // BR-08/09/16
    if (due.firing.length) {
      due.display.forEach(function (m) { addShown(m.id); });
      changed = true;
      if (due.sound && cfg.isSoundOn && cfg.isSoundOn()) beep();
    }
    return changed;
  }

  function updateClock() {
    var el = root.document.getElementById('sr-clock');
    if (el) el.textContent = nowText();
  }

  function refresh() {
    updateClock();
    if (cfg && cfg.onChange) cfg.onChange();
  }

  // ---------- ปุ่มยืนยัน ----------
  function confirmMeal(timeText) {
    var ms = meals();
    var meal = findByTime(ms, timeText);
    if (!meal) return { ok: false, reason: 'no_meal', events: [] };
    var res = C.confirmMeal(records, meal, ms, nowMinutes());   // 1 แตะ = ทั้งมื้อ · กดซ้ำไม่บันทึกซ้ำ
    logEvents(res.events, ms);
    saveRecords();
    var m = T().confirmMsg;
    var message = res.ok ? (res.duplicate ? m.duplicate : res.late ? m.late : m.ok) : (m[res.reason] || m.fail);
    if (cfg && cfg.onConfirmed) cfg.onConfirmed(timeText, res, message);
    return res;
  }

  function pressNotYet(timeText) {
    var ms = meals();
    var meal = findByTime(ms, timeText);
    if (!meal) return { ok: false, reason: 'no_meal', events: [] };
    var now = nowMinutes();
    var res = C.pressNotYet(records, meal, ms, now);
    logEvents(res.events, ms);
    saveRecords();
    var m = T().notYetMsg;
    var message = m.fail;
    if (res.ok && res.action === 'wait_next_round') {
      snooze[meal.id] = res.nextAt;                             // ซ่อนหน้าเตือนจนถึงรอบถัดไป
      message = m.wait(R.formatTime(res.nextAt));
    } else if (res.ok) {
      snooze[meal.id] = meal.time + R.EXPIRE_OFFSET;            // แจ้ง Caregiver แล้ว · ยืนยันช้าได้จากหน้าแรก
      message = m.notify;
    } else if (res.reason === 'reminder_over') {
      snooze[meal.id] = R.lateWindowEnd(meal, ms);              // มื้อที่หมดรอบเตือนแต่ยังค้างบนหน้าเตือน (BR-16) → ซ่อนจากหน้าเตือน ยืนยันช้าได้จากหน้าแรก
      message = m.later;
    }
    if (cfg && cfg.onNotYet) cfg.onNotYet(timeText, res, message);
    return res;
  }

  // ---------- หน้าเตือน (overlay) ----------
  function ensureStyle() {
    var doc = root.document;
    if (doc.getElementById('sr-style')) return;
    var style = doc.createElement('style');
    style.id = 'sr-style';
    // ใช้ตัวแปรสีของธีมใน styles.css (--surface, --green, --accent, --warning, --line) ให้เข้ากับโหมดสว่าง/มืดอัตโนมัติ
    style.textContent =
      '.sr-backdrop{position:fixed;top:0;right:0;bottom:0;left:0;z-index:25;display:grid;place-items:center;padding:16px;background:rgba(17,35,28,.55);backdrop-filter:blur(4px)}' +
      '.sr-backdrop[hidden]{display:none}' +
      '.sr-dialog{width:min(100%,560px);max-height:92vh;overflow:auto;background:var(--surface,#fff);color:var(--ink,#18382f);border-radius:24px;padding:22px;box-shadow:0 24px 80px rgba(13,36,25,.3);font-size:18px}' +
      '.sr-dialog h2{margin:0 0 4px;font-size:26px;color:var(--green,#164c3b)}' +
      'body[data-theme="dark"] .sr-dialog h2{color:var(--ink)}' +
      '.sr-meal{background:var(--surface,#fff);border:1px solid var(--line,#e5ebe3);border-left:7px solid var(--accent,#d8f36a);border-radius:20px;padding:16px 18px;margin:14px 0 0}' +
      '.sr-meal h3{margin:0;font-size:22px}' +
      '.sr-round{display:inline-block;margin:8px 0 10px;padding:5px 12px;border-radius:999px;background:var(--warning-bg,#fff2e8);color:#8a4a22;font-size:18px;font-weight:700}' +
      'body[data-theme="dark"] .sr-round{color:var(--warning,#ffb68a)}' +
      '.sr-round:empty{display:none}' +
      '.sr-doses{margin:0 0 14px;display:grid;gap:12px}' +
      '.sr-dose{display:grid;gap:2px}' +
      '.sr-name{font-size:24px;line-height:1.3}' +
      '.sr-detail,.sr-note{font-size:18px;line-height:1.5}' +
      '.sr-note{color:#4a5a52}' +
      'body[data-theme="dark"] .sr-note{color:var(--ink)}' +
      '.sr-warn{font-weight:700;color:#b3261e}' +
      'body[data-theme="dark"] .sr-warn{color:#ffb4ab}' +
      '.sr-actions{display:grid;gap:10px}' +
      '.sr-actions button{width:100%;min-height:64px;padding:0 18px;border-radius:14px;font-size:22px;font-weight:700;cursor:pointer;border:0}' +
      '.sr-yes{background:#1b7a45;color:#fff}' +
      '.sr-no{background:#b3261e;color:#fff}' +
      'body[data-theme="dark"] .sr-yes{background:#a6e3a1;color:#06280f}' +
      'body[data-theme="dark"] .sr-no{background:#ffb4ab;color:#410002}' +
      '.sr-demo{position:fixed;z-index:26;left:50%;bottom:14px;transform:translateX(-50%);width:max-content;max-width:calc(100% - 24px);display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;justify-content:center;background:var(--surface,#fff);border:1px solid var(--line,#e5ebe3);border-radius:16px;padding:10px 14px;box-shadow:0 12px 36px rgba(13,36,25,.28);font-size:13px;color:var(--muted,#71827a)}' +
      '.sr-demo strong{font-size:22px;color:var(--green,#164c3b);font-variant-numeric:tabular-nums}' +
      'body[data-theme="dark"] .sr-demo strong{color:var(--ink)}' +
      '.sr-demo .secondary-button{min-height:40px;padding:0 13px;font-size:13px}' +
      '.sr-demo label{display:inline-flex;gap:6px;align-items:center;font-weight:700}' +
      '.sr-demo input{height:40px;border:1px solid var(--line,#e5ebe3);border-radius:12px;padding:0 10px;background:var(--surface,#fff);color:var(--ink,#18382f)}' +
      '.sr-status-cell{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end}' +
      '.sr-status-cell .secondary-button{min-height:40px;padding:0 12px;font-size:12px}' +
      '@media(max-width:820px){.sr-demo{bottom:84px}}' +
      '@media(max-width:560px){.sr-dialog{padding:16px;border-radius:20px}.sr-dialog h2{font-size:24px}.sr-meal{padding:14px}.sr-status-cell{flex-direction:column;align-items:flex-end;gap:6px}}';
    doc.head.appendChild(style);
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    ensureStyle();
    overlay = root.document.createElement('div');
    overlay.id = 'sr-overlay';
    overlay.className = 'sr-backdrop';
    overlay.hidden = true;
    overlay.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-sr-yes],button[data-sr-no]') : null;
      if (!b) return;
      if (b.getAttribute('data-sr-yes') !== null) confirmMeal(b.getAttribute('data-sr-yes'));
      else pressNotYet(b.getAttribute('data-sr-no'));
    });
    root.document.body.appendChild(overlay);
    return overlay;
  }

  /** มื้อที่หน้าเตือนต้องโชว์ ณ ตอนนี้ (BR-16: ทุกมื้อที่ยังไม่ยืนยันและยืนยันได้) */
  function visibleMeals() {
    var now = nowMinutes();
    var ms = meals();
    var inRounds = function (m) {
      var r = R.currentRound(m, now);
      return !R.isConfirmed(records, m) && r >= 1 && r <= 3;
    };
    if (!ms.some(inRounds)) { shown = []; return []; }          // หมดช่วงเตือนทุกมื้อ → ปิดหน้าเตือน
    var list = shown.map(function (id) { return findById(ms, id); }).filter(function (m) {
      return m && !R.isConfirmed(records, m) && C.canConfirm(m, ms, now).ok && !(snooze[m.id] > now);
    });
    return list.some(inRounds) ? list.sort(function (a, b) { return a.time - b.time; }) : [];
  }

  function renderOverlay() {
    var el = ensureOverlay();
    if (!cfg || cfg.readOnly) { el.hidden = true; return; }
    var list = visibleMeals();
    if (!list.length) { el.hidden = true; el.innerHTML = ''; return; }
    var tx = T();
    var now = nowMinutes();
    var wasHidden = el.hidden;
    el.innerHTML =
      '<section class="sr-dialog" role="alertdialog" aria-modal="true" aria-labelledby="sr-title">' +
      '<h2 id="sr-title">' + esc(tx.title) + '</h2>' +
      list.map(function (m) {
        var round = R.currentRound(m, now);
        var doses = m.doses.map(function (d) {
          return '<div class="sr-dose"><strong class="sr-name">' + esc(d.name) + '</strong>' +
            (d.detail ? '<span class="sr-detail">' + esc(d.detail) + '</span>' : '') +
            (d.caution ? '<span class="sr-note">' + esc(tx.caution) + ' ' + esc(d.caution) + '</span>' : '') +
            (d.contraindication ? '<span class="sr-note sr-warn">' + esc(tx.contra) + ' ' + esc(d.contraindication) + '</span>' : '') +
            '</div>';
        }).join('');
        return '<article class="sr-meal"><h3>' + esc(tx.meal(m.label)) + '</h3>' +
          '<p class="sr-round">' + esc(round >= 1 && round <= 3 ? tx.round(round) : '') + '</p>' +
          '<div class="sr-doses">' + doses + '</div>' +
          '<div class="sr-actions"><button type="button" class="sr-yes" data-sr-yes="' + esc(m.label) + '">' + esc(tx.yes) + '</button>' +
          '<button type="button" class="sr-no" data-sr-no="' + esc(m.label) + '">' + esc(tx.no) + '</button></div></article>';
      }).join('') +
      '</section>';
    el.hidden = false;
    if (wasHidden) {
      var first = el.querySelector('.sr-yes');
      if (first && first.focus) first.focus();
    }
  }

  // ---------- ส่วนที่ app.js เรียกใช้ตอนวาดหน้า ----------
  function statusFor(timeText) {
    var meal = findByTime(meals(), timeText);
    return meal ? C.mealStatus(records, meal, nowMinutes()) : null;
  }
  function statusText(status, l) {
    var base = T(l).status[status.code] || status.label;
    return status.time ? base + ' · ' + status.time : base;
  }
  function canLateConfirm(timeText) {
    var ms = meals();
    var meal = findByTime(ms, timeText);
    if (!meal) return false;
    var rows = C.seniorHome(records, ms, nowMinutes());
    for (var i = 0; i < rows.length; i++) if (rows[i].meal.id === meal.id) return !!rows[i].showConfirmButton;
    return false;
  }
  /** มื้อที่กำลังเตือนอยู่ (T..T+14, ยังไม่ยืนยัน) เวลาแรกสุด — ให้การ์ด "มื้อถัดไป" ชี้มื้อนี้ */
  function activeTime() {
    var list = R.activeReminderMeals(meals(), records, nowMinutes());
    return list.length ? list[0].label : null;
  }

  function demoBarHtml(l) {
    var tx = T(l);
    var head = '<span>' + esc(tx.clock) + ' <strong id="sr-clock">' + esc(nowText()) + '</strong></span>';
    var toggle = '<button type="button" class="secondary-button" data-sr-toggle aria-expanded="' + (!demoMin) + '">' + (demoMin ? '▲' : '▼') + '</button>';
    if (demoMin) return head + toggle;
    return head +
      '<button type="button" class="secondary-button" data-sr-step="1">' + esc(tx.step1) + '</button>' +
      '<button type="button" class="secondary-button" data-sr-step="5">' + esc(tx.step5) + '</button>' +
      '<label>' + esc(tx.setTime) + ' <input type="time" id="sr-set" value="' + esc(nowText()) + '"></label>' +
      '<button type="button" class="secondary-button" data-sr-real>' + esc(tx.realTime) + '</button>' +
      '<button type="button" class="secondary-button" data-sr-reset>' + esc(tx.resetDemo) + '</button>' + toggle;
  }

  /** แถบเวลาจำลอง: ลอยอยู่เหนือหน้าเตือนเสมอ เพื่อให้เลื่อนไปดู T+5 / T+10 ได้ขณะหน้าเตือนเปิดอยู่ */
  function renderDemoBar() {
    if (!cfg || cfg.readOnly) return;
    if (!demoHost) {
      ensureStyle();
      demoHost = root.document.createElement('section');
      demoHost.id = 'sr-demo';
      demoHost.className = 'sr-demo';
      root.document.body.appendChild(demoHost);
    }
    demoHost.setAttribute('aria-label', T().demoAria);
    var active = root.document.activeElement;
    if (active && active.id === 'sr-set') return;       // กำลังพิมพ์เวลาอยู่ ไม่วาดทับ
    demoHost.innerHTML = demoBarHtml();
  }

  /** รายการแจ้ง Caregiver (แสดงในจอ Caregiver) · ว่าง = ไม่แสดงอะไร */
  function eventsHtml(l) {
    if (!events.length) return '';
    var tx = T(l);
    var rows = events.slice().reverse().map(function (ev) {
      var text = ev.kind === 'confirmed' ? tx.evConfirmed(R.formatTime(ev.at)) : tx.evUnconfirmed(ev.mealLabel);
      return '<div class="schedule-row"><span class="schedule-time">' + esc(R.formatTime(ev.at)) + '</span>' +
        '<span class="schedule-name">' + esc(text) + '</span></div>';
    }).join('');
    return '<section class="panel wide-panel"><div class="section-title"><h2>' + esc(tx.updates) + '</h2></div>' +
      '<div class="schedule-list">' + rows + '</div></section>';
  }

  /** ยกเลิกการเชื่อมต่อ (flows.js) ล้างยา/ประวัติของคู่เดิม → ต้องล้างสถานะมื้อยาของเราด้วย ไม่งั้นยาใหม่เวลาเดิมจะติดสถานะ "กินแล้ว" เก่า */
  function clearData() {
    records = {};
    events = [];
    shown = [];
    snooze = {};
    saveRecords();
    saveEvents();
    if (cfg && cfg.onChange) cfg.onChange();
  }

  function hookUnpair() {
    var orig = root.flowUnpair;
    if (typeof orig !== 'function' || orig.srWrapped) return;
    var wrapped = function () {
      var result = orig.apply(this, arguments);
      var pairing = readJSON('medmind-pairing');
      if (!pairing || !pairing.paired) clearData();      // ผู้ใช้กดยืนยันยกเลิกแล้วเท่านั้น
      return result;
    };
    wrapped.srWrapped = true;
    root.flowUnpair = wrapped;
  }

  function resetDemo() {
    records = {};
    events = [];
    shown = [];
    snooze = {};
    lastNow = nowMinutes();
    saveRecords();
    saveEvents();
    if (cfg && cfg.onResetDemo) cfg.onResetDemo();
  }

  // ---------- เริ่มทำงาน ----------
  function onDemoClick(e) {
    if (!cfg || cfg.readOnly || !e.target || !e.target.closest) return;
    if (e.target.closest('[data-sr-toggle]')) { demoMin = !demoMin; return renderDemoBar(); }
    var step = e.target.closest('[data-sr-step]');
    if (step) {
      setOffset(offset + Number(step.getAttribute('data-sr-step')));
      check();
      return refresh();
    }
    if (e.target.closest('[data-sr-real]')) {
      setOffset(0);
      lastNow = nowMinutes();
      return refresh();
    }
    if (e.target.closest('[data-sr-reset]')) {
      resetDemo();
      return refresh();
    }
  }

  function onDemoChange(e) {
    if (!cfg || cfg.readOnly || !e.target || e.target.id !== 'sr-set' || !e.target.value) return;
    var target;
    try { target = R.parseTime(e.target.value); } catch (err) { return; }
    setOffset(target - realMinutes());
    lastNow = nowMinutes();            // ตั้งเวลาตรง ๆ = กระโดด ไม่ยิงรอบเตือนย้อนหลัง
    check();
    refresh();
  }

  function init(config) {
    if (started) return;
    started = true;
    cfg = config;
    loadAll();
    lastNow = nowMinutes();
    hookUnpair();
    var doc = root.document;

    if (!cfg.readOnly) {
      // เปิดหน้ามากลางช่วงเตือน → แสดงหน้าเตือนทันที (ไม่มีเสียงเพราะไม่ได้เป็นรอบที่เพิ่งยิง)
      R.activeReminderMeals(meals(), records, lastNow).forEach(function (m) { addShown(m.id); });
      doc.addEventListener('pointerdown', unlockAudio, { once: true });
      doc.addEventListener('keydown', unlockAudio, { once: true });
      doc.addEventListener('click', onDemoClick);
      doc.addEventListener('change', onDemoChange);
      root.setInterval(function () {
        updateClock();
        if (check() && cfg.onChange) cfg.onChange();
      }, 5000);
    }

    if (cfg.readOnly) {
      root.setInterval(function () {
        var n = nowMinutes();
        if (n !== lastNow) { lastNow = n; if (cfg.onChange) cfg.onChange(); }
      }, 5000);
    }

    // จออื่น (iframe อีกจอใน demo.html) เปลี่ยนข้อมูล → โหลดใหม่แล้ววาดตาม
    root.addEventListener('storage', function (e) {
      if (e.key !== null && WATCHED_KEYS.indexOf(e.key) === -1) return;
      loadAll();
      if (cfg.onExternal) cfg.onExternal();
    });
  }

  root.SeniorReminder = {
    init: init,
    nowMinutes: nowMinutes,
    nowText: nowText,
    meals: meals,
    activeTime: activeTime,
    statusFor: statusFor,
    statusText: statusText,
    canLateConfirm: canLateConfirm,
    lateButtonText: function (l) { return T(l).late; },
    emptyDayText: function (l) { return T(l).emptyDay; },
    confirm: confirmMeal,
    notYet: pressNotYet,
    demoBarHtml: demoBarHtml,
    eventsHtml: eventsHtml,
    afterRender: function () { renderOverlay(); renderDemoBar(); }
  };
})(typeof window !== 'undefined' ? window : this);
