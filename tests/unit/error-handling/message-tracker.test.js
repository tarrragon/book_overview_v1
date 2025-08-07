/**
 * MessageTracker 測試
 * TDD 循環 #33: 即時診斷系統
 *
 * 測試目標：
 * 1. MessageTracker 基礎架構和初始化
 * 2. 訊息追蹤核心功能
 * 3. Console 診斷介面
 * 4. 記憶體管理和清理機制
 */

const EventHandler = require("../../../src/core/event-handler");

describe("MessageTracker - TDD 循環 #33", () => {
  let mockEventBus;
  let mockWindow;

  beforeEach(() => {
    // 模擬事件總線
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };

    // 模擬 window 物件
    mockWindow = {
      MessageDiagnostic: null,
    };

    global.window = mockWindow;
    global.console = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      table: jest.fn(),
      group: jest.fn(),
      groupEnd: jest.fn(),
    };

    // 清除所有模擬
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete global.window;
    delete global.console;
  });

  describe("🔧 基本結構和初始化", () => {
    test("應該能夠創建 MessageTracker 實例", () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");

      expect(() => {
        new MessageTracker(mockEventBus);
      }).not.toThrow();
    });

    test("應該繼承 EventHandler 基底類別", () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus);

      expect(tracker).toBeInstanceOf(EventHandler);
      expect(tracker.name).toBe("MessageTracker");
      expect(tracker.priority).toBe(10); // 中等優先級
    });

    test("應該正確設定支援的事件類型", () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus);

      expect(tracker.supportedEvents).toContain("MESSAGE.SENT");
      expect(tracker.supportedEvents).toContain("MESSAGE.RECEIVED");
      expect(tracker.supportedEvents).toContain("MESSAGE.PROCESSED");
      expect(tracker.supportedEvents).toContain("MESSAGE.FAILED");
    });

    test("應該初始化追蹤狀態和資料結構", () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus);

      expect(tracker.trackingEnabled).toBe(true);
      expect(tracker.diagnosticMode).toBe(false);
      expect(tracker.messageLog).toEqual([]);
      expect(tracker.activeMessages).toBeInstanceOf(Map);
      expect(tracker.trackingStats).toBeDefined();
      expect(tracker.trackingStats.totalMessages).toBe(0);
    });

    test("應該設置 Console 診斷介面", () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      new MessageTracker(mockEventBus);

      expect(mockWindow.MessageDiagnostic).toBeDefined();
      expect(typeof mockWindow.MessageDiagnostic.status).toBe("function");
      expect(typeof mockWindow.MessageDiagnostic.messages).toBe("function");
      expect(typeof mockWindow.MessageDiagnostic.unknown).toBe("function");
      expect(typeof mockWindow.MessageDiagnostic.clear).toBe("function");
    });
  });

  describe("📨 訊息追蹤核心功能", () => {
    test("應該處理 MESSAGE.SENT 事件", async () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus);

      const sentEvent = {
        type: "MESSAGE.SENT",
        data: {
          messageId: "test_001",
          type: "START_EXTRACTION",
          source: "popup",
          target: "content",
          timestamp: Date.now(),
        },
      };

      const result = await tracker.handle(sentEvent);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("test_001");
      expect(tracker.activeMessages.has("test_001")).toBe(true);
      expect(tracker.trackingStats.totalMessages).toBe(1);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        "DIAGNOSTIC_INFO.UPDATED",
        expect.objectContaining({
          action: "message_sent",
          messageId: "test_001",
        })
      );
    });

    test("應該處理 MESSAGE.RECEIVED 事件", async () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus);

      // 先發送訊息
      await tracker.handle({
        type: "MESSAGE.SENT",
        data: {
          messageId: "test_002",
          type: "PAGE_READY",
          source: "content",
          target: "background",
        },
      });

      // 然後接收訊息
      const receivedEvent = {
        type: "MESSAGE.RECEIVED",
        data: {
          messageId: "test_002",
          type: "PAGE_READY",
          source: "content",
          timestamp: Date.now(),
        },
      };

      const result = await tracker.handle(receivedEvent);

      expect(result.success).toBe(true);
      const messageRecord = tracker.activeMessages.get("test_002");
      expect(messageRecord.status).toBe("RECEIVED");
      expect(messageRecord.receivedTime).toBeDefined();
    });

    test("應該處理 MESSAGE.PROCESSED 事件", async () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus);

      // 先發送和接收訊息
      await tracker.handle({
        type: "MESSAGE.SENT",
        data: { messageId: "test_003", type: "PING" },
      });
      await tracker.handle({
        type: "MESSAGE.RECEIVED",
        data: { messageId: "test_003", type: "PING" },
      });

      // 然後處理完成
      const processedEvent = {
        type: "MESSAGE.PROCESSED",
        data: {
          messageId: "test_003",
          result: { success: true },
          processingTime: 150,
          timestamp: Date.now(),
        },
      };

      const result = await tracker.handle(processedEvent);

      expect(result.success).toBe(true);
      expect(tracker.activeMessages.has("test_003")).toBe(false); // 應該從活躍訊息中移除
      expect(tracker.trackingStats.processedMessages).toBe(1);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        "MESSAGE_FLOW.COMPLETED",
        expect.objectContaining({
          messageId: "test_003",
          processingTime: 150,
        })
      );
    });

    test("應該處理 MESSAGE.FAILED 事件", async () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus);

      // 先發送訊息
      await tracker.handle({
        type: "MESSAGE.SENT",
        data: { messageId: "test_004", type: "START_EXTRACTION" },
      });

      // 然後失敗
      const failedEvent = {
        type: "MESSAGE.FAILED",
        data: {
          messageId: "test_004",
          error: new Error("No receiving end"),
          timestamp: Date.now(),
        },
      };

      const result = await tracker.handle(failedEvent);

      expect(result.success).toBe(true);
      expect(tracker.activeMessages.has("test_004")).toBe(false); // 應該從活躍訊息中移除
      expect(tracker.trackingStats.failedMessages).toBe(1);
    });

    test("應該自動生成訊息 ID", async () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus);

      const sentEvent = {
        type: "MESSAGE.SENT",
        data: {
          type: "PING",
          source: "popup",
          target: "background",
        },
      };

      const result = await tracker.handle(sentEvent);

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^MSG_\d+_[a-z0-9]+$/);
    });
  });

  describe("🖥️ Console 診斷介面", () => {
    test("status() 應該返回追蹤狀態", () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus);

      const status = mockWindow.MessageDiagnostic.status();

      expect(status).toHaveProperty("enabled", true);
      expect(status).toHaveProperty("diagnosticMode", false);
      expect(status).toHaveProperty("totalMessages", 0);
      expect(status).toHaveProperty("activeMessages", 0);
      expect(global.console.table).toHaveBeenCalledWith(status);
    });

    test("messages() 應該返回最近的訊息記錄", async () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus);

      // 添加一些訊息記錄
      await tracker.handle({
        type: "MESSAGE.SENT",
        data: { messageId: "msg1", type: "PING" },
      });
      await tracker.handle({
        type: "MESSAGE.SENT",
        data: { messageId: "msg2", type: "PONG" },
      });

      const messages = mockWindow.MessageDiagnostic.messages(5);

      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBe(2);
      expect(global.console.group).toHaveBeenCalledWith("最近訊息記錄");
      expect(global.console.groupEnd).toHaveBeenCalled();
    });

    test("clear() 應該清除追蹤記錄", async () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus);

      // 添加一些記錄
      await tracker.handle({
        type: "MESSAGE.SENT",
        data: { messageId: "msg1", type: "PING" },
      });

      expect(tracker.messageLog.length).toBe(1);

      const result = mockWindow.MessageDiagnostic.clear();

      expect(result.clearedCount).toBe(1);
      expect(tracker.messageLog.length).toBe(0);
    });

    test("active() 應該返回活躍訊息", async () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus);

      // 添加活躍訊息
      await tracker.handle({
        type: "MESSAGE.SENT",
        data: { messageId: "active1", type: "PING" },
      });

      const activeMessages = mockWindow.MessageDiagnostic.active();

      expect(Array.isArray(activeMessages)).toBe(true);
      expect(activeMessages.length).toBe(1);
      expect(activeMessages[0].id).toBe("active1");
    });
  });

  describe("📊 統計和記憶體管理", () => {
    test("應該正確計算處理時間", async () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus);

      const startTime = Date.now();

      // 發送訊息
      await tracker.handle({
        type: "MESSAGE.SENT",
        data: { messageId: "timing_test", type: "PING", timestamp: startTime },
      });

      // 接收訊息
      await tracker.handle({
        type: "MESSAGE.RECEIVED",
        data: { messageId: "timing_test", timestamp: startTime + 50 },
      });

      // 處理完成
      await tracker.handle({
        type: "MESSAGE.PROCESSED",
        data: { messageId: "timing_test", timestamp: startTime + 200 },
      });

      expect(tracker.trackingStats.averageProcessingTime).toBeGreaterThan(0);
    });

    test("應該限制訊息記錄數量", async () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus, {
        maxMessageRecords: 3,
      });

      // 添加超過限制的記錄
      for (let i = 0; i < 5; i++) {
        await tracker.handle({
          type: "MESSAGE.SENT",
          data: { messageId: `msg_${i}`, type: "PING" },
        });
      }

      expect(tracker.messageLog.length).toBe(3); // 應該限制在 3 個
    });

    test("應該清理超時的活躍訊息", async () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus, {
        messageTimeoutMs: 100,
      });

      // 添加一個訊息
      await tracker.handle({
        type: "MESSAGE.SENT",
        data: {
          messageId: "timeout_test",
          type: "PING",
          timestamp: Date.now() - 200,
        },
      });

      expect(tracker.activeMessages.has("timeout_test")).toBe(true);

      // 手動觸發清理
      tracker.cleanupTimeoutMessages();

      expect(tracker.activeMessages.has("timeout_test")).toBe(false);
    });

    test("應該更新統計資訊", async () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus);

      // 發送訊息
      await tracker.handle({
        type: "MESSAGE.SENT",
        data: { messageId: "stats_test", type: "PING" },
      });

      expect(tracker.trackingStats.totalMessages).toBe(1);

      // 處理完成
      await tracker.handle({
        type: "MESSAGE.PROCESSED",
        data: { messageId: "stats_test", processingTime: 100 },
      });

      expect(tracker.trackingStats.processedMessages).toBe(1);
      expect(tracker.trackingStats.averageProcessingTime).toBe(100);
    });
  });

  describe("⚙️ 配置和控制", () => {
    test("應該能夠啟用/停用追蹤", async () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus);

      // 停用追蹤
      tracker.setTrackingEnabled(false);

      const result = await tracker.handle({
        type: "MESSAGE.SENT",
        data: { messageId: "disabled_test", type: "PING" },
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("追蹤已停用");
      expect(tracker.trackingStats.totalMessages).toBe(0);
    });

    test("應該能夠啟用/停用診斷模式", () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus);

      tracker.setDiagnosticMode(true);

      expect(tracker.diagnosticMode).toBe(true);
      expect(global.console.log).toHaveBeenCalledWith(
        "[MessageTracker] 診斷模式 啟用"
      );
    });

    test("應該處理不支援的事件類型", async () => {
      const MessageTracker = require("../../../src/error-handling/message-tracker");
      const tracker = new MessageTracker(mockEventBus);

      const result = await tracker.handle({
        type: "UNSUPPORTED.EVENT",
        data: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("不支援的追蹤事件類型");
    });
  });
});
