const { Logger } = require('src/core/logging/Logger')
/**
 * @fileoverview LoadingOptimizer - 載入速度優化系統
 * TDD 循環 #35: Chrome Extension 載入效能優化
 *
 * 核心功能：
 * - ⚡ 快速啟動和初始化優化
 * - 📦 程式碼分割和按需載入
 * - 🚀 資源預載入和快取策略
 * - 🔄 漸進式載入和延遲載入
 * - 📊 載入效能監控和分析
 *
 * 設計特點：
 * - 針對 Chrome Extension 的特殊優化
 * - 智能資源載入順序管理
 * - 可配置的載入策略
 * - 實時載入效能追蹤
 *
 * @author TDD Development Team
 * @since 2025-08-09
 * @version 1.0.0
 */

/**
 * LoadingOptimizer 類別
 *
 * 負責功能：
 * - Extension 各組件的載入速度優化
 * - 關鍵資源的優先載入管理
 * - 非關鍵資源的延遲載入
 * - 載入效能監控和報告
 *
 * 設計考量：
 * - Chrome Extension 的生命週期特性
 * - 使用者體驗和響應性要求
 * - 記憶體使用和效能平衡
 * - 網路載入和快取策略
 *
 * 處理流程：
 * 1. 分析載入需求和優先級
 * 2. 實施程式碼分割策略
 * 3. 執行資源預載入和快取
 * 4. 監控載入效能指標
 * 5. 動態調整載入策略
 *
 * 使用情境：
 * - Extension 首次安裝和啟動
 * - Popup 快速開啟需求
 * - Overview 頁面大量資料載入
 * - Content Script 注入優化
 */
class LoadingOptimizer {
  /**
   * 載入優化常數定義
   */
  static get CONSTANTS () {
    return {
      PRIORITY: {
        CRITICAL: 1, // 關鍵資源：立即載入
        HIGH: 2, // 高優先級：預載入
        NORMAL: 3, // 一般優先級：按需載入
        LOW: 4, // 低優先級：延遲載入
        DEFERRED: 5 // 延遲資源：空閒時載入
      },
      LOADING_TARGETS: {
        // 載入目標時間 (milliseconds)
        CRITICAL_RESOURCE: 100, // 關鍵資源 100ms
        POPUP_INITIAL: 500, // Popup 初始載入 500ms
        POPUP_INTERACTIVE: 1000, // Popup 可互動 1s
        OVERVIEW_INITIAL: 1000, // Overview 初始載入 1s
        OVERVIEW_COMPLETE: 3000, // Overview 完整載入 3s
        CONTENT_SCRIPT: 200 // Content Script 200ms
      },
      CACHE_STRATEGY: {
        PRELOAD: 'preload',
        LAZY_LOAD: 'lazy',
        ON_DEMAND: 'on_demand',
        BACKGROUND: 'background'
      },
      OPTIMIZATION_MODES: {
        FAST_STARTUP: 'fast_startup',
        BALANCED: 'balanced',
        LOW_MEMORY: 'low_memory'
      }
    }
  }

  /**
   * 建構函數
   *
   * @param {Object} options - 優化配置選項
   */
  constructor (options = {}) {
    this.config = {
      mode: LoadingOptimizer.CONSTANTS.OPTIMIZATION_MODES.BALANCED,
      enablePreloading: true,
      enableLazyLoading: true,
      enableCodeSplitting: true,
      ...options
    }

    // 初始化載入管理器
    this.initializeLoadingManager()

    // 建立資源映射
    this.createResourceMappings()

    // 設定載入策略
    this.setupLoadingStrategies()
  }

  /**
   * 初始化載入管理器
   * @private
   */
  initializeLoadingManager () {
    this.loadingState = {
      initialized: false,
      criticalResourcesLoaded: false,
      backgroundResourcesLoaded: false,
      totalLoadTime: 0,
      startTime: Date.now()
    }

    this.loadingMetrics = {
      resourceLoadTimes: new Map(),
      loadingErrors: [],
      cacheHitRate: 0,
      totalRequests: 0,
      cachedRequests: 0
    }

    this.resourceCache = new Map()
    this.preloadedResources = new Set()
    this.loadingQueue = new Map()
  }

