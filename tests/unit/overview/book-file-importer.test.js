/**
 * BookFileImporter CSV import 測試（W6-012.6.2）
 *
 * 測試範圍：
 * - 接受 text/csv MIME / .csv 副檔名（isCSVFile / validate）
 * - 解析 W6-012.6.1 book-exporter.js 輸出格式回 book 物件
 *   - 必要欄位 id/title/cover 完整
 *   - authors 以 ", " 分隔反序列化為陣列
 *   - tagIds 以 "; " 分隔反序列化為陣列
 *   - progress 反序列化為 number
 * - 欄位順序變化容錯（依 header 名稱對應，非固定位置）
 * - 雙引號 escape 與含逗號的欄位
 * - 走既有 _processBookData → _isValidBook 過濾流程
 *
 * W1-048.10.1.5.1 遷移：4 處 _isCSVFile 直呼改為 public isCSVFile（方案 A），
 * 對齊 W1-048.10.1.4 移除底線方法直呼的 SSOT 重構方向。
 *
 * @jest-environment jsdom
 */

const { BookFileImporter } = require('../../../src/overview/book-file-importer')

describe('BookFileImporter CSV import（W6-012.6.2）', () => {
  function makeImporter () {
    return new BookFileImporter({
      document,
      showError: () => {}
    })
  }

  /**
   * 直接走 public parseContent 路徑（避免 FileReader 在 jsdom 環境的非同步處理差異）
   *
   * W1-048.1 Stage C.1：遷移至 public API（parseContent），不再呼底線 _handleFileContent。
   * parseContent 回傳 ImportResult（{ books, tagCategories, tags }）；helper 解構 .books
   * 維持 CSV happy path 既有斷言不變。CSV 路徑 tagCategories / tags 恆為 []，另由
   * import-result 測試覆蓋。
   */
  function parseCSV (importer, csvText) {
    return importer.parseContent(csvText, 'csv').books
  }

  /**
   * W1-048.1 Stage A：Public API contract test
   *
   * 驗證 BookFileImporter 暴露 validate / read / parseContent 三個 public method，
   * 以及 parseContent 對 fileFormat 必填的型別契約（F16 修復核心）。
   */
  describe('Public API contract（W1-048.1 Stage A）', () => {
    test('validate / read / parseContent / isCSVFile 為 callable public method', () => {
      // W1-048.10.1.5.1：isCSVFile 加入 public API（_isCSVFile 委派）
      const importer = makeImporter()
      expect(typeof importer.validate).toBe('function')
      expect(typeof importer.read).toBe('function')
      expect(typeof importer.parseContent).toBe('function')
      expect(typeof importer.isCSVFile).toBe('function')
    })

    test('validate(file) 對無效檔案（null）拋錯', () => {
      const importer = makeImporter()
      expect(() => importer.validate(null)).toThrow()
    })

    test('parseContent(content, fileFormat) 對合法 CSV 內容回傳 ImportResult', () => {
      // W1-048.1.3 Stage C.1 追加範圍修正：parseContent 實際回傳 ImportResult
      // （{ books, tagCategories, tags }），非 Array<Book>。修正錯誤的 Array.isArray
      // 斷言與 _handleFileContent 對照（後者為私有方法，本檔不再引用）。
      const importer = makeImporter()
      const csv = [
        '書名,書城來源,進度,狀態,封面URL,id,authors,tagIds',
        '"書","readmoo","0","unread","https://example.com/c.jpg","b1","",""'
      ].join('\n')
      const result = importer.parseContent(csv, 'csv')
      expect(result).toBeDefined()
      expect(result).toHaveProperty('books')
      expect(result).toHaveProperty('tagCategories')
      expect(result).toHaveProperty('tags')
      expect(Array.isArray(result.books)).toBe(true)
      expect(result.books).toHaveLength(1)
      expect(result.books[0].id).toBe('b1')
    })

    test('parseContent 未傳 fileFormat 時 throw TypeError（F16 修復：型別契約強制，禁止 fallback 至 json）', () => {
      const importer = makeImporter()
      const csv = '書名,id\n"書","b1"'
      expect(() => importer.parseContent(csv)).toThrow(TypeError)
    })
  })

  describe('檔案格式偵測', () => {
    test('isCSVFile 應識別 .csv 副檔名', () => {
      // W1-048.10.1.5.1：遷移自 _isCSVFile 直呼至 public isCSVFile
      const importer = makeImporter()
      expect(importer.isCSVFile({ name: 'books.csv', type: '' })).toBe(true)
      expect(importer.isCSVFile({ name: 'books.CSV', type: '' })).toBe(true)
    })

    test('isCSVFile 應識別 text/csv MIME 類型', () => {
      // W1-048.10.1.5.1：遷移自 _isCSVFile 直呼至 public isCSVFile
      const importer = makeImporter()
      expect(importer.isCSVFile({ name: 'books', type: 'text/csv' })).toBe(true)
      // book-exporter.js 實際使用 'text/csv;charset=utf-8;'
      expect(importer.isCSVFile({ name: 'books', type: 'text/csv;charset=utf-8;' })).toBe(true)
    })

    test('validate 應接受 CSV 檔案不拋錯', () => {
      // W1-048.1 Stage C.1：遷移自 _validateFileBasics 直呼至 public validate(file)
      const importer = makeImporter()
      const csvFile = { name: 'books.csv', type: 'text/csv', size: 100 }
      expect(() => importer.validate(csvFile)).not.toThrow()
    })

    test('validate 應拒絕非 JSON / CSV 檔案', () => {
      // W1-048.1 Stage C.1：遷移自 _validateFileBasics 直呼至 public validate(file)
      const importer = makeImporter()
      const txtFile = { name: 'books.txt', type: 'text/plain', size: 100 }
      expect(() => importer.validate(txtFile)).toThrow('檔案格式不正確')
    })
  })

  describe('CSV 解析 - happy path', () => {
    test('能解析 W6-012.6.1 標準輸出格式回 book 物件', () => {
      const importer = makeImporter()
      const csv = [
        '書名,書城來源,進度,狀態,封面URL,id,authors,tagIds',
        '"書本A","readmoo","42","reading","https://example.com/cover-a.jpg","book-001","作者甲, 作者乙","tag-001; tag-002"'
      ].join('\n')

      const books = parseCSV(importer, csv)
      expect(books).toHaveLength(1)
      const book = books[0]
      expect(book.id).toBe('book-001')
      expect(book.title).toBe('書本A')
      expect(book.source).toBe('readmoo')
      expect(book.progress).toBe(42)
      expect(book.status).toBe('reading')
      expect(book.cover).toBe('https://example.com/cover-a.jpg')
      expect(book.authors).toEqual(['作者甲', '作者乙'])
      expect(book.tagIds).toEqual(['tag-001', 'tag-002'])
    })

    test('能 round-trip：CSV 匯出格式 → BookFileImporter 匯入', () => {
      // inline CSV fixture，對應 book-exporter v1 CSV 輸出格式
      // （v1 generateCSVContent 已於 W1-042.2 移除，改用固定字串避免死碼依賴）
      const csvContent = [
        '書名,書城來源,進度,狀態,封面URL,id,authors,tagIds',
        '"迴圈書","readmoo","75","reading","https://example.com/rt-001.jpg","rt-001","Alice, Bob","tech; fiction"'
      ].join('\n')

      const importer = makeImporter()
      const imported = parseCSV(importer, csvContent)

      expect(imported).toHaveLength(1)
      expect(imported[0].id).toBe('rt-001')
      expect(imported[0].title).toBe('迴圈書')
      expect(imported[0].progress).toBe(75)
      expect(imported[0].authors).toEqual(['Alice', 'Bob'])
      expect(imported[0].tagIds).toEqual(['tech', 'fiction'])
      expect(imported[0].cover).toBe('https://example.com/rt-001.jpg')
    })

    test('能解析多筆書籍', () => {
      const importer = makeImporter()
      const csv = [
        '書名,書城來源,進度,狀態,封面URL,id,authors,tagIds',
        '"書一","readmoo","10","unread","https://example.com/c1.jpg","b1","",""',
        '"書二","readmoo","100","finished","https://example.com/c2.jpg","b2","作者X","tag-x"'
      ].join('\n')

      const books = parseCSV(importer, csv)
      expect(books).toHaveLength(2)
      expect(books[0].id).toBe('b1')
      expect(books[0].authors).toEqual([])
      expect(books[0].tagIds).toEqual([])
      expect(books[1].id).toBe('b2')
      expect(books[1].authors).toEqual(['作者X'])
      expect(books[1].tagIds).toEqual(['tag-x'])
    })

    test('忽略尾端空行', () => {
      const importer = makeImporter()
      const csv = [
        '書名,書城來源,進度,狀態,封面URL,id,authors,tagIds',
        '"書","readmoo","0","unread","https://example.com/c.jpg","b1","",""',
        '',
        ''
      ].join('\n')

      const books = parseCSV(importer, csv)
      expect(books).toHaveLength(1)
    })
  })

  describe('CSV 解析 - 欄位順序容錯', () => {
    test('欄位順序改變時仍能正確對應 field（依 header 名稱）', () => {
      const importer = makeImporter()
      // 故意改變欄位順序：id 在最前，authors / tagIds 穿插在中間
      const csv = [
        'id,authors,書名,tagIds,書城來源,封面URL,進度,狀態',
        '"book-999","作者甲, 作者乙","書本順序變化","tag-a; tag-b","readmoo","https://example.com/c.jpg","30","reading"'
      ].join('\n')

      const books = parseCSV(importer, csv)
      expect(books).toHaveLength(1)
      const book = books[0]
      expect(book.id).toBe('book-999')
      expect(book.title).toBe('書本順序變化')
      expect(book.authors).toEqual(['作者甲', '作者乙'])
      expect(book.tagIds).toEqual(['tag-a', 'tag-b'])
      expect(book.source).toBe('readmoo')
      expect(book.cover).toBe('https://example.com/c.jpg')
      expect(book.progress).toBe(30)
      expect(book.status).toBe('reading')
    })

    test('未知 header 欄位應被忽略（前向相容）', () => {
      const importer = makeImporter()
      const csv = [
        '書名,書城來源,進度,狀態,封面URL,id,authors,tagIds,未來新欄位',
        '"書","readmoo","0","unread","https://example.com/c.jpg","b1","","","futureValue"'
      ].join('\n')

      const books = parseCSV(importer, csv)
      expect(books).toHaveLength(1)
      expect(books[0].id).toBe('b1')
      expect(books[0]).not.toHaveProperty('未來新欄位')
    })
  })

  describe('CSV 解析 - escape 處理', () => {
    test('能處理欄位內含逗號（雙引號包覆）', () => {
      const importer = makeImporter()
      const csv = [
        '書名,書城來源,進度,狀態,封面URL,id,authors,tagIds',
        '"含,逗號的書名","readmoo","0","unread","https://example.com/c.jpg","b1","",""'
      ].join('\n')

      const books = parseCSV(importer, csv)
      expect(books[0].title).toBe('含,逗號的書名')
    })

    test('能處理欄位內含雙引號（"" 跳脫）', () => {
      const importer = makeImporter()
      const csv = [
        '書名,書城來源,進度,狀態,封面URL,id,authors,tagIds',
        '"含""引號""的書","readmoo","0","unread","https://example.com/c.jpg","b1","",""'
      ].join('\n')

      const books = parseCSV(importer, csv)
      expect(books[0].title).toBe('含"引號"的書')
    })
  })

  describe('CSV 解析 - 失效情境', () => {
    test('空內容應拋出 PARSE_ERROR', () => {
      const importer = makeImporter()
      expect(() => parseCSV(importer, '')).toThrow()
    })

    test('缺少必要 header（id）應拋出 PARSE_ERROR', () => {
      const importer = makeImporter()
      const csv = [
        '書名,書城來源,進度,狀態,封面URL,authors,tagIds',
        '"書","readmoo","0","unread","https://example.com/c.jpg","",""'
      ].join('\n')
      expect(() => parseCSV(importer, csv)).toThrow(/CSV/)
    })

    test('資料列缺必要欄位（id/title/cover）的書籍會被 _isValidBook 過濾掉', () => {
      const importer = makeImporter()
      const csv = [
        '書名,書城來源,進度,狀態,封面URL,id,authors,tagIds',
        '"","readmoo","0","unread","https://example.com/c.jpg","","",""',
        '"有效書","readmoo","0","unread","https://example.com/c2.jpg","b1","",""'
      ].join('\n')
      const books = parseCSV(importer, csv)
      // 第一筆 title / id 為空字串 → 被 _validateRequiredFields 過濾
      expect(books).toHaveLength(1)
      expect(books[0].id).toBe('b1')
    })
  })
})
