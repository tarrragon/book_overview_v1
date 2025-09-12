const { StandardError } = require('src/core/errors/StandardError')

const { createLogger } = require('src/core/logging/Logger')

/**
 * @fileoverview Platform Registry Service - 平台註冊管理服務
 * @version v2.0.0
 * @since 2025-08-14
 *
 * 負責功能：
 * - 管理所有支援平台的註冊與登記
 * - 平台適配器資訊維護與查詢
 * - 平台能力定義與驗證機制
 * - 動態平台載入與卸載管理
 *
 * 設計考量：
 * - 支援動態平台註冊和移除
 * - 平台能力標準化定義
 * - 高效能查詢和索引機制
 * - 完整的錯誤處理和恢復
 *
 * 處理流程：
 * 1. 初始化核心平台註冊表
 * 2. 提供平台註冊與移除接口
 * 3. 管理平台適配器生命週期
 * 4. 驗證平台能力與相容性
 * 5. 提供平台查詢與統計服務
 *
 * 使用情境：
 * - Platform Domain Coordinator 初始化時註冊所有平台
 * - Adapter Factory 查詢平台適配器資訊
 * - 動態載入新平台或移除不需要的平台
 */

class PlatformRegistryService {
  /**
   * 初始化平台註冊服務
   * @param {EventBus} eventBus - 事件總線實例
   * @param {Object} config - 服務配置
   */
  constructor (eventBus, config = {}) {
    this.eventBus = eventBus
    this.config = config
    this.logger = config.logger || createLogger('[PlatformRegistryService]')

    // 平台註冊表 - 核心資料結構
    this.platformRegistry = new Map()

    // 平台適配器緩存
    this.adapterCache = new Map()

    // 平台能力索引
    this.capabilityIndex = new Map()

    // 平台狀態追蹤
    this.platformStatus = new Map()

    // 服務狀態
    this.isInitialized = false
    this.lastUpdateTime = null

    // 統計資料
    this.statistics = {
      totalRegistrations: 0,
      activeRegistrations: 0,
      failedRegistrations: 0,
      lastRegistrationTime: null
    }

    // 預定義支援的平台配置
    this.defaultPlatformConfigs = this.getDefaultPlatformConfigs()
  }

  /**
   * 初始化註冊服務
   */
  async initialize () {
    try {
      await this.log('開始初始化 Platform Registry Service')

      // 註冊預設支援的平台
      await this.registerDefaultPlatforms()

      // 設定事件監聽器
      await this.setupEventListeners()

      // 驗證註冊表完整性
      await this.validateRegistryIntegrity()

      this.isInitialized = true
      this.lastUpdateTime = Date.now()

      await this.log('Platform Registry Service 初始化完成')

      // 發送初始化完成事件
      await this.emitEvent('PLATFORM.REGISTRY.INITIALIZED', {
        registeredPlatforms: Array.from(this.platformRegistry.keys()),
        totalPlatforms: this.platformRegistry.size,
        timestamp: Date.now()
      })
    } catch (error) {
      await this.logError('Platform Registry Service 初始化失敗', error)
      throw error
    }
  }

