/*
 * scan.js — สแกนฉลากยาในหน้าผู้ดูแล: รูปฉลาก → อ่านตัวหนังสือในเบราว์เซอร์ → เติมฟอร์มเพิ่มยา → ผู้ดูแลตรวจแล้วกดบันทึกเอง
 * ผู้รับผิดชอบ: YAR OO
 *
 * Covers: FR-02 (✓1, ✗3, ✗4, ✗5, ✗10) · BR-04 (ไม่เดา) · BR-06 (เวลาจากเวลามื้อ) · NFR-06 (ไม่บันทึกเองจนกด "บันทึก") · NFR-09 (รูปไม่ออกนอกเครื่อง)
 * "ดูข้อความที่อ่านได้": ให้ผู้ดูแลเทียบว่าระบบอ่านฉลากได้แค่ไหน (ช่องว่างเพราะอ่านไม่ออก หรือเพราะตีความไม่ได้) — อยู่แค่บนหน้าจอ ไม่บันทึก
   ซ่อนบรรทัดผู้ป่วย/HN ให้ก่อน (labelParser.redact) และล้างทิ้งเมื่อปิดฟอร์ม
 * ใช้: logic/reminder.js, logic/labelParser.js, logic/labelForm.js, core/store.js, services/scanner.js — ต้องโหลดก่อนไฟล์นี้
 * ต่อกับฟอร์ม #medicine-form ของหน้า demo โดยไม่แก้ flows.js / app.js: ฟัง change ของ #medicine-photo-input แล้ววางผลในกล่อง #scan-panel
 * ไม่มี server: Tesseract.js อ่านในเครื่อง (ครั้งแรกต้องต่อเน็ตเพื่อโหลดตัวอ่าน) · "ฉลากตัวอย่าง" ใช้ demo ทุกกรณีของ AC ได้แม้ไม่มีเน็ต
 */
