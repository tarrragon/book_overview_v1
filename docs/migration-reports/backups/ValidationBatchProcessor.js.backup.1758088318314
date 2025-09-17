/**
 * @fileoverview ValidationBatchProcessor - 批次驗證處理協調器
 * @version 1.0.0
 * @since 2025-08-19
 *
 * 負責功能：
 * - 大規模批次驗證處理協調和管理
 * - 並行處理控制和資源分配優化
 * - 批次進度追蹤、暫停、恢復和取消功能
 * - 優先級處理和智能批次分割策略
 *
 * 設計考量：
 * - 實作 IValidationBatchProcessor 介面契約
 * - 支援多種批次處理模式和並行策略
 * - 提供完整的批次生命週期管理
 * - 支援實時進度回報和狀態查詢
 *
 * 處理流程：
 * 1. 接收批次處理請求和配置選項
 * 2. 分析批次大小並規劃並行處理策略
 * 3. 建立批次狀態追蹤和進度管理機制
 * 4. 協調 ValidationEngine 和 DataQualityAnalyzer
 * 5. 提供實時狀態查詢和控制接口
 *
 * 使用情境：
 * - ValidationServiceCoordinator 的批次處理需求
 * - 大規模資料驗證和品質分析作業
 * - 背景批次處理和進度監控
 * - 並行處理優化和資源管理
 */

const { StandardError } = require('src/core/errors/StandardError')

class ValidationBatchProcessor {
  /**
   * 建構批次驗證處理器
   * @param {Object} options - 批次處理器配置選項
   */
  constructor (options = {}) {
    // 驗證必要依賴
    if (!options.validationEngine) {
      throw new StandardError('REQUIRED_FIELD_MISSING', 'ValidationEngine is required', {
        category: 'validation'
      })
    }
    if (!options.dataQualityAnalyzer) {
      throw new StandardError('REQUIRED_FIELD_MISSING', 'DataQualityAnalyzer is required', {
        category: 'ui'
      })
    }

    // 注入依賴服務
    this.validationEngine = options.validationEngine
    this.dataQualityAnalyzer = options.dataQualityAnalyzer

    // 批次處理器配置
    this.config = {
      maxConcurrency: options.maxConcurrency || 5,
      batchSize: options.batchSize || 10,
      enableProgressTracking: options.enableProgressTracking !== false,
      progressUpdateInterval: options.progressUpdateInterval || 1000,
      enableBatchStatistics: options.enableBatchStatistics !== false,
      autoRetryFailedItems: options.autoRetryFailedItems || false,
      maxRetryAttempts: options.maxRetryAttempts || 3,
      batchTimeout: options.batchTimeout || 300000, // 5分鐘
      ...options
    }

    // 批次狀態管理
    this.activeBatches = new Map()
    this.batchHistory = new Map()
    this.batchCounter = 0

    // 處理統計
    this.stats = {
      totalBatches: 0,
      totalBooksProcessed: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      successRate: 0,
      averageQualityScore: 0,
      concurrencyUtilization: 0,
      batchSizeDistribution: {
        small: 0, // <10 books
        medium: 0, // 10-50 books
        large: 0, // 50-200 books
        xlarge: 0 // >200 books
      },
      failureReasons: new Map()
    }

    this.isInitialized = true
  }

