# 🧪 Chrome Extension 測試指南

> **閱讀時間**: 15 分鐘  
> **適用對象**: 需要寫 Chrome Extension 測試的開發者  
> **重要程度**: 🟡 P1 重要  
> **前置要求**: 已掌握 [測試金字塔實踐](./test-pyramid.md)

---

## 🎯 Chrome Extension 測試挑戰

### **Extension 環境的特殊性**

Chrome Extension 的多環境執行架構帶來獨特的測試挑戢：

```text
測試環境複雜性：
├── Background Service Worker (無 DOM，有 Chrome APIs)
├── Content Script (有 DOM，有限 Chrome APIs)  
├── Popup UI (有 DOM，有 Chrome APIs，短暫生命週期)
├── Options Page (有 DOM，有 Chrome APIs)
└── 跨環境通訊 (訊息傳遞，異步，序列化限制)
```

**傳統 Web 測試工具的限制**：
- ❌ **無法模擬 Chrome APIs**: `chrome.storage`、`chrome.runtime` 等
- ❌ **多環境隔離**: 無法測試跨環境通訊
- ❌ **權限限制**: Content Script 的沙盒環境
- ❌ **生命週期差異**: Background 持久 vs Popup 短暫

**Extension 特化測試策略**：
- ✅ **Chrome API Mock**: 完整的 Chrome Extension API 模擬
- ✅ **多環境測試**: 各環境獨立 + 整合測試
- ✅ **訊息傳遞測試**: 跨環境通訊專用測試模式
- ✅ **真實瀏覽器測試**: Puppeteer + Extension 載入

---

## 🔧 Chrome API Mock 系統

### **完整的 Chrome API 模擬**

