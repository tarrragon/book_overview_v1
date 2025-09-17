# 🤖 多代理人錯誤處理重構計畫 v1.0

**建立日期**: 2025-09-16
**基於**: 簡化錯誤處理系統 v5.0.0 (原生 Error + ErrorCodes)
**目標**: 系統性遷移專案中所有錯誤處理到新架構

## 🎯 重構總覽

### 核心變革
- **從**: 複雜的 StandardError 類別系統
- **到**: 簡化的原生 JavaScript Error + 15 個 ErrorCodes
- **影響範圍**: 237+ 個錯誤處理問題需要重構
- **預期效益**: 效能提升 2-10x，記憶體減少 35-40%

### TDD 重構原則
1. **測試先行**: 按照新 ErrorCodes 重寫所有錯誤測試
2. **簡單優於複雜**: 使用原生 JavaScript Error API
3. **效能優先**: 避免不必要的抽象層
4. **驗收導向**: 滿足 Use Case 功能要求，但使用新錯誤架構
5. **一致性**: 15 個核心 ErrorCodes 統一使用

## 📋 Domain 重構分工

### 🏗 重構執行架構

```
主協調者 (Main Coordinator)
├── Background Domain Agent
├── Popup Domain Agent  
├── UI Domain Agent
├── Export Domain Agent
├── Content Domain Agent
├── Storage Domain Agent
├── Integration Domain Agent
├── E2E/Helper Domain Agent
├── Core Domain Agent
└── Handlers Domain Agent
```

## 🎯 各 Domain 重構規範

### 📚 必讀參考文件 (所有代理人)

**核心設計文件**:
1. `docs/domains/01-getting-started/simplified-error-system-design.md` - 新架構完整設計
2. `src/core/errors/ErrorCodes.js` - 15 個核心錯誤代碼定義
3. `src/core/errors/index.js` - 簡化 API 使用指南

**重構指引文件**:
4. `docs/domains/workflows/multi-agent-refactoring-plan.md` - 本計畫文件
5. `CLAUDE.md` - 專案開發規範 (錯誤處理規範章節)

### 🔧 標準重構模式

#### 模式 1: TDD 測試先行遷移
```javascript
// ❌ 舊的 StandardError 測試模式
expect(() => operation()).toThrow(StandardError)
await expect(operation()).rejects.toMatchObject({
  code: 'COMPLEX_ERROR_CODE',
  message: expect.stringContaining('message')
})

// ✅ 新的原生 Error 測試模式
expect(() => operation()).toThrow('Email is required')
expect(() => operation()).toThrow(/VALIDATION_ERROR/)
await expect(operation()).rejects.toThrow(ErrorCodes.VALIDATION_ERROR)

// ✅ TDD 重構流程
describe('BookExtractor', () => {
  it('should throw VALIDATION_ERROR when title is missing', () => {
    // Red: 先寫測試
    expect(() => extractBook({})).toThrow(ErrorCodes.VALIDATION_ERROR)
    
    // Green: 實作功能
    // Refactor: 使用新架構優化
  })
})
```

#### 模式 2: 功能導向錯誤處理遷移
```javascript
// ❌ 舊模式：複雜的 StandardError
throw new StandardError('DOM_READMOO_PAGE_NOT_DETECTED', 'message', details)

// ✅ 新模式 1：簡單直接
throw new Error(`${ErrorCodes.DOM_ERROR}: 無法檢測到 Readmoo 書庫頁面`)

// ✅ 新模式 2：使用預編譯錯誤（效能優化）
throw CommonErrors.READMOO_PAGE_NOT_FOUND

// ✅ 新模式 3：帶額外資訊（需要時）
const error = new Error(`${ErrorCodes.DOM_ERROR}: 頁面元素未找到`)
error.details = { selectors: ['.book-item'], url: window.location.href }
throw error
```

#### 模式 3: Use Case 導向錯誤分類對應
```javascript
// Use Case 功能需求 → 新 ErrorCodes 對應
// UC-01: 首次安裝與設定
'DOM_READMOO_PAGE_NOT_DETECTED'     → ErrorCodes.DOM_ERROR
'PLATFORM_EXTENSION_PERMISSIONS'    → ErrorCodes.PERMISSION_ERROR
'SYSTEM_STORAGE_QUOTA_EXCEEDED'     → ErrorCodes.STORAGE_ERROR

// UC-02: 日常書籍資料提取  
'NETWORK_READMOO_UNREACHABLE'       → ErrorCodes.NETWORK_ERROR
'DATA_BOOK_VALIDATION_FAILED'       → ErrorCodes.VALIDATION_ERROR

// UC-03: 資料匯出與備份
'DATA_EXPORT_INTEGRITY_VIOLATION'   → ErrorCodes.FILE_ERROR
'PLATFORM_FILE_DOWNLOAD_FAILED'     → ErrorCodes.PERMISSION_ERROR

// 重點：保持功能要求，簡化錯誤分類
```

## 🏢 各 Domain 詳細重構計畫

### 1️⃣ Background Domain Agent

