/**
 * 健康監控服務
 *
 * 負責功能：
 * - 系統和模組健康狀態監控
 * - 效能指標收集和分析
 * - 健康檢查排程和執行
 * - 預警和通知機制
 *
 * 設計考量：
 * - 非侵入式監控機制
 * - 可配置的監控頻率和閾值
 * - 階層化的健康狀態報告
 * - 資源使用優化
 *
 * 使用情境：
 * - 系統健康狀態即時監控
 * - 效能瓶頸識別和預警
 * - 故障預測和預防
 */

const {
  SYSTEM_EVENTS,
  EVENT_PRIORITIES
} = require('src/background/constants/module-constants')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

/**
 * Logger 後備方案設計理念：
 * - 健康監控服務需要持續記錄系統效能和健康狀況指標
 * - 在 Chrome Extension Service Worker 環境中，console 物件提供基本的日誌輸出能力
 * - 當專用 Logger 不可用時，console 後備方案確保：
 *   1. 系統健康檢查和效能監控的結果記錄
 *   2. 警報觸發、閾值判定和自動修復的狀態追蹤
 *   3. 定期監控任務和健康報告生成的執行記錄
 *   4. 系統異常檢測和緊急狀況的重要事件記錄
 * - 此後備機制對系統監控和預防性維護至關重要
 */

class HealthMonitoringService {
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

    // 監控配置
    this.config = {
      checkInterval: 30000, // 30秒
      healthThreshold: 0.8, // 80%
      errorThreshold: 5, // 錯誤數量閾值
      memoryThreshold: 50 * 1024 * 1024, // 50MB
      responseTimeThreshold: 1000 // 1秒
    }

    // 健康監控數據
    this.healthData = {
      system: { healthy: true, score: 1.0, issues: [] },
      modules: new Map(),
      metrics: {
        memory: { current: 0, peak: 0, average: 0 },
        performance: { responseTime: 0, throughput: 0 },
        errors: { count: 0, rate: 0, recent: [] }
      },
      alerts: [],
      history: []
    }

    // 監控器和定時器
    this.monitors = new Map()
    this.timers = new Map()
    this.registeredListeners = new Map()

