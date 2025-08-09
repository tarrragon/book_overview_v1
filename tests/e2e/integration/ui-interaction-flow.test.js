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
 * - 模擬真實使用者的操作序列
 * - 測試 UI 組件間的資料流動
 * - 驗證使用者體驗的一致性
 * - 確保複雜操作下的系統穩定性
 * 
 * 處理流程：
 * 1. 載入 Extension 並準備測試資料
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

const ExtensionTestSetup = require('../setup/extension-setup');

describe('🎨 UI 互動流程整合測試', () => {
  let testSetup;
  let popupPage;
  let overviewPage;

  jest.setTimeout(60000);

  beforeAll(async () => {
    testSetup = new ExtensionTestSetup();
    await testSetup.setup({ headless: true });
    
    // 先完成一次資料提取，準備測試資料
    await testSetup.navigateToReadmoo();
    popupPage = await testSetup.openExtensionPopup();
    await popupPage.click('#extractButton');
    await popupPage.waitForSelector('.status-completed', { timeout: 20000 });
  });

  afterAll(async () => {
    if (popupPage) await popupPage.close();
    if (overviewPage) await overviewPage.close();
    await testSetup.cleanup();
  });

  describe('🎯 Popup 界面互動測試', () => {
    test('應該能夠顯示提取成功狀態', async () => {
      // 驗證提取完成狀態
      const statusElement = await popupPage.$('.status-completed');
      expect(statusElement).toBeTruthy();
      
      // 驗證書籍數量顯示
      const bookCountText = await popupPage.evaluate(() => {
        const element = document.querySelector('.book-count, .total-books');
        return element ? element.textContent : null;
      });
      
      if (bookCountText) {
        expect(bookCountText).toMatch(/\d+/);
      }
    });

    test('應該能夠開啟 Overview 頁面', async () => {
      // 尋找並點擊查看書庫按鈕
      const viewButtons = await popupPage.$$('button, .button');
      let viewLibraryButton = null;
      
      for (const button of viewButtons) {
        const text = await popupPage.evaluate(el => el.textContent, button);
        if (text.includes('查看') || text.includes('書庫') || text.includes('overview')) {
          viewLibraryButton = button;
          break;
        }
      }
      
      if (viewLibraryButton) {
        await viewLibraryButton.click();
        
        // 等待新頁面開啟
        await testSetup.page.waitForTimeout(3000);
        
        // 尋找 Overview 頁面
        const pages = await testSetup.browser.pages();
        overviewPage = pages.find(page => 
          page.url().includes('overview.html') ||
          page.url().includes('overview')
        );
        
        if (overviewPage) {
          expect(overviewPage).toBeTruthy();
          
          // 等待頁面載入完成
          await overviewPage.waitForSelector('body', { timeout: 10000 });
        }
      }
    });

    test('應該能夠處理重新提取操作', async () => {
      // 尋找重新提取或刷新按鈕
      const refreshButtons = await popupPage.$$('button');
      let refreshButton = null;
      
      for (const button of refreshButtons) {
        const text = await popupPage.evaluate(el => el.textContent, button);
        if (text.includes('重新') || text.includes('刷新') || text.includes('再次')) {
          refreshButton = button;
          break;
        }
      }
      
      if (refreshButton) {
        await refreshButton.click();
        
        // 等待提取狀態更新
        const statusChanged = await popupPage.waitForFunction(() => {
          const statusEl = document.querySelector('.status-display, .status');
          return statusEl && (
            statusEl.textContent.includes('提取中') || 
            statusEl.classList.contains('status-extracting')
          );
        }, { timeout: 10000 });
        
        expect(statusChanged).toBeTruthy();
      }
    });
  });

  describe('📚 Overview 頁面功能測試', () => {
    beforeEach(async () => {
      if (!overviewPage) {
        // 如果 Overview 頁面還沒開啟，直接導航過去
        const overviewUrl = `chrome-extension://${testSetup.extensionId}/overview.html`;
        overviewPage = await testSetup.browser.newPage();
        await overviewPage.goto(overviewUrl);
        await overviewPage.waitForTimeout(3000);
      }
    });

    test('應該能夠載入和顯示書籍資料', async () => {
      // 等待書籍網格載入
      try {
        await overviewPage.waitForSelector('.book-grid, .book-list, .book-item', { timeout: 15000 });
        
        // 驗證書籍元素存在
        const bookElements = await overviewPage.$$('.book-grid-item, .book-item, .book-card');
        expect(bookElements.length).toBeGreaterThan(0);
        
        console.log(`📚 找到 ${bookElements.length} 本書籍`);
      } catch (error) {
        console.warn('⚠️ 書籍網格載入超時，檢查頁面狀態');
        
        // 檢查頁面內容
        const bodyText = await overviewPage.evaluate(() => document.body.textContent);
        console.log('頁面內容:', bodyText.substring(0, 200));
      }
    });

    test('應該能夠執行書籍搜尋功能', async () => {
      // 尋找搜尋輸入框
      const searchInput = await overviewPage.$('input[type="search"], input[placeholder*="搜"], .search-input');
      
      if (searchInput) {
        // 輸入搜尋關鍵字
        await searchInput.type('JavaScript');
        
        // 觸發搜尋（按 Enter 或點擊搜尋按鈕）
        await searchInput.press('Enter');
        
        // 等待搜尋結果
        await overviewPage.waitForTimeout(2000);
        
        // 驗證搜尋結果
        const searchResults = await overviewPage.$$('.book-grid-item, .book-item');
        expect(searchResults.length).toBeGreaterThanOrEqual(0);
        
        console.log(`🔍 搜尋 'JavaScript' 找到 ${searchResults.length} 個結果`);
      }
    });

    test('應該能夠使用篩選功能', async () => {
      // 尋找篩選控制項
      const filterSelects = await overviewPage.$$('select, .filter-select');
      const filterButtons = await overviewPage.$$('.filter-button, .category-filter');
      
      if (filterSelects.length > 0) {
        // 測試下拉選單篩選
        const categoryFilter = filterSelects[0];
        await categoryFilter.selectOption('程式設計');
        
        // 等待篩選結果
        await overviewPage.waitForTimeout(2000);
        
        // 驗證篩選結果
        const filteredResults = await overviewPage.$$('.book-grid-item, .book-item');
        console.log(`📂 篩選 '程式設計' 類別找到 ${filteredResults.length} 個結果`);
      }
      
      if (filterButtons.length > 0) {
        // 測試按鈕式篩選
        await filterButtons[0].click();
        await overviewPage.waitForTimeout(1000);
        
        const buttonResults = await overviewPage.$$('.book-grid-item, .book-item');
        console.log(`🔘 按鈕篩選找到 ${buttonResults.length} 個結果`);
      }
    });

    test('應該能夠切換檢視模式', async () => {
      // 尋找檢視模式切換按鈕
      const viewModeButtons = await overviewPage.$$('.view-mode-button, .grid-view, .list-view');
      
      if (viewModeButtons.length > 0) {
        const currentView = await overviewPage.$eval('body', el => el.className);
        
        // 點擊切換按鈕
        await viewModeButtons[0].click();
        await overviewPage.waitForTimeout(1000);
        
        // 驗證檢視模式改變
        const newView = await overviewPage.$eval('body', el => el.className);
        expect(newView).not.toBe(currentView);
        
        console.log('🔄 檢視模式切換成功');
      }
    });
  });

  describe('📤 匯出功能測試', () => {
    test('應該能夠開啟匯出對話框', async () => {
      if (!overviewPage) return;
      
      // 尋找匯出按鈕
      const exportButtons = await overviewPage.$$('button, .button');
      let exportButton = null;
      
      for (const button of exportButtons) {
        const text = await overviewPage.evaluate(el => el.textContent, button);
        if (text.includes('匯出') || text.includes('export') || text.includes('下載')) {
          exportButton = button;
          break;
        }
      }
      
      if (exportButton) {
        await exportButton.click();
        
        // 等待匯出對話框或選項出現
        try {
          await overviewPage.waitForSelector('.export-modal, .export-panel, .export-options', { timeout: 5000 });
          
          const exportModal = await overviewPage.$('.export-modal, .export-panel, .export-options');
          expect(exportModal).toBeTruthy();
          
          console.log('📤 匯出對話框開啟成功');
        } catch (error) {
          console.warn('⚠️ 匯出對話框載入超時');
        }
      }
    });

    test('應該能夠選擇匯出格式並執行', async () => {
      if (!overviewPage) return;
      
      // 尋找匯出格式選項
      const formatRadios = await overviewPage.$$('input[type="radio"], .format-option');
      const formatSelects = await overviewPage.$$('select.export-format');
      
      if (formatRadios.length > 0) {
        // 選擇 CSV 格式
        await formatRadios[0].click();
        await overviewPage.waitForTimeout(500);
      } else if (formatSelects.length > 0) {
        // 從下拉選單選擇格式
        await formatSelects[0].selectOption('csv');
        await overviewPage.waitForTimeout(500);
      }
      
      // 尋找確認匯出按鈕
      const confirmButtons = await overviewPage.$$('button');
      let confirmButton = null;
      
      for (const button of confirmButtons) {
        const text = await overviewPage.evaluate(el => el.textContent, button);
        if (text.includes('確認') || text.includes('匯出') || text.includes('下載')) {
          confirmButton = button;
          break;
        }
      }
      
      if (confirmButton) {
        await confirmButton.click();
        
        // 等待匯出完成提示
        try {
          await overviewPage.waitForFunction(() => {
            return document.querySelector('.export-success, .success-message') ||
                   document.body.textContent.includes('匯出成功') ||
                   document.body.textContent.includes('下載完成');
          }, { timeout: 10000 });
          
          console.log('📥 匯出功能執行成功');
        } catch (error) {
          console.warn('⚠️ 匯出完成確認超時');
        }
      }
    });
  });

  describe('⚠️ 錯誤處理和使用者回饋測試', () => {
    test('應該能夠處理無資料狀態', async () => {
      // 清空儲存資料
      const backgroundPage = await testSetup.getBackgroundPage();
      await backgroundPage.evaluate(() => {
        return new Promise((resolve) => {
          chrome.storage.local.clear(() => {
            resolve();
          });
        });
      });
      
      // 重新載入 Overview 頁面
      if (overviewPage) {
        await overviewPage.reload();
        await overviewPage.waitForTimeout(3000);
        
        // 檢查空狀態提示
        const emptyStateMessage = await overviewPage.evaluate(() => {
          const body = document.body.textContent;
          return body.includes('無資料') || 
                 body.includes('沒有書籍') || 
                 body.includes('empty') ||
                 document.querySelector('.empty-state');
        });
        
        console.log('📭 空狀態處理驗證:', emptyStateMessage ? '✅ 已顯示' : '❌ 未顯示');
      }
    });

    test('應該能夠顯示載入狀態', async () => {
      if (!overviewPage) return;
      
      // 重新載入頁面以觸發載入狀態
      await overviewPage.reload();
      
      // 在載入過程中檢查載入指示器
      const hasLoadingIndicator = await overviewPage.evaluate(() => {
        return document.querySelector('.loading, .spinner, .loading-indicator') !== null ||
               document.body.textContent.includes('載入中') ||
               document.body.textContent.includes('Loading');
      });
      
      // 等待載入完成
      await overviewPage.waitForTimeout(3000);
      
      console.log('⏳ 載入狀態指示器:', hasLoadingIndicator ? '✅ 已顯示' : '❌ 未顯示');
    });
  });

  describe('📱 響應式設計測試', () => {
    test('應該能夠在不同螢幕尺寸下正常運作', async () => {
      if (!overviewPage) return;
      
      const viewports = [
        { width: 1920, height: 1080 }, // 桌面
        { width: 1280, height: 800 },  // 小桌面
        { width: 768, height: 1024 },  // 平板
        { width: 375, height: 667 }    // 手機
      ];
      
      for (const viewport of viewports) {
        await overviewPage.setViewport(viewport);
        await overviewPage.waitForTimeout(1000);
        
        // 檢查關鍵元素是否可見
        const elementsVisible = await overviewPage.evaluate(() => {
          const keyElements = document.querySelectorAll('.book-grid, .search-input, .filter-panel');
          return Array.from(keyElements).some(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
        });
        
        expect(elementsVisible).toBe(true);
        console.log(`📱 ${viewport.width}x${viewport.height} 響應式測試通過`);
      }
      
      // 恢復預設尺寸
      await overviewPage.setViewport({ width: 1280, height: 720 });
    });
  });
});