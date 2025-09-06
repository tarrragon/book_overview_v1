/**
 * MessageTracker - 即時訊息追蹤診斷系統
 * TDD 循環 #33: 即時診斷系統
 *
 * 負責功能：
 * - Chrome Extension 訊息流程即時追蹤
 * - 未知訊息類型識別和記錄
 * - Console 診斷介面提供
 * - 訊息處理時間統計和分析
 *
 * 設計考量：
 * - 繼承 EventHandler 提供標準化事件處理
 * - 中等優先級 (10) 不干擾核心錯誤處理
 * - 輕量級設計，最小侵入性
 * - 記憶體管理避免追蹤記錄無限增長
 *
 * 處理流程：
 * 1. 接收訊息相關事件
 * 2. 記錄訊息流程和狀態變化
 * 3. 識別未知訊息類型
 * 4. 提供 Console 診斷介面
 *
 * 使用情境：
 * - Chrome Extension 開發階段的訊息診斷
 * - START_EXTRACTION 等訊息處理問題的追蹤
 * - 即時訊息流程監控和分析
 */

const EventHandler = require('src/core/event-handler')

class MessageTracker extends EventHandler {
  /**
   * 分層常數架構 - 統一管理所有硬編碼值
   */
  static get CONSTANTS () {
    return {
      // 核心配置
      CONFIG: {
        PRIORITY: 10,
        NAME: 'MessageTracker',
        MAX_MESSAGE_RECORDS: 100,
        MESSAGE_TIMEOUT_MS: 30000, // 30秒
        CLEANUP_INTERVAL_MS: 60 * 1000, // 1分鐘
        CONSOLE_LOG_LIMIT: 20
      },

      // 事件系統
      EVENTS: {
        // 支援的輸入事件
        INPUT: {
          MESSAGE_SENT: 'MESSAGE.SENT',
          MESSAGE_RECEIVED: 'MESSAGE.RECEIVED',
          MESSAGE_PROCESSED: 'MESSAGE.PROCESSED',
          MESSAGE_FAILED: 'MESSAGE.FAILED'
        },
        // 發送的輸出事件
        OUTPUT: {
          TRACKING_STARTED: 'TRACKING.STARTED',
          UNKNOWN_MESSAGE_DETECTED: 'UNKNOWN_MESSAGE.DETECTED',
          MESSAGE_FLOW_COMPLETED: 'MESSAGE_FLOW.COMPLETED',
          DIAGNOSTIC_INFO_UPDATED: 'DIAGNOSTIC_INFO.UPDATED'
        }
      },

      // 訊息系統
      MESSAGE: {
        // 訊息狀態
        STATUS: {
          SENT: 'SENT',
          RECEIVED: 'RECEIVED',
          PROCESSED: 'PROCESSED',
          FAILED: 'FAILED',
          TIMEOUT: 'TIMEOUT'
        },
        // 訊息來源/目標
        CONTEXTS: {
          POPUP: 'popup',
          BACKGROUND: 'background',
          CONTENT: 'content',
          DEVTOOLS: 'devtools'
        }
      },

      // Console 診斷
      CONSOLE: {
        COMMANDS: {
          STATUS: 'status',
          MESSAGES: 'messages',
          UNKNOWN: 'unknown',
          CLEAR: 'clear',
          ACTIVE: 'active',
          STATS: 'stats'
        },
        MESSAGES: {
          INTERFACE_ENABLED: '[MessageTracker] Console 診斷介面已啟用',
          USAGE_HINT: '使用 MessageDiagnostic.status() 查看追蹤狀態',
          DIAGNOSTIC_MODE_ON: '[MessageTracker] 診斷模式 啟用',
          DIAGNOSTIC_MODE_OFF: '[MessageTracker] 診斷模式 停用'
        }
      },

      // 錯誤處理
      ERRORS: {
        TYPES: {
          UNSUPPORTED_EVENT: 'UNSUPPORTED_EVENT_TYPE',
          PROCESSING_FAILED: 'PROCESSING_FAILED',
          CONSOLE_UNAVAILABLE: 'CONSOLE_UNAVAILABLE'
        },
        MESSAGES: {
          UNSUPPORTED_EVENT_TYPE: '不支援的追蹤事件類型',
          PROCESSING_FAILED: '處理追蹤事件失敗',
          CONSOLE_UNAVAILABLE: 'Console 診斷介面不可用'
        }
      }
    }
  }

