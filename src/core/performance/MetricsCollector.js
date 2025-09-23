/**
 * MetricsCollector - Chrome Extension 效能指標收集器
 *
 * 功能說明：
 * - 提供多維度效能指標收集功能
 * - 支援記憶體、CPU、IO 和 Extension 專用指標
 * - 整合 Chrome Performance API 和系統監控 API
 * - 實現即時指標收集和資料處理
 *
 * 設計原則：
 * - 遵循五行函式單一職責原則
 * - 使用語意化命名和 src/ 路徑格式
 * - 完全整合 ErrorCodes 錯誤處理體系
 * - 優化效能監控的資源開銷
 *
 * @version v0.14.1
 * @date 2025-09-23
 * @author Claude Code Assistant
 */

const { ErrorCodes } = require('../errors/ErrorCodes')

class MetricsCollector {
  /**
   * 建構指標收集器實例
   *
   * 需求：初始化指標收集器的配置和監控能力
   * 設計：設定收集參數、初始化監控狀態和資料處理機制
   *
   * @param {Object} config - 收集器配置選項
   * @param {number} config.samplingInterval - 取樣間隔 (毫秒)
   * @param {boolean} config.enableCaching - 是否啟用快取
   * @param {Object} config.collectionOptions - 收集選項
   */
  constructor (config = {}) {
    this.validateConstructorParameters(config)
    this.initializeCollectorConfiguration(config)
    this.initializePerformanceAPIs()
    this.initializeCachingSystem()
    this.initializeCollectionState()
  }

  /**
   * 驗證建構參數有效性
   *
   * @param {Object} config - 配置物件
   * @throws {Error} 參數無效時拋出錯誤
   */
  validateConstructorParameters (config) {
    if (typeof config !== 'object' || config === null) {
      throw (() => {
        const code = ErrorCodes.VALIDATION_FAILED
        return new Error(`${code.code}: 收集器配置必須是有效的物件`)
      })()
    }
  }

  /**
   * 初始化收集器配置
   *
   * @param {Object} config - 使用者配置
   */
  initializeCollectorConfiguration (config) {
    this.config = {
      samplingInterval: 1000,
      enableCaching: true,
      collectionOptions: {},
      ...config
    }
  }

  /**
   * 初始化 Performance APIs
   */
  initializePerformanceAPIs () {
    this.performanceAPI = {
      memory: performance.memory,
      timing: performance.timing,
      navigation: performance.navigation,
      now: performance.now.bind(performance)
    }
  }

  /**
   * 初始化快取系統
   */
  initializeCachingSystem () {
    this.cache = {
      enabled: this.config.enableCaching,
      memoryMetrics: null,
      cpuMetrics: null,
      ioMetrics: null,
      extensionMetrics: null,
      lastUpdated: {}
    }
  }

  /**
   * 初始化收集狀態
   */
  initializeCollectionState () {
    this.collectionState = {
      isCollecting: false,
      collectionsCount: 0,
      errors: [],
      startTime: null
    }
  }

  /**
   * 收集記憶體效能指標
   *
   * 需求：收集詳細的記憶體使用情況和垃圾回收資訊
   * 設計：使用 Performance Memory API 和 Chrome Memory API
   *
   * @param {Object} options - 收集選項
   * @returns {Promise<Object>} 記憶體效能指標
   */
  async collectMemoryMetrics (options = {}) {
    this.validateMemoryMetricsOptions(options)

    if (this.shouldUseCachedMemoryMetrics()) {
      return this.getCachedMemoryMetrics()
    }

    const memoryCollectionStart = this.recordCollectionStartTime()
    const heapMetrics = this.collectHeapMemoryMetrics()
    const systemMetrics = await this.collectSystemMemoryMetrics()
    const gcMetrics = this.collectGarbageCollectionMetrics()
    const consolidatedMetrics = this.consolidateMemoryMetrics(heapMetrics, systemMetrics, gcMetrics)

    return this.finalizeMemoryMetricsCollection(consolidatedMetrics, memoryCollectionStart)
  }

  /**
   * 驗證記憶體指標收集選項
   *
   * @param {Object} options - 收集選項
   * @throws {Error} 選項無效時拋出錯誤
   */
  validateMemoryMetricsOptions (options) {
    if (typeof options !== 'object' || options === null) {
      throw (() => {
        const code = ErrorCodes.VALIDATION_FAILED
        return new Error(`${code.code}: 記憶體指標收集選項必須是有效的物件`)
      })()
    }
  }

  /**
   * 檢查是否應使用快取的記憶體指標
   *
   * @returns {boolean} 是否使用快取
   */
  shouldUseCachedMemoryMetrics () {
    if (!this.cache.enabled || !this.cache.memoryMetrics) {
      return false
    }

    const cacheAge = Date.now() - this.cache.lastUpdated.memory
    return cacheAge < this.config.samplingInterval
  }

  /**
   * 取得快取的記憶體指標
   *
   * @returns {Object} 快取的記憶體指標
   */
  getCachedMemoryMetrics () {
    return {
      ...this.cache.memoryMetrics,
      cached: true,
      cacheAge: Date.now() - this.cache.lastUpdated.memory
    }
  }

  /**
   * 記錄收集開始時間
   *
   * @returns {number} 開始時間戳
   */
  recordCollectionStartTime () {
    return this.performanceAPI.now()
  }

