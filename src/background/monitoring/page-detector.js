/**
 * Readmoo 頁面檢測器
 *
 * 負責功能：
 * - 檢測當前分頁是否為 Readmoo 相關頁面
 * - 分析頁面類型和內容結構
 * - 提供頁面狀態資訊和操作權限判定
 * - 支援不同 Readmoo 頁面模式的識別
 *
 * 設計考量：
 * - 基於 BaseModule 實現標準生命週期管理
 * - 支援多種 Readmoo 頁面模式檢測
 * - 實現頁面變更監測和自動更新
 * - 提供統一的頁面檢測介面
 */

const BaseModule = require('../lifecycle/base-module')
const { PAGE_EVENTS, TIMEOUTS } = require('../constants/module-constants')

class PageDetector extends BaseModule {
  constructor (dependencies = {}) {
    super(dependencies)

    // 頁面檢測配置
    this.readmooPatterns = {
      // Readmoo 主域名模式
      hostPatterns: [
        /^(www\.)?readmoo\.com$/i,
        /^(.*\.)?readmoo\.com$/i
      ],

      // 頁面路徑模式
      pathPatterns: {
        library: /^\/library/i,
        book: /^\/book\/[\w-]+/i,
        reader: /^\/reader/i,
        store: /^\/store/i,
        search: /^\/search/i,
        category: /^\/category/i,
        author: /^\/author/i,
        publisher: /^\/publisher/i
      },

      // 頁面內容特徵
      contentSelectors: {
        libraryContainer: '.library-container, .my-library, .bookshelf',
        bookList: '.book-list, .book-grid, .book-item',
        bookDetail: '.book-detail, .book-info, .book-description',
        readerFrame: '#reader, .reader-container, .reading-area'
      }
    }

    // 檢測狀態
    this.detectionCache = new Map()
    this.lastDetection = null
    this.detectionInProgress = false

    // 統計資料
    this.detectionStats = {
      totalDetections: 0,
      readmooDetections: 0,
      cacheHits: 0,
      errors: 0
    }

    // 多語言支援
    this.i18nManager = dependencies.i18nManager || null
  }

  /**
   * 初始化頁面檢測器
   * @returns {Promise<void>}
   * @protected
   */
  async _doInitialize () {
    if (this.i18nManager) {
      this.logger.log(this.i18nManager.t('modules.operations.initialize', { moduleName: this.moduleName }))
    } else {
      this.logger.log('🔍 初始化頁面檢測器')
    }

    // 清理檢測快取
    this.clearDetectionCache()

    // 初始化檢測邏輯
    await this.initializeDetectionLogic()

    this.logger.log('✅ 頁面檢測器初始化完成')
  }

  /**
   * 啟動頁面檢測器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStart () {
    this.logger.log('▶️ 啟動頁面檢測器')

    // 註冊頁面變更事件監聽器
    await this.registerPageChangeListeners()

    this.logger.log('✅ 頁面檢測器啟動完成')
  }

  /**
   * 停止頁面檢測器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStop () {
    this.logger.log('⏹️ 停止頁面檢測器')

    // 取消註冊事件監聽器
    await this.unregisterPageChangeListeners()

    // 清理檢測快取
    this.clearDetectionCache()

    this.logger.log('✅ 頁面檢測器停止完成')
  }

  /**
   * 初始化檢測邏輯
   * @returns {Promise<void>}
   * @private
   */
  async initializeDetectionLogic () {
    try {
      this.logger.log('🔧 初始化頁面檢測邏輯')

      // 預編譯正則表達式
      this.compiledPatterns = {
        hosts: this.readmooPatterns.hostPatterns,
        paths: Object.entries(this.readmooPatterns.pathPatterns).reduce((acc, [key, pattern]) => {
          acc[key] = pattern
          return acc
        }, {})
      }

      this.logger.log('✅ 頁面檢測邏輯初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化頁面檢測邏輯失敗:', error)
      throw error
    }
  }

