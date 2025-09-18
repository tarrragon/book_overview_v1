#!/usr/bin/env node

const fs = require('fs');

// 需要檢查的檔案
const filesToCheck = [
  '/Users/tarragon/Projects/book_overview_v1/src/background/domains/page/services/navigation-service.js',
  '/Users/tarragon/Projects/book_overview_v1/src/background/domains/page/services/tab-state-tracking-service.js'
];

console.log('🔍 開始語法檢查...\n');

let hasErrors = false;

filesToCheck.forEach((filePath) => {
  console.log(`檢查檔案: ${filePath}`);

  try {
    // 讀取檔案內容
    const content = fs.readFileSync(filePath, 'utf8');

    // 嘗試解析語法
    new Function(content);

    console.log('✅ 語法正確\n');
  } catch (error) {
    console.error(`❌ 語法錯誤: ${error.message}\n`);
    hasErrors = true;
  }
});

if (hasErrors) {
  console.log('❌ 發現語法錯誤，請修復後再次檢查');
  process.exit(1);
} else {
  console.log('🎉 所有檔案語法檢查通過！');
  process.exit(0);
}