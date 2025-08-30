/**
 * Message Flow Analyzer - 訊息流分析器
 */

class MessageFlowAnalyzer {
  constructor() {
    this.messages = []
    this.flows = []
  }

  /**
   * 記錄訊息
   */
  recordMessage(sender, receiver, type, payload) {
    const message = {
      id: this.generateMessageId(),
      sender,
      receiver,
      type,
      payload,
      timestamp: new Date()
    }

    this.messages.push(message)
    return message
  }

  /**
   * 分析訊息流
   */
  analyzeFlow() {
    const flowAnalysis = {
      totalMessages: this.messages.length,
      senders: this.getUniqueSenders(),
      receivers: this.getUniqueReceivers(),
      messageTypes: this.getMessageTypes(),
      averageFlowTime: this.calculateAverageFlowTime()
    }

    this.flows.push({
      analysis: flowAnalysis,
      timestamp: new Date()
    })

    return flowAnalysis
  }

  /**
   * 驗證訊息順序
   */
  validateMessageOrder(expectedOrder) {
    const actualOrder = this.messages.map(m => m.type)
    
    return {
      isCorrect: JSON.stringify(actualOrder) === JSON.stringify(expectedOrder),
      expected: expectedOrder,
      actual: actualOrder
    }
  }

  /**
   * 私有輔助方法
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  }

  getUniqueSenders() {
    return [...new Set(this.messages.map(m => m.sender))]
  }

  getUniqueReceivers() {
    return [...new Set(this.messages.map(m => m.receiver))]
  }

  getMessageTypes() {
    const types = {}
    this.messages.forEach(m => {
      types[m.type] = (types[m.type] || 0) + 1
    })
    return types
  }

  calculateAverageFlowTime() {
    if (this.messages.length < 2) return 0
    
    const firstMessage = this.messages[0]
    const lastMessage = this.messages[this.messages.length - 1]
    
    return lastMessage.timestamp - firstMessage.timestamp
  }

  /**
   * 重置分析器
   */
  reset() {
    this.messages = []
    this.flows = []
  }
}

module.exports = MessageFlowAnalyzer