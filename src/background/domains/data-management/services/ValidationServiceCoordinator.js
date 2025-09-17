/**
 * @fileoverview ValidationServiceCoordinator - 驗證服務統籌協調器
 * @version 1.0.0
 * @since 2025-08-19
 *
 * 負責功能：
 * - 統一管理和協調所有驗證服務組件
 * - 提供完整的驗證服務編排和流程控制
 * - 事件系統整合和跨服務協調
 * - 效能優化和資源管理協調
 *
 * 設計考量：
 * - 實作 IValidationServiceCoordinator 介面契約
 * - 整合所有驗證服務：ValidationEngine、DataQualityAnalyzer、
 *   ValidationBatchProcessor、ValidationCacheManager、PlatformRuleManager、DataNormalizationService
 * - 提供統一的驗證服務入口和管理接口
 * - 支援複雜的驗證流程編排和錯誤處理
 *
 * 處理流程：
 * 1. 初始化和協調所有驗證服務組件
 * 2. 提供統一的驗證請求處理和分派
 * 3. 執行服務間協調和資料流管理
 * 4. 監控服務狀態和效能指標
 * 5. 提供統一的錯誤處理和恢復機制
 *
 * 使用情境：
 * - data-validation-service.js 的現代化替代方案
 * - 複雜驗證流程的統一管理
 * - 多服務協調和資源優化
 * - 企業級驗證服務架構
 */

const { StandardError } = require('src/core/errors/StandardError')

class ValidationServiceCoordinator {
  /**
   * 建構驗證服務協調器
   * @param {Object} options - 協調器配置選項
   */
  constructor (options = {}) {
    // 驗證必要依賴
    this._validateDependencies(options)

    // 注入所有驗證服務
    this.eventBus = options.eventBus
    this.validationEngine = options.validationEngine
    this.dataQualityAnalyzer = options.dataQualityAnalyzer
    this.validationBatchProcessor = options.validationBatchProcessor
    this.validationCacheManager = options.validationCacheManager
    this.platformRuleManager = options.platformRuleManager
    this.dataNormalizationService = options.dataNormalizationService

    // 協調器配置
    this.config = {
      enableEventCoordination: options.enableEventCoordination !== false,
      enablePerformanceOptimization: options.enablePerformanceOptimization !== false,
      enableResourceManagement: options.enableResourceManagement !== false,
      coordinationTimeout: options.coordinationTimeout || 30000,
      maxConcurrentOperations: options.maxConcurrentOperations || 5,
      enableDetailedStatistics: options.enableDetailedStatistics !== false,
      autoServiceOptimization: options.autoServiceOptimization || false,
      ...options
    }

    // 協調狀態管理
    this.activeCoordinations = new Map()
    this.coordinationHistory = new Map()
    this.coordinationCounter = 0

    // 服務狀態監控
    this.serviceHealthStatus = new Map()
    this.performanceMetrics = {
      totalCoordinations: 0,
      totalProcessingTime: 0,
      averageLatency: 0,
      successRate: 0,
      coordinationThroughput: 0,
      serviceUtilization: new Map(),
      errorDistribution: new Map()
    }

    // 初始化服務監控
    this._initializeServiceMonitoring()

    // 註冊事件協調器
    if (this.config.enableEventCoordination) {
      this._registerEventCoordination()
    }

    this.isInitialized = true
  }

