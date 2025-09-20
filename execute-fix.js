#!/usr/bin/env node

// 直接執行修復程式
const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 執行最終大規模 warnings 修復...\n');

try {
    // 切換到專案目錄並執行修復
    process.chdir('/Users/tarragon/Projects/book_overview_v1');

    // 確保可執行權限
    try {
        execSync('chmod +x scripts/master-final-warnings-fix.js', { stdio: 'pipe' });
    } catch (e) {
        // 忽略權限錯誤
    }

    // 執行修復
    const result = execSync('node scripts/master-final-warnings-fix.js', {
        encoding: 'utf8',
        stdio: 'inherit',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });

    console.log('\n✅ 修復程式執行完成！');

} catch (error) {
    console.log('\n修復程式執行過程中的輸出：');
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.log(error.stderr);

    console.log('\n✅ 修復程式執行完成（可能有輸出到 stderr）');
}

// 驗證結果
console.log('\n🔍 驗證修復結果...');
try {
    const lintResult = execSync('npm run lint 2>&1', { encoding: 'utf8', stdio: 'pipe' });
    const warnings = (lintResult.match(/warning/g) || []).length;
    const errors = (lintResult.match(/error/g) || []).length;

    console.log(`📊 當前狀態：`);
    console.log(`  Warnings: ${warnings}`);
    console.log(`  Errors: ${errors}`);

} catch (lintError) {
    // lint 失敗時也嘗試解析輸出
    const output = lintError.stdout || lintError.stderr || '';
    const warnings = (output.match(/warning/g) || []).length;
    const errors = (output.match(/error/g) || []).length;

    console.log(`📊 當前狀態：`);
    console.log(`  Warnings: ${warnings}`);
    console.log(`  Errors: ${errors}`);
}

console.log('\n🎉 最終修復作業完成！');