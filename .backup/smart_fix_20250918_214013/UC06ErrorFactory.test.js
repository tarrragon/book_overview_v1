/**
 * UC06ErrorFactory 單元測試
 * 測試 UC-06 資料管理UI專用錯誤建立工廠的所有功能
 * 基於 UC-01~UC-05 成功測試模式，針對UI操作場景優化
 */

import { UC06ErrorFactory } from '../../../../src/core/errors/UC06ErrorFactory.js'
import { ErrorCodes } from '../../../../src/core/errors/ErrorCodes.js'

describe('UC06ErrorFactory', () => {
  afterEach(() => {
    // 清除快取避免測試間影響
    UC06ErrorFactory.clearCache()
  })

  describe('createError', () => {
    test('應該建立基本的 UC-06 錯誤', () => {
      const error = UC06ErrorFactory.createError(
        'SYSTEM_OVERVIEW_RENDERING_FAILURE',
        'Overview頁面渲染失敗'
      )

      expect(error).toBeInstanceOf(Error)
      expect(error.code).toBe(ErrorCodes.RENDER_ERROR)
      expect(error.message).toBe('Overview頁面渲染失敗')
      expect(error.details.originalCode).toBe('SYSTEM_OVERVIEW_RENDERING_FAILURE')
    })

    test('應該建立帶有詳細資訊的錯誤', () => {
      const details = {
        totalBooks: 500,
        memoryUsage: '90%'
      }

      const error = UC06ErrorFactory.createError(
        'SYSTEM_OVERVIEW_RENDERING_FAILURE',
        '渲染失敗',
        details
      )

      expect(error.details).toMatchObject(details)
      expect(error.details.originalCode).toBe('SYSTEM_OVERVIEW_RENDERING_FAILURE')
    })
  })

  describe('createResult', () => {
    test('應該建立成功結果物件', () => {
      const result = UC06ErrorFactory.createResult(true, {
        displayedBooks: 100,
        renderTime: '1.5s'
      })

      expect(result.success).toBe(true)
      expect(result.code).toBe('SUCCESS')
      expect(result.data.displayedBooks).toBe(100)
      expect(result.message).toBe('Data management operation completed successfully')
    })

    test('應該建立失敗結果物件', () => {
      const error = UC06ErrorFactory.createError(
        'SYSTEM_OVERVIEW_RENDERING_FAILURE',
        '渲染失敗'
      )
      const result = UC06ErrorFactory.createResult(false, null, error)

      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCodes.RENDER_ERROR)
      expect(result.error).toBe('渲染失敗')
      expect(result.subType).toBe('OVERVIEW_RENDERING_FAILURE')
    })

    test('應該處理簡單錯誤物件', () => {
      const simpleError = new Error('簡單錯誤')
      const result = UC06ErrorFactory.createResult(false, null, simpleError)

      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(result.error).toBe('簡單錯誤')
    })
  })

  describe('createRenderingError', () => {
    test('應該建立Overview頁面渲染失敗錯誤', () => {
      const error = UC06ErrorFactory.createRenderingError(
        500, // totalBooks
        'initial_load', // renderAttempt
        '90%', // memoryUsage
        'virtual_scrolling_initialization', // failurePoint
        true // degradedModeAvailable
      )

      expect(error.code).toBe(ErrorCodes.RENDER_ERROR)
      expect(error.subType).toBe('OVERVIEW_RENDERING_FAILURE')
      expect(error.details.totalBooks).toBe(500)
      expect(error.details.renderingStrategy).toBe('virtual_scrolling')
      expect(error.details.performanceMetrics.optimizationSuggested).toBe(true)
    })

    test('應該包含渲染策略資訊', () => {
      const error1 = UC06ErrorFactory.createRenderingError(50) // 少量書籍
      expect(error1.details.renderingStrategy).toBe('direct_render')

      const error2 = UC06ErrorFactory.createRenderingError(1500) // 大量書籍
      expect(error2.details.renderingStrategy).toBe('pagination_only')
    })

    test('應該使用預設參數', () => {
      const error = UC06ErrorFactory.createRenderingError()

      expect(error.details.totalBooks).toBe(0)
      expect(error.details.renderAttempt).toBe('initial_load')
      expect(error.details.degradedModeAvailable).toBe(true)
    })
  })

  describe('createSearchIndexError', () => {
    test('應該建立搜尋索引損壞錯誤', () => {
      const error = UC06ErrorFactory.createSearchIndexError(
        ['title_index', 'author_index'], // corruptedFields
        'degraded', // searchAccuracy
        true, // rebuildRequired
        '30s' // estimatedRebuildTime
      )

      expect(error.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(error.subType).toBe('SEARCH_INDEX_CORRUPTION')
      expect(error.details.corruptedFieldsCount).toBe(2)
      expect(error.details.indexHealthScore).toBeLessThan(100)
      expect(error.details.searchCapabilities.titleSearch).toBe(false)
      expect(error.details.searchCapabilities.authorSearch).toBe(false)
    })

    test('應該計算索引健康分數', () => {
      const error1 = UC06ErrorFactory.createSearchIndexError([], 'normal')
      expect(error1.details.indexHealthScore).toBe(100)

      const error2 = UC06ErrorFactory.createSearchIndexError(
        ['field1', 'field2'], 'degraded'
      )
      expect(error2.details.indexHealthScore).toBe(10) // 50 - 2*20
    })

    test('應該使用預設參數', () => {
      const error = UC06ErrorFactory.createSearchIndexError()

      expect(error.details.corruptedFields).toEqual([])
      expect(error.details.rebuildRequired).toBe(true)
      expect(error.details.estimatedRebuildTime).toBe('30s')
    })
  })

  describe('createPaginationError', () => {
    test('應該建立分頁載入溢出錯誤', () => {
      const error = UC06ErrorFactory.createPaginationError(
        15, // requestedPage
        50, // booksPerPage
        1200, // totalBooks
        true, // loadTimeout
        'reduce_page_size' // fallbackStrategy
      )

      expect(error.code).toBe(ErrorCodes.PERFORMANCE_ERROR)
      expect(error.subType).toBe('PAGINATION_OVERFLOW')
      expect(error.details.totalPages).toBe(24) // Math.ceil(1200/50)
      expect(error.details.optimizedPageSize).toBe(20) // loadTimeout時減少
      expect(error.details.performanceAnalysis.dataOverload).toBe(true)
    })

    test('應該計算最佳頁面大小', () => {
      const error1 = UC06ErrorFactory.createPaginationError(1, 50, 50, false)
      expect(error1.details.optimizedPageSize).toBe(50)

      const error2 = UC06ErrorFactory.createPaginationError(1, 50, 600, false)
      expect(error2.details.optimizedPageSize).toBe(20)
    })

    test('應該使用預設參數', () => {
      const error = UC06ErrorFactory.createPaginationError()

      expect(error.details.requestedPage).toBe(1)
      expect(error.details.booksPerPage).toBe(50)
      expect(error.details.fallbackStrategy).toBe('reduce_page_size')
    })
  })

  describe('createEditValidationError', () => {
    test('應該建立編輯驗證衝突錯誤', () => {
      const error = UC06ErrorFactory.createEditValidationError(
        'progress_update', // editType
        'book_789', // bookId
        '150%', // invalidValue
        ['progress_0_to_100_percent'], // validationRules
        'correctable' // userInput
      )

      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(error.subType).toBe('EDIT_VALIDATION_CONFLICT')
      expect(error.details.validationSuggestion).toBe('100%')
      expect(error.details.fieldConstraints.min).toBe(0)
      expect(error.details.fieldConstraints.max).toBe(100)
      expect(error.details.correctionOptions.autoCorrect).toBe(true)
    })

    test('應該提供驗證建議', () => {
      const error1 = UC06ErrorFactory.createEditValidationError(
        'progress_update', 'book_123', '150%'
      )
      expect(error1.details.validationSuggestion).toBe('100%')

      const error2 = UC06ErrorFactory.createEditValidationError(
        'progress_update', 'book_123', '-50%'
      )
      expect(error2.details.validationSuggestion).toBe('0%')
    })

    test('應該使用預設參數', () => {
      const error = UC06ErrorFactory.createEditValidationError()

      expect(error.details.editType).toBe('unknown_edit')
      expect(error.details.bookId).toBe('')
      expect(error.details.userInput).toBe('correctable')
    })
  })

  describe('createUIProgressError', () => {
    test('應該為渲染相關階段建立渲染錯誤', () => {
      const error = UC06ErrorFactory.createUIProgressError(
        50, // progress
        'render_initial', // stage
        { totalBooks: 500 }
      )

      expect(error.code).toBe(ErrorCodes.RENDER_ERROR)
      expect(error.details.progress).toBe(50)
    })

    test('應該為索引相關階段建立索引錯誤', () => {
      const error = UC06ErrorFactory.createUIProgressError(
        75,
        'search_index_rebuild',
        { corruptedFields: ['title'] }
      )

      expect(error.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(error.details.stage).toBe('search_index_rebuild')
    })

    test('應該為分頁相關階段建立分頁錯誤', () => {
      const error = UC06ErrorFactory.createUIProgressError(
        25,
        'pagination_load',
        { page: 5, pageSize: 50 }
      )

      expect(error.code).toBe(ErrorCodes.PERFORMANCE_ERROR)
    })

    test('應該為其他階段建立驗證錯誤', () => {
      const error = UC06ErrorFactory.createUIProgressError(
        90,
        'data_update',
        { bookId: 'book_123' }
      )

      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
    })
  })

  describe('getCommonError - 快取機制', () => {
    test('應該快取常用錯誤', () => {
      const error1 = UC06ErrorFactory.getCommonError('RENDERING')
      const error2 = UC06ErrorFactory.getCommonError('RENDERING')

      expect(error1).toBe(error2)
      expect(error1.details.cached).toBe(true)
      expect(Object.isFrozen(error1)).toBe(true)
    })

    test('應該支援所有快取錯誤類型', () => {
      const types = ['RENDERING', 'SEARCH_INDEX', 'PAGINATION', 'EDIT_VALIDATION']

      types.forEach(type => {
        const error = UC06ErrorFactory.getCommonError(type)
        expect(error).toBeInstanceOf(Error)
        expect(error.details.cached).toBe(true)
      })
    })

    test('應該處理未知快取類型', () => {
      const error = UC06ErrorFactory.getCommonError('UNKNOWN_TYPE')
      expect(error).toBeNull()
    })
  })

  describe('clearCache', () => {
    test('應該清除錯誤快取', () => {
      const error1 = UC06ErrorFactory.getCommonError('RENDERING')
      expect(error1.details.cached).toBe(true)

      UC06ErrorFactory.clearCache()

      const error2 = UC06ErrorFactory.getCommonError('RENDERING')
      expect(error2).not.toBe(error1)
    })
  })

  describe('sanitizeDetails', () => {
    test('應該保留正常大小的詳細資訊', () => {
      const details = { field1: 'value1', field2: 'value2' }
      const sanitized = UC06ErrorFactory.sanitizeDetails(details)

      expect(sanitized).toEqual(details)
    })

    test('應該截斷過大的詳細資訊', () => {
      const largeDetails = {
        books: new Array(1000).fill('x'.repeat(100))
      }

      const sanitized = UC06ErrorFactory.sanitizeDetails(largeDetails)

      expect(sanitized._truncated).toBe(true)
      expect(sanitized._originalSize).toBeGreaterThan(15000)
    })

    test('應該處理無效輸入', () => {
      expect(UC06ErrorFactory.sanitizeDetails(null)).toEqual({})
      expect(UC06ErrorFactory.sanitizeDetails(undefined)).toEqual({})
      expect(UC06ErrorFactory.sanitizeDetails('string')).toEqual({})
    })
  })

  describe('isValidUC06Error', () => {
    test('應該驗證有效的 UC-06 錯誤', () => {
      const error = UC06ErrorFactory.createRenderingError(500)

      expect(UC06ErrorFactory.isValidUC06Error(error)).toBe(true)
    })

    test('應該拒絕無效的錯誤', () => {
      const invalidError = new Error('普通錯誤')
      expect(UC06ErrorFactory.isValidUC06Error(invalidError)).toBe(false)

      expect(UC06ErrorFactory.isValidUC06Error(null)).toBe(false)
      expect(UC06ErrorFactory.isValidUC06Error({})).toBe(false)
    })

    test('應該檢查UC-06相關的subType', () => {
      const error = UC06ErrorFactory.createError(
        'SYSTEM_OVERVIEW_RENDERING_FAILURE',
        '測試'
      )
      error.subType = 'OTHER_ERROR'

      expect(UC06ErrorFactory.isValidUC06Error(error)).toBe(false)
    })
  })

  describe('UI操作場景專用測試', () => {
    test('渲染錯誤應該包含UI指引', () => {
      const error = UC06ErrorFactory.createRenderingError(1000)

      expect(error.details.userGuidance).toContain('降級模式')
      expect(error.details.fallbackOptions.useVirtualScrolling).toBe(true)
      expect(error.details.fallbackOptions.usePagination).toBe(true)
    })

    test('索引錯誤應該提供搜尋能力狀態', () => {
      const error = UC06ErrorFactory.createSearchIndexError(
        ['title_index']
      )

      expect(error.details.searchCapabilities.titleSearch).toBe(false)
      expect(error.details.searchCapabilities.authorSearch).toBe(true)
      expect(error.details.rebuildStrategy.autoRebuild).toBe(true)
    })

    test('分頁錯誤應該提供優化建議', () => {
      const error = UC06ErrorFactory.createPaginationError(
        10, 100, 2000, true
      )

      expect(error.details.optimizationOptions.recommendedPageSize).toBe(20)
      expect(error.details.optimizationOptions.useIncrementalRendering).toBe(true)
      expect(error.details.optimizationOptions.enableCaching).toBe(true)
    })

    test('驗證錯誤應該提供修正幫助', () => {
      const error = UC06ErrorFactory.createEditValidationError(
        'progress_update',
        'book_123',
        '200%'
      )

      expect(error.details.correctionOptions.suggestedValue).toBe('100%')
      expect(error.details.correctionOptions.validationHelp).toContain('0-100')
    })
  })

  describe('效能測試', () => {
    test('常用錯誤建立應該快速', () => {
      const startTime = Date.now()

      for (let i = 0; i < 100; i++) {
        UC06ErrorFactory.getCommonError('RENDERING')
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(10)
    })

    test('錯誤建立應該在合理時間內完成', () => {
      const startTime = Date.now()

      for (let i = 0; i < 100; i++) {
        UC06ErrorFactory.createRenderingError(500)
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(50)
    })
  })

  describe('私有輔助方法測試', () => {
    test('_determineRenderingStrategy 應該正確決定策略', () => {
      const error1 = UC06ErrorFactory.createRenderingError(50)
      expect(error1.details.renderingStrategy).toBe('direct_render')

      const error2 = UC06ErrorFactory.createRenderingError(300)
      expect(error2.details.renderingStrategy).toBe('batch_render')

      const error3 = UC06ErrorFactory.createRenderingError(700)
      expect(error3.details.renderingStrategy).toBe('virtual_scrolling')

      const error4 = UC06ErrorFactory.createRenderingError(1500)
      expect(error4.details.renderingStrategy).toBe('pagination_only')
    })

    test('_estimateRenderTime 應該正確估算時間', () => {
      const error1 = UC06ErrorFactory.createRenderingError(50)
      expect(error1.details.performanceMetrics.estimatedRenderTime).toBe('< 1s')

      const error2 = UC06ErrorFactory.createRenderingError(300)
      expect(error2.details.performanceMetrics.estimatedRenderTime).toBe('1-3s')
    })
  })
})