  /**
   * 建構 MessageTracker
   * @param {Object} eventBus - 事件總線實例
   * @param {Object} options - 配置選項
   */
  constructor (eventBus, options = {}) {
    const { CONFIG, EVENTS } = MessageTracker.CONSTANTS

    // EventHandler 建構函數簽名是 (name, priority)
    super(CONFIG.NAME, CONFIG.PRIORITY)

    // 設置 eventBus 和支援的事件
    this.eventBus = eventBus
    this.supportedEvents = Object.values(EVENTS.INPUT)

    // 統一配置管理
    this.config = this._mergeConfiguration(options)

    // 初始化各個子系統
    this._initializeTrackingState()
    this._initializeMessageLog()
    this._initializeStatistics()
    this._initializeConsoleInterface()
    this._setupCleanupTimer()
  }

  /**
   * 合併配置選項
   * @param {Object} options - 使用者配置選項
   * @returns {Object} 合併後的配置
   * @private
   */
  _mergeConfiguration (options) {
    const { CONFIG } = MessageTracker.CONSTANTS

    return {
      maxMessageRecords:
        options.maxMessageRecords || CONFIG.MAX_MESSAGE_RECORDS,
      messageTimeoutMs: options.messageTimeoutMs || CONFIG.MESSAGE_TIMEOUT_MS,
      cleanupIntervalMs:
        options.cleanupIntervalMs || CONFIG.CLEANUP_INTERVAL_MS,
      consoleLogLimit: options.consoleLogLimit || CONFIG.CONSOLE_LOG_LIMIT
    }
  }

  /**
   * 初始化追蹤狀態
   * @private
   */
  _initializeTrackingState () {
    this.trackingEnabled = true
    this.diagnosticMode = false
    this.startTime = Date.now()
  }

  /**
   * 初始化訊息記錄系統
   * @private
   */
  _initializeMessageLog () {
    this.messageLog = []
    this.activeMessages = new Map()
    this.unknownMessages = []
  }

  /**
   * 初始化統計系統
   * @private
   */
  _initializeStatistics () {
    this.trackingStats = {
      totalMessages: 0,
      unknownMessages: 0,
      failedMessages: 0,
      processedMessages: 0,
      averageProcessingTime: 0,
      lastMessageTime: null
    }
  }

  /**
   * 初始化 Console 診斷介面
   * @private
   */
  _initializeConsoleInterface () {
    if (typeof window !== 'undefined') {
      this._setupConsoleInterface()
    }
  }

  /**
   * 處理追蹤事件
   * @param {Object} event - 追蹤事件
   * @returns {Object} 處理結果
   */
  async process (event) {
    if (!this.trackingEnabled) {
      return { success: true, message: '追蹤已停用' }
    }

    const { type, data } = event

    try {
      return await this._dispatchEventHandler(type, data)
    } catch (error) {
      const { ERRORS } = MessageTracker.CONSTANTS
      console.error(
        `[MessageTracker] ${ERRORS.MESSAGES.PROCESSING_FAILED}:`,
        error
      )
      return this._createErrorResponse(error.message)
    }
  }

  /**
   * 分派事件處理器
   * @param {string} type - 事件類型
   * @param {Object} data - 事件資料
   * @returns {Promise<Object>} 處理結果
   * @private
   */
  async _dispatchEventHandler (type, data) {
    const { EVENTS, ERRORS } = MessageTracker.CONSTANTS

    switch (type) {
      case EVENTS.INPUT.MESSAGE_SENT:
        return await this._handleMessageSent(data)

      case EVENTS.INPUT.MESSAGE_RECEIVED:
        return await this._handleMessageReceived(data)

      case EVENTS.INPUT.MESSAGE_PROCESSED:
        return await this._handleMessageProcessed(data)

      case EVENTS.INPUT.MESSAGE_FAILED:
        return await this._handleMessageFailed(data)

      default:
        return this._createErrorResponse(
          ERRORS.MESSAGES.UNSUPPORTED_EVENT_TYPE,
          type
        )
    }
  }

  /**
   * 處理訊息發送事件
   * @param {Object} messageData - 訊息資料
   * @returns {Object} 處理結果
   * @private
   */
  async _handleMessageSent (messageData) {
    const {
      messageId,
      type,
      source,
      target,
      data,
      timestamp = Date.now()
    } = messageData

    // 生成訊息記錄
    const messageRecord = this._createMessageRecord({
      id: messageId || this._generateMessageId(),
      type,
      source,
      target,
      status: MessageTracker.CONSTANTS.MESSAGE.STATUS.SENT,
      timestamp,
      data
    })

    // 添加到活躍訊息
    this.activeMessages.set(messageRecord.id, messageRecord)

    // 記錄訊息
    this._recordMessage(messageRecord)

    // 更新統計
    this._updateTrackingStats('sent', timestamp)

    // 發送追蹤事件
    this._emitDiagnosticEvent(
      'message_sent',
      messageRecord.id,
      type,
      timestamp
    )

    return { success: true, messageId: messageRecord.id }
  }

