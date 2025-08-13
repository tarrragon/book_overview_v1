/**
 * 提取領域處理器
 *
 * 負責功能：
 * - 處理書籍資料提取相關的領域邏輯和業務規則
 * - 管理提取流程的狀態控制和品質保證
 * - 實現資料驗證、清理和標準化處理
 * - 協調提取結果的儲存和匯出功能
 *
 * 設計考量：
 * - 基於事件驅動架構，響應提取相關事件
 * - 實現提取領域的業務邏輯與技術實作分離
 * - 提供提取流程的統一管理和品質控制
 * - 支援不同資料來源的提取策略和格式處理
 */

const {
  EXTRACTION_EVENTS,
  EVENT_PRIORITIES,
  STORAGE_KEYS,
  LIMITS
} = require('../constants/module-constants')

class ExtractionDomainHandler {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 提取狀態管理
    this.extractionStates = new Map()
    this.activeExtractions = new Map()
    this.extractionHistory = []

    // 資料處理配置
    this.dataProcessors = new Map()
    this.validationRules = new Map()
    this.cleaningStrategies = new Map()
    this.exportFormats = new Map()

    // 品質控制
    this.qualityMetrics = {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      dataQualityScore: 0,
      averageExtractionTime: 0,
      totalBooksExtracted: 0
    }

    // 事件監聽器記錄
    this.registeredListeners = new Map()

    // 統計資料
    this.domainStats = {
      extractionEventsProcessed: 0,
      extractionRequests: 0,
      dataValidations: 0,
      exportRequests: 0,
      qualityChecks: 0
    }

