/*
 * role.js — บทบาทของผู้ใช้ในแท็บนี้ (ผู้สูงอายุ / ผู้ดูแล) + กันไม่ให้เข้าหน้าแอปก่อนเลือกบทบาท
 *
 * Covers: FR-01 (ผู้ใช้ 2 บทบาท: Senior จับคู่กับ Caregiver) · ทางเข้าเดียว: role.html → หน้าของบทบาทนั้น
 * ผู้รับผิดชอบ: YAR OO (PM)
 *
 * เก็บใน sessionStorage (แยกต่อแท็บ) ไม่ใช่ localStorage — เปิด 2 แท็บเลือกคนละบทบาท = จำลองมือถือ 2 เครื่องได้เหมือนเดิม
 * ใช้ในหน้าแอป: <script src="../js/core/role.js" data-page-role="caregiver"></script> ไว้บนสุดของ <head>
 *   → ยังไม่เลือกบทบาทนี้ในแท็บนี้ = ส่งไปหน้า role.html ก่อน
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.MedMind = root.MedMind || {};
    root.MedMind.role = api;
    var me = typeof document !== 'undefined' && document.currentScript;
    var pageRole = me && me.getAttribute('data-page-role');
    if (pageRole) api.guard(pageRole, root.sessionStorage, root.location);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEY = 'medmind-role';
  var CHOOSE_PAGE = 'role.html';
  /** บทบาท → หน้าแอปของบทบาทนั้น (อยู่โฟลเดอร์เดียวกับ role.html) */
  var PAGES = Object.freeze({ senior: 'index.html', caregiver: 'caregiver.html' });

  function isRole(value) {
    return Object.prototype.hasOwnProperty.call(PAGES, value);
  }

  function pageFor(role) {
    return isRole(role) ? PAGES[role] : null;
  }

  /** บทบาทจาก "?as=caregiver" (ใช้ตอนเบราว์เซอร์เก็บ sessionStorage ไม่ได้ เช่น โหมดส่วนตัวบางแบบ) */
  function roleFromSearch(search) {
    var m = /[?&]as=([a-z]+)/.exec(search || '');
    return m && isRole(m[1]) ? m[1] : null;
  }

  function read(storage) {
    try {
      var v = storage && storage.getItem(KEY);
      return isRole(v) ? v : null;
    } catch {
      return null;
    }
  }

  function save(storage, role) {
    try {
      storage.setItem(KEY, role);
      return true;
    } catch {
      return false;
    }
  }

  /** ต้องไปเลือกบทบาทก่อนไหม: บทบาทที่เลือกในแท็บนี้ (หรือใน URL) ไม่ตรงกับหน้านี้ = ต้องไป */
  function needsChoice(saved, fromUrl, pageRole) {
    return saved !== pageRole && fromUrl !== pageRole;
  }

  /** เลือกบทบาท → บันทึกในแท็บนี้ → URL ของหน้าแอป (แนบ ?as= ไว้เผื่อบันทึกไม่ได้) */
  function choose(role, storage) {
    if (!isRole(role)) throw new Error('บทบาทไม่ถูกต้อง: ' + role);
    var saved = save(storage, role);
    return pageFor(role) + (saved ? '' : '?as=' + role);
  }

  /** ใช้บนหน้าแอป: ยังไม่ได้เลือกบทบาทของหน้านี้ → ไปหน้า role.html · คืน true ถ้าต้องย้ายหน้า */
  function guard(pageRole, storage, location) {
    var fromUrl = roleFromSearch(location && location.search);
    if (fromUrl === pageRole) save(storage, pageRole);
    if (!needsChoice(read(storage), fromUrl, pageRole)) return false;
    if (location) location.replace(CHOOSE_PAGE);
    return true;
  }

  return {
    KEY: KEY,
    PAGES: PAGES,
    CHOOSE_PAGE: CHOOSE_PAGE,
    isRole: isRole,
    pageFor: pageFor,
    roleFromSearch: roleFromSearch,
    read: read,
    needsChoice: needsChoice,
    choose: choose,
    guard: guard
  };
});
