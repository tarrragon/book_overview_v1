# 資料流架構與已知陷阱

> 本文件記錄書籍提取到顯示的完整資料流架構、各環節的技術約束、以及開發過程中驗證過的陷阱。
> 修改資料流相關程式碼前必讀。

---

## 資料流總覽

```
[1] Content Script (Readmoo 頁面)
     │ ReadmooAdapter.parseBookElement() → extractAllBooks()
     │ eventBus.emit('EXTRACTION.COMPLETED', { booksData })
     │
     v
[2] Chrome Event Bridge (content-modular.js)
     │ contentChromeBridge.forwardEventToBackground(eventType, data)
     │ → chrome.runtime.sendMessage({ type: 'CONTENT.EVENT.FORWARD', eventType, data })
     │
     v
[3] Background Service Worker (message-router.js)
     │ chromeMessageListener → routeMessage → routeBySource('content-script')
     │ → ContentMessageHandler.handleMessage()
     │ → handleContentEventForward() → eventBus.emit('EXTRACTION.COMPLETED', data)
     │
     v
[4] EventCoordinator (event-coordinator.js)
     │ registerExtractionListeners() 中的 EXTRACTION.COMPLETED listener
     │ → chrome.storage.local.set({ readmoo_books: { books, timestamp, count } })
     │
     v
[5] Overview Page (overview-page-controller.js)
     │ chrome.storage.local.get(['readmoo_books'])
     │ → renderBooksTable(books)
     └─ 也監聽 chrome.storage.onChanged 即時更新
```

---

## 各環節技術約束

### [1] Content Script → 提取

| 約束 | 說明 |
|------|------|
| DOM 選擇器脆弱 | Readmoo 頁面結構會變更，主選擇器 `.library-item` 可能失效 |
| 必要/可選欄位分離 | title 或任一 ID 來源存在即保留，cover/progress/href 失敗留空不丟棄 |
| 封面 URL 安全過濾 | 不安全 URL 清空但不丟棄整筆，批量彙整警告避免洗版 |
| LAST_RESORT 策略 | 主選擇器失敗時向上查找 `.library-item` 父容器 |

### [2] Content Script → Background 通訊

| 約束 | 說明 |
|------|------|
| chrome.runtime.sendMessage | Content Script 透過此 API 將事件轉發到 Background SW |
| 訊息格式 | `{ type: 'CONTENT.EVENT.FORWARD', eventType: string, data: object }` |
| eventBus 隔離 | Content Script 和 Background 的 eventBus 是不同實例，不能直接通訊 |

### [3] Background Service Worker — 訊息路由

| 約束 | 說明 |
|------|------|
| **listener 必須同步回傳 true** | `chrome.runtime.onMessage` 的 callback 不可用 async，必須同步 `return true` 保持通道開啟 |
| ContentMessageHandler 必須注入 | MessageRouter 建構時必須傳入 contentMessageHandler，否則所有 content-script 訊息被丟棄 |
| 訊息來源路由 | `from` 欄位決定路由：`content-script` → ContentMessageHandler，`popup` → PopupMessageHandler |

### [4] EventCoordinator — 事件監聽與儲存

| 約束 | 說明 |
|------|------|
| **必須 initialize() + start()** | 只呼叫 initialize() 不夠，registerCoreListeners() 在 start() 的 _doStart() 中 |
| storage key | `readmoo_books`，值結構：`{ books: [], extractionTimestamp, extractionCount, source }` |
| tags 正規化 | 每本書自動加入 `readmoo` tag |

### [5] Overview Page — 讀取與顯示

| 約束 | 說明 |
|------|------|
| chrome.storage.local.get | 讀取 `readmoo_books` key |
| 即時更新 | 監聽 `chrome.storage.onChanged` 事件，提取完成後自動刷新 |
| 空資料處理 | 無資料時顯示空表格，不報錯 |

---

## 已驗證的陷阱

