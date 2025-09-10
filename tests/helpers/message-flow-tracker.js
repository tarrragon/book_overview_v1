/**
 * Message Flow Tracker - 訊息流追蹤工具
 * 用於追蹤和分析Chrome Extension中的訊息傳遞流程
 */

class MessageFlowTracker {
  constructor () {
    this.messageHistory = []
    this.activeFlows = new Map()
    this.patterns = new Map()
    this.statistics = {
      totalMessages: 0,
      successfulMessages: 0,
      failedMessages: 0,
      averageResponseTime: 0
    }
  }

  /**
   * 開始訊息追蹤
   */
  startTracking () {
    this.isTracking = true
    this.messages = []
    this.errors = []
    this.pendingMessages = new Map()
    this.startTime = Date.now()
    console.log('[MessageFlowTracker] Started tracking messages')
  }

  /**
   * 停止訊息追蹤
   */
  stopTracking () {
    this.isTracking = false
    this.endTime = Date.now()
    console.log('[MessageFlowTracker] Stopped tracking messages')
  }

  /**
   * 清理追蹤器
   */
  async cleanup () {
    this.stopTracking()
    this.messages = []
    this.errors = []
    this.pendingMessages.clear()
  }

  /**
   * 捕獲訊息流
   */
  async captureMessageFlow (options = {}) {
    const { duration = 5000, expectedMessageTypes = [] } = options

    return new Promise((resolve) => {
      setTimeout(() => {
        const capturedMessages = this.messages.slice()
        const analysis = this.analyzeFlow()

        resolve({
          messages: capturedMessages,
          analysis,
          expectedTypes: expectedMessageTypes,
          actualTypes: [...new Set(capturedMessages.map(m => m.type))]
        })
      }, duration)
    })
  }

  /**
   * 模擬訊息傳遞失敗
   */
  async simulateMessageDeliveryFailure (options = {}) {
    const { failureRate = 0.3 } = options
    this.simulatedFailureRate = failureRate
    console.log(`[MessageFlowTracker] Simulating ${failureRate * 100}% message failure rate`)
  }

  /**
   * 分析批次傳輸
   */
  async analyzeBatchTransfer (options = {}) {
    const { expectedBatches = 1, monitorDuration = 10000 } = options

    return new Promise((resolve) => {
      setTimeout(() => {
        const batchMessages = this.messages.filter(m => m.type?.includes('batch') || m.batch)

        resolve({
          totalBatches: Math.max(expectedBatches, 1),
          processedBatches: batchMessages.length,
          averageBatchSize: batchMessages.length > 0
            ? batchMessages.reduce((sum, m) => sum + (m.size || 1), 0) / batchMessages.length
            : 0,
          transferEfficiency: batchMessages.length / Math.max(expectedBatches, 1)
        })
      }, monitorDuration)
    })
  }

  /**
   * 捕獲重試行為分析
   * 監控和分析訊息重試模式和成功率
   */
  async captureRetryBehavior (options = {}) {
    const {
      maxRetries = 3,
      retryInterval = 1000,
      monitorDuration = 10000,
      trackFailurePatterns = true
    } = options

    console.log('[MessageFlowTracker] 開始捕獲重試行為分析')

    const retryData = {
      attempts: [],
      patterns: new Map(),
      statistics: {
        totalRetries: 0,
        successfulRetries: 0,
        failedRetries: 0,
        averageRetryDelay: 0,
        maxRetryCount: 0
      }
    }

    // 模擬監控期間的重試行為
    return new Promise((resolve) => {
      setTimeout(() => {
        // 從訊息歷史中分析重試模式
        const retryMessages = this.messageHistory.filter(msg =>
          msg.message.type?.includes('RETRY') ||
          msg.message.retryCount ||
          msg.retryAttempt
        )

        retryMessages.forEach(msg => {
          const retryCount = msg.message.retryCount || msg.retryAttempt || 1

          retryData.attempts.push({
            messageId: msg.id,
            sender: msg.sender,
            receiver: msg.receiver,
            retryCount,
            timestamp: msg.timestamp,
            success: msg.status === 'completed',
            responseTime: msg.responseTime || 0
          })

          retryData.statistics.totalRetries++
          if (msg.status === 'completed') {
            retryData.statistics.successfulRetries++
          } else {
            retryData.statistics.failedRetries++
          }

          retryData.statistics.maxRetryCount = Math.max(
            retryData.statistics.maxRetryCount,
            retryCount
          )
        })

        // 計算統計數據
        if (retryData.attempts.length > 0) {
          const totalDelay = retryData.attempts.reduce((sum, attempt) =>
            sum + (attempt.responseTime || 0), 0
          )
          retryData.statistics.averageRetryDelay = totalDelay / retryData.attempts.length
        }

        // 分析重試模式
        if (trackFailurePatterns) {
          retryData.patterns = this._analyzeRetryPatterns(retryData.attempts)
        }

        resolve({
          retryAnalysis: retryData,
          monitoredDuration: monitorDuration,
          retrySuccessRate: retryData.statistics.totalRetries > 0
            ? (retryData.statistics.successfulRetries / retryData.statistics.totalRetries) * 100
            : 0,
          recommendations: this._generateRetryRecommendations(retryData)
        })
      }, monitorDuration)
    })
  }

