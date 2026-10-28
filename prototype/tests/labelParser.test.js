/*
 * เทสต์ของ labelParser.js — ข้อความ OCR จากฉลาก → ร่าง · AC ของ FR-02 (ข้อ 1, 3, 4, 5, 10), BR-04, BR-06, BR-07, NFR-09
 * รัน: npm test
 * ข้อความตัวอย่างเลียนแบบผล OCR จริง: มีช่องว่างแทรกระหว่างอักษรไทย, เลขไทย, "ํา" แยกตัว
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLabel, normalize, parseAIText, fromAI } = require('../js/logic/labelParser.js');
// medication.js (FR-02 จัดการยา) เป็นงานของอีกคน — ถ้ายังไม่มีไฟล์ ข้ามเฉพาะการตรวจร่างด้วย validateDraft
// เมื่อเพิ่ม prototype/js/logic/medication.js แล้ว การตรวจเหล่านี้จะทำงานเอง (ร่างจาก labelParser ต้องผ่านกฎของฟอร์มบันทึกยา)
let medication = null;
try { medication = require('../js/logic/medication.js'); } catch { /* ยังไม่มี medication.js */ }
function draftCheck(draft) {
  return medication ? medication.validateDraft(draft) : null;
}

const CLEAR_LABEL = `
โรงพยาบาลแม่ฟ้าหลวง
HN 1234567   วันที่ 17/10/69
ชื่อ-สกุล นางสมพร ใจดี
AMLODIPINE 5 MG TAB
รับประทานครั้งละ 1 เม็ด วันละ 1 ครั้ง
หลังอาหาร เช้า
คำเตือน: อาจทำให้เวียนศีรษะ
ข้อห้ามใช้: แพ้ยานี้
`;

test('normalize: ตัดช่องว่างระหว่างอักษรไทย, เลขไทย → อารบิก, "ํา" → "ำ"', () => {
  assert.deepEqual(normalize('ครั้ง ละ ๑ เม็ด\nค ํา เตือน'), ['ครั้งละ 1 เม็ด', 'คำเตือน']);
});

test('FR-02 ✓1: ฉลากชัด → ร่างครบ (ชื่อยา, จำนวนเม็ด, มื้อ, ข้อควรระวัง, ข้อห้ามใช้)', () => {
  const r = parseLabel(CLEAR_LABEL);
  assert.equal(r.ok, true);
  assert.equal(r.draft.name, 'AMLODIPINE 5 MG');
  assert.equal(r.draft.pills, 1);
  assert.deepEqual(r.draft.timings, [{ type: 'after', slot: 'morning', minutesBefore: null }]);
  assert.equal(r.draft.caution, 'อาจทำให้เวียนศีรษะ');
  assert.equal(r.draft.contraindication, 'แพ้ยานี้');
  assert.deepEqual(r.missing, []);
  if (medication) assert.equal(draftCheck(r.draft).ok, true);
});

test('NFR-09: ไม่ดึงชื่อผู้ป่วย / HN / ชื่อโรงพยาบาล และไม่คืนข้อความดิบ', () => {
  const r = parseLabel(CLEAR_LABEL);
  const out = JSON.stringify(r);
  for (const secret of ['สมพร', '1234567', 'แม่ฟ้าหลวง', '17/10/69']) assert.ok(!out.includes(secret), secret);
});

test('OCR แทรกช่องว่าง + เลขไทย ก็ยังอ่านได้', () => {
  const r = parseLabel('METFORMIN 500 MG\nรับ ประ ทาน ครั้ง ละ ๒ เม็ด\nหลัง อาหาร เช้า - เย็น');
  assert.equal(r.draft.pills, 2);
  assert.deepEqual(r.draft.timings.map((t) => t.slot), ['morning', 'evening']);
});

test('BR-06: ก่อนอาหารเช้า 30 นาที → before/morning/30', () => {
  const r = parseLabel('OMEPRAZOLE 20 MG CAP\nครั้งละ 1 แคปซูล\nก่อนอาหารเช้า 30 นาที');
  assert.deepEqual(r.draft.timings, [{ type: 'before', slot: 'morning', minutesBefore: 30 }]);
  assert.equal(r.draft.pills, 1);
});

