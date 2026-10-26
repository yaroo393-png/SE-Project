/* global flowText, toast */
/* exported flowResetPhoto */
/*
 * medicine.js — ภาพฉลากของฟอร์มจัดการยา แยกจากการจับคู่ (Issue #46)
 * Covers: FR-02 · ผู้รับผิดชอบ: Rossatorn / IDK-SleepyBro
 * OCR จริงเชื่อมโดย js/features/scan.js ของ YAR OO
 */
let flowPhotoUrl = null;

function flowResetPhoto() {
  const input = document.getElementById('medicine-photo-input');
  const preview = document.getElementById('medicine-photo-preview');
  const note = document.getElementById('medicine-photo-note');
  if (flowPhotoUrl) URL.revokeObjectURL(flowPhotoUrl);
  flowPhotoUrl = null;
  if (input) input.value = '';
  if (preview) {
    preview.removeAttribute('src');
    preview.hidden = true;
  }
  if (note) note.hidden = true;
}

function medicineSetupPhoto() {
  const syncPhotoCopy = () => {
    const photoButton = document.querySelector('#capture-medicine-photo span');
    if (photoButton) photoButton.textContent = flowText('photoButton');
  };
  syncPhotoCopy();
  new MutationObserver(syncPhotoCopy).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang']
  });
  document.addEventListener(
    'click',
    (event) => {
      const button =
        event.target instanceof Element ? event.target.closest('button') : null;
      if (button?.id === 'capture-medicine-photo')
        document.getElementById('medicine-photo-input')?.click();
    },
    true
  );
  document.addEventListener('change', (event) => {
    if (event.target?.id === 'medicine-photo-input') {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        if (typeof toast === 'function') toast(flowText('photoInvalid'));
        return;
      }
      const preview = document.getElementById('medicine-photo-preview');
      const note = document.getElementById('medicine-photo-note');
      if (flowPhotoUrl) URL.revokeObjectURL(flowPhotoUrl);
      flowPhotoUrl = URL.createObjectURL(file);
      if (preview) {
        preview.src = flowPhotoUrl;
        preview.hidden = false;
      }
      if (note) {
        note.textContent = `${flowText('photoReady')} ${flowText('photoPrivacy')}`;
        note.hidden = false;
      }
    }
  });
}

if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', medicineSetupPhoto, {
    once: true
  });
else medicineSetupPhoto();

/*
 * หน้าจอ FR-02: ตั้งมื้อ → ตรวจร่าง → ดูเวลา → ยืนยันบันทึก
 * ใช้ medication.js ตรวจข้อมูล และ reminder/store ของทีมโดยไม่แก้ logic สแกน
 * ช่อง name/dose/time/instruction ยังคงไว้ให้ scan.js เดิมเติมได้
 */
