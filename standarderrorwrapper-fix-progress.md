# StandardErrorWrapper 修復進度報告

## 總體進度

**修復狀態**: 進行中
**開始時檔案數**: 123 個檔案
**目前剩餘檔案數**: 115 個檔案
**已完成檔案數**: 8 個檔案
**完成率**: 6.5%

**錯誤引用數量**:
- 修復前: 494 個引用
- 目前剩餘: 486 個引用
- 已修復: 8 個引用

## 已修復的檔案

### ✅ 核心錯誤處理系統 (4/4 完成)
- [x] `src/core/errors/StandardError.js` - 修復文件範例
- [x] `src/core/error-handling/error-classifier.js` - 1 個引用
- [x] `src/core/error-handling/error-recovery-coordinator.js` - 3 個引用
- [x] `src/core/error-handling/system-error-handler.js` - 3 個引用

### ✅ 核心事件系統 (2/3 完成)
- [x] `src/core/events/event-type-definitions.js` - 4 個引用
- [x] `src/core/events/event-priority-manager.js` - 2 個引用
- [ ] `src/core/events/event-naming-upgrade-coordinator.js` - 待修復

### ✅ Background 生命週期 (1/4 完成)
- [x] `src/background/lifecycle/base-module.js` - 1 個引用
- [ ] `src/background/lifecycle/startup-handler.js` - 待修復
- [ ] `src/background/lifecycle/install-handler.js` - 待修復
- [ ] `src/background/lifecycle/shutdown-handler.js` - 待修復

### ✅ UI 控制器 (1/1 完成)
- [x] `src/overview/overview-page-controller.js` - 8 個引用

## 下一階段修復計畫

### 🎯 優先級 1: 核心系統檔案 (高影響)
1. **錯誤處理核心**:
   - `src/core/migration/StandardErrorWrapper.js` (17 個引用) - 遷移檔案本身
   - `src/core/migration/AutoMigrationConverter.js` (9 個引用)
   - `src/core/migration/DualErrorSystemBridge.js` (4 個引用)

2. **事件系統**:
   - `src/core/events/event-naming-upgrade-coordinator.js` (1 個引用)
   - `src/core/enums/LogLevel.js` (1 個引用)
   - `src/core/messages/MessageDictionary.js` (3 個引用)

### 🎯 優先級 2: Background 服務 (中影響)
1. **Background 生命週期**:
   - `src/background/lifecycle/startup-handler.js` (1 個引用)
   - `src/background/lifecycle/install-handler.js` (1 個引用)
   - `src/background/lifecycle/shutdown-handler.js` (1 個引用)

2. **Background 訊息處理**:
   - `src/background/messaging/popup-message-handler.js` (11 個引用)
   - `src/background/messaging/chrome-api-wrapper.js` (5 個引用)
   - `src/background/messaging/content-message-handler.js` (3 個引用)

3. **Domain 服務** (大量檔案):
   - 80+ 個 domain service 檔案

### 🎯 優先級 3: UI 和工具 (低影響)
1. **Popup 組件**:
   - `src/popup/popup-controller.js` (6 個引用)
   - `src/popup/popup-event-controller.js` (8 個引用)
   - 其他 popup 組件

2. **匯出功能**:
   - `src/export/export-manager.js` (9 個引用)
   - `src/export/book-data-exporter.js` (8 個引用)
   - 其他 export handlers

3. **儲存和 UI**:
   - Storage handlers
   - UI search 組件
   - Content scripts

## 修復策略

### 🔧 批量修復模式
使用 sed 指令進行批量替換：
```bash
# 基本替換
find src/ -name "*.js" -exec sed -i '' 's/new StandardErrorWrapper(/new StandardError(/g' {} \;
find src/ -name "*.js" -exec sed -i '' 's/throw new StandardErrorWrapper(/throw new StandardError(/g' {} \;
find src/ -name "*.js" -exec sed -i '' 's/StandardErrorWrapper/StandardError/g' {} \;
```

### 🎯 手動檢查重點
1. **模板字串修復**: 確保 `${}` 插值語法正確
2. **錯誤碼一致性**: 使用 ErrorCodes v5.0.0 標準
3. **參數格式**: 確保 `{ category }` 格式正確
4. **向後相容性**: 確保不破壞現有功能

## 預估完成時間

- **核心系統檔案**: 1 小時
- **Background 服務**: 2 小時
- **UI 和工具檔案**: 1.5 小時
- **測試和驗證**: 30 分鐘

**總預估時間**: 5 小時

## 後續任務

1. ✅ **完成所有 StandardErrorWrapper 修復**
2. **執行完整測試套件** - 確保無破壞性變更
3. **更新 lint 檢查** - 驗證錯誤數量歸零
4. **文件更新** - 更新遷移文件和最佳實踐指引
5. **清理遷移檔案** - 移除 StandardErrorWrapper 相關檔案

---

**最後更新**: 2025-09-17
**負責人**: mint-format-specialist
**階段**: ErrorCodes v5.0.0 遷移 - StandardErrorWrapper 清理