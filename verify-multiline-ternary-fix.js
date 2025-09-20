#!/usr/bin/env node

/**
 * 驗證 multiline-ternary 修復結果
 */

const { execSync } = require('child_process');

function verifyMultilineTernaryFix() {
    console.log('🔍 驗證 multiline-ternary 修復結果...\n');

    try {
        const lintOutput = execSync('npm run lint 2>&1', {
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 10
        });
        console.log('✅ 沒有發現 lint warnings');
        return;
    } catch (error) {
        const output = error.stdout || error.stderr || error.message || '';
        const lines = output.split('\n');

        // 統計各種 warning 類型
        const warningCounts = {};

        for (const line of lines) {
            if (line.includes('warning')) {
                const match = line.match(/warning\s+(.+?)\s+(.+)$/);
                if (match) {
                    const rule = match[2].trim();
                    warningCounts[rule] = (warningCounts[rule] || 0) + 1;
                }
            }
        }

        console.log('📊 剩餘 warnings 統計:');
        const sortedWarnings = Object.entries(warningCounts)
            .sort(([,a], [,b]) => b - a);

        let totalWarnings = 0;
        sortedWarnings.forEach(([rule, count]) => {
            console.log(`  ${rule}: ${count} 個`);
            totalWarnings += count;

            // 顯示具體的 multiline-ternary 問題
            if (rule === 'multiline-ternary') {
                console.log('    multiline-ternary 問題詳情:');
                lines.filter(line => line.includes('multiline-ternary'))
                    .slice(0, 3)
                    .forEach(line => {
                        const match = line.match(/(.+?):(\d+):\d+:\s+warning\s+(.+?)\s+multiline-ternary/);
                        if (match) {
                            console.log(`      📁 ${match[1]}:${match[2]} - ${match[3]}`);
                        }
                    });
            }
        });

        console.log(`\n總計: ${totalWarnings} 個 warnings`);

        // 檢查是否還有 multiline-ternary
        if (warningCounts['multiline-ternary']) {
            console.log('\n❌ 仍有 multiline-ternary warnings 需要處理');
        } else {
            console.log('\n✅ multiline-ternary warnings 已全部修復');
        }
    }
}

// 執行
if (require.main === module) {
    verifyMultilineTernaryFix();
}

module.exports = verifyMultilineTernaryFix;