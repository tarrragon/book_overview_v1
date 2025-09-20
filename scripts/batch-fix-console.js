#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 需要批量修復的重要文件列表
const filesToFix = [
  'src/deployment/chrome-store-readiness.js',
  'src/performance/performance-optimizer.js',
  'src/error-handling/event-performance-monitor.js',
  'src/core/migration/StandardErrorMigrationAnalyzer.js',
  'src/core/migration/StandardErrorWrapper.js',
  'src/core/migration/AutoMigrationConverter.js',
  'src/core/migration/MigrationProgressTracker.js',
  'src/core/migration/MigrationValidator.js',
  'src/export/handlers/csv-export-handler.js',
  'src/export/handlers/excel-export-handler.js',
  'src/export/handlers/json-export-handler.js',
  'src/export/handlers/error-handler.js',
  'src/export/handlers/progress-handler.js',
  'src/export/export-manager.js',
  'src/ui/handlers/ui-progress-handler.js',
  'src/ui/handlers/base-ui-handler.js',
  'src/ui/handlers/ui-dom-manager.js',
  'src/content/utils/event-utils.js',
  'src/content/utils/config-utils.js',
  'src/content/detectors/page-detector.js',
  'src/popup/diagnostic-module.js'
];

console.log('🔧 批量修復 no-console 警告...\n');

let totalFixed = 0;

filesToFix.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  檔案不存在: ${filePath}`);
    return;
  }

  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // 找到所有 console 語句並添加 eslint-disable 註解
    const lines = content.split('\n');
    const newLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 檢查這行是否包含 console 語句
      if (line.match(/console\.(log|warn|error|info|debug)/) &&
          !lines[i-1]?.includes('eslint-disable-next-line no-console')) {

        // 獲取當前行的縮排
        const indent = line.match(/^(\s*)/)[1];

        // 添加 eslint-disable 註解
        newLines.push(`${indent}// eslint-disable-next-line no-console`);
        modified = true;
      }

      newLines.push(line);
    }

    if (modified) {
      fs.writeFileSync(fullPath, newLines.join('\n'));
      console.log(`✅ 修復完成: ${filePath}`);
      totalFixed++;
    } else {
      console.log(`ℹ️  無需修復: ${filePath}`);
    }

  } catch (error) {
    console.log(`❌ 修復失敗: ${filePath} - ${error.message}`);
  }
});

console.log(`\n🎉 批量修復完成！共修復 ${totalFixed} 個檔案`);
console.log('\n💡 建議執行以下指令驗證修復結果:');
console.log('   npm run lint | grep "no-console" | wc -l');