/**
 * PopupErrorHandler 重構測試 - TDD Red Phase
 * 
 * 負責功能：
 * - 測試重構後的 ErrorHandler 與 UIManager 整合
 * - 驗證 API 相容性保持
 * - 測試新的事件驅動錯誤處理
 * - 確保診斷功能模組化
 * 
 * 重構目標測試：
 * - ErrorHandler 專注於錯誤邏輯處理
 * - UIManager 負責所有 DOM 操作
 * - 保持現有 API 不變
 * - 模組化診斷功能
 */

// Mock Chrome Extension APIs
const mockChrome = {
  runtime: {
    reload: jest.fn(),
    sendMessage: jest.fn(() => Promise.resolve({ success: true })),
    onMessage: { addListener: jest.fn() },
    getManifest: jest.fn(() => ({ version: '0.6.8' }))
  },
  tabs: {
    create: jest.fn(() => Promise.resolve({ id: 1 })),
    query: jest.fn(() => Promise.resolve([{ id: 1, url: 'https://readmoo.com' }])),
    reload: jest.fn(() => Promise.resolve())
  }
};

global.chrome = mockChrome;

// Mock DOM
const { JSDOM } = require('jsdom');

describe('🔧 PopupErrorHandler Refactor Tests (TDD循環 #37)', () => {
  let PopupErrorHandler;
  let PopupUIManager;
  let errorHandler;
  let uiManager;
  let dom;
  let document;

  beforeAll(() => {
    // 設定測試環境的 DOM 結構
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <div id="error-container" class="hidden">
            <div id="error-title">錯誤</div>
            <div id="error-message">發生錯誤</div>
            <div id="error-actions">
              <button id="retry-button">重試</button>
              <button id="reload-button">重新載入</button>
              <button id="diagnostic-button">診斷</button>
            </div>
          </div>
          <div id="status-container">
            <div id="status-message">狀態訊息</div>
          </div>
          <div id="diagnostic-panel" class="hidden">
            <div id="diagnostic-content">診斷內容</div>
            <button id="close-diagnostic">關閉</button>
          </div>
        </body>
      </html>
    `);

    global.window = dom.window;
    global.document = dom.window.document;
    document = dom.window.document;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 重設 DOM 狀態
    document.querySelectorAll('.hidden').forEach(el => {
      el.classList.add('hidden');
    });
  });

  afterEach(() => {
    if (errorHandler && typeof errorHandler.cleanup === 'function') {
      errorHandler.cleanup();
    }
  });

  describe('🔴 Red Phase - ErrorHandler 重構架構測試', () => {
    
    test('should fail: Refactored ErrorHandler should depend on UIManager', () => {
      expect(() => {
        // 重構後的 ErrorHandler 應該依賴 UIManager
        const ErrorHandler = require('../../../src/popup/popup-error-handler');
        const UIManager = require('../../../src/popup/popup-ui-manager');
        
        const uiManager = new UIManager();
        const errorHandler = new ErrorHandler({ uiManager });
        
        expect(errorHandler.uiManager).toBe(uiManager);
        expect(typeof errorHandler.displayError).toBe('function');
      }).toThrow();
    });

    test('should fail: ErrorHandler should maintain original API compatibility', () => {
      expect(() => {
        const ErrorHandler = require('../../../src/popup/popup-error-handler');
        const errorHandler = new ErrorHandler();
        
        // 原有的 API 應該保持不變
        expect(typeof errorHandler.initialize).toBe('function');
        expect(typeof errorHandler.handleError).toBe('function');
        expect(typeof errorHandler.showError).toBe('function');
        expect(typeof errorHandler.enableDiagnosticMode).toBe('function');
      }).toThrow();
    });

    test('should fail: ErrorHandler should delegate DOM operations to UIManager', () => {
      expect(() => {
        const ErrorHandler = require('../../../src/popup/popup-error-handler');
        const UIManager = require('../../../src/popup/popup-ui-manager');
        
        const mockUIManager = {
          showError: jest.fn(),
          hideError: jest.fn(),
          showDiagnostic: jest.fn()
        };
        
        const errorHandler = new ErrorHandler({ uiManager: mockUIManager });
        
        errorHandler.showError({
          title: '測試錯誤',
          message: '測試訊息'
        });
        
        expect(mockUIManager.showError).toHaveBeenCalledWith({
          title: '測試錯誤',
          message: '測試訊息'
        });
      }).toThrow();
    });

    test('should fail: ErrorHandler should use event-driven error reporting', () => {
      expect(() => {
        const ErrorHandler = require('../../../src/popup/popup-error-handler');
        const errorHandler = new ErrorHandler();
        
        const mockEventBus = {
          emit: jest.fn(),
          on: jest.fn()
        };
        
        errorHandler.setEventBus(mockEventBus);
        
        errorHandler.reportError('SYSTEM_ERROR', 'Test error');
        
        expect(mockEventBus.emit).toHaveBeenCalledWith('ERROR.SYSTEM.REPORTED', {
          type: 'SYSTEM_ERROR',
          message: 'Test error',
          timestamp: expect.any(Number)
        });
      }).toThrow();
    });

  });

  describe('🔴 Red Phase - 錯誤處理流程重構測試', () => {
    
    test('should fail: ErrorHandler should handle initialization errors with UIManager', () => {
      expect(() => {
        const ErrorHandler = require('../../../src/popup/popup-error-handler');
        const UIManager = require('../../../src/popup/popup-ui-manager');
        
        const uiManager = new UIManager();
        const errorHandler = new ErrorHandler({ uiManager });
        
        // 模擬初始化錯誤
        const initError = new Error('Initialization failed');
        errorHandler.handleInitializationError(initError);
        
        expect(uiManager.showError).toHaveBeenCalledWith({
          title: '初始化錯誤',
          message: expect.stringContaining('Initialization failed'),
          actions: ['重新載入擴展', '查看診斷'],
          severity: 'error'
        });
      }).toThrow();
    });

    test('should fail: ErrorHandler should handle Chrome API errors gracefully', () => {
      expect(() => {
        const ErrorHandler = require('../../../src/popup/popup-error-handler');
        const errorHandler = new ErrorHandler();
        
        // 模擬 Chrome API 錯誤
        mockChrome.runtime.sendMessage.mockRejectedValueOnce(
          new Error('Extension context invalidated')
        );
        
        return errorHandler.handleChromeAPIError('sendMessage').then(() => {
          expect(errorHandler.lastError).toEqual(
            expect.objectContaining({
              type: 'CHROME_API_ERROR',
              api: 'sendMessage',
              message: 'Extension context invalidated'
            })
          );
        });
      }).toThrow();
    });

    test('should fail: ErrorHandler should integrate with diagnostic module', () => {
      expect(() => {
        const ErrorHandler = require('../../../src/popup/popup-error-handler');
        const DiagnosticModule = require('../../../src/popup/diagnostic-module');
        
        const errorHandler = new ErrorHandler();
        
        // 診斷模組應該按需載入
        expect(errorHandler.diagnosticModule).toBeUndefined();
        
        errorHandler.enableDiagnosticMode();
        
        expect(errorHandler.diagnosticModule).toBeInstanceOf(DiagnosticModule);
      }).toThrow();
    });

    test('should fail: ErrorHandler should support error recovery strategies', () => {
      expect(() => {
        const ErrorHandler = require('../../../src/popup/popup-error-handler');
        const errorHandler = new ErrorHandler();
        
        const error = {
          type: 'NETWORK_ERROR',
          message: '網路連線失敗',
          recoverable: true
        };
        
        const recoveryPlan = errorHandler.getRecoveryStrategy(error);
        
        expect(recoveryPlan).toEqual({
          strategies: ['重試請求', '檢查網路連線', '使用快取資料'],
          priority: 'high',
          autoRetry: true,
          maxRetries: 3
        });
      }).toThrow();
    });

  });

  describe('🔴 Red Phase - 診斷功能模組化測試', () => {
    
    test('should fail: Diagnostic functionality should be lazy-loaded', () => {
      expect(() => {
        const DiagnosticModule = require('../../../src/popup/diagnostic-module');
        
        // 診斷模組應該支援動態載入
        expect(DiagnosticModule.isLoaded).toBe(false);
        
        const diagnostic = new DiagnosticModule();
        diagnostic.initialize();
        
        expect(DiagnosticModule.isLoaded).toBe(true);
        expect(diagnostic.capabilities).toEqual(
          expect.arrayContaining([
            'systemHealth',
            'extensionState',
            'performanceMetrics',
            'errorHistory'
          ])
        );
      }).toThrow();
    });

    test('should fail: Diagnostic module should provide system health report', () => {
      expect(() => {
        const DiagnosticModule = require('../../../src/popup/diagnostic-module');
        const diagnostic = new DiagnosticModule();
        
        return diagnostic.generateHealthReport().then(report => {
          expect(report).toEqual({
            timestamp: expect.any(Number),
            extensionVersion: '0.6.8',
            chromeVersion: expect.any(String),
            systemStatus: {
              background: 'active',
              contentScript: 'connected',
              storage: 'available'
            },
            performance: {
              memoryUsage: expect.any(Number),
              loadTime: expect.any(Number)
            },
            errors: expect.any(Array)
          });
        });
      }).toThrow();
    });

    test('should fail: Diagnostic module should export report data', () => {
      expect(() => {
        const DiagnosticModule = require('../../../src/popup/diagnostic-module');
        const diagnostic = new DiagnosticModule();
        
        const reportData = diagnostic.exportDiagnosticData({
          includeErrors: true,
          includeLogs: true,
          timeRange: '24h'
        });
        
        expect(reportData).toEqual({
          format: 'json',
          data: expect.any(Object),
          downloadUrl: expect.any(String)
        });
      }).toThrow();
    });

  });

  describe('🔴 Red Phase - 效能優化測試', () => {
    
    test('should fail: ErrorHandler should implement error throttling', () => {
      expect(() => {
        const ErrorHandler = require('../../../src/popup/popup-error-handler');
        const errorHandler = new ErrorHandler();
        
        // 測試錯誤節流機制
        const duplicateError = { type: 'TEST_ERROR', message: 'Same error' };
        
        errorHandler.handleError(duplicateError);
        errorHandler.handleError(duplicateError);
        errorHandler.handleError(duplicateError);
        
        expect(errorHandler.errorQueue.length).toBe(1); // 重複錯誤應該被合併
        expect(errorHandler.errorQueue[0].count).toBe(3);
      }).toThrow();
    });

    test('should fail: ErrorHandler should optimize memory usage', () => {
      expect(() => {
        const ErrorHandler = require('../../../src/popup/popup-error-handler');
        const errorHandler = new ErrorHandler();
        
        // 產生大量錯誤記錄
        for (let i = 0; i < 1000; i++) {
          errorHandler.logError(`Error ${i}`, { detail: `Detail ${i}` });
        }
        
        // 錯誤記錄應該有上限
        expect(errorHandler.errorHistory.length).toBeLessThanOrEqual(100);
        expect(errorHandler.errorHistory[0]).toEqual(
          expect.objectContaining({
            message: 'Error 900', // 最舊的記錄被清理
            timestamp: expect.any(Number)
          })
        );
      }).toThrow();
    });

  });

  describe('🔴 Red Phase - 向後相容性測試', () => {
    
    test('should fail: Refactored system should work with existing popup.js', () => {
      expect(() => {
        // 測試與現有 popup.js 的相容性
        const originalErrorHandler = require('../../../src/popup/popup-error-handler');
        
        // 現有 popup.js 的初始化方式應該繼續有效
        global.popupErrorHandler = new originalErrorHandler();
        global.popupErrorHandler.initialize();
        
        expect(global.popupErrorHandler.elements).toBeDefined();
        expect(typeof global.popupErrorHandler.showError).toBe('function');
      }).toThrow();
    });

    test('should fail: Legacy error handling methods should still work', () => {
      expect(() => {
        const ErrorHandler = require('../../../src/popup/popup-error-handler');
        const errorHandler = new ErrorHandler();
        
        // 舊版本的 API 調用方式
        errorHandler.handleError({
          type: 'EXTRACTION_ERROR',
          message: '資料提取失敗',
          context: { page: 'library' }
        });
        
        expect(document.getElementById('error-container')).not.toHaveClass('hidden');
        expect(document.getElementById('error-message').textContent)
          .toContain('資料提取失敗');
      }).toThrow();
    });

  });

});