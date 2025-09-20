#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 檢查測試相關的 ESLint 警告...\n');

try {
  // 執行 lint 檢查
  const lintOutput = execSync('npm run lint 2>&1', {
    encoding: 'utf8',
    cwd: '/Users/tarragon/Projects/book_overview_v1'
  });

  console.log('完整 lint 輸出：');
  console.log('='.repeat(50));
  console.log(lintOutput);
  console.log('='.repeat(50));

  // 分析各種警告類型
  const lines = lintOutput.split('\n');

  const warnings = {
    'no-unused-vars': [],
    'no-new': [],
    'n/no-callback-literal': [],
    'multiline-ternary': [],
    'no-control-regex': [],
    'no-console': [],
    'other': []
  };

  let currentFile = null;

  for (const line of lines) {
    // 檢查是否是文件路徑
    if (line.match(/^\/.*\.js$/)) {
      currentFile = line;
      continue;
    }

    // 檢查警告類型
    for (const warningType of Object.keys(warnings)) {
      if (line.includes(warningType)) {
        warnings[warningType].push({
          file: currentFile,
          line: line.trim()
        });
      }
    }

    // 其他錯誤或警告
    if (line.includes('error') || line.includes('warning')) {
      const isKnownType = Object.keys(warnings).some(type => line.includes(type));
      if (!isKnownType && currentFile) {
        warnings.other.push({
          file: currentFile,
          line: line.trim()
        });
      }
    }
  }

  // 輸出分析結果
  console.log('\n📊 警告類型統計：');
  for (const [type, items] of Object.entries(warnings)) {
    if (items.length > 0) {
      console.log(`\n🚨 ${type}: ${items.length} 個警告`);
      items.slice(0, 5).forEach(item => {
        console.log(`   ${item.file || '未知文件'}`);
        console.log(`   → ${item.line}`);
      });
      if (items.length > 5) {
        console.log(`   ... 還有 ${items.length - 5} 個警告`);
      }
    }
  }

  // 專門檢查測試文件
  console.log('\n🧪 測試文件警告統計：');
  const testFileWarnings = Object.entries(warnings).map(([type, items]) => ({
    type,
    testItems: items.filter(item => item.file && item.file.includes('/tests/'))
  })).filter(({testItems}) => testItems.length > 0);

  if (testFileWarnings.length === 0) {
    console.log('✅ 沒有發現測試文件中的警告');
  } else {
    testFileWarnings.forEach(({type, testItems}) => {
      console.log(`\n📝 測試文件中的 ${type}: ${testItems.length} 個`);
      testItems.slice(0, 3).forEach(item => {
        console.log(`   ${item.file}`);
        console.log(`   → ${item.line}`);
      });
    });
  }

} catch (error) {
  console.error('❌ 執行 lint 檢查時發生錯誤：');
  console.error(error.message);

  // 如果是因為有錯誤，嘗試獲取輸出
  if (error.stdout) {
    console.log('\n輸出內容：');
    console.log(error.stdout);
  }
  if (error.stderr) {
    console.log('\n錯誤內容：');
    console.log(error.stderr);
  }
}