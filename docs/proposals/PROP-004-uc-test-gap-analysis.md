---
id: PROP-004
title: "UseCase 與測試覆蓋率差距分析"
status: discussing
source: "development"
proposed_by: "spec 盤點後驗證"
proposed_date: "2026-03-30"
confirmed_date: null
target_version: "v0.16.2"
priority: P1

outputs:
  spec_refs: []
  usecase_refs: [UC-01, UC-02, UC-04, UC-05, UC-07, UC-08]
  ticket_refs: []

related_proposals: [PROP-000]
supersedes: null
---

# PROP-004: UseCase 與測試覆蓋率差距分析

## 需求來源

提案系統建立後，需要驗證現有測試是否涵蓋 UC 的驗收條件。這是提案系統的第一個實戰驗證。

## 問題描述

專案有 193 個測試檔案，但尚未有系統性的 UC 驗收條件 → 測試對應表。需要識別哪些 UC 場景已被測試覆蓋，哪些有差距。

## 範圍界定

### 本提案要做的（In Scope）

- 分析 6 個 Extension 相關 UC（UC-01, UC-02, UC-04, UC-05, UC-07, UC-08）的測試覆蓋
- 建立 UC 驗收條件 → 測試檔案的對應表
- 識別測試差距（UC 場景沒有對應測試）
- 識別孤立測試（測試沒有對應到任何 UC 場景）

### 本提案不做的（Out of Scope）

- APP 專屬 UC 的測試覆蓋（UC-03, UC-06）→ 不適用
- 新增缺失的測試 → 識別後建立獨立 ticket
- 修改現有測試 → 識別問題後建立獨立 ticket

## UC-測試對應分析

### UC-01: 匯入 Chrome Extension 書庫資料

**UC 驗收場景**：

| 場景 | 說明 | 測試覆蓋 |
|------|------|---------|
| 主要場景 1 | 選擇 JSON 檔案 | [x] data-import.test.js, overview-import-function.test.js |
| 主要場景 2 | 檔案驗證與匯入 | [x] readmoo-data-validator.test.js, overview-import-function.test.js |
| 主要場景 3 | 背景資料補充 | [ ] 無對應（Extension 不做 Google Books API 補充） |
| 替代流程 3a | JSON 格式錯誤 | [x] UC01ErrorSystem.test.js, UC01ErrorAdapter.test.js |
| 替代流程 3b | 重複書籍處理 | [ ] 待確認 |
| 替代流程 3c | 匯入中斷 | [ ] 待確認 |
| 特殊需求 | 效能（1000 本 <10s） | [ ] 待確認（benchmark-tests.test.js?） |
| E2E | 完整提取流程 | [x] uc01-complete-extraction-workflow-refactored.test.js |

**測試檔案清單**（16 個）：
- unit: data-import, extraction-progress-handler, extraction-completed-handler, overview-import-*, readmoo-data-validator, popup-extraction-service, UC01ErrorAdapter/Factory
- integration: UC01ErrorSystem, content-script-extractor, UC01-UC02-error-propagation
- e2e: uc01-complete-extraction-workflow, complete-extraction-workflow

---

### UC-02: 匯出書庫資料

**UC 驗收場景**：

| 場景 | 說明 | 測試覆蓋 |
|------|------|---------|
| 主要場景 1 | 啟動匯出 | [x] export-manager.test.js |
| 主要場景 2 | 匯出設定（格式選擇） | [x] export-handler.test.js（JSON/CSV/Excel） |
| 主要場景 3 | 資料處理與轉換 | [x] book-data-exporter.test.js |
| 主要場景 4 | 完成匯出 | [x] export-user-feedback.test.js, export-progress-notifier.test.js |
| 替代流程 1a | 空書庫 | [ ] 待確認 |
| 替代流程 3a | 儲存空間不足 | [ ] 待確認（Extension 下載為檔案，不太適用） |
| 事件系統 | 匯出事件 | [x] export-events.test.js |

**測試檔案清單**（11 個）：
- unit: export-manager, export-handler, book-data-exporter, export-events, export-user-feedback, export-progress-notifier, export-ui-integration, UC02ErrorAdapter/Factory
- integration: uc02-errorcodes-migration, UC01-UC02-error-propagation

---

### UC-04: 關鍵字搜尋補充書籍資訊（Extension: partial）

**UC 驗收場景**：

| 場景 | 說明 | 測試覆蓋 |
|------|------|---------|
| 搜尋功能 | 本地書籍搜尋 | [x] search-engine.test.js, search-index-manager.test.js |
| 搜尋 UI | 搜尋介面 | [x] search-ui-controller.test.js, book-search-filter*.test.js |
| 篩選功能 | 多條件篩選 | [x] filter-engine.test.js |
| 結果格式 | 搜尋結果顯示 | [x] search-result-formatter.test.js |
| 快取 | 搜尋快取 | [x] search-cache-manager.test.js |
| API 補充 | Google Books API 補充 | [ ] 不適用（Extension 不做 API 補充） |
| 批次補充 | UC-04b 批次 | [ ] 不適用（Extension 不做 API 補充） |

