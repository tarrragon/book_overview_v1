/**
 * ErrorTestDataFactory - 錯誤測試資料工廠
 * 自動生成各種錯誤場景的測試資料
 *
 * @author TDD Phase 3 - pepper-test-implementer規劃
 * @date 2025-08-25
 */

const { StandardError } = require('src/core/errors/StandardError')

class ErrorTestDataFactory {
  constructor () {
    this.errorTypes = {
      CHROME_EXTENSION: 'chrome_extension',
      NETWORK: 'network',
      DOM: 'dom',
      DATA_PROCESSING: 'data_processing',
      MEMORY: 'memory',
      PERMISSION: 'permission'
    }
  }

  /**
   * 生成Chrome Extension錯誤場景
   * @param {string} scenario - 錯誤場景類型
   * @returns {Object} 錯誤測試資料
   */
  createChromeExtensionError (scenario) {
    const errorData = {
      type: this.errorTypes.CHROME_EXTENSION,
      scenario,
      timestamp: Date.now(),
      testId: this._generateTestId()
    }

    switch (scenario) {
      case 'permission_revoked':
        return {
          ...errorData,
          error: new Error('Permission denied'),
          context: 'storage permission revoked by user',
          expectedBehavior: 'should show permission request dialog',
          recoveryAction: 'request_permission',
          testData: {
            permission: 'storage',
            previouslyGranted: true
          }
        }

      case 'context_invalidated':
        return {
          ...errorData,
          error: new Error('Extension context invalidated'),
          context: 'extension reloaded or updated',
          expectedBehavior: 'should reinitialize extension',
          recoveryAction: 'reinitialize_context',
          testData: {
            reason: 'extension_reload',
            affectedAPIs: ['runtime', 'storage']
          }
        }

      case 'quota_exceeded':
        return {
          ...errorData,
          error: new Error('Quota exceeded'),
          context: 'chrome.storage.local quota limit reached',
          expectedBehavior: 'should show storage cleanup options',
          recoveryAction: 'cleanup_storage',
          testData: {
            quotaLimit: 5242880, // 5MB
            currentUsage: 5300000, // Over limit
            attemptedDataSize: 1024
          }
        }

      case 'api_not_available':
        return {
          ...errorData,
          error: new Error('chrome.storage is not available'),
          context: 'API not available in current context',
          expectedBehavior: 'should use fallback storage mechanism',
          recoveryAction: 'use_fallback_storage',
          testData: {
            unavailableAPI: 'chrome.storage',
            fallbackMethod: 'localStorage'
          }
        }

      case 'csp_violation':
        return {
          ...errorData,
          error: new Error('Content Security Policy violation'),
          context: 'inline script blocked by CSP',
          expectedBehavior: 'should use CSP-compliant methods',
          recoveryAction: 'refactor_to_csp_compliant',
          testData: {
            violationType: 'inline_script',
            blockedContent: 'document.write'
          }
        }

      default:
        throw new StandardError('TEST_ERROR', `Unknown Chrome Extension error scenario: ${scenario}`, { category: 'testing' })
    }
  }

