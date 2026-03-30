---
name: doc
description: "需求追蹤文件系統（proposals/spec/usecases）的查詢、導航和管理。Use for: (1) 查詢提案、規格、用例文件, (2) 跨文件導航（從 UC 找 spec/ticket）, (3) Domain 地圖查詢, (4) 追蹤索引管理, (5) UC 測試對應驗證"
---

# Doc SKILL

需求追蹤文件系統 — 管理 proposals/spec/usecases 三種需求文件。

> 與 doc-flow（管理 CHANGELOG/worklog/ticket/todolist）互補，不重疊。

---

## 四種文件類型

| 類型 | 目錄 | 核心問題 | 詳細規範 |
|------|------|---------|---------|
| Proposal | `docs/proposals/` | 為什麼要做？做什麼不做什麼？ | Read `references/proposals.md` |
| Spec | `docs/spec/{domain}/` | 功能規格是什麼？ | Read `references/spec.md` |
| UseCase | `docs/usecases/` | 使用場景和驗收標準？ | Read `references/usecases.md` |
| Tracking | `docs/proposals-tracking.yaml` | 提案進度如何？ | Read `references/tracking.md` |

---

## 命令格式

```bash
/doc <subcommand> [options]
```

## 子命令

| 子命令 | 用途 | 範例 |
|--------|------|------|
| `query` | 查詢文件 | `/doc query PROP-001` 或 `/doc query UC-01` |
| `list` | 列出文件 | `/doc list proposals` 或 `/doc list spec --domain extraction` |
| `nav` | 跨文件導航 | `/doc nav UC-01` → 相關 spec/proposal/ticket |
| `domain` | Domain 地圖 | `/doc domain extraction` |
| `status` | 追蹤狀態 | `/doc status` |
| `test-map` | UC 測試對應 | `/doc test-map UC-01` |

---

## 無子命令時的預設行為

1. 執行 `/doc status` 顯示追蹤索引摘要
2. 列出近期更新的文件

---

## 快速參考

### 文件關係圖

```
Proposal ──outputs.spec_refs──→ Spec
    │                            │
    │                       related_usecases
    │                            │
    └──outputs.usecase_refs──→ UseCase
    │                            │
    └──outputs.ticket_refs──→ Ticket（doc-flow 管理）
```

### Domain 列表

| Domain | 目錄 | 說明 |
|--------|------|------|
| core | `spec/core/` | 資料模型、錯誤處理、事件系統 |
| extraction | `spec/extraction/` | 資料提取 |
| platform | `spec/platform/` | 平台管理 |
| data-management | `spec/data-management/` | 儲存、匯出、同步 |
| messaging | `spec/messaging/` | 跨 context 通訊 |
| page | `spec/page/` | 頁面偵測 |
| system | `spec/system/` | 生命週期管理 |
| user-experience | `spec/user-experience/` | UI、搜尋 |

---

## 參考資料

| 資料 | 說明 |
|------|------|
| `references/proposals.md` | 提案文件規範、流程、範圍界定原則 |
| `references/spec.md` | 規格文件規範、Domain 組織、FR/NFR 格式 |
| `references/usecases.md` | 用例規範、UC 測試對應要求、資訊鏈驗證 |
| `references/tracking.md` | 追蹤索引格式、跨文件導航機制 |

---

**Version**: 1.0.0
**Last Updated**: 2026-03-30
