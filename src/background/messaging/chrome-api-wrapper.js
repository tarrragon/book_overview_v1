/**
 * Chrome API 封裝器
 *
 * 負責功能：
 * - 封裝和統一 Chrome Extension API 的使用
 * - 提供錯誤處理和重試機制
 * - 實現 API 調用的統計和監控
 * - 支援 API 的模擬和測試環境適配
 *
 * 設計考量：
 * - 基於 BaseModule 實現標準生命週期管理
 * - 提供一致的 API 調用介面和錯誤處理
 * - 支援 API 調用的批次處理和優化
 * - 實現 Chrome API 的版本相容性管理
 */

const BaseModule = require('src/background/lifecycle/base-module')
const ErrorCodes = require('src/core/errors/ErrorCodes')

class ChromeApiWrapper extends BaseModule {
  constructor (dependencies = {}) {
    super(dependencies)

    // API 調用統計
    this.apiStats = {
      total: 0,
      success: 0,
      failed: 0,
      byApi: new Map(), // API名稱 -> 調用次數
      byError: new Map(), // 錯誤類型 -> 次數
      avgResponseTime: 0,
      totalResponseTime: 0
    }

    // 支援的 Chrome API
    this.supportedApis = new Set([
      'storage.local',
      'storage.sync',
      'tabs.query',
      'tabs.sendMessage',
      'tabs.create',
      'tabs.update',
      'tabs.remove',
      'runtime.sendMessage',
      'runtime.getManifest',
      'runtime.reload',
      'notifications.create',
      'notifications.clear'
    ])

    // API 重試配置
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000,
      retryableErrors: [
        'Could not establish connection',
        'The message port closed',
        'Extension context invalidated'
      ]
    }

