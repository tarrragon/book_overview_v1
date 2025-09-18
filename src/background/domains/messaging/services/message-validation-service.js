const ErrorCodes = require('src/core/errors/ErrorCodes')


const { EVENT_PRIORITIES, MESSAGE_EVENTS } = require('src/core/event-bus')

/**
 * 訊息驗證服務配置常量
 */
const VALIDATION_RULES = {
  MAX_MESSAGE_SIZE: 1024 * 1024, // 1MB
  MAX_PAYLOAD_DEPTH: 10,
  MAX_STRING_LENGTH: 10000,
  MAX_ARRAY_LENGTH: 1000,
  ALLOWED_MESSAGE_TYPES: [
    'CONTENT_REQUEST',
    'CONTENT_RESPONSE',
    'POPUP_REQUEST',
    'POPUP_RESPONSE',
    'BACKGROUND_REQUEST',
    'BACKGROUND_RESPONSE',
    'SYSTEM_EVENT',
    'USER_ACTION'
  ]
}

const SECURITY_RULES = {
  FORBIDDEN_PATTERNS: [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onclick\s*=/gi,
    /onerror\s*=/gi
  ],
  MAX_URL_LENGTH: 2048,
  ALLOWED_ORIGINS: [],
  BLOCKED_DOMAINS: []
}

/**
 * 訊息驗證服務
 * 負責驗證訊息格式、內容安全性、權限檢查等
 */
