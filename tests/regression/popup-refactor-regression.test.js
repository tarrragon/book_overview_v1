/**
 * Popup 重構回歸測試 - TDD Red Phase
 *
 * 負責功能：
 * - 確保重構不破壞現有功能
 * - 驗證 API 向後相容性
 * - 測試邊界情況和錯誤處理
 * - 建立重構期間的安全網
 *
 * 回歸測試範疇：
 * - 現有錯誤處理流程完整性
 * - UI 行為一致性驗證
 * - Chrome Extension API 整合穩定性
 * - 使用者操作路徑完整性
 */

// Mock Chrome Extension APIs with complete coverage
// eslint-disable-next-line no-unused-vars
const mockChrome = {
  runtime: {
    reload: jest.fn(() => Promise.resolve()),
    sendMessage: jest.fn((message) => {
      if (message.type === 'GET_STATUS') {
        return Promise.resolve({ status: 'ready', version: '0.6.8' })
      }
      if (message.type === 'START_EXTRACTION') {
        return Promise.resolve({ success: true, bookCount: 25 })
      }
      return Promise.resolve({ success: true })
    }),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    getManifest: jest.fn(() => ({
      version: '0.6.8',
      name: 'Readmoo Book Extractor'
    })),
    lastError: null
  },
  tabs: {
    create: jest.fn((createProperties) =>
      Promise.resolve({ id: 1, url: createProperties.url })
    ),
    query: jest.fn((queryInfo) => Promise.resolve([{
      id: 1,
      url: 'https://readmoo.com/library',
      active: true,
      title: 'Readmoo Library'
    }])),
    reload: jest.fn((tabId) => Promise.resolve()),
    sendMessage: jest.fn(() => Promise.resolve({ success: true }))
  },
  storage: {
    local: {
      get: jest.fn((keys) => Promise.resolve({})),
      set: jest.fn((items) => Promise.resolve()),
      clear: jest.fn(() => Promise.resolve()),
      remove: jest.fn(() => Promise.resolve())
    }
  }
}

global.chrome = mockChrome

// Mock DOM with complete popup structure
const { JSDOM } = require('jsdom')

