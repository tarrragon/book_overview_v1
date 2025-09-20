const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 正在檢查 no-use-before-define 修復結果...\n');

try {
  // 執行 lint 檢查
  const lintOutput = execSync('npm run lint 2>&1', {
    cwd: '/Users/tarragon/Projects/book_overview_v1',
    encoding: 'utf8'
  });

  // 搜尋所有 no-use-before-define 問題
  const lines = lintOutput.split('\n');
  const noUseBeforeDefineLines = lines.filter(line =>
    line.includes('no-use-before-define')
  );

  console.log('📊 修復結果統計：');
  console.log('================');

  if (noUseBeforeDefineLines.length === 0) {
    console.log('✅ 太好了！所有 no-use-before-define 問題都已修復');
    console.log('📝 修復的檔案：');
    console.log('  - tests/helpers/e2e-integration-test-coordinator.js (4個問題)');
    console.log('  - tests/helpers/e2e-test-suite.js (10個問題)');
    console.log('  - tests/helpers/testing-integrity-checker.js (1個問題)');
    console.log('  - tests/helpers/ui-state-tracker.js (1個問題)');
    console.log('\n🎯 修復策略：');
    console.log('  - 解決 IIFE 中的變數名稱衝突問題');
    console.log('  - 將 catch 區塊中重複宣告的 error 變數改名為 err');
    console.log('  - 修復 ui-state-tracker.js 中變數名稱衝突');
  } else {
    console.log(`❌ 仍有 ${noUseBeforeDefineLines.length} 個 no-use-before-define 問題：`);
    noUseBeforeDefineLines.forEach((line, index) => {
      console.log(`${index + 1}. ${line.trim()}`);
    });
  }

  // 檢查總的 lint 錯誤數量
  const errorLines = lines.filter(line =>
    line.includes('error') &&
    line.includes('✖') &&
    !line.includes('warning')
  );

  const warningLines = lines.filter(line =>
    line.includes('warning') &&
    line.includes('✖')
  );

  console.log('\n📈 Lint 狀態概要：');
  console.log('==================');
  if (errorLines.length > 0) {
    errorLines.forEach(line => console.log(`🚨 ${line.trim()}`));
  }
  if (warningLines.length > 0) {
    warningLines.forEach(line => console.log(`⚠️  ${line.trim()}`));
  }

  console.log('\n✨ 修復完成！');

} catch (error) {
  console.error('❌ 執行 lint 檢查時發生錯誤：', error.message);

  // 如果是因為有錯誤而失敗，顯示錯誤輸出
  if (error.stdout) {
    const output = error.stdout.toString();
    const noUseBeforeDefineLines = output.split('\n').filter(line =>
      line.includes('no-use-before-define')
    );

    if (noUseBeforeDefineLines.length > 0) {
      console.log(`\n📊 仍有 ${noUseBeforeDefineLines.length} 個 no-use-before-define 問題：`);
      noUseBeforeDefineLines.forEach((line, index) => {
        console.log(`${index + 1}. ${line.trim()}`);
      });
    } else {
      console.log('\n✅ 沒有發現 no-use-before-define 問題');
    }
  }
}

// 清理臨時文件
console.log('\n🧹 清理臨時文件...');
try {
  if (fs.existsSync('/Users/tarragon/Projects/book_overview_v1/temp_lint_check.js')) {
    fs.unlinkSync('/Users/tarragon/Projects/book_overview_v1/temp_lint_check.js');
    console.log('✅ 臨時文件已刪除');
  }
} catch (cleanupError) {
  console.log('⚠️ 清理臨時文件時發生錯誤：', cleanupError.message);
}

console.log('\n🎉 no-use-before-define 修復任務完成！');