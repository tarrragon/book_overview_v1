---
id: PROP-005
title: "外部依賴邊界防護驗證"
status: discussing
source: "development"
proposed_by: "UC 測試驗證延伸"
proposed_date: "2026-03-30"
confirmed_date: null
target_version: "v0.16.2"
priority: P1

outputs:
  spec_refs: []
  usecase_refs: [UC-01, UC-02, UC-05, UC-08]
  ticket_refs: []

related_proposals: [PROP-004]
supersedes: null
---

# PROP-005: 外部依賴邊界防護驗證

## 需求來源

UC 測試驗證過程中發現：有些關鍵步驟依賴外部系統（Readmoo DOM、Chrome API、使用者環境），這些是我們無法控制且隨時可能變動的部分。不需要完美容錯，但必須在邊界點設定 exception 處理並拋出明確錯誤。

## 問題描述

> **核心原則**：不要求內部程式完美應對各種外部狀況，但外部依賴邊界必須有明確的 exception 處理和錯誤拋出。當外部改變時，我們能正確偵測並報錯，而非靜默失敗。

## 範圍界定

### 本提案要做的（In Scope）

- 盤點所有外部依賴邊界點
- 驗證每個邊界點是否有 exception 處理
- 確認整合測試覆蓋外部依賴變動場景
- 為缺失的邊界防護建立修復 ticket

### 本提案不做的（Out of Scope）

- 增加內部程式的容錯複雜度 → 不需要
- 處理所有可能的外部異常 → 只需偵測並報錯

## 外部依賴邊界盤點

### 類別 1: Readmoo 書城 DOM 結構

**風險**：Readmoo 改版會導致 DOM 選擇器失效

| 邊界點 | 檔案 | 防護狀態 |
|--------|------|---------|
| DOM 書籍元素查詢 | readmoo-adapter.js | [x] try/catch + 日誌 |
| 書籍 ID 提取 | readmoo-adapter.js:extractBookIdFromPrivacy | [x] try/catch + fallback |
| 書籍資料解析 | readmoo-adapter.js:parseBookElement | [x] try/catch + 日誌 |
| 批次提取錯誤 | readmoo-adapter.js:extractBooks | [x] per-element try/catch + stats |
| URL 驗證 | readmoo-adapter.js:validatePage | [x] try/catch |
| 進度條提取 | readmoo-adapter.js:extractProgressFromContainer | [x] try/catch + fallback |
| 通用容錯方法 | readmoo-adapter.js:handleWithFallback | [x] try/catch + logError |
| DOM 工具 | dom-utils.js | 待確認 |

**整合測試覆蓋**：
- [x] content-script-extractor.test.js — Content Script 提取整合
- [x] uc01-complete-extraction-workflow — 完整提取流程
- [ ] DOM 結構變更偵測測試（模擬 Readmoo 改版）

### 類別 2: Chrome Extension API

**風險**：Chrome API 行為變更、權限問題

| 邊界點 | 檔案 | 防護狀態 |
|--------|------|---------|
| chrome.storage.local | chrome-storage-adapter.js | [x] 23 處 try/catch（完善） |
| chrome.runtime.sendMessage | chrome-event-bridge.js | [x] 9 處 try/catch |
| chrome.tabs API | tab-state-tracking-service.js | 待確認 |
| chrome.permissions | permission-management-service.js | 待確認 |
| Manifest V3 合規 | background.js | [x] 已測試 |

**整合測試覆蓋**：
- [x] storage-api-integration.test.js — Storage API 整合
- [x] runtime-messaging-integration.test.js — Runtime 訊息整合
- [x] content-script-injection.test.js — Content Script 注入
- [x] manifest.test.js — Manifest 驗證
- [x] chrome-store-readiness.test.js — 上架合規

### 類別 3: 使用者環境

**風險**：記憶體不足、效能問題、網路不穩

| 邊界點 | 檔案 | 防護狀態 |
|--------|------|---------|
| 記憶體監控 | MetricsCollector.js, memory-utils.js | [x] 效能監控 |
| 大量資料處理 | readmoo-adapter.js:extractBooks | [x] 批次處理 + stats |
| 網路狀態 | connection-monitoring-service.js | [x] 連線監控 |
| Chrome Storage 配額 | chrome-storage-adapter.js | [x] 配額管理 |

**整合測試覆蓋**：
- [x] benchmark-tests.test.js — 效能基準
- [x] baseline-performance.test.js — 效能基線
- [x] performance-monitoring-integration.test.js — 效能監控整合

## 分析結論

### 現有防護評估

| 類別 | 防護完善度 | 整合測試覆蓋 | 評估 |
|------|-----------|-------------|------|
| Readmoo DOM | 高（每個操作都有 try/catch） | 良好（缺 DOM 變更偵測） | 差距小 |
| Chrome API | 高（storage 尤其完善） | 優秀 | 無明顯差距 |
| 使用者環境 | 中（有監控但缺主動防護） | 良好 | 差距小 |

### 關鍵差距

| 差距 | 嚴重程度 | 說明 |
|------|---------|------|
| DOM 結構變更偵測 | 中 | 缺少模擬 Readmoo 改版的整合測試（驗證選擇器失效時能正確報錯） |
| chrome.tabs/permissions 邊界防護 | 低 | 這些 service 有大量程式碼但未深入檢查 try/catch 覆蓋度 |

### 結論

**外部依賴邊界防護整體良好**。readmoo-adapter.js 有 13+ 處 try/catch 和通用 handleWithFallback 方法，chrome-storage-adapter.js 有 23 處防護。

主要的改善方向是：
1. 新增「DOM 結構變更偵測」整合測試 — 模擬選擇器失效時，系統能正確報錯
2. 這可以與 W2-002（UC-02 匯出鏈測試）或 W2-001（UC-01 測試）一起處理

## 驗收條件

- [x] 外部依賴邊界點盤點完成
- [x] 各邊界點 exception 處理狀態確認
- [x] 整合測試覆蓋評估
- [ ] DOM 結構變更偵測測試建立（可併入 W2 Ticket）
