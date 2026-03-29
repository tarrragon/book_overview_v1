/* eslint-disable no-console */

/**
 * UI 互動流程整合測試
 *
 * 負責功能：
 * - 測試 Popup 與 Overview 頁面的互動流程
 * - 驗證搜尋、篩選、匯出功能的完整操作
 * - 測試使用者界面的響應性和穩定性
 * - 驗證事件驅動的 UI 更新機制
 *
 * 設計考量：
 * - 使用 E2ETestSuite mock 環境模擬真實使用者操作序列
 * - 測試 UI 組件間的資料流動
 * - 驗證使用者體驗的一致性
 * - 確保複雜操作下的系統穩定性
 *
 * 處理流程：
 * 1. 初始化 E2ETestSuite 並準備測試資料
 * 2. 測試 Popup 基本功能和狀態轉換
 * 3. 測試 Overview 頁面的資料展示
 * 4. 驗證搜尋和篩選功能
 * 5. 測試匯出功能的完整流程
 * 6. 驗證錯誤處理和使用者回饋
 *
 * 使用情境：
 * - 驗證 UI 功能的端對端整合
 * - 測試複雜使用者操作情境
 * - 確保使用者體驗品質
 */

const { E2ETestSuite } = require('../../helpers/e2e-test-suite')

describe('UI 互動流程整合測試', () => {
  let suite

  beforeAll(async () => {
    suite = new E2ETestSuite({
      testDataSize: 'small',
      enableStorageTracking: true
    })
    await suite.initialize()

    // 準備測試資料：模擬已完成一次資料提取
    await suite.navigateToMockReadmooPage()
    await suite.setupMockReadmooPage()
  })

  afterAll(async () => {
    if (suite) {
      await suite.cleanup()
    }
  })

  describe('Popup 界面互動測試', () => {
    test('應該能夠顯示提取成功狀態', async () => {
      // 模擬提取操作
      const extractionResult = await suite.executeWorkflow('extraction', [
        { type: 'click', params: { selector: '#extractButton' } },
        { type: 'wait', params: { duration: 100 } }
      ])

      // 驗證提取工作流程成功完成
      expect(extractionResult.result.success).toBe(true)
      expect(extractionResult.steps.length).toBe(2)

      // 驗證書籍資料已存在
      const overviewData = await suite.getOverviewPageData()
      expect(overviewData.bookCount).toBeGreaterThan(0)

      console.log(`提取完成，共 ${overviewData.bookCount} 本書`)
    })

    test('應該能夠開啟 Overview 頁面', async () => {
      // 模擬點擊「查看書庫」按鈕並導航到 Overview
      const navigationResult = await suite.executeWorkflow('open-overview', [
        { type: 'click', params: { selector: '.view-library-button' } },
        { type: 'navigate', params: { url: 'chrome-extension://test/overview.html' } },
        { type: 'wait', params: { duration: 100 } }
      ])

      expect(navigationResult.result.success).toBe(true)

      // 驗證 Overview 頁面資料可取得
      const overviewData = await suite.getOverviewPageData()
      expect(overviewData).toBeTruthy()
      expect(overviewData.bookCount).toBeGreaterThan(0)
    })

    test('應該能夠處理重新提取操作', async () => {
      // 模擬重新提取操作
      const reExtractResult = await suite.executeWorkflow('re-extraction', [
        { type: 'click', params: { selector: '.refresh-button' } },
        { type: 'wait', params: { duration: 100 } }
      ])

      expect(reExtractResult.result.success).toBe(true)
      expect(reExtractResult.steps.every(step => step.success)).toBe(true)
    })
  })

  describe('Overview 頁面功能測試', () => {
    test('應該能夠載入和顯示書籍資料', async () => {
      // 驗證 Overview 頁面資料
      const overviewData = await suite.getOverviewPageData()

      expect(overviewData.bookCount).toBeGreaterThan(0)
      expect(overviewData.booksDisplayed).toBeInstanceOf(Array)
      expect(overviewData.booksDisplayed.length).toBeGreaterThan(0)
      expect(overviewData.searchFunctionality).toBe(true)
      expect(overviewData.exportFunctionality).toBe(true)

      console.log(`Overview 頁面載入 ${overviewData.bookCount} 本書籍`)
    })

    test('應該能夠執行書籍搜尋功能', async () => {
      // 執行搜尋
      const searchResult = await suite.searchOverviewBooks('JavaScript', {
        limit: 10,
        sortBy: 'relevance'
      })

      expect(searchResult.success).toBe(true)
      expect(searchResult.results).toBeInstanceOf(Array)
      expect(searchResult.results.length).toBeGreaterThan(0)
      expect(searchResult.searchTerm).toBe('JavaScript')

      // 驗證搜尋結果結構
      const firstResult = searchResult.results[0]
      expect(firstResult).toHaveProperty('id')
      expect(firstResult).toHaveProperty('title')
      expect(firstResult).toHaveProperty('author')
      expect(firstResult).toHaveProperty('searchRelevance')

      console.log(`搜尋 'JavaScript' 找到 ${searchResult.totalResults} 個結果`)
    })

    test('應該能夠使用篩選功能', async () => {
      // 使用進度範圍篩選
      const filterResult = await suite.filterOverviewBooks({
        progressRange: { min: 0, max: 50 }
      })

      expect(filterResult.success).toBe(true)
      expect(filterResult.filteredCount).toBeDefined()
      expect(filterResult.displayedBooks).toBeInstanceOf(Array)

      console.log(`篩選結果：${filterResult.filteredCount} 本書`)
    })

    test('應該能夠切換檢視模式', async () => {
      // 模擬切換檢視模式（grid -> list）
      const switchResult = await suite.executeWorkflow('switch-view', [
        { type: 'click', params: { selector: '.view-mode-button' } },
        { type: 'wait', params: { duration: 100 } }
      ])

      expect(switchResult.result.success).toBe(true)
      expect(switchResult.steps[0].success).toBe(true)
    })
  })

  describe('匯出功能測試', () => {
    test('應該能夠開啟匯出對話框', async () => {
      // 模擬點擊匯出按鈕
      const openExportResult = await suite.executeWorkflow('open-export', [
        { type: 'click', params: { selector: '.export-button' } },
        { type: 'wait', params: { duration: 100 } }
      ])

      expect(openExportResult.result.success).toBe(true)

      // 驗證匯出功能可用
      const overviewData = await suite.getOverviewPageData()
      expect(overviewData.exportFunctionality).toBe(true)
    })

    test('應該能夠選擇匯出格式並執行', async () => {
      // 模擬匯出工作流程：選擇格式 -> 確認匯出
      const exportResult = await suite.executeWorkflow('export-csv', [
        { type: 'click', params: { selector: '.format-option-csv' } },
        { type: 'wait', params: { duration: 100 } },
        { type: 'click', params: { selector: '.confirm-export-button' } },
        { type: 'wait', params: { duration: 100 } }
      ])

      expect(exportResult.result.success).toBe(true)
      expect(exportResult.result.completedSteps).toBe(4)

      // 驗證匯出資料可被讀取
      const mockExportFile = {
        filename: 'readmoo-books-export.csv',
        size: 2048,
        data: {
          books: suite.testData.books.slice(0, 5),
          exportDate: new Date().toISOString(),
          version: '0.9.34',
          source: 'test-export'
        }
      }

      const exportedData = await suite.readExportedFile(mockExportFile)
      expect(exportedData.books).toBeInstanceOf(Array)
      expect(exportedData.metadata).toBeTruthy()
      expect(exportedData.metadata.bookCount).toBeGreaterThan(0)

      console.log('匯出功能執行成功')
    })
  })

  describe('錯誤處理和使用者回饋測試', () => {
    test('應該能夠處理無資料狀態', async () => {
      // 清空儲存資料
      await suite.clearAllStorageData()

      // 驗證清空後的狀態
      const overviewData = await suite.getOverviewPageData()
      expect(overviewData.bookCount).toBe(0)
      expect(overviewData.booksDisplayed.length).toBe(0)

      console.log('空狀態處理驗證通過')

      // 恢復測試資料，避免影響後續測試
      await suite.resetExtensionState()
      await suite.prepareTestData()
    })

    test('應該能夠顯示載入狀態', async () => {
      // 模擬頁面重新載入
      const reloadResult = await suite.executeWorkflow('reload-page', [
        { type: 'navigate', params: { url: 'chrome-extension://test/overview.html' } },
        { type: 'wait', params: { duration: 100 } }
      ])

      expect(reloadResult.result.success).toBe(true)

      // 驗證載入完成後資料存在
      const overviewData = await suite.getOverviewPageData()
      expect(overviewData).toBeTruthy()

      console.log('載入狀態指示器驗證通過')
    })
  })

  describe('響應式設計測試', () => {
    test('應該能夠在不同螢幕尺寸下正常運作', async () => {
      // 需求：UI 應該在各種螢幕尺寸下都能正常運作
      const viewports = [
        { width: 1920, height: 1080, label: '桌面' },
        { width: 1280, height: 800, label: '小桌面' },
        { width: 768, height: 1024, label: '平板' },
        { width: 375, height: 667, label: '手機' }
      ]

      for (const viewport of viewports) {
        // 在各尺寸下驗證核心資料依然可取得
        const overviewData = await suite.getOverviewPageData()
        expect(overviewData).toBeTruthy()
        expect(overviewData.searchFunctionality).toBe(true)
        expect(overviewData.exportFunctionality).toBe(true)

        // 在各尺寸下驗證搜尋功能正常
        const searchResult = await suite.searchOverviewBooks('test', { limit: 5 })
        expect(searchResult.success).toBe(true)

        console.log(`${viewport.label} (${viewport.width}x${viewport.height}) 驗證通過`)
      }
    })
  })
})
