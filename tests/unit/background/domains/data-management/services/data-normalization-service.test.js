/**
 * DataNormalizationService 測試
 * TDD 重構循環 3/8: 資料正規化邏輯提取
 *
 * 目標：將資料正規化邏輯從 DataValidationService 中提取
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')
// eslint-disable-next-line no-unused-vars
const DataNormalizationService = require('src/background/domains/data-management/services/data-normalization-service.js')
// eslint-disable-next-line no-unused-vars
const { StandardError } = require('src/core/errors/StandardError')

describe('DataNormalizationService - 資料正規化服務', () => {
  let normalizer
  // eslint-disable-next-line no-unused-vars
  let mockEventBus
  // eslint-disable-next-line no-unused-vars
  let mockLogger

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

    normalizer = new DataNormalizationService(mockEventBus, {
      logger: mockLogger,
      config: {
        enableDataFingerprint: true,
        enableCrossPlatformId: true,
        supportedPlatforms: ['READMOO', 'KINDLE', 'KOBO', 'BOOKWALKER', 'BOOKS_COM']
      }
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('🏗️ 服務初始化', () => {
    test('應該正確初始化資料正規化服務', () => {
      expect(normalizer).toBeInstanceOf(DataNormalizationService)
      expect(normalizer.eventBus).toBe(mockEventBus)
      expect(normalizer.logger).toBe(mockLogger)
    })

    test('應該初始化正規化配置', () => {
      expect(normalizer.config.enableDataFingerprint).toBe(true)
      expect(normalizer.config.enableCrossPlatformId).toBe(true)
      expect(normalizer.config.supportedPlatforms).toHaveLength(5)
    })

    test('應該初始化正規化統計', () => {
      expect(normalizer.normalizationStatistics).toBeDefined()
      expect(normalizer.normalizationStatistics.totalNormalized).toBe(0)
      expect(normalizer.normalizationStatistics.errorCount).toBe(0)
    })
  })

  describe('📖 書籍資料正規化', () => {
    test('normalizeBook() 應該正規化 READMOO 書籍資料', async () => {
      // eslint-disable-next-line no-unused-vars
      const book = {
        id: 'readmoo123',
        title: '測試書籍',
        authors: ['作者1', '作者2'],
        publisher: '測試出版社',
        progress: 50,
        cover: 'https://example.com/cover.jpg'
      }

      // eslint-disable-next-line no-unused-vars
      const result = await normalizer.normalizeBook(book, 'READMOO')

      expect(result.id).toBe('readmoo123')
      expect(result.platform).toBe('READMOO')
      expect(result.title).toBe('測試書籍')
      expect(result.authors).toEqual(['作者1', '作者2'])
      expect(result.publisher).toBe('測試出版社')
      expect(result.progress.percentage).toBe(50)
      expect(result.crossPlatformId).toBeDefined()
      expect(result.dataFingerprint).toBeDefined()
    })

    test('normalizeBook() 應該正規化 KINDLE 書籍資料', async () => {
      // eslint-disable-next-line no-unused-vars
      const book = {
        ASIN: 'B001ABCDEF',
        title: 'Kindle Test Book',
        authors: [{ name: 'Author 1' }],
        reading_progress: { percentage: 75 },
        cover: 'https://m.media-amazon.com/cover.jpg'
      }

      // eslint-disable-next-line no-unused-vars
      const result = await normalizer.normalizeBook(book, 'KINDLE')

      expect(result.id).toBe('B001ABCDEF')
      expect(result.platform).toBe('KINDLE')
      expect(result.title).toBe('Kindle Test Book')
      expect(result.authors).toEqual(['Author 1'])
      expect(result.progress.percentage).toBe(75)
    })

    test('normalizeBook() 應該處理缺少欄位的書籍', async () => {
      // eslint-disable-next-line no-unused-vars
      const book = {
        id: 'minimal',
        title: 'Minimal Book'
        // 缺少其他欄位
      }

      // eslint-disable-next-line no-unused-vars
      const result = await normalizer.normalizeBook(book, 'READMOO')

      expect(result.id).toBe('minimal')
      expect(result.title).toBe('Minimal Book')
      expect(result.authors).toEqual([])
      expect(result.publisher).toBe('')
      expect(result.progress.percentage).toBe(0)
      expect(result.rating).toBe(0)
    })

    test('normalizeBook() 應該生成跨平台統一ID', async () => {
      // eslint-disable-next-line no-unused-vars
      const book1 = {
        id: 'readmoo123',
        title: '相同書籍',
        authors: ['相同作者'],
        isbn: '9781234567890'
      }

      // eslint-disable-next-line no-unused-vars
      const book2 = {
        ASIN: 'B001ABCDEF',
        title: '相同書籍',
        authors: [{ name: '相同作者' }],
        isbn: '978-1-234-56789-0'
      }

      // eslint-disable-next-line no-unused-vars
      const result1 = await normalizer.normalizeBook(book1, 'READMOO')
      // eslint-disable-next-line no-unused-vars
      const result2 = await normalizer.normalizeBook(book2, 'KINDLE')

      expect(result1.crossPlatformId).toBe(result2.crossPlatformId)
    })
  })

  describe('🔧 標題正規化', () => {
    test('normalizeTitle() 應該清理標題空白', () => {
      expect(normalizer.normalizeTitle('  多餘空白   ')).toBe('多餘空白')
      expect(normalizer.normalizeTitle('多個\t\n空白')).toBe('多個 空白')
      expect(normalizer.normalizeTitle('')).toBe('')
      expect(normalizer.normalizeTitle(null)).toBe('')
    })

    test('normalizeTitle() 應該處理特殊字符', () => {
      expect(normalizer.normalizeTitle('書名：副標題')).toBe('書名：副標題')
      expect(normalizer.normalizeTitle('Book Title - Subtitle')).toBe('Book Title - Subtitle')
    })
  })

  describe('👥 作者正規化', () => {
    test('normalizeAuthors() 應該處理字串陣列', () => {
      // eslint-disable-next-line no-unused-vars
      const authors = ['作者1', '作者2', '作者3']
      // eslint-disable-next-line no-unused-vars
      const result = normalizer.normalizeAuthors(authors)
      expect(result).toEqual(['作者1', '作者2', '作者3'])
    })

    test('normalizeAuthors() 應該處理單一字串', () => {
      // eslint-disable-next-line no-unused-vars
      const authors = '作者1, 作者2'
      // eslint-disable-next-line no-unused-vars
      const result = normalizer.normalizeAuthors(authors)
      expect(result).toEqual(['作者1', '作者2'])
    })

    test('normalizeAuthors() 應該處理 Kindle 物件格式', () => {
      // eslint-disable-next-line no-unused-vars
      const authors = [
        { name: 'Author 1' },
        { name: 'Author 2' }
      ]
      // eslint-disable-next-line no-unused-vars
      const result = normalizer.normalizeAuthors(authors)
      expect(result).toEqual(['Author 1', 'Author 2'])
    })

    test('normalizeAuthors() 應該處理空值', () => {
      expect(normalizer.normalizeAuthors(null)).toEqual([])
      expect(normalizer.normalizeAuthors(undefined)).toEqual([])
      expect(normalizer.normalizeAuthors('')).toEqual([])
      expect(normalizer.normalizeAuthors([])).toEqual([])
    })

    test('normalizeAuthors() 應該清理作者名稱', () => {
      // eslint-disable-next-line no-unused-vars
      const authors = ['  作者1  ', '作者2\n', '\t作者3']
      // eslint-disable-next-line no-unused-vars
      const result = normalizer.normalizeAuthors(authors)
      expect(result).toEqual(['作者1', '作者2', '作者3'])
    })
  })

  describe('📚 ISBN 正規化', () => {
    test('normalizeISBN() 應該清理 ISBN 格式', () => {
      expect(normalizer.normalizeISBN('978-1-234-56789-0')).toBe('9781234567890')
      expect(normalizer.normalizeISBN('978 1 234 56789 0')).toBe('9781234567890')
      expect(normalizer.normalizeISBN('ISBN:9781234567890')).toBe('9781234567890')
      expect(normalizer.normalizeISBN('isbn9781234567890')).toBe('9781234567890')
    })

    test('normalizeISBN() 應該處理空值', () => {
      expect(normalizer.normalizeISBN(null)).toBe('')
      expect(normalizer.normalizeISBN(undefined)).toBe('')
      expect(normalizer.normalizeISBN('')).toBe('')
    })
  })

  describe('🖼️ 封面正規化', () => {
    test('normalizeCover() 應該處理完整封面資訊', () => {
      // eslint-disable-next-line no-unused-vars
      const cover = 'https://example.com/cover.jpg'
      // eslint-disable-next-line no-unused-vars
      const result = normalizer.normalizeCover(cover)

      expect(result.thumbnail).toBe(cover)
      expect(result.small).toBe(cover)
      expect(result.medium).toBe(cover)
      expect(result.large).toBe(cover)
      expect(result.original).toBe(cover)
    })

    test('normalizeCover() 應該處理空封面', () => {
      // eslint-disable-next-line no-unused-vars
      const result = normalizer.normalizeCover(null)

      expect(result.thumbnail).toBe('')
      expect(result.small).toBe('')
      expect(result.medium).toBe('')
      expect(result.large).toBe('')
      expect(result.original).toBe('')
    })

    test('normalizeCover() 應該處理物件格式封面', () => {
      // eslint-disable-next-line no-unused-vars
      const cover = {
        thumbnail: 'https://example.com/thumb.jpg',
        large: 'https://example.com/large.jpg'
      }
      // eslint-disable-next-line no-unused-vars
      const result = normalizer.normalizeCover(cover)

      expect(result.thumbnail).toBe('https://example.com/thumb.jpg')
      expect(result.large).toBe('https://example.com/large.jpg')
    })
  })

  describe('📊 進度正規化', () => {
    test('normalizeProgress() 應該處理數字進度', () => {
      // eslint-disable-next-line no-unused-vars
      const result = normalizer.normalizeProgress(75)

      expect(result.percentage).toBe(75)
      expect(result.pages).toBeNull()
      expect(result.locations).toBeNull()
    })

    test('normalizeProgress() 應該處理 Kindle 進度格式', () => {
      // eslint-disable-next-line no-unused-vars
      const progress = {
        percentage: 60,
        location: 1250,
        totalLocations: 2000
      }
      // eslint-disable-next-line no-unused-vars
      const result = normalizer.normalizeProgress(progress)

      expect(result.percentage).toBe(60)
      expect(result.locations.current).toBe(1250)
      expect(result.locations.total).toBe(2000)
    })

    test('normalizeProgress() 應該處理 Kobo 進度格式', () => {
      // eslint-disable-next-line no-unused-vars
      const progress = {
        reading_percentage: 45,
        current_page: 120,
        total_pages: 300
      }
      // eslint-disable-next-line no-unused-vars
      const result = normalizer.normalizeProgress(progress)

      expect(result.percentage).toBe(45)
      expect(result.pages.current).toBe(120)
      expect(result.pages.total).toBe(300)
    })

    test('normalizeProgress() 應該限制進度範圍', () => {
      expect(normalizer.normalizeProgress(-10).percentage).toBe(0)
      expect(normalizer.normalizeProgress(150).percentage).toBe(100)
    })
  })

  describe('📖 閱讀狀態正規化', () => {
    test('normalizeReadingStatus() 應該處理布林值', () => {
      expect(normalizer.normalizeReadingStatus(true)).toBe('FINISHED')
      expect(normalizer.normalizeReadingStatus(false)).toBe('READING')
    })

    test('normalizeReadingStatus() 應該處理字串狀態', () => {
      expect(normalizer.normalizeReadingStatus('COMPLETED')).toBe('FINISHED')
      expect(normalizer.normalizeReadingStatus('done')).toBe('FINISHED')
      expect(normalizer.normalizeReadingStatus('IN_PROGRESS')).toBe('READING')
      expect(normalizer.normalizeReadingStatus('started')).toBe('READING')
      expect(normalizer.normalizeReadingStatus('TO_READ')).toBe('NOT_STARTED')
      expect(normalizer.normalizeReadingStatus('planned')).toBe('NOT_STARTED')
    })

    test('normalizeReadingStatus() 應該處理未知狀態', () => {
      expect(normalizer.normalizeReadingStatus('UNKNOWN')).toBe('READING')
      expect(normalizer.normalizeReadingStatus(null)).toBe('READING')
    })
  })

  describe('🔑 資料指紋與跨平台ID', () => {
    test('generateDataFingerprint() 應該生成一致的指紋', async () => {
      // eslint-disable-next-line no-unused-vars
      const book1 = {
        title: '測試書籍',
        authors: ['作者1'],
        isbn: '9781234567890'
      }

      // eslint-disable-next-line no-unused-vars
      const book2 = {
        title: '測試書籍',
        authors: ['作者1'],
        isbn: '978-1-234-56789-0' // 不同格式但相同 ISBN
      }

      // eslint-disable-next-line no-unused-vars
      const fingerprint1 = await normalizer.generateDataFingerprint(book1)
      // eslint-disable-next-line no-unused-vars
      const fingerprint2 = await normalizer.generateDataFingerprint(book2)

      expect(fingerprint1).toBe(fingerprint2)
      expect(typeof fingerprint1).toBe('string')
      expect(fingerprint1.length).toBeGreaterThan(0)
    })

    test('generateCrossPlatformId() 應該生成唯一ID', async () => {
      // eslint-disable-next-line no-unused-vars
      const book = {
        title: '測試書籍',
        authors: ['作者1'],
        isbn: '9781234567890'
      }

      // eslint-disable-next-line no-unused-vars
      const id = await normalizer.generateCrossPlatformId(book)

      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
      expect(id).toMatch(/^[a-f0-9]+$/) // 應該是十六進制
    })
  })

  describe('📊 批次正規化', () => {
    test('normalizeBookBatch() 應該處理多本書籍', async () => {
      // eslint-disable-next-line no-unused-vars
      const books = [
        { id: 'book1', title: '書籍1', authors: ['作者1'] },
        { id: 'book2', title: '書籍2', authors: ['作者2'] },
        { id: 'book3', title: '書籍3', authors: ['作者3'] }
      ]

      // eslint-disable-next-line no-unused-vars
      const result = await normalizer.normalizeBookBatch(books, 'READMOO')

      expect(result.normalizedBooks).toHaveLength(3)
      expect(result.errors).toHaveLength(0)
      expect(result.normalizedBooks[0].id).toBe('book1')
      expect(result.normalizedBooks[1].id).toBe('book2')
      expect(result.normalizedBooks[2].id).toBe('book3')
    })

    test('normalizeBookBatch() 應該處理錯誤書籍', async () => {
      // eslint-disable-next-line no-unused-vars
      const books = [
        { id: 'book1', title: '正常書籍' },
        null, // 錯誤書籍
        { id: 'book3', title: '另一本正常書籍' }
      ]

      // eslint-disable-next-line no-unused-vars
      const result = await normalizer.normalizeBookBatch(books, 'READMOO')

      expect(result.normalizedBooks).toHaveLength(2)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].index).toBe(1)
      expect(result.errors[0].error).toContain('書籍資料為空')
    })

    test('normalizeBookBatch() 應該處理空陣列', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await normalizer.normalizeBookBatch([], 'READMOO')

      expect(result.normalizedBooks).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('📊 統計與監控', () => {
    test('getNormalizationStatistics() 應該提供正規化統計', async () => {
      // eslint-disable-next-line no-unused-vars
      const books = [
        { id: 'book1', title: '書籍1' },
        { id: 'book2', title: '書籍2' }
      ]

      await normalizer.normalizeBookBatch(books, 'READMOO')
      // eslint-disable-next-line no-unused-vars
      const stats = normalizer.getNormalizationStatistics()

      expect(stats.totalNormalized).toBe(2)
      expect(stats.platformBreakdown.READMOO).toBe(2)
      expect(stats.lastNormalizationTime).toBeDefined()
    })

    test('resetStatistics() 應該重置統計數據', () => {
      normalizer.normalizationStatistics.totalNormalized = 10
      normalizer.resetStatistics()

      expect(normalizer.normalizationStatistics.totalNormalized).toBe(0)
      expect(normalizer.normalizationStatistics.errorCount).toBe(0)
    })

    test('isNormalizationServiceHealthy() 應該檢查服務健康狀態', () => {
      // eslint-disable-next-line no-unused-vars
      const health = normalizer.isNormalizationServiceHealthy()

      expect(health.isHealthy).toBeDefined()
      expect(health.normalizationStatistics).toBeDefined()
      expect(health.lastCheck).toBeDefined()
    })
  })

  describe('⚠️ 錯誤處理', () => {
    test('constructor 應該要求 eventBus 參數', () => {
      expect(() => {
        // eslint-disable-next-line no-new
        new DataNormalizationService()
      }).toThrow(expect.objectContaining({
        message: expect.stringContaining('EventBus is required')
      }))
    })

    test('應該處理正規化過程中的錯誤', async () => {
      // 模擬錯誤情況
      // eslint-disable-next-line no-unused-vars
      const invalidBook = { toString: () => { throw (() => { const error = new Error('轉換錯誤'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })() } }

      // eslint-disable-next-line no-unused-vars
      const result = await normalizer.normalizeBook(invalidBook, 'READMOO')

      expect(result).toBeDefined()
      // 應該有基本的錯誤處理和預設值
    })

    test('應該處理不支援的平台', async () => {
      // eslint-disable-next-line no-unused-vars
      const book = { id: 'test', title: '測試書籍' }
      // eslint-disable-next-line no-unused-vars
      const result = await normalizer.normalizeBook(book, 'UNSUPPORTED_PLATFORM')

      expect(result.platform).toBe('UNSUPPORTED_PLATFORM')
      expect(result.id).toBe('test')
    })
  })
})
