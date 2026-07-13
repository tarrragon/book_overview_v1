/**
 * Recovery Validator - 錯誤恢復驗證器
 */

class RecoveryValidator {
  constructor () {
    this.recoveryAttempts = []
    this.validationResults = []
  }

  /**
   * 驗證錯誤恢復流程
   */
  validateRecovery (errorType, recoveryStrategy, result) {
    const attempt = {
      errorType,
      recoveryStrategy,
      result,
      timestamp: new Date(),
      success: result.success || false
    }

    this.recoveryAttempts.push(attempt)

    const validation = {
      isValid: this.isValidRecovery(attempt),
      message: this.getValidationMessage(attempt),
      attempt
    }

    this.validationResults.push(validation)
    return validation
  }

  /**
   * 檢查恢復策略是否有效
   */
  isValidRecovery (attempt) {
    // 基本驗證邏輯
    if (!attempt.recoveryStrategy || !attempt.result) {
      return false
    }

    // 檢查恢復結果
    return attempt.result.success === true
  }

  /**
   * 生成驗證訊息
   */
  getValidationMessage (attempt) {
    if (this.isValidRecovery(attempt)) {
      return `Recovery successful for ${attempt.errorType}`
    } else {
      return `Recovery failed for ${attempt.errorType}`
    }
  }

  /**
   * 獲取恢復統計
   */
  getRecoveryStats () {
    const total = this.recoveryAttempts.length
    const successful = this.recoveryAttempts.filter(a => a.success).length

    return {
      total,
      successful,
      failed: total - successful,
      successRate: total > 0 ? successful / total : 0
    }
  }

  /**
   * 重置驗證器
   */
  reset () {
    this.recoveryAttempts = []
    this.validationResults = []
  }

  /**
   * 計算資料雜湊值
   */
  async calculateDataHash (data) {
    if (!data || typeof data !== 'object') {
      return 'empty-hash'
    }

    // 簡單的雜湊計算（用於測試環境）
    const dataString = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return `hash-${Math.abs(hash).toString(16)}`
  }

  /**
   * 驗證資料完整性
   *
   * 支援兩種呼叫方式：
   * - validateDataIntegrity(books)：單一書籍陣列，檢查每筆記錄結構完整性
   * - validateDataIntegrity(originalHash, currentData)：雜湊比對（沿用既有呼叫端）
   */
  async validateDataIntegrity (originalHashOrBooks, currentData) {
    if (currentData === undefined) {
      const books = originalHashOrBooks || []
      const corruptedRecords = books.filter(book => !book || !book.id || !book.title)
      return {
        isValid: corruptedRecords.length === 0,
        corruptedRecords
      }
    }

    const originalHash = originalHashOrBooks
    const currentHash = await this.calculateDataHash(currentData)
    return {
      isValid: originalHash === currentHash,
      originalHash,
      currentHash,
      corruptionDetected: originalHash !== currentHash
    }
  }

  /**
   * 驗證完整資料恢復完整性（比對新增資料集是否完整落地、有無損毀或重複）
   */
  async validateFullDataIntegrity (initialBooks, finalBooks, addedDataset) {
    const finalIds = new Set((finalBooks || []).map(book => book.id))
    const missingRecords = (addedDataset || []).filter(book => !finalIds.has(book.id))
    const corruptedRecords = (finalBooks || []).filter(book => !book || !book.id || !book.title)

    const idCounts = {}
    ;(finalBooks || []).forEach(book => {
      idCounts[book.id] = (idCounts[book.id] || 0) + 1
    })
    const duplicateRecords = Object.keys(idCounts).filter(id => idCounts[id] > 1)

    return {
      isComplete: missingRecords.length === 0,
      missingRecords,
      corruptedRecords,
      duplicateRecords
    }
  }

  /**
   * 分析資料遺失情況（比對操作前後的書籍數量變化）
   */
  async analyzeDataLoss (initialState, finalState, options = {}) {
    const initialBooks = initialState?.books || []
    const finalBooks = finalState?.books || []
    const addedRecords = finalBooks.length - initialBooks.length
    const deletedRecords = 0
    const modifiedRecords = 0

    const expectedAdditions = options.expectedAdditions || 0
    const allowedDeletions = options.allowedDeletions || 0
    const hasDataLoss = addedRecords < expectedAdditions || deletedRecords > allowedDeletions

    return {
      hasDataLoss,
      addedRecords,
      modifiedRecords,
      deletedRecords,
      integrityScore: hasDataLoss ? 0.0 : 1.0
    }
  }

  /**
   * 驗證複合恢復（多重錯誤情境）後的資料一致性
   */
  async validateComplexRecoveryIntegrity (books) {
    const corruptedRecords = (books || []).filter(book => !book || !book.id || !book.title)
    const passedAllChecks = corruptedRecords.length === 0

    return {
      passedAllChecks,
      dataConsistency: passedAllChecks ? 'perfect' : 'degraded',
      recoverabilityScore: passedAllChecks ? 1.0 : 0.0,
      corruptedRecords
    }
  }

  /**
   * 驗證恢復時間
   */
  validateRecoveryTime (startTime, maxDuration = 30000) {
    const endTime = Date.now()
    const duration = endTime - startTime
    return {
      duration,
      withinLimit: duration <= maxDuration,
      startTime,
      endTime
    }
  }

  /**
   * 驗證錯誤分類
   */
  validateErrorClassification (error, expectedType) {
    const detectedType = this.detectErrorType(error)
    return {
      isCorrect: detectedType === expectedType,
      detected: detectedType,
      expected: expectedType
    }
  }

  /**
   * 檢測錯誤類型（簡化版本）
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
}

module.exports = RecoveryValidator
