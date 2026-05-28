/**
 * Background Service Worker Local MessageDictionary 整合測試 (W1-110.1)
 *
 * 目的：驗證 src/background/background.js 切換為 local MessageDictionary 後，
 * 其 Logger 實例真正使用該 backgroundMessages local dict 渲染訊息文字，
 * 而非依賴 GlobalMessages 或回傳 `[Missing: KEY]`。
 *
 * 為何需要本測試（PC-165 防護）：
 * - 既有的 background-related unit tests（events / lifecycle / messaging）
 *   均聚焦於行為邏輯，不驗證 Logger 內部的 messages 字典渲染結果。
 * - 本測試刻意「不」mock Logger，使用真實 Logger + spy console，
 *   觀察渲染後輸出的訊息字串是否包含 backgroundMessages local dict
 *   定義的中文文字（而非 `[Missing: KEY]` 或 GlobalMessages 預設值），
 *   確保 local dict 在 SW runtime 真正生效。
 * - 此為 PC-165 三層防護中的 runtime 層驗證（unit test mock 層之外）。
 *
 * 邊界：本測試不涵蓋 Chrome Extension runtime（chrome-devtools-mcp），
 * 僅在 Jest jsdom 環境驗證「Logger constructor 第三參數 messages 確實
 * 被消費」，這是 W1-115 修復生效的必要條件。
 *
 * 設計挑戰：background.js 是 side-effect entry script（檔案載入即執行
 * `initializeBackgroundSystem()`），不能像 readmoo-adapter（factory 函式）
 * 直接 require 測試。本測試 mock chrome 與 ./background-coordinator
 * 後 require background.js，僅驗證 BACKGROUND_STARTUP 等啟動階段訊息
 * 的渲染結果。
 */

