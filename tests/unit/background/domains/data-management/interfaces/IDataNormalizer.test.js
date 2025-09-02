/**
 * IDataNormalizer 介面測試
 *
 * 測試目標：
 * - 驗證資料標準化介面契約
 * - 測試書籍標準化、跨平台ID生成和指紋計算
 * - 確保各欄位標準化的一致性
 * - 驗證標準化結果格式和品質
 *
 * @jest-environment jsdom
 */

// Mock 類別定義（TDD Phase 1 - 測試先行）
class DataNormalizationService {
  constructor (config = {}) {
    this.config = {
      enableFingerprinting: config.enableFingerprinting || false,
      crossPlatformIdGeneration: config.crossPlatformIdGeneration || false,
      strictNormalization: config.strictNormalization || false,
      ...config
    }
  }

  normalizeBook (book) {
    return { ...book, normalized: true }
  }

  generateCrossPlatformId (book) {
    return 'cross-platform-' + book.title
  }

  generateDataFingerprint (data) {
    return 'fingerprint-' + JSON.stringify(data).length
  }

  normalizeTitle (title) {
    return title.trim()
  }

  normalizeAuthor (author) {
    return author.trim()
  }

  normalizeAuthors (authors) {
    if (Array.isArray(authors)) {
      return authors.map(author => author.trim())
    }
    return [authors.trim()]
  }

  normalizeCover (cover) {
    if (typeof cover === 'string') {
      return { url: cover, alt: '' }
    }
    return cover
  }

  normalizePublishDate (date) {
    return new Date(date).toISOString().split('T')[0]
  }

  validateNormalizedData (data) {
    return { valid: true, issues: [] }
  }

  get isInitialized () {
    return true
  }
}

