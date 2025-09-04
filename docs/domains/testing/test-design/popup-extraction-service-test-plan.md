# PopupExtractionService 測試架構設計

## 📋 需求分析階段

### 功能需求和驗收標準

**PopupExtractionService** 是一個業務邏輯協調服務，負責整合三個核心組件：

1. **PopupStatusManager**: 管理擴展狀態（loading, ready, error, extracting, completed）
2. **PopupProgressManager**: 管理提取進度（0-100%）和視覺效果
3. **PopupCommunicationService**: 處理 Chrome Extension 通訊和訊息傳遞

### 驗收標準定義

#### 業務邏輯協調驗收標準

- 能夠初始化所有依賴組件並建立正確的協調關係
- 提供完整的提取流程控制 API（開始/暫停/取消/重試）
- 實現參數驗證和配置管理功能
- 確保組件間數據同步和狀態一致性

#### 流程控制驗收標準

- 支援完整的提取生命週期管理
- 實現錯誤恢復和重試機制（最多 3 次重試）
- 支援批次處理和進度追蹤
- 提供取消操作和清理機制

#### 資料處理協調驗收標準

- 協調與 Content Script 的雙向通訊
- 實現提取結果的驗證和格式化
- 管理提取統計和進度報告
- 提供錯誤處理和診斷資訊

### 邊界條件和異常情況

#### 組件初始化邊界條件

- 依賴組件為 null、undefined 或無效物件
- 組件初始化失敗或拋出異常
- 組件方法不存在或不可呼叫

#### 通訊異常情況

- Chrome Extension API 不可用或失效
- Content Script 未載入或通訊失敗
- 網路連線問題導致通訊超時
- Background Service Worker 無回應

#### 提取流程異常情況

- 重複開始提取操作
- 在未開始狀態下執行暫停/取消
- 提取過程中發生未預期錯誤
- 超過最大重試次數
- 資料格式驗證失敗

## 🏗 單元測試架構設計

### 組件測試策略

#### 依賴注入模式設計

```javascript
class PopupExtractionService {
  constructor(statusManager, progressManager, communicationService, options = {}) {
    // 驗證必要依賴
    // 設定預設選項
    // 初始化內部狀態
  }
}
```

#### Mock 整合測試設計

- **StatusManager Mock**: 模擬狀態更新、獲取當前狀態、錯誤處理
- **ProgressManager Mock**: 模擬進度更新、開始/完成/取消進度
- **CommunicationService Mock**: 模擬通訊成功/失敗、超時、Chrome API 錯誤

### 組件級測試場景

#### 建構函數和初始化測試

1. **正常初始化**: 提供有效依賴組件，驗證初始化成功
2. **依賴驗證**: 驗證 null/undefined 依賴時拋出適當錯誤
3. **選項設定**: 驗證預設選項和自定義選項正確設定
4. **內部狀態**: 驗證初始化後內部狀態正確

#### 業務邏輯協調測試

1. **狀態同步**: 驗證三個組件間狀態正確同步
2. **事件流程**: 驗證事件在組件間正確傳播
3. **資料轉換**: 驗證組件間資料格式正確轉換
4. **錯誤傳播**: 驗證錯誤在組件間正確傳播和處理

### 邊界條件和錯誤場景

#### 組件通訊失敗場景

1. **StatusManager 失效**: 模擬狀態更新失敗，驗證錯誤處理
2. **ProgressManager 失效**: 模擬進度更新失敗，驗證恢復機制
3. **CommunicationService 失效**: 模擬通訊失敗，驗證重試邏輯

#### 併發和競爭條件

1. **同時多個提取請求**: 驗證只允許一個活躍提取
2. **快速連續操作**: 驗證操作序列正確處理
3. **取消期間狀態變更**: 驗證取消操作的原子性

## 🔍 具體測試案例規格

### 核心功能測試組

#### 1. 建構和初始化測試組

**測試組描述**: 驗證 PopupExtractionService 正確初始化和依賴管理

##### Test Case 1.1: 正常初始化

```
Given: 有效的 statusManager、progressManager 和 communicationService 實例
When: 建構 PopupExtractionService
Then:
  - 服務初始化成功
  - 內部狀態設為 'idle'
  - 所有依賴正確儲存
  - 預設選項正確設定
```

##### Test Case 1.2: 依賴驗證失敗

```
Given: statusManager 為 null
When: 建構 PopupExtractionService
Then:
  - 拋出 Error('StatusManager is required')
  - 服務未初始化
```

##### Test Case 1.3: 自定義選項設定

