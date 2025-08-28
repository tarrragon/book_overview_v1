/**
 * 頁面監控管理器
 *
 * 負責功能：
 * - 整合頁面檢測和 Content Script 協調功能
 * - 監控頁面狀態變化和 Content Script 生命週期
 * - 提供統一的頁面監控介面和事件協調
 * - 管理頁面相關的操作權限和狀態驗證
 *
 * 設計考量：
 * - 基於 BaseModule 實現標準生命週期管理
 * - 整合 PageDetector 和 ContentCoordinator 模組
 * - 實現頁面狀態的統一監控和事件處理
 * - 提供頁面監控的高層抽象介面
 */

const BaseModule = require('../lifecycle/base-module')
const PageDetector = require('../../content/detectors/page-detector')
const ContentCoordinator = require('./content-coordinator')
const {
  PAGE_EVENTS,
  MESSAGE_EVENTS,
  SYSTEM_EVENTS,
  EVENT_PRIORITIES
} = require('../constants/module-constants')

class PageMonitor extends BaseModule {
  constructor (dependencies = {}) {
    super(dependencies)

    // 子模組
    this.pageDetector = PageDetector({
      eventBus: this.eventBus,
      logger: this.logger,
      i18nManager: dependencies.i18nManager
    })

    this.contentCoordinator = new ContentCoordinator({
      eventBus: this.eventBus,
      logger: this.logger,
      i18nManager: dependencies.i18nManager
    })

    // 監控狀態
    this.monitoringActive = false
    this.currentPageState = null
    this.monitoringListeners = new Map()

    // 頁面狀態快取
    this.pageStateCache = new Map()
    this.lastPageUpdate = null

    // 統計資料
    this.monitoringStats = {
      pageDetections: 0,
      contentScriptEvents: 0,
      stateChanges: 0,
      errorEvents: 0
    }

    // 多語言支援
    this.i18nManager = dependencies.i18nManager || null
  }

  /**
   * 初始化頁面監控管理器
   * @returns {Promise<void>}
   * @protected
   */
  async _doInitialize () {
    if (this.i18nManager) {
      this.logger.log(this.i18nManager.t('modules.operations.initialize', { moduleName: this.moduleName }))
    } else {
      this.logger.log('📊 初始化頁面監控管理器')
    }

    // 初始化子模組
    await this.initializeSubModules()

    // 初始化事件協調
    await this.initializeEventCoordination()

    this.logger.log('✅ 頁面監控管理器初始化完成')
  }

  /**
   * 啟動頁面監控管理器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStart () {
    this.logger.log('▶️ 啟動頁面監控管理器')

    // 啟動子模組
    await this.startSubModules()

    // 註冊監控事件監聽器
    await this.registerMonitoringListeners()

    // 啟動監控
    this.monitoringActive = true

    // 執行初始頁面檢測
    await this.performInitialPageDetection()

    this.logger.log('✅ 頁面監控管理器啟動完成')
  }

  /**
   * 停止頁面監控管理器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStop () {
    this.logger.log('⏹️ 停止頁面監控管理器')

    // 停止監控
    this.monitoringActive = false

    // 取消註冊監控事件監聽器
    await this.unregisterMonitoringListeners()

    // 停止子模組
    await this.stopSubModules()

    // 清理狀態
    this.pageStateCache.clear()
    this.currentPageState = null

    this.logger.log('✅ 頁面監控管理器停止完成')
  }

  /**
   * 初始化子模組
   * @returns {Promise<void>}
   * @private
   */
  async initializeSubModules () {
    try {
      this.logger.log('🔧 初始化頁面監控子模組')

      // 初始化頁面檢測器
      await this.pageDetector.initialize()

      // 初始化 Content Script 協調器
      await this.contentCoordinator.initialize()

      this.logger.log('✅ 頁面監控子模組初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化子模組失敗:', error)
      throw error
    }
  }

  /**
   * 啟動子模組
   * @returns {Promise<void>}
   * @private
   */
  async startSubModules () {
    try {
      this.logger.log('▶️ 啟動頁面監控子模組')

      // 啟動頁面檢測器
      await this.pageDetector.start()

      // 啟動 Content Script 協調器
      await this.contentCoordinator.start()

      this.logger.log('✅ 頁面監控子模組啟動完成')
    } catch (error) {
      this.logger.error('❌ 啟動子模組失敗:', error)
      throw error
    }
  }

