/**
 * EventPriorityManager - 事件優先級管理器
 * 負責 v2.0 事件優先級系統管理和最佳化
 *
 * 負責功能：
 * - v2.0 事件優先級分配和管理
 * - 智能優先級推斷和分類
 * - 優先級衝突檢測和解決
 * - 效能最佳化和統計監控
 *
 * 設計考量：
 * - 基於 4-Layer 架構的優先級系統
 * - 智能推斷事件優先級類別
 * - 支援動態調整和最佳化
 * - 完整的統計和監控功能
 *
 * 處理流程：
 * 1. 分析事件名稱，推斷適當的優先級類別
 * 2. 分配具體的優先級數值
 * 3. 檢測和解決優先級衝突
 * 4. 記錄統計並提供最佳化建議
 *
 * 使用情境：
 * - 確保系統關鍵事件的優先處理
 * - 最佳化使用者體驗響應速度
 * - 維護系統穩定性和效能
 */

/**
 * v2.0 事件優先級架構配置
 */
const PRIORITY_CONFIG = {
  // 系統關鍵 (0-99)
  SYSTEM_CRITICAL: {
    range: [0, 99],
    examples: [
      'SYSTEM.GENERIC.ERROR.CRITICAL',
      'SECURITY.GENERIC.VIOLATION.DETECTED',
      'PLATFORM.GENERIC.FAILURE.CRITICAL'
    ],
    keywords: ['ERROR', 'CRITICAL', 'SECURITY', 'FAILURE', 'URGENT'],
    description: '系統關鍵事件（錯誤處理、安全警告）'
  },

  // 平台管理 (100-199)
  PLATFORM_MANAGEMENT: {
    range: [100, 199],
    examples: [
      'PLATFORM.READMOO.SWITCH.STARTED',
      'PLATFORM.KINDLE.DETECT.COMPLETED',
      'PLATFORM.UNIFIED.SYNC.REQUESTED'
    ],
    keywords: ['PLATFORM', 'DETECT', 'SWITCH', 'SYNC'],
    description: '平台管理事件'
  },

  // 使用者互動 (200-299)
  USER_INTERACTION: {
    range: [200, 299],
    examples: [
      'UX.GENERIC.OPEN.STARTED',
      'EXTRACTION.READMOO.EXTRACT.REQUESTED',
      'DATA.READMOO.SAVE.REQUESTED'
    ],
    keywords: ['UX', 'UI', 'USER', 'CLICK', 'OPEN', 'CLOSE', 'REQUESTED'],
    description: '使用者互動事件（UI 響應、即時反饋）'
  },

  // 一般業務處理 (300-399)
  BUSINESS_PROCESSING: {
    range: [300, 399],
    examples: [
      'EXTRACTION.READMOO.EXTRACT.PROGRESS',
      'DATA.READMOO.VALIDATE.COMPLETED',
      'MESSAGING.READMOO.FORWARD.COMPLETED'
    ],
    keywords: ['EXTRACT', 'VALIDATE', 'PROCESS', 'SAVE', 'LOAD', 'COMPLETED'],
    description: '一般業務處理事件（資料處理、儲存操作）'
  },

  // 背景處理 (400-499)
  BACKGROUND_PROCESSING: {
    range: [400, 499],
    examples: [
      'ANALYTICS.GENERIC.UPDATE.COMPLETED',
      'SYSTEM.GENERIC.CLEANUP.STARTED',
      'DATA.GENERIC.SYNC.PROGRESS'
    ],
    keywords: ['ANALYTICS', 'LOG', 'CLEANUP', 'SYNC', 'BACKGROUND'],
    description: '背景處理事件（統計分析、日誌記錄）'
  }
}

class EventPriorityManager {
  constructor () {
    this.priorityConfig = PRIORITY_CONFIG
    this.eventPriorities = new Map() // 事件名稱 -> 優先級
    this.priorityHistory = new Map() // 事件名稱 -> 優先級變更歷史
    this.performanceMetrics = new Map() // 事件名稱 -> 效能指標
    this.priorityStats = this.initializePriorityStats()
  }

  /**
   * 初始化優先級統計
   * @returns {Object} 統計對象
   */
  initializePriorityStats () {
    return {
      totalAssignments: 0,
      priorityDistribution: {},
      avgAssignmentTime: 0,
      errors: 0,
      optimizations: 0
    }
  }

