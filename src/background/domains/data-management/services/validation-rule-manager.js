/**
 * @fileoverview Validation Rule Manager - 驗證規則管理服務
 * @version v0.9.21
 * @since 2025-08-21
 *
 * 從 DataValidationService 提取的驗證規則管理邏輯
 *
 * 負責功能：
 * - 平台驗證規則載入和管理
 * - 規則結構驗證和完整性檢查
 * - 規則快取和效能優化
 * - 動態規則更新和配置管理
 *
 * 設計原則：
 * - 單一職責：專注於驗證規則的管理和提供
 * - 支援多平台：為不同電子書平台提供特定驗證規則
 * - 事件驅動：與現有事件系統整合
 * - 效能優化：規則快取和懶加載機制
 */

const BaseModule = require('../../../lifecycle/base-module.js')
const { createLogger } = require('../../../../core/logging/Logger')

class ValidationRuleManager extends BaseModule {
  /**
   * 初始化驗證規則管理服務
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
    this.logger = dependencies.logger || createLogger('ValidationRuleManager')

    // 合併預設配置
    this.effectiveConfig = this.mergeWithDefaults(dependencies.config || {})

    // 驗證規則管理
    this.validationRules = new Map()
    this.supportedPlatforms = this.effectiveConfig.supportedPlatforms || [
      'READMOO', 'KINDLE', 'KOBO', 'BOOKWALKER', 'BOOKS_COM'
    ]

    // 統計和監控
    this.ruleStatistics = {
      loadedCount: 0,
      errorCount: 0,
      lastLoadTime: null
    }

    // 註冊事件監聽器
    this.registerEventListeners()
  }

  /**
   * 合併預設配置
   */
  mergeWithDefaults (userConfig) {
    const defaults = {
      enableRuleCache: true,
      ruleCacheTTL: 3600000, // 1小時
      supportedPlatforms: ['READMOO', 'KINDLE', 'KOBO', 'BOOKWALKER', 'BOOKS_COM']
    }

    return {
      ...defaults,
      ...userConfig
    }
  }

  /**
   * 載入平台特定驗證規則
   * @param {string} platform - 平台名稱
   * @returns {Object} 載入結果
   */
  async loadPlatformValidationRules (platform) {
    try {
      this.validatePlatformSupported(platform)
      const cachedResult = await this.getCachedRules(platform)
      if (cachedResult) return cachedResult
      return await this.loadAndCacheRules(platform)
    } catch (error) {
      await this.handleLoadError(platform, error)
      throw error
    }
  }

  /**
   * 獲取平台的驗證規則
   * @param {string} platform - 平台名稱
   * @returns {Object|null} 驗證規則或 null
   */
  getValidationRules (platform) {
    return this.validationRules.get(platform) || null
  }

  /**
   * 驗證規則結構完整性
   * @param {Object} rules - 規則物件
   * @returns {boolean} 是否有效
   */
  validateRuleStructure (rules) {
    if (!this.validateBasicStructure(rules)) return false
    if (!this.validateRequiredSections(rules)) return false
    if (!this.validateFieldTypes(rules)) return false
    return true
  }

  /**
   * 動態更新平台規則
   * @param {string} platform - 平台名稱
   * @param {Object} newRules - 新的規則物件
   * @returns {Object} 更新結果
   */
  async updatePlatformRules (platform, newRules) {
    try {
      if (!this.validateRuleStructure(newRules)) {
        throw new Error('Invalid rule structure')
      }

      this.validationRules.set(platform, newRules)

      await this.emitEvent('VALIDATION.RULES.UPDATED', {
        platform,
        timestamp: Date.now()
      })

      return { success: true, platform }
    } catch (error) {
      await this.log(`更新 ${platform} 規則失敗: ${error.message}`, 'error')
      throw error
    }
  }

  /**
   * 清除平台規則
   * @param {string} platform - 平台名稱
   * @returns {Object} 清除結果
   */
  clearPlatformRules (platform) {
    const existed = this.validationRules.has(platform)
    this.validationRules.delete(platform)

    return { success: true, existed }
  }

  /**
   * 清除所有規則
   */
  clearAllRules () {
    this.validationRules.clear()
    this.ruleStatistics.loadedCount = 0
  }

  /**
   * 獲取規則載入統計
   * @returns {Object} 統計資訊
   */
  getRuleStatistics () {
    return {
      loadedPlatforms: this.validationRules.size,
      supportedPlatforms: this.supportedPlatforms.length,
      loadedPlatformsList: Array.from(this.validationRules.keys()),
      errorCount: this.ruleStatistics.errorCount,
      lastLoadTime: this.ruleStatistics.lastLoadTime
    }
  }

