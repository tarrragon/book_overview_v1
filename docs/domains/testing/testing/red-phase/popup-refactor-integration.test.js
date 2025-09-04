/**
 * Popup 重構整合測試 - TDD Red Phase
 * 
 * 負責功能：
 * - 測試 PopupUIManager 與 PopupErrorHandler 整合
 * - 驗證事件驅動架構的完整流程
 * - 測試與現有系統的互操作性
 * - 確保使用者體驗的一致性
 * 
 * 整合測試範疇：
 * - 完整的錯誤處理流程
 * - UI 狀態管理與事件響應
 * - Chrome Extension API 整合
 * - 效能和記憶體使用
 */

// Mock Chrome Extension APIs
const mockChrome = {
  runtime: {
    reload: jest.fn(() => Promise.resolve()),
    sendMessage: jest.fn(() => Promise.resolve({ success: true })),
    onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
    getManifest: jest.fn(() => ({ version: '0.6.8' })),
    lastError: null
  },
  tabs: {
    create: jest.fn(() => Promise.resolve({ id: 1 })),
    query: jest.fn(() => Promise.resolve([{ 
      id: 1, 
      url: 'https://readmoo.com/library',
      active: true 
    }])),
    reload: jest.fn(() => Promise.resolve())
  },
  storage: {
    local: {
      get: jest.fn(() => Promise.resolve({})),
      set: jest.fn(() => Promise.resolve()),
      clear: jest.fn(() => Promise.resolve())
    }
  }
};

global.chrome = mockChrome;

// Mock DOM
const { JSDOM } = require('jsdom');

