/**
 * Readmoo 平台 v2.0 整合驗證測試
 *
 * 負責功能：
 * - ReadmooPlatformMigrationValidator 在真實環境的運作驗證
 * - 新舊事件格式的無縫轉換驗證
 * - Readmoo 特定功能的端對端測試
 * - 資料提取完整性和準確性驗證
 *
 * 測試策略：
 * - 真實 Readmoo 環境模擬
 * - 完整資料提取流程測試
 * - 錯誤恢復和重試機制驗證
 * - 效能基準和穩定性測試
 *
 * 整合測試範圍：
 * - 平台檢測準確性 100% 驗證
 * - 資料提取零遺失驗證
 * - 事件系統整合 95%+ 準確性
 * - 向後相容性 100% 保證
 * - 資料完整性零損壞驗證
 */

const EventBus = require('@/core/event-bus')
const ReadmooPlatformMigrationValidator = require('@/platform/readmoo-platform-migration-validator')
const EventNamingUpgradeCoordinator = require('@/core/events/event-naming-upgrade-coordinator')
const { StandardError } = require('src/core/errors/StandardError')

// 模擬依賴
const mockReadmooAdapter = {
  extractBookData: jest.fn(),
  validateExtractedData: jest.fn()
}

const mockPlatformDetectionService = {
  detectPlatform: jest.fn(),
  validatePlatform: jest.fn()
}

