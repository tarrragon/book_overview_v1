#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  console.log('🔍 檢查剩餘的 no-console 警告...\n');

  const lintOutput = execSync('npm run lint 2>&1', {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
  });

  // 提取 no-console 警告
  const consoleWarnings = lintOutput
    .split('\n')
    .filter(line => line.includes('no-console'))
    .slice(0, 20); // 只顯示前20個

  if (consoleWarnings.length === 0) {
    console.log('✅ 沒有 no-console 警告！');
  } else {
    console.log(`⚠️ 發現 ${consoleWarnings.length} 個 no-console 警告（顯示前20個）:\n`);

    consoleWarnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning.trim()}`);
    });

    // 統計各文件的警告數量
    const fileWarnings = {};
    consoleWarnings.forEach(warning => {
      const match = warning.match(/^([^:]+):/);
      if (match) {
        const file = match[1].replace(/^.*\//, ''); // 只保留檔名
        fileWarnings[file] = (fileWarnings[file] || 0) + 1;
      }
    });

    console.log('\n📊 各文件警告統計:');
    Object.entries(fileWarnings)
      .sort((a, b) => b[1] - a[1])
      .forEach(([file, count]) => {
        console.log(`   ${file}: ${count} 個警告`);
      });
  }

  // 檢查總體 lint 狀態
  const totalIssues = lintOutput.match(/✖ (\d+) problems?/);
  if (totalIssues) {
    console.log(`\n📋 ESLint 總計: ${totalIssues[1]} 個問題`);
  }

} catch (error) {
  console.error('檢查過程發生錯誤:', error.message);
}