  /**
   * 生成網路錯誤場景
   * @param {string} scenario - 錯誤場景類型
   * @returns {Object} 錯誤測試資料
   */
  createNetworkError (scenario) {
    const errorData = {
      type: this.errorTypes.NETWORK,
      scenario,
      timestamp: Date.now(),
      testId: this._generateTestId()
    }

    switch (scenario) {
      case 'connection_timeout':
        return {
          ...errorData,
          error: new Error('Request timeout'),
          context: 'network request exceeded timeout limit',
          expectedBehavior: 'should retry with exponential backoff',
          recoveryAction: 'retry_with_backoff',
          testData: {
            url: 'https://readmoo.com/api/books',
            timeoutMs: 5000,
            retryAttempts: 3
          }
        }

      case 'network_unavailable':
        return {
          ...errorData,
          error: new Error('Network error'),
          context: 'internet connection lost',
          expectedBehavior: 'should queue requests for later',
          recoveryAction: 'queue_for_retry',
          testData: {
            offlineMode: true,
            queueSize: 0
          }
        }

      case 'dns_resolution_failed':
        return {
          ...errorData,
          error: new Error('DNS resolution failed'),
          context: 'domain name cannot be resolved',
          expectedBehavior: 'should show connection error message',
          recoveryAction: 'show_connection_error',
          testData: {
            domain: 'readmoo.com',
            dnsServer: 'timeout'
          }
        }

      case 'cors_blocked':
        return {
          ...errorData,
          error: new Error('CORS policy blocked request'),
          context: 'cross-origin request blocked',
          expectedBehavior: 'should use proxy or fallback method',
          recoveryAction: 'use_content_script',
          testData: {
            origin: 'chrome-extension://test',
            targetDomain: 'readmoo.com'
          }
        }

      default:
        throw new StandardError('NETWORK_ERROR', `Unknown network error scenario: ${scenario}`, { category: 'testing' })
    }
  }

  /**
   * 生成DOM操作錯誤場景
   * @param {string} scenario - 錯誤場景類型
   * @returns {Object} 錯誤測試資料
   */
  createDomError (scenario) {
    const errorData = {
      type: this.errorTypes.DOM,
      scenario,
      timestamp: Date.now(),
      testId: this._generateTestId()
    }

    switch (scenario) {
      case 'element_not_found':
        return {
          ...errorData,
          error: new Error('Element not found'),
          context: 'required DOM element missing',
          expectedBehavior: 'should wait and retry or show graceful error',
          recoveryAction: 'retry_with_fallback',
          testData: {
            selector: '.book-container',
            retryAttempts: 3,
            fallbackSelector: '.book-item'
          }
        }

      case 'page_structure_changed':
        return {
          ...errorData,
          error: new Error('Page structure changed'),
          context: 'Readmoo updated their page layout',
          expectedBehavior: 'should adapt to new structure or notify user',
          recoveryAction: 'adapt_or_notify',
          testData: {
            expectedElements: ['.book-title', '.book-author'],
            foundElements: ['.new-book-title', '.author-name'],
            adaptationStrategy: 'fuzzy_matching'
          }
        }

      case 'content_loading_timing':
        return {
          ...errorData,
          error: new Error('Content not loaded yet'),
          context: 'tried to access DOM before content loaded',
          expectedBehavior: 'should wait for content or use observer',
          recoveryAction: 'wait_for_content',
          testData: {
            loadingState: 'pending',
            maxWaitTime: 10000,
            observerType: 'MutationObserver'
          }
        }

      default:
        throw new StandardError('TEST_ERROR', `Unknown DOM error scenario: ${scenario}`, { category: 'testing' })
    }
  }

  /**
   * 生成資料處理錯誤場景
   * @param {string} scenario - 錯誤場景類型
   * @returns {Object} 錯誤測試資料
   */
  createDataProcessingError (scenario) {
    const errorData = {
      type: this.errorTypes.DATA_PROCESSING,
      scenario,
      timestamp: Date.now(),
      testId: this._generateTestId()
    }

    switch (scenario) {
      case 'json_parse_error':
        return {
          ...errorData,
          error: new SyntaxError('Unexpected token in JSON'),
          context: 'invalid JSON format in imported file',
          expectedBehavior: 'should show format error and provide help',
          recoveryAction: 'show_format_help',
          testData: {
            invalidJson: '{"books": [{"title": "Test"]}', // Missing closing bracket
            position: 25,
            expectedFormat: '{"books": [...]}'
          }
        }

      case 'data_validation_failed':
        return {
          ...errorData,
          error: new Error('Data validation failed'),
          context: 'imported data does not match expected schema',
          expectedBehavior: 'should show validation errors and suggestions',
          recoveryAction: 'show_validation_errors',
          testData: {
            invalidFields: ['title', 'isbn'],
            validationErrors: [
              { field: 'title', error: 'required field missing' },
              { field: 'isbn', error: 'invalid format' }
            ]
          }
        }

      case 'data_corruption':
        return {
          ...errorData,
          error: new Error('Data corruption detected'),
          context: 'stored data appears to be corrupted',
          expectedBehavior: 'should attempt recovery or reset to defaults',
          recoveryAction: 'attempt_recovery',
          testData: {
            corruptedKeys: ['user_books', 'preferences'],
            backupAvailable: false,
            recoveryOptions: ['reset_to_defaults', 'reimport_data']
          }
        }

      default:
        throw new StandardError('TEST_ERROR', `Unknown data processing error scenario: ${scenario}`, { category: 'testing' })
    }
  }

