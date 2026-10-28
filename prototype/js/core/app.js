/*
 * app.js — โครงหน้า เมนู ภาษา ธีม และตารางเดิมที่จัดรูปแบบใหม่ (Issue #46)
 * Covers: FR-01–05 · NFR-03 · ผู้รับผิดชอบ: Rossatorn / IDK-SleepyBro
 * ตรรกะเดิมคงไว้ การจับคู่และภาพฉลากแยกไปที่ js/features/
 */
/* global flowText, pairingPage */
const translations = {
  th: {
    tagline: 'ดูแลมื้อยาอย่างอุ่นใจ',
    menu: 'เมนู',
    account: 'บัญชีของฉัน',
    settings: 'ตั้งค่า',
    needHelp: 'ต้องการความช่วยเหลือ?',
    helpText: 'ติดต่อผู้ดูแลได้ทันที',
    seeCaregiver: 'ดูผู้ดูแล',
    patientName: 'คุณสมพร',
    patientRole: 'ผู้ใช้และเจ้าของบัญชี',
    safeCare: 'พื้นที่ดูแลของฉัน',
    today: 'ภาพรวมวันนี้',
    caregiverHome: 'ภาพรวมผู้ดูแล',
    caregiverWelcome: 'สวัสดีค่ะ คุณมินตรา',
    caregiverIntro: 'ติดตามมื้อยาของคุณสมพรได้จากหน้านี้',
    patientOverview: 'ภาพรวมของคุณสมพร',
    todayStatus: 'สถานะมื้อยาวันนี้',
    medication: 'ยาและตารางยา',
    caregiver: 'ผู้ดูแลของฉัน',
    history: 'ประวัติการกินยา',
    titleToday: 'สวัสดีค่ะ คุณสมพร 👋',
    helloSub: 'วันนี้เรามาดูแลมื้อยาไปด้วยกันนะคะ',
    takenToday: 'กินยาแล้ววันนี้',
    nextDose: 'มื้อถัดไป',
    caregiverLabel: 'ผู้ดูแลของคุณ',
    daughter: 'ลูกสาว: มินตรา',
    available: 'พร้อมช่วยเหลือคุณเสมอ',
    call: 'โทร',
    todayMeds: 'มื้อยาของวันนี้',
    seeSchedule: 'ดูตารางทั้งหมด',
    nextAt: 'มื้อถัดไป · 12:30',
    lunch: 'ยาหลังอาหารกลางวัน',
    metformin: 'Metformin 500 mg · 1 เม็ด',
    afterFood: 'รับประทานหลังอาหารทันที',
    reminderOn: 'ตั้งเตือนแล้ว · เสียงแจ้งเตือนเปิดอยู่',
    lastTaken: 'เช้านี้กินยาแล้ว 08:00',
    confirmTaken: 'ยืนยันว่ากินยาแล้ว',
    todayList: 'รายการวันนี้',
    time: 'เวลา',
    medName: 'ชื่อยา',
    status: 'สถานะ',
    done: 'กินแล้ว',
    waiting: 'รอถึงเวลา',
    later: 'ช่วงเย็น',
    adherence: 'สรุปการดูแล',
    lastSeven: 'ความสม่ำเสมอใน 7 วันที่ผ่านมา',
    onTime: 'ตรงเวลา',
    recorded: 'มื้อที่บันทึก',
    fromLast: 'ดีขึ้นจากสัปดาห์ก่อน',
    healthReport: 'ดูรายงานสุขภาพ',
    tip: 'เคล็ดลับวันนี้',
    tipTitle: 'จัดยาไว้ในที่ที่มองเห็นง่าย',
    tipSub: 'ช่วยให้ไม่พลาดมื้อสำคัญ',
    readMore: 'อ่านคำแนะนำเพิ่มเติม',
    medsTitle: 'ยาและตารางยา',
    medsSub: 'ดูแลรายการยาและเวลาให้เป็นระเบียบในที่เดียว',
    addMed: 'เพิ่มรายการยา',
    addMedAction: 'เพิ่มยา',
    activeMeds: 'รายการยาของคุณสมพร',
    updated: 'ยาที่ใช้อยู่',
    todayLeft: 'มื้อวันนี้ที่เหลือ',
    search: 'ค้นหารายการยา',
    instruction: 'คำแนะนำ',
    dose: 'ขนาดยา',
    careTitle: 'ผู้ดูแลของคุณ',
    careSub: 'มีคนในครอบครัวคอยดูแลและช่วยติดตามมื้อยา',
    daughterName: 'มินตรา ใจดี',
    daughterRole: 'ลูกสาว · ผู้ดูแลหลัก',
    contact: 'ติดต่อผู้ดูแล',
    historyTitle: 'ประวัติและรายงาน',
    historySub: 'ติดตามการดูแลสุขภาพของคุณในช่วงที่ผ่านมา',
    thisWeek: 'สัปดาห์นี้',
    adherenceRate: 'อัตราการกินยาตรงเวลา',
    weeklyHistory: 'ประวัติการกินยา',
    settingsTitle: 'ตั้งค่าการใช้งาน',
    settingsSub: 'ปรับแอปให้เหมาะกับการมองเห็นและความถนัดของคุณ',
    language: 'ภาษา',
    languageHint: 'เลือกภาษาที่ต้องการใช้',
    theme: 'การแสดงผล',
    themeHint: 'เลือกโหมดสว่างหรือโหมดมืด',
    textSize: 'ขนาดตัวอักษร',
    textHint: 'เลือกขนาดที่อ่านสบายตา',
    reminders: 'เสียงแจ้งเตือน',
    reminderHint: 'เปิดเสียงเตือนเมื่อถึงเวลากินยา',
    light: 'สว่าง',
    dark: 'มืด',
    small: 'เล็ก',
    normal: 'ปกติ',
    large: 'ใหญ่',
    saveMed: 'บันทึกรายการยา',
    medSaved: 'เพิ่มรายการยาแล้ว',
    doseSaved: 'บันทึกมื้อยานี้แล้วค่ะ',
    noMeds: 'ยังไม่มีรายการยาที่ค้นหา',
    caregiverPrompt: 'หากต้องการความช่วยเหลือ กดโทรหาผู้ดูแลได้เลย',
    chartTitle: 'ความสม่ำเสมอรายวัน',
    todayShort: 'วันนี้',
    mon: 'จ.',
    tue: 'อ.',
    wed: 'พ.',
    thu: 'พฤ.',
    fri: 'ศ.',
    sat: 'ส.',
    sun: 'อา.',
    recent: 'รายการล่าสุด',
    yesterday: 'เมื่อวาน',
    dateToday: 'วันนี้',
    before: 'ก่อนอาหาร',
    after: 'หลังอาหาร',
    asDirected: 'ตามแพทย์สั่ง',
    saved: 'บันทึกแล้ว',
    cancel: 'ยกเลิก',
    close: 'ปิด',
    searchPlaceholder: 'ค้นหาชื่อยา',
    patient: 'ผู้รับยา',
    prescriptions: 'ยาและสุขภาพ',
    menuToday: 'วันนี้',
    doseCount: 'จาก 4 มื้อ',
    inMinutes: 'อีก 45 นาที',
    switchOn: 'เปิด',
    switchOff: 'ปิด'
  },
  en: {
    tagline: 'A calmer way to take medicine',
    menu: 'MENU',
    account: 'MY ACCOUNT',
    settings: 'Settings',
    needHelp: 'Need a hand?',
    helpText: 'Your caregiver is one tap away',
    seeCaregiver: 'View caregiver',
    patientName: 'Somphon',
    patientRole: 'Patient account',
    safeCare: 'My care space',
    today: 'Today',
    caregiverHome: 'Caregiver overview',
    caregiverWelcome: 'Hello, Mintra',
    caregiverIntro: 'Keep track of Somphon’s medicine routine from here.',
    patientOverview: 'Somphon’s overview',
    todayStatus: 'Today’s medicine status',
    medication: 'Medicines',
    caregiver: 'Caregiver',
    history: 'History',
    titleToday: 'Good morning, Somphon 👋',
    helloSub: 'Let’s take today’s medicines one step at a time.',
    takenToday: 'Taken today',
    nextDose: 'Next dose',
    caregiverLabel: 'Your caregiver',
    daughter: 'Daughter: Mintra',
    available: 'Here whenever you need help',
    call: 'Call',
    todayMeds: 'Today’s medicines',
    seeSchedule: 'Full schedule',
    nextAt: 'NEXT DOSE · 12:30',
    lunch: 'After-lunch medicine',
    metformin: 'Metformin 500 mg · 1 tablet',
    afterFood: 'Take right after a meal',
    reminderOn: 'Reminder is set · Sound is on',
    lastTaken: 'Morning dose taken · 08:00',
    confirmTaken: 'I have taken this',
    todayList: 'Today’s schedule',
    time: 'Time',
    medName: 'Medicine',
    status: 'Status',
    done: 'Taken',
    waiting: 'Upcoming',
    later: 'Later today',
    adherence: 'Care summary',
    lastSeven: 'On-time doses over the last 7 days',
    onTime: 'On time',
    recorded: 'Doses recorded',
    fromLast: 'Up from last week',
    healthReport: 'View health report',
    tip: 'Today’s tip',
    tipTitle: 'Keep medicines where you can see them',
    tipSub: 'It can help you remember each dose.',
    readMore: 'More helpful tips',
    medsTitle: 'Medicines and schedule',
    medsSub: 'Keep medicine names and times together in one place.',
    addMed: 'Add medicine',
    addMedAction: 'Add medicine',
    activeMeds: 'Somphon’s medicines',
    updated: 'Active medicines',
    todayLeft: 'Doses left today',
    search: 'Search medicines',
    instruction: 'Instructions',
    dose: 'Dose',
    careTitle: 'Your caregiver',
    careSub: 'A family member can help you keep track of each dose.',
    daughterName: 'Mintra Jaidee',
    daughterRole: 'Daughter · Main caregiver',
    contact: 'Contact caregiver',
    historyTitle: 'History and reports',
    historySub: 'See how your medicine routine has been going.',
    thisWeek: 'This week',
    adherenceRate: 'On-time dose rate',
    weeklyHistory: 'Dose history',
    settingsTitle: 'Preferences',
    settingsSub: 'Make MedMind easier to see and comfortable to use.',
    language: 'Language',
    languageHint: 'Choose the language you prefer',
    theme: 'Appearance',
    themeHint: 'Choose light or dark mode',
    textSize: 'Text size',
    textHint: 'Choose a comfortable reading size',
    reminders: 'Sound reminders',
    reminderHint: 'Play a sound when it is time for a dose',
    light: 'Light',
    dark: 'Dark',
    small: 'Small',
    normal: 'Normal',
    large: 'Large',
    saveMed: 'Save medicine',
    medSaved: 'Medicine added',
    doseSaved: 'Dose recorded.',
    noMeds: 'No matching medicines found',
    caregiverPrompt: 'For help, call your caregiver at any time.',
    chartTitle: 'On-time doses by day',
    todayShort: 'Today',
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun',
    recent: 'Recent doses',
    yesterday: 'Yesterday',
    dateToday: 'Today',
    before: 'Before food',
    after: 'After food',
    asDirected: 'As prescribed',
    saved: 'Saved',
    cancel: 'Cancel',
    close: 'Close',
    searchPlaceholder: 'Search medicine name',
    patient: 'Patient',
    prescriptions: 'Medicines & care',
    menuToday: 'Today',
    doseCount: 'of 4 doses',
    inMinutes: 'in 45 min',
    switchOn: 'On',
    switchOff: 'Off'
  }
};
const caregiverMode = document.body.dataset.role === 'caregiver';
const storage = {
  read(key, fallback = null) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // คงพฤติกรรมเดิม: ใช้งานต่อได้เมื่อเบราว์เซอร์บันทึกข้อมูลไม่ได้
    }
  },
  readJSON(key, fallback) {
    const raw = this.read(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
};
const savedLanguage = storage.read('medmind-lang');
const savedTheme = storage.read('medmind-theme');
const savedSize = storage.read('medmind-size');
const initialPairing = storage.readJSON('medmind-pairing', null);
const state = {
  page: caregiverMode
    ? initialPairing?.paired
      ? 'caregiverHome'
      : 'pairing'
    : initialPairing?.paired
      ? 'today'
      : 'pairing',
  lang: savedLanguage === 'en' ? 'en' : 'th',
  theme: savedTheme === 'dark' ? 'dark' : 'light',
  size: ['small', 'large'].includes(savedSize) ? savedSize : 'normal',
  reminders: storage.read('medmind-reminders') !== 'off',
  taken: readTodayDoses(),
  takenDate: localDateKey(),
  medicines: caregiverMode && !initialPairing?.paired ? [] : readMedicines()
};
/** อ่านรายการยาจากที่เก็บเดิมและกรองข้อมูลที่ไม่ใช่รายการยา */
function readMedicines() {
  // FR-02 ไม่สร้างรายการยาจำลองเมื่อยังไม่เคยกดบันทึก
  const value = self.MedMind.store.readJSON(
    self.MedMind.store.KEYS.medicines,
    []
  );
  const rows = Array.isArray(value)
    ? value.filter((item) => item && typeof item.name === 'string')
    : [];
  return self.MedMind.medication.resolveTimes(
    rows,
    self.MedMind.store.readMealTimes(),
    self.MedMind.reminder
  );
}
/** ตรวจสิทธิ์เข้าหน้าผู้ดูแลจากสถานะจับคู่เดิม */
function caregiverIsPaired() {
  return (
    !caregiverMode || storage.readJSON('medmind-pairing', null)?.paired === true
  );
}
const navItems = caregiverMode
  ? [
      ['caregiverHome', 'i-home'],
      ['pairing', 'i-user'],
      ['medication', 'i-pill'],
      ['history', 'i-chart']
    ]
  : [
      ['pairing', 'i-user'],
      ['today', 'i-home'],
      ['medication', 'i-pill'],
      ['caregiver', 'i-user'],
      ['history', 'i-chart']
    ];
const t = (key) => translations[state.lang][key] || key;
const icon = (id, cls = 'icon') =>
  `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
/** เลือกข้อความเมนูตามภาษาและหน้าที่แสดง */
function navLabel(key) {
  return key === 'pairing' ? flowText('nav') : t(key);
}
/** วาดเมนูด้านข้างและเมนูมือถือให้ตรงกับบทบาท */
function renderNav() {
  const visibleNav =
    caregiverMode && !caregiverIsPaired()
      ? navItems.filter(([key]) => key === 'pairing')
      : navItems;
  const markup = visibleNav
    .map(
      ([key, ico]) =>
        `<button class="nav-link ${state.page === key ? 'active' : ''}" data-page="${key}" ${state.page === key ? 'aria-current="page"' : ''}>${icon(ico)}<span>${navLabel(key)}</span></button>`
    )
    .join('');
  document.getElementById('side-nav').innerHTML = markup;
  const shortLabel = {
    pairing: flowText('nav'),
    today: state.lang === 'th' ? 'วันนี้' : 'Today',
    caregiverHome: state.lang === 'th' ? 'ผู้ดูแล' : 'Care',
    medication: state.lang === 'th' ? 'ยา' : 'Meds',
    history: state.lang === 'th' ? 'ประวัติ' : 'History'
  };
  document.getElementById('bottom-nav').innerHTML =
    visibleNav
      .filter(([key]) => key !== 'caregiver')
      .map(
        ([key, ico]) =>
          `<button class="nav-link ${state.page === key ? 'active' : ''}" data-page="${key}" ${state.page === key ? 'aria-current="page"' : ''}>${icon(ico)}<span>${shortLabel[key] || navLabel(key)}</span></button>`
      )
      .join('') +
    `<button class="nav-link ${state.page === 'settings' ? 'active' : ''}" data-page="settings">${icon('settings')}<span>${state.lang === 'th' ? 'ตั้งค่า' : 'Settings'}</span></button>`;
}
/** อัปเดตภาษา ธีม ขนาดอักษร วันที่ และข้อมูลบนโครงหน้า */
function renderShell() {
  document.documentElement.lang = state.lang;
  document.body.dataset.theme = state.theme === 'dark' ? 'dark' : 'light';
  document.body.dataset.size = state.size;
  document.getElementById('language-toggle').innerHTML =
    `<span>${state.lang.toUpperCase()}</span><span class="language-chevron">⌄</span>`;
  document.getElementById('theme-toggle').innerHTML = icon(
    state.theme === 'dark' ? 'sun' : 'moon'
  );
  document.getElementById('theme-toggle').title =
    state.theme === 'dark' ? t('light') : t('dark');
  document.getElementById('reminder-toggle').style.opacity = state.reminders
    ? '1'
    : '.48';
  document.getElementById('today-date').textContent = new Intl.DateTimeFormat(
    state.lang === 'th' ? 'th-TH' : 'en-US',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  ).format(new Date());
  document.getElementById('mobile-context').textContent =
    state.lang === 'th'
      ? 'วัน' +
        new Intl.DateTimeFormat('th-TH', {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        }).format(new Date())
      : new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        }).format(new Date());
  document
    .querySelectorAll('[data-copy]')
    .forEach((el) => (el.textContent = t(el.dataset.copy)));
  if (caregiverMode) {
    document.querySelector('.profile-mini .avatar').textContent = 'ม';
    document.querySelector('.profile-mini strong').textContent =
      t('daughterName');
    document.querySelector('.profile-mini small').textContent =
      t('daughterRole');
    document.querySelector('.avatar-button').textContent = 'ม';
    document.querySelector('.avatar-button').dataset.page = 'settings';
  }
  renderNav();
}
/** สร้างหัวหน้าจอพร้อมป้าย FR ที่เกี่ยวข้อง */
function heading(title, sub, action = '') {
  const coverage = {
    pairing: flowText('covers1'),
    today: 'Covers: FR-03–05',
    caregiverHome: 'Covers: FR-05',
    medication: flowText('covers2'),
    caregiver: 'Covers: FR-01',
    history: 'Covers: FR-05',
    settings: 'Covers: NFR-03'
  };
  return `<div class="page-heading"><div class="heading-copy"><span class="eyebrow">${t('safeCare')}\u3000/\u3000${title}</span><span class="fr-badge">${coverage[state.page] || 'MedMind'}</span><h1>${title}</h1><p>${sub}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ''}</div>`;
}
/** สร้างวันที่ท้องถิ่นเพื่อแยกบันทึกการกินยาแต่ละวัน */
function localDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** อ่านเฉพาะเวลามื้อที่ยืนยันในวันนี้ */
function readTodayDoses() {
  const value = storage.readJSON('medmind-taken', null);
  return value && value.date === localDateKey() && Array.isArray(value.times)
    ? value.times.filter((item) => typeof item === 'string')
    : [];
}
/** เริ่มสถานะมื้อใหม่เมื่อเปลี่ยนวันโดยคงวิธีบันทึกเดิม */
function resetDailyDoseState() {
  const today = localDateKey();
  if (state.takenDate !== today) {
    state.taken = [];
    state.takenDate = today;
    storage.write('medmind-taken', JSON.stringify({ date: today, times: [] }));
  }
}
/** รวมยาที่เวลาเดียวกันไว้เป็นหนึ่งมื้อและเรียงตามเวลา */
function scheduleGroups() {
  const groups = new Map();
  state.medicines.forEach((m) => {
    const time = String(m.time || '').trim();
    if (!time) return;
    if (!groups.has(time)) groups.set(time, { time, items: [] });
    groups.get(time).items.push(m);
  });
  return [...groups.values()].sort((a, b) => a.time.localeCompare(b.time));
}
/** นับมื้อที่ยืนยันแล้วจากตารางของวันนี้ */
function doseCountTaken() {
  return scheduleGroups().filter((group) => state.taken.includes(group.time))
    .length;
}
/** หามื้อที่ยังไม่ยืนยันและใกล้เวลาปัจจุบันที่สุด */
function nextDoseGroup() {
  const groups = scheduleGroups().filter(
    (group) => !state.taken.includes(group.time)
  );
  const now = new Date();
  const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return groups.find((group) => group.time >= current) || groups[0] || null;
}
/** บันทึกการยืนยันมื้อโดยไม่เพิ่มเวลาเดิมซ้ำ */
function markDoseTaken(time) {
  if (time && !state.taken.includes(time)) state.taken.push(time);
  state.takenDate = localDateKey();
  storage.write(
    'medmind-taken',
    JSON.stringify({ date: state.takenDate, times: state.taken })
  );
}
/** สร้างการ์ดมื้อถัดไปและปุ่มตามบทบาท */
function doseCard(next, id) {
  if (!next)
    return `<article class="dose-card"><h3 class="dose-title">${state.medicines.length ? flowText('allDone') : flowText('noSchedule')}</h3><p class="dose-subtitle">${flowText('reminderDemo')}</p></article>`;
  const names = next.items.map((m) => escapeHtml(m.name)).join(' · ');
  const details = next.items
    .map((m) => escapeHtml(m.dose || ''))
    .filter(Boolean)
    .join(' · ');
  const button =
    id === 'confirm-dose'
      ? `<button class="primary-button dose-confirm" id="confirm-dose" data-dose-time="${escapeHtml(next.time)}">${icon('check')} ${t('confirmTaken')}</button>`
      : `<button class="secondary-button" id="caregiver-send-reminder">${icon('bell')} ${flowText('sendReminder')}</button>`;
  return `<article class="dose-card"><div class="dose-head"><span class="pill-tag">${icon('clock')} ${t('nextDose')} · ${escapeHtml(next.time)}</span><span class="status-pill wait">${t('waiting')}</span></div><h3 class="dose-title">${names}</h3><div class="dose-subtitle">${details}</div><div class="instruction-row"><span class="instruction-icon">${icon('pill')}</span><span>${next.items.map((m) => t(m.instruction === 'before' ? 'before' : m.instruction === 'after' ? 'after' : 'asDirected')).join(' · ')}<br><small>${flowText('reminderDemo')}</small></span></div><div class="dose-foot"><span class="last-dose">${icon('clock')} ${escapeHtml(next.time)}</span>${button}</div></article>`;
}
/** แสดงจำนวนมื้อ ความคืบหน้า และข้อมูลผู้ดูแล */
function summaryMetrics() {
  const groups = scheduleGroups();
  const count = doseCountTaken();
  const progress = groups.length
    ? Math.min(100, (count / groups.length) * 100)
    : 0;
  const next = nextDoseGroup();
  return `<section class="metric-grid" aria-label="${t('todayMeds')}"><article class="metric-card"><span class="metric-icon">${icon('check')}</span><div class="metric-copy"><span class="metric-label">${t('takenToday')}</span><div class="metric-value"><span id="dose-count">${count}</span> <small>${flowText('of')} ${groups.length} ${flowText('doses')}</small></div><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div></div></article><article class="metric-card"><span class="metric-icon amber">${icon('clock')}</span><div class="metric-copy"><span class="metric-label">${t('nextDose')}</span><div class="metric-value">${next ? escapeHtml(next.time) : '—'}</div></div></article><article class="metric-card caregiver-metric"><span class="metric-icon lime">${icon('heart')}</span><div class="metric-copy"><span class="metric-label">${t('caregiverLabel')}</span><div class="metric-value"><small>${t('daughter')}</small></div></div></article></section>`;
}
/** สร้างแถวตารางยาพร้อมสถานะของแต่ละมื้อ */
function scheduleRows() {
  const groups = scheduleGroups();
  const next = nextDoseGroup();
  return (
    groups
      .map((group) => {
        const done = state.taken.includes(group.time);
        const status = done
          ? 'done'
          : next && next.time === group.time
            ? 'wait'
            : 'later';
        const label = group.items
          .map((m) => `${escapeHtml(m.name)} · ${escapeHtml(m.dose || '')}`)
          .join(' / ');
        return `<div class="schedule-row"><span class="schedule-time">${escapeHtml(group.time)}</span><span class="schedule-name">${label}</span><span class="status-pill ${status}">${done ? `${icon('check')}${t('done')}` : status === 'wait' ? t('waiting') : t('later')}</span></div>`;
      })
      .join('') ||
    `<div class="empty-state"><strong>${flowText('noSchedule')}</strong></div>`
  );
}
/** สร้างหน้าภาพรวมของผู้สูงอายุจากข้อมูลตารางเดิม */
function dashboard() {
  const next = nextDoseGroup();
  return `${heading(t('titleToday'), t('helloSub'))}${summaryMetrics()}<div class="dashboard-grid"><section><div class="section-title"><h2>${t('todayMeds')}</h2><button class="inline-link" data-page="medication">${t('seeSchedule')}${icon('arrow')}</button></div>${doseCard(next, 'confirm-dose')}<article class="schedule-card wide-panel"><div class="section-title"><h3>${t('todayList')}</h3><button class="inline-link" data-page="medication">${t('seeSchedule')}${icon('arrow')}</button></div><div class="schedule-list">${scheduleRows()}</div></article></section><aside class="column-stack"><article class="adherence-card"><h2>${t('adherence')}</h2><p class="muted-caption">${t('lastSeven')}</p><div class="adherence-body"><div class="ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="43" pathLength="100"/><circle class="value" cx="50" cy="50" r="43" pathLength="100"/></svg><div class="ring-copy"><strong>86%</strong><span>${t('onTime')}</span></div></div><div class="adherence-facts"><div><span>${t('recorded')}</span><strong>24 / 28</strong></div><div><span>${t('fromLast')}</span><strong class="trend">+ 8%</strong></div></div></div><hr class="panel-divider"><button class="inline-link" data-page="history">${t('healthReport')}${icon('arrow')}</button></article><article class="tip-card"><h3>${t('tip')}</h3><div class="tip-body"><span class="sparkle">✦</span><div><strong>${t('tipTitle')}</strong><span>${t('tipSub')}</span></div></div><button class="inline-link" data-page="caregiver">${t('readMore')}${icon('arrow')}</button></article></aside></div>`;
}
/** สร้างหน้ารายการยาและตารางสำหรับแต่ละบทบาท */
function medicinePage() {
  return self.MedMind.medicine.page({ heading, caregiver: caregiverMode });
}
/** สร้างหน้าภาพรวมที่ผู้ดูแลใช้ติดตามมื้อยา */
function caregiverDashboard() {
  const groups = scheduleGroups();
  const takenCount = doseCountTaken();
  const next = nextDoseGroup();
  return `${heading(t('caregiverWelcome'), t('caregiverIntro'))}<section class="metric-grid" aria-label="${t('patientOverview')}"><article class="metric-card"><span class="metric-icon">${icon('user')}</span><div class="metric-copy"><span class="metric-label">${t('patient')}</span><div class="metric-value"><small>${t('patientName')}</small></div></div></article><article class="metric-card"><span class="metric-icon amber">${icon('clock')}</span><div class="metric-copy"><span class="metric-label">${t('nextDose')}</span><div class="metric-value">${next ? escapeHtml(next.time) : '—'}</div></div></article><article class="metric-card"><span class="metric-icon lime">${icon('check')}</span><div class="metric-copy"><span class="metric-label">${t('todayStatus')}</span><div class="metric-value">${takenCount} <small>/ ${groups.length}</small></div><div class="progress-track"><div class="progress-fill" style="width:${groups.length ? Math.min(100, (takenCount / groups.length) * 100) : 0}%"></div></div></div></article></section><div class="dashboard-grid"><section><div class="section-title"><h2>${t('patientOverview')}</h2><button class="inline-link" data-page="medication">${t('seeSchedule')}${icon('arrow')}</button></div>${doseCard(next, 'caregiver-send-reminder')}<article class="schedule-card wide-panel"><div class="section-title"><h3>${t('todayList')}</h3><button class="inline-link" data-page="history">${t('healthReport')}${icon('arrow')}</button></div><div class="schedule-list">${scheduleRows()}</div></article></section><aside class="column-stack"><article class="adherence-card"><h2>${t('adherence')}</h2><p class="muted-caption">${t('lastSeven')}</p><div class="adherence-body"><div class="ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="43" pathLength="100"/><circle class="value" cx="50" cy="50" r="43" pathLength="100"/></svg><div class="ring-copy"><strong>86%</strong><span>${t('onTime')}</span></div></div><div class="adherence-facts"><div><span>${t('recorded')}</span><strong>24 / 28</strong></div><div><span>${t('fromLast')}</span><strong class="trend">+ 8%</strong></div></div></div><hr class="panel-divider"><button class="inline-link" data-page="history">${t('healthReport')}${icon('arrow')}</button></article><article class="tip-card"><h3>${t('tip')}</h3><div class="tip-body"><span class="sparkle">✦</span><div><strong>${t('tipTitle')}</strong><span>${t('tipSub')}</span></div></div></article></aside></div>`;
}
/** สร้างข้อมูลติดต่อและตัวเลือกของผู้ดูแล */
function caregiverPage() {
  return `${heading(t('careTitle'), t('careSub'))}<section class="caregiver-card"><span class="avatar">ม</span><div><h2>${t('daughterName')}</h2><p>${t('daughterRole')} · <span style="color:var(--accent)">● ${state.lang === 'th' ? 'พร้อมช่วยเหลือ' : 'Available'}</span></p></div><button class="secondary-button" id="call-caregiver">${icon('user')} ${t('call')}</button></section><section class="settings-grid wide-panel"><article class="panel"><span class="metric-icon">${icon('bell')}</span><h2>${t('reminders')}</h2><p class="muted-caption">${t('reminderHint')}</p><button class="secondary-button" id="care-reminder-toggle">${state.reminders ? t('switchOn') : t('switchOff')}</button></article><article class="panel"><span class="metric-icon lime">${icon('heart')}</span><h2>${t('caregiverLabel')}</h2><p class="muted-caption">${t('caregiverPrompt')}</p><button class="primary-button" id="call-caregiver-2">${icon('user')} ${t('contact')}</button></article></section>`;
}
/** แสดงหน้าประวัติและรายงานตัวอย่างเดิม */
function reportPage() {
  const bars = [
    ['mon', 66],
    ['tue', 90],
    ['wed', 76],
    ['thu', 100],
    ['fri', 73],
    ['sat', 91],
    ['sun', 86]
  ];
  return `${heading(t('historyTitle'), t('historySub'))}<article class="report-hero"><div><span class="eyebrow" style="color:#d1e2d6">${t('thisWeek')}</span><strong>86%</strong><p>${t('adherenceRate')}</p></div><div class="trend">↗ + 8%\u3000${t('fromLast')}</div></article><section class="panel wide-panel"><div class="section-title"><h2>${t('chartTitle')}</h2><span class="status-pill done">${t('thisWeek')}</span></div><div class="bar-chart">${bars.map(([day, height]) => `<div class="bar-group"><div class="bar" style="--bar:${height}%"></div><span>${t(day)}</span></div>`).join('')}</div></section><section class="panel wide-panel"><div class="section-title"><h2>${t('weeklyHistory')}</h2><button class="secondary-button">${t('thisWeek')}\u3000⌄</button></div><div class="history-list">${[
    ['12:30', 'ยาหลังอาหารกลางวัน · Metformin', true],
    ['08:00', 'ยาความดัน · Amlodipine', true],
    ['18:00', 'วิตามิน · Vitamin D3', true],
    ['12:30', 'ยาหลังอาหารกลางวัน · Metformin', true]
  ]
    .map(
      (r, i) =>
        `<div class="history-row"><span class="schedule-time">${i < 2 ? t('dateToday') : t('yesterday')}<br><small>${r[0]}</small></span><span class="schedule-name">${r[1]}</span><span class="status-pill done">${icon('check')} ${t('done')}</span></div>`
    )
    .join('')}</div></section>`;
}
/** สร้างตัวเลือกภาษา ธีม ขนาดอักษร และเสียงเตือน */
function settingsPage() {
  return `${heading(t('settingsTitle'), t('settingsSub'))}<section class="settings-grid"><article class="setting-card"><span class="metric-icon">TH</span><div class="setting-copy"><strong>${t('language')}</strong><span>${t('languageHint')}</span></div><div class="setting-controls"><button class="round-control" data-lang="th" aria-label="ภาษาไทย" aria-pressed="${state.lang === 'th'}">TH</button><button class="round-control" data-lang="en" aria-label="English" aria-pressed="${state.lang === 'en'}">EN</button></div></article><article class="setting-card"><span class="metric-icon amber">${icon(state.theme === 'dark' ? 'moon' : 'sun')}</span><div class="setting-copy"><strong>${t('theme')}</strong><span>${t('themeHint')}</span></div><div class="switch-control"><span class="switch-state">${state.theme === 'dark' ? t('dark') : t('light')}</span><button class="switch" id="settings-theme" role="switch" aria-checked="${state.theme === 'dark'}" aria-label="${t('theme')}: ${state.theme === 'dark' ? t('dark') : t('light')}"><span></span></button></div></article><article class="setting-card"><span class="metric-icon lime">Aa</span><div class="setting-copy"><strong>${t('textSize')}</strong><span>${t('textHint')}</span></div><div class="setting-controls"><button class="round-control" data-size="small" aria-label="${t('small')}" aria-pressed="${state.size === 'small'}">A−</button><button class="round-control" data-size="normal" aria-label="${t('normal')}" aria-pressed="${state.size === 'normal'}">A</button><button class="round-control" data-size="large" aria-label="${t('large')}" aria-pressed="${state.size === 'large'}">A+</button></div></article><article class="setting-card"><span class="metric-icon">${icon('bell')}</span><div class="setting-copy"><strong>${t('reminders')}</strong><span>${t('reminderHint')}</span></div><div class="switch-control"><span class="switch-state">${state.reminders ? t('switchOn') : t('switchOff')}</span><button class="switch" id="settings-reminders" role="switch" aria-checked="${state.reminders}" aria-label="${t('reminders')}: ${state.reminders ? t('switchOn') : t('switchOff')}"><span></span></button></div></article></section><section class="panel wide-panel"><div class="section-title"><h2>${t('needHelp')}</h2></div><p class="muted-caption">${t('caregiverPrompt')}</p><button class="primary-button" data-page="caregiver">${icon('user')} ${t('seeCaregiver')}</button></section>`;
}
/** ป้องกันข้อความที่กรอกกลายเป็น HTML ก่อนนำไปแสดง */
function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]
  );
}
/** วาดหน้าปัจจุบันและผูกปุ่มหลังสร้างเนื้อหา */
function render() {
  if (
    caregiverMode &&
    !caregiverIsPaired() &&
    !['pairing', 'settings'].includes(state.page)
  )
    state.page = 'pairing';
  resetDailyDoseState();
  renderShell();
  const pages = {
    pairing: pairingPage,
    today: dashboard,
    caregiverHome: caregiverDashboard,
    medication: medicinePage,
    caregiver: caregiverPage,
    history: reportPage,
    settings: settingsPage
  };
  document.getElementById('view').innerHTML = (
    pages[state.page] || dashboard
  )();
  bindPageActions();
  document.title = `MedMind — ${state.page === 'pairing' ? flowText(caregiverMode ? 'caregiverTitle' : 'patientTitle') : t(state.page === 'today' ? 'today' : state.page)}`;
}
/** เปลี่ยนหน้าพร้อมตรวจการจับคู่และเลื่อนไปด้านบน */
function go(page) {
  if (
    caregiverMode &&
    !caregiverIsPaired() &&
    !['pairing', 'settings'].includes(page)
  )
    page = 'pairing';
  state.page = page;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
let toastTimer;
/** แสดงข้อความสถานะชั่วคราวให้ผู้อ่านหน้าจอรับรู้ด้วย */
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2300);
}
/** บันทึกธีมที่เลือกแล้ววาดหน้าจอใหม่ */
function setTheme(theme) {
  state.theme = theme;
  storage.write('medmind-theme', theme);
  render();
}
/** ผูกเหตุการณ์ของปุ่มและช่องค้นหาบนหน้าที่เพิ่งวาด */
function bindPageActions() {
  document.querySelectorAll('[data-lang]').forEach((b) =>
    b.addEventListener('click', () => {
      state.lang = b.dataset.lang;
      storage.write('medmind-lang', state.lang);
      render();
    })
  );
  document.querySelectorAll('.round-control[data-size]').forEach((b) =>
    b.addEventListener('click', () => {
      state.size = b.dataset.size;
      storage.write('medmind-size', state.size);
      render();
      toast(t('saved'));
    })
  );
  document
    .getElementById('confirm-dose')
    ?.addEventListener('click', (event) => {
      markDoseTaken(event.currentTarget.dataset.doseTime);
      render();
      toast(t('doseSaved'));
    });
  document
    .getElementById('caregiver-send-reminder')
    ?.addEventListener('click', () => toast(flowText('reminderDemo')));
  document
    .getElementById('add-med-button')
    ?.addEventListener('click', openModal);
  document.getElementById('medicine-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLocaleLowerCase();
    document
      .querySelectorAll('.medicine-item')
      .forEach(
        (item) =>
          (item.hidden = !item.textContent.toLocaleLowerCase().includes(q))
      );
  });
  document
    .getElementById('settings-theme')
    ?.addEventListener('click', () =>
      setTheme(state.theme === 'dark' ? 'light' : 'dark')
    );
  document
    .getElementById('settings-reminders')
    ?.addEventListener('click', toggleReminders);
  document
    .getElementById('care-reminder-toggle')
    ?.addEventListener('click', toggleReminders);
  for (const id of ['call-caregiver', 'call-caregiver-2'])
    document
      .getElementById(id)
      ?.addEventListener('click', () =>
        toast(
          state.lang === 'th'
            ? 'ตัวอย่างนี้ยังไม่ได้เชื่อมต่อการโทรจริง'
            : 'Calling is not connected in this demo'
        )
      );
}
/** เปิดหรือปิดเสียงเตือนและบันทึกตัวเลือกเดิม */
function toggleReminders() {
  state.reminders = !state.reminders;
  storage.write('medmind-reminders', state.reminders ? 'on' : 'off');
  render();
  toast(
    state.lang === 'th'
      ? state.reminders
        ? 'เปิดเสียงเตือนแล้ว'
        : 'ปิดเสียงเตือนแล้ว'
      : state.reminders
        ? 'Sound reminders on'
        : 'Sound reminders off'
  );
}
/** เปิดฟอร์มเพิ่มยาและย้ายโฟกัสเข้าสู่ฟอร์ม */
function openModal() {
  self.MedMind.medicine.open();
}
/** ปิดฟอร์มเพิ่มยาและคืนทรัพยากรรูปฉลากชั่วคราว */
function closeModal() {
  self.MedMind.medicine.close();
}
document
  .getElementById('theme-toggle')
  .addEventListener('click', () =>
    setTheme(state.theme === 'dark' ? 'light' : 'dark')
  );
