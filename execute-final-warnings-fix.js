#!/usr/bin/env node

/**
 * 執行最終 warnings 修復的腳本
 */

const { execSync } = require('child_process');
const path = require('path');

async function executeFinalWarningsFix() {
    console.log('🚀 執行最終 warnings 修復...\n');

    try {
        // 執行修復工具
        const scriptPath = path.join(__dirname, 'scripts', 'master-final-warnings-fix.js');
        const result = execSync(`node "${scriptPath}"`, {
            encoding: 'utf8',
            stdio: 'inherit',
            cwd: __dirname,
            maxBuffer: 1024 * 1024 * 10
        });

        console.log('\n✅ 最終 warnings 修復執行完成');

    } catch (error) {
        console.error('❌ 修復過程中發生錯誤:');
        console.error(error.message);

        // 即使發生錯誤，仍然檢查最終狀態
        console.log('\n🔍 檢查最終 warnings 狀態...');
        try {
            const lintResult = execSync('npm run lint 2>&1', {
                encoding: 'utf8',
                maxBuffer: 1024 * 1024 * 10
            });
            console.log('✅ 沒有 warnings');
        } catch (lintError) {
            const output = lintError.stdout || lintError.stderr || lintError.message;
            const lines = output.split('\n');
            const warningLines = lines.filter(line => line.includes('warning'));

            console.log(`📊 剩餘 ${warningLines.length} 個 warnings`);
            if (warningLines.length > 0 && warningLines.length <= 10) {
                console.log('\n剩餘 warnings:');
                warningLines.forEach(line => console.log('  ' + line.trim()));
            }
        }
    }
}

// 執行
if (require.main === module) {
    executeFinalWarningsFix().catch(console.error);
}

module.exports = executeFinalWarningsFix;