  /**
   * 取得預設平台配置
   * @returns {Object} 預設平台配置
   */
  getDefaultPlatformConfigs () {
    return {
      READMOO: {
        name: 'Readmoo 讀墨',
        platformId: 'READMOO',
        type: 'ebook_platform',
        region: 'TW',
        language: ['zh-TW'],
        capabilities: [
          'book_extraction',
          'reading_progress',
          'user_annotations',
          'bookmarks',
          'purchase_history',
          'library_management'
        ],
        adapterConfig: {
          moduleId: 'readmoo-adapter',
          version: '2.0.0',
          loadStrategy: 'eager',
          dependencies: ['dom-parser', 'data-extractor']
        },
        urlPatterns: [
          /^https?:\/\/(?:www\.)?readmoo\.com/,
          /^https?:\/\/read\.readmoo\.com/,
          /^https?:\/\/store\.readmoo\.com/
        ],
        domSelectors: [
          '.readmoo-header',
          '.readmoo-reader',
          'meta[name="readmoo-version"]'
        ],
        apiEndpoints: {
          books: '/api/books',
          progress: '/api/reading-progress',
          annotations: '/api/annotations'
        },
        priority: 1,
        status: 'active'
      },

      KINDLE: {
        name: 'Amazon Kindle',
        platformId: 'KINDLE',
        type: 'ebook_platform',
        region: 'GLOBAL',
        language: ['en', 'zh-TW', 'ja', 'es', 'fr', 'de'],
        capabilities: [
          'book_extraction',
          'reading_progress',
          'highlights',
          'whispersync',
          'cloud_sync'
        ],
        adapterConfig: {
          moduleId: 'kindle-adapter',
          version: '2.0.0',
          loadStrategy: 'lazy',
          dependencies: ['amazon-api', 'cloud-sync']
        },
        urlPatterns: [
          /^https?:\/\/read\.amazon\.com/,
          /^https?:\/\/kindle\.amazon\.com/,
          /^https?:\/\/read\.amazon\.[a-z]{2,3}/
        ],
        domSelectors: [
          '#kindle-reader',
          '.amazon-header',
          '[data-kindle-reader]'
        ],
        apiEndpoints: {
          books: '/kindle-library/sync',
          progress: '/kindle-library/reading-progress',
          highlights: '/kindle-library/annotations'
        },
        priority: 2,
        status: 'active'
      },

      KOBO: {
        name: 'Kobo',
        platformId: 'KOBO',
        type: 'ebook_platform',
        region: 'GLOBAL',
        language: ['en', 'fr', 'de', 'ja', 'zh-TW'],
        capabilities: [
          'book_extraction',
          'reading_progress',
          'social_features',
          'reading_stats'
        ],
        adapterConfig: {
          moduleId: 'kobo-adapter',
          version: '2.0.0',
          loadStrategy: 'lazy',
          dependencies: ['kobo-api', 'social-sync']
        },
        urlPatterns: [
          /^https?:\/\/(?:www\.)?kobo\.com/,
          /^https?:\/\/read\.kobo\.com/
        ],
        domSelectors: [
          '.kobo-reader',
          '.rakuten-kobo',
          '[data-kobo-reader]'
        ],
        apiEndpoints: {
          books: '/v1/library',
          progress: '/v1/reading-progress',
          social: '/v1/social'
        },
        priority: 3,
        status: 'planned'
      },

      BOOKWALKER: {
        name: 'BookWalker',
        platformId: 'BOOKWALKER',
        type: 'ebook_platform',
        region: 'ASIA',
        language: ['ja', 'zh-TW', 'en'],
        capabilities: [
          'book_extraction',
          'reading_progress',
          'manga_support',
          'light_novel_support'
        ],
        adapterConfig: {
          moduleId: 'bookwalker-adapter',
          version: '2.0.0',
          loadStrategy: 'lazy',
          dependencies: ['manga-parser', 'multilang-support']
        },
        urlPatterns: [
          /^https?:\/\/(?:www\.)?bookwalker\.com\.tw/,
          /^https?:\/\/global\.bookwalker\.jp/
        ],
        domSelectors: [
          '.bookwalker-viewer',
          '.bw-reader',
          '[data-bookwalker]'
        ],
        apiEndpoints: {
          books: '/api/library',
          progress: '/api/progress',
          manga: '/api/manga'
        },
        priority: 4,
        status: 'planned'
      },

      BOOKS_COM: {
        name: '博客來',
        platformId: 'BOOKS_COM',
        type: 'ebook_platform',
        region: 'TW',
        language: ['zh-TW'],
        capabilities: [
          'book_extraction',
          'reading_progress',
          'local_storage',
          'offline_reading'
        ],
        adapterConfig: {
          moduleId: 'books-com-adapter',
          version: '2.0.0',
          loadStrategy: 'lazy',
          dependencies: ['local-storage', 'offline-sync']
        },
        urlPatterns: [
          /^https?:\/\/(?:www\.)?books\.com\.tw/,
          /^https?:\/\/mbooks\.books\.com\.tw/
        ],
        domSelectors: [
          '.books-reader',
          '.mooink-reader',
          '[data-books-reader]'
        ],
        apiEndpoints: {
          books: '/api/ebooks',
          progress: '/api/reading-status',
          local: '/api/local-library'
        },
        priority: 5,
        status: 'planned'
      }
    }
  }

  /**
   * 註冊預設支援的平台
   */
  async registerDefaultPlatforms () {
    for (const [platformId, config] of Object.entries(this.defaultPlatformConfigs)) {
      try {
        await this.registerPlatform(platformId, config)
        await this.log(`預設平台 ${platformId} 註冊成功`)
      } catch (error) {
        await this.logError(`預設平台 ${platformId} 註冊失敗`, error)
        this.statistics.failedRegistrations++
      }
    }
  }

