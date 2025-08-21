/**
 * @fileoverview Data Normalization Service - 資料正規化服務
 * @version v0.9.21
 * @since 2025-08-21
 *
 * 從 DataValidationService 提取的資料正規化邏輯
 *
 * 負責功能：
 * - 書籍資料標準化為 v2.0 統一格式
 * - 跨平台資料正規化和識別ID生成
 * - 資料指紋生成確保唯一性
 * - 平台特定欄位映射和轉換
 *
 * 設計原則：
 * - 單一職責：專注於資料格式標準化
 * - 跨平台一致性：統一的資料結構和識別
 * - 可追溯性：保留原始資料來源和轉換紀錄
 * - 容錯性：優雅處理缺失或錯誤資料
 */

const BaseModule = require('../../../lifecycle/base-module.js')
const crypto = require('crypto')

class DataNormalizationService extends BaseModule {
  /**
   * 初始化資料正規化服務
   * @param {EventBus} eventBus - 事件總線實例
   * @param {Object} dependencies - 依賴注入物件
   */
  constructor (eventBus, dependencies = {}) {
    if (!eventBus) {
      throw new Error('EventBus is required')
    }

    super({
      eventBus,
      logger: dependencies.logger || console,
      config: dependencies.config || {}
    })

    this.eventBus = eventBus
    this.logger = dependencies.logger || console

    // 合併預設配置
    this.config = this.mergeWithDefaults(dependencies.config || {})

    // 正規化統計
    this.normalizationStatistics = {
      totalNormalized: 0,
      errorCount: 0,
      platformBreakdown: {},
      lastNormalizationTime: null
    }
  }

  /**
   * 合併預設配置
   */
  mergeWithDefaults (userConfig) {
    const defaults = {
      enableDataFingerprint: true,
      enableCrossPlatformId: true,
      supportedPlatforms: ['READMOO', 'KINDLE', 'KOBO', 'BOOKWALKER', 'BOOKS_COM']
    }

    return {
      ...defaults,
      ...userConfig
    }
  }

  /**
   * 標準化書籍資料為 v2.0 統一格式
   * @param {Object} book - 原始書籍資料
   * @param {string} platform - 平台名稱
   * @returns {Object} 標準化後的書籍資料
   */
  async normalizeBook (book, platform) {
    try {
      this._validateBookData(book)
      const normalizedData = await this._buildNormalizedBook(book, platform)
      this.updateNormalizationStatistics(platform)
      return normalizedData
    } catch (error) {
      return this._handleNormalizationError(error, book, platform)
    }
  }

  /**
   * 驗證書籍資料
   * @param {Object} book - 書籍資料
   * @private
   */
  _validateBookData (book) {
    if (!book) {
      throw new Error('書籍資料為空')
    }
  }

  /**
   * 建立標準化書籍物件
   * @param {Object} book - 原始書籍資料
   * @param {string} platform - 平台名稱
   * @returns {Object} 標準化書籍資料
   * @private
   */
  async _buildNormalizedBook (book, platform) {
    const identificationData = await this._createIdentificationData(book, platform)
    const basicBookData = this._createBasicBookData(book)
    const statusData = this._createStatusData(book)
    const metaData = this._createMetaData(book, platform, identificationData.dataFingerprint)

    return { ...identificationData, ...basicBookData, ...statusData, ...metaData }
  }

  /**
   * 建立識別資料
   * @param {Object} book - 原始書籍資料
   * @param {string} platform - 平台名稱
   * @returns {Object} 識別資料
   * @private
   */
  async _createIdentificationData (book, platform) {
    const crossPlatformId = await this._generateCrossPlatformIdIfEnabled(book)
    const dataFingerprint = await this._generateDataFingerprintIfEnabled(book)

    return {
      id: this._extractBookId(book),
      crossPlatformId,
      platform,
      dataFingerprint
    }
  }

  /**
   * 建立基本書籍資料
   * @param {Object} book - 原始書籍資料
   * @returns {Object} 基本書籍資料
   * @private
   */
  _createBasicBookData (book) {
    return {
      title: this.normalizeTitle(book.title),
      authors: this.normalizeAuthors(book.authors || book.author || book.contributors),
      publisher: book.publisher || book.imprint || '',
      isbn: this.normalizeISBN(book.isbn),
      cover: this.normalizeCover(book.cover)
    }
  }

