/**
 * LocalStorageAdapter - localStorage API 適配器
 *
 * 負責功能：
 * - localStorage API 整合和封裝
 * - 儲存操作 (save, load, delete, clear)
 * - 資料序列化和反序列化
 * - 錯誤處理和容錯機制
 * - 容量限制檢測和管理
 * - 效能監控和統計追蹤
 *
 * 設計考量：
 * - 作為 Chrome Storage 的備援方案
 * - 支援跨瀏覽器相容性
 * - 實現統一的儲存適配器介面
 * - 提供資料完整性檢查
 *
 * 處理流程：
 * 1. 初始化和配置
 * 2. 檢查 localStorage API 可用性
 * 3. 執行儲存操作（包含序列化/反序列化）
 * 4. 錯誤處理和統計追蹤
 * 5. 效能監控和資源管理
 *
 * 使用情境：
 * - Chrome Extension 的備援儲存方案
 * - 跨瀏覽器相容性需求
 * - 小到中等規模的資料儲存
 * - 需要即時存取的場景
 *
 * @version 1.0.0
 * @since 2025-08-06
 */

class LocalStorageAdapter {
  /**
   * 建構 LocalStorageAdapter 實例
   *
   * @param {Object} options - 配置選項
   *
   * 負責功能：
   * - 初始化適配器基本配置
   * - 設定錯誤類型和常數定義
   * - 初始化統計和效能監控
   * - 準備資料序列化工具
   */
  constructor (options = {}) {
    this.type = 'localStorage'
    this.name = 'LocalStorageAdapter'

    // 初始化常數定義
    this.initializeConstants()

    // 配置初始化
    this.config = this.initializeConfig(options)

    // 統計初始化
    this.stats = this.initializeStats()
    this.errorStats = this.initializeErrorStats()
    this.performanceMetrics = this.initializePerformanceMetrics()
  }

  /**
   * 初始化常數定義
   *
   * 負責功能：
   * - 定義錯誤類型常數
   * - 設定特殊值標記
   * - 統一常數管理
   */
  initializeConstants () {
    this.ERROR_TYPES = {
      API_UNAVAILABLE: 'API_UNAVAILABLE',
      SAVE_ERROR: 'SAVE_ERROR',
      LOAD_ERROR: 'LOAD_ERROR',
      DELETE_ERROR: 'DELETE_ERROR',
      CLEAR_ERROR: 'CLEAR_ERROR',
      SERIALIZATION_ERROR: 'SERIALIZATION_ERROR',
      PARSE_ERROR: 'PARSE_ERROR',
      QUOTA_EXCEEDED: 'QUOTA_EXCEEDED'
    }

    // 特殊值標記
    this.SPECIAL_VALUES = {
      UNDEFINED_MARKER: 'undefined'
    }

    // 測試用鍵值
    this.TEST_KEY = '__localStorage_test__'
  }

  /**
   * 初始化配置參數
   *
   * @param {Object} options - 使用者提供的配置
   * @returns {Object} 合併後的配置物件
   *
   * 負責功能：
   * - 設定預設配置值
   * - 合併使用者自訂配置
   * - 驗證配置參數有效性
   */
  initializeConfig (options) {
    return {
      prefix: options.prefix || 'book_extractor_',
      maxValueSize: options.maxValueSize || 1024 * 1024, // 1MB
      enableCompression: options.enableCompression || false,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 100,
      ...options
    }
  }

  /**
   * 初始化操作統計
   *
   * @returns {Object} 統計物件結構
   *
   * 負責功能：
   * - 創建各操作類型的統計計數器
   * - 初始化成功/失敗統計
   * - 準備效能測量工具
   */
  initializeStats () {
    return {
      operations: {
        save: { total: 0, success: 0, errors: 0 },
        load: { total: 0, success: 0, errors: 0 },
        delete: { total: 0, success: 0, errors: 0 },
        clear: { total: 0, success: 0, errors: 0 }
      },
      performance: {
        totalOperations: 0,
        averageResponseTime: 0,
        totalResponseTime: 0
      }
    }
  }

  /**
   * 初始化錯誤統計
   *
   * @returns {Object} 錯誤統計物件
   *
   * 負責功能：
   * - 統計各類型錯誤的發生次數
   * - 追蹤最近的錯誤詳情
   * - 提供錯誤趨勢分析基礎
   */
  initializeErrorStats () {
    const errorStats = { total: 0, lastError: null }

    // 為每種錯誤類型初始化計數器
    Object.values(this.ERROR_TYPES).forEach(errorType => {
      errorStats[errorType] = 0
    })

    return errorStats
  }

