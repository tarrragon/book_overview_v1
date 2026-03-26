/**
 * @jest-environment jsdom
 */

/* eslint-disable no-console */

/**
 * ErrorCodes 錯誤建立效能基準測試
 * v0.13.0 - Phase 2 效能基準建立與監控機制
 *
 * 測試目標：
 * - 測量錯誤物件建立時間 (目標: 0.1-0.5ms)
 * - 驗證 CommonErrors 預編譯錯誤的效能優勢
 * - 評估熱路徑中錯誤處理的效能影響
 * - 比較不同錯誤類型的建立效能
 *
 * 基準目標：
 * - 單一錯誤建立: 0.1-0.5ms
 * - 批量建立 1000 個錯誤: < 100ms
 * - CommonErrors 預編譯: 比動態建立快 3-5 倍
 * - 熱路徑效能影響: < 1% 額外開銷
 *
 * @jest-environment node
 */

const { ErrorCodes, CommonErrors } = require('src/core/errors/ErrorCodes')
const { UC01ErrorFactory } = require('src/core/errors/UC01ErrorFactory')
const { UC02ErrorFactory } = require('src/core/errors/UC02ErrorFactory')
// eslint-disable-next-line no-unused-vars
const { UC03ErrorFactory } = require('src/core/errors/UC03ErrorFactory')
const { UC01ErrorAdapter } = require('src/core/errors/UC01ErrorAdapter')
// eslint-disable-next-line no-unused-vars
const { UC02ErrorAdapter } = require('src/core/errors/UC02ErrorAdapter')

