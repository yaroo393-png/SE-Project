/* global MedMind, state, render, caregiverMode, heading, toast, readMedicines, readTodayDoses, localDateKey */
/* exported pairingPage */
/*
 * pairing.js — จับคู่ด้วยรหัสเชิญและ QR ในเบราว์เซอร์ (Issue #46)
 * Covers: FR-01 · BR-01–02 · ผู้รับผิดชอบเดิม: Rossatorn / IDK-SleepyBro
 * แยกจาก flows.js โดยคงตรรกะเดิมไว้ให้ Takkan พัฒนาต่อ
 */
const flowCopy = {
  th: {
    nav: 'เชื่อมต่อ',
    patientTitle: 'เชื่อมต่อผู้ดูแล',
    patientSub: 'สร้างรหัสเชิญให้ลูกหลานช่วยดูแลมื้อยา',
    caregiverTitle: 'เชื่อมต่อกับผู้สูงอายุ',
    caregiverSub: 'สแกน QR หรือกรอกรหัสเชิญ 6 หลัก',
    covers1: 'Covers: FR-01 · BR-01–02',
    covers2: 'Covers: FR-02 · BR-03–07',
    inviteTitle: 'รหัสเชิญของคุณ',
    inviteHint: 'ให้ผู้ดูแลสแกน QR หรือกรอกรหัสนี้',
    expires: 'รหัสหมดอายุใน',
    newCode: 'สร้างรหัสใหม่',
    consent: 'ฉันยินยอมให้เชื่อมต่อกับผู้ดูแล เพื่อช่วยติดตามมื้อยา',
    consentHint: 'จะเชื่อมต่อได้หลังจากคุณยินยอมเท่านั้น',
    paired: 'เชื่อมต่อแล้ว',
    pairedName: 'ผู้ดูแลหลัก: มินตรา',
    unpair: 'ยกเลิกการเชื่อมต่อ',
    enterCode: 'กรอกรหัสเชิญ 6 หลัก',
    connect: 'ยืนยันการเชื่อมต่อ',
    scanQr: 'สแกน QR ด้วยกล้อง',
    stopCamera: 'ปิดกล้อง',
    cameraStarting: 'กำลังเปิดกล้อง…',
    cameraUnsupported:
      'เบราว์เซอร์นี้ยังสแกน QR ด้วยกล้องไม่ได้ กรุณากรอกรหัส 6 หลักแทน',
    cameraDenied: 'เปิดกล้องไม่ได้ กรุณาอนุญาตกล้องหรือกรอกรหัส 6 หลัก',
    codeRequired: 'กรุณากรอกรหัสเชิญ 6 หลัก',
    codeInvalid: 'รหัสไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
    codeExpired: 'รหัสนี้หมดอายุแล้ว กรุณาให้ผู้สูงอายุสร้างรหัสใหม่',
    codeUsed: 'รหัสนี้ถูกใช้แล้ว',
    consentRequired: 'รอผู้สูงอายุกดยินยอมก่อนเชื่อมต่อ',
    alreadyPaired: 'ผู้สูงอายุท่านนี้มีผู้ดูแลแล้ว',
    connected: 'เชื่อมต่อสำเร็จ',
    demoOnly:
      'เดโมนี้จับคู่ได้ในเบราว์เซอร์เดียวกันเท่านั้น ยังไม่มีระบบซิงก์ข้ามอุปกรณ์',
    unpairConfirm: 'ยกเลิกการเชื่อมต่อและลบข้อมูลยา/ประวัติของคู่นี้หรือไม่?',
    scanLabel: 'ถ่ายภาพฉลากยา',
    photoButton: 'เปิดกล้องหรือเลือกรูปฉลาก',
    photoReady:
      'เพิ่มภาพแล้ว · ระบบกำลังอ่านฉลากด้วย OCR กรุณาตรวจผลและกรอกข้อมูลที่ขาดก่อนบันทึก',
    photoPrivacy: 'ภาพเก็บไว้ชั่วคราวในเบราว์เซอร์นี้ และไม่ถูกอัปโหลด',
    items: 'รายการ',
    scheduleMeds: 'รายการยาตามเวลา',
    readOnly: 'ดูรายการยาได้ ผู้ดูแลเป็นผู้เพิ่มหรือแก้ไข',
    of: 'จาก',
    doses: 'มื้อ',
    noSchedule: 'ยังไม่มีรายการยา',
    allDone: 'วันนี้ยืนยันมื้อยาครบแล้ว',
    reminderDemo: 'ตารางนี้เป็นเดโม ยังไม่มีการส่งแจ้งเตือนจริง',
    sendReminder: 'เตือนผู้สูงอายุ (เดโม)',
    photoInvalid: 'กรุณาเลือกรูปฉลากยา'
  },
  en: {
    nav: 'Pairing',
    patientTitle: 'Connect a caregiver',
    patientSub: 'Create an invitation so family can help track doses',
    caregiverTitle: 'Connect to a senior',
    caregiverSub: 'Scan a QR code or enter the 6-digit invitation code',
    covers1: 'Covers: FR-01 · BR-01–02',
    covers2: 'Covers: FR-02 · BR-03–07',
    inviteTitle: 'Your invitation code',
    inviteHint: 'Ask the caregiver to scan the QR or enter this code',
    expires: 'Code expires in',
    newCode: 'Create a new code',
    consent: 'I agree to connect with a caregiver to help track my medicines',
    consentHint: 'The connection only completes after you agree',
    paired: 'Connected',
    pairedName: 'Primary caregiver: Mintra',
    unpair: 'Disconnect',
    enterCode: 'Enter the 6-digit invitation code',
    connect: 'Confirm connection',
    scanQr: 'Scan QR with camera',
    stopCamera: 'Close camera',
    cameraStarting: 'Opening camera…',
    cameraUnsupported:
      'QR camera scanning is unavailable in this browser. Enter the 6-digit code instead.',
    cameraDenied:
      'Camera could not be opened. Allow camera access or enter the code.',
    codeRequired: 'Enter the 6-digit invitation code',
    codeInvalid: 'That code is not valid. Check it and try again.',
    codeExpired: 'This code has expired. Ask the senior to create a new one.',
    codeUsed: 'This code has already been used',
    consentRequired: 'Waiting for the senior to agree before connecting',
    alreadyPaired: 'This senior already has a caregiver',
    connected: 'Connected successfully',
    demoOnly:
      'This demo pairs in the same browser only. Cross-device sync is not connected.',
    unpairConfirm:
      'Disconnect and delete this pair’s medicine data and history?',
    scanLabel: 'Capture medicine label',
    photoButton: 'Open camera or choose a label photo',
    photoReady:
      'Photo added · OCR reads this label in your browser. Check the results and complete missing details before saving.',
    photoPrivacy:
      'The photo stays temporarily in this browser and is not uploaded',
    items: 'items',
    scheduleMeds: 'Medicine schedule',
    readOnly: 'You can view medicines. A caregiver manages changes.',
    of: 'of',
    doses: 'doses',
    noSchedule: 'No medicines have been added yet',
    allDone: 'All doses for today are confirmed',
    reminderDemo: 'Demo schedule only. No real reminder is sent.',
    sendReminder: 'Remind senior (demo)',
    photoInvalid: 'Choose a medicine-label image'
  }
};

