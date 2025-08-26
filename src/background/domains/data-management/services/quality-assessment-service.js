/**
 * @fileoverview Quality Assessment Service - 品質評估服務
 * @version v0.9.21
 * @since 2025-08-21
 *
 * 從 DataValidationService 提取的品質評估邏輯
 *
 * 負責功能：
 * - 單本書籍資料品質評估和評分
 * - 驗證報告整體品質計算
 * - 品質等級判定和改善建議
 * - 批次品質評估和統計分析
 *
 * 設計原則：
 * - 單一職責：專注於資料品質評估和分析
 * - 可配置性：支援自訂品質門檻和權重
 * - 可擴展性：支援不同類型的品質檢查規則
 * - 統計導向：提供詳細的品質統計和趨勢分析
 */

const BaseModule = require('../../../lifecycle/base-module.js')

class QualityAssessmentService extends BaseModule {
  /**
   * 初始化品質評估服務
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

    // 品質評估統計
    this.qualityStatistics = {
      totalAssessed: 0,
      averageScore: 0,
      qualityDistribution: {
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
        VERY_LOW: 0
      },
      lastAssessmentTime: null
    }
  }

  /**
   * 合併預設配置
   */
  mergeWithDefaults (userConfig) {
    const defaults = {
      qualityThresholds: {
        high: 90,
        medium: 70,
        low: 50
      },
      qualityWeights: {
        title: 20,
        authors: 15,
        isbn: 10,
        cover: 10,
        publisher: 5,
        progress: 5,
        rating: 3
      }
    }

    return {
      ...defaults,
      ...userConfig
    }
  }

  /**
   * 評估書籍資料品質
   * @param {Object} book - 書籍資料
   * @returns {Object} 品質評估結果
   */
  assessDataQuality (book) {
    try {
      if (!book) return this.createEmptyAssessment('書籍資料為空')
      const assessment = this._initializeAssessment()
      this._evaluateAllFields(book, assessment)
      return this._finalizeAssessment(assessment)
    } catch (error) {
      return this.createEmptyAssessment(`評估過程中發生錯誤: ${error.message}`)
    }
  }

  /**
   * 計算驗證報告品質分數
   * @param {Object} report - 驗證報告
   * @returns {number} 品質分數
   */
  calculateQualityScore (report) {
    if (!this._isValidReport(report)) return 0
    const validPercentage = this._calculateValidPercentage(report)
    const warningPenalty = this._calculateWarningPenalty(report)
    return Math.max(0, Math.round(validPercentage - warningPenalty))
  }

  /**
   * 驗證報告是否有效
   * @param {Object} report - 驗證報告
   * @returns {boolean} 是否有效
   */
  _isValidReport (report) {
    return report && report.totalBooks > 0
  }

  /**
   * 計算有效書籍百分比
   * @param {Object} report - 驗證報告
   * @returns {number} 有效百分比
   */
  _calculateValidPercentage (report) {
    return (report.validBooks.length / report.totalBooks) * 100
  }

  /**
   * 計算警告扣分
   * @param {Object} report - 驗證報告
   * @returns {number} 警告扣分
   */
  _calculateWarningPenalty (report) {
    return Math.min(report.warnings.length, 20) // 最多扣20分
  }

  /**
   * 判定品質等級
   * @param {number} score - 品質分數
   * @returns {string} 品質等級
   */
  determineQualityLevel (score) {
    if (score >= this.config.qualityThresholds.high) return 'HIGH'
    if (score >= this.config.qualityThresholds.medium) return 'MEDIUM'
    if (score >= this.config.qualityThresholds.low) return 'LOW'
    return 'VERY_LOW'
  }

  /**
   * 評估批次品質
   * @param {Array} books - 書籍陣列
   * @returns {Object} 批次品質評估結果
   */
  assessBatchQuality (books) {
    if (!this._isValidBatch(books)) return this._createEmptyBatchResult()
    const assessments = this._processBatchAssessments(books)
    return this._calculateBatchStatistics(books, assessments)
  }

  /**
   * 驗證批次輸入是否有效
   * @param {Array} books - 書籍陣列
   * @returns {boolean} 是否為有效批次
   */
  _isValidBatch (books) {
    return books && books.length > 0
  }

