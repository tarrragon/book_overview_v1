/**
 * ImportFlowController - 匯入流程控制器（0.19.0-W1-048.5）
 *
 * 從 OverviewPageController 抽出的匯入流程模組，職責限縮於：
 * - promptImportMode：顯示模式選擇 modal，回傳使用者選擇的模式
 * - execute：完整匯入流程編排（驗證 → modal → 讀檔 → 持久化 → UI 更新）
 *
 * 設計考量：
 * - controller 委派：OverviewPageController.handleFileLoad / promptImportMode
 *   為薄包裝，內部委派至本模組同名方法
 * - 依賴注入：所有外部相依（importer / storage adapter / DOM elements /
 *   UI callbacks）透過 constructor 注入，便於測試與替換
 * - tagStorageAdapter 為模組參考而非物件快照：consumer 端測試以 `module.method
 *   = mockFn` 方式覆寫，本模組 execute 時讀取最新 method 參考，確保 mock 生效
 *
 * 不在本模組職責：
 * - 檔案驗證與讀取細節（委派 BookFileImporter）
 * - 持久化策略（委派 TagStorageAdapter.replaceAllData / mergeAllData）
 * - UI 更新（透過 onImportSuccess callback 反向通知 controller）
 */

/**
 * 匯入模式 modal DOM 缺失的哨兵值（UC-04）。
 *
 * promptImportMode 的合法回傳為 'overwrite' / 'merge' / null（取消）。
 * 當 modal DOM 元素未注入時需回傳一個與三者皆不碰撞的值，使 execute
 * 能將「DOM 缺失」（應 showError）與「使用者取消」（應靜默中止）分流。
 * 用 Symbol 確保唯一性，不與任何字串 / null 相等。
 */
const IMPORT_MODE_MODAL_MISSING = Symbol('import-mode-modal-missing')

/**
 * 匯入模式常數。與 OverviewPageController 的 CONSTANTS.IMPORT_MODE 對齊，
 * 透過此模組獨立暴露讓 ImportFlowController 不需依賴 controller。
 */
const IMPORT_MODE = {
  OVERWRITE: 'overwrite',
  MERGE: 'merge'
}

/**
 * @typedef {Object} ImportFlowDeps
 * @property {Object} bookFileImporter - 檔案驗證/讀取模組（validate / read）
 * @property {Object} elements - import-mode modal + empty-file-confirm modal 相關 DOM 元素引用
 * @property {HTMLElement} elements.importModeOverlay - Modal A 遮罩
 * @property {HTMLElement} elements.importModeModal - Modal A 容器
 * @property {HTMLElement} elements.importModeOverwriteBtn - Modal A 覆蓋按鈕
 * @property {HTMLElement} elements.importModeMergeBtn - Modal A 合併按鈕
 * @property {HTMLElement} elements.importModeCancelBtn - Modal A 取消按鈕
 * @property {HTMLElement} [elements.emptyFileConfirmOverlay] - Modal B（W1-049）遮罩
 * @property {HTMLElement} [elements.emptyFileConfirmModal] - Modal B 容器
 * @property {HTMLElement} [elements.emptyFileConfirmTitle] - Modal B 標題（aria-labelledby 目標）
 * @property {HTMLElement} [elements.emptyFileConfirmDesc] - Modal B 動態說明（aria-describedby 目標）
 * @property {HTMLElement} [elements.emptyFileConfirmProceedBtn] - Modal B 確認清空按鈕
 * @property {HTMLElement} [elements.emptyFileConfirmCancelBtn] - Modal B 取消按鈕
 * @property {Document} document - DOM 文檔（焦點管理用）
 * @property {Object} tagStorageAdapter - 模組參考，需含 replaceAllData / mergeAllData
 * @property {Function} showError - 顯示錯誤訊息
 * @property {Function} showLoading - 顯示載入狀態
 * @property {Function} onImportSuccess - 匯入成功的 UI 更新 callback(books)
 * @property {Function} [promptImportModeFn] - 選填的 promptImportMode 呼叫委派
 *   設計用途：當外部（如 controller）需保留對 promptImportMode 的呼叫可觀測性
 *   （測試 spy / 行為攔截）時，可注入此 callback。內部 execute 流程透過此
 *   callback 觸發 modal，而非直接呼叫 this.promptImportMode。
 *   未注入時 execute 使用 this.promptImportMode 自身（含 modal 邏輯）。
 * @property {Function} [getCurrentBookCount] - 取得目前 currentBooks.length（W1-049）
 *   用於 Modal B 動態文案；未注入時預設回 0。
 * @property {Function} [confirmEmptyFileOverwriteFn] - 選填的 confirmEmptyFileOverwrite 呼叫委派（W1-049）
 *   簽名：(currentBookCount: number) => Promise<boolean>。與 promptImportModeFn 同模式，
 *   保留 controller-level spy 可觀測性。未注入時 execute 直接呼叫 this.confirmEmptyFileOverwrite。
 */

