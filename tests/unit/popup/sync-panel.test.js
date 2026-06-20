/**
 * 群組 G：同步面板 UI 互動測試（SyncPanel，整合測試）
 *
 * 範圍（ticket 1.2.0-W1-001 Phase 2 群組 G）：
 * - 場景 N11：完整同步 Happy Path（讀書庫 → encoder → renderer.start）
 * - 場景 E1-UI：空書庫顯示提示，不啟動 renderer
 * - 場景 E2-UI：壓縮失敗顯示錯誤 + Logger.error
 * - 場景 E7：書庫讀取失敗顯示錯誤 + Logger.error
 * - 場景 I1：使用者中途停止 → renderer.stop + UI 回初始狀態
 * - 場景 I2：循環播放完成 → 顯示重新播放提示
 *
 * Mock 策略（Phase 2 測試設計）：Mock qr-encoder（encodeBookDataToQRFrames）
 * 與 SyncQRRenderer，隔離 encoder/renderer 內部行為，專注驗證 UI 互動與
 * 流程編排。chrome.storage.local.get 以 promise-style mock 覆寫測試環境
 * 預設 callback 行為。
 *
 * 註：以呼叫次數與 UI 狀態旗標驗證，不使用計時門檻斷言
 * （test-assertion-design-rules）。
 */

'use strict'

jest.mock('src/sync/qr-encoder', () => ({
  encodeBookDataToQRFrames: jest.fn()
}))

jest.mock('src/popup/services/sync-qr-renderer', () => ({
  SyncQRRenderer: jest.fn()
}))

const { SyncPanel } = require('src/popup/components/sync-panel')
const { encodeBookDataToQRFrames } = require('src/sync/qr-encoder')
const { SyncQRRenderer } = require('src/popup/services/sync-qr-renderer')

function createElement () {
  return {
    style: { display: '' },
    textContent: '',
    _handlers: {},
    addEventListener (event, handler) { this._handlers[event] = handler },
    click () { if (this._handlers.click) return this._handlers.click() }
  }
}

function createElements () {
  return {
    syncContainer: createElement(),
    qrCanvas: createElement(),
    syncStatus: createElement(),
    syncButton: createElement(),
    stopButton: createElement()
  }
}

function mockStorageBooks (books) {
  chrome.storage.local.get = jest.fn(async () => ({ readmoo_books: { books } }))
}

