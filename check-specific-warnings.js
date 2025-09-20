#!/usr/bin/env node

/**
 * 檢查特定的 warnings 類型
 */

const { execSync } = require('child_process');

function checkSpecificWarnings() {
    console.log('🔍 檢查特定 warnings 類型...\n');

    try {
        const lintOutput = execSync('npm run lint 2>&1', {
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 10
        });
        console.log('✅ 沒有發現 warnings');
        return;
    } catch (error) {
        const output = error.stdout || error.stderr || error.message || '';
        const lines = output.split('\n');

        // 目標警告類型
        const targetWarnings = {
            'multiline-ternary': [],
            'no-control-regex': [],
            'no-new': [],
            'no-useless-constructor': [],
            'n/no-callback-literal': []
        };

        // 解析 warnings
        for (const line of lines) {
            if (line.includes('warning')) {
                const match = line.match(/(.+?):(\d+):(\d+):\s+warning\s+(.+?)\s+(.+)/);
                if (match) {
                    const [, file, lineNum, col, message, rule] = match;
                    if (targetWarnings.hasOwnProperty(rule.trim())) {
                        targetWarnings[rule.trim()].push({
                            file: file.trim(),
                            line: parseInt(lineNum),
                            column: parseInt(col),
                            message: message.trim()
                        });
                    }
                }
            }
        }

        // 顯示結果
        console.log('📊 目標 warnings 統計:');
        let totalTargetWarnings = 0;
        for (const [rule, warnings] of Object.entries(targetWarnings)) {
            if (warnings.length > 0) {
                console.log(`\n🔸 ${rule}: ${warnings.length} 個`);
                totalTargetWarnings += warnings.length;

                // 顯示前 5 個詳細資訊
                warnings.slice(0, 5).forEach(w => {
                    console.log(`  📁 ${w.file}:${w.line}:${w.column} - ${w.message}`);
                });

                if (warnings.length > 5) {
                    console.log(`  ... 還有 ${warnings.length - 5} 個`);
                }
            }
        }

        if (totalTargetWarnings === 0) {
            console.log('✅ 沒有發現目標 warnings 類型');
        } else {
            console.log(`\n📈 總計需要修復: ${totalTargetWarnings} 個目標 warnings`);
        }

        // 顯示總體統計
        const allWarningLines = lines.filter(line => line.includes('warning'));
        console.log(`\n📊 總體統計: ${allWarningLines.length} 個 warnings`);
    }
}

// 執行
if (require.main === module) {
    checkSpecificWarnings();
}

module.exports = checkSpecificWarnings;