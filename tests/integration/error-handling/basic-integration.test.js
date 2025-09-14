/**
 * 錯誤處理系統基本整合測試
 *
 * 測試目標：
 * - 驗證所有核心組件能夠正常工作
 * - 測試組件間的整合功能
 * - 確保修復了 StorageAPIValidator 構造函數問題
 * - 驗證基本的 console.log 替換功能
 */

const { StandardError } = require('src/core/errors/StandardError')
const { OperationResult } = require('src/core/errors/OperationResult')
const { ErrorHelper } = require('src/core/errors/ErrorHelper')
const { Logger, createLogger } = require('src/core/logging/Logger')
const { MessageDictionary, GlobalMessages } = require('src/core/messages/MessageDictionary')

// 測試 StorageAPIValidator 修復
const { StorageAPIValidator } = require('../../helpers/storage-api-validator')
const MemoryLeakDetector = require('../../helpers/memory-leak-detector')

describe('錯誤處理系統基本整合測試', () => {
  let consoleSpy

  beforeEach(() => {
    // Mock console 方法以避免測試輸出污染
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      info: jest.spyOn(console, 'info').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
      debug: jest.spyOn(console, 'debug').mockImplementation()
    }
  })

  afterEach(() => {
    // 恢復 console 方法
    Object.values(consoleSpy).forEach(spy => spy.mockRestore())
  })

  describe('核心組件基本功能驗證', () => {
    test('StandardError 基本功能正常', () => {
      // Given: 建立錯誤物件
      const error = new StandardError('TEST_ERROR', '測試錯誤', { test: true })

      // When & Then: 基本功能驗證
      expect(error.code).toBe('TEST_ERROR')
      expect(error.message).toBe('測試錯誤')
      expect(error.details.test).toBe(true)
      expect(error.id).toMatch(/^err_\d+_[a-z0-9]{9}$/)
      expect(error.timestamp).toBeGreaterThan(0)

      // JSON 序列化功能
      const json = error.toJSON()
      expect(json.code).toBe('TEST_ERROR')
      expect(json.message).toBe('測試錯誤')

      // 反序列化功能
      const restored = StandardError.fromJSON(json)
      expect(restored.code).toBe(error.code)
      expect(restored.message).toBe(error.message)
    })

    test('OperationResult 基本功能正常', () => {
      // Given & When: 建立成功結果
      const successResult = OperationResult.success({ count: 5 })

      // Then: 成功結果驗證
      expect(successResult.success).toBe(true)
      expect(!successResult.success).toBe(false)
      expect(successResult.data.count).toBe(5)
      expect(successResult.error).toBeNull()

      // Given & When: 建立失敗結果
      const error = new StandardError('FAIL_TEST', '失敗測試')
      const failureResult = OperationResult.failure(error)

      // Then: 失敗結果驗證
      expect(!failureResult.success).toBe(true)
      expect(failureResult.success).toBe(false)
      expect(failureResult.error).toBe(error)
      expect(failureResult.data).toBeNull()
    })

    test('MessageDictionary 基本功能正常', () => {
      // Given: 建立訊息字典
      const messages = new MessageDictionary()

      // When & Then: 基本功能驗證
      expect(messages.get('SUCCESS')).toBe('成功')
      expect(messages.get('FAILED')).toBe('失敗')
      expect(messages.get('UNKNOWN_KEY')).toBe('[Missing: UNKNOWN_KEY]')

      // 參數替換功能
      messages.set('TEST_MESSAGE', '測試訊息: {value}')
      expect(messages.get('TEST_MESSAGE', { value: '123' })).toBe('測試訊息: 123')
    })

    test('Logger 基本功能正常', () => {
      // Given: 建立 Logger
      const logger = createLogger('TestLogger')

      // When: 輸出各等級日誌
      logger.info('TEST_MESSAGE')
      logger.warn('WARN_MESSAGE')
      logger.error('ERROR_MESSAGE')

      // Then: 驗證 console 方法被調用
      expect(consoleSpy.info).toHaveBeenCalled()
      expect(consoleSpy.warn).toHaveBeenCalled()
      expect(consoleSpy.error).toHaveBeenCalled()

      // 驗證日誌格式
      const infoCall = consoleSpy.info.mock.calls[0]
      expect(infoCall[0]).toBe('[INFO]')
      expect(infoCall[1]).toMatchObject({
        level: 'INFO',
        name: 'TestLogger'
      })
    })

    test('ErrorHelper 工廠方法正常', () => {
      // Given & When: 使用各種工廠方法
      const networkError = ErrorHelper.createNetworkError('網路連線失敗', { url: 'https://example.com' })
      const validationError = ErrorHelper.createValidationError('email', '格式錯誤', { value: 'invalid' })
      const storageError = ErrorHelper.createStorageError('save', '儲存失敗', { reason: 'quota' })

      // Then: 驗證錯誤物件
      expect(networkError.code).toBe('NETWORK_ERROR')
      expect(networkError.message).toBe('網路連線失敗')
      expect(networkError.details.url).toBe('https://example.com')

      expect(validationError.code).toBe('VALIDATION_FAILED')
      expect(validationError.details.field).toBe('email')

      expect(storageError.code).toBe('STORAGE_ERROR')
      expect(storageError.details.operation).toBe('save')
    })
  })

  describe('組件整合功能驗證', () => {
    test('Logger 與 MessageDictionary 整合', () => {
      // Given: 設定自訂訊息
      GlobalMessages.set('CUSTOM_OPERATION', '自訂操作: {action} 完成，耗時 {duration}ms')

      const logger = createLogger('IntegrationTest')

      // When: 使用自訂訊息記錄日誌
      logger.info('CUSTOM_OPERATION', { action: '資料提取', duration: 150 })

      // Then: 驗證整合功能
      expect(consoleSpy.info).toHaveBeenCalled()
      const logCall = consoleSpy.info.mock.calls[0]
      expect(logCall[1].message).toBe('自訂操作: 資料提取 完成，耗時 150ms')
    })

    test('ErrorHelper 與 OperationResult 整合', async () => {
      // Given: 定義成功和失敗的操作
      const successOperation = async () => {
        return { books: ['book1', 'book2'], count: 2 }
      }

      const failureOperation = async () => {
        throw new StandardError('TEST_ERROR', '模擬操作失敗', { category: 'testing' })
      }

      // When: 使用 ErrorHelper 包裝操作
      const successResult = await ErrorHelper.tryOperation(successOperation, 'SUCCESS_TEST')
      const failureResult = await ErrorHelper.tryOperation(failureOperation, 'FAILURE_TEST')

      // Then: 驗證整合功能
      expect(successResult).toBeInstanceOf(OperationResult)
      expect(successResult.success).toBe(true)
      expect(successResult.data.count).toBe(2)

      expect(failureResult).toBeInstanceOf(OperationResult)
      expect(!failureResult.success).toBe(true)
      expect(failureResult.error).toBeInstanceOf(StandardError)
      expect(failureResult.error.code).toBe('FAILURE_TEST')
    })

    test('完整錯誤處理流程整合', async () => {
      // Given: 模擬書籍提取操作
      const extractBooks = async () => {
        // 模擬可能失敗的操作
        const random = Math.random()
        if (random < 0.3) {
          throw ErrorHelper.createNetworkError('網路連線異常', {
            url: 'https://readmoo.com/library',
            retryCount: 3
          })
        }
        return [
          { id: '1', title: '測試書籍1', progress: 45 },
          { id: '2', title: '測試書籍2', progress: 78 }
        ]
      }

      const logger = createLogger('BookExtraction')

      // When: 執行完整的錯誤處理流程
      logger.info('OPERATION_START')

      const result = await ErrorHelper.tryOperation(extractBooks, 'BOOK_EXTRACTION_FAILED')

      if (result.success) {
        logger.info('BOOK_EXTRACTION_COMPLETE', { count: result.data.length })
      } else {
        logger.error('BOOK_EXTRACTION_COMPLETE', {
          error: result.error.code,
          message: result.error.message
        })
      }

      // Then: 驗證整合流程
      expect(result).toBeInstanceOf(OperationResult)
      expect(consoleSpy.info).toHaveBeenCalledWith('[INFO]', expect.objectContaining({
        level: 'INFO',
        name: 'BookExtraction'
      }))

      if (!result.success) {
        expect(result.error).toBeInstanceOf(StandardError)
        expect(['NETWORK_ERROR', 'BOOK_EXTRACTION_FAILED']).toContain(result.error.code)
      }
    })
  })

  describe('StorageAPIValidator 修復驗證', () => {
    test('StorageAPIValidator 構造函數問題已修復', () => {
      // Given & When: 使用不同的構造函數調用方式

      // 方式1: 只傳入 options
      const validator1 = new StorageAPIValidator({ enableLogging: true })
      expect(validator1).toBeInstanceOf(StorageAPIValidator)
      expect(validator1.options.enableLogging).toBe(true)

      // 方式2: 傳入 testSuite 和 options
      const mockTestSuite = { setup: jest.fn() }
      const validator2 = new StorageAPIValidator(mockTestSuite, { maxRetries: 5 })
      expect(validator2).toBeInstanceOf(StorageAPIValidator)
      expect(validator2.testSuite).toBe(mockTestSuite)
      expect(validator2.options.maxRetries).toBe(5)

      // 方式3: 只傳入 testSuite
      const validator3 = new StorageAPIValidator(mockTestSuite)
      expect(validator3).toBeInstanceOf(StorageAPIValidator)
      expect(validator3.testSuite).toBe(mockTestSuite)
    })

    test('StorageAPIValidator 基本功能正常', async () => {
      // Given: 建立驗證器
      const validator = new StorageAPIValidator({ enableLogging: false })

      // When: 執行基本驗證功能
      const quotaResult = await validator.validateQuota()
      const dataResult = await validator.validateDataIntegrity({
        books: [{ id: '1', title: '測試書籍' }]
      })

      // Then: 驗證功能正常
      expect(quotaResult.valid).toBeDefined()
      expect(quotaResult.usage).toBeGreaterThan(0)
      expect(quotaResult.quota).toBeGreaterThan(0)

      expect(dataResult.valid).toBe(true)
      expect(dataResult.validations).toBeDefined()
      expect(Array.isArray(dataResult.validations)).toBe(true)
    })
  })

  describe('console.log 替換功能驗證', () => {
    test('Logger 可以替換基本的 console.log 使用', () => {
      // Given: 建立用於替換 console.log 的 logger
      const logger = createLogger('ConsoleReplacement')

      // 模擬舊的 console.log 使用方式
      // console.log('Book extracted successfully', { bookId: '123' })

      // 新的使用方式
      logger.info('BOOK_EXTRACTION_COMPLETE', { bookId: '123' })

      // Then: 驗證新方式正常工作
      expect(consoleSpy.info).toHaveBeenCalled()
      const logCall = consoleSpy.info.mock.calls[0]
      expect(logCall[0]).toBe('[INFO]')
      expect(logCall[1]).toMatchObject({
        level: 'INFO',
        name: 'ConsoleReplacement',
        data: { bookId: '123' }
      })
    })

    test('提供快速替換 console.log 的便利方法', () => {
      // Given: 使用 Logger 的直接方法來替換 console.log
      const logger = createLogger('QuickReplacement')

      // 模擬各種 console 使用場景的替換
      // 原：console.log('Processing started')
      logger.info('OPERATION_START')

      // 原：console.warn('Low storage space')
      logger.warn('STORAGE_ERROR', { message: 'Low storage space' })

      // 原：console.error('Network failed', error)
      logger.error('NETWORK_ERROR', { message: 'Connection failed' })

      // Then: 驗證所有替換都正常工作
      expect(consoleSpy.info).toHaveBeenCalled()
      expect(consoleSpy.warn).toHaveBeenCalled()
      expect(consoleSpy.error).toHaveBeenCalled()
    })
  })
})

