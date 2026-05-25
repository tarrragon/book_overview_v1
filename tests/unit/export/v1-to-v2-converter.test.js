'use strict'

const { convertV1ToV2Book, convertV1CategoryToTag, convertV1ToV2Data } = require('../../../src/export/v1-to-v2-converter')

describe('V1ToV2Converter', () => {
  const TIMESTAMP = '2026-04-05T10:00:00.000Z'

  describe('convertV1ToV2Book', () => {
    test('標準 v1 書籍轉換', () => {
      const v1Book = { id: 'b1', title: '三體', author: '劉慈欣', isFinished: true, progress: 100 }
      const result = convertV1ToV2Book(v1Book, TIMESTAMP)

      expect(result.id).toBe('b1')
      expect(result.title).toBe('三體')
      expect(result.authors).toEqual(['劉慈欣'])
      expect(result.readingStatus).toBe('finished')
      expect(result.progress).toBe(100)
      expect(result.tagIds).toEqual([])
      expect(result.isManualStatus).toBe(false)
      expect(result.source).toBe('readmoo')
    })

    test('author 為空字串或 undefined → authors 為空陣列', () => {
      const r1 = convertV1ToV2Book({ id: '1', title: 'A', author: '' }, TIMESTAMP)
      const r2 = convertV1ToV2Book({ id: '2', title: 'B' }, TIMESTAMP)
      expect(r1.authors).toEqual([])
      expect(r2.authors).toEqual([])
    })

    test('progress 異常值正規化 — 字串/超過100/null', () => {
      const r1 = convertV1ToV2Book({ id: '1', title: 'A', progress: '75' }, TIMESTAMP)
      const r2 = convertV1ToV2Book({ id: '2', title: 'B', progress: 150 }, TIMESTAMP)
      const r3 = convertV1ToV2Book({ id: '3', title: 'C', progress: null }, TIMESTAMP)
      expect(r1.progress).toBe(75)
      expect(r2.progress).toBe(100)
      expect(r3.progress).toBe(0)
    })

    test('含 category → 保留為 _v1Category', () => {
      const result = convertV1ToV2Book({ id: '1', title: 'A', category: '科幻小說' }, TIMESTAMP)
      expect(result._v1Category).toBe('科幻小說')
      expect(result.category).toBeUndefined()
    })

    test('null 輸入拋出 BookValidationError', () => {
      expect(() => convertV1ToV2Book(null)).toThrow()
    })

    test('缺少 id/title 拋出 BookValidationError', () => {
      expect(() => convertV1ToV2Book({ id: '1' })).toThrow()
      expect(() => convertV1ToV2Book({ title: 'A' })).toThrow()
    })
  })

  describe('convertV1CategoryToTag', () => {
    test('正常 category 轉換', () => {
      const result = convertV1CategoryToTag(['科幻', '文學'], TIMESTAMP)
      expect(result.tagCategory).not.toBeNull()
      expect(result.tagCategory.id).toBe('cat_imported')
      expect(result.tagCategory.name).toBe('匯入分類')
      expect(result.tags).toHaveLength(2)
      expect(result.categoryToTagIdMap.size).toBe(2)
      expect(result.categoryToTagIdMap.has('科幻')).toBe(true)
    })

    test('跳過空字串和「未分類」', () => {
      const result = convertV1CategoryToTag(['科幻', '', '未分類', '文學'], TIMESTAMP)
      expect(result.tags).toHaveLength(2)
      expect(result.tags.map(t => t.name)).toEqual(['科幻', '文學'])
    })

    test('空陣列 → tagCategory 為 null', () => {
      const result = convertV1CategoryToTag([], TIMESTAMP)
      expect(result.tagCategory).toBeNull()
      expect(result.tags).toEqual([])
      expect(result.categoryToTagIdMap.size).toBe(0)
    })

    // W1-078：Date.parse NaN fallback 完備化測試
    // 驗證當 caller 傳入無效 timestamp 字串時，ts 與 tsMs 仍同源，
    // 不可保留原始無效字串而讓 tag id 的 ms 與 createdAt 指向不同時刻
    describe('W1-078: Date.parse NaN fallback 同源驗證', () => {
      test('無效 timestamp 字串 → tag id 中的 ms 與 createdAt 同源', () => {
        const result = convertV1CategoryToTag(['科幻', '文學'], 'invalid-date')

        // tagCategory.createdAt 必須是有效 ISO 字串（非原始 'invalid-date'）
        expect(result.tagCategory.createdAt).not.toBe('invalid-date')
        const createdAtMs = Date.parse(result.tagCategory.createdAt)
        expect(Number.isFinite(createdAtMs)).toBe(true)

        // 每個 tag id 中的 tsMs 必須等於 createdAt 解析後的 ms
        result.tags.forEach((tag) => {
          // tag id 格式: tag_<tsMs>-<index>
          const match = tag.id.match(/^tag_(\d+)-\d{3}$/)
          expect(match).not.toBeNull()
          const tagIdMs = Number(match[1])
          expect(tagIdMs).toBe(createdAtMs)
          // tag.createdAt 也必須與 tagCategory.createdAt 同源
          expect(tag.createdAt).toBe(result.tagCategory.createdAt)
          expect(tag.updatedAt).toBe(result.tagCategory.createdAt)
        })
      })

      test('空字串 timestamp → 走預設分支（同源）', () => {
        // 空字串為 falsy，會走 else 分支（內部 Date.now() + 衍生 ISO）
        const result = convertV1CategoryToTag(['科幻'], '')

        const createdAtMs = Date.parse(result.tagCategory.createdAt)
        expect(Number.isFinite(createdAtMs)).toBe(true)

        const match = result.tags[0].id.match(/^tag_(\d+)-\d{3}$/)
        expect(match).not.toBeNull()
        expect(Number(match[1])).toBe(createdAtMs)
      })

      test('合法 ISO timestamp → 保留原始字串且 ms 同源（baseline）', () => {
        const result = convertV1CategoryToTag(['科幻'], TIMESTAMP)

        // 合法 timestamp 必須被保留為 createdAt
        expect(result.tagCategory.createdAt).toBe(TIMESTAMP)

        // tag id ms 必須等於 Date.parse(TIMESTAMP)
        const expectedMs = Date.parse(TIMESTAMP)
        const match = result.tags[0].id.match(/^tag_(\d+)-\d{3}$/)
        expect(match).not.toBeNull()
        expect(Number(match[1])).toBe(expectedMs)
      })
    })
  })

  describe('convertV1ToV2Data', () => {
    test('完整 v1 資料轉換', () => {
      const v1Data = [
        { id: '1', title: 'A', author: 'X', category: '科幻', progress: 50 },
        { id: '2', title: 'B', author: 'Y', category: '文學', isFinished: true }
      ]
      const result = convertV1ToV2Data(v1Data)

      expect(result.metadata.formatVersion).toBe('2.0.0')
      expect(result.books).toHaveLength(2)
      expect(result.tags).toHaveLength(2)
      expect(result.tagCategories).toHaveLength(1)
      // tagIds 已寫入
      expect(result.books[0].tagIds.length).toBe(1)
      // _v1Category 已清除
      expect(result.books[0]._v1Category).toBeUndefined()
    })

    test('單本書轉換失敗不中斷整體', () => {
      const v1Data = [
        { id: '1', title: 'A' },
        null,
        { id: '3', title: 'C' }
      ]
      const result = convertV1ToV2Data(v1Data)
      expect(result.books).toHaveLength(2)
    })
  })
})
