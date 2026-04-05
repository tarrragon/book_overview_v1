/**
 * @fileoverview Readmoo Data Consistency Service - Readmoo 資料一致性服務
 * @version v0.9.20
 * @since 2025-08-20
 *
 * 重構自 data-synchronization-service.js，專注於 Readmoo 平台的資料一致性檢查
 *
 * 負責功能：
 * - Readmoo 本地資料與瀏覽器狀態的一致性檢查
 * - 資料差異檢測和修復建議
 * - 資料品質監控和報告
 * - 一致性狀態追蹤和事件通知
 *
 * 設計原則：
 * - 單一職責：專注於 Readmoo 資料一致性
 * - 事件驅動：與現有事件系統整合
 * - 測試友好：依賴注入，易於模組測試
 * - 向後相容：保持與原始 API 的相容性
 */

const BaseModule = require('src/background/lifecycle/base-module')
const DataDifferenceEngine = require('./data-difference-engine.js')
const ConflictDetectionService = require('./ConflictDetectionService.js')
const SyncProgressMonitor = require('./sync-progress-tracker.js')
const SyncStrategyProcessor = require('./sync-strategy-processor.js')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

class ReadmooDataConsistencyService extends BaseModule {
  /**
   * 初始化 Readmoo 資料一致性服務
   * @param {EventBus} eventBus - 事件總線實例
   * @param {Object} dependencies - 依賴注入物件
   */
  constructor (eventBus, dependencies = {}) {
    if (!eventBus) {
      const error = new Error('EventBus is required')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'ui' }
      throw error
    }

    super({
      eventBus,
      logger: dependencies.logger || console,
      config: dependencies.config || {}
    })

    this.eventBus = eventBus

    // Logger 後備方案: Background Service 初始化保護
    // 設計理念: Readmoo 資料一致性服務作為資料品質監控中心，負責記錄一致性檢查和修復過程
    // 執行環境: Service Worker 初始化階段，依賴注入可能不完整
    // 後備機制: console 確保資料一致性事件和品質問題能被追蹤
    // 風險考量: 理想上應確保 Logger 完整可用，此為過渡性保護
    this.logger = dependencies.logger || console
    this.config = dependencies.config || {}

    // 初始化專門服務
    this.dataDifferenceEngine = dependencies.dataDifferenceEngine ||
      new DataDifferenceEngine(eventBus, { logger: this.logger })
    this.conflictDetectionService = dependencies.conflictDetectionService ||
      new ConflictDetectionService(eventBus, {
        logger: this.logger,
        dataDifferenceEngine: this.dataDifferenceEngine
      })
    this.syncProgressMonitor = dependencies.syncProgressMonitor ||
      new SyncProgressMonitor(eventBus, { logger: this.logger })
    this.syncStrategyProcessor = dependencies.syncStrategyProcessor ||
      new SyncStrategyProcessor(eventBus, { logger: this.logger })

    // 一致性檢查狀態
    this.consistencyJobs = new Map()
    this.checkHistory = []

    // 配置管理
    this.defaultConfig = {
      checkInterval: 300000, // 5 分鐘
      maxHistoryEntries: 100,
      autoFix: false, // v0.9 階段保守設置
      enableReporting: true,
      compareFields: ['title', 'progress', 'lastUpdated']
    }

    this.effectiveConfig = { ...this.defaultConfig, ...this.config }

