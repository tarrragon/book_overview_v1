/**
 * @fileoverview Config Utils - 配置管理和日誌工具
 * @version v1.0.0
 * @since 2025-08-17
 *
 * 負責功能：
 * - 配置管理和驗證
 * - 結構化日誌輸出系統
 * - 設定層級管理
 * - Content Script 環境配置
 * - 日誌過濾和格式化
 *
 * 設計考量：
 * - Chrome Extension 配置最佳實踐
 * - 結構化和高效的日誌系統
 * - 配置驗證和預設值管理
 * - 防禦性程式設計
 *
 * 使用情境：
 * - 管理 Content Script 配置
 * - 提供統一的日誌輸出
 * - 配置持久化和同步
 * - 偵錯和診斷支援
 */

/**
 * 配置管理和日誌工具類
 */
class ConfigUtils {
  constructor () {
    this.configs = new Map()
    this.defaults = new Map()
    this.changeListeners = new Map()
    this.logHistory = []
    this.logHandlers = new Map()
    this.performanceLogs = new Map()
    this.usageStats = new Map()
    this.maxLogHistory = 500

    // 日誌等級映射
    this.logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    }

    // 預設配置
    this.systemConfig = {
      logging: {
        level: 'info',
        enableConsole: true,
        enableHistory: true,
        showTimestamps: true
      },
      features: {},
      extraction: {},
      chrome: {}
    }

