/**
 * 儲存載入事件處理器
 * 基於 EventHandler 實現統一的資料載入處理
 *
 * 負責功能：
 * - 處理 STORAGE.LOAD.REQUESTED 事件
 * - 驗證載入請求的參數和條件
 * - 調用儲存適配器執行實際載入操作
 * - 處理載入結果的驗證和過濾
 * - 觸發載入完成或錯誤事件
 * - 記錄載入操作的統計資訊
 *
 * 設計考量：
 * - 繼承 EventHandler 提供標準化的事件處理流程
 * - 支援多種載入類型 (all, recent, filtered)
 * - 支援多種儲存適配器 (Chrome Storage, LocalStorage, IndexedDB)
 * - 實現完整的錯誤處理和恢復機制
 * - 提供詳細的載入統計和監控資訊
 *
 * 處理流程：
 * 1. 接收 STORAGE.LOAD.REQUESTED 事件
 * 2. 驗證載入請求的必要參數和格式
 * 3. 檢查儲存適配器的可用性
 * 4. 調用適配器執行載入操作
 * 5. 驗證載入結果的完整性
 * 6. 觸發 STORAGE.LOAD.COMPLETED 或 STORAGE.ERROR 事件
 * 7. 更新載入統計和效能監控
 *
 * 使用情境：
 * - 處理從UI或其他模組發起的資料載入請求
 * - 實現資料的快取和預載入機制
 * - 支援不同載入策略的統一管理
 */

const EventHandler = require('src/core/event-handler')
const { StandardError } = require('src/core/errors/StandardError')

class StorageLoadHandler extends EventHandler {
  /**
   * 建構載入事件處理器
   *
   * @param {Object} eventBus - 事件總線實例
   * @param {Object} storageAdapter - 儲存適配器實例
   *
   * 負責功能：
   * - 初始化事件處理器基本配置
   * - 設定儲存適配器和事件總線引用
   * - 配置處理器優先級 (載入操作需要較高優先級)
   * - 初始化載入類型和統計系統
   */
  constructor (eventBus, storageAdapter) {
    super('StorageLoadHandler', 1) // 載入操作優先級設為1 (較高)

    this.eventBus = eventBus
    this.storageAdapter = storageAdapter

    // 載入操作統計
    this.loadCount = 0
    this.totalLoadedSize = 0
    this.lastLoadResult = null

    // 錯誤類型常數
    this.ERROR_TYPES = {
      INVALID_REQUEST: 'INVALID_REQUEST',
      INVALID_LOAD_TYPE: 'INVALID_LOAD_TYPE',
      ADAPTER_UNAVAILABLE: 'ADAPTER_UNAVAILABLE',
      LOAD_FAILED: 'LOAD_FAILED',
      INVALID_RESULT: 'INVALID_RESULT'
    }

    // 支援的載入類型
    this.LOAD_TYPES = {
      ALL: 'all', // 載入所有資料
      RECENT: 'recent', // 載入最近的資料
      FILTERED: 'filtered' // 載入過濾後的資料
    }

    // 載入配置常數
    this.CONFIG = {
      HANDLER_VERSION: '1.0.0',
      DEFAULT_RECORD_COUNT: 0,
      MIN_SOURCE_LENGTH: 1
    }

    // 載入類型統計 - 重構：在LOAD_TYPES定義後初始化
    this.loadTypeStats = this.initializeLoadTypeStats()

    // 錯誤處理保險：避免同一 flowId 重複發送錯誤或造成 worker 重試風暴
    // key: flowId, value: 錯誤次數
    this._errorFlows = new Map()
  }

  /**
   * 初始化載入類型統計
   *
   * @returns {Object} 載入類型統計物件
   *
   * 負責功能：
   * - 動態初始化所有支援的載入類型統計
   * - 確保統計物件與支援的載入類型同步
   */
  initializeLoadTypeStats () {
    const stats = {}
    Object.values(this.LOAD_TYPES).forEach(type => {
      stats[type] = 0
    })
    return stats
  }

  /**
   * 取得支援的事件類型
   *
   * @returns {Array<string>} 支援的事件類型列表
   *
   * 負責功能：
   * - 定義此處理器能處理的事件類型
   * - 用於事件總線的處理器註冊和路由
   */
  getSupportedEvents () {
    return ['STORAGE.LOAD.REQUESTED']
  }

