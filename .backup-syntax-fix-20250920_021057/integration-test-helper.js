/**
 * Integration Test Helper - Stage 3整合測試輔助工具
 * 專門為跨模組整合測試提供統一的測試環境和工具
 *
 * 功能:
 * - 統一的測試環境初始化
 * - 跨模組通訊測試支援
 * - Service Worker生命週期測試
 * - 測試隔離和清理
 * - 效能監控和驗證
 *
 * @author Stage 3 TDD 主線程實作
 * @date 2025-08-27
 * @version v0.9.45
 */

const ChromeExtensionMocksEnhancedV2 = require('./chrome-extension-mocks-enhanced-v2')
const TestDataFactory = require('./test-data-factory')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

class IntegrationTestHelper {
  constructor (config = {}) {
    this.config = this._mergeConfig(config)
    this._initializeCore()
  }

  /**
   * 合併配置
   */
  _mergeConfig (userConfig) {
    return {
      timeout: 10000,
      enablePerformanceMonitoring: true,
      enableMemoryTracking: true,
      autoCleanup: true,
      mockLevel: 'full', // 'basic' | 'full' | 'custom'
      modules: ['background', 'content', 'popup'],
      chromeAPI: ['storage', 'runtime', 'tabs'],
      ...userConfig
    }
  }

  /**
   * 初始化核心組件
   */
  _initializeCore () {
    this.chromeMocks = new ChromeExtensionMocksEnhancedV2()
    this.testDataFactory = new TestDataFactory()
    this.testState = new Map()
    this._initializePerformanceTracking()
  }

  /**
   * 初始化效能追蹤
   */
  _initializePerformanceTracking () {
    this.performance = {
      startTime: null,
      endTime: null,
      memoryStart: null,
      memoryEnd: null,
      operations: []
    }
  }

  /**
   * 設定整合測試環境
   */
  async setupIntegrationTest (testConfig = {}) {
    const config = this._buildEffectiveConfig(testConfig)
    await this._performSetupSequence(config)
    return this._createTestContext(config)
  }

  /**
   * 建構有效配置
   */
  _buildEffectiveConfig (testConfig) {
    return { ...this.config, ...testConfig }
  }

  /**
   * 執行設定序列
   */
  async _performSetupSequence (config) {
    this._startPerformanceTracking()
    await this._initializeTestEnvironment(config)
    this._setupModuleMocks(config)
    this._setupEventListeners(config)
  }

  /**
   * 開始效能追蹤
   */
  _startPerformanceTracking () {
    if (this.config.enablePerformanceMonitoring) {
      this.performance.startTime = performance.now()

      if (this.config.enableMemoryTracking) {
        this.performance.memoryStart = this._getMemoryUsage()
      }
    }
  }

