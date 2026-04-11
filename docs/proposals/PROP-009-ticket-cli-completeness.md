---
id: PROP-009
title: Ticket CLI 完整性提升 — 全欄位 CLI 化 + 清單式驗證
status: proposed
created: 2026-04-11
priority: P1
category: framework
---

# PROP-009: Ticket CLI 完整性提升

## 動機

目前 Ticket 操作仍需直接讀寫 .md 檔案，造成：
1. **Token 浪費**：讀取整個 Ticket 檔案只為修改一個欄位
2. **分析消耗**：PM 需要解析 frontmatter 結構才能操作
3. **欄位遺漏**：create 後才發現 5W1H 有「待定義」，交接時才暴露
4. **一致性風險**：手動編輯 .md 可能破壞 YAML 格式

## 目標

**所有 Ticket 操作都透過 CLI 命令完成，不需要直接讀寫 .md 檔案。**

## 三個改善面向

### 面向 A：CLI 欄位操作完整性

**現有缺口**：

| 欄位 | create 可指定 | set-* 可修改 | 需新增 |
|------|-------------|-------------|--------|
| priority | 是 | 無 | `set-priority` |
| acceptance | 是 | 無（只有 check） | `add-acceptance` / `remove-acceptance` |
| spawned_tickets | 無 | 無 | `add-spawned` |
| decision_tree_path | 是 | 無 | `set-decision-tree` |

**目標**：所有可寫欄位都有對應的 CLI 命令。

### 面向 B：Create 時欄位完整性驗證

基於《清單革命》（The Checklist Manifesto, Atul Gawande）原則設計：

**清單設計原則**：
- 簡短：5-9 項，不超過一頁
- 精準：每項可在 30 秒內確認（yes/no 判斷）
- 實用：只檢查容易遺漏的關鍵項，不檢查不會漏的
- 類型：create 是「讀-做」清單（照著填），complete 是「執行-確認」清單（做完再確認）
- 不替代專業判斷：驗證欄位有值，不驗證值的品質
- 定期更新：根據 error-pattern 驅動更新

**Create 清單（讀-做型，建立時強制）**：

| # | 檢查項 | 阻擋？ | 理由 |
|---|--------|--------|------|
| 1 | why 已填寫？（IMP/ANA/ADJ） | 是 | 已實作，缺 why 會阻擋 |
| 2 | where.files 至少 1 個？ | 警告 | 空 where 導致 error-pattern 衝突檢查跳過 |
| 3 | acceptance 至少 1 項？ | 警告 | 無 AC 的 Ticket 無法驗收 |
| 4 | decision_tree_path 已填？ | 警告 | 缺少決策追蹤來源 |
| 5 | when 非「待定義」？ | 警告 | 交接後才補填增加認知負擔 |

**不列入清單的項目**（《清單革命》反模式）：
- 「標題是否清楚？」→ 主觀判斷，無法 30 秒確認
- 「是否符合 4V 原則？」→ 太抽象，應轉為具體問題
- 「是否需要拆分？」→ 需要分析，不適合清單

### 面向 C：Complete 前清單式驗證

**Complete 清單（執行-確認型，完成前強制）**：

| # | 檢查項 | 阻擋？ | 理由 |
|---|--------|--------|------|
| 1 | 所有 acceptance 已勾選？ | 是 | 已實作 |
| 2 | 5W1H 無「待定義」？ | 警告 | 確保欄位已在執行過程中補完 |
| 3 | error-pattern 衝突已檢查？（IMP/ADJ） | 警告 | 已實作（Step 2.7） |
| 4 | execution log 已填寫？ | 警告 | 已實作（append-log 提醒） |
| 5 | 相關 Ticket 已更新？（ANA 需有 spawned_tickets） | 警告 | 已實作（ANA spawned 檢查） |

## 實作建議

### 優先級排序

| 優先級 | 項目 | 投入 | 回報 |
|--------|------|------|------|
| P0 | Create 清單驗證（面向 B） | 中 — 修改 create 命令 | 高 — 每次 create 都受益 |
| P1 | 缺失的 set-* 命令（面向 A） | 低 — 4 個新命令 | 中 — 減少手動編輯 |
| P2 | Complete 清單整合（面向 C） | 低 — 整合現有 Hook | 中 — 統一分散的檢查 |

### 技術方案

Create 清單驗證可在 `ticket_system/commands/create.py` 中實作，在寫入檔案前執行清單檢查，不通過則輸出 WARNING（非阻擋）並列出缺失項目。

## 參考

- 《清單革命》（The Checklist Manifesto）— Atul Gawande
- PC-053: PM 對「小修改」跳過 Ticket 記錄
- 0.18.0-W4-002: PM 判斷偏誤 WRAP 分析

---

**Last Updated**: 2026-04-11
