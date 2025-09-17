/**
 * UC01ErrorAdapter 單元測試
 * 基於 UC-02 成功架構模式，針對 UC-01 特性優化
 * 測試涵蓋 10 個 StandardError 到 ErrorCodes 的完整轉換
 */

import { UC01ErrorAdapter } from '../../../../src/core/errors/UC01ErrorAdapter.js'
import { ErrorCodes } from '../../../../src/core/errors/ErrorCodes.js'

describe('UC01ErrorAdapter', () => {
  describe('getErrorMapping', () => {
    test('應該返回完整的錯誤映射表', () => {
      const mapping = UC01ErrorAdapter.getErrorMapping()
      
      expect(mapping).toBeDefined()
      expect(typeof mapping).toBe('object')
      expect(Object.keys(mapping)).toHaveLength(10)
      
      // 驗證所有 10 個 UC-01 StandardError 都有映射
      expect(mapping).toMatchObject({
        'DOM_READMOO_PAGE_NOT_DETECTED': ErrorCodes.DOM_ERROR,
        'DOM_BOOK_ELEMENTS_NOT_FOUND': ErrorCodes.DOM_ERROR,
        'DOM_EXTRACTION_PARTIAL_FAILURE': ErrorCodes.DOM_ERROR,
        'NETWORK_READMOO_UNREACHABLE': ErrorCodes.NETWORK_ERROR,
        'NETWORK_SLOW_CONNECTION': ErrorCodes.NETWORK_ERROR,
        'SYSTEM_STORAGE_QUOTA_EXCEEDED': ErrorCodes.STORAGE_ERROR,
        'SYSTEM_MEMORY_PRESSURE': ErrorCodes.OPERATION_ERROR,
        'PLATFORM_EXTENSION_PERMISSIONS_DENIED': ErrorCodes.CHROME_ERROR,
        'PLATFORM_MANIFEST_V3_COMPATIBILITY': ErrorCodes.CHROME_ERROR,
        'DATA_INITIAL_STORAGE_CORRUPTION': ErrorCodes.STORAGE_ERROR
      })
    })
    
    test('應該返回不可變的映射表', () => {
      const mapping1 = UC01ErrorAdapter.getErrorMapping()
      const mapping2 = UC01ErrorAdapter.getErrorMapping()
      
      expect(mapping1).toBe(mapping2) // 相同引用
      expect(Object.isFrozen(mapping1)).toBe(true)
    })
  })

  describe('extractSubType', () => {
    test('應該正確提取各種錯誤的子類型', () => {
      expect(UC01ErrorAdapter.extractSubType('DOM_READMOO_PAGE_NOT_DETECTED'))
        .toBe('PAGE_NOT_DETECTED')
      
      expect(UC01ErrorAdapter.extractSubType('PLATFORM_EXTENSION_PERMISSIONS_DENIED'))
        .toBe('PERMISSIONS_DENIED')
        
      expect(UC01ErrorAdapter.extractSubType('SYSTEM_STORAGE_QUOTA_EXCEEDED'))
        .toBe('STORAGE_QUOTA_EXCEEDED')
        
      expect(UC01ErrorAdapter.extractSubType('DATA_INITIAL_STORAGE_CORRUPTION'))
        .toBe('INITIAL_STORAGE_CORRUPTION')
    })
    
    test('應該處理未知錯誤代碼', () => {
      expect(UC01ErrorAdapter.extractSubType('UNKNOWN_ERROR_CODE'))
        .toBe('UNKNOWN_SUBTYPE')
    })
  })

  describe('convertError', () => {
    test('應該成功轉換 DOM 錯誤', () => {
      const result = UC01ErrorAdapter.convertError(
        'DOM_READMOO_PAGE_NOT_DETECTED',
        'Unable to detect Readmoo library page',
        { currentUrl: 'https://example.com' }
      )
      
      expect(result).toBeInstanceOf(Error)
      expect(result.name).toBe('UC01Error')
      expect(result.code).toBe(ErrorCodes.DOM_ERROR)
      expect(result.subType).toBe('PAGE_NOT_DETECTED')
      expect(result.message).toBe('Unable to detect Readmoo library page')
      expect(result.details).toMatchObject({
        originalCode: 'DOM_READMOO_PAGE_NOT_DETECTED',
        currentUrl: 'https://example.com',
        severity: 'SEVERE',
        timestamp: expect.any(Number)
      })
    })
    
    test('應該成功轉換權限錯誤並標記為 CRITICAL', () => {
      const result = UC01ErrorAdapter.convertError(
        'PLATFORM_EXTENSION_PERMISSIONS_DENIED',
        'Extension permissions denied',
        { requiredPermissions: ['activeTab', 'storage'] }
      )
      
      expect(result.code).toBe(ErrorCodes.CHROME_ERROR)
      expect(result.subType).toBe('PERMISSIONS_DENIED')
      expect(result.details.severity).toBe('CRITICAL')
      expect(result.details.requiredPermissions).toEqual(['activeTab', 'storage'])
    })
    
    test('應該成功轉換儲存錯誤', () => {
      const result = UC01ErrorAdapter.convertError(
        'SYSTEM_STORAGE_QUOTA_EXCEEDED',
        'Storage quota exceeded',
        { currentUsage: 5.2, maxQuota: 5.0 }
      )
      
      expect(result.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(result.subType).toBe('STORAGE_QUOTA_EXCEEDED')
      expect(result.details.severity).toBe('SEVERE')
      expect(result.details.currentUsage).toBe(5.2)
    })

    test('應該處理無效的錯誤代碼', () => {
      const result = UC01ErrorAdapter.convertError(null, 'Some message')
      
      expect(result.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(result.subType).toBe('UC01_CONVERSION_ERROR')
      expect(result.message).toContain('UC01 Error Conversion Failed')
      expect(result.details.conversionError).toBe(true)
    })
    
    test('應該處理未知的錯誤代碼', () => {
      const result = UC01ErrorAdapter.convertError(
        'UNKNOWN_UC01_ERROR', 
        'Unknown error occurred'
      )
      
      expect(result.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(result.subType).toBe('UC01_CONVERSION_ERROR')
      expect(result.details.unknownCode).toBe('UNKNOWN_UC01_ERROR')
      expect(result.details.availableCodes).toEqual(
        Object.keys(UC01ErrorAdapter.getErrorMapping())
      )
    })
    
    test('應該處理預設訊息', () => {
      const result = UC01ErrorAdapter.convertError(
        'DOM_READMOO_PAGE_NOT_DETECTED'
      )
      
      expect(result.message).toBe('UC-01 operation failed')
    })
  })

  describe('getSeverityFromCode', () => {
    test('應該正確識別 CRITICAL 等級錯誤', () => {
      expect(UC01ErrorAdapter.getSeverityFromCode('PLATFORM_EXTENSION_PERMISSIONS_DENIED'))
        .toBe('CRITICAL')
    })
    
    test('應該正確識別 SEVERE 等級錯誤', () => {
      const severeErrors = [
        'DOM_READMOO_PAGE_NOT_DETECTED',
        'NETWORK_READMOO_UNREACHABLE', 
        'SYSTEM_STORAGE_QUOTA_EXCEEDED',
        'DATA_INITIAL_STORAGE_CORRUPTION'
      ]
      
      severeErrors.forEach(errorCode => {
        expect(UC01ErrorAdapter.getSeverityFromCode(errorCode)).toBe('SEVERE')
      })
    })
    
    test('應該正確識別 MODERATE 等級錯誤', () => {
      const moderateErrors = [
        'DOM_BOOK_ELEMENTS_NOT_FOUND',
        'SYSTEM_MEMORY_PRESSURE',
        'PLATFORM_MANIFEST_V3_COMPATIBILITY'
      ]
      
      moderateErrors.forEach(errorCode => {
        expect(UC01ErrorAdapter.getSeverityFromCode(errorCode)).toBe('MODERATE')
      })
    })
    
    test('應該正確識別 MINOR 等級錯誤', () => {
      const minorErrors = [
        'DOM_EXTRACTION_PARTIAL_FAILURE',
        'NETWORK_SLOW_CONNECTION'
      ]
      
      minorErrors.forEach(errorCode => {
        expect(UC01ErrorAdapter.getSeverityFromCode(errorCode)).toBe('MINOR')
      })
    })
    
    test('應該為未知錯誤代碼返回 MODERATE', () => {
      expect(UC01ErrorAdapter.getSeverityFromCode('UNKNOWN_CODE')).toBe('MODERATE')
    })
  })

  describe('isValidErrorCodesError', () => {
    test('應該驗證有效的 ErrorCodes 錯誤', () => {
      const validError = UC01ErrorAdapter.convertError(
        'DOM_READMOO_PAGE_NOT_DETECTED',
        'Test message',
        { testData: 'value' }
      )
      
      expect(UC01ErrorAdapter.isValidErrorCodesError(validError)).toBe(true)
    })
    
    test('應該拒絕無效的錯誤物件', () => {
      expect(UC01ErrorAdapter.isValidErrorCodesError(null)).toBe(false)
      expect(UC01ErrorAdapter.isValidErrorCodesError({})).toBe(false)
      expect(UC01ErrorAdapter.isValidErrorCodesError('string')).toBe(false)
      
      const invalidError = new Error('test')
      expect(UC01ErrorAdapter.isValidErrorCodesError(invalidError)).toBe(false)
      
      const errorWithoutDetails = new Error('test')
      errorWithoutDetails.code = ErrorCodes.DOM_ERROR
      // 這個錯誤物件沒有 details 屬性，應該返回 false
      expect(UC01ErrorAdapter.isValidErrorCodesError(errorWithoutDetails)).toBe(false)
    })
  })

  describe('錯誤分類測試', () => {
    test('DOM 錯誤類型應該正確映射', () => {
      const domErrors = [
        'DOM_READMOO_PAGE_NOT_DETECTED',
        'DOM_BOOK_ELEMENTS_NOT_FOUND', 
        'DOM_EXTRACTION_PARTIAL_FAILURE'
      ]
      
      domErrors.forEach(errorCode => {
        const result = UC01ErrorAdapter.convertError(errorCode, 'Test message')
        expect(result.code).toBe(ErrorCodes.DOM_ERROR)
      })
    })
    
    test('網路錯誤類型應該正確映射', () => {
      const networkErrors = [
        'NETWORK_READMOO_UNREACHABLE',
        'NETWORK_SLOW_CONNECTION'
      ]
      
      networkErrors.forEach(errorCode => {
        const result = UC01ErrorAdapter.convertError(errorCode, 'Test message')
        expect(result.code).toBe(ErrorCodes.NETWORK_ERROR)
      })
    })
    
    test('Chrome Extension 錯誤類型應該正確映射', () => {
      const chromeErrors = [
        'PLATFORM_EXTENSION_PERMISSIONS_DENIED',
        'PLATFORM_MANIFEST_V3_COMPATIBILITY'
      ]
      
      chromeErrors.forEach(errorCode => {
        const result = UC01ErrorAdapter.convertError(errorCode, 'Test message')
        expect(result.code).toBe(ErrorCodes.CHROME_ERROR)
      })
    })
    
    test('儲存錯誤類型應該正確映射', () => {
      const storageErrors = [
        'SYSTEM_STORAGE_QUOTA_EXCEEDED',
        'DATA_INITIAL_STORAGE_CORRUPTION'
      ]
      
      storageErrors.forEach(errorCode => {
        const result = UC01ErrorAdapter.convertError(errorCode, 'Test message')
        expect(result.code).toBe(ErrorCodes.STORAGE_ERROR)
      })
    })
  })

  describe('效能和記憶體測試', () => {
    test('映射表應該被快取', () => {
      const startTime = Date.now()
      
      // 多次呼叫應該使用快取
      for (let i = 0; i < 1000; i++) {
        UC01ErrorAdapter.getErrorMapping()
      }
      
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(10) // 應該在 10ms 內完成
    })
    
    test('錯誤轉換應該在合理時間內完成', () => {
      const startTime = Date.now()
      
      // 批量轉換測試
      for (let i = 0; i < 100; i++) {
        UC01ErrorAdapter.convertError(
          'DOM_READMOO_PAGE_NOT_DETECTED',
          'Test message',
          { iteration: i }
        )
      }
      
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(50) // 100次轉換應該在 50ms 內完成
    })
  })
})