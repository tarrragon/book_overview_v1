/**
 * 使用者友善訊息產生器
 * 將技術錯誤轉換為使用者可理解的訊息
 */

// 錯誤訊息模板 (繁體中文)
const ERROR_MESSAGE_TEMPLATES = {
  NETWORK_ERROR: {
    timeout: '網路連接超時，請檢查網路連線後重試',
    connection_failed: '無法連接到伺服器，請確認網路連線正常',
    api_failed: 'API 請求失敗，請稍後重試或聯絡技術支援',
    default: '網路連線發生問題，請檢查網路設定並重試'
  },

  DATA_ERROR: {
    json_parse: 'JSON 格式錯誤，請檢查資料格式是否正確',
    validation: '資料驗證失敗，請確認輸入資料符合要求',
    missing_field: '缺少必要資料欄位，請補完資訊後重試',
    corruption: '資料已損壞，系統將嘗試修復',
    default: '資料處理發生錯誤，請檢查資料格式'
  },

  SYSTEM_ERROR: {
    memory: '系統記憶體不足，請關閉其他應用程式後重試',
    permission: '權限被拒絕，請檢查應用程式權限設定',
    storage: '儲存空間不足，請清理磁碟空間後重試',
    quota: '超過儲存配額限制，請清理資料或聯絡管理員',
    default: '系統發生錯誤，請重新啟動應用程式'
  },

  DOM_ERROR: {
    element_not_found: '頁面元素載入異常，請重新整理頁面',
    structure_changed: '頁面結構已變更，系統將嘗試適應',
    event_binding: '頁面互動功能異常，請重新整理頁面',
    default: '頁面顯示發生問題，請重新整理後重試'
  },

  PLATFORM_ERROR: {
    chrome_api: 'Chrome 擴展功能異常，請重新啟動瀏覽器',
    compatibility: '瀏覽器版本不相容，請更新至最新版本',
    manifest: '擴展設定檔異常，請重新安裝擴展',
    api_not_supported: '您的瀏覽器版本不支援此功能，請更新瀏覽器',
    default: '平台相容性問題，請檢查瀏覽器版本'
  }
}

// 錯誤關鍵字映射
const ERROR_KEYWORD_MAPPING = {
  // 網路錯誤關鍵字
  'network timeout': 'timeout',
  connection: 'connection_failed',
  'api request failed': 'api_failed',
  'fetch failed': 'connection_failed',

  // 資料錯誤關鍵字
  'invalid json': 'json_parse',
  parse: 'json_parse',
  validation: 'validation',
  'required field': 'missing_field',
  corruption: 'corruption',

  // 系統錯誤關鍵字
  'out of memory': 'memory',
  'permission denied': 'permission',
  'storage full': 'storage',
  quota: 'quota',

  // DOM錯誤關鍵字
  'element not found': 'element_not_found',
  'dom structure': 'structure_changed',
  event: 'event_binding',

  // 平台錯誤關鍵字
  chrome: 'chrome_api',
  browser: 'compatibility',
  manifest: 'manifest',
  'not supported': 'api_not_supported'
}

/**
 * 產生使用者友善錯誤訊息
 * @param {Error} error - 錯誤物件
 * @param {string} locale - 語言設定 (目前僅支援 'zh-TW')
 * @param {string} errorCategory - 錯誤分類
 * @returns {string} 使用者友善訊息
 */
function getUserFriendlyMessage (error, locale = 'zh-TW', errorCategory = null) {
  if (!error) {
    return '發生未知錯誤，請稍後重試'
  }

  // 目前僅支援繁體中文
  if (locale !== 'zh-TW') {
    // 靜默降級到繁體中文
  }

  const errorMessage = (error.message || error.toString()).toLowerCase()

  // 如果沒有提供錯誤分類，嘗試從錯誤訊息推斷
  if (!errorCategory) {
    errorCategory = inferErrorCategory(errorMessage)
  }

  // 尋找最匹配的訊息模板
  const messageKey = findBestMessageKey(errorMessage)
  const templates = ERROR_MESSAGE_TEMPLATES[errorCategory] || ERROR_MESSAGE_TEMPLATES.SYSTEM_ERROR

  return templates[messageKey] || templates.default || '發生未知錯誤，請稍後重試'
}

