/**
 * UC01ErrorFactory 單元測試
 * 測試 UC-01 首次使用專用錯誤建立工廠的所有功能
 * 基於 UC-02 成功測試模式，針對首次安裝場景優化
 */

import { UC01ErrorFactory } from '../../../../src/core/errors/UC01ErrorFactory.js'
import { ErrorCodes } from '../../../../src/core/errors/ErrorCodes.js'

describe('UC01ErrorFactory', () => {
  afterEach(() => {
    // 清除快取避免測試間影響
    UC01ErrorFactory.clearCache()
  })

  describe('createError', () => {
    test('應該建立基本的 UC-01 錯誤', () => {
      const error = UC01ErrorFactory.createError(
        'DOM_READMOO_PAGE_NOT_DETECTED',
        '無法檢測到 Readmoo 書庫頁面'
      )

      expect(error).toBeInstanceOf(Error)
      expect(error.code).toBe(ErrorCodes.DOM_ERROR)
      expect(error.message).toBe('無法檢測到 Readmoo 書庫頁面')
      expect(error.details.originalCode).toBe('DOM_READMOO_PAGE_NOT_DETECTED')
    })

    test('應該建立帶有詳細資訊的錯誤', () => {
      const details = {
        currentUrl: 'https://example.com',
        expectedPatterns: ['readmoo.com']
      }

      const error = UC01ErrorFactory.createError(
        'DOM_READMOO_PAGE_NOT_DETECTED',
        '頁面檢測失敗',
        details
      )

      expect(error.details).toMatchObject(details)
      expect(error.details.originalCode).toBe('DOM_READMOO_PAGE_NOT_DETECTED')
    })
  })

  describe('createResult', () => {
    test('應該建立成功結果物件', () => {
      const result = UC01ErrorFactory.createResult(true, { books: [] })

      expect(result).toEqual({
        success: true,
        data: { books: [] },
        code: 'SUCCESS',
        message: 'Operation completed successfully'
      })
    })

    test('應該建立失敗結果物件', () => {
      const error = UC01ErrorFactory.createError(
        'DOM_READMOO_PAGE_NOT_DETECTED',
        '檢測失敗'
      )

      const result = UC01ErrorFactory.createResult(false, null, error)

      expect(result).toEqual({
        success: false,
        error: '檢測失敗',
        code: ErrorCodes.DOM_ERROR,
        details: error.details,
        subType: 'PAGE_NOT_DETECTED'
      })
    })

    test('應該處理簡單錯誤物件', () => {
      const simpleError = { message: '簡單錯誤' }
      const result = UC01ErrorFactory.createResult(false, null, simpleError)

      expect(result).toEqual({
        success: false,
        error: '簡單錯誤',
        code: ErrorCodes.UNKNOWN_ERROR,
        details: {},
        subType: 'UNKNOWN'
      })
    })
  })

  describe('createPageDetectionError', () => {
    test('應該建立頁面檢測錯誤', () => {
      const error = UC01ErrorFactory.createPageDetectionError(
        'https://example.com',
        ['readmoo.com/library'],
        { retry: true }
      )

      expect(error.code).toBe(ErrorCodes.DOM_ERROR)
      expect(error.message).toBe('無法檢測到 Readmoo 書庫頁面')
      expect(error.details).toMatchObject({
        currentUrl: 'https://example.com',
        expectedPatterns: ['readmoo.com/library'],
        suggestedAction: 'navigate_to_readmoo_library',
        userGuidance: '請先前往 Readmoo 書庫頁面，再使用書籍提取功能',
        retry: true
      })
    })

    test('應該使用預設參數', () => {
      const error = UC01ErrorFactory.createPageDetectionError('https://test.com')

      expect(error.details.expectedPatterns).toEqual([
        'readmoo.com/library',
        'readmoo.com/shelf'
      ])
    })
  })

  describe('createBookElementsError', () => {
    test('應該建立書籍元素錯誤', () => {
      const selectors = ['.book-card', '.library-item']
      const error = UC01ErrorFactory.createBookElementsError(
        selectors,
        { domChanged: true }
      )

      expect(error.code).toBe(ErrorCodes.DOM_ERROR)
      expect(error.message).toBe('頁面中找不到書籍元素')
      expect(error.details).toMatchObject({
        searchSelectors: selectors,
        pageStructureChanged: true,
        fallbackAttempted: false,
        suggestedAction: 'refresh_page_or_check_library',
        domChanged: true
      })
    })

    test('應該使用預設選擇器', () => {
      const error = UC01ErrorFactory.createBookElementsError()

      expect(error.details.searchSelectors).toEqual([
        '.book-item',
        '.library-book',
        '[data-book-id]'
      ])
    })
  })

  describe('createPartialExtractionError', () => {
    test('應該建立部分提取失敗錯誤', () => {
      const error = UC01ErrorFactory.createPartialExtractionError(
        10, 7,
        [{ title: 'Book1' }, { title: 'Book2' }],
        { reason: 'network_timeout' }
      )

      expect(error.code).toBe(ErrorCodes.DOM_ERROR)
      expect(error.message).toBe('部分書籍資料提取失敗')
      expect(error.details).toMatchObject({
        totalBooks: 10,
        successfulExtractions: 7,
        failedBooks: [{ title: 'Book1' }, { title: 'Book2' }],
        successRate: '70.0%',
        impact: 'partial_data_available',
        reason: 'network_timeout'
      })
    })

    test('應該處理零書籍的情況', () => {
      const error = UC01ErrorFactory.createPartialExtractionError(0, 0)

      expect(error.details.successRate).toBe('0%')
    })
  })

  describe('createNetworkUnreachableError', () => {
    test('應該建立網路無法連接錯誤', () => {
      const error = UC01ErrorFactory.createNetworkUnreachableError(
        'readmoo.com/api',
        10000,
        5,
        { errorCode: 'ENOTFOUND' }
      )

      expect(error.code).toBe(ErrorCodes.NETWORK_ERROR)
      expect(error.message).toBe('Readmoo 服務暫時無法連接')
      expect(error.details).toMatchObject({
        endpoint: 'readmoo.com/api',
        timeout: 10000,
        retryCount: 5,
        suggestedActions: ['check_network_connection', 'retry_later', 'use_offline_mode'],
        troubleshooting: 'network_diagnostics_available',
        errorCode: 'ENOTFOUND'
      })
    })

    test('應該使用預設參數', () => {
      const error = UC01ErrorFactory.createNetworkUnreachableError()

      expect(error.details.endpoint).toBe('readmoo.com')
      expect(error.details.timeout).toBe(5000)
      expect(error.details.retryCount).toBe(3)
    })
  })

  describe('createPermissionDeniedError', () => {
    test('應該建立權限拒絕錯誤', () => {
      const required = ['activeTab', 'storage', 'scripting']
      const missing = ['scripting']

      const error = UC01ErrorFactory.createPermissionDeniedError(
        required,
        missing,
        { chromeVersion: '91.0.4472.124' }
      )

      expect(error.code).toBe(ErrorCodes.CHROME_ERROR)
      expect(error.message).toBe('Extension 權限不足')
      expect(error.details).toMatchObject({
        requiredPermissions: required,
        missingPermissions: missing,
        chromeVersion: '91.0.4472.124',
        suggestedActions: ['reauthorize_extension', 'check_extension_settings', 'reinstall_if_needed'],
        userGuidance: '請重新授權 Extension 權限以繼續使用'
      })
    })

    test('應該使用預設權限列表', () => {
      const error = UC01ErrorFactory.createPermissionDeniedError()

      expect(error.details.requiredPermissions).toEqual(['activeTab', 'storage'])
      expect(error.details.missingPermissions).toEqual(['activeTab'])
    })
  })

  describe('createStorageQuotaError', () => {
    test('應該建立儲存空間不足錯誤', () => {
      const error = UC01ErrorFactory.createStorageQuotaError(
        6.2,
        5.0,
        { itemsCount: 1250 }
      )

      expect(error.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(error.message).toBe('Extension 儲存空間不足')
      expect(error.details).toMatchObject({
        currentUsage: 6.2,
        maxQuota: 5.0,
        unit: 'MB',
        utilizationRate: '124.0%',
        suggestedActions: ['clear_old_data', 'export_then_delete', 'upgrade_storage'],
        cleanupAvailable: true,
        itemsCount: 1250
      })
    })

    test('應該處理零配額的情況', () => {
      const error = UC01ErrorFactory.createStorageQuotaError(1.0, 0)

      expect(error.details.utilizationRate).toBe('100%')
    })
  })

  describe('createInitialStorageCorruptionError', () => {
    test('應該建立初始儲存損壞錯誤', () => {
      const corruptedData = {
        invalidEntries: 3,
        recoveredEntries: 5
      }

      const error = UC01ErrorFactory.createInitialStorageCorruptionError(
        corruptedData,
        { detectedAt: 'initialization' }
      )

      expect(error.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(error.message).toBe('初始化儲存資料時發現損壞')
      expect(error.details).toMatchObject({
        corruptedData,
        recoveryAttempted: true,
        backupAvailable: false,
        autoRepairEnabled: true,
        suggestedActions: ['auto_repair', 'clean_reinstall'],
        detectedAt: 'initialization'
      })
    })
  })

  describe('getCommonError - 快取機制', () => {
    test('應該快取常用錯誤', () => {
      const error1 = UC01ErrorFactory.getCommonError('PAGE_DETECTION')
      const error2 = UC01ErrorFactory.getCommonError('PAGE_DETECTION')

      expect(error1).toBe(error2) // 相同參考
      expect(Object.isFrozen(error1)).toBe(true)
      expect(error1.details.cached).toBe(true)
    })

    test('應該支援所有快取錯誤類型', () => {
      const cacheTypes = [
        'PAGE_DETECTION',
        'PERMISSION_DENIED',
        'STORAGE_QUOTA',
        'NETWORK_UNREACHABLE'
      ]

      cacheTypes.forEach(type => {
        const error = UC01ErrorFactory.getCommonError(type)
        expect(error).toBeInstanceOf(Error)
        expect(error.details.cached).toBe(true)
      })
    })

    test('應該處理未知快取類型', () => {
      const error = UC01ErrorFactory.getCommonError('UNKNOWN_TYPE')
      expect(error).toBeNull()
    })
  })

  describe('clearCache', () => {
    test('應該清除錯誤快取', () => {
      // 建立快取
      UC01ErrorFactory.getCommonError('PAGE_DETECTION')

      // 清除快取
      UC01ErrorFactory.clearCache()

      // 重新取得應該是新物件
      const error1 = UC01ErrorFactory.getCommonError('PAGE_DETECTION')
      const error2 = UC01ErrorFactory.getCommonError('PAGE_DETECTION')

      expect(error1).toBe(error2) // 新快取中相同
      expect(error1.details.cached).toBe(true)
    })
  })

  describe('sanitizeDetails', () => {
    test('應該保留正常大小的詳細資訊', () => {
      const details = {
        url: 'https://example.com',
        count: 10,
        items: ['a', 'b', 'c']
      }

      const sanitized = UC01ErrorFactory.sanitizeDetails(details)
      expect(sanitized).toEqual(details)
    })

    test('應該截斷過大的詳細資訊', () => {
      const largeDetails = {
        data: 'x'.repeat(20000) // 超過 15KB 限制
      }

      const sanitized = UC01ErrorFactory.sanitizeDetails(largeDetails)

      expect(sanitized._truncated).toBe(true)
      expect(sanitized._originalSize).toBeGreaterThan(15000)
      expect(sanitized._message).toBe('Details truncated due to size limit')
      expect(sanitized.summary).toBe('Large data set truncated for memory safety')
    })

    test('應該處理無效輸入', () => {
      expect(UC01ErrorFactory.sanitizeDetails(null)).toEqual({})
      expect(UC01ErrorFactory.sanitizeDetails(undefined)).toEqual({})
      expect(UC01ErrorFactory.sanitizeDetails('string')).toEqual({})
      expect(UC01ErrorFactory.sanitizeDetails(123)).toEqual({})
    })
  })

  describe('isValidUC01Error', () => {
    test('應該驗證有效的 UC-01 錯誤', () => {
      const error = UC01ErrorFactory.createError(
        'DOM_READMOO_PAGE_NOT_DETECTED',
        '測試訊息'
      )

      expect(UC01ErrorFactory.isValidUC01Error(error)).toBe(true)
    })

    test('應該拒絕無效的錯誤', () => {
      const invalidError = new Error('普通錯誤')
      expect(UC01ErrorFactory.isValidUC01Error(invalidError)).toBe(false)

      expect(UC01ErrorFactory.isValidUC01Error(null)).toBe(false)
      expect(UC01ErrorFactory.isValidUC01Error({})).toBe(false)
    })
  })

  describe('首次使用場景專用測試', () => {
    test('權限錯誤應該被標記為 CRITICAL', () => {
      const error = UC01ErrorFactory.createPermissionDeniedError()
      expect(error.details.severity).toBe('CRITICAL')
    })

    test('頁面檢測錯誤應該包含使用者指引', () => {
      const error = UC01ErrorFactory.createPageDetectionError('https://test.com')
      expect(error.details.userGuidance).toContain('請先前往 Readmoo 書庫頁面')
    })

    test('儲存錯誤應該提供清理建議', () => {
      const error = UC01ErrorFactory.createStorageQuotaError(6, 5)
      expect(error.details.suggestedActions).toContain('clear_old_data')
      expect(error.details.cleanupAvailable).toBe(true)
    })

    test('網路錯誤應該提供診斷選項', () => {
      const error = UC01ErrorFactory.createNetworkUnreachableError()
      expect(error.details.troubleshooting).toBe('network_diagnostics_available')
      expect(error.details.suggestedActions).toContain('check_network_connection')
    })
  })

  describe('效能測試', () => {
    test('常用錯誤建立應該快速', () => {
      const startTime = Date.now()

      for (let i = 0; i < 100; i++) {
        UC01ErrorFactory.getCommonError('PAGE_DETECTION')
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(10) // 100次快取存取應該在10ms內
    })

    test('錯誤建立應該在合理時間內完成', () => {
      const startTime = Date.now()

      for (let i = 0; i < 50; i++) {
        UC01ErrorFactory.createPageDetectionError(
          `https://test${i}.com`,
          [`pattern${i}`],
          { iteration: i }
        )
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(100) // 50個複雜錯誤應該在100ms內
    })
  })
})
