// ตรวจคุณภาพโค้ด (M4: Basic quality check) — รัน: npm run lint
// ตรวจเฉพาะโค้ดที่แยกไฟล์ตามฟีเจอร์แล้ว (prototype/js/, prototype/tests/, scripts/)
// หน้า demo เดิมใน prototype/MedMind-Responsive/ จะเข้าระบบตรวจเมื่อย้ายและแยกไฟล์เสร็จ (Issue ของ Rossatorn)
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'prototype/MedMind-Responsive/**'] },
  js.configs.recommended,
  {
    files: ['prototype/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      // ไฟล์ใน logic/ และ core/ ใช้ได้ทั้งเบราว์เซอร์และ Node (module.exports / require)
      globals: { ...globals.browser, module: 'readonly', require: 'readonly' }
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error'
    }
  },
  {
    files: ['prototype/tests/**/*.js', 'scripts/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...globals.node } }
  }
];
