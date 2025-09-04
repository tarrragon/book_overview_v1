# Chrome Extension Context 運作機制與錯誤處理系統設計

## 📋 概覽

本文件詳細說明 Readmoo 書庫數據提取器中的三種 Chrome Extension 執行環境 (Context)、錯誤處理系統架構，以及除錯方法。

---

## 🏗 Chrome Extension 三大執行環境

### 1. Background Context (Service Worker)

**文件位置**: `src/background/background.js`

**執行環境**:

- 在瀏覽器背景執行的獨立環境
- 即使沒有開啟任何頁面也會運行
- 擁有最高權限，可存取所有 Chrome APIs

**主要職責**:

- 處理擴展生命週期管理
- 接收和分發跨組件訊息
- 管理擴展狀態和設定
- 處理系統級錯誤和監控

**Chrome APIs 存取權限**:

```javascript
// ✅ 完整存取權限
chrome.runtime.*     // 擴展運行時 API
chrome.tabs.*        // 標籤頁管理 API
chrome.storage.*     // 儲存 API
chrome.alarms.*      // 定時任務 API
```

**除錯方式**:

1. 前往 `chrome://extensions/`
2. 點擊擴展的「檢查檢視 -> background.html」
3. 或在開發者工具 Console 下拉選單選擇 Service Worker context

---

### 2. Content Script Context

**文件位置**: `src/content/content.js`

**執行環境**:

- 注入到目標網頁 (Readmoo) 中執行
- 與網頁共享 DOM，但 JavaScript 環境隔離
- 可以操作網頁 DOM，但無法存取網頁的 JavaScript 變數

**主要職責**:

- 從 Readmoo 頁面提取書庫資料
- 監聽和處理頁面變化
- 與 Background Script 通訊
- 處理資料提取相關錯誤

**Chrome APIs 存取權限**:

```javascript
// 🔒 限制存取權限
chrome.runtime.*     // ✅ 可存取 (訊息傳遞)
chrome.tabs.*        // ❌ 無法存取
chrome.storage.*     // ✅ 可存取
```

**除錯方式**:

1. 在 Readmoo 頁面按 F12
2. Console 下拉選單應該會顯示擴展相關的 context
3. 查看 `content.js:` 開頭的日誌訊息

---

### 3. Popup Context

**文件位置**: `src/popup/popup.js`, `src/popup/popup.html`

**執行環境**:

- 點擊擴展圖標時開啟的小視窗
- 獨立的 HTML 頁面環境
- 生命週期短暫，關閉即銷毀

**主要職責**:

- 提供使用者操作界面
- 顯示擴展狀態和進度
- 處理使用者互動事件
- 展示錯誤訊息和處理使用者錯誤

**Chrome APIs 存取權限**:

```javascript
// ✅ 中等存取權限
chrome.runtime.*     // ✅ 可存取
chrome.tabs.*        // ✅ 可存取 (需要 activeTab 權限)
chrome.storage.*     // ✅ 可存取
```

**除錯方式**:

1. 開啟 popup
2. **右鍵點擊 popup 內容區域** → 選擇「檢查」
3. 或者在 popup 開啟時按 F12
4. URL 應該顯示 `chrome-extension://[ID]/src/popup/popup.html`

---

## 🚨 錯誤處理系統架構

### 系統設計原理

我們的錯誤處理系統採用 **分層式錯誤處理架構**，確保：

1. **錯誤隔離**: 不同 context 的錯誤不會互相影響
2. **用戶友善**: 技術錯誤轉換為使用者可理解的訊息
3. **可恢復性**: 提供具體的解決步驟和重試機制
4. **可診斷性**: 詳細記錄錯誤資訊供開發者分析

### 錯誤處理層級

```
┌─────────────────────────────────────┐
│           使用者界面層                │
│    (PopupErrorHandler)              │
│  - 友善錯誤訊息顯示                   │
│  - 使用者操作引導                     │
│  - 錯誤恢復選項                       │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│          應用程式邏輯層                │
│   (popup.js, content.js)           │
│  - 業務邏輯錯誤處理                   │
│  - 狀態管理和恢復                     │
│  - 錯誤事件分發                       │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│           系統服務層                  │
│      (background.js)                │
│  - Chrome API 錯誤處理               │
│  - 跨組件錯誤協調                     │
│  - 系統級錯誤記錄                     │
└─────────────────────────────────────┘
```

---

## 🛠 錯誤處理組件詳解

### 1. PopupErrorHandler (`src/popup/popup-error-handler.js`)

**核心功能**:

- **錯誤訊息轉換**: 將技術錯誤轉為使用者友善訊息
- **系統初始化錯誤處理**: 當擴展無法正常啟動時的處理
- **擴展重新載入機制**: 提供強制和溫和兩種重新載入方式
- **診斷模式**: 收集系統資訊用於問題診斷

**關鍵方法**:

```javascript
// 處理系統初始化失敗
handleInitializationError(error)

// 顯示使用者友善錯誤
showUserFriendlyError(errorInfo)

// 強制重新載入擴展
forceReloadExtension()

// 切換診斷模式
toggleDiagnosticMode()
```

**錯誤類型映射**:

```javascript
const ERROR_TYPES = {
  BACKGROUND_SERVICE_WORKER_FAILED: {
    title: '背景服務離線',
    message: '擴展背景服務無法連線，請重新載入擴展。',
    actions: ['重新載入擴展', '重新啟動瀏覽器'],
    severity: 'critical'
  },
  MESSAGE_UNKNOWN_TYPE: {
    title: '通訊錯誤',
    message: '擴展組件通訊出現問題，請嘗試重新載入擴展。',
    actions: ['重新載入擴展', '重新整理頁面'],
    severity: 'warning'
  }
  // ... 更多錯誤類型
}
```

