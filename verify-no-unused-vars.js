#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 驗證 no-unused-vars 修復結果...\n');

try {
  console.log('執行 ESLint 檢查...');
  const result = execSync('npm run lint 2>&1', {
    encoding: 'utf8'
  });

  // 如果沒有錯誤，檢查輸出
  if (result.includes('✓') || result.includes('0 errors') || !result.includes('error')) {
    console.log('✅ 所有 ESLint 檢查通過!');
    console.log('✅ 沒有發現 no-unused-vars 警告');
    return;
  }

} catch (error) {
  const output = error.stdout || error.stderr || '';

  if (!output) {
    console.log('❌ 無法獲取 ESLint 輸出');
    return;
  }

  const lines = output.split('\n').filter(line => line.trim());

  // 檢查 no-unused-vars 特定問題
  const unusedVarsLines = lines.filter(line =>
    line.includes('no-unused-vars') && !line.includes('eslint-disable')
  );

  const otherErrors = lines.filter(line =>
    (line.includes('error') || line.includes('warning')) &&
    !line.includes('no-unused-vars')
  );

  // 顯示結果
  if (unusedVarsLines.length === 0) {
    console.log('✅ 沒有發現 no-unused-vars 警告');
  } else {
    console.log(`⚠️  還有 ${unusedVarsLines.length} 個 no-unused-vars 警告:`);
    unusedVarsLines.forEach((line, i) => {
      console.log(`  ${i + 1}. ${line}`);
    });

    console.log('\n📋 建議的修復方案:');
    unusedVarsLines.forEach(line => {
      if (line.includes("'") && line.includes("is defined but never used")) {
        const match = line.match(/'([^']+)' is defined but never used/);
        if (match) {
          const varName = match[1];
          console.log(`  - 對於變數 '${varName}': 重命名為 '_${varName}' 或移除該變數`);
        }
      }
    });
  }

  if (otherErrors.length > 0) {
    console.log(`\n⚠️  發現其他類型的問題 (${otherErrors.length} 個):`);
    otherErrors.slice(0, 5).forEach(line => {
      console.log(`  - ${line}`);
    });
    if (otherErrors.length > 5) {
      console.log(`  ... 和其他 ${otherErrors.length - 5} 個問題`);
    }
  }

  // 顯示總結
  const summaryLine = lines.find(line =>
    line.includes('problems') || line.includes('errors') || line.includes('warnings')
  );
  if (summaryLine) {
    console.log(`\n📊 ESLint 總結: ${summaryLine}`);
  }

  // 生成修復報告
  const report = {
    timestamp: new Date().toISOString(),
    unusedVarsCount: unusedVarsLines.length,
    otherErrorsCount: otherErrors.length,
    unusedVarsWarnings: unusedVarsLines,
    otherErrors: otherErrors.slice(0, 10),
    summary: summaryLine
  };

  fs.writeFileSync('no-unused-vars-status.json', JSON.stringify(report, null, 2));
  console.log('\n💾 狀態報告已保存到 no-unused-vars-status.json');
}

console.log('\n✅ no-unused-vars 修復驗證完成');