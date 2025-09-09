# 📋 Readmoo 書庫提取器開發任務清單

**當前版本**: v0.12.1  
**最後更新**: 2025-09-09  
**開發狀態**: ✅ v0.12.0 測試修復與資料一致性改善完成，v0.12.1 關鍵方法實作階段

## 🎯 專案當前狀態

### ✅ 已完成重要里程碑

- **v0.12.0**: 測試修復與資料一致性改善完成 (2025-09-09)
  - ✅ 事件常數匯出修復：新增 UX_EVENTS, THEME_EVENTS, POPUP_EVENTS
  - ✅ 平台驗證器屬性完整性：修復 confidence 屬性缺失問題
  - ✅ 備份恢復回應強化：補齊必要屬性（restoredFromBackup 等）
  - ✅ 測試輔助系統完善：5個核心類別狀態管理和回應格式標準化
  - ✅ 資料一致性基礎：為測試通過率提升奠定基礎（3748行新增）

---

## 額外插入最高優先級任務

### 實作以下指令

 `/smart-version-check` - 版本推進檢查指令

**功能**: 檢查工作狀態並自動決定版本推進策略

**決策邏輯**:

1. **小版本推進**: 當前工作完成，版本系列未完成 → 推進 patch (0.12.0 → 0.12.1)
2. **中版本推進**: 版本系列目標完成 → 推進 minor (0.12.x → 0.13.0)  
3. **繼續開發**: 工作未完成 → 更新進度並繼續當前開發

**自動執行動作**:

- 更新 package.json 版本號
- 建立新工作日誌檔案
- 重新排序 todolist.md 任務優先級
- 提供明確的下一步建議

**使用時機**:

- 完成一個功能或修復後
- 需要確認是否應該推進版本時
- 不確定當前開發狀態和下一步動作時

---

## 🎯 v0.12.1 核心目標 - MessagingValidator 方法實作與核心服務驗證

### 📋 v0.12.1 當前狀態總覽

**🏆 v0.12.0 重要成就**:
- ✅ 測試修復與資料一致性改善：3748行新增，10個關鍵文件
- ✅ 事件常數匯出完善：解決 UX_EVENTS 等未定義引用問題
- ✅ 平台驗證器屬性修復：confidence 屬性缺失問題解決
- ✅ 測試輔助系統標準化：建立統一回應格式和狀態管理

**🚀 v0.12.1 核心目標**: 實作 messagingValidator 關鍵方法，確保核心服務架構完整運作

### 🔴 Critical Priority - v0.12.1 核心方法實作目標

**v0.12.1 專注目標**: 修復4個方法缺失問題，建立穩定的核心服務架構

#### 🎯 v0.12.1 核心任務

**🔧 關鍵方法實作重點**:

1. **messagingValidator.startTracking()**: 實作訊息驗證追蹤啟動方法
2. **相關核心方法**: 分析並實作其他3個缺失的關鍵方法
3. **服務整合驗證**: 確保方法間協作和狀態同步正常
4. **錯誤處理強化**: 建立完善的異常處理和容錯機制

**🎯 實作策略**:

1. **程式碼分析**: 深入分析現有架構和測試需求
2. **方法實作**: 逐一實作缺失方法，確保功能完整性
3. **單元測試**: 為每個新方法編寫對應的單元測試
4. **整合測試**: 驗證整體服務架構運作正常

---

**🔴 Critical Priority - 核心方法實作 (立即處理)**:

- 🔄 **修復4個方法缺失問題**: `messagingValidator.startTracking` 等關鍵方法實作
- 🔄 **驗證核心服務正常運作**: 確保訊息服務架構無阻塞性問題
- 🔄 **單元測試完善**: 為新實作方法編寫完整測試覆蓋
- 🎯 **目標**: 建立穩定可靠的核心服務架構

**🟡 High Priority - 服務架構完善**:

- ⭕ **架構整合驗證**: 確認三大新服務在實際場景運作正常
- ⭕ **效能基準建立**: 關鍵操作響應時間基準測試
- ⭕ **狀態管理優化**: 服務生命週期和狀態同步機制
- 🎯 **目標**: 為v0.12.x核心功能開發奠定穩固基礎

**🟡 Medium Priority - 基礎設施完善**:

