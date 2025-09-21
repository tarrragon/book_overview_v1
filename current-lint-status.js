#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔍 檢查實際 ESLint 狀況...\n');

try {
    // 執行 ESLint
    const result = execSync('npx eslint src/ tests/ --format=compact', {
        encoding: 'utf8',
        cwd: '/Users/tarragon/Projects/book_overview_v1',
        timeout: 60000
    });

    console.log('✅ ESLint 檢查通過！沒有警告或錯誤。');

} catch (error) {
    const output = error.stdout || error.message || '';
    console.log('📊 ESLint 輸出：');
    console.log(output);

    // 統計
    const lines = output.split('\n').filter(line => line.trim());
    const warnings = lines.filter(line => line.includes(': warning: '));
    const errors = lines.filter(line => line.includes(': error: '));

    console.log(`\n📈 統計：`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);

    if (warnings.length > 0) {
        console.log(`\n前 10 個警告：`);
        warnings.slice(0, 10).forEach((warning, i) => {
            console.log(`${i + 1}. ${warning}`);
        });
    }
}