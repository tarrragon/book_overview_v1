/**
 * ErrorCodes 效能異常檢測系統
 *
 * 功能：
 * - 智能異常檢測算法
 * - 統計學基準線建立
 * - 自動回應機制
 * - 異常事件記錄與分析
 *
 * 設計原則：
 * - 低誤報率：使用多重驗證避免誤報
 * - 早期檢測：在問題影響用戶前發現異常
 * - 自動回應：提供自動修復和緩解措施
 * - 可調參數：允許根據環境調整檢測靈敏度
 */

import { ErrorCodes } from '../errors/ErrorCodes.js'

/**
 * 效能異常檢測器
 */
export class PerformanceAnomalyDetector {
  /**
   * 異常檢測常數
   */
  static get CONSTANTS () {
    return {
      DETECTION_ALGORITHMS: {
        STATISTICAL: 'statistical', // 統計學檢測
        MACHINE_LEARNING: 'ml', // 機器學習檢測
        THRESHOLD: 'threshold', // 閾值檢測
        TREND: 'trend' // 趨勢檢測
      },
      ANOMALY_TYPES: {
        MEMORY_SPIKE: 'MEMORY_SPIKE',
        MEMORY_LEAK: 'MEMORY_LEAK',
        SLOW_CREATION: 'SLOW_CREATION',
        BATCH_DEGRADATION: 'BATCH_DEGRADATION',
        FREQUENCY_ANOMALY: 'FREQUENCY_ANOMALY',
        PATTERN_ANOMALY: 'PATTERN_ANOMALY'
      },
      SEVERITY_LEVELS: {
        LOW: 'LOW',
        MEDIUM: 'MEDIUM',
        HIGH: 'HIGH',
        CRITICAL: 'CRITICAL'
      },
      DEFAULT_CONFIG: {
        windowSize: 100, // 檢測窗口大小
        sensitivityLevel: 'MEDIUM', // 檢測靈敏度
        confidenceThreshold: 0.95, // 置信度閾值
        maxBaseline: 1000, // 最大基準線樣本
        adaptiveBaseline: true, // 自適應基準線
        autoResponse: true // 自動回應
      }
    }
  }

  /**
   * 建構函式
   * @param {Object} config - 檢測器配置
   */
  constructor (config = {}) {
    const { DEFAULT_CONFIG } = PerformanceAnomalyDetector.CONSTANTS

    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    }

    // 初始化檢測狀態
    this._initializeDetectionState()

    // 初始化檢測算法
    this._initializeDetectionAlgorithms()

