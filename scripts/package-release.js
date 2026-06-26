#!/usr/bin/env node
/**
 * Readmoo 書庫提取器 - 測試者發布打包腳本
 *
 * 業務情境：正式上架 Chrome Web Store 前，需提供測試者一個可安裝的生產版分發包。
 * 本腳本將生產版建置（build/production/）打包為含版本號的 ZIP，連同安裝說明
 * README 一併輸出至根目錄 release/，讓每次釋出可重複、降低人為遺漏。
 *
 * 與 scripts/package.js 的分工：
 * - package.js（npm run package）：內測壓縮，輸出至 dist/（不入版控），不產 README。
 * - package-release.js（npm run package:release）：測試者發布，先跑 build:prod 確保
 *   產物最新，輸出至 release/ 並附 README 安裝說明。沿用 package.js 驗證過的壓縮
 *   做法（在 build 目錄內執行 zip 使 manifest.json 落在根層），但 README 屬本腳本
 *   獨有職責。兩者刻意不共用模組：package.js 在 module load 即執行 packageExtension()，
 *   無法乾淨匯入其函式；複製這段穩定壓縮邏輯比為打包工具引入 export 重構更低風險。
 *
 * 設計決策：
 * - 主動觸發 build:prod，避免分發到舊的或不存在的 build 產物（測試者場景下不可假設
 *   操作者已先手動 build）。
 * - 版本號動態讀取 build/production/manifest.json，禁止硬編碼；版本 bump 由
 *   version-release 流程負責，本腳本只負責打包。
 * - 重跑前清理 release/ 內舊 ZIP（保留當前版本由 createZip 重壓），避免多版本累積誤分發。
 * - README.md 可入版控（提供安裝說明）；ZIP 屬建置產物不入版控（.gitignore 忽略
 *   release/*.zip）。
 * - 使用系統 zip 命令而非 archiver npm 套件，避免為打包工具引入新依賴（與 package.js
 *   一致）。開發環境（macOS/Linux）與 CI 均預裝 zip；不可用時給出明確錯誤指引。
 *
 * 變更影響：若 build.js 改變輸出目錄或 manifest 位置，需同步更新本腳本與 package.js 常數。
 */

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const PROJECT_ROOT = path.join(__dirname, '..')
const BUILD_DIR = path.join(PROJECT_ROOT, 'build', 'production')
const RELEASE_DIR = path.join(PROJECT_ROOT, 'release')
const MANIFEST_PATH = path.join(BUILD_DIR, 'manifest.json')
const README_PATH = path.join(RELEASE_DIR, 'README.md')
const ZIP_SIZE_LIMIT_BYTES = 5 * 1024 * 1024 // 5 MB，分發包合理上限（與 package.js 一致）
const ZIP_NAME_PATTERN = /^readmoo-book-extractor-v.+\.zip$/

/**
 * 執行生產版建置（build:prod）
 *
 * 測試者發布場景不可假設操作者已先手動 build，故主動觸發 build:prod，
 * 確保打包的是最新的生產版產物（移除 log 輸出）。
 */
function runProductionBuild () {
  console.log('[BUILD] 執行生產版建置 build:prod ...')
  execFileSync('node', ['scripts/build.js', '--prod'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  })
}

/**
 * 確認 build/production/ 已存在且含必要產物
 *
 * build:prod 失敗或輸出位置變更時直接中止，避免打包出空白或殘缺的 ZIP。
 */
function verifyBuildOutput () {
  if (!fs.existsSync(BUILD_DIR)) {
    console.error('[ERROR] build/production/ 不存在，build:prod 可能失敗')
    process.exit(1)
  }

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('[ERROR] build/production/manifest.json 不存在，build 產物不完整')
    process.exit(1)
  }
}

/**
 * 從 build 產物的 manifest.json 動態讀取版本號
 *
 * 版本號為 ZIP 檔名與 README 內容的一部分，必須與實際打包的 manifest 一致，
 * 故讀取 build/production/manifest.json（已注入版本）而非根目錄 manifest。
 */