(function (root) {
  'use strict';
  const M = root.MedMind;
  let form;
  let editId = null;
  let legacyIndex;
  let returnFocus;
  let returnToDraft = false;
  let unsupported = null;
  let step = 'draft';
  const messages = new Map();
  const translatedNodes = new Map();
  const labels = {
    morning: 'มื้อเช้า',
    noon: 'มื้อกลางวัน',
    evening: 'มื้อเย็น',
    bedtime: 'เข้านอน'
  };

  function esc(value) {
    return String(value ?? '').replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        })[c]
    );
  }
  function copy(th, en) {
    messages.set(th, { th, en });
    messages.set(en, { th, en });
    return document.documentElement.lang === 'en' ? en : th;
  }
  /** จดเฉพาะข้อความ UI ที่สร้างเอง ไม่แตะค่าที่ผู้ใช้กรอกหรือร่างจากฉลาก */
  function rememberLabels(container) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const value = node.nodeValue.trim();
      const message = messages.get(value);
      if (message)
        translatedNodes.set(node, {
          message,
          before: node.nodeValue.slice(0, node.nodeValue.indexOf(value)),
          after: node.nodeValue.slice(
            node.nodeValue.indexOf(value) + value.length
          )
        });
    }
  }
  function asset(name) {
    return `<img class="fr02-icon" src="assets/fr02/${name}.svg" alt="">`;
  }
  function allowed() {
    return (
      document.body.dataset.role === 'caregiver' &&
      M.store.readJSON(M.store.KEYS.pairing, null)?.paired === true
    );
  }
  function notify(message) {
    if (typeof root.toast === 'function') root.toast(message);
  }

  /** รูปข้อมูลเดิมไม่มี id: ใช้ตำแหน่งเฉพาะตอนผู้ใช้สั่งแก้/ลบ ไม่ย้ายข้อมูลเงียบ ๆ */
  function groups() {
    const saved = M.store.readJSON(M.store.KEYS.medicines, []);
    if (!Array.isArray(saved)) return null;
    const rows = M.medication.resolveTimes(
      saved,
      M.store.readMealTimes(),
      M.reminder
    );
    const grouped = new Map();
    rows.forEach((row, index) => {
      if (!row || typeof row.name !== 'string') return;
      const key = row.medicationId || row.id || `legacy-${index}`;
      if (!grouped.has(key))
        grouped.set(key, {
          key,
          rows: [],
          legacyIndex: row.id || row.medicationId ? undefined : index
        });
      grouped.get(key).rows.push(row);
    });
    return [...grouped.values()];
  }

  function page(context) {
    const list = groups();
    const actions = context.caregiver
      ? `<button class="secondary-button" id="meal-times-button">${asset('clock')} ${copy('ตั้งเวลามื้อ', 'Meal times')}</button><button class="primary-button" id="add-med-button">${copy('เพิ่มยา', 'Add medicine')}</button>`
      : '';
    const cards = list
      ?.map((group) => {
        const row = group.rows[0];
        return `<article class="fr02-card medicine-item"><h2>${esc(row.name)}</h2><p>${esc(row.dose || '')} · ${group.rows.map((item) => esc(item.time)).join(' · ')}</p><p>${group.rows.map((item) => esc(item.timing ? M.labelForm.timingText(item.timing) : item.instruction)).join(' · ')}</p>${group.rows.some((item) => item.needsReview) ? `<p class="fr02-error">${copy('กรุณาตรวจสอบเวลามื้อและนาทีก่อนอาหาร', 'Check meal times and minutes before food')}</p>` : ''}${row.caution ? `<p>${copy('ข้อควรระวัง', 'Caution')}: ${esc(row.caution)}</p>` : ''}${row.contraindication ? `<p>${copy('ข้อห้ามใช้', 'Contraindication')}: ${esc(row.contraindication)}</p>` : ''}${context.caregiver ? `<div class="fr02-card-actions"><button class="secondary-button" data-med-edit="${esc(group.key)}">${copy('ตรวจและแก้ไข', 'Review and edit')}</button><button class="secondary-button" data-med-delete="${esc(group.key)}">${copy('ลบยา', 'Delete')}</button></div>` : ''}</article>`;
      })
      .join('');
    return `<div class="fr02-page">${context.heading(copy('ยาและตารางยา', 'Medicines and schedule'), copy('ดูแลรายการยาและเวลาให้เป็นระเบียบในที่เดียว', 'Keep medicines and reminders together'), actions)}<label class="fr02-search">${copy('ค้นหารายการยา', 'Search medicines')}<input id="medicine-search" type="search"></label><div class="medicine-grid">${list === null ? `<p role="alert">${copy('อ่านรายการยาไม่ได้ กรุณาลองใหม่', 'Unable to read medicines. Please retry.')}</p>` : cards || `<div class="fr02-card empty-state"><h2>${copy('ยังไม่มีรายการยา', 'No medicines yet')}</h2><p>${copy('ผู้ดูแลเพิ่มยาจากฉลากหรือกรอกข้อมูลเองได้', 'A caregiver can scan a label or enter a medicine.')}</p></div>`}</div><p id="medicine-empty-search" hidden role="status">${copy('ไม่พบยาที่ค้นหา ลองชื่ออื่น', 'No matching medicines. Try another name.')}</p><p class="fr02-muted">${copy('ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้ · เตือนเฉพาะขณะเปิดเว็บ', 'Stored in this browser · Reminders require the page to stay open')}</p></div>`;
  }

  /** แต่ละมื้อมีชนิด/นาทีของตัวเอง รองรับฉลากหลายมื้อและคำสั่งต่างกัน */
  function timingRow(timing = {}) {
    const row = document.createElement('fieldset');
    row.className = 'fr02-timing';
    row.innerHTML = `<legend>${copy('มื้อ / เวลาบนฉลาก', 'Timing on the label')}</legend><label>${copy('เวลากินตามฉลาก', 'Instruction')}<select data-timing="type"><option value="">${copy('กรุณาเลือก', 'Select')}</option><option value="after">${copy('หลังอาหาร', 'After food')}</option><option value="before">${copy('ก่อนอาหาร', 'Before food')}</option><option value="bedtime">${copy('ก่อนนอน', 'Bedtime')}</option></select></label><label data-slot-label>${copy('มื้อ', 'Meal')}<select data-timing="slot"><option value="">${copy('กรุณาเลือกมื้อ', 'Select a meal')}</option><option value="morning">${copy('เช้า', 'Morning')}</option><option value="noon">${copy('กลางวัน', 'Noon')}</option><option value="evening">${copy('เย็น', 'Evening')}</option></select></label><label data-minutes-label>${copy('ก่อนอาหารกี่นาที', 'Minutes before food')}<input data-timing="minutesBefore" inputmode="numeric" autocomplete="off"><span class="fr02-error" data-minutes-error></span></label><button class="secondary-button" type="button" data-remove-timing>${copy('นำมื้อนี้ออก', 'Remove this timing')}</button>`;
    row.querySelector('[data-timing="type"]').value = timing.type || '';
    row.querySelector('[data-timing="slot"]').value = timing.slot || '';
    row.querySelector('[data-timing="minutesBefore"]').value =
      timing.minutesBefore ?? '';
    if (timing.pills !== undefined) {
      const label = document.createElement('label');
      label.textContent = copy(
        'จำนวนเม็ดของมื้อนี้ (ตามฉลาก)',
        'Pills for this timing (from label)'
      );
      const input = document.createElement('input');
      input.dataset.timing = 'pills';
      input.inputMode = 'numeric';
      input.value = timing.pills;
      label.append(input);
      row.append(label);
    }
    form.querySelector('#medicine-timings').append(row);
    rememberLabels(row);
    return row;
  }
  function setTimings(timings) {
    form.querySelector('#medicine-timings').replaceChildren();
    (timings.length ? timings : [{}]).forEach(timingRow);
  }
  function readDraft() {
    return {
      name: form.elements.name.value,
      pills: /^\d+$/.test(form.elements.dose.value.trim())
        ? Number(form.elements.dose.value)
        : null,
      timings: [...form.querySelectorAll('.fr02-timing')].map((row) => {
        const type = row.querySelector('[data-timing="type"]').value;
        const timing = { type };
        if (type !== 'bedtime')
          timing.slot = row.querySelector('[data-timing="slot"]').value;
        if (type === 'before') {
          const minutes = row
            .querySelector('[data-timing="minutesBefore"]')
            .value.trim();
          timing.minutesBefore = /^\d+$/.test(minutes) ? Number(minutes) : null;
        }
        const perMeal = row.querySelector('[data-timing="pills"]');
        if (perMeal)
          timing.pills = /^\d+$/.test(perMeal.value.trim())
            ? Number(perMeal.value)
            : null;
        return timing;
      }),
      caution: form.elements.caution.value,
      contraindication: form.elements.contraindication.value,
      unsupported
    };
  }
  function scanning() {
    const bar = form.querySelector('.scan-progress');
    return bar ? !bar.hidden : false;
  }
  function showStep(next) {
    step = next;
    ['meal', 'draft', 'preview'].forEach((key) => {
      form.querySelector(`#medicine-${key}`).hidden = key !== next;
    });
    document.getElementById('modal-title').textContent =
      next === 'meal'
        ? copy('ตั้งเวลามื้อ', 'Meal times')
        : next === 'preview'
          ? copy('ตรวจเวลาเตือน', 'Review reminders')
          : copy('ตรวจและแก้ไขยา', 'Review medicine');
    refresh();
    form
      .querySelector(`#medicine-${next}`)
      .querySelector('input, select, button, [tabindex]')
      ?.focus();
  }

  /** preview ไม่เขียน storage; ถ้าข้อมูลไม่ครบ แสดงคำที่ตรวจสอบได้และปิดปุ่มบันทึก */
  function refresh() {
    const draft = readDraft();
    form.querySelectorAll('.fr02-timing').forEach((row, index) => {
      const timing = draft.timings[index];
      row.querySelector('[data-slot-label]').hidden = timing.type === 'bedtime';
      row.querySelector('[data-minutes-label]').hidden =
        timing.type !== 'before';
      row.querySelector('[data-remove-timing]').hidden =
        draft.timings.length === 1;
      const input = row.querySelector('[data-timing="minutesBefore"]');
      const missing = timing.type === 'before' && !timing.minutesBefore;
      input.classList.toggle('needs-review', missing);
      input.setAttribute('aria-invalid', String(missing));
      row.querySelector('[data-minutes-error]').textContent = missing
        ? copy(
            'กรุณาตรวจสอบจำนวนนาทีบนฉลาก',
            'Check the number of minutes on the label'
          )
        : '';
    });
    const preview = M.medication.preview(
      draft,
      M.store.readMealTimes(),
      M.reminder
    );
    [
      ['name', 'name'],
      ['dose', 'pills']
    ].forEach(([field, key]) => {
      const invalid = Boolean(preview.errors[key]);
      form.elements[field].setAttribute('aria-invalid', String(invalid));
      if (invalid) form.elements[field].classList.add('needs-review');
    });
    form.querySelectorAll('.fr02-timing').forEach((row, index) => {
      row.querySelectorAll('[data-timing]').forEach((input) => {
        const invalid = Boolean(
          preview.errors[`timing.${index}.${input.dataset.timing}`]
        );
        input.setAttribute('aria-invalid', String(invalid));
        if (invalid) input.classList.add('needs-review');
      });
    });
    form.elements.time.value = preview.reminders[0]?.time || '';
    form.elements.instruction.value = draft.timings[0]?.type || '';
    const lines = preview.reminders
      .map(
        (entry) =>
          `<li>${esc(M.labelForm.timingText(entry.timing))} → <strong>${esc(entry.time)}</strong>${entry.timing.pills ? ` · ${entry.pills} ${copy('เม็ด', 'pills')}` : ''}</li>`
      )
      .join('');
    form.querySelector('#medicine-live-preview').innerHTML = lines
      ? `<ul>${lines}</ul>`
      : copy(
          'กรุณากรอกข้อมูลให้ครบเพื่อดูเวลาเตือน',
          'Complete the required fields to preview reminders'
        );
    form.querySelector('#medicine-final-preview').innerHTML =
      `<h3>${esc(draft.name)}</h3>${form.querySelector('#medicine-live-preview').innerHTML}`;
    form
      .querySelector('#medicine-final-preview')
      .insertAdjacentHTML('afterbegin', asset('bell'));
    form.querySelector('#medicine-validation').textContent = Object.values(
      preview.errors
    ).join(' · ');
    const ready =
      preview.ok &&
      !M.store.readMealTimes().isDefault &&
      !scanning() &&
      allowed();
    form.querySelector('#medicine-next').disabled = !ready;
    form.querySelector('#medicine-save').disabled = !ready;
    form.querySelector('#medicine-save').hidden = step !== 'preview';
    form.querySelector('#medicine-next').hidden = step !== 'draft';
    form.querySelector('#meal-save').hidden = step !== 'meal';
    form.querySelector('#medicine-back').hidden = step !== 'preview';
  }

  function open(id) {
    if (!allowed()) return;
    returnFocus = document.activeElement;
    editId = null;
    legacyIndex = undefined;
    unsupported = null;
    form.reset();
    form.querySelector('#medicine-save-error').textContent = '';
    form.querySelector('#meal-error').textContent = '';
    flowResetPhoto();
    const group = id && groups()?.find((item) => item.key === id);
    if (group) {
      const row = group.rows[0];
      editId = group.legacyIndex === undefined ? group.key : null;
      legacyIndex = group.legacyIndex;
      form.elements.name.value = row.name;
      form.elements.dose.value =
        row.pills ||
        /^\s*(\d+)\s*(?:เม็ด|แคปซูล)?\s*$/.exec(row.dose)?.[1] ||
        '';
      form.elements.caution.value = row.caution || '';
      form.elements.contraindication.value = row.contraindication || '';
      // ข้อมูลเก่าที่มีเพียงเวลา ห้ามเดาว่าเป็นมื้อใด ให้ผู้ดูแลเลือกจากฉลากใหม่
      setTimings(group.rows.map((item) => item.timing || {}));
    } else setTimings([]);
    document.getElementById('modal-backdrop').hidden = false;
    loadMealTimes();
    returnToDraft = true;
    showStep(M.store.readMealTimes().isDefault ? 'meal' : 'draft');
  }
  function close() {
    document.getElementById('modal-backdrop').hidden = true;
    flowResetPhoto();
    unsupported = null;
    returnFocus?.focus();
  }
  function loadMealTimes() {
    const times = M.store.readMealTimes();
    Object.keys(labels).forEach((key) => {
      form.elements[`meal-${key}`].value = times[key];
    });
    form.querySelector('#meal-default-notice').hidden = !times.isDefault;
  }
  function openMeals() {
    open();
    returnToDraft = false;
    showStep('meal');
  }
  function saveMeals() {
    if (!allowed()) return;
    const times = {};
    Object.keys(labels).forEach((key) => {
      times[key] = form.elements[`meal-${key}`].value;
    });
    const result = M.store.saveMealTimes(times);
    form.querySelector('#meal-error').textContent = result.ok
      ? ''
      : copy(
          'กรุณาตรวจเวลาทั้ง 4 ช่อง หรือพื้นที่จัดเก็บ แล้วลองใหม่',
          'Check all four times and browser storage, then retry'
        );
    if (result.ok) {
      document.dispatchEvent(new CustomEvent('medmind:meal-times-changed'));
      if (returnToDraft) showStep('draft');
      else {
        close();
        notify(copy('บันทึกเวลามื้อแล้ว', 'Meal times saved'));
      }
    }
  }
  function submit(event) {
    event.preventDefault();
    if (
      !allowed() ||
      scanning() ||
      step !== 'preview' ||
      M.store.readMealTimes().isDefault
    )
      return;
    const result = M.medication.saveMedication(
      readDraft(),
      M.store,
      M.reminder,
      { id: editId || root.crypto.randomUUID(), legacyIndex, reviewed: true }
    );
    if (!result.ok) {
      form.querySelector('#medicine-save-error').textContent = Object.values(
        result.errors
      ).join(' · ');
      refresh();
      return;
    }
    close();
    document.dispatchEvent(
      new CustomEvent('medmind:medicines-changed', {
        detail: result.medicines
      })
    );
    notify(copy('บันทึกรายการยาแล้ว', 'Medicine saved'));
  }

  /** ต่อสัญญาฟอร์มเก่าในส่วนของเรา: scan.js/labelForm.js ของเพื่อนคงเดิม */
  function connectScanner() {
    const toForm = M.labelForm.toForm;
    M.labelForm.toForm = function (draft, meals, reminder) {
      const result = toForm(draft, meals, reminder);
      unsupported = draft.unsupported || null;
      setTimings(Array.isArray(draft.timings) ? draft.timings : []);
      result.fields.dose =
        Number.isInteger(draft.pills) && draft.pills > 0
          ? String(draft.pills)
          : '';
      result.fields.instruction = draft.timings?.[0]?.type || '';
      result.fields.caution = draft.caution || '';
      result.fields.contraindication = draft.contraindication || '';
      // scanner เดิมแสดงข้อความว่าบันทึกทีละมื้อเมื่อ array ยาว >1; ฟอร์มใหม่รับครบทุกมื้อแล้ว
      result.timings = result.timings.length
        ? [result.timings.join(' · ')]
        : [];
      form.querySelectorAll('.fr02-timing').forEach((row, index) => {
        if (!draft.timings?.[index]?.type)
          row
            .querySelector('[data-timing="type"]')
            .classList.add('needs-review');
        if (
          draft.timings?.[index]?.type !== 'bedtime' &&
          !draft.timings?.[index]?.slot
        )
          row
            .querySelector('[data-timing="slot"]')
            .classList.add('needs-review');
      });
      queueMicrotask(refresh);
      return result;
    };
  }

  function setup() {
    form = document.getElementById('medicine-form');
    if (!form) return;
    copy('มื้อเช้า', 'Morning');
    copy('มื้อกลางวัน', 'Noon');
    copy('มื้อเย็น', 'Evening');
    copy('เข้านอน', 'Bedtime');
    copy('ผู้ดูแล · Covers: FR-02', 'Caregiver · Covers: FR-02');
    document
      .querySelector('#modal-backdrop .modal')
      .classList.add('fr02-dialog');
    const title = document.getElementById('modal-title');
    title.removeAttribute('data-copy');
    form.noValidate = true;
    const photo = form.querySelector('.photo-capture-block');
    form.innerHTML = `<div class="fr02-scroll"><section id="medicine-meal"><p>${copy('กำหนดเวลามื้อเช้า กลางวัน เย็น และเข้านอน', 'Set morning, noon, evening and bedtime')}</p><div class="fr02-card">${Object.keys(
      labels
    )
      .map(
        (key) =>
          `<label class="fr02-meal-row">${asset(key === 'bedtime' ? 'moon' : 'sun')}<span>${labels[key]}</span><input type="time" name="meal-${key}" aria-label="${labels[key]}"></label>`
      )
      .join(
        ''
      )}</div><p id="meal-default-notice" class="fr02-notice">${asset('clock')}${copy('กำลังแสดงเวลาตัวอย่างเริ่มต้น กรุณาตรวจและปรับให้ตรง', 'These are example times. Review and adjust them.')}</p><p>${copy('ระบบใช้เวลานี้ร่วมกับคำสั่งบนฉลากเพื่อตั้งเวลาเตือน', 'Reminders use these times with the instruction on the label.')}</p><p id="meal-error" class="fr02-error" role="alert"></p></section><section id="medicine-draft"><div class="fr02-stepper"><span>1 ${copy('ฉลาก', 'Label')}</span><strong>2 ${copy('ตรวจร่าง', 'Review')}</strong><span>3 ${copy('เวลา', 'Time')}</span></div><p class="fr02-notice">${asset('shield')}${copy('ร่าง · ยังไม่บันทึก ตรวจทุกช่องกับฉลากจริงก่อนบันทึก', 'Draft · Not saved. Check every field against the label.')}</p><div id="medicine-photo-slot"></div><div class="fr02-card"><label>${copy('ชื่อยา *', 'Medicine name *')}<input name="name" autocomplete="off" required></label><label>${copy('จำนวนเม็ดต่อครั้ง *', 'Whole pills per dose *')}<input name="dose" inputmode="numeric" autocomplete="off" required></label><div id="medicine-timings"></div><button class="secondary-button" type="button" id="medicine-add-timing">${copy('เพิ่มมื้อ', 'Add a timing')}</button><label>${copy('ข้อควรระวัง', 'Caution')}<textarea name="caution" rows="3"></textarea></label><label>${copy('ข้อห้ามใช้', 'Contraindication')}<textarea name="contraindication" rows="3"></textarea></label><input name="time" type="hidden"><input name="instruction" type="hidden"></div><button class="secondary-button" type="button" id="medicine-change-meals">${copy('ปรับเวลามื้อ', 'Change meal times')}</button><div id="medicine-live-preview" class="fr02-preview" role="status" aria-live="polite"></div><p id="medicine-validation" class="fr02-error" role="status"></p></section><section id="medicine-preview"><p>${copy('ตั้งตามมื้อและคำสั่งบนฉลาก', 'Calculated from meal times and label instructions')}</p><div class="fr02-stepper"><span>${asset('check-step')} ${copy('ฉลาก', 'Label')}</span><span>${asset('check-step')} ${copy('ตรวจร่าง', 'Review')}</span><strong>3 ${copy('เวลา', 'Time')}</strong></div><div id="medicine-final-preview" class="fr02-preview" tabindex="-1"></div><p>${copy('ข้อมูลจะถูกบันทึกเมื่อกด “บันทึกยา” เท่านั้น', 'Nothing is saved until you press “Save medicine”.')}</p><p id="medicine-save-error" class="fr02-error" role="alert"></p></section></div><footer class="fr02-footer"><button class="primary-button" id="meal-save" type="button">${asset('check')} ${copy('บันทึกเวลามื้อ', 'Save meal times')}</button><button class="primary-button" id="medicine-next" type="button">${asset('next')} ${copy('ถัดไป: ตรวจเวลา', 'Next: review times')}</button><button class="primary-button" id="medicine-save" type="submit">${asset('check')} ${copy('บันทึกยา', 'Save medicine')}</button><button class="secondary-button" id="medicine-back" type="button">${asset('back-time')} ${copy('กลับไปตรวจร่าง', 'Back to review')}</button><button class="secondary-button" id="medicine-cancel" type="button">${asset('close')} ${copy('ยกเลิก', 'Cancel')}</button></footer>`;
    form.querySelector('#medicine-photo-slot').append(photo);
    form.querySelector('.fr02-scroll').prepend(title);
    const back = document.getElementById('close-modal');
    back.innerHTML = `${asset('back')} ${copy('กลับ', 'Back')}`;
    back.className = 'fr02-back-button';
    back.setAttribute(
      'aria-label',
      copy('กลับโดยไม่บันทึกยา', 'Back without saving medicine')
    );
    const role = document.createElement('span');
    role.className = 'fr02-role-badge';
    role.textContent = `${copy('ผู้ดูแล', 'Caregiver')} · Covers: FR-02`;
    document
      .querySelector('.fr02-dialog .modal-header')
      .replaceChildren(back, role);
    const draftPill = document.createElement('p');
    draftPill.className = 'fr02-draft-pill';
    draftPill.innerHTML = `${asset('pencil')} ${copy('ร่าง · ยังไม่บันทึก', 'Draft · Not saved')}`;
    form.querySelector('#medicine-draft .fr02-stepper').after(draftPill);
    document.querySelector('#capture-medicine-photo .icon')?.replaceWith(
      Object.assign(document.createElement('img'), {
        src: 'assets/fr02/camera.svg',
        alt: '',
        className: 'fr02-icon'
      })
    );
    setTimings([]);
    connectScanner();
    form.addEventListener('submit', submit);
    form.addEventListener('input', (event) => {
      event.target.classList.remove('needs-review');
      if (event.target.name === 'dose')
        form.querySelectorAll('[data-timing="pills"]').forEach((input) => {
          input.value = event.target.value;
        });
      refresh();
    });
    document.addEventListener('input', (event) => {
      if (event.target.id !== 'medicine-search') return;
      const empty = document.getElementById('medicine-empty-search');
      if (empty)
        empty.hidden =
          !event.target.value ||
          [...document.querySelectorAll('.medicine-item')].some(
            (item) => !item.hidden
          );
    });
    // Capture ทำก่อน scanner เติมร่างใหม่ ป้องกันฉลากเก่าค้างเมื่ออ่านฉลากใหม่ไม่ได้
    form.addEventListener(
      'change',
      (event) => {
        if (
          (event.target.id === 'medicine-photo-input' &&
            event.target.files?.length) ||
          event.target.classList.contains('scan-sample')
        ) {
          unsupported = null;
          form.elements.name.value = '';
          form.elements.dose.value = '';
          form.elements.caution.value = '';
          form.elements.contraindication.value = '';
          setTimings([]);
        }
        refresh();
      },
      true
    );
    form.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.id === 'meal-save') saveMeals();
      if (button.id === 'medicine-next') showStep('preview');
      if (button.id === 'medicine-back') showStep('draft');
      if (button.id === 'medicine-cancel') close();
      if (button.id === 'medicine-change-meals') {
        returnToDraft = true;
        loadMealTimes();
        showStep('meal');
      }
      if (button.id === 'medicine-add-timing') {
        timingRow();
        refresh();
      }
      if (button.hasAttribute('data-remove-timing')) {
        button.closest('fieldset').remove();
        refresh();
      }
    });
    // Progress ของ scanner เป็นสัญญา DOM เดิม; ไม่อนุญาตบันทึกระหว่างอ่านภาพ
    new MutationObserver((mutations) => {
      if (
        mutations.some((item) =>
          item.target.classList?.contains('scan-progress')
        )
      )
        refresh();
    }).observe(form, {
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden']
    });
    document.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button || !allowed()) return;
      if (button.id === 'meal-times-button') openMeals();
      if (button.dataset.medEdit) open(button.dataset.medEdit);
      if (button.dataset.medDelete) {
        const group = groups()?.find(
          (item) => item.key === button.dataset.medDelete
        );
        if (
          !group ||
          !root.confirm(
            copy(
              'ลบยานี้และทุกมื้อของยานี้?',
              'Delete this medicine and all its timings?'
            )
          )
        )
          return;
        const result = M.medication.deleteMedication(group.key, M.store, {
          legacyIndex: group.legacyIndex
        });
        if (result.ok)
          document.dispatchEvent(
            new CustomEvent('medmind:medicines-changed', {
              detail: result.medicines
            })
          );
        else notify(Object.values(result.errors).join(' · '));
      }
    });
    document.addEventListener('keydown', (event) => {
      if (
        event.key !== 'Tab' ||
        document.getElementById('modal-backdrop').hidden
      )
        return;
      const focusable = [
        ...document.querySelectorAll(
          '.fr02-dialog button, .fr02-dialog input, .fr02-dialog select, .fr02-dialog textarea'
        )
      ].filter((el) => !el.disabled && el.offsetParent && el.type !== 'hidden');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    });
  }
  // เปลี่ยนภาษาโดยคง input, scanner panel และ event listeners เดิมทั้งหมด
  function setupLanguage() {
    rememberLabels(document.querySelector('.fr02-dialog'));
    new MutationObserver(() => {
      translatedNodes.forEach((entry, node) => {
        if (!node.isConnected) {
          translatedNodes.delete(node);
          return;
        }
        node.nodeValue =
          entry.before + copy(entry.message.th, entry.message.en) + entry.after;
      });
      if (!document.getElementById('modal-backdrop').hidden) showStep(step);
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang']
    });
  }
  M.medicine = { page, open, close };
  if (document.readyState === 'loading')
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        setup();
        setupLanguage();
      },
      { once: true }
    );
  else {
    setup();
    setupLanguage();
  }
})(self);
