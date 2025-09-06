/**
 * 資料處理服務
 *
 * 負責功能：
 * - 原始資料的處理和正規化
 * - 資料格式轉換和標準化
 * - 資料清理和預處理
 * - 多種資料來源的處理策略
 *
 * 設計考量：
 * - 可擴展的資料處理器架構
 * - 高效能的資料轉換管道
 * - 健壯的錯誤處理和恢復機制
 * - 支援多種資料格式和來源
 *
 * 使用情境：
 * - 處理從 Readmoo 提取的原始書籍資料
 * - 正規化書籍資訊格式
 * - 清理和標準化資料品質
 */

const {
  EXTRACTION_EVENTS,
  EVENT_PRIORITIES
} = require('src/background/constants/module-constants')

class DataProcessingService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false,
      processing: false
    }

    // 資料處理器
    this.dataProcessors = new Map()
    this.processingPipelines = new Map()
    this.processingQueue = []
    this.registeredListeners = new Map()

    // 處理配置
    this.config = {
      maxConcurrentProcessing: 3,
      processingTimeout: 30000,
      retryAttempts: 3,
      enableDataCaching: true,
      dataCacheSize: 100
    }

    // 處理快取
    this.processedDataCache = new Map()
    this.cacheMetadata = new Map()

    // 統計資料
    this.stats = {
      dataProcessed: 0,
      processingErrors: 0,
      cacheHits: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0
    }

    // 初始化資料處理器
    this.initializeDataProcessors()
  }

  /**
   * 初始化資料處理服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('⚠️ 資料處理服務已初始化')
      return
    }

    try {
      this.logger.log('📊 初始化資料處理服務')

      // 初始化處理管道
      await this.initializeProcessingPipelines()

      // 註冊事件監聽器
      await this.registerEventListeners()

      this.state.initialized = true
      this.logger.log('✅ 資料處理服務初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.DATA_PROCESSING.INITIALIZED', {
          serviceName: 'DataProcessingService',
          processorsCount: this.dataProcessors.size
        })
      }
    } catch (error) {
      this.logger.error('❌ 初始化資料處理服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動資料處理服務
   */
  async start () {
    if (!this.state.initialized) {
      throw new Error('服務尚未初始化')
    }

    if (this.state.active) {
      this.logger.warn('⚠️ 資料處理服務已啟動')
      return
    }

    try {
      this.logger.log('🚀 啟動資料處理服務')

      this.state.active = true
      this.state.processing = true

      // 開始處理佇列
      this.startProcessingQueue()

      this.logger.log('✅ 資料處理服務啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.DATA_PROCESSING.STARTED', {
          serviceName: 'DataProcessingService'
        })
      }
    } catch (error) {
      this.logger.error('❌ 啟動資料處理服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止資料處理服務
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('⚠️ 資料處理服務未啟動')
      return
    }

    try {
      this.logger.log('🛑 停止資料處理服務')

      // 停止處理佇列
      this.stopProcessingQueue()

      // 清理快取
      this.clearCache()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      this.state.active = false
      this.state.processing = false

      this.logger.log('✅ 資料處理服務停止完成')

      // 發送停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.DATA_PROCESSING.STOPPED', {
          serviceName: 'DataProcessingService',
          finalStats: { ...this.stats }
        })
      }
    } catch (error) {
      this.logger.error('❌ 停止資料處理服務失敗:', error)
      throw error
    }
  }

  /**
   * 初始化資料處理器
   */
  initializeDataProcessors () {
    // Readmoo 書籍資料處理器
    this.dataProcessors.set('readmoo_books', async (rawData) => {
      this.logger.log('📚 處理 Readmoo 書籍資料')

      if (!rawData || !Array.isArray(rawData.books)) {
        throw new Error('無效的書籍資料格式')
      }

      const processedBooks = []

      for (const book of rawData.books) {
        const processedBook = {
          // 基本資訊
          id: this.cleanString(book.id),
          title: this.cleanString(book.title),
          author: this.cleanString(book.author),
          publisher: this.cleanString(book.publisher),
          category: this.normalizeCategory(book.category),
          tags: this.normalizeTags(book.tags),

          // 閱讀進度
          progress: this.normalizeProgress(book.progress),
          readingStatus: this.normalizeReadingStatus(book.status),
          lastReadAt: this.normalizeDate(book.lastReadAt),

          // 書籍詳情
          description: this.cleanString(book.description),
          isbn: this.cleanString(book.isbn),
          publicationDate: this.normalizeDate(book.publicationDate),
          language: this.normalizeLanguage(book.language),

          // 技術資訊
          format: this.normalizeFormat(book.format),
          fileSize: this.normalizeFileSize(book.fileSize),
          pageCount: this.normalizeNumber(book.pageCount),

          // 購買和價格資訊
          purchaseDate: this.normalizeDate(book.purchaseDate),
          price: this.normalizePrice(book.price),
          currency: this.normalizeCurrency(book.currency),

          // 評分和評論
          rating: this.normalizeRating(book.rating),
          review: this.cleanString(book.review),

          // 元資料
          extractedAt: Date.now(),
          source: 'readmoo',
          version: '1.0'
        }

        processedBooks.push(processedBook)
      }

      return {
        books: processedBooks,
        summary: {
          totalBooks: processedBooks.length,
          categories: this.getCategorySummary(processedBooks),
          readingStatuses: this.getReadingStatusSummary(processedBooks),
          processedAt: Date.now()
        }
      }
    })

    // 閱讀進度資料處理器
    this.dataProcessors.set('reading_progress', async (rawData) => {
      this.logger.log('📖 處理閱讀進度資料')

      return {
        progressRecords: rawData.map(record => ({
          bookId: this.cleanString(record.bookId),
          progress: this.normalizeProgress(record.progress),
          readingTime: this.normalizeNumber(record.readingTime),
          lastPosition: this.cleanString(record.lastPosition),
          updatedAt: this.normalizeDate(record.updatedAt)
        })),
        processedAt: Date.now()
      }
    })

    // 書籍元資料處理器
    this.dataProcessors.set('book_metadata', async (rawData) => {
      this.logger.log('📋 處理書籍元資料')

      return {
        metadata: {
          totalCount: this.normalizeNumber(rawData.totalCount),
          lastSync: this.normalizeDate(rawData.lastSync),
          dataVersion: this.cleanString(rawData.version),
          source: this.cleanString(rawData.source)
        },
        processedAt: Date.now()
      }
    })

    this.logger.log(`✅ 初始化了 ${this.dataProcessors.size} 個資料處理器`)
  }

  /**
   * 初始化處理管道
   */
  async initializeProcessingPipelines () {
    // 標準書籍處理管道
    this.processingPipelines.set('standard_book_processing', [
      'validate_input',
      'normalize_data',
      'clean_data',
      'enrich_data',
      'validate_output'
    ])

    // 快速處理管道（用於即時處理）
    this.processingPipelines.set('fast_processing', [
      'basic_validation',
      'normalize_data',
      'basic_cleaning'
    ])

    // 完整處理管道（用於批量處理）
    this.processingPipelines.set('complete_processing', [
      'validate_input',
      'normalize_data',
      'deep_clean_data',
      'enrich_data',
      'quality_check',
      'validate_output'
    ])

    this.logger.log(`✅ 初始化了 ${this.processingPipelines.size} 個處理管道`)
  }

  /**
   * 處理資料
   */
  async processData (dataType, rawData, options = {}) {
    const startTime = Date.now()

    try {
      this.logger.log(`🔄 開始處理資料類型: ${dataType}`)

      // 檢查快取
      if (this.config.enableDataCaching) {
        const cached = this.getCachedData(dataType, rawData)
        if (cached) {
          this.stats.cacheHits++
          this.logger.log(`💾 使用快取資料: ${dataType}`)
          return cached
        }
      }

      // 選擇處理器
      const processor = this.dataProcessors.get(dataType)
      if (!processor) {
        throw new Error(`未找到資料處理器: ${dataType}`)
      }

      // 選擇處理管道
      const pipelineName = options.pipeline || 'standard_book_processing'
      const pipeline = this.processingPipelines.get(pipelineName)

      if (pipeline) {
        // 使用管道處理
        const processedData = await this.processThroughPipeline(processor, rawData, pipeline)

        // 快取結果
        if (this.config.enableDataCaching) {
          this.setCachedData(dataType, rawData, processedData)
        }

        // 更新統計
        const processingTime = Date.now() - startTime
        this.updateProcessingStats(processingTime)

        this.logger.log(`✅ 資料處理完成: ${dataType} (${processingTime}ms)`)

        // 發送處理完成事件
        if (this.eventBus) {
          await this.eventBus.emit('EXTRACTION.DATA.PROCESSED', {
            dataType,
            processingTime,
            recordCount: this.getRecordCount(processedData)
          })
        }

        return processedData
      } else {
        // 直接處理
        const processedData = await processor(rawData)

        // 快取結果
        if (this.config.enableDataCaching) {
          this.setCachedData(dataType, rawData, processedData)
        }

        // 更新統計
        const processingTime = Date.now() - startTime
        this.updateProcessingStats(processingTime)

        return processedData
      }
    } catch (error) {
      this.stats.processingErrors++
      this.logger.error(`❌ 資料處理失敗: ${dataType}`, error)

      // 發送處理錯誤事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.DATA.PROCESSING_ERROR', {
          dataType,
          error: error.message,
          processingTime: Date.now() - startTime
        })
      }

      throw error
    }
  }

  /**
   * 透過管道處理資料
   */
  async processThroughPipeline (processor, rawData, pipeline) {
    let data = rawData

    for (const step of pipeline) {
      switch (step) {
        case 'validate_input':
          this.validateInput(data)
          break
        case 'basic_validation':
          this.basicValidation(data)
          break
        case 'normalize_data':
          data = await processor(data)
          break
        case 'clean_data':
        case 'basic_cleaning':
          data = this.cleanData(data)
          break
        case 'deep_clean_data':
          data = this.deepCleanData(data)
          break
        case 'enrich_data':
          data = this.enrichData(data)
          break
        case 'quality_check':
          this.performQualityCheck(data)
          break
        case 'validate_output':
          this.validateOutput(data)
          break
      }
    }

    return data
  }

  /**
   * 批量處理資料
   */
  async batchProcessData (dataItems, options = {}) {
    const results = []
    const batchSize = options.batchSize || this.config.maxConcurrentProcessing

    for (let i = 0; i < dataItems.length; i += batchSize) {
      const batch = dataItems.slice(i, i + batchSize)
      const batchPromises = batch.map(item =>
        this.processData(item.type, item.data, item.options)
      )

      try {
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
      } catch (error) {
        this.logger.error('❌ 批量處理失敗:', error)
        throw error
      }
    }

    return results
  }

  /**
   * 開始處理佇列
   */
  startProcessingQueue () {
    // 實現處理佇列邏輯
    this.logger.log('🎯 處理佇列已啟動')
  }

  /**
   * 停止處理佇列
   */
  stopProcessingQueue () {
    // 實現停止處理佇列邏輯
    this.logger.log('⏹️ 處理佇列已停止')
  }

  /**
   * 資料清理方法
   */
  cleanString (str) {
    if (!str || typeof str !== 'string') return ''
    return str.trim().replace(/\s+/g, ' ')
  }

  cleanData (data) {
    // 基本資料清理
    return data
  }

  deepCleanData (data) {
    // 深度資料清理
    return data
  }

  enrichData (data) {
    // 資料豐富化
    return data
  }

  /**
   * 正規化方法
   */
  normalizeCategory (category) {
    if (!category) return '未分類'
    return this.cleanString(category)
  }

  normalizeTags (tags) {
    if (!Array.isArray(tags)) return ['readmoo']
    return tags.map(tag => this.cleanString(tag)).filter(tag => tag.length > 0)
  }

  normalizeProgress (progress) {
    const num = parseFloat(progress)
    return isNaN(num) ? 0 : Math.max(0, Math.min(100, num))
  }

  normalizeReadingStatus (status) {
    const statusMap = {
      reading: '閱讀中',
      completed: '已完成',
      not_started: '未開始',
      paused: '暫停'
    }
    return statusMap[status] || '未知'
  }

  normalizeDate (date) {
    if (!date) return null
    const d = new Date(date)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  normalizeLanguage (language) {
    const langMap = {
      'zh-TW': '繁體中文',
      'zh-CN': '簡體中文',
      en: '英文',
      ja: '日文'
    }
    return langMap[language] || language || '未知'
  }

  normalizeFormat (format) {
    const formatMap = {
      epub: 'EPUB',
      pdf: 'PDF',
      mobi: 'MOBI'
    }
    return formatMap[format] || format || '未知'
  }

  normalizeFileSize (size) {
    const num = parseInt(size)
    return isNaN(num) ? 0 : num
  }

  normalizeNumber (num) {
    const parsed = parseFloat(num)
    return isNaN(parsed) ? 0 : parsed
  }

  normalizePrice (price) {
    const num = parseFloat(price)
    return isNaN(num) ? 0 : num
  }

  normalizeCurrency (currency) {
    return currency || 'TWD'
  }

  normalizeRating (rating) {
    const num = parseFloat(rating)
    return isNaN(num) ? 0 : Math.max(0, Math.min(5, num))
  }

  /**
   * 驗證方法
   */
  validateInput (data) {
    if (!data) throw new Error('輸入資料不能為空')
  }

  basicValidation (data) {
    this.validateInput(data)
  }

  validateOutput (data) {
    if (!data) throw new Error('輸出資料不能為空')
  }

  performQualityCheck (data) {
    // 執行品質檢查
  }

  /**
   * 快取管理
   */
  getCachedData (dataType, rawData) {
    const cacheKey = this.generateCacheKey(dataType, rawData)
    const cached = this.processedDataCache.get(cacheKey)

    if (cached) {
      const metadata = this.cacheMetadata.get(cacheKey)
      if (metadata && Date.now() - metadata.timestamp < metadata.ttl) {
        return cached
      } else {
        this.processedDataCache.delete(cacheKey)
        this.cacheMetadata.delete(cacheKey)
      }
    }

    return null
  }

  setCachedData (dataType, rawData, processedData) {
    const cacheKey = this.generateCacheKey(dataType, rawData)

    this.processedDataCache.set(cacheKey, processedData)
    this.cacheMetadata.set(cacheKey, {
      timestamp: Date.now(),
      ttl: 300000 // 5分鐘
    })

    // 限制快取大小
    if (this.processedDataCache.size > this.config.dataCacheSize) {
      const firstKey = this.processedDataCache.keys().next().value
      this.processedDataCache.delete(firstKey)
      this.cacheMetadata.delete(firstKey)
    }
  }

  generateCacheKey (dataType, rawData) {
    return `${dataType}_${JSON.stringify(rawData).slice(0, 100)}`
  }

  clearCache () {
    this.processedDataCache.clear()
    this.cacheMetadata.clear()
    this.logger.log('🧹 處理快取已清理')
  }

  /**
   * 統計方法
   */
  updateProcessingStats (processingTime) {
    this.stats.dataProcessed++
    this.stats.totalProcessingTime += processingTime
    this.stats.averageProcessingTime = this.stats.totalProcessingTime / this.stats.dataProcessed
  }

  getCategorySummary (books) {
    const categories = {}
    books.forEach(book => {
      const category = book.category || '未分類'
      categories[category] = (categories[category] || 0) + 1
    })
    return categories
  }

  getReadingStatusSummary (books) {
    const statuses = {}
    books.forEach(book => {
      const status = book.readingStatus || '未知'
      statuses[status] = (statuses[status] || 0) + 1
    })
    return statuses
  }

  getRecordCount (data) {
    if (data.books) return data.books.length
    if (data.progressRecords) return data.progressRecords.length
    return 1
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners () {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 不可用，跳過事件監聽器註冊')
      return
    }

    const listeners = [
      {
        event: EXTRACTION_EVENTS.DATA_PROCESSING_REQUEST,
        handler: this.handleDataProcessingRequest.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      },
      {
        event: EXTRACTION_EVENTS.BATCH_PROCESSING_REQUEST,
        handler: this.handleBatchProcessingRequest.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      }
    ]

    for (const { event, handler, priority } of listeners) {
      const listenerId = await this.eventBus.on(event, handler, { priority })
      this.registeredListeners.set(event, listenerId)
    }

    this.logger.log(`✅ 註冊了 ${listeners.length} 個事件監聽器`)
  }

  /**
   * 取消註冊事件監聽器
   */
  async unregisterEventListeners () {
    if (!this.eventBus) return

    for (const [event, listenerId] of this.registeredListeners) {
      try {
        await this.eventBus.off(event, listenerId)
      } catch (error) {
        this.logger.error(`❌ 取消註冊事件監聽器失敗 (${event}):`, error)
      }
    }

    this.registeredListeners.clear()
    this.logger.log('✅ 所有事件監聽器已取消註冊')
  }

  /**
   * 處理資料處理請求
   */
  async handleDataProcessingRequest (event) {
    try {
      const { dataType, rawData, options, requestId } = event.data || {}

      const result = await this.processData(dataType, rawData, options)

      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.DATA_PROCESSING.RESULT', {
          requestId,
          result
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理資料處理請求失敗:', error)
    }
  }

  /**
   * 處理批量處理請求
   */
  async handleBatchProcessingRequest (event) {
    try {
      const { dataItems, options, requestId } = event.data || {}

      const results = await this.batchProcessData(dataItems, options)

      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.BATCH_PROCESSING.RESULT', {
          requestId,
          results
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理批量處理請求失敗:', error)
    }
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      processing: this.state.processing,
      config: this.config,
      processorsCount: this.dataProcessors.size,
      pipelinesCount: this.processingPipelines.size,
      cacheSize: this.processedDataCache.size,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const errorRate = this.stats.dataProcessed > 0
      ? (this.stats.processingErrors / this.stats.dataProcessed)
      : 0

    const isHealthy = this.state.initialized &&
                     errorRate < 0.1 && // 錯誤率低於10%
                     this.stats.averageProcessingTime < 10000 // 平均處理時間低於10秒

    return {
      service: 'DataProcessingService',
      healthy: isHealthy,
      status: this.state.active ? 'active' : 'inactive',
      processing: this.state.processing,
      metrics: {
        dataProcessed: this.stats.dataProcessed,
        processingErrors: this.stats.processingErrors,
        cacheHits: this.stats.cacheHits,
        averageProcessingTime: this.stats.averageProcessingTime,
        errorRate: (errorRate * 100).toFixed(2) + '%',
        cacheHitRate: this.stats.dataProcessed > 0
          ? (this.stats.cacheHits / this.stats.dataProcessed * 100).toFixed(2) + '%'
          : '0%'
      }
    }
  }
}

module.exports = DataProcessingService
