/**
 * @fileoverview Data Synchronization Service - 跨平台資料同步服務
 * @version v2.0.0
 * @since 2025-08-15
 *
 * 負責功能：
 * - 跨平台資料增量同步
 * - 資料差異計算和衝突檢測
 * - 同步作業狀態管理和進度追蹤
 * - 多策略同步支援和錯誤恢復
 *
 * 設計考量：
 * - 高效能差異演算法，支援大量資料處理
 * - 事件驅動架構，與 Data Domain Coordinator 整合
 * - 併發同步支援，避免資源競爭
 * - 智能錯誤恢復和重試機制
 *
 * 處理流程：
 * 1. 接收跨平台同步請求
 * 2. 從各平台取得資料並計算差異
 * 3. 檢測衝突並制定同步策略
 * 4. 執行同步操作並追蹤進度
 * 5. 處理錯誤和完成通知
 *
 * 使用情境：
 * - Data Domain Coordinator 委派同步作業
 * - 使用者主動觸發跨平台同步
 * - 定期自動同步和增量更新
 * - 平台切換時的資料一致性保證
 */

const BaseModule = require('../../../lifecycle/base-module.js')

class DataSynchronizationService extends BaseModule {
  /**
   * 初始化資料同步服務
   * @param {EventBus} eventBus - 事件總線實例
   * @param {Object} dependencies - 依賴注入物件
   */
  constructor (eventBus, dependencies = {}) {
    super({
      eventBus: eventBus,
      logger: dependencies.logger || console,
      config: dependencies.config || {}
    })

    this.eventBus = eventBus
    this.logger = dependencies.logger || console
    this.config = dependencies.config || {}

    // 同步作業管理
    this.activeSyncJobs = new Map()
    this.syncJobQueue = []
    this.completedJobs = new Map()

    // 同步策略配置
    this.syncStrategies = {
      MERGE: 'SMART_MERGE',
      OVERWRITE: 'SOURCE_OVERWRITE', 
      APPEND: 'APPEND_ONLY',
      MANUAL: 'MANUAL_RESOLUTION'
    }

    // 效能監控
    this.performanceMetrics = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      avgSyncDuration: 0,
      dataProcessed: 0
    }

    // 配置管理
    this.defaultConfig = {
      maxConcurrentSyncs: 3,
      syncTimeout: 300000,        // 5 分鐘
      retryAttempts: 3,
      retryDelay: 5000,           // 5 秒
      maxRetryDelay: 30000,       // 最大重試延遲
      batchSize: 100,             // 批次處理大小
      enableProgressTracking: true,
      cleanupInterval: 600000,    // 10 分鐘
      // 新增的性能優化選項
      compareFields: ['title', 'progress', 'lastUpdated'],
      caseSensitive: true,
      numericTolerance: 0,
      progressConflictThreshold: 15,
      enableIntelligentConflictDetection: true,
      autoResolveConflicts: false
    }

    this.effectiveConfig = { ...this.defaultConfig, ...this.config }

