/**
 * 同步進度追蹤器
 *
 * 負責功能：
 * - 追蹤跨設備同步作業的詳細進度
 * - 提供實時進度更新和狀態通知
 * - 支援多個並行同步作業的進度管理
 * - 進度數據持久化和歷史記錄
 *
 * 設計考量：
 * - 基於階段的進度追蹤模型
 * - 支援百分比和階段狀態雙重追蹤
 * - 提供預估時間和剩餘時間計算
 * - 完整的進度事件發送機制
 */

const {
  SYNC_EVENTS,
  SYNC_STATES
} = require('../../../constants/module-constants')

class SyncProgressTracker {
  constructor (dependencies = {}) {
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console

    this.state = {
      initialized: false,
      tracking: false
    }

    this.activeTracking = new Map()
    this.progressHistory = []
    this.registeredListeners = new Map()

    this.phaseWeights = {
      [SYNC_STATES.INITIALIZING]: 5,
      [SYNC_STATES.VALIDATING]: 10,
      [SYNC_STATES.EXPORTING]: 25,
      [SYNC_STATES.TRANSFERRING]: 20,
      [SYNC_STATES.IMPORTING]: 25,
      [SYNC_STATES.VERIFYING]: 15
    }

    this.stats = {
      totalTracked: 0,
      averageCompletionTime: 0,
      totalDataProcessed: 0
    }
  }

  async initialize () {
    if (this.state.initialized) return

    try {
      this.logger.log('📊 初始化進度追蹤器')
      await this.registerEventListeners()
      this.state.initialized = true
      this.logger.log('✅ 進度追蹤器初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化進度追蹤器失敗:', error)
      throw error
    }
  }

  async startTracking (syncId, options = {}) {
    if (this.activeTracking.has(syncId)) {
      this.logger.warn(`⚠️ 同步作業 ${syncId} 已在追蹤中`)
      return false
    }

    const trackingData = {
      syncId,
      startTime: Date.now(),
      currentPhase: SYNC_STATES.INITIALIZING,
      percentage: 0,
      phases: new Map(),
      options: {
        estimatedDataSize: options.estimatedDataSize || 0,
        totalBooks: options.totalBooks || 0,
        ...options
      },
      milestones: [],
      lastUpdate: Date.now()
    }

    // 初始化階段記錄
    Object.keys(this.phaseWeights).forEach(phase => {
      trackingData.phases.set(phase, {
        state: 'pending',
        startTime: null,
        endTime: null,
        percentage: 0,
        message: '',
        data: {}
      })
    })

    this.activeTracking.set(syncId, trackingData)
    this.state.tracking = true

    this.logger.log(`📊 開始追蹤同步作業: ${syncId}`)

    await this.emitProgressEvent(SYNC_EVENTS.SYNC_PROGRESS, {
      syncId,
      phase: SYNC_STATES.INITIALIZING,
      percentage: 0,
      message: '開始同步追蹤',
      estimatedTimeRemaining: this.estimateTimeRemaining(syncId)
    })

    return true
  }

  async updatePhase (syncId, phase, progressData = {}) {
    const tracking = this.activeTracking.get(syncId)
    if (!tracking) {
      this.logger.warn(`⚠️ 未找到同步作業追蹤: ${syncId}`)
      return false
    }

    const now = Date.now()
    const previousPhase = tracking.currentPhase

    // 結束前一個階段
    if (previousPhase && tracking.phases.has(previousPhase)) {
      const prevPhaseData = tracking.phases.get(previousPhase)
      if (prevPhaseData.state === 'active') {
        prevPhaseData.state = 'completed'
        prevPhaseData.endTime = now
        prevPhaseData.percentage = 100
      }
    }

    // 開始新階段
    const phaseData = tracking.phases.get(phase)
    if (phaseData) {
      phaseData.state = 'active'
      phaseData.startTime = now
      phaseData.message = progressData.message || this.getDefaultPhaseMessage(phase)
      phaseData.data = progressData.data || {}
      phaseData.percentage = progressData.percentage || 0
    }

    tracking.currentPhase = phase
    tracking.lastUpdate = now

    // 計算整體進度
    const overallPercentage = this.calculateOverallPercentage(tracking)
    tracking.percentage = overallPercentage

    // 記錄里程碑
    tracking.milestones.push({
      timestamp: now,
      phase,
      percentage: overallPercentage,
      message: progressData.message || this.getDefaultPhaseMessage(phase),
      duration: now - tracking.startTime
    })

    this.logger.log(`📊 更新同步進度 ${syncId}: ${phase} (${overallPercentage}%)`)

    await this.emitProgressEvent(SYNC_EVENTS.SYNC_PROGRESS, {
      syncId,
      phase,
      percentage: overallPercentage,
      message: progressData.message || this.getDefaultPhaseMessage(phase),
      estimatedTimeRemaining: this.estimateTimeRemaining(syncId),
      phaseDetails: progressData.data || {}
    })

    return true
  }

