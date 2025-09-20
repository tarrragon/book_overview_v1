#!/usr/bin/env node

/**
 * 最終 ESLint 檢查工具
 */

const { execSync } = require('child_process');

function runFinalLintCheck() {
    console.log('🔍 執行最終 ESLint 檢查...\n');

    try {
        const lintOutput = execSync('npm run lint 2>&1', {
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 10
        });
        console.log('✅ 所有文件都通過 ESLint 檢查，沒有發現 warnings 或 errors！');
        return { success: true, totalWarnings: 0 };
    } catch (error) {
        const output = error.stdout || error.stderr || error.message || '';
        const lines = output.split('\n');

        // 統計各種問題類型
        const warningCounts = {};
        const errorCounts = {};

        for (const line of lines) {
            if (line.includes('warning')) {
                const match = line.match(/warning\s+(.+?)\s+(.+)$/);
                if (match) {
                    const rule = match[2].trim();
                    warningCounts[rule] = (warningCounts[rule] || 0) + 1;
                }
            } else if (line.includes('error')) {
                const match = line.match(/error\s+(.+?)\s+(.+)$/);
                if (match) {
                    const rule = match[2].trim();
                    errorCounts[rule] = (errorCounts[rule] || 0) + 1;
                }
            }
        }

        // 顯示錯誤統計（如果有）
        const totalErrors = Object.values(errorCounts).reduce((sum, count) => sum + count, 0);
        if (totalErrors > 0) {
            console.log('❌ ESLint Errors:');
            Object.entries(errorCounts)
                .sort(([,a], [,b]) => b - a)
                .forEach(([rule, count]) => {
                    console.log(`  ${rule}: ${count} 個 errors`);
                });
            console.log('');
        }

        // 顯示 warning 統計
        const totalWarnings = Object.values(warningCounts).reduce((sum, count) => sum + count, 0);
        if (totalWarnings > 0) {
            console.log('⚠️ ESLint Warnings:');
            Object.entries(warningCounts)
                .sort(([,a], [,b]) => b - a)
                .forEach(([rule, count]) => {
                    console.log(`  ${rule}: ${count} 個 warnings`);
                });

            // 顯示具體的 warning 範例
            console.log('\n📝 詳細 warnings 範例:');
            Object.keys(warningCounts).slice(0, 3).forEach(rule => {
                console.log(`\n🔸 ${rule} 範例:`);
                lines.filter(line => line.includes(rule) && line.includes('warning'))
                    .slice(0, 3)
                    .forEach(line => {
                        const match = line.match(/(.+?):(\d+):\d+:\s+warning\s+(.+?)\s+/);
                        if (match) {
                            console.log(`      📁 ${match[1]}:${match[2]} - ${match[3]}`);
                        }
                    });
            });
        }

        console.log(`\n📊 總結:`);
        console.log(`  Errors: ${totalErrors}`);
        console.log(`  Warnings: ${totalWarnings}`);

        return {
            success: totalErrors === 0,
            totalWarnings,
            totalErrors,
            warningCounts,
            errorCounts
        };
    }
}

// 執行
if (require.main === module) {
    const result = runFinalLintCheck();

    if (result.success && result.totalWarnings === 0) {
        console.log('\n🎉 格式化修復工作完成！所有問題都已解決。');
        process.exit(0);
    } else if (result.success && result.totalWarnings > 0) {
        console.log(`\n✅ 沒有 errors，但還有 ${result.totalWarnings} 個 warnings 需要處理。`);
        process.exit(1);
    } else {
        console.log(`\n❌ 還有 ${result.totalErrors} 個 errors 需要修復。`);
        process.exit(2);
    }
}

module.exports = runFinalLintCheck;