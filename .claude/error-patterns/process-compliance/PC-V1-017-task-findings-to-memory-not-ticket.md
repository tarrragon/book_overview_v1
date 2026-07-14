---
id: PC-V1-017
title: 任務執行發現寫入 memory 而非 ticket，繞過追蹤體系
severity: medium
category: process-compliance
created: 2026-07-14
source_ticket: 1.6.0-W4-001
---

# PC-V1-017: 任務執行發現寫入 memory 而非 ticket，繞過追蹤體系

## 症狀

PM 在 v1.6.0 實機測試中發現多書城測試體系缺口（三層測試缺漏），將發現寫入 Auto Memory（`feedback_multi_bookstore_test_gaps.md`）而非 ticket 系統。

## 根因

PM 將「執行期間發現的任務需求」誤判為「跨 session 偏好」，選擇 memory 而非 ticket 作為記錄載體。

**判斷依據混淆**：
- Memory 用途：用戶偏好、角色背景、外部資源指標 — 跨 session 持久化的「是什麼」
- Ticket 用途：任務需求、執行發現、待辦項 — 可追蹤、可驗收的「要做什麼」

發現的測試缺口是「要做什麼」（需建整合測試），不是「用戶偏好」。

## 解決方案

Auto Memory 治理邊界已明確禁止錯誤教訓寫入 memory（由 error-pattern 承擔）。本模式擴展此邊界：**任何需要追蹤執行的發現一律寫入 ticket**。

## 預防措施

### 載體選擇判準

| 發現內容 | 正確載體 | 錯誤載體 |
|---------|---------|---------|
| 「需要建 X 測試」 | ticket（可追蹤、可驗收） | memory |
| 「X 功能有 bug」 | ticket | memory |
| 「流程 Y 有缺口」 | error-pattern + ticket | memory |
| 「用戶偏好 Z 風格」 | memory | ticket |
| 「外部資源在 URL W」 | memory | ticket |

### 判斷一句話

> 「這條記錄需要有人去執行嗎？」是 → ticket；否 → memory。

## 相關規則

- Auto Memory 治理邊界（MEMORY.md 頂部）
- `.claude/rules/core/quality-baseline.md` 規則 5：所有發現必須追蹤（ticket）
