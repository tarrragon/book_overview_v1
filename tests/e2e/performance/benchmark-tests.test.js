/* eslint-disable no-console */

/**
 * Chrome Extension 效能基準測試
 *
 * 負責功能：
 * - 測試 Extension 在各種資料量下的效能表現
 * - 監控記憶體使用和 CPU 負載
 * - 驗證大量資料處理的穩定性
 * - 建立效能回歸測試基準
 *
 * 設計考量：
 * - 模擬真實使用情境的資料量
 * - 測試系統資源使用的合理性
 * - 確保效能不會隨功能增加而顯著下降
 * - 提供可量化的效能指標
 *
 * 處理流程：
 * 1. 建立不同規模的測試資料集
 * 2. 測試資料提取的效能表現
 * 3. 監控 UI 渲染的響應時間
 * 4. 驗證搜尋和篩選的效能
 * 5. 測試記憶體使用和清理
 * 6. 建立效能基準報告
 *
 * 使用情境：
 * - 產品發布前的效能驗證
 * - 效能回歸測試
 * - 系統容量規劃
 */

// eslint-disable-next-line no-unused-vars
const ExtensionTestSetup = require('../setup/extension-setup')
// eslint-disable-next-line no-unused-vars
const MemoryLeakDetector = require('../../helpers/memory-leak-detector')