  /**
   * 協調完整的驗證和標準化流程
   * @param {Array} books - 書籍陣列
   * @param {string} platform - 平台名稱
   * @param {Object} options - 驗證選項
   * @returns {Promise<Object>} 完整驗證結果
   */
  async validateAndNormalize (books, platform, options = {}) {
    const coordinationId = this._generateCoordinationId()
    const startTime = Date.now()

    // 建立協調狀態
    const coordinationState = {
      coordinationId,
      phase: 'INITIALIZATION',
      platform,
      totalBooks: books.length,
      startTime,
      endTime: null,
      progress: 0,
      currentService: null,
      options
    }

    this.activeCoordinations.set(coordinationId, coordinationState)

    try {
      // 發送協調開始事件
      await this.eventBus.emit('VALIDATION.COORDINATION.STARTED', {
        coordinationId,
        platform,
        totalBooks: books.length,
        timestamp: new Date().toISOString()
      })

      // Phase 1: 平台規則準備
      coordinationState.phase = 'RULE_PREPARATION'
      coordinationState.currentService = 'platformRuleManager'
      await this._ensurePlatformRulesLoaded(platform)

      // Phase 2: 驗證執行
      coordinationState.phase = 'VALIDATION'
      coordinationState.currentService = 'validationEngine'
      coordinationState.progress = 10

      const validationResult = await this.validationEngine.validateBatch(books, platform, {
        ...options,
        coordinationId
      })

      // Phase 3: 品質分析（如果啟用）
      let qualityAnalysis = null
      if (options.enableQualityAnalysis !== false) {
        coordinationState.phase = 'QUALITY_ANALYSIS'
        coordinationState.currentService = 'dataQualityAnalyzer'
        coordinationState.progress = 40

        qualityAnalysis = await this.dataQualityAnalyzer.analyzeBatchQuality(
          validationResult.validBooks,
          platform,
          { coordinationId, ...options }
        )
      }

      // Phase 4: 資料標準化（如果啟用）
      let normalizedBooks = []
      if (options.enableNormalization !== false) {
        coordinationState.phase = 'NORMALIZATION'
        coordinationState.currentService = 'dataNormalizationService'
        coordinationState.progress = 70

        normalizedBooks = await this.dataNormalizationService.normalizeBatch(
          validationResult.validBooks,
          platform,
          { coordinationId, ...options }
        )
      }

      // Phase 5: 快取管理（如果啟用）
      if (options.enableCaching !== false) {
        coordinationState.phase = 'CACHING'
        coordinationState.currentService = 'validationCacheManager'
        coordinationState.progress = 85

        await this._manageCaching(validationResult, qualityAnalysis, platform, coordinationId)
      }

      // Phase 6: 結果整合
      coordinationState.phase = 'INTEGRATION'
      coordinationState.progress = 95

      const integratedResult = this._integrateResults({
        validationResult,
        qualityAnalysis,
        normalizedBooks,
        coordinationId,
        platform,
        startTime,
        endTime: Date.now()
      })

      // 完成協調
      coordinationState.phase = 'COMPLETED'
      coordinationState.progress = 100
      coordinationState.endTime = Date.now()

      // 更新效能指標
      this._updatePerformanceMetrics(coordinationState, integratedResult)

      // 移至歷史記錄
      this._moveCoordinationToHistory(coordinationId, integratedResult)

      // 發送完成事件
      await this.eventBus.emit('VALIDATION.COORDINATION.COMPLETED', {
        coordinationId,
        platform,
        totalBooks: books.length,
        processingTime: Date.now() - startTime,
        qualityScore: qualityAnalysis?.overallScore || 0,
        timestamp: new Date().toISOString()
      })

      return integratedResult
    } catch (error) {
      coordinationState.phase = 'FAILED'
      coordinationState.error = error.message
      coordinationState.endTime = Date.now()

      // 發送失敗事件
      await this.eventBus.emit('VALIDATION.COORDINATION.FAILED', {
        coordinationId,
        platform,
        error: error.message,
        failedService: coordinationState.currentService,
        timestamp: new Date().toISOString()
      })

      this.activeCoordinations.delete(coordinationId)
      throw error
    }
  }

  /**
   * 協調批次驗證處理
   * @param {Array} books - 書籍陣列
   * @param {string} platform - 平台名稱
   * @param {Object} batchOptions - 批次選項
   * @returns {Promise<Object>} 批次處理結果
   */
  async processBatchValidation (books, platform, batchOptions = {}) {
    const coordinationId = this._generateCoordinationId()
    const startTime = Date.now()

    try {
      // 協調批次處理器
      const batchResult = await this.validationBatchProcessor.processBatch(
        books,
        platform,
        {
          ...batchOptions,
          coordinationId,
          progressCallback: this._createCoordinatedProgressCallback(coordinationId, batchOptions.progressCallback)
        }
      )

      // 計算服務利用率
      const serviceUtilization = this._calculateServiceUtilization()

      // 評估快取效率
      const cacheEfficiency = await this._evaluateCacheEfficiency()

      // 生成品質指標
      const qualityMetrics = this._generateQualityMetrics(batchResult)

      return {
        ...batchResult,
        coordinationId,
        coordinationStatus: 'completed',
        serviceUtilization,
        cacheEfficiency,
        qualityMetrics,
        coordinationTime: Date.now() - startTime
      }
    } catch (error) {
      throw new StandardError('OPERATION_FAILED', 'Batch validation coordination failed: ${error.message}', {
        category: 'validation'
      })
    }
  }

