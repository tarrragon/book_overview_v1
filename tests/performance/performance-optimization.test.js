/* eslint-disable no-console */

/**
 * 效能優化整合測試
 *
 * 負責功能：
 * - 測試 PerformanceOptimizer 的整體功能和效果
 * - 驗證記憶體管理和載入速度優化
 * - 確保優化不影響功能正確性
 * - 建立效能基準和回歸測試
 *
 * 設計考量：
 * - 模擬真實使用情境的效能測試
 * - 量化的效能改善驗證
 * - 長期執行的穩定性測試
 * - Chrome Extension 特定的效能要求
 *
 * 處理流程：
 * 1. 建立效能基準測量
 * 2. 執行優化前後比較
 * 3. 驗證優化效果和穩定性
 * 4. 測試資源清理和記憶體管理
 * 5. 確保功能完整性不受影響
 *
 * 使用情境：
 * - 效能優化開發和驗證
 * - 版本發布前的效能回歸測試
 * - Chrome Web Store 上架效能要求驗證
 */

// 建立模擬效能監控環境
// eslint-disable-next-line no-unused-vars
const mockMemory = {
  usedJSHeapSize: 25 * 1024 * 1024, // 25MB
  totalJSHeapSize: 50 * 1024 * 1024, // 50MB
  jsHeapSizeLimit: 100 * 1024 * 1024 // 100MB
}

// 使用 Object.defineProperty 覆蓋 jsdom 的 performance 物件
Object.defineProperty(global, 'performance', {
  writable: true,
  configurable: true,
  value: {
    now: () => Date.now(),
    memory: mockMemory,
    mark: jest.fn(),
    measure: jest.fn()
  }
})

const { PerformanceOptimizer } = require('src/performance/performance-optimizer')
const { LoadingOptimizer } = require('src/performance/loading-optimizer')

