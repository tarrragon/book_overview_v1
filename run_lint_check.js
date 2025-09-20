#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  // eslint-disable-next-line no-console
  console.log('🔍 執行 ESLint 檢查...');
  const output = execSync('npm run lint', { encoding: 'utf8', stdio: 'pipe' });
  // eslint-disable-next-line no-console
  console.log('✅ 沒有發現 lint 錯誤');
} catch (error) {
  // eslint-disable-next-line no-console
  console.log('ESLint 輸出：');
  // eslint-disable-next-line no-console
  console.log(error.stdout);
  if (error.stderr) {
    // eslint-disable-next-line no-console
    console.log('錯誤：');
    // eslint-disable-next-line no-console
    console.log(error.stderr);
  }
}