/**
 * 從錯誤訊息推斷錯誤分類
 * @param {string} errorMessage - 錯誤訊息
 * @returns {string} 推斷的錯誤分類
 */
function inferErrorCategory (errorMessage) {
  if (/network|timeout|connection|fetch|api/i.test(errorMessage)) {
    return 'NETWORK_ERROR'
  }

  if (/json|parse|validation|data|format/i.test(errorMessage)) {
    return 'DATA_ERROR'
  }

  if (/memory|permission|storage|quota|resource/i.test(errorMessage)) {
    return 'SYSTEM_ERROR'
  }

  if (/element|dom|document|selector/i.test(errorMessage)) {
    return 'DOM_ERROR'
  }

  if (/chrome|browser|extension|manifest|support/i.test(errorMessage)) {
    return 'PLATFORM_ERROR'
  }

  return 'SYSTEM_ERROR' // 預設分類
}

/**
 * 尋找最匹配的訊息鍵值
 * @param {string} errorMessage - 錯誤訊息
 * @returns {string} 訊息鍵值
 */
function findBestMessageKey (errorMessage) {
  for (const [keyword, messageKey] of Object.entries(ERROR_KEYWORD_MAPPING)) {
    if (errorMessage.includes(keyword.toLowerCase())) {
      return messageKey
    }
  }
  return 'default'
}

/**
 * 產生包含重試建議的完整訊息
 * @param {Error} error - 錯誤物件
 * @param {Object} recoveryPlan - 恢復計劃
 * @param {string} locale - 語言設定
 * @returns {Object} 完整的使用者訊息
 */
function getCompleteUserMessage (error, recoveryPlan, locale = 'zh-TW') {
  const baseMessage = getUserFriendlyMessage(error, locale)

  let actionGuidance = ''
  if (recoveryPlan) {
    if (recoveryPlan.canRetry) {
      actionGuidance = '系統將自動重試，或您可以手動重試'
    } else if (recoveryPlan.requiresUserAction) {
      actionGuidance = getActionGuidanceMessage(recoveryPlan.actionRequired)
    } else if (recoveryPlan.fallbackAvailable) {
      actionGuidance = '系統將使用備用方案處理'
    }
  }

  return {
    message: baseMessage,
    actionGuidance,
    canRetry: recoveryPlan?.canRetry || false,
    requiresUserAction: recoveryPlan?.requiresUserAction || false,
    severity: inferSeverityFromError(error)
  }
}

/**
 * 取得動作指引訊息
 * @param {string} actionRequired - 需要的動作
 * @returns {string} 動作指引訊息
 */
function getActionGuidanceMessage (actionRequired) {
  const actionMessages = {
    grant_permission: '請授予應用程式必要的權限',
    free_resources: '請關閉其他應用程式釋放系統資源',
    check_network: '請檢查網路連線設定',
    update_browser: '請更新瀏覽器至最新版本',
    clear_storage: '請清理瀏覽器儲存空間',
    restart_extension: '請重新啟動瀏覽器擴展'
  }

  return actionMessages[actionRequired] || '請聯絡技術支援'
}

/**
 * 從錯誤推斷嚴重程度
 * @param {Error} error - 錯誤物件
 * @returns {string} 嚴重程度
 */
function inferSeverityFromError (error) {
  const message = (error.message || '').toLowerCase()

  if (/critical|fatal|corruption/i.test(message)) {
    return 'high'
  }

  if (/warning|minor|temporary/i.test(message)) {
    return 'low'
  }

  return 'medium'
}

export {
  getUserFriendlyMessage,
  getCompleteUserMessage,
  ERROR_MESSAGE_TEMPLATES
}
