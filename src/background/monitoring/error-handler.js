/**
 * 錯誤處理器
 *
 * 負責功能：
 * - 整合錯誤收集和系統監控功能
 * - 提供統一的錯誤處理和監控介面
 * - 實現錯誤的智能分析和自動處理機制
 * - 協調錯誤處理流程和系統恢復策略
 *
 * 設計考量：
 * - 基於 BaseModule 實現標準生命週期管理
 * - 整合 ErrorCollector 和 SystemMonitor 模組
 * - 實現錯誤處理的高層抽象和統一管理
 * - 提供錯誤處理的策略模式和可擴展性
 */

const BaseModule = require('../lifecycle/base-module')
const ErrorCollector = require('./error-collector')
const SystemMonitor = require('./system-monitor')
const {
  SYSTEM_EVENTS,
  EVENT_PRIORITIES,
  HEALTH_STATES
} = require('../constants/module-constants')

class ErrorHandler extends BaseModule {
  constructor (dependencies = {}) {
    super(dependencies)

    // 子模組
    this.errorCollector = new ErrorCollector({
      eventBus: this.eventBus,
      logger: this.logger,
      i18nManager: dependencies.i18nManager
    })

    this.systemMonitor = new SystemMonitor({
      eventBus: this.eventBus,
      logger: this.logger,
      i18nManager: dependencies.i18nManager
    })

    // 錯誤處理策略
    this.errorHandlingStrategies = new Map()
    this.recoveryStrategies = new Map()

    // 處理狀態
    this.processingActive = false
    this.lastProcessingTime = null
    this.processingQueue = []

    // 統計資料
    this.handlingStats = {
      errorsProcessed: 0,
      strategiesExecuted: 0,
      recoveryAttempts: 0,
      successfulRecoveries: 0,
      criticalErrors: 0
    }

    // 配置設定
    this.config = {
      enableAutoRecovery: true,
      maxRecoveryAttempts: 3,
      recoveryDelay: 5000, // 5秒
      criticalErrorThreshold: 5,
      processingBatchSize: 10
    }

    // 多語言支援
    this.i18nManager = dependencies.i18nManager || null
  }

  /**
   * 初始化錯誤處理器
   * @returns {Promise<void>}
   * @protected
   */
  async _doInitialize () {
    if (this.i18nManager) {
      this.logger.log(this.i18nManager.t('modules.operations.initialize', { moduleName: this.moduleName }))
    } else {
      this.logger.log('🛠️ 初始化錯誤處理器')
    }

    // 初始化子模組
    await this.initializeSubModules()

    // 初始化處理策略
    await this.initializeHandlingStrategies()

    // 初始化恢復策略
    await this.initializeRecoveryStrategies()

    this.logger.log('✅ 錯誤處理器初始化完成')
  }

  /**
   * 啟動錯誤處理器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStart () {
    this.logger.log('▶️ 啟動錯誤處理器')

    // 啟動子模組
    await this.startSubModules()

    // 註冊事件監聽器
    await this.registerEventListeners()

    // 開始處理
    this.processingActive = true

    this.logger.log('✅ 錯誤處理器啟動完成')
  }

  /**
   * 停止錯誤處理器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStop () {
    this.logger.log('⏹️ 停止錯誤處理器')

    // 停止處理
    this.processingActive = false

    // 處理剩餘的錯誤
    await this.processRemainingErrors()

    // 取消註冊事件監聽器
    await this.unregisterEventListeners()

    // 停止子模組
    await this.stopSubModules()

    this.logger.log('✅ 錯誤處理器停止完成')
  }

  /**
   * 初始化子模組
   * @returns {Promise<void>}
   * @private
   */
  async initializeSubModules () {
    try {
      this.logger.log('🔧 初始化錯誤處理子模組')

      // 初始化錯誤收集器
      await this.errorCollector.initialize()

      // 初始化系統監控器
      await this.systemMonitor.initialize()

      // 註冊所有子模組到系統監控器
      this.systemMonitor.registerModule('errorCollector', this.errorCollector)
      this.systemMonitor.registerModule('systemMonitor', this.systemMonitor)

      this.logger.log('✅ 錯誤處理子模組初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化子模組失敗:', error)
      throw error
    }
  }

