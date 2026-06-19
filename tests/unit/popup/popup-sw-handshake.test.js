/**
 * popup↔SW 握手重試 + initializing baseline 測試
 *
 * 驗證 popup checkBackgroundStatus 在 SW cold-start 場景下的
 * 重試機制與 initializing 過渡態處理。
 *
 * Ticket: 1.1.0-W1-019
 * TDD Phase: 2 (RED)
 *
 * @jest-environment jsdom
 */

const { createCompleteChromeAPIMock } = require('@tests/mocks/chrome-mock-factory')

/**
 * 建立 popup DOM 骨架
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

describe('popup↔SW 握手重試機制 (1.1.0-W1-019)', () => {
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

  // ─── AC1: SW 正常就緒 — 首次嘗試即成功，無重試 ───

  describe('AC1: SW 正常就緒 — 首次嘗試即成功', () => {
    test('SW 已就緒時，checkBackgroundStatus 回傳 true 且不觸發重試', async () => {
      // Given: SW 已完成初始化
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        isEnabled: true,
        serviceWorkerActive: true,
        initializing: false,
        mode: 'normal'
      })

      // When: popup 呼叫 checkBackgroundStatus
      const result = await window.checkBackgroundStatus()

      // Then: 回傳 true，sendMessage 只被呼叫一次（無重試）
      expect(result).toBe(true)
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1)
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_STATUS'
      })
    })

    test('SW 回傳 success 但無 initializing 欄位時，視為已就緒（向後相容）', async () => {
      // Given: SW 回應不含 initializing（現有 MessageRouter 格式）
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        isEnabled: true,
        serviceWorkerActive: true
      })

      // When
      const result = await window.checkBackgroundStatus()

      // Then: 視為正常就緒，不進入重試
      expect(result).toBe(true)
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1)
    })
  })

  // ─── AC2: SW init 中 — 收到 initializing baseline ───

  describe('AC2: SW init 中 — initializing baseline 處理', () => {
    test('SW 回傳 initializing:true 時，popup 進入重試而非立即成功', async () => {
      // Given: SW 正在初始化，重試 1 就緒
      chrome.runtime.sendMessage
        .mockResolvedValueOnce({
          success: true,
          isEnabled: true,
          serviceWorkerActive: true,
          initializing: true,
          mode: 'initializing'
        })
        .mockResolvedValueOnce({
          success: true,
          isEnabled: true,
          serviceWorkerActive: true,
          initializing: false,
          mode: 'normal'
        })

      // When
      const resultPromise = window.checkBackgroundStatus()

      // 推進重試延遲 1s + timeout window 2s
      jest.advanceTimersByTime(1000)
      await Promise.resolve() // flush microtasks
      jest.advanceTimersByTime(2000)
      await Promise.resolve()

      const result = await resultPromise

      // Then: 重試成功，sendMessage 被呼叫 2 次
      expect(result).toBe(true)
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2)
    })

    test('收到 initializing 回應後，popup 顯示「初始化中」過渡態', async () => {
      // Given: SW 回傳 initializing baseline，後續就緒
      chrome.runtime.sendMessage
        .mockResolvedValueOnce({
          success: true,
          initializing: true,
          mode: 'initializing'
        })
        .mockResolvedValueOnce({
          success: true,
          initializing: false,
          mode: 'normal'
        })

      // When
      const resultPromise = window.checkBackgroundStatus()

      // 等首次回應處理完畢（flush microtask 讓 initializing 回應被處理）
      await Promise.resolve()
      await Promise.resolve()

      // Then: 過渡態期間 statusText 應顯示「初始化中」
      const statusText = document.getElementById('statusText')
      expect(statusText.textContent).toContain('初始化中')

      // 清理：推進時間完成重試
      jest.advanceTimersByTime(3000)
      await resultPromise
    })
  })

  // ─── AC3: SW init 超過 2 秒後就緒 — 重試自動恢復 ───

  describe('AC3: SW cold-start > 2 秒 — 重試自動恢復', () => {
    test('首次 timeout 後重試第 1 次成功', async () => {
      // Given: SW cold-start > 2 秒，首次 timeout
      chrome.runtime.sendMessage
        .mockImplementationOnce(() => new Promise(() => {})) // 永不 resolve → timeout
        .mockResolvedValueOnce({
          success: true,
          initializing: false,
          mode: 'normal'
        })

      // When
      const resultPromise = window.checkBackgroundStatus()

      // 首次 2s timeout
      jest.advanceTimersByTime(2000)
      await Promise.resolve()
      // 重試延遲 1s
      jest.advanceTimersByTime(1000)
      await Promise.resolve()
      // 重試 timeout window 2s（但立即 resolve）
      jest.advanceTimersByTime(2000)
      await Promise.resolve()

      const result = await resultPromise

      // Then: 重試成功
      expect(result).toBe(true)
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2)
    })

    test('首次 timeout + 重試 1 仍 init + 重試 2 成功', async () => {
      // Given: SW cold-start ~5 秒
      chrome.runtime.sendMessage
        .mockImplementationOnce(() => new Promise(() => {})) // timeout
        .mockResolvedValueOnce({
          success: true,
          initializing: true,
          mode: 'initializing'
        })
        .mockResolvedValueOnce({
          success: true,
          initializing: false,
          mode: 'normal'
        })

      // When
      const resultPromise = window.checkBackgroundStatus()

      // 首次 2s timeout
      jest.advanceTimersByTime(2000)
      await Promise.resolve()
      // 重試 1 延遲 1s
      jest.advanceTimersByTime(1000)
      await Promise.resolve()
      // 重試 1 回應 initializing → 重試 2 延遲 2s
      jest.advanceTimersByTime(2000)
      await Promise.resolve()
      // 重試 2 回應 success
      jest.advanceTimersByTime(2000)
      await Promise.resolve()

      const result = await resultPromise

      // Then
      expect(result).toBe(true)
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(3)
    })

    test('重試成功後 popup 最終顯示「線上」', async () => {
      // Given: SW init 中，重試後就緒
      chrome.runtime.sendMessage
        .mockResolvedValueOnce({
          success: true,
          initializing: true,
          mode: 'initializing'
        })
        .mockResolvedValueOnce({
          success: true,
          initializing: false,
          mode: 'normal'
        })

      // When
      const resultPromise = window.checkBackgroundStatus()
      jest.advanceTimersByTime(3000)
      await Promise.resolve()
      const result = await resultPromise

      // Then: 最終狀態為「線上」
      expect(result).toBe(true)
      const statusText = document.getElementById('statusText')
      expect(statusText.textContent).toContain('線上')
    })
  })

  // ─── AC4: 3 次重試全部失敗後顯示離線 ───

  describe('AC4: 全部重試失敗 — 降級為離線', () => {
    test('SW 完全無回應，3 次重試 timeout 後回傳 false', async () => {
      // Given: SW 未載入，sendMessage 永不 resolve
      chrome.runtime.sendMessage.mockImplementation(() => new Promise(() => {}))

      // When
      const resultPromise = window.checkBackgroundStatus()

      // 推進全部重試時間: 2 + (1+2) + (2+2) + (4+2) = 15s
      jest.advanceTimersByTime(2000) // 首次 timeout
      await Promise.resolve()
      jest.advanceTimersByTime(3000) // 重試 1: 延遲 1s + timeout 2s
      await Promise.resolve()
      jest.advanceTimersByTime(4000) // 重試 2: 延遲 2s + timeout 2s
      await Promise.resolve()
      jest.advanceTimersByTime(6000) // 重試 3: 延遲 4s + timeout 2s
      await Promise.resolve()

      const result = await resultPromise

      // Then: 全部失敗
      expect(result).toBe(false)
      // 1 首次 + 3 重試 = 4 次 sendMessage
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(4)
    })

    test('SW 持續回 initializing 超過 3 次重試，降級為離線', async () => {
      // Given: SW 一直在初始化
      chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        initializing: true,
        mode: 'initializing'
      })

      // When
      const resultPromise = window.checkBackgroundStatus()

      // 首次立即回應 initializing → 重試 1 延遲 1s
      await Promise.resolve()
      jest.advanceTimersByTime(1000)
      await Promise.resolve()
      // 重試 1 立即回 initializing → 重試 2 延遲 2s
      jest.advanceTimersByTime(2000)
      await Promise.resolve()
      // 重試 2 立即回 initializing → 重試 3 延遲 4s
      jest.advanceTimersByTime(4000)
      await Promise.resolve()

      const result = await resultPromise

      // Then: 全部重試用盡
      expect(result).toBe(false)
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(4)
    })

    test('全部重試失敗後 popup 狀態顯示「離線」', async () => {
      // Given: SW 完全無回應
      chrome.runtime.sendMessage.mockImplementation(() => new Promise(() => {}))

      // When
      const resultPromise = window.checkBackgroundStatus()
      jest.advanceTimersByTime(15000)
      await Promise.resolve()
      await resultPromise

      // Then
      const statusText = document.getElementById('statusText')
      expect(statusText.textContent).toContain('離線')
    })
  })

  // ─── AC5: 重試延遲遵循指數退避 ───

  describe('AC5: 指數退避延遲驗證', () => {
    test('重試延遲依序為 1s、2s、4s', async () => {
      // Given: SW 持續不回應
      chrome.runtime.sendMessage.mockImplementation(() => new Promise(() => {}))

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout')

      // When
      const resultPromise = window.checkBackgroundStatus()

      // 首次 2s timeout
      jest.advanceTimersByTime(2000)
      await Promise.resolve()

      // 推進所有時間完成測試
      jest.advanceTimersByTime(13000)
      await Promise.resolve()
      await resultPromise

      // 驗證三個退避延遲被呼叫
      const delays = setTimeoutSpy.mock.calls
        .map(([, delay]) => delay)
        .filter(d => d === 1000 || d === 2000 || d === 4000)

      // 應包含 1000 (重試 1 延遲)、2000 (timeout + 重試 2 延遲)、4000 (重試 3 延遲)
      expect(delays).toContain(1000)
      expect(delays).toContain(4000)
    })
  })

  // ─── HANDSHAKE_CONFIG 常數驗證 ───

  describe('HANDSHAKE_CONFIG 常數', () => {
    test('HANDSHAKE_CONFIG 包含正確的規格值', () => {
      // Given/When: 透過 window 存取常數
      const config = window.HANDSHAKE_CONFIG

      // Then
      expect(config).toBeDefined()
      expect(config.TIMEOUT_MS).toBe(2000)
      expect(config.MAX_RETRY_ATTEMPTS).toBe(3)
      expect(config.INITIAL_RETRY_DELAY_MS).toBe(1000)
      expect(config.RETRY_BACKOFF_MULTIPLIER).toBe(2)
    })
  })

  // ─── 邊界條件 ───

  describe('邊界條件', () => {
    test('SW emergency 模式回 success:false，進入重試後離線', async () => {
      // Given: SW emergency 模式
      chrome.runtime.sendMessage.mockResolvedValue({
        success: false,
        error: '系統運行於緊急模式，功能受限'
      })

      // When
      const resultPromise = window.checkBackgroundStatus()
      // 推進所有重試時間
      jest.advanceTimersByTime(15000)
      await Promise.resolve()
      const result = await resultPromise

      // Then: 全部失敗
      expect(result).toBe(false)
    })

    test('sendMessage reject 後進入重試，重試成功', async () => {
      // Given: 首次 sendMessage 拋錯，重試成功
      chrome.runtime.sendMessage
        .mockRejectedValueOnce(new Error('Could not establish connection'))
        .mockResolvedValueOnce({
          success: true,
          initializing: false,
          mode: 'normal'
        })

      // When
      const resultPromise = window.checkBackgroundStatus()
      // 首次失敗 → 重試 1 延遲 1s
      jest.advanceTimersByTime(1000)
      await Promise.resolve()
      jest.advanceTimersByTime(2000)
      await Promise.resolve()

      const result = await resultPromise

      // Then: 重試成功
      expect(result).toBe(true)
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2)
    })
  })
})