  async updatePhaseProgress (syncId, percentage, message, data = {}) {
    const tracking = this.activeTracking.get(syncId)
    if (!tracking || !tracking.currentPhase) return false

    const phaseData = tracking.phases.get(tracking.currentPhase)
    if (phaseData && phaseData.state === 'active') {
      phaseData.percentage = Math.min(100, Math.max(0, percentage))
      phaseData.message = message
      phaseData.data = { ...phaseData.data, ...data }
    }

    // 重新計算整體進度
    const overallPercentage = this.calculateOverallPercentage(tracking)
    tracking.percentage = overallPercentage
    tracking.lastUpdate = Date.now()

    await this.emitProgressEvent(SYNC_EVENTS.SYNC_PROGRESS, {
      syncId,
      phase: tracking.currentPhase,
      percentage: overallPercentage,
      message,
      estimatedTimeRemaining: this.estimateTimeRemaining(syncId),
      phaseProgress: phaseData.percentage,
      phaseData: data
    })

    return true
  }

  calculateOverallPercentage (tracking) {
    let totalWeight = 0
    let completedWeight = 0

    for (const [phase, weight] of Object.entries(this.phaseWeights)) {
      totalWeight += weight
      const phaseData = tracking.phases.get(phase)

      if (phaseData) {
        if (phaseData.state === 'completed') {
          completedWeight += weight
        } else if (phaseData.state === 'active') {
          completedWeight += weight * (phaseData.percentage / 100)
        }
      }
    }

    return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0
  }

  estimateTimeRemaining (syncId) {
    const tracking = this.activeTracking.get(syncId)
    if (!tracking) return null

    const elapsed = Date.now() - tracking.startTime
    const percentage = tracking.percentage

    if (percentage <= 0) return null

    const estimatedTotal = (elapsed / percentage) * 100
    const remaining = estimatedTotal - elapsed

    return Math.max(0, Math.round(remaining))
  }

  async completeTracking (syncId, result = {}) {
    const tracking = this.activeTracking.get(syncId)
    if (!tracking) return false

    const now = Date.now()
    const duration = now - tracking.startTime

    // 完成當前階段
    if (tracking.currentPhase) {
      const phaseData = tracking.phases.get(tracking.currentPhase)
      if (phaseData && phaseData.state === 'active') {
        phaseData.state = 'completed'
        phaseData.endTime = now
        phaseData.percentage = 100
      }
    }

    tracking.percentage = 100
    tracking.endTime = now
    tracking.duration = duration
    tracking.result = result

    // 記錄最終里程碑
    tracking.milestones.push({
      timestamp: now,
      phase: 'completed',
      percentage: 100,
      message: '同步作業完成',
      duration
    })

    // 移至歷史記錄
    this.progressHistory.push({
      ...tracking,
      completedAt: now
    })

    // 更新統計
    this.stats.totalTracked++
    this.stats.totalDataProcessed += result.dataSize || 0
    this.updateAverageCompletionTime(duration)

    this.activeTracking.delete(syncId)

    if (this.activeTracking.size === 0) {
      this.state.tracking = false
    }

    this.logger.log(`✅ 完成追蹤同步作業 ${syncId}，耗時: ${duration}ms`)

    await this.emitProgressEvent(SYNC_EVENTS.SYNC_PROGRESS, {
      syncId,
      phase: 'completed',
      percentage: 100,
      message: '同步作業完成',
      duration,
      result
    })

    return true
  }

