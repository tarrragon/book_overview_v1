/**
 * @fileoverview Cross Platform Router Service - 跨平台事件路由服務
 * @version v2.0.0
 * @since 2025-08-14
 * 
 * 負責功能：
 * - 跨平台事件路由與訊息分發管理
 * - 平台間協調操作與狀態同步機制
 * - 平台間通訊協議實作與優化
 * - 事件優先級管理與流量控制
 * 
 * 設計考量：
 * - 支援 5 個平台間的複雜協調操作
 * - 高效能事件路由與佇列管理
 * - 故障隔離與自動恢復機制
 * - 可擴展的路由規則配置系統
 * 
 * 處理流程：
 * 1. 初始化路由引擎與通訊協議
 * 2. 建立平台間事件路由表
 * 3. 管理協調操作生命週期
 * 4. 監控路由效能與健康狀態
 * 5. 處理跨平台錯誤與恢復
 * 
 * 使用情境：
 * - Platform Domain Coordinator 進行跨平台協調時
 * - 多平台資料同步與批次處理操作
 * - 平台間狀態廣播與事件分發
 */

class CrossPlatformRouter {
  /**
   * 初始化跨平台路由服務
   * @param {EventBus} eventBus - 事件總線實例
   * @param {Object} config - 服務配置
   */
  constructor(eventBus, config = {}) {
    this.eventBus = eventBus
    this.config = config
    this.logger = config.logger
    this.platformRegistry = config.platformRegistry
    this.adapterFactory = config.adapterFactory
    
    // 路由引擎核心狀態
    this.isInitialized = false
    this.isRouting = false
    this.routingEngineId = `router-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // 路由表與配置
    this.routingTable = new Map()
    this.routingRules = new Map()
    this.platformChannels = new Map()
    
    // 事件佇列管理
    this.eventQueues = new Map()
    this.priorityQueues = new Map()
    this.processingQueues = new Map()
    
    // 協調操作狀態管理
    this.coordinationSessions = new Map()
    this.activeOperations = new Map()
    this.operationHistory = []
    
    // 效能監控與統計
    this.routingStats = {
      totalEventsRouted: 0,
      totalCoordinationOps: 0,
      averageLatency: 0,
      errorCount: 0,
      throughputPerSecond: 0,
      lastStatsReset: Date.now()
    }
    
    // 路由配置
    this.routingConfig = {
      maxConcurrentOps: config.maxConcurrentOps || 10,
      queueTimeoutMs: config.queueTimeoutMs || 30000,
      retryAttempts: config.retryAttempts || 3,
      batchSize: config.batchSize || 5,
      priorityLevels: ['URGENT', 'HIGH', 'NORMAL', 'LOW'],
      enableCircuitBreaker: config.enableCircuitBreaker !== false
    }
    
    // 斷路器狀態
    this.circuitBreakers = new Map()
    
    // 支援的平台
    this.supportedPlatforms = [
      'READMOO', 'KINDLE', 'KOBO', 'BOOKWALKER', 'BOOKS_COM'
    ]
    
    // 協調操作類型定義
    this.coordinationOperationTypes = {
      DATA_SYNC: 'data_synchronization',
      BATCH_PROCESSING: 'batch_processing',
      STATE_BROADCAST: 'state_broadcast',
      RESOURCE_SHARING: 'resource_sharing',
      CROSS_PLATFORM_SEARCH: 'cross_platform_search'
    }
  }

  /**
   * 初始化路由服務
   */
  async initialize() {
    try {
      await this.log('開始初始化 Cross Platform Router Service')
      
      // 初始化路由引擎
      await this.initializeRoutingEngine()
      
      // 建立平台路由表
      await this.buildPlatformRoutingTable()
      
      // 初始化事件佇列系統
      await this.initializeEventQueues()
      
      // 設定路由規則
      await this.setupRoutingRules()
      
      // 註冊事件監聽器
      await this.registerEventListeners()
      
      // 初始化斷路器
      await this.initializeCircuitBreakers()
      
      // 啟動路由引擎
      await this.startRoutingEngine()
      
      this.isInitialized = true
      await this.log('Cross Platform Router Service 初始化完成')
      
      // 發送初始化完成事件
      await this.emitEvent('PLATFORM.ROUTER.INITIALIZED', {
        routerId: this.routingEngineId,
        supportedPlatforms: this.supportedPlatforms,
        routingRulesCount: this.routingRules.size,
        operationTypes: Object.keys(this.coordinationOperationTypes),
        timestamp: Date.now()
      })
      
    } catch (error) {
      await this.logError('Cross Platform Router Service 初始化失敗', error)
      throw error
    }
  }

  /**
   * 初始化路由引擎
   */
  async initializeRoutingEngine() {
    // 建立路由表結構
    for (const platform of this.supportedPlatforms) {
      this.routingTable.set(platform, {
        isActive: false,
        channels: new Map(),
        adapter: null,
        lastSeen: null,
        failureCount: 0
      })
    }
    
    await this.log('路由引擎核心結構初始化完成')
  }

  /**
   * 建立平台路由表
   */
  async buildPlatformRoutingTable() {
    // 從平台註冊表建立路由映射
    if (this.platformRegistry) {
      const registeredPlatforms = this.platformRegistry.getAllPlatforms()
      
      for (const [platformId, platformInfo] of registeredPlatforms) {
        if (this.routingTable.has(platformId)) {
          const routeInfo = this.routingTable.get(platformId)
          routeInfo.isActive = platformInfo.isActive || false
          routeInfo.adapter = platformInfo.adapter
          routeInfo.lastSeen = Date.now()
          
          // 建立通訊頻道
          await this.createPlatformChannel(platformId, platformInfo)
        }
      }
    }
    
    await this.log(`平台路由表建立完成，支援 ${this.routingTable.size} 個平台`)
  }

  /**
   * 建立平台通訊頻道
   * @param {string} platformId - 平台標識符
   * @param {Object} platformInfo - 平台資訊
   */
  async createPlatformChannel(platformId, platformInfo) {
    const channelId = `channel-${platformId}-${Date.now()}`
    
    const channel = {
      id: channelId,
      platformId,
      isActive: true,
      messageCount: 0,
      lastActivity: Date.now(),
      errorCount: 0,
      queue: [],
      adapter: platformInfo.adapter
    }
    
    this.platformChannels.set(channelId, channel)
    
    // 更新路由表
    const routeInfo = this.routingTable.get(platformId)
    if (routeInfo) {
      routeInfo.channels.set(channelId, channel)
    }
    
    await this.log(`建立 ${platformId} 平台通訊頻道: ${channelId}`)
  }

  /**
   * 初始化事件佇列系統
   */
  async initializeEventQueues() {
    // 為每個優先級建立佇列
    for (const priority of this.routingConfig.priorityLevels) {
      this.priorityQueues.set(priority, {
        queue: [],
        processing: false,
        maxSize: 1000,
        totalProcessed: 0
      })
    }
    
    // 為每個平台建立事件佇列
    for (const platform of this.supportedPlatforms) {
      this.eventQueues.set(platform, {
        inbound: [],
        outbound: [],
        failed: [],
        totalEvents: 0
      })
    }
    
    await this.log('事件佇列系統初始化完成')
  }

  /**
   * 設定路由規則
   */
  async setupRoutingRules() {
    // 默認路由規則
    const defaultRules = [
      {
        id: 'broadcast_system_events',
        type: 'BROADCAST',
        eventPattern: 'SYSTEM\\..*',
        targetPlatforms: 'ALL',
        priority: 'HIGH'
      },
      {
        id: 'route_platform_specific',
        type: 'DIRECT',
        eventPattern: 'PLATFORM\\.([^.]+)\\..*',
        targetPlatforms: 'MATCH_GROUP_1',
        priority: 'NORMAL'
      },
      {
        id: 'coordinate_data_sync',
        type: 'COORDINATION',
        eventPattern: 'DATA\\.SYNC\\..*',
        targetPlatforms: 'ACTIVE',
        priority: 'HIGH'
      },
      {
        id: 'batch_processing',
        type: 'BATCH',
        eventPattern: 'BATCH\\..*',
        targetPlatforms: 'ACTIVE',
        priority: 'LOW'
      }
    ]
    
    for (const rule of defaultRules) {
      this.routingRules.set(rule.id, {
        ...rule,
        regex: new RegExp(rule.eventPattern),
        createdAt: Date.now(),
        usageCount: 0
      })
    }
    
    await this.log(`路由規則設定完成，共 ${this.routingRules.size} 條規則`)
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners() {
    // 平台事件路由
    this.eventBus.on('PLATFORM.ROUTER.ROUTE_EVENT', 
      this.handleRouteEvent.bind(this))
    
    // 協調操作請求
    this.eventBus.on('PLATFORM.ROUTER.COORDINATE_OPERATION',
      this.handleCoordinationRequest.bind(this))
    
    // 平台狀態變更
    this.eventBus.on('PLATFORM.STATUS.CHANGED',
      this.handlePlatformStatusChange.bind(this))
    
    // 平台連接/斷開事件
    this.eventBus.on('PLATFORM.CONNECTED',
      this.handlePlatformConnected.bind(this))
    this.eventBus.on('PLATFORM.DISCONNECTED',
      this.handlePlatformDisconnected.bind(this))
    
    // 系統事件
    this.eventBus.on('SYSTEM.SHUTDOWN.REQUESTED',
      this.handleSystemShutdown.bind(this))
  }

  /**
   * 初始化斷路器
   */
  async initializeCircuitBreakers() {
    if (!this.routingConfig.enableCircuitBreaker) {
      return
    }
    
    for (const platform of this.supportedPlatforms) {
      this.circuitBreakers.set(platform, {
        state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
        failureCount: 0,
        failureThreshold: 5,
        timeout: 60000,
        lastFailureTime: null,
        successCount: 0
      })
    }
    
    await this.log('斷路器系統初始化完成')
  }

  /**
   * 啟動路由引擎
   */
  async startRoutingEngine() {
    this.isRouting = true
    
    // 啟動佇列處理器
    this.startQueueProcessors()
    
    // 啟動效能監控
    this.startPerformanceMonitoring()
    
    // 啟動健康檢查
    this.startHealthCheck()
    
    await this.log('跨平台路由引擎啟動完成')
  }

  /**
   * 啟動佇列處理器
   */
  startQueueProcessors() {
    // 為每個優先級啟動處理器
    for (const [priority, queueInfo] of this.priorityQueues) {
      setInterval(async () => {
        await this.processPriorityQueue(priority, queueInfo)
      }, 100) // 100ms 間隔處理
    }
    
    // 為每個平台啟動處理器
    for (const [platform, queues] of this.eventQueues) {
      setInterval(async () => {
        await this.processPlatformQueue(platform, queues)
      }, 200) // 200ms 間隔處理
    }
  }

  /**
   * 處理優先級佇列
   * @param {string} priority - 優先級
   * @param {Object} queueInfo - 佇列資訊
   */
  async processPriorityQueue(priority, queueInfo) {
    if (queueInfo.processing || queueInfo.queue.length === 0) {
      return
    }
    
    queueInfo.processing = true
    
    try {
      const batchSize = Math.min(this.routingConfig.batchSize, queueInfo.queue.length)
      const batch = queueInfo.queue.splice(0, batchSize)
      
      for (const eventData of batch) {
        await this.processRouterEvent(eventData)
        queueInfo.totalProcessed++
      }
      
    } catch (error) {
      await this.logError(`處理 ${priority} 優先級佇列失敗`, error)
    } finally {
      queueInfo.processing = false
    }
  }

  /**
   * 處理平台佇列
   * @param {string} platform - 平台標識符
   * @param {Object} queues - 平台佇列
   */
  async processPlatformQueue(platform, queues) {
    // 處理出站佇列
    if (queues.outbound.length > 0) {
      const event = queues.outbound.shift()
      try {
        await this.deliverEventToPlatform(platform, event)
        queues.totalEvents++
      } catch (error) {
        queues.failed.push({
          event,
          error: error.message,
          timestamp: Date.now()
        })
        await this.logError(`投遞事件到 ${platform} 失敗`, error)
      }
    }
  }

  /**
   * 處理路由事件請求
   * @param {Object} event - 路由事件
   */
  async handleRouteEvent(event) {
    try {
      const { eventType, eventData, options } = event.data || {}
      
      await this.routeEvent(eventType, eventData, options)
      
    } catch (error) {
      await this.logError('處理路由事件請求失敗', error)
    }
  }

  /**
   * 路由事件到目標平台
   * @param {string} eventType - 事件類型
   * @param {Object} eventData - 事件資料
   * @param {Object} options - 路由選項
   */
  async routeEvent(eventType, eventData, options = {}) {
    const startTime = Date.now()
    
    try {
      // 尋找匹配的路由規則
      const matchedRules = this.findMatchingRules(eventType)
      
      if (matchedRules.length === 0) {
        await this.log(`沒有找到 ${eventType} 的路由規則`)
        return
      }
      
      // 為每個匹配的規則執行路由
      for (const rule of matchedRules) {
        await this.executeRoutingRule(rule, eventType, eventData, options)
        rule.usageCount++
      }
      
      // 更新統計
      this.routingStats.totalEventsRouted++
      this.updateLatencyStats(Date.now() - startTime)
      
      // 發送路由完成事件
      await this.emitEvent('PLATFORM.ROUTER.EVENT.ROUTED', {
        eventType,
        matchedRules: matchedRules.length,
        latency: Date.now() - startTime,
        timestamp: Date.now()
      })
      
    } catch (error) {
      this.routingStats.errorCount++
      await this.logError(`路由事件 ${eventType} 失敗`, error)
      throw error
    }
  }

  /**
   * 尋找匹配的路由規則
   * @param {string} eventType - 事件類型
   * @returns {Array} 匹配的規則列表
   */
  findMatchingRules(eventType) {
    const matchedRules = []
    
    for (const [ruleId, rule] of this.routingRules) {
      if (rule.regex.test(eventType)) {
        matchedRules.push(rule)
      }
    }
    
    // 按優先級排序
    return matchedRules.sort((a, b) => {
      const priorityOrder = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  }

  /**
   * 執行路由規則
   * @param {Object} rule - 路由規則
   * @param {string} eventType - 事件類型
   * @param {Object} eventData - 事件資料
   * @param {Object} options - 選項
   */
  async executeRoutingRule(rule, eventType, eventData, options) {
    const targetPlatforms = this.resolveTargetPlatforms(rule, eventType)
    
    const routingTask = {
      ruleId: rule.id,
      eventType,
      eventData,
      targetPlatforms,
      priority: rule.priority,
      options,
      timestamp: Date.now(),
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
    
    // 根據路由類型執行不同策略
    switch (rule.type) {
      case 'DIRECT':
        await this.executeDirectRouting(routingTask)
        break
      case 'BROADCAST':
        await this.executeBroadcastRouting(routingTask)
        break
      case 'COORDINATION':
        await this.executeCoordinationRouting(routingTask)
        break
      case 'BATCH':
        await this.executeBatchRouting(routingTask)
        break
      default:
        await this.log(`未知的路由類型: ${rule.type}`)
    }
  }

  /**
   * 解析目標平台
   * @param {Object} rule - 路由規則
   * @param {string} eventType - 事件類型
   * @returns {Array} 目標平台列表
   */
  resolveTargetPlatforms(rule, eventType) {
    switch (rule.targetPlatforms) {
      case 'ALL':
        return this.supportedPlatforms
      case 'ACTIVE':
        return this.getActivePlatforms()
      case 'MATCH_GROUP_1':
        const match = rule.regex.exec(eventType)
        return match && match[1] ? [match[1]] : []
      default:
        if (Array.isArray(rule.targetPlatforms)) {
          return rule.targetPlatforms
        }
        return [rule.targetPlatforms]
    }
  }

  /**
   * 取得活躍平台列表
   * @returns {Array} 活躍平台列表
   */
  getActivePlatforms() {
    const activePlatforms = []
    
    for (const [platform, routeInfo] of this.routingTable) {
      if (routeInfo.isActive && this.isCircuitBreakerClosed(platform)) {
        activePlatforms.push(platform)
      }
    }
    
    return activePlatforms
  }

  /**
   * 檢查斷路器狀態
   * @param {string} platform - 平台標識符
   * @returns {boolean} 是否可用
   */
  isCircuitBreakerClosed(platform) {
    if (!this.routingConfig.enableCircuitBreaker) {
      return true
    }
    
    const breaker = this.circuitBreakers.get(platform)
    if (!breaker) {
      return true
    }
    
    const now = Date.now()
    
    if (breaker.state === 'OPEN') {
      if (now - breaker.lastFailureTime > breaker.timeout) {
        breaker.state = 'HALF_OPEN'
        breaker.successCount = 0
        return true
      }
      return false
    }
    
    return true
  }

  /**
   * 執行直接路由
   * @param {Object} routingTask - 路由任務
   */
  async executeDirectRouting(routingTask) {
    for (const platform of routingTask.targetPlatforms) {
      await this.queueEventForPlatform(platform, routingTask)
    }
  }

  /**
   * 執行廣播路由
   * @param {Object} routingTask - 路由任務
   */
  async executeBroadcastRouting(routingTask) {
    const promises = routingTask.targetPlatforms.map(platform =>
      this.queueEventForPlatform(platform, routingTask)
    )
    
    await Promise.allSettled(promises)
  }

  /**
   * 執行協調路由
   * @param {Object} routingTask - 路由任務
   */
  async executeCoordinationRouting(routingTask) {
    // 建立協調會話
    const sessionId = await this.createCoordinationSession(routingTask)
    
    try {
      // 並行發送到所有目標平台
      const promises = routingTask.targetPlatforms.map(platform =>
        this.sendCoordinatedEvent(platform, routingTask, sessionId)
      )
      
      const results = await Promise.allSettled(promises)
      
      // 收集結果
      await this.collectCoordinationResults(sessionId, results)
      
    } catch (error) {
      await this.logError(`協調路由失敗: ${sessionId}`, error)
    } finally {
      await this.closeCoordinationSession(sessionId)
    }
  }

  /**
   * 執行批次路由
   * @param {Object} routingTask - 路由任務
   */
  async executeBatchRouting(routingTask) {
    // 加入批次佇列
    const priorityQueue = this.priorityQueues.get(routingTask.priority)
    if (priorityQueue) {
      priorityQueue.queue.push(routingTask)
    }
  }

  /**
   * 建立協調會話
   * @param {Object} routingTask - 路由任務
   * @returns {string} 會話ID
   */
  async createCoordinationSession(routingTask) {
    const sessionId = `coord-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const session = {
      id: sessionId,
      routingTask,
      targetPlatforms: routingTask.targetPlatforms,
      responses: new Map(),
      startTime: Date.now(),
      status: 'ACTIVE',
      timeout: setTimeout(() => {
        this.handleCoordinationTimeout(sessionId)
      }, this.routingConfig.queueTimeoutMs)
    }
    
    this.coordinationSessions.set(sessionId, session)
    await this.log(`建立協調會話: ${sessionId}`)
    
    return sessionId
  }

