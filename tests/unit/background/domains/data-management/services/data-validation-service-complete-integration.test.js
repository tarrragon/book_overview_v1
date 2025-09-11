/**
 * DataValidationService 完整整合測試
 * TDD 循環 6/8 - Green 階段：重構 DataValidationService 以整合所有子服務
 *
 * 測試目標：
 * 1. DataValidationService 能正確整合所有子服務
 * 2. 子服務間的協調和數據流正確
 * 3. 錯誤處理和容災機制有效
 * 4. 效能和資源管理最佳化
 */

const DataValidationService = require('src/background/domains/data-management/services/data-validation-service.js')

// Mock 所有子服務
const MockValidationEngine = {
  validateSingle: jest.fn(),
  validateBatch: jest.fn(),
  getValidationRules: jest.fn()
}

const MockValidationBatchProcessor = {
  processBatch: jest.fn(),
  processParallel: jest.fn(),
  getProcessingStatus: jest.fn()
}

const MockDataQualityAnalyzer = {
  analyzeQuality: jest.fn(),
  calculateQualityScore: jest.fn(),
  generateQualityReport: jest.fn()
}

const MockValidationCacheManager = {
  getCached: jest.fn(),
  setCached: jest.fn(),
  clearCache: jest.fn(),
  getCacheStats: jest.fn()
}

const MockDataNormalizationService = {
  normalize: jest.fn(),
  normalizeBatch: jest.fn(),
  getNormalizationRules: jest.fn()
}

