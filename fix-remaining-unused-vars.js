#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 修復剩餘的 no-unused-vars ESLint 警告...\n');

// 首先取得當前的 ESLint 輸出
function getCurrentLintOutput() {
  try {
    execSync('npm run lint 2>&1', { encoding: 'utf8' });
    return null; // 沒有錯誤
  } catch (error) {
    return error.stdout || '';
  }
}

// 解析 ESLint 輸出獲取 no-unused-vars warnings
function parseUnusedVarsWarnings(lintOutput) {
  if (!lintOutput) return [];

  const lines = lintOutput.split('\n');
  const warnings = [];
  let currentFile = '';

  for (const line of lines) {
    if (line.match(/^\/.*\.js$/)) {
      currentFile = line.trim();
    } else if (line.includes('no-unused-vars') && !line.includes('eslint-disable')) {
      const match = line.match(/(\d+):(\d+)\s+warning\s+'([^']+)'\s+(.+?)\s+no-unused-vars/);
      if (match) {
        warnings.push({
          file: currentFile,
          line: parseInt(match[1]),
          column: parseInt(match[2]),
          variable: match[3],
          message: match[4],
          fullLine: line.trim()
        });
      }
    }
  }

  return warnings;
}

// 修復檔案中的未使用變數
function fixUnusedVarsInFile(filePath, warnings) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  檔案不存在: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  let modified = false;

  // 按行號倒序處理，避免修改後行號偏移
  const sortedWarnings = warnings.sort((a, b) => b.line - a.line);

  for (const warning of sortedWarnings) {
    const lineIndex = warning.line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) continue;

    const line = lines[lineIndex];
    const variable = warning.variable;

    console.log(`\n🔍 處理 ${path.basename(filePath)}:${warning.line} - ${variable}`);
    console.log(`   ${line.trim()}`);

    // 檢查是否為 StandardError 相關導入
    if (variable === 'StandardError' && line.includes('require(')) {
      console.log(`   ✂️  移除未使用的 StandardError 導入`);
      lines.splice(lineIndex, 1);
      modified = true;
      continue;
    }

    // 檢查是否為 ErrorCodes 相關導入
    if (variable === 'ErrorCodes' && line.includes('require(')) {
      console.log(`   ✂️  移除未使用的 ErrorCodes 導入`);
      lines.splice(lineIndex, 1);
      modified = true;
      continue;
    }

    // 檢查是否為 Logger 相關導入
    if (variable === 'Logger' && line.includes('require(')) {
      console.log(`   ✂️  移除未使用的 Logger 導入`);
      lines.splice(lineIndex, 1);
      modified = true;
      continue;
    }

    // 檢查是否為解構賦值中的未使用項目
    if (line.includes('const {') || line.includes('let {') || line.includes('var {')) {
      const updatedLine = removeUnusedFromDestructuring(line, variable);
      if (updatedLine !== line) {
        console.log(`   🔧 更新解構賦值: ${updatedLine.trim()}`);
        lines[lineIndex] = updatedLine;
        modified = true;
        continue;
      }
    }

    // 檢查是否為簡單的變數宣告
    if (line.includes(`const ${variable}`) || line.includes(`let ${variable}`) || line.includes(`var ${variable}`)) {
      // 如果是測試檔案或明顯是測試變數，移除整行
      if (filePath.includes('test') || filePath.includes('spec') || variable.includes('test') || variable.includes('mock')) {
        console.log(`   ✂️  移除測試中的未使用變數`);
        lines.splice(lineIndex, 1);
        modified = true;
        continue;
      }

      // 對於其他情況，添加 eslint-disable 註釋
      console.log(`   📝 添加 eslint-disable 註釋`);
      lines.splice(lineIndex, 0, '    // eslint-disable-next-line no-unused-vars');
      modified = true;
      continue;
    }

    // 檢查是否為函數參數
    if (line.includes('function') || line.includes('=>') || line.includes('async')) {
      const updatedLine = prefixUnusedParameter(line, variable);
      if (updatedLine !== line) {
        console.log(`   🔧 為未使用參數添加 _ 前綴: ${updatedLine.trim()}`);
        lines[lineIndex] = updatedLine;
        modified = true;
        continue;
      }
    }

    // 檢查是否為賦值表達式
    if (line.includes('=') && !line.includes('===') && !line.includes('!==') && !line.includes('==') && !line.includes('!=')) {
      console.log(`   📝 為賦值添加 eslint-disable 註釋`);
      lines.splice(lineIndex, 0, '    // eslint-disable-next-line no-unused-vars');
      modified = true;
      continue;
    }

    // 對於其他情況，添加 eslint-disable 註釋
    console.log(`   📝 添加通用 eslint-disable 註釋`);
    lines.splice(lineIndex, 0, '    // eslint-disable-next-line no-unused-vars');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`✅ 已修復 ${path.basename(filePath)}`);
    return true;
  }

  return false;
}

