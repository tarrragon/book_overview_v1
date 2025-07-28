/**
 * 事件總線核心單元測試
 * 測試整個事件系統的核心功能
 * 
 * 負責功能：
 * - 測試事件註冊和移除機制
 * - 驗證事件觸發和傳播機制
 * - 測試事件優先級處理
 * - 驗證錯誤處理和隔離機制
 * - 測試效能和記憶體管理
 * 
 * 設計考量：
 * - 基於Observer模式的事件總線
 * - 支援優先級和非同步處理
 * - 確保錯誤隔離和系統穩定性
 * - 提供詳細的執行統計和調試資訊
 * 
 * 處理流程：
 * 1. 測試基本事件註冊和移除
 * 2. 測試事件觸發和處理器執行
 * 3. 測試優先級和順序控制
 * 4. 測試錯誤處理和復原機制
 * 5. 測試效能和統計功能
 * 
 * 使用情境：
 * - 所有模組都需要通過EventBus進行通訊
 * - Chrome Extension的background、content-script、popup都使用此系統
 * - 資料提取、儲存、UI更新等都基於事件驅動
 */

describe('🎭 事件總線核心測試', () => {
  let eventBus;

  beforeEach(() => {
    // 重置測試環境
    global.testUtils.cleanup();
    
    // 這裡將會載入實際的EventBus
    // eventBus = new EventBus();
  });

  afterEach(() => {
    // 清理事件總線
    if (eventBus && typeof eventBus.destroy === 'function') {
      eventBus.destroy();
    }
  });

  describe('📝 事件註冊機制', () => {
    test('應該能夠註冊事件監聽器', () => {
      // Arrange
      const EventBus = require('@/core/event-bus'); // 這會失敗，因為檔案不存在
      eventBus = new EventBus();
      
      const eventType = 'data.extract.started';
      const handler = jest.fn();

      // Act
      eventBus.on(eventType, handler);

      // Assert
      expect(eventBus.hasListener(eventType)).toBe(true);
      expect(eventBus.getListenerCount(eventType)).toBe(1);
    });

    test('應該能夠註冊多個監聽器到同一事件', () => {
      // Arrange
      const EventBus = require('@/core/event-bus');
      eventBus = new EventBus();
      
      const eventType = 'storage.save.completed';
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      // Act
      eventBus.on(eventType, handler1);
      eventBus.on(eventType, handler2);
      eventBus.on(eventType, handler3);

      // Assert
      expect(eventBus.getListenerCount(eventType)).toBe(3);
    });

    test('應該能夠移除特定的事件監聽器', () => {
      // Arrange
      const EventBus = require('@/core/event-bus');
      eventBus = new EventBus();
      
      const eventType = 'ui.popup.opened';
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.on(eventType, handler1);
      eventBus.on(eventType, handler2);

      // Act
      eventBus.off(eventType, handler1);

      // Assert
      expect(eventBus.getListenerCount(eventType)).toBe(1);
    });

    test('應該能夠移除事件類型的所有監聽器', () => {
      // Arrange
      const EventBus = require('@/core/event-bus');
      eventBus = new EventBus();
      
      const eventType = 'data.extract.failed';
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.on(eventType, handler1);
      eventBus.on(eventType, handler2);

      // Act
      eventBus.removeAllListeners(eventType);

      // Assert
      expect(eventBus.getListenerCount(eventType)).toBe(0);
      expect(eventBus.hasListener(eventType)).toBe(false);
    });

    test('應該支援一次性事件監聽器', async () => {
      // Arrange
      const EventBus = require('@/core/event-bus');
      eventBus = new EventBus();
      
      const eventType = 'system.startup.completed';
      const handler = jest.fn();

      // Act
      eventBus.once(eventType, handler);

      // Assert
      expect(eventBus.getListenerCount(eventType)).toBe(1);
      
      // 觸發事件
      await eventBus.emit(eventType, { data: 'test' });
      
      // 檢查監聽器是否被自動移除
      expect(eventBus.getListenerCount(eventType)).toBe(0);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('🚀 事件觸發機制', () => {
    test('應該能夠觸發事件並執行監聽器', () => {
      // Arrange
      const EventBus = require('@/core/event-bus');
      eventBus = new EventBus();
      
      const eventType = 'data.extract.progress';
      const eventData = { progress: 50, total: 100 };
      const handler = jest.fn();

      eventBus.on(eventType, handler);

      // Act
      eventBus.emit(eventType, eventData);

      // Assert
      expect(handler).toHaveBeenCalledWith(eventData);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('應該按照註冊順序執行多個監聽器', async () => {
      // Arrange
      const EventBus = require('@/core/event-bus');
      eventBus = new EventBus();
      
      const eventType = 'storage.load.completed';
      const executionOrder = [];
      
      const handler1 = jest.fn(() => executionOrder.push('handler1'));
      const handler2 = jest.fn(() => executionOrder.push('handler2'));
      const handler3 = jest.fn(() => executionOrder.push('handler3'));

      eventBus.on(eventType, handler1);
      eventBus.on(eventType, handler2);
      eventBus.on(eventType, handler3);

      // Act
      await eventBus.emit(eventType, { data: 'test' });

      // Assert
      expect(executionOrder).toEqual(['handler1', 'handler2', 'handler3']);
    });

    test('應該支援非同步事件處理', async () => {
      // Arrange
      const EventBus = require('@/core/event-bus');
      eventBus = new EventBus();
      
      const eventType = 'ui.export.requested';
      const asyncHandler = jest.fn(async (data) => {
        // 模擬非同步操作
        await new Promise(resolve => setTimeout(resolve, 10));
        return { processed: true, data };
      });

      eventBus.on(eventType, asyncHandler);

      // Act
      const results = await eventBus.emit(eventType, { format: 'csv' });

      // Assert
      expect(asyncHandler).toHaveBeenCalledWith({ format: 'csv' });
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ processed: true, data: { format: 'csv' } });
    });
  });

  describe('⚡ 事件優先級處理', () => {
    test('應該支援事件優先級', async () => {
      // Arrange
      const EventBus = require('@/core/event-bus');
      eventBus = new EventBus();
      
      const eventType = 'system.error.critical';
      const executionOrder = [];
      
      const lowPriorityHandler = jest.fn(() => executionOrder.push('low'));
      const highPriorityHandler = jest.fn(() => executionOrder.push('high'));
      const criticalPriorityHandler = jest.fn(() => executionOrder.push('critical'));

      // Act - 故意以非優先級順序註冊
      eventBus.on(eventType, lowPriorityHandler, { priority: 3 });
      eventBus.on(eventType, criticalPriorityHandler, { priority: 0 });
      eventBus.on(eventType, highPriorityHandler, { priority: 1 });

      await eventBus.emit(eventType, { error: 'test' });

      // Assert - 應該按照優先級順序執行
      expect(executionOrder).toEqual(['critical', 'high', 'low']);
    });
  });

  describe('🛡 錯誤處理機制', () => {
    test('應該隔離錯誤，不影響其他監聽器', async () => {
      // Arrange
      const EventBus = require('@/core/event-bus');
      eventBus = new EventBus();
      
      const eventType = 'data.validation.failed';
      const workingHandler = jest.fn();
      const errorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      const anotherWorkingHandler = jest.fn();

      eventBus.on(eventType, workingHandler);
      eventBus.on(eventType, errorHandler);
      eventBus.on(eventType, anotherWorkingHandler);

      // Act
      await eventBus.emit(eventType, { data: 'test' });

      // Assert
      expect(workingHandler).toHaveBeenCalled();
      expect(anotherWorkingHandler).toHaveBeenCalled();
      expect(errorHandler).toHaveBeenCalled();
    });

    test('應該收集和報告處理器錯誤', async () => {
      // Arrange
      const EventBus = require('@/core/event-bus');
      eventBus = new EventBus();
      
      const eventType = 'storage.corruption.detected';
      const errorMessage = 'Storage corruption error';
      const errorHandler = jest.fn(() => {
        throw new Error(errorMessage);
      });

      eventBus.on(eventType, errorHandler);

      // Act
      const results = await eventBus.emit(eventType, { data: 'test' });

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(Error);
      expect(results[0].message).toBe(errorMessage);
    });
  });

  describe('📊 統計和監控功能', () => {
    test('應該提供事件系統統計資訊', () => {
      // Arrange
      const EventBus = require('@/core/event-bus');
      eventBus = new EventBus();
      
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.on('event1', handler1);
      eventBus.on('event1', handler2);
      eventBus.on('event2', handler1);

      // Act
      const stats = eventBus.getStats();

      // Assert
      expect(stats).toEqual({
        totalEventTypes: 2,
        totalListeners: 3,
        eventTypes: ['event1', 'event2'],
        listenerCounts: {
          'event1': 2,
          'event2': 1
        }
      });
    });

    test('應該追蹤事件觸發統計', async () => {
      // Arrange
      const EventBus = require('@/core/event-bus');
      eventBus = new EventBus();
      
      const eventType = 'performance.test.event';
      const handler = jest.fn();

      eventBus.on(eventType, handler);

      // Act
      await eventBus.emit(eventType, { data: '1' });
      await eventBus.emit(eventType, { data: '2' });

      // Assert
      const eventStats = eventBus.getEventStats(eventType);
      expect(eventStats.emitCount).toBe(2);
      expect(eventStats.totalExecutionTime).toBeGreaterThan(0);
      expect(eventStats.averageExecutionTime).toBeGreaterThan(0);
    });
  });

  describe('🔧 記憶體和效能管理', () => {
    test('應該能夠完全清理所有監聽器', () => {
      // Arrange
      const EventBus = require('@/core/event-bus');
      eventBus = new EventBus();
      
      eventBus.on('event1', jest.fn());
      eventBus.on('event2', jest.fn());
      eventBus.on('event3', jest.fn());

      // Act
      eventBus.removeAllListeners();

      // Assert
      const stats = eventBus.getStats();
      expect(stats.totalEventTypes).toBe(0);
      expect(stats.totalListeners).toBe(0);
    });

    test('應該支援最大監聽器數量限制', () => {
      // Arrange
      const EventBus = require('@/core/event-bus');
      eventBus = new EventBus({ maxListeners: 2 });
      
      const eventType = 'limited.event';

      // Act & Assert
      eventBus.on(eventType, jest.fn());
      eventBus.on(eventType, jest.fn());
      
      expect(() => {
        eventBus.on(eventType, jest.fn());
      }).toThrow('Maximum number of listeners exceeded');
    });
  });
}); 