describe('DataValidationService - 完整服務整合測試', () => {
  let dataValidationService
  let mockEventBus
  let mockLogger

  beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks()

    mockEventBus = {
      on: jest.fn(),
      emit: jest.fn().mockResolvedValue(true),
      off: jest.fn()
    }

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    }

    // 設定基本 mock 回傳值
    MockValidationEngine.validateSingle.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: []
    })

    MockValidationBatchProcessor.processBatch.mockResolvedValue({
      processed: [],
      errors: [],
      statistics: { total: 0, successful: 0, failed: 0 }
    })

    MockDataQualityAnalyzer.analyzeQuality.mockResolvedValue({
      score: 0.95,
      issues: [],
      recommendations: []
    })

    MockValidationCacheManager.getCached.mockResolvedValue(null)
    MockValidationCacheManager.setCached.mockResolvedValue(true)

    MockDataNormalizationService.normalize.mockResolvedValue({
      normalized: {},
      changes: [],
      metadata: {}
    })

    // 建立服務實例並注入 mock 依賴
    dataValidationService = new DataValidationService(mockEventBus, {
      logger: mockLogger,
      batchSize: 50 // 設定較小的批次大小以觸發批次處理
    })

    // 手動注入子服務 mock
    dataValidationService._validationEngine = MockValidationEngine
    dataValidationService._batchProcessor = MockValidationBatchProcessor
    dataValidationService._qualityAnalyzer = MockDataQualityAnalyzer
    dataValidationService._cacheManager = MockValidationCacheManager
    dataValidationService._normalizationService = MockDataNormalizationService
  })

  afterEach(() => {
    if (dataValidationService && typeof dataValidationService.destroy === 'function') {
      dataValidationService.destroy()
    }
  })

  describe('服務整合與協調', () => {
    test('應該能夠成功整合所有子服務', async () => {
      // Arrange
      const testData = {
        id: 'book-123',
        title: '測試書籍',
        author: '測試作者'
      }

      // Act
      const result = await dataValidationService.validateAndNormalize([testData], 'READMOO', 'test')

      // Assert
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(MockValidationEngine.validateSingle).toHaveBeenCalled()
      expect(MockDataNormalizationService.normalize).toHaveBeenCalled()
      expect(MockDataQualityAnalyzer.analyzeQuality).toHaveBeenCalled()
    })

    test('應該正確協調子服務的執行順序', async () => {
      // Arrange
      const testData = [{
        id: 'book-123',
        title: '測試書籍'
      }]

      const executionOrder = []

      MockValidationEngine.validateSingle.mockImplementation(async (data) => {
        executionOrder.push('validation')
        return { isValid: true, errors: [], warnings: [] }
      })

      MockDataNormalizationService.normalize.mockImplementation(async (data) => {
        executionOrder.push('normalization')
        return { normalized: data, changes: [], metadata: {} }
      })

      MockDataQualityAnalyzer.analyzeQuality.mockImplementation(async (data) => {
        executionOrder.push('quality-analysis')
        return { score: 0.95, issues: [], recommendations: [] }
      })

      // Act
      await dataValidationService.validateAndNormalize(testData, 'READMOO', 'test')

      // Assert
      expect(executionOrder).toEqual(['validation', 'normalization', 'quality-analysis'])
    })

    test('應該能夠處理子服務之間的資料傳遞', async () => {
      // Arrange
      const inputData = [{
        id: 'book-123',
        title: '原始標題'
      }]

      const normalizedData = {
        id: 'book-123',
        title: '標準化標題',
        _normalized: true
      }

      MockDataNormalizationService.normalize.mockResolvedValue({
        normalized: normalizedData,
        changes: [{ field: 'title', from: '原始標題', to: '標準化標題' }],
        metadata: { normalizationType: 'title' }
      })

      // Act
      await dataValidationService.validateAndNormalize(inputData, 'READMOO', 'test')

      // Assert
      expect(MockValidationEngine.validateSingle).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'book-123',
          title: '原始標題'
        }),
        expect.any(Object)
      )

      expect(MockDataQualityAnalyzer.analyzeQuality).toHaveBeenCalledWith(
        expect.objectContaining({
          _normalized: true
        }),
        expect.any(Object)
      )
    })
  })

  describe('快取整合', () => {
    test('應該利用快取提升效能', async () => {
      // Arrange
      const testData = [{
        id: 'book-123',
        title: '測試書籍'
      }]

      const cachedResult = {
        isValid: true,
        normalized: testData[0],
        quality: { score: 0.95 },
        timestamp: Date.now()
      }

      MockValidationCacheManager.getCached.mockResolvedValue(cachedResult)

      // Act
      const result = await dataValidationService.validateAndNormalize(testData, 'READMOO', 'test')

      // Assert
      expect(MockValidationCacheManager.getCached).toHaveBeenCalled()
      expect(MockValidationEngine.validateSingle).not.toHaveBeenCalled()
      expect(result.fromCache).toBe(true)
    })

    test('應該在快取未命中時更新快取', async () => {
      // Arrange
      const testData = [{
        id: 'book-123',
        title: '測試書籍'
      }]

      MockValidationCacheManager.getCached.mockResolvedValue(null)

      // Act
      await dataValidationService.validateAndNormalize(testData, 'READMOO', 'test')

      // Assert
      expect(MockValidationCacheManager.setCached).toHaveBeenCalled()
    })
  })

  describe('批次處理整合', () => {
    test('應該能夠處理大批量資料驗證', async () => {
      // Arrange
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        id: `book-${i}`,
        title: `書籍 ${i}`
      }))

      MockValidationBatchProcessor.processBatch.mockResolvedValue({
        processed: largeDataset,
        errors: [],
        statistics: { total: 100, successful: 100, failed: 0 }
      })

      // Act
      const result = await dataValidationService.validateAndNormalize(largeDataset, 'READMOO', 'test')

      // Assert
      expect(MockValidationBatchProcessor.processBatch).toHaveBeenCalled()
      expect(result.statistics.total).toBe(100)
    })

    test('應該能夠並行處理提升效能', async () => {
      // Arrange - 使用足夠的資料量觸發批次處理
      const testData = Array.from({ length: 100 }, (_, i) => ({
        id: `book-${i}`,
        title: `書籍 ${i}`
      }))

      MockValidationBatchProcessor.processParallel.mockResolvedValue({
        processed: testData,
        errors: [],
        statistics: { total: 100, successful: 100, failed: 0, parallelBatches: 4 }
      })

      // Act
      const result = await dataValidationService.validateAndNormalize(testData, 'READMOO', 'test', {
        useParallelProcessing: true
      })

      // Assert
      expect(MockValidationBatchProcessor.processParallel).toHaveBeenCalled()
      expect(result.statistics.parallelBatches).toBe(4)
    })
  })

  describe('錯誤處理與容災', () => {
    test('應該能夠處理子服務錯誤並進行容災', async () => {
      // Arrange
      const testData = [{
        id: 'book-123',
        title: '測試書籍'
      }]

      MockValidationEngine.validateSingle.mockRejectedValue(
        new Error('Service unavailable')
      )

      // Act
      const result = await dataValidationService.validateAndNormalize(testData, 'READMOO', 'test')

      // Assert
      expect(result.success).toBe(false)
      expect(result.errors).toContain('ValidationEngine error: Service unavailable')

      // 驗證服務錯誤事件被發出
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'VALIDATION.SERVICE.ERROR',
        expect.objectContaining({
          service: 'ValidationEngine',
          error: 'Service unavailable'
        })
      )
    })

    test('應該能夠部分成功處理並回報詳細狀態', async () => {
      // Arrange
      const testData = [
        { id: 'book-1', title: '正確書籍' },
        { id: 'book-2', title: '' } // 無效資料
      ]

      MockValidationEngine.validateSingle
        .mockResolvedValueOnce({ isValid: true, errors: [], warnings: [] })
        .mockResolvedValueOnce({
          isValid: false,
          errors: ['Title is required'],
          warnings: []
        })

      // Act
      const result = await dataValidationService.validateAndNormalize(testData, 'READMOO', 'test')

      // Assert
      expect(result.statistics.successful).toBe(1)
      expect(result.statistics.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.processed).toHaveLength(1)
    })
  })

  describe('效能監控與最佳化', () => {
    test('應該收集並回報效能指標', async () => {
      // Arrange
      const testData = [{
        id: 'book-123',
        title: '測試書籍'
      }]

      // 模擬處理時間的 mock
      MockValidationEngine.validateSingle.mockImplementation(async (data) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { isValid: true, errors: [], warnings: [] }
      })

      // Act
      const result = await dataValidationService.validateAndNormalize(testData, 'READMOO', 'test')

      // Assert
      expect(result.performanceMetrics).toBeDefined()
      expect(result.performanceMetrics.totalTime).toBeGreaterThan(0)
      expect(result.performanceMetrics.subServiceTimes).toBeDefined()
    })

    test('應該能夠基於負載動態調整子服務配置', async () => {
      // Arrange
      const heavyLoad = Array.from({ length: 1000 }, (_, i) => ({
        id: `book-${i}`,
        title: `書籍 ${i}`
      }))

      // Act
      const result = await dataValidationService.validateAndNormalize(heavyLoad, 'READMOO', 'test', {
        adaptiveOptimization: true
      })

      // Assert
      expect(result.optimizationApplied).toBe(true)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'VALIDATION.OPTIMIZATION.APPLIED',
        expect.objectContaining({
          dataSize: 1000,
          optimizations: expect.any(Array)
        })
      )
    })
  })

  describe('服務健康監控', () => {
    test('應該監控各子服務的健康狀態', () => {
      // Arrange & Act
      const healthStatus = dataValidationService.getServiceHealthStatus()

      // Assert
      expect(healthStatus).toBeDefined()
      expect(healthStatus.validationEngine).toBeDefined()
      expect(healthStatus.batchProcessor).toBeDefined()
      expect(healthStatus.qualityAnalyzer).toBeDefined()
      expect(healthStatus.cacheManager).toBeDefined()
      expect(healthStatus.normalizationService).toBeDefined()
    })

    test('應該在子服務異常時發出警告', async () => {
      // Arrange
      MockValidationEngine.validateSingle.mockImplementation(() => {
        throw new Error('Service unavailable')
      })

      // Act
      await dataValidationService.validateAndNormalize([{
        id: 'book-123',
        title: '測試書籍'
      }], 'READMOO', 'test')

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'VALIDATION.SERVICE.ERROR',
        expect.objectContaining({
          service: 'ValidationEngine',
          error: expect.any(String)
        })
      )
    })
  })
})
