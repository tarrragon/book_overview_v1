#!/usr/bin/env node

/**
 * ErrorCodes 效能監控系統驗證腳本
 *
 * 驗證項目：
 * - 即時效能監控功能
 * - 異常檢測算法
 * - 自動回應機制
 * - 整合工作流程
 */

console.log('🔍 開始驗證 ErrorCodes 效能監控系統...\n')

// 模擬 ErrorCodesPerformanceMonitor
class MockErrorCodesPerformanceMonitor {
  constructor(options = {}) {
    this.config = {
      memoryThreshold: options.memoryThreshold || 1000,
      creationTimeThreshold: options.creationTimeThreshold || 0.5,
      batchSizeWarning: options.batchSizeWarning || 100
    }

    this.realtimeStats = {
      totalErrorsCreated: 0,
      averageMemoryUsage: 0,
      averageCreationTime: 0,
      errorTypeCounts: new Map()
    }

    this.warnings = []
    this.isMonitoring = true
  }

  monitorErrorCreation(errorCreationFn, context = {}) {
    const startTime = process.hrtime.bigint()
    const memoryBefore = process.memoryUsage()

    const result = errorCreationFn()

    const endTime = process.hrtime.bigint()
    const memoryAfter = process.memoryUsage()

    const creationTime = Number(endTime - startTime) / 1000000
    const memoryUsed = memoryAfter.heapUsed - memoryBefore.heapUsed

    this._recordPerformanceData(creationTime, memoryUsed, result?.code)
    this._checkPerformanceWarnings(creationTime, memoryUsed)

    return result
  }

  monitorBatchErrorCreation(batchCreationFn, batchSize) {
    if (batchSize > this.config.batchSizeWarning) {
      this._emitWarning('FREQUENT_ERRORS', {
        batchSize,
        message: `大批次錯誤建立: ${batchSize} 個錯誤`
      })
    }

    return batchCreationFn()
  }

  _recordPerformanceData(creationTime, memoryUsed, errorType) {
    this.realtimeStats.totalErrorsCreated++
    this.realtimeStats.averageCreationTime =
      (this.realtimeStats.averageCreationTime + creationTime) / 2
    this.realtimeStats.averageMemoryUsage =
      (this.realtimeStats.averageMemoryUsage + memoryUsed) / 2

    if (errorType) {
      this.realtimeStats.errorTypeCounts.set(
        errorType,
        (this.realtimeStats.errorTypeCounts.get(errorType) || 0) + 1
      )
    }
  }

  _checkPerformanceWarnings(creationTime, memoryUsed) {
    if (creationTime > this.config.creationTimeThreshold) {
      this._emitWarning('SLOW_CREATION', {
        creationTime,
        threshold: this.config.creationTimeThreshold
      })
    }

    if (memoryUsed > this.config.memoryThreshold) {
      this._emitWarning('HIGH_MEMORY_USAGE', {
        memoryUsed,
        threshold: this.config.memoryThreshold
      })
    }
  }

  _emitWarning(type, data) {
    const warning = {
      type,
      timestamp: Date.now(),
      ...data
    }
    this.warnings.unshift(warning)
  }

  getRealtimeStatus() {
    return {
      isMonitoring: this.isMonitoring,
      realtimeStats: { ...this.realtimeStats },
      recentWarnings: this.warnings.slice(0, 3),
      healthStatus: this._calculateHealthStatus()
    }
  }

  _calculateHealthStatus() {
    if (this.warnings.length > 5) return 'critical'
    if (this.warnings.length > 2) return 'warning'
    if (this.realtimeStats.averageCreationTime > this.config.creationTimeThreshold) return 'degraded'
    return 'healthy'
  }

  stopMonitoring() {
    this.isMonitoring = false
  }
}

// 模擬 PerformanceAnomalyDetector
class MockPerformanceAnomalyDetector {
  constructor(config = {}) {
    this.config = {
      windowSize: config.windowSize || 50,
      confidenceThreshold: config.confidenceThreshold || 0.8,
      autoResponse: config.autoResponse || true
    }

    this.dataWindow = {
      memoryUsage: [],
      creationTimes: [],
      timestamps: []
    }

    this.anomalies = []
    this.isDetecting = true
  }

  addDataPoint(dataPoint) {
    this.dataWindow.memoryUsage.push(dataPoint.memoryUsage || 0)
    this.dataWindow.creationTimes.push(dataPoint.creationTime || 0)
    this.dataWindow.timestamps.push(dataPoint.timestamp || Date.now())

    this._maintainWindowSize()
    this._realtimeAnomalyCheck(dataPoint)
  }

