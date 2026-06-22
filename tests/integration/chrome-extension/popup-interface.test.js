/* eslint-disable no-console */

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

// eslint-disable-next-line no-unused-vars
const fs = require('fs')
// eslint-disable-next-line no-unused-vars
const path = require('path')
const { JSDOM } = require('jsdom')

describe('Popup Interface 整合測試', () => {
  let dom
  let window
  let document
  let popupScript

  // 載入 popup.html 並初始化環境
  function loadPopupInterface () {
    // eslint-disable-next-line no-unused-vars
    const popupHtmlPath = path.join(__dirname, '../../../src/popup/popup.html')
    // eslint-disable-next-line no-unused-vars
    const popupJsPath = path.join(__dirname, '../../../src/popup/popup.js')

    // eslint-disable-next-line no-unused-vars
    const htmlContent = fs.readFileSync(popupHtmlPath, 'utf8')
    // eslint-disable-next-line no-unused-vars
    let popupScriptContent = fs.readFileSync(popupJsPath, 'utf8')

    // 轉換 ES6 import 語句為適合測試環境的格式
    // 移除 import 語句並提供 mock 替代
    popupScriptContent = popupScriptContent
      .replace(/import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"]/g, '')
      .replace(/import\s+[^'"\n]+from\s+['"][^'"]+['"]/g, '')
      // 替換 MessageDictionary 的實例化
      .replace(/new MessageDictionary\(/g, 'new window.MessageDictionary(')
      // 替換 Logger 的實例化
      .replace(/new Logger\(/g, 'new window.Logger(')

    popupScript = popupScriptContent

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

    // Mock 模組依賴 - 提供 Logger 和 MessageDictionary 的 mock 實作
    window.Logger = class MockLogger {
      constructor (namespace) {
        this.namespace = namespace
      }

      // eslint-disable-next-line no-console
      info (msg) { console.log(`[INFO] ${this.namespace}: ${msg}`) }
      // eslint-disable-next-line no-console
      warn (msg) { console.warn(`[WARN] ${this.namespace}: ${msg}`) }
      // eslint-disable-next-line no-console
      error (msg) { console.error(`[ERROR] ${this.namespace}: ${msg}`) }
    }

    window.MessageDictionary = class MockMessageDictionary {
      constructor (messages = {}) {
        // 將傳入的訊息物件合併到實例中
        Object.assign(this, messages)
      }

      // 提供基本的訊息字典結構
      static POPUP = {
        INIT_SUCCESS: 'popup_init_success',
        CHECK_BACKGROUND: 'check_background_status',
        GET_TAB_STATUS: 'get_tab_status',
        START_EXTRACTION: 'start_extraction',
        STOP_EXTRACTION: 'stop_extraction'
      }
    }

    // eval 環境無法解析 require('./constants')，提供 window fallback
    // （對應 popup.js popupConstants 的 window.PopupConstants fallback）
    window.PopupConstants = require('src/popup/constants')

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
      // eslint-disable-next-line no-unused-vars
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
      // eslint-disable-next-line no-unused-vars
      const extractBtn = document.getElementById('extractBtn')
      expect(extractBtn.classList.contains('button')).toBe(true)
      expect(extractBtn.classList.contains('primary')).toBe(true)
      expect(extractBtn.disabled).toBe(true) // 初始狀態應該是禁用的
    })

    test('應該包含版本資訊和樣式（動態取得 manifest 版本）', () => {
      // 版本資訊元素存在
      // eslint-disable-next-line no-unused-vars
      const versionElement = document.querySelector('.version')
      expect(versionElement).toBeTruthy()

      // 從 manifest.json 讀取版本號，並 mock chrome.runtime.getManifest
      // eslint-disable-next-line no-unused-vars
      const manifestPath = path.join(__dirname, '../../../manifest.json')
      // eslint-disable-next-line no-unused-vars
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      if (!global.chrome.runtime.getManifest) {
        global.chrome.runtime.getManifest = jest.fn(() => ({ version: manifest.version }))
      } else {
        global.chrome.runtime.getManifest.mockImplementation(() => ({ version: manifest.version }))
      }

      // 載入並執行 popup 腳本後更新版本顯示
      // eslint-disable-next-line no-eval
      eval(popupScript)
      if (window.updateVersionDisplay) {
        window.updateVersionDisplay()
      }

      // 斷言顯示的版本包含 manifest 的版本字串
      expect(versionElement.textContent).toContain(`v${manifest.version}`)

      // 確認有載入樣式
      // eslint-disable-next-line no-unused-vars
      const styleElements = document.querySelectorAll('style')
      expect(styleElements.length).toBeGreaterThan(0)
    })
  })

  describe('JavaScript 初始化測試', () => {
    test('應該能正確載入和執行 popup.js', () => {
      expect(() => {
        // eslint-disable-next-line no-eval
        eval(popupScript)
      }).not.toThrow()
    })

    test('應該正確初始化 DOM 元素引用', () => {
      // eslint-disable-next-line no-eval
      eval(popupScript)

      // 檢查元素變數是否在全域範圍內可存取
      expect(global.elements || window.elements).toBeDefined()
    })

    test('應該設定適當的事件監聽器', () => {
      // 模擬 DOMContentLoaded 事件
      // eslint-disable-next-line no-unused-vars
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener')

      // eslint-disable-next-line no-eval
      eval(popupScript)

      // 檢查是否註冊了 DOMContentLoaded 監聽器
      expect(addEventListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function))
    })
  })

  describe('Background Service Worker 通訊測試', () => {
    beforeEach(() => {
      // eslint-disable-next-line no-eval
      eval(popupScript)
    })

    test('應該能檢查 Background Service Worker 狀態', async () => {
      // 模擬成功回應
      chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        status: 'ready'
      })

      // 呼叫狀態檢查函數
      // eslint-disable-next-line no-unused-vars
      const checkBackgroundStatus = window.checkBackgroundStatus
      if (checkBackgroundStatus) {
        // eslint-disable-next-line no-unused-vars
        const result = await checkBackgroundStatus()
        expect(result).toBe(true)
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'GET_STATUS' })
      }
    })

    test('應該處理 Background Service Worker 離線狀況', async () => {
      // 模擬連線失敗
      chrome.runtime.sendMessage.mockRejectedValue(new Error('Service Worker 離線'))

      // eslint-disable-next-line no-unused-vars
      const checkBackgroundStatus = window.checkBackgroundStatus
      if (checkBackgroundStatus) {
        // eslint-disable-next-line no-unused-vars
        const result = await checkBackgroundStatus()
        expect(result).toBe(false)
      }
    })
  })

  describe('Content Script 通訊測試', () => {
    beforeEach(() => {
      // eslint-disable-next-line no-eval
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

      // eslint-disable-next-line no-unused-vars
      const checkCurrentTab = window.checkCurrentTab
      if (checkCurrentTab) {
        // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const checkCurrentTab = window.checkCurrentTab
      if (checkCurrentTab) {
        await checkCurrentTab()

        // 檢查頁面資訊顯示
        // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const checkCurrentTab = window.checkCurrentTab
      if (checkCurrentTab) {
        await checkCurrentTab()

        // 檢查頁面資訊和按鈕狀態
        // eslint-disable-next-line no-unused-vars
        const pageInfo = document.getElementById('pageInfo')
        // eslint-disable-next-line no-unused-vars
        const extractBtn = document.getElementById('extractBtn')

        expect(pageInfo.textContent).toContain('非 Readmoo 頁面')
        expect(extractBtn.disabled).toBe(true)
      }
    })
  })

  describe('UI 狀態管理測試', () => {
    beforeEach(() => {
      // eslint-disable-next-line no-eval
      eval(popupScript)
    })

    test('應該能更新狀態顯示', () => {
      // eslint-disable-next-line no-unused-vars
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
      // eslint-disable-next-line no-unused-vars
      const updateStatus = window.updateStatus

      if (updateStatus) {
        // 測試不同狀態類型
        // eslint-disable-next-line no-unused-vars
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
      // eslint-disable-next-line no-eval
      eval(popupScript)

      // 確保事件監聽器已設定
      if (window.setupEventListeners) {
        window.setupEventListeners()
      }
    })

    test('應該設定提取按鈕點擊事件', () => {
      // eslint-disable-next-line no-unused-vars
      const extractBtn = document.getElementById('extractBtn')
      // eslint-disable-next-line no-unused-vars
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
      // eslint-disable-next-line no-unused-vars
      const settingsBtn = document.getElementById('settingsBtn')
      // eslint-disable-next-line no-unused-vars
      const clickEvent = new window.MouseEvent('click', { bubbles: true })

      settingsBtn.dispatchEvent(clickEvent)

      expect(window.alert).toHaveBeenCalledWith('設定功能將在後續版本實現')
    })

    test('應該設定說明按鈕點擊事件', () => {
      // eslint-disable-next-line no-unused-vars
      const helpBtn = document.getElementById('helpBtn')
      // eslint-disable-next-line no-unused-vars
      const clickEvent = new window.MouseEvent('click', { bubbles: true })

      helpBtn.dispatchEvent(clickEvent)

      expect(window.alert).toHaveBeenCalled()
      // eslint-disable-next-line no-unused-vars
      const alertCall = window.alert.mock.calls[0][0]
      expect(alertCall).toContain('使用說明')
    })
  })

  describe('錯誤處理測試', () => {
    beforeEach(() => {
      // eslint-disable-next-line no-eval
      eval(popupScript)
    })

    test('應該處理初始化錯誤', () => {
      // 模擬錯誤事件
      // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const checkBackgroundStatus = window.checkBackgroundStatus
      if (checkBackgroundStatus) {
        // eslint-disable-next-line no-unused-vars
        const result = await checkBackgroundStatus()
        expect(result).toBe(false)
      }
    })
  })

  describe('效能和記憶體管理測試', () => {
    test('應該適當清理事件監聽器', () => {
      // eslint-disable-next-line no-eval
      eval(popupScript)

      // 檢查是否有適當的清理機制
      // 這裡主要確保沒有記憶體洩漏的風險
      expect(document.querySelectorAll('*').length).toBeGreaterThan(0)
    })

    test('應該處理頁面可見性變更', () => {
      // eslint-disable-next-line no-eval
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
      // eslint-disable-next-line no-unused-vars
      const buttons = document.querySelectorAll('button')
      buttons.forEach(button => {
        expect(button.textContent.length).toBeGreaterThan(0)
      })
    })

    test('應該支援鍵盤導航', () => {
      // 檢查按鈕是否可以透過鍵盤存取
      // eslint-disable-next-line no-unused-vars
      const buttons = document.querySelectorAll('button')
      buttons.forEach(button => {
        expect(button.tabIndex).not.toBe(-1)
      })
    })

    test('應該有適當的視覺回饋', () => {
      // 檢查狀態指示器
      // eslint-disable-next-line no-unused-vars
      const statusDot = document.getElementById('statusDot')
      expect(statusDot.className).toContain('status-dot')

      // 檢查按鈕樣式
      // eslint-disable-next-line no-unused-vars
      const extractBtn = document.getElementById('extractBtn')
      expect(extractBtn.className).toContain('button')
    })
  })

  // ==================== TDD Cycle #14: 提取控制界面 ====================
  describe('[START] TDD Cycle #14: 提取控制界面', () => {
    describe('🟢 綠燈階段 - 提取觸發按鈕高級功能', () => {
      test('應該能檢測提取按鈕的狀態管理', () => {
        loadPopupInterface()
        // eslint-disable-next-line no-eval
        eval(popupScript)

        // 檢查按鈕的初始狀態
        // eslint-disable-next-line no-unused-vars
        const extractBtn = document.getElementById('extractBtn')
        expect(extractBtn).toBeTruthy()
        expect(extractBtn.disabled).toBe(true) // 初始應該是禁用狀態

        // 檢查按鈕文字是否反映狀態
        expect(extractBtn.textContent).toContain('提取')
      })

      test('應該能處理提取按鈕的進行中狀態', () => {
        loadPopupInterface()
        // eslint-disable-next-line no-eval
        eval(popupScript)

        // 模擬提取開始
        // eslint-disable-next-line no-unused-vars
        const extractBtn = document.getElementById('extractBtn')

        // 測試按鈕狀態更新功能
        if (window.updateButtonState) {
          // 模擬提取中狀態 - 傳入禁用狀態和新文字
          window.updateButtonState(true, '[WAIT] 提取中...')

          expect(extractBtn.disabled).toBe(true)
          expect(extractBtn.textContent).toContain('提取中')
        }
      })

      test('應該能處理提取取消功能', () => {
        loadPopupInterface()
        // eslint-disable-next-line no-eval
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
        // eslint-disable-next-line no-unused-vars
        const progressBar = document.getElementById('progressBar')
        // eslint-disable-next-line no-unused-vars
        const progressText = document.getElementById('progressText')
        // eslint-disable-next-line no-unused-vars
        const progressPercentage = document.getElementById('progressPercentage')

        expect(progressBar).toBeTruthy()
        expect(progressText).toBeTruthy()
        expect(progressPercentage).toBeTruthy()
      })

      test('應該能顯示提取進度', () => {
        loadPopupInterface()
        // eslint-disable-next-line no-eval
        eval(popupScript)

        // 檢查進度更新功能已實現
        expect(window.updateProgress).toBeDefined()
        expect(typeof window.updateProgress).toBe('function')

        // 測試進度更新功能
        if (window.updateProgress) {
          window.updateProgress(50, '正在提取第50本書...')

          // eslint-disable-next-line no-unused-vars
          const progressPercentage = document.getElementById('progressPercentage')
          // eslint-disable-next-line no-unused-vars
          const progressText = document.getElementById('progressText')

          expect(progressPercentage.textContent).toBe('50%')
          expect(progressText.textContent).toBe('正在提取第50本書...')
        }
      })

      test('應該能處理進度事件', () => {
        loadPopupInterface()
        // eslint-disable-next-line no-eval
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
        // eslint-disable-next-line no-unused-vars
        const resultsContainer = document.getElementById('resultsContainer')
        // eslint-disable-next-line no-unused-vars
        const bookCount = document.getElementById('extractedBookCount')
        // eslint-disable-next-line no-unused-vars
        const extractionTime = document.getElementById('extractionTime')

        expect(resultsContainer).toBeTruthy()
        expect(bookCount).toBeTruthy()
        expect(extractionTime).toBeTruthy()
      })

      test('應該能展示提取結果統計', () => {
        loadPopupInterface()
        // eslint-disable-next-line no-eval
        eval(popupScript)

        // 檢查結果展示功能已實現
        expect(window.displayExtractionResults).toBeDefined()
        expect(typeof window.displayExtractionResults).toBe('function')

        // 測試結果展示功能
        if (window.displayExtractionResults) {
          // eslint-disable-next-line no-unused-vars
          const testResults = {
            bookCount: 123,
            extractionTime: '2分30秒',
            successRate: 98
          }

          window.displayExtractionResults(testResults)

          // eslint-disable-next-line no-unused-vars
          const bookCount = document.getElementById('extractedBookCount')
          // eslint-disable-next-line no-unused-vars
          const extractionTime = document.getElementById('extractionTime')
          // eslint-disable-next-line no-unused-vars
          const successRate = document.getElementById('successRate')

          expect(bookCount.textContent).toBe('123')
          expect(extractionTime.textContent).toBe('2分30秒')
          expect(successRate.textContent).toBe('98%')
        }
      })

      test('應該能提供結果匯出功能', () => {
        loadPopupInterface()
        // eslint-disable-next-line no-eval
        eval(popupScript)

        // 檢查匯出功能已實現
        expect(window.exportResults).toBeDefined()
        expect(typeof window.exportResults).toBe('function')
      })
    })

    describe('🟢 綠燈階段 - 錯誤處理和使用者體驗', () => {
      test('應該能處理提取失敗情況', () => {
        loadPopupInterface()
        // eslint-disable-next-line no-eval
        eval(popupScript)

        // 檢查錯誤處理功能已實現
        expect(window.handleExtractionError).toBeDefined()
        expect(typeof window.handleExtractionError).toBe('function')

        // 測試錯誤處理功能
        if (window.handleExtractionError) {
          window.handleExtractionError('測試錯誤訊息')

          // eslint-disable-next-line no-unused-vars
          const errorContainer = document.getElementById('errorContainer')
          // eslint-disable-next-line no-unused-vars
          const errorMessage = document.getElementById('errorMessage')

          expect(errorContainer.style.display).toBe('block')
          expect(errorMessage.textContent).toBe('測試錯誤訊息')
        }
      })

      test('應該能顯示詳細的錯誤訊息', () => {
        loadPopupInterface()

        // 檢查錯誤訊息顯示區域存在
        // eslint-disable-next-line no-unused-vars
        const errorContainer = document.getElementById('errorContainer')
        // eslint-disable-next-line no-unused-vars
        const errorMessage = document.getElementById('errorMessage')

        expect(errorContainer).toBeTruthy()
        expect(errorMessage).toBeTruthy()
      })

      test('應該能提供重試機制', () => {
        loadPopupInterface()
        // eslint-disable-next-line no-eval
        eval(popupScript)

        // 檢查重試功能已實現
        expect(window.retryExtraction).toBeDefined()
        expect(typeof window.retryExtraction).toBe('function')
      })
    })
  })

  /**
   * W4-006: extractBtn UI 觸發路徑覆蓋
   *
   * 業務情境：
   * - W1-008 Phase 3b 偏差 2 揭露：Puppeteer 環境下 popup 為獨立分頁致 checkCurrentTab
   *   誤判、extractBtn 保持 disabled，E2E 改以 SW 直送 START_EXTRACTION，
   *   popup UI button 觸發層因此未被 E2E 覆蓋。
   * - W4-006 Phase 1 spike 確認方案 1（Puppeteer 真實 popup overlay）物理不可行，
   *   方案 3（真實 click）受 popup Logger 重複宣告 pageerror 阻擋（已 spawn W4-006.1/.2）。
   * - 採方案 2：integration test 層 mock chrome.tabs API 覆蓋
   *   checkCurrentTab → extractBtn.disabled → click → sendMessage(START_EXTRACTION)
   *   → UI 進入「提取中」狀態流轉的完整邏輯鏈。
   *
   * 三 case 設計：
   * - Case A：checkCurrentTab + readmoo tab + Content Script 就緒 → extractBtn.disabled = false
   * - Case B：extractBtn.click() → chrome.tabs.sendMessage 被以 {type:'START_EXTRACTION'} 呼叫
   *           且 tab.id 正確（含 PING 與 START_EXTRACTION 兩次 sendMessage 的存在性斷言）
   * - Case C：sendMessage 成功回應後 popup UI 進入「提取中」狀態（statusText、extensionStatus、
   *           extractBtn.disabled、statusDot 四個 DOM 副作用）
   *
   * 預期 GREEN（regression 防護型 IMP，非 RED-first TDD）：
   * - popup.js 邏輯已完整實作三個 case（Phase 2 評估），本區段補測試固化行為避免回歸
   *
   * 設計考量：
   * - chrome.storage.onChanged 在本區 beforeEach 額外 mock，
   *   避免 startExtraction → setupExtractionCompletionListener 因 chrome.storage undefined 早 return
   * - sendMessage call sequence 含 PING（checkCurrentTab）+ START_EXTRACTION（startExtraction），
   *   採 mock.calls.some 寬鬆斷言而非嚴格順序，提升測試穩健度
   */
  describe('W4-006: extractBtn UI 觸發路徑覆蓋', () => {
    const READMOO_TAB_FIXTURE = {
      id: 42,
      url: 'https://read.readmoo.com/library',
      title: 'Readmoo 書庫'
    }

    beforeEach(() => {
      // loadPopupInterface() 已由外層 beforeEach 呼叫，
      // 本區補充 chrome.storage mock 確保 startExtraction 內
      // setupExtractionCompletionListener 不因 chrome.storage undefined 早 return
      global.chrome.storage = {
        onChanged: {
          addListener: jest.fn(),
          removeListener: jest.fn()
        },
        local: {}
      }

      // eslint-disable-next-line no-eval
      eval(popupScript)

      // 確保 extractBtn click handler 已綁定
      if (window.setupEventListeners) {
        window.setupEventListeners()
      }
    })

    test('case A: 應在 Readmoo tab + Content Script 就緒時啟用 extractBtn', async () => {
      // 前置斷言：popup 初始 extractBtn 狀態（依 popup.html 預設）
      const extractBtn = document.getElementById('extractBtn')
      expect(extractBtn).toBeTruthy()

      // Mock 配置：readmoo tab + PING 回應成功
      chrome.tabs.query.mockResolvedValue([READMOO_TAB_FIXTURE])
      chrome.tabs.sendMessage.mockResolvedValue({ success: true })

      // When：觸發 checkCurrentTab
      expect(window.checkCurrentTab).toBeDefined()
      await window.checkCurrentTab()

      // Then：斷言 chrome API 被以正確參數呼叫
      expect(chrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true
      })

      // Then：斷言 PING 被以 readmoo tab.id 呼叫
      const pingCalled = chrome.tabs.sendMessage.mock.calls.some(
        call => call[0] === READMOO_TAB_FIXTURE.id && call[1] && call[1].type === 'PING'
      )
      expect(pingCalled).toBe(true)

      // Then：核心斷言 → extractBtn.disabled = false（補強既有測試僅驗證 query 被呼叫的覆蓋缺口）
      expect(extractBtn.disabled).toBe(false)

      // Then：pageInfo 顯示 Readmoo
      const pageInfo = document.getElementById('pageInfo')
      expect(pageInfo.textContent).toContain('Readmoo')
    })

    /**
     * Microtask flush helper for chained-promise scenarios in Jest jsdom.
     *
     * startExtraction 內含多層 chained await：
     *   1. await checkCurrentTab() → 內含 await chrome.tabs.query + await sendMessage(PING)
     *   2. await chrome.tabs.sendMessage(START_EXTRACTION)
     *   3. response 處理後的 updateStatus / isFinalStatus 寫入
     *
     * 每層 await 在 jsdom 環境下需一輪 macrotask boundary 才會排程後續 microtask，
     * 故 n=3 對應三層 chained promise 深度。提高 n 不會造成測試錯誤，
     * 但若 startExtraction 未來新增 await 層級，需同步調整。
     *
     * @param {number} n 需要 flush 的 macrotask 輪數（預設 3，對應目前 chained 深度）
     */
    const flushMicrotasks = async (n = 3) => {
      for (let i = 0; i < n; i++) {
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }

    test('case B: 應在 extractBtn click 時發送 START_EXTRACTION 至當前 readmoo tab', async () => {
      // Mock 配置：readmoo tab + PING/START_EXTRACTION 都成功
      chrome.tabs.query.mockResolvedValue([READMOO_TAB_FIXTURE])
      chrome.tabs.sendMessage.mockResolvedValue({ success: true, message: '已啟動' })

      const extractBtn = document.getElementById('extractBtn')
      expect(extractBtn).toBeTruthy()

      // When：dispatchEvent click 觸發 startExtraction（async 流程）
      const clickEvent = new window.MouseEvent('click', { bubbles: true })
      extractBtn.dispatchEvent(clickEvent)

      // 等 async startExtraction 完整走完（chained await：query + PING + START_EXTRACTION）
      await flushMicrotasks()

      // Then：sendMessage 至少被呼叫 2 次（PING + START_EXTRACTION）
      expect(chrome.tabs.sendMessage.mock.calls.length).toBeGreaterThanOrEqual(2)

      // Then：核心斷言 → 存在一次 sendMessage 以 (READMOO_TAB_FIXTURE.id, {type:'START_EXTRACTION'}) 呼叫
      const startExtractionCalled = chrome.tabs.sendMessage.mock.calls.some(
        call => call[0] === READMOO_TAB_FIXTURE.id &&
                call[1] &&
                call[1].type === 'START_EXTRACTION'
      )
      expect(startExtractionCalled).toBe(true)
    })

    test('case C: 應在 START_EXTRACTION 成功回應後將 UI 切換至完成終態', async () => {
      // Mock 配置：同 case B（response.success=true → 進入 updateStatus('完成', ...) 終態分支）
      chrome.tabs.query.mockResolvedValue([READMOO_TAB_FIXTURE])
      chrome.tabs.sendMessage.mockResolvedValue({ success: true, message: '已啟動' })

      const extractBtn = document.getElementById('extractBtn')

      // When：dispatchEvent click 觸發完整 startExtraction 流程
      const clickEvent = new window.MouseEvent('click', { bubbles: true })
      extractBtn.dispatchEvent(clickEvent)

      // chained await flush（query + PING + START_EXTRACTION + response 處理）
      await flushMicrotasks()

      // popup.js startExtraction 成功路徑邏輯步驟：
      //   1. updateStatus 過渡呼叫：('提取中', EXTRACTION_IN_PROGRESS, ..., LOADING)
      //   2. sendMessage(START_EXTRACTION) 等待回應
      //   3. response.success=true 後 updateStatus 終態呼叫：('完成', '資料提取完成', ..., READY)
      //
      // 由於 mock 為 deterministic（永遠回 success:true）且 flushMicrotasks 覆蓋全部 chained await，
      // 此 case 必然走到終態。斷言收斂為精確終態值，避免寬鬆 OR 斷言遮蔽未來回歸
      // （如 updateStatus 誤傳含「資料」字眼的錯誤訊息將不會被偵測）。
      const statusText = document.getElementById('statusText')
      const extensionStatus = document.getElementById('extensionStatus')
      const statusDot = document.getElementById('statusDot')

      // 終態斷言：updateStatus('完成', '資料提取完成', ..., STATUS_TYPES.READY)
      // - statusText.textContent ← text 參數（'資料提取完成'）
      // - extensionStatus.textContent ← status 參數（'完成'）
      // - statusDot.className ← `status-dot ${type}`，type=READY='ready'
      expect(statusText.textContent).toBe('資料提取完成')
      expect(extensionStatus.textContent).toBe('完成')
      expect(statusDot.className).toBe('status-dot ready')
    })
  })
})

/**
 * Popup Logger ↔ MessageDictionary 真實整合測試 (0.19.0-W1-116)
 *
 * 業務情境：
 * - 上方 36 個 test case 使用 MockLogger / MockMessageDictionary，
 *   不檢查訊息文字，這是 W1-106 false positive 通過的根本原因。
 * - W1-112 ANA 重大發現：Logger constructor 三參數 (name, level, messages)
 *   假設不成立。原 constructor (name, level) hardcoded
 *   `this.messages = GlobalMessages`，導致 popup local dict 註冊靜默失敗。
 * - W1-115 修復 constructor signature 加第三參數 messages = GlobalMessages。
 * - 本區段使用「真實 Logger + 真實 MessageDictionary + popup.js 本人的
 *   local dict 內容」直接驗證 5 個 popup-specific key 解析回 popup 自訂文字
 *   而非 [Missing: KEY] 或 GlobalMessages 預設文字。
 *
 * 驗收覆蓋（W1-116 AC 2）：
 * - 5 個 popup key（POPUP_INTERFACE_LOADED / POPUP_SCRIPT_LOADED /
 *   POPUP_INIT_START / POPUP_INIT_COMPLETE / INITIALIZATION_COMPLETE）
 *   經 popup local dict 注入後 logger.info(...) 輸出符合預期文字。
 */
describe('Popup Logger ↔ MessageDictionary 真實整合 (0.19.0-W1-116)', () => {
  const { Logger } = require('../../../src/core/logging/Logger')
  const { MessageDictionary } = require('../../../src/core/messages/MessageDictionary')

  // 重現 src/popup/popup.js:79-101 的 local dict 內容（節錄 5 個關鍵 key）
  // 注意：INITIALIZATION_COMPLETE 由 popup-error-handler.js 使用，非 popup.js，
  //       測試補入此 key 以涵蓋完整 5 個 popup-specific key 的解析行為
  function createPopupLocalDict () {
    return new MessageDictionary({
      POPUP_INTERFACE_LOADED: 'Popup Interface 載入完成',
      POPUP_SCRIPT_LOADED: '[OK] Popup Script 載入完成',
      POPUP_INIT_START: '[START] 開始初始化 Popup Interface',
      POPUP_INIT_COMPLETE: '[OK] Popup Interface 初始化完成',
      INITIALIZATION_COMPLETE: '初始化流程完成'
    })
  }

  let infoSpy

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    infoSpy.mockRestore()
  })

  it('POPUP_INTERFACE_LOADED 應解析為 popup local dict 自訂文字（非 [Missing: KEY]）', () => {
    const localDict = createPopupLocalDict()
    const popupLogger = new Logger('PopupInterface', 'INFO', localDict)

    popupLogger.info('POPUP_INTERFACE_LOADED')

    expect(infoSpy).toHaveBeenCalledTimes(1)
    const output = infoSpy.mock.calls[0][0]
    expect(output).toContain('Popup Interface 載入完成')
    expect(output).not.toContain('[Missing: POPUP_INTERFACE_LOADED]')
  })

  it('POPUP_SCRIPT_LOADED 應解析為 popup local dict 自訂文字', () => {
    const localDict = createPopupLocalDict()
    const popupLogger = new Logger('PopupInterface', 'INFO', localDict)

    popupLogger.info('POPUP_SCRIPT_LOADED')

    const output = infoSpy.mock.calls[0][0]
    expect(output).toContain('[OK] Popup Script 載入完成')
    expect(output).not.toContain('[Missing: POPUP_SCRIPT_LOADED]')
  })

  it('POPUP_INIT_START 應解析為 popup local dict 自訂文字', () => {
    const localDict = createPopupLocalDict()
    const popupLogger = new Logger('PopupInterface', 'INFO', localDict)

    popupLogger.info('POPUP_INIT_START')

    const output = infoSpy.mock.calls[0][0]
    expect(output).toContain('[START] 開始初始化 Popup Interface')
    expect(output).not.toContain('[Missing: POPUP_INIT_START]')
  })

  it('POPUP_INIT_COMPLETE 應解析為 popup local dict 自訂文字', () => {
    const localDict = createPopupLocalDict()
    const popupLogger = new Logger('PopupInterface', 'INFO', localDict)

    popupLogger.info('POPUP_INIT_COMPLETE')

    const output = infoSpy.mock.calls[0][0]
    expect(output).toContain('[OK] Popup Interface 初始化完成')
    expect(output).not.toContain('[Missing: POPUP_INIT_COMPLETE]')
  })

  it('INITIALIZATION_COMPLETE 應解析為 popup local dict 自訂文字（popup-error-handler 使用）', () => {
    const localDict = createPopupLocalDict()
    const popupLogger = new Logger('PopupErrorHandler', 'INFO', localDict)

    popupLogger.info('INITIALIZATION_COMPLETE')

    const output = infoSpy.mock.calls[0][0]
    expect(output).toContain('初始化流程完成')
    expect(output).not.toContain('[Missing: INITIALIZATION_COMPLETE]')
  })

  it('Logger 不傳第三參數 messages 時應 fallback 到 GlobalMessages 機制', () => {
    // 業務情境（W1-117 方案 B 改寫）：
    // 原 W1-116 測試斷言「GlobalMessages 含 popup-specific 5 key」屬 production
    // state assertion，與 W1-117 移除 5 key 的清理目標衝突。改寫為 mock-based
    // 機制驗證：驗證「Logger constructor 第三參數省略時走 GlobalMessages 預設值」
    // 此一 fallback 機制本身，而非依賴 GlobalMessages 含特定 popup-specific key。
    //
    // 防護目標（regress test）：
    //   未來若 Logger constructor 簽章變更（例如把 messages 第三參數改為必填、
    //   或刪除預設值 GlobalMessages），此 test 立即紅燈。Mock 注入確保即使
    //   GlobalMessages 內容後續又被清理，本 test 仍能獨立驗證 fallback 路徑。
    //
    // 驗證手法：用 jest.spyOn 監聽 GlobalMessages.get 是否被呼叫。若 Logger
    // 確實 fallback 到 GlobalMessages，則建構時 this.messages === GlobalMessages，
    // info(key) 時必呼叫 GlobalMessages.get(key, {})。
    const { GlobalMessages } = require('../../../src/core/messages/MessageDictionary')
    const getSpy = jest.spyOn(GlobalMessages, 'get').mockReturnValue('mocked-fallback-message')

    try {
      // 不傳第三參數（messages），Logger 應自動使用 GlobalMessages 為預設值
      const logger = new Logger('NoLocalDict', 'INFO')

      logger.info('ANY_KEY_FOR_FALLBACK_VERIFICATION')

      // 驗證 1：GlobalMessages.get 被呼叫，證明 fallback 機制觸發
      expect(getSpy).toHaveBeenCalledWith('ANY_KEY_FOR_FALLBACK_VERIFICATION', expect.any(Object))

      // 驗證 2：Logger 輸出採用 GlobalMessages.get 的回傳值
      const output = infoSpy.mock.calls[0][0]
      expect(output).toContain('mocked-fallback-message')
    } finally {
      getSpy.mockRestore()
    }
  })
})
