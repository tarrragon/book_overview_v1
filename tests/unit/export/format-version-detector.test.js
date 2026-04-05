'use strict'

const { detectFormatVersion, detectCsvFormatVersion } = require('../../../src/export/format-version-detector')

describe('FormatVersionDetector', () => {
  describe('detectFormatVersion', () => {
    test('v2 明確版本號 — metadata.formatVersion 以 2. 開頭回傳 v2', () => {
      const data = { metadata: { formatVersion: '2.0.0' }, books: [] }
      expect(detectFormatVersion(data)).toBe('v2')
    })

    test('v2 隱含偵測 — 有 metadata + books 含 readingStatus', () => {
      const data = {
        metadata: { source: 'test' },
        books: [{ id: '1', readingStatus: 'reading' }]
      }
      expect(detectFormatVersion(data)).toBe('v2')
    })

    test('v1 純陣列格式', () => {
      const data = [{ id: '1', title: 'Book' }]
      expect(detectFormatVersion(data)).toBe('v1')
    })

    test('v1 含 books 但無 formatVersion', () => {
      const data = { books: [{ id: '1', category: 'Fiction' }] }
      expect(detectFormatVersion(data)).toBe('v1')
    })

    test('無法辨識 — 非物件/非陣列回傳 null', () => {
      expect(detectFormatVersion(null)).toBe(null)
      expect(detectFormatVersion(undefined)).toBe(null)
      expect(detectFormatVersion(123)).toBe(null)
      expect(detectFormatVersion('string')).toBe(null)
    })

    test('無法辨識 — 物件但無 books', () => {
      expect(detectFormatVersion({ foo: 'bar' })).toBe(null)
    })
  })

  describe('detectCsvFormatVersion', () => {
    test('CSV v2 — 含 readingStatus 欄位', () => {
      expect(detectCsvFormatVersion(['id', 'title', 'readingStatus'])).toBe('v2')
    })

    test('CSV v1 — 含 isFinished 但無 readingStatus', () => {
      expect(detectCsvFormatVersion(['id', 'title', 'isFinished'])).toBe('v1')
    })

    test('CSV 降級 v1 — 無特徵欄位', () => {
      expect(detectCsvFormatVersion(['id', 'title', 'author'])).toBe('v1')
    })

    test('CSV 空標題行或 null', () => {
      expect(detectCsvFormatVersion([])).toBe('v1')
      expect(detectCsvFormatVersion(null)).toBe('v1')
    })
  })
})
