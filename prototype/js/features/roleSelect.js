/*
 * roleSelect.js — หน้าเลือกบทบาท (role.html) และหน้าดูทั้ง 2 บทบาท (demo.html)
 *
 * Covers: FR-01 (ผู้ใช้ 2 บทบาท) · NFR-03 (ปุ่มใหญ่ ใช้ธีม/ขนาดตัวอักษรเดียวกับแอป)
 * ผู้รับผิดชอบ: YAR OO · ต้องโหลด js/core/role.js ก่อนไฟล์นี้
 */
(function (root) {
  'use strict';

  var M = root.MedMind;
  var TEXT = {
    en: {
      tagline: 'A calmer way to take medicine',
      title: 'How will you use MedMind?',
      lead: 'Choose a role to open the app — switch any time with the "Switch role" button at the top.',
      seniorText: 'See today’s doses, get reminders and tap "I have taken this".',
      caregiverText: 'Scan medicine labels to add medicines and follow the senior’s doses.',
      demo: 'Show both roles side by side (for presenting)',
      note: 'No server in this demo — open 2 tabs in the same browser and pick a different role in each to act as 2 phones.',
      back: '← Choose role',
      demoNote: 'Both screens share the same data — tap in one and the other updates.'
    }
  };

  /** ใช้ภาษา / ธีม / ขนาดตัวอักษรที่ผู้ใช้ตั้งไว้ในแอป (key เดียวกับ app.js) */
  function applySettings() {
    var get = function (key) {
      try { return root.localStorage.getItem(key); } catch { return null; }
    };
    document.body.dataset.theme = get('medmind-theme') === 'dark' ? 'dark' : 'light';
    var size = get('medmind-size');
    if (size) document.body.dataset.size = size;
    var lang = get('medmind-lang') === 'en' ? 'en' : 'th';
    document.documentElement.lang = lang;
    if (TEXT[lang]) {
      document.querySelectorAll('[data-text]').forEach(function (el) {
        var t = TEXT[lang][el.getAttribute('data-text')];
        if (t) el.textContent = t;
      });
    }
  }

  function bindRoleButtons() {
    document.querySelectorAll('[data-role]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        root.location.href = M.role.choose(btn.getAttribute('data-role'), root.sessionStorage);
      });
    });
  }

  applySettings();
  bindRoleButtons();
})(self);
