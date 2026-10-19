## ทำอะไร
<!-- สรุปสั้น ๆ ว่า PR นี้เปลี่ยนอะไร และทำไม — ใช้เป็นโน้ตตอนอธิบายโค้ดให้อาจารย์ (oral exam) -->

Closes #

## Golden Thread
- Requirement: <!-- เช่น FR-03 AC ✓2, BR-08, NFR-03 -->
- ไฟล์ที่แก้: <!-- เช่น prototype/js/logic/reminder.js -->
- Test: <!-- เช่น prototype/tests/reminder.confirm.test.js หรือ scenario ใน Final Report §6 -->

## ตรวจก่อนขอรีวิว
- [ ] `npm run check` ผ่านในเครื่อง (test + lint + ตรวจความลับ)
- [ ] เปิดหน้า prototype แล้วฟีเจอร์ทำงาน ไม่มี error ใน Console (F12)
- [ ] หน้าจอที่แก้มีป้าย "Covers: FR-xx" ตรงกับ requirement
- [ ] แก้เฉพาะไฟล์ในส่วนของตัวเอง (ถ้าแก้ไฟล์ส่วนรวม เช่น `index.html`, `caregiver.html`, `js/core/` ได้บอกในทีมแล้ว)
- [ ] ไม่มีความลับ (`.env`, service account, token) และไม่มีรูปฉลากยาจริงที่มีชื่อ/HN ผู้ป่วย
- [ ] ถ้าใช้ AI ช่วย: บันทึกใน `docs/02-requirements/spec.md` §8 แล้ว และอธิบายโค้ดทุกบรรทัดได้เอง