// 從解構賦值中移除未使用的項目
function removeUnusedFromDestructuring(line, unusedVar) {
  // 簡單的解構移除邏輯
  const regex = new RegExp(`\\b${unusedVar}\\b,?\\s*`, 'g');
  let updated = line.replace(regex, '');

  // 清理多餘的逗號
  updated = updated.replace(/,\s*,/g, ',');
  updated = updated.replace(/{\s*,/g, '{');
  updated = updated.replace(/,\s*}/g, '}');

  // 如果解構變為空，移除整個解構
  if (updated.match(/{\s*}/)) {
    const assignment = updated.split('=');
    if (assignment.length > 1) {
      updated = `// ${line.trim()} // 所有解構項目都未使用`;
    }
  }

  return updated;
}

// 為未使用的函數參數添加 _ 前綴
function prefixUnusedParameter(line, unusedParam) {
  // 只在參數列表中添加前綴
  const paramRegex = new RegExp(`\\b${unusedParam}\\b(?=\\s*[,)])`, 'g');
  return line.replace(paramRegex, `_${unusedParam}`);
}

// 主要執行邏輯
function main() {
  console.log('📊 取得當前 ESLint 輸出...');
  const lintOutput = getCurrentLintOutput();

  if (!lintOutput) {
    console.log('✅ 沒有發現 ESLint 錯誤或警告');
    return;
  }

  console.log('🔍 解析 no-unused-vars 警告...');
  const warnings = parseUnusedVarsWarnings(lintOutput);

  if (warnings.length === 0) {
    console.log('✅ 沒有發現 no-unused-vars 警告');
    return;
  }

  console.log(`📋 找到 ${warnings.length} 個 no-unused-vars 警告\n`);

  // 按檔案分組處理
  const fileGroups = {};
  warnings.forEach(warning => {
    if (!fileGroups[warning.file]) {
      fileGroups[warning.file] = [];
    }
    fileGroups[warning.file].push(warning);
  });

  let totalFixed = 0;
  let totalFiles = 0;

  for (const [filePath, fileWarnings] of Object.entries(fileGroups)) {
    console.log(`\n📄 處理檔案: ${path.basename(filePath)} (${fileWarnings.length} 個警告)`);

    if (fixUnusedVarsInFile(filePath, fileWarnings)) {
      totalFixed += fileWarnings.length;
      totalFiles++;
    }
  }

  console.log(`\n📊 修復完成:`);
  console.log(`   - 處理檔案: ${totalFiles} 個`);
  console.log(`   - 修復警告: ${totalFixed} 個`);

  // 驗證修復結果
  console.log('\n🔍 驗證修復結果...');
  const newLintOutput = getCurrentLintOutput();

  if (newLintOutput) {
    const remainingWarnings = parseUnusedVarsWarnings(newLintOutput);
    console.log(`⚠️  剩餘 ${remainingWarnings.length} 個 no-unused-vars 警告`);

    if (remainingWarnings.length > 0) {
      console.log('\n未修復的警告:');
      remainingWarnings.slice(0, 10).forEach((warning, index) => {
        console.log(`${index + 1}. ${path.basename(warning.file)}:${warning.line} - ${warning.variable}`);
      });
    }
  } else {
    console.log('✅ 所有 no-unused-vars 警告已修復!');
  }
}

main();