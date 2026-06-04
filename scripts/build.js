#!/usr/bin/env node
/**
 * Readmoo 書庫提取器 - 編譯腳本
 * 負責建立生產和開發版本的 Chrome Extension
 */

const fs = require('fs');
const path = require('path');

// Design System CSS 產生器（0.19.1-W2-001 D1）：
// design-system.css 為 generated artifact，由 colors.js/spacing.js/typography.js
// 產出。build flow 開頭呼叫產生器，確保複製到 build/ 的 CSS 為最新。
const { generate: generateDesignSystemCss } = require('./generate-design-system-css.js');

// esbuild lazy require：避免單元測試在 jsdom 環境載入本檔時
// 因 TextEncoder/Uint8Array 不相容崩潰。實際 build flow 仍正常使用。
let esbuild;
function getEsbuild () {
  if (!esbuild) {
    esbuild = require('esbuild');
  }
  return esbuild;
}

/**
 * esbuild early validation（0.19.0-W1-080 / source 0.19.0-W1-074 F-4）
 *
 * Why: getEsbuild() lazy require 若 esbuild 模組損壞（缺失 / 版本錯誤 /
 *   binary 不可執行），錯誤會延遲到 bundleEntryPoints() 第一次呼叫時才暴露。
 *   prod build 此時已執行清空 build/ 目錄 + 複製檔案 + 處理 manifest 等
 *   副作用，失敗時需手動清理。
 *
 * Consequence: 不做 early validation 會讓 esbuild 損壞的失敗在 build flow
 *   中段才觸發，產生半成品 build/ 目錄並讓使用者誤以為 manifest/copy 階段
 *   出問題（實際是 esbuild 模組故障）。
 *
 * Action: build() 開頭呼叫一次 ensureEsbuildAvailable() 強制 require + 檢查
 *   .build 屬性，失敗 fail-fast 並提供修復建議。
 *
 * 範圍邊界：僅驗證 esbuild 子系統，不觸碰 validateVersionAlignment /
 *   detectActiveWorklogVersion / WORK_LOGS_ROOT（屬 W1-083 SSOT 反轉範圍）。
 *
 * @throws {Error} esbuild 載入失敗時拋出帶診斷訊息的 Error
 */
function ensureEsbuildAvailable () {
  let mod;
  try {
    mod = getEsbuild();
  } catch (err) {
    throw new Error(
      `[ESBUILD CHECK] 無法載入 esbuild 模組：${err.message}\n` +
      '修復建議：\n' +
      '  1. 確認 node_modules/esbuild 已安裝（npm install --legacy-peer-deps）\n' +
      '  2. 確認 esbuild binary 對應當前平台（macOS/Linux/Windows）\n' +
      '  3. 若 npm install 警告 platform binary 失敗，移除 node_modules 後重裝'
    );
  }
  if (!mod || typeof mod.build !== 'function') {
    throw new Error(
      '[ESBUILD CHECK] esbuild 模組載入但缺 build() 方法，疑似版本不相容或 binary 損壞'
    );
  }
}

const MODE = process.argv.includes('--prod') ? 'production' : 'development';
const SKIP_VERSION_CHECK = process.argv.includes('--skip-version-check');
const BUILD_DIR = path.join(__dirname, '..', 'build', MODE);
const SOURCE_DIR = path.join(__dirname, '..');
// W1-081：去除硬編碼 v0 major dir，改由 resolveWorklogPath 自 packageVersion
// 取 major 動態推斷。支援 v0/v1+ 並存與 v1 only 場景。
const WORK_LOGS_ROOT = path.join(SOURCE_DIR, 'docs', 'work-logs');

/**
 * 預設 fsAdapter：使用 Node.js fs 模組，與 scripts/validate-manifest.js 同模式
 *
 * 設計目的：將 I/O 與純函式驗證邏輯分離，便於單元測試 mock 檔案系統。
 *
 * W1-083 擴充：syncWorklogStatus 需要寫入能力，於 defaultFsWriter 提供
 * 並維持與 fsAdapter 同樣的注入模式，測試可獨立 mock 寫入路徑。
 */
