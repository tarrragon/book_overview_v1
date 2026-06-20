/**
 * 群組 F：Canvas 輪播渲染器測試（SyncQRRenderer）
 *
 * 範圍（ticket 1.2.0-W1-001 Phase 2 群組 F）：
 * - 場景 N7：靜態 QR 繪製一次，不啟動 rAF 循環
 * - 場景 N8：多幀 8fps 輪播，推進時間後繪製多次
 * - 場景 N9：maxCycles 到達自動停止並觸發 onComplete
 * - 場景 N10：pause/resume 保留並從當前幀繼續
 * - 場景 E6：Canvas context 不可用 → 建構拋出 Error + Logger.error
 * - 場景 B6：單幀非靜態模式反覆播放至 maxCycles
 * - 場景 B7：stop() 清空 Canvas 並回初始狀態
 *
 * Mock 策略：Mock Canvas 2D context（jsdom 不完整支援）、以
 * jest.useFakeTimers 控制 requestAnimationFrame 時序。以繪製呼叫次數
 * 與狀態旗標驗證，不使用計時門檻斷言（test-assertion-design-rules）。
 *
 * rAF 時序模型：fake timers 將 rAF 回呼以遞增 timestamp 觸發；fps=8 對應
 * 每 125ms 推進一幀，藉 advanceTimersByTime 精準控制幀數。
 */

'use strict'

const { SyncQRRenderer } = require('src/popup/services/sync-qr-renderer')

function createMockContext () {
  return {
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    fillStyle: '#000000'
  }
}

function createMockCanvas (context) {
  return {
    getContext: jest.fn(() => context)
  }
}

// 最小 QR 物件 mock：固定 module 數與棋盤式 isDark，使繪製可被計數。
function createMockQR () {
  return {
    getModuleCount: () => 4,
    isDark: (row, col) => (row + col) % 2 === 0
  }
}

function makeFrames (count) {
  const frames = []
  for (let i = 0; i < count; i++) frames.push(createMockQR())
  return frames
}

describe('SyncQRRenderer', () => {
  let loggerErrorSpy

  beforeEach(() => {
    jest.useFakeTimers()
    loggerErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.useRealTimers()
    loggerErrorSpy.mockRestore()
  })

  test('場景 E6：Canvas context 不可用時建構拋出 Error 並記錄 Logger.error', () => {
    const canvas = { getContext: () => null }

    let thrown = null
    try {
      // eslint-disable-next-line no-new
      new SyncQRRenderer(canvas)
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown.message).toContain('繪圖功能不可用')
    expect(loggerErrorSpy).toHaveBeenCalled()
    const logged = loggerErrorSpy.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(logged).toContain('SyncQRRenderer')
  })

  test('場景 N7：靜態 QR 繪製一次且不啟動動畫', () => {
    const ctx = createMockContext()
    const canvas = createMockCanvas(ctx)
    const renderer = new SyncQRRenderer(canvas)

    // 前置驗證：canvas 有效，getContext 回傳 context
    expect(canvas.getContext).toHaveBeenCalledWith('2d')

    renderer.start(makeFrames(1), true)

    // 靜態：fillRect 被呼叫（4x4=16 格），但狀態非播放中
    expect(ctx.fillRect).toHaveBeenCalled()
    const status = renderer.getStatus()
    expect(status).toEqual({
      playing: false,
      currentFrame: 0,
      totalFrames: 1,
      currentCycle: 0
    })
  })

  test('場景 N8：多幀 8fps 輪播推進 625ms 後至少繪製 5 幀', () => {
    const ctx = createMockContext()
    const renderer = new SyncQRRenderer(createMockCanvas(ctx), { fps: 8 })

    renderer.start(makeFrames(5), false)
    expect(renderer.getStatus().playing).toBe(true)

    jest.advanceTimersByTime(625)

    // 8fps → 125ms/幀，625ms 至少 5 次幀繪製（每幀 clearRect 至少一次）
    expect(ctx.clearRect.mock.calls.length).toBeGreaterThanOrEqual(5)
  })

  test('場景 N9：maxCycles=3 到達後自動停止並觸發 onComplete 一次', () => {
    const ctx = createMockContext()
    const onComplete = jest.fn()
    const renderer = new SyncQRRenderer(createMockCanvas(ctx), {
      fps: 8,
      maxCycles: 3,
      onComplete
    })

    renderer.start(makeFrames(3), false)
    jest.advanceTimersByTime(2000)

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(renderer.getStatus().playing).toBe(false)
  })

  test('場景 N10：pause 保留當前幀，resume 從該幀繼續', () => {
    const ctx = createMockContext()
    const renderer = new SyncQRRenderer(createMockCanvas(ctx), { fps: 8 })

    renderer.start(makeFrames(5), false)
    jest.advanceTimersByTime(250)
    renderer.pause()

    const pausedFrame = renderer.getStatus().currentFrame
    expect(renderer.getStatus().playing).toBe(false)

    renderer.resume()
    expect(renderer.getStatus().playing).toBe(true)
    expect(renderer.getStatus().currentFrame).toBe(pausedFrame)
  })

  test('場景 B6：單幀非靜態模式反覆播放至 maxCycles 停止', () => {
    const ctx = createMockContext()
    const onComplete = jest.fn()
    const renderer = new SyncQRRenderer(createMockCanvas(ctx), {
      fps: 8,
      maxCycles: 2,
      onComplete
    })

    renderer.start(makeFrames(1), false)
    jest.advanceTimersByTime(1000)

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(renderer.getStatus().playing).toBe(false)
  })

  test('場景 B7：stop() 清空 Canvas 並回初始狀態', () => {
    const ctx = createMockContext()
    const renderer = new SyncQRRenderer(createMockCanvas(ctx), { fps: 8 })

    renderer.start(makeFrames(5), false)
    jest.advanceTimersByTime(250)
    renderer.stop()

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 280, 280)
    expect(renderer.getStatus()).toEqual({
      playing: false,
      currentFrame: 0,
      totalFrames: 0,
      currentCycle: 0
    })
  })
})
