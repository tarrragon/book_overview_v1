/**
 * BookFileImporter 版本偵測與 v1 轉換接線測試（0.19.0-W1-047.1）
 *
 * 測試範圍（TDD Phase 2 設計，17 個 TC，5 組 A~E）：
 * - Group A：版本偵測分流（_extractBooksFromData 接入 detectFormatVersion 四向分流）
 * - Group B：v1 欄位轉換正確性（readingStatus / progress / authors）
 * - Group C：驗證放寬（_validateRequiredFields 移除 cover 強制）
 * - Group D：錯誤契約不回歸（空物件 / 無法辨識結構拋錯 / v2 / data.data 維持原行為）
 * - Group E：v1 轉換邊界（全部轉換失敗 / 個別書籍缺 id / category 空值）
 *
 * 測試策略：
 * - Sociable Unit Test：不 mock format-version-detector / v1-to-v2-converter（內層真實依賴）
 * - 入口點：直接呼叫 _extractBooksFromData / _validateRequiredFields / _filterValidBooks
 * - 無計時斷言；progress 為整數轉換，用 toBe 精確比較
 *
 * @jest-environment jsdom
 */

const { BookFileImporter } = require('../../../src/overview/book-file-importer')
const { detectFormatVersion } = require('../../../src/export/format-version-detector')
const { ErrorCodes } = require('../../../src/core/errors/ErrorCodes')