  /**
   * 為事件分配優先級
   * @param {string} eventName - 事件名稱
   * @returns {number} 分配的優先級
   */
  assignEventPriority (eventName) {
    const startTime = performance.now()

    try {
      // 驗證事件名稱並優雅處理無效情況
      if (!eventName || typeof eventName !== 'string') {
        this.priorityStats.errors++
        const endTime = performance.now()
        this.updateAssignmentTime(endTime - startTime)
        // 優雅處理：返回最低優先級而非拋出異常
        console.warn(`EventPriorityManager: Invalid event name "${eventName}", assigning lowest priority`)
        return 999 // 最低優先級
      }

      // 檢查是否已有分配的優先級
      if (this.eventPriorities.has(eventName)) {
        return this.eventPriorities.get(eventName)
      }

      // 推斷優先級類別
      const category = this.inferPriorityCategory(eventName)
      const priority = this.generatePriorityInCategory(category)

      // 記錄分配
      this.eventPriorities.set(eventName, priority)
      this.recordPriorityHistory(eventName, priority, 'ASSIGNED')

      // 更新統計
      this.updatePriorityStats(category)
      this.priorityStats.totalAssignments++

      return priority
    } catch (error) {
      // 如果是我們拋出的驗證錯誤，重新拋出
      if (error.message === 'Invalid event name') {
        throw error
      }
      // 其他意外錯誤才返回預設優先級
      this.priorityStats.errors++
      return this.priorityConfig.BUSINESS_PROCESSING.range[1]
    } finally {
      const endTime = performance.now()
      this.updateAssignmentTime(endTime - startTime)
    }
  }

  /**
   * 推斷事件的優先級類別
   * @param {string} eventName - 事件名稱
   * @returns {string} 優先級類別
   */
  inferPriorityCategory (eventName) {
    const upperEventName = eventName.toUpperCase()

    // 首先根據領域檢查特殊情況（最高優先級）
    const parts = eventName.split('.')
    if (parts.length >= 1) {
      const domain = parts[0]

      // ANALYTICS 領域始終是 BACKGROUND_PROCESSING
      if (domain === 'ANALYTICS') {
        return 'BACKGROUND_PROCESSING'
      }
    }

    // 然後檢查關鍵字的重要性 - CRITICAL、ERROR、FAILURE 等優先
    const highPriorityKeywords = ['ERROR', 'CRITICAL', 'SECURITY', 'FAILURE', 'URGENT']
    if (highPriorityKeywords.some(keyword => upperEventName.includes(keyword))) {
      return 'SYSTEM_CRITICAL'
    }

    // 檢查其他領域
    if (parts.length >= 1) {
      const domain = parts[0]

      if (domain === 'SYSTEM' || domain === 'SECURITY') {
        // SYSTEM 領域的 CLEANUP 等背景工作是 BACKGROUND_PROCESSING
        if (['CLEANUP', 'LOG', 'BACKGROUND', 'SYNC'].some(keyword => upperEventName.includes(keyword))) {
          return 'BACKGROUND_PROCESSING'
        }
        return 'SYSTEM_CRITICAL'
      }
      if (domain === 'PLATFORM') {
        return 'PLATFORM_MANAGEMENT'
      }
      if (domain === 'UX' || domain === 'UI') {
        return 'USER_INTERACTION'
      }
    }

    // 檢查背景處理關鍵字優先（避免被其他類別搶先匹配）
    const backgroundKeywords = ['ANALYTICS', 'LOG', 'CLEANUP', 'SYNC', 'BACKGROUND']
    if (backgroundKeywords.some(keyword => upperEventName.includes(keyword))) {
      return 'BACKGROUND_PROCESSING'
    }

    // 然後按優先級順序檢查剩餘關鍵字
    const categoryOrder = [
      'PLATFORM_MANAGEMENT', 
      'USER_INTERACTION',
      'BUSINESS_PROCESSING'
    ]

    for (const category of categoryOrder) {
      const config = this.priorityConfig[category]
      if (config.keywords.some(keyword => upperEventName.includes(keyword))) {
        return category
      }
    }

    // 預設類別
    return 'BUSINESS_PROCESSING'
  }

  /**
   * 在指定類別中生成優先級
   * @param {string} category - 優先級類別
   * @returns {number} 生成的優先級
   */
  generatePriorityInCategory (category) {
    const config = this.priorityConfig[category]
    if (!config) {
      throw new Error(`Invalid priority category: ${category}`)
    }

    const [min, max] = config.range
    // 在類別範圍內選擇中間值
    return Math.floor((min + max) / 2)
  }

  /**
   * 調整事件優先級
   * @param {string} eventName - 事件名稱
   * @param {number} newPriority - 新優先級
   */
  adjustEventPriority (eventName, newPriority) {
    if (!this.isValidPriority(newPriority)) {
      this.priorityStats.errors++
      throw new Error('Invalid priority value')
    }

    const oldPriority = this.eventPriorities.get(eventName)
    this.eventPriorities.set(eventName, newPriority)
    this.recordPriorityHistory(eventName, newPriority, 'ADJUSTED', oldPriority)
  }

  /**
   * 取得事件優先級
   * @param {string} eventName - 事件名稱
   * @returns {number|undefined} 事件優先級
   */
  getEventPriority (eventName) {
    return this.eventPriorities.get(eventName)
  }

  /**
   * 取得事件的所有優先級（歷史記錄）
   * @param {string} eventName - 事件名稱
   * @returns {Array<number>} 優先級陣列
   */
  getEventPriorities (eventName) {
    const history = this.priorityHistory.get(eventName) || []
    return history.map(record => record.priority)
  }

