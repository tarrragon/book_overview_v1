/**
 * Event Flow Validator
 * 驗證端到端流程中的事件傳遞和處理順序、時序和完整性
 *
 * 主要功能：
 * - 事件序列追蹤和驗證
 * - 事件時序分析和效能監控
 * - 事件資料完整性檢查
 * - 事件流程異常偵測
 *
 * @author TDD Phase 2 - sage-test-architect
 * @date 2025-08-25
 * @version v0.9.38
 */

class EventFlowValidator {
  constructor () {
    this.expectedEventSequence = []
    this.actualEventSequence = []
    this.eventTimings = new Map()
    this.eventListeners = new Map()
    this.trackingState = {
      active: false,
      startTime: null,
      expectedCount: 0,
      receivedCount: 0
    }
    this.validationRules = new Map()
    this.eventHistory = []
  }

  /**
   * 註冊事件流程追蹤
   * @param {Array<string>} expectedEventSequence - 預期事件序列
   */
  registerEventSequenceTracking (expectedEventSequence) {
    this.expectedEventSequence = [...expectedEventSequence]
    this.actualEventSequence = []
    this.eventTimings.clear()
    this.eventHistory = []

    // 為每個預期事件設置監聽器
    this.setupEventListeners(expectedEventSequence)

    // 初始化時間戳記錄機制
    this.initializeTimingRecording()

    // 更新追蹤狀態
    this.trackingState = {
      active: true,
      startTime: Date.now(),
      expectedCount: expectedEventSequence.length,
      receivedCount: 0
    }
  }

  /**
   * 為預期事件設置監聽器
   * @param {Array<string>} expectedSequence - 預期事件序列
   * @private
   */
  setupEventListeners (expectedSequence) {
    expectedSequence.forEach(eventType => {
      if (!this.eventListeners.has(eventType)) {
        this.eventListeners.set(eventType, [])
      }

      // 創建事件監聽器
      const listener = (eventData) => {
        this.recordEventReceived(eventType, eventData)
      }

      this.eventListeners.get(eventType).push(listener)

      // 如果有全域事件系統，註冊監聽器
      if (this.setupGlobalEventListener) {
        this.setupGlobalEventListener(eventType, listener)
      }
    })
  }

  /**
   * 設置全域事件監聽器 (可由外部系統實作)
   * @param {string} eventType - 事件類型
   * @param {Function} listener - 監聽器函數
   * @private
   */
  setupGlobalEventListener (eventType, listener) {
    // 這個方法可以被外部系統覆寫以整合真實的事件系統
    console.log(`Global listener setup for: ${eventType}`)
  }

  /**
   * 初始化時間戳記錄機制
   * @private
   */
  initializeTimingRecording () {
    this.timingRecorder = {
      eventStartTimes: new Map(),
      eventDurations: new Map(),
      intervalMeasurements: []
    }
  }

  /**
   * 記錄事件接收
   * @param {string} eventType - 事件類型
   * @param {Object} eventData - 事件資料
   * @private
   */
  recordEventReceived (eventType, eventData) {
    const timestamp = Date.now()

    // 記錄到實際事件序列
    this.actualEventSequence.push(eventType)

    // 記錄事件時間
    this.eventTimings.set(eventType, timestamp)

    // 記錄詳細事件資料
    const eventRecord = {
      type: eventType,
      timestamp,
      data: eventData,
      sequenceIndex: this.actualEventSequence.length - 1,
      relativeTime: timestamp - this.trackingState.startTime
    }

    this.eventHistory.push(eventRecord)

    // 更新接收計數
    this.trackingState.receivedCount++

    // 記錄事件間隔
    if (this.actualEventSequence.length > 1) {
      const previousEvent = this.eventHistory[this.eventHistory.length - 2]
      const interval = timestamp - previousEvent.timestamp
      this.timingRecorder.intervalMeasurements.push({
        fromEvent: previousEvent.type,
        toEvent: eventType,
        interval
      })
    }

    console.log(`Event received: ${eventType} at ${timestamp}`)
  }

  /**
   * 手動觸發事件 (用於測試)
   * @param {string} eventType - 事件類型
   * @param {Object} eventData - 事件資料
   */
  triggerEvent (eventType, eventData = {}) {
    const listeners = this.eventListeners.get(eventType) || []
    listeners.forEach(listener => {
      try {
        listener(eventData)
      } catch (error) {
        console.warn(`Event listener error for ${eventType}:`, error)
      }
    })
  }