  /**
   * 收集堆記憶體指標
   *
   * @returns {Object} 堆記憶體指標
   */
  collectHeapMemoryMetrics () {
    if (!this.performanceAPI.memory) {
      return this.createEmptyHeapMetrics()
    }

    return {
      heapUsed: this.performanceAPI.memory.usedJSHeapSize,
      heapTotal: this.performanceAPI.memory.totalJSHeapSize,
      heapLimit: this.performanceAPI.memory.jsHeapSizeLimit,
      heapUsageRatio: this.calculateHeapUsageRatio()
    }
  }

  /**
   * 建立空的堆記憶體指標
   *
   * @returns {Object} 空的堆記憶體指標
   */
  createEmptyHeapMetrics () {
    return {
      heapUsed: 0,
      heapTotal: 0,
      heapLimit: 0,
      heapUsageRatio: 0,
      unavailable: true
    }
  }

  /**
   * 計算堆記憶體使用率
   *
   * @returns {number} 使用率百分比
   */
  calculateHeapUsageRatio () {
    if (!this.performanceAPI.memory || this.performanceAPI.memory.jsHeapSizeLimit === 0) {
      return 0
    }

    return (this.performanceAPI.memory.usedJSHeapSize / this.performanceAPI.memory.jsHeapSizeLimit) * 100
  }

  /**
   * 收集系統記憶體指標
   *
   * @returns {Promise<Object>} 系統記憶體指標
   */
  async collectSystemMemoryMetrics () {
    try {
      if (chrome?.system?.memory) {
        const systemMemoryInfo = await chrome.system.memory.getInfo()
        return this.processSystemMemoryInfo(systemMemoryInfo)
      }

      return this.createEmptySystemMemoryMetrics()
    } catch (error) {
      return this.handleSystemMemoryError(error)
    }
  }

  /**
   * 處理系統記憶體資訊
   *
   * @param {Object} memoryInfo - Chrome 系統記憶體資訊
   * @returns {Object} 處理後的系統記憶體指標
   */
  processSystemMemoryInfo (memoryInfo) {
    return {
      totalCapacity: memoryInfo.totalCapacityBytes || 0,
      availableCapacity: memoryInfo.availableCapacityBytes || 0,
      usedCapacity: (memoryInfo.totalCapacityBytes || 0) - (memoryInfo.availableCapacityBytes || 0),
      usageRatio: this.calculateSystemMemoryUsageRatio(memoryInfo)
    }
  }

  /**
   * 計算系統記憶體使用率
   *
   * @param {Object} memoryInfo - 記憶體資訊
   * @returns {number} 使用率百分比
   */
  calculateSystemMemoryUsageRatio (memoryInfo) {
    if (!memoryInfo.totalCapacityBytes || memoryInfo.totalCapacityBytes === 0) {
      return 0
    }

    const usedBytes = memoryInfo.totalCapacityBytes - memoryInfo.availableCapacityBytes
    return (usedBytes / memoryInfo.totalCapacityBytes) * 100
  }

  /**
   * 建立空的系統記憶體指標
   *
   * @returns {Object} 空的系統記憶體指標
   */
  createEmptySystemMemoryMetrics () {
    return {
      totalCapacity: 0,
      availableCapacity: 0,
      usedCapacity: 0,
      usageRatio: 0,
      unavailable: true
    }
  }

  /**
   * 處理系統記憶體錯誤
   *
   * @param {Error} error - 錯誤物件
   * @returns {Object} 錯誤指標
   */
  handleSystemMemoryError (error) {
    return {
      error: error.message,
      totalCapacity: 0,
      availableCapacity: 0,
      usedCapacity: 0,
      usageRatio: 0
    }
  }

  /**
   * 收集垃圾回收指標
   *
   * @returns {Object} 垃圾回收指標
   */
  collectGarbageCollectionMetrics () {
    // 簡化實作，實際可能需要更複雜的 GC 監控
    return {
      gcSupported: typeof gc !== 'undefined',
      lastGCTime: 0,
      gcCount: 0,
      estimatedFrequency: 'unknown'
    }
  }

  /**
   * 整合記憶體指標
   *
   * @param {Object} heapMetrics - 堆記憶體指標
   * @param {Object} systemMetrics - 系統記憶體指標
   * @param {Object} gcMetrics - 垃圾回收指標
   * @returns {Object} 整合的記憶體指標
   */
  consolidateMemoryMetrics (heapMetrics, systemMetrics, gcMetrics) {
    return {
      timestamp: new Date().toISOString(),
      heap: heapMetrics,
      system: systemMetrics,
      gc: gcMetrics,
      overall: this.calculateOverallMemoryStatus(heapMetrics, systemMetrics)
    }
  }

  /**
   * 計算整體記憶體狀態
   *
   * @param {Object} heapMetrics - 堆記憶體指標
   * @param {Object} systemMetrics - 系統記憶體指標
   * @returns {Object} 整體記憶體狀態
   */
  calculateOverallMemoryStatus (heapMetrics, systemMetrics) {
    return {
      status: this.determineMemoryStatus(heapMetrics, systemMetrics),
      pressure: this.calculateMemoryPressure(heapMetrics, systemMetrics),
      recommendation: this.generateMemoryRecommendation(heapMetrics, systemMetrics)
    }
  }

  /**
   * 判斷記憶體狀態
   *
   * @param {Object} heapMetrics - 堆記憶體指標
   * @param {Object} systemMetrics - 系統記憶體指標
   * @returns {string} 記憶體狀態
   */
  determineMemoryStatus (heapMetrics, systemMetrics) {
    const heapUsage = heapMetrics.heapUsageRatio || 0
    const systemUsage = systemMetrics.usageRatio || 0

    if (heapUsage > 80 || systemUsage > 90) {
      return 'critical'
    } else if (heapUsage > 60 || systemUsage > 75) {
      return 'warning'
    } else {
      return 'normal'
    }
  }