describe('效能和記憶體使用驗證', () => {
  let memoryDetector

  beforeEach(() => {
    memoryDetector = new MemoryLeakDetector({
      memoryGrowthThreshold: 10 * 1024 * 1024, // 10MB
      leakDetectionThreshold: 1024 // 1KB per operation
    })
  })

  test('系統記憶體使用應該在限制內', async () => {
    // 使用 MemoryLeakDetector 進行精確記憶體測量
    const analysis = await memoryDetector.detectMemoryLeak(async (iteration) => {
      // Given: 建立多個組件實例
      const components = {
        errors: Array.from({ length: 10 }, (_, i) =>
          new StandardError(`TEST_ERROR_${i}`, `錯誤 ${i}`, { index: i })
        ),
        results: Array.from({ length: 10 }, (_, i) =>
          OperationResult.success({ id: i, data: `result_${i}` })
        ),
        logger: createLogger('MemoryTest'),
        messages: new MessageDictionary()
      }

      // When: 執行操作以測試記憶體使用
      components.errors.forEach(err => err.toJSON())
      components.results.forEach(res => res.toJSON())
      components.logger.info('MEMORY_TEST', { iteration })
      
      // 模擬清理操作
      components.errors.length = 0
      components.results.length = 0
    }, 20, { testName: 'error-handling-system-memory' })

    console.log('📊 錯誤處理系統記憶體分析:')
    console.log(`  平均每操作記憶體增長: ${analysis.leakDetection.formattedAverageGrowth}`)
    console.log(`  記憶體效率: ${(analysis.efficiency.overallEfficiency * 100).toFixed(1)}%`)
    console.log(`  洩漏嚴重程度: ${analysis.leakDetection.leakSeverity}`)
    console.log(`  記憶體回收率: ${(analysis.efficiency.memoryRecoveryRate * 100).toFixed(1)}%`)

    // Then: 記憶體使用應該在合理範圍內
    expect(analysis.hasMemoryLeak).toBe(false)
    expect(analysis.passesThresholds.overallOk).toBe(true)
    expect(analysis.leakDetection.leakSeverity).not.toBe('critical')
    expect(analysis.leakDetection.leakSeverity).not.toBe('high')
    
    // 記憶體效率應該良好
    expect(analysis.efficiency.overallEfficiency).toBeGreaterThan(0.7)
  })

  test('系統響應時間應該在限制內', async () => {
    // Given: 準備測試操作
    const operations = [
      () => new StandardError('PERF_TEST', '效能測試'),
      () => OperationResult.success({ test: true }),
      () => ErrorHelper.createNetworkError('測試'),
      () => {
        const logger = createLogger('PerfTest')
        logger.info('TEST_MESSAGE')
      }
    ]

    // When: 測量操作時間
    const timings = []
    for (const operation of operations) {
      const start = process.hrtime.bigint()
      operation()
      const end = process.hrtime.bigint()
      timings.push(Number(end - start) / 1000000) // 轉換為毫秒
    }

    const totalTime = timings.reduce((sum, time) => sum + time, 0)

    // Then: 系統響應時間應該在限制內
    expect(totalTime).toBeLessThan(5) // 總時間<5ms
    timings.forEach(time => {
      expect(time).toBeLessThan(2) // 每個操作<2ms
    })
  })
})