  /**
   * 處理載入請求事件的核心邏輯
   *
   * @param {Object} event - 載入請求事件
   * @param {string} event.type - 事件類型 (STORAGE.LOAD.REQUESTED)
   * @param {Object} event.data - 載入請求資料
   * @param {string} event.data.source - 資料來源 (如: readmoo)
   * @param {string} event.data.loadType - 載入類型 (all, recent, filtered)
   * @param {Object} [event.data.filter] - 過濾條件 (可選)
   * @param {string} event.flowId - 流程追蹤ID
   * @param {number} event.timestamp - 事件時間戳
   * @returns {Promise<Object>} 處理結果
   *
   * 負責功能：
   * - 驗證載入請求的完整性
   * - 檢查儲存適配器可用性
   * - 執行實際的載入操作
   * - 處理載入成功和失敗情況
   *
   * 設計考量：
   * - 完整的請求驗證確保載入品質
   * - 詳細的錯誤處理提供問題診斷資訊
   * - 統計資訊收集用於效能監控
   */
  async process (event) {
    const { data, flowId, timestamp } = event

    try {
      // 1. 前置驗證
      this.performPreValidation(event, data)

      // 2. 準備和執行載入
      const loadQuery = this.prepareLoadQuery(data, timestamp)
      const loadResult = await this.executeLoad(loadQuery)

      // 3. 後處理（必須等待以確保錯誤在同一 try/catch 中被捕捉）
      await this.performPostProcessing(data.loadType, loadResult, flowId)

      return this.buildSuccessResponse(flowId, loadResult)
    } catch (error) {
      // 統一錯誤處理：只對同一 flowId 送出一次 STORAGE.ERROR，避免 jest-worker 過度重試
      const currentCount = this._errorFlows.get(flowId) || 0
      if (currentCount === 0) {
        await this.handleProcessError(flowId, error)
      }
      this._errorFlows.set(flowId, currentCount + 1)
      // 回傳拒絕以符合測試期望（reject once），由上層捕捉
      return Promise.reject(error)
    }
  }

  /**
   * 執行前置驗證
   *
   * @param {Object} event - 事件物件
   * @param {Object} data - 載入請求資料
   *
   * 負責功能：
   * - 統一執行所有前置驗證步驟
   * - 簡化主要處理流程
   */
  performPreValidation (event, data) {
    this.validateEvent(event)
    this.validateLoadRequest(data)
    this.checkStorageAvailability()
  }

  /**
   * 執行後處理
   *
   * @param {string} loadType - 載入類型
   * @param {Object} loadResult - 載入結果
   * @param {string} flowId - 流程追蹤ID
   *
   * 負責功能：
   * - 統一執行所有後處理步驟
   * - 確保處理順序的一致性
   */
  async performPostProcessing (loadType, loadResult, flowId) {
    this.validateLoadResult(loadResult)
    this.updateLoadStats(loadType, loadResult)
    await this.emitLoadCompleted(flowId, loadResult)
    this.recordSuccessResult(loadResult)
  }

  /**
   * 驗證事件基本結構
   *
   * @param {Object} event - 事件物件
   * @throws {Error} 事件結構無效時拋出錯誤
   *
   * 負責功能：
   * - 檢查事件的基本必要欄位
   * - 驗證事件的整體結構
   */
  validateEvent (event) {
    if (!this.isValidObject(event)) {
      throw this.createError(
        this.ERROR_TYPES.INVALID_REQUEST,
        'Event must be a valid object'
      )
    }

    if (!event.flowId) {
      throw this.createError(
        this.ERROR_TYPES.INVALID_REQUEST,
        'Event must have a flowId'
      )
    }
  }

  /**
   * 驗證載入請求的完整性和有效性
   *
   * @param {Object} data - 要驗證的載入請求資料
   * @throws {Error} 載入請求驗證失敗時拋出錯誤
   *
   * 負責功能：
   * - 檢查必要欄位的存在性
   * - 驗證載入類型的有效性
   * - 確保請求參數的基本品質要求
   */
  validateLoadRequest (data) {
    if (!this.isValidObject(data)) {
      throw this.createError(
        this.ERROR_TYPES.INVALID_REQUEST,
        'Load request data must be a valid object'
      )
    }

    this.validateSource(data.source)
    this.validateLoadTypeField(data.loadType)
  }

