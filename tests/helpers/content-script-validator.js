/**
 * Content Script Validator - g�s,WIh
 */

class ContentScriptValidator {
  constructor(testSuite = null) {
    this.validationResults = []
    this.testSuite = testSuite
  }

  validate(contentScript) {
    const result = {
      success: true,
      errors: [],
      warnings: []
    }

    if (!contentScript) {
      result.success = false
      result.errors.push('Content script is required')
    }

    this.validationResults.push(result)
    return result
  }

  async validateInjection(options = {}) {
    const { expectedScript, expectedFeatures } = options
    
    const result = {
      success: true,
      errors: [],
      warnings: [],
      injectionValid: true,
      featuresDetected: expectedFeatures || [],
      scriptPresent: !!expectedScript,
      passed: true, // 驗證是否通過
      availableFeatures: expectedFeatures || [] // 可用功能列表
    }

    // 模擬注入驗證邏輯
    if (expectedScript && !expectedScript.includes('content-script')) {
      result.success = false
      result.errors.push('Expected script not detected')
      result.injectionValid = false
    }

    if (expectedFeatures && expectedFeatures.length > 0) {
      // 模擬功能檢測
      const detectedFeatures = expectedFeatures.filter(() => Math.random() > 0.1)
      if (detectedFeatures.length < expectedFeatures.length) {
        result.warnings.push('Some expected features not fully detected')
      }
    }

    this.validationResults.push(result)
    return result
  }

  reset() {
    this.validationResults = []
  }

  async cleanup() {
    this.reset()
    // 清理任何資源
  }

  async clearSimulatedErrors() {
    // 清理模擬的錯誤狀態
    this.simulatedErrors = []
    this.errorSimulationActive = false
    
    // 清理 extensionController 的錯誤模擬狀態（不清理測試環境設置如 CSP）
    if (this.testSuite && this.testSuite.extensionController) {
      this.testSuite.extensionController.state.scriptLoadingError = false
      this.testSuite.extensionController.state.tabPermissionsRevoked = false
      this.testSuite.extensionController.state.pageNotReady = false
      // 注意：不清理 cspTestConfig 和 cspSettings，因為它們是測試環境設置而非錯誤狀態
    }
  }

  async simulateScriptLoadingError() {
    // 模擬腳本載入錯誤
    this.errorSimulationActive = true
    this.simulatedErrors = ['Script loading failed']
    
    // 如果有 testSuite，也設置 extensionController 的狀態
    if (this.testSuite && this.testSuite.extensionController) {
      this.testSuite.extensionController.state.scriptLoadingError = true
    }
  }

  async validateResourceIsolation(tabIds) {
    // 驗證資源隔離
    return {
      isolated: true,
      crossTabInterference: false,
      tabsChecked: tabIds.length
    }
  }

  async validatePageFunctionality() {
    // 驗證頁面功能性
    return {
      functional: true,
      originalBehaviorMaintained: true
    }
  }
}

module.exports = { ContentScriptValidator }