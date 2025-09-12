/**
 * 頁面檢測服務
 *
 * 負責功能：
 * - Readmoo 頁面智能檢測和分類
 * - URL 模式匹配和驗證
 * - 頁面類型識別和配置管理
 * - 頁面狀態變化監控
 *
 * 設計考量：
 * - 可擴展的頁面檢測規則引擎
 * - 支援多書城檢測模式（為未來擴展準備）
 * - 高效能的URL模式匹配
 * - 即時頁面狀態追蹤
 *
 * 使用情境：
 * - 檢測用戶是否在 Readmoo 頁面
 * - 識別頁面類型（書庫、書籍詳情、閱讀頁面）
 * - 為其他服務提供頁面上下文資訊
 */

const {
  PAGE_EVENTS,
  EVENT_PRIORITIES
} = require('src/background/constants/module-constants')
const { StandardError } = require('src/core/errors/StandardError')

class PageDetectionService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false,
      detecting: false
    }

    // 頁面檢測配置
    this.detectionRules = new Map()
    this.urlPatterns = new Map()
    this.pageTypeConfigs = new Map()
    this.registeredListeners = new Map()

    // 檢測結果快取
    this.detectionCache = new Map()
    this.cacheExpiry = 30000 // 30秒

    // 統計資料
    this.stats = {
      detectionsPerformed: 0,
      pagesDetected: 0,
      cacheHits: 0,
      ruleMisses: 0
    }

    // 初始化檢測規則
    this.initializeDetectionRules()
  }

  /**
   * 初始化頁面檢測服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('⚠️ 頁面檢測服務已初始化')
      return
    }

    try {
      this.logger.log('🔍 初始化頁面檢測服務')

      // 初始化頁面類型配置
      await this.initializePageTypeConfigs()

      // 註冊事件監聽器
      await this.registerEventListeners()

      this.state.initialized = true
      this.logger.log('✅ 頁面檢測服務初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.DETECTION.INITIALIZED', {
          serviceName: 'PageDetectionService',
          rulesCount: this.detectionRules.size,
          pageTypesCount: this.pageTypeConfigs.size
        })
      }
    } catch (error) {
      this.logger.error('❌ 初始化頁面檢測服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動頁面檢測服務
   */
  async start () {
    if (!this.state.initialized) {
      throw new StandardError('UNKNOWN_ERROR', '服務尚未初始化', {
          "category": "general"
      })
    }

    if (this.state.active) {
      this.logger.warn('⚠️ 頁面檢測服務已啟動')
      return
    }

    try {
      this.logger.log('🚀 啟動頁面檢測服務')

      this.state.active = true
      this.state.detecting = true

      this.logger.log('✅ 頁面檢測服務啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.DETECTION.STARTED', {
          serviceName: 'PageDetectionService'
        })
      }
    } catch (error) {
      this.logger.error('❌ 啟動頁面檢測服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止頁面檢測服務
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('⚠️ 頁面檢測服務未啟動')
      return
    }

    try {
      this.logger.log('🛑 停止頁面檢測服務')

      // 清理快取
      this.detectionCache.clear()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      this.state.active = false
      this.state.detecting = false

      this.logger.log('✅ 頁面檢測服務停止完成')

      // 發送停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.DETECTION.STOPPED', {
          serviceName: 'PageDetectionService',
          finalStats: { ...this.stats }
        })
      }
    } catch (error) {
      this.logger.error('❌ 停止頁面檢測服務失敗:', error)
      throw error
    }
  }

  /**
   * 初始化檢測規則
   */
  initializeDetectionRules () {
    // Readmoo 主頁面檢測規則
    this.detectionRules.set('readmoo_main', {
      urlPattern: /^https:\/\/readmoo\.com/,
      additionalChecks: (url, title) => {
        return url.includes('readmoo.com')
      },
      pageType: 'readmoo_main',
      priority: 1
    })

    // Readmoo 書庫頁面檢測規則
    this.detectionRules.set('readmoo_library', {
      urlPattern: /^https:\/\/readmoo\.com\/library/,
      additionalChecks: (url, title) => {
        return url.includes('/library') || title.includes('書庫')
      },
      pageType: 'readmoo_library',
      priority: 2
    })

    // Readmoo 書籍詳情頁面檢測規則
    this.detectionRules.set('readmoo_book_detail', {
      urlPattern: /^https:\/\/readmoo\.com\/book\/\d+/,
      additionalChecks: (url, title) => {
        return url.match(/\/book\/\d+/) !== null
      },
      pageType: 'readmoo_book_detail',
      priority: 3
    })

    // Readmoo 閱讀頁面檢測規則
    this.detectionRules.set('readmoo_reader', {
      urlPattern: /^https:\/\/readmoo\.com\/reader/,
      additionalChecks: (url, title) => {
        return url.includes('/reader') || url.includes('/read/')
      },
      pageType: 'readmoo_reader',
      priority: 4
    })

    this.logger.log(`✅ 初始化了 ${this.detectionRules.size} 個檢測規則`)
  }

  /**
   * 初始化頁面類型配置
   */
  async initializePageTypeConfigs () {
    // 書庫頁面配置
    this.pageTypeConfigs.set('readmoo_library', {
      displayName: 'Readmoo 書庫',
      features: ['extraction', 'export', 'stats'],
      permissions: ['read_library', 'extract_data'],
      extractionCapable: true,
      requiresLogin: true
    })

    // 書籍詳情頁面配置
    this.pageTypeConfigs.set('readmoo_book_detail', {
      displayName: 'Readmoo 書籍詳情',
      features: ['book_info', 'reading_progress'],
      permissions: ['read_book_info'],
      extractionCapable: false,
      requiresLogin: false
    })

    // 閱讀頁面配置
    this.pageTypeConfigs.set('readmoo_reader', {
      displayName: 'Readmoo 閱讀器',
      features: ['reading_progress', 'bookmarks'],
      permissions: ['read_content', 'track_progress'],
      extractionCapable: false,
      requiresLogin: true
    })

    // 主頁面配置
    this.pageTypeConfigs.set('readmoo_main', {
      displayName: 'Readmoo 主頁',
      features: ['navigation'],
      permissions: ['basic_access'],
      extractionCapable: false,
      requiresLogin: false
    })

    this.logger.log(`✅ 初始化了 ${this.pageTypeConfigs.size} 個頁面類型配置`)
  }

  /**
   * 檢測頁面類型
   */
  async detectPageType (url, title = '', tabId = null) {
    if (!this.state.detecting) {
      return { detected: false, reason: 'service_not_active' }
    }

    this.stats.detectionsPerformed++

    try {
      // 檢查快取
      const cacheKey = `${url}_${title}`
      const cached = this.getCachedResult(cacheKey)
      if (cached) {
        this.stats.cacheHits++
        return cached
      }

      // 執行檢測規則
      const detectionResult = await this.executeDetectionRules(url, title)

      // 快取結果
      this.setCachedResult(cacheKey, detectionResult)

      // 更新統計
      if (detectionResult.detected) {
        this.stats.pagesDetected++

        // 發送檢測成功事件
        if (this.eventBus) {
          await this.eventBus.emit('PAGE.DETECTED', {
            url,
            title,
            tabId,
            pageType: detectionResult.pageType,
            config: detectionResult.config,
            timestamp: Date.now()
          })
        }
      } else {
        this.stats.ruleMisses++
      }

      return detectionResult
    } catch (error) {
      this.logger.error('❌ 頁面檢測失敗:', error)
      return {
        detected: false,
        error: error.message,
        reason: 'detection_error'
      }
    }
  }

  /**
   * 執行檢測規則
   */
  async executeDetectionRules (url, title) {
    // 按優先級排序規則
    const sortedRules = Array.from(this.detectionRules.entries())
      .sort(([, a], [, b]) => b.priority - a.priority)

    for (const [ruleName, rule] of sortedRules) {
      try {
        // URL 模式匹配
        if (rule.urlPattern.test(url)) {
          // 執行額外檢查
          const additionalCheckPassed = await rule.additionalChecks(url, title)

          if (additionalCheckPassed) {
            const config = this.pageTypeConfigs.get(rule.pageType)

            return {
              detected: true,
              pageType: rule.pageType,
              rule: ruleName,
              config: config || {},
              url,
              title,
              timestamp: Date.now()
            }
          }
        }
      } catch (error) {
        this.logger.error(`檢測規則執行失敗 (${ruleName}):`, error)
      }
    }

    return {
      detected: false,
      reason: 'no_matching_rules',
      url,
      title,
      timestamp: Date.now()
    }
  }

  /**
   * 獲取快取結果
   */
  getCachedResult (key) {
    const cached = this.detectionCache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.result
    }

    // 清理過期快取
    if (cached) {
      this.detectionCache.delete(key)
    }

    return null
  }

  /**
   * 設定快取結果
   */
  setCachedResult (key, result) {
    this.detectionCache.set(key, {
      result,
      timestamp: Date.now()
    })

    // 限制快取大小
    if (this.detectionCache.size > 100) {
      const oldestKey = this.detectionCache.keys().next().value
      this.detectionCache.delete(oldestKey)
    }
  }

  /**
   * 批量檢測頁面
   */
  async batchDetectPages (pages) {
    const results = []

    for (const page of pages) {
      try {
        const result = await this.detectPageType(page.url, page.title, page.tabId)
        results.push({
          ...page,
          detection: result
        })
      } catch (error) {
        results.push({
          ...page,
          detection: {
            detected: false,
            error: error.message
          }
        })
      }
    }

    return results
  }

  /**
   * 註冊檢測規則
   */
  registerDetectionRule (name, rule) {
    if (!rule.urlPattern || !rule.pageType) {
      throw new StandardError('UNKNOWN_ERROR', '檢測規則必須包含 urlPattern 和 pageType', {
          "category": "general"
      })
    }

    this.detectionRules.set(name, {
      priority: 0,
      additionalChecks: () => true,
      ...rule
    })

    this.logger.log(`✅ 註冊檢測規則: ${name}`)
  }

  /**
   * 註冊頁面類型配置
   */
  registerPageTypeConfig (pageType, config) {
    this.pageTypeConfigs.set(pageType, config)
    this.logger.log(`✅ 註冊頁面類型配置: ${pageType}`)
  }

  /**
   * 清理快取
   */
  clearCache () {
    this.detectionCache.clear()
    this.logger.log('✅ 檢測快取已清理')
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners () {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 不可用，跳過事件監聽器註冊')
      return
    }

    const listeners = [
      {
        event: PAGE_EVENTS.DETECTION_REQUEST,
        handler: this.handleDetectionRequest.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      },
      {
        event: PAGE_EVENTS.BATCH_DETECTION_REQUEST,
        handler: this.handleBatchDetectionRequest.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      }
    ]

    for (const { event, handler, priority } of listeners) {
      const listenerId = await this.eventBus.on(event, handler, { priority })
      this.registeredListeners.set(event, listenerId)
    }

    this.logger.log(`✅ 註冊了 ${listeners.length} 個事件監聽器`)
  }

  /**
   * 取消註冊事件監聽器
   */
  async unregisterEventListeners () {
    if (!this.eventBus) return

    for (const [event, listenerId] of this.registeredListeners) {
      try {
        await this.eventBus.off(event, listenerId)
      } catch (error) {
        this.logger.error(`❌ 取消註冊事件監聽器失敗 (${event}):`, error)
      }
    }

    this.registeredListeners.clear()
    this.logger.log('✅ 所有事件監聽器已取消註冊')
  }

  /**
   * 處理檢測請求
   */
  async handleDetectionRequest (event) {
    try {
      const { url, title, tabId, requestId } = event.data || {}

      if (!url) {
        throw new StandardError('UNKNOWN_ERROR', '檢測請求必須包含 URL', {
          "category": "general"
      })
      }

      const result = await this.detectPageType(url, title, tabId)

      if (this.eventBus) {
        await this.eventBus.emit('PAGE.DETECTION.RESULT', {
          requestId,
          result,
          url,
          tabId
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理檢測請求失敗:', error)

      if (this.eventBus) {
        await this.eventBus.emit('PAGE.DETECTION.ERROR', {
          requestId: event.data?.requestId,
          error: error.message
        })
      }
    }
  }

  /**
   * 處理批量檢測請求
   */
  async handleBatchDetectionRequest (event) {
    try {
      const { pages, requestId } = event.data || {}

      if (!Array.isArray(pages)) {
        throw new StandardError('UNKNOWN_ERROR', '批量檢測請求必須包含頁面陣列', {
          "category": "general"
      })
      }

      const results = await this.batchDetectPages(pages)

      if (this.eventBus) {
        await this.eventBus.emit('PAGE.BATCH_DETECTION.RESULT', {
          requestId,
          results,
          total: pages.length,
          detected: results.filter(r => r.detection.detected).length
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理批量檢測請求失敗:', error)
    }
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      detecting: this.state.detecting,
      rulesCount: this.detectionRules.size,
      pageTypesCount: this.pageTypeConfigs.size,
      cacheSize: this.detectionCache.size,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const isHealthy = this.state.initialized &&
                     this.detectionRules.size > 0 &&
                     this.pageTypeConfigs.size > 0

    return {
      service: 'PageDetectionService',
      healthy: isHealthy,
      status: this.state.active ? 'active' : 'inactive',
      detecting: this.state.detecting,
      metrics: {
        detectionsPerformed: this.stats.detectionsPerformed,
        pagesDetected: this.stats.pagesDetected,
        cacheHits: this.stats.cacheHits,
        ruleMisses: this.stats.ruleMisses,
        cacheHitRate: this.stats.detectionsPerformed > 0
          ? (this.stats.cacheHits / this.stats.detectionsPerformed * 100).toFixed(2) + '%'
          : '0%'
      }
    }
  }
}

module.exports = PageDetectionService
