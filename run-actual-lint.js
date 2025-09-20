#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔍 執行實際的 ESLint 檢查');
console.log('========================');

try {
  // 先執行 lint:fix
  console.log('第1步: 執行 npm run lint:fix');
  console.log('============================');

  try {
    const fixOutput = execSync('npm run lint:fix', {
      cwd: '/Users/tarragon/Projects/book_overview_v1',
      encoding: 'utf8',
      stdio: 'pipe'
    });

    console.log('✅ lint:fix 執行完成');
    if (fixOutput.trim()) {
      console.log('修復輸出:', fixOutput);
    }
  } catch (fixError) {
    console.log('⚠️  lint:fix 輸出:');
    if (fixError.stdout) console.log(fixError.stdout);
    if (fixError.stderr) console.log('錯誤:', fixError.stderr);
  }

  // 再執行完整檢查
  console.log('\n第2步: 執行 npm run lint 檢查結果');
  console.log('==================================');

  const lintOutput = execSync('npm run lint', {
    cwd: '/Users/tarragon/Projects/book_overview_v1',
    encoding: 'utf8',
    stdio: 'pipe'
  });

  console.log('🎉 ESLint 檢查全部通過！');
  console.log(lintOutput);

} catch (error) {
  console.log('📊 ESLint 檢查結果：');

  if (error.stdout) {
    const output = error.stdout;
    console.log(output);

    // 統計格式化錯誤
    const lines = output.split('\n');
    let formatErrorCount = 0;
    let totalErrors = 0;

    const formatRules = ['no-multiple-empty-lines', 'padded-blocks', 'no-new-func'];

    lines.forEach(line => {
      if (line.includes('error')) {
        totalErrors++;
        formatRules.forEach(rule => {
          if (line.includes(rule)) {
            formatErrorCount++;
          }
        });
      }
    });

    console.log('\n📈 統計結果：');
    console.log(`總錯誤數: ${totalErrors}`);
    console.log(`格式化錯誤數: ${formatErrorCount}`);

    if (formatErrorCount === 0) {
      console.log('✅ 沒有發現 no-multiple-empty-lines、padded-blocks 或 no-new-func 錯誤');
    } else {
      console.log(`🔧 仍有 ${formatErrorCount} 個格式化錯誤需要修復`);
    }
  }

  if (error.stderr) {
    console.log('\n錯誤輸出:');
    console.log(error.stderr);
  }
}

console.log('\n✨ 檢查完成');