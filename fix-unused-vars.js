#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 修復 no-unused-vars ESLint 警告...\n');

try {
  // 執行 ESLint 並捕獲輸出
  const result = execSync('npm run lint', {
    encoding: 'utf8',
    stdio: 'pipe'
  });

  console.log('✅ 沒有發現 no-unused-vars 警告');

} catch (error) {
  const output = error.stdout || error.stderr || '';
  const lines = output.split('\n').filter(line => line.trim());

  // 過濾 no-unused-vars 警告
  const unusedVarsLines = lines.filter(line =>
    line.includes('no-unused-vars') &&
    !line.includes('eslint-disable')
  );

  console.log(`📊 找到 ${unusedVarsLines.length} 個 no-unused-vars 警告\n`);

  if (unusedVarsLines.length === 0) {
    console.log('✅ 沒有找到需要修復的 no-unused-vars 警告');
    return;
  }

  // 分析並修復每個警告
  const fixedFiles = new Set();
  const patterns = [
    // StandardError 相關的未使用導入
    {
      type: 'StandardError import',
      regex: /const.*\{\s*StandardError\s*\}.*=.*require.*StandardError/,
      action: 'remove_import'
    },
    // ErrorCodes 相關的未使用導入
    {
      type: 'ErrorCodes import',
      regex: /const.*\{\s*ErrorCodes\s*\}.*=.*require.*ErrorCodes/,
      action: 'remove_import'
    },
    // crypto 未使用導入
    {
      type: 'crypto import',
      regex: /const\s+crypto\s*=\s*require\s*\(\s*['"]crypto['"]\s*\)/,
      action: 'remove_import'
    }
  ];

  // 處理每個警告
  for (const warningLine of unusedVarsLines) {
    // 解析警告信息: /path/to/file.js:line:col: warning: message no-unused-vars
    const match = warningLine.match(/^(.+?):(\d+):(\d+):\s*(warning|error):\s*(.+?)\s+no-unused-vars/);

    if (!match) continue;

    const [, filePath, lineNum, col, severity, message] = match;

    console.log(`🔍 處理: ${path.basename(filePath)}:${lineNum} - ${message.trim()}`);

    try {
      // 讀取檔案內容
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const lines = fileContent.split('\n');

      let modified = false;

      // 檢查是否是 StandardError 或 ErrorCodes 未使用導入
      if (message.includes('StandardError') && message.includes('is defined but never used')) {
        // 移除 StandardError 導入
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('StandardError') && lines[i].includes('require')) {
            console.log(`  🗑️  移除第 ${i + 1} 行: ${lines[i].trim()}`);
            lines.splice(i, 1);
            modified = true;
            break;
          }
        }
      }

      if (message.includes('ErrorCodes') && message.includes('is defined but never used')) {
        // 移除 ErrorCodes 導入
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('ErrorCodes') && lines[i].includes('require')) {
            console.log(`  🗑️  移除第 ${i + 1} 行: ${lines[i].trim()}`);
            lines.splice(i, 1);
            modified = true;
            break;
          }
        }
      }

      if (message.includes('crypto') && message.includes('is defined but never used')) {
        // 移除 crypto 導入
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('crypto') && lines[i].includes('require') && lines[i].includes("'crypto'")) {
            console.log(`  🗑️  移除第 ${i + 1} 行: ${lines[i].trim()}`);
            lines.splice(i, 1);
            modified = true;
            break;
          }
        }
      }

      // 處理函數參數未使用的情況
      if (message.includes('is defined but never used') && !message.includes('import')) {
        const varName = message.match(/'([^']+)' is defined but never used/);
        if (varName) {
          const unusedVar = varName[1];

          // 對於函數參數，加上 _ 前綴
          for (let i = 0; i < lines.length; i++) {
            // 檢查是否是函數參數
            if (lines[i].includes(`(${unusedVar}`) || lines[i].includes(`, ${unusedVar}`) || lines[i].includes(`${unusedVar},`)) {
              const originalLine = lines[i];
              lines[i] = lines[i].replace(new RegExp(`\\b${unusedVar}\\b`, 'g'), `_${unusedVar}`);
              if (lines[i] !== originalLine) {
                console.log(`  ✏️  修改第 ${i + 1} 行: ${unusedVar} -> _${unusedVar}`);
                modified = true;
              }
            }
          }
        }
      }

      // 如果檔案有修改，寫回檔案
      if (modified) {
        fs.writeFileSync(filePath, lines.join('\n'));
        fixedFiles.add(filePath);
        console.log(`  ✅ 修復完成: ${path.basename(filePath)}\n`);
      }

    } catch (fileError) {
      console.log(`  ❌ 檔案處理失敗: ${fileError.message}\n`);
    }
  }

  console.log(`\n📊 修復摘要:`);
  console.log(`  - 處理的警告數: ${unusedVarsLines.length}`);
  console.log(`  - 修復的檔案數: ${fixedFiles.size}`);

  if (fixedFiles.size > 0) {
    console.log(`\n📁 修復的檔案:`);
    for (const filePath of fixedFiles) {
      console.log(`  - ${path.relative(process.cwd(), filePath)}`);
    }

    console.log('\n🔄 重新執行 lint 檢查...');
    try {
      const lintResult = execSync('npm run lint', { encoding: 'utf8', stdio: 'pipe' });
      console.log('✅ Lint 檢查通過!');
    } catch (lintError) {
      const lintOutput = lintError.stdout || lintError.stderr || '';
      const remainingUnusedVars = lintOutput.split('\n').filter(line =>
        line.includes('no-unused-vars') && !line.includes('eslint-disable')
      );

      if (remainingUnusedVars.length > 0) {
        console.log(`⚠️  還有 ${remainingUnusedVars.length} 個 no-unused-vars 警告需要手動處理:`);
        remainingUnusedVars.slice(0, 5).forEach(line => console.log(`  - ${line}`));
      }

      const summary = lintOutput.split('\n').find(line =>
        line.includes('problems') || line.includes('errors') || line.includes('warnings')
      );
      if (summary) {
        console.log(`\n📊 Lint 結果: ${summary}`);
      }
    }
  }
}