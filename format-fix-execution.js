#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔧 開始執行格式化錯誤修復');
console.log('==========================');

const PROJECT_ROOT = '/Users/tarragon/Projects/book_overview_v1';

// 步驟 1: 執行 npm run lint:fix
console.log('\n📋 步驟 1: 執行自動格式化修復');
console.log('===============================');

try {
  console.log('正在執行 npm run lint:fix...');

  const fixResult = execSync('npm run lint:fix', {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    timeout: 60000 // 60秒超時
  });

  console.log('✅ npm run lint:fix 執行完成');

  if (fixResult.trim()) {
    console.log('修復輸出：');
    console.log(fixResult);
  } else {
    console.log('✨ 沒有輸出，可能所有格式化問題都已修復');
  }

} catch (error) {
  console.log('⚠️  執行 npm run lint:fix 時遇到問題：');

  if (error.stdout) {
    console.log('標準輸出：');
    console.log(error.stdout);
  }

  if (error.stderr) {
    console.log('錯誤輸出：');
    console.log(error.stderr);
  }

  console.log(`退出代碼: ${error.status || 'unknown'}`);
}

// 步驟 2: 檢查修復效果
console.log('\n📋 步驟 2: 檢查修復效果');
console.log('=======================');

try {
  console.log('正在執行 npm run lint 檢查修復效果...');

  const lintResult = execSync('npm run lint', {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    timeout: 60000
  });

  console.log('🎉 太棒了！所有 lint 檢查都通過了！');
  console.log('修復後的 lint 結果：');
  console.log(lintResult);

} catch (error) {
  console.log('📊 lint 檢查結果（仍有問題需要處理）：');

  if (error.stdout) {
    const output = error.stdout;

    // 統計格式化錯誤
    const lines = output.split('\n');
    const formatErrors = {
      'no-multiple-empty-lines': 0,
      'padded-blocks': 0,
      'no-new-func': 0
    };

    lines.forEach(line => {
      if (line.includes('no-multiple-empty-lines')) formatErrors['no-multiple-empty-lines']++;
      if (line.includes('padded-blocks')) formatErrors['padded-blocks']++;
      if (line.includes('no-new-func')) formatErrors['no-new-func']++;
    });

    const totalFormatErrors = Object.values(formatErrors).reduce((a, b) => a + b, 0);

    console.log(`\n📈 格式化錯誤統計：`);
    console.log(`- no-multiple-empty-lines: ${formatErrors['no-multiple-empty-lines']} 個`);
    console.log(`- padded-blocks: ${formatErrors['padded-blocks']} 個`);
    console.log(`- no-new-func: ${formatErrors['no-new-func']} 個`);
    console.log(`- 總計: ${totalFormatErrors} 個格式化錯誤`);

    if (totalFormatErrors === 0) {
      console.log('✅ 目標格式化錯誤已全部修復！');
    } else {
      console.log('🔧 仍有格式化錯誤需要手動處理');
    }

    // 顯示 lint 總結
    const summaryLines = lines.filter(line =>
      line.includes('problems') || line.includes('errors') || line.includes('warnings')
    );

    if (summaryLines.length > 0) {
      console.log('\n📊 Lint 總結：');
      summaryLines.forEach(line => console.log(line));
    }
  }
}

console.log('\n🎉 格式化修復檢查完成！');
console.log('建議後續步驟：');
console.log('1. 如果仍有格式化錯誤，手動檢查相關檔案');
console.log('2. 執行 npm test 確認修復不會破壞功能');
console.log('3. 提交變更前再次執行 npm run lint 確認');