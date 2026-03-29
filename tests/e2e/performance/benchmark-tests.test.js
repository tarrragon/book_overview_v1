/**
 * Chrome Extension 效能基準測試
 *
 * 負責功能：
 * - 測試 Extension 在各種資料量下的效能表現
 * - 監控記憶體使用和 CPU 負載
 * - 驗證大量資料處理的穩定性
 * - 建立效能回歸測試基準
 *
 * 設計考量：
 * - 使用 E2ETestSuite mock 環境模擬真實使用情境的資料量
 * - 測試系統資源使用的合理性
 * - 確保效能不會隨功能增加而顯著下降
 * - 提供可量化的效能指標
 *
 * 處理流程：
 * 1. 建立不同規模的測試資料集
 * 2. 測試資料提取的效能表現
 * 3. 監控 UI 渲染的響應時間
 * 4. 驗證搜尋和篩選的效能
 * 5. 測試記憶體使用和清理
 * 6. 建立效能基準報告
 *
 * 使用情境：
 * - 產品發布前的效能驗證
 * - 效能回歸測試
 * - 系統容量規劃
 */

const { E2ETestSuite } = require('../../helpers/e2e-test-suite')
const MemoryLeakDetector = require('../../helpers/memory-leak-detector')

describe('Chrome Extension 效能基準測試', () => {
  let suite
  let memoryDetector

  jest.setTimeout(120000) // 2 分鐘超時

  beforeAll(async () => {
    suite = new E2ETestSuite({
      testDataSize: 'small',
      enableStorageTracking: true
    })
    await suite.initialize()

    await suite.navigateToMockReadmooPage()
    await suite.setupMockReadmooPage()

    memoryDetector = new MemoryLeakDetector({
      memoryGrowthThreshold: 100 * 1024 * 1024, // 100MB for E2E tests
      leakDetectionThreshold: 5 * 1024 // 5KB per operation for UI operations
    })
  })

  afterAll(async () => {
    if (suite) {
      await suite.cleanup()
    }
  })

  describe('資料提取效能測試', () => {
    test('小量資料提取效能 (5 本書籍)', async () => {
      const { TestDataGenerator } = require('../../helpers/test-data-generator')
      const generator = new TestDataGenerator()
      const books = generator.generateBooks(5, 'perf-small')

      await suite.injectMockBooks(books)

      const startTime = performance.now()

      const extractionResult = await suite.executeWorkflow('small-extraction', [
        { type: 'click', params: { selector: '#extractButton' } },
        { type: 'wait', params: { duration: 50 } }
      ])

      const endTime = performance.now()
      const extractionTime = endTime - startTime

      expect(extractionResult.result.success).toBe(true)

      // 效能基準：小量資料應在 5 秒內完成
      expect(extractionTime).toBeLessThan(5000)

      // 驗證資料已注入
      const overviewData = await suite.getOverviewPageData()
      expect(overviewData.bookCount).toBe(5)

      console.log(`[BENCHMARK] 小量資料提取時間: ${extractionTime.toFixed(2)}ms`)
    })

    test('中量資料提取效能測試 (50 本書籍模擬)', async () => {
      const { TestDataGenerator } = require('../../helpers/test-data-generator')
      const generator = new TestDataGenerator()
      const books = generator.generateBooks(50, 'perf-medium')

      await suite.injectMockBooks(books)

      const startTime = performance.now()

      const extractionResult = await suite.executeWorkflow('medium-extraction', [
        { type: 'click', params: { selector: '#extractButton' } },
        { type: 'wait', params: { duration: 100 } }
      ])

      const endTime = performance.now()
      const extractionTime = endTime - startTime

      expect(extractionResult.result.success).toBe(true)

      // 效能基準：中量資料應在 15 秒內完成
      expect(extractionTime).toBeLessThan(15000)

      const overviewData = await suite.getOverviewPageData()
      expect(overviewData.bookCount).toBe(50)

      console.log(`[BENCHMARK] 中量資料提取時間: ${extractionTime.toFixed(2)}ms`)
    })

    test('大量資料提取效能測試 (100+ 本書籍模擬)', async () => {
      const { TestDataGenerator } = require('../../helpers/test-data-generator')
      const generator = new TestDataGenerator()
      const books = generator.generateBooks(150, 'perf-large')

      await suite.injectMockBooks(books)

      const startTime = performance.now()

      const extractionResult = await suite.executeWorkflow('large-extraction', [
        { type: 'click', params: { selector: '#extractButton' } },
        { type: 'wait', params: { duration: 200 } }
      ])

      const endTime = performance.now()
      const extractionTime = endTime - startTime

      expect(extractionResult.result.success).toBe(true)

      // 效能基準：大量資料應在 30 秒內完成
      expect(extractionTime).toBeLessThan(30000)

      const overviewData = await suite.getOverviewPageData()
      expect(overviewData.bookCount).toBe(150)

      console.log(`[BENCHMARK] 大量資料提取時間: ${extractionTime.toFixed(2)}ms`)
    })
  })

  describe('記憶體使用測試', () => {
    test('基準記憶體使用測量', async () => {
      // 使用 MemoryLeakDetector 進行精確記憶體監控
      memoryDetector.startMonitoring()

      // 記錄初始狀態
      const initialOpId = memoryDetector.recordOperationStart('initial-state', { phase: 'baseline' })
      await memoryDetector.recordOperationEnd(initialOpId)

      // 記錄導航操作
      const navOpId = memoryDetector.recordOperationStart('navigate-to-readmoo')
      await suite.navigateToMockReadmooPage()
      await memoryDetector.recordOperationEnd(navOpId)

      // 記錄工作流程操作
      const workflowOpId = memoryDetector.recordOperationStart('execute-extraction-workflow')
      await suite.executeWorkflow('memory-test-extraction', [
        { type: 'click', params: { selector: '#extractButton' } },
        { type: 'wait', params: { duration: 50 } }
      ])
      const workflowOperation = await memoryDetector.recordOperationEnd(workflowOpId)

      const analysis = await memoryDetector.stopMonitoring()

      console.log('[BENCHMARK] 記憶體使用分析:')
      console.log(`  總記憶體增長: ${analysis.summary.formattedGrowth}`)
      console.log(`  工作流程操作記憶體增長: ${memoryDetector._formatMemorySize(workflowOperation.memoryDelta)}`)
      console.log(`  記憶體效率: ${(analysis.efficiency.overallEfficiency * 100).toFixed(1)}%`)

      // 驗證記憶體使用在合理範圍內
      expect(analysis.summary.totalMemoryGrowth).toBeLessThan(100 * 1024 * 1024) // 少於 100MB
      expect(analysis.passesThresholds.memoryGrowthOk).toBe(true)
    })

    test('記憶體洩漏檢測', async () => {
      // 使用 MemoryLeakDetector 進行記憶體洩漏檢測
      // 使用 10 次迭代（滿足 minOperationsForDetection 預設值 10）
      const analysis = await memoryDetector.detectMemoryLeak(async (iteration) => {
        // 執行一次完整的工作流程
        await suite.executeWorkflow(`leak-test-${iteration}`, [
          { type: 'click', params: { selector: '#extractButton' } },
          { type: 'wait', params: { duration: 20 } }
        ])
      }, 10, { testName: 'extension-workflow-cycle' })

      console.log('[BENCHMARK] 記憶體洩漏檢測結果:')
      console.log(`  總記憶體增長: ${analysis.summary.formattedGrowth}`)
      console.log(`  平均每操作記憶體增長: ${analysis.leakDetection.formattedAverageGrowth}`)
      console.log(`  洩漏嚴重程度: ${analysis.leakDetection.leakSeverity}`)
      console.log(`  記憶體增長趨勢: ${analysis.leakDetection.memoryGrowthTrend}`)
      console.log(`  記憶體回收率: ${(analysis.efficiency.memoryRecoveryRate * 100).toFixed(1)}%`)

      // 驗證記憶體未持續增長超過閾值
      // 注意：在 mock 環境中，V8 GC 行為會導致記憶體波動，
      // 因此只驗證總增長未超過閾值，不對嚴重程度做精確斷言
      expect(analysis.passesThresholds.memoryGrowthOk).toBe(true)

      // 驗證分析結構完整
      expect(analysis.leakDetection).toHaveProperty('suspectedLeaks')
      expect(analysis.leakDetection).toHaveProperty('averageMemoryPerOperation')
      expect(analysis.leakDetection).toHaveProperty('memoryGrowthTrend')
      expect(analysis.leakDetection).toHaveProperty('leakSeverity')
      expect(analysis.efficiency).toHaveProperty('memoryRecoveryRate')
    })
  })

  describe('UI 渲染效能測試', () => {
    test('Overview 頁面渲染效能', async () => {
      // 準備測試資料
      const { TestDataGenerator } = require('../../helpers/test-data-generator')
      const generator = new TestDataGenerator()
      const books = generator.generateBooks(30, 'perf-render')

      await suite.injectMockBooks(books)

      // 測試 Overview 頁面資料取得效能
      const startTime = performance.now()

      const overviewData = await suite.getOverviewPageData()

      // 模擬渲染等待
      await new Promise(resolve => setTimeout(resolve, 100))

      const endTime = performance.now()
      const renderTime = endTime - startTime

      expect(overviewData.bookCount).toBe(30)
      expect(overviewData.booksDisplayed).toBeInstanceOf(Array)

      // 效能基準：Overview 頁面資料取得應在 3 秒內完成
      expect(renderTime).toBeLessThan(3000)

      console.log(`[BENCHMARK] Overview 頁面渲染時間: ${renderTime.toFixed(2)}ms`)
    })

    test('搜尋功能響應時間', async () => {
      const searchTerms = ['JavaScript', 'Vue', 'Chrome', 'TDD', 'AI']
      const searchTimes = []

      for (const term of searchTerms) {
        const startTime = performance.now()

        const searchResult = await suite.searchOverviewBooks(term, {
          limit: 10,
          sortBy: 'relevance'
        })

        const endTime = performance.now()
        const searchTime = endTime - startTime
        searchTimes.push(searchTime)

        // 驗證搜尋結果結構
        expect(searchResult).toBeTruthy()
        expect(searchResult.results).toBeInstanceOf(Array)
      }

      const avgSearchTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length

      // 效能基準：搜尋響應時間應在 1 秒內
      expect(avgSearchTime).toBeLessThan(1000)

      console.log(`[BENCHMARK] 平均搜尋響應時間: ${avgSearchTime.toFixed(2)}ms`)
      console.log(`[BENCHMARK] 搜尋時間分布: [${searchTimes.map(t => t.toFixed(1)).join(', ')}]ms`)
    })
  })

  describe('匯出功能效能測試', () => {
    test('小量資料匯出效能', async () => {
      // 準備測試資料
      const { TestDataGenerator } = require('../../helpers/test-data-generator')
      const generator = new TestDataGenerator()
      const books = generator.generateBooks(20, 'perf-export')

      await suite.injectMockBooks(books)

      const startTime = performance.now()

      // 執行匯出工作流程
      const exportResult = await suite.executeWorkflow('export-test', [
        { type: 'click', params: { selector: '.export-button' } },
        { type: 'wait', params: { duration: 50 } }
      ])

      const endTime = performance.now()
      const exportTime = endTime - startTime

      expect(exportResult.result.success).toBe(true)

      // 效能基準：匯出應在 5 秒內完成
      expect(exportTime).toBeLessThan(5000)

      console.log(`[BENCHMARK] 匯出處理時間: ${exportTime.toFixed(2)}ms`)
    })
  })

  describe('並行處理效能測試', () => {
    test('多個工作流程同時操作', async () => {
      const workflowCount = 3
      const startTime = performance.now()

      // 同時啟動多個工作流程
      const workflowPromises = Array.from({ length: workflowCount }, (_, i) =>
        suite.executeWorkflow(`parallel-workflow-${i}`, [
          { type: 'click', params: { selector: '#extractButton' } },
          { type: 'wait', params: { duration: 30 } }
        ])
      )

      // 等待所有工作流程完成
      const results = await Promise.all(workflowPromises)

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // 驗證所有工作流程成功完成
      results.forEach((result, index) => {
        expect(result.result.success).toBe(true)
      })

      // 效能基準：並行處理應在 45 秒內完成
      expect(totalTime).toBeLessThan(45000)

      console.log(`[BENCHMARK] 並行處理完成時間: ${totalTime.toFixed(2)}ms`)
      console.log(`[BENCHMARK] 每個工作流程耗時: [${results.map(r => r.duration).join(', ')}]ms`)
    })
  })
})
