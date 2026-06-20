/**
 * Phase 2 測試群組 A：parseAndValidate（BU-1 + BU-2 + BU-8）
 *
 * Ticket: 1.2.0-W1-002
 * 功能職責：JSON 解析 + 格式驗證 + metadata 提取 + 空書籍攔截
 */

const { parseAndValidate } = require('src/import/json-importer')
const {
  createCanonicalJSON,
  createV2JSON,
  createV1JSON,
  createAppLegacyJSON
} = require('@tests/unit/import/fixtures')

describe('parseAndValidate（測試群組 A）', () => {
  describe('A1：正常解析四來源格式', () => {
    test('A1-1：正常解析 canonical JSON → source canonical、metadata 有值、bookCount 正確', () => {
      const fileContent = createCanonicalJSON({ bookCount: 3 })

      const result = parseAndValidate(fileContent)

      expect(result.code).toBeUndefined()
      expect(result.source).toBe('canonical')
      expect(result.metadata.exportedAt).toBe('2026-06-20T10:00:00Z')
      expect(result.metadata.sourceApp).toBe('book_overview_app')
      expect(result.metadata.totalBooks).toBe(3)
      expect(result.bookCount).toBe(3)
    })

    test('A1-2：正常解析 v2 JSON → source v2、metadata 各欄位 null、bookCount 正確', () => {
      const fileContent = createV2JSON({ bookCount: 2 })

      const result = parseAndValidate(fileContent)

      expect(result.source).toBe('v2')
      expect(result.metadata.exportedAt).toBeNull()
      expect(result.metadata.sourceApp).toBeNull()
      expect(result.metadata.totalBooks).toBeNull()
      expect(result.bookCount).toBe(2)
    })

    test('A1-3：正常解析 app-legacy JSON → source app-legacy、metadata null、bookCount 正確', () => {
      const fileContent = createAppLegacyJSON({ bookCount: 1 })

      const result = parseAndValidate(fileContent)

      expect(result.source).toBe('app-legacy')
      expect(result.metadata.exportedAt).toBeNull()
      expect(result.bookCount).toBe(1)
    })

    test('A1-4：正常解析 v1 JSON → source v1、metadata null、bookCount 正確', () => {
      const fileContent = createV1JSON({ bookCount: 4 })

      const result = parseAndValidate(fileContent)

      expect(result.source).toBe('v1')
      expect(result.metadata.exportedAt).toBeNull()
      expect(result.bookCount).toBe(4)
    })
  })

  describe('E1：錯誤路徑', () => {
    test('E1-1：JSON 解析失敗 → IMPORT_PARSE_ERROR', () => {
      const result = parseAndValidate('not a json {')

      expect(result.code).toBe('IMPORT_PARSE_ERROR')
    })

    test('E1-2：格式無法辨識 → IMPORT_UNKNOWN_FORMAT', () => {
      const result = parseAndValidate(JSON.stringify({ random: 'data' }))

      expect(result.code).toBe('IMPORT_UNKNOWN_FORMAT')
    })

    test('E1-3：空書籍陣列 → IMPORT_EMPTY_BOOKS', () => {
      const fileContent = JSON.stringify({ format: 'book-interchange-v1', metadata: {}, books: [] })

      const result = parseAndValidate(fileContent)

      expect(result.code).toBe('IMPORT_EMPTY_BOOKS')
    })
  })

  describe('B1：邊界條件', () => {
    test('B1-1：空字串輸入 → IMPORT_PARSE_ERROR', () => {
      const result = parseAndValidate('')

      expect(result.code).toBe('IMPORT_PARSE_ERROR')
    })

    test('B1-2：null 輸入 → IMPORT_PARSE_ERROR', () => {
      const result = parseAndValidate(null)

      expect(result.code).toBe('IMPORT_PARSE_ERROR')
    })

    test('B1-3：超大 JSON（5000 本書）→ 正常回傳 bookCount 5000', () => {
      const fileContent = createCanonicalJSON({ bookCount: 5000 })

      const result = parseAndValidate(fileContent)

      expect(result.code).toBeUndefined()
      expect(result.bookCount).toBe(5000)
    })

    test('B1-4：books 欄位不存在的 canonical → EMPTY_BOOKS 或 UNKNOWN_FORMAT', () => {
      const fileContent = JSON.stringify({ format: 'book-interchange-v1', metadata: {} })

      const result = parseAndValidate(fileContent)

      expect(['IMPORT_EMPTY_BOOKS', 'IMPORT_UNKNOWN_FORMAT']).toContain(result.code)
    })

    test('B1-5：totalBooks 與 bookCount 不一致 → 正常回傳，metadata.totalBooks=10、bookCount=8', () => {
      const fileContent = createCanonicalJSON({ bookCount: 8, totalBooks: 10 })

      const result = parseAndValidate(fileContent)

      expect(result.code).toBeUndefined()
      expect(result.metadata.totalBooks).toBe(10)
      expect(result.bookCount).toBe(8)
    })
  })
})
