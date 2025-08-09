/**
 * Chrome Extension 端對端測試環境設置
 * 
 * 負責功能：
 * - 建立 Chrome Extension 測試環境
 * - 配置 Puppeteer 與 Chrome Extension 整合
 * - 提供測試用的 Extension 載入機制
 * - 管理測試生命週期
 * 
 * 設計考量：
 * - 支援 Manifest V3 Chrome Extension 測試
 * - 提供乾淨的測試環境隔離
 * - 處理 Chrome Extension 權限和安全政策
 * - 支援多個測試並行執行
 * 
 * 處理流程：
 * 1. 建立 Chromium 實例並載入 Extension
 * 2. 配置測試頁面和上下文
 * 3. 提供 Extension API 測試工具
 * 4. 管理測試清理和資源釋放
 * 
 * 使用情境：
 * - 端對端測試需要真實的 Chrome Extension 環境時
 * - 測試 Background Script 與 Content Script 互動時
 * - 驗證 Chrome Extension API 整合時
 */

const puppeteer = require('puppeteer');
const path = require('path');

class ExtensionTestSetup {
  constructor() {
    this.browser = null;
    this.page = null;
    this.extensionId = null;
    this.backgroundPage = null;
  }

  /**
   * 初始化測試環境
   * @param {Object} options - 測試配置選項
   * @returns {Promise<void>}
   */
  async setup(options = {}) {
    try {
      // 建立 Extension 建置路徑
      const extensionPath = path.resolve(__dirname, '../../../build/development');
      
      // 啟動 Chromium with Extension
      this.browser = await puppeteer.launch({
        headless: options.headless !== false, // 預設 headless，除非明確設定為 false
        devtools: false,
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-web-security',
          '--disable-features=TranslateUI',
          '--disable-default-apps'
        ]
      });

      // 取得 Extension ID
      this.extensionId = await this.getExtensionId();
      
      // 建立新頁面
      this.page = await this.browser.newPage();
      
      // 設定頁面配置
      await this.configureTestPage();
      
      console.log(`✅ Extension 測試環境已建立，Extension ID: ${this.extensionId}`);
      
    } catch (error) {
      console.error('❌ Extension 測試環境建立失敗:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * 取得已載入 Extension 的 ID
   * @returns {Promise<string>}
   */
  async getExtensionId() {
    try {
      const targets = await this.browser.targets();
      const extensionTarget = targets.find(
        target => target.type() === 'background_page' || 
                 target.type() === 'service_worker'
      );
      
      if (!extensionTarget) {
        throw new Error('找不到 Extension Service Worker');
      }
      
      const extensionUrl = extensionTarget.url();
      const extensionId = extensionUrl.split('/')[2];
      
      return extensionId;
    } catch (error) {
      throw new Error(`取得 Extension ID 失敗: ${error.message}`);
    }
  }

  /**
   * 配置測試頁面
   * @returns {Promise<void>}
   */
  async configureTestPage() {
    // 設定頁面大小
    await this.page.setViewport({ width: 1280, height: 720 });
    
    // 攔截 Console 訊息
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.warn('🔶 頁面 Console Error:', msg.text());
      }
    });
    
    // 攔截頁面錯誤
    this.page.on('pageerror', error => {
      console.warn('🔶 頁面錯誤:', error.message);
    });
  }

  /**
   * 導航到 Readmoo 測試頁面
   * @param {string} url - 目標 URL（預設為模擬的 Readmoo 頁面）
   * @returns {Promise<void>}
   */
  async navigateToReadmoo(url = null) {
    const targetUrl = url || this.getTestReadmooUrl();
    
    try {
      await this.page.goto(targetUrl, { 
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      
      // 等待頁面完全載入
      await this.page.waitForTimeout(2000);
      
      console.log(`✅ 已導航至測試頁面: ${targetUrl}`);
    } catch (error) {
      throw new Error(`導航到 Readmoo 頁面失敗: ${error.message}`);
    }
  }

  /**
   * 取得測試用的 Readmoo URL
   * @returns {string}
   */
  getTestReadmooUrl() {
    // todo: 實際環境應該使用真實的 Readmoo URL 或本地模擬頁面
    const mockHtmlPath = path.resolve(__dirname, '../fixtures/readmoo-mock-page.html');
    return `file://${mockHtmlPath}`;
  }

  /**
   * 開啟 Extension Popup
   * @returns {Promise<Page>}
   */
  async openExtensionPopup() {
    try {
      const popupUrl = `chrome-extension://${this.extensionId}/popup.html`;
      const popupPage = await this.browser.newPage();
      await popupPage.goto(popupUrl);
      
      console.log('✅ Extension Popup 已開啟');
      return popupPage;
    } catch (error) {
      throw new Error(`開啟 Extension Popup 失敗: ${error.message}`);
    }
  }

  /**
   * 取得 Background Script 頁面
   * @returns {Promise<Page>}
   */
  async getBackgroundPage() {
    try {
      const targets = await this.browser.targets();
      const backgroundTarget = targets.find(
        target => target.type() === 'background_page' || 
                 target.type() === 'service_worker'
      );
      
      if (!backgroundTarget) {
        throw new Error('找不到 Background Script');
      }
      
      this.backgroundPage = await backgroundTarget.page();
      return this.backgroundPage;
    } catch (error) {
      throw new Error(`取得 Background Script 失敗: ${error.message}`);
    }
  }

  /**
   * 執行 Content Script 在當前頁面
   * @param {Function|string} script - 要執行的腳本
   * @param {...any} args - 腳本參數
   * @returns {Promise<any>}
   */
  async executeContentScript(script, ...args) {
    try {
      return await this.page.evaluate(script, ...args);
    } catch (error) {
      throw new Error(`執行 Content Script 失敗: ${error.message}`);
    }
  }

  /**
   * 等待元素出現
   * @param {string} selector - CSS 選擇器
   * @param {number} timeout - 超時時間（毫秒）
   * @returns {Promise<ElementHandle>}
   */
  async waitForElement(selector, timeout = 10000) {
    try {
      return await this.page.waitForSelector(selector, { timeout });
    } catch (error) {
      throw new Error(`等待元素 "${selector}" 超時: ${error.message}`);
    }
  }

  /**
   * 擷取測試截圖
   * @param {string} name - 截圖檔案名稱
   * @returns {Promise<void>}
   */
  async takeScreenshot(name) {
    try {
      const screenshotPath = path.resolve(__dirname, '../screenshots', `${name}.png`);
      await this.page.screenshot({ 
        path: screenshotPath,
        fullPage: true 
      });
      console.log(`📷 截圖已儲存: ${screenshotPath}`);
    } catch (error) {
      console.warn(`📷 截圖失敗: ${error.message}`);
    }
  }

  /**
   * 清理測試環境
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      
      if (this.backgroundPage) {
        await this.backgroundPage.close();
        this.backgroundPage = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      console.log('✅ 測試環境已清理');
    } catch (error) {
      console.warn('⚠️ 測試環境清理時發生錯誤:', error);
    }
  }
}

module.exports = ExtensionTestSetup;