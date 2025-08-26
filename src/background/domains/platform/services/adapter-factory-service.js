/**
 * @fileoverview Adapter Factory Service - 適配器工廠服務
 * @version v2.0.0
 * @since 2025-08-14
 *
 * 負責功能：
 * - 工廠模式適配器創建與管理
 * - 適配器生命週期完整管理 (create, initialize, activate, deactivate, cleanup)
 * - 資源池化與重用機制
 * - 效能監控與統計記錄
 * - 依賴注入與配置管理
 *
 * 設計考量：
 * - 支援 5 個主流電子書平台 (READMOO, KINDLE, KOBO, BOOKWALKER, BOOKS_COM)
 * - 與 Platform Registry Service 無縫整合
 * - 事件驅動架構 v2.0 命名規範
 * - 錯誤處理和健康監控機制
 * - 記憶體效率與效能優化
 *
 * 處理流程：
 * 1. 初始化適配器工廠和資源池
 * 2. 根據平台需求創建適配器實例
 * 3. 管理適配器完整生命週期
 * 4. 提供資源池化和重用服務
 * 5. 監控效能並記錄統計資料
 *
 * 使用情境：
 * - Platform Domain Coordinator 請求適配器時
 * - Platform Switcher Service 切換平台時
 * - 需要動態載入或卸載適配器時
 */

class AdapterFactoryService {
  /**
   * 初始化適配器工廠服務
   * @param {EventBus} eventBus - 事件總線實例
   * @param {Object} dependencies - 依賴注入物件
   */
  constructor (eventBus, dependencies = {}) {
    this.eventBus = eventBus
    this.logger = dependencies.logger
    this.config = dependencies.config || {}
    this.platformRegistry = dependencies.platformRegistry
    this.performanceMonitor = dependencies.performanceMonitor

    // 適配器實例池 - 主要資料結構
    this.adapterPool = new Map()

    // 適配器狀態追蹤
    this.adapterStates = new Map()

    // 適配器類型映射
    this.adapterTypes = new Map()

    // 工廠配置
    this.factoryConfig = {
      maxPoolSize: this.config.maxPoolSize || 10,
      maxIdleTime: this.config.maxIdleTime || 300000, // 5分鐘
      enablePooling: this.config.enablePooling !== false,
      enablePerformanceMonitoring: this.config.enablePerformanceMonitoring !== false,
      healthCheckInterval: this.config.healthCheckInterval || 60000, // 1分鐘
      maxRetryAttempts: this.config.maxRetryAttempts || 3
    }

    // 統計資料
    this.statistics = {
      totalCreated: 0,
      totalDestroyed: 0,
      activeInstances: 0,
      poolHits: 0,
      poolMisses: 0,
      creationErrors: 0,
      lifecycleErrors: 0,
      lastCreationTime: null,
      avgCreationTime: 0,
      performanceMetrics: new Map()
    }

    // 健康監控
    this.healthStatus = {
      isHealthy: true,
      lastHealthCheck: null,
      unhealthyAdapters: new Set(),
      warningCount: 0,
      errorCount: 0
    }

    // 服務狀態
    this.isInitialized = false
    this.isShuttingDown = false
    this.healthCheckTimer = null
    this.cleanupTimer = null

    // 支援的平台配置
    this.supportedPlatforms = [
      'READMOO',
      'KINDLE',
      'KOBO',
      'BOOKWALKER',
      'BOOKS_COM'
    ]

    // 適配器構造函數映射
    this.adapterConstructors = new Map()
  }

  /**
   * 初始化工廠服務
   */
  async initialize () {
    try {
      await this.log('開始初始化 Adapter Factory Service')

      // 初始化適配器類型映射
      await this.initializeAdapterTypes()

      // 載入適配器構造函數
      await this.loadAdapterConstructors()

      // 初始化資源池
      await this.initializeAdapterPool()

      // 設定事件監聽器
      await this.setupEventListeners()

      // 啟動健康監控
      await this.startHealthMonitoring()

      // 啟動資源清理
      await this.startResourceCleanup()

      this.isInitialized = true
      await this.log('Adapter Factory Service 初始化完成')

      // 發送初始化完成事件
      await this.emitEvent('PLATFORM.ADAPTER.FACTORY.INITIALIZED', {
        supportedPlatforms: this.supportedPlatforms,
        poolConfiguration: this.factoryConfig,
        timestamp: Date.now()
      })
    } catch (error) {
      await this.logError('Adapter Factory Service 初始化失敗', error)
      throw error
    }
  }