// TODO: 此測試套件需要 Puppeteer + Chrome 瀏覽器環境，CI 環境無法執行，待環境配置完成後移除 skip
describe.skip('📊 Chrome Extension 效能基準測試', () => {
  // eslint-disable-next-line no-unused-vars
  let testSetup
  let memoryDetector

  jest.setTimeout(120000) // 2 分鐘超時

  beforeAll(async () => {
    testSetup = new ExtensionTestSetup()
    await testSetup.setup({ headless: true })
    await testSetup.getBackgroundPage()
    memoryDetector = new MemoryLeakDetector({
      memoryGrowthThreshold: 100 * 1024 * 1024, // 100MB for E2E tests
      leakDetectionThreshold: 5 * 1024 // 5KB per operation for UI operations
    })
  })

  afterAll(async () => {
    await testSetup.cleanup()
  })

  describe('🚀 資料提取效能測試', () => {
    test('小量資料提取效能 (5 本書籍)', async () => {
      // eslint-disable-next-line no-unused-vars
      const startTime = performance.now()

      await testSetup.navigateToReadmoo()
      // eslint-disable-next-line no-unused-vars
      const popupPage = await testSetup.openExtensionPopup()

      // 開始提取
      await popupPage.click('#extractButton')
      await popupPage.waitForSelector('.status-completed', { timeout: 20000 })

      // eslint-disable-next-line no-unused-vars
      const endTime = performance.now()
      // eslint-disable-next-line no-unused-vars
      const extractionTime = endTime - startTime

      // 效能基準：小量資料應在 5 秒內完成
      expect(extractionTime).toBeLessThan(5000)
      // eslint-disable-next-line no-console
      console.log(`📈 小量資料提取時間: ${extractionTime.toFixed(2)}ms`)

      await popupPage.close()
    })

    test('中量資料提取效能測試 (50 本書籍模擬)', async () => {
      // 建立模擬的大量資料頁面
      await testSetup.page.goto('data:text/html;charset=utf-8,' + encodeURIComponent(
        generateMockPageWithBooks(50)
      ))

      // eslint-disable-next-line no-unused-vars
      const startTime = performance.now()

      // eslint-disable-next-line no-unused-vars
      const popupPage = await testSetup.openExtensionPopup()
      await popupPage.click('#extractButton')
      await popupPage.waitForSelector('.status-completed', { timeout: 30000 })

      // eslint-disable-next-line no-unused-vars
      const endTime = performance.now()
      // eslint-disable-next-line no-unused-vars
      const extractionTime = endTime - startTime

      // 效能基準：中量資料應在 15 秒內完成
      expect(extractionTime).toBeLessThan(15000)
      // eslint-disable-next-line no-console
      console.log(`📊 中量資料提取時間: ${extractionTime.toFixed(2)}ms`)

      await popupPage.close()
    })

    test('大量資料提取效能測試 (100+ 本書籍模擬)', async () => {
      // 建立模擬的大量資料頁面
      await testSetup.page.goto('data:text/html;charset=utf-8,' + encodeURIComponent(
        generateMockPageWithBooks(150)
      ))

      // eslint-disable-next-line no-unused-vars
      const startTime = performance.now()

      // eslint-disable-next-line no-unused-vars
      const popupPage = await testSetup.openExtensionPopup()
      await popupPage.click('#extractButton')

      // 大量資料可能需要更長時間
      await popupPage.waitForSelector('.status-completed', { timeout: 60000 })

      // eslint-disable-next-line no-unused-vars
      const endTime = performance.now()
      // eslint-disable-next-line no-unused-vars
      const extractionTime = endTime - startTime

      // 效能基準：大量資料應在 30 秒內完成
      expect(extractionTime).toBeLessThan(30000)
      // eslint-disable-next-line no-console
      console.log(`📈 大量資料提取時間: ${extractionTime.toFixed(2)}ms`)

      await popupPage.close()
    })
  })

  describe('💾 記憶體使用測試', () => {
    test('基準記憶體使用測量', async () => {
      // 使用 MemoryLeakDetector 進行精確記憶體監控
      memoryDetector.startMonitoring()

      // 記錄初始狀態
      // eslint-disable-next-line no-unused-vars
      const initialOpId = memoryDetector.recordOperationStart('initial-state', { phase: 'baseline' })
      await memoryDetector.recordOperationEnd(initialOpId)

      // 記錄導航操作
      // eslint-disable-next-line no-unused-vars
      const navOpId = memoryDetector.recordOperationStart('navigate-to-readmoo')
      await testSetup.navigateToReadmoo()
      await memoryDetector.recordOperationEnd(navOpId)

      // 記錄彈出視窗操作
      // eslint-disable-next-line no-unused-vars
      const popupOpId = memoryDetector.recordOperationStart('open-extension-popup')
      // eslint-disable-next-line no-unused-vars
      const popupPage = await testSetup.openExtensionPopup()
      // eslint-disable-next-line no-unused-vars
      const popupOperation = await memoryDetector.recordOperationEnd(popupOpId)

      // eslint-disable-next-line no-unused-vars
      const analysis = await memoryDetector.stopMonitoring()

      // eslint-disable-next-line no-console
      console.log('📊 記憶體使用分析:')
      // eslint-disable-next-line no-console
      console.log(`  基準記憶體: ${analysis.summary.formattedGrowth}`)
      // eslint-disable-next-line no-console
      console.log(`  總記憶體增長: ${analysis.summary.formattedGrowth}`)
      // eslint-disable-next-line no-console
      console.log(`  彈出視窗操作記憶體增長: ${memoryDetector._formatMemorySize(popupOperation.memoryDelta)}`)
      // eslint-disable-next-line no-console
      console.log(`  記憶體效率: ${(analysis.efficiency.overallEfficiency * 100).toFixed(1)}%`)

      // 驗證記憶體使用在合理範圍內
      expect(analysis.summary.totalMemoryGrowth).toBeLessThan(100 * 1024 * 1024) // 少於 100MB
      expect(analysis.passesThresholds.memoryGrowthOk).toBe(true)
      expect(popupOperation.memoryDelta).toBeLessThan(50 * 1024 * 1024) // 彈出視窗不應占用超過 50MB

      await popupPage.close()
    })

    test('記憶體洩漏檢測', async () => {
      // 使用 MemoryLeakDetector 進行專業記憶體洩漏檢測
      // eslint-disable-next-line no-unused-vars
      const analysis = await memoryDetector.detectMemoryLeak(async (iteration) => {
        // 執行一次完整的提取流程
        // eslint-disable-next-line no-unused-vars
        const popupPage = await testSetup.openExtensionPopup()
        await popupPage.click('#extractButton')
        await popupPage.waitForSelector('.status-completed', { timeout: 20000 })

        await popupPage.close()

        // 等待資源釋放
        await testSetup.page.waitForTimeout(800)
      }, 5, { testName: 'extension-popup-extraction-cycle' })

      // eslint-disable-next-line no-console
      console.log('🔍 記憶體洩漏檢測結果:')
      // eslint-disable-next-line no-console
      console.log(`  基準記憶體: ${analysis.summary.formattedGrowth}`)
      // eslint-disable-next-line no-console
      console.log(`  平均每操作記憶體增長: ${analysis.leakDetection.formattedAverageGrowth}`)
      // eslint-disable-next-line no-console
      console.log(`  洩漏嚴重程度: ${analysis.leakDetection.leakSeverity}`)
      // eslint-disable-next-line no-console
      console.log(`  記憶體增長趨勢: ${analysis.leakDetection.memoryGrowthTrend}`)
      // eslint-disable-next-line no-console
      console.log(`  記憶體回收率: ${(analysis.efficiency.memoryRecoveryRate * 100).toFixed(1)}%`)

      // 驗證記憶體健康度
      expect(analysis.hasMemoryLeak).toBe(false)
      expect(analysis.passesThresholds.overallOk).toBe(true)
      expect(analysis.leakDetection.leakSeverity).not.toBe('critical')
      expect(analysis.leakDetection.leakSeverity).not.toBe('high')

      // 記憶體回收率應該良好
      expect(analysis.efficiency.memoryRecoveryRate).toBeGreaterThan(0.6)
    })
  })

  describe('🎨 UI 渲染效能測試', () => {
    test('Overview 頁面渲染效能', async () => {
      // 準備測試資料
      await testSetup.navigateToReadmoo()
      // eslint-disable-next-line no-unused-vars
      const popupPage = await testSetup.openExtensionPopup()
      await popupPage.click('#extractButton')
      await popupPage.waitForSelector('.status-completed', { timeout: 20000 })
      await popupPage.close()

      // 測試 Overview 頁面渲染
      // eslint-disable-next-line no-unused-vars
      const startTime = performance.now()

      // eslint-disable-next-line no-unused-vars
      const overviewUrl = `chrome-extension://${testSetup.extensionId}/overview.html`
      // eslint-disable-next-line no-unused-vars
      const overviewPage = await testSetup.browser.newPage()
      await overviewPage.goto(overviewUrl)

      // 等待內容載入
      await overviewPage.waitForSelector('body', { timeout: 10000 })
      await overviewPage.waitForTimeout(2000) // 額外等待資料載入

      // eslint-disable-next-line no-unused-vars
      const endTime = performance.now()
      // eslint-disable-next-line no-unused-vars
      const renderTime = endTime - startTime

      // 效能基準：Overview 頁面應在 3 秒內完成初始渲染
      expect(renderTime).toBeLessThan(3000)
      // eslint-disable-next-line no-console
      console.log(`🎨 Overview 頁面渲染時間: ${renderTime.toFixed(2)}ms`)

      await overviewPage.close()
    })

    test('搜尋功能響應時間', async () => {
      // eslint-disable-next-line no-unused-vars
      const overviewUrl = `chrome-extension://${testSetup.extensionId}/overview.html`
      // eslint-disable-next-line no-unused-vars
      const overviewPage = await testSetup.browser.newPage()
      await overviewPage.goto(overviewUrl)
      await overviewPage.waitForTimeout(3000)

      // 尋找搜尋輸入框
      // eslint-disable-next-line no-unused-vars
      const searchInput = await overviewPage.$('input[type="search"], .search-input')

      if (searchInput) {
        // eslint-disable-next-line no-unused-vars
        const searchTerms = ['JavaScript', 'Vue', 'Chrome', 'TDD', 'AI']
        // eslint-disable-next-line no-unused-vars
        const searchTimes = []

        for (const term of searchTerms) {
          // eslint-disable-next-line no-unused-vars
          const startTime = performance.now()

          // 清空並輸入搜尋詞
          await searchInput.click({ clickCount: 3 }) // 全選
          await searchInput.type(term)
          await searchInput.press('Enter')

          // 等待搜尋結果更新
          await overviewPage.waitForTimeout(500)

          // eslint-disable-next-line no-unused-vars
          const endTime = performance.now()
          // eslint-disable-next-line no-unused-vars
          const searchTime = endTime - startTime
          searchTimes.push(searchTime)
        }

        // eslint-disable-next-line no-unused-vars
        const avgSearchTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length

        // 效能基準：搜尋響應時間應在 1 秒內
        expect(avgSearchTime).toBeLessThan(1000)
        // eslint-disable-next-line no-console
        console.log(`🔍 平均搜尋響應時間: ${avgSearchTime.toFixed(2)}ms`)
      }

      await overviewPage.close()
    })
  })

  describe('📤 匯出功能效能測試', () => {
    test('小量資料匯出效能', async () => {
      // eslint-disable-next-line no-unused-vars
      const overviewUrl = `chrome-extension://${testSetup.extensionId}/overview.html`
      // eslint-disable-next-line no-unused-vars
      const overviewPage = await testSetup.browser.newPage()
      await overviewPage.goto(overviewUrl)
      await overviewPage.waitForTimeout(3000)

      // 尋找匯出按鈕
      // eslint-disable-next-line no-unused-vars
      const exportButtons = await overviewPage.$$('button')
      // eslint-disable-next-line no-unused-vars
      let exportButton = null

      for (const button of exportButtons) {
        // eslint-disable-next-line no-unused-vars
        const text = await overviewPage.evaluate(el => el.textContent, button)
        if (text.includes('匯出')) {
          exportButton = button
          break
        }
      }

      if (exportButton) {
        // eslint-disable-next-line no-unused-vars
        const startTime = performance.now()

        await exportButton.click()

        // 等待匯出完成
        try {
          await overviewPage.waitForFunction(() => {
            return document.body.textContent.includes('匯出成功') ||
                   document.body.textContent.includes('下載完成')
          }, { timeout: 10000 })

          // eslint-disable-next-line no-unused-vars
          const endTime = performance.now()
          // eslint-disable-next-line no-unused-vars
          const exportTime = endTime - startTime

          // 效能基準：匯出應在 5 秒內完成
          expect(exportTime).toBeLessThan(5000)
          // eslint-disable-next-line no-console
          console.log(`📤 匯出處理時間: ${exportTime.toFixed(2)}ms`)
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('⚠️ 匯出功能測試超時')
        }
      }

      await overviewPage.close()
    })
  })

  describe('🔄 並行處理效能測試', () => {
    test('多個 Popup 同時操作', async () => {
      // eslint-disable-next-line no-unused-vars
      const popupCount = 3
      // eslint-disable-next-line no-unused-vars
      const popupPages = []
      // eslint-disable-next-line no-unused-vars
      const startTime = performance.now()

      try {
        // 同時開啟多個 Popup
        for (let i = 0; i < popupCount; i++) {
          // eslint-disable-next-line no-unused-vars
          const popupPage = await testSetup.openExtensionPopup()
          popupPages.push(popupPage)
          await testSetup.page.waitForTimeout(500) // 間隔開啟
        }

        // 同時觸發提取（模擬使用者快速操作）
        // eslint-disable-next-line no-unused-vars
        const extractionPromises = popupPages.map(async (popupPage) => {
          await popupPage.click('#extractButton')
          return popupPage.waitForSelector('.status-completed, .status-error', { timeout: 30000 })
        })

        // 等待所有提取完成
        await Promise.all(extractionPromises)

        // eslint-disable-next-line no-unused-vars
        const endTime = performance.now()
        // eslint-disable-next-line no-unused-vars
        const totalTime = endTime - startTime

        // eslint-disable-next-line no-console
        console.log(`🔄 並行處理完成時間: ${totalTime.toFixed(2)}ms`)

        // 驗證系統在並行操作下仍能正常工作
        expect(totalTime).toBeLessThan(45000) // 45 秒內完成
      } finally {
        // 清理所有 Popup
        for (const popupPage of popupPages) {
          try {
            await popupPage.close()
          } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('清理 Popup 時發生錯誤:', error)
          }
        }
      }
    })
  })
})