  /**
   * 處理批次書籍評估
   * @param {Array} books - 書籍陣列
   * @returns {Array} 評估結果陣列
   */
  _processBatchAssessments (books) {
    return books.map(book => this.assessDataQuality(book))
  }

  /**
   * 計算批次統計數據
   * @param {Array} books - 書籍陣列
   * @param {Array} assessments - 評估結果陣列
   * @returns {Object} 批次統計結果
   */
  _calculateBatchStatistics (books, assessments) {
    const averageScore = this._calculateAverageScore(assessments)
    const qualityBreakdown = this._calculateQualityBreakdown(assessments)
    return this._buildBatchResult(books, assessments, averageScore, qualityBreakdown)
  }

  /**
   * 建立空的批次結果
   * @returns {Object} 空批次結果
   */
  _createEmptyBatchResult () {
    return {
      totalBooks: 0,
      averageScore: 0,
      qualityBreakdown: { HIGH: 0, MEDIUM: 0, LOW: 0, VERY_LOW: 0 },
      bookAssessments: []
    }
  }

  /**
   * 計算平均分數
   * @param {Array} assessments - 評估結果陣列
   * @returns {number} 平均分數
   */
  _calculateAverageScore (assessments) {
    const scores = assessments.map(assessment => assessment.score)
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
  }

  /**
   * 計算品質分佈統計
   * @param {Array} assessments - 評估結果陣列
   * @returns {Object} 品質分佈統計
   */
  _calculateQualityBreakdown (assessments) {
    const qualityBreakdown = { HIGH: 0, MEDIUM: 0, LOW: 0, VERY_LOW: 0 }
    assessments.forEach(assessment => {
      qualityBreakdown[assessment.level]++
    })
    return qualityBreakdown
  }

  /**
   * 建立批次結果物件
   * @param {Array} books - 書籍陣列
   * @param {Array} assessments - 評估結果陣列
   * @param {number} averageScore - 平均分數
   * @param {Object} qualityBreakdown - 品質分佈
   * @returns {Object} 批次結果
   */
  _buildBatchResult (books, assessments, averageScore, qualityBreakdown) {
    return {
      totalBooks: books.length,
      averageScore,
      qualityBreakdown,
      bookAssessments: assessments
    }
  }

  /**
   * 生成品質改善建議
   * @param {Object} assessment - 品質評估結果
   * @returns {Object} 改善建議
   */
  generateQualityRecommendations (assessment) {
    const categorizedIssues = this._categorizeIssuesByPriority(assessment.issues)
    const priority = this._determinePrimaryPriority(categorizedIssues)
    const suggestions = this._generateSuggestionsFromIssues(assessment.issues)
    return this._buildRecommendationResult(suggestions, priority, assessment.issues)
  }

  /**
   * 依優先級分類問題
   * @param {Array} issues - 問題列表
   * @returns {Object} 分類的問題
   */
  _categorizeIssuesByPriority (issues) {
    const categories = { HIGH: [], MEDIUM: [], LOW: [] }
    issues.forEach(issue => {
      const priority = this._getIssuePriority(issue.type)
      categories[priority].push(issue)
    })
    return categories
  }

  /**
   * 取得問題優先級
   * @param {string} issueType - 問題類型
   * @returns {string} 優先級
   */
  _getIssuePriority (issueType) {
    const highPriorityTypes = ['MISSING_COVER', 'MISSING_TITLE', 'MISSING_AUTHORS']
    const mediumPriorityTypes = ['TITLE_TOO_SHORT', 'INVALID_ISBN']

    if (highPriorityTypes.includes(issueType)) return 'HIGH'
    if (mediumPriorityTypes.includes(issueType)) return 'MEDIUM'
    return 'LOW'
  }

  /**
   * 決定主要優先級
   * @param {Object} categorizedIssues - 分類的問題
   * @returns {string} 主要優先級
   */
  _determinePrimaryPriority (categorizedIssues) {
    if (categorizedIssues.HIGH.length > 0) return 'HIGH'
    if (categorizedIssues.MEDIUM.length > 0) return 'MEDIUM'
    return 'LOW'
  }

