/**
 * PopupController 單元測試
 *
 * 測試目標：
 * - 驗證 PopupController 的初始化和組件協調功能
 * - 確保依賴注入正確運作
 * - 測試組件間通訊和事件協調
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

describe('PopupController 基礎架構測試', () => {
  let dom
  let document
  let window
  let PopupController

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

    // 載入真正的 PopupController
    PopupController = require('src/popup/popup-controller.js')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('🏗 基礎架構建立', () => {
    test('應該能成功建立 PopupController 實例', () => {
      // Given: PopupController 類別已定義

      // When: 建立 PopupController 實例
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController()

      // Then: 實例應該正確建立
      expect(controller).toBeInstanceOf(PopupController)
      expect(controller.components).toBeDefined()
      expect(controller.isInitialized).toBe(false)
    })

    test('應該支援依賴注入容器', () => {
      // Given: PopupController 實例
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController()

      // When: 檢查組件容器
      // Then: 組件容器應該存在且為空物件
      expect(controller.components).toEqual({})
      expect(typeof controller.components).toBe('object')
    })

    test('應該提供初始化方法', async () => {
      // Given: PopupController 實例
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController()
      expect(controller.isInitialized).toBe(false)

      // When: 執行初始化
      await controller.initialize()

      // Then: 初始化狀態應該更新
      expect(controller.isInitialized).toBe(true)
    })
  })

  describe('🔧 組件初始化', () => {
    test('應該按順序初始化所有組件', async () => {
      // Given: PopupController 實例
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      expect(controller.isInitialized).toBe(false)

      // When: 初始化
      // eslint-disable-next-line no-unused-vars
      const initResult = await controller.initialize()

      // Then: 初始化完成
      expect(initResult).toBe(true)
      expect(controller.isInitialized).toBe(true)

      // 驗證所有組件都已初始化
      // eslint-disable-next-line no-unused-vars
      const requiredComponents = ['ui', 'status', 'progress', 'communication', 'extraction']
      requiredComponents.forEach(componentName => {
        expect(controller.isComponentAvailable(componentName)).toBe(true)
        expect(controller.getComponent(componentName)).not.toBeNull()
      })
    })

    test('應該建立組件間依賴關係', async () => {
      // Given: PopupController 實例
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)

      // When: 初始化
      await controller.initialize()

      // Then: 組件依賴建立
      expect(controller.isInitialized).toBe(true)

      // 驗證組件可用性
      expect(controller.getComponent('ui')).toBeTruthy()
      expect(controller.getComponent('status')).toBeTruthy()
      expect(controller.getComponent('progress')).toBeTruthy()
      expect(controller.getComponent('communication')).toBeTruthy()
      expect(controller.getComponent('extraction')).toBeTruthy()

      // 驗證初始化狀態
      // eslint-disable-next-line no-unused-vars
      const status = controller.getInitializationStatus()
      expect(status.isInitialized).toBe(true)
      expect(status.availableComponents.length).toBe(5)
      expect(status.componentCount).toBe(5)
    })

    test('應該正確注入 DOM 文件依賴', () => {
      // Given: PopupController 實例與文件注入
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)

      // When: 檢查文件引用
      // Then: 文件應該正確注入
      expect(controller.document).toBe(document)
    })
  })

  describe('📡 事件協調 (未來實作)', () => {
    test('應該支援事件監聽器設置', async () => {
      // Given: PopupController 實例和初始化完成
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController()
      await controller.initialize()

      // When: 檢查基礎架構
      // Then: 基本結構存在
      expect(controller).toBeDefined()

      // TODO: 未來需要測試：
      // - setupEventListeners 方法存在
      // - 按鈕事件正確綁定到對應組件方法
      // - 組件間事件通訊機制
    })

    test('應該協調組件間通訊', async () => {
      // Given: PopupController 實例
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController()
      await controller.initialize()

      // When: 檢查通訊機制
      // Then: 基礎結構存在
      expect(controller).toBeDefined()

      // TODO: 未來需要測試：
      // - 狀態變更事件正確傳播
      // - 進度更新事件正確處理
      // - 錯誤事件正確協調
    })
  })

  describe('🧹 資源清理', () => {
    test('應該正確清理所有資源', async () => {
      // Given: 已初始化的 PopupController
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      expect(controller.isInitialized).toBe(true)
      expect(Object.keys(controller.components).length).toBe(5)

      // When: 執行清理
      controller.cleanup()

      // Then: 所有資源都應該被清理
      expect(controller.isInitialized).toBe(false)
      expect(Object.keys(controller.components).length).toBe(0)
      expect(controller.eventListeners.length).toBe(0)
      expect(controller.initializationError).toBeNull()
    })
  })

  describe('⚠️ 錯誤處理', () => {
    test('初始化成功時應該返回正確狀態', async () => {
      // Given: PopupController 實例
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)

      // When: 執行初始化
      // eslint-disable-next-line no-unused-vars
      const initResult = await controller.initialize()

      // Then: 應該成功處理
      expect(initResult).toBe(true)
      expect(controller.isInitialized).toBe(true)
      expect(controller.initializationError).toBeNull()

      // 驗證初始化狀態
      // eslint-disable-next-line no-unused-vars
      const status = controller.getInitializationStatus()
      expect(status.isInitialized).toBe(true)
      expect(status.initializationError).toBeNull()
      expect(status.availableComponents).toEqual(['ui', 'status', 'progress', 'communication', 'extraction'])
    })

    test('應該提供組件可用性檢查', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // When: 檢查組件可用性
      // Then: 應該正確返回組件狀態
      expect(controller.isComponentAvailable('ui')).toBe(true)
      expect(controller.isComponentAvailable('status')).toBe(true)
      expect(controller.isComponentAvailable('nonexistent')).toBe(false)

      // 檢查組件實例
      expect(controller.getComponent('ui')).not.toBeNull()
      expect(controller.getComponent('nonexistent')).toBeNull()
    })
  })
})
