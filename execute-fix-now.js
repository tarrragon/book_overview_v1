#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 立即執行 ESLint 警告修復...\n');

// 設定權限
try {
    execSync('chmod +x *.js', { cwd: '/Users/tarragon/Projects/book_overview_v1' });
    execSync('chmod +x *.sh', { cwd: '/Users/tarragon/Projects/book_overview_v1' });
} catch (error) {
    console.log('權限設定:', error.message);
}

// 步驟 1: 檢查當前狀況
console.log('📋 步驟 1: 檢查當前警告狀況...');
console.log('==========================================');

try {
    const checkResult = execSync('node execute-check.js', {
        encoding: 'utf8',
        cwd: '/Users/tarragon/Projects/book_overview_v1'
    });
    console.log(checkResult);
} catch (error) {
    console.log('檢查結果:', error.stdout || error.message);
}

console.log('');

// 步驟 2: 執行主要修復
console.log('📋 步驟 2: 執行主要修復流程...');
console.log('==========================================');

try {
    const fixResult = execSync('node master-eslint-warnings-fix.js', {
        encoding: 'utf8',
        cwd: '/Users/tarragon/Projects/book_overview_v1',
        timeout: 300000 // 5分鐘超時
    });
    console.log(fixResult);
} catch (error) {
    console.log('修復結果:', error.stdout || error.message);
}

console.log('');

// 步驟 3: 最終驗證
console.log('📋 步驟 3: 最終驗證...');
console.log('==========================================');

try {
    let lintOutput = '';
    try {
        lintOutput = execSync('npm run lint', {
            encoding: 'utf8',
            cwd: '/Users/tarragon/Projects/book_overview_v1'
        });
        console.log('🎉 ESLint 檢查通過！達到 100% 合規狀態！');
    } catch (error) {
        lintOutput = error.stdout || error.message || '';

        // 統計警告
        const warningCount = (lintOutput.match(/warning/g) || []).length;
        const errorCount = (lintOutput.match(/error/g) || []).length;

        console.log('📊 最終狀況：');
        console.log(`  Errors: ${errorCount}`);
        console.log(`  Warnings: ${warningCount}`);

        if (warningCount + errorCount === 0) {
            console.log('🎉 實際上已達到完美合規狀態！');
        } else {
            console.log('\n前 10 個剩餘問題：');
            const problems = lintOutput.split('\n').filter(line =>
                line.includes('warning') || line.includes('error')
            ).slice(0, 10);
            problems.forEach(problem => console.log(`  ${problem.trim()}`));
        }
    }
} catch (error) {
    console.error('驗證失敗:', error.message);
}

console.log('\n🎯 ESLint 警告修復執行完成！');