**範圍**: `tests/unit/background/`
**問題數**: 30+ 個錯誤處理問題
**優先級**: 🔴 Critical

**TDD 重構任務**:
- [ ] **Red**: 重寫所有背景服務錯誤測試，使用新 ErrorCodes
  - `adapter-factory-service.test.js`: 重寫 3 處 StandardError 測試
  - `data-validation-service.test.js`: 統一錯誤測試模式
- [ ] **Green**: 修改實作程式碼滿足新測試
  - 移除 StandardError 引用
  - 使用 ErrorCodes.OPERATION_ERROR, VALIDATION_ERROR, CHROME_ERROR
- [ ] **Refactor**: 使用預編譯錯誤優化效能熱路徑

**功能對應 (維持 Use Case 要求)**:
- Background Service 啟動失敗 → ErrorCodes.CHROME_ERROR
- 資料驗證失敗 → ErrorCodes.VALIDATION_ERROR
- Adapter 配置錯誤 → ErrorCodes.CONFIG_ERROR

**預期成果**:
- 100% 測試通過率 (TDD 保證)
- 背景服務錯誤處理簡化但功能完整
- 效能改善 2-10x (可測量)

### 2️⃣ UI Domain Agent

**範圍**: `tests/unit/ui/`  
**問題數**: 38+ 個錯誤處理問題
**優先級**: 🔴 Critical

**TDD 重構任務**:
- [ ] **Red**: 重寫 UI 相關錯誤測試
  - `export-ui-integration.test.js`: 15+ 處測試重寫 (UC-03 對應)
  - `search/filter/filter-engine.test.js`: 5+ 處測試重寫 (UC-06 對應)
  - `overview-page.test.js`: 異步錯誤測試格式統一
- [ ] **Green**: UI 組件錯誤處理實作
  - DOM 操作錯誤使用 ErrorCodes.DOM_ERROR
  - 使用者輸入驗證使用 ErrorCodes.VALIDATION_ERROR
- [ ] **Refactor**: UI 錯誤顯示和使用者體驗優化

**功能對應 (符合 Use Case v2.0)**:
- 頁面元素載入失敗 → ErrorCodes.DOM_ERROR
- 搜尋篩選異常 → ErrorCodes.OPERATION_ERROR  
- 資料展示錯誤 → ErrorCodes.VALIDATION_ERROR
- 檔案匯出 UI 錯誤 → ErrorCodes.FILE_ERROR

**特殊考量**:
- 保持異步錯誤處理的使用者友善性
- 維持 UI 回應性，避免錯誤阻塞介面

### 3️⃣ Export Domain Agent

**範圍**: `tests/unit/export/`
**問題數**: 27+ 個錯誤處理問題 (部分已修復)
**優先級**: 🟡 High

**重構任務**:
- [ ] 完成剩餘 Export 測試檔案遷移
- [ ] 統一使用 ErrorCodes.FILE_ERROR, NETWORK_ERROR, STORAGE_ERROR
- [ ] 重構匯出流程錯誤處理
- [ ] 確保 CommonErrors.BOOK_EXTRACTION_FAILED 正確使用

**已完成部分**:
- export-progress-notifier.test.js ✅
- export-user-feedback.test.js ✅  
- book-data-exporter.test.js ✅

### 4️⃣ E2E/Helper Domain Agent

**範圍**: `tests/e2e/`, `tests/helpers/`
**問題數**: 47+ 個錯誤處理問題
**優先級**: 🟡 High

**重構任務**:
- [ ] 重構 `extension-setup.js` E2E 測試基礎設施
- [ ] 重構 `cross-device-sync.test.js` 跨設備同步測試
- [ ] 重構所有 Helper 檔案錯誤處理
- [ ] 統一使用 ErrorCodes.CHROME_ERROR, CONNECTION_ERROR, TIMEOUT_ERROR

**特殊考量**:
- E2E 測試環境的錯誤處理一致性
- Helper 工具的錯誤傳播機制

### 5️⃣ Popup Domain Agent

**範圍**: `tests/unit/popup/`
**問題數**: 25+ 個錯誤處理問題 (部分已修復)
**優先級**: 🟢 Medium

**重構任務**:
- [ ] 完成 popup-controller-extraction-integration.test.js 遷移
- [ ] 完成 popup-extraction-service.test.js 遷移  
- [ ] 統一使用 ErrorCodes.CHROME_ERROR, VALIDATION_ERROR

### 6️⃣ Content Domain Agent

**範圍**: `tests/unit/content/`
**問題數**: 19+ 個錯誤處理問題
**優先級**: 🟢 Medium

**重構任務**:
- [ ] 重構 Content Script 相關錯誤處理
- [ ] 統一使用 ErrorCodes.DOM_ERROR, READMOO_ERROR

### 7️⃣ Storage Domain Agent

**範圍**: `tests/unit/storage/`
**問題數**: 11 個錯誤處理問題
**優先級**: 🟢 Medium

**重構任務**:
- [ ] 重構儲存相關錯誤處理
- [ ] 統一使用 ErrorCodes.STORAGE_ERROR