  /**
   * 發送協調事件
   * @param {string} platform - 目標平台
   * @param {Object} routingTask - 路由任務
   * @param {string} sessionId - 會話ID
   */
  async sendCoordinatedEvent(platform, routingTask, sessionId) {
    const coordinatedEvent = {
      ...routingTask,
      sessionId,
      targetPlatform: platform,
      coordinationType: 'REQUEST',
      requireResponse: true
    }
    
    await this.queueEventForPlatform(platform, coordinatedEvent)
  }

  /**
   * 收集協調結果
   * @param {string} sessionId - 會話ID
   * @param {Array} results - 執行結果
   */
  async collectCoordinationResults(sessionId, results) {
    const session = this.coordinationSessions.get(sessionId)
    if (!session) {
      return
    }
    
    // 處理每個結果
    results.forEach((result, index) => {
      const platform = session.targetPlatforms[index]
      session.responses.set(platform, {
        status: result.status,
        value: result.value,
        reason: result.reason,
        timestamp: Date.now()
      })
    })
    
    // 發送協調完成事件
    await this.emitEvent('PLATFORM.ROUTER.COORDINATION.COMPLETED', {
      sessionId,
      totalPlatforms: session.targetPlatforms.length,
      successCount: results.filter(r => r.status === 'fulfilled').length,
      failureCount: results.filter(r => r.status === 'rejected').length,
      duration: Date.now() - session.startTime,
      timestamp: Date.now()
    })
  }

