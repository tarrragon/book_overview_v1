/**
 * EventTypeDefinitions - 事件類型定義
 * 負責 v2.0 事件命名格式驗證和類型管理
 * 
 * 負責功能：
 * - v2.0 事件命名格式驗證
 * - 事件類型定義和規範管理
 * - 命名約定驗證和建議
 * - 事件結構完整性檢查
 * 
 * 設計考量：
 * - 基於 DOMAIN.PLATFORM.ACTION.STATE 四層架構
 * - 支援多平台擴展和統一管理
 * - 智能命名建議和錯誤修正
 * - 完整的統計和使用追蹤
 * 
 * 處理流程：
 * 1. 驗證事件名稱格式是否符合 v2.0 規範
 * 2. 檢查各部分（領域、平台、動作、狀態）的有效性
 * 3. 提供智能命名建議和錯誤修正
 * 4. 記錄使用統計和分佈分析
 * 
 * 使用情境：
 * - 確保事件命名的一致性和標準化
 * - 支援開發時期的事件名稱驗證
 * - 提供事件使用分析和最佳化建議
 */

/**
 * v2.0 事件類型定義配置
 */
const EVENT_TYPE_CONFIG = {
  // 領域定義
  DOMAINS: [
    'SYSTEM',      // 系統管理領域
    'PLATFORM',    // 平台管理領域
    'EXTRACTION',  // 資料提取領域
    'DATA',        // 資料管理領域
    'MESSAGING',   // 通訊訊息領域
    'PAGE',        // 頁面管理領域
    'UX',          // 使用者體驗領域
    'SECURITY',    // 安全驗證領域
    'ANALYTICS'    // 分析統計領域
  ],

  // 平台定義
  PLATFORMS: [
    'READMOO',     // Readmoo 平台
    'KINDLE',      // Amazon Kindle
    'KOBO',        // 樂天 Kobo
    'BOOKS_COM',   // 博客來
    'BOOKWALKER',  // BookWalker
    'UNIFIED',     // 跨平台統一操作
    'MULTI',       // 多平台協調操作
    'GENERIC'      // 平台無關操作
  ],

  // 動作定義
  ACTIONS: [
    'INIT', 'START', 'STOP', 'EXTRACT', 'SAVE', 'LOAD',
    'DETECT', 'SWITCH', 'VALIDATE', 'PROCESS', 'SYNC',
    'OPEN', 'CLOSE', 'UPDATE', 'DELETE', 'CREATE'
  ],

  // 狀態定義
  STATES: [
    'REQUESTED', 'STARTED', 'PROGRESS', 'COMPLETED',
    'FAILED', 'CANCELLED', 'TIMEOUT', 'SUCCESS', 'ERROR'
  ],

  // 命名格式驗證
  NAMING_PATTERN: /^[A-Z][A-Z_]*\.[A-Z][A-Z_]*\.[A-Z][A-Z_]*\.[A-Z][A-Z_]*$/,
  MAX_PART_LENGTH: 20,
  MAX_EVENT_NAME_LENGTH: 100
}

/**
 * 領域與平台對應關係
 */
const DOMAIN_PLATFORM_MAPPING = {
  'EXTRACTION': ['READMOO', 'KINDLE', 'KOBO', 'BOOKS_COM', 'BOOKWALKER'],
  'DATA': ['READMOO', 'KINDLE', 'KOBO', 'BOOKS_COM', 'BOOKWALKER', 'UNIFIED'],
  'UX': ['GENERIC'],
  'SYSTEM': ['GENERIC'],
  'PLATFORM': ['READMOO', 'KINDLE', 'KOBO', 'BOOKS_COM', 'BOOKWALKER', 'UNIFIED', 'MULTI'],
  'MESSAGING': ['READMOO', 'KINDLE', 'KOBO', 'BOOKS_COM', 'BOOKWALKER', 'GENERIC'],
  'ANALYTICS': ['GENERIC', 'UNIFIED'],
  'SECURITY': ['GENERIC']
}

/**
 * 平台與動作對應關係
 */
