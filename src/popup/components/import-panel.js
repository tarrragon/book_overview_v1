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

export class ImportPanel {
  /**
   * @param {Object} elements - { importBtn, fileInput, resultContainer, importedCount, updatedCount, unchangedCount, closeResultBtn }
   * @param {Object} [deps] - { onError?: (error) => void, createFileReader?: () => FileReader }
   */
  constructor (elements, deps = {}) {
    this.elements = elements
    this.onError = deps.onError || (() => {})
    this.createFileReader = deps.createFileReader || (() => FileReaderFactory.createReader())
    this.isProcessing = false

    this.triggerFileSelect = this.triggerFileSelect.bind(this)
    this.handleFileSelected = this.handleFileSelected.bind(this)
  }

  /** 綁定匯入按鈕與 file input 事件。 */
  initialize () {
    this.elements.importBtn.addEventListener('click', this.triggerFileSelect)
    this.elements.fileInput.addEventListener('change', this.handleFileSelected)
    if (this.elements.closeResultBtn) {
      this.elements.closeResultBtn.addEventListener('click', () => this.reset())
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
      logger.error('檔案讀取失敗', { component: 'ImportPanel' })
      this.onError({ code: IMPORT_ERROR_CODES.FILE_READ_ERROR, message: '檔案讀取失敗' })
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
      this.onError({ code: IMPORT_ERROR_CODES.STORAGE_ERROR, message: '儲存失敗，請重試' })
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

    this.onError(error)
  }

  /**
   * 防舊蓋新確認流程：confirm 確認後以 skipStalenessCheck 重新匯入；取消則 reset。
   * @param {Object} result - 含 staleness 的 STALE_DATA 結果
   * @param {string} content
   * @returns {Promise<void>}
   */
  async _handleStaleData (result, content) {
    const staleness = result.staleness || {}
    const message = '匯入檔案（' + staleness.exportedAt +
      '）較本機上次匯入（' + staleness.lastImportedAt + '）舊，確定要覆蓋？'

    if (!window.confirm(message)) {
      this.reset()
      return
    }

    const retryResult = await executeImport(content, { skipStalenessCheck: true })
    if (retryResult.success) {
      this._showResult(retryResult.summary)
    } else {
      this.onError(retryResult.error || {})
    }
  }

  /**
   * 顯示匯入結果摘要（新增/更新/未變更）。
   * @param {Object} summary - { added, updated, unchanged }
   */
  _showResult (summary) {
    const safe = summary || {}
    this.elements.importedCount.textContent = String(safe.added || 0)
    this.elements.updatedCount.textContent = String(safe.updated || 0)
    this.elements.unchangedCount.textContent = String(safe.unchanged || 0)
    this.elements.resultContainer.style.display = 'block'
  }

  /** 隱藏結果容器並清空 file input，使同一檔案可重新觸發 change。 */
  reset () {
    this.elements.resultContainer.style.display = 'none'
    this.elements.fileInput.value = ''
  }
}
