/**
 * 系統錯誤處理器 - 整合所有錯誤處理功能
 * 為測試套件提供統一的錯誤處理接口
 */

import { classifyError as classifyErrorInternal } from './error-classifier.js'
import { createErrorRecovery as createErrorRecoveryInternal, retryOperation as retryOperationInternal } from './error-recovery-coordinator.js'
import { getUserFriendlyMessage as getUserFriendlyMessageInternal } from './user-message-generator.js'

/**
 * 錯誤分類函數 - 測試接口
 * @param {Error} error - 要分類的錯誤
 * @returns {Object} 分類結果
 */
function classifyError (error) {
  return classifyErrorInternal(error)
}

/**
 * 建立錯誤恢復策略 - 測試接口
 * @param {Error} error - 錯誤物件
 * @returns {Object} 恢復策略
 */
function createErrorRecovery (error) {
  // 先分類錯誤，再建立恢復策略
  const classification = classifyErrorInternal(error)
  return createErrorRecoveryInternal(error, classification.category)
}

/**
 * 取得使用者友善訊息 - 測試接口
 * @param {Error} error - 錯誤物件
 * @param {string} locale - 語言設定
 * @returns {string} 友善訊息
 */
function getUserFriendlyMessage (error, locale = 'zh-TW') {
  const classification = classifyErrorInternal(error)
  return getUserFriendlyMessageInternal(error, locale, classification.category)
}

/**
 * 書籍資料驗證
 * @param {Object} book - 書籍資料物件
 * @returns {Object} 驗證結果
 */
function validateBookData (book) {
  if (!book || typeof book !== 'object') {
    return {
      isValid: false,
      errors: ['invalid_book_object']
    }
  }

  const errors = []

  // 檢查必要欄位
  if (!book.id) {
    errors.push('missing_id')
  }

  if (!book.title || book.title.trim() === '') {
    errors.push('missing_title')
  }

  if (!book.cover) {
    errors.push('missing_cover')
  }

  // //todo: 新增更詳細的資料驗證規則
  // - 檢查書籍格式
  // - 驗證 URL 格式
  // - 檢查資料類型

  return {
    isValid: errors.length === 0,
    errors,
    validationTime: new Date().toISOString()
  }
}

/**
 * 修復損壞的書籍資料
 * @param {Object} book - 損壞的書籍資料
 * @returns {Object} 修復後的書籍資料
 */
function repairBookData (book) {
  if (!book || typeof book !== 'object') {
    return {
      id: generateBookId(),
      title: '未知書籍',
      cover: getDefaultCover(),
      repaired: true,
      repairActions: ['created_new_object']
    }
  }

  const repairedBook = { ...book }
  const repairActions = []

  // 修復缺失的 ID
  if (!repairedBook.id) {
    repairedBook.id = generateBookId()
    repairActions.push('generated_id')
  }

  // 修復空白或缺失的標題
  if (!repairedBook.title || repairedBook.title.trim() === '') {
    repairedBook.title = '未知書籍'
    repairActions.push('fixed_title')
  }

  // 修復缺失的封面
  if (!repairedBook.cover) {
    repairedBook.cover = getDefaultCover()
    repairActions.push('added_default_cover')
  }

  // //todo: 實作更智慧的資料修復
  // - 從標題推斷作者
  // - 從內容推斷分類
  // - 修復格式不正確的資料

  repairedBook.repaired = true
  repairedBook.repairActions = repairActions
  repairedBook.repairTime = new Date().toISOString()

  return repairedBook
}

/**
 * 帶降級機制的資料取得
 * @param {Object} primaryService - 主要服務狀態
 * @returns {Object} 資料取得結果
 */
function getDataWithFallback (primaryService) {
  if (!primaryService || typeof primaryService !== 'object') {
    return {
      success: false,
      source: 'none',
      error: 'Invalid primary service configuration'
    }
  }

  // 檢查主要服務是否可用
  if (primaryService.available === false) {
    // 使用降級策略
    return {
      success: true,
      source: 'fallback',
      data: getFallbackData(),
      fallbackReason: primaryService.reason || 'Primary service unavailable'
    }
  }

  // //todo: 實作多層次降級策略
  // - Cache → Local Storage → Default Data
  // - 不同資料來源的優先級
  // - 資料新鮮度檢查

  return {
    success: true,
    source: 'primary',
    data: 'Primary service data'
  }
}

/**
 * 平台支援檢查
 * @returns {Object} 平台支援狀況
 */
function checkPlatformSupport () {
  const support = {
    chromeApiAvailable: false,
    version: null,
    features: {
      storage: false,
      tabs: false,
      runtime: false
    },
    fallbackStrategy: null
  }

  // 檢查 Chrome API 可用性
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    support.chromeApiAvailable = true
    support.features.runtime = true

    // 檢查各項 API
    if (chrome.storage) {
      support.features.storage = true
    }

    if (chrome.tabs) {
      support.features.tabs = true
    }

    // //todo: 檢查更多 Chrome API
    // - activeTab 權限
    // - host permissions
    // - manifest version
  } else {
    // 設定降級策略
    support.fallbackStrategy = 'local_storage_only'
  }

  // 檢查瀏覽器版本 (簡化版)
  if (navigator && navigator.userAgent) {
    const chromeMatch = navigator.userAgent.match(/Chrome\/(\d+)/)
    if (chromeMatch) {
      support.version = parseInt(chromeMatch[1])
    }
  }

  return support
}

