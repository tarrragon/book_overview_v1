/**
 * Chrome Storage API 驗證器
 * 用於測試 Chrome Storage API 的正確性和一致性
 */

class StorageAPIValidator {
  constructor (testSuite, options = {}) {
    // 如果第一個參數是 options 物件而不是 testSuite，進行相容性處理
    if (testSuite && typeof testSuite === 'object' && !testSuite.setup) {
      // 第一個參數實際上是 options
      options = testSuite
      testSuite = null
    }
    
    this.testSuite = testSuite
    this.options = {
      enableQuotaChecking: options.enableQuotaChecking !== false,
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 5000,
      enableLogging: options.enableLogging || false,
      ...options
    }

    this.stats = {
      validationCount: 0,
      errorCount: 0,
      warningCount: 0
    }
  }

  /**
   * 驗證儲存空間配額
   */
  async validateQuota (expectedUsage = null) {
    try {
      this.stats.validationCount++

      // 模擬配額驗證
      const mockUsage = 1024 * 1024 // 1MB
      const mockQuota = 10 * 1024 * 1024 // 10MB
      const usagePercentage = (mockUsage / mockQuota) * 100

      return {
        valid: usagePercentage < 80,
        usage: mockUsage,
        quota: mockQuota,
        usagePercentage,
        message: `Storage usage: ${usagePercentage.toFixed(2)}%`
      }
    } catch (error) {
      this.stats.errorCount++
      return {
        valid: false,
        error: error.message,
        message: 'Failed to validate storage quota'
      }
    }
  }

  /**
   * 驗證資料完整性
   */
  async validateDataIntegrity (storageData) {
    try {
      this.stats.validationCount++

      if (!storageData || typeof storageData !== 'object') {
        this.stats.errorCount++
        return {
          valid: false,
          message: 'Invalid storage data format'
        }
      }

      const validations = []

      // 基本結構驗證
      if (storageData.books && Array.isArray(storageData.books)) {
        validations.push({
          test: 'books_array',
          valid: true,
          message: `Found ${storageData.books.length} books`
        })

        // 書籍資料結構驗證
        const invalidBooks = storageData.books.filter(book => !book.id || !book.title)
        validations.push({
          test: 'books_structure',
          valid: invalidBooks.length === 0,
          message: invalidBooks.length > 0
            ? `Found ${invalidBooks.length} books with invalid structure`
            : 'All books have valid structure'
        })
      }

      const allValid = validations.every(v => v.valid)
      if (!allValid) {
        this.stats.errorCount++
      }

      return {
        valid: allValid,
        validations,
        message: allValid ? 'Data integrity validated' : 'Data integrity issues found'
      }
    } catch (error) {
      this.stats.errorCount++
      return {
        valid: false,
        error: error.message,
        message: 'Failed to validate data integrity'
      }
    }
  }

  /**
   * 驗證效能指標
   */
  async validatePerformance (operation, expectedDuration = null) {
    try {
      this.stats.validationCount++

      const startTime = Date.now()
      await operation()
      const duration = Date.now() - startTime

      const result = {
        valid: true,
        duration,
        message: `Operation completed in ${duration}ms`
      }

      if (expectedDuration && duration > expectedDuration) {
        result.valid = false
        result.message += ` (Expected: <${expectedDuration}ms)`
        this.stats.warningCount++
      }

      return result
    } catch (error) {
      this.stats.errorCount++
      return {
        valid: false,
        error: error.message,
        duration: 0,
        message: 'Operation failed'
      }
    }
  }

  /**
   * 重置統計資料
   */
  resetStats () {
    this.stats = {
      validationCount: 0,
      errorCount: 0,
      warningCount: 0
    }
  }

  /**
   * 取得統計資料
   */
  getStats () {
    return { ...this.stats }
  }

  /**
   * 清理資源
   */
  async cleanup () {
    this.resetStats()
  }
}

module.exports = { StorageAPIValidator }
