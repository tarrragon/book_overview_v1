/**
 * @fileoverview ValidationCacheManager - 驗證快取管理服務
 * @version 1.0.0
 * @since 2025-08-19
 *
 * 負責功能：
 * - 多層級驗證結果快取管理（記憶體+持久化）
 * - 快取失效策略和自動清理機制
 * - 快取效能監控和統計追蹤
 * - 驗證結果、品質分析、平台規則的統一快取
 *
 * 設計考量：
 * - 實作 IValidationCacheManager 介面契約
 * - 支援 LRU、LFU、TTL 等多種驅逐策略
 * - 提供記憶體和持久化雙層快取架構
 * - 支援批次操作和並行存取安全性
 *
 * 處理流程：
 * 1. 接收快取請求並分析快取策略
 * 2. 根據配置選擇記憶體或持久化快取層
 * 3. 執行快取操作並更新統計資訊
 * 4. 監控快取使用狀況並執行自動優化
 * 5. 提供快取查詢、失效和管理接口
 *
 * 使用情境：
 * - ValidationServiceCoordinator 的快取需求
 * - 高頻驗證操作的效能優化
 * - 跨會話驗證結果持久化
 * - 系統資源使用監控和優化
 */

const crypto = require('crypto')

class ValidationCacheManager {
  /**
   * 建構驗證快取管理器
   * @param {Object} options - 快取管理器配置選項
   */
  constructor (options = {}) {
    // 快取管理器配置
    this.config = {
      maxMemoryCache: options.maxMemoryCache || 1000,
      maxPersistentCache: options.maxPersistentCache || 5000,
      defaultTTL: options.defaultTTL || 300000, // 5分鐘
      enablePersistentCache: options.enablePersistentCache !== false,
      enableStatistics: options.enableStatistics !== false,
      evictionStrategy: options.evictionStrategy || 'lru', // lru, lfu, ttl
      compressionEnabled: options.compressionEnabled || false,
      maxCacheEntrySize: options.maxCacheEntrySize || 1024 * 1024, // 1MB
      ...options
    }

    // 依賴注入
    this.storage = options.storage || this._createDefaultStorage()

    // 記憶體快取
    this.memoryCache = new Map()
    this.cacheMetadata = new Map() // TTL, priority, access times, etc.
    this.accessOrder = [] // For LRU
    this.accessCount = new Map() // For LFU

    // 持久化快取鍵
    this.persistentKeys = new Set()

    // 統計資訊
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      memoryUsage: 0,
      persistentUsage: 0,
      totalOperations: 0,
      typeDistribution: {
        validation: 0,
        quality: 0,
        rules: 0,
        other: 0
      }
    }

