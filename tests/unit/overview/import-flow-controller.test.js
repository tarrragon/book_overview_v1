/**
 * ImportFlowController.execute() 單元測試（0.19.0-W1-058）
 *
 * 測試範圍（嚴格依 W1-058 acceptance，不擴張 W1-049 路徑）：
 * - 主路徑：validate → modal(overwrite) → read → replaceAllData → onImportSuccess(books)
 * - 主路徑（merge）：modal(merge) → mergeAllData 分流
 * - 取消路徑：modal → null → 靜默中止（不讀檔、不寫 storage、不更新 UI）
 * - modal_missing 路徑：modal → IMPORT_MODE_MODAL_MISSING → showError 後中止
 * - storage_error 路徑：writeResult.success===false → showError（quota_exceeded vs 一般）
 * - DI 注入：所有 5 個依賴（bookFileImporter / tagStorageAdapter / showError /
 *   showLoading / onImportSuccess）為 mock，斷言呼叫時機與參數
 *
 * 設計考量：
 * - execute() 回傳 Promise<void>（無 reason / books 回傳值），4 條路徑差異透過
 *   side effect 觀察：呼叫了哪些 mock、傳了什麼參數、UI callback 是否被觸發
 * - 不 mock 被測類別（ImportFlowController），直接 new 並注入純 mock deps
 * - 不涉及 jsdom / 真實 DOM：execute() 流程透過 promptImportModeFn callback 注入
 *   解耦 modal 互動細節（modal UX 測試由 import-mode-modal.test.js 覆蓋）
 *
 * 範圍邊界（不在本 ticket）：
 * - Modal A modal 行為（promptImportMode 內部）→ import-mode-modal.test.js
 * - Modal B 空檔案二次確認（W1-049 路徑）→ empty-file-confirm-modal.test.js
 * - importer 驗證/讀取細節 → book-file-importer*.test.js
 */

const {
  ImportFlowController,
  IMPORT_MODE_MODAL_MISSING
} = require('src/overview/import-flow-controller')

