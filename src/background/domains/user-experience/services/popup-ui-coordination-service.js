/**
 * Popup UI 協調服務
 *
 * 負責功能：
 * - 整合 Popup 模組化重構成果到 UX Domain
 * - 協調 Popup 各模組間的通訊和狀態同步
 * - 管理 Popup 生命週期和模組載入
 * - 處理 Popup 與 Background 的雙向協調
 *
 * 設計考量：
 * - 作為 Popup 模組化的中央協調點
 * - 實現 Popup 模組的鬆耦合整合
 * - 提供統一的 Popup 狀態管理介面
 * - 支援 Popup 模組的動態載入和卸載
 *
 * 處理流程：
 * 1. 初始化 Popup 模組管理器
 * 2. 載入和協調各 Popup 模組
 * 3. 管理模組間事件通訊
 * 4. 協調 Popup 狀態與 Background 同步
 *
 * 使用情境：
 * - Popup 模組化架構的核心協調服務
 * - Background 與 Popup 的通訊橋樑
 * - Popup 狀態的集中管理點
 * - UX Domain 中 Popup 相關功能的統一入口
 */

class PopupUICoordinationService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false,
      modulesLoaded: false
    }

    // Popup 模組管理
    this.popupModules = new Map()
    this.moduleStates = new Map()
    this.popupState = new PopupStateManager()
    this.popupEventBus = new PopupEventBus()

    // 模組載入器映射
    this.moduleLoaders = new Map([
      ['dom-manager', () => require('../../../popup/ui/popup-dom-manager')],
      ['status-display', () => require('../../../popup/ui/popup-status-display')],
      ['progress-display', () => require('../../../popup/ui/popup-progress-display')],
      ['button-manager', () => require('../../../popup/ui/popup-button-manager')],
      ['background-bridge', () => require('../../../popup/services/popup-background-bridge')],
      ['extraction-service', () => require('../../../popup/services/popup-extraction-service')],
      ['tab-service', () => require('../../../popup/services/popup-tab-service')],
      ['main-controller', () => require('../../../popup/controllers/popup-main-controller')],
      ['lifecycle-controller', () => require('../../../popup/controllers/popup-lifecycle-controller')]
    ])

    // 協調統計
    this.stats = {
      modulesManaged: 0,
      stateCoordinations: 0,
      themeUpdates: 0,
      extractionCoordinations: 0,
      eventsRouted: 0
    }
  }

  /**
   * 初始化 Popup UI 協調服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('⚠️ Popup UI 協調服務已初始化')
      return
    }

    try {
      this.logger.log('🎯 初始化 Popup UI 協調服務')

      // 初始化 Popup 狀態管理器
      await this.initializePopupStateManager()

      // 初始化 Popup 事件總線
      await this.initializePopupEventBus()

      // 設定模組協調機制
      await this.setupModuleCoordination()

      // 註冊 Background 事件監聽
      await this.registerBackgroundEventListeners()

      this.state.initialized = true
      this.logger.log('✅ Popup UI 協調服務初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.POPUP_UI.COORDINATION.INITIALIZED', {
          serviceName: 'PopupUICoordinationService',
          modulesAvailable: Array.from(this.moduleLoaders.keys())
        })
      }
    } catch (error) {
      this.logger.error('❌ 初始化 Popup UI 協調服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動 Popup UI 協調服務
   */
  async start () {
    if (!this.state.initialized) {
      throw new Error('Popup UI 協調服務尚未初始化')
    }

    if (this.state.active) {
      this.logger.warn('⚠️ Popup UI 協調服務已啟動')
      return
    }

    try {
      this.logger.log('🚀 啟動 Popup UI 協調服務')

      // 準備模組載入環境
      await this.prepareModuleEnvironment()

      this.state.active = true
      this.logger.log('✅ Popup UI 協調服務啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.POPUP_UI.COORDINATION.STARTED', {
          serviceName: 'PopupUICoordinationService',
          ready: true
        })
      }
    } catch (error) {
      this.logger.error('❌ 啟動 Popup UI 協調服務失敗:', error)
      throw error
    }
  }

  /**
   * 協調 Popup 狀態
   */
  async coordinateState (newState) {
    this.logger.log('🖼️ 協調 Popup 狀態')

    try {
      // 統計狀態協調
      this.stats.stateCoordinations++

      // 獲取當前狀態
      const oldState = this.popupState.getCurrentState()

      // 更新 Popup 狀態
      await this.popupState.setState(newState)

      // 通知相關模組狀態變更
      await this.notifyModulesStateChange(oldState, newState)

      // 根據狀態協調 UI 更新
      const coordinationResult = await this.coordinateUIUpdates(newState)

      // 發送狀態協調事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.POPUP.STATE.COORDINATED', {
          oldState,
          newState,
          coordinationResult,
          timestamp: Date.now()
        })
      }

      this.logger.log('✅ Popup 狀態協調完成')
      return coordinationResult
    } catch (error) {
      this.logger.error('❌ Popup 狀態協調失敗:', error)
      throw error
    }
  }

  /**
   * 載入 Popup 模組
   */
  async loadPopupModules () {
    if (this.state.modulesLoaded) {
      this.logger.warn('⚠️ Popup 模組已載入')
      return
    }

    try {
      this.logger.log('🔄 載入 Popup 模組')

      // 載入核心 UI 模組
      await this.loadModule('dom-manager', 'PopupDOMManager')
      await this.loadModule('status-display', 'PopupStatusDisplay')
      await this.loadModule('progress-display', 'PopupProgressDisplay')
      await this.loadModule('button-manager', 'PopupButtonManager')

      // 載入服務模組
      await this.loadModule('background-bridge', 'PopupBackgroundBridge')
      await this.loadModule('extraction-service', 'PopupExtractionService')
      await this.loadModule('tab-service', 'PopupTabService')

      // 載入控制器模組
      await this.loadModule('main-controller', 'PopupMainController')
      await this.loadModule('lifecycle-controller', 'PopupLifecycleController')

      // 設定模組間協調
      await this.setupModuleInterconnections()

      this.state.modulesLoaded = true
      this.stats.modulesManaged = this.popupModules.size

      this.logger.log(`✅ 載入了 ${this.popupModules.size} 個 Popup 模組`)

      // 發送模組載入完成事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.POPUP.MODULES.LOADED', {
          modulesCount: this.popupModules.size,
          moduleNames: Array.from(this.popupModules.keys())
        })
      }
    } catch (error) {
      this.logger.error('❌ 載入 Popup 模組失敗:', error)
      throw error
    }
  }

  /**
   * 載入指定模組
   */
  async loadModule (moduleId, moduleClass) {
    try {
      // 檢查模組是否已載入
      if (this.popupModules.has(moduleId)) {
        this.logger.warn(`⚠️ 模組已載入: ${moduleId}`)
        return
      }

      // 動態載入模組類別
      const ModuleLoader = this.moduleLoaders.get(moduleId)
      if (!ModuleLoader) {
        throw new Error(`未找到模組載入器: ${moduleId}`)
      }

      const ModuleClass = ModuleLoader()

      // 創建模組實例
      const moduleInstance = new ModuleClass({
        eventBus: this.popupEventBus,
        stateManager: this.popupState,
        logger: this.logger
      })

      // 初始化模組
      if (typeof moduleInstance.initialize === 'function') {
        await moduleInstance.initialize()
      }

      // 註冊模組
      this.popupModules.set(moduleId, moduleInstance)
      this.moduleStates.set(moduleId, {
        loaded: true,
        active: true,
        healthy: true,
        lastUpdate: Date.now()
      })

      this.logger.log(`✅ 模組載入成功: ${moduleId}`)
    } catch (error) {
      this.logger.error(`❌ 模組載入失敗: ${moduleId}`, error)

      // 記錄載入失敗狀態
      this.moduleStates.set(moduleId, {
        loaded: false,
        active: false,
        healthy: false,
        error: error.message,
        lastUpdate: Date.now()
      })

      throw error
    }
  }

  /**
   * 協調提取請求
   */
  async coordinateExtractionRequest (options) {
    this.logger.log('📥 協調提取請求')

    try {
      // 統計提取協調
      this.stats.extractionCoordinations++

      // 檢查模組是否已載入
      if (!this.state.modulesLoaded) {
        await this.loadPopupModules()
      }

      // 獲取提取服務模組
      const extractionService = this.popupModules.get('extraction-service')
      if (!extractionService) {
        throw new Error('提取服務模組未載入')
      }

      // 協調提取流程
      const result = await extractionService.startExtraction(options)

      // 更新進度顯示
      await this.updateProgressDisplay(result.progress)

      // 發送提取協調事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.POPUP.EXTRACTION.COORDINATED', {
          options,
          result,
          timestamp: Date.now()
        })
      }

      this.logger.log('✅ 提取請求協調完成')
      return result
    } catch (error) {
      this.logger.error('❌ 提取請求協調失敗:', error)
      throw error
    }
  }

  /**
   * 更新主題
   */
  async updateTheme (theme) {
    this.logger.log(`🎨 更新 Popup 主題: ${theme}`)

    try {
      // 統計主題更新
      this.stats.themeUpdates++

      // 更新所有支援主題的模組
      const themeAwareModules = ['dom-manager', 'status-display', 'progress-display', 'button-manager']

      for (const moduleId of themeAwareModules) {
        const module = this.popupModules.get(moduleId)
        if (module && typeof module.updateTheme === 'function') {
          await module.updateTheme(theme)
        }
      }

      // 通過 Popup 事件總線通知主題變更
      await this.popupEventBus.emit('POPUP.THEME.UPDATED', {
        theme,
        timestamp: Date.now()
      })

      this.logger.log(`✅ Popup 主題更新完成: ${theme}`)
    } catch (error) {
      this.logger.error(`❌ Popup 主題更新失敗: ${theme}`, error)
      throw error
    }
  }

  /**
   * 更新偏好設定
   */
  async updatePreference (key, value) {
    this.logger.log(`⚙️ 更新 Popup 偏好設定: ${key}`)

    try {
      // 通知相關模組偏好變更
      await this.popupEventBus.emit('POPUP.PREFERENCE.UPDATED', {
        key,
        value,
        timestamp: Date.now()
      })

      // 根據偏好類型執行相應更新
      if (key.startsWith('popup.ui.')) {
        await this.updateUIPreference(key, value)
      } else if (key.startsWith('popup.extraction.')) {
        await this.updateExtractionPreference(key, value)
      }

      this.logger.log(`✅ Popup 偏好設定更新完成: ${key}`)
    } catch (error) {
      this.logger.error(`❌ Popup 偏好設定更新失敗: ${key}`, error)
      throw error
    }
  }

  /**
   * 初始化 Popup 狀態管理器
   */
  async initializePopupStateManager () {
    this.popupState = new PopupStateManager()
    await this.popupState.initialize()
    this.logger.log('✅ Popup 狀態管理器初始化完成')
  }

  /**
   * 初始化 Popup 事件總線
   */
  async initializePopupEventBus () {
    this.popupEventBus = new PopupEventBus()
    await this.popupEventBus.initialize()
    this.logger.log('✅ Popup 事件總線初始化完成')
  }

  /**
   * 設定模組協調機制
   */
  async setupModuleCoordination () {
    // 設定模組間事件路由
    this.popupEventBus.on('POPUP.STATE.CHANGE.REQUEST', async (event) => {
      await this.coordinateState(event.data.state)
    })

    this.popupEventBus.on('POPUP.EXTRACTION.REQUEST', async (event) => {
      await this.coordinateExtractionRequest(event.data.options)
    })

    this.logger.log('✅ 模組協調機制設定完成')
  }

  /**
   * 設定模組間互聯
   */
  async setupModuleInterconnections () {
    // 設定提取進度事件協調
    this.popupEventBus.on('EXTRACTION.PROGRESS', async (event) => {
      const progressDisplay = this.popupModules.get('progress-display')
      if (progressDisplay) {
        await progressDisplay.updateProgress(event.data.percentage, event.data.text)
      }
    })

    // 設定狀態更新事件協調
    this.popupEventBus.on('STATUS.UPDATE', async (event) => {
      const statusDisplay = this.popupModules.get('status-display')
      if (statusDisplay) {
        await statusDisplay.updateStatus(event.data.status, event.data.text, event.data.info)
      }
    })

    // 設定按鈕狀態事件協調
    this.popupEventBus.on('BUTTON.STATE.UPDATE', async (event) => {
      const buttonManager = this.popupModules.get('button-manager')
      if (buttonManager) {
        await buttonManager.updateButtonState(event.data.buttonId, event.data.disabled, event.data.text)
      }
    })

    this.logger.log('✅ 模組間互聯設定完成')
  }

  /**
   * 註冊 Background 事件監聽
   */
  async registerBackgroundEventListeners () {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 不可用，跳過 Background 事件監聽器註冊')
      return
    }

    // 監聽來自 Background 的 Popup 相關事件
    await this.eventBus.on('POPUP.LOAD.REQUEST', async (event) => {
      await this.loadPopupModules()
    })

    await this.eventBus.on('POPUP.STATE.SYNC.REQUEST', async (event) => {
      await this.coordinateState(event.data.state)
    })

    this.logger.log('✅ Background 事件監聽器註冊完成')
  }

  /**
   * 通知模組狀態變更
   */
  async notifyModulesStateChange (oldState, newState) {
    await this.popupEventBus.emit('POPUP.STATE.CHANGED', {
      oldState,
      newState,
      timestamp: Date.now()
    })
  }

  /**
   * 協調 UI 更新
   */
  async coordinateUIUpdates (state) {
    const updates = []

    // 根據狀態協調相應的 UI 更新
    switch (state.status) {
      case 'loading':
        updates.push(this.showLoadingState())
        break
      case 'ready':
        updates.push(this.showReadyState(state))
        break
      case 'extracting':
        updates.push(this.showExtractionState(state))
        break
      case 'error':
        updates.push(this.showErrorState(state))
        break
    }

    const results = await Promise.all(updates)
    return { updates: results.length, successful: results.filter(r => r.success).length }
  }

  /**
   * 更新進度顯示
   */
  async updateProgressDisplay (progress) {
    const progressDisplay = this.popupModules.get('progress-display')
    if (progressDisplay && progress) {
      await progressDisplay.updateProgress(progress.percentage, progress.text)
    }
  }

  /**
   * 準備模組載入環境
   */
  async prepareModuleEnvironment () {
    // 確保模組載入環境準備就緒
    this.logger.log('🔧 準備 Popup 模組載入環境')
  }

  /**
   * 顯示載入狀態
   */
  async showLoadingState () {
    try {
      await this.popupEventBus.emit('STATUS.UPDATE', {
        status: 'loading',
        text: '載入中...',
        info: null
      })
      return { success: true, action: 'showLoadingState' }
    } catch (error) {
      return { success: false, action: 'showLoadingState', error: error.message }
    }
  }

  /**
   * 顯示就緒狀態
   */
  async showReadyState (state) {
    try {
      await this.popupEventBus.emit('STATUS.UPDATE', {
        status: 'ready',
        text: '就緒',
        info: state.currentPage
      })
      return { success: true, action: 'showReadyState' }
    } catch (error) {
      return { success: false, action: 'showReadyState', error: error.message }
    }
  }

  /**
   * 顯示提取狀態
   */
  async showExtractionState (state) {
    try {
      await this.popupEventBus.emit('STATUS.UPDATE', {
        status: 'extracting',
        text: '提取中...',
        info: null
      })

      if (state.extractionProgress) {
        await this.updateProgressDisplay(state.extractionProgress)
      }

      return { success: true, action: 'showExtractionState' }
    } catch (error) {
      return { success: false, action: 'showExtractionState', error: error.message }
    }
  }

  /**
   * 顯示錯誤狀態
   */
  async showErrorState (state) {
    try {
      await this.popupEventBus.emit('STATUS.UPDATE', {
        status: 'error',
        text: '發生錯誤',
        info: state.error
      })
      return { success: true, action: 'showErrorState' }
    } catch (error) {
      return { success: false, action: 'showErrorState', error: error.message }
    }
  }

  /**
   * 更新 UI 偏好設定
   */
  async updateUIPreference (key, value) {
    // 根據具體的 UI 偏好進行相應更新
    this.logger.log(`🎨 更新 UI 偏好: ${key} = ${value}`)
  }

  /**
   * 更新提取偏好設定
   */
  async updateExtractionPreference (key, value) {
    // 根據具體的提取偏好進行相應更新
    this.logger.log(`📥 更新提取偏好: ${key} = ${value}`)
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      service: 'PopupUICoordinationService',
      initialized: this.state.initialized,
      active: this.state.active,
      modulesLoaded: this.state.modulesLoaded,
      modulesCount: this.popupModules.size,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const healthyModules = Array.from(this.moduleStates.values())
      .filter(state => state.healthy).length

    return {
      service: 'PopupUICoordinationService',
      healthy: this.state.initialized && this.state.active,
      status: this.state.active ? 'active' : 'inactive',
      modulesHealth: `${healthyModules}/${this.moduleStates.size}`,
      metrics: {
        modulesManaged: this.stats.modulesManaged,
        stateCoordinations: this.stats.stateCoordinations,
        themeUpdates: this.stats.themeUpdates,
        extractionCoordinations: this.stats.extractionCoordinations,
        eventsRouted: this.stats.eventsRouted
      }
    }
  }
}

