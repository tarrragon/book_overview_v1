/**
 * Error Simulator - 測試錯誤模擬工具
 * 提供各種錯誤情境的模擬功能
 */

class ErrorSimulator {
  constructor (testSuite) {
    this.testSuite = testSuite
    this.errorTypes = {
      NETWORK_ERROR: 'Network Error',
      MEMORY_ERROR: 'Memory Error',
      TIMEOUT_ERROR: 'Timeout Error',
      PERMISSION_ERROR: 'Permission Error',
      STORAGE_ERROR: 'Storage Error'
    }
    this.simulatedErrors = []
  }

  /**
   * 模擬網路錯誤
   */
  simulateNetworkError () {
    throw new Error(this.errorTypes.NETWORK_ERROR)
  }

  /**
   * 模擬記憶體錯誤
   */
  simulateMemoryError () {
    throw new Error(this.errorTypes.MEMORY_ERROR)
  }

  /**
   * 模擬超時錯誤
   */
  simulateTimeoutError () {
    throw new Error(this.errorTypes.TIMEOUT_ERROR)
  }

  /**
   * 模擬權限錯誤
   */
  simulatePermissionError () {
    throw new Error(this.errorTypes.PERMISSION_ERROR)
  }

  /**
   * 模擬儲存錯誤
   */
  simulateStorageError () {
    throw new Error(this.errorTypes.STORAGE_ERROR)
  }

