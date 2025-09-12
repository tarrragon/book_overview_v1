/**
 * DataValidationService 整合測試
 * TDD 重構循環 6/8: 服務整合與協調器模式
 *
 * 目標：將 DataValidationService 重構為整合所有子服務的協調器
 */

const DataValidationService = require('src/background/domains/data-management/services/data-validation-service.js')
const { StandardError } = require('src/core/errors/StandardError')

describe('DataValidationService - 服務整合測試', () => {
  let validationService
  let mockEventBus
  let mockLogger
  let mockValidationRuleManager
  let mockBatchValidationProcessor
  let mockDataNormalizationService
  let mockQualityAssessmentService
  let mockCacheManagementService

  beforeEach(() => {
    mockEventBus = {
      on: jest.fn(),
      emit: jest.fn(),
      off: jest.fn()
    }

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    }

    // Mock 所有子服務
    mockValidationRuleManager = {
      loadPlatformValidationRules: jest.fn().mockResolvedValue({
        success: true,
        platform: 'READMOO',
        rules: {
          requiredFields: ['id', 'title'],
          dataTypes: { id: 'string', title: 'string' },
          businessRules: {}
        }
      }),
      getValidationRules: jest.fn().mockReturnValue({
        requiredFields: ['id', 'title'],
        dataTypes: { id: 'string', title: 'string' },
        businessRules: {}
      })
    }

    mockBatchValidationProcessor = {
      processBatches: jest.fn().mockImplementation((books) => {
        // 空陣列返回空結果
        if (!books || books.length === 0) {
          return Promise.resolve({
            validBooks: [],
            invalidBooks: [],
            warnings: [],
            normalizedBooks: []
          })
        }
        // 非空陣列返回測試資料
        return Promise.resolve({
          validBooks: [{ id: 'book1', title: '書籍1' }],
          invalidBooks: [],
          warnings: [],
          normalizedBooks: [{ id: 'book1', title: '書籍1' }]
        })
      })
    }

    mockDataNormalizationService = {
      normalizeBookBatch: jest.fn().mockImplementation((books) => {
        // 空陣列返回空結果
        if (!books || books.length === 0) {
          return Promise.resolve({
            normalizedBooks: [],
            errors: []
          })
        }
        // 非空陣列返回測試資料
        return Promise.resolve({
          normalizedBooks: [{
            id: 'book1',
            title: '書籍1',
            platform: 'READMOO',
            normalizedAt: new Date().toISOString()
          }],
          errors: []
        })
      })
    }

    mockQualityAssessmentService = {
      calculateQualityScore: jest.fn().mockImplementation((books) => {
        // 空陣列返回0分
        if (!books || books.length === 0) {
          return 0
        }
        // 非空陣列返回85分
        return 85
      })
    }

    mockCacheManagementService = {
      getCacheValue: jest.fn().mockReturnValue(null),
      setCacheValue: jest.fn().mockReturnValue(true),
      generateCacheKey: jest.fn().mockReturnValue('cache_key_123')
    }

    validationService = new DataValidationService(mockEventBus, {
      logger: mockLogger,
      validationRuleManager: mockValidationRuleManager,
      batchValidationProcessor: mockBatchValidationProcessor,
      dataNormalizationService: mockDataNormalizationService,
      qualityAssessmentService: mockQualityAssessmentService,
      cacheManagementService: mockCacheManagementService,
      config: {
        validationTimeout: 5000,
        batchSize: 10,
        enableCache: true
      }
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('🏗️ 服務整合初始化', () => {
    test('應該正確初始化所有子服務依賴', () => {
      expect(validationService.validationRuleManager).toBe(mockValidationRuleManager)
      expect(validationService.batchValidationProcessor).toBe(mockBatchValidationProcessor)
      expect(validationService.dataNormalizationService).toBe(mockDataNormalizationService)
      expect(validationService.qualityAssessmentService).toBe(mockQualityAssessmentService)
      expect(validationService.cacheManagementService).toBe(mockCacheManagementService)
    })

    test('應該註冊必要的事件監聽器', () => {
      expect(mockEventBus.on).toHaveBeenCalled()
    })

    test('應該要求所有必要的依賴服務', () => {
      expect(() => {
        new DataValidationService(mockEventBus, {
          validationRuleManager: null
        })
      }).toMatchObject({
        message: expect.stringContaining('ValidationRuleManager is required')
      })

      expect(() => {
        new DataValidationService(mockEventBus, {
          validationRuleManager: mockValidationRuleManager,
          batchValidationProcessor: null
        })
      }).toMatchObject({
        message: expect.stringContaining('BatchValidationProcessor is required')
      })
    })
  })

  describe('🔄 服務協調流程', () => {
    test('validateAndNormalize() 應該協調所有服務完成完整流程', async () => {
      const books = [
        { id: 'book1', title: '測試書籍1' },
        { id: 'book2', title: '測試書籍2' }
      ]

      const result = await validationService.validateAndNormalize(books, 'READMOO', 'test')

      // 驗證服務調用順序
      expect(mockValidationRuleManager.loadPlatformValidationRules).toHaveBeenCalledWith('READMOO')
      expect(mockBatchValidationProcessor.processBatches).toHaveBeenCalledWith(
        books, 'READMOO', 'test', expect.any(String)
      )
      expect(mockDataNormalizationService.normalizeBookBatch).toHaveBeenCalledWith(
        [{ id: 'book1', title: '書籍1' }], 'READMOO'
      )
      expect(mockQualityAssessmentService.calculateQualityScore).toHaveBeenCalled()

      // 驗證結果結構
      expect(result).toHaveProperty('validationId')
      expect(result).toHaveProperty('platform', 'READMOO')
      expect(result).toHaveProperty('validBooks')
      expect(result).toHaveProperty('normalizedBooks')
      expect(result).toHaveProperty('qualityScore', 85)
    })

    test('應該支援快取機制整合', async () => {
      const books = [{ id: 'book1', title: '測試書籍' }]

      // 第一次調用 - 應該檢查快取
      await validationService.validateAndNormalize(books, 'READMOO', 'test')
      expect(mockCacheManagementService.getCacheValue).toHaveBeenCalled()
      expect(mockCacheManagementService.setCacheValue).toHaveBeenCalled()
    })

    test('應該處理批次驗證失敗情況', async () => {
      mockBatchValidationProcessor.processBatches.mockRejectedValue(new Error('批次處理失敗'))

      const books = [{ id: 'book1', title: '測試書籍' }]

      await expect(
        validationService.validateAndNormalize(books, 'READMOO', 'test')
      ).rejects.toMatchObject({
        code: 'TEST_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'DATA.VALIDATION.FAILED',
        expect.objectContaining({
          error: '批次處理失敗'
        })
      )
    })
  })

  describe('⏰ 超時控制機制', () => {
    test('應該在超時後拋出錯誤', async () => {
      // 設置短超時時間
      validationService.config.validationTimeout = 100

      // 模擬長時間運行的批次處理
      mockBatchValidationProcessor.processBatches.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 200))
      )

      const books = [{ id: 'book1', title: '測試書籍' }]

      await expect(
        validationService.validateAndNormalize(books, 'READMOO', 'test')
      ).rejects.toMatchObject({
        code: 'TEST_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })
    })

    test('應該在正常時間內完成驗證', async () => {
      validationService.config.validationTimeout = 5000

      const books = [{ id: 'book1', title: '測試書籍' }]
      const result = await validationService.validateAndNormalize(books, 'READMOO', 'test')

      expect(result).toBeDefined()
      expect(result.validationId).toBeDefined()
    })
  })

  describe('📊 事件生命週期管理', () => {
    test('應該發送完整的驗證生命週期事件', async () => {
      const books = [{ id: 'book1', title: '測試書籍' }]

      await validationService.validateAndNormalize(books, 'READMOO', 'test')

      // 驗證開始事件
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'DATA.VALIDATION.STARTED',
        expect.objectContaining({
          platform: 'READMOO',
          source: 'test',
          bookCount: 1
        })
      )

      // 驗證完成事件
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'DATA.VALIDATION.COMPLETED',
        expect.objectContaining({
          platform: 'READMOO',
          qualityScore: 85
        })
      )

      // 資料準備同步事件
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'DATA.READY_FOR_SYNC',
        expect.objectContaining({
          platform: 'READMOO',
          normalizedBooks: expect.any(Array)
        })
      )
    })

    test('應該在失敗時發送失敗事件', async () => {
      mockValidationRuleManager.loadPlatformValidationRules.mockRejectedValue(new Error('規則載入失敗'))

      const books = [{ id: 'book1', title: '測試書籍' }]

      await expect(
        validationService.validateAndNormalize(books, 'READMOO', 'test')
      ).rejects.toMatchObject({
        code: 'TEST_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'DATA.VALIDATION.FAILED',
        expect.objectContaining({
          error: '規則載入失敗'
        })
      )
    })
  })

  describe('🛡️ 輸入驗證與錯誤處理', () => {
    test('應該驗證必要輸入參數', async () => {
      await expect(
        validationService.validateAndNormalize(null, 'READMOO', 'test')
      ).rejects.toMatchObject({
        code: 'TEST_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })

      // 空陣列應該返回空結果，不拋出錯誤
      const emptyResult = await validationService.validateAndNormalize([], 'READMOO', 'test')
      expect(emptyResult.totalBooks).toBe(0)
      expect(emptyResult.validBooks).toHaveLength(0)

      await expect(
        validationService.validateAndNormalize([{ id: 'book1' }], '', 'test')
      ).rejects.toMatchObject({
        code: 'TEST_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })
    })

    test('應該處理大批次資料分割', async () => {
      // 創建大量測試資料
      const books = new Array(25).fill(0).map((_, i) => ({
        id: `book${i}`,
        title: `書籍${i}`
      }))

      await validationService.validateAndNormalize(books, 'READMOO', 'test')

      // 確認批次處理器收到正確資料
      expect(mockBatchValidationProcessor.processBatches).toHaveBeenCalledWith(
        books, 'READMOO', 'test', expect.any(String)
      )
    })
  })

  describe('🧹 服務清理與資源管理', () => {
    test('destroy() 應該清理所有子服務', () => {
      mockCacheManagementService.clearAllCaches = jest.fn()
      mockValidationRuleManager.clearAllRules = jest.fn()

      validationService.destroy()

      expect(mockCacheManagementService.clearAllCaches).toHaveBeenCalled()
      expect(mockValidationRuleManager.clearAllRules).toHaveBeenCalled()
    })

    test('應該正確處理服務初始化狀態', () => {
      expect(validationService.isInitialized).toBe(true)

      validationService.destroy()
      expect(validationService.isInitialized).toBe(false)
    })
  })

  describe('⚙️ 配置管理', () => {
    test('應該支援配置更新', () => {
      const newConfig = {
        validationTimeout: 10000,
        batchSize: 20,
        enableCache: false
      }

      validationService.updateConfig(newConfig)

      expect(validationService.config.validationTimeout).toBe(10000)
      expect(validationService.config.batchSize).toBe(20)
      expect(validationService.config.enableCache).toBe(false)
    })

    test('應該提供健康狀態檢查', () => {
      const health = validationService.getServiceHealth()

      expect(health).toHaveProperty('isHealthy')
      expect(health).toHaveProperty('services')
      expect(health.services).toHaveProperty('validationRuleManager')
      expect(health.services).toHaveProperty('batchValidationProcessor')
      expect(health.services).toHaveProperty('dataNormalizationService')
      expect(health.services).toHaveProperty('qualityAssessmentService')
      expect(health.services).toHaveProperty('cacheManagementService')
    })
  })
})