class ImportFlowController {
  /**
   * 建構匯入流程控制器
   *
   * @param {ImportFlowDeps} deps - 依賴注入物件
   */
  constructor (deps) {
    this.bookFileImporter = deps.bookFileImporter
    this.elements = deps.elements
    this.document = deps.document
    this.tagStorageAdapter = deps.tagStorageAdapter
    this.showError = deps.showError
    this.showLoading = deps.showLoading
    this.onImportSuccess = deps.onImportSuccess
    // 可選的 promptImportMode 呼叫委派：未注入時 execute 內部使用 this.promptImportMode
    this._promptImportModeFn = deps.promptImportModeFn || null

    // W1-049：取得目前 currentBooks.length（Modal B 動態文案用）；未注入時預設回 0
    this._getCurrentBookCount = typeof deps.getCurrentBookCount === 'function'
      ? deps.getCurrentBookCount
      : () => 0

    // W1-049：可選的 confirmEmptyFileOverwrite 呼叫委派（同 promptImportModeFn 模式）
    this._confirmEmptyFileOverwriteFn = deps.confirmEmptyFileOverwriteFn || null

    // modal 單一實例保護：modal 開啟期間 pending Promise 暫存於此，
    // 重複觸發時回傳同一 Promise，不開第二個 modal。null 表示無進行中的 modal。
    this._importModePending = null

    // W1-049：Modal B 單一實例保護（同 Modal A 模式，獨立變數避免干擾）
    this._emptyConfirmPending = null

    // 匯入模式 modal 開啟前的焦點元素，modal 關閉時還原焦點至此（無障礙）
    this._importModePreviousFocus = null

    // W1-049：Modal B 開啟前的焦點元素（獨立變數，與 Modal A 隔離）
    this._emptyConfirmPreviousFocus = null
  }