document.getElementById('language-toggle').addEventListener('click', () => {
  state.lang = state.lang === 'th' ? 'en' : 'th';
  storage.write('medmind-lang', state.lang);
  render();
});
document
  .getElementById('reminder-toggle')
  .addEventListener('click', toggleReminders);
document.addEventListener('click', (event) => {
  const target =
    event.target instanceof Element
      ? event.target.closest('[data-page]')
      : null;
  if (target) go(target.dataset.page);
});
document.getElementById('close-modal').addEventListener('click', closeModal);
document.getElementById('modal-backdrop').addEventListener('click', (e) => {
  if (e.target.id === 'modal-backdrop') closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
// FR-02 บันทึกสำเร็จแล้วจึงอัปเดตตารางเดิม
document.addEventListener('medmind:medicines-changed', (event) => {
  state.medicines = self.MedMind.medication.resolveTimes(
    event.detail,
    self.MedMind.store.readMealTimes(),
    self.MedMind.reminder
  );
  go('medication');
});
document.addEventListener('medmind:meal-times-changed', () => {
  state.medicines = readMedicines();
  render();
});
// อีกแท็บแก้ยา/เวลามื้อ: อ่านข้อมูลร่วมใหม่โดยไม่บันทึกทับ
window.addEventListener('storage', (event) => {
  if (
    [
      self.MedMind.store.KEYS.medicines,
      self.MedMind.store.KEYS.mealTimes
    ].includes(event.key)
  ) {
    state.medicines = readMedicines();
    render();
  }
});
render();