  /**
   * 批次處理書籍驗證
   * @param {Array} books - 書籍陣列
   * @param {string} platform - 平台名稱
   * @param {Object} options - 處理選項
   * @returns {Promise<Object>} 批次處理結果
   */
  async processBatch (books, platform, options = {}) {
    const startTime = Date.now()
    const batchId = this._generateBatchId()

    // 輸入驗證
    this._validateBatchInputs(books, platform)

    // 建立批次狀態
    const batchStatus = {
      batchId,
      status: 'pending',
      progress: 0,
      processedCount: 0,
      totalCount: books.length,
      validBooks: 0,
      invalidBooks: 0,
      startTime,
      endTime: null,
      cancelled: false,
      paused: false,
      platform,
      options
    }

    this.activeBatches.set(batchId, batchStatus)

    try {
      // 更新狀態為處理中
      batchStatus.status = 'processing'

      // 分析批次配置
      const batchConfig = this._analyzeBatchConfiguration(books, options)

      // 執行批次處理
      const processingResult = await this._executeBatchProcessing(
        books,
        platform,
        batchId,
        batchConfig,
        options
      )

      // 更新最終狀態
      batchStatus.status = batchStatus.cancelled ? 'cancelled' : 'completed'
      batchStatus.endTime = Date.now()
      batchStatus.progress = 100

      // 建立完整結果
      const batchResult = {
        batchId,
        status: batchStatus.status,
        totalBooks: books.length,
        processedBooks: processingResult.processedCount,
        validBooks: processingResult.validCount,
        invalidBooks: processingResult.invalidCount,
        processingTime: Date.now() - startTime,
        averageQualityScore: processingResult.averageQualityScore,
        individualResults: processingResult.individualResults,
        batchSummary: processingResult.batchSummary,
        batchConfiguration: batchConfig
      }

      // 更新統計
      this._updateBatchStatistics(batchResult)

      // 移至歷史記錄
      this._moveBatchToHistory(batchId, batchResult)

      return batchResult
    } catch (error) {
      batchStatus.status = 'failed'
      batchStatus.error = error.message
      batchStatus.endTime = Date.now()
      this.activeBatches.delete(batchId)
      throw new StandardError('OPERATION_FAILED', `Batch processing failed: ${error.message}`, {
        category: 'general'
      })
    }
  }

  /**
   * 優先級批次處理
   * @param {Array} prioritizedBatches - 具有優先級的批次陣列
   * @param {string} platform - 平台名稱
   * @param {Object} options - 處理選項
   * @returns {Promise<Object>} 優先級處理結果
   */
  async processWithPriority (prioritizedBatches, platform, options = {}) {
    const startTime = Date.now()

    if (!Array.isArray(prioritizedBatches)) {
      throw new StandardError('UNKNOWN_ERROR', 'Prioritized batches must be an array', {
        dataType: 'array',
        category: 'general'
      })
    }

    // 按優先級排序
    const sortedBatches = this._sortBatchesByPriority(prioritizedBatches)
    const batchResults = []
    const priorityOrder = sortedBatches.map(batch => batch.priority)

    for (const batch of sortedBatches) {
      try {
        const result = await this.processBatch(batch.books, platform, {
          ...options,
          priority: batch.priority
        })
        batchResults.push({
          priority: batch.priority,
          batchId: result.batchId,
          result
        })
      } catch (error) {
        batchResults.push({
          priority: batch.priority,
          error: error.message,
          failed: true
        })
      }
    }

    return {
      priorityOrder,
      batchResults,
      totalProcessingTime: Date.now() - startTime,
      completedBatches: batchResults.filter(r => !r.failed).length,
      failedBatches: batchResults.filter(r => r.failed).length
    }
  }

  /**
   * 並行批次處理
   * @param {Array} parallelBatches - 並行批次陣列
   * @param {Object} options - 處理選項
   * @returns {Promise<Object>} 並行處理結果
   */
  async processParallel (parallelBatches, options = {}) {
    const startTime = Date.now()

    if (!Array.isArray(parallelBatches)) {
      throw new StandardError('UNKNOWN_ERROR', 'Parallel batches must be an array', {
        dataType: 'array',
        category: 'general'
      })
    }

    const maxParallelBatches = options.maxParallelBatches || this.config.maxConcurrency

    // 限制並行批次數量
    const limitedBatches = parallelBatches.slice(0, maxParallelBatches)

    // 並行執行所有批次
    const parallelPromises = limitedBatches.map(async (batch) => {
      try {
        const result = await this.processBatch(batch.books, batch.platform, {
          ...options,
          batchName: batch.batchName
        })
        return {
          batchName: batch.batchName,
          platform: batch.platform,
          success: true,
          result
        }
      } catch (error) {
        return {
          batchName: batch.batchName,
          platform: batch.platform,
          success: false,
          error: error.message
        }
      }
    })

    const parallelResults = await Promise.all(parallelPromises)

    return {
      parallelResults,
      concurrentBatches: limitedBatches.length,
      totalProcessingTime: Date.now() - startTime,
      successfulBatches: parallelResults.filter(r => r.success).length,
      failedBatches: parallelResults.filter(r => !r.success).length
    }
  }