### 8️⃣ Integration Domain Agent

**範圍**: `tests/integration/`
**問題數**: 7 個錯誤處理問題 (多數已修復)
**優先級**: 🟢 Low

**重構任務**:
- [ ] 驗證整合測試錯誤處理一致性
- [ ] 確保跨模組錯誤傳播正確

### 9️⃣ Core Domain Agent

**範圍**: `src/core/`, `tests/unit/core/`
**問題數**: 核心架構 (已大部分重構)
**優先級**: 🟢 Low

**重構任務**:
- [ ] 驗證核心錯誤處理模組
- [ ] 確保 SearchCoordinator 等核心元件使用新架構

### 🔟 Handlers Domain Agent

**範圍**: `tests/unit/handlers/`
**問題數**: 4 個錯誤處理問題
**優先級**: 🟢 Low

**重構任務**:
- [ ] 重構事件處理器錯誤處理
- [ ] 統一使用 ErrorCodes.OPERATION_ERROR

## 📊 TDD 執行階段規劃

### Phase 1: Critical Priority TDD 重構 (週 1)
**Red-Green-Refactor 循環**:
- Background Domain Agent (30+ 問題) - TDD 重寫
- UI Domain Agent (38+ 問題) - TDD 重寫
- **目標**: 68+ 個關鍵測試重寫，100% 通過率

### Phase 2: High Priority TDD 重構 (週 2) 
- Export Domain Agent (27+ 問題) - 對應 UC-03
- E2E/Helper Domain Agent (47+ 問題) - 整合測試重寫
- **目標**: 74+ 個測試按新架構重構，保持功能完整

### Phase 3: Medium/Low Priority TDD 完善 (週 3)
- 其餘 6 個 Domain Agents (58+ 問題)
- **重點**: 確保每個 Use Case 功能要求都有對應測試覆蓋

### Phase 4: TDD 驗收與整合 (週 4)
- **全面 TDD 驗收**: 所有測試按新 ErrorCodes 重寫完成
- **功能驗收**: 滿足 Use Case v2.0 所有功能要求
- **效能基準**: 驗證 2-10x 效能提升目標
- **文件同步**: 更新所有相關技術文件

### TDD 品質門檻
- **每個階段結束前**: 100% 測試通過率
- **重構過程中**: 隨時可回滾的 git 分支管理
- **功能驗證**: Use Case 對應的功能測試必須通過

## 🎯 成功標準

### 技術指標
- [ ] 所有測試通過率 100%
- [ ] 零 StandardError 殘留引用
- [ ] 所有錯誤使用 15 個核心 ErrorCodes
- [ ] ESLint 錯誤處理相關警告清零

### 品質指標  
- [ ] 錯誤建立效能提升 2-10x (可測量)
- [ ] 記憶體使用減少 35-40% (可測量)
- [ ] 程式碼複雜度降低 (可測量)

### 可維護性指標
- [ ] 統一的錯誤處理模式
- [ ] 清晰的測試錯誤驗證
- [ ] 零學習成本的 API 使用

## 🚨 風險管控

### 主要風險
1. **測試破壞風險**: 重構可能破壞現有測試
2. **功能回歸風險**: 錯誤處理變更影響功能
3. **效能回歸風險**: 新架構未達預期效能

### 風險緩解策略
1. **分階段執行**: 按 Domain 分批重構，降低影響範圍
2. **回歸測試**: 每個 Domain 完成後立即執行完整測試
3. **效能監控**: 建立效能基準，持續監控改善效果
4. **回滾準備**: 保持 git 分支清潔，隨時可回滾

## 📝 TDD 導向執行檢查清單

### 代理人啟動前檢查
- [ ] 閱讀新 ErrorCodes 系統設計文件
- [ ] 理解 15 個核心錯誤代碼分類
- [ ] 熟悉 Red-Green-Refactor TDD 循環
- [ ] 確認負責 Domain 的 Use Case 對應關係
- [ ] 準備測試先行的開發環境

### TDD 執行過程檢查
- [ ] **Red Phase**: 先寫失敗的測試（使用新 ErrorCodes）
- [ ] **Green Phase**: 實作最簡單的程式碼使測試通過
- [ ] **Refactor Phase**: 使用新架構優化程式碼
- [ ] 保持每個循環測試通過率 100%
- [ ] 記錄 Use Case 功能要求的對應情況

### 每個 Domain 完成後檢查
- [ ] 所有測試使用新 ErrorCodes 且 100% 通過
- [ ] Use Case 對應的功能需求完全滿足
- [ ] 無任何 StandardError 殘留引用
- [ ] 效能改善可測量 (2-10x 目標)
- [ ] TDD 測試覆蓋所有錯誤情境

### 整合驗收檢查  
- [ ] 跨 Domain 錯誤處理一致性
- [ ] Use Case v2.0 功能驗收 100% 通過
- [ ] 新架構效能基準達標
- [ ] 完整的迴歸測試執行

---

**這個計畫將確保專案從複雜的 StandardError 系統平穩遷移到簡化高效的原生 Error + ErrorCodes 架構。**