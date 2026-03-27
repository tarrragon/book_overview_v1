/**
 * 測試與模擬基礎設施相關錯誤代碼
 *
 * 涵蓋錯誤注入、模擬、測試專用場景。
 * 注意：這些代碼用於測試基礎設施，非生產業務錯誤。
 */
const TestingCodes = {
  ERROR_SIMULATION: 'ERROR_SIMULATION',
  ERROR_INJECTION_NOT_ENABLED: 'ERROR_INJECTION_NOT_ENABLED',
  INVALID_MOCK_IMPLEMENTATION: 'INVALID_MOCK_IMPLEMENTATION',
  RANDOM_FAILURE: 'RANDOM_FAILURE'
}

Object.freeze(TestingCodes)

module.exports = { TestingCodes }