describe('ImportFlowController.execute() 4 條路徑（W1-058）', () => {
  let mockBookFileImporter
  let mockTagStorageAdapter
  let mockShowError
  let mockShowLoading
  let mockOnImportSuccess
  let mockPromptImportModeFn
  let controller
  let fakeFile

  /**
   * 建立預設成功的 ImportResult（INV-1：三欄位恆陣列）
   */
  const makeImportResult = (overrides = {}) => ({
    books: [{ id: 'b1', title: 'Book 1' }],
    tags: [],
    tagCategories: [],
    ...overrides
  })

  /**
   * 以預設成功 mock 建立 controller；個別 test 可在呼叫 execute 前覆寫 mock 行為
   */
  const buildController = (depOverrides = {}) => {
    return new ImportFlowController({
      bookFileImporter: mockBookFileImporter,
      // execute() 不直接觸 DOM；elements / document 留空物件即可（modal 行為由 promptImportModeFn 接管）
      elements: {},
      document: {},
      tagStorageAdapter: mockTagStorageAdapter,
      showError: mockShowError,
      showLoading: mockShowLoading,
      onImportSuccess: mockOnImportSuccess,
      promptImportModeFn: mockPromptImportModeFn,
      ...depOverrides
    })
  }

  beforeEach(() => {
    // 預設行為：validate 通過、read 回非空 books、storage 成功
    mockBookFileImporter = {
      validate: jest.fn(),
      read: jest.fn().mockResolvedValue(makeImportResult())
    }
    mockTagStorageAdapter = {
      replaceAllData: jest.fn().mockResolvedValue({ success: true }),
      mergeAllData: jest.fn().mockResolvedValue({ success: true })
    }
    mockShowError = jest.fn()
    mockShowLoading = jest.fn()
    mockOnImportSuccess = jest.fn()
    // 預設 modal 回傳覆蓋模式（成功主路徑）；個別 test 可覆寫
    mockPromptImportModeFn = jest.fn().mockResolvedValue('overwrite')

    controller = buildController()
    fakeFile = { name: 'books.json', size: 1024 }
  })

  // ─────────────────────────────────────────────────────────────────────
  // 路徑 1：主路徑（validate → modal → read → persist → callback）
  // ─────────────────────────────────────────────────────────────────────
  describe('路徑 1：主路徑（成功匯入）', () => {
    test('覆蓋模式（overwrite）走 replaceAllData 且觸發 onImportSuccess(books)', async () => {
      const importResult = makeImportResult({
        books: [{ id: 'a' }, { id: 'b' }]
      })
      mockBookFileImporter.read.mockResolvedValue(importResult)
      mockPromptImportModeFn.mockResolvedValue('overwrite')

      await controller.execute(fakeFile)

      // 1. validate 先於 modal 呼叫
      expect(mockBookFileImporter.validate).toHaveBeenCalledWith(fakeFile)
      // 2. modal callback 被呼叫
      expect(mockPromptImportModeFn).toHaveBeenCalledTimes(1)
      // 3. read 被呼叫
      expect(mockBookFileImporter.read).toHaveBeenCalledWith(fakeFile)
      // 4. showLoading 在持久化前被呼叫（緊鄰 destructive write）
      expect(mockShowLoading).toHaveBeenCalledWith('正在儲存匯入資料...')
      // 5. 覆蓋模式走 replaceAllData，payload 含三欄位
      expect(mockTagStorageAdapter.replaceAllData).toHaveBeenCalledWith({
        books: importResult.books,
        tags: importResult.tags,
        tagCategories: importResult.tagCategories
      })
      expect(mockTagStorageAdapter.mergeAllData).not.toHaveBeenCalled()
      // 6. onImportSuccess 收到 books
      expect(mockOnImportSuccess).toHaveBeenCalledWith(importResult.books)
      // 7. 無錯誤
      expect(mockShowError).not.toHaveBeenCalled()
    })

    test('合併模式（merge）走 mergeAllData 且觸發 onImportSuccess(books)', async () => {
      const importResult = makeImportResult({ books: [{ id: 'x' }] })
      mockBookFileImporter.read.mockResolvedValue(importResult)
      mockPromptImportModeFn.mockResolvedValue('merge')

      await controller.execute(fakeFile)

      expect(mockTagStorageAdapter.mergeAllData).toHaveBeenCalledWith({
        books: importResult.books,
        tags: importResult.tags,
        tagCategories: importResult.tagCategories
      })
      expect(mockTagStorageAdapter.replaceAllData).not.toHaveBeenCalled()
      expect(mockOnImportSuccess).toHaveBeenCalledWith(importResult.books)
      expect(mockShowError).not.toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // 路徑 2：取消（modal → null）
  // ─────────────────────────────────────────────────────────────────────
  describe('路徑 2：使用者取消（modal → null）', () => {
    test('靜默中止：不讀檔、不寫 storage、不觸發 UI callback、不顯示錯誤', async () => {
      mockPromptImportModeFn.mockResolvedValue(null)

      await controller.execute(fakeFile)

      // validate 與 modal 已呼叫（取消發生在 modal 後）
      expect(mockBookFileImporter.validate).toHaveBeenCalledWith(fakeFile)
      expect(mockPromptImportModeFn).toHaveBeenCalledTimes(1)
      // 取消後續流程全靜默
      expect(mockBookFileImporter.read).not.toHaveBeenCalled()
      expect(mockShowLoading).not.toHaveBeenCalled()
      expect(mockTagStorageAdapter.replaceAllData).not.toHaveBeenCalled()
      expect(mockTagStorageAdapter.mergeAllData).not.toHaveBeenCalled()
      expect(mockOnImportSuccess).not.toHaveBeenCalled()
      expect(mockShowError).not.toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // 路徑 3：modal_missing（modal → IMPORT_MODE_MODAL_MISSING）
  // ─────────────────────────────────────────────────────────────────────
  describe('路徑 3：modal DOM 缺失（IMPORT_MODE_MODAL_MISSING）', () => {
    test('showError 後中止：不讀檔、不寫 storage、不觸發 UI callback', async () => {
      mockPromptImportModeFn.mockResolvedValue(IMPORT_MODE_MODAL_MISSING)

      await controller.execute(fakeFile)

      // validate 與 modal 已呼叫
      expect(mockBookFileImporter.validate).toHaveBeenCalledWith(fakeFile)
      expect(mockPromptImportModeFn).toHaveBeenCalledTimes(1)
      // showError 顯示初始化失敗訊息
      expect(mockShowError).toHaveBeenCalledWith('匯入功能初始化失敗')
      // 後續流程全中止
      expect(mockBookFileImporter.read).not.toHaveBeenCalled()
      expect(mockShowLoading).not.toHaveBeenCalled()
      expect(mockTagStorageAdapter.replaceAllData).not.toHaveBeenCalled()
      expect(mockTagStorageAdapter.mergeAllData).not.toHaveBeenCalled()
      expect(mockOnImportSuccess).not.toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // 路徑 4：storage_error（writeResult.success === false）
  // ─────────────────────────────────────────────────────────────────────
  describe('路徑 4：持久化失敗（storage_error）', () => {
    test('quota_exceeded：showError「儲存空間不足」、不觸發 onImportSuccess', async () => {
      mockPromptImportModeFn.mockResolvedValue('overwrite')
      mockTagStorageAdapter.replaceAllData.mockResolvedValue({
        success: false,
        error: 'quota_exceeded'
      })

      await controller.execute(fakeFile)

      expect(mockTagStorageAdapter.replaceAllData).toHaveBeenCalledTimes(1)
      expect(mockShowError).toHaveBeenCalledWith('儲存空間不足，匯入未完成')
      expect(mockOnImportSuccess).not.toHaveBeenCalled()
    })

    test('一般 storage error：showError「儲存失敗，已還原原有資料」、不觸發 onImportSuccess', async () => {
      mockPromptImportModeFn.mockResolvedValue('overwrite')
      mockTagStorageAdapter.replaceAllData.mockResolvedValue({
        success: false,
        error: 'unknown_error'
      })

      await controller.execute(fakeFile)

      expect(mockShowError).toHaveBeenCalledWith('儲存失敗，已還原原有資料')
      expect(mockOnImportSuccess).not.toHaveBeenCalled()
    })

    test('合併模式 storage error：mergeAllData 失敗同樣 showError', async () => {
      mockPromptImportModeFn.mockResolvedValue('merge')
      mockTagStorageAdapter.mergeAllData.mockResolvedValue({
        success: false,
        error: 'unknown_error'
      })

      await controller.execute(fakeFile)

      expect(mockTagStorageAdapter.mergeAllData).toHaveBeenCalledTimes(1)
      expect(mockShowError).toHaveBeenCalledWith('儲存失敗，已還原原有資料')
      expect(mockOnImportSuccess).not.toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // DI 注入驗證（acceptance: mock 5 個 DI 依賴）
  // ─────────────────────────────────────────────────────────────────────
  describe('DI 注入驗證', () => {
    test('constructor 接受 5 個必要依賴並存放於實例屬性', () => {
      // ImportFlowController 公開 5 個 dep 直接綁定於 this（見 constructor 79-86 行）
      expect(controller.bookFileImporter).toBe(mockBookFileImporter)
      expect(controller.tagStorageAdapter).toBe(mockTagStorageAdapter)
      expect(controller.showError).toBe(mockShowError)
      expect(controller.showLoading).toBe(mockShowLoading)
      expect(controller.onImportSuccess).toBe(mockOnImportSuccess)
    })

    test('未注入 promptImportModeFn 時 execute 使用實例自身 promptImportMode', async () => {
      // 不注入 promptImportModeFn，但 elements 為空物件——promptImportMode 內部 DOM
      // 缺失防禦會觸發，回傳 IMPORT_MODE_MODAL_MISSING（驗證 fallback 路徑可達）
      const controllerWithoutPromptFn = new ImportFlowController({
        bookFileImporter: mockBookFileImporter,
        elements: {},
        document: {},
        tagStorageAdapter: mockTagStorageAdapter,
        showError: mockShowError,
        showLoading: mockShowLoading,
        onImportSuccess: mockOnImportSuccess
        // 刻意不傳 promptImportModeFn
      })

      await controllerWithoutPromptFn.execute(fakeFile)

      // 命中 modal_missing 分支（證明 fallback this.promptImportMode 被觸發）
      expect(mockShowError).toHaveBeenCalledWith('匯入功能初始化失敗')
    })

    test('validate throw 時 execute 不會繼續呼叫 modal / read / storage', async () => {
      const validateError = new Error('validation failed')
      mockBookFileImporter.validate.mockImplementation(() => {
        throw validateError
      })

      // eslint-disable-next-line no-restricted-syntax -- 來源 mock 拋出 plain Error，無 code/details 可比對
      await expect(controller.execute(fakeFile)).rejects.toThrow('validation failed')

      // validate throw 後流程立即中止
      expect(mockPromptImportModeFn).not.toHaveBeenCalled()
      expect(mockBookFileImporter.read).not.toHaveBeenCalled()
      expect(mockTagStorageAdapter.replaceAllData).not.toHaveBeenCalled()
      expect(mockOnImportSuccess).not.toHaveBeenCalled()
    })
  })
})