  /**
   * 處理訊息接收事件
   * @param {Object} messageData - 訊息資料
   * @returns {Object} 處理結果
   */
  async _handleMessageReceived (messageData) {
    const { messageId, type, source, timestamp = Date.now() } = messageData

    // 查找或創建訊息記錄
    const messageRecord = this._findOrCreateMessageRecord(messageId, {
      type,
      source,
      status: MessageTracker.CONSTANTS.MESSAGE.STATUS.RECEIVED,
      timestamp
    })

    // 更新接收狀態
    messageRecord.status = MessageTracker.CONSTANTS.MESSAGE.STATUS.RECEIVED
    messageRecord.receivedTime = timestamp

    // 記錄訊息
    this._recordMessage({ ...messageRecord })

    // 更新統計
    this._updateTrackingStats('received', timestamp)

    return { success: true, messageId: messageRecord.id }
  }

  /**
   * 查找或創建訊息記錄
   * @param {string} messageId - 訊息ID
   * @param {Object} defaultData - 預設資料
   * @returns {Object} 訊息記錄
   * @private
   */
  _findOrCreateMessageRecord (messageId, defaultData) {
    let messageRecord = this.activeMessages.get(messageId)

    if (!messageRecord) {
      messageRecord = this._createMessageRecord({
        id: messageId || this._generateMessageId(),
        ...defaultData
      })
      this.activeMessages.set(messageRecord.id, messageRecord)
    }

    return messageRecord
  }

  /**
   * 記錄訊息到日誌
   * @param {Object} messageRecord - 訊息記錄
   * @private
   */
  _recordMessage (messageRecord) {
    this.messageLog.push({ ...messageRecord })

    // 限制記錄數量
    if (this.messageLog.length > this.config.maxMessageRecords) {
      this.messageLog.shift()
    }
  }

  /**
   * 發送診斷事件
   * @param {string} action - 動作類型
   * @param {string} messageId - 訊息ID
   * @param {string} type - 訊息類型
   * @param {number} timestamp - 時間戳
   * @private
   */
  _emitDiagnosticEvent (action, messageId, type, timestamp) {
    const { EVENTS } = MessageTracker.CONSTANTS

    this.eventBus.emit(EVENTS.OUTPUT.DIAGNOSTIC_INFO_UPDATED, {
      action,
      messageId,
      type,
      timestamp
    })
  }

  /**
   * 處理訊息處理完成事件
   * @param {Object} messageData - 訊息資料
   * @returns {Object} 處理結果
   */
  async _handleMessageProcessed (messageData) {
    const {
      messageId,
      result,
      processingTime,
      timestamp = Date.now()
    } = messageData

    const messageRecord = this.activeMessages.get(messageId)

    if (messageRecord) {
      messageRecord.status = MessageTracker.CONSTANTS.MESSAGE.STATUS.PROCESSED
      messageRecord.processedTime = timestamp
      messageRecord.result = result
      messageRecord.processingTime =
        processingTime || this._calculateProcessingTime(messageRecord)

      // 記錄到訊息日誌
      this._recordMessage({ ...messageRecord })

      // 從活躍訊息中移除
      this.activeMessages.delete(messageId)

      // 更新統計
      this._updateTrackingStats(
        'processed',
        timestamp,
        messageRecord.processingTime
      )

      // 發送流程完成事件
      const { EVENTS } = MessageTracker.CONSTANTS
      this.eventBus.emit(EVENTS.OUTPUT.MESSAGE_FLOW_COMPLETED, {
        messageId,
        type: messageRecord.type,
        processingTime: messageRecord.processingTime,
        timestamp
      })
    }

    return { success: true, messageId }
  }

