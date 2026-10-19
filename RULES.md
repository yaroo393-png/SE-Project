# RULES.md — กติกาการทำงานของทีม MedMind (คน + AI)

> อ่านก่อนเริ่มงานทุกครั้ง · ข้อ 2–4 ขยายจากกติกาใน Charter §9 ที่ทุกคนรับทราบแล้ว
> เกณฑ์ที่อาจารย์ใช้: คะแนนรายคนวัดจาก GitHub (commit / PR / issue ที่มีความหมาย) · ทุกคนต้องอธิบายงานของตัวเองได้ (oral exam)

---

## 1. ใครทำอะไร

- แต่ละคนเป็นเจ้าของฟีเจอร์ตามตาราง **ทีมและการแบ่งงาน** ใน [`README.md`](README.md) — เขียนเองครบสาย: ตรรกะใน `prototype/js/logic/` + เทสต์ใน `prototype/tests/` → หน้าจอใน `prototype/js/features/` → scenario ทดสอบใน Final Report §6
- แก้เฉพาะไฟล์ของตัวเอง · ไฟล์ส่วนรวม (`index.html`, `caregiver.html`, `styles.css`, `js/core/`, `package.json`, `.github/`) แก้ได้ แต่ต้องบอกในทีมและเขียนไว้ใน PR
- ใช้ข้อมูลร่วมผ่าน `prototype/js/core/store.js` (ชื่อ key ใน localStorage + เวลามื้อ) — ถ้าจะเพิ่ม/เปลี่ยน key หรือรูปข้อมูล ให้แก้ที่ไฟล์นั้นไฟล์เดียวและบอกทีม

## 2. Git และ Pull Request

1. 1 งาน = 1 Issue · หัวข้อระบุ FR/AC เช่น `FR-03: เตือนซ้ำ T+5, T+10`
2. แตก branch จาก `main` ทุกครั้ง ตั้งชื่อ `feat/<fr>-<เรื่อง>` เช่น `feat/fr03-repeat` · ห้าม push ตรงเข้า `main`
3. commit ด้วยบัญชี GitHub ของตัวเอง ข้อความบอกว่าทำอะไร เช่น `เตือนซ้ำ T+5 (FR-03 ✓2)`
4. เปิด PR ตาม template → ให้**อีก 1 คน**รีวิว → CI ผ่าน → merge
5. รัน `npm run check` ให้ผ่านก่อน push ทุกครั้ง (หรืออย่างน้อย `npm test`)

## 3. ความปลอดภัยและข้อมูลส่วนตัว

- ห้าม commit: `.env`, service account (`.json` ที่มี `private_key`), token ใด ๆ — CI ตรวจให้ทุก PR (`npm run check:secrets`)
- **รูปฉลากยาจริงมีชื่อ/HN ผู้ป่วย** — ใช้ทดสอบในเครื่องเท่านั้น เก็บในโฟลเดอร์ `private/` (ถูก ignore) ห้ามใส่ใน repo, Issue หรือ PR · ถ้าต้องมีตัวอย่าง ใช้ฉลากตัวอย่างใน `js/features/scan.js` (ชื่อ/HN สมมติ)
- prototype เก็บข้อมูลใน `localStorage` ของเบราว์เซอร์เท่านั้น ไม่ส่งข้อมูลยาออกนอกเครื่อง (NFR-09)
- ข้อความที่ผู้ใช้พิมพ์ต้อง escape ก่อนใส่ HTML ทุกครั้ง (ใช้ฟังก์ชัน `esc` / `escapeHtml`)

## 4. การใช้ AI

- ใช้ AI ช่วยได้ (อธิบายโค้ด, หาบั๊ก, ร่างเทสต์) แต่**ต้องอธิบายโค้ดที่ตัวเอง commit ได้ทุกบรรทัด**
- **ทุกครั้งที่ใช้ AI ช่วยงาน ต้องบันทึกตามจริง**ใน [`docs/02-requirements/spec.md`](docs/02-requirements/spec.md) §8 (วันที่, เครื่องมือ, ขออะไร, AI ทำอะไร, เราแก้/ตรวจอะไร, ได้เรียนรู้อะไร) — ไม่มี log ตามจริง = milestone นั้นได้ **0%** · สรุปรวมอยู่ที่ [`docs/05-report/ai-use-statement.md`](docs/05-report/ai-use-statement.md)
- ถ้าให้ AI agent ทำงานใน repo (เช่น Claude Code — อ่าน [`CLAUDE.md`](CLAUDE.md) เอง) agent ต้อง:
  - ถามก่อนเมื่อข้อมูลไม่ครบ หรือเรื่องกระทบความปลอดภัย / ข้อมูลผู้ป่วย
  - เสนอแผนสั้น ๆ (เป้าหมาย, ไฟล์ที่จะแก้, วิธีทดสอบ) แล้วรอเจ้าของงานอนุมัติก่อนลงมือ
  - แก้เฉพาะไฟล์ของเจ้าของงานคนนั้น และไม่ commit / push เองถ้าไม่ได้รับคำสั่ง

## 5. เมื่อเปลี่ยนอะไร ต้องอัปเดตไฟล์ไหน

| เปลี่ยนอะไร | อัปเดตไฟล์ |
|---|---|
| requirement / AC / BR / NFR | `docs/02-requirements/spec.md` ก่อน แล้วคัด `backlog.md` และ Golden Thread ใน `README.md` + Final Report |
| เพิ่ม/ย้ายไฟล์โค้ด | ตารางแบ่งงาน + โครงสร้างใน `README.md`, `prototype/README.md` · ลำดับ `<script>` ในหน้า HTML |
| หน้าจอ | ป้าย "Covers: FR-xx" บนหน้านั้น + Screen Map ใน `docs/03-design/design-system.md` |
| ทดสอบ | ตาราง scenario ใน Final Report §6 |
| ใช้ AI | `docs/02-requirements/spec.md` §8 |

## 6. ก่อนวันส่ง / วันสอบ

- ทุกคนซ้อมอธิบายฟีเจอร์ของตัวเอง 3–5 นาที: ปัญหา → FR/AC → ไฟล์ที่เขียน → เทสต์ → demo
- ตรวจ Golden Thread ให้ตรงของจริง — ถ้าปัญหา / ฟีเจอร์ / เทสต์ไม่ตรงกัน M4 + M5 ถูกจำกัดที่ 50%