  /**
   * 初始化適配器類型映射
   */
  async initializeAdapterTypes () {
    // 定義每個平台的適配器類型配置
    const adapterTypeConfigs = {
      READMOO: {
        moduleId: 'readmoo-adapter',
        className: 'ReadmooAdapter',
        version: '2.0.0',
        loadStrategy: 'eager',
        dependencies: ['dom-parser', 'data-extractor'],
        capabilities: [
          'book_extraction',
          'reading_progress',
          'user_annotations',
          'bookmarks',
          'purchase_history',
          'library_management'
        ],
        config: {
          baseUrl: 'https://readmoo.com',
          apiVersion: 'v2',
          timeout: 30000,
          retryAttempts: 3
        }
      },

      KINDLE: {
        moduleId: 'kindle-adapter',
        className: 'KindleAdapter',
        version: '2.0.0',
        loadStrategy: 'lazy',
        dependencies: ['amazon-api', 'cloud-sync'],
        capabilities: [
          'book_extraction',
          'reading_progress',
          'highlights',
          'whispersync',
          'cloud_sync'
        ],
        config: {
          baseUrl: 'https://read.amazon.com',
          apiVersion: 'v1',
          timeout: 45000,
          retryAttempts: 2
        }
      },

      KOBO: {
        moduleId: 'kobo-adapter',
        className: 'KoboAdapter',
        version: '2.0.0',
        loadStrategy: 'lazy',
        dependencies: ['kobo-api', 'social-sync'],
        capabilities: [
          'book_extraction',
          'reading_progress',
          'social_features',
          'reading_stats'
        ],
        config: {
          baseUrl: 'https://kobo.com',
          apiVersion: 'v1',
          timeout: 25000,
          retryAttempts: 3
        }
      },

      BOOKWALKER: {
        moduleId: 'bookwalker-adapter',
        className: 'BookWalkerAdapter',
        version: '2.0.0',
        loadStrategy: 'lazy',
        dependencies: ['manga-parser', 'multilang-support'],
        capabilities: [
          'book_extraction',
          'reading_progress',
          'manga_support',
          'light_novel_support'
        ],
        config: {
          baseUrl: 'https://bookwalker.com.tw',
          apiVersion: 'v1',
          timeout: 35000,
          retryAttempts: 2
        }
      },

      BOOKS_COM: {
        moduleId: 'books-com-adapter',
        className: 'BooksComAdapter',
        version: '2.0.0',
        loadStrategy: 'lazy',
        dependencies: ['local-storage', 'offline-sync'],
        capabilities: [
          'book_extraction',
          'reading_progress',
          'local_storage',
          'offline_reading'
        ],
        config: {
          baseUrl: 'https://books.com.tw',
          apiVersion: 'v1',
          timeout: 20000,
          retryAttempts: 4
        }
      }
    }

    // 註冊所有適配器類型
    for (const [platformId, typeConfig] of Object.entries(adapterTypeConfigs)) {
      this.adapterTypes.set(platformId, typeConfig)
      await this.log(`適配器類型 ${platformId} 註冊完成`)
    }
  }

  /**
   * 載入適配器構造函數
   */
  async loadAdapterConstructors () {
    // todo: 實際適配器模組載入 - 目前使用模擬構造函數

    // 模擬適配器構造函數 - 實際環境中應該動態載入
    const MockAdapter = class {
      constructor (platformId, config, dependencies) {
        this.platformId = platformId
        this.config = config
        this.dependencies = dependencies
        this.isInitialized = false
        this.isActive = false
        this.state = 'created'
        this.createdAt = Date.now()
        this.lastActivity = Date.now()
        this.errorCount = 0
        this.performanceMetrics = {
          initTime: 0,
          activationTime: 0,
          operationCount: 0,
          avgResponseTime: 0
        }
      }

      async initialize () {
        const startTime = Date.now()
        await this.simulateAsyncOperation(100)
        this.isInitialized = true
        this.state = 'initialized'
        this.performanceMetrics.initTime = Date.now() - startTime
        this.lastActivity = Date.now()
      }

      async activate () {
        const startTime = Date.now()
        await this.simulateAsyncOperation(50)
        this.isActive = true
        this.state = 'active'
        this.performanceMetrics.activationTime = Date.now() - startTime
        this.lastActivity = Date.now()
      }

      async deactivate () {
        await this.simulateAsyncOperation(30)
        this.isActive = false
        this.state = 'inactive'
        this.lastActivity = Date.now()
      }

      async cleanup () {
        await this.simulateAsyncOperation(80)
        this.state = 'cleaned'
        this.lastActivity = Date.now()
      }

      async simulateAsyncOperation (delay) {
        return new Promise(resolve => setTimeout(resolve, delay))
      }

      getHealthStatus () {
        return {
          isHealthy: this.errorCount < 5,
          state: this.state,
          errorCount: this.errorCount,
          lastActivity: this.lastActivity,
          uptime: Date.now() - this.createdAt
        }
      }
    }

    // 為每個平台註冊構造函數
    for (const platformId of this.supportedPlatforms) {
      this.adapterConstructors.set(platformId, MockAdapter)
      await this.log(`適配器構造函數 ${platformId} 載入完成`)
    }
  }

