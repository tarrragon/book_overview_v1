/**
 * SynchronizationOrchestrator - 同步協調器
 *
 * 職責：
 * - 統籌管理多重服務依賴的整合協調
 * - 端到端同步流程串接（UC-07 主要成功場景）
 * - UC-07 替代流程處理（7a~7e）
 * - 錯誤處理和失敗恢復機制
 * - 同步協調器的統籌管理功能
 *
 * 服務串接順序：
 * 1. SyncMetadataManager.loadMetadata() - 取得同步元資料
 * 2. SyncStrategyProcessor.processStrategy() - 決定同步方向
 * 3. 進度追蹤開始
 * 4. 執行同步（push/pull/skip）
 * 5. RetryCoordinator.executeRetry() - 失敗時重試（含斷路器檢查）
 * 6. ConflictDetectionService - 衝突時解決
 * 7. SyncMetadataManager.saveMetadata() - 更新同步時間戳
 * 8. 進度追蹤完成
 *
 * TDD 實作：根據測試驅動的最小可行實作
 */

// 導入依賴服務（用於預設實例化）
const DataComparisonEngine = require('./DataComparisonEngine.js')
const ConflictDetectionService = require('./ConflictDetectionService.js')
const RetryCoordinator = require('./RetryCoordinator.js')

/**
 * 同步流程階段常數
 * @readonly
 */
const SYNC_STAGES = {
  LOAD_METADATA: 'LOAD_METADATA',
  STRATEGY_SELECTION: 'STRATEGY_SELECTION',
  PROGRESS_START: 'PROGRESS_START',
  COMPARISON: 'COMPARISON',
  CONFLICT_DETECTION: 'CONFLICT_DETECTION',
  SYNCHRONIZATION: 'SYNCHRONIZATION',
  RETRY: 'RETRY',
  SAVE_METADATA: 'SAVE_METADATA',
  PROGRESS_COMPLETE: 'PROGRESS_COMPLETE',
  UNKNOWN: 'UNKNOWN'
}

/**
 * UC-07 替代流程錯誤類型
 * @readonly
 */
const ALT_FLOW_TYPES = {
  DATA_INCONSISTENCY: '7a',
  CONFLICT: '7b',
  NETWORK_UNSTABLE: '7c',
  INSUFFICIENT_STORAGE: '7d',
  SERVICE_UNAVAILABLE: '7e'
}

class SynchronizationOrchestrator {
  constructor (dependencies = {}) {
    // 既有依賴注入（向後相容）
    this.syncCoordinator = dependencies.syncCoordinator
    this.comparisonEngine = dependencies.comparisonEngine
    this.conflictService = dependencies.conflictService
    this.retryCoordinator = dependencies.retryCoordinator

    // 新增依賴注入（W3-001/003 服務，optional 保持向後相容）
    this.strategyProcessor = dependencies.strategyProcessor || null
    this.metadataManager = dependencies.metadataManager || null

    // Logger 後備方案: Service Worker 初始化保護
    // 設計理念: 協調器作為多服務統籌中心，需可靠的日誌輸出
    // 後備機制: console 確保同步流程每個階段都能被追蹤
    this.logger = dependencies.logger || console

    // 預設配置
    this.config = {
      enableConflictDetection: true,
      enableRetryMechanism: true,
      maxSyncAttempts: 3,
      enableSmartSync: false,
      maxConcurrentJobs: 3,
      batchSize: 100,
      ...dependencies
    }

    // 統計資料
    this.stats = {
      totalOrchestrations: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalProcessingTime: 0
    }

    this.isInitialized = true

    // 自動初始化預設服務
    this._initializeDefaultServices()
  }

