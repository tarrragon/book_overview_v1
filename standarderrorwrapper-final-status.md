# StandardErrorWrapper 修復最終狀況報告

## 🎯 任務目標
將所有專案中的 `StandardErrorWrapper` 引用替換為 `StandardError`，完成 ErrorCodes v5.0.0 遷移的最後階段。

## 📊 修復進度總覽

### 修復統計
- **初始檔案數**: 123 個檔案包含 StandardErrorWrapper 引用
- **目前已修復檔案數**: 約 15 個檔案 (手動修復)
- **剩餘待修復檔案數**: 約 108 個檔案
- **修復完成率**: ~12%

### 修復類型分析
- **簡單替換**: ~70% (只需要 StandardErrorWrapper → StandardError)
- **模板字串修復**: ~25% (需要修復 '${var}' → `${var}`)
- **複雜邏輯修復**: ~5% (需要手動審查業務邏輯)

## ✅ 已完成修復的檔案

### 核心錯誤處理系統 (100% 完成)
- [x] `src/core/errors/StandardError.js` - 修復文件範例
- [x] `src/core/error-handling/error-classifier.js` - 1 個引用
- [x] `src/core/error-handling/error-recovery-coordinator.js` - 3 個引用
- [x] `src/core/error-handling/system-error-handler.js` - 3 個引用

### 核心事件系統 (67% 完成)
- [x] `src/core/events/event-type-definitions.js` - 4 個引用
- [x] `src/core/events/event-priority-manager.js` - 2 個引用
- [ ] `src/core/events/event-naming-upgrade-coordinator.js` - 1 個引用

### Background 生命週期 (25% 完成)
- [x] `src/background/lifecycle/base-module.js` - 1 個引用
- [ ] `src/background/lifecycle/startup-handler.js` - 1 個引用
- [ ] `src/background/lifecycle/install-handler.js` - 1 個引用
- [ ] `src/background/lifecycle/shutdown-handler.js` - 1 個引用

### UI 控制器 (100% 完成)
- [x] `src/overview/overview-page-controller.js` - 8 個引用

### Popup 控制器 (100% 完成)
- [x] `src/popup/popup-controller.js` - 6 個引用

### Background 訊息處理 (18% 完成)
- [x] `src/background/messaging/popup-message-handler.js` - 2/11 個引用已修復
- [ ] `src/background/messaging/chrome-api-wrapper.js` - 5 個引用
- [ ] `src/background/messaging/content-message-handler.js` - 3 個引用

## 🔄 批量修復策略

### 自動化修復腳本
已建立 `fix-all-standarderrorwrapper.sh` 腳本，包含：

1. **基本替換**:
   ```bash
   sed -i '' 's/new StandardErrorWrapper(/new StandardError(/g'
   sed -i '' 's/throw new StandardErrorWrapper(/throw new StandardError(/g'
   sed -i '' 's/StandardErrorWrapper/StandardError/g'
   ```

2. **模板字串修復**:
   ```bash
   sed -i '' "s/'\\([^']*\\)\\${\\([^}]*\\)}\\([^']*\\)'/\`\\1\\${\\2}\\3\`/g"
   ```

3. **語法驗證**:
   ```bash
   node -c "$file"  # 檢查 JavaScript 語法
   ```

### 手動修復重點

#### 高優先級檔案 (影響核心功能)
1. **核心遷移檔案**:
   - `src/core/migration/StandardErrorWrapper.js` (17 個引用) - 遷移檔案本身
   - `src/core/migration/AutoMigrationConverter.js` (9 個引用)
   - `src/core/migration/DualErrorSystemBridge.js` (4 個引用)

2. **關鍵業務邏輯**:
   - `src/export/export-manager.js` (9 個引用)
   - `src/export/book-data-exporter.js` (8 個引用)
   - `src/background/messaging/popup-message-handler.js` (剩餘 9 個引用)

#### 中優先級檔案 (影響功能穩定性)
1. **Domain 服務** (80+ 個檔案):
   - `src/background/domains/` 下的所有服務檔案
   - 大部分是 1-3 個引用，適合批量處理

2. **UI 搜尋組件**:
   - `src/ui/search/coordinator/search-coordinator.js` (20 個引用)
   - `src/ui/handlers/ui-event-validator.js` (12 個引用)

#### 低優先級檔案 (影響範圍有限)
1. **工具和輔助檔案**:
   - Content scripts
   - Storage handlers
   - Popup 組件

## 🚨 常見問題模式

### 模板字串錯誤
```javascript
// ❌ 錯誤 (單引號無法插值)
throw new StandardErrorWrapper('ERROR', '錯誤: ${message}', {})

// ✅ 正確 (反引號支援插值)
throw new StandardError('ERROR', `錯誤: ${message}`, {})
```

### 錯誤碼標準化
```javascript
// ❌ 避免使用通用錯誤碼
throw new StandardError('UNKNOWN_ERROR', message)

// ✅ 使用具體錯誤碼
throw new StandardError('VALIDATION_ERROR', message)
throw new StandardError('INITIALIZATION_ERROR', message)
```

### 參數格式一致性
```javascript
// ✅ 標準格式
throw new StandardError('ERROR_CODE', 'Error message', {
  category: 'category_name',
  details: { ... }
})
```

## 📈 預估工作量

### 剩餘工作時間估算
- **自動化批量修復**: 30 分鐘 (執行腳本 + 驗證)
- **手動修復複雜案例**: 2 小時
- **測試和驗證**: 1 小時
- **文件更新**: 30 分鐘

**總計**: 約 4 小時

### 修復階段規劃

#### 第一階段: 自動化批量修復 (30 分鐘)
1. 執行 `fix-all-standarderrorwrapper.sh` 腳本
2. 檢查語法錯誤
3. 修復腳本處理失敗的案例

#### 第二階段: 手動修復重點檔案 (2 小時)
1. 核心遷移檔案 (45 分鐘)
2. 關鍵業務邏輯檔案 (45 分鐘)
3. 複雜模板字串問題 (30 分鐘)

#### 第三階段: 測試驗證 (1 小時)
1. 執行 lint 檢查
2. 執行測試套件
3. 手動功能測試

#### 第四階段: 清理收尾 (30 分鐘)
1. 更新文件
2. 清理遷移檔案
3. 產生最終報告

## 🎯 成功標準

### 完成條件
- [ ] `grep -r "StandardErrorWrapper" src/` 回傳 0 結果
- [ ] 所有 JavaScript 檔案語法檢查通過
- [ ] 核心測試套件執行通過
- [ ] ESLint 檢查無 StandardErrorWrapper 相關錯誤

### 品質檢查
- [ ] 所有模板字串使用正確的反引號語法
- [ ] 錯誤碼符合 ErrorCodes v5.0.0 標準
- [ ] 錯誤處理邏輯保持一致性
- [ ] 無破壞性變更

## 📝 下一步行動

### 立即行動 (今日完成)
1. **執行自動化腳本**: 使用 `fix-all-standarderrorwrapper.sh` 處理大部分檔案
2. **修復核心檔案**: 手動處理 core/migration/ 下的檔案
3. **驗證修復結果**: 確保無語法錯誤

### 後續任務 (本周完成)
1. **完整測試**: 執行所有測試套件
2. **文件更新**: 更新 ErrorCodes 遷移文件
3. **清理工作**: 移除不再需要的遷移檔案

---

**報告產生時間**: 2025-09-17 15:30
**負責人**: mint-format-specialist
**當前階段**: ErrorCodes v5.0.0 遷移 - StandardErrorWrapper 清理階段
**預計完成時間**: 2025-09-17 19:30