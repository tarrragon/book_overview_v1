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
 * @version 1.0.0
 */

/**
 * 系統「未分類」category 的確定性 ID。
 *
 * 葉 category 刪除時，其下 tag 的 categoryId 轉至此節點（場景 C2）。
 * 列為 isSystem 預裝節點，本身不可刪除（場景 C4-uncat）。
 */
const UNCATEGORIZED_CATEGORY_ID = 'sys_cat_uncategorized'

/** 系統「未分類」category 顯示名稱 */
const UNCATEGORIZED_CATEGORY_NAME = 'Uncategorized'

/**
 * 賴永祥分類法預裝樹（精簡集：10 主類 + 代表性次類）。
 *
 * 每節點僅含結構欄位（id / name / parentId）；isSystem / 時間戳由
 * initializePresets 注入，保證預裝節點一律 isSystem=true。
 */
const CHINESE_CLASSIFICATION_PRESETS = Object.freeze([
  // === 主類（depth 0） ===
  { id: 'sys_cat_0', name: '0 總類', parentId: null },
  { id: 'sys_cat_1', name: '1 哲學類', parentId: null },
  { id: 'sys_cat_2', name: '2 宗教類', parentId: null },
  { id: 'sys_cat_3', name: '3 自然科學類', parentId: null },
  { id: 'sys_cat_4', name: '4 應用科學類', parentId: null },
  { id: 'sys_cat_5', name: '5 社會科學類', parentId: null },
  { id: 'sys_cat_6', name: '6 史地類：中國史地', parentId: null },
  { id: 'sys_cat_7', name: '7 史地類：世界史地', parentId: null },
  { id: 'sys_cat_8', name: '8 語言文學類', parentId: null },
  { id: 'sys_cat_9', name: '9 藝術類', parentId: null },

  // === 代表性次類（depth 1） ===
  { id: 'sys_cat_00', name: '00 特藏', parentId: 'sys_cat_0' },
  { id: 'sys_cat_01', name: '01 目錄學', parentId: 'sys_cat_0' },
  { id: 'sys_cat_02', name: '02 圖書館學', parentId: 'sys_cat_0' },
  { id: 'sys_cat_11', name: '11 思想、學術', parentId: 'sys_cat_1' },
  { id: 'sys_cat_12', name: '12 中國哲學', parentId: 'sys_cat_1' },
  { id: 'sys_cat_85', name: '85 各國文學總集', parentId: 'sys_cat_8' }
])

module.exports = {
  UNCATEGORIZED_CATEGORY_ID,
  UNCATEGORIZED_CATEGORY_NAME,
  CHINESE_CLASSIFICATION_PRESETS
}