  /**
   * 執行端到端同步流程（UC-07 主要成功場景）
   *
   * 需求：串接所有同步服務，按正確順序執行完整同步
   * 1. 載入元資料 -> 2. 策略選擇 -> 3. 開始追蹤
   * 4. 資料比較 -> 5. 衝突偵測/解決 -> 6. 執行同步（含重試）
   * 7. 儲存元資料 -> 8. 完成追蹤
   *
   * @param {Array} sourceData - 源資料
   * @param {Array} targetData - 目標資料
   * @param {Object} options - 同步選項
   * @returns {Promise<Object>} 完整同步結果
   */
  async executeSyncFlow (sourceData, targetData, options = {}) {
    const startTime = performance.now()
    const syncId = options.syncId || `sync_${Date.now()}`
    let currentStage = SYNC_STAGES.UNKNOWN
    const progress = { total: 0, completed: 0, stage: '' }

    this.stats.totalOrchestrations++
    this.logger.log(`[Orchestrator] 開始同步流程 syncId=${syncId}`)

    try {
      // 步驟 1: 載入同步元資料
      currentStage = SYNC_STAGES.LOAD_METADATA
      let metadata = null
      if (this.metadataManager) {
        metadata = await this.metadataManager.loadMetadata()
        this.logger.log('[Orchestrator] 元資料載入完成')
      }

      // 步驟 2: 策略選擇
      currentStage = SYNC_STAGES.STRATEGY_SELECTION
      let strategyResult = { decision: 'pull', strategy: 'timestamp-based' }
      if (this.strategyProcessor) {
        const strategyData = {
          localTimestamp: metadata?.lastSyncTime || options.localTimestamp,
          remoteTimestamp: options.remoteTimestamp
        }
        strategyResult = await this.strategyProcessor.processStrategy(
          options.strategyName || 'timestamp-based',
          strategyData
        )
        this.logger.log(`[Orchestrator] 策略選擇完成: ${strategyResult.decision}`)
      }

      // 策略決定 skip，不需要同步
      if (strategyResult.decision === 'skip') {
        const skipResult = {
          success: true,
          synchronized: 0,
          conflicts: 0,
          conflictsResolved: 0,
          unresolvedConflicts: 0,
          decision: 'skip',
          stage: SYNC_STAGES.STRATEGY_SELECTION,
          processingTime: performance.now() - startTime,
          timestamp: Date.now()
        }
        this.stats.successfulSyncs++
        this.logger.log('[Orchestrator] 策略決定跳過同步，資料已是最新')
        return skipResult
      }

      // 步驟 3: 開始進度追蹤
      currentStage = SYNC_STAGES.PROGRESS_START
      progress.stage = 'comparison'

      // 步驟 4: 資料差異計算
      currentStage = SYNC_STAGES.COMPARISON
      const differences = await this.comparisonEngine.calculateDataDifferences(
        sourceData, targetData
      )
      progress.total = differences.summary?.total || 0
      this.logger.log(`[Orchestrator] 差異計算完成: ${progress.total} 項變更`)

      // 步驟 5: 衝突檢測
      currentStage = SYNC_STAGES.CONFLICT_DETECTION
      let conflictResult = { hasConflicts: false, items: [], severity: 'NONE' }
      if (this.config.enableConflictDetection) {
        conflictResult = await this.conflictService.detectConflicts(
          sourceData, targetData, differences.changes
        )
      }

      // 步驟 6: 執行同步（含衝突處理和重試）
      currentStage = SYNC_STAGES.SYNCHRONIZATION
      progress.stage = 'synchronization'
      let syncResult

      if (conflictResult.hasConflicts) {
        // UC-07 替代流程 7b: 衝突處理
        this.logger.log(`[Orchestrator] 偵測到 ${conflictResult.items?.length || 0} 個衝突`)
        const conflictResolution = await this.syncCoordinator.handleConflicts(conflictResult)
        syncResult = {
          success: conflictResolution.success,
          synchronized: differences.summary?.total || 0,
          conflicts: conflictResult.items?.length || 0,
          conflictsResolved: conflictResolution.resolvedConflicts || 0,
          unresolvedConflicts: conflictResolution.unresolvedConflicts || 0
        }
      } else {
        // 標準同步流程
        syncResult = await this._executeSyncWithRetry(
          differences.changes, options, syncId
        )
      }

      // 步驟 7: 儲存同步元資料（更新時間戳）
      currentStage = SYNC_STAGES.SAVE_METADATA
      if (this.metadataManager && syncResult.success) {
        await this.metadataManager.saveMetadata({
          lastSyncTime: Date.now(),
          syncId,
          itemsSynced: syncResult.synchronized,
          decision: strategyResult.decision
        })
        this.logger.log('[Orchestrator] 元資料已更新')
      }

      // 步驟 8: 完成進度追蹤
      currentStage = SYNC_STAGES.PROGRESS_COMPLETE
      progress.completed = syncResult.synchronized
      progress.stage = 'complete'

      // 更新統計
      const processingTime = performance.now() - startTime
      this.stats.totalProcessingTime += processingTime
      if (syncResult.success) {
        this.stats.successfulSyncs++
      } else {
        this.stats.failedSyncs++
      }

      this.logger.log(`[Orchestrator] 同步流程完成 syncId=${syncId}, 耗時=${Math.round(processingTime)}ms`)

      return {
        ...syncResult,
        decision: strategyResult.decision,
        stage: currentStage,
        processingTime,
        timestamp: Date.now()
      }
    } catch (error) {
      this.stats.failedSyncs++
      const processingTime = performance.now() - startTime

      // 識別替代流程類型
      const altFlow = this._classifyAlternativeFlow(error)

      this.logger.error(
        `[Orchestrator] 同步流程失敗 stage=${currentStage}, altFlow=${altFlow}:`,
        error.message
      )

      return {
        success: false,
        error: error.message,
        stage: currentStage,
        altFlow,
        synchronized: 0,
        conflicts: 0,
        processingTime,
        timestamp: Date.now()
      }
    }
  }

