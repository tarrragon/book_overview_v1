/**
 * 同步衝突解決器
 *
 * 負責功能：
 * - 檢測跨設備同步中的資料衝突
 * - 提供多種衝突解決策略
 * - 衝突解決結果記錄和統計
 * - 支援用戶自定義衝突解決規則
 *
 * 設計考量：
 * - 基於書籍ID和時間戳的衝突檢測
 * - 支援自動和手動衝突解決模式
 * - 提供詳細的衝突報告和解決過程記錄
 * - 支援批量衝突處理和優先級排序
 */

const {
  SYNC_EVENTS,
  EVENT_PRIORITIES
} = require('src/background/constants/module-constants')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

class SyncConflictResolver {
  constructor (dependencies = {}) {
    this.eventBus = dependencies.eventBus || null

    // Logger 後備方案: Background Service 初始化保護
    // 設計理念: 同步衝突解決器作為資料一致性保證中心，負責記錄衝突解決過程和決策邏輯
    // 執行環境: Service Worker 初始化階段，依賴注入可能不完整
    // 後備機制: console 確保衝突檢測和解決過程能被追蹤
    // 風險考量: 理想上應確保 Logger 完整可用，此為過渡性保護
    this.logger = dependencies.logger || console

    this.state = {
      initialized: false,
      resolving: false
    }

    this.conflictStrategies = new Map()
    this.resolutionHistory = []
    this.registeredListeners = new Map()

    this.stats = {
      totalConflicts: 0,
      autoResolved: 0,
      manualResolved: 0,
      unresolved: 0
    }

    this.initializeConflictStrategies()
  }

  async initialize () {
    if (this.state.initialized) return

    try {
      this.logger.log('⚖️ 初始化衝突解決器')
      await this.registerEventListeners()
      this.state.initialized = true
      this.logger.log('✅ 衝突解決器初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化衝突解決器失敗:', error)
      throw error
    }
  }

  initializeConflictStrategies () {
    // 策略1: 保留較新的資料（基於時間戳）
    this.conflictStrategies.set('keep_latest', {
      name: '保留最新',
      description: '基於時間戳保留較新的資料',
      processor: (localBook, remoteBook) => {
        const localTime = new Date(localBook.extractedAt || 0).getTime()
        const remoteTime = new Date(remoteBook.extractedAt || 0).getTime()

        return {
          resolved: true,
          result: remoteTime > localTime ? remoteBook : localBook,
          reason: `保留時間戳較新的版本 (${remoteTime > localTime ? 'remote' : 'local'})`
        }
      }
    })

    // 策略2: 保留較高的閱讀進度
    this.conflictStrategies.set('keep_highest_progress', {
      name: '保留最高進度',
      description: '保留閱讀進度較高的書籍資料',
      processor: (localBook, remoteBook) => {
        const localProgress = localBook.progress || 0
        const remoteProgress = remoteBook.progress || 0

        return {
          resolved: true,
          result: remoteProgress > localProgress ? remoteBook : localBook,
          reason: `保留進度較高的版本 (${remoteProgress > localProgress ? 'remote' : 'local'}: ${Math.max(localProgress, remoteProgress)}%)`
        }
      }
    })

    // 策略3: 合併最佳屬性
    this.conflictStrategies.set('merge_best_attributes', {
      name: '合併最佳屬性',
      description: '保留每個屬性的最佳值',
      processor: (localBook, remoteBook) => {
        const merged = { ...localBook }

        // 保留較高的進度
        if ((remoteBook.progress || 0) > (localBook.progress || 0)) {
          merged.progress = remoteBook.progress
        }

        // 保留較新的時間戳
        const localTime = new Date(localBook.extractedAt || 0).getTime()
        const remoteTime = new Date(remoteBook.extractedAt || 0).getTime()
        if (remoteTime > localTime) {
          merged.extractedAt = remoteBook.extractedAt
        }

        // 保留完成狀態（如果任一已完成）
        if (remoteBook.isFinished && !localBook.isFinished) {
          merged.isFinished = true
        }

        return {
          resolved: true,
          result: merged,
          reason: '合併兩個版本的最佳屬性'
        }
      }
    })

    // 策略4: 需要手動解決
    this.conflictStrategies.set('manual_resolve', {
      name: '手動解決',
      description: '標記為需要用戶手動解決',
      processor: (localBook, remoteBook) => {
        return {
          resolved: false,
          localBook,
          remoteBook,
          reason: '需要用戶手動選擇解決方案'
        }
      }
    })

    this.logger.log(`✅ 初始化了 ${this.conflictStrategies.size} 個衝突解決策略`)
  }

