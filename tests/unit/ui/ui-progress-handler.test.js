/**
 * UIProgressHandler 測試
 * TDD循環 #22: UI更新事件處理器
 * 
 * 測試目標：
 * 1. 🔴 測試 UI.PROGRESS.UPDATE 事件處理
 * 2. 🟢 實現 UIProgressHandler
 * 3. 🔵 重構進度更新邏輯
 * 
 * 功能範圍：
 * - 處理 UI.PROGRESS.UPDATE 事件
 * - 更新進度顯示元素
 * - 管理進度狀態和動畫
 * - 提供進度完成回調
 */

const UIProgressHandler = require('../../../src/ui/handlers/ui-progress-handler');
const EventBus = require('../../../src/core/event-bus');

describe('UIProgressHandler', () => {
  let handler;
  let mockEventBus;
  let mockDocument;
  let mockProgressElement;
  let mockProgressBar;
  let mockProgressText;

  beforeEach(() => {
    // 創建模擬的 DOM 元素
    mockProgressBar = {
      style: { width: '0%' },
      setAttribute: jest.fn(),
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn().mockReturnValue(false)
      }
    };

    mockProgressText = {
      textContent: '',
      innerHTML: ''
    };

    mockProgressElement = {
      querySelector: jest.fn((selector) => {
        if (selector === '.progress-bar') return mockProgressBar;
        if (selector === '.progress-text') return mockProgressText;
        return null;
      }),
      style: { display: 'none' },
      classList: {
        add: jest.fn(),
        remove: jest.fn()
      }
    };

    // 創建模擬的 Document
    mockDocument = {
      querySelector: jest.fn().mockReturnValue(mockProgressElement),
      getElementById: jest.fn().mockReturnValue(mockProgressElement)
    };

    // 創建模擬的 EventBus
    mockEventBus = new EventBus();
    jest.spyOn(mockEventBus, 'emit');

    // 創建處理器實例
    handler = new UIProgressHandler(mockEventBus, mockDocument);
  });

  describe('處理器基本結構和繼承 (TDD循環 #22)', () => {
    test('應該能創建 UIProgressHandler 實例', () => {
      expect(handler).toBeInstanceOf(UIProgressHandler);
      expect(handler.name).toBe('UIProgressHandler');
      expect(handler.priority).toBe(2); // UI 更新優先級較高
    });

    test('應該有正確的處理器名稱和優先級', () => {
      expect(handler.name).toBe('UIProgressHandler');
      expect(handler.priority).toBe(2);
      expect(handler.isEnabled).toBe(true);
    });

    test('應該支援 UI.PROGRESS.UPDATE 事件類型', () => {
      const supportedEvents = handler.getSupportedEvents();
      expect(supportedEvents).toContain('UI.PROGRESS.UPDATE');
      expect(handler.canHandle('UI.PROGRESS.UPDATE')).toBe(true);
    });

    test('應該正確初始化 UI 元素和狀態', () => {
      expect(handler.document).toBe(mockDocument);
      expect(handler.eventBus).toBe(mockEventBus);
      expect(handler.progressState).toBeDefined();
      expect(handler.animationState).toBeDefined();
    });
  });

  describe('UI.PROGRESS.UPDATE 事件處理 (TDD循環 #22)', () => {
    test('應該能處理有效的進度更新事件', async () => {
      const event = {
        type: 'UI.PROGRESS.UPDATE',
        data: {
          percentage: 50,
          message: '正在提取書籍資料...',
          flowId: 'test-flow-1'
        },
        flowId: 'test-flow-1',
        timestamp: Date.now()
      };

      const result = await handler.handle(event);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockProgressBar.style.width).toBe('50%');
      expect(mockProgressText.textContent).toBe('正在提取書籍資料...');
    });

    test('應該能處理不同百分比的進度更新', async () => {
      const testCases = [
        { percentage: 0, expected: '0%' },
        { percentage: 25, expected: '25%' },
        { percentage: 75, expected: '75%' },
        { percentage: 100, expected: '100%' }
      ];

      for (const testCase of testCases) {
        const event = {
          type: 'UI.PROGRESS.UPDATE',
          data: {
            percentage: testCase.percentage,
            message: `進度 ${testCase.percentage}%`,
            flowId: 'test-flow'
          },
          flowId: 'test-flow',
          timestamp: Date.now()
        };

        await handler.handle(event);
        expect(mockProgressBar.style.width).toBe(testCase.expected);
      }
    });

    test('應該能處理進度狀態變化', async () => {
      // 測試開始狀態
      const startEvent = {
        type: 'UI.PROGRESS.UPDATE',
        data: {
          percentage: 0,
          message: '開始提取...',
          status: 'started',
          flowId: 'test-flow'
        },
        flowId: 'test-flow',
        timestamp: Date.now()
      };

      await handler.handle(startEvent);
      expect(mockProgressElement.style.display).toBe('block');
      expect(mockProgressElement.classList.add).toHaveBeenCalledWith('progress-active');

      // 測試完成狀態
      const completeEvent = {
        type: 'UI.PROGRESS.UPDATE',
        data: {
          percentage: 100,
          message: '提取完成！',
          status: 'completed',
          flowId: 'test-flow'
        },
        flowId: 'test-flow',
        timestamp: Date.now()
      };

      await handler.handle(completeEvent);
      expect(mockProgressElement.classList.add).toHaveBeenCalledWith('progress-completed');
    });

    test('應該驗證進度事件資料的有效性', async () => {
      const invalidEvents = [
        {
          type: 'UI.PROGRESS.UPDATE',
          data: null, // 無效資料
          flowId: 'test-flow'
        },
        {
          type: 'UI.PROGRESS.UPDATE',
          data: {
            percentage: -10, // 無效百分比
            message: 'test'
          },
          flowId: 'test-flow'
        },
        {
          type: 'UI.PROGRESS.UPDATE',
          data: {
            percentage: 150, // 超出範圍
            message: 'test'
          },
          flowId: 'test-flow'
        }
      ];

      for (const event of invalidEvents) {
        await expect(handler.handle(event)).rejects.toThrow();
      }
    });
  });

  describe('進度顯示元素管理 (TDD循環 #22)', () => {
    test('應該能找到並初始化進度顯示元素', () => {
      expect(handler.getProgressElement()).toBe(mockProgressElement);
      expect(handler.getProgressBar()).toBe(mockProgressBar);
      expect(handler.getProgressText()).toBe(mockProgressText);
    });

    test('應該能顯示和隱藏進度元素', async () => {
      // 測試顯示
      await handler.showProgress();
      expect(mockProgressElement.style.display).toBe('block');
      expect(mockProgressElement.classList.add).toHaveBeenCalledWith('progress-visible');

      // 測試隱藏
      await handler.hideProgress();
      expect(mockProgressElement.style.display).toBe('none');
      expect(mockProgressElement.classList.remove).toHaveBeenCalledWith('progress-visible');
    });

    test('應該能處理缺少 DOM 元素的情況', () => {
      // 創建沒有進度元素的文檔
      const emptyDocument = {
        querySelector: jest.fn().mockReturnValue(null),
        getElementById: jest.fn().mockReturnValue(null)
      };

      const handlerWithoutElement = new UIProgressHandler(mockEventBus, emptyDocument);
      
      expect(() => handlerWithoutElement.getProgressElement()).not.toThrow();
      expect(handlerWithoutElement.getProgressElement()).toBeNull();
    });

    test('應該能設置進度條動畫', async () => {
      const event = {
        type: 'UI.PROGRESS.UPDATE',
        data: {
          percentage: 60,
          message: '提取中...',
          animated: true,
          flowId: 'test-flow'
        },
        flowId: 'test-flow',
        timestamp: Date.now()
      };

      await handler.handle(event);
      expect(mockProgressBar.classList.add).toHaveBeenCalledWith('progress-animated');
    });
  });

  describe('進度狀態管理 (TDD循環 #22)', () => {
    test('應該追蹤多個流程的進度狀態', async () => {
      const flow1Event = {
        type: 'UI.PROGRESS.UPDATE',
        data: {
          percentage: 30,
          message: '流程1進度',
          flowId: 'flow-1'
        },
        flowId: 'flow-1',
        timestamp: Date.now()
      };

      const flow2Event = {
        type: 'UI.PROGRESS.UPDATE',
        data: {
          percentage: 60,
          message: '流程2進度',
          flowId: 'flow-2'
        },
        flowId: 'flow-2',
        timestamp: Date.now()
      };

      await handler.handle(flow1Event);
      await handler.handle(flow2Event);

      const progressState = handler.getProgressState();
      expect(progressState['flow-1']).toBeDefined();
      expect(progressState['flow-1'].percentage).toBe(30);
      expect(progressState['flow-2']).toBeDefined();
      expect(progressState['flow-2'].percentage).toBe(60);
    });

    test('應該能清理完成的流程狀態', async () => {
      const completeEvent = {
        type: 'UI.PROGRESS.UPDATE',
        data: {
          percentage: 100,
          message: '完成',
          status: 'completed',
          flowId: 'completed-flow'
        },
        flowId: 'completed-flow',
        timestamp: Date.now()
      };

      await handler.handle(completeEvent);
      
      // 應該自動清理完成的流程
      setTimeout(() => {
        const progressState = handler.getProgressState();
        expect(progressState['completed-flow']).toBeUndefined();
      }, 100);
    });

    test('應該提供進度狀態查詢方法', () => {
      const stats = handler.getStats();
      expect(stats).toHaveProperty('updateCount');
      expect(stats).toHaveProperty('activeFlows');
      expect(stats).toHaveProperty('completedFlows');
      expect(stats).toHaveProperty('lastUpdateTime');
    });
  });

  describe('錯誤處理和恢復機制 (TDD循環 #22)', () => {
    test('應該處理 DOM 操作錯誤', async () => {
      // 模擬 DOM 操作失敗
      mockProgressBar.style = null;

      const event = {
        type: 'UI.PROGRESS.UPDATE',
        data: {
          percentage: 50,
          message: '測試',
          flowId: 'test-flow'
        },
        flowId: 'test-flow',
        timestamp: Date.now()
      };

      // 應該不拋出錯誤，而是優雅處理
      await expect(handler.handle(event)).resolves.toBeDefined();
    });

    test('應該處理 EventBus 未設置的情況', async () => {
      const handlerWithoutEventBus = new UIProgressHandler(null, mockDocument);

      const event = {
        type: 'UI.PROGRESS.UPDATE',
        data: {
          percentage: 50,
          message: '測試',
          flowId: 'test-flow'
        },
        flowId: 'test-flow',
        timestamp: Date.now()
      };

      // 應該能處理但不會發送事件
      const result = await handlerWithoutEventBus.handle(event);
      expect(result.success).toBe(true);
    });

    test('應該記錄和報告錯誤統計', async () => {
      // 強制產生錯誤（無效的進度資料）
      const event = {
        type: 'UI.PROGRESS.UPDATE',
        data: {
          percentage: 'invalid', // 無效的百分比
          message: '',  // 空訊息
          flowId: 'test-flow'
        },
        flowId: 'test-flow',
        timestamp: Date.now()
      };

      await expect(handler.handle(event)).rejects.toThrow();

      const stats = handler.getStats();
      expect(stats.errorCount).toBeGreaterThan(0);
    });
  });

  describe('EventHandler 基底類別整合 (TDD循環 #22)', () => {
    test('應該正確實現 EventHandler 抽象方法', () => {
      expect(typeof handler.process).toBe('function');
      expect(typeof handler.getSupportedEvents).toBe('function');
      expect(handler.getSupportedEvents()).toContain('UI.PROGRESS.UPDATE');
    });

    test('應該追蹤執行統計', async () => {
      const event = {
        type: 'UI.PROGRESS.UPDATE',
        data: {
          percentage: 50,
          message: '測試',
          flowId: 'test-flow'
        },
        flowId: 'test-flow',
        timestamp: Date.now()
      };

      const initialStats = handler.getStats();
      const initialCount = initialStats.executionCount;

      await handler.handle(event);

      const updatedStats = handler.getStats();
      expect(updatedStats.executionCount).toBe(initialCount + 1);
      expect(updatedStats.lastExecutionTime).toBeGreaterThan(0);
    });

    test('應該支援啟用/停用功能', async () => {
      handler.setEnabled(false);

      const event = {
        type: 'UI.PROGRESS.UPDATE',
        data: {
          percentage: 50,
          message: '測試',
          flowId: 'test-flow'
        },
        flowId: 'test-flow',
        timestamp: Date.now()
      };

      const result = await handler.handle(event);
      expect(result).toBeNull(); // 停用時應該返回 null
    });
  });
});