```javascript
// chrome-api-mock.js - 完整的 Chrome Extension API 模擬
class ChromeAPIMock {
  constructor() {
    this.storage = new ChromeStorageMock();
    this.runtime = new ChromeRuntimeMock();
    this.tabs = new ChromeTabsMock();
    this.scripting = new ChromeScriptingMock();
    this.action = new ChromeActionMock();
    
    // 模擬全域 chrome 物件
    this.chrome = {
      storage: this.storage,
      runtime: this.runtime,
      tabs: this.tabs,
      scripting: this.scripting,
      action: this.action
    };
  }
  
  install() {
    global.chrome = this.chrome;
    return this;
  }
  
  reset() {
    this.storage.reset();
    this.runtime.reset();
    this.tabs.reset();
    this.scripting.reset();
    this.action.reset();
  }
  
  // 測試輔助方法
  expectStorageCall(method, args) {
    expect(this.storage[method]).toHaveBeenCalledWith(...args);
  }
  
  expectRuntimeMessage(message) {
    expect(this.runtime.sendMessage).toHaveBeenCalledWith(message);
  }
}

// ChromeStorageMock.js - Storage API 模擬
class ChromeStorageMock {
  constructor() {
    this.data = new Map();
    this.lastError = null;
    
    this.local = {
      get: jest.fn().mockImplementation(this.get.bind(this)),
      set: jest.fn().mockImplementation(this.set.bind(this)),
      remove: jest.fn().mockImplementation(this.remove.bind(this)),
      clear: jest.fn().mockImplementation(this.clear.bind(this))
    };
    
    this.sync = {
      get: jest.fn().mockImplementation(this.get.bind(this)),
      set: jest.fn().mockImplementation(this.set.bind(this)),
      remove: jest.fn().mockImplementation(this.remove.bind(this)),
      clear: jest.fn().mockImplementation(this.clear.bind(this))
    };
  }
  
  get(keys, callback) {
    setTimeout(() => {
      try {
        let result = {};
        
        if (typeof keys === 'string') {
          keys = [keys];
        } else if (keys === null || keys === undefined) {
          // 獲取所有資料
          result = Object.fromEntries(this.data);
          callback(result);
          return;
        }
        
        if (Array.isArray(keys)) {
          keys.forEach(key => {
            if (this.data.has(key)) {
              result[key] = this.data.get(key);
            }
          });
        } else if (typeof keys === 'object') {
          // 帶預設值的物件格式
          Object.keys(keys).forEach(key => {
            result[key] = this.data.has(key) 
              ? this.data.get(key) 
              : keys[key];
          });
        }
        
        callback(result);
      } catch (error) {
        this.lastError = { message: error.message };
        callback({});
      }
    }, 0);
  }
  
  set(items, callback) {
    setTimeout(() => {
      try {
        // 模擬儲存配額檢查
        const dataSize = JSON.stringify(items).length;
        if (dataSize > 5 * 1024 * 1024) { // 5MB 限制
          this.lastError = { message: 'QUOTA_EXCEEDED' };
          callback && callback();
          return;
        }
        
        Object.keys(items).forEach(key => {
          this.data.set(key, items[key]);
        });
        
        this.lastError = null;
        callback && callback();
      } catch (error) {
        this.lastError = { message: error.message };
        callback && callback();
      }
    }, 0);
  }
  
  remove(keys, callback) {
    setTimeout(() => {
      try {
        if (typeof keys === 'string') {
          keys = [keys];
        }
        
        keys.forEach(key => {
          this.data.delete(key);
        });
        
        this.lastError = null;
        callback && callback();
      } catch (error) {
        this.lastError = { message: error.message };
        callback && callback();
      }
    }, 0);
  }
  
  clear(callback) {
    setTimeout(() => {
      this.data.clear();
      this.lastError = null;
      callback && callback();
    }, 0);
  }
  
  reset() {
    this.data.clear();
    this.lastError = null;
    jest.clearAllMocks();
  }
  
  // 測試輔助方法
  setMockData(data) {
    this.data = new Map(Object.entries(data));
  }
  
  getMockData() {
    return Object.fromEntries(this.data);
  }
  
  simulateQuotaExceeded(exceed = true) {
    if (exceed) {
      this.set = jest.fn().mockImplementation((items, callback) => {
        setTimeout(() => {
          this.lastError = { message: 'QUOTA_EXCEEDED' };
          callback && callback();
        }, 0);
      });
    } else {
      this.set = jest.fn().mockImplementation(this.set.bind(this));
    }
  }
}

// ChromeRuntimeMock.js - Runtime API 模擬
class ChromeRuntimeMock {
  constructor() {
    this.id = 'test-extension-id';
    this.lastError = null;
    this.messageListeners = new Set();
    
    this.sendMessage = jest.fn().mockImplementation(this.mockSendMessage.bind(this));
    this.connect = jest.fn().mockImplementation(this.mockConnect.bind(this));
    
    this.onMessage = {
      addListener: jest.fn().mockImplementation(this.addMessageListener.bind(this)),
      removeListener: jest.fn().mockImplementation(this.removeMessageListener.bind(this)),
      hasListener: jest.fn()
    };
    
    this.onConnect = {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn()
    };
  }
  
  mockSendMessage(message, options, responseCallback) {
    setTimeout(() => {
      // 模擬回應
      const response = this.generateMockResponse(message);
      
      if (responseCallback) {
        responseCallback(response);
      }
    }, 0);
  }
  
  generateMockResponse(message) {
    // 根據訊息類型產生模擬回應
    if (message.type === 'PING') {
      return { type: 'PONG', timestamp: Date.now() };
    }
    
    if (message.type === 'GET_DATA') {
      return { 
        success: true, 
        data: { books: [] }
      };
    }
    
    return { success: true };
  }
  
  addMessageListener(listener) {
    this.messageListeners.add(listener);
  }
  
  removeMessageListener(listener) {
    this.messageListeners.delete(listener);
  }
  
  // 測試輔助方法
  simulateMessage(message, sender = {}, sendResponse = jest.fn()) {
    this.messageListeners.forEach(listener => {
      const result = listener(message, sender, sendResponse);
      
      // 如果監聽器返回 true，表示會異步回應
      if (result === true) {
        setTimeout(() => {
          sendResponse({ success: true, async: true });
        }, 10);
      }
    });
  }
  
  reset() {
    this.messageListeners.clear();
    this.lastError = null;
    jest.clearAllMocks();
  }
}
```

### **測試環境設置**

