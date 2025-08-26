/**
 * 單元測試環境建構器
 * 為單元測試提供輕量級的環境設置
 * 遵循 Five Lines 規則和單一責任原則
 *
 * @author TDD Phase 4 - cinnamon-refactor-owl重構設計師
 * @date 2025-08-25
 * @version v0.9.38-refactor
 */

const UnitTestEnvironment = require('./unit-test-environment')

/**
 * 單元測試環境建構器
 * 提供簡化的單元測試環境配置
 */
class UnitTestEnvironmentBuilder {
  constructor () {
    this._initializeConfig()
  }

  /**
   * 初始化配置
   */
  _initializeConfig () {
    this._config = {
      basicMocks: false,
      jestMocks: false,
      spies: false
    }
  }

  /**
   * 啟用基本Mock
   * @returns {UnitTestEnvironmentBuilder}
   */
  withBasicMocks () {
    this._config.basicMocks = true
    return this
  }

  /**
   * 啟用Jest Mock
   * @returns {UnitTestEnvironmentBuilder}
   */
  withJestMocks () {
    this._config.jestMocks = true
    return this
  }

  /**
   * 啟用間諜功能
   * @returns {UnitTestEnvironmentBuilder}
   */
  withSpies () {
    this._config.spies = true
    return this
  }

  /**
   * 建構單元測試環境
   * @returns {UnitTestEnvironment}
   */
  build () {
    return new UnitTestEnvironment(this._config)
  }
}

module.exports = UnitTestEnvironmentBuilder
