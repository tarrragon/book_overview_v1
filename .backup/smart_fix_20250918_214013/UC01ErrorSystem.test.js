/**
 * UC01ErrorSystem 整合測試
 * 測試 UC01ErrorAdapter 和 UC01ErrorFactory 的整合協作
 * 模擬真實的首次安裝使用場景
 */

import { UC01ErrorAdapter } from '../../../../src/core/errors/UC01ErrorAdapter.js'
import { UC01ErrorFactory } from '../../../../src/core/errors/UC01ErrorFactory.js'
import { ErrorCodes } from '../../../../src/core/errors/ErrorCodes.js'

describe('UC01ErrorSystem 整合測試', () => {
  afterEach(() => {
    UC01ErrorFactory.clearCache()
  })

  describe('Adapter 與 Factory 協作', () => {
    test('Factory 建立的錯誤應該通過 Adapter 驗證', () => {
      const error = UC01ErrorFactory.createError(
        'DOM_READMOO_PAGE_NOT_DETECTED',
        '無法檢測到頁面'
      )

      expect(UC01ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
      expect(UC01ErrorFactory.isValidUC01Error(error)).toBe(true)
    })

    test('所有 Factory 方法產生的錯誤都應該有效', () => {
      const errors = [
        UC01ErrorFactory.createPageDetectionError('https://test.com'),
        UC01ErrorFactory.createBookElementsError(['.test']),
        UC01ErrorFactory.createPartialExtractionError(10, 7),
        UC01ErrorFactory.createNetworkUnreachableError(),
        UC01ErrorFactory.createPermissionDeniedError(),
        UC01ErrorFactory.createStorageQuotaError(6, 5),
        UC01ErrorFactory.createInitialStorageCorruptionError()
      ]

      errors.forEach(error => {
        expect(UC01ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
        expect(UC01ErrorFactory.isValidUC01Error(error)).toBe(true)
      })
    })
  })

  describe('首次使用完整流程模擬', () => {
    test('模擬首次安裝權限檢查流程', async () => {
      // 模擬權限檢查失敗
      const permissionError = UC01ErrorFactory.createPermissionDeniedError(
        ['activeTab', 'storage'],
        ['activeTab'],
        { chromeVersion: '120.0.0.0' }
      )

      // 驗證錯誤結構
      expect(permissionError.code).toBe(ErrorCodes.CHROME_ERROR)
      expect(permissionError.details.severity).toBe('CRITICAL')
      expect(permissionError.details.userGuidance).toContain('重新授權')

      // 建立結果物件
      const result = UC01ErrorFactory.createResult(false, null, permissionError)

      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCodes.CHROME_ERROR)
      expect(result.subType).toBe('PERMISSIONS_DENIED')
    })

    test('模擬首次頁面檢測流程', async () => {
      // 模擬使用者在錯誤頁面
      const wrongUrl = 'https://github.com/user/repo'
      const pageError = UC01ErrorFactory.createPageDetectionError(
        wrongUrl,
        ['readmoo.com/library', 'readmoo.com/shelf'],
        { userAgent: 'Chrome/120' }
      )

      expect(pageError.code).toBe(ErrorCodes.DOM_ERROR)
      expect(pageError.details.currentUrl).toBe(wrongUrl)
      expect(pageError.details.suggestedAction).toBe('navigate_to_readmoo_library')

      // 模擬後續成功檢測
      const successResult = UC01ErrorFactory.createResult(
        true,
        {
          detectedUrl: 'https://readmoo.com/library',
          pageStructure: 'valid'
        }
      )

      expect(successResult.success).toBe(true)
      expect(successResult.code).toBe('SUCCESS')
    })

    test('模擬初次資料提取流程', async () => {
      // 模擬部分提取失敗
      const partialError = UC01ErrorFactory.createPartialExtractionError(
        20, 15,
        [
          { title: 'Book 1', reason: 'timeout' },
          { title: 'Book 2', reason: 'parsing_error' }
        ],
        {
          totalTime: 45000,
          networkSpeed: 'slow'
        }
      )

      expect(partialError.code).toBe(ErrorCodes.DOM_ERROR)
      expect(partialError.details.successRate).toBe('75.0%')
      expect(partialError.details.impact).toBe('partial_data_available')

      // 驗證失敗書籍資訊
      expect(partialError.details.failedBooks).toHaveLength(2)
      expect(partialError.details.failedBooks[0].title).toBe('Book 1')
    })

    test('模擬儲存空間管理流程', async () => {
      // 模擬儲存空間不足
      const storageError = UC01ErrorFactory.createStorageQuotaError(
        5.2, 5.0,
        {
          booksCount: 250,
          averageBookSize: 0.021,
          oldestBook: '2023-01-15'
        }
      )

      expect(storageError.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(storageError.details.utilizationRate).toBe('104.0%')
      expect(storageError.details.suggestedActions).toContain('clear_old_data')

      // 模擬清理後成功
      const cleanupResult = UC01ErrorFactory.createResult(
        true,
        {
          clearedSpace: 1.5,
          remainingBooks: 180,
          newUtilization: 72
        }
      )

      expect(cleanupResult.success).toBe(true)
      expect(cleanupResult.data.clearedSpace).toBe(1.5)
    })
  })

  describe('錯誤恢復策略測試', () => {
    test('應該支援錯誤降級處理', () => {
      // 模擬網路錯誤
      const networkError = UC01ErrorFactory.createNetworkUnreachableError(
        'readmoo.com/api',
        5000, 3,
        { errorType: 'ENOTFOUND' }
      )

      expect(networkError.details.suggestedActions).toContain('use_offline_mode')

      // 模擬降級為離線模式
      const offlineResult = UC01ErrorFactory.createResult(
        true,
        {
          mode: 'offline',
          cachedBooks: 15,
          lastSync: '2024-01-15T10:30:00Z'
        }
      )

      expect(offlineResult.success).toBe(true)
      expect(offlineResult.data.mode).toBe('offline')
    })

    test('應該支援自動修復機制', () => {
      // 模擬初始儲存損壞
      const corruptionError = UC01ErrorFactory.createInitialStorageCorruptionError(
        {
          corruptedEntries: 3,
          totalEntries: 25,
          corruptionType: 'json_parse_error'
        },
        { autoRepairAttempted: false }
      )

      expect(corruptionError.details.autoRepairEnabled).toBe(true)
      expect(corruptionError.details.suggestedActions).toContain('auto_repair')

      // 模擬自動修復成功
      const repairResult = UC01ErrorFactory.createResult(
        true,
        {
          repairedEntries: 2,
          removedEntries: 1,
          healthStatus: 'good'
        }
      )

      expect(repairResult.success).toBe(true)
      expect(repairResult.data.repairedEntries).toBe(2)
    })
  })

  describe('Chrome Extension 環境相容性', () => {
    test('錯誤物件應該可以序列化', () => {
      const error = UC01ErrorFactory.createPermissionDeniedError()

      // 測試 JSON 序列化
      const serialized = JSON.stringify(error)
      expect(serialized).toBeDefined()

      const parsed = JSON.parse(serialized)
      expect(parsed.message).toBe(error.message)
      expect(parsed.code).toBe(error.code)
    })

    test('錯誤物件應該支援 Service Worker 環境', () => {
      const error = UC01ErrorFactory.createNetworkUnreachableError()

      // 模擬 Service Worker 中的傳訊
      const messageData = {
        type: 'error_occurred',
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        }
      }

      expect(messageData.error.code).toBe(ErrorCodes.NETWORK_ERROR)
      expect(messageData.error.details.endpoint).toBeDefined()
    })
  })

  describe('效能與記憶體測試', () => {
    test('大量錯誤建立應該保持效能', () => {
      const startTime = Date.now()
      const errors = []

      // 建立 200 個不同的錯誤
      for (let i = 0; i < 200; i++) {
        if (i % 4 === 0) {
          errors.push(UC01ErrorFactory.createPageDetectionError(`https://test${i}.com`))
        } else if (i % 4 === 1) {
          errors.push(UC01ErrorFactory.createNetworkUnreachableError(`api${i}.com`))
        } else if (i % 4 === 2) {
          errors.push(UC01ErrorFactory.createStorageQuotaError(i / 10, 5))
        } else {
          errors.push(UC01ErrorFactory.createPermissionDeniedError())
        }
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(500) // 200個錯誤建立應該在500ms內
      expect(errors).toHaveLength(200)

      // 驗證所有錯誤都有效
      errors.forEach(error => {
        expect(UC01ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
      })
    })

    test('快取機制應該減少記憶體使用', () => {
      // 建立大量相同類型的錯誤
      const pageErrors = []
      for (let i = 0; i < 100; i++) {
        pageErrors.push(UC01ErrorFactory.getCommonError('PAGE_DETECTION'))
      }

      // 驗證都是相同引用 (快取有效)
      const firstError = pageErrors[0]
      pageErrors.forEach(error => {
        expect(error).toBe(firstError)
      })

      expect(Object.isFrozen(firstError)).toBe(true)
    })
  })

  describe('安全性測試', () => {
    test('sanitizeDetails 應該防止記憶體洩漏', () => {
      const hugeDetails = {
        sensitiveData: 'x'.repeat(50000), // 50KB 資料
        credentials: 'secret_key_12345',
        userInfo: {
          email: 'test@example.com',
          sessions: new Array(1000).fill('session_token')
        }
      }

      const sanitized = UC01ErrorFactory.sanitizeDetails(hugeDetails)

      expect(sanitized._truncated).toBe(true)
      expect(sanitized._originalSize).toBeGreaterThan(15000)
      expect(sanitized.sensitiveData).toBeUndefined()
      expect(sanitized.credentials).toBeUndefined()
    })

    test('錯誤物件應該不包含敏感資訊', () => {
      const error = UC01ErrorFactory.createPermissionDeniedError(
        ['activeTab', 'storage'],
        ['activeTab'],
        {
          userToken: 'secret_123',
          internalDebug: 'sensitive_debug_info'
        }
      )

      // 敏感資訊應該被包含但不會意外暴露在錯誤訊息中
      expect(error.message).not.toContain('secret_123')
      expect(error.message).not.toContain('sensitive_debug_info')

      // 但詳細資訊中應該保留 (由開發者控制)
      expect(error.details.userToken).toBe('secret_123')
    })
  })
})
