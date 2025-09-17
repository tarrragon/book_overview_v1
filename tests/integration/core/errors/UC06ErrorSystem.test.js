/**
 * UC06ErrorSystem 整合測試
 * 測試 UC06ErrorAdapter 和 UC06ErrorFactory 的整合協作
 * 模擬真實的資料管理UI使用場景
 */

import { UC06ErrorAdapter } from '../../../../src/core/errors/UC06ErrorAdapter.js'
import { UC06ErrorFactory } from '../../../../src/core/errors/UC06ErrorFactory.js'
import { ErrorCodes } from '../../../../src/core/errors/ErrorCodes.js'

describe('UC06ErrorSystem 整合測試', () => {
  afterEach(() => {
    UC06ErrorFactory.clearCache()
  })

  describe('Adapter 與 Factory 協作', () => {
    test('Factory 建立的錯誤應該通過 Adapter 驗證', () => {
      const error = UC06ErrorFactory.createError(
        'SYSTEM_OVERVIEW_RENDERING_FAILURE',
        'Overview頁面渲染失敗'
      )

      expect(UC06ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
      expect(UC06ErrorFactory.isValidUC06Error(error)).toBe(true)
    })

    test('所有 Factory 方法產生的錯誤都應該有效', () => {
      const errors = [
        UC06ErrorFactory.createRenderingError(500),
        UC06ErrorFactory.createSearchIndexError(['title_index']),
        UC06ErrorFactory.createPaginationError(10, 50, 500),
        UC06ErrorFactory.createEditValidationError('progress_update', 'book_123')
      ]

      errors.forEach(error => {
        expect(UC06ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
        expect(UC06ErrorFactory.isValidUC06Error(error)).toBe(true)
      })
    })
  })

  describe('資料管理UI完整流程模擬', () => {
    test('模擬Overview頁面載入失敗流程', async () => {
      // 模擬大量書籍載入導致渲染失敗
      const renderingError = UC06ErrorFactory.createRenderingError(
        1500, // 大量書籍
        'initial_load',
        '95%', // 高記憶體使用
        'virtual_scrolling_initialization',
        true, // 有降級模式
        {
          browserTab: 'overview',
          userAgent: 'Chrome/120.0',
          screenResolution: '1920x1080',
          availableMemory: '100MB'
        }
      )

      // 驗證錯誤結構
      expect(renderingError.code).toBe(ErrorCodes.RENDER_ERROR)
      expect(renderingError.subType).toBe('OVERVIEW_RENDERING_FAILURE')
      expect(renderingError.details.severity).toBe('SEVERE')
      expect(renderingError.details.renderingStrategy).toBe('pagination_only')
      expect(renderingError.details.performanceMetrics.optimizationSuggested).toBe(true)
      expect(renderingError.details.suggestedActions).toContain('reduce_display_items')
      expect(renderingError.details.fallbackOptions.usePagination).toBe(true)

      // 建立結果物件
      const result = UC06ErrorFactory.createResult(false, null, renderingError)

      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCodes.RENDER_ERROR)
      expect(result.subType).toBe('OVERVIEW_RENDERING_FAILURE')
    })

    test('模擬搜尋功能索引損壞修復流程', async () => {
      // 模擬搜尋索引部分損壞
      const indexError = UC06ErrorFactory.createSearchIndexError(
        ['title_index', 'author_index', 'content_index'],
        'degraded',
        true, // 需要重建
        '45s',
        {
          lastSuccessfulSearch: '2025-01-16T08:00:00Z',
          totalIndexSize: '25MB',
          corruptionDetectedAt: Date.now(),
          userSearchQuery: '機器學習'
        }
      )

      expect(indexError.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(indexError.subType).toBe('SEARCH_INDEX_CORRUPTION')
      expect(indexError.details.corruptedFieldsCount).toBe(3)
      expect(indexError.details.indexHealthScore).toBeLessThan(50)
      expect(indexError.details.searchCapabilities.titleSearch).toBe(false)
      expect(indexError.details.searchCapabilities.authorSearch).toBe(false)
      expect(indexError.details.searchCapabilities.fuzzySearch).toBe(true)
      expect(indexError.details.suggestedActions).toContain('full_index_reset')

      // 模擬重建過程
      const rebuildStarted = indexError.details.rebuildStrategy.autoRebuild
      const backgroundProcess = indexError.details.rebuildStrategy.backgroundProcess

      expect(rebuildStarted).toBe(true)
      expect(backgroundProcess).toBe(true)
    })

    test('模擬分頁載入效能問題處理', async () => {
      // 模擬分頁載入超時
      const paginationError = UC06ErrorFactory.createPaginationError(
        25, // 第25頁
        100, // 每頁100本書
        3000, // 總共3000本書
        true, // 載入超時
        'reduce_page_size',
        {
          loadAttempts: 3,
          averageLoadTime: '8s',
          cacheHitRate: '20%',
          networkLatency: '500ms'
        }
      )

      expect(paginationError.code).toBe(ErrorCodes.PERFORMANCE_ERROR)
      expect(paginationError.subType).toBe('PAGINATION_OVERFLOW')
      expect(paginationError.details.totalPages).toBe(30)
      expect(paginationError.details.optimizedPageSize).toBe(20) // 建議減少到20
      expect(paginationError.details.performanceAnalysis.dataOverload).toBe(true)
      expect(paginationError.details.performanceAnalysis.memoryPressure).toBe(true)
      expect(paginationError.details.optimizationOptions.useIncrementalRendering).toBe(true)

      // 模擬優化後重試
      const optimizedError = UC06ErrorFactory.createPaginationError(
        25,
        paginationError.details.optimizedPageSize, // 使用優化的頁面大小
        3000,
        false // 不再超時
      )

      expect(optimizedError.details.loadTimeout).toBe(false)
      expect(optimizedError.details.performanceAnalysis.dataOverload).toBe(false)
    })

    test('模擬使用者編輯驗證與修正流程', async () => {
      // 模擬使用者輸入無效進度值
      const validationError = UC06ErrorFactory.createEditValidationError(
        'progress_update',
        'book_789',
        '250%', // 無效的進度值
        ['progress_0_to_100_percent'],
        'correctable',
        {
          previousValue: '75%',
          editTime: Date.now(),
          editSource: 'manual_input',
          userId: 'user_456'
        }
      )

      expect(validationError.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(validationError.subType).toBe('EDIT_VALIDATION_CONFLICT')
      expect(validationError.details.validationSuggestion).toBe('100%')
      expect(validationError.details.fieldConstraints.min).toBe(0)
      expect(validationError.details.fieldConstraints.max).toBe(100)
      expect(validationError.details.correctionOptions.autoCorrect).toBe(true)
      expect(validationError.details.suggestedActions).toContain('suggest_correction')

      // 模擬自動修正
      const autoCorrectValue = validationError.details.validationSuggestion
      expect(autoCorrectValue).toBe('100%')

      // 驗證修正後的值
      const correctedValidation = UC06ErrorFactory.createEditValidationError(
        'progress_update',
        'book_789',
        autoCorrectValue,
        ['progress_0_to_100_percent']
      )

      // 100%是有效值，應該不會產生驗證錯誤（在實際應用中不會建立錯誤）
      expect(correctedValidation.details.invalidValue).toBe('100%')
    })
  })

  describe('錯誤結果物件整合', () => {
    test('所有錯誤類型都應該可以包裝為結果物件', () => {
      const errors = [
        UC06ErrorFactory.createRenderingError(),
        UC06ErrorFactory.createSearchIndexError(),
        UC06ErrorFactory.createPaginationError(),
        UC06ErrorFactory.createEditValidationError()
      ]

      errors.forEach(error => {
        const result = UC06ErrorFactory.createResult(false, null, error)

        expect(result.success).toBe(false)
        expect(result.code).toBeDefined()
        expect(result.subType).toBeDefined()
        expect(result.details).toBeDefined()
        expect(Object.values(ErrorCodes)).toContain(result.code)
      })
    })

    test('成功UI操作應該產生正確的結果物件', () => {
      const successData = {
        displayedBooks: 100,
        renderTime: '1.5s',
        searchResults: 25,
        editsSaved: 3,
        cacheHits: 45
      }

      const result = UC06ErrorFactory.createResult(true, successData)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(successData)
      expect(result.code).toBe('SUCCESS')
      expect(result.message).toBe('Data management operation completed successfully')
    })
  })

  describe('效能與記憶體管理', () => {
    test('快取機制應該提升重複錯誤建立效能', () => {
      const startTime = Date.now()

      // 建立100個相同類型的錯誤
      for (let i = 0; i < 100; i++) {
        UC06ErrorFactory.getCommonError('RENDERING')
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(20) // 應該在20ms內完成
    })

    test('大型詳細資訊應該被正確清理', () => {
      const largeDetails = {
        books: new Array(10000).fill().map((_, i) => ({
          id: `book_${i}`,
          title: `Book Title ${i}`.repeat(100),
          author: `Author ${i}`,
          progress: Math.random() * 100
        }))
      }

      const sanitized = UC06ErrorFactory.sanitizeDetails(largeDetails)

      expect(sanitized._truncated).toBe(true)
      expect(sanitized._originalSize).toBeGreaterThan(15000)
      expect(sanitized.summary).toContain('truncated')
    })
  })

  describe('Chrome Extension 相容性', () => {
    test('所有錯誤都應該可以JSON序列化', () => {
      const errors = [
        UC06ErrorFactory.createRenderingError(500, 'initial_load', '85%'),
        UC06ErrorFactory.createSearchIndexError(['title_index'], 'degraded'),
        UC06ErrorFactory.createPaginationError(10, 50, 1000, true),
        UC06ErrorFactory.createEditValidationError('progress_update', 'book_123', '150%')
      ]

      errors.forEach(error => {
        const serialized = JSON.stringify(error)
        expect(serialized).toBeDefined()

        const parsed = JSON.parse(serialized)
        expect(parsed.message).toBe(error.message)
        expect(parsed.code).toBe(error.code)
        expect(parsed.details).toBeDefined()

        // 測試toJSON方法
        expect(typeof error.toJSON).toBe('function')
        const jsonObj = error.toJSON()
        expect(jsonObj.code).toBe(error.code)
        expect(jsonObj.subType).toBe(error.subType)
      })
    })
  })

  describe('實際使用場景模擬', () => {
    test('完整UI操作流程：從載入失敗到成功顯示', async () => {
      // 第一次嘗試：記憶體不足導致渲染失敗
      let attempt = 1
      let error = UC06ErrorFactory.createRenderingError(
        2000, 'initial_load', '98%', 'memory_allocation_failed', true
      )
      let result = UC06ErrorFactory.createResult(false, null, error)

      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCodes.RENDER_ERROR)

      // 第二次嘗試：啟用降級模式但分頁載入超時
      attempt++
      error = UC06ErrorFactory.createPaginationError(
        1, 50, 2000, true, 'reduce_page_size'
      )
      result = UC06ErrorFactory.createResult(false, null, error)

      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCodes.PERFORMANCE_ERROR)

      // 第三次嘗試：使用優化設定成功載入
      attempt++
      result = UC06ErrorFactory.createResult(true, {
        displayedBooks: 20, // 減少顯示數量
        renderMode: 'simplified',
        loadTime: '2.5s',
        attempt
      })

      expect(result.success).toBe(true)
      expect(result.data.attempt).toBe(3)
      expect(result.data.displayedBooks).toBe(20)
    })

    test('搜尋與編輯綜合場景', async () => {
      // 步驟1：搜尋索引損壞
      const searchError = UC06ErrorFactory.createSearchIndexError(
        ['author_index'], 'degraded', true, '20s'
      )

      expect(searchError.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(searchError.details.searchCapabilities.titleSearch).toBe(true)
      expect(searchError.details.searchCapabilities.authorSearch).toBe(false)

      // 步驟2：嘗試編輯但驗證失敗
      const editError = UC06ErrorFactory.createEditValidationError(
        'author_edit',
        'book_456',
        '', // 空作者名稱
        ['required_field'],
        'correctable'
      )

      expect(editError.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(editError.details.fieldConstraints.required).toBe(true)

      // 步驟3：修正後成功
      const successResult = UC06ErrorFactory.createResult(true, {
        searchIndexRebuilt: true,
        editsSaved: 1,
        validationPassed: true
      })

      expect(successResult.success).toBe(true)
      expect(successResult.data.searchIndexRebuilt).toBe(true)
    })
  })
})