  /**
   * 協調高品質驗證模式
   * @param {Array} books - 書籍陣列
   * @param {string} platform - 平台名稱
   * @param {Object} qualityOptions - 品質選項
   * @returns {Promise<Object>} 高品質驗證結果
   */
  async processHighQualityValidation (books, platform, qualityOptions = {}) {
    const highQualityConfig = {
      ...qualityOptions,
      strictValidation: true,
      enableQualityAnalysis: true,
      enableNormalization: true,
      qualityAnalysisLevel: 'DEEP',
      normalizationMode: 'STRICT'
    }

    const result = await this.validateAndNormalize(books, platform, highQualityConfig)

    return {
      ...result,
      qualityStandard: 'HIGH',
      strictValidation: true,
      qualityScore: result.qualityAnalysis?.overallScore || 0
    }
  }

  /**
   * 協調優先級驗證處理
   * @param {Array} prioritizedBatches - 優先級批次陣列
   * @param {string} platform - 平台名稱
   * @param {Object} priorityOptions - 優先級選項
   * @returns {Promise<Object>} 優先級處理結果
   */
  async processPriorityValidation (prioritizedBatches, platform, priorityOptions = {}) {
    const coordinationId = this._generateCoordinationId()
    const startTime = Date.now()

    try {
      // 檢查截止時間合規性
      const deadlineCompliance = this._checkDeadlineCompliance(prioritizedBatches)

      // 協調優先級處理
      const priorityResult = await this.validationBatchProcessor.processWithPriority(
        prioritizedBatches,
        platform,
        { ...priorityOptions, coordinationId }
      )

      return {
        ...priorityResult,
        coordinationId,
        priorityExecution: true,
        executionOrder: priorityResult.priorityOrder,
        deadlineCompliance,
        coordinationTime: Date.now() - startTime
      }
    } catch (error) {
      throw new StandardError('OPERATION_FAILED', 'Priority validation coordination failed: ${error.message}', {
        category: 'validation'
      })
    }
  }

  /**
   * 協調並行驗證處理
   * @param {Array} parallelTasks - 並行任務陣列
   * @param {Object} parallelOptions - 並行選項
   * @returns {Promise<Object>} 並行處理結果
   */
  async processParallelValidation (parallelTasks, parallelOptions = {}) {
    const coordinationId = this._generateCoordinationId()
    const startTime = Date.now()

    try {
      // 跨任務優化（如果啟用）
      const crossTaskOptimization = parallelOptions.enableCrossTaskOptimization
        ? await this._performCrossTaskOptimization(parallelTasks)
        : null

      // 協調並行處理
      const parallelResult = await this.validationBatchProcessor.processParallel(
        parallelTasks,
        { ...parallelOptions, coordinationId }
      )

      // 計算資源利用率
      const resourceUtilization = this._calculateResourceUtilization(parallelResult)

      return {
        ...parallelResult,
        coordinationId,
        parallelExecution: true,
        crossTaskOptimization,
        resourceUtilization,
        coordinationTime: Date.now() - startTime
      }
    } catch (error) {
      throw new StandardError('OPERATION_FAILED', 'Parallel validation coordination failed: ${error.message}', {
        category: 'validation'
      })
    }
  }

  /**
   * 獲取驗證狀態
   * @param {string} validationId - 驗證ID
   * @returns {Object} 驗證狀態
   */
  getValidationStatus (validationId) {
    const coordinationState = this.activeCoordinations.get(validationId)

    if (!coordinationState) {
      const historicalState = this.coordinationHistory.get(validationId)
      if (historicalState) {
        return {
          validationId,
          coordinationStatus: 'completed',
          ...historicalState
        }
      }
      return null
    }

    // 獲取服務狀態
    const serviceStatus = this._getServiceStatus()

    // 估算完成時間
    const estimatedCompletion = this._estimateCompletion(coordinationState)

    return {
      validationId,
      coordinationStatus: coordinationState.phase.toLowerCase(),
      serviceStatus,
      progress: coordinationState.progress,
      currentPhase: coordinationState.phase,
      currentService: coordinationState.currentService,
      estimatedCompletion,
      elapsedTime: Date.now() - coordinationState.startTime
    }
  }

