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
}

module.exports = ErrorSimulator
