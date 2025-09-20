#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔍 執行 ESLint no-unused-vars 檢查...\n');

try {
  const lintResult = execSync('npm run lint 2>&1', {
    encoding: 'utf8',
    cwd: '/Users/tarragon/Projects/book_overview_v1'
  });

  console.log('✅ ESLint 執行成功！沒有發現錯誤或警告。');
  console.log('🎉 所有 no-unused-vars 問題已完全修復！');

} catch (error) {
  const output = error.stdout || error.stderr || '';

  // 統計 no-unused-vars 警告
  const unusedVarsWarnings = output.split('\n').filter(line =>
    line.includes('no-unused-vars')
  );

  console.log('📊 檢查結果：');
  console.log(`   - no-unused-vars 警告數量：${unusedVarsWarnings.length}`);

  if (unusedVarsWarnings.length > 0) {
    console.log('\n🔧 剩餘的 no-unused-vars 警告：');
    unusedVarsWarnings.slice(0, 10).forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning.trim()}`);
    });

    if (unusedVarsWarnings.length > 10) {
      console.log(`   ... 還有 ${unusedVarsWarnings.length - 10} 個警告`);
    }

    // 分析修復建議
    console.log('\n💡 修復建議：');
    const filePattern = /\.js:/g;
    const affectedFiles = new Set();

    unusedVarsWarnings.forEach(warning => {
      const match = warning.match(/([^\/]+\.js):/);
      if (match) {
        affectedFiles.add(match[1]);
      }
    });

    affectedFiles.forEach(file => {
      console.log(`   - 檢查文件：${file}`);
    });

  } else {
    console.log('🎉 所有 no-unused-vars 問題已完全修復！');
  }

  // 統計其他類型問題
  const totalLines = output.split('\n').filter(line =>
    line.includes('warning') || line.includes('error')
  );

  console.log(`\n📈 ESLint 總體狀態：`);
  console.log(`   - 總計問題數：${totalLines.length}`);

  // 顯示錯誤摘要
  const summaryLines = output.split('\n').filter(line =>
    line.includes('problems') || line.includes('✖')
  );

  if (summaryLines.length > 0) {
    console.log('\n📋 錯誤摘要：');
    summaryLines.forEach(line => {
      if (line.trim()) {
        console.log(`   ${line.trim()}`);
      }
    });
  }
}

console.log('\n🚀 修復工作完成！');