  /**
   * 顯示匯入模式選擇 modal，回傳使用者選擇的模式（UC-04 / IMP-E）
   *
   * @returns {Promise<'overwrite' | 'merge' | null | symbol>}
   *   - 'overwrite'：使用者選擇覆蓋模式（清空現有書庫後載入）
   *   - 'merge'：使用者選擇合併模式（保留現有書庫並合併）
   *   - null：使用者取消（取消鈕 / Esc / 點遮罩）
   *   - IMPORT_MODE_MODAL_MISSING：modal DOM 未注入（呼叫端應 showError）
   *
   * 設計：
   * - modal 一次只允許一個實例；重複呼叫回傳「同一個」pending Promise 物件（場景 8）。
   *   本方法刻意不用 async（async 會將回傳值包成新 Promise，破壞 pending Promise
   *   的物件識別性），改為直接回傳 Promise 物件以保證重複呼叫得到同一引用。
   * - resolve 前 modal 持續顯示，不自動關閉。
   * - settle 統一收斂出口：移除監聽器 → 隱藏 modal → 清 pending 旗標 → 還原焦點 → resolve。
   */
  promptImportMode () {
    const overlay = this.elements.importModeOverlay
    const modal = this.elements.importModeModal
    const overwriteBtn = this.elements.importModeOverwriteBtn
    const mergeBtn = this.elements.importModeMergeBtn
    const cancelBtn = this.elements.importModeCancelBtn

    // DOM 缺失防禦：任一元素為 null 視為設計缺陷，回傳哨兵值供 execute 分流
    if (!overlay || !modal || !overwriteBtn || !mergeBtn || !cancelBtn) {
      // eslint-disable-next-line no-console
      console.error('[ERROR] 匯入模式 modal 元素缺失，無法顯示模式選擇')
      return Promise.resolve(IMPORT_MODE_MODAL_MISSING)
    }

    // 單一實例保護：modal 已開啟時回傳既有 pending Promise，不開第二個（場景 8）
    if (this._importModePending) {
      return this._importModePending
    }

    this._importModePending = new Promise((resolve) => {
      // 焦點還原起點：記錄 modal 開啟前的焦點元素
      this._importModePreviousFocus =
        (this.document && this.document.activeElement) || null

      const focusable = [overwriteBtn, mergeBtn, cancelBtn]

      // focus trap：Tab / Shift+Tab 在三按鈕集合內循環，不跑出 modal
      const handleFocusTrap = (event) => {
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = this.document.activeElement
        if (event.shiftKey && active === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && active === last) {
          event.preventDefault()
          first.focus()
        }
      }

      // keydown 處理：Esc 取消、Tab 進入 focus trap
      const onKeydown = (event) => {
        if (event.key === 'Escape') {
          settle(null)
        } else if (event.key === 'Tab') {
          handleFocusTrap(event)
        }
      }

      // 遮罩點擊：只有點遮罩本身（非冒泡自 modal 內部）才視為取消（場景 5 / TC-B4）
      const onOverlayClick = (event) => {
        if (event.target === overlay) {
          settle(null)
        }
      }

      const onOverwrite = () => settle(IMPORT_MODE.OVERWRITE)
      const onMerge = () => settle(IMPORT_MODE.MERGE)
      const onCancel = () => settle(null)

      // 統一收斂出口：移除監聽器 → 隱藏 modal → 清 pending 旗標 → 還原焦點 → resolve
      const settle = (result) => {
        overwriteBtn.removeEventListener('click', onOverwrite)
        mergeBtn.removeEventListener('click', onMerge)
        cancelBtn.removeEventListener('click', onCancel)
        overlay.removeEventListener('click', onOverlayClick)
        modal.removeEventListener('keydown', onKeydown)

        this._hideImportModeModal()
        this._importModePending = null

        // 焦點還原：modal 關閉後焦點回到開啟前的元素
        if (
          this._importModePreviousFocus &&
          typeof this._importModePreviousFocus.focus === 'function'
        ) {
          this._importModePreviousFocus.focus()
        }
        this._importModePreviousFocus = null

        resolve(result)
      }

      // 綁定四種出口
      overwriteBtn.addEventListener('click', onOverwrite)
      mergeBtn.addEventListener('click', onMerge)
      cancelBtn.addEventListener('click', onCancel)
      overlay.addEventListener('click', onOverlayClick)
      modal.addEventListener('keydown', onKeydown)

      // 顯示 modal 並設初始焦點至預設按鈕（覆蓋）
      this._showImportModeModal()
      overwriteBtn.focus()
    })

    return this._importModePending
  }

  /**
   * 顯示匯入模式 modal（UC-04）
   * @private
   */
  _showImportModeModal () {
    if (this.elements.importModeOverlay) {
      this.elements.importModeOverlay.style.display = 'flex'
    }
  }

  /**
   * 隱藏匯入模式 modal（UC-04）
   * @private
   */
  _hideImportModeModal () {
    if (this.elements.importModeOverlay) {
      this.elements.importModeOverlay.style.display = 'none'
    }
  }