  /**
   * 驗證資料來源
   *
   * @param {string} source - 資料來源
   * @throws {Error} 資料來源無效時拋出錯誤
   *
   * 負責功能：
   * - 檢查來源是否為有效字串
   * - 確保來源不為空
   */
  validateSource (source) {
    if (!source || typeof source !== 'string' || source.length < this.CONFIG.MIN_SOURCE_LENGTH) {
      throw this.createError(
        this.ERROR_TYPES.INVALID_REQUEST,
        'Source must be a non-empty string'
      )
    }
  }

  /**
   * 驗證載入類型欄位
   *
   * @param {string} loadType - 載入類型
   * @throws {Error} 載入類型無效時拋出錯誤
   *
   * 負責功能：
   * - 檢查載入類型欄位的存在性
   * - 委託給詳細的載入類型驗證
   */
  validateLoadTypeField (loadType) {
    if (!loadType) {
      throw this.createError(
        this.ERROR_TYPES.INVALID_REQUEST,
        'LoadType is required'
      )
    }

    this.validateLoadType(loadType)
  }

  /**
   * 驗證載入類型的有效性
   *
   * @param {string} loadType - 載入類型
   * @throws {Error} 載入類型無效時拋出錯誤
   *
   * 負責功能：
   * - 檢查載入類型是否在支援列表中
   * - 確保載入類型的格式正確性
   */
  validateLoadType (loadType) {
    const validTypes = this.getValidLoadTypes()

    if (!validTypes.includes(loadType)) {
      throw this.createError(
        this.ERROR_TYPES.INVALID_LOAD_TYPE,
        `Invalid load type: ${loadType}. Valid types: ${validTypes.join(', ')}`
      )
    }
  }

  /**
   * 取得有效的載入類型列表
   *
   * @returns {Array<string>} 有效載入類型列表
   *
   * 負責功能：
   * - 提供載入類型的集中管理
   * - 確保類型列表的一致性
   */
  getValidLoadTypes () {
    return Object.values(this.LOAD_TYPES)
  }

  /**
   * 檢查儲存適配器的可用性
   *
   * @throws {Error} 適配器不可用時拋出錯誤
   *
   * 負責功能：
   * - 確認儲存適配器已正確初始化
   * - 檢查適配器的運行狀態
   * - 驗證適配器的載入功能可用性
   */
  checkStorageAvailability () {
    this.checkAdapterInitialization()
    this.checkAdapterAvailability()
    this.checkAdapterLoadMethod()
  }

  /**
   * 檢查適配器初始化
   *
   * @throws {Error} 適配器未初始化時拋出錯誤
   *
   * 負責功能：
   * - 確認適配器物件存在
   */
  checkAdapterInitialization () {
    if (!this.storageAdapter) {
      throw this.createError(
        this.ERROR_TYPES.ADAPTER_UNAVAILABLE,
        'Adapter not initialized'
      )
    }
  }

  /**
   * 檢查適配器可用性
   *
   * @throws {Error} 適配器不可用時拋出錯誤
   *
   * 負責功能：
   * - 確認適配器報告為可用狀態
   */
  checkAdapterAvailability () {
    if (!this.storageAdapter.isAvailable()) {
      throw this.createError(
        this.ERROR_TYPES.ADAPTER_UNAVAILABLE,
        'Adapter reports unavailable'
      )
    }
  }

  /**
   * 檢查適配器載入方法
   *
   * @throws {Error} 載入方法不存在時拋出錯誤
   *
   * 負責功能：
   * - 確認適配器具有載入功能
   */
  checkAdapterLoadMethod () {
    if (typeof this.storageAdapter.load !== 'function') {
      throw this.createError(
        this.ERROR_TYPES.ADAPTER_UNAVAILABLE,
        'Load method not implemented'
      )
    }
  }

  /**
   * 準備載入查詢參數
   *
   * @param {Object} data - 原始載入請求資料
   * @param {number} timestamp - 事件時間戳
   * @returns {Object} 準備好的載入查詢
   *
   * 負責功能：
   * - 補充必要的查詢參數
   * - 格式化查詢結構
   * - 添加時間戳和版本資訊
   */
  prepareLoadQuery (data, timestamp) {
    const now = Date.now()

    return {
      source: data.source,
      loadType: data.loadType,
      filter: data.filter || null,
      requestedAt: new Date().toISOString(),
      requestTimestamp: timestamp || now,
      handlerVersion: this.CONFIG.HANDLER_VERSION,
      adapterName: this.getAdapterName()
    }
  }

