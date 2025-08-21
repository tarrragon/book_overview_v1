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

const BaseModule = require('../../../lifecycle/base-module.js')

class ReadmooDataConsistencyService extends BaseModule {
  /**
   * 初始化 Readmoo 資料一致性服務
   * @param {EventBus} eventBus - 事件總線實例
   * @param {Object} dependencies - 依賴注入物件
   */
  constructor (eventBus, dependencies = {}) {
    if (!eventBus) {
      throw new Error('EventBus is required')
    }

    super({
      eventBus,
      logger: dependencies.logger || console,
      config: dependencies.config || {}
    })

    this.eventBus = eventBus
    this.logger = dependencies.logger || console
    this.config = dependencies.config || {}

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

      // 模擬檢查過程 (實際實作會在後續 TDD 循環中完成)
      const result = {
        checkId,
        platform: 'READMOO',
        status: 'completed',
        inconsistencies: [],
        recommendations: [],
        timestamp: Date.now()
      }

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
      for (const [checkId, job] of this.consistencyJobs.entries()) {
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
}

module.exports = ReadmooDataConsistencyService
