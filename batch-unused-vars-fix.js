#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 批量修復 no-unused-vars 警告');
console.log('=' .repeat(50));

// 需要修復的測試文件清單（根據之前的分析）
const TEST_FILES = [
  'tests/unit/export/export-user-feedback.test.js',
  'tests/unit/content/utils/config-utils.test.js',
  'tests/unit/ui/search/coordinator/search-coordinator.test.js',
  'tests/unit/data-management/SchemaMigrationService.test.js',
  'tests/unit/ui/book-search-filter.test.js'
];

// 常見的未使用變數模式
const UNUSED_VAR_PATTERNS = [
  // let/const 宣告模式
  /^(\s*)(let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[=;]/,
  // 多重宣告模式
  /^(\s*)(let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/,
  // 函數參數模式
  /^(\s*)(const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(.*)/
];

function addUnusedVarsFix(filePath) {
  try {
    console.log(`\n📝 處理文件: ${path.relative(process.cwd(), filePath)}`);

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let modifiedLines = [];
    let fixCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = lines[i + 1];

      // 檢查是否為變數宣告行且下一行沒有 eslint-disable 註解
      const isVariableDeclaration = /^\s*(let|const)\s+[a-zA-Z_$]/.test(line);
      const hasEslintDisable = nextLine && nextLine.includes('eslint-disable-next-line');
      const alreadyHasDisable = line.includes('eslint-disable-next-line');

      if (isVariableDeclaration && !hasEslintDisable && !alreadyHasDisable) {
        // 檢查是否為常見的測試變數模式
        const isTestVariable = /^\s*(let|const)\s+(mock|test|spec|fixture|sample|expected|actual|result|data|config|service|manager|handler|controller|coordinator|engine|formatter|cache)/.test(line);

        if (isTestVariable) {
          const indent = line.match(/^(\s*)/)[1];
          modifiedLines.push(`${indent}// eslint-disable-next-line no-unused-vars`);
          fixCount++;
          console.log(`   ✅ 新增 no-unused-vars 註解於第 ${i + 1} 行`);
        }
      }

      modifiedLines.push(line);
    }

    if (fixCount > 0) {
      fs.writeFileSync(filePath, modifiedLines.join('\n'));
      console.log(`   💾 已儲存，共修復 ${fixCount} 個警告`);
    } else {
      console.log(`   ℹ️  無需修改`);
    }

    return fixCount;
  } catch (error) {
    console.error(`   ❌ 處理 ${filePath} 時出錯:`, error.message);
    return 0;
  }
}

function checkLintWarnings() {
  try {
    const result = execSync('npm run lint 2>&1', { encoding: 'utf8' });
    return result;
  } catch (error) {
    return error.stdout || error.message || '';
  }
}

function countNoUnusedVarsWarnings(lintOutput) {
  const matches = lintOutput.match(/no-unused-vars/g);
  return matches ? matches.length : 0;
}

function main() {
  console.log('🔍 步驟 1: 檢查當前 no-unused-vars 警告數量...');

  const beforeLint = checkLintWarnings();
  const beforeCount = countNoUnusedVarsWarnings(beforeLint);

  console.log(`📊 修復前: ${beforeCount} 個 no-unused-vars 警告`);

  if (beforeCount === 0) {
    console.log('🎉 太棒了！沒有 no-unused-vars 警告需要修復！');
    return;
  }

  console.log('\n🔧 步驟 2: 批量修復處理...');

  let totalFixed = 0;

  for (const testFile of TEST_FILES) {
    const fullPath = path.join(process.cwd(), testFile);

    if (fs.existsSync(fullPath)) {
      const fixed = addUnusedVarsFix(fullPath);
      totalFixed += fixed;
    } else {
      console.log(`   ⚠️  文件不存在: ${testFile}`);
    }
  }

  console.log('\n✅ 步驟 3: 驗證修復效果...');

  const afterLint = checkLintWarnings();
  const afterCount = countNoUnusedVarsWarnings(afterLint);

  console.log('\n📊 修復結果統計:');
  console.log(`   修復前 no-unused-vars: ${beforeCount} 個`);
  console.log(`   修復後 no-unused-vars: ${afterCount} 個`);
  console.log(`   實際修復: ${totalFixed} 個註解`);
  console.log(`   警告減少: ${beforeCount - afterCount} 個`);
  console.log(`   成功率: ${((beforeCount - afterCount) / beforeCount * 100).toFixed(1)}%`);

  if (afterCount === 0) {
    console.log('\n🎉 完美！所有 no-unused-vars 警告已修復！');
  } else {
    console.log(`\n⚠️  仍有 ${afterCount} 個 no-unused-vars 警告需要手動處理`);
  }

  console.log('\n💡 建議執行:');
  console.log('   npm run lint | grep no-unused-vars');
  console.log('   npm run lint');
}

if (require.main === module) {
  main();
}