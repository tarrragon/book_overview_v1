/**
 * 驗證服務
 * 
 * 負責功能：
 * - 資料驗證和完整性檢查
 * - 資料品質評估和分析
 * - 驗證規則管理和執行
 * - 錯誤檢測和報告
 * 
 * 設計考量：
 * - 可擴展的驗證規則引擎
 * - 多層次的驗證策略
 * - 詳細的錯誤報告和建議
 * - 高效能的批量驗證
 * 
 * 使用情境：
 * - 驗證提取的書籍資料完整性
 * - 檢查資料格式和結構正確性
 * - 評估資料品質分數
 */

const {
  EXTRACTION_EVENTS,
  EVENT_PRIORITIES
} = require('../../constants/module-constants')

class ValidationService {
  constructor(dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null
    
    // 服務狀態
    this.state = {
      initialized: false,
      active: false,
      validating: false
    }
    
    // 驗證規則
    this.validationRules = new Map()
    this.ruleGroups = new Map()
    this.customValidators = new Map()
    this.registeredListeners = new Map()
    
    // 驗證配置
    this.config = {
      strictMode: false,
      enableDetailedReporting: true,
      maxErrorsPerField: 5,
      qualityThreshold: 0.8,
      enableAsyncValidation: true
    }
    
    // 驗證快取
    this.validationCache = new Map()
    this.cacheExpiry = 300000 // 5分鐘
    
    // 統計資料
    this.stats = {
      validationsPerformed: 0,
      totalErrors: 0,
      totalWarnings: 0,
      averageQualityScore: 0,
      validationTime: 0
    }
    
    // 初始化驗證規則
    this.initializeValidationRules()
  }

