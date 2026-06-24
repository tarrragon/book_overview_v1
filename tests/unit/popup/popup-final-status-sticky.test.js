/**
 * Popup 終態 sticky 機制單元測試（W1-062.1）
 *
 * 業務情境：
 * - W1-062 修復 storage onChanged 後正確顯示「提取成功 N 本書籍」終態
 * - W1-062 實機驗證發現 popup.js:1363 setInterval(periodicStatusUpdate, 3000)
 *   每 3 秒呼叫 checkCurrentTab() 將 status 覆寫回「就緒/已連線到書庫頁面」，
 *   使終態僅顯示不到 3 秒
 *
 * 測試範疇：
 * - isFinalStatus 旗標的設置（提取成功、提取失敗、sync 回應成功）
 * - isFinalStatus 旗標的重置（用戶再次點擊「開始提取」）
 * - periodicStatusUpdate 在終態時跳過 checkCurrentTab（不覆寫 status）
 * - periodicStatusUpdate 在非終態時正常呼叫 checkCurrentTab
 * - periodicStatusUpdate 在終態時仍執行 chrome.tabs.query 健康探測
 */

const { createCompleteChromeAPIMock } = require('@tests/mocks/chrome-mock-factory')

/**
 * 建立 popup DOM 骨架，反映 popup.html 中與本測試相關的元素。
 */
function setupPopupDom () {
  document.body.innerHTML = `
    <div>
      <span class="status-dot" id="statusDot"></span>
      <span id="statusText"></span>
      <span id="statusInfo"></span>
      <span id="extensionStatus"></span>
      <button id="extractBtn"></button>
      <button id="settingsBtn"></button>
      <button id="helpBtn"></button>
      <button id="viewLibraryBtn"></button>
      <span id="pageInfo"></span>
      <span id="bookCount">檢測中...</span>
      <div id="progressContainer"></div>
      <div id="progressBar"></div>
      <span id="progressText"></span>
      <span id="progressPercentage"></span>
      <div id="resultsContainer"></div>
      <span id="extractedBookCount"></span>
      <span id="extractionTime"></span>
      <span id="successRate"></span>
      <button id="exportBtn"></button>
      <button id="viewResultsBtn"></button>
      <div id="errorContainer"></div>
      <span id="errorMessage"></span>
      <button id="retryBtn"></button>
      <button id="reportBtn"></button>
      <button id="initReportBtn"></button>
      <button id="systemHealthCheckBtn"></button>
      <span id="versionDisplay"></span>
    </div>
  `
}

