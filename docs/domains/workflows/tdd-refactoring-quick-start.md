# 🚀 TDD 重構快速啟動指南

**建立日期**: 2025-09-16  
**適用**: 多代理人 TDD 導向錯誤處理重構
**目標**: 將 StandardError 系統遷移到新 ErrorCodes 架構

## 🎯 核心任務摘要

**從**: 複雜的 StandardError + 237+ 個複雜錯誤代碼  
**到**: 簡化的原生 Error + 15 個核心 ErrorCodes  
**方法**: Red-Green-Refactor TDD 循環  
**原則**: 保持 Use Case 功能要求，簡化錯誤分類

## 📋 立即行動檢查清單

### ✅ 第一步：環境準備 (5分鐘)
- [ ] 確認已在正確的 git 分支 (`refactor/background-service-worker-modularization`)
- [ ] 執行 `npm test` 確認當前測試狀態
- [ ] 確認 Jest 測試環境正常運作
- [ ] 選擇負責的 Domain (Background/UI/Export/E2E 等)

### ✅ 第二步：閱讀核心文件 (15分鐘)
1. **必讀**: `docs/domains/01-getting-started/simplified-error-system-design.md`
2. **必讀**: `src/core/errors/ErrorCodes.js` (15 個核心代碼)
3. **必讀**: `src/core/errors/index.js` (createError, CommonErrors API)
4. **參考**: 負責 Domain 在 `docs/domains/workflows/multi-agent-refactoring-plan.md` 中的章節

### ✅ 第三步：選擇第一個測試檔案 (5分鐘)
**建議優先順序**:
1. **Background Domain**: `tests/unit/background/adapter-factory-service.test.js`
2. **UI Domain**: `tests/unit/ui/export-ui-integration.test.js`  
3. **Export Domain**: `tests/unit/export/export-handler.test.js`
4. **其他 Domain**: 按計畫文件中的建議順序

## 🔴 Red Phase: 寫失敗測試 (TDD 第一步)

### Step 1: 找到一個 StandardError 測試
```javascript
// ❌ 找到這樣的舊測試
expect(() => operation()).toThrow(StandardError)
// 或
await expect(operation()).rejects.toMatchObject({
  code: 'COMPLEX_ERROR_CODE',
  message: expect.stringContaining('message')
})
```

### Step 2: 重寫為新 ErrorCodes 測試
```javascript
// ✅ 重寫為新測試 (先讓它失敗)
expect(() => operation()).toThrow(ErrorCodes.VALIDATION_ERROR)
// 或
expect(() => operation()).toThrow('Email is required')
// 或  
await expect(operation()).rejects.toThrow(ErrorCodes.NETWORK_ERROR)
```

### Step 3: 執行測試確認失敗
```bash
npm test -- --testNamePattern="your test name"
# 應該失敗，因為實作還使用舊的 StandardError
```

## 🟢 Green Phase: 最簡實作 (TDD 第二步)

### Step 1: 找到對應的實作程式碼
```javascript
// ❌ 找到這樣的舊程式碼
throw new StandardError('COMPLEX_VALIDATION_ERROR', 'Email is required', details)
```

### Step 2: 改為最簡單的新實作
```javascript
// ✅ 最簡單的新實作
throw new Error(`${ErrorCodes.VALIDATION_ERROR}: Email is required`)

// 或使用預編譯錯誤 (如果有)
throw CommonErrors.EMAIL_REQUIRED
```

### Step 3: 執行測試確認通過
```bash
npm test -- --testNamePattern="your test name"
# 應該通過
```

## 🔧 Refactor Phase: 架構優化 (TDD 第三步)

