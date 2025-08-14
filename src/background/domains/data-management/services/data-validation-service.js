/**
 * Data Validation Service v2.0
 * TDD Green Phase - 實作功能讓測試通過
 * 
 * 負責功能：
 * - 統一書籍資料格式驗證與標準化
 * - 跨平台資料品質檢測和修復
 * - 自動資料清理和修復
 * - 資料完整性驗證與錯誤回報
 * 
 * 設計考量：
 * - 支援 5 個平台的資料格式驗證
 * - 事件驅動架構 v2.0 整合
 * - 統一資料模型 v2.0 輸出格式
 * - 效能優化的批次處理
 * 
 * 處理流程：
 * 1. 初始化驗證規則和平台架構
 * 2. 接收驗證請求並開始批次處理
 * 3. 對每本書執行完整的驗證流程
 * 4. 生成標準化資料和驗證報告
 * 5. 發送事件通知和結果回傳
 * 
 * 使用情境：
 * - 資料提取完成後的驗證標準化
 * - 跨平台資料同步前的品質保證
 * - 使用者手動觸發的資料驗證
 * - 系統定期的資料品質檢查
 */

const crypto = require('crypto')

class DataValidationService {
  constructor(eventBus, config = {}) {
    // 驗證必要依賴
    if (!eventBus) {
      throw new Error('EventBus is required')
    }

    this.eventBus = eventBus
    this.serviceName = 'DataValidationService'
    
    // 合併預設配置
    this.config = {
      autoFix: true,
      strictMode: false,
      batchSize: 100,
      maxBatchSize: 1000,
      validationTimeout: 5000,
      supportedPlatforms: ['READMOO', 'KINDLE', 'KOBO', 'BOOKWALKER', 'BOOKS_COM'],
      qualityThresholds: {
        high: 90,
        medium: 70,
        low: 50
      },
      // 效能相關配置
      concurrentBatches: 1,
      parallelProcessing: false,
      memoryOptimization: false,
      progressReporting: false,
      streamProcessing: false,
      streamBatchSize: 50,
      memoryThreshold: 100 * 1024 * 1024, // 100MB
      gcAfterBatch: false,
      enableCache: false,
      cacheSize: 100,
      cacheTTL: 300000, // 5分鐘
      ...config
    }

    // 核心組件初始化
    this.validationRules = new Map()
    this.platformSchemas = new Map()
    this.dataQualityMetrics = new Map()
    this.isInitialized = false

    // 快取系統（如果啟用）
    if (this.config.enableCache) {
      this.validationCache = new Map()
      this.cacheTimestamps = new Map()
    }
  }

  /**
   * 初始化服務
   * 載入驗證規則、註冊事件監聽器
   */
  async initialize() {
    try {
      // 載入預設驗證規則
      await this._loadDefaultValidationRules()

      // 載入所有支援平台的驗證規則
      for (const platform of this.config.supportedPlatforms) {
        await this.loadPlatformValidationRules(platform)
      }

      // 註冊事件監聽器
      this._registerEventListeners()

      this.isInitialized = true
    } catch (error) {
      throw new Error(`初始化失敗: ${error.message}`)
    }
  }

  /**
   * 載入平台特定驗證規則
   */
  async loadPlatformValidationRules(platform) {
    if (!this.config.supportedPlatforms.includes(platform)) {
      throw new Error(`不支援的平台: ${platform}`)
    }

    // 檢查快取
    if (this.validationRules.has(platform)) {
      return // 已載入
    }

    try {
      await this.loadRulesForPlatform(platform)
    } catch (error) {
      throw new Error(`載入驗證規則失敗: ${error.message}`)
    }
  }

  /**
   * 為特定平台載入驗證規則
   */
  async loadRulesForPlatform(platform) {
    const platformRules = this._getPlatformSpecificRules(platform)
    this.validationRules.set(platform, platformRules)
    
    // 同時設置平台schema
    const platformSchema = this._getPlatformSchema(platform)
    this.platformSchemas.set(platform, platformSchema)
  }