    // 服務狀態
    this.isInitialized = false
    this.isRunning = false
  }

  /**
   * 初始化一致性服務
   */
  async initialize () {
    try {
      this.logger.log('開始初始化 Readmoo Data Consistency Service')

      // 註冊事件監聽器
      await this.registerEventListeners()

      this.isInitialized = true
      this.logger.log('Readmoo Data Consistency Service 初始化完成')

      // 發送初始化完成事件
      this.eventBus.emit('DATA.CONSISTENCY.SERVICE.INITIALIZED', {
        platform: 'READMOO',
        config: this.effectiveConfig,
        timestamp: Date.now()
      })
    } catch (error) {
      this.logger.error(`Readmoo Data Consistency Service 初始化失敗: ${error.message}`)
      throw error
    }
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners () {
    // 監聽資料更新事件
    this.eventBus.on('DATA.UPDATE', this.handleDataUpdate.bind(this))

    // 監聽一致性檢查請求
    this.eventBus.on('DATA.CONSISTENCY.CHECK_REQUEST', this.handleConsistencyCheckRequest.bind(this))

    this.logger.log('事件監聽器註冊完成')
  }

  /**
   * 處理資料更新事件
   * @param {Object} event - 事件資料
   */
  async handleDataUpdate (event) {
    try {
      if (event.platform === 'READMOO' || !event.platform) {
        await this.scheduleConsistencyCheck({
          source: 'data_update',
          trigger: event
        })
      }
    } catch (error) {
      this.logger.error(`處理資料更新事件失敗: ${error.message}`)
    }
  }

  /**
   * 處理一致性檢查請求
   * @param {Object} event - 事件資料
   */
  async handleConsistencyCheckRequest (event) {
    try {
      const checkId = event.checkId || this.generateCheckId()
      await this.performConsistencyCheck(checkId, event.options || {})
    } catch (error) {
      this.logger.error(`處理一致性檢查請求失敗: ${error.message}`)
    }
  }

  /**
   * 排程一致性檢查
   * @param {Object} options - 檢查選項
   * @param {string} checkId - 可選的檢查 ID，若不提供則自動產生
   */
  async scheduleConsistencyCheck (options = {}, checkId = null) {
    if (!checkId) {
      checkId = this.generateCheckId()
    }

    // 防止重複檢查
    if (this.consistencyJobs.has(checkId)) {
      return checkId
    }

    const job = {
      id: checkId,
      status: 'scheduled',
      options,
      createdAt: Date.now()
    }

    this.consistencyJobs.set(checkId, job)

    // 非同步執行檢查
    setTimeout(() => this.performConsistencyCheck(checkId, options), 0)

    return checkId
  }

  /**
   * 執行一致性檢查 (保持與原始 API 相容)
   * @param {string} checkId - 檢查 ID
   * @param {Object} options - 檢查選項
   */
  async performConsistencyCheck (checkId, options = {}) {
    try {
      const job = this.consistencyJobs.get(checkId) || {
        id: checkId,
        status: 'running',
        options,
        createdAt: Date.now()
      }

      job.status = 'running'
      job.startedAt = Date.now()
      this.consistencyJobs.set(checkId, job)

      this.logger.log(`開始執行一致性檢查: ${checkId}`)

      // 使用專門服務執行一致性檢查
      const result = await this.executeConsistencyCheckWithServices(checkId, options)

      // 更新作業狀態
      job.status = 'completed'
      job.completedAt = Date.now()
      job.result = result

      // 記錄歷史
      this.addToHistory(result)

      // 發送完成事件
      this.eventBus.emit('DATA.CONSISTENCY.CHECK_COMPLETED', result)

      this.logger.log(`一致性檢查完成: ${checkId}`)
      return result
    } catch (error) {
      this.logger.error(`一致性檢查失敗: ${error.message}`)

      // 更新作業狀態為失敗
      const job = this.consistencyJobs.get(checkId)
      if (job) {
        job.status = 'failed'
        job.error = error.message
        job.completedAt = Date.now()
      }

      throw error
    }
  }

  /**
   * 向後相容性方法：initiateCrossPlatformSync
   * 轉換為 Readmoo 一致性檢查
   */
  async initiateCrossPlatformSync (syncId, sourcePlatforms, targetPlatforms, options = {}) {
    this.logger.log('將跨平台同步請求轉換為 Readmoo 一致性檢查')

    return await this.performConsistencyCheck(syncId, {
      ...options,
      compatibilityMode: true,
      originalMethod: 'initiateCrossPlatformSync'
    })
  }

  /**
   * 產生檢查 ID
   */
  generateCheckId () {
    return `readmoo_check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 添加到歷史記錄
   * @param {Object} result - 檢查結果
   */
  addToHistory (result) {
    this.checkHistory.push(result)

    // 保持歷史記錄數量限制
    if (this.checkHistory.length > this.effectiveConfig.maxHistoryEntries) {
      this.checkHistory.shift()
    }
  }

  /**
   * 獲取服務統計資訊
   */
  getServiceStatistics () {
    const completedJobs = Array.from(this.consistencyJobs.values()).filter(job => job.status === 'completed')
    const failedJobs = Array.from(this.consistencyJobs.values()).filter(job => job.status === 'failed')

    return {
      totalChecks: this.checkHistory.length,
      activeJobs: Array.from(this.consistencyJobs.values()).filter(job => job.status === 'running').length,
      completedJobs: completedJobs.length,
      failedJobs: failedJobs.length,
      lastCheck: this.checkHistory.length > 0 ? this.checkHistory[this.checkHistory.length - 1] : null,
      serviceStatus: this.isInitialized ? 'initialized' : 'not_initialized'
    }
  }

  /**
   * 清理資源
   */
  async cleanup () {
    try {
      // 清理進行中的作業
      for (const [, job] of this.consistencyJobs.entries()) {
        if (job.status === 'running') {
          job.status = 'cancelled'
          job.completedAt = Date.now()
        }
      }

      // 清理記憶體
      this.consistencyJobs.clear()
      this.checkHistory = []

      this.isInitialized = false
      this.isRunning = false

      this.logger.log('Readmoo Data Consistency Service 資源清理完成')
    } catch (error) {
      this.logger.error(`清理資源失敗: ${error.message}`)
    }
  }

  /**
   * 使用專門服務執行一致性檢查
   */
  async executeConsistencyCheckWithServices (checkId, options) {
    try {
      // 模擬獲取本地和遠端資料
      const localData = await this.fetchLocalReadmooData()
      const remoteData = await this.fetchRemoteReadmooData()

      // 使用差異引擎計算差異
      const differences = await this.dataDifferenceEngine.calculateDifferences(localData, remoteData)

      // 使用衝突檢測服務檢測衝突
      const conflicts = await this.conflictDetectionService.detectConflicts(localData, remoteData)

      // 生成一致性檢查結果
      return {
        checkId,
        platform: 'READMOO',
        status: 'completed',
        inconsistencies: this.formatInconsistencies(differences),
        conflicts: conflicts.conflicts || [],
        recommendations: conflicts.recommendations || [],
        statistics: {
          totalItems: localData.length,
          differences: differences.summary?.totalChanges || 0,
          conflicts: conflicts.conflictCount || 0
        },
        timestamp: Date.now()
      }
    } catch (error) {
      this.logger.error(`執行一致性檢查失敗: ${error.message}`)
      throw error
    }
  }

  /**
   * 獲取本地 Readmoo 資料（模擬）
   */
  async fetchLocalReadmooData () {
    // 模擬本地資料
    return [
      { id: 'local_1', title: '本地書籍 1', progress: 45, lastUpdated: '2025-01-01' },
      { id: 'local_2', title: '本地書籍 2', progress: 80, lastUpdated: '2025-01-02' }
    ]
  }

  /**
   * 獲取遠端 Readmoo 資料（模擬）
   */
  async fetchRemoteReadmooData () {
    // 模擬遠端資料
    return [
      { id: 'local_1', title: '遠端書籍 1', progress: 50, lastUpdated: '2025-01-03' },
      { id: 'local_2', title: '本地書籍 2', progress: 80, lastUpdated: '2025-01-02' }
    ]
  }

  // =========================================================================
  // UC-07 7a: 資料不一致偵測與恢復方法
  // =========================================================================

  /**
   * UC-07 7a1: 偵測書籍資料不一致
   * 檢查必要欄位缺失、狀態與日期邏輯不一致等問題
   * @param {Array} books - 書籍資料陣列
   * @returns {Object} { inconsistencies: Array, severity: string|null }
   */
  async detectDataInconsistencies (books) {
    const inconsistencies = []

    for (const book of books) {
      // 檢查必要欄位缺失
      if (!book.id || book.id === '') {
        inconsistencies.push({
          type: 'MISSING_REQUIRED_FIELD',
          bookId: book.id || 'unknown',
          field: 'id',
          description: '書籍缺少必要欄位 id',
          severity: 'SEVERE'
        })
      }

      if (!book.title || book.title === '') {
        inconsistencies.push({
          type: 'MISSING_REQUIRED_FIELD',
          bookId: book.id || 'unknown',
          field: 'title',
          description: '書籍缺少必要欄位 title',
          severity: 'SEVERE'
        })
      }

      // 檢查狀態與日期邏輯一致性
      if (book.status === 'COMPLETED' && !book.completedDate) {
        inconsistencies.push({
          type: 'STATUS_DATE_MISMATCH',
          bookId: book.id,
          field: 'completedDate',
          description: 'COMPLETED 狀態但缺少完成日期',
          severity: 'MEDIUM'
        })
      }

      if (book.status === 'READING' && book.completedDate) {
        inconsistencies.push({
          type: 'STATUS_DATE_MISMATCH',
          bookId: book.id,
          field: 'completedDate',
          description: 'READING 狀態但有完成日期',
          severity: 'MEDIUM'
        })
      }

      if (book.startDate && book.completedDate && book.completedDate < book.startDate) {
        inconsistencies.push({
          type: 'DATE_ORDER_INVALID',
          bookId: book.id,
          field: 'completedDate',
          description: '完成日期早於開始日期',
          severity: 'MEDIUM'
        })
      }

      // 檢查無效狀態值
      const validStatuses = ['READING', 'COMPLETED', 'WANT_TO_READ', 'DROPPED']
      if (book.status && !validStatuses.includes(book.status)) {
        inconsistencies.push({
          type: 'INVALID_STATUS',
          bookId: book.id || 'unknown',
          field: 'status',
          description: `無效的狀態值: ${book.status}`,
          severity: 'SEVERE'
        })
      }
    }

    // 計算最高嚴重程度
    const severity = inconsistencies.length > 0
      ? (inconsistencies.some(i => i.severity === 'SEVERE') ? 'SEVERE' : 'MEDIUM')
      : null

    // 發送 DATA.ERROR 事件（嚴重程度 SEVERE 時）
    if (severity === 'SEVERE') {
      this.eventBus.emit('DATA.ERROR', {
        severity: 'SEVERE',
        type: 'DATA_INCONSISTENCY',
        inconsistencies,
        timestamp: Date.now()
      })
    }

    return { inconsistencies, severity }
  }

  /**
   * UC-07 7a2: 邏輯一致性檢查
   * 驗證進度值、評分等數值欄位在合理範圍內
   * @param {Array} books - 書籍資料陣列
   * @returns {Object} { issues: Array }
   */
  async checkLogicalConsistency (books) {
    const issues = []

    for (const book of books) {
      // 進度值範圍檢查 (0-100)
      if (book.progress !== undefined && book.progress !== null) {
        if (book.progress < 0 || book.progress > 100) {
          issues.push({
            type: 'INVALID_PROGRESS_VALUE',
            bookId: book.id,
            field: 'progress',
            currentValue: book.progress,
            validRange: { min: 0, max: 100 },
            severity: 'MEDIUM'
          })
        }
      }

      // 評分範圍檢查 (0-5)
      if (book.rating !== undefined && book.rating !== null) {
        if (book.rating < 0 || book.rating > 5) {
          issues.push({
            type: 'INVALID_RATING_VALUE',
            bookId: book.id,
            field: 'rating',
            currentValue: book.rating,
            validRange: { min: 0, max: 5 },
            severity: 'MEDIUM'
          })
        }
      }
    }

    return { issues }
  }

  /**
   * UC-07 7a2: 外鍵約束檢查
   * 偵測引用不存在的分類或書架
   * @param {Array} books - 書籍資料陣列
   * @param {Object} references - 參考資料 { categories, shelves }
   * @returns {Object} { violations: Array }
   */
  async checkForeignKeyConstraints (books, references = {}) {
    const violations = []
    const { categories = [], shelves = [] } = references

    const categoryIds = new Set(categories.map(c => c.id))
    const shelfIds = new Set(shelves.map(s => s.id))

    for (const book of books) {
      if (book.categoryId && !categoryIds.has(book.categoryId)) {
        violations.push({
          type: 'FOREIGN_KEY_VIOLATION',
          bookId: book.id,
          field: 'categoryId',
          referencedId: book.categoryId,
          severity: 'HIGH'
        })
      }

      if (book.shelfId && !shelfIds.has(book.shelfId)) {
        violations.push({
          type: 'FOREIGN_KEY_VIOLATION',
          bookId: book.id,
          field: 'shelfId',
          referencedId: book.shelfId,
          severity: 'HIGH'
        })
      }
    }

    return { violations }
  }

  /**
   * UC-07 7a2: 孤立記錄偵測
   * 識別沒有對應書籍的閱讀記錄或標籤關聯
   * @param {Array} books - 書籍資料陣列
   * @param {Array} records - 閱讀記錄或標籤關聯陣列
   * @returns {Object} { orphans: Array }
   */
  async detectOrphanRecords (books, records) {
    const orphans = []
    const bookIds = new Set(books.map(b => b.id))

    for (const record of records) {
      // 閱讀記錄（有 bookId 和 progress）
      if (record.bookId && record.progress !== undefined) {
        if (!bookIds.has(record.bookId)) {
          orphans.push({
            type: 'ORPHAN_READING_RECORD',
            recordId: record.id,
            referencedBookId: record.bookId,
            severity: 'MEDIUM'
          })
        }
      // 標籤關聯（有 bookId 和 tagId，但無 progress）
      } else if (record.bookId && record.tagId) {
        if (!bookIds.has(record.bookId)) {
          orphans.push({
            type: 'ORPHAN_TAG_ASSOCIATION',
            recordId: record.id || `${record.bookId}-${record.tagId}`,
            referencedBookId: record.bookId,
            severity: 'MEDIUM'
          })
        }
      }
    }

    return { orphans }
  }

  /**
   * UC-07 7a3: 自動修復不一致問題
   * 修復可自動處理的問題，標記需人工介入的問題
   * @param {Array} inconsistencies - 不一致問題清單
   * @returns {Object} { repaired, unresolved, summary }
   */
  async autoRepairInconsistencies (inconsistencies) {
    const repaired = []
    const unresolved = []

    for (const issue of inconsistencies) {
      switch (issue.type) {
        case 'INVALID_PROGRESS_VALUE': {
          // 進度值越界可自動修復：裁剪到 0-100 範圍
          const repairedValue = issue.currentValue > 100 ? 100 : 0
          repaired.push({
            bookId: issue.bookId,
            field: issue.field,
            originalValue: issue.currentValue,
            repairedValue,
            repairStrategy: 'CLAMP_TO_RANGE'
          })
          break
        }

        case 'STATUS_DATE_MISMATCH': {
          // READING 狀態有完成日期 -> 清除完成日期
          if (issue.currentStatus === 'READING') {
            repaired.push({
              bookId: issue.bookId,
              field: issue.field,
              originalValue: issue.currentDate,
              repairedValue: null,
              repairStrategy: 'CLEAR_INVALID_DATE'
            })
          } else {
            // 其他情況需人工介入
            unresolved.push({
              ...issue,
              reason: '無法自動判斷正確的日期值',
              requiresUserIntervention: true
            })
          }
          break
        }

        case 'FOREIGN_KEY_VIOLATION':
        case 'ORPHAN_READING_RECORD':
        case 'ORPHAN_TAG_ASSOCIATION': {
          // 外鍵違規和孤立記錄需人工介入
          unresolved.push({
            ...issue,
            reason: '需要使用者確認是否刪除或重新關聯',
            requiresUserIntervention: true
          })
          break
        }

        default: {
          unresolved.push({
            ...issue,
            reason: '未知的問題類型，無法自動修復',
            requiresUserIntervention: true
          })
        }
      }
    }

    return {
      repaired,
      unresolved,
      summary: {
        totalIssues: inconsistencies.length,
        autoRepaired: repaired.length,
        requiresIntervention: unresolved.length
      }
    }
  }

  /**
   * UC-07 7a4: 產生不一致報告供使用者介入
   * @param {Array} unresolvedIssues - 未解決的問題清單
   * @returns {Object} { issues, recommendations, timestamp }
   */
  async generateInconsistencyReport (unresolvedIssues) {
    const issues = unresolvedIssues.map(issue => ({
      ...issue,
      suggestedAction: this._getSuggestedAction(issue.type)
    }))

    const recommendations = this._generateRecommendations(unresolvedIssues)

    return {
      issues,
      recommendations,
      timestamp: Date.now()
    }
  }

  /**
   * 根據問題類型取得建議操作
   * @param {string} issueType - 問題類型
   * @returns {string} 建議操作描述
   */
  _getSuggestedAction (issueType) {
    const actionMap = {
      FOREIGN_KEY_VIOLATION: '移除無效的引用或重新建立正確的關聯',
      ORPHAN_READING_RECORD: '刪除孤立的閱讀記錄或重新關聯到現有書籍',
      ORPHAN_TAG_ASSOCIATION: '刪除孤立的標籤關聯或重新關聯到現有書籍',
      STATUS_DATE_MISMATCH: '檢查並修正狀態和日期的一致性',
      MISSING_REQUIRED_FIELD: '補充缺失的必要欄位資料',
      INVALID_STATUS: '修正為有效的狀態值'
    }
    return actionMap[issueType] || '請手動檢查並修正此問題'
  }

  /**
   * 產生修復建議清單
   * @param {Array} issues - 問題清單
   * @returns {Array} 建議清單
   */
  _generateRecommendations (issues) {
    const recommendations = []
    const typeCount = {}

    for (const issue of issues) {
      typeCount[issue.type] = (typeCount[issue.type] || 0) + 1
    }

    for (const [type, count] of Object.entries(typeCount)) {
      recommendations.push({
        type,
        count,
        action: this._getSuggestedAction(type),
        priority: count > 5 ? 'HIGH' : 'MEDIUM'
      })
    }

    return recommendations
  }

  /**
   * UC-07 7a5: 寫入前資料驗證（預防機制）
   * 阻止不一致資料寫入儲存
   * @param {Object} book - 要寫入的書籍資料
   * @param {Object} options - 驗證選項 { referenceData }
   * @returns {Object} { isValid, errors }
   */
  async validateBeforeWrite (book, options = {}) {
    const errors = []

    // 必要欄位檢查
    if (!book.title || book.title === '') {
      errors.push({
        type: 'MISSING_REQUIRED_FIELD',
        field: 'title',
        message: '書籍標題為必填欄位'
      })
    }

    // 狀態與日期一致性
    if (book.status === 'COMPLETED' && !book.completedDate) {
      errors.push({
        type: 'STATUS_DATE_MISMATCH',
        field: 'completedDate',
        message: 'COMPLETED 狀態必須有完成日期'
      })
    }

    // 進度值範圍檢查
    if (book.progress !== undefined && book.progress !== null) {
      if (book.progress < 0 || book.progress > 100) {
        errors.push({
          type: 'INVALID_PROGRESS_VALUE',
          field: 'progress',
          message: `進度值必須在 0-100 範圍內，目前值: ${book.progress}`
        })
      }
    }

    // 外鍵引用檢查
    if (options.referenceData) {
      const { categories = [], shelves = [] } = options.referenceData
      const categoryIds = new Set(categories.map(c => c.id))
      const shelfIds = new Set(shelves.map(s => s.id))

      if (book.categoryId && !categoryIds.has(book.categoryId)) {
        errors.push({
          type: 'FOREIGN_KEY_VIOLATION',
          field: 'categoryId',
          message: `引用的分類 ${book.categoryId} 不存在`
        })
      }

      if (book.shelfId && !shelfIds.has(book.shelfId)) {
        errors.push({
          type: 'FOREIGN_KEY_VIOLATION',
          field: 'shelfId',
          message: `引用的書架 ${book.shelfId} 不存在`
        })
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * UC-07 7a 整合流程：完整不一致偵測與恢復
   * 執行偵測 -> 檢查 -> 修復 -> 報告的完整流程
   * @param {Array} books - 書籍資料陣列
   * @param {Object} referenceData - 參考資料
   * @returns {Object} { detection, repair, report, timestamp }
   */
  async performIntegrityCheck (books, referenceData = {}) {
    // 階段 1: 偵測不一致
    const inconsistencyResult = await this.detectDataInconsistencies(books)
    const logicalResult = await this.checkLogicalConsistency(books)
    const fkResult = await this.checkForeignKeyConstraints(books, referenceData)

    // 偵測孤立記錄
    const orphanResults = []
    if (referenceData.readingRecords) {
      const orphanResult = await this.detectOrphanRecords(books, referenceData.readingRecords)
      orphanResults.push(...orphanResult.orphans)
    }

    // 彙總所有問題
    const allIssues = [
      ...inconsistencyResult.inconsistencies,
      ...logicalResult.issues,
      ...fkResult.violations.map(v => ({ ...v, severity: 'HIGH' })),
      ...orphanResults.map(o => ({ ...o, severity: 'MEDIUM' }))
    ]

    const detection = {
      totalIssues: allIssues.length,
      inconsistencies: inconsistencyResult.inconsistencies,
      logicalIssues: logicalResult.issues,
      foreignKeyViolations: fkResult.violations,
      orphanRecords: orphanResults
    }

    // 階段 2: 自動修復
    const repair = await this.autoRepairInconsistencies(allIssues)

    // 階段 3: 產生報告
    const report = await this.generateInconsistencyReport(repair.unresolved)

    return {
      detection,
      repair,
      report,
      timestamp: Date.now()
    }
  }

  /**
   * 格式化不一致資料
   */
  formatInconsistencies (differences) {
    const inconsistencies = []

    if (differences.modified) {
      for (const modified of differences.modified) {
        inconsistencies.push({
          type: 'DATA_MISMATCH',
          itemId: modified.id,
          fields: Object.keys(modified.changes || {}),
          severity: 'MEDIUM'
        })
      }
    }

    return inconsistencies
  }
}

module.exports = ReadmooDataConsistencyService
