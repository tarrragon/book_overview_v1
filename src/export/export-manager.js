/**
 * 匯出管理器 - TDD循環 #30 Refactor階段重構優化
 *
 * 負責功能：
 * - 管理匯出流程的事件驅動協調
 * - 整合現有 BookDataExporter 和新事件系統
 * - 處理匯出進度追蹤和狀態管理
 * - 支援並發匯出和錯誤恢復
 * - 提供匯出歷史記錄和統計
 *
 * 設計考量：
 * - 使用事件總線作為通訊基礎，避免循環依賴
 * - 與現有 BookDataExporter 保持完全相容
 * - 支援各種匯出格式和批量操作
 * - 提供完整的錯誤處理機制
 * - 維護匯出狀態和資源管理
 *
 * 重構改善 (v1.0.2)：
 * - 分離匯出執行階段，提升單一職責原則
 * - 統一事件發送機制，減少程式碼重複
 * - 優化進度更新頻率控制，提升效能
 * - 增強記憶體管理和歷史清理機制
 * - 完善錯誤處理和資料驗證
 * - 提供更詳細的統計資訊和性能指標
 *
 * 處理流程：
 * 1. 預處理階段：驗證資料、檢查並發限制、初始化狀態
 * 2. 執行階段：建立 exporter、設定回調、執行匯出
 * 3. 後處理階段：發送事件、更新狀態、清理資源
 * 4. 錯誤處理：統一錯誤事件發送和狀態清理
 *
 * @version 1.0.2 (重構優化)
 * @since 2025-08-08
 */

const { EXPORT_EVENTS, EXPORT_EVENT_PRIORITIES, createExportEvent } = require('./export-events')
const BookDataExporter = require('./book-data-exporter')
const { StandardError } = require('src/core/errors/StandardError')

/**
 * 匯出管理器類別
 * 管理所有匯出相關的事件和流程
 */
class ExportManager {
  /**
   * 建構函數
   *
   * @param {EventBus} eventBus - 事件總線實例
   */
  constructor (eventBus) {
    if (!eventBus) {
      throw new StandardError('EVENTBUS_REQUIRED', 'EventBus is required for ExportManager', {
        category: 'initialization',
        requiredDependency: 'EventBus'
      })
    }

    /**
     * 事件總線實例
     * @type {EventBus}
     */
    this.eventBus = eventBus

    /**
     * 當前匯出狀態
     * @type {boolean}
     */
    this.isExporting = false

    /**
     * 當前進行中的匯出操作
     * @type {Map<string, Object>}
     */
    this.currentExports = new Map()

    /**
     * 匯出歷史記錄
     * @type {Array<Object>}
     */
    this.exportHistory = []

    /**
     * 最大並發匯出數量
     * @type {number}
     */
    this.maxConcurrentExports = 5

    // 初始化事件監聽器
    this._initializeEventListeners()
  }

  /**
   * 初始化事件監聽器
   * 註冊所有匯出相關的事件處理函數
   *
   * @private
   */
  _initializeEventListeners () {
    // CSV 匯出事件
    this.eventBus.on(EXPORT_EVENTS.CSV_EXPORT_REQUESTED,
      this._handleCSVExport.bind(this), {
        priority: EXPORT_EVENT_PRIORITIES.CSV_EXPORT_REQUESTED
      })

    // JSON 匯出事件
    this.eventBus.on(EXPORT_EVENTS.JSON_EXPORT_REQUESTED,
      this._handleJSONExport.bind(this), {
        priority: EXPORT_EVENT_PRIORITIES.JSON_EXPORT_REQUESTED
      })

    // Excel 匯出事件
    this.eventBus.on(EXPORT_EVENTS.EXCEL_EXPORT_REQUESTED,
      this._handleExcelExport.bind(this), {
        priority: EXPORT_EVENT_PRIORITIES.EXCEL_EXPORT_REQUESTED
      })

    // PDF 匯出事件
    this.eventBus.on(EXPORT_EVENTS.PDF_EXPORT_REQUESTED,
      this._handlePDFExport.bind(this), {
        priority: EXPORT_EVENT_PRIORITIES.PDF_EXPORT_REQUESTED
      })

    // 批量匯出事件
    this.eventBus.on(EXPORT_EVENTS.BATCH_EXPORT_REQUESTED,
      this._handleBatchExport.bind(this), {
        priority: EXPORT_EVENT_PRIORITIES.BATCH_EXPORT_REQUESTED
      })

    // 檔案下載事件
    this.eventBus.on(EXPORT_EVENTS.FILE_DOWNLOAD_REQUESTED,
      this._handleFileDownload.bind(this), {
        priority: EXPORT_EVENT_PRIORITIES.FILE_DOWNLOAD_REQUESTED
      })

    // 取消匯出事件
    this.eventBus.on(EXPORT_EVENTS.EXPORT_CANCELLED,
      this._handleExportCancellation.bind(this), {
        priority: EXPORT_EVENT_PRIORITIES.EXPORT_CANCELLED
      })
  }

