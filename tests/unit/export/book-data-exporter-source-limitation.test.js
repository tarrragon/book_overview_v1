/**
 * BookDataExporter source limitation 註記測試（W1-061.2）
 *
 * 測試範圍：
 * - CSV v2 匯出於 authors 欄位存在時前置 source-limited 註解列
 * - JSON v2 匯出於 metadata 增加 sourceLimitations 陣列
 * - includeSourceLimitations=false 時關閉註解輸出（純 RFC 4180 CSV）
 * - 不含 authors 欄位的 preset 不輸出註解
 *
 * 背景：W1-061 ANA 確認 Readmoo library 頁 DOM 不提供作者欄位（source data limitation）。
 * 匯出檔需明示此限制以避免用戶誤判 extractor 漏抓。
 *
 * @jest-environment jsdom
 */

const BookDataExporter = require('src/export/book-data-exporter')

function makeV2Book (overrides = {}) {
  return {
    id: 'book-001',
    title: '測試書籍',
    authors: [],
    publisher: '測試出版社',
    progress: 50,
    readingStatus: 'reading',
    type: '電子書',
    cover: 'https://example.com/cover.jpg',
    tagIds: [],
    isManualStatus: false,
    extractedAt: '2026-05-24T00:00:00.000Z',
    updatedAt: '2026-05-24T00:00:00.000Z',
    source: 'readmoo',
    ...overrides
  }
}

