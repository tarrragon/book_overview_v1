/**
 * @fileoverview Platform Switcher Service - 平台切換控制服務
 * @version v2.0.0
 * @since 2025-08-14
 *
 * 負責功能：
 * - 平台間智能切換協調管理
 * - 切換過程中的狀態保存與恢復
 * - 跨平台會話連續性維護
 * - 切換效能優化與錯誤處理
 *
 * 設計考量：
 * - 平台切換響應時間 < 2秒
 * - 狀態一致性 100% 保證
 * - 支援並發切換請求管理
 * - 智能回滾與錯誤恢復機制
 *
 * 處理流程：
 * 1. 接收平台切換請求與驗證
 * 2. 保存當前平台狀態與上下文
 * 3. 協調目標平台適配器載入
 * 4. 執行狀態遷移與資料同步
 * 5. 驗證切換完成並清理資源
 *
 * 使用情境：
 * - 使用者主動切換到不同書城平台
 * - 系統檢測到平台變更時自動切換
 * - 平台錯誤時的自動故障轉移
 */

class PlatformSwitcherService {
  /**
   * 初始化平台切換服務
   * @param {EventBus} eventBus - 事件總線實例
   * @param {Object} config - 服務配置與依賴
   */
  constructor (eventBus, config = {}) {
    this.eventBus = eventBus
    this.config = config
    this.logger = config.logger

    // 依賴注入
    this.platformRegistry = config.registry
    this.adapterFactory = config.adapterFactory

    // 切換狀態管理
    this.currentPlatform = null
    this.previousPlatform = null
    this.switchingInProgress = false
    this.switchHistory = []

    // 狀態保存與恢復
    this.platformStates = new Map()
    this.sessionData = new Map()

    // 切換配置
    this.switchConfig = {
      timeout: 30000, // 30秒切換超時
      maxRetries: 3, // 最大重試次數
      retryDelay: 1000, // 重試延遲 (ms)
      statePreservation: true, // 是否保存狀態
      autoFallback: true, // 自動故障轉移
      concurrentLimit: 1 // 並發切換限制
    }

    // 效能監控
    this.performanceMetrics = {
      totalSwitches: 0,
      successfulSwitches: 0,
      failedSwitches: 0,
      averageSwitchTime: 0,
      fastestSwitch: Infinity,
      slowestSwitch: 0
    }

    // 並發控制
    this.activeSwitches = new Map()
    this.switchQueue = []

    // 服務狀態
    this.isInitialized = false
  }

  /**
   * 初始化切換服務
   */
  async initialize () {
    try {
      await this.log('開始初始化 Platform Switcher Service')

      // 驗證依賴
      await this.validateDependencies()

      // 設定事件監聽器
      await this.setupEventListeners()

      // 初始化切換配置
      await this.initializeSwitchConfig()

      // 檢測當前平台
      await this.detectCurrentPlatform()

      this.isInitialized = true
      await this.log('Platform Switcher Service 初始化完成')

      // 發送初始化完成事件
      await this.emitEvent('PLATFORM.SWITCHER.INITIALIZED', {
        currentPlatform: this.currentPlatform,
        config: this.switchConfig,
        timestamp: Date.now()
      })
    } catch (error) {
      await this.logError('Platform Switcher Service 初始化失敗', error)
      throw error
    }
  }

  /**
   * 驗證服務依賴
   */
  async validateDependencies () {
    if (!this.platformRegistry) {
      throw new Error('Platform Registry Service 依賴缺失')
    }

    if (!this.adapterFactory) {
      throw new Error('Adapter Factory Service 依賴缺失')
    }

    // 檢查依賴服務是否已初始化
    if (typeof this.platformRegistry.getActivePlatforms !== 'function') {
      throw new Error('Platform Registry Service 尚未正確初始化')
    }
  }

  /**
   * 設定事件監聽器
   */
  async setupEventListeners () {
    // 監聽平台切換請求
    this.eventBus.on('PLATFORM.SWITCH.REQUESTED', this.handleSwitchRequest.bind(this))

    // 監聽平台檢測變更
    this.eventBus.on('PLATFORM.DETECTION.COMPLETED', this.handlePlatformDetection.bind(this))

    // 監聽平台錯誤
    this.eventBus.on('PLATFORM.ERROR.OCCURRED', this.handlePlatformError.bind(this))

    // 監聽適配器狀態變更
    this.eventBus.on('PLATFORM.ADAPTER.STATUS.CHANGED', this.handleAdapterStatusChange.bind(this))
  }