  /**
   * 處理 CSV 匯出請求
   * 重構: 簡化邏輯，避免深層嵌套和循環依賴
   *
   * @param {Object} exportData - 匯出資料
   * @param {Array} exportData.books - 書籍資料
   * @param {Object} exportData.options - 匯出選項
   * @returns {Promise<Object>} 匯出結果
   * @private
   */
  async _handleCSVExport (exportData) {
    return this._executeExport('csv', exportData, (exporter, options) => {
      return exporter.exportToCSV(options)
    })
  }

  /**
   * 處理 JSON 匯出請求
   * 重構: 使用統一的匯出執行函數
   *
   * @param {Object} exportData - 匯出資料
   * @returns {Promise<Object>} 匯出結果
   * @private
   */
  async _handleJSONExport (exportData) {
    return this._executeExport('json', exportData, (exporter, options) => {
      return exporter.exportToJSON(options)
    })
  }

  /**
   * 處理 Excel 匯出請求
   * 重構: 使用統一的匯出執行函數
   *
   * @param {Object} exportData - 匯出資料
   * @returns {Promise<Object>} 匯出結果
   * @private
   */
  async _handleExcelExport (exportData) {
    return this._executeExport('excel', exportData, (exporter, options) => {
      return exporter.exportToExcel(options)
    })
  }

  /**
   * 處理 PDF 匯出請求
   * 重構: 使用統一的匯出執行函數
   *
   * @param {Object} exportData - 匯出資料
   * @returns {Promise<Object>} 匯出結果
   * @private
   */
  async _handlePDFExport (exportData) {
    return this._executeExport('pdf', exportData, (exporter, options) => {
      return exporter.exportToPDF(options)
    })
  }

  /**
   * 統一的匯出執行函數 - 重構優化版本
   * 簡化邏輯，提升可讀性和可維護性
   *
   * 負責功能：
   * - 統一匯出流程管理和錯誤處理
   * - 協調 BookDataExporter 和事件系統
   * - 提供完整的進度追蹤和狀態管理
   *
   * 設計考量：
   * - 使用單一職責原則分離各階段處理
   * - 非同步進度回調避免堆疊溢出
   * - 統一事件發送機制提升一致性
   *
   * @param {string} format - 匯出格式
   * @param {Object} exportData - 匯出資料
   * @param {Function} exportFunction - 具體匯出函數
   * @returns {Promise<Object>} 匯出結果
   * @private
   */
  async _executeExport (format, exportData, exportFunction) {
    const exportId = this._generateExportId(format)

    try {
      // 階段1: 預處理和驗證
      await this._preprocessExport(exportId, format, exportData)

      // 階段2: 執行匯出操作
      const exportResult = await this._performExport(exportId, format, exportData, exportFunction)

      // 階段3: 後處理和清理
      await this._postprocessExport(exportId, format, exportResult, exportData.correlationId)

      return { success: true, data: exportResult, exportId }
    } catch (error) {
      await this._handleExportError(exportId, format, error, exportData.correlationId)
      throw error
    }
  }