  /**
   * 初始化適配器池
   */
  async initializeAdapterPool () {
    // 為每個支援的平台建立空的池
    for (const platformId of this.supportedPlatforms) {
      this.adapterPool.set(platformId, {
        available: [],
        active: new Map(),
        maxSize: this.factoryConfig.maxPoolSize,
        currentSize: 0,
        totalCreated: 0,
        totalReused: 0
      })

      // 初始化狀態追蹤
      this.adapterStates.set(platformId, {
        totalInstances: 0,
        activeInstances: 0,
        idleInstances: 0,
        errorInstances: 0,
        lastCreated: null,
        lastError: null
      })
    }

    await this.log('適配器池初始化完成')
  }

  /**
   * 創建適配器實例
   * @param {string} platformId - 平台標識符
   * @param {Object} options - 創建選項
   * @returns {Promise<Object>} 適配器實例
   */
  async createAdapter (platformId, options = {}) {
    const startTime = Date.now()

    try {
      await this.log(`開始創建適配器: ${platformId}`)

      // 驗證平台支援
      if (!this.supportedPlatforms.includes(platformId)) {
        throw new Error(`不支援的平台: ${platformId}`)
      }

      // 檢查是否可以從池中重用
      if (this.factoryConfig.enablePooling && !options.forceNew) {
        const pooledAdapter = await this.getFromPool(platformId)
        if (pooledAdapter) {
          this.statistics.poolHits++
          await this.log(`從池中重用適配器: ${platformId}`)

          // 發送重用事件
          await this.emitEvent('PLATFORM.ADAPTER.REUSED', {
            platformId,
            adapterId: pooledAdapter.id,
            creationTime: Date.now() - startTime,
            timestamp: Date.now()
          })

          return pooledAdapter
        }
        this.statistics.poolMisses++
      }

      // 建立新的適配器實例
      const adapter = await this.createNewAdapter(platformId, options)

      // 記錄統計 - 先計算平均時間再更新總數
      const creationTime = Math.max(1, Date.now() - startTime) // 確保至少為1ms
      this.updateAverageCreationTime(creationTime)
      
      this.statistics.totalCreated++
      this.statistics.activeInstances++
      this.statistics.lastCreationTime = Date.now()

      // 更新平台狀態 - 創建時就算活躍實例(與全局統計一致)
      const state = this.adapterStates.get(platformId)
      if (state) {
        state.totalInstances++
        state.activeInstances++ // 創建時就算活躍，與全局統計保持一致
        state.lastCreated = Date.now()
      }

      // 發送創建完成事件
      await this.emitEvent('PLATFORM.ADAPTER.CREATED', {
        platformId,
        adapterId: adapter.id,
        creationTime,
        totalInstances: this.statistics.activeInstances,
        timestamp: Date.now()
      })

      await this.log(`適配器創建成功: ${platformId} (${creationTime}ms)`)
      return adapter
    } catch (error) {
      this.statistics.creationErrors++

      // 更新平台狀態
      const state = this.adapterStates.get(platformId)
      if (state) {
        state.lastError = {
          error: error.message,
          timestamp: Date.now()
        }
      }

      // 發送創建失敗事件
      await this.emitEvent('PLATFORM.ADAPTER.CREATION.FAILED', {
        platformId,
        error: error.message,
        creationTime: Date.now() - startTime,
        timestamp: Date.now()
      })

      await this.logError(`適配器創建失敗: ${platformId}`, error)
      throw error
    }
  }

  /**
   * 建立新的適配器實例
   * @param {string} platformId - 平台標識符
   * @param {Object} options - 創建選項
   * @returns {Promise<Object>} 新的適配器實例
   */
  async createNewAdapter (platformId, options = {}) {
    // 取得適配器類型配置
    const adapterType = this.adapterTypes.get(platformId)
    if (!adapterType) {
      throw new Error(`找不到適配器類型配置: ${platformId}`)
    }

    // 取得平台註冊資訊
    let platformConfig = null
    if (this.platformRegistry) {
      platformConfig = this.platformRegistry.getPlatform(platformId)
    }

    // 取得構造函數
    const AdapterConstructor = this.adapterConstructors.get(platformId)
    if (!AdapterConstructor) {
      throw new Error(`找不到適配器構造函數: ${platformId}`)
    }

    // 建立配置物件
    const config = {
      ...adapterType.config,
      ...platformConfig?.adapterConfig,
      ...options.config
    }

    // 建立依賴注入物件
    const dependencies = {
      eventBus: this.eventBus,
      logger: this.logger,
      performanceMonitor: this.performanceMonitor,
      ...options.dependencies
    }

    // 創建適配器實例
    const adapter = new AdapterConstructor(platformId, config, dependencies)

    // 加入唯一識別符
    adapter.id = this.generateAdapterId(platformId)
    adapter.factoryId = this.generateFactoryId()
    adapter.createdBy = 'AdapterFactoryService'
    adapter.version = adapterType.version

    // 加入生命週期管理方法
    await this.enhanceAdapterWithLifecycle(adapter, platformId)

    return adapter
  }