  /**
   * 生成記憶體相關錯誤場景
   * @param {string} scenario - 錯誤場景類型
   * @returns {Object} 錯誤測試資料
   */
  createMemoryError (scenario) {
    const errorData = {
      type: this.errorTypes.MEMORY,
      scenario,
      timestamp: Date.now(),
      testId: this._generateTestId()
    }

    switch (scenario) {
      case 'out_of_memory':
        return {
          ...errorData,
          error: new Error('Out of memory'),
          context: 'processing large dataset exceeded memory limit',
          expectedBehavior: 'should process in smaller chunks',
          recoveryAction: 'process_in_chunks',
          testData: {
            dataSize: 10000000, // 10MB
            memoryLimit: 5000000, // 5MB
            chunkSize: 1000000 // 1MB chunks
          }
        }

      case 'memory_leak':
        return {
          ...errorData,
          error: new Error('Memory usage continuously increasing'),
          context: 'potential memory leak in data processing',
          expectedBehavior: 'should cleanup unused references',
          recoveryAction: 'cleanup_references',
          testData: {
            initialMemory: 50000000,
            currentMemory: 150000000,
            leakRate: 1000000 // bytes per operation
          }
        }

      default:
        throw new StandardError('TEST_ERROR', `Unknown memory error scenario: ${scenario}`, { category: 'testing' })
    }
  }

  /**
   * 生成測試ID
   * @private
   */
  _generateTestId () {
    return `test_${Date.now()}_${Math.random().toString(36).substring(2)}`
  }

  /**
   * 生成複合錯誤場景 (多個錯誤同時發生)
   * @param {string[]} scenarios - 錯誤場景列表
   * @returns {Object} 複合錯誤測試資料
   */
  createCompoundError (scenarios) {
    const errors = scenarios.map(scenario => {
      const [type, specificScenario] = scenario.split('.')
      switch (type) {
        case 'chrome':
          return this.createChromeExtensionError(specificScenario)
        case 'network':
          return this.createNetworkError(specificScenario)
        case 'dom':
          return this.createDomError(specificScenario)
        case 'data':
          return this.createDataProcessingError(specificScenario)
        case 'memory':
          return this.createMemoryError(specificScenario)
        default:
          throw new StandardError('TEST_ERROR', `Unknown error type: ${type}`, { category: 'testing' })
      }
    })

    return {
      type: 'compound',
      scenarios,
      errors,
      testId: this._generateTestId(),
      timestamp: Date.now(),
      expectedBehavior: 'should handle multiple errors gracefully',
      recoveryAction: 'prioritized_recovery'
    }
  }

  /**
   * 獲取所有可用的錯誤場景
   * @returns {Object} 錯誤場景目錄
   */
  getAvailableScenarios () {
    return {
      chromeExtension: [
        'permission_revoked',
        'context_invalidated',
        'quota_exceeded',
        'api_not_available',
        'csp_violation'
      ],
      network: [
        'connection_timeout',
        'network_unavailable',
        'dns_resolution_failed',
        'cors_blocked'
      ],
      dom: [
        'element_not_found',
        'page_structure_changed',
        'content_loading_timing'
      ],
      dataProcessing: [
        'json_parse_error',
        'data_validation_failed',
        'data_corruption'
      ],
      memory: [
        'out_of_memory',
        'memory_leak'
      ]
    }
  }
}

module.exports = ErrorTestDataFactory
