/**
 * Service Worker 關閉處理器
 *
 * 負責功能：
 * - 處理 Service Worker 的關閉和暫停事件
 * - 優雅地關閉系統模組和服務
 * - 保存關鍵狀態和未完成的操作
 * - 清理資源和連接
 *
 * 設計考量：
 * - 基於 BaseModule 實現標準生命週期管理
 * - 支援優雅關閉和強制關閉模式
 * - 實現狀態持久化和恢復準備
 * - 提供關閉超時保護機制
 *
 * 注意：Manifest V3 中 Service Worker 的關閉是由瀏覽器控制的，
 * 我們無法直接監聽 onSuspend 事件，但可以準備相關的關閉邏輯。
 */

const BaseModule = require('./base-module')
const { StandardError } = require('src/core/errors/StandardError')

class ShutdownHandler extends BaseModule {
  constructor (dependencies = {}) {
    super(dependencies)

    // 關閉相關服務
    this.eventCoordinator = dependencies.eventCoordinator || null
    this.messageRouter = dependencies.messageRouter || null
    this.pageMonitor = dependencies.pageMonitor || null
    this.errorHandler = dependencies.errorHandler || null

    // 關閉狀態追蹤
    this.shutdownInProgress = false
    this.shutdownStartTime = null
    this.shutdownTimeout = 30000 // 30秒超時
    this.lastShutdownReason = null
    this.shutdownHistory = []

    // 關閉順序（與啟動相反）
    this.shutdownSequence = [
      'pageMonitor', // 頁面監控最先關閉
      'messageRouter', // 通訊系統
      'errorHandler', // 錯誤處理
      'eventCoordinator' // 事件系統最後關閉
    ]

    // 需要持久化的狀態
    this.criticalState = new Map()
  }

  /**
   * 初始化關閉處理器
   * @returns {Promise<void>}
   * @protected
   */
  async _doInitialize () {
    this.logger.log('🛑 初始化關閉處理器')

    // 註冊 beforeunload 類似的處理（如果可能）
    this.setupShutdownDetection()

    this.logger.log('✅ 關閉處理器初始化完成')
  }

  /**
   * 設定關閉檢測
   * @private
   */
  setupShutdownDetection () {
    try {
      // 在 Manifest V3 中，我們無法直接監聽 Service Worker 的關閉
      // 但可以設定一些檢測機制

      // 監聽全域錯誤，可能表示即將關閉
      self.addEventListener('error', (event) => {
        this.logger.warn('🚨 全域錯誤可能表示系統即將關閉:', event.error)
      })

      // 監聽未處理的 Promise 拒絕
      self.addEventListener('unhandledrejection', (event) => {
        this.logger.warn('🚨 未處理 Promise 拒絕，系統可能不穩定:', event.reason)
      })

      this.logger.log('🔍 關閉檢測機制設定完成')
    } catch (error) {
      this.logger.error('❌ 設定關閉檢測失敗:', error)
    }
  }

  /**
   * 執行優雅關閉
   * @param {string} reason - 關閉原因
   * @param {number} timeout - 關閉超時時間（毫秒）
   * @returns {Promise<void>}
   */
  async gracefulShutdown (reason = 'manual', timeout = null) {
    if (this.shutdownInProgress) {
      this.logger.warn('⚠️ 關閉處理已在進行中')
      return
    }

    try {
      this.shutdownInProgress = true
      this.shutdownStartTime = Date.now()
      this.lastShutdownReason = reason
      const effectiveTimeout = timeout || this.shutdownTimeout

      this.logger.log(`🛑 開始優雅關閉 (原因: ${reason}, 超時: ${effectiveTimeout}ms)`)

      // 設定超時保護
      const shutdownPromise = this.performShutdown(reason)
      const timeoutPromise = new Promise((_resolve, reject) => {
        setTimeout(() => reject(new StandardError('UNKNOWN_ERROR', '關閉超時', {
          category: 'general'
        })), effectiveTimeout)
      })

      // 競賽條件：正常關閉 vs 超時
      await Promise.race([shutdownPromise, timeoutPromise])

      // 記錄關閉歷史
      this.shutdownHistory.push({
        reason,
        duration: Date.now() - this.shutdownStartTime,
        timestamp: Date.now(),
        success: true
      })

      this.logger.log(`✅ 優雅關閉完成 (耗時: ${Date.now() - this.shutdownStartTime}ms)`)
    } catch (error) {
      this.logger.error('❌ 優雅關閉失敗:', error)

      // 記錄失敗
      this.shutdownHistory.push({
        reason,
        duration: Date.now() - this.shutdownStartTime,
        timestamp: Date.now(),
        success: false,
        error: error.message
      })

      // 執行強制關閉
      await this.forceShutdown()

      throw error
    } finally {
      this.shutdownInProgress = false
      this.shutdownStartTime = null
    }
  }

