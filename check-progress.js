#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔍 檢查當前 lint 修復進度...\n');

try {
    const result = execSync('npm run lint 2>&1', { encoding: 'utf8' });
    console.log('✅ 所有 warnings 和 errors 已修復！');
} catch (error) {
    const output = error.stdout || error.stderr || '';

    // 統計當前狀況
    const warnings = (output.match(/warning/g) || []).length;
    const errors = (output.match(/error/g) || []).length;

    console.log(`📊 當前狀況：`);
    console.log(`  Warnings: ${warnings}`);
    console.log(`  Errors: ${errors}`);

    if (warnings > 0) {
        console.log('\n📈 Warning 類型分析：');

        // 分析 warning 類型
        const lines = output.split('\n').filter(line => line.includes('warning'));
        const warningTypes = {};

        lines.forEach(line => {
            const match = line.match(/warning\s+.+?\s+([^\s]+)$/);
            if (match) {
                const rule = match[1];
                warningTypes[rule] = (warningTypes[rule] || 0) + 1;
            }
        });

        Object.entries(warningTypes)
            .sort(([,a], [,b]) => b - a)
            .forEach(([rule, count]) => {
                console.log(`  ${rule}: ${count}`);
            });

        console.log('\n🔍 顯示前 10 個 warnings：');
        lines.slice(0, 10).forEach(line => {
            console.log(`  ${line}`);
        });
    }
}

console.log('\n✅ 檢查完成！');