describe('IDataNormalizer TDD 介面契約測試', () => {
  let dataNormalizer

  beforeEach(() => {
    dataNormalizer = new DataNormalizationService({
      enableFingerprinting: true,
      crossPlatformIdGeneration: true,
      strictNormalization: false
    })
  })

  describe('🔴 Red 階段：介面契約驗證', () => {
    test('應該正確實作 IDataNormalizer 介面', () => {
      // Given: DataNormalizationService 實例

      // Then: 應該實作所有必要的介面方法
      expect(typeof dataNormalizer.normalizeBook).toBe('function')
      expect(typeof dataNormalizer.generateCrossPlatformId).toBe('function')
      expect(typeof dataNormalizer.generateDataFingerprint).toBe('function')
      expect(typeof dataNormalizer.normalizeTitle).toBe('function')
      expect(typeof dataNormalizer.normalizeAuthors).toBe('function')
      expect(typeof dataNormalizer.normalizeCover).toBe('function')
      expect(dataNormalizer.isInitialized).toBeDefined()
    })

    test('normalizeBook() 應該返回標準化的書籍資料', async () => {
      // Given: 原始書籍資料
      const rawBook = {
        id: ' book_123 ',
        title: '  測試書籍：副標題  ',
        authors: ['作者A', '  作者B  ', '作者C'],
        progress: '75.5',
        lastUpdated: '2025-08-19T10:30:00.000Z',
        cover: 'http://example.com/cover.jpg?param=value',
        platform: 'READMOO'
      }
      const platform = 'READMOO'

      // When: 標準化書籍
      const normalized = await dataNormalizer.normalizeBook(rawBook, platform)

      // Then: 應該返回標準化結果
      expect(normalized).toHaveProperty('originalData')
      expect(normalized).toHaveProperty('normalizedData')
      expect(normalized).toHaveProperty('crossPlatformId')
      expect(normalized).toHaveProperty('dataFingerprint')
      expect(normalized).toHaveProperty('normalizationReport')
      expect(normalized).toHaveProperty('processingTime')

      // 驗證標準化資料結構
      expect(normalized.normalizedData.id).toBe('book_123') // 去除空白
      expect(normalized.normalizedData.title).toBe('測試書籍：副標題') // 清理標題
      expect(normalized.normalizedData.authors).toEqual(['作者A', '作者B', '作者C']) // 清理作者
      expect(normalized.normalizedData.progress).toBe(75.5) // 轉換為數字
      expect(typeof normalized.crossPlatformId).toBe('string')
      expect(typeof normalized.dataFingerprint).toBe('string')
    })

    test('generateCrossPlatformId() 應該生成統一的跨平台ID', async () => {
      // Given: 不同平台的相同書籍
      const readmooBook = {
        title: '測試書籍',
        authors: ['作者A', '作者B'],
        isbn: '9781234567890'
      }
      const kindleBook = {
        title: 'Test Book', // 不同語言
        authors: ['Author A', 'Author B'], // 不同語言
        isbn: '9781234567890' // 相同ISBN
      }

      // When: 生成跨平台ID
      const readmooId = await dataNormalizer.generateCrossPlatformId(readmooBook)
      const kindleId = await dataNormalizer.generateCrossPlatformId(kindleBook)

      // Then: 相同書籍應該有相同的跨平台ID
      expect(typeof readmooId).toBe('string')
      expect(typeof kindleId).toBe('string')
      expect(readmooId.length).toBeGreaterThan(8) // 合理的ID長度
      expect(kindleId.length).toBeGreaterThan(8)

      // 如果是相同書籍（基於ISBN），ID應該相同
      if (readmooBook.isbn === kindleBook.isbn) {
        expect(readmooId).toBe(kindleId)
      }
    })

    test('generateDataFingerprint() 應該生成資料指紋', async () => {
      // Given: 書籍資料
      const book = {
        id: 'book_123',
        title: '測試書籍',
        authors: ['作者A'],
        progress: 75,
        lastUpdated: '2025-08-19T10:30:00.000Z'
      }

      // When: 生成資料指紋
      const fingerprint = await dataNormalizer.generateDataFingerprint(book)

      // Then: 應該返回一致的指紋
      expect(typeof fingerprint).toBe('string')
      expect(fingerprint.length).toBeGreaterThan(16) // SHA256 或類似算法

      // 相同資料應該生成相同指紋
      const fingerprint2 = await dataNormalizer.generateDataFingerprint(book)
      expect(fingerprint).toBe(fingerprint2)

      // 不同資料應該生成不同指紋
      const modifiedBook = { ...book, progress: 80 }
      const differentFingerprint = await dataNormalizer.generateDataFingerprint(modifiedBook)
      expect(fingerprint).not.toBe(differentFingerprint)
    })

    test('normalizeTitle() 應該標準化書籍標題', () => {
      // Given: 各種需要標準化的標題
      const rawTitles = [
        '  測試書籍：副標題  ',
        'UPPERCASE TITLE',
        'title with    multiple    spaces',
        '標題【特殊符號】（註解）',
        ''
      ]

      // When: 標準化標題
      const normalizedTitles = rawTitles.map(title =>
        dataNormalizer.normalizeTitle(title)
      )

      // Then: 應該返回清理後的標題
      expect(normalizedTitles[0]).toBe('測試書籍：副標題') // 去除前後空白
      expect(normalizedTitles[1]).toBe('UPPERCASE TITLE') // 保持大小寫或標準化
      expect(normalizedTitles[2]).toBe('title with multiple spaces') // 標準化空白
      expect(normalizedTitles[3]).toBe('標題【特殊符號】（註解）') // 處理特殊符號
      expect(normalizedTitles[4]).toBe('') // 處理空字串
    })

    test('normalizeAuthors() 應該標準化作者資訊', () => {
      // Given: 各種作者格式
      const authorInputs = [
        ['作者A', '  作者B  ', '作者C'],
        ['Author, First', 'Author, Second'],
        'single_author_string',
        [''],
        []
      ]

      // When: 標準化作者
      const normalizedAuthors = authorInputs.map(authors =>
        dataNormalizer.normalizeAuthors(authors)
      )

      // Then: 應該返回標準化的作者陣列
      expect(normalizedAuthors[0]).toEqual(['作者A', '作者B', '作者C'])
      expect(normalizedAuthors[1]).toEqual(['Author, First', 'Author, Second'])
      expect(normalizedAuthors[2]).toEqual(['single_author_string']) // 轉換為陣列
      expect(normalizedAuthors[3]).toEqual([]) // 移除空作者
      expect(normalizedAuthors[4]).toEqual([]) // 處理空陣列
    })

    test('normalizeCover() 應該標準化封面URL', () => {
      // Given: 各種封面URL格式
      const coverUrls = [
        'http://example.com/cover.jpg?param=value',
        'https://cdn.example.com/covers/book123.png',
        'relative/path/cover.jpg',
        '',
        null,
        undefined
      ]

      // When: 標準化封面
      const normalizedCovers = coverUrls.map(cover =>
        dataNormalizer.normalizeCover(cover)
      )

      // Then: 應該返回標準化的URL或處理無效值
      expect(normalizedCovers[0]).toMatch(/^https?:\/\//) // 標準化為完整URL
      expect(normalizedCovers[1]).toMatch(/^https?:\/\//)
      expect(normalizedCovers[2]).toBe('') // 處理相對路徑
      expect(normalizedCovers[3]).toBe('') // 處理空字串
      expect(normalizedCovers[4]).toBe('') // 處理null
      expect(normalizedCovers[5]).toBe('') // 處理undefined
    })

    test('應該處理無效輸入和錯誤情況', async () => {
      // Given: 無效輸入
      const nullBook = null
      const emptyBook = {}
      const invalidPlatform = ''

      // When & Then: 應該優雅處理錯誤
      await expect(
        dataNormalizer.normalizeBook(nullBook, 'READMOO')
      ).rejects.toThrow('Invalid book data')

      await expect(
        dataNormalizer.normalizeBook(emptyBook, invalidPlatform)
      ).rejects.toThrow('Platform is required')
    })

    test('應該支援配置選項', () => {
      // Given: 自訂配置
      const customConfig = {
        enableFingerprinting: false,
        crossPlatformIdGeneration: false,
        strictNormalization: true,
        preserveOriginalFormat: true
      }

      // When: 建立標準化服務
      const customNormalizer = new DataNormalizationService(customConfig)

      // Then: 應該使用自訂配置
      expect(customNormalizer.config.enableFingerprinting).toBe(false)
      expect(customNormalizer.config.crossPlatformIdGeneration).toBe(false)
      expect(customNormalizer.config.strictNormalization).toBe(true)
      expect(customNormalizer.config.preserveOriginalFormat).toBe(true)
    })

    test('標準化過程應該產生詳細報告', async () => {
      // Given: 需要大量標準化的書籍
      const messyBook = {
        id: '  book_123  ',
        title: '   MESSY    TITLE   WITH   SPACES   ',
        authors: ['  Author A  ', '', '  Author B  '],
        progress: '75.789',
        cover: 'http://old-domain.com/cover.jpg?cache=123',
        extraField: 'should_be_removed'
      }

      // When: 標準化書籍
      const result = await dataNormalizer.normalizeBook(messyBook, 'READMOO')

      // Then: 應該生成詳細的標準化報告
      expect(result.normalizationReport).toHaveProperty('fieldsProcessed')
      expect(result.normalizationReport).toHaveProperty('changesApplied')
      expect(result.normalizationReport).toHaveProperty('warningsGenerated')
      expect(result.normalizationReport).toHaveProperty('qualityScore')
      expect(Array.isArray(result.normalizationReport.changesApplied)).toBe(true)
      expect(result.normalizationReport.fieldsProcessed).toBeGreaterThan(0)
      expect(typeof result.normalizationReport.qualityScore).toBe('number')
    })
  })
})