```javascript
// test-setup/extension-setup.js - Chrome Extension 測試環境設置
import { ChromeAPIMock } from './chrome-api-mock';

let chromeAPIMock;

// 全域設置
beforeEach(() => {
  chromeAPIMock = new ChromeAPIMock().install();
});

afterEach(() => {
  chromeAPIMock.reset();
  delete global.chrome;
});

// 測試工具函數
global.createExtensionTestEnvironment = (options = {}) => {
  return {
    chrome: chromeAPIMock,
    
    // 模擬儲存資料
    mockStorageData(data) {
      chromeAPIMock.storage.setMockData(data);
    },
    
    // 模擬訊息傳遞
    sendMockMessage(message, sender = {}) {
      return new Promise(resolve => {
        chromeAPIMock.runtime.simulateMessage(
          message, 
          sender, 
          resolve
        );
      });
    },
    
    // 驗證 Chrome API 調用
    expectStorageGet(key) {
      expect(chromeAPIMock.storage.local.get).toHaveBeenCalledWith(
        key, 
        expect.any(Function)
      );
    },
    
    expectStorageSet(data) {
      expect(chromeAPIMock.storage.local.set).toHaveBeenCalledWith(
        data, 
        expect.any(Function)
      );
    },
    
    expectMessageSent(message) {
      expect(chromeAPIMock.runtime.sendMessage).toHaveBeenCalledWith(message);
    }
  };
};

// Jest 配置
module.exports = {
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/extension-setup.js'
  ],
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'chrome-extension://test-id/popup.html'
  }
};
```

---

## 🎭 Background Service Worker 測試

### **Background 邏輯單元測試**

```javascript
// background/domains/data-management/coordinator.test.js
import { DataManagementCoordinator } from '../../../src/background/domains/data-management';

describe('DataManagementCoordinator - Background Tests', () => {
  let coordinator;
  let testEnv;
  
  beforeEach(() => {
    testEnv = createExtensionTestEnvironment();
    
    coordinator = new DataManagementCoordinator({
      storageAdapter: new StorageAdapter({ 
        storageArea: chrome.storage.local 
      }),
      logger: createMockLogger(),
      eventBus: createMockEventBus()
    });
  });
  
  describe('Chrome Storage integration', () => {
    it('should save books to Chrome Storage', async () => {
      // Arrange
      const books = [
        { id: '1', title: 'Test Book 1', author: 'Author 1' },
        { id: '2', title: 'Test Book 2', author: 'Author 2' }
      ];
      
      // Act
      const result = await coordinator.processBooks(books);
      
      // Assert
      expect(result.success).toBe(true);
      testEnv.expectStorageSet({
        'readmoo_books_data': expect.arrayContaining([
          expect.objectContaining({ title: 'Test Book 1' }),
          expect.objectContaining({ title: 'Test Book 2' })
        ])
      });
    });
    
    it('should handle Chrome Storage quota exceeded', async () => {
      // Arrange
      testEnv.chrome.storage.simulateQuotaExceeded(true);
      const largeBookSet = new Array(1000).fill(null).map((_, i) => ({
        id: `book-${i}`,
        title: `Large Book ${i}`,
        content: 'A'.repeat(1000) // 大量資料
      }));
      
      // Act
      const result = await coordinator.processBooks(largeBookSet);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('STORAGE_QUOTA_EXCEEDED');
    });
  });
  
  describe('Background message handling', () => {
    it('should respond to content script requests', async () => {
      // Arrange
      await coordinator.initialize();
      
      const requestMessage = {
        type: 'DATA_MANAGEMENT_REQUEST',
        operation: 'GET_BOOKS',
        payload: { limit: 10 }
      };
      
      // Act
      const response = await testEnv.sendMockMessage(
        requestMessage,
        { tab: { id: 123 } }
      );
      
      // Assert
      expect(response.success).toBe(true);
      expect(response.data).toBeInstanceOf(Array);
    });
    
    it('should handle invalid requests gracefully', async () => {
      // Arrange
      await coordinator.initialize();
      
      const invalidRequest = {
        type: 'INVALID_REQUEST',
        operation: 'UNKNOWN_OPERATION'
      };
      
      // Act
      const response = await testEnv.sendMockMessage(invalidRequest);
      
      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toEqual(
        expect.objectContaining({
          code: 'INVALID_REQUEST'
        })
      );
    });
  });
  
  describe('Background lifecycle', () => {
    it('should initialize correctly', async () => {
      // Act
      await coordinator.initialize();
      
      // Assert
      expect(coordinator.isInitialized()).toBe(true);
      
      // 驗證事件監聽器註冊
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });
    
    it('should cleanup resources on shutdown', async () => {
      // Arrange
      await coordinator.initialize();
      
      // Act
      await coordinator.shutdown();
      
      // Assert
      expect(coordinator.isInitialized()).toBe(false);
      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalled();
    });
  });
});
```

