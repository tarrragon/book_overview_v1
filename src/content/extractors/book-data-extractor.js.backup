/**
 * book-data-extractor.js
 *
 * 書籍資料提取器模組
 *
 * 負責功能：
 * - 事件驅動的書籍資料提取流程管理
 * - 多並行提取流程支援
 * - 即時進度回報和錯誤處理
 * - 頁面類型檢測和相容性驗證
 *
 * 設計考量：
 * - 支援取消和恢復機制
 * - 提供詳細的流程狀態追蹤
 * - 優化記憶體使用，避免流程堆積
 * - 確保與事件系統的緊密整合
 *
 * 處理流程：
 * 1. 流程啟動 → 檢查頁面可提取性
 * 2. 進度追蹤 → 定期報告提取進度
 * 3. 資料提取 → 調用 ReadmooAdapter
 * 4. 結果回報 → 觸發完成或錯誤事件
 * 5. 流程清理 → 釋放相關資源
 *
 * 使用情境：
 * - Content Script 中的主要提取協調器
 * - 響應 Background 的提取指令
 * - 管理多個並行提取任務
 */

/**
 * 建立書籍資料提取器實例
 *
 * @returns {Object} BookDataExtractor 實例
 */
const { StandardError } = require('src/core/errors/StandardError')

function createBookDataExtractor () {
  let eventBus = null
  let readmooAdapter = null
  const activeExtractionFlows = new Map()
  const extractionHistory = []
  const maxHistorySize = 50 // 限制歷史記錄大小

  // 動態取得環境物件的輔助函數
  const getDocument = () => globalThis.document || window?.document
  const getLocation = () => globalThis.location || window?.location || {}

  const extractor = {
    /**
     * 設定事件系統
     *
     * @param {Object} bus - EventBus 實例
     */
    setEventBus (bus) {
      eventBus = bus
    },

    /**
     * 取得事件系統
     *
     * @returns {Object} EventBus 實例
     */
    get eventBus () {
      return eventBus
    },

    /**
     * 設定 ReadmooAdapter
     *
     * @param {Object} adapter - ReadmooAdapter 實例
     */
    setReadmooAdapter (adapter) {
      readmooAdapter = adapter
    },

    /**
     * 檢測 Readmoo 頁面類型
     *
     * @returns {string} 頁面類型 ('library', 'shelf', 'reader', 'unknown')
     */
    getReadmooPageType () {
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
     * 檢查是否為可提取的頁面
     *
     * @returns {boolean} 是否可提取
     */
    isExtractableReadmooPage () {
      const pageType = this.getReadmooPageType()
      return ['library', 'shelf'].includes(pageType)
    },

    /**
     * 檢查頁面準備狀態
     *
     * @returns {Promise<Object>} 頁面狀態資訊
     */
    async checkPageReady () {
      const pageType = this.getReadmooPageType()
      const document = getDocument()
      const isReady = document ? (document.readyState === 'complete' || document.readyState === 'interactive') : false

      let bookCount = 0
      if (readmooAdapter) {
        const bookElements = readmooAdapter.getBookElements()
        bookCount = bookElements.length
      }

      const location = getLocation()
      return {
        isReady,
        pageType,
        bookCount,
        extractable: this.isExtractableReadmooPage() && bookCount > 0,
        url: location.href || '',
        timestamp: Date.now()
      }
    },

    /**
     * 生成唯一的流程 ID
     *
     * @returns {string} 流程 ID
     */
    generateFlowId () {
      return `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },

    /**
     * 啟動提取流程
     *
     * @param {Object} [config={}] - 提取配置
     * @param {string} [config.pageType] - 指定頁面類型
     * @param {Object} [config.options] - 額外選項
     * @returns {Promise<string>} 流程 ID
     */
    async startExtractionFlow (config = {}) {
      const flowId = this.generateFlowId()
      const pageType = config.pageType || this.getReadmooPageType()

      try {
        // 檢查頁面是否可提取
        if (!this.isExtractableReadmooPage()) {
          throw new StandardError('UNKNOWN_ERROR', `不支援的頁面類型: ${pageType}`, {
            category: 'general'
          })
        }

        // 建立流程狀態
        const flowState = {
          id: flowId,
          pageType,
          config,
          status: 'started',
          startTime: Date.now(),
          progress: 0,
          extractedBooks: [],
          errors: []
        }

        activeExtractionFlows.set(flowId, flowState)

        // 觸發開始事件
        if (eventBus) {
          await eventBus.emit('EXTRACTION.STARTED', {
            flowId,
            pageType,
            config,
            timestamp: Date.now()
          })
        }

        // 執行實際提取
        await this.performActualExtraction(flowId)

        return flowId
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('❌ 啟動提取流程失敗:', error)

        if (eventBus) {
          await eventBus.emit('EXTRACTION.ERROR', {
            flowId,
            error: error.message,
            timestamp: Date.now()
          })
        }

        throw error
      }
    },

    /**
     * 執行實際提取
     *
     * @param {string} flowId - 流程 ID
     * @returns {Promise<void>}
     */
    async performActualExtraction (flowId) {
      const flowState = activeExtractionFlows.get(flowId)
      if (!flowState || !readmooAdapter) {
        throw new StandardError('UNKNOWN_ERROR', '流程狀態或適配器不存在', {
          category: 'general'
        })
      }

      try {
        // 報告進度: 開始提取
        await this.reportProgress(flowId, 0.1, '開始提取書籍資料')

        // 提取所有書籍
        const booksData = await readmooAdapter.extractAllBooks()

        // 更新流程狀態
        flowState.extractedBooks = booksData
        flowState.progress = 1.0
        flowState.status = 'completed'
        flowState.endTime = Date.now()

        // 報告完成
        if (eventBus) {
          await eventBus.emit('EXTRACTION.COMPLETED', {
            flowId,
            booksData,
            count: booksData.length,
            duration: flowState.endTime - flowState.startTime,
            timestamp: Date.now()
          })
        }

        // 記錄到歷史並清理活動流程
        this.addToHistory(flowState)
        activeExtractionFlows.delete(flowId)
      } catch (error) {
        flowState.status = 'failed'
        flowState.errors.push(error.message)
        flowState.endTime = Date.now()

        // 觸發錯誤事件
        if (eventBus) {
          await eventBus.emit('EXTRACTION.ERROR', {
            flowId,
            error: error.message,
            timestamp: Date.now()
          })
        }

        // 記錄失敗流程到歷史
        this.addToHistory(flowState)
        activeExtractionFlows.delete(flowId)

        throw error
      }
    },

    /**
     * 報告進度
     *
     * @param {string} flowId - 流程 ID
     * @param {number} progress - 進度 (0-1)
     * @param {string} [message=''] - 進度訊息
     * @returns {Promise<void>}
     */
    async reportProgress (flowId, progress, message = '') {
      const flowState = activeExtractionFlows.get(flowId)
      if (flowState) {
        flowState.progress = progress
        flowState.lastUpdate = Date.now()
      }

      if (eventBus) {
        await eventBus.emit('EXTRACTION.PROGRESS', {
          flowId,
          progress,
          message,
          timestamp: Date.now()
        })
      }
    },

    /**
     * 取消提取流程
     *
     * @param {string} flowId - 流程 ID
     * @returns {Promise<Object>} 取消結果
     */
    async cancelExtraction (flowId) {
      const flowState = activeExtractionFlows.get(flowId)
      if (flowState) {
        flowState.status = 'cancelled'
        flowState.endTime = Date.now()

        if (eventBus) {
          await eventBus.emit('EXTRACTION.CANCELLED', {
            flowId,
            timestamp: Date.now()
          })
        }

        // 移至歷史並清理
        this.addToHistory(flowState)
        activeExtractionFlows.delete(flowId)

        return { success: true, flowId }
      }

      return { success: false, error: '流程不存在' }
    },

    /**
     * 取得流程狀態
     *
     * @param {string} flowId - 流程 ID
     * @returns {Object|null} 流程狀態
     */
    getExtractionFlowStatus (flowId) {
      return activeExtractionFlows.get(flowId) || null
    },

    /**
     * 取得活動流程列表
     *
     * @returns {string[]} 活動流程 ID 列表
     */
    getActiveExtractionFlows () {
      return Array.from(activeExtractionFlows.keys())
    },

    /**
     * 添加流程到歷史記錄
     *
     * @param {Object} flowState - 流程狀態
     */
    addToHistory (flowState) {
      extractionHistory.unshift({
        ...flowState,
        archivedAt: Date.now()
      })

      // 限制歷史記錄大小
      if (extractionHistory.length > maxHistorySize) {
        extractionHistory.splice(maxHistorySize)
      }
    },

    /**
     * 取得提取歷史
     *
     * @param {number} [limit=10] - 返回記錄數量限制
     * @returns {Object[]} 歷史記錄
     */
    getExtractionHistory (limit = 10) {
      return extractionHistory.slice(0, limit)
    }
  }

  // 設定構造函數名稱
  Object.defineProperty(extractor, 'constructor', {
    value: { name: 'BookDataExtractor' },
    writable: false
  })

  return extractor
}

module.exports = createBookDataExtractor
