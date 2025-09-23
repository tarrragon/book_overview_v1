#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔍 獲取實際 ESLint 警告狀況...\n');

try {
    // 執行 ESLint 並捕獲輸出
    execSync('npx eslint src/ tests/ --format=compact', {
        encoding: 'utf8',
        stdio: 'inherit'
    });
    console.log('\n✅ 沒有 ESLint 警告或錯誤！');
} catch (error) {
    console.log('\n📊 實際 ESLint 輸出已顯示上方');
    console.log('\nESLint 發現問題，需要修復。');
}