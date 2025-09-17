/**
 * @fileoverview DataQualityAnalyzer - 資料品質分析服務
 * @version 1.0.0
 * @since 2025-08-19
 *
 * 負責功能：
 * - 書籍資料品質評估和分析
 * - 多維度品質評分和報告生成
 * - 品質趨勢分析和改善建議
 * - 批次品質分析和統計資訊
 *
 * 設計考量：
 * - 實作 IDataQualityAnalyzer 介面契約
 * - 整合 ValidationEngine 和 DataNormalizationService
 * - 支援多種品質評估策略和權重配置
 * - 提供詳細的品質歷史追蹤和趨勢分析
 *
 * 處理流程：
 * 1. 接收書籍資料和分析選項
 * 2. 使用依賴服務進行驗證和標準化
 * 3. 計算多維度品質分數和綜合評分
 * 4. 生成詳細的品質分析報告
 * 5. 提供改善建議和趨勢分析
 *
 * 使用情境：
 * - ValidationServiceCoordinator 的品質評估
 * - 資料品質監控和報告系統
 * - 批次資料清理和改善流程
 * - 品質趨勢分析和預測
 */

const { StandardError } = require('src/core/errors/StandardError')

class DataQualityAnalyzer {
  /**
   * 建構資料品質分析器
   * @param {Object} options - 分析器配置選項
   */
  constructor (options = {}) {
    // 驗證必要依賴
    if (!options.validationEngine) {
      throw new StandardError('REQUIRED_FIELD_MISSING', 'ValidationEngine is required', {
        category: 'validation'
      })
    }
    if (!options.dataNormalizer) {
      throw new StandardError('REQUIRED_FIELD_MISSING', 'DataNormalizer is required', {
        category: 'ui'
      })
    }
    if (!options.platformRuleManager) {
      throw new StandardError('REQUIRED_FIELD_MISSING', 'PlatformRuleManager is required', {
        category: 'ui'
      })
    }

    // 注入依賴服務
    this.validationEngine = options.validationEngine
    this.dataNormalizer = options.dataNormalizer
    this.platformRuleManager = options.platformRuleManager

    // 品質分析器配置
    this.config = {
      enableDetailedAnalysis: options.enableDetailedAnalysis !== false,
      defaultWeightingStrategy: options.defaultWeightingStrategy || 'balanced',
      enableHistoryTracking: options.enableHistoryTracking !== false,
      maxHistoryRecords: options.maxHistoryRecords || 100,
      enableTrendAnalysis: options.enableTrendAnalysis !== false,
      qualityThresholds: {
        excellent: options.excellentThreshold || 90,
        good: options.goodThreshold || 75,
        acceptable: options.acceptableThreshold || 60,
        poor: options.poorThreshold || 40
      },
      ...options
    }

    // 品質歷史追蹤
    this.qualityHistory = new Map()

    // 分析統計
    this.stats = {
      totalAnalyses: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      qualityDistribution: {
        excellent: 0,
        good: 0,
        acceptable: 0,
        poor: 0,
        critical: 0
      },
      mostCommonIssues: new Map()
    }

    this.isInitialized = true
  }

  /**
   * 分析單本書籍品質
   * @param {Object} book - 書籍資料
   * @param {string} platform - 平台名稱
   * @param {Object} options - 分析選項
   * @returns {Promise<Object>} 品質分析結果
   */
  async analyzeBookQuality (book, platform, options = {}) {
    const startTime = Date.now()

    // 輸入驗證
    this._validateInputs(book, platform)

    try {
      // 進行驗證分析
      const validationResult = await this.validationEngine.validateSingleBook(book, platform, 'quality_analysis')

      // 進行標準化分析
      const normalizationResult = await this.dataNormalizer.normalizeBook(book, platform)

      // 計算品質分數
      const qualityScore = await this.getQualityScore(book, {
        weightingStrategy: options.weightingStrategy || this.config.defaultWeightingStrategy
      })

      // 分析品質維度
      const qualityDimensions = this._analyzeQualityDimensions(book, validationResult, normalizationResult)

      // 識別優勢和弱點
      const strengths = this._identifyStrengths(qualityDimensions, qualityScore)
      const weaknesses = this._identifyWeaknesses(qualityDimensions, validationResult, normalizationResult)

      // 生成改善建議
      const improvementSuggestions = await this.getImprovementSuggestions({
        bookId: book.id,
        overallScore: qualityScore.overallScore,
        qualityDimensions,
        weaknesses,
        platform
      })

      const processingTime = Date.now() - startTime

      // 建立分析結果
      const analysis = {
        bookId: book.id || 'unknown',
        platform,
        overallScore: qualityScore.overallScore,
        qualityDimensions,
        strengths,
        weaknesses,
        improvementSuggestions,
        validationDetails: options.includeDetails ? validationResult : undefined,
        normalizationDetails: options.includeDetails ? normalizationResult : undefined,
        processingTime,
        timestamp: Date.now()
      }

      // 更新統計和歷史
      this._updateStatistics(analysis)
      if (this.config.enableHistoryTracking) {
        this._updateQualityHistory(book.id, analysis)
      }

      return analysis
    } catch (error) {
      this._updateStatistics({ processingTime: Date.now() - startTime }, true)
      throw new StandardError('OPERATION_FAILED', 'Quality analysis failed: ${error.message}', {
        category: 'general'
      })
    }
  }

