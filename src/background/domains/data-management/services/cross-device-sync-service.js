/**
 * 跨設備同步服務
 *
 * 負責功能：
 * - UC-05跨設備同步工作流程協調
 * - 整合匯出/匯入服務實現完整同步鏈
 * - 同步狀態管理和進度追蹤
 * - 衝突檢測與解決
 *
 * 設計考量：
 * - 基於現有Export/Import服務建構
 * - 事件驅動架構，支援進度通知
 * - 支援乾執行和預覽功能
 * - 完整的錯誤處理和狀態恢復
 */

const {
  SYNC_EVENTS,
  SYNC_STATES,
  SYNC_STRATEGIES,
  EVENT_PRIORITIES
} = require('src/background/constants/module-constants')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

class CrossDeviceSyncService {
  constructor (dependencies = {}) {
    this.eventBus = dependencies.eventBus || null

    // Logger 後備方案: Background Service 初始化保護
    // 設計理念: 跨設備同步服務作為資料同步協調中心，負責記錄同步過程和跨設備通訊
    // 執行環境: Service Worker 初始化階段，依賴注入可能不完整
    // 後備機制: console 確保同步事件和跨設備協調過程能被追蹤
    // 風險考量: 理想上應確保 Logger 完整可用，此為過渡性保護
    this.logger = dependencies.logger || console
    this.exportService = dependencies.exportService || null
    this.importService = dependencies.importService || null
    this.conflictResolver = dependencies.conflictResolver || null
    this.progressTracker = dependencies.progressTracker || null

    this.state = {
      initialized: false,
      active: false,
      syncing: false
    }

    this.activeSyncs = new Map()
    this.syncHistory = []
    this.registeredListeners = new Map()

    this.stats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalDataTransferred: 0,
      averageSyncTime: 0
    }
  }

  async initialize () {
    if (this.state.initialized) return

    try {
      this.logger.log('初始化跨設備同步服務')
      await this.registerEventListeners()
      this.state.initialized = true
      this.logger.log('[OK] 跨設備同步服務初始化完成')
    } catch (error) {
      this.logger.error('[FAIL] 初始化跨設備同步服務失敗:', error)
      throw error
    }
  }

  async start () {
    if (!this.state.initialized || this.state.active) return

    this.state.active = true
    this.logger.log('[OK] 跨設備同步服務啟動完成')
  }

  async stop () {
    if (!this.state.active) return

    await this.unregisterEventListeners()
    await this.cancelAllActiveSyncs()
    this.state.active = false
    this.state.syncing = false
    this.logger.log('[OK] 跨設備同步服務停止完成')
  }

  async startSync (options = {}) {
    const syncId = this.generateSyncId()
    const startTime = Date.now()

    try {
      this.logger.log(`開始同步作業: ${syncId}`)

      const syncJob = {
        id: syncId,
        state: SYNC_STATES.INITIALIZING,
        startTime,
        options: {
          strategy: options.strategy || SYNC_STRATEGIES.MERGE,
          dryRun: options.dryRun || false,
          source: options.source || 'local',
          target: options.target || 'remote',
          conflictResolution: options.conflictResolution || 'auto'
        },
        progress: {
          phase: 'initializing',
          percentage: 0,
          message: '準備同步作業'
        }
      }

      this.activeSyncs.set(syncId, syncJob)
      await this.emitSyncEvent(SYNC_EVENTS.SYNC_STARTED, { syncId, options })

      // Phase 1: 初始化和驗證
      await this.updateSyncState(syncId, SYNC_STATES.VALIDATING, {
        phase: 'validating',
        percentage: 10,
        message: '驗證同步參數'
      })

      const validationResult = await this.validateSyncOptions(options)
      if (!validationResult.valid) {
        const error = new Error(`同步參數驗證失敗: ${validationResult.message}`)
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = { category: 'validation', timestamp: Date.now() }
        throw error
      }

      // Phase 2: 匯出階段
      await this.updateSyncState(syncId, SYNC_STATES.EXPORTING, {
        phase: 'exporting',
        percentage: 20,
        message: '匯出本地資料'
      })

      const exportResult = await this.performExport(syncId, options)

      // Phase 3: 傳輸階段 (模擬)
      await this.updateSyncState(syncId, SYNC_STATES.TRANSFERRING, {
        phase: 'transferring',
        percentage: 40,
        message: '準備傳輸資料'
      })

      const transferResult = await this.simulateTransfer(exportResult)

      // Phase 4: 匯入階段
      await this.updateSyncState(syncId, SYNC_STATES.IMPORTING, {
        phase: 'importing',
        percentage: 60,
        message: '匯入資料到目標設備'
      })

      const importResult = await this.performImport(syncId, transferResult, options)

      // Phase 5: 驗證階段
      await this.updateSyncState(syncId, SYNC_STATES.VERIFYING, {
        phase: 'verifying',
        percentage: 80,
        message: '驗證同步完整性'
      })

      const verifyResult = await this.verifySyncIntegrity(exportResult, importResult)

      // Phase 6: 完成
      await this.updateSyncState(syncId, SYNC_STATES.COMPLETED, {
        phase: 'completed',
        percentage: 100,
        message: '同步作業完成'
      })

      const syncResult = {
        syncId,
        success: true,
        duration: Date.now() - startTime,
        exportResult,
        importResult,
        verifyResult,
        stats: this.calculateSyncStats(exportResult, importResult)
      }

      await this.finalizeSyncJob(syncId, syncResult)
      this.logger.log(`[OK] 同步作業完成: ${syncId}`)

      return syncResult
    } catch (error) {
      await this.handleSyncError(syncId, error)
      throw error
    }
  }

  async performExport (syncId, options) {
    if (!this.exportService) {
      const error = new Error('Export service not available')
      error.code = ErrorCodes.CHROME_ERROR
      error.details = { category: 'general', timestamp: Date.now() }
      throw error
    }

    // todo: 整合實際的export service
    return {
      data: { books: [] }, // 權宜方案：空資料
      format: 'json',
      size: 0,
      timestamp: Date.now()
    }
  }

  async simulateTransfer (exportResult) {
    // 模擬網路傳輸延遲
    await this.delay(100)

    // todo: 實作真實的檔案傳輸邏輯
    return {
      success: true,
      data: exportResult.data,
      transferTime: 100,
      method: 'manual' // 手動檔案傳輸
    }
  }

  async performImport (syncId, transferResult, options) {
    if (!this.importService) {
      const error = new Error('Import service not available')
      error.code = ErrorCodes.CHROME_ERROR
      error.details = { category: 'general', timestamp: Date.now() }
      throw error
    }

    // todo: 整合實際的import service
    return {
      imported: 0,
      skipped: 0,
      conflicts: 0,
      errors: 0
    }
  }

  async verifySyncIntegrity (exportResult, importResult) {
    // todo: 實作完整的資料完整性驗證
    return {
      valid: true,
      issues: [],
      checksum: 'mock-checksum'
    }
  }

  async updateSyncState (syncId, state, progress) {
    const syncJob = this.activeSyncs.get(syncId)
    if (syncJob) {
      syncJob.state = state
      syncJob.progress = { ...syncJob.progress, ...progress }

      await this.emitSyncEvent(SYNC_EVENTS.SYNC_PROGRESS, {
        syncId,
        state,
        progress: syncJob.progress
      })
    }
  }

  async validateSyncOptions (options) {
    // todo: 實作完整的選項驗證
    return {
      valid: true,
      message: 'Valid options'
    }
  }

  calculateSyncStats (exportResult, importResult) {
    return {
      exported: exportResult.data?.books?.length || 0,
      imported: importResult.imported || 0,
      dataSize: exportResult.size || 0
    }
  }

  async finalizeSyncJob (syncId, result) {
    const syncJob = this.activeSyncs.get(syncId)
    if (syncJob) {
      syncJob.result = result
      syncJob.endTime = Date.now()

      // 移至歷史記錄
      this.syncHistory.push({
        ...syncJob,
        duration: syncJob.endTime - syncJob.startTime
      })

      this.activeSyncs.delete(syncId)
      this.stats.totalSyncs++
      this.stats.successfulSyncs++

      await this.emitSyncEvent(SYNC_EVENTS.SYNC_COMPLETED, {
        syncId,
        result
      })
    }
  }

  async handleSyncError (syncId, error) {
    const syncJob = this.activeSyncs.get(syncId)
    if (syncJob) {
      syncJob.state = SYNC_STATES.FAILED
      syncJob.error = error.message
      syncJob.endTime = Date.now()

      this.syncHistory.push({
        ...syncJob,
        duration: syncJob.endTime - syncJob.startTime
      })

      this.activeSyncs.delete(syncId)
      this.stats.totalSyncs++
      this.stats.failedSyncs++

      await this.emitSyncEvent(SYNC_EVENTS.SYNC_FAILED, {
        syncId,
        error: error.message
      })
    }

    this.logger.error(`[FAIL] 同步作業失敗 ${syncId}:`, error)
  }

  async cancelAllActiveSyncs () {
    const syncIds = Array.from(this.activeSyncs.keys())
    for (const syncId of syncIds) {
      await this.cancelSync(syncId, 'Service stopping')
    }
  }

  async cancelSync (syncId, reason = 'User cancelled') {
    const syncJob = this.activeSyncs.get(syncId)
    if (!syncJob) return false

    syncJob.state = SYNC_STATES.CANCELLED
    syncJob.cancelReason = reason
    syncJob.endTime = Date.now()

    this.activeSyncs.delete(syncId)

    await this.emitSyncEvent(SYNC_EVENTS.SYNC_CANCELLED, {
      syncId,
      reason
    })

    this.logger.log(`[STOP] 取消同步作業: ${syncId} - ${reason}`)
    return true
  }

  generateSyncId () {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  }

  async delay (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async emitSyncEvent (eventName, data) {
    if (this.eventBus) {
      await this.eventBus.emit(eventName, {
        timestamp: Date.now(),
        ...data
      })
    }
  }

  async registerEventListeners () {
    if (!this.eventBus) return

    const listeners = [
      {
        event: SYNC_EVENTS.SYNC_REQUEST,
        handler: this.handleSyncRequest.bind(this),
        priority: EVENT_PRIORITIES.HIGH
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

  async handleSyncRequest (event) {
    try {
      const { options, requestId } = event.data || {}
      const result = await this.startSync(options)

      if (this.eventBus) {
        await this.eventBus.emit(SYNC_EVENTS.SYNC_RESPONSE, {
          requestId,
          result
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 處理同步請求失敗:', error)
    }
  }

  getSyncStatus (syncId) {
    const syncJob = this.activeSyncs.get(syncId)
    if (!syncJob) return null

    return {
      id: syncJob.id,
      state: syncJob.state,
      progress: syncJob.progress,
      startTime: syncJob.startTime,
      options: syncJob.options
    }
  }

  getAllActiveSyncs () {
    return Array.from(this.activeSyncs.values()).map(sync => ({
      id: sync.id,
      state: sync.state,
      progress: sync.progress,
      startTime: sync.startTime
    }))
  }

  getSyncHistory (limit = 10) {
    return this.syncHistory.slice(-limit).reverse()
  }

  getStatus () {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      syncing: this.state.syncing,
      activeSyncs: this.activeSyncs.size,
      stats: { ...this.stats }
    }
  }

  getHealthStatus () {
    const successRate = this.stats.totalSyncs > 0
      ? (this.stats.successfulSyncs / this.stats.totalSyncs)
      : 1.0

    return {
      service: 'CrossDeviceSyncService',
      healthy: this.state.initialized && successRate >= 0.8,
      status: this.state.active ? 'active' : 'inactive',
      metrics: {
        totalSyncs: this.stats.totalSyncs,
        successRate: (successRate * 100).toFixed(2) + '%',
        activeSyncs: this.activeSyncs.size,
        averageSyncTime: this.stats.averageSyncTime
      }
    }
  }
}

module.exports = CrossDeviceSyncService