  /**
   * 建立狀態相關資料
   * @param {Object} book - 原始書籍資料
   * @returns {Object} 狀態資料
   * @private
   */
  _createStatusData (book) {
    return {
      progress: this.normalizeProgress(book.progress || book.reading_progress || book.reading_state),
      status: this.normalizeReadingStatus(book.status || book.isFinished),
      rating: this._normalizeRating(book.rating),
      tags: this._normalizeTags(book.tags),
      price: book.price || book.kindle_price || null,
      purchaseDate: book.purchaseDate || book.purchase_date || null,
      genre: book.genre || book.category || '',
      series: book.series || '',
      volume: this._normalizeVolume(book.volume)
    }
  }

  /**
   * 建立元資料
   * @param {Object} book - 原始書籍資料
   * @param {string} platform - 平台名稱
   * @param {string} dataFingerprint - 資料指紋
   * @returns {Object} 元資料
   * @private
   */
  _createMetaData (book, platform, dataFingerprint) {
    const now = new Date().toISOString()

    return {
      source: platform,
      lastUpdated: now,
      normalizedAt: now,
      version: '2.0.0',
      _original: this._createOriginalDataRecord(book, platform, now)
    }
  }

  /**
   * 標準化標題
   * @param {string} title - 原始標題
   * @returns {string} 標準化標題
   */
  normalizeTitle (title) {
    if (!title) return ''
    return title.trim().replace(/\s+/g, ' ')
  }

  /**
   * 標準化作者
   * @param {Array|string} authors - 原始作者資料
   * @returns {Array} 標準化作者陣列
   */
  normalizeAuthors (authors) {
    if (!authors) return []

    if (typeof authors === 'string') {
      // 處理逗號分隔的作者字串
      return authors.split(',').map(author => author.trim()).filter(Boolean)
    }

    if (Array.isArray(authors)) {
      return authors.map(author => {
        if (typeof author === 'string') {
          return author.trim()
        }
        // 處理 Kindle 的 { name: 'Author Name' } 格式
        if (typeof author === 'object' && author.name) {
          return author.name.trim()
        }
        return String(author).trim()
      }).filter(Boolean)
    }

    return []
  }

  /**
   * 標準化 ISBN
   * @param {string} isbn - 原始 ISBN
   * @returns {string} 標準化 ISBN
   */
  normalizeISBN (isbn) {
    if (!isbn) return ''
    return String(isbn).replace(/[-\s:]/g, '').replace(/^isbn/i, '')
  }

  /**
   * 標準化封面
   * @param {string|Object} cover - 原始封面資料
   * @returns {Object} 標準化封面物件
   */
  normalizeCover (cover) {
    const defaultCover = {
      thumbnail: '',
      small: '',
      medium: '',
      large: '',
      original: ''
    }

    if (!cover) {
      return defaultCover
    }

    if (typeof cover === 'string') {
      return {
        thumbnail: cover,
        small: cover,
        medium: cover,
        large: cover,
        original: cover
      }
    }

    if (typeof cover === 'object') {
      return {
        thumbnail: cover.thumbnail || cover.small || cover.url || '',
        small: cover.small || cover.thumbnail || cover.url || '',
        medium: cover.medium || cover.url || '',
        large: cover.large || cover.url || '',
        original: cover.original || cover.large || cover.url || ''
      }
    }

    return defaultCover
  }

  /**
   * 標準化進度
   * @param {number|Object} progress - 原始進度資料
   * @returns {Object} 標準化進度物件
   */
  normalizeProgress (progress) {
    const defaultProgress = {
      percentage: 0,
      pages: null,
      locations: null,
      lastRead: null
    }

    if (!progress) {
      return defaultProgress
    }

    if (typeof progress === 'number') {
      return {
        ...defaultProgress,
        percentage: Math.max(0, Math.min(100, progress))
      }
    }

    if (typeof progress === 'object') {
      const normalized = { ...defaultProgress }

      // 處理百分比
      const percentage = progress.percentage || progress.reading_percentage || 0
      normalized.percentage = Math.max(0, Math.min(100, percentage))

      // 處理頁數（Kobo 格式）
      if (progress.current_page || progress.total_pages) {
        normalized.pages = {
          current: progress.current_page || 0,
          total: progress.total_pages || 0
        }
      }

      // 處理位置（Kindle 格式）
      if (progress.location || progress.totalLocations) {
        normalized.locations = {
          current: progress.location || 0,
          total: progress.totalLocations || 0
        }
      }

      // 最後閱讀時間
      if (progress.lastRead || progress.last_read_time) {
        normalized.lastRead = progress.lastRead || progress.last_read_time
      }

      return normalized
    }

    return defaultProgress
  }

