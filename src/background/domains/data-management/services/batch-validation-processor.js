/**
 * @fileoverview Batch Validation Processor - 批次驗證處理服務
 * @version v0.9.21
 * @since 2025-08-21
 *
 * 從 DataValidationService 提取的批次驗證處理邏輯
 *
 * 負責功能：
 * - 大量資料批次分割和處理
 * - 單本書籍驗證邏輯執行
 * - 批次處理進度追蹤和事件發送
 * - 記憶體管理和效能優化
 *
 * 設計原則：
 * - 單一職責：專注於批次驗證處理流程
 * - 效能優化：合理的批次大小和記憶體管理
 * - 事件驅動：進度追蹤和狀態回報
 * - 可擴展性：支援不同平台的驗證規則
 */

const BaseModule = require('src/background/lifecycle/base-module')
const { StandardError } = require('src/core/errors/StandardError')

class BatchValidationProcessor extends BaseModule {
  /**
   * 初始化批次驗證處理服務
   * @param {EventBus} eventBus - 事件總線實例
   * @param {Object} dependencies - 依賴注入物件
   */
  constructor (eventBus, dependencies = {}) {
    if (!eventBus) {
      throw new StandardError('REQUIRED_FIELD_MISSING', 'EventBus is required', {
          "category": "validation"
      })
    }

    if (!dependencies.validationRuleManager) {
      throw new StandardError('REQUIRED_FIELD_MISSING', 'ValidationRuleManager is required', {
          "category": "validation"
      })
    }

    super({
      eventBus,
      logger: dependencies.logger || console,
      config: dependencies.config || {}
    })

    this.eventBus = eventBus
    this.logger = dependencies.logger || console
    this.validationRuleManager = dependencies.validationRuleManager

    // 合併預設配置
    this.config = this.mergeWithDefaults(dependencies.config || {})

    // 批次處理統計
    this.batchStatistics = {
      totalProcessed: 0,
      batchCount: 0,
      averageBatchSize: 0,
      lastProcessTime: null
    }
  }

  /**
   * 合併預設配置
   */
  mergeWithDefaults (userConfig) {
    const defaults = {
      batchSize: 100,
      maxBatchSize: 1000,
      gcAfterBatch: true,
      validationTimeout: 5000
    }

    return {
      ...defaults,
      ...userConfig
    }
  }

  /**
   * 分割書籍資料為批次
   * @param {Array} books - 書籍陣列
   * @returns {Array} 批次陣列
   */
  splitIntoBatches (books) {
    if (!books || books.length === 0) {
      return []
    }

    const batchSize = Math.min(this.config.batchSize, this.config.maxBatchSize)
    const batches = []

    for (let i = 0; i < books.length; i += batchSize) {
      batches.push(books.slice(i, i + batchSize))
    }

    return batches
  }

  /**
   * 驗證單本書籍
   * @param {Object} book - 書籍資料
   * @param {string} platform - 平台名稱
   * @returns {Object} 驗證結果
   */
  async validateSingleBook (book, platform) {
    const validation = this.createValidationContext(book)
    if (this.isBookNull(book)) return this.handleNullBook(validation)
    const rules = this.fetchValidationRules(platform, validation)
    if (!rules) return validation
    return await this.executeAllValidations(validation, rules)
  }

  /**
   * 建立驗證上下文
   */
  createValidationContext (book) {
    return {
      book,
      isValid: true,
      errors: [],
      warnings: []
    }
  }

  /**
   * 檢查書籍是否為空
   */
  isBookNull (book) {
    return book === null || book === undefined
  }

  /**
   * 處理空書籍情況
   */
  handleNullBook (validation) {
    validation.isValid = false
    this.addValidationError(validation, 'NULL_BOOK_DATA', '書籍資料為空')
    return validation
  }

  /**
   * 獲取驗證規則
   */
  fetchValidationRules (platform, validation) {
    const rules = this.validationRuleManager.getValidationRules(platform)
    if (!rules) {
      validation.isValid = false
      this.addValidationError(validation, 'VALIDATION_RULES_UNAVAILABLE', `無法取得 ${platform} 平台的驗證規則`)
    }
    return rules
  }

  /**
   * 執行所有驗證邏輯
   */
  async executeAllValidations (validation, rules) {
    try {
      await this.validateRequiredFields(validation, rules)
      await this.validateDataTypes(validation, rules)
      await this.validateBusinessRules(validation, rules)
      return validation
    } catch (error) {
      return this.handleValidationError(validation, error)
    }
  }

