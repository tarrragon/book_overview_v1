/**
 * Background Service Worker 基底模組類別
 *
 * 負責功能：
 * - 提供統一的模組介面和生命週期管理
 * - 實現依賴注入和模組化架構
 * - 提供標準化的錯誤處理和健康檢查
 * - 支援模組的啟動、停止和清理機制
 *
 * 設計考量：
 * - 基於抽象基底類設計，確保介面一致性
 * - 支援依賴注入，提升可測試性
 * - 實現標準生命週期方法，便於統一管理
 * - 提供健康狀態監控，支援系統診斷
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

class BaseModule {
  /**
   * 建構函數
   * @param {Object} dependencies - 依賴注入的服務和配置
   * @param {EventBus} dependencies.eventBus - 事件系統實例
   * @param {Object} dependencies.logger - 日誌記錄器
   * @param {Object} dependencies.config - 模組配置
   */
  constructor (dependencies = {}) {
    this.eventBus = dependencies.eventBus || null

    // Logger 後備方案: Background Service 初始化保護
    // 設計理念: 基底模組作為所有 Background Service 的核心基礎設施
    // 執行環境: Service Worker 初始化階段，依賴注入可能不完整
    // 後備機制: console 確保模組生命週期錯誤能被追蹤
    // 風險考量: 理想上應確保 Logger 完整可用，此為過渡性保護
    this.logger = dependencies.logger || console
    this.config = dependencies.config || {}

    // 模組狀態管理
    this.isInitialized = false
    this.isRunning = false
    this.initializationError = null
    this.lastHealthCheck = null

    // 模組識別
    this.moduleName = this.constructor.name
    this.moduleId = `${this.moduleName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    this.logger.log(`${this.moduleName} 模組建立，ID: ${this.moduleId}`)
  }

  /**
   * 模組初始化
   * 子類別應覆寫此方法實現特定的初始化邏輯
   * @returns {Promise<void>}
   */
  async initialize () {
    if (this.isInitialized) {
      this.logger.warn(`[WARN] ${this.moduleName} 模組已初始化，跳過重複初始化`)
      return
    }

    try {
      this.logger.log(`[START] 開始初始化 ${this.moduleName} 模組`)

      // 子類別可覆寫的初始化邏輯
      await this._doInitialize()

      this.isInitialized = true
      this.initializationError = null
      this.logger.log(`[OK] ${this.moduleName} 模組初始化完成`)

      // 觸發初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('MODULE.INITIALIZED', {
          moduleName: this.moduleName,
          moduleId: this.moduleId,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.initializationError = error
      this.logger.error(`[FAIL] ${this.moduleName} 模組初始化失敗:`, error)

      // 觸發初始化失敗事件
      if (this.eventBus) {
        await this.eventBus.emit('MODULE.INITIALIZATION.FAILED', {
          moduleName: this.moduleName,
          moduleId: this.moduleId,
          error: error.message,
          timestamp: Date.now()
        })
      }

      throw error
    }
  }

  /**
   * 模組啟動
   * 子類別應覆寫此方法實現特定的啟動邏輯
   * @returns {Promise<void>}
   */
  async start () {
    if (!this.isInitialized) {
      const error = new Error(`${this.moduleName} 模組尚未初始化，無法啟動`)
      error.code = ErrorCodes.SERVICE_INITIALIZATION_ERROR
      error.details = {
        category: 'general',
        component: 'BaseModule',
        moduleName: this.moduleName
      }
      throw error
    }

    if (this.isRunning) {
      this.logger.warn(`[WARN] ${this.moduleName} 模組已啟動，跳過重複啟動`)
      return
    }

    try {
      this.logger.log(`[START] 開始啟動 ${this.moduleName} 模組`)

      // 子類別可覆寫的啟動邏輯
      await this._doStart()

      this.isRunning = true
      this.logger.log(`[OK] ${this.moduleName} 模組啟動完成`)

      // 觸發啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('MODULE.STARTED', {
          moduleName: this.moduleName,
          moduleId: this.moduleId,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error(`[FAIL] ${this.moduleName} 模組啟動失敗:`, error)

      // 觸發啟動失敗事件
      if (this.eventBus) {
        await this.eventBus.emit('MODULE.START.FAILED', {
          moduleName: this.moduleName,
          moduleId: this.moduleId,
          error: error.message,
          timestamp: Date.now()
        })
      }

      throw error
    }
  }

  /**
   * 模組停止
   * 子類別應覆寫此方法實現特定的停止邏輯
   * @returns {Promise<void>}
   */
  async stop () {
    if (!this.isRunning) {
      this.logger.warn(`[WARN] ${this.moduleName} 模組未啟動，跳過停止`)
      return
    }

    try {
      this.logger.log(`[STOP] 開始停止 ${this.moduleName} 模組`)

      // 子類別可覆寫的停止邏輯
      await this._doStop()

      this.isRunning = false
      this.logger.log(`[OK] ${this.moduleName} 模組停止完成`)

      // 觸發停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('MODULE.STOPPED', {
          moduleName: this.moduleName,
          moduleId: this.moduleId,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error(`[FAIL] ${this.moduleName} 模組停止失敗:`, error)

      // 觸發停止失敗事件
      if (this.eventBus) {
        await this.eventBus.emit('MODULE.STOP.FAILED', {
          moduleName: this.moduleName,
          moduleId: this.moduleId,
          error: error.message,
          timestamp: Date.now()
        })
      }

      throw error
    }
  }

  /**
   * 模組清理
   * 子類別應覆寫此方法實現特定的清理邏輯
   * @returns {Promise<void>}
   */
  async cleanup () {
    try {
      this.logger.log(`開始清理 ${this.moduleName} 模組`)

      // 先停止模組
      if (this.isRunning) {
        await this.stop()
      }

      // 子類別可覆寫的清理邏輯
      await this._doCleanup()

      // 重置狀態
      this.isInitialized = false
      this.isRunning = false
      this.initializationError = null
      this.lastHealthCheck = null

      this.logger.log(`[OK] ${this.moduleName} 模組清理完成`)

      // 觸發清理完成事件
      if (this.eventBus) {
        await this.eventBus.emit('MODULE.CLEANED', {
          moduleName: this.moduleName,
          moduleId: this.moduleId,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error(`[FAIL] ${this.moduleName} 模組清理失敗:`, error)
      throw error
    }
  }

  /**
   * 健康狀態檢查
   * 子類別可覆寫此方法實現特定的健康檢查邏輯
   * @returns {Object} 健康狀態報告
   */
  getHealthStatus () {
    const now = Date.now()
    this.lastHealthCheck = now

    // 基本健康狀態
    const baseStatus = {
      moduleName: this.moduleName,
      moduleId: this.moduleId,
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      hasInitializationError: !!this.initializationError,
      initializationError: this.initializationError?.message || null,
      lastHealthCheck: now,
      uptime: this.isRunning ? now - (this.startTime || now) : 0
    }

    // 子類別可覆寫的健康檢查
    const customStatus = this._getCustomHealthStatus()

    return {
      ...baseStatus,
      ...customStatus,
      overall: this._calculateOverallHealth(baseStatus, customStatus)
    }
  }

  // ====================
  // 子類別可覆寫的保護方法
  // ====================

  /**
   * 執行初始化邏輯（子類別覆寫）
   * @returns {Promise<void>}
   * @protected
   */
  async _doInitialize () {
    // 子類別實現特定初始化邏輯
  }

  /**
   * 執行啟動邏輯（子類別覆寫）
   * @returns {Promise<void>}
   * @protected
   */
  async _doStart () {
    this.startTime = Date.now()
    // 子類別實現特定啟動邏輯
  }

  /**
   * 執行停止邏輯（子類別覆寫）
   * @returns {Promise<void>}
   * @protected
   */
  async _doStop () {
    // 子類別實現特定停止邏輯
  }

  /**
   * 執行清理邏輯（子類別覆寫）
   * @returns {Promise<void>}
   * @protected
   */
  async _doCleanup () {
    // 子類別實現特定清理邏輯
  }

  /**
   * 取得自訂健康狀態（子類別覆寫）
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus () {
    return {}
  }

  /**
   * 計算整體健康狀態
   * @param {Object} baseStatus - 基本健康狀態
   * @param {Object} customStatus - 自訂健康狀態
   * @returns {string} 整體健康狀態：'healthy', 'degraded', 'unhealthy'
   * @protected
   */
  _calculateOverallHealth (baseStatus, customStatus) {
    // 基本健康檢查
    if (!baseStatus.isInitialized || baseStatus.hasInitializationError) {
      return 'unhealthy'
    }

    if (!baseStatus.isRunning) {
      return 'degraded'
    }

    // 子類別可以在 customStatus 中提供額外的健康指標
    const customHealth = customStatus.health || 'healthy'

    // 綜合判斷
    if (customHealth === 'unhealthy') {
      return 'unhealthy'
    } else if (customHealth === 'degraded') {
      return 'degraded'
    }

    return 'healthy'
  }
}

module.exports = BaseModule
