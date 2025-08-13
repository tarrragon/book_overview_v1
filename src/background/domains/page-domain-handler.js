/**
 * 頁面領域處理器
 *
 * 負責功能：
 * - 處理頁面檢測和導航相關的領域邏輯和業務規則
 * - 管理 Readmoo 頁面狀態變化和內容識別邏輯
 * - 實現頁面權限管理和操作授權決策
 * - 協調頁面相關的使用者互動和功能啟用邏輯
 *
 * 設計考量：
 * - 基於事件驅動架構，響應頁面相關事件
 * - 實現頁面領域的業務邏輯與技術實作分離
 * - 提供頁面操作權限的統一管理和決策邏輯
 * - 支援不同頁面類型的個別化處理策略
 */

const {
  PAGE_EVENTS,
  MESSAGE_TYPES,
  EVENT_PRIORITIES,
  OPERATION_PERMISSIONS,
  OPERATION_TYPES
} = require('../constants/module-constants')

class PageDomainHandler {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 頁面狀態管理
    this.pageStates = new Map()
    this.activeTabId = null
    this.currentPageContext = null

    // 頁面類型配置
    this.pageTypeConfigs = new Map()
    this.operationStrategies = new Map()
    this.permissionRules = new Map()

    // 使用者互動狀態
    this.userInteractions = {
      lastActivity: null,
      sessionActive: false,
      interactionHistory: []
    }

    // 事件監聽器記錄
    this.registeredListeners = new Map()

    // 統計資料
    this.domainStats = {
      pageEventsProcessed: 0,
      pageDetections: 0,
      navigationEvents: 0,
      permissionChecks: 0,
      operationRequests: 0,
      userInteractions: 0
    }