const PLATFORM_ACTION_MAPPING = {
  'READMOO': ['EXTRACT', 'SAVE', 'LOAD', 'DETECT', 'VALIDATE'],
  'KINDLE': ['EXTRACT', 'SAVE', 'LOAD', 'DETECT', 'VALIDATE'],
  'KOBO': ['EXTRACT', 'SAVE', 'LOAD', 'DETECT', 'VALIDATE'],
  'BOOKS_COM': ['EXTRACT', 'SAVE', 'LOAD', 'DETECT', 'VALIDATE'],
  'BOOKWALKER': ['EXTRACT', 'SAVE', 'LOAD', 'DETECT', 'VALIDATE'],
  'UNIFIED': ['SYNC', 'PROCESS', 'VALIDATE', 'UPDATE'],
  'MULTI': ['SYNC', 'PROCESS', 'VALIDATE', 'UPDATE'],
  'GENERIC': ['INIT', 'START', 'STOP', 'OPEN', 'CLOSE', 'UPDATE', 'CREATE', 'DELETE']
}

/**
 * 動作與狀態對應關係
 */
const ACTION_STATE_MAPPING = {
  'EXTRACT': ['REQUESTED', 'STARTED', 'PROGRESS', 'COMPLETED', 'FAILED'],
  'SAVE': ['REQUESTED', 'STARTED', 'COMPLETED', 'FAILED'],
  'LOAD': ['REQUESTED', 'STARTED', 'COMPLETED', 'FAILED'],
  'DETECT': ['STARTED', 'COMPLETED', 'FAILED'],
  'VALIDATE': ['STARTED', 'COMPLETED', 'FAILED'],
  'SYNC': ['REQUESTED', 'STARTED', 'PROGRESS', 'COMPLETED', 'FAILED'],
  'PROCESS': ['STARTED', 'PROGRESS', 'COMPLETED', 'FAILED'],
  'INIT': ['STARTED', 'COMPLETED', 'FAILED'],
  'OPEN': ['REQUESTED', 'COMPLETED', 'FAILED'],
  'CLOSE': ['REQUESTED', 'COMPLETED', 'FAILED']
}

class EventTypeDefinitions {
  constructor() {
    this.domains = EVENT_TYPE_CONFIG.DOMAINS
    this.platforms = EVENT_TYPE_CONFIG.PLATFORMS
    this.actions = EVENT_TYPE_CONFIG.ACTIONS
    this.states = EVENT_TYPE_CONFIG.STATES
    this.namingPattern = EVENT_TYPE_CONFIG.NAMING_PATTERN
    
    this.usageStats = this.initializeUsageStats()
    this.validationErrors = this.initializeValidationErrors()
  }

  /**
   * 初始化使用統計
   * @returns {Object} 統計對象
   */
  initializeUsageStats() {
    return {
      totalEvents: 0,
      uniqueEvents: 0,
      eventUsage: new Map(),
      domainDistribution: {},
      platformDistribution: {}
    }
  }

  /**
   * 初始化驗證錯誤統計
   * @returns {Object} 錯誤統計對象
   */
  initializeValidationErrors() {
    return {
      totalErrors: 0,
      errorTypes: {}
    }
  }

  /**
   * 驗證事件名稱是否符合 v2.0 格式
   * @param {string} eventName - 事件名稱
   * @returns {boolean} 是否有效
   */
  isValidEventName(eventName) {
    try {
      // 基本類型檢查
      if (!eventName || typeof eventName !== 'string') {
        this.recordValidationError('INVALID_TYPE')
        return false
      }

      // 長度檢查
      if (eventName.length > EVENT_TYPE_CONFIG.MAX_EVENT_NAME_LENGTH) {
        this.recordValidationError('TOO_LONG')
        return false
      }

      // 格式檢查
      if (!this.namingPattern.test(eventName)) {
        this.recordValidationError('INVALID_FORMAT')
        return false
      }

      // 結構檢查
      const parts = eventName.split('.')
      if (parts.length !== 4) {
        this.recordValidationError('INVALID_STRUCTURE')
        return false
      }

      const [domain, platform, action, state] = parts

      // 各部分有效性檢查
      const isValid = this.isValidDomain(domain) &&
                     this.isValidPlatform(platform) &&
                     this.isValidAction(action) &&
                     this.isValidState(state)

      if (!isValid) {
        this.recordValidationError('INVALID_COMPONENTS')
      }

      return isValid
    } catch (error) {
      this.recordValidationError('VALIDATION_ERROR')
      return false
    }
  }

