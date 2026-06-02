/**
 * Service Worker 啟動處理器
 *
 * 負責功能：
 * - 處理 Service Worker 的啟動和重啟事件
 * - 協調系統模組的啟動順序
 * - 重新初始化關鍵服務和監聽器
 * - 恢復系統狀態和連接
 *
 * 設計考量：
 * - 基於 BaseModule 實現標準生命週期管理
 * - 支援模組間的依賴順序管理
 * - 實現啟動失敗的恢復機制
 * - 提供啟動性能監控和優化
 */

const BaseModule = require('./base-module')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

class StartupHandler extends BaseModule {
  constructor (dependencies = {}) {
    super(dependencies)

    // 啟動相關服務
    this.eventCoordinator = dependencies.eventCoordinator || null
    this.messageRouter = dependencies.messageRouter || null
    this.pageMonitor = dependencies.pageMonitor || null
    this.errorHandler = dependencies.errorHandler || null

    // 啟動狀態追蹤
    this.startupInProgress = false
    this.startupStartTime = null
    this.startupDuration = null
    this.lastStartupSuccess = null
    this.startupAttempts = 0
    this.startupErrors = []

    // 模組啟動順序（依賴關係）
    this.startupSequence = [
      'eventCoordinator', // 事件系統優先
      'errorHandler', // 錯誤處理次之
      'messageRouter', // 通訊系統
      'pageMonitor' // 頁面監控最後
    ]
  }

  /**
   * 初始化啟動處理器
   * @returns {Promise<void>}
   * @protected
   */
  async _doInitialize () {
    this.logger.log('[START] 初始化啟動處理器')

    // 初始化相關模組（但不啟動）
    const modules = [
      this.eventCoordinator,
      this.messageRouter,
      this.pageMonitor,
      this.errorHandler
    ]

    for (const module of modules) {
      if (module && typeof module.initialize === 'function') {
        try {
          await module.initialize()
        } catch (error) {
          this.logger.error(`[FAIL] 模組初始化失敗: ${module.constructor?.name}`, error)
          // 記錄錯誤但繼續初始化其他模組
        }
      }
    }

    this.logger.log('[OK] 啟動處理器初始化完成')
  }