  /**
   * 建立資源映射
   * @private
   */
  createResourceMappings () {
    const { PRIORITY } = LoadingOptimizer.CONSTANTS

    this.resourceMap = new Map([
      // 關鍵資源 - 立即載入
      ['event-bus', { priority: PRIORITY.CRITICAL, size: 'small', type: 'core' }],
      ['event-handler', { priority: PRIORITY.CRITICAL, size: 'small', type: 'core' }],
      ['performance-monitor', { priority: PRIORITY.CRITICAL, size: 'medium', type: 'monitoring' }],

      // 高優先級 - 預載入
      ['popup-ui-manager', { priority: PRIORITY.HIGH, size: 'large', type: 'ui' }],
      ['popup-event-controller', { priority: PRIORITY.HIGH, size: 'medium', type: 'ui' }],
      ['book-data-extractor', { priority: PRIORITY.HIGH, size: 'large', type: 'extraction' }],

      // 一般優先級 - 按需載入
      ['overview-page-controller', { priority: PRIORITY.NORMAL, size: 'large', type: 'ui' }],
      ['book-search-filter', { priority: PRIORITY.NORMAL, size: 'medium', type: 'ui' }],
      ['export-manager', { priority: PRIORITY.NORMAL, size: 'large', type: 'export' }],

      // 低優先級 - 延遲載入
      ['diagnostic-module', { priority: PRIORITY.LOW, size: 'large', type: 'diagnostic' }],
      ['advanced-settings', { priority: PRIORITY.LOW, size: 'medium', type: 'settings' }],

      // 延遲資源 - 空閒時載入
      ['analytics-tracker', { priority: PRIORITY.DEFERRED, size: 'small', type: 'analytics' }],
      ['debug-tools', { priority: PRIORITY.DEFERRED, size: 'large', type: 'debug' }]
    ])
  }

  /**
   * 設定載入策略
   * @private
   */
  setupLoadingStrategies () {
    const { CACHE_STRATEGY, OPTIMIZATION_MODES } = LoadingOptimizer.CONSTANTS

    switch (this.config.mode) {
      case OPTIMIZATION_MODES.FAST_STARTUP:
        this.strategy = {
          criticalLoadingMode: CACHE_STRATEGY.PRELOAD,
          backgroundLoadingMode: CACHE_STRATEGY.BACKGROUND,
          memoryOptimization: false,
          aggressivePreloading: true
        }
        break

      case OPTIMIZATION_MODES.LOW_MEMORY:
        this.strategy = {
          criticalLoadingMode: CACHE_STRATEGY.ON_DEMAND,
          backgroundLoadingMode: CACHE_STRATEGY.LAZY_LOAD,
          memoryOptimization: true,
          aggressivePreloading: false
        }
        break

      default: // BALANCED
        this.strategy = {
          criticalLoadingMode: CACHE_STRATEGY.PRELOAD,
          backgroundLoadingMode: CACHE_STRATEGY.LAZY_LOAD,
          memoryOptimization: true,
          aggressivePreloading: false
        }
    }
  }

