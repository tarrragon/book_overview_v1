#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 簡化格式化修復工具');
console.log('=====================');

const PROJECT_ROOT = '/Users/tarragon/Projects/book_overview_v1';

// 執行 lint:fix
console.log('\n🛠️  執行 npm run lint:fix...');
try {
  const child = spawn('npm', ['run', 'lint:fix'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });

  child.on('close', (code) => {
    console.log(`\n✅ lint:fix 執行完成 (退出碼: ${code})`);

    // 檢查修復效果
    console.log('\n📊 檢查修復效果...');
    try {
      const lintResult = execSync('npm run lint', {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      console.log('🎉 所有 lint 檢查通過！');
      console.log('沒有發現格式化錯誤。');

    } catch (lintError) {
      if (lintError.stdout) {
        const output = lintError.stdout;

        // 檢查是否還有我們關心的格式化錯誤
        const hasFormatErrors = [
          'no-multiple-empty-lines',
          'padded-blocks',
          'no-new-func'
        ].some(rule => output.includes(rule));

        if (hasFormatErrors) {
          console.log('🔧 仍有格式化錯誤需要處理：');
          console.log(output);
        } else {
          console.log('✅ 目標格式化錯誤已修復！');
          console.log('其他錯誤（非格式化相關）：');
          const lines = output.split('\n');
          const summaryLines = lines.filter(line =>
            line.includes('problems') || line.includes('errors') || line.includes('warnings')
          );
          summaryLines.forEach(line => console.log(line));
        }
      }
    }

    console.log('\n🎉 格式化修復檢查完成！');
  });

} catch (error) {
  console.error('❌ 執行失敗:', error.message);
}