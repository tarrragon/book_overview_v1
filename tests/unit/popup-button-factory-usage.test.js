/**
 * createElement('button') 工廠使用守護（1.5.0-W6-001，AC2 驗證型）
 *
 * 目的：popup 的按鈕元件一律經 src/popup/components/ui-factory.js 工廠建立
 *   （CLAUDE.md §6.1），繞過工廠直建 `createElement('button')` 歸零。
 *   Phase 1 查證現況已滿足（僅 ui-factory.js 自身一處合法），本測試固化現況
 *   並防未來回歸。
 *
 * 靜態掃描為專案內原始碼 fs 同步讀取，無網路/計時/隨機依賴。
 *
 * @see docs/work-logs/v1/v1.5/v1.5.0/tickets/1.5.0-W6-001.md Solution Phase 1 第 3 節
 */

const fs = require('fs')
const path = require('path')

const POPUP_SRC_DIR = path.join(__dirname, '..', '..', 'src', 'popup')
const BUTTON_CREATE_PATTERN = /createElement\(\s*['"`]button['"`]\s*\)/

/**
 * 遞迴列舉目錄下所有 .js 檔（回傳相對於 baseDir 的 POSIX 路徑）
 *
 * @param {string} dir - 當前掃描目錄（絕對路徑）
 * @param {string} baseDir - 相對路徑基準目錄（絕對路徑）
 * @returns {string[]} 相對路徑清單
 */
function listJsFiles (dir, baseDir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const absPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return listJsFiles(absPath, baseDir)
    if (entry.isFile() && entry.name.endsWith('.js')) {
      return [path.relative(baseDir, absPath).split(path.sep).join('/')]
    }
    return []
  })
}

describe('popup 按鈕工廠使用守護（1.5.0-W6-001）', () => {
  // B1：createElement('button') 直建僅 ui-factory.js 一處
  test("createElement('button') 命中檔案僅 components/ui-factory.js", () => {
    const jsFiles = listJsFiles(POPUP_SRC_DIR, POPUP_SRC_DIR)
    const hitFiles = jsFiles.filter((relFile) => {
      const source = fs.readFileSync(path.join(POPUP_SRC_DIR, relFile), 'utf8')
      return BUTTON_CREATE_PATTERN.test(source)
    })
    expect(hitFiles).toEqual(['components/ui-factory.js'])
  })
})