    // 統計資料
    this.stats = {
      checksPerformed: 0,
      alertsTriggered: 0,
      issuesDetected: 0,
      recoveries: 0
    }
  }

  /**
   * 初始化健康監控服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('[WARN] 健康監控服務已初始化')
      return
    }

    try {
      this.logger.log('初始化健康監控服務')

      // 初始化監控器
      await this.initializeMonitors()

      // 註冊事件監聽器
      await this.registerEventListeners()

      this.state.initialized = true
      this.logger.log('[OK] 健康監控服務初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.HEALTH.INITIALIZED', {
          serviceName: 'HealthMonitoringService',
          config: this.config
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 初始化健康監控服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動健康監控服務
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
      this.logger.warn('[WARN] 健康監控服務已啟動')
      return
    }

    try {
      this.logger.log('[START] 啟動健康監控服務')

      // 執行初始健康檢查
      await this.performInitialHealthCheck()

      // 啟動定期監控
      this.startPeriodicMonitoring()

      this.state.active = true
      this.state.monitoring = true

      this.logger.log('[OK] 健康監控服務啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.HEALTH.STARTED', {
          serviceName: 'HealthMonitoringService',
          monitoringInterval: this.config.checkInterval
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 啟動健康監控服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止健康監控服務
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('[WARN] 健康監控服務未啟動')
      return
    }

    try {
      this.logger.log('[STOP] 停止健康監控服務')

      // 停止定期監控
      this.stopPeriodicMonitoring()

      // 生成最終健康報告
      const finalReport = this.generateHealthReport()
      this.logger.log('[STATS] 最終健康報告:', finalReport)

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      this.state.active = false
      this.state.monitoring = false

      this.logger.log('[OK] 健康監控服務停止完成')

      // 發送停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.HEALTH.STOPPED', {
          serviceName: 'HealthMonitoringService',
          finalReport
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 停止健康監控服務失敗:', error)
      throw error
    }
  }

  /**
   * 初始化監控器
   */
  async initializeMonitors () {
    // 記憶體監控器
    this.monitors.set('memory', () => {
      if (typeof performance !== 'undefined' && performance.memory) {
        const memory = performance.memory
        this.healthData.metrics.memory = {
          current: memory.usedJSHeapSize,
          peak: Math.max(this.healthData.metrics.memory.peak, memory.usedJSHeapSize),
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit
        }

        // 檢查記憶體使用是否超過閾值
        if (memory.usedJSHeapSize > this.config.memoryThreshold) {
          this.recordIssue('memory', 'high_usage',
            `記憶體使用過高: ${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`)
        }
      }
    })

    // 錯誤監控器
    this.monitors.set('errors', () => {
      const recentErrors = this.healthData.metrics.errors.recent
      const errorRate = recentErrors.length / (5 * 60) // 每分鐘錯誤率

      this.healthData.metrics.errors.rate = errorRate

      if (recentErrors.length > this.config.errorThreshold) {
        this.recordIssue('errors', 'high_rate',
          `錯誤率過高: ${recentErrors.length} 錯誤在過去5分鐘`)
      }
    })

    // 效能監控器
    this.monitors.set('performance', () => {
      // 收集響應時間等效能指標
      // 這裡可以整合實際的效能監控邏輯
    })

    this.logger.log(`[OK] 初始化了 ${this.monitors.size} 個監控器`)
  }

  /**
   * 執行初始健康檢查
   */
  async performInitialHealthCheck () {
    this.logger.log('[CHECK] 執行初始健康檢查')

    try {
      // 檢查基本系統狀態
      this.healthData.system = {
        healthy: true,
        score: 1.0,
        issues: [],
        timestamp: Date.now()
      }

      // 執行所有監控器
      for (const [name, monitor] of this.monitors) {
        try {
          await monitor()
        } catch (error) {
          this.recordIssue('monitor', 'execution_failed',
            `監控器 ${name} 執行失敗: ${error.message}`)
        }
      }

      // 計算整體健康分數
      this.calculateOverallHealth()

      this.stats.checksPerformed++
      this.logger.log('[OK] 初始健康檢查完成')
    } catch (error) {
      this.logger.error('[FAIL] 初始健康檢查失敗:', error)
      this.healthData.system.healthy = false
      this.healthData.system.score = 0.0
    }
  }

  /**
   * 啟動定期監控
   */
  startPeriodicMonitoring () {
    const healthCheckTimer = setInterval(async () => {
      if (this.state.monitoring) {
        await this.performHealthCheck()
      }
    }, this.config.checkInterval)

    this.timers.set('healthCheck', healthCheckTimer)

    // 清理舊警報的定時器
    const alertCleanupTimer = setInterval(() => {
      this.cleanupOldAlerts()
    }, 60000) // 每分鐘清理一次

    this.timers.set('alertCleanup', alertCleanupTimer)

    this.logger.log('[TIMER] 定期監控已啟動')
  }

  /**
   * 停止定期監控
   */
  stopPeriodicMonitoring () {
    for (const [, timer] of this.timers) {
      clearInterval(timer)
    }
    this.timers.clear()
    this.logger.log('[STOP] 定期監控已停止')
  }

  /**
   * 執行健康檢查
   */
  async performHealthCheck () {
    this.stats.checksPerformed++

    try {
      // 執行所有監控器
      for (const [name, monitor] of this.monitors) {
        try {
          await monitor()
        } catch (error) {
          this.recordIssue('monitor', 'execution_failed',
            `監控器 ${name} 執行失敗: ${error.message}`)
        }
      }

      // 計算整體健康分數
      this.calculateOverallHealth()

      // 檢查是否需要觸發警報
      await this.checkAlertConditions()

      // 更新歷史記錄
      this.updateHealthHistory()
    } catch (error) {
      this.logger.error('[FAIL] 健康檢查執行失敗:', error)
      this.recordIssue('system', 'check_failed', `健康檢查失敗: ${error.message}`)
    }
  }

  /**
   * 記錄問題
   */
  recordIssue (category, type, message) {
    const issue = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      category,
      type,
      message,
      timestamp: Date.now(),
      severity: this.calculateSeverity(category, type)
    }

    this.healthData.system.issues.push(issue)
    this.stats.issuesDetected++

    // 限制問題記錄數量
    if (this.healthData.system.issues.length > 100) {
      this.healthData.system.issues = this.healthData.system.issues.slice(-50)
    }

    this.logger.warn(`[WARN] 健康問題 [${category}/${type}]: ${message}`)
  }

  /**
   * 計算問題嚴重程度
   */
  calculateSeverity (category, type) {
    const severityMap = {
      memory: { high_usage: 'high' },
      errors: { high_rate: 'high' },
      performance: { slow_response: 'medium' },
      monitor: { execution_failed: 'low' }
    }

    return severityMap[category]?.[type] || 'low'
  }

  /**
   * 計算整體健康分數
   */
  calculateOverallHealth () {
    const issues = this.healthData.system.issues
    const recentIssues = issues.filter(issue =>
      Date.now() - issue.timestamp < 5 * 60 * 1000 // 過去5分鐘
    )

    let score = 1.0

    // 根據問題數量和嚴重程度計算分數
    for (const issue of recentIssues) {
      switch (issue.severity) {
        case 'high':
          score -= 0.3
          break
        case 'medium':
          score -= 0.2
          break
        case 'low':
          score -= 0.1
          break
      }
    }

    score = Math.max(0, score)

    this.healthData.system.score = score
    this.healthData.system.healthy = score >= this.config.healthThreshold
    this.healthData.system.timestamp = Date.now()
  }

  /**
   * 檢查警報條件
   */
  async checkAlertConditions () {
    const currentHealth = this.healthData.system

    // 檢查系統健康狀態是否低於閾值
    if (!currentHealth.healthy && currentHealth.score < this.config.healthThreshold) {
      await this.triggerAlert('system_unhealthy',
        `系統健康分數過低: ${(currentHealth.score * 100).toFixed(1)}%`)
    }

    // 檢查是否有高嚴重度問題
    const highSeverityIssues = currentHealth.issues.filter(issue =>
      issue.severity === 'high' && Date.now() - issue.timestamp < 60000 // 過去1分鐘
    )

    if (highSeverityIssues.length > 0) {
      await this.triggerAlert('high_severity_issues',
        `檢測到 ${highSeverityIssues.length} 個高嚴重度問題`)
    }
  }

  /**
   * 觸發警報
   */
  async triggerAlert (type, message) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type,
      message,
      timestamp: Date.now(),
      acknowledged: false
    }

    this.healthData.alerts.push(alert)
    this.stats.alertsTriggered++

    this.logger.warn(`[ALERT] 健康警報 [${type}]: ${message}`)

    // 發送警報事件
    if (this.eventBus) {
      await this.eventBus.emit('SYSTEM.HEALTH.ALERT', {
        alert,
        systemHealth: this.healthData.system
      })
    }
  }

  /**
   * 更新健康歷史
   */
  updateHealthHistory () {
    const historyEntry = {
      timestamp: Date.now(),
      score: this.healthData.system.score,
      healthy: this.healthData.system.healthy,
      issuesCount: this.healthData.system.issues.length
    }

    this.healthData.history.push(historyEntry)

    // 限制歷史記錄數量（保留24小時的數據，假設每30秒一次檢查）
    if (this.healthData.history.length > 2880) {
      this.healthData.history = this.healthData.history.slice(-1440)
    }
  }

  /**
   * 清理舊警報
   */
  cleanupOldAlerts () {
    const oneHourAgo = Date.now() - 60 * 60 * 1000

    this.healthData.alerts = this.healthData.alerts.filter(alert =>
      alert.timestamp > oneHourAgo || !alert.acknowledged
    )

    // 清理舊問題
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    this.healthData.system.issues = this.healthData.system.issues.filter(issue =>
      issue.timestamp > fiveMinutesAgo || issue.severity === 'high'
    )
  }

  /**
   * 生成健康報告
   */
  generateHealthReport () {
    return {
      timestamp: Date.now(),
      system: {
        healthy: this.healthData.system.healthy,
        score: this.healthData.system.score,
        issuesCount: this.healthData.system.issues.length
      },
      metrics: { ...this.healthData.metrics },
      alerts: {
        total: this.healthData.alerts.length,
        unacknowledged: this.healthData.alerts.filter(a => !a.acknowledged).length
      },
      stats: { ...this.stats },
      uptime: this.state.active ? Date.now() - (this.state.startTime || Date.now()) : 0
    }
  }

  /**
   * 註冊模組健康狀態
   */
  registerModuleHealth (moduleName, healthData) {
    this.healthData.modules.set(moduleName, {
      ...healthData,
      timestamp: Date.now()
    })
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
        event: SYSTEM_EVENTS.HEALTH_CHECK_REQUEST,
        handler: this.handleHealthCheckRequest.bind(this),
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
   * 處理健康檢查請求
   */
  async handleHealthCheckRequest (event) {
    try {
      const report = this.generateHealthReport()

      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.HEALTH.REPORT', {
          requestId: event.data?.requestId,
          report
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 處理健康檢查請求失敗:', error)
    }
  }

  /**
   * 處理錯誤發生事件
   */
  async handleErrorOccurred (event) {
    try {
      const { error, context } = event.data || {}

      // 記錄錯誤到健康監控
      this.healthData.metrics.errors.recent.push({
        error: error?.message || '未知錯誤',
        context,
        timestamp: Date.now()
      })

      // 清理舊錯誤記錄（保留5分鐘）
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      this.healthData.metrics.errors.recent = this.healthData.metrics.errors.recent
        .filter(e => e.timestamp > fiveMinutesAgo)

      this.healthData.metrics.errors.count++
    } catch (error) {
      this.logger.error('[FAIL] 處理錯誤發生事件失敗:', error)
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
      systemHealth: this.healthData.system,
      monitorsCount: this.monitors.size,
      alertsCount: this.healthData.alerts.length,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    return {
      service: 'HealthMonitoringService',
      healthy: this.state.initialized && this.state.active,
      status: this.state.active ? 'active' : 'inactive',
      systemHealth: this.healthData.system,
      metrics: {
        checksPerformed: this.stats.checksPerformed,
        alertsTriggered: this.stats.alertsTriggered,
        issuesDetected: this.stats.issuesDetected,
        recoveries: this.stats.recoveries
      }
    }
  }
}

module.exports = HealthMonitoringService