  /**
   * 創建模擬錯誤的 Promise
   */
  createErrorPromise (errorType, delay = 0) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error(errorType))
      }, delay)
    })
  }

  /**
   * 檢測錯誤類型
   */
  detectErrorType (error) {
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'NETWORK_ERROR'
    }
    if (error.message.includes('memory') || error.message.includes('heap')) {
      return 'MEMORY_ERROR'
    }
    if (error.message.includes('timeout')) {
      return 'TIMEOUT_ERROR'
    }
    if (error.message.includes('permission')) {
      return 'PERMISSION_ERROR'
    }
    if (error.message.includes('storage') || error.message.includes('quota')) {
      return 'STORAGE_ERROR'
    }
    return 'UNKNOWN_ERROR'
  }

  /**
   * 執行錯誤檢測和分類
   */
  async detectAndClassifyErrors () {
    const detectedErrors = []

    // 模擬檢測各種錯誤類型
    const errorTypes = [
      { type: 'NETWORK_ERROR', probability: 0.3, severity: 'high' },
      { type: 'MEMORY_ERROR', probability: 0.1, severity: 'critical' },
      { type: 'TIMEOUT_ERROR', probability: 0.2, severity: 'medium' },
      { type: 'PERMISSION_ERROR', probability: 0.15, severity: 'high' },
      { type: 'STORAGE_ERROR', probability: 0.1, severity: 'medium' }
    ]

    for (const errorType of errorTypes) {
      if (Math.random() < errorType.probability) {
        detectedErrors.push({
          type: errorType.type,
          severity: errorType.severity,
          message: this.getErrorMessage(errorType.type),
          detectedAt: new Date().toISOString(),
          canRecover: this.isRecoverable(errorType.type)
        })
      }
    }

    return {
      success: true,
      errorCount: detectedErrors.length,
      errors: detectedErrors,
      classification: this.classifyErrors(detectedErrors)
    }
  }

  /**
   * 提供錯誤診斷資訊
   */
  async provideDiagnosticInfo (errorType) {
    const diagnostics = {
      NETWORK_ERROR: {
        cause: '網路連線問題',
        impact: '無法進行資料同步',
        solutions: ['檢查網路連線', '重試操作', '離線模式'],
        recoverable: true
      },
      MEMORY_ERROR: {
        cause: '記憶體不足',
        impact: '操作可能失敗',
        solutions: ['關閉其他程式', '重啟瀏覽器', '減少處理資料量'],
        recoverable: false
      },
      TIMEOUT_ERROR: {
        cause: '操作逾時',
        impact: '請求未完成',
        solutions: ['重試操作', '增加逾時時間', '分批處理'],
        recoverable: true
      },
      PERMISSION_ERROR: {
        cause: '權限不足',
        impact: '無法存取資源',
        solutions: ['重新授權', '檢查權限設定', '聯絡管理員'],
        recoverable: true
      },
      STORAGE_ERROR: {
        cause: '儲存空間問題',
        impact: '無法儲存資料',
        solutions: ['清理儲存空間', '刪除舊資料', '使用外部儲存'],
        recoverable: true
      }
    }

    return {
      success: true,
      errorType,
      diagnostic: diagnostics[errorType] || {
        cause: '未知錯誤',
        impact: '影響不明',
        solutions: ['重試操作', '聯絡技術支援'],
        recoverable: false
      }
    }
  }

  /**
   * 取得錯誤訊息
   */
  getErrorMessage (errorType) {
    const messages = {
      NETWORK_ERROR: '網路連線發生問題',
      MEMORY_ERROR: '記憶體不足，無法繼續操作',
      TIMEOUT_ERROR: '操作逾時，請稍後再試',
      PERMISSION_ERROR: '權限不足，無法執行操作',
      STORAGE_ERROR: '儲存空間不足或損壞'
    }
    return messages[errorType] || '發生未知錯誤'
  }

  /**
   * 判斷錯誤是否可恢復
   */
  isRecoverable (errorType) {
    const recoverableErrors = ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'PERMISSION_ERROR', 'STORAGE_ERROR']
    return recoverableErrors.includes(errorType)
  }

  /**
   * 分類錯誤
   */
  classifyErrors (errors) {
    return {
      critical: errors.filter(e => e.severity === 'critical').length,
      high: errors.filter(e => e.severity === 'high').length,
      medium: errors.filter(e => e.severity === 'medium').length,
      recoverable: errors.filter(e => e.canRecover).length,
      nonRecoverable: errors.filter(e => !e.canRecover).length
    }
  }

  /**
   * 記錄模擬錯誤
   */
  logError (error) {
    this.simulatedErrors.push({
      type: this.detectErrorType(error),
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * 重置錯誤模擬器
   */
  async reset () {
    this.simulatedErrors = []
    if (this.testSuite && this.testSuite.reset) {
      await this.testSuite.reset()
    }
  }

  /**
   * 清理錯誤模擬器
   */
  async cleanup () {
    await this.reset()
    if (this.testSuite && this.testSuite.cleanup) {
      await this.testSuite.cleanup()
    }
  }

  /**
   * 模擬網路中斷
   */
  async simulateNetworkDisconnection () {
    // 模擬網路中斷狀況
    const error = new Error('Network disconnected')
    this.logError(error)
    throw error
  }

  /**
   * 模擬擴展錯誤
   */
  async simulateExtensionError () {
    // 模擬擴展運行錯誤
    const error = new Error('Extension runtime error')
    this.logError(error)
    throw error
  }

  /**
   * 模擬資料損壞錯誤
   */
  async simulateDataCorruption () {
    const error = new Error('Data corruption detected')
    this.logError(error)
    throw error
  }

  /**
   * 模擬系統過載錯誤
   */
  async simulateSystemOverload () {
    const error = new Error('System overload')
    this.logError(error)
    throw error
  }

  /**
   * 模擬認證失敗
   */
  async simulateAuthenticationFailure () {
    const error = new Error('Authentication failed')
    this.logError(error)
    throw error
  }

  /**
   * 模擬儲存損壞
   */
  async simulateStorageCorruption () {
    const error = new Error('Storage corruption detected')
    this.logError(error)
    throw error
  }

  /**
   * 模擬網路緩慢
   */
  async simulateSlowNetwork (timeoutMs = 30000) {
    // 模擬網路延遲
    await new Promise(resolve => setTimeout(resolve, Math.min(timeoutMs / 10, 1000)))
    const error = new Error(`Network timeout after ${timeoutMs}ms`)
    this.logError(error)
    throw error
  }

  /**
   * 模擬儲存配額超限
   */
  async simulateStorageQuotaExceeded () {
    const error = new Error('Storage quota exceeded')
    this.logError(error)
    throw error
  }

  /**
   * 模擬儲存配額錯誤 - 測試期望的方法名稱
   */
  async simulateStorageQuotaError () {
    const error = new Error('Storage quota exceeded')
    this.logError(error)
    throw error
  }
}

module.exports = ErrorSimulator