  /**
   * 啟動子模組
   * @returns {Promise<void>}
   * @private
   */
  async startSubModules () {
    try {
      this.logger.log('▶️ 啟動錯誤處理子模組')

      // 啟動錯誤收集器
      await this.errorCollector.start()

      // 啟動系統監控器
      await this.systemMonitor.start()

      this.logger.log('✅ 錯誤處理子模組啟動完成')
    } catch (error) {
      this.logger.error('❌ 啟動子模組失敗:', error)
      throw error
    }
  }

  /**
   * 停止子模組
   * @returns {Promise<void>}
   * @private
   */
  async stopSubModules () {
    try {
      this.logger.log('⏹️ 停止錯誤處理子模組')

      // 停止系統監控器
      await this.systemMonitor.stop()

      // 停止錯誤收集器
      await this.errorCollector.stop()

      this.logger.log('✅ 錯誤處理子模組停止完成')
    } catch (error) {
      this.logger.error('❌ 停止子模組失敗:', error)
    }
  }

  /**
   * 初始化處理策略
   * @returns {Promise<void>}
   * @private
   */
  async initializeHandlingStrategies () {
    try {
      // 系統錯誤處理策略
      this.errorHandlingStrategies.set('system', async (errorInfo) => {
        this.logger.error('🚨 系統錯誤處理:', errorInfo.message)

        // 觸發系統錯誤事件
        if (this.eventBus) {
          await this.eventBus.emit(SYSTEM_EVENTS.ERROR, {
            message: errorInfo.message,
            error: errorInfo.error,
            severity: errorInfo.severity,
            timestamp: Date.now()
          })
        }

        // 如果是嚴重錯誤，觸發恢復機制
        if (errorInfo.severity === 'critical') {
          await this.triggerRecoveryStrategy('system', errorInfo)
        }
      })

      // 模組錯誤處理策略
      this.errorHandlingStrategies.set('module', async (errorInfo) => {
        this.logger.warn('⚠️ 模組錯誤處理:', errorInfo.message)

        // 通知系統監控器
        if (this.eventBus) {
          await this.eventBus.emit('MODULE.ERROR', {
            moduleName: errorInfo.context?.moduleName,
            message: errorInfo.message,
            error: errorInfo.error,
            timestamp: Date.now()
          })
        }

        // 嘗試模組恢復
        if (errorInfo.context?.moduleName) {
          await this.triggerRecoveryStrategy('module', errorInfo)
        }
      })

      // Content Script 錯誤處理策略
      this.errorHandlingStrategies.set('content', async (errorInfo) => {
        this.logger.warn('📄 Content Script 錯誤處理:', errorInfo.message)

        // 觸發 Content Script 重新連接
        if (errorInfo.context?.tabId) {
          await this.triggerRecoveryStrategy('content', errorInfo)
        }
      })

      // 網路錯誤處理策略
      this.errorHandlingStrategies.set('network', async (errorInfo) => {
        this.logger.warn('🌐 網路錯誤處理:', errorInfo.message)

        // 實現重試機制
        await this.triggerRecoveryStrategy('network', errorInfo)
      })

      this.logger.log('🔧 錯誤處理策略初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化處理策略失敗:', error)
    }
  }

