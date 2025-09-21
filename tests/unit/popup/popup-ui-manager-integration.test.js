/**
 * PopupUIManager 整合測試
 *
 * 測試目標：
 * - 驗證 PopupUIManager 與新的模組化組件整合
 * - 確保移除狀態管理重複後功能正常
 * - 測試 UI 更新機制與狀態管理器分離
 *
 * @jest-environment jsdom
 */

// Mock DOM 環境
const { JSDOM } = require('jsdom')

describe('PopupUIManager 模組化整合測試', () => {
  let dom
  let document
  let window
  let uiManager

  beforeEach(() => {
    // 建立 JSDOM 環境
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
      <body>
        <div id="error-container" class="hidden">
          <div id="error-title"></div>
          <div id="error-message"></div>
          <div id="error-actions"></div>
        </div>
        <div id="success-container" class="hidden">
          <div id="success-message"></div>
        </div>
        <div id="status-container">
          <div id="status-message"></div>
        </div>
        <div id="loading-overlay" class="hidden">
          <div id="loading-spinner"></div>
        </div>
        <div id="progress-bar" style="width: 0%"></div>
        <div id="diagnostic-panel" class="hidden">
          <div id="diagnostic-content"></div>
        </div>
      </body>
      </html>
    `, { url: 'chrome-extension://test/popup.html' })

    window = dom.window
    document = window.document
    global.window = window
    global.document = document

    // 載入 PopupUIManager
    // eslint-disable-next-line no-unused-vars
    const PopupUIManager = require('src/popup/popup-ui-manager.js')
    uiManager = new PopupUIManager(document)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('📋 DOM 元素管理 (核心職責)', () => {
    test('應該正確初始化和快取 DOM 元素', () => {
      // Given: UIManager 已初始化

      // When: 檢查核心元素
      // eslint-disable-next-line no-unused-vars
      const coreElements = [
        'errorContainer', 'successContainer', 'statusMessage',
        'loadingOverlay', 'progressBar', 'diagnosticPanel'
      ]

      // Then: 所有核心元素都應該被快取
      coreElements.forEach(key => {
        expect(uiManager.elements[key]).toBeTruthy()
        expect(uiManager.elements[key]).toBeInstanceOf(window.Element)
      })
    })

    test('應該提供統一的元素存取 API', () => {
      // Given: UIManager 已初始化

      // When: 使用 elements 屬性存取元素
      // eslint-disable-next-line no-unused-vars
      const errorContainer = uiManager.elements.errorContainer
      // eslint-disable-next-line no-unused-vars
      const statusMessage = uiManager.elements.statusMessage

      // Then: 應該返回正確的 DOM 元素
      expect(errorContainer).toBe(document.getElementById('error-container'))
      expect(statusMessage).toBe(document.getElementById('status-message'))
    })
  })

  describe('🎨 UI 顯示控制 (視覺層職責)', () => {
    test('應該能顯示錯誤訊息 (純 UI 操作)', () => {
      // Given: 錯誤資料
      // eslint-disable-next-line no-unused-vars
      const errorData = {
        title: '提取失敗',
        message: '無法連接到服務器',
        actions: ['重試']
      }

      // When: 顯示錯誤
      uiManager.showError(errorData)

      // Then: UI 應該正確更新
      expect(document.getElementById('error-container')).not.toHaveClass('hidden')
      expect(document.getElementById('error-title').textContent).toBe('提取失敗')
      expect(document.getElementById('error-message').textContent).toBe('無法連接到服務器')
    })

    test('應該能顯示成功訊息', () => {
      // Given: 成功訊息
      // eslint-disable-next-line no-unused-vars
      const successMessage = '資料提取完成'

      // When: 顯示成功訊息
      uiManager.showSuccess(successMessage)

      // Then: UI 應該正確更新
      expect(document.getElementById('success-container')).not.toHaveClass('hidden')
      expect(document.getElementById('success-message').textContent).toBe(successMessage)
    })

    test('應該能控制載入狀態顯示', () => {
      // Given: 載入訊息
      // eslint-disable-next-line no-unused-vars
      const loadingMessage = '正在提取資料...'

      // When: 顯示載入狀態
      uiManager.showLoading(loadingMessage)

      // Then: 載入覆蓋層應該顯示
      expect(document.getElementById('loading-overlay')).not.toHaveClass('hidden')

      // When: 隱藏載入狀態
      uiManager.hideLoading()

      // Then: 載入覆蓋層應該隱藏
      expect(document.getElementById('loading-overlay')).toHaveClass('hidden')
    })
  })

  describe('📊 進度條控制', () => {
    test('應該能更新進度條顯示', () => {
      // Given: 進度百分比
      // eslint-disable-next-line no-unused-vars
      const percentage = 65

      // When: 更新進度條
      uiManager.updateProgress(percentage)

      // Then: 進度條寬度應該正確設置
      // eslint-disable-next-line no-unused-vars
      const progressBar = document.getElementById('progress-bar')
      expect(progressBar.style.width).toBe('65%')
    })

    test('應該正確處理進度邊界值', () => {
      // Given: 邊界值測試案例
      // eslint-disable-next-line no-unused-vars
      const testCases = [
        { input: -10, expected: '0%' },
        { input: 0, expected: '0%' },
        { input: 50, expected: '50%' },
        { input: 100, expected: '100%' },
        { input: 150, expected: '100%' }
      ]

      testCases.forEach(({ input, expected }) => {
        // When: 更新進度
        uiManager.updateProgress(input)

        // Then: 進度條應該被正確限制
        // eslint-disable-next-line no-unused-vars
        const progressBar = document.getElementById('progress-bar')
        expect(progressBar.style.width).toBe(expected)
      })
    })
  })

  describe('🔧 狀態管理分離驗證', () => {
    test('應該不再維護內部狀態', () => {
      // Given: UIManager 初始化後

      // When: 檢查內部狀態
      // Then: 重構後不應該有狀態管理邏輯
      expect(uiManager.currentState).toBeUndefined()

      // getCurrentState 應該只返回診斷資訊，不包含業務狀態
      // eslint-disable-next-line no-unused-vars
      const state = uiManager.getCurrentState()
      expect(state).toHaveProperty('queuedUpdates')
      expect(state).toHaveProperty('updateScheduled')
      expect(state).toHaveProperty('elementsCount')
      expect(state).toHaveProperty('listenersCount')
      expect(state).toHaveProperty('timestamp')

      // 不應該包含業務狀態
      expect(state).not.toHaveProperty('loading')
      expect(state).not.toHaveProperty('error')
      expect(state).not.toHaveProperty('progress')
      expect(state).not.toHaveProperty('status')
    })

    test('UI 更新不應該包含狀態邏輯', () => {
      // Given: UI 更新操作

      // When: 分別執行 UI 更新並驗證

      // 測試錯誤顯示（純 UI）
      uiManager.showError({ title: '錯誤', message: '測試', actions: [] })
      expect(document.getElementById('error-container')).not.toHaveClass('hidden')
      expect(document.getElementById('error-title').textContent).toBe('錯誤')

      // 測試成功顯示（純 UI）
      uiManager.showSuccess('成功')
      expect(document.getElementById('success-container')).not.toHaveClass('hidden')
      expect(document.getElementById('success-message').textContent).toBe('成功')

      // 測試進度更新（純 UI）
      uiManager.updateProgress(50)
      expect(document.getElementById('progress-bar').style.width).toBe('50%')

      // 最重要的驗證：確保沒有內部狀態被修改
      expect(uiManager.currentState).toBeUndefined()
    })
  })

  describe('⚡ 效能優化功能', () => {
    test('應該支援批次 DOM 更新', () => {
      // Given: 多個 UI 更新操作

      // When: 執行多個更新（測試批次處理是否正常）
      uiManager.updateProgress(25)
      uiManager.showLoading('載入中...')
      uiManager.updateProgress(50)

      // Then: 所有更新都應該正確應用
      expect(document.getElementById('progress-bar').style.width).toBe('50%')
      expect(document.getElementById('loading-overlay')).not.toHaveClass('hidden')
    })
  })

  describe('🧪 測試環境相容性', () => {
    test('應該在 JSDOM 環境中正常工作', () => {
      // Given: JSDOM 環境
      expect(window).toBeDefined()
      expect(document).toBeDefined()

      // When: 執行 UI 操作
      uiManager.showError({ title: 'JSDOM 測試', message: '測試訊息', actions: [] })

      // Then: 應該正常工作
      expect(document.getElementById('error-title').textContent).toBe('JSDOM 測試')
    })
  })
})