```
Given: 自定義選項 { retryCount: 5, timeout: 10000 }
When: 建構 PopupExtractionService
Then:
  - 選項正確設定
  - 重試次數為 5
  - 超時時間為 10000ms
```

#### 2. 提取流程控制測試組

**測試組描述**: 驗證完整的提取生命週期管理

##### Test Case 2.1: 正常提取流程

```
Given: 服務已初始化且狀態為 'idle'
When: 呼叫 startExtraction()
Then:
  - 狀態變更為 'extracting'
  - 進度管理器開始進度顯示
  - 通訊服務發送開始指令
  - 回傳 Promise 解析為提取結果
```

##### Test Case 2.2: 重複開始提取

```
Given: 提取已在進行中（狀態為 'extracting'）
When: 再次呼叫 startExtraction()
Then:
  - 拋出 Error('Extraction already in progress')
  - 狀態保持為 'extracting'
  - 不發送重複的開始指令
```

##### Test Case 2.3: 取消提取操作

```
Given: 提取正在進行中
When: 呼叫 cancelExtraction()
Then:
  - 狀態變更為 'cancelled'
  - 進度管理器取消進度顯示
  - 通知所有組件取消操作
  - 清理內部資源
```

#### 3. 錯誤處理和重試測試組

**測試組描述**: 驗證錯誤恢復和重試機制

##### Test Case 3.1: 通訊失敗重試

```
Given: CommunicationService.startExtraction() 前兩次失敗
When: 呼叫 startExtraction()
Then:
  - 自動重試最多 3 次
  - 每次重試間有延遲
  - 第三次成功後正常繼續
  - 狀態正確更新
```

##### Test Case 3.2: 超過最大重試次數

```
Given: CommunicationService.startExtraction() 持續失敗
When: 呼叫 startExtraction()
Then:
  - 重試 3 次後停止
  - 狀態變更為 'error'
  - 顯示錯誤訊息
  - Promise 被拒絕並帶有錯誤資訊
```

##### Test Case 3.3: 部分組件失敗恢復

```
Given: ProgressManager.updateProgress() 失敗
When: 提取過程中更新進度
Then:
  - 記錄錯誤但不中斷提取
  - 狀態管理器顯示警告
  - 提取流程繼續進行
  - 最終狀態仍為成功
```

#### 4. 資料處理協調測試組

**測試組描述**: 驗證資料處理和格式化功能

##### Test Case 4.1: 提取結果驗證

```
Given: Content Script 回傳原始提取資料
When: 處理提取完成事件
Then:
  - 驗證資料格式正確性
  - 標準化資料欄位
  - 更新統計資訊
  - 觸發完成事件
```

##### Test Case 4.2: 無效資料處理

```
Given: Content Script 回傳格式錯誤的資料
When: 處理提取完成事件
Then:
  - 識別資料格式錯誤
  - 狀態變更為 'error'
  - 提供詳細錯誤資訊
  - 不儲存無效資料
```

##### Test Case 4.3: 批次處理進度追蹤

```
Given: 大量書籍需要處理
When: 執行批次提取
Then:
  - 正確計算總體進度
  - 定期更新進度顯示
  - 處理個別項目失敗
  - 提供詳細統計報告
```

#### 5. 組件整合協調測試組

**測試組描述**: 驗證三個組件間的協調工作

##### Test Case 5.1: 狀態同步協調

```
Given: 提取狀態發生變更
When: 狀態從 'extracting' 變為 'completed'
Then:
  - StatusManager 狀態正確更新
  - ProgressManager 顯示完成進度
  - CommunicationService 停止監聽
  - 所有組件狀態一致
```

##### Test Case 5.2: 事件流程協調

```
Given: CommunicationService 接收到進度事件
When: 處理 'EXTRACTION_PROGRESS' 事件
Then:
  - 事件資料正確解析
  - ProgressManager 更新進度顯示
  - StatusManager 更新狀態文字
  - 整體協調無衝突
```

##### Test Case 5.3: 錯誤處理協調

```
Given: ProgressManager 更新失敗
When: 處理進度更新錯誤
Then:
  - StatusManager 顯示警告狀態
  - 錯誤資訊正確傳播
  - 不影響其他組件操作
  - 提供適當的使用者回饋
```

## 🧪 測試環境設計

### Mock 物件設計規格

#### StatusManager Mock 實作

```javascript
const mockStatusManager = {
  updateStatus: jest.fn(),
  getCurrentStatus: jest.fn(() => ({ type: 'ready', text: '準備就緒' })),
  syncFromBackground: jest.fn(),
  handleSyncFailure: jest.fn()
}
```

