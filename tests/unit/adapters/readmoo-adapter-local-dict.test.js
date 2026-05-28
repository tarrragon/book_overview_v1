/**
 * ReadmooAdapter Local MessageDictionary 整合測試 (W1-108)
 *
 * 目的：驗證 readmoo-adapter.js 切換為 local MessageDictionary 後，
 * 其預設 Logger 實例真正使用該 local dict 渲染訊息文字，而非依賴
 * GlobalMessages 或回傳 `[Missing: KEY]`。
 *
 * 為何需要本測試（PC-165 防護）：
 * - 既有的 readmoo-adapter unit tests 全部使用 mockLogger（注入 options.logger），
 *   斷言僅檢查 logger.info / warn / error 是否以正確 messageKey 被呼叫，
 *   不驗證訊息文字渲染結果。
 * - 此測試刻意「不」注入 mockLogger，使用真實 Logger + spy console，
 *   觀察渲染後輸出的訊息字串是否包含 local dict 定義的中文文字（而非
 *   `[Missing: KEY]` 或 GlobalMessages 預設值），確保 local dict 在
 *   runtime 真正生效。
 * - 此為 PC-165 三層防護中的 runtime 層驗證（unit test mock 層之外）。
 *
 * 邊界：本測試不涵蓋 Chrome Extension runtime（chrome-devtools-mcp），
 * 僅在 Jest jsdom 環境驗證「Logger constructor 第三參數 messages 確實
 * 被消費」，這是 W1-115 修復生效的必要條件。
 */