let flowQrStream = null;
let flowQrFrame = 0;
let flowCountdown = 0;

function pairingStore() {
  return MedMind.store;
}

function pairingLogic() {
  return MedMind.pairing;
}

function flowRandomValue() {
  const values = new Uint32Array(1);

  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(values);
    return values[0];
  }

  return Math.floor(Math.random() * 0xffffffff);
}


function flowText(key) {
  const lang =
    typeof state !== 'undefined' && state.lang === 'en' ? 'en' : 'th';
  return flowCopy[lang][key] || key;
}

function flowReadInvite() {
  const store = pairingStore();
  let invite = store.readJSON(store.KEYS.pairing, null);

  if (
    !invite ||
    typeof invite !== 'object' ||
    typeof invite.code !== 'string'
  ) {
    invite = flowCreateInvite();
    flowSaveInvite(invite);
  }

  return invite;
}


function flowSaveInvite(invite) {
  const store = pairingStore();
  return store.writeJSON(store.KEYS.pairing, invite);
}


function flowCreateInvite() {
  return pairingLogic().createInvite({
    now: Date.now(),
    random: flowRandomValue()
  });
}



function flowNewInvite() {
  const old = flowReadInvite();
  if (old.paired) return;
  let next = flowCreateInvite();
  while (next.code === old.code) next = flowCreateInvite();
  flowSaveInvite(next);
  render();
}

