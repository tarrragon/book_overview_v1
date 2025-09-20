/**
 * PopupController 進度管理整合測試
 *
 * 測試目標：
 * - 驗證 PopupController 與真實 PopupProgressManager 的整合
 * - 確保進度更新正確流動到 UI 組件
 * - 測試進度管理的生命週期和錯誤處理
 *
 * @jest-environment jsdom
 */

// Mock DOM 環境
const { JSDOM } = require('jsdom')
const { StandardError } = require('src/core/errors/StandardError')

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

describe('PopupController 進度管理整合測試', () => {
  let dom
  let document
  let window
  let PopupController
  let PopupProgressManager

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
        <div id="progress-container" class="hidden">
          <div id="progress-bar" style="width: 0%"></div>
          <div id="progress-text">準備中...</div>
          <div id="progress-percentage">0%</div>
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
    PopupProgressManager = require('src/popup/components/popup-progress-manager.js')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('🔴 Red 階段：進度管理整合測試設計', () => {
    test('應該能夠整合真實的 PopupProgressManager', async () => {
      // Given: PopupController 實例
      const controller = new PopupController(document)

      // When: 初始化控制器
      await controller.initialize()

      // Then: 進度管理器應該是真實的 PopupProgressManager 實例
      const progressManager = controller.getComponent('progress')
      expect(progressManager).toBeInstanceOf(PopupProgressManager)

      // 且應該有完整的進度管理功能
      expect(typeof progressManager.updateProgress).toBe('function')
      expect(typeof progressManager.startProgress).toBe('function')
      expect(typeof progressManager.completeProgress).toBe('function')
      expect(typeof progressManager.cancelProgress).toBe('function')
      expect(typeof progressManager.getCurrentProgress).toBe('function')
    })

    test('應該正確注入 UI 組件到 ProgressManager', async () => {
      // Given: PopupController 實例
      const controller = new PopupController(document)

      // When: 初始化
      await controller.initialize()

      // Then: ProgressManager 應該有正確的 UI 組件依賴
      const progressManager = controller.getComponent('progress')
      const uiManager = controller.getComponent('ui')

      expect(progressManager).toBeDefined()
      expect(uiManager).toBeDefined()

      // ProgressManager 應該能夠通過 UI 組件更新進度
      expect(progressManager.uiComponents).toBeDefined()
    })

    test('應該能夠通過 ProgressManager 更新進度到 UI', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const progressManager = controller.getComponent('progress')

      // When: 通過 ProgressManager 更新進度
      const testProgress = {
        percentage: 65,
        status: 'extracting',
        text: '正在提取第 65 本書籍'
      }

      progressManager.updateProgress(testProgress)

      // Then: UI 應該正確更新
      expect(document.getElementById('progress-bar').style.width).toBe('65%')
      expect(document.getElementById('progress-text').textContent).toBe('正在提取第 65 本書籍')
      expect(document.getElementById('progress-percentage').textContent).toBe('65%')
    })

    test('應該限制進度百分比在有效範圍內', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const progressManager = controller.getComponent('progress')

      // When: 嘗試使用超出範圍的百分比
      const invalidProgress = {
        percentage: 150, // 超過 100
        status: 'extracting',
        text: '測試無效百分比'
      }

      progressManager.updateProgress(invalidProgress)

      // Then: 百分比應該被限制在 100
      expect(document.getElementById('progress-bar').style.width).toBe('100%')
      expect(document.getElementById('progress-percentage').textContent).toBe('100%')

      const currentProgress = progressManager.getCurrentProgress()
      expect(currentProgress.percentage).toBe(100)
    })

    test('應該限制負數百分比為 0', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const progressManager = controller.getComponent('progress')

      // When: 嘗試使用負數百分比
      const negativeProgress = {
        percentage: -25,
        status: 'starting',
        text: '測試負數百分比'
      }

      progressManager.updateProgress(negativeProgress)

      // Then: 百分比應該被限制在 0
      expect(document.getElementById('progress-bar').style.width).toBe('0%')
      expect(document.getElementById('progress-percentage').textContent).toBe('0%')

      const currentProgress = progressManager.getCurrentProgress()
      expect(currentProgress.percentage).toBe(0)
    })

    test('應該驗證無效的進度狀態', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const progressManager = controller.getComponent('progress')

      // When: 嘗試使用無效進度狀態
      const invalidProgress = {
        percentage: 50,
        status: 'invalid_status',
        text: '無效狀態'
      }

      // Then: 應該拋出錯誤
      expect(() => {
        progressManager.updateProgress(invalidProgress)
      }).toMatchObject({
        code: expect.any(String),
        message: expect.stringContaining('Invalid progress status: invalid_status'),
        details: expect.any(Object)
      })
    })

    test('應該處理必要欄位缺失的錯誤', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const progressManager = controller.getComponent('progress')

      // When: 嘗試使用缺失必要欄位的進度資料
      const incompleteProgress = {
        percentage: 50
        // 缺少 status 欄位
      }

      // Then: 應該拋出錯誤
      expect(() => {
        progressManager.updateProgress(incompleteProgress)
      }).toMatchObject({
        code: expect.any(String),
        message: expect.stringContaining('Progress data must include percentage and status fields'),
        details: expect.any(Object)
      })
    })

    test('應該支援進度生命週期管理', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const progressManager = controller.getComponent('progress')

      // When: 開始進度
      progressManager.startProgress({ estimatedTotal: 100 })

      // Then: 進度應該正確初始化
      let currentProgress = progressManager.getCurrentProgress()
      expect(currentProgress.percentage).toBe(0)
      expect(currentProgress.status).toBe('starting')
      expect(currentProgress.isVisible).toBe(true)
      expect(currentProgress.estimatedTotal).toBe(100)

      // When: 完成進度
      progressManager.completeProgress({
        totalProcessed: 95,
        successCount: 90,
        failureCount: 5,
        duration: 45000
      })

      // Then: 進度應該正確完成
      currentProgress = progressManager.getCurrentProgress()
      expect(currentProgress.percentage).toBe(100)
      expect(currentProgress.status).toBe('completed')
      expect(currentProgress.isVisible).toBe(false)
      expect(currentProgress.completionData.totalProcessed).toBe(95)
    })

    test('應該支援進度取消功能', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const progressManager = controller.getComponent('progress')

      // When: 開始然後取消進度
      progressManager.startProgress()
      progressManager.updateProgress({ percentage: 30, status: 'extracting', text: '進行中' })
      progressManager.cancelProgress('使用者取消')

      // Then: 進度應該正確取消
      const currentProgress = progressManager.getCurrentProgress()
      expect(currentProgress.status).toBe('cancelled')
      expect(currentProgress.isVisible).toBe(false)
      expect(currentProgress.cancellationReason).toBe('使用者取消')
    })

    test('應該保持進度狀態不可變性', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const progressManager = controller.getComponent('progress')

      // When: 更新進度
      const originalProgress = {
        percentage: 45,
        status: 'extracting',
        text: '原始進度'
      }

      progressManager.updateProgress(originalProgress)
      const retrievedProgress = progressManager.getCurrentProgress()

      // 修改檢索到的進度
      retrievedProgress.percentage = 999
      retrievedProgress.text = '已修改'

      // Then: 內部狀態不應該受到影響
      const currentProgress = progressManager.getCurrentProgress()
      expect(currentProgress.percentage).toBe(45)
      expect(currentProgress.text).toBe('原始進度')
      expect(currentProgress.percentage).not.toBe(999)
    })
  })

  describe('⚠️ 錯誤處理測試', () => {
    test('應該優雅處理 UI 更新失敗', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const progressManager = controller.getComponent('progress')

      // Mock UI 組件的 updateProgress 方法拋出錯誤
      const mockShowError = jest.fn()
      progressManager.uiComponents = {
        ...progressManager.uiComponents,
        updateProgress: jest.fn(() => {
          throw new StandardError('TEST_ERROR', 'DOM 更新失敗', { category: 'testing' })
        }),
        showError: mockShowError
      }

      // When: 嘗試更新進度
      const testProgress = {
        percentage: 50,
        status: 'extracting',
        text: '測試錯誤處理'
      }

      progressManager.updateProgress(testProgress)

      // Then: 應該調用錯誤顯示
      expect(mockShowError).toHaveBeenCalledWith({
        message: 'Progress update failed: DOM 更新失敗',
        type: 'ui_error'
      })

      // 但內部狀態應該正確更新
      const currentProgress = progressManager.getCurrentProgress()
      expect(currentProgress.percentage).toBe(50)
      expect(currentProgress.status).toBe('extracting')
    })
  })
})