    // 啟動異常檢測循環
    this._startDetectionLoop()
  }

  /**
   * 初始化檢測狀態
   * @private
   */
  _initializeDetectionState () {
    // 效能數據窗口
    this.dataWindow = {
      memoryUsage: [],
      creationTimes: [],
      errorFrequency: [],
      timestamps: []
    }

    // 統計基準線
    this.baselines = {
      memory: { mean: 0, std: 0, samples: [] },
      time: { mean: 0, std: 0, samples: [] },
      frequency: { mean: 0, std: 0, samples: [] }
    }

    // 異常檢測結果
    this.anomalies = []
    this.anomalyHistory = []

    // 檢測狀態
    this.isDetecting = true
    this.lastDetectionTime = Date.now()
    this.detectionCounter = 0
  }

  /**
   * 初始化檢測算法
   * @private
   */
  _initializeDetectionAlgorithms () {
    this.algorithms = {
      statistical: new StatisticalAnomalyDetector(this.config),
      threshold: new ThresholdAnomalyDetector(this.config),
      trend: new TrendAnomalyDetector(this.config),
      pattern: new PatternAnomalyDetector(this.config)
    }
  }

  /**
   * 啟動檢測循環
   * @private
   */
  _startDetectionLoop () {
    // 每 30 秒執行一次異常檢測
    this.detectionInterval = setInterval(() => {
      this._performAnomalyDetection()
    }, 30000)

    // 每 5 分鐘更新基準線
    this.baselineUpdateInterval = setInterval(() => {
      this._updateBaselines()
    }, 300000)
  }

  /**
   * 添加效能數據點
   * @param {Object} dataPoint - 效能數據點
   */
  addDataPoint (dataPoint) {
    const { memoryUsage, creationTime, errorFrequency, timestamp } = dataPoint

    // 添加到數據窗口
    this.dataWindow.memoryUsage.push(memoryUsage || 0)
    this.dataWindow.creationTimes.push(creationTime || 0)
    this.dataWindow.errorFrequency.push(errorFrequency || 0)
    this.dataWindow.timestamps.push(timestamp || Date.now())

    // 維持窗口大小
    this._maintainWindowSize()

    // 實時異常檢測（針對新數據點）
    this._realtimeAnomalyCheck(dataPoint)
  }

  /**
   * 維持數據窗口大小
   * @private
   */
  _maintainWindowSize () {
    const windowSize = this.config.windowSize

    Object.keys(this.dataWindow).forEach(key => {
      if (this.dataWindow[key].length > windowSize) {
        this.dataWindow[key] = this.dataWindow[key].slice(-windowSize)
      }
    })
  }

  /**
   * 實時異常檢測
   * @param {Object} dataPoint - 新數據點
   * @private
   */
  _realtimeAnomalyCheck (dataPoint) {
    const anomalies = []

    // 快速閾值檢測
    const thresholdAnomalies = this.algorithms.threshold.detectRealtimeAnomalies(dataPoint)
    anomalies.push(...thresholdAnomalies)

    // 處理檢測到的異常
    if (anomalies.length > 0) {
      this._handleDetectedAnomalies(anomalies, 'realtime')
    }
  }

  /**
   * 執行完整異常檢測
   * @private
   */
  _performAnomalyDetection () {
    if (!this.isDetecting || this.dataWindow.memoryUsage.length < 10) {
      return
    }

    this.detectionCounter++
    const detectionResults = []

    try {
      // 統計學檢測
      const statisticalAnomalies = this.algorithms.statistical.detect(this.dataWindow, this.baselines)
      detectionResults.push({ algorithm: 'statistical', anomalies: statisticalAnomalies })

      // 趨勢檢測
      const trendAnomalies = this.algorithms.trend.detect(this.dataWindow)
      detectionResults.push({ algorithm: 'trend', anomalies: trendAnomalies })

      // 模式檢測
      const patternAnomalies = this.algorithms.pattern.detect(this.dataWindow)
      detectionResults.push({ algorithm: 'pattern', anomalies: patternAnomalies })

      // 匯總和驗證異常
      const confirmedAnomalies = this._consolidateAnomalies(detectionResults)

      if (confirmedAnomalies.length > 0) {
        this._handleDetectedAnomalies(confirmedAnomalies, 'batch')
      }

      this.lastDetectionTime = Date.now()
    } catch (error) {
      console.error('異常檢測過程發生錯誤:', error)
    }
  }

  /**
   * 匯總多個算法的檢測結果
   * @param {Array} detectionResults - 檢測結果陣列
   * @returns {Array} 確認的異常列表
   * @private
   */
  _consolidateAnomalies (detectionResults) {
    const anomalyMap = new Map()

    // 收集所有異常
    detectionResults.forEach(result => {
      result.anomalies.forEach(anomaly => {
        const key = `${anomaly.type}_${anomaly.timestamp}`
        if (!anomalyMap.has(key)) {
          anomalyMap.set(key, {
            ...anomaly,
            detectedBy: [result.algorithm],
            confidence: anomaly.confidence
          })
        } else {
          const existing = anomalyMap.get(key)
          existing.detectedBy.push(result.algorithm)
          existing.confidence = Math.max(existing.confidence, anomaly.confidence)
        }
      })
    })

    // 過濾低置信度異常
    const confirmedAnomalies = Array.from(anomalyMap.values()).filter(anomaly => {
      // 多算法檢測增加置信度
      if (anomaly.detectedBy.length > 1) {
        anomaly.confidence += 0.1 * (anomaly.detectedBy.length - 1)
      }

      return anomaly.confidence >= this.config.confidenceThreshold
    })

    return confirmedAnomalies
  }

  /**
   * 處理檢測到的異常
   * @param {Array} anomalies - 異常列表
   * @param {string} detectionType - 檢測類型
   * @private
   */
  _handleDetectedAnomalies (anomalies, detectionType) {
    anomalies.forEach(anomaly => {
      // 記錄異常
      this._recordAnomaly(anomaly, detectionType)

      // 自動回應
      if (this.config.autoResponse) {
        this._triggerAutoResponse(anomaly)
      }

      // 發送警報
      this._sendAlert(anomaly)
    })
  }

  /**
   * 記錄異常事件
   * @param {Object} anomaly - 異常資訊
   * @param {string} detectionType - 檢測類型
   * @private
   */
  _recordAnomaly (anomaly, detectionType) {
    const anomalyRecord = {
      id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      detectionType,
      severity: this._calculateSeverity(anomaly),
      ...anomaly
    }

    this.anomalies.unshift(anomalyRecord)
    this.anomalyHistory.unshift(anomalyRecord)

    // 限制記錄數量
    if (this.anomalies.length > 100) {
      this.anomalies = this.anomalies.slice(0, 50)
    }
    if (this.anomalyHistory.length > 1000) {
      this.anomalyHistory = this.anomalyHistory.slice(0, 500)
    }
  }

  /**
   * 計算異常嚴重程度
   * @param {Object} anomaly - 異常資訊
   * @returns {string} 嚴重程度
   * @private
   */
  _calculateSeverity (anomaly) {
    const { SEVERITY_LEVELS, ANOMALY_TYPES } = PerformanceAnomalyDetector.CONSTANTS

    // 基於異常類型的基本嚴重程度
    const baseSeverity = {
      [ANOMALY_TYPES.MEMORY_LEAK]: SEVERITY_LEVELS.HIGH,
      [ANOMALY_TYPES.MEMORY_SPIKE]: SEVERITY_LEVELS.MEDIUM,
      [ANOMALY_TYPES.SLOW_CREATION]: SEVERITY_LEVELS.MEDIUM,
      [ANOMALY_TYPES.BATCH_DEGRADATION]: SEVERITY_LEVELS.HIGH,
      [ANOMALY_TYPES.FREQUENCY_ANOMALY]: SEVERITY_LEVELS.LOW,
      [ANOMALY_TYPES.PATTERN_ANOMALY]: SEVERITY_LEVELS.LOW
    }

    let severity = baseSeverity[anomaly.type] || SEVERITY_LEVELS.LOW

    // 基於置信度調整嚴重程度
    if (anomaly.confidence > 0.98) {
      severity = this._escalateSeverity(severity)
    }

    // 基於影響範圍調整
    if (anomaly.impact && anomaly.impact.magnitude > 2.0) {
      severity = this._escalateSeverity(severity)
    }

    return severity
  }

  /**
   * 提升嚴重程度等級
   * @param {string} currentSeverity - 當前嚴重程度
   * @returns {string} 提升後的嚴重程度
   * @private
   */
  _escalateSeverity (currentSeverity) {
    const { SEVERITY_LEVELS } = PerformanceAnomalyDetector.CONSTANTS

    switch (currentSeverity) {
      case SEVERITY_LEVELS.LOW:
        return SEVERITY_LEVELS.MEDIUM
      case SEVERITY_LEVELS.MEDIUM:
        return SEVERITY_LEVELS.HIGH
      case SEVERITY_LEVELS.HIGH:
        return SEVERITY_LEVELS.CRITICAL
      default:
        return currentSeverity
    }
  }

  /**
   * 觸發自動回應
   * @param {Object} anomaly - 異常資訊
   * @private
   */
  _triggerAutoResponse (anomaly) {
    const { ANOMALY_TYPES } = PerformanceAnomalyDetector.CONSTANTS

    switch (anomaly.type) {
      case ANOMALY_TYPES.MEMORY_LEAK:
        this._handleMemoryLeakResponse(anomaly)
        break
      case ANOMALY_TYPES.MEMORY_SPIKE:
        this._handleMemorySpikeResponse(anomaly)
        break
      case ANOMALY_TYPES.SLOW_CREATION:
        this._handleSlowCreationResponse(anomaly)
        break
      case ANOMALY_TYPES.BATCH_DEGRADATION:
        this._handleBatchDegradationResponse(anomaly)
        break
      default:
        this._handleGenericResponse(anomaly)
    }
  }

  /**
   * 處理記憶體洩漏回應
   * @param {Object} anomaly - 異常資訊
   * @private
   */
  _handleMemoryLeakResponse (anomaly) {
    console.warn('檢測到記憶體洩漏，觸發自動回應:', anomaly)

    // 強制垃圾回收
    if (global.gc) {
      global.gc()
    }

    // 清理舊的效能數據
    this._cleanupOldData()

    // 記錄回應動作
    anomaly.autoResponse = {
      actions: ['forced_gc', 'data_cleanup'],
      timestamp: Date.now()
    }
  }

  /**
   * 處理記憶體激增回應
   * @param {Object} anomaly - 異常資訊
   * @private
   */
  _handleMemorySpikeResponse (anomaly) {
    console.warn('檢測到記憶體激增，觸發自動回應:', anomaly)

    // 減少數據窗口大小
    this._reduceWindowSize()

    anomaly.autoResponse = {
      actions: ['reduce_window_size'],
      timestamp: Date.now()
    }
  }

  /**
   * 處理緩慢建立回應
   * @param {Object} anomaly - 異常資訊
   * @private
   */
  _handleSlowCreationResponse (anomaly) {
    console.warn('檢測到錯誤建立緩慢，觸發自動回應:', anomaly)

    // 建議使用 CommonErrors
    anomaly.autoResponse = {
      actions: ['suggest_common_errors'],
      suggestions: ['使用 CommonErrors 預編譯錯誤以提高效能'],
      timestamp: Date.now()
    }
  }

  /**
   * 處理批次效能下降回應
   * @param {Object} anomaly - 異常資訊
   * @private
   */
  _handleBatchDegradationResponse (anomaly) {
    console.warn('檢測到批次效能下降，觸發自動回應:', anomaly)

    // 建議減少批次大小
    anomaly.autoResponse = {
      actions: ['suggest_batch_optimization'],
      suggestions: ['考慮減少批次大小或使用分批處理'],
      timestamp: Date.now()
    }
  }

  /**
   * 處理一般異常回應
   * @param {Object} anomaly - 異常資訊
   * @private
   */
  _handleGenericResponse (anomaly) {
    anomaly.autoResponse = {
      actions: ['logged'],
      timestamp: Date.now()
    }
  }

  /**
   * 發送異常警報
   * @param {Object} anomaly - 異常資訊
   * @private
   */
  _sendAlert (anomaly) {
    const alertData = {
      type: 'performance_anomaly',
      severity: anomaly.severity,
      message: this._generateAlertMessage(anomaly),
      anomaly,
      timestamp: Date.now()
    }

    // 在實際應用中，這裡可以發送到監控系統
    console.log(`[效能異常警報] ${alertData.severity}:`, alertData.message)
  }

  /**
   * 生成警報訊息
   * @param {Object} anomaly - 異常資訊
   * @returns {string} 警報訊息
   * @private
   */
  _generateAlertMessage (anomaly) {
    const typeMessages = {
      MEMORY_LEAK: '檢測到記憶體洩漏',
      MEMORY_SPIKE: '檢測到記憶體使用激增',
      SLOW_CREATION: '檢測到錯誤建立效能下降',
      BATCH_DEGRADATION: '檢測到批次處理效能下降',
      FREQUENCY_ANOMALY: '檢測到錯誤頻率異常',
      PATTERN_ANOMALY: '檢測到效能模式異常'
    }

    const baseMessage = typeMessages[anomaly.type] || '檢測到效能異常'
    const confidence = `(置信度: ${(anomaly.confidence * 100).toFixed(1)}%)`

    return `${baseMessage} ${confidence}`
  }

  /**
   * 更新統計基準線
   * @private
   */
  _updateBaselines () {
    if (this.dataWindow.memoryUsage.length < 30) {
      return // 數據不足，跳過更新
    }

    // 更新記憶體基準線
    this._updateBaseline('memory', this.dataWindow.memoryUsage)

    // 更新時間基準線
    this._updateBaseline('time', this.dataWindow.creationTimes)

    // 更新頻率基準線
    this._updateBaseline('frequency', this.dataWindow.errorFrequency)
  }

  /**
   * 更新單個基準線
   * @param {string} type - 基準線類型
   * @param {Array} data - 數據陣列
   * @private
   */
  _updateBaseline (type, data) {
    const baseline = this.baselines[type]

    // 添加新樣本
    baseline.samples.push(...data)

    // 限制樣本數量
    if (baseline.samples.length > this.config.maxBaseline) {
      baseline.samples = baseline.samples.slice(-this.config.maxBaseline)
    }

    // 重新計算統計值
    const samples = baseline.samples
    baseline.mean = samples.reduce((sum, val) => sum + val, 0) / samples.length

    const variance = samples.reduce((sum, val) => sum + Math.pow(val - baseline.mean, 2), 0) / samples.length
    baseline.std = Math.sqrt(variance)
  }

  /**
   * 清理舊數據
   * @private
   */
  _cleanupOldData () {
    const targetSize = Math.floor(this.config.windowSize * 0.7)

    Object.keys(this.dataWindow).forEach(key => {
      if (this.dataWindow[key].length > targetSize) {
        this.dataWindow[key] = this.dataWindow[key].slice(-targetSize)
      }
    })
  }

  /**
   * 減少窗口大小
   * @private
   */
  _reduceWindowSize () {
    this.config.windowSize = Math.max(this.config.windowSize * 0.8, 50)
    this._maintainWindowSize()
  }

  /**
   * 獲取異常檢測報告
   * @returns {Object} 檢測報告
   */
  generateAnomalyReport () {
    const now = Date.now()
    const last24Hours = now - 24 * 60 * 60 * 1000

    const recentAnomalies = this.anomalyHistory.filter(a => a.timestamp > last24Hours)

    return {
      timestamp: now,
      detectionStatus: {
        isDetecting: this.isDetecting,
        detectionCounter: this.detectionCounter,
        lastDetectionTime: this.lastDetectionTime
      },
      statistics: {
        totalAnomalies: this.anomalyHistory.length,
        recentAnomalies: recentAnomalies.length,
        severityDistribution: this._calculateSeverityDistribution(recentAnomalies),
        typeDistribution: this._calculateTypeDistribution(recentAnomalies)
      },
      baselines: this._summarizeBaselines(),
      recentAnomalies: this.anomalies.slice(0, 10),
      configuration: this.config
    }
  }

  /**
   * 計算嚴重程度分布
   * @param {Array} anomalies - 異常列表
   * @returns {Object} 嚴重程度分布
   * @private
   */
  _calculateSeverityDistribution (anomalies) {
    const distribution = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }

    anomalies.forEach(anomaly => {
      distribution[anomaly.severity] = (distribution[anomaly.severity] || 0) + 1
    })

    return distribution
  }

  /**
   * 計算異常類型分布
   * @param {Array} anomalies - 異常列表
   * @returns {Object} 類型分布
   * @private
   */
  _calculateTypeDistribution (anomalies) {
    const distribution = {}

    anomalies.forEach(anomaly => {
      distribution[anomaly.type] = (distribution[anomaly.type] || 0) + 1
    })

    return distribution
  }

  /**
   * 總結基準線資訊
   * @returns {Object} 基準線摘要
   * @private
   */
  _summarizeBaselines () {
    const summary = {}

    Object.keys(this.baselines).forEach(type => {
      const baseline = this.baselines[type]
      summary[type] = {
        mean: baseline.mean,
        std: baseline.std,
        sampleCount: baseline.samples.length
      }
    })

    return summary
  }

  /**
   * 停止異常檢測
   */
  stopDetection () {
    this.isDetecting = false

    if (this.detectionInterval) {
      clearInterval(this.detectionInterval)
    }

    if (this.baselineUpdateInterval) {
      clearInterval(this.baselineUpdateInterval)
    }
  }
}

