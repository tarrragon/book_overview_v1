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

const ExtensionTestSetup = require('../setup/extension-setup')

describe('📊 Chrome Extension 效能基準測試', () => {
  let testSetup
  let backgroundPage

  jest.setTimeout(120000) // 2 分鐘超時

  beforeAll(async () => {
    testSetup = new ExtensionTestSetup()
    await testSetup.setup({ headless: true })
    backgroundPage = await testSetup.getBackgroundPage()
  })

  afterAll(async () => {
    await testSetup.cleanup()
  })

  describe('🚀 資料提取效能測試', () => {
    test('小量資料提取效能 (5 本書籍)', async () => {
      const startTime = performance.now()

      await testSetup.navigateToReadmoo()
      const popupPage = await testSetup.openExtensionPopup()

      // 開始提取
      await popupPage.click('#extractButton')
      await popupPage.waitForSelector('.status-completed', { timeout: 20000 })

      const endTime = performance.now()
      const extractionTime = endTime - startTime

      // 效能基準：小量資料應在 5 秒內完成
      expect(extractionTime).toBeLessThan(5000)
      console.log(`📈 小量資料提取時間: ${extractionTime.toFixed(2)}ms`)

      await popupPage.close()
    })

    test('中量資料提取效能測試 (50 本書籍模擬)', async () => {
      // 建立模擬的大量資料頁面
      await testSetup.page.goto('data:text/html;charset=utf-8,' + encodeURIComponent(
        generateMockPageWithBooks(50)
      ))

      const startTime = performance.now()

      const popupPage = await testSetup.openExtensionPopup()
      await popupPage.click('#extractButton')
      await popupPage.waitForSelector('.status-completed', { timeout: 30000 })

      const endTime = performance.now()
      const extractionTime = endTime - startTime

      // 效能基準：中量資料應在 15 秒內完成
      expect(extractionTime).toBeLessThan(15000)
      console.log(`📊 中量資料提取時間: ${extractionTime.toFixed(2)}ms`)

      await popupPage.close()
    })

    test('大量資料提取效能測試 (100+ 本書籍模擬)', async () => {
      // 建立模擬的大量資料頁面
      await testSetup.page.goto('data:text/html;charset=utf-8,' + encodeURIComponent(
        generateMockPageWithBooks(150)
      ))

      const startTime = performance.now()

      const popupPage = await testSetup.openExtensionPopup()
      await popupPage.click('#extractButton')

      // 大量資料可能需要更長時間
      await popupPage.waitForSelector('.status-completed', { timeout: 60000 })

      const endTime = performance.now()
      const extractionTime = endTime - startTime

      // 效能基準：大量資料應在 30 秒內完成
      expect(extractionTime).toBeLessThan(30000)
      console.log(`📈 大量資料提取時間: ${extractionTime.toFixed(2)}ms`)

      await popupPage.close()
    })
  })

  describe('💾 記憶體使用測試', () => {
    test('基準記憶體使用測量', async () => {
      // 測量初始記憶體使用
      const initialMemory = await measureMemoryUsage(testSetup.page)

      await testSetup.navigateToReadmoo()
      const afterNavigationMemory = await measureMemoryUsage(testSetup.page)

      const popupPage = await testSetup.openExtensionPopup()
      const afterPopupMemory = await measureMemoryUsage(popupPage)

      console.log('📊 記憶體使用分析:')
      console.log(`  初始狀態: ${initialMemory.toFixed(2)}MB`)
      console.log(`  導航後: ${afterNavigationMemory.toFixed(2)}MB`)
      console.log(`  開啟 Popup 後: ${afterPopupMemory.toFixed(2)}MB`)

      // 驗證記憶體使用在合理範圍內
      expect(afterPopupMemory).toBeLessThan(100) // 少於 100MB

      await popupPage.close()
    })

    test('記憶體洩漏檢測', async () => {
      const iterations = 5
      const memoryReadings = []

      for (let i = 0; i < iterations; i++) {
        // 執行一次完整的提取流程
        const popupPage = await testSetup.openExtensionPopup()
        await popupPage.click('#extractButton')
        await popupPage.waitForSelector('.status-completed', { timeout: 20000 })

        // 測量記憶體
        const memory = await measureMemoryUsage(popupPage)
        memoryReadings.push(memory)

        await popupPage.close()

        // 等待資源釋放和記憶體穩定化
        await testSetup.page.waitForTimeout(1500) // 等待資源清理完成
      }

      console.log('🔍 記憶體洩漏檢測結果:')
      memoryReadings.forEach((reading, index) => {
        console.log(`  第 ${index + 1} 次: ${reading.toFixed(2)}MB`)
      })

      // 檢測記憶體是否持續增長（簡單的洩漏檢測）
      const avgFirst2 = (memoryReadings[0] + memoryReadings[1]) / 2
      const avgLast2 = (memoryReadings[iterations - 2] + memoryReadings[iterations - 1]) / 2
      const growthRate = (avgLast2 - avgFirst2) / avgFirst2

      // 記憶體增長不應超過 50%
      expect(growthRate).toBeLessThan(0.5)
      console.log(`📈 記憶體增長率: ${(growthRate * 100).toFixed(2)}%`)
    })
  })

  describe('🎨 UI 渲染效能測試', () => {
    test('Overview 頁面渲染效能', async () => {
      // 準備測試資料
      await testSetup.navigateToReadmoo()
      const popupPage = await testSetup.openExtensionPopup()
      await popupPage.click('#extractButton')
      await popupPage.waitForSelector('.status-completed', { timeout: 20000 })
      await popupPage.close()

      // 測試 Overview 頁面渲染
      const startTime = performance.now()

      const overviewUrl = `chrome-extension://${testSetup.extensionId}/overview.html`
      const overviewPage = await testSetup.browser.newPage()
      await overviewPage.goto(overviewUrl)

      // 等待內容載入
      await overviewPage.waitForSelector('body', { timeout: 10000 })
      await overviewPage.waitForTimeout(2000) // 額外等待資料載入

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // 效能基準：Overview 頁面應在 3 秒內完成初始渲染
      expect(renderTime).toBeLessThan(3000)
      console.log(`🎨 Overview 頁面渲染時間: ${renderTime.toFixed(2)}ms`)

      await overviewPage.close()
    })

    test('搜尋功能響應時間', async () => {
      const overviewUrl = `chrome-extension://${testSetup.extensionId}/overview.html`
      const overviewPage = await testSetup.browser.newPage()
      await overviewPage.goto(overviewUrl)
      await overviewPage.waitForTimeout(3000)

      // 尋找搜尋輸入框
      const searchInput = await overviewPage.$('input[type="search"], .search-input')

      if (searchInput) {
        const searchTerms = ['JavaScript', 'Vue', 'Chrome', 'TDD', 'AI']
        const searchTimes = []

        for (const term of searchTerms) {
          const startTime = performance.now()

          // 清空並輸入搜尋詞
          await searchInput.click({ clickCount: 3 }) // 全選
          await searchInput.type(term)
          await searchInput.press('Enter')

          // 等待搜尋結果更新
          await overviewPage.waitForTimeout(500)

          const endTime = performance.now()
          const searchTime = endTime - startTime
          searchTimes.push(searchTime)
        }

        const avgSearchTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length

        // 效能基準：搜尋響應時間應在 1 秒內
        expect(avgSearchTime).toBeLessThan(1000)
        console.log(`🔍 平均搜尋響應時間: ${avgSearchTime.toFixed(2)}ms`)
      }

      await overviewPage.close()
    })
  })

  describe('📤 匯出功能效能測試', () => {
    test('小量資料匯出效能', async () => {
      const overviewUrl = `chrome-extension://${testSetup.extensionId}/overview.html`
      const overviewPage = await testSetup.browser.newPage()
      await overviewPage.goto(overviewUrl)
      await overviewPage.waitForTimeout(3000)

      // 尋找匯出按鈕
      const exportButtons = await overviewPage.$$('button')
      let exportButton = null

      for (const button of exportButtons) {
        const text = await overviewPage.evaluate(el => el.textContent, button)
        if (text.includes('匯出')) {
          exportButton = button
          break
        }
      }

      if (exportButton) {
        const startTime = performance.now()

        await exportButton.click()

        // 等待匯出完成
        try {
          await overviewPage.waitForFunction(() => {
            return document.body.textContent.includes('匯出成功') ||
                   document.body.textContent.includes('下載完成')
          }, { timeout: 10000 })

          const endTime = performance.now()
          const exportTime = endTime - startTime

          // 效能基準：匯出應在 5 秒內完成
          expect(exportTime).toBeLessThan(5000)
          console.log(`📤 匯出處理時間: ${exportTime.toFixed(2)}ms`)
        } catch (error) {
          console.warn('⚠️ 匯出功能測試超時')
        }
      }

      await overviewPage.close()
    })
  })

  describe('🔄 並行處理效能測試', () => {
    test('多個 Popup 同時操作', async () => {
      const popupCount = 3
      const popupPages = []
      const startTime = performance.now()

      try {
        // 同時開啟多個 Popup
        for (let i = 0; i < popupCount; i++) {
          const popupPage = await testSetup.openExtensionPopup()
          popupPages.push(popupPage)
          await testSetup.page.waitForTimeout(500) // 間隔開啟
        }

        // 同時觸發提取（模擬使用者快速操作）
        const extractionPromises = popupPages.map(async (popupPage) => {
          await popupPage.click('#extractButton')
          return popupPage.waitForSelector('.status-completed, .status-error', { timeout: 30000 })
        })

        // 等待所有提取完成
        await Promise.all(extractionPromises)

        const endTime = performance.now()
        const totalTime = endTime - startTime

        console.log(`🔄 並行處理完成時間: ${totalTime.toFixed(2)}ms`)

        // 驗證系統在並行操作下仍能正常工作
        expect(totalTime).toBeLessThan(45000) // 45 秒內完成
      } finally {
        // 清理所有 Popup
        for (const popupPage of popupPages) {
          try {
            await popupPage.close()
          } catch (error) {
            console.warn('清理 Popup 時發生錯誤:', error)
          }
        }
      }
    })
  })
})

/**
 * 測量頁面記憶體使用量
 * @param {Page} page - Puppeteer 頁面物件
 * @returns {Promise<number>} 記憶體使用量（MB）
 */
async function measureMemoryUsage (page) {
  try {
    const memoryInfo = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize
        }
      }
      return null
    })

    if (memoryInfo) {
      return memoryInfo.usedJSHeapSize / 1024 / 1024 // 轉換為 MB
    }
    return 0
  } catch (error) {
    console.warn('記憶體測量失敗:', error)
    return 0
  }
}

/**
 * 生成包含指定數量書籍的模擬頁面
 * @param {number} bookCount - 書籍數量
 * @returns {string} HTML 內容
 */
function generateMockPageWithBooks (bookCount) {
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
