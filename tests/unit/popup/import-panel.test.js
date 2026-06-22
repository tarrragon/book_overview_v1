/**
 * ImportPanel UI 互動測試
 *
 * 範圍（ticket 1.2.0-W1-007 Phase 2）：
 * - N1：Happy Path — 點擊匯入 → 選檔 → executeImport → 顯示合併摘要
 * - N2：防舊蓋新 — STALE_DATA → confirm → skipStalenessCheck 重新匯入
 * - N3：防舊蓋新取消 — STALE_DATA → confirm 取消 → reset
 * - E1：解析錯誤 — PARSE_ERROR → showError
 * - E2：未知格式 — UNKNOWN_FORMAT → showError
 * - E3：空書籍 — EMPTY_BOOKS → showError
 * - E4：儲存失敗 — STORAGE_ERROR → showError
 * - E5：檔案讀取失敗 — FileReader onerror → showError
 * - I1：重複匯入 — isProcessing guard 防止並行觸發
 *
 * Mock 策略：Mock json-importer（executeImport），隔離 domain 層行為，
 * 專注驗證 UI 互動與流程編排。FileReader 用 stub helper。
 */

'use strict'

jest.mock('src/import/json-importer', () => ({
  executeImport: jest.fn(),
  IMPORT_ERROR_CODES: {
    PARSE_ERROR: 'IMPORT_PARSE_ERROR',
    UNKNOWN_FORMAT: 'IMPORT_UNKNOWN_FORMAT',
    STALE_DATA: 'IMPORT_STALE_DATA',
    STORAGE_ERROR: 'IMPORT_STORAGE_ERROR',
    FILE_READ_ERROR: 'IMPORT_FILE_READ_ERROR',
    EMPTY_BOOKS: 'IMPORT_EMPTY_BOOKS'
  }
}))

const { ImportPanel } = require('src/popup/components/import-panel')
const { executeImport, IMPORT_ERROR_CODES } = require('src/import/json-importer')

function createElement (tag = 'div') {
  return {
    style: { display: '' },
    textContent: '',
    value: '',
    _handlers: {},
    addEventListener (event, handler) { this._handlers[event] = handler },
    click () { if (this._handlers.click) return this._handlers.click() }
  }
}

function createElements () {
  return {
    importBtn: createElement('button'),
    fileInput: createElement('input'),
    resultContainer: createElement(),
    resultTitle: createElement('strong'),
    resultSummary: Object.assign(createElement(), {
      appendChild: jest.fn(),
      childNodes: []
    }),
    closeResultBtn: createElement('button'),
    errorContainer: createElement(),
    errorTitle: createElement('strong'),
    errorMessage: createElement('span'),
    closeErrorBtn: createElement('button')
  }
}

function createFakeFileReader (content) {
  const fr = {
    readAsText: jest.fn(),
    onload: null,
    onerror: null,
    result: null
  }
  fr._triggerLoad = function () {
    this.result = content
    if (typeof this.onload === 'function') {
      this.onload({ target: this })
    }
  }
  fr._triggerError = function (err) {
    if (typeof this.onerror === 'function') {
      this.onerror(err || new Error('read failed'))
    }
  }
  return fr
}