/**
 * 統計學異常檢測器
 */
class StatisticalAnomalyDetector {
  constructor (config) {
    this.config = config
  }

  detect (dataWindow, baselines) {
    const anomalies = []
    const { ANOMALY_TYPES } = PerformanceAnomalyDetector.CONSTANTS

    // Z-score 檢測
    const memoryZScores = this._calculateZScores(dataWindow.memoryUsage, baselines.memory)
    const timeZScores = this._calculateZScores(dataWindow.creationTimes, baselines.time)

    // 檢測記憶體異常
    memoryZScores.forEach((zScore, index) => {
      if (Math.abs(zScore) > 3) { // 3-sigma 規則
        anomalies.push({
          type: zScore > 0 ? ANOMALY_TYPES.MEMORY_SPIKE : ANOMALY_TYPES.MEMORY_LEAK,
          confidence: Math.min(Math.abs(zScore) / 3, 1),
          zScore,
          value: dataWindow.memoryUsage[index],
          timestamp: dataWindow.timestamps[index] || Date.now(),
          algorithm: 'statistical'
        })
      }
    })

    // 檢測時間異常
    timeZScores.forEach((zScore, index) => {
      if (zScore > 2.5) { // 時間只檢測過長情況
        anomalies.push({
          type: ANOMALY_TYPES.SLOW_CREATION,
          confidence: Math.min(zScore / 3, 1),
          zScore,
          value: dataWindow.creationTimes[index],
          timestamp: dataWindow.timestamps[index] || Date.now(),
          algorithm: 'statistical'
        })
      }
    })

    return anomalies
  }

