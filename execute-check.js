#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔍 執行 ESLint 檢查當前狀況...\n');

try {
    let output = '';
    try {
        output = execSync('npm run lint 2>&1', {
            encoding: 'utf8',
            timeout: 60000,
            cwd: '/Users/tarragon/Projects/book_overview_v1'
        });
    } catch (error) {
        output = error.stdout || error.message || '';
    }

    if (!output) {
        console.log('❌ 無法獲取 ESLint 輸出');
        return;
    }

    const lines = output.split('\n');

    // 統計所有警告類型
    const warnings = {
        'no-unused-vars': [],
        'no-console': [],
        'no-new': [],
        'no-callback-literal': [],
        'other': []
    };

    let totalWarnings = 0;
    let totalErrors = 0;

    for (const line of lines) {
        if (line.includes('warning')) {
            totalWarnings++;
            if (line.includes('no-unused-vars')) warnings['no-unused-vars'].push(line.trim());
            else if (line.includes('no-console')) warnings['no-console'].push(line.trim());
            else if (line.includes('no-new')) warnings['no-new'].push(line.trim());
            else if (line.includes('no-callback-literal')) warnings['no-callback-literal'].push(line.trim());
            else warnings['other'].push(line.trim());
        }
        if (line.includes('error')) {
            totalErrors++;
        }
    }

    console.log('📈 ESLint 狀況統計：');
    console.log(`總計 Errors: ${totalErrors}`);
    console.log(`總計 Warnings: ${totalWarnings}\n`);

    console.log('警告類型分布：');
    Object.entries(warnings).forEach(([type, warningList]) => {
        if (warningList.length > 0) {
            console.log(`\n🔸 ${type}: ${warningList.length} 個`);
            // 顯示前 3 個警告
            warningList.slice(0, 3).forEach((warning, i) => {
                console.log(`   ${i + 1}. ${warning}`);
            });
            if (warningList.length > 3) {
                console.log(`   ... 以及其他 ${warningList.length - 3} 個`);
            }
        }
    });

} catch (error) {
    console.error('檢查過程中發生錯誤:', error.message);
}