const defaultFsAdapter = {
  fileExists: (p) => fs.existsSync(p),
  readFile: (p) => fs.readFileSync(p, 'utf8'),
  readdir: (p) => fs.readdirSync(p),
  stat: (p) => fs.statSync(p)
};

/**
 * 預設 fsWriter：供 syncWorklogStatus 寫入 worklog main.md
 *
 * 設計目的：將寫入操作與讀取操作分離。讀取（fsAdapter）為驗證的基礎能力，
 * 寫入（fsWriter）僅由 syncWorklogStatus 使用，分離有助於降低測試 mock 的
 * 認知負擔——驗證測試無需 mock 寫入，sync 測試無需 mock 讀取的全部介面。
 */
const defaultFsWriter = {
  writeFile: (p, content) => fs.writeFileSync(p, content, 'utf8')
};

/**
 * 根據 package.json 版號推斷對應的 worklog patch 目錄路徑
 *
 * 業務情境：W1-083 SSOT 反轉後，package.json 是版本源，build 階段
 * 需確認對應的 worklog 目錄（如 docs/work-logs/v0/v0.19/v0.19.0/）
 * 確實存在。本函式為純路徑推斷工具，無 I/O 副作用。
 *
 * 推斷規則（W1-081 後三層動態化）：
 *   - 0.19.0 -> v0/v0.19/v0.19.0/v0.19.0-main.md
 *   - 0.18.3 -> v0/v0.18/v0.18.3/v0.18.3-main.md
 *   - 1.0.0  -> v1/v1.0/v1.0.0/v1.0.0-main.md
 *   - major dir 取 v{M}（第一段），minor dir 取 v{M.m}（前兩段），patch dir 取 v{M.m.p}（完整三段）
 *
 * 邊界：本函式僅支援 M.m.p 三段格式，不處理 pre-release / build metadata
 * （Chrome Extension manifest version 規範即三段，無 pre-release 需求）。
 *
 * @param {string} packageVersion - package.json 的 version 欄位值
 * @param {string} workLogsRoot - docs/work-logs/ 絕對路徑（W1-081：已從 v0 上移）
 * @returns {{ok: boolean, mainFile?: string, patchDir?: string, error?: string}}
 */
function resolveWorklogPath (packageVersion, workLogsRoot) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(packageVersion);
  if (!match) {
    return {
      ok: false,
      error: `[VERSION CHECK] package.json 版號格式不符 (預期 M.m.p)：${packageVersion}`
    };
  }
  const [, major, minor] = match;
  // W1-081：新增 major 層（v0 / v1 / v2...），原 majorDir 改名為 minorDir
  const majorDir = `v${major}`;
  const minorDir = `v${major}.${minor}`;
  const patchDir = `v${packageVersion}`;
  const patchPath = path.join(workLogsRoot, majorDir, minorDir, patchDir);
  const mainFile = path.join(patchPath, `${patchDir}-main.md`);
  return { ok: true, patchDir: patchPath, mainFile };
}

/**
 * 從 docs/work-logs/ 掃描 active worklog，推斷預期版號（W1-081 後跨 major dir）
 *
 * 業務情境：v0.18.0 已發布後 wave 進入 v0.19.0，但 package.json
 * 未 bump 造成 dist ZIP 顯示舊版號（0.19.0-W1-002.2 觀察）。
 * 本函式以 worklog 「**狀態**: 開發中」標記為 SSOT，
 * 與 package.json 比對作為 build:prod sanity check。
 *
 * 掃描策略（W1-081 後三層遍歷）：
 *   1. 列舉 docs/work-logs/ 下所有 v{major} 目錄並進入掃描（如 v0, v1, v2）
 *   2. 列舉每個 major 目錄下的 v*.* minor 子目錄（如 v0.18, v0.19, v1.0）
 *   3. 列舉每個 minor 目錄下的 v*.*.* patch 子目錄（如 v0.19.0, v1.0.0）
 *   4. 讀取 v{patch}-main.md 並偵測「**狀態**: 開發中」標記
 *   5. 若僅有 1 個 active worklog → 該版號即預期值
 *   6. 若有 0 或 >1 個 active worklog → 回傳 { ok: false, reason }
 *
 * 排序原則：版號以 semantic version 字串排序（適用本專案 v0/v1 並存場景），
 * 多 active 時取最新版作為候選提示，但仍視為錯誤狀態（用戶澄清：架構上
 * 不應同時有多個 active 版本，跨 major dir 多 active 仍 fail-fast）。
 *
 * @param {string} workLogsRoot - docs/work-logs/ 絕對路徑（W1-081：已從 v0 上移）
 * @param {object} fsAdapter - 注入的 fs 介面（測試可 mock）
 * @returns {{ok: boolean, version?: string, reason?: string, candidates?: string[]}}
 */