  _calculateZScores (data, baseline) {
    if (baseline.std === 0) return data.map(() => 0)

    return data.map(value => (value - baseline.mean) / baseline.std)
  }
}

/**
 * 閾值異常檢測器
 */
class ThresholdAnomalyDetector {
  constructor (config) {
    this.config = config
    this.thresholds = {
      memory: 5 * 1024 * 1024, // 5MB
      time: 10, // 10ms
      frequency: 100 // 100 errors/minute
    }
  }

  detectRealtimeAnomalies (dataPoint) {
    const anomalies = []
    const { ANOMALY_TYPES } = PerformanceAnomalyDetector.CONSTANTS

    if (dataPoint.memoryUsage > this.thresholds.memory) {
      anomalies.push({
        type: ANOMALY_TYPES.MEMORY_SPIKE,
        confidence: 0.8,
        value: dataPoint.memoryUsage,
        threshold: this.thresholds.memory,
        timestamp: dataPoint.timestamp || Date.now(),
        algorithm: 'threshold'
      })
    }

    if (dataPoint.creationTime > this.thresholds.time) {
      anomalies.push({
        type: ANOMALY_TYPES.SLOW_CREATION,
        confidence: 0.7,
        value: dataPoint.creationTime,
        threshold: this.thresholds.time,
        timestamp: dataPoint.timestamp || Date.now(),
        algorithm: 'threshold'
      })
    }

    return anomalies
  }
}

