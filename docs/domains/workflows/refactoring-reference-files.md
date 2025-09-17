# 📚 TDD 重構參考文件清單

**用途**: 多代理人 TDD 導向錯誤處理重構必讀文件  
**更新日期**: 2025-09-16
**核心方法**: Red-Green-Refactor + Use Case 功能保證

## 🎯 必讀核心文件 (所有代理人)

### 1. 新架構設計文件
- **📄 `docs/domains/01-getting-started/simplified-error-system-design.md`**
  - 簡化錯誤處理系統 v5.0.0 完整設計
  - 核心原則、架構說明、使用模式
  - 效能特性和遷移策略
  
### 2. 錯誤代碼定義  
- **📄 `src/core/errors/ErrorCodes.js`**
  - 15 個核心錯誤代碼定義
  - 預編譯常用錯誤 (CommonErrors)
  - 使用範例和最佳實踐

### 3. 簡化 API 使用
- **📄 `src/core/errors/index.js`** 
  - createError() 和 createResult() 函數
  - ES modules 匯出規範
  - 實用工具函數

### 4. 專案開發規範
- **📄 `CLAUDE.md`** - 錯誤處理規範章節
  - 標準化錯誤處理體系
  - ESLint 規則要求
  - 架構債務管理原則

### 5. TDD 重構執行計畫
- **📄 `docs/domains/workflows/multi-agent-refactoring-plan.md`**
  - TDD 導向各 Domain 重構分工
  - Red-Green-Refactor 循環標準模式
  - Use Case 功能對應和 TDD 執行階段

## 📖 領域特定參考文件

### Chrome Extension 特定
- **📄 `docs/claude/chrome-extension-specs.md`**
  - Chrome Extension 平台特定錯誤處理
  - Service Worker 環境考量
  - 跨環境訊息傳遞

### TDD 協作流程
- **📄 `docs/claude/tdd-collaboration-flow.md`**
  - 四階段 TDD 流程
  - 測試先行原則
  - 重構階段最佳實踐

### 程式碼品質範例
- **📄 `docs/claude/code-quality-examples.md`**
  - 錯誤處理最佳實踐範例
  - 常見問題和解決方案
  - 語意化命名規範

## 🔍 技術參考文件

### 舊架構理解 (僅供參考)
- **📄 `docs/acceptance/error-handling-standardization-examples.md`**
  - StandardError 修復範例 (舊架構)
  - 修復前後對比
  - **注意**: 僅供理解舊模式，不要照舊模式實作

### ESLint 規則說明
- **📄 `docs/claude/eslint-error-handling-rules.md`** 
  - 錯誤處理 ESLint 規則
  - 魔法字串檢測規則
  - 違規修復指引

### 格式化修正範例
- **📄 `docs/claude/format-fix-examples.md`**
  - 標準化修正模式
  - 語意化錯誤代碼範例
  - **注意**: 需按新架構調整理解

## 🚨 TDD 重構閱讀順序建議

### Phase 1: 理解新架構和 TDD 方法 (45分鐘)
1. `simplified-error-system-design.md` - 完整閱讀新架構設計
2. `ErrorCodes.js` - 熟悉 15 個核心代碼分類
3. `index.js` - 理解 createError, CommonErrors API
4. `tdd-collaboration-flow.md` - 理解 Red-Green-Refactor 循環

### Phase 2: 理解重構策略 (20分鐘)  
5. `multi-agent-refactoring-plan.md` - TDD 導向重構分工
6. `CLAUDE.md` - 專案 TDD 和錯誤處理規範
7. `use-case-v2.md` - Use Case 功能要求 (保持功能完整)

### Phase 3: 執行準備 (15分鐘)
8. 根據負責的 Domain 確認 Use Case 對應關係
9. 準備 TDD 測試環境和工具
10. 查看 `code-quality-examples.md` 了解實作最佳實踐

## ⚠️ 重要注意事項

### 架構變革理解
- **不要參考 StandardError 相關內容** - 已完全棄用
- **專注新的原生 Error + ErrorCodes 模式**
- **15 個錯誤代碼已足夠** - 不要新增更多代碼

### 測試模式轉變
- **不再使用 `.toThrow(StandardError)`**  
- **改用 `.toThrow(Error)` 或 `.toThrow(/ErrorCode/)`**
- **不再使用 `.toMatchObject()` 測試錯誤**

### 效能考量
- **使用預編譯 CommonErrors** - 提升熱路徑效能
- **避免字串拼接** - 在頻繁執行的程式碼路徑中
- **保持簡單** - 不要過度抽象化

## 📋 TDD 代理人檢查清單

### TDD 重構準備
- [ ] 已閱讀新架構設計和 TDD 流程文件
- [ ] 已熟悉 15 個核心 ErrorCodes 和使用方式
- [ ] 已理解 Red-Green-Refactor 循環標準
- [ ] 已確認負責 Domain 的 Use Case 對應關係
- [ ] 已準備 TDD 測試環境 (Jest, 測試工具)

### TDD 執行循環
- [ ] **Red Phase**: 先寫使用新 ErrorCodes 的失敗測試
- [ ] **Green Phase**: 實作最簡程式碼使測試通過
- [ ] **Refactor Phase**: 使用新架構優化程式碼
- [ ] 每個循環保持測試通過率 100%
- [ ] 記錄 Use Case 功能要求滿足情況

### Domain 完成驗收
- [ ] 所有測試使用新 ErrorCodes 且 100% 通過
- [ ] Use Case 對應功能需求完全滿足
- [ ] 無任何 StandardError 殘留引用
- [ ] 效能改善可測量 (目標 2-10x)
- [ ] TDD 測試覆蓋所有重要錯誤情境

---

**按照這個文件清單閱讀，將確保代理人具備完整的重構知識和執行能力。**