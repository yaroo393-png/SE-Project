# Prototype — MedMind

Clickable prototype (HTML/CSS/JS) เปิดในเบราว์เซอร์ ไม่ต้องมี server / DB

> สถานะ: **บางส่วน** — หน้าเว็บยังไม่ครบ FR-01..05 และยังไม่ได้เรียกใช้ตรรกะใน `js/logic/` (#26)

โครงไฟล์:
- `MedMind-Responsive/` — หน้าเว็บ demo (`index.html`, `styles.css`, `app.js`) ดูรายละเอียดใน [`MedMind-Responsive/README.md`](MedMind-Responsive/README.md)
- `js/logic/` — ตรรกะหลัก ไม่แตะ DOM: `reminder.js` (FR-03, BR-06), `confirm.js` (FR-04, FR-05) — ในเบราว์เซอร์ต้องโหลด `reminder.js` ก่อน `confirm.js`
- `tests/` — automated test ของ `js/logic/`

วิธีเปิด: เปิดไฟล์ `MedMind-Responsive/index.html` ด้วยเบราว์เซอร์

วิธีรันเทสต์ (Node.js 18 ขึ้นไป, รันจากโฟลเดอร์บนสุดของ repo):
```bash
node --test prototype/tests/reminder.confirm.test.js
```
ผลล่าสุด (17 ต.ค. 2569, Node 22): ผ่าน 23 / ไม่ผ่าน 0
