/**
 * SearchCacheManager - 搜尋快取管理器
 * TDD 循環 3/8 - BookSearchFilter 職責拆分重構
 *
 * 負責功能：
 * - 搜尋結果快取管理
 * - LRU (Least Recently Used) 快取策略
 * - 快取大小限制和清理
 * - 快取命中率統計
 * - 快取失效機制
 *
 * 設計考量：
 * - 單一職責：專注於快取管理，不處理搜尋邏輯
 * - LRU 策略：自動清理最少使用的快取項目
 * - 事件驅動：快取操作時發送事件
 * - 統計監控：提供詳細的快取統計資料
 * - 錯誤處理：健壯的邊界條件處理
 *
 * 處理流程：
 * 1. 驗證和正規化快取鍵
 * 2. 檢查快取大小限制
 * 3. 執行 LRU 管理
 * 4. 更新統計資料
 * 5. 發送相關事件
 *
 * @version 1.0.0
 * @since 2025-08-20
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

class SearchCacheManager {
  /**
   * 建構 SearchCacheManager 實例
   *
   * @param {Object} options - 配置選項
   * @param {Object} options.eventBus - 事件總線實例
   * @param {Object} options.logger - 日誌記錄器實例
   * @param {Object} options.config - 自定義配置
   */
  constructor (options = {}) {
    const { eventBus, logger, config = {} } = options

    if (!eventBus || !logger) {
      const error = new Error('EventBus 和 Logger 是必需的')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'ui' }
      throw error
    }

    this.eventBus = eventBus
    this.logger = logger

    // 合併預設配置和自定義配置
    this.config = {
      maxCacheSize: 100,
      cleanupThreshold: 0.7,
      enableStatistics: true,
      enableEvents: true,
      keyNormalization: true,
      ...config
    }

    // 初始化快取存儲 (Map 保持插入順序，便於 LRU 實作)
    this.cache = new Map()

    // 初始化統計資料
    this._initializeStatistics()
  }

  /**
   * 初始化統計資料
   * @private
   */
  _initializeStatistics () {
    this.statistics = {
      totalHits: 0,
      totalMisses: 0,
      totalSets: 0,
      totalClears: 0,
      hitRate: 0,
      currentSize: 0,
      maxSize: this.config.maxCacheSize
    }
  }

  /**
   * 正規化快取鍵
   *
   * @param {string} key - 原始鍵
   * @returns {string} 正規化後的鍵
   */
  normalizeKey (key) {
    if (typeof key !== 'string') {
      const error = new Error('快取鍵必須是字串')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'ui' }
      throw error
    }

    if (!this.config.keyNormalization) {
      return key
    }

    return key.toLowerCase().trim().replace(/\s+/g, ' ')
  }

  /**
   * 檢查快取是否包含指定鍵
   *
   * @param {string} key - 快取鍵
   * @returns {boolean} 是否存在
   */
  has (key) {
    const normalizedKey = this.normalizeKey(key)
    return this.cache.has(normalizedKey)
  }

  /**
   * 從快取中取得值
   *
   * @param {string} key - 快取鍵
   * @returns {*} 快取值或 null
   */
  get (key) {
    const normalizedKey = this.normalizeKey(key)

    if (this.cache.has(normalizedKey)) {
      // 更新 LRU：將項目移到最後（最新）
      const value = this.cache.get(normalizedKey)
      this.cache.delete(normalizedKey)
      this.cache.set(normalizedKey, value)

      // 更新統計
      this.statistics.totalHits++
      this._updateHitRate()

      // 發送事件
      if (this.config.enableEvents) {
        this.eventBus.emit('CACHE.HIT', {
          key: normalizedKey,
          size: Array.isArray(value) ? value.length : 1,
          timestamp: Date.now()
        })
      }

      return value
    } else {
      // 更新統計
      this.statistics.totalMisses++
      this._updateHitRate()

      // 發送事件
      if (this.config.enableEvents) {
        this.eventBus.emit('CACHE.MISS', {
          key: normalizedKey,
          timestamp: Date.now()
        })
      }

      return null
    }
  }

  /**
   * 設定快取值
   *
   * @param {string} key - 快取鍵
   * @param {*} value - 快取值
   */
  set (key, value) {
    const normalizedKey = this.normalizeKey(key)

    // 如果鍵已存在，先刪除（LRU 更新）
    if (this.cache.has(normalizedKey)) {
      this.cache.delete(normalizedKey)
    } else {
      // 檢查快取大小限制（為新項目預留空間）
      if (this.cache.size >= this.config.maxCacheSize) {
        // 如果設定了自定義的 cleanupThreshold，使用批次清理
        // 否則使用簡單的 LRU 清理（只移除一個項目）
        if (this.config.cleanupThreshold !== 0.7) { // 0.7 是預設值
          this._performCleanup(true)
        } else {
          this._performLRUCleanup()
        }
      }
    }

    // 設定新值（會被放在 Map 的最後，即最新位置）
    this.cache.set(normalizedKey, value)

    // 更新統計
    this.statistics.totalSets++
    this.statistics.currentSize = this.cache.size

    // 發送事件
    if (this.config.enableEvents) {
      this.eventBus.emit('CACHE.SET', {
        key: normalizedKey,
        size: Array.isArray(value) ? value.length : 1,
        cacheSize: this.cache.size,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 刪除快取項目
   *
   * @param {string} key - 快取鍵
   * @returns {boolean} 是否成功刪除
   */
  delete (key) {
    const normalizedKey = this.normalizeKey(key)
    const deleted = this.cache.delete(normalizedKey)

    if (deleted) {
      this.statistics.currentSize = this.cache.size
    }

    return deleted
  }

  /**
   * 取得快取大小
   *
   * @returns {number} 快取項目數量
   */
  size () {
    return this.cache.size
  }

  /**
   * 清空所有快取
   */
  clear () {
    const clearedCount = this.cache.size
    this.cache.clear()

    // 更新統計
    this.statistics.totalClears++
    this.statistics.currentSize = 0

    // 發送事件
    if (this.config.enableEvents) {
      this.eventBus.emit('CACHE.CLEAR', {
        clearedCount,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 手動執行快取清理
   */
  cleanup () {
    this._performCleanup(false) // 手動清理不預留空間
  }

  /**
   * 執行 LRU 清理（只移除一個最舊項目）
   * @private
   */
  _performLRUCleanup () {
    if (this.cache.size === 0) {
      return
    }

    // 移除最舊的項目（Map 迭代器的第一個元素）
    const oldestKey = this.cache.keys().next().value
    if (oldestKey !== undefined) {
      this.cache.delete(oldestKey)
      this.statistics.currentSize = this.cache.size

      // 發送事件
      if (this.config.enableEvents) {
        this.eventBus.emit('CACHE.CLEANUP', {
          removedCount: 1,
          remainingSize: this.cache.size,
          timestamp: Date.now()
        })
      }

      this.logger.debug('LRU 清理完成', {
        removedKey: oldestKey,
        remainingSize: this.cache.size
      })
    }
  }

  /**
   * 執行快取清理（LRU 策略）
   * @private
   * @param {boolean} reserveSpace - 是否為新項目預留空間
   */
  _performCleanup (reserveSpace = true) {
    const currentSize = this.cache.size
    const targetSize = Math.floor(this.config.maxCacheSize * this.config.cleanupThreshold)
    const removeCount = reserveSpace
      ? currentSize - targetSize + 1 // 自動清理：為新項目預留空間
      : currentSize - targetSize // 手動清理：不預留空間

    if (removeCount <= 0) {
      return
    }

    // Map 的迭代順序是插入順序，最早的項目會先被取得
    const keysToRemove = []
    const iterator = this.cache.keys()

    for (let i = 0; i < removeCount; i++) {
      const result = iterator.next()
      if (!result.done) {
        keysToRemove.push(result.value)
      } else {
        break
      }
    }

    // 移除最舊的項目
    keysToRemove.forEach(key => {
      this.cache.delete(key)
    })

    // 更新統計
    this.statistics.currentSize = this.cache.size

    // 發送事件
    if (this.config.enableEvents) {
      this.eventBus.emit('CACHE.CLEANUP', {
        removedCount: keysToRemove.length,
        remainingSize: this.cache.size,
        timestamp: Date.now()
      })
    }

    this.logger.debug('快取清理完成', {
      removedCount: keysToRemove.length,
      remainingSize: this.cache.size
    })
  }

  /**
   * 更新命中率
   * @private
   */
  _updateHitRate () {
    const totalAccess = this.statistics.totalHits + this.statistics.totalMisses
    this.statistics.hitRate = totalAccess > 0 ? this.statistics.totalHits / totalAccess : 0
  }

  /**
   * 取得快取統計資料
   *
   * @returns {Object} 統計資料
   */
  getStatistics () {
    return {
      ...this.statistics,
      currentSize: this.cache.size
    }
  }

  /**
   * 重置統計資料
   */
  resetStatistics () {
    this._initializeStatistics()
    this.statistics.currentSize = this.cache.size
  }

  /**
   * 銷毀快取管理器
   */
  destroy () {
    this.clear()
    this.resetStatistics()
  }
}

module.exports = SearchCacheManager
