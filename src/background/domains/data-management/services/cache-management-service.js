/**
 * @fileoverview Cache Management Service - 快取管理服務
 * @version v0.9.21
 * @since 2025-08-21
 *
 * 從 DataValidationService 提取的快取管理邏輯
 *
 * 負責功能：
 * - 多類型快取的統一管理
 * - TTL (Time To Live) 快取生命週期控制
 * - LRU (Least Recently Used) 快取淘汰策略
 * - 快取統計和效能監控
 *
 * 設計原則：
 * - 單一職責：專注於快取存儲和管理
 * - 類型安全：支援多種快取類型的隔離存儲
 * - 效能導向：高效的快取操作和記憶體管理
 * - 可配置性：靈活的快取策略和參數設定
 */

const BaseModule = require('src/background/lifecycle/base-module')
const crypto = require('crypto')
const { createLogger } = require('src/core/logging/Logger')

class CacheManagementService extends BaseModule {
  /**
   * 初始化快取管理服務
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

    this.initializeBaseServices(eventBus, dependencies)
    this.initializeConfiguration(dependencies.config)
    this.setupCacheContainers()
  }

  /**
   * 初始化基礎服務
   */
  initializeBaseServices (eventBus, dependencies) {
    this.eventBus = eventBus
    this.logger = dependencies.logger || createLogger('CacheManagementService')
  }

  /**
   * 初始化配置
   */
  initializeConfiguration (userConfig) {
    this.config = this.mergeWithDefaults(userConfig || {})
  }

  /**
   * 設定快取容器
   */
  setupCacheContainers () {
    this.initializeCaches()
  }

  /**
   * 合併預設配置
   */
  mergeWithDefaults (userConfig) {
    const defaults = {
      enableCache: true,
      cacheSize: 100,
      cacheTTL: 300000, // 5分鐘
      cacheTypes: ['validation', 'normalization', 'quality']
    }

    return {
      ...defaults,
      ...userConfig
    }
  }

  /**
   * 初始化快取容器
   */
  initializeCaches () {
    if (!this.config.enableCache) {
      return
    }

    this.caches = new Map()
    this.cacheTimestamps = new Map()
    this.cacheStats = {}

    // 為每種快取類型建立獨立的容器
    this.config.cacheTypes.forEach(type => {
      this.caches.set(type, new Map())
      this.cacheTimestamps.set(type, new Map())
      this.cacheStats[type] = {
        totalHits: 0,
        totalMisses: 0,
        totalSets: 0,
        lastAccessed: null
      }
    })
  }

  /**
   * 生成快取鍵
   * @param {Object} book - 書籍資料
   * @param {string} platform - 平台名稱
   * @returns {string} 快取鍵
   */
  generateCacheKey (book, platform) {
    const bookId = book.id || book.ASIN || book.kobo_id || 'unknown'
    const contentHash = this.hashString(JSON.stringify(book))
    return `${platform}_${bookId}_${contentHash}`
  }

  /**
   * 設定快取值
   * @param {string} key - 快取鍵
   * @param {*} value - 快取值
   * @param {string} type - 快取類型
   * @returns {boolean} 是否設定成功
   */
  setCacheValue (key, value, type) {
    if (!this.validateCacheOperation(type)) return false
    if (!this.ensureCacheSpace(type)) return false
    if (!this.storeCacheData(key, value, type)) return false
    this.updateCacheStatistics(type, 'set')
    return true
  }

  /**
   * 取得快取值
   * @param {string} key - 快取鍵
   * @param {string} type - 快取類型
   * @returns {*|null} 快取值或 null
   */
  getCacheValue (key, type) {
    if (!this.validateCacheOperation(type)) return null
    if (!this.checkCacheTTL(key, type)) return null
    return this.retrieveCacheData(key, type)
  }

  /**
   * 檢查快取是否存在
   * @param {string} key - 快取鍵
   * @param {string} type - 快取類型
   * @returns {boolean} 是否存在
   */
  hasCacheValue (key, type) {
    if (!this.isValidCacheOperation(type)) {
      return false
    }

    return this.getCacheValue(key, type) !== null
  }

  /**
   * 刷新快取項目時間戳
   * @param {string} key - 快取鍵
   * @param {string} type - 快取類型
   * @returns {boolean} 是否刷新成功
   */
  refreshCacheEntry (key, type) {
    if (!this.isValidCacheOperation(type)) {
      return false
    }

    const cache = this.caches.get(type)
    const timestamps = this.cacheTimestamps.get(type)

    if (cache.has(key)) {
      timestamps.set(key, Date.now())
      return true
    }

    return false
  }