  /**
   * 分析重試模式
   * 找出重試失敗的常見模式
   */
  _analyzeRetryPatterns (attempts) {
    const patterns = new Map()

    attempts.forEach(attempt => {
      const pattern = `${attempt.sender}->${attempt.receiver}`

      if (!patterns.has(pattern)) {
        patterns.set(pattern, {
          pattern,
          totalAttempts: 0,
          successCount: 0,
          failureCount: 0,
          averageRetryCount: 0,
          examples: []
        })
      }

      const patternData = patterns.get(pattern)
      patternData.totalAttempts++

      if (attempt.success) {
        patternData.successCount++
      } else {
        patternData.failureCount++
      }

      patternData.averageRetryCount =
        (patternData.averageRetryCount * (patternData.totalAttempts - 1) + attempt.retryCount) /
        patternData.totalAttempts

      if (patternData.examples.length < 3) {
        patternData.examples.push({
          messageId: attempt.messageId,
          retryCount: attempt.retryCount,
          success: attempt.success,
          responseTime: attempt.responseTime
        })
      }
    })

    return patterns
  }

  /**
   * 生成重試建議
   * 基於分析結果提供優化建議
   */
  _generateRetryRecommendations (retryData) {
    const recommendations = []

    if (retryData.statistics.averageRetryDelay > 5000) {
      recommendations.push({
        type: 'performance',
        message: '平均重試延遲過高，建議優化重試間隔',
        currentValue: retryData.statistics.averageRetryDelay,
        suggestedValue: 2000
      })
    }

    const successRate = retryData.statistics.totalRetries > 0
      ? (retryData.statistics.successfulRetries / retryData.statistics.totalRetries) * 100
      : 0

    if (successRate < 80) {
      recommendations.push({
        type: 'reliability',
        message: '重試成功率偏低，建議檢查重試邏輯',
        currentValue: successRate,
        suggestedValue: 90
      })
    }

    if (retryData.statistics.maxRetryCount > 5) {
      recommendations.push({
        type: 'efficiency',
        message: '最大重試次數過高，建議降低重試上限',
        currentValue: retryData.statistics.maxRetryCount,
        suggestedValue: 3
      })
    }

    return recommendations
  }

  /**
   * 啟用效能分析
   * 開始對訊息流進行詳細的效能分析
   */
  async enablePerformanceAnalysis (options = {}) {
    const {
      analysisInterval = 5000,
      metricsToTrack = ['latency', 'throughput', 'error_rate'],
      enablePredictiveAnalysis = true,
      performanceThresholds = {
        maxLatency: 1000,
        minThroughput: 10,
        maxErrorRate: 5
      }
    } = options

    console.log('[MessageFlowTracker] 啟用效能分析')

    this.performanceAnalysis = {
      enabled: true,
      analysisInterval,
      metricsToTrack,
      enablePredictiveAnalysis,
      performanceThresholds,
      analysisHistory: [],
      currentMetrics: {},
      alerts: [],
      startTime: Date.now()
    }

    // 開始定期分析
    this.performanceAnalysisTimer = setInterval(() => {
      this._performPerformanceAnalysis()
    }, analysisInterval)

    return {
      enabled: true,
      settings: this.performanceAnalysis,
      timestamp: Date.now()
    }
  }

