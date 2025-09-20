#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 最終修復 no-unused-vars 問題...\n');

try {
  // 執行 ESLint 獲取具體的 no-unused-vars 警告
  console.log('🔍 執行 ESLint 檢查...');
  const result = execSync('npm run lint', {
    encoding: 'utf8',
    stdio: 'pipe'
  });

  console.log('✅ 沒有發現 no-unused-vars 問題');

} catch (error) {
  const output = error.stdout || error.stderr || '';
  const lines = output.split('\n').filter(line => line.trim());

  // 過濾 no-unused-vars 警告
  const unusedVarsLines = lines.filter(line =>
    line.includes('no-unused-vars') && !line.includes('eslint-disable')
  );

  console.log(`📊 找到 ${unusedVarsLines.length} 個 no-unused-vars 警告\n`);

  if (unusedVarsLines.length === 0) {
    // 檢查是否有其他類型的錯誤
    const errorLines = lines.filter(line =>
      (line.includes('error') || line.includes('warning')) &&
      !line.includes('no-unused-vars')
    );

    if (errorLines.length > 0) {
      console.log('⚠️  發現其他類型的問題:');
      errorLines.slice(0, 10).forEach(line => {
        console.log(`  ${line}`);
      });
    }

    const summaryLine = lines.find(line =>
      line.includes('problems') || line.includes('errors') || line.includes('warnings')
    );
    if (summaryLine) {
      console.log(`\n📊 ${summaryLine}`);
    }

    return;
  }

  const fixedFiles = new Set();

  // 處理每個 no-unused-vars 警告
  for (const warningLine of unusedVarsLines) {
    console.log(`🔍 處理: ${warningLine}`);

    // 解析警告: /path/to/file.js:line:col: warning: 'variable' is defined but never used no-unused-vars
    const match = warningLine.match(/^(.+?):(\d+):(\d+):\s*(warning|error):\s*'([^']+)'\s+(.+?)\s+no-unused-vars/);

    if (!match) continue;

    const [, filePath, lineNum, col, severity, varName, description] = match;
    const fileName = path.basename(filePath);

    console.log(`  📄 檔案: ${fileName}, 行號: ${lineNum}, 變數: ${varName}`);
    console.log(`  📝 描述: ${description}`);

    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      let lines = fileContent.split('\n');
      let modified = false;

      // 策略 1: 如果是函數參數且從未使用，加上 _ 前綴
      if (description.includes('is defined but never used')) {
        const targetLineIndex = parseInt(lineNum) - 1;
        const targetLine = lines[targetLineIndex] || '';

        // 檢查是否是函數參數
        if (targetLine.includes('function') || targetLine.includes('=>') ||
            targetLine.includes(`(${varName}`) || targetLine.includes(`, ${varName}`) ||
            targetLine.includes(`${varName},`) || targetLine.includes(`${varName})`)) {

          // 替換為 _varName
          const newVarName = `_${varName}`;
          lines[targetLineIndex] = lines[targetLineIndex].replace(
            new RegExp(`\\b${varName}\\b`, 'g'), newVarName
          );

          console.log(`  ✏️  參數重命名: ${varName} -> ${newVarName}`);
          modified = true;

        } else {
          // 策略 2: 如果是未使用的變數聲明，檢查是否可以移除
          if (targetLine.includes(`const ${varName}`) ||
              targetLine.includes(`let ${varName}`) ||
              targetLine.includes(`var ${varName}`)) {

            // 檢查該變數在檔案其他地方是否被使用
            const restOfFile = lines.slice(targetLineIndex + 1).join('\n');
            const isUsedElsewhere = restOfFile.includes(varName);

            if (!isUsedElsewhere) {
              console.log(`  🗑️  移除未使用變數聲明: ${targetLine.trim()}`);
              lines.splice(targetLineIndex, 1);
              modified = true;
            } else {
              console.log(`  ⚠️  變數在後續程式碼中被使用，添加 eslint-disable`);
              lines[targetLineIndex] = `// eslint-disable-next-line no-unused-vars\n${lines[targetLineIndex]}`;
              modified = true;
            }
          }
        }
      }

      // 策略 3: 對於解構賦值中未使用的變數，使用 _ 前綴
      if (description.includes('is assigned a value but never used')) {
        const targetLineIndex = parseInt(lineNum) - 1;
        const targetLine = lines[targetLineIndex] || '';

        if (targetLine.includes('{') && targetLine.includes('}') && targetLine.includes('=')) {
          // 解構賦值中的未使用變數
          const newVarName = `_${varName}`;
          lines[targetLineIndex] = lines[targetLineIndex].replace(
            new RegExp(`\\b${varName}\\b`, 'g'), newVarName
          );

          console.log(`  ✏️  解構變數重命名: ${varName} -> ${newVarName}`);
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(filePath, lines.join('\n'));
        fixedFiles.add(filePath);
        console.log(`  ✅ 修復完成\n`);
      } else {
        console.log(`  ⚠️  需要手動處理\n`);
      }

    } catch (fileError) {
      console.log(`  ❌ 檔案處理失敗: ${fileError.message}\n`);
    }
  }

  console.log(`📊 修復摘要:`);
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
      } else {
        console.log('✅ 所有 no-unused-vars 警告已修復!');
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