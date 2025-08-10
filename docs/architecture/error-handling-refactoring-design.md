# 錯誤處理架構重構設計文件

## 📋 文件資訊
- **標題**: 錯誤處理架構重構設計
- **版本**: 1.0.0
- **日期**: 2025-08-10
- **狀態**: 設計階段
- **作者**: Claude Code Assistant

## 🎯 重構目標

### 主要問題描述
在 v0.6.15-v0.6.20 期間，專案遭遇嚴重的錯誤處理架構問題：
- **循環依賴**：ErrorHandler 透過 HandlerRegistry 註冊造成錯誤處理的循環依賴
- **無限遞迴**：ErrorHandler 處理錯誤時若自身拋出錯誤會再次觸發錯誤處理機制
- **記憶體溢出**：無限循環導致 Node heap OOM 和 RangeError
- **測試不穩定**：錯誤處理測試頻繁失敗，需要臨時跳過或添加重入保護機制

### 核心重構目標
1. **徹底消除循環依賴**：建立獨立的錯誤處理架構
2. **確保錯誤處理穩定性**：防止錯誤處理自身產生無限循環
3. **提升系統可靠性**：建立可靠的錯誤恢復和處理機制
4. **改善測試穩定性**：確保錯誤處理相關測試穩定通過

## 🏗 架構設計

### 現有架構問題分析

#### 當前錯誤處理流程
```
業務處理器 → HandlerRegistry → EventBus → ErrorHandler → HandlerRegistry
                     ↑                            ↓
                     ←←←← 錯誤處理失敗時循環 ←←←←
```

#### 問題點識別
1. **ErrorHandler 註冊方式**：透過 HandlerRegistry.register() 註冊
2. **事件通道混合**：業務事件和錯誤事件使用同一個 EventBus
3. **錯誤處理失敗時的處理**：會再次觸發 HandlerRegistry 的錯誤處理邏輯
4. **重入保護是臨時方案**：目前的 `_processingError` 旗標只是治標不治本

### 新架構設計

#### 設計原則
1. **分離關注點**：業務處理和錯誤處理完全分離
2. **單向資料流**：錯誤只能向上流動，不能形成循環
3. **獨立錯誤通道**：建立專門的錯誤事件通道
4. **零循環依賴**：錯誤處理組件不依賴業務處理組件

#### 新架構流程圖
```
業務層: BusinessEventBus → HandlerRegistry → 業務處理器
                              ↓ (錯誤發生)
錯誤層: SystemEventBus → ErrorCoordinator → ErrorHandler
                              ↓ (處理結果)  
           記錄/通知/恢復策略 (不回流到業務層)
```

## 🔧 核心組件設計

### 1. ErrorCoordinator (錯誤協調器)

#### 職責
- 統一管理所有錯誤處理流程
- 協調不同類型錯誤的處理策略
- 提供錯誤處理的統一接口
- 防止錯誤處理的循環觸發

#### 核心接口設計
```typescript
class ErrorCoordinator {
  constructor(systemEventBus: EventBus, options?: ErrorCoordinatorOptions)
  
  // 核心方法
  handleError(error: ProcessingError): Promise<ErrorResult>
  registerErrorHandler(handler: IErrorHandler): void
  unregisterErrorHandler(handlerName: string): boolean
  
  // 錯誤分類和路由
  classifyError(error: Error): ErrorCategory
  routeError(error: ProcessingError): Promise<ErrorResult>
  
  // 錯誤統計和監控
  getErrorStats(): ErrorStatistics
  generateErrorReport(): ErrorReport
}
```

#### 關鍵特性
- **獨立實例化**：不透過 HandlerRegistry 註冊
- **專用事件通道**：只使用 SystemEventBus
- **錯誤隔離**：錯誤處理失敗不影響業務流程
- **重入保護**：內建防止錯誤處理循環的機制

### 2. 雙通道事件系統

#### BusinessEventBus (業務事件匯流排)
```typescript
class BusinessEventBus extends EventBus {
  // 專門處理業務事件
  emit(eventType: BusinessEventType, data: any): Promise<any>
  on(eventType: BusinessEventType, handler: BusinessEventHandler): void
}
```

#### SystemEventBus (系統事件匯流排)
```typescript
class SystemEventBus extends EventBus {
  // 專門處理系統事件（錯誤、監控、診斷）
  emit(eventType: SystemEventType, data: any): Promise<any>
  on(eventType: SystemEventType, handler: SystemEventHandler): void
}
```

#### 事件類型分離
```typescript
// 業務事件類型
enum BusinessEventType {
  EXPORT_CSV_REQUESTED = 'BUSINESS.EXPORT.CSV.REQUESTED',
  EXPORT_JSON_REQUESTED = 'BUSINESS.EXPORT.JSON.REQUESTED',
  DATA_EXTRACTION_COMPLETED = 'BUSINESS.DATA.EXTRACTION.COMPLETED'
}

// 系統事件類型
enum SystemEventType {
  EXPORT_ERROR_OCCURRED = 'SYSTEM.ERROR.EXPORT.OCCURRED',
  MEMORY_WARNING = 'SYSTEM.MONITOR.MEMORY.WARNING',
  PERFORMANCE_DEGRADATION = 'SYSTEM.MONITOR.PERFORMANCE.DEGRADATION'
}
```

