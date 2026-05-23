/**
 * BookFileImporter v2 結構提取與 ImportResult 介面測試（0.19.0-W1-047.2 / IMP-B）
 *
 * 測試範圍（TDD Phase 2 設計，11 個 TC，5 組 A~E）：
 * - Group A：v2 路徑 tag 區段提取（AC-1、場景 1-3）
 * - Group B：v1 路徑 tag 結構回傳（AC-2、場景 4-5）
 * - Group C：CSV 與空物件路徑（AC-2、場景 6-7）
 * - Group D：錯誤契約零回歸（AC-2、場景 8）
 * - Group E：ImportResult 型別恆定（AC-2、場景 1-7 橫切）
 *
 * 測試策略：
 * - Sociable Unit Test：不 mock format-version-detector / v1-to-v2-converter（內層真實依賴）
 * - 入口點：直接呼叫 _extractBooksFromData / _processBookData / _handleFileContent
 *   （避免 jsdom FileReader 非同步差異）
 * - 三欄位（books/tagCategories/tags）一律以 Array.isArray() 驗型別恆為陣列；
 *   內容用 toEqual；無計時斷言；無 toBeCloseTo
 *
 * @jest-environment jsdom
 */

const { BookFileImporter } = require('../../../src/overview/book-file-importer')
const { detectFormatVersion } = require('../../../src/export/format-version-detector')
const { convertV1ToV2Data } = require('../../../src/export/v1-to-v2-converter')
const { ErrorCodes } = require('../../../src/core/errors/ErrorCodes')

