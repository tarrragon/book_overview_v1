# Design Document

## Overview

即時診斷系統基於現有的錯誤處理架構，新增一個專門的 MessageTracker 組件來提供即時的訊息流程追蹤和診斷功能。系統將與現有的 MessageErrorHandler 和 EventErrorHandler 協作，提供統一的診斷體驗。

## Architecture

### 系統架構圖

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MessageTracker│    │MessageErrorHandler│  │EventErrorHandler│
│                 │    │                 │    │                 │
│ - 訊息追蹤      │◄──►│ - 錯誤分類      │◄──►│ - 系統錯誤      │
│ - 流程記錄      │    │ - 診斷建議      │    │ - 斷路器管理    │
│ - Console輸出   │    │ - Chrome整合    │    │ - 自動恢復      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │    EventBus     │
                    │                 │
                    │ - 事件分發      │
                    │ - 優先級管理    │
                    │ - 錯誤隔離      │
                    └─────────────────┘
```

### 核心設計原則

1. **最小侵入性** - 不影響現有錯誤處理系統
2. **即時性** - 提供即時的訊息追蹤和診斷
3. **輕量級** - 專注於核心診斷功能
4. **整合性** - 與現有系統無縫協作

## Components and Interfaces

### MessageTracker 核心組件

```javascript
class MessageTracker extends EventHandler {
  constructor(eventBus, options = {}) {
    super("MessageTracker", 10); // 中等優先級

    // 基本配置
    this.eventBus = eventBus;
    this.supportedEvents = [
      "MESSAGE.SENT",
      "MESSAGE.RECEIVED",
      "MESSAGE.PROCESSED",
      "MESSAGE.FAILED",
    ];

    // 追蹤狀態
    this.messageLog = [];
    this.activeMessages = new Map();
    this.diagnosticMode = false;
  }
}
```

### 主要介面定義

#### 1. 訊息追蹤介面

```javascript
// 追蹤訊息發送
trackMessageSent(messageId, type, source, target, timestamp);

// 追蹤訊息接收
trackMessageReceived(messageId, type, source, timestamp);

// 追蹤訊息處理完成
trackMessageProcessed(messageId, result, timestamp);

// 追蹤訊息處理失敗
trackMessageFailed(messageId, error, timestamp);
```

#### 2. 診斷查詢介面

```javascript
// 獲取訊息流程記錄
getMessageFlow(messageId);

// 獲取未知訊息統計
getUnknownMessageStats();

// 獲取當前活躍訊息
getActiveMessages();

// 清除追蹤記錄
clearTrackingLog();
```

#### 3. Console 診斷介面

```javascript
// 在 Chrome DevTools Console 中提供的診斷命令
window.MessageDiagnostic = {
  status: () => tracker.getTrackingStatus(),
  messages: () => tracker.getMessageLog(),
  unknown: () => tracker.getUnknownMessages(),
  clear: () => tracker.clearTrackingLog(),
};
```

## Data Models

### MessageRecord 資料模型

```javascript
const MessageRecord = {
  id: String, // 訊息唯一識別碼
  type: String, // 訊息類型
  source: String, // 訊息來源 (popup/background/content)
  target: String, // 訊息目標
  status: String, // 狀態 (sent/received/processed/failed)
  timestamp: Number, // 時間戳
  data: Object, // 訊息內容 (可選)
  error: Object, // 錯誤資訊 (如果失敗)
  processingTime: Number, // 處理時間 (毫秒)
};
```

### TrackingStats 統計模型

```javascript
const TrackingStats = {
  totalMessages: Number, // 總訊息數
  unknownMessages: Number, // 未知訊息數
  failedMessages: Number, // 失敗訊息數
  averageProcessingTime: Number, // 平均處理時間
  activeMessagesCount: Number, // 當前活躍訊息數
  lastMessageTime: Number, // 最後訊息時間
};
```

## Error Handling

### 錯誤處理策略

1. **非阻塞性錯誤處理** - 診斷系統錯誤不影響主要功能
2. **降級處理** - 當診斷功能失敗時，自動降級為基本記錄
3. **記憶體保護** - 限制追蹤記錄數量，防止記憶體洩漏

### 錯誤分類

```javascript
const DiagnosticErrors = {
  TRACKING_FAILED: "追蹤記錄失敗",
  CONSOLE_UNAVAILABLE: "Console 不可用",
  MEMORY_LIMIT_EXCEEDED: "記憶體限制超出",
  INTEGRATION_ERROR: "整合錯誤",
};
```

## Testing Strategy

### 測試層級

1. **單元測試** - MessageTracker 核心功能
2. **整合測試** - 與現有錯誤處理系統的整合
3. **端對端測試** - Chrome Extension 環境中的實際追蹤

### 測試重點

```javascript
describe("MessageTracker 測試", () => {
  // 基本功能測試
  test("應該能夠追蹤訊息發送和接收");
  test("應該能夠識別未知訊息類型");
  test("應該能夠記錄訊息處理時間");

  // Console 整合測試
  test("應該在 Console 中提供診斷命令");
  test("應該能夠輸出格式化的診斷資訊");

  // 記憶體管理測試
  test("應該限制追蹤記錄數量");
  test("應該清理過期的追蹤記錄");

  // 錯誤處理測試
  test("應該處理追蹤過程中的錯誤");
  test("應該與 MessageErrorHandler 協作");
});
```

### 測試資料準備

```javascript
const mockMessageFlow = [
  {
    id: "msg_001",
    type: "START_EXTRACTION",
    source: "popup",
    target: "content",
    status: "sent",
    timestamp: Date.now(),
  },
  {
    id: "msg_001",
    type: "START_EXTRACTION",
    source: "popup",
    target: "content",
    status: "failed",
    timestamp: Date.now() + 100,
    error: { message: "No receiving end" },
  },
];
```

## Implementation Details

### 核心實現流程

1. **初始化階段**

   - 註冊事件監聽器
   - 設置 Console 診斷介面
   - 初始化追蹤狀態

2. **訊息追蹤階段**

   - 攔截訊息事件
   - 記錄訊息流程
   - 更新統計資訊

3. **診斷輸出階段**
   - 格式化診斷資訊
   - 輸出到 Console
   - 提供查詢介面

### 與現有系統整合

```javascript
// 與 MessageErrorHandler 整合
eventBus.on("MESSAGE.UNKNOWN_TYPE", (data) => {
  messageTracker.trackUnknownMessage(data);
});

// 與 EventErrorHandler 整合
eventBus.on("ERROR.HANDLER", (data) => {
  messageTracker.trackHandlerError(data);
});
```

### Console 診斷實現

```javascript
// 在 Chrome DevTools Console 中註冊診斷工具
if (typeof window !== "undefined") {
  window.MessageDiagnostic = {
    status: () => {
      const stats = messageTracker.getTrackingStats();
      console.table(stats);
      return stats;
    },

    messages: (limit = 10) => {
      const messages = messageTracker.getRecentMessages(limit);
      console.group("最近訊息記錄");
      messages.forEach((msg) => console.log(msg));
      console.groupEnd();
      return messages;
    },

    unknown: () => {
      const unknown = messageTracker.getUnknownMessages();
      console.warn("未知訊息類型:", unknown);
      return unknown;
    },
  };
}
```