  /**
   * 檢查服務健康狀態
   * @returns {Object} 健康狀態
   */
  isRuleManagerHealthy () {
    return {
      isHealthy: this.ruleStatistics.errorCount < 10,
      rulesLoaded: this.validationRules.size,
      errorCount: this.ruleStatistics.errorCount,
      lastCheck: Date.now()
    }
  }

  /**
   * 為特定平台載入驗證規則（內部實作）
   * @param {string} platform - 平台名稱
   * @returns {Object} 規則物件
   */
  async _loadRulesForPlatform (platform) {
    // 根據平台返回相應的驗證規則
    switch (platform.toUpperCase()) {
      case 'READMOO':
        return this._getReadmooRules()
      case 'KINDLE':
        return this._getKindleRules()
      case 'KOBO':
        return this._getKoboRules()
      case 'BOOKWALKER':
        return this._getBookwalkerRules()
      case 'BOOKS_COM':
        return this._getBooksComRules()
      default:
        return null
    }
  }

  /**
   * 獲取 Readmoo 平台驗證規則
   */
  _getReadmooRules () {
    return {
      requiredFields: ['id', 'title'],
      dataTypes: {
        id: 'string',
        title: 'string',
        authors: 'array',
        progress: 'number',
        rating: 'number'
      },
      businessRules: {
        progressRange: { min: 0, max: 100 },
        ratingRange: { min: 0, max: 5 }
      },
      qualityChecks: {
        titleMinLength: 2,
        authorsRequired: true
      }
    }
  }

  /**
   * 獲取 Kindle 平台驗證規則
   */
  _getKindleRules () {
    return {
      requiredFields: ['id', 'title', 'authors'],
      dataTypes: {
        id: 'string',
        title: 'string',
        authors: 'array',
        progress: 'number'
      },
      businessRules: {
        progressRange: { min: 0, max: 100 }
      },
      qualityChecks: {
        titleMinLength: 1,
        authorsRequired: true
      }
    }
  }

  /**
   * 獲取 Kobo 平台驗證規則
   */
  _getKoboRules () {
    return {
      requiredFields: ['id', 'title'],
      dataTypes: {
        id: 'string',
        title: 'string',
        authors: 'array',
        progress: 'object'
      },
      businessRules: {
        progressRange: { min: 0, max: 100 }
      },
      qualityChecks: {
        titleMinLength: 2,
        authorsRequired: false
      }
    }
  }

  /**
   * 獲取 Bookwalker 平台驗證規則
   */
  _getBookwalkerRules () {
    return {
      requiredFields: ['id', 'title'],
      dataTypes: {
        id: 'string',
        title: 'string',
        authors: 'string'
      },
      businessRules: {},
      qualityChecks: {
        titleMinLength: 1,
        authorsRequired: false
      }
    }
  }

  /**
   * 獲取 Books.com 平台驗證規則
   */
  _getBooksComRules () {
    return {
      requiredFields: ['id', 'title'],
      dataTypes: {
        id: 'string',
        title: 'string'
      },
      businessRules: {},
      qualityChecks: {
        titleMinLength: 1,
        authorsRequired: false
      }
    }
  }

  /**
   * 註冊事件監聽器
   */
  registerEventListeners () {
    this.registerRuleUpdateListener()
    this.registerRuleClearListener()
  }

  /**
   * 驗證平台是否支援
   * @param {string} platform - 平台名稱
   */
  validatePlatformSupported (platform) {
    if (!this.supportedPlatforms.includes(platform)) {
      throw new Error(`Platform ${platform} is not supported`)
    }
  }

  /**
   * 獲取快取的規則
   * @param {string} platform - 平台名稱
   * @returns {Object|null} 快取結果或 null
   */
  async getCachedRules (platform) {
    if (!this.validationRules.has(platform)) return null
    await this.log(`使用快取的 ${platform} 驗證規則`)
    return this.createSuccessResult(platform, true)
  }

  /**
   * 載入並快取新規則
   * @param {string} platform - 平台名稱
   * @returns {Object} 載入結果
   */
  async loadAndCacheRules (platform) {
    const rules = await this.loadRulesWithValidation(platform)
    this.cacheRulesAndUpdateStatistics(platform, rules)
    await this.notifyRuleLoaded(platform, rules)
    return this.createSuccessResult(platform, false)
  }

  /**
   * 載入規則並驗證結構
   * @param {string} platform - 平台名稱
   * @returns {Object} 驗證後的規則
   */
  async loadRulesWithValidation (platform) {
    await this.log(`載入 ${platform} 驗證規則`)
    const rules = await this._loadRulesForPlatform(platform)
    this.validateLoadedRules(platform, rules)
    return rules
  }

