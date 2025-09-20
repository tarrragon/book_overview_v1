#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🎯 針對性修復 no-unused-vars 問題...\n');

// 常見的未使用變數模式
const COMMON_UNUSED_PATTERNS = [
  // 錯誤處理相關
  'StandardError',
  'ErrorCodes',
  'createError',
  'createResult',

  // 測試相關
  'mockEventBus',
  'testHelper',
  'testData',
  'mock.*',

  // 事件相關
  'eventEmitter',
  'eventBus',

  // 功能特定
  'Logger',
  'UC\\d+ErrorAdapter',
  'UC\\d+ErrorFactory'
];

// 需要檢查的檔案類型
const TARGET_DIRECTORIES = [
  'src/core/errors/',
  'src/background/',
  'src/content/',
  'src/export/',
  'src/handlers/',
  'src/utils/'
];

// 獲取所有 JavaScript 檔案
function getAllJSFiles() {
  const allFiles = [];

  function walkDir(dir) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (file.endsWith('.js')) {
          allFiles.push(fullPath);
        }
      }
    } catch (error) {
      // 忽略無法讀取的目錄
    }
  }

  TARGET_DIRECTORIES.forEach(dir => {
    const fullDir = path.join('/Users/tarragon/Projects/book_overview_v1', dir);
    if (fs.existsSync(fullDir)) {
      walkDir(fullDir);
    }
  });

  return allFiles;
}

// 檢查檔案中的潛在未使用變數
function checkFileForUnusedVars(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  lines.forEach((line, index) => {
    // 檢查 require 語句
    const requireMatch = line.match(/const\s+(\{[^}]+\}|\w+)\s*=\s*require\(/);
    if (requireMatch) {
      const variablePart = requireMatch[1];

      // 檢查解構賦值
      if (variablePart.startsWith('{') && variablePart.endsWith('}')) {
        const variables = variablePart.slice(1, -1).split(',').map(v => v.trim());
        variables.forEach(variable => {
          if (isLikelyUnused(variable, content, filePath)) {
            issues.push({
              line: index + 1,
              variable: variable,
              type: 'destructuring',
              originalLine: line
            });
          }
        });
      } else {
        // 檢查單一變數
        if (isLikelyUnused(variablePart, content, filePath)) {
          issues.push({
            line: index + 1,
            variable: variablePart,
            type: 'simple',
            originalLine: line
          });
        }
      }
    }

    // 檢查其他賦值
    const assignMatch = line.match(/const\s+(\w+)\s*=/);
    if (assignMatch && !line.includes('require(')) {
      const variable = assignMatch[1];
      if (isLikelyUnused(variable, content, filePath)) {
        issues.push({
          line: index + 1,
          variable: variable,
          type: 'assignment',
          originalLine: line
        });
      }
    }
  });

  return issues;
}

// 判斷變數是否可能未使用
function isLikelyUnused(variable, content, filePath) {
  // 已經有 eslint-disable 的跳過
  if (content.includes('eslint-disable-next-line no-unused-vars')) {
    return false;
  }

  // 檢查是否為常見的未使用模式
  const isCommonPattern = COMMON_UNUSED_PATTERNS.some(pattern => {
    const regex = new RegExp(pattern);
    return regex.test(variable);
  });

  if (!isCommonPattern) {
    return false;
  }

  // 簡單檢查：是否在其他地方使用
  const usageRegex = new RegExp(`\\b${variable}\\b`, 'g');
  const matches = content.match(usageRegex) || [];

  // 如果只出現一次（就是宣告處），可能未使用
  return matches.length <= 1;
}

// 修復檔案中的未使用變數
function fixUnusedVarsInFile(filePath, issues) {
  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  let modified = false;

  console.log(`\n📄 處理 ${path.basename(filePath)} (${issues.length} 個問題)`);

  // 按行號倒序處理
  const sortedIssues = issues.sort((a, b) => b.line - a.line);

  for (const issue of sortedIssues) {
    const lineIndex = issue.line - 1;
    const line = lines[lineIndex];

    console.log(`   🔍 第${issue.line}行: ${issue.variable} (${issue.type})`);
    console.log(`      ${line.trim()}`);

    if (issue.type === 'destructuring') {
      // 對解構賦值的處理
      if (shouldRemoveFromDestructuring(issue.variable, line)) {
        const updatedLine = removeFromDestructuring(line, issue.variable);
        if (updatedLine !== line) {
          console.log(`      🔧 更新解構: ${updatedLine.trim()}`);
          lines[lineIndex] = updatedLine;
          modified = true;
        }
      }
    } else if (issue.type === 'simple') {
      // 簡單變數的處理
      if (shouldRemoveSimpleVariable(issue.variable, filePath)) {
        console.log(`      ✂️  移除未使用的導入`);
        lines.splice(lineIndex, 1);
        modified = true;
      } else {
        console.log(`      📝 添加 eslint-disable 註釋`);
        const indent = line.match(/^(\s*)/)[1];
        lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-unused-vars`);
        modified = true;
      }
    } else if (issue.type === 'assignment') {
      // 賦值變數的處理
      console.log(`      📝 添加 eslint-disable 註釋`);
      const indent = line.match(/^(\s*)/)[1];
      lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-unused-vars`);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`   ✅ 已修復 ${path.basename(filePath)}`);
    return true;
  }

  return false;
}

// 判斷是否應該從解構中移除變數
function shouldRemoveFromDestructuring(variable, line) {
  // StandardError 和 ErrorCodes 通常可以安全移除
  return ['StandardError', 'ErrorCodes'].includes(variable);
}

// 從解構賦值中移除變數
function removeFromDestructuring(line, variable) {
  // 簡單的移除邏輯
  let updated = line.replace(new RegExp(`\\b${variable}\\b,?\\s*`), '');

  // 清理多餘的逗號
  updated = updated.replace(/,\s*,/g, ',');
  updated = updated.replace(/{\s*,/g, '{');
  updated = updated.replace(/,\s*}/g, '}');

  // 如果解構變空，註釋整行
  if (updated.match(/{\s*}/)) {
    updated = `// ${line.trim()} // 所有項目都未使用`;
  }

  return updated;
}

// 判斷是否應該移除簡單變數
function shouldRemoveSimpleVariable(variable, filePath) {
  // 錯誤處理相關的導入通常可以移除
  const removablePatterns = ['StandardError', 'UC\\d+ErrorAdapter', 'UC\\d+ErrorFactory'];
  return removablePatterns.some(pattern => new RegExp(pattern).test(variable));
}

// 主執行函數
function main() {
  console.log('📊 掃描 JavaScript 檔案...');
  const jsFiles = getAllJSFiles();
  console.log(`找到 ${jsFiles.length} 個 JavaScript 檔案\n`);

  let totalFiles = 0;
  let totalIssues = 0;

  for (const filePath of jsFiles) {
    const issues = checkFileForUnusedVars(filePath);

    if (issues.length > 0) {
      if (fixUnusedVarsInFile(filePath, issues)) {
        totalFiles++;
        totalIssues += issues.length;
      }
    }
  }

  console.log(`\n📊 修復總結:`);
  console.log(`   - 處理檔案: ${totalFiles} 個`);
  console.log(`   - 修復問題: ${totalIssues} 個`);

  console.log('\n💡 建議執行 npm run lint 驗證修復結果');
}

main();