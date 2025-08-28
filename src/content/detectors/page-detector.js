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
function createPageDetector () {
  // 使用 globalThis.location 或 window.location，優先使用 globalThis（測試環境）
  const location = globalThis.location || window.location
  let currentUrl = location.href
  let isReadmooPage = false
  let pageType = 'unknown'
  let changeObserver = null

  const detector = {
    /**
     * 檢測 Readmoo 頁面
     *
     * @returns {Object} 檢測結果 { isReadmooPage, pageType }
     */
    detectReadmooPage () {
      console.log('Debug - PageDetector location:', { 
        hostname: location.hostname, 
        href: location.href,
        origin: location.origin 
      })
      isReadmooPage = location.hostname.includes('readmoo.com')
      pageType = isReadmooPage ? this.detectPageType() : 'unknown'

      console.log(`📍 頁面檢測: ${isReadmooPage ? 'Readmoo' : '非Readmoo'} 頁面 (${pageType})`)

      return { isReadmooPage, pageType }
    },

    /**
     * 檢測頁面類型
     *
     * @returns {string} 頁面類型 ('library', 'shelf', 'reader', 'unknown')
     */
    detectPageType () {
      const url = location.href
      const pathname = location.pathname

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
      return {
        isReadmooPage,
        pageType,
        url: location.href,
        hostname: location.hostname,
        pathname: location.pathname,
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
        throw new Error('callback 必須是函數')
      }

      // 如果已有觀察器，先清理
      if (changeObserver) {
        changeObserver.disconnect()
      }

      // 建立新的觀察器
      changeObserver = new MutationObserver(() => {
        if (location.href !== currentUrl) {
          const oldUrl = currentUrl
          const oldStatus = { isReadmooPage, pageType }

          currentUrl = location.href
          this.detectReadmooPage()

          const newStatus = this.getPageStatus()

          console.log('🔄 頁面 URL 變更:', {
            from: oldUrl,
            to: currentUrl,
            oldStatus,
            newStatus
          })

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
            console.error('❌ URL 變更回調函數錯誤:', error)
          }
        }
      })

      // 開始觀察 - 使用 globalThis.document 或 document
      const document = globalThis.document || window.document
      const targetElement = document.body || document.documentElement
      if (targetElement) {
        changeObserver.observe(targetElement, {
          childList: true,
          subtree: true
        })
      } else {
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
      currentUrl = window.location.href
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
          reject(new Error('等待頁面準備超時'))
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

      console.log('🧹 PageDetector 已清理完成')
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
