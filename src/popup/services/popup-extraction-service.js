/**
 * PopupExtractionService - Popup 提取服務協調器
 *
 * 負責功能：
 * - 業務邏輯協調和流程控制
 * - 整合 StatusManager、ProgressManager、CommunicationService
 * - 提取流程生命週期管理（idle → extracting → completed/cancelled/error）
 * - 錯誤處理、重試機制和資源管理
 *
 * 設計考量：
 * - 協調器模式：專注於組件協調，不直接處理 UI 或資料細節
 * - 依賴注入：完全支援 Mock 替換和測試隔離
 * - 單一職責：只負責提取流程的業務邏輯協調
 * - 錯誤恢復：完整的錯誤處理、重試和狀態恢復機制
 * - 狀態一致性：確保所有組件狀態同步和一致
 *
 * 處理流程：
 * 1. 初始化和依賴驗證：確保所有必要組件可用
 * 2. 提取流程啟動和狀態協調：協調多組件狀態更新
 * 3. 進度追蹤和批次處理管理：實時更新進度和處理批次資料
 * 4. 錯誤處理和重試邏輯執行：指數退避重試和錯誤恢復
 * 5. 完成處理和資源清理：統計記錄和資源釋放
 *
 * 使用情境：
 * - 作為 Popup 界面的核心業務邏輯協調者
 * - 管理完整的書庫資料提取工作流程
 * - 與 UX Domain 服務層整合的業務邏輯橋接
 * - 提供統一的提取服務 API 和狀態管理
 *
 * @version 1.0.0
 * @since 2025-08-18
 */

class PopupExtractionService {
  /**
   * 建構 PopupExtractionService
   * @param {Object} statusManager - 狀態管理器實例
   * @param {Object} progressManager - 進度管理器實例
   * @param {Object} communicationService - 通訊服務實例
   * @param {Object} [options] - 提取選項配置
   */
  constructor (statusManager, progressManager, communicationService, options = {}) {
    // 驗證必要依賴
    if (!statusManager) {
      throw new Error('StatusManager is required')
    }
    if (!progressManager) {
      throw new Error('ProgressManager is required')
    }
    if (!communicationService) {
      throw new Error('CommunicationService is required')
    }

    // 儲存依賴實例
    this.statusManager = statusManager
    this.progressManager = progressManager
    this.communicationService = communicationService

    // 配置選項（合併預設值）
    this.config = {
      maxRetries: 3,
      timeout: 5000,
      batchSize: 25,
      ...options
    }

    // 提取狀態管理
    this.isExtracting = false
    this.currentExtractionId = null
    this.retryCount = 0
    this.lastStatusUpdate = null

    // 錯誤和統計追蹤
    this.componentErrors = []
    this.extractionHistory = []
  }

  /**
   * 開始提取流程
   * @param {Object} [extractionOptions] - 提取選項
   * @returns {Promise<Object>} 提取結果
   */
  async startExtraction (extractionOptions = {}) {
    // 防止重複提取
    if (this.isExtracting) {
      throw new Error('Extraction already in progress')
    }

    try {
      // 設置提取狀態
      this.isExtracting = true
      this.currentExtractionId = `extraction-${Date.now()}`
      this.retryCount = 0

      // 更新狀態為開始提取
      this.statusManager.updateStatus({
        type: 'extracting',
        text: '正在提取資料',
        info: '已開始書庫資料提取流程'
      })

      // 執行實際提取（帶重試機制）
      const result = await this._executeWithRetry(async () => {
        return await this.communicationService.startExtraction()
      })

      // 啟動進度追蹤
      this.progressManager.startProgress({
        title: '提取書庫資料',
        estimatedTotal: result.estimatedCount || 100
      })

      // 記錄提取歷史
      this._recordExtractionStart(result)

      return result
    } catch (error) {
      // 提取失敗處理
      const errorInfo = this._categorizeError(error)

      this.statusManager.updateStatus({
        type: 'error',
        text: '提取失敗',
        info: errorInfo.message
      })

      this.isExtracting = false
      this.currentExtractionId = null
      throw error
    }
  }

  /**
   * 取消進行中的提取
   * @param {string} [reason] - 取消原因
   * @returns {Promise<Object>} 取消結果
   */
  async cancelExtraction (reason = '使用者取消') {
    if (!this.isExtracting) {
      return { cancelled: false, reason: 'No extraction in progress' }
    }

    // 更新狀態為取消
    this.statusManager.updateStatus({
      type: 'ready',
      text: '提取已取消',
      info: reason
    })

    // 取消進度顯示
    this.progressManager.cancelProgress(reason)

    // 重置狀態
    this.isExtracting = false
    this.currentExtractionId = null

    return { cancelled: true, reason }
  }

