#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

// eslint-disable-next-line no-console
console.log('🔍 檢查 no-unused-vars ESLint 警告...\n');

try {
  // 執行 ESLint 並捕獲輸出
  const result = execSync('npm run lint', {
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 30000
  });

  // eslint-disable-next-line no-console
  console.log('✅ Lint 檢查完成，沒有發現 no-unused-vars 警告');
  // eslint-disable-next-line no-console
  console.log(result);

} catch (error) {
  // ESLint 有問題時會拋出錯誤，我們需要從 stderr 或 stdout 中提取信息
  const output = error.stdout || error.stderr || '';

  // 解析輸出行
  const lines = output.split('\n').filter(line => line.trim());

  // 過濾 no-unused-vars 警告
  const unusedVarsLines = lines.filter(line =>
    line.includes('no-unused-vars') &&
    !line.includes('eslint-disable')
  );

  // eslint-disable-next-line no-console
  console.log(`📊 找到 ${unusedVarsLines.length} 個 no-unused-vars 警告：\n`);

  if (unusedVarsLines.length > 0) {
    // 分析警告類型
    const warningTypes = {};
    const fileWarnings = {};

    unusedVarsLines.forEach(line => {
      // 解析格式: /path/to/file.js:line:col: warning: message (rule)
      const match = line.match(/^(.+?):(\d+):(\d+):\s*(warning|error):\s*(.+?)\s+no-unused-vars/);

      if (match) {
        const [, filePath, lineNum, col, severity, message] = match;
        const fileName = filePath.split('/').pop();

        // 記錄檔案警告
        if (!fileWarnings[fileName]) {
          fileWarnings[fileName] = [];
        }
        fileWarnings[fileName].push({
          line: lineNum,
          message: message.trim(),
          fullPath: filePath
        });

        // 記錄警告類型
        const warningType = message.includes('is defined but never used') ? 'defined but never used' :
                           message.includes('is assigned a value but never used') ? 'assigned but never used' :
                           'other';

        warningTypes[warningType] = (warningTypes[warningType] || 0) + 1;
      }
    });

    // 顯示統計
    // eslint-disable-next-line no-console
    console.log('📈 警告類型統計：');
    Object.entries(warningTypes).forEach(([type, count]) => {
      // eslint-disable-next-line no-console
      console.log(`  - ${type}: ${count} 個`);
    });

    // eslint-disable-next-line no-console
    console.log('\n📁 按檔案分組的警告：');
    Object.entries(fileWarnings).forEach(([fileName, warnings]) => {
      // eslint-disable-next-line no-console
      console.log(`\n  📄 ${fileName} (${warnings.length} 個警告):`);
      warnings.forEach(warning => {
        // eslint-disable-next-line no-console
        console.log(`    Line ${warning.line}: ${warning.message}`);
      });
    });

    // 輸出前 20 個警告的詳細信息
    // eslint-disable-next-line no-console
    console.log('\n📝 前 20 個詳細警告：');
    unusedVarsLines.slice(0, 20).forEach((line, index) => {
      // eslint-disable-next-line no-console
      console.log(`${index + 1}. ${line}`);
    });

    // 保存詳細報告到檔案
    const report = {
      total: unusedVarsLines.length,
      warningTypes,
      fileWarnings,
      allWarnings: unusedVarsLines
    };

    fs.writeFileSync('no-unused-vars-report.json', JSON.stringify(report, null, 2));
    // eslint-disable-next-line no-console
    console.log('\n💾 詳細報告已保存到 no-unused-vars-report.json');
  }

  // 顯示總體 lint 統計
  const totalProblems = lines.find(line => line.includes('problems') || line.includes('errors') || line.includes('warnings'));
  if (totalProblems) {
    // eslint-disable-next-line no-console
    console.log('\n📊 ESLint 總體統計：');
    // eslint-disable-next-line no-console
    console.log(totalProblems);
  }
}