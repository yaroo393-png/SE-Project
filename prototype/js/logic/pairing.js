(function (root, factory) {
  var api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.MedMind = root.MedMind || {};
    root.MedMind.pairing = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

  var CODE_LENGTH = 6;
  var INVITE_TTL_MS = 10 * 60 * 1000;

  /**
   * สร้างรหัสเชิญ 6 หลักและกำหนดอายุ 10 นาที
   *
   * options.now คือเวลาปัจจุบันที่ส่งเข้ามาจากภายนอก
   * เพื่อให้เทสต์สามารถจำลองเวลาได้
   */
  function createInvite(options) {
    var now = options && Number.isFinite(options.now)
      ? options.now
      : 0;

    var random = options && Number.isInteger(options.random)
      ? options.random
      : 0;

    var code = String(Math.abs(random) % 1000000).padStart(CODE_LENGTH, '0');

    return {
      code: code,
      createdAt: now,
      expiresAt: now + INVITE_TTL_MS,
      consent: false,
      used: false,
      paired: false
    };
  }

  /**
   * ตรวจว่ารหัสหมดอายุแล้วหรือยัง
   */
  function isExpired(invite, now) {
    if (!invite || !Number.isFinite(Number(invite.expiresAt))) {
      return true;
    }

    return now >= Number(invite.expiresAt);
  }

  function setConsent(options) {
  var store = options && options.store;
  var consent = !!(options && options.consent);

  if (!store || !store.KEYS) {
    return {
      ok: false,
      reason: 'store_required'
    };
  }

  var key = store.KEYS.pairing;
  var invite = store.readJSON(key, null);

  if (!invite || typeof invite !== 'object' || typeof invite.code !== 'string') {
    return {
      ok: false,
      reason: 'invite_missing'
    };
  }

  var updated = {
    code: invite.code,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    consent: consent,
    used: invite.used === true,
    paired: invite.paired === true
  };

  if (!store.writeJSON(key, updated)) {
    return {
      ok: false,
      reason: 'storage_unavailable'
    };
  }

  return {
    ok: true,
    invite: updated
  };
}


  function acceptInvite(options) {
  var store = options && options.store;
  var now = options && Number.isFinite(options.now)
    ? options.now
    : 0;
  var enteredCode = options && String(options.code || '').trim();

  if (!store || !store.KEYS) {
    return {
      ok: false,
      reason: 'store_required'
    };
  }

  var invite = store.readJSON(store.KEYS.pairing, null);

  if (!invite || typeof invite !== 'object') {
    return {
      ok: false,
      reason: 'invite_missing'
    };
  }

  if (!/^\d{6}$/.test(enteredCode)) {
    return {
      ok: false,
      reason: 'invalid_code'
    };
  }

  if (invite.paired === true) {
    return {
      ok: false,
      reason: 'already_paired'
    };
  }

  if (invite.used === true) {
    return {
      ok: false,
      reason: 'code_used'
    };
  }

  if (isExpired(invite, now)) {
    return {
      ok: false,
      reason: 'expired_code'
    };
  }

  if (invite.consent !== true) {
    return {
      ok: false,
      reason: 'consent_required'
    };
  }

  if (enteredCode !== invite.code) {
    return {
      ok: false,
      reason: 'invalid_code'
    };
  }

  var paired = {
    code: invite.code,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    consent: true,
    used: true,
    paired: true
  };

  if (!store.writeJSON(store.KEYS.pairing, paired)) {
    return {
      ok: false,
      reason: 'storage_unavailable'
    };
  }

  return {
    ok: true,
    invite: paired
  };
}


  function disconnect(options) {
  var store = options && options.store;
  var confirmed = options && options.confirmed === true;
  var now = options && Number.isFinite(options.now)
    ? options.now
    : 0;
  var random = options && Number.isInteger(options.random)
    ? options.random
    : 0;

  if (!store || !store.KEYS) {
    return {
      ok: false,
      reason: 'store_required'
    };
  }

  if (!confirmed) {
    return {
      ok: false,
      reason: 'not_confirmed'
    };
  }

  var nextInvite = createInvite({
    now: now,
    random: random
  });

  if (!store.writeJSON(store.KEYS.medicines, [])) {
    return {
      ok: false,
      reason: 'storage_unavailable'
    };
  }

  if (!store.writeJSON(store.KEYS.taken, [])) {
    return {
      ok: false,
      reason: 'storage_unavailable'
    };
  }

  if (!store.writeJSON(store.KEYS.pairing, nextInvite)) {
    return {
      ok: false,
      reason: 'storage_unavailable'
    };
  }

  return {
    ok: true,
    invite: nextInvite
  };
}


  return {
    CODE_LENGTH: CODE_LENGTH,
    INVITE_TTL_MS: INVITE_TTL_MS,
    createInvite: createInvite,
    isExpired: isExpired,
    setConsent: setConsent,
    acceptInvite: acceptInvite,
    disconnect: disconnect
  };

});