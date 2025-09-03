/**
 * @fileoverview DataNormalizationService - 資料標準化和轉換服務
 * @version 1.0.0
 * @since 2025-08-19
 *
 * 負責功能：
 * - 書籍資料標準化和格式統一
 * - 跨平台資料ID生成和資料指紋計算
 * - 各欄位的智能清理和格式轉換
 * - 標準化品質報告和變更追蹤
 *
 * 設計考量：
 * - 實作 IDataNormalizer 介面契約
 * - 支援多平台資料格式的統一轉換
 * - 提供可逆和不可逆的標準化選項
 * - 高效能的批次標準化處理能力
 *
 * 處理流程：
 * 1. 接收原始書籍資料和平台資訊
 * 2. 執行各欄位的專項標準化處理
 * 3. 生成跨平台統一識別ID和資料指紋
 * 4. 產生詳細的標準化報告和品質評分
 * 5. 返回完整的標準化結果物件
 *
 * 使用情境：
 * - ValidationServiceCoordinator 的資料預處理
 * - 跨平台資料同步前的格式統一
 * - 資料品質提升和清理工作
 * - 資料一致性檢查和修復
 */

const crypto = require('crypto')

class DataNormalizationService {
  /**
   * 建構資料標準化服務
   * @param {Object} options - 標準化服務配置選項
   */
  constructor (options = {}) {
    // 標準化服務配置
    this.config = {
      enableFingerprinting: options.enableFingerprinting !== false,
      crossPlatformIdGeneration: options.crossPlatformIdGeneration !== false,
      strictNormalization: options.strictNormalization || false,
      preserveOriginalFormat: options.preserveOriginalFormat || false,
      enableQualityScoring: options.enableQualityScoring !== false,
      maxTitleLength: options.maxTitleLength || 500,
      maxAuthorNameLength: options.maxAuthorNameLength || 100,
      urlNormalization: options.urlNormalization !== false,
      ...options
    }

    // 標準化統計
    this.stats = {
      totalNormalizations: 0,
      fieldChanges: {
        title: 0,
        authors: 0,
        cover: 0,
        progress: 0,
        other: 0
      },
      averageQualityScore: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0
    }

    this.isInitialized = true
  }

  /**
   * 標準化書籍資料
   * @param {Object} book - 原始書籍資料
   * @param {string} platform - 平台名稱
   * @returns {Promise<Object>} 標準化結果
   */
  async normalizeBook (book, platform) {
    const startTime = Date.now()

    // 輸入驗證
    this._validateInputs(book, platform)

    const normalizationReport = {
      fieldsProcessed: 0,
      changesApplied: [],
      warningsGenerated: [],
      qualityScore: 0
    }

    // 建立標準化資料副本
    const normalizedData = { ...book }

    try {
      // 各欄位標準化處理
      this._normalizeFields(normalizedData, normalizationReport)

      // 生成跨平台ID（如果啟用）
      let crossPlatformId = null
      if (this.config.crossPlatformIdGeneration) {
        crossPlatformId = await this.generateCrossPlatformId(normalizedData)
      }

      // 生成資料指紋（如果啟用）
      let dataFingerprint = null
      if (this.config.enableFingerprinting) {
        dataFingerprint = await this.generateDataFingerprint(normalizedData)
      }

      // 計算品質分數
      if (this.config.enableQualityScoring) {
        normalizationReport.qualityScore = this._calculateQualityScore(normalizedData)
      }

      const processingTime = Date.now() - startTime

      // 更新統計
      this._updateStatistics(processingTime, normalizationReport)

      return {
        originalData: this.config.preserveOriginalFormat ? book : undefined,
        normalizedData,
        crossPlatformId,
        dataFingerprint,
        normalizationReport,
        processingTime,
        timestamp: Date.now()
      }
    } catch (error) {
      throw new Error(`Normalization failed: ${error.message}`)
    }
  }