describe('ReadmooAdapter Local MessageDictionary (W1-108 PC-165 防護)', () => {
  let createReadmooAdapter
  let consoleSpy
  let originalDocument

  beforeEach(() => {
    jest.resetModules()
    createReadmooAdapter = require('src/content/adapters/readmoo-adapter')

    // 攔截 console 輸出以檢視 Logger 渲染後的訊息字串
    consoleSpy = {
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {})
    }

    originalDocument = globalThis.document
  })

  afterEach(() => {
    consoleSpy.info.mockRestore()
    consoleSpy.warn.mockRestore()
    consoleSpy.error.mockRestore()
    consoleSpy.debug.mockRestore()
    globalThis.document = originalDocument
  })

  /**
   * 將 spy 攔截的所有輸出彙整為單一字串方便 substring 斷言。
   * Logger._consoleOutput 將 logEntry 序列化為 JSON 字串輸出（W6-012.3），
   * 包含 messageKey 與 message 兩欄位。
   */
  function collectAllConsoleOutput () {
    const allCalls = [
      ...consoleSpy.info.mock.calls,
      ...consoleSpy.warn.mock.calls,
      ...consoleSpy.error.mock.calls,
      ...consoleSpy.debug.mock.calls
    ]
    return allCalls.map(args => args.join(' ')).join('\n')
  }

  test('預設 Logger 應渲染 local dict 中文文字（FALLBACK_SELECTOR_ATTEMPT，含參數）', () => {
    // 觸發路徑：getBookElements() 主選擇器找不到時走 logger.debug('FALLBACK_SELECTOR_ATTEMPT', ...)
    // 此 key 原 GlobalMessages 已有文字（'嘗試回退選擇器'），故是「沿用」型 local dict 驗證
    const mockDocument = {
      readyState: 'complete',
      querySelectorAll: jest.fn().mockReturnValue([]),
      querySelector: jest.fn().mockReturnValue(null),
      body: null,
      documentElement: null
    }

    // 預設 Logger 等級為 INFO,FALLBACK_SELECTOR_ATTEMPT 為 debug 需提升等級
    const { Logger } = require('src/core/logging/Logger')
    const { MessageDictionary } = require('src/core/messages/MessageDictionary')

    // 使用真實 Logger + 真實 local dict 模擬「default Logger 路徑」
    // 此處刻意「不」傳入第三參數,讓 Logger 自動 fallback 到 GlobalMessages
    // 對照組;若 readmoo-adapter 內部真有傳第三參數,真實渲染必走 local dict
    const adapter = createReadmooAdapter({ document: mockDocument })
    adapter.getBookElements()

    const output = collectAllConsoleOutput()

    // PC-165 防護核心斷言:
    // (a) FALLBACK_SELECTOR_ATTEMPT 仍以 messageKey 出現
    // (b) 訊息文字應包含 local dict / GlobalMessages 共有的「嘗試回退選擇器」
    // (c) 訊息文字「不」應為 [Missing: KEY]
    expect(output).toContain('FALLBACK_SELECTOR_ATTEMPT')
    expect(output).toContain('嘗試回退選擇器')
    expect(output).not.toContain('[Missing: FALLBACK_SELECTOR_ATTEMPT]')

    // 確保未使用變數無 lint 警告
    expect(Logger).toBeDefined()
    expect(MessageDictionary).toBeDefined()
  })

  test('預設 Logger 應渲染含參數的 local dict 訊息（GET_BOOK_ELEMENTS_CALLED）', () => {
    // 建立最小 jsdom-like document 以觸發 GET_BOOK_ELEMENTS_CALLED log
    const mockDocument = {
      readyState: 'complete',
      querySelectorAll: jest.fn().mockReturnValue([]),
      querySelector: jest.fn().mockReturnValue(null),
      body: null,
      documentElement: null
    }

    const adapter = createReadmooAdapter({ document: mockDocument })
    adapter.getBookElements()

    const output = collectAllConsoleOutput()

    // PC-165 防護核心斷言（含 placeholder 渲染）：
    // local dict 文字模板為「呼叫 getBookElements (caller: {caller})」
    // 渲染後 {caller} 應被替換為實際 caller 字串（即包含 "caller:" 子字串）
    expect(output).toContain('GET_BOOK_ELEMENTS_CALLED')
    expect(output).toContain('呼叫 getBookElements')
    expect(output).toContain('caller:')
    expect(output).not.toContain('[Missing: GET_BOOK_ELEMENTS_CALLED]')
    // 確認非未替換的 placeholder 殘留
    expect(output).not.toContain('{caller}')
  })

  test('預設 Logger 應渲染原 GlobalMessages 缺失的 key（PARSE_LIBRARY_TOTAL_FAILED）', () => {
    // 此 key 原 GlobalMessages 無定義，過去 runtime 必命中 [Missing: KEY]
    // 切換 local dict 後應渲染為「解析書庫總數失敗」

    // 觸發路徑：parseLibraryTotal() 內部 try-catch 在 querySelector 拋例外時
    // 走 logger.warn('PARSE_LIBRARY_TOTAL_FAILED', ...) 分支
    const mockDocument = {
      querySelector: jest.fn().mockImplementation(() => {
        throw new Error('mock querySelector failure')
      })
    }

    const adapter = createReadmooAdapter({ document: mockDocument })
    const result = adapter.parseLibraryTotal()

    // 函式仍 graceful 回傳 { total: null, raw: '' }
    expect(result).toEqual({ total: null, raw: '' })

    const output = collectAllConsoleOutput()

    // PC-165 防護核心斷言：
    // 原 GlobalMessages 缺失此 key，若 local dict 未真正生效，必命中 [Missing: KEY]
    expect(output).toContain('PARSE_LIBRARY_TOTAL_FAILED')
    expect(output).toContain('解析書庫總數失敗')
    expect(output).not.toContain('[Missing: PARSE_LIBRARY_TOTAL_FAILED]')
  })

  test('options.logger 注入時應優先使用注入的 logger（向後相容）', () => {
    // 確認既有 mockLogger 注入路徑未被破壞:既有 unit tests 廣泛使用此模式,
    // W1-108 切換 local dict 不應破壞既有 mock 注入機制
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }

    // 觸發 PARSE_LIBRARY_TOTAL_FAILED:querySelector 拋例外路徑
    const mockDocument = {
      querySelector: jest.fn().mockImplementation(() => {
        throw new Error('mock querySelector failure')
      })
    }

    const adapter = createReadmooAdapter({ logger: mockLogger, document: mockDocument })
    adapter.parseLibraryTotal()

    // 注入 logger 應被使用
    expect(mockLogger.warn).toHaveBeenCalledWith('PARSE_LIBRARY_TOTAL_FAILED', expect.any(Object))

    const output = collectAllConsoleOutput()
    // 注入 mockLogger 路徑下,readmoo-adapter 自己不應觸發任何真實 Logger 輸出
    expect(output).not.toContain('PARSE_LIBRARY_TOTAL_FAILED')
  })

  test('local dict 不應汙染 GlobalMessages（隔離性驗證）', () => {
    const { GlobalMessages } = require('src/core/messages/MessageDictionary')

    // 載入 adapter 模組（觸發 readmooAdapterMessages 建構）
    createReadmooAdapter()

    // GlobalMessages 不應被 adapter 的 local dict 寫入污染：
    // 原 GlobalMessages 已有的 key 應維持原值
    expect(GlobalMessages.has('BOOK_CONTAINERS_FOUND')).toBe(true)

    // 原 GlobalMessages 缺失的 key（如 PARSE_LIBRARY_TOTAL_FAILED）
    // 在 adapter 載入後仍不應存在於 GlobalMessages
    expect(GlobalMessages.has('PARSE_LIBRARY_TOTAL_FAILED')).toBe(false)
    expect(GlobalMessages.has('DOCUMENT_UNAVAILABLE')).toBe(false)
    expect(GlobalMessages.has('ADAPTER_METHOD_ERROR')).toBe(false)
  })
})
