/**
 * UC06ErrorAdapter 單元測試
 * 測試 UC-06 資料管理UI錯誤轉換適配器的所有功能
 * 基於 UC-01~UC-05 成功測試模式，針對UI操作場景優化
 */

import { UC06ErrorAdapter } from '../../../../src/core/errors/UC06ErrorAdapter.js'
import { ErrorCodes } from '../../../../src/core/errors/ErrorCodes.js'

describe('UC06ErrorAdapter', () => {
  describe('getErrorMapping', () => {
    test('應該回傳4個StandardError的映射', () => {
      const mapping = UC06ErrorAdapter.getErrorMapping()

      expect(Object.keys(mapping)).toHaveLength(4)
      expect(mapping).toEqual({
        SYSTEM_OVERVIEW_RENDERING_FAILURE: ErrorCodes.RENDER_ERROR,
        DATA_SEARCH_INDEX_CORRUPTION: ErrorCodes.STORAGE_ERROR,
        SYSTEM_PAGINATION_OVERFLOW: ErrorCodes.PERFORMANCE_ERROR,
        DATA_EDIT_VALIDATION_CONFLICT: ErrorCodes.VALIDATION_ERROR
      })
    })

    test('應該快取映射表', () => {
      const mapping1 = UC06ErrorAdapter.getErrorMapping()
      const mapping2 = UC06ErrorAdapter.getErrorMapping()

      expect(mapping1).toBe(mapping2) // 相同參考
      expect(Object.isFrozen(mapping1)).toBe(true)
    })
  })

  describe('extractSubType', () => {
    test('應該提取正確的子類型', () => {
      expect(UC06ErrorAdapter.extractSubType('SYSTEM_OVERVIEW_RENDERING_FAILURE'))
        .toBe('OVERVIEW_RENDERING_FAILURE')
      expect(UC06ErrorAdapter.extractSubType('DATA_SEARCH_INDEX_CORRUPTION'))
        .toBe('SEARCH_INDEX_CORRUPTION')
      expect(UC06ErrorAdapter.extractSubType('SYSTEM_PAGINATION_OVERFLOW'))
        .toBe('PAGINATION_OVERFLOW')
      expect(UC06ErrorAdapter.extractSubType('DATA_EDIT_VALIDATION_CONFLICT'))
        .toBe('EDIT_VALIDATION_CONFLICT')
    })

    test('應該處理未知錯誤代碼', () => {
      expect(UC06ErrorAdapter.extractSubType('UNKNOWN_CODE'))
        .toBe('UNKNOWN_SUBTYPE')
      expect(UC06ErrorAdapter.extractSubType(''))
        .toBe('UNKNOWN_SUBTYPE')
    })
  })

  describe('convertError', () => {
    test('應該轉換SYSTEM_OVERVIEW_RENDERING_FAILURE為RENDER_ERROR', () => {
      const error = UC06ErrorAdapter.convertError(
        'SYSTEM_OVERVIEW_RENDERING_FAILURE',
        'Overview 頁面渲染失敗',
        { totalBooks: 500, memoryUsage: '90%' }
      )

      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('UC06Error')
      expect(error.code).toBe(ErrorCodes.RENDER_ERROR)
      expect(error.message).toBe('Overview 頁面渲染失敗')
      expect(error.subType).toBe('OVERVIEW_RENDERING_FAILURE')
      expect(error.details).toMatchObject({
        totalBooks: 500,
        memoryUsage: '90%',
        originalCode: 'SYSTEM_OVERVIEW_RENDERING_FAILURE',
        severity: 'SEVERE'
      })
    })

    test('應該轉換DATA_SEARCH_INDEX_CORRUPTION為STORAGE_ERROR', () => {
      const error = UC06ErrorAdapter.convertError(
        'DATA_SEARCH_INDEX_CORRUPTION',
        '搜尋索引損壞'
      )

      expect(error.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(error.subType).toBe('SEARCH_INDEX_CORRUPTION')
      expect(error.details.severity).toBe('MODERATE')
    })

    test('應該轉換SYSTEM_PAGINATION_OVERFLOW為PERFORMANCE_ERROR', () => {
      const error = UC06ErrorAdapter.convertError(
        'SYSTEM_PAGINATION_OVERFLOW',
        '分頁載入溢出'
      )

      expect(error.code).toBe(ErrorCodes.PERFORMANCE_ERROR)
      expect(error.subType).toBe('PAGINATION_OVERFLOW')
      expect(error.details.severity).toBe('MINOR')
    })

    test('應該轉換DATA_EDIT_VALIDATION_CONFLICT為VALIDATION_ERROR', () => {
      const error = UC06ErrorAdapter.convertError(
        'DATA_EDIT_VALIDATION_CONFLICT',
        '編輯驗證失敗'
      )

      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(error.subType).toBe('EDIT_VALIDATION_CONFLICT')
      expect(error.details.severity).toBe('MINOR')
    })

    test('應該使用預設訊息', () => {
      const error = UC06ErrorAdapter.convertError('SYSTEM_OVERVIEW_RENDERING_FAILURE')

      expect(error.message).toBe('UC-06 data management operation failed')
    })

    test('應該合併額外的詳細資訊', () => {
      const details = {
        customField: 'value',
        renderAttempt: 'retry'
      }

      const error = UC06ErrorAdapter.convertError(
        'SYSTEM_OVERVIEW_RENDERING_FAILURE',
        '測試訊息',
        details
      )

      expect(error.details).toMatchObject({
        customField: 'value',
        renderAttempt: 'retry',
        originalCode: 'SYSTEM_OVERVIEW_RENDERING_FAILURE'
      })
    })

    test('應該包含時間戳', () => {
      const before = Date.now()
      const error = UC06ErrorAdapter.convertError('SYSTEM_OVERVIEW_RENDERING_FAILURE', '測試')
      const after = Date.now()

      expect(error.details.timestamp).toBeGreaterThanOrEqual(before)
      expect(error.details.timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('convertError - 錯誤處理', () => {
    test('應該處理無效的錯誤代碼', () => {
      const error = UC06ErrorAdapter.convertError(null, '測試訊息')

      expect(error.name).toBe('UC06ConversionError')
      expect(error.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(error.subType).toBe('UC06_CONVERSION_ERROR')
      expect(error.message).toContain('Invalid error code provided')
      expect(error.details.conversionError).toBe(true)
    })

    test('應該處理未知的錯誤代碼', () => {
      const error = UC06ErrorAdapter.convertError('UNKNOWN_UC06_CODE', '測試訊息')

      expect(error.name).toBe('UC06ConversionError')
      expect(error.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(error.message).toContain('Unknown UC-06 error code')
      expect(error.details.unknownCode).toBe('UNKNOWN_UC06_CODE')
      expect(error.details.availableCodes).toEqual([
        'SYSTEM_OVERVIEW_RENDERING_FAILURE',
        'DATA_SEARCH_INDEX_CORRUPTION',
        'SYSTEM_PAGINATION_OVERFLOW',
        'DATA_EDIT_VALIDATION_CONFLICT'
      ])
    })

    test('應該處理空字串錯誤代碼', () => {
      const error = UC06ErrorAdapter.convertError('', '測試訊息')

      expect(error.name).toBe('UC06ConversionError')
      expect(error.message).toContain('Invalid error code provided')
    })

    test('應該處理非字串錯誤代碼', () => {
      const error = UC06ErrorAdapter.convertError(123, '測試訊息')

      expect(error.name).toBe('UC06ConversionError')
      expect(error.details.receivedCode).toBe(123)
    })
  })

  describe('getSeverityFromCode', () => {
    test('應該回傳正確的嚴重程度', () => {
      expect(UC06ErrorAdapter.getSeverityFromCode('SYSTEM_OVERVIEW_RENDERING_FAILURE'))
        .toBe('SEVERE')
      expect(UC06ErrorAdapter.getSeverityFromCode('DATA_SEARCH_INDEX_CORRUPTION'))
        .toBe('MODERATE')
      expect(UC06ErrorAdapter.getSeverityFromCode('SYSTEM_PAGINATION_OVERFLOW'))
        .toBe('MINOR')
      expect(UC06ErrorAdapter.getSeverityFromCode('DATA_EDIT_VALIDATION_CONFLICT'))
        .toBe('MINOR')
    })

    test('應該對未知代碼回傳預設嚴重程度', () => {
      expect(UC06ErrorAdapter.getSeverityFromCode('UNKNOWN_CODE'))
        .toBe('MODERATE')
    })
  })

  describe('isValidErrorCodesError', () => {
    test('應該驗證有效的ErrorCodes錯誤', () => {
      const error = UC06ErrorAdapter.convertError(
        'SYSTEM_OVERVIEW_RENDERING_FAILURE',
        '測試訊息'
      )

      expect(UC06ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
    })

    test('應該拒絕無效的錯誤物件', () => {
      const invalidError = new Error('普通錯誤')
      expect(UC06ErrorAdapter.isValidErrorCodesError(invalidError)).toBe(false)

      expect(UC06ErrorAdapter.isValidErrorCodesError(null)).toBe(false)
      expect(UC06ErrorAdapter.isValidErrorCodesError({})).toBe(false)
      expect(UC06ErrorAdapter.isValidErrorCodesError('string')).toBe(false)
    })

    test('應該檢查code屬性', () => {
      const errorWithoutCode = new Error('測試')
      errorWithoutCode.details = {}

      expect(UC06ErrorAdapter.isValidErrorCodesError(errorWithoutCode)).toBe(false)
    })

    test('應該檢查details屬性', () => {
      const errorWithoutDetails = new Error('測試')
      errorWithoutDetails.code = ErrorCodes.RENDER_ERROR

      expect(UC06ErrorAdapter.isValidErrorCodesError(errorWithoutDetails)).toBe(false)

      const errorWithNullDetails = new Error('測試')
      errorWithNullDetails.code = ErrorCodes.RENDER_ERROR
      errorWithNullDetails.details = null

      expect(UC06ErrorAdapter.isValidErrorCodesError(errorWithNullDetails)).toBe(false)
    })
  })

  describe('Chrome Extension 相容性', () => {
    test('錯誤物件應該可以JSON序列化', () => {
      const error = UC06ErrorAdapter.convertError(
        'SYSTEM_OVERVIEW_RENDERING_FAILURE',
        '測試訊息',
        { totalBooks: 1000 }
      )

      const serialized = JSON.stringify(error)
      expect(serialized).toBeDefined()

      const parsed = JSON.parse(serialized)
      expect(parsed.message).toBe('測試訊息')
      expect(parsed.code).toBe(ErrorCodes.RENDER_ERROR)
      expect(parsed.details.totalBooks).toBe(1000)
    })

    test('轉換錯誤應該可以JSON序列化', () => {
      const error = UC06ErrorAdapter.convertError('INVALID_CODE', '測試')

      const serialized = JSON.stringify(error)
      const parsed = JSON.parse(serialized)

      expect(parsed.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(parsed.details.conversionError).toBe(true)
    })

    test('應該支援toJSON方法', () => {
      const error = UC06ErrorAdapter.convertError(
        'SYSTEM_OVERVIEW_RENDERING_FAILURE',
        '測試訊息'
      )

      expect(typeof error.toJSON).toBe('function')

      const jsonObj = error.toJSON()
      expect(jsonObj.message).toBe('測試訊息')
      expect(jsonObj.code).toBe(ErrorCodes.RENDER_ERROR)
      expect(jsonObj.details).toBeDefined()
    })
  })

  describe('UI操作場景特定測試', () => {
    test('渲染錯誤應該包含效能資訊', () => {
      const error = UC06ErrorAdapter.convertError(
        'SYSTEM_OVERVIEW_RENDERING_FAILURE',
        '渲染失敗',
        {
          totalBooks: 500,
          renderAttempt: 'initial_load',
          memoryUsage: '90%',
          failurePoint: 'virtual_scrolling_initialization',
          degradedModeAvailable: true
        }
      )

      expect(error.details.totalBooks).toBe(500)
      expect(error.details.renderAttempt).toBe('initial_load')
      expect(error.details.memoryUsage).toBe('90%')
      expect(error.details.failurePoint).toBe('virtual_scrolling_initialization')
      expect(error.details.degradedModeAvailable).toBe(true)
    })

    test('索引錯誤應該包含損壞欄位', () => {
      const error = UC06ErrorAdapter.convertError(
        'DATA_SEARCH_INDEX_CORRUPTION',
        '索引損壞',
        {
          corruptedFields: ['title_index', 'author_index'],
          searchAccuracy: 'degraded',
          rebuildRequired: true,
          estimatedRebuildTime: '30s'
        }
      )

      expect(error.details.corruptedFields).toHaveLength(2)
      expect(error.details.searchAccuracy).toBe('degraded')
      expect(error.details.rebuildRequired).toBe(true)
      expect(error.details.estimatedRebuildTime).toBe('30s')
    })

    test('分頁錯誤應該包含載入資訊', () => {
      const error = UC06ErrorAdapter.convertError(
        'SYSTEM_PAGINATION_OVERFLOW',
        '分頁溢出',
        {
          requestedPage: 15,
          booksPerPage: 50,
          totalBooks: 1200,
          loadTimeout: true,
          fallbackStrategy: 'reduce_page_size'
        }
      )

      expect(error.details.requestedPage).toBe(15)
      expect(error.details.booksPerPage).toBe(50)
      expect(error.details.totalBooks).toBe(1200)
      expect(error.details.loadTimeout).toBe(true)
      expect(error.details.fallbackStrategy).toBe('reduce_page_size')
    })

    test('驗證錯誤應該包含編輯資訊', () => {
      const error = UC06ErrorAdapter.convertError(
        'DATA_EDIT_VALIDATION_CONFLICT',
        '驗證失敗',
        {
          editType: 'progress_update',
          bookId: 'book_789',
          invalidValue: '150%',
          validationRules: ['progress_0_to_100_percent'],
          userInput: 'correctable'
        }
      )

      expect(error.details.editType).toBe('progress_update')
      expect(error.details.bookId).toBe('book_789')
      expect(error.details.invalidValue).toBe('150%')
      expect(error.details.validationRules).toContain('progress_0_to_100_percent')
      expect(error.details.userInput).toBe('correctable')
    })
  })

  describe('效能測試', () => {
    test('大量錯誤轉換應該保持效能', () => {
      const startTime = Date.now()

      for (let i = 0; i < 100; i++) {
        UC06ErrorAdapter.convertError(
          'SYSTEM_OVERVIEW_RENDERING_FAILURE',
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
        UC06ErrorAdapter.getErrorMapping()
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(10) // 1000次存取應該在10ms內
    })
  })

  describe('錯誤分類驗證', () => {
    test('RENDER_ERROR 類型應該正確映射', () => {
      const renderError = UC06ErrorAdapter.convertError('SYSTEM_OVERVIEW_RENDERING_FAILURE', '渲染錯誤')

      expect(renderError.code).toBe(ErrorCodes.RENDER_ERROR)
    })

    test('STORAGE_ERROR 類型應該正確映射', () => {
      const storageError = UC06ErrorAdapter.convertError('DATA_SEARCH_INDEX_CORRUPTION', '儲存錯誤')

      expect(storageError.code).toBe(ErrorCodes.STORAGE_ERROR)
    })

    test('PERFORMANCE_ERROR 類型應該正確映射', () => {
      const perfError = UC06ErrorAdapter.convertError('SYSTEM_PAGINATION_OVERFLOW', '效能錯誤')

      expect(perfError.code).toBe(ErrorCodes.PERFORMANCE_ERROR)
    })

    test('VALIDATION_ERROR 類型應該正確映射', () => {
      const validationError = UC06ErrorAdapter.convertError('DATA_EDIT_VALIDATION_CONFLICT', '驗證錯誤')

      expect(validationError.code).toBe(ErrorCodes.VALIDATION_ERROR)
    })
  })
})
