/**
 * Integration Test Helper 測試
 * 驗證整合測試輔助工具的功能和穩定性
 *
 * @author Stage 3 TDD 主線程實作
 * @date 2025-08-27
 * @version v0.9.45
 */

const IntegrationTestHelper = require('../utils/integration-test-helper')

describe('IntegrationTestHelper', () => {
  let testHelper

  beforeEach(() => {
    testHelper = new IntegrationTestHelper({
      timeout: 5000,
      enablePerformanceMonitoring: true,
      modules: ['background', 'content', 'popup']
    })
  })

  afterEach(async () => {
    if (testHelper) {
      await testHelper.cleanup()
    }
  })

  describe('🔧 基礎初始化和配置', () => {
    test('應該成功初始化測試輔助工具', () => {
      expect(testHelper).toBeInstanceOf(IntegrationTestHelper)
      expect(typeof testHelper.setupIntegrationTest).toBe('function')
    })

    test('應該正確合併配置', () => {
      const customHelper = new IntegrationTestHelper({
        timeout: 8000,
        enableMemoryTracking: false
      })

      expect(customHelper.config.timeout).toBe(8000)
      expect(customHelper.config.enableMemoryTracking).toBe(false)
      expect(customHelper.config.autoCleanup).toBe(true) // 預設值保留
    })
  })

  describe('🏗️ 測試環境設定', () => {
    test('應該成功設定整合測試環境', async () => {
      const testContext = await testHelper.setupIntegrationTest({
        modules: ['background', 'content'],
        chromeAPI: ['storage', 'runtime']
      })

      expect(testContext).toHaveProperty('chrome')
      expect(testContext).toHaveProperty('modules')
      expect(testContext).toHaveProperty('data')
      expect(testContext).toHaveProperty('performance')

      // 驗證Chrome API可用
      expect(testContext.chrome).toHaveProperty('storage')
      expect(testContext.chrome).toHaveProperty('runtime')
    })

    test('應該正確初始化模組狀態', async () => {
      const testContext = await testHelper.setupIntegrationTest({
        modules: ['background', 'popup']
      })

      expect(testContext.modules).toHaveProperty('background')
      expect(testContext.modules).toHaveProperty('popup')

      const backgroundState = testContext.modules.background.getState()
      expect(backgroundState).toHaveProperty('initialized')
      expect(backgroundState).toHaveProperty('events')
      expect(backgroundState).toHaveProperty('errors')
      expect(Array.isArray(backgroundState.events)).toBe(true)
    })

    test('應該設定Chrome Extension環境變數', async () => {
      const testContext = await testHelper.setupIntegrationTest()

      // 驗證全域Chrome API
      expect(global.chrome).toBeDefined()
      expect(global.chrome.storage).toBeDefined()
      expect(global.chrome.runtime).toBeDefined()

      // Background特定環境
      expect(global.self).toBeDefined()
    })
  })

  describe('📊 效能監控功能', () => {
    test('應該追蹤測試執行效能', async () => {
      const testContext = await testHelper.setupIntegrationTest()

      // 模擬一些操作
      await testContext.chrome.storage.local.set({ testKey: 'testValue' })
      await new Promise(resolve => setTimeout(resolve, 100))

      const performanceReport = testContext.getPerformanceReport()

      expect(performanceReport.enabled).toBe(true)
      expect(performanceReport.totalDuration).toBeGreaterThan(0)
      expect(Array.isArray(performanceReport.operations)).toBe(true)
    })

    test('應該追蹤記憶體使用情況', async () => {
      const testContext = await testHelper.setupIntegrationTest()

      const performanceReport = testContext.getPerformanceReport()

      if (performanceReport.memoryUsage.enabled) {
        expect(performanceReport.memoryUsage.start).toBeDefined()
        expect(performanceReport.memoryUsage.current).toBeDefined()
        expect(typeof performanceReport.memoryUsage.increase).toBe('number')
      }
    })
  })

  describe('🔄 模組間通訊測試', () => {
    test('應該記錄模組間訊息', async () => {
      const testContext = await testHelper.setupIntegrationTest({
        modules: ['background', 'content']
      })

      // 模擬發送訊息
      await testContext.chrome.runtime.sendMessage({
        type: 'TEST_MESSAGE',
        from: 'content',
        to: 'background'
      })

      // 驗證訊息記錄
      const backgroundEvents = testContext.modules.background.getEventHistory()
      expect(backgroundEvents.some(event =>
        event.type === 'inter-module-message'
      )).toBe(true)
    })

    test('應該驗證模組間通訊', async () => {
      const testContext = await testHelper.setupIntegrationTest()

      // 記錄一些通訊事件
      testContext.modules.background.recordEvent({
        type: 'inter-module-message',
        channel: 'runtime',
        message: { test: true }
      })

      const verification = testContext.verifyModuleCommunication('background', 'content', [])

      expect(verification.verified).toBe(true)
      expect(verification.sentMessages).toBeGreaterThan(0)
    })
  })

  describe('🎭 使用者互動模擬', () => {
    test('應該模擬點擊操作', async () => {
      const testContext = await testHelper.setupIntegrationTest()

      const result = await testContext.simulateUserAction('click', {
        selector: '#test-button',
        moduleName: 'popup'
      })

      expect(result.clicked).toBe(true)
      expect(result.selector).toBe('#test-button')

      // 驗證事件記錄
      const popupEvents = testContext.modules.popup.getEventHistory()
      expect(popupEvents.some(event =>
        event.type === 'user-click' && event.selector === '#test-button'
      )).toBe(true)
    })

    test('應該模擬輸入操作', async () => {
      const testContext = await testHelper.setupIntegrationTest()

      const result = await testContext.simulateUserAction('input', {
        selector: '#search-input',
        value: 'test search term'
      })

      expect(result.inputted).toBe(true)
      expect(result.value).toBe('test search term')
    })

    test('應該模擬導航操作', async () => {
      const testContext = await testHelper.setupIntegrationTest()

      const result = await testContext.simulateUserAction('navigation', {
        url: 'https://readmoo.com/library',
        moduleName: 'content'
      })

      expect(result.navigated).toBe(true)
      expect(result.url).toBe('https://readmoo.com/library')
    })
  })

  describe('⏱️ 等待和同步功能', () => {
    test('應該支援條件等待', async () => {
      const testContext = await testHelper.setupIntegrationTest()

      let condition = false

      // 設定延遲改變條件
      setTimeout(() => {
        condition = true
      }, 200)

      const result = await testContext.waitFor(
        () => condition,
        { timeout: 1000, interval: 50 }
      )

      expect(result).toBe(true)
    })

    test('應該在超時時拋出錯誤', async () => {
      const testContext = await testHelper.setupIntegrationTest()

      await expect(testContext.waitFor(
        () => false,
        { timeout: 100 }
      )).rejects.toMatchObject({
        message: expect.stringContaining('Condition not met within 100ms')
      })
    })
  })

  describe('📊 測試資料工廠整合', () => {
    test('應該提供測試資料工廠', async () => {
      const testContext = await testHelper.setupIntegrationTest()

      expect(testContext.data).toBeDefined()
      expect(typeof testContext.data.createBookDataSet).toBe('function')

      // 測試資料生成
      const books = testContext.data.createBookDataSet(5, 'mixed')
      expect(books).toHaveLength(5)
      expect(books[0]).toHaveProperty('id')
      expect(books[0]).toHaveProperty('title')
    })

    test('應該生成Chrome消息資料', async () => {
      const testContext = await testHelper.setupIntegrationTest()

      const messages = testContext.data.createChromeMessages(3, ['EXTRACTION'])
      expect(messages).toHaveLength(3)
      expect(messages[0]).toHaveProperty('type')
      expect(messages[0]).toHaveProperty('action')
      expect(messages[0].type).toBe('EXTRACTION')
    })
  })

  describe('🔍 狀態驗證和錯誤處理', () => {
    test('應該記錄模組錯誤', async () => {
      const testContext = await testHelper.setupIntegrationTest()

      const testError = new Error('Test error')
      testContext.modules.background.simulateError(testError)

      const backgroundState = testContext.modules.background.getState()
      expect(backgroundState.errors).toHaveLength(1)
      expect(backgroundState.errors[0].error.message).toBe('Test error')
    })

    test('應該驗證測試環境狀態', async () => {
      await testHelper.setupIntegrationTest()

      const validation = testHelper.validateTestEnvironment()

      expect(validation).toHaveProperty('isValid')
      expect(validation).toHaveProperty('issues')
      expect(Array.isArray(validation.issues)).toBe(true)
    })

    test('應該檢測效能問題', async () => {
      const testContext = await testHelper.setupIntegrationTest()

      // 模擬慢操作
      testHelper.performance.operations.push({
        operation: 'slow-test',
        duration: 1500, // 超過1秒
        timestamp: Date.now()
      })

      const validation = testHelper.validateTestEnvironment()

      expect(validation.issues.some(issue =>
        issue.includes('longer than 1 second')
      )).toBe(true)
    })
  })

  describe('🧹 清理和重置功能', () => {
    test('應該正確清理測試環境', async () => {
      await testHelper.setupIntegrationTest()

      // 設定一些狀態
      await global.chrome.storage.local.set({ testKey: 'testValue' })
      testHelper.testState.set('testModule', { data: 'test' })

      // 執行清理
      await testHelper.cleanup()

      // 驗證狀態已清理
      expect(testHelper.testState.size).toBe(0)
    })

    test('應該重置效能追蹤', async () => {
      await testHelper.setupIntegrationTest()

      // 記錄一些操作
      testHelper.performance.operations.push({
        operation: 'test',
        duration: 100,
        timestamp: Date.now()
      })

      await testHelper.cleanup()

      // 驗證效能資料重置
      expect(testHelper.performance.endTime).toBeGreaterThan(0)
    })
  })

  describe('🔗 完整整合場景測試', () => {
    test('應該支援完整的Chrome Extension工作流程測試', async () => {
      const testContext = await testHelper.setupIntegrationTest({
        modules: ['background', 'content', 'popup'],
        chromeAPI: ['storage', 'runtime', 'tabs']
      })

      // 1. 生成測試資料
      const books = testContext.data.createBookDataSet(10, 'reading')

      // 2. 模擬content script提取資料
      testContext.modules.content.recordEvent({
        type: 'data-extraction',
        books: books.slice(0, 5)
      })

      // 3. 模擬background處理
      await testContext.chrome.storage.local.set({
        extractedBooks: books.slice(0, 5)
      })

      // 4. 模擬popup顯示
      await testContext.simulateUserAction('click', {
        selector: '#refresh-button'
      })

      // 5. 驗證資料流
      const storageData = await testContext.chrome.storage.local.get('extractedBooks')
      expect(storageData.extractedBooks).toHaveLength(5)

      const contentEvents = testContext.modules.content.getEventHistory()
      expect(contentEvents.some(event => event.type === 'data-extraction')).toBe(true)

      const popupEvents = testContext.modules.popup.getEventHistory()
      expect(popupEvents.some(event => event.type === 'user-click')).toBe(true)

      // 6. 檢查效能
      const performanceReport = testContext.getPerformanceReport()
      expect(performanceReport.enabled).toBe(true)
      expect(performanceReport.operations.length).toBeGreaterThan(0)
    })
  })
})
