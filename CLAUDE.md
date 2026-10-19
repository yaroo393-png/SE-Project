# CLAUDE.md — MedMind (SE-Project)

กติกาทีมและการใช้ AI อยู่ใน RULES.md — ทำตามทุกข้อ:
@RULES.md

## ภาษา
- ตอบผู้ใช้เป็นภาษาไทย · คอมเมนต์ในโค้ดและเอกสาร `.md` เขียนภาษาไทยตามไฟล์เดิม

## ก่อนเริ่มงานทุกครั้ง
1. ถามว่าผู้ใช้คือสมาชิกคนไหน แล้วดูตาราง "ทีมและการแบ่งงาน" ใน README.md — แก้เฉพาะไฟล์ของคนนั้น
2. ระบุ FR / AC / BR / NFR ที่งานเกี่ยวข้อง (จาก `docs/02-requirements/spec.md`) ถ้าหาไม่เจอให้ถามก่อน อย่าเดา requirement
3. เสนอแผนสั้น ๆ (เป้าหมาย, ไฟล์ที่จะแก้, วิธีทดสอบ) แล้วรออนุมัติ
4. ผู้ใช้ต้องอธิบายโค้ดให้อาจารย์ได้เอง — เขียนให้อ่านง่าย และอธิบายสิ่งที่เขียนให้เข้าใจทุกส่วน

## คำสั่ง (Windows PowerShell ใช้ `npm.cmd`)
- `npm test` — unit test ใน `prototype/tests/` (ไม่ต้อง install) · รันก่อนบอกว่างานเสร็จทุกครั้ง
- `npm run lint` · `npm run check` (test + lint + ตรวจความลับ) — ต้อง `npm install` ก่อนครั้งแรก
- เปิด prototype: เปิดไฟล์ `prototype/MedMind-Responsive/index.html` (ผู้สูงอายุ) และ `caregiver.html` (ผู้ดูแล) ในเบราว์เซอร์ — ไม่มี server

## โครงโค้ด
- prototype = HTML/CSS/JavaScript ล้วน ไม่มี build ไม่มี framework **ไม่มี server / ฐานข้อมูล** (เกณฑ์อาจารย์) — ข้อมูลอยู่ใน `localStorage` ผ่าน `prototype/js/core/store.js`
- `prototype/js/logic/` — ตรรกะล้วน ห้ามแตะ DOM / Date.now() · รูปแบบ UMD เหมือน `reminder.js` (ใช้ได้ทั้ง `<script>` และ `require` ในเทสต์) · ฟังก์ชันใหม่ต้องมีเทสต์ใน `prototype/tests/<ชื่อไฟล์>.test.js`
- `prototype/js/services/` — ต่อ API ของเบราว์เซอร์ / ไลบรารีจาก CDN (เช่น Tesseract.js) · `prototype/js/features/` — หน้าจอ/การทำงานของแต่ละฟีเจอร์
- ทุกไฟล์ผูกกับ `self.MedMind.<ชื่อ>` · หัวไฟล์บอกว่าไฟล์ทำอะไร, Covers: FR / BR / NFR ไหน และผู้รับผิดชอบ
- ไฟล์ใหม่ต้องเพิ่ม `<script>` ในหน้า HTML ตามลำดับ: `logic/` → `core/` → `services/` → `features/`
- ทุกหน้าจอมีป้าย "Covers: FR-xx" · ข้อความจากผู้ใช้ต้อง escape ก่อนใส่ HTML · ขนาด/contrast ตาม NFR-03

## ห้าม
- ห้าม commit / push / เปิด PR เองถ้าผู้ใช้ไม่ได้สั่งในข้อความนั้น
- ห้ามเพิ่ม server, ฐานข้อมูล หรือบริการที่ต้องมีบัญชี/รหัสลับเข้า prototype
- ห้ามใส่ความลับ และห้ามเปิด / ใส่รูปฉลากยาจริงที่มีชื่อ / HN ผู้ป่วยใน repo
- ห้ามแก้ requirement ในโค้ดให้ต่างจาก `spec.md` — ถ้าเห็นว่าต้องเปลี่ยน ให้เสนอผู้ใช้ไปแก้ spec ก่อน

## หลังทำงานเสร็จ
- บันทึกการใช้ AI รอบนี้ลง `docs/02-requirements/spec.md` §8 ตามรูปแบบตาราง — เขียนตามจริง รวมสิ่งที่ผู้ใช้ตรวจ / แก้
- อัปเดตเอกสารตาม RULES.md §5
