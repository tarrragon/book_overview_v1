/**
 * 配置管理服務
 *
 * 負責功能：
 * - 系統配置的載入、保存和驗證
 * - 配置變更的監聽和通知
 * - 配置更新請求的處理和應用
 * - 配置驗證器的管理和執行
 *
 * 設計考量：
 * - 配置的版本控制和向後相容
 * - 配置變更的原子性操作
 * - 配置驗證的可擴展架構
 * - 配置監聽器的生命週期管理
 *
 * 使用情境：
 * - 系統配置的統一管理
 * - 動態配置更新和熱重載
 * - 配置驗證和錯誤處理
 */

const {
  SYSTEM_EVENTS,
  STORAGE_KEYS,
  DEFAULT_CONFIG,
  EVENT_PRIORITIES
} = require('src/background/constants/module-constants')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

/**
 * Logger 後備方案設計理念：
 * - 配置管理服務需要記錄所有配置變更和驗證過程
 * - 在 Chrome Extension Service Worker 環境中，console 物件提供基本的日誌輸出能力
 * - 當專用 Logger 不可用時，console 後備方案確保：
 *   1. 配置載入、保存和驗證過程的詳細記錄
 *   2. 配置變更監聽器和通知機制的狀態追蹤
 *   3. Chrome Storage API 操作和配置同步的執行記錄
 *   4. 配置驗證失敗和回滾操作的重要事件記錄
 * - 此後備機制對系統配置穩定性和故障恢復至關重要
 */

