/**
 * E2E測試環境建構器
 * 使用 Builder Pattern 簡化複雜測試環境設置
 * 符合 Five Lines 規則和單一責任原則
 *
 * @author TDD Phase 4 - cinnamon-refactor-owl重構設計師
 * @date 2025-08-25
 * @version v0.9.38-refactor
 */

const E2ETestEnvironment = require('./e2e-test-environment')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

/**
 * E2E測試環境建構器
 * 提供流暢的API來配置複雜的E2E測試環境
 */
class E2EEnvironmentBuilder {
  constructor () {
    this._initializeConfig()
  }

  /**
   * 初始化配置對象
   */
  _initializeConfig () {
    this._config = {
      chromeAPIMock: false,
      errorInjection: false,
      memoryMonitoring: false,
      eventSimulation: false,
      chromeAPIConfig: {},
      errorConfig: {},
      memoryConfig: {},
      eventConfig: {}
    }
  }

  /**
   * 啟用 Chrome API Mock
   * @param {Object} config - Chrome API Mock 配置
   * @returns {E2EEnvironmentBuilder} 建構器實例（支援鏈式調用）
   */
  withChromeAPIMock (config = {}) {
    this._enableChromeAPIMock()
    this._setChromeAPIConfig(config)
    return this
  }

  /**
   * 啟用Chrome API Mock
   */
  _enableChromeAPIMock () {
    this._config.chromeAPIMock = true
  }

  /**
   * 設置Chrome API配置
   */
  _setChromeAPIConfig (config) {
    this._config.chromeAPIConfig = config
  }

  /**
   * 啟用錯誤注入
   * @param {Object} config - 錯誤注入配置
   * @returns {E2EEnvironmentBuilder} 建構器實例
   */
  withErrorInjection (config = {}) {
    this._enableErrorInjection()
    this._setErrorConfig(config)
    return this
  }

  /**
   * 啟用錯誤注入功能
   */
  _enableErrorInjection () {
    this._config.errorInjection = true
  }

  /**
   * 設置錯誤注入配置
   */
  _setErrorConfig (config) {
    this._config.errorConfig = config
  }

  /**
   * 啟用記憶體監控
   * @param {Object} config - 記憶體監控配置
   * @returns {E2EEnvironmentBuilder} 建構器實例
   */
  withMemoryMonitoring (config = {}) {
    this._enableMemoryMonitoring()
    this._setMemoryConfig(config)
    return this
  }

  /**
   * 啟用記憶體監控功能
   */
  _enableMemoryMonitoring () {
    this._config.memoryMonitoring = true
  }

  /**
   * 設置記憶體監控配置
   */
  _setMemoryConfig (config) {
    this._config.memoryConfig = config
  }

  /**
   * 啟用事件模擬
   * @param {Object} config - 事件模擬配置
   * @returns {E2EEnvironmentBuilder} 建構器實例
   */
  withEventSimulation (config = {}) {
    this._enableEventSimulation()
    this._setEventConfig(config)
    return this
  }

  /**
   * 啟用事件模擬功能
   */
  _enableEventSimulation () {
    this._config.eventSimulation = true
  }

  /**
   * 設置事件模擬配置
   */
  _setEventConfig (config) {
    this._config.eventConfig = config
  }

  /**
   * 建構並返回配置完成的E2E測試環境
   * @returns {E2ETestEnvironment} 完整的E2E測試環境實例
   */
  build () {
    this._validateConfiguration()
    return new E2ETestEnvironment(this._config)
  }

  /**
   * 驗證建構器配置的有效性
   * @throws {Error} 配置無效時拋出錯誤
   */
  _validateConfiguration () {
    this._validateConfigObject()
    this._validateRequiredFeatures()
  }

  /**
   * 驗證配置對象完整性
   */
  _validateConfigObject () {
    if (!this._config || typeof this._config !== 'object') {
      throw (() => { const error = new Error( 'Invalid configuration object'); error.code = ErrorCodes.'VALIDATION_FAILED'; error.details =  { category: 'testing' }; return error })()
    }
  }

  /**
   * 驗證必要功能已啟用
   */
  _validateRequiredFeatures () {
    const hasAnyFeature = this._hasAnyFeatureEnabled()
    if (!hasAnyFeature) {
      throw (() => { const error = new Error( 'At least one testing feature must be enabled'); error.code = ErrorCodes.'TEST_ERROR'; error.details =  { category: 'testing' }; return error })()
    }
  }

  /**
   * 檢查是否有任何功能被啟用
   * @returns {boolean} 是否有功能被啟用
   */
  _hasAnyFeatureEnabled () {
    const features = ['chromeAPIMock', 'errorInjection', 'memoryMonitoring', 'eventSimulation']
    return features.some(feature => this._config[feature])
  }
}

module.exports = E2EEnvironmentBuilder
