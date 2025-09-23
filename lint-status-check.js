#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔍 快速檢查當前 ESLint 狀況...\n');

try {
    let output = '';
    try {
        output = execSync('npm run lint', {
            encoding: 'utf8',
            timeout: 30000,
            cwd: '/Users/tarragon/Projects/book_overview_v1'
        });
        console.log('✅ ESLint 檢查通過！');
        console.log(output);
    } catch (error) {
        output = error.stdout || error.message || '';

        // 統計警告和錯誤
        const lines = output.split('\n');
        let warningCount = 0;
        let errorCount = 0;

        const warnings = {
            'no-unused-vars': 0,
            'no-console': 0,
            'no-new': 0,
            'no-callback-literal': 0,
            'other': 0
        };

        lines.forEach(line => {
            if (line.includes('warning')) {
                warningCount++;
                if (line.includes('no-unused-vars')) warnings['no-unused-vars']++;
                else if (line.includes('no-console')) warnings['no-console']++;
                else if (line.includes('no-new')) warnings['no-new']++;
                else if (line.includes('no-callback-literal')) warnings['no-callback-literal']++;
                else warnings['other']++;
            }
            if (line.includes('error')) {
                errorCount++;
            }
        });

        console.log('📊 當前狀況：');
        console.log(`總計 Errors: ${errorCount}`);
        console.log(`總計 Warnings: ${warningCount}`);

        if (warningCount > 0) {
            console.log('\n警告類型分布：');
            Object.entries(warnings).forEach(([type, count]) => {
                if (count > 0) {
                    console.log(`  ${type}: ${count} 個`);
                }
            });
        }

        console.log('\n前 5 個問題：');
        const problems = lines.filter(line =>
            line.includes('warning') || line.includes('error')
        ).slice(0, 5);
        problems.forEach((problem, i) => {
            console.log(`  ${i + 1}. ${problem.trim()}`);
        });
    }
} catch (error) {
    console.error('檢查失敗:', error.message);
}