  /**
   * 關閉協調會話
   * @param {string} sessionId - 會話ID
   */
  async closeCoordinationSession(sessionId) {
    const session = this.coordinationSessions.get(sessionId)
    if (session) {
      if (session.timeout) {
        clearTimeout(session.timeout)
      }
      session.status = 'COMPLETED'
      this.coordinationSessions.delete(sessionId)
      await this.log(`關閉協調會話: ${sessionId}`)
    }
  }

  /**
   * 處理協調超時
   * @param {string} sessionId - 會話ID
   */
  async handleCoordinationTimeout(sessionId) {
    const session = this.coordinationSessions.get(sessionId)
    if (session && session.status === 'ACTIVE') {
      session.status = 'TIMEOUT'
      
      await this.logError(`協調會話超時: ${sessionId}`)
      
      await this.emitEvent('PLATFORM.ROUTER.COORDINATION.TIMEOUT', {
        sessionId,
        duration: Date.now() - session.startTime,
        timestamp: Date.now()
      })
      
      this.coordinationSessions.delete(sessionId)
    }
  }

  /**
   * 將事件加入平台佇列
   * @param {string} platform - 目標平台
   * @param {Object} eventData - 事件資料
   */
  async queueEventForPlatform(platform, eventData) {
    const queues = this.eventQueues.get(platform)
    if (!queues) {
      await this.log(`平台 ${platform} 的佇列不存在`)
      return
    }
    
    queues.outbound.push({
      ...eventData,
      queuedAt: Date.now(),
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    })
  }

