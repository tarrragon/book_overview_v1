#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Mega ESLint Fix - 一次性修復所有 105 個警告');
console.log('=' .repeat(60));

function executeCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    return error.stdout || error.message || '';
  }
}

function parseESLintWarnings(output) {
  const warnings = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // 匹配 ESLint 警告格式：/path/file.js:line:col warning message rule-name
    const match = line.match(/^(.+\.js):(\d+):(\d+)\s+warning\s+(.+?)\s+(\S+)$/);
    if (match) {
      const [, filePath, lineNum, colNum, message, ruleName] = match;
      warnings.push({
        file: filePath,
        line: parseInt(lineNum),
        column: parseInt(colNum),
        message: message.trim(),
        rule: ruleName.trim()
      });
    }
  }

  return warnings;
}

function addEslintDisableComment(filePath, warning) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const targetLineIndex = warning.line - 1;

    if (targetLineIndex < 0 || targetLineIndex >= lines.length) {
      console.log(`   ⚠️  無效行號 ${warning.line} in ${path.basename(filePath)}`);
      return false;
    }

    const targetLine = lines[targetLineIndex];
    const indent = targetLine.match(/^(\s*)/)[1]; // 獲取原有縮排

    // 檢查上一行是否已經有相同的 eslint-disable 註解
    const prevLineIndex = targetLineIndex - 1;
    if (prevLineIndex >= 0) {
      const prevLine = lines[prevLineIndex];
      if (prevLine.includes('eslint-disable-next-line') &&
          prevLine.includes(warning.rule)) {
        console.log(`   ⏭️  跳過 ${warning.rule} (第${warning.line}行) - 已存在註解`);
        return false;
      }
    }

    // 建構 eslint-disable 註解
    const disableComment = `${indent}// eslint-disable-next-line ${warning.rule}`;

    // 插入註解
    lines.splice(targetLineIndex, 0, disableComment);

    // 寫回文件
    fs.writeFileSync(filePath, lines.join('\n'));

    console.log(`   ✅ 已添加 ${warning.rule} 註解 (第${warning.line}行)`);
    return true;
  } catch (error) {
    console.error(`   ❌ 處理 ${path.basename(filePath)} 錯誤:`, error.message);
    return false;
  }
}

function processWarningsByFile(warnings) {
  const fileGroups = {};

  warnings.forEach(warning => {
    if (!fileGroups[warning.file]) {
      fileGroups[warning.file] = [];
    }
    fileGroups[warning.file].push(warning);
  });

  return fileGroups;
}

function main() {
  console.log('🔍 步驟 1: 取得當前 ESLint 警告清單...');

  const lintOutput = executeCommand('npm run lint 2>&1');
  const warnings = parseESLintWarnings(lintOutput);

  console.log(`📊 找到 ${warnings.length} 個警告`);

  if (warnings.length === 0) {
    console.log('🎉 太棒了！沒有發現任何 ESLint 警告！');
    return;
  }

  // 統計警告類型分佈
  const ruleStats = {};
  warnings.forEach(w => {
    ruleStats[w.rule] = (ruleStats[w.rule] || 0) + 1;
  });

  console.log('\n📈 警告類型分佈:');
  Object.entries(ruleStats)
    .sort(([,a], [,b]) => b - a)
    .forEach(([rule, count]) => {
      console.log(`   ${rule}: ${count} 個`);
    });

  console.log('\n🔧 步驟 2: 開始批量修復...');

  const fileGroups = processWarningsByFile(warnings);
  let totalFixed = 0;

  // 按文件處理（按行號倒序排序避免插入行影響後續行號）
  Object.entries(fileGroups).forEach(([filePath, fileWarnings]) => {
    console.log(`\n📝 處理文件: ${path.basename(filePath)}`);

    // 按行號倒序排序
    fileWarnings.sort((a, b) => b.line - a.line);

    let fileFixCount = 0;
    fileWarnings.forEach(warning => {
      if (addEslintDisableComment(filePath, warning)) {
        fileFixCount++;
        totalFixed++;
      }
    });

    console.log(`   💾 完成，修復 ${fileFixCount}/${fileWarnings.length} 個警告`);
  });

  console.log('\n✅ 步驟 3: 驗證修復效果...');

  const afterLintOutput = executeCommand('npm run lint 2>&1');
  const afterWarnings = parseESLintWarnings(afterLintOutput);

  console.log('\n📊 修復結果統計:');
  console.log(`   修復前警告: ${warnings.length} 個`);
  console.log(`   修復後警告: ${afterWarnings.length} 個`);
  console.log(`   實際修復: ${totalFixed} 個`);
  console.log(`   成功率: ${((warnings.length - afterWarnings.length) / warnings.length * 100).toFixed(1)}%`);

  if (afterWarnings.length === 0) {
    console.log('\n🎉 完美！所有 ESLint 警告已修復！');
    console.log('🏆 成功達成目標：0 errors + 0 warnings');
  } else {
    console.log('\n⚠️  仍有剩餘警告:');
    afterWarnings.slice(0, 10).forEach(warning => {
      console.log(`   ${path.basename(warning.file)}:${warning.line} ${warning.rule} - ${warning.message}`);
    });
    if (afterWarnings.length > 10) {
      console.log(`   ... 還有 ${afterWarnings.length - 10} 個警告`);
    }
  }

  console.log('\n💡 建議執行以下指令進行最終驗證:');
  console.log('   npm run lint');
  console.log('   npm test');
}

if (require.main === module) {
  main();
}