test('BR-06: "ก่อนอาหาร ครึ่งชั่วโมง เช้า เย็น" → 30 นาที ทั้ง 2 มื้อ', () => {
  const r = parseLabel('GLIPIZIDE 5 MG\nครั้งละ 1 เม็ด ก่อนอาหาร ครึ่งชั่วโมง เช้า เย็น');
  assert.deepEqual(r.draft.timings, [
    { type: 'before', slot: 'morning', minutesBefore: 30 },
    { type: 'before', slot: 'evening', minutesBefore: 30 }
  ]);
});

test('BR-06: หลังอาหาร เช้า กลางวัน เย็น และก่อนนอน → 4 มื้อ', () => {
  const r = parseLabel('VITAMIN B 1-6-12\nครั้งละ 1 เม็ด หลังอาหาร เช้า กลางวัน เย็น และก่อนนอน');
  assert.deepEqual(r.draft.timings.map((t) => t.type + ':' + t.slot), ['after:morning', 'after:noon', 'after:evening', 'bedtime:null']);
});

test('BR-06: ฉลากเขียนมื้อไว้ก่อนคำ ("เช้า-เย็น หลังอาหาร")', () => {
  const r = parseLabel('ครั้งละ 1 เม็ด วันละ 2 ครั้ง เช้า-เย็น หลังอาหาร');
  assert.deepEqual(r.draft.timings.map((t) => t.slot), ['morning', 'evening']);
});

test('BR-06: มื้อของคำก่อนหน้าไม่ถูกนับซ้ำให้คำถัดไป', () => {
  const r = parseLabel('หลังอาหารเช้า\nและก่อนอาหาร 15 นาที');
  assert.deepEqual(r.draft.timings, [
    { type: 'after', slot: 'morning', minutesBefore: null },
    { type: 'before', slot: null, minutesBefore: 15 }
  ]);
  assert.ok(r.missing.includes('timing.1.slot'));
});

test('FR-02 ✗10: "ก่อนอาหาร" ไม่ระบุนาที → minutesBefore = null + กรุณาตรวจสอบ (ไม่เดา)', () => {
  const r = parseLabel('GLICLAZIDE 80 MG\nครั้งละ 1 เม็ด ก่อนอาหารเช้า');
  assert.deepEqual(r.draft.timings, [{ type: 'before', slot: 'morning', minutesBefore: null }]);
  assert.deepEqual(r.missing, ['timing.0.minutesBefore']);
  if (medication) assert.equal(draftCheck(r.draft).ok, false);
});

test('BR-06: "วันละ 3 ครั้ง หลังอาหาร" ไม่บอกมื้อ → ไม่เดามื้อให้', () => {
  const r = parseLabel('SIMVASTATIN 20 MG\nครั้งละ 1 เม็ด วันละ 3 ครั้ง หลังอาหาร');
  assert.deepEqual(r.draft.timings, [{ type: 'after', slot: null, minutesBefore: null }]);
  assert.ok(r.missing.includes('timing.0.slot'));
});

test('FR-02 ✗3: อ่านชื่อยา/จำนวนเม็ดไม่ได้ → ช่องว่าง + อยู่ใน missing', () => {
  const r = parseLabel('ร บ ป ร ะ … เม็ด\nหลังอาหาร เย็น');
  assert.equal(r.ok, true);
  assert.equal(r.draft.name, null);
  assert.equal(r.draft.pills, null);
  assert.deepEqual(r.missing, ['name', 'pills']);
});

test('ชื่อยาจากบรรทัด "ชื่อยา:" มาก่อน และรองรับคำบอกจำนวนเป็นตัวหนังสือ', () => {
  const r = parseLabel('ชื่อยา: ยาลดความดัน Losartan\nครั้งละหนึ่งเม็ด หลังอาหารเช้า');
  assert.equal(r.draft.name, 'ยาลดความดัน Losartan');
  assert.equal(r.draft.pills, 1);
});