  /**
   * 增強適配器的生命週期管理功能
   * @param {Object} adapter - 適配器實例
   * @param {string} platformId - 平台標識符
   */
  async enhanceAdapterWithLifecycle (adapter, platformId) {
    const originalInitialize = adapter.initialize?.bind(adapter)
    const originalActivate = adapter.activate?.bind(adapter)
    const originalDeactivate = adapter.deactivate?.bind(adapter)
    const originalCleanup = adapter.cleanup?.bind(adapter)

    // 增強初始化方法
    adapter.initialize = async () => {
      try {
        await this.emitEvent('PLATFORM.ADAPTER.INITIALIZING', {
          platformId,
          adapterId: adapter.id,
          timestamp: Date.now()
        })

        if (originalInitialize) {
          await originalInitialize()
        }

        await this.emitEvent('PLATFORM.ADAPTER.INITIALIZED', {
          platformId,
          adapterId: adapter.id,
          timestamp: Date.now()
        })

        await this.log(`適配器初始化完成: ${platformId}`)
      } catch (error) {
        this.statistics.lifecycleErrors++
        await this.emitEvent('PLATFORM.ADAPTER.INITIALIZATION.FAILED', {
          platformId,
          adapterId: adapter.id,
          error: error.message,
          timestamp: Date.now()
        })
        throw error
      }
    }

    // 增強啟動方法
    adapter.activate = async () => {
      try {
        await this.emitEvent('PLATFORM.ADAPTER.ACTIVATING', {
          platformId,
          adapterId: adapter.id,
          timestamp: Date.now()
        })

        if (originalActivate) {
          await originalActivate()
        }

        // 添加到活躍池
        await this.addToActivePool(platformId, adapter)

        await this.emitEvent('PLATFORM.ADAPTER.ACTIVATED', {
          platformId,
          adapterId: adapter.id,
          timestamp: Date.now()
        })

        await this.log(`適配器啟動完成: ${platformId}`)
      } catch (error) {
        this.statistics.lifecycleErrors++
        await this.emitEvent('PLATFORM.ADAPTER.ACTIVATION.FAILED', {
          platformId,
          adapterId: adapter.id,
          error: error.message,
          timestamp: Date.now()
        })
        throw error
      }
    }

    // 增強停用方法
    adapter.deactivate = async () => {
      try {
        await this.emitEvent('PLATFORM.ADAPTER.DEACTIVATING', {
          platformId,
          adapterId: adapter.id,
          timestamp: Date.now()
        })

        if (originalDeactivate) {
          await originalDeactivate()
        }

        // 從活躍池移除並可能加入可用池
        await this.removeFromActivePool(platformId, adapter.id)

        if (this.factoryConfig.enablePooling) {
          await this.addToAvailablePool(platformId, adapter)
        }

        await this.emitEvent('PLATFORM.ADAPTER.DEACTIVATED', {
          platformId,
          adapterId: adapter.id,
          timestamp: Date.now()
        })

        await this.log(`適配器停用完成: ${platformId}`)
      } catch (error) {
        this.statistics.lifecycleErrors++
        await this.emitEvent('PLATFORM.ADAPTER.DEACTIVATION.FAILED', {
          platformId,
          adapterId: adapter.id,
          error: error.message,
          timestamp: Date.now()
        })
        throw error
      }
    }

    // 增強清理方法
    adapter.cleanup = async () => {
      try {
        await this.emitEvent('PLATFORM.ADAPTER.CLEANING', {
          platformId,
          adapterId: adapter.id,
          timestamp: Date.now()
        })

        if (originalCleanup) {
          await originalCleanup()
        }

        // 完全移除適配器
        await this.removeAdapter(platformId, adapter.id)

        await this.emitEvent('PLATFORM.ADAPTER.CLEANED', {
          platformId,
          adapterId: adapter.id,
          timestamp: Date.now()
        })

        await this.log(`適配器清理完成: ${platformId}`)
      } catch (error) {
        this.statistics.lifecycleErrors++
        await this.emitEvent('PLATFORM.ADAPTER.CLEANUP.FAILED', {
          platformId,
          adapterId: adapter.id,
          error: error.message,
          timestamp: Date.now()
        })
        throw error
      }
    }
  }