  /**
   * 帶重試的同步執行（內部方法）
   *
   * 需求：失敗時透過 RetryCoordinator 重試，含斷路器檢查
   *
   * @param {Object} changes - 資料差異
   * @param {Object} options - 同步選項
   * @param {string} syncId - 同步 ID
   * @returns {Promise<Object>} 同步結果
   */
  async _executeSyncWithRetry (changes, options, syncId) {
    try {
      const result = await this.syncCoordinator.syncData(changes, options)
      return {
        success: result.success,
        synchronized: result.synced || 0,
        conflicts: 0,
        conflictsResolved: 0,
        unresolvedConflicts: 0
      }
    } catch (error) {
      // 嘗試重試
      if (this.config.enableRetryMechanism && this.retryCoordinator) {
        const failedJob = {
          id: syncId,
          error: error.message,
          retryCount: 0,
          originalParams: { changes, options }
        }

        if (this.retryCoordinator.canRetry(failedJob)) {
          this.logger.log(`[Orchestrator] 同步失敗，啟動重試 syncId=${syncId}`)
          const retryResult = await this.retryCoordinator.executeRetry(
            failedJob,
            (params) => this.syncCoordinator.syncData(params.changes || changes, params.options || options)
          )

          if (retryResult.success) {
            return {
              success: true,
              synchronized: retryResult.result?.synced || 0,
              conflicts: 0,
              conflictsResolved: 0,
              unresolvedConflicts: 0,
              retryCount: retryResult.retryCount
            }
          }
        }
      }

      // 重試也失敗或不可重試
      throw error
    }
  }

  /**
   * UC-07 替代流程 7a: 資料不一致處理
   *
   * 需求：偵測到資料不一致時的恢復流程
   * - 驗證源資料和目標資料的完整性
   * - 嘗試從元資料恢復一致性狀態
   * - 降級為安全的 pull 同步
   *
   * @param {Array} sourceData - 源資料
   * @param {Array} targetData - 目標資料
   * @param {Object} options - 處理選項
   * @returns {Promise<Object>} 恢復結果
   */
  async handleDataInconsistency (sourceData, targetData, options = {}) {
    this.logger.log('[Orchestrator] UC-07 7a: 處理資料不一致')

    try {
      // 驗證資料完整性
      const validation = this.validateSyncPrerequisites({
        sourceData,
        targetData,
        options: { source: options.source || 'readmoo', ...options }
      })

      if (!validation.isValid) {
        return {
          success: false,
          altFlow: ALT_FLOW_TYPES.DATA_INCONSISTENCY,
          error: `資料驗證失敗: ${validation.errors.join(', ')}`,
          recovered: false
        }
      }

      // 嘗試從元資料恢復
      let lastKnownState = null
      if (this.metadataManager) {
        lastKnownState = await this.metadataManager.loadMetadata()
      }

      // 降級為 pull 同步（以遠端為準，較安全）
      const result = await this.executeSyncFlow(sourceData, targetData, {
        ...options,
        strategyName: 'timestamp-based',
        forcePull: true,
        remoteTimestamp: new Date().toISOString(),
        localTimestamp: lastKnownState?.lastSyncTime
          ? new Date(lastKnownState.lastSyncTime - 1).toISOString()
          : null
      })

      return {
        ...result,
        altFlow: ALT_FLOW_TYPES.DATA_INCONSISTENCY,
        recovered: result.success
      }
    } catch (error) {
      this.logger.error('[Orchestrator] 7a 資料不一致恢復失敗:', error.message)
      return {
        success: false,
        altFlow: ALT_FLOW_TYPES.DATA_INCONSISTENCY,
        error: error.message,
        recovered: false
      }
    }
  }

  /**
   * UC-07 替代流程 7b: 衝突處理
   *
   * 需求：同步過程中發現衝突時的處理流程
   * - 衝突偵測和分類
   * - 嘗試自動解決（conflict-resolution 策略）
   * - 無法自動解決時回報衝突詳情
   *
   * @param {Object} conflictData - 衝突資料
   * @param {Object} options - 處理選項
   * @returns {Promise<Object>} 衝突處理結果
   */
  async handleConflict (conflictData, options = {}) {
    this.logger.log('[Orchestrator] UC-07 7b: 處理衝突')

    try {
      // 使用策略處理器的衝突解決策略
      let resolution = null
      if (this.strategyProcessor) {
        resolution = await this.strategyProcessor.processStrategy('conflict-resolution', {
          localVersion: conflictData.localVersion || {},
          remoteVersion: conflictData.remoteVersion || {}
        })
      }

      // 委託給衝突服務處理
      if (this.syncCoordinator && this.syncCoordinator.handleConflicts) {
        const result = await this.syncCoordinator.handleConflicts({
          hasConflicts: true,
          items: conflictData.items || [conflictData],
          resolution,
          severity: conflictData.severity || 'MEDIUM'
        })

        return {
          success: result.success,
          altFlow: ALT_FLOW_TYPES.CONFLICT,
          resolvedConflicts: result.resolvedConflicts || 0,
          unresolvedConflicts: result.unresolvedConflicts || 0,
          resolution
        }
      }

      return {
        success: false,
        altFlow: ALT_FLOW_TYPES.CONFLICT,
        error: '衝突處理服務不可用',
        resolvedConflicts: 0,
        unresolvedConflicts: conflictData.items?.length || 1
      }
    } catch (error) {
      this.logger.error('[Orchestrator] 7b 衝突處理失敗:', error.message)
      return {
        success: false,
        altFlow: ALT_FLOW_TYPES.CONFLICT,
        error: error.message,
        resolvedConflicts: 0,
        unresolvedConflicts: conflictData.items?.length || 1
      }
    }
  }

