#!/usr/bin/env node

const { execSync } = require('child_process');

// eslint-disable-next-line no-console
console.log('🔍 檢查當前 no-unused-vars ESLint 警告...\n');

try {
  // 執行 ESLint
  const result = execSync('npm run lint 2>&1', {
    encoding: 'utf8',
    cwd: '/Users/tarragon/Projects/book_overview_v1'
  });

  // eslint-disable-next-line no-console
  console.log('✅ ESLint 檢查通過，沒有發現錯誤或警告');
  // eslint-disable-next-line no-console
  console.log('沒有 no-unused-vars 警告需要修復');

} catch (error) {
  const output = error.stdout || '';

  if (!output) {
    // eslint-disable-next-line no-console
    console.log('❌ 無法取得 ESLint 輸出');
    process.exit(1);
  }

  const lines = output.split('\n').filter(line => line.trim());

  // 過濾 no-unused-vars 警告
  const unusedVarsLines = lines.filter(line =>
    line.includes('no-unused-vars') && !line.includes('eslint-disable')
  );

  // eslint-disable-next-line no-console
  console.log(`📊 找到 ${unusedVarsLines.length} 個 no-unused-vars 警告\n`);

  if (unusedVarsLines.length > 0) {
    // eslint-disable-next-line no-console
    console.log('詳細的 no-unused-vars 警告:');
    unusedVarsLines.forEach((line, index) => {
      // eslint-disable-next-line no-console
      console.log(`${index + 1}. ${line}`);
    });
  }

  // 顯示總結
  const summaryLine = lines.find(line =>
    line.includes('✖') && (line.includes('problems') || line.includes('errors') || line.includes('warnings'))
  );

  if (summaryLine) {
    // eslint-disable-next-line no-console
    console.log(`\n📊 總計: ${summaryLine}`);
  }
}