  /**
   * 從問題產生建議列表
   * @param {Array} issues - 問題列表
   * @returns {Array} 建議列表
   */
  _generateSuggestionsFromIssues (issues) {
    const suggestions = issues.map(issue => this._createSuggestionForIssue(issue))
    return [...new Set(suggestions)] // 去重
  }

  /**
   * 為單一問題建立建議
   * @param {Object} issue - 問題物件
   * @returns {string} 建議文字
   */
  _createSuggestionForIssue (issue) {
    const suggestionMap = {
      MISSING_COVER: `建議補充${this.getFieldDisplayName(issue.field)}資訊`,
      MISSING_TITLE: `建議補充${this.getFieldDisplayName(issue.field)}資訊`,
      MISSING_AUTHORS: `建議補充${this.getFieldDisplayName(issue.field)}資訊`,
      TITLE_TOO_SHORT: '建議提供更完整的書籍標題',
      INVALID_ISBN: '建議確認ISBN格式是否正確',
      MISSING_PUBLISHER: '建議添加出版社資訊'
    }
    return suggestionMap[issue.type] || '建議改善資料品質'
  }

  /**
   * 建立建議結果物件
   * @param {Array} suggestions - 建議列表
   * @param {string} priority - 優先級
   * @param {Array} issues - 問題列表
   * @returns {Object} 建議結果
   */
  _buildRecommendationResult (suggestions, priority, issues) {
    return {
      suggestions,
      priority,
      estimatedImprovement: this.estimateScoreImprovement(issues)
    }
  }

  /**
   * 評估標題欄位
   */
  assessTitle (book, issues, fieldCounts) {
    fieldCounts.total++
    if (!this._hasTitleValue(book)) return this._handleMissingTitle(issues)
    fieldCounts.present++
    return this._validateTitleLength(book.title, issues)
  }

  /**
   * 檢查書籍是否有標題值
   * @param {Object} book - 書籍資料
   * @returns {boolean} 是否有標題
   */
  _hasTitleValue (book) {
    return book.title && book.title.trim() !== ''
  }

  /**
   * 處理缺失標題的情況
   * @param {Array} issues - 問題陣列
   * @returns {number} 扣分
   */
  _handleMissingTitle (issues) {
    issues.push({
      field: 'title',
      type: 'MISSING_TITLE',
      message: '缺少書籍標題'
    })
    return this.config.qualityWeights.title
  }

  /**
   * 驗證標題長度
   * @param {string} title - 書籍標題
   * @param {Array} issues - 問題陣列
   * @returns {number} 扣分
   */
  _validateTitleLength (title, issues) {
    if (title.trim().length < 2) {
      issues.push({
        field: 'title',
        type: 'TITLE_TOO_SHORT',
        message: '書籍標題過短'
      })
      return this.config.qualityWeights.title * 0.5
    }
    return 0
  }

  /**
   * 評估作者欄位
   */
  assessAuthors (book, issues, fieldCounts) {
    fieldCounts.total++
    if (!this._hasAuthorsValue(book)) return this._handleMissingAuthors(issues)
    fieldCounts.present++
    return 0
  }

  /**
   * 檢查是否有作者值
   * @param {Object} book - 書籍資料
   * @returns {boolean} 是否有作者
   */
  _hasAuthorsValue (book) {
    return book.authors && !(Array.isArray(book.authors) && book.authors.length === 0)
  }

  /**
   * 處理缺失作者的情況
   * @param {Array} issues - 問題陣列
   * @returns {number} 扣20分
   */
  _handleMissingAuthors (issues) {
    issues.push({
      field: 'authors',
      type: 'MISSING_AUTHORS',
      message: '缺少作者資訊'
    })
    return this.config.qualityWeights.authors
  }

  /**
   * 評估ISBN欄位
   */
  assessISBN (book, issues, fieldCounts) {
    fieldCounts.total++
    if (!this._hasValidISBN(book)) return this._handleInvalidISBN(issues)
    fieldCounts.present++
    return 0
  }

  /**
   * 檢查ISBN是否有效
   * @param {Object} book - 書籍資料
   * @returns {boolean} ISBN是否有效
   */
  _hasValidISBN (book) {
    return book.isbn && book.isbn.length >= 10
  }