function detectActiveWorklogVersion (workLogsRoot, fsAdapter = defaultFsAdapter) {
  if (!fsAdapter.fileExists(workLogsRoot)) {
    return { ok: false, reason: `worklog 根目錄不存在: ${workLogsRoot}` };
  }

  const activeVersions = [];

  // W1-081：新增最外層 major dir 掃描（v0 / v1 / v2...），支援 v0/v1 並存與 v1 only 情境
  const majorDirs = fsAdapter.readdir(workLogsRoot)
    .filter((name) => /^v\d+$/.test(name));

  for (const majorDir of majorDirs) {
    const majorPath = path.join(workLogsRoot, majorDir);
    if (!fsAdapter.stat(majorPath).isDirectory()) continue;

    const minorDirs = fsAdapter.readdir(majorPath)
      .filter((name) => /^v\d+\.\d+$/.test(name));

    for (const minorDir of minorDirs) {
      const minorPath = path.join(majorPath, minorDir);
      if (!fsAdapter.stat(minorPath).isDirectory()) continue;

      const patchDirs = fsAdapter.readdir(minorPath)
        .filter((name) => /^v\d+\.\d+\.\d+$/.test(name));

      for (const patchDir of patchDirs) {
        const patchPath = path.join(minorPath, patchDir);
        if (!fsAdapter.stat(patchPath).isDirectory()) continue;

        const mainFile = path.join(patchPath, `${patchDir}-main.md`);
        if (!fsAdapter.fileExists(mainFile)) continue;

        const content = fsAdapter.readFile(mainFile);
        // 偵測「**狀態**: 開發中」標記（容忍前後空白與全形/半形冒號 U+003A / U+FF1A）。
        // W1-084 修復：原 regex [::] 兩字元皆為半形冒號（W1-074 implementation bug），
        // 改為顯式 escape [:：] 與 syncWorklogStatus 對稱真正支援全形冒號。
        if (/\*\*狀態\*\*\s*[:：]\s*開發中/.test(content)) {
          // 移除 v 前綴以對齊 package.json 格式
          activeVersions.push(patchDir.replace(/^v/, ''));
        }
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
 * 驗證 package.json 版號對應的 worklog 目錄存在（W1-083 SSOT 反轉）
 *
 * 業務情境：W1-077 ANA 推薦方向 A——package.json 為唯一版本 source of truth，
 * worklog 標記由 script 自動 sync。本函式不再以 worklog 標記為斷言來源，
 * 改為「以 package.json 版號為源 → 確認對應 worklog 目錄與 main.md 存在」。
 *
 * SSOT 設計說明（與 W1-074 舊邏輯對比）：
 *   - 舊邏輯：讀 worklog 「狀態: 開發中」標記 → 推斷預期版號 → 對比 package.json
 *     （worklog 為 SSOT，人工維護易遺漏）
 *   - 新邏輯：讀 package.json 版號 → 驗證對應 worklog 目錄存在
 *     （package.json 為 SSOT，符合 npm/Chrome Extension 生態慣例）
 *
 * 失敗情境（任一成立即 ok=false）：
 *   - package.json 版號格式不符 M.m.p（resolveWorklogPath 失敗）
 *   - 對應的 worklog patch 目錄不存在（如 v0.99.0 未建立目錄）
 *   - 對應的 main.md 不存在（目錄存在但缺主檔案）
 *
 * 補救路徑：syncWorklogStatus 負責「目錄存在但標記為已完成」的自動更新；
 * 本函式聚焦「結構性存在性」斷言，避免單一函式承載過多職責。
 *
 * @param {string} packageVersion - package.json 的 version 欄位值
 * @param {string} workLogsRoot - docs/work-logs/ 絕對路徑（W1-081：已從 v0 上移）
 * @param {object} fsAdapter - 注入的 fs 介面（測試可 mock）
 * @returns {{ok: boolean, error?: string, actualVersion?: string, expectedMainFile?: string}}
 */
function validateVersionAlignment (packageVersion, workLogsRoot, fsAdapter = defaultFsAdapter) {
  const resolved = resolveWorklogPath(packageVersion, workLogsRoot);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error, actualVersion: packageVersion };
  }

  if (!fsAdapter.fileExists(resolved.patchDir)) {
    return {
      ok: false,
      error: `[VERSION CHECK] package.json 版號 (${packageVersion}) 對應的 worklog 目錄不存在: ${resolved.patchDir}`,
      actualVersion: packageVersion,
      expectedMainFile: resolved.mainFile
    };
  }

  if (!fsAdapter.fileExists(resolved.mainFile)) {
    return {
      ok: false,
      error: `[VERSION CHECK] package.json 版號 (${packageVersion}) 對應的 worklog 主檔案不存在: ${resolved.mainFile}`,
      actualVersion: packageVersion,
      expectedMainFile: resolved.mainFile
    };
  }

  return {
    ok: true,
    actualVersion: packageVersion,
    expectedMainFile: resolved.mainFile
  };
}

/**
 * 同步 worklog 狀態標記至「開發中」（W1-083 SSOT 反轉補救路徑）
 *
 * 業務情境：W1-077 ANA 方向 A 的核心——當 package.json bump 至新版本後，
 * 開發者可能忘記手動更新對應 worklog main.md 的「狀態: 開發中」標記。
 * 本函式由 build:prod 在 validate 通過後自動觸發，將標記同步為「開發中」，
 * 落實 Linus 原則「Don't add a check for the thing humans forget to do.
 * Make it impossible to forget.」
 *
 * 行為矩陣：
 *   - main.md 不存在 → ok=false（交由 validate 階段處理，本函式不重複報錯）
 *   - 標記已為「開發中」 → ok=true, changed=false（no-op）
 *   - 標記為「已完成」/其他 → 改寫為「開發中」，ok=true, changed=true
 *   - 無「狀態」標記行 → ok=false（worklog 結構異常，需人工處理）
 *
 * 容錯設計：regex 容忍前後空白與全形/半形冒號，與 detectActiveWorklogVersion
 * 的偵測邏輯對稱，避免兩處對「狀態」標記格式的判定漂移。
 *
 * 不在本函式範圍：
 *   - 建立 worklog 目錄或 main.md（屬 version-release skill start 子命令）
 *   - 將舊版本標記為「已完成」（屬 version-release skill release 子命令）
 *   本函式僅處理「當前 package.json 版號 → 標記為開發中」的單向 sync。
 *
 * @param {string} packageVersion - package.json 的 version 欄位值
 * @param {string} workLogsRoot - docs/work-logs/ 絕對路徑（W1-081：已從 v0 上移）
 * @param {object} fsAdapter - 注入的 fs 介面（測試可 mock）
 * @param {object} fsWriter - 注入的寫入介面（測試可 mock）
 * @returns {{ok: boolean, changed?: boolean, previousStatus?: string, error?: string, mainFile?: string}}
 */
function syncWorklogStatus (
  packageVersion,
  workLogsRoot,
  fsAdapter = defaultFsAdapter,
  fsWriter = defaultFsWriter
) {
  const resolved = resolveWorklogPath(packageVersion, workLogsRoot);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  if (!fsAdapter.fileExists(resolved.mainFile)) {
    return {
      ok: false,
      error: `[WORKLOG SYNC] worklog 主檔案不存在: ${resolved.mainFile}`,
      mainFile: resolved.mainFile
    };
  }

  const content = fsAdapter.readFile(resolved.mainFile);
  // 容忍前後空白與全形/半形冒號（U+003A / U+FF1A）。
  // 與 detectActiveWorklogVersion（line 175）對稱採顯式 [:：] 確保全形冒號支援
  // （W1-074 implementation bug 於 W1-083 + W1-084 完整修復）。
  const statusRegex = /(\*\*狀態\*\*\s*[:：]\s*)([^\n\r]+)/;
  const match = statusRegex.exec(content);

  if (!match) {
    return {
      ok: false,
      error: `[WORKLOG SYNC] worklog 主檔案缺少「**狀態**: ...」標記行: ${resolved.mainFile}`,
      mainFile: resolved.mainFile
    };
  }

  const previousStatus = match[2].trim();
  if (previousStatus === '開發中') {
    return { ok: true, changed: false, previousStatus, mainFile: resolved.mainFile };
  }

  // 改寫狀態為「開發中」並保留前綴格式（冒號樣式、間距）
  const updatedContent = content.replace(statusRegex, `$1開發中`);
  fsWriter.writeFile(resolved.mainFile, updatedContent);

  return {
    ok: true,
    changed: true,
    previousStatus,
    mainFile: resolved.mainFile
  };
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

    // esbuild early validation（W1-080）：在副作用前 fail-fast 確認 esbuild 可用，
    // 避免清空 build/ 目錄 + 複製檔案完成後才在 bundleEntryPoints 撞到模組錯誤。
    ensureEsbuildAvailable();

    // Design System CSS 產生（0.19.1-W2-001 D1）：
    // 在複製 src/ 之前重新產生 design-system.css，確保 build/{mode}/src/core/
    // design-system/design-system.css 與 3 個 .js 來源一致。filesToCopy 含 src/，
    // 故 generated CSS 隨 src/ 一併複製進 build 目錄（依現有 copy 流程慣例）。
    const dsCss = generateDesignSystemCss();
    console.log(`[DESIGN-SYSTEM] 已產生 ${path.relative(SOURCE_DIR, dsCss.outputPath)}`);

    // 版號 sanity check（W1-074 -> W1-083 SSOT 反轉）
    //
    // Why: build:prod 產出的 ZIP 會分發給內測使用者，需確認 package.json
    // （ npm/Chrome Extension 生態唯一版本源）對應的 worklog 目錄存在，
    // 並將 worklog 狀態標記自動 sync 為「開發中」，避免人工遺漏導致
    // 「ZIP 帶錯版號」或「worklog 標記與實際版本漂移」（W1-077 ANA 結論）。
    //
    // 兩階段流程：
    //   1. validateVersionAlignment：以 package.json 為源，斷言對應 worklog
    //      目錄與 main.md 存在；不存在 fail-fast（如 bump 至全新版號但忘記
    //      建 worklog 目錄）。
    //   2. syncWorklogStatus：通過 validate 後自動將 worklog 標記同步為
    //      「開發中」，補救「狀態漂移」情境（如新版本目錄已建立但標記仍為
    //      已完成 / 缺漏）。
    //
    // 觸發條件：
    //   - production mode 強制執行（除非 --skip-version-check）
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
        console.error('  1. 確認 docs/work-logs/v{M}/v{M.m}/v{M.m.p}/v{M.m.p}-main.md 已建立（W1-081：major 層動態化）');
        console.error('  2. 執行 version-release skill 的 start 子命令自動建立 worklog 結構');
        console.error('  3. dev 期暫時不一致：使用 --skip-version-check flag 繞過');
        process.exit(1);
      }

      console.log(`[VERSION CHECK] package.json (${result.actualVersion}) 對應 worklog 存在`);

      // Auto-sync worklog 狀態標記至「開發中」（W1-083 補救路徑）
      const syncResult = syncWorklogStatus(packageJson.version, WORK_LOGS_ROOT);
      if (!syncResult.ok) {
        console.warn(`[WORKLOG SYNC] ${syncResult.error}`);
        // 不 fail-fast：validate 已通過，sync 失敗不阻擋 build
        // 但顯示警告讓開發者注意 worklog 結構異常
      } else if (syncResult.changed) {
        console.log(
          `[WORKLOG SYNC] worklog 標記自動更新「${syncResult.previousStatus}」-> 「開發中」: ${syncResult.mainFile}`
        );
      } else {
        console.log(`[WORKLOG SYNC] worklog 標記已為「開發中」(no-op)`);
      }
    } else if (MODE === 'production' && SKIP_VERSION_CHECK) {
      console.warn('[VERSION CHECK] 已透過 --skip-version-check 略過版號 sanity check + worklog sync');
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
  syncWorklogStatus,
  resolveWorklogPath,
  defaultFsAdapter,
  defaultFsWriter
};