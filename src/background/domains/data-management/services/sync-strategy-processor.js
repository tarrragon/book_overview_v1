/**
 * @fileoverview SyncStrategyProcessor - 同步策略處理器
 * @version TDD v4/8
 * @since 2025-08-21
 *
 * 從 data-synchronization-service.js 中提取的同步策略執行邏輯
 *
 * 負責功能：
 * - MERGE 策略：智能合併資料變更
 * - OVERWRITE 策略：強制覆寫目標資料
 * - APPEND 策略：僅追加新資料
 * - 批量處理和錯誤處理
 * - 策略驗證和選擇
 *
 * 設計原則：
 * - 單一責任：專注於同步策略執行
 * - 依賴注入：易於測試和配置
 * - 錯誤恢復：完整的重試和錯誤處理機制
 * - 統計監控：處理統計和效能監控
 */

class SyncStrategyProcessor {
  /**
   * 初始化同步策略處理器
   * @param {Object} logger - 日誌記錄器
   * @param {Object} config - 配置物件
   */
  constructor (logger, config = {}) {
    if (!logger) {
      throw new Error('Logger is required')
    }

    this.logger = logger
    this.config = this.mergeWithDefaults(config)

    // 支援的同步策略
    this.supportedStrategies = ['MERGE', 'OVERWRITE', 'APPEND']

    // 處理統計
    this.statistics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      strategiesUsed: {},
      averageProcessingTime: 0,
      totalProcessingTime: 0
    }
  }

  /**
   * 合併預設配置
   * @param {Object} userConfig - 使用者配置
   * @returns {Object} 合併後的配置
   */
  mergeWithDefaults (userConfig) {
    const defaultConfig = {
      batchSize: 100,
      enableProgressTracking: true,
      retryAttempts: 3,
      retryDelay: 1000,
      safetyChecks: true,
      maxRetryDelay: 10000
    }

    return { ...defaultConfig, ...userConfig }
  }

  /**
   * 檢查策略是否支援
   * @param {string} strategy - 同步策略
   * @returns {boolean} 是否支援
   */
  isStrategySupported (strategy) {
    return this.supportedStrategies.includes(strategy)
  }

  /**
   * 驗證策略
   * @param {string} strategy - 同步策略
   * @throws {Error} 當策略不支援時
   */
  validateStrategy (strategy) {
    if (!this.isStrategySupported(strategy)) {
      throw new Error(`Unsupported sync strategy: ${strategy}`)
    }
  }

  /**
   * 應用同步變更 - 主要介面
   * @param {string} platform - 目標平台
   * @param {Object} changes - 變更內容
   * @param {string} strategy - 同步策略
   * @returns {Promise<Object>} 應用結果
   */
  async applySyncChanges (platform, changes, strategy) {
    const startTime = Date.now()

    try {
      this.logger.log(`應用同步變更到 ${platform}, 策略: ${strategy}`)

      // 驗證策略
      this.validateStrategy(strategy)

      // 更新統計
      this.updateStatistics('start', strategy)

      let result

      // 根據策略執行相應的處理邏輯
      switch (strategy) {
        case 'MERGE':
          result = await this.applyMergeStrategy(platform, changes)
          break
        case 'OVERWRITE':
          result = await this.applyOverwriteStrategy(platform, changes)
          break
        case 'APPEND':
          result = await this.applyAppendStrategy(platform, changes)
          break
        default:
          throw new Error(`Unsupported sync strategy: ${strategy}`)
      }

      // 記錄處理時間
      const processingTime = Date.now() - startTime
      this.updateProcessingTime(processingTime)
      this.updateStatistics('success', strategy)

      return result
    } catch (error) {
      this.logger.error(`應用同步變更失敗: ${error.message}`)
      this.updateStatistics('failure', strategy)
      throw error
    }
  }

  /**
   * 應用 MERGE 策略（智能合併）
   * @param {string} platform - 目標平台
   * @param {Object} changes - 變更內容
   * @returns {Promise<Object>} 應用統計
   */
  async applyMergeStrategy (platform, changes) {
    const applied = this.initializeAppliedResult()
    
    try {
      this.logger.log(`開始 MERGE 策略 - 平台: ${platform}`)
      await this.executeMergeOperations(platform, changes, applied)
      this.logMergeCompletion(platform, applied)
      
      return this.createStrategyResult(platform, 'MERGE', applied)
    } catch (error) {
      return this.handleMergeStrategyError(platform, error, applied)
    }
  }

  /**
   * 初始化應用結果物件
   */
  initializeAppliedResult () {
    return { added: 0, modified: 0, deleted: 0, errors: [] }
  }

  /**
   * 執行 MERGE 策略的所有操作
   */
  async executeMergeOperations (platform, changes, applied) {
    const batchSize = this.config.batchSize || 100
    
    await this.processAddedItems(platform, changes.added, applied, batchSize)
    await this.processModifiedItems(platform, changes.modified, applied, batchSize)
    await this.processDeletedItems(platform, changes.deleted, applied, batchSize)
  }

  /**
   * 處理新增項目
   */
  async processAddedItems (platform, addedItems, applied, batchSize) {
    if (addedItems && addedItems.length > 0) {
      applied.added = await this.processBatchChanges(platform, 'ADD', addedItems, batchSize)
    }
  }

  /**
   * 處理修改項目
   */
  async processModifiedItems (platform, modifiedItems, applied, batchSize) {
    if (modifiedItems && modifiedItems.length > 0) {
      const mergeResults = await this.processModifiedItemsIntelligently(platform, modifiedItems, batchSize)
      applied.modified = mergeResults.success
      applied.errors.push(...mergeResults.errors)
    }
  }

  /**
   * 處理刪除項目
   */
  async processDeletedItems (platform, deletedItems, applied, batchSize) {
    if (deletedItems && deletedItems.length > 0) {
      const deleteResults = await this.processDeletedItemsSafely(platform, deletedItems, batchSize)
      applied.deleted = deleteResults.success
      applied.errors.push(...deleteResults.errors)
    }
  }

  /**
   * 記錄 MERGE 策略完成日誌
   */
  logMergeCompletion (platform, applied) {
    this.logger.log(`MERGE 策略應用完成 - 平台: ${platform}, 新增: ${applied.added}, 修改: ${applied.modified}, 刪除: ${applied.deleted}`)
  }

  /**
   * 創建策略執行結果
   */
  createStrategyResult (platform, strategy, applied, warnings = []) {
    return {
      platform,
      strategy,
      applied,
      errors: applied.errors,
      warnings,
      timestamp: Date.now()
    }
  }

  /**
   * 處理 MERGE 策略錯誤
   */
  handleMergeStrategyError (platform, error, applied) {
    this.logger.error(`MERGE 策略執行失敗: ${error.message}`)
    applied.errors.push({
      type: 'STRATEGY_ERROR',
      message: error.message,
      platform
    })
    
    return this.createStrategyResult(platform, 'MERGE', applied)
  }

  /**
   * 應用 OVERWRITE 策略（強制覆寫）
   * @param {string} platform - 目標平台
   * @param {Object} changes - 變更內容
   * @returns {Promise<Object>} 應用統計
   */
  async applyOverwriteStrategy (platform, changes) {
    const applied = this.initializeOverwriteResult()
    
    try {
      this.logger.log(`開始 OVERWRITE 策略 - 平台: ${platform}，這將覆寫所有目標資料`)
      this.addDataLossWarning(platform, applied)
      await this.executeOverwriteOperations(platform, changes, applied)
      this.logOverwriteCompletion(platform, applied)
      
      return this.createStrategyResult(platform, 'OVERWRITE', applied, applied.warnings)
    } catch (error) {
      return this.handleOverwriteStrategyError(platform, error, applied)
    }
  }

  /**
   * 初始化覆寫策略結果物件
   */
  initializeOverwriteResult () {
    return { added: 0, modified: 0, deleted: 0, errors: [], warnings: [] }
  }

  /**
   * 添加資料丟失警告
   */
  addDataLossWarning (platform, applied) {
    const warningMessage = '覆寫策略可能導致目標平台獨有資料丟失'
    applied.warnings.push({
      type: 'DATA_LOSS_WARNING',
      message: warningMessage,
      platform
    })
    this.logger.log(warningMessage)
  }

  /**
   * 執行覆寫策略的所有操作
   */
  async executeOverwriteOperations (platform, changes, applied) {
    const batchSize = this.config.batchSize || 100
    
    await this.forceAddItems(platform, changes.added, applied, batchSize)
    await this.forceOverwriteItems(platform, changes.modified, applied, batchSize)
    await this.forceDeleteItems(platform, changes.deleted, applied, batchSize)
  }

  /**
   * 強制新增項目
   */
  async forceAddItems (platform, addedItems, applied, batchSize) {
    if (addedItems && addedItems.length > 0) {
      applied.added = await this.processBatchChanges(platform, 'FORCE_ADD', addedItems, batchSize)
    }
  }

  /**
   * 強制覆寫項目
   */
  async forceOverwriteItems (platform, modifiedItems, applied, batchSize) {
    if (modifiedItems && modifiedItems.length > 0) {
      applied.modified = await this.processBatchChanges(platform, 'FORCE_OVERWRITE', modifiedItems, batchSize)
    }
  }

  /**
   * 強制刪除項目
   */
  async forceDeleteItems (platform, deletedItems, applied, batchSize) {
    if (deletedItems && deletedItems.length > 0) {
      applied.deleted = await this.processBatchChanges(platform, 'FORCE_DELETE', deletedItems, batchSize)
    }
  }

  /**
   * 記錄覆寫策略完成日誌
   */
  logOverwriteCompletion (platform, applied) {
    this.logger.log(`OVERWRITE 策略完成 - 平台: ${platform}, 新增: ${applied.added}, 覆寫: ${applied.modified}, 刪除: ${applied.deleted}`)
  }

  /**
   * 處理覆寫策略錯誤
   */
  handleOverwriteStrategyError (platform, error, applied) {
    this.logger.error(`OVERWRITE 策略執行失敗: ${error.message}`)
    applied.errors.push({
      type: 'STRATEGY_ERROR',
      message: error.message,
      platform
    })
    
    return this.createStrategyResult(platform, 'OVERWRITE', applied, applied.warnings)
  }

  /**
   * 應用 APPEND 策略（僅追加）
   * @param {string} platform - 目標平台
   * @param {Object} changes - 變更內容
   * @returns {Promise<Object>} 應用統計
   */
  async applyAppendStrategy (platform, changes) {
    const applied = this.initializeAppendResult()
    
    try {
      this.logger.log(`開始 APPEND 策略 - 平台: ${platform}，僅追加新資料，不修改或刪除現有資料`)
      await this.executeAppendOperations(platform, changes, applied)
      this.recordSkippedOperations(changes, applied)
      this.logAppendCompletion(platform, applied, changes)
      
      return this.createAppendStrategyResult(platform, applied)
    } catch (error) {
      return this.handleAppendStrategyError(platform, error, applied)
    }
  }

  /**
   * 初始化追加策略結果物件
   */
  initializeAppendResult () {
    return { added: 0, modified: 0, deleted: 0, errors: [], skipped: [] }
  }

  /**
   * 執行追加策略操作
   */
  async executeAppendOperations (platform, changes, applied) {
    if (changes.added && changes.added.length > 0) {
      const batchSize = this.config.batchSize || 100
      applied.added = await this.processBatchChanges(platform, 'SAFE_ADD', changes.added, batchSize)
    }
  }

  /**
   * 記錄跳過的操作
   */
  recordSkippedOperations (changes, applied) {
    this.recordSkippedModifications(changes.modified, applied)
    this.recordSkippedDeletions(changes.deleted, applied)
  }

  /**
   * 記錄跳過的修改操作
   */
  recordSkippedModifications (modifiedItems, applied) {
    if (modifiedItems && modifiedItems.length > 0) {
      applied.skipped.push({
        type: 'MODIFICATIONS_SKIPPED',
        count: modifiedItems.length,
        reason: 'APPEND 策略不允許修改現有資料'
      })
    }
  }

  /**
   * 記錄跳過的刪除操作
   */
  recordSkippedDeletions (deletedItems, applied) {
    if (deletedItems && deletedItems.length > 0) {
      applied.skipped.push({
        type: 'DELETIONS_SKIPPED',
        count: deletedItems.length,
        reason: 'APPEND 策略不允許刪除現有資料'
      })
    }
  }

  /**
   * 記錄追加策略完成日誌
   */
  logAppendCompletion (platform, applied, changes) {
    this.logger.log(`APPEND 策略完成 - 平台: ${platform}, 新增: ${applied.added}, 跳過修改: ${changes.modified?.length || 0}, 跳過刪除: ${changes.deleted?.length || 0}`)
  }

  /**
   * 創建追加策略結果
   */
  createAppendStrategyResult (platform, applied) {
    return {
      platform,
      strategy: 'APPEND',
      applied,
      skipped: applied.skipped,
      errors: applied.errors,
      timestamp: Date.now()
    }
  }

  /**
   * 處理追加策略錯誤
   */
  handleAppendStrategyError (platform, error, applied) {
    this.logger.error(`APPEND 策略執行失敗: ${error.message}`)
    applied.errors.push({
      type: 'STRATEGY_ERROR',
      message: error.message,
      platform
    })
    
    return this.createAppendStrategyResult(platform, applied)
  }

  /**
   * 批量處理變更
   * @param {string} platform - 目標平台
   * @param {string} operation - 操作類型
   * @param {Array} items - 項目列表
   * @param {number} batchSize - 批量大小
   * @returns {Promise<number>} 處理成功的項目數量
   */
  async processBatchChanges (platform, operation, items, batchSize) {
    if (!this.isValidItemsArray(items)) return 0
    
    const processedCount = await this.processItemsInBatches(platform, operation, items, batchSize)
    this.logBatchProcessingCompletion(platform, operation, processedCount)
    
    return processedCount
  }

  /**
   * 驗證項目陣列是否有效
   */
  isValidItemsArray (items) {
    return items && items.length > 0
  }

  /**
   * 分批處理項目
   */
  async processItemsInBatches (platform, operation, items, batchSize) {
    let processedCount = 0
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      const batchResult = await this.processSingleBatchWithRetry(platform, operation, batch)
      processedCount += batchResult
    }
    
    return processedCount
  }

  /**
   * 處理單一批次並支援重試
   */
  async processSingleBatchWithRetry (platform, operation, batch) {
    const maxRetries = this.config.retryAttempts || 3
    let retryCount = 0
    
    while (retryCount < maxRetries) {
      const result = await this.attemptBatchOperation(platform, operation, batch, retryCount, maxRetries)
      if (result.success) return result.count
      retryCount++
    }
  }

  /**
   * 嘗試執行批次操作
   */
  async attemptBatchOperation (platform, operation, batch, retryCount, maxRetries) {
    try {
      const count = await this.executeBatchOperation(platform, operation, batch)
      return { success: true, count }
    } catch (error) {
      return await this.handleBatchOperationError(error, retryCount, maxRetries)
    }
  }

  /**
   * 處理批次操作錯誤
   */
  async handleBatchOperationError (error, retryCount, maxRetries) {
    if (retryCount + 1 >= maxRetries) {
      this.logger.error(`批量處理失敗，達到最大重試次數: ${error.message}`)
      throw error
    }
    
    await this.performRetryActions(retryCount, maxRetries)
    return { success: false, count: 0 }
  }

  /**
   * 執行重試相關動作
   */
  async performRetryActions (retryCount, maxRetries) {
    await this.waitForRetry(retryCount + 1)
    this.logger.log(`批量處理重試 ${retryCount + 1}/${maxRetries}`)
  }

  /**
   * 記錄批量處理完成日誌
   */
  logBatchProcessingCompletion (platform, operation, processedCount) {
    this.logger.log(`批量處理完成 - 平台: ${platform}, 操作: ${operation}, 處理項目: ${processedCount}`)
  }

  /**
   * 執行批量操作（模擬實作）
   * @param {string} platform - 目標平台
   * @param {string} operation - 操作類型
   * @param {Array} batch - 批量項目
   * @returns {Promise<number>} 處理成功的項目數量
   */
  async executeBatchOperation (platform, operation, batch) {
    // 模擬批量操作處理時間
    await new Promise(resolve => setTimeout(resolve, 10))

    // 模擬操作成功
    return batch.length
  }

  /**
   * 智能處理修改項目
   * @param {string} platform - 目標平台
   * @param {Array} modifiedItems - 修改項目
   * @param {number} batchSize - 批量大小
   * @returns {Promise<Object>} 處理結果
   */
  async processModifiedItemsIntelligently (platform, modifiedItems, batchSize) {
    try {
      const success = await this.processBatchChanges(platform, 'SMART_MERGE', modifiedItems, batchSize)
      return { success, errors: [] }
    } catch (error) {
      return {
        success: 0,
        errors: [{
          type: 'MERGE_ERROR',
          message: error.message,
          platform
        }]
      }
    }
  }

  /**
   * 安全處理刪除項目
   * @param {string} platform - 目標平台
   * @param {Array} deletedItems - 刪除項目
   * @param {number} batchSize - 批量大小
   * @returns {Promise<Object>} 處理結果
   */
  async processDeletedItemsSafely (platform, deletedItems, batchSize) {
    try {
      const success = await this.processBatchChanges(platform, 'SAFE_DELETE', deletedItems, batchSize)
      return { success, errors: [] }
    } catch (error) {
      return {
        success: 0,
        errors: [{
          type: 'DELETE_ERROR',
          message: error.message,
          platform
        }]
      }
    }
  }

  /**
   * 等待重試延遲
   * @param {number} retryCount - 重試次數
   */
  async waitForRetry (retryCount) {
    const baseDelay = this.config.retryDelay || 1000
    const maxDelay = this.config.maxRetryDelay || 10000

    // 指數退避
    const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), maxDelay)

    // 加入隨機分散
    const jitter = Math.random() * 0.1 * delay
    const finalDelay = Math.floor(delay + jitter)

    await new Promise(resolve => setTimeout(resolve, finalDelay))
  }

  /**
   * 更新統計資訊
   * @param {string} type - 統計類型 (start|success|failure)
   * @param {string} strategy - 策略名稱
   */
  updateStatistics (type, strategy) {
    switch (type) {
      case 'start':
        this.statistics.totalOperations++
        break
      case 'success':
        this.statistics.successfulOperations++
        this.statistics.strategiesUsed[strategy] = (this.statistics.strategiesUsed[strategy] || 0) + 1
        break
      case 'failure':
        this.statistics.failedOperations++
        break
    }
  }

  /**
   * 更新處理時間統計
   * @param {number} processingTime - 處理時間（毫秒）
   */
  updateProcessingTime (processingTime) {
    this.statistics.totalProcessingTime += processingTime
    this.statistics.averageProcessingTime = this.statistics.totalProcessingTime / Math.max(this.statistics.successfulOperations, 1)
  }

  /**
   * 獲取處理統計資訊
   * @returns {Object} 統計資訊
   */
  getProcessingStatistics () {
    return {
      ...this.statistics,
      successRate: this.statistics.totalOperations > 0
        ? (this.statistics.successfulOperations / this.statistics.totalOperations) * 100
        : 0
    }
  }
}

module.exports = SyncStrategyProcessor