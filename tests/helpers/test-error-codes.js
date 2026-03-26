/**
 * 測試專用錯誤代碼常數
 *
 * 從 src/core/errors/ErrorCodes.js 遷移而來，
 * 這些常數僅在測試環境中使用，不應存在於生產程式碼中。
 *
 * 提供兩種匯出方式：
 * 1. TestErrorCodes - 僅包含測試專用常數
 * 2. ErrorCodesWithTest - 合併生產 + 測試常數，方便既有測試檔案遷移
 *
 * @see Ticket 0.15.0-W3-005.1
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

const TestErrorCodes = {
  // 測試相關錯誤
  TEST_ERROR: 'TEST_ERROR',
  TEST_MOCK_ERROR: 'TEST_MOCK_ERROR',
  TEST_EXECUTION_ERROR: 'TEST_EXECUTION_ERROR',
  TEST_SIMULATOR_ERROR: 'TEST_SIMULATOR_ERROR',
  TEST_GENERATION_ERROR: 'TEST_GENERATION_ERROR',
  TEST_VALIDATION_ERROR: 'TEST_VALIDATION_ERROR',
  TEST_ENVIRONMENT_ERROR: 'TEST_ENVIRONMENT_ERROR',
  TEST_WORKFLOW_ERROR: 'TEST_WORKFLOW_ERROR',
  TEST_STORAGE_ERROR: 'TEST_STORAGE_ERROR',
  TEST_INITIALIZATION_ERROR: 'TEST_INITIALIZATION_ERROR',
  TESTING_INTEGRITY_ERROR: 'TESTING_INTEGRITY_ERROR',

  // 整合測試錯誤
  INTEGRATION_TEST_ERROR: 'INTEGRATION_TEST_ERROR',
  INTEGRATION_OPERATION_ERROR: 'INTEGRATION_OPERATION_ERROR',

  // E2E 測試錯誤
  E2E_STORAGE_QUOTA_EXCEEDED: 'E2E_STORAGE_QUOTA_EXCEEDED',
  E2E_PERSISTENT_ERROR: 'E2E_PERSISTENT_ERROR',
  E2E_CONTEXT_DISCONNECTED: 'E2E_CONTEXT_DISCONNECTED',
  E2E_CONTENT_SCRIPT_ERROR: 'E2E_CONTENT_SCRIPT_ERROR',
  E2E_CONFLICT_RESOLUTION_UI_TIMEOUT: 'E2E_CONFLICT_RESOLUTION_UI_TIMEOUT'
}

Object.freeze(TestErrorCodes)

/**
 * 合併生產和測試錯誤代碼，供測試檔案使用。
 * 測試檔案可將 import 路徑從 'src/core/errors/ErrorCodes' 改為此檔案，
 * 即可同時存取生產和測試錯誤代碼，無需修改其他程式碼。
 */
const ErrorCodesWithTest = Object.freeze({
  ...ErrorCodes,
  ...TestErrorCodes
})

module.exports = { TestErrorCodes, ErrorCodesWithTest }