### **Service Worker 特殊情境測試**

```javascript
// background/service-worker-lifecycle.test.js
describe('Service Worker Lifecycle Tests', () => {
  let testEnv;
  
  beforeEach(() => {
    testEnv = createExtensionTestEnvironment();
  });
  
  it('should handle service worker restart', async () => {
    // Arrange - 模擬 Service Worker 啟動
    const backgroundScript = await import('../../../src/background/background.js');
    
    // 設置一些狀態
    testEnv.mockStorageData({
      'readmoo_books_data': [
        { id: '1', title: 'Existing Book' }
      ]
    });
    
    // Act - 觸發 Service Worker 重啟
    await backgroundScript.initialize();
    
    // Assert - 驗證狀態恢復
    const books = await backgroundScript.getBooks();
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('Existing Book');
  });
  
  it('should handle concurrent requests', async () => {
    // Arrange
    const coordinator = new DataManagementCoordinator({
      storageAdapter: new StorageAdapter({ 
        storageArea: chrome.storage.local 
      })
    });
    
    await coordinator.initialize();
    
    // Act - 同時發送多個請求
    const requests = Array.from({ length: 10 }, (_, i) => 
      testEnv.sendMockMessage({
        type: 'DATA_MANAGEMENT_REQUEST',
        operation: 'PROCESS_BOOKS',
        payload: { 
          books: [{ 
            id: `book-${i}`, 
            title: `Concurrent Book ${i}` 
          }] 
        }
      })
    );
    
    const responses = await Promise.all(requests);
    
    // Assert - 所有請求都成功處理
    responses.forEach((response, index) => {
      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(1);
      expect(response.data[0].title).toBe(`Concurrent Book ${index}`);
    });
  });
});
```

---

## 🎨 Content Script 測試

### **DOM 操作測試**

