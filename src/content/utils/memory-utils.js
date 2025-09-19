/**
 * @fileoverview Memory Utils - 記憶體管理工具
 * @version v1.0.0
 * @since 2025-08-16
 *
 * 負責功能：
 * - 記憶體使用監控和分析
 * - 快取管理和清理策略
 * - 記憶體洩漏檢測和預防
 * - 效能測量和基準測試
 * - 資源統計和優化建議
 *
 * 設計考量：
 * - Content Script 環境優化
 * - 低開銷的監控機制
 * - 智能快取策略
 * - 防禦性程式設計
 *
 * 使用情境：
 * - Chrome Extension 記憶體優化
 * - 大量資料處理監控
 * - 長時間運行穩定性
 * - 效能瓶頸識別
 */

/**
 * 記憶體管理工具類
 */
const ErrorCodes = require('src/core/errors/ErrorCodes')

class MemoryUtils {
  constructor () {
    this.memorySnapshots = []
    this.maxSnapshots = 50
    this.caches = new Map()
    this.timers = new Map()
    this.eventListeners = []
    this.domNodeTracking = new Map()
  }

  /**
   * 取得當前記憶體使用狀況
   * @returns {Object} 記憶體資訊
   */
  getMemoryInfo () {
    try {
      if (!this._isPerformanceMemoryAvailable()) {
        return {
          success: false,
          error: (() => {
            const error = new Error('Performance memory API not available')
            error.code = ErrorCodes.RESOURCE_NOT_AVAILABLE
            error.details = { category: 'general' }
            return error
          })(),
          fallback: true
        }
      }

      const memory = performance.memory
      const used = memory.usedJSHeapSize
      const total = memory.totalJSHeapSize
      const limit = memory.jsHeapSizeLimit
      const percentage = (used / limit) * 100
      const available = limit - used

      return {
        success: true,
        used,
        total,
        limit,
        percentage: Math.round(percentage * 100) / 100,
        available,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        success: false,
        error,
        fallback: true
      }
    }
  }