以下是開發過程中實際踩過的坑，每個都有對應的修復 commit。

### 1. async listener 導致訊息通道關閉

```javascript
// 錯誤：async 回傳 Promise，Chrome 不認為是 true
this.listener = async (message, sender, sendResponse) => {
  await someAsyncWork()
  sendResponse(result)
  return true  // Chrome 收到的是 Promise，通道已關閉
}

// 正確：同步回傳 true，非同步邏輯分離
this.listener = (message, sender, sendResponse) => {
  this._handleAsync(message, sender, sendResponse)
  return true  // 同步回傳 true，通道保持開啟
}
```

### 2. 模組組裝遺漏（Coordinator 層）

模組化架構中，**單元測試全過不代表系統可用**。最危險的 bug 在組裝層：
- 依賴未注入（constructor 的 optional dependency 為 null）
- 生命週期不完整（只 initialize 沒 start）
- 事件監聽器未註冊（listener 在 start 階段才註冊）

這類問題的特徵：**無明確錯誤，只有不起眼的警告**（如「沒有處理器處理訊息類型」）。

### 3. Build 入口點遺漏

Chrome Extension 的 esbuild bundling 必須涵蓋所有入口點：
- background.js
- content-modular.js
- popup.js
- **overview.js**（容易遺漏）

遺漏入口點的結果：頁面載入時 `require is not defined`。

### 4. CJS/ESM 不相容

Chrome Extension Manifest V3 不支援 CJS `require()`。所有模組必須在 build 階段透過 esbuild 打包為 IIFE。混用 CJS/ESM 會導致 Service Worker 註冊失敗（Status code 15）。

### 5. DOM 選擇器脆弱性

Readmoo 頁面的 DOM 結構會隨版本更新變化。選擇器設計原則：
- 多層 fallback（主選擇器 → 備用選擇器 → LAST_RESORT）
- 可選欄位失敗不丟棄整筆
- 提取結果需實機驗證（測試環境的 DOM 與生產環境不同）

---

## 診斷指南

資料流不通時的排查順序：

| 步驟 | 檢查位置 | 關鍵日誌 |
|------|---------|---------|
| 1 | Content Script console | `EXTRACTION_COMPLETED` — 提取是否成功 |
| 2 | Background SW console（chrome://extensions → Service Worker 連結） | `CONTENT.EVENT.FORWARD` 是否被路由、`EXTRACTION.COMPLETED` 監聽器是否已註冊 |
| 3 | Background SW console | `準備儲存 N 本書籍到 Chrome Storage` — 儲存是否執行 |
| 4 | Overview 頁面 console | `Chrome Storage 中沒有書籍資料` 或 `提取時間:` — 讀取是否成功 |

**注意**: 這 4 個環節的 console 是分開的，需要在不同的 DevTools 視窗中查看。

---

## 相關文件

- `docs/chrome-extension-dev-guide.md` — Chrome Extension 環境限制總覽
- `.claude/error-patterns/architecture/ARCH-010-module-assembly-omission.md` — 模組組裝遺漏錯誤模式
- `src/content/adapters/readmoo-adapter.js` — 提取層實作
- `src/background/messaging/message-router.js` — 訊息路由層
- `src/background/events/event-coordinator.js` — 事件監聽與儲存層
- `src/overview/overview-page-controller.js` — 顯示層

---

## 已知殘留問題

| 問題 | 說明 |
|------|------|
| URL 全部相同 | 96 本書的 reader URL 都是同一個，推測 LAST_RESORT 選擇器匹配到錯誤元素 |
| 主選擇器持續失敗 | `.library-item` 每次都走 FALLBACK → LAST_RESORT 路徑 |
| 2 個 messageKey 缺翻譯 | CONTAINER_SAMPLE、EXTRACTION_SAMPLE_DATA 顯示 [Missing] |

---

**Last Updated**: 2026-03-29
