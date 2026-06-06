/**
 * Background Service Worker init 期間訊息緩衝 + init 後 flush 測試（0.20.0-W2-006.1）
 *
 * 涵蓋範圍（W2-006 方案 A）：
 * - init 期間（isInitialized=false）頂層 onMessage listener 緩衝業務訊息三元組
 *   （message / sender / sendResponse），而非立即回錯誤。
 * - initializeBackgroundSystem 完成後 flush 緩衝，逐一交 messageRouter.routeMessage。
 * - init 後新訊息由 MessageRouter 接手（頂層 listener 回傳 undefined 不攔截）。
 * - 緩衝上限 50 條 + overflow（第 51 條）回 OperationResult 失敗回應。
 *
 * 缺陷背景（W2-006 ANA）：
 *   W2-002 已將頂層 onMessage listener 同步註冊（MV3 鐵則），但 init 期間
 *   除 GET_SYSTEM_STATUS baseline 外的業務訊息直接回「系統初始化中」錯誤，
 *   而真正的訊息路由 listener 由 coordinator 內 MessageRouter 在 await init
 *   之後才註冊。SW 在 init await 期間被喚醒時，業務訊息漏接。本 ticket 在
 *   頂層 listener 補緩衝 + init 後 flush 補洞。
 *
 * 測試策略：
 *   - mock chrome.runtime.onMessage.addListener 捕捉頂層 listener function。
 *   - mock ./background-coordinator，其 initialize/start 用可控 deferred promise，
 *     模擬「init 期間」與「init 完成」兩個時點。
 *   - 在 init 期間呼叫捕捉到的 listener 注入業務訊息，斷言被緩衝（sendResponse
 *     未被立即呼叫、listener 回傳 true 保通道）。
 *   - resolve init deferred 後，斷言 messageRouter.routeMessage 被逐一呼叫且
 *     順序與緩衝一致。
 *   - 注入 51 條驗證 overflow 第 51 條回 OperationResult 失敗。
 *
 * 設計考量：background.js 是 side-effect entry script。無計時斷言
 * （遵 test-assertion-design-rules）；以 sendResponse / routeMessage 呼叫
 * 次數與參數作功能驗證。
 */

