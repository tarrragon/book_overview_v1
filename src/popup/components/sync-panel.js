/**
 * SyncPanel — 同步到 App 的 Popup UI 控制器（Presentation 層，有狀態）
 *
 * 職責：綁定同步/停止按鈕事件，串接書庫讀取 → QR 編碼 → Canvas 輪播，
 * 並依流程狀態更新 UI（按鈕顯示、狀態文字、Canvas 可見性）。
 *
 * 依賴 src/sync/qr-encoder.js（encodeBookDataToQRFrames）與
 * src/popup/services/sync-qr-renderer.js（SyncQRRenderer）。
 *
 * 對應 ticket 1.2.0-W1-001 Phase 2 群組 G（場景 N11, E1-UI, E2-UI, E7, I1, I2）。
 */

import { Logger } from '../../core/logging/Logger.js'
import { encodeBookDataToQRFrames } from '../../sync/qr-encoder.js'
import { buildSyncJSON } from '../../sync/sync-json-builder.js'
import { SyncQRRenderer } from '../services/sync-qr-renderer.js'
import { STORAGE_KEYS } from '../../background/constants/module-constants.js'

const logger = new Logger('SyncPanel')

export class SyncPanel {
  /**
   * @param {Object} elements - { syncContainer, qrCanvas, syncStatus, syncButton, stopButton }
   */
  constructor (elements) {
    this.elements = elements
    this.renderer = null
    this.isProcessing = false

    this.startSync = this.startSync.bind(this)
    this.stopSync = this.stopSync.bind(this)
    this.handleComplete = this.handleComplete.bind(this)
  }

  /**
   * 綁定事件並建立渲染器。
   * @returns {Promise<void>}
   */
  async initialize () {
    this.elements.syncButton.addEventListener('click', this.startSync)
    this.elements.stopButton.addEventListener('click', this.stopSync)
    this.renderer = new SyncQRRenderer(this.elements.qrCanvas, {
      onComplete: this.handleComplete
    })
  }

  /**
   * 觸發完整同步流程：讀書庫 → 壓縮切塊 QR → 啟動輪播。
   * @returns {Promise<void>}
   */
  async startSync () {
    if (this.isProcessing) return
    this.isProcessing = true
    this._setStatus('正在準備同步資料...')

    try {
      const books = await this._loadBooks()
      if (books.length === 0) {
        this._setStatus('書庫中沒有書籍，請先提取書庫資料')
        this._showCanvas(false)
        return
      }

      const jsonString = buildSyncJSON(books)
      const result = await encodeBookDataToQRFrames(jsonString)

      this._showCanvas(true)
      this._toggleButtons(true)
      this.renderer.start(result.frames, result.isStatic)
      this._setStatus(result.isStatic ? '單張 QR，請以 App 掃描' : '共 ' + result.frames.length + ' 幀，請以 App 掃描')
    } catch (error) {
      logger.error('同步流程失敗：' + error.message, { component: 'SyncPanel' })
      this._setStatus(error.message)
      this._showCanvas(false)
      this._toggleButtons(false)
    } finally {
      this.isProcessing = false
    }
  }

  /** 停止動畫回到初始狀態。 */
  stopSync () {
    if (this.renderer) this.renderer.stop()
    this._showCanvas(false)
    this._toggleButtons(false)
    this._setStatus('')
  }

  /** 循環播放完成回呼。 */
  handleComplete () {
    this._setStatus('播放完成，若 App 未收齊可重新播放')
    this._toggleButtons(false)
  }

  /**
   * 讀取書庫 books 陣列（chrome.storage.local.readmoo_books.books）。
   * @returns {Promise<Array>}
   */
  async _loadBooks () {
    try {
      const data = await chrome.storage.local.get([STORAGE_KEYS.READMOO_BOOKS])
      const stored = data && data[STORAGE_KEYS.READMOO_BOOKS]
      return (stored && stored.books) || []
    } catch (error) {
      logger.error('讀取書庫失敗：' + error.message, { component: 'SyncPanel' })
      throw new Error('讀取書庫失敗')
    }
  }

  _setStatus (text) {
    if (this.elements.syncStatus) this.elements.syncStatus.textContent = text
  }

  _showCanvas (visible) {
    if (this.elements.qrCanvas) {
      this.elements.qrCanvas.style.display = visible ? 'block' : 'none'
    }
  }

  _toggleButtons (syncing) {
    if (this.elements.syncButton) {
      this.elements.syncButton.style.display = syncing ? 'none' : 'inline-block'
    }
    if (this.elements.stopButton) {
      this.elements.stopButton.style.display = syncing ? 'inline-block' : 'none'
    }
  }
}
