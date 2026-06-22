/**
 * ImportPanel — JSON 匯入的 Popup UI 控制器（Presentation 層，有狀態）
 *
 * 職責：綁定匯入按鈕與隱藏 file input，讀取選取檔案後串接
 * src/import/json-importer.js 的 executeImport 編排匯入流程，
 * 並依結果更新摘要、處理防舊蓋新確認與錯誤回呼。
 *
 * 對應 ticket 1.2.0-W1-007 Phase 2（N1, N2, N3, E1-E5, I1）。
 */

import { Logger } from '../../core/logging/Logger.js'
import { executeImport, IMPORT_ERROR_CODES } from '../../import/json-importer.js'
import FileReaderFactory from '../../utils/file-reader-factory.js'

const logger = new Logger('ImportPanel')

const IMPORT_MESSAGES = {
  BUTTON_LABEL: '匯入書庫',
  RESULT_TITLE: '匯入結果',
  ERROR_TITLE: '匯入失敗',
  CLOSE: '關閉',
  FALLBACK_ERROR: '匯入失敗',
  FILE_READ_ERROR: '檔案讀取失敗',
  STORAGE_ERROR: '儲存失敗，請重試',
  STALE_CONFIRM: (exportedAt, lastImportedAt) =>
    '匯入檔案（' + exportedAt + '）較本機上次匯入（' + lastImportedAt + '）舊，確定要覆蓋？',
  SUMMARY_ADDED: '新增:',
  SUMMARY_UPDATED: '更新:',
  SUMMARY_UNCHANGED: '未變更:',
  SUMMARY_UNIT: '本'
}

export class ImportPanel {
  /**
   * @param {Object} elements - { importBtn, fileInput, resultContainer, resultTitle, resultSummary, closeResultBtn, errorContainer, errorTitle, errorMessage, closeErrorBtn }
   * @param {Object} [deps] - { onError?: (error) => void, createFileReader?: () => FileReader }
   */
  constructor (elements, deps = {}) {
    this.elements = elements
    this.onError = deps.onError || null
    this.createFileReader = deps.createFileReader || (() => FileReaderFactory.createReader())
    this.isProcessing = false

    this.triggerFileSelect = this.triggerFileSelect.bind(this)
    this.handleFileSelected = this.handleFileSelected.bind(this)
  }

  /** 綁定事件並設定 UI 文字。 */
  initialize () {
    this.elements.importBtn.addEventListener('click', this.triggerFileSelect)
    this.elements.fileInput.addEventListener('change', this.handleFileSelected)
    if (this.elements.closeResultBtn) {
      this.elements.closeResultBtn.textContent = IMPORT_MESSAGES.CLOSE
      this.elements.closeResultBtn.addEventListener('click', () => this.reset())
    }
    if (this.elements.closeErrorBtn) {
      this.elements.closeErrorBtn.textContent = IMPORT_MESSAGES.CLOSE
      this.elements.closeErrorBtn.addEventListener('click', () => this._hideError())
    }
    if (this.elements.resultTitle) {
      this.elements.resultTitle.textContent = IMPORT_MESSAGES.RESULT_TITLE
    }
    if (this.elements.errorTitle) {
      this.elements.errorTitle.textContent = IMPORT_MESSAGES.ERROR_TITLE
    }
  }

  /** 點擊匯入按鈕時開啟檔案選擇對話框。 */
  triggerFileSelect () {
    this.elements.fileInput.click()
  }

  /**
   * file input change 事件處理：讀取檔案內容後執行匯入流程。
   * @param {Event} event
   * @returns {Promise<void>}
   */
  async handleFileSelected (event) {
    if (this.isProcessing) return

    const files = event && event.target && event.target.files
    const file = files && files[0]
    if (!file) return

    this.isProcessing = true

    const reader = this.createFileReader()
    reader.onload = (e) => { this._processContent(e.target.result) }
    reader.onerror = () => {
      logger.error(IMPORT_MESSAGES.FILE_READ_ERROR, { component: 'ImportPanel' })
      this._showError({ code: IMPORT_ERROR_CODES.FILE_READ_ERROR, message: IMPORT_MESSAGES.FILE_READ_ERROR })
      this.isProcessing = false
    }
    reader.readAsText(file)
  }

