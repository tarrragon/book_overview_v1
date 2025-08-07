#!/usr/bin/env node
/**
 * Readmoo 書庫提取器 - 編譯腳本
 * 負責建立生產和開發版本的 Chrome Extension
 */

const fs = require('fs');
const path = require('path');

const MODE = process.argv.includes('--prod') ? 'production' : 'development';
const BUILD_DIR = path.join(__dirname, '..', 'build', MODE);
const SOURCE_DIR = path.join(__dirname, '..');

console.log(`🔨 開始編譯 ${MODE} 版本...`);

// 建立輸出目錄
if (!fs.existsSync(path.dirname(BUILD_DIR))) {
  fs.mkdirSync(path.dirname(BUILD_DIR), { recursive: true });
}

if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
}

// 需要複製的檔案和目錄
const filesToCopy = [
  'manifest.json',
  'src/',
  'assets/',
  'overview.html'
];

/**
 * 遞迴複製檔案和目錄
 */
function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const items = fs.readdirSync(src);
    items.forEach(item => {
      // 跳過測試檔案和開發檔案
      if (item.includes('.test.') || item.includes('.spec.')) {
        return;
      }
      
      copyRecursive(
        path.join(src, item),
        path.join(dest, item)
      );
    });
  } else {
    // 複製檔案
    fs.copyFileSync(src, dest);
  }
}

/**
 * 主要編譯流程
 */
function build() {
  try {
    // 清理輸出目錄
    if (fs.existsSync(BUILD_DIR)) {
      fs.rmSync(BUILD_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(BUILD_DIR, { recursive: true });

    // 複製檔案
    filesToCopy.forEach(file => {
      const srcPath = path.join(SOURCE_DIR, file);
      const destPath = path.join(BUILD_DIR, file);
      
      if (fs.existsSync(srcPath)) {
        console.log(`📄 複製 ${file}...`);
        copyRecursive(srcPath, destPath);
      } else {
        console.warn(`⚠️  檔案不存在: ${file}`);
      }
    });

    // 讀取並處理 manifest.json
    const manifestPath = path.join(BUILD_DIR, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      // 生產模式的特殊處理
      if (MODE === 'production') {
        // 移除開發專用的權限和配置
        console.log('🚀 套用生產模式配置...');
      }
      
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }

    console.log(`✅ 編譯完成！輸出目錄: ${BUILD_DIR}`);
    console.log(`📦 檔案清單:`);
    
    // 顯示編譯結果
    function listFiles(dir, prefix = '') {
      const items = fs.readdirSync(dir);
      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const relativePath = path.relative(BUILD_DIR, fullPath);
        
        if (fs.statSync(fullPath).isDirectory()) {
          console.log(`${prefix}📁 ${relativePath}/`);
          if (prefix.length < 6) { // 限制遞迴深度
            listFiles(fullPath, prefix + '  ');
          }
        } else {
          const size = fs.statSync(fullPath).size;
          console.log(`${prefix}📄 ${relativePath} (${size} bytes)`);
        }
      });
    }
    
    listFiles(BUILD_DIR);
    
    console.log(`\n🎯 下一步:`);
    console.log(`1. 在 Chrome 中載入解壓縮的擴充功能`);
    console.log(`2. 選擇目錄: ${BUILD_DIR}`);
    console.log(`3. 在 Readmoo 網站上測試功能`);

  } catch (error) {
    console.error(`❌ 編譯失敗:`, error.message);
    process.exit(1);
  }
}

build();