  /**
   * 投遞事件到平台
   * @param {string} platform - 目標平台
   * @param {Object} event - 事件資料
   */
  async deliverEventToPlatform(platform, event) {
    // 檢查斷路器
    if (!this.isCircuitBreakerClosed(platform)) {
      throw new Error(`平台 ${platform} 斷路器開啟，拒絕投遞`)
    }
    
    try {
      // 尋找平台通訊頻道
      const routeInfo = this.routingTable.get(platform)
      if (!routeInfo || !routeInfo.isActive) {
        throw new Error(`平台 ${platform} 不可用`)
      }
      
      // 選擇可用的頻道
      const channel = this.selectAvailableChannel(platform)
      if (!channel) {
        throw new Error(`平台 ${platform} 沒有可用的通訊頻道`)
      }
      
      // 投遞事件
      await this.sendEventThroughChannel(channel, event)
      
      // 更新成功統計
      this.updateCircuitBreakerSuccess(platform)
      channel.messageCount++
      channel.lastActivity = Date.now()
      
    } catch (error) {
      // 更新失敗統計
      this.updateCircuitBreakerFailure(platform)
      throw error
    }
  }

  /**
   * 選擇可用的通訊頻道
   * @param {string} platform - 平台標識符
   * @returns {Object|null} 通訊頻道
   */
  selectAvailableChannel(platform) {
    const routeInfo = this.routingTable.get(platform)
    if (!routeInfo) {
      return null
    }
    
    // 選擇錯誤最少且最近活躍的頻道
    let bestChannel = null
    let bestScore = -1
    
    for (const [channelId, channel] of routeInfo.channels) {
      if (channel.isActive) {
        const score = 1000 - channel.errorCount - (Date.now() - channel.lastActivity) / 1000
        if (score > bestScore) {
          bestChannel = channel
          bestScore = score
        }
      }
    }
    
    return bestChannel
  }