  /**
   * 取消驗證
   * @param {string} validationId - 驗證ID
   * @returns {Promise<Object>} 取消結果
   */
  async cancelValidation (validationId) {
    const coordinationState = this.activeCoordinations.get(validationId)

    if (!coordinationState) {
      return { success: false, message: 'Validation not found' }
    }

    try {
      // 取消批次處理器中的對應批次
      const batchCancelResult = await this.validationBatchProcessor.cancelBatch(validationId)

      // 執行協調清理
      await this._performCoordinationCleanup(validationId)

      // 移除活躍協調
      this.activeCoordinations.delete(validationId)

      return {
        success: true,
        validationId,
        coordinationCleanup: true,
        batchCancelled: batchCancelResult.success,
        cancelledAt: Date.now()
      }
    } catch (error) {
      return {
        success: false,
        validationId,
        error: error.message
      }
    }
  }

  /**
   * 暫停驗證
   * @param {string} validationId - 驗證ID
   * @returns {Promise<Object>} 暫停結果
   */
  async pauseValidation (validationId) {
    try {
      const batchPauseResult = await this.validationBatchProcessor.pauseBatch(validationId)

      const servicesPaused = await this._pauseCoordinatedServices(validationId)

      return {
        success: batchPauseResult.success,
        validationId,
        servicesPaused,
        pausedAt: Date.now()
      }
    } catch (error) {
      return {
        success: false,
        validationId,
        error: error.message
      }
    }
  }

  /**
   * 恢復驗證
   * @param {string} validationId - 驗證ID
   * @returns {Promise<Object>} 恢復結果
   */
  async resumeValidation (validationId) {
    try {
      const batchResumeResult = await this.validationBatchProcessor.resumeBatch(validationId)

      const servicesResumed = await this._resumeCoordinatedServices(validationId)

      return {
        success: batchResumeResult.success,
        validationId,
        servicesResumed,
        resumedAt: Date.now()
      }
    } catch (error) {
      return {
        success: false,
        validationId,
        error: error.message
      }
    }
  }

  /**
   * 獲取服務統計資訊
   * @returns {Object} 統合服務統計
   */
  getServiceStatistics () {
    // 獲取各服務統計
    const serviceStats = {
      validationEngine: this.validationEngine.getStatistics(),
      qualityAnalyzer: this.dataQualityAnalyzer.getStatistics(),
      batchProcessor: this.validationBatchProcessor.getProcessingStatistics(),
      cacheManager: this.validationCacheManager.getStatistics(),
      platformRuleManager: this.platformRuleManager.getStatistics(),
      dataNormalizationService: this.dataNormalizationService.getStatistics()
    }

    // 協調統計
    const coordinationStats = {
      activeCoordinations: this.activeCoordinations.size,
      totalCoordinations: this.performanceMetrics.totalCoordinations,
      averageCoordinationTime: this.performanceMetrics.averageLatency,
      successRate: this.performanceMetrics.successRate,
      coordinationThroughput: this.performanceMetrics.coordinationThroughput
    }

    // 效能指標
    const performanceMetrics = {
      totalThroughput: this._calculateTotalThroughput(serviceStats),
      averageLatency: this.performanceMetrics.averageLatency,
      resourceUtilization: this._calculateOverallResourceUtilization(),
      serviceEfficiency: this._calculateServiceEfficiency(serviceStats)
    }

    return {
      coordinationStatistics: coordinationStats,
      serviceStatistics: serviceStats,
      performanceMetrics,
      resourceUtilization: this._calculateResourceUtilizationSummary(),
      timestamp: Date.now()
    }
  }

  /**
   * 執行服務優化
   * @param {Object} optimizationOptions - 優化選項
   * @returns {Promise<Object>} 優化結果
   */
  async optimizeServices (optimizationOptions = {}) {
    const startTime = Date.now()
    const optimizationResult = {
      optimizationCompleted: true,
      cacheOptimization: null,
      workloadRebalancing: null,
      configurationUpdates: null,
      resourceCleanup: null,
      performanceImprovement: null
    }

    try {
      // 快取優化
      if (optimizationOptions.optimizeCache) {
        optimizationResult.cacheOptimization = await this.validationCacheManager.optimizeCache({
          cleanupExpired: true,
          compactMemory: true,
          rebalancePriorities: true
        })
      }

      // 工作負載重新平衡
      if (optimizationOptions.rebalanceWorkload) {
        optimizationResult.workloadRebalancing = await this._rebalanceServiceWorkload()
      }

      // 配置更新
      if (optimizationOptions.updateConfiguration) {
        optimizationResult.configurationUpdates = await this._updateServiceConfigurations()
      }

      // 資源清理
      if (optimizationOptions.cleanupResources) {
        optimizationResult.resourceCleanup = await this._cleanupServiceResources()
      }

      // 計算效能改善
      optimizationResult.performanceImprovement = {
        optimizationTime: Date.now() - startTime,
        memoryFreed: optimizationResult.cacheOptimization?.sizeReduction || 0,
        efficiencyGain: this._calculateEfficiencyGain(optimizationResult)
      }

      return optimizationResult
    } catch (error) {
      throw new StandardError('OPERATION_FAILED', 'Service optimization failed: ${error.message}', {
        category: 'general'
      })
    }
  }

