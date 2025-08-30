/**
 * Error Simulator - 測試錯誤模擬工具
 * 提供各種錯誤情境的模擬功能
 */

class ErrorSimulator {
  constructor() {
    this.errorTypes = {
      NETWORK_ERROR: 'Network Error',
      MEMORY_ERROR: 'Memory Error', 
      TIMEOUT_ERROR: 'Timeout Error',
      PERMISSION_ERROR: 'Permission Error',
      STORAGE_ERROR: 'Storage Error'
    }
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
}

module.exports = ErrorSimulator