### 3. 錯誤資料結構標準化

#### ProcessingError 標準格式
```typescript
interface ProcessingError {
  // 基本資訊
  id: string;
  timestamp: number;
  message: string;
  originalError: Error;
  
  // 上下文資訊
  context: {
    component: string;       // 發生錯誤的組件
    operation: string;       // 執行的操作
    inputData?: any;        // 輸入資料
    userId?: string;        // 使用者識別
  };
  
  // 處理資訊
  classification: ErrorCategory;
  severity: ErrorSeverity;
  recoverable: boolean;
  
  // 追蹤資訊
  stackTrace: string;
  correlationId: string;   // 關聯 ID，用於追蹤相關事件
}
```

#### ErrorResult 處理結果
```typescript
interface ErrorResult {
  processed: boolean;
  strategy: ErrorHandlingStrategy;
  actions: ErrorAction[];
  recommendation: string;
  retryable: boolean;
  metadata: Record<string, any>;
}
```

## 📊 錯誤分類和處理策略

### 錯誤分類體系
```typescript
enum ErrorCategory {
  // 業務邏輯錯誤
  BUSINESS_LOGIC = 'business_logic',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  
  // 技術錯誤
  NETWORK = 'network',
  STORAGE = 'storage',
  MEMORY = 'memory',
  TIMEOUT = 'timeout',
  
  // 系統錯誤
  CONFIGURATION = 'configuration',
  DEPENDENCY = 'dependency',
  UNKNOWN = 'unknown'
}
```

### 處理策略對應
| 錯誤類別 | 處理策略 | 重試機制 | 使用者通知 |
|----------|----------|----------|------------|
| BUSINESS_LOGIC | 記錄 + 使用者提示 | 不重試 | 友善錯誤訊息 |
| NETWORK | 自動重試 + 降級 | 指數退避 | 載入狀態 |
| MEMORY | 清理 + 重新載入 | 一次重試 | 效能警告 |
| VALIDATION | 輸入檢查提示 | 不重試 | 驗證錯誤詳情 |

## 🔄 遷移策略

### 階段一：建立新架構 (不破壞現有功能)
1. 建立 ErrorCoordinator 和 SystemEventBus
2. 建立錯誤資料結構和處理策略
3. 編寫完整的單元測試

### 階段二：逐步遷移錯誤處理
1. 將 HandlerRegistry 的錯誤發送改為使用 SystemEventBus
2. ErrorHandler 改為透過 ErrorCoordinator 註冊
3. 移除 HandlerRegistry 中的重入保護機制

### 階段三：全面測試和優化
1. 恢復所有被跳過的錯誤處理測試
2. 壓力測試新架構的穩定性
3. 效能測試和記憶體使用監控

## 🧪 測試策略

### 單元測試覆蓋
- ErrorCoordinator 所有方法
- 雙通道事件系統
- 錯誤分類和路由邏輯
- 錯誤處理策略執行

### 整合測試重點
- 業務處理器錯誤觸發系統事件
- ErrorCoordinator 接收和處理錯誤
- 錯誤處理不影響正常業務流程
- 錯誤處理自身失敗的隔離

### 壓力測試場景
- 大量並發錯誤處理
- 錯誤處理器自身錯誤
- 記憶體壓力下的錯誤處理
- 長時間運行的穩定性

## ⚠️ 風險評估

### 高風險項目
1. **API 相容性**：現有錯誤處理接口可能需要調整
2. **事件流變更**：錯誤事件流的改變可能影響現有監控
3. **效能影響**：雙通道事件系統可能增加輕微效能開銷

### 風險緩解策略
1. **向後相容**：保持現有 API 接口不變，只改內部實現
2. **漸進式遷移**：分階段實施，每階段都有回滾計劃
3. **完整測試**：每個遷移階段都有完整的測試覆蓋
4. **監控機制**：實時監控新架構的效能和穩定性

## 📈 成功指標

### 定量指標
- 錯誤處理相關測試 100% 通過
- 錯誤處理記憶體使用 < 10MB
- 錯誤處理響應時間 < 100ms
- 零無限循環或 OOM 事件

### 定性指標
- 錯誤處理邏輯清晰可維護
- 測試穩定性大幅提升
- 開發者除錯效率改善
- 使用者錯誤體驗改善

## 📝 後續工作

### 立即執行 (本週)
- [ ] 完成 ErrorCoordinator 詳細 API 設計
- [ ] 建立雙通道事件系統規範
- [ ] 編寫遷移計劃和時程安排

### 短期目標 (2週內)
- [ ] 實作 ErrorCoordinator 和 SystemEventBus
- [ ] 完成新架構的單元測試
- [ ] 開始階段一的實作和遷移

### 中期目標 (1個月內)
- [ ] 完成整體架構遷移
- [ ] 恢復所有錯誤處理測試
- [ ] 系統穩定性驗證和優化

---

*本文件將隨著實作進度持續更新，所有重大變更都會記錄在工作日誌中。*