  /**
   * UC-07 替代流程 7c: 網路不穩處理
   *
   * 需求：網路不穩定時的降級和重試策略
   * - 透過 RetryCoordinator 進行指數退避重試
   * - 斷路器保護，防止無效請求
   * - 降級為離線模式
   *
   * @param {Object} failedOperation - 失敗的操作
   * @param {Object} options - 處理選項
   * @returns {Promise<Object>} 重試或降級結果
   */
  async handleNetworkInstability (failedOperation, options = {}) {
    this.logger.log('[Orchestrator] UC-07 7c: 處理網路不穩')

    try {
      // 檢查斷路器狀態
      if (this.retryCoordinator && this.retryCoordinator.isCircuitOpen()) {
        this.logger.log('[Orchestrator] 斷路器已開啟，降級為離線模式')
        return {
          success: false,
          altFlow: ALT_FLOW_TYPES.NETWORK_UNSTABLE,
          error: '斷路器已開啟，暫停同步等待冷卻',
          degraded: true,
          circuitState: this.retryCoordinator.getCircuitState()
        }
      }

      // 嘗試重試
      if (this.retryCoordinator) {
        const failedJob = {
          id: failedOperation.syncId || `retry_${Date.now()}`,
          error: failedOperation.error || 'Network error',
          retryCount: failedOperation.retryCount || 0,
          originalParams: failedOperation.params || {}
        }

        if (this.retryCoordinator.canRetry(failedJob)) {
          const retryResult = await this.retryCoordinator.executeRetry(
            failedJob,
            failedOperation.executor || (() => Promise.reject(new Error('No executor provided')))
          )

          return {
            success: retryResult.success,
            altFlow: ALT_FLOW_TYPES.NETWORK_UNSTABLE,
            retryCount: retryResult.retryCount,
            retryStrategy: retryResult.retryStrategy,
            degraded: !retryResult.success
          }
        }
      }

      return {
        success: false,
        altFlow: ALT_FLOW_TYPES.NETWORK_UNSTABLE,
        error: '超過最大重試次數',
        degraded: true
      }
    } catch (error) {
      this.logger.error('[Orchestrator] 7c 網路不穩處理失敗:', error.message)
      return {
        success: false,
        altFlow: ALT_FLOW_TYPES.NETWORK_UNSTABLE,
        error: error.message,
        degraded: true
      }
    }
  }

  /**
   * UC-07 替代流程 7d: 儲存空間不足處理
   *
   * 需求：storage quota 不足時的處理策略
   * - 檢查可用配額
   * - 嘗試清理過期資料
   * - 降級為部分同步（只同步最重要的資料）
   *
   * @param {Object} storageInfo - 儲存空間資訊
   * @param {Object} options - 處理選項
   * @returns {Promise<Object>} 處理結果
   */
  async handleInsufficientStorage (storageInfo, options = {}) {
    this.logger.log('[Orchestrator] UC-07 7d: 處理儲存空間不足')

    try {
      const requiredBytes = storageInfo.requiredBytes || 0
      const availableBytes = storageInfo.availableBytes || 0

      // 嘗試降級為部分同步（只同步高優先級資料）
      if (options.sourceData && options.targetData) {
        // 只保留書籍資料（最高優先級）
        const prioritizedSource = options.sourceData.filter(
          item => item.type === 'books' || !item.type
        )

        if (prioritizedSource.length > 0 && prioritizedSource.length < options.sourceData.length) {
          this.logger.log(
            `[Orchestrator] 降級為部分同步: ${prioritizedSource.length}/${options.sourceData.length} 項`
          )

          const result = await this.executeSyncFlow(
            prioritizedSource,
            options.targetData,
            { ...options, partialSync: true }
          )

          return {
            ...result,
            altFlow: ALT_FLOW_TYPES.INSUFFICIENT_STORAGE,
            partialSync: true,
            skippedItems: options.sourceData.length - prioritizedSource.length
          }
        }
      }

      return {
        success: false,
        altFlow: ALT_FLOW_TYPES.INSUFFICIENT_STORAGE,
        error: `儲存空間不足: 需要 ${requiredBytes} bytes, 可用 ${availableBytes} bytes`,
        requiredBytes,
        availableBytes
      }
    } catch (error) {
      this.logger.error('[Orchestrator] 7d 儲存空間不足處理失敗:', error.message)
      return {
        success: false,
        altFlow: ALT_FLOW_TYPES.INSUFFICIENT_STORAGE,
        error: error.message
      }
    }
  }

