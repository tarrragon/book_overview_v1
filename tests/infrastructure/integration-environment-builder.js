/**
 * 整合測試環境建構器
 * 為整合測試提供中等複雜度的環境設置
 * 遵循 Five Lines 規則和單一責任原則
 *
 * @author TDD Phase 4 - cinnamon-refactor-owl重構設計師
 * @date 2025-08-25
 * @version v0.9.38-refactor
 */

const IntegrationTestEnvironment = require('./integration-test-environment')

/**
 * 整合測試環境建構器
 * 提供整合測試環境配置
 */
class IntegrationEnvironmentBuilder {
  constructor () {
    this._initializeConfig()
  }

  /**
   * 初始化配置
   */
  _initializeConfig () {
    this._config = {
      moduleIntegration: false,
      eventSystem: false,
      dataFlow: false
    }
  }

  /**
   * 啟用模組整合
   * @returns {IntegrationEnvironmentBuilder}
   */
  withModuleIntegration () {
    this._config.moduleIntegration = true
    return this
  }

  /**
   * 啟用事件系統
   * @returns {IntegrationEnvironmentBuilder}
   */
  withEventSystem () {
    this._config.eventSystem = true
    return this
  }

  /**
   * 啟用資料流
   * @returns {IntegrationEnvironmentBuilder}
   */
  withDataFlow () {
    this._config.dataFlow = true
    return this
  }

  /**
   * 建構整合測試環境
   * @returns {IntegrationTestEnvironment}
   */
  build () {
    return new IntegrationTestEnvironment(this._config)
  }
}

module.exports = IntegrationEnvironmentBuilder
