/**
 * 用戶體驗領域協調器
 *
 * 負責功能：
 * - 統籌 UX 領域各服務的初始化和協調
 * - 管理主題、偏好、通知、個人化服務
 * - 協調 Popup UI 模組化整合
 * - 提供統一的用戶體驗管理介面
 *
 * 設計考量：
 * - 整合 Popup 模組化重構成果
 * - 統一的用戶體驗狀態管理
 * - 跨模組的 UX 協調機制
 * - 主題和偏好的一致性保證
 *
 * 處理流程：
 * 1. 初始化各 UX 服務
 * 2. 設定服務間協調機制
 * 3. 處理跨 Domain 的 UX 事件
 * 4. 管理 Popup UI 協調
 *
 * 使用情境：
 * - 整合 Popup 模組化重構
 * - 統一用戶體驗管理
 * - 跨服務主題協調
 * - 個人化設定同步
 */

const ThemeManagementService = require('./services/theme-management-service')
const PreferenceService = require('./services/preference-service')
const NotificationService = require('./services/notification-service')
const PopupUICoordinationService = require('./services/popup-ui-coordination-service')
const PersonalizationService = require('./services/personalization-service')
const AccessibilityService = require('./services/accessibility-service')

const { EVENT_PRIORITIES } = require('src/background/constants/module-constants')
const ErrorCodes = require('src/core/errors/ErrorCodes')

class UXDomainCoordinator {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null

    // Logger 後備方案: Background Service 初始化保護
    // 設計理念: UX 領域協調器統籌用戶體驗各服務，確保主題、偏好、通知的一致性
    // 執行環境: Service Worker 初始化階段，依賴注入可能不完整
    // 後備機制: console 確保模組生命週期錯誤能被追蹤
    // 風險考量: 理想上應確保 Logger 完整可用，此為過渡性保護
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 協調器狀態
    this.state = {
      initialized: false,
      active: false,
      servicesReady: false,
      currentTheme: 'auto',
      popupState: null
    }

    // UX 服務管理
    this.services = new Map()
    this.serviceStates = new Map()
    this.serviceDependencies = new Map()
    this.registeredListeners = new Map()

    // 初始化 UX 服務
    this.initializeServices(dependencies)

    // 設定服務依賴關係
    this.setupServiceDependencies()