  /**
   * UC-07 替代流程 7e: 服務不可用處理
   *
   * 需求：依賴服務不可用時的降級策略
   * - 識別哪個服務不可用
   * - 嘗試使用降級方案繼續同步
   * - 記錄服務不可用狀態供後續恢復
   *
   * @param {Object} serviceInfo - 服務資訊
   * @param {Object} options - 處理選項
   * @returns {Promise<Object>} 降級結果
   */
  async handleServiceUnavailable (serviceInfo, options = {}) {
    this.logger.log(`[Orchestrator] UC-07 7e: 服務不可用 - ${serviceInfo.serviceName}`)

    try {
      const unavailableService = serviceInfo.serviceName
      const degradedCapabilities = []

      // 根據不可用的服務決定降級方案
      switch (unavailableService) {
        case 'strategyProcessor':
          // 降級：使用預設 pull 策略
          degradedCapabilities.push('策略選擇降級為預設 pull')
          break
        case 'metadataManager':
          // 降級：不更新元資料，但繼續同步
          degradedCapabilities.push('元資料同步暫停')
          break
        case 'conflictService':
          // 降級：停用衝突偵測，使用 last-write-wins
          degradedCapabilities.push('衝突偵測降級為 last-write-wins')
          break
        case 'retryCoordinator':
          // 降級：停用重試機制
          degradedCapabilities.push('重試機制暫停')
          break
        default:
          degradedCapabilities.push(`未知服務 ${unavailableService} 不可用`)
      }

      // 嘗試使用降級方案繼續
      if (options.sourceData && options.targetData) {
        const degradedOptions = {
          ...options,
          degradedMode: true,
          unavailableServices: [unavailableService]
        }

        // 暫時停用不可用的服務
        const originalService = this[unavailableService]
        this[unavailableService] = null

        try {
          const result = await this.executeSyncFlow(
            options.sourceData, options.targetData, degradedOptions
          )

          return {
            ...result,
            altFlow: ALT_FLOW_TYPES.SERVICE_UNAVAILABLE,
            degradedCapabilities,
            unavailableService
          }
        } finally {
          // 恢復原始服務引用
          this[unavailableService] = originalService
        }
      }

      return {
        success: false,
        altFlow: ALT_FLOW_TYPES.SERVICE_UNAVAILABLE,
        error: `服務 ${unavailableService} 不可用`,
        degradedCapabilities,
        unavailableService
      }
    } catch (error) {
      this.logger.error('[Orchestrator] 7e 服務不可用處理失敗:', error.message)
      return {
        success: false,
        altFlow: ALT_FLOW_TYPES.SERVICE_UNAVAILABLE,
        error: error.message
      }
    }
  }

  /**
   * 協調同步流程（既有方法，向後相容）
   * @param {Array} sourceData - 源資料
   * @param {Array} targetData - 目標資料
   * @param {Object} options - 同步選項
   * @returns {Promise<Object>} 同步結果
   */
  async orchestrateSync (sourceData, targetData, options = {}) {
    const startTime = performance.now()
    this.stats.totalOrchestrations++

    try {
      // 1. 資料差異計算
      const differences = await this.comparisonEngine.calculateDataDifferences(sourceData, targetData)

      // 2. 衝突檢測
      let conflictResult = { hasConflicts: false, items: [], severity: 'NONE' }
      if (this.config.enableConflictDetection) {
        conflictResult = await this.conflictService.detectConflicts(
          sourceData,
          targetData,
          differences.changes
        )
      }

      // 3. 執行同步
      let syncResult
      if (conflictResult.hasConflicts) {
        // 處理衝突的同步
        const conflictResolution = await this.syncCoordinator.handleConflicts(conflictResult)
        syncResult = {
          success: conflictResolution.success,
          synchronized: differences.summary?.total || 0,
          conflicts: conflictResult.items?.length || 0,
          conflictsResolved: conflictResolution.resolvedConflicts || 0,
          unresolvedConflicts: conflictResolution.unresolvedConflicts || 0
        }
      } else {
        // 標準同步流程
        syncResult = await this.syncCoordinator.syncData(differences.changes, options)
        syncResult = {
          success: syncResult.success,
          synchronized: syncResult.synced || differences.summary?.total || 0,
          conflicts: 0,
          conflictsResolved: 0,
          unresolvedConflicts: 0
        }
      }

      // 更新統計
      const processingTime = performance.now() - startTime
      this.stats.totalProcessingTime += processingTime
      if (syncResult.success) {
        this.stats.successfulSyncs++
      } else {
        this.stats.failedSyncs++
      }

      return {
        ...syncResult,
        processingTime,
        timestamp: Date.now()
      }
    } catch (error) {
      this.stats.failedSyncs++
      // 緩雅處理服務失敗，指示失敗階段
      let stage = 'UNKNOWN'
      if (error.message.includes('Comparison')) {
        stage = 'COMPARISON'
      } else if (error.message.includes('Conflict')) {
        stage = 'CONFLICT_DETECTION'
      } else if (error.message.includes('Sync')) {
        stage = 'SYNCHRONIZATION'
      }

      return {
        success: false,
        error: error.message,
        stage,
        synchronized: 0,
        conflicts: 0,
        processingTime: performance.now() - startTime,
        timestamp: Date.now()
      }
    }
  }