  /**
   * 透過頻道發送事件
   * @param {Object} channel - 通訊頻道
   * @param {Object} event - 事件資料
   */
  async sendEventThroughChannel(channel, event) {
    try {
      // 如果有適配器，使用適配器發送
      if (channel.adapter && typeof channel.adapter.sendEvent === 'function') {
        await channel.adapter.sendEvent(event)
      } else {
        // 使用事件總線發送
        await this.emitEvent(`PLATFORM.${channel.platformId}.EVENT`, event)
      }
      
    } catch (error) {
      channel.errorCount++
      throw error
    }
  }

  /**
   * 更新斷路器成功統計
   * @param {string} platform - 平台標識符
   */
  updateCircuitBreakerSuccess(platform) {
    const breaker = this.circuitBreakers.get(platform)
    if (breaker) {
      if (breaker.state === 'HALF_OPEN') {
        breaker.successCount++
        if (breaker.successCount >= 3) {
          breaker.state = 'CLOSED'
          breaker.failureCount = 0
        }
      } else if (breaker.state === 'CLOSED') {
        breaker.failureCount = Math.max(0, breaker.failureCount - 1)
      }
    }
  }

  /**
   * 更新斷路器失敗統計
   * @param {string} platform - 平台標識符
   */
  updateCircuitBreakerFailure(platform) {
    const breaker = this.circuitBreakers.get(platform)
    if (breaker) {
      breaker.failureCount++
      breaker.lastFailureTime = Date.now()
      
      if (breaker.failureCount >= breaker.failureThreshold) {
        breaker.state = 'OPEN'
        await this.log(`平台 ${platform} 斷路器開啟`)
      }
    }
  }

  /**
   * 處理協調操作請求
   * @param {Object} event - 協調請求事件
   */
  async handleCoordinationRequest(event) {
    try {
      const { operation, platforms, options } = event.data || {}
      
      const result = await this.coordinateOperation(operation, platforms, options)
      
      // 發送協調結果
      await this.emitEvent('PLATFORM.ROUTER.COORDINATION.RESULT', {
        operation,
        platforms,
        result,
        timestamp: Date.now()
      })
      
      return result
      
    } catch (error) {
      await this.logError('處理協調操作請求失敗', error)
      throw error
    }
  }

  /**
   * 執行跨平台協調操作
   * @param {string} operation - 操作類型
   * @param {Array} platforms - 目標平台列表
   * @param {Object} options - 操作選項
   * @returns {Object} 協調結果
   */
  async coordinateOperation(operation, platforms, options = {}) {
    const operationId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const startTime = Date.now()
    
    try {
      await this.log(`開始協調操作: ${operation} (${operationId})`)
      
      // 驗證操作類型
      if (!this.coordinationOperationTypes[operation]) {
        throw new Error(`不支援的協調操作類型: ${operation}`)
      }
      
      // 驗證目標平台
      const validPlatforms = platforms.filter(p => this.supportedPlatforms.includes(p))
      if (validPlatforms.length === 0) {
        throw new Error('沒有有效的目標平台')
      }
      
      // 檢查並發操作限制
      if (this.activeOperations.size >= this.routingConfig.maxConcurrentOps) {
        throw new Error('超過最大並發操作限制')
      }
      
      // 註冊活躍操作
      this.activeOperations.set(operationId, {
        operation,
        platforms: validPlatforms,
        startTime,
        status: 'RUNNING'
      })
      
      let result
      
      // 根據操作類型執行不同的協調邏輯
      switch (operation) {
        case 'DATA_SYNC':
          result = await this.coordinateDataSync(validPlatforms, options)
          break
        case 'BATCH_PROCESSING':
          result = await this.coordinateBatchProcessing(validPlatforms, options)
          break
        case 'STATE_BROADCAST':
          result = await this.coordinateStateBroadcast(validPlatforms, options)
          break
        case 'RESOURCE_SHARING':
          result = await this.coordinateResourceSharing(validPlatforms, options)
          break
        case 'CROSS_PLATFORM_SEARCH':
          result = await this.coordinateCrossPlatformSearch(validPlatforms, options)
          break
        default:
          throw new Error(`未實作的協調操作: ${operation}`)
      }
      
      // 記錄操作歷史
      this.operationHistory.push({
        operationId,
        operation,
        platforms: validPlatforms,
        duration: Date.now() - startTime,
        status: 'SUCCESS',
        result,
        timestamp: Date.now()
      })
      
      this.routingStats.totalCoordinationOps++
      
      await this.log(`協調操作完成: ${operation} (${operationId})`)
      
      return {
        success: true,
        operationId,
        operation,
        platforms: validPlatforms,
        duration: Date.now() - startTime,
        result
      }
      
    } catch (error) {
      // 記錄錯誤歷史
      this.operationHistory.push({
        operationId,
        operation,
        platforms,
        duration: Date.now() - startTime,
        status: 'FAILED',
        error: error.message,
        timestamp: Date.now()
      })
      
      await this.logError(`協調操作失敗: ${operation} (${operationId})`, error)
      
      return {
        success: false,
        operationId,
        operation,
        platforms,
        duration: Date.now() - startTime,
        error: error.message
      }
      
    } finally {
      // 清理活躍操作
      this.activeOperations.delete(operationId)
    }
  }