  /**
   * 處理驗證過程錯誤
   */
  handleValidationError (validation, error) {
    validation.isValid = false
    this.addValidationError(validation, 'VALIDATION_ERROR', `驗證過程中發生錯誤: ${error.message}`)
    return validation
  }

  /**
   * 新增驗證錯誤
   */
  addValidationError (validation, type, message) {
    validation.errors.push({ type, message })
  }

  /**
   * 處理單個批次
   * @param {Array} batch - 批次資料
   * @param {string} platform - 平台名稱
   * @param {string} source - 資料來源
   * @param {number} batchIndex - 批次索引
   * @param {number} totalBatches - 總批次數
   * @returns {Object} 批次處理結果
   */
  async processBatch (batch, platform, source, batchIndex, totalBatches) {
    const results = this.initializeBatchResults()
    await this.processBatchBooks(batch, platform, results)
    this.performBatchMemoryManagement(batchIndex, results.warnings)
    return results
  }

  /**
   * 初始化批次結果
   */
  initializeBatchResults () {
    return {
      validBooks: [],
      invalidBooks: [],
      warnings: [],
      normalizedBooks: []
    }
  }

  /**
   * 處理批次中的所有書籍
   */
  async processBatchBooks (batch, platform, results) {
    for (const book of batch) {
      await this.processSingleBookInBatch(book, platform, results)
    }
  }

  /**
   * 處理批次中的單本書籍
   */
  async processSingleBookInBatch (book, platform, results) {
    try {
      const validation = await this.validateSingleBook(book, platform)
      this.collectBookValidationResult(validation, results)
    } catch (error) {
      this.handleBookValidationError(book, error, results)
    }
  }

  /**
   * 收集書籍驗證結果
   */
  collectBookValidationResult (validation, results) {
    if (validation.isValid) {
      this.addValidBook(validation.book, results)
    } else {
      this.addInvalidBook(validation, results)
    }
    this.mergeValidationWarnings(validation, results)
  }

  /**
   * 新增有效書籍
   */
  addValidBook (book, results) {
    results.validBooks.push(book)
    results.normalizedBooks.push(book)
  }

  /**
   * 新增無效書籍
   */
  addInvalidBook (validation, results) {
    results.invalidBooks.push({
      book: validation.book,
      errors: validation.errors
    })
  }

  /**
   * 合併驗證警告
   */
  mergeValidationWarnings (validation, results) {
    if (validation.warnings && validation.warnings.length > 0) {
      results.warnings.push(...validation.warnings)
    }
  }

  /**
   * 處理書籍驗證錯誤
   */
  handleBookValidationError (book, error, results) {
    results.invalidBooks.push({
      book,
      errors: [{
        type: 'VALIDATION_ERROR',
        message: `驗證過程中發生錯誤: ${error.message}`
      }]
    })
  }

  /**
   * 執行批次記憶體管理
   */
  performBatchMemoryManagement (batchIndex, warnings) {
    if (this.shouldTriggerGarbageCollection(batchIndex)) {
      this.triggerGarbageCollection(warnings, batchIndex)
    }
  }

  /**
   * 是否應該觸發垃圾回收
   */
  shouldTriggerGarbageCollection (batchIndex) {
    return this.config.gcAfterBatch && batchIndex % 10 === 9
  }

  /**
   * 觸發垃圾回收
   */
  triggerGarbageCollection (warnings, batchIndex) {
    if (global.gc) {
      global.gc()
      warnings.push({
        type: 'MEMORY_MANAGEMENT_INFO',
        message: '已執行垃圾回收',
        batchIndex
      })
    }
  }

  /**
   * 處理多個批次
   * @param {Array} books - 所有書籍資料
   * @param {string} platform - 平台名稱
   * @param {string} source - 資料來源
   * @param {string} validationId - 驗證ID
   * @returns {Object} 完整處理結果
   */
  async processBatches (books, platform, source, validationId) {
    const batches = this.splitIntoBatches(books)
    const allResults = this.initializeAllBatchesResults()
    await this.processAllBatches(batches, platform, source, validationId, books.length, allResults)
    this.finalizeBatchesProcessing(books.length, batches.length, allResults)
    return this.createFinalResults(allResults, batches)
  }

  /**
   * 初始化所有批次結果
   */
  initializeAllBatchesResults () {
    return {
      allValidBooks: [],
      allInvalidBooks: [],
      allWarnings: [],
      allNormalizedBooks: []
    }
  }