- ⭕ **完成最後6個PLACEHOLDER文件**: development-setup.md 等關鍵文件
- ⭕ **API文檔更新**: 新實作方法的使用指南和範例
- ⭕ **監控機制建立**: 核心服務健康檢查和錯誤追蹤
- 🎯 **目標**: 建立完整的開發和維護基礎設施

**🟢 Low Priority - 測試品質持續改善**:

- ⭕ **45個資料斷言修正**: 測試預期值調整 (非阻塞性問題)
  - 跨設備同步測試：書籍數量預期值調整 (200 vs 220等)
  - 檔案大小驗證：預期值調整 (1MB vs 505KB等)  
  - 衝突解決測試：預期行為確認和調整
- ⭕ **超時測試優化**: 長時間執行測試的配置調整
- 🎯 **目標**: 從98.3%提升到100%，但不阻塞核心開發

### ⚠️ 重要測試項目 - 版本管理與工作流程驗證

**新增測試需求** (2025-09-06):

- [ ] **版本管理整合測試**: 驗證功能/文件更新後的自動化提交流程
  - 測試 work-log-manager.sh 的版本推進檢查功能
  - 驗證提交後工作日誌和版本號的正確更新
  - 確認 Claude Code 指令不可用時的替代方案有效性
- [ ] **工作流程一致性測試**: 確認所有提交相關文件規格統一
  - 驗證 CLAUDE.md 與 .claude/commands/ 的指令說明一致性
  - 測試 check-work-log.sh 腳本的強制確認邏輯
  - 確保版本推進建議與實際執行的整合性

### 🔴 Critical Priority - 文件路徑引用規範標準化

**新增優先任務** (2025-09-06):

- [ ] **文件路徑語意化規範制定與實施**
  - 📋 **問題識別**: 當前文件引用大量使用相對路徑 `../`、`../../`、`../../../`，不符合程式碼規範要求
  - 📝 **規範制定**: 在文件規範中明確註明「檔案路徑語意規範（強制）」
    - 路徑需可「單看就理解」來源模組、功能核心與責任邊界
    - **完整路徑名稱**: 資料夾名稱需具體表意，讓 domain 結構一目了然
    - **禁止相對深度**: 絕不使用任何 `../` 相對深度計算方式
  - 🔧 **現有文件修正**: 系統性檢查並修正所有使用相對路徑的文件引用 
    - **修正規模**: **612個**相對路徑引用需要處理
    - **層級分布**: 單層`../` (372個) + 雙層`../../` (112個) + 三層`../../../` (45個) + 其他
    - **主要模式**: 文檔間引用、Claude文檔引用、代碼路徑引用
    - 改用語意化路徑: `docs/domains/02-development/architecture/domain-design.md`
    - 確保路徑語意與實際責任一致
  - ✅ **驗證機制**: 建立檢查腳本防止未來引入相對路徑引用
  
**執行方式**: 🤖 使用專業 sub-agent `mint-format-specialist` 執行
**重要性**: 🔴 Critical - 影響文件維護性和新人理解，符合「檔案路徑語意規範（強制）」標準

**Sub-Agent 規劃**: [mint-format-specialist.md](./claude/mint-format-specialist.md) - 專業文件格式化與品質修正專家
**標準範例集**: [format-fix-examples.md](./claude/format-fix-examples.md) - 修正案例範例與最佳實踐指南

### ⭕ 待開始任務 (24個文件實作)

#### **🔴 P0 - 遺留自 v0.10.x (1個)**

- ⭕ **[development-setup.md](./domains/02-development/workflows/development-setup.md)** - 開發環境配置指南
  - 狀態: PLACEHOLDER 轉實作 (原定 v0.10.x)  
  - 重要性: 第二層開發文件，影響新人上手

#### **📊 效能優化專區 (4個)**

- ⭕ **[monitoring-system.md](./domains/03-reference/performance/monitoring-system.md)** - 效能監控體系
- ⭕ **[memory-optimization.md](./domains/03-reference/performance/memory-optimization.md)** - 記憶體最佳化  
- ⭕ **[loading-performance.md](./domains/03-reference/performance/loading-performance.md)** - 載入效能優化
- ⭕ **[performance-testing.md](./domains/03-reference/performance/performance-testing.md)** - 效能測試方法