  /**
   * 生成跨平台統一ID
   * @param {Object} book - 書籍資料
   * @returns {Promise<string>} 跨平台ID
   */
  async generateCrossPlatformId (book) {
    // 使用關鍵識別欄位生成統一ID
    const identifiers = []

    // 優先使用ISBN（如果存在，僅使用ISBN作為唯一標識）
    if (book.isbn) {
      identifiers.push(`isbn:${book.isbn}`)
    } else {
      // 沒有ISBN時使用標準化後的標題和作者
      if (book.title) {
        const normalizedTitle = this.normalizeTitle(book.title)
        identifiers.push(`title:${normalizedTitle.toLowerCase()}`)
      }

      if (book.authors && Array.isArray(book.authors)) {
        const normalizedAuthors = this.normalizeAuthors(book.authors)
        const authorsString = normalizedAuthors.join(',').toLowerCase()
        identifiers.push(`authors:${authorsString}`)
      }
    }

    // 生成基於內容的雜湊ID
    const content = identifiers.join('|')
    const hash = crypto.createHash('sha256').update(content).digest('hex')

    return `cross_${hash.substring(0, 16)}`
  }

  /**
   * 生成資料指紋
   * @param {Object} book - 書籍資料
   * @returns {Promise<string>} 資料指紋
   */
  async generateDataFingerprint (book) {
    // 建立資料指紋的標準化內容
    const fingerprintData = {
      id: book.id || '',
      title: book.title || '',
      authors: book.authors || [],
      progress: book.progress || 0,
      lastUpdated: book.lastUpdated || '',
      cover: book.cover || ''
    }

    // 生成JSON字串並計算雜湊
    const content = JSON.stringify(fingerprintData, Object.keys(fingerprintData).sort())
    const hash = crypto.createHash('sha256').update(content).digest('hex')

    return hash
  }

  /**
   * 標準化標題
   * @param {string} title - 原始標題
   * @returns {string} 標準化標題
   */
  normalizeTitle (title) {
    if (!title || typeof title !== 'string') {
      return ''
    }

    const normalized = title
      .trim() // 移除前後空白
      .replace(/\s+/g, ' ') // 標準化多重空白為單一空白
      .substring(0, this.config.maxTitleLength) // 限制長度

    return normalized
  }

  /**
   * 標準化作者資訊
   * @param {string|Array} authors - 原始作者資料
   * @returns {Array} 標準化作者陣列
   */
  normalizeAuthors (authors) {
    if (!authors) {
      return []
    }

    // 轉換為陣列格式
    const authorArray = Array.isArray(authors) ? authors : [authors]

    // 清理和標準化每個作者名稱
    return authorArray
      .filter(author => author && typeof author === 'string')
      .map(author => author
        .trim()
        .substring(0, this.config.maxAuthorNameLength)
      )
      .filter(author => author.length > 0) // 移除空字串
  }

  /**
   * 標準化封面URL
   * @param {string} cover - 原始封面URL
   * @returns {string} 標準化封面URL
   */
  normalizeCover (cover) {
    if (!cover || typeof cover !== 'string') {
      return ''
    }

    if (!this.config.urlNormalization) {
      return cover.trim()
    }

    const normalized = cover.trim()

    // 檢查是否為有效URL
    try {
      const url = new URL(normalized)

      // 清理查詢參數（保留重要參數）
      const importantParams = ['width', 'height', 'quality']
      const newSearchParams = new URLSearchParams()

      for (const [key, value] of url.searchParams) {
        if (importantParams.includes(key.toLowerCase())) {
          newSearchParams.set(key, value)
        }
      }

      url.search = newSearchParams.toString()
      return url.toString()
    } catch (error) {
      // 不是有效URL，可能是相對路徑
      return ''
    }
  }