  /**
   * 處理訊息失敗事件
   * @param {Object} messageData - 訊息資料
   * @returns {Object} 處理結果
   */
  async _handleMessageFailed (messageData) {
    const { messageId, error, timestamp = Date.now() } = messageData

    const messageRecord = this.activeMessages.get(messageId)

    if (messageRecord) {
      messageRecord.status = MessageTracker.CONSTANTS.MESSAGE.STATUS.FAILED
      messageRecord.failedTime = timestamp
      messageRecord.error = error
      messageRecord.processingTime =
        this._calculateProcessingTime(messageRecord)

      // 記錄到訊息日誌
      this._recordMessage({ ...messageRecord })

      // 從活躍訊息中移除
      this.activeMessages.delete(messageId)
    }

    // 總是更新統計，即使沒有找到對應的記錄
    this._updateTrackingStats('failed', timestamp)

    return { success: true, messageId }
  }

  /**
   * 創建訊息記錄
   * @param {Object} recordData - 記錄資料
   * @returns {Object} 訊息記錄
   * @private
   */
  _createMessageRecord (recordData) {
    return {
      id: recordData.id,
      type: recordData.type,
      source: recordData.source,
      target: recordData.target,
      status: recordData.status,
      timestamp: recordData.timestamp,
      data: recordData.data,
      error: recordData.error,
      result: recordData.result,
      processingTime: recordData.processingTime,
      receivedTime: recordData.receivedTime,
      processedTime: recordData.processedTime,
      failedTime: recordData.failedTime
    }
  }

  /**
   * 添加到訊息日誌
   * @param {Object} messageRecord - 訊息記錄
   */
  addToMessageLog (messageRecord) {
    this.messageLog.push({ ...messageRecord })

    // 限制記錄數量
    if (this.messageLog.length > this.maxMessageRecords) {
      this.messageLog.shift()
    }
  }

  /**
   * 更新追蹤統計
   * @param {string} action - 動作類型
   * @param {number} timestamp - 時間戳
   * @param {number} [processingTime] - 處理時間
   * @private
   */
  _updateTrackingStats (action, timestamp, processingTime) {
    this.trackingStats.lastMessageTime = timestamp

    switch (action) {
      case 'sent':
        this.trackingStats.totalMessages++
        break
      case 'received':
        // 接收統計可以在這裡添加
        break
      case 'processed':
        this.trackingStats.processedMessages++
        if (processingTime) {
          this._updateAverageProcessingTime(processingTime)
        }
        break
      case 'failed':
        this.trackingStats.failedMessages++
        break
    }
  }

  /**
   * 更新平均處理時間
   * @param {number} processingTime - 處理時間
   * @private
   */
  _updateAverageProcessingTime (processingTime) {
    const { processedMessages, averageProcessingTime } = this.trackingStats
    this.trackingStats.averageProcessingTime =
      (averageProcessingTime * (processedMessages - 1) + processingTime) /
      processedMessages
  }

  /**
   * 計算處理時間
   * @param {Object} messageRecord - 訊息記錄
   * @returns {number} 處理時間（毫秒）
   * @private
   */
  _calculateProcessingTime (messageRecord) {
    const endTime =
      messageRecord.processedTime || messageRecord.failedTime || Date.now()
    const startTime = messageRecord.receivedTime || messageRecord.timestamp
    return endTime - startTime
  }