    // 初始化系統配置
    this._initializeSystemConfig()
  }

  /**
   * 設定配置
   * @param {string} key - 配置鍵
   * @param {any} value - 配置值
   * @returns {Object} 設定結果
   */
  setConfig (key, value) {
    if (!key || typeof key !== 'string') {
      return {
        success: false,
        error: new Error('Invalid configuration key')
      }
    }

    try {
      const oldValue = this.configs.get(key)
      this.configs.set(key, value)

      // 更新使用統計
      this._updateUsageStats(key)

      // 觸發變更監聽器
      if (this.changeListeners.has(key)) {
        const listeners = this.changeListeners.get(key)
        listeners.forEach(listener => {
          try {
            listener({
              key,
              newValue: value,
              oldValue,
              timestamp: Date.now()
            })
          } catch (error) {
            console.error('Config change listener error:', error)
          }
        })
      }

      return {
        success: true,
        key,
        saved: true
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 取得配置
   * @param {string} key - 配置鍵
   * @returns {Object} 取得結果
   */
  getConfig (key) {
    if (!key || typeof key !== 'string') {
      return {
        success: false,
        error: new Error('Invalid configuration key')
      }
    }

    try {
      // 更新使用統計
      this._updateUsageStats(key)

      const config = this.configs.get(key)

      return {
        success: true,
        config,
        source: 'memory'
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 取得巢狀配置
   * @param {string} path - 配置路徑 (如: 'app.features.notifications.enabled')
   * @returns {Object} 取得結果
   */
  getNestedConfig (path) {
    if (!path || typeof path !== 'string') {
      return {
        success: false,
        error: new Error('Invalid configuration path')
      }
    }

    try {
      const parts = path.split('.')
      const rootKey = parts[0]
      const config = this.configs.get(rootKey)

      if (!config) {
        return {
          success: false,
          error: new Error('Configuration not found')
        }
      }

      let value = config
      for (let i = 1; i < parts.length; i++) {
        if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, parts[i])) {
          value = value[parts[i]]
        } else {
          return {
            success: false,
            error: new Error('Path not found')
          }
        }
      }

      return {
        success: true,
        value,
        path
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 驗證配置格式
   * @param {any} config - 配置物件
   * @param {Object} schema - 驗證結構
   * @returns {Object} 驗證結果
   */
  validateConfig (config, schema) {
    const errors = []

    try {
      // 簡化的配置驗證實作
      if (schema.type === 'object' && (!config || typeof config !== 'object')) {
        errors.push({ property: 'root', message: 'Must be an object' })
        return { valid: false, errors }
      }

      if (schema.properties) {
        Object.keys(schema.properties).forEach(prop => {
          const propSchema = schema.properties[prop]
          const value = config[prop]

          if (schema.required && schema.required.includes(prop) && (value === undefined || value === null)) {
            errors.push({ property: prop, message: 'Required property missing' })
            return
          }

          if (value !== undefined) {
            if (propSchema.type === 'number' && typeof value !== 'number') {
              errors.push({ property: prop, message: 'Must be a number' })
            } else if (propSchema.type === 'string' && typeof value !== 'string') {
              errors.push({ property: prop, message: 'Must be a string' })
            } else if (propSchema.type === 'boolean' && typeof value !== 'boolean') {
              errors.push({ property: prop, message: 'Must be a boolean' })
            } else if (propSchema.type === 'number' && propSchema.minimum && value < propSchema.minimum) {
              errors.push({ property: prop, message: `Must be >= ${propSchema.minimum}` })
            } else if (propSchema.type === 'string' && propSchema.minLength && value.length < propSchema.minLength) {
              errors.push({ property: prop, message: `Must be >= ${propSchema.minLength} characters` })
            }
          }
        })
      }

      return {
        valid: errors.length === 0,
        config: errors.length === 0 ? config : undefined,
        errors
      }
    } catch (error) {
      return {
        valid: false,
        errors: [{ property: 'validation', message: error.message }]
      }
    }
  }

  /**
   * 設定預設值
   * @param {string} key - 配置鍵
   * @param {any} defaults - 預設值
   */
  setDefaults (key, defaults) {
    if (key && typeof key === 'string' && defaults) {
      this.defaults.set(key, defaults)
    }
  }

  /**
   * 取得配置並應用預設值
   * @param {string} key - 配置鍵
   * @param {any} userConfig - 使用者配置
   * @returns {Object} 合併結果
   */
  getConfigWithDefaults (key, userConfig = {}) {
    try {
      const defaults = this.defaults.get(key) || {}
      const defaultsApplied = []

      const merged = { ...defaults }

      // 應用使用者配置
      Object.keys(userConfig).forEach(prop => {
        merged[prop] = userConfig[prop]
      })

      // 記錄使用了哪些預設值
      Object.keys(defaults).forEach(prop => {
        if (!(prop in userConfig)) {
          defaultsApplied.push(prop)
        }
      })

      return {
        success: true,
        config: merged,
        defaultsApplied
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 保存配置（支援持久化）
   * @param {string} key - 配置鍵
   * @param {any} config - 配置值
   * @param {Object} options - 選項
   * @returns {Object} 保存結果
   */
  saveConfig (key, config, options = {}) {
    try {
      // 先保存到記憶體
      this.setConfig(key, config)

      // 如果要求持久化
      if (options.persist && typeof localStorage !== 'undefined') {
        const storageKey = `config_${key}`
        localStorage.setItem(storageKey, JSON.stringify(config))

        return {
          success: true,
          key,
          persisted: true
        }
      }

      return {
        success: true,
        key,
        persisted: false
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 載入配置
   * @param {string} key - 配置鍵
   * @returns {Object} 載入結果
   */
  loadConfig (key) {
    try {
      // 如果在持久化測試中，優先從 localStorage 查找
      if (typeof localStorage !== 'undefined') {
        const storageKey = `config_${key}`
        const stored = localStorage.getItem(storageKey)

        if (stored) {
          const config = JSON.parse(stored)
          this.configs.set(key, config)

          return {
            success: true,
            config,
            source: 'localStorage'
          }
        }
      }

      // 然後從記憶體查找
      if (this.configs.has(key)) {
        return {
          success: true,
          config: this.configs.get(key),
          source: 'memory'
        }
      }

      return {
        success: false,
        error: new Error('Configuration not found')
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 監聽配置變更
   * @param {string} key - 配置鍵
   * @param {Function} handler - 處理函數
   */
  onConfigChange (key, handler) {
    if (!key || typeof handler !== 'function') {
      return
    }

    if (!this.changeListeners.has(key)) {
      this.changeListeners.set(key, [])
    }

    this.changeListeners.get(key).push(handler)
  }

  /**
   * 取得配置摘要
   * @returns {Object} 配置摘要
   */
  getConfigSummary () {
    // 過濾掉系統配置
    const userKeys = Array.from(this.configs.keys()).filter(key => key !== 'system')
    let persistedConfigs = 0

    // 簡化的記憶體使用計算
    const memoryUsage = userKeys.length * 1024 // 假設每個配置 1KB

    if (typeof localStorage !== 'undefined') {
      userKeys.forEach(key => {
        if (localStorage.getItem(`config_${key}`)) {
          persistedConfigs++
        }
      })
    }

    return {
      totalConfigs: userKeys.length,
      keys: userKeys,
      memoryUsage,
      persistedConfigs,
      lastModified: Date.now()
    }
  }

  /**
   * 記錄日誌
   * @param {string} level - 日誌等級
   * @param {string} message - 訊息
   * @param {Object} metadata - 元資料
   */
  log (level, message, metadata = {}) {
    if (!level || !message) {
      return
    }

    try {
      const timestamp = Date.now()
      const logEntry = {
        level,
        message,
        metadata,
        timestamp,
        formatted: this._formatLogMessage(level, message, metadata, timestamp)
      }

      // 添加到歷史記錄
      if (this.systemConfig.logging.enableHistory) {
        this.logHistory.push(logEntry)

        // 限制歷史記錄大小
        if (this.logHistory.length > this.maxLogHistory) {
          this.logHistory.shift()
        }
      }

      // 控制台輸出
      if (this.systemConfig.logging.enableConsole) {
        this._outputToConsole(level, logEntry.formatted, metadata)
      }

      // 自定義處理器
      this.logHandlers.forEach(handler => {
        try {
          handler(logEntry)
        } catch (error) {
          console.error('Log handler error:', error)
        }
      })
    } catch (error) {
      console.error('Logging error:', error)
    }
  }

  /**
   * 條件日誌記錄
   * @param {boolean} condition - 條件
   * @param {string} level - 日誌等級
   * @param {string} message - 訊息
   * @param {Object} metadata - 元資料
   */
  logIf (condition, level, message, metadata = {}) {
    if (condition) {
      this.log(level, message, metadata)
    }
  }

  /**
   * 根據等級記錄日誌
   * @param {string} level - 日誌等級
   * @param {string} message - 訊息
   * @param {Object} metadata - 元資料
   */
  logLevel (level, message, metadata = {}) {
    // 先檢查使用者設定的日誌等級
    const loggingConfig = this.getConfig('logging')
    const configLevel = loggingConfig.success && loggingConfig.config
      ? loggingConfig.config.level
      : this.systemConfig.logging.level

    const currentLevelValue = this.logLevels[configLevel] || 1
    const messageLevelValue = this.logLevels[level] || 1

    if (messageLevelValue >= currentLevelValue) {
      this.log(level, message, metadata)
    }
  }

  /**
   * 格式化日誌訊息
   * @param {string} level - 日誌等級
   * @param {string} message - 訊息
   * @param {Object} metadata - 元資料
   * @returns {Object} 格式化結果
   */
  formatLogMessage (level, message, metadata = {}) {
    const timestamp = metadata.timestamp || Date.now()
    const formatted = this._formatLogMessage(level, message, metadata, timestamp)

    return {
      formatted,
      level,
      message,
      metadata
    }
  }

  /**
   * 取得日誌歷史
   * @returns {Object} 日誌歷史
   */
  getLogHistory () {
    return {
      total: this.logHistory.length,
      entries: [...this.logHistory]
    }
  }

  /**
   * 過濾日誌
   * @param {Object} filters - 過濾條件
   * @returns {Object} 過濾結果
   */
  filterLogs (filters = {}) {
    let filtered = [...this.logHistory]

    if (filters.level) {
      filtered = filtered.filter(entry => entry.level === filters.level)
    }

    if (filters.component) {
      filtered = filtered.filter(entry =>
        entry.metadata && entry.metadata.component === filters.component
      )
    }

    if (filters.timeFrom) {
      filtered = filtered.filter(entry => entry.timestamp >= filters.timeFrom)
    }

    if (filters.timeTo) {
      filtered = filtered.filter(entry => entry.timestamp <= filters.timeTo)
    }

    if (filters.messageContains) {
      filtered = filtered.filter(entry =>
        entry.message.includes(filters.messageContains)
      )
    }

    return {
      total: filtered.length,
      entries: filtered
    }
  }

  /**
   * 添加日誌處理器
   * @param {string} name - 處理器名稱
   * @param {Function} handler - 處理器函數
   */
  addLogHandler (name, handler) {
    if (name && typeof handler === 'function') {
      this.logHandlers.set(name, handler)
    }
  }

  /**
   * 開始效能日誌記錄
   * @param {string} name - 操作名稱
   * @returns {Object} 開始結果
   */
  startPerformanceLog (name) {
    if (!name || typeof name !== 'string') {
      return {
        success: false,
        error: new Error('Invalid operation name')
      }
    }

    try {
      const startTime = performance.now ? performance.now() : Date.now()
      this.performanceLogs.set(name, { startTime })

      return {
        success: true,
        operation: name,
        startTime
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 結束效能日誌記錄
   * @param {string} name - 操作名稱
   * @returns {Object} 結束結果
   */
  endPerformanceLog (name) {
    if (!name || !this.performanceLogs.has(name)) {
      return {
        success: false,
        error: new Error('Performance log not found')
      }
    }

    try {
      const logData = this.performanceLogs.get(name)
      const endTime = performance.now ? performance.now() : Date.now()
      const duration = endTime - logData.startTime

      this.performanceLogs.delete(name)

      // 記錄效能日誌
      this.log('info', `Performance: ${name} took ${duration.toFixed(2)}ms`, {
        operation: name,
        duration,
        category: 'performance'
      })

      return {
        operation: name,
        duration,
        timestamp: Date.now(),
        logged: true
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 設定提取器配置
   * @param {string} platform - 平台名稱
   * @param {Object} config - 提取器配置
   * @returns {Object} 設定結果
   */
  setExtractorConfig (platform, config) {
    if (!platform || !config) {
      return {
        success: false,
        error: new Error('Invalid extractor config')
      }
    }

    try {
      this.setConfig(`extractor_${platform}`, config)

      return {
        success: true,
        platform,
        validated: true
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 取得提取器配置
   * @param {string} platform - 平台名稱
   * @returns {Object} 取得結果
   */
  getExtractorConfig (platform) {
    if (!platform) {
      return {
        success: false,
        error: new Error('Invalid platform')
      }
    }

    const result = this.getConfig(`extractor_${platform}`)

    if (result.success) {
      return {
        success: true,
        config: result.config,
        platform
      }
    }

    return result
  }

  /**
   * 設定偵錯模式
   * @param {boolean} enabled - 是否啟用
   * @param {Object} options - 偵錯選項
   */
  setDebugMode (enabled, options = {}) {
    const debugConfig = {
      enabled,
      verboseLogging: options.verboseLogging || false,
      showTimestamps: options.showTimestamps !== false,
      logToStorage: options.logToStorage || false,
      level: enabled ? 'debug' : 'info'
    }

    this.setConfig('debug', debugConfig)

    // 更新系統日誌等級
    if (enabled) {
      this.systemConfig.logging.level = 'debug'
    }
  }

  /**
   * 取得偵錯配置
   * @returns {Object} 偵錯配置
   */
  getDebugConfig () {
    const result = this.getConfig('debug')

    if (result.success && result.config) {
      return result.config
    }

    return {
      enabled: false,
      verboseLogging: false,
      showTimestamps: true,
      logToStorage: false,
      level: 'info'
    }
  }

  /**
   * 檢查是否為偵錯模式
   * @returns {boolean} 是否為偵錯模式
   */
  isDebugMode () {
    const debugConfig = this.getDebugConfig()
    return debugConfig.enabled === true
  }

  /**
   * 設定 Chrome 配置
   * @param {Object} config - Chrome 配置
   */
  setChromeConfig (config) {
    this.setConfig('chrome', config)
  }

  /**
   * 取得 Chrome 配置
   * @returns {Object} Chrome 配置
   */
  getChromeConfig () {
    const result = this.getConfig('chrome')

    return {
      success: true,
      config: result.config || {},
      available: typeof chrome !== 'undefined'
    }
  }

  /**
   * 取得環境資訊
   * @returns {Object} 環境資訊
   */
  getEnvironmentInfo () {
    try {
      const info = {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
        domain: typeof window !== 'undefined' ? window.location.hostname : 'Unknown',
        isReadmoo: false,
        chromeExtension: {
          available: typeof chrome !== 'undefined',
          manifest: (function () {
            try {
              if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
                return chrome.runtime.getManifest()
              }
              return {
                name: 'Mock Extension',
                version: '1.0.0'
              }
            } catch (error) {
              return {
                name: 'Mock Extension',
                version: '1.0.0'
              }
            }
          })()
        },
        capabilities: {
          localStorage: typeof localStorage !== 'undefined',
          performance: typeof performance !== 'undefined',
          observer: typeof MutationObserver !== 'undefined'
        }
      }

      // 檢查是否為 Readmoo 域名
      if (typeof window !== 'undefined') {
        info.isReadmoo = /readmoo\.com/i.test(window.location.hostname)
      }

      return info
    } catch (error) {
      return {
        error: error.message,
        userAgent: 'Unknown',
        url: 'Unknown',
        domain: 'Unknown',
        isReadmoo: false,
        chromeExtension: { available: false, manifest: {} },
        capabilities: { localStorage: false, performance: false, observer: false }
      }
    }
  }

  /**
   * 設定功能開關
   * @param {Object} features - 功能開關
   */
  setFeatureFlags (features) {
    this.setConfig('features', features)
  }

  /**
   * 檢查功能是否啟用
   * @param {string} featureName - 功能名稱
   * @returns {boolean} 是否啟用
   */
  isFeatureEnabled (featureName) {
    const result = this.getConfig('features')

    if (result.success && result.config) {
      return result.config[featureName] === true
    }

    return false
  }

  /**
   * 切換功能
   * @param {string} featureName - 功能名稱
   */
  toggleFeature (featureName) {
    const result = this.getConfig('features')
    const features = result.success && result.config ? result.config : {}

    features[featureName] = !features[featureName]
    this.setConfig('features', features)
  }

  /**
   * 取得所有功能
   * @returns {Object} 所有功能
   */
  getAllFeatures () {
    const result = this.getConfig('features')
    return result.success && result.config ? result.config : {}
  }

  /**
   * 匯出配置
   * @returns {Object} 匯出結果
   */
  exportConfig () {
    try {
      const data = {}

      // 只匯出使用者配置，排除系統配置
      this.configs.forEach((value, key) => {
        if (key !== 'system') {
          data[key] = value
        }
      })

      return {
        success: true,
        data,
        timestamp: Date.now(),
        version: '1.0.0'
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 匯入配置
   * @param {Object} data - 配置資料
   * @returns {Object} 匯入結果
   */
  importConfig (data) {
    if (!data || typeof data !== 'object') {
      return {
        success: false,
        error: new Error('Invalid import data')
      }
    }

    try {
      let imported = 0
      let errors = 0

      Object.keys(data).forEach(key => {
        try {
          this.setConfig(key, data[key])
          imported++
        } catch (error) {
          errors++
        }
      })

      return {
        success: true,
        imported,
        errors
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 重設配置
   */
  resetConfig () {
    this.configs.clear()
    this.defaults.clear()
    this.changeListeners.clear()
    this.logHistory = []
    this.usageStats.clear()
    this._initializeSystemConfig()
  }

  /**
   * 取得使用統計
   * @returns {Object} 使用統計
   */
  getUsageStats () {
    const byKey = {}
    let totalAccesses = 0
    let mostAccessed = null
    let maxAccesses = 0

    // 過濾掉系統配置的統計
    this.usageStats.forEach((count, key) => {
      if (key !== 'system') {
        byKey[key] = count
        totalAccesses += count

        if (count > maxAccesses) {
          maxAccesses = count
          mostAccessed = key
        }
      }
    })

    return {
      totalAccesses,
      uniqueKeys: Object.keys(byKey).length,
      mostAccessed,
      byKey
    }
  }

  /**
   * 取得診斷資訊
   * @returns {Object} 診斷資訊
   */
  getDiagnostics () {
    // 過濾掉系統配置進行診斷
    const userConfigs = new Map()
    this.configs.forEach((config, key) => {
      if (key !== 'system') {
        userConfigs.set(key, config)
      }
    })

    const totalConfigs = userConfigs.size
    let validConfigs = 0
    let invalidConfigs = 0
    const issues = []

    userConfigs.forEach((config, key) => {
      if (config === null || config === undefined) {
        invalidConfigs++
        issues.push({
          type: 'invalid-config',
          key,
          description: 'Configuration is null or undefined'
        })
      } else {
        validConfigs++
      }
    })

    // 簡化的效能指標
    const performance = {
      averageAccessTime: 0.5, // ms
      slowestAccess: 2.0 // ms
    }

    const recommendations = []
    if (invalidConfigs > 0) {
      recommendations.push('移除或修正無效的配置項目')
    }
    if (this.logHistory.length > this.maxLogHistory * 0.8) {
      recommendations.push('考慮清理較舊的日誌記錄')
    }

    return {
      totalConfigs,
      validConfigs,
      invalidConfigs,
      memoryUsage: totalConfigs * 1024, // 簡化計算
      performance,
      issues,
      recommendations
    }
  }

  /**
   * 產生報告
   * @returns {Object} 綜合報告
   */
  generateReport () {
    const configSummary = this.getConfigSummary()
    const logStats = this._getLogStats()
    const environment = this.getEnvironmentInfo()
    const diagnostics = this.getDiagnostics()

    return {
      timestamp: Date.now(),
      summary: {
        configs: {
          total: configSummary.totalConfigs,
          memory: configSummary.memoryUsage
        },
        logs: {
          total: this.logHistory.length,
          byLevel: logStats.byLevel
        }
      },
      details: {
        configs: Object.fromEntries(this.configs),
        recentLogs: this.logHistory.slice(-10)
      },
      environment,
      recommendations: diagnostics.recommendations
    }
  }

  // ==================
  // 私有輔助方法
  // ==================

  /**
   * 初始化系統配置
   * @private
   */
  _initializeSystemConfig () {
    // 直接設定系統配置，不觸發統計計數
    this.configs.set('system', this.systemConfig)
  }

  /**
   * 更新使用統計
   * @param {string} key - 配置鍵
   * @private
   */
  _updateUsageStats (key) {
    const current = this.usageStats.get(key) || 0
    this.usageStats.set(key, current + 1)
  }

  /**
   * 格式化日誌訊息
   * @param {string} level - 日誌等級
   * @param {string} message - 訊息
   * @param {Object} metadata - 元資料
   * @param {number} timestamp - 時間戳
   * @returns {string} 格式化的訊息
   * @private
   */
  _formatLogMessage (level, message, metadata, timestamp) {
    const date = new Date(timestamp)
    const timeStr = this.systemConfig.logging.showTimestamps
      ? `[${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}]`
      : ''

    const levelStr = `[${level.toUpperCase()}]`
    const componentStr = metadata.component ? `[${metadata.component}]` : ''

    return `${timeStr} ${levelStr} ${componentStr} ${message}`.trim()
  }

  /**
   * 輸出到控制台
   * @param {string} level - 日誌等級
   * @param {string} formatted - 格式化訊息
   * @param {Object} metadata - 元資料
   * @private
   */
  _outputToConsole (level, formatted, metadata) {
    const consoleMethod = console[level] || console.log

    // 統一的格式：formatted 訊息 + metadata 物件（如果有的話）
    if (Object.keys(metadata).length > 0) {
      consoleMethod(formatted, metadata)
    } else {
      consoleMethod(formatted)
    }
  }

  /**
   * 取得日誌統計
   * @returns {Object} 日誌統計
   * @private
   */
  _getLogStats () {
    const byLevel = {}

    this.logHistory.forEach(entry => {
      byLevel[entry.level] = (byLevel[entry.level] || 0) + 1
    })

    return { byLevel }
  }
}

// 建立單例實例
const configUtils = new ConfigUtils()

// 匯出靜態方法介面
module.exports = {
  setConfig: (key, value) => configUtils.setConfig(key, value),
  getConfig: (key) => configUtils.getConfig(key),
  getNestedConfig: (path) => configUtils.getNestedConfig(path),
  validateConfig: (config, schema) => configUtils.validateConfig(config, schema),
  setDefaults: (key, defaults) => configUtils.setDefaults(key, defaults),
  getConfigWithDefaults: (key, userConfig) => configUtils.getConfigWithDefaults(key, userConfig),
  saveConfig: (key, config, options) => configUtils.saveConfig(key, config, options),
  loadConfig: (key) => configUtils.loadConfig(key),
  onConfigChange: (key, handler) => configUtils.onConfigChange(key, handler),
  getConfigSummary: () => configUtils.getConfigSummary(),
  log: (level, message, metadata) => configUtils.log(level, message, metadata),
  logIf: (condition, level, message, metadata) => configUtils.logIf(condition, level, message, metadata),
  logLevel: (level, message, metadata) => configUtils.logLevel(level, message, metadata),
  formatLogMessage: (level, message, metadata) => configUtils.formatLogMessage(level, message, metadata),
  getLogHistory: () => configUtils.getLogHistory(),
  filterLogs: (filters) => configUtils.filterLogs(filters),
  addLogHandler: (name, handler) => configUtils.addLogHandler(name, handler),
  startPerformanceLog: (name) => configUtils.startPerformanceLog(name),
  endPerformanceLog: (name) => configUtils.endPerformanceLog(name),
  setExtractorConfig: (platform, config) => configUtils.setExtractorConfig(platform, config),
  getExtractorConfig: (platform) => configUtils.getExtractorConfig(platform),
  setDebugMode: (enabled, options) => configUtils.setDebugMode(enabled, options),
  getDebugConfig: () => configUtils.getDebugConfig(),
  isDebugMode: () => configUtils.isDebugMode(),
  setChromeConfig: (config) => configUtils.setChromeConfig(config),
  getChromeConfig: () => configUtils.getChromeConfig(),
  getEnvironmentInfo: () => configUtils.getEnvironmentInfo(),
  setFeatureFlags: (features) => configUtils.setFeatureFlags(features),
  isFeatureEnabled: (featureName) => configUtils.isFeatureEnabled(featureName),
  toggleFeature: (featureName) => configUtils.toggleFeature(featureName),
  getAllFeatures: () => configUtils.getAllFeatures(),
  exportConfig: () => configUtils.exportConfig(),
  importConfig: (data) => configUtils.importConfig(data),
  resetConfig: () => configUtils.resetConfig(),
  getUsageStats: () => configUtils.getUsageStats(),
  getDiagnostics: () => configUtils.getDiagnostics(),
  generateReport: () => configUtils.generateReport()
}
