/**
 * 錯誤代碼常數定義
 *
 * 基於語意錯誤代碼系統設計 v4.0.0
 * 使用簡單字串常數方式，消除魔法字串並提供 IDE 支援
 *
 * 設計原則：
 * - 使用描述性的全名稱，不使用縮寫
 * - ErrorCodes.CONSTANT = 'CONSTANT' 的簡單對應
 * - 零效能開銷，完全編譯時最佳化
 * - 提供完整的 IDE 自動完成支援
 */

/**
 * 系統錯誤代碼常數
 * @readonly
 * @enum {string}
 */
const ErrorCodes = {
  // ============================================================================
  // 通用系統錯誤
  // ============================================================================

  /** 未知錯誤 - 系統無法識別的錯誤情況 */
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',

  /** 操作失敗 - 通用操作執行失敗 */
  OPERATION_FAILED: 'OPERATION_FAILED',

  /** 操作逾時 - 操作執行超過預期時間 */
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',

  /** 系統初始化失敗 - 系統或模組初始化過程失敗 */
  SYSTEM_INITIALIZATION_FAILED: 'SYSTEM_INITIALIZATION_FAILED',

  /** 設定載入失敗 - 無法載入或解析設定檔案 */
  CONFIGURATION_LOAD_FAILED: 'CONFIGURATION_LOAD_FAILED',

  // ============================================================================
  // 驗證與權限錯誤
  // ============================================================================

  /** 驗證失敗 - 資料驗證不符合規範 */
  VALIDATION_FAILED: 'VALIDATION_FAILED',

  /** 權限拒絕 - 缺乏執行操作的必要權限 */
  PERMISSION_DENIED: 'PERMISSION_DENIED',

  /** 存取令牌無效 - 認證令牌已過期或無效 */
  ACCESS_TOKEN_INVALID: 'ACCESS_TOKEN_INVALID',

  /** 認證失敗 - 使用者身分認證失敗 */
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',

  // ============================================================================
  // 網路連線錯誤
  // ============================================================================

  /** 網路錯誤 - 通用網路連線問題 */
  NETWORK_ERROR: 'NETWORK_ERROR',

  /** 網路連線逾時 - 網路請求超過逾時限制 */
  NETWORK_CONNECTION_TIMEOUT: 'NETWORK_CONNECTION_TIMEOUT',

  /** 網路連線失敗 - 無法建立網路連線 */
  NETWORK_CONNECTION_FAILED: 'NETWORK_CONNECTION_FAILED',

  /** HTTP 請求失敗 - HTTP 請求返回錯誤狀態 */
  HTTP_REQUEST_FAILED: 'HTTP_REQUEST_FAILED',

  /** HTTP 回應解析失敗 - 無法解析 HTTP 回應內容 */
  HTTP_RESPONSE_PARSE_FAILED: 'HTTP_RESPONSE_PARSE_FAILED',

  /** 遠端伺服器錯誤 - 遠端伺服器返回錯誤 */
  REMOTE_SERVER_ERROR: 'REMOTE_SERVER_ERROR',

  // ============================================================================
  // 資料儲存錯誤
  // ============================================================================

  /** 儲存錯誤 - 通用資料儲存問題 */
  STORAGE_ERROR: 'STORAGE_ERROR',

  /** 儲存空間不足 - 本地儲存空間已滿 */
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',

  /** 儲存讀取失敗 - 無法從儲存裝置讀取資料 */
  STORAGE_READ_FAILED: 'STORAGE_READ_FAILED',

  /** 儲存寫入失敗 - 無法將資料寫入儲存裝置 */
  STORAGE_WRITE_FAILED: 'STORAGE_WRITE_FAILED',

  /** 儲存刪除失敗 - 無法從儲存裝置刪除資料 */
  STORAGE_DELETE_FAILED: 'STORAGE_DELETE_FAILED',

  /** Chrome 儲存同步失敗 - Chrome 擴充功能儲存同步錯誤 */
  CHROME_STORAGE_SYNC_FAILED: 'CHROME_STORAGE_SYNC_FAILED',

  // ============================================================================
  // 書籍資料處理錯誤
  // ============================================================================

  /** 書籍驗證失敗 - 書籍資料不符合驗證規範 */
  BOOK_VALIDATION_FAILED: 'BOOK_VALIDATION_FAILED',

  /** 書籍提取失敗 - 從來源提取書籍資料失敗 */
  BOOK_EXTRACTION_FAILED: 'BOOK_EXTRACTION_FAILED',

  /** 書籍同步失敗 - 書籍資料同步過程失敗 */
  BOOK_SYNC_FAILED: 'BOOK_SYNC_FAILED',

  /** 書籍更新失敗 - 更新書籍資料失敗 */
  BOOK_UPDATE_FAILED: 'BOOK_UPDATE_FAILED',

  /** 書籍分類失敗 - 書籍自動分類處理失敗 */
  BOOK_CLASSIFICATION_FAILED: 'BOOK_CLASSIFICATION_FAILED',

  /** 書籍匯出失敗 - 書籍資料匯出過程失敗 */
  BOOK_EXPORT_FAILED: 'BOOK_EXPORT_FAILED',

  /** 書籍操作失敗 - 通用書籍相關操作失敗 */
  BOOK_OPERATION_FAILED: 'BOOK_OPERATION_FAILED',

  /** 書籍解析失敗 - 無法解析書籍檔案或資料格式 */
  BOOK_PARSE_FAILED: 'BOOK_PARSE_FAILED',

  /** 書籍格式不支援 - 書籍格式不受系統支援 */
  BOOK_FORMAT_UNSUPPORTED: 'BOOK_FORMAT_UNSUPPORTED',

  // ============================================================================
  // Readmoo 平台專用錯誤
  // ============================================================================

  /** Readmoo 登入失敗 - 無法登入 Readmoo 平台 */
  READMOO_LOGIN_FAILED: 'READMOO_LOGIN_FAILED',

  /** Readmoo API 呼叫失敗 - Readmoo API 請求失敗 */
  READMOO_API_CALL_FAILED: 'READMOO_API_CALL_FAILED',

  /** Readmoo 頁面載入失敗 - 無法載入 Readmoo 網頁 */
  READMOO_PAGE_LOAD_FAILED: 'READMOO_PAGE_LOAD_FAILED',

  /** Readmoo 資料提取失敗 - 從 Readmoo 提取資料失敗 */
  READMOO_DATA_EXTRACTION_FAILED: 'READMOO_DATA_EXTRACTION_FAILED',

  /** Readmoo 會話過期 - Readmoo 使用者會話已過期 */
  READMOO_SESSION_EXPIRED: 'READMOO_SESSION_EXPIRED',

  // ============================================================================
  // DOM 操作與頁面處理錯誤
  // ============================================================================

  /** DOM 元素找不到 - 無法在頁面中找到指定的 DOM 元素 */
  DOM_ELEMENT_NOT_FOUND: 'DOM_ELEMENT_NOT_FOUND',

  /** DOM 操作失敗 - DOM 元素操作過程失敗 */
  DOM_OPERATION_FAILED: 'DOM_OPERATION_FAILED',

  /** 頁面載入失敗 - 網頁載入過程失敗 */
  PAGE_LOAD_FAILED: 'PAGE_LOAD_FAILED',

  /** 頁面解析失敗 - 無法解析網頁內容結構 */
  PAGE_PARSE_FAILED: 'PAGE_PARSE_FAILED',

  /** 元素選取器無效 - CSS 選取器語法錯誤或無效 */
  ELEMENT_SELECTOR_INVALID: 'ELEMENT_SELECTOR_INVALID',

  // ============================================================================
  // 檔案處理錯誤
  // ============================================================================

  /** 檔案讀取失敗 - 無法讀取檔案內容 */
  FILE_READ_FAILED: 'FILE_READ_FAILED',

  /** 檔案寫入失敗 - 無法寫入檔案內容 */
  FILE_WRITE_FAILED: 'FILE_WRITE_FAILED',

  /** 檔案不存在 - 指定的檔案路徑不存在 */
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',

  /** 檔案格式錯誤 - 檔案格式不符合預期 */
  FILE_FORMAT_ERROR: 'FILE_FORMAT_ERROR',

  /** 檔案存取權限不足 - 缺乏檔案存取權限 */
  FILE_ACCESS_DENIED: 'FILE_ACCESS_DENIED',

  // ============================================================================
  // 批次處理錯誤
  // ============================================================================

  /** 批次操作失敗 - 批次處理過程完全失敗 */
  BATCH_OPERATION_FAILED: 'BATCH_OPERATION_FAILED',

  /** 批次部分失敗 - 批次處理過程部分項目失敗 */
  BATCH_PARTIAL_FAILURE: 'BATCH_PARTIAL_FAILURE',

  /** 重試操作失敗 - 重試機制執行後仍然失敗 */
  RETRY_OPERATION_FAILED: 'RETRY_OPERATION_FAILED',

  /** 批次處理逾時 - 批次操作執行時間超過限制 */
  BATCH_PROCESSING_TIMEOUT: 'BATCH_PROCESSING_TIMEOUT',

  // ============================================================================
  // Chrome Extension 專用錯誤
  // ============================================================================

  /** Chrome 擴充功能載入失敗 - 擴充功能初始化失敗 */
  CHROME_EXTENSION_LOAD_FAILED: 'CHROME_EXTENSION_LOAD_FAILED',

  /** Chrome 訊息傳遞失敗 - Chrome 擴充功能內部訊息傳遞失敗 */
  CHROME_MESSAGE_PASSING_FAILED: 'CHROME_MESSAGE_PASSING_FAILED',

  /** Chrome 內容腳本注入失敗 - 無法注入內容腳本 */
  CHROME_CONTENT_SCRIPT_INJECTION_FAILED: 'CHROME_CONTENT_SCRIPT_INJECTION_FAILED',

  /** Chrome 分頁存取失敗 - 無法存取 Chrome 分頁 */
  CHROME_TAB_ACCESS_FAILED: 'CHROME_TAB_ACCESS_FAILED',

  /** Chrome 權限不足 - Chrome 擴充功能權限不足 */
  CHROME_INSUFFICIENT_PERMISSIONS: 'CHROME_INSUFFICIENT_PERMISSIONS',

  // ============================================================================
  // JSON 與資料格式錯誤
  // ============================================================================

  /** JSON 解析失敗 - 無法解析 JSON 格式資料 */
  JSON_PARSE_FAILED: 'JSON_PARSE_FAILED',

  /** JSON 序列化失敗 - 無法將資料序列化為 JSON 格式 */
  JSON_STRINGIFY_FAILED: 'JSON_STRINGIFY_FAILED',

  /** 資料格式無效 - 資料格式不符合預期結構 */
  DATA_FORMAT_INVALID: 'DATA_FORMAT_INVALID',

  /** 資料類型錯誤 - 資料類型不符合預期 */
  DATA_TYPE_MISMATCH: 'DATA_TYPE_MISMATCH',

  // ============================================================================
  // 匯出與匯入錯誤
  // ============================================================================

  /** 匯出格式不支援 - 請求的匯出格式不受支援 */
  EXPORT_FORMAT_UNSUPPORTED: 'EXPORT_FORMAT_UNSUPPORTED',

  /** 匯出資料準備失敗 - 準備匯出資料過程失敗 */
  EXPORT_DATA_PREPARATION_FAILED: 'EXPORT_DATA_PREPARATION_FAILED',

  /** 匯入檔案格式錯誤 - 匯入檔案格式不正確 */
  IMPORT_FILE_FORMAT_ERROR: 'IMPORT_FILE_FORMAT_ERROR',

  /** 匯入資料驗證失敗 - 匯入資料未通過驗證 */
  IMPORT_DATA_VALIDATION_FAILED: 'IMPORT_DATA_VALIDATION_FAILED'
}

// 凍結物件以防止意外修改
Object.freeze(ErrorCodes)

// 匯出錯誤代碼常數
if (typeof module !== 'undefined' && module.exports) {
  // CommonJS 環境 (Node.js, Chrome Extension background)
  module.exports = { ErrorCodes }
} else if (typeof window !== 'undefined') {
  // 瀏覽器環境
  window.ErrorCodes = ErrorCodes
}