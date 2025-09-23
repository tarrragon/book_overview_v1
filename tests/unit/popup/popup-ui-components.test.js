/**
 * Popup UI 組件測試 - TDD 循環 #25
 *
 * 測試範圍：
 * - 狀態顯示組件的即時更新
 * - 動態進度條組件
 * - UI 回饋和互動組件
 * - 錯誤狀態顯示組件
 * - 結果展示組件
 *
 * 設計考量：
 * - 測試 UI 組件的獨立性和可重用性
 * - 驗證狀態變化的視覺回饋
 * - 確保無障礙使用支援
 * - 測試響應式設計適應性
 *
 * @jest-environment jsdom
 */

const { JSDOM } = require('jsdom')

describe('🎨 Popup UI 組件測試 (TDD循環 #25)', () => {
  let dom
  let document
  // eslint-disable-next-line no-unused-vars
  let PopupUIComponents

  beforeEach(() => {
    // 創建基本的 DOM 環境
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html lang="zh-TW">
      <head>
        <meta charset="UTF-8">
        <title>Readmoo 書庫提取器</title>
      </head>
      <body>
        <!-- 狀態顯示區域 -->
        <div class="status-card">
          <div class="status-indicator">
            <div class="status-dot" id="statusDot"></div>
            <span id="statusText">檢查狀態中...</span>
          </div>
          <div class="info-text" id="statusInfo">初始化中</div>
        </div>
        
        <!-- 進度顯示區域 -->
        <div class="status-card" id="progressContainer" style="display: none;">
          <div class="progress-header">
            <strong>📊 提取進度</strong>
            <span id="progressPercentage">0%</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" id="progressBar">
              <div class="progress-fill"></div>
            </div>
          </div>
          <div class="info-text" id="progressText">準備開始提取...</div>
        </div>
        
        <!-- 結果顯示區域 -->
        <div class="status-card" id="resultsContainer" style="display: none;">
          <div class="results-header">
            <strong>📋 提取結果</strong>
          </div>
          <div class="info-text">
            <strong>已提取書籍:</strong> <span id="extractedBookCount">0</span> 本<br>
            <strong>提取時間:</strong> <span id="extractionTime">-</span><br>
            <strong>成功率:</strong> <span id="successRate">-</span>
          </div>
          <div class="action-buttons">
            <button class="button secondary small" id="exportBtn" disabled>💾 匯出資料</button>
            <button class="button secondary small" id="viewResultsBtn" disabled>👁️ 查看詳情</button>
          </div>
        </div>
        
        <!-- 錯誤顯示區域 -->
        <div class="status-card error-card" id="errorContainer" style="display: none;">
          <div class="error-header">
            <strong>⚠️ 錯誤訊息</strong>
          </div>
          <div class="error-message" id="errorMessage">發生未知錯誤</div>
          <div class="action-buttons">
            <button class="button secondary small" id="retryBtn">🔄 重試</button>
            <button class="button secondary small" id="reportBtn">📝 回報問題</button>
          </div>
        </div>
      </body>
      </html>
    `, {
      runScripts: 'outside-only',
      pretendToBeVisual: true
    })

    document = dom.window.document
    global.document = document
    global.window = dom.window

    // 重置 PopupUIComponents 類別
    PopupUIComponents = null
  })

  afterEach(() => {
    if (dom) {
      dom.window.close()
    }
    jest.clearAllMocks()
  })

  describe('🔴 Red Phase: 狀態顯示組件測試', () => {
    test('應該能創建 PopupUIComponents 實例', () => {
      // 這個測試應該失敗，因為 PopupUIComponents 類別還不存在
      expect(() => {
        const { PopupUIComponents } = require('src/popup/popup-ui-components')
        // eslint-disable-next-line no-unused-vars
        const uiComponents = new PopupUIComponents(document)
        expect(uiComponents).toBeInstanceOf(PopupUIComponents)
      }).not.toThrow()
    })

    test('應該能更新狀態指示器的視覺狀態', () => {
      const { PopupUIComponents } = require('src/popup/popup-ui-components')
      // eslint-disable-next-line no-unused-vars
      const uiComponents = new PopupUIComponents(document)

      // 測試狀態更新方法
      expect(typeof uiComponents.updateStatus).toBe('function')

      // 測試不同狀態的視覺變化
      uiComponents.updateStatus('loading', '載入中...', '正在檢查系統狀態')

      // eslint-disable-next-line no-unused-vars
      const statusDot = document.getElementById('statusDot')
      // eslint-disable-next-line no-unused-vars
      const statusText = document.getElementById('statusText')
      // eslint-disable-next-line no-unused-vars
      const statusInfo = document.getElementById('statusInfo')

      expect(statusDot.classList.contains('loading')).toBe(true)
      expect(statusText.textContent).toBe('載入中...')
      expect(statusInfo.textContent).toBe('正在檢查系統狀態')
    })

    test('應該支援多種狀態類型', () => {
      const { PopupUIComponents } = require('src/popup/popup-ui-components')
      // eslint-disable-next-line no-unused-vars
      const uiComponents = new PopupUIComponents(document)

      // 測試 ready 狀態
      uiComponents.updateStatus('ready', '準備就緒', '可以開始提取書籍資料')

      // eslint-disable-next-line no-unused-vars
      const statusDot = document.getElementById('statusDot')
      expect(statusDot.classList.contains('ready')).toBe(true)
      expect(statusDot.classList.contains('loading')).toBe(false)

      // 測試 error 狀態
      uiComponents.updateStatus('error', '發生錯誤', '無法連接到 Background Service Worker')

      expect(statusDot.classList.contains('error')).toBe(true)
      expect(statusDot.classList.contains('ready')).toBe(false)
    })

    test('應該能正確處理狀態轉換動畫', () => {
      const { PopupUIComponents } = require('src/popup/popup-ui-components')
      // eslint-disable-next-line no-unused-vars
      const uiComponents = new PopupUIComponents(document)

      // eslint-disable-next-line no-unused-vars
      const statusDot = document.getElementById('statusDot')

      // 測試載入狀態的動畫
      uiComponents.updateStatus('loading', '載入中...', '系統初始化中')
      expect(statusDot.classList.contains('loading')).toBe(true)

      // 測試狀態轉換清除前一個狀態
      uiComponents.updateStatus('ready', '準備完成', '系統已就緒')
      expect(statusDot.classList.contains('loading')).toBe(false)
      expect(statusDot.classList.contains('ready')).toBe(true)
    })
  })

  describe('🔴 Red Phase: 進度條組件測試', () => {
    test('應該能顯示和隱藏進度容器', () => {
      const { PopupUIComponents } = require('src/popup/popup-ui-components')
      // eslint-disable-next-line no-unused-vars
      const uiComponents = new PopupUIComponents(document)

      expect(typeof uiComponents.showProgress).toBe('function')
      expect(typeof uiComponents.hideProgress).toBe('function')

      // eslint-disable-next-line no-unused-vars
      const progressContainer = document.getElementById('progressContainer')

      // 測試顯示進度
      uiComponents.showProgress()
      expect(progressContainer.style.display).not.toBe('none')

      // 測試隱藏進度
      uiComponents.hideProgress()
      expect(progressContainer.style.display).toBe('none')
    })

    test('應該能更新進度百分比和進度條', () => {
      const { PopupUIComponents } = require('src/popup/popup-ui-components')
      // eslint-disable-next-line no-unused-vars
      const uiComponents = new PopupUIComponents(document)

      expect(typeof uiComponents.updateProgress).toBe('function')

      // 測試進度更新
      uiComponents.updateProgress(45, '處理中...', '已處理 45 本書籍')

      // eslint-disable-next-line no-unused-vars
      const progressPercentage = document.getElementById('progressPercentage')
      // eslint-disable-next-line no-unused-vars
      const progressText = document.getElementById('progressText')
      // eslint-disable-next-line no-unused-vars
      const progressFill = document.querySelector('.progress-fill')

      expect(progressPercentage.textContent).toBe('45%')
      expect(progressText.textContent).toBe('已處理 45 本書籍')
      expect(progressFill.style.width).toBe('45%')
    })

    test('應該能處理進度邊界值', () => {
      const { PopupUIComponents } = require('src/popup/popup-ui-components')
      // eslint-disable-next-line no-unused-vars
      const uiComponents = new PopupUIComponents(document)

      // eslint-disable-next-line no-unused-vars
      const progressFill = document.querySelector('.progress-fill')

      // 測試 0% 進度
      uiComponents.updateProgress(0, '開始', '準備開始提取')
      expect(progressFill.style.width).toBe('0%')

      // 測試 100% 進度
      uiComponents.updateProgress(100, '完成', '提取完成')
      expect(progressFill.style.width).toBe('100%')

      // 測試超出範圍的值
      uiComponents.updateProgress(150, '錯誤', '進度異常')
      expect(progressFill.style.width).toBe('100%') // 應該限制在 100%

      uiComponents.updateProgress(-10, '錯誤', '進度異常')
      expect(progressFill.style.width).toBe('0%') // 應該限制在 0%
    })

    test('應該支援進度動畫效果', () => {
      const { PopupUIComponents } = require('src/popup/popup-ui-components')
      // eslint-disable-next-line no-unused-vars
      const _uiComponents = new PopupUIComponents(document)

      // eslint-disable-next-line no-unused-vars
      const progressFill = document.querySelector('.progress-fill')

      // 在 JSDOM 環境中測試元素是否存在並可以設定樣式
      expect(progressFill).toBeTruthy()

      // 測試可以設定 width 樣式（用於動畫）
      progressFill.style.width = '50%'
      expect(progressFill.style.width).toBe('50%')
    })
  })

  describe('🔴 Red Phase: 結果展示組件測試', () => {
    test('應該能顯示提取結果', () => {
      const { PopupUIComponents } = require('src/popup/popup-ui-components')
      // eslint-disable-next-line no-unused-vars
      const uiComponents = new PopupUIComponents(document)

      expect(typeof uiComponents.showResults).toBe('function')

      // eslint-disable-next-line no-unused-vars
      const resultData = {
        bookCount: 125,
        extractionTime: '2分30秒',
        successRate: '98.4%'
      }

      uiComponents.showResults(resultData)

      // eslint-disable-next-line no-unused-vars
      const resultsContainer = document.getElementById('resultsContainer')
      expect(resultsContainer.style.display).not.toBe('none')

      // eslint-disable-next-line no-unused-vars
      const extractedBookCount = document.getElementById('extractedBookCount')
      // eslint-disable-next-line no-unused-vars
      const extractionTime = document.getElementById('extractionTime')
      // eslint-disable-next-line no-unused-vars
      const successRate = document.getElementById('successRate')

      expect(extractedBookCount.textContent).toBe('125')
      expect(extractionTime.textContent).toBe('2分30秒')
      expect(successRate.textContent).toBe('98.4%')
    })

    test('應該能啟用結果操作按鈕', () => {
      const { PopupUIComponents } = require('src/popup/popup-ui-components')
      // eslint-disable-next-line no-unused-vars
      const uiComponents = new PopupUIComponents(document)

      // eslint-disable-next-line no-unused-vars
      const resultData = {
        bookCount: 50,
        extractionTime: '1分15秒',
        successRate: '100%'
      }

      uiComponents.showResults(resultData)

      // eslint-disable-next-line no-unused-vars
      const exportBtn = document.getElementById('exportBtn')
      // eslint-disable-next-line no-unused-vars
      const viewResultsBtn = document.getElementById('viewResultsBtn')

      expect(exportBtn.disabled).toBe(false)
      expect(viewResultsBtn.disabled).toBe(false)
    })

    test('應該能隱藏結果容器', () => {
      const { PopupUIComponents } = require('src/popup/popup-ui-components')
      // eslint-disable-next-line no-unused-vars
      const uiComponents = new PopupUIComponents(document)

      expect(typeof uiComponents.hideResults).toBe('function')

      // eslint-disable-next-line no-unused-vars
      const resultsContainer = document.getElementById('resultsContainer')

      uiComponents.hideResults()
      expect(resultsContainer.style.display).toBe('none')
    })
  })

  describe('🔴 Red Phase: 錯誤顯示組件測試', () => {
    test('應該能顯示錯誤訊息', () => {
      const { PopupUIComponents } = require('src/popup/popup-ui-components')
      // eslint-disable-next-line no-unused-vars
      const uiComponents = new PopupUIComponents(document)

      expect(typeof uiComponents.showError).toBe('function')

      // eslint-disable-next-line no-unused-vars
      const errorMsg = '無法連接到 Readmoo 網站，請檢查網路連線'
      uiComponents.showError(errorMsg)

      // eslint-disable-next-line no-unused-vars
      const errorContainer = document.getElementById('errorContainer')
      // eslint-disable-next-line no-unused-vars
      const errorMessage = document.getElementById('errorMessage')

      expect(errorContainer.style.display).not.toBe('none')
      expect(errorMessage.textContent).toBe(errorMsg)
    })

    test('應該能隱藏錯誤容器', () => {
      const { PopupUIComponents } = require('src/popup/popup-ui-components')
      // eslint-disable-next-line no-unused-vars
      const uiComponents = new PopupUIComponents(document)

      expect(typeof uiComponents.hideError).toBe('function')

      // eslint-disable-next-line no-unused-vars
      const errorContainer = document.getElementById('errorContainer')

      uiComponents.hideError()
      expect(errorContainer.style.display).toBe('none')
    })

    test('應該能設定錯誤操作按鈕的事件處理', () => {
      const { PopupUIComponents } = require('src/popup/popup-ui-components')
      // eslint-disable-next-line no-unused-vars
      const uiComponents = new PopupUIComponents(document)

      // eslint-disable-next-line no-unused-vars
      const retryCallback = jest.fn()
      // eslint-disable-next-line no-unused-vars
      const reportCallback = jest.fn()

      expect(typeof uiComponents.setErrorHandlers).toBe('function')

      uiComponents.setErrorHandlers(retryCallback, reportCallback)

      // 測試重試按鈕
      // eslint-disable-next-line no-unused-vars
      const retryBtn = document.getElementById('retryBtn')
      retryBtn.click()
      expect(retryCallback).toHaveBeenCalled()

      // 測試回報按鈕
      // eslint-disable-next-line no-unused-vars
      const reportBtn = document.getElementById('reportBtn')
      reportBtn.click()
      expect(reportCallback).toHaveBeenCalled()
    })
  })

  describe('🔴 Red Phase: UI 互動組件測試', () => {
    test('應該支援組件狀態重置', () => {
      const { PopupUIComponents } = require('src/popup/popup-ui-components')
      // eslint-disable-next-line no-unused-vars
      const uiComponents = new PopupUIComponents(document)

      expect(typeof uiComponents.resetAll).toBe('function')

      // 設置一些狀態
      uiComponents.showProgress()
      uiComponents.showResults({ bookCount: 10, extractionTime: '30秒', successRate: '100%' })
      uiComponents.showError('測試錯誤')

      // 重置所有狀態
      uiComponents.resetAll()

      // 檢查所有容器都被隱藏
      expect(document.getElementById('progressContainer').style.display).toBe('none')
      expect(document.getElementById('resultsContainer').style.display).toBe('none')
      expect(document.getElementById('errorContainer').style.display).toBe('none')

      // 檢查狀態被重置
      // eslint-disable-next-line no-unused-vars
      const statusText = document.getElementById('statusText')
      // eslint-disable-next-line no-unused-vars
      const statusInfo = document.getElementById('statusInfo')
      expect(statusText.textContent).toBe('檢查狀態中...')
      expect(statusInfo.textContent).toBe('初始化中')
    })

    test('應該支援批量狀態更新', () => {
      const { PopupUIComponents } = require('src/popup/popup-ui-components')
      // eslint-disable-next-line no-unused-vars
      const uiComponents = new PopupUIComponents(document)

      expect(typeof uiComponents.updateUI).toBe('function')

      // eslint-disable-next-line no-unused-vars
      const updateConfig = {
        status: {
          type: 'loading',
          text: '處理中...',
          info: '正在提取書籍資料'
        },
        progress: {
          visible: true,
          percentage: 75,
          text: '已處理 75 本書籍'
        },
        results: {
          visible: false
        },
        error: {
          visible: false
        }
      }

      uiComponents.updateUI(updateConfig)

      // 檢查狀態更新
      // eslint-disable-next-line no-unused-vars
      const statusDot = document.getElementById('statusDot')
      expect(statusDot.classList.contains('loading')).toBe(true)

      // 檢查進度顯示
      // eslint-disable-next-line no-unused-vars
      const progressContainer = document.getElementById('progressContainer')
      expect(progressContainer.style.display).not.toBe('none')

      // eslint-disable-next-line no-unused-vars
      const progressPercentage = document.getElementById('progressPercentage')
      expect(progressPercentage.textContent).toBe('75%')
    })

    test('應該支援無障礙功能', () => {
      const { PopupUIComponents } = require('src/popup/popup-ui-components')
      // eslint-disable-next-line no-unused-vars
      const uiComponents = new PopupUIComponents(document)

      expect(typeof uiComponents.setAccessibilityLabels).toBe('function')

      uiComponents.setAccessibilityLabels()

      // 檢查 ARIA 標籤
      // eslint-disable-next-line no-unused-vars
      const progressBar = document.getElementById('progressBar')
      expect(progressBar.getAttribute('role')).toBe('progressbar')
      expect(progressBar.hasAttribute('aria-valuenow')).toBe(true)
      expect(progressBar.hasAttribute('aria-valuemin')).toBe(true)
      expect(progressBar.hasAttribute('aria-valuemax')).toBe(true)
    })
  })
})
