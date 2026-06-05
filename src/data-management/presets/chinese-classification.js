/**
 * 賴永祥中文圖書分類法預裝資料（樹狀 model 場景組 D）
 *
 * 業務情境：Chrome Extension 首次安裝時，將賴永祥分類法（中文圖書分類法）
 * 主類預裝為系統 TagCategory 樹，供使用者直接套用分類標籤。預裝節點以
 * 「確定性 ID」（sys_cat_*）標識，使 initializePresets 可冪等 upsert——
 * onInstalled / onStartup 重複呼叫不重建、不產生隨機 ID 重複節點。
 *
 * 範圍邊界（TD-6）：完整 110 節點精確類號與授權出處（NCL）依賴 W2-003
 * 授權調查，本檔先提供主類 + 代表性次類的精簡集，驗證「預裝載入機制」
 * 而非「資料完整性」。完整資料集到位後僅替換本檔內容，載入機制不變。
 *
 * 確定性 ID 規則：
 * - 主類：sys_cat_<主類號>（例 0 總類 → sys_cat_0）
 * - 次類：sys_cat_<主類號><次類號>（例 00 特藏 → sys_cat_00）
 * - 系統保留「未分類」：sys_cat_uncategorized（葉刪除時 tag 轉入目標）
 *
 * 規格來源：SPEC-010 §3 場景組 D / docs/bookstores、PROP-007
 *
 * 資料 SSOT：本模組的常數與預裝節點清單來自同層 `chinese-classification.json`
 * （場景組 E3 打包決策）。將資料外置為 JSON 純資料檔，使其能作為 bundle 打包資產
 * 在 build.js 的複製清單中被明示列出，且 esbuild bundle SW 時直接內嵌（非執行期 fetch）。
 * 本 `.js` 模組僅負責讀取 JSON、凍結預裝清單並維持既有匯出 API 穩定。
 *
 * @version 1.1.0
 */

const classificationData = require('./chinese-classification.json')

/**
 * 系統「未分類」category 的確定性 ID。
 *
 * 葉 category 刪除時，其下 tag 的 categoryId 轉至此節點（場景 C2）。
 * 列為 isSystem 預裝節點，本身不可刪除（場景 C4-uncat）。
 */
const UNCATEGORIZED_CATEGORY_ID = classificationData.uncategorizedCategoryId

/** 系統「未分類」category 顯示名稱 */
const UNCATEGORIZED_CATEGORY_NAME = classificationData.uncategorizedCategoryName

/**
 * 賴永祥分類法預裝樹（精簡集：10 主類 + 代表性次類）。
 *
 * 每節點僅含結構欄位（id / name / parentId）；isSystem / 時間戳由
 * initializePresets 注入，保證預裝節點一律 isSystem=true。資料來自
 * chinese-classification.json，此處凍結避免呼叫端意外變更共用清單。
 */
const CHINESE_CLASSIFICATION_PRESETS = Object.freeze(
  classificationData.presets.map((node) => Object.freeze({ ...node }))
)

module.exports = {
  UNCATEGORIZED_CATEGORY_ID,
  UNCATEGORIZED_CATEGORY_NAME,
  CHINESE_CLASSIFICATION_PRESETS
}