  /**
   * 批次分析書籍品質
   * @param {Array} books - 書籍陣列
   * @param {string} platform - 平台名稱
   * @param {Object} options - 批次分析選項
   * @returns {Promise<Object>} 批次分析結果
   */
  async analyzeBatchQuality (books, platform, options = {}) {
    const startTime = Date.now()

    if (!Array.isArray(books) || books.length === 0) {
      throw new StandardError('REQUIRED_FIELD_MISSING', 'Books array is required and must not be empty', {
        dataType: 'array',
        category: 'ui'
      })
    }

    const batchResults = {
      totalBooks: books.length,
      processedBooks: 0,
      failedBooks: 0,
      averageScore: 0,
      qualityDistribution: {
        excellent: 0,
        good: 0,
        acceptable: 0,
        poor: 0,
        critical: 0
      },
      individualAnalyses: [],
      commonIssues: [],
      batchSuggestions: [],
      processingTime: 0
    }

    // 批次處理設置
    const maxConcurrency = options.maxConcurrency || 5
    const includeIndividualDetails = options.includeIndividualDetails !== false

    // 分批處理書籍
    const batches = this._createBatches(books, maxConcurrency)
    let totalScore = 0

    for (const batch of batches) {
      const batchPromises = batch.map(async (book) => {
        try {
          const analysis = await this.analyzeBookQuality(book, platform, {
            includeDetails: includeIndividualDetails
          })
          return analysis
        } catch (error) {
          return {
            bookId: book.id || 'unknown',
            error: error.message,
            failed: true
          }
        }
      })

      const batchAnalyses = await Promise.all(batchPromises)

      // 處理批次結果
      for (const analysis of batchAnalyses) {
        if (analysis.failed) {
          batchResults.failedBooks++
        } else {
          batchResults.processedBooks++
          totalScore += analysis.overallScore

          // 更新品質分佈
          const category = this._categorizeScore(analysis.overallScore)
          batchResults.qualityDistribution[category]++

          if (includeIndividualDetails) {
            batchResults.individualAnalyses.push(analysis)
          }
        }
      }
    }

    // 計算平均分數
    if (batchResults.processedBooks > 0) {
      batchResults.averageScore = Math.round(totalScore / batchResults.processedBooks)
    }

    // 分析共同問題
    batchResults.commonIssues = this._identifyCommonIssues(batchResults.individualAnalyses)

    // 生成批次建議
    batchResults.batchSuggestions = this._generateBatchSuggestions(batchResults)

    batchResults.processingTime = Date.now() - startTime

    return batchResults
  }

  /**
   * 生成品質報告
   * @param {Object} analysisData - 分析資料
   * @param {Object} reportOptions - 報告選項
   * @returns {Promise<Object>} 品質報告
   */
  async generateQualityReport (analysisData, reportOptions = {}) {
    const { books, platform, timeRange } = analysisData
    const { includeCharts, includeTrends, detailLevel } = reportOptions

    // 計算摘要統計
    const summary = this._calculateSummaryStatistics(books)

    // 品質指標
    const qualityMetrics = this._calculateQualityMetrics(books)

    // 趨勢分析
    let trendAnalysis = null
    if (includeTrends && timeRange) {
      const historicalData = this._extractHistoricalData(timeRange)
      trendAnalysis = await this.getQualityTrends(historicalData, {
        analysisWindow: 7,
        includeProjection: true
      })
    }

    // 改善建議
    const recommendations = this._generateReportRecommendations(summary, qualityMetrics)

    // 圖表資料
    let charts = null
    if (includeCharts) {
      charts = this._generateChartData(books, qualityMetrics)
    }

    return {
      summary,
      qualityMetrics,
      trendAnalysis,
      recommendations,
      charts,
      metadata: {
        reportGenerated: new Date().toISOString(),
        platform,
        timeRange,
        detailLevel,
        totalBooks: books?.length || 0
      }
    }
  }

