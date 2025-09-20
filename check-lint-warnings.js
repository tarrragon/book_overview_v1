#!/usr/bin/env node

const { execSync } = require('child_process');

// eslint-disable-next-line no-console
console.log('🔍 檢查當前的 ESLint no-unused-vars 警告...\n');

try {
  // 執行 ESLint
  const result = execSync('npm run lint', {
    encoding: 'utf8',
    stdio: 'pipe'
  });

  // eslint-disable-next-line no-console
  console.log('✅ ESLint 檢查通過，沒有發現錯誤或警告');

} catch (error) {
  const output = error.stdout || error.stderr || '';

  if (!output) {
    // eslint-disable-next-line no-console
    console.log('❌ 無法取得 ESLint 輸出');
    return;
  }

  const lines = output.split('\n').filter(line => line.trim());

  // 過濾 no-unused-vars 警告
  const unusedVarsLines = lines.filter(line =>
    line.includes('no-unused-vars') && !line.includes('eslint-disable')
  );

  if (unusedVarsLines.length === 0) {
    // eslint-disable-next-line no-console
    console.log('✅ 沒有發現 no-unused-vars 警告');

    // 顯示其他類型的問題
    const errorLines = lines.filter(line =>
      line.includes('error') || line.includes('warning')
    );

    if (errorLines.length > 0) {
      // eslint-disable-next-line no-console
      console.log('\n⚠️  發現其他類型的問題:');
      errorLines.slice(0, 10).forEach(line => {
        // eslint-disable-next-line no-console
        console.log(`  ${line}`);
      });
    }

    // 顯示總結
    const summaryLine = lines.find(line =>
      line.includes('problems') || line.includes('errors') || line.includes('warnings')
    );
    if (summaryLine) {
      // eslint-disable-next-line no-console
      console.log(`\n📊 ${summaryLine}`);
    }

  } else {
    // eslint-disable-next-line no-console
    console.log(`📊 找到 ${unusedVarsLines.length} 個 no-unused-vars 警告:\n`);

    // 分析警告類型
    const warningAnalysis = {};

    unusedVarsLines.forEach(line => {
      // 解析檔案路徑
      const match = line.match(/^(.+?):(\d+):(\d+):/);
      if (match) {
        const filePath = match[1];
        const fileName = filePath.split('/').pop();

        if (!warningAnalysis[fileName]) {
          warningAnalysis[fileName] = [];
        }

        warningAnalysis[fileName].push({
          line: line,
          lineNumber: match[2]
        });
      }
    });

    // 顯示分析結果
    // eslint-disable-next-line no-console
    console.log('📁 按檔案分組的 no-unused-vars 警告:');
    Object.entries(warningAnalysis).forEach(([fileName, warnings]) => {
      // eslint-disable-next-line no-console
      console.log(`\n  📄 ${fileName} (${warnings.length} 個警告):`);
      warnings.forEach(warning => {
        // eslint-disable-next-line no-console
        console.log(`    ${warning.line}`);
      });
    });

    // 顯示前 20 個詳細警告
    // eslint-disable-next-line no-console
    console.log('\n📝 所有 no-unused-vars 警告:');
    unusedVarsLines.forEach((line, index) => {
      // eslint-disable-next-line no-console
      console.log(`${index + 1}. ${line}`);
    });
  }
}