  /**
   * 初始化效能指標
   *
   * @returns {Object} 效能指標物件
   *
   * 負責功能：
   * - 追蹤操作延遲和吞吐量
   * - 監控資源使用情況
   * - 計算效能統計數據
   */
  initializePerformanceMetrics () {
    return {
      startTimes: new Map(),
      operationHistory: [],
      maxHistoryLength: 100
    }
  }

  /**
   * 序列化資料
   *
   * @param {*} data - 要序列化的資料
   * @returns {string} 序列化後的字串
   * @throws {Error} 序列化失敗時拋出錯誤
   *
   * 負責功能：
   * - 處理特殊值（undefined）
   * - 執行 JSON 序列化
   * - 統一錯誤處理
   */
  serializeData (data) {
    try {
      // 處理 undefined - JSON.stringify 無法正確處理
      if (data === undefined) {
        return this.SPECIAL_VALUES.UNDEFINED_MARKER
      }
      return JSON.stringify(data)
    } catch (serializationError) {
      throw this.createError(this.ERROR_TYPES.SERIALIZATION_ERROR, 'Failed to serialize data', serializationError)
    }
  }

  /**
   * 反序列化資料
   *
   * @param {string} serializedData - 序列化後的字串
   * @returns {*} 反序列化後的資料
   * @throws {Error} 反序列化失敗時拋出錯誤
   *
   * 負責功能：
   * - 處理特殊值標記
   * - 執行 JSON 反序列化
   * - 統一錯誤處理
   */
  deserializeData (serializedData) {
    try {
      // 處理 undefined 標記
      if (serializedData === this.SPECIAL_VALUES.UNDEFINED_MARKER) {
        return undefined
      }
      return JSON.parse(serializedData)
    } catch (parseError) {
      throw this.createError(this.ERROR_TYPES.PARSE_ERROR, 'Failed to parse stored data', parseError)
    }
  }

  /**
   * 檢查 localStorage API 是否可用
   *
   * @returns {boolean} API是否可用
   *
   * 負責功能：
   * - 檢測 localStorage 物件存在性
   * - 測試基本讀寫權限
   * - 處理私人瀏覽模式等限制
   */
  isAvailable () {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) {
        return false
      }

      // 測試基本讀寫功能
      localStorage.setItem(this.TEST_KEY, 'test')
      localStorage.removeItem(this.TEST_KEY)

      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 通用操作包裝器
   *
   * @param {string} operationType - 操作類型
   * @param {Function} operation - 具體操作函數
   * @returns {Promise<Object>} 操作結果
   *
   * 負責功能：
   * - 統一的效能追蹤
   * - 統計更新管理
   * - 錯誤處理標準化
   * - 操作結果格式化
   */
  async executeOperation (operationType, operation) {
    const operationId = this.startPerformanceTracking(operationType)

    try {
      this.stats.operations[operationType].total++

      if (!this.isAvailable()) {
        throw this.createError(this.ERROR_TYPES.API_UNAVAILABLE, 'localStorage is not available')
      }

      const result = await operation()

      // 更新成功統計
      this.stats.operations[operationType].success++
      this.endPerformanceTracking(operationId)

      return {
        success: true,
        ...result,
        timestamp: Date.now()
      }
    } catch (error) {
      this.stats.operations[operationType].errors++
      this.recordError(error)
      this.endPerformanceTracking(operationId)

      return {
        success: false,
        error: error.message,
        errorType: error.type || this.ERROR_TYPES[`${operationType.toUpperCase()}_ERROR`],
        timestamp: Date.now()
      }
    }
  }

  /**
   * 儲存資料
   *
   * @param {string} key - 儲存鍵值
   * @param {*} data - 要儲存的資料
   * @returns {Promise<Object>} 儲存結果
   *
   * 負責功能：
   * - 序列化資料為JSON字串
   * - 執行 localStorage.setItem 操作
   * - 處理配額超出和序列化錯誤
   * - 更新操作統計和效能指標
   */
  async save (key, data) {
    return this.executeOperation('save', async () => {
      // 序列化資料
      const serializedData = this.serializeData(data)

      // 檢查資料大小限制
      if (serializedData.length > this.config.maxValueSize) {
        throw this.createError(this.ERROR_TYPES.QUOTA_EXCEEDED, `Data size (${serializedData.length}) exceeds limit (${this.config.maxValueSize})`)
      }

      // 執行儲存操作
      const storageKey = this.config.prefix + key
      try {
        localStorage.setItem(storageKey, serializedData)
      } catch (storageError) {
        if (storageError.name === 'QuotaExceededError') {
          throw this.createError(this.ERROR_TYPES.QUOTA_EXCEEDED, 'localStorage quota exceeded', storageError)
        }
        throw this.createError(this.ERROR_TYPES.SAVE_ERROR, 'Failed to save to localStorage', storageError)
      }

      return {
        key: storageKey,
        size: serializedData.length
      }
    })
  }