/**
 * 趨勢異常檢測器
 */
class TrendAnomalyDetector {
  constructor (config) {
    this.config = config
  }

  detect (dataWindow) {
    const anomalies = []
    const { ANOMALY_TYPES } = PerformanceAnomalyDetector.CONSTANTS

    // 檢測記憶體趨勢
    const memoryTrend = this._calculateTrend(dataWindow.memoryUsage)
    if (memoryTrend.slope > 0 && memoryTrend.confidence > 0.8) {
      anomalies.push({
        type: ANOMALY_TYPES.MEMORY_LEAK,
        confidence: memoryTrend.confidence,
        trend: memoryTrend,
        timestamp: Date.now(),
        algorithm: 'trend'
      })
    }

    // 檢測時間趨勢
    const timeTrend = this._calculateTrend(dataWindow.creationTimes)
    if (timeTrend.slope > 0 && timeTrend.confidence > 0.7) {
      anomalies.push({
        type: ANOMALY_TYPES.BATCH_DEGRADATION,
        confidence: timeTrend.confidence,
        trend: timeTrend,
        timestamp: Date.now(),
        algorithm: 'trend'
      })
    }

    return anomalies
  }

  _calculateTrend (data) {
    if (data.length < 10) {
      return { slope: 0, confidence: 0 }
    }

    const n = data.length
    const x = Array.from({ length: n }, (_, i) => i)
    const y = data

    // 線性回歸
    const sumX = x.reduce((sum, val) => sum + val, 0)
    const sumY = y.reduce((sum, val) => sum + val, 0)
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0)
    const sumXX = x.reduce((sum, val) => sum + val * val, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)

