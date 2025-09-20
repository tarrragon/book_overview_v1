#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔍 執行 ESLint 檢查...');
console.log('====================');

try {
  const result = execSync('npm run lint', {
    cwd: '/Users/tarragon/Projects/book_overview_v1',
    encoding: 'utf8',
    stdio: 'pipe'
  });

  console.log('✅ ESLint 檢查通過！');
  console.log(result);
} catch (error) {
  console.log('⚠️  ESLint 發現問題，正在分析...');

  if (error.stdout) {
    const output = error.stdout;
    const lines = output.split('\n');

    // 尋找格式化錯誤
    const formatErrors = {
      'no-multiple-empty-lines': [],
      'padded-blocks': [],
      'no-new-func': []
    };

    let currentFile = '';

    lines.forEach(line => {
      if (line.match(/^\/.*\.js$/)) {
        currentFile = line.trim();
      }

      if (line.includes('no-multiple-empty-lines')) {
        formatErrors['no-multiple-empty-lines'].push({ file: currentFile, error: line.trim() });
      }
      if (line.includes('padded-blocks')) {
        formatErrors['padded-blocks'].push({ file: currentFile, error: line.trim() });
      }
      if (line.includes('no-new-func')) {
        formatErrors['no-new-func'].push({ file: currentFile, error: line.trim() });
      }
    });

    console.log('\n📊 格式化錯誤統計：');
    console.log('==================');

    Object.keys(formatErrors).forEach(errorType => {
      const errors = formatErrors[errorType];
      console.log(`\n🚨 ${errorType}: ${errors.length} 個問題`);

      if (errors.length > 0) {
        console.log('發現的問題：');
        errors.slice(0, 5).forEach(({ file, error }) => {
          console.log(`  📁 ${file}`);
          console.log(`     ${error}`);
        });

        if (errors.length > 5) {
          console.log(`     ...還有 ${errors.length - 5} 個問題`);
        }
      }
    });

    const totalFormatErrors = Object.values(formatErrors).reduce((sum, arr) => sum + arr.length, 0);

    if (totalFormatErrors > 0) {
      console.log(`\n📈 找到 ${totalFormatErrors} 個格式化錯誤需要修復`);
      console.log('\n🔧 建議修復步驟：');
      console.log('1. 執行 npm run lint:fix 自動修復格式化問題');
      console.log('2. 手動檢查無法自動修復的問題');
      console.log('3. 再次執行 npm run lint 驗證修復結果');
    } else {
      console.log('\n✅ 沒有發現 no-multiple-empty-lines、padded-blocks 或 no-new-func 錯誤');
    }

    // 顯示最後幾行總結
    console.log('\n📊 ESLint 總結：');
    console.log('===============');
    const lastLines = lines.slice(-5).filter(line => line.trim());
    lastLines.forEach(line => {
      if (line.includes('problems') || line.includes('errors') || line.includes('warnings')) {
        console.log(line);
      }
    });
  }
}

console.log('\n🎉 格式化錯誤檢查完成！');