  /**
   * 執行載入操作
   *
   * @param {Object} loadQuery - 準備好的載入查詢
   * @returns {Promise<Object>} 載入結果
   *
   * 負責功能：
   * - 調用儲存適配器執行實際載入
   * - 處理載入過程中的異常
   */
  async executeLoad (loadQuery) {
    try {
      return await this.storageAdapter.load(loadQuery)
    } catch (error) {
      throw this.createError(
        this.ERROR_TYPES.LOAD_FAILED,
        error.message,
        error
      )
    }
  }

  /**
   * 驗證載入結果的完整性
   *
   * @param {Object} loadResult - 載入結果
   * @throws {Error} 載入結果無效時拋出錯誤
   *
   * 負責功能：
   * - 檢查載入結果的基本結構
   * - 驗證必要欄位的存在性
   * - 確保結果資料的品質
   */
  validateLoadResult (loadResult) {
    if (!this.isValidObject(loadResult)) {
      throw this.createError(
        this.ERROR_TYPES.INVALID_RESULT,
        'Load result must be a valid object'
      )
    }

    this.checkLoadResultSuccess(loadResult)
    this.checkLoadResultData(loadResult)
  }

  /**
   * 檢查載入結果成功狀態
   *
   * @param {Object} loadResult - 載入結果
   * @throws {Error} 載入失敗時拋出錯誤
   *
   * 負責功能：
   * - 處理載入失敗的情況
   * - 提取失敗原因
   */
  checkLoadResultSuccess (loadResult) {
    if (loadResult.success === false) {
      throw this.createError(
        this.ERROR_TYPES.LOAD_FAILED,
        loadResult.error || 'Operation failed without specific error message'
      )
    }
  }

  /**
   * 檢查載入結果資料
   *
   * @param {Object} loadResult - 載入結果
   * @throws {Error} 資料欄位無效時拋出錯誤
   *
   * 負責功能：
   * - 確認結果包含必要的資料欄位
   */
  checkLoadResultData (loadResult) {
    if (!loadResult.data) {
      throw this.createError(
        this.ERROR_TYPES.INVALID_RESULT,
        'Load result must contain data field'
      )
    }
  }

  /**
   * 更新載入操作統計資訊
   *
   * @param {string} loadType - 載入類型
   * @param {Object} loadResult - 載入操作結果
   *
   * 負責功能：
   * - 累計載入操作次數
   * - 統計不同載入類型的使用次數
   * - 統計總載入資料大小
   * - 更新效能指標
   */
  updateLoadStats (loadType, loadResult) {
    this.incrementTotalLoadCount()
    this.updateLoadTypeCount(loadType)
    this.updateTotalLoadedSize(loadResult)
  }

  /**
   * 增加總載入次數
   *
   * 負責功能：
   * - 累計總載入操作次數
   */
  incrementTotalLoadCount () {
    this.loadCount++
  }

  /**
   * 更新載入類型統計
   *
   * @param {string} loadType - 載入類型
   *
   * 負責功能：
   * - 安全地更新載入類型統計
   * - 避免未知類型造成的錯誤
   */
  updateLoadTypeCount (loadType) {
    if (this.loadTypeStats.hasOwnProperty(loadType)) {
      this.loadTypeStats[loadType]++
    }
  }

  /**
   * 更新總載入大小
   *
   * @param {Object} loadResult - 載入結果
   *
   * 負責功能：
   * - 安全地累計載入資料大小
   * - 處理無效的大小數值
   */
  updateTotalLoadedSize (loadResult) {
    if (this.isValidSize(loadResult?.size)) {
      this.totalLoadedSize += loadResult.size
    }
  }

  /**
   * 驗證大小數值是否有效
   *
   * @param {*} size - 要驗證的大小數值
   * @returns {boolean} 大小數值是否有效
   *
   * 負責功能：
   * - 檢查大小數值的類型和有效性
   */
  isValidSize (size) {
    return size && typeof size === 'number' && size > 0
  }