    // 計算相關係數作為置信度
    const meanX = sumX / n
    const meanY = sumY / n

    const numerator = x.reduce((sum, val, i) => sum + (val - meanX) * (y[i] - meanY), 0)
    const denomX = Math.sqrt(x.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0))
    const denomY = Math.sqrt(y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0))

    const correlation = denomX && denomY ? numerator / (denomX * denomY) : 0
    const confidence = Math.abs(correlation)

    return { slope, confidence }
  }
}

/**
 * 模式異常檢測器
 */
class PatternAnomalyDetector {
  constructor (config) {
    this.config = config
  }

  detect (dataWindow) {
    const anomalies = []
    const { ANOMALY_TYPES } = PerformanceAnomalyDetector.CONSTANTS

    // 檢測週期性異常
    const periodicAnomaly = this._detectPeriodicAnomaly(dataWindow.memoryUsage)
    if (periodicAnomaly) {
      anomalies.push({
        type: ANOMALY_TYPES.PATTERN_ANOMALY,
        confidence: periodicAnomaly.confidence,
        pattern: periodicAnomaly,
        timestamp: Date.now(),
        algorithm: 'pattern'
      })
    }

    return anomalies
  }

  _detectPeriodicAnomaly (data) {
    // 簡化的週期性檢測
    if (data.length < 20) return null

    const windowSize = Math.floor(data.length / 4)
    const windows = []

    for (let i = 0; i <= data.length - windowSize; i += windowSize) {
      windows.push(data.slice(i, i + windowSize))
    }

    if (windows.length < 2) return null

    // 計算窗口間的相似度
    const similarities = []
    for (let i = 1; i < windows.length; i++) {
      const similarity = this._calculateSimilarity(windows[0], windows[i])
      similarities.push(similarity)
    }

    const avgSimilarity = similarities.reduce((sum, val) => sum + val, 0) / similarities.length

    if (avgSimilarity > 0.8) {
      return {
        confidence: avgSimilarity,
        windowSize,
        avgSimilarity
      }
    }

    return null
  }

  _calculateSimilarity (arr1, arr2) {
    if (arr1.length !== arr2.length) return 0

    const mean1 = arr1.reduce((sum, val) => sum + val, 0) / arr1.length
    const mean2 = arr2.reduce((sum, val) => sum + val, 0) / arr2.length

    const numerator = arr1.reduce((sum, val, i) => sum + (val - mean1) * (arr2[i] - mean2), 0)
    const denom1 = Math.sqrt(arr1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0))
    const denom2 = Math.sqrt(arr2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0))

    return denom1 && denom2 ? numerator / (denom1 * denom2) : 0
  }
}
