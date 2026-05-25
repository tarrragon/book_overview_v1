#!/usr/bin/env node
/**
 * Readmoo 書庫提取器 - 編譯腳本
 * 負責建立生產和開發版本的 Chrome Extension
 */

const fs = require('fs');
const path = require('path');

// esbuild lazy require：避免單元測試在 jsdom 環境載入本檔時
// 因 TextEncoder/Uint8Array 不相容崩潰。實際 build flow 仍正常使用。
let esbuild;
function getEsbuild () {
  if (!esbuild) {
    esbuild = require('esbuild');
  }
  return esbuild;
}

const MODE = process.argv.includes('--prod') ? 'production' : 'development';
const SKIP_VERSION_CHECK = process.argv.includes('--skip-version-check');
const BUILD_DIR = path.join(__dirname, '..', 'build', MODE);
const SOURCE_DIR = path.join(__dirname, '..');
const WORK_LOGS_ROOT = path.join(SOURCE_DIR, 'docs', 'work-logs', 'v0');

/**
 * 預設 fsAdapter：使用 Node.js fs 模組，與 scripts/validate-manifest.js 同模式
 *
 * 設計目的：將 I/O 與純函式驗證邏輯分離，便於單元測試 mock 檔案系統。
 */
const defaultFsAdapter = {
  fileExists: (p) => fs.existsSync(p),
  readFile: (p) => fs.readFileSync(p, 'utf8'),
  readdir: (p) => fs.readdirSync(p),
  stat: (p) => fs.statSync(p)
};

/**
 * 從 docs/work-logs/v0/ 掃描 active worklog，推斷預期版號
 *
 * 業務情境：v0.18.0 已發布後 wave 進入 v0.19.0，但 package.json
 * 未 bump 造成 dist ZIP 顯示舊版號（0.19.0-W1-002.2 觀察）。
 * 本函式以 worklog 「**狀態**: 開發中」標記為 SSOT，
 * 與 package.json 比對作為 build:prod sanity check。
 *
 * 掃描策略：
 *   1. 列舉 docs/work-logs/v0/ 下所有 v* 主版本目錄（如 v0.18, v0.19）
 *   2. 列舉每個主版本目錄下的 v*.*.* patch 子目錄（如 v0.19.0, v0.19.1）
 *   3. 讀取 v{patch}-main.md 並偵測「**狀態**: 開發中」標記
 *   4. 若僅有 1 個 active worklog → 該版號即預期值
 *   5. 若有 0 或 >1 個 active worklog → 回傳 { ok: false, reason }
 *
 * 排序原則：版號以 semantic version 字串排序（適用本專案 v0.x.x），
 * 多 active 時取最新版作為候選提示，但仍視為錯誤狀態。
 *
 * @param {string} workLogsRoot - docs/work-logs/v0/ 絕對路徑
 * @param {object} fsAdapter - 注入的 fs 介面（測試可 mock）
 * @returns {{ok: boolean, version?: string, reason?: string, candidates?: string[]}}
 */
function detectActiveWorklogVersion (workLogsRoot, fsAdapter = defaultFsAdapter) {
  if (!fsAdapter.fileExists(workLogsRoot)) {
    return { ok: false, reason: `worklog 根目錄不存在: ${workLogsRoot}` };
  }

  const activeVersions = [];

  const majorDirs = fsAdapter.readdir(workLogsRoot)
    .filter((name) => /^v\d+\.\d+$/.test(name));

  for (const majorDir of majorDirs) {
    const majorPath = path.join(workLogsRoot, majorDir);
    if (!fsAdapter.stat(majorPath).isDirectory()) continue;

    const patchDirs = fsAdapter.readdir(majorPath)
      .filter((name) => /^v\d+\.\d+\.\d+$/.test(name));

    for (const patchDir of patchDirs) {
      const patchPath = path.join(majorPath, patchDir);
      if (!fsAdapter.stat(patchPath).isDirectory()) continue;

      const mainFile = path.join(patchPath, `${patchDir}-main.md`);
      if (!fsAdapter.fileExists(mainFile)) continue;

      const content = fsAdapter.readFile(mainFile);
      // 偵測「**狀態**: 開發中」標記（容忍前後空白與不同冒號）
      if (/\*\*狀態\*\*\s*[::]\s*開發中/.test(content)) {
        // 移除 v 前綴以對齊 package.json 格式
        activeVersions.push(patchDir.replace(/^v/, ''));
      }
    }
  }

  if (activeVersions.length === 0) {
    return { ok: false, reason: '未找到任何 active worklog（標記為「**狀態**: 開發中」）' };
  }

  if (activeVersions.length > 1) {
    return {
      ok: false,
      reason: `找到多個 active worklog（應僅 1 個）: ${activeVersions.join(', ')}`,
      candidates: activeVersions
    };
  }

  return { ok: true, version: activeVersions[0] };
}