describe('BookFileImporter v2 結構提取與 ImportResult 介面（0.19.0-W1-047.2）', () => {
  function makeImporter () {
    return new BookFileImporter({
      document,
      showError: () => {}
    })
  }

  // 抑制 console.warn（_extractTagSection 型別降級告警），避免污染測試輸出
  let consoleWarnSpy
  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  describe('Group A：v2 路徑 tag 區段提取（AC-1、場景 1-3）', () => {
    test('TC-01 v2 含非空 tag 區段完整提取', () => {
      const importer = makeImporter()
      const data = {
        metadata: { formatVersion: '2.0.0' },
        tagCategories: [
          { id: 'cat_a', name: '自訂', categoryId: null }
        ],
        tags: [
          { id: 'tag_a', name: '科幻', categoryId: 'cat_a' },
          { id: 'tag_b', name: '文學', categoryId: 'cat_a' }
        ],
        books: [
          { id: 'b1', title: '書一', readingStatus: 'reading', cover: 'http://x/c.jpg' }
        ]
      }
      // 前置驗證：三區段皆為非空陣列
      expect(Array.isArray(data.tagCategories) && data.tagCategories.length > 0).toBe(true)
      expect(Array.isArray(data.tags) && data.tags.length > 0).toBe(true)
      expect(Array.isArray(data.books) && data.books.length > 0).toBe(true)

      const result = importer._extractBooksFromData(data, 'json')

      expect(result).toHaveProperty('books')
      expect(result).toHaveProperty('tagCategories')
      expect(result).toHaveProperty('tags')
      expect(result.tagCategories).toEqual(data.tagCategories)
      expect(result.tags).toEqual(data.tags)
      expect(result.books).toEqual(data.books)
    })

    test('TC-02 v2 缺 tag 欄位降級為空陣列', () => {
      const importer = makeImporter()
      const data = {
        metadata: { source: 'x' },
        books: [
          { id: 'b1', title: '書一', readingStatus: 'reading', cover: 'http://x/c.jpg' }
        ]
      }
      // 前置驗證：v2 推斷（metadata + readingStatus）且無 tag 欄位
      expect(detectFormatVersion(data)).toBe('v2')
      expect(data.tagCategories).toBeUndefined()
      expect(data.tags).toBeUndefined()

      const result = importer._extractBooksFromData(data, 'json')

      expect(Array.isArray(result.tagCategories)).toBe(true)
      expect(result.tagCategories).toEqual([])
      expect(Array.isArray(result.tags)).toBe(true)
      expect(result.tags).toEqual([])
      expect(result.books).toEqual(data.books)
    })

    test('TC-03 v2 tag 區段非陣列降級（回歸防護重點）', () => {
      const importer = makeImporter()
      const data = {
        metadata: { formatVersion: '2.0.0' },
        tagCategories: {},
        tags: 'invalid',
        books: [
          { id: 'b1', title: '書一', readingStatus: 'reading', cover: 'http://x/c.jpg' }
        ]
      }
      // 前置驗證：tagCategories / tags 確為非陣列
      expect(Array.isArray(data.tagCategories)).toBe(false)
      expect(Array.isArray(data.tags)).toBe(false)

      expect(() => importer._extractBooksFromData(data, 'json')).not.toThrow()
      const result = importer._extractBooksFromData(data, 'json')

      expect(result.tagCategories).toEqual([])
      expect(result.tags).toEqual([])
      expect(result.books).toEqual(data.books)
    })
  })

  describe('Group B：v1 路徑 tag 結構回傳（AC-2、場景 4-5）', () => {
    test('TC-04 v1 含 category 回傳轉換 tag 結構', () => {
      const importer = makeImporter()
      const data = [
        { id: 'b1', title: '書一', author: '作者甲', category: 'V1匯入分類', progress: 100 },
        { id: 'b2', title: '書二', author: '作者乙', category: 'V1匯入分類', progress: 30 }
      ]
      // 前置驗證：偵測為 v1
      expect(detectFormatVersion(data)).toBe('v1')

      const result = importer._extractBooksFromData(data, 'json')
      const converted = convertV1ToV2Data(data)

      expect(Array.isArray(result.books)).toBe(true)
      expect(result.books).toHaveLength(2)
      expect(Array.isArray(result.tagCategories)).toBe(true)
      expect(result.tagCategories.length).toBeGreaterThan(0)
      expect(Array.isArray(result.tags)).toBe(true)
      expect(result.tags.length).toBeGreaterThan(0)
      expect(result.tagCategories).toEqual(converted.tagCategories)
      expect(result.tags).toEqual(converted.tags)
    })

    test('TC-05 v1 無 category 回傳空 tag 結構', () => {
      const importer = makeImporter()
      const data = [
        { id: 'b1', title: '書一', author: '作者甲', progress: 50 },
        { id: 'b2', title: '書二', category: '', progress: 0 },
        { id: 'b3', title: '書三', category: '未分類', progress: 0 }
      ]
      // 前置驗證：偵測為 v1
      expect(detectFormatVersion(data)).toBe('v1')

      const result = importer._extractBooksFromData(data, 'json')

      expect(Array.isArray(result.books)).toBe(true)
      expect(result.books.length).toBeGreaterThan(0)
      expect(result.tagCategories).toEqual([])
      expect(result.tags).toEqual([])
    })
  })

  describe('Group C：CSV 與空物件路徑（AC-2、場景 6-7）', () => {
    test('TC-06 CSV 匯入 tag 區段為空', () => {
      const importer = makeImporter()
      const csvText = [
        '書名,書城來源,進度,狀態,封面URL,id,authors,tagIds',
        '"書本A","readmoo","42","reading","https://example.com/c.jpg","book-001","作者甲","tag-001"'
      ].join('\n')

      // W1-048.1 Stage C.2：遷移自 _handleFileContent 至 public parseContent
      const result = importer.parseContent(csvText, 'csv')

      expect(result).toHaveProperty('books')
      expect(Array.isArray(result.books)).toBe(true)
      expect(result.books.length).toBeGreaterThan(0)
      expect(result.tagCategories).toEqual([])
      expect(result.tags).toEqual([])
    })

    test('TC-07 空物件 JSON 三區段皆空', () => {
      const importer = makeImporter()
      const data = {}
      // 前置驗證：data 為空物件
      expect(Object.keys(data)).toHaveLength(0)

      expect(() => importer._extractBooksFromData(data, 'json')).not.toThrow()
      const result = importer._extractBooksFromData(data, 'json')

      expect(result).toEqual({ books: [], tagCategories: [], tags: [] })
    })
  })

  describe('Group D：錯誤契約零回歸（AC-2、場景 8）', () => {
    test('TC-08 無法辨識結構維持 VALIDATION_ERROR（回歸防護重點）', () => {
      const importer = makeImporter()
      const data = { foo: 'bar', count: 3 }
      // 前置驗證：非陣列、無 books / data 鍵、非空物件
      expect(Array.isArray(data)).toBe(false)
      expect(data.books).toBeUndefined()
      expect(data.data).toBeUndefined()
      expect(Object.keys(data).length).toBeGreaterThan(0)

      expect(() => importer._extractBooksFromData(data, 'json')).toThrow(
        expect.objectContaining({
          message: 'JSON 檔案應該包含一個陣列或包含books屬性的物件',
          code: ErrorCodes.VALIDATION_ERROR,
          details: { category: 'validation' }
        })
      )
    })

    test('TC-09 JSON 解析失敗維持 PARSE_ERROR', () => {
      const importer = makeImporter()
      const invalidJson = '{ "books": [ '

      // W1-048.1 Stage C.2：遷移自 _handleFileContent 至 public parseContent
      expect(() => importer.parseContent(invalidJson, 'json')).toThrow(
        expect.objectContaining({
          code: ErrorCodes.PARSE_ERROR
        })
      )
    })
  })

  describe('Group E：ImportResult 型別恆定（AC-2、場景 1-7 橫切）', () => {
    test('TC-10 全路徑型別降級驗證', () => {
      const importer = makeImporter()

      const csvText = [
        '書名,書城來源,進度,狀態,封面URL,id,authors,tagIds',
        '"書本A","readmoo","42","reading","https://example.com/c.jpg","book-001","",""'
      ].join('\n')

      // 六組輸入：v1 / v2-含 tag / v2-缺 tag / v2-非陣列 / CSV / 空物件
      const cases = [
        {
          name: 'v1 純陣列',
          run: () => importer._extractBooksFromData(
            [{ id: 'b1', title: 'A', category: 'C1' }], 'json')
        },
        {
          name: 'v2 含 tag',
          run: () => importer._extractBooksFromData({
            metadata: { formatVersion: '2.0.0' },
            tagCategories: [{ id: 'c1', name: 'X' }],
            tags: [{ id: 't1', name: 'Y' }],
            books: [{ id: 'b1', title: 'A', readingStatus: 'reading', cover: 'http://x/c.jpg' }]
          }, 'json')
        },
        {
          name: 'v2 缺 tag',
          run: () => importer._extractBooksFromData({
            metadata: { formatVersion: '2.0.0' },
            books: [{ id: 'b1', title: 'A', readingStatus: 'reading', cover: 'http://x/c.jpg' }]
          }, 'json')
        },
        {
          name: 'v2 非陣列 tag',
          run: () => importer._extractBooksFromData({
            metadata: { formatVersion: '2.0.0' },
            tagCategories: 'bad',
            tags: 123,
            books: [{ id: 'b1', title: 'A', readingStatus: 'reading', cover: 'http://x/c.jpg' }]
          }, 'json')
        },
        {
          name: 'CSV',
          run: () => importer.parseContent(csvText, 'csv')
        },
        {
          name: '空物件',
          run: () => importer._extractBooksFromData({}, 'json')
        }
      ]

      cases.forEach(({ name, run }) => {
        const result = run()
        expect(Array.isArray(result.books)).toBe(true)
        expect(Array.isArray(result.tagCategories)).toBe(true)
        expect(Array.isArray(result.tags)).toBe(true)
        expect(result.books).not.toBeUndefined()
        expect(result.books).not.toBeNull()
        expect(result.tagCategories).not.toBeUndefined()
        expect(result.tagCategories).not.toBeNull()
        expect(result.tags).not.toBeUndefined()
        expect(result.tags).not.toBeNull()
      })
    })

    test('TC-11 _processBookData 回傳 ImportResult', () => {
      const importer = makeImporter()
      const data = {
        metadata: { formatVersion: '2.0.0' },
        tagCategories: [{ id: 'c1', name: 'X' }],
        tags: [{ id: 't1', name: 'Y', categoryId: 'c1' }],
        books: [
          { id: 'b1', title: '有效書', readingStatus: 'reading', cover: 'http://x/c.jpg' },
          { title: '缺 id 無效書', readingStatus: 'reading', cover: 'http://x/c.jpg' }
        ]
      }

      const result = importer._processBookData(data, 'json')

      expect(result).toHaveProperty('books')
      expect(result).toHaveProperty('tagCategories')
      expect(result).toHaveProperty('tags')
      // books 經 _filterValidBooks 過濾：缺 id 的書被濾除
      expect(result.books).toHaveLength(1)
      expect(result.books[0].id).toBe('b1')
      // tagCategories / tags 透傳，未經過濾
      expect(result.tagCategories).toEqual(data.tagCategories)
      expect(result.tags).toEqual(data.tags)
    })

    // -------------------------------------------------------------------------
    // W1-048.4.1：cover 選填欄位驗證一致性
    //
    // ANA 結論（W1-048.4）：cover 為 SPEC-EXPORT-V2 §3.5 / data-management.md 選填欄位。
    // _validateRequiredFields 已不要求 cover（W1-047.1）；本測試確保 _validateFieldTypes
    // 同步容許 cover 為 undefined，避免 selectively-loose validation 反模式（宣稱寬鬆
    // 但實作嚴格，導致缺 cover 的合法 v2 JSON 書籍被靜默過濾）。
    // -------------------------------------------------------------------------
    test('TC-12 _processBookData 容許 cover undefined（W1-048.4.1）', () => {
      const importer = makeImporter()
      const data = {
        metadata: { formatVersion: '2.0.0' },
        tagCategories: [],
        tags: [],
        books: [
          // 完全缺 cover 欄位（v2 JSON 合法情境）
          { id: 'b1', title: '缺 cover 但完整書', readingStatus: 'reading' },
          // cover 為空字串（v1 轉換產出的典型情境，回歸防護）
          { id: 'b2', title: '空字串 cover 書', readingStatus: 'reading', cover: '' },
          // cover 為合法 URL（base 情境，回歸防護）
          { id: 'b3', title: '正常 cover 書', readingStatus: 'reading', cover: 'http://x/c.jpg' }
        ]
      }

      const result = importer._processBookData(data, 'json')

      // 三筆書皆通過 _isValidBook 過濾，不再因 cover 型別被丟棄
      expect(result.books).toHaveLength(3)
      expect(result.books.map(b => b.id)).toEqual(['b1', 'b2', 'b3'])
    })

    test('TC-13 _processBookData 仍過濾 cover 為非 string 非 undefined 的書（W1-048.4.1）', () => {
      const importer = makeImporter()
      const data = {
        metadata: { formatVersion: '2.0.0' },
        tagCategories: [],
        tags: [],
        books: [
          // 合法：cover 為 undefined
          { id: 'b1', title: '缺 cover 書', readingStatus: 'reading' },
          // 非法：cover 為 number（防護回歸：不應因放寬 undefined 而誤放行其他型別）
          { id: 'b2', title: 'cover 型別錯誤', readingStatus: 'reading', cover: 123 },
          // 非法：cover 為 null（null 不等於 undefined，typeof null === 'object'）
          { id: 'b3', title: 'cover null', readingStatus: 'reading', cover: null }
        ]
      }

      const result = importer._processBookData(data, 'json')

      // 僅 b1 通過：b2 / b3 因 cover 型別違規被 _validateFieldTypes 過濾
      expect(result.books).toHaveLength(1)
      expect(result.books[0].id).toBe('b1')
    })
  })

  // ---------------------------------------------------------------------------
  // Group F：fileFormat 必填契約（0.19.0-W1-048.1 Stage C.6，Phase 2 §3.2）
  //
  // F16 修復核心：parseContent 強制要求 fileFormat 參數，禁止 fallback 至 json。
  // 修復前 csv 檔案的 fileFormat 訊號可能遺失，導致 CSV 內容被誤判走 JSON 解析。
  // ---------------------------------------------------------------------------
  describe('Group F：fileFormat 必填契約（W1-048.1 Stage C.6）', () => {
    test('parseContent 未傳 fileFormat 時 throw TypeError（禁止 fallback 至 json）', () => {
      const importer = makeImporter()
      const csv = '書名,id\n"書","b1"'
      expect(() => importer.parseContent(csv)).toThrow(TypeError)
    })

    test('parseContent(csvContent, "csv") 正確解析 CSV', () => {
      const importer = makeImporter()
      const csvText = [
        '書名,書城來源,進度,狀態,封面URL,id,authors,tagIds',
        '"書本A","readmoo","42","reading","https://example.com/c.jpg","b1","",""',
        '"書本B","readmoo","10","unread","https://example.com/c2.jpg","b2","",""'
      ].join('\n')
      const result = importer.parseContent(csvText, 'csv')
      expect(result.books).toHaveLength(2)
      expect(result.books[0].id).toBe('b1')
      expect(result.books[1].id).toBe('b2')
    })

    test('parseContent(csvContent, "json") 應失敗 PARSE_ERROR（regression：CSV 路徑訊號遺失誤判 json）', () => {
      const importer = makeImporter()
      const csvText = [
        '書名,書城來源,進度,狀態,封面URL,id,authors,tagIds',
        '"書本A","readmoo","42","reading","https://example.com/c.jpg","b1","",""'
      ].join('\n')
      // CSV 內容當 JSON 解析必失敗
      expect(() => importer.parseContent(csvText, 'json')).toThrow(
        expect.objectContaining({
          code: ErrorCodes.PARSE_ERROR
        })
      )
    })
  })
})