  /**
   * 主要驗證和標準化方法
   */
  async validateAndNormalize(books, platform, source) {
    // 輸入驗證
    this._validateInputs(books, platform, source)

    const validationId = this._generateValidationId()
    const startTime = Date.now()

    // 發送驗證開始事件
    await this.eventBus.emit('DATA.VALIDATION.STARTED', {
      validationId,
      platform,
      source,
      bookCount: books.length,
      timestamp: new Date().toISOString()
    })

    try {
      // 處理大批次分割
      const batches = this._splitIntoBatches(books)
      let allValidBooks = []
      let allInvalidBooks = []
      let allWarnings = []
      let allNormalizedBooks = []

      // 處理每個批次
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        
        // 驗證單個批次
        const batchResult = await this._processBatch(batch, platform, source, batchIndex, batches.length)
        
        allValidBooks = allValidBooks.concat(batchResult.validBooks)
        allInvalidBooks = allInvalidBooks.concat(batchResult.invalidBooks)
        allWarnings = allWarnings.concat(batchResult.warnings)
        allNormalizedBooks = allNormalizedBooks.concat(batchResult.normalizedBooks)

        // 發送進度事件
        if (batches.length > 1) {
          await this.eventBus.emit('DATA.VALIDATION.PROGRESS', {
            validationId,
            platform,
            processed: (batchIndex + 1) * this.config.batchSize,
            total: books.length,
            percentage: Math.round(((batchIndex + 1) / batches.length) * 100)
          })
        }
      }

      // 計算品質分數
      const report = {
        totalBooks: books.length,
        validBooks: allValidBooks,
        invalidBooks: allInvalidBooks,
        warnings: allWarnings
      }

      // 檢查大批次處理警告
      if (books.length > 10000) {
        allWarnings.push({
          type: 'PERFORMANCE_WARNING',
          message: '大量資料處理，建議分批進行',
          bookCount: books.length
        })
      }

      if (batches.length > 1) {
        allWarnings.push({
          type: 'BATCH_SPLIT_INFO',
          message: `資料已分為 ${batches.length} 個批次處理`,
          batchCount: batches.length
        })
      }

      const qualityScore = this.calculateQualityScore(report)
      const endTime = Date.now()

      const result = {
        validationId,
        platform,
        source,
        totalBooks: books.length,
        validBooks: allValidBooks,
        invalidBooks: allInvalidBooks,
        warnings: allWarnings,
        normalizedBooks: allNormalizedBooks,
        qualityScore,
        startTime: Number(startTime),
        endTime: Number(endTime),
        duration: Number(endTime - startTime)
      }

      // 效能資訊
      if (this.config.progressReporting) {
        result.performance = {
          booksPerSecond: Math.round(books.length / ((endTime - startTime) / 1000)),
          averageTimePerBook: Math.round((endTime - startTime) / books.length),
          memoryUsage: process.memoryUsage().heapUsed
        }
      }

      // 發送驗證完成事件
      await this.eventBus.emit('DATA.VALIDATION.COMPLETED', {
        validationId,
        platform,
        source,
        qualityScore,
        validCount: allValidBooks.length,
        invalidCount: allInvalidBooks.length,
        normalizedBooks: allNormalizedBooks,
        duration: endTime - startTime,
        timestamp: new Date().toISOString()
      })

      // 發送資料給同步領域
      await this.eventBus.emit('DATA.READY_FOR_SYNC', {
        platform,
        normalizedBooks: allNormalizedBooks,
        validationId,
        timestamp: new Date().toISOString()
      })

      return result

    } catch (error) {
      // 發送驗證失敗事件
      await this.eventBus.emit('DATA.VALIDATION.FAILED', {
        validationId,
        platform,
        source,
        error: error.message,
        timestamp: new Date().toISOString()
      })
      throw error
    }
  }

  /**
   * 處理單個批次
   */
  async _processBatch(batch, platform, source, batchIndex, totalBatches) {
    const validBooks = []
    const invalidBooks = []
    const warnings = []
    const normalizedBooks = []

    for (const book of batch) {
      if (book === null || book === undefined) {
        invalidBooks.push({
          book: null,
          errors: [{
            type: 'NULL_BOOK_DATA',
            message: '書籍資料為空',
            field: 'book'
          }]
        })
        continue
      }

      try {
        const validation = await this.validateSingleBook(book, platform, source)
        
        if (validation.isValid) {
          validBooks.push(validation)
          const normalized = await this.normalizeBook(validation.book, platform)
          normalizedBooks.push(normalized)
        } else {
          invalidBooks.push(validation)
        }

        // 收集警告
        if (validation.warnings && validation.warnings.length > 0) {
          warnings.push(...validation.warnings)
          
          // 發送品質警告事件
          await this.eventBus.emit('DATA.QUALITY.WARNING', {
            platform,
            bookId: validation.bookId,
            warnings: validation.warnings,
            timestamp: new Date().toISOString()
          })
        }

      } catch (error) {
        invalidBooks.push({
          book,
          bookId: book.id || 'unknown',
          errors: [{
            type: 'VALIDATION_ERROR',
            message: error.message,
            field: 'general'
          }]
        })
      }
    }

    // 記憶體管理
    if (this.config.gcAfterBatch && batchIndex % 10 === 9) {
      if (global.gc) {
        global.gc()
        warnings.push({
          type: 'MEMORY_MANAGEMENT_INFO',
          message: '已執行垃圾回收',
          batchIndex
        })
      }
    }

    return {
      validBooks,
      invalidBooks,
      warnings,
      normalizedBooks
    }
  }

  /**
   * 驗證單本書籍
   */
  async validateSingleBook(book, platform, source) {
    const bookId = book.id || book.ASIN || book.kobo_id || 'unknown'
    
    // 檢查快取
    if (this.config.enableCache) {
      const cacheKey = this._generateCacheKey(book, platform)
      const cached = this._getCachedValidation(cacheKey)
      if (cached) {
        return cached
      }
    }

    const validation = {
      bookId,
      platform,
      source,
      isValid: true,
      errors: [],
      warnings: [],
      fixes: [],
      book: { ...book } // 複製書籍資料，避免修改原始資料
    }

    try {
      // 取得驗證規則
      const rules = this._getValidationRules(platform)
      if (!rules) {
        throw new Error('驗證規則損壞')
      }

      // 執行預處理修復（在驗證之前）
      if (this.config.autoFix) {
        await this._performPreValidationFixes(validation)
      }

      // 執行各種驗證
      await this._validateRequiredFields(validation, rules)
      await this._validateDataTypes(validation, rules)
      await this._validateBusinessRules(validation, rules)
      await this._performQualityChecks(validation, rules)
      
      // 執行後處理修復（在驗證之後）
      if (this.config.autoFix) {
        await this._performPostValidationFixes(validation)
      }

      // 快取結果
      if (this.config.enableCache) {
        const cacheKey = this._generateCacheKey(book, platform)
        this._setCachedValidation(cacheKey, validation)
      }

      return validation

    } catch (error) {
      validation.isValid = false
      validation.errors.push({
        type: 'VALIDATION_SYSTEM_ERROR',
        message: error.message,
        field: 'system'
      })
      return validation
    }
  }

  /**
   * 標準化書籍資料為 v2.0 統一格式
   */
  async normalizeBook(book, platform) {
    const now = new Date().toISOString()
    
    // 生成跨平台統一ID
    const crossPlatformId = await this._generateCrossPlatformId(book)
    
    // 生成資料指紋
    const dataFingerprint = await this.generateDataFingerprint(book)

    // 標準化基本資訊
    const normalized = {
      // 核心識別資訊
      id: book.id || book.ASIN || book.kobo_id || '',
      crossPlatformId,
      platform,
      
      // 基本書籍資訊
      title: this._normalizeTitle(book.title),
      authors: this._normalizeAuthors(book.authors || book.author || book.contributors),
      publisher: book.publisher || book.imprint || '',
      isbn: this._normalizeISBN(book.isbn),
      
      // 封面圖片
      cover: this._normalizeCover(book.cover),
      
      // 閱讀狀態
      progress: this._normalizeProgress(book.progress || book.reading_progress || book.reading_state),
      status: this._normalizeReadingStatus(book.status || book.isFinished),
      
      // 評分和標籤
      rating: typeof book.rating === 'number' ? Math.max(0, Math.min(5, book.rating)) : 0,
      tags: Array.isArray(book.tags) ? book.tags : (book.categories || []),
      notes: book.notes || book.review || '',
      
      // 日期資訊
      purchaseDate: book.purchaseDate || book.acquired_date || now,
      
      // v2.0 模型欄位
      schemaVersion: '2.0.0',
      createdAt: now,
      updatedAt: now,
      dataFingerprint,
      
      // 平台特定元資料
      platformMetadata: {
        [platform]: {
          originalData: this._extractPlatformSpecificData(book, platform),
          extractionTimestamp: now,
          dataQuality: this._assessDataQuality(book)
        }
      },
      
      // 同步管理欄位
      syncStatus: {
        lastSyncTimestamp: now,
        conflictResolved: true,
        mergeStrategy: 'LATEST_TIMESTAMP',
        syncSources: [platform],
        pendingSync: false
      }
    }

    return normalized
  }

  /**
   * 計算品質分數
   */
  calculateQualityScore(report) {
    if (report.totalBooks === 0) {
      return 0
    }

    const validPercentage = (report.validBooks.length / report.totalBooks) * 100
    const warningPenalty = Math.min(report.warnings.length, 20) // 最多扣20分
    
    return Math.max(0, Math.round(validPercentage - warningPenalty))
  }

  /**
   * 生成資料指紋
   */
  async generateDataFingerprint(book) {
    // 只使用核心欄位來生成指紋，忽略平台特定和動態欄位
    const coreData = {
      title: (book.title || '').trim().toLowerCase(),
      authors: this._normalizeAuthors(book.authors || book.author || book.contributors),
      isbn: this._normalizeISBN(book.isbn)
    }
    
    const dataString = JSON.stringify(coreData)
    return this.hashString(dataString)
  }

  /**
   * 雜湊字串工具方法
   */
  hashString(str) {
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 16)
  }

  /**
   * 取得嵌套物件值
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined
    }, obj)
  }

  /**
   * 檢查資料類型
   */
  isCorrectType(value, expectedType) {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number'
      case 'boolean':
        return typeof value === 'boolean'
      case 'array':
        return Array.isArray(value)
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value)
      case 'date':
        return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))
      default:
        return false
    }
  }

  /**
   * 清理服務
   */
  destroy() {
    if (this.validationCache) {
      this.validationCache.clear()
      this.cacheTimestamps.clear()
    }
    this.validationRules.clear()
    this.platformSchemas.clear()
    this.dataQualityMetrics.clear()
    this.isInitialized = false
  }

  // ==================== 私有方法 ====================

  /**
   * 載入預設驗證規則
   */
  async _loadDefaultValidationRules() {
    const defaultRules = {
      required: ['id', 'title'],
      types: {
        id: 'string',
        title: 'string',
        authors: 'array',
        progress: 'object',
        rating: 'number',
        tags: 'array'
      },
      business: {
        progressRange: { min: 0, max: 100 },
        ratingRange: { min: 0, max: 5 }
      }
    }
    
    this.validationRules.set('DEFAULT', defaultRules)
  }

  /**
   * 取得平台特定驗證規則
   */
  _getPlatformSpecificRules(platform) {
    const baseRules = this.validationRules.get('DEFAULT') || {}
    
    const platformSpecificRules = {
      READMOO: {
        ...baseRules,
        required: ['id', 'title'],
        types: {
          ...baseRules.types,
          progress: 'object',
          type: 'string',
          isNew: 'boolean',
          isFinished: 'boolean'
        }
      },
      KINDLE: {
        ...baseRules,
        required: ['ASIN', 'title'],
        types: {
          ...baseRules.types,
          ASIN: 'string',
          authors: 'array',
          kindle_price: 'number',
          reading_progress: 'object',
          whispersync_device: 'string'
        }
      },
      KOBO: {
        ...baseRules,
        required: ['id', 'title'],
        types: {
          ...baseRules.types,
          contributors: 'array',
          reading_state: 'object',
          kobo_categories: 'array'
        }
      },
      BOOKWALKER: {
        ...baseRules,
        required: ['id', 'title'],
        types: {
          ...baseRules.types
        }
      },
      BOOKS_COM: {
        ...baseRules,
        required: ['id', 'title'],
        types: {
          ...baseRules.types
        }
      }
    }

    return platformSpecificRules[platform] || baseRules
  }

  /**
   * 獲取平台特定的資料架構定義
   */
  _getPlatformSchema(platform) {
    const schemas = {
      READMOO: {
        version: '2.0.0',
        platform: 'READMOO',
        fields: {
          id: { type: 'string', required: true },
          title: { type: 'string', required: true },
          authors: { type: 'array', required: false },
          publisher: { type: 'string', required: false },
          progress: { type: 'number', required: false, min: 0, max: 100 },
          type: { type: 'string', required: false },
          isNew: { type: 'boolean', required: false },
          isFinished: { type: 'boolean', required: false },
          cover: { type: 'string', required: false }
        }
      },
      KINDLE: {
        version: '2.0.0',
        platform: 'KINDLE',
        fields: {
          ASIN: { type: 'string', required: true },
          title: { type: 'string', required: true },
          authors: { type: 'array', required: false },
          kindle_price: { type: 'number', required: false },
          reading_progress: { type: 'object', required: false },
          whispersync_device: { type: 'string', required: false },
          cover: { type: 'string', required: false }
        }
      },
      KOBO: {
        version: '2.0.0',
        platform: 'KOBO',
        fields: {
          id: { type: 'string', required: true },
          title: { type: 'string', required: true },
          authors: { type: 'array', required: false },
          publisher: { type: 'string', required: false },
          reading_percentage: { type: 'number', required: false, min: 0, max: 100 },
          cover: { type: 'string', required: false }
        }
      },
      BOOKWALKER: {
        version: '2.0.0',
        platform: 'BOOKWALKER',
        fields: {
          id: { type: 'string', required: true },
          title: { type: 'string', required: true },
          authors: { type: 'array', required: false },
          series: { type: 'string', required: false },
          volume: { type: 'number', required: false },
          cover: { type: 'string', required: false }
        }
      },
      BOOKS_COM: {
        version: '2.0.0',
        platform: 'BOOKS_COM',
        fields: {
          id: { type: 'string', required: true },
          title: { type: 'string', required: true },
          authors: { type: 'array', required: false },
          publisher: { type: 'string', required: false },
          isbn: { type: 'string', required: false },
          cover: { type: 'string', required: false }
        }
      }
    }

    return schemas[platform] || {
      version: '2.0.0',
      platform: 'UNKNOWN',
      fields: {
        id: { type: 'string', required: true },
        title: { type: 'string', required: true }
      }
    }
  }

  /**
   * 註冊事件監聽器
   */
  _registerEventListeners() {
    // 監聽驗證請求
    this.eventBus.on('DATA.VALIDATION.REQUESTED', async (data) => {
      try {
        const result = await this.validateAndNormalize(data.books, data.platform, data.source)
        await this.eventBus.emit('DATA.VALIDATION.COMPLETED', {
          ...result,
          requestId: data.requestId
        })
      } catch (error) {
        await this.eventBus.emit('DATA.VALIDATION.FAILED', {
          requestId: data.requestId,
          error: error.message
        })
      }
    })

    // 監聽批次驗證請求
    this.eventBus.on('DATA.*.BATCH.VALIDATION.REQUESTED', async (data) => {
      try {
        const result = await this.validateAndNormalize(data.books, data.platform, data.source)
        await this.eventBus.emit('DATA.VALIDATION.COMPLETED', {
          ...result,
          batchId: data.batchId
        })
      } catch (error) {
        await this.eventBus.emit('DATA.VALIDATION.FAILED', {
          batchId: data.batchId,
          error: error.message
        })
      }
    })

    // 監聽配置更新
    this.eventBus.on('DATA.VALIDATION.CONFIG.UPDATED', async (data) => {
      if (data.platform && data.validationRules) {
        this.validationRules.set(data.platform, {
          ...this.validationRules.get(data.platform) || {},
          ...data.validationRules
        })
      }
    })

    // 監聽平台檢測事件
    this.eventBus.on('PLATFORM.*.DETECTED', async (data) => {
      const platform = data.platform
      if (platform && this.config.supportedPlatforms.includes(platform)) {
        await this.loadPlatformValidationRules(platform)
      }
    })

    // 監聽提取完成事件
    this.eventBus.on('EXTRACTION.*.COMPLETED', async (data) => {
      if (data.books && data.platform) {
        try {
          const result = await this.validateAndNormalize(
            data.books, 
            data.platform, 
            'EXTRACTION'
          )
          await this.eventBus.emit('DATA.VALIDATION.COMPLETED', {
            ...result,
            extractionId: data.extractionId
          })
        } catch (error) {
          await this.eventBus.emit('DATA.VALIDATION.FAILED', {
            extractionId: data.extractionId,
            error: error.message
          })
        }
      }
    })
  }

  /**
   * 輸入驗證
   */
  _validateInputs(books, platform, source) {
    if (books === null || books === undefined) {
      throw new Error('書籍資料不能為空')
    }
    
    if (!Array.isArray(books)) {
      throw new Error('書籍資料必須是陣列')
    }
    
    if (!platform || typeof platform !== 'string') {
      throw new Error('平台名稱不能為空')
    }
  }

  /**
   * 生成驗證ID
   */
  _generateValidationId() {
    return `validation_${Date.now()}_${Math.random().toString(36).substring(2)}`
  }

  /**
   * 分割批次
   */
  _splitIntoBatches(books) {
    const batchSize = Math.min(this.config.batchSize, this.config.maxBatchSize)
    const batches = []
    
    for (let i = 0; i < books.length; i += batchSize) {
      batches.push(books.slice(i, i + batchSize))
    }
    
    return batches
  }

  /**
   * 取得驗證規則
   */
  _getValidationRules(platform) {
    return this.validationRules.get(platform) || this.validationRules.get('DEFAULT')
  }

  /**
   * 驗證必填欄位
   */
  async _validateRequiredFields(validation, rules) {
    const required = rules.required || []
    
    for (const field of required) {
      const value = validation.book[field]
      if (value === undefined || value === null || value === '') {
        validation.isValid = false
        validation.errors.push({
          type: 'MISSING_REQUIRED_FIELD',
          field,
          message: `缺少必填欄位: ${field}`
        })
      }
    }
  }

  /**
   * 驗證資料類型
   */
  async _validateDataTypes(validation, rules) {
    const types = rules.types || {}
    
    for (const [field, expectedType] of Object.entries(types)) {
      const value = validation.book[field]
      if (value !== undefined && value !== null) {
        // 對於 authors 欄位，允許物件陣列（Kindle格式）
        if (field === 'authors' && expectedType === 'array' && Array.isArray(value)) {
          // 檢查是否為物件陣列（Kindle格式）或字串陣列
          const isValidAuthors = value.every(author => 
            typeof author === 'string' || (typeof author === 'object' && author.name)
          )
          if (!isValidAuthors) {
            validation.isValid = false
            validation.errors.push({
              type: 'INVALID_DATA_TYPE',
              field,
              expectedType: 'array of strings or objects with name property',
              actualType: typeof value,
              message: `${field} 欄位格式錯誤`
            })
          }
        } else if (!this.isCorrectType(value, expectedType)) {
          validation.isValid = false
          validation.errors.push({
            type: 'INVALID_DATA_TYPE',
            field,
            expectedType,
            actualType: typeof value,
            message: `${field} 欄位類型錯誤，預期: ${expectedType}`
          })
        }
      }
    }
  }

  /**
   * 驗證商業規則
   */
  async _validateBusinessRules(validation, rules) {
    const business = rules.business || {}
    const book = validation.book

    // 進度範圍驗證
    if (business.progressRange && book.progress) {
      const progress = typeof book.progress === 'number' ? book.progress : book.progress.percentage
      if (progress !== undefined && progress !== null) {
        const { min, max } = business.progressRange
        if (progress < min || progress > max) {
          validation.isValid = false
          validation.errors.push({
            type: 'BUSINESS_RULE_VIOLATION',
            field: 'progress',
            message: `進度 ${progress} 超出有效範圍 ${min}-${max}`
          })
        }
      }
    }

    // 評分範圍驗證
    if (business.ratingRange && book.rating !== undefined) {
      const { min, max } = business.ratingRange
      if (book.rating < min || book.rating > max) {
        validation.isValid = false
        validation.errors.push({
          type: 'BUSINESS_RULE_VIOLATION',
          field: 'rating',
          message: `評分 ${book.rating} 超出有效範圍 ${min}-${max}`
        })
      }
    }

    // 頁數邏輯驗證
    if (book.progress && typeof book.progress === 'object') {
      const { currentPage, totalPages } = book.progress
      if (currentPage > totalPages && totalPages > 0) {
        validation.isValid = false
        validation.errors.push({
          type: 'BUSINESS_RULE_VIOLATION',
          field: 'progress',
          message: `當前頁數 ${currentPage} 不能大於總頁數 ${totalPages}`
        })
      }
    }
  }

  /**
   * 品質檢查
   */
  async _performQualityChecks(validation, rules) {
    const book = validation.book

    // 標題品質檢查
    if (book.title && book.title.length < 2) {
      validation.warnings.push({
        type: 'DATA_QUALITY_WARNING',
        field: 'title',
        message: '書籍標題過短，可能影響識別',
        suggestion: '檢查標題是否完整'
      })
    }

    // 作者品質檢查
    if (book.authors && Array.isArray(book.authors)) {
      // 檢查空作者陣列
      if (book.authors.length === 0) {
        validation.warnings.push({
          type: 'DATA_QUALITY_WARNING',
          field: 'authors',
          message: '作者清單為空',
          suggestion: '添加作者資訊'
        })
      } else {
        const hasEmptyAuthor = book.authors.some(author => {
          if (!author) return true
          if (typeof author === 'string') {
            return author.trim() === ''
          }
          if (typeof author === 'object' && author !== null && author.name) {
            return !author.name || String(author.name).trim() === ''
          }
          return false
        })
        if (hasEmptyAuthor) {
          validation.warnings.push({
            type: 'DATA_QUALITY_WARNING',
            field: 'authors',
            message: '包含空白作者名稱',
            suggestion: '清理作者清單'
          })
        }
      }
    }

    // ISBN 品質檢查
    if (book.isbn && book.isbn.length < 10) {
      validation.warnings.push({
        type: 'DATA_QUALITY_WARNING',
        field: 'isbn',
        message: 'ISBN 格式可能不正確',
        suggestion: '驗證 ISBN 格式'
      })
    }

    // 封面 URL 檢查
    if (book.cover && typeof book.cover === 'string') {
      if (!book.cover.startsWith('http')) {
        validation.warnings.push({
          type: 'DATA_QUALITY_WARNING',
          field: 'cover',
          message: '封面圖片 URL 格式無效',
          suggestion: '檢查圖片連結'
        })
      }
    }
  }

  /**
   * 預處理修復（在驗證之前執行）
   */
  async _performPreValidationFixes(validation) {
    const book = validation.book

    // 修復標題空白
    if (book.title && typeof book.title === 'string') {
      const originalTitle = book.title
      book.title = book.title.trim().replace(/\s+/g, ' ')
      if (book.title !== originalTitle) {
        validation.fixes.push({
          type: 'TITLE_WHITESPACE_FIX',
          field: 'title',
          before: originalTitle,
          after: book.title
        })
      }
    }

    // 將單一 author 轉換為 authors 陣列
    if (book.author && !book.authors) {
      const originalAuthor = book.author
      book.authors = typeof book.author === 'string' ? [book.author] : book.author
      validation.fixes.push({
        type: 'AUTHOR_TO_AUTHORS_FIX',
        field: 'author -> authors',
        before: originalAuthor,
        after: book.authors
      })
      delete book.author
    }

    // 將數字 progress 轉換為物件格式 (READMOO 平台需求)
    if (book.progress && typeof book.progress === 'number') {
      const originalProgress = book.progress
      book.progress = {
        percentage: Math.max(0, Math.min(100, book.progress))
      }
      validation.fixes.push({
        type: 'PROGRESS_TYPE_FIX',
        field: 'progress',
        before: originalProgress,
        after: book.progress
      })
    }
  }

  /**
   * 後處理修復（在驗證之後執行）
   */
  async _performPostValidationFixes(validation) {
    const book = validation.book

    // 修復 ISBN 格式
    if (book.isbn && typeof book.isbn === 'string') {
      const originalISBN = book.isbn
      book.isbn = book.isbn.replace(/[-\s:]/g, '').replace(/^isbn/i, '')
      if (book.isbn !== originalISBN) {
        validation.fixes.push({
          type: 'ISBN_FORMAT_FIX',
          field: 'isbn',
          before: originalISBN,
          after: book.isbn
        })
      }
    }

    // 修復作者格式（如果是字串轉陣列）
    if (book.authors && typeof book.authors === 'string') {
      const originalAuthors = book.authors
      book.authors = [book.authors]
      validation.fixes.push({
        type: 'AUTHORS_FORMAT_FIX',
        field: 'authors',
        before: originalAuthors,
        after: book.authors
      })
    }

    // 修復進度範圍
    if (book.progress && typeof book.progress === 'object') {
      if (book.progress.percentage > 100) {
        validation.fixes.push({
          type: 'PROGRESS_RANGE_FIX',
          field: 'progress.percentage',
          before: book.progress.percentage,
          after: 100
        })
        book.progress.percentage = 100
      }
      
      if (book.progress.currentPage < 0) {
        validation.fixes.push({
          type: 'PROGRESS_RANGE_FIX',
          field: 'progress.currentPage',
          before: book.progress.currentPage,
          after: 0
        })
        book.progress.currentPage = 0
      }
    }
  }

  /**
   * 生成跨平台統一ID
   */
  async _generateCrossPlatformId(book) {
    // 使用核心識別資訊生成統一ID
    const identifiers = [
      (book.title || '').trim().toLowerCase(),
      this._normalizeAuthors(book.authors || book.author || book.contributors).join('|'),
      this._normalizeISBN(book.isbn)
    ].filter(Boolean)
    
    if (identifiers.length === 0) {
      return this.hashString(`fallback_${book.id || Math.random()}`)
    }
    
    return this.hashString(identifiers.join('::'))
  }

  /**
   * 標準化標題
   */
  _normalizeTitle(title) {
    if (!title) return ''
    return title.trim().replace(/\s+/g, ' ')
  }

  /**
   * 標準化作者
   */
  _normalizeAuthors(authors) {
    if (!authors) return []
    
    if (typeof authors === 'string') {
      return [authors.trim()]
    }
    
    if (Array.isArray(authors)) {
      return authors.map(author => {
        if (typeof author === 'string') {
          return author.trim()
        }
        if (typeof author === 'object' && author !== null && author.name) {
          return String(author.name).trim()
        }
        return String(author).trim()
      }).filter(name => name.length > 0)
    }
    
    return []
  }

  /**
   * 標準化 ISBN
   */
  _normalizeISBN(isbn) {
    if (!isbn) return ''
    return String(isbn).replace(/[-\s:]/g, '').replace(/^isbn/i, '')
  }

  /**
   * 標準化封面
   */
  _normalizeCover(cover) {
    if (!cover) {
      return {
        thumbnail: '',
        medium: '',
        large: ''
      }
    }
    
    if (typeof cover === 'string') {
      return {
        thumbnail: cover,
        medium: cover,
        large: cover
      }
    }
    
    if (typeof cover === 'object') {
      return {
        thumbnail: cover.small || cover.thumbnail || cover.medium || cover.large || '',
        medium: cover.medium || cover.large || cover.small || cover.thumbnail || '',
        large: cover.large || cover.medium || cover.small || cover.thumbnail || ''
      }
    }
    
    return {
      thumbnail: '',
      medium: '',
      large: ''
    }
  }

  /**
   * 標準化進度
   */
  _normalizeProgress(progress) {
    if (!progress) {
      return {
        percentage: 0,
        currentPage: 0,
        totalPages: 0,
        lastPosition: ''
      }
    }
    
    if (typeof progress === 'number') {
      return {
        percentage: Math.max(0, Math.min(100, Math.floor(progress))),
        currentPage: 0,
        totalPages: 0,
        lastPosition: ''
      }
    }
    
    if (typeof progress === 'object') {
      let percentage = progress.percentage || progress.percent_complete || 0
      if (progress.current_position !== undefined) {
        percentage = progress.current_position * 100
      }
      // 處理特殊情況，如 { percent: 120 } 應映射為 100%
      if (progress.percent !== undefined) {
        percentage = Math.max(0, Math.min(100, progress.percent))
      }
      
      return {
        percentage: Math.max(0, Math.min(100, Math.floor(percentage))),
        currentPage: Math.max(0, progress.currentPage || progress.page || 0),
        totalPages: Math.max(0, progress.totalPages || progress.total || 0),
        lastPosition: progress.lastPosition || progress.last_read || ''
      }
    }
    
    return {
      percentage: 0,
      currentPage: 0,
      totalPages: 0,
      lastPosition: ''
    }
  }

  /**
   * 標準化閱讀狀態
   */
  _normalizeReadingStatus(status) {
    if (typeof status === 'boolean') {
      return status ? 'FINISHED' : 'READING'
    }
    
    if (typeof status === 'string') {
      const normalizedStatus = status.toUpperCase()
      if (['FINISHED', 'COMPLETED', 'DONE'].includes(normalizedStatus)) {
        return 'FINISHED'
      }
      if (['READING', 'IN_PROGRESS', 'STARTED'].includes(normalizedStatus)) {
        return 'READING'
      }
      if (['NOT_STARTED', 'PLANNED', 'TO_READ'].includes(normalizedStatus)) {
        return 'NOT_STARTED'
      }
    }
    
    return 'NOT_STARTED'
  }

  /**
   * 提取平台特定資料
   */
  _extractPlatformSpecificData(book, platform) {
    const platformSpecific = {}
    const prefix = platform.toLowerCase()
    
    // 提取以平台名稱開頭的欄位
    Object.keys(book).forEach(key => {
      if (key.startsWith(prefix)) {
        platformSpecific[key] = book[key]
      }
    })
    
    // 平台特定欄位映射
    const platformFields = {
      READMOO: ['type', 'isNew', 'isFinished'],
      KINDLE: ['ASIN', 'whispersync_device', 'kindle_price'],
      KOBO: ['contributors', 'kobo_categories', 'reading_state']
    }
    
    if (platformFields[platform]) {
      platformFields[platform].forEach(field => {
        if (book[field] !== undefined) {
          platformSpecific[field] = book[field]
        }
      })
    }
    
    return platformSpecific
  }

  /**
   * 評估資料品質
   */
  _assessDataQuality(book) {
    let qualityScore = 100
    
    // 檢查核心欄位
    if (!book.title || book.title.trim().length < 2) qualityScore -= 20
    if (!book.authors || (Array.isArray(book.authors) && book.authors.length === 0)) qualityScore -= 15
    if (!book.isbn || book.isbn.length < 10) qualityScore -= 10
    if (!book.cover) qualityScore -= 10
    if (!book.publisher) qualityScore -= 5
    
    return Math.max(0, qualityScore)
  }

  /**
   * 快取相關方法
   */
  _generateCacheKey(book, platform) {
    const key = `${platform}_${book.id || book.ASIN || 'unknown'}_${this.hashString(JSON.stringify(book))}`
    return key
  }

  _getCachedValidation(cacheKey) {
    if (!this.validationCache || !this.cacheTimestamps) return null
    
    const timestamp = this.cacheTimestamps.get(cacheKey)
    if (!timestamp || Date.now() - timestamp > this.config.cacheTTL) {
      this.validationCache.delete(cacheKey)
      this.cacheTimestamps.delete(cacheKey)
      return null
    }
    
    return this.validationCache.get(cacheKey)
  }

  _setCachedValidation(cacheKey, validation) {
    if (!this.validationCache || !this.cacheTimestamps) return
    
    // 限制快取大小
    if (this.validationCache.size >= this.config.cacheSize) {
      const oldestKey = this.validationCache.keys().next().value
      this.validationCache.delete(oldestKey)
      this.cacheTimestamps.delete(oldestKey)
    }
    
    // 複製驗證結果以避免意外修改
    this.validationCache.set(cacheKey, { ...validation })
    this.cacheTimestamps.set(cacheKey, Date.now())
  }
}

module.exports = DataValidationService