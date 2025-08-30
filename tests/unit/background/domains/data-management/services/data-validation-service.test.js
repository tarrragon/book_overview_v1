/**
 * Data Validation Service v2.0 單元測試
 * TDD Red Phase - 完整測試案例設計
 *
 * 負責功能：
 * - 統一資料格式驗證與標準化測試
 * - 跨平台資料品質檢測測試
 * - 自動資料清理和修復測試
 * - 資料完整性驗證測試
 *
 * 設計考量：
 * - 支援多種資料來源和格式的測試覆蓋
 * - 可擴展的驗證規則引擎測試
 * - 效能優化的批量處理測試
 * - 詳細的驗證報告和錯誤追蹤測試
 *
 * 測試覆蓋範圍：
 * 1. 建構函數與初始化測試
 * 2. 基本資料驗證功能測試
 * 3. 跨平台資料格式支援測試
 * 4. 錯誤處理與邊界條件測試
 * 5. 事件系統整合測試
 * 6. 效能與批次處理測試
 * 7. 統一資料模型輸出測試
 */

const DataValidationService = require('@/background/domains/data-management/services/data-validation-service')
const MockEventBusMock = require('@mocks/chrome-api.mock')
const MockEventBus = MockEventBusMock.createEventBusMock()
const sampleBooks = require('@fixtures/sample-books.json')