describe('SyncPanel', () => {
  let elements
  let panel
  let rendererInstance
  let loggerErrorSpy
  let capturedOnComplete

  beforeEach(async () => {
    loggerErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    rendererInstance = {
      start: jest.fn(),
      stop: jest.fn()
    }
    SyncQRRenderer.mockImplementation((canvas, options) => {
      capturedOnComplete = options.onComplete
      return rendererInstance
    })

    encodeBookDataToQRFrames.mockReset()

    elements = createElements()
    panel = new SyncPanel(elements)
    await panel.initialize()
  })

  afterEach(() => {
    loggerErrorSpy.mockRestore()
  })

  test('場景 N11：完整同步 Happy Path（讀書庫 → encoder → renderer.start）', async () => {
    mockStorageBooks([{ id: 'b1', title: '書1' }, { id: 'b2', title: '書2' }])
    encodeBookDataToQRFrames.mockResolvedValue({
      frames: [{}, {}, {}],
      totalSize: 2000,
      isStatic: false
    })

    // 前置驗證：syncButton 已綁定 click handler
    expect(typeof elements.syncButton._handlers.click).toBe('function')

    await elements.syncButton.click()

    expect(encodeBookDataToQRFrames).toHaveBeenCalledTimes(1)
    expect(rendererInstance.start).toHaveBeenCalledWith([{}, {}, {}], false)
    expect(elements.qrCanvas.style.display).toBe('block')
    expect(elements.stopButton.style.display).toBe('inline-block')
    expect(elements.syncStatus.textContent).toContain('3 幀')
  })

  test('場景 N11-靜態：單張 QR 不顯示幀數計數', async () => {
    mockStorageBooks([{ id: 'b1', title: '書1' }])
    encodeBookDataToQRFrames.mockResolvedValue({
      frames: [{}],
      totalSize: 400,
      isStatic: true
    })

    await elements.syncButton.click()

    expect(rendererInstance.start).toHaveBeenCalledWith([{}], true)
    expect(elements.syncStatus.textContent).toContain('單張 QR')
  })

  test('場景 E1-UI：空書庫顯示提示且不啟動 renderer', async () => {
    mockStorageBooks([])

    await elements.syncButton.click()

    expect(encodeBookDataToQRFrames).not.toHaveBeenCalled()
    expect(rendererInstance.start).not.toHaveBeenCalled()
    expect(elements.syncStatus.textContent).toContain('沒有書籍')
    expect(elements.qrCanvas.style.display).toBe('none')
  })

  test('場景 E2-UI：壓縮失敗顯示錯誤並記錄 Logger.error', async () => {
    mockStorageBooks([{ id: 'b1', title: '書1' }])
    encodeBookDataToQRFrames.mockRejectedValue(new Error('壓縮功能不可用，請更新瀏覽器'))

    await elements.syncButton.click()

    expect(elements.syncStatus.textContent).toContain('壓縮功能不可用')
    expect(rendererInstance.start).not.toHaveBeenCalled()
    expect(loggerErrorSpy).toHaveBeenCalled()
    const logged = loggerErrorSpy.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(logged).toContain('SyncPanel')
  })

  test('場景 E7：書庫讀取失敗顯示錯誤並記錄 Logger.error', async () => {
    chrome.storage.local.get = jest.fn(async () => { throw new Error('storage 失敗') })

    await elements.syncButton.click()

    expect(elements.syncStatus.textContent).toContain('讀取書庫失敗')
    expect(encodeBookDataToQRFrames).not.toHaveBeenCalled()
    expect(loggerErrorSpy).toHaveBeenCalled()
  })

  test('場景 I1：使用者中途停止呼叫 renderer.stop 並回初始狀態', async () => {
    mockStorageBooks([{ id: 'b1', title: '書1' }])
    encodeBookDataToQRFrames.mockResolvedValue({ frames: [{}, {}], totalSize: 1000, isStatic: false })
    await elements.syncButton.click()

    // 前置驗證：stopButton 已顯示
    expect(elements.stopButton.style.display).toBe('inline-block')

    elements.stopButton.click()

    expect(rendererInstance.stop).toHaveBeenCalledTimes(1)
    expect(elements.qrCanvas.style.display).toBe('none')
    expect(elements.syncButton.style.display).toBe('inline-block')
    expect(elements.stopButton.style.display).toBe('none')
  })

  test('場景 I2：循環播放完成顯示重新播放提示', async () => {
    expect(typeof capturedOnComplete).toBe('function')

    capturedOnComplete()

    expect(elements.syncStatus.textContent).toContain('播放完成')
    expect(elements.syncButton.style.display).toBe('inline-block')
  })

  test('重複點擊同步時 isProcessing 防止並行流程', async () => {
    mockStorageBooks([{ id: 'b1', title: '書1' }])
    let resolveEncode
    encodeBookDataToQRFrames.mockReturnValue(new Promise((resolve) => { resolveEncode = resolve }))

    const firstClick = elements.syncButton.click()
    // 第二次點擊在第一次流程仍處理中（isProcessing=true）時觸發，應立即 return
    elements.syncButton.click()
    // 推進 microtask 佇列：第一次流程的 storage await 完成後才呼叫 encoder
    await Promise.resolve()
    await Promise.resolve()

    expect(encodeBookDataToQRFrames).toHaveBeenCalledTimes(1)

    resolveEncode({ frames: [{}], totalSize: 400, isStatic: true })
    await firstClick
  })
})