  /**
   * 初始化恢復策略
   * @returns {Promise<void>}
   * @private
   */
  async initializeRecoveryStrategies () {
    try {
      // 系統恢復策略
      this.recoveryStrategies.set('system', async (errorInfo) => {
        this.logger.log('🔄 執行系統恢復策略')

        try {
          // 系統狀態檢查
          const systemStatus = this.systemMonitor.getSystemStatusReport()

          // 如果有太多不健康的模組，嘗試重啟它們
          if (systemStatus.functionality?.unhealthyModules > 2) {
            this.logger.log('🔄 檢測到多個不健康模組，嘗試恢復')
            // 這裡可以實現模組重啟邏輯
          }

          return { success: true, action: 'system_recovery_attempted' }
        } catch (error) {
          this.logger.error('❌ 系統恢復失敗:', error)
          return { success: false, error: error.message }
        }
      })

      // 模組恢復策略
      this.recoveryStrategies.set('module', async (errorInfo) => {
        const moduleName = errorInfo.context?.moduleName
        this.logger.log(`🔄 執行模組恢復策略: ${moduleName}`)

        try {
          // 嘗試重新初始化模組
          if (this.eventBus) {
            await this.eventBus.emit('MODULE.RECOVERY.REQUESTED', {
              moduleName,
              errorInfo,
              timestamp: Date.now()
            })
          }

          return { success: true, action: 'module_recovery_requested' }
        } catch (error) {
          this.logger.error(`❌ 模組恢復失敗: ${moduleName}`, error)
          return { success: false, error: error.message }
        }
      })

      // Content Script 恢復策略
      this.recoveryStrategies.set('content', async (errorInfo) => {
        const tabId = errorInfo.context?.tabId
        this.logger.log(`🔄 執行 Content Script 恢復策略: Tab ${tabId}`)

        try {
          // 觸發 Content Script 重新連接
          if (this.eventBus) {
            await this.eventBus.emit('CONTENT.SCRIPT.RECOVERY.REQUESTED', {
              tabId,
              errorInfo,
              timestamp: Date.now()
            })
          }

          return { success: true, action: 'content_script_recovery_requested' }
        } catch (error) {
          this.logger.error(`❌ Content Script 恢復失敗: Tab ${tabId}`, error)
          return { success: false, error: error.message }
        }
      })

      // 網路恢復策略
      this.recoveryStrategies.set('network', async (errorInfo) => {
        this.logger.log('🔄 執行網路恢復策略')

        try {
          // 實現網路重試邏輯
          const retryCount = errorInfo.context?.retryCount || 0
          if (retryCount < this.config.maxRecoveryAttempts) {
            // 延遲重試
            await new Promise(resolve => setTimeout(resolve, this.config.recoveryDelay))

            if (this.eventBus) {
              await this.eventBus.emit('NETWORK.RETRY.REQUESTED', {
                originalRequest: errorInfo.context?.originalRequest,
                retryCount: retryCount + 1,
                timestamp: Date.now()
              })
            }

            return { success: true, action: 'network_retry_scheduled' }
          } else {
            return { success: false, reason: 'max_retries_exceeded' }
          }
        } catch (error) {
          this.logger.error('❌ 網路恢復失敗:', error)
          return { success: false, error: error.message }
        }
      })

      this.logger.log('🔧 恢復策略初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化恢復策略失敗:', error)
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
      // 錯誤收集事件
      this.errorCollectedListenerId = this.eventBus.on('ERROR.COLLECTED',
        (event) => this.handleErrorCollected(event.data),
        { priority: EVENT_PRIORITIES.HIGH }
      )

      // 錯誤模式檢測事件
      this.patternDetectedListenerId = this.eventBus.on('ERROR.PATTERN.DETECTED',
        (event) => this.handleErrorPatternDetected(event.data),
        { priority: EVENT_PRIORITIES.HIGH }
      )

      // 系統警報事件
      this.alertTriggeredListenerId = this.eventBus.on('SYSTEM.ALERT.TRIGGERED',
        (event) => this.handleSystemAlert(event.data),
        { priority: EVENT_PRIORITIES.URGENT }
      )

      this.logger.log('📝 錯誤處理事件監聽器註冊完成')
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
        { event: 'ERROR.COLLECTED', id: this.errorCollectedListenerId },
        { event: 'ERROR.PATTERN.DETECTED', id: this.patternDetectedListenerId },
        { event: 'SYSTEM.ALERT.TRIGGERED', id: this.alertTriggeredListenerId }
      ]

      for (const listener of listeners) {
        if (listener.id) {
          this.eventBus.off(listener.event, listener.id)
        }
      }

      this.logger.log('🔄 錯誤處理事件監聽器取消註冊完成')
    } catch (error) {
      this.logger.error('❌ 取消註冊事件監聽器失敗:', error)
    }
  }

  /**
   * 處理錯誤收集事件
   * @param {Object} data - 錯誤資料
   * @returns {Promise<void>}
   * @private
   */
  async handleErrorCollected (data) {
    try {
      const { errorId, category, severity, message } = data

      this.handlingStats.errorsProcessed++

      // 檢查嚴重程度
      if (severity === 'critical') {
        this.handlingStats.criticalErrors++

        // 如果嚴重錯誤超過閾值，觸發系統級處理
        if (this.handlingStats.criticalErrors >= this.config.criticalErrorThreshold) {
          await this.handleCriticalErrorThresholdExceeded()
        }
      }

      // 執行對應的處理策略
      const strategy = this.errorHandlingStrategies.get(category)
      if (strategy) {
        this.handlingStats.strategiesExecuted++
        await strategy({
          id: errorId,
          category,
          severity,
          message,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理錯誤收集事件失敗:', error)
    }
  }

  /**
   * 處理錯誤模式檢測事件
   * @param {Object} data - 模式資料
   * @returns {Promise<void>}
   * @private
   */
  async handleErrorPatternDetected (data) {
    try {
      const { pattern, category, occurrences } = data

      this.logger.warn(`🔍 檢測到錯誤模式: ${pattern} (${occurrences} 次)`)

      // 根據錯誤模式類型執行不同的處理策略
      if (category === 'content' && occurrences >= 10) {
        // Content Script 頻繁錯誤，可能需要暫停注入
        await this.triggerRecoveryStrategy('content_pattern', {
          pattern,
          occurrences,
          action: 'suspend_injection'
        })
      } else if (category === 'network' && occurrences >= 5) {
        // 網路錯誤模式，調整重試策略
        await this.triggerRecoveryStrategy('network_pattern', {
          pattern,
          occurrences,
          action: 'adjust_retry_strategy'
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理錯誤模式檢測事件失敗:', error)
    }
  }

  /**
   * 處理系統警報事件
   * @param {Object} data - 警報資料
   * @returns {Promise<void>}
   * @private
   */
  async handleSystemAlert (data) {
    try {
      const { alert } = data

      this.logger.warn(`🚨 系統警報: ${alert.type} - ${alert.message}`)

      // 根據警報類型執行不同的處理邏輯
      switch (alert.severity) {
        case 'critical':
          await this.handleCriticalAlert(alert)
          break
        case 'high':
          await this.handleHighSeverityAlert(alert)
          break
        case 'medium':
          await this.handleMediumSeverityAlert(alert)
          break
      }
    } catch (error) {
      this.logger.error('❌ 處理系統警報事件失敗:', error)
    }
  }

  /**
   * 處理嚴重警報
   * @param {Object} alert - 警報資料
   * @returns {Promise<void>}
   * @private
   */
  async handleCriticalAlert (alert) {
    this.logger.error(`🚨 處理嚴重警報: ${alert.type}`)

    // 立即觸發恢復策略
    if (alert.type === 'SYSTEM_UNHEALTHY') {
      await this.triggerRecoveryStrategy('system', {
        severity: 'critical',
        alert,
        context: { alertTriggered: true }
      })
    }
  }

  /**
   * 處理高嚴重度警報
   * @param {Object} alert - 警報資料
   * @returns {Promise<void>}
   * @private
   */
  async handleHighSeverityAlert (alert) {
    this.logger.warn(`⚠️ 處理高嚴重度警報: ${alert.type}`)

    // 延遲觸發恢復策略
    setTimeout(async () => {
      if (alert.type.startsWith('MODULE_UNHEALTHY_')) {
        const moduleName = alert.details?.moduleName
        await this.triggerRecoveryStrategy('module', {
          severity: 'high',
          alert,
          context: { moduleName, alertTriggered: true }
        })
      }
    }, this.config.recoveryDelay)
  }

  /**
   * 處理中等嚴重度警報
   * @param {Object} alert - 警報資料
   * @returns {Promise<void>}
   * @private
   */
  async handleMediumSeverityAlert (alert) {
    this.logger.log(`ℹ️ 處理中等嚴重度警報: ${alert.type}`)

    // 記錄警報，不立即採取行動
    // 可以在這裡實現更複雜的邏輯，如累積警報評估
  }

  /**
   * 處理嚴重錯誤閾值超出
   * @returns {Promise<void>}
   * @private
   */
  async handleCriticalErrorThresholdExceeded () {
    this.logger.error(`🚨 嚴重錯誤閾值超出: ${this.handlingStats.criticalErrors}/${this.config.criticalErrorThreshold}`)

    // 觸發系統級恢復
    await this.triggerRecoveryStrategy('system', {
      severity: 'critical',
      message: '嚴重錯誤閾值超出',
      context: {
        criticalErrorCount: this.handlingStats.criticalErrors,
        threshold: this.config.criticalErrorThreshold
      }
    })

    // 重設計數器
    this.handlingStats.criticalErrors = 0
  }

  /**
   * 觸發恢復策略
   * @param {string} strategyType - 策略類型
   * @param {Object} errorInfo - 錯誤資訊
   * @returns {Promise<Object>} 恢復結果
   * @private
   */
  async triggerRecoveryStrategy (strategyType, errorInfo) {
    if (!this.config.enableAutoRecovery) {
      this.logger.log('🔄 自動恢復已停用，跳過恢復策略')
      return { success: false, reason: 'auto_recovery_disabled' }
    }

    try {
      this.handlingStats.recoveryAttempts++

      const strategy = this.recoveryStrategies.get(strategyType)
      if (!strategy) {
        this.logger.warn(`⚠️ 找不到恢復策略: ${strategyType}`)
        return { success: false, reason: 'strategy_not_found' }
      }

      this.logger.log(`🔄 執行恢復策略: ${strategyType}`)

      const result = await strategy(errorInfo)

      if (result.success) {
        this.handlingStats.successfulRecoveries++
        this.logger.log(`✅ 恢復策略執行成功: ${strategyType}`)
      } else {
        this.logger.error(`❌ 恢復策略執行失敗: ${strategyType}`, result)
      }

      return result
    } catch (error) {
      this.logger.error(`❌ 執行恢復策略失敗: ${strategyType}`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 處理剩餘錯誤
   * @returns {Promise<void>}
   * @private
   */
  async processRemainingErrors () {
    if (this.processingQueue.length > 0) {
      this.logger.log(`🔄 處理剩餘的 ${this.processingQueue.length} 個錯誤`)

      // 批次處理剩餘錯誤
      while (this.processingQueue.length > 0) {
        const batch = this.processingQueue.splice(0, this.config.processingBatchSize)

        for (const errorInfo of batch) {
          await this.handleErrorCollected(errorInfo)
        }
      }
    }
  }

  /**
   * 註冊模組到系統監控器
   * @param {string} moduleName - 模組名稱
   * @param {Object} module - 模組實例
   * @returns {void}
   */
  registerModuleForMonitoring (moduleName, module) {
    this.systemMonitor.registerModule(moduleName, module)
  }

  /**
   * 收集錯誤
   * @param {Object} errorInfo - 錯誤資訊
   * @returns {Promise<string>} 錯誤 ID
   */
  async collectError (errorInfo) {
    return await this.errorCollector.collectError(errorInfo)
  }

  /**
   * 獲取錯誤統計
   * @returns {Object} 錯誤統計
   */
  getErrorStats () {
    return this.errorCollector.getErrorStats()
  }

  /**
   * 獲取系統狀態報告
   * @returns {Object} 系統狀態報告
   */
  getSystemStatusReport () {
    return this.systemMonitor.getSystemStatusReport()
  }

  /**
   * 獲取處理統計
   * @returns {Object} 處理統計
   */
  getHandlingStats () {
    return {
      ...this.handlingStats,
      processingActive: this.processingActive,
      lastProcessingTime: this.lastProcessingTime,
      queueSize: this.processingQueue.length,
      errorCollectorStats: this.errorCollector.getErrorStats(),
      systemMonitorStats: this.systemMonitor.getSystemStatusReport().stats
    }
  }

  /**
   * 生成綜合報告
   * @returns {Object} 綜合報告
   */
  generateComprehensiveReport () {
    return {
      errorHandling: this.getHandlingStats(),
      errorCollection: this.getErrorStats(),
      systemMonitoring: this.getSystemStatusReport(),
      timestamp: Date.now()
    }
  }

  /**
   * 取得自訂健康狀態
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus () {
    const errorCollectorHealth = this.errorCollector._getCustomHealthStatus()
    const systemMonitorHealth = this.systemMonitor._getCustomHealthStatus()

    const recoverySuccessRate = this.handlingStats.recoveryAttempts > 0
      ? this.handlingStats.successfulRecoveries / this.handlingStats.recoveryAttempts
      : 1

    return {
      processingActive: this.processingActive,
      errorsProcessed: this.handlingStats.errorsProcessed,
      criticalErrors: this.handlingStats.criticalErrors,
      recoveryAttempts: this.handlingStats.recoveryAttempts,
      recoverySuccessRate: recoverySuccessRate.toFixed(3),
      errorCollectorHealth: errorCollectorHealth.health,
      systemMonitorHealth: systemMonitorHealth.health,
      health: (errorCollectorHealth.health === 'degraded' ||
               systemMonitorHealth.health === 'degraded' ||
               recoverySuccessRate < 0.8)
        ? 'degraded'
        : 'healthy'
    }
  }
}

module.exports = ErrorHandler