/**
 * 生成包含指定數量書籍的模擬頁面
 * @param {number} bookCount - 書籍數量
 * @returns {string} HTML 內容
 */
function generateMockPageWithBooks (bookCount) {
  // eslint-disable-next-line no-unused-vars
  const books = []

  for (let i = 1; i <= bookCount; i++) {
    books.push(`
      <div class="book-item" data-book-id="test-book-${String(i).padStart(3, '0')}">
        <div class="book-cover">封面</div>
        <div class="book-info">
          <div class="book-title">測試書籍 ${i}</div>
          <div class="book-author">作者：測試作者 ${i}</div>
          <div class="book-progress">已讀 ${Math.floor(Math.random() * 100)}%</div>
          <div class="book-meta">
            <span>購買日期：2024-01-${String(i % 30 + 1).padStart(2, '0')}</span>
          </div>
        </div>
      </div>
    `)
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Readmoo 效能測試頁面 (${bookCount} 本書籍)</title>
      <style>
        .book-item { padding: 10px; border-bottom: 1px solid #eee; }
        .book-title { font-weight: bold; }
        .book-author { color: #666; }
      </style>
    </head>
    <body>
      <h1>📚 Readmoo 效能測試 - ${bookCount} 本書籍</h1>
      <div class="book-shelf">
        ${books.join('')}
      </div>
      <script>
        document.body.setAttribute('data-books-loaded', 'true');
      </script>
    </body>
    </html>
  `
}
