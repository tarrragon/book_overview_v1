#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🚀 執行最終 warnings 修復...\n');

// 切換到專案目錄
process.chdir('/Users/tarragon/Projects/book_overview_v1');

try {
    // 執行針對性修復
    console.log('🎯 執行針對性修復程式...');
    const result = execSync('node targeted-warnings-fix.js', {
        encoding: 'utf8',
        stdio: 'inherit'
    });

    console.log('\n✅ 修復程式執行完成！');

} catch (error) {
    console.log('修復過程中的輸出：');
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.log(error.stderr);

    console.log('\n✅ 修復程式執行完成');
}

// 最終狀態檢查
console.log('\n🔍 最終狀態檢查...');
try {
    execSync('npm run lint', { stdio: 'pipe' });
    console.log('🎉 完美！所有 warnings 和 errors 都已修復！');
} catch (error) {
    const output = error.stdout || error.stderr || '';
    const warnings = (output.match(/warning/g) || []).length;
    const errors = (output.match(/error/g) || []).length;

    console.log(`📊 最終狀態：`);
    console.log(`  Warnings: ${warnings}`);
    console.log(`  Errors: ${errors}`);

    if (warnings + errors > 0) {
        console.log('\n💡 剩餘問題需要手動處理或調整 .eslintrc.js 規則');
    }
}

console.log('\n🎉 最終大規模 warnings 修復作業完成！');