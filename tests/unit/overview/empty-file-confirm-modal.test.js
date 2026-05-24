/**
 * 空檔案覆蓋二次確認 modal 測試（UC-04 / W1-049）
 *
 * 測試範圍：
 * - Modal B 基礎顯示/隱藏與動態文案（Group A）
 * - 確認/取消途徑（Proceed / Cancel / Esc / 遮罩 / 內部冒泡防護）（Group B）
 * - 無障礙與焦點管理（ARIA / 預設焦點 / Tab 循環 / 還原）（Group C）
 * - 單一實例保護（pending Promise 複用）（Group D）
 * - DOM 缺失 fail-safe（Group E）
 * - execute 流程整合（Modal A → Modal B 銜接 / 持久化分流）（Group F）
 *
 * 對應 Phase 2 測試設計：6 群 26 個 TC（21 unit + 5 integration）。
 *
 * Mock 策略：jsdom 真實 DOM 事件 + 外部依賴 mock（TagStorageAdapter /
 * importer.reader.read / importer.validator.validate），不 mock 被測 API
 * （controller.confirmEmptyFileOverwrite / importFlowController.execute）。
 *
 * @jest-environment jsdom
 */

const { JSDOM } = require('jsdom')

/**
 * 建立含 Modal A + Modal B DOM 的 JSDOM 文檔
 *
 * @param {Object} options
 * @param {boolean} options.withEmptyConfirmModal - 是否注入 Modal B DOM
 *   （false 用於 Group E DOM 缺失 fail-safe 測試）
 * @param {boolean} options.withProceedBtn - 是否注入 Modal B 的 proceed 按鈕
 *   （用於 TC-E2 部分 DOM 缺失驗證）
 * @returns {{ dom: JSDOM, document: Document, window: Window }}
 */
