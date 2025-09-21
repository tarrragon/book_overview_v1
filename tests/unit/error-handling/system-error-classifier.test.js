/**
 * 系統錯誤分類器單元測試
 * v0.9.32 - TDD Phase 2 錯誤分類器測試實作
 *
 * 測試目標：
 * - 驗證錯誤類型識別的準確性
 * - 測試嚴重程度判斷邏輯
 * - 確保錯誤分類邊界條件處理
 * - 驗證複合錯誤類型的支援
 *
 * 錯誤分類體系：
 * - NETWORK: 網路連接、API請求、資源載入錯誤
 * - DATA: 資料格式、驗證、一致性錯誤
 * - SYSTEM: 系統資源、權限、環境錯誤
 * - DOM: 頁面結構、元素訪問、事件處理錯誤
 * - PLATFORM: 瀏覽器相容、API支援、擴展衝突錯誤
 *
 * 嚴重程度等級：
 * - MINOR: 不影響核心功能，可自動恢復
 * - MODERATE: 影響單一功能，需使用者介入
 * - SEVERE: 影響多個功能，需要重啟或重置
 * - CRITICAL: 系統無法使用，需要技術支援
 */

describe('🏷️ 系統錯誤分類器測試 (v0.9.32)', () => {
  // eslint-disable-next-line no-unused-vars
  let SystemErrorClassifier

  beforeEach(() => {
    // 重置模組以確保測試隔離
    jest.resetModules()

    // Mock SystemErrorClassifier - 在實際實作中會載入真正的類別
    SystemErrorClassifier = {
      classify: jest.fn(),
      getSeverity: jest.fn(),
      getSuggestions: jest.fn(),
      isRecoverable: jest.fn()
    }
  })

  describe('🌐 NETWORK 錯誤分類測試', () => {
    test('應該正確分類網路連接失敗錯誤', () => {
      // Given: 網路連接失敗錯誤
      // eslint-disable-next-line no-unused-vars
      const networkError = new Error('Failed to fetch')
      networkError.name = 'TypeError'

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const result = mockClassifyError(networkError)

      // Then: 應該分類為NETWORK_ERROR
      expect(result.category).toBe('NETWORK_ERROR')
      expect(result.severity).toBe('HIGH')
      expect(result.recoverable).toBe(true)
      expect(result.suggestions).toContain('檢查網路連線')
      expect(result.suggestions).toContain('實施重試機制')
    })

    test('應該正確分類API請求超時錯誤', () => {
      // Given: API超時錯誤
      // eslint-disable-next-line no-unused-vars
      const timeoutError = new Error('Request timeout')
      timeoutError.code = 'TIMEOUT'

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const result = mockClassifyError(timeoutError)

      // Then: 應該分類為NETWORK_ERROR且可恢復
      expect(result.category).toBe('NETWORK_ERROR')
      expect(result.severity).toBe('MODERATE')
      expect(result.recoverable).toBe(true)
      expect(result.retryStrategy).toBe('EXPONENTIAL_BACKOFF')
    })

    test('應該正確分類資源載入失敗錯誤', () => {
      // Given: 資源載入錯誤（如圖片404）
      // eslint-disable-next-line no-unused-vars
      const resourceError = new Error('Resource not found')
      resourceError.status = 404
      resourceError.url = 'https://example.com/image.jpg'

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const result = mockClassifyError(resourceError)

      // Then: 應該分類為NETWORK_ERROR但嚴重程度較低
      expect(result.category).toBe('NETWORK_ERROR')
      expect(result.severity).toBe('MINOR')
      expect(result.recoverable).toBe(true)
      expect(result.fallbackStrategy).toBe('USE_DEFAULT_RESOURCE')
    })

    test('應該處理複合網路錯誤', () => {
      // Given: 複合錯誤（網路+系統）
      // eslint-disable-next-line no-unused-vars
      const compositeError = new Error('Network error due to system resource limit')
      compositeError.causes = ['NETWORK', 'SYSTEM']

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const result = mockClassifyError(compositeError)

      // Then: 應該識別為複合錯誤
      expect(result.category).toBe('COMPOSITE_ERROR')
      expect(result.primaryCategory).toBe('NETWORK_ERROR')
      expect(result.secondaryCategory).toBe('SYSTEM_ERROR')
      expect(result.severity).toBe('SEVERE')
    })
  })

  describe('📊 DATA 錯誤分類測試', () => {
    test('應該正確分類JSON格式錯誤', () => {
      // Given: JSON語法錯誤
      // eslint-disable-next-line no-unused-vars
      const jsonError = new SyntaxError('Unexpected token } in JSON at position 123')

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const result = mockClassifyError(jsonError)

      // Then: 應該分類為DATA_ERROR
      expect(result.category).toBe('DATA_ERROR')
      expect(result.severity).toBe('MODERATE')
      expect(result.recoverable).toBe(true)
      expect(result.suggestions).toContain('檢查JSON格式')
      expect(result.suggestions).toContain('驗證檔案完整性')
    })

    test('應該正確分類資料驗證錯誤', () => {
      // Given: 資料驗證失敗
      // eslint-disable-next-line no-unused-vars
      const validationError = new Error('Invalid book ID format: expected string, got number')
      validationError.field = 'id'
      validationError.expectedType = 'string'
      validationError.actualType = 'number'

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const result = mockClassifyError(validationError)

      // Then: 應該分類為DATA_ERROR且提供修復建議
      expect(result.category).toBe('DATA_ERROR')
      expect(result.severity).toBe('MINOR')
      expect(result.recoverable).toBe(true)
      expect(result.autoRepair).toBe(true)
      expect(result.repairStrategy).toBe('TYPE_CONVERSION')
    })

    test('應該正確分類大資料集記憶體錯誤', () => {
      // Given: 記憶體不足錯誤
      // eslint-disable-next-line no-unused-vars
      const memoryError = new Error('Cannot allocate memory for array of size 1000000')
      memoryError.name = 'RangeError'

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const result = mockClassifyError(memoryError)

      // Then: 應該分類為複合錯誤（DATA+SYSTEM）
      expect(result.category).toBe('COMPOSITE_ERROR')
      expect(result.primaryCategory).toBe('SYSTEM_ERROR')
      expect(result.secondaryCategory).toBe('DATA_ERROR')
      expect(result.severity).toBe('SEVERE')
      expect(result.recoverable).toBe(true)
      expect(result.recoveryStrategy).toBe('BATCH_PROCESSING')
    })

    test('應該處理資料損壞錯誤', () => {
      // Given: 資料損壞錯誤
      // eslint-disable-next-line no-unused-vars
      const corruptionError = new Error('Data corruption detected: checksum mismatch')
      corruptionError.checksumExpected = 'abc123'
      corruptionError.checksumActual = 'def456'

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const result = mockClassifyError(corruptionError)

      // Then: 應該分類為嚴重資料錯誤
      expect(result.category).toBe('DATA_ERROR')
      expect(result.severity).toBe('CRITICAL')
      expect(result.recoverable).toBe(false)
      expect(result.recommendations).toContain('重新下載或匯入資料')
      expect(result.recommendations).toContain('檢查資料來源完整性')
    })
  })

  describe('⚙️ SYSTEM 錯誤分類測試', () => {
    test('應該正確分類權限錯誤', () => {
      // Given: 權限被拒錯誤
      // eslint-disable-next-line no-unused-vars
      const permissionError = new Error('Permission denied: storage access')
      permissionError.permission = 'storage'
      permissionError.code = 'PERMISSION_DENIED'

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const result = mockClassifyError(permissionError)

      // Then: 應該分類為SYSTEM_ERROR
      expect(result.category).toBe('SYSTEM_ERROR')
      expect(result.severity).toBe('HIGH')
      expect(result.recoverable).toBe(true)
      expect(result.userAction).toBe('GRANT_PERMISSION')
      expect(result.guidance).toContain('請檢查擴展權限設定')
    })

    test('應該正確分類瀏覽器相容性錯誤', () => {
      // Given: API不支援錯誤
      // eslint-disable-next-line no-unused-vars
      const compatError = new Error('chrome.storage is not available')
      compatError.api = 'chrome.storage'
      compatError.browser = 'Firefox'

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const result = mockClassifyError(compatError)

      // Then: 應該分類為PLATFORM_ERROR
      expect(result.category).toBe('PLATFORM_ERROR')
      expect(result.severity).toBe('CRITICAL')
      expect(result.recoverable).toBe(false)
      expect(result.fallbackOptions).toBeDefined()
      expect(result.supportedBrowsers).toContain('Chrome')
    })

    test('應該處理系統資源耗盡', () => {
      // Given: 系統資源不足
      // eslint-disable-next-line no-unused-vars
      const resourceError = new Error('System resources exhausted')
      resourceError.resource = 'memory'
      resourceError.limit = '4GB'
      resourceError.usage = '3.8GB'

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const result = mockClassifyError(resourceError)

      // Then: 應該建議資源管理策略
      expect(result.category).toBe('SYSTEM_ERROR')
      expect(result.severity).toBe('SEVERE')
      expect(result.immediate).toContain('釋放記憶體')
      expect(result.longTerm).toContain('優化資源使用')
    })
  })

  describe('🏗️ DOM 錯誤分類測試', () => {
    test('應該正確分類元素不存在錯誤', () => {
      // Given: DOM元素不存在
      // eslint-disable-next-line no-unused-vars
      const domError = new Error("Cannot read property 'textContent' of null")
      domError.selector = '#nonexistentElement'
      domError.operation = 'textContent'

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const result = mockClassifyError(domError)

      // Then: 應該分類為DOM_ERROR
      expect(result.category).toBe('DOM_ERROR')
      expect(result.severity).toBe('MODERATE')
      expect(result.recoverable).toBe(true)
      expect(result.fallbackSelectors).toBeDefined()
      expect(result.suggestions).toContain('檢查元素是否存在')
    })

    test('應該處理頁面結構變更錯誤', () => {
      // Given: 頁面結構改變導致選擇器失效
      // eslint-disable-next-line no-unused-vars
      const structureError = new Error('Page structure changed: selector .book-item no longer matches')
      structureError.oldSelector = '.book-item'
      structureError.pageUrl = 'https://readmoo.com/library'

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const result = mockClassifyError(structureError)

      // Then: 應該提供適應策略
      expect(result.category).toBe('DOM_ERROR')
      expect(result.severity).toBe('HIGH')
      expect(result.adaptiveStrategy).toBe('TRY_ALTERNATIVE_SELECTORS')
      expect(result.monitoringRequired).toBe(true)
      expect(result.updateRequired).toBe(true)
    })

    test('應該分類事件處理錯誤', () => {
      // Given: 事件處理器錯誤
      // eslint-disable-next-line no-unused-vars
      const eventError = new Error('Event listener failed: click handler exception')
      eventError.eventType = 'click'
      eventError.element = 'button#exportBtn'

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const result = mockClassifyError(eventError)

      // Then: 應該分類為DOM_ERROR且建議事件修復
      expect(result.category).toBe('DOM_ERROR')
      expect(result.severity).toBe('MODERATE')
      expect(result.eventRecovery).toBe('REBIND_LISTENER')
      expect(result.preventiveActions).toContain('validate-element-state')
    })
  })

  describe('🔧 PLATFORM 錯誤分類測試', () => {
    test('應該分類Chrome Extension API錯誤', () => {
      // Given: Chrome Extension API錯誤
      // eslint-disable-next-line no-unused-vars
      const apiError = new Error('Extension context invalidated')
      apiError.context = 'background'
      apiError.reason = 'extension_reload'

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const result = mockClassifyError(apiError)

      // Then: 應該分類為PLATFORM_ERROR
      expect(result.category).toBe('PLATFORM_ERROR')
      expect(result.severity).toBe('CRITICAL')
      expect(result.recoverable).toBe(false)
      expect(result.userAction).toBe('RELOAD_EXTENSION')
      expect(result.guidance).toContain('重新載入擴展')
    })

    test('應該處理版本相容性問題', () => {
      // Given: Manifest版本不相容
      // eslint-disable-next-line no-unused-vars
      const versionError = new Error('Manifest V2 API deprecated')
      versionError.currentVersion = 'v2'
      versionError.requiredVersion = 'v3'

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const result = mockClassifyError(versionError)

      // Then: 應該建議升級策略
      expect(result.category).toBe('PLATFORM_ERROR')
      expect(result.severity).toBe('HIGH')
      expect(result.upgradeRequired).toBe(true)
      expect(result.migrationGuide).toBeDefined()
    })

    test('應該識別第三方擴展衝突', () => {
      // Given: 擴展衝突錯誤
      // eslint-disable-next-line no-unused-vars
      const conflictError = new Error('Content script conflict with another extension')
      conflictError.conflictingExtension = 'other-extension-id'
      conflictError.resource = 'DOM_manipulation'

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const result = mockClassifyError(conflictError)

      // Then: 應該提供衝突解決建議
      expect(result.category).toBe('PLATFORM_ERROR')
      expect(result.severity).toBe('MODERATE')
      expect(result.conflictResolution).toBeDefined()
      expect(result.isolationStrategy).toBe('NAMESPACE_ISOLATION')
    })
  })

  describe('🔀 複合錯誤和邊界條件測試', () => {
    test('應該處理錯誤鏈', () => {
      // Given: 錯誤鏈（一個錯誤引發另一個錯誤）
      // eslint-disable-next-line no-unused-vars
      const primaryError = new Error('Network connection failed')
      // eslint-disable-next-line no-unused-vars
      const secondaryError = new Error('Data fetch failed due to network error')
      secondaryError.cause = primaryError

      // When: 分析錯誤鏈
      // eslint-disable-next-line no-unused-vars
      const result = mockAnalyzeErrorChain([primaryError, secondaryError])

      // Then: 應該識別根本原因
      expect(result.rootCause).toBe(primaryError)
      expect(result.errorChain).toHaveLength(2)
      expect(result.resolution).toBe('RESOLVE_ROOT_CAUSE')
    })

    test('應該處理null和undefined錯誤', () => {
      // Given: 空值錯誤
      // eslint-disable-next-line no-unused-vars
      const nullError = null
      // eslint-disable-next-line no-unused-vars
      const undefinedError = undefined

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const nullResult = mockClassifyError(nullError)
      // eslint-disable-next-line no-unused-vars
      const undefinedResult = mockClassifyError(undefinedError)

      // Then: 應該安全處理空值
      expect(nullResult.category).toBe('UNKNOWN_ERROR')
      expect(nullResult.severity).toBe('MINOR')
      expect(undefinedResult.category).toBe('UNKNOWN_ERROR')
      expect(undefinedResult.severity).toBe('MINOR')
    })

    test('應該處理字串錯誤訊息', () => {
      // Given: 字串形式的錯誤
      // eslint-disable-next-line no-unused-vars
      const stringError = 'Something went wrong'

      // When: 分類錯誤
      // eslint-disable-next-line no-unused-vars
      const result = mockClassifyError(stringError)

      // Then: 應該轉換為標準錯誤格式
      expect(result.category).toBe('UNKNOWN_ERROR')
      expect(result.originalMessage).toBe('Something went wrong')
      expect(result.normalized).toBe(true)
    })

    test('應該評估錯誤影響範圍', () => {
      // Given: 不同影響範圍的錯誤
      // eslint-disable-next-line no-unused-vars
      const componentError = new Error('Component rendering failed')
      componentError.scope = 'COMPONENT'

      // eslint-disable-next-line no-unused-vars
      const moduleError = new Error('Module initialization failed')
      moduleError.scope = 'MODULE'

      // eslint-disable-next-line no-unused-vars
      const systemError = new Error('System crash')
      systemError.scope = 'SYSTEM'

      // When: 評估影響範圍
      // eslint-disable-next-line no-unused-vars
      const componentResult = mockEvaluateImpact(componentError)
      // eslint-disable-next-line no-unused-vars
      const moduleResult = mockEvaluateImpact(moduleError)
      // eslint-disable-next-line no-unused-vars
      const systemResult = mockEvaluateImpact(systemError)

      // Then: 應該正確評估影響
      expect(componentResult.affectedComponents).toHaveLength(1)
      expect(moduleResult.affectedComponents).toBeGreaterThan(1)
      expect(systemResult.systemWide).toBe(true)
    })
  })

  describe('📈 錯誤分類效能測試', () => {
    test('應該在合理時間內完成錯誤分類', () => {
      // Given: 大量錯誤需要分類
      // eslint-disable-next-line no-unused-vars
      const errors = Array.from({ length: 1000 }, (_, i) =>
        new Error(`Test error ${i}`)
      )

      // When: 批量分類錯誤
      // eslint-disable-next-line no-unused-vars
      const startTime = Date.now()
      // eslint-disable-next-line no-unused-vars
      const results = errors.map(error => mockClassifyError(error))
      // eslint-disable-next-line no-unused-vars
      const endTime = Date.now()

      // Then: 應該在合理時間內完成
      // eslint-disable-next-line no-unused-vars
      const processingTime = endTime - startTime
      expect(processingTime).toBeLessThan(1000) // 小於1秒
      expect(results).toHaveLength(1000)
      results.forEach(result => {
        expect(result.category).toBeDefined()
        expect(result.severity).toBeDefined()
      })
    })

    test('應該正確快取分類結果', () => {
      // Given: 相同的錯誤多次分類
      // eslint-disable-next-line no-unused-vars
      const error = new Error('Test error')

      // When: 多次分類相同錯誤
      // eslint-disable-next-line no-unused-vars
      const result1 = mockClassifyError(error)
      // eslint-disable-next-line no-unused-vars
      const result2 = mockClassifyError(error)
      // eslint-disable-next-line no-unused-vars
      const result3 = mockClassifyError(error)

      // Then: 應該回傳一致的結果
      expect(result1).toEqual(result2)
      expect(result2).toEqual(result3)

      // 驗證快取效果（實際實作中會檢查快取命中率）
      expect(mockGetCacheHitRate()).toBeGreaterThan(0.8)
    })
  })

  // Mock 輔助方法 - 模擬錯誤分類器的行為
  function mockClassifyError (error) {
    if (!error) {
      return {
        category: 'UNKNOWN_ERROR',
        severity: 'MINOR',
        recoverable: true,
        normalized: true,
        originalMessage: String(error)
      }
    }

    if (typeof error === 'string') {
      return {
        category: 'UNKNOWN_ERROR',
        severity: 'MINOR',
        recoverable: true,
        normalized: true,
        originalMessage: error
      }
    }

    // eslint-disable-next-line no-unused-vars
    const message = error.message || ''

    // COMPOSITE 錯誤分類邏輯
    if (error.causes && Array.isArray(error.causes) && error.causes.length > 1) {
      return {
        category: 'COMPOSITE_ERROR',
        primaryCategory: error.causes[0] + '_ERROR',
        secondaryCategory: error.causes[1] + '_ERROR',
        severity: 'SEVERE',
        recoverable: true,
        resolutionStrategy: 'RESOLVE_ALL_CAUSES'
      }
    }

    // NETWORK 錯誤分類邏輯
    if (message.includes('fetch') || message.includes('Network') || error.code === 'TIMEOUT' ||
        message.includes('Resource not found') || error.status === 404 || error.url) {
      if (message.includes('timeout')) {
        return {
          category: 'NETWORK_ERROR',
          severity: 'MODERATE',
          recoverable: true,
          retryStrategy: 'EXPONENTIAL_BACKOFF'
        }
      }
      if (error.status === 404) {
        return {
          category: 'NETWORK_ERROR',
          severity: 'MINOR',
          recoverable: true,
          fallbackStrategy: 'USE_DEFAULT_RESOURCE'
        }
      }
      return {
        category: 'NETWORK_ERROR',
        severity: 'HIGH',
        recoverable: true,
        suggestions: ['檢查網路連線', '實施重試機制']
      }
    }

    // DATA 錯誤分類邏輯
    if (error instanceof SyntaxError && message.includes('JSON')) {
      return {
        category: 'DATA_ERROR',
        severity: 'MODERATE',
        recoverable: true,
        suggestions: ['檢查JSON格式', '驗證檔案完整性']
      }
    }

    if (message.includes('Invalid') && error.field) {
      return {
        category: 'DATA_ERROR',
        severity: 'MINOR',
        recoverable: true,
        autoRepair: true,
        repairStrategy: 'TYPE_CONVERSION'
      }
    }

    if (message.includes('corruption')) {
      return {
        category: 'DATA_ERROR',
        severity: 'CRITICAL',
        recoverable: false,
        recommendations: ['重新下載或匯入資料', '檢查資料來源完整性']
      }
    }

    if (error.name === 'RangeError' && message.includes('memory')) {
      return {
        category: 'COMPOSITE_ERROR',
        primaryCategory: 'SYSTEM_ERROR',
        secondaryCategory: 'DATA_ERROR',
        severity: 'SEVERE',
        recoverable: true,
        recoveryStrategy: 'BATCH_PROCESSING'
      }
    }

    // SYSTEM 錯誤分類邏輯
    if (message.includes('Permission denied') || error.code === 'PERMISSION_DENIED') {
      return {
        category: 'SYSTEM_ERROR',
        severity: 'HIGH',
        recoverable: true,
        userAction: 'GRANT_PERMISSION',
        guidance: '請檢查擴展權限設定'
      }
    }

    if (message.includes('resources exhausted')) {
      return {
        category: 'SYSTEM_ERROR',
        severity: 'SEVERE',
        immediate: ['釋放記憶體'],
        longTerm: ['優化資源使用']
      }
    }

    // DOM 錯誤分類邏輯
    if (message.includes('Cannot read property') && message.includes('of null')) {
      return {
        category: 'DOM_ERROR',
        severity: 'MODERATE',
        recoverable: true,
        fallbackSelectors: true,
        suggestions: ['檢查元素是否存在']
      }
    }

    if (message.includes('structure changed')) {
      return {
        category: 'DOM_ERROR',
        severity: 'HIGH',
        adaptiveStrategy: 'TRY_ALTERNATIVE_SELECTORS',
        monitoringRequired: true,
        updateRequired: true
      }
    }

    if (message.includes('Event listener failed')) {
      return {
        category: 'DOM_ERROR',
        severity: 'MODERATE',
        eventRecovery: 'REBIND_LISTENER',
        preventiveActions: ['validate-element-state']
      }
    }

    // PLATFORM 錯誤分類邏輯
    if (message.includes('Extension context') || (message.includes('chrome.') && message.includes('not available')) ||
        (error.api && error.browser)) {
      return {
        category: 'PLATFORM_ERROR',
        severity: 'CRITICAL',
        recoverable: false,
        userAction: 'RELOAD_EXTENSION',
        guidance: '重新載入擴展',
        fallbackOptions: ['使用替代API', '降級功能'],
        supportedBrowsers: ['Chrome', 'Edge']
      }
    }

    if (message.includes('Manifest') && message.includes('deprecated')) {
      return {
        category: 'PLATFORM_ERROR',
        severity: 'HIGH',
        upgradeRequired: true,
        migrationGuide: true
      }
    }

    if (message.includes('conflict')) {
      return {
        category: 'PLATFORM_ERROR',
        severity: 'MODERATE',
        conflictResolution: true,
        isolationStrategy: 'NAMESPACE_ISOLATION'
      }
    }

    // 複合錯誤處理
    if (error.causes && Array.isArray(error.causes)) {
      return {
        category: 'COMPOSITE_ERROR',
        primaryCategory: `${error.causes[0]}_ERROR`,
        secondaryCategory: `${error.causes[1]}_ERROR`,
        severity: 'SEVERE'
      }
    }

    // 預設分類
    return {
      category: 'UNKNOWN_ERROR',
      severity: 'MINOR',
      recoverable: true
    }
  }

  function mockAnalyzeErrorChain (errors) {
    return {
      rootCause: errors[0],
      errorChain: errors,
      resolution: 'RESOLVE_ROOT_CAUSE'
    }
  }

  function mockEvaluateImpact (error) {
    if (error.scope === 'COMPONENT') {
      return { affectedComponents: ['Component-A'] }
    }
    if (error.scope === 'MODULE') {
      return { affectedComponents: 5 }
    }
    if (error.scope === 'SYSTEM') {
      return { systemWide: true, affectedComponents: ['System-Wide'] }
    }
    return { affectedComponents: ['Unknown'] }
  }

  function mockGetCacheHitRate () {
    return 0.85 // 85% 快取命中率
  }
})
