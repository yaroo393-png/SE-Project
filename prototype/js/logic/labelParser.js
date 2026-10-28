/*
 * labelParser.js — แปลงข้อความที่ OCR อ่านจากฉลากยา → ร่างข้อมูลยา (ไม่แตะ DOM)
 *
 * Covers: FR-02 (✓1, ✗3, ✗4, ✗5, ✗10)  ·  BR-04, BR-05, BR-06, BR-07  ·  NFR-09
 *
 * หลักการ: ดึงเฉพาะสิ่งที่ฉลากเขียนไว้ตรง ๆ — หาไม่เจอ = null ("กรุณาตรวจสอบ") ระบบไม่เดา (BR-04, BR-06)
 *   เช่น "วันละ 3 ครั้ง" ไม่มีคำว่า เช้า/กลางวัน/เย็น → ไม่เติมมื้อให้เอง
 * NFR-09: ไม่ดึงชื่อผู้ป่วย, HN, วันเกิด, เบอร์โทร และไม่คืนข้อความดิบ — ผู้เรียกต้องทิ้งรูปและข้อความ OCR หลังได้ร่าง
 * ร่างที่ได้ยังไม่ถูกบันทึก ต้องให้ Caregiver ตรวจและกดบันทึกผ่าน medication.saveMedication() เสมอ (NFR-06)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.MedMind = root.MedMind || {};
    root.MedMind.labelParser = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
  /*
   * OCR ภาษาไทยจากรูปถ่ายมักทำวรรณยุกต์และสระบน/ล่างหาย ("เม็ด" → "เมด", "ต่อ" → "ตอ")
   * จึงเทียบคำบน "โครง" ของข้อความ (ตัดสระบน/ล่างและวรรณยุกต์ทิ้ง) — คำค้นทุกคำด้านล่างเขียนในรูปโครงแล้ว
   * เช่น ครั้งละ → ครงละ · หลังอาหาร → หลงอาหาร · ก่อนนอน → กอนนอน · เช้า → เชา · เย็น → เยน · เม็ด → เมด
   */
  var MARKS = /[ัิ-ฺ็-๎]/;
  var MARKS_G = /[ัิ-ฺ็-๎]/g;
  var NUMBER_WORDS = { 'หนง': 1, 'สอง': 2, 'สาม': 3 };
  // OCR สับสนตัวที่หน้าตาคล้ายกันบ่อย: ช ↔ ซ ↔ ข ↔ ส, 1 ↔ | ) l I
  var SLOT_WORDS = [
    { slot: 'morning', re: /เชา|เขา/ },
    { slot: 'noon', re: /กลางวน|เทยง/ },
    { slot: 'evening', re: /เยน/ }
  ];
  /** คำบอกเวลา: ก่อนอาหาร / หลังอาหาร / ก่อนนอน — ใช้แบ่งข้อความเป็นช่วง ๆ */
  var TIMING_RE = /กอนอาหาร|หลงอาหาร|กอนนอน/g;
  // "เม็ด" ที่ OCR อ่านเพี้ยนบ่อย: เผ็ด / เบ็ด / เป็ด / เมิด (โครงเป็น เผด / เบด / เปด / เมด)
  var PILL_UNIT = '(?:เ[มผบป]ด|แคปซล)';
  var MAX_PILLS = 8;
  /** จำนวนที่จ่าย ("# 30 เม็ด", "จำนวน 30 เม็ด") — ไม่ใช่จำนวนเม็ดต่อครั้ง */
  var DISPENSED_BEFORE = /(?:#|จำนวน|รวม|[x×])$/;
  /**
   * ตารางสีข้างฉลาก ("เช้า 2 เม็ด / เที่ยง - / เย็น 1 เม็ด / ก่อนนอน -") — OCR อ่านเป็นข้อความคอลัมน์ขวา
   * ห่างจากข้อความวิธีใช้หลายช่องว่าง จึงแยกคอลัมน์ด้วยช่องว่างยาว แล้วอ่านทีละช่อง
   */
  var COLUMN_GAP = /[ \t]{5,}/;
  var TABLE_SLOTS = [
    { slot: 'morning', re: 'เชา|เขา' },
    { slot: 'noon', re: 'กลางวน|เทยง' },
    { slot: 'evening', re: 'เยน' },
    { slot: 'bedtime', re: 'กอนนอน' }
  ];
  var MEALS = ['morning', 'noon', 'evening'];
  var CELL_RE = new RegExp('^(?:' + TABLE_SLOTS.map(function (t) { return '(' + t.re + ')'; }).join('|') + ')' +
    '(?:(\\d{1,2}|หนง|สอง|สาม)' + PILL_UNIT + '|([-–—=~_]+))?');
  /** BR-07: ยาที่ MVP ไม่รองรับ */
  var UNSUPPORTED_RE = {
    prn: /เมอมอาการ|เวลามอาการ|เมอปวด|เวลาปวด|เมอมไข|เวลามไข|เมอจำเปน|prn/,
    liquid: /ยานำ|[ชซ]อนชา|[ชซ]อนโตะ|\dซซ|\d(?:ml|มล\.?|มลลลตร)|เขยาขวด/,
    half: /ครงเมด|1\/2เมด|½/
  };
  /** บรรทัดที่เป็นข้อมูลผู้ป่วย/สถานพยาบาล — ห้ามดึงไปเป็นชื่อยาหรือข้อควรระวัง (NFR-09) · เทียบบนโครง */
  var PERSONAL_RE = /\bhn\b|\bvn\b|hn\s*[:\d]|พยาบาล|hospital|คลนก|รานยา|[ชซสฐ]อ-?สกล|ผปวย|นาย|นาง|น\.ส\.|นพ\.|พญ\.|วนท|date|โทร|tel|เลขท|\d-\d{4}-\d{4}/i;
  var NAME_STOPWORDS = /^(TAB|TABS|TABLET|TABLETS|CAP|CAPS|CAPSULE|CAPSULES|HOSPITAL|PHARMACY|CLINIC|MG|MCG|GPO)$/i;
  // หน่วยความแรง + แบบที่ OCR อ่านเพี้ยน (mg → m8 / m9 / mq / rng) · ตามด้วยอักษรเศษได้ 1 ตัว ("5MGn TABLET")
  var STRENGTH = '\\d+(?:\\.\\d+)?\\s*(?:mg|m8|m9|mq|rng|mcg|g|iu|มก\\.?|มลลกรม)(?![a-z]{2})';
  var BAD_MG = /(\d)\s*(?:m8|m9|mq|rng)(?![a-z])/gi;
  /**
   * อักขระขีดตั้งที่ OCR อ่านแทนเลข 1 (เฉพาะตรงจำนวนเม็ด เช่น "ครั้งละ | เม็ด") — ใช้ได้แต่ต้องให้ผู้ดูแลตรวจ (draft.unsure)
   * ไม่รับวงเล็บ ")" เพราะเจอทั้งเลข 1 และ 2 ที่อ่านเพี้ยน → ปล่อยว่างดีกว่าเดาผิด (BR-04)
   */
  var ONE_LIKE = '[|li!]'; // เทียบหลัง compact() ซึ่งทำเป็นตัวพิมพ์เล็กแล้ว
  /**
   * ชื่อสามัญของยาที่ใช้บ่อยในผู้ป่วยนอก — ใช้แก้ชื่อที่ OCR อ่านแตก/เพี้ยนเล็กน้อย ("AMLODIP INE" → AMLODIPINE)
   * แก้เฉพาะเมื่อใกล้ชื่อในรายการชื่อเดียวชัดเจน · ไม่ตรงชื่อไหน = ใช้ตามที่อ่านได้ (ผู้ดูแลตรวจทุกครั้ง BR-04)
   */
  var DRUG_NAMES = [
    'AMLODIPINE', 'ATENOLOL', 'ENALAPRIL', 'LISINOPRIL', 'RAMIPRIL', 'LOSARTAN', 'VALSARTAN', 'CANDESARTAN',
    'TELMISARTAN', 'IRBESARTAN', 'HYDROCHLOROTHIAZIDE', 'FUROSEMIDE', 'SPIRONOLACTONE', 'PROPRANOLOL',
    'METOPROLOL', 'CARVEDILOL', 'BISOPROLOL', 'NIFEDIPINE', 'DILTIAZEM', 'VERAPAMIL', 'HYDRALAZINE', 'DOXAZOSIN',
    'PRAZOSIN', 'METHYLDOPA', 'ISOSORBIDE DINITRATE', 'ISOSORBIDE MONONITRATE', 'DIGOXIN', 'AMIODARONE',
    'TRIMETAZIDINE', 'METFORMIN', 'GLIPIZIDE', 'GLIBENCLAMIDE', 'GLICLAZIDE', 'GLIMEPIRIDE', 'PIOGLITAZONE',
    'SITAGLIPTIN', 'VILDAGLIPTIN', 'ACARBOSE', 'SIMVASTATIN', 'ATORVASTATIN', 'ROSUVASTATIN', 'PRAVASTATIN',
    'GEMFIBROZIL', 'FENOFIBRATE', 'EZETIMIBE', 'ASPIRIN', 'CLOPIDOGREL', 'WARFARIN', 'OMEPRAZOLE',
    'LANSOPRAZOLE', 'PANTOPRAZOLE', 'ESOMEPRAZOLE', 'RANITIDINE', 'FAMOTIDINE', 'DOMPERIDONE', 'METOCLOPRAMIDE',
    'SIMETHICONE', 'BISACODYL', 'SENNOSIDE', 'LACTULOSE', 'LOPERAMIDE', 'HYOSCINE', 'DICYCLOVERINE',
    'PARACETAMOL', 'IBUPROFEN', 'NAPROXEN', 'DICLOFENAC', 'MEFENAMIC ACID', 'CELECOXIB', 'ETORICOXIB',
    'PIROXICAM', 'MELOXICAM', 'TRAMADOL', 'ORPHENADRINE', 'TOLPERISONE', 'COLCHICINE', 'ALLOPURINOL',
    'CHLORPHENIRAMINE', 'CETIRIZINE', 'LORATADINE', 'FEXOFENADINE', 'DESLORATADINE', 'HYDROXYZINE',
    'DIPHENHYDRAMINE', 'BROMHEXINE', 'AMBROXOL', 'GUAIFENESIN', 'DEXTROMETHORPHAN', 'CARBOCYSTEINE',
    'ACETYLCYSTEINE', 'PSEUDOEPHEDRINE', 'SALBUTAMOL', 'THEOPHYLLINE', 'MONTELUKAST', 'PREDNISOLONE',
    'DEXAMETHASONE', 'AMOXICILLIN', 'DICLOXACILLIN', 'CEPHALEXIN', 'CEFDINIR', 'ROXITHROMYCIN', 'AZITHROMYCIN',
    'CLARITHROMYCIN', 'DOXYCYCLINE', 'CIPROFLOXACIN', 'NORFLOXACIN', 'OFLOXACIN', 'LEVOFLOXACIN',
    'METRONIDAZOLE', 'NITROFURANTOIN', 'FLUCONAZOLE', 'ACYCLOVIR', 'ALBENDAZOLE', 'LEVOTHYROXINE',
    'PROPYLTHIOURACIL', 'METHIMAZOLE', 'FOLIC ACID', 'FERROUS SULFATE', 'FERROUS FUMARATE', 'CALCIUM CARBONATE',
    'THIAMINE', 'PYRIDOXINE', 'CYANOCOBALAMIN', 'ASCORBIC ACID', 'ALENDRONATE', 'CALCITRIOL', 'AMITRIPTYLINE',
    'NORTRIPTYLINE', 'FLUOXETINE', 'SERTRALINE', 'ESCITALOPRAM', 'TRAZODONE', 'LORAZEPAM', 'DIAZEPAM',
    'ALPRAZOLAM', 'CLONAZEPAM', 'ZOLPIDEM', 'HALOPERIDOL', 'RISPERIDONE', 'QUETIAPINE', 'OLANZAPINE',
    'GABAPENTIN', 'PREGABALIN', 'CARBAMAZEPINE', 'PHENYTOIN', 'VALPROATE', 'LEVETIRACETAM', 'TOPIRAMATE',
    'DONEPEZIL', 'MEMANTINE', 'BETAHISTINE', 'CINNARIZINE', 'FLUNARIZINE', 'DIMENHYDRINATE', 'MECLIZINE',
    'TAMSULOSIN', 'FINASTERIDE', 'POTASSIUM CHLORIDE', 'SODIUM BICARBONATE', 'CALCIUM ACETATE'
  ];
  var DRUG_KEYS = DRUG_NAMES.map(function (n) { return n.replace(/ /g, ''); });

  /** เลขไทย → อารบิก · "ํา" → "ำ" · ตัดช่องว่างระหว่างอักษรไทย (OCR มักแทรกช่องว่าง) */
  function normalize(raw) {
    var s = String(raw || '');
    s = s.replace(/[๐-๙]/g, function (d) { return String(THAI_DIGITS.indexOf(d)); });
    s = s.replace(/ํา/g, 'ำ');
    s = s.replace(/([฀-๿])[ \t]+(?=[฀-๿])/g, '$1');
    return s
      .split(/\r?\n/)
      .map(function (line) { return line.replace(/[ \t]+/g, ' ').trim(); })
      .filter(Boolean);
  }

  function skeleton(s) {
    return s.replace(MARKS_G, '');
  }

  /** โครงของบรรทัด + ตำแหน่งในบรรทัดเดิม (ใช้ตัดค่าจากข้อความเดิมที่ยังมีวรรณยุกต์) */
  function skelMap(line) {
    var skel = '';
    var map = [];
    for (var i = 0; i < line.length; i++) {
      if (MARKS.test(line[i])) continue;
      map.push(i);
      skel += line[i];
    }
    map.push(line.length);
    return { skel: skel, map: map };
  }

  function compact(s) {
    return s.replace(/\s+/g, '').toLowerCase();
  }

  /** ตัดอักขระขยะจาก OCR (เช่น $ ' |) และช่องว่างซ้ำ */
  function cleanValue(s) {
    return s
      .replace(/[^฀-๿a-zA-Z0-9 .,:;()[\]/%+-]/g, ' ')
      .replace(/^[\s:：\-–.,;]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** ข้อความที่อ่านเป็นคำได้จริง (ไม่ใช่เศษตัวอักษร) — ตัวอักษรไทย/อังกฤษอย่างน้อย 3 ตัว */
  function readable(s) {
    if ((s.match(/[\u0E00-\u0E7Fa-zA-Z]/g) || []).length < 3) return false;
    // เศษอักษรอังกฤษ 1–2 ตัวกระจายอยู่หลายที่ ("Ln i LT") = OCR อ่านเพี้ยน
    return (s.match(/(?:^|\s)[A-Za-z]{1,2}(?=\s|$)/g) || []).length < 2;
  }

  function findUnsupported(all) {
    var keys = Object.keys(UNSUPPORTED_RE);
    for (var i = 0; i < keys.length; i++) {
      if (UNSUPPORTED_RE[keys[i]].test(all)) return keys[i];
    }
    return null;
  }

  function toCount(word) {
    if (new RegExp('^' + ONE_LIKE + '$').test(word)) return 1;
    var n = NUMBER_WORDS[word] || Number(word);
    return n >= 1 ? n : null;
  }

  /** "12 เม็ด" ที่ตำแหน่ง index เป็นจำนวนที่จ่าย ("# 30 เม็ด") หรือเกินจำนวนต่อครั้ง → ไม่ใช่จำนวนเม็ดต่อครั้ง */
  function perDose(text, index, count) {
    return count !== null && count <= MAX_PILLS && !DISPENSED_BEFORE.test(text.slice(Math.max(0, index - 6), index));
  }

  /**
   * "ครั้งละ 1 เม็ด" / "ทาน 1 เม็ด" / "ทีละ 1 เม็ด" / "ครั้งละหนึ่งแคปซูล" → { count: 1, unsure: false } · OCR อ่าน "ครั้งละ | เม็ด" → unsure
   * ฉลากที่ไม่มีคำนำ ("1 เม็ด วันละ 2 ครั้ง") → ใช้ "N เม็ด" ตัวแรกที่ไม่ใช่จำนวนที่จ่าย แต่ unsure ให้ผู้ดูแลตรวจ
   * ไม่เจอ → count null
   */
  function findPills(all) {
    var m = new RegExp('(?:ครงละ|ทละ|ทาน|กน)(\\d{1,2}|หนง|สอง|สาม|' + ONE_LIKE + ')' + PILL_UNIT).exec(all);
    if (m) {
      var count = toCount(m[1]);
      // เกิน MAX_PILLS ไม่น่าใช่จำนวนเม็ดต่อครั้ง (เช่น OCR อ่าน "1/2 เม็ด" เป็น "12 เม็ด") → ปล่อยว่าง ไม่เดา
      if (count === null || count > MAX_PILLS) return { count: null, unsure: false };
      return { count: count, unsure: new RegExp('^' + ONE_LIKE + '$').test(m[1]) };
    }
    var re = new RegExp('(\\d{1,2}|หนง|สอง|สาม)' + PILL_UNIT, 'g');
    while ((m = re.exec(all)) !== null) {
      // "1/2 เม็ด" = ยาครึ่งเม็ด (BR-07) · "1-2 เม็ด" = ช่วง ไม่รู้ว่ากี่เม็ด → ข้าม ไม่เดา
      if (/[\d/\-–]/.test(all[m.index - 1] || '')) continue;
      if (perDose(all, m.index, toCount(m[1]))) return { count: toCount(m[1]), unsure: true };
    }
    return { count: null, unsure: false };
  }

  /** จำนวนเม็ดตัวสุดท้ายในช่วงข้อความ ("และ 1 เม็ด หลังอาหารเย็น") · ไม่นับจำนวนที่จ่าย ("# 30 เม็ด") */
  function lastCount(text) {
    var re = new RegExp('(\\d{1,2}|หนง|สอง|สาม)' + PILL_UNIT, 'g');
    var m;
    var last = null;
    while ((m = re.exec(text)) !== null) {
      if (perDose(text, m.index, toCount(m[1]))) last = toCount(m[1]);
    }
    return last;
  }

  /**
   * อ่านช่องตารางในส่วนหนึ่งของบรรทัด → [{ slot, count }] หรือ null ถ้าไม่ใช่ช่องตาราง
   * count: จำนวนเม็ด · 0 = ขีด "-" (ไม่มียามื้อนี้) · null = อ่านค่าไม่ออก
   * first = ส่วนแรกของบรรทัด: คำบอกมื้อเปล่า ๆ ("ก่อนนอน") ถือเป็นวิธีใช้ ไม่ใช่ช่องตาราง
   */
  function readCells(segment, first) {
    var rest = compact(skeleton(segment)).replace(/^[^\u0E01-\u0E4F]{0,3}/, '');
    var cells = [];
    var m;
    while (rest && (m = CELL_RE.exec(rest)) !== null) {
      var slot = null;
      for (var i = 0; i < TABLE_SLOTS.length; i++) if (m[i + 1]) slot = TABLE_SLOTS[i].slot;
      rest = rest.slice(m[0].length);
      // "เช้า-เย็น" = กินทั้งเช้าและเย็น ไม่ใช่ "เช้า: ไม่มี" → ไม่ใช่ตาราง
      if (m[6] && CELL_RE.test(rest)) return null;
      cells.push({ slot: slot, count: m[5] ? toCount(m[5]) : m[6] ? 0 : null });
    }
    // เหลือเศษได้ไม่เกิน 3 ตัว (OCR อ่านขอบตาราง/สีพื้นเป็นอักษร) · ส่วนแรกของบรรทัดต้องมีค่าในช่อง
    if (!cells.length || rest.length > 3) return null;
    if (first && cells.every(function (c) { return c.count === null; })) return null;
    return cells;
  }

  /**
   * ข้อความดิบ → { text: ข้อความวิธีใช้ที่ตัดช่องตารางออกแล้ว, cells: { morning: 2, noon: 0, evening: null, ... } }
   * ช่องที่ไม่เจอเลย = ไม่มี key
   */
  function splitTable(raw) {
    var cells = {};
    var inline = false;
    var text = String(raw || '').split(/\r?\n/).map(function (line) {
      return line.split(COLUMN_GAP).filter(function (seg, i) {
        var found = seg.trim() && readCells(normalize(seg).join(' '), i === 0);
        if (!found) return true;
        // หลายช่องในบรรทัดเดียว ("เช้า 1 เม็ด เย็น 1 เม็ด") = เขียนวิธีใช้เรียงในบรรทัด มื้อที่ไม่เขียน = ไม่กิน
        if (i === 0 && found.length >= 2) inline = true;
        found.forEach(function (c) {
          // ช่องเดียวกันอ่านได้ 2 ค่าไม่ตรงกัน → ถือว่าอ่านไม่ออก
          cells[c.slot] = c.slot in cells && cells[c.slot] !== c.count ? null : c.count;
        });
        return false;
      }).join('   ');
    }).join('\n');
    if (inline) MEALS.forEach(function (s) { if (!(s in cells)) cells[s] = 0; });
    return { text: text, cells: cells };
  }

  /**
   * เติมจากตารางข้างฉลาก (BR-06: ชนิดมื้อ ก่อน/หลังอาหาร ต้องมาจากข้อความบนฉลาก — ตารางบอกแค่มื้อกับจำนวนเม็ด)
   *  - ข้อความบอก "หลังอาหาร" แต่ไม่บอกมื้อ + ตารางอ่านครบทั้งเช้า/กลางวัน/เย็น → แยกเป็นรายมื้อตามตาราง
   *  - ตารางมีเม็ดตอนก่อนนอน → เพิ่มก่อนนอน · ไม่มีจำนวนเม็ดในข้อความ → ใช้จำนวนในตาราง
   *  - จำนวนเม็ดรายมื้อต่างจากค่าหลัก → timing.pills
   */
  function applyTable(timings, pills, cells) {
    var counted = MEALS.concat('bedtime').filter(function (s) { return cells[s] > 0; });
    if (!counted.length) return { timings: timings, pills: pills.count, unsure: pills.unsure };
    var main = pills.count !== null ? pills.count : cells[counted[0]];
    // ข้อความกับตารางบอกจำนวนไม่ตรงกัน = มีจุดที่ OCR อ่านผิด → ให้ผู้ดูแลตรวจ
    var unsure = pills.unsure || (pills.count !== null && counted.some(function (s) { return cells[s] !== pills.count; }));
    var out = timings;
    var typed = timings.filter(function (t) { return t.type !== 'bedtime'; });
    var allKnown = MEALS.every(function (s) { return typeof cells[s] === 'number'; });
    var oneType = typed.length > 0 && typed.every(function (t) { return t.slot === null && t.type === typed[0].type; });
    if (allKnown && oneType && MEALS.some(function (s) { return cells[s] > 0; })) {
      out = MEALS.filter(function (s) { return cells[s] > 0; }).map(function (s) {
        return { type: typed[0].type, slot: s, minutesBefore: typed[0].minutesBefore };
      }).concat(timings.filter(function (t) { return t.type === 'bedtime'; }));
    }
    if (cells.bedtime > 0 && !out.some(function (t) { return t.type === 'bedtime'; })) {
      out = out.concat({ type: 'bedtime', slot: null, minutesBefore: null });
    }
    out.forEach(function (t) {
      var n = cells[t.type === 'bedtime' ? 'bedtime' : t.slot];
      if (n > 0 && n !== main && t.pills === undefined) t.pills = n;
    });
    return { timings: out, pills: main, unsure: unsure };
  }

  /** มื้อที่เขียนไว้ในช่วงข้อความ · "เที่ยง -" (ช่องตารางที่หลุดมาในข้อความ) = ไม่มียามื้อนี้ · "เช้า-เย็น" = ทั้ง 2 มื้อ */
  function slotsIn(text) {
    return SLOT_WORDS.filter(function (w) {
      var re = new RegExp(w.re.source, 'g');
      var m;
      while ((m = re.exec(text)) !== null) {
        var rest = text.slice(m.index + m[0].length);
        if (!/^[-–—=~]/.test(rest) || SLOT_WORDS.some(function (o) { return new RegExp('^[-–—=~]+(?:' + o.re.source + ')').test(rest); })) return true;
      }
      return false;
    }).map(function (w) { return w.slot; });
  }

  /** "หลังอาหาร 3 มื้อ" / "3 เวลา" / "ทุกมื้อ" = ครบทั้ง เช้า กลางวัน เย็น (มีแค่ 3 มื้อ จึงไม่ใช่การเดา) · "วันละ 3 ครั้ง" ไม่นับ */
  var ALL_MEALS_RE = /3(?:มอ|เวลา)|ทกมอ/;

  /** "ก่อนอาหาร 30 นาที" / "30 น." → 30 · "ครึ่งชั่วโมง" → 30 · "1 ชั่วโมง" / "1 ชม." → 60 · ไม่ระบุ → null (FR-02 ✗10) */
  function minutesIn(text) {
    // ไม่นับเวลานาฬิกา ("07.30 น.")
    var m = /(?:^|[^\d.:])(\d{1,3})(?:นาท|น\.)/.exec(text);
    if (m) return Number(m[1]) || null;
    if (/ครงชวโมง|ครงชม\./.test(text)) return 30;
    m = /(\d)(?:ชวโมง|ชม\.?)/.exec(text);
    if (m) return Number(m[1]) * 60 || null;
    return null;
  }

  /**
   * BR-06: หา ก่อนอาหาร/หลังอาหาร/ก่อนนอน แล้วดูคำบอกมื้อ (เช้า/กลางวัน/เย็น) ในช่วงข้อความหลังคำนั้น
   * ถ้าหลังคำไม่มีมื้อ ดูช่วงก่อนหน้า (ฉลากบางแบบเขียน "เช้า-เย็น หลังอาหาร") · หาไม่เจอ → slot = null
   * จำนวนเม็ดต่างกันต่อมื้อ ("2 เม็ด หลังอาหารเช้า และ 1 เม็ด หลังอาหารเย็น") → timing.pills ของมื้อนั้น
   */
  function findTimings(all, pills) {
    var hits = [];
    var m;
    TIMING_RE.lastIndex = 0;
    while ((m = TIMING_RE.exec(all)) !== null) {
      // "ห้ามรับประทานก่อนนอน" / "งดรับประทานหลังอาหาร" = ข้อห้าม ไม่ใช่เวลากินยา
      // ต้องติดกับคำบอกเวลาเท่านั้น — "ห้ามเคี้ยว ก่อนอาหารเช้า" ยังเป็นเวลากินยาตามปกติ
      if (/(?:หาม|งด|ไมควร)(?:รบประทาน|กน|ทาน|ใชยา|ใช)?$/.test(all.slice(0, m.index))) continue;
      hits.push({ word: m[0], start: m.index, end: m.index + m[0].length });
    }
    var timings = [];
    var seen = {};
    var push = function (t) {
      if (t.pills === null) delete t.pills;
      var id = t.type + '|' + t.slot + '|' + t.minutesBefore;
      if (!seen[id]) {
        seen[id] = true;
        timings.push(t);
      }
    };
    // ข้อความก่อนหน้าที่ยังไม่มีคำบอกเวลาตัวไหนใช้ไป (กันมื้อของคำก่อนหน้าถูกนับซ้ำ)
    var freeFrom = 0;
    var prevEnd = 0;
    hits.forEach(function (hit, i) {
      var own = lastCount(all.slice(prevEnd, hit.start));
      var count = own !== null && pills !== null && own !== pills ? own : null;
      prevEnd = hit.end;
      if (hit.word === 'กอนนอน') {
        if (/^[-–—=~]/.test(all.slice(hit.end))) return; // ตารางข้างฉลาก "ก่อนนอน -" = ไม่มียามื้อนี้
        push({ type: 'bedtime', slot: null, minutesBefore: null, pills: count });
        freeFrom = hit.end;
        return;
      }
      var type = hit.word === 'กอนอาหาร' ? 'before' : 'after';
      var nextStart = i + 1 < hits.length ? hits[i + 1].start : all.length;
      var afterEnd = Math.min(nextStart, hit.end + 40);
      var after = all.slice(hit.end, afterEnd);
      var before = all.slice(Math.max(freeFrom, hit.start - 30), hit.start);
      var slots = slotsIn(after);
      freeFrom = slots.length ? afterEnd : hit.end;
      if (slots.length === 0) slots = slotsIn(before);
      if (slots.length === 0 && (new RegExp('^(?:' + ALL_MEALS_RE.source + ')').test(after) ||
        new RegExp('(?:' + ALL_MEALS_RE.source + ')$').test(before))) slots = MEALS;
      var minutes = type === 'before' ? minutesIn(after) : null;
      if (slots.length === 0) slots = [null];
      slots.forEach(function (slot) { push({ type: type, slot: slot, minutesBefore: minutes, pills: count }); });
    });
    return timings;
  }

  function personal(line) {
    return PERSONAL_RE.test(skeleton(line));
  }

  /** คำที่น่าจะเป็นชื่อยา (อังกฤษ ≥ 4 ตัว ที่ไม่ใช่ TAB/MG ฯลฯ) */
  function drugWords(text) {
    return (text.match(/[A-Za-z][A-Za-z-]{3,}/g) || []).filter(function (w) { return !NAME_STOPWORDS.test(w); });
  }

  /** จำนวนตัวอักษรที่ต้องแก้ (เพิ่ม/ลบ/เปลี่ยน) ให้ a เป็น b */
  function editDistance(a, b) {
    var prev = [];
    var cur = [];
    var i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  /**
   * ตัวอักษรอังกฤษที่อ่านได้ → ชื่อยาในรายการ หรือ null
   * รับเมื่อ (1) ต่างกันไม่เกิน 1 ตัวต่อ 5 ตัวอักษร และใกล้ชื่อนี้กว่าชื่ออื่นชัดเจน
   * หรือ (2) อ่านได้แค่หัว/ท้ายของชื่อ ≥ 6 ตัว (≥ 60% ของชื่อ) และตรงกับชื่อเดียว ("ACETAMOL" → PARACETAMOL)
   */
  function matchDrug(letters) {
    var s = letters.toUpperCase();
    if (s.length < 5) return null;
    var best = -1;
    var bestD = Infinity;
    var secondD = Infinity;
    DRUG_KEYS.forEach(function (key, i) {
      if (Math.abs(key.length - s.length) > 3) return;
      var d = editDistance(s, key);
      if (d < bestD) {
        secondD = bestD;
        bestD = d;
        best = i;
      } else if (d < secondD) {
        secondD = d;
      }
    });
    if (best !== -1 && bestD <= Math.max(1, Math.floor(DRUG_KEYS[best].length / 5)) && bestD < secondD) return DRUG_NAMES[best];
    if (s.length < 6) return null;
    var part = DRUG_KEYS.filter(function (key) {
      return (key.indexOf(s) === 0 || key.slice(-s.length) === s) && s.length / key.length >= 0.6;
    });
    return part.length === 1 ? DRUG_NAMES[DRUG_KEYS.indexOf(part[0])] : null;
  }

  /** เขียนชื่อในรายการให้เหมือนบนฉลาก: ฉลากพิมพ์ใหญ่ → AMLODIPINE · พิมพ์เล็ก → Amlodipine */
  function styleLike(name, sample) {
    var upper = (sample.match(/[A-Z]/g) || []).length;
    var lower = (sample.match(/[a-z]/g) || []).length;
    if (upper >= lower) return name;
    return name.toLowerCase().replace(/(^|\s)[a-z]/g, function (c) { return c.toUpperCase(); });
  }

  /**
   * หาชื่อยาในรายการจากคำในบรรทัด — รวมคำที่ OCR แยกออก ("ATORV ASTATIN", "PARAC เ TAMOL")
   * คืน { start, end, name } (ตำแหน่งคำใน tokens) หรือ null
   */
  function findDrugIn(tokens) {
    var letters = tokens.map(function (t) { return /\d/.test(t) || NAME_STOPWORDS.test(t) ? null : t.replace(/[^A-Za-z]/g, ''); });
    for (var i = 0; i < tokens.length; i++) {
      if (!letters[i]) continue;
      for (var len = 3; len >= 1; len--) {
        var end = i + len;
        if (end > tokens.length || !letters[end - 1]) continue;
        var joined = '';
        var ok = true;
        for (var k = i; k < end; k++) {
          // ระหว่างคำยอมให้มีเศษ 1 ตัวที่ไม่ใช่อังกฤษ (OCR อ่าน E เป็น "เ")
          if (letters[k] === null || (letters[k] === '' && tokens[k].length > 1)) { ok = false; break; }
          joined += letters[k];
        }
        if (!ok) continue;
        var name = matchDrug(joined);
        if (name) return { start: i, end: end, name: styleLike(name, tokens.slice(i, end).join('')) };
      }
    }
    return null;
  }

  /**
   * แก้ชื่อยาที่อ่านได้: ชื่อแตก/เพี้ยนเล็กน้อย → ชื่อในรายการ · หน่วยเพี้ยน (m8) → mg · ตัดเศษอักษรไทยท้ายชื่ออังกฤษ
   * คืน { name, unsure } · unsure = ระบบแก้ชื่อให้ หรือชื่อขึ้นต้นตัวพิมพ์เล็ก (มักอ่านได้แค่ท้ายชื่อ "azole") → ผู้ดูแลต้องตรวจ
   */
  function fixName(name) {
    var tokens = name.replace(BAD_MG, '$1 mg').split(' ');
    var hit = findDrugIn(tokens);
    var unsure = !hit && /^[a-z]/.test(tokens[0]);
    if (hit) {
      unsure = tokens.slice(hit.start, hit.end).join(' ').toUpperCase() !== hit.name.toUpperCase();
      tokens.splice(hit.start, hit.end - hit.start, hit.name);
    }
    if (/^[A-Za-z]/.test(tokens[0])) {
      var last = function () { return tokens[tokens.length - 1]; };
      while (tokens.length > 1 && /[฀-๿]/.test(last()) && !/^(?:มก\.?|มิลลิกรัม)$/.test(last())) tokens.pop();
    }
    return { name: tokens.join(' '), unsure: unsure };
  }

  /**
   * ไม่เจอชื่อด้วยวิธีอื่น → หาคำที่ตรงชื่อในรายการจากทุกบรรทัด + ความแรงในบรรทัดเดียวกันหรือบรรทัดถัดไป
   * คืนคำตามที่อ่านได้ (fixName แก้เป็นชื่อในรายการต่อ)
   */
  function findListedName(lines) {
    var strength = new RegExp(STRENGTH, 'i');
    for (var i = 0; i < lines.length; i++) {
      if (personal(lines[i])) continue;
      var tokens = lines[i].split(' ');
      var hit = findDrugIn(tokens);
      if (!hit) continue;
      var rest = tokens.slice(hit.end).join(' ');
      var m = strength.exec(rest) || (lines[i + 1] && !personal(lines[i + 1]) ? strength.exec(lines[i + 1]) : null);
      return tokens.slice(hit.start, hit.end).join(' ') + (m ? ' ' + m[0] : '');
    }
    return null;
  }

  /**
   * ชื่อยา: บรรทัด "ชื่อยา: …" ก่อน
   * → บรรทัดที่มีความแรงยา (500 mg / 500 มก.) ตัดถึงหน่วย · บรรทัดนั้นไม่มีชื่อ ("500 MG/1 TABLET") → ต่อชื่อจากบรรทัดก่อน
   * → บรรทัดภาษาอังกฤษที่ตามด้วย Tab/Cap ("Vitamin B1-6-12 Tab") → ส่วนก่อน Tab
   * → คำอังกฤษตัวใหญ่ล้วน · ไม่มีเลย = null (กรุณาตรวจสอบ)
   */
  /** → { name, unsure } · ไม่เจอ → name null */
  function findName(lines) {
    var name = findNameAsRead(lines);
    return name ? fixName(name) : { name: null, unsure: false };
  }

  function findNameAsRead(lines) {
    var i, m;
    for (i = 0; i < lines.length; i++) {
      var sm = skelMap(lines[i]);
      m = /[ชซส]อยา\s*[:：]?\s*/.exec(sm.skel); // OCR อ่าน "ชื่อยา" เป็น "สื่อยา" / "ซื่อยา" ได้
      if (m) {
        var v = cleanValue(lines[i].slice(sm.map[m.index + m[0].length])) || (lines[i + 1] ? cleanValue(lines[i + 1]) : '');
        if (v) return v;
      }
    }
    // ฉลากโรงพยาบาลมักพิมพ์วันที่ต่อท้ายชื่อยา ("VITAMIN B COMPLEX  วันที่ 1 ต.ค.") → ใช้ส่วนก่อนวันที่
    var named = lines.map(function (line) {
      var b = beforeDate(line);
      return personal(b) ? '' : b;
    });
    var usable = named.filter(Boolean);
    var strength = new RegExp('^(.*?' + STRENGTH + ')', 'i');
    for (i = 0; i < named.length; i++) {
      if (!named[i]) continue;
      m = strength.exec(skeleton(named[i]).replace(/มก(?!\.)/, 'มก.'));
      if (!m || !/[A-Za-z]{2,}/.test(named[i])) continue;
      var name = cleanValue(m[1]);
      if (drugWords(name).length === 0 && i > 0) {
        // "500 MG/1 TABLET" → ชื่ออยู่บรรทัดก่อน (ส่วนอักษรอังกฤษต้นบรรทัด ก่อนวันที่/ข้อมูลอื่น)
        var prev = cleanValue((/^[^\u0E00-\u0E7F]*/.exec(lines[i - 1]) || [''])[0]);
        if (drugWords(prev).length) name = prev + ' ' + name;
      }
      if (drugWords(name).length) return name;
    }
    for (i = 0; i < usable.length; i++) {
      m = /^(.*?[A-Za-z]{4,}.*?)\s*\b(?:tab|tabs|tablet|tablets|cap|caps|capsule|capsules)\b/i.exec(usable[i]);
      if (m && drugWords(m[1]).length) return cleanValue(m[1]);
    }
    var listed = findListedName(named);
    if (listed) return listed;
    for (i = 0; i < usable.length; i++) {
      // คำอังกฤษตัวใหญ่ล้วน + คำสั้นที่ตามมา ("VITAMIN B COMPLEX")
      m = /\b[A-Z][A-Z-]{4,}(?:\s+[A-Z][A-Z0-9-]*)*/.exec(usable[i]);
      if (!m) continue;
      var words = m[0].split(/\s+/).filter(function (w) { return !NAME_STOPWORDS.test(w); });
      if (words.length) return words.join(' ');
    }
    return null;
  }

  /** ส่วนของบรรทัดก่อนคำว่า "วันที่" / "date" (ทั้งบรรทัดถ้าไม่มี) */
  function beforeDate(line) {
    var sm = skelMap(line);
    var m = /วนท|date/i.exec(sm.skel);
    return m ? line.slice(0, sm.map[m.index]).trim() : line;
  }

  /** ข้อควรระวัง / ข้อห้ามใช้ — บันทึกเฉพาะเมื่อฉลากมี (BR-05) · ข้อความที่อ่านไม่เป็นคำถูกทิ้ง */
  function findNotes(lines) {
    var cautions = [];
    var contras = [];
    var take = function (list, line, sm, endInSkel, next) {
      var v = cleanValue(line.slice(sm.map[endInSkel]));
      if (!v && next) v = cleanValue(next);
      if (v && readable(v)) list.push(v);
    };
    lines.forEach(function (line, i) {
      if (personal(line)) return;
      var sm = skelMap(line);
      var m = /(?:ขอควรระวง|คำเตอน)\s*[:：]?\s*/.exec(sm.skel);
      if (m) return take(cautions, line, sm, m.index + m[0].length, lines[i + 1]);
      m = /ขอหาม(?:ใช)?\s*[:：]?\s*/.exec(sm.skel);
      if (m) return take(contras, line, sm, m.index + m[0].length, lines[i + 1]);
      if (/อาจทำให|ระวง/.test(sm.skel)) take(cautions, line, sm, 0);
      else if (/หาม/.test(sm.skel)) take(contras, line, sm, 0);
    });
    return { caution: cautions.join(' · '), contraindication: contras.join(' · ') };
  }

  /**
   * ข้อความ OCR → { ok: true, draft, missing[] } หรือ { ok: false, reason: 'unreadable' } (FR-02 ✗5 → เปิดฟอร์มว่าง)
   * draft.unsupported = 'prn' | 'liquid' | 'half' | null (FR-02 ✗4)
   * draft.unsure = ['name' | 'pills'] ช่องที่ระบบแก้คำที่อ่านเพี้ยนให้ — มีค่าแต่ผู้ดูแลต้องตรวจ
   * missing = ช่องบังคับที่หาไม่เจอ → หน้าจอแสดง "กรุณาตรวจสอบ" (FR-02 ✗3, ✗10)
   */
  function parseLabel(raw) {
    var lines = normalize(raw);
    var all = compact(skeleton(lines.join('')));
    // จำนวนเม็ด/มื้ออ่านจากข้อความวิธีใช้ที่ตัดตารางข้างฉลากออกแล้ว แล้วค่อยเติมจากตาราง
    var table = splitTable(raw);
    var text = compact(skeleton(normalize(table.text).join('')));
    var pills = findPills(text);
    var dose = applyTable(findTimings(text, pills.count), pills, table.cells);
    var name = findName(lines);
    var draft = {
      name: name.name,
      pills: dose.pills,
      timings: dose.timings,
      caution: '',
      contraindication: '',
      unsupported: findUnsupported(all),
      // ช่องที่มีค่าแต่ระบบแก้คำที่ OCR อ่านเพี้ยนให้ / เดาจากบริบท → หน้าจอเน้นให้ผู้ดูแลตรวจ (BR-04)
      unsure: (name.unsure ? ['name'] : []).concat(dose.unsure ? ['pills'] : [])
    };
    var notes = findNotes(lines);
    draft.caution = notes.caution;
    draft.contraindication = notes.contraindication;

    if (!draft.name && draft.pills === null && draft.timings.length === 0 && !draft.unsupported) {
      return { ok: false, reason: 'unreadable' };
    }
    return { ok: true, draft: draft, missing: missingOf(draft) };
  }

  /** ช่องบังคับที่ยังว่าง → หน้าจอแสดง "กรุณาตรวจสอบ" */
  function missingOf(draft) {
    var missing = [];
    if (!draft.name) missing.push('name');
    if (draft.pills === null) missing.push('pills');
    if (draft.timings.length === 0) missing.push('timings');
    draft.timings.forEach(function (t, i) {
      if (t.type !== 'bedtime' && !t.slot) missing.push('timing.' + i + '.slot');
      if (t.type === 'before' && !t.minutesBefore) missing.push('timing.' + i + '.minutesBefore');
    });
    return missing;
  }

  // ---------- ผลจาก AI (Gemini) ----------
  var AI_TYPES = ['after', 'before', 'bedtime'];
  var AI_SLOTS = ['morning', 'noon', 'evening'];
  var AI_UNSUPPORTED = ['prn', 'liquid', 'half'];

  function aiInt(v, max) {
    var n = typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v;
    return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
  }
  /** ข้อความจาก AI: ตัด HN / เบอร์โทร ที่อาจหลุดมา (NFR-09) และอักขระขยะ */
  function aiText(v, max) {
    if (typeof v !== 'string') return '';
    var t = v.replace(/\b(?:HN|VN)\s*[:#-]?\s*\d+/gi, ' ').replace(/\b0\d{1,2}-?\d{3}-?\d{3,4}\b/g, ' ');
    return cleanValue(t).slice(0, max);
  }

  /** ข้อความตอบกลับของ AI → object (รองรับกรณีครอบด้วย ```json) · อ่านไม่ได้ → null */
  function parseAIText(text) {
    var t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try {
      var obj = JSON.parse(t);
      return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * ผลที่ AI อ่านจากรูป → ร่างรูปเดียวกับ parseLabel()
   * ไม่เชื่อ AI ทั้งหมด: รับเฉพาะค่าที่อยู่ในรูปแบบที่ระบบรู้จัก ค่าแปลก = null ("กรุณาตรวจสอบ") · ผู้ดูแลยังต้องตรวจทุกช่อง (BR-04)
   */
  function fromAI(obj) {
    if (!obj || typeof obj !== 'object' || obj.readable === false) return { ok: false, reason: 'unreadable' };
    var pills = aiInt(obj.pills, 20);
    if (pills === null && Array.isArray(obj.timings)) {
      // AI ใส่จำนวนเม็ดไว้แค่รายมื้อ → ใช้ของมื้อแรกเป็นค่าหลัก (มื้ออื่นที่ต่างยังเก็บแยก)
      var first = obj.timings.filter(function (t) { return t && aiInt(t.pills, 20) !== null; })[0];
      if (first) pills = aiInt(first.pills, 20);
    }
    var timings = [];
    var seen = {};
    (Array.isArray(obj.timings) ? obj.timings : []).slice(0, 8).forEach(function (t) {
      if (!t || AI_TYPES.indexOf(t.type) === -1) return;
      var out = {
        type: t.type,
        slot: t.type === 'bedtime' ? null : AI_SLOTS.indexOf(t.slot) !== -1 ? t.slot : null,
        minutesBefore: t.type === 'before' ? aiInt(t.minutesBefore, 180) : null
      };
      var p = aiInt(t.pills, 20);
      if (p !== null && p !== pills) out.pills = p;
      var id = out.type + '|' + out.slot + '|' + out.minutesBefore;
      if (seen[id]) return;
      seen[id] = true;
      timings.push(out);
    });
    var name = aiText(obj.name, 120);
    var draft = {
      name: name && !personal(name) ? name : null,
      pills: pills,
      timings: timings,
      caution: aiText(obj.caution, 300),
      contraindication: aiText(obj.contraindication, 300),
      unsupported: AI_UNSUPPORTED.indexOf(obj.unsupported) !== -1 ? obj.unsupported : null,
      unsure: []
    };
    if (!draft.name && pills === null && timings.length === 0 && !draft.unsupported) return { ok: false, reason: 'unreadable' };
    return { ok: true, draft: draft, missing: missingOf(draft) };
  }

  return {
    normalize: normalize,
    parseLabel: parseLabel,
    parseAIText: parseAIText,
    fromAI: fromAI
  };
});
