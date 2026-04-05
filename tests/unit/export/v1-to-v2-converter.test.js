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
