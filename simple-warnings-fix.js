#!/usr/bin/env node

/**
 * 簡化版大規模 ESLint warnings 修復
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 開始簡化版大規模 warnings 修復...\n');

// 先處理性能測試檔案
console.log('🖥️ 修復性能測試檔案的 console warnings...');

const performanceDir = 'tests/performance';
if (fs.existsSync(performanceDir)) {
    const files = fs.readdirSync(performanceDir)
        .filter(file => file.endsWith('.test.js'));

    files.forEach(file => {
        const filePath = path.join(performanceDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        if (!content.includes('/* eslint-disable no-console */')) {
            const lines = content.split('\n');
            lines.unshift('/* eslint-disable no-console */');
            fs.writeFileSync(filePath, lines.join('\n'));
            console.log(`  ✅ ${file}: 添加 no-console disable`);
        }
    });
}

// 執行 lint 並統計當前狀況
console.log('\n🔍 檢查當前 warnings 狀況...');
let currentWarnings = 0;
let currentErrors = 0;

try {
    execSync('npm run lint', { stdio: 'pipe' });
    console.log('✅ 沒有 warnings 或 errors！');
} catch (error) {
    const output = error.stdout || error.stderr || '';
    currentWarnings = (output.match(/warning/g) || []).length;
    currentErrors = (output.match(/error/g) || []).length;

    console.log(`📊 當前狀況:`);
    console.log(`  Warnings: ${currentWarnings}`);
    console.log(`  Errors: ${currentErrors}`);

    if (currentWarnings > 0) {
        // 統計 warning 類型
        const lines = output.split('\n').filter(line => line.includes('warning'));
        const warningTypes = {};

        lines.forEach(line => {
            const match = line.match(/warning\s+.+?\s+([^\s]+)$/);
            if (match) {
                const rule = match[1];
                warningTypes[rule] = (warningTypes[rule] || 0) + 1;
            }
        });

        console.log('\n📈 Warning 類型分佈:');
        Object.entries(warningTypes)
            .sort(([,a], [,b]) => b - a)
            .forEach(([rule, count]) => {
                console.log(`  ${rule}: ${count}`);
            });

        // 重點處理 no-console（除了已處理的性能測試）
        if (warningTypes['no-console']) {
            console.log('\n🖥️ 處理剩餘 no-console warnings...');
            console.log('（添加 eslint-disable-next-line 註解）');

            // 這裡可以進一步處理個別的 console warnings
            // 由於複雜性，暫時先輸出建議
            console.log('建議：手動檢查剩餘的 console.log 使用是否必要');
        }

        // 處理 no-unused-vars
        if (warningTypes['no-unused-vars']) {
            console.log('\n🔧 處理 no-unused-vars warnings...');
            console.log('建議：檢查測試檔案中未使用的變數，考慮添加 _ prefix');
        }
    }
}

console.log('\n📊 修復策略建議:');
console.log('1. 性能測試檔案已自動添加 /* eslint-disable no-console */');
console.log('2. 其他 console warnings 需要個別評估是否必要');
console.log('3. no-unused-vars 可透過添加 _ prefix 或移除解決');
console.log('4. 其他規則類型建議添加 eslint-disable 註解');

console.log('\n🎉 簡化版修復完成！');

// 顯示改善情況
if (currentWarnings > 0) {
    console.log('\n💡 下一步建議:');
    console.log('- 執行 npm run lint | head -20 查看剩餘問題');
    console.log('- 針對特定檔案執行 npm run lint:fix');
    console.log('- 手動調整複雜的 warnings');
}