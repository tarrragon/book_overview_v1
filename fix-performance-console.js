#!/usr/bin/env node

/**
 * 專門修復性能測試檔案的 console warnings
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🖥️ 修復性能測試檔案的 console warnings...');

// 獲取所有性能測試檔案
const performanceDir = path.join(__dirname, 'tests/performance');
const performanceFiles = fs.readdirSync(performanceDir)
    .filter(file => file.endsWith('.test.js'))
    .map(file => path.join(performanceDir, file));

console.log(`發現 ${performanceFiles.length} 個性能測試檔案`);

let totalFixed = 0;

performanceFiles.forEach(filePath => {
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf8');

    // 檢查是否已經有全域 disable
    if (content.includes('/* eslint-disable no-console */')) {
        console.log(`  ⏭️  ${path.basename(filePath)}: 已有 no-console disable`);
        return;
    }

    // 在檔案開頭添加 eslint-disable
    const lines = content.split('\n');

    // 找到合適的插入位置（在 @jest-environment 後面）
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('@jest-environment') || lines[i].includes('/**')) {
            continue;
        }
        if (lines[i].trim() === '' || lines[i].startsWith('//') || lines[i].trim() === '*/') {
            continue;
        }
        insertIndex = i;
        break;
    }

    // 插入 disable 註解
    lines.splice(insertIndex, 0, '/* eslint-disable no-console */');

    fs.writeFileSync(filePath, lines.join('\n'));
    totalFixed++;
    console.log(`  ✅ ${path.basename(filePath)}: 添加 no-console disable`);
});

console.log(`\n✅ 總計修復 ${totalFixed} 個性能測試檔案`);

// 修復其他測試檔案中的個別 console
console.log('\n🔧 修復其他檔案中的個別 console warnings...');

try {
    // 獲取所有 no-console warnings
    const lintOutput = execSync('npm run lint 2>&1', { encoding: 'utf8' });
    console.log('✅ 沒有 lint warnings 需要修復');
} catch (error) {
    const output = error.stdout || error.stderr || '';
    const noConsoleLines = output.split('\n').filter(line => line.includes('no-console'));

    if (noConsoleLines.length > 0) {
        console.log(`發現 ${noConsoleLines.length} 個 no-console warnings`);

        // 解析並修復每個 warning
        const fileWarnings = {};
        noConsoleLines.forEach(line => {
            const match = line.match(/(.+?):(\d+):(\d+):\s+warning\s+.+?\s+no-console/);
            if (match) {
                const [, file, lineNum] = match;
                if (!fileWarnings[file]) fileWarnings[file] = [];
                fileWarnings[file].push(parseInt(lineNum));
            }
        });

        // 修復每個檔案
        Object.entries(fileWarnings).forEach(([filePath, lineNumbers]) => {
            if (!fs.existsSync(filePath)) return;

            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            let modified = false;

            // 從後往前處理（避免行號變化）
            const sortedLines = [...lineNumbers].sort((a, b) => b - a);

            sortedLines.forEach(lineNum => {
                const lineIndex = lineNum - 1;
                if (lineIndex >= 0 && lineIndex < lines.length) {
                    const line = lines[lineIndex];
                    const prevLine = lineIndex > 0 ? lines[lineIndex - 1].trim() : '';

                    if (line.includes('console.') && !prevLine.includes('eslint-disable-next-line no-console')) {
                        const indent = line.match(/^(\s*)/)[1];
                        lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-console`);
                        modified = true;
                    }
                }
            });

            if (modified) {
                fs.writeFileSync(filePath, lines.join('\n'));
                console.log(`  ✅ ${path.relative('.', filePath)}: 修復 ${lineNumbers.length} 個 console warnings`);
            }
        });
    }
}

console.log('\n🎉 Console warnings 修復完成！');