  /**
   * 分解事件名稱
   * @param {string} eventName - 事件名稱
   * @returns {Object} 分解後的部分
   */
  parseEventName(eventName) {
    const parts = eventName.split('.')
    if (parts.length !== 4) {
      throw new Error('Invalid event name format')
    }

    return {
      domain: parts[0],
      platform: parts[1],
      action: parts[2],
      state: parts[3]
    }
  }

  /**
   * 驗證領域是否有效
   * @param {string} domain - 領域名稱
   * @returns {boolean} 是否有效
   */
  isValidDomain(domain) {
    return this.domains.includes(domain)
  }

  /**
   * 驗證平台是否有效
   * @param {string} platform - 平台名稱
   * @returns {boolean} 是否有效
   */
  isValidPlatform(platform) {
    return this.platforms.includes(platform)
  }

  /**
   * 驗證動作是否有效
   * @param {string} action - 動作名稱
   * @returns {boolean} 是否有效
   */
  isValidAction(action) {
    return this.actions.includes(action)
  }

  /**
   * 驗證狀態是否有效
   * @param {string} state - 狀態名稱
   * @returns {boolean} 是否有效
   */
  isValidState(state) {
    return this.states.includes(state)
  }

  /**
   * 建構事件名稱
   * @param {string} domain - 領域
   * @param {string} platform - 平台
   * @param {string} action - 動作
   * @param {string} state - 狀態
   * @returns {string} 完整事件名稱
   */
  buildEventName(domain, platform, action, state) {
    if (!this.isValidDomain(domain)) {
      throw new Error('Invalid domain')
    }
    if (!this.isValidPlatform(platform)) {
      throw new Error('Invalid platform')
    }
    if (!this.isValidAction(action)) {
      throw new Error('Invalid action')
    }
    if (!this.isValidState(state)) {
      throw new Error('Invalid state')
    }

    return `${domain}.${platform}.${action}.${state}`
  }

  /**
   * 建構部分事件名稱
   * @param {string} domain - 領域
   * @param {string} platform - 平台
   * @returns {string} 部分事件名稱
   */
  buildPartialEventName(domain, platform) {
    return `${domain}.${platform}`
  }

  /**
   * 根據領域取得相關平台
   * @param {string} domain - 領域
   * @returns {Array<string>} 平台列表
   */
  getPlatformsForDomain(domain) {
    return DOMAIN_PLATFORM_MAPPING[domain] || []
  }

  /**
   * 根據平台取得相關動作
   * @param {string} platform - 平台
   * @returns {Array<string>} 動作列表
   */
  getActionsForPlatform(platform) {
    return PLATFORM_ACTION_MAPPING[platform] || []
  }

  /**
   * 根據動作取得相關狀態
   * @param {string} action - 動作
   * @returns {Array<string>} 狀態列表
   */
  getStatesForAction(action) {
    return ACTION_STATE_MAPPING[action] || []
  }

  /**
   * 取得事件定義
   * @param {string} eventName - 事件名稱
   * @returns {Object} 事件定義
   */
  getEventDefinition(eventName) {
    const parts = this.parseEventName(eventName)
    
    return {
      ...parts,
      description: this.generateEventDescription(parts),
      category: this.getEventCategory(eventName)
    }
  }

  /**
   * 取得事件類別
   * @param {string} eventName - 事件名稱
   * @returns {string} 事件類別
   */
  getEventCategory(eventName) {
    const { domain } = this.parseEventName(eventName)
    
    const categoryMapping = {
      'SYSTEM': 'SYSTEM',
      'SECURITY': 'SYSTEM',
      'EXTRACTION': 'BUSINESS',
      'DATA': 'BUSINESS',
      'UX': 'UI',
      'PLATFORM': 'PLATFORM',
      'MESSAGING': 'BUSINESS',
      'ANALYTICS': 'BUSINESS'
    }
    
    return categoryMapping[domain] || 'BUSINESS'
  }

  /**
   * 生成事件描述
   * @param {Object} parts - 事件各部分
   * @returns {string} 事件描述
   */
  generateEventDescription(parts) {
    return `${parts.domain} domain ${parts.action} operation on ${parts.platform} platform - ${parts.state}`
  }