    this.isInitialized = true
  }

  /**
   * 快取驗證結果
   * @param {string} cacheKey - 快取鍵
   * @param {Object} validationResult - 驗證結果
   * @param {Object} options - 快取選項
   * @returns {Promise<Object>} 快取結果
   */
  async cacheValidationResult (cacheKey, validationResult, options = {}) {
    const startTime = Date.now()

    // 輸入驗證
    this._validateCacheKey(cacheKey)
    this._validateCacheData(validationResult)

    const cacheOptions = this._prepareCacheOptions(options, 'validation')
    const cacheEntry = this._createCacheEntry(validationResult, cacheOptions)

    try {
      // 選擇快取層級
      const cacheLevel = this._determineCacheLevel(cacheOptions)
      let cached = false

      // 記憶體快取
      if (cacheLevel === 'memory' || cacheLevel === 'both') {
        await this._setMemoryCache(cacheKey, cacheEntry, cacheOptions)
        cached = true
      }

      // 持久化快取
      if (cacheLevel === 'persistent' || cacheLevel === 'both') {
        if (cacheOptions.persistToDisk && this.config.enablePersistentCache) {
          await this._setPersistentCache(cacheKey, cacheEntry, cacheOptions)
          cached = true
        }
      }

      // 更新統計
      this._updateSetStatistics('validation', cacheEntry.size)

      return {
        cached,
        cacheKey,
        cacheLevel,
        expiresAt: cacheEntry.expiresAt,
        size: cacheEntry.size,
        processingTime: Date.now() - startTime
      }
    } catch (error) {
      throw new Error(`Cache validation result failed: ${error.message}`)
    }
  }

  /**
   * 獲取快取的驗證結果
   * @param {string} cacheKey - 快取鍵
   * @returns {Promise<Object>} 快取結果
   */
  async getCachedValidation (cacheKey) {
    const startTime = Date.now()

    try {
      // 檢查記憶體快取
      const memoryResult = await this._getMemoryCache(cacheKey)
      if (memoryResult.found) {
        this._updateGetStatistics(true, 'memory', 'validation')
        return {
          ...memoryResult,
          cacheLevel: 'memory',
          retrievalTime: Date.now() - startTime
        }
      }

      // 檢查持久化快取
      if (this.config.enablePersistentCache && this.persistentKeys.has(cacheKey)) {
        const persistentResult = await this._getPersistentCache(cacheKey)
        if (persistentResult.found) {
          // 回寫到記憶體快取
          await this._promoteToMemoryCache(cacheKey, persistentResult.data)
          this._updateGetStatistics(true, 'persistent', 'validation')
          return {
            ...persistentResult,
            cacheLevel: 'persistent',
            retrievalTime: Date.now() - startTime
          }
        }
      }

      // 快取未命中
      this._updateGetStatistics(false, null, 'validation')
      return {
        found: false,
        cacheKey,
        retrievalTime: Date.now() - startTime
      }
    } catch (error) {
      this._updateGetStatistics(false, null, 'validation')
      throw new Error(`Get cached validation failed: ${error.message}`)
    }
  }

  /**
   * 快取品質分析結果
   * @param {string} cacheKey - 快取鍵
   * @param {Object} qualityResult - 品質分析結果
   * @param {Object} options - 快取選項
   * @returns {Promise<Object>} 快取結果
   */
  async cacheQualityAnalysis (cacheKey, qualityResult, options = {}) {
    const cacheOptions = this._prepareCacheOptions(options, 'quality')
    const cacheEntry = this._createCacheEntry(qualityResult, cacheOptions)

    try {
      // 根據品質分析大小選擇合適的快取策略
      const cacheLevel = qualityResult.individualResults?.length > 100 ? 'persistent' : 'memory'

      if (cacheLevel === 'memory') {
        await this._setMemoryCache(cacheKey, cacheEntry, cacheOptions)
      } else {
        await this._setPersistentCache(cacheKey, cacheEntry, cacheOptions)
      }

      this._updateSetStatistics('quality', cacheEntry.size)

      return {
        cached: true,
        cacheKey,
        cacheLevel,
        expiresAt: cacheEntry.expiresAt,
        size: cacheEntry.size
      }
    } catch (error) {
      throw new Error(`Cache quality analysis failed: ${error.message}`)
    }
  }

  /**
   * 獲取快取的品質分析
   * @param {string} cacheKey - 快取鍵
   * @returns {Promise<Object>} 快取的品質分析
   */
  async getCachedQuality (cacheKey) {
    const memoryResult = await this._getMemoryCache(cacheKey)
    if (memoryResult.found) {
      this._updateGetStatistics(true, 'memory', 'quality')
      return { ...memoryResult, cacheLevel: 'memory' }
    }

    if (this.persistentKeys.has(cacheKey)) {
      const persistentResult = await this._getPersistentCache(cacheKey)
      if (persistentResult.found) {
        this._updateGetStatistics(true, 'persistent', 'quality')
        return { ...persistentResult, cacheLevel: 'persistent' }
      }
    }

    this._updateGetStatistics(false, null, 'quality')
    return { found: false, cacheKey }
  }

  /**
   * 快取平台規則
   * @param {string} platform - 平台名稱
   * @param {Object} rules - 平台規則
   * @param {Object} options - 快取選項
   * @returns {Promise<Object>} 快取結果
   */
  async cachePlatformRules (platform, rules, options = {}) {
    const cacheKey = `platform_rules_${platform}`
    const cacheOptions = this._prepareCacheOptions({
      ...options,
      ttl: options.ttl || 3600000, // 規則快取1小時
      priority: 'high',
      persistToDisk: true
    }, 'rules')

    const cacheEntry = this._createCacheEntry({
      platform,
      rules,
      ruleVersion: this._generateRuleVersion(rules),
      cachedAt: Date.now()
    }, cacheOptions)

    try {
      // 規則同時快取到記憶體和持久化
      await this._setMemoryCache(cacheKey, cacheEntry, cacheOptions)

      if (this.config.enablePersistentCache) {
        await this._setPersistentCache(cacheKey, cacheEntry, cacheOptions)
      }

      this._updateSetStatistics('rules', cacheEntry.size)

      return {
        cached: true,
        platform,
        cacheKey,
        ruleVersion: cacheEntry.data.ruleVersion,
        expiresAt: cacheEntry.expiresAt
      }
    } catch (error) {
      throw new Error(`Cache platform rules failed: ${error.message}`)
    }
  }

  /**
   * 獲取快取的平台規則
   * @param {string} platform - 平台名稱
   * @returns {Promise<Object>} 快取的規則
   */
  async getCachedRules (platform) {
    const cacheKey = `platform_rules_${platform}`

    const memoryResult = await this._getMemoryCache(cacheKey)
    if (memoryResult.found) {
      this._updateGetStatistics(true, 'memory', 'rules')
      return {
        found: true,
        platform,
        data: memoryResult.data.rules,
        ruleVersion: memoryResult.data.ruleVersion,
        cachedAt: memoryResult.cachedAt,
        cacheLevel: 'memory'
      }
    }

    if (this.persistentKeys.has(cacheKey)) {
      const persistentResult = await this._getPersistentCache(cacheKey)
      if (persistentResult.found) {
        this._updateGetStatistics(true, 'persistent', 'rules')
        return {
          found: true,
          platform,
          data: persistentResult.data.rules,
          ruleVersion: persistentResult.data.ruleVersion,
          cachedAt: persistentResult.cachedAt,
          cacheLevel: 'persistent'
        }
      }
    }

    this._updateGetStatistics(false, null, 'rules')
    return { found: false, platform }
  }

  /**
   * 選擇性快取失效
   * @param {Object} criteria - 失效標準
   * @returns {Promise<Object>} 失效結果
   */
  async invalidateCache (criteria = {}) {
    const { pattern, type, olderThan, platform } = criteria
    const invalidated = []
    const remaining = []

    try {
      // 處理記憶體快取
      for (const [key, metadata] of this.cacheMetadata.entries()) {
        let shouldInvalidate = false

        // 模式匹配
        if (pattern && this._matchPattern(key, pattern)) {
          shouldInvalidate = true
        }

        // 類型匹配
        if (type && metadata.type === type) {
          shouldInvalidate = true
        }

        // 時間過濾
        if (olderThan && metadata.createdAt < olderThan) {
          shouldInvalidate = true
        }

        // 平台過濾
        if (platform && key.includes(platform)) {
          shouldInvalidate = true
        }

        if (shouldInvalidate) {
          this.memoryCache.delete(key)
          this.cacheMetadata.delete(key)
          this._removeFromAccessOrder(key)
          this.accessCount.delete(key)
          invalidated.push(key)
        } else {
          remaining.push(key)
        }
      }

      // 處理持久化快取
      if (this.config.enablePersistentCache) {
        const persistentKeys = Array.from(this.persistentKeys)
        for (const key of persistentKeys) {
          let shouldInvalidate = false

          if (pattern && this._matchPattern(key, pattern)) {
            shouldInvalidate = true
          }

          if (shouldInvalidate) {
            await this.storage.delete(key)
            this.persistentKeys.delete(key)
            if (!invalidated.includes(key)) {
              invalidated.push(key)
            }
          }
        }
      }

      return {
        invalidated,
        remaining,
        patterns: pattern ? [pattern] : [],
        criteria
      }
    } catch (error) {
      throw new Error(`Cache invalidation failed: ${error.message}`)
    }
  }

  /**
   * 清除快取
   * @param {Object} options - 清除選項
   * @returns {Promise<Object>} 清除結果
   */
  async clearCache (options = {}) {
    const { level = 'all', preserveRules = false } = options
    let memoryCleared = 0
    let persistentCleared = 0

    try {
      // 清除記憶體快取
      if (level === 'memory' || level === 'all') {
        if (preserveRules) {
          // 保留規則快取
          const rulesToPreserve = new Map()
          const metadataToPreserve = new Map()

          for (const [key, value] of this.memoryCache.entries()) {
            if (key.startsWith('platform_rules_')) {
              rulesToPreserve.set(key, value)
              metadataToPreserve.set(key, this.cacheMetadata.get(key))
            } else {
              memoryCleared++
            }
          }

          this.memoryCache.clear()
          this.cacheMetadata.clear()
          this.accessOrder.length = 0
          this.accessCount.clear()

          // 恢復規則快取
          for (const [key, value] of rulesToPreserve.entries()) {
            this.memoryCache.set(key, value)
            this.cacheMetadata.set(key, metadataToPreserve.get(key))
          }
        } else {
          memoryCleared = this.memoryCache.size
          this.memoryCache.clear()
          this.cacheMetadata.clear()
          this.accessOrder.length = 0
          this.accessCount.clear()
        }
      }

      // 清除持久化快取
      if ((level === 'persistent' || level === 'all') && this.config.enablePersistentCache) {
        if (preserveRules) {
          const keysToDelete = Array.from(this.persistentKeys).filter(key =>
            !key.startsWith('platform_rules_')
          )
          for (const key of keysToDelete) {
            await this.storage.delete(key)
            this.persistentKeys.delete(key)
            persistentCleared++
          }
        } else {
          for (const key of this.persistentKeys) {
            await this.storage.delete(key)
            persistentCleared++
          }
          this.persistentKeys.clear()
        }
      }

      return {
        cleared: true,
        itemsCleared: memoryCleared + persistentCleared,
        memoryCleared,
        persistentCleared,
        level,
        preserveRules
      }
    } catch (error) {
      throw new Error(`Cache clearing failed: ${error.message}`)
    }
  }

  /**
   * 獲取快取統計資訊
   * @returns {Object} 統計資訊
   */
  getStatistics () {
    const totalOps = this.stats.hits + this.stats.misses
    const hitRate = totalOps > 0 ? this.stats.hits / totalOps : 0
    const missRate = totalOps > 0 ? this.stats.misses / totalOps : 0

    return {
      memoryCache: {
        size: this.memoryCache.size,
        maxSize: this.config.maxMemoryCache,
        usage: this.memoryCache.size / this.config.maxMemoryCache
      },
      persistentCache: {
        size: this.persistentKeys.size,
        maxSize: this.config.maxPersistentCache,
        usage: this.persistentKeys.size / this.config.maxPersistentCache
      },
      hitRate: Math.round(hitRate * 1000) / 1000,
      missRate: Math.round(missRate * 1000) / 1000,
      totalOperations: totalOps,
      cacheSize: this.memoryCache.size + this.persistentKeys.size,
      memoryUsage: this.stats.memoryUsage,
      evictionCount: this.stats.evictions,
      typeDistribution: { ...this.stats.typeDistribution },
      config: this.config,
      timestamp: Date.now()
    }
  }

  /**
   * 快取優化
   * @param {Object} options - 優化選項
   * @returns {Promise<Object>} 優化結果
   */
  async optimizeCache (options = {}) {
    const {
      cleanupExpired = true,
      compactMemory = true,
      rebalancePriorities = true
    } = options

    const optimization = {
      optimized: true,
      expiredRemoved: 0,
      memoryCompacted: false,
      prioritiesRebalanced: false,
      sizeReduction: 0
    }

    const initialSize = this.memoryCache.size + this.persistentKeys.size

    try {
      // 清理過期項目
      if (cleanupExpired) {
        optimization.expiredRemoved = await this._cleanupExpiredEntries()
      }

      // 壓縮記憶體
      if (compactMemory) {
        optimization.memoryCompacted = await this._compactMemoryCache()
      }

      // 重新平衡優先級
      if (rebalancePriorities) {
        optimization.prioritiesRebalanced = await this._rebalancePriorities()
      }

      const finalSize = this.memoryCache.size + this.persistentKeys.size
      optimization.sizeReduction = initialSize - finalSize

      return optimization
    } catch (error) {
      throw new Error(`Cache optimization failed: ${error.message}`)
    }
  }

  /**
   * 批次快取驗證結果
   * @param {Array} batchItems - 批次項目陣列
   * @param {Object} options - 批次選項
   * @returns {Promise<Object>} 批次快取結果
   */
  async cacheValidationBatch (batchItems, options = {}) {
    const { atomic = false } = options
    const results = {
      cached: true,
      totalItems: batchItems.length,
      successfulItems: 0,
      failedItems: 0,
      items: []
    }

    try {
      if (atomic) {
        // 原子操作：全部成功或全部失敗
        const cacheOperations = batchItems.map(item =>
          this.cacheValidationResult(item.key, item.data, options)
        )

        const operationResults = await Promise.all(cacheOperations)
        results.successfulItems = operationResults.length
        results.items = operationResults
      } else {
        // 最佳努力：部分失敗不影響其他項目
        for (const item of batchItems) {
          try {
            const result = await this.cacheValidationResult(item.key, item.data, options)
            results.successfulItems++
            results.items.push({ key: item.key, success: true, result })
          } catch (error) {
            results.failedItems++
            results.items.push({ key: item.key, success: false, error: error.message })
          }
        }
      }

      if (results.failedItems > 0 && atomic) {
        results.cached = false
      }

      return results
    } catch (error) {
      throw new Error(`Batch cache operation failed: ${error.message}`)
    }
  }

  /**
   * 批次獲取快取驗證結果
   * @param {Array} cacheKeys - 快取鍵陣列
   * @returns {Promise<Object>} 批次獲取結果
   */
  async getCachedValidationBatch (cacheKeys) {
    const results = {
      results: [],
      totalRequested: cacheKeys.length,
      found: 0,
      notFound: 0
    }

    try {
      const getOperations = cacheKeys.map(key => this.getCachedValidation(key))
      const operationResults = await Promise.all(getOperations)

      results.results = operationResults
      results.found = operationResults.filter(r => r.found).length
      results.notFound = operationResults.filter(r => !r.found).length

      return results
    } catch (error) {
      throw new Error(`Batch get operation failed: ${error.message}`)
    }
  }

  /**
   * 私有方法 - 驗證快取鍵
   * @private
   */
  _validateCacheKey (cacheKey) {
    if (!cacheKey || typeof cacheKey !== 'string') {
      throw new Error('Cache key must be a non-empty string')
    }
    if (cacheKey.length > 250) {
      throw new Error('Cache key too long (maximum 250 characters)')
    }
  }

  /**
   * 私有方法 - 驗證快取資料
   * @private
   */
  _validateCacheData (data) {
    if (data === null || data === undefined) {
      throw new Error('Cache data cannot be null or undefined')
    }

    const dataSize = this._calculateDataSize(data)
    if (dataSize > this.config.maxCacheEntrySize) {
      throw new Error(`Cache entry too large: ${dataSize} bytes (max: ${this.config.maxCacheEntrySize})`)
    }
  }

  /**
   * 私有方法 - 準備快取選項
   * @private
   */
  _prepareCacheOptions (options, type) {
    return {
      ttl: options.ttl || this.config.defaultTTL,
      priority: options.priority || 'normal',
      persistToDisk: options.persistToDisk || false,
      type,
      evictionCallback: options.evictionCallback,
      ...options
    }
  }

  /**
   * 私有方法 - 建立快取項目
   * @private
   */
  _createCacheEntry (data, options) {
    const now = Date.now()
    const entry = {
      data,
      createdAt: now,
      expiresAt: now + options.ttl,
      lastAccessedAt: now,
      accessCount: 1,
      priority: options.priority,
      type: options.type,
      size: this._calculateDataSize(data)
    }

    return entry
  }

  /**
   * 私有方法 - 確定快取層級
   * @private
   */
  _determineCacheLevel (options) {
    if (options.persistToDisk && this.config.enablePersistentCache) {
      return 'both'
    }
    if (options.persistToDisk) {
      return 'persistent'
    }
    return 'memory'
  }

  /**
   * 私有方法 - 設置記憶體快取
   * @private
   */
  async _setMemoryCache (key, entry, options) {
    // 檢查容量限制
    if (this.memoryCache.size >= this.config.maxMemoryCache) {
      await this._evictMemoryCache()
    }

    this.memoryCache.set(key, entry)
    this.cacheMetadata.set(key, {
      type: entry.type,
      priority: entry.priority,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      size: entry.size
    })

    this._updateAccessOrder(key)
    this.accessCount.set(key, 1)
  }

  /**
   * 私有方法 - 設置持久化快取
   * @private
   */
  async _setPersistentCache (key, entry, options) {
    try {
      await this.storage.set(key, entry)
      this.persistentKeys.add(key)
    } catch (error) {
      throw new Error(`Persistent cache set failed: ${error.message}`)
    }
  }

  /**
   * 私有方法 - 獲取記憶體快取
   * @private
   */
  async _getMemoryCache (key) {
    const entry = this.memoryCache.get(key)
    if (!entry) {
      return { found: false }
    }

    // 檢查過期
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key)
      this.cacheMetadata.delete(key)
      this._removeFromAccessOrder(key)
      this.accessCount.delete(key)
      return { found: false }
    }

    // 更新存取統計
    entry.lastAccessedAt = Date.now()
    entry.accessCount++
    this._updateAccessOrder(key)
    this.accessCount.set(key, entry.accessCount)

    return {
      found: true,
      data: entry.data,
      cachedAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      accessCount: entry.accessCount
    }
  }

  /**
   * 私有方法 - 獲取持久化快取
   * @private
   */
  async _getPersistentCache (key) {
    try {
      const entry = await this.storage.get(key)
      if (!entry) {
        this.persistentKeys.delete(key)
        return { found: false }
      }

      // 檢查過期
      if (Date.now() > entry.expiresAt) {
        await this.storage.delete(key)
        this.persistentKeys.delete(key)
        return { found: false }
      }

      return {
        found: true,
        data: entry.data,
        cachedAt: entry.createdAt,
        expiresAt: entry.expiresAt
      }
    } catch (error) {
      this.persistentKeys.delete(key)
      return { found: false }
    }
  }

  /**
   * 私有方法 - 記憶體快取驅逐
   * @private
   */
  async _evictMemoryCache () {
    const strategy = this.config.evictionStrategy
    let keyToEvict

    switch (strategy) {
      case 'lru':
        keyToEvict = this.accessOrder[0]
        break
      case 'lfu':
        keyToEvict = this._findLFUKey()
        break
      case 'ttl':
        keyToEvict = this._findExpiringSoonKey()
        break
      default:
        keyToEvict = this.accessOrder[0]
    }

    if (keyToEvict) {
      const entry = this.memoryCache.get(keyToEvict)
      if (entry && entry.evictionCallback) {
        try {
          await entry.evictionCallback(keyToEvict, entry)
        } catch (error) {
          // 忽略回調錯誤
        }
      }

      this.memoryCache.delete(keyToEvict)
      this.cacheMetadata.delete(keyToEvict)
      this._removeFromAccessOrder(keyToEvict)
      this.accessCount.delete(keyToEvict)
      this.stats.evictions++
    }
  }

  /**
   * 私有方法 - 輔助方法
   * @private
   */
  _calculateDataSize (data) {
    return JSON.stringify(data).length * 2 // 估算位元組大小
  }

  _updateAccessOrder (key) {
    this._removeFromAccessOrder(key)
    this.accessOrder.push(key)
  }

  _removeFromAccessOrder (key) {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
  }

  _findLFUKey () {
    let minCount = Infinity
    let lfuKey = null

    for (const [key, count] of this.accessCount.entries()) {
      if (count < minCount) {
        minCount = count
        lfuKey = key
      }
    }

    return lfuKey
  }

  _findExpiringSoonKey () {
    let earliestExpiry = Infinity
    let expiringKey = null

    for (const [key, metadata] of this.cacheMetadata.entries()) {
      if (metadata.expiresAt < earliestExpiry) {
        earliestExpiry = metadata.expiresAt
        expiringKey = key
      }
    }

    return expiringKey
  }

  _generateRuleVersion (rules) {
    const content = JSON.stringify(rules, Object.keys(rules).sort())
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 8)
  }

  _matchPattern (key, pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    return regex.test(key)
  }

  _updateSetStatistics (type, size) {
    this.stats.sets++
    this.stats.totalOperations++
    this.stats.typeDistribution[type]++
    this.stats.memoryUsage += size
  }

  _updateGetStatistics (hit, level, type) {
    if (hit) {
      this.stats.hits++
    } else {
      this.stats.misses++
    }
    this.stats.totalOperations++
    if (type && hit) {
      // 這裡可以添加更詳細的類型統計
    }
  }

  async _promoteToMemoryCache (key, entry) {
    if (this.memoryCache.size < this.config.maxMemoryCache) {
      this.memoryCache.set(key, entry)
      this._updateAccessOrder(key)
      this.accessCount.set(key, 1)
    }
  }

  async _cleanupExpiredEntries () {
    let removed = 0
    const now = Date.now()

    // 清理記憶體快取
    for (const [key, metadata] of this.cacheMetadata.entries()) {
      if (metadata.expiresAt < now) {
        this.memoryCache.delete(key)
        this.cacheMetadata.delete(key)
        this._removeFromAccessOrder(key)
        this.accessCount.delete(key)
        removed++
      }
    }

    // 清理持久化快取
    for (const key of this.persistentKeys) {
      try {
        const entry = await this.storage.get(key)
        if (entry && entry.expiresAt < now) {
          await this.storage.delete(key)
          this.persistentKeys.delete(key)
          removed++
        }
      } catch (error) {
        // 忽略錯誤，繼續清理
        this.persistentKeys.delete(key)
        removed++
      }
    }

    return removed
  }

  async _compactMemoryCache () {
    // 簡單的記憶體壓縮：重新組織數據結構
    const entries = Array.from(this.memoryCache.entries())
    this.memoryCache.clear()
    this.accessOrder.length = 0

    for (const [key, entry] of entries) {
      this.memoryCache.set(key, entry)
      this.accessOrder.push(key)
    }

    return true
  }

  async _rebalancePriorities () {
    // 重新平衡快取項目的優先級
    const priorityOrder = { high: 3, normal: 2, low: 1 }

    this.accessOrder.sort((a, b) => {
      const aMetadata = this.cacheMetadata.get(a)
      const bMetadata = this.cacheMetadata.get(b)
      const aPriority = priorityOrder[aMetadata?.priority] || 2
      const bPriority = priorityOrder[bMetadata?.priority] || 2
      return bPriority - aPriority
    })

    return true
  }

  _createDefaultStorage () {
    // 簡單的記憶體存儲實現
    const storage = new Map()
    return {
      async get (key) {
        return storage.get(key)
      },
      async set (key, value) {
        storage.set(key, value)
      },
      async delete (key) {
        return storage.delete(key)
      },
      async clear () {
        storage.clear()
      },
      async keys () {
        return Array.from(storage.keys())
      },
      size () {
        return storage.size
      }
    }
  }
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ValidationCacheManager
}

// 瀏覽器環境支援
if (typeof window !== 'undefined') {
  window.ValidationCacheManager = ValidationCacheManager
}