  async failTracking (syncId, error) {
    const tracking = this.activeTracking.get(syncId)
    if (!tracking) return false

    const now = Date.now()
    const duration = now - tracking.startTime

    tracking.endTime = now
    tracking.duration = duration
    tracking.error = error.message || error

    // 標記當前階段為失敗
    if (tracking.currentPhase) {
      const phaseData = tracking.phases.get(tracking.currentPhase)
      if (phaseData) {
        phaseData.state = 'failed'
        phaseData.endTime = now
        phaseData.error = error.message || error
      }
    }

    // 記錄失敗里程碑
    tracking.milestones.push({
      timestamp: now,
      phase: 'failed',
      percentage: tracking.percentage,
      message: `同步失敗: ${error.message || error}`,
      duration,
      error: true
    })

    // 移至歷史記錄
    this.progressHistory.push({
      ...tracking,
      failedAt: now
    })

    this.activeTracking.delete(syncId)

    if (this.activeTracking.size === 0) {
      this.state.tracking = false
    }

    this.logger.error(`❌ 同步追蹤失敗 ${syncId}:`, error)

    await this.emitProgressEvent(SYNC_EVENTS.SYNC_FAILED, {
      syncId,
      phase: tracking.currentPhase,
      percentage: tracking.percentage,
      message: `同步失敗: ${error.message || error}`,
      error: error.message || error,
      duration
    })

    return true
  }

  getDefaultPhaseMessage (phase) {
    const messages = {
      [SYNC_STATES.INITIALIZING]: '初始化同步環境',
      [SYNC_STATES.VALIDATING]: '驗證同步參數',
      [SYNC_STATES.EXPORTING]: '匯出本地資料',
      [SYNC_STATES.TRANSFERRING]: '傳輸資料',
      [SYNC_STATES.IMPORTING]: '匯入資料',
      [SYNC_STATES.VERIFYING]: '驗證同步完整性'
    }

    return messages[phase] || `處理階段: ${phase}`
  }

  updateAverageCompletionTime (duration) {
    if (this.stats.totalTracked === 1) {
      this.stats.averageCompletionTime = duration
    } else {
      this.stats.averageCompletionTime = Math.round(
        (this.stats.averageCompletionTime * (this.stats.totalTracked - 1) + duration) / this.stats.totalTracked
      )
    }
  }

  getProgress (syncId) {
    const tracking = this.activeTracking.get(syncId)
    if (!tracking) return null

    return {
      syncId,
      phase: tracking.currentPhase,
      percentage: tracking.percentage,
      startTime: tracking.startTime,
      lastUpdate: tracking.lastUpdate,
      estimatedTimeRemaining: this.estimateTimeRemaining(syncId),
      milestones: tracking.milestones.slice(-5), // 最近5個里程碑
      currentPhaseDetails: tracking.phases.get(tracking.currentPhase)
    }
  }

  getAllActiveProgress () {
    return Array.from(this.activeTracking.keys()).map(syncId => this.getProgress(syncId))
  }

  getProgressHistory (limit = 10) {
    return this.progressHistory.slice(-limit).reverse()
  }

  async emitProgressEvent (eventName, data) {
    if (this.eventBus) {
      await this.eventBus.emit(eventName, {
        timestamp: Date.now(),
        ...data
      })
    }
  }

  async registerEventListeners () {
    // 目前無需監聽特定事件，主要被動接收更新
  }

  async unregisterEventListeners () {
    if (!this.eventBus) {
      return
    }

    for (const [event, listenerId] of this.registeredListeners) {
      try {
        await this.eventBus.off(event, listenerId)
      } catch (error) {
        this.logger.error(`❌ 取消註冊事件監聽器失敗 (${event}):`, error)
      }
    }
    this.registeredListeners.clear()
  }

  getStatus () {
    return {
      initialized: this.state.initialized,
      tracking: this.state.tracking,
      activeTracking: this.activeTracking.size,
      historyCount: this.progressHistory.length,
      stats: { ...this.stats }
    }
  }

  getHealthStatus () {
    return {
      service: 'SyncProgressTracker',
      healthy: this.state.initialized,
      status: this.state.tracking ? 'tracking' : 'ready',
      metrics: {
        activeTracking: this.activeTracking.size,
        totalTracked: this.stats.totalTracked,
        averageCompletionTime: `${this.stats.averageCompletionTime}ms`
      }
    }
  }
}

module.exports = SyncProgressTracker