/**
 * 跨模組錯誤傳播
 * @param {Error} error - 錯誤物件
 * @param {string} source - 來源模組
 * @param {string} destination - 目標模組
 * @returns {Object} 傳播結果
 */
function propagateError (error, source, destination) {
  if (!error || !source || !destination) {
    throw new Error('Error, source, and destination are required for error propagation')
  }

  const propagationData = {
    source,
    destination,
    error: {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    },
    propagationId: generatePropagationId(),
    classification: classifyErrorInternal(error)
  }

  // //todo: 實作實際的事件傳播機制
  // - 整合現有 EventBus 系統
  // - 錯誤事件的發佈和訂閱
  // - 防止錯誤循環傳播

  return propagationData
}

/**
 * 處理級聯錯誤
 * @param {Array} errors - 錯誤陣列
 * @returns {Object} 處理結果
 */
function handleCascadingErrors (errors) {
  if (!Array.isArray(errors) || errors.length === 0) {
    throw new Error('Error array is required for cascading error handling')
  }

  // 分類所有錯誤
  const classifications = errors.map(error => classifyErrorInternal(error))

  // 判斷是否為級聯錯誤
  const errorTypes = [...new Set(classifications.map(c => c.category))]
  const isCascading = errorTypes.length > 1 || errors.length > 2

  let strategy = 'graceful_degradation'

  // 根據錯誤嚴重程度決定策略
  const highSeverityCount = classifications.filter(c => c.severity === 'HIGH').length
  if (highSeverityCount >= errors.length / 2) {
    strategy = 'emergency_shutdown'
  }

  // //todo: 實作更智慧的級聯錯誤處理
  // - 錯誤依賴關係分析
  // - 自動恢復順序規劃
  // - 系統健康狀態監控

  return {
    strategy,
    cascading: isCascading,
    errorCount: errors.length,
    errorTypes,
    recommendations: generateRecoveryRecommendations(classifications)
  }
}

/**
 * 建立錯誤 UI 元件
 * @param {Error} error - 錯誤物件
 * @returns {Object} UI 元件配置
 */
function createErrorUI (error) {
  if (!error) {
    throw new Error('Error object is required for UI creation')
  }

  const classification = classifyErrorInternal(error)
  const recovery = createErrorRecoveryInternal(error, classification.category)
  const message = getUserFriendlyMessageInternal(error, 'zh-TW', classification.category)

  const ui = {
    message,
    severity: classification.severity,
    retryButton: recovery.canRetry,
    guidance: recovery.canRetry ? '點擊重試按鈕重新執行操作' : '請聯絡技術支援',
    icon: getErrorIcon(classification.category),
    color: getErrorColor(classification.severity)
  }

  // //todo: 實作更豐富的 UI 元件
  // - 動畫效果
  // - 進度指示器
  // - 多語言支援
  // - 無障礙功能

  return ui
}

/**
 * 重試操作 - 測試接口
 * @param {Function} operation - 要重試的操作
 * @param {Object} options - 重試選項
 * @returns {Promise} 重試結果
 */
async function retryOperation (operation, options = {}) {
  return retryOperationInternal(operation, options)
}

// 輔助函數
function generateBookId () {
  return `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function getDefaultCover () {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7mnKrlpZblsYE8L3RleHQ+PC9zdmc+'
}

function getFallbackData () {
  return {
    books: [],
    message: '使用離線資料',
    lastUpdate: new Date().toISOString()
  }
}

function generatePropagationId () {
  return `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function generateRecoveryRecommendations (classifications) {
  const recommendations = []

  const hasNetworkError = classifications.some(c => c.category === 'NETWORK_ERROR')
  const hasSystemError = classifications.some(c => c.category === 'SYSTEM_ERROR')

  if (hasNetworkError) {
    recommendations.push('檢查網路連線')
  }

  if (hasSystemError) {
    recommendations.push('重新啟動應用程式')
  }

  return recommendations
}

function getErrorIcon (category) {
  const icons = {
    NETWORK_ERROR: '🌐',
    DATA_ERROR: '📊',
    SYSTEM_ERROR: '⚙️',
    DOM_ERROR: '🔧',
    PLATFORM_ERROR: '🚀'
  }
  return icons[category] || '⚠️'
}

function getErrorColor (severity) {
  const colors = {
    HIGH: '#ff4757',
    MEDIUM: '#ffa502',
    LOW: '#2ed573'
  }
  return colors[severity] || '#747d8c'
}

export {
  classifyError,
  createErrorRecovery,
  getUserFriendlyMessage,
  validateBookData,
  repairBookData,
  getDataWithFallback,
  checkPlatformSupport,
  propagateError,
  handleCascadingErrors,
  createErrorUI,
  retryOperation
}