    // 服務狀態
    this.isInitialized = false
    this.isRunning = false
  }

  /**
   * 初始化同步服務
   */
  async initialize () {
    try {
      await this.log('開始初始化 Data Synchronization Service')

      // 註冊事件監聽器
      await this.registerEventListeners()

      // 啟動清理任務
      if (this.effectiveConfig.cleanupInterval > 0) {
        this.startCleanupTasks()
      }

      this.isInitialized = true
      await this.log('Data Synchronization Service 初始化完成')

      // 發送初始化完成事件
      await this.emitEvent('DATA.SYNC.SERVICE.INITIALIZED', {
        strategies: Object.keys(this.syncStrategies),
        config: this.effectiveConfig,
        timestamp: Date.now()
      })

    } catch (error) {
      await this.log(`Data Synchronization Service 初始化失敗: ${error.message}`, 'error')
      throw error
    }
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners () {
    // 監聽來自 Data Domain Coordinator 的同步請求
    this.eventBus.on('DATA.CROSS_PLATFORM.SYNC.REQUESTED', this.handleSyncRequest.bind(this))
    
    // 監聽同步取消請求
    this.eventBus.on('DATA.SYNC.CANCEL.REQUESTED', this.handleSyncCancelRequest.bind(this))
    
    // 監聽平台資料更新事件
    this.eventBus.on('DATA.PLATFORM.UPDATED', this.handlePlatformDataUpdate.bind(this))

    await this.log('事件監聽器註冊完成')
  }

  /**
   * 處理跨平台同步請求
   * @param {Object} event - 同步請求事件
   */
  async handleSyncRequest (event) {
    const { sourcePlatforms, targetPlatforms, syncOptions } = event.data || {}
    
    try {
      await this.log(`處理跨平台同步請求: ${sourcePlatforms} -> ${targetPlatforms}`)
      
      // 生成同步作業 ID
      const syncId = this.generateSyncJobId()
      
      // 委派給 initiateCrossPlatformSync 處理
      await this.initiateCrossPlatformSync(syncId, sourcePlatforms, targetPlatforms, syncOptions)
      
    } catch (error) {
      await this.log(`處理同步請求失敗: ${error.message}`, 'error')
    }
  }

  /**
   * 處理同步取消請求
   * @param {Object} event - 取消請求事件
   */
  async handleSyncCancelRequest (event) {
    const { syncId, reason, force } = event.data || {}
    
    try {
      await this.log(`處理同步取消請求: ${syncId}, 原因: ${reason}`)
      
      const result = await this.cancelSync(syncId)
      
      // 發送取消完成事件
      await this.emitEvent('DATA.SYNC.CANCELLED', {
        syncId,
        reason,
        force,
        result,
        timestamp: Date.now()
      })
      
    } catch (error) {
      await this.log(`處理同步取消請求失敗: ${error.message}`, 'error')
    }
  }

  /**
   * 處理平台資料更新事件
   * @param {Object} event - 平台資料更新事件
   */
  async handlePlatformDataUpdate (event) {
    const { platform, updatedBooks, updateType } = event.data || {}
    
    try {
      await this.log(`處理平台資料更新: ${platform}, 類型: ${updateType}, 書籍數: ${updatedBooks?.length || 0}`)
      
      // 檢查是否有相關的活躍同步作業需要更新
      for (const [syncId, job] of this.activeSyncJobs.entries()) {
        if (job.sourcePlatforms?.includes(platform) || job.targetPlatforms?.includes(platform)) {
          await this.log(`同步作業 ${syncId} 受到平台更新影響，標記需要重新評估`)
          job.needsReassessment = true
        }
      }
      
    } catch (error) {
      await this.log(`處理平台資料更新失敗: ${error.message}`, 'error')
    }
  }

  /**
   * 啟動跨平台同步
   * @param {string} syncId - 同步作業 ID
   * @param {Array} sourcePlatforms - 源平台列表
   * @param {Array} targetPlatforms - 目標平台列表
   * @param {Object} options - 同步選項
   */
  async initiateCrossPlatformSync (syncId, sourcePlatforms, targetPlatforms, options = {}) {
    
    try {
      await this.log(`啟動跨平台同步: ${syncId}`)
      
      // 檢查併發限制
      if (this.activeSyncJobs.size >= this.effectiveConfig.maxConcurrentSyncs) {
        this.syncJobQueue.push({ syncId, sourcePlatforms, targetPlatforms, options })
        await this.log(`同步作業 ${syncId} 已加入佇列，等待處理`)
        return { status: 'QUEUED', syncId }
      }
      
      // 建立同步作業記錄
      const syncJob = {
        syncId,
        sourcePlatforms,
        targetPlatforms,
        options,
        status: 'RUNNING',
        startTime: Date.now(),
        progress: 0,
        totalItems: 0,
        processedItems: 0
      }
      
      this.activeSyncJobs.set(syncId, syncJob)
      
      // 發送同步開始事件
      await this.emitEvent('DATA.SYNC.STARTED', {
        syncId,
        sourcePlatforms,
        targetPlatforms,
        options,
        timestamp: Date.now()
      })
      
      // 更新效能指標
      this.performanceMetrics.totalSyncs += 1
      
      // 執行完整的同步邏輯
      this.executeFullSyncWorkflow(syncId, syncJob, sourcePlatforms, targetPlatforms, options)
      
      return { status: 'STARTED', syncId }
      
    } catch (error) {
      await this.log(`啟動跨平台同步失敗: ${error.message}`, 'error')
      this.performanceMetrics.failedSyncs += 1
      throw error
    }
  }

  /**
   * 計算資料差異
   * @param {Object} sourceData - 源資料
   * @param {Object} targetData - 目標資料
   * @returns {Object} 差異報告
   */
  async calculateDataDifferences (sourceData, targetData) {
    
    try {
      // 確保輸入為陣列
      const source = Array.isArray(sourceData) ? sourceData : []
      const target = Array.isArray(targetData) ? targetData : []
      
      // 建立目標資料的 ID 對應表
      const targetMap = new Map()
      const validTarget = []
      
      for (const item of target) {
        if (item && item.id) {
          targetMap.set(item.id, item)
          validTarget.push(item)
        }
      }
      
      const added = []
      const modified = []
      const unchanged = []
      
      // 檢查源資料中的每個項目
      for (const sourceItem of source) {
        if (!sourceItem || !sourceItem.id) {
          continue // 跳過無效資料
        }
        
        const targetItem = targetMap.get(sourceItem.id)
        
        if (!targetItem) {
          // 目標中不存在，標記為新增
          added.push(sourceItem)
        } else {
          // 比較是否有變更（使用高效演算法）
          const hasChanges = this.compareBookDataOptimized(sourceItem, targetItem)
          if (hasChanges) {
            modified.push({
              id: sourceItem.id,
              source: sourceItem,
              target: targetItem,
              changes: this.getFieldChanges(sourceItem, targetItem)
            })
          } else {
            unchanged.push(sourceItem)
          }
          
          // 從目標對應表中移除已處理的項目
          targetMap.delete(sourceItem.id)
        }
      }
      
      // 剩餘在目標對應表中的項目為刪除項目
      const deleted = Array.from(targetMap.values())
      
      const differences = {
        added,
        modified,
        deleted,
        unchanged,
        summary: {
          addedCount: added.length,
          modifiedCount: modified.length,
          deletedCount: deleted.length,
          unchangedCount: unchanged.length,
          totalChanges: added.length + modified.length + deleted.length
        }
      }
      
      await this.log(`資料差異計算完成: +${added.length} ~${modified.length} -${deleted.length}`)
      
      return differences
      
    } catch (error) {
      await this.log(`資料差異計算失敗: ${error.message}`, 'error')
      throw error
    }
  }

  /**
   * 比較兩個書籍資料是否有差異（優化版本）
   * @param {Object} source - 源書籍資料
   * @param {Object} target - 目標書籍資料
   * @returns {boolean} 是否有差異
   */
  compareBookDataOptimized (source, target) {
    // 使用可配置的比較欄位和高效策略
    const compareFields = this.effectiveConfig.compareFields || ['title', 'progress', 'lastUpdated']
    const caseSensitive = this.effectiveConfig.caseSensitive !== false
    
    // 高效循環：提早退出機制
    for (let i = 0; i < compareFields.length; i++) {
      const field = compareFields[i]
      const sourceValue = source[field]
      const targetValue = target[field]
      
      // 快速等同檢查
      if (sourceValue === targetValue) continue
      
      // 特殊類型處理
      if (typeof sourceValue === 'string' && typeof targetValue === 'string') {
        if (!caseSensitive) {
          if (sourceValue.toLowerCase() !== targetValue.toLowerCase()) return true
        } else {
          return true
        }
      } else if (typeof sourceValue === 'number' && typeof targetValue === 'number') {
        // 數字類型精度檢查
        const tolerance = this.effectiveConfig.numericTolerance || 0
        if (Math.abs(sourceValue - targetValue) > tolerance) return true
      } else {
        // 其他類型直接比較
        return true
      }
    }
    
    return false
  }
  
  /**
   * 舊版本比較方法（為了向後相容）
   * @param {Object} source - 源書籍資料
   * @param {Object} target - 目標書籍資料
   * @returns {boolean} 是否有差異
   */
  compareBookData (source, target) {
    return this.compareBookDataOptimized(source, target)
  }

  /**
   * 取得欄位變更詳情（優化版本）
   * @param {Object} source - 源資料
   * @param {Object} target - 目標資料
   * @returns {Object} 變更詳情
   */
  getFieldChanges (source, target) {
    const changes = {}
    const compareFields = this.effectiveConfig.compareFields || ['title', 'progress', 'lastUpdated']
    const caseSensitive = this.effectiveConfig.caseSensitive !== false
    const numericTolerance = this.effectiveConfig.numericTolerance || 0
    
    for (const field of compareFields) {
      const sourceValue = source[field]
      const targetValue = target[field]
      
      let hasChange = false
      
      // 精細的變更檢測
      if (sourceValue === targetValue) {
        continue
      } else if (typeof sourceValue === 'string' && typeof targetValue === 'string') {
        if (caseSensitive) {
          hasChange = sourceValue !== targetValue
        } else {
          hasChange = sourceValue.toLowerCase() !== targetValue.toLowerCase()
        }
      } else if (typeof sourceValue === 'number' && typeof targetValue === 'number') {
        hasChange = Math.abs(sourceValue - targetValue) > numericTolerance
      } else {
        hasChange = true
      }
      
      if (hasChange) {
        changes[field] = {
          from: targetValue,
          to: sourceValue,
          type: this.getChangeType(sourceValue, targetValue),
          severity: this.calculateChangeSeverity(field, sourceValue, targetValue)
        }
      }
    }
    
    return changes
  }
  
  /**
   * 取得變更類型
   * @param {*} sourceValue - 源值
   * @param {*} targetValue - 目標值
   * @returns {string} 變更類型
   */
  getChangeType (sourceValue, targetValue) {
    if (targetValue === null || targetValue === undefined) return 'ADDED'
    if (sourceValue === null || sourceValue === undefined) return 'REMOVED'
    if (typeof sourceValue !== typeof targetValue) return 'TYPE_CHANGED'
    return 'MODIFIED'
  }
  
  /**
   * 計算變更嚴重程度
   * @param {string} field - 欄位名稱
   * @param {*} sourceValue - 源值
   * @param {*} targetValue - 目標值
   * @returns {string} 嚴重程度
   */
  calculateChangeSeverity (field, sourceValue, targetValue) {
    // 關鍵欄位的變更更重要
    if (field === 'progress') {
      const diff = Math.abs((sourceValue || 0) - (targetValue || 0))
      if (diff >= 50) return 'HIGH'
      if (diff >= 20) return 'MEDIUM'
      return 'LOW'
    }
    
    if (field === 'title') {
      return 'HIGH' // 標題變更通常很重要
    }
    
    return 'MEDIUM'
  }

  /**
   * 檢測資料衝突（智能版本）
   * @param {Object} sourceData - 源資料
   * @param {Object} targetData - 目標資料
   * @param {Object} changes - 變更內容
   * @returns {Object} 衝突報告
   */
  async detectConflicts (sourceData, targetData, changes) {
    
    try {
      const conflicts = []
      
      // 檢查修改項目中的衝突
      if (changes.modified) {
        for (const modifiedItem of changes.modified) {
          const conflict = this.checkItemConflicts(modifiedItem)
          if (conflict) {
            conflicts.push(conflict)
          }
        }
      }
      
      const conflictReport = {
        hasConflicts: conflicts.length > 0,
        conflictCount: conflicts.length,
        conflicts,
        severity: this.calculateConflictSeverity(conflicts),
        recommendations: this.generateConflictRecommendations(conflicts)
      }
      
      if (conflicts.length > 0) {
        await this.log(`檢測到 ${conflicts.length} 個資料衝突`)
      }
      
      return conflictReport
      
    } catch (error) {
      await this.log(`衝突檢測失敗: ${error.message}`, 'error')
      throw error
    }
  }

  /**
   * 檢查單個項目的衝突（智能版本）
   * @param {Object} modifiedItem - 修改項目
   * @returns {Object|null} 衝突資訊
   */
  checkItemConflicts (modifiedItem) {
    const { source, target, changes } = modifiedItem
    
    // 確保 changes 存在
    if (!changes) {
      return null
    }
    
    const conflicts = []
    
    // 智能衝突檢測：多種衝突類型
    for (const [field, change] of Object.entries(changes)) {
      const conflict = this.detectFieldConflict(field, change, source, target)
      if (conflict) {
        conflicts.push({
          ...conflict,
          itemId: modifiedItem.id,
          field,
          sourceValue: change.to,
          targetValue: change.from,
          changeType: change.type,
          severity: change.severity || 'MEDIUM'
        })
      }
    }
    
    // 返回最高優先級的衝突
    if (conflicts.length === 0) return null
    if (conflicts.length === 1) return conflicts[0]
    
    // 多個衝突時，選擇最嚴重的
    return conflicts.reduce((prev, current) => 
      this.getConflictPriority(current.type) > this.getConflictPriority(prev.type) ? current : prev
    )
  }
  
  /**
   * 檢測單一欄位的衝突
   * @param {string} field - 欄位名稱
   * @param {Object} change - 變更詳情
   * @param {Object} source - 源資料
   * @param {Object} target - 目標資料
   * @returns {Object|null} 衝突資訊
   */
  detectFieldConflict (field, change, source, target) {
    switch (field) {
      case 'progress':
        return this.detectProgressConflict(change, source, target)
      case 'title':
        return this.detectTitleConflict(change, source, target)
      case 'lastUpdated':
        return this.detectTimestampConflict(change, source, target)
      default:
        return this.detectGenericConflict(field, change, source, target)
    }
  }
  
  /**
   * 檢測進度衝突
   */
  detectProgressConflict (change, source, target) {
    const diff = Math.abs((change.to || 0) - (change.from || 0))
    const threshold = this.effectiveConfig.progressConflictThreshold || 15
    
    if (diff > threshold) {
      return {
        type: 'PROGRESS_MISMATCH',
        description: `進度差異 ${diff}% 超過闾值 ${threshold}%`,
        recommendation: diff > 50 ? 'MANUAL_REVIEW' : 'USE_LATEST_TIMESTAMP'
      }
    }
    return null
  }
  
  /**
   * 檢測標題衝突
   */
  detectTitleConflict (change, source, target) {
    if (change.type === 'MODIFIED') {
      const similarity = this.calculateStringSimilarity(change.from, change.to)
      if (similarity < 0.8) { // 80% 相似度闾值
        return {
          type: 'TITLE_MISMATCH',
          description: `標題差異過大，相似度 ${(similarity * 100).toFixed(1)}%`,
          recommendation: 'MANUAL_REVIEW'
        }
      }
    }
    return null
  }
  
  /**
   * 檢測時間戳衝突
   */
  detectTimestampConflict (change, source, target) {
    const sourceTime = new Date(change.to).getTime()
    const targetTime = new Date(change.from).getTime()
    const timeDiff = Math.abs(sourceTime - targetTime)
    
    // 如果時間差異小於 1 分鐘，可能是同時更新衝突
    if (timeDiff < 60000) {
      return {
        type: 'TIMESTAMP_CONFLICT',
        description: '同時更新衝突，時間差異小於 1 分鐘',
        recommendation: 'USE_SOURCE_PRIORITY'
      }
    }
    return null
  }
  
  /**
   * 檢測一般欄位衝突
   */
  detectGenericConflict (field, change, source, target) {
    if (change.severity === 'HIGH') {
      return {
        type: 'FIELD_MISMATCH',
        description: `欄位 ${field} 發生高嚴重程度變更`,
        recommendation: 'MANUAL_REVIEW'
      }
    }
    return null
  }
  
  /**
   * 計算字串相似度
   */
  calculateStringSimilarity (str1, str2) {
    if (!str1 || !str2) return 0
    if (str1 === str2) return 1
    
    const len1 = str1.length
    const len2 = str2.length
    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0))
    
    for (let i = 0; i <= len1; i++) matrix[i][0] = i
    for (let j = 0; j <= len2; j++) matrix[0][j] = j
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        )
      }
    }
    
    const distance = matrix[len1][len2]
    return 1 - distance / Math.max(len1, len2)
  }
  
  /**
   * 取得衝突優先級
   */
  getConflictPriority (conflictType) {
    const priorities = {
      'TITLE_MISMATCH': 5,
      'PROGRESS_MISMATCH': 4,
      'TIMESTAMP_CONFLICT': 3,
      'FIELD_MISMATCH': 2,
      'DATA_CORRUPTION': 6
    }
    return priorities[conflictType] || 1
  }

  /**
   * 計算衝突嚴重程度（智能版本）
   * @param {Array} conflicts - 衝突列表
   * @returns {string} 嚴重程度
   */
  calculateConflictSeverity (conflicts) {
    if (conflicts.length === 0) return 'NONE'
    
    // 基於衝突類型和數量的智能評估
    let severityScore = 0
    const typeWeights = {
      'TITLE_MISMATCH': 5,
      'DATA_CORRUPTION': 6,
      'PROGRESS_MISMATCH': 3,
      'TIMESTAMP_CONFLICT': 2,
      'FIELD_MISMATCH': 1
    }
    
    for (const conflict of conflicts) {
      const weight = typeWeights[conflict.type] || 1
      const fieldMultiplier = conflict.field === 'title' ? 1.5 : 1
      severityScore += weight * fieldMultiplier
    }
    
    // 數量因子
    const countMultiplier = Math.min(conflicts.length / 5, 2) // 最高 2 倍
    severityScore *= countMultiplier
    
    if (severityScore >= 15) return 'CRITICAL'
    if (severityScore >= 10) return 'HIGH'
    if (severityScore >= 5) return 'MEDIUM'
    return 'LOW'
  }

  /**
   * 生成衝突解決建議（智能版本）
   * @param {Array} conflicts - 衝突列表
   * @returns {Array} 解決建議
   */
  generateConflictRecommendations (conflicts) {
    const recommendations = []
    const strategyPriority = {} // 追蹤策略優先級
    
    for (const conflict of conflicts) {
      const rec = this.createSmartRecommendation(conflict)
      recommendations.push(rec)
      
      // 統計策略使用頻率
      strategyPriority[rec.strategy] = (strategyPriority[rec.strategy] || 0) + 1
    }
    
    // 增加整體建議
    if (conflicts.length > 5) {
      recommendations.unshift({
        type: 'BATCH_STRATEGY',
        strategy: this.getMostCommonStrategy(strategyPriority),
        description: `建議采用批量處理策略，共 ${conflicts.length} 個衝突`,
        confidence: this.calculateRecommendationConfidence(conflicts),
        estimatedTime: this.estimateResolutionTime(conflicts)
      })
    }
    
    return recommendations
  }
  
  /**
   * 創建智能解決建議
   */
  createSmartRecommendation (conflict) {
    const base = {
      conflictId: conflict.itemId,
      field: conflict.field,
      conflictType: conflict.type,
      severity: conflict.severity
    }
    
    switch (conflict.type) {
      case 'PROGRESS_MISMATCH':
        return {
          ...base,
          strategy: conflict.recommendation || 'USE_LATEST_TIMESTAMP',
          description: '基於時間戳优先策略，使用最新更新的進度',
          confidence: 0.85,
          autoResolvable: true
        }
      case 'TITLE_MISMATCH':
        return {
          ...base,
          strategy: 'MANUAL_REVIEW',
          description: '標題差異需要人工確認，建議手動選擇',
          confidence: 0.95,
          autoResolvable: false
        }
      case 'TIMESTAMP_CONFLICT':
        return {
          ...base,
          strategy: 'USE_SOURCE_PRIORITY',
          description: '同時更新衝突，優先使用源平台資料',
          confidence: 0.75,
          autoResolvable: true
        }
      default:
        return {
          ...base,
          strategy: 'MANUAL_REVIEW',
          description: '未知衝突類型，需要手動處理',
          confidence: 0.5,
          autoResolvable: false
        }
    }
  }
  
  /**
   * 取得最常用策略
   */
  getMostCommonStrategy (strategyPriority) {
    return Object.entries(strategyPriority)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'MANUAL_REVIEW'
  }
  
  /**
   * 計算建議信心度
   */
  calculateRecommendationConfidence (conflicts) {
    const autoResolvableCount = conflicts.filter(c => 
      c.recommendation !== 'MANUAL_REVIEW'
    ).length
    return autoResolvableCount / conflicts.length
  }
  
  /**
   * 估算解決時間
   */
  estimateResolutionTime (conflicts) {
    const manualCount = conflicts.filter(c => 
      c.recommendation === 'MANUAL_REVIEW'
    ).length
    const autoCount = conflicts.length - manualCount
    
    return {
      estimated: autoCount * 0.1 + manualCount * 2, // 秒
      manual: manualCount,
      automatic: autoCount
    }
  }

  /**
   * 應用同步變更（智能版本）
   * @param {string} platform - 目標平台
   * @param {Object} changes - 變更內容
   * @param {string} strategy - 同步策略
   * @returns {Object} 應用結果
   */
  async applySyncChanges (platform, changes, strategy) {
    
    try {
      await this.log(`應用同步變更到 ${platform}, 策略: ${strategy}`)
      
      const result = {
        platform,
        strategy,
        applied: {
          added: 0,
          modified: 0,
          deleted: 0
        },
        failed: [],
        timestamp: Date.now()
      }
      
      // 根據策略應用變更
      switch (strategy) {
        case 'MERGE':
        case 'SMART_MERGE':
          result.applied = await this.applyMergeStrategy(platform, changes)
          break
        case 'OVERWRITE':
        case 'SOURCE_OVERWRITE':
          result.applied = await this.applyOverwriteStrategy(platform, changes)
          break
        case 'APPEND':
        case 'APPEND_ONLY':
          result.applied = await this.applyAppendStrategy(platform, changes)
          break
        default:
          throw new Error(`不支援的同步策略: ${strategy}`)
      }
      
      return result
      
    } catch (error) {
      await this.log(`應用同步變更失敗: ${error.message}`, 'error')
      throw error
    }
  }

  /**
   * 應用 MERGE 策略（智能合併）
   * @param {string} platform - 目標平台
   * @param {Object} changes - 變更內容
   * @returns {Object} 應用統計
   */
  async applyMergeStrategy (platform, changes) {
    const applied = { added: 0, modified: 0, deleted: 0, errors: [] }
    const batchSize = this.effectiveConfig.batchSize || 100
    
    try {
      // 智能合併：優先處理高價值變更
      
      // 1. 處理新增項目（最安全）
      if (changes.added && changes.added.length > 0) {
        applied.added = await this.processBatchChanges(
          platform, 'ADD', changes.added, batchSize
        )
      }
      
      // 2. 處理修改項目（需要智能衝突檢測）
      if (changes.modified && changes.modified.length > 0) {
        const mergeResults = await this.processModifiedItemsIntelligently(
          platform, changes.modified, batchSize
        )
        applied.modified = mergeResults.success
        applied.errors.push(...mergeResults.errors)
      }
      
      // 3. 處理刪除項目（最後執行，需要確認）
      if (changes.deleted && changes.deleted.length > 0) {
        const deleteResults = await this.processDeletedItemsSafely(
          platform, changes.deleted, batchSize
        )
        applied.deleted = deleteResults.success
        applied.errors.push(...deleteResults.errors)
      }
      
      await this.log(`MERGE 策略應用完成 - 平台: ${platform}, 新增: ${applied.added}, 修改: ${applied.modified}, 刪除: ${applied.deleted}`)
      
    } catch (error) {
      await this.log(`MERGE 策略執行失敗: ${error.message}`, 'error')
      applied.errors.push({
        type: 'STRATEGY_ERROR',
        message: error.message,
        platform
      })
    }
    
    return applied
  }

  /**
   * 應用 OVERWRITE 策略（強制覆寫）
   * @param {string} platform - 目標平台
   * @param {Object} changes - 變更內容
   * @returns {Object} 應用統計
   */
  async applyOverwriteStrategy (platform, changes) {
    const applied = { added: 0, modified: 0, deleted: 0, errors: [], warnings: [] }
    const batchSize = this.effectiveConfig.batchSize || 100
    
    try {
      await this.log(`開始 OVERWRITE 策略 - 平台: ${platform}，這將覆寫所有目標資料`)
      
      // 警告：OVERWRITE 策略會丟失目標平台的獨有資料
      applied.warnings.push({
        type: 'DATA_LOSS_WARNING',
        message: '覆寫策略可能導致目標平台獨有資料丟失',
        platform
      })
      
      // 1. 強制新增所有源資料
      if (changes.added && changes.added.length > 0) {
        applied.added = await this.processBatchChanges(
          platform, 'FORCE_ADD', changes.added, batchSize
        )
      }
      
      // 2. 強制覆寫所有修改項目（忽略衝突）
      if (changes.modified && changes.modified.length > 0) {
        applied.modified = await this.processBatchChanges(
          platform, 'FORCE_OVERWRITE', changes.modified, batchSize
        )
      }
      
      // 3. 強制刪除目標平台中不存在於源的項目
      if (changes.deleted && changes.deleted.length > 0) {
        applied.deleted = await this.processBatchChanges(
          platform, 'FORCE_DELETE', changes.deleted, batchSize
        )
      }
      
      await this.log(`OVERWRITE 策略完成 - 平台: ${platform}, 新增: ${applied.added}, 覆寫: ${applied.modified}, 刪除: ${applied.deleted}`)
      
    } catch (error) {
      await this.log(`OVERWRITE 策略執行失敗: ${error.message}`, 'error')
      applied.errors.push({
        type: 'STRATEGY_ERROR',
        message: error.message,
        platform
      })
    }
    
    return applied
  }

  /**
   * 應用 APPEND 策略（僅追加）
   * @param {string} platform - 目標平台
   * @param {Object} changes - 變更內容
   * @returns {Object} 應用統計
   */
  async applyAppendStrategy (platform, changes) {
    const applied = { added: 0, modified: 0, deleted: 0, errors: [], skipped: [] }
    const batchSize = this.effectiveConfig.batchSize || 100
    
    try {
      await this.log(`開始 APPEND 策略 - 平台: ${platform}，僅追加新資料，不修改或刪除現有資料`)
      
      // APPEND 策略：只處理新增項目，忽略修改和刪除
      if (changes.added && changes.added.length > 0) {
        applied.added = await this.processBatchChanges(
          platform, 'SAFE_ADD', changes.added, batchSize
        )
      }
      
      // 記錄跳過的修改項目
      if (changes.modified && changes.modified.length > 0) {
        applied.skipped.push({
          type: 'MODIFICATIONS_SKIPPED',
          count: changes.modified.length,
          reason: 'APPEND 策略不允許修改現有資料'
        })
      }
      
      // 記錄跳過的刪除項目
      if (changes.deleted && changes.deleted.length > 0) {
        applied.skipped.push({
          type: 'DELETIONS_SKIPPED',
          count: changes.deleted.length,
          reason: 'APPEND 策略不允許刪除現有資料'
        })
      }
      
      await this.log(`APPEND 策略完成 - 平台: ${platform}, 新增: ${applied.added}, 跳過修改: ${changes.modified?.length || 0}, 跳過刪除: ${changes.deleted?.length || 0}`)
      
    } catch (error) {
      await this.log(`APPEND 策略執行失敗: ${error.message}`, 'error')
      applied.errors.push({
        type: 'STRATEGY_ERROR',
        message: error.message,
        platform
      })
    }
    
    return applied
  }

  /**
   * 監控同步進度
   * @param {string} syncId - 同步作業 ID
   * @returns {Object} 進度資訊
   */
  async monitorSyncProgress (syncId) {
    try {
      const job = this.activeSyncJobs.get(syncId) || this.completedJobs.get(syncId)
      
      if (!job) {
        return {
          found: false,
          syncId,
          message: '找不到指定的同步作業'
        }
      }
      
      const progress = {
        found: true,
        syncId,
        status: job.status,
        progress: job.progress || 0,
        startTime: job.startTime,
        endTime: job.endTime,
        duration: job.endTime ? job.endTime - job.startTime : Date.now() - job.startTime,
        totalItems: job.totalItems || 0,
        processedItems: job.processedItems || 0,
        sourcePlatforms: job.sourcePlatforms,
        targetPlatforms: job.targetPlatforms,
        error: job.error
      }
      
      return progress
      
    } catch (error) {
      await this.log(`監控同步進度失敗: ${error.message}`, 'error')
      throw error
    }
  }

  /**
   * 取消同步作業（優雅版本）
   * @param {string} syncId - 同步作業 ID
   * @returns {Object} 取消結果
   */
  async cancelSync (syncId) {
    
    try {
      const job = this.activeSyncJobs.get(syncId)
      
      if (!job) {
        return {
          success: false,
          syncId,
          message: '找不到活躍的同步作業'
        }
      }
      
      // 優雅取消流程
      const cancelResult = await this.performGracefulCancellation(syncId, job)
      
      await this.log(`同步作業 ${syncId} 已優雅取消`)
      
      return {
        success: true,
        syncId,
        message: '同步作業已成功取消',
        rollbackInfo: cancelResult.rollbackInfo,
        resourcesCleared: cancelResult.resourcesCleared
      }
      
    } catch (error) {
      await this.log(`取消同步作業失敗: ${error.message}`, 'error')
      throw error
    }
  }

  /**
   * 重試失敗的同步（智能版本）
   * @param {string} syncId - 同步作業 ID
   * @param {Object} retryOptions - 重試選項
   * @returns {Object} 重試結果
   */
  async retryFailedSync (syncId, retryOptions = {}) {
    
    try {
      const failedJob = this.completedJobs.get(syncId)
      
      if (!failedJob || failedJob.status !== 'FAILED') {
        return {
          success: false,
          syncId,
          message: '找不到失敗的同步作業'
        }
      }
      
      // 智能重試邏輯
      const retryResult = await this.performIntelligentRetry(failedJob, retryOptions)
      
      await this.log(`智能重試完成: ${syncId} -> ${retryResult.newSyncId}`)
      
      return {
        success: true,
        originalSyncId: syncId,
        newSyncId: retryResult.newSyncId,
        result: retryResult.result,
        retryStrategy: retryResult.strategy,
        errorAnalysis: retryResult.errorAnalysis
      }
      
    } catch (error) {
      await this.log(`重試同步作業失敗: ${error.message}`, 'error')
      throw error
    }
  }

  /**
   * 啟動清理任務
   */
  startCleanupTasks () {
    setInterval(() => {
      this.cleanupCompletedJobs()
    }, this.effectiveConfig.cleanupInterval)
  }

  /**
   * 清理已完成的同步作業
   */
  cleanupCompletedJobs () {
    const cutoffTime = Date.now() - (this.effectiveConfig.jobRetentionTime || 3600000) // 1小時

    let cleanedCount = 0
    for (const [jobId, job] of this.completedJobs.entries()) {
      if (job.completedAt && job.completedAt < cutoffTime) {
        this.completedJobs.delete(jobId)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      this.log(`清理了 ${cleanedCount} 個已完成的同步作業`)
    }
  }

  /**
   * 生成同步作業 ID
   * @returns {string} 唯一的同步作業 ID
   */
  generateSyncJobId () {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 發送事件
   * @param {string} eventType - 事件類型
   * @param {Object} data - 事件資料
   */
  async emitEvent (eventType, data) {
    if (this.eventBus && this.eventBus.emit) {
      await this.eventBus.emit(eventType, data)
    }
  }

  /**
   * 記錄日誌
   * @param {string} message - 日誌訊息
   * @param {string} level - 日誌級別
   */
  async log (message, level = 'info') {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] [DataSynchronizationService] ${message}`
    
    if (this.logger && this.logger[level]) {
      this.logger[level](logMessage)
    } else {
      console.log(logMessage)
    }
  }

  /**
   * 健康檢查
   * @returns {Object} 健康狀態報告
   */
  async healthCheck () {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      activeSyncJobs: this.activeSyncJobs.size,
      queuedJobs: this.syncJobQueue.length,
      performanceMetrics: this.performanceMetrics,
      lastCheck: Date.now()
    }
  }

  /**
   * 執行完整的同步工作流程
   */
  async executeFullSyncWorkflow (syncId, syncJob, sourcePlatforms, targetPlatforms, options) {
    try {
      await this.log(`開始完整同步工作流程: ${syncId}`)
      
      // 步驟 1: 取得各平台資料
      const sourceData = await this.fetchPlatformData(sourcePlatforms)
      const targetData = await this.fetchPlatformData(targetPlatforms)
      
      syncJob.progress = 20
      await this.emitSyncProgressEvent(syncId, 20, '資料擷取完成')
      
      // 步驟 2: 計算資料差異
      const differences = await this.calculateDataDifferences(sourceData, targetData)
      syncJob.totalItems = differences.summary.totalChanges
      
      syncJob.progress = 40
      await this.emitSyncProgressEvent(syncId, 40, '差異計算完成')
      
      // 步驟 3: 檢測衝突
      const conflicts = await this.detectConflicts(sourceData, targetData, differences)
      
      syncJob.progress = 60
      await this.emitSyncProgressEvent(syncId, 60, '衝突檢測完成')
      
      // 步驟 4: 處理衝突（如有）
      if (conflicts.hasConflicts) {
        await this.handleSyncConflicts(syncId, conflicts, options)
      }
      
      syncJob.progress = 80
      await this.emitSyncProgressEvent(syncId, 80, '衝突處理完成')
      
      // 步驟 5: 應用變更
      const strategy = options.strategy || this.syncStrategies.MERGE
      const results = []
      
      for (const platform of targetPlatforms) {
        const result = await this.applySyncChanges(platform, differences, strategy)
        results.push({ platform, result })
      }
      
      // 完成同步
      syncJob.status = 'COMPLETED'
      syncJob.endTime = Date.now()
      syncJob.progress = 100
      syncJob.results = results
      
      this.completedJobs.set(syncId, syncJob)
      this.activeSyncJobs.delete(syncId)
      
      this.performanceMetrics.successfulSyncs += 1
      
      await this.emitEvent('DATA.SYNC.COMPLETED', {
        syncId,
        status: 'SUCCESS',
        result: {
          processed: differences.summary.totalChanges,
          conflicts: conflicts.conflictCount,
          platformResults: results
        },
        timestamp: Date.now()
      })
      
      await this.log(`同步作業 ${syncId} 成功完成`)
      
    } catch (error) {
      // 失敗處理
      syncJob.status = 'FAILED'
      syncJob.error = error.message
      syncJob.endTime = Date.now()
      
      this.completedJobs.set(syncId, syncJob)
      this.activeSyncJobs.delete(syncId)
      
      this.performanceMetrics.failedSyncs += 1
      
      await this.emitEvent('DATA.SYNC.FAILED', {
        syncId,
        error: error.message,
        timestamp: Date.now()
      })
      
      await this.log(`同步作業 ${syncId} 失敗: ${error.message}`, 'error')
    }
  }
  
  /**
   * 發送同步進度事件
   */
  async emitSyncProgressEvent (syncId, progress, message) {
    await this.emitEvent('DATA.SYNC.PROGRESS', {
      syncId,
      progress,
      message,
      timestamp: Date.now()
    })
  }
  
  /**
   * 擷取平台資料（模擬實作）
   */
  async fetchPlatformData (platforms) {
    // 模擬從各平台獲取資料
    const allData = []
    for (const platform of platforms) {
      // 實際實作時需要與 Platform Domain 整合
      const platformData = await this.fetchDataFromPlatform(platform)
      allData.push(...platformData)
    }
    return allData
  }
  
  /**
   * 從單一平台獲取資料（模擬）
   */
  async fetchDataFromPlatform (platform) {
    // 模擬資料，實際應該與 Platform Adapter 整合
    return [
      {
        id: `${platform.toLowerCase()}_001`,
        title: `測試書籍 1`,
        progress: 45,
        lastUpdated: new Date().toISOString(),
        platform: platform
      }
    ]
  }
  
  /**
   * 處理同步衝突
   */
  async handleSyncConflicts (syncId, conflicts, options) {
    await this.log(`處理 ${conflicts.conflictCount} 個衝突 - 同步作業: ${syncId}`)
    
    // 發送衝突事件給 Conflict Resolution Service
    await this.emitEvent('DATA.CONFLICT.DETECTED', {
      syncId,
      conflicts: conflicts.conflicts,
      recommendations: conflicts.recommendations,
      severity: conflicts.severity,
      timestamp: Date.now()
    })
    
    // 根據衝突嚴重程度決定處理策略
    if (conflicts.severity === 'CRITICAL' || conflicts.severity === 'HIGH') {
      if (options.autoResolve !== true) {
        // 高嚴重程度衝突需要人工介入
        throw new Error(`高嚴重程度衝突需要人工處理: ${conflicts.severity}`)
      }
    }
    
    // 自動解決低嚴重程度衝突
    await this.autoResolveConflicts(syncId, conflicts)
  }
  
  /**
   * 自動解決衝突
   */
  async autoResolveConflicts (syncId, conflicts) {
    let resolvedCount = 0
    
    for (const recommendation of conflicts.recommendations) {
      if (recommendation.autoResolvable) {
        try {
          await this.executeConflictResolution(recommendation)
          resolvedCount++
        } catch (error) {
          await this.log(`自動解決衝突失敗: ${error.message}`, 'error')
        }
      }
    }
    
    await this.log(`自動解決了 ${resolvedCount} 個衝突`)
  }
  
  /**
   * 執行衝突解決
   */
  async executeConflictResolution (recommendation) {
    // 實作各種解決策略
    switch (recommendation.strategy) {
      case 'USE_LATEST_TIMESTAMP':
        // 使用最新時間戳的資料
        break
      case 'USE_SOURCE_PRIORITY':
        // 優先使用源平台資料
        break
      case 'MERGE_VALUES':
        // 合併資料值
        break
      default:
        throw new Error(`不支援的解決策略: ${recommendation.strategy}`)
    }
  }

  /**
   * 執行優雅取消
   */
  async performGracefulCancellation (syncId, job) {
    const result = {
      rollbackInfo: [],
      resourcesCleared: []
    }
    
    try {
      // 1. 停止正在進行的操作
      job.cancelling = true
      
      // 2. 回滾已應用的變更（如需要）
      if (job.partialResults) {
        for (const partialResult of job.partialResults) {
          const rollback = await this.rollbackPartialChanges(partialResult)
          result.rollbackInfo.push(rollback)
        }
      }
      
      // 3. 清理資源
      const resourceTypes = ['memory', 'connections', 'locks', 'tempFiles']
      for (const resourceType of resourceTypes) {
        const cleared = await this.clearResourceType(syncId, resourceType)
        if (cleared) {
          result.resourcesCleared.push(resourceType)
        }
      }
      
      // 4. 更新作業狀態
      job.status = 'CANCELLED'
      job.endTime = Date.now()
      job.cancelled = true
      
      // 5. 移動到已完成作業
      this.completedJobs.set(syncId, job)
      this.activeSyncJobs.delete(syncId)
      
    } catch (error) {
      await this.log(`優雅取消過程中發生錯誤: ${error.message}`, 'error')
    }
    
    return result
  }
  
  /**
   * 回滾部分變更
   */
  async rollbackPartialChanges (partialResult) {
    // 模擬回滾操作
    return {
      platform: partialResult.platform,
      rolledBack: true,
      itemsAffected: 0
    }
  }
  
  /**
   * 清理資源類型
   */
  async clearResourceType (syncId, resourceType) {
    // 模擬資源清理
    await this.log(`清理資源: ${resourceType} - 同步作業: ${syncId}`)
    return true
  }
  
  /**
   * 執行智能重試
   */
  async performIntelligentRetry (failedJob, retryOptions) {
    // 分析失敗原因
    const errorAnalysis = this.analyzeFailureReason(failedJob)
    
    // 選擇重試策略
    const strategy = this.selectRetryStrategy(errorAnalysis, retryOptions)
    
    // 應用退避策略
    const backoffDelay = this.calculateBackoffDelay(failedJob.retryCount || 0)
    
    if (backoffDelay > 0) {
      await this.log(`重試退避等待: ${backoffDelay}ms`)
      await new Promise(resolve => setTimeout(resolve, backoffDelay))
    }
    
    // 建立新的同步作業
    const newSyncId = this.generateSyncJobId()
    
    // 使用改進的參數重新啟動
    const improvedOptions = {
      ...failedJob.options,
      ...retryOptions,
      retryCount: (failedJob.retryCount || 0) + 1,
      retryStrategy: strategy,
      previousError: failedJob.error
    }
    
    const result = await this.initiateCrossPlatformSync(
      newSyncId,
      failedJob.sourcePlatforms,
      failedJob.targetPlatforms,
      improvedOptions
    )
    
    return {
      newSyncId,
      result,
      strategy,
      errorAnalysis
    }
  }
  
  /**
   * 分析失敗原因
   */
  analyzeFailureReason (failedJob) {
    const error = failedJob.error || ''
    
    if (error.includes('network') || error.includes('timeout')) {
      return {
        category: 'NETWORK',
        severity: 'MEDIUM',
        retryable: true,
        recommendedDelay: 5000
      }
    }
    
    if (error.includes('conflict') || error.includes('validation')) {
      return {
        category: 'DATA_CONFLICT',
        severity: 'HIGH',
        retryable: true,
        recommendedDelay: 1000
      }
    }
    
    if (error.includes('permission') || error.includes('auth')) {
      return {
        category: 'AUTHORIZATION',
        severity: 'HIGH',
        retryable: false,
        recommendedDelay: 0
      }
    }
    
    return {
      category: 'UNKNOWN',
      severity: 'MEDIUM',
      retryable: true,
      recommendedDelay: 2000
    }
  }
  
  /**
   * 選擇重試策略
   */
  selectRetryStrategy (errorAnalysis, retryOptions) {
    if (!errorAnalysis.retryable) {
      throw new Error(`錯誤不可重試: ${errorAnalysis.category}`)
    }
    
    switch (errorAnalysis.category) {
      case 'NETWORK':
        return 'EXPONENTIAL_BACKOFF'
      case 'DATA_CONFLICT':
        return 'CONFLICT_RESOLUTION_FIRST'
      default:
        return 'LINEAR_BACKOFF'
    }
  }
  
  /**
   * 計算退避延遲
   */
  calculateBackoffDelay (retryCount) {
    const baseDelay = this.effectiveConfig.retryDelay || 1000
    const maxDelay = this.effectiveConfig.maxRetryDelay || 30000
    
    // 指數退避
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay)
    
    // 加入隨機分散以防止雷群效應
    const jitter = Math.random() * 0.1 * delay
    
    return Math.floor(delay + jitter)
  }

  /**
   * 停止同步服務
   */
  async stop () {
    try {
      await this.log('停止 Data Synchronization Service')

      // 取消所有活躍的同步作業
      for (const [syncId, job] of this.activeSyncJobs.entries()) {
        await this.cancelSync(syncId)
      }

      // 清理資源
      this.activeSyncJobs.clear()
      this.syncJobQueue.length = 0

      this.isRunning = false
      await this.log('Data Synchronization Service 已停止')

    } catch (error) {
      await this.log(`停止 Data Synchronization Service 失敗: ${error.message}`, 'error')
      throw error
    }
  }
}

module.exports = DataSynchronizationService