  /**
   * 驗證優先級是否有效
   * @param {number} priority - 優先級
   * @returns {boolean} 是否有效
   */
  isValidPriority (priority) {
    return typeof priority === 'number' && priority >= 0 && priority < 500
  }

  /**
   * 驗證優先級是否在指定類別範圍內
   * @param {number} priority - 優先級
   * @param {string} category - 類別
   * @returns {boolean} 是否在範圍內
   */
  isPriorityInCategory (priority, category) {
    const config = this.priorityConfig[category]
    if (!config) return false

    const [min, max] = config.range
    return priority >= min && priority <= max
  }

  /**
   * 檢測優先級衝突
   * @returns {Array} 衝突列表
   */
  detectPriorityConflicts () {
    const conflicts = []
    const eventConflicts = new Map()

    // 檢查相同事件的不同優先級分配
    for (const [eventName, history] of this.priorityHistory.entries()) {
      const uniquePriorities = [...new Set(history.map(record => record.priority))]
      if (uniquePriorities.length > 1) {
        conflicts.push({
          eventName,
          priorities: uniquePriorities
        })
      }
    }

    return conflicts
  }

  /**
   * 最佳化事件優先級
   */
  optimizeEventPriorities () {
    // 移除重複的優先級分配
    for (const [eventName, history] of this.priorityHistory.entries()) {
      if (history.length > 1) {
        const latestPriority = history[history.length - 1].priority
        this.eventPriorities.set(eventName, latestPriority)
        this.priorityHistory.set(eventName, [history[history.length - 1]])
      }
    }

    this.priorityStats.optimizations++
  }

  /**
   * 根據效能統計最佳化優先級
   */
  optimizeBasedOnPerformance () {
    for (const [eventName, metrics] of this.performanceMetrics.entries()) {
      let currentPriority = this.getEventPriority(eventName)
      
      // 如果事件沒有優先級，先分配一個
      if (currentPriority === undefined) {
        currentPriority = this.assignEventPriority(eventName)
      }
      
      if (metrics.avgExecutionTime > 300) { // 300ms 被認為是慢的
        if (currentPriority < 400) {
          // 調低優先級（增加數值）
          this.adjustEventPriority(eventName, Math.min(currentPriority + 50, 450))
        }
      }
    }
  }

  /**
   * 記錄效能指標
   * @param {string} eventName - 事件名稱
   * @param {Object} metrics - 效能指標
   */
  recordPerformanceMetrics (eventName, metrics) {
    this.performanceMetrics.set(eventName, metrics)
  }

  /**
   * 記錄事件優先級（用於測試衝突檢測）
   * @param {string} eventName - 事件名稱
   * @param {number} priority - 優先級
   */
  recordEventPriority (eventName, priority) {
    this.eventPriorities.set(eventName, priority)
    this.recordPriorityHistory(eventName, priority, 'RECORDED')
  }

  /**
   * 與 EventBus 整合註冊
   * @param {Object} eventBus - 事件總線
   * @param {string} eventName - 事件名稱
   * @param {Function} handler - 處理器
   */
  registerWithPriority (eventBus, eventName, handler) {
    const priority = this.assignEventPriority(eventName)
    eventBus.on(eventName, handler, { priority })
  }

  /**
   * 記錄優先級歷史
   * @param {string} eventName - 事件名稱
   * @param {number} priority - 優先級
   * @param {string} action - 操作類型
   * @param {number} oldPriority - 舊優先級
   */
  recordPriorityHistory (eventName, priority, action, oldPriority = null) {
    if (!this.priorityHistory.has(eventName)) {
      this.priorityHistory.set(eventName, [])
    }

    this.priorityHistory.get(eventName).push({
      priority,
      action,
      oldPriority,
      timestamp: Date.now()
    })
  }

  /**
   * 更新優先級統計
   * @param {string} category - 優先級類別
   */
  updatePriorityStats (category) {
    if (!this.priorityStats.priorityDistribution[category]) {
      this.priorityStats.priorityDistribution[category] = 0
    }
    this.priorityStats.priorityDistribution[category]++
  }

  /**
   * 更新分配時間統計
   * @param {number} assignmentTime - 分配時間
   */
  updateAssignmentTime (assignmentTime) {
    const totalAssignments = this.priorityStats.totalAssignments
    const currentAvg = this.priorityStats.avgAssignmentTime
    this.priorityStats.avgAssignmentTime =
      ((currentAvg * totalAssignments) + assignmentTime) / (totalAssignments + 1)
  }

  /**
   * 取得優先級統計
   * @returns {Object} 統計資訊
   */
  getPriorityStats () {
    return { ...this.priorityStats }
  }

  /**
   * 取得優先級分佈
   * @returns {Object} 分佈統計
   */
  getPriorityDistribution () {
    return { ...this.priorityStats.priorityDistribution }
  }

  /**
   * 取得優先級歷史
   * @param {string} eventName - 事件名稱
   * @returns {Array} 歷史記錄
   */
  getPriorityHistory (eventName) {
    return this.priorityHistory.get(eventName) || []
  }
}

module.exports = EventPriorityManager