  /**
   * 註冊新平台
   * @param {string} platformId - 平台標識符
   * @param {Object} platformConfig - 平台配置
   * @returns {Promise<boolean>} 註冊結果
   */
  async registerPlatform (platformId, platformConfig) {
    try {
      // 驗證平台配置
      const validationResult = await this.validatePlatformConfig(platformId, platformConfig)
      if (!validationResult.isValid) {
        throw new StandardError('VALIDATION_FAILED', `平台配置驗證失敗: ${validationResult.errors.join(', ', {
          "category": "validation"
      })}`)
      }

      // 檢查是否已經註冊
      if (this.platformRegistry.has(platformId)) {
        await this.log(`平台 ${platformId} 已存在，將更新配置`)
        return await this.updatePlatform(platformId, platformConfig)
      }

      // 建立完整的平台註冊記錄
      const registrationRecord = {
        ...platformConfig,
        platformId,
        registeredAt: Date.now(),
        lastUpdated: Date.now(),
        registrationVersion: '2.0.0',
        status: platformConfig.status || 'active',
        metadata: {
          registrationSource: 'platform-registry-service',
          validationPassed: true,
          configVersion: platformConfig.version || '1.0.0'
        }
      }

      // 註冊到主要註冊表
      this.platformRegistry.set(platformId, registrationRecord)

      // 建立能力索引
      await this.indexPlatformCapabilities(platformId, platformConfig.capabilities || [])

      // 初始化平台狀態
      this.platformStatus.set(platformId, {
        status: 'registered',
        isLoaded: false,
        adapterInstance: null,
        lastActivity: Date.now(),
        errorCount: 0,
        lastError: null
      })

      // 更新統計
      this.statistics.totalRegistrations++
      if (registrationRecord.status === 'active') {
        this.statistics.activeRegistrations++
      }
      this.statistics.lastRegistrationTime = Date.now()
      this.lastUpdateTime = Date.now()

      // 發送註冊成功事件
      await this.emitEvent('PLATFORM.REGISTRY.PLATFORM.REGISTERED', {
        platformId,
        capabilities: platformConfig.capabilities || [],
        status: registrationRecord.status,
        timestamp: Date.now()
      })

      await this.log(`平台 ${platformId} (${platformConfig.name}) 註冊成功`)
      return true
    } catch (error) {
      await this.logError(`註冊平台 ${platformId} 失敗`, error)
      this.statistics.failedRegistrations++
      throw error
    }
  }

  /**
   * 更新平台配置
   * @param {string} platformId - 平台標識符
   * @param {Object} newConfig - 新的配置
   * @returns {Promise<boolean>} 更新結果
   */
  async updatePlatform (platformId, newConfig) {
    try {
      const existingRecord = this.platformRegistry.get(platformId)
      if (!existingRecord) {
        throw new StandardError('UNKNOWN_ERROR', `平台 ${platformId} 不存在`, {
          "category": "general"
      })
      }

      // 驗證新配置
      const validationResult = await this.validatePlatformConfig(platformId, newConfig)
      if (!validationResult.isValid) {
        throw new StandardError('VALIDATION_FAILED', `平台配置驗證失敗: ${validationResult.errors.join(', ', {
          "category": "validation"
      })}`)
      }

      // 合併配置（保留註冊時間等元資料）
      const updatedRecord = {
        ...existingRecord,
        ...newConfig,
        platformId,
        lastUpdated: Date.now(),
        metadata: {
          ...existingRecord.metadata,
          configVersion: newConfig.version || existingRecord.metadata.configVersion,
          lastUpdateSource: 'platform-registry-service'
        }
      }

      // 更新註冊表
      this.platformRegistry.set(platformId, updatedRecord)

      // 重新建立能力索引
      await this.indexPlatformCapabilities(platformId, newConfig.capabilities || [])

      // 更新統計
      this.lastUpdateTime = Date.now()

      // 發送更新事件
      await this.emitEvent('PLATFORM.REGISTRY.PLATFORM.UPDATED', {
        platformId,
        previousVersion: existingRecord.metadata.configVersion,
        newVersion: updatedRecord.metadata.configVersion,
        timestamp: Date.now()
      })

      await this.log(`平台 ${platformId} 配置更新成功`)
      return true
    } catch (error) {
      await this.logError(`更新平台 ${platformId} 失敗`, error)
      throw error
    }
  }

