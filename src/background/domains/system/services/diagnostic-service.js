/**
 * 診斷服務
 *
 * 負責功能：
 * - 系統診斷和故障排除
 * - 日誌收集和分析
 * - 診斷報告生成和匯出
 * - 故障恢復建議
 *
 * 設計考量：
 * - 深度診斷分析能力
 * - 智能故障識別和分類
 * - 可擴展的診斷規則引擎
 * - 隱私保護的資料收集
 *
 * 使用情境：
 * - 系統故障診斷和分析
 * - 效能問題根因分析
 * - 診斷報告生成和支援
 */

const {
  SYSTEM_EVENTS,
  EVENT_PRIORITIES
} = require('src/background/constants/module-constants')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

/**
 * Logger 後備方案設計理念：
 * - 診斷服務需要詳細記錄系統診斷過程和故障排除步驟
 * - 在 Chrome Extension Service Worker 環境中，console 物件提供基本的日誌輸出能力
 * - 當專用 Logger 不可用時，console 後備方案確保：
 *   1. 系統診斷規則執行和故障檢測的詳細記錄
 *   2. 日誌收集、分析和診斷報告生成的過程追蹤
 *   3. 故障恢復建議和自動修復嘗試的狀態記錄
 *   4. 診斷資料收集和隱私保護措施的執行記錄
 * - 此後備機制對系統故障排除和技術支援至關重要
 */

