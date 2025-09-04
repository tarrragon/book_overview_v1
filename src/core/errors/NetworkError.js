/**
 * 網路錯誤類別
 * 
 * 專用錯誤類別處理網路相關失敗，包括 HTTP 錯誤、超時、連線失敗等
 * 遵循 Linux 專家建議的簡化設計原則
 */

// 條件性引入，支援瀏覽器和 Node.js 環境
let StandardError
if (typeof require !== 'undefined') {
  try {
    StandardError = require('./StandardError').StandardError
  } catch (e) {
    // 瀏覽器環境或引入失敗時，假設 StandardError 已全域可用
  }
}

class NetworkError extends StandardError {
  /**
   * 建立網路錯誤
   * @param {string} endpoint - 請求端點或 URL
   * @param {number|string} statusCode - HTTP 狀態碼或錯誤類型
   * @param {Object} options - 額外選項
   */
  constructor(endpoint, statusCode, options = {}) {
    // 處理不同類型的狀態碼
    let statusInfo = ''
    if (typeof statusCode === 'number') {
      statusInfo = `HTTP ${statusCode}`
      
      // 常見 HTTP 狀態碼的説明
      const statusMessages = {
        400: 'Bad Request',
        401: 'Unauthorized', 
        403: 'Forbidden',
        404: 'Not Found',
        408: 'Request Timeout',
        429: 'Too Many Requests',
        500: 'Internal Server Error',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
        504: 'Gateway Timeout'
      }
      
      if (statusMessages[statusCode]) {
        statusInfo += ` (${statusMessages[statusCode]})`
      }
    } else {
      statusInfo = statusCode || 'Unknown Error'
    }
    
    const message = `網路請求失敗: ${endpoint} - ${statusInfo}`
    
    super('NETWORK_ERROR', message, { 
      endpoint,
      statusCode,
      method: options.method || 'GET',
      timeout: options.timeout,
      retryCount: options.retryCount || 0,
      category: 'network'
    })
  }
  
  /**
   * 便利的靜態建立方法
   * @param {string} endpoint - 端點
   * @param {number|string} statusCode - 狀態碼
   * @param {Object} options - 選項
   * @returns {NetworkError} 錯誤實例
   */
  static create(endpoint, statusCode, options = {}) {
    return new NetworkError(endpoint, statusCode, options)
  }
  
  /**
   * 為超時錯誤建立特殊方法
   * @param {string} endpoint - 端點
   * @param {number} timeout - 超時時間（毫秒）
   * @returns {NetworkError} 錯誤實例
   */
  static timeout(endpoint, timeout = 5000) {
    return new NetworkError(endpoint, 'TIMEOUT', { timeout })
  }
  
  /**
   * 為連線失敗建立特殊方法
   * @param {string} endpoint - 端點
   * @param {string} reason - 失敗原因
   * @returns {NetworkError} 錯誤實例
   */
  static connectionFailed(endpoint, reason = 'Connection refused') {
    return new NetworkError(endpoint, `CONNECTION_FAILED: ${reason}`)
  }
  
  /**
   * 為 API 限制建立特殊方法
   * @param {string} endpoint - 端點
   * @param {number} retryAfter - 建議重試時間（秒）
   * @returns {NetworkError} 錯誤實例
   */
  static rateLimited(endpoint, retryAfter) {
    const error = new NetworkError(endpoint, 429, { retryAfter })
    if (retryAfter) {
      error.details.retryAfter = retryAfter
      error.message += ` (請等待 ${retryAfter} 秒後重試)`
    }
    return error
  }
}

// 匯出 NetworkError 類別
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NetworkError }
} else if (typeof window !== 'undefined') {
  window.NetworkError = NetworkError
}