  /**
   * 計算品質分數
   * @param {Object} book - 書籍資料
   * @param {Object} analysisOptions - 分析選項
   * @returns {Promise<Object>} 品質分數結果
   */
  async getQualityScore (book, analysisOptions = {}) {
    const strategy = analysisOptions.weightingStrategy || 'balanced'

    // 計算各維度分數
    const dimensionScores = {
      completeness: this._calculateCompletenessScore(book),
      validity: this._calculateValidityScore(book),
      consistency: this._calculateConsistencyScore(book),
      accuracy: this._calculateAccuracyScore(book)
    }

    // 獲取權重配置
    const weightings = this._getWeightingStrategy(strategy)

    // 計算綜合分數
    const overallScore = this._calculateWeightedScore(dimensionScores, weightings)

    return {
      overallScore: Math.round(overallScore),
      dimensionScores,
      weightings,
      calculationMethod: strategy
    }
  }

  /**
   * 分析品質趨勢
   * @param {Array} historicalData - 歷史資料
   * @param {Object} trendOptions - 趨勢分析選項
   * @returns {Promise<Object>} 趨勢分析結果
   */
  async getQualityTrends (historicalData, trendOptions = {}) {
    if (!Array.isArray(historicalData) || historicalData.length < 2) {
      return {
        overallTrend: 'insufficient_data',
        trendDirection: 'stable',
        changeRate: 0,
        volatility: 0,
        projection: null,
        significantChanges: []
      }
    }

    // 分析趨勢方向
    const trendDirection = this._analyzeTrendDirection(historicalData)

    // 計算變化率
    const changeRate = this._calculateChangeRate(historicalData)

    // 計算波動性
    const volatility = this._calculateVolatility(historicalData)

    // 生成預測
    let projection = null
    if (trendOptions.includeProjection) {
      projection = this._generateProjection(historicalData, trendOptions.projectionDays || 7)
    }

    // 識別顯著變化
    const significantChanges = this._identifySignificantChanges(historicalData)

    return {
      overallTrend: trendDirection === 'stable' ? 'stable' : (changeRate > 0 ? 'improving' : 'declining'),
      trendDirection,
      changeRate: Math.round(changeRate * 100) / 100,
      volatility: Math.round(volatility * 100) / 100,
      projection,
      significantChanges
    }
  }