(function (root) {
  'use strict';
  var M = root.MedMind;

  /** ข้อความตัวอย่างแบบที่ OCR อ่านได้จริง — ใช้ demo แต่ละกรณีของ AC (ชื่อยา/ผู้ป่วยเป็นค่าสมมติ) */
  var SAMPLES = [
    { id: 'clear', label: 'ฉลากชัด — หลังอาหารเช้า (✓1)', text: 'โรงพยาบาลตัวอย่าง\nHN 0000000\nAMLODIPINE 5 MG TAB\nรับประทานครั้งละ 1 เม็ด วันละ 1 ครั้ง\nหลังอาหาร เช้า\nคำเตือน: อาจทำให้เวียนศีรษะ' },
    { id: 'before30', label: 'ก่อนอาหารเช้า 30 นาที (✓8)', text: 'OMEPRAZOLE 20 MG CAP\nครั้งละ 1 แคปซูล\nก่อนอาหารเช้า 30 นาที' },
    { id: 'bedtime', label: 'ก่อนนอน (✓9)', text: 'CHLORPHENIRAMINE 4 MG\nครั้งละ 1 เม็ด ก่อนนอน\nยานี้อาจทำให้ง่วงซึม' },
    { id: 'twoMeals', label: 'หลังอาหารเช้า-เย็น (หลายมื้อ)', text: 'METFORMIN 500 MG\nครั้งละ 2 เม็ด\nหลังอาหาร เช้า - เย็น' },
    // ตารางสีข้างฉลาก: OCR อ่านเป็นคอลัมน์ขวา ห่างจากข้อความวิธีใช้หลายช่องว่าง
    { id: 'sideTable', label: 'ตารางข้างฉลาก เช้า 2 / เย็น 1 เม็ด', text: 'นายสมมติ ทดสอบ  HN 0000000            เช้า 2 เม็ด\nGLIPIZIDE 5 MG/1 TABLET            เที่ยง -\nรับประทานหลังอาหาร            เย็น 1 เม็ด\n# 30 เม็ด            ก่อนนอน -' },
    { id: 'blurry', label: 'อ่านชื่อยาไม่ได้ (✗3)', text: 'ร บ ป ร ะ … เม็ด\nหลังอาหาร เย็น' },
    { id: 'noMinutes', label: 'ก่อนอาหาร ไม่ระบุนาที (✗10)', text: 'GLICLAZIDE 80 MG\nครั้งละ 1 เม็ด ก่อนอาหารเช้า' },
    { id: 'prn', label: 'ยาเมื่อมีอาการ (✗4)', text: 'PARACETAMOL 500 MG\nครั้งละ 1-2 เม็ด ทุก 4-6 ชั่วโมง เวลาปวด หรือมีไข้' },
    { id: 'unreadable', label: 'อ่านรูปไม่ได้ (✗5)', text: '~~ ## ..' }
  ];

  var form = null;
  var panel = null;
  var blocked = false; // FR-02 ✗4: ยาที่ไม่รองรับ → ห้ามบันทึก
  var runId = 0;       // กันผลของรูปเก่ามาทับรูปใหม่ ถ้าผู้ใช้เลือกรูปซ้ำระหว่างอ่าน

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function say(html, kind) {
    var status = panel.querySelector('.scan-status');
    status.className = 'scan-status' + (kind ? ' ' + kind : '');
    status.innerHTML = html;
    status.hidden = !html;
  }

  function progress(value) {
    var bar = panel.querySelector('.scan-progress');
    bar.hidden = value === null;
    if (value !== null) bar.firstElementChild.style.width = Math.round(value * 100) + '%';
  }

  /** ข้อความที่อ่านได้ (ซ่อนข้อมูลผู้ป่วยแล้ว) · '' = ซ่อนกล่อง */
  function showRaw(text) {
    var box = panel.querySelector('.scan-raw');
    box.querySelector('.scan-raw-text').textContent = text ? M.labelParser.redact(text) || '(ไม่พบตัวหนังสือในรูป)' : '';
    box.hidden = !text;
    box.open = false;
  }

  function copyRaw() {
    var text = panel.querySelector('.scan-raw-text').textContent;
    var done = function () { if (typeof root.toast === 'function') root.toast('คัดลอกแล้ว — ตรวจลบชื่อผู้ป่วยก่อนส่งต่อ'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { selectRaw(); });
    } else {
      selectRaw();
    }
  }

  /** คัดลอกอัตโนมัติไม่ได้ (เปิดไฟล์ตรง ๆ / เบราว์เซอร์ไม่อนุญาต) → เลือกข้อความไว้ให้กดคัดลอกเอง */
  function selectRaw() {
    var range = document.createRange();
    range.selectNodeContents(panel.querySelector('.scan-raw-text'));
    var sel = root.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /** ล้างผลสแกน (เปิดฟอร์มใหม่ / ปิดฟอร์ม) */
  function reset() {
    runId++;
    blocked = false;
    say('');
    showRaw('');
    progress(null);
    panel.querySelector('.scan-sample').value = '';
    form.querySelectorAll('.needs-review').forEach(function (el) { el.classList.remove('needs-review'); });
  }

  function setField(name, value) {
    var el = form.elements[name];
    if (!el) return;
    if (el.tagName === 'SELECT' && !value) return; // ไม่มีค่า → คงตัวเลือกเดิมไว้ ให้ผู้ดูแลเลือกเอง
    el.value = value;
  }

  /** ผลจาก labelParser → เติมฟอร์ม + บอกช่องที่ต้องตรวจ (ยังไม่บันทึกจนผู้ดูแลกด "บันทึก" — NFR-06) */
  function apply(parsed, source) {
    progress(null);
    form.querySelectorAll('.needs-review').forEach(function (el) { el.classList.remove('needs-review'); });
    if (!parsed.ok) {
      blocked = false;
      ['name', 'dose'].forEach(function (k) { setField(k, ''); });
      say('<b>อ่านฉลากไม่ได้</b> — กรอกข้อมูลเองจากฉลากด้านล่าง (FR-02 ✗5)', 'danger');
      return;
    }
    var meals = M.store.readMealTimes();
    var result = M.labelForm.toForm(parsed.draft, meals, M.reminder);
    if (result.unsupported) {
      blocked = true;
      say('<b>' + esc(result.unsupported) + '</b> — ไม่สร้างตารางเตือนสำหรับยานี้ จึงบันทึกไม่ได้ (FR-02 ✗4)', 'danger');
      return;
    }
    blocked = false;
    Object.keys(result.fields).forEach(function (k) { setField(k, result.fields[k]); });
    result.missing.concat(result.unsure).forEach(function (k) {
      var el = form.elements[k];
      if (el) el.classList.add('needs-review');
    });
    var lines = [
      '<b>ร่างจาก' + esc(source) + ' — ยังไม่ได้บันทึก</b> ตรวจทุกช่องกับฉลากจริง แล้วแก้ให้ถูกก่อนกดบันทึก'
    ];
    if (result.missing.length) {
      lines.push('กรุณาตรวจสอบ: ' + result.missing.map(function (k) { return M.labelForm.FIELD_LABELS[k]; }).join(', ') + ' (ระบบไม่เดาช่องที่อ่านไม่ได้)');
    }
    if (result.unsure.length) {
      lines.push('อ่านได้ไม่ชัด ระบบแก้ให้แล้วแต่ไม่แน่ใจ — ตรวจให้ตรงฉลาก: ' + result.unsure.map(function (k) { return M.labelForm.FIELD_LABELS[k]; }).join(', '));
    }
    if (result.timings.length > 1) {
      lines.push('ฉลากนี้มี ' + result.timings.length + ' มื้อ: ' + result.timings.map(esc).join(' · ') + ' — ฟอร์มนี้บันทึกได้ทีละมื้อ ให้บันทึกมื้อแรกแล้วเพิ่มมื้อที่เหลือ');
    } else if (result.timings.length === 1) {
      lines.push('มื้อ: ' + esc(result.timings[0]));
    }
    var notes = [parsed.draft.caution, parsed.draft.contraindication].filter(Boolean);
    if (notes.length) lines.push('ข้อควรระวัง / ข้อห้ามใช้บนฉลาก: ' + notes.map(esc).join(' · '));
    if (meals.isDefault) lines.push('<small>เวลาคำนวณจากเวลามื้อเริ่มต้น (เช้า ' + meals.morning + ', กลางวัน ' + meals.noon + ', เย็น ' + meals.evening + ', เข้านอน ' + meals.bedtime + ')</small>');
    say(lines.join('<br>'), result.missing.length || result.unsure.length ? 'warn' : 'ok');
  }

  /** รูปจริง → Tesseract อ่านในเครื่อง → labelParser */
  function scanPhoto(file) {
    var mine = ++runId;
    blocked = false;
    say('กำลังอ่านฉลากในเครื่อง… รูปไม่ถูกส่งออกนอกเบราว์เซอร์', 'info');
    progress(0);
    M.scanner.readLabel(file, function (label, value) {
      if (mine === runId) progress(value);
    }).then(function (res) {
      if (mine !== runId) return;
      var parsed = M.labelParser.parseLabel(res.text);
      showRaw(res.text || ' ');
      res.text = ''; // NFR-09: ไม่เก็บข้อความดิบ (แสดงบนจอจนปิดฟอร์มเท่านั้น)
      apply(parsed, 'การอ่านรูป (' + (res.ms / 1000).toFixed(1) + ' วินาที)');
    }).catch(function (err) {
      if (mine !== runId) return;
      progress(null);
      say('<b>' + esc(err && err.message ? err.message : 'อ่านฉลากไม่ได้') + '</b> — กรอกข้อมูลเองจากฉลากด้านล่าง หรือลองฉลากตัวอย่าง', 'danger');
    });
  }

  function build() {
    panel = document.createElement('div');
    panel.id = 'scan-panel';
    panel.className = 'scan-panel';
    panel.innerHTML =
      '<div class="scan-progress" role="progressbar" aria-label="ความคืบหน้าการอ่านฉลาก" hidden><div></div></div>' +
      '<p class="scan-status" role="status" aria-live="polite" hidden></p>' +
      '<label class="scan-sample-label"><span>หรือลองด้วยฉลากตัวอย่าง (demo)</span><select class="scan-sample">' +
      '<option value="">— เลือกฉลากตัวอย่าง —</option>' +
      SAMPLES.map(function (s) { return '<option value="' + s.id + '">' + esc(s.label) + '</option>'; }).join('') +
      '</select></label>' +
      '<details class="scan-raw" hidden><summary>ดูข้อความที่อ่านได้</summary>' +
      '<p class="scan-raw-note">ข้อความที่ระบบอ่านจากรูป ใช้เทียบว่าช่องไหนว่างเพราะอ่านไม่ออก · อยู่แค่บนจอนี้ ไม่ถูกบันทึก · ' +
      'ซ่อนบรรทัดผู้ป่วย/HN ให้แล้ว แต่ถ้าจะส่งให้ทีมช่วยดู ตรวจลบชื่อผู้ป่วยที่ยังเหลือก่อน</p>' +
      '<pre class="scan-raw-text"></pre>' +
      '<button class="secondary-button scan-raw-copy" type="button">คัดลอกข้อความ</button></details>';
    var block = form.querySelector('.photo-capture-block');
    block.parentNode.insertBefore(panel, block.nextSibling);

    // รูปจากกล้อง/ไฟล์ — flows.js แสดงรูปตัวอย่างไว้แล้ว ไฟล์นี้อ่านต่อ
    document.addEventListener('change', function (e) {
      if (!e.target || e.target.id !== 'medicine-photo-input') return;
      var file = e.target.files && e.target.files[0];
      if (!file || !/^image\//.test(file.type)) return;
      var note = document.getElementById('medicine-photo-note');
      setTimeout(function () { if (note) note.hidden = true; }, 0); // ข้อความเดิมของ demo บอกว่ายังไม่มี OCR
      scanPhoto(file);
    });
    panel.querySelector('.scan-sample').addEventListener('change', function () {
      var sample = SAMPLES.filter(function (s) { return s.id === this.value; }, this)[0];
      if (!sample) return;
      runId++;
      showRaw(sample.text);
      apply(M.labelParser.parseLabel(sample.text), 'ฉลากตัวอย่าง');
    });
    panel.querySelector('.scan-raw-copy').addEventListener('click', copyRaw);
    // แก้ช่องแล้ว เอาเครื่องหมาย "กรุณาตรวจสอบ" ของช่องนั้นออก
    form.addEventListener('input', function (e) { e.target.classList.remove('needs-review'); });
    // FR-02 ✗4: ยาที่ไม่รองรับ ห้ามบันทึก (ดักก่อนตัวบันทึกของ app.js)
    document.addEventListener('submit', function (e) {
      if (e.target !== form || !blocked) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (typeof root.toast === 'function') root.toast('ยานี้ระบบยังไม่รองรับ — บันทึกไม่ได้');
    }, true);
    // ปิด/เปิดฟอร์มใหม่ → ล้างผลสแกนเดิม
    var modal = document.getElementById('modal-backdrop');
    if (modal) new MutationObserver(function () { if (modal.hidden) reset(); }).observe(modal, { attributes: true, attributeFilter: ['hidden'] });
  }

  function setup() {
    form = document.getElementById('medicine-form');
    if (!form || !form.querySelector('.photo-capture-block')) return; // หน้านี้ไม่มีฟอร์มเพิ่มยา
    build();
  }

  M.scan = { SAMPLES: SAMPLES };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})(self);
