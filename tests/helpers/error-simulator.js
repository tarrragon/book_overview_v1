/**
 * Error Simulator - 測試錯誤模擬工具
 * 提供各種錯誤情境的模擬功能
 */

class ErrorSimulator {
  constructor(testSuite) {
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
  simulateNetworkError() {
    throw new Error(this.errorTypes.NETWORK_ERROR)
  }

  /**
   * 模擬記憶體錯誤
   */
  simulateMemoryError() {
    throw new Error(this.errorTypes.MEMORY_ERROR)
  }

  /**
   * 模擬超時錯誤
   */
  simulateTimeoutError() {
    throw new Error(this.errorTypes.TIMEOUT_ERROR)
  }

  /**
   * 模擬權限錯誤
   */
  simulatePermissionError() {
    throw new Error(this.errorTypes.PERMISSION_ERROR)
  }

  /**
   * 模擬儲存錯誤
   */
  simulateStorageError() {
    throw new Error(this.errorTypes.STORAGE_ERROR)
  }

  /**
   * 創建模擬錯誤的 Promise
   */
  createErrorPromise(errorType, delay = 0) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error(errorType))
      }, delay)
    })
  }

  /**
   * 檢測錯誤類型
   */
  detectErrorType(error) {
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
  logError(error) {
    this.simulatedErrors.push({
      type: this.detectErrorType(error),
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * 重置錯誤模擬器
   */
  async reset() {
    this.simulatedErrors = []
    if (this.testSuite && this.testSuite.reset) {
      await this.testSuite.reset()
    }
  }

  /**
   * 清理錯誤模擬器
   */
  async cleanup() {
    await this.reset()
    if (this.testSuite && this.testSuite.cleanup) {
      await this.testSuite.cleanup()
    }
  }
}

module.exports = ErrorSimulator