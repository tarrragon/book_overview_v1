/**
 * PopupController 狀態管理整合測試
 *
 * 測試目標：
 * - 驗證 PopupController 與真實 PopupStatusManager 的整合
 * - 確保狀態更新正確流動到 UI 組件
 * - 測試狀態管理的錯誤處理和驗證
 *
 * @jest-environment jsdom
 */

// Mock DOM 環境
const { JSDOM } = require('jsdom')

// Mock Chrome Extension APIs
global.chrome = {
  runtime: {
    getManifest: jest.fn(() => ({ version: '0.9.8' })),
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  }
}

describe('PopupController 狀態管理整合測試', () => {
  let dom
  let document
  let window
  let PopupController
  let PopupStatusManager
  // eslint-disable-next-line no-unused-vars
  let PopupUIManager

  beforeEach(() => {
    // 建立 JSDOM 環境
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
      <body>
        <div id="status-dot" class="status-dot loading"></div>
        <div id="status-text">檢查中...</div>
        <div id="status-info"></div>
        <div id="extension-status">正在初始化...</div>
        <button id="extract-button">開始提取書庫資料</button>
        <button id="settings-button">設定</button>
        <button id="help-button">說明</button>
        <div id="progress-container" class="hidden">
          <div id="progress-bar" style="width: 0%"></div>
          <div id="progress-text"></div>
        </div>
        <div id="error-container" class="hidden">
          <div id="error-title"></div>
          <div id="error-message"></div>
        </div>
      </body>
      </html>
    `, { url: 'chrome-extension://test/popup.html' })

    window = dom.window
    document = window.document
    global.window = window
    global.document = document

    // 載入相關模組
    PopupController = require('src/popup/popup-controller.js')
    PopupStatusManager = require('src/popup/components/popup-status-manager.js')
    PopupUIManager = require('src/popup/popup-ui-manager.js')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('🔴 Red 階段：狀態管理整合測試設計', () => {
    test('應該能夠整合真實的 PopupStatusManager', async () => {
      // Given: PopupController 實例
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)

      // When: 初始化控制器
      await controller.initialize()

      // Then: 狀態管理器應該是真實的 PopupStatusManager 實例
      // eslint-disable-next-line no-unused-vars
      const statusManager = controller.getComponent('status')
      expect(statusManager).toBeInstanceOf(PopupStatusManager)

      // 且應該有完整的狀態管理功能
      expect(typeof statusManager.updateStatus).toBe('function')
      expect(typeof statusManager.getCurrentStatus).toBe('function')
      expect(typeof statusManager.syncFromBackground).toBe('function')
    })

    test('應該正確注入 UI 組件到 StatusManager', async () => {
      // Given: PopupController 實例
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)

      // When: 初始化
      await controller.initialize()

      // Then: StatusManager 應該有正確的 UI 組件依賴
      // eslint-disable-next-line no-unused-vars
      const statusManager = controller.getComponent('status')
      // eslint-disable-next-line no-unused-vars
      const uiManager = controller.getComponent('ui')

      expect(statusManager).toBeDefined()
      expect(uiManager).toBeDefined()

      // StatusManager 應該能夠通過 UI 組件更新狀態
      expect(statusManager.uiComponents).toBeDefined()
    })

    test('應該能夠通過 StatusManager 更新狀態到 UI', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const statusManager = controller.getComponent('status')

      // When: 通過 StatusManager 更新狀態
      // eslint-disable-next-line no-unused-vars
      const testStatus = {
        type: 'ready',
        text: '就緒',
        info: '可以開始提取書庫資料'
      }

      statusManager.updateStatus(testStatus)

      // Then: UI 應該正確更新
      expect(document.getElementById('status-text').textContent).toBe('就緒')
      expect(document.getElementById('status-info').textContent).toBe('可以開始提取書庫資料')
      expect(document.getElementById('status-dot').className).toContain('ready')
    })

    test('應該驗證無效的狀態類型', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const statusManager = controller.getComponent('status')

      // When: 嘗試使用無效狀態類型
      // eslint-disable-next-line no-unused-vars
      const invalidStatus = {
        type: 'invalid_type',
        text: '無效狀態'
      }

      // Then: 應該拋出錯誤
      expect(() => {
        statusManager.updateStatus(invalidStatus)
      }).toThrow()
    })

    test('應該支援背景狀態同步', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const statusManager = controller.getComponent('status')

      // When: 從背景同步狀態
      // eslint-disable-next-line no-unused-vars
      const backgroundStatus = {
        type: 'extracting',
        text: '正在提取',
        info: '已處理 50 本書籍'
      }

      statusManager.syncFromBackground(backgroundStatus)

      // Then: 狀態應該正確同步
      // eslint-disable-next-line no-unused-vars
      const currentStatus = statusManager.getCurrentStatus()
      expect(currentStatus.type).toBe('extracting')
      expect(currentStatus.text).toBe('正在提取')
      expect(currentStatus.info).toBe('已處理 50 本書籍')
    })

    test('應該處理必要欄位缺失的錯誤', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const statusManager = controller.getComponent('status')

      // When: 嘗試使用缺失必要欄位的狀態
      // eslint-disable-next-line no-unused-vars
      const incompleteStatus = {
        type: 'ready'
        // 缺少 text 欄位
      }

      // Then: 應該拋出錯誤
      expect(() => {
        statusManager.updateStatus(incompleteStatus)
      }).toThrow()
    })

    test('應該保持狀態不可變性', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const statusManager = controller.getComponent('status')

      // When: 更新狀態
      // eslint-disable-next-line no-unused-vars
      const originalStatus = {
        type: 'ready',
        text: '就緒',
        info: '原始資訊'
      }

      statusManager.updateStatus(originalStatus)
      // eslint-disable-next-line no-unused-vars
      const retrievedStatus = statusManager.getCurrentStatus()

      // 修改檢索到的狀態
      retrievedStatus.text = '已修改'

      // Then: 內部狀態不應該受到影響
      // eslint-disable-next-line no-unused-vars
      const currentStatus = statusManager.getCurrentStatus()
      expect(currentStatus.text).toBe('就緒')
      expect(currentStatus.text).not.toBe('已修改')
    })
  })

  describe('⚠️ 錯誤處理測試', () => {
    test('應該優雅處理同步失敗', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const statusManager = controller.getComponent('status')

      // Mock UI 組件的 showError 方法
      // eslint-disable-next-line no-unused-vars
      const mockShowError = jest.fn()
      statusManager.uiComponents = {
        ...statusManager.uiComponents,
        showError: mockShowError
      }

      // When: 處理同步失敗
      statusManager.handleSyncFailure('網路連線中斷')

      // Then: 應該調用錯誤顯示
      expect(mockShowError).toHaveBeenCalledWith({
        message: '與背景服務同步失敗: 網路連線中斷',
        type: 'sync_error'
      })
    })
  })
})
