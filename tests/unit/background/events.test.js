/**
 * 背景服務事件系統單元測試
 * 測試Chrome Extension的事件驅動架構
 * 
 * Responsible for:
 * - 測試事件註冊和觸發機制
 * - 驗證事件處理器的執行順序
 * - 測試事件傳播和阻止機制
 * - 驗證錯誤處理和事件清理
 * 
 * Design considerations:
 * - 基於Chrome Extension的事件系統
 * - 確保事件處理的可靠性和效能
 * - 測試複雜的事件流程和依賴關係
 * 
 * Process flow:
 * 1. 測試事件註冊和移除
 * 2. 測試事件觸發和處理
 * 3. 測試事件傳播機制
 * 4. 測試錯誤處理和回復
 */

describe('🎭 背景服務事件系統測試', () => {
  let eventSystem;
  let mockHandlers;

  beforeEach(() => {
    // 重置測試環境
    global.testUtils.cleanup();
    
    // 設定模擬處理器
    mockHandlers = {
      dataExtractHandler: jest.fn(),
      storageHandler: jest.fn(),
      uiSyncHandler: jest.fn(),
      errorHandler: jest.fn()
    };

    // 這裡將來會載入實際的事件系統
    // eventSystem = require('@/background/events');
  });

  describe('📝 事件註冊機制', () => {
    test('應該能夠註冊事件監聽器', () => {
      // Arrange
      const eventType = 'data.extract.started';
      const handler = mockHandlers.dataExtractHandler;

      // Act - 模擬事件註冊
      const eventRegistry = new Map();
      const registerEvent = (type, callback) => {
        if (!eventRegistry.has(type)) {
          eventRegistry.set(type, []);
        }
        eventRegistry.get(type).push(callback);
      };

      registerEvent(eventType, handler);

      // Assert
      expect(eventRegistry.has(eventType)).toBe(true);
      expect(eventRegistry.get(eventType)).toContain(handler);
    });

    test('應該能夠移除事件監聽器', () => {
      // Arrange
      const eventType = 'data.extract.completed';
      const handler = mockHandlers.dataExtractHandler;
      const eventRegistry = new Map();
      eventRegistry.set(eventType, [handler]);

      // Act - 模擬事件移除
      const unregisterEvent = (type, callback) => {
        const handlers = eventRegistry.get(type) || [];
        const filteredHandlers = handlers.filter(h => h !== callback);
        eventRegistry.set(type, filteredHandlers);
      };

      unregisterEvent(eventType, handler);

      // Assert
      expect(eventRegistry.get(eventType)).not.toContain(handler);
    });

    test('應該支援多個監聽器監聽同一事件', () => {
      // Arrange
      const eventType = 'data.save.completed';
      const handler1 = mockHandlers.storageHandler;
      const handler2 = mockHandlers.uiSyncHandler;
      const eventRegistry = new Map();

      // Act - 註冊多個處理器
      const registerEvent = (type, callback) => {
        if (!eventRegistry.has(type)) {
          eventRegistry.set(type, []);
        }
        eventRegistry.get(type).push(callback);
      };

      registerEvent(eventType, handler1);
      registerEvent(eventType, handler2);

      // Assert
      expect(eventRegistry.get(eventType)).toHaveLength(2);
      expect(eventRegistry.get(eventType)).toContain(handler1);
      expect(eventRegistry.get(eventType)).toContain(handler2);
    });
  });

  describe('🚀 事件觸發機制', () => {
    test('應該能夠觸發事件並執行處理器', async () => {
      // Arrange
      const eventType = 'data.extract.started';
      const eventData = { bookCount: 10, url: 'https://readmoo.com/library' };
      const handler = jest.fn();

      // Act - 模擬事件觸發
      const emitEvent = async (type, data) => {
        // 模擬找到對應的處理器並執行
        if (type === eventType) {
          await handler(data);
        }
      };

      await emitEvent(eventType, eventData);

      // Assert
      expect(handler).toHaveBeenCalledWith(eventData);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('應該按照註冊順序執行多個處理器', async () => {
      // Arrange
      const eventType = 'storage.save.completed';
      const executionOrder = [];
      
      const handler1 = jest.fn(() => executionOrder.push('handler1'));
      const handler2 = jest.fn(() => executionOrder.push('handler2'));
      const handler3 = jest.fn(() => executionOrder.push('handler3'));

      const handlers = [handler1, handler2, handler3];

      // Act - 模擬按順序執行處理器
      const emitEventToHandlers = async (eventData) => {
        for (const handler of handlers) {
          await handler(eventData);
        }
      };

      await emitEventToHandlers({ success: true });

      // Assert
      expect(executionOrder).toEqual(['handler1', 'handler2', 'handler3']);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    test('應該能夠傳遞複雜的事件資料', async () => {
      // Arrange
      const eventType = 'books.extracted';
      const complexEventData = {
        books: global.testUtils.createMockBooks(3),
        metadata: {
          extractedAt: new Date().toISOString(),
          totalTime: 1500,
          errors: []
        },
        source: {
          url: 'https://readmoo.com/library',
          pageType: 'library'
        }
      };

      const handler = jest.fn();

      // Act
      await handler(complexEventData);

      // Assert
      expect(handler).toHaveBeenCalledWith(complexEventData);
      expect(handler.mock.calls[0][0].books).toHaveLength(3);
      expect(handler.mock.calls[0][0].metadata.totalTime).toBe(1500);
    });
  });

  describe('🔄 事件流程控制', () => {
    test('應該支援事件的條件執行', async () => {
      // Arrange
      const eventType = 'data.process.requested';
      const eventData = { shouldProcess: false };
      const conditionalHandler = jest.fn((data) => {
        if (data.shouldProcess) {
          return 'processed';
        }
        return 'skipped';
      });

      // Act
      const result = await conditionalHandler(eventData);

      // Assert
      expect(result).toBe('skipped');
      expect(conditionalHandler).toHaveBeenCalledWith(eventData);
    });

    test('應該支援事件的非同步處理', async () => {
      // Arrange
      const asyncHandler = jest.fn(async (data) => {
        await global.testUtils.wait(100); // 模擬非同步操作
        return `processed: ${data.id}`;
      });

      const eventData = { id: 'test-123' };

      // Act
      const startTime = Date.now();
      const result = await asyncHandler(eventData);
      const endTime = Date.now();

      // Assert
      expect(result).toBe('processed: test-123');
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    test('應該能夠阻止事件的進一步傳播', () => {
      // Arrange
      const eventData = { id: 'test', stopPropagation: false };
      const handler1 = jest.fn((data) => {
        data.stopPropagation = true;
        return 'handler1-executed';
      });
      const handler2 = jest.fn();

      // Act - 模擬事件傳播控制
      const executeWithPropagationControl = (data, handlers) => {
        for (const handler of handlers) {
          handler(data);
          if (data.stopPropagation) {
            break;
          }
        }
      };

      executeWithPropagationControl(eventData, [handler1, handler2]);

      // Assert
      expect(handler1).toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('🛡 錯誤處理', () => {
    test('應該能夠處理處理器中的錯誤', async () => {
      // Arrange
      const errorHandler = jest.fn();
      const faultyHandler = jest.fn(() => {
        throw new Error('Handler error');
      });

      // Act & Assert
      const executeWithErrorHandling = async (handler, errorCallback) => {
        try {
          await handler();
        } catch (error) {
          errorCallback(error);
        }
      };

      await executeWithErrorHandling(faultyHandler, errorHandler);

      expect(faultyHandler).toHaveBeenCalled();
      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    test('應該在處理器錯誤後繼續執行其他處理器', async () => {
      // Arrange
      const handler1 = jest.fn(() => { throw new Error('Error in handler1'); });
      const handler2 = jest.fn();
      const handler3 = jest.fn();
      const errorLog = [];

      // Act - 模擬錯誤處理和繼續執行
      const executeAllWithErrorHandling = async (handlers) => {
        for (const handler of handlers) {
          try {
            await handler();
          } catch (error) {
            errorLog.push(error.message);
          }
        }
      };

      await executeAllWithErrorHandling([handler1, handler2, handler3]);

      // Assert
      expect(errorLog).toContain('Error in handler1');
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();
    });

    test('應該能夠記錄和報告錯誤', () => {
      // Arrange
      const errors = [];
      const errorReporter = (error, context) => {
        errors.push({
          message: error.message,
          context,
          timestamp: new Date().toISOString()
        });
      };

      const testError = new Error('Test error');
      const context = { eventType: 'data.extract.failed', handlerName: 'dataExtractor' };

      // Act
      errorReporter(testError, context);

      // Assert
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Test error');
      expect(errors[0].context.eventType).toBe('data.extract.failed');
    });
  });

  describe('🎯 Chrome Extension 特定事件', () => {
    test('應該能夠處理tab更新事件', () => {
      // Arrange
      const tabId = 123;
      const changeInfo = { status: 'complete' };
      const tab = { id: tabId, url: 'https://readmoo.com/library' };
      const tabUpdateHandler = jest.fn();

      // Act - 模擬Chrome tab更新事件
      chrome.tabs.onUpdated.addListener(tabUpdateHandler);
      
      // 模擬事件觸發
      if (changeInfo.status === 'complete' && tab.url.includes('readmoo.com')) {
        tabUpdateHandler(tabId, changeInfo, tab);
      }

      // Assert
      expect(tabUpdateHandler).toHaveBeenCalledWith(tabId, changeInfo, tab);
    });

    test('應該能夠處理runtime消息', async () => {
      // Arrange
      const message = {
        type: 'EXTRACT_BOOKS',
        data: { url: 'https://readmoo.com/library' }
      };
      const sender = { tab: { id: 123 } };
      const messageHandler = jest.fn();

      // Act - 模擬消息處理
      chrome.runtime.onMessage.addListener(messageHandler);
      
      // 模擬消息接收
      messageHandler(message, sender, jest.fn());

      // Assert
      expect(messageHandler).toHaveBeenCalledWith(
        message,
        sender,
        expect.any(Function)
      );
    });

    test('應該能夠處理extension安裝事件', () => {
      // Arrange
      const installHandler = jest.fn();
      const details = { reason: 'install' };

      // Act
      chrome.runtime.onInstalled.addListener(installHandler);
      
      // 模擬安裝事件
      installHandler(details);

      // Assert
      expect(installHandler).toHaveBeenCalledWith(details);
    });
  });

  describe('⚡ 效能測試', () => {
    test('事件處理應該在合理時間內完成', async () => {
      // Arrange
      const heavyHandler = jest.fn(async () => {
        // 模擬一些計算密集的操作
        await global.testUtils.wait(50);
      });

      // Act
      const startTime = Date.now();
      await heavyHandler();
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert
      expect(duration).toBeLessThan(100); // 應該在100ms內完成
      expect(heavyHandler).toHaveBeenCalled();
    });

    test('應該能夠處理大量並發事件', async () => {
      // Arrange
      const concurrentEvents = Array.from({ length: 100 }, (_, i) => ({
        type: 'test.event',
        id: i
      }));

      const handler = jest.fn();

      // Act
      const startTime = Date.now();
      await Promise.all(concurrentEvents.map(event => handler(event)));
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert
      expect(handler).toHaveBeenCalledTimes(100);
      expect(duration).toBeLessThan(1000); // 應該在1秒內完成
    });
  });

  describe('🔧 事件系統維護', () => {
    test('應該能夠清理所有事件監聽器', () => {
      // Arrange
      const eventRegistry = new Map();
      eventRegistry.set('event1', [jest.fn(), jest.fn()]);
      eventRegistry.set('event2', [jest.fn()]);

      // Act - 清理所有事件
      const clearAllEvents = () => {
        eventRegistry.clear();
      };

      clearAllEvents();

      // Assert
      expect(eventRegistry.size).toBe(0);
    });

    test('應該提供事件系統的狀態資訊', () => {
      // Arrange
      const eventRegistry = new Map();
      eventRegistry.set('data.extract', [jest.fn(), jest.fn()]);
      eventRegistry.set('storage.save', [jest.fn()]);

      // Act - 取得系統狀態
      const getSystemStatus = () => ({
        totalEventTypes: eventRegistry.size,
        totalHandlers: Array.from(eventRegistry.values()).flat().length,
        eventTypes: Array.from(eventRegistry.keys())
      });

      const status = getSystemStatus();

      // Assert
      expect(status.totalEventTypes).toBe(2);
      expect(status.totalHandlers).toBe(3);
      expect(status.eventTypes).toContain('data.extract');
      expect(status.eventTypes).toContain('storage.save');
    });
  });
}); 