# Architecture & Design — MedMind

> สถานะ: **โครง** · diagram ใช้ Mermaid · ทุก diagram ติดป้าย FR

## 1. Architecture (มาจาก FR) + ADR
## 2. Use Case Diagram
### Use Case Diagram — FR-01 Senior–Caregiver Pairing

```mermaid
flowchart LR
    Senior[Senior / ผู้สูงอายุ]
    Caregiver[Caregiver / ผู้ดูแล]

    CreateInvite((สร้างรหัสเชิญ 6 หลัก))
    Consent((ยินยอมให้เชื่อมต่อ))
    EnterCode((กรอกรหัสเชิญ))
    Validate((ตรวจสอบรหัส))
    Pair((จับคู่ Senior–Caregiver))
    Disconnect((ยกเลิกการเชื่อมต่อ))
    ClearData((ล้างข้อมูลยาและประวัติ))

    Senior --> CreateInvite
    Senior --> Consent
    Senior --> Disconnect
    Caregiver --> EnterCode
    EnterCode --> Validate
    Consent --> Pair
    Validate --> Pair
    Disconnect --> ClearData
```
กฎของ FR-01:

- รหัสเชิญมี 6 หลัก
- รหัสหมดอายุภายใน 10 นาที
- รหัสเชิญใช้ได้ครั้งเดียว
- ต้องได้รับความยินยอมก่อนจับคู่
- การยกเลิกการเชื่อมต่อต้องล้างข้อมูลยาและประวัติของคู่นั้น

## 3. Sequence Diagram — FR-01 Pairing

```mermaid
sequenceDiagram
    participant S as Senior
    participant UI as Pairing UI
    participant P as pairing.js
    participant Store as store.js/localStorage
    participant C as Caregiver

    S->>UI: เปิดหน้าจับคู่
    UI->>P: createInvite()
    P-->>UI: รหัส 6 หลักและเวลาหมดอายุ
    UI->>Store: บันทึกข้อมูล invite

    S->>UI: กดยินยอม
    UI->>P: setConsent(true)
    P->>Store: บันทึก consent=true

    C->>UI: กรอกรหัสเชิญ
    UI->>P: acceptInvite(code)
    P->>Store: อ่านข้อมูล invite

    alt รหัสถูก ไม่หมดอายุ ยินยอมแล้ว และยังไม่ถูกใช้
        P->>Store: บันทึกสถานะจับคู่และใช้รหัส
        P-->>UI: จับคู่สำเร็จ
        UI-->>C: แสดงผลสำเร็จ
    else รหัสผิด
        P-->>UI: ปฏิเสธรหัส
    else รหัสหมดอายุ
        P-->>UI: ปฏิเสธรหัสหมดอายุ
    else ยังไม่ยินยอม
        P-->>UI: ขอให้ Senior ยินยอมก่อน
    else รหัสถูกใช้แล้ว
        P-->>UI: ปฏิเสธการใช้ซ้ำ
    end

    S->>UI: กดยกเลิกการเชื่อมต่อ
    UI->>P: disconnect(confirmed=true)
    P->>Store: ล้างข้อมูลยา
    P->>Store: ล้างประวัติการกินยา
    P->>Store: สร้าง invite ใหม่
    P-->>UI: ยกเลิกการเชื่อมต่อสำเร็จ
```
## 4. Sequence Diagram — FR-03 → FR-05
### การเตือน ยืนยันการกินยา และแจ้งผู้ดูแล

```mermaid
sequenceDiagram
    participant Timer as Timer
    participant Dose as DoseSession
    participant S as Senior
    participant Esc as Escalation
    participant C as Caregiver

    Timer->>Dose: ถึงเวลาเตือน T
    Dose->>S: แสดงการแจ้งเตือนและเสียง

    alt Senior กดยืนยันว่ากินยาแล้ว
        S->>Dose: ยืนยันการกินยา
        Dose->>Dose: เปลี่ยนสถานะเป็น กินแล้ว
        Dose-->>S: หยุดการเตือน
    else Senior ยังไม่ยืนยัน
        Timer->>Dose: ถึงรอบเตือนถัดไป
        Dose->>S: แจ้งเตือนซ้ำ
        Timer->>Dose: หมดช่วงเตือน
        Dose->>Esc: ส่ง DoseUnconfirmed
        Esc->>C: แจ้งผู้ดูแลว่ายังไม่ยืนยัน
    end

    S->>Dose: ยืนยันหลังเวลาปกติ
    Dose->>Dose: เปลี่ยนสถานะเป็น กินแล้ว (ยืนยันช้า)
    Dose->>Esc: ส่ง DoseConfirmedLate
    Esc->>C: แจ้งสถานะยืนยันช้า
```

## 5. State Machine — DoseSession
### State Machine — DoseSession

