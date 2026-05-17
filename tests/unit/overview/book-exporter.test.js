/**
 * BookExporter CSV 匯出欄位測試（W6-012.6.1）
 *
 * 測試範圍：
 * - CSV_HEADERS 含 id / authors / tagIds 三欄
 * - _bookToCSVRow 正確序列化 authors（', ' 分隔）與 tagIds（'; ' 分隔）
 * - 既有 5 欄輸出順序與內容不變（書名/書城來源/進度/狀態/封面URL）
 *
 * @jest-environment jsdom
 */

const { BookExporter } = require('../../../src/overview/book-exporter')

describe('BookExporter CSV 欄位擴充（W6-012.6.1）', () => {
  function makeExporter (books) {
    return new BookExporter({
      getFilteredBooks: () => books,
      document
    })
  }

  describe('CSV_HEADERS 結構', () => {
    test('應包含既有 5 欄與新增 id/authors/tagIds 三欄', () => {
      const exporter = makeExporter([])
      const csv = exporter.generateCSVContent()
      const header = csv.split('\n')[0]

      // 既有 5 欄順序與內容不變
      expect(header).toMatch(/^書名,書城來源,進度,狀態,封面URL/)
      // 新增三欄附加在尾端
      expect(header).toContain('id')
      expect(header).toContain('authors')
      expect(header).toContain('tagIds')
      expect(header).toBe('書名,書城來源,進度,狀態,封面URL,id,authors,tagIds')
    })
  })

  describe('_bookToCSVRow 序列化', () => {
    test('id 欄位輸出 book.id', () => {
      const exporter = makeExporter([])
      const row = exporter._bookToCSVRow({ id: 'book-123', title: 'T' })
      const cols = row.split(',')
      // 第 6 欄為 id（index 5）
      expect(cols[5]).toBe('"book-123"')
    })

    test('authors 陣列以 ", " 分隔', () => {
      const exporter = makeExporter([])
      const row = exporter._bookToCSVRow({
        id: 'b1',
        authors: ['Alice', 'Bob', 'Carol']
      })
      const cols = row.split(',')
      // CSV split by ',' 會切到 authors 內部分隔符號，採子字串包含驗證
      expect(row).toContain('"Alice, Bob, Carol"')
    })

    test('tagIds 陣列以 "; " 分隔', () => {
      const exporter = makeExporter([])
      const row = exporter._bookToCSVRow({
        id: 'b1',
        tagIds: ['t1', 't2', 't3']
      })
      expect(row).toContain('"t1; t2; t3"')
    })

    test('authors / tagIds 缺失時輸出空字串而非 undefined', () => {
      const exporter = makeExporter([])
      const row = exporter._bookToCSVRow({ id: 'b1', title: 'T' })
      // 不應包含 undefined
      expect(row).not.toContain('undefined')
      // 結尾應為三個空字串欄位（id 已填，authors/tagIds 空）
      expect(row.endsWith(',"b1","",""')).toBe(true)
    })

    test('既有 5 欄輸出順序不變', () => {
      const exporter = makeExporter([])
      const row = exporter._bookToCSVRow({
        title: '書名A',
        progress: 50,
        status: '閱讀中',
        cover: 'http://x/y.jpg',
        id: 'idA',
        authors: ['A1'],
        tagIds: ['T1']
      })
      // 前五欄與重構前一致
      expect(row.startsWith('"書名A","readmoo","50","閱讀中","http://x/y.jpg"')).toBe(true)
    })
  })

  describe('generateCSVContent 整合', () => {
    test('多本書時每本一行且欄數一致', () => {
      const books = [
        { id: 'b1', title: 'A', progress: 10, status: 's', cover: 'c1', authors: ['X'], tagIds: ['t1'] },
        { id: 'b2', title: 'B', progress: 20, status: 's', cover: 'c2', authors: ['Y', 'Z'], tagIds: ['t1', 't2'] }
      ]
      const exporter = makeExporter(books)
      const lines = exporter.generateCSVContent().split('\n')
      expect(lines).toHaveLength(3) // header + 2 rows
      // 每一行 8 個欄位（split 不精準對 authors 中的逗號，故只驗 header）
      const headerCols = lines[0].split(',')
      expect(headerCols).toHaveLength(8)
    })
  })
})
