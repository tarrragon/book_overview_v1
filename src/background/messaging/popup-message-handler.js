/**
 * Popup 訊息處理器
 *
 * 負責功能：
 * - 處理來自 Popup 界面的所有訊息類型
 * - 實現與 Popup 的雙向通訊和狀態同步
 * - 管理 Popup 的連接狀態和會話
 * - 提供 Popup 所需的資料查詢和操作介面
 *
 * 設計考量：
 * - 基於 BaseModule 實現標準生命週期管理
 * - 支援 Popup 的快速響應和即時更新
 * - 實現操作權限檢查和安全驗證
 * - 提供完整的 Popup 狀態追蹤和統計
 */

const BaseModule = require('src/background/lifecycle/base-module')
const ErrorCodes = require('src/core/errors/ErrorCodes')

class PopupMessageHandler extends BaseModule {
  constructor (dependencies = {}) {
    super(dependencies)

    // Popup 連接管理
    this.activePopupSessions = new Map() // sessionId -> sessionInfo
    this.currentPopupConnection = null

    // 訊息統計
    this.popupStats = {
      total: 0,
      success: 0,
      failed: 0,
      activeSessions: 0,
      dataQueries: 0,
      operations: 0,
      byMessageType: new Map()
    }

    // 支援的訊息類型
    this.supportedMessageTypes = new Set([
      'POPUP.TO.BACKGROUND',
      'POPUP.STATUS.REQUEST',
      'POPUP.DATA.REQUEST',
      'POPUP.OPERATION.REQUEST',
      'POPUP.SESSION.START',
      'POPUP.SESSION.END',
      'POPUP.EXTRACTION.START',
      'POPUP.EXPORT.REQUEST'
    ])

    // 操作權限配置
    this.operationPermissions = {
      'EXTRACTION.START': { requiresActiveTab: true, requiresReadmoo: true },
      'DATA.EXPORT': { requiresData: true },
      'SYSTEM.RELOAD': { requiresConfirmation: true },
      'STORAGE.CLEAR': { requiresConfirmation: true }
    }
  }

  /**
   * 初始化 Popup 訊息處理器
   * @returns {Promise<void>}
   * @protected
   */
  async _doInitialize () {
    this.logger.log('🎨 初始化 Popup 訊息處理器')

    // 清理可能存在的舊會話
    this.activePopupSessions.clear()
    this.currentPopupConnection = null

    // 重置統計
    this.resetStats()

    this.logger.log('✅ Popup 訊息處理器初始化完成')
  }

  /**
   * 啟動 Popup 訊息處理器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStart () {
    this.logger.log('▶️ 啟動 Popup 訊息處理器')

    // 觸發處理器啟動事件
    if (this.eventBus) {
      await this.eventBus.emit('POPUP.HANDLER.STARTED', {
        timestamp: Date.now()
      })
    }

    this.logger.log('✅ Popup 訊息處理器啟動完成')
  }

  /**
   * 停止 Popup 訊息處理器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStop () {
    this.logger.log('⏹️ 停止 Popup 訊息處理器')

    // 通知所有 Popup 會話系統即將關閉
    await this.notifyPopupSessionsShutdown()

    // 清理會話
    this.activePopupSessions.clear()
    this.currentPopupConnection = null

    this.logger.log('✅ Popup 訊息處理器停止完成')
  }

  /**
   * 處理來自 Popup 的訊息
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>} 是否需要保持連接開啟
   */
  async handleMessage (message, sender, sendResponse) {
    try {
      this.logger.log('🎨 處理 Popup 訊息:', {
        type: message?.type,
        sessionId: message?.sessionId
      })

      // 驗證訊息格式
      const validationResult = this.validateMessage(message, sender)
      if (!validationResult.isValid) {
        const error = new Error(validationResult.errorMessage)
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = {
          category: 'general',
          validationFailure: validationResult.reason,
          messageType: message?.type || 'unknown',
          senderUrl: sender?.url || 'unknown'
        }
        throw error
      }

      // 更新統計
      this.updatePopupStats(message, sender)

      // 更新或建立會話
      this.updatePopupSession(message, sender)

      // 根據訊息類型處理
      const result = await this.routePopupMessage(message, sender, sendResponse)

      // 更新成功統計
      this.popupStats.success++

      return result
    } catch (error) {
      this.logger.error('❌ Popup 訊息處理失敗:', error)

      // 更新失敗統計
      this.popupStats.failed++

      // 發送錯誤回應
      sendResponse({
        success: false,
        error: error.message,
        timestamp: Date.now()
      })

      // 觸發錯誤事件
      if (this.eventBus) {
        await this.eventBus.emit('POPUP.MESSAGE.ERROR', {
          error: error.message,
          messageType: message?.type,
          sessionId: message?.sessionId,
          timestamp: Date.now()
        })
      }

      return false
    }
  }