  /**
   * 標準化閱讀狀態
   * @param {boolean|string} status - 原始狀態
   * @returns {string} 標準化狀態
   */
  normalizeReadingStatus (status) {
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

    // 預設為 READING 狀態
    return 'READING'
  }

  /**
   * 提取書籍ID
   * @param {Object} book - 書籍資料
   * @returns {string} 書籍ID
   * @private
   */
  _extractBookId (book) {
    return book.id || book.ASIN || book.kobo_id || ''
  }

  /**
   * 標準化評分
   * @param {number} rating - 原始評分
   * @returns {number} 標準化評分
   * @private
   */
  _normalizeRating (rating) {
    return typeof rating === 'number' ? Math.max(0, Math.min(5, rating)) : 0
  }

  /**
   * 標準化標籤
   * @param {Array} tags - 原始標籤
   * @returns {Array} 標準化標籤
   * @private
   */
  _normalizeTags (tags) {
    return Array.isArray(tags) ? tags : []
  }

  /**
   * 標準化冊數
   * @param {number} volume - 原始冊數
   * @returns {number|null} 標準化冊數
   * @private
   */
  _normalizeVolume (volume) {
    return typeof volume === 'number' ? volume : null
  }

  /**
   * 產生跨平台ID（如果啟用）
   * @param {Object} book - 書籍資料
   * @returns {string|null} 跨平台ID
   * @private
   */
  async _generateCrossPlatformIdIfEnabled (book) {
    return this.config.enableCrossPlatformId
      ? await this.generateCrossPlatformId(book)
      : null
  }

  /**
   * 產生資料指紋（如果啟用）
   * @param {Object} book - 書籍資料
   * @returns {string|null} 資料指紋
   * @private
   */
  async _generateDataFingerprintIfEnabled (book) {
    return this.config.enableDataFingerprint
      ? await this.generateDataFingerprint(book)
      : null
  }

  /**
   * 建立原始資料記錄
   * @param {Object} book - 書籍資料
   * @param {string} platform - 平台名稱
   * @param {string} timestamp - 時間戳記
   * @returns {Object} 原始資料記錄
   * @private
   */
  _createOriginalDataRecord (book, platform, timestamp) {
    return {
      platform,
      timestamp,
      dataKeys: Object.keys(book)
    }
  }

  /**
   * 處理正規化錯誤
   * @param {Error} error - 錯誤物件
   * @param {Object} book - 書籍資料
   * @param {string} platform - 平台名稱
   * @returns {Object} 錯誤處理結果
   * @private
   */
  async _handleNormalizationError (error, book, platform) {
    this.normalizationStatistics.errorCount++
    await this.log(`正規化書籍失敗: ${error.message}`, 'error')

    return this._createErrorFallbackResult(error, book, platform)
  }

  /**
   * 建立錯誤回傳結果
   * @param {Error} error - 錯誤物件
   * @param {Object} book - 書籍資料
   * @param {string} platform - 平台名稱
   * @returns {Object} 錯誤回傳結果
   * @private
   */
  _createErrorFallbackResult (error, book, platform) {
    return {
      id: book?.id || 'unknown',
      platform,
      title: book?.title || 'Unknown Title',
      authors: [],
      error: error.message,
      normalizedAt: new Date().toISOString()
    }
  }

  /**
   * 生成資料指紋
   * @param {Object} book - 書籍資料
   * @returns {string} 資料指紋
   */
  async generateDataFingerprint (book) {
    // 只使用核心欄位來生成指紋，忽略平台特定和動態欄位
    const coreData = {
      title: (book.title || '').trim().toLowerCase(),
      authors: this.normalizeAuthors(book.authors || book.author || book.contributors),
      isbn: this.normalizeISBN(book.isbn)
    }

    const dataString = JSON.stringify(coreData)
    return crypto.createHash('sha256').update(dataString).digest('hex').substring(0, 16)
  }

  /**
   * 生成跨平台統一ID
   * @param {Object} book - 書籍資料
   * @returns {string} 跨平台ID
   */
  async generateCrossPlatformId (book) {
    // 使用核心識別資訊生成統一ID
    const identifiers = [
      (book.title || '').trim().toLowerCase(),
      this.normalizeAuthors(book.authors || book.author || book.contributors).join('|'),
      this.normalizeISBN(book.isbn)
    ].filter(Boolean)

    if (identifiers.length === 0) {
      return crypto.randomBytes(8).toString('hex')
    }

    const idString = identifiers.join('::')
    return crypto.createHash('md5').update(idString).digest('hex')
  }