test('FR-02 ✗4 / BR-07: ยาเมื่อมีอาการ → unsupported = prn', () => {
  const r = parseLabel('PARACETAMOL 500 MG\nครั้งละ 1-2 เม็ด ทุก 4-6 ชั่วโมง เวลาปวด หรือมีไข้');
  assert.equal(r.draft.unsupported, 'prn');
  if (medication) assert.equal(draftCheck(r.draft).errors.unsupported, 'ระบบยังไม่รองรับยาเมื่อมีอาการ');
});

test('BR-07: ยาน้ำ / ครึ่งเม็ด → unsupported', () => {
  assert.equal(parseLabel('ยาน้ำแก้ไอ\nครั้งละ 1 ช้อนชา หลังอาหาร เช้า').draft.unsupported, 'liquid');
  assert.equal(parseLabel('WARFARIN 3 MG\nครั้งละ ครึ่งเม็ด ก่อนนอน').draft.unsupported, 'half');
});

test('FR-02 ✗5: อ่านอะไรไม่ได้เลย → unreadable (หน้าจอเปิดฟอร์มว่าง)', () => {
  assert.deepEqual(parseLabel(''), { ok: false, reason: 'unreadable' });
  assert.deepEqual(parseLabel('~~ ## ..\n  ;;'), { ok: false, reason: 'unreadable' });
});

test('ข้อความเตือนบนสติกเกอร์ ("ยานี้อาจทำให้ง่วงซึม", "ห้ามดื่มสุรา") ถูกเก็บเป็นข้อควรระวัง/ข้อห้าม', () => {
  const r = parseLabel('CHLORPHENIRAMINE 4 MG\nครั้งละ 1 เม็ด ก่อนนอน\nยานี้อาจทำให้ง่วงซึม\nห้ามดื่มสุรา');
  assert.equal(r.draft.caution, 'ยานี้อาจทำให้ง่วงซึม');
  assert.equal(r.draft.contraindication, 'ห้ามดื่มสุรา');
});

// ---------- ข้อความ OCR จากรูปถ่ายจริง (วรรณยุกต์/สระบนล่างหาย, ข้อมูลผู้ป่วยเปลี่ยนเป็นค่าสมมติ) ----------

test('OCR จริง: วรรณยุกต์หาย ("เมด", "หลงอาหารเชา") ก็ยังอ่านจำนวนเม็ดและมื้อได้', () => {
  const r = parseLabel('AMLODIPINE 5 MG\nรบประทานครงละ 1 เมด\nหลงอาหาร เชา');
  assert.equal(r.draft.pills, 1);
  assert.deepEqual(r.draft.timings, [{ type: 'after', slot: 'morning', minutesBefore: null }]);
});

test('OCR จริง (มือถือ): ชื่อยาตัดถึงความแรง และบรรทัดเศษอักษรไม่ถูกเก็บเป็นข้อห้ามใช้', () => {
  const r = parseLabel("ACETAMOL 500 มก. เมด ( 0\n' ห้าม Ln i LT 1d 8 เมดตอ i$ นเพ 9");
  // OCR อ่านได้แค่ท้ายชื่อ "ACETAMOL" → ตรงกับ PARACETAMOL ชื่อเดียวในรายการยา
  assert.equal(r.draft.name, 'PARACETAMOL 500 มก.');
  assert.equal(r.draft.contraindication, '');
});

test('OCR จริง: ยาเมื่อมีอาการที่วรรณยุกต์หาย ("เวลาปวด หรอมไข") → unsupported = prn', () => {
  const r = parseLabel('PARACETAMOL 500 มก.\nรบประทานครงละ 1 เมด ทก 4-6 ชวโมง เวลาปวด หรอมไข');
  assert.equal(r.draft.unsupported, 'prn');
});