  /**
   * 驗證事件流程正確性
   * @returns {EventFlowValidationResult} 驗證結果
   */
  validateEventFlow () {
    const result = {
      sequenceCorrect: false,
      timingAppropriate: false,
      allEventsReceived: false,
      noDuplicateEvents: false,
      dataComplete: false,
      overallValid: false
    }

    try {
      // 檢查事件發生順序
      result.sequenceCorrect = this.compareEventSequences()

      // 驗證事件時間間隔合理
      result.timingAppropriate = this.validateEventTimings()

      // 確認事件資料完整性
      result.dataComplete = this.checkEventDataIntegrity()

      // 檢查所有預期事件都已接收
      result.allEventsReceived = this.checkAllEventsReceived()

      // 檢查是否有重複事件
      result.noDuplicateEvents = this.checkNoDuplicateEvents()

      // 計算整體驗證結果
      result.overallValid = result.sequenceCorrect &&
                           result.timingAppropriate &&
                           result.allEventsReceived &&
                           result.noDuplicateEvents &&
                           result.dataComplete
    } catch (error) {
      console.error('Event flow validation error:', error)
      result.error = error.message
    }

    return result
  }

  /**
   * 比對事件序列
   * @returns {boolean} 序列是否正確
   * @private
   */
  compareEventSequences () {
    if (this.expectedEventSequence.length !== this.actualEventSequence.length) {
      console.warn('Event sequence length mismatch:', {
        expected: this.expectedEventSequence.length,
        actual: this.actualEventSequence.length
      })
      return false
    }

    for (let i = 0; i < this.expectedEventSequence.length; i++) {
      if (this.expectedEventSequence[i] !== this.actualEventSequence[i]) {
        console.warn('Event sequence mismatch at index', i, {
          expected: this.expectedEventSequence[i],
          actual: this.actualEventSequence[i]
        })
        return false
      }
    }

    return true
  }

  /**
   * 驗證事件時間間隔
   * @returns {boolean} 時序是否合理
   * @private
   */
  validateEventTimings () {
    const timingResults = {
      totalDuration: 0,
      averageInterval: 0,
      maxInterval: 0,
      minInterval: Number.MAX_SAFE_INTEGER,
      timeouts: 0
    }

    if (this.eventHistory.length < 2) {
      return true // 少於2個事件時無法驗證時序
    }

    // 計算總持續時間
    const firstEvent = this.eventHistory[0]
    const lastEvent = this.eventHistory[this.eventHistory.length - 1]
    timingResults.totalDuration = lastEvent.timestamp - firstEvent.timestamp

    // 分析事件間隔
    const intervals = this.timingRecorder.intervalMeasurements
    if (intervals.length > 0) {
      const totalInterval = intervals.reduce((sum, item) => sum + item.interval, 0)
      timingResults.averageInterval = totalInterval / intervals.length
      timingResults.maxInterval = Math.max(...intervals.map(item => item.interval))
      timingResults.minInterval = Math.min(...intervals.map(item => item.interval))

      // 檢查異常間隔 (超過5秒視為超時)
      timingResults.timeouts = intervals.filter(item => item.interval > 5000).length
    }

    // 儲存時序分析結果
    this.timingAnalysis = timingResults

    // 驗證標準
    return timingResults.totalDuration < 10000 && // 總時間 < 10秒
           timingResults.averageInterval < 2000 && // 平均間隔 < 2秒
           timingResults.timeouts === 0 // 無超時事件
  }

  /**
   * 檢查事件資料完整性
   * @returns {boolean} 資料是否完整
   * @private
   */
  checkEventDataIntegrity () {
    return this.eventHistory.every(event => {
      // 檢查基本屬性
      if (!event.type || !event.timestamp) {
        return false
      }

      // 檢查事件特定的資料完整性
      if (this.validationRules.has(event.type)) {
        const rules = this.validationRules.get(event.type)
        return rules.every(rule => rule(event.data))
      }

      return true
    })
  }

  /**
   * 檢查所有事件都已接收
   * @returns {boolean} 是否都已接收
   * @private
   */
  checkAllEventsReceived () {
    return this.trackingState.receivedCount === this.trackingState.expectedCount
  }

  /**
   * 檢查是否有重複事件
   * @returns {boolean} 是否無重複
   * @private
   */
  checkNoDuplicateEvents () {
    const eventCounts = new Map()

    this.actualEventSequence.forEach(eventType => {
      eventCounts.set(eventType, (eventCounts.get(eventType) || 0) + 1)
    })

    // 檢查是否有事件出現多次 (除非明確允許)
    for (const [eventType, count] of eventCounts) {
      if (count > 1 && !this.isRepeatAllowed(eventType)) {
        console.warn(`Duplicate event detected: ${eventType} (${count} times)`)
        return false
      }
    }

    return true
  }

  /**
   * 檢查事件是否允許重複
   * @param {string} eventType - 事件類型
   * @returns {boolean} 是否允許重複
   * @private
   */
  isRepeatAllowed (eventType) {
    // 某些事件類型允許重複，如進度更新
    const repeatAllowedEvents = [
      'EXTRACTOR.PROGRESS.UPDATED',
      'UI.STATUS.UPDATED',
      'STORAGE.SYNC.IN_PROGRESS'
    ]

    return repeatAllowedEvents.includes(eventType)
  }