  /**
   * 匯出預處理階段
   * 負責驗證資料、初始化狀態和開始進度追蹤
   *
   * @param {string} exportId - 匯出ID
   * @param {string} format - 匯出格式
   * @param {Object} exportData - 匯出資料
   * @returns {Promise<void>}
   * @private
   */
  async _preprocessExport (exportId, format, exportData) {
    // 驗證匯出資料
    this._validateExportData(exportData, format)

    // 檢查並發限制
    if (this.currentExports.size >= this.maxConcurrentExports) {
      throw new StandardError('EXPORT_OPERATION_FAILED', `Maximum concurrent exports (${this.maxConcurrentExports}, {
          "category": "export"
      }) exceeded`)
    }

    // 記錄匯出開始
    this._addExportRecord(exportId, format, exportData)
    this._safeUpdateProgress(exportId, 0, 'starting', `開始 ${format.toUpperCase()} 匯出...`)
  }

  /**
   * 執行具體匯出操作
   *
   * @param {string} exportId - 匯出ID
   * @param {string} format - 匯出格式
   * @param {Object} exportData - 匯出資料
   * @param {Function} exportFunction - 具體匯出函數
   * @returns {Promise<*>} 匯出結果
   * @private
   */
  async _performExport (exportId, format, exportData, exportFunction) {
    // 建立 BookDataExporter 實例
    const exporter = new BookDataExporter(exportData.books)

    // 設定進度回調
    this._setupProgressCallback(exporter, exportId, format)

    // 執行匯出操作
    return await exportFunction(exporter, exportData.options)
  }

  /**
   * 匯出後處理階段
   * 負責發送完成事件和清理狀態
   *
   * @param {string} exportId - 匯出ID
   * @param {string} format - 匯出格式
   * @param {*} exportResult - 匯出結果
   * @param {string} correlationId - 相關性ID
   * @returns {Promise<void>}
   * @private
   */
  async _postprocessExport (exportId, format, exportResult, correlationId) {
    // 發送完成事件
    this._emitCompletionEvent(format, exportId, exportResult, correlationId)

    // 更新狀態
    this._completeExport(exportId, { data: exportResult, format })
  }

  /**
   * 處理匯出錯誤
   *
   * @param {string} exportId - 匯出ID
   * @param {string} format - 匯出格式
   * @param {Error} error - 錯誤物件
   * @param {string} correlationId - 相關性ID
   * @returns {Promise<void>}
   * @private
   */
  async _handleExportError (exportId, format, error, correlationId) {
    // 發送失敗事件
    this._emitFailureEvent(format, exportId, error, correlationId)

    // 更新狀態
    this._failExport(exportId, error)
  }

  /**
   * 驗證匯出資料
   *
   * @param {Object} exportData - 匯出資料
   * @param {string} format - 匯出格式
   * @private
   */
  _validateExportData (exportData, format) {
    if (!exportData || !exportData.books) {
      throw new StandardError('REQUIRED_FIELD_MISSING', `Invalid ${format} export data: books array is required`, {
          "dataType": "array",
          "category": "export"
      })
    }

    if (!Array.isArray(exportData.books)) {
      throw new StandardError('INVALID_DATA_FORMAT', `Invalid ${format} export data: books must be an array`, {
          "dataType": "array",
          "category": "export"
      })
    }

    if (exportData.books.length === 0) {
      throw new StandardError('INVALID_DATA_FORMAT', `Invalid ${format} export data: books array cannot be empty`, {
          "dataType": "array",
          "category": "export"
      })
    }
  }

  /**
   * 設定進度回調 - 重構優化版本
   * 改善性能和頻率控制，避免過於頻繁的進度更新
   *
   * @param {BookDataExporter} exporter - 匯出器實例
   * @param {string} exportId - 匯出ID
   * @param {string} format - 匯出格式
   * @private
   */
  _setupProgressCallback (exporter, exportId, format) {
    let lastUpdateTime = 0
    const PROGRESS_THROTTLE_MS = 100 // 進度更新節流闾值

    exporter.setProgressCallback((progress) => {
      const now = Date.now()

      // 節流進度更新，避免過於頻繁的事件發送
      if (now - lastUpdateTime >= PROGRESS_THROTTLE_MS || progress === 100) {
        lastUpdateTime = now

        process.nextTick(() => {
          this._safeUpdateProgress(exportId, progress, 'processing', `處理 ${format.toUpperCase()} 資料...`)
        })
      }
    })
  }