  /**
   * 停止子模組
   * @returns {Promise<void>}
   * @private
   */
  async stopSubModules () {
    try {
      this.logger.log('⏹️ 停止頁面監控子模組')

      // 停止 Content Script 協調器
      await this.contentCoordinator.stop()

      // 停止頁面檢測器
      await this.pageDetector.stop()

      this.logger.log('✅ 頁面監控子模組停止完成')
    } catch (error) {
      this.logger.error('❌ 停止子模組失敗:', error)
    }
  }

  /**
   * 初始化事件協調
   * @returns {Promise<void>}
   * @private
   */
  async initializeEventCoordination () {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 未初始化，跳過事件協調設定')
      return
    }

    try {
      // 設定子模組的事件總線引用
      this.pageDetector.eventBus = this.eventBus
      this.contentCoordinator.eventBus = this.eventBus

      this.logger.log('🎯 頁面監控事件協調初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化事件協調失敗:', error)
    }
  }

  /**
   * 註冊監控事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async registerMonitoringListeners () {
    if (!this.eventBus) {
      return
    }

    try {
      // 頁面檢測事件
      this.monitoringListeners.set('readmoo_detected',
        this.eventBus.on(PAGE_EVENTS.READMOO_DETECTED,
          (event) => this.handleReadmooPageDetected(event.data),
          { priority: EVENT_PRIORITIES.HIGH }
        )
      )

      this.monitoringListeners.set('navigation_changed',
        this.eventBus.on(PAGE_EVENTS.NAVIGATION_CHANGED,
          (event) => this.handlePageNavigationChanged(event.data),
          { priority: EVENT_PRIORITIES.HIGH }
        )
      )

      // Content Script 事件
      this.monitoringListeners.set('content_registered',
        this.eventBus.on('CONTENT.SCRIPT.REGISTERED',
          (event) => this.handleContentScriptRegistered(event.data),
          { priority: EVENT_PRIORITIES.NORMAL }
        )
      )

      // 標籤頁事件
      this.monitoringListeners.set('tab_activated',
        this.eventBus.on('TAB.ACTIVATED',
          (event) => this.handleTabActivated(event.data),
          { priority: EVENT_PRIORITIES.NORMAL }
        )
      )

      this.logger.log('📝 頁面監控事件監聽器註冊完成')
    } catch (error) {
      this.logger.error('❌ 註冊監控事件監聽器失敗:', error)
    }
  }

  /**
   * 取消註冊監控事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async unregisterMonitoringListeners () {
    if (!this.eventBus) {
      return
    }

    try {
      for (const [eventName, listenerId] of this.monitoringListeners) {
        const eventType = this.getEventTypeByName(eventName)
        if (eventType && listenerId) {
          this.eventBus.off(eventType, listenerId)
        }
      }

      this.monitoringListeners.clear()
      this.logger.log('🔄 頁面監控事件監聽器取消註冊完成')
    } catch (error) {
      this.logger.error('❌ 取消註冊監控事件監聽器失敗:', error)
    }
  }

  /**
   * 根據事件名稱獲取事件類型
   * @param {string} eventName - 事件名稱
   * @returns {string|null} 事件類型
   * @private
   */
  getEventTypeByName (eventName) {
    const eventMapping = {
      readmoo_detected: PAGE_EVENTS.READMOO_DETECTED,
      navigation_changed: PAGE_EVENTS.NAVIGATION_CHANGED,
      content_registered: 'CONTENT.SCRIPT.REGISTERED',
      tab_activated: 'TAB.ACTIVATED'
    }

    return eventMapping[eventName] || null
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

      this.logger.log(`🎯 檢測到 Readmoo 頁面: Tab ${tabId}, 類型: ${pageType}`)
      this.monitoringStats.pageDetections++

      // 更新頁面狀態
      const pageState = {
        tabId,
        isReadmoo: true,
        pageType,
        features,
        detectedAt: Date.now(),
        contentScriptReady: this.contentCoordinator.isContentScriptReady(tabId)
      }

      this.updatePageState(tabId, pageState)

      // 觸發頁面就緒檢查
      await this.checkPageReadiness(tabId)
    } catch (error) {
      this.logger.error('❌ 處理 Readmoo 頁面檢測事件失敗:', error)
      this.monitoringStats.errorEvents++
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

      this.logger.log(`🧭 頁面導航變更: Tab ${tabId} → ${newUrl}`)
      this.monitoringStats.stateChanges++

      // 更新頁面狀態
      if (this.pageStateCache.has(tabId)) {
        const pageState = this.pageStateCache.get(tabId)
        pageState.url = newUrl
        pageState.pageType = pageType
        pageState.navigationChangedAt = Date.now()

        this.updatePageState(tabId, pageState)
      }

      // 重新檢查頁面就緒狀態
      await this.checkPageReadiness(tabId)
    } catch (error) {
      this.logger.error('❌ 處理頁面導航變更事件失敗:', error)
      this.monitoringStats.errorEvents++
    }
  }

  /**
   * 處理 Content Script 註冊事件
   * @param {Object} data - 註冊資料
   * @returns {Promise<void>}
   * @private
   */
  async handleContentScriptRegistered (data) {
    try {
      const { tabId } = data

      this.logger.log(`📝 Content Script 已註冊: Tab ${tabId}`)
      this.monitoringStats.contentScriptEvents++

      // 更新頁面狀態
      if (this.pageStateCache.has(tabId)) {
        const pageState = this.pageStateCache.get(tabId)
        pageState.contentScriptReady = true
        pageState.contentScriptRegisteredAt = Date.now()

        this.updatePageState(tabId, pageState)
      }

      // 檢查頁面就緒狀態
      await this.checkPageReadiness(tabId)
    } catch (error) {
      this.logger.error('❌ 處理 Content Script 註冊事件失敗:', error)
      this.monitoringStats.errorEvents++
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

      // 更新當前頁面狀態
      this.currentPageState = this.pageStateCache.get(tabId) || null

      // 如果是 Readmoo 頁面，檢查就緒狀態
      if (this.currentPageState && this.currentPageState.isReadmoo) {
        await this.checkPageReadiness(tabId)
      }
    } catch (error) {
      this.logger.error('❌ 處理標籤頁激活事件失敗:', error)
    }
  }

  /**
   * 更新頁面狀態
   * @param {number} tabId - 標籤頁 ID
   * @param {Object} pageState - 頁面狀態
   * @private
   */
  updatePageState (tabId, pageState) {
    this.pageStateCache.set(tabId, pageState)
    this.lastPageUpdate = Date.now()

    // 如果是當前活動標籤頁，更新當前狀態
    if (this.currentPageState && this.currentPageState.tabId === tabId) {
      this.currentPageState = pageState
    }
  }

  /**
   * 檢查頁面就緒狀態
   * @param {number} tabId - 標籤頁 ID
   * @returns {Promise<void>}
   * @private
   */
  async checkPageReadiness (tabId) {
    const pageState = this.pageStateCache.get(tabId)
    if (!pageState) {
      return
    }

    const isReady = pageState.isReadmoo && pageState.contentScriptReady

    if (isReady && !pageState.readinessNotified) {
      // 觸發頁面就緒事件
      if (this.eventBus) {
        await this.eventBus.emit(PAGE_EVENTS.CONTENT_READY, {
          tabId,
          pageType: pageState.pageType,
          features: pageState.features,
          timestamp: Date.now()
        })
      }

      pageState.readinessNotified = true
      pageState.readyAt = Date.now()

      this.logger.log(`✅ 頁面就緒通知已發送: Tab ${tabId}`)
    } else if (!isReady && pageState.readinessNotified) {
      // 頁面不再就緒，重設通知狀態
      pageState.readinessNotified = false

      if (this.eventBus) {
        await this.eventBus.emit(PAGE_EVENTS.CONTENT_NOT_READY, {
          tabId,
          reason: !pageState.contentScriptReady ? 'content_script_not_ready' : 'page_not_readmoo',
          timestamp: Date.now()
        })
      }

      this.logger.log(`⚠️ 頁面不再就緒: Tab ${tabId}`)
    }
  }

  /**
   * 執行初始頁面檢測
   * @returns {Promise<void>}
   * @private
   */
  async performInitialPageDetection () {
    try {
      this.logger.log('🔍 執行初始頁面檢測')

      // 檢測當前活動標籤頁
      const detectionResult = await this.pageDetector.detectCurrentPage()

      if (detectionResult.isReadmoo) {
        this.logger.log(`✅ 初始檢測發現 Readmoo 頁面: ${detectionResult.pageType}`)

        // 手動觸發頁面檢測事件
        await this.handleReadmooPageDetected({
          tabId: detectionResult.tabId,
          pageType: detectionResult.pageType,
          features: detectionResult.features
        })
      } else {
        this.logger.log('ℹ️ 初始檢測未發現 Readmoo 頁面')
      }
    } catch (error) {
      this.logger.error('❌ 初始頁面檢測失敗:', error)
    }
  }

  /**
   * 檢測指定標籤頁
   * @param {number} tabId - 標籤頁 ID
   * @returns {Promise<Object>} 檢測結果
   */
  async detectPage (tabId) {
    return await this.pageDetector.detectPage(tabId)
  }

  /**
   * 檢測當前頁面
   * @returns {Promise<Object>} 檢測結果
   */
  async detectCurrentPage () {
    return await this.pageDetector.detectCurrentPage()
  }

  /**
   * 獲取頁面狀態
   * @param {number} tabId - 標籤頁 ID (可選)
   * @returns {Object} 頁面狀態
   */
  getPageState (tabId = null) {
    if (tabId) {
      return this.pageStateCache.get(tabId) || null
    }

    return {
      currentPageState: this.currentPageState,
      allPages: Array.from(this.pageStateCache.entries()).map(([id, state]) => ({
        tabId: id,
        ...state
      })),
      monitoringActive: this.monitoringActive,
      lastUpdate: this.lastPageUpdate
    }
  }

  /**
   * 獲取 Content Script 狀態
   * @param {number} tabId - 標籤頁 ID (可選)
   * @returns {Object} Content Script 狀態
   */
  getContentScriptStatus (tabId = null) {
    return this.contentCoordinator.getContentScriptStatus(tabId)
  }

  /**
   * 檢查頁面是否為 Readmoo 且就緒
   * @param {number} tabId - 標籤頁 ID (可選，預設為當前標籤頁)
   * @returns {boolean} 是否就緒
   */
  isPageReady (tabId = null) {
    const pageState = tabId
      ? this.pageStateCache.get(tabId)
      : this.currentPageState

    return pageState &&
           pageState.isReadmoo &&
           pageState.contentScriptReady &&
           pageState.readinessNotified
  }

  /**
   * 獲取頁面監控統計
   * @returns {Object} 監控統計資料
   */
  getMonitoringStats () {
    return {
      ...this.monitoringStats,
      pageDetectionStats: this.pageDetector.getDetectionStats(),
      contentCoordinatorStats: this.contentCoordinator.getContentScriptStatus().stats,
      pageStates: this.pageStateCache.size,
      timestamp: Date.now()
    }
  }

  /**
   * 取得自訂健康狀態
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus () {
    const pageDetectorHealth = this.pageDetector._getCustomHealthStatus()
    const contentCoordinatorHealth = this.contentCoordinator._getCustomHealthStatus()

    const errorRate = (this.monitoringStats.pageDetections + this.monitoringStats.contentScriptEvents) > 0
      ? this.monitoringStats.errorEvents / (this.monitoringStats.pageDetections + this.monitoringStats.contentScriptEvents)
      : 0

    return {
      monitoringActive: this.monitoringActive,
      pageStates: this.pageStateCache.size,
      currentPageReady: this.isPageReady(),
      errorRate: errorRate.toFixed(3),
      pageDetectorHealth: pageDetectorHealth.health,
      contentCoordinatorHealth: contentCoordinatorHealth.health,
      health: (errorRate > 0.1 ||
               pageDetectorHealth.health === 'degraded' ||
               contentCoordinatorHealth.health === 'degraded')
        ? 'degraded'
        : 'healthy'
    }
  }
}

module.exports = PageMonitor
