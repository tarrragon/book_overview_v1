#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 執行最終的 no-console warnings 分析...');

try {
  // 執行 lint 並統計 no-console warnings
  const lintOutput = execSync('npm run lint 2>&1', {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 50
  });

  // 查找所有 no-console 相關的行
  const allLines = lintOutput.split('\n');
  const noConsoleWarnings = allLines.filter(line =>
    line.includes('no-console') &&
    line.includes('.js:') &&
    line.includes('warning')
  );

  console.log(`📊 當前 no-console warnings 總數: ${noConsoleWarnings.length}`);

  if (noConsoleWarnings.length === 0) {
    console.log('🎉 太好了！沒有剩餘的 no-console warnings。');
    return;
  }

  // 分析剩餘的 warnings
  const fileGroups = {};
  noConsoleWarnings.forEach((warning, index) => {
    const parts = warning.split(':');
    if (parts.length >= 2) {
      const file = parts[0].trim();
      const line = parts[1];

      if (!fileGroups[file]) {
        fileGroups[file] = [];
      }

      fileGroups[file].push({
        line: line,
        warning: warning.trim(),
        index: index + 1
      });
    }
  });

  console.log('\n📋 剩餘的 no-console warnings 按檔案分組:');
  Object.keys(fileGroups).forEach(file => {
    console.log(`\n📁 ${file}:`);
    fileGroups[file].forEach(item => {
      console.log(`  ${item.index}. Line ${item.line}`);
    });
  });

  // 分析前 150 個是否已經處理過
  const first150 = noConsoleWarnings.slice(0, 150);
  const range151to300 = noConsoleWarnings.slice(150, 300);

  console.log(`\n📈 分析結果:`);
  console.log(`  前 150 個 warnings: ${first150.length} 個`);
  console.log(`  第 151-300 個 warnings: ${range151to300.length} 個`);
  console.log(`  剩餘 warnings: ${Math.max(0, noConsoleWarnings.length - 300)} 個`);

  if (range151to300.length === 0) {
    console.log('\n✅ 第151-300個warnings已經全部處理完成！');
  } else {
    console.log(`\n⚠️  第151-300個warnings還剩餘 ${range151to300.length} 個需要處理`);

    // 顯示前10個需要處理的
    console.log('\n🎯 前10個需要處理的warnings:');
    range151to300.slice(0, 10).forEach((warning, index) => {
      console.log(`  ${151 + index}. ${warning}`);
    });
  }

  // 保存報告
  const report = {
    timestamp: new Date().toISOString(),
    totalWarnings: noConsoleWarnings.length,
    first150: first150.length,
    range151to300: range151to300.length,
    remainingAfter300: Math.max(0, noConsoleWarnings.length - 300),
    fileGroups: Object.keys(fileGroups).map(file => ({
      file,
      warningCount: fileGroups[file].length
    })),
    status: range151to300.length === 0 ? 'completed' : 'in-progress'
  };

  fs.writeFileSync('console-warnings-final-analysis.json', JSON.stringify(report, null, 2));
  console.log('\n📄 詳細報告已保存到: console-warnings-final-analysis.json');

} catch (error) {
  console.error('❌ 分析過程發生錯誤:', error.message);
}