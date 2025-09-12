/**
 * 品質控制和監控服務
 *
 * 負責功能：
 * - 資料提取品質的監控和評估
 * - 品質指標追蹤和報告
 * - 異常檢測和警報機制
 * - 品質改善建議和自動優化
 *
 * 設計考量：
 * - 即時品質監控和分析
 * - 多維度品質評估系統
 * - 智能異常檢測機制
 * - 自動化品質改善流程
 *
 * 使用情境：
 * - 監控書籍資料提取的品質表現
 * - 檢測資料異常和品質下降
 * - 提供品質改善建議和優化方案
 */

const {
  EXTRACTION_EVENTS,
  EVENT_PRIORITIES
} = require('src/background/constants/module-constants')
const { StandardError } = require('src/core/errors/StandardError')

class QualityControlService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false,
      monitoring: false
    }

    // 品質監控
    this.qualityMetrics = new Map()
    this.qualityBaselines = new Map()
    this.qualityAlerts = new Map()
    this.monitoringRules = new Map()
    this.registeredListeners = new Map()

    // 品質配置
    this.config = {
      qualityThresholds: {
        dataCompleteness: 0.9, // 資料完整度 90%
        dataAccuracy: 0.95, // 資料準確度 95%
        processingSuccess: 0.98, // 處理成功率 98%
        responseTime: 5000, // 回應時間 5秒
        errorRate: 0.02 // 錯誤率 2%
      },
      monitoringInterval: 30000, // 30秒監控間隔
      alertCooldown: 300000, // 5分鐘警報冷卻
      baselineWindow: 100, // 基準線計算視窗
      enableRealTimeAnalysis: true,
      enableAutoOptimization: true
    }

    // 品質指標定義
    this.QUALITY_METRICS = {
      DATA_COMPLETENESS: 'data_completeness',
      DATA_ACCURACY: 'data_accuracy',
      PROCESSING_SUCCESS: 'processing_success',
      RESPONSE_TIME: 'response_time',
      ERROR_RATE: 'error_rate',
      CONSISTENCY: 'consistency',
      FRESHNESS: 'freshness'
    }

    // 警報等級
    this.ALERT_LEVELS = {
      INFO: 'info',
      WARNING: 'warning',
      CRITICAL: 'critical'
    }

    // 統計資料
    this.stats = {
      totalAnalyses: 0,
      qualityIssuesDetected: 0,
      alertsGenerated: 0,
      optimizationsApplied: 0,
      averageQualityScore: 0
    }

    // 監控數據
    this.monitoringData = {
      samples: [],
      trends: new Map(),
      anomalies: []
    }

    // 初始化品質規則
    this.initializeQualityRules()
  }

  /**
   * 初始化品質控制服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('⚠️ 品質控制服務已初始化')
      return
    }

    try {
      this.logger.log('🔍 初始化品質控制服務')

      // 初始化品質基準線
      await this.initializeQualityBaselines()

      // 初始化監控規則
      await this.initializeMonitoringRules()

      // 註冊事件監聽器
      await this.registerEventListeners()

      this.state.initialized = true
      this.logger.log('✅ 品質控制服務初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.QUALITY.INITIALIZED', {
          serviceName: 'QualityControlService',
          metricsCount: this.qualityMetrics.size
        })
      }
    } catch (error) {
      this.logger.error('❌ 初始化品質控制服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動品質控制服務
   */
  async start () {
    if (!this.state.initialized) {
      throw new StandardError('UNKNOWN_ERROR', '服務尚未初始化', {
          "category": "general"
      })
    }

    if (this.state.active) {
      this.logger.warn('⚠️ 品質控制服務已啟動')
      return
    }

    try {
      this.logger.log('🚀 啟動品質控制服務')

      this.state.active = true
      this.state.monitoring = true

      // 啟動即時監控
      this.startRealTimeMonitoring()

      // 啟動自動分析
      this.startAutomaticAnalysis()

      this.logger.log('✅ 品質控制服務啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.QUALITY.STARTED', {
          serviceName: 'QualityControlService'
        })
      }
    } catch (error) {
      this.logger.error('❌ 啟動品質控制服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止品質控制服務
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('⚠️ 品質控制服務未啟動')
      return
    }

    try {
      this.logger.log('🛑 停止品質控制服務')

      // 停止監控機制
      this.stopMonitoringMechanisms()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      this.state.active = false
      this.state.monitoring = false

      this.logger.log('✅ 品質控制服務停止完成')

      // 發送停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.QUALITY.STOPPED', {
          serviceName: 'QualityControlService',
          finalStats: { ...this.stats }
        })
      }
    } catch (error) {
      this.logger.error('❌ 停止品質控制服務失敗:', error)
      throw error
    }
  }

  /**
   * 初始化品質規則
   */
  initializeQualityRules () {
    // 資料完整度檢查規則
    this.addQualityRule('data_completeness', {
      name: '資料完整度',
      description: '檢查必要欄位的完整性',
      calculator: (data) => {
        if (!data || !data.books) return 0

        const totalFields = ['id', 'title', 'author', 'publisher']
        let completeCount = 0
        let totalCount = 0

        data.books.forEach(book => {
          totalFields.forEach(field => {
            totalCount++
            if (book[field] && book[field].toString().trim() !== '') {
              completeCount++
            }
          })
        })

        return totalCount > 0 ? completeCount / totalCount : 0
      },
      threshold: this.config.qualityThresholds.dataCompleteness
    })

    // 資料準確度檢查規則
    this.addQualityRule('data_accuracy', {
      name: '資料準確度',
      description: '檢查資料格式和值的正確性',
      calculator: (data) => {
        if (!data || !data.books) return 0

        let validCount = 0
        let totalCount = 0

        data.books.forEach(book => {
          totalCount++

          // 檢查 ID 格式
          if (book.id && typeof book.id === 'string' && book.id.length > 0) {
            validCount += 0.25
          }

          // 檢查標題長度
          if (book.title && book.title.length >= 2 && book.title.length <= 200) {
            validCount += 0.25
          }

          // 檢查進度範圍
          if (typeof book.progress === 'number' && book.progress >= 0 && book.progress <= 100) {
            validCount += 0.25
          }

          // 檢查評分範圍
          if (typeof book.rating === 'number' && book.rating >= 0 && book.rating <= 5) {
            validCount += 0.25
          }
        })

        return totalCount > 0 ? validCount / totalCount : 0
      },
      threshold: this.config.qualityThresholds.dataAccuracy
    })

    // 處理成功率檢查規則
    this.addQualityRule('processing_success', {
      name: '處理成功率',
      description: '監控資料處理的成功率',
      calculator: (processingStats) => {
        if (!processingStats) return 1

        const total = processingStats.totalAttempts || 1
        const successful = processingStats.successfulAttempts || 0

        return successful / total
      },
      threshold: this.config.qualityThresholds.processingSuccess
    })

    this.logger.log(`✅ 初始化了 ${this.monitoringRules.size} 個品質規則`)
  }

  /**
   * 新增品質規則
   */
  addQualityRule (ruleId, rule) {
    this.monitoringRules.set(ruleId, {
      id: ruleId,
      name: rule.name,
      description: rule.description,
      calculator: rule.calculator,
      threshold: rule.threshold,
      enabled: true,
      createdAt: Date.now()
    })
  }

  /**
   * 分析資料品質
   */
  async analyzeDataQuality (data, metadata = {}) {
    try {
      this.logger.log('📊 開始分析資料品質')

      const analysisResult = {
        timestamp: Date.now(),
        dataSize: this.getDataSize(data),
        metrics: {},
        overallScore: 0,
        issues: [],
        recommendations: [],
        metadata
      }

      let totalScore = 0
      let validMetrics = 0

      // 執行所有品質規則
      for (const [ruleId, rule] of this.monitoringRules) {
        if (!rule.enabled) continue

        try {
          const score = rule.calculator(data)
          const metric = {
            name: rule.name,
            score,
            threshold: rule.threshold,
            passed: score >= rule.threshold,
            description: rule.description
          }

          analysisResult.metrics[ruleId] = metric
          totalScore += score
          validMetrics++

          // 檢查是否低於閾值
          if (!metric.passed) {
            analysisResult.issues.push({
              metric: rule.name,
              score,
              threshold: rule.threshold,
              severity: this.calculateSeverity(score, rule.threshold)
            })
          }
        } catch (error) {
          this.logger.error(`❌ 執行品質規則失敗 (${ruleId}):`, error)
        }
      }

      // 計算整體分數
      analysisResult.overallScore = validMetrics > 0 ? totalScore / validMetrics : 0

      // 生成改善建議
      analysisResult.recommendations = this.generateRecommendations(analysisResult)

      // 更新統計
      this.stats.totalAnalyses++
      this.stats.qualityIssuesDetected += analysisResult.issues.length
      this.stats.averageQualityScore =
        ((this.stats.averageQualityScore * (this.stats.totalAnalyses - 1)) + analysisResult.overallScore) / this.stats.totalAnalyses

      // 檢查是否需要產生警報
      await this.checkForAlerts(analysisResult)

      this.logger.log(`✅ 品質分析完成 - 整體分數: ${(analysisResult.overallScore * 100).toFixed(1)}%`)

      // 發送分析完成事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.QUALITY.ANALYZED', {
          overallScore: analysisResult.overallScore,
          issuesCount: analysisResult.issues.length,
          dataSize: analysisResult.dataSize
        })
      }

      return analysisResult
    } catch (error) {
      this.logger.error('❌ 資料品質分析失敗:', error)
      throw error
    }
  }

  /**
   * 檢查警報條件
   */
  async checkForAlerts (analysisResult) {
    for (const issue of analysisResult.issues) {
      const alertKey = `${issue.metric}_${issue.severity}`

      // 檢查警報冷卻時間
      const lastAlert = this.qualityAlerts.get(alertKey)
      if (lastAlert && Date.now() - lastAlert.timestamp < this.config.alertCooldown) {
        continue
      }

      const alert = {
        id: this.generateAlertId(),
        metric: issue.metric,
        severity: issue.severity,
        score: issue.score,
        threshold: issue.threshold,
        timestamp: Date.now(),
        resolved: false
      }

      this.qualityAlerts.set(alertKey, alert)
      this.stats.alertsGenerated++

      this.logger.warn(`⚠️ 品質警報: ${issue.metric} - 分數: ${(issue.score * 100).toFixed(1)}%, 閾值: ${(issue.threshold * 100).toFixed(1)}%`)

      // 發送警報事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.QUALITY.ALERT', alert)
      }
    }
  }

  /**
   * 計算嚴重程度
   */
  calculateSeverity (score, threshold) {
    const deviation = threshold - score

    if (deviation > 0.2) return this.ALERT_LEVELS.CRITICAL
    if (deviation > 0.1) return this.ALERT_LEVELS.WARNING
    return this.ALERT_LEVELS.INFO
  }

  /**
   * 生成改善建議
   */
  generateRecommendations (analysisResult) {
    const recommendations = []

    for (const issue of analysisResult.issues) {
      switch (issue.metric) {
        case '資料完整度':
          if (issue.score < 0.8) {
            recommendations.push({
              type: 'data_completeness',
              priority: 'high',
              message: '建議檢查資料提取邏輯，確保必要欄位都能正確提取',
              action: 'review_extraction_logic'
            })
          }
          break

        case '資料準確度':
          if (issue.score < 0.9) {
            recommendations.push({
              type: 'data_accuracy',
              priority: 'high',
              message: '建議加強資料驗證規則，提高資料格式檢查',
              action: 'enhance_validation'
            })
          }
          break

        case '處理成功率':
          if (issue.score < 0.95) {
            recommendations.push({
              type: 'processing_success',
              priority: 'critical',
              message: '建議檢查處理邏輯和錯誤處理機制',
              action: 'review_error_handling'
            })
          }
          break
      }
    }

    return recommendations
  }

  /**
   * 初始化品質基準線
   */
  async initializeQualityBaselines () {
    // 為每個指標設定基準線
    for (const metricType of Object.values(this.QUALITY_METRICS)) {
      this.qualityBaselines.set(metricType, {
        baseline: this.config.qualityThresholds[metricType] || 0.8,
        samples: [],
        lastUpdated: Date.now()
      })
    }

    this.logger.log('✅ 品質基準線初始化完成')
  }

  /**
   * 初始化監控規則
   */
  async initializeMonitoringRules () {
    // 監控規則已在 initializeQualityRules 中設定
    this.logger.log('✅ 監控規則初始化完成')
  }

  /**
   * 啟動即時監控
   */
  startRealTimeMonitoring () {
    if (!this.config.enableRealTimeAnalysis) return

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performPeriodicAnalysis()
      } catch (error) {
        this.logger.error('❌ 定期分析失敗:', error)
      }
    }, this.config.monitoringInterval)

    this.logger.log('🔄 即時監控已啟動')
  }

  /**
   * 啟動自動分析
   */
  startAutomaticAnalysis () {
    // 自動分析機制
    this.logger.log('🤖 自動分析已啟動')
  }

  /**
   * 停止監控機制
   */
  stopMonitoringMechanisms () {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    this.logger.log('⏹️ 監控機制已停止')
  }

  /**
   * 執行定期分析
   */
  async performPeriodicAnalysis () {
    // 實現定期品質分析邏輯
  }

  /**
   * 獲取資料大小
   */
  getDataSize (data) {
    if (!data) return 0
    if (data.books && Array.isArray(data.books)) {
      return data.books.length
    }
    return 1
  }

  /**
   * 生成警報 ID
   */
  generateAlertId () {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
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
        event: EXTRACTION_EVENTS.QUALITY_ANALYSIS_REQUEST,
        handler: this.handleQualityAnalysisRequest.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      },
      {
        event: EXTRACTION_EVENTS.DATA_QUALITY_CHECK,
        handler: this.handleDataQualityCheck.bind(this),
        priority: EVENT_PRIORITIES.HIGH
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
   * 處理品質分析請求
   */
  async handleQualityAnalysisRequest (event) {
    try {
      const { data, metadata, requestId } = event.data || {}
      const result = await this.analyzeDataQuality(data, metadata)

      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.QUALITY_ANALYSIS.RESULT', {
          requestId,
          result
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理品質分析請求失敗:', error)
    }
  }

  /**
   * 處理資料品質檢查
   */
  async handleDataQualityCheck (event) {
    try {
      const { data } = event.data || {}
      await this.analyzeDataQuality(data)
    } catch (error) {
      this.logger.error('❌ 處理資料品質檢查失敗:', error)
    }
  }

  /**
   * 獲取品質報告
   */
  getQualityReport () {
    return {
      overview: {
        totalAnalyses: this.stats.totalAnalyses,
        averageQualityScore: this.stats.averageQualityScore,
        issuesDetected: this.stats.qualityIssuesDetected,
        alertsGenerated: this.stats.alertsGenerated
      },
      activeAlerts: Array.from(this.qualityAlerts.values()).filter(alert => !alert.resolved),
      baselines: Object.fromEntries(this.qualityBaselines),
      lastAnalysis: this.monitoringData.samples[this.monitoringData.samples.length - 1] || null
    }
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      monitoring: this.state.monitoring,
      config: this.config,
      rulesCount: this.monitoringRules.size,
      baselinesCount: this.qualityBaselines.size,
      activeAlerts: Array.from(this.qualityAlerts.values()).filter(alert => !alert.resolved).length,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const alertRate = this.stats.totalAnalyses > 0
      ? (this.stats.alertsGenerated / this.stats.totalAnalyses)
      : 0

    const averageQuality = this.stats.averageQualityScore
    const activeAlertsCount = Array.from(this.qualityAlerts.values()).filter(alert => !alert.resolved).length

    const isHealthy = this.state.initialized &&
                     averageQuality >= 0.8 && // 平均品質分數 >= 80%
                     alertRate < 0.1 && // 警報率 < 10%
                     activeAlertsCount < 5 // 活動警報數 < 5

    return {
      service: 'QualityControlService',
      healthy: isHealthy,
      status: this.state.active ? 'active' : 'inactive',
      monitoring: this.state.monitoring,
      metrics: {
        totalAnalyses: this.stats.totalAnalyses,
        averageQualityScore: (averageQuality * 100).toFixed(1) + '%',
        issuesDetected: this.stats.qualityIssuesDetected,
        alertsGenerated: this.stats.alertsGenerated,
        activeAlerts: activeAlertsCount,
        alertRate: (alertRate * 100).toFixed(2) + '%'
      }
    }
  }
}

module.exports = QualityControlService