/**
 * 驗證 package.json 版號與 active worklog 版號一致
 *
 * 業務情境：W1-072 ANA 結論——build:prod 需 fail-fast 防止
 * 版號不一致的 ZIP 被分發到內測使用者。借鑑 IMP-068 sync-push
 * 缺 sanity check 的教訓，將驗證左移至 build 階段。
 *
 * 失敗情境（任一成立即 ok=false）：
 *   - package.json 與 active worklog 版號字串不一致
 *   - 無法偵測 active worklog（多個 active 或全部已完成）
 *
 * @param {string} packageVersion - package.json 的 version 欄位值
 * @param {string} workLogsRoot - docs/work-logs/v0/ 絕對路徑
 * @param {object} fsAdapter - 注入的 fs 介面（測試可 mock）
 * @returns {{ok: boolean, error?: string, expectedVersion?: string, actualVersion?: string}}
 */
function validateVersionAlignment (packageVersion, workLogsRoot, fsAdapter = defaultFsAdapter) {
  const detection = detectActiveWorklogVersion(workLogsRoot, fsAdapter);

  if (!detection.ok) {
    return {
      ok: false,
      error: `[VERSION CHECK] 無法推斷 active worklog 版號：${detection.reason}`,
      actualVersion: packageVersion
    };
  }

  if (detection.version !== packageVersion) {
    return {
      ok: false,
      error: `[VERSION CHECK] package.json 版號 (${packageVersion}) 與 active worklog 版號 (${detection.version}) 不一致`,
      expectedVersion: detection.version,
      actualVersion: packageVersion
    };
  }

  return { ok: true, expectedVersion: detection.version, actualVersion: packageVersion };
}

// 注意：build/ 與 BUILD_DIR 的建立移至 build() 函式內執行（PC-N/A：避免模組頂層
// 副作用污染 require build.js 的測試環境）。實際 build flow 仍會在清理後重建
// BUILD_DIR（見 build() 內部）。

// 需要複製的檔案和目錄
//
// overview 入口由 src/overview/overview.html 提供（event-driven，自動讀
// chrome.storage），manifest.json 的 options_page 已指向該檔。
// 舊版根目錄 overview.html（檔案式 legacy，引用 assets/js/main.js）已移除，
// 故此處不再複製根目錄 overview.html，避免分發產物殘留孤兒入口。
const filesToCopy = [
  'manifest.json',
  'src/',
  'assets/'
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

      // 跳過 .backup 與 .backup-<時間戳> 開發殘留檔。
      // 檔名含 .backup 子字串即排除，避免工具產生的備份檔混入分發產物
      // （與 scripts/package.js 的 *.backup* glob 排除語意一致）。
      if (item.includes('.backup')) {
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

    await getEsbuild().build({
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
      // 將 process.env.NODE_ENV 替換為 build mode 字串常量。
      //
      // Why: Chrome Extension runtime 無 Node.js process 物件，
      // src/ 中 13 處 process.env.NODE_ENV 直接讀取會在 4 個 CE
      // runtime（SW/content/popup/overview）造成 ReferenceError 崩潰。
      // 此 define 於 bundle 時將 process.env.NODE_ENV 替換為
      // JSON 字串常量（'development' / 'production'），執行期不再
      // 觸及 process 物件，同時保留 if (process.env.NODE_ENV === 'production')
      // 等條件分支語意。
      //
      // 來源：0.19.0-W1-050 ANA P7-P16（13 處致命級違規盤點）
      // 落地：0.19.0-W1-050.2（spawn-B）
      define: {
        'process.env.NODE_ENV': JSON.stringify(MODE)
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
    console.log(`🔨 開始編譯 ${MODE} 版本...`);

    // 版號 sanity check（W1-074）
    //
    // Why: build:prod 產出的 ZIP 會分發給內測使用者，若 package.json
    // 版號與 active worklog 不一致，會出現「wave 在 v0.19.0，但 ZIP 顯示
    // v0.18.0」的混淆（W1-002.2 觀察）。本檢查 fail-fast 防止錯誤版號
    // 進入內測產出。
    //
    // 觸發條件：
    //   - production mode 強制檢查（除非 --skip-version-check）
    //   - development mode 預設略過，避免 dev 期短暫不一致干擾
    //
    // 逃生閥：--skip-version-check flag（dev 期暫時不一致時使用）
    if (MODE === 'production' && !SKIP_VERSION_CHECK) {
      const packageJsonPath = path.join(SOURCE_DIR, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const result = validateVersionAlignment(packageJson.version, WORK_LOGS_ROOT);

      if (!result.ok) {
        console.error(result.error);
        console.error('[VERSION CHECK] 修復建議：');
        console.error('  1. 確認 docs/work-logs/v0/ 下有且僅有 1 個 worklog 標記「**狀態**: 開發中」');
        console.error('  2. 執行 version-release 流程或手動 bump package.json + manifest.json');
        console.error('  3. dev 期暫時不一致：使用 --skip-version-check flag 繞過');
        process.exit(1);
      }

      console.log(`[VERSION CHECK] package.json (${result.actualVersion}) 與 active worklog 一致`);
    } else if (MODE === 'production' && SKIP_VERSION_CHECK) {
      console.warn('[VERSION CHECK] 已透過 --skip-version-check 略過版號 sanity check');
    }

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

// 僅在直接執行時觸發 build；require 時僅匯出純函式供測試。
//
// 設計參考 scripts/validate-manifest.js 同模式：純函式 + I/O 分離，
// 測試可注入 mock fsAdapter 而不需建立實體 docs/work-logs/ 結構。
if (require.main === module) {
  build();
}

module.exports = {
  detectActiveWorklogVersion,
  validateVersionAlignment,
  defaultFsAdapter
};