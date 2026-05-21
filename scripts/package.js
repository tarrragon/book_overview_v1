#!/usr/bin/env node
/**
 * Readmoo 書庫提取器 - 打包腳本
 *
 * 業務情境：v1.0 內測版本需可分發給內測使用者。npm run build:prod 已能產出
 * build/production/ 目錄，但 Chrome 載入需要可分發的單一檔案。本腳本將
 * build/production/ 壓縮為 dist/readmoo-book-extractor-v{version}.zip。
 *
 * 設計決策：
 * - 版本號動態讀取 build/production/manifest.json 的 version 欄位，禁止硬編碼。
 *   版本號 bump 由 version-release 流程負責，本腳本只負責打包。
 * - manifest.json 必須位於 ZIP 根層，符合 Chrome unpacked 載入要求。
 *   做法為在 build/production/ 目錄內執行 zip，使壓縮路徑相對於該目錄。
 * - 排除 .backup* 開發殘留檔案，避免污染分發產物。
 * - 使用系統 zip 命令而非 archiver npm 套件，避免為內測打包工具引入新依賴。
 *   開發環境（macOS/Linux）與 CI 均預裝 zip；不可用時給出明確錯誤指引。
 *
 * 前置條件：須先執行 npm run build:prod 產出 build/production/。
 * 變更影響：若 build.js 改變輸出目錄或 manifest 位置，需同步更新本腳本常數。
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build', 'production');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const MANIFEST_PATH = path.join(BUILD_DIR, 'manifest.json');
const ZIP_SIZE_LIMIT_BYTES = 5 * 1024 * 1024; // 5 MB，Chrome Web Store v1.0 內測階段合理上限

/**
 * 確認 build/production/ 已存在且含必要產物
 *
 * 缺少 build 產物時直接中止，提示使用者先執行 build:prod，
 * 避免打包出空白或殘缺的 ZIP。
 */
function verifyBuildOutput () {
  if (!fs.existsSync(BUILD_DIR)) {
    console.error('[ERROR] build/production/ 不存在，請先執行：npm run build:prod');
    process.exit(1);
  }

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('[ERROR] build/production/manifest.json 不存在，build 產物不完整');
    console.error('[ERROR] 請重新執行：npm run build:prod');
    process.exit(1);
  }
}

/**
 * 從 build 產物的 manifest.json 動態讀取版本號
 *
 * 版本號為 ZIP 檔名的一部分，必須與實際打包的 manifest 一致，
 * 故讀取 build/production/manifest.json（已注入版本）而非根目錄 manifest。
 */
function readVersion () {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  if (!manifest.version) {
    console.error('[ERROR] manifest.json 缺少 version 欄位');
    process.exit(1);
  }

  return manifest.version;
}

/**
 * 確認系統 zip 命令可用
 *
 * zip 不可用時給出安裝指引，符合可觀測性要求（異常不可靜默）。
 */
function verifyZipAvailable () {
  try {
    execFileSync('zip', ['--version'], { stdio: 'ignore' });
  } catch (error) {
    console.error('[ERROR] 系統 zip 命令不可用，無法打包');
    console.error('[ERROR] macOS 通常預裝；Linux 可執行：sudo apt-get install zip');
    console.error(`[ERROR] 原始錯誤：${error.message}`);
    process.exit(1);
  }
}

/**
 * 將 build/production/ 內容壓縮為 ZIP
 *
 * 在 BUILD_DIR 內執行 zip（透過 cwd 選項），使壓縮路徑相對於該目錄，
 * 確保 manifest.json 落在 ZIP 根層。排除 .backup* 開發殘留檔案。
 *
 * @param {string} zipPath 目標 ZIP 絕對路徑
 */
function createZip (zipPath) {
  // 移除既有同名 ZIP，避免 zip 命令以增量模式累加舊內容
  if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath);
  }

  console.log('[PACKAGE] 開始壓縮 build/production/ ...');

  // -r 遞迴 / -q 安靜 / -X 不存入額外檔案屬性 / -x 排除 .backup* 檔案
  execFileSync(
    'zip',
    ['-r', '-q', '-X', zipPath, '.', '-x', '*.backup*'],
    { cwd: BUILD_DIR }
  );
}

/**
 * 驗證 ZIP 產物：大小限制 + manifest.json 在根層
 *
 * @param {string} zipPath ZIP 絕對路徑
 */
function verifyZip (zipPath) {
  const sizeBytes = fs.statSync(zipPath).size;
  const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);

  if (sizeBytes >= ZIP_SIZE_LIMIT_BYTES) {
    console.error(`[ERROR] ZIP 大小 ${sizeMB} MB 超過 5 MB 上限`);
    process.exit(1);
  }

  // 確認 manifest.json 位於 ZIP 根層（無路徑前綴）
  const zipList = execFileSync('zip', ['-sf', zipPath], { encoding: 'utf8' });
  const hasRootManifest = zipList
    .split('\n')
    .some(line => line.trim() === 'manifest.json');

  if (!hasRootManifest) {
    console.error('[ERROR] manifest.json 未位於 ZIP 根層，不符合 Chrome unpacked 載入要求');
    process.exit(1);
  }

  console.log(`[VERIFY] ZIP 大小：${sizeMB} MB（上限 5 MB）`);
  console.log('[VERIFY] manifest.json 位於 ZIP 根層');
}

/**
 * 主要打包流程
 */
function packageExtension () {
  console.log('[PACKAGE] Readmoo 書庫提取器 - 打包流程啟動');

  verifyBuildOutput();
  verifyZipAvailable();

  const version = readVersion();
  console.log(`[VERSION] 打包版本：${version}（來源：build/production/manifest.json）`);

  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  const zipName = `readmoo-book-extractor-v${version}.zip`;
  const zipPath = path.join(DIST_DIR, zipName);

  createZip(zipPath);
  verifyZip(zipPath);

  console.log(`[DONE] 打包完成：dist/${zipName}`);
  console.log('[NEXT] 解壓後在 Chrome 載入未封裝擴充功能即可測試');
}

packageExtension();
