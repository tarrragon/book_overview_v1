/**
 * @fileoverview Data Domain Coordinator - 資料管理領域協調器
 * @version v2.0.0 (v1.0 重構版)
 * @since 2025-08-15
 *
 * 負責功能：
 * - 協調 Readmoo 資料管理服務運作
 * - 處理與其他 Domain 的事件通訊
 * - 監控和優化資料處理效能
 * - 為未來多平台擴展保留架構彈性
 *
 * 設計考量：
 * - v1.0 階段專注 Readmoo 平台資料管理
 * - 事件骅動架構，避免直接服務依賴
 * - 統一錯誤處理和恢復機制
 * - 效能監控和自動調優
 * - 架構設計保留未來水平擴展能力
 *
 * 處理流程：
 * 1. 註冊 Readmoo 核心資料服務
 * 2. 建立服務間依賴關係
 * 3. 設定事件監聽器
 * 4. 啟動效能監控
 * 5. 協調 Readmoo 資料流程
 *
 * 使用情境：
 * - Background Service Worker 初始化時建立協調器
 * - 處理 Readmoo 平台資料提取完成後的驗證和標準化
 * - 管理 Readmoo 資料的遷移和備份恢復操作
 * - 為未來多平台擴展保留架構面向
 *
 * **v1.0 暫時擱置的功能**:
 * - 多平台同步和衝突解決 (等待未來實作)
 */

const BaseModule = require('src/background/lifecycle/base-module')
const { createLogger } = require('src/core/logging/Logger')

class DataDomainCoordinator extends BaseModule {
  /**
   * 初始化資料領域協調器
   * @param {EventBus} eventBus - 事件總線實例
   * @param {Object} dependencies - 依賴注入物件
   */
  constructor (eventBus, dependencies = {}) {
    super({
      eventBus,
      logger: dependencies.logger || createLogger('DataDomainCoordinator'),
      config: dependencies.config || {}
    })

    this.eventBus = eventBus
    this.logger = dependencies.logger || createLogger('DataDomainCoordinator')
    this.config = dependencies.config || {}

    // 資料管理服務實例 - v1.0 僅實作 Readmoo 所需服務
    this.services = {
      validation: null, // DataValidationService (已實作)
      migration: null, // SchemaMigrationService (未來實作)
      storageAdapter: null, // StorageAdapterService (未來實作)
      backupRecovery: null // BackupRecoveryService (未來實作)
    }

    // 活躍操作追蹤
    this.activeOperations = new Map()
    this.operationQueue = []

    // 效能監控
    this.performanceMetrics = {
      validationMetrics: { processed: 0, failed: 0, avgTime: 0 },
      syncMetrics: { operations: 0, conflicts: 0, avgDuration: 0 },
      storageMetrics: { reads: 0, writes: 0, errors: 0 }
    }

    // 配置管理
    this.defaultConfig = {
      maxConcurrentOperations: 5,
      operationTimeout: 300000, // 5 分鐘
      retryAttempts: 3,
      enablePerformanceMonitoring: true,
      autoCleanupInterval: 600000 // 10 分鐘
    }

    this.effectiveConfig = { ...this.defaultConfig, ...this.config }

    // 協調器狀態
    this.isInitialized = false
    this.isCoordinating = false
    this.lastMaintenanceRun = null
  }

  /**
   * 初始化協調器和所有服務
   */
  async initialize () {
    try {
      await this.log('開始初始化 Data Domain Coordinator')

      // 初始化所有資料管理服務
      await this.initializeDataServices()

      // 註冊事件監聽器
      await this.registerEventListeners()

      // 啟動效能監控
      if (this.effectiveConfig.enablePerformanceMonitoring) {
        await this.startPerformanceMonitoring()
      }

      // 啟動維護任務
      await this.startMaintenanceTasks()

      this.isInitialized = true
      this.isCoordinating = true

      await this.log('Data Domain Coordinator 初始化完成')

      // 發送初始化完成事件
      await this.emitEvent('DATA.DOMAIN.INITIALIZED', {
        services: Object.keys(this.services),
        activeOperations: this.activeOperations.size,
        config: this.effectiveConfig,
        timestamp: Date.now()
      })
    } catch (error) {
      this.initializationError = error
      await this.log(`Data Domain Coordinator 初始化失敗: ${error.message}`, 'error')
      throw error
    }
  }