  /**
   * 顯示空檔案覆蓋二次確認 modal（Modal B / W1-049）
   *
   * 業務情境：UC-04 覆蓋模式匯入 books 為空的檔案會清空整個 storage，且無 undo
   * 機制，屬不可逆 destructive 操作。本方法提供二次確認 UX 防呆，避免使用者誤
   * 選空檔案造成資料遺失。
   *
   * @param {number} currentBookCount - 目前書庫的書目數（用於動態文案）
   * @returns {Promise<boolean>}
   *   - true：使用者明確點「確認清空」按鈕
   *   - false：取消（取消鈕 / Esc / 點遮罩） OR DOM 缺失（fail-safe 安全預設）
   *
   * 設計：
   * - destructive 預設焦點落於 Cancel 鈕（與 Modal A 的覆蓋鈕預設焦點不同），
   *   符合 Material Design / WCAG 防呆原則——避免使用者直覺 Enter 即清空資料。
   * - DOM 缺失視為「使用者未確認」，安全 default = 不清空（與 Modal A 不同，
   *   Modal A 用 sentinel 區分「DOM 缺失」與「取消」，Modal B 兩者合併為 false
   *   即可，因兩者後續處理相同：不寫 storage）。
   * - modal 一次只允許一個實例；重複呼叫回傳同一個 pending Promise 物件。
   * - settle 統一收斂出口：移除監聽器 → 隱藏 modal → 清 pending 旗標 → 還原焦點 → resolve。
   */
  confirmEmptyFileOverwrite (currentBookCount) {
    const overlay = this.elements.emptyFileConfirmOverlay
    const modal = this.elements.emptyFileConfirmModal
    const desc = this.elements.emptyFileConfirmDesc
    const proceedBtn = this.elements.emptyFileConfirmProceedBtn
    const cancelBtn = this.elements.emptyFileConfirmCancelBtn

    // DOM 缺失防禦：任一元素為 null 視為設計缺陷，安全 default = false（不清空）
    if (!overlay || !modal || !desc || !proceedBtn || !cancelBtn) {
      // eslint-disable-next-line no-console
      console.error('[ERROR] 空檔案確認 modal 元素缺失，預設為不清空（安全防護）')
      return Promise.resolve(false)
    }

    // 單一實例保護：modal 已開啟時回傳既有 pending Promise
    if (this._emptyConfirmPending) {
      return this._emptyConfirmPending
    }

    // 動態填入說明文字（N>=1 與 N===0 文案差異）
    const count = Number.isInteger(currentBookCount) ? currentBookCount : 0
    if (count >= 1) {
      desc.textContent = `此檔案不包含任何書目資料。繼續將清空目前書庫中的 ${count} 本書，且無法復原。`
    } else {
      desc.textContent = '此檔案不包含任何書目資料。目前書庫為空，無資料可清空。仍要繼續嗎？'
    }

    this._emptyConfirmPending = new Promise((resolve) => {
      // 焦點還原起點：記錄 modal 開啟前的焦點元素
      this._emptyConfirmPreviousFocus =
        (this.document && this.document.activeElement) || null

      // focus trap 集合：[cancel, proceed]，預設焦點 cancel（destructive 防呆）
      const focusable = [cancelBtn, proceedBtn]

      const handleFocusTrap = (event) => {
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = this.document.activeElement
        if (event.shiftKey && active === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && active === last) {
          event.preventDefault()
          first.focus()
        }
      }

      const onKeydown = (event) => {
        if (event.key === 'Escape') {
          settle(false)
        } else if (event.key === 'Tab') {
          handleFocusTrap(event)
        }
      }

      // 遮罩點擊：只有點遮罩本身（非冒泡自 modal 內部）才視為取消
      const onOverlayClick = (event) => {
        if (event.target === overlay) {
          settle(false)
        }
      }

      const onProceed = () => settle(true)
      const onCancel = () => settle(false)

      // 統一收斂出口：移除監聽器 → 隱藏 modal → 清 pending 旗標 → 還原焦點 → resolve
      const settle = (result) => {
        proceedBtn.removeEventListener('click', onProceed)
        cancelBtn.removeEventListener('click', onCancel)
        overlay.removeEventListener('click', onOverlayClick)
        modal.removeEventListener('keydown', onKeydown)

        this._hideEmptyConfirmModal()
        this._emptyConfirmPending = null

        if (
          this._emptyConfirmPreviousFocus &&
          typeof this._emptyConfirmPreviousFocus.focus === 'function'
        ) {
          this._emptyConfirmPreviousFocus.focus()
        }
        this._emptyConfirmPreviousFocus = null

        resolve(result)
      }

      // 綁定四種出口
      proceedBtn.addEventListener('click', onProceed)
      cancelBtn.addEventListener('click', onCancel)
      overlay.addEventListener('click', onOverlayClick)
      modal.addEventListener('keydown', onKeydown)

      // 顯示 modal 並設初始焦點至 Cancel（destructive 安全預設）
      this._showEmptyConfirmModal()
      cancelBtn.focus()
    })

    return this._emptyConfirmPending
  }

  /**
   * 顯示空檔案確認 modal（W1-049）
   * @private
   */
  _showEmptyConfirmModal () {
    if (this.elements.emptyFileConfirmOverlay) {
      this.elements.emptyFileConfirmOverlay.style.display = 'flex'
    }
  }

  /**
   * 隱藏空檔案確認 modal（W1-049）
   * @private
   */
  _hideEmptyConfirmModal () {
    if (this.elements.emptyFileConfirmOverlay) {
      this.elements.emptyFileConfirmOverlay.style.display = 'none'
    }
  }