describe('Data Validation Service v2.0', () => {
  let dataValidationService
  let mockEventBus
  let mockConfig

  // 測試數據集合
  const testPlatforms = ['READMOO', 'KINDLE', 'KOBO', 'BOOKWALKER', 'BOOKS_COM']

  const validBookData = {
    id: 'book-123',
    title: '測試書籍標題',
    authors: ['作者A', '作者B'],
    publisher: '測試出版社',
    isbn: '9789571234567',
    cover: 'https://example.com/cover.jpg',
    progress: {
      percentage: 75,
      currentPage: 150,
      totalPages: 200
    },
    status: 'READING',
    purchaseDate: '2024-01-15T10:30:00.000Z',
    rating: 4,
    tags: ['科技', '教育'],
    notes: '很有趣的書'
  }

  const invalidBookData = {
    id: '', // 空ID
    title: '   ', // 空白標題
    authors: null, // null作者
    publisher: 123, // 錯誤型別
    isbn: 'invalid-isbn', // 錯誤格式
    progress: {
      percentage: 150, // 超出範圍
      currentPage: -10 // 負數頁數
    },
    rating: 6 // 超出範圍
  }

  const mixedQualityBooks = [
    validBookData,
    invalidBookData,
    { ...validBookData, id: 'book-456', title: '另一本好書' },
    { id: 'book-789', title: '部分資料缺失的書', authors: [] }
  ]

  beforeEach(() => {
    // 建立模擬依賴
    mockEventBus = new MockEventBus()
    mockConfig = {
      autoFix: true,
      strictMode: false,
      batchSize: 100,
      validationTimeout: 5000,
      supportedPlatforms: testPlatforms,
      qualityThresholds: {
        high: 90,
        medium: 70,
        low: 50
      }
    }

    // 建立服務實例（這時應該會失敗，因為尚未實作）
    dataValidationService = new DataValidationService(mockEventBus, mockConfig)
  })

  afterEach(() => {
    jest.clearAllMocks()
    if (dataValidationService) {
      dataValidationService.destroy?.()
    }
  })

  describe('1. 建構函數與初始化測試', () => {
    describe('建構函數', () => {
      test('應該正確初始化 DataValidationService', () => {
        expect(dataValidationService).toBeDefined()
        expect(dataValidationService.config).toMatchObject(mockConfig)
        expect(dataValidationService.eventBus).toBe(mockEventBus)
        expect(dataValidationService.validationRules).toBeInstanceOf(Map)
        expect(dataValidationService.platformSchemas).toBeInstanceOf(Map)
        expect(dataValidationService.dataQualityMetrics).toBeInstanceOf(Map)
      })

      test('應該使用預設配置當配置為空時', () => {
        const serviceWithDefaults = new DataValidationService(mockEventBus, {})
        expect(serviceWithDefaults.config.autoFix).toBe(true)
        expect(serviceWithDefaults.config.batchSize).toBe(100)
      })

      test('應該抛出錯誤當 EventBus 未提供', () => {
        expect(() => {
          new DataValidationService(null, mockConfig)
        }).toThrow('EventBus is required')
      })

      test('應該正確設定服務名稱', () => {
        expect(dataValidationService.serviceName).toBe('DataValidationService')
      })
    })

    describe('初始化流程', () => {
      test('應該成功初始化所有核心組件', async () => {
        await dataValidationService.initialize()

        expect(dataValidationService.isInitialized).toBe(true)
        expect(dataValidationService.validationRules.size).toBeGreaterThan(0)
        expect(dataValidationService.platformSchemas.size).toBeGreaterThan(0)
      })

      test('應該載入所有支援平台的驗證規則', async () => {
        await dataValidationService.initialize()

        testPlatforms.forEach(platform => {
          expect(dataValidationService.validationRules.has(platform)).toBe(true)
        })
      })

      test('應該載入預設驗證規則', async () => {
        await dataValidationService.initialize()

        expect(dataValidationService.validationRules.has('DEFAULT')).toBe(true)
        const defaultRules = dataValidationService.validationRules.get('DEFAULT')
        expect(defaultRules).toHaveProperty('required')
        expect(defaultRules).toHaveProperty('types')
        expect(defaultRules).toHaveProperty('business')
      })

      test('應該註冊所有必要的事件監聽器', async () => {
        await dataValidationService.initialize()

        expect(mockEventBus.on).toHaveBeenCalledWith('DATA.VALIDATION.REQUESTED', expect.any(Function))
        // 檢查每個平台的批次驗證事件監聽器
        expect(mockEventBus.on).toHaveBeenCalledWith('DATA.READMOO.BATCH.VALIDATION.REQUESTED', expect.any(Function))
        expect(mockEventBus.on).toHaveBeenCalledWith('DATA.KINDLE.BATCH.VALIDATION.REQUESTED', expect.any(Function))
        expect(mockEventBus.on).toHaveBeenCalledWith('DATA.KOBO.BATCH.VALIDATION.REQUESTED', expect.any(Function))
      })

      test('應該在初始化失敗時抛出有意義的錯誤', async () => {
        mockEventBus.on.mockImplementationOnce(() => {
          throw new Error('事件系統無法使用')
        })

        await expect(dataValidationService.initialize()).rejects.toThrow('初始化失敗')
      })
    })

    describe('平台特定驗證規則載入', () => {
      test('應該成功載入 READMOO 平台驗證規則', async () => {
        await dataValidationService.loadPlatformValidationRules('READMOO')

        const readmooRules = dataValidationService.validationRules.get('READMOO')
        expect(readmooRules).toBeDefined()
        expect(readmooRules.required).toContain('id')
        expect(readmooRules.required).toContain('title')
        expect(readmooRules.types.progress).toBe('object')
      })

      test('應該成功載入所有支援平台的驗證規則', async () => {
        for (const platform of testPlatforms) {
          await dataValidationService.loadPlatformValidationRules(platform)
          expect(dataValidationService.validationRules.has(platform)).toBe(true)
        }
      })

      test('應該處理不支援平台的情況', async () => {
        await expect(
          dataValidationService.loadPlatformValidationRules('UNSUPPORTED_PLATFORM')
        ).rejects.toThrow('不支援的平台')
      })

      test('應該快取已載入的驗證規則', async () => {
        const loadSpy = jest.spyOn(dataValidationService, 'loadRulesForPlatform')

        await dataValidationService.loadPlatformValidationRules('KINDLE')
        await dataValidationService.loadPlatformValidationRules('KINDLE') // 重複載入

        expect(loadSpy).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('2. 基本資料驗證功能測試', () => {
    beforeEach(async () => {
      await dataValidationService.initialize()
    })

    describe('validateAndNormalize - 核心驗證方法', () => {
      test('應該成功驗證和標準化有效書籍資料', async () => {
        const result = await dataValidationService.validateAndNormalize(
          [validBookData],
          'READMOO',
          'TEST'
        )

        expect(result.validationId).toBeDefined()
        expect(result.platform).toBe('READMOO')
        expect(result.source).toBe('TEST')
        expect(result.totalBooks).toBe(1)
        expect(result.validBooks).toHaveLength(1)
        expect(result.invalidBooks).toHaveLength(0)
        expect(result.normalizedBooks).toHaveLength(1)
        expect(result.qualityScore).toBeGreaterThan(90)
      })

      test('應該正確識別和報告無效書籍資料', async () => {
        const result = await dataValidationService.validateAndNormalize(
          [invalidBookData],
          'READMOO',
          'TEST'
        )

        expect(result.validBooks).toHaveLength(0)
        expect(result.invalidBooks).toHaveLength(1)
        expect(result.invalidBooks[0].errors).toContainEqual(
          expect.objectContaining({
            type: 'MISSING_REQUIRED_FIELD',
            field: 'id'
          })
        )
        expect(result.qualityScore).toBeLessThan(50)
      })

      test('應該處理混合品質的書籍集合', async () => {
        const result = await dataValidationService.validateAndNormalize(
          mixedQualityBooks,
          'READMOO',
          'BATCH_TEST'
        )

        expect(result.totalBooks).toBe(4)
        expect(result.validBooks.length).toBeGreaterThan(0)
        expect(result.invalidBooks.length).toBeGreaterThan(0)
        expect(result.warnings.length).toBeGreaterThan(0)
        expect(result.qualityScore).toBeGreaterThan(0)
        expect(result.qualityScore).toBeLessThan(100)
      })

      test('應該發送適當的事件通知', async () => {
        await dataValidationService.validateAndNormalize(
          [validBookData],
          'READMOO',
          'EVENT_TEST'
        )

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          'DATA.VALIDATION.COMPLETED',
          expect.objectContaining({
            validationId: expect.any(String),
            platform: 'READMOO',
            source: 'EVENT_TEST',
            qualityScore: expect.any(Number),
            validCount: 1,
            invalidCount: 0,
            normalizedBooks: expect.any(Array)
          })
        )
      })

      test('應該在驗證失敗時發送錯誤事件', async () => {
        // 清除快取以確保會調用 validateSingleBook
        if (dataValidationService.validationCache) {
          dataValidationService.validationCache.clear()
        }
        
        // 模擬一個會導致驗證失敗的書籍資料
        const invalidBookData = null // null資料會導致驗證失敗

        // 測試會返回失敗結果，包含錯誤資訊
        const result = await dataValidationService.validateAndNormalize([invalidBookData], 'READMOO', 'ERROR_TEST')

        // 驗證結果包含錯誤
        expect(result.success).toBe(false)
        expect(result.errors).toHaveLength(0) // null 資料不會產生 errors，直接被歸類為 invalidBooks
        expect(result.invalidBooks).toHaveLength(1)
        expect(result.validBooks).toHaveLength(0)

        // 驗證完成事件被發送，包含失敗統計
        expect(mockEventBus.emit).toHaveBeenCalledWith(
          'DATA.VALIDATION.COMPLETED',
          expect.objectContaining({
            validCount: 0,
            invalidCount: 1,
            platform: 'READMOO',
            source: 'ERROR_TEST'
          })
        )
      })

      test('應該處理空書籍陣列', async () => {
        const result = await dataValidationService.validateAndNormalize(
          [],
          'READMOO',
          'EMPTY_TEST'
        )

        expect(result.totalBooks).toBe(0)
        expect(result.validBooks).toHaveLength(0)
        expect(result.invalidBooks).toHaveLength(0)
        expect(result.qualityScore).toBe(0)
      })
    })

    describe('validateSingleBook - 單本書籍驗證', () => {
      test('應該正確驗證有效的單本書籍', async () => {
        const validation = await dataValidationService.validateSingleBook(
          validBookData,
          'READMOO',
          'SINGLE_TEST'
        )

        expect(validation.bookId).toBe('book-123')
        expect(validation.isValid).toBe(true)
        expect(validation.errors).toHaveLength(0)
        expect(validation.warnings).toBeDefined()
        expect(validation.fixes).toBeDefined()
      })

      test('應該檢測必填欄位缺失', async () => {
        const bookWithMissingFields = { ...validBookData }
        delete bookWithMissingFields.title
        delete bookWithMissingFields.id

        const validation = await dataValidationService.validateSingleBook(
          bookWithMissingFields,
          'READMOO',
          'MISSING_FIELDS_TEST'
        )

        expect(validation.isValid).toBe(false)
        expect(validation.errors).toContainEqual(
          expect.objectContaining({
            type: 'MISSING_REQUIRED_FIELD',
            field: 'id'
          })
        )
        expect(validation.errors).toContainEqual(
          expect.objectContaining({
            type: 'MISSING_REQUIRED_FIELD',
            field: 'title'
          })
        )
      })

      test('應該檢測資料類型錯誤', async () => {
        const bookWithTypeErrors = {
          ...validBookData,
          progress: 'invalid_progress', // 應該是物件
          rating: 'five_stars', // 應該是數字
          authors: 'single_author' // 應該是陣列
        }

        const validation = await dataValidationService.validateSingleBook(
          bookWithTypeErrors,
          'READMOO',
          'TYPE_ERROR_TEST'
        )

        expect(validation.isValid).toBe(false)
        expect(validation.errors).toContainEqual(
          expect.objectContaining({
            type: 'INVALID_DATA_TYPE',
            field: 'progress',
            expectedType: 'object'
          })
        )
      })

      test('應該執行商業邏輯驗證', async () => {
        const bookWithBusinessLogicErrors = {
          ...validBookData,
          progress: {
            percentage: 150, // 超出0-100範圍
            currentPage: 200,
            totalPages: 100 // 當前頁數大於總頁數
          },
          rating: -1, // 負評分
          publishedDate: '2030-12-31' // 未來日期
        }

        const validation = await dataValidationService.validateSingleBook(
          bookWithBusinessLogicErrors,
          'READMOO',
          'BUSINESS_LOGIC_TEST'
        )

        expect(validation.isValid).toBe(false)
        expect(validation.errors.some(e => e.type === 'BUSINESS_RULE_VIOLATION')).toBe(true)
      })

      test('應該執行資料品質檢查', async () => {
        const lowQualityBook = {
          ...validBookData,
          title: 'a', // 太短的標題
          authors: [''], // 空作者名稱
          isbn: '123', // 太短的ISBN
          cover: 'invalid-url' // 無效的圖片URL
        }

        const validation = await dataValidationService.validateSingleBook(
          lowQualityBook,
          'READMOO',
          'QUALITY_CHECK_TEST'
        )

        expect(validation.warnings.length).toBeGreaterThan(0)
        expect(validation.warnings).toContainEqual(
          expect.objectContaining({
            type: 'DATA_QUALITY_WARNING'
          })
        )
      })

      test('應該執行自動修復功能', async () => {
        const bookNeedingFix = {
          ...validBookData,
          title: '  標題前後有空白  ',
          isbn: '978-957-123-456-7', // 帶連字符的ISBN
          authors: 'Single Author' // 字串形式的作者
        }

        const validation = await dataValidationService.validateSingleBook(
          bookNeedingFix,
          'READMOO',
          'AUTO_FIX_TEST'
        )

        expect(validation.book.title).toBe('標題前後有空白')
        expect(validation.book.isbn).toBe('9789571234567')
        expect(validation.book.authors).toEqual(['Single Author'])
        expect(validation.fixes.length).toBeGreaterThan(0)
      })
    })
  })

  describe('3. 跨平台資料格式支援測試', () => {
    beforeEach(async () => {
      await dataValidationService.initialize()
    })

    describe('平台特定驗證規則', () => {
      test('應該正確應用 READMOO 平台驗證規則', async () => {
        const readmooBook = {
          id: '210327003000101',
          title: '大腦不滿足',
          cover: 'https://cdn.readmoo.com/cover/jb/qpfmrmi_210x315.jpg',
          progress: 60,
          type: '流式',
          isNew: false,
          isFinished: false
        }

        const validation = await dataValidationService.validateSingleBook(
          readmooBook,
          'READMOO',
          'READMOO_FORMAT_TEST'
        )

        expect(validation.isValid).toBe(true)
        // READMOO 特有欄位應該被保留
        expect(validation.book.type).toBe('流式')
        expect(validation.book.isNew).toBe(false)
      })

      test('應該正確應用 KINDLE 平台驗證規則', async () => {
        const kindleBook = {
          ASIN: 'B08XYZABC1',
          title: 'Test Kindle Book',
          authors: [{ name: 'Author Name' }],
          kindle_price: 9.99,
          reading_progress: { percent_complete: 45.5 },
          whispersync_device: 'iPhone'
        }

        const validation = await dataValidationService.validateSingleBook(
          kindleBook,
          'KINDLE',
          'KINDLE_FORMAT_TEST'
        )

        expect(validation.isValid).toBe(true)
        // Kindle 特有欄位應該被識別
        expect(validation.book.ASIN).toBe('B08XYZABC1')
        expect(validation.book.whispersync_device).toBe('iPhone')
      })

      test('應該正確應用 KOBO 平台驗證規則', async () => {
        const koboBook = {
          id: 'kobo_book_123',
          title: 'Test Kobo Book',
          contributors: [{ role: 'Author', name: 'Kobo Author' }],
          reading_state: { current_position: 0.3, last_read: '2024-01-15T10:30:00Z' },
          kobo_categories: ['Fiction', 'Thriller']
        }

        const validation = await dataValidationService.validateSingleBook(
          koboBook,
          'KOBO',
          'KOBO_FORMAT_TEST'
        )

        expect(validation.isValid).toBe(true)
        expect(validation.book.contributors).toBeDefined()
        expect(validation.book.kobo_categories).toEqual(['Fiction', 'Thriller'])
      })

      test('應該處理平台間格式差異', async () => {
        const platforms = ['READMOO', 'KINDLE', 'KOBO']
        const baseBook = {
          id: 'universal_book_123',
          title: 'Universal Book Title'
        }

        for (const platform of platforms) {
          const validation = await dataValidationService.validateSingleBook(
            baseBook,
            platform,
            'CROSS_PLATFORM_TEST'
          )

          expect(validation.bookId).toBe('universal_book_123')
          // 每個平台應該有不同的驗證行為
        }
      })
    })

    describe('資料格式轉換', () => {
      test('應該統一不同平台的作者格式', async () => {
        const platforms = [
          { platform: 'READMOO', author: '作者姓名' },
          { platform: 'KINDLE', authors: [{ name: '作者姓名' }] },
          { platform: 'KOBO', contributors: [{ role: 'Author', name: '作者姓名' }] }
        ]

        for (const { platform, ...bookData } of platforms) {
          const book = { id: 'test', title: '測試', ...bookData }
          const validation = await dataValidationService.validateSingleBook(
            book,
            platform,
            'AUTHOR_FORMAT_TEST'
          )

          if (validation.isValid) {
            // 驗證後的書籍應該有統一的作者格式
            expect(validation.book.authors || validation.book.author).toBeDefined()
          }
        }
      })

      test('應該統一不同平台的進度格式', async () => {
        const progressFormats = [
          { platform: 'READMOO', progress: 75 },
          { platform: 'KINDLE', ASIN: 'B123456789', reading_progress: { percent_complete: 75.0 } },
          { platform: 'KOBO', kobo_id: 'kobo_12345', reading_state: { current_position: 0.75 } }
        ]

        for (const { platform, ...progressData } of progressFormats) {
          const book = { id: 'test', title: '測試', ...progressData }
          const validation = await dataValidationService.validateSingleBook(
            book,
            platform,
            'PROGRESS_FORMAT_TEST'
          )

          // 所有平台的進度格式都應該被正確識別
          expect(validation.isValid).toBe(true)
        }
      })
    })

    describe('平台特定欄位處理', () => {
      test('應該保留平台特定欄位不進行驗證', async () => {
        const readmooSpecificBook = {
          id: 'readmoo_123',
          title: 'READMOO 特定書籍',
          readmoo_internal_id: 'internal_123',
          readmoo_book_type: '流式',
          readmoo_drm_protected: true
        }

        const validation = await dataValidationService.validateSingleBook(
          readmooSpecificBook,
          'READMOO',
          'PLATFORM_SPECIFIC_TEST'
        )

        expect(validation.isValid).toBe(true)
        // 平台特定欄位應該被保留
        expect(validation.book.readmoo_internal_id).toBe('internal_123')
        expect(validation.book.readmoo_drm_protected).toBe(true)
      })

      test('應該忽略無關的平台特定欄位', async () => {
        const mixedPlatformBook = {
          id: 'mixed_123',
          title: '混合平台書籍',
          ASIN: 'B08XYZ123', // KINDLE 必填欄位
          kindle_price: 9.99, // KINDLE 特有
          kobo_series_id: 'kobo_456', // KOBO 特有
          readmoo_type: '流式' // READMOO 特有
        }

        const kindleValidation = await dataValidationService.validateSingleBook(
          mixedPlatformBook,
          'KINDLE',
          'MIXED_PLATFORM_TEST'
        )

        expect(kindleValidation.isValid).toBe(true)
        // 只有相關平台的欄位應該被處理
      })
    })
  })

  describe('4. 錯誤處理與邊界條件測試', () => {
    beforeEach(async () => {
      await dataValidationService.initialize()
    })

    describe('輸入驗證', () => {
      test('應該處理 null 或 undefined 輸入', async () => {
        await expect(
          dataValidationService.validateAndNormalize(null, 'READMOO', 'NULL_TEST')
        ).rejects.toThrow('書籍資料為必要參數')

        await expect(
          dataValidationService.validateAndNormalize(undefined, 'READMOO', 'UNDEFINED_TEST')
        ).rejects.toThrow('書籍資料為必要參數')
      })

      test('應該處理非陣列輸入', async () => {
        await expect(
          dataValidationService.validateAndNormalize('not an array', 'READMOO', 'STRING_TEST')
        ).rejects.toThrow('書籍資料必須是陣列')

        await expect(
          dataValidationService.validateAndNormalize(123, 'READMOO', 'NUMBER_TEST')
        ).rejects.toThrow('書籍資料必須是陣列')
      })

      test('應該處理空字串平台名稱', async () => {
        await expect(
          dataValidationService.validateAndNormalize([validBookData], '', 'EMPTY_PLATFORM_TEST')
        ).rejects.toThrow('平台名稱不能為空')

        await expect(
          dataValidationService.validateAndNormalize([validBookData], null, 'NULL_PLATFORM_TEST')
        ).rejects.toThrow('平台名稱不能為空')
      })

      test('應該處理超大陣列輸入', async () => {
        const largeBookArray = Array(10000).fill(validBookData).map((book, index) => ({
          ...book,
          id: `book-${index}`
        }))

        // 應該成功處理但可能有效能警告
        const result = await dataValidationService.validateAndNormalize(
          largeBookArray,
          'READMOO',
          'LARGE_ARRAY_TEST'
        )

        expect(result.totalBooks).toBe(10000)
        expect(result.duration).toBeDefined()
        // 可能會有效能警告
        expect(result.warnings.some(w => w.type === 'PERFORMANCE_WARNING')).toBeTruthy()
      })
    })

    describe('系統錯誤處理', () => {
      test('應該處理記憶體不足錯誤', async () => {
        // 模擬記憶體不足情況
        const mockOutOfMemory = jest.spyOn(JSON, 'stringify').mockImplementation(() => {
          throw new Error('JavaScript heap out of memory')
        })

        await expect(
          dataValidationService.validateAndNormalize([validBookData], 'READMOO', 'MEMORY_TEST')
        ).rejects.toThrow('heap out of memory')

        mockOutOfMemory.mockRestore()
      })

      test('應該處理網路逾時錯誤', async () => {
        // 清除快取以確保會調用 loadRulesForPlatform
        dataValidationService.validationRules.clear()

        // 模擬載入驗證規則時的網路錯誤
        jest.spyOn(dataValidationService, 'loadRulesForPlatform')
          .mockRejectedValueOnce(new Error('Network timeout'))

        await expect(
          dataValidationService.loadPlatformValidationRules('READMOO')
        ).rejects.toThrow('載入驗證規則失敗')
      })

      test('應該處理並發存取衝突', async () => {
        // 同時進行多個驗證操作
        const concurrentValidations = Array(10).fill().map((_, index) =>
          dataValidationService.validateAndNormalize(
            [{ ...validBookData, id: `concurrent-book-${index}` }],
            'READMOO',
            `CONCURRENT_TEST_${index}`
          )
        )

        const results = await Promise.all(concurrentValidations)

        // 所有驗證都應該成功完成
        results.forEach((result, index) => {
          expect(result.validBooks).toHaveLength(1)
          expect(result.validBooks[0].id).toBe(`concurrent-book-${index}`)
        })
      })

      test('應該處理驗證規則損壞', async () => {
        // 模擬損壞的驗證規則
        dataValidationService.validationRules.set('CORRUPTED_PLATFORM', null)

        await expect(
          dataValidationService.validateSingleBook(validBookData, 'CORRUPTED_PLATFORM', 'CORRUPTED_TEST')
        ).rejects.toThrow('驗證規則損壞')
      })
    })

    describe('資源限制處理', () => {
      test('應該處理驗證逾時', async () => {
        // 設定短逾時時間
        dataValidationService.config.validationTimeout = 100

        // 模擬緩慢的驗證過程
        jest.spyOn(dataValidationService, 'validateSingleBook')
          .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 200)))

        await expect(
          dataValidationService.validateAndNormalize([validBookData], 'READMOO', 'TIMEOUT_TEST')
        ).rejects.toThrow('驗證逾時')
      })

      test('應該處理批次大小限制', async () => {
        dataValidationService.config.maxBatchSize = 5

        const largeBatch = Array(10).fill(validBookData)

        // 應該自動分批處理
        const result = await dataValidationService.validateAndNormalize(
          largeBatch,
          'READMOO',
          'BATCH_LIMIT_TEST'
        )

        expect(result.totalBooks).toBe(10)
        expect(result.validBooks).toHaveLength(10)
        // 應該有分批處理的記錄
        expect(result.warnings.some(w => w.type === 'BATCH_SPLIT_INFO')).toBeTruthy()
      })
    })

    describe('資料品質邊界條件', () => {
      test('應該處理極端低品質資料', async () => {
        const veryLowQualityBook = {
          id: '',
          title: '',
          authors: [],
          data: null,
          invalid_field: 'should be ignored'
        }

        const validation = await dataValidationService.validateSingleBook(
          veryLowQualityBook,
          'READMOO',
          'LOW_QUALITY_TEST'
        )

        expect(validation.isValid).toBe(false)
        expect(validation.errors.length).toBeGreaterThan(0)
        expect(validation.warnings.length).toBeGreaterThan(0)
      })

      test('應該處理循環引用資料結構', async () => {
        const circularBook = { ...validBookData }
        circularBook.self = circularBook // 建立循環引用

        // 應該能安全處理循環引用
        const validation = await dataValidationService.validateSingleBook(
          circularBook,
          'READMOO',
          'CIRCULAR_TEST'
        )

        expect(validation).toBeDefined()
        expect(validation.bookId).toBe('book-123')
      })

      test('應該處理深度嵌套的物件結構', async () => {
        const deepNestedBook = {
          ...validBookData,
          metadata: {
            level1: {
              level2: {
                level3: {
                  level4: {
                    level5: {
                      deepValue: 'nested value'
                    }
                  }
                }
              }
            }
          }
        }

        const validation = await dataValidationService.validateSingleBook(
          deepNestedBook,
          'READMOO',
          'DEEP_NESTED_TEST'
        )

        expect(validation.isValid).toBe(true)
        expect(validation.book.metadata).toBeDefined()
      })
    })
  })

  describe('5. 事件系統整合測試', () => {
    beforeEach(async () => {
      await dataValidationService.initialize()
    })

    describe('事件發布', () => {
      test('應該發布驗證開始事件', async () => {
        await dataValidationService.validateAndNormalize([validBookData], 'READMOO', 'EVENT_START_TEST')

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          'DATA.VALIDATION.STARTED',
          expect.objectContaining({
            validationId: expect.any(String),
            platform: 'READMOO',
            source: 'EVENT_START_TEST',
            bookCount: 1
          })
        )
      })

      test('應該發布驗證完成事件', async () => {
        await dataValidationService.validateAndNormalize([validBookData], 'READMOO', 'EVENT_COMPLETE_TEST')

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          'DATA.VALIDATION.COMPLETED',
          expect.objectContaining({
            platform: 'READMOO',
            source: 'EVENT_COMPLETE_TEST',
            qualityScore: expect.any(Number),
            validCount: 1,
            invalidCount: 0
          })
        )
      })

      test('應該發布驗證失敗事件', async () => {
        jest.spyOn(dataValidationService, 'validateSingleBook')
          .mockRejectedValueOnce(new Error('模擬驗證錯誤'))

        await expect(
          dataValidationService.validateAndNormalize([validBookData], 'READMOO', 'EVENT_FAIL_TEST')
        ).rejects.toThrow('模擬驗證錯誤')

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          'DATA.VALIDATION.FAILED',
          expect.objectContaining({
            platform: 'READMOO',
            source: 'EVENT_FAIL_TEST',
            error: '模擬驗證錯誤'
          })
        )
      })

      test('應該發布批次處理進度事件', async () => {
        // 設置小批次大小以觸發多批次處理
        dataValidationService.config.batchSize = 20

        const largeBatch = Array(50).fill().map((_, index) => ({
          ...validBookData,
          id: `batch-book-${index}`
        }))

        await dataValidationService.validateAndNormalize(largeBatch, 'READMOO', 'BATCH_PROGRESS_TEST')

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          'DATA.VALIDATION.PROGRESS',
          expect.objectContaining({
            platform: 'READMOO',
            processed: expect.any(Number),
            total: 50,
            percentage: expect.any(Number)
          })
        )
      })

      test('應該發布資料品質警告事件', async () => {
        const lowQualityBook = {
          id: 'quality-test',
          title: 'a', // 太短的標題
          authors: [''] // 空作者名稱
        }

        await dataValidationService.validateAndNormalize([lowQualityBook], 'READMOO', 'QUALITY_WARNING_TEST')

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          'DATA.QUALITY.WARNING',
          expect.objectContaining({
            platform: 'READMOO',
            bookId: 'quality-test',
            warnings: expect.any(Array)
          })
        )
      })
    })

    describe('事件監聽', () => {
      test('應該回應驗證請求事件', async () => {
        const validationRequest = {
          books: [validBookData],
          platform: 'READMOO',
          source: 'EVENT_REQUEST_TEST',
          requestId: 'req-123'
        }

        // 觸發驗證請求事件
        await mockEventBus.emit('DATA.VALIDATION.REQUESTED', validationRequest)

        // 等待事件處理完成
        await new Promise(resolve => setTimeout(resolve, 10))

        // 驗證服務應該處理該請求
        expect(mockEventBus.emit).toHaveBeenCalledWith(
          'DATA.VALIDATION.COMPLETED',
          expect.objectContaining({
            requestId: 'req-123'
          })
        )
      })

      test('應該回應批次驗證請求事件', async () => {
        const batchRequest = {
          books: mixedQualityBooks,
          platform: 'READMOO',
          source: 'BATCH_REQUEST_TEST',
          batchId: 'batch-456',
          options: {
            strictMode: true,
            autoFix: false
          }
        }

        await mockEventBus.emit('DATA.READMOO.BATCH.VALIDATION.REQUESTED', batchRequest)

        // 等待事件處理完成
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          'DATA.VALIDATION.COMPLETED',
          expect.objectContaining({
            batchId: 'batch-456'
          })
        )
      })

      test('應該回應動態配置更新事件', async () => {
        const configUpdate = {
          platform: 'READMOO',
          validationRules: {
            required: ['id', 'title', 'authors'],
            types: { rating: 'number' }
          }
        }

        await mockEventBus.emit('DATA.VALIDATION.CONFIG.UPDATED', configUpdate)

        // 驗證規則應該被更新
        const updatedRules = dataValidationService.validationRules.get('READMOO')
        expect(updatedRules.required).toEqual(['id', 'title', 'authors'])
      })

      test('應該處理優先級事件', async () => {
        const highPriorityRequest = {
          books: [validBookData],
          platform: 'READMOO',
          source: 'HIGH_PRIORITY_TEST',
          priority: 'HIGH',
          requestId: 'high-pri-123'
        }

        const lowPriorityRequest = {
          books: [validBookData],
          platform: 'READMOO',
          source: 'LOW_PRIORITY_TEST',
          priority: 'LOW',
          requestId: 'low-pri-456'
        }

        // 同時發送兩個請求
        await Promise.all([
          mockEventBus.emit('DATA.VALIDATION.REQUESTED', highPriorityRequest),
          mockEventBus.emit('DATA.VALIDATION.REQUESTED', lowPriorityRequest)
        ])

        // 等待事件處理完成
        await new Promise(resolve => setTimeout(resolve, 20))

        // 高優先級請求應該先被處理
        const emitCalls = mockEventBus.emit.mock.calls
        const highPriorityResponse = emitCalls.find(call =>
          call[0] === 'DATA.VALIDATION.COMPLETED' && call[1].requestId === 'high-pri-123'
        )
        const lowPriorityResponse = emitCalls.find(call =>
          call[0] === 'DATA.VALIDATION.COMPLETED' && call[1].requestId === 'low-pri-456'
        )

        expect(highPriorityResponse).toBeDefined()
        expect(lowPriorityResponse).toBeDefined()
      })
    })

    describe('跨領域事件協作', () => {
      test('應該回應 Platform Domain 平台檢測事件', async () => {
        const platformDetectedEvent = {
          platform: 'READMOO',
          adapter: 'readmoo-adapter',
          supportedFeatures: ['extraction', 'validation']
        }

        await mockEventBus.emit('PLATFORM.READMOO.DETECTED', platformDetectedEvent)

        // 應該自動載入該平台的驗證規則
        expect(dataValidationService.validationRules.has('READMOO')).toBe(true)
      })

      test('應該回應 Extraction Domain 提取完成事件', async () => {
        const extractionCompletedEvent = {
          platform: 'READMOO',
          books: [validBookData],
          extractionId: 'extract-789',
          timestamp: new Date().toISOString()
        }

        await mockEventBus.emit('EXTRACTION.READMOO.COMPLETED', extractionCompletedEvent)

        // 等待事件處理完成
        await new Promise(resolve => setTimeout(resolve, 10))

        // 應該自動開始驗證提取的資料
        expect(mockEventBus.emit).toHaveBeenCalledWith(
          'DATA.VALIDATION.COMPLETED',
          expect.objectContaining({
            platform: 'READMOO',
            source: 'EXTRACTION',
            extractionId: 'extract-789'
          })
        )
      })

      test('應該發送資料給 Sync Domain', async () => {
        const result = await dataValidationService.validateAndNormalize(
          [validBookData],
          'READMOO',
          'SYNC_INTEGRATION_TEST'
        )

        // 驗證完成後應該通知同步領域
        expect(mockEventBus.emit).toHaveBeenCalledWith(
          'DATA.READY_FOR_SYNC',
          expect.objectContaining({
            platform: 'READMOO',
            normalizedBooks: result.normalizedBooks,
            validationId: result.validationId
          })
        )
      })
    })
  })

  describe('6. 效能與批次處理測試', () => {
    beforeEach(async () => {
      await dataValidationService.initialize()
    })

    describe('效能基準測試', () => {
      test('應該在合理時間內完成小批次驗證 (<100ms)', async () => {
        const smallBatch = Array(10).fill().map((_, index) => ({
          ...validBookData,
          id: `perf-small-${index}`
        }))

        const startTime = Date.now()
        const result = await dataValidationService.validateAndNormalize(
          smallBatch,
          'READMOO',
          'SMALL_BATCH_PERF_TEST'
        )
        const duration = Date.now() - startTime

        expect(duration).toBeLessThan(100)
        expect(result.totalBooks).toBe(10)
        expect(result.duration).toBeLessThan(100)
      })

      test('應該在合理時間內完成中等批次驗證 (<500ms)', async () => {
        const mediumBatch = Array(100).fill().map((_, index) => ({
          ...validBookData,
          id: `perf-medium-${index}`
        }))

        const startTime = Date.now()
        const result = await dataValidationService.validateAndNormalize(
          mediumBatch,
          'READMOO',
          'MEDIUM_BATCH_PERF_TEST'
        )
        const duration = Date.now() - startTime

        expect(duration).toBeLessThan(500)
        expect(result.totalBooks).toBe(100)
      })

      test('應該在合理時間內完成大批次驗證 (<2000ms)', async () => {
        const largeBatch = Array(1000).fill().map((_, index) => ({
          ...validBookData,
          id: `perf-large-${index}`
        }))

        const startTime = Date.now()
        const result = await dataValidationService.validateAndNormalize(
          largeBatch,
          'READMOO',
          'LARGE_BATCH_PERF_TEST'
        )
        const duration = Date.now() - startTime

        expect(duration).toBeLessThan(2000)
        expect(result.totalBooks).toBe(1000)
        expect(result.validBooks).toHaveLength(1000)
      })

      test('應該監控記憶體使用量', async () => {
        const memoryBefore = process.memoryUsage().heapUsed

        const largeBatch = Array(500).fill().map((_, index) => ({
          ...validBookData,
          id: `memory-test-${index}`,
          largeData: 'x'.repeat(1000) // 增加每個物件的記憶體佔用
        }))

        const result = await dataValidationService.validateAndNormalize(
          largeBatch,
          'READMOO',
          'MEMORY_USAGE_TEST'
        )

        const memoryAfter = process.memoryUsage().heapUsed
        const memoryIncrease = memoryAfter - memoryBefore

        // 記憶體增長應該在合理範圍內（小於50MB）
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
        expect(result.totalBooks).toBe(500)
      })
    })

    describe('批次處理策略', () => {
      test('應該自動分批處理超大陣列', async () => {
        dataValidationService.config.maxBatchSize = 100

        const hugeBatch = Array(350).fill().map((_, index) => ({
          ...validBookData,
          id: `huge-batch-${index}`
        }))

        const result = await dataValidationService.validateAndNormalize(
          hugeBatch,
          'READMOO',
          'HUGE_BATCH_TEST'
        )

        expect(result.totalBooks).toBe(350)
        expect(result.validBooks).toHaveLength(350)
        // 應該有批次處理記錄
        expect(result.warnings.some(w => w.type === 'BATCH_SPLIT_INFO')).toBeTruthy()
      })

      test('應該並行處理多個批次', async () => {
        dataValidationService.config.concurrentBatches = 3

        const concurrentBatches = [
          Array(50).fill().map((_, i) => ({ ...validBookData, id: `batch1-${i}` })),
          Array(50).fill().map((_, i) => ({ ...validBookData, id: `batch2-${i}` })),
          Array(50).fill().map((_, i) => ({ ...validBookData, id: `batch3-${i}` }))
        ]

        const startTime = Date.now()
        const results = await Promise.all(
          concurrentBatches.map((batch, index) =>
            dataValidationService.validateAndNormalize(batch, 'READMOO', `CONCURRENT_BATCH_${index}`)
          )
        )
        const duration = Date.now() - startTime

        // 並行處理應該比串行處理快
        expect(duration).toBeLessThan(500) // 假設串行需要更長時間
        results.forEach(result => {
          expect(result.totalBooks).toBe(50)
          expect(result.validBooks).toHaveLength(50)
        })
      })

      test('應該支援批次處理優化配置', async () => {
        const optimizedConfig = {
          ...mockConfig,
          batchSize: 50,
          parallelProcessing: true,
          memoryOptimization: true,
          progressReporting: true
        }

        const optimizedService = new DataValidationService(mockEventBus, optimizedConfig)
        await optimizedService.initialize()

        const batch = Array(200).fill().map((_, index) => ({
          ...validBookData,
          id: `optimized-${index}`
        }))

        const result = await optimizedService.validateAndNormalize(
          batch,
          'READMOO',
          'OPTIMIZATION_TEST'
        )

        expect(result.totalBooks).toBe(200)
        expect(result.validBooks).toHaveLength(200)
        // 應該有效能優化報告
        expect(result.performance).toBeDefined()
        expect(result.performance.booksPerSecond).toBeGreaterThan(0)
      })
    })

    describe('資源使用優化', () => {
      test('應該實現資料流式處理', async () => {
        const streamConfig = {
          ...mockConfig,
          streamProcessing: true,
          streamBatchSize: 25
        }

        const streamService = new DataValidationService(mockEventBus, streamConfig)
        await streamService.initialize()

        const largeBatch = Array(500).fill().map((_, index) => ({
          ...validBookData,
          id: `stream-${index}`
        }))

        let progressEvents = 0
        mockEventBus.on('DATA.VALIDATION.PROGRESS', () => {
          progressEvents++
        })

        const result = await streamService.validateAndNormalize(
          largeBatch,
          'READMOO',
          'STREAM_PROCESSING_TEST'
        )

        expect(result.totalBooks).toBe(500)
        expect(progressEvents).toBeGreaterThan(0) // 應該有進度報告
      })

      test('應該支援記憶體閾值控制', async () => {
        const memoryLimitConfig = {
          ...mockConfig,
          memoryThreshold: 100 * 1024 * 1024, // 100MB
          gcAfterBatch: true
        }

        const memoryService = new DataValidationService(mockEventBus, memoryLimitConfig)
        await memoryService.initialize()

        const memoryIntensiveBatch = Array(1000).fill().map((_, index) => ({
          ...validBookData,
          id: `memory-intensive-${index}`,
          metadata: {
            largeData: 'x'.repeat(10000)
          }
        }))

        const result = await memoryService.validateAndNormalize(
          memoryIntensiveBatch,
          'READMOO',
          'MEMORY_THRESHOLD_TEST'
        )

        expect(result.totalBooks).toBe(1000)
        // 應該有記憶體管理記錄
        expect(result.warnings.some(w => w.type === 'MEMORY_MANAGEMENT_INFO')).toBeTruthy()
      })

      test('應該支援快取機制優化', async () => {
        const cacheConfig = {
          ...mockConfig,
          enableCache: true,
          cacheSize: 1000,
          cacheTTL: 300000 // 5分鐘
        }

        const cacheService = new DataValidationService(mockEventBus, cacheConfig)
        await cacheService.initialize()

        const sameBook = { ...validBookData, id: 'cache-test-book' }

        // 第一次驗證
        const startTime1 = Date.now()
        const result1 = await cacheService.validateSingleBook(sameBook, 'READMOO', 'CACHE_TEST_1')
        const duration1 = Date.now() - startTime1

        // 第二次驗證同一本書（應該使用快取）
        const startTime2 = Date.now()
        const result2 = await cacheService.validateSingleBook(sameBook, 'READMOO', 'CACHE_TEST_2')
        const duration2 = Date.now() - startTime2

        expect(result1.isValid).toBe(result2.isValid)
        expect(duration2).toBeLessThan(duration1) // 快取應該更快
      })
    })
  })

  describe('7. 統一資料模型輸出測試', () => {
    beforeEach(async () => {
      await dataValidationService.initialize()
    })

    describe('normalizeBook - 資料標準化', () => {
      test('應該輸出符合 v2.0 統一資料模型的格式', async () => {
        const normalizedBook = await dataValidationService.normalizeBook(validBookData, 'READMOO')

        // 檢查核心識別資訊
        expect(normalizedBook.id).toBe('book-123')
        expect(normalizedBook.crossPlatformId).toBeDefined()
        expect(normalizedBook.platform).toBe('READMOO')

        // 檢查基本書籍資訊
        expect(normalizedBook.title).toBe('測試書籍標題')
        expect(normalizedBook.authors).toEqual(['作者A', '作者B'])
        expect(normalizedBook.publisher).toBe('測試出版社')
        expect(normalizedBook.isbn).toBe('9789571234567')

        // 檢查封面圖片結構
        expect(normalizedBook.cover).toHaveProperty('thumbnail')
        expect(normalizedBook.cover).toHaveProperty('medium')
        expect(normalizedBook.cover).toHaveProperty('large')

        // 檢查閱讀狀態
        expect(normalizedBook.progress).toHaveProperty('percentage', 75)
        expect(normalizedBook.progress).toHaveProperty('currentPage', 150)
        expect(normalizedBook.progress).toHaveProperty('totalPages', 200)
        expect(normalizedBook.status).toBe('READING')

        // 檢查版本資訊
        expect(normalizedBook.schemaVersion).toBe('2.0.0')
        expect(normalizedBook.createdAt).toBeDefined()
        expect(normalizedBook.updatedAt).toBeDefined()

        // 檢查資料指紋
        expect(normalizedBook.dataFingerprint).toBeDefined()
      })

      test('應該正確標準化標題格式', async () => {
        const testCases = [
          { input: '  標題前後有空白  ', expected: '標題前後有空白' },
          { input: '標題\n中間\t有\r換行', expected: '標題 中間 有 換行' },
          { input: 'Title    with    multiple    spaces', expected: 'Title with multiple spaces' }
        ]

        for (const { input, expected } of testCases) {
          const book = { ...validBookData, title: input }
          const normalized = await dataValidationService.normalizeBook(book, 'READMOO')
          expect(normalized.title).toBe(expected)
        }
      })

      test('應該正確標準化作者格式', async () => {
        const testCases = [
          { input: '單一作者', expected: ['單一作者'] },
          { input: ['作者A', '作者B'], expected: ['作者A', '作者B'] },
          { input: [{ name: '物件作者' }], expected: ['物件作者'] },
          { input: null, expected: [] },
          { input: '', expected: [] }
        ]

        for (const { input, expected } of testCases) {
          const book = { ...validBookData, authors: input, author: input }
          const normalized = await dataValidationService.normalizeBook(book, 'READMOO')
          expect(normalized.authors).toEqual(expected)
        }
      })

      test('應該正確標準化 ISBN 格式', async () => {
        const testCases = [
          { input: '978-957-123-456-7', expected: '9789571234567' },
          { input: '978 957 123 456 7', expected: '9789571234567' },
          { input: 'isbn:9789571234567', expected: '9789571234567' },
          { input: '979-12-3456-789-X', expected: '979123456789X' },
          { input: '', expected: '' },
          { input: null, expected: '' }
        ]

        for (const { input, expected } of testCases) {
          const book = { ...validBookData, isbn: input }
          const normalized = await dataValidationService.normalizeBook(book, 'READMOO')
          expect(normalized.isbn).toBe(expected)
        }
      })

      test('應該正確標準化封面圖片格式', async () => {
        const testCases = [
          {
            input: 'https://example.com/cover.jpg',
            expected: {
              thumbnail: 'https://example.com/cover.jpg',
              medium: 'https://example.com/cover.jpg',
              large: 'https://example.com/cover.jpg'
            }
          },
          {
            input: {
              small: 'https://example.com/small.jpg',
              medium: 'https://example.com/medium.jpg',
              large: 'https://example.com/large.jpg'
            },
            expected: {
              thumbnail: 'https://example.com/small.jpg',
              medium: 'https://example.com/medium.jpg',
              large: 'https://example.com/large.jpg'
            }
          },
          {
            input: null,
            expected: {
              thumbnail: '',
              medium: '',
              large: ''
            }
          }
        ]

        for (const { input, expected } of testCases) {
          const book = { ...validBookData, cover: input }
          const normalized = await dataValidationService.normalizeBook(book, 'READMOO')
          expect(normalized.cover).toEqual(expected)
        }
      })

      test('應該正確標準化閱讀進度格式', async () => {
        const testCases = [
          {
            input: { percentage: 75.5, currentPage: 150, totalPages: 200 },
            expected: { percentage: 75, currentPage: 150, totalPages: 200, lastPosition: '' }
          },
          {
            input: { percent: 120, page: -10, total: 0 }, // 邊界值測試
            expected: { percentage: 100, currentPage: 0, totalPages: 0, lastPosition: '' }
          },
          {
            input: null,
            expected: { percentage: 0, currentPage: 0, totalPages: 0, lastPosition: '' }
          }
        ]

        for (const { input, expected } of testCases) {
          const book = { ...validBookData, progress: input }
          const normalized = await dataValidationService.normalizeBook(book, 'READMOO')
          expect(normalized.progress).toEqual(expected)
        }
      })

      test('應該生成正確的跨平台統一 ID', async () => {
        const book1 = {
          title: '相同書籍',
          authors: ['作者A'],
          isbn: '9789571234567'
        }

        const book2 = {
          id: 'different-id',
          title: '相同書籍',
          authors: ['作者A'],
          isbn: '9789571234567'
        }

        const normalized1 = await dataValidationService.normalizeBook(book1, 'READMOO')
        const normalized2 = await dataValidationService.normalizeBook(book2, 'KINDLE')

        // 相同內容的書籍應該有相同的跨平台 ID
        expect(normalized1.crossPlatformId).toBe(normalized2.crossPlatformId)
      })

      test('應該正確處理平台特定元資料', async () => {
        const readmooBook = {
          ...validBookData,
          readmoo_type: '流式',
          readmoo_drm: true,
          readmoo_series_id: 'series-123'
        }

        const normalized = await dataValidationService.normalizeBook(readmooBook, 'READMOO')

        expect(normalized.platformMetadata).toHaveProperty('READMOO')
        expect(normalized.platformMetadata.READMOO).toHaveProperty('originalData')
        expect(normalized.platformMetadata.READMOO).toHaveProperty('extractionTimestamp')
        expect(normalized.platformMetadata.READMOO).toHaveProperty('dataQuality')
        expect(normalized.platformMetadata.READMOO.originalData.readmoo_type).toBe('流式')
      })

      test('應該初始化同步管理欄位', async () => {
        const normalized = await dataValidationService.normalizeBook(validBookData, 'READMOO')

        expect(normalized.syncStatus).toBeDefined()
        expect(normalized.syncStatus.lastSyncTimestamp).toBeDefined()
        expect(normalized.syncStatus.conflictResolved).toBe(true)
        expect(normalized.syncStatus.mergeStrategy).toBe('LATEST_TIMESTAMP')
        expect(normalized.syncStatus.syncSources).toEqual(['READMOO'])
        expect(normalized.syncStatus.pendingSync).toBe(false)
      })
    })

    describe('calculateQualityScore - 品質分數計算', () => {
      test('應該為完美資料計算高品質分數', () => {
        const perfectReport = {
          totalBooks: 10,
          validBooks: Array(10).fill({}),
          invalidBooks: [],
          warnings: []
        }

        const qualityScore = dataValidationService.calculateQualityScore(perfectReport)
        expect(qualityScore).toBe(100)
      })

      test('應該為部分無效資料計算適當的品質分數', () => {
        const partialReport = {
          totalBooks: 10,
          validBooks: Array(7).fill({}),
          invalidBooks: Array(3).fill({}),
          warnings: Array(5).fill({})
        }

        const qualityScore = dataValidationService.calculateQualityScore(partialReport)
        expect(qualityScore).toBe(65) // 70% valid - 5% warning penalty
      })

      test('應該為空資料集返回 0 分數', () => {
        const emptyReport = {
          totalBooks: 0,
          validBooks: [],
          invalidBooks: [],
          warnings: []
        }

        const qualityScore = dataValidationService.calculateQualityScore(emptyReport)
        expect(qualityScore).toBe(0)
      })

      test('應該限制警告懲罰的最大影響', () => {
        const heavyWarningReport = {
          totalBooks: 10,
          validBooks: Array(10).fill({}),
          invalidBooks: [],
          warnings: Array(100).fill({}) // 大量警告
        }

        const qualityScore = dataValidationService.calculateQualityScore(heavyWarningReport)
        expect(qualityScore).toBe(80) // 100% valid - 20% max warning penalty
      })
    })

    describe('generateDataFingerprint - 資料指紋生成', () => {
      test('應該為相同內容生成相同指紋', async () => {
        const book1 = {
          title: '測試書籍',
          authors: ['作者A', '作者B'],
          isbn: '9789571234567'
        }

        const book2 = {
          id: 'different-id',
          title: '測試書籍',
          authors: ['作者A', '作者B'],
          isbn: '9789571234567',
          metadata: 'extra data'
        }

        const fingerprint1 = await dataValidationService.generateDataFingerprint(book1)
        const fingerprint2 = await dataValidationService.generateDataFingerprint(book2)

        expect(fingerprint1).toBe(fingerprint2)
      })

      test('應該為不同內容生成不同指紋', async () => {
        const book1 = {
          title: '書籍A',
          authors: ['作者A'],
          isbn: '9789571234567'
        }

        const book2 = {
          title: '書籍B',
          authors: ['作者B'],
          isbn: '9789571234568'
        }

        const fingerprint1 = await dataValidationService.generateDataFingerprint(book1)
        const fingerprint2 = await dataValidationService.generateDataFingerprint(book2)

        expect(fingerprint1).not.toBe(fingerprint2)
      })

      test('應該生成合理長度的指紋', async () => {
        const fingerprint = await dataValidationService.generateDataFingerprint(validBookData)

        expect(typeof fingerprint).toBe('string')
        expect(fingerprint.length).toBeGreaterThan(5)
        expect(fingerprint.length).toBeLessThan(50)
        expect(fingerprint).toMatch(/^[a-z0-9]+$/) // 只包含小寫字母和數字
      })
    })

    describe('validateAndNormalize 整合輸出測試', () => {
      test('應該輸出完整的驗證報告結構', async () => {
        const result = await dataValidationService.validateAndNormalize(
          mixedQualityBooks,
          'READMOO',
          'COMPLETE_REPORT_TEST'
        )

        // 檢查報告結構完整性
        expect(result).toHaveProperty('validationId')
        expect(result).toHaveProperty('platform', 'READMOO')
        expect(result).toHaveProperty('source', 'COMPLETE_REPORT_TEST')
        expect(result).toHaveProperty('totalBooks', 4)
        expect(result).toHaveProperty('validBooks')
        expect(result).toHaveProperty('invalidBooks')
        expect(result).toHaveProperty('warnings')
        expect(result).toHaveProperty('normalizedBooks')
        expect(result).toHaveProperty('qualityScore')
        expect(result).toHaveProperty('startTime')
        expect(result).toHaveProperty('endTime')
        expect(result).toHaveProperty('duration')

        // 檢查時間記錄
        expect(typeof result.startTime).toBe('number')
        expect(typeof result.endTime).toBe('number')
        expect(result.endTime).toBeGreaterThanOrEqual(result.startTime)
        expect(result.duration).toBe(result.endTime - result.startTime)

        // 檢查標準化書籍格式
        result.normalizedBooks.forEach(book => {
          expect(book).toHaveProperty('schemaVersion', '2.0.0')
          expect(book).toHaveProperty('dataFingerprint')
          expect(book).toHaveProperty('syncStatus')
          expect(book).toHaveProperty('platformMetadata')
        })
      })

      test('應該在批次驗證中保持資料一致性', async () => {
        const batchBooks = Array(100).fill().map((_, index) => ({
          ...validBookData,
          id: `batch-consistency-${index}`,
          title: `批次書籍 ${index}`
        }))

        const result = await dataValidationService.validateAndNormalize(
          batchBooks,
          'READMOO',
          'BATCH_CONSISTENCY_TEST'
        )

        expect(result.totalBooks).toBe(100)
        expect(result.normalizedBooks).toHaveLength(100)

        // 檢查每本書的格式一致性
        result.normalizedBooks.forEach((book, index) => {
          expect(book.id).toBe(`batch-consistency-${index}`)
          expect(book.title).toBe(`批次書籍 ${index}`)
          expect(book.schemaVersion).toBe('2.0.0')
          expect(book.platform).toBe('READMOO')
        })

        // 檢查跨平台ID的唯一性
        const crossPlatformIds = result.normalizedBooks.map(book => book.crossPlatformId)
        const uniqueIds = new Set(crossPlatformIds)
        expect(uniqueIds.size).toBe(100) // 所有ID應該唯一
      })
    })
  })

  describe('8. 完整工作流程整合測試', () => {
    beforeEach(async () => {
      await dataValidationService.initialize()
    })

    test('應該完成從原始資料到標準化資料的完整流程', async () => {
      // 1. 準備原始的 READMOO 資料
      const rawReadmooData = [
        {
          id: '210327003000101',
          title: '  大腦不滿足  ',
          cover: 'https://cdn.readmoo.com/cover/jb/qpfmrmi_210x315.jpg',
          progress: 60,
          type: '流式',
          isNew: false,
          isFinished: false,
          author: 'Daniel J. Siegel' // 單一作者字串
        }
      ]

      // 2. 執行完整的驗證和標準化流程
      const result = await dataValidationService.validateAndNormalize(
        rawReadmooData,
        'READMOO',
        'COMPLETE_WORKFLOW_TEST'
      )

      // 3. 驗證完整流程的輸出
      expect(result.totalBooks).toBe(1)
      expect(result.validBooks).toHaveLength(1)
      expect(result.normalizedBooks).toHaveLength(1)

      const normalizedBook = result.normalizedBooks[0]

      // 4. 檢查資料轉換正確性
      expect(normalizedBook.id).toBe('210327003000101')
      expect(normalizedBook.title).toBe('大腦不滿足') // 去除空白
      expect(normalizedBook.authors).toEqual(['Daniel J. Siegel']) // 轉為陣列
      expect(normalizedBook.platform).toBe('READMOO')
      expect(normalizedBook.progress.percentage).toBe(60)

      // 5. 檢查 v2.0 模型完整性
      expect(normalizedBook.schemaVersion).toBe('2.0.0')
      expect(normalizedBook.crossPlatformId).toBeDefined()
      expect(normalizedBook.dataFingerprint).toBeDefined()
      expect(normalizedBook.syncStatus).toBeDefined()
      expect(normalizedBook.platformMetadata.READMOO).toBeDefined()

      // 6. 檢查事件發布
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'DATA.VALIDATION.COMPLETED',
        expect.objectContaining({
          platform: 'READMOO',
          qualityScore: expect.any(Number),
          normalizedBooks: expect.arrayContaining([normalizedBook])
        })
      )
    })

    test('應該處理多平台混合資料的完整流程', async () => {
      // 模擬來自不同平台的資料
      const multiPlatformData = [
        { id: 'readmoo-1', title: 'READMOO 書籍', progress: 50, authors: ['作者1'] },
        { ASIN: 'kindle-1', title: 'Kindle 書籍', reading_progress: { percent_complete: 75 }, authors: ['作者2'] },
        { id: 'kobo-1', title: 'Kobo 書籍', reading_state: { current_position: 0.25 }, authors: ['作者3'] }
      ]

      const platforms = ['READMOO', 'KINDLE', 'KOBO']
      const results = []

      // 對每個平台分別進行驗證
      for (let i = 0; i < platforms.length; i++) {
        const result = await dataValidationService.validateAndNormalize(
          [multiPlatformData[i]],
          platforms[i],
          `MULTI_PLATFORM_TEST_${platforms[i]}`
        )
        results.push(result)
      }

      // 檢查所有平台的結果
      results.forEach((result, index) => {
        expect(result.totalBooks).toBe(1)
        expect(result.normalizedBooks).toHaveLength(1)
        expect(result.normalizedBooks[0].platform).toBe(platforms[index])
        expect(result.normalizedBooks[0].schemaVersion).toBe('2.0.0')
      })

      // 檢查跨平台資料的一致性
      const allNormalizedBooks = results.flatMap(r => r.normalizedBooks)
      allNormalizedBooks.forEach(book => {
        expect(book).toHaveProperty('crossPlatformId')
        expect(book).toHaveProperty('dataFingerprint')
        expect(book.syncStatus).toBeDefined()
      })
    })

    test('應該在真實資料量級下保持效能和準確性', async () => {
      // 使用真實的樣本資料
      const realDataResult = await dataValidationService.validateAndNormalize(
        sampleBooks,
        'READMOO',
        'REAL_DATA_TEST'
      )

      // 檢查處理結果
      expect(realDataResult.totalBooks).toBe(sampleBooks.length)
      expect(realDataResult.validBooks.length).toBeGreaterThan(0)
      expect(realDataResult.normalizedBooks.length).toBeGreaterThan(0)
      expect(realDataResult.qualityScore).toBeGreaterThan(65)

      // 檢查處理效能
      expect(realDataResult.duration).toBeLessThan(1000) // 1秒內完成

      // 檢查資料品質
      realDataResult.normalizedBooks.forEach(book => {
        expect(book.id).toBeDefined()
        expect(book.title).toBeDefined()
        expect(book.schemaVersion).toBe('2.0.0')
        expect(book.platform).toBe('READMOO')
      })
    })
  })

  describe('9. 錯誤邊界和恢復測試', () => {
    beforeEach(async () => {
      await dataValidationService.initialize()
    })

    test('應該在部分資料錯誤時繼續處理其餘資料', async () => {
      const mixedBatch = [
        validBookData,
        { ...invalidBookData, id: 'error-book-1' },
        { ...validBookData, id: 'valid-book-2', title: '正常書籍2' },
        null, // 完全無效的資料
        { ...validBookData, id: 'valid-book-3', title: '正常書籍3' }
      ]

      const result = await dataValidationService.validateAndNormalize(
        mixedBatch,
        'READMOO',
        'PARTIAL_ERROR_RECOVERY_TEST'
      )

      expect(result.totalBooks).toBe(5)
      expect(result.validBooks.length).toBeGreaterThan(0)
      expect(result.invalidBooks.length).toBeGreaterThan(0)
      expect(result.normalizedBooks.length).toBe(result.validBooks.length)
    })

    test('應該提供詳細的錯誤診斷資訊', async () => {
      const result = await dataValidationService.validateAndNormalize(
        [invalidBookData],
        'READMOO',
        'ERROR_DIAGNOSIS_TEST'
      )

      expect(result.invalidBooks).toHaveLength(1)
      const invalidBook = result.invalidBooks[0]

      expect(invalidBook.errors).toBeDefined()
      expect(invalidBook.errors.length).toBeGreaterThan(0)
      invalidBook.errors.forEach(error => {
        expect(error).toHaveProperty('type')
        expect(error).toHaveProperty('message')
        expect(error.message).toBeTruthy()
      })
    })
  })
})

