/**
 * 偏好設定服務
 *
 * 負責功能：
 * - 用戶偏好的持久化存儲和管理
 * - 偏好設定的跨平台同步
 * - 偏好變更的事件通知和協調
 * - 預設偏好的管理和重置
 *
 * 設計考量：
 * - 分層的偏好結構（全域/應用/模組）
 * - 偏好變更的即時同步
 * - 偏好驗證和類型安全
 * - 偏好變更歷史追蹤
 *
 * 處理流程：
 * 1. 載入預設和使用者偏好
 * 2. 驗證偏好值的有效性
 * 3. 持久化偏好變更
 * 4. 通知相關服務偏好更新
 *
 * 使用情境：
 * - 使用者設定的集中管理
 * - 主題偏好協調
 * - Popup 行為偏好
 * - 功能開關管理
 */

const { StandardError } = require('src/core/errors/StandardError')

class PreferenceService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.storageService = dependencies.storageService || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false,
      preferencesLoaded: false
    }

    // 偏好管理
    this.preferences = new Map()
    this.defaultPreferences = this.getDefaultPreferences()
    this.preferenceSchema = this.getPreferenceSchema()
    this.preferenceHistory = []
    this.preferenceSubscribers = new Map()

    // 偏好分類
    this.preferenceCategories = {
      theme: '主題與外觀',
      ui: '使用者介面',
      extraction: '資料提取',
      notification: '通知設定',
      accessibility: '無障礙功能',
      advanced: '進階設定'
    }

    // 偏好統計
    this.stats = {
      preferencesLoaded: 0,
      preferencesUpdated: 0,
      preferencesReset: 0,
      subscribersNotified: 0,
      validationErrors: 0
    }
  }

  /**
   * 初始化偏好設定服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('⚠️ 偏好設定服務已初始化')
      return
    }

    try {
      this.logger.log('🎯 初始化偏好設定服務')

      // 載入預設偏好
      await this.loadDefaultPreferences()

      // 載入使用者偏好
      await this.loadUserPreferences()

      // 驗證偏好完整性
      await this.validatePreferences()

      // 註冊事件監聽器
      await this.registerEventListeners()

      this.state.initialized = true
      this.state.preferencesLoaded = true
      this.stats.preferencesLoaded = this.preferences.size

      this.logger.log('✅ 偏好設定服務初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.PREFERENCE.SERVICE.INITIALIZED', {
          serviceName: 'PreferenceService',
          preferencesCount: this.preferences.size,
          categories: Object.keys(this.preferenceCategories)
        })
      }
    } catch (error) {
      this.logger.error('❌ 初始化偏好設定服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動偏好設定服務
   */
  async start () {
    if (!this.state.initialized) {
      throw new StandardError('UNKNOWN_ERROR', '偏好設定服務尚未初始化', {
        category: 'general'
      })
    }

    if (this.state.active) {
      this.logger.warn('⚠️ 偏好設定服務已啟動')
      return
    }

    try {
      this.logger.log('🚀 啟動偏好設定服務')

      // 執行偏好同步檢查
      await this.performPreferenceSync()

      this.state.active = true
      this.logger.log('✅ 偏好設定服務啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.PREFERENCE.SERVICE.STARTED', {
          serviceName: 'PreferenceService',
          ready: true
        })
      }
    } catch (error) {
      this.logger.error('❌ 啟動偏好設定服務失敗:', error)
      throw error
    }
  }

  /**
   * 設定偏好值
   */
  async setPreference (key, value) {
    this.logger.log(`⚙️ 設定偏好: ${key}`)

    try {
      // 驗證偏好鍵和值
      await this.validatePreference(key, value)

      // 獲取舊值
      const oldValue = this.preferences.get(key)

      // 統計偏好更新
      this.stats.preferencesUpdated++

      // 記錄偏好變更歷史
      this.preferenceHistory.push({
        key,
        oldValue,
        newValue: value,
        timestamp: Date.now(),
        source: 'user'
      })

      // 更新偏好值
      this.preferences.set(key, value)

      // 持久化偏好
      await this.persistPreference(key, value)

      // 通知訂閱者
      await this.notifyPreferenceSubscribers(key, value, oldValue)

      // 發送偏好更新事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.PREFERENCE.UPDATED', {
          key,
          oldValue,
          newValue: value,
          category: this.getPreferenceCategory(key),
          timestamp: Date.now()
        })
      }

      this.logger.log(`✅ 偏好設定完成: ${key}`)
      return { success: true, key, value, oldValue }
    } catch (error) {
      this.logger.error(`❌ 偏好設定失敗: ${key}`, error)
      throw error
    }
  }

  /**
   * 獲取偏好值
   */
  async getPreference (key, defaultValue = null) {
    try {
      // 如果偏好存在，返回值
      if (this.preferences.has(key)) {
        return this.preferences.get(key)
      }

      // 檢查預設偏好
      if (this.defaultPreferences.has(key)) {
        const defaultVal = this.defaultPreferences.get(key)

        // 如果沒有設定過，使用預設值並保存
        await this.setPreference(key, defaultVal)
        return defaultVal
      }

      // 返回提供的預設值或 null
      return defaultValue
    } catch (error) {
      this.logger.error(`❌ 獲取偏好失敗: ${key}`, error)
      return defaultValue
    }
  }

  /**
   * 獲取所有偏好
   */
  getPreferences (category = null) {
    const result = {}

    for (const [key, value] of this.preferences) {
      // 如果指定分類，只返回該分類的偏好
      if (category) {
        const prefCategory = this.getPreferenceCategory(key)
        if (prefCategory !== category) {
          continue
        }
      }

      result[key] = value
    }

    return result
  }

  /**
   * 重置偏好設定
   */
  async resetPreferences (category = null) {
    this.logger.log(`🔄 重置偏好設定${category ? ` (分類: ${category})` : ''}`)

    try {
      // 統計重置操作
      this.stats.preferencesReset++

      const resetKeys = []

      // 重置指定分類或所有偏好
      for (const [key, defaultValue] of this.defaultPreferences) {
        if (category) {
          const prefCategory = this.getPreferenceCategory(key)
          if (prefCategory !== category) {
            continue
          }
        }

        const oldValue = this.preferences.get(key)

        // 記錄重置歷史
        this.preferenceHistory.push({
          key,
          oldValue,
          newValue: defaultValue,
          timestamp: Date.now(),
          source: 'reset'
        })

        // 重置偏好值
        this.preferences.set(key, defaultValue)
        resetKeys.push(key)

        // 持久化重置值
        await this.persistPreference(key, defaultValue)

        // 通知訂閱者
        await this.notifyPreferenceSubscribers(key, defaultValue, oldValue)
      }

      // 發送偏好重置事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.PREFERENCE.RESET', {
          category,
          resetKeys,
          timestamp: Date.now()
        })
      }

      this.logger.log(`✅ 偏好設定重置完成 (${resetKeys.length} 項)`)
      return { success: true, resetCount: resetKeys.length, resetKeys }
    } catch (error) {
      this.logger.error('❌ 偏好設定重置失敗:', error)
      throw error
    }
  }

  /**
   * 訂閱偏好變更
   */
  subscribeToPreference (key, callback) {
    if (!this.preferenceSubscribers.has(key)) {
      this.preferenceSubscribers.set(key, new Set())
    }

    this.preferenceSubscribers.get(key).add(callback)
    this.logger.log(`📝 訂閱偏好變更: ${key}`)

    // 返回取消訂閱函數
    return () => {
      this.unsubscribeFromPreference(key, callback)
    }
  }

  /**
   * 取消訂閱偏好變更
   */
  unsubscribeFromPreference (key, callback) {
    const subscribers = this.preferenceSubscribers.get(key)
    if (subscribers) {
      subscribers.delete(callback)

      // 如果沒有訂閱者了，移除該鍵
      if (subscribers.size === 0) {
        this.preferenceSubscribers.delete(key)
      }
    }

    this.logger.log(`📝 取消訂閱偏好變更: ${key}`)
  }

  /**
   * 載入預設偏好
   */
  async loadDefaultPreferences () {
    for (const [key, value] of this.defaultPreferences) {
      this.preferences.set(key, value)
    }

    this.logger.log(`📖 載入了 ${this.defaultPreferences.size} 個預設偏好`)
  }

  /**
   * 載入使用者偏好
   */
  async loadUserPreferences () {
    try {
      if (this.storageService) {
        const userPreferences = await this.storageService.get('user.preferences') || {}

        for (const [key, value] of Object.entries(userPreferences)) {
          // 驗證並設定使用者偏好
          try {
            await this.validatePreference(key, value)
            this.preferences.set(key, value)
          } catch (error) {
            this.logger.warn(`⚠️ 忽略無效的使用者偏好: ${key}`, error)
          }
        }

        this.logger.log(`📖 載入了 ${Object.keys(userPreferences).length} 個使用者偏好`)
      }
    } catch (error) {
      this.logger.error('❌ 載入使用者偏好失敗:', error)
    }
  }

  /**
   * 驗證偏好設定
   */
  async validatePreferences () {
    let invalidCount = 0

    for (const [key, value] of this.preferences) {
      try {
        await this.validatePreference(key, value)
      } catch (error) {
        this.logger.warn(`⚠️ 偏好驗證失敗: ${key}`, error)
        invalidCount++

        // 重置為預設值
        if (this.defaultPreferences.has(key)) {
          this.preferences.set(key, this.defaultPreferences.get(key))
        } else {
          this.preferences.delete(key)
        }
      }
    }

    if (invalidCount > 0) {
      this.logger.warn(`⚠️ 修正了 ${invalidCount} 個無效偏好`)
    } else {
      this.logger.log('✅ 所有偏好驗證通過')
    }
  }

  /**
   * 驗證單個偏好
   */
  async validatePreference (key, value) {
    const schema = this.preferenceSchema.get(key)

    if (!schema) {
      throw new StandardError('UNKNOWN_ERROR', '未知的偏好鍵: ${key}', {
        category: 'general'
      })
    }

    // 類型驗證
    const actualType = typeof value
    if (schema.type && actualType !== schema.type) {
      throw new StandardError('UNKNOWN_ERROR', '偏好 ${key} 類型錯誤，期望 ${schema.type}，實際 ${actualType}', {
        category: 'general'
      })
    }

    // 值域驗證
    if (schema.enum && !schema.enum.includes(value)) {
      throw new StandardError('UNKNOWN_ERROR', `偏好 ${key} 值無效，可接受值: ${schema.enum.join(', ', {
          category: 'general'
      })}`)
    }

    // 範圍驗證
    if (schema.min !== undefined && value < schema.min) {
      throw new StandardError('UNKNOWN_ERROR', '偏好 ${key} 值太小，最小值: ${schema.min}', {
        category: 'general'
      })
    }

    if (schema.max !== undefined && value > schema.max) {
      throw new StandardError('UNKNOWN_ERROR', '偏好 ${key} 值太大，最大值: ${schema.max}', {
        category: 'general'
      })
    }

    // 自定義驗證
    if (schema.validator && typeof schema.validator === 'function') {
      const isValid = await schema.validator(value)
      if (!isValid) {
        throw new StandardError('UNKNOWN_ERROR', '偏好 ${key} 自定義驗證失敗', {
          category: 'general'
        })
      }
    }
  }

  /**
   * 持久化偏好
   */
  async persistPreference (key, value) {
    try {
      if (this.storageService) {
        // 獲取當前所有使用者偏好
        const userPreferences = await this.storageService.get('user.preferences') || {}

        // 更新特定偏好
        userPreferences[key] = value

        // 保存回存儲
        await this.storageService.set('user.preferences', userPreferences)

        this.logger.log(`💾 偏好已持久化: ${key}`)
      }
    } catch (error) {
      this.logger.error(`❌ 持久化偏好失敗: ${key}`, error)
    }
  }

  /**
   * 執行偏好同步
   */
  async performPreferenceSync () {
    this.logger.log('🔄 執行偏好同步檢查')

    // 檢查是否有需要同步的偏好變更
    // 這裡可以實現跨設備同步邏輯
    this.logger.log('✅ 偏好同步檢查完成')
  }

  /**
   * 通知偏好訂閱者
   */
  async notifyPreferenceSubscribers (key, newValue, oldValue) {
    const subscribers = this.preferenceSubscribers.get(key)

    if (subscribers && subscribers.size > 0) {
      this.logger.log(`📢 通知偏好訂閱者: ${key} (${subscribers.size} 個)`)

      for (const callback of subscribers) {
        try {
          await callback(key, newValue, oldValue)
          this.stats.subscribersNotified++
        } catch (error) {
          this.logger.error(`❌ 通知偏好訂閱者失敗: ${key}`, error)
        }
      }
    }
  }

  /**
   * 獲取偏好分類
   */
  getPreferenceCategory (key) {
    // 根據鍵前綴確定分類
    if (key.startsWith('theme.')) return 'theme'
    if (key.startsWith('ui.') || key.startsWith('popup.')) return 'ui'
    if (key.startsWith('extraction.')) return 'extraction'
    if (key.startsWith('notification.')) return 'notification'
    if (key.startsWith('accessibility.')) return 'accessibility'

    return 'advanced'
  }

  /**
   * 獲取預設偏好
   */
  getDefaultPreferences () {
    return new Map([
      // 主題與外觀
      ['theme.mode', 'auto'],
      ['theme.contrast', 'normal'],

      // 使用者介面
      ['ui.language', 'zh-TW'],
      ['ui.animation.enabled', true],
      ['ui.animation.duration', 300],

      // Popup 相關
      ['popup.autoClose', false],
      ['popup.autoCloseDelay', 3000],
      ['popup.showProgress', true],
      ['popup.showNotifications', true],

      // 資料提取
      ['extraction.showProgress', true],
      ['extraction.autoExtract', false],
      ['extraction.batchSize', 50],
      ['extraction.timeout', 30000],

      // 通知設定
      ['notification.enabled', true],
      ['notification.sound', false],
      ['notification.duration', 5000],
      ['notification.position', 'top-right'],

      // 無障礙功能
      ['accessibility.highContrast', false],
      ['accessibility.largeText', false],
      ['accessibility.screenReader', false],

      // 進階設定
      ['advanced.debug', false],
      ['advanced.performance.monitoring', true],
      ['advanced.cache.enabled', true],
      ['advanced.cache.maxSize', 100]
    ])
  }

  /**
   * 獲取偏好模式定義
   */
  getPreferenceSchema () {
    return new Map([
      // 主題與外觀
      ['theme.mode', { type: 'string', enum: ['light', 'dark', 'auto'] }],
      ['theme.contrast', { type: 'string', enum: ['normal', 'high'] }],

      // 使用者介面
      ['ui.language', { type: 'string', enum: ['zh-TW', 'en-US'] }],
      ['ui.animation.enabled', { type: 'boolean' }],
      ['ui.animation.duration', { type: 'number', min: 100, max: 1000 }],

      // Popup 相關
      ['popup.autoClose', { type: 'boolean' }],
      ['popup.autoCloseDelay', { type: 'number', min: 1000, max: 10000 }],
      ['popup.showProgress', { type: 'boolean' }],
      ['popup.showNotifications', { type: 'boolean' }],

      // 資料提取
      ['extraction.showProgress', { type: 'boolean' }],
      ['extraction.autoExtract', { type: 'boolean' }],
      ['extraction.batchSize', { type: 'number', min: 10, max: 200 }],
      ['extraction.timeout', { type: 'number', min: 5000, max: 120000 }],

      // 通知設定
      ['notification.enabled', { type: 'boolean' }],
      ['notification.sound', { type: 'boolean' }],
      ['notification.duration', { type: 'number', min: 1000, max: 15000 }],
      ['notification.position', {
        type: 'string',
        enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right']
      }],

      // 無障礙功能
      ['accessibility.highContrast', { type: 'boolean' }],
      ['accessibility.largeText', { type: 'boolean' }],
      ['accessibility.screenReader', { type: 'boolean' }],

      // 進階設定
      ['advanced.debug', { type: 'boolean' }],
      ['advanced.performance.monitoring', { type: 'boolean' }],
      ['advanced.cache.enabled', { type: 'boolean' }],
      ['advanced.cache.maxSize', { type: 'number', min: 10, max: 1000 }]
    ])
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners () {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 不可用，跳過偏好事件監聽器註冊')
      return
    }

    // 監聽偏好設定請求
    await this.eventBus.on('UX.PREFERENCE.SET.REQUEST', async (event) => {
      const { key, value } = event.data || {}
      if (key !== undefined && value !== undefined) {
        await this.setPreference(key, value)
      }
    })

    // 監聽偏好獲取請求
    await this.eventBus.on('UX.PREFERENCE.GET.REQUEST', async (event) => {
      const { key, requestId } = event.data || {}
      const value = await this.getPreference(key)

      if (this.eventBus) {
        await this.eventBus.emit('UX.PREFERENCE.GET.RESPONSE', {
          requestId,
          key,
          value
        })
      }
    })

    // 監聽偏好重置請求
    await this.eventBus.on('UX.PREFERENCE.RESET.REQUEST', async (event) => {
      const { category } = event.data || {}
      await this.resetPreferences(category)
    })

    this.logger.log('✅ 偏好事件監聽器註冊完成')
  }

  /**
   * 獲取偏好統計
   */
  getPreferenceStats () {
    return {
      ...this.stats,
      totalPreferences: this.preferences.size,
      categories: Object.keys(this.preferenceCategories).length,
      subscribers: this.preferenceSubscribers.size,
      historyCount: this.preferenceHistory.length
    }
  }

  /**
   * 獲取偏好歷史
   */
  getPreferenceHistory (limit = 20) {
    return this.preferenceHistory
      .slice(-limit)
      .map(entry => ({ ...entry }))
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      service: 'PreferenceService',
      initialized: this.state.initialized,
      active: this.state.active,
      preferencesLoaded: this.state.preferencesLoaded,
      preferencesCount: this.preferences.size,
      subscribersCount: this.preferenceSubscribers.size,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    return {
      service: 'PreferenceService',
      healthy: this.state.initialized && this.state.active && this.state.preferencesLoaded,
      status: this.state.active ? 'active' : 'inactive',
      preferencesLoaded: this.state.preferencesLoaded,
      metrics: {
        preferencesCount: this.preferences.size,
        categoriesCount: Object.keys(this.preferenceCategories).length,
        subscribersCount: this.preferenceSubscribers.size,
        historyCount: this.preferenceHistory.length,
        preferencesUpdated: this.stats.preferencesUpdated,
        subscribersNotified: this.stats.subscribersNotified,
        validationErrors: this.stats.validationErrors
      }
    }
  }
}

module.exports = PreferenceService