```mermaid
stateDiagram-v2
    [*] --> Waiting

    Waiting: รอถึงเวลา
    Alerting: กำลังเตือน
    Taken: กินแล้ว
    Unconfirmed: ยังไม่ยืนยัน
    LateTaken: กินแล้ว (ยืนยันช้า)
    Escalated: แจ้งผู้ดูแล

    Waiting --> Alerting: ถึงเวลาเตือน T
    Alerting --> Taken: Senior ยืนยัน
    Alerting --> Alerting: ถึงรอบเตือนซ้ำ
    Alerting --> Unconfirmed: หมดช่วงเตือน
    Unconfirmed --> LateTaken: ยืนยันภายในช่วงล่าช้า
    Unconfirmed --> Escalated: หมดช่วงยืนยัน
    Taken --> [*]
    LateTaken --> [*]
    Escalated --> [*]
```

สถานะของ `DoseSession`:

- `Waiting` — รอถึงเวลา
- `Alerting` — กำลังเตือน
- `Taken` — กินแล้ว
- `Unconfirmed` — ยังไม่ยืนยัน
- `LateTaken` — กินแล้ว (ยืนยันช้า)
- `Escalated` — แจ้งผู้ดูแล


## 6. Data Model / ERD (เฉพาะข้อมูลที่ต้องเก็บ; ห้ามเก็บเลขบัตร ที่อยู่ วันเกิด เบอร์โทร HN)
### Data Model / ERD — localStorage

```mermaid
erDiagram
    PAIRING ||--o{ INVITE_CODE : contains
    PAIRING ||--o{ MEDICATION : owns
    MEDICATION ||--o{ DOSE_SESSION : schedules

    PAIRING {
        string storageKey
        boolean consent
        boolean paired
        boolean used
    }

    INVITE_CODE {
        string code
        number createdAt
        number expiresAt
    }

    MEDICATION {
        string id
        string name
        number pills
    }

    DOSE_SESSION {
        string medicationId
        string meal
        string status
        string confirmedAt
    }
```

Key ที่จัดเก็บใน `localStorage`:

| Key | ข้อมูล |
|---|---|
| `medmind-pairing` | รหัสเชิญ consent และสถานะการจับคู่ |
| `medmind-meds` | รายการยา |
| `medmind-taken` | ประวัติการยืนยันการกินยา |
| `medmind-meal-times` | เวลาของมื้อยา |

เมื่อยกเลิกการเชื่อมต่อ:

- `medmind-pairing` ถูกแทนด้วย invite ใหม่
- `medmind-meds` ถูกล้าง
- `medmind-taken` ถูกล้าง
- ไม่ใช้ `localStorage.clear()` เพราะอาจลบข้อมูลของฟีเจอร์อื่น
- ไม่เก็บเลขบัตรประชาชน ที่อยู่ วันเกิด เบอร์โทรศัพท์ หรือ HN


## 7. Module & Event (cohesion / coupling)

> แบบจำลองนี้เป็นเอกสารออกแบบร่วมของทีม และตรวจให้สอดคล้องกับโค้ดจริงก่อน merge

| Module | FR | ข้อมูลที่เป็นเจ้าของ |
|---|---|---|
| `pairing` | FR-01 | Senior, Caregiver, Pairing, InviteCode |
| `medication` (+ adapter `readLabel`) | FR-02 | Medication, MealTimes (เช้า/กลางวัน/เย็น/เข้านอน) |
| `doseSession` | FR-03, FR-04 | DoseSession (มื้อ, เวลาเตือน T, สถานะ: รอถึงเวลา / กำลังเตือน / กินแล้ว / ยังไม่ยืนยัน / กินแล้ว (ยืนยันช้า), รอบที่เตือน, เวลายืนยัน) |
| `escalation` | FR-05 | — (ฟัง event `DoseUnconfirmed`, `DoseConfirmedLate`) |
| `notification` | ใช้ร่วม | NotificationLog |

Events: `MedicationSaved` → `DoseConfirmed` / `DoseUnconfirmed` → `DoseConfirmedLate` (BR-15)

## 8. Coverage: FR → Design (sync-check)

| FR | Design artifact | Implementation / Test |
|---|---|---|
| FR-01 | Use Case Diagram, Sequence Diagram — FR-01, Pairing state/flow, localStorage ERD | `prototype/js/logic/pairing.js`, `prototype/js/features/pairing.js`, `prototype/tests/pairing.test.js` |
| FR-02 | Medication and label flow | `prototype/js/logic/labelParser.js`, `prototype/js/logic/labelForm.js` |
| FR-03 | Sequence Diagram — FR-03 → FR-05, DoseSession state machine | `prototype/js/logic/reminder.js` |
| FR-04 | Sequence Diagram — FR-03 → FR-05, DoseSession state machine | `prototype/js/logic/confirm.js` |
| FR-05 | Sequence Diagram — FR-03 → FR-05, escalation flow | `prototype/js/logic/reminder.js` |