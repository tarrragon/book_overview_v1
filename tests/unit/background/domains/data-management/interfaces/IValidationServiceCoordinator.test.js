/**
 * IValidationServiceCoordinator 介面測試
 *
 * 測試目標：
 * - 驗證驗證服務協調器介面契約
 * - 測試統一驗證服務管理、事件協調和服務整合功能
 * - 確保驗證服務的協調性和一致性
 * - 驗證事件系統整合和錯誤處理機制
 *
 * @jest-environment jsdom
 */

describe('IValidationServiceCoordinator TDD 介面契約測試', () => {
  let validationServiceCoordinator
  let mockEventBus
  let mockValidationEngine
  let mockDataQualityAnalyzer
  let mockValidationBatchProcessor
  let mockValidationCacheManager
  let mockPlatformRuleManager
  let mockDataNormalizationService

  beforeEach(() => {
    // Mock 事件總線
    mockEventBus = {
      emit: jest.fn().mockResolvedValue(),
      on: jest.fn(),
      off: jest.fn(),
      once: jest.fn()
    }

    // Mock 驗證引擎
    mockValidationEngine = {
      validateSingleBook: jest.fn(),
      validateBatch: jest.fn(),
      getStatistics: jest.fn().mockReturnValue({ totalOperations: 100, successRate: 0.95 }),
      isInitialized: true
    }

    // Mock 資料品質分析器
    mockDataQualityAnalyzer = {
      analyzeBookQuality: jest.fn(),
      analyzeBatchQuality: jest.fn(),
      getStatistics: jest.fn().mockReturnValue({ totalOperations: 80, averageScore: 85 }),
      isInitialized: true
    }

    // Mock 批次處理器
    mockValidationBatchProcessor = {
      processBatch: jest.fn(),
      processWithPriority: jest.fn(),
      processParallel: jest.fn(),
      getBatchStatus: jest.fn().mockReturnValue(null),
      cancelBatch: jest.fn().mockResolvedValue({ success: false, message: 'Validation not found' }),
      pauseBatch: jest.fn().mockResolvedValue({ success: false, message: 'Validation not found' }),
      resumeBatch: jest.fn().mockResolvedValue({ success: false, message: 'Validation not found' }),
      getProcessingStatistics: jest.fn().mockReturnValue({ totalOperations: 60, averageProcessingTime: 1000 }),
      isInitialized: true
    }

    // Mock 快取管理器
    mockValidationCacheManager = {
      cacheValidationResult: jest.fn().mockResolvedValue({ cached: true }),
      getCachedValidation: jest.fn(),
      cacheQualityAnalysis: jest.fn().mockResolvedValue({ cached: true }),
      getCachedQuality: jest.fn(),
      cachePlatformRules: jest.fn(),
      getCachedRules: jest.fn(),
      invalidateCache: jest.fn().mockResolvedValue({ invalidated: [] }),
      clearCache: jest.fn(),
      getStatistics: jest.fn().mockReturnValue({ totalOperations: 50, hitRate: 0.78, cacheSize: 500 }),
      optimizeCache: jest.fn(),
      isInitialized: true
    }

    // Mock 平台規則管理器
    mockPlatformRuleManager = {
      getRulesForPlatform: jest.fn(),
      getPlatformSchema: jest.fn(),
      loadPlatformRules: jest.fn().mockResolvedValue({ success: true }),
      isRuleSupported: jest.fn(),
      getFieldRequirements: jest.fn(),
      validatePlatformSupport: jest.fn().mockReturnValue({ isSupported: true }),
      clearPlatformCache: jest.fn().mockReturnValue({ success: true }),
      loadAllPlatforms: jest.fn(),
      getRuleVersion: jest.fn(),
      getStatistics: jest.fn().mockReturnValue({ totalRules: 10, loadedPlatforms: 5 }),
      isInitialized: true
    }

    // Mock 資料標準化服務
    mockDataNormalizationService = {
      normalizeBook: jest.fn(),
      normalizeBatch: jest.fn(),
      generateDataFingerprint: jest.fn(),
      validateNormalizedData: jest.fn(),
      getStatistics: jest.fn().mockReturnValue({ totalOperations: 40, normalizationRate: 0.9 }),
      isInitialized: true
    }

    // 實例化 ValidationServiceCoordinator
    const ValidationServiceCoordinator = require('../../../../../../src/background/domains/data-management/services/ValidationServiceCoordinator.js')
    validationServiceCoordinator = new ValidationServiceCoordinator({
      eventBus: mockEventBus,
      validationEngine: mockValidationEngine,
      dataQualityAnalyzer: mockDataQualityAnalyzer,
      validationBatchProcessor: mockValidationBatchProcessor,
      validationCacheManager: mockValidationCacheManager,
      platformRuleManager: mockPlatformRuleManager,
      dataNormalizationService: mockDataNormalizationService
    })
  })

  describe('🔴 Red 階段：介面契約驗證', () => {
    test('應該正確實作 IValidationServiceCoordinator 介面', () => {
      // Given: ValidationServiceCoordinator 實例

      // Then: 應該實作所有必要的介面方法
      expect(typeof validationServiceCoordinator.validateAndNormalize).toBe('function')
      expect(typeof validationServiceCoordinator.processBatchValidation).toBe('function')
      expect(typeof validationServiceCoordinator.processHighQualityValidation).toBe('function')
      expect(typeof validationServiceCoordinator.processPriorityValidation).toBe('function')
      expect(typeof validationServiceCoordinator.processParallelValidation).toBe('function')
      expect(typeof validationServiceCoordinator.getValidationStatus).toBe('function')
      expect(typeof validationServiceCoordinator.cancelValidation).toBe('function')
      expect(typeof validationServiceCoordinator.pauseValidation).toBe('function')
      expect(typeof validationServiceCoordinator.resumeValidation).toBe('function')
      expect(typeof validationServiceCoordinator.getServiceStatistics).toBe('function')
      expect(typeof validationServiceCoordinator.optimizeServices).toBe('function')
      expect(typeof validationServiceCoordinator.clearServiceCache).toBe('function')
      expect(validationServiceCoordinator.isInitialized).toBeDefined()
    })

    test('validateAndNormalize() 應該協調完整的驗證流程', async () => {
      // Given: 書籍資料和驗證配置
      const books = [
        {
          id: 'book_1',
          title: '測試書籍一',
          authors: ['作者A'],
          progress: { percentage: 75 }
        },
        {
          id: 'book_2',
          title: '測試書籍二',
          authors: ['作者B'],
          progress: { percentage: 100 }
        }
      ]
      const platform = 'READMOO'
      const options = {
        enableQualityAnalysis: true,
        enableCaching: true,
        enableNormalization: true,
        strictValidation: false
      }

      // Mock 服務回應
      mockValidationEngine.validateBatch.mockResolvedValue({
        validBooks: books,
        invalidBooks: [],
        validationSummary: { total: 2, valid: 2, invalid: 0 }
      })

      mockDataQualityAnalyzer.analyzeBatchQuality.mockResolvedValue({
        overallScore: 90,
        individualResults: [
          { bookId: 'book_1', score: 88 },
          { bookId: 'book_2', score: 92 }
        ]
      })

      mockDataNormalizationService.normalizeBatch.mockResolvedValue([
        { id: 'book_1', title: '測試書籍一', crossPlatformId: 'cross_1' },
        { id: 'book_2', title: '測試書籍二', crossPlatformId: 'cross_2' }
      ])

      // When: 執行驗證和標準化
      const result = await validationServiceCoordinator.validateAndNormalize(books, platform, options)

      // Then: 應該返回完整的驗證結果
      expect(result).toHaveProperty('validationId')
      expect(result).toHaveProperty('platform', platform)
      expect(result).toHaveProperty('totalBooks', 2)
      expect(result).toHaveProperty('validBooks')
      expect(result).toHaveProperty('invalidBooks')
      expect(result).toHaveProperty('qualityAnalysis')
      expect(result).toHaveProperty('normalizedBooks')
      expect(result).toHaveProperty('processingTime')
      expect(result).toHaveProperty('coordinationSummary')

      // 驗證服務協調
      expect(mockValidationEngine.validateBatch).toHaveBeenCalledWith(books, platform, expect.any(Object))
      expect(mockDataQualityAnalyzer.analyzeBatchQuality).toHaveBeenCalled()
      expect(mockDataNormalizationService.normalizeBatch).toHaveBeenCalled()
      expect(mockEventBus.emit).toHaveBeenCalledWith('VALIDATION.COORDINATION.STARTED', expect.any(Object))
    })

    test('processBatchValidation() 應該支援大規模批次處理', async () => {
      // Given: 大量書籍資料
      const books = Array.from({ length: 50 }, (_, i) => ({
        id: `book_${i + 1}`,
        title: `測試書籍${i + 1}`,
        authors: [`作者${i + 1}`]
      }))
      const platform = 'READMOO'
      const batchOptions = {
        batchSize: 10,
        maxConcurrency: 3,
        enableProgressTracking: true,
        progressCallback: jest.fn()
      }

      // Mock 批次處理器回應，模擬會調用 progressCallback
      mockValidationBatchProcessor.processBatch.mockImplementation(async (books, platform, options) => {
        // 模擬進度回調調用
        if (options.progressCallback) {
          options.progressCallback({ percentage: 50, processed: 25, total: 50 })
          options.progressCallback({ percentage: 100, processed: 50, total: 50 })
        }
        return {
          batchId: 'batch_123',
          totalBooks: 50,
          processedBooks: 50,
          validBooks: 48,
          invalidBooks: 2,
          processingTime: 5000,
          batchSummary: { validationRate: 0.96 }
        }
      })

      // When: 執行批次驗證
      const result = await validationServiceCoordinator.processBatchValidation(books, platform, batchOptions)

      // Then: 應該返回批次處理結果
      expect(result).toHaveProperty('batchId')
      expect(result).toHaveProperty('coordinationStatus', 'completed')
      expect(result).toHaveProperty('serviceUtilization')
      expect(result).toHaveProperty('cacheEfficiency')
      expect(result).toHaveProperty('qualityMetrics')
      expect(mockValidationBatchProcessor.processBatch).toHaveBeenCalledWith(books, platform, expect.any(Object))
      expect(batchOptions.progressCallback).toHaveBeenCalled()
    })

    test('processHighQualityValidation() 應該支援高品質驗證模式', async () => {
      // Given: 需要高品質驗證的書籍
      const books = [
        {
          id: 'premium_book_1',
          title: '重要文獻',
          authors: ['知名作者'],
          isbn: '9781234567890'
        }
      ]
      const platform = 'READMOO'
      const qualityOptions = {
        strictValidation: true,
        deepQualityAnalysis: true,
        enableAdvancedNormalization: true,
        qualityThreshold: 95
      }

      // Mock 高品質服務回應
      mockValidationEngine.validateBatch.mockResolvedValue({
        validBooks: books,
        invalidBooks: [],
        validationSummary: { strictModeEnabled: true }
      })

      mockDataQualityAnalyzer.analyzeBatchQuality.mockResolvedValue({
        overallScore: 96,
        deepAnalysis: { completeness: 98, accuracy: 95, consistency: 97 }
      })

      // When: 執行高品質驗證
      const result = await validationServiceCoordinator.processHighQualityValidation(books, platform, qualityOptions)

      // Then: 應該應用高品質標準
      expect(result).toHaveProperty('qualityStandard', 'HIGH')
      expect(result).toHaveProperty('strictValidation', true)
      expect(result).toHaveProperty('qualityScore')
      expect(result.qualityScore).toBeGreaterThanOrEqual(95)
      expect(mockValidationEngine.validateBatch).toHaveBeenCalledWith(books, platform, expect.objectContaining({
        strictValidation: true
      }))
    })

    test('processPriorityValidation() 應該支援優先級處理', async () => {
      // Given: 具有不同優先級的批次
      const prioritizedBatches = [
        {
          priority: 'urgent',
          books: [{ id: 'urgent_1', title: '緊急處理書籍' }],
          deadline: new Date(Date.now() + 30000)
        },
        {
          priority: 'high',
          books: [{ id: 'high_1', title: '高優先級書籍' }],
          deadline: new Date(Date.now() + 300000)
        },
        {
          priority: 'normal',
          books: [{ id: 'normal_1', title: '一般書籍' }]
        }
      ]
      const platform = 'READMOO'

      // Mock 優先級處理回應
      mockValidationBatchProcessor.processWithPriority.mockResolvedValue({
        priorityOrder: ['urgent', 'high', 'normal'],
        batchResults: [
          { priority: 'urgent', batchId: 'urgent_batch', result: { validBooks: 1 } },
          { priority: 'high', batchId: 'high_batch', result: { validBooks: 1 } },
          { priority: 'normal', batchId: 'normal_batch', result: { validBooks: 1 } }
        ]
      })

      // When: 執行優先級處理
      const result = await validationServiceCoordinator.processPriorityValidation(prioritizedBatches, platform)

      // Then: 應該按優先級順序處理
      expect(result).toHaveProperty('priorityExecution', true)
      expect(result).toHaveProperty('executionOrder')
      expect(result).toHaveProperty('deadlineCompliance')
      expect(result.executionOrder).toEqual(['urgent', 'high', 'normal'])
      expect(mockValidationBatchProcessor.processWithPriority).toHaveBeenCalled()
    })

    test('processParallelValidation() 應該支援並行驗證', async () => {
      // Given: 多個獨立平台的驗證任務
      const parallelTasks = [
        {
          taskId: 'readmoo_task',
          books: [{ id: 'rm_1', title: 'Readmoo書籍' }],
          platform: 'READMOO'
        },
        {
          taskId: 'kindle_task',
          books: [{ id: 'kd_1', title: 'Kindle書籍' }],
          platform: 'KINDLE'
        }
      ]
      const parallelOptions = {
        maxParallelTasks: 2,
        enableCrossTaskOptimization: true
      }

      // Mock 並行處理回應
      mockValidationBatchProcessor.processParallel.mockResolvedValue({
        parallelResults: [
          { taskId: 'readmoo_task', success: true, result: { validBooks: 1 } },
          { taskId: 'kindle_task', success: true, result: { validBooks: 1 } }
        ],
        concurrentTasks: 2
      })

      // When: 執行並行驗證
      const result = await validationServiceCoordinator.processParallelValidation(parallelTasks, parallelOptions)

      // Then: 應該並行處理所有任務
      expect(result).toHaveProperty('parallelExecution', true)
      expect(result).toHaveProperty('concurrentTasks', 2)
      expect(result).toHaveProperty('crossTaskOptimization')
      expect(result).toHaveProperty('resourceUtilization')
      expect(mockValidationBatchProcessor.processParallel).toHaveBeenCalled()
    })

    test('getValidationStatus() 應該提供詳細狀態資訊', async () => {
      // Given: 創建一個活躍的協調狀態
      const validationId = 'validation_123'
      
      // 先啟動一個驗證來創建活躍狀態
      const books = [{ id: 'test_book', title: '測試書籍' }]
      const platform = 'READMOO'
      
      // Mock 服務回應
      mockValidationEngine.validateBatch.mockResolvedValue({
        validBooks: books,
        invalidBooks: [],
        validationSummary: { total: 1, valid: 1, invalid: 0 }
      })

      // 啟動驗證（但不等待完成）
      const validationPromise = validationServiceCoordinator.validateAndNormalize(books, platform)
      
      // 獲取生成的協調ID
      const activeKeys = Array.from(validationServiceCoordinator.activeCoordinations.keys())
      const actualValidationId = activeKeys[0]

      // When: 查詢驗證狀態
      const status = validationServiceCoordinator.getValidationStatus(actualValidationId)

      // Then: 應該返回完整狀態資訊
      expect(status).toHaveProperty('validationId')
      expect(status).toHaveProperty('coordinationStatus')
      expect(status).toHaveProperty('serviceStatus')
      expect(status).toHaveProperty('progress')
      expect(status).toHaveProperty('currentPhase')
      expect(status.serviceStatus).toHaveProperty('validationEngine')
      expect(status.serviceStatus).toHaveProperty('dataQualityAnalyzer')
      expect(status.serviceStatus).toHaveProperty('validationBatchProcessor')
      expect(status.serviceStatus).toHaveProperty('validationCacheManager')

      // 等待驗證完成以清理狀態
      await validationPromise
    })

    test('cancelValidation() 和 pauseValidation()/resumeValidation() 應該支援流程控制', async () => {
      // Given: 創建一個活躍的協調狀態
      const books = [{ id: 'control_book', title: '控制測試書籍' }]
      const platform = 'READMOO'
      
      // Mock 服務回應
      mockValidationEngine.validateBatch.mockImplementation(async () => {
        // 模擬長時間處理
        await new Promise(resolve => setTimeout(resolve, 100))
        return {
          validBooks: books,
          invalidBooks: [],
          validationSummary: { total: 1, valid: 1, invalid: 0 }
        }
      })

      // 啟動驗證（不等待完成）
      const validationPromise = validationServiceCoordinator.validateAndNormalize(books, platform)
      
      // 獲取生成的協調ID
      const activeKeys = Array.from(validationServiceCoordinator.activeCoordinations.keys())
      const actualValidationId = activeKeys[0]

      // Mock 控制操作回應
      mockValidationBatchProcessor.cancelBatch.mockResolvedValue({
        success: true,
        batchId: actualValidationId,
        cancelledAt: Date.now()
      })

      mockValidationBatchProcessor.pauseBatch.mockResolvedValue({
        success: true,
        batchId: actualValidationId,
        pausedAt: Date.now()
      })

      mockValidationBatchProcessor.resumeBatch.mockResolvedValue({
        success: true,
        batchId: actualValidationId,
        resumedAt: Date.now()
      })

      // When & Then: 取消驗證
      const cancelResult = await validationServiceCoordinator.cancelValidation(actualValidationId)
      expect(cancelResult).toHaveProperty('success', true)
      expect(cancelResult).toHaveProperty('coordinationCleanup', true)
      expect(mockValidationBatchProcessor.cancelBatch).toHaveBeenCalledWith(actualValidationId)

      // When & Then: 暫停驗證（對於不存在的ID，應該由 Mock 決定回應）
      mockValidationBatchProcessor.pauseBatch.mockResolvedValueOnce({
        success: false,
        message: 'Batch not found'
      })
      
      const pauseResult = await validationServiceCoordinator.pauseValidation('non_existent_id')
      expect(pauseResult).toHaveProperty('success', false)

      // When & Then: 恢復驗證（對於不存在的ID，應該由 Mock 決定回應）
      mockValidationBatchProcessor.resumeBatch.mockResolvedValueOnce({
        success: false,
        message: 'Batch not found'
      })
      
      const resumeResult = await validationServiceCoordinator.resumeValidation('non_existent_id')
      expect(resumeResult).toHaveProperty('success', false)

      // 等待原始驗證完成（如果還在運行）
      try {
        await validationPromise
      } catch (error) {
        // 預期可能會因為取消而失敗
      }
    })

    test('getServiceStatistics() 應該提供統合服務統計', () => {
      // Given: 各服務的統計資料
      mockValidationEngine.getStatistics.mockReturnValue({
        totalValidations: 100,
        successRate: 0.95
      })

      mockDataQualityAnalyzer.getStatistics.mockReturnValue({
        totalAnalyses: 90,
        averageScore: 85
      })

      mockValidationBatchProcessor.getProcessingStatistics.mockReturnValue({
        totalBatches: 10,
        averageProcessingTime: 5000
      })

      mockValidationCacheManager.getStatistics.mockReturnValue({
        hitRate: 0.78,
        cacheSize: 500
      })

      // When: 獲取統合統計
      const stats = validationServiceCoordinator.getServiceStatistics()

      // Then: 應該包含所有服務的統計
      expect(stats).toHaveProperty('coordinationStatistics')
      expect(stats).toHaveProperty('serviceStatistics')
      expect(stats).toHaveProperty('performanceMetrics')
      expect(stats).toHaveProperty('resourceUtilization')
      expect(stats.serviceStatistics).toHaveProperty('validationEngine')
      expect(stats.serviceStatistics).toHaveProperty('qualityAnalyzer')
      expect(stats.serviceStatistics).toHaveProperty('batchProcessor')
      expect(stats.serviceStatistics).toHaveProperty('cacheManager')
      expect(stats.performanceMetrics).toHaveProperty('totalThroughput')
      expect(stats.performanceMetrics).toHaveProperty('averageLatency')
    })

    test('optimizeServices() 應該執行服務優化', async () => {
      // Given: 優化配置
      const optimizationOptions = {
        optimizeCache: true,
        rebalanceWorkload: true,
        updateConfiguration: true,
        cleanupResources: true
      }

      // Mock 優化操作回應
      mockValidationCacheManager.optimizeCache.mockResolvedValue({
        optimized: true,
        expiredRemoved: 10,
        memoryCompacted: true
      })

      // When: 執行服務優化
      const result = await validationServiceCoordinator.optimizeServices(optimizationOptions)

      // Then: 應該執行所有優化操作
      expect(result).toHaveProperty('optimizationCompleted', true)
      expect(result).toHaveProperty('cacheOptimization')
      expect(result).toHaveProperty('workloadRebalancing')
      expect(result).toHaveProperty('configurationUpdates')
      expect(result).toHaveProperty('resourceCleanup')
      expect(result).toHaveProperty('performanceImprovement')
      expect(mockValidationCacheManager.optimizeCache).toHaveBeenCalled()
    })

    test('clearServiceCache() 應該支援快取清理策略', async () => {
      // Given: 快取清理選項
      const clearOptions = {
        level: 'all',
        preserveRules: true,
        preserveStatistics: false
      }

      // Mock 快取清理回應
      mockValidationCacheManager.clearCache.mockResolvedValue({
        cleared: true,
        itemsCleared: 150,
        preserveRules: true
      })

      mockPlatformRuleManager.clearPlatformCache.mockReturnValue({
        success: true,
        platform: 'READMOO'
      })

      // When: 執行快取清理
      const result = await validationServiceCoordinator.clearServiceCache(clearOptions)

      // Then: 應該執行協調的快取清理
      expect(result).toHaveProperty('cacheCleared', true)
      expect(result).toHaveProperty('validationCache')
      expect(result).toHaveProperty('platformCache')
      expect(result).toHaveProperty('coordinationCleanup')
      expect(result).toHaveProperty('totalItemsCleared')
      expect(mockValidationCacheManager.clearCache).toHaveBeenCalledWith(clearOptions)
    })

    test('應該處理服務初始化和依賴檢查', async () => {
      // Given: 未完全初始化的服務
      const incompleteServices = {
        eventBus: mockEventBus,
        validationEngine: { ...mockValidationEngine, isInitialized: false },
        dataQualityAnalyzer: mockDataQualityAnalyzer,
        validationBatchProcessor: mockValidationBatchProcessor,
        validationCacheManager: mockValidationCacheManager,
        platformRuleManager: mockPlatformRuleManager,
        dataNormalizationService: mockDataNormalizationService
      }

      // When & Then: 應該拋出依賴檢查錯誤
      expect(() => {
        new (require('../../../../../../src/background/domains/data-management/services/ValidationServiceCoordinator.js'))(incompleteServices)
      }).toThrow('ValidationEngine is not properly initialized')
    })

    test('應該處理事件協調和錯誤傳播', async () => {
      // Given: 會產生錯誤的服務
      const books = [{ id: 'error_book', title: 'Error Book' }]
      const platform = 'READMOO'

      mockValidationEngine.validateBatch.mockRejectedValue(new Error('驗證引擎錯誤'))

      // When: 驗證過程發生錯誤
      await expect(
        validationServiceCoordinator.validateAndNormalize(books, platform)
      ).rejects.toThrow('驗證引擎錯誤')

      // Then: 應該發送錯誤事件
      expect(mockEventBus.emit).toHaveBeenCalledWith('VALIDATION.COORDINATION.FAILED', expect.objectContaining({
        error: expect.stringContaining('驗證引擎錯誤')
      }))
    })

    test('應該支援自訂驗證策略和配置', async () => {
      // Given: 自訂驗證策略
      const books = [{ id: 'custom_book', title: 'Custom Book' }]
      const platform = 'READMOO'
      const customStrategy = {
        validationStrategy: 'COMPREHENSIVE',
        qualityAnalysisLevel: 'DEEP',
        normalizationMode: 'STRICT',
        cacheStrategy: 'AGGRESSIVE',
        errorHandling: 'FAULT_TOLERANT'
      }

      // Mock 自訂策略回應
      mockValidationEngine.validateBatch.mockResolvedValue({
        validBooks: books,
        invalidBooks: [],
        strategyApplied: 'COMPREHENSIVE'
      })

      // When: 使用自訂策略驗證
      const result = await validationServiceCoordinator.validateAndNormalize(books, platform, customStrategy)

      // Then: 應該應用自訂策略並包含在結果中
      expect(result).toHaveProperty('validBooks')
      expect(result.validBooks).toEqual(books)
      expect(result).toHaveProperty('coordinationSummary')
      expect(result.coordinationSummary).toHaveProperty('servicesUsed')
      expect(mockValidationEngine.validateBatch).toHaveBeenCalledWith(books, platform, expect.objectContaining({
        validationStrategy: 'COMPREHENSIVE',
        coordinationId: expect.any(String)
      }))
    })
  })
})