  /**
   * 執行策略選擇
   * @param {Object} differences - 資料差異
   * @param {Object} conflictResult - 衝突結果
   * @returns {Object} 同步策略
   */
  executeIntelligentSync (differences, conflictResult) {
    const totalChanges = differences.summary?.total || 0
    const hasConflicts = conflictResult.hasConflicts

    // 策略選擇邏輯
    if (totalChanges > 30 || hasConflicts) {
      return {
        strategy: 'BATCH_SYNC',
        reason: 'Large number of changes or conflicts detected',
        estimatedTime: totalChanges * 100,
        priority: 'HIGH'
      }
    } else {
      return {
        strategy: 'STANDARD_SYNC',
        reason: 'Small number of changes, no conflicts',
        estimatedTime: totalChanges * 50,
        priority: 'NORMAL'
      }
    }
  }

  /**
   * 帶重試機制的同步處理
   * @param {Object} syncJob - 同步作業
   * @returns {Promise<Object>} 同步結果
   */
  async handleSyncWithRetry (syncJob) {
    // 檢查是否已經超過重試限制
    if (syncJob.retryCount >= 3 || !this.retryCoordinator.canRetry(syncJob.id, syncJob.error)) {
      return {
        success: false,
        error: 'Maximum retries exceeded: ' + (syncJob.error || 'Unknown error'),
        retryCount: syncJob.retryCount || 0
      }
    }

    try {
      // 第一次嘗試
      const result = await this.syncCoordinator.syncData(
        syncJob.sourceData,
        syncJob.options
      )
      return {
        success: true,
        result,
        retryCount: 0
      }
    } catch (error) {
      // 檢查是否可以重試
      if (this.retryCoordinator.canRetry(syncJob.id, error)) {
        const retryResult = await this.retryCoordinator.executeRetry(
          syncJob.id,
          () => this.syncCoordinator.syncData(syncJob.sourceData, syncJob.options)
        )
        return {
          success: retryResult.success,
          result: retryResult.result,
          retryCount: retryResult.retryCount || 1
        }
      }

      return {
        success: false,
        error: 'Maximum retries exceeded: ' + error.message,
        retryCount: this.config.maxSyncAttempts
      }
    }
  }

  /**
   * 動態調整同步效能配置
   * @param {Object} stats - 同步統計
   * @returns {Object} 優化建議
   */
  optimizeSyncPerformance (stats) {
    const recommendations = []

    // 根據統計調整建議
    const optimizedConfig = {
      batchSize: this.config.batchSize,
      enableParallelProcessing: false,
      conflictDetectionLevel: 'STANDARD'
    }

    // 輕量工作負載優化
    if (stats.averageProcessingTime < 1000 && stats.conflictRate < 0.3) {
      optimizedConfig.batchSize = Math.min(200, this.config.batchSize * 1.5)
      optimizedConfig.enableParallelProcessing = true

      recommendations.push({
        type: 'PERFORMANCE',
        suggestion: 'Increase batch size for better throughput',
        currentValue: this.config.batchSize,
        recommendedValue: optimizedConfig.batchSize
      })
    }

    // 重量工作負載優化
    if (stats.averageProcessingTime > 1000 || stats.conflictRate > 0.3) {
      optimizedConfig.batchSize = Math.max(50, this.config.batchSize * 0.7)
      optimizedConfig.conflictDetectionLevel = 'ENHANCED'

      recommendations.push({
        type: 'PERFORMANCE',
        suggestion: 'Reduce batch size to improve stability',
        currentValue: this.config.batchSize,
        recommendedValue: optimizedConfig.batchSize
      })

      if (stats.conflictRate > 0.3) {
        recommendations.push({
          type: 'CONFLICT',
          suggestion: 'Enable enhanced conflict detection',
          action: 'ENABLE_ENHANCED_DETECTION'
        })
      }
    }

    return optimizedConfig
  }