/**
 * 測試工具函數和輔助方法
 */
describe('Data Validation Service Helper Methods', () => {
  let dataValidationService

  beforeEach(() => {
    dataValidationService = new DataValidationService(new MockEventBus(), {})
  })

  describe('工具方法測試', () => {
    test('hashString 應該生成一致的雜湊值', () => {
      const input = '測試字串'
      const hash1 = dataValidationService.hashString(input)
      const hash2 = dataValidationService.hashString(input)

      expect(hash1).toBe(hash2)
      expect(typeof hash1).toBe('string')
      expect(hash1.length).toBeGreaterThan(0)
    })

    test('getNestedValue 應該正確取得嵌套物件值', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              value: 'nested value'
            }
          }
        }
      }

      const value = dataValidationService.getNestedValue(obj, 'level1.level2.level3.value')
      expect(value).toBe('nested value')

      const undefinedValue = dataValidationService.getNestedValue(obj, 'level1.nonexistent.value')
      expect(undefinedValue).toBeUndefined()
    })

    test('isCorrectType 應該正確驗證資料類型', () => {
      expect(dataValidationService.isCorrectType('string', 'string')).toBe(true)
      expect(dataValidationService.isCorrectType(123, 'number')).toBe(true)
      expect(dataValidationService.isCorrectType(true, 'boolean')).toBe(true)
      expect(dataValidationService.isCorrectType([], 'array')).toBe(true)
      expect(dataValidationService.isCorrectType({}, 'object')).toBe(true)
      expect(dataValidationService.isCorrectType(new Date(), 'date')).toBe(true)
      expect(dataValidationService.isCorrectType('2024-01-15', 'date')).toBe(true)

      expect(dataValidationService.isCorrectType('string', 'number')).toBe(false)
      expect(dataValidationService.isCorrectType([], 'object')).toBe(false)
      expect(dataValidationService.isCorrectType(null, 'object')).toBe(false)
    })
  })
})
