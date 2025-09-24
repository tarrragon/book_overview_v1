# Logger + ErrorCodes 整合標準

## 問題分析

### 當前架構不一致問題

1. **Logger使用模式混亂**
   - 99%使用模式：`Logger.info('直接字串')` (靜態調用 + 硬編碼字串)
   - 1%使用模式：`new Logger().info('messageKey')` (實例調用 + 訊息鍵)
   - 影響範圍：113個檔案

2. **ErrorCodes系統未整合**
   - ErrorCodes系統已建立但未與Logger整合
   - 錯誤記錄缺乏結構化代碼追蹤
   - 實體測試需要錯誤代碼比對支援

## 整合設計標準

### 核心設計原則

1. **向後相容性**：支援現有`Logger.info('字串')`使用模式
2. **ErrorCodes整合**：自動將ErrorCodes融入日誌記錄
3. **實體測試支援**：LOG輸出格式支援自動化比對
4. **漸進式遷移**：允許段階式升級到標準模式

### 新的統一Logger設計

```javascript
// 核心Logger實例，支援三種調用模式

// 模式1: 直接字串 (向後相容)
Logger.info('[Component] Operation completed')

// 模式2: ErrorCodes + 訊息
Logger.error('[Component] Operation failed', {
  errorCode: ErrorCodes.OPERATION_FAILED,
  details: error
})

// 模式3: 標準實例模式 (最佳實踐)
const logger = Logger.createComponent('ComponentName')
logger.error('OPERATION_FAILED', {
  errorCode: ErrorCodes.OPERATION_FAILED,
  originalError: error
})
```

### 實作策略

#### 1. Logger類別擴展

```javascript
class Logger {
  // 現有實例方法保持不變
  info(messageKey, data = {}) { /* 現有邏輯 */ }

  // 新增靜態方法支援
  static info(message, options = {}) {
    return Logger._staticInstance.logWithString('INFO', message, options)
  }

  static createComponent(componentName) {
    return new Logger(componentName)
  }

  // 新的整合方法
  logWithString(level, message, options = {}) {
    const logData = {
      timestamp: Date.now(),
      level,
      component: this.name,
      message,
      ...(options.errorCode && { errorCode: options.errorCode }),
      ...(options.details && { details: options.details })
    }

    this._consoleOutput(level, logData)
  }
}
```

#### 2. 錯誤記錄標準化

```javascript
// popup-error-handler.js 標準化範例

class PopupErrorHandler {
  constructor() {
    this.logger = Logger.createComponent('PopupErrorHandler')
  }

  handleInitializationError(error) {
    // 使用ErrorCodes + Logger整合
    this.logger.error('INITIALIZATION_FAILED', {
      errorCode: ErrorCodes.POPUP_INITIALIZATION_ERROR,
      originalError: error,
      component: 'popup-error-handler',
      action: 'initialize'
    })
  }
}
```

### 實體測試支援設計

#### LOG輸出格式標準

```json
{
  "timestamp": 1727179200000,
  "level": "ERROR",
  "component": "PopupErrorHandler",
  "message": "Initialization failed",
  "errorCode": "POPUP_INITIALIZATION_ERROR",
  "details": {
    "originalError": "...",
    "action": "initialize"
  }
}
```

#### 比對支援功能

1. **錯誤代碼追蹤**：每個錯誤都有對應ErrorCodes
2. **組件識別**：清楚標識錯誤來源組件
3. **結構化資料**：支援自動化分析和比對

### 遷移計畫

#### 階段1: 基礎支援 (當前階段)
- 修復測試環境Logger支援
- 建立Logger靜態方法相容層
- 確保100%測試通過率

#### 階段2: 標準化重點組件
- 修復popup-error-handler.js使用正確Logger模式
- 整合ErrorCodes到關鍵錯誤處理
- 驗證實體測試LOG比對功能

#### 階段3: 全面遷移 (後續版本)
- 漸進式更新113個檔案的Logger使用
- 建立自動化檢查規則
- 完整ErrorCodes覆蓋

## 測試環境配置

### 全域Logger設定 (tests/test-setup.js)

```javascript
// 支援靜態和實例兩種模式的Logger設定
const Logger = {
  // 靜態方法 (向後相容)
  info: (message, options) => globalLoggerInstance.logWithString('INFO', message, options),
  warn: (message, options) => globalLoggerInstance.logWithString('WARN', message, options),
  error: (message, options) => globalLoggerInstance.logWithString('ERROR', message, options),
  debug: (message, options) => globalLoggerInstance.logWithString('DEBUG', message, options),

  // 組件Logger創建 (最佳實踐)
  createComponent: (name) => new LoggerClass(name)
}
```

## 品質指標

1. **測試通過率**：100% (Logger錯誤為零)
2. **ErrorCodes整合率**：關鍵錯誤處理100%使用ErrorCodes
3. **實體測試支援**：LOG格式完全相容自動化比對

## 結論

此整合標準解決了Logger使用模式不一致問題，同時建立了ErrorCodes和實體測試的完整支援，確保專案品質和可維護性。