  /**
   * 載入資料
   *
   * @param {string} key - 資料鍵值
   * @returns {Promise<Object>} 載入結果
   *
   * 負責功能：
   * - 從 localStorage 讀取原始資料
   * - 反序列化JSON字串為物件
   * - 處理不存在的鍵值和解析錯誤
   * - 更新操作統計和效能指標
   */
  async load (key) {
    const operationId = this.startPerformanceTracking('load')

    try {
      this.stats.operations.load.total++

      if (!this.isAvailable()) {
        throw this.createError(this.ERROR_TYPES.API_UNAVAILABLE, 'localStorage is not available')
      }

      // 讀取原始資料
      const storageKey = this.config.prefix + key
      const rawData = localStorage.getItem(storageKey)

      if (rawData === null) {
        return {
          success: true,
          data: null,
          found: false,
          timestamp: Date.now()
        }
      }

      // 反序列化資料
      const parsedData = this.deserializeData(rawData)

      // 更新成功統計
      this.stats.operations.load.success++
      this.endPerformanceTracking(operationId)

      return {
        success: true,
        data: parsedData,
        found: true,
        size: rawData.length,
        timestamp: Date.now()
      }
    } catch (error) {
      this.stats.operations.load.errors++
      this.recordError(error)
      this.endPerformanceTracking(operationId)

      return {
        success: false,
        error: error.message,
        errorType: error.type || this.ERROR_TYPES.LOAD_ERROR,
        timestamp: Date.now()
      }
    }
  }

  /**
   * 刪除資料
   *
   * @param {string} key - 要刪除的鍵值
   * @returns {Promise<Object>} 刪除結果
   *
   * 負責功能：
   * - 執行 localStorage.removeItem 操作
   * - 處理不存在的鍵值情況
   * - 更新操作統計和效能指標
   */
  async delete (key) {
    const operationId = this.startPerformanceTracking('delete')

    try {
      this.stats.operations.delete.total++

      if (!this.isAvailable()) {
        throw this.createError(this.ERROR_TYPES.API_UNAVAILABLE, 'localStorage is not available')
      }

      const storageKey = this.config.prefix + key
      localStorage.removeItem(storageKey)

      // 更新成功統計
      this.stats.operations.delete.success++
      this.endPerformanceTracking(operationId)

      return {
        success: true,
        key: storageKey,
        timestamp: Date.now()
      }
    } catch (error) {
      this.stats.operations.delete.errors++
      this.recordError(error)
      this.endPerformanceTracking(operationId)

      return {
        success: false,
        error: error.message,
        errorType: error.type || this.ERROR_TYPES.DELETE_ERROR,
        timestamp: Date.now()
      }
    }
  }

  /**
   * 清空所有資料
   *
   * @returns {Promise<Object>} 清空結果
   *
   * 負責功能：
   * - 清除所有帶前綴的儲存項目
   * - 或執行完整的 localStorage.clear()
   * - 更新操作統計和效能指標
   */
  async clear () {
    const operationId = this.startPerformanceTracking('clear')

    try {
      this.stats.operations.clear.total++

      if (!this.isAvailable()) {
        throw this.createError(this.ERROR_TYPES.API_UNAVAILABLE, 'localStorage is not available')
      }

      let clearedCount = 0

      if (this.config.prefix) {
        // 只清除帶前綴的項目
        const keysToRemove = []

        // 收集所有符合前綴的 key
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith(this.config.prefix)) {
            keysToRemove.push(key)
          }
        }

        // 測試環境的特殊處理
        if (localStorage._storage) {
          Object.keys(localStorage._storage).forEach(key => {
            if (key.startsWith(this.config.prefix) && !keysToRemove.includes(key)) {
              keysToRemove.push(key)
            }
          })
        }

        keysToRemove.forEach(key => {
          localStorage.removeItem(key)
          clearedCount++
        })
      } else {
        // 清空整個 localStorage
        clearedCount = localStorage.length
        localStorage.clear()
      }

      // 更新成功統計
      this.stats.operations.clear.success++
      this.endPerformanceTracking(operationId)

