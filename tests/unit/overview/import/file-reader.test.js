/**
 * FileContentReader helper class 單元測試
 *
 * 對應 ticket: 0.19.0-W1-048.10.1.3
 *
 * 測試範圍（Phase 2 sage-test-architect 設計 ~15-20 case）：
 * - API 簽章與反向斷言
 * - constructor parser 必填（throw TypeError）
 * - read(file) 行為鏈：detectFormat → readerFactory → readAsText → onload → parser.parse → resolve
 * - FileReader 事件處理：onload 成功 / onerror 失敗 / parser 失敗
 * - DI 注入點：parser / detectFormat / readerFactory / showError
 * - detectFormat fallback（內建副檔名/MIME 判定）
 * - readerFactory 預設使用 globalThis.FileReader
 * - 連續呼叫獨立性
 *
 * 測試策略：
 * - parser stub（jest.fn）控制 parse 行為（成功 / 拋錯）
 * - readerFactory 注入 FakeFileReader（控制 onload / onerror 觸發時機）
 * - 不依賴真實 DOM FileReader（jsdom 仍可用，僅 fallback case 使用）
 *
 * 等價契約來源：src/overview/book-file-importer.js L208-312（_readFileWithReader 鏈）
 *
 * @jest-environment jsdom
 */

const { FileContentReader } = require('src/overview/import/file-reader')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')
const {
  createFakeFileReader,
  createStubReaderFactory,
  createStubParser
} = require('@tests/helpers/import-stub-helpers')

/**
 * 建立測試用 File 物件
 * @param {string} name - 檔名
 * @param {string} type - MIME type
 * @returns {File}
 */
function makeFile (name, type) {
  return new File(['x'], name, { type })
}

