/**
 * 系統監控器
 *
 * 負責功能：
 * - 監控系統整體健康狀態和效能指標
 * - 追蹤模組運行狀況和資源使用情況
 * - 提供系統診斷和效能分析功能
 * - 實現系統警報和異常通知機制
 *
 * 設計考量：
 * - 基於 BaseModule 實現標準生命週期管理
 * - 整合各模組的健康狀態監控
 * - 實現效能指標的收集和分析
 * - 提供系統狀態的即時監控和歷史追蹤
 */

const BaseModule = require('../lifecycle/base-module')
const {
  HEALTH_STATES,
  SYSTEM_EVENTS,
  EVENT_PRIORITIES,
  TIMEOUTS,
  LIMITS
} = require('../constants/module-constants')

class SystemMonitor extends BaseModule {
  constructor (dependencies = {}) {
    super(dependencies)

    // 監控的模組清單
    this.monitoredModules = new Map()
    this.moduleHealthHistory = new Map()

    // 系統指標
    this.systemMetrics = {
      startTime: Date.now(),
      lastHealthCheck: null,
      totalUptime: 0,
      restartCount: 0,

      // 效能指標
      performance: {
        memoryUsage: 0,
        cpuUsage: 0,
        eventProcessingTime: [],
        messageProcessingTime: [],
        apiResponseTime: []
      },

      // 功能指標
      functionality: {
        activeModules: 0,
        healthyModules: 0,
        degradedModules: 0,
        unhealthyModules: 0,
        activeConnections: 0,
        processedMessages: 0,
        processedEvents: 0
      }
    }

    // 監控配置
    this.config = {
      healthCheckInterval: TIMEOUTS.HEALTH_CHECK_INTERVAL,
      metricCollectionInterval: 10000, // 10秒
      historyRetention: 3600000, // 1小時
      alertThresholds: {
        memoryUsage: 100 * 1024 * 1024, // 100MB
        eventProcessingTime: 5000, // 5秒
        messageProcessingTime: 3000, // 3秒
        unhealthyModuleRatio: 0.3 // 30%
      },
      enablePerformanceMonitoring: true,
      enableAlerts: true
    }

    // 警報狀態
    this.alerts = {
      active: new Map(),
      history: [],
      suppressions: new Map()
    }

    // 統計資料
    this.stats = {
      totalHealthChecks: 0,
      healthCheckFailures: 0,
      alertsTriggered: 0,
      alertsSuppressed: 0,
      metricsCollected: 0
    }

    // 多語言支援
    this.i18nManager = dependencies.i18nManager || null
  }

  /**
   * 初始化系統監控器
   * @returns {Promise<void>}
   * @protected
   */
  async _doInitialize () {
    if (this.i18nManager) {
      this.logger.log(this.i18nManager.t('modules.operations.initialize', { moduleName: this.moduleName }))
    } else {
      this.logger.log('📊 初始化系統監控器')
    }

    // 初始化監控系統
    await this.initializeMonitoring()

    // 載入歷史資料
    await this.loadHistoricalData()

    this.logger.log('✅ 系統監控器初始化完成')
  }

  /**
   * 啟動系統監控器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStart () {
    this.logger.log('▶️ 啟動系統監控器')

    // 註冊事件監聽器
    await this.registerEventListeners()

    // 開始健康檢查
    this.startHealthMonitoring()

    // 開始效能監控
    if (this.config.enablePerformanceMonitoring) {
      this.startPerformanceMonitoring()
    }

    // 執行初始健康檢查
    await this.performInitialHealthCheck()

    this.logger.log('✅ 系統監控器啟動完成')
  }

  /**
   * 停止系統監控器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStop () {
    this.logger.log('⏹️ 停止系統監控器')

    // 停止所有監控
    this.stopHealthMonitoring()
    this.stopPerformanceMonitoring()

    // 取消註冊事件監聽器
    await this.unregisterEventListeners()

    // 保存歷史資料
    await this.saveHistoricalData()

    this.logger.log('✅ 系統監控器停止完成')
  }

  /**
   * 初始化監控系統
   * @returns {Promise<void>}
   * @private
   */
  async initializeMonitoring () {
    try {
      // 初始化系統指標
      this.systemMetrics.startTime = Date.now()
      this.systemMetrics.lastHealthCheck = null

      // 清理舊的監控資料
      this.monitoredModules.clear()
      this.moduleHealthHistory.clear()
      this.alerts.active.clear()

      this.logger.log('🔧 監控系統初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化監控系統失敗:', error)
      throw error
    }
  }