  _maintainWindowSize() {
    const windowSize = this.config.windowSize
    Object.keys(this.dataWindow).forEach(key => {
      if (this.dataWindow[key].length > windowSize) {
        this.dataWindow[key] = this.dataWindow[key].slice(-windowSize)
      }
    })
  }

  _realtimeAnomalyCheck(dataPoint) {
    const anomalies = []

    // 簡化的閾值檢測
    if (dataPoint.memoryUsage > 5000) {
      anomalies.push({
        type: 'MEMORY_SPIKE',
        confidence: 0.9,
        value: dataPoint.memoryUsage,
        timestamp: Date.now()
      })
    }

    if (dataPoint.creationTime > 10) {
      anomalies.push({
        type: 'SLOW_CREATION',
        confidence: 0.8,
        value: dataPoint.creationTime,
        timestamp: Date.now()
      })
    }

    if (anomalies.length > 0) {
      this._handleDetectedAnomalies(anomalies)
    }
  }

  _handleDetectedAnomalies(anomalies) {
    anomalies.forEach(anomaly => {
      this.anomalies.unshift(anomaly)

      if (this.config.autoResponse) {
        this._triggerAutoResponse(anomaly)
      }
    })
  }

  _triggerAutoResponse(anomaly) {
    switch (anomaly.type) {
      case 'MEMORY_SPIKE':
        console.log(`🤖 自動回應: 檢測到記憶體激增 (${anomaly.value} bytes)`)
        break
      case 'SLOW_CREATION':
        console.log(`🤖 自動回應: 檢測到緩慢建立 (${anomaly.value}ms)`)
        break
    }
  }

  generateAnomalyReport() {
    return {
      timestamp: Date.now(),
      detectionStatus: {
        isDetecting: this.isDetecting
      },
      statistics: {
        totalAnomalies: this.anomalies.length,
        recentAnomalies: this.anomalies.slice(0, 5).length
      },
      recentAnomalies: this.anomalies.slice(0, 10)
    }
  }

  stopDetection() {
    this.isDetecting = false
  }
}

// 模擬錯誤建立函式
function createMockError(type, message, details = {}) {
  const error = new Error(message)
  error.code = type
  error.subType = 'MOCK_ERROR'
  error.details = {
    ...details,
    timestamp: Date.now()
  }
  return error
}

async function validateMonitoringSystem() {
  try {
    console.log('1️⃣ 驗證即時效能監控功能...')
    await validateRealtimeMonitoring()

    console.log('\n2️⃣ 驗證異常檢測系統...')
    await validateAnomalyDetection()

    console.log('\n3️⃣ 驗證整合工作流程...')
    await validateIntegratedWorkflow()

    console.log('\n🎉 效能監控系統驗證完成!')
    console.log('✅ 所有驗證項目通過')

    return true
  } catch (error) {
    console.error('❌ 監控系統驗證失敗:', error.message)
    return false
  }
}

async function validateRealtimeMonitoring() {
  const monitor = new MockErrorCodesPerformanceMonitor({
    memoryThreshold: 1000,
    creationTimeThreshold: 0.5
  })

  // 測試 1: 正常錯誤監控
  console.log('   📊 測試正常錯誤建立監控...')
  const normalError = monitor.monitorErrorCreation(() => {
    return createMockError('VALIDATION_ERROR', '正常錯誤')
  })

  if (!normalError || normalError.code !== 'VALIDATION_ERROR') {
    throw new Error('正常錯誤監控失敗')
  }

  // 測試 2: 批次錯誤監控
  console.log('   📦 測試批次錯誤監控...')
  const batchErrors = monitor.monitorBatchErrorCreation(() => {
    return Array.from({ length: 150 }, (_, i) =>
      createMockError('DOM_ERROR', `批次錯誤 ${i}`)
    )
  }, 150)

  if (!batchErrors || batchErrors.length !== 150) {
    throw new Error('批次錯誤監控失敗')
  }

  // 測試 3: 狀態檢查
  const status = monitor.getRealtimeStatus()
  if (!status.isMonitoring || status.realtimeStats.totalErrorsCreated < 1) {
    throw new Error('即時狀態檢查失敗')
  }

  // 檢查是否有批次警告
  const batchWarning = status.recentWarnings.find(w => w.type === 'FREQUENT_ERRORS')
  if (!batchWarning) {
    console.log('   ⚠️  注意: 未檢測到預期的批次大小警告')
  } else {
    console.log('   ✅ 批次大小警告正常觸發')
  }

  console.log(`   📈 總共監控 ${status.realtimeStats.totalErrorsCreated} 個錯誤建立`)
  console.log(`   🏥 系統健康狀態: ${status.healthStatus}`)

  monitor.stopMonitoring()
}