#### **🚀 部署維運專區 (5個)**

- ⭕ **[chrome-store-guide.md](./domains/03-reference/deployment/chrome-store-guide.md)** - Chrome Store 上架指南
- ⭕ **[cicd-pipeline.md](./domains/03-reference/deployment/cicd-pipeline.md)** - CI/CD 流水線
- ⭕ **[release-strategy.md](./domains/03-reference/deployment/release-strategy.md)** - 版本發布策略
- ⭕ **[monitoring-alerts.md](./domains/03-reference/deployment/monitoring-alerts.md)** - 監控與告警
- ⭕ **[chrome-extension.md](./domains/03-reference/deployment/chrome-extension.md)** - Chrome Extension 部署指南

#### **🔧 重構指南專區 (4個)**

- ⭕ **[refactoring-decision-tree.md](./domains/03-reference/refactoring/refactoring-decision-tree.md)** - 重構決策樹
- ⭕ **[technical-debt-management.md](./domains/03-reference/refactoring/technical-debt-management.md)** - 技術債務管理  
- ⭕ **[code-quality-standards.md](./domains/03-reference/refactoring/code-quality-standards.md)** - 代碼品質標準
- ⭕ **[case-studies.md](./domains/03-reference/refactoring/case-studies.md)** - 重構案例研究

#### **🚑 問題診斷專區 (2個)**

- ⭕ **[performance-troubleshooting.md](./domains/03-reference/troubleshooting/performance-troubleshooting.md)** - 效能問題診斷
- ⭕ **[production-incident-handling.md](./domains/03-reference/troubleshooting/production-incident-handling.md)** - 生產環境問題處理

#### **📦 歷史歸檔專區 (4個)**

- ⭕ **[architecture-evolution.md](./domains/03-reference/archive/architecture-evolution.md)** - 架構演進史
- ⭕ **[architecture-decision-records.md](./domains/03-reference/archive/architecture-decision-records.md)** - 重要決策記錄 (ADR)
- ⭕ **[deprecated-features.md](./domains/03-reference/archive/deprecated-features.md)** - 棄用功能清單
- ⭕ **[release-history.md](./domains/03-reference/archive/release-history.md)** - 版本發布日誌

#### **🛠️ 文件維護專區 (4個)**

- ⭕ **[documentation-maintenance.md](./domains/03-reference/maintenance/documentation-maintenance.md)** - 文件維護指南
- ⭕ **[contributor-guide.md](./domains/03-reference/maintenance/contributor-guide.md)** - 貢獻者指南
- ⭕ **[documentation-standards.md](./domains/03-reference/maintenance/documentation-standards.md)** - 文件品質標準  
- ⭕ **[usage-analytics.md](./domains/03-reference/maintenance/usage-analytics.md)** - 文件使用統計

### 📅 v0.11.0 執行時間表

**第一週 (優先完成)**:

- ✅ development-setup.md (P0 - 立即處理)
- 📊 效能優化專區 4 個文件
- 🚀 部署維運專區 5 個文件

**第二週**:  

- 🔧 重構指南專區 4 個文件
- 🚑 問題診斷專區 2 個文件

**第三週**:

- 📦 歷史歸檔專區 4 個文件  
- 🛠️ 文件維護專區 4 個文件

**預期完成日期**: 2025-09-26 (三週內完成所有 24 個文件)

---

## 🏗️ 系統化重構計畫 - 中期目標 (v0.12.x+)

### 🎯 系統化錯誤處理與文字管理標準化方案

**架構文件**: [標準化錯誤處理](./domains/01-getting-started/error-handling-overview.md)  
**重構理由**: 根本解決文字不統一、錯誤處理不規範、測試失敗等核心問題  
**預期效益**: 測試通過率達100%、lint問題減少90%、維護成本大幅降低

#### 🏗️ Phase 1: 建立核心架構 (優先級: Critical)

- **目標**: 建立基礎異常類別體系、統一回應格式模型、程式狀況枚舉系統
- **預計時程**: 2-3天
- **關鍵交付物**: 
  - `src/core/exceptions/` - 統一異常管理系統
  - `src/core/models/` - 標準化回應格式
  - `src/core/enums/` - 程式狀況類型枚舉
