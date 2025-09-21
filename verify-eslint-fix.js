#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔍 ESLint 修復效果驗證');
console.log('=' .repeat(50));

function getLintResults() {
  try {
    const result = execSync('npm run lint 2>&1', { encoding: 'utf8' });
    return result;
  } catch (error) {
    return error.stdout || error.message || '';
  }
}

function analyzeLintOutput(output) {
  const lines = output.split('\n');

  let totalWarnings = 0;
  let totalErrors = 0;
  const ruleStats = {};
  const fileStats = {};

  lines.forEach(line => {
    // 計算警告和錯誤
    if (line.includes('warning')) {
      totalWarnings++;

      // 提取規則名稱
      const ruleMatch = line.match(/([a-z-/]+)$/);
      if (ruleMatch) {
        const rule = ruleMatch[1];
        ruleStats[rule] = (ruleStats[rule] || 0) + 1;
      }

      // 提取文件名
      const fileMatch = line.match(/([^/]+\.js):/);
      if (fileMatch) {
        const file = fileMatch[1];
        fileStats[file] = (fileStats[file] || 0) + 1;
      }
    }

    if (line.includes('error')) {
      totalErrors++;
    }
  });

  // 查找總結行
  const summaryLine = lines.find(line =>
    line.includes('problem') && (line.includes('warning') || line.includes('error'))
  );

  return {
    totalWarnings,
    totalErrors,
    ruleStats,
    fileStats,
    summaryLine,
    rawOutput: output
  };
}

function main() {
  console.log('🔍 步驟 1: 執行 ESLint 檢查...');

  const lintOutput = getLintResults();
  const analysis = analyzeLintOutput(lintOutput);

  console.log('\n📊 當前狀態分析:');
  console.log(`   錯誤 (errors): ${analysis.totalErrors} 個`);
  console.log(`   警告 (warnings): ${analysis.totalWarnings} 個`);

  if (analysis.summaryLine) {
    console.log(`   官方統計: ${analysis.summaryLine.trim()}`);
  }

  if (analysis.totalWarnings === 0 && analysis.totalErrors === 0) {
    console.log('\n🎉 完美！達成目標：0 errors + 0 warnings');
    console.log('🏆 所有 ESLint 問題已成功修復！');
    return;
  }

  if (analysis.totalWarnings > 0) {
    console.log('\n📈 剩餘警告分佈 (按規則):');
    Object.entries(analysis.ruleStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([rule, count]) => {
        console.log(`   ${rule}: ${count} 個`);
      });

    console.log('\n📁 剩餘警告分佈 (按文件):');
    Object.entries(analysis.fileStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([file, count]) => {
        console.log(`   ${file}: ${count} 個`);
      });
  }

  if (analysis.totalErrors > 0) {
    console.log('\n🚨 需要優先處理錯誤!');
    console.log('   建議先修復 errors，再處理 warnings');
  }

  console.log('\n💡 修復進度評估:');

  // 基於原始目標 105 個警告進行評估
  const originalWarnings = 105;
  const currentWarnings = analysis.totalWarnings;
  const fixedWarnings = Math.max(0, originalWarnings - currentWarnings);
  const fixRate = originalWarnings > 0 ? (fixedWarnings / originalWarnings * 100).toFixed(1) : 0;

  console.log(`   原始警告: ${originalWarnings} 個`);
  console.log(`   當前警告: ${currentWarnings} 個`);
  console.log(`   已修復: ${fixedWarnings} 個`);
  console.log(`   修復率: ${fixRate}%`);

  if (currentWarnings > 0) {
    console.log('\n🔧 建議下一步動作:');

    if (analysis.ruleStats['no-unused-vars'] > 0) {
      console.log(`   • 仍有 ${analysis.ruleStats['no-unused-vars']} 個 no-unused-vars 需要處理`);
    }

    if (analysis.ruleStats['no-console'] > 0) {
      console.log(`   • 有 ${analysis.ruleStats['no-console']} 個 no-console 需要處理`);
    }

    console.log('\n   執行指令:');
    console.log('   npm run lint:fix                # 自動修復格式問題');
    console.log('   npm run lint | head -20         # 查看前 20 個警告');
    console.log('   node rapid-final-fix.js         # 執行快速修復腳本');
  }

  console.log('\n📋 品質檢查清單:');
  console.log(`   ${analysis.totalErrors === 0 ? '✅' : '❌'} 無 ESLint 錯誤`);
  console.log(`   ${analysis.totalWarnings === 0 ? '✅' : '❌'} 無 ESLint 警告`);
  console.log(`   ${fixRate >= 80 ? '✅' : '⚠️'} 修復率 >= 80%`);

  // 執行測試檢查
  console.log('\n🧪 測試狀態檢查:');
  try {
    execSync('npm test', { stdio: 'pipe' });
    console.log('   ✅ 所有測試通過');
  } catch (error) {
    console.log('   ❌ 有測試失敗，需要檢查');
  }
}

if (require.main === module) {
  main();
}