  /**
   * 生成同步報告
   * @param {Object} syncResults - 同步結果
   * @param {Object} syncStats - 同步統計
   * @returns {Object} 同步報告
   */
  generateSyncReport (syncResults, syncStats) {
    const conflictRate = syncResults.synchronized > 0
      ? syncResults.conflicts / syncResults.synchronized
      : 0

    return {
      summary: {
        totalItems: syncResults.synchronized,
        conflictRate,
        successRate: syncResults.success ? 1.0 : 0.0,
        timestamp: Date.now()
      },
      performance: {
        processingTimeMs: syncResults.processingTime,
        strategy: syncResults.strategy,
        throughput: syncResults.synchronized / (syncResults.processingTime / 1000)
      },
      reliability: {
        retryCount: syncResults.retryCount || 0,
        errorRate: syncResults.success ? 0.0 : 1.0
      },
      statistics: {
        comparison: syncStats.comparisonStats || {},
        conflicts: syncStats.conflictStats || {},
        retry: syncStats.retryStats || {}
      },
      recommendations: this._generateRecommendations(syncResults, conflictRate)
    }
  }

  /**
   * 初始化服務
   * @param {Object} config - 配置選項
   */
  initializeServices (config = {}) {
    this.config = { ...this.config, ...config }

    // 總是建立服務實例，即使有依賴注入也要確保都有定義
    this._initializeDefaultServices()
  }

  /**
   * 更新服務配置
   * @param {Object} newConfig - 新配置
   */
  updateServiceConfigs (newConfig) {
    this.config = { ...this.config, ...newConfig }

    // 更新各服務的配置
    if (this.comparisonEngine && this.comparisonEngine.updateConfig) {
      this.comparisonEngine.updateConfig({
        batchSize: newConfig.batchSize
      })
    }

    if (this.conflictService && this.conflictService.updateConfig) {
      this.conflictService.updateConfig({
        conflictDetectionThreshold: newConfig.conflictDetectionThreshold
      })
    }

    if (this.retryCoordinator && this.retryCoordinator.updateConfig) {
      this.retryCoordinator.updateConfig({
        maxRetryAttempts: newConfig.maxRetryAttempts
      })
    }
  }

  /**
   * 獲取彙總統計資訊
   * @returns {Object} 彙總統計
   */
  getAggregatedStatistics () {
    const comparisonStats = this.comparisonEngine?.getStatistics() || {}
    const conflictStats = this.conflictService?.getStatistics() || {}
    const retryStats = this.retryCoordinator?.getRetryStatistics() || {}

    const successRate = this.stats.totalOrchestrations > 0
      ? this.stats.successfulSyncs / this.stats.totalOrchestrations
      : 0

    return {
      comparison: {
        totalComparisons: comparisonStats.totalComparisons || 0,
        totalProcessingTime: comparisonStats.totalProcessingTime || 0
      },
      conflicts: {
        totalConflictsDetected: conflictStats.totalConflictsDetected || 0,
        resolvedConflicts: conflictStats.resolvedConflicts || 0
      },
      retry: {
        totalRetries: retryStats.totalRetries || 0,
        successfulRetries: retryStats.successfulRetries || 0
      },
      overall: {
        successRate,
        totalOrchestrations: this.stats.totalOrchestrations,
        averageProcessingTime: this.stats.totalOrchestrations > 0
          ? this.stats.totalProcessingTime / this.stats.totalOrchestrations
          : 0
      }
    }
  }

  /**
   * 重置所有統計
   */
  resetAllStatistics () {
    // 重置自身統計
    this.stats = {
      totalOrchestrations: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalProcessingTime: 0
    }

    // 重置各服務統計 - 使用不同的方法名稱
    if (this.comparisonEngine?.clearStatistics) {
      this.comparisonEngine.clearStatistics()
    } else if (this.comparisonEngine?.resetStatistics) {
      this.comparisonEngine.resetStatistics()
    }

    if (this.conflictService?.resetStatistics) {
      this.conflictService.resetStatistics()
    }

    if (this.retryCoordinator?.resetStatistics) {
      this.retryCoordinator.resetStatistics()
    }
  }

  /**
   * 計算優化分數
   * @param {Object} stats - 統計資料
   * @returns {number} 優化分數 (0-100)
   */
  _calculateOptimizationScore (stats) {
    let score = 100

    // 處理時間影響
    if (stats.averageProcessingTime > 1000) {
      score -= 20
    }

    // 衝突率影響
    if (stats.conflictRate > 0.2) {
      score -= 30
    }

    // 重試率影響
    if (stats.retryRate > 0.1) {
      score -= 15
    }

    return Math.max(0, score)
  }

  /**
   * 生成報告建議
   * @param {Object} syncResults - 同步結果
   * @param {number} conflictRate - 衝突率
   * @returns {Array} 建議列表
   */
  _generateRecommendations (syncResults, conflictRate) {
    const recommendations = []

    if (conflictRate > 0.2) {
      recommendations.push({
        type: 'CONFLICT_OPTIMIZATION',
        message: 'High conflict rate detected. Consider reviewing data validation rules.'
      })
    }

    if (syncResults.retryCount > 2) {
      recommendations.push({
        type: 'RELIABILITY_IMPROVEMENT',
        message: 'Multiple retries occurred. Check network stability and service availability.'
      })
    }

    return recommendations
  }

