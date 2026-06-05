/**
 * Background Service Worker Listener 同步註冊時機測試（0.20.0-W2-002）
 *
 * 涵蓋範圍：
 * - MV3 鐵則：事件 listener 必須在 SW 模組求值的「同步階段」就 addListener，
 *   禁止在 async 函式中、多個 await 之後才延遲註冊。
 *
 * 缺陷背景（MV3 多視角審查 Q1 發現，2026-06-05）：
 *   原 background.js 將 onInstalled / onStartup 的 addListener 包在
 *   registerServiceWorkerEvents() 內，而該函式於 initializeBackgroundSystem()
 *   的 `await coordinator.initialize()` / `await coordinator.start()` 多個
 *   await 之後（約行 188）才被呼叫。MV3 service worker 非持久，SW 在某 await
 *   期間被喚醒/重啟時，事件可能在 listener 註冊前派發 → 靜默漏接。
 *   onMessage 過去僅在 emergency 模式註冊，正常路徑下完全沒有 onMessage listener。
 *
 * 測試策略：
 *   require('src/background/background') 後「不等任何 async」（不 await、不推進
 *   timer），立即斷言 chrome.runtime.onInstalled / onStartup / onMessage 的
 *   addListener 已被呼叫。若 listener 仍藏在 await 之後註冊，require 當下
 *   addListener.mock.calls 為空 → 測試 RED。
 *
 * 設計考量：background.js 是 side-effect entry script（檔案載入即執行
 * initializeBackgroundSystem()）。mock chrome 與 ./background-coordinator
 * 後 require，並在「同步階段」檢查 addListener 呼叫次數，這是 MV3 listener
 * 同步註冊的唯一可靠驗證點。
 */

describe('Background SW listener 同步註冊時機（MV3 鐵則）', () => {
  let originalChrome
  let originalAddEventListener
  let consoleSpy

  beforeEach(() => {
    jest.resetModules()

    // 靜音 console（background.js 載入即輸出大量 log）
    consoleSpy = {
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
      log: jest.spyOn(console, 'log').mockImplementation(() => {})
    }

    // mock chrome.runtime（三個生命週期事件入口）
    originalChrome = globalThis.chrome
    globalThis.chrome = {
      runtime: {
        onInstalled: { addListener: jest.fn() },
        onStartup: { addListener: jest.fn() },
        onMessage: { addListener: jest.fn() }
      }
    }

    // mock SW 環境的全域 addEventListener（error / unhandledrejection）
    originalAddEventListener = globalThis.addEventListener
    globalThis.addEventListener = jest.fn()

    // mock coordinator：initialize/start 用「永不 resolve」的 pending promise，
    // 模擬「SW 仍卡在 init 的 await 期間」。若 listener 須等 init 完成才註冊，
    // 此情境下 addListener 將永遠不會被呼叫 → 凸顯缺陷。
    jest.doMock('src/background/background-coordinator', () => {
      return jest.fn().mockImplementation(() => ({
        initialize: jest.fn().mockReturnValue(new Promise(() => {})), // 永不 resolve
        start: jest.fn().mockReturnValue(new Promise(() => {})),
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

  test('require 後同步階段 onInstalled listener 已註冊（不等任何 async）', () => {
    require('src/background/background')

    // 關鍵：不 await、不推進 timer，立即檢查
    expect(globalThis.chrome.runtime.onInstalled.addListener).toHaveBeenCalledTimes(1)
    expect(typeof globalThis.chrome.runtime.onInstalled.addListener.mock.calls[0][0]).toBe('function')
  })

  test('require 後同步階段 onStartup listener 已註冊（不等任何 async）', () => {
    require('src/background/background')

    expect(globalThis.chrome.runtime.onStartup.addListener).toHaveBeenCalledTimes(1)
    expect(typeof globalThis.chrome.runtime.onStartup.addListener.mock.calls[0][0]).toBe('function')
  })

  test('require 後同步階段 onMessage listener 已註冊（不等任何 async）', () => {
    require('src/background/background')

    expect(globalThis.chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1)
    expect(typeof globalThis.chrome.runtime.onMessage.addListener.mock.calls[0][0]).toBe('function')
  })

  test('coordinator init 永遠 pending 時三個 listener 仍已同步註冊（漏接防護）', () => {
    require('src/background/background')

    // init promise 永不 resolve，模擬 SW 卡在 await 期間。
    // 若 listener 註冊綁定在 init 完成之後，此處三者皆為 0 → RED。
    expect(globalThis.chrome.runtime.onInstalled.addListener).toHaveBeenCalledTimes(1)
    expect(globalThis.chrome.runtime.onStartup.addListener).toHaveBeenCalledTimes(1)
    expect(globalThis.chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1)
  })
})