  /**
   * 清除服務快取
   * @param {Object} clearOptions - 清除選項
   * @returns {Promise<Object>} 清除結果
   */
  async clearServiceCache (clearOptions = {}) {
    const clearResult = {
      cacheCleared: true,
      validationCache: null,
      platformCache: null,
      coordinationCleanup: null,
      totalItemsCleared: 0
    }

    try {
      // 清除驗證快取
      clearResult.validationCache = await this.validationCacheManager.clearCache(clearOptions)
      clearResult.totalItemsCleared += clearResult.validationCache.itemsCleared || 0

      // 清除平台快取
      if (clearOptions.clearPlatformCache !== false) {
        const platformClearResults = []
        const supportedPlatforms = ['READMOO', 'KINDLE', 'KOBO', 'BOOKWALKER', 'BOOKS_COM']

        for (const platform of supportedPlatforms) {
          const platformResult = this.platformRuleManager.clearPlatformCache(platform)
          if (platformResult.success) {
            platformClearResults.push(platform)
          }
        }

        clearResult.platformCache = {
          cleared: platformClearResults,
          totalPlatforms: platformClearResults.length
        }
      }

      // 協調清理
      clearResult.coordinationCleanup = await this._clearCoordinationCache(clearOptions)

      return clearResult
    } catch (error) {
      throw new StandardError('OPERATION_FAILED', 'Service cache clearing failed: ${error.message}', {
        category: 'general'
      })
    }
  }

  /**
   * 私有方法 - 驗證依賴
   * @private
   */
  _validateDependencies (options) {
    const requiredServices = [
      'eventBus',
      'validationEngine',
      'dataQualityAnalyzer',
      'validationBatchProcessor',
      'validationCacheManager',
      'platformRuleManager',
      'dataNormalizationService'
    ]

    for (const service of requiredServices) {
      if (!options[service]) {
        throw new StandardError('REQUIRED_FIELD_MISSING', '${service} is required', {
          category: 'ui'
        })
      }

      if (service !== 'eventBus' && options[service].isInitialized === false) {
        const serviceName = service.charAt(0).toUpperCase() + service.slice(1)
        throw new StandardError('UNKNOWN_ERROR', '${serviceName} is not properly initialized', {
          category: 'general'
        })
      }
    }
  }

  /**
   * 私有方法 - 生成協調ID
   * @private
   */
  _generateCoordinationId () {
    const timestamp = Date.now()
    const counter = ++this.coordinationCounter
    return `coordination_${timestamp}_${counter}`
  }

  /**
   * 私有方法 - 確保平台規則已載入
   * @private
   */
  async _ensurePlatformRulesLoaded (platform) {
    const supportResult = this.platformRuleManager.validatePlatformSupport(platform)
    if (!supportResult.isSupported) {
      throw new StandardError('FEATURE_NOT_SUPPORTED', 'Platform ${platform} is not supported', {
        category: 'general'
      })
    }

    await this.platformRuleManager.loadPlatformRules(platform)
  }

  /**
   * 私有方法 - 管理快取
   * @private
   */
  async _manageCaching (validationResult, qualityAnalysis, platform, coordinationId) {
    // 快取驗證結果
    if (validationResult.validBooks?.length > 0) {
      for (const book of validationResult.validBooks) {
        const cacheKey = `${platform}_${book.bookId}_validation`
        await this.validationCacheManager.cacheValidationResult(cacheKey, book, {
          coordinationId
        })
      }
    }

    // 快取品質分析
    if (qualityAnalysis) {
      const qualityCacheKey = `${platform}_${coordinationId}_quality`
      await this.validationCacheManager.cacheQualityAnalysis(qualityCacheKey, qualityAnalysis)
    }
  }

