/**
 * 遷移進度追蹤器
 *
 * 負責追蹤 StandardError 到 ErrorCodes 的遷移進度，
 * 提供狀態管理、進度查詢和報告生成功能。
 *
 * @version 1.0.0
 * @author Claude Code Assistant
 */

const fs = require('fs').promises
const path = require('path')

/**
 * 遷移狀態枚舉
 */
const MIGRATION_STATUS = {
  PENDING: 'pending',        // 待遷移
  IN_PROGRESS: 'in_progress', // 遷移中
  COMPLETED: 'completed',    // 已完成
  FAILED: 'failed',          // 失敗
  VERIFIED: 'verified',      // 已驗證
  ROLLBACK: 'rollback'       // 已回滾
}

/**
 * 遷移項目類型
 */
const MIGRATION_ITEM_TYPE = {
  IMPORT: 'import',          // 匯入語句
  THROW: 'throw',           // 拋出錯誤
  CODE_ACCESS: 'code_access', // 錯誤代碼存取
  TEST: 'test'              // 測試案例
}

/**
 * 遷移進度追蹤器類別
 */
class MigrationProgressTracker {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd()
    this.stateFile = options.stateFile || path.join(this.projectRoot, '.migration-state.json')
    this.progressFile = options.progressFile || path.join(this.projectRoot, 'docs/migration-reports/progress.json')
    this.backupDir = options.backupDir || path.join(this.projectRoot, '.migration-backups')

    // 內存中的狀態
    this.migrationState = {
      metadata: {
        version: '1.0.0',
        startTime: null,
        lastUpdate: null,
        totalItems: 0,
        completedItems: 0
      },
      files: new Map(),      // 檔案級別追蹤
      items: new Map(),      // 項目級別追蹤
      sessions: []           // 遷移會話記錄
    }