  /**
   * 清除指定類型的快取
   * @param {string} type - 快取類型
   */
  clearCache (type) {
    if (!this.isValidCacheOperation(type)) {
      return
    }

    this.caches.get(type).clear()
    this.cacheTimestamps.get(type).clear()

    // 重置統計（但保留歷史總計）
    this.cacheStats[type].lastAccessed = null
  }

  /**
   * 清除所有快取
   */
  clearAllCaches () {
    if (!this.config.enableCache) {
      return
    }

    this.config.cacheTypes.forEach(type => {
      this.clearCache(type)
    })
  }

  /**
   * 清除過期的快取項目
   * @param {string} type - 快取類型
   * @returns {number} 清除的項目數量
   */
  clearExpiredEntries (type) {
    if (!this.validateCacheOperation(type)) return 0
    const expiredKeys = this.findExpiredKeys(type)
    return this.removeExpiredKeys(expiredKeys, type)
  }

  /**
   * 批次設定快取值
   * @param {Array} batchData - 批次資料
   * @returns {Object} 批次操作結果
   */
  setCacheValueBatch (batchData) {
    let successCount = 0
    let failureCount = 0

    batchData.forEach(({ key, value, type }) => {
      if (this.setCacheValue(key, value, type)) {
        successCount++
      } else {
        failureCount++
      }
    })

    return { successCount, failureCount }
  }

  /**
   * 批次取得快取值
   * @param {Array} keys - 快取鍵陣列
   * @param {string} type - 快取類型
   * @returns {Object} 批次結果
   */
  getCacheValueBatch (keys, type) {
    const results = {}

    keys.forEach(key => {
      results[key] = this.getCacheValue(key, type)
    })

    return results
  }

  /**
   * 取得快取統計資訊
   * @returns {Object} 統計資訊
   */
  getCacheStatistics () {
    const stats = {}
    this.config.cacheTypes.forEach(type => {
      stats[type] = this.calculateTypeStatistics(type)
    })
    return stats
  }

  /**
   * 重置統計數據
   */
  resetStatistics () {
    this.config.cacheTypes.forEach(type => {
      this.cacheStats[type] = {
        totalHits: 0,
        totalMisses: 0,
        totalSets: 0,
        lastAccessed: null
      }
    })
  }