    // 批次操作佇列
    this.batchQueue = new Map() // apiName -> operations[]
    this.batchTimer = null
    this.batchDelay = 50 // 50ms 批次延遲
  }

  /**
   * 初始化 Chrome API 封裝器
   * @returns {Promise<void>}
   * @protected
   */
  async _doInitialize () {
    this.logger.log('初始化 Chrome API 封裝器')

    // 檢查 Chrome API 可用性
    await this.checkChromeApiAvailability()

    // 重置統計
    this.resetStats()

    this.logger.log('[OK] Chrome API 封裝器初始化完成')
  }

  /**
   * 啟動 Chrome API 封裝器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStart () {
    this.logger.log('[START] 啟動 Chrome API 封裝器')

    // 開始批次處理
    this.startBatchProcessing()

    this.logger.log('[OK] Chrome API 封裝器啟動完成')
  }

  /**
   * 停止 Chrome API 封裝器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStop () {
    this.logger.log('[STOP] 停止 Chrome API 封裝器')

    // 停止批次處理
    this.stopBatchProcessing()

    // 處理剩餘的批次操作
    await this.flushBatchQueue()

    this.logger.log('[OK] Chrome API 封裝器停止完成')
  }

  /**
   * 檢查 Chrome API 可用性
   * @returns {Promise<void>}
   * @private
   */
  async checkChromeApiAvailability () {
    const requiredApis = ['storage', 'tabs', 'runtime']
    const missingApis = []

    for (const apiName of requiredApis) {
      if (!chrome[apiName]) {
        missingApis.push(apiName)
      }
    }

    if (missingApis.length > 0) {
      const error = new Error(`缺少必要的 Chrome API: ${missingApis.join(', ')}`)
      error.code = ErrorCodes.CHROME_ERROR
      error.details = {
        category: 'chrome-api',
        missingApis
      }
      throw error
    }

    // 檢查 Manifest V3 支援
    const manifest = chrome.runtime.getManifest()
    if (manifest.manifest_version !== 3) {
      this.logger.warn('[WARN] 非 Manifest V3 環境')
    }

    this.logger.log('[OK] Chrome API 可用性檢查通過')
  }

  /**
   * 通用 Chrome API 調用封裝
   * @param {string} apiPath - API 路徑 (如 'storage.local.get')
   * @param {Array} args - API 參數
   * @param {Object} options - 調用選項
   * @returns {Promise<any>} API 調用結果
   */
  async callChromeApi (apiPath, args = [], options = {}) {
    const startTime = Date.now()

    try {
      this.logger.log(`調用 Chrome API: ${apiPath}`, args)

      // 驗證 API 支援
      if (!this.supportedApis.has(apiPath)) {
        const error = new Error(`不支援的 API: ${apiPath}`)
        error.code = ErrorCodes.CHROME_ERROR
        error.details = {
          category: 'chrome-api',
          apiPath
        }
        throw error
      }

      // 更新統計
      this.updateApiStats(apiPath, 'attempt')

      // 執行 API 調用
      const result = await this.executeApiCall(apiPath, args, options)

      // 更新成功統計
      this.updateApiStats(apiPath, 'success', Date.now() - startTime)

      this.logger.log(`[OK] Chrome API 調用成功: ${apiPath}`)
      return result
    } catch (error) {
      // 更新失敗統計
      this.updateApiStats(apiPath, 'failed')
      this.updateErrorStats(error.message)

      this.logger.error(`[FAIL] Chrome API 調用失敗: ${apiPath}`, error)

      // 檢查是否可以重試
      if (this.shouldRetry(error, options)) {
        return await this.retryApiCall(apiPath, args, options)
      }

      throw error
    }
  }

  /**
   * 執行實際的 API 調用
   * @param {string} apiPath - API 路徑
   * @param {Array} args - API 參數
   * @param {Object} options - 調用選項
   * @returns {Promise<any>}
   * @private
   */
  async executeApiCall (apiPath, args, options) {
    const apiParts = apiPath.split('.')
    let api = chrome

    // 遍歷 API 路徑
    for (const part of apiParts) {
      if (!api[part]) {
        const error = new Error(`API 不存在: ${apiPath}`)
        error.code = ErrorCodes.CHROME_ERROR
        error.details = {
          category: 'chrome-api',
          apiPath
        }
        throw error
      }
      api = api[part]
    }

    // 執行 API 調用
    if (typeof api === 'function') {
      // 處理 Promise 和 callback 模式
      return new Promise((resolve, reject) => {
        try {
          const result = api.apply(chrome, args)

          // 如果返回 Promise
          if (result && typeof result.then === 'function') {
            result.then(resolve).catch(reject)
          } else {
            // callback 模式，檢查 chrome.runtime.lastError
            if (chrome.runtime.lastError) {
              const error = new Error(chrome.runtime.lastError.message)
              error.code = ErrorCodes.CHROME_ERROR
              error.details = {
                category: 'chrome-api',
                source: 'chrome_runtime'
              }
              reject(error)
            } else {
              resolve(result)
            }
          }
        } catch (error) {
          reject(error)
        }
      })
    } else {
      const error = new Error(`${apiPath} 不是一個函數`)
      error.code = ErrorCodes.CHROME_ERROR
      error.details = {
        category: 'chrome-api',
        apiPath,
        expectedType: 'function'
      }
      throw error
    }
  }

  /**
   * 重試 API 調用
   * @param {string} apiPath - API 路徑
   * @param {Array} args - API 參數
   * @param {Object} options - 調用選項
   * @returns {Promise<any>}
   * @private
   */
  async retryApiCall (apiPath, args, options) {
    const retryCount = options.retryCount || 0
    const maxRetries = options.maxRetries || this.retryConfig.maxRetries

    if (retryCount >= maxRetries) {
      const error = new Error(`API 調用重試次數已達上限: ${apiPath}`)
      error.code = ErrorCodes.TIMEOUT_ERROR
      error.details = {
        category: 'chrome-api',
        apiPath,
        maxRetries
      }
      throw error
    }

    // 延遲重試
    const delay = (options.retryDelay || this.retryConfig.retryDelay) * (retryCount + 1)
    await new Promise(resolve => setTimeout(resolve, delay))

    this.logger.log(`[RETRY] 重試 Chrome API 調用: ${apiPath} (${retryCount + 1}/${maxRetries})`)

    // 更新選項
    const newOptions = {
      ...options,
      retryCount: retryCount + 1
    }

    return await this.callChromeApi(apiPath, args, newOptions)
  }

  /**
   * 判斷是否應該重試
   * @param {Error} error - 錯誤物件
   * @param {Object} options - 調用選項
   * @returns {boolean}
   * @private
   */
  shouldRetry (error, options) {
    // 檢查是否禁用重試
    if (options.noRetry) {
      return false
    }

    // 檢查重試次數
    const retryCount = options.retryCount || 0
    const maxRetries = options.maxRetries || this.retryConfig.maxRetries
    if (retryCount >= maxRetries) {
      return false
    }

    // 檢查錯誤是否可重試
    const errorMessage = error.message
    return this.retryConfig.retryableErrors.some(retryableError =>
      errorMessage.includes(retryableError)
    )
  }

  // ====================
  // 常用 API 的便捷方法
  // ====================

  /**
   * Storage API 封裝
   */
  async storageGet (keys, area = 'local') {
    return await this.callChromeApi(`storage.${area}.get`, [keys])
  }

  async storageSet (items, area = 'local') {
    return await this.callChromeApi(`storage.${area}.set`, [items])
  }

  async storageRemove (keys, area = 'local') {
    return await this.callChromeApi(`storage.${area}.remove`, [keys])
  }

  async storageClear (area = 'local') {
    return await this.callChromeApi(`storage.${area}.clear`, [])
  }

  /**
   * Tabs API 封裝
   */
  async tabsQuery (queryInfo) {
    return await this.callChromeApi('tabs.query', [queryInfo])
  }

  async tabsSendMessage (tabId, message, options = {}) {
    return await this.callChromeApi('tabs.sendMessage', [tabId, message, options])
  }

  async tabsCreate (createProperties) {
    return await this.callChromeApi('tabs.create', [createProperties])
  }

  async tabsUpdate (tabId, updateProperties) {
    return await this.callChromeApi('tabs.update', [tabId, updateProperties])
  }

  async tabsRemove (tabIds) {
    return await this.callChromeApi('tabs.remove', [tabIds])
  }

  /**
   * Runtime API 封裝
   */
  async runtimeSendMessage (message, options = {}) {
    return await this.callChromeApi('runtime.sendMessage', [message, options])
  }

  runtimeGetManifest () {
    // 同步 API，不需要 Promise 包裝
    return chrome.runtime.getManifest()
  }

  runtimeReload () {
    // 同步 API
    chrome.runtime.reload()
  }

  /**
   * Notifications API 封裝
   */
  async notificationsCreate (notificationId, options) {
    return await this.callChromeApi('notifications.create', [notificationId, options])
  }

  async notificationsClear (notificationId) {
    return await this.callChromeApi('notifications.clear', [notificationId])
  }

  // ====================
  // 批次處理功能
  // ====================

  /**
   * 開始批次處理
   * @private
   */
  startBatchProcessing () {
    if (this.batchTimer) {
      return
    }

    this.batchTimer = setInterval(() => {
      this.processBatchQueue()
    }, this.batchDelay)
  }

  /**
   * 停止批次處理
   * @private
   */
  stopBatchProcessing () {
    if (this.batchTimer) {
      clearInterval(this.batchTimer)
      this.batchTimer = null
    }
  }

  /**
   * 處理批次佇列
   * @private
   */
  async processBatchQueue () {
    if (this.batchQueue.size === 0) {
      return
    }

    // 處理每個 API 的批次操作
    for (const [apiName, operations] of this.batchQueue.entries()) {
      if (operations.length === 0) {
        continue
      }

      try {
        await this.processBatchOperations(apiName, operations)
      } catch (error) {
        this.logger.error(`[FAIL] 批次處理失敗: ${apiName}`, error)
      }

      // 清空已處理的操作
      this.batchQueue.set(apiName, [])
    }
  }

  /**
   * 處理特定 API 的批次操作
   * @param {string} apiName - API 名稱
   * @param {Array} operations - 操作陣列
   * @returns {Promise<void>}
   * @private
   */
  async processBatchOperations (apiName, operations) {
    // 根據 API 類型進行批次處理
    switch (apiName) {
      case 'storage.local.set':
        await this.batchStorageSet(operations)
        break

      case 'tabs.sendMessage':
        await this.batchTabsSendMessage(operations)
        break

      default:
        // 不支援批次處理的 API，逐一執行
        for (const operation of operations) {
          await this.callChromeApi(operation.apiPath, operation.args, operation.options)
        }
    }
  }

  /**
   * 批次 Storage Set 操作
   * @param {Array} operations - 操作陣列
   * @returns {Promise<void>}
   * @private
   */
  async batchStorageSet (operations) {
    // 合併所有 storage.set 操作
    const mergedItems = {}

    for (const operation of operations) {
      const items = operation.args[0] || {}
      Object.assign(mergedItems, items)
    }

    if (Object.keys(mergedItems).length > 0) {
      await this.storageSet(mergedItems)
    }
  }

  /**
   * 批次 Tabs Send Message 操作
   * @param {Array} operations - 操作陣列
   * @returns {Promise<void>}
   * @private
   */
  async batchTabsSendMessage (operations) {
    // 並行發送訊息到不同標籤頁
    const promises = operations.map(operation =>
      this.tabsSendMessage(operation.args[0], operation.args[1], operation.args[2])
        .catch(error => ({ error: error.message }))
    )

    await Promise.all(promises)
  }

  /**
   * 清空批次佇列
   * @returns {Promise<void>}
   * @private
   */
  async flushBatchQueue () {
    await this.processBatchQueue()
    this.batchQueue.clear()
  }

  // ====================
  // 統計和監控
  // ====================

  /**
   * 更新 API 統計
   * @param {string} apiPath - API 路徑
   * @param {string} type - 統計類型 ('attempt', 'success', 'failed')
   * @param {number} responseTime - 回應時間（僅成功時）
   * @private
   */
  updateApiStats (apiPath, type, responseTime = 0) {
    if (type === 'attempt') {
      this.apiStats.total++
    }

    if (type === 'success') {
      this.apiStats.success++

      // 更新回應時間統計
      this.apiStats.totalResponseTime += responseTime
      this.apiStats.avgResponseTime = this.apiStats.totalResponseTime / this.apiStats.success
    }

    if (type === 'failed') {
      this.apiStats.failed++
    }

    // 按 API 統計
    if (!this.apiStats.byApi.has(apiPath)) {
      this.apiStats.byApi.set(apiPath, { total: 0, success: 0, failed: 0 })
    }

    const apiStat = this.apiStats.byApi.get(apiPath)
    if (type === 'attempt') apiStat.total++
    if (type === 'success') apiStat.success++
    if (type === 'failed') apiStat.failed++
  }

  /**
   * 更新錯誤統計
   * @param {string} errorMessage - 錯誤訊息
   * @private
   */
  updateErrorStats (errorMessage) {
    // 簡化錯誤訊息進行分類
    const errorType = this.categorizeError(errorMessage)

    if (!this.apiStats.byError.has(errorType)) {
      this.apiStats.byError.set(errorType, 0)
    }

    this.apiStats.byError.set(errorType, this.apiStats.byError.get(errorType) + 1)
  }

  /**
   * 分類錯誤訊息
   * @param {string} errorMessage - 錯誤訊息
   * @returns {string} 錯誤類型
   * @private
   */
  categorizeError (errorMessage) {
    if (errorMessage.includes('Could not establish connection')) {
      return 'connection_failed'
    }
    if (errorMessage.includes('Extension context invalidated')) {
      return 'context_invalidated'
    }
    if (errorMessage.includes('The message port closed')) {
      return 'port_closed'
    }
    if (errorMessage.includes('not found')) {
      return 'not_found'
    }

    return 'unknown_error'
  }

  /**
   * 重置統計
   * @private
   */
  resetStats () {
    this.apiStats = {
      total: 0,
      success: 0,
      failed: 0,
      byApi: new Map(),
      byError: new Map(),
      avgResponseTime: 0,
      totalResponseTime: 0
    }
  }

  /**
   * 取得 Chrome API 狀態
   * @returns {Object} API 狀態報告
   */
  getChromeApiStatus () {
    return {
      stats: {
        ...this.apiStats,
        byApi: Object.fromEntries(this.apiStats.byApi),
        byError: Object.fromEntries(this.apiStats.byError)
      },
      supportedApis: Array.from(this.supportedApis),
      batchQueue: {
        size: this.batchQueue.size,
        totalOperations: Array.from(this.batchQueue.values())
          .reduce((total, ops) => total + ops.length, 0)
      },
      retryConfig: { ...this.retryConfig },
      timestamp: Date.now()
    }
  }

  /**
   * 取得自訂健康狀態
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus () {
    const errorRate = this.apiStats.total > 0
      ? this.apiStats.failed / this.apiStats.total
      : 0

    const avgResponseTime = this.apiStats.avgResponseTime
    const batchQueueSize = Array.from(this.batchQueue.values())
      .reduce((total, ops) => total + ops.length, 0)

    return {
      errorRate,
      avgResponseTime,
      batchQueueSize,
      totalApiCalls: this.apiStats.total,
      health: errorRate > 0.2 || avgResponseTime > 1000 ? 'degraded' : 'healthy'
    }
  }
}

module.exports = ChromeApiWrapper
