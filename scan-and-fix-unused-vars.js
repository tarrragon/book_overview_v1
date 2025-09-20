#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 掃描和修復 no-unused-vars 問題...\n');

/**
 * 掃描檔案中的 StandardError 和 ErrorCodes 使用情況
 */
function scanFileForUnusedImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    const issues = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 檢查 StandardError 導入但未使用
      if (line.includes('StandardError') && line.includes('require')) {
        // 檢查檔案中是否有實際使用 StandardError
        const hasUsage = content.includes('new StandardError') ||
                        content.includes('StandardError.') ||
                        content.includes('throw StandardError');

        if (!hasUsage) {
          issues.push({
            type: 'unused_import',
            lineNumber: i + 1,
            line: line.trim(),
            variable: 'StandardError',
            reason: 'imported but never used'
          });
        }
      }

      // 檢查 ErrorCodes 導入但未使用 (如果沒有使用 ErrorCodes. 或 error.code = ErrorCodes)
      if (line.includes('ErrorCodes') && line.includes('require')) {
        const hasUsage = content.includes('ErrorCodes.') ||
                        content.includes('error.code = ErrorCodes');

        if (!hasUsage) {
          issues.push({
            type: 'unused_import',
            lineNumber: i + 1,
            line: line.trim(),
            variable: 'ErrorCodes',
            reason: 'imported but never used'
          });
        }
      }

      // 檢查 crypto 導入但未使用
      if (line.includes('crypto') && line.includes('require') && line.includes("'crypto'")) {
        const hasUsage = content.includes('crypto.') && !line.includes('const crypto =');

        if (!hasUsage) {
          issues.push({
            type: 'unused_import',
            lineNumber: i + 1,
            line: line.trim(),
            variable: 'crypto',
            reason: 'imported but never used'
          });
        }
      }
    }

    return issues;
  } catch (error) {
    console.log(`❌ 無法讀取檔案 ${filePath}: ${error.message}`);
    return [];
  }
}

/**
 * 修復檔案中的未使用導入
 */
function fixUnusedImports(filePath, issues) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let lines = content.split('\n');
    let modified = false;

    // 從後往前移除，避免行號變化影響
    const linesToRemove = issues
      .filter(issue => issue.type === 'unused_import')
      .map(issue => issue.lineNumber - 1) // 轉為 0-based index
      .sort((a, b) => b - a); // 降序排列

    for (const lineIndex of linesToRemove) {
      if (lineIndex >= 0 && lineIndex < lines.length) {
        console.log(`  🗑️  移除第 ${lineIndex + 1} 行: ${lines[lineIndex].trim()}`);
        lines.splice(lineIndex, 1);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, lines.join('\n'));
      return true;
    }

    return false;
  } catch (error) {
    console.log(`❌ 無法修復檔案 ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * 遞迴掃描目錄
 */
function scanDirectory(dirPath, filePattern = /\.js$/) {
  const files = [];

  function scan(currentPath) {
    try {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          // 跳過一些目錄
          if (!['node_modules', '.git', '.backup', 'dist', 'build'].includes(item)) {
            scan(itemPath);
          }
        } else if (stat.isFile() && filePattern.test(item)) {
          files.push(itemPath);
        }
      }
    } catch (error) {
      console.log(`⚠️  無法掃描目錄 ${currentPath}: ${error.message}`);
    }
  }

  scan(dirPath);
  return files;
}

// 主要執行邏輯
function main() {
  const srcDir = path.join(process.cwd(), 'src');

  if (!fs.existsSync(srcDir)) {
    console.log('❌ 找不到 src 目錄');
    return;
  }

  console.log('📂 掃描 src/ 目錄中的 JavaScript 檔案...\n');

  const jsFiles = scanDirectory(srcDir);
  console.log(`📊 找到 ${jsFiles.length} 個 JavaScript 檔案\n`);

  let totalIssues = 0;
  let fixedFiles = 0;

  for (const filePath of jsFiles) {
    const relativePath = path.relative(process.cwd(), filePath);
    const issues = scanFileForUnusedImports(filePath);

    if (issues.length > 0) {
      console.log(`🔍 ${relativePath}:`);
      issues.forEach(issue => {
        console.log(`  - Line ${issue.lineNumber}: ${issue.variable} ${issue.reason}`);
      });

      // 嘗試修復
      const fixed = fixUnusedImports(filePath, issues);
      if (fixed) {
        console.log(`  ✅ 修復完成\n`);
        fixedFiles++;
      } else {
        console.log(`  ⚠️  需要手動檢查\n`);
      }

      totalIssues += issues.length;
    }
  }

  console.log('📊 修復摘要:');
  console.log(`  - 掃描的檔案: ${jsFiles.length}`);
  console.log(`  - 發現的問題: ${totalIssues}`);
  console.log(`  - 修復的檔案: ${fixedFiles}`);

  if (fixedFiles > 0) {
    console.log('\n🔄 重新執行 lint 檢查...');
    try {
      execSync('npm run lint', { stdio: 'inherit' });
      console.log('\n✅ Lint 檢查完成!');
    } catch (error) {
      console.log('\n⚠️  Lint 檢查發現問題，請檢查上方輸出');
    }
  }
}

main();