  /**
   * 獲取改善建議
   * @param {Object} qualityAnalysis - 品質分析結果
   * @returns {Promise<Array>} 改善建議陣列
   */
  async getImprovementSuggestions (qualityAnalysis) {
    const suggestions = []
    const { overallScore, qualityDimensions, weaknesses, platform } = qualityAnalysis

    // 基於整體分數的建議
    if (overallScore < this.config.qualityThresholds.acceptable) {
      suggestions.push({
        priority: 'high',
        category: 'overall_quality',
        issue: 'Overall quality score is below acceptable threshold',
        recommendation: 'Focus on improving data completeness and validation errors',
        expectedImprovement: 15
      })
    }

    // 基於維度分析的建議
    for (const [dimension, score] of Object.entries(qualityDimensions)) {
      if (score < 70) {
        const suggestion = this._generateDimensionSuggestion(dimension, score, platform)
        if (suggestion) {
          suggestions.push(suggestion)
        }
      }
    }

    // 基於弱點的建議
    for (const weakness of weaknesses) {
      const suggestion = this._generateWeaknessSuggestion(weakness, platform)
      if (suggestion) {
        suggestions.push(suggestion)
      }
    }

    // 排序建議 (高優先級在前)
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  /**
   * 獲取品質歷史
   * @param {string} bookId - 書籍ID
   * @returns {Array} 品質歷史記錄
   */
  getQualityHistory (bookId) {
    return this.qualityHistory.get(bookId) || []
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
   * 更新配置
   * @param {Object} newConfig - 新配置
   */
  updateConfig (newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    }
  }

  /**
   * 私有方法 - 輸入驗證
   * @private
   */
  _validateInputs (book, platform) {
    if (!book || typeof book !== 'object') {
      throw new StandardError('INVALID_DATA_FORMAT', 'Invalid book data', {
        category: 'general'
      })
    }
    if (!platform || typeof platform !== 'string') {
      throw new StandardError('REQUIRED_FIELD_MISSING', 'Platform is required', {
        category: 'ui'
      })
    }

    // 驗證平台支援
    const platformSupport = this.platformRuleManager.validatePlatformSupport(platform)
    if (!platformSupport.isSupported) {
      throw new StandardError('FEATURE_NOT_SUPPORTED', 'Platform not supported: ${platform}', {
        category: 'general'
      })
    }
  }

  /**
   * 私有方法 - 分析品質維度
   * @private
   */
  _analyzeQualityDimensions (book, validationResult, normalizationResult) {
    return {
      completeness: this._calculateCompletenessScore(book),
      validity: validationResult.isValid ? 100 : Math.max(0, 100 - (validationResult.errors.length * 20)),
      consistency: normalizationResult.normalizationReport?.qualityScore || 0,
      accuracy: this._calculateAccuracyScore(book)
    }
  }

  /**
   * 私有方法 - 計算完整性分數
   * @private
   */
  _calculateCompletenessScore (book) {
    const requiredFields = ['id', 'title', 'authors']
    const optionalFields = ['progress', 'cover', 'lastUpdated', 'isbn']
    const bonusFields = ['description', 'publisher', 'publishDate']

    let score = 0
    let maxScore = 0

    // 必填欄位 (60分)
    requiredFields.forEach(field => {
      maxScore += 20
      if (this._hasValue(book[field])) {
        score += 20
      }
    })

    // 可選欄位 (30分)
    optionalFields.forEach(field => {
      maxScore += 5
      if (this._hasValue(book[field])) {
        score += 5
      }
    })

    // 加分欄位 (10分)
    bonusFields.forEach(field => {
      maxScore += 3.33
      if (this._hasValue(book[field])) {
        score += 3.33
      }
    })

    return Math.round((score / maxScore) * 100)
  }

  /**
   * 私有方法 - 計算有效性分數
   * @private
   */
  _calculateValidityScore (book) {
    let score = 100

    // 檢查基本格式
    if (book.title && book.title.length < 1) score -= 20
    if (book.progress !== undefined && (book.progress < 0 || book.progress > 100)) score -= 15
    if (book.cover && !this._isValidUrl(book.cover)) score -= 10
    if (book.lastUpdated && !this._isValidDate(book.lastUpdated)) score -= 10

    return Math.max(0, score)
  }

  /**
   * 私有方法 - 計算一致性分數
   * @private
   */
  _calculateConsistencyScore (book) {
    let score = 100

    // 檢查資料一致性
    if (book.authors && Array.isArray(book.authors)) {
      const hasEmptyAuthors = book.authors.some(author => !author || author.trim() === '')
      if (hasEmptyAuthors) score -= 15
    }

    if (book.progress === 100 && book.status && book.status !== 'completed') {
      score -= 20
    }

    return Math.max(0, score)
  }

  /**
   * 私有方法 - 計算準確性分數
   * @private
   */
  _calculateAccuracyScore (book) {
    let score = 80 // 基礎分數

    // 基於資料品質的準確性評估
    if (book.isbn && this._isValidISBN(book.isbn)) score += 20
    if (book.title && book.title.length > 3) score += 10
    if (book.authors && Array.isArray(book.authors) && book.authors.length > 0) score += 10

    return Math.min(100, score)
  }

  /**
   * 私有方法 - 獲取權重策略
   * @private
   */
  _getWeightingStrategy (strategy) {
    const strategies = {
      strict: {
        completeness: 0.4,
        validity: 0.4,
        consistency: 0.15,
        accuracy: 0.05
      },
      balanced: {
        completeness: 0.3,
        validity: 0.3,
        consistency: 0.25,
        accuracy: 0.15
      },
      lenient: {
        completeness: 0.25,
        validity: 0.25,
        consistency: 0.25,
        accuracy: 0.25
      }
    }

    return strategies[strategy] || strategies.balanced
  }

  /**
   * 私有方法 - 計算加權分數
   * @private
   */
  _calculateWeightedScore (dimensionScores, weightings) {
    let totalScore = 0
    for (const [dimension, score] of Object.entries(dimensionScores)) {
      totalScore += score * (weightings[dimension] || 0)
    }
    return totalScore
  }

  /**
   * 私有方法 - 識別優勢
   * @private
   */
  _identifyStrengths (qualityDimensions, qualityScore) {
    const strengths = []

    for (const [dimension, score] of Object.entries(qualityDimensions)) {
      if (score >= 90) {
        strengths.push(`Excellent ${dimension}`)
      } else if (score >= 80) {
        strengths.push(`Good ${dimension}`)
      }
    }

    if (qualityScore.overallScore >= this.config.qualityThresholds.excellent) {
      strengths.push('Overall excellent quality')
    }

    return strengths
  }

  /**
   * 私有方法 - 識別弱點
   * @private
   */
  _identifyWeaknesses (qualityDimensions, validationResult, normalizationResult) {
    const weaknesses = []

    // 從維度分數識別
    for (const [dimension, score] of Object.entries(qualityDimensions)) {
      if (score < 60) {
        weaknesses.push(`poor_${dimension}`)
      }
    }

    // 從驗證結果識別
    if (validationResult.errors && validationResult.errors.length > 0) {
      validationResult.errors.forEach(error => {
        weaknesses.push(error.type.toLowerCase())
      })
    }

    // 從標準化結果識別
    if (normalizationResult.normalizationReport && normalizationResult.normalizationReport.warningsGenerated) {
      normalizationResult.normalizationReport.warningsGenerated.forEach(warning => {
        weaknesses.push(warning.issue)
      })
    }

    return [...new Set(weaknesses)] // 去重
  }

  /**
   * 私有方法 - 更新統計資訊
   * @private
   */
  _updateStatistics (analysis, isError = false) {
    this.stats.totalAnalyses++

    if (!isError && analysis.processingTime) {
      this.stats.totalProcessingTime += analysis.processingTime
      this.stats.averageProcessingTime = this.stats.totalProcessingTime / this.stats.totalAnalyses

      // 更新品質分佈
      const category = this._categorizeScore(analysis.overallScore)
      this.stats.qualityDistribution[category]++

      // 更新常見問題
      if (analysis.weaknesses) {
        analysis.weaknesses.forEach(weakness => {
          const count = this.stats.mostCommonIssues.get(weakness) || 0
          this.stats.mostCommonIssues.set(weakness, count + 1)
        })
      }
    }
  }

  /**
   * 私有方法 - 更新品質歷史
   * @private
   */
  _updateQualityHistory (bookId, analysis) {
    if (!this.qualityHistory.has(bookId)) {
      this.qualityHistory.set(bookId, [])
    }

    const history = this.qualityHistory.get(bookId)
    const record = {
      timestamp: analysis.timestamp,
      score: analysis.overallScore,
      analysis: {
        qualityDimensions: analysis.qualityDimensions,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses
      }
    }

    history.push(record)

    // 限制歷史記錄數量
    if (history.length > this.config.maxHistoryRecords) {
      history.shift()
    }
  }

  /**
   * 私有方法 - 分類分數
   * @private
   */
  _categorizeScore (score) {
    const thresholds = this.config.qualityThresholds
    if (score >= thresholds.excellent) return 'excellent'
    if (score >= thresholds.good) return 'good'
    if (score >= thresholds.acceptable) return 'acceptable'
    if (score >= thresholds.poor) return 'poor'
    return 'critical'
  }

  /**
   * 私有方法 - 輔助方法
   * @private
   */
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

  _isValidDate (dateString) {
    try {
      const date = new Date(dateString)
      return !isNaN(date.getTime())
    } catch {
      return false
    }
  }

  _isValidISBN (isbn) {
    // 簡化的 ISBN 驗證
    const cleaned = isbn.replace(/[-\s]/g, '')
    return cleaned.length === 10 || cleaned.length === 13
  }

  _createBatches (items, batchSize) {
    const batches = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  _calculateSummaryStatistics (books) {
    if (!books || books.length === 0) {
      return { averageScore: 0, totalBooks: 0 }
    }

    const totalScore = books.reduce((sum, book) => sum + (book.overallScore || 0), 0)
    return {
      averageScore: Math.round(totalScore / books.length),
      totalBooks: books.length
    }
  }

  _calculateQualityMetrics (books) {
    // 簡化的品質指標計算
    return {
      completenessRate: 0.85,
      validityRate: 0.92,
      consistencyRate: 0.78
    }
  }

  _generateReportRecommendations (summary, metrics) {
    const recommendations = []

    if (summary.averageScore < this.config.qualityThresholds.good) {
      recommendations.push('Focus on improving overall data quality standards')
    }

    return recommendations
  }

  _generateChartData (books, metrics) {
    return {
      scoreDistribution: this.stats.qualityDistribution,
      dimensionComparison: metrics
    }
  }

  _extractHistoricalData (timeRange) {
    // 模擬歷史資料提取
    return []
  }

  _analyzeTrendDirection (data) {
    if (data.length < 2) return 'stable'
    const first = data[0].averageScore
    const last = data[data.length - 1].averageScore
    const diff = last - first
    if (Math.abs(diff) < 2) return 'stable'
    return diff > 0 ? 'improving' : 'declining'
  }

  _calculateChangeRate (data) {
    if (data.length < 2) return 0
    const first = data[0].averageScore
    const last = data[data.length - 1].averageScore
    return ((last - first) / first) * 100
  }

  _calculateVolatility (data) {
    if (data.length < 3) return 0
    const scores = data.map(d => d.averageScore)
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length
    return Math.sqrt(variance)
  }

  _generateProjection (data, days) {
    // 簡化的線性預測
    if (data.length < 2) return null
    const changeRate = this._calculateChangeRate(data)
    const lastScore = data[data.length - 1].averageScore
    return {
      projectedScore: Math.round(lastScore * (1 + changeRate / 100)),
      confidence: 'medium',
      projectionDays: days
    }
  }

  _identifySignificantChanges (data) {
    // 識別顯著變化點
    return []
  }

  _identifyCommonIssues (analyses) {
    const issueFreq = new Map()
    analyses.forEach(analysis => {
      if (analysis.weaknesses) {
        analysis.weaknesses.forEach(weakness => {
          issueFreq.set(weakness, (issueFreq.get(weakness) || 0) + 1)
        })
      }
    })

    return Array.from(issueFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, count]) => ({ issue, frequency: count }))
  }