/**
 * Popup 狀態管理器
 */
class PopupStateManager {
  constructor () {
    this.currentState = {
      status: 'loading',
      currentPage: null,
      extractionProgress: null,
      error: null,
      timestamp: Date.now()
    }

    this.stateHistory = []
    this.stateSubscribers = new Map()
  }

  async initialize () {
    // 初始化狀態管理器
  }

  async setState (newState) {
    const oldState = { ...this.currentState }
    this.currentState = {
      ...this.currentState,
      ...newState,
      timestamp: Date.now()
    }

    // 記錄狀態歷史
    this.stateHistory.push({
      oldState,
      newState: { ...this.currentState },
      timestamp: Date.now()
    })

    // 通知訂閱者
    for (const [key, callback] of this.stateSubscribers) {
      try {
        await callback(this.currentState, oldState)
      } catch (error) {
        console.error(`狀態訂閱者回調失敗 (${key}):`, error)
      }
    }
  }

  getCurrentState () {
    return { ...this.currentState }
  }

  subscribeToState (key, callback) {
    this.stateSubscribers.set(key, callback)
  }

  unsubscribeFromState (key) {
    this.stateSubscribers.delete(key)
  }
}

/**
 * Popup 事件總線
 */
class PopupEventBus {
  constructor () {
    this.listeners = new Map()
    this.eventHistory = []
  }

