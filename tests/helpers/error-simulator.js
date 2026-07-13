/**
 * Error Simulator - 測試錯誤模擬工具
 * 提供各種錯誤情境的模擬功能
 *
 * 設計原則（1.5.0-W6-026）：
 * 模擬方法本身不拋出例外，而是記錄模擬錯誤狀態並正常 resolve。
 * 呼叫端（ChromeExtensionController mock 方法）依 testSuite/errorSimulator 狀態
 * 產生對應的錯誤回應，模擬「錯誤被優雅攔截」的行為契約。
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

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
    this.activeError = null
  }

  /**
   * 建立模擬錯誤物件（不拋出，僅回傳）
   */
  #createError (message, code, details = {}) {
    const error = new Error(message)
    error.code = code
    error.details = { category: 'testing', simulation: true, ...details }
    return error
  }

  /**
   * 記錄並設定當前作用中的模擬錯誤（非拋出式注入）
   */
  #registerError (message, code, details = {}) {
    const error = this.#createError(message, code, details)
    this.logError(error)
    this.activeError = error
    return { success: true, simulated: true, error }
  }

  /**
   * 模擬網路錯誤
   */
  simulateNetworkError () {
    return this.#registerError(this.errorTypes.NETWORK_ERROR, ErrorCodes.NETWORK_ERROR)
  }

  /**
   * 模擬記憶體錯誤
   */
  simulateMemoryError () {
    return this.#registerError(this.errorTypes.MEMORY_ERROR, ErrorCodes.MEMORY_ERROR)
  }

  /**
   * 模擬超時錯誤
   */
  simulateTimeoutError () {
    return this.#registerError(this.errorTypes.TIMEOUT_ERROR, ErrorCodes.TIMEOUT_ERROR)
  }

  /**
   * 模擬權限錯誤
   */
  simulatePermissionError () {
    return this.#registerError(this.errorTypes.PERMISSION_ERROR, ErrorCodes.PERMISSION_ERROR)
  }

  /**
   * 模擬儲存錯誤
   */
  simulateStorageError () {
    return this.#registerError(this.errorTypes.STORAGE_ERROR, ErrorCodes.STORAGE_ERROR)
  }

  /**
   * 創建模擬錯誤的 Promise（維持拒絕語意，供顯式測試 rejected path 使用）
   */
  createErrorPromise (errorType, delay = 0) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(this.#createError(errorType, ErrorCodes.ERROR_SIMULATION))
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
   * 清除目前作用中的模擬錯誤（優雅恢復，不拋出）
   */
  async clearError () {
    this.activeError = null
    return { success: true, cleared: true }
  }

  /**
   * 重置錯誤模擬器
   */
  async reset () {
    this.simulatedErrors = []
    this.activeError = null
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
    return this.#registerError('Network disconnected', ErrorCodes.NETWORK_DISCONNECTED)
  }

  /**
   * 恢復網路連線（對應 simulateNetworkDisconnection 的恢復動作）
   */
  async restoreNetworkConnection () {
    this.activeError = null
    return { success: true, restored: true }
  }

  /**
   * 恢復網路（對應 simulateNetworkError 的恢復動作）
   */
  async restoreNetwork () {
    this.activeError = null
    return { success: true, restored: true }
  }

  /**
   * 撤銷 Extension 權限
   */
  async revokeExtensionPermissions (permissions = []) {
    return this.#registerError('Extension permissions revoked', ErrorCodes.PERMISSION_ERROR, { permissions })
  }

  /**
   * 模擬權限被撤銷（多重錯誤情境使用）
   */
  async simulatePermissionRevocation () {
    return this.#registerError('Permission revoked', ErrorCodes.PERMISSION_ERROR)
  }

  /**
   * 恢復 Extension 權限
   */
  async restorePermissions () {
    this.activeError = null
    return { success: true, restored: true }
  }

  /**
   * 模擬擴展錯誤
   */
  async simulateExtensionError () {
    return this.#registerError('Extension runtime error', ErrorCodes.EXTENSION_RUNTIME_ERROR)
  }

  /**
   * 模擬資料損壞錯誤
   */
  async simulateDataCorruption () {
    return this.#registerError('Data corruption detected', ErrorCodes.DATA_CORRUPTION_DETECTED)
  }

  /**
   * 模擬損壞儲存資料（對應使用者指導測試情境）
   */
  async corruptStorageData () {
    return this.#registerError('Data corruption detected', ErrorCodes.DATA_CORRUPTION_DETECTED)
  }

  /**
   * 模擬系統過載錯誤
   */
  async simulateSystemOverload () {
    return this.#registerError('System overload', ErrorCodes.SYSTEM_OVERLOAD)
  }

  /**
   * 模擬認證失敗
   */
  async simulateAuthenticationFailure () {
    return this.#registerError('Authentication failed', ErrorCodes.AUTHENTICATION_FAILED)
  }

  /**
   * 模擬儲存損壞
   */
  async simulateStorageCorruption () {
    return this.#registerError('Storage corruption detected', ErrorCodes.STORAGE_CORRUPTION_DETECTED)
  }

  /**
   * 模擬網路緩慢
   */
  async simulateSlowNetwork (timeoutMs = 30000) {
    // 模擬網路延遲
    await new Promise(resolve => setTimeout(resolve, Math.min(timeoutMs / 10, 1000)))
    return this.#registerError(`Network timeout after ${timeoutMs}ms`, ErrorCodes.NETWORK_TIMEOUT, { timeoutMs })
  }

  /**
   * 模擬儲存配額超限
   */
  async simulateStorageQuotaExceeded () {
    return this.#registerError('Storage quota exceeded', ErrorCodes.STORAGE_QUOTA_EXCEEDED)
  }

  /**
   * 釋放儲存空間（對應 simulateStorageQuotaExceeded 的恢復動作）
   */
  async freeStorageSpace () {
    this.activeError = null
    return { success: true, freed: true }
  }

  /**
   * 模擬儲存配額錯誤 - 測試期望的方法名稱
   */
  async simulateStorageQuotaError () {
    return this.#registerError('Storage quota exceeded', ErrorCodes.STORAGE_QUOTA_EXCEEDED)
  }

  /**
   * 模擬間歇性網路錯誤
   */
  simulateIntermittentNetworkErrors (networkInterruptions) {
    if (!networkInterruptions || !Array.isArray(networkInterruptions)) {
      return this.#registerError('Network interruptions array is required', ErrorCodes.INVALID_ARGUMENT)
    }

    // 模擬間歇性網路中斷
    networkInterruptions.forEach((interruption, index) => {
      setTimeout(() => {
        const error = this.#createError(
          `Network interruption ${index + 1}: ${interruption.type}`,
          ErrorCodes.NETWORK_INTERRUPTION,
          { interruption }
        )
        this.logError(error)
      }, interruption.delay || index * 1000)
    })

    return { success: true, scheduled: networkInterruptions.length }
  }

  /**
   * 模擬系統中斷
   */
  async simulateSystemInterruption () {
    return this.#registerError('System interruption detected', ErrorCodes.SYSTEM_INTERRUPTION)
  }

  /**
   * 清除系統中斷（斷點續傳恢復動作）
   */
  async clearInterruption () {
    this.activeError = null
    return { success: true, cleared: true }
  }

  /**
   * 模擬資料解析錯誤
   */
  async simulateDataParsingError () {
    return this.#registerError('Data parsing failed', ErrorCodes.DATA_PARSING_FAILED)
  }

  /**
   * 模擬內容腳本錯誤
   */
  async simulateContentScriptError (errorType = 'PARSING_ERROR') {
    return this.#registerError(`Content script error: ${errorType}`, ErrorCodes.CONTENT_SCRIPT_ERROR, { errorType })
  }
}

module.exports = ErrorSimulator
