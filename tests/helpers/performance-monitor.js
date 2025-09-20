const { ErrorCodes } = require('src/core/errors/ErrorCodes')
/**
 * 效能監控系統
 *
 * 負責監控測試執行過程中的效能指標
 * 提供記憶體使用、執行時間、API呼叫統計等功能
 */

class PerformanceMonitor {
  constructor () {
    this.isTracking = false
    this.metrics = {}
    this.startTime = null
    this.memoryBaseline = null
    this.timers = new Map()
    this.memorySnapshots = []
    this.performanceEntries = []
    this.isRecording = false
    this.baselineMemory = null
    this.memoryMonitoringTimer = null
  }

  startTracking () {
    this.isTracking = true
    this.startTime = Date.now()
    this.metrics = {
      operations: [],
      memoryUsage: [],
      apiCalls: [],
      errors: []
    }

    // 記錄基準記憶體使用量
    this.recordMemoryUsage('baseline')
  }

  stopTracking () {
    if (!this.isTracking) return null

    this.isTracking = false
    const endTime = Date.now()

    // 記錄最終記憶體使用量
    this.recordMemoryUsage('final')

    return {
      totalTime: endTime - this.startTime,
      operations: this.metrics.operations.length,
      memoryGrowth: this.calculateMemoryGrowth(),
      apiCalls: this.metrics.apiCalls.length,
      errors: this.metrics.errors.length,
      averageOperationTime: this.calculateAverageOperationTime()
    }
  }

  recordOperation (operationName, duration, details = {}) {
    if (!this.isTracking) return

    this.metrics.operations.push({
      name: operationName,
      duration,
      timestamp: Date.now(),
      details
    })
  }

  recordMemoryUsage (checkpoint) {
    if (!this.isTracking) return

    const memory = this.getCurrentMemoryUsage()

    if (checkpoint === 'baseline') {
      this.memoryBaseline = memory.heapUsed || memory.used || memory
    }

    this.metrics.memoryUsage.push({
      checkpoint,
      used: memory.heapUsed || memory.used || memory,
      total: memory.heapTotal || memory.total || (100 * 1024 * 1024),
      timestamp: Date.now()
    })
  }