describe('Background SW init 期間訊息緩衝 + init 後 flush（W2-006 方案 A）', () => {
  let originalChrome
  let originalAddEventListener
  let consoleSpy
  let initDeferred
  let startDeferred
  let routeMessageSpy

  /**
   * 建立一個外部可控 resolve 的 deferred promise，模擬 coordinator init 時點。
   */
  function createDeferred () {
    let resolveFn
    const promise = new Promise((resolve) => { resolveFn = resolve })
    return { promise, resolve: resolveFn }
  }

  /**
   * 排空 microtask 佇列（jsdom 無 setImmediate）。
   * initializeBackgroundSystem 的 await 鏈 + flush 迴圈跨多輪 microtask，
   * 連續 await 數輪 Promise.resolve 確保全部排空。
   */
  async function flushPromises () {
    // flush 迴圈逐條 await routeMessage，50 條需足夠 microtask 輪數排空；
    // 多預留以涵蓋 initializeBackgroundSystem 的 await 鏈。
    for (let i = 0; i < 100; i++) {
      await Promise.resolve()
    }
  }

  /**
   * 取得頂層 onMessage listener function（W2-002 已同步註冊，require 後即可取得）。
   */
  function getTopLevelMessageListener () {
    const calls = globalThis.chrome.runtime.onMessage.addListener.mock.calls
    expect(calls.length).toBeGreaterThanOrEqual(1)
    return calls[0][0]
  }

  beforeEach(() => {
    jest.resetModules()

    consoleSpy = {
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
      log: jest.spyOn(console, 'log').mockImplementation(() => {})
    }

    originalChrome = globalThis.chrome
    globalThis.chrome = {
      runtime: {
        onInstalled: { addListener: jest.fn() },
        onStartup: { addListener: jest.fn() },
        onMessage: { addListener: jest.fn() }
      }
    }

    originalAddEventListener = globalThis.addEventListener
    globalThis.addEventListener = jest.fn()

    initDeferred = createDeferred()
    startDeferred = createDeferred()
    routeMessageSpy = jest.fn().mockResolvedValue(undefined)

    // mock coordinator：initialize/start 用可控 deferred，模擬 init 期間與完成兩時點。
    // 暴露 messageRouter.routeMessage 供 flush 呼叫。
    jest.doMock('src/background/background-coordinator', () => {
      return jest.fn().mockImplementation(() => ({
        initialize: jest.fn().mockReturnValue(initDeferred.promise),
        start: jest.fn().mockReturnValue(startDeferred.promise),
        getCoordinatorStats: jest.fn().mockReturnValue({
          moduleCount: 1,
          initializationDuration: 0,
          startupDuration: 0
        }),
        getAllModuleStatuses: jest.fn().mockReturnValue({}),
        eventBus: null,
        chromeBridge: null,
        messageRouter: {
          routeMessage: routeMessageSpy
        }
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

  test('init 期間業務訊息被緩衝（sendResponse 未被立即呼叫，listener 回傳 true 保通道）', () => {
    require('src/background/background')

    const listener = getTopLevelMessageListener()
    const sendResponse = jest.fn()

    // init deferred 尚未 resolve → 仍在 init 期間
    const ret = listener({ type: 'EXTRACT_BOOKS' }, { tab: { id: 7 } }, sendResponse)

    // 業務訊息應被緩衝：不立即回應、保持通道開啟
    expect(sendResponse).not.toHaveBeenCalled()
    expect(ret).toBe(true)
  })

  test('GET_SYSTEM_STATUS 在 init 期間仍回 baseline（不緩衝）', () => {
    require('src/background/background')

    const listener = getTopLevelMessageListener()
    const sendResponse = jest.fn()

    listener({ type: 'GET_SYSTEM_STATUS' }, {}, sendResponse)

    // 狀態查詢應即時回 baseline，不進緩衝
    expect(sendResponse).toHaveBeenCalledTimes(1)
    const response = sendResponse.mock.calls[0][0]
    expect(response.success).toBe(true)
    expect(response.data.mode).toBe('initializing')
  })

  test('init 完成後 flush 緩衝，逐一交 messageRouter.routeMessage（順序一致）', async () => {
    require('src/background/background')

    const listener = getTopLevelMessageListener()
    const sr1 = jest.fn()
    const sr2 = jest.fn()

    // init 期間緩衝兩條業務訊息
    listener({ type: 'EXTRACT_BOOKS' }, { tab: { id: 1 } }, sr1)
    listener({ type: 'GET_BOOKS' }, { tab: { id: 2 } }, sr2)

    expect(routeMessageSpy).not.toHaveBeenCalled()

    // 完成 init（resolve initialize + start），讓 initializeBackgroundSystem flush
    initDeferred.resolve()
    startDeferred.resolve()
    // 等 microtask 排空（initializeBackgroundSystem 的 await 鏈 + flush 迴圈）
    await flushPromises()

    // flush 應逐一交 routeMessage，順序與緩衝一致，三元組完整傳遞
    expect(routeMessageSpy).toHaveBeenCalledTimes(2)
    expect(routeMessageSpy.mock.calls[0][0]).toEqual({ type: 'EXTRACT_BOOKS' })
    expect(routeMessageSpy.mock.calls[0][1]).toEqual({ tab: { id: 1 } })
    expect(routeMessageSpy.mock.calls[0][2]).toBe(sr1)
    expect(routeMessageSpy.mock.calls[1][0]).toEqual({ type: 'GET_BOOKS' })
    expect(routeMessageSpy.mock.calls[1][2]).toBe(sr2)
  })

  test('init 完成後新訊息不再緩衝，頂層 listener 回 undefined 交 MessageRouter 接手', async () => {
    require('src/background/background')

    const listener = getTopLevelMessageListener()

    initDeferred.resolve()
    startDeferred.resolve()
    await flushPromises()

    const sendResponse = jest.fn()
    const ret = listener({ type: 'EXTRACT_BOOKS' }, { tab: { id: 9 } }, sendResponse)

    // init 後：頂層 listener 不攔截（回 undefined），交 coordinator 內 MessageRouter listener
    expect(ret).toBeUndefined()
    expect(sendResponse).not.toHaveBeenCalled()
    // flush 已處理完，init 後新訊息不應再被頂層 flush 機制路由
    expect(routeMessageSpy).not.toHaveBeenCalled()
  })

  test('緩衝達上限 50，第 51 條回 OperationResult 失敗回應（overflow 保護）', () => {
    require('src/background/background')

    const listener = getTopLevelMessageListener()

    // 注入 50 條（填滿緩衝），皆應被緩衝（不回應）
    for (let i = 0; i < 50; i++) {
      const sr = jest.fn()
      const ret = listener({ type: 'EXTRACT_BOOKS', seq: i }, { tab: { id: i } }, sr)
      expect(sr).not.toHaveBeenCalled()
      expect(ret).toBe(true)
    }

    // 第 51 條：overflow → 回 OperationResult 失敗回應
    const overflowResponse = jest.fn()
    const ret = listener({ type: 'EXTRACT_BOOKS', seq: 50 }, { tab: { id: 50 } }, overflowResponse)

    expect(ret).toBe(true)
    expect(overflowResponse).toHaveBeenCalledTimes(1)
    const response = overflowResponse.mock.calls[0][0]
    // OperationResult 失敗格式：success=false、含 error 物件（message + code）
    expect(response.success).toBe(false)
    expect(response.error).toBeDefined()
    expect(typeof response.error.message).toBe('string')
    expect(response.error.code).toBeDefined()
  })

  test('overflow 不影響已緩衝的 50 條於 init 後 flush', async () => {
    require('src/background/background')

    const listener = getTopLevelMessageListener()

    for (let i = 0; i < 50; i++) {
      listener({ type: 'EXTRACT_BOOKS', seq: i }, { tab: { id: i } }, jest.fn())
    }
    // 第 51 條 overflow（被拒）
    listener({ type: 'EXTRACT_BOOKS', seq: 50 }, { tab: { id: 50 } }, jest.fn())

    initDeferred.resolve()
    startDeferred.resolve()
    await flushPromises()

    // 僅前 50 條被 flush，overflow 的第 51 條不進緩衝
    expect(routeMessageSpy).toHaveBeenCalledTimes(50)
    expect(routeMessageSpy.mock.calls[0][0]).toEqual({ type: 'EXTRACT_BOOKS', seq: 0 })
    expect(routeMessageSpy.mock.calls[49][0]).toEqual({ type: 'EXTRACT_BOOKS', seq: 49 })
  })
})
