/**
 * 匯入流程測試共用 stub helpers
 *
 * 對應 ticket: 0.19.0-W1-048.10.1.3（W1-048.10.1 SOLID 拆分第 3 個 sub-IMP）
 *
 * 負責功能：
 * - 提供四個 factory functions：FakeFileReader / StubReaderFactory /
 *   StubParser / StubValidator，供 sub-IMP 10.1.3 / 10.1.4 共用維護
 * - 集中 stub 邏輯，避免散落於各測試檔內重複定義
 *
 * 設計考量：
 * - 預設行為合理（多數 case 直接呼叫無參數即可）
 * - overrides 參數允許局部覆寫（自訂 hook）
 * - 回傳物件解構導向（const { factory, reader } = ...）
 * - 全部使用 jest.fn() 以利斷言被呼叫次數
 *
 * 介面契約：
 * - FakeFileReader 暴露 _triggerLoad(content) / _triggerError(err?) 控制事件觸發時機
 * - StubReaderFactory 回傳 { factory, reader }，factory 為 jest.fn 每次呼叫回傳同一 reader
 * - StubParser.parse 為 jest.fn().mockReturnValue(...)
 * - StubValidator 暴露 validate (jest.fn) 與 detectFormat (jest.fn.mockReturnValue)
 */

/**
 * 建立 fake FileReader 實例（不依賴 DOM）
 *
 * 暴露的測試控制介面：
 * - _triggerLoad(content): 模擬 onload 事件，回傳 { target: this } event 物件
 * - _triggerError(err?): 模擬 onerror 事件，預設 err 為 new Error('read failed')
 *
 * @returns {{
 *   readAsText: jest.Mock,
 *   onload: ?Function,
 *   onerror: ?Function,
 *   result: ?string,
 *   _triggerLoad: (content: string) => void,
 *   _triggerError: (err?: Error) => void
 * }}
 */
function createFakeFileReader () {
  const fr = {
    readAsText: jest.fn(),
    onload: null,
    onerror: null,
    result: null
  }
  fr._triggerLoad = function (content) {
    this.result = content
    if (typeof this.onload === 'function') {
      this.onload({ target: this })
    }
  }
  fr._triggerError = function (err) {
    if (typeof this.onerror === 'function') {
      this.onerror(err || new Error('read failed'))
    }
  }
  return fr
}

/**
 * 建立 stub reader factory（注入 FileContentReader deps.readerFactory）
 *
 * 預設行為：factory 每次呼叫回傳同一 FakeFileReader 實例（簡化單檔測試）。
 * 若需多 reader 隔離（例如連續呼叫獨立 case），自行在測試內 new factory。
 *
 * @param {Object} [overrides] - 覆蓋 reader 屬性（例如 readAsText 自訂 jest.fn）
 * @returns {{ factory: jest.Mock, reader: ReturnType<typeof createFakeFileReader> }}
 */
function createStubReaderFactory (overrides = {}) {
  const reader = createFakeFileReader()
  Object.assign(reader, overrides)
  const factory = jest.fn(() => reader)
  return { factory, reader }
}

/**
 * 建立 stub parser（注入 FileContentReader deps.parser）
 *
 * 介面對齊 ContentParser.parse(content, fileFormat) → ImportResult。
 * 預設回傳 { books: [], tagCategories: [], tags: [] }。
 *
 * @param {Object} [returnValue] - 自訂 parse 回傳值
 * @returns {{ parse: jest.Mock }}
 */
function createStubParser (returnValue) {
  const defaultResult = { books: [], tagCategories: [], tags: [] }
  const parse = jest.fn().mockReturnValue(returnValue === undefined ? defaultResult : returnValue)
  return { parse }
}

/**
 * 建立 stub validator（注入 FileContentReader deps.detectFormat 或上層 importer.validator）
 *
 * 介面對齊 FileValidator.detectFormat(file) → 'json'|'csv'|null。
 * 預設 detectFormat 回傳 'json'。
 *
 * @param {'json'|'csv'|null} [detectFormatReturn='json'] - 自訂 detectFormat 回傳值
 * @returns {{ validate: jest.Mock, detectFormat: jest.Mock }}
 */
function createStubValidator (detectFormatReturn = 'json') {
  const validate = jest.fn()
  const detectFormat = jest.fn().mockReturnValue(detectFormatReturn)
  return { validate, detectFormat }
}

module.exports = {
  createFakeFileReader,
  createStubReaderFactory,
  createStubParser,
  createStubValidator
}