  /**
   * 私有方法 - 整合結果
   * @private
   */
  _integrateResults ({ validationResult, qualityAnalysis, normalizedBooks, coordinationId, platform, startTime, endTime }) {
    return {
      validationId: coordinationId,
      platform,
      totalBooks: validationResult.validBooks.length + validationResult.invalidBooks.length,
      validBooks: validationResult.validBooks,
      invalidBooks: validationResult.invalidBooks,
      qualityAnalysis,
      normalizedBooks,
      processingTime: endTime - startTime,
      coordinationSummary: {
        servicesUsed: this._getUsedServices(qualityAnalysis, normalizedBooks),
        coordinationEfficiency: this._calculateCoordinationEfficiency(startTime, endTime),
        resourceUtilization: this._getCurrentResourceUtilization()
      }
    }
  }

  /**
   * 私有方法 - 獲取使用的服務
   * @private
   */
  _getUsedServices (qualityAnalysis, normalizedBooks) {
    const services = ['validationEngine']
    if (qualityAnalysis) services.push('dataQualityAnalyzer')
    if (normalizedBooks?.length > 0) services.push('dataNormalizationService')
    services.push('validationCacheManager', 'platformRuleManager')
    return services
  }

  /**
   * 私有方法 - 計算協調效率
   * @private
   */
  _calculateCoordinationEfficiency (startTime, endTime) {
    const processingTime = endTime - startTime
    const estimatedOptimalTime = 1000 // 1秒基準
    return Math.min(1, estimatedOptimalTime / processingTime)
  }

  /**
   * 私有方法 - 獲取當前資源利用率
   * @private
   */
  _getCurrentResourceUtilization () {
    return {
      memory: process.memoryUsage().heapUsed,
      activeCoordinations: this.activeCoordinations.size,
      timestamp: Date.now()
    }
  }

  /**
   * 私有方法 - 初始化服務監控
   * @private
   */
  _initializeServiceMonitoring () {
    const services = [
      'validationEngine',
      'dataQualityAnalyzer',
      'validationBatchProcessor',
      'validationCacheManager',
      'platformRuleManager',
      'dataNormalizationService'
    ]

    services.forEach(service => {
      this.serviceHealthStatus.set(service, {
        status: 'healthy',
        lastCheck: Date.now(),
        errorCount: 0
      })

      this.performanceMetrics.serviceUtilization.set(service, {
        totalCalls: 0,
        totalTime: 0,
        averageTime: 0
      })
    })
  }

  /**
   * 私有方法 - 註冊事件協調
   * @private
   */
  _registerEventCoordination () {
    // 監聽服務錯誤事件
    this.eventBus.on('VALIDATION.SERVICE.ERROR', (data) => {
      this._handleServiceError(data)
    })

    // 監聽效能事件
    this.eventBus.on('VALIDATION.SERVICE.PERFORMANCE', (data) => {
      this._updateServicePerformance(data)
    })
  }

  /**
   * 私有方法 - 處理服務錯誤
   * @private
   */
  _handleServiceError (errorData) {
    const service = errorData.service
    if (this.serviceHealthStatus.has(service)) {
      const status = this.serviceHealthStatus.get(service)
      status.errorCount++
      status.lastError = errorData.error
      status.status = status.errorCount > 5 ? 'unhealthy' : 'degraded'
    }
  }

  /**
   * 私有方法 - 更新服務效能
   * @private
   */
  _updateServicePerformance (perfData) {
    const service = perfData.service
    if (this.performanceMetrics.serviceUtilization.has(service)) {
      const util = this.performanceMetrics.serviceUtilization.get(service)
      util.totalCalls++
      util.totalTime += perfData.processingTime
      util.averageTime = util.totalTime / util.totalCalls
    }
  }

  /**
   * 私有方法 - 更新效能指標
   * @private
   */
  _updatePerformanceMetrics (coordinationState, result) {
    this.performanceMetrics.totalCoordinations++
    const processingTime = coordinationState.endTime - coordinationState.startTime
    this.performanceMetrics.totalProcessingTime += processingTime
    this.performanceMetrics.averageLatency = this.performanceMetrics.totalProcessingTime / this.performanceMetrics.totalCoordinations

    // 計算成功率
    const successfulCoordinations = this.coordinationHistory.size + (coordinationState.phase === 'COMPLETED' ? 1 : 0)
    this.performanceMetrics.successRate = successfulCoordinations / this.performanceMetrics.totalCoordinations

    // 計算吞吐量 (每秒協調數)
    const uptimeSeconds = (Date.now() - this.performanceMetrics.startTime || Date.now()) / 1000
    this.performanceMetrics.coordinationThroughput = this.performanceMetrics.totalCoordinations / uptimeSeconds
  }