  /**
   * 批次正規化書籍
   * @param {Array} books - 書籍陣列
   * @param {string} platform - 平台名稱
   * @returns {Object} 批次正規化結果
   */
  async normalizeBookBatch (books, platform) {
    const normalizedBooks = []
    const errors = []

    await this._processBooksInBatch(books, platform, normalizedBooks, errors)
    return this._createBatchResult(books, normalizedBooks, errors)
  }

  /**
   * 批次處理書籍
   * @param {Array} books - 書籍陣列
   * @param {string} platform - 平台名稱
   * @param {Array} normalizedBooks - 正規化結果陣列
   * @param {Array} errors - 錯誤陣列
   * @private
   */
  async _processBooksInBatch (books, platform, normalizedBooks, errors) {
    for (let i = 0; i < books.length; i++) {
      await this._processSingleBookInBatch(books[i], i, platform, normalizedBooks, errors)
    }
  }

  /**
   * 處理單一書籍
   * @param {Object} book - 書籍資料
   * @param {number} index - 索引
   * @param {string} platform - 平台名稱
   * @param {Array} normalizedBooks - 正規化結果陣列
   * @param {Array} errors - 錯誤陣列
   * @private
   */
  async _processSingleBookInBatch (book, index, platform, normalizedBooks, errors) {
    try {
      this._validateBatchBookData(book, index, errors)
      const normalized = await this.normalizeBook(book, platform)
      normalizedBooks.push(normalized)
    } catch (error) {
      this._addBatchError(error, book, index, errors)
    }
  }

  /**
   * 驗證批次書籍資料
   * @param {Object} book - 書籍資料
   * @param {number} index - 索引
   * @param {Array} errors - 錯誤陣列
   * @private
   */
  _validateBatchBookData (book, index, errors) {
    if (book === null || book === undefined) {
      errors.push({ index, error: '書籍資料為空' })
      throw new Error('書籍資料為空')
    }
  }

  /**
   * 新增批次錯誤
   * @param {Error} error - 錯誤物件
   * @param {Object} book - 書籍資料
   * @param {number} index - 索引
   * @param {Array} errors - 錯誤陣列
   * @private
   */
  _addBatchError (error, book, index, errors) {
    if (book !== null && book !== undefined) {
      errors.push({ index, book, error: error.message })
    }
  }

  /**
   * 建立批次處理結果
   * @param {Array} books - 原始書籍陣列
   * @param {Array} normalizedBooks - 正規化結果陣列
   * @param {Array} errors - 錯誤陣列
   * @returns {Object} 批次處理結果
   * @private
   */
  _createBatchResult (books, normalizedBooks, errors) {
    return {
      normalizedBooks,
      errors,
      totalProcessed: books.length,
      successCount: normalizedBooks.length,
      errorCount: errors.length
    }
  }

  /**
   * 更新正規化統計
   */
  updateNormalizationStatistics (platform) {
    this.normalizationStatistics.totalNormalized++
    this.normalizationStatistics.platformBreakdown[platform] = 
      (this.normalizationStatistics.platformBreakdown[platform] || 0) + 1
    this.normalizationStatistics.lastNormalizationTime = Date.now()
  }

  /**
   * 獲取正規化統計
   * @returns {Object} 統計資訊
   */
  getNormalizationStatistics () {
    return {
      totalNormalized: this.normalizationStatistics.totalNormalized,
      errorCount: this.normalizationStatistics.errorCount,
      platformBreakdown: { ...this.normalizationStatistics.platformBreakdown },
      lastNormalizationTime: this.normalizationStatistics.lastNormalizationTime
    }
  }

  /**
   * 重置統計數據
   */
  resetStatistics () {
    this.normalizationStatistics = {
      totalNormalized: 0,
      errorCount: 0,
      platformBreakdown: {},
      lastNormalizationTime: null
    }
  }

  /**
   * 檢查服務健康狀態
   * @returns {Object} 健康狀態
   */
  isNormalizationServiceHealthy () {
    const stats = this.normalizationStatistics
    const errorRate = stats.totalNormalized > 0 ? stats.errorCount / stats.totalNormalized : 0

    return {
      isHealthy: errorRate < 0.1, // 錯誤率低於 10%
      normalizationStatistics: stats,
      errorRate,
      lastCheck: Date.now()
    }
  }

  /**
   * 記錄日誌
   * @param {string} message - 日誌訊息
   * @param {string} level - 日誌級別
   */
  async log (message, level = 'info') {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] [DataNormalizationService] ${message}`

    if (this.logger && this.logger[level]) {
      this.logger[level](logMessage)
    } else {
      console.log(logMessage)
    }
  }
}

module.exports = DataNormalizationService