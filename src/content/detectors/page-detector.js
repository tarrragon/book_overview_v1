/**
 * page-detector.js
 *
 * 頁面檢測器模組
 *
 * 負責功能：
 * - 檢測是否為 Readmoo 頁面
 * - 識別頁面類型（書庫、書架、閱讀器等）
 * - 提供頁面狀態查詢功能
 * - 監控 URL 變更事件
 *
 * 設計考量：
 * - 支援多種 URL 格式變化
 * - 提供可靠的頁面類型檢測
 * - 輕量化實作，避免效能開銷
 * - 便於擴展到其他電子書平台
 *
 * 處理流程：
 * 1. URL 分析 → 檢查域名和路徑
 * 2. 類型識別 → 根據 URL 模式分類
 * 3. 狀態維護 → 記錄當前頁面狀態
 * 4. 變更通知 → 監控頁面導航變化
 *
 * 使用情境：
 * - Content Script 初始化時的頁面檢測
 * - SPA 導航時的頁面類型更新
 * - 條件式功能啟用的判斷依據
 */

/**
 * 建立頁面檢測器實例
 *
 * @returns {Object} PageDetector 實例
 */
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

function createPageDetector () {
  let isReadmooPage = false
  let pageType = 'unknown'
  let changeObserver = null

  // 動態取得 location 的輔助函數
  const getLocation = () => globalThis.location || window?.location || {}

  const detector = {
    // 快取當前URL以偵測變更
    _cachedUrl: '',
    /**
     * 檢測 Readmoo 頁面
     *
     * @returns {Object} 檢測結果 { isReadmooPage, pageType }
     */
    detectReadmooPage () {
      const location = getLocation()
      // Debug: 在測試環境中強制輸出到標準輸出
      const locationInfo = {
        hostname: location.hostname,
        href: location.href,
        origin: location.origin,
        globalThis: globalThis.location ? 'exists' : 'missing',
        window: (typeof window !== 'undefined' && window?.location) ? 'exists' : 'missing'
      }
      // 強制輸出到stderr確保在Jest中可見
      if (typeof process !== 'undefined' && process.stderr) {
        process.stderr.write(`PageDetector Debug: ${JSON.stringify(locationInfo)}\n`)
      }
      isReadmooPage = location.hostname && location.hostname.includes('readmoo.com')
      pageType = isReadmooPage ? this.detectPageType() : 'unknown'

      // Logger 後備方案: Content Script 頁面檢測記錄
      // 設計理念: Content Script 運行在網頁環境，Logger 服務可能不可用
      // 後備機制: console.log 提供頁面檢測結果的直接可見性
      // 使用場景: Readmoo 頁面檢測結果記錄，便於開發者除錯和確認
      // eslint-disable-next-line no-console
      console.log(`📍 頁面檢測: ${isReadmooPage ? 'Readmoo' : '非Readmoo'} 頁面 (${pageType})`)

      return { isReadmooPage, pageType }
    },

    /**
     * 檢測頁面類型
     *
     * @returns {string} 頁面類型 ('library', 'shelf', 'reader', 'unknown')
     */
    detectPageType () {
      const location = getLocation()
      const url = location.href || ''
      const pathname = location.pathname || ''

      if (url.includes('/library') || pathname.includes('/library')) {
        return 'library'
      }
      if (url.includes('/shelf') || pathname.includes('/shelf')) {
        return 'shelf'
      }
      if (url.includes('/book/') || pathname.includes('/book/') ||
          url.includes('/api/reader/') || pathname.includes('/api/reader/')) {
        return 'reader'
      }

      return 'unknown'
    },

    /**
     * 取得當前頁面狀態
     *
     * @returns {Object} 頁面狀態資訊
     */
    getPageStatus () {
      const location = getLocation()
      return {
        isReadmooPage,
        pageType,
        url: location.href || '',
        hostname: location.hostname || '',
        pathname: location.pathname || '',
        timestamp: Date.now()
      }
    },

    /**
     * 檢查是否為 Readmoo 頁面
     *
     * @returns {boolean} 是否為 Readmoo 頁面
     */
    isReadmooPage () {
      return isReadmooPage
    },

    /**
     * 取得頁面類型
     *
     * @returns {string} 頁面類型
     */
    getPageType () {
      return pageType
    },

    /**
     * 檢查是否為可提取的頁面
     *
     * @returns {boolean} 是否可提取
     */
    isExtractablePage () {
      return isReadmooPage && ['library', 'shelf'].includes(pageType)
    },

    /**
     * 設定 URL 變更監聽器
     *
     * @param {Function} callback - 變更回調函數
     * @returns {Function} 停止監聽的函數
     */
    onUrlChange (callback) {
      if (typeof callback !== 'function') {
        const error = new Error('callback 必須是函數')
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = { category: 'general', parameter: 'callback', expectedType: 'function' }
        throw error
      }

      // 如果已有觀察器，先清理
      if (changeObserver) {
        changeObserver.disconnect()
      }

      // 建立新的觀察器
      changeObserver = new MutationObserver(() => {
        const location = getLocation()
        // eslint-disable-next-line no-unused-vars
        const currentUrl = location.href || ''
        const cachedUrl = detector._cachedUrl || ''

        if (currentUrl !== cachedUrl) {
          const oldUrl = cachedUrl
          const oldStatus = { isReadmooPage, pageType }

          detector._cachedUrl = currentUrl
          this.detectReadmooPage()

          const newStatus = this.getPageStatus()

          // Logger 後備方案: Content Script URL 變更除錯記錄
          // 設計理念: URL 變更檢測需要詳細除錯資訊，但不應影響效能
          // 後備機制: 僅在 console.debug 可用時記錄，避免生產環境影響
          // 使用場景: SPA 頁面導航檢測的除錯追蹤，提供狀態變更詳細資訊
          // eslint-disable-next-line no-console
          if (typeof console !== 'undefined' && console.debug) {
            // eslint-disable-next-line no-console
            console.debug('URL 變更檢測:', {
              from: oldUrl,
              to: currentUrl,
              oldStatus,
              newStatus
            })
          }

          // 呼叫回調函數
          try {
            callback({
              oldUrl,
              newUrl: currentUrl,
              oldStatus,
              newStatus,
              changed: oldStatus.pageType !== newStatus.pageType ||
                       oldStatus.isReadmooPage !== newStatus.isReadmooPage
            })
          } catch (error) {
            // Logger 後備方案: Content Script 回調錯誤記錄
            // 設計理念: 回調函數錯誤不應影響檢測器功能，但必須記錄
            // 後備機制: console.error 確保錯誤可見性和除錯能力
            // 使用場景: URL 變更回調執行失敗時的錯誤追蹤
            // eslint-disable-next-line no-console
            console.error('❌ URL 變更回調函數錯誤:', error)
          }
        }
      })

      // 開始觀察 - 使用動態document取得
      const getDocument = () => globalThis.document || window?.document
      const document = getDocument()
      const targetElement = document?.body || document?.documentElement
      if (targetElement) {
        changeObserver.observe(targetElement, {
          childList: true,
          subtree: true
        })
      } else {
        // Logger 後備方案: Content Script 環境檢測警告
        // 設計理念: DOM 環境問題需要立即警告，確保開發者了解執行環境限制
        // 後備機制: console.warn 提供環境問題的即時提醒
        // 使用場景: 無法取得觀察目標元素時的環境診斷資訊
        // eslint-disable-next-line no-console
        console.warn('⚠️ 無法找到觀察目標元素 (document.body 或 document.documentElement)')
      }

      // 返回停止函數
      return () => {
        if (changeObserver) {
          changeObserver.disconnect()
          changeObserver = null
        }
      }
    },

    /**
     * 手動觸發重新檢測
     *
     * @returns {Object} 更新後的頁面狀態
     */
    refresh () {
      return this.detectReadmooPage()
    },

    /**
     * 檢查頁面準備狀態
     *
     * @returns {Object} 頁面準備狀態資訊
     */
    checkPageReady () {
      const readyState = document.readyState
      const isReady = readyState === 'complete' || readyState === 'interactive'

      return {
        isReady,
        readyState,
        isReadmooPage,
        pageType,
        url: window.location.href,
        timestamp: Date.now()
      }
    },

    /**
     * 等待頁面準備
     *
     * @param {number} [timeout=5000] - 等待超時時間 (毫秒)
     * @returns {Promise<Object>} 頁面準備狀態
     */
    waitForPageReady (timeout = 5000) {
      return new Promise((resolve, reject) => {
        const checkReady = () => {
          const status = this.checkPageReady()
          if (status.isReady) {
            resolve(status)
            return true
          }
          return false
        }

        // 立即檢查
        if (checkReady()) return

        // 設定超時
        const timeoutId = setTimeout(() => {
          document.removeEventListener('DOMContentLoaded', readyHandler)
          document.removeEventListener('readystatechange', readyHandler)
          const error = new Error('等待頁面準備超時')
          error.code = ErrorCodes.TIMEOUT_ERROR
          error.details = { category: 'general', timeout, operation: 'waitForPageReady' }
          reject(error)
        }, timeout)

        // 設定事件監聽器
        const readyHandler = () => {
          if (checkReady()) {
            clearTimeout(timeoutId)
            document.removeEventListener('DOMContentLoaded', readyHandler)
            document.removeEventListener('readystatechange', readyHandler)
          }
        }

        document.addEventListener('DOMContentLoaded', readyHandler)
        document.addEventListener('readystatechange', readyHandler)
      })
    },

    /**
     * 清理檢測器
     */
    destroy () {
      if (changeObserver) {
        changeObserver.disconnect()
        changeObserver = null
      }
    },

    /**
     * 初始化檢測器 (BaseModule 相容性)
     */
    async initialize () {
      // PageDetector 在建立時已自動初始化
      return Promise.resolve()
    },

    /**
     * 啟動檢測器 (BaseModule 相容性)
     */
    async start () {
      // PageDetector 在建立時已自動啟動
      return Promise.resolve()
    },

    /**
     * 停止檢測器 (BaseModule 相容性)
     */
    async stop () {
      this.destroy()
      return Promise.resolve()
    },

    /**
     * 健康狀態檢查 (BaseModule 相容性)
     */
    _getCustomHealthStatus () {
      return {
        pageDetected: isReadmooPage,
        pageType,
        health: 'healthy'
      }
    }
  }

  // 初始化檢測
  detector.detectReadmooPage()

  // 設定構造函數名稱
  Object.defineProperty(detector, 'constructor', {
    value: { name: 'PageDetector' },
    writable: false
  })

  return detector
}

module.exports = createPageDetector
