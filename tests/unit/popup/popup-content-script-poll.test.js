/**
 * Popup Content Script 就緒輪詢測試
 *
 * 驗證 checkCurrentTab() PING 失敗時啟動輪詢，於 content script 就緒後
 * 自動將狀態從「載入中」轉為「就緒」，無需手動關閉再開 popup。
 *
 * Ticket: 1.5.0-W5-027
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

function mockBookstoreTab () {
  chrome.tabs.query.mockImplementation((queryInfo, callback) => {
    const tabs = [{ id: 1, url: 'https://readmoo.com/library', active: true }]
    if (callback) callback(tabs)
    return Promise.resolve(tabs)
  })
}

describe('Popup Content Script 就緒輪詢 (1.5.0-W5-027)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    global.chrome = createCompleteChromeAPIMock()
    setupPopupDom()
    mockBookstoreTab()

    jest.isolateModules(() => {
      require('src/popup/popup')
    })
  })

  afterEach(() => {
    window.stopContentScriptPolling()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  test('CONTENT_SCRIPT_POLL_CONFIG 常數值正確', () => {
    const config = window.CONTENT_SCRIPT_POLL_CONFIG

    expect(config).toBeDefined()
    expect(config.INTERVAL_MS).toBe(1500)
    expect(config.MAX_RETRIES).toBe(10)
  })

  test('PING 失敗時啟動輪詢，狀態顯示載入中', async () => {
    chrome.tabs.sendMessage.mockRejectedValue(new Error('Could not establish connection'))

    await window.checkCurrentTab()

    expect(document.getElementById('extensionStatus').textContent).toContain('載入中')
    expect(window.isContentScriptPolling()).toBe(true)
  })

  test('輪詢期間 content script 就緒後，狀態自動從載入中轉為就緒', async () => {
    // 注意：periodicStatusUpdate 每 3000ms 也會呼叫 checkCurrentTab()，
    // 故本測試在 t=3000ms 邊界前（1500ms 內）完成成功轉換，避免與其交錯影響 mock 呼叫序。
    chrome.tabs.sendMessage
      .mockRejectedValueOnce(new Error('Could not establish connection'))
      .mockResolvedValueOnce({ success: true, bookCount: 5 })

    await window.checkCurrentTab()
    expect(document.getElementById('extensionStatus').textContent).toContain('載入中')
    expect(window.isContentScriptPolling()).toBe(true)

    // 第 1 次輪詢即成功
    jest.advanceTimersByTime(1500)
    await Promise.resolve()

    expect(document.getElementById('extensionStatus').textContent).toContain('就緒')
    expect(document.getElementById('bookCount').textContent).toBe('5')
    expect(window.isContentScriptPolling()).toBe(false)
  })

  test('達最大重試次數後停止輪詢', async () => {
    chrome.tabs.sendMessage.mockRejectedValue(new Error('Could not establish connection'))

    await window.checkCurrentTab()
    expect(window.isContentScriptPolling()).toBe(true)

    for (let i = 0; i < window.CONTENT_SCRIPT_POLL_CONFIG.MAX_RETRIES; i++) {
      jest.advanceTimersByTime(1500)
      await Promise.resolve()
    }

    expect(window.getContentScriptPollAttempts()).toBe(0)
    expect(window.isContentScriptPolling()).toBe(false)
  })

  test('重複呼叫 checkCurrentTab 不會建立多個輪詢計時器', async () => {
    chrome.tabs.sendMessage.mockRejectedValue(new Error('Could not establish connection'))

    await window.checkCurrentTab()
    await window.checkCurrentTab()

    const attemptsBefore = window.getContentScriptPollAttempts()
    jest.advanceTimersByTime(1500)
    await Promise.resolve()

    // 若有重複計時器，單次推進會使 attempts 增加超過 1
    expect(window.getContentScriptPollAttempts()).toBe(attemptsBefore + 1)
  })

  test('popup 關閉（unload）時清除輪詢計時器', async () => {
    chrome.tabs.sendMessage.mockRejectedValue(new Error('Could not establish connection'))

    await window.checkCurrentTab()
    expect(window.isContentScriptPolling()).toBe(true)

    window.dispatchEvent(new Event('unload'))

    expect(window.isContentScriptPolling()).toBe(false)
  })
})