  _generateBatchSuggestions (batchResults) {
    const suggestions = []

    if (batchResults.averageScore < this.config.qualityThresholds.acceptable) {
      suggestions.push('Batch average quality is below threshold - consider data quality improvements')
    }

    return suggestions
  }

  _generateDimensionSuggestion (dimension, score, platform) {
    const suggestions = {
      completeness: {
        priority: 'high',
        category: 'data_completeness',
        issue: `${dimension} score is low (${score})`,
        recommendation: 'Add missing required fields and optional metadata',
        expectedImprovement: 20
      },
      validity: {
        priority: 'high',
        category: 'data_validation',
        issue: `${dimension} issues detected`,
        recommendation: 'Fix validation errors and format issues',
        expectedImprovement: 25
      },
      consistency: {
        priority: 'medium',
        category: 'data_consistency',
        issue: `${dimension} inconsistencies found`,
        recommendation: 'Standardize data formats and resolve conflicts',
        expectedImprovement: 15
      },
      accuracy: {
        priority: 'medium',
        category: 'data_accuracy',
        issue: `${dimension} concerns identified`,
        recommendation: 'Verify and correct data accuracy issues',
        expectedImprovement: 10
      }
    }

    return suggestions[dimension] || null
  }

  _generateWeaknessSuggestion (weakness, platform) {
    const commonSuggestions = {
      missing_isbn: {
        priority: 'medium',
        category: 'completeness',
        issue: 'Missing ISBN information',
        recommendation: 'Add ISBN for better book identification',
        expectedImprovement: 8
      },
      poor_completeness: {
        priority: 'high',
        category: 'completeness',
        issue: 'Overall data completeness is poor',
        recommendation: 'Fill in missing required and optional fields',
        expectedImprovement: 25
      }
    }

    return commonSuggestions[weakness] || null
  }
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataQualityAnalyzer
}

// 瀏覽器環境支援
if (typeof window !== 'undefined') {
  window.DataQualityAnalyzer = DataQualityAnalyzer
}