  /**
   * 處理部分失敗的恢復機制
   * @param {Object} partialResult - 部分成功的結果
   */
  handlePartialFailure (partialResult) {
    const { totalProcessed, successCount, failureCount } = partialResult

    // 更新狀態為部分完成
    this.statusManager.updateStatus({
      type: 'completed',
      text: '提取部分完成',
      info: `成功處理 ${successCount}/${totalProcessed} 本書籍，${failureCount} 個項目失敗`
    })

    // 完成進度顯示
    this.progressManager.completeProgress(partialResult)

    // 重置提取狀態
    this.isExtracting = false
  }

  /**
   * 處理和驗證提取結果
   * @param {Object} extractionResult - 原始提取結果
   * @returns {Object} 處理後的結果
   */
  processExtractionResult (extractionResult) {
    // 驗證結果格式
    if (!extractionResult || !extractionResult.books || typeof extractionResult.totalProcessed !== 'number') {
      this.statusManager.updateStatus({
        type: 'error',
        text: '資料處理失敗',
        info: '提取結果格式無效'
      })
      throw new Error('Invalid extraction result format')
    }

    const { books, totalProcessed, successCount, failureCount } = extractionResult

    // 計算成功率
    const successRate = totalProcessed > 0 ? Math.round((successCount / totalProcessed) * 100) : 0

    return {
      isValid: true,
      summary: {
        totalBooks: totalProcessed,
        successfulBooks: successCount || 0,
        failedBooks: failureCount || 0,
        successRate
      },
      books: books || []
    }
  }

  /**
   * 更新批次處理進度
   * @param {Object} batchProgress - 批次進度資料
   */
  updateBatchProgress (batchProgress) {
    const { currentBatch, totalBatches, batchSize, processedInBatch, totalProcessed } = batchProgress

    // 計算總體進度百分比
    const totalEstimated = totalBatches * batchSize
    const percentage = Math.round((totalProcessed / totalEstimated) * 100)

    // 更新進度管理器
    this.progressManager.updateProgress({
      percentage,
      status: 'processing',
      text: `批次 ${currentBatch}/${totalBatches}：已處理 ${processedInBatch}/${batchSize} 本書籍`
    })
  }