```javascript
// content/extractors/book-extractor.test.js
import { BookDataExtractor } from '../../../src/content/extractors/book-data-extractor';

describe('BookDataExtractor - Content Script Tests', () => {
  let extractor;
  let testEnv;
  
  beforeEach(() => {
    testEnv = createExtensionTestEnvironment();
    extractor = new BookDataExtractor();
    
    // 設置模擬的 DOM 環境
    document.body.innerHTML = createMockReadmooHTML();
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  describe('DOM extraction', () => {
    it('should extract books from Readmoo page', async () => {
      // Arrange
      const mockBooks = createMockReadmooHTML();
      document.body.innerHTML = mockBooks;
      
      // Act
      const books = await extractor.extractFromPage();
      
      // Assert
      expect(books).toHaveLength(5);
      expect(books[0]).toEqual(
        expect.objectContaining({
          title: expect.any(String),
          author: expect.any(String),
          price: expect.any(Number),
          isbn: expect.stringMatching(/^\d{10}$|^\d{13}$/)
        })
      );
    });
    
    it('should handle missing book elements', async () => {
      // Arrange
      document.body.innerHTML = '<div class="no-books">沒有書籍</div>';
      
      // Act & Assert
      await expect(extractor.extractFromPage())
        .rejects
        .toThrow('NO_BOOKS_FOUND');
    });
    
    it('should handle malformed book data', async () => {
      // Arrange
      document.body.innerHTML = `
        <div class="book-item">
          <h3 class="title"></h3>
          <span class="author"></span>
          <span class="price">無效價格</span>
        </div>
      `;
      
      // Act
      const books = await extractor.extractFromPage();
      
      // Assert
      expect(books).toHaveLength(0); // 無效資料被過濾
    });
  });
  
  describe('page detection', () => {
    it('should detect supported Readmoo pages', () => {
      // Arrange
      Object.defineProperty(window, 'location', {
        value: { href: 'https://readmoo.com/explore' },
        writable: true
      });
      
      // Act
      const isSupported = extractor.isSupportedPage();
      
      // Assert
      expect(isSupported).toBe(true);
    });
    
    it('should reject unsupported pages', () => {
      // Arrange
      Object.defineProperty(window, 'location', {
        value: { href: 'https://example.com' },
        writable: true
      });
      
      // Act
      const isSupported = extractor.isSupportedPage();
      
      // Assert
      expect(isSupported).toBe(false);
    });
  });
  
  describe('Content Script messaging', () => {
    it('should send extraction results to background', async () => {
      // Arrange
      document.body.innerHTML = createMockReadmooHTML();
      
      // Act
      const books = await extractor.extractFromPage();
      await extractor.sendToBackground(books);
      
      // Assert
      testEnv.expectMessageSent({
        type: 'EXTRACTION_COMPLETED',
        payload: {
          books: expect.any(Array),
          url: window.location.href,
          timestamp: expect.any(String)
        }
      });
    });
    
    it('should handle background communication errors', async () => {
      // Arrange
      testEnv.chrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('Background script not responding');
      });
      
      document.body.innerHTML = createMockReadmooHTML();
      
      // Act & Assert
      const books = await extractor.extractFromPage();
      await expect(extractor.sendToBackground(books))
        .rejects
        .toThrow('Background script not responding');
    });
  });
  
  // 測試工具函數
  function createMockReadmooHTML() {
    return `
      <div class="book-list">
        ${Array.from({ length: 5 }, (_, i) => `
          <div class="book-item" data-book-id="book-${i + 1}">
            <h3 class="title">JavaScript 權威指南 ${i + 1}</h3>
            <span class="author">David Flanagan</span>
            <span class="price" data-price="${(i + 1) * 100}">$${(i + 1) * 100}</span>
            <span class="isbn">97812345678${i}0</span>
            <a href="/book/${i + 1}" class="book-link">查看詳情</a>
          </div>
        `).join('')}
      </div>
    `;
  }
});
```

### **Content Script 注入測試**

```javascript
// content/content-script-injection.test.js  
describe('Content Script Injection Tests', () => {
  let testEnv;
  
  beforeEach(() => {
    testEnv = createExtensionTestEnvironment();
  });
  
  it('should inject content script correctly', async () => {
    // Arrange
    const mockTab = { id: 123, url: 'https://readmoo.com/explore' };
    
    // 模擬 chrome.scripting.executeScript
    testEnv.chrome.scripting = {
      executeScript: jest.fn().mockResolvedValue([{
        result: { 
          injected: true, 
          books: [
            { title: 'Test Book', author: 'Test Author' }
          ]
        }
      }])
    };
    
    // Act
    const result = await chrome.scripting.executeScript({
      target: { tabId: mockTab.id },
      files: ['content/content-modular.js']
    });
    
    // Assert
    expect(result[0].result.injected).toBe(true);
    expect(result[0].result.books).toHaveLength(1);
    expect(testEnv.chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: mockTab.id },
      files: ['content/content-modular.js']
    });
  });
  
  it('should handle injection failures', async () => {
    // Arrange
    testEnv.chrome.scripting = {
      executeScript: jest.fn().mockRejectedValue(
        new Error('Cannot access contents of url')
      )
    };
    
    // Act & Assert
    await expect(
      chrome.scripting.executeScript({
        target: { tabId: 123 },
        files: ['content/content-modular.js']
      })
    ).rejects.toThrow('Cannot access contents of url');
  });
});
```

---

## 🎪 Popup UI 測試

### **Popup 介面互動測試**

