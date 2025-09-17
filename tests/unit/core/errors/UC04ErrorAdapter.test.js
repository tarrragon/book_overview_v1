/**
 * UC04ErrorAdapter 單元測試
 * 測試 UC-04 資料匯入錯誤轉換適配器的所有功能
 * 基於 UC-01/UC-02/UC-03 成功測試模式，針對匯入場景優化
 */

import { UC04ErrorAdapter } from '../../../../src/core/errors/UC04ErrorAdapter.js'
import { ErrorCodes } from '../../../../src/core/errors/ErrorCodes.js'

describe('UC04ErrorAdapter', () => {
  describe('getErrorMapping', () => {
    test('應該回傳4個StandardError的映射', () => {
      const mapping = UC04ErrorAdapter.getErrorMapping()
      
      expect(Object.keys(mapping)).toHaveLength(4)
      expect(mapping).toEqual({
        'DATA_IMPORT_FILE_INVALID': ErrorCodes.FILE_ERROR,
        'DATA_IMPORT_PARSING_ERROR': ErrorCodes.PARSE_ERROR,
        'DATA_IMPORT_MERGE_CONFLICT': ErrorCodes.VALIDATION_ERROR,
        'SYSTEM_IMPORT_STORAGE_OVERFLOW': ErrorCodes.STORAGE_ERROR
      })
    })
    
    test('應該快取映射表', () => {
      const mapping1 = UC04ErrorAdapter.getErrorMapping()
      const mapping2 = UC04ErrorAdapter.getErrorMapping()
      
      expect(mapping1).toBe(mapping2) // 相同參考
      expect(Object.isFrozen(mapping1)).toBe(true)
    })
  })

  describe('extractSubType', () => {
    test('應該提取正確的子類型', () => {
      expect(UC04ErrorAdapter.extractSubType('DATA_IMPORT_FILE_INVALID'))
        .toBe('IMPORT_FILE_INVALID')
      expect(UC04ErrorAdapter.extractSubType('DATA_IMPORT_PARSING_ERROR'))
        .toBe('IMPORT_PARSING_ERROR')
      expect(UC04ErrorAdapter.extractSubType('DATA_IMPORT_MERGE_CONFLICT'))
        .toBe('IMPORT_MERGE_CONFLICT')
      expect(UC04ErrorAdapter.extractSubType('SYSTEM_IMPORT_STORAGE_OVERFLOW'))
        .toBe('IMPORT_STORAGE_OVERFLOW')
    })
    
    test('應該處理未知錯誤代碼', () => {
      expect(UC04ErrorAdapter.extractSubType('UNKNOWN_CODE'))
        .toBe('UNKNOWN_SUBTYPE')
      expect(UC04ErrorAdapter.extractSubType(''))
        .toBe('UNKNOWN_SUBTYPE')
    })
  })

  describe('convertError', () => {
    test('應該轉換DATA_IMPORT_FILE_INVALID為FILE_ERROR', () => {
      const error = UC04ErrorAdapter.convertError(
        'DATA_IMPORT_FILE_INVALID',
        '檔案格式無效',
        { fileName: 'invalid.json' }
      )
      
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('UC04Error')
      expect(error.code).toBe(ErrorCodes.FILE_ERROR)
      expect(error.message).toBe('檔案格式無效')
      expect(error.subType).toBe('IMPORT_FILE_INVALID')
      expect(error.details).toMatchObject({
        fileName: 'invalid.json',
        originalCode: 'DATA_IMPORT_FILE_INVALID',
        severity: 'SEVERE'
      })
    })
    
    test('應該轉換DATA_IMPORT_PARSING_ERROR為PARSE_ERROR', () => {
      const error = UC04ErrorAdapter.convertError(
        'DATA_IMPORT_PARSING_ERROR',
        'JSON解析失敗'
      )
      
      expect(error.code).toBe(ErrorCodes.PARSE_ERROR)
      expect(error.subType).toBe('IMPORT_PARSING_ERROR')
      expect(error.details.severity).toBe('SEVERE')
    })
    
    test('應該轉換DATA_IMPORT_MERGE_CONFLICT為VALIDATION_ERROR', () => {
      const error = UC04ErrorAdapter.convertError(
        'DATA_IMPORT_MERGE_CONFLICT',
        '資料衝突'
      )
      
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(error.subType).toBe('IMPORT_MERGE_CONFLICT')
      expect(error.details.severity).toBe('MODERATE')
    })
    
    test('應該轉換SYSTEM_IMPORT_STORAGE_OVERFLOW為STORAGE_ERROR', () => {
      const error = UC04ErrorAdapter.convertError(
        'SYSTEM_IMPORT_STORAGE_OVERFLOW',
        '儲存空間不足'
      )
      
      expect(error.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(error.subType).toBe('IMPORT_STORAGE_OVERFLOW')
      expect(error.details.severity).toBe('SEVERE')
    })
    
    test('應該使用預設訊息', () => {
      const error = UC04ErrorAdapter.convertError('DATA_IMPORT_FILE_INVALID')
      
      expect(error.message).toBe('UC-04 import operation failed')
    })
    
    test('應該合併額外的詳細資訊', () => {
      const details = {
        customField: 'value',
        importProgress: 75
      }
      
      const error = UC04ErrorAdapter.convertError(
        'DATA_IMPORT_FILE_INVALID',
        '測試訊息',
        details
      )
      
      expect(error.details).toMatchObject({
        customField: 'value',
        importProgress: 75,
        originalCode: 'DATA_IMPORT_FILE_INVALID'
      })
    })
    
    test('應該包含時間戳', () => {
      const before = Date.now()
      const error = UC04ErrorAdapter.convertError('DATA_IMPORT_FILE_INVALID', '測試')
      const after = Date.now()
      
      expect(error.details.timestamp).toBeGreaterThanOrEqual(before)
      expect(error.details.timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('convertError - 錯誤處理', () => {
    test('應該處理無效的錯誤代碼', () => {
      const error = UC04ErrorAdapter.convertError(null, '測試訊息')
      
      expect(error.name).toBe('UC04ConversionError')
      expect(error.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(error.subType).toBe('UC04_CONVERSION_ERROR')
      expect(error.message).toContain('Invalid error code provided')
      expect(error.details.conversionError).toBe(true)
    })
    
    test('應該處理未知的錯誤代碼', () => {
      const error = UC04ErrorAdapter.convertError('UNKNOWN_UC04_CODE', '測試訊息')
      
      expect(error.name).toBe('UC04ConversionError')
      expect(error.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(error.message).toContain('Unknown UC-04 error code')
      expect(error.details.unknownCode).toBe('UNKNOWN_UC04_CODE')
      expect(error.details.availableCodes).toEqual([
        'DATA_IMPORT_FILE_INVALID',
        'DATA_IMPORT_PARSING_ERROR',
        'DATA_IMPORT_MERGE_CONFLICT',
        'SYSTEM_IMPORT_STORAGE_OVERFLOW'
      ])
    })
    
    test('應該處理空字串錯誤代碼', () => {
      const error = UC04ErrorAdapter.convertError('', '測試訊息')
      
      expect(error.name).toBe('UC04ConversionError')
      expect(error.message).toContain('Invalid error code provided')
    })
    
    test('應該處理非字串錯誤代碼', () => {
      const error = UC04ErrorAdapter.convertError(123, '測試訊息')
      
      expect(error.name).toBe('UC04ConversionError')
      expect(error.details.receivedCode).toBe(123)
    })
  })

  describe('getSeverityFromCode', () => {
    test('應該回傳正確的嚴重程度', () => {
      expect(UC04ErrorAdapter.getSeverityFromCode('DATA_IMPORT_FILE_INVALID'))
        .toBe('SEVERE')
      expect(UC04ErrorAdapter.getSeverityFromCode('DATA_IMPORT_PARSING_ERROR'))
        .toBe('SEVERE')
      expect(UC04ErrorAdapter.getSeverityFromCode('SYSTEM_IMPORT_STORAGE_OVERFLOW'))
        .toBe('SEVERE')
      expect(UC04ErrorAdapter.getSeverityFromCode('DATA_IMPORT_MERGE_CONFLICT'))
        .toBe('MODERATE')
    })
    
    test('應該對未知代碼回傳預設嚴重程度', () => {
      expect(UC04ErrorAdapter.getSeverityFromCode('UNKNOWN_CODE'))
        .toBe('MODERATE')
    })
  })

  describe('isValidErrorCodesError', () => {
    test('應該驗證有效的ErrorCodes錯誤', () => {
      const error = UC04ErrorAdapter.convertError(
        'DATA_IMPORT_FILE_INVALID',
        '測試訊息'
      )
      
      expect(UC04ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
    })
    
    test('應該拒絕無效的錯誤物件', () => {
      const invalidError = new Error('普通錯誤')
      expect(UC04ErrorAdapter.isValidErrorCodesError(invalidError)).toBe(false)
      
      expect(UC04ErrorAdapter.isValidErrorCodesError(null)).toBe(false)
      expect(UC04ErrorAdapter.isValidErrorCodesError({})).toBe(false)
      expect(UC04ErrorAdapter.isValidErrorCodesError('string')).toBe(false)
    })
    
    test('應該檢查code屬性', () => {
      const errorWithoutCode = new Error('測試')
      errorWithoutCode.details = {}
      
      expect(UC04ErrorAdapter.isValidErrorCodesError(errorWithoutCode)).toBe(false)
    })
    
    test('應該檢查details屬性', () => {
      const errorWithoutDetails = new Error('測試')
      errorWithoutDetails.code = ErrorCodes.FILE_ERROR
      
      expect(UC04ErrorAdapter.isValidErrorCodesError(errorWithoutDetails)).toBe(false)
      
      const errorWithNullDetails = new Error('測試')
      errorWithNullDetails.code = ErrorCodes.FILE_ERROR
      errorWithNullDetails.details = null
      
      expect(UC04ErrorAdapter.isValidErrorCodesError(errorWithNullDetails)).toBe(false)
    })
  })

  describe('Chrome Extension 相容性', () => {
    test('錯誤物件應該可以JSON序列化', () => {
      const error = UC04ErrorAdapter.convertError(
        'DATA_IMPORT_FILE_INVALID',
        '測試訊息',
        { fileName: 'test.json' }
      )
      
      const serialized = JSON.stringify(error)
      expect(serialized).toBeDefined()
      
      const parsed = JSON.parse(serialized)
      expect(parsed.message).toBe('測試訊息')
      expect(parsed.code).toBe(ErrorCodes.FILE_ERROR)
      expect(parsed.details.fileName).toBe('test.json')
    })
    
    test('轉換錯誤應該可以JSON序列化', () => {
      const error = UC04ErrorAdapter.convertError('INVALID_CODE', '測試')
      
      const serialized = JSON.stringify(error)
      const parsed = JSON.parse(serialized)
      
      expect(parsed.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(parsed.details.conversionError).toBe(true)
    })
    
    test('應該支援toJSON方法', () => {
      const error = UC04ErrorAdapter.convertError(
        'DATA_IMPORT_FILE_INVALID',
        '測試訊息'
      )
      
      expect(typeof error.toJSON).toBe('function')
      
      const jsonObj = error.toJSON()
      expect(jsonObj.message).toBe('測試訊息')
      expect(jsonObj.code).toBe(ErrorCodes.FILE_ERROR)
      expect(jsonObj.details).toBeDefined()
    })
  })

  describe('匯入場景特定測試', () => {
    test('檔案錯誤應該包含檔案資訊', () => {
      const error = UC04ErrorAdapter.convertError(
        'DATA_IMPORT_FILE_INVALID',
        '無效檔案',
        { 
          fileName: 'corrupt.json',
          fileSize: '500KB',
          validationErrors: [
            { field: 'books', issue: 'not_array' }
          ]
        }
      )
      
      expect(error.details.fileName).toBe('corrupt.json')
      expect(error.details.fileSize).toBe('500KB')
      expect(error.details.validationErrors).toHaveLength(1)
    })
    
    test('解析錯誤應該包含位置資訊', () => {
      const error = UC04ErrorAdapter.convertError(
        'DATA_IMPORT_PARSING_ERROR',
        'JSON語法錯誤',
        {
          parseError: 'SyntaxError: Unexpected token',
          errorPosition: { line: 45, column: 12 }
        }
      )
      
      expect(error.details.parseError).toContain('SyntaxError')
      expect(error.details.errorPosition.line).toBe(45)
    })
    
    test('合併衝突應該包含衝突資訊', () => {
      const error = UC04ErrorAdapter.convertError(
        'DATA_IMPORT_MERGE_CONFLICT',
        '資料衝突',
        {
          conflictType: 'duplicate_books',
          conflictedBooks: [
            { id: 'book_123', existing: { progress: '75%' } }
          ]
        }
      )
      
      expect(error.details.conflictType).toBe('duplicate_books')
      expect(error.details.conflictedBooks).toHaveLength(1)
    })
    
    test('儲存錯誤應該包含容量資訊', () => {
      const error = UC04ErrorAdapter.convertError(
        'SYSTEM_IMPORT_STORAGE_OVERFLOW',
        '儲存不足',
        {
          existingDataSize: '3.2MB',
          importDataSize: '2.8MB',
          storageLimit: '5.0MB'
        }
      )
      
      expect(error.details.existingDataSize).toBe('3.2MB')
      expect(error.details.importDataSize).toBe('2.8MB')
      expect(error.details.storageLimit).toBe('5.0MB')
    })
  })

  describe('效能測試', () => {
    test('大量錯誤轉換應該保持效能', () => {
      const startTime = Date.now()
      
      for (let i = 0; i < 100; i++) {
        UC04ErrorAdapter.convertError(
          'DATA_IMPORT_FILE_INVALID',
          `測試訊息 ${i}`,
          { testIndex: i }
        )
      }
      
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(50) // 100次轉換應該在50ms內
    })
    
    test('映射表快取應該減少重複計算', () => {
      const startTime = Date.now()
      
      for (let i = 0; i < 1000; i++) {
        UC04ErrorAdapter.getErrorMapping()
      }
      
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(10) // 1000次存取應該在10ms內
    })
  })
})