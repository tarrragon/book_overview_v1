/**
 * 整合測試環境
 * 提供中等複雜度的整合測試執行環境
 * 遵循 Five Lines 規則和單一責任原則
 *
 * @author TDD Phase 4 - cinnamon-refactor-owl重構設計師
 * @date 2025-08-25
 * @version v0.9.38-refactor
 */

/**
 * 整合測試環境
 * 管理整合測試的環境設置和清理
 */
class IntegrationTestEnvironment {
  constructor (config) {
    this._config = config
    this._initializeState()
  }

  /**
   * 初始化狀態
   */
  _initializeState () {
    this._isSetup = false
    this._modules = new Map()
  }

  /**
   * 設置環境
   * @returns {Promise<void>}
   */
  async setup () {
    if (this._config.moduleIntegration) {
      await this._setupModuleIntegration()
    }

    if (this._config.eventSystem) {
      this._setupEventSystem()
    }

    this._isSetup = true
  }

  /**
   * 設置模組整合
   */
  async _setupModuleIntegration () {
    this._initializeModuleRegistry()
    await this._loadRequiredModules()
  }

  /**
   * 初始化模組註冊表
   */
  _initializeModuleRegistry () {
    this._modules.set('registry', new Map())
  }

  /**
   * 載入必要模組
   */
  async _loadRequiredModules () {
    // 模擬載入核心模組
    const coreModules = ['EventManager', 'DataProcessor']
    coreModules.forEach(module => {
      this._loadModule(module)
    })
  }

  /**
   * 載入單一模組
   */
  _loadModule (moduleName) {
    const mockModule = { name: moduleName, loaded: true }
    this._modules.get('registry').set(moduleName, mockModule)
  }

  /**
   * 設置事件系統
   */
  _setupEventSystem () {
    global.testEventBus = {
      events: [],
      emit: this._createEmitFunction(),
      on: this._createOnFunction()
    }
  }

  /**
   * 創建emit函數
   */
  _createEmitFunction () {
    return (eventName, data) => {
      this._recordEvent(eventName, data)
    }
  }

  /**
   * 記錄事件
   */
  _recordEvent (eventName, data) {
    global.testEventBus.events.push({
      name: eventName,
      data,
      timestamp: Date.now()
    })
  }

  /**
   * 創建on函數
   */
  _createOnFunction () {
    return (eventName, handler) => {
      // 簡單的事件監聽器實現
    }
  }

  /**
   * 清理環境
   * @returns {Promise<void>}
   */
  async teardown () {
    this._cleanupEventSystem()
    this._cleanupModules()
    this._resetState()
  }

  /**
   * 清理事件系統
   */
  _cleanupEventSystem () {
    if (global.testEventBus) {
      delete global.testEventBus
    }
  }

  /**
   * 清理模組
   */
  _cleanupModules () {
    this._modules.clear()
  }

  /**
   * 重置狀態
   */
  _resetState () {
    this._isSetup = false
  }
}

module.exports = IntegrationTestEnvironment