  /**
   * 從池中取得可用的適配器
   * @param {string} platformId - 平台標識符
   * @returns {Promise<Object|null>} 適配器實例或 null
   */
  async getFromPool (platformId) {
    const pool = this.adapterPool.get(platformId)
    if (!pool || pool.available.length === 0) {
      return null
    }

    // 取得第一個可用的適配器
    const adapter = pool.available.shift()

    // 檢查適配器健康狀態
    const healthStatus = adapter.getHealthStatus?.()
    if (!healthStatus?.isHealthy) {
      // 不健康的適配器直接清理
      await this.cleanupAdapter(adapter)
      return null
    }

    // 檢查閒置時間
    const idleTime = Date.now() - adapter.lastActivity
    if (idleTime > this.factoryConfig.maxIdleTime) {
      await this.cleanupAdapter(adapter)
      return null
    }

    // 重新啟動適配器
    try {
      await adapter.activate()
      pool.totalReused++

      // 從可用池重新激活時，需要增加activeInstances統計
      const state = this.adapterStates.get(platformId)
      if (state) {
        state.activeInstances++
        state.idleInstances--
      }

      return adapter
    } catch (error) {
      await this.logError(`適配器重啟失敗: ${platformId}`, error)
      await this.cleanupAdapter(adapter)
      return null
    }
  }

  /**
   * 添加適配器到活躍池
   * @param {string} platformId - 平台標識符
   * @param {Object} adapter - 適配器實例
   */
  async addToActivePool (platformId, adapter) {
    const pool = this.adapterPool.get(platformId)
    if (pool) {
      pool.active.set(adapter.id, adapter)
    }

    // 不要重複增加 activeInstances，因為在 createAdapter 時已經計算了
    // 只有從可用池重新激活時才需要增加統計
  }

  /**
   * 從活躍池移除適配器
   * @param {string} platformId - 平台標識符
   * @param {string} adapterId - 適配器ID
   */
  async removeFromActivePool (platformId, adapterId) {
    const pool = this.adapterPool.get(platformId)
    if (pool) {
      pool.active.delete(adapterId)
    }

    // 更新統計
    const state = this.adapterStates.get(platformId)
    if (state) {
      state.activeInstances--
    }
  }

  /**
   * 添加適配器到可用池
   * @param {string} platformId - 平台標識符
   * @param {Object} adapter - 適配器實例
   */
  async addToAvailablePool (platformId, adapter) {
    const pool = this.adapterPool.get(platformId)
    if (!pool) return

    // 檢查池大小限制
    if (pool.available.length >= pool.maxSize) {
      // 清理最舊的適配器
      const oldestAdapter = pool.available.shift()
      await this.cleanupAdapter(oldestAdapter)
    }

    // 添加到可用池
    pool.available.push(adapter)

    // 更新統計
    const state = this.adapterStates.get(platformId)
    if (state) {
      state.idleInstances++
    }
  }

  /**
   * 完全移除適配器
   * @param {string} platformId - 平台標識符
   * @param {string} adapterId - 適配器ID
   */
  async removeAdapter (platformId, adapterId) {
    const pool = this.adapterPool.get(platformId)
    if (!pool) return

    // 從活躍池移除
    pool.active.delete(adapterId)

    // 從可用池移除
    pool.available = pool.available.filter(adapter => adapter.id !== adapterId)

    // 更新統計
    this.statistics.activeInstances--
    this.statistics.totalDestroyed++

    const state = this.adapterStates.get(platformId)
    if (state) {
      state.totalInstances--
      if (state.activeInstances > 0) {
        state.activeInstances--
      }
    }
  }

  /**
   * 清理適配器資源
   * @param {Object} adapter - 適配器實例
   */
  async cleanupAdapter (adapter) {
    try {
      if (adapter.cleanup && typeof adapter.cleanup === 'function') {
        await adapter.cleanup()
      }
    } catch (error) {
      await this.logError('清理適配器時發生錯誤', error)
    }
  }

  /**
   * 取得適配器實例
   * @param {string} platformId - 平台標識符
   * @param {string} adapterId - 適配器ID
   * @returns {Object|null} 適配器實例
   */
  getAdapter (platformId, adapterId) {
    const pool = this.adapterPool.get(platformId)
    if (!pool) return null

    return pool.active.get(adapterId) || null
  }

  /**
   * 取得所有活躍的適配器
   * @param {string} platformId - 平台標識符
   * @returns {Array<Object>} 適配器實例陣列
   */
  getActiveAdapters (platformId = null) {
    if (platformId) {
      const pool = this.adapterPool.get(platformId)
      return pool ? Array.from(pool.active.values()) : []
    }

    // 回傳所有平台的活躍適配器
    const allAdapters = []
    for (const pool of this.adapterPool.values()) {
      allAdapters.push(...Array.from(pool.active.values()))
    }
    return allAdapters
  }