### 效能優化選項
```javascript
// 選項 1: 使用預編譯錯誤 (熱路徑優化)
throw CommonErrors.EMAIL_REQUIRED

// 選項 2: 帶額外資訊 (需要時)
const error = new Error(`${ErrorCodes.VALIDATION_ERROR}: Email is required`)
error.details = { field: 'email', input: data }
throw error

// 選項 3: 使用 createError 輔助函數
throw createError(ErrorCodes.VALIDATION_ERROR, 'Email is required', { field: 'email' })
```

### 重複執行測試確認不破壞
```bash
npm test -- --testNamePattern="your test name"
# 重構後仍應通過
```

## 📊 Use Case 功能對應快速參考

| Use Case | 功能需求 | 舊錯誤代碼範例 | 新 ErrorCodes |
|----------|----------|----------------|---------------|
| UC-01 首次安裝 | DOM 元素檢測 | `DOM_READMOO_PAGE_NOT_DETECTED` | `ErrorCodes.DOM_ERROR` |
| UC-01 首次安裝 | 權限檢查 | `PLATFORM_PERMISSIONS_DENIED` | `ErrorCodes.PERMISSION_ERROR` |
| UC-02 資料提取 | 網路連接 | `NETWORK_READMOO_UNREACHABLE` | `ErrorCodes.NETWORK_ERROR` |
| UC-02 資料提取 | 資料驗證 | `DATA_BOOK_VALIDATION_FAILED` | `ErrorCodes.VALIDATION_ERROR` |
| UC-03 資料匯出 | 檔案操作 | `DATA_EXPORT_INTEGRITY_VIOLATION` | `ErrorCodes.FILE_ERROR` |

## 🚨 常見錯誤避免

### ❌ 不要這樣做
```javascript
// 不要混用舊新系統
throw new StandardError(ErrorCodes.VALIDATION_ERROR, 'message')

// 不要使用複雜的測試格式
expect(error).toMatchObject({ 
  code: ErrorCodes.VALIDATION_ERROR,
  details: expect.any(Object)
})

// 不要在一次提交中修改太多檔案
```

### ✅ 正確做法
```javascript
// 完全使用新系統
throw new Error(`${ErrorCodes.VALIDATION_ERROR}: Email is required`)

// 簡單直接的測試
expect(() => operation()).toThrow(ErrorCodes.VALIDATION_ERROR)

// 每次只修改一個測試檔案，確保可控
```

## 🔄 循環執行策略

### 單檔案循環 (推薦)
1. 在一個測試檔案中找 1-2 個 StandardError 測試
2. 執行完整的 Red-Green-Refactor 循環
3. 提交 git (小步提交)
4. 繼續同檔案的下一個測試
5. 完成整個檔案後再換下一個檔案

### 執行指令範例
```bash
# 1. Red: 修改測試
# 2. 確認測試失敗
npm test tests/unit/background/adapter-factory-service.test.js

# 3. Green: 修改實作
# 4. 確認測試通過  
npm test tests/unit/background/adapter-factory-service.test.js

# 5. Refactor: 優化程式碼
# 6. 確認仍通過
npm test tests/unit/background/adapter-factory-service.test.js

# 7. 提交
git add . && git commit -m "refactor: TDD 重構 adapter-factory-service 錯誤處理 (Red-Green-Refactor)"
```

## 📈 進度追蹤

### 每完成一個測試檔案
- [ ] 所有測試使用新 ErrorCodes
- [ ] 100% 測試通過
- [ ] 無 StandardError 殘留  
- [ ] Git 提交記錄清晰
- [ ] 功能要求維持不變

### 每完成一個 Domain
- [ ] 回報完成狀況到主要計畫
- [ ] 執行完整回歸測試
- [ ] 記錄效能改善數據
- [ ] 更新相關文件

---

## 🎯 立即開始

**選擇一個 Domain，找到第一個測試檔案，開始第一個 Red-Green-Refactor 循環！**

記住：**測試先行，小步前進，功能保證**

**問題回報**: 如遇到困難，請參考 `docs/domains/workflows/multi-agent-refactoring-plan.md` 或回報給主協調者。