function flowQrSvg(payload) {
  // QR Model 2, version 1-L, byte mode; a 6-digit code fits in this local encoder.
  const gfMul = (a, b) => {
    let z = 0;
    for (let i = 0; i < 8; i++) {
      if (b & 1) z ^= a;
      const high = a & 0x80;
      a = (a << 1) & 0xff;
      if (high) a ^= 0x1d;
      b >>>= 1;
    }
    return z;
  };
  const appendBits = (out, value, length) => {
    for (let i = length - 1; i >= 0; i--) out.push((value >>> i) & 1);
  };
  const bits = [];
  const dataText = String(payload).slice(0, 17);
  appendBits(bits, 4, 4);
  appendBits(bits, dataText.length, 8);
  for (const char of dataText) appendBits(bits, char.charCodeAt(0), 8);
  const capacity = 19 * 8;
  for (let i = 0; i < Math.min(4, capacity - bits.length); i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8)
    data.push(bits.slice(i, i + 8).reduce((n, bit) => (n << 1) | bit, 0));
  for (let pad = 0; data.length < 19; pad++)
    data.push(pad % 2 === 0 ? 0xec : 0x11);
  let generator = [1];
  let root = 1;
  for (let i = 0; i < 7; i++) {
    const next = Array(generator.length + 1).fill(0);
    generator.forEach((v, j) => {
      next[j] ^= v;
      next[j + 1] ^= gfMul(v, root);
    });
    generator = next;
    root = gfMul(root, 2);
  }
  const remainder = Array(7).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder.shift();
    remainder.push(0);
    for (let i = 0; i < 7; i++) remainder[i] ^= gfMul(generator[i + 1], factor);
  }
  const codewords = data.concat(remainder);
  const codeBits = [];
  codewords.forEach((byte) => appendBits(codeBits, byte, 8));
  const size = 21;
  const matrix = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));
  const setFunction = (row, col, dark) => {
    if (row >= 0 && row < size && col >= 0 && col < size) {
      matrix[row][col] = !!dark;
      reserved[row][col] = true;
    }
  };
  const finder = (top, left) => {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const dark =
          inside &&
          (r === 0 ||
            r === 6 ||
            c === 0 ||
            c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        setFunction(top + r, left + c, dark);
      }
  };
  finder(0, 0);
  finder(0, 14);
  finder(14, 0);
  for (let i = 8; i < 13; i++) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }
  const formatA = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8]
  ];
  const formatB = [
    [20, 8],
    [19, 8],
    [18, 8],
    [17, 8],
    [16, 8],
    [15, 8],
    [14, 8],
    [13, 8],
    [8, 14],
    [8, 15],
    [8, 16],
    [8, 17],
    [8, 18],
    [8, 19],
    [8, 20]
  ];
  [...formatA, ...formatB].forEach(([r, c]) => setFunction(r, c, false));
  setFunction(13, 8, true);
  let bitIndex = 0;
  for (let right = 20; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      const row = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
      for (let offset = 0; offset < 2; offset++) {
        const col = right - offset;
        if (reserved[row][col]) continue;
        let dark =
          bitIndex < codeBits.length ? codeBits[bitIndex++] === 1 : false;
        if ((row + col) % 2 === 0) dark = !dark;
        matrix[row][col] = dark;
      }
    }
  }
  let formatData = 8; // Error correction level L + mask pattern 0.
  let rem = formatData;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >>> 9) & 1) * 0x537);
  const formatBits = ((formatData << 10) | rem) ^ 0x5412;
  formatA.forEach(([r, c], i) => {
    matrix[r][c] = ((formatBits >>> i) & 1) !== 0;
  });
  formatB.forEach(([r, c], i) => {
    matrix[r][c] = ((formatBits >>> i) & 1) !== 0;
  });
  matrix[13][8] = true;
  const quiet = 4;
  let path = '';
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (matrix[r][c]) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  const full = size + quiet * 2;
  return `<svg class="invite-qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" role="img" aria-label="QR invitation code ${payload}" shape-rendering="crispEdges"><rect width="${full}" height="${full}" fill="#fff"/><path d="${path}" fill="#163f32"/></svg>`;
}