function createDom ({ withEmptyConfirmModal = true, withProceedBtn = true } = {}) {
  // Modal A 始終注入（整合測試需 Modal A → Modal B 銜接）
  const modalAHtml = `
    <div id="importModeOverlay" class="modal-overlay" style="display: none;">
      <div id="importModeModal" class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="importModeTitle">
        <h2 id="importModeTitle" class="modal-title">選擇匯入模式</h2>
        <p class="modal-description">
          覆蓋模式會清空現有書庫後完全載入匯入資料；合併模式保留現有書庫，將匯入資料與既有書籍合併。
        </p>
        <div class="modal-actions">
          <button class="modal-btn modal-btn-primary" id="importModeOverwriteBtn">覆蓋（清空現有書庫）</button>
          <button class="modal-btn modal-btn-primary" id="importModeMergeBtn">合併（保留現有書庫）</button>
          <button class="modal-btn modal-btn-secondary" id="importModeCancelBtn">取消</button>
        </div>
      </div>
    </div>`

  const proceedBtnHtml = withProceedBtn
    ? '<button class="modal-btn modal-btn-danger" id="emptyFileConfirmProceedBtn">確認清空</button>'
    : ''

  const modalBHtml = withEmptyConfirmModal
    ? `
      <div id="emptyFileConfirmOverlay" class="modal-overlay" style="display: none;">
        <div id="emptyFileConfirmModal" class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="emptyFileConfirmTitle" aria-describedby="emptyFileConfirmDesc">
          <h2 id="emptyFileConfirmTitle" class="modal-title">確認清空書庫？</h2>
          <p id="emptyFileConfirmDesc" class="modal-description"></p>
          <div class="modal-actions">
            <button class="modal-btn modal-btn-secondary" id="emptyFileConfirmCancelBtn">取消</button>
            ${proceedBtnHtml}
          </div>
        </div>
      </div>`
    : ''

  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head><meta charset="UTF-8"><title>Readmoo書籍目錄</title></head>
    <body>
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
      ${modalAHtml}
      ${modalBHtml}
    </body>
    </html>
  `, { runScripts: 'outside-only', pretendToBeVisual: true })

  return { dom, document: dom.window.document, window: dom.window }
}

describe('空檔案覆蓋二次確認 modal（UC-04 / W1-049）', () => {
  let dom
  let document
  let window
  let mockEventBus
  let OverviewPageController

  /**
   * 建立 controller，並注入 Modal A + Modal B DOM
   */
  function createController ({ withEmptyConfirmModal = true, withProceedBtn = true } = {}) {
    const env = createDom({ withEmptyConfirmModal, withProceedBtn })
    dom = env.dom
    document = env.document
    window = env.window
    global.document = document
    global.window = window

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
    if (dom) {
      dom.window.close()
    }
    jest.clearAllMocks()
  })

  // ===========================================================================
  // Group A：Modal B 基礎顯示/隱藏行為（對應 AC-1.1, AC-1.5；場景 1/7）
  // ===========================================================================
  describe('Group A：Modal B 基礎顯示/隱藏行為', () => {
    test('TC-A1 confirmEmptyFileOverwrite 呼叫後 overlay 由隱藏轉為顯示', async () => {
      const controller = createController()
      const overlay = document.getElementById('emptyFileConfirmOverlay')

      expect(overlay.style.display).toBe('none')

      const pending = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()

      expect(overlay.style.display).not.toBe('none')

      document.getElementById('emptyFileConfirmCancelBtn').click()
      await pending
    })

    test('TC-A2 modal 顯示時兩按鈕皆存在且可見且未 disabled', async () => {
      const controller = createController()
      const pending = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()

      const proceedBtn = document.getElementById('emptyFileConfirmProceedBtn')
      const cancelBtn = document.getElementById('emptyFileConfirmCancelBtn')

      expect(proceedBtn).not.toBeNull()
      expect(cancelBtn).not.toBeNull()
      expect(proceedBtn.disabled).toBe(false)
      expect(cancelBtn.disabled).toBe(false)

      cancelBtn.click()
      await pending
    })

    test('TC-A3 N>=1 動態文案含書目數與「清空」、「無法復原」關鍵字', async () => {
      const controller = createController()
      const pending = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()

      const desc = document.getElementById('emptyFileConfirmDesc')
      expect(desc.textContent).toContain('5')
      expect(desc.textContent).toContain('清空')
      expect(desc.textContent).toContain('無法復原')

      document.getElementById('emptyFileConfirmCancelBtn').click()
      await pending
    })

    test('TC-A4 N===0 邊界文案：含「書庫為空」「仍要繼續」，不誤導具體數字', async () => {
      const controller = createController()
      const pending = controller.confirmEmptyFileOverwrite(0)
      await Promise.resolve()

      const desc = document.getElementById('emptyFileConfirmDesc')
      expect(desc.textContent).toContain('書庫為空')
      expect(desc.textContent).toContain('仍要繼續')
      // 不應出現具體的「0 本書」誤導文字（語意應為「無資料」而非「0 本」）
      expect(desc.textContent).not.toMatch(/0\s*本/)

      document.getElementById('emptyFileConfirmCancelBtn').click()
      await pending
    })

    test('TC-A5 標題與按鈕文字符合規格固定文案', async () => {
      const controller = createController()
      const pending = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()

      expect(document.getElementById('emptyFileConfirmTitle').textContent).toBe('確認清空書庫？')
      expect(document.getElementById('emptyFileConfirmProceedBtn').textContent).toBe('確認清空')
      expect(document.getElementById('emptyFileConfirmCancelBtn').textContent).toBe('取消')

      document.getElementById('emptyFileConfirmCancelBtn').click()
      await pending
    })

    test('TC-A6 resolve 前 modal 持續顯示', async () => {
      const controller = createController()
      const overlay = document.getElementById('emptyFileConfirmOverlay')

      const pending = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()

      // 未做出任何選擇，modal 仍可見
      expect(overlay.style.display).not.toBe('none')

      document.getElementById('emptyFileConfirmCancelBtn').click()
      await pending
    })
  })

  // ===========================================================================
  // Group B：確認/取消途徑（對應 AC-2.1~2.4；場景 1/2/3/4）
  // ===========================================================================
  describe('Group B：確認/取消途徑', () => {
    test('TC-B1 點 Proceed 鈕 → resolve true 且 modal 關閉', async () => {
      const controller = createController()
      const overlay = document.getElementById('emptyFileConfirmOverlay')

      const pending = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()

      document.getElementById('emptyFileConfirmProceedBtn').click()
      const result = await pending

      expect(result).toBe(true)
      expect(overlay.style.display).toBe('none')
    })

    test('TC-B2 點 Cancel 鈕 → resolve false 且 modal 關閉', async () => {
      const controller = createController()
      const overlay = document.getElementById('emptyFileConfirmOverlay')

      const pending = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()

      document.getElementById('emptyFileConfirmCancelBtn').click()
      const result = await pending

      expect(result).toBe(false)
      expect(overlay.style.display).toBe('none')
    })

    test('TC-B3 按 Esc 鍵 → resolve false 且 modal 關閉', async () => {
      const controller = createController()
      const overlay = document.getElementById('emptyFileConfirmOverlay')
      const modal = document.getElementById('emptyFileConfirmModal')

      const pending = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()

      modal.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      const result = await pending

      expect(result).toBe(false)
      expect(overlay.style.display).toBe('none')
    })

    test('TC-B4 點遮罩層 → resolve false 且 modal 關閉', async () => {
      const controller = createController()
      const overlay = document.getElementById('emptyFileConfirmOverlay')

      const pending = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()

      overlay.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
      const result = await pending

      expect(result).toBe(false)
      expect(overlay.style.display).toBe('none')
    })

    test('TC-B5 點 modal 內部空白不觸發取消（事件冒泡防護）', async () => {
      const controller = createController()
      const overlay = document.getElementById('emptyFileConfirmOverlay')
      const title = document.getElementById('emptyFileConfirmTitle')

      const pending = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()

      // 點 modal 內部元素（冒泡至 overlay，但 e.target !== overlay）
      title.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
      await Promise.resolve()

      // modal 仍可見，pending 未 resolve
      expect(overlay.style.display).not.toBe('none')

      // 收斂：點取消結束 pending
      document.getElementById('emptyFileConfirmCancelBtn').click()
      await pending
    })
  })

  // ===========================================================================
  // Group C：無障礙與焦點管理（對應 AC-4.1~4.4；場景 10）
  // ===========================================================================
  describe('Group C：無障礙與焦點管理', () => {
    test('TC-C1 modal 具 role=dialog、aria-modal、aria-labelledby、aria-describedby 四屬性', async () => {
      const controller = createController()
      const pending = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()

      const modal = document.getElementById('emptyFileConfirmModal')
      expect(modal.getAttribute('role')).toBe('dialog')
      expect(modal.getAttribute('aria-modal')).toBe('true')
      expect(modal.getAttribute('aria-labelledby')).toBe('emptyFileConfirmTitle')
      expect(modal.getAttribute('aria-describedby')).toBe('emptyFileConfirmDesc')

      document.getElementById('emptyFileConfirmCancelBtn').click()
      await pending
    })

    test('TC-C2 預設焦點落於 Cancel 鈕（destructive 防呆，與 Modal A 不同）', async () => {
      const controller = createController()
      const pending = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()

      const cancelBtn = document.getElementById('emptyFileConfirmCancelBtn')
      expect(document.activeElement).toBe(cancelBtn)

      cancelBtn.click()
      await pending
    })

    test('TC-C3 Tab 從 Proceed（最後一個）循環回 Cancel（第一個）', async () => {
      const controller = createController()
      const modal = document.getElementById('emptyFileConfirmModal')
      const cancelBtn = document.getElementById('emptyFileConfirmCancelBtn')
      const proceedBtn = document.getElementById('emptyFileConfirmProceedBtn')

      const pending = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()

      // 將焦點移到最後一個（proceed）
      proceedBtn.focus()
      expect(document.activeElement).toBe(proceedBtn)

      modal.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
      await Promise.resolve()

      // 應循環回第一個（cancel）
      expect(document.activeElement).toBe(cancelBtn)

      cancelBtn.click()
      await pending
    })

    test('TC-C4 Shift+Tab 從 Cancel（第一個）循環至 Proceed（最後一個）', async () => {
      const controller = createController()
      const modal = document.getElementById('emptyFileConfirmModal')
      const cancelBtn = document.getElementById('emptyFileConfirmCancelBtn')
      const proceedBtn = document.getElementById('emptyFileConfirmProceedBtn')

      const pending = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()

      // 預設焦點已在 cancelBtn
      expect(document.activeElement).toBe(cancelBtn)

      modal.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
      await Promise.resolve()

      expect(document.activeElement).toBe(proceedBtn)

      cancelBtn.click()
      await pending
    })

    test('TC-C5 Tab 焦點始終在 [cancel, proceed] 兩按鈕集合內', async () => {
      const controller = createController()
      const modal = document.getElementById('emptyFileConfirmModal')
      const cancelBtn = document.getElementById('emptyFileConfirmCancelBtn')
      const proceedBtn = document.getElementById('emptyFileConfirmProceedBtn')

      const pending = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()

      // 連續 Tab 兩次，焦點應始終為 cancelBtn 或 proceedBtn
      modal.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
      await Promise.resolve()
      expect([cancelBtn, proceedBtn]).toContain(document.activeElement)

      modal.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
      await Promise.resolve()
      expect([cancelBtn, proceedBtn]).toContain(document.activeElement)

      cancelBtn.click()
      await pending
    })

    test('TC-C6 modal 關閉後焦點還原至開啟前的元素（loadFileBtn）', async () => {
      const controller = createController()
      const loadFileBtn = document.getElementById('loadFileBtn')

      // 開啟前焦點在 loadFileBtn
      loadFileBtn.focus()
      expect(document.activeElement).toBe(loadFileBtn)

      const pending = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()

      document.getElementById('emptyFileConfirmCancelBtn').click()
      await pending

      // 焦點還原至 loadFileBtn
      expect(document.activeElement).toBe(loadFileBtn)
    })

    test('TC-C7 modal 開啟前焦點元素被刪除時 settle 不 throw 且 graceful fallback（W1-071 Finding #1）', async () => {
      // 業務情境：modal 開啟期間原焦點元素被其他流程從 DOM 移除（例如 SPA 路由切換、
      // 非同步資料載入完成後重新渲染）。settle 還原焦點時若無 optional chaining 守護，
      // previousFocus.focus() 會拋 TypeError（element 已脫離 DOM 但物件參考仍存活，
      // 部分 jsdom 行為下 focus 方法仍可呼叫但會無作用；嚴格場景下會拋）。
      // 本 TC 驗證：(1) settle 不 throw；(2) modal 正常關閉；(3) focus fallback 至 body 或合理元素
      const controller = createController()

      // 開啟前焦點落於可被移除的暫時元素（模擬 SPA 動態元素）
      const tempElement = document.createElement('button')
      tempElement.id = 'tempFocusable'
      document.body.appendChild(tempElement)
      tempElement.focus()
      expect(document.activeElement).toBe(tempElement)

      const pending = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()

      // modal 開啟後，原焦點元素被移除（模擬非同步 DOM 變更）
      tempElement.remove()

      // settle 觸發焦點還原：previousFocus 物件參考仍存在，但元素已脫離 DOM
      // 預期：?.focus?.() 守護不 throw；若元素 focus 方法仍可呼叫，
      // jsdom 會將 activeElement fallback 至 body
      let settleError = null
      try {
        document.getElementById('emptyFileConfirmCancelBtn').click()
        await pending
      } catch (err) {
        settleError = err
      }

      expect(settleError).toBeNull()
      // modal 已關閉
      expect(document.getElementById('emptyFileConfirmOverlay').style.display).toBe('none')
      // 焦點 fallback 至合理元素（body 或其他可聚焦元素），未崩潰至 null
      expect(document.activeElement).not.toBeNull()
    })
  })

  // ===========================================================================
  // Group D：單一實例保護（對應 §5.2 _emptyConfirmPending）
  // ===========================================================================
  describe('Group D：單一實例保護', () => {
    test('TC-D1 重複呼叫回傳同一 pending Promise 物件，DOM modal 仍為單一', async () => {
      const controller = createController()
      const pending1 = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()

      const pending2 = controller.confirmEmptyFileOverwrite(3)
      await Promise.resolve()

      // 同一 pending Promise（reference equal）
      expect(pending2).toBe(pending1)

      // DOM 中 modal 仍只有一個
      const modals = document.querySelectorAll('#emptyFileConfirmModal')
      expect(modals.length).toBe(1)

      document.getElementById('emptyFileConfirmCancelBtn').click()
      await pending1
    })

    test('TC-D2 重複呼叫後 click proceed 使兩個 pending 皆 resolve true', async () => {
      const controller = createController()
      const pending1 = controller.confirmEmptyFileOverwrite(5)
      await Promise.resolve()
      const pending2 = controller.confirmEmptyFileOverwrite(3)
      await Promise.resolve()

      document.getElementById('emptyFileConfirmProceedBtn').click()

      const [r1, r2] = await Promise.all([pending1, pending2])
      expect(r1).toBe(true)
      expect(r2).toBe(true)
    })
  })

  // ===========================================================================
  // Group E：DOM 缺失 fail-safe（對應 AC-2.7；場景 8）
  // ===========================================================================
  describe('Group E：DOM 缺失 fail-safe', () => {
    test('TC-E1 完整 Modal B DOM 缺失 → resolve false 且 console.error 被呼叫', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const controller = createController({ withEmptyConfirmModal: false })

      const result = await controller.confirmEmptyFileOverwrite(5)

      expect(result).toBe(false)
      expect(errorSpy).toHaveBeenCalled()

      errorSpy.mockRestore()
    })

    test('TC-E2 部分 DOM 缺失（缺 proceedBtn）→ resolve false（防禦廣度）', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const controller = createController({ withEmptyConfirmModal: true, withProceedBtn: false })

      const result = await controller.confirmEmptyFileOverwrite(5)

      expect(result).toBe(false)
      expect(errorSpy).toHaveBeenCalled()

      errorSpy.mockRestore()
    })
  })

  // ===========================================================================
  // Group F：execute 整合測試（對應 AC-1.2/1.3/1.4, AC-2.1/2.2/2.6；場景 5/6/9）
  // ===========================================================================
  describe('Group F：execute 流程整合', () => {
    let controller
    let mockFile
    let TagStorageAdapter

    /**
     * Group F 跨檔 mock 隔離強化（W1-071 Finding #3）：
     *
     * 業務情境：Group F 整合測試會對 TagStorageAdapter 模組屬性（replaceAllData /
     * mergeAllData）做 module-level 覆寫。Jest 並行執行多個測試檔時，若同檔內或
     * 跨檔 TC 共用同一 require cache 實例，後續 TC 可能讀到前一 TC 的 mock 殘留，
     * 造成 expect(mock).toHaveBeenCalledTimes(1) 在 isolation 下通過、並行下失敗。
     *
     * 雖然頂層 beforeEach（第 ~155 行）已呼叫 jest.resetModules()，但保險起見在
     * Group F 內再次明確 reset 並清除既有 mock，避免跨 TC 污染。
     */
    beforeEach(() => {
      jest.resetModules()
      // 明確清除 TagStorageAdapter mock（避免上一 TC 殘留 mock fn）
      try {
        const adapter = require('src/storage/adapters/tag-storage-adapter')
        if (adapter && typeof adapter.replaceAllData === 'function' && adapter.replaceAllData.mockReset) {
          adapter.replaceAllData.mockReset()
        }
        if (adapter && typeof adapter.mergeAllData === 'function' && adapter.mergeAllData.mockReset) {
          adapter.mergeAllData.mockReset()
        }
      } catch (_) {
        // adapter 尚未載入或 mock 未設過：忽略
      }
    })

    /**
     * 建立 Group F 整合測試 controller，mock reader.read / replaceAllData / mergeAllData / validate
     */
    function setupExecuteController ({ readBooks, currentBooks = [{ id: 'b0', title: '既有書' }] }) {
      controller = createController()
      // 模擬目前書庫
      controller.currentBooks = currentBooks
      // 注入合法 mockFile（reader 讀取不會自動觸發 validate 失敗）
      mockFile = new window.File(['{}'], 'test.json', { type: 'application/json' })

      // mock importer 內部 reader/validator
      controller.bookFileImporter.validator = { validate: jest.fn() }
      controller.bookFileImporter.reader = {
        read: jest.fn().mockResolvedValue({
          books: readBooks,
          tags: [],
          tagCategories: []
        })
      }
      // BookFileImporter.validate/read 外觀方法重新指向新 reader/validator
      controller.bookFileImporter.validate = (file) => controller.bookFileImporter.validator.validate(file)
      controller.bookFileImporter.read = (file) => controller.bookFileImporter.reader.read(file)

      // mock TagStorageAdapter（透過模組覆寫，importFlowController 持有的是 module ref）
      TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')
      TagStorageAdapter.replaceAllData = jest.fn().mockResolvedValue({ success: true })
      TagStorageAdapter.mergeAllData = jest.fn().mockResolvedValue({ success: true })

      // 監聽 _updateUIWithBooks
      jest.spyOn(controller, '_updateUIWithBooks').mockImplementation(() => {})
      jest.spyOn(controller, 'showLoading').mockImplementation(() => {})

      return controller
    }

    test('TC-F1 overwrite + 空檔案 + 確認 → replaceAllData 被呼叫（payload.books===[]）', async () => {
      controller = setupExecuteController({ readBooks: [], currentBooks: [{ id: 'a' }, { id: 'b' }] })

      // 啟動 handleFileLoad（會等待 Modal A）
      const flowPromise = controller.handleFileLoad(mockFile)

      // 等待 Modal A DOM 出現後點覆蓋
      await Promise.resolve()
      await Promise.resolve()
      document.getElementById('importModeOverwriteBtn').click()

      // 等到 Modal B 顯示後點確認
      // 流程中等待 reader.read + Modal B 顯示，多 await 數輪確保 micro-tasks 排空
      for (let i = 0; i < 5; i++) await Promise.resolve()
      document.getElementById('emptyFileConfirmProceedBtn').click()

      await flowPromise

      expect(TagStorageAdapter.replaceAllData).toHaveBeenCalledTimes(1)
      expect(TagStorageAdapter.replaceAllData.mock.calls[0][0].books).toEqual([])
      expect(TagStorageAdapter.mergeAllData).not.toHaveBeenCalled()
      expect(controller._updateUIWithBooks).toHaveBeenCalledTimes(1)
    })

    test('TC-F2 overwrite + 空檔案 + 取消 → 無副作用，showLoading 未被呼叫（修補項 2）', async () => {
      controller = setupExecuteController({ readBooks: [], currentBooks: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }] })
      const onImportSuccessSpy = controller._updateUIWithBooks
      const originalBooks = controller.currentBooks

      const flowPromise = controller.handleFileLoad(mockFile)
      await Promise.resolve()
      await Promise.resolve()
      document.getElementById('importModeOverwriteBtn').click()

      for (let i = 0; i < 5; i++) await Promise.resolve()
      document.getElementById('emptyFileConfirmCancelBtn').click()

      await flowPromise

      expect(TagStorageAdapter.replaceAllData).not.toHaveBeenCalled()
      expect(TagStorageAdapter.mergeAllData).not.toHaveBeenCalled()
      // currentBooks 保持原狀
      expect(controller.currentBooks).toBe(originalBooks)
      expect(controller.currentBooks.length).toBe(5)
      // _updateUIWithBooks（onImportSuccess callback）不被呼叫
      expect(onImportSuccessSpy).not.toHaveBeenCalled()
      // showLoading 未被呼叫（修補項 2：showLoading 後移至持久化前，取消分支不觸發 loading）
      expect(controller.showLoading).not.toHaveBeenCalled()
    })

    test('TC-F3 overwrite + 非空檔案 → 直接 replaceAllData，Modal B 不顯示', async () => {
      controller = setupExecuteController({ readBooks: [{ id: 'b1', title: 'book1' }] })
      const overlayB = document.getElementById('emptyFileConfirmOverlay')

      const flowPromise = controller.handleFileLoad(mockFile)
      await Promise.resolve()
      await Promise.resolve()
      document.getElementById('importModeOverwriteBtn').click()

      await flowPromise

      // Modal B 始終隱藏
      expect(overlayB.style.display).toBe('none')
      expect(TagStorageAdapter.replaceAllData).toHaveBeenCalledTimes(1)
    })

    test('TC-F4 merge + 空檔案 → 直接 mergeAllData，Modal B 不顯示', async () => {
      controller = setupExecuteController({ readBooks: [] })
      const overlayB = document.getElementById('emptyFileConfirmOverlay')

      const flowPromise = controller.handleFileLoad(mockFile)
      await Promise.resolve()
      await Promise.resolve()
      document.getElementById('importModeMergeBtn').click()

      await flowPromise

      // Modal B 始終隱藏
      expect(overlayB.style.display).toBe('none')
      expect(TagStorageAdapter.mergeAllData).toHaveBeenCalledTimes(1)
      expect(TagStorageAdapter.mergeAllData.mock.calls[0][0].books).toEqual([])
    })

    test('TC-F5 Modal A → Modal B closure 序列化（A closed 才 B open）', async () => {
      controller = setupExecuteController({ readBooks: [], currentBooks: [{ id: 'a' }] })
      const overlayA = document.getElementById('importModeOverlay')
      const overlayB = document.getElementById('emptyFileConfirmOverlay')

      const flowPromise = controller.handleFileLoad(mockFile)
      await Promise.resolve()
      await Promise.resolve()
      document.getElementById('importModeOverwriteBtn').click()

      // Modal A click 後等候多輪，給 reader.read + Modal B 開啟時間
      for (let i = 0; i < 5; i++) await Promise.resolve()

      // 此時應為：Modal A 已 closed (display: none)，Modal B 已 open (display: flex)
      expect(overlayA.style.display).toBe('none')
      expect(overlayB.style.display).not.toBe('none')

      // 收斂：取消 Modal B 結束 flow
      document.getElementById('emptyFileConfirmCancelBtn').click()
      await flowPromise
    })
  })
})
