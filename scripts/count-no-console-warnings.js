#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 正在分析 no-console ESLint warnings...');

try {
  // 執行 ESLint 並獲取 no-console 警告
  const lintOutput = execSync('npm run lint 2>&1', {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 50 // 50MB buffer
  });

  // 解析 no-console 警告
  const noConsoleLines = lintOutput.split('\n')
    .filter(line => line.includes('no-console'))
    .map((line, index) => ({
      index: index + 1,
      line: line.trim(),
      file: line.split(':')[0],
      lineNumber: line.split(':')[1],
      message: line.split('no-console')[1]
    }));

  console.log(`總共找到 ${noConsoleLines.length} 個 no-console warnings`);

  // 識別第151-300個警告
  const targetRange = noConsoleLines.slice(150, 300); // 第151-300個 (0-based indexing)

  console.log(`\n📋 第151-300個 no-console warnings (共 ${targetRange.length} 個):`);

  // 按檔案分組
  const fileGroups = {};
  targetRange.forEach(warning => {
    const file = warning.file;
    if (!fileGroups[file]) {
      fileGroups[file] = [];
    }
    fileGroups[file].push(warning);
  });

  // 輸出分析結果
  let counter = 151;
  Object.keys(fileGroups).forEach(file => {
    console.log(`\n📁 ${file}:`);
    fileGroups[file].forEach(warning => {
      console.log(`  ${counter}. Line ${warning.lineNumber}: ${warning.message}`);
      counter++;
    });
  });

  // 生成處理報告
  const report = {
    totalWarnings: noConsoleLines.length,
    targetRange: { start: 151, end: 300, count: targetRange.length },
    fileGroups: Object.keys(fileGroups).map(file => ({
      file,
      warningCount: fileGroups[file].length,
      lines: fileGroups[file].map(w => w.lineNumber)
    }))
  };

  fs.writeFileSync('no-console-warnings-151-300.json', JSON.stringify(report, null, 2));
  console.log('\n✅ 分析結果已保存到 no-console-warnings-151-300.json');

} catch (error) {
  console.error('❌ 執行分析時發生錯誤:', error.message);
  process.exit(1);
}