  /**
   * 停用適配器
   * @param {string} platformId - 平台標識符
   * @param {string} adapterId - 適配器ID
   * @returns {Promise<boolean>} 停用結果
   */
  async deactivateAdapter (platformId, adapterId) {
    try {
      const adapter = this.getAdapter(platformId, adapterId)
      if (!adapter) {
        await this.log(`適配器不存在: ${platformId}/${adapterId}`)
        return false
      }

      await adapter.deactivate()
      await this.log(`適配器停用成功: ${platformId}/${adapterId}`)
      return true
    } catch (error) {
      await this.logError(`停用適配器失敗: ${platformId}/${adapterId}`, error)
      return false
    }
  }

  /**
   * 清理適配器
   * @param {string} platformId - 平台標識符
   * @param {string} adapterId - 適配器ID
   * @returns {Promise<boolean>} 清理結果
   */
  async cleanupAdapterById (platformId, adapterId) {
    try {
      const adapter = this.getAdapter(platformId, adapterId)
      if (!adapter) {
        await this.log(`適配器不存在: ${platformId}/${adapterId}`)
        return false
      }

      await adapter.cleanup()
      await this.log(`適配器清理成功: ${platformId}/${adapterId}`)
      return true
    } catch (error) {
      await this.logError(`清理適配器失敗: ${platformId}/${adapterId}`, error)
      return false
    }
  }

  /**
   * 清理平台的所有適配器
   * @param {string} platformId - 平台標識符
   * @returns {Promise<number>} 清理的適配器數量
   */
  async cleanupPlatformAdapters (platformId) {
    let cleanedCount = 0

    try {
      const pool = this.adapterPool.get(platformId)
      if (!pool) return 0

      // 清理活躍適配器
      const activeAdapters = Array.from(pool.active.values())
      for (const adapter of activeAdapters) {
        try {
          await adapter.cleanup()
          cleanedCount++
        } catch (error) {
          await this.logError(`清理活躍適配器失敗: ${adapter.id}`, error)
        }
      }

      // 清理可用適配器
      const availableAdapters = [...pool.available]
      for (const adapter of availableAdapters) {
        try {
          await this.cleanupAdapter(adapter)
          cleanedCount++
        } catch (error) {
          await this.logError(`清理可用適配器失敗: ${adapter.id}`, error)
        }
      }

      // 重置池狀態
      pool.active.clear()
      pool.available = []
      pool.currentSize = 0

      await this.log(`平台 ${platformId} 的 ${cleanedCount} 個適配器已清理`)
      return cleanedCount
    } catch (error) {
      await this.logError(`清理平台適配器失敗: ${platformId}`, error)
      return cleanedCount
    }
  }

  /**
   * 設定事件監聽器
   */
  async setupEventListeners () {
    // 監聽平台切換事件
    this.eventBus.on('PLATFORM.SWITCHER.SWITCHING', this.handlePlatformSwitching.bind(this))

    // 監聽適配器錯誤事件
    this.eventBus.on('PLATFORM.ADAPTER.ERROR', this.handleAdapterError.bind(this))

    // 監聽工廠查詢事件
    this.eventBus.on('PLATFORM.ADAPTER.FACTORY.QUERY', this.handleFactoryQuery.bind(this))

    // 監聽資源清理請求
    this.eventBus.on('PLATFORM.ADAPTER.CLEANUP.REQUESTED', this.handleCleanupRequest.bind(this))
  }

  /**
   * 處理平台切換事件
   * @param {Object} event - 平台切換事件
   */
  async handlePlatformSwitching (event) {
    const { fromPlatform, toPlatform } = event.data || {}

    try {
      // 停用舊平台的適配器
      if (fromPlatform) {
        const activeAdapters = this.getActiveAdapters(fromPlatform)
        for (const adapter of activeAdapters) {
          await adapter.deactivate()
        }
      }

      // 為新平台預先創建並激活適配器
      if (toPlatform) {
        const newAdapter = await this.createAdapter(toPlatform, { preload: true })
        await newAdapter.initialize()
        await newAdapter.activate()
      }
    } catch (error) {
      await this.logError('處理平台切換事件失敗', error)
    }
  }

  /**
   * 處理適配器錯誤事件
   * @param {Object} event - 適配器錯誤事件
   */
  async handleAdapterError (event) {
    const { platformId, adapterId, error } = event.data || {}

    if (platformId && adapterId) {
      const adapter = this.getAdapter(platformId, adapterId)
      if (adapter) {
        adapter.errorCount = (adapter.errorCount || 0) + 1

        // 錯誤次數過多時自動清理
        if (adapter.errorCount >= 5) {
          await this.cleanupAdapterById(platformId, adapterId)
          this.healthStatus.unhealthyAdapters.add(`${platformId}:${adapterId}`)
        }
      }
    }
  }