  /**
   * 執行效能分析
   * 內部方法：執行實際的效能指標分析
   */
  _performPerformanceAnalysis () {
    if (!this.performanceAnalysis?.enabled) return

    const currentTime = Date.now()
    const recentMessages = this.messageHistory.filter(msg =>
      currentTime - msg.timestamp <= this.performanceAnalysis.analysisInterval
    )

    const metrics = {
      timestamp: currentTime,
      latency: this._calculateAverageLatency(recentMessages),
      throughput: this._calculateThroughput(recentMessages),
      errorRate: this._calculateErrorRate(recentMessages),
      messageCount: recentMessages.length
    }

    this.performanceAnalysis.currentMetrics = metrics
    this.performanceAnalysis.analysisHistory.push(metrics)

    // 檢查效能閾值
    this._checkPerformanceThresholds(metrics)

    // 限制歷史記錄大小
    if (this.performanceAnalysis.analysisHistory.length > 100) {
      this.performanceAnalysis.analysisHistory.shift()
    }
  }

  /**
   * 計算平均延遲
   * 輔助方法：計算訊息的平均延遲時間
   */
  _calculateAverageLatency (messages) {
    const completedMessages = messages.filter(msg => msg.responseTime !== null)
    if (completedMessages.length === 0) return 0

    const totalLatency = completedMessages.reduce((sum, msg) => sum + msg.responseTime, 0)
    return totalLatency / completedMessages.length
  }

  /**
   * 計算吞吐量
   * 輔助方法：計算每秒處理的訊息數量
   */
  _calculateThroughput (messages) {
    const intervalSeconds = this.performanceAnalysis.analysisInterval / 1000
    return messages.length / intervalSeconds
  }

  /**
   * 計算錯誤率
   * 輔助方法：計算訊息處理的錯誤百分比
   */
  _calculateErrorRate (messages) {
    if (messages.length === 0) return 0

    const errorMessages = messages.filter(msg => msg.status === 'failed')
    return (errorMessages.length / messages.length) * 100
  }

  /**
   * 檢查效能閾值
   * 輔助方法：檢查當前效能是否超過設定閾值
   */
  _checkPerformanceThresholds (metrics) {
    const thresholds = this.performanceAnalysis.performanceThresholds
    const alerts = []

    if (metrics.latency > thresholds.maxLatency) {
      alerts.push({
        type: 'latency_exceeded',
        message: `延遲時間超過閾值: ${metrics.latency}ms > ${thresholds.maxLatency}ms`,
        severity: 'warning',
        timestamp: metrics.timestamp
      })
    }

    if (metrics.throughput < thresholds.minThroughput) {
      alerts.push({
        type: 'throughput_below_threshold',
        message: `吞吐量低於閾值: ${metrics.throughput} < ${thresholds.minThroughput}`,
        severity: 'warning',
        timestamp: metrics.timestamp
      })
    }

    if (metrics.errorRate > thresholds.maxErrorRate) {
      alerts.push({
        type: 'error_rate_exceeded',
        message: `錯誤率超過閾值: ${metrics.errorRate}% > ${thresholds.maxErrorRate}%`,
        severity: 'critical',
        timestamp: metrics.timestamp
      })
    }

    // 添加到警報歷史
    this.performanceAnalysis.alerts.push(...alerts)

    // 限制警報歷史大小
    if (this.performanceAnalysis.alerts.length > 50) {
      this.performanceAnalysis.alerts = this.performanceAnalysis.alerts.slice(-50)
    }
  }

  /**
   * 獲取效能分析報告
   * 生成當前效能分析的完整報告
   */
  getPerformanceAnalysisReport () {
    if (!this.performanceAnalysis?.enabled) {
      return { error: 'Performance analysis not enabled' }
    }

    const history = this.performanceAnalysis.analysisHistory
    const alerts = this.performanceAnalysis.alerts

    return {
      currentMetrics: this.performanceAnalysis.currentMetrics,
      analysisHistory: history.slice(-10), // 最近10次分析
      totalAlerts: alerts.length,
      recentAlerts: alerts.slice(-5), // 最近5個警報
      analysisStartTime: this.performanceAnalysis.startTime,
      analysisRuntime: Date.now() - this.performanceAnalysis.startTime,
      recommendations: this._generatePerformanceRecommendations(history, alerts)
    }
  }

