/**
 * SyncQRRenderer — QR 動畫 Canvas 輪播渲染器（Presentation 層，有狀態）
 *
 * 職責：接收 QR 物件陣列，在 Canvas 上以固定 fps 輪播繪製，或單張靜態顯示。
 * 傳輸編碼（壓縮/切塊/QR 產生）由 src/sync/qr-encoder.js 負責，兩者不互相依賴。
 *
 * 狀態機：IDLE → PLAYING → PAUSED → PLAYING（resume）→ IDLE（stop）；
 * PLAYING → COMPLETED（maxCycles 到達，觸發 onComplete）。
 *
 * 對應 ticket 1.2.0-W1-001 Phase 2 群組 F（場景 N7-N10, E6, B6, B7）。
 */

import { Logger } from '../../core/logging/Logger.js'

const logger = new Logger('SyncQRRenderer')

const STATE_IDLE = 'IDLE'
const STATE_PLAYING = 'PLAYING'
const STATE_PAUSED = 'PAUSED'
const STATE_COMPLETED = 'COMPLETED'

const DEFAULT_FPS = 8
const DEFAULT_CANVAS_SIZE = 280
const DEFAULT_MAX_CYCLES = 3

const noop = () => {}

export class SyncQRRenderer {
  /**
   * @param {HTMLCanvasElement} canvas - 目標 Canvas
   * @param {Object} [options] - { fps, canvasSize, maxCycles, onProgress, onComplete }
   * @throws {Error} Canvas 2D context 不可用
   */
  constructor (canvas, options = {}) {
    const context = canvas.getContext('2d')
    if (context === null || context === undefined) {
      logger.error('Canvas context 不可用', { component: 'SyncQRRenderer' })
      throw new Error('繪圖功能不可用')
    }

    this.canvas = canvas
    this.ctx = context
    this.fps = options.fps || DEFAULT_FPS
    this.canvasSize = options.canvasSize || DEFAULT_CANVAS_SIZE
    this.maxCycles = options.maxCycles || DEFAULT_MAX_CYCLES
    this.onProgress = options.onProgress || noop
    this.onComplete = options.onComplete || noop

    this.state = STATE_IDLE
    this.frames = []
    this.currentFrame = 0
    this.currentCycle = 0
    this.animationId = null
    this.lastFrameTime = 0

    this.animate = this.animate.bind(this)
  }

  /**
   * 載入 frames 並開始播放（多幀）或靜態顯示（單張）。
   *
   * @param {Object[]} frames - QR 物件陣列
   * @param {boolean} isStatic - true 則單張靜態顯示不啟動動畫
   */
  start (frames, isStatic) {
    this.frames = frames
    this.currentFrame = 0
    this.currentCycle = 0

    if (isStatic) {
      drawQRToCanvas(this.ctx, frames[0], this.canvasSize)
      this.state = STATE_IDLE
      return
    }

    this.state = STATE_PLAYING
    this.lastFrameTime = 0
    this.animationId = requestAnimationFrame(this.animate)
  }

  /**
   * rAF 回呼：依 fps 節流繪製當前幀，循環推進並在 maxCycles 到達時停止。
   *
   * @param {number} timestamp - DOMHighResTimeStamp
   */
  animate (timestamp) {
    if (this.state !== STATE_PLAYING) return

    const interval = 1000 / this.fps
    const elapsed = timestamp - this.lastFrameTime

    if (this.lastFrameTime === 0 || elapsed >= interval) {
      drawQRToCanvas(this.ctx, this.frames[this.currentFrame], this.canvasSize)
      this.onProgress(this.currentFrame, this.frames.length)
      this.lastFrameTime = timestamp

      this.currentFrame++
      if (this.currentFrame >= this.frames.length) {
        this.currentFrame = 0
        this.currentCycle++
        if (this.currentCycle >= this.maxCycles) {
          this.state = STATE_COMPLETED
          this.onComplete()
          return
        }
      }
    }

    this.animationId = requestAnimationFrame(this.animate)
  }

  /** 暫停動畫，保留當前幀位置。 */
  pause () {
    if (this.state === STATE_PLAYING) {
      this.state = STATE_PAUSED
      cancelAnimationFrame(this.animationId)
    }
  }

  /** 從暫停位置繼續播放。 */
  resume () {
    if (this.state === STATE_PAUSED) {
      this.state = STATE_PLAYING
      this.lastFrameTime = 0
      this.animationId = requestAnimationFrame(this.animate)
    }
  }

  /** 停止播放、清空 Canvas 並重置狀態。 */
  stop () {
    this.state = STATE_IDLE
    cancelAnimationFrame(this.animationId)
    this.ctx.clearRect(0, 0, this.canvasSize, this.canvasSize)
    this.currentFrame = 0
    this.currentCycle = 0
    this.frames = []
  }

  /**
   * @returns {{playing: boolean, currentFrame: number, totalFrames: number, currentCycle: number}}
   */
  getStatus () {
    return {
      playing: this.state === STATE_PLAYING,
      currentFrame: this.currentFrame,
      totalFrames: this.frames.length,
      currentCycle: this.currentCycle
    }
  }
}

/**
 * 將 QR 物件逐格繪製到 Canvas（黑/白方塊）。
 *
 * @param {CanvasRenderingContext2D} ctx - 2D context
 * @param {Object} qrCode - qrcode-generator QR 物件
 * @param {number} canvasSize - Canvas 邊長（px）
 */
function drawQRToCanvas (ctx, qrCode, canvasSize) {
  const moduleCount = qrCode.getModuleCount()
  const cellSize = canvasSize / moduleCount
  ctx.clearRect(0, 0, canvasSize, canvasSize)
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      ctx.fillStyle = qrCode.isDark(row, col) ? '#000000' : '#FFFFFF'
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize)
    }
  }
}
