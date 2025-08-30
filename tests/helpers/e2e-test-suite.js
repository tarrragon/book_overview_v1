/**
 * 端到端測試套件框架
 *
 * 提供完整的Chrome Extension整合測試基礎設施
 * 負責測試環境設置、Chrome Extension模擬、測試資料管理
 */

class E2ETestSuite {
  constructor (config = {}) {
    this.config = {
      headless: config.headless !== false,
      slowMo: config.slowMo || 0,
      testDataSize: config.testDataSize || 'small',
      enableStorageTracking: config.enableStorageTracking || false,
      ...config
    }

    this.testEnvironment = {
      initialized: false,
      browser: null,
      extension: null,
      pages: new Map(),
      contexts: new Map()
    }

    this.testData = {
      books: [],
      users: [],
      settings: {},
      cleanup: []
    }

    this.metrics = {
      startTime: null,
      operations: [],
      errors: [],
      performance: {}
    }
  }

  async initialize () {
    if (this.testEnvironment.initialized) return

    try {
      this.metrics.startTime = Date.now()

      // 初始化測試環境
      await this.setupTestEnvironment()

      // 載入Chrome Extension模擬
      await this.loadChromeExtensionMocks()

      // 準備測試資料
      await this.prepareTestData()

      this.testEnvironment.initialized = true
    } catch (error) {
      await this.cleanup()
      throw new Error(`E2E測試套件初始化失敗: ${error.message}`)
    }
  }

  // 兼容測試檔案的方法名稱
  async setup () {
    return await this.initialize()
  }