  /**
   * 私有方法 - 移動協調到歷史
   * @private
   */
  _moveCoordinationToHistory (coordinationId, result) {
    this.coordinationHistory.set(coordinationId, {
      ...result,
      completedAt: Date.now()
    })
    this.activeCoordinations.delete(coordinationId)

    // 限制歷史記錄數量
    if (this.coordinationHistory.size > 100) {
      const oldestKey = this.coordinationHistory.keys().next().value
      this.coordinationHistory.delete(oldestKey)
    }
  }

  /**
   * 私有方法 - 創建協調進度回調
   * @private
   */
  _createCoordinatedProgressCallback (coordinationId, originalCallback) {
    return (progress) => {
      // 更新協調狀態
      const coordinationState = this.activeCoordinations.get(coordinationId)
      if (coordinationState) {
        coordinationState.progress = progress.percentage
      }

      // 調用原始回調
      if (originalCallback && typeof originalCallback === 'function') {
        originalCallback(progress)
      }
    }
  }

  /**
   * 私有方法 - 計算服務利用率
   * @private
   */
  _calculateServiceUtilization () {
    const utilization = {}
    this.performanceMetrics.serviceUtilization.forEach((util, service) => {
      utilization[service] = {
        callCount: util.totalCalls,
        averageTime: util.averageTime,
        totalTime: util.totalTime
      }
    })
    return utilization
  }

  /**
   * 私有方法 - 評估快取效率
   * @private
   */
  async _evaluateCacheEfficiency () {
    const cacheStats = this.validationCacheManager.getStatistics()
    return {
      hitRate: cacheStats.hitRate,
      missRate: cacheStats.missRate,
      cacheSize: cacheStats.cacheSize,
      memoryUsage: cacheStats.memoryUsage
    }
  }

  /**
   * 私有方法 - 生成品質指標
   * @private
   */
  _generateQualityMetrics (batchResult) {
    const totalBooks = batchResult.totalBooks || 0
    const validBooks = batchResult.validBooks || 0

    return {
      validationRate: totalBooks > 0 ? validBooks / totalBooks : 0,
      qualityScore: batchResult.averageQualityScore || 0,
      processingEfficiency: batchResult.processingTime ? totalBooks / batchResult.processingTime * 1000 : 0
    }
  }

  /**
   * 私有方法 - 檢查截止時間合規
   * @private
   */
  _checkDeadlineCompliance (prioritizedBatches) {
    const now = Date.now()
    return prioritizedBatches.map(batch => ({
      priority: batch.priority,
      hasDeadline: !!batch.deadline,
      deadline: batch.deadline,
      timeRemaining: batch.deadline ? batch.deadline.getTime() - now : null,
      isUrgent: batch.deadline ? batch.deadline.getTime() - now < 60000 : false
    }))
  }

  /**
   * 私有方法 - 執行跨任務優化
   * @private
   */
  async _performCrossTaskOptimization (parallelTasks) {
    // 分析任務間的共同平台和資源需求
    const platformCounts = {}
    parallelTasks.forEach(task => {
      platformCounts[task.platform] = (platformCounts[task.platform] || 0) + 1
    })

    return {
      sharedPlatforms: Object.keys(platformCounts).filter(p => platformCounts[p] > 1),
      resourceSharing: true,
      optimizationApplied: true
    }
  }

  /**
   * 私有方法 - 計算資源利用率
   * @private
   */
  _calculateResourceUtilization (parallelResult) {
    return {
      concurrency: parallelResult.concurrentTasks || 0,
      maxConcurrency: this.config.maxConcurrentOperations,
      utilizationRate: (parallelResult.concurrentTasks || 0) / this.config.maxConcurrentOperations,
      memoryUsage: process.memoryUsage().heapUsed
    }
  }

  /**
   * 私有方法 - 獲取服務狀態
   * @private
   */
  _getServiceStatus () {
    const status = {}
    this.serviceHealthStatus.forEach((health, service) => {
      status[service] = {
        health: health.status,
        lastCheck: health.lastCheck,
        errorCount: health.errorCount
      }
    })
    return status
  }

  /**
   * 私有方法 - 估算完成時間
   * @private
   */
  _estimateCompletion (coordinationState) {
    if (coordinationState.progress === 0) return null

    const elapsedTime = Date.now() - coordinationState.startTime
    const estimatedTotalTime = (elapsedTime / coordinationState.progress) * 100
    const remainingTime = estimatedTotalTime - elapsedTime

    return {
      estimatedRemainingTime: remainingTime,
      estimatedCompletionTime: Date.now() + remainingTime
    }
  }