  /**
   * 觸發載入完成事件
   *
   * @param {string} flowId - 流程追蹤ID
   * @param {Object} loadResult - 載入結果
   *
   * 負責功能：
   * - 構建載入完成事件資料
   * - 通過事件總線發送完成通知
   * - 提供詳細的操作結果資訊
   */
  async emitLoadCompleted (flowId, loadResult) {
    if (!this.hasEventBus()) return

    await this.eventBus.emit('STORAGE.LOAD.COMPLETED', {
      flowId,
      success: true,
      data: loadResult.data,
      metadata: this.buildLoadMetadata(loadResult),
      timestamp: Date.now(),
      handlerName: this.name
    })
  }

  /**
   * 建構載入元數據
   *
   * @param {Object} loadResult - 載入結果
   * @returns {Object} 載入元數據
   *
   * 負責功能：
   * - 統一建構載入完成事件的元數據
   * - 提供一致的元數據格式
   */
  buildLoadMetadata (loadResult) {
    return {
      loadedAt: loadResult.loadedAt,
      size: loadResult.size || 0,
      recordCount: this.getRecordCount(loadResult.data)
    }
  }

  /**
   * 統一的錯誤處理
   *
   * @param {string} flowId - 流程追蹤ID
   * @param {Error} error - 錯誤物件
   *
   * 負責功能：
   * - 記錄詳細的錯誤資訊
   * - 觸發載入錯誤事件
   * - 統一錯誤記錄格式
   */
  async handleProcessError (flowId, error) {
    // 記錄錯誤結果
    this.recordErrorResult(error)

    // 觸發錯誤事件
    await this.emitLoadError(flowId, error)
  }

  /**
   * 觸發載入錯誤事件
   *
   * @param {string} flowId - 流程追蹤ID
   * @param {Error} error - 錯誤物件
   *
   * 負責功能：
   * - 構建錯誤事件資料
   * - 通過事件總線發送錯誤通知
   */
  async emitLoadError (flowId, error) {
    if (!this.hasEventBus()) return

    await this.eventBus.emit('STORAGE.ERROR', {
      flowId,
      error: error.message,
      errorType: error.type || error.constructor.name,
      timestamp: Date.now(),
      handlerName: this.name,
      adapterName: this.getAdapterName()
    })
  }

  /**
   * 記錄成功結果
   *
   * @param {Object} loadResult - 載入結果
   *
   * 負責功能：
   * - 統一記錄成功操作的結果
   * - 提供後續查詢和統計使用
   */
  recordSuccessResult (loadResult) {
    this.lastLoadResult = {
      success: true,
      timestamp: Date.now(),
      result: loadResult
    }
  }

  /**
   * 記錄錯誤結果
   *
   * @param {Error} error - 錯誤物件
   *
   * 負責功能：
   * - 統一記錄錯誤操作的結果
   * - 提供後續問題診斷使用
   */
  recordErrorResult (error) {
    this.lastLoadResult = {
      success: false,
      timestamp: Date.now(),
      error: error.message,
      errorType: error.type
    }
  }

  /**
   * 建構成功回應
   *
   * @param {string} flowId - 流程追蹤ID
   * @param {Object} loadResult - 載入結果
   * @returns {Object} 格式化的成功回應
   *
   * 負責功能：
   * - 統一成功回應的格式
   * - 提供一致的API介面
   */
  buildSuccessResponse (flowId, loadResult) {
    return {
      success: true,
      flowId,
      data: loadResult.data,
      loadedAt: loadResult.loadedAt,
      size: loadResult.size || 0,
      recordCount: this.getRecordCount(loadResult.data)
    }
  }

  /**
   * 計算記錄數量
   *
   * @param {Object} data - 載入的資料
   * @returns {number} 記錄數量
   *
   * 負責功能：
   * - 安全地計算載入資料的記錄數量
   * - 處理不同資料結構的記錄計數
   */
  getRecordCount (data) {
    if (!data) return this.CONFIG.DEFAULT_RECORD_COUNT

    // 優先檢查 books 陣列
    if (this.isValidBooksArray(data.books)) {
      return data.books.length
    }

    // 備用檢查 metadata 中的總數
    if (this.isValidTotalCount(data.metadata?.totalCount)) {
      return data.metadata.totalCount
    }

    return this.CONFIG.DEFAULT_RECORD_COUNT
  }

