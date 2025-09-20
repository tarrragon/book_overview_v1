#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 修復第151-300個 no-console ESLint warnings...');

/**
 * 獲取所有no-console warnings
 */
function getAllNoConsoleWarnings() {
  try {
    const lintOutput = execSync('npm run lint 2>&1', {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 50 // 50MB buffer
    });

    // 解析所有 no-console 警告
    const lines = lintOutput.split('\n');
    const warnings = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('no-console') && line.includes('.js:')) {
        const parts = line.split(':');
        if (parts.length >= 3) {
          warnings.push({
            file: parts[0].trim(),
            line: parseInt(parts[1]) || 0,
            column: parseInt(parts[2]) || 0,
            message: line,
            index: warnings.length + 1
          });
        }
      }
    }

    return warnings;
  } catch (error) {
    console.error('❌ 獲取ESLint warnings失敗:', error.message);
    return [];
  }
}

/**
 * 分析console使用類型
 */
function analyzeConsoleUsage(filePath, lineNumber) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const targetLine = lines[lineNumber - 1];

    if (!targetLine) return null;

    // 檢查前後文以判斷console用途
    const beforeLines = lines.slice(Math.max(0, lineNumber - 3), lineNumber - 1);
    const afterLines = lines.slice(lineNumber, Math.min(lines.length, lineNumber + 2));

    const context = {
      beforeLines,
      targetLine,
      afterLines,
      isTest: filePath.includes('/tests/') || filePath.includes('.test.js'),
      isDebug: /console\.(log|debug)/.test(targetLine),
      isError: /console\.(error|warn)/.test(targetLine),
      isProduction: !filePath.includes('/tests/') && !filePath.includes('scripts/'),
      hasComment: beforeLines.some(line => line.includes('後備機制') || line.includes('eslint-disable'))
    };

    return context;
  } catch (error) {
    console.error(`❌ 分析文件失敗 ${filePath}:`, error.message);
    return null;
  }
}

/**
 * 修復console usage
 */
function fixConsoleUsage(filePath, lineNumber, context) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // 如果已經有 eslint-disable 註解，跳過
    if (context.hasComment) {
      return false;
    }

    const targetLine = lines[lineNumber - 1];

    if (context.isTest) {
      // 測試檔案：添加 eslint-disable 註解
      lines.splice(lineNumber - 1, 0, '    // eslint-disable-next-line no-console');
      fs.writeFileSync(filePath, lines.join('\n'));
      return true;
    } else if (context.isError) {
      // 錯誤處理：保留console.error但添加註解
      lines.splice(lineNumber - 1, 0, '    // 後備機制: console.error 確保錯誤可見性');
      lines.splice(lineNumber, 0, '    // eslint-disable-next-line no-console');
      fs.writeFileSync(filePath, lines.join('\n'));
      return true;
    } else if (context.isDebug) {
      // 調試輸出：移除或添加條件判斷
      if (targetLine.includes('console.log')) {
        // 檢查是否可以安全移除
        const logContent = targetLine.match(/console\.log\(['"`]([^'"`]+)['"`]/);
        if (logContent && (logContent[1].includes('🔍') || logContent[1].includes('📋') || logContent[1].includes('✅'))) {
          // 看起來是重要的狀態輸出，添加條件判斷
          const indent = targetLine.match(/^\s*/)[0];
          lines[lineNumber - 1] = `${indent}// 開發模式下的狀態輸出`;
          lines.splice(lineNumber, 0, `${indent}if (process.env.NODE_ENV === 'development') {`);
          lines.splice(lineNumber + 1, 0, `${indent}  // eslint-disable-next-line no-console`);
          lines.splice(lineNumber + 2, 0, `${indent}  ${targetLine.trim()}`);
          lines.splice(lineNumber + 3, 0, `${indent}}`);
          fs.writeFileSync(filePath, lines.join('\n'));
          return true;
        } else {
          // 移除調試輸出
          lines.splice(lineNumber - 1, 1);
          fs.writeFileSync(filePath, lines.join('\n'));
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error(`❌ 修復文件失敗 ${filePath}:`, error.message);
    return false;
  }
}

/**
 * 主要處理流程
 */
function main() {
  const allWarnings = getAllNoConsoleWarnings();
  console.log(`📊 總共找到 ${allWarnings.length} 個 no-console warnings`);

  // 取第151-300個warnings (0-based indexing: 150-299)
  const targetWarnings = allWarnings.slice(150, 300);
  console.log(`🎯 處理第151-300個warnings (共 ${targetWarnings.length} 個)`);

  let fixedCount = 0;
  let skippedCount = 0;
  const processedFiles = new Set();

  targetWarnings.forEach((warning, index) => {
    console.log(`\n🔧 處理 ${151 + index}/${targetWarnings.length + 150}: ${warning.file}:${warning.line}`);

    const context = analyzeConsoleUsage(warning.file, warning.line);
    if (!context) {
      console.log('  ⏭️  無法分析，跳過');
      skippedCount++;
      return;
    }

    console.log(`  📝 類型: ${context.isTest ? '測試' : context.isError ? '錯誤處理' : context.isDebug ? '調試' : '其他'}`);
    console.log(`  📄 內容: ${context.targetLine.trim()}`);

    if (fixConsoleUsage(warning.file, warning.line, context)) {
      fixedCount++;
      processedFiles.add(warning.file);
      console.log('  ✅ 已修復');
    } else {
      skippedCount++;
      console.log('  ⏭️  已跳過（可能已處理過）');
    }
  });

  console.log(`\n📊 修復完成:`);
  console.log(`  ✅ 成功修復: ${fixedCount} 個warnings`);
  console.log(`  ⏭️  跳過: ${skippedCount} 個warnings`);
  console.log(`  📁 處理檔案: ${processedFiles.size} 個`);

  // 生成報告
  const report = {
    timestamp: new Date().toISOString(),
    range: '151-300',
    totalProcessed: targetWarnings.length,
    fixed: fixedCount,
    skipped: skippedCount,
    processedFiles: Array.from(processedFiles)
  };

  fs.writeFileSync('no-console-fix-151-300-report.json', JSON.stringify(report, null, 2));
  console.log('\n📋 詳細報告已保存到: no-console-fix-151-300-report.json');
}

if (require.main === module) {
  main();
}

module.exports = { getAllNoConsoleWarnings, analyzeConsoleUsage, fixConsoleUsage };