  async initialize () {
    // 初始化事件總線
  }

  on (eventType, handler, options = {}) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, [])
    }

    const listener = {
      handler,
      priority: options.priority || 0,
      once: options.once || false
    }

    this.listeners.get(eventType).push(listener)

    // 按優先級排序
    this.listeners.get(eventType).sort((a, b) => b.priority - a.priority)

    return listener
  }

  async emit (eventType, data = {}) {
    const listeners = this.listeners.get(eventType) || []

    // 記錄事件歷史
    this.eventHistory.push({
      eventType,
      data,
      timestamp: Date.now(),
      listenersCount: listeners.length
    })

    // 執行所有監聽器
    const results = []
    for (const listener of listeners) {
      try {
        const result = await listener.handler({ type: eventType, data })
        results.push({ success: true, result })

        // 如果是一次性監聽器，移除它
        if (listener.once) {
          this.off(eventType, listener.handler)
        }
      } catch (error) {
        results.push({ success: false, error: error.message })
      }
    }

    return results
  }

  off (eventType, handler) {
    const listeners = this.listeners.get(eventType) || []
    const index = listeners.findIndex(l => l.handler === handler)

    if (index !== -1) {
      listeners.splice(index, 1)
    }
  }

  removeAllListeners (eventType) {
    if (eventType) {
      this.listeners.delete(eventType)
    } else {
      this.listeners.clear()
    }
  }
}

module.exports = PopupUICoordinationService