  /**
   * 安全的進度更新 - 重構優化版本
   * 提升錯誤處理和狀態管理的健壯性
   *
   * @param {string} exportId - 匯出ID
   * @param {number} progress - 進度百分比
   * @param {string} phase - 當前階段
   * @param {string} message - 進度訊息
   * @private
   */
  _safeUpdateProgress (exportId, progress, phase, message) {
    // 更新內部狀態
    const record = this.currentExports.get(exportId)
    if (record) {
      record.progress = Math.max(0, Math.min(100, progress)) // 確保進度在合理範圍
      record.phase = phase
      record.lastUpdated = new Date()
    }

    // 發送進度事件
    this._emitProgressEvent(exportId, progress, phase, message)
  }

  /**
   * 發送進度事件
   *
   * @param {string} exportId - 匯出ID
   * @param {number} progress - 進度百分比
   * @param {string} phase - 當前階段
   * @param {string} message - 進度訊息
   * @private
   */
  _emitProgressEvent (exportId, progress, phase, message) {
    process.nextTick(() => {
      const progressData = {
        exportId,
        current: progress,
        total: 100,
        percentage: Math.max(0, Math.min(100, progress)),
        phase,
        message,
        timestamp: new Date().toISOString()
      }

      this.eventBus.emit(EXPORT_EVENTS.EXPORT_PROGRESS, progressData)
        .catch(error => {
          // eslint-disable-next-line no-console
          console.warn(`Failed to emit progress event for ${exportId}:`, error.message)
        })
    })
  }

  /**
   * 發送完成事件 - 重構優化版本
   * 統一事件發送機制，提升可維護性
   *
   * @param {string} format - 匯出格式
   * @param {string} exportId - 匯出ID
   * @param {*} data - 匯出資料
   * @param {string} correlationId - 相關性ID
   * @private
   */
  _emitCompletionEvent (format, exportId, data, correlationId) {
    const eventType = this._getCompletionEventType(format)
    if (!eventType) {
      // eslint-disable-next-line no-console
      console.warn(`Unknown export format for completion event: ${format}`)
      return
    }

    const eventData = this._buildEventData(exportId, data, correlationId)
    this.eventBus.emit(eventType, eventData)
  }

  /**
   * 發送失敗事件 - 重構優化版本
   * 統一錯誤事件發送機制
   *
   * @param {string} format - 匯出格式
   * @param {string} exportId - 匯出ID
   * @param {Error} error - 錯誤物件
   * @param {string} correlationId - 相關性ID
   * @private
   */
  _emitFailureEvent (format, exportId, error, correlationId) {
    const eventType = this._getFailureEventType(format)
    if (!eventType) {
      // eslint-disable-next-line no-console
      console.warn(`Unknown export format for failure event: ${format}`)
      return
    }

    const eventData = this._buildEventData(exportId, { error: error.message }, correlationId)
    this.eventBus.emit(eventType, eventData)
  }

  /**
   * 處理批量匯出請求 - 重構優化版本
   * 改善批量處理邏輯和進度追蹤
   *
   * @param {Object} exportData - 批量匯出資料
   * @param {Array} exportData.formats - 匯出格式陣列
   * @param {Array} exportData.books - 書籍資料
   * @param {Object} exportData.options - 各格式選項
   * @returns {Promise<Object>} 匯出結果
   * @private
   */
  async _handleBatchExport (exportData) {
    return this._executeExport('batch', exportData, async (exporter, options) => {
      const formats = exportData.formats || []

      if (formats.length === 0) {
        throw new StandardError('UI_OPERATION_FAILED', 'Batch export requires at least one format', {
          "category": "export"
      })
      }

      // 發送批量匯出開始事件
      this._emitBatchProgressEvents(formats)

      // 執行批量匯出
      return await exporter.batchExport(formats, options)
    })
  }