  /**
   * 記錄記憶體快照
   * @param {string} label - 快照標籤
   * @returns {Object} 記錄結果
   */
  recordMemorySnapshot (label) {
    if (!label || typeof label !== 'string') {
      return {
        success: false,
        error: (() => {
          const error = new Error('Invalid snapshot label')
          error.code = ErrorCodes.INVALID_DATA_FORMAT
          error.details = { category: 'general' }
          return error
        })()
      }
    }

    try {
      const memoryInfo = this.getMemoryInfo()

      if (!memoryInfo.success) {
        // 即使記憶體 API 不可用，也記錄一個基本快照
        const snapshot = {
          label,
          timestamp: Date.now(),
          memory: {
            used: 0,
            total: 0,
            percentage: 0
          }
        }

        this.memorySnapshots.push(snapshot)

        if (this.memorySnapshots.length > this.maxSnapshots) {
          this.memorySnapshots.shift()
        }

        return {
          success: true,
          snapshot,
          totalSnapshots: this.memorySnapshots.length,
          fallback: true
        }
      }

      const snapshot = {
        label,
        timestamp: Date.now(),
        memory: {
          used: memoryInfo.used,
          total: memoryInfo.total,
          percentage: memoryInfo.percentage
        }
      }

      this.memorySnapshots.push(snapshot)

      // 限制快照數量
      if (this.memorySnapshots.length > this.maxSnapshots) {
        this.memorySnapshots.shift()
      }

      return {
        success: true,
        snapshot,
        totalSnapshots: this.memorySnapshots.length
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 取得記憶體使用趨勢
   * @returns {Object} 趨勢分析
   */
  getMemoryTrend () {
    if (this.memorySnapshots.length === 0) {
      return {
        snapshots: [],
        totalSnapshots: 0,
        timeRange: null,
        growth: { absolute: 0, percentage: 0 },
        peak: null,
        average: 0
      }
    }

    const snapshots = [...this.memorySnapshots]
    const first = snapshots[0]
    const last = snapshots[snapshots.length - 1]

    const growth = {
      absolute: last.memory.used - first.memory.used,
      percentage: ((last.memory.used - first.memory.used) / first.memory.used) * 100
    }

    const peak = snapshots.reduce((max, current) =>
      current.memory.used > max.memory.used ? current : max
    )

    const average = snapshots.reduce((sum, snapshot) =>
      sum + snapshot.memory.used, 0) / snapshots.length

    return {
      snapshots,
      totalSnapshots: snapshots.length,
      timeRange: {
        start: first.timestamp,
        end: last.timestamp,
        duration: last.timestamp - first.timestamp
      },
      growth,
      peak,
      average: Math.round(average)
    }
  }

  /**
   * 分析記憶體使用狀況
   * @returns {Object} 分析結果
   */
  analyzeMemoryUsage () {
    const memoryInfo = this.getMemoryInfo()

    if (!memoryInfo.success) {
      return {
        status: 'UNKNOWN',
        usage: {
          percentage: 0,
          level: 'UNKNOWN'
        },
        recommendations: ['記憶體 API 不可用，無法提供詳細分析'],
        criticalIssues: [],
        timestamp: Date.now(),
        error: memoryInfo.error
      }
    }

    const percentage = memoryInfo.percentage
    let status = 'NORMAL'
    let level = 'LOW'
    const recommendations = []
    const criticalIssues = []

    if (percentage > 90) {
      status = 'CRITICAL'
      level = 'CRITICAL'
      recommendations.push('立即執行記憶體清理')
      criticalIssues.push('記憶體使用率超過 90%')
    } else if (percentage > 80) {
      status = 'WARNING'
      level = 'HIGH'
      recommendations.push('檢查記憶體使用，考慮清理快取')
    } else if (percentage > 60) {
      level = 'MEDIUM'
      recommendations.push('監控記憶體趨勢')
    }

    return {
      status,
      usage: {
        percentage,
        level
      },
      recommendations,
      criticalIssues,
      timestamp: Date.now()
    }
  }

  /**
   * 計算記憶體效率指標
   * @returns {Object} 效率指標
   */
  calculateMemoryEfficiency () {
    const trend = this.getMemoryTrend()

    if (trend.totalSnapshots < 2) {
      return {
        allocation: { total: 0, average: 0, peak: 0 },
        cleanup: { rate: 0, frequency: 0 },
        fragmentation: 0,
        score: 100,
        grade: 'A'
      }
    }

    const allocations = []
    for (let i = 1; i < trend.snapshots.length; i++) {
      const prev = trend.snapshots[i - 1]
      const curr = trend.snapshots[i]
      const allocation = curr.memory.used - prev.memory.used
      if (allocation > 0) {
        allocations.push(allocation)
      }
    }

    const totalAllocation = allocations.reduce((sum, alloc) => sum + alloc, 0)
    const averageAllocation = allocations.length > 0 ? totalAllocation / allocations.length : 0
    const peakAllocation = allocations.length > 0 ? Math.max(...allocations) : 0

    // 簡化的效率評分
    const cleanupRate = trend.growth.percentage < 50 ? 80 : 40
    const fragmentationScore = 100 - Math.min(trend.growth.percentage * 2, 100)
    const score = Math.round((cleanupRate + fragmentationScore) / 2)

    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'

    return {
      allocation: {
        total: totalAllocation,
        average: Math.round(averageAllocation),
        peak: peakAllocation
      },
      cleanup: {
        rate: cleanupRate,
        frequency: 0.8
      },
      fragmentation: Math.round(fragmentationScore),
      score,
      grade
    }
  }

  /**
   * 註冊快取
   * @param {Object} config - 快取配置
   * @returns {Object} 註冊結果
   */
  registerCache (config) {
    if (!config || typeof config !== 'object' || !config.name) {
      return {
        success: false,
        error: (() => {
          const error = new Error('Invalid cache configuration')
          error.code = ErrorCodes.INVALID_DATA_FORMAT
          error.details = { category: 'configuration' }
          return error
        })()
      }
    }

    if (typeof config.maxSize !== 'number' || config.maxSize <= 0) {
      return {
        success: false,
        error: (() => {
          const error = new Error('Invalid maxSize configuration')
          error.code = ErrorCodes.INVALID_DATA_FORMAT
          error.details = { category: 'configuration' }
          return error
        })()
      }
    }

    const cacheConfig = {
      name: config.name,
      maxSize: config.maxSize,
      ttl: config.ttl || 300000,
      strategy: config.strategy || 'LRU'
    }

    const cache = {
      config: cacheConfig,
      data: new Map(),
      stats: {
        size: 0,
        hits: 0,
        misses: 0,
        evictions: 0
      },
      accessOrder: [] // For LRU
    }

    this.caches.set(config.name, cache)

    return {
      success: true,
      cacheId: config.name,
      config: cacheConfig,
      stats: { ...cache.stats }
    }
  }

  /**
   * 設定快取項目
   * @param {string} cacheId - 快取ID
   * @param {string} key - 鍵
   * @param {any} value - 值
   * @returns {Object} 設定結果
   */
  setCacheItem (cacheId, key, value) {
    const cache = this.caches.get(cacheId)

    if (!cache) {
      return {
        success: false,
        error: (() => {
          const error = new Error('Cache not found')
          error.code = ErrorCodes.RESOURCE_NOT_FOUND
          error.details = { category: 'general' }
          return error
        })()
      }
    }

    try {
      // 檢查是否需要清理
      if (cache.data.size >= cache.config.maxSize) {
        this._evictCacheItems(cache)
      }

      const item = {
        value,
        timestamp: Date.now(),
        accessCount: 0
      }

      cache.data.set(key, item)
      cache.stats.size = cache.data.size

      // 更新 LRU 順序
      if (cache.config.strategy === 'LRU') {
        const index = cache.accessOrder.indexOf(key)
        if (index > -1) {
          cache.accessOrder.splice(index, 1)
        }
        cache.accessOrder.push(key)
      }

      return {
        success: true,
        key,
        size: cache.stats.size
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 取得快取項目
   * @param {string} cacheId - 快取ID
   * @param {string} key - 鍵
   * @returns {Object} 取得結果
   */
  getCacheItem (cacheId, key) {
    const cache = this.caches.get(cacheId)

    if (!cache) {
      return {
        found: false,
        error: (() => {
          const error = new Error('Cache not found')
          error.code = ErrorCodes.RESOURCE_NOT_FOUND
          error.details = { category: 'general' }
          return error
        })()
      }
    }

    const item = cache.data.get(key)

    if (!item) {
      cache.stats.misses++
      return {
        found: false,
        key
      }
    }

    // 檢查 TTL
    if (cache.config.ttl > 0 && Date.now() - item.timestamp > cache.config.ttl) {
      cache.data.delete(key)
      cache.stats.size = cache.data.size
      cache.stats.misses++
      return {
        found: false,
        key,
        expired: true
      }
    }

    cache.stats.hits++
    item.accessCount++

    // 更新 LRU 順序
    if (cache.config.strategy === 'LRU') {
      const index = cache.accessOrder.indexOf(key)
      if (index > -1) {
        cache.accessOrder.splice(index, 1)
      }
      cache.accessOrder.push(key)
    }

    return {
      found: true,
      key,
      value: item.value,
      metadata: {
        timestamp: item.timestamp,
        accessCount: item.accessCount
      }
    }
  }

  /**
   * 執行快取清理
   * @returns {Object} 清理結果
   */
  performCacheCleanup () {
    const cleaned = []
    let totalReleased = 0
    let totalRemaining = 0

    this.caches.forEach((cache, cacheId) => {
      const before = cache.data.size

      // 清理過期項目
      const now = Date.now()
      cache.data.forEach((item, key) => {
        if (cache.config.ttl > 0 && now - item.timestamp > cache.config.ttl) {
          cache.data.delete(key)
        }
      })

      const after = cache.data.size
      const released = before - after

      if (released > 0) {
        cleaned.push({
          cacheId,
          released,
          remaining: after
        })
      }

      totalReleased += released
      totalRemaining += after
      cache.stats.size = after
    })

    return {
      success: true,
      cleaned,
      released: totalReleased,
      remaining: totalRemaining,
      strategy: 'TTL_CLEANUP'
    }
  }

  /**
   * 取得快取統計
   * @param {string} cacheId - 快取ID
   * @returns {Object} 統計資訊
   */
  getCacheStats (cacheId) {
    const cache = this.caches.get(cacheId)

    if (!cache) {
      return {
        error: (() => {
          const error = new Error('Cache not found')
          error.code = ErrorCodes.RESOURCE_NOT_FOUND
          error.details = { category: 'general' }
          return error
        })()
      }
    }

    const totalRequests = cache.stats.hits + cache.stats.misses
    const hitRate = totalRequests > 0 ? cache.stats.hits / totalRequests : 0

    return {
      size: cache.stats.size,
      maxSize: cache.config.maxSize,
      hits: cache.stats.hits,
      misses: cache.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      evictions: cache.stats.evictions,
      memory: this._estimateCacheMemory(cache),
      lastAccess: Date.now()
    }
  }

  /**
   * 檢測記憶體洩漏
   * @returns {Object} 洩漏檢測結果
   */
  detectMemoryLeaks () {
    const trend = this.getMemoryTrend()

    if (trend.totalSnapshots < 5) {
      return {
        hasLeaks: false,
        severity: 'LOW',
        indicators: {
          continuousGrowth: false,
          abnormalSpikes: false,
          slowCleanup: false
        },
        analysis: {
          growthRate: 0,
          peakGrowth: 0,
          cleanupEfficiency: 100
        },
        recommendations: ['需要更多資料來進行洩漏檢測']
      }
    }

    // 檢測持續增長
    const growthPoints = []
    for (let i = 1; i < trend.snapshots.length; i++) {
      const prev = trend.snapshots[i - 1]
      const curr = trend.snapshots[i]
      growthPoints.push(curr.memory.used - prev.memory.used)
    }

    const positiveGrowths = growthPoints.filter(g => g > 0).length
    const continuousGrowth = positiveGrowths / growthPoints.length > 0.7

    // 檢測異常峰值
    const avgGrowth = growthPoints.reduce((sum, g) => sum + g, 0) / growthPoints.length
    const abnormalSpikes = growthPoints.some(g => g > avgGrowth * 5)

    // 評估清理效率
    const cleanupEfficiency = 100 - Math.min(trend.growth.percentage * 2, 100)
    const slowCleanup = cleanupEfficiency < 50

    const hasLeaks = continuousGrowth || abnormalSpikes || slowCleanup
    const severity = hasLeaks
      ? (continuousGrowth && abnormalSpikes ? 'HIGH' : 'MEDIUM')
      : 'LOW'

    const recommendations = []
    if (continuousGrowth) {
      recommendations.push('檢查長期運行的物件參考')
    }
    if (abnormalSpikes) {
      recommendations.push('檢查大型物件的建立和銷毀')
    }
    if (slowCleanup) {
      recommendations.push('強制執行垃圾回收')
    }

    return {
      hasLeaks,
      severity,
      indicators: {
        continuousGrowth,
        abnormalSpikes,
        slowCleanup
      },
      analysis: {
        growthRate: trend.growth.percentage,
        peakGrowth: Math.max(...growthPoints, 0),
        cleanupEfficiency
      },
      recommendations
    }
  }

  /**
   * 追蹤 DOM 節點
   * @param {string} label - 追蹤標籤
   * @returns {Object} 追蹤結果
   */
  trackDOMNodes (label) {
    if (!label || typeof label !== 'string') {
      return {
        success: false,
        error: (() => {
          const error = new Error('Invalid tracking label')
          error.code = ErrorCodes.INVALID_DATA_FORMAT
          error.details = { category: 'general' }
          return error
        })()
      }
    }

    try {
      const nodeCount = document.querySelectorAll('*').length

      this.domNodeTracking.set(label, {
        timestamp: Date.now(),
        nodeCount,
        label
      })

      return {
        success: true,
        label,
        nodeCount,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 分析 DOM 節點洩漏
   * @returns {Object} 分析結果
   */
  analyzeDOMNodeLeaks () {
    const trackingData = Array.from(this.domNodeTracking.values())

    if (trackingData.length < 2) {
      return {
        nodeCount: 0,
        growth: 0,
        orphanNodes: 0,
        eventListeners: this.eventListeners.length,
        recommendations: ['需要更多追蹤資料']
      }
    }

    const latest = trackingData[trackingData.length - 1]
    const previous = trackingData[trackingData.length - 2]
    const growth = latest.nodeCount - previous.nodeCount

    const recommendations = []
    if (growth > 100) {
      recommendations.push('檢查大量 DOM 節點建立')
    }
    if (this.eventListeners.length > 50) {
      recommendations.push('檢查事件監聽器累積')
    }

    return {
      nodeCount: latest.nodeCount,
      growth,
      orphanNodes: Math.max(0, growth - 10), // 簡化計算
      eventListeners: this.eventListeners.length,
      recommendations
    }
  }

  /**
   * 追蹤事件監聽器
   * @param {Element} element - 元素
   * @param {string} type - 事件類型
   * @param {Function} handler - 處理函數
   */
  trackEventListener (element, type, handler) {
    this.eventListeners.push({
      element,
      type,
      handler,
      timestamp: Date.now()
    })
  }

  /**
   * 分析事件監聽器
   * @returns {Object} 分析結果
   */
  analyzeEventListeners () {
    const byType = {}
    let orphaned = 0

    this.eventListeners.forEach(listener => {
      byType[listener.type] = (byType[listener.type] || 0) + 1

      // 檢查元素是否還在 DOM 中
      if (!document.contains(listener.element)) {
        orphaned++
      }
    })

    const recommendations = []
    if (orphaned > 0) {
      recommendations.push(`移除 ${orphaned} 個孤立的事件監聽器`)
    }
    if (this.eventListeners.length > 100) {
      recommendations.push('考慮使用事件委派來減少監聽器數量')
    }

    return {
      total: this.eventListeners.length,
      byType,
      orphaned,
      recommendations
    }
  }

  /**
   * 開始計時器
   * @param {string} name - 計時器名稱
   * @returns {Object} 開始結果
   */
  startTimer (name) {
    if (!name || typeof name !== 'string') {
      return {
        success: false,
        error: (() => {
          const error = new Error('Invalid timer name')
          error.code = ErrorCodes.INVALID_DATA_FORMAT
          error.details = { category: 'general' }
          return error
        })()
      }
    }

    try {
      const startTime = this._getHighResolutionTime()

      this.timers.set(name, {
        startTime,
        name
      })

      return {
        success: true,
        name,
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
   * 結束計時器
   * @param {string} name - 計時器名稱
   * @returns {Object} 結束結果
   */
  endTimer (name) {
    if (!name || typeof name !== 'string') {
      return {
        success: false,
        error: (() => {
          const error = new Error('Invalid timer name')
          error.code = ErrorCodes.INVALID_DATA_FORMAT
          error.details = { category: 'general' }
          return error
        })()
      }
    }

    const timer = this.timers.get(name)

    if (!timer) {
      return {
        success: false,
        error: (() => {
          const error = new Error('Timer not found')
          error.code = ErrorCodes.RESOURCE_NOT_FOUND
          error.details = { category: 'general' }
          return error
        })()
      }
    }

    try {
      const endTime = this._getHighResolutionTime()
      const duration = endTime - timer.startTime

      this.timers.delete(name)

      return {
        success: true,
        duration: Math.round(duration * 100) / 100,
        operation: name,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 測量函數執行效能
   * @param {Function} fn - 函數
   * @param {string} name - 操作名稱
   * @returns {Object} 測量結果
   */
  measurePerformance (fn, name = 'anonymous') {
    if (typeof fn !== 'function') {
      return {
        error: (() => {
          const error = new Error('Invalid function provided')
          error.code = ErrorCodes.INVALID_DATA_FORMAT
          error.details = { category: 'general' }
          return error
        })()
      }
    }

    const memoryBefore = this.getMemoryInfo()
    this.startTimer(name)

    let result
    try {
      result = fn()
    } catch (error) {
      return {
        error
      }
    }

    const timing = this.endTimer(name)
    const memoryAfter = this.getMemoryInfo()

    return {
      result,
      timing: {
        duration: timing.success ? timing.duration : 0,
        operation: name
      },
      memory: {
        before: memoryBefore.success ? memoryBefore.used : 0,
        after: memoryAfter.success ? memoryAfter.used : 0,
        delta: (memoryAfter.success && memoryBefore.success)
          ? memoryAfter.used - memoryBefore.used
          : 0
      }
    }
  }

  /**
   * 基準測試
   * @param {Function} fn - 測試函數
   * @param {Object} options - 選項
   * @returns {Object} 基準測試結果
   */
  benchmark (fn, options = {}) {
    if (typeof fn !== 'function') {
      return {
        error: (() => {
          const error = new Error('Invalid function provided')
          error.code = ErrorCodes.INVALID_DATA_FORMAT
          error.details = { category: 'general' }
          return error
        })()
      }
    }

    const {
      iterations = 100,
      warmup = 10,
      name = 'benchmark'
    } = options

    // 暖身執行
    for (let i = 0; i < warmup; i++) {
      try {
        fn()
      } catch (error) {
        // 忽略暖身錯誤
      }
    }

    const timings = []
    const memoryBaseline = this.getMemoryInfo()
    let peakMemory = 0
    let totalMemory = 0

    // 正式測試
    for (let i = 0; i < iterations; i++) {
      this.startTimer(`${name}-${i}`)

      try {
        fn()
      } catch (error) {
        // 記錄錯誤但繼續測試
      }

      const timing = this.endTimer(`${name}-${i}`)
      if (timing.success) {
        timings.push(timing.duration)
      }

      const currentMemory = this.getMemoryInfo()
      if (currentMemory.success) {
        totalMemory += currentMemory.used
        peakMemory = Math.max(peakMemory, currentMemory.used)
      }
    }

    // 計算統計
    timings.sort((a, b) => a - b)
    const total = timings.reduce((sum, t) => sum + t, 0)
    const average = total / timings.length
    const median = timings.length > 0
      ? timings[Math.floor(timings.length / 2)]
      : 0

    return {
      name,
      iterations: timings.length,
      timing: {
        total,
        average: Math.round(average * 100) / 100,
        min: timings[0] || 0,
        max: timings[timings.length - 1] || 0,
        median: Math.round(median * 100) / 100
      },
      memory: {
        baseline: memoryBaseline.success ? memoryBaseline.used : 0,
        peak: peakMemory,
        average: Math.round(totalMemory / iterations)
      },
      throughput: Math.round((iterations / total) * 1000)
    }
  }

  /**
   * 取得優化建議
   * @returns {Object} 優化建議
   */
  getOptimizationSuggestions () {
    const memoryAnalysis = this.analyzeMemoryUsage()
    const leakDetection = this.detectMemoryLeaks()

    const suggestions = {
      memory: [],
      performance: [],
      caching: [],
      priority: 'LOW'
    }

    // 記憶體建議
    if (memoryAnalysis.usage && memoryAnalysis.usage.percentage > 80) {
      suggestions.memory.push('執行記憶體清理')
      suggestions.priority = 'HIGH'
    }

    if (leakDetection.hasLeaks) {
      suggestions.memory.push('修正記憶體洩漏問題')
      if (leakDetection.severity === 'HIGH') {
        suggestions.priority = 'CRITICAL'
      }
    }

    // 快取建議
    this.caches.forEach((cache, cacheId) => {
      const stats = this.getCacheStats(cacheId)
      if (stats.hitRate && stats.hitRate < 0.5) {
        suggestions.caching.push(`優化 ${cacheId} 快取策略`)
      }
    })

    // 效能建議
    if (this.memorySnapshots.length > 0) {
      const trend = this.getMemoryTrend()
      if (trend.growth.percentage > 100) {
        suggestions.performance.push('檢查記憶體增長趨勢')
      }
    }

    return suggestions
  }

  /**
   * 產生記憶體報告
   * @returns {Object} 記憶體報告
   */
  generateMemoryReport () {
    const current = this.getMemoryInfo()
    const trend = this.getMemoryTrend()
    const efficiency = this.calculateMemoryEfficiency()
    const leakDetection = this.detectMemoryLeaks()

    const cacheReports = []
    this.caches.forEach((cache, cacheId) => {
      const stats = this.getCacheStats(cacheId)
      cacheReports.push({
        id: cacheId,
        ...stats
      })
    })

    return {
      summary: {
        current: current.success
          ? {
              used: current.used,
              percentage: current.percentage
            }
          : null,
        peak: trend.peak,
        average: trend.average,
        efficiency: efficiency.score
      },
      trends: {
        growth: trend.growth.percentage,
        volatility: 0, // 簡化實作
        leakIndicators: leakDetection.recommendations
      },
      caches: cacheReports,
      recommendations: this.getOptimizationSuggestions(),
      timestamp: Date.now()
    }
  }

  /**
   * 產生效能報告
   * @returns {Object} 效能報告
   */
  generatePerformanceReport () {
    const operations = []

    // 簡化實作：從記憶體快照推斷操作
    this.memorySnapshots.forEach((snapshot, index) => {
      if (index > 0) {
        const prevSnapshot = this.memorySnapshots[index - 1]
        operations.push({
          name: snapshot.label,
          duration: snapshot.timestamp - prevSnapshot.timestamp,
          memoryDelta: snapshot.memory.used - prevSnapshot.memory.used
        })
      }
    })

    const totalOperations = operations.length
    const averageDuration = operations.length > 0
      ? operations.reduce((sum, op) => sum + op.duration, 0) / operations.length
      : 0

    const slowestOperation = operations.length > 0
      ? operations.reduce((max, op) => op.duration > max.duration ? op : max)
      : null

    const fastestOperation = operations.length > 0
      ? operations.reduce((min, op) => op.duration < min.duration ? op : min)
      : null

    return {
      operations,
      summary: {
        totalOperations,
        averageDuration: Math.round(averageDuration),
        slowestOperation,
        fastestOperation
      },
      trends: {
        performanceDegradation: averageDuration > 1000,
        bottlenecks: operations.filter(op => op.duration > averageDuration * 2)
      },
      recommendations: averageDuration > 1000
        ? ['優化長時間運行的操作']
        : ['效能表現良好']
    }
  }

  /**
   * 清空所有快取
   * @returns {Object} 清空結果
   */
  clearAllCaches () {
    let totalCleared = 0

    this.caches.forEach(cache => {
      totalCleared += cache.data.size
      cache.data.clear()
      cache.stats.size = 0
    })

    return {
      success: true,
      caches: this.caches.size,
      itemsCleared: totalCleared
    }
  }

  /**
   * 清理資源
   * @returns {Object} 清理結果
   */
  cleanup () {
    try {
      const cacheCleanup = this.clearAllCaches()
      const snapshotCount = this.memorySnapshots.length
      const timerCount = this.timers.size
      const listenerCount = this.eventListeners.length

      // 清理所有資源
      this.memorySnapshots = []
      this.timers.clear()
      this.eventListeners = []
      this.domNodeTracking.clear()

      const memoryAfter = this.getMemoryInfo()

      return {
        success: true,
        cleared: {
          caches: cacheCleanup.caches,
          snapshots: snapshotCount,
          timers: timerCount,
          listeners: listenerCount
        },
        memoryReleased: memoryAfter.success ? 0 : 0 // 簡化實作
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  // ==================
  // 私有輔助方法
  // ==================

  /**
   * 檢查是否支援 performance.memory
   * @returns {boolean} 是否支援
   * @private
   */
  _isPerformanceMemoryAvailable () {
    return typeof performance !== 'undefined' &&
           performance.memory !== undefined
  }

  /**
   * 取得高解析度時間
   * @returns {number} 時間戳
   * @private
   */
  _getHighResolutionTime () {
    if (typeof performance !== 'undefined' && performance.now) {
      return performance.now()
    }
    return Date.now()
  }

  /**
   * 清理快取項目
   * @param {Object} cache - 快取物件
   * @private
   */
  _evictCacheItems (cache) {
    if (cache.config.strategy === 'LRU' && cache.accessOrder.length > 0) {
      const keyToEvict = cache.accessOrder.shift()
      cache.data.delete(keyToEvict)
      cache.stats.evictions++
    }
  }

  /**
   * 估算快取記憶體使用
   * @param {Object} cache - 快取物件
   * @returns {number} 估算大小
   * @private
   */
  _estimateCacheMemory (cache) {
    // 簡化的記憶體估算
    return cache.data.size * 1024 // 假設每個項目 1KB
  }
}

// 建立單例實例
const memoryUtils = new MemoryUtils()

// 匯出靜態方法介面
module.exports = {
  getMemoryInfo: () => memoryUtils.getMemoryInfo(),
  recordMemorySnapshot: (label) => memoryUtils.recordMemorySnapshot(label),
  getMemoryTrend: () => memoryUtils.getMemoryTrend(),
  analyzeMemoryUsage: () => memoryUtils.analyzeMemoryUsage(),
  calculateMemoryEfficiency: () => memoryUtils.calculateMemoryEfficiency(),
  registerCache: (config) => memoryUtils.registerCache(config),
  setCacheItem: (cacheId, key, value) => memoryUtils.setCacheItem(cacheId, key, value),
  getCacheItem: (cacheId, key) => memoryUtils.getCacheItem(cacheId, key),
  performCacheCleanup: () => memoryUtils.performCacheCleanup(),
  getCacheStats: (cacheId) => memoryUtils.getCacheStats(cacheId),
  detectMemoryLeaks: () => memoryUtils.detectMemoryLeaks(),
  trackDOMNodes: (label) => memoryUtils.trackDOMNodes(label),
  analyzeDOMNodeLeaks: () => memoryUtils.analyzeDOMNodeLeaks(),
  trackEventListener: (element, type, handler) => memoryUtils.trackEventListener(element, type, handler),
  analyzeEventListeners: () => memoryUtils.analyzeEventListeners(),
  startTimer: (name) => memoryUtils.startTimer(name),
  endTimer: (name) => memoryUtils.endTimer(name),
  measurePerformance: (fn, name) => memoryUtils.measurePerformance(fn, name),
  benchmark: (fn, options) => memoryUtils.benchmark(fn, options),
  getOptimizationSuggestions: () => memoryUtils.getOptimizationSuggestions(),
  generateMemoryReport: () => memoryUtils.generateMemoryReport(),
  generatePerformanceReport: () => memoryUtils.generatePerformanceReport(),
  clearAllCaches: () => memoryUtils.clearAllCaches(),
  cleanup: () => memoryUtils.cleanup()
}