class DiagnosticService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false,
      collecting: false
    }

    // 診斷配置
    this.config = {
      logRetentionDays: 7,
      maxLogEntries: 1000,
      diagnosticLevels: ['error', 'warn', 'info', 'debug'],
      anonymizeData: true,
      enableAutoAnalysis: true
    }

    // 診斷資料
    this.diagnosticData = {
      logs: [],
      systemInfo: {},
      errorPatterns: new Map(),
      performanceMetrics: [],
      userActions: [],
      diagnosticSessions: []
    }

    // 診斷規則和分析器
    this.diagnosticRules = new Map()
    this.analyzers = new Map()
    this.registeredListeners = new Map()

    // 統計資料
    this.stats = {
      logsCollected: 0,
      diagnosticsPerformed: 0,
      patternsDetected: 0,
      reportsGenerated: 0
    }

    // 初始化預設診斷規則
    this.initializeDefaultRules()
  }

  /**
   * 初始化診斷服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('[WARN] 診斷服務已初始化')
      return
    }

    try {
      this.logger.log('[CHECK] 初始化診斷服務')

      // 收集系統基本資訊
      await this.collectSystemInfo()

      // 初始化分析器
      await this.initializeAnalyzers()

      // 註冊事件監聽器
      await this.registerEventListeners()

      this.state.initialized = true
      this.logger.log('[OK] 診斷服務初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.DIAGNOSTIC.INITIALIZED', {
          serviceName: 'DiagnosticService',
          config: this.config
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 初始化診斷服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動診斷服務
   */
  async start () {
    if (!this.state.initialized) {
      const error = new Error('服務尚未初始化')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
        category: 'general'
      }
      throw error
    }

    if (this.state.active) {
      this.logger.warn('[WARN] 診斷服務已啟動')
      return
    }

    try {
      this.logger.log('[START] 啟動診斷服務')

      // 開始資料收集
      this.startDataCollection()

      this.state.active = true
      this.state.collecting = true

      this.logger.log('[OK] 診斷服務啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.DIAGNOSTIC.STARTED', {
          serviceName: 'DiagnosticService'
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 啟動診斷服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止診斷服務
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('[WARN] 診斷服務未啟動')
      return
    }

    try {
      this.logger.log('[STOP] 停止診斷服務')

      // 停止資料收集
      this.stopDataCollection()

      // 生成最終診斷報告
      const finalReport = await this.generateDiagnosticReport()

      // 清理敏感資料
      this.cleanupSensitiveData()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      this.state.active = false
      this.state.collecting = false

      this.logger.log('[OK] 診斷服務停止完成')

      // 發送停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.DIAGNOSTIC.STOPPED', {
          serviceName: 'DiagnosticService',
          finalReport: this.anonymizeReport(finalReport)
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 停止診斷服務失敗:', error)
      throw error
    }
  }

  /**
   * 收集系統基本資訊
   */
  async collectSystemInfo () {
    try {
      this.diagnosticData.systemInfo = {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown',
        language: typeof navigator !== 'undefined' ? navigator.language : 'Unknown',
        timestamp: Date.now(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        memory: this.getMemoryInfo(),
        storage: await this.getStorageInfo(),
        extensions: await this.getExtensionInfo()
      }

      this.logger.log('[OK] 系統資訊收集完成')
    } catch (error) {
      this.logger.error('[FAIL] 收集系統資訊失敗:', error)
    }
  }

  /**
   * 獲取記憶體資訊
   */
  getMemoryInfo () {
    if (typeof performance !== 'undefined' && performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      }
    }
    return { used: 0, total: 0, limit: 0 }
  }

  /**
   * 獲取儲存資訊
   */
  async getStorageInfo () {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const usage = await chrome.storage.local.getBytesInUse()
        return {
          used: usage,
          quota: chrome.storage.local.QUOTA_BYTES || 5242880 // 5MB 預設
        }
      }
    } catch (error) {
      this.logger.warn('無法獲取儲存資訊:', error)
    }
    return { used: 0, quota: 0 }
  }

  /**
   * 獲取擴展資訊
   */
  async getExtensionInfo () {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        return {
          id: chrome.runtime.id,
          version: chrome.runtime.getManifest()?.version || 'Unknown'
        }
      }
    } catch (error) {
      this.logger.warn('無法獲取擴展資訊:', error)
    }
    return { id: 'Unknown', version: 'Unknown' }
  }

  /**
   * 初始化分析器
   */
  async initializeAnalyzers () {
    // 錯誤模式分析器
    this.analyzers.set('errorPatterns', (logs) => {
      const patterns = new Map()

      logs.filter(log => log.level === 'error').forEach(log => {
        const pattern = this.extractErrorPattern(log.message)
        if (pattern) {
          patterns.set(pattern, (patterns.get(pattern) || 0) + 1)
        }
      })

      return Array.from(patterns.entries())
        .filter(([pattern, count]) => count > 1)
        .map(([pattern, count]) => ({ pattern, count, severity: this.calculateSeverity(count) }))
    })

    // 效能問題分析器
    this.analyzers.set('performance', (metrics) => {
      const issues = []

      // 分析響應時間
      const slowResponses = metrics.filter(m => m.responseTime > 1000)
      if (slowResponses.length > 0) {
        issues.push({
          type: 'slow_response',
          count: slowResponses.length,
          avgTime: slowResponses.reduce((sum, m) => sum + m.responseTime, 0) / slowResponses.length
        })
      }

      return issues
    })

    // 記憶體使用分析器
    this.analyzers.set('memory', (systemInfo) => {
      const issues = []
      const memory = systemInfo.memory

      if (memory && memory.used > memory.limit * 0.8) {
        issues.push({
          type: 'high_memory_usage',
          percentage: (memory.used / memory.limit) * 100,
          severity: 'high'
        })
      }

      return issues
    })

    this.logger.log(`[OK] 初始化了 ${this.analyzers.size} 個分析器`)
  }

  /**
   * 初始化預設診斷規則
   */
  initializeDefaultRules () {
    // 頻繁錯誤規則
    this.diagnosticRules.set('frequent_errors', {
      condition: (data) => {
        const recentErrors = data.logs.filter(log =>
          log.level === 'error' && Date.now() - log.timestamp < 300000 // 5分鐘內
        )
        return recentErrors.length > 5
      },
      action: () => ({
        issue: 'frequent_errors',
        description: '檢測到頻繁錯誤',
        recommendation: '檢查系統日誌，識別錯誤根因並修復'
      })
    })

    // 記憶體洩漏規則
    this.diagnosticRules.set('memory_leak', {
      condition: (data) => {
        const memory = data.systemInfo.memory
        return memory && memory.used > memory.limit * 0.9
      },
      action: () => ({
        issue: 'potential_memory_leak',
        description: '記憶體使用過高，可能存在記憶體洩漏',
        recommendation: '重啟擴展或檢查記憶體使用模式'
      })
    })

    // 效能降級規則
    this.diagnosticRules.set('performance_degradation', {
      condition: (data) => {
        const slowMetrics = data.performanceMetrics.filter(m => m.responseTime > 2000)
        return slowMetrics.length > 3
      },
      action: () => ({
        issue: 'performance_degradation',
        description: '系統效能降級',
        recommendation: '檢查網路連線和系統負載'
      })
    })
  }

  /**
   * 開始資料收集
   */
  startDataCollection () {
    // 攔截和記錄日誌
    this.interceptLogs()

    this.logger.log('[STATS] 開始診斷資料收集')
  }

  /**
   * 停止資料收集
   */
  stopDataCollection () {
    // 清理日誌攔截
    this.cleanupLogInterception()

    this.logger.log('[STOP] 停止診斷資料收集')
  }

  /**
   * 攔截日誌
   */
  interceptLogs () {
    // 這裡可以實現日誌攔截邏輯
    // 例如重寫 console 方法或監聽特定事件
  }

  /**
   * 清理日誌攔截
   */
  cleanupLogInterception () {
    // 清理日誌攔截設置
  }

  /**
   * 記錄日誌條目
   */
  recordLogEntry (level, message, context = {}) {
    if (!this.state.collecting) return

    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      level,
      message,
      context: this.config.anonymizeData ? this.anonymizeContext(context) : context,
      timestamp: Date.now()
    }

    this.diagnosticData.logs.push(logEntry)
    this.stats.logsCollected++

    // 限制日誌數量
    if (this.diagnosticData.logs.length > this.config.maxLogEntries) {
      this.diagnosticData.logs = this.diagnosticData.logs.slice(-this.config.maxLogEntries / 2)
    }

    // 即時分析錯誤模式
    if (level === 'error') {
      this.analyzeErrorPattern(message)
    }
  }

  /**
   * 分析錯誤模式
   */
  analyzeErrorPattern (errorMessage) {
    const pattern = this.extractErrorPattern(errorMessage)
    if (pattern) {
      const count = (this.diagnosticData.errorPatterns.get(pattern) || 0) + 1
      this.diagnosticData.errorPatterns.set(pattern, count)

      if (count > 3) {
        this.stats.patternsDetected++
        this.logger.warn(`[CHECK] 檢測到重複錯誤模式: ${pattern} (${count} 次)`)
      }
    }
  }

  /**
   * 提取錯誤模式
   */
  extractErrorPattern (errorMessage) {
    // 簡化錯誤訊息，提取模式
    return errorMessage
      .replace(/\d+/g, 'NUMBER')
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID')
      .replace(/https?:\/\/[^\s]+/g, 'URL')
      .substring(0, 100)
  }

  /**
   * 計算嚴重程度
   */
  calculateSeverity (count) {
    if (count > 10) return 'high'
    if (count > 5) return 'medium'
    return 'low'
  }

  /**
   * 執行診斷分析
   */
  async performDiagnosticAnalysis () {
    this.stats.diagnosticsPerformed++

    const analysisResults = {
      timestamp: Date.now(),
      issues: [],
      recommendations: [],
      analysisDetails: {}
    }

    try {
      // 執行診斷規則
      for (const [ruleName, rule] of this.diagnosticRules) {
        try {
          if (rule.condition(this.diagnosticData)) {
            const result = rule.action()
            analysisResults.issues.push({
              rule: ruleName,
              ...result
            })
          }
        } catch (error) {
          this.logger.error(`診斷規則執行失敗 (${ruleName}):`, error)
        }
      }

      // 執行分析器
      for (const [analyzerName, analyzer] of this.analyzers) {
        try {
          let analysisData
          switch (analyzerName) {
            case 'errorPatterns':
              analysisData = this.diagnosticData.logs
              break
            case 'performance':
              analysisData = this.diagnosticData.performanceMetrics
              break
            case 'memory':
              analysisData = this.diagnosticData.systemInfo
              break
            default:
              analysisData = this.diagnosticData
          }

          const results = analyzer(analysisData)
          analysisResults.analysisDetails[analyzerName] = results
        } catch (error) {
          this.logger.error(`分析器執行失敗 (${analyzerName}):`, error)
        }
      }

      this.logger.log(`[OK] 診斷分析完成，發現 ${analysisResults.issues.length} 個問題`)
      return analysisResults
    } catch (error) {
      this.logger.error('[FAIL] 診斷分析失敗:', error)
      throw error
    }
  }

  /**
   * 生成診斷報告
   */
  async generateDiagnosticReport () {
    this.stats.reportsGenerated++

    try {
      const analysis = await this.performDiagnosticAnalysis()

      const report = {
        metadata: {
          reportId: `diag_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
          generatedAt: Date.now(),
          version: '1.0.0',
          anonymized: this.config.anonymizeData
        },
        systemInfo: this.config.anonymizeData
          ? this.anonymizeSystemInfo(this.diagnosticData.systemInfo)
          : this.diagnosticData.systemInfo,
        summary: {
          totalLogs: this.diagnosticData.logs.length,
          errorCount: this.diagnosticData.logs.filter(l => l.level === 'error').length,
          warningCount: this.diagnosticData.logs.filter(l => l.level === 'warn').length,
          issuesFound: analysis.issues.length,
          errorPatterns: this.diagnosticData.errorPatterns.size
        },
        analysis,
        recommendations: this.generateRecommendations(analysis),
        stats: { ...this.stats }
      }

      return report
    } catch (error) {
      this.logger.error('[FAIL] 生成診斷報告失敗:', error)
      throw error
    }
  }

  /**
   * 生成建議
   */
  generateRecommendations (analysis) {
    const recommendations = []

    // 基於分析結果生成建議
    analysis.issues.forEach(issue => {
      if (issue.recommendation) {
        recommendations.push(issue.recommendation)
      }
    })

    // 通用建議
    if (this.diagnosticData.logs.filter(l => l.level === 'error').length > 10) {
      recommendations.push('考慮重啟擴展以清除累積的錯誤狀態')
    }

    return recommendations
  }

  /**
   * 匿名化資料
   */
  anonymizeContext (context) {
    if (!context || typeof context !== 'object') return context

    const anonymized = {}
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        anonymized[key] = value.replace(/\b\d{4,}\b/g, 'XXXX')
      } else {
        anonymized[key] = value
      }
    }
    return anonymized
  }

  /**
   * 匿名化系統資訊
   */
  anonymizeSystemInfo (systemInfo) {
    return {
      ...systemInfo,
      userAgent: 'ANONYMIZED',
      timezone: 'ANONYMIZED'
    }
  }

  /**
   * 匿名化報告
   */
  anonymizeReport (report) {
    if (!this.config.anonymizeData) return report

    return {
      ...report,
      systemInfo: this.anonymizeSystemInfo(report.systemInfo)
    }
  }

  /**
   * 清理敏感資料
   */
  cleanupSensitiveData () {
    if (this.config.anonymizeData) {
      // 清理可能包含敏感資訊的日誌
      this.diagnosticData.logs = this.diagnosticData.logs.map(log => ({
        ...log,
        context: this.anonymizeContext(log.context)
      }))
    }
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners () {
    if (!this.eventBus) {
      this.logger.warn('[WARN] EventBus 不可用，跳過事件監聽器註冊')
      return
    }

    const listeners = [
      {
        event: SYSTEM_EVENTS.DIAGNOSTIC_REQUEST,
        handler: this.handleDiagnosticRequest.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      },
      {
        event: SYSTEM_EVENTS.ERROR_OCCURRED,
        handler: this.handleErrorOccurred.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      }
    ]

    for (const { event, handler, priority } of listeners) {
      const listenerId = await this.eventBus.on(event, handler, { priority })
      this.registeredListeners.set(event, listenerId)
    }

    this.logger.log(`[OK] 註冊了 ${listeners.length} 個事件監聽器`)
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
        this.logger.error(`[FAIL] 取消註冊事件監聽器失敗 (${event}):`, error)
      }
    }

    this.registeredListeners.clear()
    this.logger.log('[OK] 所有事件監聽器已取消註冊')
  }

  /**
   * 處理診斷請求
   */
  async handleDiagnosticRequest (event) {
    try {
      const { type } = event.data || {}

      let result
      switch (type) {
        case 'full_report':
          result = await this.generateDiagnosticReport()
          break
        case 'analysis_only':
          result = await this.performDiagnosticAnalysis()
          break
        default:
          result = this.getStatus()
      }

      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.DIAGNOSTIC.RESULT', {
          requestId: event.data?.requestId,
          type,
          result: this.config.anonymizeData ? this.anonymizeReport(result) : result
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 處理診斷請求失敗:', error)
    }
  }

  /**
   * 處理錯誤發生事件
   */
  async handleErrorOccurred (event) {
    const { error, context } = event.data || {}
    this.recordLogEntry('error', error?.message || '未知錯誤', context)
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      collecting: this.state.collecting,
      config: this.config,
      dataSize: {
        logs: this.diagnosticData.logs.length,
        errorPatterns: this.diagnosticData.errorPatterns.size,
        performanceMetrics: this.diagnosticData.performanceMetrics.length
      },
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const isHealthy = this.state.initialized &&
                     this.diagnosticData.logs.length < this.config.maxLogEntries

    return {
      service: 'DiagnosticService',
      healthy: isHealthy,
      status: this.state.active ? 'active' : 'inactive',
      collecting: this.state.collecting,
      metrics: {
        logsCollected: this.stats.logsCollected,
        diagnosticsPerformed: this.stats.diagnosticsPerformed,
        patternsDetected: this.stats.patternsDetected,
        reportsGenerated: this.stats.reportsGenerated
      }
    }
  }
}

module.exports = DiagnosticService