test('ฉลากโรงพยาบาลแบบที่ 1: ชื่อยากับความแรงคนละบรรทัด + จำนวนเม็ดต่างกันต่อมื้อ', () => {
  const r = parseLabel([
    'โรงพยาบาลตัวอย่าง',
    'Example hospital โทร 042-000000',
    'นายสมมติ ทดสอบ HN0000000',
    'METFORMIN [GPO] วนท 22 กนยายน 2019',
    '500 MG/1 TABLET เวลา 14:25',
    'รบประทานครงละ 2 เมด',
    'หลงอาหารเชา และ',
    '1 เมด หลงอาหารเยน',
    'ลดนำตาลในเลอด Cat B # 300',
    'กอนนอน -'
  ].join('\n'));
  assert.equal(r.draft.name, 'METFORMIN [GPO] 500 MG');
  assert.equal(r.draft.pills, 2);
  assert.deepEqual(r.draft.timings, [
    { type: 'after', slot: 'morning', minutesBefore: null },
    { type: 'after', slot: 'evening', minutesBefore: null, pills: 1 }
  ]);
  assert.ok(!JSON.stringify(r).includes('สมมติ') && !JSON.stringify(r).includes('0000000'));
  if (medication) assert.equal(draftCheck(r.draft).ok, true);
});

test('ฉลากโรงพยาบาลแบบที่ 2: ชื่อยาไม่มีหน่วย mg ("Vitamin B1-6-12 Tab(…)") + มื้อขึ้นบรรทัดใหม่', () => {
  const r = parseLabel([
    'สถานพยาบาลบรษท ตวอยาง จำกด',
    'สนญ.0-2537-0000, ระยอง 0-3867-0000',
    '30-08-2016 10:46 AM HN : VN :',
    'นาย',
    'รบประทานครงละ 1 เมด วนละ 2 ครง หลงอาหาร เชา',
    'เยน',
    '( วตามน บ 1-6-12 )',
    'Vitamin B1-6-12 Tab(Tri-Be-Sian) 120 เมด',
    '2 - B - 5'
  ].join('\n'));
  assert.equal(r.draft.name, 'Vitamin B1-6-12');
  assert.equal(r.draft.pills, 1);
  assert.deepEqual(r.draft.timings.map((t) => t.slot), ['morning', 'evening']);
  assert.equal(r.draft.caution, '');
  if (medication) assert.equal(draftCheck(r.draft).ok, true);
});

// ---------- OCR อ่านเพี้ยนจากรูปถ่าย (ข้อความจากชุดทดสอบฉลากจำลอง — ชื่อ/HN สมมติ) ----------

test('ชื่อยาที่ OCR อ่านแตกเป็นหลายคำ → รวมกลับเป็นชื่อในรายการยา + บอกให้ผู้ดูแลตรวจ', () => {
  const a = parseLabel('AMLODIP INE        วันที่ 1 ต.ค. 2569\n5 MG/1 TABLET\nรับประทานครั้งละ 1 เม็ด หลังอาหารเช้า');
  assert.equal(a.draft.name, 'AMLODIPINE 5 MG');
  assert.deepEqual(a.draft.unsure, ['name']);
  // ตัว E ถูกอ่านเป็น "เ" ตรงกลางชื่อ
  assert.equal(parseLabel('PARAC เ TAMOL 500 MG\nรบประทานครั้งละ 1 เม็ด\nก่อนนอน').draft.name, 'PARACETAMOL 500 MG');
  assert.equal(parseLabel('ATORV ASTATIN 40 MG\nครั้งละ 1 เม็ด หลังอาหารเย็น').draft.name, 'ATORVASTATIN 40 MG');
});

test('ชื่อยาที่อ่านถูกอยู่แล้ว / ไม่อยู่ในรายการ → ใช้ตามที่อ่านได้ ไม่สลับเป็นชื่อใกล้เคียง', () => {
  const r = parseLabel('LOSARTAN 50 MG\nครั้งละ 1 เม็ด หลังอาหารเช้า');
  assert.equal(r.draft.name, 'LOSARTAN 50 MG'); // ไม่กลายเป็น VALSARTAN
  assert.deepEqual(r.draft.unsure, []);
  assert.equal(parseLabel('ZINC SULFATE 50 MG\nครั้งละ 1 เม็ด หลังอาหารเช้า').draft.name, 'ZINC SULFATE 50 MG');
});

test('ชื่อยาที่อ่านได้แค่ท้ายชื่อ (ขึ้นต้นตัวพิมพ์เล็ก) → เก็บไว้แต่บอกให้ตรวจ', () => {
  const r = parseLabel('azole 20 mg Tab\nครั้งละ 1 เม็ด ก่อนอาหารเช้า 30 นาที');
  assert.equal(r.draft.name, 'azole 20 mg');
  assert.deepEqual(r.draft.unsure, ['name']);
});

