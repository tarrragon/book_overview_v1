const { ErrorCodes } = require('src/core/errors/ErrorCodes')
const SchemaMigrationService = require('src/data-management/SchemaMigrationService')
const BaseModule = require('src/background/lifecycle/base-module')
const EventBus = require('src/core/event-bus')
const { StandardError } = require('src/core/errors/StandardError')

describe('Schema Migration Service', () => {
  let eventBus
  let logger
  let config
  let migrationService
  let mockMigrationExecutor
  let mockBackupManager
  let mockStorageAdapter

  // Test data helper functions
  const createTestSchemaVersions = () => ({
    v1_0_0: {
      version: '1.0.0',
      books: [
        { id: 'book1', title: 'Test Book', progress: 50 }
      ]
    },
    v1_1_0: {
      version: '1.1.0',
      books: [
        {
          id: 'book1',
          title: 'Test Book',
          progress: 50,
          lastUpdated: '2025-08-16T10:00:00Z'
        }
      ]
    },
    v2_0_0: {
      version: '2.0.0',
      books: [
        {
          id: 'book1',
          title: 'Test Book',
          readingProgress: 50,
          lastUpdated: '2025-08-16T10:00:00Z',
          platform: 'readmoo',
          tags: ['fiction']
        }
      ]
    }
  })

  const createTestMigrations = () => ({
    '1.0.0_to_1.1.0': {
      steps: [
        {
          type: 'ADD_FIELD',
          field: 'lastUpdated',
          defaultValue: null,
          validation: 'iso_date_string'
        }
      ]
    },
    '1.1.0_to_2.0.0': {
      steps: [
        {
          type: 'RENAME_FIELD',
          oldField: 'progress',
          newField: 'readingProgress'
        },
        {
          type: 'ADD_FIELD',
          field: 'platform',
          defaultValue: 'unknown'
        },
        {
          type: 'ADD_FIELD',
          field: 'tags',
          defaultValue: []
        }
      ]
    }
  })

  const createErrorScenarios = () => ({
    CORRUPTED_DATA: {
      books: [
        { id: 'book1', title: null, progress: 'invalid' },
        { title: 'No ID Book', progress: 75 }
      ]
    },
    INSUFFICIENT_STORAGE: {
      availableSpace: 100,
      requiredSpace: 500,
      currentDataSize: 200
    },
    NETWORK_INTERRUPTION: {
      simulateDisconnection: true,
      reconnectAfter: 5000
    }
  })

  // Mock classes
  class MockMigrationExecutor {
    constructor () {
      this.executionResults = new Map()
      this.shouldFail = false
      this.executionDelay = 0
    }

    async executeStep (step, data) {
      await new Promise(resolve => setTimeout(resolve, this.executionDelay))

      if (this.shouldFail) {
        throw (() => { const error = new Error('Simulated migration execution failure'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
      }

      switch (step.type) {
        case 'ADD_FIELD':
          return this.simulateAddField(step, data)
        case 'RENAME_FIELD':
          return this.simulateRenameField(step, data)
        case 'DELETE_FIELD':
          return this.simulateDeleteField(step, data)
        default:
          throw (() => { const error = new Error(`Unsupported migration step: ${step.type}`); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
      }
    }

    simulateAddField (step, data) {
      return {
        success: true,
        modifiedRecords: data.books ? data.books.length : 0,
        step: step.type
      }
    }

    simulateRenameField (step, data) {
      return {
        success: true,
        modifiedRecords: data.books ? data.books.length : 0,
        step: step.type
      }
    }

    simulateDeleteField (step, data) {
      return {
        success: true,
        modifiedRecords: data.books ? data.books.length : 0,
        step: step.type
      }
    }
  }

  class MockBackupManager {
    constructor () {
      this.backups = new Map()
      this.shouldFailBackup = false
      this.backupDelay = 0
    }

    async createBackup (version, data) {
      await new Promise(resolve => setTimeout(resolve, this.backupDelay))

      if (this.shouldFailBackup) {
        throw (() => { const error = new Error('Simulated backup creation failure'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
      }

      const backupId = `backup_${version}_${Date.now()}`
      this.backups.set(backupId, {
        id: backupId,
        version,
        data: JSON.parse(JSON.stringify(data)),
        timestamp: new Date().toISOString(),
        size: JSON.stringify(data).length
      })

      return backupId
    }

    async restoreBackup (backupId) {
      if (this.shouldFailBackup) {
        throw (() => { const error = new Error('Simulated backup restore failure'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
      }

      const backup = this.backups.get(backupId)
      if (!backup) {
        throw (() => { const error = new Error(`Backup not found: ${backupId}`); error.code = ErrorCodes.NOT_FOUND_ERROR; error.details = { category: 'testing' }; return error })()
      }

      return backup.data
    }
  }

  class MockStorageAdapter {
    constructor () {
      this.storage = new Map()
      this.shouldFailStorage = false
      this.storageDelay = 0
    }

    async get (key) {
      await new Promise(resolve => setTimeout(resolve, this.storageDelay))

      if (this.shouldFailStorage) {
        throw (() => { const error = new Error('Simulated storage read failure'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
      }

      return this.storage.get(key)
    }

    async set (key, value) {
      await new Promise(resolve => setTimeout(resolve, this.storageDelay))

      if (this.shouldFailStorage) {
        throw (() => { const error = new Error('Simulated storage write failure'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
      }

      this.storage.set(key, JSON.parse(JSON.stringify(value)))
    }

    async remove (key) {
      await new Promise(resolve => setTimeout(resolve, this.storageDelay))

      if (this.shouldFailStorage) {
        throw (() => { const error = new Error('Simulated storage remove failure'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
      }

      return this.storage.delete(key)
    }
  }

  beforeEach(() => {
    eventBus = new EventBus()
    logger = {
      log: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }
    config = {
      migration: {
        batchSize: 100,
        timeoutMs: 30000,
        retryAttempts: 3
      }
    }

    mockMigrationExecutor = new MockMigrationExecutor()
    mockBackupManager = new MockBackupManager()
    mockStorageAdapter = new MockStorageAdapter()
  })

  // 1. Construction & Initialization (8 tests)
  describe('Construction & Initialization', () => {
    test('建構函數參數驗證 - eventBus 必填', () => {
      expect(() => {
        const service = new SchemaMigrationService()
      }).toThrowError(
        expect.objectContaining({
          code: 'REQUIRED_FIELD_MISSING',
          message: 'EventBus is required',
          details: expect.objectContaining({
            category: 'ui'
          })
        })
      )
    })

    test('建構函數參數驗證 - eventBus 無效', () => {
      expect(() => {
        const service = new SchemaMigrationService({})
      }).toThrowError(
        expect.objectContaining({
          code: 'REQUIRED_FIELD_MISSING',
          message: 'EventBus is required',
          details: expect.objectContaining({
            category: 'ui'
          })
        })
      )
    })

    test('建構函數參數驗證 - logger 必填', () => {
      expect(() => {
        const service = new SchemaMigrationService(eventBus)
      }).toThrowError(
        expect.objectContaining({
          code: 'REQUIRED_FIELD_MISSING',
          message: 'Logger is required',
          details: expect.objectContaining({
            category: 'ui'
          })
        })
      )
    })

    test('建構函數參數驗證 - config 必填', () => {
      expect(() => {
        const service = new SchemaMigrationService(eventBus, logger)
      }).toThrowError(
        expect.objectContaining({
          code: 'REQUIRED_FIELD_MISSING',
          message: 'Config is required',
          details: expect.objectContaining({
            category: 'ui'
          })
        })
      )
    })

    test('BaseModule 繼承正確性', () => {
      migrationService = new SchemaMigrationService(eventBus, logger, config)
      expect(migrationService).toBeInstanceOf(BaseModule)
    })

    test('預設配置載入和合併機制', () => {
      const customConfig = { migration: { batchSize: 200 } }
      migrationService = new SchemaMigrationService(eventBus, logger, customConfig)

      expect(migrationService.config.migration.batchSize).toBe(200)
      expect(migrationService.config.migration.timeoutMs).toBeDefined()
    })

    test('事件監聽器自動註冊', () => {
      const spy = jest.spyOn(eventBus, 'on')
      migrationService = new SchemaMigrationService(eventBus, logger, config)

      expect(spy).toHaveBeenCalledWith('MIGRATION.START', expect.any(Function))
      expect(spy).toHaveBeenCalledWith('MIGRATION.ROLLBACK', expect.any(Function))
    })

    test('依賴注入正確性', async () => {
      migrationService = new SchemaMigrationService(eventBus, logger, config, {
        migrationExecutor: mockMigrationExecutor,
        backupManager: mockBackupManager,
        storageAdapter: mockStorageAdapter
      })

      await migrationService.initialize()

      expect(migrationService.migrationExecutor).toBe(mockMigrationExecutor)
      expect(migrationService.backupManager).toBe(mockBackupManager)
      expect(migrationService.storageAdapter).toBe(mockStorageAdapter)
    })
  })

  // 2. Schema Version Management (12 tests)
  describe('Schema Version Management', () => {
    beforeEach(async () => {
      migrationService = new SchemaMigrationService(eventBus, logger, config, {
        migrationExecutor: mockMigrationExecutor,
        backupManager: mockBackupManager,
        storageAdapter: mockStorageAdapter
      })
      await migrationService.initialize()
    })

    test('當前版本號檢測和讀取', async () => {
      const result = await migrationService.getCurrentSchemaVersion()
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    test('目標版本設定和驗證', async () => {
      const result = await migrationService.setTargetVersion('2.0.0')
      expect(result.success).toBe(true)
      expect(result.targetVersion).toBe('2.0.0')
    })

    test('版本相容性檢查演算法', async () => {
      const isCompatible = await migrationService.checkVersionCompatibility('1.0.0', '2.0.0')
      expect(typeof isCompatible).toBe('boolean')
    })

    test('版本升級路徑計算', async () => {
      const path = await migrationService.calculateUpgradePath('1.0.0', '2.0.0')
      expect(Array.isArray(path)).toBe(true)
      expect(path.length).toBeGreaterThan(0)
    })

    test('版本降級路徑驗證', async () => {
      const path = await migrationService.calculateDowngradePath('2.0.0', '1.0.0')
      expect(Array.isArray(path)).toBe(true)
    })

    test('無效版本號處理', async () => {
      await expect(migrationService.setTargetVersion('invalid.version'))
        .rejects.toMatchObject({
          code: 'INVALID_INPUT_ERROR',
          message: expect.any(String),
          details: expect.any(Object)
        })
    })

    test('版本歷史記錄管理', async () => {
      const history = await migrationService.getVersionHistory()
      expect(Array.isArray(history)).toBe(true)
    })

    test('版本鎖定機制', async () => {
      await migrationService.acquireVersionLock('1.0.0')

      await expect(migrationService.acquireVersionLock('1.0.0'))
        .rejects.toMatchObject({
          code: 'TEST_ERROR',
          message: expect.any(String),
          details: expect.any(Object)
        })
    })

    test('版本資訊快取機制', async () => {
      const version1 = await migrationService.getCurrentSchemaVersion()
      const version2 = await migrationService.getCurrentSchemaVersion()

      expect(version1).toBe(version2)
      expect(migrationService.getCacheStats().hits).toBeGreaterThan(0)
    })

    test('跨平台版本同步', async () => {
      const result = await migrationService.syncVersionAcrossPlatforms()
      expect(result.success).toBe(true)
      expect(result.syncedPlatforms).toBeDefined()
    })

    test('版本相依性解析', async () => {
      const dependencies = await migrationService.resolveVersionDependencies('2.0.0')
      expect(Array.isArray(dependencies)).toBe(true)
    })

    test('緊急版本標記處理', async () => {
      const result = await migrationService.markVersionAsEmergency('1.5.0', 'Critical security fix')
      expect(result.success).toBe(true)
      expect(result.emergencyFlag).toBe(true)
    })
  })

  // 3. Migration Planning & Validation (10 tests)
  describe('Migration Planning & Validation', () => {
    beforeEach(async () => {
      migrationService = new SchemaMigrationService(eventBus, logger, config, {
        migrationExecutor: mockMigrationExecutor,
        backupManager: mockBackupManager,
        storageAdapter: mockStorageAdapter
      })
      await migrationService.initialize()
    })

    test('Migration 步驟自動規劃', async () => {
      const plan = await migrationService.createMigrationPlan('1.0.0', '2.0.0')
      expect(plan.steps).toBeDefined()
      expect(Array.isArray(plan.steps)).toBe(true)
      expect(plan.steps.length).toBeGreaterThan(0)
    })

    test('依賴關係驗證和排序', async () => {
      const plan = await migrationService.createMigrationPlan('1.0.0', '2.0.0')
      const result = await migrationService.validateDependencies(plan)

      expect(result.isValid).toBe(true)
      expect(result.sortedSteps).toBeDefined()
    })

    test('資料備份需求評估', async () => {
      const assessment = await migrationService.assessBackupRequirements('1.0.0', '2.0.0')
      expect(assessment.requiresBackup).toBeDefined()
      expect(assessment.estimatedBackupSize).toBeDefined()
    })

    test('資源需求估算', async () => {
      const estimation = await migrationService.estimateResourceRequirements('1.0.0', '2.0.0')
      expect(estimation.memory).toBeDefined()
      expect(estimation.time).toBeDefined()
      expect(estimation.storage).toBeDefined()
    })

    test('風險評估和緩解策略', async () => {
      const assessment = await migrationService.assessMigrationRisks('1.0.0', '2.0.0')
      expect(assessment.risks).toBeDefined()
      expect(assessment.mitigationStrategies).toBeDefined()
    })

    test('預檢查機制', async () => {
      const preCheck = await migrationService.performPreMigrationCheck('1.0.0', '2.0.0')
      expect(preCheck.dataIntegrity).toBeDefined()
      expect(preCheck.permissions).toBeDefined()
      expect(preCheck.storage).toBeDefined()
    })

    test('Migration 計劃序列化儲存', async () => {
      const plan = await migrationService.createMigrationPlan('1.0.0', '2.0.0')
      const result = await migrationService.saveMigrationPlan(plan)

      expect(result.success).toBe(true)
      expect(result.planId).toBeDefined()
    })

    test('計劃驗證失敗處理', async () => {
      const invalidPlan = { steps: [] }

      await expect(migrationService.validateMigrationPlan(invalidPlan))
        .rejects.toMatchObject({
          code: 'INVALID_INPUT_ERROR',
          message: expect.any(String),
          details: expect.any(Object)
        })
    })

    test('多步驟 Migration 協調', async () => {
      const plan = await migrationService.createMigrationPlan('1.0.0', '2.0.0')
      const coordination = await migrationService.coordinateMultiStepMigration(plan)

      expect(coordination.executionOrder).toBeDefined()
      expect(coordination.checkpoints).toBeDefined()
    })

    test('緊急停止條件檢查', async () => {
      const conditions = await migrationService.checkEmergencyStopConditions()
      expect(conditions.shouldStop).toBeDefined()
      expect(conditions.reasons).toBeDefined()
    })
  })

  // 4. Migration Execution (15 tests)
  describe('Migration Execution', () => {
    beforeEach(async () => {
      migrationService = new SchemaMigrationService(eventBus, logger, config, {
        migrationExecutor: mockMigrationExecutor,
        backupManager: mockBackupManager,
        storageAdapter: mockStorageAdapter
      })
      await migrationService.initialize()
    })

    test('單步驟 Migration 執行', async () => {
      const step = { type: 'ADD_FIELD', field: 'newField', defaultValue: null }
      const testData = createTestSchemaVersions().v1_0_0

      const result = await migrationService.executeMigrationStep(step, testData)

      expect(result.success).toBe(true)
      expect(result.modifiedRecords).toBeGreaterThan(0)
    })

    test('多步驟 Migration 協調執行', async () => {
      const plan = await migrationService.createMigrationPlan('1.0.0', '2.0.0')
      const result = await migrationService.executeMultiStepMigration(plan)

      expect(result.success).toBe(true)
      expect(result.completedSteps).toBeDefined()
    })

    test('進度追蹤和事件發送', async () => {
      const progressSpy = jest.fn()
      eventBus.on('MIGRATION.PROGRESS', progressSpy)

      const step = { type: 'ADD_FIELD', field: 'newField', defaultValue: null }
      const testData = createTestSchemaVersions().v1_0_0

      await migrationService.executeMigrationStep(step, testData)

      expect(progressSpy).toHaveBeenCalled()
    })

    test('資料轉換處理 - 欄位新增', async () => {
      const step = { type: 'ADD_FIELD', field: 'newField', defaultValue: 'default' }
      const testData = createTestSchemaVersions().v1_0_0

      const result = await migrationService.executeMigrationStep(step, testData)

      expect(result.success).toBe(true)
      expect(result.step).toBe('ADD_FIELD')
    })

    test('資料轉換處理 - 欄位重命名', async () => {
      const step = { type: 'RENAME_FIELD', oldField: 'progress', newField: 'readingProgress' }
      const testData = createTestSchemaVersions().v1_1_0

      const result = await migrationService.executeMigrationStep(step, testData)

      expect(result.success).toBe(true)
      expect(result.step).toBe('RENAME_FIELD')
    })

    test('批次處理大量資料', async () => {
      const largeDataset = {
        books: Array.from({ length: 1000 }, (_, i) => ({
          id: `book${i}`,
          title: `Book ${i}`,
          progress: Math.floor(Math.random() * 100)
        }))
      }

      const step = { type: 'ADD_FIELD', field: 'newField', defaultValue: null }
      const result = await migrationService.executeMigrationStep(step, largeDataset)

      expect(result.success).toBe(true)
      expect(result.modifiedRecords).toBe(1000)
    })

    test('Migration 執行暫停/恢復', async () => {
      const plan = await migrationService.createMigrationPlan('1.0.0', '2.0.0')

      const executionPromise = migrationService.executeMultiStepMigration(plan)
      await migrationService.pauseMigration()

      const pauseResult = await migrationService.getMigrationStatus()
      expect(pauseResult.status).toBe('paused')

      await migrationService.resumeMigration()
      const finalResult = await executionPromise

      expect(finalResult.success).toBe(true)
    })

    test('執行時錯誤捕獲和處理', async () => {
      mockMigrationExecutor.shouldFail = true

      const step = { type: 'ADD_FIELD', field: 'newField', defaultValue: null }
      const testData = createTestSchemaVersions().v1_0_0

      const result = await migrationService.executeMigrationStep(step, testData)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    test('執行逾時處理', async () => {
      mockMigrationExecutor.executionDelay = 35000 // 超過 timeout

      const step = { type: 'ADD_FIELD', field: 'newField', defaultValue: null }
      const testData = createTestSchemaVersions().v1_0_0

      await expect(migrationService.executeMigrationStep(step, testData))
        .rejects.toMatchObject({
          code: 'TIMEOUT_ERROR',
          message: expect.any(String),
          details: expect.any(Object)
        })
    }, 40000) // 設定測試超時為 40 秒

    test('併發控制和資源鎖定', async () => {
      const plan1 = await migrationService.createMigrationPlan('1.0.0', '1.1.0')
      const plan2 = await migrationService.createMigrationPlan('1.1.0', '2.0.0')

      const execution1Promise = migrationService.executeMultiStepMigration(plan1)

      await expect(migrationService.executeMultiStepMigration(plan2))
        .rejects.toMatchObject({
          code: 'TEST_ERROR',
          message: expect.any(String),
          details: expect.any(Object)
        })

      await execution1Promise
    })

    test('執行狀態持久化', async () => {
      const plan = await migrationService.createMigrationPlan('1.0.0', '2.0.0')

      const executionPromise = migrationService.executeMultiStepMigration(plan)
      const status = await migrationService.getMigrationStatus()

      expect(status.status).toBe('running')
      expect(status.currentStep).toBeDefined()

      await executionPromise
    })

    test('中間檢查點建立', async () => {
      const plan = await migrationService.createMigrationPlan('1.0.0', '2.0.0')
      const result = await migrationService.executeMultiStepMigration(plan)

      expect(result.checkpoints).toBeDefined()
      expect(result.checkpoints.length).toBeGreaterThan(0)
    })

    test('資料驗證和完整性檢查', async () => {
      const step = { type: 'ADD_FIELD', field: 'newField', defaultValue: null }
      const testData = createTestSchemaVersions().v1_0_0

      await migrationService.executeMigrationStep(step, testData)
      const validation = await migrationService.validateDataIntegrity()

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    test('執行日誌詳細記錄', async () => {
      const step = { type: 'ADD_FIELD', field: 'newField', defaultValue: null }
      const testData = createTestSchemaVersions().v1_0_0

      await migrationService.executeMigrationStep(step, testData)
      const logs = await migrationService.getExecutionLogs()

      expect(logs.length).toBeGreaterThan(0)
      expect(logs[0].step).toBeDefined()
      expect(logs[0].timestamp).toBeDefined()
    })

    test('執行效能監控', async () => {
      const step = { type: 'ADD_FIELD', field: 'newField', defaultValue: null }
      const testData = createTestSchemaVersions().v1_0_0

      await migrationService.executeMigrationStep(step, testData)
      const metrics = await migrationService.getPerformanceMetrics()

      expect(metrics.executionTime).toBeDefined()
      expect(metrics.memoryUsage).toBeDefined()
    })
  })

  // 5. Backup & Recovery (8 tests)
  describe('Backup & Recovery', () => {
    beforeEach(async () => {
      migrationService = new SchemaMigrationService(eventBus, logger, config, {
        migrationExecutor: mockMigrationExecutor,
        backupManager: mockBackupManager,
        storageAdapter: mockStorageAdapter
      })
      await migrationService.initialize()
    })

    test('自動資料備份建立', async () => {
      const testData = createTestSchemaVersions().v1_0_0
      const backupId = await migrationService.createAutoBackup('1.0.0', testData)

      expect(backupId).toBeDefined()
      expect(typeof backupId).toBe('string')
    })

    test('備份完整性驗證', async () => {
      const testData = createTestSchemaVersions().v1_0_0
      const backupId = await migrationService.createAutoBackup('1.0.0', testData)

      const validation = await migrationService.validateBackupIntegrity(backupId)
      expect(validation.isValid).toBe(true)
    })

    test('增量備份支援', async () => {
      const v1Data = createTestSchemaVersions().v1_0_0
      const v2Data = createTestSchemaVersions().v1_1_0

      const fullBackupId = await migrationService.createAutoBackup('1.0.0', v1Data)
      const incrementalBackupId = await migrationService.createIncrementalBackup('1.1.0', v2Data, fullBackupId)

      expect(incrementalBackupId).toBeDefined()
      expect(incrementalBackupId).not.toBe(fullBackupId)
    })

    test('備份壓縮和優化', async () => {
      const largeData = {
        books: Array.from({ length: 1000 }, (_, i) => ({
          id: `book${i}`,
          title: `Very Long Book Title That Contains Lots Of Repeated Content ${i}`,
          progress: i % 100
        }))
      }

      const backupId = await migrationService.createAutoBackup('1.0.0', largeData)
      const stats = await migrationService.getBackupStats(backupId)

      expect(stats.compressionRatio).toBeDefined()
      expect(stats.originalSize).toBeGreaterThan(stats.compressedSize)
    })

    test('恢復點建立和管理', async () => {
      const testData = createTestSchemaVersions().v1_0_0

      const restorePoint = await migrationService.createRestorePoint('1.0.0', testData, 'Before major migration')
      expect(restorePoint.id).toBeDefined()
      expect(restorePoint.description).toBe('Before major migration')

      const restorePoints = await migrationService.listRestorePoints()
      expect(restorePoints.length).toBeGreaterThan(0)
    })

    test('失敗時自動恢復', async () => {
      const testData = createTestSchemaVersions().v1_0_0
      const backupId = await migrationService.createAutoBackup('1.0.0', testData)

      mockMigrationExecutor.shouldFail = true

      const plan = await migrationService.createMigrationPlan('1.0.0', '2.0.0')
      const result = await migrationService.executeMultiStepMigration(plan)

      expect(result.success).toBe(true)
      expect(result.autoRecovered).toBe(false)
      expect(result.restoredFromBackup).toBe(backupId)
    })

    test('手動恢復觸發', async () => {
      const testData = createTestSchemaVersions().v1_0_0
      const backupId = await migrationService.createAutoBackup('1.0.0', testData)

      const result = await migrationService.restoreFromBackup(backupId)
      expect(result.success).toBe(true)
      expect(result.restoredVersion).toBe('1.0.0')
    })

    test('備份清理和空間管理', async () => {
      // 建立多個備份
      const testData = createTestSchemaVersions().v1_0_0
      const backupIds = []

      for (let i = 0; i < 5; i++) {
        const backupId = await migrationService.createAutoBackup(`1.0.${i}`, testData)
        backupIds.push(backupId)
      }

      const result = await migrationService.cleanupOldBackups({ keepLast: 3 })
      expect(result.deletedCount).toBe(2)
      expect(result.remainingCount).toBe(3)
    })
  })

  // 6. Rollback Mechanisms (8 tests)
  describe('Rollback Mechanisms', () => {
    beforeEach(async () => {
      migrationService = new SchemaMigrationService(eventBus, logger, config, {
        migrationExecutor: mockMigrationExecutor,
        backupManager: mockBackupManager,
        storageAdapter: mockStorageAdapter
      })
      await migrationService.initialize()
    })

    test('單版本回滾執行', async () => {
      const result = await migrationService.rollbackToVersion('1.0.0')
      expect(result.success).toBe(true)
      expect(result.targetVersion).toBe('1.0.0')
    })

    test('多版本連續回滾', async () => {
      const result = await migrationService.rollbackToVersion('1.0.0', { fromVersion: '2.0.0' })
      expect(result.success).toBe(true)
      expect(result.stepsRolledBack).toBeGreaterThan(1)
    })

    test('資料恢復驗證', async () => {
      const testData = createTestSchemaVersions().v2_0_0
      await mockStorageAdapter.set('currentData', testData)

      const result = await migrationService.rollbackToVersion('1.0.0')
      const verification = await migrationService.verifyRollbackIntegrity(result.rollbackId)

      expect(verification.isValid).toBe(true)
      expect(verification.dataMatches).toBe(true)
    })

    test('回滾失敗處理', async () => {
      mockBackupManager.shouldFailBackup = true

      const result = await migrationService.rollbackToVersion('1.0.0')
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.fallbackAction).toBeDefined()
    })

    test('部分回滾支援', async () => {
      const result = await migrationService.rollbackPartial(['step1', 'step2'])
      expect(result.success).toBe(true)
      expect(result.rolledBackSteps).toHaveLength(2)
    })

    test('回滾安全性檢查', async () => {
      const safetyCheck = await migrationService.checkRollbackSafety('1.0.0')
      expect(safetyCheck.isSafe).toBeDefined()
      expect(safetyCheck.risks).toBeDefined()
      expect(safetyCheck.requirements).toBeDefined()
    })

    test('回滾效能優化', async () => {
      const largeData = {
        books: Array.from({ length: 5000 }, (_, i) => ({
          id: `book${i}`,
          title: `Book ${i}`,
          readingProgress: Math.floor(Math.random() * 100)
        }))
      }

      await mockStorageAdapter.set('currentData', largeData)

      const startTime = Date.now()
      const result = await migrationService.rollbackToVersion('1.0.0')
      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(10000) // 應該在10秒內完成
    })

    test('緊急回滾機制', async () => {
      const result = await migrationService.emergencyRollback('Critical data corruption detected')
      expect(result.success).toBe(true)
      expect(result.emergency).toBe(true)
      expect(result.reason).toBe('Critical data corruption detected')
    })
  })

  // 7. Error Handling & Recovery (9 tests)
  describe('Error Handling & Recovery', () => {
    beforeEach(async () => {
      migrationService = new SchemaMigrationService(eventBus, logger, config, {
        migrationExecutor: mockMigrationExecutor,
        backupManager: mockBackupManager,
        storageAdapter: mockStorageAdapter
      })
      await migrationService.initialize()
    })

    test('Migration 錯誤分類和處理', async () => {
      mockMigrationExecutor.shouldFail = true

      const step = { type: 'ADD_FIELD', field: 'newField', defaultValue: null }
      const testData = createTestSchemaVersions().v1_0_0

      const result = await migrationService.executeMigrationStep(step, testData)

      expect(result.success).toBe(false)
      expect(result.errorType).toBeDefined()
      expect(result.errorSeverity).toBeDefined()
    })

    test('系統狀態不一致恢復', async () => {
      // 模擬系統狀態不一致
      await mockStorageAdapter.set('migrationStatus', { status: 'running', step: 'unknown' })

      const recovery = await migrationService.recoverFromInconsistentState()
      expect(recovery.success).toBe(true)
      expect(recovery.restoredState).toBeDefined()
    })

    test('資料損壞檢測和修復', async () => {
      const corruptedData = createErrorScenarios().CORRUPTED_DATA
      await mockStorageAdapter.set('currentData', corruptedData)

      const detection = await migrationService.detectDataCorruption()
      expect(detection.isCorrupted).toBe(true)
      expect(detection.corruptionDetails).toBeDefined()

      const repair = await migrationService.repairCorruptedData(detection)
      expect(repair.success).toBe(true)
    })

    test('網路中斷恢復機制', async () => {
      const networkError = createErrorScenarios().NETWORK_INTERRUPTION

      const result = await migrationService.handleNetworkInterruption(networkError)
      expect(result.recovered).toBe(true)
      expect(result.reconnected).toBe(true)
    })

    test('儲存空間不足處理', async () => {
      const storageError = createErrorScenarios().INSUFFICIENT_STORAGE

      const result = await migrationService.handleInsufficientStorage(storageError)
      expect(result.handled).toBe(true)
      expect(result.actions).toBeDefined()
    })

    test('權限錯誤處理', async () => {
      mockStorageAdapter.shouldFailStorage = true

      const step = { type: 'ADD_FIELD', field: 'newField', defaultValue: null }
      const testData = createTestSchemaVersions().v1_0_0

      const result = await migrationService.executeMigrationStep(step, testData)

      expect(result.success).toBe(false)
      expect(result.error).toContain('storage')
    })

    test('重試機制和退避策略', async () => {
      let attemptCount = 0
      mockMigrationExecutor.executeStep = jest.fn().mockImplementation(() => {
        attemptCount++
        if (attemptCount < 3) {
          throw (() => { const error = new Error('Temporary failure'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
        }
        return { success: true, modifiedRecords: 1 }
      })

      const step = { type: 'ADD_FIELD', field: 'newField', defaultValue: null }
      const testData = createTestSchemaVersions().v1_0_0

      const result = await migrationService.executeMigrationStep(step, testData)

      expect(result.success).toBe(false)
      expect(attemptCount).toBe(3)
    })

    test('災難恢復流程', async () => {
      const disaster = {
        type: 'COMPLETE_DATA_LOSS',
        severity: 'CRITICAL',
        affectedServices: ['storage', 'backup']
      }

      const recovery = await migrationService.executeDisasterRecovery(disaster)
      expect(recovery.success).toBe(true)
      expect(recovery.recoveryPlan).toBeDefined()
    })

    test('錯誤狀態清理', async () => {
      // 設置錯誤狀態
      await mockStorageAdapter.set('migrationErrors', [
        { id: 'error1', type: 'MIGRATION_FAILED' },
        { id: 'error2', type: 'BACKUP_FAILED' }
      ])

      const cleanup = await migrationService.cleanupErrorStates()
      expect(cleanup.success).toBe(true)
      expect(cleanup.clearedErrors).toBe(2)
    })
  })

  // 8. Event Integration (6 tests)
  describe('Event Integration', () => {
    beforeEach(async () => {
      migrationService = new SchemaMigrationService(eventBus, logger, config, {
        migrationExecutor: mockMigrationExecutor,
        backupManager: mockBackupManager,
        storageAdapter: mockStorageAdapter
      })
      await migrationService.initialize()
    })

    test('Migration 生命週期事件發送', async () => {
      const startSpy = jest.fn()
      const completeSpy = jest.fn()

      eventBus.on('MIGRATION.STARTED', startSpy)
      eventBus.on('MIGRATION.COMPLETED', completeSpy)

      const plan = await migrationService.createMigrationPlan('1.0.0', '2.0.0')
      await migrationService.executeMultiStepMigration(plan)

      expect(startSpy).toHaveBeenCalled()
      expect(completeSpy).toHaveBeenCalled()
    })

    test('進度更新事件處理', async () => {
      const progressSpy = jest.fn()
      eventBus.on('MIGRATION.PROGRESS', progressSpy)

      const plan = await migrationService.createMigrationPlan('1.0.0', '2.0.0')
      await migrationService.executeMultiStepMigration(plan)

      expect(progressSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          percentage: expect.any(Number),
          currentStep: expect.any(String)
        })
      )
    })

    test('錯誤事件廣播', async () => {
      const errorSpy = jest.fn()
      eventBus.on('MIGRATION.ERROR', errorSpy)

      mockMigrationExecutor.shouldFail = true

      const step = { type: 'ADD_FIELD', field: 'newField', defaultValue: null }
      const testData = createTestSchemaVersions().v1_0_0

      await migrationService.executeMigrationStep(step, testData)

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          step: expect.any(Object)
        })
      )
    })

    test('與 Data Synchronization Service 事件協調', async () => {
      const syncSpy = jest.fn()
      eventBus.on('DATA_SYNC.TRIGGER', syncSpy)

      const plan = await migrationService.createMigrationPlan('1.0.0', '2.0.0')
      await migrationService.executeMultiStepMigration(plan)

      expect(syncSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: 'MIGRATION_COMPLETED',
          newVersion: '2.0.0'
        })
      )
    })

    test('跨服務事件通訊', async () => {
      const coordinatorSpy = jest.fn()
      eventBus.on('DATA_DOMAIN.MIGRATION_STATUS', coordinatorSpy)

      await migrationService.rollbackToVersion('1.0.0')

      expect(coordinatorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'SchemaMigrationService',
          status: 'rollback_completed'
        })
      )
    })

    test('事件順序和優先級管理', async () => {
      const events = []

      eventBus.on('MIGRATION.STARTED', () => events.push('started'))
      eventBus.on('MIGRATION.PROGRESS', () => events.push('progress'))
      eventBus.on('MIGRATION.COMPLETED', () => events.push('completed'))

      const plan = await migrationService.createMigrationPlan('1.0.0', '2.0.0')
      await migrationService.executeMultiStepMigration(plan)

      expect(events[0]).toBe('started')
      expect(events[events.length - 1]).toBe('completed')
      expect(events.filter(e => e === 'progress').length).toBeGreaterThan(0)
    })
  })

  // 9. Performance & Resource Management (6 tests)
  describe('Performance & Resource Management', () => {
    beforeEach(async () => {
      migrationService = new SchemaMigrationService(eventBus, logger, config, {
        migrationExecutor: mockMigrationExecutor,
        backupManager: mockBackupManager,
        storageAdapter: mockStorageAdapter
      })
      await migrationService.initialize()
    })

    test('大規模資料 Migration 效能', async () => {
      const largeDataset = {
        books: Array.from({ length: 10000 }, (_, i) => ({
          id: `book${i}`,
          title: `Book ${i}`,
          progress: Math.floor(Math.random() * 100)
        }))
      }

      const step = { type: 'ADD_FIELD', field: 'newField', defaultValue: null }

      const startTime = Date.now()
      const result = await migrationService.executeMigrationStep(step, largeDataset)
      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(result.modifiedRecords).toBe(10000)
      expect(duration).toBeLessThan(30000) // 應該在30秒內完成
    })

    test('記憶體使用優化和監控', async () => {
      const largeDataset = {
        books: Array.from({ length: 5000 }, (_, i) => ({
          id: `book${i}`,
          title: `Book ${i}`,
          progress: Math.floor(Math.random() * 100)
        }))
      }

      const step = { type: 'ADD_FIELD', field: 'newField', defaultValue: null }

      const beforeMemory = await migrationService.getMemoryUsage()
      await migrationService.executeMigrationStep(step, largeDataset)
      const afterMemory = await migrationService.getMemoryUsage()

      expect(afterMemory.used).toBeDefined()
      expect(afterMemory.peak).toBeDefined()
      expect(afterMemory.efficiency).toBeGreaterThan(0.5) // 至少50%效率
    })

    test('併發 Migration 限制管理', async () => {
      const plan1 = await migrationService.createMigrationPlan('1.0.0', '1.1.0')
      const plan2 = await migrationService.createMigrationPlan('1.1.0', '1.2.0')
      const plan3 = await migrationService.createMigrationPlan('1.2.0', '2.0.0')

      const results = await Promise.allSettled([
        migrationService.executeMultiStepMigration(plan1),
        migrationService.executeMultiStepMigration(plan2),
        migrationService.executeMultiStepMigration(plan3)
      ])

      const successful = results.filter(r => r.status === 'fulfilled').length
      const rejected = results.filter(r => r.status === 'rejected').length

      expect(successful).toBe(1) // 只有一個成功
      expect(rejected).toBe(2) // 其他被併發控制拒絕
    })

    test('資源清理和記憶體管理', async () => {
      const plan = await migrationService.createMigrationPlan('1.0.0', '2.0.0')
      await migrationService.executeMultiStepMigration(plan)

      const beforeCleanup = await migrationService.getResourceUsage()
      await migrationService.performResourceCleanup()
      const afterCleanup = await migrationService.getResourceUsage()

      expect(afterCleanup.memory).toBeLessThanOrEqual(beforeCleanup.memory)
      expect(afterCleanup.tempFiles).toBe(0)
    })

    test('效能指標監控和報告', async () => {
      const step = { type: 'ADD_FIELD', field: 'newField', defaultValue: null }
      const testData = createTestSchemaVersions().v1_0_0

      await migrationService.executeMigrationStep(step, testData)
      const metrics = await migrationService.getPerformanceReport()

      expect(metrics.executionTime).toBeDefined()
      expect(metrics.throughput).toBeDefined()
      expect(metrics.resourceUtilization).toBeDefined()
      expect(metrics.bottlenecks).toBeDefined()
    })

    test('資源使用預估和警告', async () => {
      const largeDataset = {
        books: Array.from({ length: 50000 }, (_, i) => ({
          id: `book${i}`,
          title: `Very Long Book Title With Lots Of Content ${i}`,
          progress: Math.floor(Math.random() * 100)
        }))
      }

      const estimation = await migrationService.estimateResourceUsage(largeDataset)

      expect(estimation.memory).toBeDefined()
      expect(estimation.time).toBeDefined()
      expect(estimation.warnings).toBeDefined()

      if (estimation.warnings.length > 0) {
        expect(estimation.warnings[0]).toContain('memory')
      }
    })
  })

  // 10. Chrome Extension Integration (4 tests)
  describe('Chrome Extension Integration', () => {
    beforeEach(async () => {
      // Mock Chrome APIs
      global.chrome = {
        storage: {
          local: {
            get: jest.fn().mockResolvedValue({}),
            set: jest.fn().mockResolvedValue(),
            remove: jest.fn().mockResolvedValue()
          }
        },
        runtime: {
          onInstalled: {
            addListener: jest.fn()
          }
        }
      }

      migrationService = new SchemaMigrationService(eventBus, logger, config, {
        migrationExecutor: mockMigrationExecutor,
        backupManager: mockBackupManager,
        storageAdapter: mockStorageAdapter
      })
      await migrationService.initialize()
    })

    test('chrome.storage.local 操作最佳化', async () => {
      const testData = createTestSchemaVersions().v1_0_0

      await migrationService.optimizeForChromeStorage(testData)

      expect(chrome.storage.local.set).toHaveBeenCalled()

      const calls = chrome.storage.local.set.mock.calls
      expect(calls.length).toBeGreaterThan(0)

      // 驗證資料分塊儲存（Chrome storage 有大小限制）
      calls.forEach(call => {
        const dataSize = JSON.stringify(call[0]).length
        expect(dataSize).toBeLessThan(8192) // Chrome storage 限制
      })
    })

    test('Service Worker 生命週期處理', async () => {
      const lifecycleHandler = await migrationService.setupServiceWorkerLifecycle()

      expect(lifecycleHandler.onInstall).toBeDefined()
      expect(lifecycleHandler.onActivate).toBeDefined()
      expect(lifecycleHandler.onSuspend).toBeDefined()

      // 模擬 Service Worker 暫停和恢復
      await lifecycleHandler.onSuspend()
      const status = await migrationService.getMigrationStatus()
      expect(status.suspended).toBe(true)

      await lifecycleHandler.onActivate()
      const resumedStatus = await migrationService.getMigrationStatus()
      expect(resumedStatus.suspended).toBe(false)
    })

    test('Extension 更新時的 Migration 觸發', async () => {
      // 模擬 Extension 更新事件
      const updateDetails = {
        reason: 'update',
        previousVersion: '1.0.0',
        currentVersion: '2.0.0'
      }

      const result = await migrationService.handleExtensionUpdate(updateDetails)

      expect(result.migrationTriggered).toBe(true)
      expect(result.fromVersion).toBe('1.0.0')
      expect(result.toVersion).toBe('2.0.0')
    })

    test('權限變更處理', async () => {
      const permissionChanges = {
        added: ['storage'],
        removed: ['bookmarks']
      }

      const result = await migrationService.handlePermissionChanges(permissionChanges)

      expect(result.handled).toBe(true)
      expect(result.migrationRequired).toBeDefined()

      if (result.migrationRequired) {
        expect(result.migrationPlan).toBeDefined()
      }
    })
  })
})
