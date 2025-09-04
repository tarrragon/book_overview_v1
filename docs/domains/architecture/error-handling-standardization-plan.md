# 📋 系統化錯誤處理與文字管理標準化方案

**版本**: v1.0  
**建立日期**: 2025-09-03  
**狀態**: 規劃階段  
**優先級**: 高 (核心架構改進)

## 🎯 問題分析

根據 v0.10.7 和 v0.10.9 工作記錄觀察，當前系統存在：

### 核心問題
1. **文字不統一**：大小寫、內容略有差異的 console.log 輸出
2. **錯誤處理不規範**：使用文字判斷而非結構化異常
3. **缺乏統一回應格式**：success/failure 沒有一致的檢核模型
4. **文字內容分散**：所有輸出文字分散在程式碼中

### 影響範圍
- 測試穩定性：文字比對導致的測試失敗
- 開發效率：大量時間花費在調整文字不一致問題
- 程式碼品質：錯誤處理邏輯分散且不一致
- 維護成本：修改訊息需要搜尋多個檔案

## 🏗 解決方案架構

### 1. 統一異常管理系統
```
src/core/exceptions/
├── BaseException.js          # 基礎異常類別
├── ValidationException.js    # 驗證相關異常
├── NetworkException.js       # 網路相關異常
├── StorageException.js       # 儲存相關異常
├── BusinessException.js      # 業務邏輯異常
└── index.js                 # 異常類別統一匯出
```

**BaseException 特性**:
- 錯誤代碼 (errorCode)
- 錯誤類型 (errorType) 
- 結構化錯誤詳情 (details)
- 堆疊追蹤 (stackTrace)
- 時間戳記 (timestamp)

### 2. 統一回應格式模型
```
src/core/models/
├── ApiResponse.js            # 統一 API 回應格式
├── ValidationResult.js       # 驗證結果格式
├── OperationResult.js        # 操作結果格式
├── ErrorDetails.js          # 錯誤詳細資訊格式
└── index.js                 # 模型統一匯出
```

**統一回應格式**:
```javascript
{
  success: boolean,
  data: object | null,
  error: {
    code: string,
    type: string,
    message: string,
    details: object
  } | null,
  metadata: {
    timestamp: string,
    requestId: string,
    version: string
  }
}
```

### 3. 集中化文字字典系統
```
src/core/localization/
├── MessageDictionary.js      # 主要訊息字典管理器
├── dictionaries/
│   ├── ErrorMessages.js      # 錯誤訊息字典
│   ├── UserMessages.js       # 使用者提示字典
│   ├── StatusMessages.js     # 狀態訊息字典
│   ├── DebugMessages.js      # 除錯訊息字典
│   └── ValidationMessages.js # 驗證訊息字典
└── index.js                 # 字典系統統一匯出
```

**字典結構範例**:
```javascript
const ERROR_MESSAGES = {
  VALIDATION: {
    REQUIRED_FIELD: '必填欄位 {field} 不能為空',
    INVALID_TYPE: '欄位 {field} 類型錯誤，期望 {expected}，實際 {actual}',
    LENGTH_EXCEEDED: '欄位 {field} 長度超過限制 {maxLength}'
  },
  NETWORK: {
    CONNECTION_FAILED: '網路連線失敗',
    TIMEOUT: '請求逾時 ({timeout}ms)',
    UNAUTHORIZED: '未經授權的請求'
  }
}
```

### 4. 程式狀況類型枚舉
```
src/core/enums/
├── OperationStatus.js        # 操作狀態枚舉
├── ValidationStatus.js       # 驗證狀態枚舉
├── ErrorTypes.js             # 錯誤類型枚舉
├── MessageTypes.js           # 訊息類型枚舉
├── LogLevel.js              # 日誌等級枚舉
└── index.js                 # 枚舉統一匯出
```

**枚舉範例**:
```javascript
const OperationStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS', 
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
}

const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  BUSINESS_ERROR: 'BUSINESS_ERROR',
  SYSTEM_ERROR: 'SYSTEM_ERROR'
}
```

### 5. 統一日誌管理系統
```
src/core/logging/
├── Logger.js                 # 統一日誌管理器
├── LogFormatter.js          # 日誌格式化器
├── LogLevel.js              # 日誌等級定義
├── appenders/
│   ├── ConsoleAppender.js    # 控制台輸出
│   ├── FileAppender.js       # 檔案輸出
│   └── RemoteAppender.js     # 遠端日誌服務
└── index.js                 # 日誌系統統一匯出
```

**Logger 特性**:
- 分級日誌 (DEBUG, INFO, WARN, ERROR, FATAL)
- 結構化日誌格式
- 多重輸出目標
- 效能優化 (lazy evaluation)
- 日誌過濾和聚合

## 🚀 實施步驟

### Phase 1: 基礎架構建立 (預計 2-3 天)
1. **建立核心目錄結構**
   - 建立 `src/core/` 目錄結構
   - 設定模組匯出索引檔案
   