```javascript
// popup/popup-ui.test.js
import { PopupController } from '../../../src/popup/popup-controller';

describe('PopupController - UI Tests', () => {
  let controller;
  let testEnv;
  
  beforeEach(() => {
    testEnv = createExtensionTestEnvironment();
    
    // 設置 Popup HTML
    document.body.innerHTML = createMockPopupHTML();
    
    controller = new PopupController({
      eventBus: createMockEventBus()
    });
  });
  
  describe('UI interactions', () => {
    it('should handle extract button click', async () => {
      // Arrange
      await controller.initialize();
      const extractButton = document.getElementById('extract-button');
      
      testEnv.mockStorageData({
        'readmoo_books_data': []
      });
      
      // Act
      extractButton.click();
      
      // 等待異步操作
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Assert
      expect(testEnv.chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'START_EXTRACTION',
        payload: expect.any(Object)
      });
      
      const statusElement = document.querySelector('.extraction-status');
      expect(statusElement.textContent).toBe('正在提取書籍資料...');
    });
    
    it('should display book count from storage', async () => {
      // Arrange
      testEnv.mockStorageData({
        'readmoo_books_data': [
          { id: '1', title: 'Book 1' },
          { id: '2', title: 'Book 2' },
          { id: '3', title: 'Book 3' }
        ]
      });
      
      // Act
      await controller.initialize();
      
      // Assert
      const bookCountElement = document.querySelector('.book-count');
      expect(bookCountElement.textContent).toBe('已收集 3 本書籍');
    });
    
    it('should handle settings navigation', async () => {
      // Arrange
      await controller.initialize();
      const settingsButton = document.getElementById('settings-button');
      
      testEnv.chrome.runtime.openOptionsPage = jest.fn();
      
      // Act
      settingsButton.click();
      
      // Assert
      expect(testEnv.chrome.runtime.openOptionsPage).toHaveBeenCalled();
    });
  });
  
  describe('real-time updates', () => {
    it('should update UI when extraction completes', async () => {
      // Arrange
      await controller.initialize();
      
      // Act - 模擬從 background 接收完成訊息
      testEnv.chrome.runtime.simulateMessage({
        type: 'EXTRACTION_COMPLETED',
        payload: {
          books: [
            { id: '1', title: 'New Book 1' },
            { id: '2', title: 'New Book 2' }
          ],
          totalCount: 2
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Assert
      const statusElement = document.querySelector('.extraction-status');
      expect(statusElement.textContent).toBe('提取完成');
      
      const bookCountElement = document.querySelector('.book-count');
      expect(bookCountElement.textContent).toBe('已收集 2 本書籍');
    });
    
    it('should show error messages', async () => {
      // Arrange
      await controller.initialize();
      
      // Act
      testEnv.chrome.runtime.simulateMessage({
        type: 'EXTRACTION_FAILED',
        payload: {
          error: {
            code: 'PAGE_NOT_SUPPORTED',
            message: '不支援的網站'
          }
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Assert
      const errorElement = document.querySelector('.error-message');
      expect(errorElement.textContent).toBe('不支援的網站');
      expect(errorElement.classList.contains('visible')).toBe(true);
    });
  });
  
  function createMockPopupHTML() {
    return `
      <div class="popup-container">
        <div class="header">
          <h1>Readmoo 書庫管理器</h1>
          <button id="settings-button">設定</button>
        </div>
        
        <div class="status-section">
          <div class="book-count">已收集 0 本書籍</div>
          <div class="extraction-status"></div>
          <div class="error-message"></div>
        </div>
        
        <div class="action-section">
          <button id="extract-button" class="primary">提取書籍</button>
          <button id="view-books-button">查看書籍</button>
        </div>
      </div>
    `;
  }
});
```

### **Popup 生命週期測試**

```javascript
// popup/popup-lifecycle.test.js
describe('Popup Lifecycle Tests', () => {
  let testEnv;
  
  beforeEach(() => {
    testEnv = createExtensionTestEnvironment();
    document.body.innerHTML = createMockPopupHTML();
  });
  
  it('should initialize popup correctly', async () => {
    // Arrange
    const controller = new PopupController({
      eventBus: createMockEventBus()
    });
    
    // Act
    await controller.initialize();
    
    // Assert
    expect(controller.isInitialized()).toBe(true);
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    
    // 驗證 UI 元素事件監聽
    const extractButton = document.getElementById('extract-button');
    expect(extractButton.onclick).toBeDefined();
  });
  
  it('should cleanup on popup close', async () => {
    // Arrange
    const controller = new PopupController({
      eventBus: createMockEventBus()
    });
    await controller.initialize();
    
    // Act - 模擬 popup 關閉
    window.dispatchEvent(new Event('beforeunload'));
    
    // Assert
    expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalled();
  });
  
  it('should handle popup reopening', async () => {
    // Arrange
    testEnv.mockStorageData({
      'readmoo_books_data': [{ id: '1', title: 'Existing Book' }]
    });
    
    const controller = new PopupController({
      eventBus: createMockEventBus()
    });
    
    // Act
    await controller.initialize();
    
    // Assert - 驗證資料從 storage 正確載入
    const bookCountElement = document.querySelector('.book-count');
    expect(bookCountElement.textContent).toBe('已收集 1 本書籍');
  });
});
```