    this.initialized = false
  }

  /**
   * 初始化追蹤器
   */
  async initialize() {
    try {
      // 確保目錄存在
      await this._ensureDirectories()

      // 載入現有狀態
      await this._loadState()

      this.initialized = true
      console.log('🎯 MigrationProgressTracker 初始化完成')

    } catch (error) {
      console.error('❌ 追蹤器初始化失敗:', error.message)
      throw error
    }
  }

  /**
   * 開始新的遷移會話
   */
  async startMigrationSession(sessionOptions = {}) {
    if (!this.initialized) {
      await this.initialize()
    }

    const session = {
      id: this._generateSessionId(),
      startTime: new Date().toISOString(),
      mode: sessionOptions.mode || 'SUGGEST_ONLY',
      riskThreshold: sessionOptions.riskThreshold || 'medium',
      targetFiles: sessionOptions.targetFiles || [],
      status: 'ACTIVE',
      progress: {
        analyzed: 0,
        converted: 0,
        verified: 0,
        failed: 0
      }
    }

    this.migrationState.sessions.push(session)
    this.migrationState.metadata.lastUpdate = new Date().toISOString()

    if (!this.migrationState.metadata.startTime) {
      this.migrationState.metadata.startTime = session.startTime
    }

    await this._saveState()

    console.log(`🚀 開始遷移會話: ${session.id}`)
    return session.id
  }

  /**
   * 註冊遷移項目
   */
  async registerMigrationItem(filePath, itemInfo) {
    const itemId = this._generateItemId(filePath, itemInfo)
    const normalizedPath = path.relative(this.projectRoot, filePath)

    const migrationItem = {
      id: itemId,
      filePath: normalizedPath,
      type: itemInfo.type,
      line: itemInfo.line,
      column: itemInfo.column,
      originalCode: itemInfo.originalCode,
      targetCode: itemInfo.targetCode || null,
      riskLevel: itemInfo.riskLevel || 'medium',
      status: MIGRATION_STATUS.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      backupPath: null,
      validationResult: null,
      errorDetails: null
    }

    this.migrationState.items.set(itemId, migrationItem)

    // 更新檔案級別追蹤
    if (!this.migrationState.files.has(normalizedPath)) {
      this.migrationState.files.set(normalizedPath, {
        path: normalizedPath,
        status: MIGRATION_STATUS.PENDING,
        items: [],
        backupPath: null,
        lastProcessed: null
      })
    }

    this.migrationState.files.get(normalizedPath).items.push(itemId)
    this.migrationState.metadata.totalItems++
    this.migrationState.metadata.lastUpdate = new Date().toISOString()

    await this._saveState()

    console.log(`📝 註冊遷移項目: ${itemId}`)
    return itemId
  }

  /**
   * 更新項目狀態
   */
  async updateItemStatus(itemId, status, details = {}) {
    const item = this.migrationState.items.get(itemId)
    if (!item) {
      throw new Error(`遷移項目不存在: ${itemId}`)
    }

    const oldStatus = item.status
    item.status = status
    item.updatedAt = new Date().toISOString()

    // 更新詳細資訊
    if (details.targetCode) item.targetCode = details.targetCode
    if (details.backupPath) item.backupPath = details.backupPath
    if (details.validationResult) item.validationResult = details.validationResult
    if (details.errorDetails) item.errorDetails = details.errorDetails

    // 更新統計
    if (oldStatus === MIGRATION_STATUS.PENDING && status === MIGRATION_STATUS.COMPLETED) {
      this.migrationState.metadata.completedItems++
    } else if (oldStatus === MIGRATION_STATUS.COMPLETED && status !== MIGRATION_STATUS.COMPLETED) {
      this.migrationState.metadata.completedItems--
    }

    // 更新檔案狀態
    this._updateFileStatus(item.filePath)

    this.migrationState.metadata.lastUpdate = new Date().toISOString()
    await this._saveState()

    console.log(`🔄 更新項目狀態: ${itemId} ${oldStatus} → ${status}`)
  }

  /**
   * 批量更新項目狀態
   */
  async batchUpdateItemStatus(updates) {
    for (const { itemId, status, details } of updates) {
      await this.updateItemStatus(itemId, status, details)
    }

    console.log(`📦 批量更新完成: ${updates.length} 個項目`)
  }

  /**
   * 創建備份
   */
  async createBackup(filePath) {
    const normalizedPath = path.relative(this.projectRoot, filePath)
    const absolutePath = path.resolve(this.projectRoot, filePath)

    // 生成備份檔名
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '')
    const backupName = `${normalizedPath.replace(/[/\\]/g, '_')}_${timestamp}.backup`
    const backupPath = path.join(this.backupDir, backupName)

    try {
      // 確保備份目錄存在
      await fs.mkdir(path.dirname(backupPath), { recursive: true })

      // 複製檔案
      const content = await fs.readFile(absolutePath, 'utf8')
      await fs.writeFile(backupPath, content, 'utf8')

      // 更新檔案追蹤
      if (this.migrationState.files.has(normalizedPath)) {
        this.migrationState.files.get(normalizedPath).backupPath = backupPath
      }

      console.log(`💾 建立備份: ${filePath} → ${backupPath}`)
      return backupPath

    } catch (error) {
      console.error(`❌ 備份失敗: ${filePath}`, error.message)
      throw error
    }
  }

  /**
   * 獲取遷移進度
   */
  getProgress() {
    const { totalItems, completedItems } = this.migrationState.metadata
    const percentage = totalItems > 0 ? (completedItems / totalItems * 100).toFixed(2) : 0

    // 統計各狀態項目數量
    const statusCounts = {}
    Object.values(MIGRATION_STATUS).forEach(status => {
      statusCounts[status] = 0
    })

    for (const item of this.migrationState.items.values()) {
      statusCounts[item.status]++
    }

    // 統計各類型項目數量
    const typeCounts = {}
    Object.values(MIGRATION_ITEM_TYPE).forEach(type => {
      typeCounts[type] = 0
    })

    for (const item of this.migrationState.items.values()) {
      typeCounts[item.type]++
    }

    return {
      total: totalItems,
      completed: completedItems,
      percentage: parseFloat(percentage),
      statusDistribution: statusCounts,
      typeDistribution: typeCounts,
      files: {
        total: this.migrationState.files.size,
        processed: Array.from(this.migrationState.files.values())
          .filter(f => f.status !== MIGRATION_STATUS.PENDING).length
      },
      sessions: this.migrationState.sessions.length,
      lastUpdate: this.migrationState.metadata.lastUpdate
    }
  }

  /**
   * 獲取詳細報告
   */
  async generateDetailedReport() {
    const progress = this.getProgress()
    const files = Array.from(this.migrationState.files.values())
    const items = Array.from(this.migrationState.items.values())

    // 風險分析
    const riskAnalysis = {
      low: items.filter(item => item.riskLevel === 'low').length,
      medium: items.filter(item => item.riskLevel === 'medium').length,
      high: items.filter(item => item.riskLevel === 'high').length,
      critical: items.filter(item => item.riskLevel === 'critical').length
    }

    // 失敗項目分析
    const failedItems = items.filter(item => item.status === MIGRATION_STATUS.FAILED)
    const failureAnalysis = {
      count: failedItems.length,
      patterns: this._analyzeFailurePatterns(failedItems)
    }

    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: this.migrationState.metadata.version,
        startTime: this.migrationState.metadata.startTime
      },
      progress,
      riskAnalysis,
      failureAnalysis,
      files: files.map(file => ({
        path: file.path,
        status: file.status,
        itemCount: file.items.length,
        lastProcessed: file.lastProcessed
      })),
      sessions: this.migrationState.sessions,
      recommendations: this._generateRecommendations(progress, riskAnalysis, failureAnalysis)
    }

    // 保存報告
    await this._saveReport(report)

    return report
  }

  /**
   * 清理狀態
   */
  async cleanup() {
    try {
      // 保存最終狀態
      await this._saveState()

      // 歸檔舊的報告
      await this._archiveOldReports()

      console.log('🧹 追蹤器清理完成')

    } catch (error) {
      console.error('❌ 清理失敗:', error.message)
      throw error
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 確保必要目錄存在
   */
  async _ensureDirectories() {
    const dirs = [
      path.dirname(this.progressFile),
      this.backupDir
    ]

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true })
    }
  }

  /**
   * 載入狀態
   */
  async _loadState() {
    try {
      if (await this._fileExists(this.stateFile)) {
        const data = await fs.readFile(this.stateFile, 'utf8')
        const state = JSON.parse(data)

        // 恢復 Map 結構
        this.migrationState.files = new Map(state.files || [])
        this.migrationState.items = new Map(state.items || [])
        this.migrationState.metadata = { ...this.migrationState.metadata, ...state.metadata }
        this.migrationState.sessions = state.sessions || []

        console.log('📂 載入現有遷移狀態')
      }
    } catch (error) {
      console.warn('⚠️ 無法載入現有狀態，使用新狀態:', error.message)
    }
  }

  /**
   * 保存狀態
   */
  async _saveState() {
    try {
      const stateData = {
        metadata: this.migrationState.metadata,
        files: Array.from(this.migrationState.files.entries()),
        items: Array.from(this.migrationState.items.entries()),
        sessions: this.migrationState.sessions
      }

      await fs.writeFile(this.stateFile, JSON.stringify(stateData, null, 2), 'utf8')

    } catch (error) {
      console.error('❌ 狀態保存失敗:', error.message)
      throw error
    }
  }

  /**
   * 保存報告
   */
  async _saveReport(report) {
    try {
      await fs.writeFile(this.progressFile, JSON.stringify(report, null, 2), 'utf8')
      console.log(`📊 進度報告已保存: ${this.progressFile}`)

    } catch (error) {
      console.error('❌ 報告保存失敗:', error.message)
      throw error
    }
  }

  /**
   * 生成會話 ID
   */
  _generateSessionId() {
    return `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 生成項目 ID
   */
  _generateItemId(filePath, itemInfo) {
    const normalizedPath = path.relative(this.projectRoot, filePath)
    return `${normalizedPath}:${itemInfo.line}:${itemInfo.column}:${itemInfo.type}`
  }

  /**
   * 更新檔案狀態
   */
  _updateFileStatus(filePath) {
    const fileState = this.migrationState.files.get(filePath)
    if (!fileState) return

    const itemStates = fileState.items.map(itemId =>
      this.migrationState.items.get(itemId)?.status
    ).filter(Boolean)

    if (itemStates.length === 0) {
      fileState.status = MIGRATION_STATUS.PENDING
    } else if (itemStates.every(status => status === MIGRATION_STATUS.COMPLETED)) {
      fileState.status = MIGRATION_STATUS.COMPLETED
    } else if (itemStates.some(status => status === MIGRATION_STATUS.FAILED)) {
      fileState.status = MIGRATION_STATUS.FAILED
    } else if (itemStates.some(status => status === MIGRATION_STATUS.IN_PROGRESS)) {
      fileState.status = MIGRATION_STATUS.IN_PROGRESS
    } else {
      fileState.status = MIGRATION_STATUS.PENDING
    }

    fileState.lastProcessed = new Date().toISOString()
  }

  /**
   * 分析失敗模式
   */
  _analyzeFailurePatterns(failedItems) {
    const patterns = {}

    failedItems.forEach(item => {
      if (item.errorDetails && item.errorDetails.type) {
        const errorType = item.errorDetails.type
        if (!patterns[errorType]) {
          patterns[errorType] = { count: 0, items: [] }
        }
        patterns[errorType].count++
        patterns[errorType].items.push(item.id)
      }
    })

    return patterns
  }

  /**
   * 生成建議
   */
  _generateRecommendations(progress, riskAnalysis, failureAnalysis) {
    const recommendations = []

    if (progress.percentage < 30) {
      recommendations.push({
        type: 'progress',
        priority: 'medium',
        message: '建議優先處理低風險項目以快速提升進度'
      })
    }

    if (riskAnalysis.critical > 0) {
      recommendations.push({
        type: 'risk',
        priority: 'high',
        message: `發現 ${riskAnalysis.critical} 個高風險項目，建議手動審核`
      })
    }

    if (failureAnalysis.count > progress.total * 0.1) {
      recommendations.push({
        type: 'failure',
        priority: 'high',
        message: '失敗率過高，建議檢查轉換邏輯或降低風險閾值'
      })
    }

    return recommendations
  }

  /**
   * 歸檔舊報告
   */
  async _archiveOldReports() {
    // 實作報告歸檔邏輯
    // 這裡可以將舊的報告移動到歸檔目錄
  }

  /**
   * 檢查檔案是否存在
   */
  async _fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
}

module.exports = {
  MigrationProgressTracker,
  MIGRATION_STATUS,
  MIGRATION_ITEM_TYPE
}