  /**
   * 註冊事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async registerEventListeners () {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 未初始化，跳過事件監聽器設定')
      return
    }

    try {
      // 模組狀態變更事件
      this.moduleStateListenerId = this.eventBus.on('MODULE.STATE.CHANGED',
        (event) => this.handleModuleStateChange(event.data),
        { priority: EVENT_PRIORITIES.NORMAL }
      )

      // 系統事件監控
      this.systemEventListenerId = this.eventBus.on(SYSTEM_EVENTS.ERROR,
        (event) => this.handleSystemEvent(event.data),
        { priority: EVENT_PRIORITIES.HIGH }
      )

      // 效能事件監控
      this.performanceListenerId = this.eventBus.on('PERFORMANCE.METRIC',
        (event) => this.handlePerformanceMetric(event.data),
        { priority: EVENT_PRIORITIES.LOW }
      )

      this.logger.log('📝 系統監控事件監聽器註冊完成')
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
      const listeners = [
        { event: 'MODULE.STATE.CHANGED', id: this.moduleStateListenerId },
        { event: SYSTEM_EVENTS.ERROR, id: this.systemEventListenerId },
        { event: 'PERFORMANCE.METRIC', id: this.performanceListenerId }
      ]

      for (const listener of listeners) {
        if (listener.id) {
          this.eventBus.off(listener.event, listener.id)
        }
      }

      this.logger.log('🔄 系統監控事件監聽器取消註冊完成')
    } catch (error) {
      this.logger.error('❌ 取消註冊事件監聽器失敗:', error)
    }
  }

  /**
   * 註冊模組監控
   * @param {string} moduleName - 模組名稱
   * @param {Object} module - 模組實例
   * @returns {void}
   */
  registerModule (moduleName, module) {
    try {
      this.monitoredModules.set(moduleName, {
        name: moduleName,
        instance: module,
        registeredAt: Date.now(),
        lastHealthCheck: null,
        healthHistory: [],
        currentHealth: HEALTH_STATES.UNKNOWN
      })

      // 初始化健康歷史
      this.moduleHealthHistory.set(moduleName, [])

      this.logger.log(`📋 註冊模組監控: ${moduleName}`)
    } catch (error) {
      this.logger.error(`❌ 註冊模組監控失敗: ${moduleName}`, error)
    }
  }

  /**
   * 取消註冊模組監控
   * @param {string} moduleName - 模組名稱
   * @returns {void}
   */
  unregisterModule (moduleName) {
    try {
      this.monitoredModules.delete(moduleName)
      this.moduleHealthHistory.delete(moduleName)

      this.logger.log(`🗑️ 取消註冊模組監控: ${moduleName}`)
    } catch (error) {
      this.logger.error(`❌ 取消註冊模組監控失敗: ${moduleName}`, error)
    }
  }

