/**
 * 系統錯誤分類器
 * 負責將各種錯誤分類為5大類型，並判斷嚴重程度
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

const ERROR_TYPES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  DATA_ERROR: 'DATA_ERROR',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  DOM_ERROR: 'DOM_ERROR',
  PLATFORM_ERROR: 'PLATFORM_ERROR'
}

const SEVERITY_LEVELS = {
  MINOR: 'MINOR',
  MODERATE: 'MODERATE',
  SEVERE: 'SEVERE',
  CRITICAL: 'CRITICAL'
}

// 錯誤分類規則映射表
const ERROR_CLASSIFICATION_RULES = {
  // 網路錯誤模式
  NETWORK_PATTERNS: [
    { pattern: /network|timeout|connection|fetch failed/i, severity: 'HIGH' },
    { pattern: /api request failed|xhr error/i, severity: 'HIGH' },
    { pattern: /connection refused|unreachable/i, severity: 'HIGH' }
  ],

  // 資料錯誤模式
  DATA_PATTERNS: [
    { pattern: /json|parse|invalid format/i, severity: 'MODERATE' },
    { pattern: /validation|schema|required field/i, severity: 'MODERATE' },
    { pattern: /corruption|inconsistent/i, severity: 'MODERATE' }
  ],

  // 系統錯誤模式
  SYSTEM_PATTERNS: [
    { pattern: /memory|out of|resource/i, severity: 'HIGH' },
    { pattern: /permission|access denied/i, severity: 'HIGH' },
    { pattern: /quota|storage full/i, severity: 'HIGH' }
  ],

  // DOM錯誤模式
  DOM_PATTERNS: [
    { pattern: /element not found|selector/i, severity: 'MEDIUM' },
    { pattern: /dom|structure|document/i, severity: 'MEDIUM' },
    { pattern: /event|listener|binding/i, severity: 'MEDIUM' }
  ],

  // 平台錯誤模式
  PLATFORM_PATTERNS: [
    { pattern: /chrome|extension|manifest/i, severity: 'HIGH' },
    { pattern: /browser|compatibility|version/i, severity: 'HIGH' },
    { pattern: /api.*not.*support/i, severity: 'HIGH' }
  ]
}

/**
 * 錯誤分類主函數
 * @param {Error} error - 要分類的錯誤物件
 * @returns {Object} 分類結果
 */
function classifyError (error) {
  if (!error) {
    const errorObj = new Error('Error object is required for classification')
    errorObj.code = ErrorCodes.VALIDATION_ERROR
    errorObj.details = {
      dataType: 'object',
      category: 'ui'
    }
    throw errorObj
  }

  const errorMessage = error.message || error.toString()
  const errorStack = error.stack || ''

  // 逐一檢查錯誤類型模式
  for (const [typeKey, patterns] of Object.entries(ERROR_CLASSIFICATION_RULES)) {
    for (const rule of patterns) {
      if (rule.pattern.test(errorMessage) || rule.pattern.test(errorStack)) {
        return {
          category: mapTypeKeyToErrorType(typeKey),
          severity: rule.severity,
          originalError: error,
          timestamp: new Date().toISOString(),
          classification: 'automatic'
        }
      }
    }
  }

  // 預設分類為系統錯誤
  return {
    category: ERROR_TYPES.SYSTEM_ERROR,
    severity: SEVERITY_LEVELS.MODERATE,
    originalError: error,
    timestamp: new Date().toISOString(),
    classification: 'fallback'
  }
}

function mapTypeKeyToErrorType (typeKey) {
  const mapping = {
    NETWORK_PATTERNS: ERROR_TYPES.NETWORK_ERROR,
    DATA_PATTERNS: ERROR_TYPES.DATA_ERROR,
    SYSTEM_PATTERNS: ERROR_TYPES.SYSTEM_ERROR,
    DOM_PATTERNS: ERROR_TYPES.DOM_ERROR,
    PLATFORM_PATTERNS: ERROR_TYPES.PLATFORM_ERROR
  }
  return mapping[typeKey] || ERROR_TYPES.SYSTEM_ERROR
}

export { classifyError, ERROR_TYPES, SEVERITY_LEVELS }