---

## 🔌 跨環境通訊測試

### **訊息傳遞整合測試**

```javascript
// integration/cross-context-communication.test.js
describe('Cross-Context Communication Tests', () => {
  let backgroundController;
  let contentController;  
  let popupController;
  let testEnv;
  
  beforeEach(() => {
    testEnv = createExtensionTestEnvironment();
    
    // 初始化各環境控制器
    backgroundController = new BackgroundController({
      eventBus: createMockEventBus()
    });
    
    contentController = new ContentController({
      eventBus: createMockEventBus()
    });
    
    popupController = new PopupController({
      eventBus: createMockEventBus()
    });
  });
  
  it('should complete full extraction workflow', async () => {
    // Phase 1: Popup 發起提取請求
    await popupController.initialize();
    document.body.innerHTML = createMockPopupHTML();
    
    // Phase 2: Background 處理請求並轉發給 Content Script
    await backgroundController.initialize();
    
    // Phase 3: Content Script 執行提取並回報結果
    document.body.innerHTML = createMockReadmooHTML();
    await contentController.initialize();
    
    // 模擬完整流程
    const extractButton = document.getElementById('extract-button');
    extractButton.click();
    
    // 等待異步處理
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 驗證訊息傳遞鏈
    expect(testEnv.chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'START_EXTRACTION',
      payload: expect.any(Object)
    });
    
    // 模擬 Content Script 回應
    testEnv.chrome.runtime.simulateMessage({
      type: 'EXTRACTION_COMPLETED',
      payload: {
        books: [
          { title: 'Book 1', author: 'Author 1' },
          { title: 'Book 2', author: 'Author 2' }
        ],
        source: 'content-script'
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // 驗證 Popup UI 更新
    const bookCount = document.querySelector('.book-count');
    expect(bookCount.textContent).toBe('已收集 2 本書籍');
  });
  
  it('should handle communication failures gracefully', async () => {
    // Arrange
    await backgroundController.initialize();
    await popupController.initialize();
    
    // 模擬 Background Script 無回應
    testEnv.chrome.runtime.sendMessage.mockImplementation(() => {
      // 不調用 callback，模擬無回應
    });
    
    document.body.innerHTML = createMockPopupHTML();
    
    // Act
    const extractButton = document.getElementById('extract-button');
    extractButton.click();
    
    // 等待超時
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Assert
    const errorElement = document.querySelector('.error-message');
    expect(errorElement.textContent).toMatch(/通訊超時|無回應/);
  });
  
  it('should handle concurrent requests from multiple sources', async () => {
    // Arrange
    await backgroundController.initialize();
    
    const requests = [
      {
        type: 'GET_BOOKS',
        source: 'popup'
      },
      {
        type: 'EXTRACT_BOOKS',  
        source: 'content-script'
      },
      {
        type: 'UPDATE_SETTINGS',
        source: 'options-page'
      }
    ];
    
    // Act
    const responses = await Promise.all(
      requests.map(request => 
        testEnv.sendMockMessage(request)
      )
    );
    
    // Assert
    responses.forEach(response => {
      expect(response.success).toBe(true);
    });
  });
});
```

---

## 🚀 真實瀏覽器測試 (E2E)

### **Puppeteer + Extension 整合**

