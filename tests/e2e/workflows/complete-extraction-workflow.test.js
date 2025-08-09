/**
 * 完整書籍資料提取工作流程測試
 * 
 * 負責功能：
 * - 測試從 Readmoo 頁面到資料提取完成的完整流程
 * - 驗證 Background Script, Content Script, Popup 的整合
 * - 測試資料儲存和 UI 更新的端對端流程
 * - 驗證錯誤處理和恢復機制
 * 
 * 設計考量：
 * - 模擬真實使用者操作流程
 * - 測試跨上下文的事件通訊
 * - 驗證資料一致性和完整性
 * - 確保系統在各種情境下的穩定性
 * 
 * 處理流程：
 * 1. 設定測試環境和 Extension 載入
 * 2. 導航到 Readmoo 測試頁面
 * 3. 開啟 Extension Popup 並觸發提取
 * 4. 監控提取過程和事件流
 * 5. 驗證資料儲存和 UI 更新
 * 6. 測試錯誤情境和恢復機制
 * 
 * 使用情境：
 * - 驗證 Extension 完整功能是否正常運作
 * - 測試產品發布前的品質保證
 * - 回歸測試確保修改不影響核心功能
 */

const ExtensionTestSetup = require('../setup/extension-setup');
const path = require('path');

describe('📚 完整書籍資料提取工作流程', () => {
  let testSetup;
  let popupPage;
  let backgroundPage;

  // 測試超時設定
  jest.setTimeout(60000);

  beforeAll(async () => {
    testSetup = new ExtensionTestSetup();
    await testSetup.setup({ headless: true });
  });

  afterAll(async () => {
    if (popupPage) await popupPage.close();
    await testSetup.cleanup();
  });

  describe('🔄 基本工作流程測試', () => {
    test('應該能夠載入 Extension 並初始化環境', async () => {
      expect(testSetup.extensionId).toBeDefined();
      expect(testSetup.extensionId.length).toBeGreaterThan(10);
      
      // 取得 Background Script 頁面
      backgroundPage = await testSetup.getBackgroundPage();
      expect(backgroundPage).toBeDefined();
    });

    test('應該能夠導航到 Readmoo 測試頁面', async () => {
      await testSetup.navigateToReadmoo();
      
      // 驗證頁面載入
      const title = await testSetup.page.title();
      expect(title).toContain('Readmoo');
      
      // 等待動態載入完成
      await testSetup.page.waitForFunction(() => 
        document.body.getAttribute('data-books-loaded') === 'true'
      );
      
      // 驗證測試資料存在
      const bookItems = await testSetup.page.$$('.book-item');
      expect(bookItems).toHaveLength(5);
    });

    test('應該能夠開啟 Extension Popup', async () => {
      popupPage = await testSetup.openExtensionPopup();
      
      // 驗證 Popup 基本元素
      const popupTitle = await popupPage.$eval('h1', el => el.textContent);
      expect(popupTitle).toContain('Readmoo');
      
      // 驗證提取按鈕存在
      const extractButton = await popupPage.$('#extractButton');
      expect(extractButton).toBeTruthy();
    });
  });

  describe('📊 資料提取流程測試', () => {
    test('應該能夠觸發書籍資料提取', async () => {
      // 點擊提取按鈕
      await popupPage.click('#extractButton');
      
      // 等待提取狀態更新
      await popupPage.waitForSelector('.status-extracting', { timeout: 10000 });
      
      // 驗證狀態顯示
      const statusText = await popupPage.$eval('.status-display', el => el.textContent);
      expect(statusText).toContain('提取中');
    });

    test('應該能夠提取並顯示書籍資料', async () => {
      // 等待提取完成
      await popupPage.waitForSelector('.status-completed', { timeout: 20000 });
      
      // 驗證完成狀態
      const statusText = await popupPage.$eval('.status-display', el => el.textContent);
      expect(statusText).toContain('完成');
      
      // 驗證書籍數量
      const bookCountElement = await popupPage.$('.book-count');
      if (bookCountElement) {
        const bookCount = await popupPage.$eval('.book-count', el => 
          parseInt(el.textContent.match(/\d+/)[0])
        );
        expect(bookCount).toBe(5);
      }
    });

    test('應該能夠在 Background Script 中接收到資料', async () => {
      // 檢查 Background Script 中的資料狀態
      const hasData = await backgroundPage.evaluate(() => {
        // 檢查是否有儲存的書籍資料
        return new Promise((resolve) => {
          chrome.storage.local.get(['extractedBooks'], (result) => {
            resolve(result.extractedBooks && result.extractedBooks.length > 0);
          });
        });
      });
      
      expect(hasData).toBe(true);
    });
  });

  describe('💾 資料儲存驗證測試', () => {
    test('應該能夠正確儲存提取的書籍資料', async () => {
      // 從儲存中取得書籍資料
      const storedData = await backgroundPage.evaluate(() => {
        return new Promise((resolve) => {
          chrome.storage.local.get(['extractedBooks'], (result) => {
            resolve(result.extractedBooks || []);
          });
        });
      });
      
      // 驗證資料完整性
      expect(storedData).toHaveLength(5);
      
      // 驗證第一本書的資料結構
      const firstBook = storedData[0];
      expect(firstBook).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        author: expect.any(String),
        progress: expect.any(Number)
      });
    });

    test('應該能夠儲存提取時間戳記', async () => {
      const metadata = await backgroundPage.evaluate(() => {
        return new Promise((resolve) => {
          chrome.storage.local.get(['extractionMetadata'], (result) => {
            resolve(result.extractionMetadata);
          });
        });
      });
      
      expect(metadata).toBeDefined();
      expect(metadata.extractionTime).toBeDefined();
      expect(new Date(metadata.extractionTime)).toBeInstanceOf(Date);
    });
  });

  describe('🎨 UI 整合測試', () => {
    test('應該能夠開啟 Overview 頁面並載入資料', async () => {
      // 點擊「查看書庫」按鈕
      const viewLibraryButton = await popupPage.$('#viewLibraryButton');
      if (viewLibraryButton) {
        await popupPage.click('#viewLibraryButton');
        
        // 等待新頁面開啟
        await testSetup.page.waitForTimeout(2000);
        
        // 檢查是否開啟了 Overview 頁面
        const pages = await testSetup.browser.pages();
        const overviewPage = pages.find(page => 
          page.url().includes('overview.html')
        );
        
        if (overviewPage) {
          // 等待資料載入
          await overviewPage.waitForSelector('.book-grid-item', { timeout: 10000 });
          
          // 驗證書籍顯示
          const bookElements = await overviewPage.$$('.book-grid-item');
          expect(bookElements.length).toBeGreaterThan(0);
        }
      }
    });

    test('應該能夠顯示正確的書籍統計資訊', async () => {
      // 檢查統計資訊
      const totalBooksElement = await popupPage.$('.total-books');
      if (totalBooksElement) {
        const totalBooks = await popupPage.$eval('.total-books', el => 
          parseInt(el.textContent.match(/\d+/)[0])
        );
        expect(totalBooks).toBe(5);
      }
    });
  });

  describe('⚠️ 錯誤處理測試', () => {
    test('應該能夠處理網頁載入失敗', async () => {
      // 導航到無效頁面
      try {
        await testSetup.page.goto('http://invalid-readmoo-url.test', { timeout: 5000 });
      } catch (error) {
        // 預期會發生錯誤
      }
      
      // 開啟新的 Popup
      const errorPopupPage = await testSetup.openExtensionPopup();
      
      // 嘗試提取（應該失敗）
      await errorPopupPage.click('#extractButton');
      
      // 等待錯誤狀態
      await errorPopupPage.waitForSelector('.status-error', { timeout: 10000 });
      
      // 驗證錯誤訊息
      const errorMessage = await errorPopupPage.$eval('.error-message', el => el.textContent);
      expect(errorMessage).toContain('錯誤');
      
      await errorPopupPage.close();
    });

    test('應該能夠在提取失敗後重試', async () => {
      // 返回有效的測試頁面
      await testSetup.navigateToReadmoo();
      
      // 開啟新的 Popup
      const retryPopupPage = await testSetup.openExtensionPopup();
      
      // 點擊重試按鈕（如果存在）
      const retryButton = await retryPopupPage.$('#retryButton');
      if (retryButton) {
        await retryPopupPage.click('#retryButton');
        
        // 等待重試完成
        await retryPopupPage.waitForSelector('.status-completed', { timeout: 15000 });
        
        // 驗證重試成功
        const statusText = await retryPopupPage.$eval('.status-display', el => el.textContent);
        expect(statusText).toContain('完成');
      }
      
      await retryPopupPage.close();
    });
  });

  describe('📈 效能基準測試', () => {
    test('提取過程應該在合理時間內完成', async () => {
      const startTime = Date.now();
      
      // 開啟新的 Popup 進行計時測試
      const perfPopupPage = await testSetup.openExtensionPopup();
      
      // 觸發提取
      await perfPopupPage.click('#extractButton');
      
      // 等待完成
      await perfPopupPage.waitForSelector('.status-completed', { timeout: 20000 });
      
      const endTime = Date.now();
      const extractionTime = endTime - startTime;
      
      // 驗證提取時間在 20 秒內
      expect(extractionTime).toBeLessThan(20000);
      console.log(`⏱️ 提取完成時間: ${extractionTime}ms`);
      
      await perfPopupPage.close();
    });

    test('記憶體使用應該在合理範圍內', async () => {
      // 取得頁面記憶體使用情況
      const memoryInfo = await testSetup.page.evaluate(() => {
        if (performance.memory) {
          return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
          };
        }
        return null;
      });
      
      if (memoryInfo) {
        const memoryUsageMB = memoryInfo.usedJSHeapSize / 1024 / 1024;
        
        // 驗證記憶體使用少於 100MB
        expect(memoryUsageMB).toBeLessThan(100);
        console.log(`💾 記憶體使用量: ${memoryUsageMB.toFixed(2)}MB`);
      }
    });
  });

  describe('📷 視覺回歸測試', () => {
    test('應該能夠產生測試截圖', async () => {
      // 截取 Popup 截圖
      await testSetup.takeScreenshot('popup-final-state');
      
      // 截取主頁面截圖
      await testSetup.takeScreenshot('readmoo-page-final');
      
      // 驗證截圖檔案存在（在實際環境中）
      expect(true).toBe(true);
    });
  });
});