function pairingPage() {
  const invite = flowReadInvite();
  const head = caregiverMode
    ? heading(flowText('caregiverTitle'), flowText('caregiverSub'))
    : heading(flowText('patientTitle'), flowText('patientSub'));
  if (caregiverMode) {
    if (invite.paired)
      return `${head}<section class="pair-card pair-success"><span class="pair-status-icon">✓</span><h2>${flowText('paired')}</h2><p>${flowText('pairedName')}</p><p class="muted-caption">${flowText('demoOnly')}</p><button class="secondary-button" id="cancel-pair">${flowText('unpair')}</button></section>`;
    return `${head}<section class="pair-grid"><article class="pair-card"><div class="section-title"><h2>${flowText('scanQr')}</h2></div><button class="secondary-button" id="start-qr-camera">${flowText('scanQr')}</button><div class="qr-camera-wrap" id="qr-camera-wrap" hidden><video id="qr-video" playsinline muted></video><p id="qr-camera-status" class="muted-caption" role="status">${flowText('cameraStarting')}</p><button class="text-link" id="stop-qr-camera">${flowText('stopCamera')}</button></div><p class="muted-caption">${flowText('demoOnly')}</p></article><article class="pair-card"><h2>${flowText('enterCode')}</h2><label class="invite-input-label" for="invite-code-entry">${flowText('enterCode')}</label><input id="invite-code-entry" class="invite-code-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" aria-describedby="pair-feedback"><button class="primary-button full-button" id="pair-connect">${flowText('connect')}</button><p id="pair-feedback" class="pair-feedback" role="status" aria-live="polite"></p></article></section>`;
  }
  if (invite.paired)
    return `${head}<section class="pair-card pair-success"><span class="pair-status-icon">✓</span><h2>${flowText('paired')}</h2><p>${flowText('pairedName')}</p><button class="secondary-button" id="cancel-pair">${flowText('unpair')}</button></section>`;
  const expired = Date.now() >= Number(invite.expiresAt || 0) || invite.used;
  return `${head}<section class="pair-grid"><article class="pair-card invite-card"><div><span class="eyebrow">${flowText('inviteTitle')}</span><h2>${invite.code}</h2><p>${flowText('inviteHint')}</p><div class="invite-expiry">${flowText('expires')} <strong id="invite-countdown">10:00</strong></div><button class="secondary-button" id="new-invite">${flowText('newCode')}</button></div><div class="qr-wrap">${flowQrSvg(invite.code)}</div></article><article class="pair-card consent-card"><h2>${flowText('consentHint')}</h2><label class="consent-control"><input id="senior-consent" type="checkbox" ${invite.consent ? 'checked' : ''}><span>${flowText('consent')}</span></label><p class="muted-caption">${flowText('demoOnly')}</p>${expired ? `<p class="pair-feedback" role="status">${flowText(invite.used ? 'codeUsed' : 'codeExpired')}</p>` : ''}<button class="secondary-button" id="new-invite-secondary">${flowText('newCode')}</button></article></section>`;
}

function flowPairFeedback(message) {
  const el = document.getElementById('pair-feedback');
  if (el) el.textContent = message;
  else if (typeof toast === 'function') toast(message);
}

function flowTryPair() {
  const input = document.getElementById('invite-code-entry');
  const entered = input ? input.value.trim() : '';

  if (!/^\d{6}$/.test(entered)) {
    flowPairFeedback(flowText('codeRequired'));
    return;
  }

  const result = pairingLogic().acceptInvite({
    store: pairingStore(),
    now: Date.now(),
    code: entered
  });

  if (!result.ok) {
    const messages = {
      invalid_code: flowText('codeInvalid'),
      expired_code: flowText('codeExpired'),
      code_used: flowText('codeUsed'),
      consent_required: flowText('consentRequired'),
      already_paired: flowText('alreadyPaired'),
      invite_missing: flowText('codeInvalid'),
      storage_unavailable: 'ไม่สามารถบันทึกข้อมูลได้',
      store_required: 'ไม่สามารถเชื่อมต่อที่เก็บข้อมูลได้'
    };

    flowPairFeedback(messages[result.reason] || flowText('codeInvalid'));
    return;
  }

  state.medicines = readMedicines();
  state.taken = readTodayDoses();
  state.takenDate = localDateKey();
  state.page = 'caregiverHome';
  render();

  if (typeof toast === 'function') {
    toast(flowText('connected'));
  }
}