  /**
   * 初始化驗證服務
   */
  async initialize() {
    if (this.state.initialized) {
      this.logger.warn('⚠️ 驗證服務已初始化')
      return
    }

    try {
      this.logger.log('🔍 初始化驗證服務')
      
      // 初始化自定義驗證器
      await this.initializeCustomValidators()
      
      // 初始化規則群組
      await this.initializeRuleGroups()
      
      // 註冊事件監聽器
      await this.registerEventListeners()
      
      this.state.initialized = true
      this.logger.log('✅ 驗證服務初始化完成')
      
      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.VALIDATION.INITIALIZED', {
          serviceName: 'ValidationService',
          rulesCount: this.validationRules.size
        })
      }
    } catch (error) {
      this.logger.error('❌ 初始化驗證服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動驗證服務
   */
  async start() {
    if (!this.state.initialized) {
      throw new Error('服務尚未初始化')
    }

    if (this.state.active) {
      this.logger.warn('⚠️ 驗證服務已啟動')
      return
    }

    try {
      this.logger.log('🚀 啟動驗證服務')
      
      this.state.active = true
      this.state.validating = true
      
      this.logger.log('✅ 驗證服務啟動完成')
      
      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.VALIDATION.STARTED', {
          serviceName: 'ValidationService'
        })
      }
    } catch (error) {
      this.logger.error('❌ 啟動驗證服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止驗證服務
   */
  async stop() {
    if (!this.state.active) {
      this.logger.warn('⚠️ 驗證服務未啟動')
      return
    }

    try {
      this.logger.log('🛑 停止驗證服務')
      
      // 清理快取
      this.validationCache.clear()
      
      // 取消註冊事件監聽器
      await this.unregisterEventListeners()
      
      this.state.active = false
      this.state.validating = false
      
      this.logger.log('✅ 驗證服務停止完成')
      
      // 發送停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.VALIDATION.STOPPED', {
          serviceName: 'ValidationService',
          finalStats: { ...this.stats }
        })
      }
    } catch (error) {
      this.logger.error('❌ 停止驗證服務失敗:', error)
      throw error
    }
  }

  /**
   * 初始化驗證規則
   */
  initializeValidationRules() {
    // 必填欄位驗證
    this.validationRules.set('required', {
      name: 'required',
      message: '此欄位為必填',
      validator: (value) => value !== null && value !== undefined && value !== ''
    })
    
    // 字串長度驗證
    this.validationRules.set('string_length', {
      name: 'string_length',
      message: '字串長度不符合要求',
      validator: (value, options) => {
        if (typeof value !== 'string') return false
        const { min = 0, max = Infinity } = options || {}
        return value.length >= min && value.length <= max
      }
    })
    
    // 數字範圍驗證
    this.validationRules.set('number_range', {
      name: 'number_range',
      message: '數值超出有效範圍',
      validator: (value, options) => {
        const num = parseFloat(value)
        if (isNaN(num)) return false
        const { min = -Infinity, max = Infinity } = options || {}
        return num >= min && num <= max
      }
    })
    
    // 日期格式驗證
    this.validationRules.set('date_format', {
      name: 'date_format',
      message: '日期格式無效',
      validator: (value) => {
        if (!value) return true // 允許空值
        const date = new Date(value)
        return !isNaN(date.getTime())
      }
    })
    
    // 電子郵件格式驗證
    this.validationRules.set('email_format', {
      name: 'email_format',
      message: '電子郵件格式無效',
      validator: (value) => {
        if (!value) return true
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(value)
      }
    })
    
    // URL 格式驗證
    this.validationRules.set('url_format', {
      name: 'url_format',
      message: 'URL 格式無效',
      validator: (value) => {
        if (!value) return true
        try {
          new URL(value)
          return true
        } catch {
          return false
        }
      }
    })
    
    // ISBN 格式驗證
    this.validationRules.set('isbn_format', {
      name: 'isbn_format',
      message: 'ISBN 格式無效',
      validator: (value) => {
        if (!value) return true
        const isbn = value.replace(/[-\s]/g, '')
        return isbn.length === 10 || isbn.length === 13
      }
    })
    
    // 評分範圍驗證
    this.validationRules.set('rating_range', {
      name: 'rating_range',
      message: '評分必須在 0-5 之間',
      validator: (value) => {
        const rating = parseFloat(value)
        return !isNaN(rating) && rating >= 0 && rating <= 5
      }
    })
    
    // 進度百分比驗證
    this.validationRules.set('progress_percentage', {
      name: 'progress_percentage',
      message: '進度必須在 0-100 之間',
      validator: (value) => {
        const progress = parseFloat(value)
        return !isNaN(progress) && progress >= 0 && progress <= 100
      }
    })
    
    this.logger.log(`✅ 初始化了 ${this.validationRules.size} 個驗證規則`)
  }

  /**
   * 初始化自定義驗證器
   */
  async initializeCustomValidators() {
    // 書籍 ID 驗證器
    this.customValidators.set('book_id', async (value) => {
      if (!value || typeof value !== 'string') {
        return { valid: false, message: '書籍 ID 必須是非空字串' }
      }
      
      if (value.length < 5) {
        return { valid: false, message: '書籍 ID 長度不足' }
      }
      
      return { valid: true }
    })
    
    // 書籍標題驗證器
    this.customValidators.set('book_title', async (value) => {
      if (!value || typeof value !== 'string') {
        return { valid: false, message: '書籍標題必須是非空字串' }
      }
      
      if (value.length < 2 || value.length > 200) {
        return { valid: false, message: '書籍標題長度必須在 2-200 字元之間' }
      }
      
      return { valid: true }
    })
    
    // 作者名稱驗證器
    this.customValidators.set('author_name', async (value) => {
      if (!value || typeof value !== 'string') {
        return { valid: false, message: '作者名稱必須是非空字串' }
      }
      
      if (value.length < 1 || value.length > 100) {
        return { valid: false, message: '作者名稱長度必須在 1-100 字元之間' }
      }
      
      return { valid: true }
    })
    
    this.logger.log(`✅ 初始化了 ${this.customValidators.size} 個自定義驗證器`)
  }

  /**
   * 初始化規則群組
   */
  async initializeRuleGroups() {
    // 書籍基本資料驗證群組
    this.ruleGroups.set('book_basic', [
      { field: 'id', rule: 'required' },
      { field: 'id', rule: 'book_id' },
      { field: 'title', rule: 'required' },
      { field: 'title', rule: 'book_title' },
      { field: 'author', rule: 'required' },
      { field: 'author', rule: 'author_name' }
    ])
    
    // 書籍詳細資料驗證群組
    this.ruleGroups.set('book_details', [
      { field: 'isbn', rule: 'isbn_format' },
      { field: 'publicationDate', rule: 'date_format' },
      { field: 'pageCount', rule: 'number_range', options: { min: 1, max: 10000 } },
      { field: 'rating', rule: 'rating_range' },
      { field: 'progress', rule: 'progress_percentage' }
    ])
    
    // 書籍技術資料驗證群組
    this.ruleGroups.set('book_technical', [
      { field: 'format', rule: 'required' },
      { field: 'fileSize', rule: 'number_range', options: { min: 0 } },
      { field: 'language', rule: 'string_length', options: { min: 2, max: 10 } }
    ])
    
    this.logger.log(`✅ 初始化了 ${this.ruleGroups.size} 個規則群組`)
  }

  /**
   * 驗證資料
   */
  async validateData(data, ruleGroup = 'book_basic', options = {}) {
    const startTime = Date.now()
    
    try {
      this.logger.log(`🔍 開始驗證資料: ${ruleGroup}`)
      
      // 檢查快取
      const cacheKey = this.generateCacheKey(data, ruleGroup)
      const cached = this.getCachedValidation(cacheKey)
      if (cached) {
        this.logger.log(`💾 使用快取驗證結果: ${ruleGroup}`)
        return cached
      }
      
      const validationResult = {
        valid: true,
        errors: [],
        warnings: [],
        qualityScore: 1.0,
        details: {},
        metadata: {
          ruleGroup,
          validatedAt: Date.now(),
          validationTime: 0
        }
      }
      
      // 獲取驗證規則
      const rules = this.ruleGroups.get(ruleGroup)
      if (!rules) {
        throw new Error(`未找到規則群組: ${ruleGroup}`)
      }
      
      // 執行驗證
      for (const ruleConfig of rules) {
        const fieldResult = await this.validateField(data, ruleConfig)
        
        if (!fieldResult.valid) {
          validationResult.valid = false
          validationResult.errors.push(...fieldResult.errors)
          validationResult.warnings.push(...fieldResult.warnings)
        }
        
        validationResult.details[ruleConfig.field] = fieldResult
      }
      
      // 計算品質分數
      validationResult.qualityScore = this.calculateQualityScore(validationResult)
      
      // 更新統計
      const validationTime = Date.now() - startTime
      validationResult.metadata.validationTime = validationTime
      this.updateValidationStats(validationResult, validationTime)
      
      // 快取結果
      this.setCachedValidation(cacheKey, validationResult)
      
      this.logger.log(`✅ 驗證完成: ${ruleGroup} (${validationTime}ms)`)
      
      // 發送驗證完成事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.DATA.VALIDATED', {
          ruleGroup,
          valid: validationResult.valid,
          qualityScore: validationResult.qualityScore,
          errorCount: validationResult.errors.length
        })
      }
      
      return validationResult
      
    } catch (error) {
      this.logger.error(`❌ 驗證失敗: ${ruleGroup}`, error)
      throw error
    }
  }

  /**
   * 驗證單個欄位
   */
  async validateField(data, ruleConfig) {
    const { field, rule, options } = ruleConfig
    const value = data[field]
    
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      value,
      rule
    }
    
    try {
      // 檢查是否為自定義驗證器
      if (this.customValidators.has(rule)) {
        const validator = this.customValidators.get(rule)
        const validationResult = await validator(value, options)
        
        if (!validationResult.valid) {
          result.valid = false
          result.errors.push({
            field,
            rule,
            message: validationResult.message,
            value
          })
        }
      } else {
        // 使用標準驗證規則
        const validationRule = this.validationRules.get(rule)
        if (!validationRule) {
          throw new Error(`未找到驗證規則: ${rule}`)
        }
        
        const isValid = validationRule.validator(value, options)
        if (!isValid) {
          result.valid = false
          result.errors.push({
            field,
            rule,
            message: validationRule.message,
            value
          })
        }
      }
    } catch (error) {
      result.valid = false
      result.errors.push({
        field,
        rule,
        message: `驗證過程發生錯誤: ${error.message}`,
        value
      })
    }
    
    return result
  }

  /**
   * 批量驗證
   */
  async validateBatch(dataItems, ruleGroup = 'book_basic', options = {}) {
    const results = []
    const batchSize = options.batchSize || 10
    
    for (let i = 0; i < dataItems.length; i += batchSize) {
      const batch = dataItems.slice(i, i + batchSize)
      const batchPromises = batch.map(data => 
        this.validateData(data, ruleGroup, options)
      )
      
      try {
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
      } catch (error) {
        this.logger.error('❌ 批量驗證失敗:', error)
        throw error
      }
    }
    
    return {
      results,
      summary: this.generateBatchSummary(results)
    }
  }

  /**
   * 生成批量驗證摘要
   */
  generateBatchSummary(results) {
    const summary = {
      total: results.length,
      valid: 0,
      invalid: 0,
      totalErrors: 0,
      totalWarnings: 0,
      averageQualityScore: 0
    }
    
    let totalQualityScore = 0
    
    for (const result of results) {
      if (result.valid) {
        summary.valid++
      } else {
        summary.invalid++
      }
      
      summary.totalErrors += result.errors.length
      summary.totalWarnings += result.warnings.length
      totalQualityScore += result.qualityScore
    }
    
    summary.averageQualityScore = results.length > 0 ? 
      totalQualityScore / results.length : 0
    
    return summary
  }

  /**
   * 計算品質分數
   */
  calculateQualityScore(validationResult) {
    const { errors, warnings } = validationResult
    
    if (errors.length === 0 && warnings.length === 0) {
      return 1.0
    }
    
    // 錯誤比警告的權重更高
    const errorPenalty = errors.length * 0.2
    const warningPenalty = warnings.length * 0.1
    const totalPenalty = errorPenalty + warningPenalty
    
    return Math.max(0, 1.0 - totalPenalty)
  }

  /**
   * 快取管理
   */
  generateCacheKey(data, ruleGroup) {
    const dataHash = JSON.stringify(data).slice(0, 100)
    return `${ruleGroup}_${dataHash}`
  }

  getCachedValidation(cacheKey) {
    const cached = this.validationCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.result
    }
    
    if (cached) {
      this.validationCache.delete(cacheKey)
    }
    
    return null
  }

  setCachedValidation(cacheKey, result) {
    this.validationCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    })
    
    // 限制快取大小
    if (this.validationCache.size > 100) {
      const firstKey = this.validationCache.keys().next().value
      this.validationCache.delete(firstKey)
    }
  }

  /**
   * 更新驗證統計
   */
  updateValidationStats(result, validationTime) {
    this.stats.validationsPerformed++
    this.stats.totalErrors += result.errors.length
    this.stats.totalWarnings += result.warnings.length
    this.stats.validationTime += validationTime
    
    // 更新平均品質分數
    const totalValidations = this.stats.validationsPerformed
    this.stats.averageQualityScore = 
      ((this.stats.averageQualityScore * (totalValidations - 1)) + result.qualityScore) / totalValidations
  }

  /**
   * 註冊自定義驗證規則
   */
  registerValidationRule(name, rule) {
    this.validationRules.set(name, rule)
    this.logger.log(`✅ 註冊驗證規則: ${name}`)
  }

  /**
   * 註冊自定義驗證器
   */
  registerCustomValidator(name, validator) {
    this.customValidators.set(name, validator)
    this.logger.log(`✅ 註冊自定義驗證器: ${name}`)
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners() {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 不可用，跳過事件監聽器註冊')
      return
    }

    const listeners = [
      {
        event: EXTRACTION_EVENTS.VALIDATION_REQUEST,
        handler: this.handleValidationRequest.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      },
      {
        event: EXTRACTION_EVENTS.BATCH_VALIDATION_REQUEST,
        handler: this.handleBatchValidationRequest.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      }
    ]

    for (const { event, handler, priority } of listeners) {
      const listenerId = await this.eventBus.on(event, handler, { priority })
      this.registeredListeners.set(event, listenerId)
    }

    this.logger.log(`✅ 註冊了 ${listeners.length} 個事件監聽器`)
  }

  /**
   * 取消註冊事件監聽器
   */
  async unregisterEventListeners() {
    if (!this.eventBus) return

    for (const [event, listenerId] of this.registeredListeners) {
      try {
        await this.eventBus.off(event, listenerId)
      } catch (error) {
        this.logger.error(`❌ 取消註冊事件監聽器失敗 (${event}):`, error)
      }
    }

    this.registeredListeners.clear()
    this.logger.log('✅ 所有事件監聽器已取消註冊')
  }

  /**
   * 處理驗證請求
   */
  async handleValidationRequest(event) {
    try {
      const { data, ruleGroup, options, requestId } = event.data || {}
      
      const result = await this.validateData(data, ruleGroup, options)
      
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.VALIDATION.RESULT', {
          requestId,
          result
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理驗證請求失敗:', error)
    }
  }

  /**
   * 處理批量驗證請求
   */
  async handleBatchValidationRequest(event) {
    try {
      const { dataItems, ruleGroup, options, requestId } = event.data || {}
      
      const result = await this.validateBatch(dataItems, ruleGroup, options)
      
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.BATCH_VALIDATION.RESULT', {
          requestId,
          result
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理批量驗證請求失敗:', error)
    }
  }

  /**
   * 獲取服務狀態
   */
  getStatus() {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      validating: this.state.validating,
      config: this.config,
      rulesCount: this.validationRules.size,
      validatorsCount: this.customValidators.size,
      ruleGroupsCount: this.ruleGroups.size,
      cacheSize: this.validationCache.size,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus() {
    const errorRate = this.stats.validationsPerformed > 0 ? 
      (this.stats.totalErrors / this.stats.validationsPerformed) : 0
    
    const avgValidationTime = this.stats.validationsPerformed > 0 ? 
      (this.stats.validationTime / this.stats.validationsPerformed) : 0
    
    const isHealthy = this.state.initialized && 
                     this.stats.averageQualityScore >= this.config.qualityThreshold &&
                     avgValidationTime < 1000 // 平均驗證時間低於1秒

    return {
      service: 'ValidationService',
      healthy: isHealthy,
      status: this.state.active ? 'active' : 'inactive',
      validating: this.state.validating,
      metrics: {
        validationsPerformed: this.stats.validationsPerformed,
        totalErrors: this.stats.totalErrors,
        totalWarnings: this.stats.totalWarnings,
        averageQualityScore: this.stats.averageQualityScore.toFixed(3),
        errorRate: (errorRate * 100).toFixed(2) + '%',
        avgValidationTime: avgValidationTime.toFixed(2) + 'ms'
      }
    }
  }
}

module.exports = ValidationService