      return {
        success: true,
        clearedCount,
        timestamp: Date.now()
      }
    } catch (error) {
      this.stats.operations.clear.errors++
      this.recordError(error)
      this.endPerformanceTracking(operationId)

      return {
        success: false,
        error: error.message,
        errorType: error.type || this.ERROR_TYPES.CLEAR_ERROR,
        timestamp: Date.now()
      }
    }
  }

  /**
   * 取得儲存容量資訊
   *
   * @returns {Promise<Object>} 容量資訊
   *
   * 負責功能：
   * - 計算已使用的儲存空間
   * - 估算剩餘容量
   * - 提供儲存統計資訊
   */
  async getStorageInfo () {
    try {
      let usedBytes = 0
      let itemCount = 0

      if (this.isAvailable()) {
        // 計算已使用空間
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key) {
            const value = localStorage.getItem(key)
            if (value) {
              usedBytes += key.length + value.length
            }

            // 只計算帶前綴的項目
            if (!this.config.prefix || key.startsWith(this.config.prefix)) {
              itemCount++
            }
          }
        }
      }

      return {
        type: this.type,
        available: this.isAvailable(),
        usedBytes,
        itemCount,
        prefix: this.config.prefix,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        type: this.type,
        available: false,
        usedBytes: 0,
        itemCount: 0,
        error: error.message,
        timestamp: Date.now()
      }
    }
  }

  /**
   * 取得操作統計
   *
   * @returns {Object} 統計資訊物件
   *
   * 負責功能：
   * - 提供詳細的操作統計
   * - 計算效能指標
   * - 回傳錯誤統計資訊
   */
  getStats () {
    return {
      ...this.stats,
      errorStats: { ...this.errorStats },
      timestamp: Date.now()
    }
  }

  /**
   * 取得錯誤統計
   *
   * @returns {Object} 錯誤統計物件
   *
   * 負責功能：
   * - 提供各類型錯誤的統計數據
   * - 包含最近錯誤的詳細資訊
   */
  getErrorStats () {
    return { ...this.errorStats }
  }

  /**
   * 創建格式化的錯誤物件
   *
   * @param {string} type - 錯誤類型
   * @param {string} message - 錯誤訊息
   * @param {Error} [originalError] - 原始錯誤物件
   * @returns {Error} 格式化的錯誤物件
   *
   * 負責功能：
   * - 統一錯誤物件格式
   * - 保留原始錯誤資訊
   * - 添加錯誤類型標識
   */
  createError (type, message, originalError = null) {
    const error = new Error(message)
    error.type = type
    error.originalError = originalError
    error.timestamp = Date.now()
    return error
  }

  /**
   * 記錄錯誤統計
   *
   * @param {Error} error - 錯誤物件
   *
   * 負責功能：
   * - 更新對應類型的錯誤計數
   * - 記錄最近的錯誤詳情
   * - 維護錯誤統計資訊
   */
  recordError (error) {
    const errorType = error.type || 'UNKNOWN_ERROR'

    if (this.errorStats[errorType] !== undefined) {
      this.errorStats[errorType]++
    }

    this.errorStats.total++
    this.errorStats.lastError = {
      type: errorType,
      message: error.message,
      timestamp: error.timestamp || Date.now()
    }
  }

  /**
   * 開始效能追蹤
   *
   * @param {string} operation - 操作類型
   * @returns {string} 操作追蹤ID
   *
   * 負責功能：
   * - 記錄操作開始時間
   * - 生成唯一追蹤ID
   * - 準備效能測量工具
   */
  startPerformanceTracking (operation) {
    const operationId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.performanceMetrics.startTimes.set(operationId, Date.now())
    return operationId
  }

  /**
   * 結束效能追蹤
   *
   * @param {string} operationId - 操作追蹤ID
   *
   * 負責功能：
   * - 計算操作執行時間
   * - 更新平均響應時間
   * - 維護效能歷史記錄
   */
  endPerformanceTracking (operationId) {
    const startTime = this.performanceMetrics.startTimes.get(operationId)
    if (startTime) {
      const duration = Date.now() - startTime

      // 更新效能統計
      this.stats.performance.totalOperations++
      this.stats.performance.totalResponseTime += duration
      this.stats.performance.averageResponseTime =
        this.stats.performance.totalResponseTime / this.stats.performance.totalOperations

      // 清理追蹤資料
      this.performanceMetrics.startTimes.delete(operationId)

      // 記錄歷史（限制長度）
      this.performanceMetrics.operationHistory.push({
        id: operationId,
        duration,
        timestamp: Date.now()
      })

      if (this.performanceMetrics.operationHistory.length > this.performanceMetrics.maxHistoryLength) {
        this.performanceMetrics.operationHistory.shift()
      }
    }
  }
}

module.exports = LocalStorageAdapter