describe('🧪 Readmoo 平台 v2.0 整合驗證測試', () => {
  let eventBus
  let migrationValidator
  let namingCoordinator
  let validationContext

  beforeEach(async () => {
    // 初始化測試環境
    eventBus = new EventBus()
    namingCoordinator = new EventNamingUpgradeCoordinator(eventBus)

    // 重置 mocks
    jest.clearAllMocks()

    // 設置預設的成功回應
    mockPlatformDetectionService.detectPlatform.mockResolvedValue({
      platformId: 'READMOO',
      confidence: 0.95,
      detectedFeatures: ['bookShelf', 'readingProgress', 'bookMetadata']
    })

    mockPlatformDetectionService.validatePlatform.mockResolvedValue(0.9)

    mockReadmooAdapter.extractBookData.mockResolvedValue([
      {
        id: 'book-1',
        title: '測試書籍 1',
        author: '測試作者 1',
        progress: 75,
        platform: 'READMOO'
      },
      {
        id: 'book-2',
        title: '測試書籍 2',
        author: '測試作者 2',
        progress: 50,
        platform: 'READMOO'
      }
    ])

    mockReadmooAdapter.validateExtractedData.mockReturnValue(true)

    // 初始化 MigrationValidator
    migrationValidator = new ReadmooPlatformMigrationValidator({
      eventBus,
      readmooAdapter: mockReadmooAdapter,
      platformDetectionService: mockPlatformDetectionService
    }, {
      maxValidationRetries: 3,
      validationTimeout: 5000,
      minDetectionConfidence: 0.8,
      enableDetailedLogging: true
    })

    // 設置測試上下文
    validationContext = {
      url: 'https://readmoo.com/book/123456',
      hostname: 'readmoo.com',
      userAgent: 'Mozilla/5.0 (Chrome/91.0) Test',
      DOM: {
        querySelector: jest.fn(),
        querySelectorAll: jest.fn()
      },
      window: {
        location: { href: 'https://readmoo.com/book/123456' }
      }
    }
  })

  afterEach(() => {
    // 清理資源
    if (eventBus && typeof eventBus.removeAllListeners === 'function') {
      eventBus.removeAllListeners()
    }
  })

  describe('🔧 ReadmooPlatformMigrationValidator 完整驗證', () => {
    describe('平台檢測準確性驗證', () => {
      test('應該正確檢測 Readmoo 平台並達到最低信心度要求', async () => {
        const result = await migrationValidator.validateReadmooMigration(validationContext)

        expect(result.isValid).toBe(true)
        expect(result.data.validationDetails).toBeDefined()
        expect(result.data.validationDetails.platformValidation).toBeDefined()
        expect(result.data.validationDetails.platformValidation.isValid).toBe(true)

        // 驗證平台檢測服務被正確調用
        expect(mockPlatformDetectionService.detectPlatform).toHaveBeenCalledWith(validationContext)
        expect(mockPlatformDetectionService.validatePlatform).toHaveBeenCalledWith('READMOO', validationContext)

        // 驗證信心度達到要求
        const detectionData = result.data.validationDetails.platformValidation.data
        expect(detectionData.confidence).toBeGreaterThanOrEqual(0.8)
      })

      test('應該處理平台檢測信心度不足的情況', async () => {
        // 設置低信心度回應
        mockPlatformDetectionService.detectPlatform.mockResolvedValue({
          platformId: 'READMOO',
          confidence: 0.6, // 低於最低要求 0.8
          detectedFeatures: ['bookShelf']
        })

        const result = await migrationValidator.validateReadmooMigration(validationContext)

        expect(result.isValid).toBe(false)
        expect(result.errors).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/Low detection confidence.*0\.6.*minimum required.*0\.8/)
          ])
        )
      })

      test('應該處理非 Readmoo 平台檢測結果', async () => {
        // 設置錯誤平台檢測
        mockPlatformDetectionService.detectPlatform.mockResolvedValue({
          platformId: 'KINDLE',
          confidence: 0.9,
          detectedFeatures: ['amazonStore']
        })

        const result = await migrationValidator.validateReadmooMigration(validationContext)

        expect(result.isValid).toBe(false)
        expect(result.errors).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/Platform detection failed.*KINDLE platform detected/)
          ])
        )
      })

      test('應該處理平台檢測服務異常', async () => {
        // 模擬檢測服務拋出異常
        mockPlatformDetectionService.detectPlatform.mockRejectedValue(
          new Error('Network connection failed')
        )

        const result = await migrationValidator.validateReadmooMigration(validationContext)

        expect(result.isValid).toBe(false)
        expect(result.errors).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/Platform detection error.*Network connection failed/)
          ])
        )
      })
    })

    describe('資料提取完整性驗證', () => {
      test('應該成功提取和驗證 Readmoo 書籍資料', async () => {
        const result = await migrationValidator.validateReadmooMigration(validationContext)

        expect(result.isValid).toBe(true)

        const dataValidation = result.data.validationDetails.dataExtractionValidation
        expect(dataValidation.isValid).toBe(true)
        expect(dataValidation.data.extractedData).toHaveLength(2)
        expect(dataValidation.data.dataCount).toBe(2)

        // 驗證資料提取服務被正確調用
        expect(mockReadmooAdapter.extractBookData).toHaveBeenCalledWith(validationContext)
        expect(mockReadmooAdapter.validateExtractedData).toHaveBeenCalled()

        // 驗證提取的資料結構
        const extractedData = dataValidation.data.extractedData
        for (const book of extractedData) {
          expect(book).toHaveProperty('id')
          expect(book).toHaveProperty('title')
          expect(book).toHaveProperty('author')
          expect(book).toHaveProperty('progress')
          expect(book).toHaveProperty('platform')
          expect(book.platform).toBe('READMOO')
        }
      })

      test('應該處理沒有提取到資料的情況', async () => {
        // 設置空資料回應
        mockReadmooAdapter.extractBookData.mockResolvedValue([])

        const result = await migrationValidator.validateReadmooMigration(validationContext)

        expect(result.isValid).toBe(false)

        const dataValidation = result.data.validationDetails.dataExtractionValidation
        expect(dataValidation.isValid).toBe(false)
        expect(dataValidation.errors).toContain('No data extracted from Readmoo platform')
      })

      test('應該處理資料格式驗證失敗', async () => {
        // 設置資料驗證失敗
        mockReadmooAdapter.validateExtractedData.mockReturnValue(false)

        const result = await migrationValidator.validateReadmooMigration(validationContext)

        expect(result.isValid).toBe(false)

        const dataValidation = result.data.validationDetails.dataExtractionValidation
        expect(dataValidation.isValid).toBe(false)
        expect(dataValidation.errors).toContain('Data validation failed: Invalid data format')
      })

      test('應該驗證必要欄位的完整性', async () => {
        // 設置缺少必要欄位的資料
        mockReadmooAdapter.extractBookData.mockResolvedValue([
          {
            id: 'book-1',
            title: '測試書籍 1'
            // 缺少 author, progress, platform
          },
          {
            id: 'book-2',
            title: '測試書籍 2',
            author: '測試作者 2',
            progress: 50,
            platform: 'READMOO'
          }
        ])

        const result = await migrationValidator.validateReadmooMigration(validationContext)

        expect(result.isValid).toBe(false)

        const dataValidation = result.data.validationDetails.dataExtractionValidation
        expect(dataValidation.isValid).toBe(false)

        // 應該檢測到缺少的欄位
        const fieldValidation = dataValidation.data.fieldValidation
        expect(fieldValidation.isValid).toBe(false)
        expect(fieldValidation.errors).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/Missing required field 'author' in item 0/),
            expect.stringMatching(/Missing required field 'progress' in item 0/),
            expect.stringMatching(/Missing required field 'platform' in item 0/)
          ])
        )
      })

      test('應該處理資料提取服務異常', async () => {
        // 模擬提取服務拋出異常
        mockReadmooAdapter.extractBookData.mockRejectedValue(
          new Error('DOM parsing failed')
        )

        const result = await migrationValidator.validateReadmooMigration(validationContext)

        expect(result.isValid).toBe(false)

        const dataValidation = result.data.validationDetails.dataExtractionValidation
        expect(dataValidation.isValid).toBe(false)
        expect(dataValidation.errors).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/Data extraction failed.*DOM parsing failed/)
          ])
        )
      })
    })

    describe('事件系統整合驗證', () => {
      test('應該成功驗證 v2.0 事件格式支援', async () => {
        const result = await migrationValidator.validateReadmooMigration(validationContext)

        expect(result.isValid).toBe(true)

        const eventValidation = result.data.validationDetails.eventSystemValidation
        expect(eventValidation.isValid).toBe(true)
        expect(eventValidation.data.v2EventsSupported).toBe(true)
        expect(eventValidation.data.legacyEventsSupported).toBe(true)
        expect(eventValidation.data.eventConversionAccuracy).toBeGreaterThan(0.95)
      })

      test('應該測試 Modern 事件格式的發送和接收', async () => {
        const eventHandler = jest.fn()

        // 註冊 Modern 事件監聽器
        eventBus.on('PLATFORM.READMOO.VALIDATION.COMPLETED', eventHandler)

        const result = await migrationValidator.validateReadmooMigration(validationContext)

        // 等待事件處理
        await new Promise(resolve => setTimeout(resolve, 100))

        expect(result.isValid).toBe(true)
        expect(eventHandler).toHaveBeenCalled()

        const eventData = eventHandler.mock.calls[0][0]
        expect(eventData.type).toBe('PLATFORM.READMOO.VALIDATION.COMPLETED')
        expect(eventData.data.result).toBeDefined()
      })

      test('應該測試 Legacy 事件格式的向後相容性', async () => {
        // 註冊 Legacy 格式事件監聽器
        const legacyHandler = jest.fn()
        eventBus.on('VALIDATION.COMPLETED', legacyHandler)

        // 通過命名協調器發送 Legacy 格式事件
        await namingCoordinator.intelligentEmit('VALIDATION.COMPLETED', {
          platform: 'READMOO',
          status: 'success'
        })

        // 等待事件處理
        await new Promise(resolve => setTimeout(resolve, 50))

        expect(legacyHandler).toHaveBeenCalled()
      })

      test('應該驗證事件轉換的準確性', async () => {
        const legacyEvents = [
          'PLATFORM.DETECTION.COMPLETED',
          'EXTRACTION.DATA.COMPLETED',
          'STORAGE.SAVE.COMPLETED'
        ]

        const modernEvents = [
          'PLATFORM.READMOO.DETECT.COMPLETED',
          'EXTRACTION.READMOO.EXTRACT.COMPLETED',
          'DATA.READMOO.SAVE.COMPLETED'
        ]

        for (let i = 0; i < legacyEvents.length; i++) {
          const legacyEvent = legacyEvents[i]
          const expectedModern = modernEvents[i]

          const actualModern = namingCoordinator.convertToModernEvent(legacyEvent)
          expect(actualModern).toBe(expectedModern)
        }
      })
    })

    describe('向後相容性驗證', () => {
      test('應該 100% 支援所有 Legacy API', async () => {
        const result = await migrationValidator.validateReadmooMigration(validationContext)

        expect(result.isValid).toBe(true)

        const compatibilityValidation = result.data.validationDetails.backwardCompatibilityValidation
        expect(compatibilityValidation.isValid).toBe(true)
        expect(compatibilityValidation.data.legacyEventsSupported).toBe(true)
        expect(compatibilityValidation.data.legacyApiSupported).toBe(true)
        expect(compatibilityValidation.data.configurationMigrated).toBe(true)
      })

      test('應該確保既有功能完全不受影響', async () => {
        // 模擬既有的 Legacy 事件處理器
        const existingHandlers = {
          extractionCompleted: jest.fn(),
          storageCompleted: jest.fn(),
          uiUpdated: jest.fn()
        }

        // 註冊 Legacy 格式事件監聽器
        eventBus.on('EXTRACTION.COMPLETED', existingHandlers.extractionCompleted)
        eventBus.on('STORAGE.SAVE.COMPLETED', existingHandlers.storageCompleted)
        eventBus.on('UI.UPDATE.REQUESTED', existingHandlers.uiUpdated)

        // 執行遷移驗證
        const result = await migrationValidator.validateReadmooMigration(validationContext)
        expect(result.isValid).toBe(true)

        // 觸發 Legacy 事件，應該仍然正常工作
        await eventBus.emit('EXTRACTION.COMPLETED', { books: [] })
        await eventBus.emit('STORAGE.SAVE.COMPLETED', { saved: 5 })
        await eventBus.emit('UI.UPDATE.REQUESTED', { component: 'popup' })

        // 等待事件處理
        await new Promise(resolve => setTimeout(resolve, 100))

        // 驗證所有既有處理器仍然正常工作
        expect(existingHandlers.extractionCompleted).toHaveBeenCalled()
        expect(existingHandlers.storageCompleted).toHaveBeenCalled()
        expect(existingHandlers.uiUpdated).toHaveBeenCalled()
      })

      test('應該支援混合使用 Legacy 和 Modern 事件', async () => {
        const handlers = {
          legacy: jest.fn(),
          modern: jest.fn()
        }

        // 註冊混合事件監聽器
        eventBus.on('EXTRACTION.COMPLETED', handlers.legacy)
        eventBus.on('EXTRACTION.READMOO.EXTRACT.COMPLETED', handlers.modern)

        // 通過雙軌模式觸發事件
        namingCoordinator.registerDualTrackListener('EXTRACTION.COMPLETED', (event) => {
          if (event.type === 'EXTRACTION.COMPLETED') {
            handlers.legacy(event)
          } else {
            handlers.modern(event)
          }
        })

        await namingCoordinator.intelligentEmit('EXTRACTION.COMPLETED', { mixed: 'test' })

        // 等待事件處理
        await new Promise(resolve => setTimeout(resolve, 100))

        // 驗證兩種格式都被正確處理
        expect(handlers.legacy).toHaveBeenCalled()
        expect(handlers.modern).toHaveBeenCalled()
      })
    })

    describe('資料完整性驗證', () => {
      test('應該檢測和報告零資料遺失', async () => {
        const beforeData = [
          { id: 'book-1', title: 'Book 1', author: 'Author 1', progress: 50, platform: 'READMOO' },
          { id: 'book-2', title: 'Book 2', author: 'Author 2', progress: 75, platform: 'READMOO' },
          { id: 'book-3', title: 'Book 3', author: 'Author 3', progress: 25, platform: 'READMOO' }
        ]

        const afterData = [
          { id: 'book-1', title: 'Book 1', author: 'Author 1', progress: 50, platform: 'READMOO' },
          { id: 'book-2', title: 'Book 2', author: 'Author 2', progress: 75, platform: 'READMOO' },
          { id: 'book-3', title: 'Book 3', author: 'Author 3', progress: 25, platform: 'READMOO' }
        ]

        const integrityResult = await migrationValidator.validateDataIntegrity(beforeData, afterData)

        expect(integrityResult.isValid).toBe(true)
        expect(integrityResult.data.dataLoss).toBe(0)
        expect(integrityResult.data.dataCorruption).toBe(0)
        expect(integrityResult.data.integrityScore).toBe(1.0)
      })

      test('應該檢測資料遺失情況', async () => {
        const beforeData = [
          { id: 'book-1', title: 'Book 1', author: 'Author 1', progress: 50, platform: 'READMOO' },
          { id: 'book-2', title: 'Book 2', author: 'Author 2', progress: 75, platform: 'READMOO' },
          { id: 'book-3', title: 'Book 3', author: 'Author 3', progress: 25, platform: 'READMOO' }
        ]

        const afterData = [
          { id: 'book-1', title: 'Book 1', author: 'Author 1', progress: 50, platform: 'READMOO' },
          { id: 'book-2', title: 'Book 2', author: 'Author 2', progress: 75, platform: 'READMOO' }
          // book-3 遺失
        ]

        const integrityResult = await migrationValidator.validateDataIntegrity(beforeData, afterData)

        expect(integrityResult.isValid).toBe(false)
        expect(integrityResult.data.dataLoss).toBe(1)
        expect(integrityResult.data.beforeCount).toBe(3)
        expect(integrityResult.data.afterCount).toBe(2)
        expect(integrityResult.errors).toContain('Data loss detected: 1 items missing')
      })

      test('應該檢測資料損壞情況', async () => {
        const beforeData = [
          { id: 'book-1', title: 'Book 1', author: 'Author 1', progress: 50, platform: 'READMOO' },
          { id: 'book-2', title: 'Book 2', author: 'Author 2', progress: 75, platform: 'READMOO' }
        ]

        const afterData = [
          { id: 'book-1', title: 'Book 1', author: 'Author 1', progress: 50, platform: 'READMOO' },
          { id: 'book-2', title: 'Corrupted Book', author: 'Wrong Author', progress: 100, platform: 'READMOO' }
          // book-2 的 title, author, progress 都被損壞
        ]

        const integrityResult = await migrationValidator.validateDataIntegrity(beforeData, afterData)

        expect(integrityResult.isValid).toBe(false)
        expect(integrityResult.data.dataCorruption).toBe(1)
        expect(integrityResult.errors).toContain('Data corruption detected in 1 items')
      })

      test('應該計算正確的完整性分數', async () => {
        const beforeData = Array.from({ length: 10 }, (_, i) => ({
          id: `book-${i}`,
          title: `Book ${i}`,
          author: `Author ${i}`,
          progress: i * 10,
          platform: 'READMOO'
        }))

        // 模擬 1 個資料遺失 + 1 個資料損壞
        const afterData = beforeData.slice(0, 9).map((book, index) => {
          if (index === 1) {
            // 損壞第 2 本書
            return { ...book, title: 'Corrupted Title' }
          }
          return book
        })

        const integrityResult = await migrationValidator.validateDataIntegrity(beforeData, afterData)

        expect(integrityResult.isValid).toBe(false)
        expect(integrityResult.data.dataLoss).toBe(1)
        expect(integrityResult.data.dataCorruption).toBe(1)

        // 完整性分數 = (10 - 1 - 1) / 10 = 0.8
        expect(integrityResult.data.integrityScore).toBe(0.8)
      })
    })
  })

  describe('🔧 真實環境模擬測試', () => {
    describe('網路條件和錯誤處理', () => {
      test('應該處理網路延遲情況', async () => {
        // 模擬網路延遲
        mockPlatformDetectionService.detectPlatform.mockImplementation(
          () => new Promise(resolve =>
            setTimeout(() => resolve({
              platformId: 'READMOO',
              confidence: 0.9,
              detectedFeatures: ['bookShelf']
            }), 1000)
          )
        )

        const startTime = Date.now()
        const result = await migrationValidator.validateReadmooMigration(validationContext)
        const endTime = Date.now()

        expect(result.isValid).toBe(true)
        expect(endTime - startTime).toBeGreaterThan(1000) // 應該包含延遲時間
        expect(endTime - startTime).toBeLessThan(6000) // 但不應該超過超時時間
      })

      test('應該處理驗證超時情況', async () => {
        // 創建一個更短超時時間的驗證器
        const shortTimeoutValidator = new ReadmooPlatformMigrationValidator({
          eventBus,
          readmooAdapter: mockReadmooAdapter,
          platformDetectionService: mockPlatformDetectionService
        }, {
          validationTimeout: 1000 // 1000ms 超時
        })

        // 模擬長時間等待
        mockPlatformDetectionService.detectPlatform.mockImplementation(
          () => new Promise(resolve =>
            setTimeout(() => resolve({
              platformId: 'READMOO',
              confidence: 0.9
            }), 1500) // 1500ms 延遲，超過超時時間
          )
        )

        const result = await shortTimeoutValidator.validateReadmooMigration(validationContext)

        expect(result.isValid).toBe(false)
        expect(result.errors[0]).toMatch(/Validation timeout after 1000ms/)
      })

      test('應該支援重試機制', async () => {
        let attemptCount = 0

        // 模擬前兩次失敗，第三次成功
        mockPlatformDetectionService.detectPlatform.mockImplementation(() => {
          attemptCount++
          if (attemptCount < 3) {
            throw new StandardError('NETWORK_ERROR', 'Temporary network error', { category: 'testing' })
          }
          return Promise.resolve({
            platformId: 'READMOO',
            confidence: 0.9,
            detectedFeatures: ['bookShelf']
          })
        })

        const result = await migrationValidator.validateReadmooMigration(validationContext)

        expect(result.isValid).toBe(true)
        expect(attemptCount).toBe(3) // 應該重試了 3 次
      })

      test('應該在達到最大重試次數後失敗', async () => {
        // 模擬持續失敗
        mockPlatformDetectionService.detectPlatform.mockRejectedValue(
          new Error('Persistent network error')
        )

        const result = await migrationValidator.validateReadmooMigration(validationContext)

        expect(result.isValid).toBe(false)
        expect(result.errors[0]).toMatch(/Max retries exceeded.*Persistent network error/)
      })
    })

    describe('大量資料處理測試', () => {
      test('應該處理大量書籍資料', async () => {
        // 模擬大量書籍資料
        const largeDataSet = Array.from({ length: 500 }, (_, i) => ({
          id: `book-${i}`,
          title: `測試書籍 ${i}`,
          author: `測試作者 ${i}`,
          progress: Math.floor(Math.random() * 100),
          platform: 'READMOO'
        }))

        mockReadmooAdapter.extractBookData.mockResolvedValue(largeDataSet)

        const startTime = Date.now()
        const result = await migrationValidator.validateReadmooMigration(validationContext)
        const endTime = Date.now()

        expect(result.isValid).toBe(true)
        expect(result.data.validationDetails.dataExtractionValidation.data.dataCount).toBe(500)

        // 處理時間應該合理（小於 10 秒）
        expect(endTime - startTime).toBeLessThan(10000)
      })

      test('應該在大量資料下保持記憶體效率', async () => {
        const initialMemory = process.memoryUsage()

        // 處理多次大量資料
        for (let round = 0; round < 5; round++) {
          const dataSet = Array.from({ length: 200 }, (_, i) => ({
            id: `book-${round}-${i}`,
            title: `書籍 ${round}-${i}`,
            author: `作者 ${round}-${i}`,
            progress: Math.floor(Math.random() * 100),
            platform: 'READMOO'
          }))

          mockReadmooAdapter.extractBookData.mockResolvedValue(dataSet)

          const result = await migrationValidator.validateReadmooMigration({
            ...validationContext,
            round
          })

          expect(result.isValid).toBe(true)
        }

        // 等待記憶體穩定化
        await new Promise(resolve => setTimeout(resolve, 200))

        const finalMemory = process.memoryUsage()
        const memoryGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed

        // 記憶體增長應該控制在合理範圍內
        expect(memoryGrowth).toBeLessThan(0.5) // 50% 增長限制
      })
    })

    describe('快取和效能最佳化', () => {
      test('應該正確使用驗證結果快取', async () => {
        const cacheKey = migrationValidator.generateCacheKey(validationContext)

        // 第一次驗證
        const result1 = await migrationValidator.validateReadmooMigration(validationContext)
        expect(result1.isValid).toBe(true)

        // 檢查快取
        const cachedResult = migrationValidator.getCachedResult(cacheKey)
        expect(cachedResult).toBeDefined()
        expect(cachedResult.isValid).toBe(result1.isValid)

        // 重置 mock 調用計數
        jest.clearAllMocks()

        // 第二次驗證應該使用快取
        const result2 = await migrationValidator.validateReadmooMigration(validationContext)
        expect(result2.isValid).toBe(true)

        // 驗證沒有重複調用檢測服務（使用了快取）
        expect(mockPlatformDetectionService.detectPlatform).not.toHaveBeenCalled()
        expect(mockReadmooAdapter.extractBookData).not.toHaveBeenCalled()
      })

      test('應該在快取過期後重新驗證', async () => {
        // 創建短快取時間的驗證器
        const shortCacheValidator = new ReadmooPlatformMigrationValidator({
          eventBus,
          readmooAdapter: mockReadmooAdapter,
          platformDetectionService: mockPlatformDetectionService
        }, {
          cacheTimeout: 100 // 100ms 快取時間
        })

        // 第一次驗證
        const result1 = await shortCacheValidator.validateReadmooMigration(validationContext)
        expect(result1.isValid).toBe(true)

        // 等待快取過期
        await new Promise(resolve => setTimeout(resolve, 150))

        // 重置 mock 調用計數
        jest.clearAllMocks()

        // 第二次驗證應該重新執行
        const result2 = await shortCacheValidator.validateReadmooMigration(validationContext)
        expect(result2.isValid).toBe(true)

        // 驗證重新調用了檢測服務
        expect(mockPlatformDetectionService.detectPlatform).toHaveBeenCalled()
        expect(mockReadmooAdapter.extractBookData).toHaveBeenCalled()
      })

      test('應該智能管理快取大小', async () => {
        // 創建小快取大小的驗證器
        const smallCacheValidator = new ReadmooPlatformMigrationValidator({
          eventBus,
          readmooAdapter: mockReadmooAdapter,
          platformDetectionService: mockPlatformDetectionService
        }, {
          maxCacheSize: 3
        })

        // 添加多個不同的驗證結果到快取
        const contexts = Array.from({ length: 5 }, (_, i) => ({
          ...validationContext,
          url: `https://readmoo.com/book/${i}`,
          testId: i
        }))

        for (const context of contexts) {
          await smallCacheValidator.validateReadmooMigration(context)
        }

        // 檢查快取大小是否被限制
        const cacheSize = smallCacheValidator.validationCache.size
        expect(cacheSize).toBeLessThanOrEqual(3)
      })
    })
  })

  describe('🔧 驗證報告和監控', () => {
    test('應該生成完整的驗證報告', async () => {
      // 執行幾次驗證以生成統計資料
      await migrationValidator.validateReadmooMigration(validationContext)
      await migrationValidator.validateReadmooMigration({
        ...validationContext,
        url: 'https://readmoo.com/book/456'
      })

      const report = migrationValidator.getValidationReport()

      expect(report).toBeDefined()
      expect(report.version).toBe('2.0.0')
      expect(report.timestamp).toBeDefined()

      // 檢查概覽統計
      expect(report.overview.totalValidations).toBeGreaterThan(0)
      expect(report.overview.successfulValidations).toBeGreaterThan(0)
      expect(report.overview.successRate).toBeGreaterThan(0)

      // 檢查詳細資訊
      expect(report.details.platformDetection).toBeDefined()
      expect(report.details.dataExtraction).toBeDefined()
      expect(report.details.eventSystemIntegration).toBeDefined()
      expect(report.details.backwardCompatibility).toBeDefined()
      expect(report.details.dataIntegrity).toBeDefined()

      // 檢查配置資訊
      expect(report.configuration).toBeDefined()
      expect(report.configuration.maxValidationRetries).toBe(3)
    })

    test('應該追蹤驗證統計趨勢', async () => {
      const initialReport = migrationValidator.getValidationReport()
      const initialValidations = initialReport.overview.totalValidations

      // 執行成功驗證
      await migrationValidator.validateReadmooMigration(validationContext)

      // 執行失敗驗證 - 使用不同的上下文避免快取命中
      const failValidationContext = {
        ...validationContext,
        url: 'https://readmoo.com/library/different' // 不同的 URL 避免快取
      }

      mockPlatformDetectionService.detectPlatform.mockRejectedValueOnce(
        new Error('Test error')
      )
      await migrationValidator.validateReadmooMigration(failValidationContext)

      const finalReport = migrationValidator.getValidationReport()

      expect(finalReport.overview.totalValidations).toBe(initialValidations + 2)
      expect(finalReport.overview.successfulValidations).toBeGreaterThan(initialReport.overview.successfulValidations)
      expect(finalReport.overview.failedValidations).toBeGreaterThan(initialReport.overview.failedValidations)
    })

    test('應該提供效能指標追蹤', async () => {
      const startTime = Date.now()

      // 執行多次驗證
      for (let i = 0; i < 5; i++) {
        await migrationValidator.validateReadmooMigration({
          ...validationContext,
          iteration: i
        })
      }

      const endTime = Date.now()
      const report = migrationValidator.getValidationReport()

      expect(report.overview.averageValidationTime).toBeGreaterThan(0)
      expect(report.overview.averageValidationTime).toBeLessThan((endTime - startTime) / 5 + 100) // 允許一些誤差
    })

    test('應該支援事件監聽器整合', async () => {
      const validationEventHandler = jest.fn()
      const resultEventHandler = jest.fn()

      // 註冊事件監聽器
      eventBus.on('PLATFORM.VALIDATION.REQUESTED', validationEventHandler)
      eventBus.on('PLATFORM.READMOO.VALIDATION.RESULT', resultEventHandler)

      // 執行驗證
      await migrationValidator.validateReadmooMigration(validationContext)

      // 等待事件處理
      await new Promise(resolve => setTimeout(resolve, 100))

      // 驗證事件被正確觸發
      expect(resultEventHandler).toHaveBeenCalled()

      const eventData = resultEventHandler.mock.calls[0][0]
      expect(eventData.type).toBe('PLATFORM.READMOO.VALIDATION.RESULT')
      expect(eventData.data.result).toBeDefined()
    })
  })
})
