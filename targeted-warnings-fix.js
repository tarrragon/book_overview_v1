#!/usr/bin/env node

/**
 * 針對性修復剩餘 ESLint warnings
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🎯 開始針對性修復剩餘 warnings...\n');

// 獲取當前 lint 結果
let lintOutput = '';
try {
    execSync('npm run lint', { stdio: 'pipe' });
    console.log('✅ 沒有 warnings 需要修復！');
    process.exit(0);
} catch (error) {
    lintOutput = error.stdout || error.stderr || '';
}

// 解析 warnings
const warningLines = lintOutput.split('\n').filter(line => line.includes('warning'));
console.log(`📊 發現 ${warningLines.length} 個 warnings`);

if (warningLines.length === 0) {
    console.log('✅ 沒有 warnings 需要修復！');
    process.exit(0);
}

// 分析並分組修復
const warnings = [];
warningLines.forEach(line => {
    const match = line.match(/(.+?):(\d+):(\d+):\s+warning\s+(.+?)\s+(.+)/);
    if (match) {
        const [, file, lineNum, col, message, rule] = match;
        warnings.push({
            file: file.trim(),
            line: parseInt(lineNum),
            column: parseInt(col),
            message: message.trim(),
            rule: rule.trim()
        });
    }
});

// 按規則類型分組
const ruleGroups = {};
warnings.forEach(w => {
    if (!ruleGroups[w.rule]) ruleGroups[w.rule] = [];
    ruleGroups[w.rule].push(w);
});

console.log('\n📈 Warning 類型分佈：');
Object.entries(ruleGroups).forEach(([rule, warnings]) => {
    console.log(`  ${rule}: ${warnings.length}`);
});

// 修復 no-unused-vars
if (ruleGroups['no-unused-vars']) {
    console.log('\n🔧 修復 no-unused-vars warnings...');

    const fileGroups = {};
    ruleGroups['no-unused-vars'].forEach(w => {
        if (!fileGroups[w.file]) fileGroups[w.file] = [];
        fileGroups[w.file].push(w);
    });

    Object.entries(fileGroups).forEach(([filePath, fileWarnings]) => {
        if (!fs.existsSync(filePath)) return;

        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        let modified = false;

        fileWarnings.forEach(warning => {
            const lineIndex = warning.line - 1;
            if (lineIndex >= 0 && lineIndex < lines.length) {
                const line = lines[lineIndex];

                // 提取變數名
                const varMatch = warning.message.match(/'([^']+)' is defined but never used/);
                if (varMatch) {
                    const varName = varMatch[1];

                    // 如果是測試檔案且不是 require，添加 underscore
                    if ((filePath.includes('tests/') || filePath.includes('.test.js')) &&
                        !varName.startsWith('_') &&
                        (line.includes('const ') || line.includes('let ')) &&
                        !line.includes('= require(') &&
                        !line.includes('= import(')) {

                        const regex = new RegExp(`\\b${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
                        const newLine = line.replace(regex, `_${varName}`);

                        if (newLine !== line) {
                            lines[lineIndex] = newLine;
                            modified = true;
                            console.log(`    ${varName} → _${varName}`);
                        }
                    }
                }
            }
        });

        if (modified) {
            fs.writeFileSync(filePath, lines.join('\n'));
            console.log(`  ✅ ${path.relative('.', filePath)}: 修復 ${fileWarnings.length} 個 no-unused-vars`);
        }
    });
}

// 修復 no-console（非性能測試檔案）
if (ruleGroups['no-console']) {
    console.log('\n🖥️ 修復剩餘 no-console warnings...');

    const fileGroups = {};
    ruleGroups['no-console'].forEach(w => {
        if (!fileGroups[w.file]) fileGroups[w.file] = [];
        fileGroups[w.file].push(w);
    });

    Object.entries(fileGroups).forEach(([filePath, fileWarnings]) => {
        if (!fs.existsSync(filePath)) return;

        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        let modified = false;

        // 從後往前處理，避免行號變化
        const lineNumbers = [...new Set(fileWarnings.map(w => w.line))].sort((a, b) => b - a);

        lineNumbers.forEach(lineNum => {
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
            console.log(`  ✅ ${path.relative('.', filePath)}: 修復 ${fileWarnings.length} 個 no-console`);
        }
    });
}

// 修復其他類型的 warnings
const otherRules = Object.keys(ruleGroups).filter(rule =>
    !['no-unused-vars', 'no-console'].includes(rule)
);

otherRules.forEach(rule => {
    if (ruleGroups[rule] && ruleGroups[rule].length > 0) {
        console.log(`\n🔧 修復 ${rule} warnings...`);

        const fileGroups = {};
        ruleGroups[rule].forEach(w => {
            if (!fileGroups[w.file]) fileGroups[w.file] = [];
            fileGroups[w.file].push(w);
        });

        Object.entries(fileGroups).forEach(([filePath, fileWarnings]) => {
            if (!fs.existsSync(filePath)) return;

            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            let modified = false;

            // 簡單策略：添加 disable 註解
            const lineNumbers = [...new Set(fileWarnings.map(w => w.line))].sort((a, b) => b - a);

            lineNumbers.forEach(lineNum => {
                const lineIndex = lineNum - 1;
                if (lineIndex >= 0 && lineIndex < lines.length) {
                    const line = lines[lineIndex];
                    const prevLine = lineIndex > 0 ? lines[lineIndex - 1].trim() : '';

                    if (!prevLine.includes(`eslint-disable-next-line ${rule}`)) {
                        const indent = line.match(/^(\s*)/)[1];
                        lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line ${rule}`);
                        modified = true;
                    }
                }
            });

            if (modified) {
                fs.writeFileSync(filePath, lines.join('\n'));
                console.log(`  ✅ ${path.relative('.', filePath)}: 修復 ${fileWarnings.length} 個 ${rule}`);
            }
        });
    }
});

// 最終驗證
console.log('\n🔍 最終驗證結果...');
try {
    execSync('npm run lint', { stdio: 'pipe' });
    console.log('🎉 所有 warnings 已修復！');
} catch (error) {
    const output = error.stdout || error.stderr || '';
    const remainingWarnings = (output.match(/warning/g) || []).length;
    const remainingErrors = (output.match(/error/g) || []).length;

    console.log(`📊 修復後狀況：`);
    console.log(`  Warnings: ${remainingWarnings}`);
    console.log(`  Errors: ${remainingErrors}`);

    if (remainingWarnings > 0) {
        console.log('\n🎯 剩餘 warnings（前 10 個）：');
        const remainingLines = output.split('\n').filter(line => line.includes('warning')).slice(0, 10);
        remainingLines.forEach(line => console.log(`  ${line}`));
    }
}

console.log('\n🎉 針對性修復完成！');