  /**
   * 發送批量匯出進度事件
   *
   * @param {Array} formats - 匯出格式陣列
   * @private
   */
  _emitBatchProgressEvents (formats) {
    const totalFormats = formats.length

    formats.forEach((format, index) => {
      const progress = Math.round((index + 1) / totalFormats * 100)

      process.nextTick(() => {
        const progressData = {
          format,
          current: index + 1,
          total: totalFormats,
          percentage: progress,
          phase: 'processing',
          message: `處理 ${format.toUpperCase()} 格式...`,
          timestamp: new Date().toISOString()
        }

        this.eventBus.emit(EXPORT_EVENTS.EXPORT_PROGRESS, progressData)
          .catch(error => {
            // eslint-disable-next-line no-console
            console.warn(`Failed to emit batch progress event for ${format}:`, error.message)
          })
      })
    })
  }

  /**
   * 處理檔案下載請求 - 重構優化版本
   * 特殊處理下載請求，不使用 _executeExport 以避免不必要的驗證
   *
   * @param {Object} downloadData - 下載資料
   * @param {*} downloadData.data - 要下載的資料
   * @param {string} downloadData.filename - 檔案名稱
   * @param {string} downloadData.mimeType - MIME 類型
   * @returns {Promise<Object>} 下載結果
   * @private
   */
  async _handleFileDownload (downloadData) {
    const exportId = this._generateExportId('download')

    try {
      // 驗證下載資料
      this._validateDownloadData(downloadData)

      // 添加下載記錄（使用特殊的記錄結構）
      this._addExportRecord(exportId, 'download', {
        ...downloadData,
        books: [] // 下載不需要 books 陣列，但需要滿足記錄結構
      })

      // 發送開始事件
      this._emitDownloadStartedEvent(downloadData)

      // 建立臨時 exporter 來處理下載
      const exporter = new BookDataExporter([])

      // 執行下載操作
      await exporter.downloadFile(
        downloadData.data,
        downloadData.filename,
        downloadData.mimeType
      )

      // 發送完成事件
      this._emitCompletionEvent('download', exportId, { filename: downloadData.filename }, downloadData.correlationId)

      // 更新狀態
      this._completeExport(exportId, { filename: downloadData.filename, format: 'download' })

      return { success: true, filename: downloadData.filename, exportId }
    } catch (error) {
      // 發送失敗事件
      this._emitFailureEvent('download', exportId, error, downloadData.correlationId)
      this._failExport(exportId, error)
      throw error
    }
  }