describe('BookDataExporter source limitation 註記（W1-061.2）', () => {
  describe('CSV v2 匯出', () => {
    // 注意：includeSourceLimitations 預設為 false（保持 RFC 4180 純度）
    // 由 overview-page-controller 等 caller 顯式啟用

    test('includeSourceLimitations=true 時應前置 source-limited 註解列', () => {
      const exporter = new BookDataExporter([makeV2Book()])
      const csv = exporter.exportToCSV({
        formatVersion: '2.0.0',
        fieldPreset: 'COMPLETE_V2',
        includeSourceLimitations: true,
        tags: [],
        tagCategories: []
      })

      const firstLine = csv.split('\n')[0]
      expect(firstLine).toMatch(/^#\s+source-limited:\s+authors/)
      expect(firstLine).toContain('Readmoo')
      expect(firstLine).toContain('可手動編輯')
    })

    test('source-limited 註解列應位於 headers 之前', () => {
      const exporter = new BookDataExporter([makeV2Book()])
      const csv = exporter.exportToCSV({
        formatVersion: '2.0.0',
        fieldPreset: 'COMPLETE_V2',
        includeSourceLimitations: true,
        tags: [],
        tagCategories: []
      })

      const lines = csv.split('\n')
      expect(lines[0]).toMatch(/^#/)
      expect(lines[1]).toContain('authors') // headers 行包含 authors 欄位
      expect(lines[1]).not.toMatch(/^#/) // headers 行非註解
    })

    test('預設（無 includeSourceLimitations）不輸出註解列（純 RFC 4180）', () => {
      const exporter = new BookDataExporter([makeV2Book()])
      const csv = exporter.exportToCSV({
        formatVersion: '2.0.0',
        fieldPreset: 'COMPLETE_V2',
        tags: [],
        tagCategories: []
      })

      const firstLine = csv.split('\n')[0]
      expect(firstLine).not.toMatch(/^#/)
      expect(firstLine).toContain('authors') // headers 為第一行
    })

    test('includeSourceLimitations=false 顯式關閉時不輸出註解列', () => {
      const exporter = new BookDataExporter([makeV2Book()])
      const csv = exporter.exportToCSV({
        formatVersion: '2.0.0',
        fieldPreset: 'COMPLETE_V2',
        includeSourceLimitations: false,
        tags: [],
        tagCategories: []
      })

      const firstLine = csv.split('\n')[0]
      expect(firstLine).not.toMatch(/^#/)
    })

    test('資料含真實作者時 source-limited 註解列仍依賴 includeSourceLimitations 開關', () => {
      // 註解列觸發條件為「preset 結構含 authors 欄位 + includeSourceLimitations=true」，
      // 與單本書 authors 值是否非空無關
      const exporter = new BookDataExporter([makeV2Book({ authors: ['真實作者'] })])
      const csv = exporter.exportToCSV({
        formatVersion: '2.0.0',
        fieldPreset: 'COMPLETE_V2',
        includeSourceLimitations: true,
        tags: [],
        tagCategories: []
      })

      expect(csv.split('\n')[0]).toMatch(/^#\s+source-limited:\s+authors/)
    })

    test('啟用註解列時資料行 authors 空陣列序列化為空白', () => {
      const exporter = new BookDataExporter([makeV2Book({ authors: [] })])
      const csv = exporter.exportToCSV({
        formatVersion: '2.0.0',
        fieldPreset: 'COMPLETE_V2',
        includeSourceLimitations: true,
        tags: [],
        tagCategories: []
      })

      const lines = csv.split('\n').filter(l => l.length > 0)
      // lines[0]: 註解 / lines[1]: headers / lines[2]: 第一筆書資料
      const dataLine = lines[2]
      const headers = lines[1].split(',')
      const authorsIdx = headers.indexOf('authors')
      const fields = dataLine.split(',')
      expect(authorsIdx).toBeGreaterThanOrEqual(0)
      expect(fields[authorsIdx]).toBe('') // 空陣列序列化為空白
    })
  })

  describe('JSON v2 匯出', () => {
    test('preset 含 authors 時 metadata.sourceLimitations 應含 authors 註記', () => {
      const exporter = new BookDataExporter([makeV2Book()])
      const json = exporter.exportToJSON({
        formatVersion: '2.0.0',
        fieldPreset: 'COMPLETE_V2',
        tags: [],
        tagCategories: []
      })

      const parsed = JSON.parse(json)
      expect(parsed.metadata.sourceLimitations).toBeDefined()
      expect(Array.isArray(parsed.metadata.sourceLimitations)).toBe(true)

      const authorsEntry = parsed.metadata.sourceLimitations.find(e => e.field === 'authors')
      expect(authorsEntry).toBeDefined()
      expect(authorsEntry.reason).toContain('Readmoo')
      expect(authorsEntry.reason).toContain('作者')
      expect(authorsEntry.recommendation).toContain('手動編輯')
      expect(authorsEntry.sourceTicket).toBe('0.19.0-W1-061')
    })

    test('資料含真實作者時 sourceLimitations 仍存在（preset 層級宣告）', () => {
      // sourceLimitations 是「preset 結構含 authors 欄位」層級的宣告，
      // 用以告知檔案讀者「此匯出 schema 的 authors 欄位來源可能為空」，
      // 與單本書 authors 值是否非空無關
      const exporter = new BookDataExporter([makeV2Book({ authors: ['某作者'] })])
      const json = exporter.exportToJSON({
        formatVersion: '2.0.0',
        fieldPreset: 'COMPLETE_V2',
        tags: [],
        tagCategories: []
      })
      const parsed = JSON.parse(json)
      expect(parsed.metadata.sourceLimitations).toBeDefined()
      expect(parsed.metadata.sourceLimitations.find(e => e.field === 'authors')).toBeDefined()
      // 驗證該本書 authors 仍正確輸出
      expect(parsed.books[0].authors).toEqual(['某作者'])
    })

    test('sourceLimitations 不影響其他 metadata 欄位', () => {
      const exporter = new BookDataExporter([makeV2Book()])
      const json = exporter.exportToJSON({
        formatVersion: '2.0.0',
        fieldPreset: 'COMPLETE_V2',
        tags: [],
        tagCategories: []
      })

      const parsed = JSON.parse(json)
      expect(parsed.metadata.formatVersion).toBe('2.0.0')
      expect(parsed.metadata.source).toBe('readmoo-book-extractor')
      expect(parsed.metadata.totalBooks).toBe(1)
    })
  })
})