  /**
   * 初始化 v1.0 資料管理服務 (僅 Readmoo 所需)
   */
  async initializeDataServices () {
    await this.log('初始化 v1.0 資料管理服務 - 專注 Readmoo')

    // 載入已實作的 DataValidationService
    const DataValidationService = require('./services/data-validation-service.js')
    this.services.validation = new DataValidationService(this.eventBus, this.effectiveConfig.validation)

    // v1.0 階段設定 - 部分服務暫時擱置
    // 未來實作的服務（使用 Mock 保持架構完整）
    this.services.migration = new MockService('SchemaMigrationService')
    this.services.synchronization = new MockService('SynchronizationOrchestrator')
    this.services.conflictResolution = new MockService('ConflictDetectionService')
    this.services.storageAdapter = new MockService('StorageAdapterService')
    this.services.backupRecovery = new MockService('BackupRecoveryService')

    // v1.0 暫時擱置的多平台服務（設為 null 代表擱置）

    // 初始化已實作的服務
    if (this.services.validation && typeof this.services.validation.initialize === 'function') {
      await this.services.validation.initialize()
      await this.log('DataValidationService 初始化完成')
    }

    // 記錄擱置的服務
    const shelvedServices = []
    for (const serviceName of shelvedServices) {
      await this.log(`${serviceName} 服務暫時擱置 (v1.0 不需要多平台功能)`)
    }

    const activeServices = Object.values(this.services).filter(s => s !== null).length
    await this.log(`v1.0 資料管理服務初始化完成，共 ${activeServices} 個啟用服務，2 個擱置服務`)
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners () {
    await this.log('註冊資料管理事件監聽器')

    // 平台檢測事件 - 來自 Platform Domain
    this.eventBus.on('PLATFORM.*.DETECTED', this.handlePlatformDetected.bind(this))
    this.eventBus.on('PLATFORM.*.ADAPTER.LOADED', this.handlePlatformAdapterLoaded.bind(this))

    // 提取完成事件 - 來自 Extraction Domain
    this.eventBus.on('EXTRACTION.*.COMPLETED', this.handleExtractionCompleted.bind(this))

    // 跨平台同步請求
    this.eventBus.on('DATA.CROSS_PLATFORM.SYNC.REQUESTED', this.handleCrossPlatformSyncRequest.bind(this))

    // 資料衝突事件
    this.eventBus.on('DATA.*.CONFLICT.DETECTED', this.handleDataConflict.bind(this))

    // 備份恢復請求
    this.eventBus.on('DATA.BACKUP.RECOVERY.REQUESTED', this.handleBackupRecoveryRequest.bind(this))

    // 資料遷移事件
    this.eventBus.on('DATA.MIGRATION.REQUIRED', this.handleMigrationRequired.bind(this))

    // 內部服務事件
    this.eventBus.on('DATA.*.VALIDATION.COMPLETED', this.handleValidationCompleted.bind(this))
    this.eventBus.on('DATA.*.VALIDATION.FAILED', this.handleValidationFailed.bind(this))

    await this.log('事件監聽器註冊完成')
  }

  /**
   * 處理平台檢測完成事件
   */
  async handlePlatformDetected (event) {
    const { platform, adapter } = event.data || {}
    const operationId = this.generateOperationId('PLATFORM_DETECTED')

    try {
      await this.log(`處理平台檢測事件: ${platform}`)

      // 記錄操作
      this.activeOperations.set(operationId, {
        type: 'PLATFORM_INITIALIZATION',
        platform,
        startTime: Date.now(),
        status: 'PROCESSING'
      })

      // 初始化平台特定的資料管理設定
      await this.initializePlatformDataManagement(platform, adapter)

      // 檢查是否需要資料遷移
      const migrationNeeded = await this.checkMigrationNeeded(platform)
      if (migrationNeeded) {
        await this.emitEvent('DATA.MIGRATION.REQUIRED', {
          platform,
          reason: 'PLATFORM_FIRST_TIME_DETECTION',
          operationId
        })
      }

      // 發送資料準備就緒事件
      await this.emitEvent('DATA.PLATFORM.READY', {
        platform,
        operationId,
        migrationNeeded,
        timestamp: Date.now()
      })

      // 完成操作
      this.completeOperation(operationId, 'SUCCESS')
    } catch (error) {
      await this.log(`處理平台檢測事件失敗: ${error.message}`, 'error')
      this.completeOperation(operationId, 'FAILED', error.message)

      await this.emitEvent('DATA.PLATFORM.INITIALIZATION.FAILED', {
        platform,
        operationId,
        error: error.message
      })
    }
  }

  /**
   * 處理平台適配器載入事件
   */
  async handlePlatformAdapterLoaded (event) {
    const { platform, adapter } = event.data || {}

    try {
      await this.log(`平台適配器載入: ${platform}`)

      // 註冊平台適配器到儲存服務
      if (this.services.storageAdapter && this.services.storageAdapter.registerPlatformAdapter) {
        await this.services.storageAdapter.registerPlatformAdapter(platform, adapter)
      }

      // 載入平台特定的驗證規則
      if (this.services.validation && this.services.validation.loadPlatformValidationRules) {
        await this.services.validation.loadPlatformValidationRules(platform)
      }
    } catch (error) {
      await this.log(`處理平台適配器載入失敗: ${error.message}`, 'error')
    }
  }

  /**
   * 處理提取完成事件，觸發資料驗證和標準化
   */
  async handleExtractionCompleted (event) {
    const { platform, books, extractionId } = event.data || {}
    const operationId = this.generateOperationId('EXTRACTION_PROCESSING')

    try {
      await this.log(`處理提取完成事件: ${platform}, 書籍數量: ${books?.length || 0}`)

      // 記錄操作
      this.activeOperations.set(operationId, {
        type: 'DATA_PROCESSING',
        platform,
        extractionId,
        bookCount: books?.length || 0,
        startTime: Date.now(),
        status: 'PROCESSING'
      })

      // 觸發資料驗證
      await this.emitEvent('DATA.VALIDATION.REQUESTED', {
        operationId,
        platform,
        books,
        source: 'EXTRACTION',
        extractionId
      })

      // 更新效能指標
      this.updatePerformanceMetrics('validation', 'requested', books?.length || 0)
    } catch (error) {
      await this.log(`處理提取完成事件失敗: ${error.message}`, 'error')
      this.completeOperation(operationId, 'FAILED', error.message)

      await this.emitEvent('DATA.PROCESSING.FAILED', {
        platform,
        extractionId,
        error: error.message,
        operationId
      })
    }
  }

  /**
   * 處理驗證完成事件
   */
  async handleValidationCompleted (event) {
    const { validationId, platform, qualityScore, validCount, normalizedBooks, operationId } = event.data || {}

    try {
      await this.log(`資料驗證完成: ${platform}, 品質分數: ${qualityScore}, 有效書籍: ${validCount}`)

      // 更新效能指標
      this.updatePerformanceMetrics('validation', 'completed', validCount, qualityScore)

      // 如果品質分數足夠高，觸發儲存
      if (qualityScore >= (this.effectiveConfig.minQualityScore || 70)) {
        await this.emitEvent('DATA.STORAGE.REQUESTED', {
          platform,
          books: normalizedBooks,
          source: 'VALIDATION',
          validationId,
          operationId
        })
      } else {
        await this.log(`資料品質分數過低 (${qualityScore}%)，需要人工檢查`, 'warn')

        await this.emitEvent('DATA.QUALITY.REVIEW.REQUIRED', {
          platform,
          qualityScore,
          validationId,
          operationId
        })
      }

      // 如果有對應的處理操作，更新狀態
      if (operationId && this.activeOperations.has(operationId)) {
        const operation = this.activeOperations.get(operationId)
        operation.validationCompleted = true
        operation.qualityScore = qualityScore
        operation.validCount = validCount
      }
    } catch (error) {
      await this.log(`處理驗證完成事件失敗: ${error.message}`, 'error')
    }
  }

  /**
   * 處理驗證失敗事件
   */
  async handleValidationFailed (event) {
    const { validationId, platform, error, operationId } = event.data || {}

    try {
      await this.log(`資料驗證失敗: ${platform}, 錯誤: ${error}`, 'error')

      // 更新效能指標
      this.updatePerformanceMetrics('validation', 'failed', 1)

      // 如果有對應的處理操作，標記為失敗
      if (operationId) {
        this.completeOperation(operationId, 'FAILED', `Validation failed: ${error}`)
      }

      // 發送錯誤通知
      await this.emitEvent('DATA.ERROR.NOTIFICATION', {
        type: 'VALIDATION_FAILURE',
        platform,
        error,
        validationId,
        operationId,
        timestamp: Date.now()
      })
    } catch (err) {
      await this.log(`處理驗證失敗事件失敗: ${err.message}`, 'error')
    }
  }

  /**
   * 處理跨平台同步請求 (v1.0 暫時擱置)
   */
  async handleCrossPlatformSyncRequest (event) {
    const { sourcePlatforms, targetPlatforms, syncOptions } = event.data || {}
    const syncId = this.generateSyncId()

    try {
      await this.log(`跨平台同步請求暫時擱置: ${sourcePlatforms} -> ${targetPlatforms}`, 'warn')

      // v1.0 階段不支援跨平台同步
      await this.emitEvent('DATA.SYNC.SHELVED', {
        syncId,
        sourcePlatforms,
        targetPlatforms,
        reason: 'V1_READMOO_ONLY',
        message: 'v1.0 階段僅支援 Readmoo 平台，跨平台同步功能暫時擱置',
        options: syncOptions,
        timestamp: Date.now()
      })

      // v1.0 採用手動JSON匯出入操作，不需要複雜同步邏輯
      await this.log('v1.0 採用簡單的手動JSON匯出入操作，不需要跨平台同步', 'info')

      return {
        success: false,
        reason: 'V1_READMOO_ONLY',
        message: '跨平台同步功能暫時擱置，v1.0 僅支援 Readmoo',
        syncId
      }
    } catch (error) {
      await this.log(`處理跨平台同步請求失敗: ${error.message}`, 'error')

      await this.emitEvent('DATA.SYNC.FAILED', {
        syncId,
        sourcePlatforms,
        targetPlatforms,
        error: error.message,
        reason: 'V1_READMOO_ONLY'
      })

      throw error
    }
  }

  /**
   * 處理資料衝突事件 (v1.0 暫時擱置)
   */
  async handleDataConflict (event) {
    const { conflictId, platform } = event.data || {}

    try {
      await this.log(`資料衝突處理暫時擱置: ${conflictId} on ${platform}`, 'warn')

      // v1.0 階段單一 Readmoo 平台不會有跨平台衝突
      if (platform === 'READMOO') {
        await this.log('Readmoo 平台內部資料衝突，等待未來衝突解決服務實作', 'info')

        await this.emitEvent('DATA.CONFLICT.READMOO.QUEUED', {
          conflictId,
          platform,
          reason: 'V1_CONFLICT_RESOLUTION_NOT_IMPLEMENTED',
          message: 'Readmoo 平台內部衝突，等待未來衝突解決服務實作',
          queuedAt: Date.now()
        })
      } else {
        await this.log(`非 Readmoo 平台衝突 (${platform})，v1.0 不支援跨平台衝突處理`, 'warn')

        await this.emitEvent('DATA.CONFLICT.CROSS_PLATFORM.SHELVED', {
          conflictId,
          platform,
          reason: 'V1_READMOO_ONLY',
          message: 'v1.0 僅支援 Readmoo，跨平台衝突處理暫時擱置',
          queuedAt: Date.now()
        })
      }

      // 如果未來實作了衝突解決服務，就恢復這段程式碼
      // v1.0 採用簡單的去重機制，不需要複雜衝突解決
      await this.log('v1.0 採用基於穩定ID的簡單去重機制處理重複書目', 'info')
    } catch (error) {
      await this.log(`處理資料衝突失敗: ${error.message}`, 'error')
    }
  }

  /**
   * 處理備份恢復請求
   */
  async handleBackupRecoveryRequest (event) {
    const { backupId, platforms, options } = event.data || {}

    try {
      await this.log(`處理備份恢復請求: ${backupId}`)

      // 委派給備份恢復服務
      if (this.services.backupRecovery && this.services.backupRecovery.restoreBackup) {
        await this.services.backupRecovery.restoreBackup(backupId, platforms, options)
      } else {
        await this.log('備份恢復服務尚未實作', 'warn')
      }
    } catch (error) {
      await this.log(`處理備份恢復請求失敗: ${error.message}`, 'error')
    }
  }

  /**
   * 處理遷移需求事件
   */
  async handleMigrationRequired (event) {
    const { platform, reason } = event.data || {}

    try {
      await this.log(`處理遷移需求: ${platform}, 原因: ${reason}`)

      // 委派給遷移服務
      if (this.services.migration && this.services.migration.migratePlatformData) {
        await this.services.migration.migratePlatformData(platform)
      } else {
        await this.log('遷移服務尚未實作', 'warn')
      }
    } catch (error) {
      await this.log(`處理遷移需求失敗: ${error.message}`, 'error')
    }
  }

  /**
   * 初始化平台特定的資料管理
   */
  async initializePlatformDataManagement (platform, adapter) {
    await this.log(`初始化平台資料管理: ${platform}`)

    // 設定平台特定的儲存適配器
    if (this.services.storageAdapter && this.services.storageAdapter.registerPlatformAdapter) {
      await this.services.storageAdapter.registerPlatformAdapter(platform, adapter)
    }

    // 設定平台特定的資料驗證規則
    if (this.services.validation && this.services.validation.loadPlatformValidationRules) {
      await this.services.validation.loadPlatformValidationRules(platform)
    }
  }

  /**
   * 檢查是否需要資料遷移
   */
  async checkMigrationNeeded (platform) {
    if (this.services.migration && this.services.migration.checkMigrationRequired) {
      return await this.services.migration.checkMigrationRequired(platform)
    }
    return false // 預設不需要遷移
  }

  /**
   * 啟動效能監控
   */
  async startPerformanceMonitoring () {
    await this.log('啟動效能監控')

    // 定期收集和報告效能指標
    setInterval(() => {
      this.reportPerformanceMetrics()
    }, this.effectiveConfig.performanceReportInterval || 60000) // 每分鐘報告一次
  }

  /**
   * 啟動維護任務
   */
  async startMaintenanceTasks () {
    await this.log('啟動維護任務')

    // 定期清理完成的操作
    setInterval(() => {
      this.cleanupCompletedOperations()
    }, this.effectiveConfig.autoCleanupInterval)
  }

  /**
   * 報告效能指標
   */
  async reportPerformanceMetrics () {
    const metrics = {
      activeOperations: this.activeOperations.size,
      queuedOperations: this.operationQueue.length,
      validationMetrics: this.performanceMetrics.validationMetrics,
      syncMetrics: this.performanceMetrics.syncMetrics,
      storageMetrics: this.performanceMetrics.storageMetrics,
      timestamp: Date.now()
    }

    await this.emitEvent('DATA.PERFORMANCE.METRICS', metrics)
  }

  /**
   * 清理完成的操作
   */
  async cleanupCompletedOperations () {
    const cutoffTime = Date.now() - (this.effectiveConfig.operationRetentionTime || 3600000) // 1小時

    let cleanedCount = 0
    for (const [operationId, operation] of this.activeOperations.entries()) {
      if (operation.status === 'COMPLETED' || operation.status === 'FAILED') {
        if (operation.endTime && operation.endTime < cutoffTime) {
          this.activeOperations.delete(operationId)
          cleanedCount++
        }
      }
    }

    if (cleanedCount > 0) {
      await this.log(`清理了 ${cleanedCount} 個已完成的操作`)
    }
  }

  /**
   * 更新效能指標
   */
  updatePerformanceMetrics (category, operation, count = 1, value = null) {
    if (!this.performanceMetrics[`${category}Metrics`]) {
      this.performanceMetrics[`${category}Metrics`] = {}
    }

    const metrics = this.performanceMetrics[`${category}Metrics`]

    switch (operation) {
      case 'requested':
      case 'completed':
        metrics.processed = (metrics.processed || 0) + count
        if (value !== null) {
          // 如果是第一次記錄，直接設定
          if (!metrics.avgTime || metrics.processed === count) {
            metrics.avgTime = value
          } else {
            // 正確計算平均值：累積總值除以計數
            const currentTotal = metrics.avgTime * (metrics.processed - count)
            metrics.avgTime = (currentTotal + value) / metrics.processed
          }
        }
        break
      case 'failed':
        metrics.failed = (metrics.failed || 0) + count
        break
    }
  }

  /**
   * 完成操作
   */
  completeOperation (operationId, status, error = null) {
    if (this.activeOperations.has(operationId)) {
      const operation = this.activeOperations.get(operationId)
      operation.status = status
      operation.endTime = Date.now()
      operation.duration = operation.endTime - operation.startTime
      if (error) {
        operation.error = error
      }
    }
  }

  /**
   * 生成操作ID
   */
  generateOperationId (type = 'OPERATION') {
    return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 生成同步ID
   */
  generateSyncId () {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 發送事件的包裝方法
   */
  async emitEvent (eventType, data) {
    if (this.eventBus && this.eventBus.emit) {
      await this.eventBus.emit(eventType, data)
    }
  }

  /**
   * 日誌記錄包裝方法
   */
  async log (message, level = 'info') {
    // 使用新的 Logger 系統
    switch (level) {
      case 'debug':
        this.logger.debug('DATA_DOMAIN_LOG', { message })
        break
      case 'info':
        this.logger.info('DATA_DOMAIN_LOG', { message })
        break
      case 'warn':
        this.logger.warn('DATA_DOMAIN_LOG', { message })
        break
      case 'error':
        this.logger.error('DATA_DOMAIN_LOG', { message })
        break
      default:
        this.logger.info('DATA_DOMAIN_LOG', { message })
    }
  }

  /**
   * 健康檢查
   */
  async healthCheck () {
    const healthStatus = {
      isInitialized: this.isInitialized,
      isCoordinating: this.isCoordinating,
      activeOperations: this.activeOperations.size,
      services: {},
      lastCheck: Date.now()
    }

    // 檢查各服務健康狀態
    for (const [name, service] of Object.entries(this.services)) {
      if (service && typeof service.healthCheck === 'function') {
        try {
          healthStatus.services[name] = await service.healthCheck()
        } catch (error) {
          healthStatus.services[name] = { status: 'ERROR', error: error.message }
        }
      } else {
        healthStatus.services[name] = { status: 'NOT_IMPLEMENTED' }
      }
    }

    this.lastHealthCheck = healthStatus
    return healthStatus
  }

  /**
   * 停止協調器
   */
  async stop () {
    try {
      await this.log('停止 Data Domain Coordinator')

      this.isCoordinating = false

      // 停止所有服務
      for (const [name, service] of Object.entries(this.services)) {
        if (service && typeof service.stop === 'function') {
          try {
            await service.stop()
            await this.log(`${name} 服務已停止`)
          } catch (error) {
            await this.log(`停止 ${name} 服務失敗: ${error.message}`, 'error')
          }
        }
      }

      // 清理資源
      this.activeOperations.clear()
      this.operationQueue.length = 0

      await this.log('Data Domain Coordinator 已停止')
    } catch (error) {
      await this.log(`停止 Data Domain Coordinator 失敗: ${error.message}`, 'error')
      throw error
    }
  }
}

/**
 * 模擬服務類別 - 用於尚未實作的服務
 * 提供基本的方法簽名，避免空指標錯誤
 */
class MockService {
  constructor (serviceName) {
    this.serviceName = serviceName
    this.isImplemented = false
  }

  async initialize () {
    // 模擬初始化
    return { status: 'MOCK_INITIALIZED', service: this.serviceName }
  }

  async healthCheck () {
    return { status: 'MOCK_SERVICE', implemented: false }
  }

  async stop () {
    // 模擬停止
    return { status: 'MOCK_STOPPED', service: this.serviceName }
  }
}

module.exports = DataDomainCoordinator
