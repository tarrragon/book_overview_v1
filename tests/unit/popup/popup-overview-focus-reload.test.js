/**
 * popup openLibraryOverview 聚焦既有頁並刷新測試
 *
 * 驗證點「開啟書庫總覽頁面」時：
 * - 既有 overview.html tab 存在：聚焦該 tab（tabs.update active）、
 *   聚焦其視窗（windows.update focused）、刷新內容（tabs.reload）
 * - 無既有 overview tab：開新 tab（tabs.create）
 * - chrome API 失敗：保留 try/catch 錯誤處理（Logger.error + alert）
 *
 * Ticket: 1.4.2-W2-007
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

const OVERVIEW_PATH = 'src/overview/overview.html'
const OVERVIEW_URL = `chrome-extension://test-extension-id/${OVERVIEW_PATH}`

describe('popup openLibraryOverview 聚焦既有頁並刷新 (1.4.2-W2-007)', () => {
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

  test('既有 overview tab 存在時：聚焦 tab + 聚焦視窗 + 刷新，且不開新 tab', async () => {
    const existingTab = { id: 7, windowId: 3, url: OVERVIEW_URL, active: false }
    chrome.tabs.query.mockImplementation((queryInfo, callback) => {
      if (callback) callback([existingTab])
      return Promise.resolve([existingTab])
    })

    await window.openLibraryOverview()

    expect(chrome.tabs.update).toHaveBeenCalledWith(existingTab.id, { active: true })
    expect(chrome.windows.update).toHaveBeenCalledWith(existingTab.windowId, { focused: true })
    expect(chrome.tabs.reload).toHaveBeenCalledWith(existingTab.id)
    expect(chrome.tabs.create).not.toHaveBeenCalled()
  })

  test('既有 overview tab 帶 hash 路由時仍可命中（startsWith 比對）', async () => {
    const hashedTab = { id: 9, windowId: 1, url: `${OVERVIEW_URL}#/library`, active: false }
    chrome.tabs.query.mockImplementation((queryInfo, callback) => {
      if (callback) callback([hashedTab])
      return Promise.resolve([hashedTab])
    })

    await window.openLibraryOverview()

    expect(chrome.tabs.update).toHaveBeenCalledWith(hashedTab.id, { active: true })
    expect(chrome.tabs.reload).toHaveBeenCalledWith(hashedTab.id)
    expect(chrome.tabs.create).not.toHaveBeenCalled()
  })

  test('無既有 overview tab 時：開新 tab，且不呼叫 update/reload', async () => {
    chrome.tabs.query.mockImplementation((queryInfo, callback) => {
      if (callback) callback([])
      return Promise.resolve([])
    })

    await window.openLibraryOverview()

    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: OVERVIEW_URL })
    expect(chrome.tabs.update).not.toHaveBeenCalled()
    expect(chrome.tabs.reload).not.toHaveBeenCalled()
    expect(chrome.windows.update).not.toHaveBeenCalled()
  })

  test('query 過濾掉非 overview 的 tab（只比對 overview.html URL）', async () => {
    const unrelatedTab = { id: 2, windowId: 1, url: 'https://readmoo.com/library', active: true }
    chrome.tabs.query.mockImplementation((queryInfo, callback) => {
      if (callback) callback([unrelatedTab])
      return Promise.resolve([unrelatedTab])
    })

    await window.openLibraryOverview()

    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: OVERVIEW_URL })
    expect(chrome.tabs.update).not.toHaveBeenCalled()
  })

  test('chrome API 失敗時：記錄錯誤並 alert，不拋出例外', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
    chrome.tabs.query.mockImplementation(() => Promise.reject(new Error('tabs query failed')))

    await expect(window.openLibraryOverview()).resolves.toBeUndefined()
    expect(alertSpy).toHaveBeenCalled()
  })
})