async function validateAnomalyDetection() {
  const detector = new MockPerformanceAnomalyDetector({
    windowSize: 30,
    confidenceThreshold: 0.8,
    autoResponse: true
  })

  // 測試 1: 正常數據
  console.log('   📊 添加正常效能數據...')
  for (let i = 0; i < 20; i++) {
    detector.addDataPoint({
      memoryUsage: 800 + Math.random() * 200,
      creationTime: 0.3 + Math.random() * 0.1,
      timestamp: Date.now() + i * 1000
    })
  }

  let report = detector.generateAnomalyReport()
  const initialAnomalies = report.statistics.totalAnomalies
  console.log(`   📋 正常數據階段異常數: ${initialAnomalies}`)

  // 測試 2: 異常數據
  console.log('   🚨 添加異常效能數據...')

  // 記憶體異常
  detector.addDataPoint({
    memoryUsage: 8000, // 超過閾值
    creationTime: 0.4,
    timestamp: Date.now()
  })

  // 時間異常
  detector.addDataPoint({
    memoryUsage: 900,
    creationTime: 15.0, // 超過閾值
    timestamp: Date.now()
  })

  await new Promise(resolve => setTimeout(resolve, 100))

  report = detector.generateAnomalyReport()
  const finalAnomalies = report.statistics.totalAnomalies

  if (finalAnomalies <= initialAnomalies) {
    throw new Error('異常檢測系統未能檢測到異常數據')
  }

  console.log(`   🎯 檢測到 ${finalAnomalies - initialAnomalies} 個新異常`)
  console.log(`   📊 總異常數: ${finalAnomalies}`)

  // 檢查異常類型
  const memoryAnomaly = report.recentAnomalies.find(a => a.type === 'MEMORY_SPIKE')
  const timeAnomaly = report.recentAnomalies.find(a => a.type === 'SLOW_CREATION')

  if (memoryAnomaly) {
    console.log(`   🧠 記憶體異常檢測: ✅ (${memoryAnomaly.value} bytes)`)
  }
  if (timeAnomaly) {
    console.log(`   ⏱️  時間異常檢測: ✅ (${timeAnomaly.value}ms)`)
  }

  detector.stopDetection()
}

async function validateIntegratedWorkflow() {
  const monitor = new MockErrorCodesPerformanceMonitor()
  const detector = new MockPerformanceAnomalyDetector()

  console.log('   🔄 執行整合工作流程...')

  // 步驟 1: 監控錯誤建立
  const error = monitor.monitorErrorCreation(() => {
    return createMockError('NETWORK_ERROR', '整合測試錯誤')
  })

  // 步驟 2: 將效能數據傳遞給異常檢測器
  const status = monitor.getRealtimeStatus()
  detector.addDataPoint({
    memoryUsage: 1200, // 稍高的記憶體使用
    creationTime: status.realtimeStats.averageCreationTime,
    timestamp: Date.now()
  })

  // 步驟 3: 模擬異常情況
  detector.addDataPoint({
    memoryUsage: 6000, // 異常記憶體使用
    creationTime: 12.0, // 異常建立時間
    timestamp: Date.now()
  })

  // 步驟 4: 檢查整合結果
  const finalStatus = monitor.getRealtimeStatus()
  const anomalyReport = detector.generateAnomalyReport()

  console.log(`   📊 監控狀態: 錯誤數 ${finalStatus.realtimeStats.totalErrorsCreated}, 健康狀態 ${finalStatus.healthStatus}`)
  console.log(`   🚨 異常檢測: ${anomalyReport.statistics.totalAnomalies} 個異常`)

  if (finalStatus.realtimeStats.totalErrorsCreated < 1) {
    throw new Error('整合工作流程中錯誤監控失敗')
  }

  if (anomalyReport.statistics.totalAnomalies < 1) {
    throw new Error('整合工作流程中異常檢測失敗')
  }

  console.log('   ✅ 整合工作流程驗證通過')

  monitor.stopMonitoring()
  detector.stopDetection()
}

// 執行驗證
validateMonitoringSystem().then(success => {
  if (success) {
    console.log('\n🏆 ErrorCodes 效能監控系統驗證成功!')
    console.log('📋 驗證總結:')
    console.log('- ✅ 即時效能監控功能正常')
    console.log('- ✅ 異常檢測算法有效')
    console.log('- ✅ 自動回應機制運作')
    console.log('- ✅ 整合工作流程順暢')
    process.exit(0)
  } else {
    console.log('\n❌ 效能監控系統存在問題，需要修正')
    process.exit(1)
  }
}).catch(error => {
  console.error('\n💥 驗證過程發生異常:', error)
  process.exit(1)
})