- **執行策略**: 面板0主要開發 + 面板2品質檢查

#### 📚 Phase 2: 文字字典系統 (優先級: Critical) 

- **目標**: 建立集中化文字字典管理系統
- **預計時程**: 3-4天
- **關鍵交付物**:
  - `src/core/localization/` - 統一文字字典管理
  - ESLint規則: 禁止硬編碼字串
- **執行策略**: 面板1分析現有文字 + 面板0實現字典系統

#### 🔍 Phase 3: 日誌系統統一化 (優先級: Critical)

- **目標**: 替換所有console.log、建立結構化日誌
- **預計時程**: 2-3天  
- **關鍵交付物**:
  - `src/core/logging/` - 統一日誌管理系統
  - 系統性替換現有日誌輸出
- **執行策略**: 面板0核心實現 + 面板4監控進度

#### 🔧 Phase 4: 系統整合與測試 (優先級: Critical)

- **目標**: 重構現有錯誤處理、更新測試框架、建立自動化檢查
- **預計時程**: 4-5天
- **關鍵交付物**:
  - 所有錯誤處理點使用結構化異常
  - 測試使用結構化驗證（非字串比對）
  - CI/CD整合的程式碼品質閘道
- **執行策略**: 面板0+面板2並行開發測試

---

## 🔧 並行修復任務 (配合重構進行)

### 🚨 當前程式碼品質問題 (在重構過程中解決)

**說明**: 以下問題將在系統化重構過程中根本性解決

#### 🔴 Lint 問題修復 (3760個問題) 🤖

**使用專業 Sub-Agent**: `mint-format-specialist` - 批量 Lint 問題修復專家

- **錯誤數量**: 2967 個錯誤
- **警告數量**: 793 個警告  
- **主要問題**: trailing spaces, space-before-function-paren, console.log 警告
- **解決策略**: 使用 mint-format-specialist 自動修復格式問題，配合重構解決邏輯問題
- **執行方式**: 分批次處理，優先自動修正，複雜問題提供專業建議

#### 🔴 測試失敗修復

- **StorageAPIValidator 構造函數問題**: `TypeError: StorageAPIValidator is not a constructor`
- **storage-api-integration.test.js**: 多個測試失敗
- **整合測試問題**: 需要修復跨模組整合
- **執行策略**: 面板0主要開發 + 面板2程式碼品質檢查

### 🤖 TMux協作機制測試

**分工策略**:

- **面板0** (主線程): 核心問題修復和TDD循環
- **面板1** (文件更新): todolist、工作日誌同步更新  
- **面板2** (品質檢查): 持續執行lint、測試檢查
- **面板3** (Git操作): 版本控制和提交管理
- **面板4** (監控): 進度追蹤和狀態顯示

---

## 📊 開發優先級規劃

### Phase 1: 程式碼品質修復 (當前階段) - 使用TMux協作

1. **Lint 錯誤批次修復**: 面板2執行 `npm run lint:fix` 自動修復
2. **測試失敗修復**: 面板0重點解決 StorageAPIValidator 問題  
3. **並行文件更新**: 面板1同步更新todolist和工作日誌
4. **持續監控**: 面板4追蹤修復進度

### Phase 2: 協作機制驗證

1. **TMux分工效果評估**: 驗證並行開發效率
2. **品質門檻達成**: 所有lint問題解決，測試100%通過
3. **文件同步性確認**: 工作日誌與實際進度一致

### Phase 3: 最終驗證與交付準備

1. **完整測試通過**: 確保 100% 測試通過率
2. **建置成功**: 確保 production build 成功
3. **TMux協作機制文件化**: 記錄協作流程最佳實踐

---

## 🗂️ 延後功能：Exception機制和使用者提示系統 (v2.0+ 待評估)

### 📋 完整設計記錄 (2025-09-03 評估)

**背景**: 今天進行了完整的 Exception 機制和使用者提示系統設計，包含書庫管理五階段異常體系。經過 Linux 和 John Carmack 專家嚴格代碼審查，評定為「過度設計」，建議先實作簡化方案。

#### 🎯 原始完整需求

