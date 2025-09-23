/* eslint-disable no-console */

/**
 * 端對端測試環境驗證
 *
 * 負責功能：
 * - 驗證測試環境設定是否正確
 * - 檢查 Extension 載入是否成功
 * - 測試基本的瀏覽器自動化功能
 * - 確認測試相依套件正常運作
 *
 * 設計考量：
 * - 快速驗證測試環境完整性
 * - 提供清晰的錯誤資訊以協助除錯
 * - 最小化測試執行時間
 * - 驗證關鍵測試工具的可用性
 *
 * 處理流程：
 * 1. 檢查測試環境基本設定
 * 2. 驗證 Puppeteer 和 Chrome 整合
 * 3. 測試 Extension 載入功能
 * 4. 驗證模擬頁面的載入
 * 5. 檢查測試工具的基本功能
 *
 * 使用情境：
 * - 新環境的端對端測試設定驗證
 * - 測試環境故障排除
 * - CI/CD 環境的預檢查
 */

// eslint-disable-next-line no-unused-vars
const ExtensionTestSetup = require('../setup/extension-setup')

describe('🔧 端對端測試環境驗證', () => {
  // eslint-disable-next-line no-unused-vars
  let testSetup

  // 較短的超時時間，快速驗證
  jest.setTimeout(30000)

  describe('🚀 基本環境檢查', () => {
    test('應該能夠建立測試設定實例', () => {
      testSetup = new ExtensionTestSetup()
      expect(testSetup).toBeInstanceOf(ExtensionTestSetup)
      expect(testSetup.browser).toBeNull()
      expect(testSetup.page).toBeNull()
      expect(testSetup.extensionId).toBeNull()
    })

    test('應該能夠初始化測試環境', async () => {
      await testSetup.setup({ headless: true })

      // 驗證基本屬性已設定
      expect(testSetup.browser).toBeTruthy()
      expect(testSetup.page).toBeTruthy()
      expect(testSetup.extensionId).toBeTruthy()
      expect(testSetup.extensionId.length).toBeGreaterThan(10)

      // eslint-disable-next-line no-console
      console.log(`✅ Extension 載入成功，ID: ${testSetup.extensionId}`)
    })

    test('應該能夠取得 Background Script 頁面', async () => {
      // eslint-disable-next-line no-unused-vars
      const backgroundPage = await testSetup.getBackgroundPage()
      expect(backgroundPage).toBeTruthy()

      // 測試 Background Script 基本功能
      // eslint-disable-next-line no-unused-vars
      const backgroundUrl = backgroundPage.url()
      expect(backgroundUrl).toContain(testSetup.extensionId)

      // eslint-disable-next-line no-console
      console.log('✅ Background Script 頁面連接成功')
    })
  })

  describe('📄 模擬頁面測試', () => {
    test('應該能夠載入模擬的 Readmoo 頁面', async () => {
      await testSetup.navigateToReadmoo()

      // 驗證頁面標題
      // eslint-disable-next-line no-unused-vars
      const title = await testSetup.page.title()
      expect(title).toContain('Readmoo')

      // 驗證頁面內容
      // eslint-disable-next-line no-unused-vars
      const bookItems = await testSetup.page.$$('.book-item')
      expect(bookItems.length).toBeGreaterThan(0)

      // eslint-disable-next-line no-console
      console.log(`✅ 模擬頁面載入成功，找到 ${bookItems.length} 本書籍`)
    })

    test('應該能夠等待動態內容載入', async () => {
      // 等待動態載入完成
      await testSetup.page.waitForFunction(() =>
        document.body.getAttribute('data-books-loaded') === 'true'
      )

      // eslint-disable-next-line no-unused-vars
      const isLoaded = await testSetup.page.$eval('body',
        el => el.getAttribute('data-books-loaded')
      )
      expect(isLoaded).toBe('true')

      // eslint-disable-next-line no-console
      console.log('✅ 動態內容載入驗證通過')
    })

    test('應該能夠提取測試資料', async () => {
      // eslint-disable-next-line no-unused-vars
      const testData = await testSetup.page.evaluate(() => {
        return window.getTestBookData ? window.getTestBookData() : null
      })

      expect(testData).toBeTruthy()
      expect(testData.books).toBeInstanceOf(Array)
      expect(testData.books.length).toBe(5)
    })
  })

  describe('🎨 Extension UI 測試', () => {
    test('應該能夠開啟 Extension Popup', async () => {
      // eslint-disable-next-line no-unused-vars
      const popupPage = await testSetup.openExtensionPopup()
      expect(popupPage).toBeTruthy()

      // 驗證 Popup URL
      // eslint-disable-next-line no-unused-vars
      const popupUrl = popupPage.url()
      expect(popupUrl).toContain(testSetup.extensionId)
      expect(popupUrl).toContain('popup.html')

      // 驗證基本元素存在
      await popupPage.waitForSelector('body', { timeout: 5000 })
      // eslint-disable-next-line no-unused-vars
      const bodyContent = await popupPage.$eval('body', el => el.textContent)
      expect(bodyContent.length).toBeGreaterThan(0)

      // eslint-disable-next-line no-console
      console.log('✅ Extension Popup 開啟成功')

      await popupPage.close()
    })

    test('應該能夠執行基本的頁面互動', async () => {
      // eslint-disable-next-line no-unused-vars
      const popupPage = await testSetup.openExtensionPopup()

      // 尋找按鈕或可互動元素
      // eslint-disable-next-line no-unused-vars
      const buttons = await popupPage.$$('button, .button, input[type="button"]')
      expect(buttons.length).toBeGreaterThan(0)

      // eslint-disable-next-line no-console
      console.log(`✅ 找到 ${buttons.length} 個可互動元素`)

      await popupPage.close()
    })
  })

  describe('🔍 測試工具驗證', () => {
    test('應該能夠執行 JavaScript 程式碼', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await testSetup.page.evaluate(() => {
        return {
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
          location: window.location.href
        }
      })

      expect(result).toBeTruthy()
      expect(result.userAgent).toContain('Chrome')
      expect(result.timestamp).toBeGreaterThan(0)

      // eslint-disable-next-line no-console
      console.log('✅ JavaScript 執行功能驗證通過')
    })

    test('應該能夠等待元素出現', async () => {
      // eslint-disable-next-line no-unused-vars
      const element = await testSetup.waitForElement('.book-item', 5000)
      expect(element).toBeTruthy()

      // eslint-disable-next-line no-console
      console.log('✅ 元素等待功能驗證通過')
    })

    test('應該能夠產生測試截圖', async () => {
      await testSetup.takeScreenshot('validation-test')

      // 截圖功能主要是為了除錯，不檢查檔案存在
      // eslint-disable-next-line no-console
      console.log('✅ 截圖功能執行完成')
    })
  })

  describe('💾 儲存功能驗證', () => {
    test('應該能夠訪問 Chrome Storage API', async () => {
      // eslint-disable-next-line no-unused-vars
      const backgroundPage = await testSetup.getBackgroundPage()

      // 測試儲存 API 可用性
      // eslint-disable-next-line no-unused-vars
      const storageTest = await backgroundPage.evaluate(() => {
        return new Promise((resolve) => {
          try {
            chrome.storage.local.set({ test: 'validation' }, () => {
              chrome.storage.local.get(['test'], (result) => {
                resolve(result.test === 'validation')
              })
            })
          } catch (error) {
            resolve(false)
          }
        })
      })

      expect(storageTest).toBe(true)

      // eslint-disable-next-line no-console
      console.log('✅ Chrome Storage API 功能驗證通過')
    })
  })

  describe('⚡ 效能驗證', () => {
    test('測試環境啟動時間應該合理', async () => {
      // 測量新實例的啟動時間
      // eslint-disable-next-line no-unused-vars
      const newTestSetup = new ExtensionTestSetup()
      // eslint-disable-next-line no-unused-vars
      const startTime = performance.now()

      await newTestSetup.setup({ headless: true })

      // eslint-disable-next-line no-unused-vars
      const endTime = performance.now()
      // eslint-disable-next-line no-unused-vars
      const setupTime = endTime - startTime

      // 測試環境應在 15 秒內完成設定
      expect(setupTime).toBeLessThan(15000)

      await newTestSetup.cleanup()
    })

    test('記憶體使用應該在合理範圍內', async () => {
      // eslint-disable-next-line no-unused-vars
      const memoryInfo = await testSetup.page.evaluate(() => {
        if (performance.memory) {
          return {
            used: performance.memory.usedJSHeapSize / 1024 / 1024,
            total: performance.memory.totalJSHeapSize / 1024 / 1024
          }
        }
        return null
      })

      if (memoryInfo) {
        expect(memoryInfo.used).toBeLessThan(100) // 少於 100MB
        // eslint-disable-next-line no-console
        console.log(`💾 記憶體使用: ${memoryInfo.used.toFixed(2)}MB / ${memoryInfo.total.toFixed(2)}MB`)
      }
    })
  })

  afterAll(async () => {
    if (testSetup) {
      await testSetup.cleanup()
    }
  })
})
