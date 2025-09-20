#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 檢查格式化 ESLint 錯誤...');
console.log('=====================================');

try {
  // 執行 lint 檢查
  const lintOutput = execSync('npm run lint', {
    encoding: 'utf8',
    cwd: '/Users/tarragon/Projects/book_overview_v1',
    stdio: 'pipe'
  });

  const lines = lintOutput.split('\n');

  // 分別統計三種格式化錯誤
  const errors = {
    'no-multiple-empty-lines': [],
    'padded-blocks': [],
    'no-new-func': []
  };

  let currentFile = '';

  lines.forEach(line => {
    // 檢測檔案路徑行
    if (line.match(/^\/.*\.js$/)) {
      currentFile = line;
    }

    // 檢測錯誤行
    if (line.includes('no-multiple-empty-lines')) {
      errors['no-multiple-empty-lines'].push(`${currentFile}: ${line.trim()}`);
    }
    if (line.includes('padded-blocks')) {
      errors['padded-blocks'].push(`${currentFile}: ${line.trim()}`);
    }
    if (line.includes('no-new-func')) {
      errors['no-new-func'].push(`${currentFile}: ${line.trim()}`);
    }
  });

  // 輸出統計結果
  console.log('📊 格式化錯誤統計：');
  console.log('==================');

  Object.keys(errors).forEach(errorType => {
    console.log(`\n🚨 ${errorType}: ${errors[errorType].length} 個問題`);
    if (errors[errorType].length > 0 && errors[errorType].length <= 10) {
      errors[errorType].forEach(error => {
        console.log(`  - ${error}`);
      });
    } else if (errors[errorType].length > 10) {
      console.log(`  顯示前10個問題：`);
      errors[errorType].slice(0, 10).forEach(error => {
        console.log(`  - ${error}`);
      });
      console.log(`  ...還有 ${errors[errorType].length - 10} 個問題`);
    }
  });

  // 總計
  const totalErrors = Object.values(errors).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`\n📈 總計格式化錯誤: ${totalErrors} 個`);

  if (totalErrors === 0) {
    console.log('✅ 太好了！沒有發現格式化錯誤！');
  } else {
    console.log('\n🔧 建議使用 npm run lint:fix 自動修復部分格式化問題');
  }

} catch (error) {
  // lint 可能會因為錯誤而退出，但我們仍然可以處理輸出
  if (error.stdout) {
    console.log('⚠️  Lint 檢查發現問題，正在分析輸出...');

    const lines = error.stdout.split('\n');
    const errors = {
      'no-multiple-empty-lines': [],
      'padded-blocks': [],
      'no-new-func': []
    };

    let currentFile = '';

    lines.forEach(line => {
      if (line.match(/^\/.*\.js$/)) {
        currentFile = line;
      }

      if (line.includes('no-multiple-empty-lines')) {
        errors['no-multiple-empty-lines'].push(`${currentFile}: ${line.trim()}`);
      }
      if (line.includes('padded-blocks')) {
        errors['padded-blocks'].push(`${currentFile}: ${line.trim()}`);
      }
      if (line.includes('no-new-func')) {
        errors['no-new-func'].push(`${currentFile}: ${line.trim()}`);
      }
    });

    console.log('\n📊 格式化錯誤統計：');
    Object.keys(errors).forEach(errorType => {
      console.log(`🚨 ${errorType}: ${errors[errorType].length} 個問題`);
      if (errors[errorType].length > 0 && errors[errorType].length <= 5) {
        errors[errorType].forEach(error => {
          console.log(`  - ${error}`);
        });
      }
    });

    const totalErrors = Object.values(errors).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`\n📈 總計格式化錯誤: ${totalErrors} 個`);
  } else {
    console.error('❌ 執行 lint 檢查時發生錯誤:', error.message);
  }
}

console.log('\n🎉 格式化錯誤檢查完成！');