  /**
   * 計算記憶體壓力
   *
   * @param {Object} heapMetrics - 堆記憶體指標
   * @param {Object} systemMetrics - 系統記憶體指標
   * @returns {number} 記憶體壓力分數 (0-100)
   */
  calculateMemoryPressure (heapMetrics, systemMetrics) {
    const heapPressure = heapMetrics.heapUsageRatio || 0
    const systemPressure = systemMetrics.usageRatio || 0
    return Math.round((heapPressure + systemPressure) / 2)
  }

  /**
   * 生成記憶體建議
   *
   * @param {Object} heapMetrics - 堆記憶體指標
   * @param {Object} systemMetrics - 系統記憶體指標
   * @returns {string} 記憶體優化建議
   */
  generateMemoryRecommendation (heapMetrics, systemMetrics) {
    const heapUsage = heapMetrics.heapUsageRatio || 0

    if (heapUsage > 80) {
      return '建議執行垃圾回收和記憶體清理'
    } else if (heapUsage > 60) {
      return '建議監控記憶體使用情況'
    } else {
      return '記憶體使用狀況良好'
    }
  }

  /**
   * 完成記憶體指標收集
   *
   * @param {Object} metrics - 記憶體指標
   * @param {number} startTime - 開始時間
   * @returns {Object} 最終記憶體指標
   */
  finalizeMemoryMetricsCollection (metrics, startTime) {
    const finalMetrics = {
      ...metrics,
      collectionDuration: this.performanceAPI.now() - startTime,
      collectionTimestamp: Date.now()
    }

    this.updateMemoryMetricsCache(finalMetrics)
    this.incrementCollectionCount()

    return finalMetrics
  }

  /**
   * 更新記憶體指標快取
   *
   * @param {Object} metrics - 記憶體指標
   */
  updateMemoryMetricsCache (metrics) {
    if (this.cache.enabled) {
      this.cache.memoryMetrics = metrics
      this.cache.lastUpdated.memory = Date.now()
    }
  }

  /**
   * 增加收集計數
   */
  incrementCollectionCount () {
    this.collectionState.collectionsCount += 1
  }

  /**
   * 收集 CPU 效能指標
   *
   * 需求：收集 CPU 使用率和處理器效能資訊
   * 設計：使用 Chrome System CPU API 和效能計時器
   *
   * @param {Object} options - 收集選項
   * @returns {Promise<Object>} CPU 效能指標
   */
  async collectCPUMetrics (options = {}) {
    this.validateCPUMetricsOptions(options)

    const cpuCollectionStart = this.recordCollectionStartTime()
    const processorInfo = await this.collectProcessorInformation()
    const usageMetrics = await this.collectCPUUsageMetrics()
    const performanceMetrics = this.collectCPUPerformanceMetrics()
    const consolidatedCPUMetrics = this.consolidateCPUMetrics(processorInfo, usageMetrics, performanceMetrics)

    return this.finalizeCPUMetricsCollection(consolidatedCPUMetrics, cpuCollectionStart)
  }

  /**
   * 驗證 CPU 指標收集選項
   *
   * @param {Object} options - 收集選項
   * @throws {Error} 選項無效時拋出錯誤
   */
  validateCPUMetricsOptions (options) {
    if (typeof options !== 'object' || options === null) {
      throw (() => {
        const code = ErrorCodes.VALIDATION_FAILED
        return new Error(`${code.code}: CPU 指標收集選項必須是有效的物件`)
      })()
    }
  }

  /**
   * 收集處理器資訊
   *
   * @returns {Promise<Object>} 處理器資訊
   */
  async collectProcessorInformation () {
    try {
      if (chrome?.system?.cpu) {
        const cpuInfo = await chrome.system.cpu.getInfo()
        return this.processProcessorInformation(cpuInfo)
      }

      return this.createEmptyProcessorInformation()
    } catch (error) {
      return this.handleProcessorInformationError(error)
    }
  }

  /**
   * 處理處理器資訊
   *
   * @param {Object} cpuInfo - Chrome CPU 資訊
   * @returns {Object} 處理後的處理器資訊
   */
  processProcessorInformation (cpuInfo) {
    return {
      processors: cpuInfo.processors || [],
      numOfProcessors: cpuInfo.numOfProcessors || 0,
      archName: cpuInfo.archName || 'unknown',
      modelName: cpuInfo.modelName || 'unknown',
      features: cpuInfo.features || []
    }
  }

  /**
   * 建立空的處理器資訊
   *
   * @returns {Object} 空的處理器資訊
   */
  createEmptyProcessorInformation () {
    return {
      processors: [],
      numOfProcessors: navigator.hardwareConcurrency || 0,
      archName: 'unknown',
      modelName: 'unknown',
      features: [],
      unavailable: true
    }
  }

  /**
   * 處理處理器資訊錯誤
   *
   * @param {Error} error - 錯誤物件
   * @returns {Object} 錯誤處理器資訊
   */
  handleProcessorInformationError (error) {
    return {
      error: error.message,
      processors: [],
      numOfProcessors: 0,
      archName: 'error',
      modelName: 'error',
      features: []
    }
  }

