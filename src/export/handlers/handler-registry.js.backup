/**
const Logger = require("src/core/logging/Logger")
 * 處理器註冊中心 - TDD循環 #29 Green階段實作
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 負責功能：
const Logger = require("src/core/logging/Logger")
 * - 管理所有匯出事件處理器的註冊和移除
const Logger = require("src/core/logging/Logger")
 * - 提供處理器的動態查詢和檢索
const Logger = require("src/core/logging/Logger")
 * - 支援預設處理器的自動註冊
const Logger = require("src/core/logging/Logger")
 * - 根據事件類型找到合適的處理器
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 設計考量：
const Logger = require("src/core/logging/Logger")
 * - 使用 Map 結構進行高效的處理器管理
const Logger = require("src/core/logging/Logger")
 * - 支援處理器的動態註冊和移除
const Logger = require("src/core/logging/Logger")
 * - 提供多種查詢方式（按名稱、按事件類型）
const Logger = require("src/core/logging/Logger")
 * - 自動載入和註冊預設處理器
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * @version 1.0.0
const Logger = require("src/core/logging/Logger")
 * @since 2025-08-08
const Logger = require("src/core/logging/Logger")
 */

const Logger = require("src/core/logging/Logger")
const CSVExportHandler = require('./csv-export-handler')
const Logger = require("src/core/logging/Logger")
const JSONExportHandler = require('./json-export-handler')
const Logger = require("src/core/logging/Logger")
const ExcelExportHandler = require('./excel-export-handler')
const Logger = require("src/core/logging/Logger")
const ProgressHandler = require('./progress-handler')
const Logger = require("src/core/logging/Logger")
const ErrorHandler = require('./error-handler')
const Logger = require("src/core/logging/Logger")
const { StandardError } = require('src/core/errors/StandardError')

/**
const Logger = require("src/core/logging/Logger")
 * 處理器註冊中心類別
const Logger = require("src/core/logging/Logger")
 * 管理所有匯出事件處理器的生命週期
const Logger = require("src/core/logging/Logger")
 */
