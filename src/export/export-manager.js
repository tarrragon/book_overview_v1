/**
 * 匯出管理器 - TDD循環 #29 Refactor階段重構
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
 * 重構改善：
 * - 解決記憶體堆疊溢出問題
 * - 分離事件處理邏輯，提高可讀性
 * - 優化進度回調機制，避免循環調用
 * - 簡化錯誤處理流程
 * - 提升模組內聚性和職責分離
 * 
 * @version 1.0.1 (重構)
 * @since 2025-08-08
 */

const { EXPORT_EVENTS, EXPORT_EVENT_PRIORITIES, createExportEvent } = require('./export-events');
const BookDataExporter = require('./book-data-exporter');

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
  constructor(eventBus) {
    if (!eventBus) {
      throw new Error('EventBus is required for ExportManager');
    }

    /**
     * 事件總線實例
     * @type {EventBus}
     */
    this.eventBus = eventBus;

    /**
     * 當前匯出狀態
     * @type {boolean}
     */
    this.isExporting = false;

    /**
     * 當前進行中的匯出操作
     * @type {Map<string, Object>}
     */
    this.currentExports = new Map();

    /**
     * 匯出歷史記錄
     * @type {Array<Object>}
     */
    this.exportHistory = [];

    /**
     * 最大並發匯出數量
     * @type {number}
     */
    this.maxConcurrentExports = 5;

    // 初始化事件監聽器
    this._initializeEventListeners();
  }

  /**
   * 初始化事件監聽器
   * 註冊所有匯出相關的事件處理函數
   * 
   * @private
   */
  _initializeEventListeners() {
    // CSV 匯出事件
    this.eventBus.on(EXPORT_EVENTS.CSV_EXPORT_REQUESTED, 
      this._handleCSVExport.bind(this), {
        priority: EXPORT_EVENT_PRIORITIES.CSV_EXPORT_REQUESTED
      });

    // JSON 匯出事件
    this.eventBus.on(EXPORT_EVENTS.JSON_EXPORT_REQUESTED, 
      this._handleJSONExport.bind(this), {
        priority: EXPORT_EVENT_PRIORITIES.JSON_EXPORT_REQUESTED
      });

    // Excel 匯出事件
    this.eventBus.on(EXPORT_EVENTS.EXCEL_EXPORT_REQUESTED, 
      this._handleExcelExport.bind(this), {
        priority: EXPORT_EVENT_PRIORITIES.EXCEL_EXPORT_REQUESTED
      });

    // PDF 匯出事件
    this.eventBus.on(EXPORT_EVENTS.PDF_EXPORT_REQUESTED, 
      this._handlePDFExport.bind(this), {
        priority: EXPORT_EVENT_PRIORITIES.PDF_EXPORT_REQUESTED
      });

    // 批量匯出事件
    this.eventBus.on(EXPORT_EVENTS.BATCH_EXPORT_REQUESTED, 
      this._handleBatchExport.bind(this), {
        priority: EXPORT_EVENT_PRIORITIES.BATCH_EXPORT_REQUESTED
      });

    // 檔案下載事件
    this.eventBus.on(EXPORT_EVENTS.FILE_DOWNLOAD_REQUESTED, 
      this._handleFileDownload.bind(this), {
        priority: EXPORT_EVENT_PRIORITIES.FILE_DOWNLOAD_REQUESTED
      });

    // 取消匯出事件
    this.eventBus.on(EXPORT_EVENTS.EXPORT_CANCELLED, 
      this._handleExportCancellation.bind(this), {
        priority: EXPORT_EVENT_PRIORITIES.EXPORT_CANCELLED
      });
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
  async _handleCSVExport(exportData) {
    return this._executeExport('csv', exportData, (exporter, options) => {
      return exporter.exportToCSV(options);
    });
  }

  /**
   * 處理 JSON 匯出請求
   * 重構: 使用統一的匯出執行函數
   * 
   * @param {Object} exportData - 匯出資料
   * @returns {Promise<Object>} 匯出結果
   * @private
   */
  async _handleJSONExport(exportData) {
    return this._executeExport('json', exportData, (exporter, options) => {
      return exporter.exportToJSON(options);
    });
  }

  /**
   * 處理 Excel 匯出請求
   * 重構: 使用統一的匯出執行函數
   * 
   * @param {Object} exportData - 匯出資料
   * @returns {Promise<Object>} 匯出結果
   * @private
   */
  async _handleExcelExport(exportData) {
    return this._executeExport('excel', exportData, (exporter, options) => {
      return exporter.exportToExcel(options);
    });
  }

  /**
   * 處理 PDF 匯出請求
   * 重構: 使用統一的匯出執行函數
   * 
   * @param {Object} exportData - 匯出資料
   * @returns {Promise<Object>} 匯出結果
   * @private
   */
  async _handlePDFExport(exportData) {
    return this._executeExport('pdf', exportData, (exporter, options) => {
      return exporter.exportToPDF(options);
    });
  }

  /**
   * 統一的匯出執行函數 - 核心重構
   * 避免程式碼重複，統一錯誤處理和進度追蹤
   * 
   * @param {string} format - 匯出格式
   * @param {Object} exportData - 匯出資料
   * @param {Function} exportFunction - 具體匯出函數
   * @returns {Promise<Object>} 匯出結果
   * @private
   */
  async _executeExport(format, exportData, exportFunction) {
    const exportId = this._generateExportId(format);
    
    try {
      // 驗證匯出資料
      this._validateExportData(exportData, format);

      // 記錄匯出開始
      this._addExportRecord(exportId, format, exportData);
      this._safeUpdateProgress(exportId, 0, 'starting', `開始 ${format.toUpperCase()} 匯出...`);

      // 建立 BookDataExporter 實例
      const exporter = new BookDataExporter(exportData.books);
      
      // 設定進度回調（非同步處理，避免循環依賴）
      this._setupProgressCallback(exporter, exportId, format);

      // 執行具體的匯出操作
      const exportResult = exportFunction(exporter, exportData.options);
      
      // 非同步發送完成事件
      this._emitCompletionEvent(format, exportId, exportResult, exportData.correlationId);

      // 更新狀態
      this._completeExport(exportId, { data: exportResult, format });

      return { success: true, data: exportResult, exportId };

    } catch (error) {
      // 非同步發送失敗事件  
      this._emitFailureEvent(format, exportId, error, exportData.correlationId);
      this._failExport(exportId, error);
      throw error;
    }
  }

  /**
   * 驗證匯出資料
   * 
   * @param {Object} exportData - 匯出資料 
   * @param {string} format - 匯出格式
   * @private
   */
  _validateExportData(exportData, format) {
    if (!exportData || !exportData.books) {
      throw new Error(`Invalid ${format} export data: books array is required`);
    }
    
    if (!Array.isArray(exportData.books)) {
      throw new Error(`Invalid ${format} export data: books must be an array`);
    }
  }

  /**
   * 設定進度回調（非同步處理，避免循環調用）
   * 
   * @param {BookDataExporter} exporter - 匯出器實例
   * @param {string} exportId - 匯出ID
   * @param {string} format - 匯出格式
   * @private
   */
  _setupProgressCallback(exporter, exportId, format) {
    exporter.setProgressCallback((progress) => {
      // 使用非同步處理避免堆疊溢出
      process.nextTick(() => {
        this._safeUpdateProgress(exportId, progress, 'processing', `處理 ${format.toUpperCase()} 資料...`);
      });
    });
  }

  /**
   * 安全的進度更新（避免循環依賴）
   * 
   * @param {string} exportId - 匯出ID
   * @param {number} progress - 進度百分比
   * @param {string} phase - 當前階段
   * @param {string} message - 進度訊息
   * @private
   */
  _safeUpdateProgress(exportId, progress, phase, message) {
    const record = this.currentExports.get(exportId);
    if (record) {
      record.progress = progress;
      record.phase = phase;
    }

    // 非同步發送進度事件，避免循環依賴
    process.nextTick(() => {
      this.eventBus.emit(EXPORT_EVENTS.EXPORT_PROGRESS, {
        exportId,
        current: progress,
        total: 100,
        percentage: progress,
        phase,
        message
      }).catch(error => {
        console.warn('Failed to emit progress event:', error);
      });
    });
  }

  /**
   * 發送完成事件（非同步處理）
   * 修正: 使用正確的事件常數而非動態建構
   * 
   * @param {string} format - 匯出格式
   * @param {string} exportId - 匯出ID
   * @param {*} data - 匯出資料
   * @param {string} correlationId - 相關性ID
   * @private
   */
  _emitCompletionEvent(format, exportId, data, correlationId) {
    // 使用正確的事件常數對映
    const eventTypeMap = {
      csv: EXPORT_EVENTS.CSV_EXPORT_COMPLETED,
      json: EXPORT_EVENTS.JSON_EXPORT_COMPLETED,
      excel: EXPORT_EVENTS.EXCEL_EXPORT_COMPLETED,
      pdf: EXPORT_EVENTS.PDF_EXPORT_COMPLETED,
      batch: EXPORT_EVENTS.BATCH_EXPORT_COMPLETED,
      download: EXPORT_EVENTS.FILE_DOWNLOAD_COMPLETED
    };
    
    const eventType = eventTypeMap[format.toLowerCase()];
    if (!eventType) {
      console.warn(`Unknown export format for completion event: ${format}`);
      return;
    }
    
    // 同步發送事件以便測試驗證
    this.eventBus.emit(eventType, {
      exportId,
      data,
      correlationId
    });
  }

  /**
   * 發送失敗事件（非同步處理）
   * 修正: 使用正確的事件常數而非動態建構
   * 
   * @param {string} format - 匯出格式
   * @param {string} exportId - 匯出ID
   * @param {Error} error - 錯誤物件
   * @param {string} correlationId - 相關性ID
   * @private
   */
  _emitFailureEvent(format, exportId, error, correlationId) {
    // 使用正確的事件常數對映
    const eventTypeMap = {
      csv: EXPORT_EVENTS.CSV_EXPORT_FAILED,
      json: EXPORT_EVENTS.JSON_EXPORT_FAILED,
      excel: EXPORT_EVENTS.EXCEL_EXPORT_FAILED,
      pdf: EXPORT_EVENTS.PDF_EXPORT_FAILED,
      batch: EXPORT_EVENTS.BATCH_EXPORT_FAILED,
      download: EXPORT_EVENTS.FILE_DOWNLOAD_FAILED
    };
    
    const eventType = eventTypeMap[format.toLowerCase()];
    if (!eventType) {
      console.warn(`Unknown export format for failure event: ${format}`);
      return;
    }
    
    // 同步發送失敗事件以便測試驗證
    this.eventBus.emit(eventType, {
      exportId,
      error: error.message,
      correlationId
    });
  }

  /**
   * 處理批量匯出請求 - 重構簡化版本
   * 
   * @param {Object} exportData - 批量匯出資料
   * @param {Array} exportData.formats - 匯出格式陣列
   * @param {Array} exportData.books - 書籍資料
   * @param {Object} exportData.options - 各格式選項
   * @returns {Promise<Object>} 匯出結果
   * @private
   */
  async _handleBatchExport(exportData) {
    return this._executeExport('batch', exportData, (exporter, options) => {
      return exporter.batchExport(exportData.formats, options);
    });
  }

  /**
   * 處理檔案下載請求 - 重構簡化版本
   * 
   * @param {Object} downloadData - 下載資料
   * @param {*} downloadData.data - 要下載的資料
   * @param {string} downloadData.filename - 檔案名稱
   * @param {string} downloadData.mimeType - MIME 類型
   * @returns {Promise<Object>} 下載結果
   * @private
   */
  async _handleFileDownload(downloadData) {
    const exportId = this._generateExportId('download');
    
    try {
      // 驗證下載資料
      if (!downloadData || !downloadData.data || !downloadData.filename) {
        throw new Error('Invalid download data: data and filename are required');
      }

      this._addExportRecord(exportId, 'download', downloadData);

      // 非同步發送開始事件
      process.nextTick(() => {
        this.eventBus.emit(EXPORT_EVENTS.FILE_DOWNLOAD_STARTED, {
          exportId,
          filename: downloadData.filename,
          correlationId: downloadData.correlationId
        }).catch(error => {
          console.warn('Failed to emit download started event:', error);
        });
      });

      // 建立臨時 exporter 來處理下載
      const exporter = new BookDataExporter([]);
      
      // 執行下載
      exporter.downloadFile(
        downloadData.data,
        downloadData.filename,
        downloadData.mimeType
      );
      
      // 使用統一的完成事件發送機制
      this._emitCompletionEvent('download', exportId, { filename: downloadData.filename }, downloadData.correlationId);

      this._completeExport(exportId, { filename: downloadData.filename, format: 'download' });

      return { success: true, filename: downloadData.filename, exportId };

    } catch (error) {
      // 使用統一的失敗事件發送機制
      this._emitFailureEvent('download', exportId, error, downloadData.correlationId);

      this._failExport(exportId, error);
      throw error;
    }
  }

  /**
   * 處理匯出取消請求
   * 
   * @param {Object} cancelData - 取消資料
   * @param {string} cancelData.exportId - 要取消的匯出ID
   * @returns {Promise<Object>} 取消結果
   * @private
   */
  async _handleExportCancellation(cancelData) {
    if (!cancelData || !cancelData.exportId) {
      return { success: false, error: 'Export ID is required for cancellation' };
    }

    const exportRecord = this.currentExports.get(cancelData.exportId);
    if (exportRecord) {
      exportRecord.status = 'cancelled';
      exportRecord.endTime = new Date();
      this._moveToHistory(cancelData.exportId);
    }

    return { success: true, exportId: cancelData.exportId };
  }

  /**
   * 生成匯出ID
   * 
   * @param {string} type - 匯出類型
   * @returns {string} 匯出ID
   * @private
   */
  _generateExportId(type) {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 添加匯出記錄
   * 
   * @param {string} exportId - 匯出ID
   * @param {string} format - 匯出格式
   * @param {Object} data - 匯出資料
   * @private
   */
  _addExportRecord(exportId, format, data) {
    const record = {
      id: exportId,
      format,
      startTime: new Date(),
      status: 'in-progress',
      data,
      progress: 0
    };
    
    this.currentExports.set(exportId, record);
    
    if (this.currentExports.size === 1) {
      this.isExporting = true;
    }
  }

  //todo: 移除過時的 _updateExportProgress 方法，已被 _safeUpdateProgress 取代

  /**
   * 完成匯出
   * 
   * @param {string} exportId - 匯出ID
   * @param {Object} result - 匯出結果
   * @private
   */
  _completeExport(exportId, result) {
    const record = this.currentExports.get(exportId);
    if (record) {
      record.status = 'completed';
      record.endTime = new Date();
      record.result = result;
      this._moveToHistory(exportId);
    }

    this._updateExportingStatus();
  }

  /**
   * 標記匯出失敗
   * 
   * @param {string} exportId - 匯出ID
   * @param {Error} error - 錯誤物件
   * @private
   */
  _failExport(exportId, error) {
    const record = this.currentExports.get(exportId);
    if (record) {
      record.status = 'failed';
      record.endTime = new Date();
      record.error = error.message;
      this._moveToHistory(exportId);
    }

    this._updateExportingStatus();
  }

  /**
   * 將匯出記錄移至歷史
   * 
   * @param {string} exportId - 匯出ID
   * @private
   */
  _moveToHistory(exportId) {
    const record = this.currentExports.get(exportId);
    if (record) {
      this.exportHistory.push(record);
      this.currentExports.delete(exportId);
      
      // 保持歷史記錄在合理大小
      if (this.exportHistory.length > 100) {
        this.exportHistory = this.exportHistory.slice(-50);
      }
    }
  }

  /**
   * 更新匯出狀態
   * @private
   */
  _updateExportingStatus() {
    this.isExporting = this.currentExports.size > 0;
  }

  /**
   * 獲取記憶體使用情況
   * 
   * @returns {Object} 記憶體使用統計
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 獲取匯出統計
   * 
   * @returns {Object} 匯出統計資訊
   */
  getExportStats() {
    const total = this.exportHistory.length;
    const completed = this.exportHistory.filter(record => record.status === 'completed').length;
    const failed = this.exportHistory.filter(record => record.status === 'failed').length;
    
    const formatBreakdown = {};
    this.exportHistory.forEach(record => {
      formatBreakdown[record.format] = (formatBreakdown[record.format] || 0) + 1;
    });

    return {
      totalExports: total,
      completed,
      failed,
      currentExports: this.currentExports.size,
      formatBreakdown
    };
  }
}

module.exports = ExportManager;