  /**
   * 收集 CPU 使用率指標
   *
   * @returns {Promise<Object>} CPU 使用率指標
   */
  async collectCPUUsageMetrics () {
    // Chrome Extension 環境下 CPU 使用率較難直接獲取
    // 使用替代方法估算負載
    return {
      estimatedUsage: this.estimateCPUUsage(),
      concurrency: navigator.hardwareConcurrency || 0,
      loadEstimate: 'unknown',
      method: 'estimated'
    }
  }

  /**
   * 估算 CPU 使用率
   *
   * @returns {number} 估算的 CPU 使用率
   */
  estimateCPUUsage () {
    // 簡化的 CPU 負載估算，實際環境可能需要更複雜的計算
    const startTime = this.performanceAPI.now()

    // 執行一些計算來測試響應時間
    let iterations = 0
    const endTime = startTime + 10 // 10ms 測試

    while (this.performanceAPI.now() < endTime) {
      iterations++
    }

    // 基於迭代次數估算負載（簡化邏輯）
    return Math.min(100, Math.max(0, 100 - (iterations / 1000)))
  }

  /**
   * 收集 CPU 效能指標
   *
   * @returns {Object} CPU 效能指標
   */
  collectCPUPerformanceMetrics () {
    return {
      timestamp: new Date().toISOString(),
      performanceNow: this.performanceAPI.now(),
      userTiming: this.collectUserTimingMetrics(),
      navigationTiming: this.collectNavigationTimingMetrics()
    }
  }

  /**
   * 收集使用者計時指標
   *
   * @returns {Object} 使用者計時指標
   */
  collectUserTimingMetrics () {
    try {
      const marks = performance.getEntriesByType('mark')
      const measures = performance.getEntriesByType('measure')

      return {
        marks: marks.length,
        measures: measures.length,
        latest: marks.length > 0 ? marks[marks.length - 1].name : null
      }
    } catch (error) {
      return {
        marks: 0,
        measures: 0,
        latest: null,
        error: error.message
      }
    }
  }

  /**
   * 收集導航計時指標
   *
   * @returns {Object} 導航計時指標
   */
  collectNavigationTimingMetrics () {
    if (!this.performanceAPI.timing) {
      return { unavailable: true }
    }

    return {
      navigationStart: this.performanceAPI.timing.navigationStart,
      loadEventEnd: this.performanceAPI.timing.loadEventEnd,
      domContentLoaded: this.performanceAPI.timing.domContentLoadedEventEnd,
      domComplete: this.performanceAPI.timing.domComplete
    }
  }

  /**
   * 整合 CPU 指標
   *
   * @param {Object} processorInfo - 處理器資訊
   * @param {Object} usageMetrics - 使用率指標
   * @param {Object} performanceMetrics - 效能指標
   * @returns {Object} 整合的 CPU 指標
   */
  consolidateCPUMetrics (processorInfo, usageMetrics, performanceMetrics) {
    return {
      timestamp: new Date().toISOString(),
      processor: processorInfo,
      usage: usageMetrics,
      performance: performanceMetrics,
      overall: this.calculateOverallCPUStatus(usageMetrics)
    }
  }

  /**
   * 計算整體 CPU 狀態
   *
   * @param {Object} usageMetrics - 使用率指標
   * @returns {Object} 整體 CPU 狀態
   */
  calculateOverallCPUStatus (usageMetrics) {
    const estimatedUsage = usageMetrics.estimatedUsage || 0

    return {
      status: estimatedUsage > 80 ? 'high' : estimatedUsage > 50 ? 'medium' : 'low',
      load: estimatedUsage,
      recommendation: this.generateCPURecommendation(estimatedUsage)
    }
  }

  /**
   * 生成 CPU 建議
   *
   * @param {number} usage - CPU 使用率
   * @returns {string} CPU 優化建議
   */
  generateCPURecommendation (usage) {
    if (usage > 80) {
      return '建議減少計算密集型操作'
    } else if (usage > 50) {
      return '建議監控 CPU 使用情況'
    } else {
      return 'CPU 使用狀況良好'
    }
  }

  /**
   * 完成 CPU 指標收集
   *
   * @param {Object} metrics - CPU 指標
   * @param {number} startTime - 開始時間
   * @returns {Object} 最終 CPU 指標
   */
  finalizeCPUMetricsCollection (metrics, startTime) {
    const finalMetrics = {
      ...metrics,
      collectionDuration: this.performanceAPI.now() - startTime,
      collectionTimestamp: Date.now()
    }

    this.updateCPUMetricsCache(finalMetrics)
    this.incrementCollectionCount()

    return finalMetrics
  }

  /**
   * 更新 CPU 指標快取
   *
   * @param {Object} metrics - CPU 指標
   */
  updateCPUMetricsCache (metrics) {
    if (this.cache.enabled) {
      this.cache.cpuMetrics = metrics
      this.cache.lastUpdated.cpu = Date.now()
    }
  }

  /**
   * 收集 IO 效能指標
   *
   * 需求：收集存儲讀寫和網路 IO 效能資訊
   * 設計：監控 API 調用延遲和存儲操作效能
   *
   * @param {Object} options - 收集選項
   * @returns {Promise<Object>} IO 效能指標
   */
  async collectIOMetrics (options = {}) {
    this.validateIOMetricsOptions(options)

    const ioCollectionStart = this.recordCollectionStartTime()
    const storageMetrics = await this.collectStorageIOMetrics()
    const networkMetrics = await this.collectNetworkIOMetrics()
    const apiMetrics = this.collectAPIPerformanceMetrics()
    const consolidatedIOMetrics = this.consolidateIOMetrics(storageMetrics, networkMetrics, apiMetrics)

    return this.finalizeIOMetricsCollection(consolidatedIOMetrics, ioCollectionStart)
  }