  /**
   * 處理所有批次
   */
  async processAllBatches (batches, platform, source, validationId, totalBooks, allResults) {
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      await this.processSingleBatchInSequence(batches, batchIndex, platform, source, validationId, totalBooks, allResults)
    }
  }

  /**
   * 順序處理單個批次
   */
  async processSingleBatchInSequence (batches, batchIndex, platform, source, validationId, totalBooks, allResults) {
    const batch = batches[batchIndex]
    const batchResult = await this.processBatch(batch, platform, source, batchIndex, batches.length)
    this.mergeBatchResult(batchResult, allResults)
    await this.emitProgressEventIfNeeded(batches, batchIndex, validationId, platform, totalBooks)
  }

  /**
   * 合併批次結果
   */
  mergeBatchResult (batchResult, allResults) {
    allResults.allValidBooks = allResults.allValidBooks.concat(batchResult.validBooks)
    allResults.allInvalidBooks = allResults.allInvalidBooks.concat(batchResult.invalidBooks)
    allResults.allWarnings = allResults.allWarnings.concat(batchResult.warnings)
    allResults.allNormalizedBooks = allResults.allNormalizedBooks.concat(batchResult.normalizedBooks)
  }

  /**
   * 如有必要發送進度事件
   */
  async emitProgressEventIfNeeded (batches, batchIndex, validationId, platform, totalBooks) {
    if (batches.length > 1) {
      await this.emitProgressEvent(validationId, platform, batchIndex, batches.length, totalBooks)
    }
  }

  /**
   * 發送進度事件
   */
  async emitProgressEvent (validationId, platform, batchIndex, totalBatches, totalBooks) {
    await this.eventBus.emit('DATA.VALIDATION.PROGRESS', {
      validationId,
      platform,
      processed: (batchIndex + 1) * this.config.batchSize,
      total: totalBooks,
      percentage: Math.round(((batchIndex + 1) / totalBatches) * 100)
    })
  }

  /**
   * 完成批次處理
   */
  finalizeBatchesProcessing (totalBooks, totalBatches, allResults) {
    this.updateStatistics(totalBooks, totalBatches)
  }

  /**
   * 建立最終結果
   */
  createFinalResults (allResults, batches) {
    return {
      validBooks: allResults.allValidBooks,
      invalidBooks: allResults.allInvalidBooks,
      warnings: allResults.allWarnings,
      normalizedBooks: allResults.allNormalizedBooks,
      allBatches: batches
    }
  }

  /**
   * 驗證必填欄位
   */
  async validateRequiredFields (validation, rules) {
    const required = rules.requiredFields || []
    for (const field of required) {
      this.validateSingleRequiredField(validation, field)
    }
  }

  /**
   * 驗證單一必填欄位
   */
  validateSingleRequiredField (validation, field) {
    const value = validation.book[field]
    if (this.isFieldEmpty(value)) {
      this.markValidationFailed(validation)
      this.addRequiredFieldError(validation, field)
    }
  }

  /**
   * 檢查欄位是否為空
   */
  isFieldEmpty (value) {
    return value === undefined || value === null || value === ''
  }

  /**
   * 標記驗證失敗
   */
  markValidationFailed (validation) {
    validation.isValid = false
  }

  /**
   * 新增必填欄位錯誤
   */
  addRequiredFieldError (validation, field) {
    validation.errors.push({
      type: 'MISSING_REQUIRED_FIELD',
      field,
      message: `缺少必填欄位: ${field}`
    })
  }

  /**
   * 驗證資料類型
   */
  async validateDataTypes (validation, rules) {
    const types = rules.dataTypes || {}
    for (const [field, expectedType] of Object.entries(types)) {
      this.validateSingleFieldType(validation, field, expectedType)
    }
  }

  /**
   * 驗證單一欄位類型
   */
  validateSingleFieldType (validation, field, expectedType) {
    const value = validation.book[field]
    if (value === undefined || value === null) return
    if (this.isAuthorsField(field, expectedType)) {
      this.validateAuthorsField(validation, field, value)
    } else {
      this.validateRegularFieldType(validation, field, expectedType, value)
    }
  }

  /**
   * 是否為 authors 欄位
   */
  isAuthorsField (field, expectedType) {
    return field === 'authors' && expectedType === 'array'
  }

  /**
   * 驗證 authors 欄位
   */
  validateAuthorsField (validation, field, value) {
    if (!Array.isArray(value)) {
      this.addDataTypeError(validation, field, 'array', typeof value)
      return
    }
    if (!this.areValidAuthors(value)) {
      this.addInvalidAuthorsError(validation, field, value)
    }
  }

  /**
   * 檢查 authors 陣列是否有效
   */
  areValidAuthors (authors) {
    return authors.every(author =>
      typeof author === 'string' || (typeof author === 'object' && author.name)
    )
  }

  /**
   * 驗證一般欄位類型
   */
  validateRegularFieldType (validation, field, expectedType, value) {
    if (!this.isCorrectType(value, expectedType)) {
      this.addDataTypeError(validation, field, expectedType, typeof value)
    }
  }

  /**
   * 新增資料類型錯誤
   */
  addDataTypeError (validation, field, expectedType, actualType) {
    this.markValidationFailed(validation)
    validation.errors.push({
      type: 'INVALID_DATA_TYPE',
      field,
      expectedType,
      actualType,
      message: `${field} 欄位類型錯誤，預期: ${expectedType}`
    })
  }

  /**
   * 新增無效 authors 錯誤
   */
  addInvalidAuthorsError (validation, field, value) {
    this.markValidationFailed(validation)
    validation.errors.push({
      type: 'INVALID_DATA_TYPE',
      field,
      expectedType: 'array of strings or objects with name property',
      actualType: typeof value,
      message: `${field} 欄位格式錯誤`
    })
  }

  /**
   * 驗證商業規則
   */
  async validateBusinessRules (validation, rules) {
    const business = rules.businessRules || {}
    this.validateProgressRange(validation, business)
    this.validateRatingRange(validation, business)
  }

  /**
   * 驗證進度範圍
   */
  validateProgressRange (validation, business) {
    if (!business.progressRange) return
    if (validation.book.progress === undefined) return
    this.validateFieldRange(validation, 'progress', validation.book.progress, business.progressRange)
  }

  /**
   * 驗證評分範圍
   */
  validateRatingRange (validation, business) {
    if (!business.ratingRange) return
    if (validation.book.rating === undefined) return
    this.validateFieldRange(validation, 'rating', validation.book.rating, business.ratingRange)
  }

  /**
   * 驗證欄位範圍
   */
  validateFieldRange (validation, fieldName, value, range) {
    const { min, max } = range
    if (value < min || value > max) {
      this.addBusinessRuleError(validation, fieldName, value, min, max)
    }
  }

  /**
   * 新增商業規則錯誤
   */
  addBusinessRuleError (validation, field, value, min, max) {
    this.markValidationFailed(validation)
    validation.errors.push({
      type: 'BUSINESS_RULE_VIOLATION',
      field,
      message: `${this.getFieldDisplayName(field)}值 ${value} 超出範圍 [${min}, ${max}]`
    })
  }

  /**
   * 獲取欄位顯示名稱
   */
  getFieldDisplayName (field) {
    const displayNames = {
      progress: '進度',
      rating: '評分'
    }
    return displayNames[field] || field
  }

  /**
   * 檢查資料類型
   * @param {*} value - 值
   * @param {string} expectedType - 預期類型
   * @returns {boolean} 是否正確類型
   */
  isCorrectType (value, expectedType) {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number' && !isNaN(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'array':
        return Array.isArray(value)
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value)
      default:
        return true
    }
  }

  /**
   * 生成批次ID
   * @returns {string} 批次ID
   */
  generateBatchId () {
    return `batch_${Date.now()}_${Math.random().toString(36).substring(2)}`
  }

  /**
   * 更新統計數據
   */
  updateStatistics (totalBooks, batchCount) {
    this.batchStatistics.totalProcessed += totalBooks
    this.batchStatistics.batchCount += batchCount
    this.batchStatistics.averageBatchSize = Math.round(
      this.batchStatistics.totalProcessed / this.batchStatistics.batchCount
    )
    this.batchStatistics.lastProcessTime = Date.now()
  }

  /**
   * 獲取批次處理統計
   * @returns {Object} 統計資訊
   */
  getBatchStatistics () {
    return {
      totalProcessed: this.batchStatistics.totalProcessed,
      batchCount: this.batchStatistics.batchCount,
      averageBatchSize: this.batchStatistics.averageBatchSize,
      lastProcessTime: this.batchStatistics.lastProcessTime
    }
  }

  /**
   * 重置統計數據
   */
  resetStatistics () {
    this.batchStatistics = {
      totalProcessed: 0,
      batchCount: 0,
      averageBatchSize: 0,
      lastProcessTime: null
    }
  }

  /**
   * 檢查服務健康狀態
   * @returns {Object} 健康狀態
   */
  isBatchProcessorHealthy () {
    const memoryUsage = process.memoryUsage()

    return {
      isHealthy: memoryUsage.heapUsed < 500 * 1024 * 1024, // 500MB 限制
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      },
      batchStatistics: this.batchStatistics,
      lastCheck: Date.now()
    }
  }
}

module.exports = BatchValidationProcessor
