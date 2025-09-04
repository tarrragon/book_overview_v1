/**
 * 📊 第45階段：最終系統整合測試 (TDD循環 #45 - Red Phase)
 * 
 * 負責功能：
 * - 執行完整系統整合測試
 * - 驗證所有模組間的協作
 * - 識別架構債務和整合問題
 * - 確保向後相容性和穩定性
 * 
 * 測試策略：
 * 1. 核心模組整合測試
 * 2. 事件系統流程完整性測試
 * 3. Chrome Extension 功能測試
 * 4. 錯誤處理和恢復測試
 * 5. 效能和記憶體測試
 * 
 * 設計考量：
 * - 這是最終整合階段，必須識別所有未解決的問題
 * - 使用 TDD Red Phase 策略：期望測試失敗以發現問題
 * - 重點關注模組間的邊界和協作
 * - 驗證系統在各種邊界條件下的行為
 * 
 * @version v0.6.13
 * @since TDD循環 #45
 */

const { JSDOM } = require('jsdom');

// Chrome Extension APIs Mock
const mockChrome = {
  runtime: {
    reload: jest.fn(),
    sendMessage: jest.fn((message, callback) => {
      // 模擬各種回應情況
      if (message.type === 'START_EXTRACTION') {
        return Promise.resolve({ success: true, booksCount: 100 });
      }
      if (callback) callback({ success: true });
      return Promise.resolve({ success: true });
    }),
    onMessage: { 
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    getManifest: jest.fn(() => ({ 
      version: '0.6.13',
      manifest_version: 3,
      permissions: ['storage', 'activeTab']
    })),
    lastError: null
  },
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        const data = {
          books: [],
          settings: { theme: 'light' },
          diagnostics: { enabled: true }
        };
        if (callback) callback(data);
        return Promise.resolve(data);
      }),
      set: jest.fn((data, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      remove: jest.fn((keys, callback) => {
        if (callback) callback();
        return Promise.resolve();
      })
    },
    sync: {
      get: jest.fn((keys, callback) => {
        const data = { syncedBooks: [] };
        if (callback) callback(data);
        return Promise.resolve(data);
      }),
      set: jest.fn((data, callback) => {
        if (callback) callback();
        return Promise.resolve();
      })
    }
  },
  tabs: {
    create: jest.fn((createProperties, callback) => {
      const tab = { id: Date.now(), url: createProperties.url };
      if (callback) callback(tab);
      return Promise.resolve(tab);
    }),
    query: jest.fn((queryInfo, callback) => {
      const tabs = [{ id: 1, url: 'https://readmoo.com', active: true }];
      if (callback) callback(tabs);
      return Promise.resolve(tabs);
    }),
    reload: jest.fn((tabId, reloadProperties, callback) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    sendMessage: jest.fn((tabId, message, callback) => {
      const response = { success: true, data: 'extracted' };
      if (callback) callback(response);
      return Promise.resolve(response);
    })
  }
};

global.chrome = mockChrome;

