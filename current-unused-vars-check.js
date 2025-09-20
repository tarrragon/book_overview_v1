#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 檢查當前的 no-unused-vars 警告...\n');

try {
  // 執行 ESLint
  const result = execSync('cd /Users/tarragon/Projects/book_overview_v1 && npm run lint 2>&1', {
    encoding: 'utf8'
  });

  console.log('✅ ESLint 檢查通過，沒有發現錯誤或警告');
  console.log('沒有 no-unused-vars 警告需要修復');

} catch (error) {
  const output = error.stdout || '';

  if (!output) {
    console.log('❌ 無法取得 ESLint 輸出');
    process.exit(1);
  }

  // 將輸出保存到檔案，方便分析
  fs.writeFileSync('/Users/tarragon/Projects/book_overview_v1/current-lint-output.txt', output);

  const lines = output.split('\n');

  // 找出所有 no-unused-vars 警告
  const unusedVarsLines = lines.filter(line =>
    line.includes('no-unused-vars') && !line.includes('eslint-disable')
  );

  console.log(`📊 找到 ${unusedVarsLines.length} 個 no-unused-vars 警告\n`);

  if (unusedVarsLines.length > 0) {
    console.log('詳細的 no-unused-vars 警告:');

    // 按檔案分組
    let currentFile = '';
    const fileWarnings = {};

    for (const line of lines) {
      if (line.match(/^\/.*\.js$/)) {
        currentFile = line.trim();
      } else if (line.includes('no-unused-vars') && !line.includes('eslint-disable')) {
        if (!fileWarnings[currentFile]) {
          fileWarnings[currentFile] = [];
        }
        fileWarnings[currentFile].push(line.trim());
      }
    }

    // 顯示按檔案分組的警告
    Object.entries(fileWarnings).forEach(([file, warnings]) => {
      const fileName = file.split('/').pop() || file;
      console.log(`\n📄 ${fileName} (${warnings.length} 個警告):`);
      warnings.forEach(warning => {
        console.log(`   ${warning}`);
      });
    });

    // 顯示總計
    const summaryLine = lines.find(line =>
      line.includes('✖') && (line.includes('problems') || line.includes('errors') || line.includes('warnings'))
    );

    if (summaryLine) {
      console.log(`\n📊 總計: ${summaryLine}`);
    }
  }
}