  /**
   * 檢查是否為有效的書籍陣列
   *
   * @param {*} books - 要檢查的書籍資料
   * @returns {boolean} 是否為有效的書籍陣列
   *
   * 負責功能：
   * - 驗證書籍資料的類型和結構
   */
  isValidBooksArray (books) {
    return books && Array.isArray(books)
  }

  /**
   * 檢查是否為有效的總數
   *
   * @param {*} totalCount - 要檢查的總數
   * @returns {boolean} 是否為有效的總數
   *
   * 負責功能：
   * - 驗證總數的類型和合理性
   */
  isValidTotalCount (totalCount) {
    return typeof totalCount === 'number' && totalCount >= 0
  }

  /**
   * 檢查是否為有效物件
   *
   * @param {*} obj - 要檢查的物件
   * @returns {boolean} 是否為有效物件
   *
   * 負責功能：
   * - 統一的物件有效性檢查
   * - 避免重複的驗證邏輯
   */
  isValidObject (obj) {
    return obj && typeof obj === 'object'
  }

  /**
   * 創建帶類型的錯誤物件
   *
   * @param {string} type - 錯誤類型
   * @param {string} message - 錯誤訊息
   * @param {Error} originalError - 原始錯誤 (可選)
   * @returns {Error} 增強的錯誤物件
   *
   * 負責功能：
   * - 統一錯誤物件的創建
   * - 添加錯誤類型資訊
   * - 保留原始錯誤的堆疊追蹤
   */
  createError (type, message, originalError) {
    const prefix = this.getErrorPrefix(type)
    const error = new StandardError('UNKNOWN_ERROR', `${prefix}: ${message}`, {
      category: 'storage'
    })
    error.type = type
    if (originalError) {
      error.originalError = originalError
    }
    return error
  }

  /**
   * 取得錯誤前綴
   *
   * @param {string} type - 錯誤類型
   * @returns {string} 錯誤前綴
   *
   * 負責功能：
   * - 根據錯誤類型提供適當的前綴
   * - 集中管理錯誤訊息格式
   */
  getErrorPrefix (type) {
    const prefixMap = {
      [this.ERROR_TYPES.INVALID_REQUEST]: 'Invalid load request',
      [this.ERROR_TYPES.INVALID_LOAD_TYPE]: 'Invalid load type',
      [this.ERROR_TYPES.ADAPTER_UNAVAILABLE]: 'Storage adapter not available',
      [this.ERROR_TYPES.LOAD_FAILED]: 'Load operation failed',
      [this.ERROR_TYPES.INVALID_RESULT]: 'Invalid load result'
    }

    return prefixMap[type] || 'Load error'
  }

  /**
   * 檢查是否有事件總線
   *
   * @returns {boolean} 事件總線可用性
   *
   * 負責功能：
   * - 統一檢查事件總線的可用性
   * - 避免重複的空值檢查
   */
  hasEventBus () {
    return this.eventBus && typeof this.eventBus.emit === 'function'
  }

  /**
   * 取得適配器名稱
   *
   * @returns {string} 適配器名稱
   *
   * 負責功能：
   * - 安全地取得適配器名稱
   * - 提供預設值避免錯誤
   */
  getAdapterName () {
    return this.storageAdapter && typeof this.storageAdapter.getName === 'function'
      ? this.storageAdapter.getName()
      : 'unknown'
  }

  /**
   * 取得處理器的統計資訊
   *
   * @returns {Object} 統計資訊物件
   *
   * 負責功能：
   * - 提供基本的執行統計 (繼承自 EventHandler)
   * - 補充載入特定的統計資訊
   * - 計算效能和容量相關指標
   */
  getStats () {
    const baseStats = super.getStats()

    return {
      ...baseStats,
      loadCount: this.loadCount,
      totalLoadedSize: this.totalLoadedSize,
      averageLoadSize: this.calculateAverageLoadSize(),
      lastLoadResult: this.lastLoadResult,
      loadTypeStats: { ...this.loadTypeStats },
      adapterName: this.getAdapterName()
    }
  }

  /**
   * 計算平均載入大小
   *
   * @returns {number} 平均載入大小
   *
   * 負責功能：
   * - 安全地計算平均載入大小
   * - 避免除零錯誤
   */
  calculateAverageLoadSize () {
    return this.loadCount > 0 ? Math.round(this.totalLoadedSize / this.loadCount) : 0
  }
}

module.exports = StorageLoadHandler