function flowUnpair() {
  if (!window.confirm(flowText('unpairConfirm'))) return;

  const result = pairingLogic().disconnect({
    store: pairingStore(),
    confirmed: true,
    now: Date.now(),
    random: flowRandomValue()
  });

  if (!result.ok) {
    flowPairFeedback('ไม่สามารถยกเลิกการเชื่อมต่อได้');
    return;
  }

  state.taken = [];
  state.medicines = [];
  state.page = 'pairing';
  render();
}



function flowFormatRemaining() {
  const invite = flowReadInvite();
  const seconds = Math.max(
    0,
    Math.ceil((Number(invite.expiresAt || 0) - Date.now()) / 1000)
  );
  const node = document.getElementById('invite-countdown');
  if (node)
    node.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function flowStopQrCamera() {
  if (flowQrFrame) cancelAnimationFrame(flowQrFrame);
  flowQrFrame = 0;
  if (flowQrStream) flowQrStream.getTracks().forEach((track) => track.stop());
  flowQrStream = null;
  const video = document.getElementById('qr-video');
  if (video) video.srcObject = null;
  const wrap = document.getElementById('qr-camera-wrap');
  if (wrap) wrap.hidden = true;
}

async function flowStartQrCamera() {
  const status = document.getElementById('qr-camera-status');
  const wrap = document.getElementById('qr-camera-wrap');
  const video = document.getElementById('qr-video');
  if (
    !window.BarcodeDetector ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    if (wrap) wrap.hidden = false;
    if (status) status.textContent = flowText('cameraUnsupported');
    return;
  }
  try {
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    flowQrStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
    if (wrap) wrap.hidden = false;
    if (status) status.textContent = flowText('cameraStarting');
    video.srcObject = flowQrStream;
    await video.play();
    const scan = async () => {
      if (!flowQrStream || video.readyState < 2) {
        flowQrFrame = requestAnimationFrame(scan);
        return;
      }
      try {
        const result = await detector.detect(video);
        if (result.length) {
          const value = result[0].rawValue.trim();
          const input = document.getElementById('invite-code-entry');
          if (input) input.value = value.match(/\d{6}/)?.[0] || value;
          if (status) status.textContent = flowText('connect');
          flowStopQrCamera();
          return;
        }
      } catch {
        /* Keep the manual-code fallback available. */
      }
      flowQrFrame = requestAnimationFrame(scan);
    };
    flowQrFrame = requestAnimationFrame(scan);
  } catch {
    if (wrap) wrap.hidden = false;
    if (status) status.textContent = flowText('cameraDenied');
    flowStopQrCamera();
    if (wrap) wrap.hidden = false;
    if (status) status.textContent = flowText('cameraDenied');
  }
}

function flowSetup() {
  document.addEventListener(
    'click',
    (event) => {
      const button =
        event.target instanceof Element ? event.target.closest('button') : null;
      if (!button) return;
      if (button.id === 'new-invite' || button.id === 'new-invite-secondary')
        flowNewInvite();
      if (button.id === 'pair-connect') flowTryPair();
      if (button.id === 'start-qr-camera') flowStartQrCamera();
      if (button.id === 'stop-qr-camera') flowStopQrCamera();
      if (button.id === 'cancel-pair') flowUnpair();
      const pageLink = button.closest('[data-page]');
      if (pageLink) flowStopQrCamera();
    },
    true
  );
  document.addEventListener('change', (event) => {
    if (event.target?.id === 'senior-consent') {
  const result = pairingLogic().setConsent({
    store: pairingStore(),
    consent: event.target.checked
  });

  if (!result.ok) {
    flowPairFeedback('ไม่สามารถบันทึกการยินยอมได้');
  }
}

  });
 window.addEventListener('storage', (event) => {
  if (event.key === pairingStore().KEYS.pairing) {
    render();
  }
});

  if (!flowCountdown)
    flowCountdown = window.setInterval(flowFormatRemaining, 1000);
}

if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', flowSetup, { once: true });
else flowSetup();
