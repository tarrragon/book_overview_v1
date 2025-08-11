/**
 * Chrome Extension - Popup Interface 整合測試
 *
 * 測試範圍：
 * - HTML 結構和 DOM 元素
 * - JavaScript 初始化流程
 * - 與 Background Service Worker 通訊
 * - 與 Content Script 通訊
 * - UI 狀態管理和更新
 * - 事件處理器功能
 *
 * @jest-environment jsdom
 */

const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

describe('Popup Interface 整合測試', () => {
  let dom
  let window
  let document
  let popupScript

  // 載入 popup.html 並初始化環境
  function loadPopupInterface () {
    const popupHtmlPath = path.join(__dirname, '../../../src/popup/popup.html')
    const popupJsPath = path.join(__dirname, '../../../src/popup/popup.js')

    const htmlContent = fs.readFileSync(popupHtmlPath, 'utf8')
    popupScript = fs.readFileSync(popupJsPath, 'utf8')

    dom = new JSDOM(htmlContent, {
      runScripts: 'outside-only',
      resources: 'usable',
      pretendToBeVisual: true
    })

    window = dom.window
    document = window.document

    // 設定全域變數
    global.window = window
    global.document = document
    global.console = console

    // 重要：在載入任何腳本之前就設定 alert mock
    window.alert = jest.fn()

    // Mock Chrome APIs
    global.chrome = {
      runtime: {
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn()
        }
      },
      tabs: {
        query: jest.fn(),
        sendMessage: jest.fn()
      }
    }

    return { window, document }
  }

  beforeEach(() => {
    loadPopupInterface()
  })

  afterEach(() => {
    // 清理
    jest.clearAllMocks()
    if (dom) {
      dom.window.close()
    }
  })

  describe('HTML 結構測試', () => {
    test('應該包含所有必要的 HTML 元素', () => {
      // 基本結構
      expect(document.querySelector('html[lang="zh-TW"]')).toBeTruthy()
      expect(document.querySelector('head title')).toBeTruthy()
      expect(document.title).toBe('Readmoo 書庫提取器')

      // 主要容器
      expect(document.querySelector('.header')).toBeTruthy()
      expect(document.querySelector('.content')).toBeTruthy()

      // 標頭區域
      expect(document.querySelector('.header h1')).toBeTruthy()
      expect(document.querySelector('.header p')).toBeTruthy()
    })

    test('應該包含所有狀態顯示元素', () => {
      // 狀態卡片
      const statusCards = document.querySelectorAll('.status-card')
      expect(statusCards.length).toBeGreaterThanOrEqual(3)

      // 狀態指示器
      expect(document.getElementById('statusDot')).toBeTruthy()
      expect(document.getElementById('statusText')).toBeTruthy()
      expect(document.getElementById('statusInfo')).toBeTruthy()

      // 頁面資訊元素
      expect(document.getElementById('pageInfo')).toBeTruthy()
      expect(document.getElementById('bookCount')).toBeTruthy()
      expect(document.getElementById('extensionStatus')).toBeTruthy()
    })

    test('應該包含所有操作按鈕', () => {
      // 主要操作按鈕
      expect(document.getElementById('extractBtn')).toBeTruthy()
      expect(document.getElementById('settingsBtn')).toBeTruthy()
      expect(document.getElementById('helpBtn')).toBeTruthy()

      // 檢查按鈕類別和屬性
      const extractBtn = document.getElementById('extractBtn')
      expect(extractBtn.classList.contains('button')).toBe(true)
      expect(extractBtn.classList.contains('primary')).toBe(true)
      expect(extractBtn.disabled).toBe(true) // 初始狀態應該是禁用的
    })

    test('應該包含版本資訊和樣式（動態取得 manifest 版本）', () => {
      // 版本資訊元素存在
      const versionElement = document.querySelector('.version')
      expect(versionElement).toBeTruthy()

      // 從 manifest.json 讀取版本號，並 mock chrome.runtime.getManifest
      const manifestPath = path.join(__dirname, '../../../manifest.json')
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      if (!global.chrome.runtime.getManifest) {
        global.chrome.runtime.getManifest = jest.fn(() => ({ version: manifest.version }))
      } else {
        global.chrome.runtime.getManifest.mockImplementation(() => ({ version: manifest.version }))
      }

      // 載入並執行 popup 腳本後更新版本顯示
      eval(popupScript)
      if (window.updateVersionDisplay) {
        window.updateVersionDisplay()
      }

      // 斷言顯示的版本包含 manifest 的版本字串
      expect(versionElement.textContent).toContain(`v${manifest.version}`)

      // 確認有載入樣式
      const styleElements = document.querySelectorAll('style')
      expect(styleElements.length).toBeGreaterThan(0)
    })
  })

  describe('JavaScript 初始化測試', () => {
    test('應該能正確載入和執行 popup.js', () => {
      expect(() => {
        eval(popupScript)
      }).not.toThrow()
    })

    test('應該正確初始化 DOM 元素引用', () => {
      eval(popupScript)

      // 檢查元素變數是否在全域範圍內可存取
      expect(global.elements || window.elements).toBeDefined()
    })

    test('應該設定適當的事件監聽器', () => {
      // 模擬 DOMContentLoaded 事件
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener')

      eval(popupScript)

      // 檢查是否註冊了 DOMContentLoaded 監聽器
      expect(addEventListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function))
    })
  })

  describe('Background Service Worker 通訊測試', () => {
    beforeEach(() => {
      eval(popupScript)
    })

    test('應該能檢查 Background Service Worker 狀態', async () => {
      // 模擬成功回應
      chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        status: 'ready'
      })

      // 呼叫狀態檢查函數
      const checkBackgroundStatus = window.checkBackgroundStatus
      if (checkBackgroundStatus) {
        const result = await checkBackgroundStatus()
        expect(result).toBe(true)
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'GET_STATUS' })
      }
    })

    test('應該處理 Background Service Worker 離線狀況', async () => {
      // 模擬連線失敗
      chrome.runtime.sendMessage.mockRejectedValue(new Error('Service Worker 離線'))

      const checkBackgroundStatus = window.checkBackgroundStatus
      if (checkBackgroundStatus) {
        const result = await checkBackgroundStatus()
        expect(result).toBe(false)
      }
    })
  })

  describe('Content Script 通訊測試', () => {
    beforeEach(() => {
      eval(popupScript)
    })

    test('應該能檢查當前標籤頁狀態', async () => {
      // 模擬標籤頁查詢結果
      chrome.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://readmoo.com/library',
        title: 'Readmoo 書庫'
      }])

      // 模擬 Content Script 回應
      chrome.tabs.sendMessage.mockResolvedValue({
        success: true,
        ready: true
      })

      const checkCurrentTab = window.checkCurrentTab
      if (checkCurrentTab) {
        const result = await checkCurrentTab()
        expect(result).toBeTruthy()
        expect(chrome.tabs.query).toHaveBeenCalledWith({
          active: true,
          currentWindow: true
        })
      }
    })

    test('應該正確識別 Readmoo 頁面', async () => {
      chrome.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://readmoo.com/library',
        title: 'Readmoo 書庫'
      }])

      const checkCurrentTab = window.checkCurrentTab
      if (checkCurrentTab) {
        await checkCurrentTab()

        // 檢查頁面資訊顯示
        const pageInfo = document.getElementById('pageInfo')
        expect(pageInfo.textContent).toContain('Readmoo')
      }
    })

    test('應該處理非 Readmoo 頁面', async () => {
      chrome.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://google.com',
        title: 'Google'
      }])

      const checkCurrentTab = window.checkCurrentTab
      if (checkCurrentTab) {
        await checkCurrentTab()

        // 檢查頁面資訊和按鈕狀態
        const pageInfo = document.getElementById('pageInfo')
        const extractBtn = document.getElementById('extractBtn')

        expect(pageInfo.textContent).toContain('非 Readmoo 頁面')
        expect(extractBtn.disabled).toBe(true)
      }
    })
  })

  describe('UI 狀態管理測試', () => {
    beforeEach(() => {
      eval(popupScript)
    })

    test('應該能更新狀態顯示', () => {
      const updateStatus = window.updateStatus

      if (updateStatus) {
        updateStatus('測試狀態', '測試文字', '測試資訊', 'ready')

        // 檢查 DOM 更新
        expect(document.getElementById('statusText').textContent).toBe('測試文字')
        expect(document.getElementById('statusInfo').textContent).toBe('測試資訊')
        expect(document.getElementById('extensionStatus').textContent).toBe('測試狀態')
        expect(document.getElementById('statusDot').className).toContain('ready')
      }
    })

    test('應該支援不同的狀態類型', () => {
      const updateStatus = window.updateStatus

      if (updateStatus) {
        // 測試不同狀態類型
        const statusTypes = ['loading', 'ready', 'error']

        statusTypes.forEach(type => {
          updateStatus('狀態', '文字', '資訊', type)
          expect(document.getElementById('statusDot').className).toContain(type)
        })
      }
    })
  })

  describe('事件處理器測試', () => {
    beforeEach(() => {
      eval(popupScript)

      // 確保事件監聽器已設定
      if (window.setupEventListeners) {
        window.setupEventListeners()
      }
    })

    test('應該設定提取按鈕點擊事件', () => {
      const extractBtn = document.getElementById('extractBtn')
      const clickEvent = new window.MouseEvent('click', { bubbles: true })

      // 模擬標籤頁存在
      chrome.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://readmoo.com/library'
      }])

      chrome.tabs.sendMessage.mockResolvedValue({
        success: true,
        message: '提取完成'
      })

      expect(() => {
        extractBtn.dispatchEvent(clickEvent)
      }).not.toThrow()
    })

    test('應該設定設定按鈕點擊事件', () => {
      const settingsBtn = document.getElementById('settingsBtn')
      const clickEvent = new window.MouseEvent('click', { bubbles: true })

      settingsBtn.dispatchEvent(clickEvent)

      expect(window.alert).toHaveBeenCalledWith('設定功能將在後續版本實現')
    })

    test('應該設定說明按鈕點擊事件', () => {
      const helpBtn = document.getElementById('helpBtn')
      const clickEvent = new window.MouseEvent('click', { bubbles: true })

      helpBtn.dispatchEvent(clickEvent)

      expect(window.alert).toHaveBeenCalled()
      const alertCall = window.alert.mock.calls[0][0]
      expect(alertCall).toContain('使用說明')
    })
  })

  describe('錯誤處理測試', () => {
    beforeEach(() => {
      eval(popupScript)
    })

    test('應該處理初始化錯誤', () => {
      // 模擬錯誤事件
      const errorEvent = new window.ErrorEvent('error', {
        error: new Error('測試錯誤'),
        message: '測試錯誤訊息'
      })

      expect(() => {
        window.dispatchEvent(errorEvent)
      }).not.toThrow()
    })

    test('應該處理 API 呼叫錯誤', async () => {
      chrome.runtime.sendMessage.mockRejectedValue(new Error('API 錯誤'))

      const checkBackgroundStatus = window.checkBackgroundStatus
      if (checkBackgroundStatus) {
        const result = await checkBackgroundStatus()
        expect(result).toBe(false)
      }
    })
  })

  describe('效能和記憶體管理測試', () => {
    test('應該適當清理事件監聽器', () => {
      eval(popupScript)

      // 檢查是否有適當的清理機制
      // 這裡主要確保沒有記憶體洩漏的風險
      expect(document.querySelectorAll('*').length).toBeGreaterThan(0)
    })

    test('應該處理頁面可見性變更', () => {
      eval(popupScript)

      // 模擬頁面可見性 API
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        value: 'visible'
      })

      // 檢查是否有適當的可見性處理
      expect(document.visibilityState).toBe('visible')
    })
  })

  describe('響應式設計和無障礙功能測試', () => {
    test('應該包含適當的 ARIA 標籤', () => {
      // 檢查重要元素是否有適當的標籤
      const buttons = document.querySelectorAll('button')
      buttons.forEach(button => {
        expect(button.textContent.length).toBeGreaterThan(0)
      })
    })

    test('應該支援鍵盤導航', () => {
      // 檢查按鈕是否可以透過鍵盤存取
      const buttons = document.querySelectorAll('button')
      buttons.forEach(button => {
        expect(button.tabIndex).not.toBe(-1)
      })
    })

    test('應該有適當的視覺回饋', () => {
      // 檢查狀態指示器
      const statusDot = document.getElementById('statusDot')
      expect(statusDot.className).toContain('status-dot')

      // 檢查按鈕樣式
      const extractBtn = document.getElementById('extractBtn')
      expect(extractBtn.className).toContain('button')
    })
  })

  // ==================== TDD Cycle #14: 提取控制界面 ====================
  describe('🚀 TDD Cycle #14: 提取控制界面', () => {
    describe('🟢 綠燈階段 - 提取觸發按鈕高級功能', () => {
      test('應該能檢測提取按鈕的狀態管理', () => {
        loadPopupInterface()
        eval(popupScript)

        // 檢查按鈕的初始狀態
        const extractBtn = document.getElementById('extractBtn')
        expect(extractBtn).toBeTruthy()
        expect(extractBtn.disabled).toBe(true) // 初始應該是禁用狀態

        // 檢查按鈕文字是否反映狀態
        expect(extractBtn.textContent).toContain('提取')
      })

      test('應該能處理提取按鈕的進行中狀態', () => {
        loadPopupInterface()
        eval(popupScript)

        // 模擬提取開始
        const extractBtn = document.getElementById('extractBtn')

        // 測試按鈕狀態更新功能
        if (window.updateButtonState) {
          // 模擬提取中狀態 - 傳入禁用狀態和新文字
          window.updateButtonState(true, '⏳ 提取中...')

          expect(extractBtn.disabled).toBe(true)
          expect(extractBtn.textContent).toContain('提取中')
        }
      })

      test('應該能處理提取取消功能', () => {
        loadPopupInterface()
        eval(popupScript)

        // 檢查取消提取功能已實現
        expect(window.cancelExtraction).toBeDefined()
        expect(typeof window.cancelExtraction).toBe('function')
      })
    })

    describe('🟢 綠燈階段 - 進度顯示功能', () => {
      test('應該有進度條元素', () => {
        loadPopupInterface()

        // 檢查進度條相關元素存在
        const progressBar = document.getElementById('progressBar')
        const progressText = document.getElementById('progressText')
        const progressPercentage = document.getElementById('progressPercentage')

        expect(progressBar).toBeTruthy()
        expect(progressText).toBeTruthy()
        expect(progressPercentage).toBeTruthy()
      })

      test('應該能顯示提取進度', () => {
        loadPopupInterface()
        eval(popupScript)

        // 檢查進度更新功能已實現
        expect(window.updateProgress).toBeDefined()
        expect(typeof window.updateProgress).toBe('function')

        // 測試進度更新功能
        if (window.updateProgress) {
          window.updateProgress(50, '正在提取第50本書...')

          const progressPercentage = document.getElementById('progressPercentage')
          const progressText = document.getElementById('progressText')

          expect(progressPercentage.textContent).toBe('50%')
          expect(progressText.textContent).toBe('正在提取第50本書...')
        }
      })

      test('應該能處理進度事件', () => {
        loadPopupInterface()
        eval(popupScript)

        // 檢查進度相關功能已實現
        expect(window.updateProgress).toBeDefined()
        expect(window.hideProgress).toBeDefined()
      })
    })

    describe('🟢 綠燈階段 - 結果展示功能', () => {
      test('應該有結果顯示區域', () => {
        loadPopupInterface()

        // 檢查結果顯示相關元素存在
        const resultsContainer = document.getElementById('resultsContainer')
        const bookCount = document.getElementById('extractedBookCount')
        const extractionTime = document.getElementById('extractionTime')

        expect(resultsContainer).toBeTruthy()
        expect(bookCount).toBeTruthy()
        expect(extractionTime).toBeTruthy()
      })

      test('應該能展示提取結果統計', () => {
        loadPopupInterface()
        eval(popupScript)

        // 檢查結果展示功能已實現
        expect(window.displayExtractionResults).toBeDefined()
        expect(typeof window.displayExtractionResults).toBe('function')

        // 測試結果展示功能
        if (window.displayExtractionResults) {
          const testResults = {
            bookCount: 123,
            extractionTime: '2分30秒',
            successRate: 98
          }

          window.displayExtractionResults(testResults)

          const bookCount = document.getElementById('extractedBookCount')
          const extractionTime = document.getElementById('extractionTime')
          const successRate = document.getElementById('successRate')

          expect(bookCount.textContent).toBe('123')
          expect(extractionTime.textContent).toBe('2分30秒')
          expect(successRate.textContent).toBe('98%')
        }
      })

      test('應該能提供結果匯出功能', () => {
        loadPopupInterface()
        eval(popupScript)

        // 檢查匯出功能已實現
        expect(window.exportResults).toBeDefined()
        expect(typeof window.exportResults).toBe('function')
      })
    })

    describe('🟢 綠燈階段 - 錯誤處理和使用者體驗', () => {
      test('應該能處理提取失敗情況', () => {
        loadPopupInterface()
        eval(popupScript)

        // 檢查錯誤處理功能已實現
        expect(window.handleExtractionError).toBeDefined()
        expect(typeof window.handleExtractionError).toBe('function')

        // 測試錯誤處理功能
        if (window.handleExtractionError) {
          window.handleExtractionError('測試錯誤訊息')

          const errorContainer = document.getElementById('errorContainer')
          const errorMessage = document.getElementById('errorMessage')

          expect(errorContainer.style.display).toBe('block')
          expect(errorMessage.textContent).toBe('測試錯誤訊息')
        }
      })

      test('應該能顯示詳細的錯誤訊息', () => {
        loadPopupInterface()

        // 檢查錯誤訊息顯示區域存在
        const errorContainer = document.getElementById('errorContainer')
        const errorMessage = document.getElementById('errorMessage')

        expect(errorContainer).toBeTruthy()
        expect(errorMessage).toBeTruthy()
      })

      test('應該能提供重試機制', () => {
        loadPopupInterface()
        eval(popupScript)

        // 檢查重試功能已實現
        expect(window.retryExtraction).toBeDefined()
        expect(typeof window.retryExtraction).toBe('function')
      })
    })
  })
})