  /**
   * 處理 Service Worker 啟動事件
   * @returns {Promise<void>}
   */
  async handleStartup () {
    if (this.startupInProgress) {
      this.logger.warn('[WARN] 啟動處理已在進行中，跳過重複處理')
      return
    }

    try {
      this.startupInProgress = true
      this.startupStartTime = Date.now()
      this.startupAttempts++

      this.logger.log(`[START] 開始處理 Service Worker 啟動 (嘗試 #${this.startupAttempts})`)

      // 清理上次啟動的狀態
      await this.cleanupPreviousState()

      // 按順序啟動模組
      await this.startupModulesInSequence()

      // 恢復系統狀態
      await this.restoreSystemState()

      // 觸發系統就緒事件
      await this.emitSystemReadyEvent()

      // 記錄啟動成功
      this.startupDuration = Date.now() - this.startupStartTime
      this.lastStartupSuccess = Date.now()

      this.logger.log(`[OK] Service Worker 啟動完成 (耗時: ${this.startupDuration}ms)`)
    } catch (error) {
      this.startupErrors.push({
        error: error.message,
        timestamp: Date.now(),
        attempt: this.startupAttempts
      })

      this.logger.error('[FAIL] Service Worker 啟動失敗:', error)

      // 觸發啟動失敗事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.STARTUP.FAILED', {
          error: error.message,
          attempt: this.startupAttempts,
          timestamp: Date.now()
        })
      }

      // 嘗試恢復
      await this.attemptRecovery()

      throw error
    } finally {
      this.startupInProgress = false
      this.startupStartTime = null
    }
  }

  /**
   * 清理上次啟動的狀態
   * @returns {Promise<void>}
   * @private
   */
  async cleanupPreviousState () {
    try {
      this.logger.log('清理上次啟動狀態')

      // 清理可能殘留的全域變數
      if (globalThis.backgroundStartTime) {
        delete globalThis.backgroundStartTime
      }

      if (globalThis.__bgInitPromise) {
        delete globalThis.__bgInitPromise
      }

      // 重置事件系統引用（如果存在）
      if (globalThis.eventBus) {
        globalThis.eventBus = null
      }

      if (globalThis.chromeBridge) {
        globalThis.chromeBridge = null
      }

      this.logger.log('[OK] 上次啟動狀態清理完成')
    } catch (error) {
      this.logger.error('[FAIL] 清理上次啟動狀態失敗:', error)
      // 不拋出錯誤，繼續啟動流程
    }
  }

  /**
   * 按順序啟動模組
   * @returns {Promise<void>}
   * @private
   */
  async startupModulesInSequence () {
    this.logger.log('按順序啟動模組')

    for (const moduleName of this.startupSequence) {
      const module = this[moduleName]

      if (!module) {
        this.logger.warn(`[WARN] 模組不存在: ${moduleName}`)
        continue
      }

      try {
        this.logger.log(`[START] 啟動模組: ${moduleName}`)

        if (typeof module.start === 'function') {
          await module.start()
        } else if (typeof module.initialize === 'function') {
          await module.initialize()
        }

        this.logger.log(`[OK] 模組啟動成功: ${moduleName}`)

        // 觸發模組啟動事件
        if (this.eventBus) {
          await this.eventBus.emit('MODULE.STARTUP.SUCCESS', {
            moduleName,
            timestamp: Date.now()
          })
        }
      } catch (error) {
        this.logger.error(`[FAIL] 模組啟動失敗: ${moduleName}`, error)

        // 觸發模組啟動失敗事件
        if (this.eventBus) {
          await this.eventBus.emit('MODULE.STARTUP.FAILED', {
            moduleName,
            error: error.message,
            timestamp: Date.now()
          })
        }

        // 根據模組的重要性決定是否繼續
        if (this.isCriticalModule(moduleName)) {
          const error = new Error(`關鍵模組啟動失敗: ${moduleName}`)
          error.code = ErrorCodes.OPERATION_ERROR
          error.details = { category: 'general' }
          throw error
        }
      }
    }

    this.logger.log('[OK] 模組序列啟動完成')
  }

  /**
   * 判斷是否為關鍵模組
   * @param {string} moduleName - 模組名稱
   * @returns {boolean}
   * @private
   */
  isCriticalModule (moduleName) {
    const criticalModules = ['eventCoordinator', 'errorHandler']
    return criticalModules.includes(moduleName)
  }

  /**
   * 恢復系統狀態
   * @returns {Promise<void>}
   * @private
   */
  async restoreSystemState () {
    try {
      this.logger.log('恢復系統狀態')

      // 檢查儲存的系統狀態
      const systemState = await chrome.storage.local.get([
        'isEnabled',
        'extractionSettings',
        'last_extraction'
      ])

      this.logger.log('系統狀態:', systemState)

      // 恢復關鍵配置
      if (systemState.isEnabled === false) {
        this.logger.warn('[WARN] 系統處於停用狀態')
      }

      // 觸發狀態恢復事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.STATE.RESTORED', {
          state: systemState,
          timestamp: Date.now()
        })
      }

      this.logger.log('[OK] 系統狀態恢復完成')
    } catch (error) {
      this.logger.error('[FAIL] 恢復系統狀態失敗:', error)
      // 不拋出錯誤，繼續啟動流程
    }
  }

  /**
   * 觸發系統就緒事件
   * @returns {Promise<void>}
   * @private
   */
  async emitSystemReadyEvent () {
    try {
      this.logger.log('觸發系統就緒事件')

      // 設定全域啟動時間
      globalThis.backgroundStartTime = Date.now()

      // 標記事件系統就緒
      if (this.eventBus && typeof this.eventBus.markReady === 'function') {
        this.eventBus.markReady()
      }

      // 觸發系統就緒事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.READY', {
          timestamp: Date.now(),
          version: chrome.runtime.getManifest().version,
          startupDuration: Date.now() - this.startupStartTime,
          attempt: this.startupAttempts
        })
      }

      this.logger.log('[OK] 系統就緒事件已觸發')
    } catch (error) {
      this.logger.error('[FAIL] 觸發系統就緒事件失敗:', error)
      throw error
    }
  }

  /**
   * 嘗試從啟動失敗中恢復
   * @returns {Promise<void>}
   * @private
   */
  async attemptRecovery () {
    try {
      this.logger.log('嘗試從啟動失敗中恢復')

      // 如果嘗試次數不多，可以重試
      if (this.startupAttempts < 3) {
        this.logger.log(`[RETRY] 準備重試啟動 (${this.startupAttempts}/3)`)

        // 等待短暫時間後重試
        await new Promise(resolve => setTimeout(resolve, 1000))

        // 遞迴重試
        await this.handleStartup()
      } else {
        this.logger.error('[FAIL] 啟動重試次數已達上限，啟用降級模式')

        // 啟用降級模式
        await this.enableDegradedMode()
      }
    } catch (error) {
      this.logger.error('[FAIL] 恢復嘗試失敗:', error)
      // 最後的錯誤處理
      await this.handleFinalFailure()
    }
  }

  /**
   * 啟用降級模式
   * @returns {Promise<void>}
   * @private
   */
  async enableDegradedMode () {
    try {
      this.logger.log('[WARN] 啟用系統降級模式')

      // 只啟動最基本的功能
      if (this.eventCoordinator && typeof this.eventCoordinator.start === 'function') {
        await this.eventCoordinator.start()
      }

      if (this.errorHandler && typeof this.errorHandler.start === 'function') {
        await this.errorHandler.start()
      }

      // 觸發降級模式事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.DEGRADED.MODE', {
          reason: 'startup_failure',
          timestamp: Date.now()
        })
      }

      this.logger.log('[WARN] 降級模式啟用完成')
    } catch (error) {
      this.logger.error('[FAIL] 啟用降級模式失敗:', error)
      throw error
    }
  }

  /**
   * 處理最終失敗
   * @returns {Promise<void>}
   * @private
   */
  async handleFinalFailure () {
    try {
      this.logger.error('系統啟動最終失敗')

      // 記錄詳細錯誤資訊
      const errorReport = {
        attempts: this.startupAttempts,
        errors: this.startupErrors,
        timestamp: Date.now()
      }

      // 嘗試儲存錯誤報告
      await chrome.storage.local.set({
        startup_failure_report: errorReport
      })

      this.logger.error('錯誤報告已儲存:', errorReport)
    } catch (error) {
      this.logger.error('[FAIL] 處理最終失敗時發生錯誤:', error)
    }
  }

  /**
   * 取得啟動狀態資訊
   * @returns {Object} 啟動狀態報告
   */
  getStartupStatus () {
    return {
      startupInProgress: this.startupInProgress,
      startupStartTime: this.startupStartTime,
      startupDuration: this.startupDuration,
      lastStartupSuccess: this.lastStartupSuccess,
      startupAttempts: this.startupAttempts,
      startupErrors: [...this.startupErrors],
      startupSequence: [...this.startupSequence],
      timestamp: Date.now()
    }
  }

  /**
   * 取得自訂健康狀態
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus () {
    const recentErrors = this.startupErrors.filter(
      error => Date.now() - error.timestamp < 300000 // 5分鐘內
    ).length

    return {
      startupInProgress: this.startupInProgress,
      lastStartupSuccess: this.lastStartupSuccess,
      recentErrors,
      hasModules: !!(this.eventCoordinator || this.messageRouter || this.pageMonitor || this.errorHandler),
      health: recentErrors > 2 ? 'unhealthy' : (this.lastStartupSuccess ? 'healthy' : 'degraded')
    }
  }
}

module.exports = StartupHandler