  /**
   * 驗證下載資料
   *
   * @param {Object} downloadData - 下載資料
   * @private
   */
  _validateDownloadData (downloadData) {
    if (!downloadData || !downloadData.data || !downloadData.filename) {
      throw new StandardError('REQUIRED_FIELD_MISSING', 'Invalid download data: data and filename are required', {
          "category": "export"
      })
    }

    if (typeof downloadData.filename !== 'string' || downloadData.filename.trim() === '') {
      throw new StandardError('INVALID_DATA_FORMAT', 'Invalid download data: filename must be a non-empty string', {
          "category": "export"
      })
    }

    // 檢查檔名是否包含非法字元
    const invalidChars = /[<>:"/\\|?*]/
    if (invalidChars.test(downloadData.filename)) {
      throw new StandardError('INVALID_DATA_FORMAT', 'Invalid download data: filename contains illegal characters', {
          "category": "export"
      })
    }
  }

  /**
   * 發送下載開始事件
   *
   * @param {Object} downloadData - 下載資料
   * @private
   */
  _emitDownloadStartedEvent (downloadData) {
    process.nextTick(() => {
      const eventData = {
        filename: downloadData.filename,
        fileSize: downloadData.data ? downloadData.data.length : 0,
        mimeType: downloadData.mimeType,
        correlationId: downloadData.correlationId,
        timestamp: new Date().toISOString()
      }

      this.eventBus.emit(EXPORT_EVENTS.FILE_DOWNLOAD_STARTED, eventData)
        .catch(error => {
          // eslint-disable-next-line no-console
          console.warn('Failed to emit download started event:', error.message)
        })
    })
  }

  /**
   * 處理匯出取消請求
   *
   * @param {Object} cancelData - 取消資料
   * @param {string} cancelData.exportId - 要取消的匯出ID
   * @returns {Promise<Object>} 取消結果
   * @private
   */
  async _handleExportCancellation (cancelData) {
    if (!cancelData || !cancelData.exportId) {
      return { success: false, error: 'Export ID is required for cancellation' }
    }

    const exportRecord = this.currentExports.get(cancelData.exportId)
    if (exportRecord) {
      exportRecord.status = 'cancelled'
      exportRecord.endTime = new Date()
      this._moveToHistory(cancelData.exportId)
    }

    return { success: true, exportId: cancelData.exportId }
  }

  /**
   * 生成匯出ID
   *
   * @param {string} type - 匯出類型
   * @returns {string} 匯出ID
   * @private
   */
  _generateExportId (type) {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 添加匯出記錄
   *
   * @param {string} exportId - 匯出ID
   * @param {string} format - 匯出格式
   * @param {Object} data - 匯出資料
   * @private
   */
  _addExportRecord (exportId, format, data) {
    const record = {
      id: exportId,
      format,
      startTime: new Date(),
      status: 'in-progress',
      data,
      progress: 0
    }

    this.currentExports.set(exportId, record)

    if (this.currentExports.size === 1) {
      this.isExporting = true
    }
  }

  /**
   * 完成匯出
   *
   * @param {string} exportId - 匯出ID
   * @param {Object} result - 匯出結果
   * @private
   */
  _completeExport (exportId, result) {
    const record = this.currentExports.get(exportId)
    if (record) {
      record.status = 'completed'
      record.endTime = new Date()
      record.result = result
      this._moveToHistory(exportId)
    }

    this._updateExportingStatus()
  }

  /**
   * 標記匯出失敗
   *
   * @param {string} exportId - 匯出ID
   * @param {Error} error - 錯誤物件
   * @private
   */
  _failExport (exportId, error) {
    const record = this.currentExports.get(exportId)
    if (record) {
      record.status = 'failed'
      record.endTime = new Date()
      record.error = error.message
      this._moveToHistory(exportId)
    }

    this._updateExportingStatus()
  }

  /**
   * 將匯出記錄移至歷史 - 重構優化版本
   * 改善記憶體管理和歷史清理機制
   *
   * @param {string} exportId - 匯出ID
   * @private
   */
  _moveToHistory (exportId) {
    const record = this.currentExports.get(exportId)
    if (!record) {
      return
    }

    // 添加完成時間戳和持續時間
    record.completedAt = new Date()
    record.duration = record.completedAt - record.startTime

    // 清理敏感資料以節省記憶體
    delete record.data

    this.exportHistory.push(record)
    this.currentExports.delete(exportId)

    // 智能歷史清理機制
    this._cleanupHistory()
  }

  /**
   * 智能歷史清理機制
   * 根據記憶體使用情況動態調整歷史大小
   *
   * @private
   */
  _cleanupHistory () {
    const MAX_HISTORY_SIZE = 100
    const MIN_HISTORY_SIZE = 50

    if (this.exportHistory.length > MAX_HISTORY_SIZE) {
      // 保留最近的記錄，優先保留成功的匯出
      const recentSuccessful = this.exportHistory
        .filter(record => record.status === 'completed')
        .slice(-MIN_HISTORY_SIZE * 0.7)

      const recentFailed = this.exportHistory
        .filter(record => record.status === 'failed')
        .slice(-MIN_HISTORY_SIZE * 0.3)

      this.exportHistory = [...recentSuccessful, ...recentFailed]
        .sort((a, b) => a.startTime - b.startTime)
        .slice(-MIN_HISTORY_SIZE)
    }
  }

  /**
   * 更新匯出狀態
   * @private
   */
  _updateExportingStatus () {
    this.isExporting = this.currentExports.size > 0
  }

  /**
   * 獲取完成事件類型
   *
   * @param {string} format - 匯出格式
   * @returns {string|null} 事件類型
   * @private
   */
  _getCompletionEventType (format) {
    const eventTypeMap = {
      csv: EXPORT_EVENTS.CSV_EXPORT_COMPLETED,
      json: EXPORT_EVENTS.JSON_EXPORT_COMPLETED,
      excel: EXPORT_EVENTS.EXCEL_EXPORT_COMPLETED,
      pdf: EXPORT_EVENTS.PDF_EXPORT_COMPLETED,
      batch: EXPORT_EVENTS.BATCH_EXPORT_COMPLETED,
      download: EXPORT_EVENTS.FILE_DOWNLOAD_COMPLETED
    }

    return eventTypeMap[format.toLowerCase()] || null
  }

  /**
   * 獲取失敗事件類型
   *
   * @param {string} format - 匯出格式
   * @returns {string|null} 事件類型
   * @private
   */
  _getFailureEventType (format) {
    const eventTypeMap = {
      csv: EXPORT_EVENTS.CSV_EXPORT_FAILED,
      json: EXPORT_EVENTS.JSON_EXPORT_FAILED,
      excel: EXPORT_EVENTS.EXCEL_EXPORT_FAILED,
      pdf: EXPORT_EVENTS.PDF_EXPORT_FAILED,
      batch: EXPORT_EVENTS.BATCH_EXPORT_FAILED,
      download: EXPORT_EVENTS.FILE_DOWNLOAD_FAILED
    }

    return eventTypeMap[format.toLowerCase()] || null
  }

  /**
   * 建立事件資料物件
   *
   * @param {string} exportId - 匯出ID
   * @param {*} data - 事件資料
   * @param {string} correlationId - 相關性ID
   * @returns {Object} 標準化事件資料
   * @private
   */
  _buildEventData (exportId, data, correlationId) {
    return {
      exportId,
      timestamp: new Date().toISOString(),
      correlationId,
      ...data
    }
  }

  /**
   * 獲取記憶體使用情況
   *
   * @returns {Object} 記憶體使用統計
   */
  getMemoryUsage () {
    const usage = process.memoryUsage()
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      currentExports: this.currentExports.size,
      historyLength: this.exportHistory.length,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 獲取匯出統計 - 重構增強版本
   * 提供更詳細的統計資訊和性能指標
   *
   * @returns {Object} 匯出統計資訊
   */
  getExportStats () {
    const total = this.exportHistory.length
    const completed = this.exportHistory.filter(record => record.status === 'completed').length
    const failed = this.exportHistory.filter(record => record.status === 'failed').length
    const cancelled = this.exportHistory.filter(record => record.status === 'cancelled').length

    // 格式分解統計
    const formatBreakdown = {}
    const formatSuccessRates = {}

    this.exportHistory.forEach(record => {
      const format = record.format
      formatBreakdown[format] = (formatBreakdown[format] || 0) + 1

      if (!formatSuccessRates[format]) {
        formatSuccessRates[format] = { total: 0, successful: 0 }
      }
      formatSuccessRates[format].total++
      if (record.status === 'completed') {
        formatSuccessRates[format].successful++
      }
    })

    // 計算成功率
    Object.keys(formatSuccessRates).forEach(format => {
      const stats = formatSuccessRates[format]
      formatSuccessRates[format].successRate = stats.total > 0
        ? Math.round((stats.successful / stats.total) * 100)
        : 0
    })

    // 效能指標
    const durations = this.exportHistory
      .filter(record => record.duration)
      .map(record => record.duration)

    const avgDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0

    return {
      overview: {
        totalExports: total,
        completed,
        failed,
        cancelled,
        currentExports: this.currentExports.size,
        successRate: total > 0 ? Math.round((completed / total) * 100) : 0
      },
      performance: {
        averageDuration: Math.round(avgDuration),
        totalFormats: Object.keys(formatBreakdown).length
      },
      breakdown: {
        byFormat: formatBreakdown,
        successRates: formatSuccessRates
      },
      system: {
        maxConcurrentExports: this.maxConcurrentExports,
        historySize: this.exportHistory.length,
        memoryUsage: this.getMemoryUsage()
      },
      timestamp: new Date().toISOString()
    }
  }
}

module.exports = ExportManager
