/**
 * performance-utils.js
 *
 * 效能監控和記憶體管理工具模組
 *
 * 負責功能：
 * - 執行時間計時和統計
 * - 記憶體使用監控和分析
 * - 效能標記和測量
 * - 資源使用追蹤
 * - 效能瓶頸檢測
 * - 優化建議生成
 *
 * 設計考量：
 * - 防禦性程式設計：處理各種瀏覽器環境
 * - 低開銷設計：監控工具不應影響效能
 * - 靈活的統計收集和分析
 * - 豐富的診斷資訊
 *
 * 使用情境：
 * - Content Script 中的效能監控
 * - DOM 操作效能分析
 * - 記憶體洩漏檢測
 * - 長時間運行任務監控
 */

// 儲存計時器資料
const activeTimers = new Map()
const timerStats = new Map()

// 儲存記憶體快照
const memorySnapshots = new Map()

// 儲存效能計數器
const counters = new Map()

// 儲存效能指標
const metrics = new Map()

// 儲存事件監聽器計數
const eventListenerCounts = new Map()

// 長任務檢測回調
let longTaskCallback = null

const PerformanceUtils = {

  // ==================== 計時器功能 ====================

  /**
   * 開始計時器
   */
  startTimer (operationName) {
    if (!operationName || typeof operationName !== 'string') {
      return null
    }

    const timerId = `${operationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const startTime = this.getHighResTime()

    activeTimers.set(timerId, {
      operationName,
      startTime,
      timerId
    })

    return timerId
  },

  /**
   * 停止計時器並取得執行時間
   */
  stopTimer (timerId) {
    if (!timerId || !activeTimers.has(timerId)) {
      return 0
    }

    const timer = activeTimers.get(timerId)
    const endTime = this.getHighResTime()
    const duration = endTime - timer.startTime

    // 移除活躍計時器
    activeTimers.delete(timerId)

    // 更新統計
    this.updateTimerStats(timer.operationName, duration)

    return duration
  },

  /**
   * 檢查計時器是否存在
   */
  hasActiveTimer (timerId) {
    return activeTimers.has(timerId)
  },

  /**
   * 取得計時器統計資料
   */
  getTimerStats (operationName) {
    if (!timerStats.has(operationName)) {
      return {
        count: 0,
        totalTime: 0,
        averageTime: 0,
        minTime: 0,
        maxTime: 0
      }
    }

    return { ...timerStats.get(operationName) }
  },

  /**
   * 清除計時器統計
   */
  clearTimerStats (operationName) {
    if (operationName) {
      timerStats.delete(operationName)
    } else {
      timerStats.clear()
    }
  },

  /**
   * 更新計時器統計
   */
  updateTimerStats (operationName, duration) {
    const current = this.getTimerStats(operationName)

    const updated = {
      count: current.count + 1,
      totalTime: current.totalTime + duration,
      minTime: current.count === 0 ? duration : Math.min(current.minTime, duration),
      maxTime: Math.max(current.maxTime, duration)
    }

    updated.averageTime = updated.totalTime / updated.count

    timerStats.set(operationName, updated)
  },

  // ==================== 記憶體監控功能 ====================

  /**
   * 取得當前記憶體使用量
   */
  getMemoryUsage () {
    try {
      if (typeof performance !== 'undefined' && performance.memory) {
        const memory = performance.memory
        return {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          usagePercentage: memory.totalJSHeapSize > 0
            ? (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
            : 0
        }
      }
    } catch (error) {
      // 忽略錯誤，返回預設值
    }

    return {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
      usagePercentage: 0
    }
  },

  /**
   * 記錄記憶體快照
   */
  takeMemorySnapshot (label) {
    if (!label || typeof label !== 'string') {
      return
    }

    const memoryInfo = this.getMemoryUsage()
    memorySnapshots.set(label, {
      label,
      timestamp: Date.now(),
      ...memoryInfo
    })
  },

  /**
   * 取得所有記憶體快照
   */
  getMemorySnapshots () {
    return Array.from(memorySnapshots.values()).sort((a, b) => a.timestamp - b.timestamp)
  },

  /**
   * 計算兩個快照間的記憶體差異
   */
  getMemoryDifference (startLabel, endLabel) {
    const startSnapshot = memorySnapshots.get(startLabel)
    const endSnapshot = memorySnapshots.get(endLabel)

    if (!startSnapshot || !endSnapshot) {
      return {
        usedHeapDiff: 0,
        totalHeapDiff: 0,
        diffMB: 0,
        diffPercentage: 0
      }
    }

    const usedHeapDiff = endSnapshot.usedJSHeapSize - startSnapshot.usedJSHeapSize
    const totalHeapDiff = endSnapshot.totalJSHeapSize - startSnapshot.totalJSHeapSize

    return {
      usedHeapDiff,
      totalHeapDiff,
      diffMB: usedHeapDiff / (1024 * 1024),
      diffPercentage: startSnapshot.usedJSHeapSize > 0
        ? (usedHeapDiff / startSnapshot.usedJSHeapSize) * 100
        : 0
    }
  },

  /**
   * 記憶體洩漏檢測
   */
  detectMemoryLeak (memorySamples, threshold = 0.1) {
    if (!Array.isArray(memorySamples) || memorySamples.length < 3) {
      return false
    }

    // 檢查記憶體是否持續增長
    let increasingCount = 0
    for (let i = 1; i < memorySamples.length; i++) {
      if (memorySamples[i] > memorySamples[i - 1]) {
        increasingCount++
      }
    }

    // 如果 70% 以上的樣本都在增長，可能有記憶體洩漏
    const increasingRatio = increasingCount / (memorySamples.length - 1)
    return increasingRatio >= 0.7
  },

  // ==================== 效能標記功能 ====================

  /**
   * 建立效能標記
   */
  mark (name) {
    if (!name || typeof performance === 'undefined' || !performance.mark) {
      return
    }

    try {
      performance.mark(name)
    } catch (error) {
      // 忽略錯誤
    }
  },

  /**
   * 測量兩個標記間的時間
   */
  measure (name, startMark, endMark) {
    if (!name || typeof performance === 'undefined' || !performance.measure) {
      return
    }

    try {
      performance.measure(name, startMark, endMark)
    } catch (error) {
      // 忽略錯誤
    }
  },

  /**
   * 清除效能標記
   */
  clearMarks (name) {
    if (typeof performance === 'undefined' || !performance.clearMarks) {
      return
    }

    try {
      performance.clearMarks(name)
    } catch (error) {
      // 忽略錯誤
    }
  },

  /**
   * 清除效能測量
   */
  clearMeasures (name) {
    if (typeof performance === 'undefined' || !performance.clearMeasures) {
      return
    }

    try {
      performance.clearMeasures(name)
    } catch (error) {
      // 忽略錯誤
    }
  },

  // ==================== 效能統計功能 ====================

  /**
   * 遞增計數器
   */
  incrementCounter (name, value = 1) {
    if (!name || typeof name !== 'string') {
      return
    }

    const currentValue = counters.get(name) || 0
    counters.set(name, currentValue + value)
  },

  /**
   * 取得計數器值
   */
  getCounter (name) {
    return counters.get(name) || 0
  },

  /**
   * 記錄效能指標
   */
  recordMetric (name, value) {
    if (!name || typeof name !== 'string' || typeof value !== 'number') {
      return
    }

    if (!metrics.has(name)) {
      metrics.set(name, {
        count: 0,
        total: 0,
        min: Number.MAX_VALUE,
        max: Number.MIN_VALUE,
        values: []
      })
    }

    const metric = metrics.get(name)
    metric.count++
    metric.total += value
    metric.min = Math.min(metric.min, value)
    metric.max = Math.max(metric.max, value)
    metric.values.push(value)

    // 限制保存的值的數量
    if (metric.values.length > 100) {
      metric.values.shift()
    }
  },

  /**
   * 取得效能指標
   */
  getMetrics (name) {
    if (!metrics.has(name)) {
      return {
        count: 0,
        total: 0,
        average: 0,
        min: 0,
        max: 0
      }
    }

    const metric = metrics.get(name)
    return {
      count: metric.count,
      total: metric.total,
      average: metric.count > 0 ? metric.total / metric.count : 0,
      min: metric.min === Number.MAX_VALUE ? 0 : metric.min,
      max: metric.max === Number.MIN_VALUE ? 0 : metric.max
    }
  },

  /**
   * 取得效能報告
   */
  getPerformanceReport () {
    const report = {
      counters: {},
      metrics: {},
      timers: {},
      memory: this.getMemoryUsage(),
      timestamp: Date.now()
    }

    // 收集計數器
    for (const [name, value] of counters) {
      report.counters[name] = value
    }

    // 收集指標
    for (const [name] of metrics) {
      report.metrics[name] = this.getMetrics(name)
    }

    // 收集計時器統計
    for (const [name] of timerStats) {
      report.timers[name] = this.getTimerStats(name)
    }

    return report
  },

  // ==================== 資源監控功能 ====================

  /**
   * 監控 DOM 節點數量
   */
  getDOMNodeCount () {
    try {
      if (typeof document !== 'undefined' && document.querySelectorAll) {
        return document.querySelectorAll('*').length
      }
    } catch (error) {
      // 忽略錯誤
    }

    return 0
  },

  /**
   * 追蹤事件監聽器數量
   */
  trackEventListeners (eventType, count) {
    if (!eventType || typeof eventType !== 'string') {
      return 0
    }

    const currentCount = eventListenerCounts.get(eventType) || 0
    const newCount = currentCount + count
    eventListenerCounts.set(eventType, newCount)

    return newCount
  },

  /**
   * 取得事件監聽器數量
   */
  getEventListenerCount (eventType) {
    return eventListenerCounts.get(eventType) || 0
  },

  /**
   * 設定長任務檢測
   */
  detectLongTasks (callback) {
    if (typeof callback === 'function') {
      longTaskCallback = callback
    }
  },

  /**
   * 檢查長任務
   */
  checkForLongTasks () {
    if (!longTaskCallback || typeof performance === 'undefined' || !performance.getEntriesByType) {
      return
    }

    try {
      const longTasks = performance.getEntriesByType('longtask')
      for (const task of longTasks) {
        if (task.duration > 50) { // 超過 50ms 的任務
          longTaskCallback(task)
        }
      }
    } catch (error) {
      // 忽略錯誤
    }
  },

  // ==================== 效能優化功能 ====================

  /**
   * 偵測效能瓶頸
   */
  detectBottlenecks (threshold = 500) {
    const bottlenecks = []

    // 檢查慢操作
    for (const [name] of metrics) {
      const metric = this.getMetrics(name)
      if (metric.average > threshold) {
        bottlenecks.push(name)
      }
    }

    return bottlenecks
  },

  /**
   * 取得優化建議
   */
  getOptimizationSuggestions () {
    const suggestions = []
    const memoryInfo = this.getMemoryUsage()

    // 記憶體使用檢查
    if (memoryInfo.usagePercentage > 80) {
      suggestions.push('減少記憶體使用')
    }

    // 事件監聽器檢查
    let totalListeners = 0
    for (const count of eventListenerCounts.values()) {
      totalListeners += count
    }

    if (totalListeners > 500) {
      suggestions.push('減少事件監聽器數量')
    }

    // DOM 節點檢查
    const domNodeCount = this.getDOMNodeCount()
    if (domNodeCount > 10000) {
      suggestions.push('優化 DOM 結構')
    }

    return suggestions
  },

  /**
   * 效能基準測試
   */
  benchmark (name, func, iterations = 1) {
    if (typeof func !== 'function' || iterations < 1) {
      return null
    }

    const times = []

    for (let i = 0; i < iterations; i++) {
      const startTime = this.getHighResTime()
      try {
        func()
      } catch (error) {
        // 忽略測試函數錯誤
      }
      const endTime = this.getHighResTime()
      times.push(endTime - startTime)
    }

    const totalTime = times.reduce((sum, time) => sum + time, 0)

    return {
      name,
      iterations,
      times,
      totalTime,
      averageTime: totalTime / iterations,
      minTime: Math.min(...times),
      maxTime: Math.max(...times)
    }
  },

  // ==================== 輔助功能 ====================

  /**
   * 取得高精度時間
   */
  getHighResTime () {
    if (typeof performance !== 'undefined' && performance.now) {
      return performance.now()
    }

    return Date.now()
  },

  /**
   * 清除所有統計資料
   */
  clearAllStats () {
    activeTimers.clear()
    timerStats.clear()
    memorySnapshots.clear()
    counters.clear()
    metrics.clear()
    eventListenerCounts.clear()
    longTaskCallback = null
  }
}

module.exports = PerformanceUtils
