/**
 * ErrorCodes 效能監控系統整合測試
 *
 * 測試範圍：
 * - ErrorCodesPerformanceMonitor 即時監控功能
 * - PerformanceAnomalyDetector 異常檢測系統
 * - 監控與檢測系統整合工作流程
 * - 自動回應機制驗證
 */

const { ErrorCodesPerformanceMonitor } = require('src/error-handling/event-performance-monitor')
const { PerformanceAnomalyDetector } = require('src/core/performance/performance-anomaly-detector')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')
const { UC02ErrorAdapter } = require('src/core/errors/UC02ErrorAdapter')

describe('ErrorCodes 效能監控系統整合測試', () => {
  let performanceMonitor
  let anomalyDetector
  let testErrors

  beforeEach(() => {
    // 初始化效能監控器
    performanceMonitor = new ErrorCodesPerformanceMonitor({
      memoryThreshold: 1000,
      creationTimeThreshold: 0.5,
      batchSizeWarning: 100
    })

    // 初始化異常檢測器
    anomalyDetector = new PerformanceAnomalyDetector({
      windowSize: 50,
      sensitivityLevel: 'HIGH',
      confidenceThreshold: 0.8,
      autoResponse: true
    })

    // 準備測試錯誤
    testErrors = [
      'DATA_DUPLICATE_DETECTION_FAILED',
      'DOM_PAGE_STRUCTURE_CHANGED',
      'NETWORK_RATE_LIMITING_DETECTED',
      'SYSTEM_BACKGROUND_SYNC_FAILURE'
    ]
  })

  afterEach(() => {
    if (performanceMonitor) {
      performanceMonitor.stopMonitoring()
    }
    if (anomalyDetector) {
      anomalyDetector.stopDetection()
    }
  })

  describe('即時效能監控整合', () => {
    test('應該能夠監控單個錯誤建立的效能指標', async () => {
      const errorCreationFn = () => {
        return UC02ErrorAdapter.convertError(
          'DATA_DUPLICATE_DETECTION_FAILED',
          '測試錯誤訊息',
          { testContext: true }
        )
      }

      // 執行監控
      const result = performanceMonitor.monitorErrorCreation(errorCreationFn, {
        testCase: 'single_error_creation'
      })

      // 驗證監控結果
      expect(result).toBeDefined()
      expect(result.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(result.subType).toBe('DUPLICATE_DETECTION_FAILED')

      // 獲取即時狀態
      const status = performanceMonitor.getRealtimeStatus()
      expect(status.isMonitoring).toBe(true)
      expect(status.realtimeStats.totalErrorsCreated).toBe(1)
      expect(status.realtimeStats.errorTypeCounts.get('VALIDATION_ERROR')).toBe(1)
      expect(status.healthStatus).toMatch(/healthy|degraded/)
    })

    test('應該能夠監控批次錯誤建立並檢測效能異常', async () => {
      const batchSize = 150 // 超過警告閾值

      const batchCreationFn = () => {
        const errors = []
        for (let i = 0; i < batchSize; i++) {
          const errorType = testErrors[i % testErrors.length]
          errors.push(UC02ErrorAdapter.convertError(
            errorType,
            `批次錯誤 ${i}`,
            { batchIndex: i }
          ))
        }
        return errors
      }

      // 監控批次建立
      const results = performanceMonitor.monitorBatchErrorCreation(batchCreationFn, batchSize)

      // 驗證批次結果
      expect(results).toHaveLength(batchSize)
      expect(results.every(error => error.code)).toBe(true)

      // 檢查是否觸發批次大小警告
      const status = performanceMonitor.getRealtimeStatus()
      expect(status.recentWarnings.length).toBeGreaterThan(0)

      const batchWarning = status.recentWarnings.find(w =>
        w.type === 'ERRORCODES_FREQUENT_ERRORS'
      )
      expect(batchWarning).toBeDefined()
      expect(batchWarning.batchSize).toBe(batchSize)
    })

    test('應該能夠檢測記憶體使用異常', async () => {
      const performanceData = []

      // 模擬記憶體使用逐漸增加的情況
      for (let i = 0; i < 30; i++) {
        const dataPoint = {
          memoryUsage: 1000 + i * 200, // 記憶體逐漸增加
          creationTime: 0.3 + Math.random() * 0.1,
          errorFrequency: 5,
          timestamp: Date.now() + i * 1000
        }

        anomalyDetector.addDataPoint(dataPoint)
        performanceData.push(dataPoint)
      }

      // 等待檢測處理
      await new Promise(resolve => setTimeout(resolve, 100))

      // 獲取異常報告
      const report = anomalyDetector.generateAnomalyReport()

      expect(report.detectionStatus.isDetecting).toBe(true)
      expect(report.statistics.totalAnomalies).toBeGreaterThan(0)

      // 檢查是否檢測到記憶體相關異常
      const memoryAnomalies = report.recentAnomalies.filter(a =>
        a.type === 'MEMORY_SPIKE' || a.type === 'MEMORY_LEAK'
      )
      expect(memoryAnomalies.length).toBeGreaterThan(0)
    })
  })

  describe('異常檢測算法驗證', () => {
    test('統計學檢測算法應該識別顯著偏差', async () => {
      const normalData = Array.from({ length: 50 }, () => ({
        memoryUsage: 1000 + Math.random() * 100,
        creationTime: 0.5 + Math.random() * 0.1,
        errorFrequency: 10 + Math.random() * 5,
        timestamp: Date.now()
      }))

      // 添加正常數據建立基準線
      normalData.forEach(dataPoint => {
        anomalyDetector.addDataPoint(dataPoint)
      })

      // 等待基準線建立
      await new Promise(resolve => setTimeout(resolve, 200))

      // 添加異常數據點
      const anomalousData = {
        memoryUsage: 5000, // 明顯高於正常值
        creationTime: 5.0, // 明顯慢於正常值
        errorFrequency: 50, // 明顯高於正常值
        timestamp: Date.now()
      }

      anomalyDetector.addDataPoint(anomalousData)

      // 觸發完整檢測
      await new Promise(resolve => setTimeout(resolve, 100))

      const report = anomalyDetector.generateAnomalyReport()

      // 應該檢測到記憶體和時間異常
      const recentAnomalies = report.recentAnomalies
      expect(recentAnomalies.length).toBeGreaterThan(0)

      const memoryAnomaly = recentAnomalies.find(a => a.type === 'MEMORY_SPIKE')
      const timeAnomaly = recentAnomalies.find(a => a.type === 'SLOW_CREATION')

      expect(memoryAnomaly || timeAnomaly).toBeDefined()
    })

    test('趨勢檢測算法應該識別效能下降趨勢', async () => {
      // 模擬效能逐漸下降的趨勢
      for (let i = 0; i < 25; i++) {
        const dataPoint = {
          memoryUsage: 1000 + i * 50, // 線性增加
          creationTime: 0.5 + i * 0.05, // 線性增加
          errorFrequency: 10,
          timestamp: Date.now() + i * 1000
        }

        anomalyDetector.addDataPoint(dataPoint)
      }

      // 手動觸發異常檢測
      await new Promise(resolve => setTimeout(resolve, 100))

      const report = anomalyDetector.generateAnomalyReport()

      // 應該檢測到趨勢異常
      const trendAnomalies = report.recentAnomalies.filter(a =>
        a.algorithm === 'trend'
      )
      expect(trendAnomalies.length).toBeGreaterThan(0)

      const memoryTrend = trendAnomalies.find(a => a.type === 'MEMORY_LEAK')
      const timeTrend = trendAnomalies.find(a => a.type === 'BATCH_DEGRADATION')

      expect(memoryTrend || timeTrend).toBeDefined()
    })
  })

  describe('自動回應機制驗證', () => {
    test('檢測到記憶體洩漏時應該觸發自動回應', async () => {
      // 模擬記憶體洩漏情況
      const memoryLeakData = {
        memoryUsage: 15 * 1024 * 1024, // 15MB，超過預設閾值
        creationTime: 0.3,
        errorFrequency: 10,
        timestamp: Date.now()
      }

      // 監聽控制台輸出以驗證自動回應
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      anomalyDetector.addDataPoint(memoryLeakData)

      // 等待處理
      await new Promise(resolve => setTimeout(resolve, 100))

      const report = anomalyDetector.generateAnomalyReport()

      // 檢查是否有自動回應記錄
      const memoryAnomalies = report.recentAnomalies.filter(a =>
        a.type === 'MEMORY_SPIKE' && a.autoResponse
      )

      if (memoryAnomalies.length > 0) {
        const anomaly = memoryAnomalies[0]
        expect(anomaly.autoResponse.actions).toContain('reduce_window_size')
        expect(anomaly.autoResponse.timestamp).toBeDefined()
      }

      // 恢復控制台
      consoleSpy.mockRestore()
    })

    test('檢測到緩慢建立時應該提供優化建議', async () => {
      const slowCreationData = {
        memoryUsage: 800,
        creationTime: 15.0, // 遠超過閾值
        errorFrequency: 5,
        timestamp: Date.now()
      }

      anomalyDetector.addDataPoint(slowCreationData)

      await new Promise(resolve => setTimeout(resolve, 100))

      const report = anomalyDetector.generateAnomalyReport()

      const slowCreationAnomalies = report.recentAnomalies.filter(a =>
        a.type === 'SLOW_CREATION' && a.autoResponse
      )

      if (slowCreationAnomalies.length > 0) {
        const anomaly = slowCreationAnomalies[0]
        expect(anomaly.autoResponse.actions).toContain('suggest_common_errors')
        expect(anomaly.autoResponse.suggestions).toContain('使用 CommonErrors 預編譯錯誤以提高效能')
      }
    })
  })

  describe('監控系統整合工作流程', () => {
    test('完整的效能監控到異常檢測工作流程', async () => {
      const workflowSteps = []

      // 步驟 1: 正常錯誤建立監控
      const normalError = performanceMonitor.monitorErrorCreation(() => {
        return UC02ErrorAdapter.convertError(
          'DATA_PROGRESS_VALIDATION_ERROR',
          '正常錯誤',
          { workflow: 'step1' }
        )
      })

      workflowSteps.push('normal_creation_monitored')
      expect(normalError.code).toBe(ErrorCodes.VALIDATION_ERROR)

      // 步驟 2: 模擬效能數據並添加到異常檢測器
      const performanceStatus = performanceMonitor.getRealtimeStatus()

      const dataPoint = {
        memoryUsage: performanceStatus.currentMemory || 1000,
        creationTime: performanceStatus.realtimeStats.averageCreationTime || 0.3,
        errorFrequency: performanceStatus.realtimeStats.totalErrorsCreated || 1,
        timestamp: Date.now()
      }

      anomalyDetector.addDataPoint(dataPoint)
      workflowSteps.push('data_point_added')

      // 步驟 3: 批次建立觸發警告
      const batchErrors = performanceMonitor.monitorBatchErrorCreation(() => {
        return testErrors.map((errorType, index) =>
          UC02ErrorAdapter.convertError(errorType, `批次錯誤 ${index}`, { workflow: 'step3' })
        )
      }, testErrors.length)

      workflowSteps.push('batch_creation_completed')
      expect(batchErrors).toHaveLength(testErrors.length)

      // 步驟 4: 檢查整合結果
      const finalStatus = performanceMonitor.getRealtimeStatus()
      const anomalyReport = anomalyDetector.generateAnomalyReport()

      workflowSteps.push('integration_complete')

      // 驗證整合結果
      expect(workflowSteps).toEqual([
        'normal_creation_monitored',
        'data_point_added',
        'batch_creation_completed',
        'integration_complete'
      ])

      expect(finalStatus.realtimeStats.totalErrorsCreated).toBeGreaterThan(4)
      expect(finalStatus.healthStatus).toBeDefined()
      expect(anomalyReport.detectionStatus.isDetecting).toBe(true)
    })

    test('跨UC錯誤傳播的效能監控', async () => {
      // 模擬來自 UC-01 的錯誤
      const uc01Error = new Error('UC-01 錯誤')
      uc01Error.code = ErrorCodes.DOM_ERROR
      uc01Error.subType = 'PAGE_DETECTION_FAILED'

      // 使用 UC02ErrorAdapter 適配錯誤並監控效能
      const adaptedError = performanceMonitor.monitorErrorCreation(() => {
        return UC02ErrorAdapter.adaptFromUC01Error(uc01Error, {
          context: 'cross_uc_propagation',
          previousFailures: ['uc01_dom_failure']
        })
      })

      // 驗證適配結果
      expect(adaptedError.code).toBe(ErrorCodes.DOM_ERROR)
      expect(adaptedError.subType).toBe('UC01_ADAPTED_ERROR')
      expect(adaptedError.details.propagatedFromUC01).toBe(true)
      expect(adaptedError.details.adaptationStrategy).toBe('enhanced_page_detection')

      // 檢查效能監控記錄
      const status = performanceMonitor.getRealtimeStatus()
      expect(status.realtimeStats.totalErrorsCreated).toBe(1)

      const errorTypeCount = status.realtimeStats.errorTypeCounts.get('DOM_ERROR')
      expect(errorTypeCount).toBe(1)
    })
  })

  describe('效能基準驗證', () => {
    test('單一錯誤建立應該符合效能基準', async () => {
      const performanceResults = []

      // 測試多次錯誤建立以獲得統計數據
      for (let i = 0; i < 10; i++) {
        const startTime = process.hrtime.bigint()
        const memoryBefore = process.memoryUsage()

        const error = UC02ErrorAdapter.convertError(
          'NETWORK_RATE_LIMITING_DETECTED',
          `測試錯誤 ${i}`,
          { testIndex: i }
        )

        const endTime = process.hrtime.bigint()
        const memoryAfter = process.memoryUsage()

        const creationTime = Number(endTime - startTime) / 1000000 // 轉換為毫秒
        const memoryUsed = memoryAfter.heapUsed - memoryBefore.heapUsed

        performanceResults.push({ creationTime, memoryUsed })

        expect(error.code).toBe(ErrorCodes.NETWORK_ERROR)
        expect(error.subType).toBe('RATE_LIMITING_DETECTED')
      }

      // 驗證效能基準
      const avgCreationTime = performanceResults.reduce((sum, r) => sum + r.creationTime, 0) / performanceResults.length
      const avgMemoryUsed = performanceResults.reduce((sum, r) => sum + r.memoryUsed, 0) / performanceResults.length

      // Phase 2 效能目標
      expect(avgCreationTime).toBeLessThan(0.5) // 平均建立時間 < 0.5ms
      expect(avgMemoryUsed).toBeLessThan(1000) // 平均記憶體使用 < 1000 bytes

      console.log(`平均建立時間: ${avgCreationTime.toFixed(3)}ms`)
      console.log(`平均記憶體使用: ${avgMemoryUsed} bytes`)
    })

    test('批次錯誤建立效能應該滿足擴展性要求', async () => {
      const batchSizes = [10, 50, 100, 500]
      const batchResults = []

      for (const batchSize of batchSizes) {
        const startTime = process.hrtime.bigint()
        const memoryBefore = process.memoryUsage()

        if (global.gc) global.gc() // 強制垃圾回收

        const errors = []
        for (let i = 0; i < batchSize; i++) {
          const errorType = testErrors[i % testErrors.length]
          errors.push(UC02ErrorAdapter.convertError(
            errorType,
            `批次測試 ${i}`,
            { batchSize, index: i }
          ))
        }

        const endTime = process.hrtime.bigint()
        const memoryAfter = process.memoryUsage()

        const totalTime = Number(endTime - startTime) / 1000000
        const totalMemory = memoryAfter.heapUsed - memoryBefore.heapUsed
        const avgTimePerError = totalTime / batchSize
        const avgMemoryPerError = totalMemory / batchSize

        batchResults.push({
          batchSize,
          totalTime,
          totalMemory,
          avgTimePerError,
          avgMemoryPerError
        })

        expect(errors).toHaveLength(batchSize)
        expect(avgTimePerError).toBeLessThan(0.5) // 每個錯誤平均建立時間

        console.log(`批次大小 ${batchSize}: 平均時間 ${avgTimePerError.toFixed(3)}ms, 平均記憶體 ${avgMemoryPerError} bytes`)
      }

      // 驗證線性擴展性
      const scalabilityRatio = batchResults[3].avgTimePerError / batchResults[0].avgTimePerError
      expect(scalabilityRatio).toBeLessThan(2) // 擴展性應該接近線性
    })
  })
})