2. **定義統一異常類別體系**
   - 實現 BaseException 基礎類別
   - 建立各種特化異常類別
   - 建立異常工廠模式

3. **建立標準化回應格式模型**
   - 實現 ApiResponse, OperationResult 等基礎模型
   - 建立回應構建器 (Builder Pattern)

4. **建立程式狀況枚舉系統**
   - 定義所有狀態和類型枚舉
   - 建立枚舉驗證機制

### Phase 2: 文字字典系統 (預計 3-4 天)
1. **分析現有文字輸出**
   - 掃描所有 console.log, throw new Error 等
   - 分類和整理現有訊息文字
   
2. **建立分類文字字典**
   - 建立各類型訊息字典檔案
   - 實現參數插值機制 (template interpolation)
   
3. **實現字典載入機制**
   - 建立 MessageDictionary 管理器
   - 實現快取和懶載入機制
   
4. **建立文字一致性檢查工具**
   - ESLint 規則：禁止硬編碼字串
   - 自動化腳本：檢查字典完整性

### Phase 3: 日誌系統統一化 (預計 2-3 天)
1. **建立統一日誌管理系統**
   - 實現 Logger 核心類別
   - 建立多種 Appender

2. **替換所有 console.log**
   - 系統性替換現有日誌輸出
   - 使用適當的日誌等級

3. **實現日誌格式化**
   - 結構化日誌格式
   - 效能和除錯資訊

4. **建立日誌配置管理**
   - 環境相關的日誌配置
   - 動態日誌等級調整

### Phase 4: 系統整合與測試 (預計 4-5 天)
1. **逐步重構現有錯誤處理**
   - 識別所有錯誤處理點
   - 逐步替換為結構化異常

2. **更新測試框架**
   - 修改測試以使用新的異常類型
   - 使用結構化驗證而非字串比對

3. **建立 Lint 規則**
   - 防止硬編碼字串
   - 強制使用統一格式

4. **建立自動化檢查工具**
   - CI/CD 整合
   - 程式碼品質閘道

## 📊 技術規範

### 異常處理標準
```javascript
// ❌ 舊方式
throw new Error('Validation failed: missing title field')

// ✅ 新方式  
throw new ValidationException('REQUIRED_FIELD_MISSING', { field: 'title' })
```

### 回應格式標準
```javascript
// ❌ 舊方式
return { success: true, data: books }
return { valid: false, error: 'some error' }

// ✅ 新方式
return OperationResult.success(books)
return ValidationResult.failure(ErrorTypes.VALIDATION_ERROR, 'REQUIRED_FIELD_MISSING')
```

### 日誌輸出標準
```javascript
// ❌ 舊方式
console.log('Processing book validation...')
console.error('Validation failed:', error)

// ✅ 新方式
Logger.info('BOOK_VALIDATION_START', { bookId, platform })
Logger.error('BOOK_VALIDATION_FAILED', { bookId, error: error.toJSON() })
```

## 🎯 成功指標

### 定量指標
- [ ] 消除 100% 的硬編碼錯誤訊息
- [ ] 測試通過率達到 100% (無字串比對失敗)
- [ ] Lint 問題減少 90% 以上
- [ ] 程式碼重複度降低 50%

### 定性指標
- [ ] 所有錯誤都有明確的錯誤代碼
- [ ] 所有回應都使用統一格式
- [ ] 所有日誌都結構化且可搜尋
- [ ] 文字修改只需要更新字典檔案

## 🎁 預期效益

### 短期效益 (1-2 週內)
- ✅ **測試穩定性提升**：消除字串比對導致的測試失敗
- ✅ **開發效率提升**：減少調整文字不一致的時間
- ✅ **錯誤診斷改善**：結構化錯誤資訊更易除錯

### 長期效益 (1-3 個月內)
- ✅ **維護成本降低**：文字集中管理，修改一處即可
- ✅ **國際化準備**：字典系統為多語系奠定基礎  
- ✅ **程式碼品質**：統一的異常和回應處理
- ✅ **監控完善**：結構化日誌支援更好的監控分析

## 📋 相關文件

- [專案用語規範字典](../../claude/terminology-dictionary.md)
- [事件驅動架構規範](../../claude/event-driven-architecture.md)
- [TDD 協作開發流程](../../claude/tdd-collaboration-flow.md)
- 歷史背景： [error-handling-refactoring-design](./error-handling-refactoring-design.md) ・ [error-coordinator-specification](./error-coordinator-specification.md)

## 🔄 後續擴展

### Phase 5: 高級功能 (未來考慮)
- 多語系支援 (i18n)
- 動態訊息模板
- 錯誤自動修復建議
- 日誌智慧分析和告警
- 效能監控整合

---

**建立日期**: 2025-09-03  
**最後更新**: 2025-09-03  
**負責人**: Claude Code  
**審查者**: 待定