  /**
   * 獲取批次狀態
   * @param {string} batchId - 批次ID
   * @returns {Object} 批次狀態
   */
  getBatchStatus (batchId) {
    if (batchId === 'latest') {
      // 獲取最新的活躍批次
      const activeBatchIds = Array.from(this.activeBatches.keys())
      if (activeBatchIds.length === 0) {
        return null
      }
      batchId = activeBatchIds[activeBatchIds.length - 1]
    }

    const activeStatus = this.activeBatches.get(batchId)
    if (activeStatus) {
      return { ...activeStatus }
    }

    const historicalStatus = this.batchHistory.get(batchId)
    if (historicalStatus) {
      return {
        batchId,
        status: 'completed',
        ...historicalStatus
      }
    }

    return null
  }

  /**
   * 取消批次處理
   * @param {string} batchId - 批次ID
   * @returns {Promise<Object>} 取消結果
   */
  async cancelBatch (batchId) {
    if (batchId === 'latest') {
      const activeBatchIds = Array.from(this.activeBatches.keys())
      if (activeBatchIds.length === 0) {
        return { success: false, message: 'No active batches to cancel' }
      }
      batchId = activeBatchIds[activeBatchIds.length - 1]
    }

    const batchStatus = this.activeBatches.get(batchId)
    if (!batchStatus) {
      return { success: false, message: 'Batch not found' }
    }

    batchStatus.cancelled = true
    batchStatus.status = 'cancelled'
    batchStatus.endTime = Date.now()

    return {
      success: true,
      batchId,
      cancelledAt: Date.now(),
      message: 'Batch cancelled successfully'
    }
  }

  /**
   * 暫停批次處理
   * @param {string} batchId - 批次ID
   * @returns {Promise<Object>} 暫停結果
   */
  async pauseBatch (batchId) {
    if (batchId === 'latest') {
      const activeBatchIds = Array.from(this.activeBatches.keys())
      if (activeBatchIds.length === 0) {
        return { success: false, message: 'No active batches to pause' }
      }
      batchId = activeBatchIds[activeBatchIds.length - 1]
    }

    const batchStatus = this.activeBatches.get(batchId)
    if (!batchStatus) {
      return { success: false, message: 'Batch not found' }
    }

    // 允許暫停 processing 狀態的批次
    if (batchStatus.status === 'processing' || batchStatus.status === 'pending') {
      batchStatus.paused = true
      batchStatus.status = 'paused'

      return {
        success: true,
        batchId,
        pausedAt: Date.now()
      }
    }

    return { success: false, message: 'Batch cannot be paused in current state' }
  }

  /**
   * 恢復批次處理
   * @param {string} batchId - 批次ID
   * @returns {Promise<Object>} 恢復結果
   */
  async resumeBatch (batchId) {
    if (batchId === 'latest') {
      const activeBatchIds = Array.from(this.activeBatches.keys())
      if (activeBatchIds.length === 0) {
        return { success: false, message: 'No active batches to resume' }
      }
      batchId = activeBatchIds[activeBatchIds.length - 1]
    }

    const batchStatus = this.activeBatches.get(batchId)
    if (!batchStatus) {
      return { success: false, message: 'Batch not found' }
    }

    if (batchStatus.status !== 'paused') {
      return { success: false, message: 'Batch is not paused' }
    }

    batchStatus.paused = false
    batchStatus.status = 'processing'

    return {
      success: true,
      batchId,
      resumedAt: Date.now()
    }
  }

  /**
   * 獲取處理統計資訊
   * @returns {Object} 統計資訊
   */
  getProcessingStatistics () {
    return {
      ...this.stats,
      activeBatches: this.activeBatches.size,
      historicalBatches: this.batchHistory.size,
      config: this.config,
      timestamp: Date.now()
    }
  }

  /**
   * 私有方法 - 生成批次ID
   * @private
   */
  _generateBatchId () {
    const timestamp = Date.now()
    const counter = ++this.batchCounter
    return `batch_${timestamp}_${counter}`
  }