test('บรรทัด "ชื่อยา" ที่ OCR อ่านเป็น "สื่อยา" + หน่วย mg อ่านเป็น m8 → ยังได้ชื่อยา', () => {
  const r = parseLabel('สื่อยา: Chlorpheniramine 2 m8\nรับประทานครั้งละ 1 เม็ด ก่อนนอน');
  assert.equal(r.draft.name, 'Chlorpheniramine 2 mg');
});

test('ชื่อยาบรรทัดเดียวกับวันที่ ("VITAMIN B COMPLEX  วันที่ …") → ได้ชื่อ ไม่ทิ้งทั้งบรรทัด', () => {
  const r = parseLabel('นายสมมติ ทดสอบ HN0000000\nVITAMIN B COMPLEX    วันที่ 1 ต.ค. 2569\n1/1 TABLET\nรับประทานครั้งละ 1 เม็ด หลังอาหารเช้า');
  assert.equal(r.draft.name, 'VITAMIN B COMPLEX');
});

test('จำนวนเม็ด: "ครั้งละ | เม็ด" → 1 แต่ต้องตรวจ · ")" และ 12 เม็ด → ว่าง (ไม่เดา, BR-04)', () => {
  const bar = parseLabel('ATORVASTATIN 40 MG\nะบประทานครั้งละ | เม็ด วันละ 1 ครั้ง\nหลังอาหารเย็น');
  assert.equal(bar.draft.pills, 1);
  assert.deepEqual(bar.draft.unsure, ['pills']);
  // ")" เจอทั้งจากเลข 1 และ 2 ที่อ่านเพี้ยน
  assert.equal(parseLabel('LOSARTAN 50 MG\nชบประทานครั้งละ ) เม็ด วันละ 3 ครั้ง\nหลังอาหาร เช้า กลางวัน เย็น').draft.pills, null);
  // "1/2 เม็ด" ที่ OCR ทำ "/" หาย
  assert.equal(parseLabel('Aspirin 81 mg Tab\nรับประทานครั้งละ 12 เม็ด\nหลังอาหารเช้า').draft.pills, null);
});

test('BR-06: "ห้ามรับประทานก่อนนอน" เป็นข้อห้าม ไม่ใช่มื้อก่อนนอน', () => {
  const r = parseLabel('Furosemide 40 mg Tab\nรับประทานครั้งละ 1 เม็ด วันละ 1 ครั้ง\nหลังอาหารเช้า ห้ามรับประทานก่อนนอน');
  assert.deepEqual(r.draft.timings.map((t) => t.type + '/' + t.slot), ['after/morning']);
  // ข้อห้ามที่ไม่ได้ติดกับคำบอกเวลา → เวลากินยายังอยู่ครบ
  const chew = parseLabel('OMEPRAZOLE 20 MG\nรับประทานครั้งละ 1 เม็ด ห้ามเคี้ยว ก่อนอาหารเช้า 30 นาที');
  assert.deepEqual(chew.draft.timings.map((t) => t.type + '/' + t.slot + '/' + t.minutesBefore), ['before/morning/30']);
});

test('ตัวอักษรที่ OCR สับสน: "เข้า" = เช้า · "ซ้อนชา" = ยาน้ำ', () => {
  const r = parseLabel('METFORMIN 500 MG\nรับประทานครั้งละ 1 เม็ด\nก่อนอาหาร 15 นาทีเข้า กลางวัน เย็น');
  assert.deepEqual(r.draft.timings.map((t) => t.slot), ['morning', 'noon', 'evening']);
  assert.equal(parseLabel('สื่อยา: Chlorpheniramine 2 mg\nชุบประทานครั้งละ 1 ซ้อนชา วันละ 3 ครั้ง').draft.unsupported, 'liquid');
});

// ---------- ผลจาก AI (Gemini) — ไม่เชื่อทั้งหมด ตรวจรูปแบบก่อนเป็นร่าง ----------