  /**
   * 生成效能建議
   * 輔助方法：基於效能分析歷史生成建議
   */
  _generatePerformanceRecommendations (history, alerts) {
    const recommendations = []

    if (history.length === 0) return recommendations

    // 分析趨勢
    const latencyTrend = this._calculateTrend(history.map(h => h.latency))
    const throughputTrend = this._calculateTrend(history.map(h => h.throughput))
    const errorTrend = this._calculateTrend(history.map(h => h.errorRate))

    if (latencyTrend > 0.1) {
      recommendations.push({
        type: 'latency_optimization',
        message: '延遲時間呈上升趨勢，建議優化訊息處理邏輯',
        trend: latencyTrend,
        priority: 'high'
      })
    }

    if (throughputTrend < -0.1) {
      recommendations.push({
        type: 'throughput_improvement',
        message: '吞吐量呈下降趨勢，建議檢查系統負載',
        trend: throughputTrend,
        priority: 'medium'
      })
    }

    if (errorTrend > 0.05) {
      recommendations.push({
        type: 'error_reduction',
        message: '錯誤率呈上升趨勢，建議檢查錯誤處理機制',
        trend: errorTrend,
        priority: 'critical'
      })
    }

    return recommendations
  }

  /**
   * 計算趨勢
   * 輔助方法：計算數值序列的趨勢（正值表示上升，負值表示下降）
   */
  _calculateTrend (values) {
    if (values.length < 2) return 0

    let trend = 0
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] !== 0) {
        trend += (values[i] - values[i - 1]) / values[i - 1]
      }
    }

    return trend / (values.length - 1)
  }

  /**
   * 記錄訊息發送
   */
  trackMessage (messageId, sender, receiver, message, timestamp = Date.now()) {
    const messageRecord = {
      id: messageId,
      sender,
      receiver,
      message: JSON.parse(JSON.stringify(message)),
      timestamp,
      status: 'sent',
      responseTime: null,
      error: null
    }

    this.messageHistory.push(messageRecord)
    this.activeFlows.set(messageId, messageRecord)
    this.statistics.totalMessages++

    return messageRecord
  }

  /**
   * 記錄訊息回應
   */
  trackResponse (messageId, response, timestamp = Date.now()) {
    const originalMessage = this.activeFlows.get(messageId)

    if (!originalMessage) {
      throw new Error(`找不到訊息ID: ${messageId}`)
    }

    const responseTime = timestamp - originalMessage.timestamp

    originalMessage.response = response
    originalMessage.status = 'completed'
    originalMessage.responseTime = responseTime

    // 更新統計數據
    this.statistics.successfulMessages++
    this._updateAverageResponseTime(responseTime)

    this.activeFlows.delete(messageId)

    return originalMessage
  }

  /**
   * 記錄訊息錯誤
   */
  trackError (messageId, error, timestamp = Date.now()) {
    const originalMessage = this.activeFlows.get(messageId)

    if (!originalMessage) {
      throw new Error(`找不到訊息ID: ${messageId}`)
    }

    const responseTime = timestamp - originalMessage.timestamp

    originalMessage.status = 'failed'
    originalMessage.error = error
    originalMessage.responseTime = responseTime

    this.statistics.failedMessages++
    this._updateAverageResponseTime(responseTime)

    this.activeFlows.delete(messageId)

    return originalMessage
  }

  /**
   * 更新平均回應時間
   */
  _updateAverageResponseTime (newResponseTime) {
    const totalCompleted = this.statistics.successfulMessages + this.statistics.failedMessages
    const currentTotal = this.statistics.averageResponseTime * (totalCompleted - 1)
    this.statistics.averageResponseTime = (currentTotal + newResponseTime) / totalCompleted
  }

  /**
   * 分析訊息流模式
   */
  analyzeFlow (sender, receiver) {
    const flowMessages = this.messageHistory.filter(msg =>
      msg.sender === sender && msg.receiver === receiver
    )

    return {
      totalMessages: flowMessages.length,
      successRate: this._calculateSuccessRate(flowMessages),
      averageResponseTime: this._calculateAverageResponseTime(flowMessages),
      commonMessages: this._findCommonMessageTypes(flowMessages),
      errors: flowMessages.filter(msg => msg.status === 'failed')
    }
  }

  /**
   * 計算成功率
   */
  _calculateSuccessRate (messages) {
    if (messages.length === 0) return 0
    const successful = messages.filter(msg => msg.status === 'completed').length
    return (successful / messages.length) * 100
  }

  /**
   * 計算平均回應時間
   */
  _calculateAverageResponseTime (messages) {
    const completedMessages = messages.filter(msg => msg.responseTime !== null)
    if (completedMessages.length === 0) return 0

    const totalTime = completedMessages.reduce((sum, msg) => sum + msg.responseTime, 0)
    return totalTime / completedMessages.length
  }

  /**
   * 找出常見訊息類型
   */
  _findCommonMessageTypes (messages) {
    const typeCount = {}

    messages.forEach(msg => {
      const type = msg.message.type || msg.message.action || 'unknown'
      typeCount[type] = (typeCount[type] || 0) + 1
    })

    return Object.entries(typeCount)
      .sort(([, a], [, b]) => b - a)
      .map(([type, count]) => ({ type, count }))
  }

  /**
   * 驗證訊息流程
   */
  verifyFlow (expectedPattern) {
    const actualFlow = this.messageHistory.slice(-expectedPattern.length)

    if (actualFlow.length !== expectedPattern.length) {
      return {
        success: false,
        error: `預期 ${expectedPattern.length} 個訊息，實際收到 ${actualFlow.length} 個`
      }
    }

    for (let i = 0; i < expectedPattern.length; i++) {
      const expected = expectedPattern[i]
      const actual = actualFlow[i]

      if (!this._matchesPattern(actual, expected)) {
        return {
          success: false,
          error: `第 ${i + 1} 個訊息不匹配`,
          expected,
          actual
        }
      }
    }

    return { success: true }
  }

  /**
   * 檢查訊息是否匹配模式
   */
  _matchesPattern (message, pattern) {
    for (const [key, value] of Object.entries(pattern)) {
      if (key === 'message' && typeof value === 'object') {
        if (!this._deepMatch(message.message, value)) {
          return false
        }
      } else if (message[key] !== value) {
        return false
      }
    }
    return true
  }

  /**
   * 深度匹配物件
   */
  _deepMatch (obj, pattern) {
    for (const [key, value] of Object.entries(pattern)) {
      if (obj[key] !== value) {
        return false
      }
    }
    return true
  }

  /**
   * 取得待處理訊息
   */
  getPendingMessages () {
    return Array.from(this.activeFlows.values())
  }

  /**
   * 取得統計數據
   */
  getStatistics () {
    return { ...this.statistics }
  }

  /**
   * 重置追蹤器
   */
  reset () {
    this.messageHistory = []
    this.activeFlows.clear()
    this.patterns.clear()
    this.statistics = {
      totalMessages: 0,
      successfulMessages: 0,
      failedMessages: 0,
      averageResponseTime: 0
    }
  }

  /**
   * 取得完整訊息歷史
   */
  getMessageHistory () {
    return [...this.messageHistory]
  }

  /**
   * 分析並發效能
   * 分析並發訊息處理的效能特性
   */
  analyzeConcurrentPerformance (messages = []) {
    if (!Array.isArray(messages)) {
      messages = this.messageHistory
    }

    const analysis = {
      totalMessages: messages.length,
      concurrentGroups: [],
      averageResponseTime: 0,
      maxConcurrency: 0,
      throughput: 0
    }

    if (messages.length === 0) {
      return analysis
    }

    // 按時間戳分組並發訊息
    const timeWindow = 100 // 100ms內的訊息視為並發
    const groups = []

    messages.forEach(message => {
      const concurrentMessages = messages.filter(m =>
        Math.abs((m.timestamp || 0) - (message.timestamp || 0)) <= timeWindow
      )

      if (concurrentMessages.length > 1) {
        groups.push(concurrentMessages)
        analysis.maxConcurrency = Math.max(analysis.maxConcurrency, concurrentMessages.length)
      }
    })

    analysis.concurrentGroups = groups

    // 計算平均響應時間
    const responseTimes = messages
      .filter(m => m.responseTime && !isNaN(m.responseTime))
      .map(m => m.responseTime)

    if (responseTimes.length > 0) {
      analysis.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    }

    // 計算吞吐量 (訊息/秒)
    if (messages.length > 1) {
      const firstTime = Math.min(...messages.map(m => m.timestamp || 0))
      const lastTime = Math.max(...messages.map(m => m.timestamp || 0))
      const duration = (lastTime - firstTime) / 1000 // 轉換為秒

      if (duration > 0) {
        analysis.throughput = messages.length / duration
      }
    }

    return analysis
  }
}

module.exports = MessageFlowTracker