  /**
   * 生成訊息ID
   * @returns {string} 訊息ID
   * @private
   */
  _generateMessageId () {
    return `MSG_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * 設置 Console 診斷介面
   * @private
   */
  _setupConsoleInterface () {
    try {
      const { CONSOLE } = MessageTracker.CONSTANTS

      window.MessageDiagnostic = {
        [CONSOLE.COMMANDS.STATUS]: () => this.getTrackingStatus(),
        [CONSOLE.COMMANDS.MESSAGES]: (limit) => this.getRecentMessages(limit),
        [CONSOLE.COMMANDS.UNKNOWN]: () => this.getUnknownMessages(),
        [CONSOLE.COMMANDS.CLEAR]: () => this.clearTrackingLog(),
        [CONSOLE.COMMANDS.ACTIVE]: () => this.getActiveMessages(),
        [CONSOLE.COMMANDS.STATS]: () => this.getTrackingStats()
      }

      console.log(CONSOLE.MESSAGES.INTERFACE_ENABLED)
      console.log(CONSOLE.MESSAGES.USAGE_HINT)
    } catch (error) {
      const { ERRORS } = MessageTracker.CONSTANTS
      console.warn(
        `[MessageTracker] ${ERRORS.MESSAGES.CONSOLE_UNAVAILABLE}:`,
        error
      )
    }
  }

  /**
   * 獲取追蹤狀態
   * @returns {Object} 追蹤狀態
   */
  getTrackingStatus () {
    const status = {
      enabled: this.trackingEnabled,
      diagnosticMode: this.diagnosticMode,
      uptime: Date.now() - this.startTime,
      activeMessages: this.activeMessages.size,
      totalRecords: this.messageLog.length,
      ...this.trackingStats
    }

    console.table(status)
    return status
  }

  /**
   * 獲取最近的訊息記錄
   * @param {number} [limit] - 限制數量
   * @returns {Array} 訊息記錄
   */
  getRecentMessages (limit) {
    const { CONFIG } = MessageTracker.CONSTANTS
    const actualLimit = limit || this.config.consoleLogLimit
    const messages = this.messageLog.slice(-actualLimit)

    console.group('最近訊息記錄')
    messages.forEach((msg, index) => {
      console.log(`${index + 1}.`, msg)
    })
    console.groupEnd()

    return messages
  }

  /**
   * 獲取未知訊息
   * @returns {Array} 未知訊息記錄
   */
  getUnknownMessages () {
    console.warn('未知訊息類型:', this.unknownMessages)
    return this.unknownMessages
  }

  /**
   * 獲取活躍訊息
   * @returns {Array} 活躍訊息記錄
   */
  getActiveMessages () {
    const active = Array.from(this.activeMessages.values())
    console.log('當前活躍訊息:', active)
    return active
  }

  /**
   * 獲取追蹤統計
   * @returns {Object} 統計資訊
   */
  getTrackingStats () {
    return { ...this.trackingStats }
  }

  /**
   * 清除追蹤記錄
   * @returns {Object} 清除結果
   */
  clearTrackingLog () {
    const clearedCount = this.messageLog.length
    this.messageLog = []
    this.unknownMessages = []

    console.log(`已清除 ${clearedCount} 條追蹤記錄`)
    return { clearedCount }
  }

  /**
   * 設置清理定時器
   * @private
   */
  _setupCleanupTimer () {
    const { CONFIG } = MessageTracker.CONSTANTS

    setInterval(() => {
      this._cleanupTimeoutMessages()
    }, this.config.cleanupIntervalMs)
  }

  /**
   * 清理超時的訊息
   */
  _cleanupTimeoutMessages () {
    const now = Date.now()
    const timeoutMessages = []

    for (const [messageId, messageRecord] of this.activeMessages.entries()) {
      if (now - messageRecord.timestamp > this.config.messageTimeoutMs) {
        messageRecord.status = MessageTracker.CONSTANTS.MESSAGE.STATUS.TIMEOUT
        messageRecord.timeoutTime = now

        timeoutMessages.push(messageRecord)
        this.activeMessages.delete(messageId)
      }
    }

    // 將超時訊息添加到日誌
    timeoutMessages.forEach((record) => {
      this._recordMessage(record)
    })

    if (timeoutMessages.length > 0 && this.diagnosticMode) {
      console.warn(
        `[MessageTracker] 清理了 ${timeoutMessages.length} 個超時訊息`
      )
    }
  }

  /**
   * 啟用/停用追蹤
   * @param {boolean} enabled - 是否啟用
   */
  setTrackingEnabled (enabled) {
    this.trackingEnabled = enabled

    if (enabled) {
      const { EVENTS } = MessageTracker.CONSTANTS
      this.eventBus.emit(EVENTS.OUTPUT.TRACKING_STARTED, {
        timestamp: Date.now()
      })
    }
  }

  /**
   * 啟用/停用診斷模式
   * @param {boolean} enabled - 是否啟用
   */
  setDiagnosticMode (enabled) {
    const { CONSOLE } = MessageTracker.CONSTANTS
    this.diagnosticMode = enabled
    console.log(
      enabled
        ? CONSOLE.MESSAGES.DIAGNOSTIC_MODE_ON
        : CONSOLE.MESSAGES.DIAGNOSTIC_MODE_OFF
    )
  }

  /**
   * 手動觸發清理超時訊息 (用於測試)
   */
  cleanupTimeoutMessages () {
    this._cleanupTimeoutMessages()
  }

  /**
   * 創建標準化錯誤回應
   * @param {string} message - 錯誤訊息
   * @param {string} [details] - 額外詳細資訊
   * @returns {Object} 標準化錯誤回應
   * @private
   */
  _createErrorResponse (message, details = null) {
    const errorResponse = {
      success: false,
      error: message,
      timestamp: Date.now(),
      trackerId: this._generateMessageId()
    }

    if (details) {
      errorResponse.details = details
    }

    return errorResponse
  }
}

module.exports = MessageTracker