describe('BookFileImporter 版本偵測與 v1 轉換接線（0.19.0-W1-047.1）', () => {
  function makeImporter () {
    return new BookFileImporter({
      document,
      showError: () => {}
    })
  }

  describe('Group A：版本偵測分流（AC-1、場景 1-4）', () => {
    test('TC-01 v1 純陣列格式偵測並轉換', () => {
      const importer = makeImporter()
      const data = [
        {
          id: 'b1',
          title: '書一',
          isNew: false,
          isFinished: true,
          progress: 100,
          author: '作者甲',
          category: '科幻'
        }
      ]
      expect(Array.isArray(data)).toBe(true) // 前置驗證

      const result = importer._extractBooksFromData(data)

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      expect(result[0].readingStatus).toBe('finished')
      expect(result[0].authors).toEqual(['作者甲'])
      expect(result[0]).not.toHaveProperty('isNew')
      expect(result[0]).not.toHaveProperty('isFinished')
      expect(result[0].isManualStatus).toBe(false)
      expect(Array.isArray(result[0].tagIds)).toBe(true)
      expect(result[0].tagIds).toHaveLength(1)
      expect(result[0].source).toBe('readmoo')
    })

    test('TC-02 v1 books 包裝格式（無 formatVersion）偵測並轉換', () => {
      const importer = makeImporter()
      const data = { books: [{ id: 'b1', title: '書一', progress: 50 }] }
      // 前置驗證：無 metadata、books 為陣列
      expect(data.metadata).toBeUndefined()
      expect(Array.isArray(data.books)).toBe(true)
      expect(detectFormatVersion(data)).toBe('v1')

      const result = importer._extractBooksFromData(data)

      expect(result).toHaveLength(1)
      expect(result[0].readingStatus).toBe('reading')
      expect(Array.isArray(result[0].tagIds)).toBe(true)
      expect(result[0].isManualStatus).toBe(false)
      expect(Array.isArray(result[0].authors)).toBe(true)
    })

    test('TC-03 v2 格式（明確 formatVersion）維持原行為', () => {
      const importer = makeImporter()
      const data = {
        metadata: { formatVersion: '2.0.0' },
        books: [
          { id: 'b1', title: '書一', readingStatus: 'finished', cover: 'http://x/c.jpg' }
        ]
      }
      expect(data.metadata.formatVersion.startsWith('2.')).toBe(true) // 前置驗證

      const result = importer._extractBooksFromData(data)

      // 直接取 data.books，不經轉換（toBe 參考比較驗證未重建物件）
      expect(result).toBe(data.books)
      expect(result[0].readingStatus).toBe('finished')
    })

    test('TC-04 v2 格式（metadata + readingStatus 推斷）維持原行為', () => {
      const importer = makeImporter()
      const data = {
        metadata: { source: 'x' },
        books: [
          { id: 'b1', title: '書一', readingStatus: 'reading', cover: 'http://x/c.jpg' }
        ]
      }
      // 無 formatVersion，靠 detectFormatVersion Rule 2 推斷
      expect(detectFormatVersion(data)).toBe('v2')

      const result = importer._extractBooksFromData(data)

      expect(result).toBe(data.books)
      expect(result[0].readingStatus).toBe('reading')
    })

    test('TC-05 data.data 包裝（metadata wrap）維持 fallback——關鍵回歸防護', () => {
      const importer = makeImporter()
      const data = { data: [{ id: 'b1', title: '書一', cover: 'http://x/c.jpg' }] }
      // 前置驗證：detectFormatVersion 規則 1-4 皆不命中，回 null
      expect(detectFormatVersion(data)).toBeNull()
      expect(Array.isArray(data.data)).toBe(true)

      expect(() => importer._extractBooksFromData(data)).not.toThrow()
      const result = importer._extractBooksFromData(data)

      // 回傳值即 data.data（toBe 參考比較）；null 不可導致拋錯或誤判
      expect(result).toBe(data.data)
    })
  })

  describe('Group B：v1 欄位轉換正確性（AC-2、場景 1-2）', () => {
    test('TC-06 v1 readingStatus 轉換——四種狀態映射', () => {
      const importer = makeImporter()
      const data = [
        { id: 'b1', title: 'A', isFinished: true, progress: 0 },
        { id: 'b2', title: 'B', isFinished: false, progress: 100 },
        { id: 'b3', title: 'C', isFinished: false, progress: 30 },
        { id: 'b4', title: 'D', isFinished: false, progress: 0 }
      ]

      const result = importer._extractBooksFromData(data)

      expect(result.map(b => b.readingStatus)).toEqual([
        'finished',
        'finished',
        'reading',
        'unread'
      ])
    })

    test('TC-07 v1 progress 正規化', () => {
      const importer = makeImporter()
      const data = [
        { id: 'b1', title: 'A', progress: '75' },
        { id: 'b2', title: 'B', progress: -10 },
        { id: 'b3', title: 'C', progress: 150 },
        { id: 'b4', title: 'D', progress: null }
      ]

      const result = importer._extractBooksFromData(data)

      expect(result[0].progress).toBe(75)
      expect(result[1].progress).toBe(0)
      expect(result[2].progress).toBe(100)
      expect(result[3].progress).toBe(0)
    })

    test('TC-08 v1 author 字串轉 authors 陣列', () => {
      const importer = makeImporter()
      const data = [
        { id: 'b1', title: 'A', author: '作者甲' },
        { id: 'b2', title: 'B', author: '' },
        { id: 'b3', title: 'C' }
      ]

      const result = importer._extractBooksFromData(data)

      expect(result[0].authors).toEqual(['作者甲'])
      expect(result[1].authors).toEqual([])
      expect(result[2].authors).toEqual([])
    })
  })

  describe('Group C：驗證放寬（AC-3、場景 5）', () => {
    test('TC-09 _validateRequiredFields 移除 cover 強制', () => {
      const importer = makeImporter()
      const book = { id: 'b1', title: '書一' }

      expect(importer._validateRequiredFields(book)).toBe(true)
    })

    test('TC-10 _validateRequiredFields 仍要求 id', () => {
      const importer = makeImporter()
      const book = { title: '書一', cover: 'http://x/c.jpg' }

      expect(importer._validateRequiredFields(book)).toBeFalsy()
    })

    test('TC-11 _validateRequiredFields 仍要求 title', () => {
      const importer = makeImporter()
      const book = { id: 'b1', cover: 'http://x/c.jpg' }

      expect(importer._validateRequiredFields(book)).toBeFalsy()
    })

    test('TC-12 v1 缺 cover 書籍經完整流程不被過濾', () => {
      const importer = makeImporter()
      const data = [{ id: 'b1', title: '書一', progress: 50 }]

      const result = importer._extractBooksFromData(data)
      // 前置驗證：v1 轉換補空字串 cover，typeof 為 string
      expect(result[0].cover).toBe('')

      const validBooks = importer._filterValidBooks(result)
      expect(validBooks).toHaveLength(1)
    })
  })

  describe('Group D：錯誤契約不回歸（AC-4、場景 6-7）', () => {
    test('TC-13 空物件回傳空陣列', () => {
      const importer = makeImporter()
      const data = {}
      expect(Object.keys(data)).toHaveLength(0) // 前置驗證

      expect(importer._extractBooksFromData(data)).toEqual([])
      expect(() => importer._extractBooksFromData(data)).not.toThrow()
    })

    test('TC-14 無法辨識結構拋 VALIDATION_ERROR', () => {
      const importer = makeImporter()
      const data = { foo: 'bar', count: 3 }

      expect(() => importer._extractBooksFromData(data)).toThrow(
        expect.objectContaining({
          message: 'JSON 檔案應該包含一個陣列或包含books屬性的物件',
          code: ErrorCodes.VALIDATION_ERROR,
          details: { category: 'validation' }
        })
      )
    })
  })

  describe('Group E：v1 轉換邊界（語義推演 Q1、SPEC §7.3）', () => {
    test('TC-15 全部書籍轉換失敗回傳空陣列', () => {
      const importer = makeImporter()
      const data = [{ title: '缺id' }, { id: 'b2' }]

      const result = importer._extractBooksFromData(data)

      expect(result).toEqual([])
      expect(() => importer._extractBooksFromData(data)).not.toThrow()
    })

    test('TC-16 v1 個別書籍缺 id 被跳過、其餘保留', () => {
      const importer = makeImporter()
      const data = [{ title: '缺id' }, { id: 'b2', title: '有效書', progress: 0 }]

      const result = importer._extractBooksFromData(data)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('b2')
    })

    test('TC-17 v1 category 為空字串/「未分類」不建立 tag', () => {
      const importer = makeImporter()
      const data = [
        { id: 'b1', title: 'A', category: '' },
        { id: 'b2', title: 'B', category: '未分類' }
      ]

      const result = importer._extractBooksFromData(data)

      expect(result[0].tagIds).toEqual([])
      expect(result[1].tagIds).toEqual([])
    })
  })
})