function readVersion () {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))

  if (!manifest.version) {
    console.error('[ERROR] manifest.json 缺少 version 欄位')
    process.exit(1)
  }

  return manifest.version
}

/**
 * 確認系統 zip 命令可用
 *
 * zip 不可用時給出安裝指引，符合可觀測性要求（異常不可靜默）。
 */
function verifyZipAvailable () {
  try {
    execFileSync('zip', ['--version'], { stdio: 'ignore' })
  } catch (error) {
    console.error('[ERROR] 系統 zip 命令不可用，無法打包')
    console.error('[ERROR] macOS 通常預裝；Linux 可執行：sudo apt-get install zip')
    console.error(`[ERROR] 原始錯誤：${error.message}`)
    process.exit(1)
  }
}

/**
 * 清理 release/ 內舊版本的 ZIP，只保留當前版本（交由 createZip 重壓）
 *
 * Why: 版本 bump 後舊版 ZIP（如 readmoo-book-extractor-v1.4.1.zip）會持續累積於
 * release/，分發時可能誤拿舊檔。
 * Consequence: 不清理會讓 release/ 同時存在多版本 ZIP，分發者需自行辨識最新版。
 * Action: 刪除所有符合 readmoo-book-extractor-v*.zip 命名但版本不等於當前版本的檔案；
 * 其他命名的檔案（如 README.md）不動，避免誤刪非本工具產物。
 *
 * @param {string} currentVersion 當前打包版本
 */
function cleanStaleZips (currentVersion) {
  const currentZipName = `readmoo-book-extractor-v${currentVersion}.zip`
  const entries = fs.readdirSync(RELEASE_DIR)

  for (const entry of entries) {
    if (entry === currentZipName) {
      continue
    }
    if (!ZIP_NAME_PATTERN.test(entry)) {
      continue
    }

    fs.rmSync(path.join(RELEASE_DIR, entry))
    console.log(`[CLEAN] 移除舊版本 ZIP：release/${entry}`)
  }
}

/**
 * 將 build/production/ 內容壓縮為 ZIP
 *
 * 在 BUILD_DIR 內執行 zip（透過 cwd 選項），使壓縮路徑相對於該目錄，
 * 確保 manifest.json 落在 ZIP 根層（Chrome unpacked 載入要求）。排除 .backup* 殘留。
 *
 * @param {string} zipPath 目標 ZIP 絕對路徑
 */
function createZip (zipPath) {
  // 移除既有同名 ZIP，避免 zip 命令以增量模式累加舊內容
  if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath)
  }

  console.log('[PACKAGE] 開始壓縮 build/production/ ...')

  // -r 遞迴 / -q 安靜 / -X 不存入額外檔案屬性 / -x 排除 .backup* 檔案
  execFileSync(
    'zip',
    ['-r', '-q', '-X', zipPath, '.', '-x', '*.backup*'],
    { cwd: BUILD_DIR }
  )
}

/**
 * 驗證 ZIP 產物：大小限制 + manifest.json 在根層
 *
 * @param {string} zipPath ZIP 絕對路徑
 */
function verifyZip (zipPath) {
  const sizeBytes = fs.statSync(zipPath).size
  const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2)

  if (sizeBytes >= ZIP_SIZE_LIMIT_BYTES) {
    console.error(`[ERROR] ZIP 大小 ${sizeMB} MB 超過 5 MB 上限`)
    process.exit(1)
  }

  // 確認 manifest.json 位於 ZIP 根層（無路徑前綴）
  const zipList = execFileSync('zip', ['-sf', zipPath], { encoding: 'utf8' })
  const hasRootManifest = zipList
    .split('\n')
    .some(line => line.trim() === 'manifest.json')

  if (!hasRootManifest) {
    console.error('[ERROR] manifest.json 未位於 ZIP 根層，不符合 Chrome unpacked 載入要求')
    process.exit(1)
  }

  console.log(`[VERIFY] ZIP 大小：${sizeMB} MB（上限 5 MB）`)
  console.log('[VERIFY] manifest.json 位於 ZIP 根層')
}