  /**
   * 驗證 IO 指標收集選項
   *
   * @param {Object} options - 收集選項
   * @throws {Error} 選項無效時拋出錯誤
   */
  validateIOMetricsOptions (options) {
    if (typeof options !== 'object' || options === null) {
      throw (() => {
        const code = ErrorCodes.VALIDATION_FAILED
        return new Error(`${code.code}: IO 指標收集選項必須是有效的物件`)
      })()
    }
  }

  /**
   * 收集存儲 IO 指標
   *
   * @returns {Promise<Object>} 存儲 IO 指標
   */
  async collectStorageIOMetrics () {
    const storageTestStart = this.performanceAPI.now()

    try {
      const storageOperations = await this.performStoragePerformanceTest()
      const storageTestDuration = this.performanceAPI.now() - storageTestStart

      return this.processStorageTestResults(storageOperations, storageTestDuration)
    } catch (error) {
      return this.handleStorageTestError(error)
    }
  }

  /**
   * 執行存儲效能測試
   *
   * @returns {Promise<Object>} 存儲操作結果
   */
  async performStoragePerformanceTest () {
    const testKey = 'performance_test_' + Date.now()
    const testData = { test: 'storage_performance', timestamp: Date.now() }

    // 測試 Chrome Storage API 效能
    if (chrome?.storage?.local) {
      return await this.testChromeStoragePerformance(testKey, testData)
    }

    // 回退到 localStorage 測試
    return this.testLocalStoragePerformance(testKey, testData)
  }

  /**
   * 測試 Chrome Storage 效能
   *
   * @param {string} testKey - 測試鍵
   * @param {Object} testData - 測試資料
   * @returns {Promise<Object>} 測試結果
   */
  async testChromeStoragePerformance (testKey, testData) {
    const writeStart = this.performanceAPI.now()
    await chrome.storage.local.set({ [testKey]: testData })
    const writeEnd = this.performanceAPI.now()

    const readStart = this.performanceAPI.now()
    await chrome.storage.local.get([testKey])
    const readEnd = this.performanceAPI.now()

    await chrome.storage.local.remove([testKey])

    return {
      writeLatency: writeEnd - writeStart,
      readLatency: readEnd - readStart,
      storageType: 'chrome.storage.local'
    }
  }

  /**
   * 測試 localStorage 效能
   *
   * @param {string} testKey - 測試鍵
   * @param {Object} testData - 測試資料
   * @returns {Object} 測試結果
   */
  testLocalStoragePerformance (testKey, testData) {
    const writeStart = this.performanceAPI.now()
    localStorage.setItem(testKey, JSON.stringify(testData))
    const writeEnd = this.performanceAPI.now()

    const readStart = this.performanceAPI.now()
    localStorage.getItem(testKey)
    const readEnd = this.performanceAPI.now()

    localStorage.removeItem(testKey)

    return {
      writeLatency: writeEnd - writeStart,
      readLatency: readEnd - readStart,
      storageType: 'localStorage'
    }
  }

  /**
   * 處理存儲測試結果
   *
   * @param {Object} operations - 存儲操作結果
   * @param {number} totalDuration - 總測試時間
   * @returns {Object} 處理後的存儲指標
   */
  processStorageTestResults (operations, totalDuration) {
    return {
      writeLatency: operations.writeLatency,
      readLatency: operations.readLatency,
      totalLatency: operations.writeLatency + operations.readLatency,
      storageType: operations.storageType,
      testDuration: totalDuration,
      performance: this.evaluateStoragePerformance(operations)
    }
  }

  /**
   * 評估存儲效能
   *
   * @param {Object} operations - 存儲操作結果
   * @returns {Object} 效能評估
   */
  evaluateStoragePerformance (operations) {
    const totalLatency = operations.writeLatency + operations.readLatency

    return {
      rating: totalLatency < 10 ? 'excellent' : totalLatency < 50 ? 'good' : 'poor',
      score: Math.max(0, Math.min(100, 100 - totalLatency)),
      recommendation: this.generateStorageRecommendation(totalLatency)
    }
  }

  /**
   * 生成存儲建議
   *
   * @param {number} latency - 延遲時間
   * @returns {string} 存儲優化建議
   */
  generateStorageRecommendation (latency) {
    if (latency > 50) {
      return '建議減少存儲操作頻率或使用批次處理'
    } else if (latency > 20) {
      return '建議監控存儲操作效能'
    } else {
      return '存儲操作效能良好'
    }
  }

  /**
   * 處理存儲測試錯誤
   *
   * @param {Error} error - 錯誤物件
   * @returns {Object} 錯誤存儲指標
   */
  handleStorageTestError (error) {
    return {
      error: error.message,
      writeLatency: 0,
      readLatency: 0,
      totalLatency: 0,
      storageType: 'error',
      testDuration: 0,
      performance: { rating: 'error', score: 0, recommendation: '存儲測試失敗' }
    }
  }

  /**
   * 收集網路 IO 指標
   *
   * @returns {Promise<Object>} 網路 IO 指標
   */
  async collectNetworkIOMetrics () {
    return {
      connectionType: this.getConnectionType(),
      onlineStatus: navigator.onLine,
      estimatedLatency: 'unknown',
      bandwidth: 'unknown',
      note: 'Extension 環境下網路指標收集受限'
    }
  }

