/*
 * check-secrets.js — ตรวจว่าไม่มีความลับหรือไฟล์ต้องห้ามหลุดเข้า repo (M4: Basic security check · Charter §9)
 * รัน: npm run check:secrets (CI รันทุก PR) · ตรวจไฟล์ที่ git ติดตาม + ไฟล์ใหม่ที่ยังไม่ commit (ยกเว้นที่ .gitignore ตัดไว้)
 */
'use strict';
const { execSync } = require('node:child_process');
const fs = require('node:fs');

// ข้อความที่บอกว่าเป็นรหัสลับ
const PATTERNS = [
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
  [/"private_key"\s*:/, 'service account (.json ที่มี private_key)'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, 'GitHub token'],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/, 'API secret key (sk-…)'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, 'Slack token']
];
// ชื่อไฟล์ที่ห้ามอยู่ใน repo
const FORBIDDEN_NAMES = [
  [/(^|\/)\.env(\.(?!example$)[^/]*)?$/, 'ไฟล์ environment (.env)'],
  [/service-account[^/]*\.json$|-firebase-adminsdk-[^/]*\.json$/, 'ไฟล์ service account']
];
const SELF = 'scripts/check-secrets.js';
const BINARY = /\.(png|jpe?g|gif|webp|pdf|ico|woff2?|zip)$/i;

const files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);
const problems = [];
for (const file of files) {
  for (const [re, what] of FORBIDDEN_NAMES) if (re.test(file)) problems.push(`${file}: ${what}`);
  if (file === SELF || BINARY.test(file) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const [re, what] of PATTERNS) if (re.test(text)) problems.push(`${file}: พบ ${what}`);
}
if (problems.length) {
  console.error('พบสิ่งที่ห้าม commit:\n- ' + problems.join('\n- '));
  console.error('ลบออกจาก repo แล้วเปลี่ยนรหัสนั้นใหม่ (ถือว่ารั่วแล้ว)');
  process.exit(1);
}
console.log(`ตรวจ ${files.length} ไฟล์ — ไม่พบความลับ`);
