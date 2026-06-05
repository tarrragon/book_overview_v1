/**
 * 建置進入點（root entry）+ 打包資產宣告
 *
 * 業務情境：本專案實際建置邏輯（清理 / 複製 / esbuild 三入口 bundle / 版號檢查）位於
 * `scripts/build.js`，由 package.json 的 build / build:dev / build:prod 腳本呼叫。本檔為
 * 倉庫根目錄的薄進入點，re-export `scripts/build.js` 全部匯出，使「根目錄 build.js」此一
 * 慣例路徑可被工具與測試直接引用，而不分裂實際建置邏輯（SSOT 仍在 scripts/build.js）。
 *
 * 打包資產宣告（場景組 E3 — 賴永祥分類法資料檔打包決策）：
 * 預裝分類資料以 `src/data-management/presets/chinese-classification.json` 為 SSOT。
 * 該 JSON 經由兩條路徑進入分發產物，無需新增獨立複製機制：
 *   1. esbuild bundle — `tag-storage-adapter` → `presets/chinese-classification.js`
 *      → `require('./chinese-classification.json')`，bundle SW 時 JSON 內容直接內嵌，
 *      Chrome Extension runtime 不需執行期 fetch（MV3 相容，E1 storage.local 明文路徑）。
 *   2. 遞迴複製 — scripts/build.js 的 filesToCopy 含 `src/`，copyRecursive 遞迴複製整個
 *      src/ 樹（已排除 .test. / .backup），故 chinese-classification.json 隨 src/ 一併入產物。
 *
 * 下方 BUNDLED_DATA_ASSETS 明示列出打包資料資產，作為「資料檔已納入打包」的可查詢宣告，
 * 供建置驗證與打包稽核引用（避免資料檔遺漏靜默不入產物）。
 */

// 實際建置邏輯 SSOT：scripts/build.js（清理 / 複製 / esbuild bundle / 版號檢查）
const scriptsBuild = require('./scripts/build')

/**
 * 打包資料資產清單（場景組 E3）。
 *
 * 每項為相對倉庫根的資料檔路徑。這些檔案經 esbuild bundle 內嵌與 src/ 遞迴複製進入產物，
 * 不需獨立 COPY_PATHS——列於此處為打包稽核的單一可查詢來源。
 */
const BUNDLED_DATA_ASSETS = Object.freeze([
  'src/data-management/presets/chinese-classification.json'
])

module.exports = {
  ...scriptsBuild,
  BUNDLED_DATA_ASSETS
}