// ตารางสีข้างฉลาก: OCR อ่านเป็นคอลัมน์ขวา ห่างจากข้อความวิธีใช้หลายช่องว่าง
const TABLE_LABEL = [
  'นายสมมติ ทดสอบ   HN0000000                    เช้า 2 เม็ด',
  'GLIPIZIDE [GPO]',
  '5 MG/1 TABLET                                เที่ยง -',
  'รับประทานหลังอาหาร                           เย็น 1 เม็ด',
  '# 30 เม็ด                                    ก่อนนอน -'
].join('\n');

test('ตารางข้างฉลาก: "หลังอาหาร" + ตาราง เช้า 2 / เที่ยง - / เย็น 1 / ก่อนนอน - → แยกรายมื้อ จำนวนเม็ดตามตาราง', () => {
  const r = parseLabel(TABLE_LABEL);
  assert.equal(r.draft.pills, 2);
  assert.deepEqual(r.draft.timings, [
    { type: 'after', slot: 'morning', minutesBefore: null },
    { type: 'after', slot: 'evening', minutesBefore: null, pills: 1 }
  ]);
  assert.deepEqual(r.draft.unsure, []);
  assert.deepEqual(r.missing, []);
});

test('ตารางข้างฉลาก: ก่อนอาหาร 30 นาที + ตาราง 1/1/1/- → ก่อนอาหาร 3 มื้อ · ตารางบอกก่อนนอนอย่างเดียว → ก่อนนอน', () => {
  const r = parseLabel([
    'OMEPRAZOLE 20 MG                         เช้า 1 เม็ด',
    'รับประทานครั้งละ 1 เม็ด                   เที่ยง 1 เม็ด',
    'ก่อนอาหาร 30 นาที                         เย็น 1 เม็ด',
    '# 30 เม็ด                                ก่อนนอน -'
  ].join('\n'));
  assert.deepEqual(r.draft.timings.map((t) => [t.type, t.slot, t.minutesBefore]), [
    ['before', 'morning', 30], ['before', 'noon', 30], ['before', 'evening', 30]
  ]);
  const bed = parseLabel('AMITRIPTYLINE 10 MG          เช้า -\nรับประทานครั้งละ 1 เม็ด       เที่ยง -\n# 30 เม็ด          เย็น -\n          ก่อนนอน 1 เม็ด');
  assert.deepEqual(bed.draft.timings, [{ type: 'bedtime', slot: null, minutesBefore: null }]);
  assert.equal(bed.draft.pills, 1);
});

test('ตารางข้างฉลาก BR-04/BR-06: อ่านตารางไม่ครบ หรือฉลากไม่บอกก่อน/หลังอาหาร → ไม่เดามื้อ', () => {
  // ช่อง "เย็น" อ่านค่าไม่ออก → ไม่แยกรายมื้อ (มื้อว่าง ขึ้นกรอบแดงให้ผู้ดูแลเลือก)
  const partial = parseLabel('METFORMIN 500 MG          เช้า 1 เม็ด\nรับประทานครั้งละ 1 เม็ด    เที่ยง -\nหลังอาหาร          เย็น ว do');
  assert.deepEqual(partial.draft.timings, [{ type: 'after', slot: null, minutesBefore: null }]);
  // ช่องตารางที่อ่านได้แค่หัว "ก่อนนอน" (ขีดหาย) ไม่ใช่วิธีใช้ "ก่อนนอน"
  const lostDash = parseLabel('METFORMIN 500 MG\nรับประทานครั้งละ 1 เม็ด\nหลังอาหาร                  | ก่อนนอน\n#30เม็ด');
  assert.deepEqual(lostDash.draft.timings, [{ type: 'after', slot: null, minutesBefore: null }]);
  // ไม่มีคำว่า ก่อน/หลังอาหาร → ตารางบอกได้แค่มื้อ ไม่รู้ชนิด → ไม่เติม
  const noType = parseLabel('LOSARTAN 50 MG          เช้า 1 เม็ด\nวันละ 2 ครั้ง ครั้งละ 1 เม็ด          เที่ยง -\n# 30 เม็ด          เย็น 1 เม็ด\n          ก่อนนอน -');
  assert.deepEqual(noType.draft.timings, []);
  assert.equal(noType.draft.pills, 1);
});