  async detectConflicts (localBooks, remoteBooks) {
    const conflicts = []
    const localBookMap = new Map()

    // 建立本地書籍索引
    localBooks.forEach(book => {
      localBookMap.set(book.id, book)
    })

    // 檢查遠端書籍是否有衝突
    for (const remoteBook of remoteBooks) {
      const localBook = localBookMap.get(remoteBook.id)

      if (localBook) {
        const conflictDetails = this.analyzeConflict(localBook, remoteBook)
        if (conflictDetails.hasConflict) {
          conflicts.push({
            bookId: remoteBook.id,
            title: remoteBook.title || localBook.title,
            localBook,
            remoteBook,
            conflictType: conflictDetails.type,
            conflictFields: conflictDetails.fields,
            severity: conflictDetails.severity,
            detectedAt: Date.now()
          })
        }
      }
    }

    this.logger.log(`🔍 檢測到 ${conflicts.length} 個衝突`)
    return conflicts
  }

  analyzeConflict (localBook, remoteBook) {
    const conflicts = []
    let severity = 'low'

    // 檢查進度衝突
    if (localBook.progress !== remoteBook.progress) {
      const progressDiff = Math.abs((localBook.progress || 0) - (remoteBook.progress || 0))
      conflicts.push({
        field: 'progress',
        local: localBook.progress,
        remote: remoteBook.progress,
        difference: progressDiff
      })

      if (progressDiff > 20) severity = 'high'
      else if (progressDiff > 5) severity = 'medium'
    }

    // 檢查完成狀態衝突
    if (localBook.isFinished !== remoteBook.isFinished) {
      conflicts.push({
        field: 'isFinished',
        local: localBook.isFinished,
        remote: remoteBook.isFinished
      })
      severity = 'high'
    }

    // 檢查時間戳差異
    const localTime = new Date(localBook.extractedAt || 0).getTime()
    const remoteTime = new Date(remoteBook.extractedAt || 0).getTime()
    const timeDiff = Math.abs(localTime - remoteTime)

    if (timeDiff > 24 * 60 * 60 * 1000) { // 超過24小時
      conflicts.push({
        field: 'extractedAt',
        local: localBook.extractedAt,
        remote: remoteBook.extractedAt,
        timeDifference: timeDiff
      })
    }

    return {
      hasConflict: conflicts.length > 0,
      type: this.categorizeConflictType(conflicts),
      fields: conflicts,
      severity
    }
  }

  categorizeConflictType (conflicts) {
    const fieldTypes = conflicts.map(c => c.field)

    if (fieldTypes.includes('isFinished')) return 'status_conflict'
    if (fieldTypes.includes('progress')) return 'progress_conflict'
    if (fieldTypes.includes('extractedAt')) return 'timestamp_conflict'

    return 'data_conflict'
  }

  async resolveConflicts (conflicts, strategy = 'keep_latest', options = {}) {
    const resolutionResults = []
    const strategyProcessor = this.conflictStrategies.get(strategy)

    if (!strategyProcessor) {
      const error = new Error(`未支援的衝突解決策略: ${strategy}`)
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'general', strategy }
      throw error
    }

    this.logger.log(`⚖️ 開始解決 ${conflicts.length} 個衝突，策略: ${strategy}`)

    for (const conflict of conflicts) {
      try {
        const resolutionResult = strategyProcessor.processor(
          conflict.localBook,
          conflict.remoteBook
        )

        const result = {
          bookId: conflict.bookId,
          title: conflict.title,
          strategy,
          resolution: resolutionResult,
          resolvedAt: Date.now(),
          conflictDetails: conflict
        }

        resolutionResults.push(result)
        this.resolutionHistory.push(result)

        // 更新統計
        if (resolutionResult.resolved) {
          this.stats.autoResolved++
        } else {
          this.stats.unresolved++
        }
        this.stats.totalConflicts++

        // 發送衝突解決事件
        await this.emitConflictEvent(SYNC_EVENTS.CONFLICT_RESOLVED, {
          bookId: conflict.bookId,
          strategy,
          resolved: resolutionResult.resolved,
          reason: resolutionResult.reason
        })
      } catch (error) {
        this.logger.error(`❌ 解決衝突失敗 (${conflict.bookId}):`, error)
        resolutionResults.push({
          bookId: conflict.bookId,
          title: conflict.title,
          strategy,
          error: error.message,
          resolvedAt: Date.now()
        })
      }
    }

