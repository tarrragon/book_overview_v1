/**
 * Popup Error Handler 單元測試
 * 
 * 負責功能：
 * - 測試增強錯誤處理系統的完整功能
 * - 驗證使用者友善錯誤訊息轉換
 * - 測試擴展重新載入和診斷功能
 * - 確保系統初始化錯誤處理
 * 
 * 測試範疇：
 * - PopupErrorHandler 核心功能
 * - DOM 元素操作和事件處理
 * - Chrome Extension API 整合
 * - 錯誤回報和診斷功能
 */

// Mock Chrome Extension APIs
const mockChrome = {
  runtime: {
    reload: jest.fn(),
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    getManifest: jest.fn(() => ({ version: '0.6.7' }))
  },
  tabs: {
    create: jest.fn(),
    query: jest.fn(),
    reload: jest.fn()
  }
};

global.chrome = mockChrome;

// Mock DOM
const { JSDOM } = require('jsdom');

describe('🎨 Popup Error Handler Tests (TDD循環 #35)', () => {
  let PopupErrorHandler;
  let errorHandler;
  let dom;

  beforeAll(() => {
    // 設定 JSDOM 環境
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <!-- 系統初始載入錯誤元素 -->
          <div id="initErrorContainer" style="display: none;">
            <div id="initErrorMessage">預設錯誤訊息</div>
            <button id="forceReloadBtn">強制重新載入</button>
            <button id="openExtensionPageBtn">開啟擴展管理</button>
          </div>

          <!-- 一般錯誤元素 -->
          <div id="errorContainer" style="display: none;">
            <div id="errorMessage">錯誤訊息</div>
            <button id="retryBtn">重試</button>
            <button id="reloadExtensionBtn">重新載入擴展</button>
            <button id="reportBtn">回報問題</button>
          </div>

          <!-- 錯誤建議元素 -->
          <div id="errorSuggestions" style="display: none;">
            <ol id="suggestionsList"></ol>
          </div>

          <!-- 診斷模式按鈕 -->
          <button id="diagnosticBtn" style="display: none;">診斷模式</button>

          <!-- 正常UI元素 -->
          <button id="extractBtn">提取</button>
          <button id="settingsBtn">設定</button>
          <button id="helpBtn">說明</button>
        </body>
      </html>
    `, { 
      url: 'chrome-extension://test/popup.html'
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;

    // 載入 PopupErrorHandler
    PopupErrorHandler = require('../../../src/popup/popup-error-handler');
  });

  beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks();
    
    // Mock console methods to avoid noise in test output
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    
    // 建立新的錯誤處理器實例
    errorHandler = new PopupErrorHandler();
  });

  afterEach(() => {
    // 清理 console mocks
    jest.restoreAllMocks();
  });

  describe('🔴 Red Phase: 基本初始化功能', () => {
    test('應該能創建 PopupErrorHandler 實例', () => {
      expect(errorHandler).toBeInstanceOf(PopupErrorHandler);
      expect(errorHandler.elements).toBeDefined();
      expect(errorHandler.diagnosticMode).toBe(false);
      expect(errorHandler.initializationFailed).toBe(false);
    });

    test('應該能正確初始化 DOM 元素引用', () => {
      errorHandler.initializeElements();

      // 系統初始載入錯誤元素
      expect(errorHandler.elements.initErrorContainer).toBe(document.getElementById('initErrorContainer'));
      expect(errorHandler.elements.initErrorMessage).toBe(document.getElementById('initErrorMessage'));
      expect(errorHandler.elements.forceReloadBtn).toBe(document.getElementById('forceReloadBtn'));

      // 一般錯誤元素
      expect(errorHandler.elements.errorContainer).toBe(document.getElementById('errorContainer'));
      expect(errorHandler.elements.errorMessage).toBe(document.getElementById('errorMessage'));

      // 診斷模式按鈕
      expect(errorHandler.elements.diagnosticBtn).toBe(document.getElementById('diagnosticBtn'));
    });

    test('應該能設定事件監聽器', () => {
      const mockAddEventListener = jest.fn();
      
      // Mock DOM 元素的 addEventListener
      document.getElementById('forceReloadBtn').addEventListener = mockAddEventListener;
      document.getElementById('reloadExtensionBtn').addEventListener = mockAddEventListener;
      document.getElementById('reportBtn').addEventListener = mockAddEventListener;
      document.getElementById('diagnosticBtn').addEventListener = mockAddEventListener;

      errorHandler.initializeElements();
      errorHandler.setupEventListeners();

      expect(mockAddEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    test('應該能完整初始化錯誤處理系統', () => {
      const initializeElementsSpy = jest.spyOn(errorHandler, 'initializeElements');
      const setupEventListenersSpy = jest.spyOn(errorHandler, 'setupEventListeners');
      const setupGlobalErrorHandlingSpy = jest.spyOn(errorHandler, 'setupGlobalErrorHandling');

      errorHandler.initialize();

      expect(initializeElementsSpy).toHaveBeenCalled();
      expect(setupEventListenersSpy).toHaveBeenCalled();
      expect(setupGlobalErrorHandlingSpy).toHaveBeenCalled();
    });
  });

  describe('🟢 Green Phase: 系統初始化錯誤處理', () => {
    beforeEach(() => {
      errorHandler.initializeElements();
    });

    test('應該能處理系統初始化錯誤', () => {
      const error = {
        type: 'BACKGROUND_SERVICE_WORKER_FAILED',
        message: 'Background Service Worker 無法連線'
      };

      errorHandler.handleInitializationError(error);

      expect(errorHandler.initializationFailed).toBe(true);
      expect(errorHandler.elements.initErrorContainer.style.display).toBe('block');
      expect(errorHandler.elements.diagnosticBtn.style.display).toBe('block');
    });

    test('應該能隱藏正常UI元素當初始化失敗', () => {
      const error = {
        type: 'SYSTEM_INITIALIZATION_ERROR',
        message: '初始化失敗'
      };

      errorHandler.handleInitializationError(error);

      expect(document.getElementById('extractBtn').style.display).toBe('none');
      expect(document.getElementById('settingsBtn').style.display).toBe('none');
      expect(document.getElementById('helpBtn').style.display).toBe('none');
    });

    test('應該能重置錯誤狀態', () => {
      // 首先設定錯誤狀態
      errorHandler.handleInitializationError({
        type: 'SYSTEM_ERROR',
        message: '測試錯誤'
      });

      expect(errorHandler.initializationFailed).toBe(true);

      // 重置錯誤狀態
      errorHandler.resetErrorState();

      expect(errorHandler.initializationFailed).toBe(false);
      expect(errorHandler.elements.initErrorContainer.style.display).toBe('none');
      expect(document.getElementById('extractBtn').style.display).toBe('');
    });
  });

  describe('🟢 Green Phase: 使用者友善錯誤處理', () => {
    beforeEach(() => {
      errorHandler.initializeElements();
    });

    test('應該能顯示使用者友善錯誤', () => {
      const errorInfo = {
        type: 'MESSAGE_UNKNOWN_TYPE',
        data: {
          message: '未知訊息類型',
          technicalMessage: 'Unknown message type: TEST_MESSAGE'
        }
      };

      errorHandler.showUserFriendlyError(errorInfo);

      expect(errorHandler.elements.errorContainer.style.display).toBe('block');
      expect(errorHandler.elements.errorMessage.textContent).toContain('未知');
    });

    test('應該能顯示錯誤建議', () => {
      const actions = [
        '重新載入擴展',
        '重新整理頁面',
        '聯絡技術支援'
      ];

      errorHandler.showErrorSuggestions(actions);

      expect(errorHandler.elements.errorSuggestions.style.display).toBe('block');
      expect(errorHandler.elements.suggestionsList.children.length).toBe(3);
      expect(errorHandler.elements.suggestionsList.children[0].textContent).toBe('重新載入擴展');
    });

    test('應該能根據錯誤嚴重程度調整UI', () => {
      errorHandler.adjustUIForErrorSeverity('critical');
      expect(errorHandler.elements.errorContainer.classList.contains('error-critical')).toBe(true);

      errorHandler.adjustUIForErrorSeverity('warning');
      expect(errorHandler.elements.errorContainer.classList.contains('error-warning')).toBe(true);
      expect(errorHandler.elements.errorContainer.classList.contains('error-critical')).toBe(false);
    });

    test('應該能隱藏所有錯誤界面', () => {
      // 先顯示錯誤
      errorHandler.elements.initErrorContainer.style.display = 'block';
      errorHandler.elements.errorContainer.style.display = 'block';
      errorHandler.elements.errorSuggestions.style.display = 'block';

      errorHandler.hideAllErrors();

      expect(errorHandler.elements.initErrorContainer.style.display).toBe('none');
      expect(errorHandler.elements.errorContainer.style.display).toBe('none');
      expect(errorHandler.elements.errorSuggestions.style.display).toBe('none');
    });
  });

  describe('🟢 Green Phase: Chrome Extension 重新載入功能', () => {
    beforeEach(() => {
      errorHandler.initializeElements();
    });

    test('應該能強制重新載入擴展', () => {
      errorHandler.forceReloadExtension();
      expect(mockChrome.runtime.reload).toHaveBeenCalled();
    });

    test('應該能處理重新載入失敗的情況', () => {
      mockChrome.runtime.reload.mockImplementation(() => {
        throw new Error('Reload failed');
      });

      const reloadAllExtensionPagesSpy = jest.spyOn(errorHandler, 'reloadAllExtensionPages').mockImplementation();
      
      errorHandler.forceReloadExtension();

      expect(reloadAllExtensionPagesSpy).toHaveBeenCalled();
      
      reloadAllExtensionPagesSpy.mockRestore();
    });

    test('應該能溫和重新載入擴展', () => {
      const dispatchEventSpy = jest.spyOn(global.window, 'dispatchEvent');
      const hideAllErrorsSpy = jest.spyOn(errorHandler, 'hideAllErrors');

      errorHandler.reloadExtension();

      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'popup-reinitialize'
        })
      );
      expect(hideAllErrorsSpy).toHaveBeenCalled();
    });

    test('應該能開啟擴展管理頁面', () => {
      errorHandler.openExtensionManagePage();
      
      expect(mockChrome.tabs.create).toHaveBeenCalledWith({
        url: 'chrome://extensions/',
        active: true
      });
    });
  });

  describe('🟢 Green Phase: 診斷模式功能', () => {
    beforeEach(() => {
      errorHandler.initializeElements();
    });

    test('應該能切換診斷模式', () => {
      expect(errorHandler.diagnosticMode).toBe(false);

      errorHandler.toggleDiagnosticMode();

      expect(errorHandler.diagnosticMode).toBe(true);
      expect(errorHandler.elements.diagnosticBtn.textContent).toBe('🔧 停用診斷');
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'ENABLE_DIAGNOSTIC_MODE'
      });
    });

    test('應該能再次切換診斷模式關閉', () => {
      errorHandler.diagnosticMode = true;
      errorHandler.elements.diagnosticBtn.textContent = '🔧 停用診斷';

      errorHandler.toggleDiagnosticMode();

      expect(errorHandler.diagnosticMode).toBe(false);
      expect(errorHandler.elements.diagnosticBtn.textContent).toBe('🔧 診斷模式');
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'DISABLE_DIAGNOSTIC_MODE'
      });
    });

    test('應該能檢查系統初始化錯誤狀態', () => {
      expect(errorHandler.hasInitializationError()).toBe(false);

      errorHandler.initializationFailed = true;
      expect(errorHandler.hasInitializationError()).toBe(true);
    });
  });

  describe('🟢 Green Phase: 錯誤回報功能', () => {
    beforeEach(() => {
      errorHandler.initializeElements();
    });

    test('應該能收集診斷資料', async () => {
      // 重置並設定 mock
      mockChrome.runtime.sendMessage.mockClear();
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        report: { testData: 'test' }
      });

      const diagnosticData = await errorHandler.collectDiagnosticData();

      expect(diagnosticData).toMatchObject({
        timestamp: expect.any(Number),
        userAgent: expect.any(String),
        extensionVersion: '0.6.7',
        initializationFailed: false,
        diagnosticMode: false
      });

      expect(diagnosticData.systemReport).toEqual({ testData: 'test' });
    });

    test('應該能處理診斷資料收集失敗', async () => {
      // 重置並設定 mock
      mockChrome.runtime.sendMessage.mockClear();
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Failed'));

      const diagnosticData = await errorHandler.collectDiagnosticData();

      expect(diagnosticData.systemReport).toBeUndefined();
    });

    test('應該能生成錯誤回報URL', () => {
      const diagnosticData = {
        timestamp: Date.now(),
        userAgent: 'Chrome Test',
        extensionVersion: '0.6.7',
        initializationFailed: false
      };

      const reportUrl = errorHandler.generateErrorReportURL(diagnosticData);

      expect(reportUrl).toContain('github.com');
      expect(reportUrl).toContain('issues/new');
      expect(reportUrl).toContain('Bug%20Report');
    });

    test('應該能處理完整錯誤回報流程', async () => {
      // 重置 mocks
      mockChrome.tabs.create.mockClear();
      
      const collectDiagnosticDataSpy = jest.spyOn(errorHandler, 'collectDiagnosticData')
        .mockResolvedValue({
          timestamp: Date.now(),
          userAgent: 'Chrome Test',
          extensionVersion: '0.6.7'
        });

      await errorHandler.handleErrorReport();

      expect(collectDiagnosticDataSpy).toHaveBeenCalled();
      expect(mockChrome.tabs.create).toHaveBeenCalled();
      
      collectDiagnosticDataSpy.mockRestore();
    });

    test('應該能處理錯誤回報失敗情況', async () => {
      const collectDiagnosticDataSpy = jest.spyOn(errorHandler, 'collectDiagnosticData')
        .mockRejectedValue(new Error('Collection failed'));

      global.alert = jest.fn();

      await errorHandler.handleErrorReport();

      expect(collectDiagnosticDataSpy).toHaveBeenCalled();
      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('GitHub Issues'));
      
      collectDiagnosticDataSpy.mockRestore();
    });
  });

  describe('🔵 Refactor Phase: 全域錯誤處理整合', () => {
    beforeEach(() => {
      errorHandler.initializeElements();
    });

    test('應該能設定全域錯誤處理', () => {
      const addEventListenerSpy = jest.spyOn(global.window, 'addEventListener');

      errorHandler.setupGlobalErrorHandling();

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'popup-initialization-error',
        expect.any(Function)
      );
    });

    test('應該能處理 Chrome Extension 訊息', () => {
      const handleUserErrorsSpy = jest.spyOn(errorHandler, 'handleUserErrors');

      errorHandler.setupGlobalErrorHandling();

      // 模擬收到使用者錯誤通知
      const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      const mockMessage = {
        type: 'USER_ERROR_NOTIFICATION',
        errors: [{ id: 1, type: 'TEST_ERROR', data: {} }]
      };

      messageHandler(mockMessage, {}, jest.fn());

      expect(handleUserErrorsSpy).toHaveBeenCalledWith(mockMessage.errors);
    });

    test('應該能處理使用者錯誤列表', () => {
      const showUserFriendlyErrorSpy = jest.spyOn(errorHandler, 'showUserFriendlyError');
      
      const errors = [
        { id: 1, type: 'ERROR_1', data: {} },
        { id: 2, type: 'ERROR_2', data: {} }
      ];

      errorHandler.handleUserErrors(errors);

      expect(showUserFriendlyErrorSpy).toHaveBeenCalledWith(errors[1]); // 最新錯誤
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MARK_ERROR_DISPLAYED',
        errorId: 2
      });
    });

    test('應該能忽略空的錯誤列表', () => {
      const showUserFriendlyErrorSpy = jest.spyOn(errorHandler, 'showUserFriendlyError');

      errorHandler.handleUserErrors([]);
      errorHandler.handleUserErrors(null);

      expect(showUserFriendlyErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('🔵 Refactor Phase: 整合測試驗證', () => {
    beforeEach(() => {
      errorHandler.initialize();
    });

    test('應該能完整處理初始化錯誤流程', () => {
      const error = {
        type: 'BACKGROUND_SERVICE_WORKER_FAILED',
        message: 'Service Worker 無法連線'
      };

      errorHandler.handleInitializationError(error);

      expect(errorHandler.hasInitializationError()).toBe(true);
      expect(errorHandler.elements.initErrorContainer.style.display).toBe('block');
      expect(errorHandler.elements.diagnosticBtn.style.display).toBe('block');
    });

    test('應該能完整處理使用者錯誤流程', () => {
      const errorInfo = {
        type: 'EXTRACTION_NO_DATA',
        data: {
          message: '未找到書籍資料'
        }
      };

      errorHandler.showUserFriendlyError(errorInfo);

      expect(errorHandler.elements.errorContainer.style.display).toBe('block');
    });

    test('應該能完整處理診斷和回報流程', async () => {
      // 啟用診斷模式
      errorHandler.toggleDiagnosticMode();
      expect(errorHandler.diagnosticMode).toBe(true);

      // 收集診斷資料和回報
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        report: { diagnosticInfo: 'test' }
      });

      await errorHandler.handleErrorReport();

      expect(mockChrome.tabs.create).toHaveBeenCalled();
    });
  });
});