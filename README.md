# MedMind — ระบบเตือนกินยาและแจ้งสถานะให้ผู้ดูแลผู้สูงอายุ

[![Milestone](https://img.shields.io/badge/Milestone-M4%20Final%20Project-purple)](docs/05-report/final-report.md)
[![Status](https://img.shields.io/badge/Status-In%20Progress-orange)](#สถานะปัจจุบัน-current-status)
[![Prototype](https://img.shields.io/badge/Prototype-HTML%2FCSS%2FJS%20(no%20server)-blue)](prototype/README.md)

> **Intro to Software Engineering (15031001) — Academic Year 2569**
> School of Applied Digital Technology, Mae Fah Luang University
> **Team:** **MedMind**
> **GitHub Repository:** https://github.com/yaroo393-png/SE-Project

---

## สถานะปัจจุบัน (Current Status)

| ส่วน | สถานะ |
|---|---|
| M1 Charter | ฉบับปรับปรุง (ข้อมูลสมาชิกกรอกแล้ว · กำหนดเสร็จ Increment ใน §8 ใส่แล้ว) |
| M2 SRS / Requirements | SRS v2.0 ร่างแล้ว (`spec.md`): FR-01..08 (Must 5 · Should 1 · Could 2), BR-01..17, AC, NFR-01..10, Use case, Traceability — ยังรอ: Use-case diagram, แถวว่างใน AI log (§8) |
| M2 Design | `design-system.md`: tokens, components, Screen Map และ error/empty states ของงาน #48 · `architecture.md` (มีแค่ตาราง Module & Event), `medmind.drawio.pdf` — ยังรอ: diagram + ERD ใน md (#47) |
| M3 Prototype | หน้าเว็บอยู่ที่ `prototype/` หลังจัดโครง #46 · FR-02 จัดการยา #48: ตั้งเวลามื้อ ฟอร์มเพิ่ม/แก้/ลบยา หลายมื้อ ก่อน/หลังอาหาร/ก่อนนอน และแสดงเวลาเตือนก่อนบันทึก · ระบบสแกนเดิมของ YAR OO อ่านในเบราว์เซอร์ → เติมร่างให้ผู้ดูแลตรวจ · งาน FR-01, FR-03–05 ที่ยังไม่ครบติดตามใน #47, #49, #50 ไม่เปลี่ยนสถานะงานเพื่อนในรอบนี้ |
| Automated tests | ผล 26 ต.ค. 2569: `npm run check` ผ่าน 110/110 เทสต์ (เดิม 80 + medication 30), ESLint และตรวจความลับผ่าน · DOM integration เพิ่มเติมผ่าน 22 scenarios โดย AI agent (เครื่องมือตรวจติดตั้งนอก repo ไม่เพิ่ม dependency โปรเจกต์) · ยังไม่มีผล visual QA ในเบราว์เซอร์หรือผลทดสอบผู้ใช้จริง (#50) |
| Final Report / AI-Use Statement | ร่างแล้ว: Report §1–3, §7–10 (§8–9 บางส่วน) · AI-Use Statement สรุปจาก `spec.md` §8 — ยังรอ: §4 Design, §5 Prototype, §6 ผลทดสอบ |

> README นี้จะอัปเดตเมื่อมีผลจริง ช่อง **[ ]** = ยังไม่มีข้อมูลจริง ไม่เดา

---

## 📌 บทนำและภาพรวมของโครงการ (Project Overview)

**MedMind** คือระบบที่ช่วยให้ผู้สูงอายุที่ต้องกินยาตามเวลา ยืนยันการกินยาได้ด้วยการแตะเดียว และให้ผู้ดูแลที่ไม่ได้อยู่ด้วยรู้สถานะการกินยาแต่ละรอบ โดยไม่ต้องโทรหรือส่งข้อความถาม

**ปัญหา:** ผู้สูงอายุที่ต้องรับประทานยาเป็นประจำอาจลืมกินยา กินไม่ตรงเวลา หรือจำไม่ได้ว่ากินแล้วหรือยัง ขณะที่ลูกหลานต้องออกไปทำงานและไม่สามารถติดตามได้ตลอดวัน วิธีปัจจุบัน (นาฬิกาปลุก กล่องยา โทรถาม ส่ง LINE) ยังไม่สามารถยืนยันและสรุปสถานะการกินยาให้ผู้ดูแลทราบโดยอัตโนมัติได้ (รายละเอียด: [`docs/01-charter/charter.md`](docs/01-charter/charter.md))

**ผู้ใช้หลัก:** ผู้สูงอายุ (Senior) · ลูกหลาน / ผู้ดูแล (Caregiver)

### ขอบเขต MVP (5 FR — Must ทั้งหมด)
| FR | ฟีเจอร์ |
|---|---|
| FR-01 | จับคู่ Senior–Caregiver ผ่าน QR / รหัสเชิญ (Senior ไม่ต้องสมัคร แต่ต้องยินยอม) |
| FR-02 | สแกนฉลากยา → Caregiver ตรวจ/แก้ → บันทึก |
| FR-03 | แจ้งเตือนเมื่อถึงมื้อยา + แจ้งซ้ำ 2 ครั้ง (หัวใจ MVP) |
| FR-04 | ยืนยันการกินยาทั้งมื้อด้วยการกดครั้งเดียว |
| FR-05 | แจ้ง Caregiver เมื่อยังไม่ยืนยัน (ไม่เกิน T+15) + หน้าสถานะรายวัน |

**หลัง MVP (Should / Could — ดู SRS §3.6 ใน [`spec.md`](docs/02-requirements/spec.md)):** หลาย Caregiver ต่อ Senior · ยาเมื่อมีอาการ/ยาน้ำ/ยาครึ่งเม็ด · สต็อกยา + แจ้งยาใกล้หมด · แก้ประวัติย้อนหลัง · วิเคราะห์รูปแบบการพลาดยา · นัดหมาย · ความดัน/น้ำตาล · ค่าใช้จ่าย · เชื่อมโรงพยาบาล · Smart Pillbox / IoT / Smartwatch · รูปยา · ยืนยันรายเม็ด

---

## 🧵 The Golden Thread 
*คะแนนไม่ได้ให้ที่ความสวยของแอป แต่ให้ที่ความต่อเนื่อง: ปัญหา → requirement → design → feature → test*

| ปัญหา (Problem) | → Requirement | → Design | → Feature | → Test |
|---|---|---|---|---|
| ผู้สูงอายุไม่สะดวกสมัครบัญชี; ผู้ดูแลไม่อยู่ด้วย | **FR-01** | (Design — รอ architecture.md) | (M3 Prototype) | FR-01 AC 1–6 · NFR-04, NFR-05, NFR-10 |
| ผู้ดูแลอยากให้ช่วยกรอกข้อมูลยาจากฉลาก | **FR-02** | (Design — รอ architecture.md) | ฟอร์มเพิ่มยา (`caregiver.html`): ถ่ายรูปฉลาก → อ่านในเบราว์เซอร์ → เติมฟอร์ม → ผู้ดูแลตรวจแล้วกดบันทึก (`js/features/scan.js`) | FR-02 AC ✓1 ✓6 ✓8 ✓9 ✗3 ✗4 ✗5 ✗10 (`labelParser.test.js`, `labelForm.test.js`) · NFR-06, NFR-09 |
| ลืมกินยา / กินไม่ตรงเวลา | **FR-03** | State machine ของมื้อยา: รอถึงเวลา → กำลังเตือน (T, T+5, T+10) → กินแล้ว / ยังไม่ยืนยัน / ยืนยันช้า *(planned)* | หน้าเตือน: ยาทั้งมื้อ + เสียง + ปุ่ม "กินแล้ว" / "ยังไม่กิน" *(planned)* | FR-03 AC 1–4 · NFR-01 *(planned)* |
| จำไม่ได้ว่ากินแล้วหรือยัง | **FR-04** | (Design — รอ architecture.md) | (M3 Prototype) | FR-04 AC 1–6 · NFR-02, NFR-03, NFR-07 |
| ต้องโทร/ส่ง LINE ถามทุกมื้อ; ไม่มีสถานะรวม | **FR-05** | (Design — รอ architecture.md) | (M3 Prototype) | FR-05 AC 1–6 · NFR-01 |
| ผู้ดูแลไม่ได้อยู่ด้วยตลอด บางครั้งโทรไม่ได้ | **FR-06** (Should) | (หลัง MVP) | (หลัง MVP) | (หลัง MVP — AC เขียนเมื่อย้ายเข้า increment) |
| ไม่รู้ว่ามื้อนี้/วันนี้ต้องกินยาอะไร | **FR-07** (Could) | (หลัง MVP) | (หลัง MVP) | (หลัง MVP — AC เขียนเมื่อย้ายเข้า increment) |
| อยากเห็นรูปยา (ผู้ให้สัมภาษณ์ 1) | **FR-08** (Could) | (หลัง MVP) | (หลัง MVP) | (หลัง MVP — AC เขียนเมื่อย้ายเข้า increment) |

> ตารางนี้คัดจาก `docs/02-requirements/spec.md` §7 — แก้ที่ spec ก่อนแล้วคัดมาให้ตรง

---

## 📂 สารบัญเอกสารประกอบโครงการ (Project Documentation Index)

```
docs/
├── 01-charter/
│   └── charter.md            # M1: ปัญหา, ผู้ใช้, ขอบเขต in/out, ตัววัดความสำเร็จ, SDLC, บทบาททีม
├── 02-requirements/
│   ├── spec.md               # M2: SRS (Business Rules, User Story, AC, MoSCoW, NFR, Use Case, Traceability)
│   └── backlog.md            # Product Backlog: MoSCoW รายข้อ + Traced pain + สถานะการพัฒนา
├── 03-design/
│   ├── architecture.md       # M2: Architecture, Use Case/Sequence/State, ERD, Module & Event (โครง — มีแค่ตาราง Module & Event)
│   └── design-system.md      # M2: Design tokens, Screen Map (หน้าจอ ↔ FR), error/empty states
├── 05-report/
│   ├── final-report.md       # M3: Final Report + Golden Thread table (ร่าง — §4–6 รอ Design / Prototype / Test)
│   └── ai-use-statement.md   # M3: บันทึกการใช้ AI ตามจริง (ร่าง — สรุปจาก spec.md §8)
├── 06-presentation/
│   └── demo-slides.md        # M3: โครง Demo (Problem → Solution) (โครง)
prototype/
├── README.md                 # วิธีเปิด + ไฟล์ของแต่ละฟีเจอร์
├── index.html, caregiver.html # หน้าเว็บผู้สูงอายุ / ผู้ดูแล — โครงหน้า Rossatorn + จุดเชื่อมฟีเจอร์ของทีม
├── role.html, demo.html      # หน้าเลือกบทบาท / ดูทั้ง 2 บทบาท — YAR OO (ย้าย path ใน #46)
├── figma-IDK-SleepyBro/      # ต้นแบบออกแบบเดิมของ Rossatorn เก็บแยกจากฟีเจอร์ที่ต่อข้อมูลจริง
├── FR02-IDK-SleepyBro.md     # คู่มืออ่านโค้ด FR-02 + ลำดับ demo สำหรับ oral exam
├── css/
│   ├── styles.css            # โครงหน้าและ design tokens — Rossatorn
│   ├── medication.css        # สไตล์ FR-02 ตาม Figma แยกขอบเขตจากหน้าเดิม — Rossatorn
│   ├── scan.css              # กล่องผลสแกนในฟอร์มเพิ่มยา (YAR OO)
│   └── role.css              # หน้าเลือกบทบาท + ดูทั้ง 2 บทบาท (YAR OO)
├── js/
│   ├── core/
│   │   ├── app.js            # โครงหน้า เมนู ภาษา ธีม — Rossatorn (จัดรูปแบบจากไฟล์เดิม)
│   │   ├── store.js          # ชื่อ key ใน localStorage + เวลามื้ออาหาร — ข้อมูลร่วมทุกฟีเจอร์ (PM)
│   │   └── role.js           # บทบาทในแท็บนี้ + กันเข้าหน้าแอปก่อนเลือกบทบาท (FR-01) (PM)
│   ├── logic/                # ตรรกะล้วน ไม่แตะหน้าจอ — มีเทสต์ทุกไฟล์
│   │   ├── reminder.js       # เวลาเตือน (FR-03, BR-06, BR-08) — Nichanan
│   │   ├── confirm.js        # ยืนยัน + แจ้ง Caregiver + สถานะรายวัน (FR-04, FR-05) — Nichanan
│   │   ├── labelParser.js    # ข้อความจากฉลาก → ร่างข้อมูลยา (FR-02, BR-04, BR-07, NFR-09) — YAR OO
│   │   ├── labelForm.js      # ร่าง → ค่าในฟอร์มเพิ่มยา + เวลาเตือนจากเวลามื้อ (FR-02, BR-06) — YAR OO
│   │   ├── pairing.js        # (ยังไม่มี — #47) รหัสเชิญ / ยินยอม / ยกเลิก (FR-01) — Takkan
│   │   ├── medication.js     # ตรวจร่าง คำนวณเวลา บันทึก/ลบยา (FR-02, BR-03–07) — Rossatorn
│   │   └── status.js         # (ยังไม่มี — #50) สถานะรายวัน + ข้อความถึงผู้ดูแล (FR-05) — Suchitra
│   ├── services/
│   │   └── scanner.js        # อ่านตัวหนังสือจากรูปในเบราว์เซอร์ (Tesseract.js) — YAR OO
│   └── features/             # การทำงานบนหน้าจอของแต่ละฟีเจอร์
│       ├── medicine.js       # ฟอร์มยา + เวลามื้อ + เชื่อมร่างจากสแกน — Rossatorn
│       ├── pairing.js        # ย้ายโค้ดจับคู่เดิมจาก flows.js เพื่อให้ Takkan เขียนต่อ (#47)
│       ├── scan.js           # สแกนฉลาก → เติมฟอร์มเพิ่มยา (FR-02) — YAR OO
│       ├── roleSelect.js     # ปุ่มเลือกบทบาทในหน้า role.html / demo.html — YAR OO
│       └── <ฟีเจอร์>.js       # งานต่อของเพื่อน: reminder #49 (Nichanan) · caregiverStatus #50 (Suchitra)
└── tests/                    # npm test — ชื่อไฟล์ตามไฟล์ใน js/logic/ และ js/core/
    ├── reminder.confirm.test.js
    ├── labelParser.test.js, labelForm.test.js, store.test.js
    ├── medication.test.js    # FR-02 AC การตรวจร่าง เวลา บันทึก/แก้/ลบ/ยกเลิก — Rossatorn
    └── <ฟีเจอร์>.test.js       # งานต่อของเพื่อน: pairing #47 · status #50
.github/
├── workflows/ci.yml          # CI ทุก push / PR: unit test + ESLint + ตรวจความลับ
└── pull_request_template.md  # ช่อง Golden Thread + checklist ก่อนขอรีวิว
.vscode/                      # tasks.json (ปุ่มรันเทสต์ใน VS Code) + extensions.json (ส่วนขยายที่แนะนำ)
scripts/check-secrets.js      # ตรวจว่าไม่มีรหัสลับ / ไฟล์ต้องห้ามใน repo
package.json, eslint.config.js # คำสั่ง npm test / lint / check
RULES.md                      # กติกาการทำงานของทีม + การใช้ AI
CLAUDE.md                     # คำสั่งสำหรับ Claude Code (อ่าน RULES.md)
```

---

## 🚀 วิธีการเปิดใช้งาน Prototype และการรันระบบ (Quick Start)

> **Prototype ยังไม่ครบ** — หน้าเว็บมีแล้วแต่ยังไม่ครบ FR-01..05 · สแกนฉลาก (FR-02) ใช้ตรรกะใน `js/logic/` แล้ว แต่หน้าเตือน / ยืนยัน / สถานะยังไม่ได้เรียก `reminder.js` / `confirm.js` (#49, #50) (ดูสถานะด้านบน)

### 1. วิธีเปิดดู Prototype ในเว็บเบราว์เซอร์ (Clickable Prototype)
Prototype เป็น HTML/CSS/JS เปิดในเบราว์เซอร์ได้โดยตรง **ไม่ต้องมี server หรือฐานข้อมูล** (ข้อมูลเป็นข้อมูลจำลอง; การแจ้งเตือนและเวลาเป็นการจำลอง)

1. เปิดผ่านลิงก์ GitHub Pages: **<https://yaroo393-png.github.io/SE-Project/>** — เปิดในมือถือได้ หน้าแรกพาไปหน้าเลือกบทบาท
2. หรือดาวน์โหลด repo แล้วเปิด [`index.html`](index.html) (หรือ [`prototype/role.html`](prototype/role.html)) ด้วยเบราว์เซอร์ → **เลือกบทบาทก่อนเข้าแอป**:
   - **ผู้สูงอายุ (Senior)** → หน้า `index.html` · **ลูกหลาน / ผู้ดูแล (Caregiver)** → หน้า `caregiver.html` (เปิดหน้าแอปตรง ๆ ก่อนเลือกบทบาทจะถูกพากลับหน้าเลือกบทบาท)
   - จำลองมือถือ 2 เครื่อง: เปิด 2 แท็บในเบราว์เซอร์เดียวกัน เลือกคนละบทบาท (ใช้ข้อมูลชุดเดียวกันใน localStorage) · หรือกด "ดูทั้ง 2 บทบาทพร้อมกัน" ([`demo.html`](prototype/demo.html)) สำหรับนำเสนอ
   - เปลี่ยนบทบาท: ปุ่มลูกศรสลับด้านบนของแอป
3. สแกนฉลาก (FR-02): หน้าผู้ดูแล → ยา → เพิ่มรายการยา → ถ่ายภาพ/เลือกรูปฉลาก หรือเลือก "ฉลากตัวอย่าง" (ใช้ได้แม้ไม่มีเน็ต)
   - การอ่านรูปทำในเบราว์เซอร์ รูปไม่ถูกส่งออก · ครั้งแรกต้องต่ออินเทอร์เน็ตเพื่อโหลดตัวอ่าน (~4 MB)
   - ครั้งแรกตั้งเวลามื้อเช้า/กลางวัน/เย็น/เข้านอน แล้วตรวจชื่อยา จำนวนเม็ด มื้อและนาทีตามฉลากก่อนบันทึก · อ่านลำดับ demo และโค้ดใน [คู่มือ FR-02 ของ IDK-SleepyBro](prototype/FR02-IDK-SleepyBro.md)

### 2. วิธีรันชุดทดสอบอัตโนมัติ (Automated Tests)
ต้องมี Node.js 21 ขึ้นไป — รันจากโฟลเดอร์บนสุดของ repo (Windows PowerShell ใช้ `npm.cmd` แทน `npm`):
```bash
npm test             # unit test ทั้งหมดใน prototype/tests/ (ไม่ต้อง npm install)
npm install          # ครั้งแรกครั้งเดียว สำหรับคำสั่งด้านล่าง
npm run check        # test + ตรวจคุณภาพโค้ด (ESLint) + ตรวจว่าไม่มีรหัสลับ — รันก่อน push
```
ผลล่าสุด (26 ต.ค. 2569): **ผ่าน 110 / ไม่ผ่าน 0** — เทสต์เดิม 80 + `medication.test.js` 30; `npm run check` ผ่าน ESLint และการตรวจความลับด้วย · CI รันชุดเดียวกันทุก push / PR (แท็บ Actions)

ตรวจ DOM integration เพิ่มเติมผ่าน 22 scenarios (การเลือกบทบาท ตั้งเวลามื้อ ร่าง/preview/บันทึก/แก้/ลบ/ยกเลิกยา หลายมื้อ ก่อนนอน การกู้ฟอร์มหลังสแกนไม่ได้ และ escape ข้อความ) ด้วย jsdom นอก repo ไม่มี package โปรเจกต์เพิ่ม การเปิด `file://` ในเครื่องมือตรวจเบราว์เซอร์ถูกนโยบายเครื่องมือจำกัด จึงยังไม่ได้ตรวจภาพจริงบน desktop/mobile หรือกล้อง/OCR จริงรอบนี้ ทีมต้องเปิดหน้า `role.html` / `demo.html` ตรวจหน้าจอก่อน merge

---

## ⚙️ ข้อจำกัดที่สำคัญ

- การกดยืนยันเป็นการรายงานด้วยตนเอง ระบบไม่ตรวจว่ากินยาจริง; ข้อความถึงผู้ดูแลใช้คำว่า "ยังไม่ยืนยันการกินยา"
- ผล OCR ต้องผ่านการตรวจของ Caregiver ทุกครั้งก่อนบันทึก
- ระบบไม่วินิจฉัย ไม่แนะนำยา และไม่เปลี่ยนวิธีใช้ยา
- ระบบเป็นเว็บแอป — เตือน Senior และแจ้ง Caregiver เฉพาะขณะเปิดหน้าเว็บค้างไว้ (SRS §2.2)
- Prototype ไม่มี backend / ฐานข้อมูล — ข้อมูลอยู่ใน localStorage ของเบราว์เซอร์ · การแจ้งเตือนและเวลาเป็นการจำลอง · การอ่านฉลากทำจริงในเบราว์เซอร์ (Tesseract.js) ยังอ่านผิดได้ ผู้ดูแลต้องตรวจทุกช่อง — วัดกับฉลากจำลอง 72 รูป (ถ่ายเอียง เบลอ เงา หมึกจาง ข้อมูลผู้ป่วยสมมติ) ไม่ใช่ฉลากจริง · ยังไม่ได้วัด NFR-08 กับฉลากจริง 20 ใบ (#51)

---

## 👥 สมาชิกและส่วนร่วม (Team & Contribution)

| ชื่อ–นามสกุล | GitHub | บทบาท | ฟีเจอร์ที่เขียนโค้ด | ไฟล์หลัก |
|---|---|---|---|---|
| YAR OO | [yaroo393-png](https://github.com/yaroo393-png) | Project Manager | **FR-02 สแกนฉลาก** + ข้อมูลร่วม (`store.js`), หน้าเลือกบทบาท, CI · รวมเล่มรายงาน (#51) | `js/logic/labelParser.js`, `labelForm.js` · `js/services/scanner.js` · `js/features/scan.js`, `roleSelect.js` · `js/core/store.js`, `role.js` · `role.html`, `demo.html` |
| Takkan Khanlui | [V31311](https://github.com/V31311) | System Designer | **FR-01 จับคู่** · Design doc (#47) | `js/logic/pairing.js` · `js/features/pairing.js` |
| Rossatorn Sangkaew | [IDK-SleepyBro](https://github.com/IDK-SleepyBro) | UX/UI Designer | **FR-02 จัดการยา** (เวลามื้อ, ฟอร์มยา) · หน้าเว็บ + Design system (#46, #48) | `js/logic/medication.js` · `tests/medication.test.js` · `js/features/medicine.js` · `js/core/app.js` · `css/styles.css` · `index.html`, `caregiver.html` · `docs/03-design/design-system.md` |
| Nichanan Lalua | [KaidangSuk](https://github.com/KaidangSuk) | Prototype Developer | **FR-03 เตือน + FR-04 ยืนยัน** (#49) | `js/logic/reminder.js`, `confirm.js` · `js/features/reminder.js` |
| Suchitra Khomdee | [Khaiwann](https://github.com/Khaiwann) | QA / Tester | **FR-05 สถานะ + แจ้งผู้ดูแล** · แผนและผลทดสอบ (#50) | `js/logic/status.js` · `js/features/caregiverStatus.js` |

ทุกคนเขียนตรรกะ + เทสต์ + หน้าจอของฟีเจอร์ตัวเอง และอธิบายโค้ดของตัวเองได้ · กติกาการทำงาน (branch, PR, การใช้ AI): [`RULES.md`](RULES.md)

รหัสนักศึกษาและหน้าที่รับผิดชอบอยู่ใน [`docs/01-charter/charter.md`](docs/01-charter/charter.md) §9

ส่วนร่วมรายคนวัดจาก GitHub contribution (commits, PRs, issues, เอกสารที่ commit) — ทุกคน commit ด้วยบัญชีของตัวเอง

---

## 📚 แหล่งอ้างอิง (References)

- ข้อมูลผู้ใช้: การสัมภาษณ์ 3 คน (4/9/69 ผ่านการโทร) — Charter §4
- W3C. *WCAG 2.2 — Understanding SC 2.5.5: Target Size (Enhanced)* — https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html (NFR-03)
- W3C. *WCAG 2.2 — Understanding SC 1.4.3: Contrast (Minimum)* — https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html (NFR-03)
- Apple. *Human Interface Guidelines — Accessibility* — https://developer.apple.com/design/human-interface-guidelines/accessibility (NFR-03)
- Google. *Material Design — Accessibility* — https://m2.material.io/design/usability/accessibility.html (NFR-03)
- Nielsen, J. *Why You Only Need to Test with 5 Users*. Nielsen Norman Group — https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/ (NFR-02, ตัววัดความสำเร็จ)
- พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) (NFR-09, NFR-10, BR-17)
- เอกสารรายวิชา Intro to Software Engineering 2569: คู่มือ M2 (SRS) และ Milestone 4 — Final Project: Submit & Grading