1. **書庫管理五階段異常體系**:
   - 擷取階段: 平台連接失敗、認證過期、資料格式錯誤 → 重新登入/網路檢查引導
   - 同步階段: 資料衝突、版本不一致、同步超時 → 版本選擇/衝突解決引導  
   - 更新階段: 資料驗證失敗、欄位格式錯誤 → 資訊補充/格式修正引導
   - 分類階段: 分類規則衝突、標籤重複 → 規則重定義/標籤合併引導
   - 匯出階段: 格式不支援、權限錯誤、空間不足 → 格式選擇/權限修正引導

2. **使用者提示系統**:
   - UserPromptEngine: 自動將技術異常轉換為使用者友善操作指引
   - Chrome Extension Popup UI 深度整合
   - 問題描述 → 可能原因 → 建議操作 → 替代方案的完整流程

3. **Chrome Extension 特化**:
   - Background/Content/Popup 三環境統一錯誤協調
   - 5MB 記憶體限制下的最佳化策略
   - 跨環境訊息路由和錯誤傳遞機制

#### 🚨 專家審查結果

**Linux 專家 (NEEDS_REVISION)**:

- 過度複雜化: 用 2000+ 行代碼解決 3 行代碼的問題
- 維護成本噩夢: 每個錯誤需要專門的 Exception 類別和使用者指引
- 違反 "good taste": 為了架構而架構，創造不必要抽象

**John Carmack 專家 (性能現實檢查失敗)**:

- 宣稱性能指標無法實現: < 1ms 異常建立根本不可能
- 記憶體不可持續: 基礎開銷 1.37MB，嚴重壓縮 Chrome Extension 可用空間  
- 熱路徑污染: 420ms+ 錯誤處理開銷完全違反快速失敗原則

#### 💡 專家建議的正確方向

**最小可行解決方案**:

```javascript
// Linux 式 3 行解決方案
const LOG_MESSAGES = {
  BOOK_EXTRACTED: 'Book extracted successfully',
  VALIDATION_FAILED: 'Validation failed: {reason}',
  NETWORK_ERROR: 'Network request failed'
}
```

**Carmack 式三層架構**:
1. 立即錯誤處理 (< 5ms): 基礎錯誤分類
2. 批次錯誤報告 (每 5 秒): 簡單傳送機制
3. 背景分析 (低優先級): 閒置時處理

**實際可達成效能**:
- 基本錯誤處理: < 5ms (而非 < 1ms)
- 記憶體佔用: < 500KB (而非 1.37MB+)  
- 跨環境傳播: < 50ms (而非 420ms+)

#### 🔮 未來評估條件

**何時重新考慮 Exception 機制**:

1. 基礎訊息字典系統穩定運行 > 3 個月
2. 實際遇到使用者反映的操作引導需求
3. Chrome Extension 使用者基數 > 1000 人
4. 團隊規模擴大至 > 3 位工程師

**重新評估時的簡化原則**:

- 只針對真實的使用者問題，不為架構而架構
- 先測量實際效能數據，再設定合理目標
- 分階段實作，每個階段都有明確的價值證明

#### 📄 設計文件位置

- `docs/work-logs/v0.5.0-error-handling-infrastructure-design.md`: 完整架構設計
- `docs/work-logs/v0.10.10-error-handling-standardization-redesign.md`: 重新設計版本
- 專家審查記錄: 本次 session 對話記錄

---

## 📈 技術債務管理

### 🔴 Critical (立即修復)

- **3760 個 lint 問題**: 違反程式碼品質標準
- **測試失敗**: 影響開發流程穩定性
- **版本號混亂**: 影響專案管理

### 🟡 High (本版本內修復)

- **工作日誌重複**: v0.9.45 檔案整理
- **文件同步**: CHANGELOG.md 更新

---

## 🎯 成功標準

### v0.10.9 完成標準

- [ ] 所有 lint 問題修復 (3760 → 0)
- [ ] 所有測試通過 (100% 通過率)
- [ ] TMux協作機制驗證完成
- [ ] 工作目錄完全乾淨 (`git status` clean)
- [ ] production build 成功

### 品質門檻
- [ ] `npm run lint` 通過
- [ ] `npm test` 100% 通過  
- [ ] `npm run build` 成功
- [ ] `git status` 無未提交內容

---

*📝 備註: 此 todolist 已清除過時任務，專注當前實際需要完成的工作*
