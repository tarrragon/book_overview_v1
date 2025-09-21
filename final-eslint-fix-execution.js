#!/usr/bin/env node

/**
 * 最終 ESLint 警告修復執行腳本
 * 針對當前專案的實際警告狀況進行修復
 */

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🚀 最終 ESLint 警告修復開始...\n');

// 執行前檢查
console.log('📋 步驟 1: 檢查當前 ESLint 狀況');
console.log('==========================================');

let initialWarningCount = 0;
let initialErrorCount = 0;

try {
    execSync('npx eslint src/ tests/', { encoding: 'utf8' });
    console.log('✅ 目前沒有 ESLint 警告或錯誤！');
    process.exit(0);
} catch (error) {
    const output = error.stdout || '';
    console.log('發現 ESLint 問題，開始分析...\n');

    // 簡單統計
    initialWarningCount = (output.match(/warning/g) || []).length;
    initialErrorCount = (output.match(/error/g) || []).length;

    console.log(`初始狀況: ${initialErrorCount} errors, ${initialWarningCount} warnings`);
}

if (initialWarningCount === 0 && initialErrorCount === 0) {
    console.log('🎉 專案已經符合 ESLint 規範！');
    process.exit(0);
}

// 執行 ESLint 自動修復
console.log('\n📋 步驟 2: 執行 ESLint 自動修復');
console.log('==========================================');

try {
    execSync('npx eslint src/ tests/ --fix', {
        encoding: 'utf8',
        stdio: 'inherit'
    });
    console.log('✅ ESLint 自動修復完成');
} catch (error) {
    console.log('⚠️ ESLint 自動修復完成，但仍有問題需要手動處理');
}

// 檢查修復後狀況
console.log('\n📋 步驟 3: 檢查修復後狀況');
console.log('==========================================');

let remainingWarnings = 0;
let remainingErrors = 0;

try {
    execSync('npx eslint src/ tests/', { encoding: 'utf8' });
    console.log('🎉 ESLint 檢查通過！達到 100% 合規狀態！');
} catch (error) {
    const output = error.stdout || '';
    remainingWarnings = (output.match(/warning/g) || []).length;
    remainingErrors = (output.match(/error/g) || []).length;

    console.log(`修復後狀況: ${remainingErrors} errors, ${remainingWarnings} warnings`);

    if (remainingWarnings > 0 || remainingErrors > 0) {
        console.log('\n需要進一步手動修復的問題：');
        console.log(output.split('\n').slice(0, 20).join('\n'));
    }
}

// 執行測試確保功能完整性
console.log('\n📋 步驟 4: 驗證功能完整性');
console.log('==========================================');

try {
    execSync('npm test', {
        encoding: 'utf8',
        stdio: 'inherit',
        timeout: 120000
    });
    console.log('✅ 測試通過，功能完整性確認');
} catch (error) {
    console.log('⚠️ 測試發現問題，請檢查修復是否影響功能');
}

// 生成最終報告
const finalReport = `# ESLint 修復最終報告

## 📊 修復結果
- 執行時間: ${new Date().toLocaleString()}
- 初始狀況: ${initialErrorCount} errors, ${initialWarningCount} warnings
- 修復後狀況: ${remainingErrors} errors, ${remainingWarnings} warnings
- 修復效果: ${((initialWarningCount + initialErrorCount - remainingWarnings - remainingErrors) / (initialWarningCount + initialErrorCount) * 100).toFixed(1)}%

## 🎯 最終狀態
${remainingWarnings === 0 && remainingErrors === 0 ? '🏆 達到 100% ESLint 合規狀態！' : `📋 剩餘 ${remainingErrors} 個錯誤和 ${remainingWarnings} 個警告需要手動處理`}

## 🔧 修復方法
1. 使用 ESLint 內建的 --fix 自動修復功能
2. 自動修復的問題類型：格式化、引號、分號等
3. 需手動處理的問題：邏輯相關、複雜結構等

## 💡 後續建議
${remainingWarnings === 0 && remainingErrors === 0 ?
  '- 專案已達到 ESLint 完美合規狀態\n- 建議設置 pre-commit hook 維持程式碼品質' :
  '- 針對剩餘問題進行個別分析和修復\n- 考慮調整 ESLint 規則配置以符合專案需求'
}
`;

fs.writeFileSync('/Users/tarragon/Projects/book_overview_v1/final-eslint-fix-report.md', finalReport);

console.log('\n🎯 ESLint 修復執行完成！');
console.log('📋 詳細報告已生成: final-eslint-fix-report.md');

if (remainingWarnings === 0 && remainingErrors === 0) {
    console.log('🏆 恭喜！專案已達到 100% ESLint 合規狀態！');
} else {
    console.log(`📊 修復進度: ${((initialWarningCount + initialErrorCount - remainingWarnings - remainingErrors) / (initialWarningCount + initialErrorCount) * 100).toFixed(1)}%`);
    console.log(`📋 剩餘問題: ${remainingErrors} errors, ${remainingWarnings} warnings`);
}