  /**
   * 開始健康監控
   * @private
   */
  startHealthMonitoring () {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck()
    }, this.config.healthCheckInterval)

    this.logger.log('💓 系統健康監控已啟動')
  }

  /**
   * 停止健康監控
   * @private
   */
  stopHealthMonitoring () {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }

    this.logger.log('💓 系統健康監控已停止')
  }

  /**
   * 開始效能監控
   * @private
   */
  startPerformanceMonitoring () {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval)
    }

    this.metricsCollectionInterval = setInterval(async () => {
      await this.collectSystemMetrics()
    }, this.config.metricCollectionInterval)

    this.logger.log('📈 系統效能監控已啟動')
  }

  /**
   * 停止效能監控
   * @private
   */
  stopPerformanceMonitoring () {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval)
      this.metricsCollectionInterval = null
    }

    this.logger.log('📈 系統效能監控已停止')
  }

  /**
   * 執行健康檢查
   * @returns {Promise<void>}
   * @private
   */
  async performHealthCheck () {
    try {
      this.stats.totalHealthChecks++
      const checkStartTime = Date.now()

      const moduleHealthResults = new Map()
      let healthyModules = 0
      let degradedModules = 0
      let unhealthyModules = 0

      // 檢查所有註冊的模組
      for (const [moduleName, moduleInfo] of this.monitoredModules) {
        try {
          const healthStatus = await this.checkModuleHealth(moduleInfo)
          moduleHealthResults.set(moduleName, healthStatus)

          // 統計健康狀態
          switch (healthStatus.health) {
            case HEALTH_STATES.HEALTHY:
              healthyModules++
              break
            case HEALTH_STATES.DEGRADED:
              degradedModules++
              break
            case HEALTH_STATES.UNHEALTHY:
              unhealthyModules++
              break
          }

          // 更新模組健康資訊
          moduleInfo.currentHealth = healthStatus.health
          moduleInfo.lastHealthCheck = Date.now()

          // 記錄健康歷史
          const healthHistory = this.moduleHealthHistory.get(moduleName) || []
          healthHistory.push({
            timestamp: Date.now(),
            health: healthStatus.health,
            details: healthStatus.details
          })

          // 限制歷史記錄大小
          if (healthHistory.length > 100) {
            healthHistory.shift()
          }

          this.moduleHealthHistory.set(moduleName, healthHistory)
        } catch (error) {
          this.logger.error(`❌ 檢查模組健康失敗: ${moduleName}`, error)
          this.stats.healthCheckFailures++
          unhealthyModules++
        }
      }

      // 更新系統功能指標
      this.systemMetrics.functionality.activeModules = this.monitoredModules.size
      this.systemMetrics.functionality.healthyModules = healthyModules
      this.systemMetrics.functionality.degradedModules = degradedModules
      this.systemMetrics.functionality.unhealthyModules = unhealthyModules

      // 計算系統整體健康狀態
      const overallHealth = this.calculateOverallHealth(moduleHealthResults)

      // 檢查警報條件
      if (this.config.enableAlerts) {
        await this.checkAlertConditions(overallHealth, moduleHealthResults)
      }

      // 更新最後檢查時間
      this.systemMetrics.lastHealthCheck = Date.now()

      // 觸發健康檢查完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.HEALTH.CHECK.COMPLETED', {
          overallHealth,
          moduleResults: Object.fromEntries(moduleHealthResults),
          duration: Date.now() - checkStartTime,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error('❌ 執行健康檢查失敗:', error)
      this.stats.healthCheckFailures++
    }
  }

  /**
   * 檢查模組健康狀態
   * @param {Object} moduleInfo - 模組資訊
   * @returns {Promise<Object>} 健康狀態
   * @private
   */
  async checkModuleHealth (moduleInfo) {
    try {
      const module = moduleInfo.instance

      // 檢查模組是否有健康檢查方法
      if (typeof module.getHealthStatus === 'function') {
        return await module.getHealthStatus()
      }

      // 基本狀態檢查
      const basicHealth = {
        health: HEALTH_STATES.UNKNOWN,
        details: {
          state: module.state || 'unknown',
          initialized: module.initialized || false,
          running: module.running || false
        }
      }

      // 簡單的健康判定
      if (basicHealth.details.initialized && basicHealth.details.running) {
        basicHealth.health = HEALTH_STATES.HEALTHY
      } else if (basicHealth.details.initialized) {
        basicHealth.health = HEALTH_STATES.DEGRADED
      } else {
        basicHealth.health = HEALTH_STATES.UNHEALTHY
      }

      return basicHealth
    } catch (error) {
      return {
        health: HEALTH_STATES.UNHEALTHY,
        details: {
          error: error.message,
          checkFailed: true
        }
      }
    }
  }

  /**
   * 計算系統整體健康狀態
   * @param {Map} moduleResults - 模組健康結果
   * @returns {string} 系統健康狀態
   * @private
   */
  calculateOverallHealth (moduleResults) {
    if (moduleResults.size === 0) {
      return HEALTH_STATES.UNKNOWN
    }

    let healthyCount = 0
    let degradedCount = 0
    let unhealthyCount = 0

    for (const result of moduleResults.values()) {
      switch (result.health) {
        case HEALTH_STATES.HEALTHY:
          healthyCount++
          break
        case HEALTH_STATES.DEGRADED:
          degradedCount++
          break
        case HEALTH_STATES.UNHEALTHY:
          unhealthyCount++
          break
      }
    }

    const totalModules = moduleResults.size
    const healthyRatio = healthyCount / totalModules
    const unhealthyRatio = unhealthyCount / totalModules

    // 健康狀態判定邏輯
    if (unhealthyRatio > this.config.alertThresholds.unhealthyModuleRatio) {
      return HEALTH_STATES.UNHEALTHY
    } else if (degradedCount > 0 || healthyRatio < 0.8) {
      return HEALTH_STATES.DEGRADED
    } else {
      return HEALTH_STATES.HEALTHY
    }
  }

  /**
   * 收集系統指標
   * @returns {Promise<void>}
   * @private
   */
  async collectSystemMetrics () {
    try {
      this.stats.metricsCollected++

      // 收集記憶體使用情況
      if (typeof performance !== 'undefined' && performance.memory) {
        this.systemMetrics.performance.memoryUsage = performance.memory.usedJSHeapSize
      }

      // 計算系統運行時間
      this.systemMetrics.totalUptime = Date.now() - this.systemMetrics.startTime

      // 觸發指標收集事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.METRICS.COLLECTED', {
          metrics: this.systemMetrics,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error('❌ 收集系統指標失敗:', error)
    }
  }

  /**
   * 檢查警報條件
   * @param {string} overallHealth - 整體健康狀態
   * @param {Map} moduleResults - 模組結果
   * @returns {Promise<void>}
   * @private
   */
  async checkAlertConditions (overallHealth, moduleResults) {
    try {
      // 檢查系統整體健康警報
      if (overallHealth === HEALTH_STATES.UNHEALTHY) {
        await this.triggerAlert('SYSTEM_UNHEALTHY', {
          message: '系統整體健康狀態異常',
          severity: 'critical',
          details: { overallHealth }
        })
      }

      // 檢查記憶體使用警報
      if (this.systemMetrics.performance.memoryUsage > this.config.alertThresholds.memoryUsage) {
        await this.triggerAlert('HIGH_MEMORY_USAGE', {
          message: '記憶體使用量過高',
          severity: 'high',
          details: {
            memoryUsage: this.systemMetrics.performance.memoryUsage,
            threshold: this.config.alertThresholds.memoryUsage
          }
        })
      }

      // 檢查個別模組警報
      for (const [moduleName, result] of moduleResults) {
        if (result.health === HEALTH_STATES.UNHEALTHY) {
          await this.triggerAlert(`MODULE_UNHEALTHY_${moduleName.toUpperCase()}`, {
            message: `模組 ${moduleName} 健康狀態異常`,
            severity: 'high',
            details: { moduleName, health: result.health, moduleDetails: result.details }
          })
        }
      }
    } catch (error) {
      this.logger.error('❌ 檢查警報條件失敗:', error)
    }
  }

  /**
   * 觸發警報
   * @param {string} alertType - 警報類型
   * @param {Object} alertData - 警報資料
   * @returns {Promise<void>}
   * @private
   */
  async triggerAlert (alertType, alertData) {
    try {
      // 檢查警報是否被抑制
      if (this.alerts.suppressions.has(alertType)) {
        this.stats.alertsSuppressed++
        return
      }

      // 檢查是否為重複警報
      if (this.alerts.active.has(alertType)) {
        const existingAlert = this.alerts.active.get(alertType)
        existingAlert.count++
        existingAlert.lastTriggered = Date.now()
        return
      }

      // 建立新警報
      const alert = {
        type: alertType,
        ...alertData,
        triggeredAt: Date.now(),
        lastTriggered: Date.now(),
        count: 1,
        acknowledged: false
      }

      // 加入活動警報
      this.alerts.active.set(alertType, alert)

      // 加入警報歷史
      this.alerts.history.push({ ...alert })

      // 限制歷史大小
      if (this.alerts.history.length > 100) {
        this.alerts.history.shift()
      }

      this.stats.alertsTriggered++

      // 記錄警報
      this.logger.warn(`🚨 系統警報觸發: ${alertType} - ${alertData.message}`)

      // 觸發警報事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.ALERT.TRIGGERED', {
          alert,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error('❌ 觸發警報失敗:', error)
    }
  }

  /**
   * 處理模組狀態變更事件
   * @param {Object} data - 狀態變更資料
   * @returns {Promise<void>}
   * @private
   */
  async handleModuleStateChange (data) {
    const { moduleName, newState, oldState } = data

    if (this.monitoredModules.has(moduleName)) {
      const moduleInfo = this.monitoredModules.get(moduleName)
      moduleInfo.lastStateChange = {
        timestamp: Date.now(),
        newState,
        oldState
      }
    }
  }

  /**
   * 處理系統事件
   * @param {Object} data - 事件資料
   * @returns {Promise<void>}
   * @private
   */
  async handleSystemEvent (data) {
    // 系統錯誤可能影響整體健康狀態，觸發額外檢查
    setTimeout(async () => {
      await this.performHealthCheck()
    }, 1000)
  }

  /**
   * 處理效能指標
   * @param {Object} data - 效能資料
   * @returns {Promise<void>}
   * @private
   */
  async handlePerformanceMetric (data) {
    const { type, value, timestamp } = data

    switch (type) {
      case 'eventProcessingTime':
        this.systemMetrics.performance.eventProcessingTime.push({ value, timestamp })
        // 保留最近100個記錄
        if (this.systemMetrics.performance.eventProcessingTime.length > 100) {
          this.systemMetrics.performance.eventProcessingTime.shift()
        }
        break

      case 'messageProcessingTime':
        this.systemMetrics.performance.messageProcessingTime.push({ value, timestamp })
        if (this.systemMetrics.performance.messageProcessingTime.length > 100) {
          this.systemMetrics.performance.messageProcessingTime.shift()
        }
        break
    }
  }

  /**
   * 執行初始健康檢查
   * @returns {Promise<void>}
   * @private
   */
  async performInitialHealthCheck () {
    this.logger.log('🔍 執行初始系統健康檢查')
    await this.performHealthCheck()
  }

  /**
   * 載入歷史資料
   * @returns {Promise<void>}
   * @private
   */
  async loadHistoricalData () {
    try {
      const data = await chrome.storage.local.get(['system_monitor_data'])
      if (data.system_monitor_data) {
        const historicalData = data.system_monitor_data

        // 載入警報歷史
        if (historicalData.alertHistory) {
          this.alerts.history = historicalData.alertHistory.slice(-50) // 最近50個
        }

        // 載入系統指標
        if (historicalData.systemMetrics) {
          this.systemMetrics.restartCount = (historicalData.systemMetrics.restartCount || 0) + 1
        }

        this.logger.log('📚 載入了歷史監控資料')
      }
    } catch (error) {
      this.logger.error('❌ 載入歷史資料失敗:', error)
    }
  }

  /**
   * 保存歷史資料
   * @returns {Promise<void>}
   * @private
   */
  async saveHistoricalData () {
    try {
      const dataToSave = {
        alertHistory: this.alerts.history.slice(-50),
        systemMetrics: {
          restartCount: this.systemMetrics.restartCount,
          totalUptime: this.systemMetrics.totalUptime
        },
        timestamp: Date.now()
      }

      await chrome.storage.local.set({ system_monitor_data: dataToSave })
      this.logger.log('💾 系統監控資料已保存')
    } catch (error) {
      this.logger.error('❌ 保存歷史資料失敗:', error)
    }
  }

  /**
   * 獲取系統狀態報告
   * @returns {Object} 系統狀態報告
   */
  getSystemStatusReport () {
    const moduleStatuses = Array.from(this.monitoredModules.entries()).map(([name, info]) => ({
      name,
      health: info.currentHealth,
      lastHealthCheck: info.lastHealthCheck,
      registeredAt: info.registeredAt
    }))

    return {
      system: {
        startTime: this.systemMetrics.startTime,
        uptime: Date.now() - this.systemMetrics.startTime,
        restartCount: this.systemMetrics.restartCount,
        lastHealthCheck: this.systemMetrics.lastHealthCheck
      },
      modules: moduleStatuses,
      functionality: this.systemMetrics.functionality,
      performance: {
        memoryUsage: this.systemMetrics.performance.memoryUsage,
        avgEventProcessingTime: this.calculateAverageProcessingTime('eventProcessingTime'),
        avgMessageProcessingTime: this.calculateAverageProcessingTime('messageProcessingTime')
      },
      alerts: {
        active: Array.from(this.alerts.active.values()),
        totalTriggered: this.stats.alertsTriggered,
        totalSuppressed: this.stats.alertsSuppressed
      },
      stats: this.stats,
      timestamp: Date.now()
    }
  }

  /**
   * 計算平均處理時間
   * @param {string} metricType - 指標類型
   * @returns {number} 平均處理時間
   * @private
   */
  calculateAverageProcessingTime (metricType) {
    const metrics = this.systemMetrics.performance[metricType] || []
    if (metrics.length === 0) return 0

    const sum = metrics.reduce((total, metric) => total + metric.value, 0)
    return sum / metrics.length
  }

  /**
   * 確認警報
   * @param {string} alertType - 警報類型
   * @returns {boolean} 是否成功確認
   */
  acknowledgeAlert (alertType) {
    if (this.alerts.active.has(alertType)) {
      const alert = this.alerts.active.get(alertType)
      alert.acknowledged = true
      alert.acknowledgedAt = Date.now()

      this.logger.log(`✅ 警報已確認: ${alertType}`)
      return true
    }
    return false
  }

  /**
   * 抑制警報
   * @param {string} alertType - 警報類型
   * @param {number} duration - 抑制時長 (毫秒)
   * @returns {void}
   */
  suppressAlert (alertType, duration = 3600000) { // 預設1小時
    this.alerts.suppressions.set(alertType, {
      suppressedAt: Date.now(),
      duration,
      expiresAt: Date.now() + duration
    })

    // 設定自動解除抑制
    setTimeout(() => {
      this.alerts.suppressions.delete(alertType)
    }, duration)

    this.logger.log(`🔇 警報已抑制: ${alertType} (${duration}ms)`)
  }

  /**
   * 取得自訂健康狀態
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus () {
    const activeAlerts = this.alerts.active.size
    const criticalAlerts = Array.from(this.alerts.active.values())
      .filter(alert => alert.severity === 'critical').length

    const healthCheckFailureRate = this.stats.totalHealthChecks > 0
      ? this.stats.healthCheckFailures / this.stats.totalHealthChecks
      : 0

    return {
      totalModules: this.monitoredModules.size,
      healthyModules: this.systemMetrics.functionality.healthyModules,
      degradedModules: this.systemMetrics.functionality.degradedModules,
      unhealthyModules: this.systemMetrics.functionality.unhealthyModules,
      activeAlerts,
      criticalAlerts,
      uptime: Date.now() - this.systemMetrics.startTime,
      healthCheckFailureRate: healthCheckFailureRate.toFixed(3),
      memoryUsage: this.systemMetrics.performance.memoryUsage,
      health: (criticalAlerts > 0 || healthCheckFailureRate > 0.1) ? 'degraded' : 'healthy'
    }
  }
}

module.exports = SystemMonitor