test('ตารางข้างฉลาก: "เช้า-เย็น" เป็นวิธีใช้ ไม่ใช่ช่อง "เช้า: ไม่มี" · ข้อความกับตารางบอกจำนวนไม่ตรงกัน → ต้องตรวจ', () => {
  const r = parseLabel('AMLODIPINE 10 MG\nรับประทานครั้งละ 1 เม็ด หลังอาหาร          เช้า-เย็น');
  assert.deepEqual(r.draft.timings.map((t) => t.slot), ['morning', 'evening']);
  const clash = parseLabel('GLIPIZIDE 5 MG          เช้า 2 เม็ด\nรับประทานครั้งละ 1 เม็ด หลังอาหาร          เที่ยง -\n          เย็น 2 เม็ด');
  assert.deepEqual(clash.draft.unsure, ['pills']);
});

test('วิธีใช้เรียงในบรรทัด "เช้า 1 เม็ด เย็น 2 เม็ด" → มื้อที่ไม่เขียน = ไม่กิน', () => {
  const r = parseLabel('METFORMIN 500 MG\nหลังอาหาร\nเช้า 1 เม็ด เย็น 2 เม็ด');
  assert.equal(r.draft.pills, 1);
  assert.deepEqual(r.draft.timings, [
    { type: 'after', slot: 'morning', minutesBefore: null },
    { type: 'after', slot: 'evening', minutesBefore: null, pills: 2 }
  ]);
});

test('จำนวนเม็ดไม่มีคำว่า "ครั้งละ": "ทาน 1 เม็ด" / "ทีละ 2 เม็ด" ได้เลย · "1 เม็ด วันละ 2 ครั้ง" ได้แต่ต้องตรวจ', () => {
  assert.deepEqual([parseLabel('SIMVASTATIN 40 MG\nทาน1เมด หลังอาหารเช้า').draft.pills, parseLabel('X 5 MG\nทีละ 2 เม็ด ก่อนนอน').draft.pills], [1, 2]);
  const r = parseLabel('AMLODIPINE 10 MG\n1เม็ด วันละ 2 ครั้ง\nหลังอาหาร เช้า-เย็น\n# 30เม็ด');
  assert.equal(r.draft.pills, 1);
  assert.deepEqual(r.draft.unsure, ['pills']);
});

test('จำนวนเม็ด BR-04: จำนวนที่จ่าย ("# 30 เม็ด", "จำนวน 6 เม็ด") และช่วง "1-2 เม็ด" ไม่ใช่จำนวนต่อครั้ง → ว่าง', () => {
  assert.equal(parseLabel('METFORMIN 500 MG\nหลังอาหารเช้า\nจำนวน 6 เม็ด').draft.pills, null);
  assert.equal(parseLabel('METFORMIN 500 MG\nหลังอาหารเช้า\n# 7 เม็ด').draft.pills, null);
  assert.equal(parseLabel('IBUPROFEN 400 MG\nครั้งละ 1-2 เม็ด หลังอาหารเช้า').draft.pills, null);
  // "# 30 เม็ด" หน้า "ก่อนนอน" ไม่ใช่จำนวนเม็ดของมื้อก่อนนอน
  const r = parseLabel('AMITRIPTYLINE 10 MG\nรับประทานครั้งละ 1 เม็ด\n#30เม็ด ก่อนนอน');
  assert.deepEqual(r.draft.timings, [{ type: 'bedtime', slot: null, minutesBefore: null }]);
});

test('มื้อ: "หลังอาหาร 3 เวลา" / "ทุกมื้อ" = เช้า กลางวัน เย็น · "วันละ 3 ครั้ง" อย่างเดียวไม่เติมมื้อ', () => {
  const slots = (text) => parseLabel('X 5 MG\nครั้งละ 1 เม็ด\n' + text).draft.timings.map((t) => t.slot);
  assert.deepEqual(slots('หลังอาหาร 3 เวลา'), ['morning', 'noon', 'evening']);
  assert.deepEqual(slots('ก่อนอาหาร 30 นาที ทุกมื้อ').length, 1); // "ทุกมื้อ" ไม่ติดคำบอกเวลา → ไม่เดา
  assert.deepEqual(slots('หลังอาหารทุกมื้อ'), ['morning', 'noon', 'evening']);
  assert.deepEqual(slots('วันละ 3 ครั้ง หลังอาหาร'), [null]);
});