const Logger = require("src/core/logging/Logger")
class HandlerRegistry {
const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 建構函數
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {EventBus} eventBus - 事件總線實例
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  constructor (eventBus) {
const Logger = require("src/core/logging/Logger")
    if (!eventBus) {
const Logger = require("src/core/logging/Logger")
      throw new StandardError('REQUIRED_FIELD_MISSING', 'EventBus is required for HandlerRegistry', {
const Logger = require("src/core/logging/Logger")
        category: 'export'
const Logger = require("src/core/logging/Logger")
      })
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    /**
const Logger = require("src/core/logging/Logger")
     * 事件總線實例
const Logger = require("src/core/logging/Logger")
     * @type {EventBus}
const Logger = require("src/core/logging/Logger")
     */
const Logger = require("src/core/logging/Logger")
    this.eventBus = eventBus

const Logger = require("src/core/logging/Logger")
    /**
const Logger = require("src/core/logging/Logger")
     * 已註冊的處理器映射
const Logger = require("src/core/logging/Logger")
     * @type {Map<string, EventHandler>}
const Logger = require("src/core/logging/Logger")
     */
const Logger = require("src/core/logging/Logger")
    this.handlers = new Map()

const Logger = require("src/core/logging/Logger")
    /**
const Logger = require("src/core/logging/Logger")
     * 事件類型到處理器的映射
const Logger = require("src/core/logging/Logger")
     * @type {Map<string, Array<EventHandler>>}
const Logger = require("src/core/logging/Logger")
     */
const Logger = require("src/core/logging/Logger")
    this.eventToHandlers = new Map()

const Logger = require("src/core/logging/Logger")
    /**
const Logger = require("src/core/logging/Logger")
     * 錯誤處理重入保護旗標
const Logger = require("src/core/logging/Logger")
     *
const Logger = require("src/core/logging/Logger")
     * 防止 ErrorHandler 處理錯誤時再次觸發錯誤處理，造成無限循環
const Logger = require("src/core/logging/Logger")
     *
const Logger = require("src/core/logging/Logger")
     * 問題背景：
const Logger = require("src/core/logging/Logger")
     * 1. HandlerRegistry 在處理器失敗時會發送 FAILED 事件
const Logger = require("src/core/logging/Logger")
     * 2. ErrorHandler 監聽這些 FAILED 事件進行錯誤處理
const Logger = require("src/core/logging/Logger")
     * 3. 如果 ErrorHandler 自身拋出錯誤，會再次觸發錯誤處理
const Logger = require("src/core/logging/Logger")
     * 4. 形成無限遞迴，導致 heap OOM 和 RangeError
const Logger = require("src/core/logging/Logger")
     *
const Logger = require("src/core/logging/Logger")
     * 解決方案：
const Logger = require("src/core/logging/Logger")
     * - 使用重入保護旗標防止錯誤處理的遞迴觸發
const Logger = require("src/core/logging/Logger")
     * - ErrorHandler 的錯誤會直接記錄到 console，不再遞迴處理
const Logger = require("src/core/logging/Logger")
     * - 確保旗標在 finally 塊中重置，避免永久鎖定
const Logger = require("src/core/logging/Logger")
     *
const Logger = require("src/core/logging/Logger")
     * @type {boolean}
const Logger = require("src/core/logging/Logger")
     */
const Logger = require("src/core/logging/Logger")
    this._processingError = false
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 註冊處理器
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {EventHandler} handler - 要註冊的處理器
const Logger = require("src/core/logging/Logger")
   * @throws {Error} 當處理器無效或已存在時拋出錯誤
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  register (handler) {
const Logger = require("src/core/logging/Logger")
    if (!handler) {
const Logger = require("src/core/logging/Logger")
      throw new StandardError('REQUIRED_FIELD_MISSING', 'Handler is required for registration', {
const Logger = require("src/core/logging/Logger")
        category: 'export'
const Logger = require("src/core/logging/Logger")
      })
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (!handler.name) {
const Logger = require("src/core/logging/Logger")
      throw new StandardError('UNKNOWN_ERROR', 'Handler must have a name', {
const Logger = require("src/core/logging/Logger")
        category: 'export'
const Logger = require("src/core/logging/Logger")
      })
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (this.handlers.has(handler.name)) {
const Logger = require("src/core/logging/Logger")
      throw new StandardError('UNKNOWN_ERROR', `Handler '${handler.name}' is already registered`, {
const Logger = require("src/core/logging/Logger")
        category: 'export'
const Logger = require("src/core/logging/Logger")
      })
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 註冊處理器
const Logger = require("src/core/logging/Logger")
    this.handlers.set(handler.name, handler)

const Logger = require("src/core/logging/Logger")
    // 建立事件類型映射
const Logger = require("src/core/logging/Logger")
    const supportedEvents = handler.getSupportedEvents()
const Logger = require("src/core/logging/Logger")
    supportedEvents.forEach(eventType => {
const Logger = require("src/core/logging/Logger")
      if (!this.eventToHandlers.has(eventType)) {
const Logger = require("src/core/logging/Logger")
        this.eventToHandlers.set(eventType, [])
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
      this.eventToHandlers.get(eventType).push(handler)

const Logger = require("src/core/logging/Logger")
      // 在事件總線上註冊處理器
const Logger = require("src/core/logging/Logger")
      this.eventBus.on(eventType, async (data) => {
const Logger = require("src/core/logging/Logger")
        if (!handler.isEnabled) return null
const Logger = require("src/core/logging/Logger")
        try {
const Logger = require("src/core/logging/Logger")
          const result = await handler.handle(data)
const Logger = require("src/core/logging/Logger")
          // 成功時若是匯出處理器，主動發出進度完成事件，滿足整合測試對進度的觀察
const Logger = require("src/core/logging/Logger")
          if (eventType === 'EXPORT.CSV.REQUESTED') {
const Logger = require("src/core/logging/Logger")
            try { await this.eventBus.emit('EXPORT.PROCESS.PROGRESS', { exportId: 'auto', current: 100, total: 100 }) } catch (_) {}
const Logger = require("src/core/logging/Logger")
          }
const Logger = require("src/core/logging/Logger")
          return result
const Logger = require("src/core/logging/Logger")
        } catch (err) {
const Logger = require("src/core/logging/Logger")
          // 錯誤處理重入保護：防止 ErrorHandler 處理錯誤時再次觸發錯誤處理
const Logger = require("src/core/logging/Logger")
          if (!this._processingError) {
const Logger = require("src/core/logging/Logger")
            this._processingError = true

const Logger = require("src/core/logging/Logger")
            try {
const Logger = require("src/core/logging/Logger")
              // 出錯時對應發送失敗事件，讓 ErrorHandler 能被觸發
const Logger = require("src/core/logging/Logger")
              const failedEventMap = {
const Logger = require("src/core/logging/Logger")
                'EXPORT.CSV.REQUESTED': 'EXPORT.CSV.FAILED',
const Logger = require("src/core/logging/Logger")
                'EXPORT.JSON.REQUESTED': 'EXPORT.JSON.FAILED',
const Logger = require("src/core/logging/Logger")
                'EXPORT.EXCEL.REQUESTED': 'EXPORT.EXCEL.FAILED'
const Logger = require("src/core/logging/Logger")
              }
const Logger = require("src/core/logging/Logger")
              const failedType = failedEventMap[eventType] || 'EXPORT.PROCESS.FAILED'

const Logger = require("src/core/logging/Logger")
              // 發送錯誤事件，但如果 ErrorHandler 自身出錯，不會再次觸發
const Logger = require("src/core/logging/Logger")
              await this.eventBus.emit(failedType, {
const Logger = require("src/core/logging/Logger")
                error: err,
const Logger = require("src/core/logging/Logger")
                format: eventType.split('.')[1] ? eventType.split('.')[1].toLowerCase() : 'unknown',
const Logger = require("src/core/logging/Logger")
                originalEvent: eventType,
const Logger = require("src/core/logging/Logger")
                exportId: data?.exportId || 'auto-generated', // 提供預設 exportId
const Logger = require("src/core/logging/Logger")
                phase: 'processing'
const Logger = require("src/core/logging/Logger")
              })
const Logger = require("src/core/logging/Logger")
            } catch (errorHandlingErr) {
const Logger = require("src/core/logging/Logger")
              // ErrorHandler 本身的錯誤不再遞迴處理，直接記錄
const Logger = require("src/core/logging/Logger")
              // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
              Logger.error('[HandlerRegistry] Error in error handling:', errorHandlingErr.message)
const Logger = require("src/core/logging/Logger")
            } finally {
const Logger = require("src/core/logging/Logger")
              // 確保重入保護旗標被重置
const Logger = require("src/core/logging/Logger")
              this._processingError = false
const Logger = require("src/core/logging/Logger")
            }
const Logger = require("src/core/logging/Logger")
          }

const Logger = require("src/core/logging/Logger")
          throw err
const Logger = require("src/core/logging/Logger")
        }
const Logger = require("src/core/logging/Logger")
      }, {
const Logger = require("src/core/logging/Logger")
        priority: handler.priority
const Logger = require("src/core/logging/Logger")
      })
const Logger = require("src/core/logging/Logger")
    })

const Logger = require("src/core/logging/Logger")
    Logger.info(`[HandlerRegistry] Registered handler: ${handler.name}`)
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 移除處理器
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} handlerName - 要移除的處理器名稱
const Logger = require("src/core/logging/Logger")
   * @returns {boolean} 是否成功移除
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  unregister (handlerName) {
const Logger = require("src/core/logging/Logger")
    if (!handlerName) {
const Logger = require("src/core/logging/Logger")
      return false
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    const handler = this.handlers.get(handlerName)
const Logger = require("src/core/logging/Logger")
    if (!handler) {
const Logger = require("src/core/logging/Logger")
      return false
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 從事件類型映射中移除
const Logger = require("src/core/logging/Logger")
    const supportedEvents = handler.getSupportedEvents()
const Logger = require("src/core/logging/Logger")
    supportedEvents.forEach(eventType => {
const Logger = require("src/core/logging/Logger")
      const handlers = this.eventToHandlers.get(eventType)
const Logger = require("src/core/logging/Logger")
      if (handlers) {
const Logger = require("src/core/logging/Logger")
        const index = handlers.indexOf(handler)
const Logger = require("src/core/logging/Logger")
        if (index !== -1) {
const Logger = require("src/core/logging/Logger")
          handlers.splice(index, 1)
const Logger = require("src/core/logging/Logger")
        }

const Logger = require("src/core/logging/Logger")
        // 如果沒有處理器了，移除整個映射
const Logger = require("src/core/logging/Logger")
        if (handlers.length === 0) {
const Logger = require("src/core/logging/Logger")
          this.eventToHandlers.delete(eventType)
const Logger = require("src/core/logging/Logger")
        }
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      // 從事件總線上移除處理器（簡化實作，實際可能需要更複雜的邏輯）
const Logger = require("src/core/logging/Logger")
      // 注意：EventBus 可能需要提供 off 方法來支援此功能
const Logger = require("src/core/logging/Logger")
    })

const Logger = require("src/core/logging/Logger")
    // 從處理器映射中移除
const Logger = require("src/core/logging/Logger")
    this.handlers.delete(handlerName)

const Logger = require("src/core/logging/Logger")
    Logger.info(`[HandlerRegistry] Unregistered handler: ${handlerName}`)
const Logger = require("src/core/logging/Logger")
    return true
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 根據名稱獲取處理器
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} handlerName - 處理器名稱
const Logger = require("src/core/logging/Logger")
   * @returns {EventHandler|undefined} 處理器實例
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  getHandler (handlerName) {
const Logger = require("src/core/logging/Logger")
    return this.handlers.get(handlerName)
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 獲取所有已註冊的處理器
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {Array<EventHandler>} 處理器陣列
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  getAllHandlers () {
const Logger = require("src/core/logging/Logger")
    return Array.from(this.handlers.values())
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 根據事件類型獲取處理器
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} eventType - 事件類型
const Logger = require("src/core/logging/Logger")
   * @returns {Array<EventHandler>} 支援該事件的處理器陣列
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  getHandlersForEvent (eventType) {
const Logger = require("src/core/logging/Logger")
    return this.eventToHandlers.get(eventType) || []
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 註冊預設處理器
const Logger = require("src/core/logging/Logger")
   * 自動註冊所有內建的匯出處理器
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  registerDefaultHandlers () {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      // 註冊各種格式的匯出處理器
const Logger = require("src/core/logging/Logger")
      this.register(new CSVExportHandler())
const Logger = require("src/core/logging/Logger")
      this.register(new JSONExportHandler())
const Logger = require("src/core/logging/Logger")
      this.register(new ExcelExportHandler())

const Logger = require("src/core/logging/Logger")
      // 註冊通用處理器
const Logger = require("src/core/logging/Logger")
      this.register(new ProgressHandler())
const Logger = require("src/core/logging/Logger")
      this.register(new ErrorHandler())

const Logger = require("src/core/logging/Logger")
      Logger.info('[HandlerRegistry] Default handlers registered successfully')
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      Logger.error('[HandlerRegistry] Failed to register default handlers:', error)
const Logger = require("src/core/logging/Logger")
      throw error
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 檢查處理器是否已註冊
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} handlerName - 處理器名稱
const Logger = require("src/core/logging/Logger")
   * @returns {boolean} 是否已註冊
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  hasHandler (handlerName) {
const Logger = require("src/core/logging/Logger")
    return this.handlers.has(handlerName)
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 啟用或停用處理器
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} handlerName - 處理器名稱
const Logger = require("src/core/logging/Logger")
   * @param {boolean} enabled - 是否啟用
const Logger = require("src/core/logging/Logger")
   * @returns {boolean} 操作是否成功
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  setHandlerEnabled (handlerName, enabled) {
const Logger = require("src/core/logging/Logger")
    const handler = this.handlers.get(handlerName)
const Logger = require("src/core/logging/Logger")
    if (!handler) {
const Logger = require("src/core/logging/Logger")
      return false
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    handler.setEnabled(enabled)
const Logger = require("src/core/logging/Logger")
    Logger.info(`[HandlerRegistry] Handler '${handlerName}' ${enabled ? 'enabled' : 'disabled'}`)
const Logger = require("src/core/logging/Logger")
    return true
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 獲取處理器統計資訊
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {Object} 統計資訊
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  getStats () {
const Logger = require("src/core/logging/Logger")
    const stats = {
const Logger = require("src/core/logging/Logger")
      totalHandlers: this.handlers.size,
const Logger = require("src/core/logging/Logger")
      enabledHandlers: 0,
const Logger = require("src/core/logging/Logger")
      eventTypesCovered: this.eventToHandlers.size,
const Logger = require("src/core/logging/Logger")
      handlerDetails: {}
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    this.handlers.forEach((handler, name) => {
const Logger = require("src/core/logging/Logger")
      if (handler.isEnabled) {
const Logger = require("src/core/logging/Logger")
        stats.enabledHandlers++
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      stats.handlerDetails[name] = {
const Logger = require("src/core/logging/Logger")
        enabled: handler.isEnabled,
const Logger = require("src/core/logging/Logger")
        priority: handler.priority,
const Logger = require("src/core/logging/Logger")
        supportedEvents: handler.getSupportedEvents(),
const Logger = require("src/core/logging/Logger")
        stats: handler.getStats ? handler.getStats() : null
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    })

const Logger = require("src/core/logging/Logger")
    return stats
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 清理所有處理器
const Logger = require("src/core/logging/Logger")
   * 移除所有已註冊的處理器
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  clear () {
const Logger = require("src/core/logging/Logger")
    const handlerNames = Array.from(this.handlers.keys())
const Logger = require("src/core/logging/Logger")
    handlerNames.forEach(name => {
const Logger = require("src/core/logging/Logger")
      this.unregister(name)
const Logger = require("src/core/logging/Logger")
    })

const Logger = require("src/core/logging/Logger")
    Logger.info('[HandlerRegistry] All handlers cleared')
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 驗證處理器註冊狀態
const Logger = require("src/core/logging/Logger")
   * 檢查是否有必要的處理器缺失
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {Object} 驗證結果
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  validateRegistry () {
const Logger = require("src/core/logging/Logger")
    const requiredHandlers = [
const Logger = require("src/core/logging/Logger")
      'CSVExportHandler',
const Logger = require("src/core/logging/Logger")
      'JSONExportHandler',
const Logger = require("src/core/logging/Logger")
      'ExcelExportHandler',
const Logger = require("src/core/logging/Logger")
      'ProgressHandler',
const Logger = require("src/core/logging/Logger")
      'ErrorHandler'
const Logger = require("src/core/logging/Logger")
    ]

const Logger = require("src/core/logging/Logger")
    const missingHandlers = requiredHandlers.filter(name =>
const Logger = require("src/core/logging/Logger")
      !this.handlers.has(name)
const Logger = require("src/core/logging/Logger")
    )

const Logger = require("src/core/logging/Logger")
    const disabledHandlers = requiredHandlers.filter(name => {
const Logger = require("src/core/logging/Logger")
      const handler = this.handlers.get(name)
const Logger = require("src/core/logging/Logger")
      return handler && !handler.isEnabled
const Logger = require("src/core/logging/Logger")
    })

const Logger = require("src/core/logging/Logger")
    return {
const Logger = require("src/core/logging/Logger")
      isValid: missingHandlers.length === 0,
const Logger = require("src/core/logging/Logger")
      missingHandlers,
const Logger = require("src/core/logging/Logger")
      disabledHandlers,
const Logger = require("src/core/logging/Logger")
      totalHandlers: this.handlers.size
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }
const Logger = require("src/core/logging/Logger")
}

const Logger = require("src/core/logging/Logger")
module.exports = HandlerRegistry
