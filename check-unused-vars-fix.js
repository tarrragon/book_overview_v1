#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔍 檢查 no-unused-vars 修復效果...\n');

try {
  // 運行 ESLint 並統計 no-unused-vars 警告
  const lintOutput = execSync('npm run lint 2>&1', {
    encoding: 'utf8',
    cwd: '/Users/tarragon/Projects/book_overview_v1'
  });

  console.log('✅ ESLint 執行成功！沒有發現錯誤。');

} catch (error) {
  const output = error.stdout || error.stderr || '';

  // 統計 no-unused-vars 警告
  const unusedVarsWarnings = output.split('\n').filter(line =>
    line.includes('no-unused-vars')
  );

  console.log('📊 修復結果統計：');
  console.log(`   - no-unused-vars 警告：${unusedVarsWarnings.length} 個`);

  if (unusedVarsWarnings.length > 0) {
    console.log('\n🔧 剩餘的 no-unused-vars 警告：');
    unusedVarsWarnings.slice(0, 10).forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning.trim()}`);
    });

    if (unusedVarsWarnings.length > 10) {
      console.log(`   ... 還有 ${unusedVarsWarnings.length - 10} 個警告`);
    }
  } else {
    console.log('🎉 所有 no-unused-vars 警告已成功修復！');
  }

  // 統計其他類型的問題
  const allWarnings = output.split('\n').filter(line =>
    line.includes('warning') || line.includes('error')
  );

  console.log(`\n📋 整體 ESLint 狀態：`);
  console.log(`   - 總警告/錯誤數：${allWarnings.length} 個`);

  // 顯示最後的統計行
  const summaryLines = output.split('\n').filter(line =>
    line.includes('problems') || line.includes('errors') || line.includes('warnings')
  );

  if (summaryLines.length > 0) {
    console.log('\n📈 ESLint 總結：');
    summaryLines.forEach(line => {
      if (line.trim()) {
        console.log(`   ${line.trim()}`);
      }
    });
  }
}

console.log('\n✨ 修復完成！');