    // UX 協調統計
    this.stats = {
      servicesManaged: this.services.size,
      themeChanges: 0,
      popupCoordinations: 0,
      notificationsShown: 0,
      preferencesUpdated: 0
    }
  }

  /**
   * 初始化所有 UX 服務
   */
  initializeServices (dependencies) {
    // 創建 UX 服務實例
    this.services.set('theme', new ThemeManagementService(dependencies))
    this.services.set('preference', new PreferenceService(dependencies))
    this.services.set('notification', new NotificationService(dependencies))
    this.services.set('popupUI', new PopupUICoordinationService(dependencies))
    this.services.set('personalization', new PersonalizationService(dependencies))
    this.services.set('accessibility', new AccessibilityService(dependencies))

    // 初始化服務狀態
    for (const serviceName of this.services.keys()) {
      this.serviceStates.set(serviceName, {
        initialized: false,
        active: false,
        healthy: true,
        lastCheck: 0,
        restartCount: 0
      })
    }

    this.logger.log(`初始化了 ${this.services.size} 個 UX 服務`)
  }

  /**
   * 設定服務依賴關係
   */
  setupServiceDependencies () {
    // 定義 UX 服務啟動順序和依賴關係
    this.serviceDependencies.set('preference', []) // 偏好設定優先啟動
    this.serviceDependencies.set('theme', ['preference']) // 主題依賴偏好設定
    this.serviceDependencies.set('accessibility', ['preference']) // 無障礙依賴偏好設定
    this.serviceDependencies.set('notification', ['preference']) // 通知依賴偏好設定
    this.serviceDependencies.set('personalization', ['preference']) // 個人化依賴偏好設定
    this.serviceDependencies.set('popupUI', ['theme', 'preference', 'notification']) // Popup UI 依賴其他服務
  }

  /**
   * 初始化 UX 領域協調器
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('[WARN] UX 領域協調器已初始化')
      return
    }

    try {
      this.logger.log('初始化 UX 領域協調器')

      // 按依賴順序初始化 UX 服務
      await this.initializeServicesInOrder()

      // 註冊事件監聽器
      await this.registerEventListeners()

      // 設定跨服務協調
      await this.setupCrossServiceCoordination()

      // 初始化預設主題
      await this.initializeDefaultTheme()

      this.state.initialized = true
      this.logger.log('[OK] UX 領域協調器初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.COORDINATOR.INITIALIZED', {
          serviceName: 'UXDomainCoordinator',
          servicesCount: this.services.size,
          servicesReady: Array.from(this.services.keys())
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 初始化 UX 領域協調器失敗:', error)
      throw error
    }
  }

  /**
   * 啟動 UX 領域協調器
   */
  async start () {
    if (!this.state.initialized) {
      const error = new Error('UX 協調器尚未初始化')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = { category: 'general' }
      throw error
    }

    if (this.state.active) {
      this.logger.warn('[WARN] UX 領域協調器已啟動')
      return
    }

    try {
      this.logger.log('[START] 啟動 UX 領域協調器')

      // 按依賴順序啟動 UX 服務
      await this.startServicesInOrder()

      // 執行 UX 就緒檢查
      await this.performUXReadinessCheck()

      this.state.active = true
      this.state.servicesReady = true

      this.logger.log('[OK] UX 領域協調器啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.COORDINATOR.STARTED', {
          serviceName: 'UXDomainCoordinator',
          servicesActive: this.getActiveServicesCount(),
          currentTheme: this.state.currentTheme
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 啟動 UX 領域協調器失敗:', error)
      throw error
    }
  }

  /**
   * 協調主題變更
   */
  async coordinateThemeChange (theme) {
    this.logger.log(`協調主題變更: ${theme}`)

    try {
      // 統計主題變更
      this.stats.themeChanges++

      // 更新當前主題狀態
      this.state.currentTheme = theme

      // 通知主題管理服務
      const themeService = this.services.get('theme')
      await themeService.setTheme(theme)

      // 協調 Popup UI 主題更新
      const popupUIService = this.services.get('popupUI')
      await popupUIService.updateTheme(theme)

      // 發送主題變更協調事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.THEME.CHANGE.COORDINATED', {
          theme,
          timestamp: Date.now(),
          coordinatedServices: ['theme', 'popupUI']
        })
      }

      this.logger.log(`[OK] 主題變更協調完成: ${theme}`)
      return { success: true, theme }
    } catch (error) {
      this.logger.error(`[FAIL] 主題變更協調失敗: ${theme}`, error)
      throw error
    }
  }

  /**
   * 協調 Popup 狀態
   */
  async coordinatePopupState (popupState) {
    this.logger.log('協調 Popup 狀態')

    try {
      // 統計 Popup 協調
      this.stats.popupCoordinations++

      // 更新當前 Popup 狀態
      this.state.popupState = popupState

      // 協調 Popup UI 服務
      const popupUIService = this.services.get('popupUI')
      const result = await popupUIService.coordinateState(popupState)

      // 根據狀態顯示相應通知
      if (popupState.status === 'error') {
        const notificationService = this.services.get('notification')
        await notificationService.showNotification({
          type: 'error',
          title: '操作失敗',
          message: popupState.error?.message || '發生未知錯誤'
        })
      }

      // 發送 Popup 狀態協調事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.POPUP.STATE.COORDINATED', {
          state: popupState,
          result,
          timestamp: Date.now()
        })
      }

      this.logger.log('[OK] Popup 狀態協調完成')
      return result
    } catch (error) {
      this.logger.error('[FAIL] Popup 狀態協調失敗:', error)
      throw error
    }
  }

  /**
   * 協調偏好設定更新
   */
  async coordinatePreferenceUpdate (key, value) {
    this.logger.log(`協調偏好設定更新: ${key}`)

    try {
      // 統計偏好更新
      this.stats.preferencesUpdated++

      // 更新偏好設定
      const preferenceService = this.services.get('preference')
      await preferenceService.setPreference(key, value)

      // 如果是主題相關偏好，協調主題變更
      if (key === 'theme') {
        await this.coordinateThemeChange(value)
      }

      // 如果是 Popup 相關偏好，更新 Popup UI
      if (key.startsWith('popup.')) {
        const popupUIService = this.services.get('popupUI')
        await popupUIService.updatePreference(key, value)
      }

      // 發送偏好協調事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.PREFERENCE.COORDINATED', {
          key,
          value,
          timestamp: Date.now()
        })
      }

      this.logger.log(`[OK] 偏好設定協調完成: ${key}`)
      return { success: true, key, value }
    } catch (error) {
      this.logger.error(`[FAIL] 偏好設定協調失敗: ${key}`, error)
      throw error
    }
  }

  /**
   * 按依賴順序初始化 UX 服務
   */
  async initializeServicesInOrder () {
    const initializationOrder = this.calculateInitializationOrder()

    for (const serviceName of initializationOrder) {
      try {
        this.logger.log(`初始化 UX 服務: ${serviceName}`)

        const service = this.services.get(serviceName)
        await service.initialize()

        this.serviceStates.get(serviceName).initialized = true
        this.logger.log(`[OK] UX 服務初始化完成: ${serviceName}`)
      } catch (error) {
        this.logger.error(`[FAIL] UX 服務初始化失敗: ${serviceName}`, error)
        const newError = new Error(`UX 服務 ${serviceName} 初始化失敗: ${error.message}`)
        newError.code = ErrorCodes.OPERATION_ERROR
        newError.details = { category: 'general' }
        throw newError
      }
    }

    this.logger.log('[OK] 所有 UX 服務初始化完成')
  }

  /**
   * 按依賴順序啟動 UX 服務
   */
  async startServicesInOrder () {
    const startOrder = this.calculateInitializationOrder()

    for (const serviceName of startOrder) {
      try {
        this.logger.log(`[START] 啟動 UX 服務: ${serviceName}`)

        const service = this.services.get(serviceName)
        await service.start()

        this.serviceStates.get(serviceName).active = true
        this.logger.log(`[OK] UX 服務啟動完成: ${serviceName}`)
      } catch (error) {
        this.logger.error(`[FAIL] UX 服務啟動失敗: ${serviceName}`, error)
        // UX 服務可以部分降級運行
        await this.handleServiceStartupFailure(serviceName, error)
      }
    }

    this.logger.log('[OK] 所有 UX 服務啟動完成')
  }

  /**
   * 計算初始化順序
   */
  calculateInitializationOrder () {
    const visited = new Set()
    const order = []

    const visit = (serviceName) => {
      if (visited.has(serviceName)) return

      visited.add(serviceName)

      // 先處理依賴
      const dependencies = this.serviceDependencies.get(serviceName) || []
      for (const dep of dependencies) {
        visit(dep)
      }

      order.push(serviceName)
    }

    // 訪問所有 UX 服務
    for (const serviceName of this.services.keys()) {
      visit(serviceName)
    }

    return order
  }

  /**
   * 設定跨服務協調
   */
  async setupCrossServiceCoordination () {
    this.logger.log('設定 UX 跨服務協調')

    // 設定主題變更協調
    if (this.eventBus) {
      await this.eventBus.on('UX.THEME.CHANGE.REQUESTED', async (event) => {
        await this.coordinateThemeChange(event.data.theme)
      })

      await this.eventBus.on('UX.POPUP.STATE.UPDATE.REQUESTED', async (event) => {
        await this.coordinatePopupState(event.data.state)
      })

      await this.eventBus.on('UX.PREFERENCE.UPDATE.REQUESTED', async (event) => {
        await this.coordinatePreferenceUpdate(event.data.key, event.data.value)
      })
    }
  }

  /**
   * 初始化預設主題
   */
  async initializeDefaultTheme () {
    try {
      const preferenceService = this.services.get('preference')
      const savedTheme = await preferenceService.getPreference('theme', 'auto')

      await this.coordinateThemeChange(savedTheme)
      this.logger.log(`載入預設主題: ${savedTheme}`)
    } catch (error) {
      this.logger.error('[FAIL] 初始化預設主題失敗:', error)
      // 使用 auto 主題作為後備
      await this.coordinateThemeChange('auto')
    }
  }

  /**
   * 執行 UX 就緒檢查
   */
  async performUXReadinessCheck () {
    this.logger.log('[CHECK] 執行 UX 就緒檢查')

    const issues = []

    // 檢查關鍵 UX 服務狀態
    const criticalServices = ['theme', 'preference', 'popupUI']

    for (const serviceName of criticalServices) {
      const service = this.services.get(serviceName)
      try {
        const healthStatus = service.getHealthStatus()

        if (!healthStatus.healthy) {
          issues.push(`UX 服務 ${serviceName} 狀態不健康`)
        }

        this.serviceStates.get(serviceName).healthy = healthStatus.healthy
      } catch (error) {
        issues.push(`無法獲取 UX 服務 ${serviceName} 健康狀態: ${error.message}`)
      }
    }

    if (issues.length > 0) {
      this.logger.warn('[WARN] UX 就緒檢查發現問題:', issues)
    } else {
      this.logger.log('[OK] UX 就緒檢查通過')
    }

    return { ready: issues.length === 0, issues }
  }

  /**
   * 處理服務啟動失敗
   */
  async handleServiceStartupFailure (serviceName, error) {
    this.logger.error(`UX 服務啟動失敗處理: ${serviceName}`, error)

    const serviceState = this.serviceStates.get(serviceName)
    serviceState.restartCount++

    // UX 服務可以降級運行，不影響整體功能
    this.logger.warn(`[WARN] UX 服務 ${serviceName} 以降級模式運行`)
    serviceState.active = false
    serviceState.healthy = false
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners () {
    if (!this.eventBus) {
      this.logger.warn('[WARN] EventBus 不可用，跳過 UX 事件監聽器註冊')
      return
    }

    const listeners = [
      {
        event: 'UX.STATUS.REQUEST',
        handler: this.handleStatusRequest.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      },
      {
        event: 'UX.THEME.CHANGE.REQUEST',
        handler: this.handleThemeChangeRequest.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      },
      {
        event: 'UX.POPUP.COORDINATION.REQUEST',
        handler: this.handlePopupCoordinationRequest.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      }
    ]

    for (const { event, handler, priority } of listeners) {
      const listenerId = await this.eventBus.on(event, handler, { priority })
      this.registeredListeners.set(event, listenerId)
    }

    this.logger.log(`[OK] 註冊了 ${listeners.length} 個 UX 事件監聽器`)
  }

  /**
   * 處理狀態請求
   */
  async handleStatusRequest (event) {
    try {
      const status = this.getStatus()

      if (this.eventBus) {
        await this.eventBus.emit('UX.STATUS.RESPONSE', {
          requestId: event.data?.requestId,
          status
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 處理 UX 狀態請求失敗:', error)
    }
  }

  /**
   * 處理主題變更請求
   */
  async handleThemeChangeRequest (event) {
    try {
      const { theme } = event.data || {}
      await this.coordinateThemeChange(theme)
    } catch (error) {
      this.logger.error('[FAIL] 處理主題變更請求失敗:', error)
    }
  }

  /**
   * 處理 Popup 協調請求
   */
  async handlePopupCoordinationRequest (event) {
    try {
      const { state } = event.data || {}
      await this.coordinatePopupState(state)
    } catch (error) {
      this.logger.error('[FAIL] 處理 Popup 協調請求失敗:', error)
    }
  }

  /**
   * 獲取活躍服務數量
   */
  getActiveServicesCount () {
    return Array.from(this.serviceStates.values())
      .filter(state => state.active).length
  }

  /**
   * 獲取指定服務
   */
  getService (serviceName) {
    return this.services.get(serviceName)
  }

  /**
   * 獲取協調器狀態
   */
  getStatus () {
    return {
      coordinator: {
        initialized: this.state.initialized,
        active: this.state.active,
        servicesReady: this.state.servicesReady,
        currentTheme: this.state.currentTheme,
        popupState: this.state.popupState
      },
      services: this.getAllServiceStates(),
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取所有服務狀態
   */
  getAllServiceStates () {
    const states = {}
    for (const [serviceName, state] of this.serviceStates) {
      states[serviceName] = { ...state }
    }
    return states
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const activeServices = this.getActiveServicesCount()
    const totalServices = this.services.size

    return {
      service: 'UXDomainCoordinator',
      healthy: this.state.initialized && this.state.active,
      status: this.state.active ? 'active' : 'inactive',
      servicesActive: `${activeServices}/${totalServices}`,
      currentTheme: this.state.currentTheme,
      metrics: {
        servicesManaged: this.stats.servicesManaged,
        themeChanges: this.stats.themeChanges,
        popupCoordinations: this.stats.popupCoordinations,
        notificationsShown: this.stats.notificationsShown,
        preferencesUpdated: this.stats.preferencesUpdated
      }
    }
  }
}

module.exports = UXDomainCoordinator
