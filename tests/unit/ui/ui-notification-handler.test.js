/**
 * UINotificationHandler 測試
 * TDD循環 #23: UI狀態管理事件處理器
 * 
 * 測試目標：
 * 1. 🔴 測試 UI.NOTIFICATION.SHOW 事件處理
 * 2. 🟢 實現 UINotificationHandler
 * 3. 🔵 重構通知系統
 * 
 * 功能範圍：
 * - 處理 UI.NOTIFICATION.SHOW 事件
 * - 管理通知的顯示和隱藏
 * - 支援不同類型的通知樣式
 * - 提供通知自動消失機制
 */

const UINotificationHandler = require('../../../src/ui/handlers/ui-notification-handler');
const EventBus = require('../../../src/core/event-bus');

describe('UINotificationHandler', () => {
  let handler;
  let mockEventBus;
  let mockDocument;
  let mockNotificationContainer;
  let mockNotificationElement;

  beforeEach(() => {
    // 創建模擬的通知元素
    mockNotificationElement = {
      textContent: '',
      innerHTML: '',
      style: { display: 'none' },
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn().mockReturnValue(false)
      },
      setAttribute: jest.fn(),
      remove: jest.fn(),
      appendChild: jest.fn(),
      parentNode: {
        removeChild: jest.fn()
      }
    };

    // 創建模擬的通知容器
    mockNotificationContainer = {
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      querySelector: jest.fn().mockReturnValue(mockNotificationElement),
      querySelectorAll: jest.fn().mockReturnValue([]),
      style: { display: 'block' },
      classList: {
        add: jest.fn(),
        remove: jest.fn()
      }
    };

    // 為按鈕添加 addEventListener 方法
    const createMockButton = () => ({
      textContent: '',
      innerHTML: '',
      style: { display: 'none' },
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn().mockReturnValue(false)
      },
      setAttribute: jest.fn(),
      remove: jest.fn(),
      addEventListener: jest.fn()
    });

    // 創建模擬的 Document
    mockDocument = {
      querySelector: jest.fn().mockReturnValue(mockNotificationContainer),
      getElementById: jest.fn().mockReturnValue(mockNotificationContainer),
      createElement: jest.fn((tagName) => {
        if (tagName === 'button') {
          return createMockButton();
        }
        return mockNotificationElement;
      }),
      body: mockNotificationContainer
    };

    // 創建模擬的 EventBus
    mockEventBus = new EventBus();
    jest.spyOn(mockEventBus, 'emit');

    // 創建處理器實例
    handler = new UINotificationHandler(mockEventBus, mockDocument);
  });

  describe('處理器基本結構和繼承 (TDD循環 #23)', () => {
    test('應該能創建 UINotificationHandler 實例', () => {
      expect(handler).toBeInstanceOf(UINotificationHandler);
      expect(handler.name).toBe('UINotificationHandler');
      expect(handler.priority).toBe(2); // UI 更新優先級較高
    });

    test('應該有正確的處理器名稱和優先級', () => {
      expect(handler.name).toBe('UINotificationHandler');
      expect(handler.priority).toBe(2);
      expect(handler.isEnabled).toBe(true);
    });

    test('應該支援 UI.NOTIFICATION.SHOW 事件類型', () => {
      const supportedEvents = handler.getSupportedEvents();
      expect(supportedEvents).toContain('UI.NOTIFICATION.SHOW');
      expect(handler.canHandle('UI.NOTIFICATION.SHOW')).toBe(true);
    });

    test('應該正確初始化通知系統狀態', () => {
      expect(handler.document).toBe(mockDocument);
      expect(handler.eventBus).toBe(mockEventBus);
      expect(handler.activeNotifications).toBeDefined();
      expect(handler.notificationQueue).toBeDefined();
    });
  });

  describe('UI.NOTIFICATION.SHOW 事件處理 (TDD循環 #23)', () => {
    test('應該能處理基本的通知顯示事件', async () => {
      const event = {
        type: 'UI.NOTIFICATION.SHOW',
        data: {
          message: '操作成功完成！',
          type: 'success',
          duration: 3000
        },
        flowId: 'test-flow-1',
        timestamp: Date.now()
      };

      const result = await handler.handle(event);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockNotificationElement.textContent).toBe('操作成功完成！');
      expect(mockNotificationContainer.appendChild).toHaveBeenCalledWith(mockNotificationElement);
    });

    test('應該能處理不同類型的通知', async () => {
      const notificationTypes = [
        { type: 'success', expectedClass: 'notification-success' },
        { type: 'error', expectedClass: 'notification-error' },
        { type: 'warning', expectedClass: 'notification-warning' },
        { type: 'info', expectedClass: 'notification-info' }
      ];

      for (const testCase of notificationTypes) {
        const event = {
          type: 'UI.NOTIFICATION.SHOW',
          data: {
            message: `這是 ${testCase.type} 通知`,
            type: testCase.type,
            duration: 2000
          },
          flowId: `test-flow-${testCase.type}`,
          timestamp: Date.now()
        };

        await handler.handle(event);
        expect(mockNotificationElement.classList.add).toHaveBeenCalledWith(testCase.expectedClass);
      }
    });

    test('應該能處理帶有標題的通知', async () => {
      const event = {
        type: 'UI.NOTIFICATION.SHOW',
        data: {
          title: '重要提醒',
          message: '系統將在 5 分鐘後維護',
          type: 'warning',
          duration: 5000
        },
        flowId: 'test-flow-titled',
        timestamp: Date.now()
      };

      const result = await handler.handle(event);

      expect(result.success).toBe(true);
      // 應該創建包含標題的通知結構
      expect(mockNotificationElement.innerHTML).toContain('重要提醒');
      expect(mockNotificationElement.innerHTML).toContain('系統將在 5 分鐘後維護');
    });

    test('應該驗證通知事件資料的有效性', async () => {
      const invalidEvents = [
        {
          type: 'UI.NOTIFICATION.SHOW',
          data: null, // 無效資料
          flowId: 'test-flow'
        },
        {
          type: 'UI.NOTIFICATION.SHOW',
          data: {
            message: '', // 空訊息
            type: 'info'
          },
          flowId: 'test-flow'
        },
        {
          type: 'UI.NOTIFICATION.SHOW',
          data: {
            message: 'test',
            type: 'invalid-type' // 無效類型
          },
          flowId: 'test-flow'
        }
      ];

      for (const event of invalidEvents) {
        await expect(handler.handle(event)).rejects.toThrow();
      }
    });
  });

  describe('通知顯示和管理 (TDD循環 #23)', () => {
    test('應該能創建和顯示通知元素', async () => {
      const notificationData = {
        message: '測試通知',
        type: 'info',
        duration: 3000
      };

      const notification = await handler.createNotification(notificationData, 'test-id');

      expect(notification).toBeDefined();
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockNotificationElement.classList.add).toHaveBeenCalledWith('notification');
      expect(mockNotificationElement.classList.add).toHaveBeenCalledWith('notification-info');
    });

    test('應該能自動隱藏通知', async () => {
      jest.useFakeTimers();

      const event = {
        type: 'UI.NOTIFICATION.SHOW',
        data: {
          message: '自動消失通知',
          type: 'success',
          duration: 1000
        },
        flowId: 'test-auto-hide',
        timestamp: Date.now()
      };

      await handler.handle(event);

      // 確認通知已被創建並添加到活躍通知中
      expect(handler.getActiveNotifications()['test-auto-hide']).toBeDefined();

      // 快進時間
      jest.advanceTimersByTime(1000);

      // 等待異步操作完成
      await Promise.resolve();

      // 檢查通知是否從活躍列表中移除
      expect(handler.getActiveNotifications()['test-auto-hide']).toBeUndefined();

      jest.useRealTimers();
    });

    test('應該能處理永久通知', async () => {
      const event = {
        type: 'UI.NOTIFICATION.SHOW',
        data: {
          message: '永久通知',
          type: 'info',
          persistent: true
        },
        flowId: 'test-persistent',
        timestamp: Date.now()
      };

      const result = await handler.handle(event);

      expect(result.success).toBe(true);
      expect(result.persistent).toBe(true);
      
      // 永久通知不應該設定自動隱藏
      const activeNotifications = handler.getActiveNotifications();
      expect(activeNotifications['test-persistent']).toBeDefined();
      expect(activeNotifications['test-persistent'].persistent).toBe(true);
    });

    test('應該能手動關閉通知', async () => {
      const event = {
        type: 'UI.NOTIFICATION.SHOW',
        data: {
          message: '可關閉通知',
          type: 'info',
          closable: true
        },
        flowId: 'test-closable',
        timestamp: Date.now()
      };

      await handler.handle(event);

      // 測試手動關閉
      await handler.hideNotification('test-closable');

      const activeNotifications = handler.getActiveNotifications();
      expect(activeNotifications['test-closable']).toBeUndefined();
    });
  });

  describe('通知佇列管理 (TDD循環 #23)', () => {
    test('應該能管理多個並行通知', async () => {
      const notifications = [
        { message: '通知 1', type: 'info', flowId: 'flow-1' },
        { message: '通知 2', type: 'success', flowId: 'flow-2' },
        { message: '通知 3', type: 'warning', flowId: 'flow-3' }
      ];

      for (const notif of notifications) {
        const event = {
          type: 'UI.NOTIFICATION.SHOW',
          data: notif,
          flowId: notif.flowId,
          timestamp: Date.now()
        };

        await handler.handle(event);
      }

      const activeNotifications = handler.getActiveNotifications();
      expect(Object.keys(activeNotifications)).toHaveLength(3);
      expect(activeNotifications['flow-1']).toBeDefined();
      expect(activeNotifications['flow-2']).toBeDefined();
      expect(activeNotifications['flow-3']).toBeDefined();
    });

    test('應該支援通知佇列限制', async () => {
      // 設定最大通知數量
      handler.maxNotifications = 2;

      const notifications = [
        { message: '通知 1', type: 'info', flowId: 'flow-1' },
        { message: '通知 2', type: 'info', flowId: 'flow-2' },
        { message: '通知 3', type: 'info', flowId: 'flow-3' } // 應該替換最舊的
      ];

      for (const notif of notifications) {
        const event = {
          type: 'UI.NOTIFICATION.SHOW',
          data: notif,
          flowId: notif.flowId,
          timestamp: Date.now()
        };

        await handler.handle(event);
      }

      const activeNotifications = handler.getActiveNotifications();
      expect(Object.keys(activeNotifications)).toHaveLength(2);
      expect(activeNotifications['flow-1']).toBeUndefined(); // 最舊的應該被移除
      expect(activeNotifications['flow-2']).toBeDefined();
      expect(activeNotifications['flow-3']).toBeDefined();
    });

    test('應該提供通知統計資訊', () => {
      const stats = handler.getStats();
      expect(stats).toHaveProperty('totalNotifications');
      expect(stats).toHaveProperty('activeNotifications');
      expect(stats).toHaveProperty('notificationsByType');
      expect(stats).toHaveProperty('averageDisplayTime');
    });
  });

  describe('錯誤處理和恢復機制 (TDD循環 #23)', () => {
    test('應該處理 DOM 操作錯誤', async () => {
      // 模擬 DOM 操作失敗
      mockDocument.createElement.mockImplementation(() => {
        throw new Error('DOM creation failed');
      });

      const event = {
        type: 'UI.NOTIFICATION.SHOW',
        data: {
          message: '測試通知',
          type: 'info'
        },
        flowId: 'test-flow',
        timestamp: Date.now()
      };

      // 應該優雅處理錯誤
      await expect(handler.handle(event)).rejects.toThrow();

      const stats = handler.getStats();
      expect(stats.errorCount).toBeGreaterThan(0);
    });

    test('應該處理缺少通知容器的情況', async () => {
      // 創建沒有通知容器的文檔
      const emptyDocument = {
        querySelector: jest.fn().mockReturnValue(null),
        createElement: jest.fn().mockReturnValue(mockNotificationElement)
      };

      const handlerWithoutContainer = new UINotificationHandler(mockEventBus, emptyDocument);

      const event = {
        type: 'UI.NOTIFICATION.SHOW',
        data: {
          message: '測試通知',
          type: 'info'
        },
        flowId: 'test-flow',
        timestamp: Date.now()
      };

      // 應該能處理但會創建默認容器
      const result = await handlerWithoutContainer.handle(event);
      expect(result.success).toBe(true);
    });

    test('應該處理 EventBus 未設置的情況', async () => {
      const handlerWithoutEventBus = new UINotificationHandler(null, mockDocument);

      const event = {
        type: 'UI.NOTIFICATION.SHOW',
        data: {
          message: '測試通知',
          type: 'info'
        },
        flowId: 'test-flow',
        timestamp: Date.now()
      };

      // 應該能處理但不會發送事件
      const result = await handlerWithoutEventBus.handle(event);
      expect(result.success).toBe(true);
    });
  });

  describe('EventHandler 基底類別整合 (TDD循環 #23)', () => {
    test('應該正確實現 EventHandler 抽象方法', () => {
      expect(typeof handler.process).toBe('function');
      expect(typeof handler.getSupportedEvents).toBe('function');
      expect(handler.getSupportedEvents()).toContain('UI.NOTIFICATION.SHOW');
    });

    test('應該追蹤執行統計', async () => {
      const event = {
        type: 'UI.NOTIFICATION.SHOW',
        data: {
          message: '統計測試',
          type: 'info'
        },
        flowId: 'test-stats',
        timestamp: Date.now()
      };

      const initialStats = handler.getStats();
      const initialCount = initialStats.executionCount;

      await handler.handle(event);

      const updatedStats = handler.getStats();
      expect(updatedStats.executionCount).toBe(initialCount + 1);
      expect(updatedStats.totalNotifications).toBe(initialStats.totalNotifications + 1);
    });

    test('應該支援啟用/停用功能', async () => {
      handler.setEnabled(false);

      const event = {
        type: 'UI.NOTIFICATION.SHOW',
        data: {
          message: '停用測試',
          type: 'info'
        },
        flowId: 'test-disabled',
        timestamp: Date.now()
      };

      const result = await handler.handle(event);
      expect(result).toBeNull(); // 停用時應該返回 null
    });
  });
});