class ConfigManagementService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false
    }

    // 配置管理
    this.currentConfig = { ...DEFAULT_CONFIG }
    this.configHistory = []
    this.pendingUpdates = new Map()

    // 配置監聽器和驗證器
    this.configurationWatchers = new Map()
    this.configurationValidators = new Map()
    this.registeredListeners = new Map()

    // 統計資料
    this.stats = {
      configUpdates: 0,
      validationAttempts: 0,
      validationFailures: 0,
      watcherNotifications: 0
    }

    // 初始化預設驗證器
    this.initializeDefaultValidators()
  }

  /**
   * 初始化配置管理服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('[WARN] 配置管理服務已初始化')
      return
    }

    try {
      this.logger.log('初始化配置管理服務')

      // 載入當前配置
      await this.loadConfiguration()

      // 註冊事件監聽器
      await this.registerEventListeners()

      this.state.initialized = true
      this.logger.log('[OK] 配置管理服務初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.CONFIG.INITIALIZED', {
          serviceName: 'ConfigManagementService',
          configKeys: Object.keys(this.currentConfig)
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 初始化配置管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動配置管理服務
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
      this.logger.warn('[WARN] 配置管理服務已啟動')
      return
    }

    try {
      this.logger.log('[START] 啟動配置管理服務')

      // 驗證當前配置
      await this.validateCurrentConfiguration()

      this.state.active = true
      this.logger.log('[OK] 配置管理服務啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.CONFIG.STARTED', {
          serviceName: 'ConfigManagementService',
          activeConfig: this.getSafeConfigSummary()
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 啟動配置管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止配置管理服務
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('[WARN] 配置管理服務未啟動')
      return
    }

    try {
      this.logger.log('[STOP] 停止配置管理服務')

      // 保存當前配置
      await this.saveConfiguration()

      // 清理待處理的更新
      this.pendingUpdates.clear()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      this.state.active = false
      this.logger.log('[OK] 配置管理服務停止完成')

      // 發送停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.CONFIG.STOPPED', {
          serviceName: 'ConfigManagementService'
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 停止配置管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 載入配置
   */
  async loadConfiguration () {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get([STORAGE_KEYS.SYSTEM_CONFIG])

        if (result[STORAGE_KEYS.SYSTEM_CONFIG]) {
          // 合併預設配置和儲存的配置
          this.currentConfig = { ...DEFAULT_CONFIG, ...result[STORAGE_KEYS.SYSTEM_CONFIG] }
          this.logger.log('[OK] 配置載入完成')
        } else {
          this.logger.log('[LOG] 使用預設配置')
          await this.saveConfiguration() // 保存預設配置
        }
      } else {
        this.logger.warn('[WARN] Chrome storage API 不可用，使用預設配置')
      }
    } catch (error) {
      this.logger.error('[FAIL] 載入配置失敗:', error)
      this.currentConfig = { ...DEFAULT_CONFIG }
    }
  }

  /**
   * 保存配置
   */
  async saveConfiguration () {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          [STORAGE_KEYS.SYSTEM_CONFIG]: this.currentConfig
        })
        this.logger.log('[OK] 配置保存完成')
      } else {
        this.logger.warn('[WARN] Chrome storage API 不可用，無法保存配置')
      }
    } catch (error) {
      this.logger.error('[FAIL] 保存配置失敗:', error)
      throw error
    }
  }

  /**
   * 初始化預設驗證器
   */
  initializeDefaultValidators () {
    // 基本類型驗證器
    this.configurationValidators.set('type_boolean', (value) => {
      return typeof value === 'boolean'
    })

    this.configurationValidators.set('type_string', (value) => {
      return typeof value === 'string'
    })

    this.configurationValidators.set('type_number', (value) => {
      return typeof value === 'number' && !isNaN(value)
    })

    // 範圍驗證器
    this.configurationValidators.set('positive_number', (value) => {
      return typeof value === 'number' && value > 0
    })

    // 字串長度驗證器
    this.configurationValidators.set('non_empty_string', (value) => {
      return typeof value === 'string' && value.trim().length > 0
    })
  }

  /**
   * 驗證當前配置
   */
  async validateCurrentConfiguration () {
    this.stats.validationAttempts++

    try {
      const validation = await this.validateConfiguration(this.currentConfig)

      if (!validation.isValid) {
        this.stats.validationFailures++
        this.logger.warn('[WARN] 當前配置驗證失敗:', validation.errors)

        // 嘗試恢復到預設配置
        this.currentConfig = { ...DEFAULT_CONFIG }
        await this.saveConfiguration()
        this.logger.log('已恢復到預設配置')
      }

      return validation
    } catch (error) {
      this.stats.validationFailures++
      this.logger.error('[FAIL] 配置驗證失敗:', error)
      throw error
    }
  }

  /**
   * 驗證配置
   */
  async validateConfiguration (config) {
    const errors = []
    const warnings = []

    // 檢查必要的配置項
    for (const key of Object.keys(DEFAULT_CONFIG)) {
      if (!(key in config)) {
        errors.push(`缺少必要配置項: ${key}`)
      }
    }

    // 執行註冊的驗證器
    for (const [key, value] of Object.entries(config)) {
      const validatorKey = `${key}_validator`
      if (this.configurationValidators.has(validatorKey)) {
        const validator = this.configurationValidators.get(validatorKey)
        try {
          const isValid = await validator(value)
          if (!isValid) {
            errors.push(`配置項 ${key} 驗證失敗`)
          }
        } catch (error) {
          warnings.push(`配置項 ${key} 驗證器執行失敗: ${error.message}`)
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 應用配置更新
   */
  async applyConfigurationUpdates (updates) {
    this.stats.configUpdates++

    try {
      // 創建更新後的配置
      const newConfig = { ...this.currentConfig, ...updates }

      // 驗證新配置
      const validation = await this.validateConfiguration(newConfig)

      if (!validation.isValid) {
        const error = new Error(`配置驗證失敗: ${validation.errors.join(', ')}`)
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = {
          category: 'validation'
        }
        throw error
      }

      // 保存舊配置到歷史
      this.configHistory.push({
        config: { ...this.currentConfig },
        timestamp: Date.now(),
        reason: 'update'
      })

      // 限制歷史記錄數量
      if (this.configHistory.length > 10) {
        this.configHistory.shift()
      }

      // 應用新配置
      const oldConfig = { ...this.currentConfig }
      this.currentConfig = newConfig

      // 保存到儲存
      await this.saveConfiguration()

      // 通知監聽器
      await this.notifyConfigurationWatchers(oldConfig, newConfig, updates)

      this.logger.log('[OK] 配置更新完成')

      // 發送配置更新事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.CONFIG.UPDATED', {
          updates,
          previousConfig: oldConfig,
          currentConfig: this.getSafeConfigSummary()
        })
      }

      return { success: true, warnings: validation.warnings }
    } catch (error) {
      this.logger.error('[FAIL] 應用配置更新失敗:', error)
      throw error
    }
  }

  /**
   * 通知配置監聽器
   */
  async notifyConfigurationWatchers (oldConfig, newConfig, updates) {
    for (const [watcherKey, watcher] of this.configurationWatchers) {
      try {
        this.stats.watcherNotifications++
        await watcher(oldConfig, newConfig, updates)
      } catch (error) {
        this.logger.error(`[FAIL] 配置監聽器通知失敗 (${watcherKey}):`, error)
      }
    }
  }

  /**
   * 註冊配置監聽器
   */
  registerConfigurationWatcher (key, watcher) {
    if (typeof watcher !== 'function') {
      const error = new Error('配置監聽器必須是函數')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'general'
      }
      throw error
    }

    this.configurationWatchers.set(key, watcher)
    this.logger.log(`[OK] 註冊配置監聽器: ${key}`)
  }

  /**
   * 取消註冊配置監聽器
   */
  unregisterConfigurationWatcher (key) {
    const removed = this.configurationWatchers.delete(key)
    if (removed) {
      this.logger.log(`[OK] 取消註冊配置監聽器: ${key}`)
    }
    return removed
  }

  /**
   * 註冊配置驗證器
   */
  registerConfigurationValidator (key, validator) {
    if (typeof validator !== 'function') {
      const error = new Error('配置驗證器必須是函數')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'general'
      }
      throw error
    }

    this.configurationValidators.set(key, validator)
    this.logger.log(`[OK] 註冊配置驗證器: ${key}`)
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
        event: SYSTEM_EVENTS.CONFIG_UPDATE_REQUEST,
        handler: this.handleConfigurationUpdateRequest.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      },
      {
        event: SYSTEM_EVENTS.CONFIG_RELOAD_REQUEST,
        handler: this.handleConfigurationReloadRequest.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
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
   * 處理配置更新請求
   */
  async handleConfigurationUpdateRequest (event) {
    try {
      const { updates } = event.data || {}
      if (!updates || typeof updates !== 'object') {
        const error = new Error('無效的配置更新數據')
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = {
          category: 'general'
        }
        throw error
      }

      await this.applyConfigurationUpdates(updates)
    } catch (error) {
      this.logger.error('[FAIL] 處理配置更新請求失敗:', error)

      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.CONFIG.UPDATE_FAILED', {
          error: error.message,
          timestamp: Date.now()
        })
      }
    }
  }

  /**
   * 處理配置重載請求
   */
  async handleConfigurationReloadRequest (event) {
    try {
      await this.loadConfiguration()
      await this.validateCurrentConfiguration()

      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.CONFIG.RELOADED', {
          config: this.getSafeConfigSummary(),
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 處理配置重載請求失敗:', error)
    }
  }

  /**
   * 獲取當前配置
   */
  getCurrentConfiguration () {
    return { ...this.currentConfig }
  }

  /**
   * 獲取安全的配置摘要（隱藏敏感資訊）
   */
  getSafeConfigSummary () {
    const summary = {}
    for (const [key, value] of Object.entries(this.currentConfig)) {
      // 隱藏可能的敏感配置
      if (key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('token')) {
        summary[key] = '[隱藏]'
      } else {
        summary[key] = value
      }
    }
    return summary
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      configKeys: Object.keys(this.currentConfig),
      watchersCount: this.configurationWatchers.size,
      validatorsCount: this.configurationValidators.size,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const isHealthy = this.state.initialized &&
                     Object.keys(this.currentConfig).length > 0 &&
                     this.stats.validationFailures < this.stats.validationAttempts

    return {
      service: 'ConfigManagementService',
      healthy: isHealthy,
      status: this.state.active ? 'active' : 'inactive',
      metrics: {
        configUpdates: this.stats.configUpdates,
        validationAttempts: this.stats.validationAttempts,
        validationFailures: this.stats.validationFailures,
        watcherNotifications: this.stats.watcherNotifications
      }
    }
  }
}

module.exports = ConfigManagementService