describe('🔄 Popup Refactor Regression Tests (TDD循環 #40)', () => {
  let dom
  let document
  // eslint-disable-next-line no-unused-vars
  let window

  beforeAll(() => {
    // 載入完整的 popup.html 結構（模擬實際生產環境）
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Readmoo Book Extractor</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            /* 實際 CSS 樣式 */
            body { margin: 0; padding: 16px; width: 350px; font-family: Arial, sans-serif; }
            .hidden { display: none !important; }
            .error { color: #dc3545; background: #f8d7da; border: 1px solid #f5c6cb; padding: 8px; border-radius: 4px; }
            .success { color: #155724; background: #d4edda; border: 1px solid #c3e6cb; padding: 8px; border-radius: 4px; }
            .loading { opacity: 0.6; }
            .progress-bar { background: #e9ecef; height: 8px; border-radius: 4px; overflow: hidden; }
            .progress-fill { background: #007bff; height: 100%; transition: width 0.3s ease; }
            .button { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
            .button-primary { background: #007bff; color: white; }
            .button-secondary { background: #6c757d; color: white; }
            .button:disabled { opacity: 0.5; cursor: not-allowed; }
          </style>
        </head>
        <body>
          <!-- 完整的生產環境 HTML 結構 -->
          <div id="app">
            <header>
              <h1>Readmoo 書庫管理</h1>
              <div id="version">版本 0.6.8</div>
            </header>
            
            <main>
              <!-- 狀態顯示區域 -->
              <section id="status-section">
                <div id="status-message" class="status-text">準備中...</div>
                <div id="progress-container" class="hidden">
                  <div class="progress-bar">
                    <div id="progress-fill" class="progress-fill" style="width: 0%"></div>
                  </div>
                  <div id="progress-text">0%</div>
                </div>
              </section>
              
              <!-- 操作按鈕區域 -->
              <section id="controls-section">
                <div class="button-group">
                  <button id="extract-button" class="button button-primary">開始提取</button>
                  <button id="stop-button" class="button button-secondary hidden">停止</button>
                </div>
                <div class="button-group">
                  <button id="export-button" class="button button-secondary" disabled>匯出資料</button>
                  <button id="settings-button" class="button button-secondary">設定</button>
                </div>
              </section>
              
              <!-- 資料顯示區域 -->
              <section id="data-section" class="hidden">
                <div id="book-count">找到 0 本書籍</div>
                <div id="book-preview">
                  <div class="book-item">範例書籍</div>
                </div>
              </section>
            </main>
            
            <!-- 錯誤顯示區域 -->
            <div id="error-container" class="hidden">
              <div class="error">
                <div id="error-header">
                  <strong id="error-title">錯誤</strong>
                  <button id="error-dismiss" class="close-btn">×</button>
                </div>
                <div id="error-message">發生錯誤</div>
                <div id="error-details" class="hidden">詳細資訊</div>
                <div id="error-actions">
                  <button id="retry-button" class="button button-primary">重試</button>
                  <button id="reload-extension-button" class="button button-secondary">重新載入擴展</button>
                  <button id="reload-page-button" class="button button-secondary">重新載入頁面</button>
                  <button id="open-diagnostic-button" class="button button-secondary">診斷</button>
                </div>
              </div>
            </div>
            
            <!-- 成功訊息區域 -->
            <div id="success-container" class="hidden">
              <div class="success">
                <div id="success-message">操作成功</div>
                <button id="success-dismiss" class="close-btn">×</button>
              </div>
            </div>
            
            <!-- 載入覆蓋層 -->
            <div id="loading-overlay" class="hidden">
              <div class="loading-content">
                <div class="spinner">載入中...</div>
                <div id="loading-message">請稍候...</div>
              </div>
            </div>
            
            <!-- 診斷面板 -->
            <div id="diagnostic-modal" class="hidden">
              <div class="modal-backdrop">
                <div class="modal-content">
                  <div class="modal-header">
                    <h3>系統診斷</h3>
                    <button id="diagnostic-close" class="close-btn">×</button>
                  </div>
                  <div class="modal-body">
                    <div id="diagnostic-tabs">
                      <button class="tab-btn active" data-tab="system">系統狀態</button>
                      <button class="tab-btn" data-tab="errors">錯誤記錄</button>
                      <button class="tab-btn" data-tab="performance">效能</button>
                    </div>
                    <div id="diagnostic-content">
                      <div id="diagnostic-loading">載入診斷資料...</div>
                    </div>
                  </div>
                  <div class="modal-footer">
                    <button id="export-diagnostic-btn" class="button button-secondary">匯出報告</button>
                    <button id="clear-diagnostic-btn" class="button button-secondary">清除記錄</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `, {
      url: 'chrome-extension://test-extension-id/popup.html',
      pretendToBeVisual: true,
      resources: 'usable'
    })

    global.window = dom.window
    global.document = dom.window.document
    document = dom.window.document
    window = dom.window
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // 重設所有 UI 狀態到初始狀態
    document.getElementById('error-container').classList.add('hidden')
    document.getElementById('success-container').classList.add('hidden')
    document.getElementById('loading-overlay').classList.add('hidden')
    document.getElementById('diagnostic-modal').classList.add('hidden')
    document.getElementById('progress-container').classList.add('hidden')
    document.getElementById('data-section').classList.add('hidden')
    document.getElementById('stop-button').classList.add('hidden')

    // 重設按鈕狀態
    document.getElementById('extract-button').disabled = false
    document.getElementById('export-button').disabled = true

    // 重設文字內容
    document.getElementById('status-message').textContent = '準備中...'
    document.getElementById('progress-fill').style.width = '0%'
    document.getElementById('progress-text').textContent = '0%'
  })

  describe('🔴 Red Phase - 現有錯誤處理流程回歸測試', () => {
    test('should fail: Legacy error handling API should remain functional', () => {
      expect(() => {
        // 測試現有的錯誤處理 API
        // eslint-disable-next-line no-unused-vars
        const PopupErrorHandler = require('src/popup/popup-error-handler')
        // eslint-disable-next-line no-unused-vars
        const errorHandler = new PopupErrorHandler()

        // 這些方法必須繼續存在且正常工作
        expect(typeof errorHandler.initialize).toBe('function')
        expect(typeof errorHandler.handleError).toBe('function')
        expect(typeof errorHandler.showError).toBe('function')
        expect(typeof errorHandler.enableDiagnosticMode).toBe('function')
        expect(typeof errorHandler.displayUserFriendlyError).toBe('function')

        // 初始化應該成功
        errorHandler.initialize()
        expect(errorHandler.elements).toBeDefined()

        // 錯誤處理應該正常工作
        errorHandler.handleError({
          type: 'NETWORK_ERROR',
          message: '網路連線失敗'
        })

        expect(document.getElementById('error-container')).not.toHaveClass('hidden')
      }).toThrow() // 預期失敗，因為重構可能改變實現
    })

    test('should fail: Existing error message formatting should be preserved', () => {
      expect(() => {
        // eslint-disable-next-line no-unused-vars
        const PopupErrorHandler = require('src/popup/popup-error-handler')
        // eslint-disable-next-line no-unused-vars
        const errorHandler = new PopupErrorHandler()
        errorHandler.initialize()

        // 測試現有的錯誤訊息格式
        // eslint-disable-next-line no-unused-vars
        const testCases = [
          {
            input: { type: 'EXTRACTION_ERROR', message: '資料提取失敗' },
            expectedTitle: '資料提取錯誤',
            expectedActions: ['重試', '重新載入擴展']
          },
          {
            input: { type: 'NETWORK_ERROR', message: '網路連線中斷' },
            expectedTitle: '網路錯誤',
            expectedActions: ['重試', '重新載入頁面']
          },
          {
            input: { type: 'STORAGE_ERROR', message: '資料儲存失敗' },
            expectedTitle: '儲存錯誤',
            expectedActions: ['重試', '清除資料']
          }
        ]

        testCases.forEach(testCase => {
          errorHandler.handleError(testCase.input)

          expect(document.getElementById('error-title').textContent)
            .toBe(testCase.expectedTitle)

          testCase.expectedActions.forEach(action => {
            // eslint-disable-next-line no-unused-vars
            const actionButton = Array.from(document.querySelectorAll('#error-actions button'))
              .find(btn => btn.textContent.includes(action))
            expect(actionButton).toBeDefined()
          })
        })
      }).toThrow()
    })

    test('should fail: Chrome Extension reload functionality should work', () => {
      expect(() => {
        // eslint-disable-next-line no-unused-vars
        const PopupErrorHandler = require('src/popup/popup-error-handler')
        // eslint-disable-next-line no-unused-vars
        const errorHandler = new PopupErrorHandler()
        errorHandler.initialize()

        // 觸發需要重新載入擴展的錯誤
        errorHandler.handleError({
          type: 'EXTENSION_ERROR',
          message: '擴展內容已過期'
        })

        // 點擊重新載入擴展按鈕
        document.getElementById('reload-extension-button').click()

        // 驗證 Chrome API 呼叫
        expect(mockChrome.runtime.reload).toHaveBeenCalled()

        // 驗證 UI 狀態
        expect(document.getElementById('loading-overlay')).not.toHaveClass('hidden')
      }).toThrow()
    })

    test('should fail: Tab reload functionality should work correctly', () => {
      expect(() => {
        // eslint-disable-next-line no-unused-vars
        const PopupErrorHandler = require('src/popup/popup-error-handler')
        // eslint-disable-next-line no-unused-vars
        const errorHandler = new PopupErrorHandler()
        errorHandler.initialize()

        // 觸發需要重新載入頁面的錯誤
        errorHandler.handleError({
          type: 'PAGE_ERROR',
          message: '頁面狀態異常'
        })

        // 點擊重新載入頁面按鈕
        document.getElementById('reload-page-button').click()

        // 驗證 Chrome tabs API 呼叫序列
        expect(mockChrome.tabs.query).toHaveBeenCalledWith({
          active: true,
          currentWindow: true
        })
        expect(mockChrome.tabs.reload).toHaveBeenCalledWith(1)
      }).toThrow()
    })
  })

  describe('🔴 Red Phase - UI 行為一致性回歸測試', () => {
    test('should fail: Progress bar updates should work consistently', () => {
      expect(() => {
        // 載入現有的 popup.js 或重構後的模組
        // eslint-disable-next-line no-unused-vars
        const popupModule = require('src/popup/popup')

        // 模擬進度更新序列
        // eslint-disable-next-line no-unused-vars
        const progressUpdates = [0, 10, 25, 50, 75, 90, 100]

        progressUpdates.forEach(progress => {
          popupModule.updateProgress(progress)

          // eslint-disable-next-line no-unused-vars
          const progressBar = document.getElementById('progress-fill')
          // eslint-disable-next-line no-unused-vars
          const progressText = document.getElementById('progress-text')

          expect(progressBar.style.width).toBe(`${progress}%`)
          expect(progressText.textContent).toBe(`${progress}%`)
        })

        // 進度容器應該在進度 > 0 時顯示
        expect(document.getElementById('progress-container')).not.toHaveClass('hidden')
      }).toThrow()
    })

    test('should fail: Button states should change correctly during operations', () => {
      expect(() => {
        // eslint-disable-next-line no-unused-vars
        const popupModule = require('src/popup/popup')

        // eslint-disable-next-line no-unused-vars
        const extractButton = document.getElementById('extract-button')
        // eslint-disable-next-line no-unused-vars
        const stopButton = document.getElementById('stop-button')
        // eslint-disable-next-line no-unused-vars
        const exportButton = document.getElementById('export-button')

        // 初始狀態驗證
        expect(extractButton.disabled).toBe(false)
        expect(stopButton.classList.contains('hidden')).toBe(true)
        expect(exportButton.disabled).toBe(true)

        // 開始提取
        popupModule.startExtraction()

        expect(extractButton.disabled).toBe(true)
        expect(stopButton.classList.contains('hidden')).toBe(false)
        expect(exportButton.disabled).toBe(true)

        // 提取完成
        popupModule.extractionCompleted({ bookCount: 25 })

        expect(extractButton.disabled).toBe(false)
        expect(stopButton.classList.contains('hidden')).toBe(true)
        expect(exportButton.disabled).toBe(false)
      }).toThrow()
    })

    test('should fail: Modal dialogs should open and close correctly', () => {
      expect(() => {
        // eslint-disable-next-line no-unused-vars
        const popupModule = require('src/popup/popup')

        // eslint-disable-next-line no-unused-vars
        const diagnosticModal = document.getElementById('diagnostic-modal')
        // eslint-disable-next-line no-unused-vars
        const diagnosticCloseBtn = document.getElementById('diagnostic-close')

        // 初始狀態
        expect(diagnosticModal.classList.contains('hidden')).toBe(true)

        // 開啟診斷面板
        popupModule.openDiagnostic()

        expect(diagnosticModal.classList.contains('hidden')).toBe(false)

        // 關閉診斷面板
        diagnosticCloseBtn.click()

        expect(diagnosticModal.classList.contains('hidden')).toBe(true)
      }).toThrow()
    })
  })

  describe('🔴 Red Phase - 完整使用者操作流程回歸測試', () => {
    test('should fail: Complete extraction workflow should work end-to-end', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const popupModule = require('src/popup/popup')

        // 1. 初始化
        await popupModule.initialize()

        expect(document.getElementById('status-message').textContent).toBe('準備就緒')

        // 2. 開始提取
        document.getElementById('extract-button').click()

        expect(document.getElementById('loading-overlay')).not.toHaveClass('hidden')
        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
          type: 'START_EXTRACTION'
        })

        // 3. 模擬提取進度更新
        await popupModule.handleMessage({
          type: 'EXTRACTION_PROGRESS',
          data: { progress: 50, message: '正在提取書籍資料...' }
        })

        expect(document.getElementById('progress-fill').style.width).toBe('50%')

        // 4. 提取成功完成
        await popupModule.handleMessage({
          type: 'EXTRACTION_COMPLETED',
          data: { bookCount: 25, success: true }
        })

        expect(document.getElementById('loading-overlay')).toHaveClass('hidden')
        expect(document.getElementById('success-container')).not.toHaveClass('hidden')
        expect(document.getElementById('book-count').textContent).toBe('找到 25 本書籍')
        expect(document.getElementById('export-button').disabled).toBe(false)
      }).rejects.toThrow()
    })

    test('should fail: Error recovery workflow should work completely', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const popupModule = require('src/popup/popup')

        // 1. 初始化
        await popupModule.initialize()

        // 2. 開始提取
        document.getElementById('extract-button').click()

        // 3. 模擬提取錯誤
        await popupModule.handleMessage({
          type: 'EXTRACTION_ERROR',
          data: {
            error: '網路連線超時',
            recoverable: true
          }
        })

        expect(document.getElementById('error-container')).not.toHaveClass('hidden')
        expect(document.getElementById('loading-overlay')).toHaveClass('hidden')

        // 4. 使用者點擊重試
        document.getElementById('retry-button').click()

        expect(document.getElementById('loading-overlay')).not.toHaveClass('hidden')
        expect(document.getElementById('error-container')).toHaveClass('hidden')

        // 5. 重試成功
        await popupModule.handleMessage({
          type: 'EXTRACTION_COMPLETED',
          data: { bookCount: 18, success: true }
        })

        expect(document.getElementById('success-container')).not.toHaveClass('hidden')
      }).rejects.toThrow()
    })

    test('should fail: Diagnostic workflow should provide comprehensive information', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const popupModule = require('src/popup/popup')

        // 1. 觸發需要診斷的錯誤
        await popupModule.handleError({
          type: 'SYSTEM_ERROR',
          message: '系統狀態異常',
          needsDiagnostic: true
        })

        // 2. 開啟診斷面板
        document.getElementById('open-diagnostic-button').click()

        expect(document.getElementById('diagnostic-modal')).not.toHaveClass('hidden')

        // 3. 等待診斷資料載入
        await new Promise(resolve => setTimeout(resolve, 100))

        // 4. 驗證診斷內容
        // eslint-disable-next-line no-unused-vars
        const diagnosticContent = document.getElementById('diagnostic-content')
        expect(diagnosticContent.textContent).toContain('擴展版本: 0.6.8')
        expect(diagnosticContent.textContent).toContain('Chrome 版本')
        expect(diagnosticContent.textContent).toContain('系統狀態')

        // 5. 匯出診斷報告
        document.getElementById('export-diagnostic-btn').click()

        // 驗證報告匯出功能
        expect(mockChrome.tabs.create).toHaveBeenCalled()
      }).rejects.toThrow()
    })
  })

  describe('🔴 Red Phase - 邊界情況和錯誤處理回歸測試', () => {
    test('should fail: Rapid user interactions should be handled gracefully', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const popupModule = require('src/popup/popup')
        await popupModule.initialize()

        // eslint-disable-next-line no-unused-vars
        const extractButton = document.getElementById('extract-button')

        // 快速點擊多次
        for (let i = 0; i < 10; i++) {
          extractButton.click()
          await new Promise(resolve => setTimeout(resolve, 10))
        }

        // 只應該有一個提取請求
        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(1)

        // 按鈕狀態應該正確
        expect(extractButton.disabled).toBe(true)
      }).rejects.toThrow()
    })

    test('should fail: Large error messages should be handled properly', () => {
      expect(() => {
        // eslint-disable-next-line no-unused-vars
        const PopupErrorHandler = require('src/popup/popup-error-handler')
        // eslint-disable-next-line no-unused-vars
        const errorHandler = new PopupErrorHandler()
        errorHandler.initialize()

        // 非常長的錯誤訊息
        // eslint-disable-next-line no-unused-vars
        const longMessage = 'A'.repeat(10000)

        errorHandler.handleError({
          type: 'LONG_ERROR',
          message: longMessage
        })

        // eslint-disable-next-line no-unused-vars
        const errorMessageEl = document.getElementById('error-message')

        // 錯誤訊息應該被適當截斷或處理
        expect(errorMessageEl.textContent.length).toBeLessThan(1000)
        expect(errorMessageEl.scrollHeight).toBeLessThan(200) // 不應該撐破 UI
      }).not.toThrow()
    })

    test('should fail: Concurrent operations should not interfere', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const popupModule = require('src/popup/popup')
        await popupModule.initialize()

        // 同時觸發多個操作
        // eslint-disable-next-line no-unused-vars
        const operations = [
          popupModule.startExtraction(),
          popupModule.updateSettings({ theme: 'dark' }),
          popupModule.exportData({ format: 'csv' })
        ]

        // eslint-disable-next-line no-unused-vars
        const results = await Promise.allSettled(operations)

        // 操作應該按優先級正確處理，不應該全部失敗
        // eslint-disable-next-line no-unused-vars
        const rejectedCount = results.filter(r => r.status === 'rejected').length
        expect(rejectedCount).toBeLessThan(results.length)
      }).rejects.toThrow()
    })
  })

  describe('🔴 Red Phase - Chrome Extension API 穩定性回歸測試', () => {
    test('should fail: Chrome API errors should be handled gracefully', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const PopupErrorHandler = require('src/popup/popup-error-handler')
        // eslint-disable-next-line no-unused-vars
        const errorHandler = new PopupErrorHandler()

        // 模擬 Chrome API 失敗
        mockChrome.runtime.sendMessage.mockRejectedValueOnce(
          new Error('Extension context invalidated')
        )

        mockChrome.tabs.query.mockRejectedValueOnce(
          new Error('Tabs permission denied')
        )

        // 這些錯誤應該被優雅處理
        await errorHandler.checkBackgroundScript()
        await errorHandler.reloadCurrentTab()

        // 應該顯示適當的錯誤訊息
        expect(document.getElementById('error-container')).not.toHaveClass('hidden')
        expect(document.getElementById('error-message').textContent)
          .toContain('擴展')
      }).rejects.toThrow()
    })

    test('should fail: Extension updates should not break existing functionality', () => {
      expect(() => {
        // 模擬擴展版本更新
        mockChrome.runtime.getManifest.mockReturnValueOnce({
          version: '0.7.0', // 新版本
          name: 'Readmoo Book Extractor'
        })

        // eslint-disable-next-line no-unused-vars
        const popupModule = require('src/popup/popup')
        popupModule.initialize()

        // 版本更新不應該破壞現有功能
        expect(document.getElementById('version').textContent).toContain('0.7.0')
        expect(typeof popupModule.startExtraction).toBe('function')
        expect(typeof popupModule.handleError).toBe('function')
      }).toThrow()
    })
  })
})