  /**
   * 協調資料同步操作
   * @param {Array} platforms - 目標平台
   * @param {Object} options - 操作選項
   */
  async coordinateDataSync(platforms, options) {
    const syncSession = await this.createCoordinationSession({
      eventType: 'DATA.SYNC.COORDINATE',
      targetPlatforms: platforms,
      priority: 'HIGH',
      options
    })
    
    try {
      // 收集各平台資料狀態
      const dataStates = await this.collectPlatformDataStates(platforms)
      
      // 計算同步策略
      const syncStrategy = this.calculateSyncStrategy(dataStates, options)
      
      // 執行同步操作
      const syncResults = await this.executeSyncStrategy(platforms, syncStrategy)
      
      return {
        syncSessionId: syncSession,
        dataStates,
        syncStrategy,
        results: syncResults
      }
      
    } finally {
      await this.closeCoordinationSession(syncSession)
    }
  }

  /**
   * 協調批次處理操作
   * @param {Array} platforms - 目標平台
   * @param {Object} options - 操作選項
   */
  async coordinateBatchProcessing(platforms, options) {
    const batchSize = options.batchSize || this.routingConfig.batchSize
    const tasks = options.tasks || []
    
    // 將任務分配到平台
    const taskDistribution = this.distributeTasks(tasks, platforms)
    
    // 並行執行批次任務
    const promises = Object.entries(taskDistribution).map(([platform, platformTasks]) =>
      this.executeBatchTasksOnPlatform(platform, platformTasks, batchSize)
    )
    
    const results = await Promise.allSettled(promises)
    
    return {
      taskDistribution,
      results: results.map((result, index) => ({
        platform: Object.keys(taskDistribution)[index],
        status: result.status,
        value: result.value,
        reason: result.reason
      }))
    }
  }

  /**
   * 協調狀態廣播操作
   * @param {Array} platforms - 目標平台
   * @param {Object} options - 操作選項
   */
  async coordinateStateBroadcast(platforms, options) {
    const state = options.state || {}
    const broadcastEvent = {
      eventType: 'STATE.BROADCAST',
      eventData: state,
      priority: 'HIGH'
    }
    
    // 並行廣播到所有平台
    const promises = platforms.map(platform =>
      this.queueEventForPlatform(platform, broadcastEvent)
    )
    
    await Promise.allSettled(promises)
    
    return {
      broadcastedTo: platforms,
      state,
      timestamp: Date.now()
    }
  }

  /**
   * 協調資源共享操作
   * @param {Array} platforms - 目標平台
   * @param {Object} options - 操作選項
   */
  async coordinateResourceSharing(platforms, options) {
    const resource = options.resource || {}
    const sharingMode = options.mode || 'READ_only'
    
    // 建立資源共享會話
    const sharingSessionId = `sharing-${Date.now()}`
    
    // 通知各平台資源可用
    const notificationPromises = platforms.map(platform =>
      this.queueEventForPlatform(platform, {
        eventType: 'RESOURCE.SHARING.AVAILABLE',
        eventData: {
          resource,
          sharingMode,
          sessionId: sharingSessionId
        }
      })
    )
    
    await Promise.allSettled(notificationPromises)
    
    return {
      sharingSessionId,
      resource,
      sharingMode,
      sharedWith: platforms
    }
  }

  /**
   * 協調跨平台搜尋操作
   * @param {Array} platforms - 目標平台
   * @param {Object} options - 操作選項
   */
  async coordinateCrossPlatformSearch(platforms, options) {
    const query = options.query || ''
    const searchTimeout = options.timeout || 10000
    
    // 發送搜尋請求到各平台
    const searchPromises = platforms.map(platform =>
      this.executeSearchOnPlatform(platform, query, searchTimeout)
    )
    
    // 等待所有搜尋結果
    const results = await Promise.allSettled(searchPromises)
    
    // 彙整搜尋結果
    const consolidatedResults = this.consolidateSearchResults(results, platforms)
    
    return {
      query,
      searchedPlatforms: platforms,
      results: consolidatedResults,
      totalResults: consolidatedResults.reduce((sum, r) => sum + (r.results?.length || 0), 0)
    }
  }

  /**
   * 處理平台狀態變更
   * @param {Object} event - 狀態變更事件
   */
  async handlePlatformStatusChange(event) {
    try {
      const { platformId, status, context } = event.data || {}
      
      const routeInfo = this.routingTable.get(platformId)
      if (routeInfo) {
        routeInfo.isActive = status === 'ACTIVE'
        routeInfo.lastSeen = Date.now()
        
        if (status === 'ACTIVE') {
          // 重置斷路器
          const breaker = this.circuitBreakers.get(platformId)
          if (breaker) {
            breaker.state = 'CLOSED'
            breaker.failureCount = 0
          }
        }
        
        await this.log(`平台 ${platformId} 狀態更新: ${status}`)
      }
      
    } catch (error) {
      await this.logError('處理平台狀態變更失敗', error)
    }
  }

  /**
   * 處理平台連接事件
   * @param {Object} event - 連接事件
   */
  async handlePlatformConnected(event) {
    try {
      const { platformId, adapterInfo } = event.data || {}
      
      // 建立新的通訊頻道
      await this.createPlatformChannel(platformId, { adapter: adapterInfo })
      
      // 更新路由表
      const routeInfo = this.routingTable.get(platformId)
      if (routeInfo) {
        routeInfo.isActive = true
        routeInfo.adapter = adapterInfo
        routeInfo.lastSeen = Date.now()
        routeInfo.failureCount = 0
      }
      
      await this.log(`平台 ${platformId} 已連接`)
      
    } catch (error) {
      await this.logError('處理平台連接事件失敗', error)
    }
  }

  /**
   * 處理平台斷開事件
   * @param {Object} event - 斷開事件
   */
  async handlePlatformDisconnected(event) {
    try {
      const { platformId } = event.data || {}
      
      // 關閉所有相關頻道
      const routeInfo = this.routingTable.get(platformId)
      if (routeInfo) {
        for (const [channelId, channel] of routeInfo.channels) {
          channel.isActive = false
          this.platformChannels.delete(channelId)
        }
        routeInfo.channels.clear()
        routeInfo.isActive = false
      }
      
      // 清理平台佇列
      const queues = this.eventQueues.get(platformId)
      if (queues) {
        queues.outbound = []
      }
      
      await this.log(`平台 ${platformId} 已斷開`)
      
    } catch (error) {
      await this.logError('處理平台斷開事件失敗', error)
    }
  }

