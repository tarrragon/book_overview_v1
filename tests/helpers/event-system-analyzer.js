/**
 * Event System Analyzer - 事件系統分析器
 * 用於分析事件流和事件系統效能
 */

class EventSystemAnalyzer {
  constructor() {
    this.eventHistory = []
    this.listeners = new Map()
    this.metrics = {
      totalEvents: 0,
      averageProcessTime: 0,
      errorRate: 0
    }
  }

  /**
   * 記錄事件
   */
  recordEvent(eventType, payload, processingTime) {
    const event = {
      type: eventType,
      payload,
      processingTime: processingTime || 0,
      timestamp: new Date(),
      id: this.generateEventId()
    }

    this.eventHistory.push(event)
    this.updateMetrics(event)
    
    return event
  }

  /**
   * 分析事件流
   */
  analyzeEventFlow(timeWindow = 1000) {
    const now = new Date()
    const windowStart = new Date(now.getTime() - timeWindow)
    
    const recentEvents = this.eventHistory.filter(
      event => event.timestamp >= windowStart
    )

    return {
      totalEvents: recentEvents.length,
      eventTypes: this.groupEventsByType(recentEvents),
      averageProcessTime: this.calculateAverageProcessTime(recentEvents),
      eventRate: recentEvents.length / (timeWindow / 1000) // events per second
    }
  }

  /**
   * 檢查事件順序
   */
  checkEventOrder(expectedOrder) {
    const actualOrder = this.eventHistory.map(event => event.type)
    const orderMatches = JSON.stringify(actualOrder) === JSON.stringify(expectedOrder)
    
    return {
      matches: orderMatches,
      expected: expectedOrder,
      actual: actualOrder,
      differences: this.findOrderDifferences(expectedOrder, actualOrder)
    }
  }

  /**
   * 分析事件效能
   */
  analyzePerformance() {
    const slowEvents = this.eventHistory.filter(event => event.processingTime > 100)
    const fastEvents = this.eventHistory.filter(event => event.processingTime <= 10)
    
    return {
      slowEvents: slowEvents.length,
      fastEvents: fastEvents.length,
      averageTime: this.metrics.averageProcessTime,
      maxTime: Math.max(...this.eventHistory.map(e => e.processingTime)),
      minTime: Math.min(...this.eventHistory.map(e => e.processingTime))
    }
  }

  /**
   * 檢查事件洩漏
   */
  checkEventLeaks() {
    const eventCounts = new Map()
    
    for (const event of this.eventHistory) {
      const count = eventCounts.get(event.type) || 0
      eventCounts.set(event.type, count + 1)
    }

    const suspiciousEvents = []
    for (const [type, count] of eventCounts) {
      if (count > 100) { // 閾值可調整
        suspiciousEvents.push({ type, count })
      }
    }

    return {
      hasSuspiciousActivity: suspiciousEvents.length > 0,
      suspiciousEvents,
      totalUniqueEvents: eventCounts.size
    }
  }

  /**
   * 私有方法
   */
  generateEventId() {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  groupEventsByType(events) {
    const groups = new Map()
    for (const event of events) {
      const count = groups.get(event.type) || 0
      groups.set(event.type, count + 1)
    }
    return Object.fromEntries(groups)
  }

  calculateAverageProcessTime(events) {
    if (events.length === 0) return 0
    const total = events.reduce((sum, event) => sum + event.processingTime, 0)
    return total / events.length
  }

  findOrderDifferences(expected, actual) {
    const differences = []
    const maxLength = Math.max(expected.length, actual.length)
    
    for (let i = 0; i < maxLength; i++) {
      if (expected[i] !== actual[i]) {
        differences.push({
          position: i,
          expected: expected[i],
          actual: actual[i]
        })
      }
    }
    
    return differences
  }

  updateMetrics(event) {
    this.metrics.totalEvents++
    
    // 更新平均處理時間
    const totalTime = this.eventHistory.reduce((sum, e) => sum + e.processingTime, 0)
    this.metrics.averageProcessTime = totalTime / this.eventHistory.length
  }

  /**
   * 重置分析器
   */
  reset() {
    this.eventHistory = []
    this.listeners.clear()
    this.metrics = {
      totalEvents: 0,
      averageProcessTime: 0,
      errorRate: 0
    }
  }

  /**
   * 獲取完整報告
   */
  generateReport() {
    return {
      metrics: this.metrics,
      eventFlow: this.analyzeEventFlow(),
      performance: this.analyzePerformance(),
      leakCheck: this.checkEventLeaks(),
      totalEvents: this.eventHistory.length,
      generatedAt: new Date()
    }
  }
}

module.exports = EventSystemAnalyzer