  /**
   * 執行關閉流程
   * @param {string} reason - 關閉原因
   * @returns {Promise<void>}
   * @private
   */
  async performShutdown (reason) {
    // 1. 觸發關閉開始事件
    await this.emitShutdownEvent('SYSTEM.SHUTDOWN.STARTED', { reason })

    // 2. 保存關鍵狀態
    await this.saveCriticalState()

    // 3. 停止接受新請求
    await this.stopAcceptingRequests()

    // 4. 完成正在進行的操作
    await this.finishPendingOperations()

    // 5. 按順序關閉模組
    await this.shutdownModulesInSequence()

    // 6. 清理資源
    await this.cleanupResources()

    // 7. 觸發關閉完成事件
    await this.emitShutdownEvent('SYSTEM.SHUTDOWN.COMPLETED', { reason })
  }

  /**
   * 保存關鍵狀態
   * @returns {Promise<void>}
   * @private
   */
  async saveCriticalState () {
    try {
      this.logger.log('💾 保存關鍵狀態')

      // 收集各模組的關鍵狀態
      const moduleStates = {}

      for (const moduleName of this.shutdownSequence) {
        const module = this[moduleName]
        if (module && typeof module.getCriticalState === 'function') {
          try {
            moduleStates[moduleName] = await module.getCriticalState()
          } catch (error) {
            this.logger.error(`❌ 獲取模組狀態失敗: ${moduleName}`, error)
          }
        }
      }

      // 收集系統狀態
      const systemState = {
        shutdownReason: this.lastShutdownReason,
        shutdownTime: Date.now(),
        moduleStates,
        criticalState: Object.fromEntries(this.criticalState)
      }

      // 保存到 Chrome Storage
      await chrome.storage.local.set({
        system_shutdown_state: systemState,
        last_shutdown_time: Date.now()
      })

      this.logger.log('✅ 關鍵狀態保存完成')
    } catch (error) {
      this.logger.error('❌ 保存關鍵狀態失敗:', error)
      // 不拋出錯誤，繼續關閉流程
    }
  }

  /**
   * 停止接受新請求
   * @returns {Promise<void>}
   * @private
   */
  async stopAcceptingRequests () {
    try {
      this.logger.log('🚫 停止接受新請求')

      // 設定全域標誌表示系統正在關閉
      globalThis.systemShuttingDown = true

      // 通知訊息路由器停止處理新訊息
      if (this.messageRouter && typeof this.messageRouter.stopAcceptingMessages === 'function') {
        await this.messageRouter.stopAcceptingMessages()
      }

      this.logger.log('✅ 已停止接受新請求')
    } catch (error) {
      this.logger.error('❌ 停止接受新請求失敗:', error)
    }
  }

  /**
   * 完成正在進行的操作
   * @returns {Promise<void>}
   * @private
   */
  async finishPendingOperations () {
    try {
      this.logger.log('⏳ 等待正在進行的操作完成')

      // 等待各模組完成正在進行的操作
      const pendingPromises = []

      for (const moduleName of this.shutdownSequence) {
        const module = this[moduleName]
        if (module && typeof module.finishPendingOperations === 'function') {
          pendingPromises.push(
            module.finishPendingOperations().catch(error => {
              this.logger.error(`❌ 模組完成操作失敗: ${moduleName}`, error)
            })
          )
        }
      }

      // 等待所有操作完成，但有超時保護
      const timeoutPromise = new Promise(resolve =>
        setTimeout(resolve, 10000) // 10秒超時
      )

      await Promise.race([
        Promise.all(pendingPromises),
        timeoutPromise
      ])

      this.logger.log('✅ 正在進行的操作已完成或超時')
    } catch (error) {
      this.logger.error('❌ 等待操作完成失敗:', error)
    }
  }