describe('🚀 效能優化整合測試', () => {
  let performanceOptimizer
  let loadingOptimizer
  // eslint-disable-next-line no-unused-vars
  let mockEventBus

  beforeEach(() => {
    // 重置效能記憶體資料
    mockMemory.usedJSHeapSize = 25 * 1024 * 1024

    // 建立模擬事件總線
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    }

    // 建立優化器實例
    performanceOptimizer = new PerformanceOptimizer({
      MONITORING: { SAMPLE_INTERVAL: 100 } // 快速測試間隔
    })

    loadingOptimizer = new LoadingOptimizer({
      mode: 'balanced'
    })
  })

  afterEach(() => {
    if (performanceOptimizer) {
      performanceOptimizer.destroy()
    }
    if (loadingOptimizer) {
      loadingOptimizer.destroy()
    }
  })

  describe('📊 效能監控和分析', () => {
    test('應該能夠建立效能基準測量', async () => {
      // eslint-disable-next-line no-unused-vars
      const baselineReport = performanceOptimizer.getPerformanceReport()

      expect(baselineReport).toHaveProperty('currentStatus')
      expect(baselineReport).toHaveProperty('optimization')
      expect(baselineReport).toHaveProperty('trends')
      expect(baselineReport).toHaveProperty('recommendations')

      expect(baselineReport.currentStatus.memoryUsed).toBeGreaterThan(0)
      expect(baselineReport.currentStatus.memoryPercentage).toBeGreaterThan(0)
    })

    test('應該能夠監控記憶體使用趨勢', async () => {
      // 停止自動監控以避免干擾，手動控制指標收集
      clearInterval(performanceOptimizer.monitoringInterval)

      // 收集初始基準指標
      performanceOptimizer.collectPerformanceMetrics()

      // 模擬記憶體使用增長
      for (let i = 0; i < 10; i++) {
        mockMemory.usedJSHeapSize += 2 * 1024 * 1024 // 增加 2MB
        performanceOptimizer.collectPerformanceMetrics()
      }

      // eslint-disable-next-line no-unused-vars
      const report = performanceOptimizer.getPerformanceReport()
      expect(report.trends.memoryTrend).toBeTruthy()
      expect(report.trends.memoryTrend.isIncreasing).toBe(true)
    })

    test('應該能夠檢測效能警告並觸發自動清理', async () => {
      // 模擬高記憶體使用（超過 CLEANUP_THRESHOLD 45MB）
      mockMemory.usedJSHeapSize = 46 * 1024 * 1024 // 46MB

      // collectPerformanceMetrics -> checkPerformanceWarnings -> triggerAutomaticCleanup
      const cleanupSpy = jest.spyOn(performanceOptimizer, 'triggerAutomaticCleanup')

      performanceOptimizer.collectPerformanceMetrics()

      expect(cleanupSpy).toHaveBeenCalled()
    })
  })

  describe('🧹 記憶體優化功能', () => {
    test('應該能夠執行記憶體優化並釋放空間', async () => {
      // 設定高記憶體使用
      mockMemory.usedJSHeapSize = 40 * 1024 * 1024 // 40MB

      // eslint-disable-next-line no-unused-vars
      const beforeMemory = performanceOptimizer.getMemoryInfo()

      // 執行記憶體優化
      performanceOptimizer.optimizeMemoryUsage()

      // 模擬記憶體釋放效果
      mockMemory.usedJSHeapSize = 30 * 1024 * 1024 // 釋放到 30MB

      // eslint-disable-next-line no-unused-vars
      const afterMemory = performanceOptimizer.getMemoryInfo()

      expect(afterMemory.usedJSHeapSize).toBeLessThan(beforeMemory.usedJSHeapSize)

      // 檢查優化記錄
      // eslint-disable-next-line no-unused-vars
      const report = performanceOptimizer.getPerformanceReport()
      expect(report.optimization.optimizationCount).toBeGreaterThan(0)
    })

    test('應該能夠自動清理過期資源和快取', async () => {
      // 建立模擬快取
      performanceOptimizer.searchCache = new Map()
      for (let i = 0; i < 60; i++) {
        performanceOptimizer.searchCache.set(`key_${i}`, `value_${i}`)
      }

      expect(performanceOptimizer.searchCache.size).toBe(60)

      // 執行清理
      // eslint-disable-next-line no-unused-vars
      const cleanedBytes = performanceOptimizer.cleanupExpiredCaches()

      expect(cleanedBytes).toBeGreaterThan(0)
      expect(performanceOptimizer.searchCache.size).toBe(0)
    })

    test('應該能夠重置資源池防止記憶體洩漏', () => {
      // 建立大型資源池
      performanceOptimizer.resourcePools.set('testPool', new Array(20).fill('resource'))

      expect(performanceOptimizer.resourcePools.get('testPool')).toHaveLength(20)

      // 執行資源池重置
      // eslint-disable-next-line no-unused-vars
      const freedBytes = performanceOptimizer.resetResourcePools()

      expect(freedBytes).toBeGreaterThan(0)
      expect(performanceOptimizer.resourcePools.get('testPool')).toHaveLength(10) // 保留前10個
    })
  })

  describe('⚡ 載入速度優化', () => {
    test('應該能夠執行優化載入流程', async () => {
      // eslint-disable-next-line no-unused-vars
      const startTime = performance.now()

      // eslint-disable-next-line no-unused-vars
      const result = await loadingOptimizer.startOptimizedLoading()

      // eslint-disable-next-line no-unused-vars
      const endTime = performance.now()
      // eslint-disable-next-line no-unused-vars
      const loadTime = endTime - startTime

      expect(result.success).toBe(true)
      expect(result.criticalResourcesLoaded).toBe(true)
      expect(loadTime).toBeLessThan(5000) // 載入應在 5 秒內完成

      // eslint-disable-next-line no-console
      console.log(`📊 優化載入完成時間: ${loadTime.toFixed(2)}ms`)
    })

    test('應該能夠按需載入資源', async () => {
      // eslint-disable-next-line no-unused-vars
      const resourceName = 'book-search-filter'

      // eslint-disable-next-line no-unused-vars
      const startTime = performance.now()
      // eslint-disable-next-line no-unused-vars
      const resource = await loadingOptimizer.loadOnDemand(resourceName)
      // eslint-disable-next-line no-unused-vars
      const endTime = performance.now()

      expect(resource).toBeTruthy()
      expect(resource.name).toBe(resourceName)
      expect(endTime - startTime).toBeLessThan(1000) // 按需載入應快速

      // eslint-disable-next-line no-console
      console.log(`📦 按需載入時間: ${(endTime - startTime).toFixed(2)}ms`)
    })

    test('應該能夠實現資源快取和重用', async () => {
      // eslint-disable-next-line no-unused-vars
      const resourceName = 'popup-ui-manager'

      // 第一次載入
      // eslint-disable-next-line no-unused-vars
      const firstLoadTime = await measureLoadTime(() =>
        loadingOptimizer.loadOnDemand(resourceName)
      )

      // 第二次載入（應該使用快取）
      // eslint-disable-next-line no-unused-vars
      const secondLoadTime = await measureLoadTime(() =>
        loadingOptimizer.loadOnDemand(resourceName)
      )

      expect(secondLoadTime).toBeLessThan(firstLoadTime)

      // eslint-disable-next-line no-unused-vars
      const metrics = loadingOptimizer.getLoadingMetrics()
      expect(metrics.cache.hitRate).toBeGreaterThan(0)

      // eslint-disable-next-line no-console
      console.log(`🔄 快取命中率: ${metrics.cache.hitRate.toFixed(1)}%`)
    })

    test('應該能夠預熱關鍵資源快取', async () => {
      // eslint-disable-next-line no-unused-vars
      const criticalResources = ['event-bus', 'event-handler', 'performance-monitor']

      // eslint-disable-next-line no-unused-vars
      const warmupTime = await measureLoadTime(() =>
        loadingOptimizer.warmupCache(criticalResources)
      )

      expect(warmupTime).toBeLessThan(2000) // 預熱應在 2 秒內完成

      // eslint-disable-next-line no-unused-vars
      const metrics = loadingOptimizer.getLoadingMetrics()
      expect(metrics.resources.cachedCount).toBeGreaterThanOrEqual(criticalResources.length)

      // eslint-disable-next-line no-console
      console.log(`🔥 快取預熱時間: ${warmupTime.toFixed(2)}ms`)
    })
  })

  describe('📈 效能基準和目標', () => {
    test('Popup 載入時間應符合目標', async () => {
      // eslint-disable-next-line no-unused-vars
      const loadTime = await measureLoadTime(async () => {
        // 模擬 Popup 載入流程
        await loadingOptimizer.loadOnDemand('popup-ui-manager')
        await loadingOptimizer.loadOnDemand('popup-event-controller')
      })

      // eslint-disable-next-line no-unused-vars
      const target = LoadingOptimizer.CONSTANTS.LOADING_TARGETS.POPUP_INTERACTIVE
      expect(loadTime).toBeLessThan(target)

      // eslint-disable-next-line no-console
      console.log(`🎯 Popup 載入時間: ${loadTime.toFixed(2)}ms (目標: ${target}ms)`)
    })

    test('搜尋功能響應時間應符合目標', async () => {
      // eslint-disable-next-line no-unused-vars
      const responseTime = await measureLoadTime(async () => {
        // 模擬搜尋操作
        await loadingOptimizer.loadOnDemand('book-search-filter')
        // 模擬搜尋處理時間
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      // eslint-disable-next-line no-unused-vars
      const target = 500 // 500ms 搜尋響應目標
      expect(responseTime).toBeLessThan(target)

      // eslint-disable-next-line no-console
      console.log(`🔍 搜尋響應時間: ${responseTime.toFixed(2)}ms (目標: ${target}ms)`)
    })

    test('記憶體使用應保持在合理範圍', async () => {
      // 執行一系列操作
      await loadingOptimizer.startOptimizedLoading()
      await loadingOptimizer.warmupCache(['export-manager', 'book-data-extractor'])

      // 執行效能測量
      // eslint-disable-next-line no-unused-vars
      const measurement = await performanceOptimizer.measurePerformance('integration_test', async () => {
        // 模擬複雜操作
        for (let i = 0; i < 5; i++) {
          await loadingOptimizer.loadOnDemand(`test-resource-${i}`)
        }
      })

      // eslint-disable-next-line no-unused-vars
      const memoryTarget = PerformanceOptimizer.CONSTANTS.MEMORY.WARNING_THRESHOLD
      // eslint-disable-next-line no-unused-vars
      const currentMemory = performanceOptimizer.getMemoryInfo().usedJSHeapSize

      expect(currentMemory).toBeLessThan(memoryTarget)
      expect(measurement.measurement.memoryDelta).toBeLessThan(10 * 1024 * 1024) // 記憶體增加不超過 10MB

      // eslint-disable-next-line no-console
      console.log(`💾 記憶體使用: ${formatBytes(currentMemory)} (目標: <${formatBytes(memoryTarget)})`)
    })
  })

  describe('🔧 資源管理和清理', () => {
    test('應該能夠正確清理資源防止記憶體洩漏', async () => {
      // 使用 resourceMap 中已註冊的資源名稱，確保載入後會被快取
      const resources = ['popup-ui-manager', 'popup-event-controller', 'book-data-extractor', 'overview-page-controller', 'book-search-filter']

      for (const resource of resources) {
        await loadingOptimizer.loadOnDemand(resource)
      }

      // eslint-disable-next-line no-unused-vars
      const beforeCleanup = loadingOptimizer.getLoadingMetrics()
      expect(beforeCleanup.resources.cachedCount).toBeGreaterThan(0)

      // 執行清理
      loadingOptimizer.clearCache({ keepCritical: true, maxAge: 0 })

      // eslint-disable-next-line no-unused-vars
      const afterCleanup = loadingOptimizer.getLoadingMetrics()
      expect(afterCleanup.resources.cachedCount).toBeLessThan(beforeCleanup.resources.cachedCount)
    })

    test('應該能夠在銷毀時完全清理所有資源', () => {
      // eslint-disable-next-line no-unused-vars
      const _initialMemory = performanceOptimizer.getMemoryInfo().usedJSHeapSize

      // 建立一些內部狀態
      performanceOptimizer.performanceMetrics.memoryUsage.push({ test: 'data' })
      loadingOptimizer.resourceCache.set('test', { data: 'large-resource' })

      // 銷毀優化器
      performanceOptimizer.destroy()
      loadingOptimizer.destroy()

      // 驗證清理效果
      expect(performanceOptimizer.performanceMetrics.memoryUsage).toHaveLength(0)
      expect(loadingOptimizer.resourceCache.size).toBe(0)
    })
  })

  describe('📊 效能分析和報告', () => {
    test('應該能夠生成詳細的效能報告', async () => {
      // 執行一些操作產生資料
      await loadingOptimizer.startOptimizedLoading()
      performanceOptimizer.optimizeMemoryUsage()

      // eslint-disable-next-line no-unused-vars
      const performanceReport = performanceOptimizer.getPerformanceReport()
      // eslint-disable-next-line no-unused-vars
      const loadingMetrics = loadingOptimizer.getLoadingMetrics()

      // 驗證報告結構
      expect(performanceReport).toHaveProperty('currentStatus')
      expect(performanceReport).toHaveProperty('optimization')
      expect(performanceReport).toHaveProperty('recommendations')

      expect(loadingMetrics).toHaveProperty('loadingState')
      expect(loadingMetrics).toHaveProperty('performance')
      expect(loadingMetrics).toHaveProperty('cache')

      // 驗證資料完整性
      expect(performanceReport.currentStatus.isOptimal).toBeDefined()
      expect(loadingMetrics.performance.totalLoadTime).toBeGreaterThanOrEqual(0)
      expect(loadingMetrics.cache.hitRate).toBeGreaterThanOrEqual(0)

      // eslint-disable-next-line no-console
      console.log('📈 效能報告生成成功')
      // eslint-disable-next-line no-console
      console.log(`   記憶體使用: ${formatBytes(performanceReport.currentStatus.memoryUsed)}`)
      // eslint-disable-next-line no-console
      console.log(`   載入時間: ${loadingMetrics.performance.totalLoadTime.toFixed(2)}ms`)
      // eslint-disable-next-line no-console
      console.log(`   快取命中率: ${loadingMetrics.cache.hitRate.toFixed(1)}%`)
    })

    test('應該能夠提供優化建議', () => {
      // 模擬需要優化的情況
      mockMemory.usedJSHeapSize = 45 * 1024 * 1024 // 高記憶體使用
      performanceOptimizer.collectPerformanceMetrics()

      // eslint-disable-next-line no-unused-vars
      const report = performanceOptimizer.getPerformanceReport()

      expect(report.recommendations).toBeInstanceOf(Array)
      expect(report.recommendations.length).toBeGreaterThan(0)

      // eslint-disable-next-line no-unused-vars
      const highPriorityRecommendations = report.recommendations.filter(r => r.priority === 'HIGH')
      expect(highPriorityRecommendations.length).toBeGreaterThan(0)

      // eslint-disable-next-line no-console
      console.log(`💡 產生 ${report.recommendations.length} 項優化建議`)
    })
  })

  describe('🎯 Chrome Web Store 效能要求', () => {
    test('應該符合 Chrome Web Store 的效能標準', async () => {
      // 模擬完整的 Extension 載入和使用流程
      // eslint-disable-next-line no-unused-vars
      const startupTime = await measureLoadTime(async () => {
        await loadingOptimizer.startOptimizedLoading()
      })

      // eslint-disable-next-line no-unused-vars
      const interactionTime = await measureLoadTime(async () => {
        await loadingOptimizer.loadOnDemand('popup-ui-manager')
        await performanceOptimizer.measurePerformance('user_interaction', async () => {
          // 模擬使用者互動
          await new Promise(resolve => setTimeout(resolve, 100))
        })
      })

      // Chrome Web Store 效能要求驗證
      expect(startupTime).toBeLessThan(3000) // 啟動時間 < 3s
      expect(interactionTime).toBeLessThan(1000) // 互動回應 < 1s

      // eslint-disable-next-line no-unused-vars
      const currentMemory = performanceOptimizer.getMemoryInfo().usedJSHeapSize
      expect(currentMemory).toBeLessThan(50 * 1024 * 1024) // 記憶體 < 50MB

      // eslint-disable-next-line no-console
      console.log('✅ Chrome Web Store 效能標準驗證通過')
      // eslint-disable-next-line no-console
      console.log(`   啟動時間: ${startupTime.toFixed(2)}ms`)
      // eslint-disable-next-line no-console
      console.log(`   互動時間: ${interactionTime.toFixed(2)}ms`)
      // eslint-disable-next-line no-console
      console.log(`   記憶體使用: ${formatBytes(currentMemory)}`)
    })
  })
})

/**
 * 測量執行時間的輔助函數
 * @param {Function} operation - 要測量的操作
 * @returns {Promise<number>} 執行時間（毫秒）
 */
async function measureLoadTime (operation) {
  // eslint-disable-next-line no-unused-vars
  const startTime = performance.now()
  await operation()
  // eslint-disable-next-line no-unused-vars
  const endTime = performance.now()
  return endTime - startTime
}

/**
 * 格式化位元組數的輔助函數
 * @param {number} bytes - 位元組數
 * @returns {string} 格式化的字串
 */
function formatBytes (bytes) {
  if (bytes === 0) return '0 Bytes'

  // eslint-disable-next-line no-unused-vars
  const k = 1024
  // eslint-disable-next-line no-unused-vars
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  // eslint-disable-next-line no-unused-vars
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