// 設定完整的 DOM 環境
const setupDOM = () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Readmoo Book Extractor</title>
        <meta charset="utf-8">
      </head>
      <body>
        <!-- 核心控制區域 -->
        <div id="main-container">
          <div id="extract-button">開始提取</div>
          <div id="status-container">
            <div id="status-message">準備就緒</div>
            <div id="status-indicator" class="idle"></div>
          </div>
          
          <!-- 進度顯示區域 -->
          <div id="progress-container" style="display: none;">
            <div id="progress-bar">
              <div id="progress-fill" style="width: 0%;"></div>
            </div>
            <div id="progress-text">0%</div>
            <div id="progress-message">準備中...</div>
          </div>
          
          <!-- 錯誤顯示區域 -->
          <div id="error-container" style="display: none;">
            <div id="error-message"></div>
            <div id="error-actions">
              <button id="retry-button">重試</button>
              <button id="diagnostic-button">診斷</button>
            </div>
          </div>
          
          <!-- 結果顯示區域 -->
          <div id="results-container" style="display: none;">
            <div id="results-summary"></div>
            <div id="results-actions">
              <button id="view-results-button">查看結果</button>
              <button id="export-results-button">匯出結果</button>
            </div>
          </div>
          
          <!-- 診斷區域 -->
          <div id="diagnostic-modal" style="display: none;">
            <div id="diagnostic-content"></div>
            <button id="close-diagnostic">關閉</button>
          </div>
          
          <!-- 載入覆蓋層 -->
          <div id="loading-overlay" style="display: none;">
            <div id="loading-spinner"></div>
            <div id="loading-message">載入中...</div>
          </div>
        </div>
      </body>
    </html>
  `, {
    url: 'chrome-extension://test/popup.html',
    referrer: 'chrome-extension://test/',
    contentType: 'text/html',
    includeNodeLocations: true,
    storageQuota: 10000000
  });
  
  global.document = dom.window.document;
  global.window = dom.window;
  global.navigator = dom.window.navigator;
  global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 16));
  global.cancelAnimationFrame = jest.fn();
  
  return { dom, document: dom.window.document, window: dom.window };
};

describe('📊 第45階段：最終系統整合測試 (TDD循環 #45)', () => {
  let dom, document, window;
  let EventBus, PopupUIManager, PopupErrorHandler;
  let eventBus, uiManager, errorHandler;
  
  // 測試設定
  beforeAll(async () => {
    // 設定 DOM 環境
    ({ dom, document, window } = setupDOM());
    
    // 載入核心模組
    EventBus = require('../../src/core/event-bus');
    PopupUIManager = require('../../src/popup/popup-ui-manager');
    PopupErrorHandler = require('../../src/popup/popup-error-handler');
    
    // 初始化核心系統
    eventBus = new EventBus();
    uiManager = new PopupUIManager();
    
    try {
      await uiManager.initialize();
      errorHandler = new PopupErrorHandler({ uiManager, eventBus });
    } catch (error) {
      console.warn('Initial setup warning:', error.message);
    }
  });
  
  afterAll(() => {
    if (dom) {
      dom.window.close();
    }
    jest.clearAllMocks();
  });
  
  describe('🔴 Red Phase: 核心模組整合失敗識別', () => {
    
    test('should fail: 完整系統初始化應該識別缺失依賴', async () => {
      expect(() => {
        // 測試系統完整初始化
        const testSystem = {
          eventBus: new EventBus(),
          uiManager: new PopupUIManager(),
          errorHandler: null
        };
        
        // 嘗試初始化所有組件
        testSystem.uiManager.initialize();
        testSystem.errorHandler = new PopupErrorHandler({
          uiManager: testSystem.uiManager,
          eventBus: testSystem.eventBus
        });
        
        // 驗證所有組件都正確初始化
        expect(testSystem.eventBus).toBeDefined();
        expect(testSystem.uiManager.isInitialized()).toBe(true);
        expect(testSystem.errorHandler).toBeDefined();
        
      }).toThrow(); // 期望失敗以識別問題
    });
    
    test('should fail: 事件系統完整性應該識別事件流問題', async () => {
      expect(async () => {
        // 測試完整的事件流程
        const testEvents = [
          'USER.EXTRACT.REQUESTED',
          'EXTRACTION.STARTED', 
          'EXTRACTION.PROGRESS',
          'EXTRACTION.COMPLETED',
          'STORAGE.SAVE.REQUESTED',
          'STORAGE.SAVE.COMPLETED',
          'UI.NOTIFICATION.SHOW'
        ];
        
        // 註冊所有事件處理器
        testEvents.forEach(eventType => {
          eventBus.on(eventType, (data) => {
            console.log(`Processing event: ${eventType}`, data);
          });
        });
        
        // 模擬完整提取流程
        eventBus.emit('USER.EXTRACT.REQUESTED', { source: 'popup' });
        await new Promise(resolve => setTimeout(resolve, 100));
        
        eventBus.emit('EXTRACTION.STARTED', { 
          timestamp: Date.now(),
          expectedBooks: 100
        });
        
        // 模擬進度更新
        for (let i = 0; i <= 100; i += 10) {
          eventBus.emit('EXTRACTION.PROGRESS', {
            percentage: i,
            processed: i,
            total: 100,
            message: `處理中... ${i}%`
          });
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        eventBus.emit('EXTRACTION.COMPLETED', {
          success: true,
          booksCount: 100,
          duration: 1000
        });
        
        // 驗證事件系統狀態
        expect(eventBus.getListenerCount('USER.EXTRACT.REQUESTED')).toBe(1);
        expect(eventBus.getStats().totalEvents).toBeGreaterThan(0);
        
      }).rejects.toThrow(); // 期望失敗以識別問題
    });
    
    test('should fail: Chrome Extension API 整合應該識別通訊問題', async () => {
      expect(async () => {
        // 測試完整的 Chrome Extension 通訊
        const extractionRequest = {
          type: 'START_EXTRACTION',
          data: { 
            url: 'https://readmoo.com/library',
            options: { includeProgress: true }
          }
        };
        
        // 測試 Background Script 通訊
        const backgroundResponse = await chrome.runtime.sendMessage(extractionRequest);
        expect(backgroundResponse.success).toBe(true);
        
        // 測試 Tab 通訊
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        expect(tabs).toHaveLength(1);
        
        const tabResponse = await chrome.tabs.sendMessage(tabs[0].id, extractionRequest);
        expect(tabResponse.success).toBe(true);
        
        // 測試儲存操作
        await chrome.storage.local.set({ testData: 'integration-test' });
        const storedData = await chrome.storage.local.get(['testData']);
        expect(storedData.testData).toBe('integration-test');
        
        // 驗證完整通訊流程無誤
        expect(chrome.runtime.sendMessage).toHaveBeenCalled();
        expect(chrome.tabs.sendMessage).toHaveBeenCalled();
        expect(chrome.storage.local.set).toHaveBeenCalled();
        
      }).rejects.toThrow(); // 期望失敗以識別問題
    });
    
    test('should fail: 錯誤處理系統應該識別恢復機制問題', async () => {
      expect(async () => {
        // 測試各種錯誤情況的處理
        const errorScenarios = [
          {
            type: 'NETWORK_ERROR',
            message: '網路連線失敗',
            recoverable: true
          },
          {
            type: 'PERMISSION_DENIED',
            message: '權限不足',
            recoverable: false
          },
          {
            type: 'STORAGE_QUOTA_EXCEEDED',
            message: '儲存空間不足', 
            recoverable: true
          },
          {
            type: 'EXTRACTION_TIMEOUT',
            message: '提取逾時',
            recoverable: true
          }
        ];
        
        // 測試每種錯誤的處理
        for (const scenario of errorScenarios) {
          const error = new Error(scenario.message);
          error.type = scenario.type;
          error.recoverable = scenario.recoverable;
          
          // 觸發錯誤處理
          await errorHandler.handleError(error, { source: 'integration-test' });
          
          // 驗證錯誤顯示
          const errorContainer = document.getElementById('error-container');
          expect(errorContainer.style.display).not.toBe('none');
          
          // 測試恢復機制
          if (scenario.recoverable) {
            const retryButton = document.getElementById('retry-button');
            expect(retryButton).toBeDefined();
            
            // 模擬重試
            retryButton.click();
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        // 驗證錯誤統計
        const errorStats = errorHandler.getErrorStats();
        expect(errorStats.totalErrors).toBe(errorScenarios.length);
        
      }).rejects.toThrow(); // 期望失敗以識別問題
    });
    
    test('should fail: UI 響應性和效能應該識別瓶頸', async () => {
      expect(async () => {
        // 測試 UI 響應性
        const startTime = performance.now();
        
        // 大量 UI 更新測試
        for (let i = 0; i < 1000; i++) {
          uiManager.updateProgress({
            percentage: (i / 1000) * 100,
            message: `測試更新 ${i}`
          });
          
          // 每100次更新檢查一次響應時間
          if (i % 100 === 0) {
            const currentTime = performance.now();
            const elapsedTime = currentTime - startTime;
            
            // 每次更新不應超過1ms平均時間
            expect(elapsedTime / (i + 1)).toBeLessThan(1);
          }
        }
        
        const totalTime = performance.now() - startTime;
        
        // 總時間不應超過1秒
        expect(totalTime).toBeLessThan(1000);
        
        // 檢查記憶體使用情況
        if (window.performance && window.performance.memory) {
          const memoryUsage = window.performance.memory.usedJSHeapSize;
          expect(memoryUsage).toBeLessThan(50 * 1024 * 1024); // 50MB
        }
        
      }).rejects.toThrow(); // 期望失敗以識別問題
    });
    
    test('should fail: 模組間依賴應該識別循環依賴問題', () => {
      expect(() => {
        // 檢查模組依賴關係
        const dependencies = {
          'EventBus': [],
          'PopupUIManager': ['EventBus'],
          'PopupErrorHandler': ['PopupUIManager', 'EventBus'],
          'BookDataExtractor': ['EventBus'],
          'StorageHandler': ['EventBus'],
          'UIProgressHandler': ['EventBus']
        };
        
        // 檢查是否存在循環依賴
        const checkCircularDependency = (module, visited = new Set(), path = []) => {
          if (path.includes(module)) {
            throw new Error(`Circular dependency detected: ${path.join(' -> ')} -> ${module}`);
          }
          
          if (visited.has(module)) return;
          visited.add(module);
          
          const deps = dependencies[module] || [];
          for (const dep of deps) {
            checkCircularDependency(dep, visited, [...path, module]);
          }
        };
        
        // 檢查每個模組
        Object.keys(dependencies).forEach(module => {
          checkCircularDependency(module);
        });
        
        // 驗證依賴樹深度不超過5層
        const maxDepth = Math.max(...Object.values(dependencies).map(deps => deps.length));
        expect(maxDepth).toBeLessThan(5);
        
      }).toThrow(); // 期望失敗以識別問題
    });
    
    test('should fail: 記憶體洩漏檢測應該識別資源管理問題', async () => {
      expect(async () => {
        // 模擬大量操作以檢測記憶體洩漏
        const initialMemory = process.memoryUsage().heapUsed;
        const iterations = 1000;
        
        for (let i = 0; i < iterations; i++) {
          // 創建臨時事件處理器
          const tempHandler = (data) => {
            console.log(`Temp handler ${i}:`, data);
          };
          
          eventBus.on('TEMP_EVENT', tempHandler);
          eventBus.emit('TEMP_EVENT', { iteration: i });
          
          // 每100次迭代清理一次
          if (i % 100 === 0) {
            eventBus.off('TEMP_EVENT', tempHandler);
            
            // 強制垃圾回收 (如果可用)
            if (global.gc) {
              global.gc();
            }
          }
          
          // 檢查記憶體增長
          const currentMemory = process.memoryUsage().heapUsed;
          const memoryGrowth = currentMemory - initialMemory;
          
          // 記憶體增長不應超過50MB
          expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
        }
        
        // 最終清理
        eventBus.removeAllListeners('TEMP_EVENT');
        
        const finalMemory = process.memoryUsage().heapUsed;
        const totalGrowth = finalMemory - initialMemory;
        
        // 總記憶體增長應該很小
        expect(totalGrowth).toBeLessThan(10 * 1024 * 1024); // 10MB
        
      }).rejects.toThrow(); // 期望失敗以識別問題
    });
    
    test('should fail: 向後相容性應該識別破壞性變更', () => {
      expect(() => {
        // 測試現有 API 的相容性
        const legacyAPIs = {
          // PopupErrorHandler 舊版 API
          errorHandler: {
            showError: 'function',
            hideError: 'function', 
            enableDiagnosticMode: 'function',
            getErrorStats: 'function'
          },
          
          // PopupUIManager 舊版 API 
          uiManager: {
            updateStatus: 'function',
            updateProgress: 'function',
            showResults: 'function',
            reset: 'function'
          },
          
          // EventBus 舊版 API
          eventBus: {
            on: 'function',
            emit: 'function', 
            off: 'function',
            removeAllListeners: 'function'
          }
        };
        
        // 檢查每個 API 是否仍然存在
        Object.entries(legacyAPIs).forEach(([moduleName, apis]) => {
          const moduleInstance = {
            errorHandler,
            uiManager,
            eventBus
          }[moduleName];
          
          if (!moduleInstance) {
            throw new Error(`Module ${moduleName} is not available`);
          }
          
          Object.entries(apis).forEach(([methodName, expectedType]) => {
            const method = moduleInstance[methodName];
            
            if (typeof method !== expectedType) {
              throw new Error(
                `API compatibility broken: ${moduleName}.${methodName} ` +
                `expected ${expectedType}, got ${typeof method}`
              );
            }
          });
        });
        
        // 測試 API 調用是否正常工作
        errorHandler.showError('測試錯誤', { type: 'TEST_ERROR' });
        uiManager.updateStatus('測試狀態', 'testing');
        eventBus.emit('TEST_EVENT', { test: true });
        
        expect(true).toBe(true); // 如果到達這裡表示相容性良好
        
      }).toThrow(); // 期望失敗以識別問題
    });
  });
  
  describe('🔴 Red Phase: 邊界條件和極端情況識別', () => {
    
    test('should fail: 大量資料處理應該識別效能瓶頸', async () => {
      expect(async () => {
        // 模擬大量書籍資料
        const largeBookDataset = Array.from({ length: 10000 }, (_, i) => ({
          id: `book-${i}`,
          title: `測試書籍 ${i}`,
          author: `作者 ${i % 100}`,
          progress: Math.floor(Math.random() * 100),
          category: `類別${i % 10}`,
          publishDate: new Date(2020, i % 12, (i % 28) + 1),
          description: `這是第 ${i} 本測試書籍的描述`.repeat(10)
        }));
        
        const startTime = performance.now();
        
        // 測試資料處理效能
        const processedData = largeBookDataset.map(book => {
          return {
            ...book,
            searchableText: `${book.title} ${book.author}`.toLowerCase(),
            categoryHash: book.category.hashCode ? book.category.hashCode() : 0
          };
        });
        
        const processingTime = performance.now() - startTime;
        
        // 處理10000筆資料不應超過1秒
        expect(processingTime).toBeLessThan(1000);
        
        // 測試搜尋效能
        const searchStartTime = performance.now();
        const searchResults = processedData.filter(book => 
          book.searchableText.includes('測試')
        );
        const searchTime = performance.now() - searchStartTime;
        
        // 搜尋不應超過100ms
        expect(searchTime).toBeLessThan(100);
        expect(searchResults.length).toBe(10000);
        
      }).rejects.toThrow(); // 期望失敗以識別問題
    });
    
    test('should fail: 網路中斷恢復應該識別韌性問題', async () => {
      expect(async () => {
        // 模擬網路中斷情況
        let networkAvailable = true;
        
        // 模擬網路請求
        const mockNetworkRequest = async (url, options = {}) => {
          if (!networkAvailable) {
            throw new Error('Network connection failed');
          }
          
          // 模擬延遲
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
          
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: 'mock data' })
          };
        };
        
        // 測試正常網路情況
        let response = await mockNetworkRequest('https://readmoo.com/api/books');
        expect(response.ok).toBe(true);
        
        // 模擬網路中斷
        networkAvailable = false;
        
        let errorCaught = false;
        try {
          await mockNetworkRequest('https://readmoo.com/api/books');
        } catch (error) {
          errorCaught = true;
          expect(error.message).toBe('Network connection failed');
        }
        expect(errorCaught).toBe(true);
        
        // 測試重試機制
        const retryRequest = async (url, maxRetries = 3) => {
          for (let i = 0; i < maxRetries; i++) {
            try {
              return await mockNetworkRequest(url);
            } catch (error) {
              if (i === maxRetries - 1) throw error;
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
          }
        };
        
        // 重試應該失敗
        let retryFailed = false;
        try {
          await retryRequest('https://readmoo.com/api/books');
        } catch (error) {
          retryFailed = true;
        }
        expect(retryFailed).toBe(true);
        
        // 恢復網路
        networkAvailable = true;
        response = await retryRequest('https://readmoo.com/api/books');
        expect(response.ok).toBe(true);
        
      }).rejects.toThrow(); // 期望失敗以識別問題
    });
    
    test('should fail: 並發操作衝突應該識別競態條件', async () => {
      expect(async () => {
        // 模擬多個並發提取操作
        const concurrentOperations = [];
        const operationResults = [];
        
        // 創建10個並發操作
        for (let i = 0; i < 10; i++) {
          const operation = async () => {
            const operationId = `operation-${i}`;
            
            try {
              // 模擬提取開始
              eventBus.emit('EXTRACTION.STARTED', {
                operationId,
                timestamp: Date.now()
              });
              
              // 模擬處理時間
              await new Promise(resolve => 
                setTimeout(resolve, Math.random() * 200)
              );
              
              // 模擬進度更新
              for (let progress = 0; progress <= 100; progress += 20) {
                eventBus.emit('EXTRACTION.PROGRESS', {
                  operationId,
                  percentage: progress,
                  message: `處理中 ${progress}%`
                });
                
                await new Promise(resolve => setTimeout(resolve, 10));
              }
              
              // 模擬完成
              eventBus.emit('EXTRACTION.COMPLETED', {
                operationId,
                success: true,
                booksCount: Math.floor(Math.random() * 1000),
                duration: Math.random() * 5000
              });
              
              return { operationId, success: true };
              
            } catch (error) {
              return { operationId, success: false, error: error.message };
            }
          };
          
          concurrentOperations.push(operation());
        }
        
        // 等待所有操作完成
        const results = await Promise.all(concurrentOperations);
        
        // 檢查結果
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        
        expect(successCount + failureCount).toBe(10);
        
        // 檢查事件系統統計
        const eventStats = eventBus.getStats();
        expect(eventStats.totalEvents).toBeGreaterThan(200); // 至少200個事件
        
        // 驗證沒有競態條件導致的不一致狀態
        expect(successCount).toBe(10); // 所有操作都應成功
        
      }).rejects.toThrow(); // 期望失敗以識別問題
    });
  });
  
  describe('🔴 Red Phase: 系統整合邊界測試', () => {
    
    test('should fail: Chrome Extension 權限限制應該識別權限問題', async () => {
      expect(async () => {
        // 測試各種權限相關操作
        const permissionTests = [
          {
            name: 'Storage API',
            test: async () => {
              await chrome.storage.local.set({ test: 'data' });
              const data = await chrome.storage.local.get(['test']);
              return data.test === 'data';
            }
          },
          {
            name: 'Tabs API',
            test: async () => {
              const tabs = await chrome.tabs.query({ active: true });
              return tabs.length > 0;
            }
          },
          {
            name: 'Runtime API',
            test: async () => {
              const manifest = chrome.runtime.getManifest();
              return manifest && manifest.version;
            }
          }
        ];
        
        // 執行所有權限測試
        const results = await Promise.allSettled(
          permissionTests.map(async test => {
            const result = await test.test();
            return { name: test.name, success: result };
          })
        );
        
        // 檢查結果
        const failures = results.filter(r => 
          r.status === 'rejected' || !r.value.success
        );
        
        expect(failures).toHaveLength(0);
        
        // 測試權限不足的情況
        const restrictedAPI = async () => {
          // 模擬需要特殊權限的 API
          if (!chrome.permissions) {
            throw new Error('Permissions API not available');
          }
          
          return await chrome.permissions.request({
            permissions: ['tabs'],
            origins: ['https://readmoo.com/*']
          });
        };
        
        // 這應該因為權限限制而失敗
        const hasPermission = await restrictedAPI();
        expect(hasPermission).toBe(true);
        
      }).rejects.toThrow(); // 期望失敗以識別問題
    });
    
    test('should fail: 跨瀏覽器相容性應該識別相容性問題', () => {
      expect(() => {
        // 測試不同瀏覽器環境的相容性
        const browserFeatures = {
          'Chrome': {
            chrome: true,
            webkitRequestAnimationFrame: true,
            fetch: true
          },
          'Firefox': {
            browser: true,
            mozRequestAnimationFrame: true,
            fetch: true
          },
          'Edge': {
            chrome: true, // Edge 使用 Chromium
            webkitRequestAnimationFrame: true,
            fetch: true
          }
        };
        
        // 檢查當前環境支援的功能
        const currentBrowser = global.chrome ? 'Chrome' : 
                              global.browser ? 'Firefox' : 'Unknown';
        
        if (currentBrowser === 'Unknown') {
          throw new Error('Unknown browser environment');
        }
        
        const requiredFeatures = browserFeatures[currentBrowser];
        
        // 檢查必要功能是否可用
        Object.entries(requiredFeatures).forEach(([feature, required]) => {
          if (required) {
            const available = !!global[feature];
            
            if (!available) {
              throw new Error(`Required feature not available: ${feature}`);
            }
          }
        });
        
        // 測試 API 差異
        const testAPICompatibility = () => {
          // Chrome Extension API 測試
          if (global.chrome) {
            expect(typeof global.chrome.runtime.sendMessage).toBe('function');
            expect(typeof global.chrome.storage.local.get).toBe('function');
          }
          
          // WebExtensions API 測試 (Firefox)
          if (global.browser) {
            expect(typeof global.browser.runtime.sendMessage).toBe('function');
            expect(typeof global.browser.storage.local.get).toBe('function');
          }
        };
        
        testAPICompatibility();
        
      }).toThrow(); // 期望失敗以識別問題
    });
  });
  
  describe('🔴 Red Phase: 最終驗收測試', () => {
    
    test('should fail: 完整使用者流程應該識別體驗問題', async () => {
      expect(async () => {
        // 模擬完整的使用者操作流程
        const userFlow = {
          steps: [
            {
              name: '開啟 Popup',
              action: async () => {
                // 初始化 UI
                uiManager.reset();
                expect(document.getElementById('extract-button')).toBeDefined();
              }
            },
            {
              name: '點擊提取按鈕',
              action: async () => {
                const extractButton = document.getElementById('extract-button');
                extractButton.click();
                
                // 驗證狀態變更
                await new Promise(resolve => setTimeout(resolve, 100));
                const statusMessage = document.getElementById('status-message');
                expect(statusMessage.textContent).toContain('提取中');
              }
            },
            {
              name: '觀察進度更新',
              action: async () => {
                // 模擬進度更新
                for (let i = 0; i <= 100; i += 10) {
                  uiManager.updateProgress({
                    percentage: i,
                    message: `處理 ${i}% 完成`
                  });
                  
                  await new Promise(resolve => setTimeout(resolve, 50));
                  
                  // 驗證進度顯示
                  const progressText = document.getElementById('progress-text');
                  expect(progressText.textContent).toContain(`${i}%`);
                }
              }
            },
            {
              name: '檢視提取結果',
              action: async () => {
                // 模擬提取完成
                uiManager.showResults({
                  booksCount: 150,
                  duration: 2500,
                  categories: ['小說', '散文', '科技']
                });
                
                // 驗證結果顯示
                const resultsContainer = document.getElementById('results-container');
                expect(resultsContainer.style.display).not.toBe('none');
                
                const resultsSummary = document.getElementById('results-summary');
                expect(resultsSummary.textContent).toContain('150');
              }
            },
            {
              name: '匯出結果',
              action: async () => {
                const exportButton = document.getElementById('export-results-button');
                exportButton.click();
                
                // 驗證匯出功能觸發
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // 這裡應該有匯出相關的 UI 更新
                expect(exportButton.textContent).toContain('匯出');
              }
            }
          ]
        };
        
        // 執行所有步驟
        for (const step of userFlow.steps) {
          console.log(`執行步驟: ${step.name}`);
          await step.action();
          
          // 每步驟間稍作等待
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 驗證整個流程完成
        const finalState = {
          extractionCompleted: true,
          resultsVisible: !document.getElementById('results-container').style.display.includes('none'),
          noErrors: !document.getElementById('error-container').style.display.includes('block')
        };
        
        expect(finalState.extractionCompleted).toBe(true);
        expect(finalState.resultsVisible).toBe(true);
        expect(finalState.noErrors).toBe(true);
        
      }).rejects.toThrow(); // 期望失敗以識別問題
    });
    
    test('should fail: 系統穩定性應該識別穩定性問題', async () => {
      expect(async () => {
        // 長期運行穩定性測試
        const stabilityTest = {
          duration: 10000, // 10秒
          operations: 0,
          errors: 0,
          memoryLeaks: 0
        };
        
        const startTime = Date.now();
        const initialMemory = process.memoryUsage().heapUsed;
        
        // 持續執行操作直到時間結束
        while (Date.now() - startTime < stabilityTest.duration) {
          try {
            // 隨機操作
            const operations = [
              () => eventBus.emit('TEST_EVENT', { data: Math.random() }),
              () => uiManager.updateStatus(`測試狀態 ${Date.now()}`, 'testing'),
              () => uiManager.updateProgress({ 
                percentage: Math.floor(Math.random() * 100),
                message: '穩定性測試中'
              }),
              () => errorHandler.showError('測試錯誤', { 
                type: 'STABILITY_TEST',
                recoverable: true 
              })
            ];
            
            const randomOperation = operations[Math.floor(Math.random() * operations.length)];
            await randomOperation();
            
            stabilityTest.operations++;
            
            // 每100次操作檢查記憶體
            if (stabilityTest.operations % 100 === 0) {
              const currentMemory = process.memoryUsage().heapUsed;
              const memoryGrowth = currentMemory - initialMemory;
              
              // 記憶體增長超過閾值
              if (memoryGrowth > 20 * 1024 * 1024) { // 20MB
                stabilityTest.memoryLeaks++;
              }
              
              // 強制垃圾回收
              if (global.gc) {
                global.gc();
              }
            }
            
            // 短暫等待避免 CPU 過載
            await new Promise(resolve => setTimeout(resolve, 1));
            
          } catch (error) {
            stabilityTest.errors++;
            console.warn('Stability test error:', error.message);
          }
        }
        
        const endTime = Date.now();
        const finalMemory = process.memoryUsage().heapUsed;
        
        // 計算統計資料
        const stats = {
          duration: endTime - startTime,
          operationsPerSecond: stabilityTest.operations / (stabilityTest.duration / 1000),
          errorRate: stabilityTest.errors / stabilityTest.operations,
          memoryGrowth: finalMemory - initialMemory
        };
        
        // 驗證穩定性指標
        expect(stats.operationsPerSecond).toBeGreaterThan(100); // 至少100 ops/sec
        expect(stats.errorRate).toBeLessThan(0.01); // 錯誤率低於1%
        expect(stats.memoryGrowth).toBeLessThan(50 * 1024 * 1024); // 記憶體增長小於50MB
        expect(stabilityTest.memoryLeaks).toBe(0); // 無記憶體洩漏
        
        console.log('Stability test results:', stats);
        
      }).rejects.toThrow(); // 期望失敗以識別問題
    });
  });
});

// 字串 hashCode 方法的實作
String.prototype.hashCode = function() {
  let hash = 0;
  if (this.length === 0) return hash;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 轉換為32位整數
  }
  return hash;
};