### 2. 錯誤配置系統 (`src/config/error-config.js`)

**設計目的**:

- 集中管理所有錯誤訊息和處理策略
- 支援多語言錯誤訊息 (目前為繁體中文)
- 提供診斷建議和解決步驟

**配置結構**:

```javascript
{
  title: '錯誤標題',
  message: '詳細錯誤描述',
  actions: ['解決步驟1', '解決步驟2'],
  severity: 'critical|warning|info'
}
```

### 3. 系統初始化錯誤系統 (`src/error-handling/error-system-init.js`)

**職責**:

- 統一初始化所有錯誤處理組件
- 建立錯誤處理鏈
- 確保錯誤處理系統的可靠性

---

## 🔍 除錯方法與最佳實踐

### Popup Context 除錯問題解決

**問題**: Console 中找不到 popup context，或顯示錯誤的 URL

**解決方法**:

1. **正確開啟 Popup 除錯**:

   ```bash
   1. 關閉目前的 popup
   2. 右鍵點擊擴展圖標
   3. 選擇「檢查彈出式視窗」或「Inspect popup」
   4. 這會開啟專用的開發者工具視窗
   ```

2. **替代方法**:

   ```bash
   1. 開啟 popup
   2. 在 popup 內容區域按右鍵
   3. 選擇「檢查」或「Inspect」
   ```

3. **驗證正確 Context**:
   ```javascript
   // 應該看到類似這樣的 URL
   console.log(window.location.href)
   // chrome-extension://[extension-id]/src/popup/popup.html
   ```

### 常見除錯指令

**檢查 Chrome Extension APIs**:

```javascript
// 檢查 Chrome APIs 可用性
console.log('Chrome APIs:', {
  runtime: typeof chrome?.runtime,
  tabs: typeof chrome?.tabs,
  storage: typeof chrome?.storage
})
```

**檢查擴展版本**:

```javascript
// 獲取擴展版本
if (chrome?.runtime?.getManifest) {
  console.log('Extension version:', chrome.runtime.getManifest().version)
}
```

**手動觸發版本更新**:

```javascript
// 手動呼叫版本顯示更新
if (typeof updateVersionDisplay === 'function') {
  updateVersionDisplay()
}
```

**檢查 DOM 元素**:

```javascript
// 檢查版本顯示元素
const versionElement = document.getElementById('versionDisplay')
console.log('Version element:', versionElement)
console.log('Current text:', versionElement?.textContent)
```

---

## 📝 開發和維護指南

### 新增錯誤類型

1. **在 `src/config/error-config.js` 中新增錯誤定義**:

```javascript
'NEW_ERROR_TYPE': {
  title: '錯誤標題',
  message: '錯誤描述',
  actions: ['解決步驟'],
  severity: 'warning'
}
```

2. **在相關組件中使用**:

```javascript
errorHandler.showUserFriendlyError({
  type: 'NEW_ERROR_TYPE',
  data: { additionalInfo: 'extra data' }
})
```

### 修改版本顯示邏輯

**位置**: `src/popup/popup.js` 的 `updateVersionDisplay()` 函數

**修改要點**:

```javascript
function updateVersionDisplay() {
  // 自定義版本判斷邏輯
  const isDevelopment = version.includes('dev') || version.startsWith('0.')

  // 自定義版本文字格式
  const versionText = isDevelopment ? `v${version} 開發版本` : `v${version}`
}
```

### 新增除錯日誌

**原則**:

- 使用 `[DEBUG]` 前綴標識除錯訊息
- 生產環境應移除除錯日誌
- 使用適當的日誌層級 (log, warn, error)

**範例**:

```javascript
console.log('[DEBUG] 功能開始執行')
console.warn('[DEBUG] 潛在問題:', warningData)
console.error('[DEBUG] 發生錯誤:', errorData)
```

### 測試錯誤處理

**單元測試**: `tests/unit/popup/popup-error-handler.test.js`

- 涵蓋所有核心功能
- 模擬各種錯誤情境
- 驗證 DOM 操作正確性

**整合測試建議**:

1. 測試跨組件錯誤傳遞
2. 驗證使用者操作流程
3. 檢查錯誤恢復機制

---

## ⚡ 效能考量

### 錯誤處理效能優化

1. **延遲載入錯誤配置**:
   - 只在需要時載入錯誤配置
   - 避免影響擴展啟動速度

2. **DOM 操作優化**:
   - 快取 DOM 元素引用
   - 批量更新 DOM 屬性

3. **記憶體管理**:
   - 適當清理事件監聽器
   - 避免記憶體洩漏

### 除錯模式效能

在生產環境中，建議：

- 移除所有 `[DEBUG]` 日誌
- 簡化錯誤處理邏輯
- 優化診斷資料收集

---

## 🔮 未來改進方向

### 1. 錯誤追蹤系統

- 整合第三方錯誤追蹤服務 (如 Sentry)
- 自動錯誤報告機制
- 使用者回饋收集系統

### 2. 智慧錯誤恢復

- AI 驅動的錯誤分析
- 自動錯誤修復嘗試
- 學習使用者行為模式

### 3. 多語言支援

- 國際化錯誤訊息
- 動態語言切換
- 地區化解決方案

---

## 📚 相關文件參考

- [Chrome Extension API 文件](https://developer.chrome.com/docs/extensions/)
- [Service Worker 生命週期](https://developer.chrome.com/docs/extensions/mv3/service_workers/)
- [Content Scripts 指南](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)

---

**最後更新**: 2024-08-08
**版本**: v0.5.33
**作者**: Claude Code Development Team