describe('⚡ ErrorCodes 錯誤建立效能基準測試', () => {
  let performanceBenchmark
  let statisticsCollector

  beforeAll(() => {
    // 高精度效能基準測試工具
    performanceBenchmark = {
      // 單次測量
      measureSingle (fn, label = 'operation') {
        // eslint-disable-next-line no-unused-vars
        const start = process.hrtime.bigint()
        // eslint-disable-next-line no-unused-vars
        const result = fn()
        // eslint-disable-next-line no-unused-vars
        const end = process.hrtime.bigint()

        // eslint-disable-next-line no-unused-vars
        const duration = Number(end - start) / 1000000 // 轉換為毫秒

        return {
          label,
          duration,
          result,
          timestamp: Date.now()
        }
      },

      // 批量測量並統計
      measureBatch (fn, iterations = 1000, label = 'batch_operation') {
        // eslint-disable-next-line no-unused-vars
        const measurements = []
        // eslint-disable-next-line no-unused-vars
        const start = process.hrtime.bigint()

        for (let i = 0; i < iterations; i++) {
          // eslint-disable-next-line no-unused-vars
          const iterationStart = process.hrtime.bigint()
          // eslint-disable-next-line no-unused-vars
          const result = fn(i)
          // eslint-disable-next-line no-unused-vars
          const iterationEnd = process.hrtime.bigint()

          measurements.push({
            iteration: i,
            duration: Number(iterationEnd - iterationStart) / 1000000,
            result
          })
        }

        // eslint-disable-next-line no-unused-vars
        const end = process.hrtime.bigint()
        // eslint-disable-next-line no-unused-vars
        const totalDuration = Number(end - start) / 1000000

        return {
          label,
          iterations,
          totalDuration,
          averageDuration: totalDuration / iterations,
          measurements,
          statistics: this.calculateStatistics(measurements.map(m => m.duration))
        }
      },

      // 計算統計數據
      calculateStatistics (durations) {
        durations.sort((a, b) => a - b)

        // eslint-disable-next-line no-unused-vars
        const sum = durations.reduce((acc, val) => acc + val, 0)
        // eslint-disable-next-line no-unused-vars
        const mean = sum / durations.length
        // eslint-disable-next-line no-unused-vars
        const median = durations[Math.floor(durations.length / 2)]
        // eslint-disable-next-line no-unused-vars
        const min = durations[0]
        // eslint-disable-next-line no-unused-vars
        const max = durations[durations.length - 1]

        // 計算標準差
        // eslint-disable-next-line no-unused-vars
        const variance = durations.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / durations.length
        // eslint-disable-next-line no-unused-vars
        const standardDeviation = Math.sqrt(variance)

        // 百分位數
        // eslint-disable-next-line no-unused-vars
        const p95 = durations[Math.floor(durations.length * 0.95)]
        // eslint-disable-next-line no-unused-vars
        const p99 = durations[Math.floor(durations.length * 0.99)]

        return {
          mean,
          median,
          min,
          max,
          standardDeviation,
          p95,
          p99,
          count: durations.length
        }
      },

      // 預熱函數（避免 JIT 編譯影響）
      warmup (fn, iterations = 100) {
        for (let i = 0; i < iterations; i++) {
          fn(i)
        }
      }
    }

    // 統計收集器
    statisticsCollector = {
      results: new Map(),

      record (testName, result) {
        this.results.set(testName, result)
      },

      compare (testName1, testName2) {
        // eslint-disable-next-line no-unused-vars
        const result1 = this.results.get(testName1)
        // eslint-disable-next-line no-unused-vars
        const result2 = this.results.get(testName2)

        if (!result1 || !result2) {
          throw new Error(`無法找到測試結果: ${testName1} 或 ${testName2}`)
        }

        // eslint-disable-next-line no-unused-vars
        const improvement = (result2.averageDuration - result1.averageDuration) / result2.averageDuration

        return {
          test1: testName1,
          test2: testName2,
          result1,
          result2,
          improvement,
          speedup: result2.averageDuration / result1.averageDuration,
          description: improvement > 0
            ? `${testName1} 比 ${testName2} 快 ${(improvement * 100).toFixed(1)}%`
            : `${testName2} 比 ${testName1} 快 ${(Math.abs(improvement) * 100).toFixed(1)}%`
        }
      },

      generateReport () {
        // eslint-disable-next-line no-unused-vars
        const report = {
          summary: {},
          details: {},
          comparisons: []
        }

        // 摘要統計
        for (const [testName, result] of this.results) {
          report.summary[testName] = {
            averageDuration: result.averageDuration,
            p95Duration: result.statistics.p95,
            iterations: result.iterations
          }

          report.details[testName] = result
        }

        return report
      }
    }
  })

  describe('🚀 單一錯誤建立效能測試', () => {
    test('應該測量基本 ErrorCodes 錯誤建立時間', () => {
      // 預熱
      performanceBenchmark.warmup(() => {
        UC01ErrorFactory.createError('DOM_READMOO_PAGE_NOT_DETECTED', '測試錯誤')
      })

      // 單次測量
      // eslint-disable-next-line no-unused-vars
      const singleMeasurement = performanceBenchmark.measureSingle(() => {
        return UC01ErrorFactory.createError(
          'DOM_READMOO_PAGE_NOT_DETECTED',
          '無法檢測到 Readmoo 書庫頁面',
          {
            currentUrl: 'https://readmoo.com/library',
            detectedType: 'unknown'
          }
        )
      }, 'single_error_creation')

      // 批量測量
      // eslint-disable-next-line no-unused-vars
      const batchResult = performanceBenchmark.measureBatch((i) => {
        return UC01ErrorFactory.createError(
          'DOM_READMOO_PAGE_NOT_DETECTED',
          `測試錯誤 ${i}`,
          { iteration: i }
        )
      }, 1000, 'basic_error_batch')

      statisticsCollector.record('basic_error_creation', batchResult)

      // 驗證結果
      expect(singleMeasurement.result).toBeDefined()
      expect(singleMeasurement.result.code).toBe(ErrorCodes.DOM_ERROR)
      expect(singleMeasurement.duration).toBeGreaterThan(0)

      // 效能基準驗證 (目標: 0.1-0.5ms)
      // eslint-disable-next-line no-console
      console.log(`單一錯誤建立時間: ${singleMeasurement.duration.toFixed(3)} ms`)
      // eslint-disable-next-line no-console
      console.log('批量錯誤建立統計:')
      // eslint-disable-next-line no-console
      console.log(`  平均時間: ${batchResult.averageDuration.toFixed(3)} ms`)
      // eslint-disable-next-line no-console
      console.log(`  中位數: ${batchResult.statistics.median.toFixed(3)} ms`)
      // eslint-disable-next-line no-console
      console.log(`  95%: ${batchResult.statistics.p95.toFixed(3)} ms`)
      // eslint-disable-next-line no-console
      console.log(`  99%: ${batchResult.statistics.p99.toFixed(3)} ms`)

      // 效能斷言 (使用寬鬆的限制以適應不同環境)
      expect(batchResult.statistics.mean).toBeLessThanOrEqual(2.0) // 平均不超過 2ms
      expect(batchResult.statistics.p95).toBeLessThanOrEqual(5.0) // 95% 不超過 5ms
      expect(batchResult.totalDuration).toBeLessThanOrEqual(500) // 總時間不超過 500ms
    })

    test('應該測量複雜錯誤物件建立效能', () => {
      // 預熱
      performanceBenchmark.warmup(() => {
        UC02ErrorFactory.createIncrementalUpdateError([{ id: 'test' }])
      })

      // 測量複雜錯誤建立效能
      // eslint-disable-next-line no-unused-vars
      const complexResult = performanceBenchmark.measureBatch((i) => {
        // eslint-disable-next-line no-unused-vars
        const conflictedBooks = new Array(10).fill(null).map((_, j) => ({
          id: `book_${i}_${j}`,
          title: `衝突書籍 ${j}`,
          conflictReason: 'progress_mismatch',
          oldProgress: Math.random() * 100,
          newProgress: Math.random() * 100
        }))

        return UC02ErrorFactory.createIncrementalUpdateError(conflictedBooks, {
          batchId: `batch_${i}`,
          totalConflicts: conflictedBooks.length,
          resolutionStrategy: 'keep_higher_progress'
        })
      }, 500, 'complex_error_batch')

      statisticsCollector.record('complex_error_creation', complexResult)

      // eslint-disable-next-line no-console
      console.log('複雜錯誤建立統計:')
      // eslint-disable-next-line no-console
      console.log(`  平均時間: ${complexResult.averageDuration.toFixed(3)} ms`)
      // eslint-disable-next-line no-console
      console.log(`  中位數: ${complexResult.statistics.median.toFixed(3)} ms`)
      // eslint-disable-next-line no-console
      console.log(`  標準差: ${complexResult.statistics.standardDeviation.toFixed(3)} ms`)

      // 複雜錯誤的效能應該仍在合理範圍內
      expect(complexResult.statistics.mean).toBeLessThanOrEqual(5.0) // 平均不超過 5ms
      expect(complexResult.statistics.p95).toBeLessThanOrEqual(10.0) // 95% 不超過 10ms

      // 驗證錯誤物件的正確性
      // eslint-disable-next-line no-unused-vars
      const sampleError = complexResult.measurements[0].result
      expect(sampleError.code).toBe(ErrorCodes.BOOK_ERROR)
      expect(sampleError.details.conflictedBooks).toHaveLength(10)
    })
  })

  describe('📦 CommonErrors 預編譯效能測試', () => {
    test('應該比較 CommonErrors 與動態建立的效能差異', () => {
      // 預熱兩種方式
      performanceBenchmark.warmup(() => CommonErrors.EMAIL_REQUIRED)
      performanceBenchmark.warmup(() => {
        // eslint-disable-next-line no-unused-vars
        const error = new Error('Email is required')
        error.code = ErrorCodes.VALIDATION_ERROR
        return error
      })

      // 測量 CommonErrors 存取效能
      // eslint-disable-next-line no-unused-vars
      const commonErrorsResult = performanceBenchmark.measureBatch((i) => {
        // 存取預編譯的錯誤
        return CommonErrors.EMAIL_REQUIRED
      }, 10000, 'common_errors_access')

      // 測量動態建立效能
      // eslint-disable-next-line no-unused-vars
      const dynamicCreationResult = performanceBenchmark.measureBatch((i) => {
        // eslint-disable-next-line no-unused-vars
        const error = new Error('Email is required')
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = {
          timestamp: Date.now(),
          iteration: i
        }
        return error
      }, 10000, 'dynamic_error_creation')

      statisticsCollector.record('common_errors', commonErrorsResult)
      statisticsCollector.record('dynamic_creation', dynamicCreationResult)

      // 比較效能
      // eslint-disable-next-line no-unused-vars
      const comparison = statisticsCollector.compare('common_errors', 'dynamic_creation')

      // eslint-disable-next-line no-console
      console.log('CommonErrors 效能統計:')
      // eslint-disable-next-line no-console
      console.log(`  平均時間: ${commonErrorsResult.averageDuration.toFixed(6)} ms`)
      // eslint-disable-next-line no-console
      console.log(`  中位數: ${commonErrorsResult.statistics.median.toFixed(6)} ms`)

      // eslint-disable-next-line no-console
      console.log('動態建立效能統計:')
      // eslint-disable-next-line no-console
      console.log(`  平均時間: ${dynamicCreationResult.averageDuration.toFixed(6)} ms`)
      // eslint-disable-next-line no-console
      console.log(`  中位數: ${dynamicCreationResult.statistics.median.toFixed(6)} ms`)

      // eslint-disable-next-line no-console
      console.log(`效能比較: ${comparison.description}`)
      // eslint-disable-next-line no-console
      console.log(`加速倍數: ${comparison.speedup.toFixed(1)}x`)

      // CommonErrors 應該明顯更快
      expect(comparison.speedup).toBeGreaterThanOrEqual(2.0) // 至少快 2 倍
      expect(commonErrorsResult.statistics.mean).toBeLessThanOrEqual(0.1) // 平均不超過 0.1ms

      // 驗證功能等效性
      // eslint-disable-next-line no-unused-vars
      const commonError = commonErrorsResult.measurements[0].result
      // eslint-disable-next-line no-unused-vars
      const dynamicError = dynamicCreationResult.measurements[0].result

      expect(commonError.message).toBe('Email is required')
      expect(dynamicError.message).toBe('Email is required')
      expect(commonError.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(dynamicError.code).toBe(ErrorCodes.VALIDATION_ERROR)
    })

    test('應該測量各種 CommonErrors 的存取效能一致性', () => {
      // eslint-disable-next-line no-unused-vars
      const commonErrorTypes = [
        'EMAIL_REQUIRED',
        'TITLE_REQUIRED',
        'NETWORK_TIMEOUT',
        'READMOO_LOGIN_FAILED',
        'BOOK_EXTRACTION_FAILED'
      ]

      // eslint-disable-next-line no-unused-vars
      const results = new Map()

      commonErrorTypes.forEach(errorType => {
        // 預熱
        performanceBenchmark.warmup(() => CommonErrors[errorType])

        // 測量
        // eslint-disable-next-line no-unused-vars
        const result = performanceBenchmark.measureBatch((i) => {
          return CommonErrors[errorType]
        }, 5000, `common_error_${errorType.toLowerCase()}`)

        results.set(errorType, result)
        statisticsCollector.record(`common_error_${errorType}`, result)

        // eslint-disable-next-line no-console
        console.log(`${errorType} 平均存取時間: ${result.averageDuration.toFixed(6)} ms`)
      })

      // 驗證所有 CommonErrors 的效能一致性
      // eslint-disable-next-line no-unused-vars
      const durations = Array.from(results.values()).map(r => r.statistics.mean)
      // eslint-disable-next-line no-unused-vars
      const minDuration = Math.min(...durations)
      // eslint-disable-next-line no-unused-vars
      const maxDuration = Math.max(...durations)
      // eslint-disable-next-line no-unused-vars
      const variation = (maxDuration - minDuration) / minDuration

      // eslint-disable-next-line no-console
      console.log(`CommonErrors 效能變異: ${(variation * 100).toFixed(1)}%`)

      // 效能變異應該很小（所有都是預編譯的）
      expect(variation).toBeLessThanOrEqual(0.5) // 變異不超過 50%
      expect(maxDuration).toBeLessThanOrEqual(0.1) // 最慢的也不超過 0.1ms

      // 驗證所有錯誤都可用
      commonErrorTypes.forEach(errorType => {
        expect(CommonErrors[errorType]).toBeDefined()
        expect(CommonErrors[errorType].code).toBeDefined()
        expect(CommonErrors[errorType].message).toBeDefined()
      })
    })
  })

  describe('🔥 熱路徑效能影響評估', () => {
    test('應該測量錯誤處理對正常業務流程的效能影響', () => {
      // 模擬正常業務操作（無錯誤）
      // eslint-disable-next-line no-unused-vars
      const normalOperation = () => {
        // eslint-disable-next-line no-unused-vars
        const books = []
        for (let i = 0; i < 100; i++) {
          books.push({
            id: `book_${i}`,
            title: `Book ${i}`,
            progress: Math.random() * 100,
            processed: true
          })
        }
        return books.filter(book => book.progress > 50)
      }

      // 模擬包含錯誤處理的業務操作
      // eslint-disable-next-line no-unused-vars
      const operationWithErrorHandling = () => {
        // eslint-disable-next-line no-unused-vars
        const books = []
        // eslint-disable-next-line no-unused-vars
        const errors = []

        for (let i = 0; i < 100; i++) {
          try {
            // eslint-disable-next-line no-unused-vars
            const book = {
              id: `book_${i}`,
              title: `Book ${i}`,
              progress: Math.random() * 100
            }

            // 模擬可能的錯誤情況
            if (book.progress < 0 || book.progress > 100) {
              throw UC02ErrorFactory.createProgressValidationError(book.progress, {
                bookId: book.id,
                expectedRange: '0-100'
              })
            }

            book.processed = true
            books.push(book)
          } catch (error) {
            errors.push(error)
          }
        }

        return { books: books.filter(book => book.progress > 50), errors }
      }

      // 預熱
      performanceBenchmark.warmup(normalOperation, 50)
      performanceBenchmark.warmup(operationWithErrorHandling, 50)

      // 測量正常操作效能
      // eslint-disable-next-line no-unused-vars
      const normalResult = performanceBenchmark.measureBatch((i) => {
        return normalOperation()
      }, 1000, 'normal_operation')

      // 測量包含錯誤處理的操作效能
      // eslint-disable-next-line no-unused-vars
      const errorHandlingResult = performanceBenchmark.measureBatch((i) => {
        return operationWithErrorHandling()
      }, 1000, 'operation_with_error_handling')

      statisticsCollector.record('normal_operation', normalResult)
      statisticsCollector.record('error_handling_operation', errorHandlingResult)

      // 計算效能影響
      // eslint-disable-next-line no-unused-vars
      const performanceImpact = (errorHandlingResult.statistics.mean - normalResult.statistics.mean) / normalResult.statistics.mean

      // eslint-disable-next-line no-console
      console.log('正常操作效能:')
      // eslint-disable-next-line no-console
      console.log(`  平均時間: ${normalResult.averageDuration.toFixed(3)} ms`)
      // eslint-disable-next-line no-console
      console.log(`  中位數: ${normalResult.statistics.median.toFixed(3)} ms`)

      // eslint-disable-next-line no-console
      console.log('錯誤處理操作效能:')
      // eslint-disable-next-line no-console
      console.log(`  平均時間: ${errorHandlingResult.averageDuration.toFixed(3)} ms`)
      // eslint-disable-next-line no-console
      console.log(`  中位數: ${errorHandlingResult.statistics.median.toFixed(3)} ms`)

      // eslint-disable-next-line no-console
      console.log(`錯誤處理效能影響: ${(performanceImpact * 100).toFixed(1)}%`)

      // 錯誤處理的效能影響應該很小 (目標: < 1%)
      expect(performanceImpact).toBeLessThanOrEqual(0.5) // 不超過 50% (寬鬆限制，測試環境允許更大波動)

      // 驗證業務邏輯正確性
      // eslint-disable-next-line no-unused-vars
      const normalBooks = normalResult.measurements[0].result
      // eslint-disable-next-line no-unused-vars
      const errorHandlingBooks = errorHandlingResult.measurements[0].result.books

      expect(Array.isArray(normalBooks)).toBe(true)
      expect(Array.isArray(errorHandlingBooks)).toBe(true)
      expect(normalBooks.length).toBeGreaterThan(0)
      expect(errorHandlingBooks.length).toBeGreaterThan(0)
    })

    test('應該測量錯誤轉換適配器的效能', () => {
      // 模擬舊版 StandardError
      // eslint-disable-next-line no-unused-vars
      const createStandardError = (code, message, details) => {
        // eslint-disable-next-line no-unused-vars
        const error = new Error(message)
        error.code = code
        error.details = details
        return error
      }

      // 預熱
      performanceBenchmark.warmup(() => {
        // eslint-disable-next-line no-unused-vars
        const oldError = createStandardError('DOM_READMOO_PAGE_NOT_DETECTED', '測試', {})
        return UC01ErrorAdapter.convertError('DOM_READMOO_PAGE_NOT_DETECTED', '測試', {})
      })

      // 測量 ErrorAdapter 轉換效能
      // eslint-disable-next-line no-unused-vars
      const adapterResult = performanceBenchmark.measureBatch((i) => {
        // eslint-disable-next-line no-unused-vars
        const standardErrorCode = 'DOM_READMOO_PAGE_NOT_DETECTED'
        // eslint-disable-next-line no-unused-vars
        const message = `轉換測試錯誤 ${i}`
        // eslint-disable-next-line no-unused-vars
        const details = { iteration: i, type: 'adapter_test' }

        return UC01ErrorAdapter.convertError(standardErrorCode, message, details)
      }, 2000, 'error_adapter_conversion')

      // 測量直接建立 ErrorCodes 效能
      // eslint-disable-next-line no-unused-vars
      const directResult = performanceBenchmark.measureBatch((i) => {
        return UC01ErrorFactory.createError(
          'DOM_READMOO_PAGE_NOT_DETECTED',
          `直接建立測試錯誤 ${i}`,
          { iteration: i, type: 'direct_test' }
        )
      }, 2000, 'direct_error_creation')

      statisticsCollector.record('adapter_conversion', adapterResult)
      statisticsCollector.record('direct_creation', directResult)

      // 比較轉換和直接建立的效能
      // eslint-disable-next-line no-unused-vars
      const comparison = statisticsCollector.compare('adapter_conversion', 'direct_creation')

      // eslint-disable-next-line no-console
      console.log('ErrorAdapter 轉換效能:')
      // eslint-disable-next-line no-console
      console.log(`  平均時間: ${adapterResult.averageDuration.toFixed(3)} ms`)
      // eslint-disable-next-line no-console
      console.log(`  95%: ${adapterResult.statistics.p95.toFixed(3)} ms`)

      // eslint-disable-next-line no-console
      console.log('直接建立效能:')
      // eslint-disable-next-line no-console
      console.log(`  平均時間: ${directResult.averageDuration.toFixed(3)} ms`)
      // eslint-disable-next-line no-console
      console.log(`  95%: ${directResult.statistics.p95.toFixed(3)} ms`)

      // eslint-disable-next-line no-console
      console.log(`效能比較: ${comparison.description}`)

      // 轉換效能應該與直接建立相近
      expect(comparison.speedup).toBeLessThanOrEqual(3.0) // 轉換不應該超過直接建立的 3 倍時間
      expect(adapterResult.statistics.mean).toBeLessThanOrEqual(2.0) // 平均轉換時間不超過 2ms

      // 驗證轉換結果正確性
      // eslint-disable-next-line no-unused-vars
      const adaptedError = adapterResult.measurements[0].result
      // eslint-disable-next-line no-unused-vars
      const directError = directResult.measurements[0].result

      expect(adaptedError.code).toBe(directError.code)
      expect(adaptedError.message).toContain('轉換測試錯誤')
      expect(directError.message).toContain('直接建立測試錯誤')
    })
  })

  describe('📊 效能回歸檢測', () => {
    test('應該建立效能基準線並檢測回歸', () => {
      // eslint-disable-next-line no-unused-vars
      const baselineTest = () => {
        return UC01ErrorFactory.createError(
          'DOM_BOOK_ELEMENTS_NOT_FOUND',
          '基準測試錯誤',
          { type: 'baseline' }
        )
      }

      // 建立效能基準線
      // eslint-disable-next-line no-unused-vars
      const baselineResult = performanceBenchmark.measureBatch(baselineTest, 5000, 'performance_baseline')

      // 模擬可能的效能回歸（添加額外處理）
      // eslint-disable-next-line no-unused-vars
      const regressionTest = () => {
        // eslint-disable-next-line no-unused-vars
        const error = UC01ErrorFactory.createError(
          'DOM_BOOK_ELEMENTS_NOT_FOUND',
          '回歸測試錯誤',
          { type: 'regression' }
        )

        // 模擬額外的處理（例如額外的驗證或日誌記錄）
        JSON.stringify(error)
        error.toString()
        Object.keys(error.details)

        return error
      }

      // eslint-disable-next-line no-unused-vars
      const regressionResult = performanceBenchmark.measureBatch(regressionTest, 5000, 'regression_test')

      statisticsCollector.record('baseline', baselineResult)
      statisticsCollector.record('regression', regressionResult)

      // 分析效能回歸
      // eslint-disable-next-line no-unused-vars
      const regression = statisticsCollector.compare('baseline', 'regression')
      // eslint-disable-next-line no-unused-vars
      const regressionThreshold = 0.2 // 20% 回歸閾值

      // eslint-disable-next-line no-console
      console.log('效能基準線:')
      // eslint-disable-next-line no-console
      console.log(`  平均時間: ${baselineResult.averageDuration.toFixed(3)} ms`)
      // eslint-disable-next-line no-console
      console.log(`  標準差: ${baselineResult.statistics.standardDeviation.toFixed(3)} ms`)

      // eslint-disable-next-line no-console
      console.log('回歸測試:')
      // eslint-disable-next-line no-console
      console.log(`  平均時間: ${regressionResult.averageDuration.toFixed(3)} ms`)
      // eslint-disable-next-line no-console
      console.log(`  標準差: ${regressionResult.statistics.standardDeviation.toFixed(3)} ms`)

      // eslint-disable-next-line no-console
      console.log(`效能變化: ${regression.description}`)

      // 檢測是否有顯著的效能回歸
      if (Math.abs(regression.improvement) > regressionThreshold) {
        if (regression.improvement < 0) {
          // eslint-disable-next-line no-console
          console.warn(`⚠️ 檢測到效能回歸: ${(Math.abs(regression.improvement) * 100).toFixed(1)}%`)
        } else {
          // eslint-disable-next-line no-console
          console.log(`✅ 檢測到效能改善: ${(regression.improvement * 100).toFixed(1)}%`)
        }
      } else {
        // eslint-disable-next-line no-console
        console.log('✅ 效能穩定，無顯著變化')
      }

      // 驗證效能沒有嚴重回歸
      expect(Math.abs(regression.improvement)).toBeLessThanOrEqual(2.0) // 變化不超過 200% (測試環境允許更大波動)

      // 功能正確性驗證
      expect(baselineResult.measurements.every(m => m.result.code === ErrorCodes.DOM_ERROR)).toBe(true)
      expect(regressionResult.measurements.every(m => m.result.code === ErrorCodes.DOM_ERROR)).toBe(true)
    })
  })

  afterAll(() => {
    // 生成完整的效能報告
    // eslint-disable-next-line no-unused-vars
    const report = statisticsCollector.generateReport()

    // eslint-disable-next-line no-console
    console.log('\n⚡ ErrorCodes 錯誤建立效能基準測試完整報告:')
    // eslint-disable-next-line no-console
    console.log('================================================')

    // eslint-disable-next-line no-console
    console.log('\n📊 效能摘要:')
    Object.entries(report.summary).forEach(([testName, summary]) => {
      // eslint-disable-next-line no-console
      console.log(`  ${testName}:`)
      // eslint-disable-next-line no-console
      console.log(`    平均時間: ${summary.averageDuration.toFixed(3)} ms`)
      // eslint-disable-next-line no-console
      console.log(`    95% 時間: ${summary.p95Duration.toFixed(3)} ms`)
      // eslint-disable-next-line no-console
      console.log(`    測試次數: ${summary.iterations}`)
    })

    // eslint-disable-next-line no-console
    console.log('\n🎯 基準達成狀況:')
    // eslint-disable-next-line no-unused-vars
    const baselineTargets = {
      basic_error_creation: { target: 0.5, description: '基本錯誤建立 (目標: < 0.5ms)' },
      complex_error_creation: { target: 5.0, description: '複雜錯誤建立 (目標: < 5ms)' },
      common_errors: { target: 0.1, description: 'CommonErrors 存取 (目標: < 0.1ms)' }
    }

    Object.entries(baselineTargets).forEach(([testName, baseline]) => {
      // eslint-disable-next-line no-unused-vars
      const result = report.summary[testName]
      if (result) {
        // eslint-disable-next-line no-unused-vars
        const achieved = result.averageDuration <= baseline.target
        // eslint-disable-next-line no-unused-vars
        const status = achieved ? '✅' : '❌'
        // eslint-disable-next-line no-console
        console.log(`  ${status} ${baseline.description}: ${result.averageDuration.toFixed(3)} ms`)
      }
    })

    // eslint-disable-next-line no-console
    console.log('\n🔄 效能比較:')
    // eslint-disable-next-line no-unused-vars
    const comparisons = [
      { test1: 'common_errors', test2: 'dynamic_creation', description: 'CommonErrors vs 動態建立' },
      { test1: 'adapter_conversion', test2: 'direct_creation', description: 'Adapter 轉換 vs 直接建立' }
    ]

    comparisons.forEach(({ test1, test2, description }) => {
      try {
        // eslint-disable-next-line no-unused-vars
        const comparison = statisticsCollector.compare(test1, test2)
        // eslint-disable-next-line no-console
        console.log(`  ${description}: ${comparison.description} (${comparison.speedup.toFixed(1)}x)`)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log(`  ${description}: 比較資料不可用`)
      }
    })

    // eslint-disable-next-line no-console
    console.log('\n📈 建議:')
    // eslint-disable-next-line no-console
    console.log('  1. 盡可能使用 CommonErrors 預編譯錯誤以獲得最佳效能')
    // eslint-disable-next-line no-console
    console.log('  2. 複雜錯誤物件的 details 應保持合理大小')
    // eslint-disable-next-line no-console
    console.log('  3. 在熱路徑中謹慎使用錯誤處理以避免效能影響')
    // eslint-disable-next-line no-console
    console.log('  4. 定期執行效能基準測試以檢測回歸')
  })
})
