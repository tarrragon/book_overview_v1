#!/usr/bin/env node
/**
 * Readmoo 書庫提取器 - 編譯腳本
 * 負責建立生產和開發版本的 Chrome Extension
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

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
 * esbuild 入口點配置
 *
 * Chrome Extension 不支援 CJS require() 也不支援 bare module specifier，
 * 因此需要在 build 階段使用 esbuild 將三個入口點及其依賴鏈打包為 IIFE。
 */
const BUNDLE_ENTRY_POINTS = [
  {
    name: 'background.js (Service Worker)',
    input: 'src/background/background.js',
    format: 'iife'
  },
  {
    name: 'content-modular.js (Content Script)',
    input: 'src/content/content-modular.js',
    format: 'iife'
  },
  {
    name: 'popup.js (Popup Script)',
    input: 'src/popup/popup.js',
    format: 'iife'
  },
  {
    name: 'overview.js (Overview Page)',
    input: 'src/overview/overview.js',
    format: 'iife'
  }
];

/**
 * 對入口點執行 esbuild bundling
 *
 * 將入口檔案及其所有依賴打包為單一 IIFE 檔案，
 * 覆蓋 build 目錄中複製的原始檔案。
 * 使用 alias 解析 'src/' 開頭的 bare module specifier。
 */
async function bundleEntryPoints() {
  console.log('\n[BUNDLE] 開始 esbuild bundling...');

  const srcAlias = path.join(BUILD_DIR, 'src');

  for (const entry of BUNDLE_ENTRY_POINTS) {
    const inputPath = path.join(BUILD_DIR, entry.input);
    const outputPath = inputPath; // 覆蓋原始檔案

    console.log(`[BUNDLE] 打包 ${entry.name}...`);

    await esbuild.build({
      entryPoints: [inputPath],
      bundle: true,
      format: entry.format,
      platform: 'browser',
      target: ['chrome100'],
      outfile: outputPath,
      allowOverwrite: true,
      alias: {
        'src': srcAlias
      },
      logLevel: 'warning'
    });

    const bundledSize = fs.statSync(outputPath).size;
    console.log(`[BUNDLE] ${entry.name} -> ${Math.round(bundledSize / 1024 * 100) / 100} KB`);
  }

  console.log('[BUNDLE] bundling 完成');
}

/**
 * 主要編譯流程
 */
async function build() {
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
        console.log(`[COPY] 複製 ${file}...`);
        copyRecursive(srcPath, destPath);
      } else {
        console.warn(`[WARNING] 檔案不存在: ${file}`);
      }
    });

    // 讀取並處理 manifest.json（注入 package.json 版本號）
    const manifestPath = path.join(BUILD_DIR, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(SOURCE_DIR, 'package.json'), 'utf8')
      );

      // 從 package.json 注入版本號，確保版本一致
      manifest.version = packageJson.version;
      console.log(`[VERSION] 版本注入: ${packageJson.version} (來源: package.json)`);

      // 生產模式的特殊處理
      if (MODE === 'production') {
        // 移除開發專用的權限和配置
        console.log('[PROD] 套用生產模式配置...');
      }

      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }

    // esbuild bundling：打包三個入口點及其依賴
    await bundleEntryPoints();

    console.log(`\n[DONE] 編譯完成！輸出目錄: ${BUILD_DIR}`);
    console.log(`[FILES] 檔案清單:`);

    // 顯示編譯結果
    function listFiles(dir, prefix = '') {
      const items = fs.readdirSync(dir);
      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const relativePath = path.relative(BUILD_DIR, fullPath);

        if (fs.statSync(fullPath).isDirectory()) {
          console.log(`${prefix}[DIR] ${relativePath}/`);
          if (prefix.length < 6) { // 限制遞迴深度
            listFiles(fullPath, prefix + '  ');
          }
        } else {
          const size = fs.statSync(fullPath).size;
          console.log(`${prefix}[FILE] ${relativePath} (${size} bytes)`);
        }
      });
    }

    listFiles(BUILD_DIR);

    console.log(`\n[NEXT] 下一步:`);
    console.log(`1. 在 Chrome 中載入解壓縮的擴充功能`);
    console.log(`2. 選擇目錄: ${BUILD_DIR}`);
    console.log(`3. 在 Readmoo 網站上測試功能`);

  } catch (error) {
    console.error(`[ERROR] 編譯失敗:`, error.message);
    process.exit(1);
  }
}

build();