  /**
   * 標準化各欄位
   * @private
   */
  _normalizeFields (data, report) {
    // 標準化ID
    if (data.id && typeof data.id === 'string') {
      const original = data.id
      data.id = data.id.trim()
      if (original !== data.id) {
        report.changesApplied.push({ field: 'id', type: 'trimmed', before: original, after: data.id })
        this.stats.fieldChanges.other++
      }
      report.fieldsProcessed++
    }

    // 標準化標題
    if (data.title) {
      const original = data.title
      data.title = this.normalizeTitle(data.title)
      if (original !== data.title) {
        report.changesApplied.push({ field: 'title', type: 'normalized', before: original, after: data.title })
        this.stats.fieldChanges.title++
      }
      report.fieldsProcessed++
    }

    // 標準化作者
    if (data.authors) {
      const original = JSON.stringify(data.authors)
      data.authors = this.normalizeAuthors(data.authors)
      const normalized = JSON.stringify(data.authors)
      if (original !== normalized) {
        report.changesApplied.push({ field: 'authors', type: 'normalized', changeCount: 1 })
        this.stats.fieldChanges.authors++
      }
      report.fieldsProcessed++
    }

    // 標準化封面
    if (data.cover) {
      const original = data.cover
      data.cover = this.normalizeCover(data.cover)
      if (original !== data.cover) {
        report.changesApplied.push({ field: 'cover', type: 'normalized', before: original, after: data.cover })
        this.stats.fieldChanges.cover++
      }
      report.fieldsProcessed++
    }

    // 標準化進度
    if (data.progress !== undefined) {
      const original = data.progress
      if (typeof data.progress === 'string') {
        data.progress = parseFloat(data.progress)
        if (!isNaN(data.progress)) {
          report.changesApplied.push({ field: 'progress', type: 'type_conversion', before: original, after: data.progress })
          this.stats.fieldChanges.progress++
        } else {
          data.progress = 0
          report.warningsGenerated.push({ field: 'progress', issue: 'invalid_number_format', value: original })
        }
      }
      report.fieldsProcessed++
    }

    // 標準化時間戳
    if (data.lastUpdated) {
      const original = data.lastUpdated
      try {
        // 確保時間戳為ISO格式
        const date = new Date(data.lastUpdated)
        if (!isNaN(date.getTime())) {
          data.lastUpdated = date.toISOString()
          if (original !== data.lastUpdated) {
            report.changesApplied.push({ field: 'lastUpdated', type: 'iso_format', before: original, after: data.lastUpdated })
          }
        }
      } catch (error) {
        report.warningsGenerated.push({ field: 'lastUpdated', issue: 'invalid_date_format', value: original })
      }
      report.fieldsProcessed++
    }
  }

  /**
   * 計算資料品質分數
   * @private
   */
  _calculateQualityScore (data) {
    let score = 0
    let maxScore = 0

    // 基本欄位存在性檢查
    const requiredFields = ['id', 'title', 'authors']
    requiredFields.forEach(field => {
      maxScore += 20
      if (this._hasValue(data[field])) {
        score += 20
      }
    })

    // 可選欄位存在性檢查
    const optionalFields = ['progress', 'cover', 'lastUpdated']
    optionalFields.forEach(field => {
      maxScore += 10
      if (this._hasValue(data[field])) {
        score += 10
      }
    })

    // 資料品質檢查
    maxScore += 20
    if (data.title && data.title.length >= 3) score += 5 // 標題長度適中
    if (data.authors && data.authors.length > 0) score += 5 // 有作者資訊
    if (data.progress >= 0 && data.progress <= 100) score += 5 // 進度合理
    if (data.cover && this._isValidUrl(data.cover)) score += 5 // 封面URL有效

    return Math.round((score / maxScore) * 100)
  }

  /**
   * 輔助方法
   * @private
   */
  _validateInputs (book, platform) {
    if (!book || typeof book !== 'object') {
      throw new Error('Invalid book data')
    }
    if (!platform || typeof platform !== 'string') {
      throw new Error('Platform is required')
    }
  }

  _hasValue (value) {
    return value !== undefined &&
           value !== null &&
           value !== '' &&
           (Array.isArray(value) ? value.length > 0 : true)
  }

  _isValidUrl (urlString) {
    try {
      const url = new URL(urlString)
      return url instanceof URL
    } catch {
      return false
    }
  }

  _updateStatistics (processingTime, report) {
    this.stats.totalNormalizations++
    this.stats.totalProcessingTime += processingTime
    this.stats.averageProcessingTime = this.stats.totalProcessingTime / this.stats.totalNormalizations

    if (report.qualityScore > 0) {
      this.stats.averageQualityScore = (this.stats.averageQualityScore * (this.stats.totalNormalizations - 1) + report.qualityScore) / this.stats.totalNormalizations
    }
  }

  /**
   * 獲取統計資訊
   * @returns {Object} 統計資訊
   */
  getStatistics () {
    return {
      ...this.stats,
      config: this.config,
      timestamp: Date.now()
    }
  }

  /**
   * 重置統計計數器
   */
  resetStatistics () {
    this.stats = {
      totalNormalizations: 0,
      fieldChanges: {
        title: 0,
        authors: 0,
        cover: 0,
        progress: 0,
        other: 0
      },
      averageQualityScore: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0
    }
  }

  /**
   * 更新配置
   * @param {Object} newConfig - 新配置
   */
  updateConfig (newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    }
  }
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataNormalizationService
}

// 瀏覽器環境支援
if (typeof window !== 'undefined') {
  window.DataNormalizationService = DataNormalizationService
}