    // 處理器狀態
    this.initialized = false
    this.active = false
  }

  /**
   * 初始化提取領域處理器
   * @returns {Promise<void>}
   */
  async initialize () {
    if (this.initialized) {
      this.logger.warn('⚠️ 提取領域處理器已初始化')
      return
    }

    try {
      if (this.i18nManager) {
        this.logger.log(this.i18nManager.t('modules.operations.initialize', { moduleName: '提取領域處理器' }))
      } else {
        this.logger.log('📊 初始化提取領域處理器')
      }

      // 初始化資料處理器
      await this.initializeDataProcessors()

      // 初始化驗證規則
      await this.initializeValidationRules()

      // 初始化清理策略
      await this.initializeCleaningStrategies()

      // 初始化匯出格式
      await this.initializeExportFormats()

      // 載入提取歷史
      await this.loadExtractionHistory()

      this.initialized = true
      this.logger.log('✅ 提取領域處理器初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化提取領域處理器失敗:', error)
      throw error
    }
  }

  /**
   * 啟動提取領域處理器
   * @returns {Promise<void>}
   */
  async start () {
    if (!this.initialized) {
      throw new Error('提取領域處理器尚未初始化')
    }

    if (this.active) {
      this.logger.warn('⚠️ 提取領域處理器已啟動')
      return
    }

    try {
      this.logger.log('▶️ 啟動提取領域處理器')

      // 註冊事件監聽器
      await this.registerEventListeners()

      // 恢復進行中的提取
      await this.resumeActiveExtractions()

      this.active = true
      this.logger.log('✅ 提取領域處理器啟動完成')
    } catch (error) {
      this.logger.error('❌ 啟動提取領域處理器失敗:', error)
      throw error
    }
  }

  /**
   * 停止提取領域處理器
   * @returns {Promise<void>}
   */
  async stop () {
    if (!this.active) {
      return
    }

    try {
      this.logger.log('⏹️ 停止提取領域處理器')

      // 停止進行中的提取
      await this.stopActiveExtractions()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      // 保存提取歷史
      await this.saveExtractionHistory()

      this.active = false
      this.logger.log('✅ 提取領域處理器停止完成')
    } catch (error) {
      this.logger.error('❌ 停止提取領域處理器失敗:', error)
      throw error
    }
  }

  /**
   * 初始化資料處理器
   * @returns {Promise<void>}
   * @private
   */
  async initializeDataProcessors () {
    try {
      // Readmoo 書籍資料處理器
      this.dataProcessors.set('readmoo_books', async (rawData) => {
        this.logger.log('📚 處理 Readmoo 書籍資料')

        if (!Array.isArray(rawData)) {
          throw new Error('書籍資料必須是陣列格式')
        }

        const processedBooks = []

        for (const book of rawData) {
          const processedBook = {
            // 基本資訊
            id: book.id || this.generateBookId(book),
            title: this.cleanString(book.title) || '未知書名',
            author: this.cleanString(book.author) || '未知作者',
            publisher: this.cleanString(book.publisher) || '未知出版社',

            // 分類和標籤
            category: this.cleanString(book.category) || '未分類',
            tags: this.normalizeTags(book.tags || book.tag),

            // 閱讀資訊
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

      // 使用者閱讀記錄處理器
      this.dataProcessors.set('reading_progress', async (rawData) => {
        this.logger.log('📖 處理閱讀進度資料')

        // 處理閱讀進度資料的邏輯
        return {
          progressRecords: rawData,
          processedAt: Date.now()
        }
      })

      this.logger.log('🔧 資料處理器初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化資料處理器失敗:', error)
    }
  }

  /**
   * 初始化驗證規則
   * @returns {Promise<void>}
   * @private
   */
  async initializeValidationRules () {
    try {
      // 書籍資料驗證規則
      this.validationRules.set('book', (book) => {
        const errors = []

        if (!book.title || typeof book.title !== 'string' || book.title.trim().length === 0) {
          errors.push('書名不能為空')
        }

        if (!book.author || typeof book.author !== 'string' || book.author.trim().length === 0) {
          errors.push('作者不能為空')
        }

        if (book.progress !== undefined && (book.progress < 0 || book.progress > 100)) {
          errors.push('閱讀進度必須在 0-100 之間')
        }

        if (book.rating !== undefined && (book.rating < 0 || book.rating > 5)) {
          errors.push('評分必須在 0-5 之間')
        }

        return {
          valid: errors.length === 0,
          errors
        }
      })

      // 提取結果驗證規則
      this.validationRules.set('extraction_result', (result) => {
        const errors = []

        if (!result.books || !Array.isArray(result.books)) {
          errors.push('提取結果必須包含書籍陣列')
        } else if (result.books.length === 0) {
          errors.push('沒有提取到任何書籍')
        }

        if (!result.summary || typeof result.summary !== 'object') {
          errors.push('提取結果必須包含摘要資訊')
        }

        return {
          valid: errors.length === 0,
          errors
        }
      })

      this.logger.log('🔧 驗證規則初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化驗證規則失敗:', error)
    }
  }

  /**
   * 初始化清理策略
   * @returns {Promise<void>}
   * @private
   */
  async initializeCleaningStrategies () {
    try {
      // 去除重複書籍策略
      this.cleaningStrategies.set('deduplication', (books) => {
        const seen = new Map()
        const uniqueBooks = []

        for (const book of books) {
          const key = `${book.title}_${book.author}`.toLowerCase()

          if (!seen.has(key)) {
            seen.set(key, true)
            uniqueBooks.push(book)
          } else {
            this.logger.log(`📋 發現重複書籍: ${book.title}`)
          }
        }

        return {
          books: uniqueBooks,
          duplicatesRemoved: books.length - uniqueBooks.length
        }
      })

      // 資料完整性檢查策略
      this.cleaningStrategies.set('data_integrity', (books) => {
        const validBooks = []
        const invalidBooks = []

        for (const book of books) {
          const validation = this.validationRules.get('book')(book)

          if (validation.valid) {
            validBooks.push(book)
          } else {
            this.logger.warn(`⚠️ 書籍資料不完整: ${book.title}`, validation.errors)
            invalidBooks.push({
              book,
              errors: validation.errors
            })
          }
        }

        return {
          books: validBooks,
          invalidBooks,
          validCount: validBooks.length,
          invalidCount: invalidBooks.length
        }
      })

      // 資料正規化策略
      this.cleaningStrategies.set('normalization', (books) => {
        return {
          books: books.map(book => ({
            ...book,
            title: this.normalizeTitle(book.title),
            author: this.normalizeAuthor(book.author),
            tags: this.normalizeTags(book.tags)
          })),
          normalized: true
        }
      })

      this.logger.log('🔧 清理策略初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化清理策略失敗:', error)
    }
  }

  /**
   * 初始化匯出格式
   * @returns {Promise<void>}
   * @private
   */
  async initializeExportFormats () {
    try {
      // JSON 格式匯出
      this.exportFormats.set('json', (data) => {
        return {
          data: JSON.stringify(data, null, 2),
          mimeType: 'application/json',
          extension: 'json',
          filename: `readmoo_books_${Date.now()}.json`
        }
      })

      // CSV 格式匯出
      this.exportFormats.set('csv', (data) => {
        const books = data.books || []
        if (books.length === 0) {
          throw new Error('沒有書籍資料可匯出')
        }

        // CSV 標題行
        const headers = [
          'Title', 'Author', 'Publisher', 'Category', 'Progress',
          'Status', 'Rating', 'Tags', 'Description', 'ISBN'
        ]

        // CSV 資料行
        const rows = books.map(book => [
          this.escapeCsvValue(book.title),
          this.escapeCsvValue(book.author),
          this.escapeCsvValue(book.publisher),
          this.escapeCsvValue(book.category),
          book.progress || 0,
          this.escapeCsvValue(book.readingStatus),
          book.rating || '',
          this.escapeCsvValue((book.tags || []).join(';')),
          this.escapeCsvValue(book.description || ''),
          this.escapeCsvValue(book.isbn || '')
        ])

        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')

        return {
          data: csvContent,
          mimeType: 'text/csv',
          extension: 'csv',
          filename: `readmoo_books_${Date.now()}.csv`
        }
      })

      // Markdown 格式匯出
      this.exportFormats.set('markdown', (data) => {
        const books = data.books || []
        if (books.length === 0) {
          throw new Error('沒有書籍資料可匯出')
        }

        let markdown = '# Readmoo 書庫匯出\n\n'
        markdown += `匯出時間: ${new Date().toLocaleString()}\n`
        markdown += `書籍總數: ${books.length}\n\n`

        // 按分類組織
        const booksByCategory = this.groupBooksByCategory(books)

        for (const [category, categoryBooks] of Object.entries(booksByCategory)) {
          markdown += `## ${category} (${categoryBooks.length})\n\n`

          for (const book of categoryBooks) {
            markdown += `### ${book.title}\n`
            markdown += `- **作者**: ${book.author}\n`
            markdown += `- **出版社**: ${book.publisher}\n`
            markdown += `- **閱讀進度**: ${book.progress}%\n`
            markdown += `- **狀態**: ${book.readingStatus}\n`

            if (book.rating) {
              markdown += `- **評分**: ${'★'.repeat(Math.floor(book.rating))}${'☆'.repeat(5 - Math.floor(book.rating))}\n`
            }

            if (book.tags && book.tags.length > 0) {
              markdown += `- **標籤**: ${book.tags.join(', ')}\n`
            }

            if (book.description) {
              markdown += `- **描述**: ${book.description.substring(0, 200)}${book.description.length > 200 ? '...' : ''}\n`
            }

            markdown += '\n'
          }
        }

        return {
          data: markdown,
          mimeType: 'text/markdown',
          extension: 'md',
          filename: `readmoo_books_${Date.now()}.md`
        }
      })

      this.logger.log('🔧 匯出格式初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化匯出格式失敗:', error)
    }
  }

  /**
   * 載入提取歷史
   * @returns {Promise<void>}
   * @private
   */
  async loadExtractionHistory () {
    try {
      const stored = await chrome.storage.local.get([STORAGE_KEYS.EXTRACTION_HISTORY])

      if (stored[STORAGE_KEYS.EXTRACTION_HISTORY]) {
        this.extractionHistory = stored[STORAGE_KEYS.EXTRACTION_HISTORY]
          .slice(-LIMITS.MAX_SESSION_HISTORY) // 限制歷史記錄大小

        // 重建統計資料
        this.rebuildQualityMetrics()

        this.logger.log(`📚 載入了 ${this.extractionHistory.length} 個提取歷史記錄`)
      }
    } catch (error) {
      this.logger.error('❌ 載入提取歷史失敗:', error)
    }
  }

  /**
   * 保存提取歷史
   * @returns {Promise<void>}
   * @private
   */
  async saveExtractionHistory () {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.EXTRACTION_HISTORY]: this.extractionHistory.slice(-LIMITS.MAX_SESSION_HISTORY)
      })

      this.logger.log(`💾 保存了 ${this.extractionHistory.length} 個提取歷史記錄`)
    } catch (error) {
      this.logger.error('❌ 保存提取歷史失敗:', error)
    }
  }

  /**
   * 註冊事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async registerEventListeners () {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 未初始化，跳過事件監聽器註冊')
      return
    }

    try {
      // 提取開始請求事件
      this.registeredListeners.set('extractionStartRequested',
        this.eventBus.on('EXTRACTION.START.REQUESTED',
          (event) => this.handleExtractionStartRequested(event.data),
          { priority: EVENT_PRIORITIES.HIGH }
        )
      )

      // 提取開始事件
      this.registeredListeners.set('extractionStarted',
        this.eventBus.on(EXTRACTION_EVENTS.STARTED,
          (event) => this.handleExtractionStarted(event.data),
          { priority: EVENT_PRIORITIES.HIGH }
        )
      )

      // 提取進度事件
      this.registeredListeners.set('extractionProgress',
        this.eventBus.on(EXTRACTION_EVENTS.PROGRESS,
          (event) => this.handleExtractionProgress(event.data),
          { priority: EVENT_PRIORITIES.NORMAL }
        )
      )

      // 提取完成事件
      this.registeredListeners.set('extractionCompleted',
        this.eventBus.on(EXTRACTION_EVENTS.COMPLETED,
          (event) => this.handleExtractionCompleted(event.data),
          { priority: EVENT_PRIORITIES.URGENT }
        )
      )

      // 提取錯誤事件
      this.registeredListeners.set('extractionError',
        this.eventBus.on(EXTRACTION_EVENTS.ERROR,
          (event) => this.handleExtractionError(event.data),
          { priority: EVENT_PRIORITIES.HIGH }
        )
      )

      // 資料匯出請求事件
      this.registeredListeners.set('dataExportRequested',
        this.eventBus.on('DATA.EXPORT.REQUESTED',
          (event) => this.handleDataExportRequested(event.data),
          { priority: EVENT_PRIORITIES.NORMAL }
        )
      )

      // 資料品質檢查請求事件
      this.registeredListeners.set('qualityCheckRequested',
        this.eventBus.on('DATA.QUALITY.CHECK.REQUESTED',
          (event) => this.handleDataQualityCheckRequested(event.data),
          { priority: EVENT_PRIORITIES.LOW }
        )
      )

      this.logger.log('📝 提取領域事件監聽器註冊完成')
    } catch (error) {
      this.logger.error('❌ 註冊事件監聽器失敗:', error)
    }
  }

  /**
   * 取消註冊事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async unregisterEventListeners () {
    if (!this.eventBus) {
      return
    }

    try {
      const eventTypes = {
        extractionStartRequested: 'EXTRACTION.START.REQUESTED',
        extractionStarted: EXTRACTION_EVENTS.STARTED,
        extractionProgress: EXTRACTION_EVENTS.PROGRESS,
        extractionCompleted: EXTRACTION_EVENTS.COMPLETED,
        extractionError: EXTRACTION_EVENTS.ERROR,
        dataExportRequested: 'DATA.EXPORT.REQUESTED',
        qualityCheckRequested: 'DATA.QUALITY.CHECK.REQUESTED'
      }

      for (const [key, listenerId] of this.registeredListeners) {
        const eventType = eventTypes[key]
        if (eventType && listenerId) {
          this.eventBus.off(eventType, listenerId)
        }
      }

      this.registeredListeners.clear()
      this.logger.log('🔄 提取領域事件監聽器取消註冊完成')
    } catch (error) {
      this.logger.error('❌ 取消註冊事件監聽器失敗:', error)
    }
  }

  /**
   * 處理提取開始請求事件
   * @param {Object} data - 請求資料
   * @returns {Promise<void>}
   * @private
   */
  async handleExtractionStartRequested (data) {
    try {
      const { tabId, pageType, source } = data
      this.domainStats.extractionEventsProcessed++
      this.domainStats.extractionRequests++

      this.logger.log(`🎯 處理提取開始請求: Tab ${tabId}, 頁面類型: ${pageType}`)

      // 檢查是否已有進行中的提取
      if (this.activeExtractions.has(tabId)) {
        this.logger.warn(`⚠️ Tab ${tabId} 已有進行中的提取`)
        return
      }

      // 建立提取狀態
      const extractionId = this.generateExtractionId(tabId)
      const extractionState = {
        id: extractionId,
        tabId,
        pageType,
        source,
        status: 'preparing',
        startedAt: Date.now(),
        progress: 0,
        data: null,
        error: null
      }

      this.extractionStates.set(extractionId, extractionState)
      this.activeExtractions.set(tabId, extractionId)

      // 驗證提取環境
      const environmentCheck = await this.validateExtractionEnvironment(tabId, pageType)

      if (!environmentCheck.valid) {
        await this.failExtraction(extractionId, environmentCheck.error)
        return
      }

      // 觸發提取開始事件
      if (this.eventBus) {
        await this.eventBus.emit(EXTRACTION_EVENTS.STARTED, {
          extractionId,
          tabId,
          pageType,
          source,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理提取開始請求失敗:', error)
    }
  }

  /**
   * 處理提取開始事件
   * @param {Object} data - 提取資料
   * @returns {Promise<void>}
   * @private
   */
  async handleExtractionStarted (data) {
    try {
      const { extractionId, tabId } = data
      this.domainStats.extractionEventsProcessed++

      this.logger.log(`▶️ 處理提取開始: ${extractionId}`)

      const extractionState = this.extractionStates.get(extractionId)
      if (!extractionState) {
        this.logger.warn(`⚠️ 找不到提取狀態: ${extractionId}`)
        return
      }

      // 更新提取狀態
      extractionState.status = 'running'
      extractionState.actualStartedAt = Date.now()

      // 開始監控提取進度
      this.startExtractionMonitoring(extractionId)
    } catch (error) {
      this.logger.error('❌ 處理提取開始事件失敗:', error)
    }
  }

  /**
   * 處理提取進度事件
   * @param {Object} data - 進度資料
   * @returns {Promise<void>}
   * @private
   */
  async handleExtractionProgress (data) {
    try {
      const { extractionId, progress, message } = data
      this.domainStats.extractionEventsProcessed++

      this.logger.log(`📊 處理提取進度: ${extractionId} - ${progress}%`)

      const extractionState = this.extractionStates.get(extractionId)
      if (!extractionState) {
        return
      }

      // 更新進度
      extractionState.progress = progress
      extractionState.progressMessage = message
      extractionState.lastProgressAt = Date.now()

      // 品質檢查：檢測異常進度模式
      await this.checkProgressPatterns(extractionId, progress)
    } catch (error) {
      this.logger.error('❌ 處理提取進度事件失敗:', error)
    }
  }

  /**
   * 處理提取完成事件
   * @param {Object} data - 完成資料
   * @returns {Promise<void>}
   * @private
   */
  async handleExtractionCompleted (data) {
    try {
      const { extractionId, booksData, duration } = data
      this.domainStats.extractionEventsProcessed++

      this.logger.log(`✅ 處理提取完成: ${extractionId}`)

      let extractionState = this.extractionStates.get(extractionId)
      if (!extractionState) {
        // 創建臨時狀態處理外部提取完成事件
        extractionState = {
          id: extractionId || this.generateExtractionId(Date.now()),
          tabId: data.tabId || 'unknown',
          pageType: 'library',
          source: 'external',
          status: 'completed',
          startedAt: Date.now() - (duration || 0),
          progress: 100,
          data: null,
          error: null
        }
        this.extractionStates.set(extractionState.id, extractionState)
      }

      // 處理提取的資料
      const processedData = await this.processExtractionData(booksData || data.books || data.booksData)

      if (processedData) {
        // 更新提取狀態
        extractionState.status = 'completed'
        extractionState.completedAt = Date.now()
        extractionState.duration = duration || (extractionState.completedAt - extractionState.startedAt)
        extractionState.data = processedData
        extractionState.progress = 100

        // 執行資料品質檢查
        const qualityResult = await this.performQualityCheck(processedData)
        extractionState.qualityScore = qualityResult.score

        // 儲存處理後的資料
        await this.saveExtractionResult(extractionState)

        // 記錄到提取歷史
        this.addToExtractionHistory(extractionState)

        // 更新品質指標
        this.updateQualityMetrics(extractionState, true)

        // 清理活動提取
        if (extractionState.tabId !== 'unknown') {
          this.activeExtractions.delete(extractionState.tabId)
        }

        // 觸發處理完成事件
        if (this.eventBus) {
          await this.eventBus.emit('EXTRACTION.DATA.PROCESSED', {
            extractionId: extractionState.id,
            processedData,
            qualityScore: qualityResult.score,
            timestamp: Date.now()
          })
        }

        this.logger.log(`✅ 提取處理完成: ${processedData.books?.length || 0} 本書籍`)
      } else {
        await this.failExtraction(extractionState.id, '無法處理提取資料')
      }
    } catch (error) {
      this.logger.error('❌ 處理提取完成事件失敗:', error)
    }
  }

  /**
   * 處理提取錯誤事件
   * @param {Object} data - 錯誤資料
   * @returns {Promise<void>}
   * @private
   */
  async handleExtractionError (data) {
    try {
      const { extractionId, error, context } = data
      this.domainStats.extractionEventsProcessed++

      this.logger.error(`❌ 處理提取錯誤: ${extractionId}`, error)

      await this.failExtraction(extractionId, error, context)
    } catch (error) {
      this.logger.error('❌ 處理提取錯誤事件失敗:', error)
    }
  }

  /**
   * 處理資料匯出請求事件
   * @param {Object} data - 匯出請求資料
   * @returns {Promise<void>}
   * @private
   */
  async handleDataExportRequested (data) {
    try {
      const { exportType, format, source } = data
      this.domainStats.extractionEventsProcessed++
      this.domainStats.exportRequests++

      this.logger.log(`📤 處理資料匯出請求: ${exportType}, 格式: ${format}`)

      // 獲取要匯出的資料
      const exportData = await this.getExportData(exportType)

      if (!exportData || (exportData.books && exportData.books.length === 0)) {
        // 觸發匯出失敗事件
        if (this.eventBus) {
          await this.eventBus.emit('DATA.EXPORT.FAILED', {
            exportType,
            format,
            error: '沒有可匯出的資料',
            timestamp: Date.now()
          })
        }
        return
      }

      // 執行資料匯出
      const exportResult = await this.exportData(exportData, format)

      if (exportResult.success) {
        // 觸發匯出完成事件
        if (this.eventBus) {
          await this.eventBus.emit('DATA.EXPORT.COMPLETED', {
            exportType,
            format,
            result: exportResult,
            timestamp: Date.now()
          })
        }

        this.logger.log(`✅ 資料匯出完成: ${exportResult.filename}`)
      } else {
        // 觸發匯出失敗事件
        if (this.eventBus) {
          await this.eventBus.emit('DATA.EXPORT.FAILED', {
            exportType,
            format,
            error: exportResult.error,
            timestamp: Date.now()
          })
        }
      }
    } catch (error) {
      this.logger.error('❌ 處理資料匯出請求失敗:', error)
    }
  }

  /**
   * 處理資料品質檢查請求事件
   * @param {Object} data - 品質檢查請求資料
   * @returns {Promise<void>}
   * @private
   */
  async handleDataQualityCheckRequested (data) {
    try {
      const { dataType, source } = data
      this.domainStats.extractionEventsProcessed++
      this.domainStats.qualityChecks++

      this.logger.log(`🔍 處理資料品質檢查請求: ${dataType}`)

      // 獲取要檢查的資料
      const checkData = await this.getDataForQualityCheck(dataType)

      if (checkData) {
        // 執行品質檢查
        const qualityResult = await this.performQualityCheck(checkData)

        // 觸發品質檢查完成事件
        if (this.eventBus) {
          await this.eventBus.emit('DATA.QUALITY.CHECK.COMPLETED', {
            dataType,
            result: qualityResult,
            timestamp: Date.now()
          })
        }

        this.logger.log(`✅ 資料品質檢查完成: 得分 ${qualityResult.score}`)
      }
    } catch (error) {
      this.logger.error('❌ 處理資料品質檢查請求失敗:', error)
    }
  }

  /**
   * 處理提取資料
   * @param {*} rawData - 原始資料
   * @returns {Promise<Object|null>} 處理後的資料
   * @private
   */
  async processExtractionData (rawData) {
    try {
      if (!rawData) {
        this.logger.warn('⚠️ 沒有接收到提取資料')
        return null
      }

      this.logger.log('📊 開始處理提取資料')

      // 決定資料處理器
      const processor = this.dataProcessors.get('readmoo_books')
      if (!processor) {
        throw new Error('找不到資料處理器')
      }

      // 正規化原始資料格式
      let normalizedData = rawData
      if (Array.isArray(rawData)) {
        normalizedData = rawData
      } else if (rawData.books && Array.isArray(rawData.books)) {
        normalizedData = rawData.books
      } else if (rawData.booksData && Array.isArray(rawData.booksData)) {
        normalizedData = rawData.booksData
      } else {
        this.logger.warn('⚠️ 無法識別的資料格式:', typeof rawData)
        return null
      }

      // 處理資料
      const processedData = await processor(normalizedData)

      // 執行清理策略
      const cleanedData = await this.applyCleaningStrategies(processedData)

      // 驗證處理結果
      const validation = this.validationRules.get('extraction_result')(cleanedData)
      if (!validation.valid) {
        throw new Error(`資料驗證失敗: ${validation.errors.join(', ')}`)
      }

      this.logger.log(`✅ 資料處理完成: ${cleanedData.books.length} 本書籍`)
      return cleanedData
    } catch (error) {
      this.logger.error('❌ 處理提取資料失敗:', error)
      return null
    }
  }

  /**
   * 應用清理策略
   * @param {Object} data - 資料
   * @returns {Promise<Object>} 清理後的資料
   * @private
   */
  async applyCleaningStrategies (data) {
    const cleanedData = { ...data }

    // 去重
    const deduplicationResult = this.cleaningStrategies.get('deduplication')(cleanedData.books)
    cleanedData.books = deduplicationResult.books
    cleanedData.duplicatesRemoved = deduplicationResult.duplicatesRemoved

    // 資料完整性檢查
    const integrityResult = this.cleaningStrategies.get('data_integrity')(cleanedData.books)
    cleanedData.books = integrityResult.books
    cleanedData.invalidBooks = integrityResult.invalidBooks
    cleanedData.validCount = integrityResult.validCount
    cleanedData.invalidCount = integrityResult.invalidCount

    // 正規化
    const normalizationResult = this.cleaningStrategies.get('normalization')(cleanedData.books)
    cleanedData.books = normalizationResult.books

    // 更新摘要
    cleanedData.summary = {
      ...cleanedData.summary,
      totalBooks: cleanedData.books.length,
      duplicatesRemoved: cleanedData.duplicatesRemoved || 0,
      invalidBooks: cleanedData.invalidCount || 0,
      cleanedAt: Date.now()
    }

    this.logger.log(`🧹 清理策略應用完成: 有效書籍 ${cleanedData.validCount}, 移除重複 ${cleanedData.duplicatesRemoved}, 無效資料 ${cleanedData.invalidCount}`)

    return cleanedData
  }

  /**
   * 執行品質檢查
   * @param {Object} data - 資料
   * @returns {Promise<Object>} 品質檢查結果
   * @private
   */
  async performQualityCheck (data) {
    try {
      const books = data.books || []
      let score = 0
      const metrics = {}

      // 基本完整性檢查 (40%)
      const basicCompleteness = this.calculateBasicCompleteness(books)
      metrics.basicCompleteness = basicCompleteness
      score += basicCompleteness * 0.4

      // 資料豐富度檢查 (30%)
      const dataRichness = this.calculateDataRichness(books)
      metrics.dataRichness = dataRichness
      score += dataRichness * 0.3

      // 一致性檢查 (20%)
      const consistency = this.calculateDataConsistency(books)
      metrics.consistency = consistency
      score += consistency * 0.2

      // 完整性檢查 (10%)
      const completeness = this.calculateDataCompleteness(books)
      metrics.completeness = completeness
      score += completeness * 0.1

      const result = {
        score: Math.round(score),
        metrics,
        grade: this.getQualityGrade(score),
        recommendations: this.generateQualityRecommendations(metrics),
        checkedAt: Date.now(),
        totalBooks: books.length
      }

      this.logger.log(`🔍 品質檢查完成: 得分 ${result.score} (${result.grade})`)
      return result
    } catch (error) {
      this.logger.error('❌ 執行品質檢查失敗:', error)
      return {
        score: 0,
        metrics: {},
        grade: 'F',
        error: error.message,
        checkedAt: Date.now()
      }
    }
  }

  // ... [繼續實現其他方法，包括各種處理邏輯、工具方法等]

  /**
   * 清理字串
   * @param {string} str - 字串
   * @returns {string} 清理後的字串
   * @private
   */
  cleanString (str) {
    if (!str || typeof str !== 'string') return ''
    return str.trim().replace(/\s+/g, ' ')
  }

  /**
   * 正規化標籤
   * @param {*} tags - 標籤
   * @returns {Array} 正規化後的標籤陣列
   * @private
   */
  normalizeTags (tags) {
    if (!tags) return ['readmoo']

    if (typeof tags === 'string') {
      return [tags.trim(), 'readmoo']
    }

    if (Array.isArray(tags)) {
      const normalized = [...new Set(tags.filter(tag => tag && typeof tag === 'string').map(tag => tag.trim()))]
      if (!normalized.includes('readmoo')) {
        normalized.push('readmoo')
      }
      return normalized
    }

    return ['readmoo']
  }

  /**
   * 生成提取 ID
   * @param {number} tabId - 標籤頁 ID
   * @returns {string} 提取 ID
   * @private
   */
  generateExtractionId (tabId) {
    return `extraction_${tabId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 獲取提取狀態
   * @param {string} extractionId - 提取 ID (可選)
   * @returns {Object} 提取狀態
   */
  getExtractionState (extractionId = null) {
    if (extractionId) {
      return this.extractionStates.get(extractionId) || null
    }

    return {
      activeExtractions: Array.from(this.activeExtractions.entries()),
      allExtractions: Array.from(this.extractionStates.values()),
      extractionHistory: this.extractionHistory.slice(-10), // 最近10個
      qualityMetrics: this.qualityMetrics
    }
  }

  /**
   * 獲取統計資料
   * @returns {Object} 統計資料
   */
  getStats () {
    return {
      ...this.domainStats,
      qualityMetrics: this.qualityMetrics,
      activeExtractionsCount: this.activeExtractions.size,
      extractionHistoryCount: this.extractionHistory.length
    }
  }
}

module.exports = ExtractionDomainHandler
