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
}

module.exports = MessageFlowTracker
