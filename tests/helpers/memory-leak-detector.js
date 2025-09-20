/**
 * 記憶體洩漏檢測工具
 * 專注於記憶體洩漏預防，而非垃圾回收效率測試
 *
 * 設計原則：
 * 1. 測試記憶體洩漏預防，而非垃圾回收效率
 * 2. 使用真實場景模擬，而非任意數字
 * 3. 基於實際記憶體使用量，而非假定效率百分比
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

class MemoryLeakDetector {
  constructor (options = {}) {
    this.options = {
      // 記憶體增長警告閾值 (bytes)
      memoryGrowthThreshold: options.memoryGrowthThreshold || 50 * 1024 * 1024, // 50MB
      // 記憶體洩漏檢測閾值 (bytes/operation)
      leakDetectionThreshold: options.leakDetectionThreshold || 1024, // 1KB per operation
      // 採樣間隔 (ms)
      samplingInterval: options.samplingInterval || 100,
      // 最小操作數量（用於統計意義）
      minOperationsForDetection: options.minOperationsForDetection || 10,
      // 記憶體穩定化等待時間 (ms)
      stabilizationWaitTime: options.stabilizationWaitTime || 500
    }

    this.measurements = []
    this.operationHistory = []
    this.isMonitoring = false
  }

  /**
   * 開始記憶體監控
   */
  startMonitoring () {
    this.isMonitoring = true
    this.measurements = []
    this.operationHistory = []
    this.startTime = Date.now()
    this.baselineMemory = this._getCurrentMemoryUsage()

    // eslint-disable-next-line no-console
    console.log(`[MemoryLeakDetector] Started monitoring. Baseline: ${this._formatMemorySize(this.baselineMemory.heapUsed)}`)
    return this.baselineMemory
  }

  /**
   * 記錄操作開始
   * @param {string} operationName - 操作名稱
   * @param {Object} context - 操作上下文資訊
   */
  recordOperationStart (operationName, context = {}) {
    if (!this.isMonitoring) {
      throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.MEMORY_DETECTOR_ERROR; error.details = { category: 'testing' }; return error })()
    }

    const memoryUsage = this._getCurrentMemoryUsage()
    const operation = {
      id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: operationName,
      context,
      startTime: Date.now(),
      startMemory: memoryUsage,
      endTime: null,
      endMemory: null,
      memoryDelta: null,
      completed: false
    }

    this.operationHistory.push(operation)
    this.measurements.push({
      timestamp: Date.now(),
      memory: memoryUsage,
      operationId: operation.id,
      phase: 'start'
    })

    return operation.id
  }

  /**
   * 記錄操作結束
   * @param {string} operationId - 操作ID
   */
  async recordOperationEnd (operationId) {
    const operation = this.operationHistory.find(op => op.id === operationId)
    if (!operation) {
      throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.MEMORY_DETECTOR_ERROR; error.details = { category: 'testing' }; return error })()
    }

    // 等待記憶體穩定
    await this._waitForMemoryStabilization()

    const memoryUsage = this._getCurrentMemoryUsage()

    operation.endTime = Date.now()
    operation.endMemory = memoryUsage
    operation.memoryDelta = memoryUsage.heapUsed - operation.startMemory.heapUsed
    operation.completed = true

    this.measurements.push({
      timestamp: Date.now(),
      memory: memoryUsage,
      operationId: operation.id,
      phase: 'end'
    })

    return operation
  }

  /**
   * 停止監控並分析結果
   */
  async stopMonitoring () {
    if (!this.isMonitoring) {
      return null
    }

    this.isMonitoring = false
    this.endTime = Date.now()

    // 等待最終記憶體穩定
    await this._waitForMemoryStabilization()
    this.finalMemory = this._getCurrentMemoryUsage()

    const analysis = this._analyzeMemoryUsage()

    // eslint-disable-next-line no-console
    console.log(`[MemoryLeakDetector] Stopped monitoring. Final: ${this._formatMemorySize(this.finalMemory.heapUsed)}`)

    return analysis
  }

  /**
   * 執行記憶體洩漏檢測
   * @param {Function} operationFunction - 要測試的操作函式
   * @param {number} iterations - 執行次數
   * @param {Object} options - 檢測選項
   */
  async detectMemoryLeak (operationFunction, iterations = 100, options = {}) {
    const testName = options.testName || 'unknown-operation'

    // eslint-disable-next-line no-console
    console.log(`[MemoryLeakDetector] Starting leak detection for "${testName}" with ${iterations} iterations`)

    this.startMonitoring()

    // 執行多次操作來檢測記憶體洩漏
    for (let i = 0; i < iterations; i++) {
      const operationId = this.recordOperationStart(`${testName}-${i}`, { iteration: i })

      try {
        await operationFunction(i)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`[MemoryLeakDetector] Operation ${i} failed:`, error.message)
      }

      await this.recordOperationEnd(operationId)

      // 每10次操作進行一次中間檢查
      if ((i + 1) % 10 === 0) {
        const currentMemory = this._getCurrentMemoryUsage()
        const growth = currentMemory.heapUsed - this.baselineMemory.heapUsed
        // eslint-disable-next-line no-console
        console.log(`[MemoryLeakDetector] After ${i + 1} operations: ${this._formatMemorySize(growth)} growth`)
      }
    }

    return await this.stopMonitoring()
  }

  /**
   * 獲取當前記憶體使用情況
   * @private
   */
  _getCurrentMemoryUsage () {
    return process.memoryUsage()
  }

  /**
   * 等待記憶體穩定化
   * @private
   */
  async _waitForMemoryStabilization () {
    await new Promise(resolve => setTimeout(resolve, this.options.stabilizationWaitTime))
  }

  /**
   * 分析記憶體使用模式
   * @private
   */
  _analyzeMemoryUsage () {
    const completedOperations = this.operationHistory.filter(op => op.completed)
    const totalDuration = this.endTime - this.startTime
    const totalMemoryGrowth = this.finalMemory.heapUsed - this.baselineMemory.heapUsed

    // 計算記憶體洩漏指標
    const memoryLeakAnalysis = this._detectMemoryLeaks(completedOperations)

    // 計算記憶體效率指標
    const memoryEfficiencyAnalysis = this._calculateMemoryEfficiency(completedOperations)

    const analysis = {
      summary: {
        totalOperations: completedOperations.length,
        totalDuration,
        baselineMemory: this.baselineMemory.heapUsed,
        finalMemory: this.finalMemory.heapUsed,
        totalMemoryGrowth,
        memoryGrowthRate: totalDuration > 0 ? totalMemoryGrowth / totalDuration : 0, // bytes/ms
        formattedGrowth: this._formatMemorySize(totalMemoryGrowth)
      },

      leakDetection: memoryLeakAnalysis,

      efficiency: memoryEfficiencyAnalysis,

      // 警告和建議
      warnings: this._generateWarnings(totalMemoryGrowth, memoryLeakAnalysis),

      // 詳細測量數據
      measurements: this.measurements,
      operations: completedOperations,

      // 檢測結果
      hasMemoryLeak: memoryLeakAnalysis.suspectedLeaks > 0,
      isEfficient: memoryEfficiencyAnalysis.overallEfficiency > 0.7,
      passesThresholds: this._checkThresholds(totalMemoryGrowth, memoryLeakAnalysis)
    }

    return analysis
  }

  /**
   * 檢測記憶體洩漏
   * @private
   */
  _detectMemoryLeaks (operations) {
    if (operations.length < this.options.minOperationsForDetection) {
      return {
        suspectedLeaks: 0,
        averageMemoryPerOperation: 0,
        memoryGrowthTrend: 'insufficient-data',
        leakSeverity: 'none'
      }
    }

    // 計算每個操作的平均記憶體增長
    const memoryDeltas = operations.map(op => op.memoryDelta)
    const averageMemoryPerOperation = memoryDeltas.reduce((sum, delta) => sum + delta, 0) / operations.length

    // 分析記憶體增長趨勢
    const growthTrend = this._calculateMemoryTrend(operations)

    // 計算可疑洩漏次數
    const suspiciousOperations = operations.filter(op =>
      op.memoryDelta > this.options.leakDetectionThreshold
    ).length

    const leakSeverity = this._assessLeakSeverity(averageMemoryPerOperation, suspiciousOperations, operations.length)

    return {
      suspectedLeaks: suspiciousOperations,
      averageMemoryPerOperation,
      memoryGrowthTrend: growthTrend,
      leakSeverity,
      formattedAverageGrowth: this._formatMemorySize(averageMemoryPerOperation)
    }
  }

  /**
   * 計算記憶體效率
   * @private
   */
  _calculateMemoryEfficiency (operations) {
    if (operations.length === 0) {
      return {
        overallEfficiency: 1.0,
        operationalEfficiency: 1.0,
        memoryRecoveryRate: 1.0
      }
    }

    const totalMemoryUsed = operations.reduce((sum, op) => sum + Math.abs(op.memoryDelta), 0)
    const netMemoryGrowth = this.finalMemory.heapUsed - this.baselineMemory.heapUsed

    // 計算記憶體回收率 (釋放的記憶體 / 使用的記憶體)
    const memoryRecoveryRate = totalMemoryUsed > 0
      ? Math.max(0, (totalMemoryUsed - netMemoryGrowth) / totalMemoryUsed)
      : 1.0

    // 計算操作效率 (基於每個操作的記憶體使用)
    const averageMemoryPerOp = totalMemoryUsed / operations.length
    const baselineMemoryPerOp = 1024 // 1KB baseline per operation
    const operationalEfficiency = averageMemoryPerOp > 0
      ? Math.min(baselineMemoryPerOp / averageMemoryPerOp, 1.0)
      : 1.0

    // 綜合效率評分
    const overallEfficiency = (memoryRecoveryRate * 0.6) + (operationalEfficiency * 0.4)

    return {
      overallEfficiency,
      operationalEfficiency,
      memoryRecoveryRate,
      averageMemoryPerOperation: averageMemoryPerOp,
      formattedAverageMemory: this._formatMemorySize(averageMemoryPerOp)
    }
  }

  /**
   * 計算記憶體增長趨勢
   * @private
   */
  _calculateMemoryTrend (operations) {
    if (operations.length < 5) return 'insufficient-data'

    // 使用簡單的線性趨勢分析
    const midPoint = Math.floor(operations.length / 2)
    const firstHalf = operations.slice(0, midPoint)
    const secondHalf = operations.slice(midPoint)

    const firstHalfAverage = firstHalf.reduce((sum, op) => sum + op.memoryDelta, 0) / firstHalf.length
    const secondHalfAverage = secondHalf.reduce((sum, op) => sum + op.memoryDelta, 0) / secondHalf.length

    const trendDifference = secondHalfAverage - firstHalfAverage

    if (trendDifference > 1024) return 'increasing' // 增長趨勢
    if (trendDifference < -1024) return 'decreasing' // 減少趨勢
    return 'stable' // 穩定
  }

  /**
   * 評估洩漏嚴重程度
   * @private
   */
  _assessLeakSeverity (averageGrowth, suspiciousOps, totalOps) {
    const suspiciousRate = suspiciousOps / totalOps

    if (averageGrowth > 10 * 1024 || suspiciousRate > 0.5) return 'critical'
    if (averageGrowth > 5 * 1024 || suspiciousRate > 0.3) return 'high'
    if (averageGrowth > 1024 || suspiciousRate > 0.1) return 'moderate'
    return 'low'
  }

  /**
   * 生成警告訊息
   * @private
   */
  _generateWarnings (totalGrowth, leakAnalysis) {
    const warnings = []

    if (totalGrowth > this.options.memoryGrowthThreshold) {
      warnings.push({
        type: 'memory-growth',
        severity: 'high',
        message: `總記憶體增長 ${this._formatMemorySize(totalGrowth)} 超過閾值 ${this._formatMemorySize(this.options.memoryGrowthThreshold)}`
      })
    }

    if (leakAnalysis.leakSeverity === 'critical' || leakAnalysis.leakSeverity === 'high') {
      warnings.push({
        type: 'memory-leak',
        severity: leakAnalysis.leakSeverity,
        message: `檢測到 ${leakAnalysis.leakSeverity} 等級的記憶體洩漏，平均每操作增長 ${leakAnalysis.formattedAverageGrowth}`
      })
    }

    if (leakAnalysis.memoryGrowthTrend === 'increasing') {
      warnings.push({
        type: 'growth-trend',
        severity: 'moderate',
        message: '記憶體使用呈現持續增長趨勢，建議檢查資源釋放邏輯'
      })
    }

    return warnings
  }

  /**
   * 檢查閾值
   * @private
   */
  _checkThresholds (totalGrowth, leakAnalysis) {
    return {
      memoryGrowthOk: totalGrowth <= this.options.memoryGrowthThreshold,
      leakDetectionOk: leakAnalysis.leakSeverity === 'low' || leakAnalysis.leakSeverity === 'none',
      overallOk: totalGrowth <= this.options.memoryGrowthThreshold &&
                 (leakAnalysis.leakSeverity === 'low' || leakAnalysis.leakSeverity === 'none')
    }
  }

  /**
   * 格式化記憶體大小
   * @private
   */
  _formatMemorySize (bytes) {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }
}

module.exports = MemoryLeakDetector