  getCurrentMemoryUsage () {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      // Node.js環境 - 高精度記憶體監控
      const memUsage = process.memoryUsage()
      return {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        arrayBuffers: memUsage.arrayBuffers || 0,
        environment: 'nodejs',
        precision: 'high'
      }
    } else if (typeof performance !== 'undefined' && performance.memory) {
      // 瀏覽器環境 - Chrome Extension優化
      return {
        heapUsed: performance.memory.usedJSHeapSize,
        heapTotal: performance.memory.totalJSHeapSize,
        heapLimit: performance.memory.jsHeapSizeLimit,
        environment: 'browser',
        precision: 'medium'
      }
    } else {
      // 測試環境 - 改善模擬精度
      const baseMemory = 15 * 1024 * 1024 // 15MB基礎
      const variationMB = (Math.random() - 0.5) * 4 // ±2MB變化
      const currentTime = Date.now()

      // 更真實的記憶體模擬：基於時間和操作的小幅變化
      const timeVariation = (currentTime % 10000) / 10000 * 1024 * 1024 // 最多1MB的時間變化
      const simulatedUsed = baseMemory + (variationMB * 1024 * 1024) + timeVariation

      return {
        heapUsed: Math.max(10 * 1024 * 1024, simulatedUsed), // 最少10MB
        heapTotal: 50 * 1024 * 1024, // 50MB總額
        heapLimit: 100 * 1024 * 1024,
        environment: 'test',
        precision: 'simulated',
        estimated: true
      }
    }
  }

  // 記憶體數值提取工具函數
  extractMemoryValue (memoryObject) {
    if (typeof memoryObject === 'number') return memoryObject
    return memoryObject.heapUsed || memoryObject.used || memoryObject || 0
  }

  // 記憶體使用模式報告
  getMemoryProfile () {
    if (this.memorySnapshots.length < 2) {
      return {
        status: 'insufficient_data',
        snapshots: this.memorySnapshots.length,
        recommendation: '需要至少2個記憶體快照進行分析'
      }
    }

    const profile = this.analyzeMemoryProfile(this.memorySnapshots)
    const latestSnapshot = this.memorySnapshots[this.memorySnapshots.length - 1]
    const baselineSnapshot = this.memorySnapshots[0]
    const leakAnalysis = this.performAdvancedLeakDetection(profile)
    const dynamicBaseline = this.calculateDynamicBaseline(profile)

    return {
      status: 'analyzed',
      snapshots: this.memorySnapshots.length,
      growthMB: leakAnalysis.growthMB,
      trend: profile.trend,
      variability: profile.variability,
      patternScore: leakAnalysis.patternScore,
      dynamicThreshold: dynamicBaseline.threshold,
      riskLevel: this.assessLeakRisk(leakAnalysis, dynamicBaseline),
      confidence: leakAnalysis.confidence,
      timeSpanMs: latestSnapshot.timestamp - baselineSnapshot.timestamp
    }
  }

  startTimer (operationName) {
    if (this.timers.has(operationName)) {
      throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
    }

    this.timers.set(operationName, {
      startTime: performance.now(),
      startMemory: this.getCurrentMemoryUsage()
    })
  }

  endTimer (operationName) {
    if (!this.timers.has(operationName)) {
      throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.NOT_FOUND_ERROR; error.details = { category: 'testing' }; return error })()
    }

    const timer = this.timers.get(operationName)
    const endTime = performance.now()
    const duration = endTime - timer.startTime
    const currentMemory = this.getCurrentMemoryUsage()
    const memoryDelta = (currentMemory.heapUsed || currentMemory.used || currentMemory) - (timer.startMemory.heapUsed || timer.startMemory.used || timer.startMemory)

    this.timers.delete(operationName)

    const result = {
      operationName,
      duration,
      memoryDelta,
      startTime: timer.startTime,
      endTime
    }

    this.performanceEntries.push(result)
    if (this.isTracking) {
      this.recordOperation(operationName, duration, { memoryDelta })
    }
    return result
  }

  recordAPICall (apiName, duration, success = true) {
    if (!this.isTracking) return

    this.metrics.apiCalls.push({
      api: apiName,
      duration,
      success,
      timestamp: Date.now()
    })
  }

  recordError (error, context = '') {
    if (!this.isTracking) return

    this.metrics.errors.push({
      message: error.message || error,
      context,
      stack: error.stack,
      timestamp: Date.now()
    })
  }

  calculateMemoryGrowth () {
    if (this.metrics.memoryUsage.length < 2) return 0

    const baseline = this.metrics.memoryUsage.find(m => m.checkpoint === 'baseline')
    const final = this.metrics.memoryUsage.find(m => m.checkpoint === 'final')

    if (!baseline || !final) return 0

    return final.used - baseline.used
  }

  calculateAverageOperationTime () {
    if (this.metrics.operations.length === 0) return 0

    const totalTime = this.metrics.operations.reduce((sum, op) => sum + op.duration, 0)
    return Math.round(totalTime / this.metrics.operations.length)
  }

  getSlowOperations (threshold = 1000) {
    return this.metrics.operations.filter(op => op.duration > threshold)
  }

  getAPICallStatistics () {
    const stats = {}

    this.metrics.apiCalls.forEach(call => {
      if (!stats[call.api]) {
        stats[call.api] = {
          count: 0,
          totalDuration: 0,
          failures: 0
        }
      }

      stats[call.api].count++
      stats[call.api].totalDuration += call.duration
      if (!call.success) {
        stats[call.api].failures++
      }
    })

    // 計算平均時間
    Object.keys(stats).forEach(api => {
      stats[api].averageDuration = Math.round(stats[api].totalDuration / stats[api].count)
      stats[api].successRate = ((stats[api].count - stats[api].failures) / stats[api].count * 100).toFixed(2)
    })

    return stats
  }

  generateReport () {
    if (!this.metrics.operations) {
      return { error: '未開始追蹤或追蹤未完成' }
    }

    const report = {
      summary: {
        totalTime: Date.now() - this.startTime,
        operations: this.metrics.operations.length,
        apiCalls: this.metrics.apiCalls.length,
        errors: this.metrics.errors.length,
        memoryGrowth: this.calculateMemoryGrowth()
      },
      performance: {
        averageOperationTime: this.calculateAverageOperationTime(),
        slowOperations: this.getSlowOperations(),
        apiStatistics: this.getAPICallStatistics()
      },
      issues: this.identifyPerformanceIssues()
    }

    return report
  }

  identifyPerformanceIssues () {
    const issues = []

    // 檢查記憶體增長
    const memoryGrowth = this.calculateMemoryGrowth()
    if (memoryGrowth > 10 * 1024 * 1024) { // 10MB
      issues.push({
        type: 'memory_leak',
        severity: 'high',
        message: `記憶體增長過大: ${Math.round(memoryGrowth / 1024 / 1024)}MB`
      })
    }

    // 檢查慢操作
    const slowOps = this.getSlowOperations(2000) // 2秒
    if (slowOps.length > 0) {
      issues.push({
        type: 'slow_operations',
        severity: 'medium',
        message: `發現 ${slowOps.length} 個慢操作 (>2秒)`,
        details: slowOps.map(op => ({ name: op.name, duration: op.duration }))
      })
    }

    // 檢查錯誤率
    const errorRate = this.metrics.errors.length / Math.max(1, this.metrics.operations.length)
    if (errorRate > 0.1) { // 10%
      issues.push({
        type: 'high_error_rate',
        severity: 'high',
        message: `錯誤率過高: ${(errorRate * 100).toFixed(2)}%`
      })
    }

    // 檢查API呼叫失敗
    const apiStats = this.getAPICallStatistics()
    Object.entries(apiStats).forEach(([api, stats]) => {
      const failureRate = stats.failures / stats.count
      if (failureRate > 0.05) { // 5%
        issues.push({
          type: 'api_failures',
          severity: 'medium',
          message: `API ${api} 失敗率過高: ${(failureRate * 100).toFixed(2)}%`
        })
      }
    })

    return issues
  }

  // 靜態方法：快速效能測試
  static async measureAsync (asyncFunction, label = 'operation') {
    const start = Date.now()
    const monitor = new PerformanceMonitor()
    monitor.recordMemoryUsage('start')

    try {
      const result = await asyncFunction()
      const duration = Date.now() - start

      monitor.recordMemoryUsage('end')
      monitor.recordOperation(label, duration, { success: true })

      return {
        result,
        metrics: {
          duration,
          memoryGrowth: monitor.calculateMemoryGrowth()
        }
      }
    } catch (error) {
      const duration = Date.now() - start
      monitor.recordOperation(label, duration, { success: false, error: error.message })
      monitor.recordError(error, label)

      throw error
    }
  }

  // 記憶體使用監控助手
  startMemoryMonitoring (interval = 1000) {
    if (this.memoryMonitoringTimer) {
      clearInterval(this.memoryMonitoringTimer)
    }

    this.memoryMonitoringTimer = setInterval(() => {
      this.recordMemoryUsage(`interval_${Date.now()}`)
    }, interval)
  }

  stopMemoryMonitoring () {
    if (this.memoryMonitoringTimer) {
      clearInterval(this.memoryMonitoringTimer)
      this.memoryMonitoringTimer = null
    }
  }

  // 新增方法：記憶體快照功能
  captureMemorySnapshot (label) {
    const snapshot = {
      label,
      timestamp: Date.now(),
      memory: this.getCurrentMemoryUsage(),
      domNodes: typeof document !== 'undefined' ? document.querySelectorAll('*').length : 0
    }

    this.memorySnapshots.push(snapshot)
    return snapshot
  }

  // 高精度記憶體洩漏檢測 (重構版)
  detectMemoryLeaks (baselineSnapshot, currentSnapshot) {
    if (!baselineSnapshot || !currentSnapshot) {
      throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
    }

    const memoryProfile = this.analyzeMemoryProfile([baselineSnapshot, currentSnapshot])
    const leakAnalysis = this.performAdvancedLeakDetection(memoryProfile)
    const dynamicBaseline = this.calculateDynamicBaseline(memoryProfile)

    return {
      memoryGrowthMB: Number(leakAnalysis.growthMB.toFixed(2)),
      growthRateMBPerHour: Number(leakAnalysis.growthRate.toFixed(2)),
      domNodeGrowth: leakAnalysis.domGrowth,
      memoryPatternScore: leakAnalysis.patternScore,
      dynamicThreshold: dynamicBaseline.threshold,
      confidenceLevel: leakAnalysis.confidence,
      isPotentialLeak: leakAnalysis.growthMB > dynamicBaseline.threshold,
      riskLevel: this.assessLeakRisk(leakAnalysis, dynamicBaseline),
      recommendation: this.generateAdvancedRecommendation(leakAnalysis, dynamicBaseline)
    }
  }

  // 記憶體使用模式分析
  analyzeMemoryProfile (snapshots) {
    const profile = {
      samples: snapshots,
      growthPattern: [],
      variability: 0,
      trend: 'stable'
    }

    for (let i = 1; i < snapshots.length; i++) {
      const prevMem = this.extractMemoryValue(snapshots[i - 1].memory)
      const currMem = this.extractMemoryValue(snapshots[i].memory)
      const growth = currMem - prevMem
      profile.growthPattern.push(growth)
    }

    // 計算記憶體變異性
    if (profile.growthPattern.length > 1) {
      const mean = profile.growthPattern.reduce((a, b) => a + b, 0) / profile.growthPattern.length
      const variance = profile.growthPattern.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / profile.growthPattern.length
      profile.variability = Math.sqrt(variance)
      profile.trend = mean > 0 ? 'growing' : mean < 0 ? 'decreasing' : 'stable'
    }

    return profile
  }

  // 進階洩漏檢測算法
  performAdvancedLeakDetection (memoryProfile) {
    const samples = memoryProfile.samples
    const baseMemory = this.extractMemoryValue(samples[0].memory)
    const currentMemory = this.extractMemoryValue(samples[samples.length - 1].memory)

    const growthMB = (currentMemory - baseMemory) / (1024 * 1024)
    const timeDiffMs = samples[samples.length - 1].timestamp - samples[0].timestamp
    const growthRate = (growthMB / timeDiffMs) * (60 * 60 * 1000) // MB/hour

    // 記憶體模式評分 (0-100, 越高越可能洩漏)
    let patternScore = 0
    if (memoryProfile.trend === 'growing') patternScore += 30
    if (memoryProfile.variability < 1024 * 1024) patternScore += 20 // 穩定增長比波動增長更危險
    if (growthRate > 1) patternScore += 25
    if (Math.abs(growthMB) > 5) patternScore += 25

    // 信心水準評估
    const confidence = Math.min(95, Math.max(10,
      (samples.length - 1) * 20 + (timeDiffMs / 1000) * 2
    ))

    return {
      growthMB,
      growthRate,
      domGrowth: samples[samples.length - 1].domNodes - samples[0].domNodes,
      patternScore,
      confidence
    }
  }

  // 動態基準計算
  calculateDynamicBaseline (memoryProfile) {
    const baseThreshold = 2 // MB
    const variabilityFactor = Math.min(5, memoryProfile.variability / (1024 * 1024))
    const confidenceFactor = memoryProfile.samples.length > 2 ? 0.8 : 1.2

    return {
      threshold: Math.max(1, baseThreshold + variabilityFactor) * confidenceFactor,
      rationale: `動態調整: 基準${baseThreshold}MB + 變異性${variabilityFactor.toFixed(1)}MB × 信心係數${confidenceFactor}`
    }
  }

  // 風險等級評估
  assessLeakRisk (leakAnalysis, dynamicBaseline) {
    if (leakAnalysis.growthMB > dynamicBaseline.threshold * 3) return 'CRITICAL'
    if (leakAnalysis.growthMB > dynamicBaseline.threshold * 2) return 'HIGH'
    if (leakAnalysis.patternScore > 70) return 'MEDIUM'
    if (leakAnalysis.growthMB > dynamicBaseline.threshold) return 'LOW'
    return 'NORMAL'
  }

  // 進階建議生成
  generateAdvancedRecommendation (leakAnalysis, dynamicBaseline) {
    const riskLevel = this.assessLeakRisk(leakAnalysis, dynamicBaseline)
    const confidence = leakAnalysis.confidence

    let recommendation = `[${riskLevel}] `

    switch (riskLevel) {
      case 'CRITICAL':
        recommendation += `記憶體增長${leakAnalysis.growthMB.toFixed(1)}MB，超過動態閾值${dynamicBaseline.threshold.toFixed(1)}MB的3倍，立即檢查大型物件洩漏`
        break
      case 'HIGH':
        recommendation += `記憶體增長${leakAnalysis.growthMB.toFixed(1)}MB，超過動態閾值，檢查事件監聽器和快取清理`
        break
      case 'MEDIUM':
        recommendation += `記憶體模式評分${leakAnalysis.patternScore}，存在潛在洩漏跡象，建議深度分析`
        break
      case 'LOW':
        recommendation += `記憶體輕微增長${leakAnalysis.growthMB.toFixed(1)}MB，需持續監控趨勢`
        break
      default:
        recommendation += '記憶體使用正常，無異常檢測'
    }

    recommendation += ` (信心度: ${confidence.toFixed(0)}%)`
    return recommendation
  }

  getMemoryLeakRecommendation (growthMB, growthRatePerHour) {
    // 保持向後兼容性
    return this.generateAdvancedRecommendation(
      { growthMB, growthRate: growthRatePerHour, patternScore: 50, confidence: 75 },
      { threshold: 20 }
    )
  }

  // 新增方法：異步操作測量
  async measureAsync (operationName, asyncFunction) {
    this.startTimer(operationName)
    try {
      const result = await asyncFunction()
      const timing = this.endTimer(operationName)
      return { result, timing }
    } catch (error) {
      // 確保即使出錯也要結束計時
      if (this.timers.has(operationName)) {
        this.endTimer(operationName)
      }
      throw error
    }
  }
}

