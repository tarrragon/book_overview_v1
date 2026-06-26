/**
 * Popup UI 文字常數 - 按功能分類集中管理
 *
 * 分類軸為「功能領域」（status / extraction / import / ...）而非「元件名稱」，
 * 使同一語意的文字無論被哪個元件使用都落在同一分類，利於 i18n 與維護。
 *
 * 注意：Logger 專用的 MessageDictionary 訊息（popup.js 中的 popupMessages）
 * 不納入此檔，保留於原處作為日誌字典。
 */

const HEADER_TEXT = Object.freeze({
  TITLE: 'Book Overview',
  SUBTITLE: '專業書目管理工具'
})

const STATUS_TEXT = Object.freeze({
  CHECKING: '正在檢查狀態...',
  INITIALIZING: '請稍候，正在初始化擴充功能',
  CONTENT_SCRIPT_LOADING: '正在連線書庫頁面',
  CONTENT_SCRIPT_RELOAD_HINT: '請稍候或重新整理頁面',
  NON_READMOO_PAGE: '請前往 Readmoo 網站',
  NON_READMOO_HINT: '需要在 Readmoo 書庫頁面使用此功能'
})

const ACTION_TEXT = Object.freeze({
  EXTRACT: '開始提取書庫資料',
  SETTINGS: '擴充功能設定',
  HELP: '使用說明',
  VIEW_LIBRARY: '檢視書庫',
  VIEW_LIBRARY_ARIA: '開啟書庫總覽頁面檢視所有書籍',
  IMPORT: '匯入書庫',
  IMPORT_ARIA: '從 JSON 檔案匯入書庫資料',
  DIAGNOSTIC: '診斷模式'
})

const EXTRACTION_TEXT = Object.freeze({
  IN_PROGRESS: '正在提取書庫資料',
  HINT: '請保持頁面開啟，不要關閉瀏覽器',
  PROGRESS_HEADER: '提取進度',
  PROGRESS_PLACEHOLDER: '準備開始提取...'
})

const RESULTS_TEXT = Object.freeze({
  HEADER: '提取結果',
  EXTRACTED_LABEL: '已提取書籍:',
  EXTRACTED_UNIT: '本',
  TIME_LABEL: '提取時間:',
  SUCCESS_RATE_LABEL: '成功率:',
  EXPORT: '匯出資料',
  VIEW_RESULTS: '查看結果',
  VIEW_RESULTS_ARIA: '查看詳細的提取結果'
})

const ERROR_TEXT = Object.freeze({
  HEADER: '錯誤訊息',
  DEFAULT_MESSAGE: '發生未知錯誤',
  RETRY: '重試',
  RELOAD_EXTENSION: '重新載入擴充功能',
  SUGGESTIONS_LABEL: '建議解決步驟：',
  INIT_HEADER: '系統初始化失敗',
  INIT_DEFAULT_MESSAGE: '擴充功能初始化過程中發生錯誤',
  FORCE_RELOAD: '強制重新載入擴充功能',
  OPEN_EXTENSION_PAGE: '開啟擴充功能管理頁面'
})

const PAGE_INFO_TEXT = Object.freeze({
  CURRENT_PAGE_LABEL: '當前頁面:',
  CURRENT_PAGE_PLACEHOLDER: '檢測中...',
  DETECTED_BOOKS_LABEL: '檢測到書籍:',
  EXTENSION_STATUS_LABEL: '擴充功能狀態:'
})

const VERSION_TEXT = Object.freeze({
  LOADING: '載入中...'
})

/**
 * 對話框 / 提示類訊息（alert / 流程提示）
 */
const DIALOG_TEXT = Object.freeze({
  SETTINGS_PLACEHOLDER: '設定功能將在後續版本實現',
  HELP_TEXT: '使用說明：\n\n1. 前往 Readmoo 書庫頁面\n2. 點擊「開始提取書庫資料」\n3. 等待提取完成\n\n詳細說明將在後續版本提供'
})

/**
 * 狀態 badge 顯示文字（updateStatus 第 1 參數）
 *
 * 統一狀態詞彙體系：以使用者視角的「就緒/未連線」取代技術簡語「線上/離線」，
 * 避免同一狀態欄混用兩套詞彙造成認知負擔（W1-005 詞彙表）。
 */
const STATUS_BADGE = Object.freeze({
  READY: '就緒',
  LOADING: '載入中',
  DISCONNECTED: '未連線'
})

/**
 * 狀態類型枚舉（語意常數，非顯示文字）
 */
const STATUS_TYPES = Object.freeze({
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
  WARNING: 'warning'
})

/**
 * 訊息類型枚舉（popup↔SW/CS 通訊指令）
 */
const MESSAGE_TYPES = Object.freeze({
  PING: 'PING',
  GET_STATUS: 'GET_STATUS',
  START_EXTRACTION: 'START_EXTRACTION'
})

const NAVIGATION_TEXT = Object.freeze({
  SECTION_TITLE: '前往書庫',
  GO_BUTTON_ARIA_PREFIX: '前往 '
})

module.exports = {
  HEADER_TEXT,
  STATUS_TEXT,
  ACTION_TEXT,
  EXTRACTION_TEXT,
  RESULTS_TEXT,
  ERROR_TEXT,
  PAGE_INFO_TEXT,
  VERSION_TEXT,
  DIALOG_TEXT,
  STATUS_BADGE,
  STATUS_TYPES,
  MESSAGE_TYPES,
  NAVIGATION_TEXT
}
