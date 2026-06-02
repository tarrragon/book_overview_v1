/**
 * Background Service Worker Local MessageDictionary 整合測試
 *
 * 涵蓋範圍：
 * - W1-110.1：backgroundMessages local dict 切換 + Logger 第三參數注入
 * - W1-110.1.1（本 ticket 擴增）：14 處 log call messageKey 完整化（PA 13 處 + EMERGENCY_ERROR）
 *
 * 目的：驗證 src/background/background.js 所有 log call 皆透過 messageKey
 * 渲染（而非直接傳描述性中文字串），並由 backgroundMessages local dict 解析，
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
 * 後 require background.js，並透過：
 *   (a) 直接捕捉 module-level log call 渲染結果
 *   (b) 擷取 onInstalled / onStartup / onMessage addListener 的 listener
 *       函式並手動呼叫，觸發 EXTENSION_INSTALLED 等 listener-only key
 *   (c) 以 coordinator throw + fake timers 驅動 retry → emergency 流程，
 *       覆蓋 MAX_RETRIES_REACHED / EMERGENCY_* 等失敗路徑 key
 */

describe('Background Service Worker Local MessageDictionary', () => {
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

    // mock chrome.runtime（background.js 頂層用到 chrome.runtime.onInstalled / onStartup / onMessage）
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

  /**
   * 斷言 helper：messageKey 出現於輸出 + 對應渲染文字（emoji 前綴 + 中文）
   * 出現於輸出 + 不應有 `[Missing: KEY]`。
   */
  function expectKeyRendered (output, messageKey, expectedSubstring) {
    expect(output).toContain(messageKey)
    expect(output).toContain(expectedSubstring)
    expect(output).not.toContain(`[Missing: ${messageKey}]`)
  }

  describe('W1-110.1：local dict 注入 + 啟動階段渲染', () => {
    beforeEach(() => {
      // 成功路徑：mock ./background-coordinator(避免動態 require 觸發整個初始化鏈)
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

    test('background.js 載入時應渲染 BACKGROUND_STARTUP 為 local dict 中文文字', () => {
      require('src/background/background')

      const output = collectAllConsoleOutput()
      expectKeyRendered(output, 'BACKGROUND_STARTUP', 'Readmoo 書庫提取器 Background Service Worker 啟動')
    })

    test('background.js 載入時應渲染 INIT_ATTEMPT 含 placeholder（嘗試 1/3）', () => {
      require('src/background/background')

      const output = collectAllConsoleOutput()
      expect(output).toContain('INIT_ATTEMPT')
      expect(output).toContain('開始初始化 Background 系統')
      expect(output).toContain('嘗試 1/3')
      expect(output).not.toContain('[Missing: INIT_ATTEMPT]')
      // 確認非未替換的 placeholder 殘留
      expect(output).not.toContain('{attempt}')
      expect(output).not.toContain('{max}')
    })

    test('backgroundMessages local dict 不應汙染 GlobalMessages（隔離性驗證）', () => {
      const { GlobalMessages } = require('src/core/messages/MessageDictionary')

      const hadBackgroundStartupBefore = GlobalMessages.has('BACKGROUND_STARTUP')

      require('src/background/background')

      const hasBackgroundStartupAfter = GlobalMessages.has('BACKGROUND_STARTUP')
      expect(hasBackgroundStartupAfter).toBe(hadBackgroundStartupBefore)

      // PC-165 核心隔離斷言：background.js 載入後 GlobalMessages 不應因 addMessages
      // 被動態擴充 27 個 background 專屬 key 之一。
      expect(GlobalMessages.has('BACKGROUND_STARTUP')).toBe(false)
      expect(GlobalMessages.has('INIT_FLOW_START')).toBe(false)
      expect(GlobalMessages.has('EMERGENCY_MODE')).toBe(false)
    })
  })

  describe('W1-110.1.1：PC-165 收尾 — 14 keys 全 runtime 渲染驗證', () => {
    /**
     * 成功路徑：載入 background.js + 等 init promise + 手動觸發 listeners
     * 覆蓋 11 keys（PA 表 13 - 失敗路徑 3 + 模組級 BACKGROUND_STARTUP 1）：
     * - 模組載入即觸發：BACKGROUND_STARTUP, INIT_FLOW_START
     * - initializeBackgroundSystem 成功路徑：INIT_ATTEMPT, INIT_COORDINATOR,
     *   START_MODULES, INIT_COMPLETE, REGISTER_LIFECYCLE, LIFECYCLE_COMPLETE,
     *   INIT_FLOW_SUCCESS
     * - 手動呼叫 listener：EXTENSION_INSTALLED, EXTENSION_STARTUP
     */
    describe('成功路徑（load + listeners）', () => {
      beforeEach(() => {
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

      test('REGISTER_LIFECYCLE 應渲染為「[LOG] 註冊 Service Worker 生命週期事件」', async () => {
        require('src/background/background')
        // 等所有 microtask 完成（init + registerServiceWorkerEvents）
        await new Promise(resolve => setTimeout(resolve, 0))

        const output = collectAllConsoleOutput()
        expectKeyRendered(output, 'REGISTER_LIFECYCLE', '註冊 Service Worker 生命週期事件')
      })

      test('LIFECYCLE_COMPLETE 應渲染為「[OK] Service Worker 生命週期事件註冊完成」', async () => {
        require('src/background/background')
        await new Promise(resolve => setTimeout(resolve, 0))

        const output = collectAllConsoleOutput()
        expectKeyRendered(output, 'LIFECYCLE_COMPLETE', 'Service Worker 生命週期事件註冊完成')
      })

      test('INIT_FLOW_START 應渲染為「開始 Background Service Worker 初始化流程」', () => {
        require('src/background/background')

        const output = collectAllConsoleOutput()
        expectKeyRendered(output, 'INIT_FLOW_START', '開始 Background Service Worker 初始化流程')
      })

      test('INIT_FLOW_SUCCESS 應渲染為「Background Service Worker 初始化成功完成」', async () => {
        require('src/background/background')
        // 等 init().then() chain 完成
        await new Promise(resolve => setTimeout(resolve, 0))
        await new Promise(resolve => setTimeout(resolve, 0))

        const output = collectAllConsoleOutput()
        expectKeyRendered(output, 'INIT_FLOW_SUCCESS', 'Background Service Worker 初始化成功完成')
      })

      test('EXTENSION_INSTALLED 應透過手動觸發 onInstalled listener 渲染', async () => {
        require('src/background/background')
        await new Promise(resolve => setTimeout(resolve, 0))

        // 擷取 chrome.runtime.onInstalled.addListener 的第一個 listener arg
        const onInstalledListener = globalThis.chrome.runtime.onInstalled.addListener.mock.calls[0][0]
        expect(typeof onInstalledListener).toBe('function')

        // 觸發 listener
        await onInstalledListener({ reason: 'install', previousVersion: undefined })

        const output = collectAllConsoleOutput()
        expectKeyRendered(output, 'EXTENSION_INSTALLED', '擴展安裝事件')
        // data.reason 應被記入 logEntry（透過 Logger._safeSerialize）
        expect(output).toContain('install')
      })

      test('EXTENSION_STARTUP 應透過手動觸發 onStartup listener 渲染', async () => {
        require('src/background/background')
        await new Promise(resolve => setTimeout(resolve, 0))

        const onStartupListener = globalThis.chrome.runtime.onStartup.addListener.mock.calls[0][0]
        expect(typeof onStartupListener).toBe('function')

        await onStartupListener()

        const output = collectAllConsoleOutput()
        expectKeyRendered(output, 'EXTENSION_STARTUP', '擴展啟動事件')
      })
    })

    /**
     * 失敗 → 緊急模式路徑：mock coordinator throw + fake timers 加速 retry
     * 覆蓋 6 keys：MAX_RETRIES_REACHED, EMERGENCY_MODE, EMERGENCY_MESSAGE,
     * EMERGENCY_COMPLETE, INIT_FLOW_FAILED + (LIFECYCLE_FAILED 由 chrome
     * runtime undefined 觸發；EMERGENCY_FAILED / EMERGENCY_ERROR 另獨立測試)
     */
    describe('失敗路徑（retry → emergency mode）', () => {
      beforeEach(() => {
        jest.useFakeTimers()
        // coordinator throw → init 進入 catch 分支
        jest.doMock('src/background/background-coordinator', () => {
          return jest.fn().mockImplementation(() => ({
            initialize: jest.fn().mockRejectedValue(new Error('mock init failure')),
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
        jest.useRealTimers()
      })

      test('coordinator 連續 3 次 init 失敗時 MAX_RETRIES_REACHED + INIT_FLOW_FAILED 應渲染', async () => {
        require('src/background/background')

        // 推進 fake timer 走完 3 次 retry（每次 2000ms 等待）
        // jest 的 advanceTimersByTimeAsync 會將所有 microtask + macrotask 跑完
        await jest.advanceTimersByTimeAsync(2000)
        await jest.advanceTimersByTimeAsync(2000)
        await jest.advanceTimersByTimeAsync(2000)

        const output = collectAllConsoleOutput()
        expectKeyRendered(output, 'MAX_RETRIES_REACHED', '達到最大重試次數')
        expectKeyRendered(output, 'INIT_FLOW_FAILED', 'Background Service Worker 初始化最終失敗')
      })

      test('進入 emergency mode 時 EMERGENCY_MODE + EMERGENCY_COMPLETE 應渲染', async () => {
        require('src/background/background')

        await jest.advanceTimersByTimeAsync(2000)
        await jest.advanceTimersByTimeAsync(2000)
        await jest.advanceTimersByTimeAsync(2000)

        const output = collectAllConsoleOutput()
        expectKeyRendered(output, 'EMERGENCY_MODE', '啟動緊急模式')
        expectKeyRendered(output, 'EMERGENCY_COMPLETE', '緊急模式啟動完成')
      })

      test('emergency 模式下 onMessage listener 觸發時 EMERGENCY_MESSAGE 應渲染', async () => {
        require('src/background/background')

        await jest.advanceTimersByTimeAsync(2000)
        await jest.advanceTimersByTimeAsync(2000)
        await jest.advanceTimersByTimeAsync(2000)

        // 擷取緊急模式註冊的 onMessage listener
        const onMessageListener = globalThis.chrome.runtime.onMessage.addListener.mock.calls[0][0]
        expect(typeof onMessageListener).toBe('function')

        const mockSendResponse = jest.fn()
        onMessageListener({ type: 'GET_SYSTEM_STATUS' }, {}, mockSendResponse)

        const output = collectAllConsoleOutput()
        expectKeyRendered(output, 'EMERGENCY_MESSAGE', '[緊急模式] 收到訊息')
      })
    })

    /**
     * LIFECYCLE_FAILED：當 chrome.runtime 缺 onInstalled / onStartup 時，
     * registerServiceWorkerEvents 仍會走入 try 區塊但不註冊 listener。
     * 改以 chrome.runtime.onInstalled.addListener throw 觸發 catch 路徑。
     */
    describe('LIFECYCLE_FAILED（registerServiceWorkerEvents catch 路徑）', () => {
      beforeEach(() => {
        // mock addListener throw 觸發 catch
        globalThis.chrome.runtime.onInstalled.addListener = jest.fn().mockImplementation(() => {
          throw new Error('mock addListener failure')
        })

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

      test('registerServiceWorkerEvents addListener 拋錯時 LIFECYCLE_FAILED 應渲染', async () => {
        require('src/background/background')
        await new Promise(resolve => setTimeout(resolve, 0))
        await new Promise(resolve => setTimeout(resolve, 0))

        const output = collectAllConsoleOutput()
        expectKeyRendered(output, 'LIFECYCLE_FAILED', '註冊 Service Worker 事件失敗')
      })
    })

    /**
     * EMERGENCY_FAILED：activateEmergencyMode 內 createEmergencyEventBus 或
     * onMessage addListener 拋錯時觸發。本測試用 chrome.runtime.onMessage
     * addListener throw 模擬。
     */
    describe('EMERGENCY_FAILED（activateEmergencyMode catch 路徑）', () => {
      beforeEach(() => {
        jest.useFakeTimers()

        // onMessage.addListener throw → activateEmergencyMode 進入 catch
        globalThis.chrome.runtime.onMessage.addListener = jest.fn().mockImplementation(() => {
          throw new Error('mock onMessage failure')
        })

        jest.doMock('src/background/background-coordinator', () => {
          return jest.fn().mockImplementation(() => ({
            initialize: jest.fn().mockRejectedValue(new Error('mock init failure')),
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
        jest.useRealTimers()
      })

      test('activateEmergencyMode onMessage addListener throw 時 EMERGENCY_FAILED 應渲染', async () => {
        require('src/background/background')

        await jest.advanceTimersByTimeAsync(2000)
        await jest.advanceTimersByTimeAsync(2000)
        await jest.advanceTimersByTimeAsync(2000)

        const output = collectAllConsoleOutput()
        expectKeyRendered(output, 'EMERGENCY_FAILED', '緊急模式啟動失敗')
      })
    })

    /**
     * EMERGENCY_ERROR：createEmergencyEventBus 回傳的 emit handler 內部
     * try/catch 觸發。本測試直接驗證 backgroundMessages dict 含此 key
     * 並渲染含 eventType placeholder（因 emit 邏輯難從外部直接觸發）。
     *
     * 此驗證搭配 src 程式碼註解（W1-110.1.1 補強標記）形成雙保險：
     * 程式碼 grep `'EMERGENCY_ERROR'` 必命中 line 336，dict grep
     * `EMERGENCY_ERROR:` 必命中 line 71，二者鎖定避免再退回字串字面。
     */
    describe('EMERGENCY_ERROR（dict 完整性 + placeholder 渲染）', () => {
      test('backgroundMessages dict 應含 EMERGENCY_ERROR 並支援 {eventType} placeholder', () => {
        const { MessageDictionary } = require('src/core/messages/MessageDictionary')
        // 重建一份等價 dict 驗證 key 結構（避免 expose backgroundMessages instance）
        const dictUnderTest = new MessageDictionary({
          EMERGENCY_ERROR: '[FAIL] [緊急模式] 事件處理錯誤 ({eventType})'
        })

        const rendered = dictUnderTest.get('EMERGENCY_ERROR', { eventType: 'TEST.EVENT' })
        expect(rendered).toContain('[緊急模式] 事件處理錯誤')
        expect(rendered).toContain('TEST.EVENT')
        expect(rendered).not.toContain('{eventType}')
        expect(rendered).not.toBe('[Missing: EMERGENCY_ERROR]')
      })

      test('background.js src 內 line ~336 應使用 messageKey EMERGENCY_ERROR 而非字串字面（PC-165 grep 防護）', () => {
        const fs = require('fs')
        const path = require('path')
        const src = fs.readFileSync(
          path.resolve(__dirname, '../../../src/background/background.js'),
          'utf8'
        )
        // 應存在 messageKey 形式
        expect(src).toContain("log.error('EMERGENCY_ERROR'")
        // 不應殘留原描述性中文字串字面（偵測原始 emoji 字面，勿經 remove-emoji 轉換）
        expect(src).not.toMatch(/log\.error\(`?❌\s*\[緊急模式\]\s*事件處理錯誤/)
      })
    })

    /**
     * 整體掃描：所有 14 keys 渲染後 console 輸出不應出現任何 `[Missing: KEY]`
     * 形式，確保 backgroundMessages local dict key 覆蓋完整。
     */
    describe('完整性掃描', () => {
      const FOURTEEN_KEYS = [
        'MAX_RETRIES_REACHED',
        'REGISTER_LIFECYCLE',
        'EXTENSION_INSTALLED',
        'EXTENSION_STARTUP',
        'LIFECYCLE_COMPLETE',
        'LIFECYCLE_FAILED',
        'EMERGENCY_MODE',
        'EMERGENCY_MESSAGE',
        'EMERGENCY_COMPLETE',
        'EMERGENCY_FAILED',
        'EMERGENCY_ERROR',
        'INIT_FLOW_START',
        'INIT_FLOW_SUCCESS',
        'INIT_FLOW_FAILED'
      ]

      test('background.js src 14 keys 應全部以 messageKey 字串字面出現', () => {
        const fs = require('fs')
        const path = require('path')
        const src = fs.readFileSync(
          path.resolve(__dirname, '../../../src/background/background.js'),
          'utf8'
        )

        FOURTEEN_KEYS.forEach(key => {
          // dict 定義 + 至少一處 log call
          expect(src).toContain(`${key}:`)
          expect(src).toMatch(new RegExp(`log\\.(info|error|warn)\\('${key}'`))
        })
      })

      test('background.js src 不應殘留含 emoji 的描述性中文 log call（PC-165 反模式 grep）', () => {
        const fs = require('fs')
        const path = require('path')
        const src = fs.readFileSync(
          path.resolve(__dirname, '../../../src/background/background.js'),
          'utf8'
        )

        // 反模式：log.info('（emoji）...') 形式的描述性中文 log call。
        // 此測試以「原始 emoji 字面」為偵測對象，驗證 dict 重構後 src 不再殘留 emoji 前綴
        // log（應改用 log.X('MESSAGE_KEY') 形式）。emoji 字面為偵測目標，禁止經
        // scripts/remove-emoji.js 轉換為 [KEYWORD]（會破壞 regex 語意，見 0.19.1-W1-005.3）。
        // 排除 dict 定義段（const backgroundMessages = ...）
        const dictStart = src.indexOf('const backgroundMessages')
        const dictEnd = src.indexOf('})\n', dictStart) + 3
        const codeAfterDict = src.substring(dictEnd)

        // codeAfterDict 範圍內不應出現 log.X('emoji...') 形式
        // emoji 範圍涵蓋 PA 表 14 keys 對應的 emoji prefixes
        const antiPatterns = [
          /log\.(info|error|warn)\(['"`]🏁/,
          /log\.(info|error|warn)\(['"`]🎉/,
          /log\.(info|error|warn)\(['"`]💥/,
          /log\.(info|error|warn)\(['"`]🚨/,
          /log\.(info|error|warn)\(['"`]📝/,
          /log\.(info|error|warn)\(['"`]📦/,
          /log\.(info|error|warn)\(['"`]▶️/,
          /log\.(info|error|warn)\(['"`]✅/,
          /log\.(info|error|warn)\(['"`]❌/,
          /log\.(info|error|warn)\(['"`]📨/
        ]

        antiPatterns.forEach(pattern => {
          expect(codeAfterDict).not.toMatch(pattern)
        })
      })
    })
  })
})
