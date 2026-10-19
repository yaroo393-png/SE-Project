/*
 * scanner.js — อ่านตัวหนังสือจากรูปฉลากยาในเบราว์เซอร์ด้วย Tesseract.js (ไทย + อังกฤษ) ไม่ส่งรูปออกนอกเครื่อง
 *
 * Covers: FR-02 (ส่งรูป → ข้อความ) · ผลไปต่อที่ labelParser.parseLabel() → Caregiver ตรวจทุกช่องก่อนบันทึก (BR-04)
 * ครั้งแรกต้องต่ออินเทอร์เน็ตเพื่อโหลดตัวอ่าน (~ 3–5 MB) จาก jsDelivr — ครั้งต่อไปเบราว์เซอร์เก็บไว้ใน cache
 * NFR-09: รูปและข้อความดิบอยู่ในหน่วยความจำระหว่างอ่านเท่านั้น ไม่บันทึกลง localStorage
 */
(function (root) {
  'use strict';

  // เปลี่ยนที่โหลดไฟล์ได้ด้วย MedMind.scannerOptions = { libraryUrl, workerOptions, loadLangs } (เช่น เก็บไฟล์ไว้ในเว็บเอง ไม่พึ่ง CDN)
  var options = (root.MedMind && root.MedMind.scannerOptions) || {};
  var TESSERACT_URL = options.libraryUrl || 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  var LANGS = ['tha', 'eng'];
  var MAX_SIDE = 2000;
  var MIN_SIDE = 1400;
  var TIMEOUT_MS = 120000;

  var libPromise = null;
  var workerPromise = null;
  var onProgress = function () {};

  function loadLibrary() {
    if (root.Tesseract) return Promise.resolve(root.Tesseract);
    if (!libPromise) {
      libPromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = TESSERACT_URL;
        s.onload = function () { resolve(root.Tesseract); };
        s.onerror = function () {
          libPromise = null;
          reject(new Error('โหลดตัวอ่านฉลากไม่ได้ — ตรวจการเชื่อมต่ออินเทอร์เน็ต'));
        };
        document.head.appendChild(s);
      });
    }
    return libPromise;
  }

  function getWorker() {
    if (!workerPromise) {
      // options.loadLangs() = เตรียมไฟล์ภาษาเอง (เช่น ใส่ cache ไว้ก่อน) แล้วคืนรายการภาษา
      var langs = options.loadLangs ? options.loadLangs() : Promise.resolve(LANGS);
      workerPromise = Promise.all([loadLibrary(), langs]).then(function (both) {
        return both[0].createWorker(both[1], 1, Object.assign({
          logger: function (m) { onProgress(m.status, m.progress || 0); }
        }, options.workerOptions));
      });
      workerPromise.catch(function () { workerPromise = null; });
    }
    return workerPromise;
  }

  /**
   * ย่อ/ขยายรูปให้พอดี → { color, ocr } ขนาดเท่ากัน (พิกัดตรงกัน)
   * color = รูปสีสำหรับส่งให้ AI (หลังปิดข้อมูลส่วนตัว) · ocr = ขาวดำ + เพิ่ม contrast ให้ OCR อ่านง่ายขึ้น
   */
  function prepare(file) {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (bmp) {
      var longest = Math.max(bmp.width, bmp.height);
      var scale = longest > MAX_SIDE ? MAX_SIDE / longest : longest < MIN_SIDE ? MIN_SIDE / longest : 1;
      var w = Math.round(bmp.width * scale);
      var h = Math.round(bmp.height * scale);
      var color = document.createElement('canvas');
      color.width = w;
      color.height = h;
      color.getContext('2d').drawImage(bmp, 0, 0, w, h);
      bmp.close();
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(color, 0, 0);
      var img = ctx.getImageData(0, 0, w, h);
      var d = img.data;
      var lo = 255;
      var hi = 0;
      var i, g;
      for (i = 0; i < d.length; i += 4) {
        g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = g;
        if (g < lo) lo = g;
        if (g > hi) hi = g;
      }
      var range = Math.max(1, hi - lo);
      for (i = 0; i < d.length; i += 4) {
        g = ((d[i] - lo) * 255) / range;
        d[i] = d[i + 1] = d[i + 2] = g;
      }
      ctx.putImageData(img, 0, 0);
      return { color: color, ocr: canvas };
    });
  }

  /** บรรทัดพร้อมกรอบตำแหน่ง จากผลของ Tesseract (blocks → paragraphs → lines → words) */
  function linesOf(data) {
    var out = [];
    (data.blocks || []).forEach(function (b) {
      (b.paragraphs || []).forEach(function (p) {
        (p.lines || []).forEach(function (l) {
          out.push({
            text: l.text || '', confidence: Math.round(l.confidence || 0),
            bbox: l.bbox,
            words: (l.words || []).map(function (w) { return { text: w.text || '', bbox: w.bbox }; })
          });
        });
      });
    });
    return out;
  }

  function run(file, progress) {
    var started = Date.now();
    onProgress = function (status, value) {
      var label = status === 'recognizing text' ? 'กำลังอ่านฉลาก' : 'กำลังเตรียมตัวอ่าน (ครั้งแรกใช้เวลานานกว่า)';
      if (progress) progress(label, value);
    };
    var job = Promise.all([getWorker(), prepare(file)]).then(function (both) {
      var images = both[1];
      return both[0].recognize(images.ocr).then(function (res) {
        images.ocr.width = images.ocr.height = 0;
        return { text: res.data.text || '', lines: linesOf(res.data), color: images.color, ms: Date.now() - started };
      });
    });
    var timeout = new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error('อ่านฉลากนานเกินไป')); }, TIMEOUT_MS);
    });
    return Promise.race([job, timeout]);
  }

  /**
   * รูป → { text, ms } · progress(ข้อความ, 0–1) ใช้แสดงแถบความคืบหน้า
   * ms = เวลาตั้งแต่ส่งรูปจนได้ข้อความ (ใช้วัด NFR-08)
   */
  function readLabel(file, progress) {
    return run(file, progress).then(function (res) {
      res.color.width = res.color.height = 0;
      return { text: res.text, ms: res.ms };
    });
  }

  /**
   * สำหรับส่งให้ AI: อ่านในเครื่องก่อนเพื่อรู้ตำแหน่งข้อความ → { text, lines, color (canvas สี), ms }
   * รูปยังไม่ออกจากเครื่องในขั้นนี้
   */
  function readLayout(file, progress) {
    return run(file, progress);
  }

  root.MedMind = root.MedMind || {};
  root.MedMind.scanner = { readLabel: readLabel, readLayout: readLayout, TESSERACT_URL: TESSERACT_URL };
})(self);
