#!/usr/bin/env node

const { execSync } = require('child_process');

// eslint-disable-next-line no-console
console.log('🔍 執行 ESLint 檢查...\n');

try {
  const result = execSync('npm run lint', {
    encoding: 'utf8',
    stdio: 'inherit'
  });
  // eslint-disable-next-line no-console
  console.log('\n✅ ESLint 檢查通過!');
} catch (error) {
  // eslint-disable-next-line no-console
  console.log('\n⚠️  ESLint 檢查發現問題');
}