  /**
   * 驗證訊息格式
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @returns {Object} 驗證結果 { isValid: boolean, reason: string, errorMessage: string }
   * @private
   */
  validateMessage (message, sender) {
    // 基本格式檢查
    if (!message || typeof message !== 'object') {
      return {
        isValid: false,
        reason: 'invalid_format',
        errorMessage: '訊息必須是有效的物件格式'
      }
    }

    // 訊息類型檢查
    if (!message.type) {
      return {
        isValid: false,
        reason: 'missing_type',
        errorMessage: '訊息缺少必要的 type 欄位'
      }
    }

    if (!this.supportedMessageTypes.has(message.type)) {
      return {
        isValid: false,
        reason: 'unsupported_type',
        errorMessage: `不支援的訊息類型: ${message.type}`
      }
    }

    // 發送者檢查（必須來自 popup）
    if (!sender.url || !sender.url.includes('popup.html')) {
      return {
        isValid: false,
        reason: 'invalid_sender',
        errorMessage: '訊息必須來自 popup 頁面'
      }
    }

    return {
      isValid: true,
      reason: null,
      errorMessage: null
    }
  }

  /**
   * 路由 Popup 訊息
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async routePopupMessage (message, sender, sendResponse) {
    switch (message.type) {
      case 'POPUP.TO.BACKGROUND':
        return await this.handlePopupToBackgroundMessage(message, sender, sendResponse)

      case 'POPUP.STATUS.REQUEST':
        return await this.handlePopupStatusRequest(message, sender, sendResponse)

      case 'POPUP.DATA.REQUEST':
        return await this.handlePopupDataRequest(message, sender, sendResponse)

      case 'POPUP.OPERATION.REQUEST':
        return await this.handlePopupOperationRequest(message, sender, sendResponse)

      case 'POPUP.SESSION.START':
        return await this.handlePopupSessionStart(message, sender, sendResponse)

      case 'POPUP.SESSION.END':
        return await this.handlePopupSessionEnd(message, sender, sendResponse)

      case 'POPUP.EXTRACTION.START':
        return await this.handlePopupExtractionStart(message, sender, sendResponse)

      case 'POPUP.EXPORT.REQUEST':
        return await this.handlePopupExportRequest(message, sender, sendResponse)

      default: {
        const error = new Error(`未支援的訊息類型: ${message.type}`)
        error.code = ErrorCodes.UNSUPPORTED_OPERATION
        error.details = {
          category: 'general',
          messageType: message.type
        }
        throw error
      }
    }
  }

  /**
   * 處理 Popup 到 Background 的一般訊息
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handlePopupToBackgroundMessage (message, sender, sendResponse) {
    this.logger.log('🎨 處理 Popup 一般訊息:', message.data)

    // 觸發內部事件
    if (this.eventBus) {
      await this.eventBus.emit('POPUP.MESSAGE.RECEIVED', {
        data: message.data,
        sessionId: message.sessionId,
        timestamp: Date.now()
      })
    }

    sendResponse({
      success: true,
      message: '訊息已處理',
      timestamp: Date.now()
    })

    return false
  }

  /**
   * 處理 Popup 狀態請求
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handlePopupStatusRequest (message, sender, sendResponse) {
    try {
      // 獲取系統狀態
      const systemStatus = await chrome.storage.local.get([
        'isEnabled',
        'extractionSettings',
        'last_extraction'
      ])

      // 獲取當前標籤頁資訊
      const activeTab = await this.getCurrentActiveTab()
      const isReadmooPage = activeTab && activeTab.url && activeTab.url.includes('readmoo.com')

      // 獲取事件系統狀態
      const eventSystemStatus = this.eventBus
        ? {
            initialized: true,
            stats: typeof this.eventBus.getStats === 'function' ? this.eventBus.getStats() : null
          }
        : { initialized: false }

      const response = {
        success: true,
        systemStatus: {
          isEnabled: systemStatus.isEnabled ?? true,
          serviceWorkerActive: true,
          ...systemStatus
        },
        tabStatus: {
          activeTab,
          isReadmooPage,
          canExtract: isReadmooPage && systemStatus.isEnabled !== false
        },
        eventSystem: eventSystemStatus,
        popupStats: { ...this.popupStats },
        timestamp: Date.now()
      }

      sendResponse(response)
      return false
    } catch (error) {
      this.logger.error('❌ 獲取狀態失敗:', error)
      sendResponse({
        success: false,
        error: error.message,
        timestamp: Date.now()
      })
      return false
    }
  }

  /**
   * 處理 Popup 資料請求
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handlePopupDataRequest (message, sender, sendResponse) {
    try {
      this.popupStats.dataQueries++

      const dataType = message.data?.type
      this.logger.log(`📊 處理 Popup 資料請求: ${dataType}`)

      let responseData = {}

      switch (dataType) {
        case 'books': {
          const booksData = await chrome.storage.local.get('readmoo_books')
          responseData = {
            books: booksData.readmoo_books?.books || [],
            count: booksData.readmoo_books?.extractionCount || 0,
            lastExtraction: booksData.readmoo_books?.extractionTimestamp || null
          }
          break
        }

        case 'extraction_history': {
          const historyData = await chrome.storage.local.get('extraction_history')
          responseData = {
            history: historyData.extraction_history || []
          }
          break
        }

        case 'system_info': {
          const manifest = chrome.runtime.getManifest()
          responseData = {
            version: manifest.version,
            permissions: manifest.permissions,
            uptime: Date.now() - (globalThis.backgroundStartTime || Date.now())
          }
          break
        }

        default: {
          const error = new Error(`未支援的資料類型: ${dataType}`)
          error.code = ErrorCodes.UNSUPPORTED_OPERATION
          error.details = {
            category: 'general',
            dataType
          }
          throw error
        }
      }

      sendResponse({
        success: true,
        data: responseData,
        dataType,
        timestamp: Date.now()
      })

      return false
    } catch (error) {
      this.logger.error('❌ 處理資料請求失敗:', error)
      sendResponse({
        success: false,
        error: error.message,
        timestamp: Date.now()
      })
      return false
    }
  }

  /**
   * 處理 Popup 操作請求
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handlePopupOperationRequest (message, sender, sendResponse) {
    try {
      this.popupStats.operations++

      const operation = message.data?.operation
      const params = message.data?.params || {}

      this.logger.log(`🔧 處理 Popup 操作請求: ${operation}`)

      // 檢查操作權限
      await this.checkOperationPermissions(operation, params)

      let result = {}

      switch (operation) {
        case 'SYSTEM.RELOAD':
          result = await this.handleSystemReload(params)
          break

        case 'STORAGE.CLEAR':
          result = await this.handleStorageClear(params)
          break

        case 'CONFIG.UPDATE':
          result = await this.handleConfigUpdate(params)
          break

        case 'TAB.NAVIGATE':
          result = await this.handleTabNavigate(params)
          break

        default: {
          const error = new Error(`未支援的操作: ${operation}`)
          error.code = ErrorCodes.UNSUPPORTED_OPERATION
          error.details = {
            category: 'general',
            operation
          }
          throw error
        }
      }

      sendResponse({
        success: true,
        result,
        operation,
        timestamp: Date.now()
      })

      return false
    } catch (error) {
      this.logger.error('❌ 處理操作請求失敗:', error)
      sendResponse({
        success: false,
        error: error.message,
        timestamp: Date.now()
      })
      return false
    }
  }

  /**
   * 處理 Popup 會話開始
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handlePopupSessionStart (message, sender, sendResponse) {
    const sessionId = message.sessionId || `popup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    this.logger.log(`🎪 開始 Popup 會話: ${sessionId}`)

    // 建立會話
    const sessionInfo = {
      sessionId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      sender: {
        url: sender.url,
        origin: sender.origin
      }
    }

    this.activePopupSessions.set(sessionId, sessionInfo)
    this.currentPopupConnection = sessionId
    this.popupStats.activeSessions = this.activePopupSessions.size

    // 觸發會話開始事件
    if (this.eventBus) {
      await this.eventBus.emit('POPUP.SESSION.STARTED', {
        sessionId,
        timestamp: Date.now()
      })
    }

    sendResponse({
      success: true,
      sessionId,
      message: 'Popup 會話已建立',
      timestamp: Date.now()
    })

    return false
  }

  /**
   * 處理 Popup 會話結束
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handlePopupSessionEnd (message, sender, sendResponse) {
    const sessionId = message.sessionId

    this.logger.log(`🎪 結束 Popup 會話: ${sessionId}`)

    // 清理會話
    if (this.activePopupSessions.has(sessionId)) {
      const sessionInfo = this.activePopupSessions.get(sessionId)
      const sessionDuration = Date.now() - sessionInfo.startTime

      this.activePopupSessions.delete(sessionId)

      if (this.currentPopupConnection === sessionId) {
        this.currentPopupConnection = null
      }

      this.popupStats.activeSessions = this.activePopupSessions.size

      // 觸發會話結束事件
      if (this.eventBus) {
        await this.eventBus.emit('POPUP.SESSION.ENDED', {
          sessionId,
          duration: sessionDuration,
          messageCount: sessionInfo.messageCount,
          timestamp: Date.now()
        })
      }
    }

    sendResponse({
      success: true,
      message: 'Popup 會話已結束',
      timestamp: Date.now()
    })

    return false
  }

  /**
   * 處理 Popup 提取開始請求
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handlePopupExtractionStart (message, sender, sendResponse) {
    try {
      // 檢查當前標籤頁是否為 Readmoo 頁面
      const activeTab = await this.getCurrentActiveTab()
      if (!activeTab || !activeTab.url || !activeTab.url.includes('readmoo.com')) {
        const error = new Error('當前標籤頁不是 Readmoo 頁面')
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = {
          category: 'general',
          requirement: 'readmoo_page'
        }
        throw error
      }

      this.logger.log('🚀 開始從 Popup 觸發的提取操作')

      // 發送訊息到 Content Script 開始提取
      const response = await chrome.tabs.sendMessage(activeTab.id, {
        type: 'START_EXTRACTION',
        params: message.data?.params || {},
        timestamp: Date.now()
      })

      // 觸發提取開始事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.STARTED.FROM.POPUP', {
          tabId: activeTab.id,
          url: activeTab.url,
          params: message.data?.params || {},
          timestamp: Date.now()
        })
      }

      sendResponse({
        success: true,
        message: '提取操作已開始',
        tabId: activeTab.id,
        response,
        timestamp: Date.now()
      })

      return false
    } catch (error) {
      this.logger.error('❌ 開始提取操作失敗:', error)
      sendResponse({
        success: false,
        error: error.message,
        timestamp: Date.now()
      })
      return false
    }
  }

  /**
   * 處理 Popup 匯出請求
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handlePopupExportRequest (message, sender, sendResponse) {
    try {
      const exportType = message.data?.type
      const options = message.data?.options || {}

      this.logger.log(`📤 處理 Popup 匯出請求: ${exportType}`)

      // 觸發匯出事件
      if (this.eventBus) {
        await this.eventBus.emit('EXPORT.REQUESTED', {
          type: exportType,
          options,
          source: 'popup',
          sessionId: message.sessionId,
          timestamp: Date.now()
        })
      }

      sendResponse({
        success: true,
        message: '匯出請求已處理',
        exportType,
        timestamp: Date.now()
      })

      return false
    } catch (error) {
      this.logger.error('❌ 處理匯出請求失敗:', error)
      sendResponse({
        success: false,
        error: error.message,
        timestamp: Date.now()
      })
      return false
    }
  }

  /**
   * 檢查操作權限
   * @param {string} operation - 操作類型
   * @param {Object} params - 操作參數
   * @returns {Promise<void>}
   * @private
   */
  async checkOperationPermissions (operation, params) {
    const permissions = this.operationPermissions[operation]
    if (!permissions) {
      return // 沒有特殊權限要求
    }

    if (permissions.requiresActiveTab) {
      const activeTab = await this.getCurrentActiveTab()
      if (!activeTab) {
        const error = new Error('操作需要活躍的標籤頁')
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = {
          category: 'general',
          requirement: 'active_tab'
        }
        throw error
      }
    }

    if (permissions.requiresReadmoo) {
      const activeTab = await this.getCurrentActiveTab()
      if (!activeTab || !activeTab.url || !activeTab.url.includes('readmoo.com')) {
        const error = new Error('操作需要 Readmoo 頁面')
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = {
          category: 'general',
          requirement: 'readmoo_page'
        }
        throw error
      }
    }

    if (permissions.requiresData) {
      const data = await chrome.storage.local.get('readmoo_books')
      if (!data.readmoo_books || !data.readmoo_books.books || data.readmoo_books.books.length === 0) {
        const error = new Error('操作需要已提取的資料')
        error.code = ErrorCodes.MISSING_REQUIRED_DATA
        error.details = {
          category: 'general',
          requirement: 'extracted_data'
        }
        throw error
      }
    }

    if (permissions.requiresConfirmation && !params.confirmed) {
      const error = new Error('操作需要使用者確認')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'general',
        requirement: 'user_confirmation'
      }
      throw error
    }
  }

  /**
   * 處理系統重新載入
   * @param {Object} params - 操作參數
   * @returns {Promise<Object>}
   * @private
   */
  async handleSystemReload (params) {
    this.logger.log('🔄 處理系統重新載入')

    // 觸發系統重新載入事件
    if (this.eventBus) {
      await this.eventBus.emit('SYSTEM.RELOAD.REQUESTED', {
        source: 'popup',
        timestamp: Date.now()
      })
    }

    // 延遲執行重新載入以允許回應發送
    setTimeout(() => {
      chrome.runtime.reload()
    }, 100)

    return { message: '系統將重新載入' }
  }

  /**
   * 處理儲存清除
   * @param {Object} params - 操作參數
   * @returns {Promise<Object>}
   * @private
   */
  async handleStorageClear (params) {
    this.logger.log('🗑️ 處理儲存清除')

    const clearType = params.type || 'all'
    const clearedItems = []

    switch (clearType) {
      case 'books':
        await chrome.storage.local.remove('readmoo_books')
        clearedItems.push('readmoo_books')
        break

      case 'history':
        await chrome.storage.local.remove('extraction_history')
        clearedItems.push('extraction_history')
        break

      case 'all':
        await chrome.storage.local.clear()
        clearedItems.push('all_data')
        break

      default: {
        const error = new Error(`未支援的清除類型: ${clearType}`)
        error.code = ErrorCodes.UNSUPPORTED_OPERATION
        error.details = {
          category: 'general',
          clearType
        }
        throw error
      }
    }

    // 觸發儲存清除事件
    if (this.eventBus) {
      await this.eventBus.emit('STORAGE.CLEARED', {
        type: clearType,
        clearedItems,
        source: 'popup',
        timestamp: Date.now()
      })
    }

    return { clearedItems, message: '儲存已清除' }
  }

  /**
   * 處理配置更新
   * @param {Object} params - 操作參數
   * @returns {Promise<Object>}
   * @private
   */
  async handleConfigUpdate (params) {
    this.logger.log('⚙️ 處理配置更新')

    const updates = params.updates || {}
    await chrome.storage.local.set(updates)

    // 觸發配置更新事件
    if (this.eventBus) {
      await this.eventBus.emit('CONFIG.UPDATED', {
        updates,
        source: 'popup',
        timestamp: Date.now()
      })
    }

    return { updates, message: '配置已更新' }
  }

  /**
   * 處理標籤頁導航
   * @param {Object} params - 操作參數
   * @returns {Promise<Object>}
   * @private
   */
  async handleTabNavigate (params) {
    const url = params.url
    if (!url) {
      const error = new Error('導航需要 URL')
      error.code = ErrorCodes.MISSING_REQUIRED_DATA
      error.details = {
        category: 'general',
        parameter: 'url'
      }
      throw error
    }

    this.logger.log(`🧭 處理標籤頁導航: ${url}`)

    const activeTab = await this.getCurrentActiveTab()
    if (activeTab) {
      await chrome.tabs.update(activeTab.id, { url })
    } else {
      await chrome.tabs.create({ url })
    }

    return { url, message: '導航已執行' }
  }

  /**
   * 獲取當前活躍標籤頁
   * @returns {Promise<Object|null>}
   * @private
   */
  async getCurrentActiveTab () {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      return activeTab || null
    } catch (error) {
      this.logger.error('❌ 獲取活躍標籤頁失敗:', error)
      return null
    }
  }

  /**
   * 通知 Popup 會話系統即將關閉
   * @returns {Promise<void>}
   * @private
   */
  async notifyPopupSessionsShutdown () {
    for (const [sessionId] of this.activePopupSessions) {
      // 觸發會話關閉事件
      if (this.eventBus) {
        await this.eventBus.emit('POPUP.SESSION.SHUTDOWN', {
          sessionId,
          timestamp: Date.now()
        })
      }
    }
  }

  /**
   * 更新 Popup 會話
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @private
   */
  updatePopupSession (message, sender) {
    const sessionId = message.sessionId

    if (sessionId && this.activePopupSessions.has(sessionId)) {
      const sessionInfo = this.activePopupSessions.get(sessionId)
      sessionInfo.lastActivity = Date.now()
      sessionInfo.messageCount++
    }
  }

  /**
   * 更新 Popup 統計
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @private
   */
  updatePopupStats (message, sender) {
    this.popupStats.total++

    // 按訊息類型統計
    const messageType = message.type
    if (!this.popupStats.byMessageType.has(messageType)) {
      this.popupStats.byMessageType.set(messageType, 0)
    }
    this.popupStats.byMessageType.set(messageType, this.popupStats.byMessageType.get(messageType) + 1)

    // 更新活躍會話數量
    this.popupStats.activeSessions = this.activePopupSessions.size
  }

  /**
   * 重置統計
   * @private
   */
  resetStats () {
    this.popupStats = {
      total: 0,
      success: 0,
      failed: 0,
      activeSessions: 0,
      dataQueries: 0,
      operations: 0,
      byMessageType: new Map()
    }
  }

  /**
   * 取得 Popup 狀態
   * @returns {Object} Popup 狀態報告
   */
  getPopupStatus () {
    return {
      activeSessions: Array.from(this.activePopupSessions.entries()).map(([sessionId, info]) => ({
        sessionId,
        ...info
      })),
      currentConnection: this.currentPopupConnection,
      stats: {
        ...this.popupStats,
        byMessageType: Object.fromEntries(this.popupStats.byMessageType)
      },
      operationPermissions: { ...this.operationPermissions },
      timestamp: Date.now()
    }
  }

  /**
   * 取得自訂健康狀態
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus () {
    const errorRate = this.popupStats.total > 0
      ? this.popupStats.failed / this.popupStats.total
      : 0

    return {
      activeSessions: this.popupStats.activeSessions,
      currentConnection: !!this.currentPopupConnection,
      errorRate,
      dataQueries: this.popupStats.dataQueries,
      operations: this.popupStats.operations,
      health: errorRate > 0.1 ? 'degraded' : 'healthy'
    }
  }
}

module.exports = PopupMessageHandler