  /**
   * 開始載入優化
   * @returns {Promise<Object>} 載入結果
   */
  async startOptimizedLoading () {
    const startTime = performance.now()

    try {
      // 1. 載入關鍵資源
      await this.loadCriticalResources()

      // 2. 預載入高優先級資源
      if (this.config.enablePreloading) {
        this.preloadHighPriorityResources()
      }

      // 3. 設定延遲載入
      if (this.config.enableLazyLoading) {
        this.setupLazyLoading()
      }

      // 4. 背景載入其他資源
      this.startBackgroundLoading()

      const endTime = performance.now()
      const totalTime = endTime - startTime

      this.loadingState.initialized = true
      this.loadingState.totalLoadTime = totalTime

      return {
        success: true,
        loadTime: totalTime,
        criticalResourcesLoaded: this.loadingState.criticalResourcesLoaded,
        metrics: this.getLoadingMetrics()
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      Logger.error('❌ 載入優化失敗:', error)
      this.loadingMetrics.loadingErrors.push({
        error: error.message,
        timestamp: Date.now(),
        phase: 'initialization'
      })

      return {
        success: false,
        error: error.message,
        loadTime: performance.now() - startTime
      }
    }
  }

  /**
   * 載入關鍵資源
   * @returns {Promise<void>}
   * @private
   */
  async loadCriticalResources () {
    const { PRIORITY, LOADING_TARGETS } = LoadingOptimizer.CONSTANTS
    const criticalResources = Array.from(this.resourceMap.entries())
      .filter(([_, config]) => config.priority === PRIORITY.CRITICAL)
      .map(([name]) => name)

    const loadPromises = criticalResources.map(async (resourceName) => {
      const startTime = performance.now()

      try {
        await this.loadResource(resourceName)

        const endTime = performance.now()
        const loadTime = endTime - startTime

        this.loadingMetrics.resourceLoadTimes.set(resourceName, loadTime)

        // 檢查是否超過目標時間
        if (loadTime > LOADING_TARGETS.CRITICAL_RESOURCE) {
          // eslint-disable-next-line no-console
          Logger.warn(`⚠️ 關鍵資源 ${resourceName} 載入時間超過目標: ${loadTime.toFixed(2)}ms`)
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        Logger.error(`❌ 關鍵資源 ${resourceName} 載入失敗:`, error)
        this.loadingMetrics.loadingErrors.push({
          resource: resourceName,
          error: error.message,
          timestamp: Date.now(),
          phase: 'critical'
        })
      }
    })

    await Promise.all(loadPromises)
    this.loadingState.criticalResourcesLoaded = true
  }

  /**
   * 預載入高優先級資源
   * @private
   */
  preloadHighPriorityResources () {
    const { PRIORITY } = LoadingOptimizer.CONSTANTS
    const highPriorityResources = Array.from(this.resourceMap.entries())
      .filter(([_, config]) => config.priority === PRIORITY.HIGH)
      .map(([name]) => name)

    highPriorityResources.forEach((resourceName) => {
      this.schedulePreload(resourceName)
    })

    Logger.info(`📦 已排程預載入 ${highPriorityResources.length} 個高優先級資源`)
  }

  /**
   * 排程資源預載入
   * @param {string} resourceName - 資源名稱
   * @private
   */
  schedulePreload (resourceName) {
    // 使用 requestIdleCallback 在瀏覽器空閒時預載入
    const preloadTask = () => {
      if (!this.preloadedResources.has(resourceName)) {
        this.loadResource(resourceName)
          .then(() => {
            this.preloadedResources.add(resourceName)
            Logger.info(`📦 已預載入: ${resourceName}`)
          })
          .catch((error) => {
            // eslint-disable-next-line no-console
            Logger.warn(`⚠️ 預載入失敗 ${resourceName}:`, error)
          })
      }
    }

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(preloadTask, { timeout: 5000 })
    } else {
      setTimeout(preloadTask, 100)
    }
  }

  /**
   * 設定延遲載入
   * @private
   */
  setupLazyLoading () {
    // 建立 Intersection Observer 監控延遲載入觸發點
    if (typeof IntersectionObserver !== 'undefined') {
      this.lazyLoadObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const resourceName = entry.target.dataset.lazyResource
            if (resourceName) {
              this.loadResource(resourceName)
              this.lazyLoadObserver.unobserve(entry.target)
            }
          }
        })
      }, {
        rootMargin: '50px'
      })
    }
  }

  /**
   * 開始背景載入
   * @private
   */
  startBackgroundLoading () {
    const { PRIORITY } = LoadingOptimizer.CONSTANTS
    const backgroundResources = Array.from(this.resourceMap.entries())
      .filter(([_, config]) =>
        config.priority === PRIORITY.NORMAL ||
        config.priority === PRIORITY.LOW ||
        config.priority === PRIORITY.DEFERRED
      )
      .sort(([, a], [, b]) => a.priority - b.priority) // 按優先級排序
      .map(([name]) => name)

    // 使用隊列方式逐步載入背景資源
    this.loadResourceQueue(backgroundResources)
  }

  /**
   * 載入資源隊列
   * @param {Array<string>} resources - 資源名稱陣列
   * @private
   */
  async loadResourceQueue (resources) {
    const CONCURRENT_LIMIT = 3 // 同時載入的資源數量限制
    const loadingPromises = []

    for (const resourceName of resources) {
      const loadPromise = this.loadResourceWithDelay(resourceName, 100)
      loadingPromises.push(loadPromise)

      // 控制並發數量
      if (loadingPromises.length >= CONCURRENT_LIMIT) {
        await Promise.race(loadingPromises)
        // 移除已完成的 Promise
        const completedIndex = loadingPromises.findIndex(p => p.settled)
        if (completedIndex !== -1) {
          loadingPromises.splice(completedIndex, 1)
        }
      }
    }

    // 等待剩餘資源載入完成
    await Promise.allSettled(loadingPromises)
    this.loadingState.backgroundResourcesLoaded = true
  }

  /**
   * 延遲載入資源
   * @param {string} resourceName - 資源名稱
   * @param {number} delay - 延遲時間（毫秒）
   * @returns {Promise<void>}
   * @private
   */
  async loadResourceWithDelay (resourceName, delay = 0) {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    return this.loadResource(resourceName)
  }

  /**
   * 載入單個資源
   * @param {string} resourceName - 資源名稱
   * @returns {Promise<any>} 載入的資源
   * @private
   */
  async loadResource (resourceName) {
    // 檢查快取
    if (this.resourceCache.has(resourceName)) {
      this.loadingMetrics.cachedRequests++
      return this.resourceCache.get(resourceName)
    }

    this.loadingMetrics.totalRequests++

    try {
      // 模擬資源載入邏輯
      const resource = await this.simulateResourceLoad(resourceName)

      // 快取資源
      if (this.shouldCacheResource(resourceName)) {
        this.resourceCache.set(resourceName, resource)
      }

      return resource
    } catch (error) {
      // eslint-disable-next-line no-console
      Logger.error(`❌ 載入資源失敗 ${resourceName}:`, error)
      throw error
    }
  }

  /**
   * 模擬資源載入
   * @param {string} resourceName - 資源名稱
   * @returns {Promise<Object>} 模擬的資源物件
   * @private
   */
  async simulateResourceLoad (resourceName) {
    const resourceConfig = this.resourceMap.get(resourceName)

    // 如果找不到配置，創建動態配置
    const config = resourceConfig || {
      priority: LoadingOptimizer.CONSTANTS.PRIORITY.NORMAL,
      size: 'medium',
      type: 'dynamic'
    }

    // 模擬載入時間（根據資源大小）
    const loadTime = this.calculateLoadTime(config.size)
    await new Promise(resolve => setTimeout(resolve, loadTime))

    return {
      name: resourceName,
      config,
      loadedAt: Date.now(),
      content: `模擬載入的 ${resourceName} 資源內容`
    }
  }

  /**
   * 計算載入時間
   * @param {string} size - 資源大小 ('small', 'medium', 'large')
   * @returns {number} 載入時間（毫秒）
   * @private
   */
  calculateLoadTime (size) {
    const baseTimes = {
      small: 50,
      medium: 150,
      large: 300
    }

    const baseTime = baseTimes[size] || 100

    // 加入隨機變化 (±20%)
    const variation = baseTime * 0.2 * (Math.random() - 0.5)
    return Math.max(10, baseTime + variation)
  }

  /**
   * 檢查是否應該快取資源
   * @param {string} resourceName - 資源名稱
   * @returns {boolean} 是否應該快取
   * @private
   */
  shouldCacheResource (resourceName) {
    const resourceConfig = this.resourceMap.get(resourceName)
    if (!resourceConfig) return false

    // 記憶體優化模式下，只快取關鍵和高優先級資源
    if (this.strategy.memoryOptimization) {
      return resourceConfig.priority <= LoadingOptimizer.CONSTANTS.PRIORITY.HIGH
    }

    // 否則快取所有除了延遲資源外的資源
    return resourceConfig.priority < LoadingOptimizer.CONSTANTS.PRIORITY.DEFERRED
  }

  /**
   * 獲取載入指標
   * @returns {Object} 載入指標資料
   */
  getLoadingMetrics () {
    const cacheHitRate = this.loadingMetrics.totalRequests > 0
      ? (this.loadingMetrics.cachedRequests / this.loadingMetrics.totalRequests) * 100
      : 0

    return {
      loadingState: { ...this.loadingState },
      performance: {
        totalLoadTime: this.loadingState.totalLoadTime,
        averageResourceLoadTime: this.calculateAverageLoadTime(),
        slowestResource: this.getSlowestResource(),
        fastestResource: this.getFastestResource()
      },
      cache: {
        hitRate: cacheHitRate,
        totalRequests: this.loadingMetrics.totalRequests,
        cachedRequests: this.loadingMetrics.cachedRequests,
        cacheSize: this.resourceCache.size
      },
      resources: {
        preloadedCount: this.preloadedResources.size,
        cachedCount: this.resourceCache.size,
        errorCount: this.loadingMetrics.loadingErrors.length
      },
      errors: this.loadingMetrics.loadingErrors
    }
  }

  /**
   * 計算平均載入時間
   * @returns {number} 平均載入時間
   * @private
   */
  calculateAverageLoadTime () {
    const times = Array.from(this.loadingMetrics.resourceLoadTimes.values())
    if (times.length === 0) return 0

    return times.reduce((sum, time) => sum + time, 0) / times.length
  }

  /**
   * 獲取載入最慢的資源
   * @returns {Object|null} 最慢資源資訊
   * @private
   */
  getSlowestResource () {
    let slowest = null
    let maxTime = 0

    for (const [resource, time] of this.loadingMetrics.resourceLoadTimes) {
      if (time > maxTime) {
        maxTime = time
        slowest = { resource, time }
      }
    }

    return slowest
  }

  /**
   * 獲取載入最快的資源
   * @returns {Object|null} 最快資源資訊
   * @private
   */
  getFastestResource () {
    let fastest = null
    let minTime = Infinity

    for (const [resource, time] of this.loadingMetrics.resourceLoadTimes) {
      if (time < minTime) {
        minTime = time
        fastest = { resource, time }
      }
    }

    return fastest
  }

  /**
   * 按需載入資源
   * @param {string} resourceName - 資源名稱
   * @returns {Promise<any>} 載入的資源
   */
  async loadOnDemand (resourceName) {
    Logger.info(`📦 按需載入資源: ${resourceName}`)

    const resource = await this.loadResource(resourceName)

    return resource
  }

  /**
   * 預熱快取
   * @param {Array<string>} resourceNames - 要預熱的資源名稱陣列
   * @returns {Promise<void>}
   */
  async warmupCache (resourceNames) {
    Logger.info(`🔥 開始快取預熱: ${resourceNames.length} 個資源`)

    const warmupPromises = resourceNames.map(resourceName =>
      this.loadResource(resourceName).catch(error => {
        // eslint-disable-next-line no-console
        Logger.warn(`⚠️ 快取預熱失敗 ${resourceName}:`, error)
      })
    )

    await Promise.allSettled(warmupPromises)
  }

  /**
   * 清理快取
   * @param {Object} options - 清理選項
   */
  clearCache (options = {}) {
    const { keepCritical = true, keepRecent = true, maxAge = 300000 } = options
    const now = Date.now()

    let clearedCount = 0

    for (const [resourceName, resource] of this.resourceCache) {
      // 保留關鍵資源
      if (keepCritical) {
        const config = this.resourceMap.get(resourceName)
        if (config && config.priority === LoadingOptimizer.CONSTANTS.PRIORITY.CRITICAL) {
          continue
        }
      }

      // 保留最近載入的資源
      if (keepRecent) {
        const age = now - resource.loadedAt
        if (age < maxAge) {
          continue
        }
      }

      this.resourceCache.delete(resourceName)
      clearedCount++
    }

    return clearedCount
  }

  /**
   * 銷毀載入優化器
   */
  destroy () {
    // 清理觀察器
    if (this.lazyLoadObserver) {
      this.lazyLoadObserver.disconnect()
      this.lazyLoadObserver = null
    }

    // 清理快取
    this.resourceCache.clear()
    this.preloadedResources.clear()
    this.loadingQueue.clear()

    // 重置狀態
    this.loadingState.initialized = false

    Logger.info('🗑️ LoadingOptimizer 已銷毀')
  }
}

// 單例模式實作
let loadingOptimizerInstance = null

/**
 * 獲取 LoadingOptimizer 單例
 * @param {Object} options - 配置選項
 * @returns {LoadingOptimizer} 載入優化器實例
 */
function getLoadingOptimizer (options = {}) {
  if (!loadingOptimizerInstance) {
    loadingOptimizerInstance = new LoadingOptimizer(options)
  }
  return loadingOptimizerInstance
}

// 模組匯出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LoadingOptimizer,
    getLoadingOptimizer
  }
} else if (typeof window !== 'undefined') {
  window.LoadingOptimizer = LoadingOptimizer
  window.getLoadingOptimizer = getLoadingOptimizer
}