// Chrome Extension 效能監控器 (Chrome Extension 環境特化)
class ChromeExtensionPerformanceMonitor extends PerformanceMonitor {
  constructor () {
    super()
    this.chromeApiTimes = new Map()
    this.messageLatencies = []
    this.storageOperations = []
  }

  // Chrome API 呼叫效能監控
  async measureChromeAPI (apiName, apiCall) {
    const startTime = performance.now()
    const startMemory = this.getCurrentMemoryUsage()

    try {
      const result = await apiCall()
      const endTime = performance.now()
      const duration = endTime - startTime
      const endMemory = this.getCurrentMemoryUsage()
      const memoryDelta = (endMemory.heapUsed || endMemory.used || endMemory) - (startMemory.heapUsed || startMemory.used || startMemory)

      this.chromeApiTimes.set(apiName, {
        duration,
        memoryDelta,
        success: true,
        timestamp: Date.now()
      })

      return { result, duration, memoryDelta }
    } catch (error) {
      const endTime = performance.now()
      const duration = endTime - startTime

      this.chromeApiTimes.set(apiName, {
        duration,
        success: false,
        error: error.message,
        timestamp: Date.now()
      })

      throw error
    }
  }

  // 訊息傳遞延遲監控
  recordMessageLatency (messageType, sendTime, receiveTime) {
    const latency = receiveTime - sendTime
    this.messageLatencies.push({
      messageType,
      latency,
      sendTime,
      receiveTime
    })
    return latency
  }