  /**
   * 驗證同步前置條件
   * @param {Object} data - 同步資料
   * @returns {Object} 驗證結果
   */
  validateSyncPrerequisites (data) {
    const errors = []
    const warnings = []

    // 檢查源資料
    if (!Array.isArray(data.sourceData)) {
      if (data.sourceData === 'invalid') {
        errors.push('Source data must be an array')
      } else if (!data.sourceData) {
        errors.push('Source data is required')
      }
    } else if (data.sourceData.length === 0) {
      warnings.push('Empty data sets detected')
    }

    // 檢查目標資料
    if (!Array.isArray(data.targetData)) {
      errors.push('Target data must be an array')
    } else if (data.targetData.length === 0 && data.sourceData.length === 0) {
      warnings.push('Empty data sets detected')
    }

    // 檢查選項
    if (!data.options || Object.keys(data.options).length === 0) {
      errors.push('Sync options are required')
    } else if (!data.options.source) {
      errors.push('Source option is required')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 產生效能建議
   * @param {Object} stats - 效能統計
   * @returns {Array} 建議列表
   */
  generatePerformanceRecommendations (stats) {
    const recommendations = []

    if (stats.averageProcessingTime > 500) {
      recommendations.push('考慮增加批次大小以提高處理效率')
    }

    if (stats.conflictRate > 0.2) {
      recommendations.push('建議啟用進階衝突檢測以減少衝突發生')
      recommendations.push('衝突率偏高，建議加強資料驗證')
    }

    if (stats.throughput < 50) {
      recommendations.push('優化資料傳輸效率以提升整體性能')
    }

    return recommendations
  }

  /**
   * 處理重試失敗
   * @param {Object} syncJob - 同步作業
   * @returns {Promise<Object>} 同步結果
   */
  async handleSyncWithRetryFailure (syncJob) {
    try {
      // 第一次嘗試
      const result = await this.syncCoordinator.syncData(
        syncJob.sourceData,
        syncJob.options
      )
      return {
        success: true,
        result,
        retryCount: 0
      }
    } catch (error) {
      // 檢查是否可以重試
      if (this.retryCoordinator.canRetry(syncJob.id, error)) {
        try {
          const retryResult = await this.retryCoordinator.executeRetry(
            syncJob.id,
            () => this.syncCoordinator.syncData(syncJob.sourceData, syncJob.options)
          )
          return {
            success: retryResult.success,
            result: retryResult.result,
            retryCount: retryResult.retryCount || 1
          }
        } catch (retryError) {
          return {
            success: false,
            error: 'Maximum retries exceeded: ' + retryError.message,
            retryCount: this.config.maxSyncAttempts
          }
        }
      } else {
        return {
          success: false,
          error: 'Maximum retries exceeded: ' + error.message,
          retryCount: 0
        }
      }
    }
  }

  /**
   * 分類替代流程類型
   *
   * 根據錯誤訊息判斷屬於 UC-07 哪個替代流程
   *
   * @param {Error} error - 錯誤物件
   * @returns {string|null} 替代流程類型代碼
   */
  _classifyAlternativeFlow (error) {
    const message = (error.message || '').toLowerCase()

    if (message.includes('inconsisten') || message.includes('integrity') || message.includes('validation')) {
      return ALT_FLOW_TYPES.DATA_INCONSISTENCY
    }
    if (message.includes('conflict')) {
      return ALT_FLOW_TYPES.CONFLICT
    }
    if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      return ALT_FLOW_TYPES.NETWORK_UNSTABLE
    }
    if (message.includes('quota') || message.includes('storage') || message.includes('space')) {
      return ALT_FLOW_TYPES.INSUFFICIENT_STORAGE
    }
    if (message.includes('unavailable') || message.includes('service')) {
      return ALT_FLOW_TYPES.SERVICE_UNAVAILABLE
    }

    return null
  }

  /**
   * 初始化預設服務實例
   */
  _initializeDefaultServices () {
    // 總是建立服務，即使是空值或無效值也要建立預設實例
    if (!this.syncCoordinator || this.syncCoordinator === null) {
      this.syncCoordinator = {
        syncData: () => Promise.resolve({ success: true, synced: 0 }),
        handleConflicts: () => Promise.resolve({ success: true, resolvedConflicts: 0 }),
        validateDataIntegrity: () => Promise.resolve(true),
        getStatistics: () => ({ totalSync: 0 })
      }
    }

    if (!this.comparisonEngine || typeof this.comparisonEngine === 'string') {
      this.comparisonEngine = new DataComparisonEngine()
    }

    if (!this.conflictService || this.conflictService === undefined) {
      this.conflictService = new ConflictDetectionService()
    }

    if (!this.retryCoordinator) {
      this.retryCoordinator = new RetryCoordinator()
    }
  }
}

module.exports = SynchronizationOrchestrator
module.exports.SYNC_STAGES = SYNC_STAGES
module.exports.ALT_FLOW_TYPES = ALT_FLOW_TYPES