  /**
   * 移除平台註冊
   * @param {string} platformId - 平台標識符
   * @returns {Promise<boolean>} 移除結果
   */
  async unregisterPlatform (platformId) {
    try {
      const existingRecord = this.platformRegistry.get(platformId)
      if (!existingRecord) {
        await this.log(`平台 ${platformId} 不存在，無需移除`)
        return true
      }

      // 清理適配器緩存
      this.adapterCache.delete(platformId)

      // 清理能力索引
      await this.removeFromCapabilityIndex(platformId)

      // 清理平台狀態
      this.platformStatus.delete(platformId)

      // 從主要註冊表移除
      this.platformRegistry.delete(platformId)

      // 更新統計
      this.statistics.totalRegistrations--
      if (existingRecord.status === 'active') {
        this.statistics.activeRegistrations--
      }
      this.lastUpdateTime = Date.now()

      // 發送移除事件
      await this.emitEvent('PLATFORM.REGISTRY.PLATFORM.UNREGISTERED', {
        platformId,
        timestamp: Date.now()
      })

      await this.log(`平台 ${platformId} 移除成功`)
      return true
    } catch (error) {
      await this.logError(`移除平台 ${platformId} 失敗`, error)
      throw error
    }
  }

  /**
   * 驗證平台配置
   * @param {string} platformId - 平台標識符
   * @param {Object} config - 平台配置
   * @returns {Object} 驗證結果
   */
  async validatePlatformConfig (platformId, config) {
    const errors = []

    // 必要欄位檢查
    if (!config.name) errors.push('平台名稱 (name) 不能為空')
    if (!config.platformId) errors.push('平台ID (platformId) 不能為空')
    if (!config.type) errors.push('平台類型 (type) 不能為空')

    // 平台ID一致性檢查
    if (config.platformId && config.platformId !== platformId) {
      errors.push('配置中的 platformId 與註冊ID不一致')
    }

    // 能力陣列檢查
    if (config.capabilities && !Array.isArray(config.capabilities)) {
      errors.push('平台能力 (capabilities) 必須是陣列')
    }

    // URL模式檢查
    if (config.urlPatterns) {
      if (!Array.isArray(config.urlPatterns)) {
        errors.push('URL模式 (urlPatterns) 必須是陣列')
      } else {
        config.urlPatterns.forEach((pattern, index) => {
          if (!(pattern instanceof RegExp)) {
            errors.push(`URL模式 [${index}] 必須是正規表達式`)
          }
        })
      }
    }

    // 適配器配置檢查
    if (config.adapterConfig) {
      if (!config.adapterConfig.moduleId) {
        errors.push('適配器配置必須包含 moduleId')
      }
      if (!config.adapterConfig.version) {
        errors.push('適配器配置必須包含 version')
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * 建立平台能力索引
   * @param {string} platformId - 平台標識符
   * @param {Array<string>} capabilities - 平台能力列表
   */
  async indexPlatformCapabilities (platformId, capabilities) {
    // 清理舊的索引
    await this.removeFromCapabilityIndex(platformId)

    // 建立新的索引
    capabilities.forEach(capability => {
      if (!this.capabilityIndex.has(capability)) {
        this.capabilityIndex.set(capability, new Set())
      }
      this.capabilityIndex.get(capability).add(platformId)
    })
  }

  /**
   * 從能力索引中移除平台
   * @param {string} platformId - 平台標識符
   */
  async removeFromCapabilityIndex (platformId) {
    for (const [capability, platforms] of this.capabilityIndex.entries()) {
      platforms.delete(platformId)
      if (platforms.size === 0) {
        this.capabilityIndex.delete(capability)
      }
    }
  }

  /**
   * 取得平台資訊
   * @param {string} platformId - 平台標識符
   * @returns {Object|null} 平台資訊
   */
  getPlatform (platformId) {
    return this.platformRegistry.get(platformId) || null
  }

  /**
   * 取得所有註冊的平台
   * @returns {Array<Object>} 平台列表
   */
  getAllPlatforms () {
    return Array.from(this.platformRegistry.values())
  }

  /**
   * 取得活躍的平台
   * @returns {Array<Object>} 活躍平台列表
   */
  getActivePlatforms () {
    return Array.from(this.platformRegistry.values())
      .filter(platform => platform.status === 'active')
  }

  /**
   * 根據能力查詢平台
   * @param {string} capability - 能力名稱
   * @returns {Array<string>} 支援該能力的平台ID列表
   */
  getPlatformsByCapability (capability) {
    const platforms = this.capabilityIndex.get(capability)
    return platforms ? Array.from(platforms) : []
  }

  /**
   * 檢查平台是否支援特定能力
   * @param {string} platformId - 平台標識符
   * @param {string} capability - 能力名稱
   * @returns {boolean} 是否支援
   */
  platformSupportsCapability (platformId, capability) {
    const platform = this.getPlatform(platformId)
    if (!platform || !platform.capabilities) return false
    return platform.capabilities.includes(capability)
  }

  /**
   * 取得平台適配器配置
   * @param {string} platformId - 平台標識符
   * @returns {Object|null} 適配器配置
   */
  getAdapterConfig (platformId) {
    const platform = this.getPlatform(platformId)
    return platform ? platform.adapterConfig : null
  }

  /**
   * 設定適配器實例緩存
   * @param {string} platformId - 平台標識符
   * @param {Object} adapterInstance - 適配器實例
   */
  setAdapterCache (platformId, adapterInstance) {
    this.adapterCache.set(platformId, {
      instance: adapterInstance,
      cachedAt: Date.now()
    })

    // 更新平台狀態
    const status = this.platformStatus.get(platformId)
    if (status) {
      status.isLoaded = true
      status.adapterInstance = adapterInstance
      status.lastActivity = Date.now()
    }
  }

  /**
   * 取得適配器實例緩存
   * @param {string} platformId - 平台標識符
   * @returns {Object|null} 適配器實例
   */
  getAdapterCache (platformId) {
    const cached = this.adapterCache.get(platformId)
    return cached ? cached.instance : null
  }

  /**
   * 清除適配器緩存
   * @param {string} platformId - 平台標識符
   */
  clearAdapterCache (platformId) {
    this.adapterCache.delete(platformId)

    // 更新平台狀態
    const status = this.platformStatus.get(platformId)
    if (status) {
      status.isLoaded = false
      status.adapterInstance = null
      status.lastActivity = Date.now()
    }
  }

  /**
   * 更新平台狀態
   * @param {string} platformId - 平台標識符
   * @param {Object} statusUpdate - 狀態更新
   */
  updatePlatformStatus (platformId, statusUpdate) {
    const currentStatus = this.platformStatus.get(platformId)
    if (currentStatus) {
      Object.assign(currentStatus, statusUpdate, {
        lastActivity: Date.now()
      })
    }
  }

  /**
   * 取得平台狀態
   * @param {string} platformId - 平台標識符
   * @returns {Object|null} 平台狀態
   */
  getPlatformStatus (platformId) {
    return this.platformStatus.get(platformId) || null
  }

  /**
   * 設定事件監聽器
   */
  async setupEventListeners () {
    // 監聽平台狀態變更事件
    this.eventBus.on('PLATFORM.STATUS.CHANGED', this.handlePlatformStatusChange.bind(this))

    // 監聽適配器錯誤事件
    this.eventBus.on('PLATFORM.ADAPTER.ERROR', this.handleAdapterError.bind(this))

    // 監聽註冊表查詢事件
    this.eventBus.on('PLATFORM.REGISTRY.QUERY', this.handleRegistryQuery.bind(this))
  }

  /**
   * 處理平台狀態變更
   * @param {Object} event - 狀態變更事件
   */
  async handlePlatformStatusChange (event) {
    const { platformId, status } = event.data || {}
    if (platformId && status) {
      this.updatePlatformStatus(platformId, status)
    }
  }

  /**
   * 處理適配器錯誤
   * @param {Object} event - 適配器錯誤事件
   */
  async handleAdapterError (event) {
    const { platformId, error } = event.data || {}
    if (platformId) {
      const status = this.platformStatus.get(platformId)
      if (status) {
        status.errorCount++
        status.lastError = {
          error: error.message,
          timestamp: Date.now()
        }
      }
    }
  }

  /**
   * 處理註冊表查詢
   * @param {Object} event - 查詢事件
   */
  async handleRegistryQuery (event) {
    const { queryType, params, responseEventType } = event.data || {}

    let result = null

    switch (queryType) {
      case 'GET_PLATFORM':
        result = this.getPlatform(params.platformId)
        break
      case 'GET_ALL_PLATFORMS':
        result = this.getAllPlatforms()
        break
      case 'GET_ACTIVE_PLATFORMS':
        result = this.getActivePlatforms()
        break
      case 'GET_BY_CAPABILITY':
        result = this.getPlatformsByCapability(params.capability)
        break
      default:
        result = { error: `Unknown query type: ${queryType}` }
    }

    if (responseEventType) {
      await this.emitEvent(responseEventType, {
        query: queryType,
        params,
        result,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 驗證註冊表完整性
   */
  async validateRegistryIntegrity () {
    const issues = []

    // 檢查註冊表與能力索引的一致性
    for (const [platformId, platform] of this.platformRegistry.entries()) {
      if (platform.capabilities) {
        for (const capability of platform.capabilities) {
          const indexedPlatforms = this.capabilityIndex.get(capability)
          if (!indexedPlatforms || !indexedPlatforms.has(platformId)) {
            issues.push(`平台 ${platformId} 的能力 ${capability} 索引不一致`)
          }
        }
      }
    }

    // 檢查狀態追蹤一致性
    for (const platformId of this.platformRegistry.keys()) {
      if (!this.platformStatus.has(platformId)) {
        issues.push(`平台 ${platformId} 缺少狀態追蹤記錄`)
      }
    }

    if (issues.length > 0) {
      await this.logError('註冊表完整性檢查發現問題', new StandardError('UNKNOWN_ERROR', issues.join('; ', {
          "category": "general"
      })))
      return false
    }

    await this.log('註冊表完整性驗證通過')
    return true
  }

  /**
   * 取得服務統計資訊
   * @returns {Object} 統計資訊
   */
  getStatistics () {
    return {
      ...this.statistics,
      currentRegistrations: this.platformRegistry.size,
      capabilityIndexSize: this.capabilityIndex.size,
      adapterCacheSize: this.adapterCache.size,
      lastUpdateTime: this.lastUpdateTime,
      platformStatusCount: this.platformStatus.size
    }
  }

  /**
   * 取得健康狀態
   * @returns {Object} 健康狀態
   */
  getHealthStatus () {
    const totalPlatforms = this.platformRegistry.size
    const activePlatforms = this.getActivePlatforms().length
    const loadedAdapters = Array.from(this.platformStatus.values())
      .filter(status => status.isLoaded).length

    let healthScore = 0
    if (totalPlatforms > 0) {
      healthScore = (activePlatforms / totalPlatforms) * 0.6 +
                   (loadedAdapters / totalPlatforms) * 0.4
    }

    return {
      status: this.isInitialized ? 'operational' : 'initializing',
      healthScore: Math.round(healthScore * 100),
      totalPlatforms,
      activePlatforms,
      loadedAdapters,
      lastUpdateTime: this.lastUpdateTime,
      hasIntegrityIssues: false // TODO: 實作實時完整性檢查
    }
  }

  /**
   * 停止服務
   */
  async stop () {
    // 清理緩存
    this.adapterCache.clear()
    this.capabilityIndex.clear()
    this.platformStatus.clear()

    this.isInitialized = false
    await this.log('Platform Registry Service 已停止')
  }

  /**
   * 清理服務資源
   */
  async cleanup () {
    // 清理所有資料結構
    this.platformRegistry.clear()
    this.adapterCache.clear()
    this.capabilityIndex.clear()
    this.platformStatus.clear()

    // 重置統計
    this.statistics = {
      totalRegistrations: 0,
      activeRegistrations: 0,
      failedRegistrations: 0,
      lastRegistrationTime: null
    }

    this.isInitialized = false
    this.lastUpdateTime = null

    await this.log('Platform Registry Service 資源清理完成')
  }

  /**
   * 發送事件
   * @param {string} eventType - 事件類型
   * @param {Object} eventData - 事件資料
   */
  async emitEvent (eventType, eventData) {
    try {
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        await this.eventBus.emit(eventType, eventData)
      }
    } catch (error) {
      await this.logError(`發送事件 ${eventType} 失敗`, error)
    }
  }

  /**
   * 記錄日誌
   * @param {string} message - 日誌訊息
   */
  async log (message) {
    if (this.logger && typeof this.logger.info === 'function') {
      this.logger.info(message)
    } else {
      createLogger('[PlatformRegistryService]').info(message)
    }
  }

  /**
   * 記錄錯誤日誌
   * @param {string} message - 錯誤訊息
   * @param {Error} error - 錯誤物件
   */
  async logError (message, error) {
    if (this.logger && typeof this.logger.error === 'function') {
      this.logger.error(message, { error: error?.message || error })
    } else {
      createLogger('[PlatformRegistryService]').error(message, { error: error?.message || error })
    }
  }
}

module.exports = PlatformRegistryService
