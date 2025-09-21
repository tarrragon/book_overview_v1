/**
 * BatchValidationProcessor 測試
 * TDD 重構循環 2/8: 批次驗證處理邏輯提取
 *
 * 目標：將批次驗證處理邏輯從 DataValidationService 中提取
 */

// eslint-disable-next-line no-unused-vars
const BatchValidationProcessor = require('src/background/domains/data-management/services/batch-validation-processor.js')

describe('BatchValidationProcessor - 批次驗證處理服務', () => {
  let processor
  // eslint-disable-next-line no-unused-vars
  let mockEventBus
  // eslint-disable-next-line no-unused-vars
  let mockLogger
  // eslint-disable-next-line no-unused-vars
  let mockValidationRuleManager

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

    mockValidationRuleManager = {
      getValidationRules: jest.fn(),
      loadPlatformValidationRules: jest.fn()
    }

    processor = new BatchValidationProcessor(mockEventBus, {
      logger: mockLogger,
      validationRuleManager: mockValidationRuleManager,
      config: {
        batchSize: 10,
        maxBatchSize: 100,
        gcAfterBatch: true,
        validationTimeout: 5000
      }
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('🏗️ 服務初始化', () => {
    test('應該正確初始化批次驗證處理器', () => {
      expect(processor).toBeInstanceOf(BatchValidationProcessor)
      expect(processor.eventBus).toBe(mockEventBus)
      expect(processor.logger).toBe(mockLogger)
      expect(processor.validationRuleManager).toBe(mockValidationRuleManager)
    })

    test('應該初始化批次處理配置', () => {
      expect(processor.config.batchSize).toBe(10)
      expect(processor.config.maxBatchSize).toBe(100)
      expect(processor.config.gcAfterBatch).toBe(true)
    })

    test('應該初始化批次處理統計', () => {
      expect(processor.batchStatistics).toBeDefined()
      expect(processor.batchStatistics.totalProcessed).toBe(0)
      expect(processor.batchStatistics.batchCount).toBe(0)
    })
  })

  describe('📦 批次分割功能', () => {
    test('splitIntoBatches() 應該正確分割小數量資料', () => {
      // eslint-disable-next-line no-unused-vars
      const books = [1, 2, 3, 4, 5]
      // eslint-disable-next-line no-unused-vars
      const batches = processor.splitIntoBatches(books)

      expect(batches).toHaveLength(1)
      expect(batches[0]).toEqual([1, 2, 3, 4, 5])
    })

    test('splitIntoBatches() 應該正確分割大數量資料', () => {
      // eslint-disable-next-line no-unused-vars
      const books = new Array(25).fill(0).map((_, i) => ({ id: i }))
      // eslint-disable-next-line no-unused-vars
      const batches = processor.splitIntoBatches(books)

      expect(batches).toHaveLength(3)
      expect(batches[0]).toHaveLength(10)
      expect(batches[1]).toHaveLength(10)
      expect(batches[2]).toHaveLength(5)
    })

    test('splitIntoBatches() 應該處理空陣列', () => {
      // eslint-disable-next-line no-unused-vars
      const batches = processor.splitIntoBatches([])
      expect(batches).toHaveLength(0)
    })

    test('splitIntoBatches() 應該尊重最大批次大小限制', () => {
      processor.config.batchSize = 200
      processor.config.maxBatchSize = 50

      // eslint-disable-next-line no-unused-vars
      const books = new Array(100).fill(0).map((_, i) => ({ id: i }))
      // eslint-disable-next-line no-unused-vars
      const batches = processor.splitIntoBatches(books)

      expect(batches).toHaveLength(2)
      expect(batches[0]).toHaveLength(50)
      expect(batches[1]).toHaveLength(50)
    })
  })

  describe('🔍 單本書籍驗證', () => {
    beforeEach(() => {
      mockValidationRuleManager.getValidationRules.mockReturnValue({
        requiredFields: ['id', 'title'],
        dataTypes: {
          id: 'string',
          title: 'string',
          authors: 'array',
          progress: 'number'
        },
        businessRules: {
          progressRange: { min: 0, max: 100 }
        }
      })
    })

    test('validateSingleBook() 應該驗證有效的書籍資料', async () => {
      // eslint-disable-next-line no-unused-vars
      const book = {
        id: 'book1',
        title: '測試書籍',
        authors: ['作者1'],
        progress: 50
      }

      // eslint-disable-next-line no-unused-vars
      const result = await processor.validateSingleBook(book, 'READMOO')

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.book).toBe(book)
    })

    test('validateSingleBook() 應該檢測缺少必填欄位', async () => {
      // eslint-disable-next-line no-unused-vars
      const book = {
        id: 'book1'
        // 缺少 title
      }

      // eslint-disable-next-line no-unused-vars
      const result = await processor.validateSingleBook(book, 'READMOO')

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].type).toBe('MISSING_REQUIRED_FIELD')
      expect(result.errors[0].field).toBe('title')
    })

    test('validateSingleBook() 應該檢測資料類型錯誤', async () => {
      // eslint-disable-next-line no-unused-vars
      const book = {
        id: 'book1',
        title: '測試書籍',
        progress: '50%' // 應該是數字
      }

      // eslint-disable-next-line no-unused-vars
      const result = await processor.validateSingleBook(book, 'READMOO')

      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.type === 'INVALID_DATA_TYPE')).toBe(true)
    })

    test('validateSingleBook() 應該檢測商業規則違反', async () => {
      // eslint-disable-next-line no-unused-vars
      const book = {
        id: 'book1',
        title: '測試書籍',
        progress: 150 // 超過最大值 100
      }

      // eslint-disable-next-line no-unused-vars
      const result = await processor.validateSingleBook(book, 'READMOO')

      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.type === 'BUSINESS_RULE_VIOLATION')).toBe(true)
    })

    test('validateSingleBook() 應該處理 null 或 undefined 書籍', async () => {
      // eslint-disable-next-line no-unused-vars
      const result1 = await processor.validateSingleBook(null, 'READMOO')
      // eslint-disable-next-line no-unused-vars
      const result2 = await processor.validateSingleBook(undefined, 'READMOO')

      expect(result1.isValid).toBe(false)
      expect(result1.errors[0].type).toBe('NULL_BOOK_DATA')

      expect(result2.isValid).toBe(false)
      expect(result2.errors[0].type).toBe('NULL_BOOK_DATA')
    })
  })

  describe('📋 批次處理功能', () => {
    beforeEach(() => {
      mockValidationRuleManager.getValidationRules.mockReturnValue({
        requiredFields: ['id', 'title'],
        dataTypes: {
          id: 'string',
          title: 'string'
        },
        businessRules: {}
      })
    })

    test('processBatch() 應該處理有效的批次資料', async () => {
      // eslint-disable-next-line no-unused-vars
      const batch = [
        { id: 'book1', title: '書籍1' },
        { id: 'book2', title: '書籍2' },
        { id: 'book3', title: '書籍3' }
      ]

      // eslint-disable-next-line no-unused-vars
      const result = await processor.processBatch(batch, 'READMOO', 'test', 0, 1)

      expect(result.validBooks).toHaveLength(3)
      expect(result.invalidBooks).toHaveLength(0)
      expect(result.warnings).toBeDefined()
    })

    test('processBatch() 應該分離有效和無效書籍', async () => {
      // eslint-disable-next-line no-unused-vars
      const batch = [
        { id: 'book1', title: '書籍1' },
        { id: 'book2' }, // 缺少 title
        { id: 'book3', title: '書籍3' }
      ]

      // eslint-disable-next-line no-unused-vars
      const result = await processor.processBatch(batch, 'READMOO', 'test', 0, 1)

      expect(result.validBooks).toHaveLength(2)
      expect(result.invalidBooks).toHaveLength(1)
      expect(result.invalidBooks[0].book.id).toBe('book2')
    })

    test('processBatch() 應該處理記憶體管理', async () => {
      // eslint-disable-next-line no-unused-vars
      const batch = [{ id: 'book1', title: '書籍1' }]
      // eslint-disable-next-line no-unused-vars
      const result = await processor.processBatch(batch, 'READMOO', 'test', 9, 10)

      // 記憶體管理資訊應該被記錄
      expect(result.warnings.some(w => w.type === 'MEMORY_MANAGEMENT_INFO')).toBe(true)
    })

    test('processBatch() 應該處理空批次', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await processor.processBatch([], 'READMOO', 'test', 0, 1)

      expect(result.validBooks).toHaveLength(0)
      expect(result.invalidBooks).toHaveLength(0)
    })
  })

  describe('🚀 完整批次驗證流程', () => {
    test('processBatches() 應該處理多個批次', async () => {
      // eslint-disable-next-line no-unused-vars
      const books = new Array(25).fill(0).map((_, i) => ({
        id: `book${i}`,
        title: `書籍${i}`
      }))

      mockValidationRuleManager.getValidationRules.mockReturnValue({
        requiredFields: ['id', 'title'],
        dataTypes: { id: 'string', title: 'string' },
        businessRules: {}
      })

      // eslint-disable-next-line no-unused-vars
      const result = await processor.processBatches(books, 'READMOO', 'test', 'validation123')

      expect(result.validBooks).toHaveLength(25)
      expect(result.allBatches).toHaveLength(3) // 10+10+5
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'DATA.VALIDATION.PROGRESS',
        expect.objectContaining({
          validationId: 'validation123',
          platform: 'READMOO'
        })
      )
    })

    test('processBatches() 應該處理空資料', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await processor.processBatches([], 'READMOO', 'test', 'validation123')

      expect(result.validBooks).toHaveLength(0)
      expect(result.invalidBooks).toHaveLength(0)
      expect(result.allBatches).toHaveLength(0)
    })

    test('processBatches() 應該更新統計數據', async () => {
      // eslint-disable-next-line no-unused-vars
      const books = [
        { id: 'book1', title: '書籍1' },
        { id: 'book2', title: '書籍2' }
      ]

      mockValidationRuleManager.getValidationRules.mockReturnValue({
        requiredFields: ['id', 'title'],
        dataTypes: { id: 'string', title: 'string' },
        businessRules: {}
      })

      await processor.processBatches(books, 'READMOO', 'test', 'validation123')

      expect(processor.batchStatistics.totalProcessed).toBe(2)
      expect(processor.batchStatistics.batchCount).toBe(1)
    })
  })

  describe('📊 統計與監控', () => {
    test('getBatchStatistics() 應該提供批次處理統計', () => {
      processor.batchStatistics.totalProcessed = 100
      processor.batchStatistics.batchCount = 5
      processor.batchStatistics.averageBatchSize = 20

      // eslint-disable-next-line no-unused-vars
      const stats = processor.getBatchStatistics()

      expect(stats.totalProcessed).toBe(100)
      expect(stats.batchCount).toBe(5)
      expect(stats.averageBatchSize).toBe(20)
    })

    test('resetStatistics() 應該重置統計數據', () => {
      processor.batchStatistics.totalProcessed = 100
      processor.resetStatistics()

      expect(processor.batchStatistics.totalProcessed).toBe(0)
      expect(processor.batchStatistics.batchCount).toBe(0)
    })

    test('isBatchProcessorHealthy() 應該檢查服務健康狀態', () => {
      // eslint-disable-next-line no-unused-vars
      const health = processor.isBatchProcessorHealthy()

      expect(health.isHealthy).toBeDefined()
      expect(health.memoryUsage).toBeDefined()
      expect(health.lastCheck).toBeDefined()
    })
  })

  describe('🛠️ 輔助方法', () => {
    test('isCorrectType() 應該驗證資料類型', () => {
      expect(processor.isCorrectType('test', 'string')).toBe(true)
      expect(processor.isCorrectType(123, 'number')).toBe(true)
      expect(processor.isCorrectType([], 'array')).toBe(true)
      expect(processor.isCorrectType({}, 'object')).toBe(true)
      expect(processor.isCorrectType(true, 'boolean')).toBe(true)

      expect(processor.isCorrectType('test', 'number')).toBe(false)
      expect(processor.isCorrectType(123, 'string')).toBe(false)
    })

    test('generateBatchId() 應該生成唯一的批次ID', () => {
      // eslint-disable-next-line no-unused-vars
      const id1 = processor.generateBatchId()
      // eslint-disable-next-line no-unused-vars
      const id2 = processor.generateBatchId()

      expect(typeof id1).toBe('string')
      expect(typeof id2).toBe('string')
      expect(id1).not.toBe(id2)
    })
  })

  describe('⚠️ 錯誤處理', () => {
    test('constructor 應該要求 eventBus 參數', () => {
      expect(() => {
        // eslint-disable-next-line no-new
        new BatchValidationProcessor()
      }).toMatchObject({
        message: expect.stringContaining('EventBus is required')
      })
    })

    test('constructor 應該要求 validationRuleManager', () => {
      expect(() => {
        // eslint-disable-next-line no-new
        new BatchValidationProcessor(mockEventBus, { logger: mockLogger })
      }).toMatchObject({
        message: expect.stringContaining('ValidationRuleManager is required')
      })
    })

    test('應該處理驗證規則載入失敗', async () => {
      mockValidationRuleManager.getValidationRules.mockReturnValue(null)

      // eslint-disable-next-line no-unused-vars
      const book = { id: 'book1', title: '書籍1' }
      // eslint-disable-next-line no-unused-vars
      const result = await processor.validateSingleBook(book, 'INVALID_PLATFORM')

      expect(result.isValid).toBe(false)
      expect(result.errors[0].type).toBe('VALIDATION_RULES_UNAVAILABLE')
    })

    test('應該處理批次處理過程中的錯誤', async () => {
      // 模擬驗證過程中發生錯誤
      jest.spyOn(processor, 'validateSingleBook').mockRejectedValue(new Error('驗證失敗'))

      // eslint-disable-next-line no-unused-vars
      const batch = [{ id: 'book1', title: '書籍1' }]
      // eslint-disable-next-line no-unused-vars
      const result = await processor.processBatch(batch, 'READMOO', 'test', 0, 1)

      expect(result.invalidBooks).toHaveLength(1)
      expect(result.invalidBooks[0].errors[0].type).toBe('VALIDATION_ERROR')
    })
  })
})