  /**
   * 檢查事件系統效能
   * @returns {EventPerformanceReport} 效能報告
   */
  checkEventPerformance () {
    const report = {
      totalEvents: this.eventHistory.length,
      averageProcessingTime: 0,
      memoryUsage: 0,
      throughput: 0,
      latencyMetrics: {},
      performanceIssues: []
    }

    try {
      // 計算處理時間統計
      if (this.eventHistory.length > 0) {
        const totalDuration = this.timingAnalysis?.totalDuration || 0
        report.averageProcessingTime = totalDuration / this.eventHistory.length
        report.throughput = this.eventHistory.length / (totalDuration / 1000) // events per second
      }

      // 延遲指標
      report.latencyMetrics = {
        min: this.timingAnalysis?.minInterval || 0,
        max: this.timingAnalysis?.maxInterval || 0,
        average: this.timingAnalysis?.averageInterval || 0,
        p95: this.calculatePercentile(95),
        p99: this.calculatePercentile(99)
      }

      // 記憶體使用估計
      report.memoryUsage = this.estimateMemoryUsage()

      // 識別效能問題
      report.performanceIssues = this.identifyPerformanceIssues()
    } catch (error) {
      report.error = error.message
    }

    return report
  }

  /**
   * 計算百分位延遲
   * @param {number} percentile - 百分位數
   * @returns {number} 延遲值
   * @private
   */
  calculatePercentile (percentile) {
    const intervals = this.timingRecorder.intervalMeasurements.map(item => item.interval)
    if (intervals.length === 0) return 0

    intervals.sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * intervals.length) - 1
    return intervals[Math.max(0, index)]
  }

  /**
   * 估計記憶體使用
   * @returns {number} 記憶體使用估計 (字節)
   * @private
   */
  estimateMemoryUsage () {
    // 簡單估計：每個事件記錄約100字節
    return this.eventHistory.length * 100
  }

  /**
   * 識別效能問題
   * @returns {Array} 效能問題列表
   * @private
   */
  identifyPerformanceIssues () {
    const issues = []

    // 檢查總處理時間過長
    if (this.timingAnalysis?.totalDuration > 10000) {
      issues.push({
        type: 'SLOW_PROCESSING',
        description: `總處理時間過長: ${this.timingAnalysis.totalDuration}ms`,
        severity: 'HIGH'
      })
    }

    // 檢查事件間隔過長
    if (this.timingAnalysis?.maxInterval > 5000) {
      issues.push({
        type: 'LONG_INTERVAL',
        description: `最大事件間隔過長: ${this.timingAnalysis.maxInterval}ms`,
        severity: 'MEDIUM'
      })
    }

    // 檢查事件丟失
    if (this.trackingState.receivedCount < this.trackingState.expectedCount) {
      issues.push({
        type: 'MISSING_EVENTS',
        description: `事件遺失: 預期${this.trackingState.expectedCount}，實際${this.trackingState.receivedCount}`,
        severity: 'HIGH'
      })
    }

    return issues
  }

  /**
   * 獲取事件時序資料
   * @returns {Object} 事件時序統計
   */
  getEventTimings () {
    return {
      totalDuration: this.timingAnalysis?.totalDuration || 0,
      averageInterval: this.timingAnalysis?.averageInterval || 0,
      maxInterval: this.timingAnalysis?.maxInterval || 0,
      minInterval: this.timingAnalysis?.minInterval || 0,
      eventCount: this.eventHistory.length
    }
  }

  /**
   * 添加事件驗證規則
   * @param {string} eventType - 事件類型
   * @param {Function} rule - 驗證規則函數
   */
  addValidationRule (eventType, rule) {
    if (!this.validationRules.has(eventType)) {
      this.validationRules.set(eventType, [])
    }
    this.validationRules.get(eventType).push(rule)
  }

  /**
   * 檢查追蹤是否啟動
   * @returns {boolean} 追蹤狀態
   */
  isTrackingActive () {
    return this.trackingState.active
  }

  /**
   * 獲取預期事件數量
   * @returns {number} 預期事件數量
   */
  getExpectedEventCount () {
    return this.trackingState.expectedCount
  }

  /**
   * 獲取已註冊的事件類型
   * @returns {Array<string>} 事件類型列表
   */
  getRegisteredEventTypes () {
    return [...this.expectedEventSequence]
  }

  /**
   * 清除事件歷史記錄
   */
  clearEventHistory () {
    this.actualEventSequence = []
    this.eventTimings.clear()
    this.eventHistory = []
    this.trackingState = {
      active: false,
      startTime: null,
      expectedCount: 0,
      receivedCount: 0
    }
    this.timingRecorder = null
  }

  /**
   * 重置驗證器狀態
   */
  reset () {
    this.clearEventHistory()
    this.expectedEventSequence = []
    this.eventListeners.clear()
    this.validationRules.clear()
  }
}

module.exports = { EventFlowValidator }