test('นาทีแบบย่อ: "30 น." → 30 · "1 ชม." → 60 · เวลานาฬิกา "07.30 น." ไม่ใช่ 30 นาที', () => {
  const min = (text) => parseLabel('X 5 MG\nครั้งละ 1 เม็ด\n' + text).draft.timings[0].minutesBefore;
  assert.equal(min('ก่อนอาหารเช้า 30 น.'), 30);
  assert.equal(min('ก่อนอาหารเช้า 1 ชม.'), 60);
  assert.equal(min('ก่อนอาหารเช้า เวลา 07.30 น.'), null);
});

test('AI: ผลปกติ → ร่างเดียวกับ OCR (เช้า 2 เม็ด เย็น 1 เม็ด)', () => {
  const r = fromAI(parseAIText('```json\n{"name":"METFORMIN 500 MG","pills":2,"timings":[{"type":"after","slot":"morning","pills":2},{"type":"after","slot":"evening","pills":1}],"caution":null,"contraindication":null,"unsupported":null,"readable":true}\n```'));
  assert.equal(r.ok, true);
  assert.equal(r.draft.name, 'METFORMIN 500 MG');
  assert.deepEqual(r.draft.timings, [
    { type: 'after', slot: 'morning', minutesBefore: null },
    { type: 'after', slot: 'evening', minutesBefore: null, pills: 1 }
  ]);
  assert.deepEqual(r.missing, []);
  if (medication) assert.equal(draftCheck(r.draft).ok, true);
});

test('AI: ค่าแปลก/เดา ถูกทิ้งเป็น null → กรุณาตรวจสอบ (BR-04, BR-06)', () => {
  const r = fromAI({ name: 'X', pills: 0.5, timings: [{ type: 'before', slot: 'brunch', minutesBefore: 'สักพัก' }, { type: 'sometimes' }], unsupported: 'maybe' });
  assert.equal(r.draft.pills, null);
  assert.deepEqual(r.draft.timings, [{ type: 'before', slot: null, minutesBefore: null }]);
  assert.equal(r.draft.unsupported, null);
  assert.deepEqual(r.missing, ['pills', 'timing.0.slot', 'timing.0.minutesBefore']);
});

test('AI + NFR-09: ตัด HN / เบอร์โทรที่หลุดมา และไม่รับชื่อผู้ป่วยเป็นชื่อยา', () => {
  const r = fromAI({ name: 'นายสมมติ ทดสอบ', pills: 1, timings: [{ type: 'bedtime' }], caution: 'อาจทำให้ง่วง HN 1234567 โทร 042-572205' });
  assert.equal(r.draft.name, null);
  assert.equal(r.draft.caution, 'อาจทำให้ง่วง โทร');
});

test('AI: ยาเมื่อมีอาการ → unsupported = prn · อ่านไม่ได้ / ไม่ใช่ JSON → unreadable', () => {
  assert.equal(fromAI({ name: 'PARACETAMOL 500 MG', pills: 1, timings: [], unsupported: 'prn' }).draft.unsupported, 'prn');
  assert.deepEqual(fromAI({ readable: false }), { ok: false, reason: 'unreadable' });
  assert.equal(parseAIText('ขออภัย อ่านไม่ได้'), null);
  assert.deepEqual(fromAI(null), { ok: false, reason: 'unreadable' });
});

test('AI: ให้จำนวนเม็ดแค่รายมื้อ (pills = null) → ใช้มื้อแรกเป็นค่าหลัก มื้อที่ต่างเก็บแยก', () => {
  const r = fromAI({ name: 'METFORMIN 500 MG', pills: null, timings: [{ type: 'after', slot: 'morning', pills: 2 }, { type: 'after', slot: 'evening', pills: 1 }] });
  assert.equal(r.draft.pills, 2);
  assert.deepEqual(r.draft.timings.map((t) => t.pills), [undefined, 1]);
  assert.deepEqual(r.missing, []);
});