  // Storage API 效能監控
  async measureStorageOperation (operation, operationFn) {
    const startTime = performance.now()

    try {
      const result = await operationFn()
      const duration = performance.now() - startTime

      this.storageOperations.push({
        operation,
        duration,
        success: true,
        timestamp: Date.now()
      })

      return { result, duration }
    } catch (error) {
      const duration = performance.now() - startTime

      this.storageOperations.push({
        operation,
        duration,
        success: false,
        error: error.message,
        timestamp: Date.now()
      })

      throw error
    }
  }

  // Chrome Extension 專用報告
  getChromeExtensionReport () {
    return {
      ...this.generateReport(),
      chromeExtensionMetrics: {
        apiCallStatistics: this.getChromeAPIStatistics(),
        messageLatencyStatistics: this.getMessageLatencyStatistics(),
        storagePerformance: this.getStoragePerformanceStatistics()
      }
    }
  }

  getChromeAPIStatistics () {
    const stats = {}

    this.chromeApiTimes.forEach((data, apiName) => {
      if (!stats[apiName]) {
        stats[apiName] = {
          count: 0,
          totalDuration: 0,
          failures: 0,
          avgDuration: 0
        }
      }

      stats[apiName].count++
      stats[apiName].totalDuration += data.duration
      if (!data.success) stats[apiName].failures++
    })

    Object.keys(stats).forEach(api => {
      stats[api].avgDuration = Math.round(stats[api].totalDuration / stats[api].count)
      stats[api].successRate = ((stats[api].count - stats[api].failures) / stats[api].count * 100).toFixed(2)
    })

    return stats
  }