**測試檔案清單**（12 個）：
- unit: search-engine, search-index-manager, search-cache-manager, search-coordinator, search-ui-controller, search-result-formatter, filter-engine, book-search-filter*, UC04ErrorAdapter/Factory
- integration: UC04ErrorSystem

**備註**：Extension 的搜尋是純本地搜尋，不涉及 API 補充。測試覆蓋對 Extension 功能來說是完整的。

---

### UC-05: 雙模式書庫展示系統

**UC 驗收場景**：

| 場景 | 說明 | 測試覆蓋 |
|------|------|---------|
| 書庫展示 | 書籍網格渲染 | [x] book-grid-renderer.test.js, overview-page.test.js |
| 書庫控制 | 總覽頁面控制 | [x] overview-page-controller.test.js |
| Popup 介面 | 快速操作 | [x] popup-controller.test.js, popup-ui-*.test.js |
| 搜尋篩選 | 書庫搜尋 | [x] book-search-filter*.test.js |
| 模式切換 | 簡潔/管理模式 | [ ] 待確認（Extension 目前可能只有一種模式） |
| 空書庫 | 替代流程 1a | [ ] 待確認 |
| 效能 | 1000 本 <3s | [ ] 待確認（benchmark-tests.test.js?） |
| UI 互動 | 互動流程 | [x] ui-interaction-flow.test.js (e2e) |

**測試檔案清單**（多數計入 popup/ 和 ui/ 目錄）

---

### UC-07: 跨平台資料同步準備（Extension: partial）

**UC 驗收場景**：

| 場景 | 說明 | 測試覆蓋 |
|------|------|---------|
| 同步狀態管理 | 追蹤同步狀態 | [x] SynchronizationOrchestrator.test.js |
| 衝突偵測 | 衝突檢測 | [x] ConflictDetectionService.test.js |
| 增量變更追蹤 | 變更識別 | [ ] 待確認 |
| 同步工作流 | E2E 同步 | [x] cross-device-sync-workflow.test.js, cross-device-sync.test.js |
| 替代流程 7a | 資料不一致 | [ ] 待確認 |
| 替代流程 7b | 同步衝突 | [x] ConflictDetectionService.test.js |
| 替代流程 7c | 網路不穩 | [ ] 待確認（RetryCoordinator.test.js?） |

**測試檔案清單**（7 個）

---

### UC-08: 系統錯誤處理與恢復

**UC 驗收場景**：

| 場景 | 說明 | 測試覆蓋 |
|------|------|---------|
| 錯誤捕獲分類 | 自動錯誤分類 | [x] system-error-classifier.test.js, ErrorCodes-integrity.test.js |
| 網路錯誤恢復 | 重試機制 | [x] error-recovery-strategies.test.js, error-recovery-coordinator.test.js |
| 錯誤傳播 | 跨模組傳播 | [x] cross-module-error-propagation.test.js |
| UC 特定錯誤 | UC01-UC07 | [x] UC01-UC07 ErrorAdapter/Factory/System tests |
| 系統錯誤處理 | Chrome Extension 錯誤 | [x] chrome-extension-error-handling.test.js |
| 恢復工作流 | E2E 恢復流程 | [x] error-recovery-workflow.test.js |
| 錯誤場景整合 | 場景覆蓋 | [x] error-handling-scenarios.test.js |

**測試檔案清單**（35+ 個）：覆蓋度最高的 UC

---

## 差距摘要

### 已充分覆蓋

| UC | 測試數 | 評估 |
|----|--------|------|
| UC-01 | 16 | 良好（主要場景和 E2E 都有） |
| UC-02 | 11 | 良好（匯出格式和事件系統都有） |
| UC-04 | 12 | 良好（對 Extension 功能來說完整） |
| UC-08 | 35+ | 優秀（最完整的 UC 測試覆蓋） |

### 需要確認的差距

| UC | 缺失場景 | 嚴重程度 | 備註 |
|----|---------|---------|------|
| UC-01 | 重複書籍處理 | 中 | 需確認是否有對應邏輯和測試 |
| UC-01 | 匯入中斷回滾 | 中 | 需確認事務保護測試 |
| UC-05 | 模式切換 | 低 | Extension 可能只有單一模式 |
| UC-05 | 空書庫狀態 | 低 | 邊界條件 |
| UC-05 | 效能基準 | 中 | 有 benchmark-tests.test.js 但需確認閾值 |
| UC-07 | 增量變更追蹤 | 中 | 同步核心功能 |
| UC-07 | 資料不一致處理 | 中 | 替代流程 7a |
| UC-07 | 網路不穩處理 | 中 | 替代流程 7c |

### 不適用的場景（Extension 不做）

| UC 場景 | 原因 |
|---------|------|
| UC-01 背景 API 補充 | Extension 不做 Google Books API |
| UC-03 全部 | APP 專屬（相機掃描） |
| UC-04 API 補充和批次 | Extension 不做 API 補充 |
| UC-06 全部 | APP 專屬（借閱管理） |

## 驗收條件

- [x] 6 個 Extension 相關 UC 的測試對應分析完成
- [x] 差距識別和嚴重程度標記
- [ ] 確認「待確認」項目的實際覆蓋狀態
- [ ] 為重要差距建立修復 ticket
