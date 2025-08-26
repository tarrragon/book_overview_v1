/**
 * 測試基礎設施工廠
 * 統一管理所有測試組件創建，遵循 Factory Pattern
 * 提供標準化測試環境建立，解決測試設置重複問題
 *
 * @author TDD Phase 4 - cinnamon-refactor-owl重構設計師
 * @date 2025-08-25
 * @version v0.9.38-refactor
 */

const E2EEnvironmentBuilder = require('./e2e-environment-builder')
const UnitTestEnvironmentBuilder = require('./unit-test-environment-builder')
const IntegrationEnvironmentBuilder = require('./integration-environment-builder')

/**
 * 測試基礎設施工廠
 * 使用 Factory Pattern 提供統一的測試環境創建接口
 */
class TestInfrastructureFactory {
  /**
   * 創建 E2E 測試環境建構器
   * @returns {E2EEnvironmentBuilder} E2E環境建構器實例
   */
  static createE2EEnvironment () {
    return new E2EEnvironmentBuilder()
  }

  /**
   * 創建單元測試環境建構器
   * @returns {UnitTestEnvironmentBuilder} 單元測試環境建構器實例
   */
  static createUnitTestEnvironment () {
    return new UnitTestEnvironmentBuilder()
  }

  /**
   * 創建整合測試環境建構器
   * @returns {IntegrationEnvironmentBuilder} 整合測試環境建構器實例
   */
  static createIntegrationEnvironment () {
    return new IntegrationEnvironmentBuilder()
  }

  /**
   * 快速創建標準E2E環境
   * 提供常用E2E環境的快速創建方法
   * @param {Object} options - 快速創建選項
   * @returns {Promise<E2ETestEnvironment>} 配置完成的E2E測試環境
   */
  static async createStandardE2EEnvironment (options = {}) {
    return this.createE2EEnvironment()
      .withChromeAPIMock(options.chromeAPI || {})
      .withErrorInjection(options.errorConfig || {})
      .withMemoryMonitoring(options.memoryConfig || {})
      .withEventSimulation(options.eventConfig || {})
      .build()
  }

  /**
   * 創建輕量級測試環境
   * 用於快速單元測試，只包含最基本的Mock
   * @returns {Promise<UnitTestEnvironment>} 輕量級測試環境
   */
  static async createLightweightEnvironment () {
    return this.createUnitTestEnvironment()
      .withBasicMocks()
      .build()
  }

  /**
   * 創建效能測試環境
   * 特別針對效能測試的需求配置
   * @param {Object} perfConfig - 效能測試配置
   * @returns {Promise<E2ETestEnvironment>} 效能測試環境
   */
  static async createPerformanceTestEnvironment (perfConfig = {}) {
    return this.createE2EEnvironment()
      .withChromeAPIMock()
      .withMemoryMonitoring({
        highPrecision: true,
        trackingInterval: perfConfig.interval || 100
      })
      .withEventSimulation()
      .build()
  }
}

module.exports = TestInfrastructureFactory