  /**
   * 提供命名建議
   * @param {string} invalidEventName - 無效事件名稱
   * @returns {Array<string>} 建議列表
   */
  suggestCorrections(invalidEventName) {
    const suggestions = []
    
    // 處理舊格式轉換
    if (invalidEventName.split('.').length === 3) {
      const [module, action, state] = invalidEventName.split('.')
      if (module === 'EXTRACTION') {
        suggestions.push(`EXTRACTION.READMOO.${action}.${state}`)
      }
    }
    
    // 處理拼寫錯誤
    const similarEvents = this.findSimilarEvents(invalidEventName)
    suggestions.push(...similarEvents)
    
    return [...new Set(suggestions)] // 去除重複
  }

  /**
   * 尋找相似事件
   * @param {string} eventName - 事件名稱
   * @returns {Array<string>} 相似事件列表
   */
  findSimilarEvents(eventName) {
    const similarities = []
    
    // 簡單的字串相似度比較
    const allPossibleEvents = this.generateCommonEvents()
    
    allPossibleEvents.forEach(possibleEvent => {
      if (this.calculateSimilarity(eventName, possibleEvent) > 0.7) {
        similarities.push(possibleEvent)
      }
    })
    
    return similarities
  }

  /**
   * 生成常見事件列表
   * @returns {Array<string>} 常見事件列表
   */
  generateCommonEvents() {
    return [
      'EXTRACTION.READMOO.EXTRACT.COMPLETED',
      'DATA.READMOO.SAVE.COMPLETED',
      'UX.GENERIC.OPEN.COMPLETED',
      'PLATFORM.READMOO.DETECT.COMPLETED',
      'SYSTEM.GENERIC.INIT.COMPLETED'
    ]
  }

  /**
   * 計算字串相似度
   * @param {string} str1 - 字串1
   * @param {string} str2 - 字串2
   * @returns {number} 相似度 (0-1)
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * 計算編輯距離
   * @param {string} str1 - 字串1
   * @param {string} str2 - 字串2
   * @returns {number} 編輯距離
   */
  levenshteinDistance(str1, str2) {
    const matrix = []
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  /**
   * 記錄事件使用
   * @param {string} eventName - 事件名稱
   */
  recordEventUsage(eventName) {
    this.usageStats.totalEvents++
    
    if (!this.usageStats.eventUsage.has(eventName)) {
      this.usageStats.eventUsage.set(eventName, 0)
      this.usageStats.uniqueEvents++
    }
    
    this.usageStats.eventUsage.set(eventName, this.usageStats.eventUsage.get(eventName) + 1)
    
    // 更新分佈統計
    try {
      const { domain, platform } = this.parseEventName(eventName)
      
      if (!this.usageStats.domainDistribution[domain]) {
        this.usageStats.domainDistribution[domain] = 0
      }
      this.usageStats.domainDistribution[domain]++
      
      if (!this.usageStats.platformDistribution[platform]) {
        this.usageStats.platformDistribution[platform] = 0
      }
      this.usageStats.platformDistribution[platform]++
    } catch (error) {
      // 無效事件名稱，跳過分佈統計
    }
  }

  /**
   * 記錄驗證錯誤
   * @param {string} errorType - 錯誤類型
   */
  recordValidationError(errorType) {
    this.validationErrors.totalErrors++
    
    if (!this.validationErrors.errorTypes[errorType]) {
      this.validationErrors.errorTypes[errorType] = 0
    }
    this.validationErrors.errorTypes[errorType]++
  }

  /**
   * 取得使用統計
   * @returns {Object} 使用統計
   */
  getUsageStats() {
    const mostUsedEvents = Array.from(this.usageStats.eventUsage.entries())
      .map(([eventName, count]) => ({ eventName, count }))
      .sort((a, b) => b.count - a.count)
    
    return {
      totalEvents: this.usageStats.totalEvents,
      uniqueEvents: this.usageStats.uniqueEvents,
      mostUsedEvents
    }
  }

  /**
   * 取得領域分佈
   * @returns {Object} 領域分佈
   */
  getDomainDistribution() {
    return { ...this.usageStats.domainDistribution }
  }

  /**
   * 取得平台分佈
   * @returns {Object} 平台分佈
   */
  getPlatformDistribution() {
    return { ...this.usageStats.platformDistribution }
  }

  /**
   * 取得驗證錯誤統計
   * @returns {Object} 錯誤統計
   */
  getValidationErrorStats() {
    return { ...this.validationErrors }
  }
}

module.exports = EventTypeDefinitions