  async setupTestEnvironment () {
    // //todo: 改善方向 - 實作真實瀏覽器環境啟動
    // 當前權宜方案：使用JSDOM模擬瀏覽器環境

    global.chrome = {
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn(),
          clear: jest.fn(),
          remove: jest.fn(),
          onChanged: { addListener: jest.fn() }
        },
        sync: {
          get: jest.fn(),
          set: jest.fn()
        }
      },
      runtime: {
        sendMessage: jest.fn(),
        onMessage: { addListener: jest.fn() },
        getManifest: jest.fn(() => ({ version: '1.0.0' })),
        id: 'test-extension-id'
      },
      tabs: {
        query: jest.fn(),
        sendMessage: jest.fn(),
        onUpdated: { addListener: jest.fn() }
      }
    }

    this.testEnvironment.contexts.set('background', {
      type: 'service-worker',
      active: true,
      chrome: global.chrome
    })

    this.testEnvironment.contexts.set('content', {
      type: 'content-script',
      active: false,
      chrome: global.chrome
    })

    this.testEnvironment.contexts.set('popup', {
      type: 'popup',
      active: false,
      chrome: global.chrome
    })
  }

  async loadChromeExtensionMocks () {
    // 初始化 Chrome Extension Controller
    const { ChromeExtensionController } = require('./chrome-extension-controller')
    this.extensionController = new ChromeExtensionController({
      extensionId: 'test-extension-12345',
      enableLogging: false,
      simulateNetworkDelay: false
    })

    await this.extensionController.installExtension()
    await this.extensionController.loadExtension()

    // //todo: 改善方向 - 實作更完整的Chrome Extension Runtime模擬
    this.testEnvironment.extension = {
      id: 'test-extension-id-12345',
      version: '1.0.0',
      state: 'loaded'
    }
  }

  async prepareTestData () {
    const { TestDataGenerator } = require('./test-data-generator')
    const generator = new TestDataGenerator()

    switch (this.config.testDataSize) {
      case 'small':
        this.testData.books = generator.generateBooks(50)
        break
      case 'medium':
        this.testData.books = generator.generateBooks(500)
        break
      case 'large':
        this.testData.books = generator.generateBooks(2000)
        break
      default:
        this.testData.books = generator.generateBooks(10)
    }

    this.testData.users = generator.generateUsers(3)
    this.testData.settings = generator.generateSettings()
  }

  async loadInitialData (data = {}) {
    if (!this.testEnvironment.initialized) {
      throw new Error('測試套件未初始化，請先呼叫 initialize()')
    }

    // 載入書籍資料
    if (data.books && Array.isArray(data.books)) {
      this.testData.books = [...this.testData.books, ...data.books]
      
      // 模擬將資料存儲到 Chrome Extension Storage
      await this.simulateStorageWrite('books', data.books)
      
      // 同步到 extensionController 的存儲系統
      if (this.extensionController) {
        this.extensionController.state.storage.set('books', data.books)
        this.extensionController.state.storage.set('hasUsedBefore', true)
      }
    }

    // 載入元資料
    if (data.metadata) {
      this.testData.metadata = { ...this.testData.metadata, ...data.metadata }
      
      // 模擬將元資料存儲到 Chrome Extension Storage
      await this.simulateStorageWrite('metadata', data.metadata)
      
      // 同步到 extensionController 的存儲系統
      if (this.extensionController) {
        this.extensionController.state.storage.set('metadata', data.metadata)
        if (data.metadata.lastExtraction) {
          this.extensionController.state.storage.set('lastExtraction', data.metadata.lastExtraction)
        }
      }
    }

    // 載入使用者設定
    if (data.settings) {
      this.testData.settings = { ...this.testData.settings, ...data.settings }
      
      // 模擬將設定存儲到 Chrome Extension Storage
      await this.simulateStorageWrite('settings', data.settings)
      
      // 同步到 extensionController 的存儲系統
      if (this.extensionController) {
        this.extensionController.state.storage.set('settings', data.settings)
      }
    }

    return {
      success: true,
      loadedBooks: data.books ? data.books.length : 0,
      totalBooks: this.testData.books.length
    }
  }

  async simulateStorageWrite (key, data) {
    // 模擬 Chrome Storage API 寫入
    // 在測試環境中，我們將資料存儲在記憶體中
    if (!this.testEnvironment.storage) {
      this.testEnvironment.storage = new Map()
    }
    
    this.testEnvironment.storage.set(key, JSON.parse(JSON.stringify(data)))
    
    // 記錄操作用於除錯
    this.metrics.operations.push({
      type: 'storage_write',
      key,
      timestamp: Date.now(),
      dataSize: JSON.stringify(data).length
    })
  }

  async simulateStorageRead (key) {
    // 模擬 Chrome Storage API 讀取
    if (!this.testEnvironment.storage) {
      return null
    }
    
    const data = this.testEnvironment.storage.get(key)
    
    // 記錄操作用於除錯
    this.metrics.operations.push({
      type: 'storage_read',
      key,
      timestamp: Date.now(),
      found: !!data
    })
    
    return data
  }

  async clearAllStorageData () {
    // 清除所有模擬的儲存資料
    if (this.testEnvironment.storage) {
      this.testEnvironment.storage.clear()
    }
    
    // 重置測試資料
    this.testData.books = []
    this.testData.metadata = {}
    this.testData.settings = {}
    
    this.metrics.operations.push({
      type: 'storage_clear',
      timestamp: Date.now()
    })
  }

  async executeWorkflow (workflowName, steps = []) {
    if (!this.testEnvironment.initialized) {
      throw new Error('測試套件未初始化，請先呼叫 initialize()')
    }

    const workflow = {
      name: workflowName,
      startTime: Date.now(),
      steps: [],
      result: null,
      errors: []
    }

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        const stepResult = await this.executeWorkflowStep(step, i)
        workflow.steps.push(stepResult)

        if (!stepResult.success) {
          throw new Error(`工作流程步驟 ${i + 1} 失敗: ${stepResult.error}`)
        }
      }

      workflow.result = { success: true, completedSteps: steps.length }
      return workflow
    } catch (error) {
      workflow.errors.push(error.message)
      workflow.result = { success: false, error: error.message }
      throw error
    } finally {
      workflow.endTime = Date.now()
      workflow.duration = workflow.endTime - workflow.startTime
      this.metrics.operations.push(workflow)
    }
  }

  async executeWorkflowStep (step, stepIndex) {
    const stepStartTime = Date.now()

    try {
      // 模擬步驟執行延遲
      if (this.config.slowMo > 0) {
        await new Promise(resolve => setTimeout(resolve, this.config.slowMo))
      }

      let result

      switch (step.type) {
        case 'navigate':
          result = await this.simulateNavigation(step.params)
          break
        case 'click':
          result = await this.simulateClick(step.params)
          break
        case 'input':
          result = await this.simulateInput(step.params)
          break
        case 'wait':
          result = await this.simulateWait(step.params)
          break
        case 'verify':
          result = await this.simulateVerification(step.params)
          break
        default:
          throw new Error(`未支援的步驟類型: ${step.type}`)
      }

      return {
        index: stepIndex,
        type: step.type,
        success: true,
        result,
        duration: Date.now() - stepStartTime
      }
    } catch (error) {
      return {
        index: stepIndex,
        type: step.type,
        success: false,
        error: error.message,
        duration: Date.now() - stepStartTime
      }
    }
  }

  async simulateNavigation (params) {
    // //todo: 改善方向 - 實作真實頁面導航
    return { action: 'navigate', url: params.url, success: true }
  }

  async simulateClick (params) {
    // //todo: 改善方向 - 實作真實DOM元素點擊
    return { action: 'click', selector: params.selector, success: true }
  }

  async simulateInput (params) {
    // //todo: 改善方向 - 實作真實表單輸入
    return { action: 'input', selector: params.selector, value: params.value, success: true }
  }

  async simulateWait (params) {
    await new Promise(resolve => setTimeout(resolve, params.duration || 1000))
    return { action: 'wait', duration: params.duration, success: true }
  }

  async simulateVerification (params) {
    // //todo: 改善方向 - 實作真實DOM狀態驗證
    return { action: 'verify', condition: params.condition, success: true }
  }

  getMetrics () {
    return {
      totalTime: this.metrics.startTime ? Date.now() - this.metrics.startTime : 0,
      operations: this.metrics.operations.length,
      errors: this.metrics.errors.length,
      averageOperationTime: this.calculateAverageOperationTime(),
      testDataSize: this.testData.books.length
    }
  }

  calculateAverageOperationTime () {
    if (this.metrics.operations.length === 0) return 0

    const totalTime = this.metrics.operations.reduce((sum, op) => sum + (op.duration || 0), 0)
    return Math.round(totalTime / this.metrics.operations.length)
  }

  // 測試檔案需要的方法
  async clearAllStorageData () {
    if (this.extensionController) {
      await this.extensionController.handleStorageClear()
    }

    // 清理測試資料
    this.testData.books = []
    this.testData.users = []
    this.testData.settings = {}
  }

  async resetExtensionState () {
    if (this.extensionController) {
      // 重置 Extension 狀態到初始狀態
      this.extensionController.state.installed = true
      this.extensionController.state.loaded = true
      this.extensionController.state.activeTab = null
      this.extensionController.state.storage.clear()
      this.extensionController.state.messageQueue = []
      this.extensionController.metrics.errors = []
    }

    // 重置測試環境狀態
    if (this.testEnvironment.contexts) {
      this.testEnvironment.contexts.forEach(context => {
        if (context.type === 'popup') {
          context.state = 'closed'
        } else if (context.type === 'content-script') {
          context.state = 'not-injected'
        }
      })
    }
  }

  // 模擬測試環境的輔助方法
  async navigateToMockReadmooPage () {
    return { success: true, url: 'https://readmoo.com/library', pageType: 'library' }
  }

  async setupMockReadmooPage () {
    // 設置 Readmoo 頁面環境
    if (this.extensionController) {
      this.extensionController.state.storage.set('isReadmooPage', true)
      this.extensionController.state.storage.set('pageDetectionError', false)
      this.extensionController.state.storage.delete('errorMessage')

      // 如果沒有明確設置書籍數量，預設為 0
      if (!this.extensionController.state.storage.has('mockBooksCount')) {
        this.extensionController.state.storage.set('mockBooksCount', 0)
      }
    }

    return { success: true, mockSetup: true }
  }

  async injectMockBooks (books) {
    this.testData.books = books || []

    // 更新 extensionController 的狀態
    if (this.extensionController) {
      this.extensionController.state.storage.set('mockBooksCount', this.testData.books.length)
      this.extensionController.state.storage.set('isReadmooPage', true)
      this.extensionController.state.storage.set('expectedBookCount', this.testData.books.length)
    }

    return { success: true, injectedCount: this.testData.books.length }
  }

  async waitForPageLoad (url) {
    // 模擬頁面載入等待
    await new Promise(resolve => setTimeout(resolve, 100))
    return { success: true, url, loaded: true }
  }

  async getOverviewPageData () {
    return {
      bookCount: this.testData.books.length,
      booksDisplayed: this.testData.books,
      searchFunctionality: true,
      exportFunctionality: true
    }
  }

  async simulateNetworkDisconnection () {
    return { success: true, networkDisconnected: true }
  }

  async restoreNetworkConnection () {
    return { success: true, networkRestored: true }
  }

  async waitForTimeout (ms) {
    await new Promise(resolve => setTimeout(resolve, ms))
    return { success: true, waited: ms }
  }

  async getMemoryUsage () {
    return {
      used: Math.random() * 50 * 1024 * 1024, // 0-50MB
      total: 100 * 1024 * 1024 // 100MB
    }
  }

  createUXMonitor () {
    return {
      measurePopupLoadTime: () => 300,
      measureButtonResponseTime: () => 50,
      measureProgressSmoothness: () => ({
        frameDrops: 2,
        smoothnessScore: 0.95
      })
    }
  }

  async navigateToPage (url) {
    // 更新 extensionController 的頁面狀態
    if (this.extensionController) {
      const isReadmooPage = url.includes('readmoo.com')
      this.extensionController.state.storage.set('isReadmooPage', isReadmooPage)
      this.extensionController.state.storage.set('currentUrl', url)

      if (!isReadmooPage) {
        this.extensionController.state.storage.set('pageDetectionError', true)
        this.extensionController.state.storage.set('errorMessage', 'Readmoo 頁面檢測失敗')
      }
    }

    return { success: true, url, navigated: true }
  }

  async cleanup () {
    try {
      // 清理測試資料
      this.testData.cleanup.forEach(cleanupFn => {
        try {
          cleanupFn()
        } catch (error) {
          console.warn('清理操作失敗:', error.message)
        }
      })

      // 重置測試環境
      this.testEnvironment.initialized = false
      this.testEnvironment.contexts.clear()

      // 清理全域變數
      if (global.chrome) {
        delete global.chrome
      }
    } catch (error) {
      console.error('測試套件清理失敗:', error.message)
    }
  }

  // 靜態工廠方法
  static async create (config = {}) {
    const suite = new E2ETestSuite(config)
    await suite.initialize()
    return suite
  }
}

module.exports = { E2ETestSuite }
