/**
 * Popup 提取完成監聽器單元測試
 *
 * 業務情境：
 * - W1-001.2 實機驗證發現 928 本提取成功後 popup 仍顯示「檢測中...」
 * - UC-01 step 6 規格要求「Popup 顯示提取結果：成功提取 X 本書籍」
 * - W1-062 修復：popup 註冊 chrome.storage.onChanged 監聽器，偵測 readmoo_books
 *   key 變更後更新 UI 顯示「提取成功 N 本書籍」
 *
 * 測試範疇：
 * - setupExtractionCompletionListener 函式註冊與卸載監聽器行為
 * - storage 變更時依 newValue.books.length 更新 status 文字與 bookCount
 * - 失敗 / 邊界情境（newValue 缺失、非 local area、其他 key 變更）不誤觸發
 */

const { createCompleteChromeAPIMock } = require('@tests/mocks/chrome-mock-factory')

/**
 * 建立 popup DOM 骨架，反映 popup.html 中與本測試相關的元素。
 *
 * @returns {void}
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

describe('Popup 提取完成監聽器 (W1-062)', () => {
  beforeEach(() => {
    // popup.js 內 const elements 在模組載入時 capture DOM 元素參考，
    // 必須在「重新 require popup.js」之前先建立 DOM，才能讓函式對應到本 test 的元素
    global.chrome = createCompleteChromeAPIMock()
    setupPopupDom()

    // 重新隔離載入 popup.js，使其函式 capture 當前 DOM 與 chrome mock
    jest.isolateModules(() => {
      require('src/popup/popup')
    })
  })

  test('提取完成事件應顯示「提取成功 N 本書籍」並更新 bookCount', () => {
    // Arrange：取得函式 + 模擬 storage 變更事件 payload
    const setupListener = window.setupExtractionCompletionListener
    expect(typeof setupListener).toBe('function')

    // Act：註冊監聽器
    setupListener()
    expect(chrome.storage.onChanged.addListener).toHaveBeenCalledTimes(1)

    // 模擬 background 寫入 928 本書籍後觸發 storage 變更事件
    const fakeBooks = new Array(928).fill(0).map((_, i) => ({ id: `book-${i}` }))
    chrome.storage.onChanged._trigger(
      {
        readmoo_books: {
          newValue: { books: fakeBooks, extractionTimestamp: Date.now() }
        }
      },
      'local'
    )

    // Assert：status 與 bookCount 顯示提取成功訊息
    expect(document.getElementById('statusText').textContent).toBe('提取成功')
    expect(document.getElementById('statusInfo').textContent).toBe('提取成功 928 本書籍')
    expect(document.getElementById('extensionStatus').textContent).toBe('完成')
    expect(document.getElementById('bookCount').textContent).toBe('928')

    // Assert：監聽器自我移除以避免重複觸發
    expect(chrome.storage.onChanged.removeListener).toHaveBeenCalledTimes(1)
  })

  test('其他 storage key 變更不應誤觸發成功訊息', () => {
    const setupListener = window.setupExtractionCompletionListener
    setupListener()

    chrome.storage.onChanged._trigger(
      {
        some_other_key: { newValue: { foo: 'bar' } }
      },
      'local'
    )

    // 預設 DOM bookCount 文字不應被覆寫
    expect(document.getElementById('bookCount').textContent).toBe('檢測中...')
    expect(document.getElementById('statusText').textContent).toBe('')
    expect(chrome.storage.onChanged.removeListener).not.toHaveBeenCalled()
  })

  test('非 local 區域的 storage 變更不應觸發成功訊息', () => {
    const setupListener = window.setupExtractionCompletionListener
    setupListener()

    const fakeBooks = [{ id: 'sync-book' }]
    chrome.storage.onChanged._trigger(
      { readmoo_books: { newValue: { books: fakeBooks } } },
      'sync'
    )

    expect(document.getElementById('bookCount').textContent).toBe('檢測中...')
    expect(chrome.storage.onChanged.removeListener).not.toHaveBeenCalled()
  })

  test('newValue 缺失（資料移除事件）不應誤觸發', () => {
    const setupListener = window.setupExtractionCompletionListener
    setupListener()

    chrome.storage.onChanged._trigger(
      { readmoo_books: { oldValue: { books: [{ id: 'old' }] } } },
      'local'
    )

    expect(document.getElementById('bookCount').textContent).toBe('檢測中...')
    expect(chrome.storage.onChanged.removeListener).not.toHaveBeenCalled()
  })

  test('newValue.books 不是陣列時不應更新 UI（防禦資料異常）', () => {
    const setupListener = window.setupExtractionCompletionListener
    setupListener()

    chrome.storage.onChanged._trigger(
      { readmoo_books: { newValue: { books: 'invalid' } } },
      'local'
    )

    expect(document.getElementById('bookCount').textContent).toBe('檢測中...')
    expect(chrome.storage.onChanged.removeListener).not.toHaveBeenCalled()
  })

  test('chrome.storage 不存在時不應拋出例外（防禦不完整環境）', () => {
    const setupListener = window.setupExtractionCompletionListener

    const originalStorage = chrome.storage
    delete chrome.storage

    expect(() => setupListener()).not.toThrow()

    chrome.storage = originalStorage
  })

  test('空 books 陣列應顯示「提取成功 0 本書籍」（邊界值）', () => {
    const setupListener = window.setupExtractionCompletionListener
    setupListener()

    chrome.storage.onChanged._trigger(
      { readmoo_books: { newValue: { books: [] } } },
      'local'
    )

    expect(document.getElementById('statusInfo').textContent).toBe('提取成功 0 本書籍')
    expect(document.getElementById('bookCount').textContent).toBe('0')
    expect(chrome.storage.onChanged.removeListener).toHaveBeenCalledTimes(1)
  })
})