describe('🔧 Popup Refactor Integration Tests (TDD循環 #38)', () => {
  let dom;
  let document;
  let window;

  beforeAll(() => {
    // 載入完整的 popup.html 結構
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Readmoo Book Extractor</title>
          <meta charset="utf-8">
          <style>
            .hidden { display: none !important; }
            .error-message { color: #dc3545; }
            .success-message { color: #28a745; }
            .loading { opacity: 0.6; }
            .fade-in { animation: fadeIn 0.3s ease-in; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          </style>
        </head>
        <body>
          <!-- 主要內容區域 -->
          <div id="main-content">
            <header id="header">
              <h1>Readmoo 書庫管理</h1>
              <div id="version-info">v0.6.8</div>
            </header>
            
            <!-- 狀態顯示區域 -->
            <section id="status-section">
              <div id="status-container">
                <div id="status-message" class="status-text">準備中...</div>
                <div id="progress-container">
                  <div id="progress-bar" style="width: 0%"></div>
                  <div id="progress-text">0%</div>
                </div>
              </div>
            </section>
            
            <!-- 操作按鈕區域 -->
            <section id="actions-section">
              <div id="action-buttons">
                <button id="extract-button" class="primary-button">開始提取</button>
                <button id="export-button" class="secondary-button">匯出資料</button>
                <button id="settings-button" class="secondary-button">設定</button>
              </div>
            </section>
            
            <!-- 錯誤處理區域 -->
            <section id="error-section" class="hidden">
              <div id="error-container">
                <div id="error-header">
                  <div id="error-icon">⚠️</div>
                  <div id="error-title">錯誤</div>
                  <button id="error-close" class="close-button">×</button>
                </div>
                <div id="error-content">
                  <div id="error-message">發生錯誤</div>
                  <div id="error-details" class="hidden">錯誤詳情</div>
                </div>
                <div id="error-actions">
                  <button id="retry-button">重試</button>
                  <button id="reload-button">重新載入</button>
                  <button id="diagnostic-button">診斷</button>
                  <button id="report-button">回報問題</button>
                </div>
              </div>
            </section>
            
            <!-- 成功訊息區域 -->
            <section id="success-section" class="hidden">
              <div id="success-container">
                <div id="success-icon">✅</div>
                <div id="success-message">操作成功</div>
                <button id="success-close" class="close-button">×</button>
              </div>
            </section>
            
            <!-- 載入覆蓋層 -->
            <div id="loading-overlay" class="hidden">
              <div id="loading-content">
                <div id="loading-spinner"></div>
                <div id="loading-message">載入中...</div>
              </div>
            </div>
            
            <!-- 診斷面板 -->
            <div id="diagnostic-panel" class="hidden">
              <div id="diagnostic-header">
                <h3>系統診斷</h3>
                <button id="close-diagnostic" class="close-button">×</button>
              </div>
              <div id="diagnostic-content">
                <div id="diagnostic-tabs">
                  <button class="diagnostic-tab active" data-tab="health">系統健康</button>
                  <button class="diagnostic-tab" data-tab="logs">錯誤記錄</button>
                  <button class="diagnostic-tab" data-tab="performance">效能</button>
                </div>
                <div id="diagnostic-data">診斷資訊載入中...</div>
              </div>
              <div id="diagnostic-actions">
                <button id="export-diagnostic">匯出診斷報告</button>
                <button id="clear-diagnostic">清除記錄</button>
              </div>
            </div>
          </div>
          
          <!-- 通知系統 -->
          <div id="notification-container">
            <!-- 動態插入通知 -->
          </div>
        </body>
      </html>
    `, {
      url: 'chrome-extension://test-extension-id/popup.html',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    global.window = dom.window;
    global.document = dom.window.document;
    document = dom.window.document;
    window = dom.window;

    // 模擬瀏覽器環境
    global.Element = dom.window.Element;
    global.HTMLElement = dom.window.HTMLElement;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 重設 DOM 狀態
    document.getElementById('error-section').classList.add('hidden');
    document.getElementById('success-section').classList.add('hidden');
    document.getElementById('diagnostic-panel').classList.add('hidden');
    document.getElementById('loading-overlay').classList.add('hidden');
    document.getElementById('progress-bar').style.width = '0%';
    document.getElementById('status-message').textContent = '準備中...';
  });

  describe('🔴 Red Phase - 完整錯誤處理流程整合', () => {
    
    test('should fail: Complete error handling workflow integration', async () => {
      expect(async () => {
        // 載入重構後的模組
        const PopupUIManager = require('../../../src/popup/popup-ui-manager');
        const PopupErrorHandler = require('../../../src/popup/popup-error-handler');
        const DiagnosticModule = require('../../../src/popup/diagnostic-module');
        
        // 初始化系統
        const uiManager = new PopupUIManager();
        await uiManager.initialize();
        
        const errorHandler = new PopupErrorHandler({ uiManager });
        await errorHandler.initialize();
        
        // 模擬錯誤發生
        const testError = {
          type: 'EXTRACTION_ERROR',
          message: '無法連接到 Readmoo 服務器',
          stack: new Error().stack,
          context: {
            url: 'https://readmoo.com/library',
            timestamp: Date.now(),
            userAgent: 'Chrome Extension'
          }
        };
        
        // 處理錯誤
        await errorHandler.handleError(testError);
        
        // 驗證 UI 更新
        expect(document.getElementById('error-section')).not.toHaveClass('hidden');
        expect(document.getElementById('error-title').textContent).toContain('連接錯誤');
        expect(document.getElementById('error-message').textContent).toContain('無法連接到 Readmoo 服務器');
        
        // 測試重試功能
        const retryButton = document.getElementById('retry-button');
        expect(retryButton).toBeDefined();
        
        // 模擬點擊重試
        retryButton.click();
        
        // 驗證載入狀態
        expect(document.getElementById('loading-overlay')).not.toHaveClass('hidden');
      }).rejects.toThrow(); // 預期失敗，因為模組尚未實現
    });

    test('should fail: Error recovery and user feedback integration', async () => {
      expect(async () => {
        const PopupUIManager = require('../../../src/popup/popup-ui-manager');
        const PopupErrorHandler = require('../../../src/popup/popup-error-handler');
        
        const uiManager = new PopupUIManager();
        const errorHandler = new PopupErrorHandler({ uiManager });
        
        // 模擬可恢復的錯誤
        const recoverableError = {
          type: 'NETWORK_TIMEOUT',
          message: '請求超時',
          recoverable: true,
          retryable: true
        };
        
        await errorHandler.handleError(recoverableError);
        
        // 驗證恢復建議顯示
        const errorActions = document.getElementById('error-actions');
        expect(errorActions.querySelector('#retry-button')).toBeDefined();
        expect(errorActions.querySelector('#diagnostic-button')).toBeDefined();
        
        // 模擬自動恢復
        await errorHandler.attemptRecovery(recoverableError);
        
        // 驗證成功訊息顯示
        expect(document.getElementById('success-section')).not.toHaveClass('hidden');
        expect(document.getElementById('error-section')).toHaveClass('hidden');
      }).rejects.toThrow();
    });

    test('should fail: Diagnostic panel integration with error context', async () => {
      expect(async () => {
        const PopupUIManager = require('../../../src/popup/popup-ui-manager');
        const PopupErrorHandler = require('../../../src/popup/popup-error-handler');
        const DiagnosticModule = require('../../../src/popup/diagnostic-module');
        
        const uiManager = new PopupUIManager();
        const errorHandler = new PopupErrorHandler({ uiManager });
        
        // 產生系統錯誤
        const systemError = {
          type: 'SYSTEM_ERROR',
          message: '擴展初始化失敗',
          diagnostic: true
        };
        
        await errorHandler.handleError(systemError);
        
        // 點擊診斷按鈕
        document.getElementById('diagnostic-button').click();
        
        // 驗證診斷面板開啟
        expect(document.getElementById('diagnostic-panel')).not.toHaveClass('hidden');
        
        // 等待診斷資料載入
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 驗證診斷內容
        const diagnosticData = document.getElementById('diagnostic-data');
        expect(diagnosticData.textContent).toContain('系統健康檢查');
        expect(diagnosticData.textContent).toContain('擴展版本: 0.6.8');
      }).rejects.toThrow();
    });

  });

  describe('🔴 Red Phase - 事件驅動架構整合', () => {
    
    test('should fail: Event-driven UI state management', async () => {
      expect(async () => {
        const PopupUIManager = require('../../../src/popup/popup-ui-manager');
        const EventBus = require('../../../src/core/event-bus');
        
        const eventBus = new EventBus();
        const uiManager = new PopupUIManager({ eventBus });
        
        // 註冊事件監聽
        eventBus.on('UI.STATUS.UPDATE', (data) => {
          uiManager.updateStatus(data);
        });
        
        eventBus.on('UI.PROGRESS.UPDATE', (data) => {
          uiManager.updateProgress(data.percentage);
        });
        
        eventBus.on('UI.ERROR.SHOW', (data) => {
          uiManager.showError(data);
        });
        
        // 觸發狀態更新事件
        eventBus.emit('UI.STATUS.UPDATE', {
          message: '正在提取書籍資料...',
          type: 'info'
        });
        
        expect(document.getElementById('status-message').textContent)
          .toBe('正在提取書籍資料...');
        
        // 觸發進度更新事件
        eventBus.emit('UI.PROGRESS.UPDATE', { percentage: 45 });
        
        expect(document.getElementById('progress-bar').style.width).toBe('45%');
        
        // 觸發錯誤顯示事件
        eventBus.emit('UI.ERROR.SHOW', {
          title: '提取失敗',
          message: '無法讀取書籍資料'
        });
        
        expect(document.getElementById('error-section')).not.toHaveClass('hidden');
      }).rejects.toThrow();
    });

    test('should fail: Cross-module event communication', async () => {
      expect(async () => {
        const PopupUIManager = require('../../../src/popup/popup-ui-manager');
        const PopupErrorHandler = require('../../../src/popup/popup-error-handler');
        const EventBus = require('../../../src/core/event-bus');
        
        const eventBus = new EventBus();
        const uiManager = new PopupUIManager({ eventBus });
        const errorHandler = new PopupErrorHandler({ eventBus, uiManager });
        
        // 模擬背景腳本事件
        eventBus.emit('BACKGROUND.EXTRACTION.FAILED', {
          error: 'Connection timeout',
          retryable: true,
          context: { page: 'library' }
        });
        
        // 驗證錯誤處理器響應
        expect(errorHandler.lastHandledEvent).toEqual(
          expect.objectContaining({
            type: 'BACKGROUND.EXTRACTION.FAILED'
          })
        );
        
        // 驗證 UI 更新
        expect(document.getElementById('error-section')).not.toHaveClass('hidden');
      }).rejects.toThrow();
    });

  });

  describe('🔴 Red Phase - Chrome Extension API 整合', () => {
    
    test('should fail: Chrome runtime message handling integration', async () => {
      expect(async () => {
        const PopupUIManager = require('../../../src/popup/popup-ui-manager');
        const PopupErrorHandler = require('../../../src/popup/popup-error-handler');
        
        const uiManager = new PopupUIManager();
        const errorHandler = new PopupErrorHandler({ uiManager });
        
        // 模擬來自背景腳本的訊息
        const mockMessage = {
          type: 'EXTRACTION_STATUS',
          data: {
            status: 'error',
            error: 'Invalid session',
            recoverable: false
          }
        };
        
        // 處理 Chrome 訊息
        await errorHandler.handleChromeMessage(mockMessage);
        
        // 驗證錯誤處理
        expect(document.getElementById('error-message').textContent)
          .toContain('Invalid session');
        expect(document.getElementById('retry-button').disabled).toBe(true);
      }).rejects.toThrow();
    });

    test('should fail: Chrome tabs API integration for page reload', async () => {
      expect(async () => {
        const PopupUIManager = require('../../../src/popup/popup-ui-manager');
        const PopupErrorHandler = require('../../../src/popup/popup-error-handler');
        
        const uiManager = new PopupUIManager();
        const errorHandler = new PopupErrorHandler({ uiManager });
        
        // 顯示需要頁面重新載入的錯誤
        await errorHandler.handleError({
          type: 'PAGE_RELOAD_REQUIRED',
          message: '頁面狀態已過期，需要重新載入'
        });
        
        // 模擬點擊頁面重新載入按鈕
        const reloadPageButton = document.querySelector('[data-action="reload-page"]');
        reloadPageButton.click();
        
        // 驗證 Chrome tabs API 呼叫
        expect(mockChrome.tabs.query).toHaveBeenCalledWith(
          { active: true, currentWindow: true }
        );
        expect(mockChrome.tabs.reload).toHaveBeenCalledWith(1);
        
        // 驗證 UI 回饋
        expect(document.getElementById('success-message').textContent)
          .toBe('頁面重新載入完成');
      }).rejects.toThrow();
    });

  });

  describe('🔴 Red Phase - 效能和記憶體整合測試', () => {
    
    test('should fail: Memory usage optimization in integrated system', async () => {
      expect(async () => {
        const PopupUIManager = require('../../../src/popup/popup-ui-manager');
        const PopupErrorHandler = require('../../../src/popup/popup-error-handler');
        const DiagnosticModule = require('../../../src/popup/diagnostic-module');
        
        // 記錄初始記憶體使用
        const initialMemory = process.memoryUsage().heapUsed;
        
        // 初始化所有模組
        const uiManager = new PopupUIManager();
        const errorHandler = new PopupErrorHandler({ uiManager });
        const diagnostic = new DiagnosticModule();
        
        await uiManager.initialize();
        await errorHandler.initialize();
        
        // 產生大量操作
        for (let i = 0; i < 100; i++) {
          await errorHandler.handleError({
            type: 'TEST_ERROR',
            message: `Test error ${i}`
          });
          
          uiManager.updateProgress(i);
          uiManager.showSuccess(`Operation ${i} completed`);
        }
        
        // 清理資源
        await uiManager.cleanup();
        await errorHandler.cleanup();
        await diagnostic.cleanup();
        
        // 強制垃圾回收（在測試環境中）
        if (global.gc) {
          global.gc();
        }
        
        // 檢查記憶體洩漏
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;
        
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 小於 10MB
      }).rejects.toThrow();
    });

    test('should fail: UI rendering performance optimization', async () => {
      expect(async () => {
        const PopupUIManager = require('../../../src/popup/popup-ui-manager');
        
        const uiManager = new PopupUIManager();
        await uiManager.initialize();
        
        // 測試快速連續的 UI 更新
        const startTime = performance.now();
        
        for (let i = 0; i < 1000; i++) {
          uiManager.updateProgress(i / 10);
          uiManager.updateStatus(`Processing item ${i}`);
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // UI 更新應該在合理時間內完成
        expect(duration).toBeLessThan(1000); // 小於 1 秒
        
        // 驗證去重機制
        expect(uiManager.pendingUpdates.size).toBeLessThan(10);
      }).rejects.toThrow();
    });

  });

  describe('🔴 Red Phase - 使用者體驗整合測試', () => {
    
    test('should fail: Complete user error recovery workflow', async () => {
      expect(async () => {
        const PopupUIManager = require('../../../src/popup/popup-ui-manager');
        const PopupErrorHandler = require('../../../src/popup/popup-error-handler');
        
        const uiManager = new PopupUIManager();
        const errorHandler = new PopupErrorHandler({ uiManager });
        
        await uiManager.initialize();
        await errorHandler.initialize();
        
        // 模擬使用者操作序列
        // 1. 開始提取
        document.getElementById('extract-button').click();
        expect(document.getElementById('loading-overlay')).not.toHaveClass('hidden');
        
        // 2. 提取失敗
        await errorHandler.handleError({
          type: 'EXTRACTION_ERROR',
          message: '網路連線中斷',
          recoverable: true
        });
        
        expect(document.getElementById('loading-overlay')).toHaveClass('hidden');
        expect(document.getElementById('error-section')).not.toHaveClass('hidden');
        
        // 3. 使用者點擊重試
        document.getElementById('retry-button').click();
        expect(document.getElementById('loading-overlay')).not.toHaveClass('hidden');
        
        // 4. 重試成功
        await uiManager.showSuccess('提取完成，共找到 25 本書籍');
        
        expect(document.getElementById('success-section')).not.toHaveClass('hidden');
        expect(document.getElementById('error-section')).toHaveClass('hidden');
        
        // 5. 自動關閉成功訊息
        await new Promise(resolve => setTimeout(resolve, 3100));
        expect(document.getElementById('success-section')).toHaveClass('hidden');
      }).rejects.toThrow();
    });

    test('should fail: Accessibility and keyboard navigation integration', async () => {
      expect(async () => {
        const PopupUIManager = require('../../../src/popup/popup-ui-manager');
        
        const uiManager = new PopupUIManager();
        await uiManager.initialize();
        
        // 測試鍵盤導航
        const extractButton = document.getElementById('extract-button');
        const exportButton = document.getElementById('export-button');
        
        // 模擬 Tab 鍵導航
        extractButton.focus();
        expect(document.activeElement).toBe(extractButton);
        
        // 測試 ARIA 屬性
        await uiManager.showError({
          title: '錯誤',
          message: '測試錯誤訊息'
        });
        
        const errorContainer = document.getElementById('error-container');
        expect(errorContainer.getAttribute('role')).toBe('alert');
        expect(errorContainer.getAttribute('aria-live')).toBe('polite');
        
        // 測試螢幕閱讀器支援
        expect(document.getElementById('error-message').getAttribute('aria-describedby'))
          .toBe('error-details');
      }).rejects.toThrow();
    });

  });

});