  /**
   * 私有方法 - 驗證批次輸入
   * @private
   */
  _validateBatchInputs (books, platform) {
    if (!books) {
      throw new StandardError('REQUIRED_FIELD_MISSING', 'Books parameter is required', {
        category: 'ui'
      })
    }
    if (!Array.isArray(books) || books.length === 0) {
      throw new StandardError('REQUIRED_FIELD_MISSING', 'Books array is required and must not be empty', {
        dataType: 'array',
        category: 'ui'
      })
    }
    if (!platform || typeof platform !== 'string' || platform.trim() === '') {
      throw new StandardError('REQUIRED_FIELD_MISSING', 'Platform is required and must be a non-empty string', {
        category: 'ui'
      })
    }
    if (books.length > 10000) {
      throw new StandardError('UNKNOWN_ERROR', 'Batch size too large (maximum 10000 books)', {
        values: [
          '10000'
        ],
        category: 'general'
      })
    }

    // 檢查平台是否為已知支援的平台
    const supportedPlatforms = ['READMOO', 'KINDLE', 'KOBO', 'BOOKWALKER', 'BOOKS_COM']
    if (!supportedPlatforms.includes(platform)) {
      throw new StandardError('UNKNOWN_ERROR', `Unsupported platform: ${platform}`, {
        category: 'general'
      })
    }
  }

  /**
   * 私有方法 - 分析批次配置
   * @private
   */
  _analyzeBatchConfiguration (books, options) {
    const totalBooks = books.length
    const batchSize = options.batchSize || this.config.batchSize
    const maxConcurrency = options.maxConcurrency || this.config.maxConcurrency

    // 更新批次大小分佈統計
    if (totalBooks < 10) {
      this.stats.batchSizeDistribution.small++
    } else if (totalBooks <= 50) {
      this.stats.batchSizeDistribution.medium++
    } else if (totalBooks <= 200) {
      this.stats.batchSizeDistribution.large++
    } else {
      this.stats.batchSizeDistribution.xlarge++
    }

    return {
      batchSize,
      maxConcurrency,
      estimatedBatches: Math.ceil(totalBooks / batchSize),
      estimatedDuration: Math.ceil((totalBooks / maxConcurrency) * 100), // ms estimate
      processingStrategy: totalBooks > 100 ? 'parallel' : 'sequential'
    }
  }

  /**
   * 私有方法 - 執行批次處理
   * @private
   */
  async _executeBatchProcessing (books, platform, batchId, batchConfig, options) {
    const batchStatus = this.activeBatches.get(batchId)
    const individualResults = []
    let processedCount = 0
    let validCount = 0
    let invalidCount = 0
    let totalQualityScore = 0

    // 分割成小批次
    const batches = this._createBatches(books, batchConfig.batchSize)

    for (const batch of batches) {
      // 檢查是否被取消或暫停
      if (batchStatus.cancelled) {
        break
      }

      // 暫停檢查循環
      while (batchStatus.paused && !batchStatus.cancelled) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (batchStatus.cancelled) {
        break
      }

      // 處理當前批次中的每一本書
      for (const book of batch) {
        // 再次檢查暫停和取消狀態
        if (batchStatus.cancelled) {
          break
        }

        while (batchStatus.paused && !batchStatus.cancelled) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        if (batchStatus.cancelled) {
          break
        }

        try {
          // 驗證書籍
          const validationResult = await this.validationEngine.validateSingleBook(book, platform)

          let qualityResult = null
          if (options.includeQualityAnalysis !== false) {
            qualityResult = await this.dataQualityAnalyzer.analyzeBookQuality(book, platform)
          }

          const result = {
            bookId: book.id,
            validation: validationResult,
            quality: qualityResult,
            success: true
          }

          individualResults.push(result)
          processedCount++

          if (result.validation.isValid) {
            validCount++
          } else {
            invalidCount++
          }

          if (result.quality) {
            totalQualityScore += result.quality.overallScore
          }
        } catch (error) {
          const result = {
            bookId: book.id,
            error: error.message,
            success: false
          }
          individualResults.push(result)
        }

        // 更新進度
        const progress = Math.round((processedCount / books.length) * 100)
        batchStatus.progress = progress
        batchStatus.processedCount = processedCount
        batchStatus.validBooks = validCount
        batchStatus.invalidBooks = invalidCount

        // 調用進度回調
        if (options.progressCallback && typeof options.progressCallback === 'function') {
          options.progressCallback({
            batchId,
            processed: processedCount,
            total: books.length,
            percentage: progress,
            currentItem: book.id || 'unknown',
            status: batchStatus.status
          })
        }
      }
    }

    // 計算平均品質分數
    const averageQualityScore = processedCount > 0 ? Math.round(totalQualityScore / processedCount) : 0

    // 生成批次摘要
    const batchSummary = {
      totalProcessed: processedCount,
      validationSummary: {
        valid: validCount,
        invalid: invalidCount,
        validationRate: processedCount > 0 ? Math.round((validCount / processedCount) * 100) / 100 : 0
      },
      qualityAnalysis: {
        averageScore: averageQualityScore,
        scoreDistribution: this._calculateScoreDistribution(individualResults)
      }
    }

    return {
      processedCount,
      validCount,
      invalidCount,
      averageQualityScore,
      individualResults,
      batchSummary
    }
  }

