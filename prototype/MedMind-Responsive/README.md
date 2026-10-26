# MedMind — งานออกแบบของ IDK-SleepyBro

เปิด [ต้นแบบงาน Figma ชุดใหม่](figma-IDK-SleepyBro/index.html) ในเบราว์เซอร์ และอ่าน [วิธีตรวจงานและข้อจำกัด](figma-IDK-SleepyBro/README.md)

ต้นฉบับออกแบบ: [MedMind Copy ใน Figma](https://www.figma.com/design/QApLysrw0Cin0OTNZpd0C0?node-id=7-2) · ผู้รับผิดชอบ Rossatorn Sangkaew / IDK-SleepyBro · Covers: FR-01–05, NFR-03

README นี้แทนคู่มืองานออกแบบเก่าของผู้ใช้ งานใหม่เปิดได้จากไฟล์เดียวโดยไม่ต้องติดตั้ง โปรแกรมส่วนอื่นของทีมยังเปิดผ่าน [หน้าเลือกบทบาท](role.html) หรือ [หน้ารวมสองบทบาท](demo.html)

## เหตุผลที่คงไฟล์เดิมบางส่วน

ตรวจประวัติ 141 commits ถึง `main` ที่ `52aca3f0342c977333179b2174dd851aac5cf742` รวม branch ที่ดึงมา การย้ายชื่อไฟล์ และผู้ร่วมเขียน พบว่า `index.html`, `caregiver.html`, `role.html`, `demo.html` และไฟล์ฟีเจอร์มีงานของเพื่อนอยู่ จึงคงไว้ตามคำสั่งผู้ใช้

`app.js`, `flows.js` และ `styles.css` เดิมยังเป็นส่วนที่หน้าของเพื่อนเรียกใช้ โดยเฉพาะการสแกนฉลากและหน้าเลือกบทบาท จึงยังลบหรือแทนทั้งชุดไม่ได้โดยไม่กระทบงานเพื่อน ไฟล์เหล่านี้คงเนื้อหาเดิมทุกไบต์ งานออกแบบใหม่อยู่ใน `figma-IDK-SleepyBro/`

เอกสารส่วนรวม เช่น `prototype/README.md`, Screen Map และบันทึก AI ใน `spec.md` มีประวัติของเพื่อน จึงบันทึกขอบเขต วิธีเปิด และการใช้ AI รอบนี้ใน [README ของงานใหม่](figma-IDK-SleepyBro/README.md) และ PR แทน