describe('Popup 終態 sticky 機制 (W1-062.1)', () => {
  beforeEach(() => {
    global.chrome = createCompleteChromeAPIMock()
    setupPopupDom()

    jest.isolateModules(() => {
      require('src/popup/popup')
    })
  })

  describe('isFinalStatus 旗標 API', () => {
    test('popup 載入時旗標應為 false（初始 polling 模式）', () => {
      expect(typeof window.getIsFinalStatus).toBe('function')
      expect(window.getIsFinalStatus()).toBe(false)
    })

    test('提供 setIsFinalStatus(true/false) 控制旗標（供測試與 startExtraction 重置使用）', () => {
      expect(typeof window.setIsFinalStatus).toBe('function')

      window.setIsFinalStatus(true)
      expect(window.getIsFinalStatus()).toBe(true)

      window.setIsFinalStatus(false)
      expect(window.getIsFinalStatus()).toBe(false)
    })
  })

  describe('終態設置：提取成功透過 storage onChanged 觸發', () => {
    test('setupExtractionCompletionListener 收到 readmoo_books 變更後旗標應為 true', () => {
      window.setupExtractionCompletionListener()

      expect(window.getIsFinalStatus()).toBe(false)

      const fakeBooks = new Array(42).fill(0).map((_, i) => ({ id: `book-${i}` }))
      chrome.storage.onChanged._trigger(
        { readmoo_books: { newValue: { books: fakeBooks } } },
        'local'
      )

      expect(window.getIsFinalStatus()).toBe(true)
      expect(document.getElementById('statusInfo').textContent).toBe('提取成功 42 本書籍')
    })

    test('其他 storage key 變更不應將旗標設為 true（防誤判）', () => {
      window.setupExtractionCompletionListener()

      chrome.storage.onChanged._trigger(
        { some_other_key: { newValue: { foo: 'bar' } } },
        'local'
      )

      expect(window.getIsFinalStatus()).toBe(false)
    })
  })

  describe('終態保持：periodicStatusUpdate 不覆寫終態 status', () => {
    test('isFinalStatus=true 時呼叫 periodicStatusUpdate 不應呼叫 checkCurrentTab', async () => {
      // 先設定終態 + 預設終態 status 文字
      document.getElementById('statusText').textContent = '提取成功'
      document.getElementById('statusInfo').textContent = '提取成功 42 本書籍'
      document.getElementById('extensionStatus').textContent = '完成'
      window.setIsFinalStatus(true)

      // 重置 chrome.tabs.sendMessage spy 計數（checkCurrentTab 會呼叫它）
      chrome.tabs.sendMessage.mockClear()

      await window.periodicStatusUpdate()

      // checkCurrentTab 內部會 sendMessage 給 content script；終態時不應觸發
      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()

      // 終態 status 文字維持不變
      expect(document.getElementById('statusText').textContent).toBe('提取成功')
      expect(document.getElementById('statusInfo').textContent).toBe('提取成功 42 本書籍')
      expect(document.getElementById('extensionStatus').textContent).toBe('完成')
    })

    test('isFinalStatus=false 時 periodicStatusUpdate 應正常呼叫 checkCurrentTab', async () => {
      window.setIsFinalStatus(false)

      // 模擬 chrome.tabs.query 回傳 Readmoo 頁面
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        const tabs = [{ id: 1, url: 'https://readmoo.com/library', active: true }]
        if (callback) callback(tabs)
        return Promise.resolve(tabs)
      })
      // sendMessage 回傳 success
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        const response = { success: true, bookCount: 5 }
        if (callback) callback(response)
        return Promise.resolve(response)
      })

      await window.periodicStatusUpdate()

      expect(chrome.tabs.query).toHaveBeenCalled()
    })
  })

  describe('健康探測：終態仍執行 tabs.query 健康檢查', () => {
    test('isFinalStatus=true 時 periodicStatusUpdate 仍呼叫 chrome.tabs.query 健康探測', async () => {
      window.setIsFinalStatus(true)
      chrome.tabs.query.mockClear()

      // 確保函式可呼叫 query（不會因旗標完全跳過）
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        const tabs = [{ id: 1, url: 'https://readmoo.com/library', active: true }]
        if (callback) callback(tabs)
        return Promise.resolve(tabs)
      })

      await window.periodicStatusUpdate()

      // 終態時仍應執行一次 tabs.query（健康探測）
      expect(chrome.tabs.query).toHaveBeenCalledTimes(1)
    })

    test('periodicStatusUpdate 在頁面不可見時不應執行任何操作（既有行為）', async () => {
      // 模擬 document hidden
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true
      })

      window.setIsFinalStatus(true)
      chrome.tabs.query.mockClear()
      chrome.tabs.sendMessage.mockClear()

      await window.periodicStatusUpdate()

      expect(chrome.tabs.query).not.toHaveBeenCalled()
      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()

      // 還原
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true
      })
    })
  })

  describe('旗標重置：用戶再次點擊「開始提取」', () => {
    test('startExtraction 開頭應將 isFinalStatus 重置為 false（checkCurrentTab 返回 null 時）', async () => {
      // 先模擬終態
      window.setIsFinalStatus(true)
      expect(window.getIsFinalStatus()).toBe(true)

      // 模擬 chrome.tabs.query 回傳空 tabs，使 checkCurrentTab 返回 null（無 tab）
      // 此情境下 startExtraction 開頭已重置 isFinalStatus = false，
      // 然後因 tab=null 早期 return，不會進入後續 success/catch 分支
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        const tabs = []
        if (callback) callback(tabs)
        return Promise.resolve(tabs)
      })

      await window.startExtraction()

      // 旗標應被 startExtraction 開頭重置為 false
      expect(window.getIsFinalStatus()).toBe(false)
    })

    test('startExtraction 成功完成後 isFinalStatus 應為 true（終態 sticky）', async () => {
      window.setIsFinalStatus(false)

      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        const tabs = [{ id: 1, url: 'https://readmoo.com/library', active: true }]
        if (callback) callback(tabs)
        return Promise.resolve(tabs)
      })
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        const response = { success: true, message: '提取流程已啟動' }
        if (callback) callback(response)
        return Promise.resolve(response)
      })

      await window.startExtraction()

      // response.success 分支設定 isFinalStatus = true
      expect(window.getIsFinalStatus()).toBe(true)
    })

    test('startExtraction 失敗（catch 分支）後 isFinalStatus 應為 true（終態 sticky）', async () => {
      window.setIsFinalStatus(false)

      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        const tabs = [{ id: 1, url: 'https://readmoo.com/library', active: true }]
        if (callback) callback(tabs)
        return Promise.resolve(tabs)
      })
      chrome.tabs.sendMessage.mockImplementation((tabId, message) => {
        if (message && message.type === 'PING') {
          return Promise.resolve({ success: true, bookCount: 5 })
        }
        // START_EXTRACTION 拋例外觸發 catch
        return Promise.reject(new Error('Content Script 通訊失敗'))
      })

      await window.startExtraction()

      // catch 分支設定 isFinalStatus = true
      expect(window.getIsFinalStatus()).toBe(true)
    })
  })
})