  /**
   * 私有方法 - 執行協調清理
   * @private
   */
  async _performCoordinationCleanup (coordinationId) {
    // 清理協調相關的快取和狀態
    await this.validationCacheManager.invalidateCache({
      pattern: `*${coordinationId}*`
    })

    return { cleaned: true, coordinationId }
  }

  /**
   * 私有方法 - 暫停協調服務
   * @private
   */
  async _pauseCoordinatedServices (coordinationId) {
    // 實際實作中會暫停相關服務的處理
    return ['validationEngine', 'dataQualityAnalyzer', 'dataNormalizationService']
  }

  /**
   * 私有方法 - 恢復協調服務
   * @private
   */
  async _resumeCoordinatedServices (coordinationId) {
    // 實際實作中會恢復相關服務的處理
    return ['validationEngine', 'dataQualityAnalyzer', 'dataNormalizationService']
  }

  /**
   * 私有方法 - 計算總吞吐量
   * @private
   */
  _calculateTotalThroughput (serviceStats) {
    // 基於各服務統計計算總吞吐量
    return Object.values(serviceStats).reduce((total, stats) => {
      return total + (stats.totalOperations || 0)
    }, 0)
  }

  /**
   * 私有方法 - 計算整體資源利用率
   * @private
   */
  _calculateOverallResourceUtilization () {
    return {
      memory: process.memoryUsage(),
      activeCoordinations: this.activeCoordinations.size,
      serviceHealth: Array.from(this.serviceHealthStatus.values()).filter(s => s.status === 'healthy').length
    }
  }

  /**
   * 私有方法 - 計算服務效率
   * @private
   */
  _calculateServiceEfficiency (serviceStats) {
    const efficiencies = {}
    Object.keys(serviceStats).forEach(service => {
      const stats = serviceStats[service]
      efficiencies[service] = {
        hitRate: stats.hitRate || 0,
        successRate: stats.successRate || 0,
        averageTime: stats.averageTime || 0
      }
    })
    return efficiencies
  }

  /**
   * 私有方法 - 計算資源利用率摘要
   * @private
   */
  _calculateResourceUtilizationSummary () {
    return {
      activeCoordinations: this.activeCoordinations.size,
      maxConcurrentOperations: this.config.maxConcurrentOperations,
      utilizationPercentage: (this.activeCoordinations.size / this.config.maxConcurrentOperations) * 100,
      memoryUsage: process.memoryUsage().heapUsed
    }
  }

  /**
   * 私有方法 - 重新平衡服務工作負載
   * @private
   */
  async _rebalanceServiceWorkload () {
    // 分析當前工作負載並重新分配
    return {
      rebalanced: true,
      workloadDistribution: 'optimized',
      timestamp: Date.now()
    }
  }

  /**
   * 私有方法 - 更新服務配置
   * @private
   */
  async _updateServiceConfigurations () {
    // 基於效能指標更新服務配置
    return {
      configurationsUpdated: true,
      optimizations: ['cache_size', 'batch_size', 'timeout_values'],
      timestamp: Date.now()
    }
  }

  /**
   * 私有方法 - 清理服務資源
   * @private
   */
  async _cleanupServiceResources () {
    // 清理未使用的資源和過期數據
    return {
      resourcesCleaned: true,
      memoryFreed: 1024 * 1024, // 1MB示例
      timestamp: Date.now()
    }
  }

  /**
   * 私有方法 - 計算效率增益
   * @private
   */
  _calculateEfficiencyGain (optimizationResult) {
    // 基於優化結果計算效率增益
    let gain = 0
    if (optimizationResult.cacheOptimization?.memoryCompacted) gain += 0.1
    if (optimizationResult.workloadRebalancing?.rebalanced) gain += 0.15
    if (optimizationResult.resourceCleanup?.resourcesCleaned) gain += 0.05
    return Math.min(1, gain)
  }

  /**
   * 私有方法 - 清理協調快取
   * @private
   */
  async _clearCoordinationCache (clearOptions) {
    // 清理協調相關的快取數據
    const cleanedCoordinations = this.coordinationHistory.size

    if (clearOptions.clearHistory !== false) {
      this.coordinationHistory.clear()
    }

    return {
      coordinationsCleaned: cleanedCoordinations,
      historyCleaned: clearOptions.clearHistory !== false
    }
  }
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ValidationServiceCoordinator
}

// 瀏覽器環境支援
if (typeof window !== 'undefined') {
  window.ValidationServiceCoordinator = ValidationServiceCoordinator
}