/**
 * 產出測試者安裝說明 README.md 至 release/
 *
 * README 可入版控（與 ZIP 產物分離），內容含版本、Chrome 開發者模式載入未封裝步驟、
 * 注意事項。每次打包以當前版本重新生成，確保版本資訊與 ZIP 一致。
 *
 * @param {string} version 當前打包版本
 * @param {string} zipName ZIP 檔名
 */
function writeReadme (version, zipName) {
  const content = `# Readmoo 書庫管理器 - 測試者安裝說明

**版本**：v${version}
**分發包**：\`${zipName}\`

## 下載

- **GitHub Releases**：https://github.com/tarrragon/book_overview_v1/releases/tag/v${version}
- 本機打包：執行 \`npm run package:release\` 後，ZIP 位於 \`release/\` 目錄

---

本擴充功能為 Readmoo 電子書平台設計，提供書庫資料自動提取、本地化書目管理、
搜尋篩選和批量匯出功能。本版本為正式上架前的測試版，以「載入未封裝項目」方式安裝。

---

## 安裝步驟（Chrome 開發者模式）

1. 從上方連結下載 \`${zipName}\` 並解壓，得到一個資料夾（內含 \`manifest.json\` 於根層）。
2. 開啟 Chrome，於網址列輸入 \`chrome://extensions\` 並前往。
3. 開啟右上角的「開發人員模式 / Developer mode」開關。
4. 點選左上角「載入未封裝項目 / Load unpacked」。
5. 選擇步驟 1 解壓出的資料夾（包含 \`manifest.json\` 的那一層）。
6. 安裝完成後，工具列會出現本擴充功能圖示；釘選後即可使用。

---

## 使用方式

1. 登入 Readmoo 並前往書庫頁面：\`https://read.readmoo.com/#/library\`
2. 點選工具列的擴充功能圖示，開啟 Popup。
3. 依 Popup 指示執行書庫提取、搜尋篩選或匯出。

---

## 注意事項

- 本版本以「未封裝項目」安裝，**重新啟動 Chrome 後仍會保留**，但「開發人員模式」
  關閉時擴充功能會停用。
- 提取功能需在已登入的 Readmoo 書庫頁面（\`read.readmoo.com\`）執行。
- 若提取結果為空或不完整，請確認書庫頁面已完整載入後再試。
- 此為測試版，回報問題請附上 Chrome 版本與重現步驟。

---

## 移除方式

於 \`chrome://extensions\` 找到本擴充功能，點選「移除 / Remove」即可。

---

*本說明由 \`npm run package:release\` 自動生成（版本 v${version}）。*
`

  fs.writeFileSync(README_PATH, content, 'utf8')
  console.log(`[README] 已產出安裝說明：release/README.md（v${version}）`)
}

/**
 * 主要發布打包流程
 */
function packageRelease () {
  console.log('[RELEASE] Readmoo 書庫提取器 - 測試者發布打包啟動')

  verifyZipAvailable()
  runProductionBuild()
  verifyBuildOutput()

  const version = readVersion()
  console.log(`[VERSION] 打包版本：${version}（來源：build/production/manifest.json）`)

  if (!fs.existsSync(RELEASE_DIR)) {
    fs.mkdirSync(RELEASE_DIR, { recursive: true })
  }

  // 清理舊版本 ZIP（保留當前版本），避免 release/ 累積多版本造成誤分發
  cleanStaleZips(version)

  const zipName = `readmoo-book-extractor-v${version}.zip`
  const zipPath = path.join(RELEASE_DIR, zipName)

  createZip(zipPath)
  verifyZip(zipPath)
  writeReadme(version, zipName)

  console.log(`[DONE] 發布包完成：release/${zipName}`)
  console.log('[DONE] 安裝說明：release/README.md')
  console.log('[NEXT] 解壓後在 Chrome chrome://extensions 載入未封裝項目即可測試')
}

packageRelease()