  /**
   * 處理工廠查詢事件
   * @param {Object} event - 工廠查詢事件
   */
  async handleFactoryQuery (event) {
    const { queryType, params, responseEventType } = event.data || {}

    let result = null

    switch (queryType) {
      case 'GET_ADAPTER':
        result = this.getAdapter(params.platformId, params.adapterId)
        break
      case 'GET_ACTIVE_ADAPTERS':
        result = this.getActiveAdapters(params.platformId)
        break
      case 'GET_STATISTICS':
        result = this.getStatistics()
        break
      case 'GET_HEALTH_STATUS':
        result = this.getHealthStatus()
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
   * 處理清理請求事件
   * @param {Object} event - 清理請求事件
   */
  async handleCleanupRequest (event) {
    const { cleanupType, platformId, adapterId } = event.data || {}

    try {
      let result = 0

      switch (cleanupType) {
        case 'ADAPTER':
          result = await this.cleanupAdapterById(platformId, adapterId) ? 1 : 0
          break
        case 'PLATFORM':
          result = await this.cleanupPlatformAdapters(platformId)
          break
        case 'ALL':
          result = await this.cleanupAllAdapters()
          break
      }

      await this.emitEvent('PLATFORM.ADAPTER.CLEANUP.COMPLETED', {
        cleanupType,
        platformId,
        adapterId,
        cleanedCount: result,
        timestamp: Date.now()
      })
    } catch (error) {
      await this.emitEvent('PLATFORM.ADAPTER.CLEANUP.FAILED', {
        cleanupType,
        platformId,
        adapterId,
        error: error.message,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 啟動健康監控
   */
  async startHealthMonitoring () {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck()
    }, this.factoryConfig.healthCheckInterval)

    await this.log('健康監控已啟動')
  }

  /**
   * 執行健康檢查
   */
  async performHealthCheck () {
    try {
      let totalAdapters = 0
      let healthyAdapters = 0
      let unhealthyCount = 0
      const unhealthyAdapters = new Set()

      // 檢查所有平台的適配器
      for (const [platformId, pool] of this.adapterPool.entries()) {
        const allAdapters = [
          ...Array.from(pool.active.values()),
          ...pool.available
        ]

        for (const adapter of allAdapters) {
          totalAdapters++
          const healthStatus = adapter.getHealthStatus?.()

          if (healthStatus?.isHealthy) {
            healthyAdapters++
          } else {
            unhealthyCount++
            unhealthyAdapters.add(`${platformId}:${adapter.id}`)

            // 記錄不健康的適配器
            const state = this.adapterStates.get(platformId)
            if (state) {
              state.errorInstances++
            }
          }
        }
      }

      // 更新健康狀態
      this.healthStatus = {
        isHealthy: unhealthyCount === 0,
        lastHealthCheck: Date.now(),
        unhealthyAdapters,
        warningCount: totalAdapters > 0 ? Math.round((unhealthyCount / totalAdapters) * 100) : 0,
        errorCount: unhealthyCount,
        totalAdapters,
        healthyAdapters
      }

      // 發送健康檢查完成事件
      await this.emitEvent('PLATFORM.ADAPTER.HEALTH.CHECK.COMPLETED', {
        healthStatus: this.healthStatus,
        timestamp: Date.now()
      })

      // 如果有不健康的適配器，發送警告
      if (unhealthyCount > 0) {
        await this.emitEvent('PLATFORM.ADAPTER.HEALTH.WARNING', {
          unhealthyCount,
          unhealthyAdapters: Array.from(unhealthyAdapters),
          healthScore: totalAdapters > 0 ? Math.round((healthyAdapters / totalAdapters) * 100) : 0,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.healthStatus.errorCount++
      await this.logError('健康檢查執行失敗', error)
    }
  }

  /**
   * 啟動資源清理
   */
  async startResourceCleanup () {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    // 每5分鐘執行一次資源清理
    this.cleanupTimer = setInterval(async () => {
      await this.performResourceCleanup()
    }, 300000)

    await this.log('資源清理已啟動')
  }

  /**
   * 執行資源清理
   */
  async performResourceCleanup () {
    try {
      let cleanedCount = 0
      const now = Date.now()

      // 清理所有平台的閒置適配器
      for (const [platformId, pool] of this.adapterPool.entries()) {
        const availableAdapters = [...pool.available]

        for (const adapter of availableAdapters) {
          const idleTime = now - adapter.lastActivity

          // 清理超過最大閒置時間的適配器
          if (idleTime > this.factoryConfig.maxIdleTime) {
            try {
              await this.cleanupAdapter(adapter)

              // 從可用池移除
              pool.available = pool.available.filter(a => a.id !== adapter.id)

              cleanedCount++
            } catch (error) {
              await this.logError(`清理閒置適配器失敗: ${adapter.id}`, error)
            }
          }
        }
      }

      if (cleanedCount > 0) {
        await this.log(`資源清理完成，清理了 ${cleanedCount} 個閒置適配器`)

        await this.emitEvent('PLATFORM.ADAPTER.RESOURCE.CLEANUP.COMPLETED', {
          cleanedCount,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      await this.logError('資源清理執行失敗', error)
    }
  }

  /**
   * 清理所有適配器
   * @returns {Promise<number>} 清理的適配器數量
   */
  async cleanupAllAdapters () {
    let totalCleaned = 0

    for (const platformId of this.supportedPlatforms) {
      const cleaned = await this.cleanupPlatformAdapters(platformId)
      totalCleaned += cleaned
    }

    // 重置統計資料
    this.statistics.totalCreated = 0
    this.statistics.activeInstances = 0
    
    // 重置所有平台狀態
    for (const platformId of this.supportedPlatforms) {
      const state = this.adapterStates.get(platformId)
      if (state) {
        state.totalInstances = 0
        state.activeInstances = 0
        state.idleInstances = 0
        state.errorInstances = 0
      }
    }

    return totalCleaned
  }

  /**
   * 更新平均創建時間
   * @param {number} creationTime - 創建時間
   */
  updateAverageCreationTime (creationTime) {
    const totalCreated = this.statistics.totalCreated
    const currentAvg = this.statistics.avgCreationTime

    // 計算新的平均時間，totalCreated 還未增加，所以不需要減1
    this.statistics.avgCreationTime =
      ((currentAvg * totalCreated) + creationTime) / (totalCreated + 1)
  }

  /**
   * 產生適配器ID
   * @param {string} platformId - 平台標識符
   * @returns {string} 適配器ID
   */
  generateAdapterId (platformId) {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `${platformId}_adapter_${timestamp}_${random}`
  }

  /**
   * 產生工廠ID
   * @returns {string} 工廠ID
   */
  generateFactoryId () {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `factory_${timestamp}_${random}`
  }

  /**
   * 取得統計資料
   * @returns {Object} 統計資料
   */
  getStatistics () {
    const poolStatistics = {}

    for (const [platformId, pool] of this.adapterPool.entries()) {
      poolStatistics[platformId] = {
        activeCount: pool.active.size,
        availableCount: pool.available.length,
        totalCreated: pool.totalCreated,
        totalReused: pool.totalReused,
        maxSize: pool.maxSize
      }
    }

    return {
      ...this.statistics,
      poolStatistics,
      adapterStates: Object.fromEntries(this.adapterStates),
      healthStatus: this.healthStatus,
      factoryConfig: this.factoryConfig
    }
  }

  /**
   * 取得健康狀態
   * @returns {Object} 健康狀態
   */
  getHealthStatus () {
    const totalPools = this.adapterPool.size
    const healthyPools = Array.from(this.adapterPool.values())
      .filter(pool => pool.active.size > 0 || pool.available.length > 0).length

    let overallHealthScore = 0
    if (this.healthStatus.totalAdapters > 0) {
      overallHealthScore = Math.round(
        (this.healthStatus.healthyAdapters / this.healthStatus.totalAdapters) * 100
      )
    }

    return {
      ...this.healthStatus,
      overallHealthScore,
      totalPools,
      healthyPools,
      poolUtilization: totalPools > 0 ? Math.round((healthyPools / totalPools) * 100) : 0,
      lastUpdate: Date.now()
    }
  }

  /**
   * 停止服務
   */
  async stop () {
    this.isShuttingDown = true

    // 停止定時器
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    // 清理所有適配器
    await this.cleanupAllAdapters()

    this.isInitialized = false
    await this.log('Adapter Factory Service 已停止')
  }

  /**
   * 清理服務資源
   */
  async cleanup () {
    // 停止服務
    await this.stop()

    // 清理資料結構
    this.adapterPool.clear()
    this.adapterStates.clear()
    this.adapterTypes.clear()
    this.adapterConstructors.clear()

    // 重置統計
    this.statistics = {
      totalCreated: 0,
      totalDestroyed: 0,
      activeInstances: 0,
      poolHits: 0,
      poolMisses: 0,
      creationErrors: 0,
      lifecycleErrors: 0,
      lastCreationTime: null,
      avgCreationTime: 0,
      performanceMetrics: new Map()
    }

    // 重置健康狀態
    this.healthStatus = {
      isHealthy: true,
      lastHealthCheck: null,
      unhealthyAdapters: new Set(),
      warningCount: 0,
      errorCount: 0
    }

    await this.log('Adapter Factory Service 資源清理完成')
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
      this.logger.info(`[AdapterFactoryService] ${message}`)
    } else {
      console.log(`[AdapterFactoryService] ${message}`)
    }
  }

  /**
   * 記錄錯誤日誌
   * @param {string} message - 錯誤訊息
   * @param {Error} error - 錯誤物件
   */
  async logError (message, error) {
    if (this.logger && typeof this.logger.error === 'function') {
      this.logger.error(`[AdapterFactoryService] ${message}`, error)
    } else {
      console.error(`[AdapterFactoryService] ${message}`, error)
    }
  }
}

module.exports = AdapterFactoryService