  /**
   * 按順序關閉模組
   * @returns {Promise<void>}
   * @private
   */
  async shutdownModulesInSequence () {
    this.logger.log('🔄 按順序關閉模組')

    for (const moduleName of this.shutdownSequence) {
      const module = this[moduleName]

      if (!module) {
        this.logger.warn(`⚠️ 模組不存在: ${moduleName}`)
        continue
      }

      try {
        this.logger.log(`⏹️ 關閉模組: ${moduleName}`)

        if (typeof module.stop === 'function') {
          await module.stop()
        }

        this.logger.log(`✅ 模組關閉成功: ${moduleName}`)

        // 觸發模組關閉事件
        await this.emitShutdownEvent('MODULE.SHUTDOWN.SUCCESS', { moduleName })
      } catch (error) {
        this.logger.error(`❌ 模組關閉失敗: ${moduleName}`, error)

        // 觸發模組關閉失敗事件
        await this.emitShutdownEvent('MODULE.SHUTDOWN.FAILED', {
          moduleName,
          error: error.message
        })
      }
    }

    this.logger.log('✅ 模組序列關閉完成')
  }

  /**
   * 清理資源
   * @returns {Promise<void>}
   * @private
   */
  async cleanupResources () {
    try {
      this.logger.log('🧹 清理系統資源')

      // 清理全域變數
      if (globalThis.eventBus) {
        if (typeof globalThis.eventBus.destroy === 'function') {
          globalThis.eventBus.destroy()
        }
        globalThis.eventBus = null
      }

      if (globalThis.chromeBridge) {
        globalThis.chromeBridge = null
      }

      if (globalThis.backgroundStartTime) {
        delete globalThis.backgroundStartTime
      }

      if (globalThis.__bgInitPromise) {
        delete globalThis.__bgInitPromise
      }

      // 清理關鍵狀態
      this.criticalState.clear()

      this.logger.log('✅ 系統資源清理完成')
    } catch (error) {
      this.logger.error('❌ 清理系統資源失敗:', error)
    }
  }

  /**
   * 執行強制關閉
   * @returns {Promise<void>}
   */
  async forceShutdown () {
    try {
      this.logger.warn('⚠️ 執行強制關閉')

      // 觸發強制關閉事件
      await this.emitShutdownEvent('SYSTEM.FORCE.SHUTDOWN', {
        reason: this.lastShutdownReason || 'timeout'
      })

      // 立即清理資源
      await this.cleanupResources()

      this.logger.warn('⚠️ 強制關閉完成')
    } catch (error) {
      this.logger.error('❌ 強制關閉失敗:', error)
    }
  }

  /**
   * 觸發關閉事件
   * @param {string} eventType - 事件類型
   * @param {Object} data - 事件資料
   * @returns {Promise<void>}
   * @private
   */
  async emitShutdownEvent (eventType, data = {}) {
    try {
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        await this.eventBus.emit(eventType, {
          ...data,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error(`❌ 觸發關閉事件失敗: ${eventType}`, error)
    }
  }

  /**
   * 設定關鍵狀態
   * @param {string} key - 狀態鍵
   * @param {any} value - 狀態值
   */
  setCriticalState (key, value) {
    this.criticalState.set(key, value)
  }

  /**
   * 取得關鍵狀態
   * @param {string} key - 狀態鍵
   * @returns {any} 狀態值
   */
  getCriticalState (key) {
    return this.criticalState.get(key)
  }

  /**
   * 取得關閉狀態資訊
   * @returns {Object} 關閉狀態報告
   */
  getShutdownStatus () {
    return {
      shutdownInProgress: this.shutdownInProgress,
      shutdownStartTime: this.shutdownStartTime,
      lastShutdownReason: this.lastShutdownReason,
      shutdownHistory: [...this.shutdownHistory],
      shutdownSequence: [...this.shutdownSequence],
      criticalStateSize: this.criticalState.size,
      timestamp: Date.now()
    }
  }

  /**
   * 取得自訂健康狀態
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus () {
    const recentShutdowns = this.shutdownHistory.filter(
      shutdown => Date.now() - shutdown.timestamp < 300000 // 5分鐘內
    ).length

    return {
      shutdownInProgress: this.shutdownInProgress,
      recentShutdowns,
      hasModules: !!(this.eventCoordinator || this.messageRouter || this.pageMonitor || this.errorHandler),
      health: this.shutdownInProgress ? 'degraded' : 'healthy'
    }
  }
}

module.exports = ShutdownHandler
