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
  var SLOT_WORDS = [
    { slot: 'morning', re: /เชา/ },
    { slot: 'noon', re: /กลางวน|เทยง/ },
    { slot: 'evening', re: /เยน/ }
  ];
  /** คำบอกเวลา: ก่อนอาหาร / หลังอาหาร / ก่อนนอน — ใช้แบ่งข้อความเป็นช่วง ๆ */
  var TIMING_RE = /กอนอาหาร|หลงอาหาร|กอนนอน/g;
  var PILL_UNIT = '(?:เมด|แคปซล)';
  /** BR-07: ยาที่ MVP ไม่รองรับ */
  var UNSUPPORTED_RE = {
    prn: /เมอมอาการ|เวลามอาการ|เมอปวด|เวลาปวด|เมอมไข|เวลามไข|เมอจำเปน|prn/,
    liquid: /ยานำ|ชอนชา|ชอนโตะ|\dซซ|\d(?:ml|มล\.?|มลลลตร)|เขยาขวด/,
    half: /ครงเมด|1\/2เมด|½/
  };
  /** บรรทัดที่เป็นข้อมูลผู้ป่วย/สถานพยาบาล — ห้ามดึงไปเป็นชื่อยาหรือข้อควรระวัง (NFR-09) · เทียบบนโครง */
  var PERSONAL_RE = /\bhn\b|\bvn\b|hn\s*[:\d]|พยาบาล|hospital|คลนก|รานยา|ชอ-?สกล|ผปวย|นาย|นาง|น\.ส\.|นพ\.|พญ\.|วนท|date|โทร|tel|เลขท|\d-\d{4}-\d{4}/i;
  var NAME_STOPWORDS = /^(TAB|TABS|TABLET|TABLETS|CAP|CAPS|CAPSULE|CAPSULES|HOSPITAL|PHARMACY|CLINIC|MG|MCG|GPO)$/i;
  var STRENGTH = '\\d+(?:\\.\\d+)?\\s*(?:mg|mcg|g|iu|มก\\.?|มลลกรม)(?![a-z])';

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
    var n = NUMBER_WORDS[word] || Number(word);
    return n >= 1 ? n : null;
  }

  /** "ครั้งละ 1 เม็ด" / "ครั้งละหนึ่งแคปซูล" → 1 · ไม่เจอ → null */
  function findPills(all) {
    var m = new RegExp('(?:ครงละ|รบประทาน|กน)(\\d{1,2}|หนง|สอง|สาม)' + PILL_UNIT).exec(all);
    return m ? toCount(m[1]) : null;
  }

  /** จำนวนเม็ดตัวสุดท้ายในช่วงข้อความ ("และ 1 เม็ด หลังอาหารเย็น") */
  function lastCount(text) {
    var re = new RegExp('(\\d{1,2}|หนง|สอง|สาม)' + PILL_UNIT, 'g');
    var m;
    var last = null;
    while ((m = re.exec(text)) !== null) last = toCount(m[1]);
    return last;
  }

  function slotsIn(text) {
    return SLOT_WORDS.filter(function (w) { return w.re.test(text); }).map(function (w) { return w.slot; });
  }

  /** "ก่อนอาหาร 30 นาที" → 30 · "ครึ่งชั่วโมง" → 30 · "1 ชั่วโมง" → 60 · ไม่ระบุ → null (FR-02 ✗10) */
  function minutesIn(text) {
    var m = /(\d{1,3})นาท/.exec(text);
    if (m) return Number(m[1]) || null;
    if (/ครงชวโมง/.test(text)) return 30;
    m = /(\d)ชวโมง/.exec(text);
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
    while ((m = TIMING_RE.exec(all)) !== null) hits.push({ word: m[0], start: m.index, end: m.index + m[0].length });
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
        if (/^[-–]/.test(all.slice(hit.end))) return; // ตารางข้างฉลาก "ก่อนนอน -" = ไม่มียามื้อนี้
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

  /**
   * ชื่อยา: บรรทัด "ชื่อยา: …" ก่อน
   * → บรรทัดที่มีความแรงยา (500 mg / 500 มก.) ตัดถึงหน่วย · บรรทัดนั้นไม่มีชื่อ ("500 MG/1 TABLET") → ต่อชื่อจากบรรทัดก่อน
   * → บรรทัดภาษาอังกฤษที่ตามด้วย Tab/Cap ("Vitamin B1-6-12 Tab") → ส่วนก่อน Tab
   * → คำอังกฤษตัวใหญ่ล้วน · ไม่มีเลย = null (กรุณาตรวจสอบ)
   */
  function findName(lines) {
    var i, m;
    for (i = 0; i < lines.length; i++) {
      var sm = skelMap(lines[i]);
      m = /ชอยา\s*[:：]?\s*/.exec(sm.skel);
      if (m) {
        var v = cleanValue(lines[i].slice(sm.map[m.index + m[0].length])) || (lines[i + 1] ? cleanValue(lines[i + 1]) : '');
        if (v) return v;
      }
    }
    var usable = lines.filter(function (line) { return !personal(line); });
    var strength = new RegExp('^(.*?' + STRENGTH + ')', 'i');
    for (i = 0; i < lines.length; i++) {
      if (personal(lines[i])) continue;
      m = strength.exec(skeleton(lines[i]).replace(/มก(?!\.)/, 'มก.'));
      if (!m || !/[A-Za-z]{2,}/.test(lines[i])) continue;
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
    for (i = 0; i < usable.length; i++) {
      var words = usable[i].split(/\s+/).filter(function (w) { return /^[A-Z][A-Z-]{4,}$/.test(w) && !NAME_STOPWORDS.test(w); });
      if (words.length) return words.join(' ');
    }
    return null;
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
   * missing = ช่องบังคับที่หาไม่เจอ → หน้าจอแสดง "กรุณาตรวจสอบ" (FR-02 ✗3, ✗10)
   */
  function parseLabel(raw) {
    var lines = normalize(raw);
    var all = compact(skeleton(lines.join('')));
    var pills = findPills(all);
    var draft = {
      name: findName(lines),
      pills: pills,
      timings: findTimings(all, pills),
      caution: '',
      contraindication: '',
      unsupported: findUnsupported(all)
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
      unsupported: AI_UNSUPPORTED.indexOf(obj.unsupported) !== -1 ? obj.unsupported : null
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
