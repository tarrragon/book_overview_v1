/**
 * 匯入模式選擇 modal 測試（UC-04 / IMP-E，0.19.0-W1-047.5）
 *
 * 測試範圍：
 * - promptImportMode modal 基礎行為（顯示/隱藏、三按鈕、resolve 值）
 * - 三種取消途徑（取消鈕、Esc、點遮罩）
 * - handleFileLoad 依模式分流（覆蓋→replaceAllData、合併→mergeAllData）
 * - 合併模式錯誤處理（與覆蓋對稱）
 * - 無障礙與鍵盤導覽（role/aria、初始焦點、focus trap）
 * - 單一 modal 實例（重複觸發不開第二個）
 * - modal DOM 缺失防禦（sentinel 分流）
 *
 * 1.5.0-W6-022 遷移：promptImportMode 內部改走 createDialog 動態建立對話框
 * （掛載於 document.body），不再操作 overview.html 靜態 modal 標記（該標記僅作為
 * 「DOM 是否已初始化」防禦錨點保留，見 import-flow-controller.js 設計註解）。
 * 測試改以 getOpenDialog() 查詢當前開啟的動態對話框，取代原本的
 * document.getElementById('importModeOverlay' 等) 靜態 id 查詢。
 *
 * @jest-environment jsdom
 */

/**
 * 建置 DOM 固定內容（container 基礎元素 + import-mode modal 靜態錨點）
 *
 * @param {Object} options
 * @param {boolean} options.withModal - 是否注入 modal 靜態錨點元素（false 用於 DOM 缺失防禦測試）
 */
function setupDom ({ withModal = true } = {}) {
  const modalHtml = withModal
    ? `
      <div id="importModeOverlay" class="modal-overlay" style="display: none;">
        <div id="importModeModal" class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="importModeTitle">
          <h2 id="importModeTitle" class="modal-title">選擇匯入模式</h2>
          <p class="modal-description"></p>
          <div class="modal-actions">
            <button id="importModeOverwriteBtn">覆蓋（清空現有書庫）</button>
            <button id="importModeMergeBtn">合併（保留現有書庫）</button>
            <button id="importModeCancelBtn">取消</button>
          </div>
        </div>
      </div>`
    : ''

  document.body.innerHTML = `
    <div class="container">
      <div class="stat-number" id="totalBooks">0</div>
      <div class="stat-number" id="displayedBooks">0</div>
      <input type="text" id="searchBox">
      <button id="exportCSVBtn"></button>
      <button id="exportJSONBtn"></button>
      <button id="importJSONBtn"></button>
      <button id="selectAllBtn"></button>
      <button id="reloadBtn"></button>
      <select id="sortSelect"><option value="title">書名</option></select>
      <select id="sortDirection"><option value="asc">升冪</option></select>
      <div id="fileUploader" style="display: none;">
        <input type="file" id="jsonFileInput">
        <button id="loadFileBtn"></button>
        <button id="loadSampleBtn"></button>
      </div>
      <table id="booksTable">
        <thead><tr><th><input type="checkbox" id="selectAllHeaderCheckbox"></th></tr></thead>
        <tbody id="tableBody"></tbody>
      </table>
      <div id="loadingIndicator" style="display: none;">
        <div class="loading-spinner"></div>
        <div class="loading-text">載入中...</div>
      </div>
      <div id="errorContainer" style="display: none;">
        <div class="error-message" id="errorMessage"></div>
        <button id="retryBtn">重試</button>
      </div>
    </div>
    ${modalHtml}
  `
}

/**
 * 查詢目前開啟（顯示中）的動態對話框（createDialog 建立，非靜態錨點）
 * @returns {HTMLElement|null}
 */
function getOpenDialog () {
  const overlays = Array.from(document.querySelectorAll('.modal-overlay'))
  return overlays.find(el => el.style.display !== 'none') || null
}

/**
 * 取得對話框內 .modal-actions 底下的按鈕，依建立順序回傳
 * @param {HTMLElement} dialog
 * @returns {HTMLButtonElement[]}
 */
