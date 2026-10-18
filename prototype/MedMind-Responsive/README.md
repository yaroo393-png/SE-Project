# MedMind responsive website demo

Open [index.html](index.html) for the senior view or [caregiver.html](caregiver.html) for the caregiver view. Both pages share the responsive layout and interaction code; navigation adapts from a desktop sidebar to a mobile bottom bar.

## Included flows

- Thai/English, light/dark appearance, and text-size controls.
- FR-01 pairing demo: the caregiver view stays on the invitation screen until a valid 6-digit code is entered and the senior has consented; patient schedule and status appear only after a successful pairing. The demo includes a local QR code, random code, expiry, one-time use, camera scan when supported, and manual code entry.
- FR-02 medicine-label capture: use a phone camera or choose a label photo, review the photo, and enter/correct medicine details before saving them to the schedule. OCR is not connected; the prototype never guesses medicine instructions.
- Caregivers use one “Add medicine” flow to enter details manually or optionally attach a label photo, then save; they can remove medicines. The senior view is read-only for medicine management.
- Medicine rows in the schedule are generated from the saved demo medicine list.

## Prototype limits

This is a front-end demo with fictional sample content and no server or medical-record integration. Pairing is stored in this browser only, so it does not sync between separate devices. Invitation codes and medicine entries are local demo data. QR camera scanning needs browser camera support and a secure context such as HTTPS or localhost; manual code entry remains available. The camera/photo picker attaches a label image for review, but does not perform real OCR. Caregiver call buttons show a demo notice and do not place a call. Dose reminders and notifications are not delivered when the page is closed.

For the interactive camera flows, open the files from a local web server or a static HTTPS host. GitHub's source-file preview only displays code and does not run the website.