  /**
   * 初始化切換配置
   */
  async initializeSwitchConfig () {
    // 從配置文件或環境變數載入配置
    const userConfig = this.config.switcher || {}

    this.switchConfig = {
      ...this.switchConfig,
      ...userConfig
    }

    await this.log(`切換配置初始化: 超時=${this.switchConfig.timeout}ms, 重試=${this.switchConfig.maxRetries}次`)
  }

  /**
   * 檢測當前平台
   */
  async detectCurrentPlatform () {
    try {
      // 嘗試從瀏覽器上下文檢測當前平台
      // 這裡可以整合 Platform Detection Service
      const detectionResult = await this.requestPlatformDetection()

      if (detectionResult && detectionResult.platformId !== 'UNKNOWN') {
        this.currentPlatform = detectionResult.platformId
        await this.log(`檢測到當前平台: ${this.currentPlatform}`)
      } else {
        await this.log('未檢測到活躍平台')
      }
    } catch (error) {
      await this.logError('檢測當前平台失敗', error)
    }
  }

  /**
   * 請求平台檢測
   * @returns {Promise<Object>} 檢測結果
   */
  async requestPlatformDetection () {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('平台檢測超時'))
      }, 5000)

      // 監聽檢測結果
      const handler = (event) => {
        clearTimeout(timeout)
        this.eventBus.off('PLATFORM.DETECTION.RESPONSE', handler)
        resolve(event.data)
      }

      this.eventBus.on('PLATFORM.DETECTION.RESPONSE', handler)

      // 發送檢測請求
      this.emitEvent('PLATFORM.DETECTION.REQUESTED', {
        requestId: `switch-${Date.now()}`,
        source: 'platform-switcher-service'
      })
    })
  }

  /**
   * 切換到指定平台
   * @param {string} targetPlatform - 目標平台ID
   * @param {Object} options - 切換選項
   * @returns {Promise<Object>} 切換結果
   */
  async switchToPlatform (targetPlatform, options = {}) {
    const switchId = `switch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    try {
      await this.log(`開始切換到平台: ${targetPlatform} (ID: ${switchId})`)

      // 驗證切換請求
      const validation = await this.validateSwitchRequest(targetPlatform, options)
      if (!validation.isValid) {
        throw new Error(`切換請求驗證失敗: ${validation.error}`)
      }

      // 檢查並發限制
      await this.enforceConcurrencyLimit(switchId)

      // 開始切換流程
      const startTime = Date.now()
      this.switchingInProgress = true

      // 記錄活躍切換
      this.activeSwitches.set(switchId, {
        targetPlatform,
        startTime,
        options,
        status: 'starting'
      })

      // 發送切換開始事件
      await this.emitEvent('PLATFORM.SWITCH.STARTED', {
        switchId,
        fromPlatform: this.currentPlatform,
        toPlatform: targetPlatform,
        options,
        timestamp: startTime
      })

      // 執行切換流程
      const result = await this.executeSwitchProcess(switchId, targetPlatform, options)

      // 計算切換時間
      const switchTime = Date.now() - startTime

      // 更新效能指標
      this.updatePerformanceMetrics(switchTime, true)

      // 記錄切換歷史
      this.recordSwitchHistory(switchId, targetPlatform, switchTime, true)

      await this.log(`平台切換成功: ${this.currentPlatform} -> ${targetPlatform} (耗時: ${switchTime}ms)`)

      return {
        success: true,
        switchId,
        fromPlatform: this.previousPlatform,
        toPlatform: this.currentPlatform,
        switchTime,
        timestamp: Date.now()
      }
    } catch (error) {
      await this.logError(`平台切換失敗 (ID: ${switchId})`, error)

      // 更新效能指標
      this.updatePerformanceMetrics(0, false)

      // 記錄失敗歷史
      this.recordSwitchHistory(switchId, targetPlatform, Date.now() - (this.activeSwitches.get(switchId)?.startTime || Date.now()), false, error.message)

      // 嘗試回滾
      if (this.switchConfig.autoFallback) {
        await this.attemptFallback(switchId)
      }

      return {
        success: false,
        switchId,
        error: error.message,
        timestamp: Date.now()
      }
    } finally {
      // 清理
      this.activeSwitches.delete(switchId)
      this.switchingInProgress = false

      // 處理排隊的切換請求
      await this.processQueuedSwitches()
    }
  }

  /**
   * 驗證切換請求
   * @param {string} targetPlatform - 目標平台
   * @param {Object} options - 切換選項
   * @returns {Object} 驗證結果
   */
  async validateSwitchRequest (targetPlatform, options) {
    // 檢查目標平台是否已註冊
    const platformInfo = this.platformRegistry.getPlatform(targetPlatform)
    if (!platformInfo) {
      return {
        isValid: false,
        error: `目標平台 ${targetPlatform} 未註冊`
      }
    }

    // 檢查平台是否活躍
    if (platformInfo.status !== 'active') {
      return {
        isValid: false,
        error: `目標平台 ${targetPlatform} 狀態為: ${platformInfo.status}`
      }
    }

    // 檢查是否已經在目標平台
    if (this.currentPlatform === targetPlatform && !options.forceSwitch) {
      return {
        isValid: false,
        error: `已經在目標平台 ${targetPlatform}`
      }
    }

    // 檢查平台能力需求
    if (options.requiredCapabilities) {
      const missingCapabilities = options.requiredCapabilities.filter(
        capability => !this.platformRegistry.platformSupportsCapability(targetPlatform, capability)
      )

      if (missingCapabilities.length > 0) {
        return {
          isValid: false,
          error: `目標平台缺少必要能力: ${missingCapabilities.join(', ')}`
        }
      }
    }

    return { isValid: true }
  }

  /**
   * 強制執行並發限制
   * @param {string} switchId - 切換ID
   */
  async enforceConcurrencyLimit (switchId) {
    if (this.activeSwitches.size >= this.switchConfig.concurrentLimit) {
      // 將請求加入隊列
      return new Promise((resolve, reject) => {
        this.switchQueue.push({
          switchId,
          resolve,
          reject,
          timestamp: Date.now()
        })

        this.log(`切換請求 ${switchId} 已加入隊列，當前隊列長度: ${this.switchQueue.length}`)
      })
    }
  }

  /**
   * 執行切換流程
   * @param {string} switchId - 切換ID
   * @param {string} targetPlatform - 目標平台
   * @param {Object} options - 切換選項
   * @returns {Promise<Object>} 切換結果
   */
  async executeSwitchProcess (switchId, targetPlatform, options) {
    // 步驟 1: 保存當前平台狀態
    if (this.currentPlatform && this.switchConfig.statePreservation) {
      await this.preserveCurrentPlatformState(this.currentPlatform)
    }

    // 步驟 2: 準備目標平台適配器
    const adapter = await this.prepareTargetAdapter(targetPlatform)

    // 步驟 3: 執行平台切換
    await this.performPlatformSwitch(targetPlatform, adapter, options)

    // 步驟 4: 恢復或初始化狀態
    if (this.switchConfig.statePreservation) {
      await this.restorePlatformState(targetPlatform, options)
    }

    // 步驟 5: 驗證切換完成
    await this.validateSwitchCompletion(targetPlatform)

    return { success: true }
  }

  /**
   * 保存當前平台狀態
   * @param {string} platformId - 平台ID
   */
  async preserveCurrentPlatformState (platformId) {
    try {
      const currentAdapter = this.platformRegistry.getAdapterCache(platformId)

      if (currentAdapter && typeof currentAdapter.saveState === 'function') {
        const state = await currentAdapter.saveState()

        this.platformStates.set(platformId, {
          state,
          timestamp: Date.now(),
          sessionData: this.sessionData.get(platformId) || {}
        })

        await this.log(`平台 ${platformId} 狀態已保存`)
      }
    } catch (error) {
      await this.logError(`保存平台 ${platformId} 狀態失敗`, error)
      // 不阻止切換流程，記錄錯誤即可
    }
  }

  /**
   * 準備目標平台適配器
   * @param {string} targetPlatform - 目標平台ID
   * @returns {Promise<Object>} 適配器實例
   */
  async prepareTargetAdapter (targetPlatform) {
    try {
      // 檢查是否已有緩存的適配器
      let adapter = this.platformRegistry.getAdapterCache(targetPlatform)

      if (!adapter) {
        // 創建新的適配器
        adapter = await this.adapterFactory.createAdapter(targetPlatform)

        if (!adapter) {
          throw new Error(`無法創建 ${targetPlatform} 適配器`)
        }

        // 緩存適配器
        this.platformRegistry.setAdapterCache(targetPlatform, adapter)
      }

      // 確保適配器已初始化
      if (typeof adapter.initialize === 'function') {
        await adapter.initialize()
      }

      await this.log(`平台 ${targetPlatform} 適配器準備完成`)
      return adapter
    } catch (error) {
      await this.logError(`準備 ${targetPlatform} 適配器失敗`, error)
      throw error
    }
  }

  /**
   * 執行平台切換
   * @param {string} targetPlatform - 目標平台ID
   * @param {Object} adapter - 適配器實例
   * @param {Object} options - 切換選項
   */
  async performPlatformSwitch (targetPlatform, adapter, options) {
    // 記錄切換前狀態
    this.previousPlatform = this.currentPlatform

    // 如果有當前適配器，執行清理
    if (this.currentPlatform) {
      const currentAdapter = this.platformRegistry.getAdapterCache(this.currentPlatform)
      if (currentAdapter && typeof currentAdapter.deactivate === 'function') {
        await currentAdapter.deactivate()
      }
    }

    // 激活目標適配器
    if (typeof adapter.activate === 'function') {
      await adapter.activate(options)
    }

    // 更新當前平台
    this.currentPlatform = targetPlatform

    // 發送平台切換完成事件
    await this.emitEvent('PLATFORM.SWITCH.COMPLETED', {
      fromPlatform: this.previousPlatform,
      toPlatform: this.currentPlatform,
      adapter: adapter.constructor.name,
      timestamp: Date.now()
    })
  }

  /**
   * 恢復平台狀態
   * @param {string} platformId - 平台ID
   * @param {Object} options - 恢復選項
   */
  async restorePlatformState (platformId, options) {
    try {
      const savedState = this.platformStates.get(platformId)

      if (savedState && !options.ignoreState) {
        const adapter = this.platformRegistry.getAdapterCache(platformId)

        if (adapter && typeof adapter.restoreState === 'function') {
          await adapter.restoreState(savedState.state)
          await this.log(`平台 ${platformId} 狀態已恢復`)
        }
      } else {
        await this.log(`平台 ${platformId} 以全新狀態啟動`)
      }
    } catch (error) {
      await this.logError(`恢復平台 ${platformId} 狀態失敗`, error)
      // 不阻止切換流程
    }
  }

  /**
   * 驗證切換完成
   * @param {string} targetPlatform - 目標平台ID
   */
  async validateSwitchCompletion (targetPlatform) {
    // 檢查當前平台是否正確設定
    if (this.currentPlatform !== targetPlatform) {
      throw new Error(`切換驗證失敗: 期望 ${targetPlatform}, 實際 ${this.currentPlatform}`)
    }

    // 檢查適配器是否正常運作
    const adapter = this.platformRegistry.getAdapterCache(targetPlatform)
    if (!adapter) {
      throw new Error(`切換驗證失敗: ${targetPlatform} 適配器不存在`)
    }

    // 執行適配器健康檢查
    if (typeof adapter.healthCheck === 'function') {
      const healthStatus = await adapter.healthCheck()
      if (!healthStatus.healthy) {
        throw new Error(`切換驗證失敗: ${targetPlatform} 適配器健康檢查失敗`)
      }
    }

    await this.log(`平台切換驗證通過: ${targetPlatform}`)
  }

  /**
   * 嘗試故障轉移
   * @param {string} failedSwitchId - 失敗的切換ID
   */
  async attemptFallback (failedSwitchId) {
    try {
      await this.log(`嘗試故障轉移 (失敗切換ID: ${failedSwitchId})`)

      // 如果有之前的平台，嘗試切換回去
      if (this.previousPlatform) {
        await this.log(`嘗試切換回前一個平台: ${this.previousPlatform}`)

        const fallbackResult = await this.switchToPlatform(this.previousPlatform, {
          ignoreState: false,
          isFallback: true
        })

        if (fallbackResult.success) {
          await this.log(`故障轉移成功，已切換回 ${this.previousPlatform}`)
        } else {
          await this.logError('故障轉移失敗', new Error(fallbackResult.error))
        }
      } else {
        // 嘗試切換到任何可用的活躍平台
        const activePlatforms = this.platformRegistry.getActivePlatforms()

        for (const platform of activePlatforms) {
          if (platform.platformId !== this.currentPlatform) {
            try {
              const fallbackResult = await this.switchToPlatform(platform.platformId, {
                ignoreState: true,
                isFallback: true
              })

              if (fallbackResult.success) {
                await this.log(`故障轉移成功，已切換到 ${platform.platformId}`)
                break
              }
            } catch (error) {
              await this.logError(`嘗試切換到 ${platform.platformId} 失敗`, error)
              continue
            }
          }
        }
      }
    } catch (error) {
      await this.logError('故障轉移流程失敗', error)
    }
  }

  /**
   * 處理排隊的切換請求
   */
  async processQueuedSwitches () {
    if (this.switchQueue.length > 0 && this.activeSwitches.size < this.switchConfig.concurrentLimit) {
      const queuedSwitch = this.switchQueue.shift()

      if (queuedSwitch) {
        await this.log(`處理排隊的切換請求: ${queuedSwitch.switchId}`)
        queuedSwitch.resolve()
      }
    }
  }

  /**
   * 更新效能指標
   * @param {number} switchTime - 切換時間
   * @param {boolean} success - 是否成功
   */
  updatePerformanceMetrics (switchTime, success) {
    this.performanceMetrics.totalSwitches++

    if (success) {
      this.performanceMetrics.successfulSwitches++

      if (switchTime > 0) {
        // 更新平均切換時間
        const previousAverage = this.performanceMetrics.averageSwitchTime
        const successCount = this.performanceMetrics.successfulSwitches

        this.performanceMetrics.averageSwitchTime =
          (previousAverage * (successCount - 1) + switchTime) / successCount

        // 更新最快和最慢切換時間
        this.performanceMetrics.fastestSwitch = Math.min(this.performanceMetrics.fastestSwitch, switchTime)
        this.performanceMetrics.slowestSwitch = Math.max(this.performanceMetrics.slowestSwitch, switchTime)
      }
    } else {
      this.performanceMetrics.failedSwitches++
    }
  }

  /**
   * 記錄切換歷史
   * @param {string} switchId - 切換ID
   * @param {string} targetPlatform - 目標平台
   * @param {number} switchTime - 切換時間
   * @param {boolean} success - 是否成功
   * @param {string} error - 錯誤訊息（如果失敗）
   */
  recordSwitchHistory (switchId, targetPlatform, switchTime, success, error = null) {
    const historyEntry = {
      switchId,
      fromPlatform: this.previousPlatform,
      toPlatform: targetPlatform,
      switchTime,
      success,
      error,
      timestamp: Date.now()
    }

    this.switchHistory.push(historyEntry)

    // 限制歷史記錄數量（保留最近100筆）
    if (this.switchHistory.length > 100) {
      this.switchHistory.shift()
    }
  }

  /**
   * 處理切換請求事件
   * @param {Object} event - 切換請求事件
   */
  async handleSwitchRequest (event) {
    const { targetPlatform, options, responseCallback } = event.data || {}

    if (!targetPlatform) {
      await this.logError('收到無效的切換請求', new Error('缺少目標平台'))
      return
    }

    try {
      const result = await this.switchToPlatform(targetPlatform, options)

      if (responseCallback && typeof responseCallback === 'function') {
        responseCallback(result)
      }
    } catch (error) {
      await this.logError('處理切換請求失敗', error)

      if (responseCallback && typeof responseCallback === 'function') {
        responseCallback({ success: false, error: error.message })
      }
    }
  }

  /**
   * 處理平台檢測事件
   * @param {Object} event - 平台檢測事件
   */
  async handlePlatformDetection (event) {
    const { platformId, confidence } = event.data || {}

    // 如果檢測到高信心度的新平台，且與當前平台不同
    if (platformId &&
        confidence > 0.9 &&
        platformId !== this.currentPlatform &&
        !this.switchingInProgress) {
      await this.log(`檢測到新平台 ${platformId}，信心度: ${confidence}`)

      // 可以選擇自動切換或發送建議事件
      await this.emitEvent('PLATFORM.SWITCH.SUGGESTED', {
        currentPlatform: this.currentPlatform,
        suggestedPlatform: platformId,
        confidence,
        reason: 'automatic_detection',
        timestamp: Date.now()
      })
    }
  }

  /**
   * 處理平台錯誤事件
   * @param {Object} event - 平台錯誤事件
   */
  async handlePlatformError (event) {
    const { platformId, error, severity } = event.data || {}

    // 如果是當前平台的嚴重錯誤，考慮自動切換
    if (platformId === this.currentPlatform &&
        severity === 'critical' &&
        this.switchConfig.autoFallback &&
        !this.switchingInProgress) {
      await this.log(`當前平台 ${platformId} 發生嚴重錯誤，啟動自動故障轉移`)

      try {
        await this.attemptFallback(`error-fallback-${Date.now()}`)
      } catch (fallbackError) {
        await this.logError('自動故障轉移失敗', fallbackError)
      }
    }
  }

  /**
   * 處理適配器狀態變更事件
   * @param {Object} event - 適配器狀態變更事件
   */
  async handleAdapterStatusChange (event) {
    const { platformId, status, previousStatus } = event.data || {}

    await this.log(`平台 ${platformId} 適配器狀態變更: ${previousStatus} -> ${status}`)

    // 根據狀態變更採取適當行動
    if (status === 'failed' && platformId === this.currentPlatform) {
      await this.emitEvent('PLATFORM.SWITCH.REQUIRED', {
        reason: 'adapter_failure',
        failedPlatform: platformId,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 取得當前平台
   * @returns {string|null} 當前平台ID
   */
  getCurrentPlatform () {
    return this.currentPlatform
  }

  /**
   * 取得前一個平台
   * @returns {string|null} 前一個平台ID
   */
  getPreviousPlatform () {
    return this.previousPlatform
  }

  /**
   * 檢查是否正在切換
   * @returns {boolean} 是否正在切換
   */
  isSwitching () {
    return this.switchingInProgress
  }

  /**
   * 取得切換歷史
   * @param {number} limit - 限制返回數量
   * @returns {Array} 切換歷史記錄
   */
  getSwitchHistory (limit = 10) {
    return this.switchHistory.slice(-limit)
  }

  /**
   * 取得效能指標
   * @returns {Object} 效能指標
   */
  getPerformanceMetrics () {
    return {
      ...this.performanceMetrics,
      successRate: this.performanceMetrics.totalSwitches > 0
        ? (this.performanceMetrics.successfulSwitches / this.performanceMetrics.totalSwitches) * 100
        : 0,
      activeSwitches: this.activeSwitches.size,
      queuedSwitches: this.switchQueue.length
    }
  }

  /**
   * 取得健康狀態
   * @returns {Object} 健康狀態
   */
  getHealthStatus () {
    const metrics = this.getPerformanceMetrics()

    return {
      status: this.isInitialized ? 'operational' : 'initializing',
      currentPlatform: this.currentPlatform,
      switchingInProgress: this.switchingInProgress,
      performanceMetrics: metrics,
      dependenciesHealthy: Boolean(this.platformRegistry && this.adapterFactory),
      lastSwitchTime: this.switchHistory.length > 0
        ? this.switchHistory[this.switchHistory.length - 1].timestamp
        : null
    }
  }

  /**
   * 停止服務
   */
  async stop () {
    // 等待所有進行中的切換完成
    if (this.activeSwitches.size > 0) {
      await this.log('等待進行中的切換完成...')

      const timeout = setTimeout(() => {
        this.log('強制停止切換服務')
      }, this.switchConfig.timeout)

      while (this.activeSwitches.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      clearTimeout(timeout)
    }

    // 清理排隊的請求
    this.switchQueue.forEach(queued => {
      queued.reject(new Error('服務已停止'))
    })
    this.switchQueue = []

    this.isInitialized = false
    await this.log('Platform Switcher Service 已停止')
  }

  /**
   * 清理服務資源
   */
  async cleanup () {
    // 清理狀態數據
    this.platformStates.clear()
    this.sessionData.clear()
    this.switchHistory = []
    this.activeSwitches.clear()
    this.switchQueue = []

    // 重置狀態
    this.currentPlatform = null
    this.previousPlatform = null
    this.switchingInProgress = false

    // 重置效能指標
    this.performanceMetrics = {
      totalSwitches: 0,
      successfulSwitches: 0,
      failedSwitches: 0,
      averageSwitchTime: 0,
      fastestSwitch: Infinity,
      slowestSwitch: 0
    }

    this.isInitialized = false
    await this.log('Platform Switcher Service 資源清理完成')
  }

  /**
   * 發送事件
   * @param {string} eventType - 事件類型
   * @param {Object} eventData - 事件資料
   */
  async emitEvent (eventType, eventData) {
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
  async log (message) {
    if (this.logger && typeof this.logger.info === 'function') {
      this.logger.info(`[PlatformSwitcherService] ${message}`)
    } else {
      console.log(`[PlatformSwitcherService] ${message}`)
    }
  }

  /**
   * 記錄錯誤日誌
   * @param {string} message - 錯誤訊息
   * @param {Error} error - 錯誤物件
   */
  async logError (message, error) {
    if (this.logger && typeof this.logger.error === 'function') {
      this.logger.error(`[PlatformSwitcherService] ${message}`, error)
    } else {
      console.error(`[PlatformSwitcherService] ${message}`, error)
    }
  }
}

module.exports = PlatformSwitcherService