  getMessageLatencyStatistics () {
    if (this.messageLatencies.length === 0) return {}

    const latencies = this.messageLatencies.map(m => m.latency)
    return {
      count: latencies.length,
      avgLatency: Math.round(latencies.reduce((sum, l) => sum + l, 0) / latencies.length),
      minLatency: Math.min(...latencies),
      maxLatency: Math.max(...latencies),
      p95Latency: this.calculatePercentile(latencies, 0.95)
    }
  }

  getStoragePerformanceStatistics () {
    const stats = {}

    this.storageOperations.forEach(op => {
      if (!stats[op.operation]) {
        stats[op.operation] = {
          count: 0,
          totalDuration: 0,
          failures: 0
        }
      }

      stats[op.operation].count++
      stats[op.operation].totalDuration += op.duration
      if (!op.success) stats[op.operation].failures++
    })

    Object.keys(stats).forEach(op => {
      stats[op].avgDuration = Math.round(stats[op].totalDuration / stats[op].count)
      stats[op].successRate = ((stats[op].count - stats[op].failures) / stats[op].count * 100).toFixed(2)
    })

    return stats
  }

  calculatePercentile (values, percentile) {
    const sorted = values.slice().sort((a, b) => a - b)
    const index = Math.ceil(sorted.length * percentile) - 1
    return sorted[index]
  }
}

module.exports = { PerformanceMonitor, ChromeExtensionPerformanceMonitor }