    // 處理器狀態
    this.initialized = false
    this.active = false
  }

  /**
   * 初始化頁面領域處理器
   * @returns {Promise<void>}
   */
  async initialize () {
    if (this.initialized) {
      this.logger.warn('⚠️ 頁面領域處理器已初始化')
      return
    }

    try {
      if (this.i18nManager) {
        this.logger.log(this.i18nManager.t('modules.operations.initialize', { moduleName: '頁面領域處理器' }))
      } else {
        this.logger.log('📄 初始化頁面領域處理器')
      }

      // 初始化頁面類型配置
      await this.initializePageTypeConfigs()

      // 初始化操作策略
      await this.initializeOperationStrategies()

      // 初始化權限規則
      await this.initializePermissionRules()

      // 載入頁面狀態
      await this.loadPageStates()

      this.initialized = true
      this.logger.log('✅ 頁面領域處理器初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化頁面領域處理器失敗:', error)
      throw error
    }
  }

  /**
   * 啟動頁面領域處理器
   * @returns {Promise<void>}
   */
  async start () {
    if (!this.initialized) {
      throw new Error('頁面領域處理器尚未初始化')
    }

    if (this.active) {
      this.logger.warn('⚠️ 頁面領域處理器已啟動')
      return
    }

    try {
      this.logger.log('▶️ 啟動頁面領域處理器')

      // 註冊事件監聽器
      await this.registerEventListeners()

      // 初始化使用者會話
      await this.initializeUserSession()

      this.active = true
      this.logger.log('✅ 頁面領域處理器啟動完成')
    } catch (error) {
      this.logger.error('❌ 啟動頁面領域處理器失敗:', error)
      throw error
    }
  }

  /**
   * 停止頁面領域處理器
   * @returns {Promise<void>}
   */
  async stop () {
    if (!this.active) {
      return
    }

    try {
      this.logger.log('⏹️ 停止頁面領域處理器')

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      // 保存頁面狀態
      await this.savePageStates()

      // 結束使用者會話
      await this.finalizeUserSession()

      this.active = false
      this.logger.log('✅ 頁面領域處理器停止完成')
    } catch (error) {
      this.logger.error('❌ 停止頁面領域處理器失敗:', error)
      throw error
    }
  }

  /**
   * 初始化頁面類型配置
   * @returns {Promise<void>}
   * @private
   */
  async initializePageTypeConfigs () {
    try {
      // 圖書館頁面配置
      this.pageTypeConfigs.set('library', {
        name: '圖書館',
        description: '使用者的個人書庫',
        supportedOperations: [
          OPERATION_TYPES.EXTRACTION_START,
          OPERATION_TYPES.DATA_EXPORT
        ],
        extractionCapabilities: {
          canExtractBooks: true,
          canExtractProgress: true,
          canExtractNotes: false
        },
        userInteractionFeatures: {
          showExtractButton: true,
          showProgressIndicator: true,
          allowBatchOperations: true
        }
      })

      // 書籍詳情頁面配置
      this.pageTypeConfigs.set('book', {
        name: '書籍詳情',
        description: '單一書籍的詳細資訊頁面',
        supportedOperations: [
          OPERATION_TYPES.TAB_NAVIGATE
        ],
        extractionCapabilities: {
          canExtractBooks: false,
          canExtractProgress: false,
          canExtractNotes: false
        },
        userInteractionFeatures: {
          showExtractButton: false,
          showProgressIndicator: false,
          allowBatchOperations: false
        }
      })

      // 閱讀器頁面配置
      this.pageTypeConfigs.set('reader', {
        name: '電子書閱讀器',
        description: '書籍閱讀介面',
        supportedOperations: [],
        extractionCapabilities: {
          canExtractBooks: false,
          canExtractProgress: false,
          canExtractNotes: true
        },
        userInteractionFeatures: {
          showExtractButton: false,
          showProgressIndicator: false,
          allowBatchOperations: false
        }
      })

      // 商店頁面配置
      this.pageTypeConfigs.set('store', {
        name: '書籍商店',
        description: '書籍購買和瀏覽頁面',
        supportedOperations: [
          OPERATION_TYPES.TAB_NAVIGATE
        ],
        extractionCapabilities: {
          canExtractBooks: false,
          canExtractProgress: false,
          canExtractNotes: false
        },
        userInteractionFeatures: {
          showExtractButton: false,
          showProgressIndicator: false,
          allowBatchOperations: false
        }
      })

      // 未知頁面配置
      this.pageTypeConfigs.set('unknown', {
        name: '未知頁面',
        description: '無法識別的 Readmoo 頁面',
        supportedOperations: [],
        extractionCapabilities: {
          canExtractBooks: false,
          canExtractProgress: false,
          canExtractNotes: false
        },
        userInteractionFeatures: {
          showExtractButton: false,
          showProgressIndicator: false,
          allowBatchOperations: false
        }
      })

      this.logger.log('🔧 頁面類型配置初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化頁面類型配置失敗:', error)
    }
  }

  /**
   * 初始化操作策略
   * @returns {Promise<void>}
   * @private
   */
  async initializeOperationStrategies () {
    try {
      // 提取操作策略
      this.operationStrategies.set(OPERATION_TYPES.EXTRACTION_START, async (context) => {
        const { tabId, pageType } = context

        this.logger.log(`🎯 執行提取操作策略: Tab ${tabId}, 頁面類型: ${pageType}`)

        // 檢查頁面是否支援提取
        const pageConfig = this.pageTypeConfigs.get(pageType)
        if (!pageConfig?.extractionCapabilities.canExtractBooks) {
          return {
            success: false,
            reason: 'page_not_supported',
            message: '此頁面不支援書籍提取功能'
          }
        }

        // 檢查 Content Script 狀態
        const contentScriptReady = await this.checkContentScriptReady(tabId)
        if (!contentScriptReady) {
          return {
            success: false,
            reason: 'content_script_not_ready',
            message: 'Content Script 尚未準備就緒'
          }
        }

        // 觸發提取開始事件
        if (this.eventBus) {
          await this.eventBus.emit('EXTRACTION.START.REQUESTED', {
            tabId,
            pageType,
            source: 'page_domain',
            timestamp: Date.now()
          })
        }

        return {
          success: true,
          action: 'extraction_started',
          message: '書籍提取已開始'
        }
      })

      // 資料匯出策略
      this.operationStrategies.set(OPERATION_TYPES.DATA_EXPORT, async (context) => {
        const { exportType, format } = context

        this.logger.log(`📤 執行資料匯出策略: 類型=${exportType}, 格式=${format}`)

        // 檢查是否有資料可匯出
        const hasData = await this.checkAvailableData(exportType)
        if (!hasData) {
          return {
            success: false,
            reason: 'no_data_available',
            message: '沒有可匯出的資料'
          }
        }

        // 觸發匯出請求事件
        if (this.eventBus) {
          await this.eventBus.emit('DATA.EXPORT.REQUESTED', {
            exportType,
            format,
            source: 'page_domain',
            timestamp: Date.now()
          })
        }

        return {
          success: true,
          action: 'export_started',
          message: '資料匯出已開始'
        }
      })

      // 標籤頁導航策略
      this.operationStrategies.set(OPERATION_TYPES.TAB_NAVIGATE, async (context) => {
        const { url, target } = context

        this.logger.log(`🧭 執行標籤頁導航策略: ${url}`)

        // 驗證 URL 安全性
        if (!this.validateNavigationUrl(url)) {
          return {
            success: false,
            reason: 'invalid_url',
            message: '無效的導航 URL'
          }
        }

        // 執行導航
        try {
          if (target === 'new_tab') {
            await chrome.tabs.create({ url })
          } else {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
            if (tabs.length > 0) {
              await chrome.tabs.update(tabs[0].id, { url })
            }
          }

          return {
            success: true,
            action: 'navigation_completed',
            message: '導航已完成'
          }
        } catch (error) {
          return {
            success: false,
            reason: 'navigation_failed',
            message: `導航失敗: ${error.message}`
          }
        }
      })

      this.logger.log('🔧 操作策略初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化操作策略失敗:', error)
    }
  }

  /**
   * 初始化權限規則
   * @returns {Promise<void>}
   * @private
   */
  async initializePermissionRules () {
    try {
      // 複製預設權限配置
      for (const [operation, permissions] of Object.entries(OPERATION_PERMISSIONS)) {
        this.permissionRules.set(operation, { ...permissions })
      }

      // 自訂權限檢查規則
      this.permissionRules.set('CUSTOM.PAGE.ACCESS', {
        requiresReadmoo: true,
        requiresContentScript: true,
        checkFunction: async (context) => {
          const { tabId, pageType } = context

          // 檢查頁面是否為 Readmoo
          const pageState = this.pageStates.get(tabId)
          if (!pageState?.isReadmoo) {
            return { allowed: false, reason: 'not_readmoo_page' }
          }

          // 檢查頁面類型是否受支援
          const pageConfig = this.pageTypeConfigs.get(pageType)
          if (!pageConfig) {
            return { allowed: false, reason: 'unsupported_page_type' }
          }

          return { allowed: true }
        }
      })

      this.logger.log('🔧 權限規則初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化權限規則失敗:', error)
    }
  }

  /**
   * 載入頁面狀態
   * @returns {Promise<void>}
   * @private
   */
  async loadPageStates () {
    try {
      // 從 Chrome Storage 載入頁面狀態
      const stored = await chrome.storage.local.get(['page_states'])
      if (stored.page_states) {
        const states = stored.page_states

        // 只載入最近的頁面狀態
        const recentStates = states.filter(state =>
          Date.now() - state.timestamp < 3600000 // 1小時內
        )

        for (const state of recentStates) {
          this.pageStates.set(state.tabId, state)
        }

        this.logger.log(`📚 載入了 ${recentStates.length} 個頁面狀態`)
      }
    } catch (error) {
      this.logger.error('❌ 載入頁面狀態失敗:', error)
    }
  }

  /**
   * 保存頁面狀態
   * @returns {Promise<void>}
   * @private
   */
  async savePageStates () {
    try {
      const statesToSave = Array.from(this.pageStates.values())
        .filter(state => Date.now() - state.timestamp < 3600000) // 保存最近1小時的狀態
        .slice(-20) // 最多20個狀態

      await chrome.storage.local.set({
        page_states: statesToSave
      })

      this.logger.log(`💾 保存了 ${statesToSave.length} 個頁面狀態`)
    } catch (error) {
      this.logger.error('❌ 保存頁面狀態失敗:', error)
    }
  }

  /**
   * 註冊事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async registerEventListeners () {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 未初始化，跳過事件監聽器註冊')
      return
    }

    try {
      // Readmoo 頁面檢測事件
      this.registeredListeners.set('readmooDetected',
        this.eventBus.on(PAGE_EVENTS.READMOO_DETECTED,
          (event) => this.handleReadmooPageDetected(event.data),
          { priority: EVENT_PRIORITIES.HIGH }
        )
      )

      // 頁面導航變更事件
      this.registeredListeners.set('navigationChanged',
        this.eventBus.on(PAGE_EVENTS.NAVIGATION_CHANGED,
          (event) => this.handlePageNavigationChanged(event.data),
          { priority: EVENT_PRIORITIES.HIGH }
        )
      )

      // Content Script 就緒事件
      this.registeredListeners.set('contentReady',
        this.eventBus.on(PAGE_EVENTS.CONTENT_READY,
          (event) => this.handleContentScriptReady(event.data),
          { priority: EVENT_PRIORITIES.NORMAL }
        )
      )

      // Content Script 未就緒事件
      this.registeredListeners.set('contentNotReady',
        this.eventBus.on(PAGE_EVENTS.CONTENT_NOT_READY,
          (event) => this.handleContentScriptNotReady(event.data),
          { priority: EVENT_PRIORITIES.NORMAL }
        )
      )

      // 操作請求事件
      this.registeredListeners.set('operationRequest',
        this.eventBus.on('PAGE.OPERATION.REQUEST',
          (event) => this.handlePageOperationRequest(event.data),
          { priority: EVENT_PRIORITIES.HIGH }
        )
      )

      // 權限檢查請求事件
      this.registeredListeners.set('permissionCheck',
        this.eventBus.on('PAGE.PERMISSION.CHECK',
          (event) => this.handlePermissionCheckRequest(event.data),
          { priority: EVENT_PRIORITIES.NORMAL }
        )
      )

      // 使用者互動事件
      this.registeredListeners.set('userInteraction',
        this.eventBus.on('PAGE.USER.INTERACTION',
          (event) => this.handleUserInteraction(event.data),
          { priority: EVENT_PRIORITIES.LOW }
        )
      )

      // 標籤頁激活事件
      this.registeredListeners.set('tabActivated',
        this.eventBus.on('TAB.ACTIVATED',
          (event) => this.handleTabActivated(event.data),
          { priority: EVENT_PRIORITIES.NORMAL }
        )
      )

      this.logger.log('📝 頁面領域事件監聽器註冊完成')
    } catch (error) {
      this.logger.error('❌ 註冊事件監聽器失敗:', error)
    }
  }

  /**
   * 取消註冊事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async unregisterEventListeners () {
    if (!this.eventBus) {
      return
    }

    try {
      const eventTypes = {
        readmooDetected: PAGE_EVENTS.READMOO_DETECTED,
        navigationChanged: PAGE_EVENTS.NAVIGATION_CHANGED,
        contentReady: PAGE_EVENTS.CONTENT_READY,
        contentNotReady: PAGE_EVENTS.CONTENT_NOT_READY,
        operationRequest: 'PAGE.OPERATION.REQUEST',
        permissionCheck: 'PAGE.PERMISSION.CHECK',
        userInteraction: 'PAGE.USER.INTERACTION',
        tabActivated: 'TAB.ACTIVATED'
      }

      for (const [key, listenerId] of this.registeredListeners) {
        const eventType = eventTypes[key]
        if (eventType && listenerId) {
          this.eventBus.off(eventType, listenerId)
        }
      }

      this.registeredListeners.clear()
      this.logger.log('🔄 頁面領域事件監聽器取消註冊完成')
    } catch (error) {
      this.logger.error('❌ 取消註冊事件監聽器失敗:', error)
    }
  }

  /**
   * 處理 Readmoo 頁面檢測事件
   * @param {Object} data - 檢測資料
   * @returns {Promise<void>}
   * @private
   */
  async handleReadmooPageDetected (data) {
    try {
      const { tabId, pageType, features } = data
      this.domainStats.pageEventsProcessed++
      this.domainStats.pageDetections++

      this.logger.log(`🎯 處理 Readmoo 頁面檢測: Tab ${tabId}, 類型: ${pageType}`)

      // 建立或更新頁面狀態
      const pageState = {
        tabId,
        isReadmoo: true,
        pageType,
        features,
        detectedAt: Date.now(),
        timestamp: Date.now(),
        contentScriptReady: false,
        operationsEnabled: false
      }

      this.pageStates.set(tabId, pageState)

      // 分析頁面類型並設定操作能力
      await this.analyzePageCapabilities(pageState)

      // 更新當前頁面上下文（如果是活動標籤頁）
      if (tabId === this.activeTabId) {
        await this.updateCurrentPageContext(pageState)
      }

      // 觸發頁面準備事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.READMOO.PREPARED', {
          tabId,
          pageType,
          capabilities: this.getPageCapabilities(pageType),
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理 Readmoo 頁面檢測事件失敗:', error)
    }
  }

  /**
   * 處理頁面導航變更事件
   * @param {Object} data - 導航資料
   * @returns {Promise<void>}
   * @private
   */
  async handlePageNavigationChanged (data) {
    try {
      const { tabId, newUrl, pageType } = data
      this.domainStats.pageEventsProcessed++
      this.domainStats.navigationEvents++

      this.logger.log(`🧭 處理頁面導航變更: Tab ${tabId} → ${newUrl}`)

      // 更新頁面狀態
      if (this.pageStates.has(tabId)) {
        const pageState = this.pageStates.get(tabId)
        pageState.url = newUrl
        pageState.pageType = pageType
        pageState.navigationChangedAt = Date.now()
        pageState.timestamp = Date.now()

        // 重設 Content Script 狀態
        pageState.contentScriptReady = false
        pageState.operationsEnabled = false

        // 重新分析頁面能力
        await this.analyzePageCapabilities(pageState)

        // 更新當前頁面上下文
        if (tabId === this.activeTabId) {
          await this.updateCurrentPageContext(pageState)
        }
      }

      // 觸發導航完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.NAVIGATION.COMPLETED', {
          tabId,
          newUrl,
          pageType,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理頁面導航變更事件失敗:', error)
    }
  }

  /**
   * 處理 Content Script 就緒事件
   * @param {Object} data - 就緒資料
   * @returns {Promise<void>}
   * @private
   */
  async handleContentScriptReady (data) {
    try {
      const { tabId, pageType } = data
      this.domainStats.pageEventsProcessed++

      this.logger.log(`📝 處理 Content Script 就緒: Tab ${tabId}`)

      // 更新頁面狀態
      if (this.pageStates.has(tabId)) {
        const pageState = this.pageStates.get(tabId)
        pageState.contentScriptReady = true
        pageState.contentScriptReadyAt = Date.now()
        pageState.timestamp = Date.now()

        // 評估操作可用性
        await this.evaluateOperationAvailability(pageState)

        // 更新當前頁面上下文
        if (tabId === this.activeTabId) {
          await this.updateCurrentPageContext(pageState)
        }
      }

      // 觸發頁面完全就緒事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.FULLY.READY', {
          tabId,
          pageType,
          operations: this.getAvailableOperations(tabId),
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理 Content Script 就緒事件失敗:', error)
    }
  }

  /**
   * 處理 Content Script 未就緒事件
   * @param {Object} data - 未就緒資料
   * @returns {Promise<void>}
   * @private
   */
  async handleContentScriptNotReady (data) {
    try {
      const { tabId, reason } = data
      this.domainStats.pageEventsProcessed++

      this.logger.log(`⚠️ 處理 Content Script 未就緒: Tab ${tabId}, 原因: ${reason}`)

      // 更新頁面狀態
      if (this.pageStates.has(tabId)) {
        const pageState = this.pageStates.get(tabId)
        pageState.contentScriptReady = false
        pageState.operationsEnabled = false
        pageState.contentScriptError = reason
        pageState.timestamp = Date.now()

        // 更新當前頁面上下文
        if (tabId === this.activeTabId) {
          await this.updateCurrentPageContext(pageState)
        }
      }
    } catch (error) {
      this.logger.error('❌ 處理 Content Script 未就緒事件失敗:', error)
    }
  }

  /**
   * 處理頁面操作請求事件
   * @param {Object} data - 操作請求資料
   * @returns {Promise<void>}
   * @private
   */
  async handlePageOperationRequest (data) {
    try {
      const { operation, context, source, requestId } = data
      this.domainStats.pageEventsProcessed++
      this.domainStats.operationRequests++

      this.logger.log(`🎯 處理頁面操作請求: ${operation} (來源: ${source})`)

      // 檢查操作權限
      const permissionCheck = await this.checkOperationPermission(operation, context)

      if (!permissionCheck.allowed) {
        // 觸發操作拒絕事件
        if (this.eventBus) {
          await this.eventBus.emit('PAGE.OPERATION.DENIED', {
            operation,
            reason: permissionCheck.reason,
            context,
            requestId,
            timestamp: Date.now()
          })
        }

        this.logger.warn(`❌ 操作被拒絕: ${operation} - ${permissionCheck.reason}`)
        return
      }

      // 執行操作策略
      const strategy = this.operationStrategies.get(operation)
      if (!strategy) {
        this.logger.warn(`⚠️ 找不到操作策略: ${operation}`)
        return
      }

      const result = await strategy(context)

      // 觸發操作結果事件
      if (this.eventBus) {
        if (result.success) {
          await this.eventBus.emit('PAGE.OPERATION.COMPLETED', {
            operation,
            result,
            context,
            requestId,
            timestamp: Date.now()
          })
        } else {
          await this.eventBus.emit('PAGE.OPERATION.FAILED', {
            operation,
            result,
            context,
            requestId,
            timestamp: Date.now()
          })
        }
      }

      this.logger.log(`${result.success ? '✅' : '❌'} 操作執行${result.success ? '成功' : '失敗'}: ${operation}`)
    } catch (error) {
      this.logger.error('❌ 處理頁面操作請求失敗:', error)
    }
  }

  /**
   * 處理權限檢查請求事件
   * @param {Object} data - 權限檢查資料
   * @returns {Promise<void>}
   * @private
   */
  async handlePermissionCheckRequest (data) {
    try {
      const { operation, context, requestId } = data
      this.domainStats.pageEventsProcessed++
      this.domainStats.permissionChecks++

      this.logger.log(`🔒 處理權限檢查請求: ${operation}`)

      // 執行權限檢查
      const permissionResult = await this.checkOperationPermission(operation, context)

      // 觸發權限檢查結果事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.PERMISSION.RESULT', {
          operation,
          result: permissionResult,
          context,
          requestId,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理權限檢查請求失敗:', error)
    }
  }

  /**
   * 處理使用者互動事件
   * @param {Object} data - 互動資料
   * @returns {Promise<void>}
   * @private
   */
  async handleUserInteraction (data) {
    try {
      const { interactionType, context, tabId } = data
      this.domainStats.pageEventsProcessed++
      this.domainStats.userInteractions++

      this.logger.log(`👤 處理使用者互動: ${interactionType}`)

      // 更新互動狀態
      this.userInteractions.lastActivity = Date.now()
      this.userInteractions.sessionActive = true

      // 記錄互動歷史
      this.userInteractions.interactionHistory.push({
        type: interactionType,
        context,
        tabId,
        timestamp: Date.now()
      })

      // 限制歷史記錄大小
      if (this.userInteractions.interactionHistory.length > 50) {
        this.userInteractions.interactionHistory.shift()
      }
    } catch (error) {
      this.logger.error('❌ 處理使用者互動事件失敗:', error)
    }
  }

  /**
   * 處理標籤頁激活事件
   * @param {Object} data - 標籤頁資料
   * @returns {Promise<void>}
   * @private
   */
  async handleTabActivated (data) {
    try {
      const { tabId } = data
      this.domainStats.pageEventsProcessed++

      this.logger.log(`🔄 處理標籤頁激活: Tab ${tabId}`)

      // 更新活動標籤頁
      this.activeTabId = tabId

      // 更新當前頁面上下文
      const pageState = this.pageStates.get(tabId)
      if (pageState) {
        await this.updateCurrentPageContext(pageState)
      } else {
        this.currentPageContext = null
      }
    } catch (error) {
      this.logger.error('❌ 處理標籤頁激活事件失敗:', error)
    }
  }

  /**
   * 分析頁面能力
   * @param {Object} pageState - 頁面狀態
   * @returns {Promise<void>}
   * @private
   */
  async analyzePageCapabilities (pageState) {
    const { pageType } = pageState
    const pageConfig = this.pageTypeConfigs.get(pageType)

    if (pageConfig) {
      pageState.capabilities = {
        ...pageConfig.extractionCapabilities,
        supportedOperations: [...pageConfig.supportedOperations],
        userInteractionFeatures: { ...pageConfig.userInteractionFeatures }
      }
    } else {
      pageState.capabilities = {
        canExtractBooks: false,
        canExtractProgress: false,
        canExtractNotes: false,
        supportedOperations: [],
        userInteractionFeatures: {
          showExtractButton: false,
          showProgressIndicator: false,
          allowBatchOperations: false
        }
      }
    }

    this.logger.log(`📋 頁面能力分析完成: Tab ${pageState.tabId}, 類型: ${pageType}`)
  }

  /**
   * 評估操作可用性
   * @param {Object} pageState - 頁面狀態
   * @returns {Promise<void>}
   * @private
   */
  async evaluateOperationAvailability (pageState) {
    const { capabilities, contentScriptReady } = pageState

    // 只有在 Content Script 就緒且頁面支援時才啟用操作
    pageState.operationsEnabled = contentScriptReady && (
      capabilities.canExtractBooks ||
      capabilities.supportedOperations.length > 0
    )

    this.logger.log(`⚖️ 操作可用性評估完成: Tab ${pageState.tabId}, 啟用: ${pageState.operationsEnabled}`)
  }

  /**
   * 更新當前頁面上下文
   * @param {Object} pageState - 頁面狀態
   * @returns {Promise<void>}
   * @private
   */
  async updateCurrentPageContext (pageState) {
    this.currentPageContext = {
      tabId: pageState.tabId,
      isReadmoo: pageState.isReadmoo,
      pageType: pageState.pageType,
      contentScriptReady: pageState.contentScriptReady,
      operationsEnabled: pageState.operationsEnabled,
      capabilities: pageState.capabilities,
      lastUpdate: Date.now()
    }

    // 觸發頁面上下文更新事件
    if (this.eventBus) {
      await this.eventBus.emit('PAGE.CONTEXT.UPDATED', {
        context: this.currentPageContext,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 檢查操作權限
   * @param {string} operation - 操作類型
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 權限檢查結果
   * @private
   */
  async checkOperationPermission (operation, context) {
    try {
      const permissionRule = this.permissionRules.get(operation)
      if (!permissionRule) {
        return { allowed: false, reason: 'unknown_operation' }
      }

      const { tabId, pageType } = context

      // 檢查是否需要 Readmoo 頁面
      if (permissionRule.requiresReadmoo) {
        const pageState = this.pageStates.get(tabId)
        if (!pageState?.isReadmoo) {
          return { allowed: false, reason: 'not_readmoo_page' }
        }
      }

      // 檢查是否需要活動標籤頁
      if (permissionRule.requiresActiveTab) {
        if (tabId !== this.activeTabId) {
          return { allowed: false, reason: 'not_active_tab' }
        }
      }

      // 檢查是否需要 Content Script
      if (permissionRule.requiresContentScript) {
        const pageState = this.pageStates.get(tabId)
        if (!pageState?.contentScriptReady) {
          return { allowed: false, reason: 'content_script_not_ready' }
        }
      }

      // 執行自訂檢查函數
      if (permissionRule.checkFunction) {
        const customResult = await permissionRule.checkFunction(context)
        if (!customResult.allowed) {
          return customResult
        }
      }

      return { allowed: true }
    } catch (error) {
      this.logger.error('❌ 權限檢查失敗:', error)
      return { allowed: false, reason: 'permission_check_error' }
    }
  }

  /**
   * 檢查 Content Script 是否就緒
   * @param {number} tabId - 標籤頁 ID
   * @returns {Promise<boolean>} 是否就緒
   * @private
   */
  async checkContentScriptReady (tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPES.PING })
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 檢查可用資料
   * @param {string} exportType - 匯出類型
   * @returns {Promise<boolean>} 是否有資料
   * @private
   */
  async checkAvailableData (exportType) {
    try {
      const data = await chrome.storage.local.get(['readmoo_books'])
      return data.readmoo_books &&
             data.readmoo_books.books &&
             Array.isArray(data.readmoo_books.books) &&
             data.readmoo_books.books.length > 0
    } catch (error) {
      return false
    }
  }

  /**
   * 驗證導航 URL
   * @param {string} url - URL
   * @returns {boolean} 是否有效
   * @private
   */
  validateNavigationUrl (url) {
    try {
      const urlObj = new URL(url)
      const allowedHosts = ['readmoo.com', 'www.readmoo.com']
      return allowedHosts.some(host => urlObj.hostname.endsWith(host))
    } catch (error) {
      return false
    }
  }

  /**
   * 初始化使用者會話
   * @returns {Promise<void>}
   * @private
   */
  async initializeUserSession () {
    this.userInteractions.sessionActive = true
    this.userInteractions.lastActivity = Date.now()

    this.logger.log('👤 使用者會話已初始化')
  }

  /**
   * 結束使用者會話
   * @returns {Promise<void>}
   * @private
   */
  async finalizeUserSession () {
    this.userInteractions.sessionActive = false

    this.logger.log('👤 使用者會話已結束')
  }

  /**
   * 獲取頁面能力
   * @param {string} pageType - 頁面類型
   * @returns {Object} 頁面能力
   */
  getPageCapabilities (pageType) {
    const pageConfig = this.pageTypeConfigs.get(pageType)
    return pageConfig
      ? {
          ...pageConfig.extractionCapabilities,
          supportedOperations: [...pageConfig.supportedOperations],
          userInteractionFeatures: { ...pageConfig.userInteractionFeatures }
        }
      : null
  }

  /**
   * 獲取可用操作
   * @param {number} tabId - 標籤頁 ID
   * @returns {Array} 可用操作列表
   */
  getAvailableOperations (tabId) {
    const pageState = this.pageStates.get(tabId)
    if (!pageState?.operationsEnabled) {
      return []
    }

    return pageState.capabilities?.supportedOperations || []
  }

  /**
   * 獲取頁面狀態
   * @param {number} tabId - 標籤頁 ID (可選)
   * @returns {Object} 頁面狀態
   */
  getPageState (tabId = null) {
    if (tabId) {
      return this.pageStates.get(tabId) || null
    }

    return {
      currentContext: this.currentPageContext,
      activeTabId: this.activeTabId,
      allPages: Array.from(this.pageStates.values()),
      userInteractions: this.userInteractions
    }
  }

  /**
   * 獲取統計資料
   * @returns {Object} 統計資料
   */
  getStats () {
    return {
      ...this.domainStats,
      pageStatesCount: this.pageStates.size,
      activeTabId: this.activeTabId,
      sessionActive: this.userInteractions.sessionActive
    }
  }
}

module.exports = PageDomainHandler
