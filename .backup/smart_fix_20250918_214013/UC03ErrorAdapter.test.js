/**
 * UC03ErrorAdapter 單元測試
 * 基於 UC-01/UC-02 成功架構模式，針對 UC-03 資料匯出特性優化
 * 測試涵蓋 4 個 StandardError 到 ErrorCodes 的完整轉換
 */

import { UC03ErrorAdapter } from '../../../../src/core/errors/UC03ErrorAdapter.js'
import { ErrorCodes } from '../../../../src/core/errors/ErrorCodes.js'

describe('UC03ErrorAdapter', () => {
  describe('getErrorMapping', () => {
    test('應該返回完整的錯誤映射表', () => {
      const mapping = UC03ErrorAdapter.getErrorMapping()

      expect(mapping).toBeDefined()
      expect(typeof mapping).toBe('object')
      expect(Object.keys(mapping)).toHaveLength(4)

      // 驗證所有 4 個 UC-03 StandardError 都有映射
      expect(mapping).toMatchObject({
        DATA_EXPORT_GENERATION_FAILED: ErrorCodes.FILE_ERROR,
        SYSTEM_EXPORT_MEMORY_EXHAUSTED: ErrorCodes.OPERATION_ERROR,
        PLATFORM_DOWNLOAD_BLOCKED: ErrorCodes.CHROME_ERROR,
        DATA_EXPORT_INTEGRITY_VIOLATION: ErrorCodes.VALIDATION_ERROR
      })
    })

    test('應該返回不可變的映射表', () => {
      const mapping1 = UC03ErrorAdapter.getErrorMapping()
      const mapping2 = UC03ErrorAdapter.getErrorMapping()

      expect(mapping1).toBe(mapping2) // 相同引用
      expect(Object.isFrozen(mapping1)).toBe(true)
    })
  })

  describe('extractSubType', () => {
    test('應該正確提取各種錯誤的子類型', () => {
      expect(UC03ErrorAdapter.extractSubType('DATA_EXPORT_GENERATION_FAILED'))
        .toBe('EXPORT_GENERATION_FAILED')

      expect(UC03ErrorAdapter.extractSubType('SYSTEM_EXPORT_MEMORY_EXHAUSTED'))
        .toBe('EXPORT_MEMORY_EXHAUSTED')

      expect(UC03ErrorAdapter.extractSubType('PLATFORM_DOWNLOAD_BLOCKED'))
        .toBe('DOWNLOAD_BLOCKED')

      expect(UC03ErrorAdapter.extractSubType('DATA_EXPORT_INTEGRITY_VIOLATION'))
        .toBe('EXPORT_INTEGRITY_VIOLATION')
    })

    test('應該處理未知錯誤代碼', () => {
      expect(UC03ErrorAdapter.extractSubType('UNKNOWN_ERROR_CODE'))
        .toBe('UNKNOWN_SUBTYPE')
    })
  })

  describe('convertError', () => {
    test('應該成功轉換資料生成錯誤', () => {
      const result = UC03ErrorAdapter.convertError(
        'DATA_EXPORT_GENERATION_FAILED',
        '匯出檔案生成失敗',
        {
          exportFormat: 'JSON',
          dataSize: '2.5MB',
          failurePoint: 'json_serialization'
        }
      )

      expect(result).toBeInstanceOf(Error)
      expect(result.name).toBe('UC03Error')
      expect(result.code).toBe(ErrorCodes.FILE_ERROR)
      expect(result.subType).toBe('EXPORT_GENERATION_FAILED')
      expect(result.message).toBe('匯出檔案生成失敗')
      expect(result.details).toMatchObject({
        originalCode: 'DATA_EXPORT_GENERATION_FAILED',
        exportFormat: 'JSON',
        dataSize: '2.5MB',
        failurePoint: 'json_serialization',
        severity: 'SEVERE',
        timestamp: expect.any(Number)
      })
    })

    test('應該成功轉換記憶體不足錯誤', () => {
      const result = UC03ErrorAdapter.convertError(
        'SYSTEM_EXPORT_MEMORY_EXHAUSTED',
        '匯出大量資料時記憶體不足',
        {
          booksToExport: 1000,
          estimatedSize: '15MB',
          availableMemory: '8MB'
        }
      )

      expect(result.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(result.subType).toBe('EXPORT_MEMORY_EXHAUSTED')
      expect(result.details.severity).toBe('MODERATE')
      expect(result.details.booksToExport).toBe(1000)
    })

    test('應該成功轉換下載被阻止錯誤', () => {
      const result = UC03ErrorAdapter.convertError(
        'PLATFORM_DOWNLOAD_BLOCKED',
        '瀏覽器阻止檔案下載',
        {
          fileName: 'export.json',
          fileSize: '2.5MB',
          blockReason: 'popup_blocker'
        }
      )

      expect(result.code).toBe(ErrorCodes.CHROME_ERROR)
      expect(result.subType).toBe('DOWNLOAD_BLOCKED')
      expect(result.details.severity).toBe('MODERATE')
      expect(result.details.fileName).toBe('export.json')
    })

    test('應該成功轉換完整性違規錯誤', () => {
      const result = UC03ErrorAdapter.convertError(
        'DATA_EXPORT_INTEGRITY_VIOLATION',
        '匯出資料完整性檢查失敗',
        {
          originalCount: 150,
          exportedCount: 147,
          missingBooks: ['book_1', 'book_2', 'book_3']
        }
      )

      expect(result.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(result.subType).toBe('EXPORT_INTEGRITY_VIOLATION')
      expect(result.details.severity).toBe('SEVERE')
      expect(result.details.originalCount).toBe(150)
    })

    test('應該處理無效的錯誤代碼', () => {
      const result = UC03ErrorAdapter.convertError(null, 'Some message')

      expect(result.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(result.subType).toBe('UC03_CONVERSION_ERROR')
      expect(result.message).toContain('UC03 Error Conversion Failed')
      expect(result.details.conversionError).toBe(true)
    })

    test('應該處理未知的錯誤代碼', () => {
      const result = UC03ErrorAdapter.convertError(
        'UNKNOWN_UC03_ERROR',
        'Unknown error occurred'
      )

      expect(result.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(result.subType).toBe('UC03_CONVERSION_ERROR')
      expect(result.details.unknownCode).toBe('UNKNOWN_UC03_ERROR')
      expect(result.details.availableCodes).toEqual(
        Object.keys(UC03ErrorAdapter.getErrorMapping())
      )
    })

    test('應該處理預設訊息', () => {
      const result = UC03ErrorAdapter.convertError(
        'DATA_EXPORT_GENERATION_FAILED'
      )

      expect(result.message).toBe('UC-03 export operation failed')
    })
  })

  describe('getSeverityFromCode', () => {
    test('應該正確識別 SEVERE 等級錯誤', () => {
      const severeErrors = [
        'DATA_EXPORT_GENERATION_FAILED',
        'DATA_EXPORT_INTEGRITY_VIOLATION'
      ]

      severeErrors.forEach(errorCode => {
        expect(UC03ErrorAdapter.getSeverityFromCode(errorCode)).toBe('SEVERE')
      })
    })

    test('應該正確識別 MODERATE 等級錯誤', () => {
      const moderateErrors = [
        'SYSTEM_EXPORT_MEMORY_EXHAUSTED',
        'PLATFORM_DOWNLOAD_BLOCKED'
      ]

      moderateErrors.forEach(errorCode => {
        expect(UC03ErrorAdapter.getSeverityFromCode(errorCode)).toBe('MODERATE')
      })
    })

    test('應該為未知錯誤代碼返回 MODERATE', () => {
      expect(UC03ErrorAdapter.getSeverityFromCode('UNKNOWN_CODE')).toBe('MODERATE')
    })
  })

  describe('isValidErrorCodesError', () => {
    test('應該驗證有效的 ErrorCodes 錯誤', () => {
      const validError = UC03ErrorAdapter.convertError(
        'DATA_EXPORT_GENERATION_FAILED',
        'Test message',
        { testData: 'value' }
      )

      expect(UC03ErrorAdapter.isValidErrorCodesError(validError)).toBe(true)
    })

    test('應該拒絕無效的錯誤物件', () => {
      expect(UC03ErrorAdapter.isValidErrorCodesError(null)).toBe(false)
      expect(UC03ErrorAdapter.isValidErrorCodesError({})).toBe(false)
      expect(UC03ErrorAdapter.isValidErrorCodesError('string')).toBe(false)

      const invalidError = new Error('test')
      expect(UC03ErrorAdapter.isValidErrorCodesError(invalidError)).toBe(false)

      const errorWithoutDetails = new Error('test')
      errorWithoutDetails.code = ErrorCodes.FILE_ERROR
      expect(UC03ErrorAdapter.isValidErrorCodesError(errorWithoutDetails)).toBe(false)
    })
  })

  describe('錯誤分類測試', () => {
    test('FILE_ERROR 類型應該正確映射', () => {
      const result = UC03ErrorAdapter.convertError('DATA_EXPORT_GENERATION_FAILED', 'Test message')
      expect(result.code).toBe(ErrorCodes.FILE_ERROR)
    })

    test('OPERATION_ERROR 類型應該正確映射', () => {
      const result = UC03ErrorAdapter.convertError('SYSTEM_EXPORT_MEMORY_EXHAUSTED', 'Test message')
      expect(result.code).toBe(ErrorCodes.OPERATION_ERROR)
    })

    test('CHROME_ERROR 類型應該正確映射', () => {
      const result = UC03ErrorAdapter.convertError('PLATFORM_DOWNLOAD_BLOCKED', 'Test message')
      expect(result.code).toBe(ErrorCodes.CHROME_ERROR)
    })

    test('VALIDATION_ERROR 類型應該正確映射', () => {
      const result = UC03ErrorAdapter.convertError('DATA_EXPORT_INTEGRITY_VIOLATION', 'Test message')
      expect(result.code).toBe(ErrorCodes.VALIDATION_ERROR)
    })
  })

  describe('效能和記憶體測試', () => {
    test('映射表應該被快取', () => {
      const startTime = Date.now()

      // 多次呼叫應該使用快取
      for (let i = 0; i < 1000; i++) {
        UC03ErrorAdapter.getErrorMapping()
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(10) // 應該在 10ms 內完成
    })

    test('錯誤轉換應該在合理時間內完成', () => {
      const startTime = Date.now()

      // 批量轉換測試
      for (let i = 0; i < 100; i++) {
        UC03ErrorAdapter.convertError(
          'DATA_EXPORT_GENERATION_FAILED',
          'Test message',
          { iteration: i }
        )
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(50) // 100次轉換應該在 50ms 內完成
    })
  })

  describe('Chrome Extension 序列化支援', () => {
    test('錯誤物件應該包含 toJSON 方法', () => {
      const error = UC03ErrorAdapter.convertError(
        'DATA_EXPORT_GENERATION_FAILED',
        'Test message'
      )

      expect(typeof error.toJSON).toBe('function')

      const serialized = error.toJSON()
      expect(serialized).toMatchObject({
        message: error.message,
        name: error.name,
        code: error.code,
        subType: error.subType,
        details: error.details
      })
    })

    test('序列化錯誤物件應該可以正確 JSON.stringify', () => {
      const error = UC03ErrorAdapter.convertError(
        'DATA_EXPORT_GENERATION_FAILED',
        'Test message',
        { exportFormat: 'JSON' }
      )

      const jsonString = JSON.stringify(error)
      expect(jsonString).toBeDefined()

      const parsed = JSON.parse(jsonString)
      expect(parsed.message).toBe(error.message)
      expect(parsed.code).toBe(error.code)
      expect(parsed.details.exportFormat).toBe('JSON')
    })
  })
})