describe('FileContentReader', () => {
  describe('API 簽章與反向斷言', () => {
    test('FileContentReader 為 class，可被 new 實例化（parser 必填）', () => {
      expect(typeof FileContentReader).toBe('function')
      const parser = createStubParser()
      const instance = new FileContentReader({ parser })
      expect(instance).toBeInstanceOf(FileContentReader)
    })

    test('instance 暴露 read 方法且回傳 Promise', () => {
      const parser = createStubParser()
      const { factory, reader } = createStubReaderFactory()
      const instance = new FileContentReader({ parser, readerFactory: factory })
      expect(typeof instance.read).toBe('function')
      const file = makeFile('books.json', 'application/json')
      const result = instance.read(file)
      // 觸發 onload 才會 resolve，但呼叫即回傳 Promise
      expect(result).toBeInstanceOf(Promise)
      // cleanup
      reader._triggerLoad('{"books":[]}')
      return result
    })

    test('instance 不暴露舊底線方法（_readFileWithReader / _createFileReader / _setupReaderHandlers / _handleReaderSuccess / _handleReaderError / _handleFileProcessError）', () => {
      const parser = createStubParser()
      const instance = new FileContentReader({ parser })
      expect(instance._readFileWithReader).toBeUndefined()
      expect(instance._createFileReader).toBeUndefined()
      expect(instance._setupReaderHandlers).toBeUndefined()
      expect(instance._handleReaderSuccess).toBeUndefined()
      expect(instance._handleReaderError).toBeUndefined()
      expect(instance._handleFileProcessError).toBeUndefined()
    })
  })

  describe('constructor parser 必填', () => {
    test('未傳入 parser 拋出 TypeError', () => {
      expect(() => new FileContentReader({})).toThrow(TypeError)
    })

    test('parser 為 null 拋出 TypeError', () => {
      expect(() => new FileContentReader({ parser: null })).toThrow(TypeError)
    })

    test('parser 為 undefined 拋出 TypeError', () => {
      expect(() => new FileContentReader({ parser: undefined })).toThrow(TypeError)
    })

    test('完全未傳 deps 拋出 TypeError', () => {
      expect(() => new FileContentReader()).toThrow(TypeError)
    })
  })

  describe('read(file) - 成功路徑', () => {
    test('讀檔並解析成功時 resolve 為 parser.parse 回傳值', async () => {
      const expectedResult = {
        books: [{ id: 'b1', title: '書一' }],
        tagCategories: [],
        tags: []
      }
      const parser = createStubParser(expectedResult)
      const { factory, reader } = createStubReaderFactory()
      const instance = new FileContentReader({ parser, readerFactory: factory })

      const file = makeFile('books.json', 'application/json')
      const promise = instance.read(file)
      reader._triggerLoad('{"books":[{"id":"b1","title":"書一"}]}')

      await expect(promise).resolves.toEqual(expectedResult)
    })

    test('readAsText 被呼叫 1 次且參數為 file', async () => {
      const parser = createStubParser()
      const { factory, reader } = createStubReaderFactory()
      const instance = new FileContentReader({ parser, readerFactory: factory })

      const file = makeFile('books.json', 'application/json')
      const promise = instance.read(file)
      reader._triggerLoad('{}')
      await promise

      expect(reader.readAsText).toHaveBeenCalledTimes(1)
      expect(reader.readAsText.mock.calls[0][0]).toBe(file)
    })

    test('parser.parse 被呼叫一次且參數為 (content, fileFormat)', async () => {
      const parser = createStubParser()
      const { factory, reader } = createStubReaderFactory()
      const instance = new FileContentReader({ parser, readerFactory: factory })

      const file = makeFile('books.json', 'application/json')
      const content = '{"books":[]}'
      const promise = instance.read(file)
      reader._triggerLoad(content)
      await promise

      expect(parser.parse).toHaveBeenCalledTimes(1)
      expect(parser.parse).toHaveBeenCalledWith(content, 'json')
    })
  })

  describe('read(file) - detectFormat 注入', () => {
    test('注入 detectFormat 時被呼叫 1 次，parser.parse 第二參數為其回傳值', async () => {
      const parser = createStubParser()
      const detectFormat = jest.fn().mockReturnValue('json')
      const { factory, reader } = createStubReaderFactory()
      const instance = new FileContentReader({
        parser,
        readerFactory: factory,
        detectFormat
      })

      const file = makeFile('books.json', 'application/json')
      const promise = instance.read(file)
      reader._triggerLoad('{}')
      await promise

      expect(detectFormat).toHaveBeenCalledTimes(1)
      expect(detectFormat).toHaveBeenCalledWith(file)
      expect(parser.parse).toHaveBeenCalledWith('{}', 'json')
    })

    test('注入 detectFormat 回傳 "csv" 時 parser.parse 收到 "csv"', async () => {
      const parser = createStubParser()
      const detectFormat = jest.fn().mockReturnValue('csv')
      const { factory, reader } = createStubReaderFactory()
      const instance = new FileContentReader({
        parser,
        readerFactory: factory,
        detectFormat
      })

      const file = makeFile('books.csv', 'text/csv')
      const promise = instance.read(file)
      reader._triggerLoad('id,書名\n"b1","書一"')
      await promise

      expect(parser.parse).toHaveBeenCalledWith('id,書名\n"b1","書一"', 'csv')
    })

    test('不傳 detectFormat 時 fallback 用副檔名判定 .csv → "csv"', async () => {
      const parser = createStubParser()
      const { factory, reader } = createStubReaderFactory()
      const instance = new FileContentReader({ parser, readerFactory: factory })

      const file = makeFile('books.csv', 'text/csv')
      const promise = instance.read(file)
      reader._triggerLoad('id,書名\n"b1","書一"')
      await promise

      expect(parser.parse).toHaveBeenCalledWith('id,書名\n"b1","書一"', 'csv')
    })

    test('不傳 detectFormat 時 fallback 用副檔名判定 .json → "json"', async () => {
      const parser = createStubParser()
      const { factory, reader } = createStubReaderFactory()
      const instance = new FileContentReader({ parser, readerFactory: factory })

      const file = makeFile('books.json', 'application/json')
      const promise = instance.read(file)
      reader._triggerLoad('{}')
      await promise

      expect(parser.parse).toHaveBeenCalledWith('{}', 'json')
    })
  })

  describe('read(file) - onerror 失敗路徑', () => {
    test('FileReader.onerror 觸發時 reject 為 UNKNOWN_ERROR / category=general', async () => {
      const parser = createStubParser()
      const { factory, reader } = createStubReaderFactory()
      const instance = new FileContentReader({ parser, readerFactory: factory })

      const file = makeFile('books.json', 'application/json')
      const promise = instance.read(file)
      reader._triggerError()

      await expect(promise).rejects.toMatchObject({
        code: ErrorCodes.UNKNOWN_ERROR,
        details: { category: 'general' }
      })
    })

    test('onerror 觸發時呼叫注入的 showError（含「讀取檔案時發生錯誤」訊息）', async () => {
      const parser = createStubParser()
      const showError = jest.fn()
      const { factory, reader } = createStubReaderFactory()
      const instance = new FileContentReader({
        parser,
        readerFactory: factory,
        showError
      })

      const file = makeFile('books.json', 'application/json')
      const promise = instance.read(file)
      reader._triggerError()
      await promise.catch(() => {}) // swallow rejection

      expect(showError).toHaveBeenCalledWith('讀取檔案時發生錯誤')
    })

    test('onerror 觸發時 parser.parse 不被呼叫', async () => {
      const parser = createStubParser()
      const { factory, reader } = createStubReaderFactory()
      const instance = new FileContentReader({ parser, readerFactory: factory })

      const file = makeFile('books.json', 'application/json')
      const promise = instance.read(file)
      reader._triggerError()
      await promise.catch(() => {})

      expect(parser.parse).not.toHaveBeenCalled()
    })
  })

  describe('read(file) - parser 失敗透傳', () => {
    test('parser.parse 拋出 PARSE_ERROR 時 reject 為原 error（保留 code / details）', async () => {
      const parseError = new Error('JSON 檔案格式不正確')
      parseError.code = ErrorCodes.PARSE_ERROR
      parseError.details = { category: 'parsing' }
      const parser = {
        parse: jest.fn(() => { throw parseError })
      }
      const { factory, reader } = createStubReaderFactory()
      const instance = new FileContentReader({ parser, readerFactory: factory })

      const file = makeFile('books.json', 'application/json')
      const promise = instance.read(file)
      reader._triggerLoad('invalid json')

      await expect(promise).rejects.toBe(parseError)
    })

    test('parser.parse 失敗時呼叫 showError（含「載入檔案失敗：」前綴）', async () => {
      const parseError = new Error('JSON 檔案格式不正確')
      const parser = {
        parse: jest.fn(() => { throw parseError })
      }
      const showError = jest.fn()
      const { factory, reader } = createStubReaderFactory()
      const instance = new FileContentReader({
        parser,
        readerFactory: factory,
        showError
      })

      const file = makeFile('books.json', 'application/json')
      const promise = instance.read(file)
      reader._triggerLoad('invalid')
      await promise.catch(() => {})

      expect(showError).toHaveBeenCalledWith('載入檔案失敗：JSON 檔案格式不正確')
    })
  })

  describe('read(file) - readerFactory 預設（globalThis.FileReader fallback）', () => {
    test('不傳 readerFactory 時使用 globalThis.FileReader（jsdom 內建）', async () => {
      // 使用 jest spy 攔截 globalThis.FileReader 確認被建構
      const RealFileReader = globalThis.FileReader
      const constructorSpy = jest.fn()
      const fakeInstance = createFakeFileReader()
      globalThis.FileReader = jest.fn(function () {
        constructorSpy()
        Object.assign(this, fakeInstance)
        this._triggerLoad = fakeInstance._triggerLoad.bind(this)
        this._triggerError = fakeInstance._triggerError.bind(this)
      })

      try {
        const parser = createStubParser()
        const instance = new FileContentReader({ parser })

        const file = makeFile('books.json', 'application/json')
        const promise = instance.read(file)
        // 觸發 onload，但這次 reader instance 必須是 jsdom new 出來的
        // jest 的 mock constructor 已寫好屬性，因此直接取 mock.instances
        const constructedReader = globalThis.FileReader.mock.instances[0]
        constructedReader._triggerLoad('{}')
        await promise

        expect(constructorSpy).toHaveBeenCalled()
      } finally {
        globalThis.FileReader = RealFileReader
      }
    })
  })

  describe('read(file) - 連續呼叫獨立性', () => {
    test('同一 instance 連續 read 兩個不同 file 各自 resolve', async () => {
      const parser = createStubParser({ books: [], tagCategories: [], tags: [] })
      // factory 每次回傳新 reader，避免事件處理器互相干擾
      const factory = jest.fn(() => createFakeFileReader())
      const instance = new FileContentReader({ parser, readerFactory: factory })

      const file1 = makeFile('a.json', 'application/json')
      const file2 = makeFile('b.json', 'application/json')

      const p1 = instance.read(file1)
      const p2 = instance.read(file2)

      // 取回各自 reader instance（factory 為 jest.fn 可追蹤）
      const reader1 = factory.mock.results[0].value
      const reader2 = factory.mock.results[1].value

      reader1._triggerLoad('{"a":1}')
      reader2._triggerLoad('{"b":2}')

      await expect(p1).resolves.toBeDefined()
      await expect(p2).resolves.toBeDefined()
      expect(parser.parse).toHaveBeenCalledTimes(2)
    })
  })
})
