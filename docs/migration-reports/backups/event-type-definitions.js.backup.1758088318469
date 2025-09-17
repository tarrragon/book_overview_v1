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
const { StandardError } = require('src/core/errors/StandardError')

const EVENT_TYPE_CONFIG = {
  // 領域定義
  DOMAINS: [
    'SYSTEM', // 系統管理領域
    'PLATFORM', // 平台管理領域
    'EXTRACTION', // 資料提取領域
    'DATA', // 資料管理領域
    'MESSAGING', // 通訊訊息領域
    'PAGE', // 頁面管理領域
    'UX', // 使用者體驗領域
    'SECURITY', // 安全驗證領域
    'ANALYTICS' // 分析統計領域
  ],

  // 平台定義
  PLATFORMS: [
    'READMOO', // Readmoo 平台
    'KINDLE', // Amazon Kindle
    'KOBO', // 樂天 Kobo
    'BOOKS_COM', // 博客來
    'BOOKWALKER', // BookWalker
    'UNIFIED', // 跨平台統一操作
    'MULTI', // 多平台協調操作
    'GENERIC' // 平台無關操作
  ],

  // 動作定義
  ACTIONS: [
    'INIT', 'START', 'STOP', 'EXTRACT', 'SAVE', 'LOAD',
    'DETECT', 'SWITCH', 'VALIDATE', 'PROCESS', 'SYNC',
    'OPEN', 'CLOSE', 'UPDATE', 'DELETE', 'CREATE', 'RENDER'
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
  EXTRACTION: ['READMOO', 'KINDLE', 'KOBO', 'BOOKS_COM', 'BOOKWALKER'],
  DATA: ['READMOO', 'KINDLE', 'KOBO', 'BOOKS_COM', 'BOOKWALKER', 'UNIFIED'],
  UX: ['GENERIC'],
  SYSTEM: ['GENERIC'],
  PLATFORM: ['READMOO', 'KINDLE', 'KOBO', 'BOOKS_COM', 'BOOKWALKER', 'UNIFIED', 'MULTI'],
  MESSAGING: ['READMOO', 'KINDLE', 'KOBO', 'BOOKS_COM', 'BOOKWALKER', 'GENERIC'],
  ANALYTICS: ['GENERIC', 'UNIFIED'],
  SECURITY: ['GENERIC']
}

/**
 * 平台與動作對應關係
 */
const PLATFORM_ACTION_MAPPING = {
  READMOO: ['EXTRACT', 'SAVE', 'LOAD', 'DETECT', 'VALIDATE'],
  KINDLE: ['EXTRACT', 'SAVE', 'LOAD', 'DETECT', 'VALIDATE'],
  KOBO: ['EXTRACT', 'SAVE', 'LOAD', 'DETECT', 'VALIDATE'],
  BOOKS_COM: ['EXTRACT', 'SAVE', 'LOAD', 'DETECT', 'VALIDATE'],
  BOOKWALKER: ['EXTRACT', 'SAVE', 'LOAD', 'DETECT', 'VALIDATE'],
  UNIFIED: ['SYNC', 'PROCESS', 'VALIDATE', 'UPDATE'],
  MULTI: ['SYNC', 'PROCESS', 'VALIDATE', 'UPDATE'],
  GENERIC: ['INIT', 'START', 'STOP', 'OPEN', 'CLOSE', 'UPDATE', 'CREATE', 'DELETE', 'RENDER']
}

/**
 * 動作與狀態對應關係
 */
const ACTION_STATE_MAPPING = {
  EXTRACT: ['REQUESTED', 'STARTED', 'PROGRESS', 'COMPLETED', 'FAILED'],
  SAVE: ['REQUESTED', 'STARTED', 'COMPLETED', 'FAILED'],
  LOAD: ['REQUESTED', 'STARTED', 'COMPLETED', 'FAILED'],
  DETECT: ['STARTED', 'COMPLETED', 'FAILED'],
  VALIDATE: ['STARTED', 'COMPLETED', 'FAILED'],
  SYNC: ['REQUESTED', 'STARTED', 'PROGRESS', 'COMPLETED', 'FAILED'],
  PROCESS: ['STARTED', 'PROGRESS', 'COMPLETED', 'FAILED'],
  INIT: ['STARTED', 'COMPLETED', 'FAILED'],
  OPEN: ['REQUESTED', 'COMPLETED', 'FAILED'],
  CLOSE: ['REQUESTED', 'COMPLETED', 'FAILED'],
  RENDER: ['REQUESTED', 'STARTED', 'COMPLETED', 'FAILED']
}

class EventTypeDefinitions {
  constructor () {
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
  initializeUsageStats () {
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
  initializeValidationErrors () {
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
  isValidEventName (eventName) {
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
  parseEventName (eventName) {
    const parts = eventName.split('.')
    if (parts.length !== 4) {
      throw new StandardError('INVALID_DATA_FORMAT', 'Invalid event name format', {
        category: 'general'
      })
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
  isValidDomain (domain) {
    return this.domains.includes(domain)
  }

  /**
   * 驗證平台是否有效
   * @param {string} platform - 平台名稱
   * @returns {boolean} 是否有效
   */
  isValidPlatform (platform) {
    return this.platforms.includes(platform)
  }

  /**
   * 驗證動作是否有效
   * @param {string} action - 動作名稱
   * @returns {boolean} 是否有效
   */
  isValidAction (action) {
    return this.actions.includes(action)
  }

  /**
   * 驗證狀態是否有效
   * @param {string} state - 狀態名稱
   * @returns {boolean} 是否有效
   */
  isValidState (state) {
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
  buildEventName (domain, platform, action, state) {
    if (!this.isValidDomain(domain)) {
      throw new StandardError('INVALID_DATA_FORMAT', 'Invalid domain', {
        category: 'general'
      })
    }
    if (!this.isValidPlatform(platform)) {
      throw new StandardError('INVALID_DATA_FORMAT', 'Invalid platform', {
        category: 'general'
      })
    }
    if (!this.isValidAction(action)) {
      throw new StandardError('INVALID_DATA_FORMAT', 'Invalid action', {
        category: 'general'
      })
    }
    if (!this.isValidState(state)) {
      throw new StandardError('INVALID_DATA_FORMAT', 'Invalid state', {
        category: 'general'
      })
    }

    return `${domain}.${platform}.${action}.${state}`
  }

  /**
   * 建構部分事件名稱
   * @param {string} domain - 領域
   * @param {string} platform - 平台
   * @returns {string} 部分事件名稱
   */
  buildPartialEventName (domain, platform) {
    return `${domain}.${platform}`
  }

  /**
   * 根據領域取得相關平台
   * @param {string} domain - 領域
   * @returns {Array<string>} 平台列表
   */
  getPlatformsForDomain (domain) {
    return DOMAIN_PLATFORM_MAPPING[domain] || []
  }

  /**
   * 根據平台取得相關動作
   * @param {string} platform - 平台
   * @returns {Array<string>} 動作列表
   */
  getActionsForPlatform (platform) {
    return PLATFORM_ACTION_MAPPING[platform] || []
  }

  /**
   * 根據動作取得相關狀態
   * @param {string} action - 動作
   * @returns {Array<string>} 狀態列表
   */
  getStatesForAction (action) {
    return ACTION_STATE_MAPPING[action] || []
  }

  /**
   * 取得事件定義
   * @param {string} eventName - 事件名稱
   * @returns {Object} 事件定義
   */
  getEventDefinition (eventName) {
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
  getEventCategory (eventName) {
    const { domain } = this.parseEventName(eventName)

    const categoryMapping = {
      SYSTEM: 'SYSTEM',
      SECURITY: 'SYSTEM',
      EXTRACTION: 'BUSINESS',
      DATA: 'BUSINESS',
      UX: 'UI',
      PLATFORM: 'PLATFORM',
      MESSAGING: 'BUSINESS',
      ANALYTICS: 'BUSINESS'
    }

    return categoryMapping[domain] || 'BUSINESS'
  }

  /**
   * 生成事件描述
   * @param {Object} parts - 事件各部分
   * @returns {string} 事件描述
   */
  generateEventDescription (parts) {
    return `${parts.domain} domain ${parts.action} operation on ${parts.platform} platform - ${parts.state}`
  }

  /**
   * 提供命名建議
   * @param {string} invalidEventName - 無效事件名稱
   * @returns {Array<string>} 建議列表
   */
  suggestCorrections (invalidEventName) {
    const suggestions = []

    // 處理舊格式轉換（3 部分格式）
    if (invalidEventName.split('.').length === 3) {
      const [module, action, state] = invalidEventName.split('.')
      if (module === 'EXTRACTION') {
        suggestions.push(`EXTRACTION.READMOO.${action}.${state}`)
        suggestions.push(`EXTRACTION.KINDLE.${action}.${state}`)
        suggestions.push(`EXTRACTION.KOBO.${action}.${state}`)
      }
    }

    // 處理無效格式（例如只有3個部分或無效部分）
    const parts = invalidEventName.split('.')
    if (parts.length === 3) {
      const [firstPart, secondPart, thirdPart] = parts

      // 假設是缺少平台的情況
      if (this.isValidDomain(firstPart) && this.isValidAction(secondPart) && this.isValidState(thirdPart)) {
        const validPlatforms = this.getPlatformsForDomain(firstPart)
        validPlatforms.forEach(platform => {
          suggestions.push(`${firstPart}.${platform}.${secondPart}.${thirdPart}`)
        })
      }
    }

    // 處理無效平台名稱
    if (parts.length === 4) {
      const [domain, platform, action, state] = parts
      if (this.isValidDomain(domain) && !this.isValidPlatform(platform) && this.isValidAction(action) && this.isValidState(state)) {
        const validPlatforms = this.getPlatformsForDomain(domain)
        validPlatforms.forEach(validPlatform => {
          suggestions.push(`${domain}.${validPlatform}.${action}.${state}`)
        })
      }
    }

    // 處理一般格式錯誤，提供常見的有效事件
    if (suggestions.length === 0) {
      const commonEvents = this.generateCommonEvents()
      const similarEvents = this.findSimilarEvents(invalidEventName)

      // 如果沒找到相似事件，提供一些常見事件作為參考
      if (similarEvents.length === 0) {
        suggestions.push(...commonEvents.slice(0, 3)) // 前三個常見事件
      } else {
        suggestions.push(...similarEvents)
      }
    }

    return [...new Set(suggestions)] // 去除重複
  }

  /**
   * 尋找相似事件
   * @param {string} eventName - 事件名稱
   * @returns {Array<string>} 相似事件列表
   */
  findSimilarEvents (eventName) {
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
  generateCommonEvents () {
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
  calculateSimilarity (str1, str2) {
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
  levenshteinDistance (str1, str2) {
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
  recordEventUsage (eventName) {
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
  recordValidationError (errorType) {
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
  getUsageStats () {
    const mostUsedEvents = Array.from(this.usageStats.eventUsage.entries())
      .map(([eventName, count]) => ({ eventName, count }))
      .sort((a, b) => b.count - a.count)

    // 為測試相容性，返回事件計數對應表
    const eventCounts = {}
    this.usageStats.eventUsage.forEach((count, eventName) => {
      eventCounts[eventName] = count
    })

    return {
      totalEvents: this.usageStats.totalEvents,
      uniqueEvents: this.usageStats.uniqueEvents,
      mostUsedEvents,
      ...eventCounts // 展開事件計數，以便測試可以直接存取 stats[eventName]
    }
  }

  /**
   * 取得領域分佈
   * @returns {Object} 領域分佈
   */
  getDomainDistribution () {
    return { ...this.usageStats.domainDistribution }
  }

  /**
   * 取得平台分佈
   * @returns {Object} 平台分佈
   */
  getPlatformDistribution () {
    return { ...this.usageStats.platformDistribution }
  }

  /**
   * 取得驗證錯誤統計
   * @returns {Object} 錯誤統計
   */
  getValidationErrorStats () {
    return { ...this.validationErrors }
  }

  /**
   * 分析事件模式
   * @returns {Object} 分析結果
   */
  analyzeEventPatterns () {
    const totalEvents = this.usageStats.totalEvents
    const domainPatterns = {}
    const platformPatterns = {}
    const actionPatterns = {}
    const statePatterns = {}

    // 分析事件模式
    this.usageStats.eventUsage.forEach((count, eventName) => {
      try {
        const { domain, platform, action, state } = this.parseEventName(eventName)

        // 計算各部分的使用頻率
        domainPatterns[domain] = (domainPatterns[domain] || 0) + count
        platformPatterns[platform] = (platformPatterns[platform] || 0) + count
        actionPatterns[action] = (actionPatterns[action] || 0) + count
        statePatterns[state] = (statePatterns[state] || 0) + count
      } catch (error) {
        // 跳過無效事件
      }
    })

    return {
      totalEvents,
      uniquePatterns: this.usageStats.uniqueEvents,
      domainDistribution: domainPatterns,
      platformDistribution: platformPatterns,
      actionDistribution: actionPatterns,
      stateDistribution: statePatterns,
      recommendedPatterns: this.generateRecommendedPatterns(domainPatterns, platformPatterns),
      analysisDate: new Date().toISOString()
    }
  }

  /**
   * 生成推薦模式
   * @param {Object} domainPatterns - 領域模式
   * @param {Object} platformPatterns - 平台模式
   * @returns {Array} 推薦模式列表
   */
  generateRecommendedPatterns (domainPatterns, platformPatterns) {
    const recommendations = []

    // 基於最常用的領域和平台組合推薦
    const topDomains = Object.entries(domainPatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([domain]) => domain)

    const topPlatforms = Object.entries(platformPatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([platform]) => platform)

    topDomains.forEach(domain => {
      topPlatforms.forEach(platform => {
        if (this.getPlatformsForDomain(domain).includes(platform)) {
          recommendations.push(`${domain}.${platform}.*.*`)
        }
      })
    })

    return recommendations
  }

  /**
   * 檢測事件命名錯誤
   * @param {string} eventName - 事件名稱
   * @returns {Array} 錯誤訊息列表
   */
  detectNamingErrors (eventName) {
    const errors = []

    // 基本格式檢查
    if (!eventName || typeof eventName !== 'string') {
      errors.push('事件名稱格式錯誤：必須是非空字串')
      return errors
    }

    // 檢查常見分隔符錯誤
    if (eventName.includes('_')) {
      errors.push('事件命名格式錯誤：不應使用底線分隔符，請使用點號分隔')
    }
    if (eventName.includes('-')) {
      errors.push('事件命名格式錯誤：不應使用破折號分隔符，請使用點號分隔')
    }
    if (eventName.includes(' ')) {
      errors.push('事件命名格式錯誤：不應使用空格分隔符，請使用點號分隔')
    }

    // 檢查大小寫
    if (eventName !== eventName.toUpperCase()) {
      errors.push('事件命名格式錯誤：所有字母必須為大寫')
    }

    const parts = eventName.split('.')

    // 結構檢查
    if (parts.length !== 4) {
      errors.push(`事件命名格式錯誤：必須有4個部分 (DOMAIN.PLATFORM.ACTION.STATE)，目前有${parts.length}個部分`)
    }

    if (parts.length >= 1) {
      // 領域檢查
      if (!this.isValidDomain(parts[0])) {
        errors.push(`無效的領域名稱：${parts[0]}，請使用有效的領域名稱`)
      }
    }

    if (parts.length >= 2) {
      // 平台檢查
      if (!this.isValidPlatform(parts[1])) {
        errors.push(`無效的平台名稱：${parts[1]}，請使用有效的平台名稱`)
      }
    }

    if (parts.length >= 3) {
      // 動作檢查
      if (!this.isValidAction(parts[2])) {
        const suggestions = this.actions.filter(a => a.includes(parts[2]) || parts[2].includes(a))
        if (suggestions.length > 0) {
          errors.push(`動作拼寫錯誤：${parts[2]}，建議使用：${suggestions.join(', ')}`)
        } else {
          errors.push(`無效的動作名稱：${parts[2]}，請使用標準動作名稱`)
        }
      }
    }

    if (parts.length >= 4) {
      // 狀態檢查
      if (!this.isValidState(parts[3])) {
        const suggestions = this.states.filter(s => s.includes(parts[3]) || parts[3].includes(s))
        if (suggestions.length > 0) {
          errors.push(`狀態拼寫錯誤：${parts[3]}，建議使用：${suggestions.join(', ')}`)
        } else {
          errors.push(`無效的狀態名稱：${parts[3]}，請使用標準狀態名稱`)
        }
      }
    }

    return errors
  }

  /**
   * 取得事件命名最佳實踐建議
   * @returns {Object} 最佳實踐指南
   */
  getEventNamingBestPractices () {
    return {
      rules: [
        '使用4層級命名結構 - 事件名稱必須遵循 DOMAIN.PLATFORM.ACTION.STATE 的四層結構',
        '使用大寫字母 - 所有部分都應該使用大寫字母，單字間用底線分隔',
        '選擇適當的領域 - 根據功能性質選擇最適合的領域',
        '確保平台相容性 - 選擇的平台必須與領域相容',
        '使用標準動作 - 使用預定義的標準動作，避免自創動作名稱',
        '選擇適當的狀態 - 根據動作類型選擇相應的狀態'
      ],
      antiPatterns: [
        '只有三個部分 - 缺少平台資訊',
        '使用小寫字母 - 必須使用大寫字母',
        '不相容的組合 - UX 領域不適用於資料提取操作'
      ],
      checklist: [
        '事件名稱有四個部分嗎？',
        '所有部分都是大寫字母嗎？',
        '領域選擇是否正確？',
        '平台與領域相容嗎？',
        '動作是標準動作嗎？',
        '狀態與動作相匹配嗎？'
      ]
    }
  }

  /**
   * 取得領域描述
   * @param {string} domain - 領域名稱
   * @returns {string} 領域描述
   */
  getDomainDescription (domain) {
    const descriptions = {
      SYSTEM: '系統管理和核心功能',
      PLATFORM: '平台檢測和切換管理',
      EXTRACTION: '資料提取和處理',
      DATA: '資料儲存和管理',
      MESSAGING: '跨組件通訊',
      PAGE: '頁面和內容管理',
      UX: '使用者介面和體驗',
      SECURITY: '安全驗證和授權',
      ANALYTICS: '分析統計和監控'
    }
    return descriptions[domain] || '未定義領域'
  }
}

module.exports = EventTypeDefinitions
