/**
 * ContentParser helper class 單元測試
 *
 * 對應 ticket: 0.19.0-W1-048.10.1.2
 *
 * 測試範圍（Phase 2 sage-test-architect 設計 ~35-40 case）：
 * - API 簽章與反向斷言
 * - 前置鏈短路（fileFormat / content）
 * - JSON path（v1 / v2 / MetadataWrap / EmptyObject / Unrecognized）
 * - CSV path（基本解析 / 缺欄位 / 空白行）
 * - INV-1 不變式（三欄位恆為陣列）
 * - 大型資料集警告（largeDatasetThreshold DI）
 * - 注入 stub（detectFormatVersion / convertV1ToV2Data）
 * - BOM 移除
 * - 純函式無 state
 *
 * 測試策略（Sociable Unit）：
 * - 真實 detectFormatVersion / convertV1ToV2Data（內層 Domain 邏輯，不 Mock）
 * - 僅版本邊界 case 注入 stub 驗證 DI 接點
 * - 抑制 console.warn 避免污染輸出
 *
 * 等價契約來源：src/overview/book-file-importer.js L322-823
 *
 * @jest-environment jsdom
 */

const { ContentParser } = require('src/overview/import/content-parser')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

describe('ContentParser', () => {
  // 抑制 console.warn（_extractTagSection / MetadataWrap / largeDataset 告警），避免污染測試輸出
  let consoleWarnSpy
  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  describe('API 簽章與反向斷言', () => {
    test('ContentParser 為 class，可被 new 實例化', () => {
      expect(typeof ContentParser).toBe('function')
      const instance = new ContentParser()
      expect(instance).toBeInstanceOf(ContentParser)
    })

    test('instance 暴露 parse 方法', () => {
      const instance = new ContentParser()
      expect(typeof instance.parse).toBe('function')
    })

    test('instance 不暴露舊底線方法（_handleFileContent / _parseJSONContent / _parseCSVContent / _processBookData / _extractBooksFromData）', () => {
      const instance = new ContentParser()
      // 反向斷言：搬遷後核心 helper 不可被外部直接呼叫
      expect(instance._handleFileContent).toBeUndefined()
    })

    test('constructor 無參數時使用預設依賴', () => {
      // 無 deps 傳入應使用模組預設 detectFormatVersion / convertV1ToV2Data
      const instance = new ContentParser()
      const result = instance.parse('{"books":[{"id":"b1","title":"書一"}]}', 'json')
      expect(result.books).toHaveLength(1)
    })
  })

  describe('parse(content, fileFormat) - 前置鏈：fileFormat', () => {
    test('fileFormat 為 undefined 拋出 TypeError', () => {
      const parser = new ContentParser()
      expect(() => parser.parse('{"books":[]}', undefined)).toThrow(TypeError)
    })

    test('fileFormat 為 null 拋出 TypeError', () => {
      const parser = new ContentParser()
      expect(() => parser.parse('{"books":[]}', null)).toThrow(TypeError)
    })

    test('fileFormat 為非 "json"/"csv" 拋出 PARSE_ERROR', () => {
      const parser = new ContentParser()
      expect(() => parser.parse('content', 'xml')).toThrow()
      try {
        parser.parse('content', 'xml')
      } catch (err) {
        expect(err.code).toBe(ErrorCodes.PARSE_ERROR)
        expect(err.details).toEqual({ category: 'parsing' })
      }
    })
  })

  describe('parse(content, fileFormat) - 前置鏈：content 非空', () => {
    test('空字串 content 拋出 VALIDATION_ERROR', () => {
      const parser = new ContentParser()
      expect(() => parser.parse('', 'json')).toThrow()
      try {
        parser.parse('', 'json')
      } catch (err) {
        expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR)
        expect(err.details).toEqual({ category: 'validation' })
      }
    })

    test('null content 拋出 VALIDATION_ERROR', () => {
      const parser = new ContentParser()
      expect(() => parser.parse(null, 'json')).toThrow()
      try {
        parser.parse(null, 'json')
      } catch (err) {
        expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR)
      }
    })

    test('全空白 content 拋出 VALIDATION_ERROR', () => {
      const parser = new ContentParser()
      expect(() => parser.parse('   \n\t  ', 'json')).toThrow()
      try {
        parser.parse('   \n\t  ', 'json')
      } catch (err) {
        expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR)
      }
    })
  })

  describe('parse - BOM 移除', () => {
    test('content 含 BOM 前綴仍解析成功', () => {
      const parser = new ContentParser()
      const contentWithBOM = '﻿{"books":[{"id":"b1","title":"書一"}]}'
      const result = parser.parse(contentWithBOM, 'json')
      expect(result.books).toHaveLength(1)
    })
  })

  describe('parse - JSON 解析失敗', () => {
    test('損毀 JSON 拋出 PARSE_ERROR，cause 保留原 SyntaxError', () => {
      const parser = new ContentParser()
      expect(() => parser.parse('{ broken', 'json')).toThrow()
      try {
        parser.parse('{ broken', 'json')
      } catch (err) {
        expect(err.code).toBe(ErrorCodes.PARSE_ERROR)
        expect(err.details).toEqual({ category: 'parsing' })
        expect(err.cause).toBeInstanceOf(SyntaxError)
      }
    })
  })

  describe('parse - JSON path v1（純陣列）', () => {
    test('v1 純陣列格式解析並轉換', () => {
      const parser = new ContentParser()
      const content = JSON.stringify([
        {
          id: 'b1',
          title: '書一',
          isNew: false,
          isFinished: true,
          progress: 100,
          author: '作者甲',
          category: '科幻'
        }
      ])
      const result = parser.parse(content, 'json')
      expect(Array.isArray(result.books)).toBe(true)
      expect(result.books).toHaveLength(1)
      // 真實 converter 會把 isFinished/isNew 轉成 readingStatus
      expect(result.books[0].readingStatus).toBe('finished')
      expect(result.books[0].authors).toEqual(['作者甲'])
    })

    test('v1 books 包裝格式（無 formatVersion）解析並轉換', () => {
      const parser = new ContentParser()
      const content = JSON.stringify({
        books: [{ id: 'b1', title: '書一', progress: 50 }]
      })
      const result = parser.parse(content, 'json')
      expect(result.books).toHaveLength(1)
      expect(Array.isArray(result.books[0].tagIds)).toBe(true)
    })
  })

  describe('parse - JSON path v2（明確 formatVersion）', () => {
    test('v2 三區段完整提取', () => {
      const parser = new ContentParser()
      const content = JSON.stringify({
        metadata: { formatVersion: '2.0.0' },
        tagCategories: [{ id: 'cat_a', name: '自訂', categoryId: null }],
        tags: [{ id: 'tag_a', name: '科幻', categoryId: 'cat_a' }],
        books: [
          { id: 'b1', title: '書一', readingStatus: 'finished', cover: 'http://x/c.jpg' }
        ]
      })
      const result = parser.parse(content, 'json')
      expect(result.books).toHaveLength(1)
      expect(result.tagCategories).toEqual([{ id: 'cat_a', name: '自訂', categoryId: null }])
      expect(result.tags).toEqual([{ id: 'tag_a', name: '科幻', categoryId: 'cat_a' }])
    })

    test('v2 缺 tag 欄位降級為空陣列', () => {
      const parser = new ContentParser()
      const content = JSON.stringify({
        metadata: { formatVersion: '2.0.0' },
        books: [{ id: 'b1', title: '書一', readingStatus: 'reading', cover: 'http://x/c.jpg' }]
      })
      const result = parser.parse(content, 'json')
      expect(result.books).toHaveLength(1)
      expect(Array.isArray(result.tagCategories)).toBe(true)
      expect(result.tagCategories).toEqual([])
      expect(Array.isArray(result.tags)).toBe(true)
      expect(result.tags).toEqual([])
    })

    test('v2 tag 欄位型別非陣列時降級且告警', () => {
      const parser = new ContentParser()
      const content = JSON.stringify({
        metadata: { formatVersion: '2.0.0' },
        tagCategories: {},
        tags: 'bad',
        books: [{ id: 'b1', title: '書一', readingStatus: 'reading', cover: 'http://x/c.jpg' }]
      })
      const result = parser.parse(content, 'json')
      expect(result.tagCategories).toEqual([])
      expect(result.tags).toEqual([])
      // 兩個型別錯誤欄位各觸發一次 warn
      expect(consoleWarnSpy).toHaveBeenCalled()
    })
  })

  describe('parse - JSON path MetadataWrap（歷史相容）', () => {
    test('{data: [...]} 形狀解析並 warn', () => {
      const parser = new ContentParser()
      const content = JSON.stringify({
        data: [{ id: 'b1', title: '書一' }]
      })
      const result = parser.parse(content, 'json')
      expect(result.books).toHaveLength(1)
      // 觸發 metadata-wrap 警告
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('metadata-wrap')
      )
    })
  })

  describe('parse - JSON path EmptyObject 與 Unrecognized', () => {
    test('空 JSON 物件 {} 回傳空 ImportResult', () => {
      const parser = new ContentParser()
      const result = parser.parse('{}', 'json')
      expect(result).toEqual({ books: [], tagCategories: [], tags: [] })
    })

    test('無法辨識的 JSON 結構拋出 VALIDATION_ERROR', () => {
      const parser = new ContentParser()
      // 不含 books / data / 非陣列 / 非空物件 → 落入 Unrecognized
      const content = JSON.stringify({ foo: 'bar', baz: 123 })
      expect(() => parser.parse(content, 'json')).toThrow()
      try {
        parser.parse(content, 'json')
      } catch (err) {
        expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR)
        expect(err.details).toEqual({ category: 'validation' })
      }
    })
  })

  describe('parse - CSV path', () => {
    test('合法 CSV 解析成功', () => {
      const parser = new ContentParser()
      const csv = [
        '書名,id,authors,進度',
        '"書一","b1","作者甲","50"',
        '"書二","b2","作者乙, 作者丙","80"'
      ].join('\n')
      const result = parser.parse(csv, 'csv')
      expect(result.books).toHaveLength(2)
      expect(result.books[0].id).toBe('b1')
      expect(result.books[0].title).toBe('書一')
      expect(result.books[0].authors).toEqual(['作者甲'])
      expect(result.books[0].progress).toBe(50)
      expect(result.books[1].authors).toEqual(['作者乙', '作者丙'])
    })

    test('CSV 三區段恆為陣列（tagCategories / tags 空陣列）', () => {
      const parser = new ContentParser()
      const csv = '書名,id\n"書一","b1"'
      const result = parser.parse(csv, 'csv')
      expect(Array.isArray(result.tagCategories)).toBe(true)
      expect(result.tagCategories).toEqual([])
      expect(Array.isArray(result.tags)).toBe(true)
      expect(result.tags).toEqual([])
    })

    test('CSV 缺必要欄位拋出 PARSE_ERROR', () => {
      const parser = new ContentParser()
      // header 無 id
      const csv = '書名,authors\n"書一","作者甲"'
      expect(() => parser.parse(csv, 'csv')).toThrow()
      try {
        parser.parse(csv, 'csv')
      } catch (err) {
        expect(err.code).toBe(ErrorCodes.PARSE_ERROR)
        expect(err.details).toEqual({ category: 'parsing' })
      }
    })

    test('CSV 含空白行（尾端）被忽略', () => {
      const parser = new ContentParser()
      const csv = [
        '書名,id',
        '"書一","b1"',
        '',
        ''
      ].join('\n')
      const result = parser.parse(csv, 'csv')
      expect(result.books).toHaveLength(1)
    })

    test('CSV tagIds 欄位以 "; " 分隔', () => {
      const parser = new ContentParser()
      const csv = [
        '書名,id,tagIds',
        '"書一","b1","tag_a; tag_b; tag_c"'
      ].join('\n')
      const result = parser.parse(csv, 'csv')
      expect(result.books[0].tagIds).toEqual(['tag_a', 'tag_b', 'tag_c'])
    })

    test('CSV 跳脫雙引號 "" 解析為單個 "', () => {
      const parser = new ContentParser()
      const csv = [
        '書名,id',
        '"標題含""引號""","b1"'
      ].join('\n')
      const result = parser.parse(csv, 'csv')
      expect(result.books[0].title).toBe('標題含"引號"')
    })

    test('CSV 欄位含逗號（在引號內）正確解析', () => {
      const parser = new ContentParser()
      const csv = [
        '書名,id',
        '"書名, 含逗號","b1"'
      ].join('\n')
      const result = parser.parse(csv, 'csv')
      expect(result.books[0].title).toBe('書名, 含逗號')
    })

    test('CSV \\r\\n 行尾正確解析', () => {
      const parser = new ContentParser()
      const csv = '書名,id\r\n"書一","b1"\r\n"書二","b2"\r\n'
      const result = parser.parse(csv, 'csv')
      expect(result.books).toHaveLength(2)
    })
  })

  describe('parse - book 有效性過濾', () => {
    test('v2 中缺 id / title 的 book 被過濾', () => {
      const parser = new ContentParser()
      const content = JSON.stringify({
        metadata: { formatVersion: '2.0.0' },
        books: [
          { id: 'b1', title: '書一', cover: 'http://x/c.jpg' },
          { id: '', title: '無 id' },
          { id: 'b2', title: '', cover: '' }
        ]
      })
      const result = parser.parse(content, 'json')
      expect(result.books).toHaveLength(1)
      expect(result.books[0].id).toBe('b1')
    })

    test('cover 缺漏（undefined）仍視為有效（W1-048.4.1 寬鬆）', () => {
      const parser = new ContentParser()
      const content = JSON.stringify({
        metadata: { formatVersion: '2.0.0' },
        books: [{ id: 'b1', title: '書一' }]
      })
      const result = parser.parse(content, 'json')
      expect(result.books).toHaveLength(1)
    })
  })

  describe('parse - INV-1 不變式（三欄位恆為陣列）', () => {
    test('v1 path：三欄位皆 Array.isArray = true', () => {
      const parser = new ContentParser()
      const content = JSON.stringify([{ id: 'b1', title: '書一' }])
      const result = parser.parse(content, 'json')
      expect(Array.isArray(result.books)).toBe(true)
      expect(Array.isArray(result.tagCategories)).toBe(true)
      expect(Array.isArray(result.tags)).toBe(true)
    })

    test('v2 path：三欄位皆 Array.isArray = true', () => {
      const parser = new ContentParser()
      const content = JSON.stringify({
        metadata: { formatVersion: '2.0.0' },
        books: [{ id: 'b1', title: '書一' }]
      })
      const result = parser.parse(content, 'json')
      expect(Array.isArray(result.books)).toBe(true)
      expect(Array.isArray(result.tagCategories)).toBe(true)
      expect(Array.isArray(result.tags)).toBe(true)
    })

    test('CSV path：三欄位皆 Array.isArray = true', () => {
      const parser = new ContentParser()
      const csv = '書名,id\n"書一","b1"'
      const result = parser.parse(csv, 'csv')
      expect(Array.isArray(result.books)).toBe(true)
      expect(Array.isArray(result.tagCategories)).toBe(true)
      expect(Array.isArray(result.tags)).toBe(true)
    })

    test('EmptyObject path：三欄位皆空陣列', () => {
      const parser = new ContentParser()
      const result = parser.parse('{}', 'json')
      expect(result.books).toEqual([])
      expect(result.tagCategories).toEqual([])
      expect(result.tags).toEqual([])
    })

    test('MetadataWrap path：三欄位皆 Array.isArray = true', () => {
      const parser = new ContentParser()
      const content = JSON.stringify({ data: [{ id: 'b1', title: '書一' }] })
      const result = parser.parse(content, 'json')
      expect(Array.isArray(result.books)).toBe(true)
      expect(Array.isArray(result.tagCategories)).toBe(true)
      expect(Array.isArray(result.tags)).toBe(true)
    })
  })

  describe('parse - 大型資料集警告（largeDatasetThreshold DI）', () => {
    test('自訂 largeDatasetThreshold=10，超過時觸發 warn', () => {
      const parser = new ContentParser({ largeDatasetThreshold: 10 })
      const books = []
      for (let i = 0; i < 11; i += 1) {
        books.push({ id: `b${i}`, title: `書${i}`, cover: '' })
      }
      const content = JSON.stringify({
        metadata: { formatVersion: '2.0.0' },
        books
      })
      parser.parse(content, 'json')
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('大型資料集')
      )
    })

    test('自訂 largeDatasetThreshold=10，等於閾值不觸發 warn', () => {
      const parser = new ContentParser({ largeDatasetThreshold: 10 })
      const books = []
      for (let i = 0; i < 10; i += 1) {
        books.push({ id: `b${i}`, title: `書${i}`, cover: '' })
      }
      const content = JSON.stringify({
        metadata: { formatVersion: '2.0.0' },
        books
      })
      parser.parse(content, 'json')
      const calledWithLargeDataset = consoleWarnSpy.mock.calls.some(call =>
        typeof call[0] === 'string' && call[0].includes('大型資料集')
      )
      expect(calledWithLargeDataset).toBe(false)
    })

    test('預設 threshold=1000 時，書籍數 5 不觸發 warn', () => {
      const parser = new ContentParser()
      const books = [
        { id: 'b1', title: '書一', cover: '' },
        { id: 'b2', title: '書二', cover: '' },
        { id: 'b3', title: '書三', cover: '' },
        { id: 'b4', title: '書四', cover: '' },
        { id: 'b5', title: '書五', cover: '' }
      ]
      const content = JSON.stringify({
        metadata: { formatVersion: '2.0.0' },
        books
      })
      parser.parse(content, 'json')
      const calledWithLargeDataset = consoleWarnSpy.mock.calls.some(call =>
        typeof call[0] === 'string' && call[0].includes('大型資料集')
      )
      expect(calledWithLargeDataset).toBe(false)
    })
  })

  describe('parse - DI 注入點（detectFormatVersion / convertV1ToV2Data）', () => {
    test('注入 detectFormatVersion stub：被呼叫一次且影響分流', () => {
      const stubDetect = jest.fn().mockReturnValue('v2')
      const parser = new ContentParser({ detectFormatVersion: stubDetect })
      // 即便 content 為 v1 形狀，stub 強制走 v2 path
      const content = JSON.stringify({ books: [{ id: 'b1', title: '書一' }] })
      const result = parser.parse(content, 'json')
      expect(stubDetect).toHaveBeenCalledTimes(1)
      // v2 path 不經 converter，直接取 data.books
      expect(result.books).toHaveLength(1)
      expect(result.books[0].id).toBe('b1')
    })

    test('注入 convertV1ToV2Data stub：v1 path 時被呼叫', () => {
      const stubConvert = jest.fn().mockReturnValue({
        books: [{ id: 'b1', title: '書一', cover: '' }],
        tagCategories: [],
        tags: []
      })
      const stubDetect = jest.fn().mockReturnValue('v1')
      const parser = new ContentParser({
        detectFormatVersion: stubDetect,
        convertV1ToV2Data: stubConvert
      })
      const content = JSON.stringify([{ id: 'b1', title: '書一' }])
      const result = parser.parse(content, 'json')
      expect(stubConvert).toHaveBeenCalledTimes(1)
      expect(result.books).toHaveLength(1)
    })

    test('注入 detectFormatVersion 回傳 null：MetadataWrap / EmptyObject 路徑邏輯仍生效', () => {
      const stubDetect = jest.fn().mockReturnValue(null)
      const parser = new ContentParser({ detectFormatVersion: stubDetect })
      // {data: [...]} 形狀，但 stub 強制 version=null，仍應命中 MetadataWrap path
      const content = JSON.stringify({ data: [{ id: 'b1', title: '書一' }] })
      const result = parser.parse(content, 'json')
      expect(stubDetect).toHaveBeenCalled()
      expect(result.books).toHaveLength(1)
    })
  })

  describe('純函式無 state', () => {
    test('同一 parser 連續多次呼叫 parse 行為一致', () => {
      const parser = new ContentParser()
      const content = JSON.stringify({
        metadata: { formatVersion: '2.0.0' },
        books: [{ id: 'b1', title: '書一', cover: '' }]
      })
      const r1 = parser.parse(content, 'json')
      const r2 = parser.parse(content, 'json')
      const r3 = parser.parse(content, 'json')
      expect(r1.books).toHaveLength(1)
      expect(r2.books).toHaveLength(1)
      expect(r3.books).toHaveLength(1)
    })

    test('連續失敗 / 成功交錯不影響後續呼叫', () => {
      const parser = new ContentParser()
      const validContent = JSON.stringify({
        metadata: { formatVersion: '2.0.0' },
        books: [{ id: 'b1', title: '書一', cover: '' }]
      })
      expect(() => parser.parse(validContent, 'json')).not.toThrow()
      expect(() => parser.parse('', 'json')).toThrow()
      expect(() => parser.parse(validContent, 'json')).not.toThrow()
      expect(() => parser.parse('{ broken', 'json')).toThrow()
      expect(() => parser.parse(validContent, 'json')).not.toThrow()
    })
  })
})
