/**
 * @fileoverview Readmoo Platform Migration Validator 測試
 * @version v2.0.0
 * @since 2025-08-15
 *
 * 測試 Readmoo 平台在事件系統 v2.0 下的完整遷移驗證系統
 *
 * 測試覆蓋範圍：
 * - ReadmooPlatformMigrationValidator 主要驗證協調器
 * - Readmoo 特定的資料提取邏輯驗證
 * - 事件系統 v2.0 與 Readmoo 平台的整合測試
 * - 向後相容性和資料完整性驗證
 */

const ReadmooPlatformMigrationValidator = require('src/platform/readmoo-platform-migration-validator')
const EventBus = require('src/core/event-bus')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(),
      remove: jest.fn().mockResolvedValue()
    }
  }
}

describe('ReadmooPlatformMigrationValidator', () => {
  let validator
  let eventBus
  let mockReadmooAdapter
  let mockPlatformDetectionService

  beforeEach(() => {
    eventBus = new EventBus()

    // Mock Readmoo Adapter
    mockReadmooAdapter = {
      extractBookData: jest.fn(),
      isOnBookLibraryPage: jest.fn().mockReturnValue(true),
      validateExtractedData: jest.fn()
    }

    // Mock Platform Detection Service
    mockPlatformDetectionService = {
      detectPlatform: jest.fn(),
      validatePlatform: jest.fn()
    }

    validator = new ReadmooPlatformMigrationValidator({
      eventBus,
      readmooAdapter: mockReadmooAdapter,
      platformDetectionService: mockPlatformDetectionService
    })
  })

  describe('constructor', () => {
    it('應該正確初始化 ReadmooPlatformMigrationValidator', () => {
      expect(validator).toBeInstanceOf(ReadmooPlatformMigrationValidator)
      expect(validator.eventBus).toBe(eventBus)
      expect(validator.readmooAdapter).toBe(mockReadmooAdapter)
      expect(validator.platformDetectionService).toBe(mockPlatformDetectionService)
    })

    it('應該初始化預設的驗證配置', () => {
      expect(validator.config).toBeDefined()
      expect(validator.config.maxValidationRetries).toBe(3)
      expect(validator.config.validationTimeout).toBe(30000)
      expect(validator.config.requireFullCompatibility).toBe(true)
      expect(validator.config.enableDataIntegrityCheck).toBe(true)
    })

    it('應該初始化空的驗證統計', () => {
      expect(validator.validationStats).toBeDefined()
      expect(validator.validationStats.totalValidations).toBe(0)
      expect(validator.validationStats.successfulValidations).toBe(0)
      expect(validator.validationStats.failedValidations).toBe(0)
      expect(validator.validationStats.compatibilityIssues).toBe(0)
    })
  })

  describe('validateReadmooMigration', () => {
    it('應該執行完整的 Readmoo 平台遷移驗證', async () => {
      // 準備測試資料
      const validationContext = {
        url: 'https://readmoo.com/library',
        hostname: 'readmoo.com',
        userAgent: 'Mozilla/5.0 Chrome/119.0'
      }

      const mockDetectionResult = {
        platformId: 'READMOO',
        confidence: 0.95,
        features: ['url_pattern_match', 'dom_features_match'],
        capabilities: ['book_extraction', 'reading_progress']
      }

      const mockBookData = [
        {
          id: 'readmoo-book-1',
          title: '測試書籍',
          author: '測試作者',
          progress: 45,
          platform: 'READMOO'
        }
      ]

      // 設定 mock 返回值
      mockPlatformDetectionService.detectPlatform.mockResolvedValue(mockDetectionResult)
      mockPlatformDetectionService.validatePlatform.mockResolvedValue(0.95)
      mockReadmooAdapter.extractBookData.mockResolvedValue(mockBookData)
      mockReadmooAdapter.validateExtractedData.mockReturnValue(true)

      // 執行驗證
      const result = await validator.validateReadmooMigration(validationContext)

      // 驗證結果
      expect(result).toBeDefined()
      expect(result.isValid).toBe(true)
      expect(result.data.validationDetails.platformValidation.isValid).toBe(true)
      expect(result.data.validationDetails.dataExtractionValidation.isValid).toBe(true)
      expect(result.data.validationDetails.eventSystemValidation.isValid).toBe(true)
      expect(result.data.validationDetails.backwardCompatibilityValidation.isValid).toBe(true)
      expect(result.data.validationDetails.dataIntegrityValidation.isValid).toBe(true)
    })

    it('應該在平台檢測失敗時返回驗證失敗', async () => {
      const validationContext = {
        url: 'https://unknown-platform.com',
        hostname: 'unknown-platform.com'
      }

      const mockDetectionResult = {
        platformId: 'UNKNOWN',
        confidence: 0.1,
        features: [],
        error: 'Platform not recognized'
      }

      mockPlatformDetectionService.detectPlatform.mockResolvedValue(mockDetectionResult)

      const result = await validator.validateReadmooMigration(validationContext)

      expect(result.isValid).toBe(false)
      expect(result.data.validationDetails.platformValidation.isValid).toBe(false)
      expect(result.data.validationDetails.platformValidation.errors).toContain('Platform detection failed: UNKNOWN platform detected')
    })

    it('應該在資料提取失敗時返回驗證失敗', async () => {
      const validationContext = {
        url: 'https://readmoo.com/library',
        hostname: 'readmoo.com'
      }

      const mockDetectionResult = {
        platformId: 'READMOO',
        confidence: 0.95,
        features: ['url_pattern_match']
      }

      mockPlatformDetectionService.detectPlatform.mockResolvedValue(mockDetectionResult)
      mockPlatformDetectionService.validatePlatform.mockResolvedValue(0.95)
      mockReadmooAdapter.extractBookData.mockRejectedValue(new Error('Data extraction failed'))

      const result = await validator.validateReadmooMigration(validationContext)

      expect(result.isValid).toBe(false)
      expect(result.data.validationDetails.dataExtractionValidation.isValid).toBe(false)
      expect(result.data.validationDetails.dataExtractionValidation.errors).toContain('Data extraction failed: Data extraction failed')
    })

    it('應該在驗證超時時處理錯誤', async () => {
      const validationContext = {
        url: 'https://readmoo.com/library',
        hostname: 'readmoo.com'
      }

      // 模擬超時
      mockPlatformDetectionService.detectPlatform.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 35000))
      )

      const result = await validator.validateReadmooMigration(validationContext)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Unexpected validation error: Validation timeout after 30000ms')
    }, 40000)
  })

  describe('validatePlatformDetection', () => {
    it('應該驗證 Readmoo 平台檢測的正確性', async () => {
      const context = {
        url: 'https://readmoo.com/library',
        hostname: 'readmoo.com'
      }

      const mockDetectionResult = {
        platformId: 'READMOO',
        confidence: 0.95,
        features: ['url_pattern_match', 'dom_features_match']
      }

      mockPlatformDetectionService.detectPlatform.mockResolvedValue(mockDetectionResult)
      mockPlatformDetectionService.validatePlatform.mockResolvedValue(0.95)

      const result = await validator.validatePlatformDetection(context)

      expect(result.isValid).toBe(true)
      expect(result.data.detectionResult).toBe(mockDetectionResult)
      expect(result.data.confidence).toBe(0.95)
      expect(result.errors).toEqual([])
    })

    it('應該檢測信心度過低的情況', async () => {
      const context = {
        url: 'https://readmoo.com/library',
        hostname: 'readmoo.com'
      }

      const mockDetectionResult = {
        platformId: 'READMOO',
        confidence: 0.5,
        features: ['url_pattern_match']
      }

      mockPlatformDetectionService.detectPlatform.mockResolvedValue(mockDetectionResult)
      mockPlatformDetectionService.validatePlatform.mockResolvedValue(0.5)

      const result = await validator.validatePlatformDetection(context)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Low detection confidence: 0.5 (minimum required: 0.8)')
    })

    it('應該處理平台檢測錯誤', async () => {
      const context = {
        url: 'https://readmoo.com/library',
        hostname: 'readmoo.com'
      }

      mockPlatformDetectionService.detectPlatform.mockRejectedValue(new Error('Detection service error'))

      const result = await validator.validatePlatformDetection(context)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Platform detection error: Detection service error')
    })
  })

  describe('validateDataExtraction', () => {
    it('應該驗證 Readmoo 資料提取的完整性', async () => {
      const context = { url: 'https://readmoo.com/library' }

      const mockBookData = [
        {
          id: 'readmoo-book-1',
          title: '測試書籍 1',
          author: '測試作者 1',
          progress: 45,
          platform: 'READMOO'
        },
        {
          id: 'readmoo-book-2',
          title: '測試書籍 2',
          author: '測試作者 2',
          progress: 78,
          platform: 'READMOO'
        }
      ]

      mockReadmooAdapter.extractBookData.mockResolvedValue(mockBookData)
      mockReadmooAdapter.validateExtractedData.mockReturnValue(true)

      const result = await validator.validateDataExtraction(context)

      expect(result.isValid).toBe(true)
      expect(result.data.extractedData).toBe(mockBookData)
      expect(result.data.dataCount).toBe(2)
      expect(result.errors).toEqual([])
    })

    it('應該檢測資料格式不正確的情況', async () => {
      const context = { url: 'https://readmoo.com/library' }

      const invalidBookData = [
        {
          // 缺少必要欄位
          title: '測試書籍',
          platform: 'READMOO'
        }
      ]

      mockReadmooAdapter.extractBookData.mockResolvedValue(invalidBookData)
      mockReadmooAdapter.validateExtractedData.mockReturnValue(false)

      const result = await validator.validateDataExtraction(context)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Data validation failed: Invalid data format')
    })

    it('應該處理空資料的情況', async () => {
      const context = { url: 'https://readmoo.com/library' }

      mockReadmooAdapter.extractBookData.mockResolvedValue([])
      mockReadmooAdapter.validateExtractedData.mockReturnValue(true)

      const result = await validator.validateDataExtraction(context)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('No data extracted from Readmoo platform')
    })

    it('應該處理資料提取異常', async () => {
      const context = { url: 'https://readmoo.com/library' }

      mockReadmooAdapter.extractBookData.mockRejectedValue(new Error('Network error'))

      const result = await validator.validateDataExtraction(context)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Data extraction failed: Network error')
    })
  })

  describe('validateEventSystemIntegration', () => {
    it('應該驗證事件系統 v2.0 與 Readmoo 平台的整合', async () => {
      const context = { platform: 'READMOO' }

      // 設定事件監聽器
      const eventPromises = []

      eventPromises.push(new Promise(resolve => {
        eventBus.on('PLATFORM.READMOO.DETECTION.COMPLETED', resolve)
      }))

      eventPromises.push(new Promise(resolve => {
        eventBus.on('EXTRACTION.READMOO.DATA.COMPLETED', resolve)
      }))

      const result = await validator.validateEventSystemIntegration(context)

      expect(result.isValid).toBe(true)
      expect(result.data.v2EventsSupported).toBe(true)
      expect(result.data.legacyEventsSupported).toBe(true)
      expect(result.data.eventConversionAccuracy).toBeGreaterThan(0.95)
    })

    it('應該檢測事件格式轉換錯誤', async () => {
      const context = { platform: 'READMOO' }

      // 模擬事件格式錯誤
      jest.spyOn(eventBus, 'emit').mockImplementation((eventType) => {
        if (eventType.includes('PLATFORM.READMOO')) {
          throw (() => { const error = new Error( 'Invalid event format'); error.code = ErrorCodes.'INVALID_INPUT_ERROR'; error.details =  { category: 'testing' }; return error })()
        }
        return Promise.resolve()
      })

      const result = await validator.validateEventSystemIntegration(context)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Event system integration validation failed')
    })
  })

  describe('validateBackwardCompatibility', () => {
    it('應該驗證向後相容性', async () => {
      const context = { platform: 'READMOO' }

      const result = await validator.validateBackwardCompatibility(context)

      expect(result.isValid).toBe(true)
      expect(result.data.legacyEventsSupported).toBe(true)
      expect(result.data.legacyApiSupported).toBe(true)
      expect(result.data.configurationMigrated).toBe(true)
    })

    it('應該檢測向後相容性問題', async () => {
      const context = { platform: 'READMOO' }

      // 模擬舊版 API 不可用
      jest.spyOn(validator, '_checkLegacyApiSupport').mockReturnValue(false)

      const result = await validator.validateBackwardCompatibility(context)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Legacy API support validation failed')
    })
  })

  describe('validateDataIntegrity', () => {
    it('應該驗證資料完整性和一致性', async () => {
      const beforeData = [
        { id: '1', title: '書籍1', author: '作者1', progress: 50 }
      ]
      const afterData = [
        { id: '1', title: '書籍1', author: '作者1', progress: 50 }
      ]

      const result = await validator.validateDataIntegrity(beforeData, afterData)

      expect(result.isValid).toBe(true)
      expect(result.data.dataLoss).toBe(0)
      expect(result.data.dataCorruption).toBe(0)
      expect(result.data.integrityScore).toBe(1.0)
    })

    it('應該檢測資料遺失', async () => {
      const beforeData = [
        { id: '1', title: '書籍1', author: '作者1', progress: 50 },
        { id: '2', title: '書籍2', author: '作者2', progress: 75 }
      ]
      const afterData = [
        { id: '1', title: '書籍1', author: '作者1', progress: 50 }
      ]

      const result = await validator.validateDataIntegrity(beforeData, afterData)

      expect(result.isValid).toBe(false)
      expect(result.data.dataLoss).toBe(1)
      expect(result.errors).toContain('Data loss detected: 1 items missing')
    })

    it('應該檢測資料損壞', async () => {
      const beforeData = [
        { id: '1', title: '書籍1', author: '作者1', progress: 50 }
      ]
      const afterData = [
        { id: '1', title: '書籍1 (corrupted)', author: '作者1', progress: 50 }
      ]

      const result = await validator.validateDataIntegrity(beforeData, afterData)

      expect(result.isValid).toBe(false)
      expect(result.data.dataCorruption).toBe(1)
      expect(result.errors).toContain('Data corruption detected in 1 items')
    })
  })

  describe('getValidationReport', () => {
    it('應該產生完整的驗證報告', () => {
      validator.validationStats.totalValidations = 10
      validator.validationStats.successfulValidations = 8
      validator.validationStats.failedValidations = 2
      validator.validationStats.compatibilityIssues = 1

      const report = validator.getValidationReport()

      expect(report.overview.totalValidations).toBe(10)
      expect(report.overview.successRate).toBe(0.8)
      expect(report.overview.failureRate).toBe(0.2)
      expect(report.overview.compatibilityIssues).toBe(1)
      expect(report.timestamp).toBeDefined()
      expect(report.version).toBe('2.0.0')
    })

    it('應該包含詳細的驗證結果', () => {
      const report = validator.getValidationReport()

      expect(report.details).toBeDefined()
      expect(report.details.platformDetection).toBeDefined()
      expect(report.details.dataExtraction).toBeDefined()
      expect(report.details.eventSystemIntegration).toBeDefined()
      expect(report.details.backwardCompatibility).toBeDefined()
      expect(report.details.dataIntegrity).toBeDefined()
    })
  })

  describe('errorHandling', () => {
    it('應該正確處理未預期的錯誤', async () => {
      const context = { url: 'invalid-url' }

      // 模擬意外錯誤
      mockPlatformDetectionService.detectPlatform.mockImplementation(() => {
        throw (() => { const error = new Error( 'Unexpected error'); error.code = ErrorCodes.'TEST_ERROR'; error.details =  { category: 'testing' }; return error })()
      })

      const result = await validator.validateReadmooMigration(context)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Platform detection error: Unexpected error')
    })

    it('應該在多次重試後放棄', async () => {
      const context = { url: 'https://readmoo.com/library' }

      // 模擬持續失敗
      mockPlatformDetectionService.detectPlatform.mockRejectedValue(new Error('Persistent error'))

      const result = await validator.validateReadmooMigration(context)

      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('Max retries exceeded'))).toBe(true)
    })
  })

  describe('performance', () => {
    it('應該在合理時間內完成驗證', async () => {
      const context = {
        url: 'https://readmoo.com/library',
        hostname: 'readmoo.com'
      }

      // 設定快速響應的 mock
      mockPlatformDetectionService.detectPlatform.mockResolvedValue({
        platformId: 'READMOO',
        confidence: 0.95
      })
      mockReadmooAdapter.extractBookData.mockResolvedValue([
        { id: '1', title: '測試', author: '作者', progress: 50 }
      ])

      const startTime = Date.now()
      await validator.validateReadmooMigration(context)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(5000) // 5秒內完成
    })
  })
})