    this.logger.log(`✅ 衝突解決完成，已解決: ${resolutionResults.filter(r => r.resolution?.resolved).length}/${conflicts.length}`)
    return resolutionResults
  }

  async resolveConflict (conflict, strategy = 'keep_latest') {
    const results = await this.resolveConflicts([conflict], strategy)
    return results[0]
  }

  async getConflictSummary (conflicts) {
    const summary = {
      total: conflicts.length,
      byType: {},
      bySeverity: { low: 0, medium: 0, high: 0 },
      recommendations: []
    }

    conflicts.forEach(conflict => {
      // 按類型統計
      const type = conflict.conflictType
      summary.byType[type] = (summary.byType[type] || 0) + 1

      // 按嚴重程度統計
      summary.bySeverity[conflict.severity]++
    })

    // 產生建議
    if (summary.bySeverity.high > 0) {
      summary.recommendations.push('建議手動檢查狀態衝突')
    }
    if (summary.bySeverity.medium > 5) {
      summary.recommendations.push('建議使用合併最佳屬性策略')
    }
    if (summary.total > 20) {
      summary.recommendations.push('考慮分批處理衝突')
    }

    return summary
  }

  getSupportedStrategies () {
    return Array.from(this.conflictStrategies.entries()).map(([key, strategy]) => ({
      key,
      name: strategy.name,
      description: strategy.description
    }))
  }

  getResolutionHistory (limit = 10) {
    return this.resolutionHistory.slice(-limit).reverse()
  }

  async emitConflictEvent (eventName, data) {
    if (this.eventBus) {
      await this.eventBus.emit(eventName, {
        timestamp: Date.now(),
        ...data
      })
    }
  }

  async registerEventListeners () {
    if (!this.eventBus) return

    const listeners = [
      {
        event: SYNC_EVENTS.CONFLICT_DETECTED,
        handler: this.handleConflictDetected.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      }
    ]

    for (const { event, handler, priority } of listeners) {
      const listenerId = await this.eventBus.on(event, handler, { priority })
      this.registeredListeners.set(event, listenerId)
    }
  }

  async unregisterEventListeners () {
    if (!this.eventBus) return

    for (const [event, listenerId] of this.registeredListeners) {
      try {
        await this.eventBus.off(event, listenerId)
      } catch (error) {
        this.logger.error(`❌ 取消註冊事件監聽器失敗 (${event}):`, error)
      }
    }
    this.registeredListeners.clear()
  }

  async handleConflictDetected (event) {
    try {
      this.logger.log('⚠️ 檢測到衝突，準備自動解決')
      const { conflicts, strategy } = event.data || {}

      if (conflicts && conflicts.length > 0) {
        await this.resolveConflicts(conflicts, strategy || 'keep_latest')
      }
    } catch (error) {
      this.logger.error('❌ 處理衝突檢測事件失敗:', error)
    }
  }

  getStatus () {
    return {
      initialized: this.state.initialized,
      resolving: this.state.resolving,
      supportedStrategies: this.conflictStrategies.size,
      historyCount: this.resolutionHistory.length,
      stats: { ...this.stats }
    }
  }

  getHealthStatus () {
    const resolutionRate = this.stats.totalConflicts > 0
      ? ((this.stats.autoResolved + this.stats.manualResolved) / this.stats.totalConflicts)
      : 1.0

    return {
      service: 'SyncConflictResolver',
      healthy: this.state.initialized && resolutionRate >= 0.8,
      status: this.state.resolving ? 'resolving' : 'ready',
      metrics: {
        totalConflicts: this.stats.totalConflicts,
        resolutionRate: (resolutionRate * 100).toFixed(2) + '%',
        pendingConflicts: this.stats.unresolved
      }
    }
  }
}

module.exports = SyncConflictResolver
