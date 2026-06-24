/**
 * popup PING bookCount 更新測試
 *
 * 驗證 checkCurrentTab 收到 PING 回應後正確更新 bookCount 顯示。
 *
 * Ticket: 1.4.2-W1-003
 *
 * @jest-environment jsdom
 */

const { createCompleteChromeAPIMock } = require('@tests/mocks/chrome-mock-factory')

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

describe('popup PING bookCount 更新 (1.4.2-W1-003)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    global.chrome = createCompleteChromeAPIMock()
    setupPopupDom()

    jest.isolateModules(() => {
      require('src/popup/popup')
    })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  test('PING 回應含 bookCount 時應更新為實際數字', async () => {
    chrome.tabs.query.mockImplementation((queryInfo, callback) => {
      const tabs = [{ id: 1, url: 'https://readmoo.com/library', active: true }]
      if (callback) callback(tabs)
      return Promise.resolve(tabs)
    })
    chrome.tabs.sendMessage.mockImplementation((tabId, message) => {
      if (message && message.type === 'PING') {
        return Promise.resolve({ success: true, bookCount: 42 })
      }
      return Promise.resolve({ success: false })
    })

    await window.checkCurrentTab()

    expect(document.getElementById('bookCount').textContent).toBe('42')
  })

  test('PING 回應 bookCount=0 時應顯示 0 而非檢測中', async () => {
    chrome.tabs.query.mockImplementation((queryInfo, callback) => {
      const tabs = [{ id: 1, url: 'https://readmoo.com/library', active: true }]
      if (callback) callback(tabs)
      return Promise.resolve(tabs)
    })
    chrome.tabs.sendMessage.mockImplementation((tabId, message) => {
      if (message && message.type === 'PING') {
        return Promise.resolve({ success: true, bookCount: 0 })
      }
      return Promise.resolve({ success: false })
    })

    await window.checkCurrentTab()

    expect(document.getElementById('bookCount').textContent).toBe('0')
  })

  test('PING 回應無 bookCount 欄位時應顯示 0', async () => {
    chrome.tabs.query.mockImplementation((queryInfo, callback) => {
      const tabs = [{ id: 1, url: 'https://readmoo.com/library', active: true }]
      if (callback) callback(tabs)
      return Promise.resolve(tabs)
    })
    chrome.tabs.sendMessage.mockImplementation((tabId, message) => {
      if (message && message.type === 'PING') {
        return Promise.resolve({ success: true })
      }
      return Promise.resolve({ success: false })
    })

    await window.checkCurrentTab()

    expect(document.getElementById('bookCount').textContent).toBe('0')
  })
})