  /**
   * 取得連線類型
   *
   * @returns {string} 連線類型
   */
  getConnectionType () {
    if (navigator.connection) {
      return navigator.connection.effectiveType || 'unknown'
    }
    return 'unknown'
  }

  /**
   * 收集 API 效能指標
   *
   * @returns {Object} API 效能指標
   */
  collectAPIPerformanceMetrics () {
    return {
      resourceTiming: this.collectResourceTimingMetrics(),
      userTiming: this.collectUserTimingMetrics(),
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 收集資源計時指標
   *
   * @returns {Object} 資源計時指標
   */
  collectResourceTimingMetrics () {
    try {
      const resources = performance.getEntriesByType('resource')

      return {
        totalResources: resources.length,
        averageLatency: this.calculateAverageResourceLatency(resources),
        slowestResource: this.findSlowestResource(resources)
      }
    } catch (error) {
      return {
        error: error.message,
        totalResources: 0,
        averageLatency: 0,
        slowestResource: null
      }
    }
  }

  /**
   * 計算平均資源延遲
   *
   * @param {Array} resources - 資源列表
   * @returns {number} 平均延遲
   */
  calculateAverageResourceLatency (resources) {
    if (resources.length === 0) return 0

    const totalLatency = resources.reduce((sum, resource) => {
      return sum + (resource.responseEnd - resource.requestStart)
    }, 0)

    return totalLatency / resources.length
  }

  /**
   * 找出最慢的資源
   *
   * @param {Array} resources - 資源列表
   * @returns {Object|null} 最慢的資源
   */
  findSlowestResource (resources) {
    if (resources.length === 0) return null

    return resources.reduce((slowest, resource) => {
      const resourceLatency = resource.responseEnd - resource.requestStart
      const slowestLatency = slowest.responseEnd - slowest.requestStart

      return resourceLatency > slowestLatency ? resource : slowest
    })
  }

  /**
   * 整合 IO 指標
   *
   * @param {Object} storageMetrics - 存儲指標
   * @param {Object} networkMetrics - 網路指標
   * @param {Object} apiMetrics - API 指標
   * @returns {Object} 整合的 IO 指標
   */
  consolidateIOMetrics (storageMetrics, networkMetrics, apiMetrics) {
    return {
      timestamp: new Date().toISOString(),
      storage: storageMetrics,
      network: networkMetrics,
      api: apiMetrics,
      overall: this.calculateOverallIOStatus(storageMetrics, networkMetrics)
    }
  }

  /**
   * 計算整體 IO 狀態
   *
   * @param {Object} storageMetrics - 存儲指標
   * @param {Object} networkMetrics - 網路指標
   * @returns {Object} 整體 IO 狀態
   */
  calculateOverallIOStatus (storageMetrics, networkMetrics) {
    const storageScore = storageMetrics.performance?.score || 0

    return {
      status: storageScore > 80 ? 'good' : storageScore > 50 ? 'fair' : 'poor',
      score: storageScore,
      recommendation: this.generateIORecommendation(storageScore)
    }
  }

  /**
   * 生成 IO 建議
   *
   * @param {number} score - IO 分數
   * @returns {string} IO 優化建議
   */
  generateIORecommendation (score) {
    if (score < 50) {
      return '建議優化存儲和網路操作'
    } else if (score < 80) {
      return '建議監控 IO 操作效能'
    } else {
      return 'IO 操作效能良好'
    }
  }

  /**
   * 完成 IO 指標收集
   *
   * @param {Object} metrics - IO 指標
   * @param {number} startTime - 開始時間
   * @returns {Object} 最終 IO 指標
   */
  finalizeIOMetricsCollection (metrics, startTime) {
    const finalMetrics = {
      ...metrics,
      collectionDuration: this.performanceAPI.now() - startTime,
      collectionTimestamp: Date.now()
    }

    this.updateIOMetricsCache(finalMetrics)
    this.incrementCollectionCount()

    return finalMetrics
  }

  /**
   * 更新 IO 指標快取
   *
   * @param {Object} metrics - IO 指標
   */
  updateIOMetricsCache (metrics) {
    if (this.cache.enabled) {
      this.cache.ioMetrics = metrics
      this.cache.lastUpdated.io = Date.now()
    }
  }

  /**
   * 收集 Extension 專用效能指標
   *
   * 需求：收集 Chrome Extension 特有的效能指標
   * 設計：監控 Extension 啟動、腳本載入和 API 調用效能
   *
   * @param {Object} options - 收集選項
   * @returns {Promise<Object>} Extension 效能指標
   */
  async collectExtensionMetrics (options = {}) {
    this.validateExtensionMetricsOptions(options)

    const extensionCollectionStart = this.recordCollectionStartTime()
    const manifestInfo = this.collectManifestInformation()
    const startupMetrics = this.collectStartupMetrics()
    const apiMetrics = await this.collectExtensionAPIMetrics()
    const scriptMetrics = this.collectScriptLoadingMetrics()
    const consolidatedExtensionMetrics = this.consolidateExtensionMetrics(manifestInfo, startupMetrics, apiMetrics, scriptMetrics)

    return this.finalizeExtensionMetricsCollection(consolidatedExtensionMetrics, extensionCollectionStart)
  }

  /**
   * 驗證 Extension 指標收集選項
   *
   * @param {Object} options - 收集選項
   * @throws {Error} 選項無效時拋出錯誤
   */
  validateExtensionMetricsOptions (options) {
    if (typeof options !== 'object' || options === null) {
      throw (() => {
        const code = ErrorCodes.VALIDATION_FAILED
        return new Error(`${code.code}: Extension 指標收集選項必須是有效的物件`)
      })()
    }
  }

  /**
   * 收集 Manifest 資訊
   *
   * @returns {Object} Manifest 資訊
   */
  collectManifestInformation () {
    try {
      const manifest = chrome?.runtime?.getManifest() || {}

      return {
        version: manifest.version || 'unknown',
        manifestVersion: manifest.manifest_version || 2,
        name: manifest.name || 'unknown',
        permissions: manifest.permissions || [],
        contentScripts: manifest.content_scripts || [],
        background: manifest.background || {}
      }
    } catch (error) {
      return {
        error: error.message,
        version: 'error',
        manifestVersion: 'error',
        name: 'error',
        permissions: [],
        contentScripts: [],
        background: {}
      }
    }
  }

  /**
   * 收集啟動指標
   *
   * @returns {Object} 啟動指標
   */
  collectStartupMetrics () {
    return {
      startupTime: this.estimateStartupTime(),
      loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
      domContentLoadedTime: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
      readyState: document.readyState,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 估算啟動時間
   *
   * @returns {number} 估算的啟動時間
   */
  estimateStartupTime () {
    // 簡化的啟動時間估算
    return performance.timing.loadEventEnd - performance.timing.fetchStart
  }

  /**
   * 收集 Extension API 指標
   *
   * @returns {Promise<Object>} Extension API 指標
   */
  async collectExtensionAPIMetrics () {
    const apiTestResults = {}

    // 測試各種 Chrome Extension API 的響應時間
    apiTestResults.runtime = await this.testRuntimeAPI()
    apiTestResults.storage = await this.testStorageAPI()
    apiTestResults.tabs = await this.testTabsAPI()

    return {
      tested: Object.keys(apiTestResults),
      results: apiTestResults,
      overall: this.evaluateExtensionAPIPerformance(apiTestResults)
    }
  }

  /**
   * 測試 Runtime API
   *
   * @returns {Promise<Object>} Runtime API 測試結果
   */
  async testRuntimeAPI () {
    try {
      const start = this.performanceAPI.now()
      const manifest = chrome?.runtime?.getManifest()
      const end = this.performanceAPI.now()

      return {
        available: !!chrome?.runtime,
        latency: end - start,
        manifestAccess: !!manifest,
        status: 'success'
      }
    } catch (error) {
      return {
        available: false,
        latency: 0,
        manifestAccess: false,
        status: 'error',
        error: error.message
      }
    }
  }

  /**
   * 測試 Storage API
   *
   * @returns {Promise<Object>} Storage API 測試結果
   */
  async testStorageAPI () {
    try {
      const start = this.performanceAPI.now()

      if (chrome?.storage?.local) {
        await chrome.storage.local.get(['test'])
        const end = this.performanceAPI.now()

        return {
          available: true,
          latency: end - start,
          status: 'success'
        }
      }

      return {
        available: false,
        latency: 0,
        status: 'unavailable'
      }
    } catch (error) {
      return {
        available: false,
        latency: 0,
        status: 'error',
        error: error.message
      }
    }
  }

  /**
   * 測試 Tabs API
   *
   * @returns {Promise<Object>} Tabs API 測試結果
   */
  async testTabsAPI () {
    try {
      const start = this.performanceAPI.now()

      if (chrome?.tabs?.query) {
        await chrome.tabs.query({ active: true, currentWindow: true })
        const end = this.performanceAPI.now()

        return {
          available: true,
          latency: end - start,
          status: 'success'
        }
      }

      return {
        available: false,
        latency: 0,
        status: 'unavailable'
      }
    } catch (error) {
      return {
        available: false,
        latency: 0,
        status: 'error',
        error: error.message
      }
    }
  }

  /**
   * 評估 Extension API 效能
   *
   * @param {Object} apiResults - API 測試結果
   * @returns {Object} API 效能評估
   */
  evaluateExtensionAPIPerformance (apiResults) {
    const availableAPIs = Object.values(apiResults).filter(result => result.available).length
    const totalAPIs = Object.keys(apiResults).length
    const averageLatency = this.calculateAverageAPILatency(apiResults)

    return {
      availabilityRatio: totalAPIs > 0 ? (availableAPIs / totalAPIs) * 100 : 0,
      averageLatency,
      score: this.calculateAPIScore(availableAPIs, totalAPIs, averageLatency),
      recommendation: this.generateAPIRecommendation(averageLatency)
    }
  }

  /**
   * 計算平均 API 延遲
   *
   * @param {Object} apiResults - API 測試結果
   * @returns {number} 平均延遲
   */
  calculateAverageAPILatency (apiResults) {
    const latencies = Object.values(apiResults)
      .filter(result => result.available && typeof result.latency === 'number')
      .map(result => result.latency)

    return latencies.length > 0 ? latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length : 0
  }

  /**
   * 計算 API 分數
   *
   * @param {number} availableAPIs - 可用 API 數量
   * @param {number} totalAPIs - 總 API 數量
   * @param {number} averageLatency - 平均延遲
   * @returns {number} API 分數
   */
  calculateAPIScore (availableAPIs, totalAPIs, averageLatency) {
    const availabilityScore = totalAPIs > 0 ? (availableAPIs / totalAPIs) * 50 : 0
    const latencyScore = Math.max(0, 50 - averageLatency)

    return Math.round(availabilityScore + latencyScore)
  }

  /**
   * 生成 API 建議
   *
   * @param {number} averageLatency - 平均延遲
   * @returns {string} API 優化建議
   */
  generateAPIRecommendation (averageLatency) {
    if (averageLatency > 20) {
      return '建議減少 Extension API 調用頻率'
    } else if (averageLatency > 10) {
      return '建議監控 Extension API 效能'
    } else {
      return 'Extension API 效能良好'
    }
  }

  /**
   * 收集腳本載入指標
   *
   * @returns {Object} 腳本載入指標
   */
  collectScriptLoadingMetrics () {
    try {
      const scripts = document.querySelectorAll('script')
      const totalScripts = scripts.length

      return {
        totalScripts,
        loadedScripts: this.countLoadedScripts(scripts),
        loadingTime: this.estimateScriptLoadingTime(),
        performance: this.evaluateScriptLoadingPerformance(totalScripts)
      }
    } catch (error) {
      return {
        error: error.message,
        totalScripts: 0,
        loadedScripts: 0,
        loadingTime: 0,
        performance: { score: 0, recommendation: '腳本載入評估失敗' }
      }
    }
  }

  /**
   * 計算已載入的腳本數量
   *
   * @param {NodeList} scripts - 腳本元素列表
   * @returns {number} 已載入的腳本數量
   */
  countLoadedScripts (scripts) {
    return Array.from(scripts).filter(script => {
      return !script.async && !script.defer
    }).length
  }

  /**
   * 估算腳本載入時間
   *
   * @returns {number} 估算的載入時間
   */
  estimateScriptLoadingTime () {
    return performance.timing.domContentLoadedEventEnd - performance.timing.domLoading
  }

  /**
   * 評估腳本載入效能
   *
   * @param {number} totalScripts - 總腳本數量
   * @returns {Object} 腳本載入效能評估
   */
  evaluateScriptLoadingPerformance (totalScripts) {
    const score = Math.max(0, Math.min(100, 100 - totalScripts * 2))

    return {
      score,
      recommendation: this.generateScriptLoadingRecommendation(totalScripts)
    }
  }

  /**
   * 生成腳本載入建議
   *
   * @param {number} totalScripts - 總腳本數量
   * @returns {string} 腳本載入優化建議
   */
  generateScriptLoadingRecommendation (totalScripts) {
    if (totalScripts > 20) {
      return '建議減少腳本數量或使用懶載入'
    } else if (totalScripts > 10) {
      return '建議監控腳本載入效能'
    } else {
      return '腳本載入效能良好'
    }
  }

  /**
   * 整合 Extension 指標
   *
   * @param {Object} manifestInfo - Manifest 資訊
   * @param {Object} startupMetrics - 啟動指標
   * @param {Object} apiMetrics - API 指標
   * @param {Object} scriptMetrics - 腳本指標
   * @returns {Object} 整合的 Extension 指標
   */
  consolidateExtensionMetrics (manifestInfo, startupMetrics, apiMetrics, scriptMetrics) {
    return {
      timestamp: new Date().toISOString(),
      manifest: manifestInfo,
      startup: startupMetrics,
      api: apiMetrics,
      scripts: scriptMetrics,
      overall: this.calculateOverallExtensionStatus(startupMetrics, apiMetrics, scriptMetrics)
    }
  }

  /**
   * 計算整體 Extension 狀態
   *
   * @param {Object} startupMetrics - 啟動指標
   * @param {Object} apiMetrics - API 指標
   * @param {Object} scriptMetrics - 腳本指標
   * @returns {Object} 整體 Extension 狀態
   */
  calculateOverallExtensionStatus (startupMetrics, apiMetrics, scriptMetrics) {
    const startupScore = Math.max(0, Math.min(100, 100 - (startupMetrics.startupTime / 10)))
    const apiScore = apiMetrics.overall?.score || 0
    const scriptScore = scriptMetrics.performance?.score || 0

    const overallScore = Math.round((startupScore + apiScore + scriptScore) / 3)

    return {
      score: overallScore,
      status: overallScore > 80 ? 'excellent' : overallScore > 60 ? 'good' : 'poor',
      recommendation: this.generateExtensionRecommendation(overallScore)
    }
  }

  /**
   * 生成 Extension 建議
   *
   * @param {number} score - Extension 分數
   * @returns {string} Extension 優化建議
   */
  generateExtensionRecommendation (score) {
    if (score < 60) {
      return '建議優化 Extension 啟動和 API 使用'
    } else if (score < 80) {
      return '建議監控 Extension 效能表現'
    } else {
      return 'Extension 效能表現良好'
    }
  }

  /**
   * 完成 Extension 指標收集
   *
   * @param {Object} metrics - Extension 指標
   * @param {number} startTime - 開始時間
   * @returns {Object} 最終 Extension 指標
   */
  finalizeExtensionMetricsCollection (metrics, startTime) {
    const finalMetrics = {
      ...metrics,
      collectionDuration: this.performanceAPI.now() - startTime,
      collectionTimestamp: Date.now()
    }

    this.updateExtensionMetricsCache(finalMetrics)
    this.incrementCollectionCount()

    return finalMetrics
  }

  /**
   * 更新 Extension 指標快取
   *
   * @param {Object} metrics - Extension 指標
   */
  updateExtensionMetricsCache (metrics) {
    if (this.cache.enabled) {
      this.cache.extensionMetrics = metrics
      this.cache.lastUpdated.extension = Date.now()
    }
  }
}

module.exports = MetricsCollector
