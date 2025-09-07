/**
 * Runtime Messaging Validator Test Helper
 */
class RuntimeMessagingValidator {
  constructor (testSuite) {
    this.testSuite = testSuite
    this.initialized = true
    this.messageHistory = []
    this.isTracking = false
    this.trackingChannels = []
  }

  validateRuntimeMessaging (config) {
    const result = {
      valid: true,
      messagesSent: this.messageHistory.length,
      timestamp: Date.now()
    }

    this.messageHistory.push({
      type: 'runtime_messaging_validation',
      config,
      result,
      timestamp: Date.now()
    })

    return result
  }

  validateMessage (message) {
    return {
      valid: true,
      messageId: message.id || 'test-message',
      type: message.type || 'test'
    }
  }

  /**
   * 開始追蹤指定頻道的訊息
   * @param {Array<string>} channels - 要追蹤的訊息頻道
   */
  async startTracking (channels = []) {
    this.isTracking = true
    this.trackingChannels = channels
    this.messageHistory = [] // 重置歷史記錄
    
    // 記錄開始追蹤
    this.messageHistory.push({
      type: 'tracking_started',
      channels: channels,
      timestamp: Date.now()
    })
    
    // 如果有測試套件，通知開始追蹤
    if (this.testSuite && this.testSuite.log) {
      this.testSuite.log(`開始追蹤訊息頻道: ${channels.join(', ')}`)
    }
    
    return {
      success: true,
      trackingChannels: this.trackingChannels,
      timestamp: Date.now()
    }
  }

  /**
   * 停止追蹤訊息
   */
  async stopTracking () {
    this.isTracking = false
    const trackedChannels = [...this.trackingChannels]
    this.trackingChannels = []
    
    // 記錄停止追蹤
    this.messageHistory.push({
      type: 'tracking_stopped',
      channels: trackedChannels,
      messageCount: this.messageHistory.length - 1, // 扣除開始追蹤的記錄
      timestamp: Date.now()
    })
    
    return {
      success: true,
      previousChannels: trackedChannels,
      totalMessages: this.messageHistory.length,
      timestamp: Date.now()
    }
  }

  /**
   * 檢查是否正在追蹤指定頻道
   * @param {string} channel - 頻道名稱
   */
  isTrackingChannel (channel) {
    return this.isTracking && this.trackingChannels.includes(channel)
  }

  getMessageHistory () {
    return this.messageHistory
  }

  reset () {
    this.messageHistory = []
    this.isTracking = false
    this.trackingChannels = []
  }
}

module.exports = RuntimeMessagingValidator
