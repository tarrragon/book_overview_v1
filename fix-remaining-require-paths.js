#!/usr/bin/env node

/**
 * 批量修正剩餘的 require('./src/) 路徑為 require('src/')
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 取得所有還需要修正的檔案
function getFilesToFix() {
  try {
    const output = execSync('grep -r "require(\'\\./src/" --include="*.js" . | cut -d: -f1 | sort -u', 
      { encoding: 'utf8', cwd: __dirname });
    
    return output.trim().split('\n').filter(file => 
      file && !file.includes('node_modules') && !file.includes('fix-require-paths')
    );
  } catch (error) {
    console.log('沒有找到更多檔案需要修正');
    return [];
  }
}

// 修正單一檔案
function fixFile(filePath) {
  try {
    const absolutePath = path.resolve(__dirname, filePath);
    
    if (!fs.existsSync(absolutePath)) {
      console.log(`檔案不存在，跳過: ${filePath}`);
      return false;
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    
    // 替換所有 require('./src/ 為 require('src/
    const fixedContent = content.replace(/require\('\.\/src\//g, "require('src/");
    
    if (content !== fixedContent) {
      fs.writeFileSync(absolutePath, fixedContent, 'utf8');
      console.log(`✅ 修正完成: ${filePath}`);
      return true;
    } else {
      console.log(`⚪ 無需修正: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ 修正失敗 ${filePath}:`, error.message);
    return false;
  }
}

// 主執行函數
function main() {
  console.log('🚀 開始批量修正 JavaScript require 路徑...\n');
  
  const filesToFix = getFilesToFix();
  
  if (filesToFix.length === 0) {
    console.log('🎉 所有檔案的路徑都已修正完成！');
    return;
  }
  
  console.log(`📋 找到 ${filesToFix.length} 個檔案需要修正:\n`);
  filesToFix.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });
  
  console.log('\n🔧 開始修正...\n');
  
  let fixedCount = 0;
  let errorCount = 0;
  
  filesToFix.forEach((file, index) => {
    process.stdout.write(`[${index + 1}/${filesToFix.length}] `);
    
    try {
      if (fixFile(file)) {
        fixedCount++;
      }
    } catch (error) {
      console.error(`❌ 處理檔案失敗 ${file}:`, error.message);
      errorCount++;
    }
  });
  
  console.log('\n📊 批量修正完成統計:');
  console.log(`✅ 成功修正: ${fixedCount} 個檔案`);
  console.log(`❌ 處理失敗: ${errorCount} 個檔案`);
  console.log(`⚪ 無需修正: ${filesToFix.length - fixedCount - errorCount} 個檔案`);
  
  // 驗證修正結果
  console.log('\n🔍 驗證修正結果...');
  const remainingFiles = getFilesToFix();
  
  if (remainingFiles.length === 0) {
    console.log('🎉 所有路徑都已成功修正！');
  } else {
    console.log(`⚠️ 還有 ${remainingFiles.length} 個檔案需要手動檢查:`);
    remainingFiles.forEach(file => console.log(`   - ${file}`));
  }
}

if (require.main === module) {
  main();
}

module.exports = { fixFile, getFilesToFix };