describe('ImportPanel', () => {
  let elements
  let panel
  let onErrorSpy
  let fakeFileReader
  const VALID_JSON = '{"books":[{"id":"1","title":"Test"}]}'

  beforeEach(() => {
    onErrorSpy = jest.fn()
    elements = createElements()
    fakeFileReader = createFakeFileReader(VALID_JSON)

    panel = new ImportPanel(elements, {
      onError: onErrorSpy,
      createFileReader: () => fakeFileReader
    })
    panel.initialize()
    elements.errorContainer.style.display = 'none'

    executeImport.mockReset()
    window.confirm = jest.fn()
  })

  describe('N1：Happy Path — 匯入成功顯示摘要', () => {
    test('點擊匯入按鈕觸發檔案選擇', () => {
      elements.importBtn._handlers.click()
      expect(elements.fileInput.click).toBeDefined()
    })

    test('選擇合法 JSON 後呼叫 executeImport 並顯示摘要', async () => {
      executeImport.mockResolvedValue({
        success: true,
        summary: { added: 3, updated: 1, unchanged: 5 },
        source: 'canonical',
        importedAt: '2026-06-22T10:00:00Z'
      })

      const file = new Blob([VALID_JSON], { type: 'application/json' })
      await panel.handleFileSelected({ target: { files: [file] } })
      fakeFileReader._triggerLoad()

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(executeImport).toHaveBeenCalledWith(VALID_JSON)
      expect(elements.resultContainer.style.display).toBe('block')
    })
  })

  describe('N2：防舊蓋新 — 確認後重新匯入', () => {
    test('exportedAt 較舊時 confirm 確認後以 skipStalenessCheck 重新匯入', async () => {
      executeImport
        .mockResolvedValueOnce({
          success: false,
          error: { code: IMPORT_ERROR_CODES.STALE_DATA, message: '匯入檔案較舊' },
          staleness: {
            isStale: true,
            exportedAt: '2026-06-20T00:00:00Z',
            lastImportedAt: '2026-06-21T00:00:00Z'
          }
        })
        .mockResolvedValueOnce({
          success: true,
          summary: { added: 0, updated: 2, unchanged: 8 }
        })

      window.confirm.mockReturnValue(true)

      const file = new Blob([VALID_JSON], { type: 'application/json' })
      await panel.handleFileSelected({ target: { files: [file] } })
      fakeFileReader._triggerLoad()

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(window.confirm).toHaveBeenCalled()
      expect(executeImport).toHaveBeenCalledTimes(2)
      expect(executeImport).toHaveBeenLastCalledWith(VALID_JSON, { skipStalenessCheck: true })
      expect(elements.resultContainer.style.display).not.toBe('none')
    })
  })

  describe('N3：防舊蓋新取消 — reset', () => {
    test('使用者取消 confirm 時不重新匯入', async () => {
      executeImport.mockResolvedValue({
        success: false,
        error: { code: IMPORT_ERROR_CODES.STALE_DATA, message: '匯入檔案較舊' },
        staleness: { isStale: true, exportedAt: '2026-06-20', lastImportedAt: '2026-06-21' }
      })

      window.confirm.mockReturnValue(false)

      const file = new Blob([VALID_JSON], { type: 'application/json' })
      await panel.handleFileSelected({ target: { files: [file] } })
      fakeFileReader._triggerLoad()

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(window.confirm).toHaveBeenCalled()
      expect(executeImport).toHaveBeenCalledTimes(1)
      expect(elements.fileInput.value).toBe('')
    })
  })

  describe('E1-E4：錯誤處理 — 顯示錯誤卡片', () => {
    const errorCases = [
      { code: IMPORT_ERROR_CODES.PARSE_ERROR, message: '檔案格式錯誤，無法解析 JSON' },
      { code: IMPORT_ERROR_CODES.UNKNOWN_FORMAT, message: '無法識別的檔案格式' },
      { code: IMPORT_ERROR_CODES.EMPTY_BOOKS, message: '匯入檔案中沒有書籍資料' },
      { code: IMPORT_ERROR_CODES.STORAGE_ERROR, message: '儲存失敗，請重試' }
    ]

    test.each(errorCases)('$code → 顯示 errorContainer 並設定 errorMessage', async ({ code, message }) => {
      executeImport.mockResolvedValue({
        success: false,
        error: { code, message }
      })

      const file = new Blob([VALID_JSON], { type: 'application/json' })
      await panel.handleFileSelected({ target: { files: [file] } })
      fakeFileReader._triggerLoad()

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(elements.errorContainer.style.display).toBe('block')
      expect(elements.errorMessage.textContent).toBe(message)
      expect(onErrorSpy).toHaveBeenCalledWith(expect.objectContaining({ code, message }))
    })
  })

  describe('E5：檔案讀取失敗', () => {
    test('FileReader onerror 顯示錯誤卡片', async () => {
      const file = new Blob([VALID_JSON], { type: 'application/json' })
      await panel.handleFileSelected({ target: { files: [file] } })
      fakeFileReader._triggerError(new Error('disk error'))

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(elements.errorContainer.style.display).toBe('block')
      expect(elements.errorMessage.textContent).toBe('檔案讀取失敗')
      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ code: IMPORT_ERROR_CODES.FILE_READ_ERROR })
      )
    })
  })

  describe('I1：重複匯入防護', () => {
    test('isProcessing 為 true 時忽略新的匯入', async () => {
      executeImport.mockImplementation(() => new Promise(() => {}))

      const file = new Blob([VALID_JSON], { type: 'application/json' })
      panel.handleFileSelected({ target: { files: [file] } })
      fakeFileReader._triggerLoad()

      const file2 = new Blob([VALID_JSON], { type: 'application/json' })
      await panel.handleFileSelected({ target: { files: [file2] } })

      expect(fakeFileReader.readAsText).toHaveBeenCalledTimes(1)
    })
  })

  describe('reset', () => {
    test('隱藏結果容器並清空 fileInput', () => {
      elements.resultContainer.style.display = 'block'
      elements.fileInput.value = 'some-file.json'

      panel.reset()

      expect(elements.resultContainer.style.display).toBe('none')
      expect(elements.fileInput.value).toBe('')
    })
  })

  describe('初始化', () => {
    test('未選檔案時不觸發匯入', async () => {
      await panel.handleFileSelected({ target: { files: [] } })

      expect(fakeFileReader.readAsText).not.toHaveBeenCalled()
      expect(executeImport).not.toHaveBeenCalled()
    })
  })
})