class MessageValidationService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null

    // Logger 後備方案: Background Service 初始化保護
    // 設計理念: 訊息驗證服務作為通訊安全的核心基礎設施
    // 執行環境: Service Worker 長期運行，需要完整的日誌追蹤能力
    // 後備機制: console 確保安全驗證錯誤能被記錄
    // 安全考量: 訊息驗證失敗必須被追蹤，避免安全漏洞
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false
    }

    // 驗證快取
    this.validationCache = new Map()
    this.cacheCleanupInterval = null

    // 統計資料
    this.stats = {
      messagesValidated: 0,
      validMessages: 0,
      invalidMessages: 0,
      securityViolations: 0,
      formatViolations: 0,
      sizeViolations: 0,
      typeViolations: 0,
      cacheHits: 0,
      cacheMisses: 0
    }

    // 驗證規則設定
    this.validationRules = { ...VALIDATION_RULES }
    this.securityRules = { ...SECURITY_RULES }

    // 事件監聽器記錄
    this.registeredListeners = new Map()
  }

  /**
   * 初始化訊息驗證服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('⚠️ 訊息驗證服務已初始化')
      return
    }

    try {
      this.logger.log('🔄 初始化訊息驗證服務')

      // 載入驗證規則配置
      await this.loadValidationRules()

      this.state.initialized = true
      this.logger.log('✅ 訊息驗證服務初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化訊息驗證服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動訊息驗證服務
   */
  async start () {
    if (!this.state.initialized) {
      const error = new Error('訊息驗證服務尚未初始化')
      error.code = ErrorCodes.CONFIG_ERROR
      error.details = { category: 'validation' }
      throw error
    }

    if (this.state.active) {
      this.logger.warn('⚠️ 訊息驗證服務已啟動')
      return
    }

    try {
      this.logger.log('🚀 啟動訊息驗證服務')

      // 註冊事件監聽器
      await this.registerEventListeners()

      // 啟動快取清理監控
      this.startCacheCleanupMonitoring()

      this.state.active = true
      this.logger.log('✅ 訊息驗證服務啟動完成')
    } catch (error) {
      this.logger.error('❌ 啟動訊息驗證服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止訊息驗證服務
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('⚠️ 訊息驗證服務未啟動')
      return
    }

    try {
      this.logger.log('🛑 停止訊息驗證服務')

      // 停止快取清理監控
      this.stopCacheCleanupMonitoring()

      // 清理驗證快取
      this.validationCache.clear()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      this.state.active = false
      this.logger.log('✅ 訊息驗證服務停止完成')
    } catch (error) {
      this.logger.error('❌ 停止訊息驗證服務失敗:', error)
      throw error
    }
  }

  /**
   * 驗證訊息
   */
  async validateMessage (message, context = {}) {
    this.stats.messagesValidated++

    try {
      // 檢查快取
      const cacheKey = this.generateCacheKey(message, context)
      if (this.validationCache.has(cacheKey)) {
        this.stats.cacheHits++
        return this.validationCache.get(cacheKey)
      }

      this.stats.cacheMisses++

      // 執行驗證步驟
      const validationResult = await this.performValidation(message, context)

      // 快取結果（僅快取成功的驗證結果）
      if (validationResult.valid) {
        this.cacheValidationResult(cacheKey, validationResult)
      }

      // 更新統計
      if (validationResult.valid) {
        this.stats.validMessages++
      } else {
        this.stats.invalidMessages++
        this.updateViolationStats(validationResult.violations)
      }

      return validationResult
    } catch (error) {
      this.logger.error('❌ 驗證訊息失敗:', error)
      this.stats.invalidMessages++
      return {
        valid: false,
        violations: [{
          type: 'validation_error',
          message: error.message,
          severity: 'high'
        }],
        timestamp: Date.now()
      }
    }
  }

  /**
   * 執行驗證
   */
  async performValidation (message, context) {
    const violations = []

    // 1. 基本結構驗證
    const structureViolations = await this.validateMessageStructure(message)
    violations.push(...structureViolations)

    // 2. 大小限制驗證
    const sizeViolations = await this.validateMessageSize(message)
    violations.push(...sizeViolations)

    // 3. 類型驗證
    const typeViolations = await this.validateMessageType(message)
    violations.push(...typeViolations)

    // 4. 內容安全驗證
    const securityViolations = await this.validateMessageSecurity(message)
    violations.push(...securityViolations)

    // 5. 來源驗證
    const originViolations = await this.validateMessageOrigin(message, context)
    violations.push(...originViolations)

    // 6. 權限驗證
    const permissionViolations = await this.validateMessagePermissions(message, context)
    violations.push(...permissionViolations)

    return {
      valid: violations.length === 0,
      violations,
      timestamp: Date.now(),
      messageId: message.id || 'unknown'
    }
  }

  /**
   * 驗證訊息結構
   */
  async validateMessageStructure (message) {
    const violations = []

    // 檢查基本必需欄位
    if (!message || typeof message !== 'object') {
      violations.push({
        type: 'structure_error',
        field: 'message',
        message: '訊息必須是物件類型',
        severity: 'high'
      })
      return violations
    }

    // 檢查必需欄位
    const requiredFields = ['type', 'data']
    for (const field of requiredFields) {
      if (!(field in message)) {
        violations.push({
          type: 'structure_error',
          field,
          message: `缺少必需欄位: ${field}`,
          severity: 'high'
        })
      }
    }

    // 檢查嵌套深度
    const maxDepth = this.calculateObjectDepth(message)
    if (maxDepth > this.validationRules.MAX_PAYLOAD_DEPTH) {
      violations.push({
        type: 'structure_error',
        field: 'depth',
        message: `訊息嵌套深度超出限制 (${maxDepth} > ${this.validationRules.MAX_PAYLOAD_DEPTH})`,
        severity: 'medium'
      })
    }

    return violations
  }

  /**
   * 驗證訊息大小
   */
  async validateMessageSize (message) {
    const violations = []

    try {
      const messageSize = JSON.stringify(message).length
      if (messageSize > this.validationRules.MAX_MESSAGE_SIZE) {
        violations.push({
          type: 'size_violation',
          field: 'message',
          message: `訊息大小超出限制 (${messageSize} > ${this.validationRules.MAX_MESSAGE_SIZE})`,
          severity: 'high'
        })
      }

      // 檢查字串欄位長度
      this.validateStringFields(message, violations, '')

      // 檢查陣列欄位長度
      this.validateArrayFields(message, violations, '')
    } catch (error) {
      violations.push({
        type: 'size_violation',
        field: 'message',
        message: `無法計算訊息大小: ${error.message}`,
        severity: 'medium'
      })
    }

    return violations
  }

  /**
   * 驗證訊息類型
   */
  async validateMessageType (message) {
    const violations = []

    const messageType = message.type
    if (!this.validationRules.ALLOWED_MESSAGE_TYPES.includes(messageType)) {
      violations.push({
        type: 'type_violation',
        field: 'type',
        message: `不支援的訊息類型: ${messageType}`,
        severity: 'high'
      })
    }

    return violations
  }

  /**
   * 驗證訊息安全性
   */
  async validateMessageSecurity (message) {
    const violations = []

    // 檢查惡意內容模式
    const messageString = JSON.stringify(message)
    for (const pattern of this.securityRules.FORBIDDEN_PATTERNS) {
      if (pattern.test(messageString)) {
        violations.push({
          type: 'security_violation',
          field: 'content',
          message: '檢測到潛在惡意內容',
          severity: 'critical'
        })
      }
    }

    // 檢查URL長度和安全性
    this.validateUrlSecurity(message, violations, '')

    return violations
  }

  /**
   * 驗證訊息來源
   */
  async validateMessageOrigin (message, context) {
    const violations = []

    const origin = context.origin || context.sender?.origin
    if (origin) {
      // 檢查允許的來源
      if (this.securityRules.ALLOWED_ORIGINS.length > 0) {
        if (!this.securityRules.ALLOWED_ORIGINS.includes(origin)) {
          violations.push({
            type: 'origin_violation',
            field: 'origin',
            message: `來源不在允許清單中: ${origin}`,
            severity: 'high'
          })
        }
      }

      // 檢查封鎖的域名
      for (const blockedDomain of this.securityRules.BLOCKED_DOMAINS) {
        if (origin.includes(blockedDomain)) {
          violations.push({
            type: 'origin_violation',
            field: 'origin',
            message: `來源包含被封鎖的域名: ${blockedDomain}`,
            severity: 'critical'
          })
        }
      }
    }

    return violations
  }

  /**
   * 驗證訊息權限
   */
  async validateMessagePermissions (message, context) {
    const violations = []

    // 基本權限檢查
    const messageType = message.type
    const sender = context.sender

    // 檢查敏感操作權限
    const sensitiveTypes = ['SYSTEM_EVENT', 'BACKGROUND_REQUEST']
    if (sensitiveTypes.includes(messageType)) {
      if (!sender || !this.hasPermission(sender, messageType)) {
        violations.push({
          type: 'permission_violation',
          field: 'type',
          message: `發送者無權限執行操作: ${messageType}`,
          severity: 'high'
        })
      }
    }

    return violations
  }

  /**
   * 檢查權限
   */
  hasPermission (sender, messageType) {
    // 基本權限檢查邏輯
    // 這裡可以根據實際需求擴展
    if (!sender) return false

    // Content script 可以發送 content 相關請求
    if (sender.tab && messageType.startsWith('CONTENT_')) {
      return true
    }

    // Extension 內部可以發送 background 相關請求
    if (sender.id && messageType.startsWith('BACKGROUND_')) {
      return true
    }

    return false
  }

  /**
   * 計算物件深度
   */
  calculateObjectDepth (obj, currentDepth = 0) {
    if (currentDepth > this.validationRules.MAX_PAYLOAD_DEPTH) {
      return currentDepth
    }

    if (typeof obj !== 'object' || obj === null) {
      return currentDepth
    }

    let maxDepth = currentDepth

    if (Array.isArray(obj)) {
      for (const item of obj) {
        const depth = this.calculateObjectDepth(item, currentDepth + 1)
        maxDepth = Math.max(maxDepth, depth)
      }
    } else {
      for (const value of Object.values(obj)) {
        const depth = this.calculateObjectDepth(value, currentDepth + 1)
        maxDepth = Math.max(maxDepth, depth)
      }
    }

    return maxDepth
  }

  /**
   * 驗證字串欄位
   */
  validateStringFields (obj, violations, path) {
    if (typeof obj === 'string') {
      if (obj.length > this.validationRules.MAX_STRING_LENGTH) {
        violations.push({
          type: 'size_violation',
          field: path || 'string',
          message: `字串長度超出限制 (${obj.length} > ${this.validationRules.MAX_STRING_LENGTH})`,
          severity: 'medium'
        })
      }
    } else if (typeof obj === 'object' && obj !== null) {
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          this.validateStringFields(item, violations, `${path}[${index}]`)
        })
      } else {
        Object.entries(obj).forEach(([key, value]) => {
          this.validateStringFields(value, violations, path ? `${path}.${key}` : key)
        })
      }
    }
  }

  /**
   * 驗證陣列欄位
   */
  validateArrayFields (obj, violations, path) {
    if (Array.isArray(obj)) {
      if (obj.length > this.validationRules.MAX_ARRAY_LENGTH) {
        violations.push({
          type: 'size_violation',
          field: path || 'array',
          message: `陣列長度超出限制 (${obj.length} > ${this.validationRules.MAX_ARRAY_LENGTH})`,
          severity: 'medium'
        })
      }

      // 遞迴檢查陣列元素
      obj.forEach((item, index) => {
        this.validateArrayFields(item, violations, `${path}[${index}]`)
      })
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        this.validateArrayFields(value, violations, path ? `${path}.${key}` : key)
      })
    }
  }

  /**
   * 驗證URL安全性
   */
  validateUrlSecurity (obj, violations, path) {
    if (typeof obj === 'string') {
      // 檢查是否是URL
      try {
        if (obj.startsWith('http://') || obj.startsWith('https://') || obj.startsWith('//')) {
          const url = new URL(obj.startsWith('//') ? 'https:' + obj : obj)

          // 檢查URL長度
          if (obj.length > this.securityRules.MAX_URL_LENGTH) {
            violations.push({
              type: 'security_violation',
              field: path || 'url',
              message: 'URL長度超出安全限制',
              severity: 'medium'
            })
          }

          // 檢查域名
          for (const blockedDomain of this.securityRules.BLOCKED_DOMAINS) {
            if (url.hostname.includes(blockedDomain)) {
              violations.push({
                type: 'security_violation',
                field: path || 'url',
                message: 'URL包含被封鎖的域名',
                severity: 'high'
              })
            }
          }
        }
      } catch (error) {
        // URL解析失敗，但不一定是安全問題
      }
    } else if (typeof obj === 'object' && obj !== null) {
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          this.validateUrlSecurity(item, violations, `${path}[${index}]`)
        })
      } else {
        Object.entries(obj).forEach(([key, value]) => {
          this.validateUrlSecurity(value, violations, path ? `${path}.${key}` : key)
        })
      }
    }
  }

  /**
   * 產生快取鍵
   */
  generateCacheKey (message, context) {
    const keyData = {
      type: message.type,
      dataHash: this.simpleHash(JSON.stringify(message.data)),
      origin: context.origin || 'unknown'
    }
    return JSON.stringify(keyData)
  }

  /**
   * 簡單雜湊函數
   */
  simpleHash (str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 轉換為32位元整數
    }
    return hash
  }

  /**
   * 快取驗證結果
   */
  cacheValidationResult (cacheKey, result) {
    // 限制快取大小
    if (this.validationCache.size > 1000) {
      // 清除最舊的項目
      const firstKey = this.validationCache.keys().next().value
      this.validationCache.delete(firstKey)
    }

    // 加上過期時間
    const cachedResult = {
      ...result,
      cachedAt: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000) // 5分鐘後過期
    }

    this.validationCache.set(cacheKey, cachedResult)
  }

  /**
   * 更新違規統計
   */
  updateViolationStats (violations) {
    for (const violation of violations) {
      switch (violation.type) {
        case 'security_violation':
          this.stats.securityViolations++
          break
        case 'structure_error':
        case 'format_error':
          this.stats.formatViolations++
          break
        case 'size_violation':
          this.stats.sizeViolations++
          break
        case 'type_violation':
          this.stats.typeViolations++
          break
      }
    }
  }

  /**
   * 載入驗證規則
   */
  async loadValidationRules () {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get(['validation_rules'])

        if (stored.validation_rules) {
          this.validationRules = { ...this.validationRules, ...stored.validation_rules }
          this.logger.log('📚 載入了自訂驗證規則')
        }
      }
    } catch (error) {
      this.logger.error('❌ 載入驗證規則失敗:', error)
    }
  }

  /**
   * 啟動快取清理監控
   */
  startCacheCleanupMonitoring () {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval)
    }

    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupExpiredCache()
    }, 60000) // 每分鐘清理一次

    this.logger.log('🔄 快取清理監控已啟動')
  }

  /**
   * 停止快取清理監控
   */
  stopCacheCleanupMonitoring () {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval)
      this.cacheCleanupInterval = null
    }

    this.logger.log('🔄 快取清理監控已停止')
  }

  /**
   * 清理過期快取
   */
  cleanupExpiredCache () {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, value] of this.validationCache) {
      if (value.expiresAt && value.expiresAt < now) {
        this.validationCache.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`🧹 清理了 ${cleanedCount} 個過期快取項目`)
    }
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners () {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 不可用，跳過事件監聽器註冊')
      return
    }

    const listeners = [
      {
        event: MESSAGE_EVENTS.VALIDATE_REQUESTED,
        handler: this.handleValidationRequest.bind(this),
        priority: EVENT_PRIORITIES.HIGH
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
    this.logger.log('✅ 所有事件監聽器已取消註冊')
  }

  /**
   * 處理驗證請求
   */
  async handleValidationRequest (event) {
    try {
      const { message, context } = event.data
      const result = await this.validateMessage(message, context)

      // 發送驗證結果事件
      if (this.eventBus) {
        await this.eventBus.emit('MESSAGE.VALIDATION.COMPLETED', {
          messageId: message.id || 'unknown',
          validationResult: result,
          timestamp: Date.now()
        }, EVENT_PRIORITIES.NORMAL)
      }
    } catch (error) {
      this.logger.error('❌ 處理驗證請求失敗:', error)
    }
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      cacheSize: this.validationCache.size,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const isHealthy = this.state.initialized && this.state.active

    return {
      service: 'MessageValidationService',
      healthy: isHealthy,
      status: this.state.active ? 'active' : 'inactive',
      metrics: {
        messagesValidated: this.stats.messagesValidated,
        validMessages: this.stats.validMessages,
        invalidMessages: this.stats.invalidMessages,
        securityViolations: this.stats.securityViolations,
        cacheHitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) || 0,
        cacheSize: this.validationCache.size
      }
    }
  }

  /**
   * 獲取驗證指標
   */
  getMetrics () {
    return {
      ...this.stats,
      cacheSize: this.validationCache.size,
      cacheHitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) || 0
    }
  }
}

module.exports = { MessageValidationService, VALIDATION_RULES, SECURITY_RULES }