function getDialogButtons (dialog) {
  return Array.from(dialog.querySelectorAll('.modal-actions button'))
}

describe('匯入模式選擇 modal（UC-04 / IMP-E）', () => {
  let mockEventBus
  let OverviewPageController

  /**
   * 建立 controller，並注入 import-mode modal 靜態錨點
   * @param {Object} options
   * @param {boolean} options.withModal - 是否注入 modal 靜態錨點
   * @returns {Object} controller 實例
   */
  function createController ({ withModal = true } = {}) {
    setupDom({ withModal })

    const EventHandler = require('src/core/event-handler')
    window.EventHandler = EventHandler

    const { OverviewPageController: Ctor } = require('src/overview/overview-page-controller')
    OverviewPageController = Ctor
    return new OverviewPageController(mockEventBus, document)
  }

  beforeEach(() => {
    mockEventBus = {
      emit: jest.fn().mockResolvedValue(true),
      on: jest.fn(),
      off: jest.fn(),
      once: jest.fn()
    }

    global.chrome = {
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({ readmoo_books: [] }),
          set: jest.fn().mockResolvedValue()
        }
      },
      runtime: { onMessage: { addListener: jest.fn() }, lastError: null }
    }

    jest.resetModules()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  // ===========================================================================
  // Group A：promptImportMode modal 基礎行為（場景 1/2 modal 端）
  // ===========================================================================
  describe('Group A：promptImportMode modal 基礎行為', () => {
    test('TC-A1 promptImportMode 呼叫後動態對話框由無到有且顯示', async () => {
      const controller = createController()
      expect(getOpenDialog()).toBeNull()

      const pending = controller.promptImportMode()
      await Promise.resolve()

      const dialog = getOpenDialog()
      expect(dialog).not.toBeNull()
      expect(dialog.style.display).not.toBe('none')

      getDialogButtons(dialog)[0].click()
      await pending
    })

    test('TC-A2 modal 顯示時三按鈕皆存在且可見且未 disabled', async () => {
      const controller = createController()
      const pending = controller.promptImportMode()
      await Promise.resolve()

      const buttons = getDialogButtons(getOpenDialog())
      expect(buttons.length).toBe(3)
      buttons.forEach(btn => expect(btn.disabled).toBe(false))

      buttons[2].click()
      await pending
    })

    test('TC-A3 modal 說明文字含覆蓋/清空與合併/保留語意關鍵字', async () => {
      const controller = createController()
      const pending = controller.promptImportMode()
      await Promise.resolve()

      const description = getOpenDialog().querySelector('.modal-description')
      const text = description.textContent
      expect(text).toContain('覆蓋')
      expect(text).toContain('清空')
      expect(text).toContain('合併')
      expect(text).toContain('保留')

      getDialogButtons(getOpenDialog())[2].click()
      await pending
    })

    test('TC-A4 點覆蓋按鈕 → resolve overwrite 且對話框關閉', async () => {
      const controller = createController()
      const pending = controller.promptImportMode()
      await Promise.resolve()

      const dialog = getOpenDialog()
      getDialogButtons(dialog)[0].click()
      const result = await pending

      expect(result).toBe('overwrite')
      expect(dialog.style.display).toBe('none')
    })

    test('TC-A5 點合併按鈕 → resolve merge 且對話框關閉', async () => {
      const controller = createController()
      const pending = controller.promptImportMode()
      await Promise.resolve()

      const dialog = getOpenDialog()
      getDialogButtons(dialog)[1].click()
      const result = await pending

      expect(result).toBe('merge')
      expect(dialog.style.display).toBe('none')
    })

    test('TC-A6 resolve 前 modal 持續顯示', async () => {
      const controller = createController()
      const pending = controller.promptImportMode()
      await Promise.resolve()

      const dialog = getOpenDialog()
      expect(dialog.style.display).not.toBe('none')

      getDialogButtons(dialog)[0].click()
      await pending
    })
  })

  // ===========================================================================
  // Group B：取消途徑（場景 3/4/5）
  // ===========================================================================
  describe('Group B：取消途徑', () => {
    test('TC-B1 點取消按鈕 → resolve null 且對話框關閉', async () => {
      const controller = createController()
      const pending = controller.promptImportMode()
      await Promise.resolve()

      const dialog = getOpenDialog()
      getDialogButtons(dialog)[2].click()
      const result = await pending

      expect(result).toBeNull()
      expect(dialog.style.display).toBe('none')
    })

    test('TC-B2 按 Esc 鍵 → resolve null 且對話框關閉', async () => {
      const controller = createController()
      const pending = controller.promptImportMode()
      await Promise.resolve()

      const dialog = getOpenDialog()
      const dialogEl = dialog.querySelector('.modal-dialog')
      dialogEl.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      const result = await pending

      expect(result).toBeNull()
      expect(dialog.style.display).toBe('none')
    })

    test('TC-B3 點遮罩層 → resolve null 且對話框關閉', async () => {
      const controller = createController()
      const pending = controller.promptImportMode()
      await Promise.resolve()

      const dialog = getOpenDialog()
      // 模擬點擊遮罩本身（event.target === overlay）
      dialog.dispatchEvent(new window.MouseEvent('click', { bubbles: false }))
      const result = await pending

      expect(result).toBeNull()
      expect(dialog.style.display).toBe('none')
    })

    test('TC-B4 點 modal 容器內部不觸發取消（事件不冒泡誤判）', async () => {
      const controller = createController()
      const pending = controller.promptImportMode()
      await Promise.resolve()

      const dialog = getOpenDialog()
      let resolved = false
      pending.then(() => { resolved = true })

      // 點 modal 內部（標題），事件冒泡至 overlay 但 target !== overlay
      const title = dialog.querySelector('.modal-title')
      title.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()

      // Promise 尚未 resolve，對話框仍顯示
      expect(resolved).toBe(false)
      expect(dialog.style.display).not.toBe('none')

      // 收斂
      getDialogButtons(dialog)[2].click()
      await pending
    })
  })

  // ===========================================================================
  // Group C：handleFileLoad 分流（場景 1/2/3 流程端）
  // ===========================================================================
  describe('Group C：handleFileLoad 分流', () => {
    const mockFile = { name: 'books.json', type: 'application/json', size: 100 }
    const importResult = {
      books: [{ id: 'b1', title: '書一', cover: 'http://x/c1.jpg', readingStatus: 'reading' }],
      tags: [{ id: 't1', name: 'Y', categoryId: 'c1' }],
      tagCategories: [{ id: 'c1', name: 'X' }]
    }

    /**
     * 建立 controller 並 stub importer 讀檔 + adapter 兩個 *AllData
     * @returns {{ controller, replaceAllDataMock, mergeAllDataMock }}
     */
    function setup () {
      const controller = createController()
      controller.bookFileImporter.reader.read = jest
        .fn()
        .mockResolvedValue(importResult)

      const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')
      const replaceAllDataMock = jest.fn().mockResolvedValue({ success: true })
      const mergeAllDataMock = jest.fn().mockResolvedValue({ success: true })
      TagStorageAdapter.replaceAllData = replaceAllDataMock
      TagStorageAdapter.mergeAllData = mergeAllDataMock

      return { controller, replaceAllDataMock, mergeAllDataMock }
    }

    test('TC-C1 選覆蓋 → 呼叫 replaceAllData 不呼叫 mergeAllData，UI 收 books', async () => {
      const { controller, replaceAllDataMock, mergeAllDataMock } = setup()
      const updateSpy = jest.spyOn(controller, '_updateUIWithBooks')

      const loadPromise = controller.handleFileLoad(mockFile)
      await Promise.resolve()
      getDialogButtons(getOpenDialog())[0].click()
      await loadPromise

      expect(replaceAllDataMock).toHaveBeenCalledTimes(1)
      expect(mergeAllDataMock).not.toHaveBeenCalled()
      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy.mock.calls[0][0]).toEqual(importResult.books)
    })

    test('TC-C2 選合併 → 呼叫 mergeAllData 不呼叫 replaceAllData，UI 收 books', async () => {
      const { controller, replaceAllDataMock, mergeAllDataMock } = setup()
      const updateSpy = jest.spyOn(controller, '_updateUIWithBooks')

      const loadPromise = controller.handleFileLoad(mockFile)
      await Promise.resolve()
      getDialogButtons(getOpenDialog())[1].click()
      await loadPromise

      expect(mergeAllDataMock).toHaveBeenCalledTimes(1)
      expect(replaceAllDataMock).not.toHaveBeenCalled()
      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy.mock.calls[0][0]).toEqual(importResult.books)
    })

    test('TC-C3 取消 → handleFileLoad 提前 return，無副作用', async () => {
      const { controller, replaceAllDataMock, mergeAllDataMock } = setup()
      const readSpy = controller.bookFileImporter.reader.read
      const loadingSpy = jest.spyOn(controller, 'showLoading')
      const booksBefore = controller.currentBooks

      const loadPromise = controller.handleFileLoad(mockFile)
      await Promise.resolve()
      getDialogButtons(getOpenDialog())[2].click()
      await loadPromise

      // 不讀檔、不寫 storage、不顯示 loading、currentBooks 維持原狀
      expect(readSpy).not.toHaveBeenCalled()
      expect(replaceAllDataMock).not.toHaveBeenCalled()
      expect(mergeAllDataMock).not.toHaveBeenCalled()
      expect(loadingSpy).not.toHaveBeenCalled()
      expect(controller.currentBooks).toBe(booksBefore)
    })

    test('TC-C4 modal 在檔案基本驗證之後彈出（驗證失敗時不彈 modal）', async () => {
      const { controller } = setup()
      // importer 驗證階段拋出（Stage C 遷移：validator.validate 取代 _validateFileBasics）
      const validationError = new Error('檔案驗證失敗')
      controller.bookFileImporter.validator.validate = jest.fn(() => {
        throw validationError
      })
      const promptSpy = jest.spyOn(controller, 'promptImportMode')

      const invalidFile = { name: 'bad.txt', type: 'text/plain', size: 10 }
      let caught = null
      try {
        await controller.handleFileLoad(invalidFile)
      } catch (err) {
        caught = err
      }

      // 驗證階段拋出，promptImportMode 從未被呼叫
      expect(caught).toBe(validationError)
      expect(promptSpy).not.toHaveBeenCalled()
    })

    test('TC-C5 modal 在讀檔之前彈出（promptImportMode resolve 早於 reader.read）', async () => {
      const { controller } = setup()
      const promptSpy = jest.spyOn(controller, 'promptImportMode')
      const readSpy = controller.bookFileImporter.reader.read

      const loadPromise = controller.handleFileLoad(mockFile)
      await Promise.resolve()
      getDialogButtons(getOpenDialog())[0].click()
      await loadPromise

      // promptImportMode 的呼叫順序早於 reader.read（原 _readFileWithReader）
      expect(promptSpy.mock.invocationCallOrder[0])
        .toBeLessThan(readSpy.mock.invocationCallOrder[0])
    })
  })

  // ===========================================================================
  // Group D：合併模式錯誤處理（場景 6，與覆蓋對稱）
  // ===========================================================================
  describe('Group D：合併模式錯誤處理', () => {
    const mockFile = { name: 'books.json', type: 'application/json', size: 100 }
    const importResult = {
      books: [{ id: 'b1', title: '書一', cover: 'http://x/c1.jpg', readingStatus: 'reading' }],
      tags: [],
      tagCategories: []
    }

    /**
     * 建立 controller，stub importer 與 mergeAllData 回傳指定 writeResult
     * @param {Object} writeResult - mergeAllData mock 回傳值
     * @returns {Object} controller
     */
    function setupMerge (writeResult) {
      const controller = createController()
      // Stage C 遷移：reader.read 取代 importer._readFileWithReader
      controller.bookFileImporter.reader.read = jest
        .fn()
        .mockResolvedValue(importResult)
      const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')
      TagStorageAdapter.mergeAllData = jest.fn().mockResolvedValue(writeResult)
      TagStorageAdapter.replaceAllData = jest.fn()
      return controller
    }

    test('TC-D1 mergeAllData quota_exceeded → showError 含儲存空間不足，不更新 UI', async () => {
      const controller = setupMerge({ success: false, error: 'quota_exceeded' })
      const errorSpy = jest.spyOn(controller, 'showError')
      const updateSpy = jest.spyOn(controller, '_updateUIWithBooks')
      const booksBefore = controller.currentBooks

      const loadPromise = controller.handleFileLoad(mockFile)
      await Promise.resolve()
      getDialogButtons(getOpenDialog())[1].click()
      await loadPromise

      expect(errorSpy).toHaveBeenCalledTimes(1)
      expect(errorSpy.mock.calls[0][0]).toContain('儲存空間不足')
      expect(updateSpy).not.toHaveBeenCalled()
      expect(controller.currentBooks).toBe(booksBefore)
    })

    test('TC-D2 mergeAllData storage_error → showError 含儲存失敗，不更新 UI', async () => {
      const controller = setupMerge({ success: false, error: 'storage_error' })
      const errorSpy = jest.spyOn(controller, 'showError')
      const updateSpy = jest.spyOn(controller, '_updateUIWithBooks')

      const loadPromise = controller.handleFileLoad(mockFile)
      await Promise.resolve()
      getDialogButtons(getOpenDialog())[1].click()
      await loadPromise

      expect(errorSpy).toHaveBeenCalledTimes(1)
      expect(errorSpy.mock.calls[0][0]).toContain('儲存失敗')
      expect(updateSpy).not.toHaveBeenCalled()
    })

    test('TC-D3 mergeAllData success → _updateUIWithBooks 被呼叫一次', async () => {
      const controller = setupMerge({ success: true })
      const updateSpy = jest.spyOn(controller, '_updateUIWithBooks')

      const loadPromise = controller.handleFileLoad(mockFile)
      await Promise.resolve()
      getDialogButtons(getOpenDialog())[1].click()
      await loadPromise

      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy.mock.calls[0][0]).toEqual(importResult.books)
    })
  })

  // ===========================================================================
  // Group E：無障礙與鍵盤導覽（場景 7）
  // ===========================================================================
  describe('Group E：無障礙與鍵盤導覽', () => {
    test('TC-E1 對話框容器具 role/aria-modal/aria-labelledby', async () => {
      const controller = createController()
      const pending = controller.promptImportMode()
      await Promise.resolve()

      const dialog = getOpenDialog()
      const dialogEl = dialog.querySelector('.modal-dialog')
      expect(dialogEl.getAttribute('role')).toBe('dialog')
      expect(dialogEl.getAttribute('aria-modal')).toBe('true')
      // aria-labelledby 指向實際存在的標題元素
      const titleId = dialogEl.getAttribute('aria-labelledby')
      expect(document.getElementById(titleId)).not.toBeNull()

      getDialogButtons(dialog)[2].click()
      await pending
    })

    test('TC-E2 modal 開啟時初始焦點落於預設選項按鈕', async () => {
      const controller = createController()
      const pending = controller.promptImportMode()
      await Promise.resolve()

      const buttons = getDialogButtons(getOpenDialog())
      // 預設焦點為覆蓋按鈕（actions 陣列第一項）
      expect(document.activeElement).toBe(buttons[0])

      buttons[2].click()
      await pending
    })

    test('TC-E3 focus trap：最後一個按鈕按 Tab → 回到第一個按鈕', async () => {
      const controller = createController()
      const pending = controller.promptImportMode()
      await Promise.resolve()

      const dialog = getOpenDialog()
      const dialogEl = dialog.querySelector('.modal-dialog')
      const buttons = getDialogButtons(dialog)

      buttons[2].focus()
      dialogEl.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: false, bubbles: true }))

      expect(document.activeElement).toBe(buttons[0])

      buttons[2].click()
      await pending
    })

    test('TC-E4 focus trap：第一個按鈕按 Shift+Tab → 跳到最後一個按鈕', async () => {
      const controller = createController()
      const pending = controller.promptImportMode()
      await Promise.resolve()

      const dialog = getOpenDialog()
      const dialogEl = dialog.querySelector('.modal-dialog')
      const buttons = getDialogButtons(dialog)

      buttons[0].focus()
      dialogEl.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))

      expect(document.activeElement).toBe(buttons[2])

      buttons[2].click()
      await pending
    })

    test('TC-E5 modal 開啟期間 Tab 焦點不跑到 modal 外', async () => {
      const controller = createController()
      const pending = controller.promptImportMode()
      await Promise.resolve()

      const dialog = getOpenDialog()
      const dialogEl = dialog.querySelector('.modal-dialog')
      const buttons = getDialogButtons(dialog)

      buttons[2].focus()
      dialogEl.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: false, bubbles: true }))
      expect(buttons).toContain(document.activeElement)

      buttons[0].focus()
      dialogEl.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
      expect(buttons).toContain(document.activeElement)

      buttons[2].click()
      await pending
    })
  })

  // ===========================================================================
  // Group F：單一 modal 實例（場景 8）
  // ===========================================================================
  describe('Group F：單一 modal 實例', () => {
    test('TC-F1 modal 開啟中再次呼叫 promptImportMode → 只有一個對話框開啟', async () => {
      const controller = createController()

      const first = controller.promptImportMode()
      await Promise.resolve()
      // 重複呼叫
      const second = controller.promptImportMode()
      await Promise.resolve()

      // 只有一個開啟中的動態對話框
      const openOverlays = Array.from(document.querySelectorAll('.modal-overlay'))
        .filter(el => el.style.display !== 'none')
      expect(openOverlays.length).toBe(1)
      // 重複呼叫回傳同一 pending Promise
      expect(second).toBe(first)

      getDialogButtons(getOpenDialog())[0].click()
      await first
    })

    test('TC-F2 重複觸發後第一個 modal 的 pending Promise 仍正常 resolve', async () => {
      const controller = createController()

      const first = controller.promptImportMode()
      await Promise.resolve()
      const second = controller.promptImportMode()
      await Promise.resolve()

      // 做出選擇，兩個 Promise 引用皆 resolve 為同一值
      getDialogButtons(getOpenDialog())[1].click()
      const firstResult = await first
      const secondResult = await second

      expect(firstResult).toBe('merge')
      expect(secondResult).toBe('merge')
    })
  })

  // ===========================================================================
  // Group G：modal DOM 缺失防禦（Error Handling 表第 6 列）
  // ===========================================================================
  describe('Group G：modal DOM 缺失防禦', () => {
    test('TC-G1 modal 元素缺失 → console.error，handleFileLoad showError 中止', async () => {
      // 建立不含 modal 靜態錨點的 controller
      const controller = createController({ withModal: false })

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const errorSpy = jest.spyOn(controller, 'showError')

      const importResult = { books: [], tags: [], tagCategories: [] }
      // Stage C 遷移：reader.read 取代 importer._readFileWithReader
      controller.bookFileImporter.reader.read = jest
        .fn()
        .mockResolvedValue(importResult)
      const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')
      const replaceAllDataMock = jest.fn()
      const mergeAllDataMock = jest.fn()
      TagStorageAdapter.replaceAllData = replaceAllDataMock
      TagStorageAdapter.mergeAllData = mergeAllDataMock

      const mockFile = { name: 'books.json', type: 'application/json', size: 100 }
      await controller.handleFileLoad(mockFile)

      // promptImportMode 記錄 console.error
      expect(consoleErrorSpy).toHaveBeenCalled()
      // handleFileLoad showError 訊息含初始化失敗
      expect(errorSpy).toHaveBeenCalledTimes(1)
      expect(errorSpy.mock.calls[0][0]).toContain('匯入功能初始化失敗')
      // 不呼叫任何 *AllData
      expect(replaceAllDataMock).not.toHaveBeenCalled()
      expect(mergeAllDataMock).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })
})