  /**
   * 註冊頁面變更事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async registerPageChangeListeners () {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 未初始化，無法註冊頁面變更監聽器')
      return
    }

    try {
      // 監聽標籤頁切換事件
      this.pageChangeListenerId = this.eventBus.on('TAB.ACTIVATED', async (event) => {
        await this.handleTabActivated(event.data)
      })

      // 監聽頁面導航事件
      this.navigationListenerId = this.eventBus.on('TAB.UPDATED', async (event) => {
        await this.handleTabUpdated(event.data)
      })

      this.logger.log('📝 頁面變更事件監聽器註冊完成')
    } catch (error) {
      this.logger.error('❌ 註冊頁面變更監聽器失敗:', error)
    }
  }

  /**
   * 取消註冊頁面變更事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async unregisterPageChangeListeners () {
    if (!this.eventBus) {
      return
    }

    try {
      if (this.pageChangeListenerId) {
        this.eventBus.off('TAB.ACTIVATED', this.pageChangeListenerId)
      }

      if (this.navigationListenerId) {
        this.eventBus.off('TAB.UPDATED', this.navigationListenerId)
      }

      this.logger.log('🔄 頁面變更事件監聽器取消註冊完成')
    } catch (error) {
      this.logger.error('❌ 取消註冊頁面變更監聽器失敗:', error)
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

      // 檢測新激活的標籤頁
      const detectionResult = await this.detectPage(tabId)

      if (detectionResult.isReadmoo) {
        await this.emitPageEvent(PAGE_EVENTS.READMOO_DETECTED, {
          tabId,
          pageType: detectionResult.pageType,
          features: detectionResult.features
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理標籤頁激活事件失敗:', error)
    }
  }

  /**
   * 處理標籤頁更新事件
   * @param {Object} data - 更新資料
   * @returns {Promise<void>}
   * @private
   */
  async handleTabUpdated (data) {
    try {
      const { tabId, changeInfo } = data

      // 只處理 URL 變更
      if (changeInfo.url) {
        // 清除該標籤頁的檢測快取
        this.detectionCache.delete(tabId)

        // 重新檢測頁面
        const detectionResult = await this.detectPage(tabId)

        if (detectionResult.isReadmoo) {
          await this.emitPageEvent(PAGE_EVENTS.NAVIGATION_CHANGED, {
            tabId,
            newUrl: changeInfo.url,
            pageType: detectionResult.pageType,
            features: detectionResult.features
          })
        }
      }
    } catch (error) {
      this.logger.error('❌ 處理標籤頁更新事件失敗:', error)
    }
  }

  /**
   * 檢測指定標籤頁是否為 Readmoo 頁面
   * @param {number} tabId - 標籤頁 ID
   * @returns {Promise<Object>} 檢測結果
   */
  async detectPage (tabId) {
    try {
      // 檢查快取
      if (this.detectionCache.has(tabId)) {
        this.detectionStats.cacheHits++
        return this.detectionCache.get(tabId)
      }

      // 防止並發檢測
      if (this.detectionInProgress) {
        return { isReadmoo: false, reason: 'detection_in_progress' }
      }

      this.detectionInProgress = true
      this.detectionStats.totalDetections++

      // 獲取標籤頁資訊
      const tab = await this.getTabInfo(tabId)
      if (!tab || !tab.url) {
        return { isReadmoo: false, reason: 'no_tab_info' }
      }

      // URL 檢測
      const urlDetection = this.detectByUrl(tab.url)
      if (!urlDetection.isReadmoo) {
        const result = { isReadmoo: false, reason: 'url_not_match', url: tab.url }
        this.detectionCache.set(tabId, result)
        return result
      }

      // 內容檢測
      const contentDetection = await this.detectByContent(tabId)

      // 合併檢測結果
      const finalResult = {
        isReadmoo: true,
        tabId,
        url: tab.url,
        title: tab.title,
        pageType: urlDetection.pageType,
        features: {
          ...urlDetection.features,
          ...contentDetection.features
        },
        confidence: this.calculateConfidence(urlDetection, contentDetection),
        timestamp: Date.now()
      }

      // 快取結果
      this.detectionCache.set(tabId, finalResult)
      this.detectionStats.readmooDetections++
      this.lastDetection = finalResult

      return finalResult
    } catch (error) {
      this.logger.error(`❌ 檢測頁面失敗 (Tab ${tabId}):`, error)
      this.detectionStats.errors++
      return { isReadmoo: false, reason: 'detection_error', error: error.message }
    } finally {
      this.detectionInProgress = false
    }
  }