  /**
   * 驗證載入的規則
   * @param {string} platform - 平台名稱
   * @param {Object} rules - 規則物件
   */
  validateLoadedRules (platform, rules) {
    if (!rules) {
      throw new Error(`Failed to load validation rules for platform ${platform}`)
    }
    if (!this.validateRuleStructure(rules)) {
      throw new Error(`Invalid rule structure for platform ${platform}`)
    }
  }

  /**
   * 快取規則並更新統計
   * @param {string} platform - 平台名稱
   * @param {Object} rules - 規則物件
   */
  cacheRulesAndUpdateStatistics (platform, rules) {
    this.validationRules.set(platform, rules)
    this.ruleStatistics.loadedCount++
    this.ruleStatistics.lastLoadTime = Date.now()
  }

  /**
   * 建立成功結果物件
   * @param {string} platform - 平台名稱
   * @param {boolean} cached - 是否來自快取
   * @returns {Object} 結果物件
   */
  createSuccessResult (platform, cached) {
    return {
      success: true,
      platform,
      cached,
      rules: this.validationRules.get(platform)
    }
  }

  /**
   * 處理載入錯誤
   * @param {string} platform - 平台名稱
   * @param {Error} error - 錯誤物件
   */
  async handleLoadError (platform, error) {
    this.ruleStatistics.errorCount++
    await this.log(`載入 ${platform} 驗證規則失敗: ${error.message}`, 'error')
  }

  /**
   * 驗證基本結構
   * @param {Object} rules - 規則物件
   * @returns {boolean} 是否有效
   */
  validateBasicStructure (rules) {
    return rules && typeof rules === 'object'
  }

  /**
   * 驗證必要章節
   * @param {Object} rules - 規則物件
   * @returns {boolean} 是否有效
   */
  validateRequiredSections (rules) {
    const requiredSections = ['requiredFields', 'dataTypes', 'businessRules']
    return requiredSections.every(section => rules[section])
  }

  /**
   * 驗證欄位類型
   * @param {Object} rules - 規則物件
   * @returns {boolean} 是否有效
   */
  validateFieldTypes (rules) {
    if (!Array.isArray(rules.requiredFields)) return false
    if (typeof rules.dataTypes !== 'object') return false
    return true
  }

  /**
   * 註冊規則更新監聽器
   */
  registerRuleUpdateListener () {
    this.eventBus.on('VALIDATION.RULES.UPDATE_REQUEST', async (data) => {
      await this.handleRuleUpdateRequest(data)
    })
  }

  /**
   * 註冊規則清除監聽器
   */
  registerRuleClearListener () {
    this.eventBus.on('VALIDATION.RULES.CLEAR_REQUEST', (data) => {
      this.handleRuleClearRequest(data)
    })
  }

  /**
   * 處理規則更新請求
   * @param {Object} data - 請求資料
   */
  async handleRuleUpdateRequest (data) {
    if (!data.platform || !data.rules) return
    try {
      await this.updatePlatformRules(data.platform, data.rules)
    } catch (error) {
      await this.log(`處理規則更新請求失敗: ${error.message}`, 'error')
    }
  }

  /**
   * 處理規則清除請求
   * @param {Object} data - 請求資料
   */
  handleRuleClearRequest (data) {
    if (data.platform) {
      this.clearPlatformRules(data.platform)
    } else if (data.clearAll) {
      this.clearAllRules()
    }
  }

  /**
   * 通知規則已載入
   * @param {string} platform - 平台名稱
   * @param {Object} rules - 規則物件
   */
  async notifyRuleLoaded (platform, rules) {
    await this.emitEvent('VALIDATION.RULES.LOADED', {
      platform,
      rulesCount: Object.keys(rules.requiredFields || {}).length,
      timestamp: Date.now()
    })
  }

  /**
   * 發送事件
   * @param {string} eventType - 事件類型
   * @param {Object} data - 事件資料
   */
  async emitEvent (eventType, data) {
    if (this.eventBus && this.eventBus.emit) {
      await this.eventBus.emit(eventType, data)
    }
  }

  /**
   * 記錄日誌
   * @param {string} message - 日誌訊息
   * @param {string} level - 日誌級別
   */
  async log (message, level = 'info') {
    // 使用新的 Logger 系統
    switch (level) {
      case 'debug':
        this.logger.debug('VALIDATION_RULE_MANAGER_LOG', { message })
        break
      case 'info':
        this.logger.info('VALIDATION_RULE_MANAGER_LOG', { message })
        break
      case 'warn':
        this.logger.warn('VALIDATION_RULE_MANAGER_LOG', { message })
        break
      case 'error':
        this.logger.error('VALIDATION_RULE_MANAGER_LOG', { message })
        break
      default:
        this.logger.info('VALIDATION_RULE_MANAGER_LOG', { message })
    }
  }
}

module.exports = ValidationRuleManager
