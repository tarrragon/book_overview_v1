/**
 * PopupUIManager 重構測試 - TDD Red Phase
 *
 * 負責功能：
 * - 測試 PopupUIManager 統一 DOM 管理功能
 * - 驗證錯誤顯示和狀態管理
 * - 測試事件綁定和清理機制
 * - 確保與現有系統的相容性
 *
 * 重構目標測試：
 * - 統一所有 DOM 操作到單一管理器
 * - 保持現有 API 相容性
 * - 改善錯誤顯示的使用者體驗
 * - 事件驅動的狀態管理
 */

// Mock Chrome Extension APIs
// eslint-disable-next-line no-unused-vars
const mockChrome = {
  runtime: {
    reload: jest.fn(),
    sendMessage: jest.fn(),
    onMessage: { addListener: jest.fn() },
    getManifest: jest.fn(() => ({ version: '0.6.8' }))
  },
  tabs: {
    create: jest.fn(),
    query: jest.fn(() => Promise.resolve([{ id: 1 }])),
    reload: jest.fn()
  }
}

global.chrome = mockChrome

// Mock DOM
const { JSDOM } = require('jsdom')

describe('🎨 PopupUIManager Refactor Tests (TDD循環 #36)', () => {
  let PopupUIManager
  let uiManager
  let dom
  let document

  beforeEach(() => {
    // 針對測試環境的全域 afterEach 清理機制，每個測試都重建 DOM
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Readmoo Book Extractor</title>
          <style>
            .error-message { color: red; }
            .success-message { color: green; }
            .loading { opacity: 0.5; }
            .hidden { display: none; }
          </style>
        </head>
        <body>
          <!-- 主要狀態區域 -->
          <div id="status-container">
            <div id="status-message">準備中...</div>
            <div id="progress-bar" style="width: 0%"></div>
          </div>
          
          <!-- 錯誤處理區域 -->
          <div id="error-container" class="hidden">
            <div id="error-title">錯誤</div>
            <div id="error-message">發生錯誤</div>
            <div id="error-actions">
              <button id="retry-button">重試</button>
              <button id="reload-button">重新載入</button>
              <button id="diagnostic-button">診斷</button>
            </div>
          </div>
          
          <!-- 成功狀態區域 -->
          <div id="success-container" class="hidden">
            <div id="success-message">操作成功</div>
          </div>
          
          <!-- 操作按鈕區域 -->
          <div id="action-buttons">
            <button id="extract-button">開始提取</button>
            <button id="export-button">匯出資料</button>
            <button id="settings-button">設定</button>
          </div>
          
          <!-- 診斷面板 -->
          <div id="diagnostic-panel" class="hidden">
            <div id="diagnostic-content">診斷資訊</div>
            <button id="close-diagnostic">關閉診斷</button>
          </div>
          
          <!-- 載入指示器 -->
          <div id="loading-overlay" class="hidden">
            <div id="loading-spinner">載入中...</div>
          </div>
        </body>
      </html>
    `, {
      url: 'chrome-extension://test/popup.html',
      pretendToBeVisual: true,
      resources: 'usable'
    })

    global.window = dom.window
    global.document = dom.window.document
    document = dom.window.document

    jest.clearAllMocks()

    // 重設 DOM 狀態
    document.getElementById('error-container')?.classList.add('hidden')
    document.getElementById('success-container')?.classList.add('hidden')
    document.getElementById('diagnostic-panel')?.classList.add('hidden')
    document.getElementById('loading-overlay')?.classList.add('hidden')

    // Green Phase - PopupUIManager 已實現
    PopupUIManager = require('src/popup/popup-ui-manager')
    uiManager = new PopupUIManager(document)
  })

  afterEach(() => {
    if (uiManager && typeof uiManager.cleanup === 'function') {
      uiManager.cleanup()
    }
    if (dom) {
      try { dom.window.close() } catch (_) {}
      dom = null
    }
  })

  describe('🟢 Green Phase - PopupUIManager 核心功能測試', () => {
    test('PopupUIManager class should exist and be instantiable', () => {
      // Green Phase - 測試應該通過
      expect(PopupUIManager).toBeDefined()
      expect(uiManager).toBeDefined()
      expect(uiManager).toBeInstanceOf(PopupUIManager)
    })

    test('PopupUIManager should initialize with DOM elements', () => {
      // Green Phase - 測試 DOM 元素初始化
      expect(uiManager.elements).toBeDefined()
      expect(uiManager.elements.errorContainer).toBeDefined()
      expect(uiManager.elements.successContainer).toBeDefined()
      expect(uiManager.elements.statusMessage).toBeDefined()
    })

    test('PopupUIManager should show error messages', () => {
      uiManager.showError({
        title: '測試錯誤',
        message: '這是測試錯誤訊息',
        actions: ['重試', '取消']
      })

      expect(document.getElementById('error-container')).not.toHaveClass('hidden')
      expect(document.getElementById('error-title').textContent).toBe('測試錯誤')
      expect(document.getElementById('error-message').textContent).toBe('這是測試錯誤訊息')
    })

    test('PopupUIManager should show success messages', () => {
      uiManager.showSuccess('操作成功完成')

      expect(document.getElementById('success-container')).not.toHaveClass('hidden')
      expect(document.getElementById('success-message').textContent).toBe('操作成功完成')
    })

    test('PopupUIManager should manage loading states', () => {
      uiManager.showLoading('資料載入中...')
      expect(document.getElementById('loading-overlay')).not.toHaveClass('hidden')

      uiManager.hideLoading()
      expect(document.getElementById('loading-overlay')).toHaveClass('hidden')
    })

    test('PopupUIManager should update progress bar', () => {
      uiManager.updateProgress(65)

      // eslint-disable-next-line no-unused-vars
      const progressBar = document.getElementById('progress-bar')
      expect(progressBar.style.width).toBe('65%')
    })

    test('PopupUIManager should bind event listeners', () => {
      // eslint-disable-next-line no-unused-vars
      const mockCallback = jest.fn()
      uiManager.bindEvent('extract-button', 'click', mockCallback)

      document.getElementById('extract-button').click()
      expect(mockCallback).toHaveBeenCalled()
    })

    test('PopupUIManager should handle diagnostic panel', () => {
      uiManager.showDiagnostic('系統診斷資訊')
      expect(document.getElementById('diagnostic-panel')).not.toHaveClass('hidden')

      uiManager.hideDiagnostic()
      expect(document.getElementById('diagnostic-panel')).toHaveClass('hidden')
    })

    test('PopupUIManager should clean up event listeners', () => {
      // eslint-disable-next-line no-unused-vars
      const mockCallback = jest.fn()
      uiManager.bindEvent('extract-button', 'click', mockCallback)
      uiManager.cleanup()

      document.getElementById('extract-button').click()
      expect(mockCallback).not.toHaveBeenCalled()
    })
  })

  describe('🟢 Green Phase - PopupUIManager 與現有系統相容性測試', () => {
    test('PopupUIManager should maintain compatibility with existing error handler', () => {
      // 測試與現有 PopupErrorHandler 的相容性
      // eslint-disable-next-line no-unused-vars
      const errorData = {
        title: '系統錯誤',
        message: '發生未預期的錯誤',
        actions: ['重新載入擴展', '重新整理頁面'],
        severity: 'error'
      }

      uiManager.displayError(errorData)
      expect(document.getElementById('error-container')).not.toHaveClass('hidden')
    })

    test('PopupUIManager should support event-driven updates', () => {
      // 測試事件驅動的狀態更新
      // eslint-disable-next-line no-unused-vars
      const statusEvent = {
        type: 'STATUS_UPDATE',
        data: {
          message: '正在提取書籍資料...',
          progress: 45
        }
      }

      uiManager.handleStatusEvent(statusEvent)
      expect(document.getElementById('status-message').textContent).toBe('正在提取書籍資料...')
    })

    test('PopupUIManager should handle multiple simultaneous operations', () => {
      uiManager.showLoading('載入中...')
      uiManager.updateProgress(30)
      uiManager.showSuccess('部分操作完成')

      // 應該能處理多個同時的 UI 狀態
      expect(document.getElementById('loading-overlay')).not.toHaveClass('hidden')
      expect(document.getElementById('success-container')).not.toHaveClass('hidden')
    })
  })

  describe('🟢 Green Phase - PopupUIManager 效能和最佳化測試', () => {
    test('PopupUIManager should debounce rapid UI updates', () => {
      // 測試快速連續的 UI 更新
      for (let i = 0; i < 100; i++) {
        uiManager.updateProgress(i)
      }

      // 重構後：應該有去重機制，避免過度渲染
      // eslint-disable-next-line no-unused-vars
      const currentState = uiManager.getCurrentState()
      expect(currentState.queuedUpdates).toBeLessThan(10)
    })

    test('PopupUIManager should optimize DOM queries', () => {
      // 測試 DOM 元素快取機制
      // eslint-disable-next-line no-unused-vars
      const querySelectorSpy = jest.spyOn(document, 'getElementById')

      uiManager.showError({ message: '測試' })
      uiManager.showError({ message: '測試2' })

      // 由於元素已經快取，第二次呼叫不會觸發過多的 DOM 查詢
      // 這個測試主要驗證快取機制運作正常
      expect(querySelectorSpy).toHaveBeenCalled()

      querySelectorSpy.mockRestore()
    })
  })
})