  /**
   * 執行完整匯入流程：驗證 → modal → 讀檔 → 持久化 → callback
   *
   * 流程：
   * 1. 驗證階段（importer 處理，失敗會 throw）——先於 modal
   * 2. 模式選擇 modal：驗證通過後、讀檔前彈出
   * 3. modal DOM 缺失分流：showError 後中止（設計缺陷）
   * 4. 取消分流：靜默中止——不讀檔、不寫 storage、UI 不變
   * 5. 讀檔：importer 回傳 ImportResult（INV-1 保證三欄位恆陣列）
   * 6. 依模式分流持久化：覆蓋走 replaceAllData，合併走 mergeAllData
   * 7. 持久化成功才更新 UI；失敗中止並 showError
   *
   * @param {File} file - 使用者選取的檔案
   * @returns {Promise<void>}
   *
   * 注意：本方法回傳 Promise<void>，與舊版 handleFileLoad 簽名一致，保持
   * 既有測試（import-mode-modal.test.js 等）的呼叫形式不變。內部完成五種
   * 結局（completed/cancelled/modal_missing/quota_exceeded/storage_error）
   * 均以 showError 或 UI callback 反映，呼叫端不需取結果。
   */
  async execute (file) {
    // 1. 驗證階段由 importer 處理（會呼叫 showError 並 throw）——先於 modal
    this.bookFileImporter.validate(file)

    // 2. 模式選擇 modal：驗證通過後、讀檔前彈出
    // 透過 promptImportModeFn callback（若注入）走外部入口，保留 controller-level
    // 測試 spy 對 promptImportMode 的可觀測性；未注入時直接呼叫自身方法
    const mode = this._promptImportModeFn
      ? await this._promptImportModeFn()
      : await this.promptImportMode()

    // 3. modal DOM 缺失分流：視為設計缺陷，showError 後中止
    if (mode === IMPORT_MODE_MODAL_MISSING) {
      this.showError('匯入功能初始化失敗')
      return
    }

    // 4. 取消分流：使用者取消為正常操作，靜默中止——不讀檔、不寫 storage、UI 不變
    if (mode === null) {
      return
    }

    // 5. 讀檔（modal resolve 之後）：importer 回傳 ImportResult（INV-1 保證三欄位恆陣列）
    //
    // W1-049 修補項 2 決策：showLoading 自此處移除，後移至步驟 6.5（持久化前）。
    // 原因：(a) 對齊「showLoading 緊鄰 destructive 寫入」原則，消除 Modal B 取消
    // 分支的 loading 殘留風險；(b) 避免新增 hideLoading dep 與額外的 false 分支處理；
    // (c) 空檔案 read 通常 < 50ms，無 loading 對 UX 影響可忽略。
    // 大檔案 read UX loading 屬獨立 issue，與本 ticket 空檔案防呆無關。
    const importResult = await this.bookFileImporter.read(file)

    // 6. W1-049：覆蓋模式 + 空檔案二次確認（destructive 防呆）
    // 觸發條件：mode === 'overwrite' AND importResult.books.length === 0
    // 不觸發：merge 模式（no-op，無破壞性）/ overwrite + 非空（正常覆蓋）
    if (mode === IMPORT_MODE.OVERWRITE && importResult.books.length === 0) {
      const proceed = this._confirmEmptyFileOverwriteFn
        ? await this._confirmEmptyFileOverwriteFn(this._getCurrentBookCount())
        : await this.confirmEmptyFileOverwrite(this._getCurrentBookCount())
      if (!proceed) {
        // 使用者取消 OR Modal B DOM 缺失：靜默中止，不寫 storage、無 loading 殘留
        return
      }
    }

    // 6.5 W1-049：showLoading 後移至此（持久化前），緊鄰 destructive 寫入
    this.showLoading('正在儲存匯入資料...')

    // 7. 依模式分流持久化：覆蓋走 replaceAllData，合併走 mergeAllData
    const payload = {
      books: importResult.books,
      tags: importResult.tags,
      tagCategories: importResult.tagCategories
    }
    const writeResult = mode === IMPORT_MODE.OVERWRITE
      ? await this.tagStorageAdapter.replaceAllData(payload)
      : await this.tagStorageAdapter.mergeAllData(payload)

    // 7. 持久化成功才更新 UI；失敗中止並 showError（覆蓋 / 合併共用，回傳契約對稱）
    if (writeResult.success === true) {
      this.onImportSuccess(importResult.books)
    } else if (writeResult.error === 'quota_exceeded') {
      this.showError('儲存空間不足，匯入未完成')
    } else {
      this.showError('儲存失敗，已還原原有資料')
    }
  }
}

// Node.js 環境：CommonJS 匯出（與專案其他模組一致）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ImportFlowController,
    IMPORT_MODE_MODAL_MISSING,
    IMPORT_MODE
  }
}