```javascript
// e2e/extension-e2e.test.js
import puppeteer from 'puppeteer';
import path from 'path';

describe('Chrome Extension E2E Tests', () => {
  let browser;
  let page;
  const extensionPath = path.join(__dirname, '../../dist');
  
  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox'
      ]
    });
  });
  
  afterAll(async () => {
    await browser.close();
  });
  
  beforeEach(async () => {
    page = await browser.newPage();
  });
  
  afterEach(async () => {
    await page.close();
  });
  
  it('should extract books from real Readmoo page', async () => {
    // 導航到測試頁面
    await page.goto('https://readmoo.com/explore', {
      waitUntil: 'networkidle2'
    });
    
    // 等待書籍元素載入
    await page.waitForSelector('.book-item', { timeout: 5000 });
    
    // 獲取擴展 ID
    const extensionId = await getExtensionId(browser);
    
    // 開啟 Popup
    const popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // 點擊提取按鈕
    await popupPage.waitForSelector('#extract-button');
    await popupPage.click('#extract-button');
    
    // 等待提取完成
    await popupPage.waitForSelector('.extraction-success', { timeout: 15000 });
    
    // 驗證結果
    const resultText = await popupPage.$eval(
      '.extraction-result', 
      el => el.textContent
    );
    
    expect(resultText).toMatch(/成功提取 \d+ 本書籍/);
    
    // 驗證資料儲存到 Chrome Storage
    const storedData = await popupPage.evaluate(() => {
      return new Promise(resolve => {
        chrome.storage.local.get(['readmoo_books_data'], result => {
          resolve(result.readmoo_books_data);
        });
      });
    });
    
    expect(storedData).toBeInstanceOf(Array);
    expect(storedData.length).toBeGreaterThan(0);
    
    await popupPage.close();
  });
  
  it('should handle unsupported pages', async () => {
    // 導航到不支援的頁面
    await page.goto('https://example.com');
    
    const extensionId = await getExtensionId(browser);
    const popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // 點擊提取按鈕
    await popupPage.click('#extract-button');
    
    // 等待錯誤訊息
    await popupPage.waitForSelector('.extraction-error', { timeout: 10000 });
    
    const errorText = await popupPage.$eval(
      '.extraction-error',
      el => el.textContent
    );
    
    expect(errorText).toMatch(/不支援的網站/);
    
    await popupPage.close();
  });
  
  async function getExtensionId(browser) {
    const targets = await browser.targets();
    const extensionTarget = targets.find(target => 
      target.type() === 'service_worker'
    );
    
    if (extensionTarget) {
      const url = extensionTarget.url();
      return url.split('/')[2];
    }
    
    throw new Error('Extension not found');
  }
});
```

---

## 🎯 測試策略總結

### **分層測試覆蓋**

| 測試層級 | Background | Content Script | Popup | 跨環境通訊 |
|----------|------------|----------------|--------|------------|
| **單元測試** | ✅ 業務邏輯<br/>✅ Chrome API Mock | ✅ DOM 操作<br/>✅ 資料提取 | ✅ UI 互動<br/>✅ 狀態管理 | ❌ |
| **整合測試** | ✅ Storage 整合<br/>✅ 訊息處理 | ✅ 注入測試<br/>✅ 頁面檢測 | ✅ 生命週期<br/>✅ 即時更新 | ✅ 跨環境協作 |
| **E2E 測試** | ✅ 真實環境運行 | ✅ 真實頁面提取 | ✅ 用戶流程 | ✅ 完整工作流 |

### **Chrome Extension 特殊測試點**

- [ ] **權限管理**: 測試各種權限情況下的行為
- [ ] **儲存配額**: 測試接近和超過儲存限制的情況
- [ ] **網頁相容性**: 測試各種網頁結構和動態載入
- [ ] **擴展生命週期**: 測試安裝、啟用、停用、更新流程
- [ ] **跨瀏覽器**: 測試 Chrome 不同版本的相容性

---

## 🔄 下一步學習

掌握 Chrome Extension 測試後，建議深入：

1. **🔧 [測試工具鏈](./testing-tools.md)** - Jest、Puppeteer、Mock 工具配置
2. **🚑 [Extension 特殊問題](../../03-reference/troubleshooting/extension-specific-issues.md)** - Extension 開發常見問題
3. **⚡ [效能測試方法](../../03-reference/performance/performance-testing.md)** - Extension 效能測試

---

**🎯 學習成果驗證**: 能夠為 Chrome Extension 的各個環境編寫完整的測試，包括單元測試、整合測試和 E2E 測試。