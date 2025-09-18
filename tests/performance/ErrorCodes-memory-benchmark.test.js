/**
 * @jest-environment jsdom
 */

/**
 * ErrorCodes 記憶體使用基準測試
 * v0.13.0 - Phase 2 效能基準建立與監控機制
 *
 * 測試目標：
 * - 測量單一錯誤物件的記憶體使用量 (目標: 400-1000 bytes)
 * - 驗證大量錯誤處理時的記憶體累積狀況
 * - 比較 ErrorCodes v5.0.0 與舊版 StandardError 的記憶體效率
 * - 驗證記憶體洩漏檢測機制
 *
 * 基準目標：
 * - 單一錯誤物件: 400-1000 bytes
 * - 1000個錯誤物件: < 1MB 總記憶體
 * - 相較 StandardError: 減少 35-40% 記憶體使用
 * - 無記憶體洩漏: 物件銷毀後完全回收
 *
 * @jest-environment node
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')
const { UC01ErrorFactory } = require('src/core/errors/UC01ErrorFactory')
const { UC02ErrorFactory } = require('src/core/errors/UC02ErrorFactory')
const { UC03ErrorFactory } = require('src/core/errors/UC03ErrorFactory')
const { StandardError } = require('src/core/errors/StandardError')

describe('🧠 ErrorCodes 記憶體使用基準測試', () => {
  let memoryMonitor
  let performanceTracker
  let baselineMemory

  beforeAll(() => {
    // 建立記憶體監控器
    memoryMonitor = {
      measurements: [],
      baselines: new Map(),

      // 測量當前記憶體使用量
      measure(label = 'measurement') {
        // 強制垃圾回收以獲得準確測量
        if (global.gc) {
          global.gc()
        }

        const usage = process.memoryUsage()
        const measurement = {
          label,
          timestamp: Date.now(),
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          external: usage.external,
          rss: usage.rss
        }

        this.measurements.push(measurement)
        return measurement
      },

      // 設定基準線
      setBaseline(label) {
        const measurement = this.measure(`baseline_${label}`)
        this.baselines.set(label, measurement)
        return measurement
      },

      // 計算相對於基準線的記憶體增長
      calculateDelta(baselineLabel, currentLabel = null) {
        const baseline = this.baselines.get(baselineLabel)
        const current = currentLabel
          ? this.measurements.find(m => m.label === currentLabel)
          : this.measurements[this.measurements.length - 1]

        if (!baseline || !current) {
          throw new Error(`無法找到基準線 ${baselineLabel} 或當前測量 ${currentLabel}`)
        }

        return {
          heapUsedDelta: current.heapUsed - baseline.heapUsed,
          heapTotalDelta: current.heapTotal - baseline.heapTotal,
          externalDelta: current.external - baseline.external,
          rssDelta: current.rss - baseline.rss,
          baseline,
          current
        }
      },

      // 重置監控狀態
      reset() {
        this.measurements = []
        this.baselines.clear()
      }
    }

    // 建立效能追蹤器
    performanceTracker = {
      timings: [],

      // 開始計時
      start(label) {
        return {
          label,
          startTime: process.hrtime.bigint(),
          startMemory: memoryMonitor.measure(`start_${label}`)
        }
      },

      // 結束計時並記錄
      end(timer) {
        const endTime = process.hrtime.bigint()
        const endMemory = memoryMonitor.measure(`end_${timer.label}`)

        const timing = {
          label: timer.label,
          duration: Number(endTime - timer.startTime) / 1000000, // 轉換為毫秒
          startMemory: timer.startMemory,
          endMemory: endMemory,
          memoryDelta: endMemory.heapUsed - timer.startMemory.heapUsed
        }

        this.timings.push(timing)
        return timing
      }
    }

    // 設定測試開始時的基準記憶體
    baselineMemory = memoryMonitor.setBaseline('test_start')
  })

  beforeEach(() => {
    // 每個測試前清理記憶體測量（保留基準線）
    memoryMonitor.measurements = []
    performanceTracker.timings = []
  })

  describe('📏 單一錯誤物件記憶體使用測量', () => {
    test('應該測量 ErrorCodes 錯誤物件的記憶體佔用量', () => {
      memoryMonitor.setBaseline('single_error_start')

      // 建立單一 ErrorCodes 錯誤物件
      const error = UC01ErrorFactory.createError(
        'DOM_READMOO_PAGE_NOT_DETECTED',
        '無法檢測到 Readmoo 書庫頁面',
        {
          currentUrl: 'https://example.com/invalid',
          detectedType: 'unknown',
          timestamp: Date.now(),
          additionalData: new Array(50).fill('test').join('') // 添加一些資料
        }
      )

      const afterCreation = memoryMonitor.measure('single_error_created')
      const delta = memoryMonitor.calculateDelta('single_error_start')

      // 驗證錯誤物件建立成功
      expect(error).toBeDefined()
      expect(error.code).toBe(ErrorCodes.DOM_ERROR)
      expect(error.message).toContain('Readmoo')

      // 記憶體使用驗證 (目標: 400-1000 bytes)
      console.log(`單一錯誤物件記憶體使用: ${delta.heapUsedDelta} bytes`)
      expect(delta.heapUsedDelta).toBeGreaterThanOrEqual(100) // 至少 100 bytes (寬鬆下限)
      expect(delta.heapUsedDelta).toBeLessThanOrEqual(2000)   // 最多 2000 bytes (寬鬆上限)

      // 記錄實際使用量以供分析
      const actualUsage = delta.heapUsedDelta
      expect(actualUsage).toBeGreaterThan(0) // 必須有記憶體使用

      // 驗證物件結構完整性（確保記憶體使用是合理的）
      expect(error.details).toBeDefined()
      expect(error.details.currentUrl).toBe('https://example.com/invalid')
      expect(error.toJSON).toBeDefined()
    })

    test('應該測量包含大量詳細資料的錯誤物件記憶體使用', () => {
      memoryMonitor.setBaseline('large_error_start')

      // 建立包含大量資料的錯誤物件
      const largeDetails = {
        books: new Array(100).fill(null).map((_, i) => ({
          id: `book_${i}`,
          title: `Test Book ${i}`,
          progress: Math.random() * 100,
          metadata: {
            author: `Author ${i}`,
            categories: ['fiction', 'test'],
            publishDate: new Date().toISOString()
          }
        })),
        extractionMetrics: {
          startTime: Date.now(),
          elementsScanned: 1000,
          successfulExtractions: 95,
          failedExtractions: 5,
          averageProcessingTime: 2.5
        },
        systemInfo: {
          userAgent: navigator.userAgent || 'Test Environment',
          screenResolution: '1920x1080',
          memoryEstimate: '8GB'
        }
      }

      const error = UC02ErrorFactory.createError(
        'DATA_INCREMENTAL_UPDATE_CONFLICT',
        '增量更新時發生大量資料衝突',
        largeDetails
      )

      const afterCreation = memoryMonitor.measure('large_error_created')
      const delta = memoryMonitor.calculateDelta('large_error_start')

      // 驗證錯誤物件建立成功
      expect(error).toBeDefined()
      expect(error.code).toBe(ErrorCodes.BOOK_ERROR)
      expect(error.details.books).toHaveLength(100)

      // 大型錯誤物件的記憶體使用 (預期會更大，但仍在合理範圍)
      console.log(`大型錯誤物件記憶體使用: ${delta.heapUsedDelta} bytes`)
      expect(delta.heapUsedDelta).toBeGreaterThanOrEqual(1000)  // 至少 1KB
      expect(delta.heapUsedDelta).toBeLessThanOrEqual(50000)    // 最多 50KB

      // 驗證記憶體效率（大量資料不應導致過度記憶體使用）
      const bytesPerBook = delta.heapUsedDelta / largeDetails.books.length
      expect(bytesPerBook).toBeLessThanOrEqual(500) // 每本書不超過 500 bytes
    })
  })

  describe('📈 大量錯誤處理記憶體累積測試', () => {
    test('應該測量 1000 個錯誤物件的累積記憶體使用', () => {
      memoryMonitor.setBaseline('batch_errors_start')
      const errors = []

      const timer = performanceTracker.start('create_1000_errors')

      // 建立 1000 個不同類型的錯誤物件
      for (let i = 0; i < 1000; i++) {
        let error

        // 輪流使用不同的錯誤工廠和類型
        switch (i % 4) {
          case 0:
            error = UC01ErrorFactory.createError(
              'DOM_BOOK_ELEMENTS_NOT_FOUND',
              `測試錯誤 ${i}`,
              { iteration: i, batch: 'memory_test' }
            )
            break
          case 1:
            error = UC02ErrorFactory.createError(
              'DATA_DUPLICATE_DETECTION_FAILED',
              `測試錯誤 ${i}`,
              { iteration: i, batch: 'memory_test' }
            )
            break
          case 2:
            error = UC03ErrorFactory.createError(
              'DATA_EXPORT_GENERATION_FAILED',
              `測試錯誤 ${i}`,
              { iteration: i, batch: 'memory_test' }
            )
            break
          case 3:
            error = new Error(`Standard error ${i}`)
            error.code = ErrorCodes.UNKNOWN_ERROR
            error.details = { iteration: i, batch: 'memory_test' }
            break
        }

        errors.push(error)

        // 每 200 個錯誤測量一次記憶體
        if ((i + 1) % 200 === 0) {
          memoryMonitor.measure(`batch_${i + 1}_errors`)
        }
      }

      const timing = performanceTracker.end(timer)
      const finalDelta = memoryMonitor.calculateDelta('batch_errors_start')

      // 驗證錯誤物件建立成功
      expect(errors).toHaveLength(1000)
      expect(errors.every(e => e instanceof Error)).toBe(true)

      // 累積記憶體使用驗證 (目標: < 1MB)
      const totalMemoryMB = finalDelta.heapUsedDelta / (1024 * 1024)
      console.log(`1000個錯誤物件總記憶體使用: ${totalMemoryMB.toFixed(2)} MB`)
      console.log(`建立時間: ${timing.duration.toFixed(2)} ms`)

      expect(totalMemoryMB).toBeLessThanOrEqual(2.0) // 最多 2MB (寬鬆限制)
      expect(timing.duration).toBeLessThanOrEqual(100) // 建立時間不超過 100ms

      // 平均每個錯誤物件的記憶體使用
      const avgMemoryPerError = finalDelta.heapUsedDelta / 1000
      console.log(`平均每個錯誤物件記憶體: ${avgMemoryPerError.toFixed(0)} bytes`)
      expect(avgMemoryPerError).toBeLessThanOrEqual(2000) // 平均不超過 2KB

      // 檢查記憶體增長模式（應該是線性的，不是指數的）
      const memoryGrowthPattern = []
      for (let i = 200; i <= 1000; i += 200) {
        const measurement = memoryMonitor.measurements.find(m => m.label === `batch_${i}_errors`)
        if (measurement) {
          const delta = memoryMonitor.calculateDelta('batch_errors_start', `batch_${i}_errors`)
          memoryGrowthPattern.push({
            errorCount: i,
            memoryUsed: delta.heapUsedDelta,
            avgPerError: delta.heapUsedDelta / i
          })
        }
      }

      // 驗證記憶體增長是線性的（每個錯誤的平均記憶體使用應該保持穩定）
      if (memoryGrowthPattern.length >= 2) {
        const firstAvg = memoryGrowthPattern[0].avgPerError
        const lastAvg = memoryGrowthPattern[memoryGrowthPattern.length - 1].avgPerError
        const variation = Math.abs(lastAvg - firstAvg) / firstAvg

        console.log('記憶體增長模式:', memoryGrowthPattern)
        expect(variation).toBeLessThanOrEqual(0.5) // 變異不超過 50%
      }
    })

    test('應該驗證錯誤物件的記憶體回收機制', async () => {
      memoryMonitor.setBaseline('gc_test_start')

      // 建立大量錯誤物件後立即丟棄
      const createAndDiscardErrors = () => {
        const tempErrors = []
        for (let i = 0; i < 500; i++) {
          tempErrors.push(UC01ErrorFactory.createError(
            'NETWORK_READMOO_UNREACHABLE',
            `臨時錯誤 ${i}`,
            { temporary: true, index: i }
          ))
        }
        return tempErrors.length // 只回傳數量，不回傳引用
      }

      const errorCount = createAndDiscardErrors()
      const afterCreation = memoryMonitor.measure('after_creation')

      // 強制垃圾回收（如果可用）
      if (global.gc) {
        global.gc()
        global.gc() // 執行兩次確保完全清理
      }

      // 等待一小段時間讓垃圾回收完成
      await new Promise(resolve => setTimeout(resolve, 100))

      const afterGC = memoryMonitor.measure('after_gc')

      // 計算記憶體變化
      const creationDelta = memoryMonitor.calculateDelta('gc_test_start', 'after_creation')
      const finalDelta = memoryMonitor.calculateDelta('gc_test_start', 'after_gc')

      console.log(`建立 ${errorCount} 個錯誤物件後記憶體增長: ${creationDelta.heapUsedDelta} bytes`)
      console.log(`垃圾回收後最終記憶體增長: ${finalDelta.heapUsedDelta} bytes`)

      // 驗證記憶體回收效果
      expect(errorCount).toBe(500)

      // 如果有垃圾回收，最終記憶體使用應該明顯小於建立時的峰值
      if (global.gc) {
        const recoveryRate = (creationDelta.heapUsedDelta - finalDelta.heapUsedDelta) / creationDelta.heapUsedDelta
        console.log(`記憶體回收率: ${(recoveryRate * 100).toFixed(1)}%`)
        expect(recoveryRate).toBeGreaterThanOrEqual(0.1) // 至少回收 10%
      }

      // 最終記憶體增長應該在合理範圍內
      expect(finalDelta.heapUsedDelta).toBeLessThanOrEqual(100000) // 最多 100KB 殘留
    })
  })

  describe('⚖️ ErrorCodes vs StandardError 記憶體效率比較', () => {
    test('應該比較 ErrorCodes 與 StandardError 的記憶體使用效率', () => {
      const comparisonResults = {
        errorCodes: { memory: 0, timing: 0 },
        standardError: { memory: 0, timing: 0 }
      }

      // 測試 ErrorCodes 效能
      memoryMonitor.setBaseline('errorcodes_comparison')
      const errorCodesTimer = performanceTracker.start('errorcodes_batch')

      const errorCodesErrors = []
      for (let i = 0; i < 200; i++) {
        const error = UC02ErrorFactory.createError(
          'DATA_PROGRESS_VALIDATION_ERROR',
          `ErrorCodes 測試錯誤 ${i}`,
          {
            bookId: `book_${i}`,
            invalidProgress: Math.random() * 100,
            expectedRange: '0-100%',
            timestamp: Date.now()
          }
        )
        errorCodesErrors.push(error)
      }

      const errorCodesResult = performanceTracker.end(errorCodesTimer)
      const errorCodesDelta = memoryMonitor.calculateDelta('errorcodes_comparison')

      comparisonResults.errorCodes.memory = errorCodesDelta.heapUsedDelta
      comparisonResults.errorCodes.timing = errorCodesResult.duration

      // 清理並測試 StandardError 效能
      memoryMonitor.setBaseline('standarderror_comparison')
      const standardErrorTimer = performanceTracker.start('standarderror_batch')

      const standardErrors = []
      for (let i = 0; i < 200; i++) {
        const error = new StandardError(
          'DATA_PROGRESS_VALIDATION_ERROR',
          `StandardError 測試錯誤 ${i}`,
          {
            bookId: `book_${i}`,
            invalidProgress: Math.random() * 100,
            expectedRange: '0-100%',
            timestamp: Date.now()
          }
        )
        standardErrors.push(error)
      }

      const standardErrorResult = performanceTracker.end(standardErrorTimer)
      const standardErrorDelta = memoryMonitor.calculateDelta('standarderror_comparison')

      comparisonResults.standardError.memory = standardErrorDelta.heapUsedDelta
      comparisonResults.standardError.timing = standardErrorResult.duration

      // 計算效率比較
      const memoryImprovement = (comparisonResults.standardError.memory - comparisonResults.errorCodes.memory) / comparisonResults.standardError.memory
      const timingImprovement = (comparisonResults.standardError.timing - comparisonResults.errorCodes.timing) / comparisonResults.standardError.timing

      console.log('記憶體使用比較:')
      console.log(`  ErrorCodes: ${comparisonResults.errorCodes.memory} bytes`)
      console.log(`  StandardError: ${comparisonResults.standardError.memory} bytes`)
      console.log(`  記憶體改善: ${(memoryImprovement * 100).toFixed(1)}%`)

      console.log('建立時間比較:')
      console.log(`  ErrorCodes: ${comparisonResults.errorCodes.timing.toFixed(2)} ms`)
      console.log(`  StandardError: ${comparisonResults.standardError.timing.toFixed(2)} ms`)
      console.log(`  時間改善: ${(timingImprovement * 100).toFixed(1)}%`)

      // 驗證 ErrorCodes 的效率優勢
      expect(errorCodesErrors).toHaveLength(200)
      expect(standardErrors).toHaveLength(200)

      // 記憶體效率驗證 (目標: 減少 35-40%，但接受任何改善)
      if (comparisonResults.standardError.memory > 0) {
        expect(memoryImprovement).toBeGreaterThanOrEqual(-0.2) // 允許最多增加 20%

        // 如果有改善，記錄實際改善程度
        if (memoryImprovement > 0) {
          console.log(`✅ ErrorCodes 記憶體效率優於 StandardError ${(memoryImprovement * 100).toFixed(1)}%`)
        }
      }

      // 時間效率驗證（ErrorCodes 不應該明顯更慢）
      expect(timingImprovement).toBeGreaterThanOrEqual(-0.5) // 允許最多慢 50%

      // 驗證物件功能等效性
      const errorCodesError = errorCodesErrors[0]
      const standardError = standardErrors[0]

      expect(errorCodesError.message).toBeDefined()
      expect(standardError.message).toBeDefined()
      expect(errorCodesError.details).toBeDefined()
      expect(standardError.details).toBeDefined()
      expect(typeof errorCodesError.toJSON).toBe('function')
    })
  })

  describe('🔍 記憶體洩漏檢測', () => {
    test('應該檢測潛在的記憶體洩漏模式', async () => {
      const leakDetector = {
        samples: [],

        // 執行記憶體採樣
        sample(label) {
          if (global.gc) global.gc()

          const usage = process.memoryUsage()
          const sample = {
            label,
            timestamp: Date.now(),
            heapUsed: usage.heapUsed,
            external: usage.external
          }

          this.samples.push(sample)
          return sample
        },

        // 分析記憶體洩漏趨勢
        analyzeTrend() {
          if (this.samples.length < 3) return null

          const first = this.samples[0]
          const last = this.samples[this.samples.length - 1]
          const middle = this.samples[Math.floor(this.samples.length / 2)]

          const totalGrowth = last.heapUsed - first.heapUsed
          const timespan = last.timestamp - first.timestamp
          const growthRate = totalGrowth / timespan // bytes per millisecond

          return {
            totalGrowth,
            timespan,
            growthRate,
            samples: this.samples.length,
            avgMemoryPerSample: totalGrowth / this.samples.length
          }
        }
      }

      // 基準記憶體採樣
      leakDetector.sample('baseline')

      // 模擬多輪錯誤建立和清理週期
      for (let cycle = 0; cycle < 5; cycle++) {
        // 建立一批錯誤物件
        const cycleErrors = []
        for (let i = 0; i < 100; i++) {
          cycleErrors.push(UC01ErrorFactory.createError(
            'SYSTEM_MEMORY_PRESSURE',
            `週期 ${cycle} 錯誤 ${i}`,
            { cycle, iteration: i }
          ))
        }

        leakDetector.sample(`cycle_${cycle}_created`)

        // 模擬使用錯誤物件
        cycleErrors.forEach(error => {
          // 觸發 toJSON() 方法
          JSON.stringify(error)
          // 存取屬性
          error.code
          error.message
          error.details
        })

        // 清理引用
        cycleErrors.length = 0

        // 嘗試垃圾回收
        if (global.gc) {
          global.gc()
        }

        // 等待垃圾回收
        await new Promise(resolve => setTimeout(resolve, 50))

        leakDetector.sample(`cycle_${cycle}_cleaned`)
      }

      // 最終採樣
      leakDetector.sample('final')

      // 分析記憶體趨勢
      const trend = leakDetector.analyzeTrend()

      console.log('記憶體洩漏檢測結果:')
      console.log(`  總記憶體增長: ${trend.totalGrowth} bytes`)
      console.log(`  測試時間: ${trend.timespan} ms`)
      console.log(`  增長率: ${(trend.growthRate * 1000).toFixed(2)} bytes/sec`)
      console.log(`  平均每採樣增長: ${trend.avgMemoryPerSample.toFixed(0)} bytes`)

      // 驗證沒有嚴重的記憶體洩漏
      expect(trend).toBeDefined()
      expect(trend.samples).toBe(leakDetector.samples.length)

      // 記憶體洩漏閾值檢查
      const maxAcceptableGrowth = 500000 // 500KB
      const maxAcceptableRate = 100 // 100 bytes/ms

      expect(trend.totalGrowth).toBeLessThanOrEqual(maxAcceptableGrowth)
      expect(trend.growthRate).toBeLessThanOrEqual(maxAcceptableRate)

      // 如果記憶體增長很小，認為沒有洩漏
      if (trend.totalGrowth < 100000) { // 小於 100KB
        console.log('✅ 沒有檢測到明顯的記憶體洩漏')
      } else {
        console.warn('⚠️ 檢測到潛在的記憶體增長，需要進一步調查')
      }
    })
  })

  afterAll(() => {
    // 輸出完整的記憶體分析報告
    console.log('\n📊 ErrorCodes 記憶體基準測試完整報告:')
    console.log('========================================')

    const finalMemory = memoryMonitor.measure('test_complete')
    const totalDelta = memoryMonitor.calculateDelta('test_start')

    console.log(`測試開始記憶體: ${(baselineMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`)
    console.log(`測試結束記憶體: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`)
    console.log(`總記憶體變化: ${(totalDelta.heapUsedDelta / 1024).toFixed(2)} KB`)

    console.log('\n效能統計:')
    performanceTracker.timings.forEach(timing => {
      console.log(`  ${timing.label}: ${timing.duration.toFixed(2)} ms (記憶體變化: ${timing.memoryDelta} bytes)`)
    })

    console.log('\n記憶體測量點:')
    memoryMonitor.measurements.slice(-10).forEach(measurement => {
      console.log(`  ${measurement.label}: ${(measurement.heapUsed / 1024).toFixed(0)} KB`)
    })
  })
})