  /**
   * 基於 URL 進行檢測
   * @param {string} url - 頁面 URL
   * @returns {Object} URL 檢測結果
   * @private
   */
  detectByUrl (url) {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname.toLowerCase()
      const pathname = urlObj.pathname.toLowerCase()

      // 檢查主機名
      const isReadmooHost = this.compiledPatterns.hosts.some(pattern => pattern.test(hostname))
      if (!isReadmooHost) {
        return { isReadmoo: false, reason: 'host_not_match' }
      }

      // 檢查路徑模式
      let pageType = 'unknown'
      const pathFeatures = {}

      for (const [type, pattern] of Object.entries(this.compiledPatterns.paths)) {
        if (pattern.test(pathname)) {
          pageType = type
          pathFeatures[`is_${type}_page`] = true
          break
        }
      }

      // URL 參數分析
      const urlParams = Object.fromEntries(urlObj.searchParams.entries())
      const paramFeatures = this.analyzeUrlParameters(urlParams)

      return {
        isReadmoo: true,
        pageType,
        features: {
          hostname,
          pathname,
          hasQuery: urlObj.search.length > 0,
          ...pathFeatures,
          ...paramFeatures
        }
      }
    } catch (error) {
      this.logger.error('❌ URL 檢測失敗:', error)
      return { isReadmoo: false, reason: 'url_parse_error' }
    }
  }

  /**
   * 基於頁面內容進行檢測
   * @param {number} tabId - 標籤頁 ID
   * @returns {Promise<Object>} 內容檢測結果
   * @private
   */
  async detectByContent (tabId) {
    try {
      // 向 Content Script 發送檢測請求
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'PAGE_CONTENT_DETECTION',
        selectors: this.readmooPatterns.contentSelectors
      })

      if (response && response.success) {
        return {
          features: {
            contentDetected: true,
            ...response.features
          }
        }
      } else {
        return {
          features: {
            contentDetected: false,
            contentError: response?.error || 'no_response'
          }
        }
      }
    } catch (error) {
      // Content Script 可能不存在，這是正常情況
      return {
        features: {
          contentDetected: false,
          contentError: error.message
        }
      }
    }
  }

  /**
   * 分析 URL 參數
   * @param {Object} params - URL 參數物件
   * @returns {Object} 參數特徵
   * @private
   */
  analyzeUrlParameters (params) {
    const features = {}

    // 搜尋相關參數
    if (params.q || params.query || params.keyword) {
      features.hasSearchQuery = true
    }

    // 分頁參數
    if (params.page || params.p) {
      features.hasPagination = true
    }

    // 分類或篩選參數
    if (params.category || params.tag || params.filter) {
      features.hasFilter = true
    }

    // 書籍 ID 參數
    if (params.book_id || params.id) {
      features.hasBookId = true
    }

    return features
  }

  /**
   * 計算檢測信心度
   * @param {Object} urlDetection - URL 檢測結果
   * @param {Object} contentDetection - 內容檢測結果
   * @returns {number} 信心度 (0-1)
   * @private
   */
  calculateConfidence (urlDetection, contentDetection) {
    let confidence = 0.5 // 基礎信心度

    // URL 檢測加分
    if (urlDetection.isReadmoo) {
      confidence += 0.3

      if (urlDetection.pageType !== 'unknown') {
        confidence += 0.1
      }
    }

    // 內容檢測加分
    if (contentDetection.features.contentDetected) {
      confidence += 0.2

      // 特定內容特徵加分
      if (contentDetection.features.libraryContainer) confidence += 0.05
      if (contentDetection.features.bookList) confidence += 0.05
    }

    return Math.min(confidence, 1.0)
  }

  /**
   * 獲取標籤頁資訊
   * @param {number} tabId - 標籤頁 ID
   * @returns {Promise<Object>} 標籤頁資訊
   * @private
   */
  async getTabInfo (tabId) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tabs.length > 0 && (!tabId || tabs[0].id === tabId)) {
        return tabs[0]
      }

      if (tabId) {
        return await chrome.tabs.get(tabId)
      }

      return null
    } catch (error) {
      this.logger.error(`❌ 獲取標籤頁資訊失敗 (Tab ${tabId}):`, error)
      return null
    }
  }

  /**
   * 觸發頁面事件
   * @param {string} eventType - 事件類型
   * @param {Object} data - 事件資料
   * @returns {Promise<void>}
   * @private
   */
  async emitPageEvent (eventType, data) {
    if (this.eventBus) {
      try {
        await this.eventBus.emit(eventType, data)
      } catch (error) {
        this.logger.error(`❌ 觸發頁面事件失敗 (${eventType}):`, error)
      }
    }
  }

  /**
   * 清理檢測快取
   */
  clearDetectionCache () {
    this.detectionCache.clear()
    this.lastDetection = null
  }

  /**
   * 檢測當前活動標籤頁
   * @returns {Promise<Object>} 檢測結果
   */
  async detectCurrentPage () {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tabs.length === 0) {
        return { isReadmoo: false, reason: 'no_active_tab' }
      }

      return await this.detectPage(tabs[0].id)
    } catch (error) {
      this.logger.error('❌ 檢測當前頁面失敗:', error)
      return { isReadmoo: false, reason: 'detection_error', error: error.message }
    }
  }

  /**
   * 獲取頁面檢測統計
   * @returns {Object} 統計資料
   */
  getDetectionStats () {
    return {
      ...this.detectionStats,
      cacheSize: this.detectionCache.size,
      lastDetection: this.lastDetection,
      timestamp: Date.now()
    }
  }

  /**
   * 取得自訂健康狀態
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus () {
    const errorRate = this.detectionStats.totalDetections > 0
      ? this.detectionStats.errors / this.detectionStats.totalDetections
      : 0

    return {
      totalDetections: this.detectionStats.totalDetections,
      readmooDetections: this.detectionStats.readmooDetections,
      errorRate: errorRate.toFixed(3),
      cacheSize: this.detectionCache.size,
      detectionInProgress: this.detectionInProgress,
      health: errorRate > 0.1 ? 'degraded' : 'healthy'
    }
  }
}

module.exports = PageDetector
