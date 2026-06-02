/**
 * 匯出服務
 *
 * 負責功能：
 * - 資料匯出和格式轉換
 * - 多種匯出格式支援 (JSON, CSV, Excel)
 * - 匯出任務管理和進度追蹤
 * - 檔案生成和下載處理
 *
 * 設計考量：
 * - 可擴展的匯出格式處理器
 * - 大型資料集的分批匯出
 * - 自訂匯出範本和格式
 * - 高效能的檔案生成機制
 */

const {
  EXTRACTION_EVENTS,
  EVENT_PRIORITIES
} = require('src/background/constants/module-constants')
const ErrorCodes = require('src/core/errors/ErrorCodes')

class ExportService {
  constructor (dependencies = {}) {
    this.eventBus = dependencies.eventBus || null
    // Logger 後備方案: Background Service 初始化保護
    // 設計理念: 匯出服務需要記錄資料處理和檔案生成的詳細過程
    // 執行環境: Service Worker 初始化階段，依賴注入可能不完整
    // 後備機制: console 確保模組生命週期錯誤能被追蹤
    // 風險考量: 理想上應確保 Logger 完整可用，此為過渡性保護
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    this.state = {
      initialized: false,
      active: false,
      exporting: false
    }

    this.exportFormats = new Map()
    this.exportTasks = new Map()
    this.registeredListeners = new Map()

    this.stats = {
      exportsGenerated: 0,
      exportErrors: 0,
      totalExportTime: 0,
      averageExportTime: 0
    }

    this.initializeExportFormats()
  }

  async initialize () {
    if (this.state.initialized) return

    try {
      this.logger.log('初始化匯出服務')
      await this.registerEventListeners()
      this.state.initialized = true
      this.logger.log('[OK] 匯出服務初始化完成')
    } catch (error) {
      this.logger.error('[FAIL] 初始化匯出服務失敗:', error)
      throw error
    }
  }

  async start () {
    if (!this.state.initialized || this.state.active) return

    this.state.active = true
    this.state.exporting = true
    this.logger.log('[OK] 匯出服務啟動完成')
  }

  async stop () {
    if (!this.state.active) return

    await this.unregisterEventListeners()
    this.state.active = false
    this.state.exporting = false
    this.logger.log('[OK] 匯出服務停止完成')
  }

  initializeExportFormats () {
    // JSON 匯出格式
    this.exportFormats.set('json', {
      name: 'JSON',
      extension: 'json',
      mimeType: 'application/json',
      processor: (data, options) => {
        return JSON.stringify(data, null, options.indent || 2)
      }
    })

    // CSV 匯出格式
    this.exportFormats.set('csv', {
      name: 'CSV',
      extension: 'csv',
      mimeType: 'text/csv',
      processor: (data, options) => {
        if (!Array.isArray(data.books)) return ''

        const headers = ['標題', '作者', '出版社', '分類', '進度', '評分']
        const rows = data.books.map(book => [
          book.title || '',
          book.author || '',
          book.publisher || '',
          book.category || '',
          book.progress || 0,
          book.rating || 0
        ])

        return [headers, ...rows].map(row =>
          row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\n')
      }
    })

    this.logger.log(`[OK] 初始化了 ${this.exportFormats.size} 個匯出格式`)
  }

  async exportData (data, format = 'json', options = {}) {
    const startTime = Date.now()
    const taskId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`

    try {
      this.logger.log(`開始匯出資料: ${format}`)

      const exportFormat = this.exportFormats.get(format)
      if (!exportFormat) {
        const error = new Error(`不支援的匯出格式: ${format}`)
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = { category: 'export' }
        throw error
      }

      // 建立匯出任務
      this.exportTasks.set(taskId, {
        id: taskId,
        format,
        status: 'processing',
        startTime,
        progress: 0
      })

      // 處理資料
      const exportedContent = exportFormat.processor(data, options)

      // 生成檔案資訊
      const exportResult = {
        taskId,
        content: exportedContent,
        format: exportFormat,
        filename: this.generateFilename(format, options),
        size: exportedContent.length,
        generatedAt: Date.now()
      }

      // 更新任務狀態
      this.exportTasks.get(taskId).status = 'completed'
      this.exportTasks.get(taskId).result = exportResult

      // 更新統計
      const exportTime = Date.now() - startTime
      this.updateExportStats(exportTime)

      this.logger.log(`[OK] 匯出完成: ${format} (${exportTime}ms)`)

      return exportResult
    } catch (error) {
      this.stats.exportErrors++
      this.logger.error(`[FAIL] 匯出失敗: ${format}`, error)

      if (this.exportTasks.has(taskId)) {
        this.exportTasks.get(taskId).status = 'failed'
        this.exportTasks.get(taskId).error = error.message
      }

      throw error
    }
  }

  generateFilename (format, options = {}) {
    const timestamp = new Date().toISOString().slice(0, 10)
    const prefix = options.filenamePrefix || 'readmoo_books'
    const extension = this.exportFormats.get(format)?.extension || format
    return `${prefix}_${timestamp}.${extension}`
  }

  updateExportStats (exportTime) {
    this.stats.exportsGenerated++
    this.stats.totalExportTime += exportTime
    this.stats.averageExportTime = this.stats.totalExportTime / this.stats.exportsGenerated
  }

  async registerEventListeners () {
    if (!this.eventBus) return

    const listeners = [
      {
        event: EXTRACTION_EVENTS.EXPORT_REQUEST,
        handler: this.handleExportRequest.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      }
    ]

    for (const { event, handler, priority } of listeners) {
      const listenerId = await this.eventBus.on(event, handler, { priority })
      this.registeredListeners.set(event, listenerId)
    }
  }

  async unregisterEventListeners () {
    if (!this.eventBus) return

    for (const [event, listenerId] of this.registeredListeners) {
      try {
        await this.eventBus.off(event, listenerId)
      } catch (error) {
        this.logger.error(`[FAIL] 取消註冊事件監聽器失敗 (${event}):`, error)
      }
    }
    this.registeredListeners.clear()
  }

  async handleExportRequest (event) {
    try {
      const { data, format, options, requestId } = event.data || {}
      const result = await this.exportData(data, format, options)

      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.EXPORT.RESULT', {
          requestId,
          result
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 處理匯出請求失敗:', error)
    }
  }

  getStatus () {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      exporting: this.state.exporting,
      formatsCount: this.exportFormats.size,
      activeTasks: this.exportTasks.size,
      stats: { ...this.stats }
    }
  }

  getHealthStatus () {
    const errorRate = this.stats.exportsGenerated > 0
      ? (this.stats.exportErrors / this.stats.exportsGenerated)
      : 0

    return {
      service: 'ExportService',
      healthy: this.state.initialized && errorRate < 0.1,
      status: this.state.active ? 'active' : 'inactive',
      metrics: {
        exportsGenerated: this.stats.exportsGenerated,
        exportErrors: this.stats.exportErrors,
        averageExportTime: this.stats.averageExportTime,
        errorRate: (errorRate * 100).toFixed(2) + '%'
      }
    }
  }
}

module.exports = ExportService
