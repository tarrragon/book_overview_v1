#!/usr/bin/env node

const { exec } = require('child_process');

console.log('🔍 檢查當前 no-unused-vars warnings...\n');

exec('npx eslint src/ tests/ --format=stylish', (error, stdout, stderr) => {
    if (error && error.code !== 1) {
        console.error('執行 ESLint 時出錯:', error);
        return;
    }

    const output = stdout + stderr;
    const lines = output.split('\n');

    const unusedVarsWarnings = lines.filter(line =>
        line.includes('no-unused-vars') && line.includes('warning')
    );

    console.log(`📊 總計 no-unused-vars warnings: ${unusedVarsWarnings.length}`);
    console.log('\n🎯 前 20 個 warnings:');
    unusedVarsWarnings.slice(0, 20).forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.trim()}`);
    });

    // 統計不同類型的 warnings
    const warningTypes = {};
    unusedVarsWarnings.forEach(warning => {
        const match = warning.match(/'([^']+)' is (defined but never used|assigned a value but never used)/);
        if (match) {
            const varName = match[1];
            const type = match[2];
            if (!warningTypes[type]) warningTypes[type] = [];
            warningTypes[type].push(varName);
        }
    });

    console.log('\n📋 Warning 類型分析:');
    Object.entries(warningTypes).forEach(([type, vars]) => {
        console.log(`  ${type}: ${vars.length} 個`);
        console.log(`    範例: ${vars.slice(0, 5).join(', ')}`);
    });

    if (unusedVarsWarnings.length > 0) {
        console.log('\n✅ 準備開始大規模清理...');
    } else {
        console.log('\n🎉 沒有 no-unused-vars warnings！');
    }
});