  /**
   * 處理無效ISBN的情況
   * @param {Array} issues - 問題陣列
   * @returns {number} 扣20分
   */
  _handleInvalidISBN (issues) {
    issues.push({
      field: 'isbn',
      type: 'INVALID_ISBN',
      message: 'ISBN格式無效或缺失'
    })
    return this.config.qualityWeights.isbn
  }

  /**
   * 評估封面欄位
   */
  assessCover (book, issues, fieldCounts) {
    fieldCounts.total++
    if (!book.cover) return this._handleMissingCover(issues)
    fieldCounts.present++
    return 0
  }

  /**
   * 處理缺失封面的情況
   * @param {Array} issues - 問題陣列
   * @returns {number} 扣20分
   */
  _handleMissingCover (issues) {
    issues.push({
      field: 'cover',
      type: 'MISSING_COVER',
      message: '缺少封面圖片'
    })
    return this.config.qualityWeights.cover
  }

  /**
   * 評估出版社欄位
   */
  assessPublisher (book, issues, fieldCounts) {
    fieldCounts.total++
    if (!book.publisher) return this._handleMissingPublisher(issues)
    fieldCounts.present++
    return 0
  }

  /**
   * 處理缺失出版社的情況
   * @param {Array} issues - 問題陣列
   * @returns {number} 扣20分
   */
  _handleMissingPublisher (issues) {
    issues.push({
      field: 'publisher',
      type: 'MISSING_PUBLISHER',
      message: '缺少出版社資訊'
    })
    return this.config.qualityWeights.publisher
  }

  /**
   * 評估進度欄位
   */
  assessProgress (book, issues, fieldCounts) {
    fieldCounts.total++

    if (book.progress !== undefined && book.progress !== null) {
      fieldCounts.present++
    }

    return 0 // 進度是可選欄位，不扣分
  }

  /**
   * 評估評分欄位
   */
  assessRating (book, issues, fieldCounts) {
    fieldCounts.total++

    if (book.rating !== undefined && book.rating !== null) {
      fieldCounts.present++
    }

    return 0 // 評分是可選欄位，不扣分
  }

  /**
   * 初始化評估資料結構
   * @returns {Object} 初始化的評估物件
   */
  _initializeAssessment () {
    return {
      qualityScore: 100,
      issues: [],
      fieldCounts: { total: 0, present: 0 }
    }
  }

  /**
   * 評估所有書籍欄位
   * @param {Object} book - 書籍資料
   * @param {Object} assessment - 評估資料結構
   */
  _evaluateAllFields (book, assessment) {
    this._evaluateField(book, assessment, this.assessTitle.bind(this))
    this._evaluateField(book, assessment, this.assessAuthors.bind(this))
    this._evaluateField(book, assessment, this.assessISBN.bind(this))
    this._evaluateField(book, assessment, this.assessCover.bind(this))
    this._evaluateField(book, assessment, this.assessPublisher.bind(this))
    this._evaluateOptionalFields(book, assessment)
  }

  /**
   * 評估單一欄位並更新評估資料
   * @param {Object} book - 書籍資料
   * @param {Object} assessment - 評估資料結構
   * @param {Function} assessorFn - 欄位評估函數
   */
  _evaluateField (book, assessment, assessorFn) {
    const penalty = assessorFn(book, assessment.issues, assessment.fieldCounts)
    assessment.qualityScore -= penalty
  }

  /**
   * 評估可選欄位（不扣分的欄位）
   * @param {Object} book - 書籍資料
   * @param {Object} assessment - 評估資料結構
   */
  _evaluateOptionalFields (book, assessment) {
    this.assessProgress(book, assessment.issues, assessment.fieldCounts)
    this.assessRating(book, assessment.issues, assessment.fieldCounts)
  }

  /**
   * 完成評估並產生最終結果
   * @param {Object} assessment - 評估資料結構
   * @returns {Object} 最終評估結果
   */
  _finalizeAssessment (assessment) {
    const finalScore = Math.max(0, assessment.qualityScore)
    const completeness = this._calculateCompleteness(assessment.fieldCounts)
    this.updateQualityStatistics(finalScore)
    return this._buildAssessmentResult(finalScore, assessment, completeness)
  }

  /**
   * 計算資料完整度
   * @param {Object} fieldCounts - 欄位計數統計
   * @returns {number} 完整度百分比
   */
  _calculateCompleteness (fieldCounts) {
    return fieldCounts.total > 0
      ? Math.round((fieldCounts.present / fieldCounts.total) * 100)
      : 0
  }

