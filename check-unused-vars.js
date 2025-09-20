#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  // eslint-disable-next-line no-console
  console.log('🔍 執行 ESLint 檢查 no-unused-vars...');
  
  // 執行 eslint 並獲取輸出
  const output = execSync('npx eslint src/ tests/ --format=unix', { encoding: 'utf8', stdio: 'pipe' });
  // eslint-disable-next-line no-console
  console.log('✅ 沒有發現 lint 錯誤');
  
} catch (error) {
  const output = error.stdout || error.stderr || '';
  
  // 解析並過濾 no-unused-vars 警告
  const lines = output.split('\n');
  const unusedVarsWarnings = lines.filter(line => line.includes('no-unused-vars'));
  
  // eslint-disable-next-line no-console
  console.log(`📊 找到 ${unusedVarsWarnings.length} 個 no-unused-vars 警告：\n`);
  
  // 顯示前 20 個警告
  unusedVarsWarnings.slice(0, 20).forEach((warning, index) => {
    // eslint-disable-next-line no-console
    console.log(`${index + 1}. ${warning}`);
  });

  if (unusedVarsWarnings.length > 20) {
    // eslint-disable-next-line no-console
    console.log(`\n... 還有 ${unusedVarsWarnings.length - 20} 個警告未顯示`);
  }
}