  /**
   * 處理系統關閉
   * @param {Object} event - 系統關閉事件
   */
  async handleSystemShutdown(event) {
    await this.stop()
  }

  /**
   * 啟動效能監控
   */
  startPerformanceMonitoring() {
    setInterval(() => {
      this.updateThroughputStats()
    }, 5000) // 每5秒更新一次吞吐量統計
  }

  /**
   * 更新吞吐量統計
   */
  updateThroughputStats() {
    const now = Date.now()
    const timeDiff = (now - this.routingStats.lastStatsReset) / 1000
    
    if (timeDiff > 0) {
      this.routingStats.throughputPerSecond = this.routingStats.totalEventsRouted / timeDiff
    }
    
    // 每分鐘重置統計
    if (timeDiff >= 60) {
      this.routingStats.totalEventsRouted = 0
      this.routingStats.lastStatsReset = now
    }
  }

  /**
   * 更新延遲統計
   * @param {number} latency - 延遲時間(毫秒)
   */
  updateLatencyStats(latency) {
    const currentAvg = this.routingStats.averageLatency
    const currentCount = this.routingStats.totalEventsRouted
    
    this.routingStats.averageLatency = 
      (currentAvg * (currentCount - 1) + latency) / currentCount
  }

  /**
   * 啟動健康檢查
   */
  startHealthCheck() {
    setInterval(async () => {
      await this.performHealthCheck()
    }, 30000) // 每30秒執行一次健康檢查
  }

  /**
   * 執行健康檢查
   */
  async performHealthCheck() {
    try {
      // 檢查路由表狀態
      let activeRoutes = 0
      let failedRoutes = 0
      
      for (const [platform, routeInfo] of this.routingTable) {
        if (routeInfo.isActive) {
          activeRoutes++
        } else {
          failedRoutes++
        }
      }
      
      // 檢查佇列健康狀態
      let totalQueueSize = 0
      for (const [platform, queues] of this.eventQueues) {
        totalQueueSize += queues.outbound.length + queues.failed.length
      }
      
      // 檢查協調會話
      const activeSessions = this.coordinationSessions.size
      const activeOps = this.activeOperations.size
      
      const healthReport = {
        status: this.determineOverallHealth(activeRoutes, failedRoutes, totalQueueSize),
        routes: { active: activeRoutes, failed: failedRoutes },
        queueSize: totalQueueSize,
        sessions: { active: activeSessions, operations: activeOps },
        stats: this.routingStats,
        timestamp: Date.now()
      }
      
      // 發送健康報告
      await this.emitEvent('PLATFORM.ROUTER.HEALTH.REPORT', healthReport)
      
    } catch (error) {
      await this.logError('執行健康檢查失敗', error)
    }
  }

  /**
   * 判斷整體健康狀態
   * @param {number} activeRoutes - 活躍路由數
   * @param {number} failedRoutes - 失敗路由數
   * @param {number} queueSize - 佇列大小
   * @returns {string} 健康狀態
   */
  determineOverallHealth(activeRoutes, failedRoutes, queueSize) {
    if (failedRoutes > activeRoutes) {
      return 'CRITICAL'
    } else if (queueSize > 100 || failedRoutes > 0) {
      return 'WARNING'
    } else if (activeRoutes > 0 && this.isRouting) {
      return 'HEALTHY'
    } else {
      return 'DEGRADED'
    }
  }

  /**
   * 停止路由服務
   */
  async stop() {
    this.isRouting = false
    
    // 關閉所有協調會話
    for (const [sessionId, session] of this.coordinationSessions) {
      await this.closeCoordinationSession(sessionId)
    }
    
    // 清理活躍操作
    this.activeOperations.clear()
    
    // 關閉所有通訊頻道
    for (const [channelId, channel] of this.platformChannels) {
      channel.isActive = false
    }
    
    await this.log('Cross Platform Router Service 已停止')
  }

  /**
   * 清理路由服務資源
   */
  async cleanup() {
    // 清理所有佇列
    this.eventQueues.clear()
    this.priorityQueues.clear()
    this.processingQueues.clear()
    
    // 清理路由表
    this.routingTable.clear()
    this.routingRules.clear()
    this.platformChannels.clear()
    
    // 清理會話和操作
    this.coordinationSessions.clear()
    this.activeOperations.clear()
    this.operationHistory = []
    
    // 清理斷路器
    this.circuitBreakers.clear()
    
    // 重置統計
    this.routingStats = {
      totalEventsRouted: 0,
      totalCoordinationOps: 0,
      averageLatency: 0,
      errorCount: 0,
      throughputPerSecond: 0,
      lastStatsReset: Date.now()
    }
    
    this.isInitialized = false
    
    await this.log('Cross Platform Router Service 資源清理完成')
  }

  /**
   * 取得路由統計資訊
   * @returns {Object} 統計資訊
   */
  getRoutingStatistics() {
    return {
      ...this.routingStats,
      activeRoutes: Array.from(this.routingTable.entries())
        .filter(([, info]) => info.isActive).length,
      totalRoutes: this.routingTable.size,
      activeChannels: Array.from(this.platformChannels.values())
        .filter(channel => channel.isActive).length,
      totalChannels: this.platformChannels.size,
      queueSizes: Object.fromEntries(
        Array.from(this.eventQueues.entries()).map(([platform, queues]) => [
          platform,
          {
            outbound: queues.outbound.length,
            failed: queues.failed.length,
            total: queues.totalEvents
          }
        ])
      ),
      coordinationSessions: this.coordinationSessions.size,
      activeOperations: this.activeOperations.size,
      operationHistory: this.operationHistory.slice(-10) // 最近10個操作
    }
  }