  /**
   * 建立評估結果物件
   * @param {number} score - 品質分數
   * @param {Object} assessment - 評估資料
   * @param {number} completeness - 完整度
   * @returns {Object} 評估結果
   */
  _buildAssessmentResult (score, assessment, completeness) {
    return {
      score,
      level: this.determineQualityLevel(score),
      issues: assessment.issues,
      completeness,
      fieldCounts: assessment.fieldCounts,
      timestamp: Date.now()
    }
  }

  /**
   * 建立空的評估結果
   */
  createEmptyAssessment (errorMessage) {
    return {
      score: 0,
      level: 'VERY_LOW',
      issues: [],
      completeness: 0,
      error: errorMessage,
      timestamp: Date.now()
    }
  }

  /**
   * 獲取欄位顯示名稱
   */
  getFieldDisplayName (field) {
    const displayNames = {
      title: '標題',
      authors: '作者',
      isbn: 'ISBN',
      cover: '封面',
      publisher: '出版社',
      progress: '閱讀進度',
      rating: '評分'
    }
    return displayNames[field] || field
  }

  /**
   * 估算分數改善幅度
   */
  estimateScoreImprovement (issues) {
    return issues.reduce((total, issue) => {
      switch (issue.type) {
        case 'MISSING_TITLE': return total + 20
        case 'MISSING_AUTHORS': return total + 15
        case 'MISSING_COVER': return total + 10
        case 'INVALID_ISBN': return total + 10
        case 'MISSING_PUBLISHER': return total + 5
        default: return total + 3
      }
    }, 0)
  }

  /**
   * 更新品質統計
   */
  updateQualityStatistics (score) {
    this.qualityStatistics.totalAssessed++

    // 更新平均分數
    const currentTotal = this.qualityStatistics.averageScore * (this.qualityStatistics.totalAssessed - 1)
    this.qualityStatistics.averageScore = Math.round((currentTotal + score) / this.qualityStatistics.totalAssessed)

    // 更新品質分佈
    const level = this.determineQualityLevel(score)
    this.qualityStatistics.qualityDistribution[level]++

    this.qualityStatistics.lastAssessmentTime = Date.now()
  }

  /**
   * 更新品質門檻
   * @param {Object} thresholds - 新的門檻值
   */
  updateQualityThresholds (thresholds) {
    this.config.qualityThresholds = {
      ...this.config.qualityThresholds,
      ...thresholds
    }
  }

  /**
   * 更新品質權重
   * @param {Object} weights - 新的權重值
   */
  updateQualityWeights (weights) {
    this.config.qualityWeights = {
      ...this.config.qualityWeights,
      ...weights
    }
  }

  /**
   * 獲取品質統計
   * @returns {Object} 統計資訊
   */
  getQualityStatistics () {
    return {
      totalAssessed: this.qualityStatistics.totalAssessed,
      averageScore: this.qualityStatistics.averageScore,
      qualityDistribution: { ...this.qualityStatistics.qualityDistribution },
      lastAssessmentTime: this.qualityStatistics.lastAssessmentTime
    }
  }

  /**
   * 重置統計數據
   */
  resetStatistics () {
    this.qualityStatistics = {
      totalAssessed: 0,
      averageScore: 0,
      qualityDistribution: {
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
        VERY_LOW: 0
      },
      lastAssessmentTime: null
    }
  }

  /**
   * 檢查服務健康狀態
   * @returns {Object} 健康狀態
   */
  isQualityServiceHealthy () {
    const stats = this.qualityStatistics
    const recentActivity = stats.lastAssessmentTime &&
                          (Date.now() - stats.lastAssessmentTime) < 24 * 60 * 60 * 1000 // 24小時內

    return {
      isHealthy: stats.totalAssessed > 0 && stats.averageScore > 0,
      qualityStatistics: stats,
      recentActivity,
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
    const logMessage = `[${timestamp}] [QualityAssessmentService] ${message}`

    if (this.logger && this.logger[level]) {
      this.logger[level](logMessage)
    } else {
      console.log(logMessage)
    }
  }
}

module.exports = QualityAssessmentService
