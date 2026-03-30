/**
 * 同步策略處理器
 *
 * 負責功能：
 * - 分析不同數據源的同步策略
 * - 處理數據同步的優先級和順序
 * - 執行智能同步決策和優化
 * - 管理同步策略的配置和調整
 *
 * 設計考量：
 * - 基於規則的同步策略引擎
 * - 支援多種同步模式和策略
 * - 提供智能衝突解決建議
 * - 完整的策略執行監控
 */

// 移除未使用的常數導入
// const {
//   SYNC_EVENTS,
//   SYNC_STRATEGIES,
//   EVENT_PRIORITIES
// } = require('src/background/constants/module-constants')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

/**
 * 同步優先級定義
 * 書籍為核心資料最優先，標註次之，設定最後
 */
const SYNC_PRIORITY = {
  books: 1,
  annotations: 2,
  settings: 3
}

/** 未知資料類型的預設優先級（排在已知類型之後） */
const DEFAULT_PRIORITY = 99

class SyncStrategyProcessor {
  constructor (eventBus, options = {}) {
    this.eventBus = eventBus
    this.logger = options.logger || console
    this.conflictResolver = options.conflictResolver || null

    this.state = {
      initialized: false,
      processing: false
    }

    // 同步策略配置
    this.strategies = new Map()
    this.activeProcesses = new Map()

    // 統計資料
    this.stats = {
      strategiesProcessed: 0,
      decisionsExecuted: 0,
      conflictsResolved: 0
    }
  }

  /**
   * 初始化同步策略處理器
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('⚠️ 同步策略處理器已初始化')
      return
    }

    try {
      this.logger.log('🔄 初始化同步策略處理器')

      // 設置預設策略
      this.setupDefaultStrategies()

      this.state.initialized = true
      this.logger.log('✅ 同步策略處理器初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化同步策略處理器失敗:', error)
      throw error
    }
  }

  /**
   * 設置預設策略
   */
  setupDefaultStrategies () {
    const defaultStrategies = [
      {
        name: 'priority-based',
        processor: this.processPriorityBasedStrategy.bind(this)
      },
      {
        name: 'timestamp-based',
        processor: this.processTimestampBasedStrategy.bind(this)
      },
      {
        name: 'conflict-resolution',
        processor: this.processConflictResolutionStrategy.bind(this)
      }
    ]

    defaultStrategies.forEach(strategy => {
      this.strategies.set(strategy.name, strategy)
    })

    this.logger.log(`✅ 設置了 ${defaultStrategies.length} 個預設同步策略`)
  }

  /**
   * 處理同步策略
   */
  async processStrategy (strategyName, data) {
    if (!this.state.initialized) {
      await this.initialize()
    }

    const strategy = this.strategies.get(strategyName)
    if (!strategy) {
      const error = new Error(`未知的同步策略: ${strategyName}`)
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'general', strategyName }
      throw error
    }

    try {
      this.stats.strategiesProcessed++
      const result = await strategy.processor(data)
      return result
    } catch (error) {
      this.logger.error(`❌ 處理同步策略失敗 (${strategyName}):`, error)
      throw error
    }
  }

  /**
   * 處理優先級導向策略
   *
   * 按資料類型排序同步順序：書籍 > 標註 > 設定
   * 接收 data.items 陣列（每個 item 有 type 欄位），回傳按優先級排序的結果
   */
  async processPriorityBasedStrategy (data) {
    this.logger.log('執行優先級導向同步策略')

    const items = data.items || []

    const sortedItems = [...items].sort((a, b) => {
      const priorityA = SYNC_PRIORITY[a.type] || DEFAULT_PRIORITY
      const priorityB = SYNC_PRIORITY[b.type] || DEFAULT_PRIORITY
      return priorityA - priorityB
    })

    const result = {
      strategy: 'priority-based',
      decision: 'sync',
      sortedItems,
      processed: true
    }

    this.stats.decisionsExecuted++
    return result
  }

  /**
   * 處理時間戳導向策略
   *
   * 比對 local 和 remote 的 updatedAt 時間戳，決定同步方向：
   * - remote 較新 -> 'pull'
   * - local 較新 -> 'push'
   * - 相同 -> 'skip'
   * - 缺少時間戳 -> 'pull'（保守策略，以遠端為準）
   */
  async processTimestampBasedStrategy (data) {
    this.logger.log('執行時間戳導向同步策略')

    const localTimestamp = data.localTimestamp
    const remoteTimestamp = data.remoteTimestamp

    let decision

    if (!localTimestamp || !remoteTimestamp) {
      // 缺少時間戳，保守策略以遠端為準
      decision = 'pull'
    } else {
      const localTime = new Date(localTimestamp).getTime()
      const remoteTime = new Date(remoteTimestamp).getTime()

      if (remoteTime > localTime) {
        decision = 'pull'
      } else if (localTime > remoteTime) {
        decision = 'push'
      } else {
        decision = 'skip'
      }
    }

    const result = {
      strategy: 'timestamp-based',
      decision,
      localTimestamp: localTimestamp || null,
      remoteTimestamp: remoteTimestamp || null,
      processed: true
    }

    this.stats.decisionsExecuted++
    return result
  }

  /**
   * 處理衝突解決策略
   *
   * 整合 SyncConflictResolver（如果有注入）進行衝突處理：
   * - 有 conflictResolver -> 委託處理
   * - 無 conflictResolver -> Last-Write-Wins 預設策略（比較 updatedAt）
   */
  async processConflictResolutionStrategy (data) {
    this.logger.log('執行衝突解決同步策略')

    const localVersion = data.localVersion || {}
    const remoteVersion = data.remoteVersion || {}

    let resolution

    if (this.conflictResolver) {
      // 委託給注入的衝突解決器
      resolution = await this.conflictResolver.resolveConflict({
        localVersion,
        remoteVersion
      })
    } else {
      // Last-Write-Wins 預設策略
      const localTime = localVersion.updatedAt
        ? new Date(localVersion.updatedAt).getTime()
        : 0
      const remoteTime = remoteVersion.updatedAt
        ? new Date(remoteVersion.updatedAt).getTime()
        : 0

      const winner = remoteTime >= localTime ? 'remote' : 'local'

      resolution = {
        strategy: 'last-write-wins',
        winner
      }
    }

    const result = {
      strategy: 'conflict-resolution',
      decision: 'resolve',
      resolution,
      processed: true
    }

    this.stats.conflictsResolved++
    return result
  }

  /**
   * 獲取狀態
   */
  getStatus () {
    return {
      initialized: this.state.initialized,
      processing: this.state.processing,
      strategiesCount: this.strategies.size,
      stats: { ...this.stats }
    }
  }

  /**
   * 重置狀態
   */
  reset () {
    this.activeProcesses.clear()
    this.stats = {
      strategiesProcessed: 0,
      decisionsExecuted: 0,
      conflictsResolved: 0
    }
  }
}

module.exports = SyncStrategyProcessor
