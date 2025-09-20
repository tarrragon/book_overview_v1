#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

// 快速修復未使用變數：將 result 改為 _result
console.log('🔧 快速修復常見的未使用變數...');

const filesToFix = [
    'tests/unit/adapters/stable-id-generation.test.js'
];

filesToFix.forEach(filePath => {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        // 修復 result 變數
        if (content.includes('const result = ') && !content.includes('expect(result)')) {
            content = content.replace(/const result = /g, 'const _result = ');
            modified = true;
            console.log(`  修復 ${filePath} 中的 result 變數`);
        }

        if (modified) {
            fs.writeFileSync(filePath, content);
        }
    }
});

// 檢查當前狀況
console.log('\n🔍 檢查當前 lint 狀況...');
try {
    execSync('npm run lint', { stdio: 'pipe' });
    console.log('✅ 沒有 warnings！');
} catch (error) {
    const output = error.stdout || error.stderr || '';
    const warnings = (output.match(/warning/g) || []).length;
    console.log(`📊 剩餘 warnings: ${warnings}`);

    if (warnings > 0 && warnings < 20) {
        console.log('\n前 10 個 warnings:');
        const lines = output.split('\n').filter(line => line.includes('warning')).slice(0, 10);
        lines.forEach(line => console.log(`  ${line}`));
    }
}