#### ProgressManager Mock 實作

```javascript
const mockProgressManager = {
  updateProgress: jest.fn(),
  startProgress: jest.fn(),
  completeProgress: jest.fn(),
  cancelProgress: jest.fn(),
  getCurrentProgress: jest.fn(() => ({ percentage: 0, status: 'idle' }))
}
```

#### CommunicationService Mock 實作

```javascript
const mockCommunicationService = {
  checkBackgroundStatus: jest.fn(() => Promise.resolve({ status: 'ready' })),
  startExtraction: jest.fn(() => Promise.resolve({ success: true })),
  isReadmooPage: jest.fn(() => true),
  initialize: jest.fn(),
  cleanup: jest.fn()
}
```

### 測試資料設計

#### 標準測試資料集

```javascript
const testData = {
  validExtractionResult: {
    books: [
      { id: '1', title: '測試書籍1', progress: '已完成' },
      { id: '2', title: '測試書籍2', progress: '閱讀中' }
    ],
    totalProcessed: 2,
    successCount: 2,
    failureCount: 0
  },

  invalidExtractionResult: {
    // 缺少必要欄位的錯誤資料
    books: null,
    error: '資料格式錯誤'
  },

  progressUpdateData: {
    percentage: 50,
    status: 'extracting',
    text: '正在處理第 1/2 本書'
  }
}
```

## 🔍 測試覆蓋率要求

### 程式碼覆蓋率目標

- **語句覆蓋率**: 100%
- **分支覆蓋率**: 100%
- **函數覆蓋率**: 100%
- **行覆蓋率**: 100%

### 功能覆蓋率檢查清單

#### 核心功能覆蓋

- [ ] 建構函數和初始化邏輯
- [ ] 依賴注入和驗證機制
- [ ] 提取流程開始/取消/重試
- [ ] 錯誤處理和恢復機制
- [ ] 組件間協調和同步
- [ ] 資料驗證和格式化
- [ ] 批次處理和進度追蹤
- [ ] 資源清理和生命週期管理

#### 邊界條件覆蓋

- [ ] 所有參數邊界值測試
- [ ] 異常輸入處理驗證
- [ ] 併發操作處理測試
- [ ] 組件失效場景驗證
- [ ] 通訊異常處理測試
- [ ] 資源不足處理測試
- [ ] 超時情況處理驗證

#### 整合場景覆蓋

- [ ] 三組件正常協作場景
- [ ] 部分組件失效場景
- [ ] 複雜事件流程場景
- [ ] 錯誤傳播處理場景
- [ ] 狀態同步驗證場景
- [ ] 完整生命週期場景

## 📋 測試執行計劃

### 測試組織結構

```
tests/unit/popup/
├── popup-extraction-service.test.js       # 主要測試檔案
├── mocks/
│   ├── status-manager.mock.js            # StatusManager mock
│   ├── progress-manager.mock.js          # ProgressManager mock
│   └── communication-service.mock.js     # CommunicationService mock
└── test-data/
    ├── extraction-results.json           # 測試資料集
    ├── progress-data.json               # 進度測試資料
    └── error-scenarios.json             # 錯誤場景資料
```

### 測試執行策略

1. **單元測試優先**: 每個方法獨立測試，確保功能正確
2. **整合測試驗證**: 組件協作場景測試，確保協調正確
3. **邊界條件驗證**: 異常和邊界情況測試，確保健全性
4. **效能基準測試**: 批次處理和大量資料測試，確保效能

### 測試品質保證

- 每個測試案例都有明確的 Given-When-Then 結構
- 所有 Mock 物件都有完整的驗證邏輯
- 異步操作都有適當的超時和錯誤處理
- 測試資料覆蓋所有可能的輸入情況
- 每個測試都是獨立且可重複執行的

## 📊 成功標準和驗證機制

### 測試成功標準

1. **100% 測試通過**: 所有測試案例都必須通過
2. **100% 程式碼覆蓋**: 達到完整的程式碼覆蓋率
3. **零架構債務**: 不存在已知的設計問題
4. **效能基準達標**: 滿足效能要求和使用者體驗標準

### 品質驗證機制

1. **自動化測試**: 整合到 CI/CD 流程中自動執行
2. **覆蓋率報告**: 生成詳細的測試覆蓋率報告
3. **效能監控**: 監控測試執行時間和記憶體使用
4. **回歸測試**: 確保新功能不破壞既有功能

---

**文件版本**: 1.0.0  
**建立日期**: 2025-08-18  
**最後更新**: 2025-08-18  
**作者**: TDD 測試設計專家 (claude.ai/code)