  /**
   * 讀檔完成後執行匯入流程並更新 UI；無論成敗最後清除 isProcessing。
   * @param {string} content - 檔案文字內容
   * @returns {Promise<void>}
   */
  async _processContent (content) {
    try {
      const result = await executeImport(content)
      await this._handleImportResult(result, content)
    } catch (error) {
      logger.error('匯入流程失敗：' + error.message, { component: 'ImportPanel' })
      this._showError({ code: IMPORT_ERROR_CODES.STORAGE_ERROR, message: IMPORT_MESSAGES.STORAGE_ERROR })
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * 依匯入結果分流：成功顯示摘要 / STALE_DATA 走確認流程 / 其他錯誤回呼 onError。
   * @param {Object} result - executeImport 回傳的 ImportResult
   * @param {string} content - 原始檔案內容（STALE_DATA 重試用）
   * @returns {Promise<void>}
   */
  async _handleImportResult (result, content) {
    if (result.success) {
      this._showResult(result.summary)
      return
    }

    const error = result.error || {}
    if (error.code === IMPORT_ERROR_CODES.STALE_DATA) {
      await this._handleStaleData(result, content)
      return
    }

    this._showError(error)
  }

  /**
   * 防舊蓋新確認流程：confirm 確認後以 skipStalenessCheck 重新匯入；取消則 reset。
   * @param {Object} result - 含 staleness 的 STALE_DATA 結果
   * @param {string} content
   * @returns {Promise<void>}
   */
  async _handleStaleData (result, content) {
    const staleness = result.staleness || {}
    const message = IMPORT_MESSAGES.STALE_CONFIRM(staleness.exportedAt, staleness.lastImportedAt)

    if (!window.confirm(message)) {
      this.reset()
      return
    }

    const retryResult = await executeImport(content, { skipStalenessCheck: true })
    if (retryResult.success) {
      this._showResult(retryResult.summary)
    } else {
      this._showError(retryResult.error || {})
    }
  }

  /**
   * 顯示匯入結果摘要（新增/更新/未變更）。
   * @param {Object} summary - { added, updated, unchanged }
   */
  _showResult (summary) {
    const safe = summary || {}
    if (this.elements.resultSummary) {
      const el = this.elements.resultSummary
      el.textContent = ''
      const lines = [
        [IMPORT_MESSAGES.SUMMARY_ADDED, safe.added || 0],
        [IMPORT_MESSAGES.SUMMARY_UPDATED, safe.updated || 0],
        [IMPORT_MESSAGES.SUMMARY_UNCHANGED, safe.unchanged || 0]
      ]
      lines.forEach(([label, count], i) => {
        const b = document.createElement('strong')
        b.textContent = label
        el.appendChild(b)
        el.appendChild(document.createTextNode(' ' + count + ' ' + IMPORT_MESSAGES.SUMMARY_UNIT))
        if (i < lines.length - 1) el.appendChild(document.createElement('br'))
      })
    }
    this.elements.resultContainer.style.display = 'block'
  }

  /**
   * 顯示匯入錯誤訊息（使用獨立錯誤卡片，非 popup errorContainer）。
   * @param {Object} error - { code, message }
   */
  _showError (error) {
    if (this.elements.errorContainer && this.elements.errorMessage) {
      this.elements.errorMessage.textContent = (error && error.message) || IMPORT_MESSAGES.FALLBACK_ERROR
      this.elements.errorContainer.style.display = 'block'
    }
    if (this.onError) this.onError(error)
  }

  _hideError () {
    if (this.elements.errorContainer) {
      this.elements.errorContainer.style.display = 'none'
    }
  }

  /** 隱藏結果容器和錯誤容器，清空 file input。 */
  reset () {
    this.elements.resultContainer.style.display = 'none'
    this._hideError()
    this.elements.fileInput.value = ''
  }
}