  /**
   * 協調狀態管理器更新
   * @param {Object} statusUpdate - 狀態更新資料
   */
  coordinateStatusUpdate (statusUpdate) {
    try {
      // 更新狀態管理器
      this.statusManager.updateStatus(statusUpdate)

      // 記錄最後更新
      this.lastStatusUpdate = { ...statusUpdate, timestamp: Date.now() }
    } catch (error) {
      // 記錄組件錯誤
      this.componentErrors.push({
        component: 'StatusManager',
        error: error.message,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 驗證狀態一致性
   * @returns {boolean} 狀態是否一致
   */
  validateStateConsistency () {
    const progressState = this.progressManager.getCurrentProgress()
    const statusState = this.statusManager.getCurrentStatus()

    // 基本一致性檢查
    return (progressState.status === 'processing' && statusState.type === 'extracting') ||
           (progressState.status === 'idle' && statusState.type === 'ready') ||
           (progressState.status === 'completed' && statusState.type === 'completed')
  }

  /**
   * 處理提取完成事件
   * @param {Object} completionData - 完成資料
   */
  handleExtractionCompleted (completionData) {
    const { totalProcessed, successCount, duration } = completionData

    // 更新進度管理器
    this.progressManager.completeProgress(completionData)

    // 格式化耗時
    const durationText = duration ? `，耗時 ${Math.round(duration / 60000)} 分鐘` : ''

    // 更新狀態管理器
    this.statusManager.updateStatus({
      type: 'completed',
      text: '提取完成',
      info: `成功處理 ${successCount}/${totalProcessed} 本書籍${durationText}`
    })

    // 重置提取狀態
    this.isExtracting = false
    this.currentExtractionId = null

    // 記錄提取歷史
    this._recordExtractionCompletion(completionData)
  }

  /**
   * 處理通訊服務事件
   * @param {Object} event - 事件資料
   */
  handleCommunicationEvent (event) {
    switch (event.type) {
      case 'EXTRACTION_STARTED':
        this.progressManager.startProgress({
          title: '提取書庫資料',
          estimatedTotal: event.data.estimatedCount
        })
        break

      case 'EXTRACTION_PROGRESS':
        this.progressManager.updateProgress({
          percentage: event.data.percentage,
          status: 'extracting',
          text: event.data.text
        })
        break

      case 'EXTRACTION_COMPLETED':
        this.handleExtractionCompleted(event.data)
        break

      default:
        // 忽略未知事件類型
        break
    }
  }

  /**
   * 清理資源
   */
  cleanup () {
    // 清理通訊服務
    this.communicationService.cleanup()

    // 重置狀態
    this.isExtracting = false
    this.currentExtractionId = null
    this.retryCount = 0

    // 清理錯誤記錄
    this.componentErrors = []
  }

  /**
   * 獲取提取統計報告
   * @returns {Object} 統計資料
   */
  getExtractionStatistics () {
    if (this.extractionHistory.length === 0) {
      return {
        totalExtractions: 0,
        totalBooksProcessed: 0,
        totalBooksSuccessful: 0,
        averageSuccessRate: 0,
        averageDuration: 0
      }
    }

    const totalExtractions = this.extractionHistory.length
    const totalBooksProcessed = this.extractionHistory.reduce((sum, extraction) =>
      sum + (extraction.totalProcessed || 0), 0)
    const totalBooksSuccessful = this.extractionHistory.reduce((sum, extraction) =>
      sum + (extraction.successCount || 0), 0)

    const averageSuccessRate = totalBooksProcessed > 0
      ? (totalBooksSuccessful / totalBooksProcessed) * 100
      : 0

    const validDurations = this.extractionHistory
      .map(e => e.endTime - e.startTime)
      .filter(d => d > 0)
    const averageDuration = validDurations.length > 0
      ? validDurations.reduce((sum, d) => sum + d, 0) / validDurations.length
      : 0

    return {
      totalExtractions,
      totalBooksProcessed,
      totalBooksSuccessful,
      averageSuccessRate,
      averageDuration
    }
  }

  /**
   * 帶重試機制的執行包裝器
   * 使用指數退避策略，每次重試間隔遞增
   * @param {Function} operation - 要執行的操作
   * @returns {Promise<*>} 操作結果
   * @private
   */
  async _executeWithRetry (operation) {
    let lastError

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        this.retryCount = attempt + 1

        // 如果不是最後一次嘗試，執行指數退避延遲
        if (attempt < this.config.maxRetries - 1) {
          const delayMs = this._calculateBackoffDelay(attempt)
          await this._delay(delayMs)
        }
      }
    }

    throw new Error(`Extraction failed after ${this.config.maxRetries} retries: ${lastError.message}`)
  }

  /**
   * 計算指數退避延遲時間
   * @param {number} attempt - 當前嘗試次數
   * @returns {number} 延遲毫秒數
   * @private
   */
  _calculateBackoffDelay (attempt) {
    // 指數退避：1秒、2秒、4秒...
    return Math.min(1000 * Math.pow(2, attempt), 8000) // 最大8秒
  }

  /**
   * 延遲執行工具方法
   * @param {number} ms - 延遲毫秒數
   * @returns {Promise} 延遲 Promise
   * @private
   */
  _delay (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 記錄提取開始
   * @param {Object} result - 開始結果
   * @private
   */
  _recordExtractionStart (result) {
    const extractionRecord = {
      id: this.currentExtractionId,
      startTime: Date.now(),
      estimatedCount: result.estimatedCount || 0
    }

    this.extractionHistory.push(extractionRecord)
  }

  /**
   * 記錄提取完成
   * @param {Object} completionData - 完成資料
   * @private
   */
  _recordExtractionCompletion (completionData) {
    const currentRecord = this.extractionHistory.find(
      record => record.id === this.currentExtractionId
    )

    if (currentRecord) {
      currentRecord.endTime = Date.now()
      currentRecord.totalProcessed = completionData.totalProcessed || 0
      currentRecord.successCount = completionData.successCount || 0
      currentRecord.failureCount = completionData.failureCount || 0
    }
  }

  /**
   * 錯誤分類和訊息提取
   * @param {Error} error - 原始錯誤
   * @returns {Object} 分類後的錯誤資訊
   * @private
   */
  _categorizeError (error) {
    const message = error.message || '未知錯誤'

    // 從重試錯誤中提取原始錯誤訊息
    if (message.includes('retries:')) {
      const originalMessage = message.split('retries: ')[1] || message
      return {
        type: 'retry_exhausted',
        message: originalMessage,
        category: 'network'
      }
    }

    // 分類常見錯誤類型
    if (message.includes('timeout')) {
      return { type: 'timeout', message, category: 'network' }
    }

    if (message.includes('Chrome API') || message.includes('Extension')) {
      return { type: 'chrome_api', message, category: 'system' }
    }

    if (message.includes('Readmoo')) {
      return { type: 'readmoo_page', message, category: 'page' }
    }

    return { type: 'unknown', message, category: 'unknown' }
  }
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PopupExtractionService
}