describe('Background Service Worker Local MessageDictionary (W1-110.1 PC-165 防護)', () => {
  let consoleSpy
  let originalChrome
  let originalAddEventListener

  beforeEach(() => {
    jest.resetModules()

    // 攔截 console 輸出以檢視 Logger 渲染後的訊息字串
    consoleSpy = {
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
      log: jest.spyOn(console, 'log').mockImplementation(() => {})
    }

    // mock chrome.runtime（background.js 頂層用到 chrome.runtime.onInstalled / onStartup）
    originalChrome = globalThis.chrome
    globalThis.chrome = {
      runtime: {
        onInstalled: { addListener: jest.fn() },
        onStartup: { addListener: jest.fn() },
        onMessage: { addListener: jest.fn() }
      }
    }

    // mock 全域 addEventListener（SW 環境，background.js 頂層註冊 error/unhandledrejection）
    originalAddEventListener = globalThis.addEventListener
    globalThis.addEventListener = jest.fn()

    // mock ./background-coordinator(避免動態 require 觸發整個初始化鏈)
    jest.doMock('src/background/background-coordinator', () => {
      return jest.fn().mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(undefined),
        start: jest.fn().mockResolvedValue(undefined),
        getCoordinatorStats: jest.fn().mockReturnValue({
          moduleCount: 0,
          initializationDuration: 0,
          startupDuration: 0
        }),
        getAllModuleStatuses: jest.fn().mockReturnValue({}),
        eventBus: null,
        chromeBridge: null
      }))
    })
  })

  afterEach(() => {
    consoleSpy.info.mockRestore()
    consoleSpy.warn.mockRestore()
    consoleSpy.error.mockRestore()
    consoleSpy.debug.mockRestore()
    consoleSpy.log.mockRestore()

    globalThis.chrome = originalChrome
    globalThis.addEventListener = originalAddEventListener
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
      ...consoleSpy.debug.mock.calls,
      ...consoleSpy.log.mock.calls
    ]
    return allCalls.map(args => args.join(' ')).join('\n')
  }

  test('background.js 載入時應渲染 BACKGROUND_STARTUP 為 local dict 中文文字', () => {
    // 載入 background.js（觸發 module-level log.info('BACKGROUND_STARTUP')）
    require('src/background/background')

    const output = collectAllConsoleOutput()

    // PC-165 防護核心斷言：
    // (a) BACKGROUND_STARTUP 仍以 messageKey 出現（Logger logEntry 序列化結果）
    // (b) 訊息文字應包含 backgroundMessages local dict 定義的中文「Readmoo 書庫提取器」
    // (c) 訊息文字「不」應為 [Missing: BACKGROUND_STARTUP]
    expect(output).toContain('BACKGROUND_STARTUP')
    expect(output).toContain('Readmoo 書庫提取器 Background Service Worker 啟動')
    expect(output).not.toContain('[Missing: BACKGROUND_STARTUP]')
  })

  test('background.js 載入時應渲染 INIT_ATTEMPT 為 local dict 中文文字（含 placeholder）', () => {
    // 載入 background.js,initializeBackgroundSystem() 進入 try 分支會觸發
    // log.info('INIT_ATTEMPT', { attempt: 1, max: 3 })
    require('src/background/background')

    const output = collectAllConsoleOutput()

    // PC-165 防護：INIT_ATTEMPT 為 backgroundMessages local dict 自有 key
    // 文字模板「🔧 開始初始化 Background 系統 (嘗試 {attempt}/{max})」
    // 渲染後 {attempt}/{max} 應替換為實際數值
    expect(output).toContain('INIT_ATTEMPT')
    expect(output).toContain('開始初始化 Background 系統')
    expect(output).toContain('嘗試 1/3')
    expect(output).not.toContain('[Missing: INIT_ATTEMPT]')
    // 確認非未替換的 placeholder 殘留
    expect(output).not.toContain('{attempt}')
    expect(output).not.toContain('{max}')
  })

  // 註: background.js 部分 log call 直接傳中文字串而非 messageKey
  // (如 line 369 `log.info('🏁 開始 Background Service Worker 初始化流程')`)
  // 此為既有問題,已建追蹤 ticket 0.19.0-W1-110.1.1 處理,不在本 ticket 範圍內。
  // 本測試聚焦驗證「Logger 第三參數 backgroundMessages 真正被消費」這個
  // W1-110.1 核心交付。後續 W1-110.1.1 修完傳字串問題後可擴增本測試
  // 涵蓋 INIT_FLOW_START / LIFECYCLE_COMPLETE / EMERGENCY_MODE 等 key。

  test('backgroundMessages local dict 不應汙染 GlobalMessages（隔離性驗證）', () => {
    const { GlobalMessages } = require('src/core/messages/MessageDictionary')

    // 載入 background.js 前先檢查 GlobalMessages 狀態
    const hadBackgroundStartupBefore = GlobalMessages.has('BACKGROUND_STARTUP')

    // 載入 background.js（觸發 backgroundMessages local dict 建構）
    require('src/background/background')

    // 隔離性驗證:W1-110.1 後 BACKGROUND_STARTUP 改由 backgroundMessages local dict
    // 擁有,不再透過 GlobalMessages.addMessages 動態註冊。
    // 故載入 background.js 後 GlobalMessages.has('BACKGROUND_STARTUP') 應保持
    // 載入前的狀態(若 W1-109 後 _loadDefaultMessages 已不含此 key,結果為 false)。
    const hasBackgroundStartupAfter = GlobalMessages.has('BACKGROUND_STARTUP')
    expect(hasBackgroundStartupAfter).toBe(hadBackgroundStartupBefore)

    // PC-165 核心隔離斷言:background.js 載入後 GlobalMessages 不應因 addMessages
    // 被動態擴充 27 個 background 專屬 key 之一。
    // 此處驗證 BACKGROUND_STARTUP 不存在於 GlobalMessages,證明 addMessages 已移除。
    expect(GlobalMessages.has('BACKGROUND_STARTUP')).toBe(false)
    expect(GlobalMessages.has('INIT_FLOW_START')).toBe(false)
    expect(GlobalMessages.has('EMERGENCY_MODE')).toBe(false)
  })
})