  /**
   * 私有方法 - 按優先級排序批次
   * @private
   */
  _sortBatchesByPriority (batches) {
    const priorityOrder = { urgent: 1, high: 2, normal: 3, low: 4 }

    return batches.sort((a, b) => {
      const aPriority = priorityOrder[a.priority] || 999
      const bPriority = priorityOrder[b.priority] || 999
      return aPriority - bPriority
    })
  }

  /**
   * 私有方法 - 建立批次分組
   * @private
   */
  _createBatches (items, batchSize) {
    const batches = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  /**
   * 私有方法 - 計算分數分佈
   * @private
   */
  _calculateScoreDistribution (results) {
    const distribution = { excellent: 0, good: 0, acceptable: 0, poor: 0 }

    results.forEach(result => {
      if (result.quality) {
        const score = result.quality.overallScore
        if (score >= 90) distribution.excellent++
        else if (score >= 75) distribution.good++
        else if (score >= 60) distribution.acceptable++
        else distribution.poor++
      }
    })

    return distribution
  }

  /**
   * 私有方法 - 更新批次統計
   * @private
   */
  _updateBatchStatistics (batchResult) {
    this.stats.totalBatches++
    this.stats.totalBooksProcessed += batchResult.processedBooks
    this.stats.totalProcessingTime += batchResult.processingTime

    // 計算平均處理時間
    this.stats.averageProcessingTime = Math.round(
      this.stats.totalProcessingTime / this.stats.totalBatches
    )

    // 計算成功率
    this.stats.successRate = this.stats.totalBooksProcessed > 0
      ? Math.round((batchResult.validBooks / this.stats.totalBooksProcessed) * 1000) / 1000
      : 0

    // 更新平均品質分數
    if (batchResult.averageQualityScore > 0) {
      this.stats.averageQualityScore = Math.round(
        ((this.stats.averageQualityScore * (this.stats.totalBatches - 1)) + batchResult.averageQualityScore) /
        this.stats.totalBatches
      )
    }

    // 更新並行度利用率
    this.stats.concurrencyUtilization = Math.min(
      batchResult.processedBooks / this.config.maxConcurrency,
      1.0
    )
  }

  /**
   * 私有方法 - 移動批次到歷史記錄
   * @private
   */
  _moveBatchToHistory (batchId, batchResult) {
    this.batchHistory.set(batchId, {
      ...batchResult,
      completedAt: Date.now()
    })
    this.activeBatches.delete(batchId)

    // 限制歷史記錄數量
    if (this.batchHistory.size > 100) {
      const oldestKey = this.batchHistory.keys().next().value
      this.batchHistory.delete(oldestKey)
    }
  }
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ValidationBatchProcessor
}

// 瀏覽器環境支援
if (typeof window !== 'undefined') {
  window.ValidationBatchProcessor = ValidationBatchProcessor
}