  /**
   * 取得健康狀態
   * @returns {Object} 健康狀態報告
   */
  getHealthStatus() {
    const activeRoutes = Array.from(this.routingTable.values())
      .filter(info => info.isActive).length
    const failedRoutes = this.routingTable.size - activeRoutes
    const totalQueueSize = Array.from(this.eventQueues.values())
      .reduce((sum, queues) => sum + queues.outbound.length + queues.failed.length, 0)
    
    return {
      status: this.determineOverallHealth(activeRoutes, failedRoutes, totalQueueSize),
      router: {
        isInitialized: this.isInitialized,
        isRouting: this.isRouting,
        routerId: this.routingEngineId
      },
      routes: {
        total: this.routingTable.size,
        active: activeRoutes,
        failed: failedRoutes
      },
      queues: {
        totalSize: totalQueueSize,
        platformQueues: this.eventQueues.size,
        priorityQueues: this.priorityQueues.size
      },
      coordination: {
        activeSessions: this.coordinationSessions.size,
        activeOperations: this.activeOperations.size
      },
      performance: this.routingStats,
      circuitBreakers: Object.fromEntries(
        Array.from(this.circuitBreakers.entries()).map(([platform, breaker]) => [
          platform, { state: breaker.state, failures: breaker.failureCount }
        ])
      ),
      timestamp: Date.now()
    }
  }

  /**
   * 發送事件
   * @param {string} eventType - 事件類型
   * @param {Object} eventData - 事件資料
   */
  async emitEvent(eventType, eventData) {
    try {
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        await this.eventBus.emit(eventType, eventData)
      }
    } catch (error) {
      await this.logError(`發送事件 ${eventType} 失敗`, error)
    }
  }

  /**
   * 記錄日誌
   * @param {string} message - 日誌訊息
   */
  async log(message) {
    if (this.logger && typeof this.logger.info === 'function') {
      this.logger.info(`[CrossPlatformRouter] ${message}`)
    } else {
      console.log(`[CrossPlatformRouter] ${message}`)
    }
  }

  /**
   * 記錄錯誤日誌
   * @param {string} message - 錯誤訊息
   * @param {Error} error - 錯誤物件
   */
  async logError(message, error) {
    if (this.logger && typeof this.logger.error === 'function') {
      this.logger.error(`[CrossPlatformRouter] ${message}`, error)
    } else {
      console.error(`[CrossPlatformRouter] ${message}`, error)
    }
  }

  // 輔助方法實作 (為了完整性，這裡提供簡化實作)

  /**
   * 收集平台資料狀態
   * @param {Array} platforms - 平台列表
   */
  async collectPlatformDataStates(platforms) {
    // 簡化實作 - 實際應該查詢各平台狀態
    return platforms.map(platform => ({
      platform,
      lastSync: Date.now() - Math.random() * 3600000,
      dataVersion: Math.floor(Math.random() * 100),
      status: 'READY'
    }))
  }

  /**
   * 計算同步策略
   * @param {Array} dataStates - 資料狀態
   * @param {Object} options - 選項
   */
  calculateSyncStrategy(dataStates, options) {
    // 簡化實作 - 實際應該根據資料狀態計算最佳同步策略
    return {
      type: 'INCREMENTAL',
      sourceSelection: 'LATEST_VERSION',
      conflicts: [],
      estimatedTime: dataStates.length * 1000
    }
  }

  /**
   * 執行同步策略
   * @param {Array} platforms - 平台列表
   * @param {Object} strategy - 同步策略
   */
  async executeSyncStrategy(platforms, strategy) {
    // 簡化實作 - 實際應該執行具體的同步操作
    return platforms.map(platform => ({
      platform,
      status: 'SUCCESS',
      recordsUpdated: Math.floor(Math.random() * 100),
      duration: Math.random() * 1000
    }))
  }

  /**
   * 分配任務到平台
   * @param {Array} tasks - 任務列表
   * @param {Array} platforms - 平台列表
   */
  distributeTasks(tasks, platforms) {
    const distribution = {}
    platforms.forEach(platform => { distribution[platform] = [] })
    
    tasks.forEach((task, index) => {
      const targetPlatform = platforms[index % platforms.length]
      distribution[targetPlatform].push(task)
    })
    
    return distribution
  }

  /**
   * 在平台上執行批次任務
   * @param {string} platform - 平台標識符
   * @param {Array} tasks - 任務列表
   * @param {number} batchSize - 批次大小
   */
  async executeBatchTasksOnPlatform(platform, tasks, batchSize) {
    // 簡化實作 - 實際應該執行具體的批次任務
    const batches = []
    for (let i = 0; i < tasks.length; i += batchSize) {
      batches.push(tasks.slice(i, i + batchSize))
    }
    
    return {
      platform,
      totalTasks: tasks.length,
      batchCount: batches.length,
      status: 'COMPLETED'
    }
  }

  /**
   * 在平台上執行搜尋
   * @param {string} platform - 平台標識符
   * @param {string} query - 搜尋查詢
   * @param {number} timeout - 超時時間
   */
  async executeSearchOnPlatform(platform, query, timeout) {
    // 簡化實作 - 實際應該呼叫平台適配器的搜尋功能
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          platform,
          query,
          results: Array.from({ length: Math.floor(Math.random() * 10) }, (_, i) => ({
            id: `${platform}-result-${i}`,
            title: `Search Result ${i} from ${platform}`,
            relevance: Math.random()
          }))
        })
      }, Math.random() * Math.min(timeout, 2000))
    })
  }

  /**
   * 彙整搜尋結果
   * @param {Array} results - 搜尋結果
   * @param {Array} platforms - 平台列表
   */
  consolidateSearchResults(results, platforms) {
    return results.map((result, index) => ({
      platform: platforms[index],
      status: result.status,
      results: result.status === 'fulfilled' ? result.value.results : [],
      error: result.status === 'rejected' ? result.reason : null
    }))
  }
}

module.exports = CrossPlatformRouter