  /**
   * 獲取記憶體使用量
   */
  _getMemoryUsage () {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage()
    }
    return { heapUsed: 0, heapTotal: 0 }
  }

  /**
   * 初始化測試環境
   */
  async _initializeTestEnvironment (config) {
    this._resetGlobalState()
    this._setupChromeAPIGlobal()
    this._initializeModuleStates(config.modules)
    await this._waitForInitialization()
  }

  /**
   * 設定Chrome API全域變數
   */
  _setupChromeAPIGlobal () {
    global.chrome = this.chromeMocks.createCompleteChromeAPI()
  }

  /**
   * 重置全域狀態
   */
  _resetGlobalState () {
    this._resetMockStates()
    this._resetTestStates()
    this._clearJestMocks()
  }

  /**
   * 重置Mock狀態
   */
  _resetMockStates () {
    this.chromeMocks.resetAllStates()
  }

  /**
   * 重置測試狀態
   */
  _resetTestStates () {
    this.testState.clear()
  }

  /**
   * 清理Jest Mocks
   */
  _clearJestMocks () {
    if (typeof jest !== 'undefined') {
      jest.clearAllMocks()
    }
  }

  /**
   * 初始化模組狀態
   */
  _initializeModuleStates (modules) {
    modules.forEach(moduleName => {
      this.testState.set(moduleName, {
        initialized: false,
        events: [],
        errors: [],
        performance: {
          initTime: 0,
          operationTimes: []
        }
      })
    })
  }

  /**
   * 等待初始化完成
   */
  async _waitForInitialization () {
    // 簡單的延遲，確保所有非同步操作完成
    await new Promise(resolve => setTimeout(resolve, 10))
  }

  /**
   * 設定模組Mock
   */
  _setupModuleMocks (config) {
    config.modules.forEach(moduleName => {
      this._setupModuleSpecificMocks(moduleName, config)
    })
  }

  /**
   * 設定模組特定Mock
   */
  _setupModuleSpecificMocks (moduleName, config) {
    const setupActions = this._getModuleSetupActions()
    const setupAction = setupActions[moduleName]
    if (setupAction) setupAction(config)
  }

  /**
   * 獲取模組設置操作對應表
   */
  _getModuleSetupActions () {
    return {
      background: (config) => this._setupBackgroundMocks(config),
      content: (config) => this._setupContentScriptMocks(config),
      popup: (config) => this._setupPopupMocks(config)
    }
  }

  /**
   * 設定Background Script Mock
   */
  _setupBackgroundMocks (config) {
    this._setupServiceWorkerEnvironment()
    this._enhanceChromeRuntimeForBackground()
  }

  /**
   * 設定Service Worker環境
   */
  _setupServiceWorkerEnvironment () {
    global.self = global.self || {}
    global.self.registration = this._createServiceWorkerRegistration()
  }

  /**
   * 創建Service Worker註冊物件
   */
  _createServiceWorkerRegistration () {
    return {
      scope: '/',
      active: true
    }
  }

  /**
   * 增強Background專用Chrome Runtime
   */
  _enhanceChromeRuntimeForBackground () {
    if (!global.chrome.runtime) return
    global.chrome.runtime.onInstalled = this._createOnInstalledMock()
  }

  /**
   * 創建安裝事件Mock
   */
  _createOnInstalledMock () {
    return { addListener: jest.fn() }
  }

  /**
   * 設定Content Script Mock
   */
  _setupContentScriptMocks (config) {
    this._setupDOMEnvironment()
    this._setupWindowEnvironment()
  }

  /**
   * 設定DOM環境
   */
  _setupDOMEnvironment () {
    if (typeof document === 'undefined') {
      global.document = this._createDocumentMock()
    }
  }

  /**
   * 創建Document Mock
   */
  _createDocumentMock () {
    return {
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      createElement: jest.fn(() => ({})),
      addEventListener: jest.fn()
    }
  }

  /**
   * 設定Window環境
   */
  _setupWindowEnvironment () {
    global.window = global.window || {}
    global.window.location = this._createLocationMock()
  }

  /**
   * 創建Location Mock
   */
  _createLocationMock () {
    return {
      href: 'https://readmoo.com/test',
      origin: 'https://readmoo.com'
    }
  }

  /**
   * 設定Popup Mock
   */
  _setupPopupMocks (config) {
    this._setupPopupWindow()
    this._setupPopupDOM()
  }

  /**
   * 設定Popup Window
   */
  _setupPopupWindow () {
    global.window = global.window || {}
    global.window.close = jest.fn()
  }

  /**
   * 設定Popup DOM
   */
  _setupPopupDOM () {
    global.document = global.document || {}
    global.document.getElementById = jest.fn()
    global.document.querySelector = jest.fn()
  }

  /**
   * 設定事件監聽器
   */
  _setupEventListeners (config) {
    // 全域錯誤處理
    this._setupErrorHandlers()

    // 模組間通訊監聽
    this._setupInterModuleCommunication()

    // 效能事件監聽
    if (config.enablePerformanceMonitoring) {
      this._setupPerformanceListeners()
    }
  }

  /**
   * 設定錯誤處理器
   */
  _setupErrorHandlers () {
    global.addEventListener = global.addEventListener || jest.fn()
    global.removeEventListener = global.removeEventListener || jest.fn()

    // 模擬錯誤捕獲
    this._errorHandler = (error) => {
      this._recordError('global', error)
    }
  }

  /**
   * 記錄錯誤
   */
  _recordError (moduleName, error) {
    const moduleState = this.testState.get(moduleName)
    if (moduleState) {
      moduleState.errors.push({
        error,
        timestamp: Date.now(),
        stackTrace: error.stack
      })
    }
  }

  /**
   * 設定模組間通訊
   */
  _setupInterModuleCommunication () {
    // 設定chrome.runtime.sendMessage Mock
    if (global.chrome?.runtime?.sendMessage) {
      // 保存對原始方法的引用，但不呼叫以避免循環
      global.chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        this._recordInterModuleMessage('runtime', message)
        // 直接返回Promise以避免循環調用
        if (callback) {
          callback({ success: true, mockResponse: true })
        }
        return Promise.resolve({ success: true, mockResponse: true })
      })
    }
  }

  /**
   * 記錄模組間訊息
   */
  _recordInterModuleMessage (channel, message) {
    this.testState.forEach((state, moduleName) => {
      state.events.push({
        type: 'inter-module-message',
        channel,
        message,
        timestamp: Date.now()
      })
    })
  }

  /**
   * 設定效能監聽器
   */
  _setupPerformanceListeners () {
    // Mock performance API if needed
    if (typeof performance === 'undefined') {
      global.performance = {
        now: () => Date.now(),
        mark: jest.fn(),
        measure: jest.fn()
      }
    }
  }

  /**
   * 創建測試上下文
   */
  _createTestContext (config) {
    return {
      chrome: global.chrome,
      modules: this._createModuleHelpers(config.modules),
      data: this.testDataFactory,
      state: this.testState,
      performance: this.performance,

      // 工具方法
      waitFor: this.waitFor.bind(this),
      simulateUserAction: this.simulateUserAction.bind(this),
      verifyModuleCommunication: this.verifyModuleCommunication.bind(this),
      getPerformanceReport: this.getPerformanceReport.bind(this)
    }
  }

  /**
   * 創建模組輔助工具
   */
  _createModuleHelpers (modules) {
    const helpers = {}

    modules.forEach(moduleName => {
      helpers[moduleName] = {
        getState: () => this.testState.get(moduleName),
        recordEvent: (event) => this._recordModuleEvent(moduleName, event),
        simulateError: (error) => this._recordError(moduleName, error),
        getEventHistory: () => this.testState.get(moduleName)?.events || []
      }
    })

    return helpers
  }

  /**
   * 記錄模組事件
   */
  _recordModuleEvent (moduleName, event) {
    const moduleState = this.testState.get(moduleName)
    if (moduleState) {
      moduleState.events.push({
        ...event,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 等待條件成立
   */
  async waitFor (condition, options = {}) {
    const { timeout = this.config.timeout, interval = 100 } = options
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true
      }
      await new Promise(resolve => setTimeout(resolve, interval))
    }

    throw (() => { const error = new Error( `Condition not met within ${timeout}ms`); error.code = ErrorCodes.VALIDATION_ERROR; error.details =  { category: 'validation' }; return error })()
  }

  /**
   * 模擬使用者操作
   */
  async simulateUserAction (actionType, params = {}) {
    const startTime = performance.now()

    let result
    switch (actionType) {
      case 'click':
        result = await this._simulateClick(params)
        break
      case 'input':
        result = await this._simulateInput(params)
        break
      case 'navigation':
        result = await this._simulateNavigation(params)
        break
      default:
        throw (() => { const error = new Error( `Unknown action type: ${actionType}`); error.code = ErrorCodes.VALIDATION_ERROR; error.details =  { category: 'validation' }; return error })()
    }

    this._recordPerformanceOperation('user-action', performance.now() - startTime)
    return result
  }

  /**
   * 模擬點擊
   */
  async _simulateClick (params) {
    const { selector, moduleName = 'popup' } = params

    this._recordModuleEvent(moduleName, {
      type: 'user-click',
      selector
    })

    // 模擬點擊延遲
    await new Promise(resolve => setTimeout(resolve, 10))
    return { clicked: true, selector }
  }

  /**
   * 模擬輸入
   */
  async _simulateInput (params) {
    const { selector, value, moduleName = 'popup' } = params

    this._recordModuleEvent(moduleName, {
      type: 'user-input',
      selector,
      value
    })

    return { inputted: true, selector, value }
  }

  /**
   * 模擬導航
   */
  async _simulateNavigation (params) {
    const { url, moduleName = 'content' } = params

    // 安全地更新location，避免JSDOM navigation問題
    try {
      if (global.window?.location) {
        // 只更新location屬性，不觸發實際navigation
        Object.defineProperty(global.window.location, 'href', {
          value: url,
          writable: true
        })
      }
    } catch (error) {
      // 忽略JSDOM navigation錯誤，這在測試環境中是正常的
    }

    this._recordModuleEvent(moduleName, {
      type: 'navigation',
      url
    })

    return { navigated: true, url }
  }

  /**
   * 記錄效能操作
   */
  _recordPerformanceOperation (operation, duration) {
    if (this.config.enablePerformanceMonitoring) {
      this.performance.operations.push({
        operation,
        duration,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 驗證模組通訊
   */
  verifyModuleCommunication (fromModule, toModule, expectedMessages = []) {
    const fromState = this.testState.get(fromModule)
    const toState = this.testState.get(toModule)

    if (!fromState || !toState) {
      return {
        verified: false,
        error: 'Module state not found'
      }
    }

    const communicationEvents = fromState.events.filter(event =>
      event.type === 'inter-module-message'
    )

    return {
      verified: communicationEvents.length >= expectedMessages.length,
      sentMessages: communicationEvents.length,
      expectedMessages: expectedMessages.length,
      events: communicationEvents
    }
  }

  /**
   * 獲取效能報告
   */
  getPerformanceReport () {
    if (!this.config.enablePerformanceMonitoring) {
      return { enabled: false }
    }

    const endTime = performance.now()
    const totalDuration = this.performance.startTime ? endTime - this.performance.startTime : 0

    const report = {
      enabled: true,
      totalDuration,
      operations: this.performance.operations,
      averageOperationTime: this._calculateAverageOperationTime(),
      memoryUsage: this._getMemoryReport()
    }

    return report
  }

  /**
   * 計算平均操作時間
   */
  _calculateAverageOperationTime () {
    const { operations } = this.performance
    if (operations.length === 0) return 0

    const totalTime = operations.reduce((sum, op) => sum + op.duration, 0)
    return totalTime / operations.length
  }

  /**
   * 獲取記憶體報告
   */
  _getMemoryReport () {
    if (!this.config.enableMemoryTracking) {
      return { enabled: false }
    }

    const currentMemory = this._getMemoryUsage()
    const startMemory = this.performance.memoryStart

    return {
      enabled: true,
      start: startMemory,
      current: currentMemory,
      increase: currentMemory.heapUsed - startMemory.heapUsed,
      percentage: startMemory.heapUsed > 0
        ? ((currentMemory.heapUsed - startMemory.heapUsed) / startMemory.heapUsed * 100)
        : 0
    }
  }

  /**
   * 清理測試環境
   */
  async cleanup () {
    if (this.config.autoCleanup) {
      await this._performCleanup()
    }
  }

  /**
   * 執行清理
   */
  async _performCleanup () {
    // 重置Chrome API Mock
    this.chromeMocks.resetAllStates()

    // 清理全域變數
    this._cleanupGlobalVariables()

    // 清理測試狀態
    this.testState.clear()

    // 停止效能追蹤
    this._stopPerformanceTracking()
  }

  /**
   * 清理全域變數
   */
  _cleanupGlobalVariables () {
    // 清理可能的記憶體洩漏
    if (global.chrome) {
      delete global.chrome
    }

    if (global.self?.registration) {
      delete global.self.registration
    }
  }

  /**
   * 停止效能追蹤
   */
  _stopPerformanceTracking () {
    if (this.config.enablePerformanceMonitoring) {
      this.performance.endTime = performance.now()
    }
  }

  /**
   * 驗證測試環境狀態
   */
  validateTestEnvironment () {
    const issues = []

    // 驗證Chrome API Mock
    const mockValidation = this.chromeMocks.validateMockConsistency()
    if (!mockValidation.isValid) {
      issues.push(...mockValidation.issues)
    }

    // 驗證模組狀態
    issues.push(...this._validateModuleStates())

    // 驗證效能指標
    if (this.config.enablePerformanceMonitoring) {
      issues.push(...this._validatePerformanceMetrics())
    }

    return {
      isValid: issues.length === 0,
      issues
    }
  }

  /**
   * 驗證模組狀態
   */
  _validateModuleStates () {
    const issues = []

    this.testState.forEach((state, moduleName) => {
      if (!state || typeof state !== 'object') {
        issues.push(`Module ${moduleName} has invalid state`)
      }

      if (!Array.isArray(state.events)) {
        issues.push(`Module ${moduleName} events is not an array`)
      }
    })

    return issues
  }

  /**
   * 驗證效能指標
   */
  _validatePerformanceMetrics () {
    const issues = []

    if (this.performance.operations.some(op => op.duration > 1000)) {
      issues.push('Some operations took longer than 1 second')
    }

    const memoryReport = this._getMemoryReport()
    if (memoryReport.enabled && memoryReport.percentage > 50) {
      issues.push('Memory usage increased by more than 50%')
    }

    return issues
  }
}

module.exports = IntegrationTestHelper