  /**
   * 更新快取配置
   * @param {Object} newConfig - 新配置
   */
  updateCacheConfig (newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    }
  }

  /**
   * 更新快取大小限制
   * @param {number} newSize - 新的大小限制
   */
  updateCacheSize (newSize) {
    this.config.cacheSize = newSize
  }

  /**
   * 更新快取 TTL
   * @param {number} newTTL - 新的 TTL (毫秒)
   */
  updateCacheTTL (newTTL) {
    this.config.cacheTTL = newTTL
  }

  /**
   * 取得快取配置
   * @returns {Object} 快取配置
   */
  getCacheConfig () {
    return { ...this.config }
  }

  /**
   * 驗證快取操作
   */
  validateCacheOperation (type) {
    return this.isValidCacheOperation(type)
  }

  /**
   * 確保快取空間
   */
  ensureCacheSpace (type) {
    const cache = this.caches.get(type)
    if (cache.size >= this.config.cacheSize) {
      this.evictOldestEntry(type)
    }
    return true
  }

  /**
   * 儲存快取資料
   */
  storeCacheData (key, value, type) {
    try {
      const clonedValue = this.deepClone(value)
      if (clonedValue === null) return false

      const cache = this.caches.get(type)
      const timestamps = this.cacheTimestamps.get(type)

      cache.set(key, clonedValue)
      timestamps.set(key, Date.now())
      return true
    } catch (error) {
      this.log(`設定快取失敗: ${error.message}`, 'error')
      return false
    }
  }

  /**
   * 更新快取統計
   */
  updateCacheStatistics (type, operation) {
    if (operation === 'set') {
      this.cacheStats[type].totalSets++
    } else if (operation === 'hit') {
      this.cacheStats[type].totalHits++
      this.cacheStats[type].lastAccessed = Date.now()
    } else if (operation === 'miss') {
      this.cacheStats[type].totalMisses++
    }
  }

  /**
   * 檢查快取TTL
   */
  checkCacheTTL (key, type) {
    const timestamps = this.cacheTimestamps.get(type)
    const timestamp = timestamps.get(key)

    if (timestamp && Date.now() - timestamp > this.config.cacheTTL) {
      this.removeCacheEntry(key, type)
      this.updateCacheStatistics(type, 'miss')
      return false
    }
    return true
  }

  /**
   * 檢索快取資料
   */
  retrieveCacheData (key, type) {
    const cache = this.caches.get(type)

    if (cache.has(key)) {
      this.updateCacheStatistics(type, 'hit')
      return this.deepClone(cache.get(key))
    } else {
      this.updateCacheStatistics(type, 'miss')
      return null
    }
  }

  /**
   * 移除快取項目
   */
  removeCacheEntry (key, type) {
    const cache = this.caches.get(type)
    const timestamps = this.cacheTimestamps.get(type)
    cache.delete(key)
    timestamps.delete(key)
  }

  /**
   * 尋找過期的快取鍵
   */
  findExpiredKeys (type) {
    const timestamps = this.cacheTimestamps.get(type)
    const now = Date.now()
    const expiredKeys = []

    for (const [key, timestamp] of timestamps.entries()) {
      if (now - timestamp > this.config.cacheTTL) {
        expiredKeys.push(key)
      }
    }
    return expiredKeys
  }

  /**
   * 移除過期的快取鍵
   */
  removeExpiredKeys (expiredKeys, type) {
    expiredKeys.forEach(key => {
      this.removeCacheEntry(key, type)
    })
    return expiredKeys.length
  }

  /**
   * 計算類型統計資訊
   */
  calculateTypeStatistics (type) {
    const typeStats = this.cacheStats[type]
    const cache = this.caches.get(type) || new Map()
    const hitRate = this.calculateHitRate(typeStats)

    return {
      totalHits: typeStats.totalHits,
      totalMisses: typeStats.totalMisses,
      totalSets: typeStats.totalSets,
      hitRate,
      currentSize: cache.size,
      maxSize: this.config.cacheSize,
      lastAccessed: typeStats.lastAccessed
    }
  }

  /**
   * 計算命中率
   */
  calculateHitRate (typeStats) {
    const totalRequests = typeStats.totalHits + typeStats.totalMisses
    return totalRequests > 0 ? Math.round((typeStats.totalHits / totalRequests) * 100) : 0
  }

  /**
   * 獲取記憶體使用情況
   */
  getMemoryUsage () {
    const memoryUsage = process.memoryUsage()
    return {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal
    }
  }

  /**
   * 計算總快取大小
   */
  calculateTotalCacheSize () {
    return this.config.cacheTypes.reduce((total, type) => {
      const cache = this.caches?.get(type)
      return total + (cache ? cache.size : 0)
    }, 0)
  }

  /**
   * 評估健康狀態
   */
  evaluateHealthStatus (totalCacheSize) {
    return this.config.enableCache && totalCacheSize < this.config.cacheSize * 2
  }

  /**
   * 檢查快取操作是否有效
   */
  isValidCacheOperation (type) {
    if (!this.config.enableCache) {
      return false
    }

    if (!this.config.cacheTypes.includes(type)) {
      return false
    }

    return this.caches && this.caches.has(type)
  }

  /**
   * 淘汰最舊的快取項目
   */
  evictOldestEntry (type) {
    const cache = this.caches.get(type)
    const timestamps = this.cacheTimestamps.get(type)

    if (cache.size === 0) {
      return
    }

    // Map.keys() 按照插入順序返回，第一個即為最舊的
    const oldestKey = cache.keys().next().value
    if (oldestKey) {
      cache.delete(oldestKey)
      timestamps.delete(oldestKey)
    }
  }

  /**
   * 深拷貝物件
   */
  deepClone (obj) {
    try {
      return JSON.parse(JSON.stringify(obj))
    } catch (error) {
      this.log(`深拷貝失敗: ${error.message}`, 'error')
      return null
    }
  }

  /**
   * 生成字串雜湊
   * @param {string} str - 輸入字串
   * @returns {string} 雜湊值
   */
  hashString (str) {
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 8)
  }

  /**
   * 檢查服務健康狀態
   * @returns {Object} 健康狀態
   */
  isCacheServiceHealthy () {
    const memoryUsage = this.getMemoryUsage()
    const totalCacheSize = this.calculateTotalCacheSize()
    const isHealthy = this.evaluateHealthStatus(totalCacheSize)

    return {
      isHealthy,
      cacheEnabled: this.config.enableCache,
      totalCacheSize,
      maxCacheSize: this.config.cacheSize * this.config.cacheTypes.length,
      memoryUsage,
      lastCheck: Date.now()
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
        this.logger.debug('CACHE_SERVICE_LOG', { message })
        break
      case 'info':
        this.logger.info('CACHE_SERVICE_LOG', { message })
        break
      case 'warn':
        this.logger.warn('CACHE_SERVICE_LOG', { message })
        break
      case 'error':
        this.logger.error('CACHE_SERVICE_LOG', { message })
        break
      default:
        this.logger.info('CACHE_SERVICE_LOG', { message })
    }
  }
}

module.exports = CacheManagementService
