---
id: PROP-000
title: "提案驅動的需求追蹤機制"
status: implemented
source: "development"
proposed_by: "架構設計"
proposed_date: "2026-03-30"
confirmed_date: null
target_version: "v0.16.2"
priority: P0

outputs:
  spec_refs: []
  usecase_refs: []
  ticket_refs:
    - "0.16.2-W1-002"

related_proposals: []
supersedes: null
---

# PROP-000: 提案驅動需求追蹤機制設計

---

## 1. 問題陳述

### 現有文件架構的三個斷裂

| 斷裂 | 現況 | 影響 |
|------|------|------|
| spec/usecase 與 worklog 割裂 | spec 記錄需求、worklog 記錄過程，無雙向連結 | 無法確認哪些需求已實作並驗證 |
| 需求來源無統一入口 | 開發中發現的需求無固定記錄位置 | spec 逐漸過時，新需求無處可尋 |
| worklog 補完而非即時更新 | 版本結束後才根據 ticket 補完 worklog | 違反「即時記錄」設計初衷 |

### 現況證據

- `app-requirements-spec.md`（26KB 單體檔案）無法追蹤各需求項的實作狀態
- 存在 3 個 use case 檔案（`use-cases.md`, `use-case-v2.md`, `app-use-cases.md`），需求演進缺乏追蹤
- 178 個 work-log 項目與 spec 之間無引用關係

---

## 2. 設計決策（已確認）

| 決策 | 選擇 | 理由 |
|------|------|------|
| 目錄架構 | 四資料夾（proposals/ + spec/ + usecases/ + work-logs/） | 各司其職，階段清晰 |
| Checklist 追蹤 | 結構化資料檔（YAML） | 可程式化查詢，與 ticket 系統風格一致 |
| 與 ticket 關係 | 提案先行，ticket 後續 | 提案是 ticket 的上游，確認後才開 ticket |

---

## 3. 四資料夾架構設計

### 3.1 目錄結構

```
docs/
├── proposals/                    # 提案（需求統一入口）
│   ├── PROP-001-xxx.md          # 各提案文件
│   ├── PROP-002-xxx.md
│   └── ...
│
├── spec/                         # 正式規格（從提案轉化）
│   ├── README.md                # 規格總覽與索引
│   ├── requirements.md          # 功能需求清單（從原 app-requirements-spec.md 重構）
│   └── {feature-name}.md        # 各功能的詳細規格
│
├── usecases/                     # 用例（從提案轉化）
│   ├── README.md                # 用例總覽與索引
│   ├── UC-01-import.md          # 各用例（從原 app-use-cases.md 拆分）
│   ├── UC-02-scan.md
│   └── ...
│
├── work-logs/                    # 工作日誌 + tickets（維持現有結構）
│   ├── v0.16.1/
│   ├── v0.16.2/
│   └── ...
│
└── proposals-tracking.yaml       # 結構化追蹤索引
```

### 3.2 各資料夾定位

| 資料夾 | 生命週期 | 服務對象 | 內容特性 |
|--------|---------|---------|---------|
| proposals/ | 開發期（從構想到確認） | 開發者、PM | 需求探索、可行性評估、方案比較 |
| spec/ | 長期維護 | 維護者、新人 | 穩定的正式規格，提案確認後轉化 |
| usecases/ | 設計/驗收期 | 測試設計者、驗收者 | 使用場景、驗收標準、例外處理 |
| work-logs/ | 開發期 | PM、開發者 | 開發進度、ticket 執行記錄 |

### 3.3 與現有檔案的遷移計畫

| 現有檔案 | 遷移目標 | 處理方式 |
|---------|---------|---------|
| `app-requirements-spec.md` | `spec/requirements.md` | 搬移，保留原檔 symlink 或 redirect |
| `app-use-cases.md` | `usecases/UC-*.md` | 拆分為各 UC 獨立檔案 |
| `use-cases.md`, `use-case-v2.md` | 歸檔 | 移至 `domains/03-reference/archive/` |
| `app-error-handling-design.md` | `spec/error-handling.md` | 搬移 |
| `work-logs/` | 維持不變 | 已有良好結構 |

---

## 4. 提案（Proposal）文件格式

### 4.1 提案 ID 規則

格式：`PROP-{三位數序號}-{簡短描述}`

範例：`PROP-001-isbn-scan-enhancement`, `PROP-002-offline-sync`

### 4.2 提案文件模板

```markdown
# PROP-{NNN}: {提案標題}

## 狀態

| 項目 | 值 |
|------|-----|
| 狀態 | draft / discussing / confirmed / implemented / withdrawn |
| 提案人 | {角色或來源} |
| 提案日期 | {YYYY-MM-DD} |
| 確認日期 | {YYYY-MM-DD 或 pending} |
| 目標版本 | {v0.x.x 或 TBD} |

## 需求來源

{描述需求的來源 — 可以是用戶回饋、開發中發現、架構改善、bug 衍生等}

## 問題描述

{描述要解決的問題}

## 範圍界定（核心欄位）

### 本提案要做的（In Scope）
- {本版本要實作的功能}

### 本提案不做的（Out of Scope）
- {不在本版本範圍內的功能} → {理由}

## 提案方案

{描述解決方案，可包含多個方案的比較}

## 影響範圍

{列出受影響的模組、檔案、用例}

## 驗收條件

- [ ] {具體、可驗證的條件 — 對應「要做」項目}
- [ ] {具體、可驗證的條件 — 對應「要做」項目}

## 轉化產出

| 產出類型 | 檔案 | 狀態 |
|---------|------|------|
| 規格 | spec/{name}.md | pending / created |
| 用例 | usecases/UC-{XX}.md | pending / created |
| Ticket | {ticket-id} | pending / created |
```

### 4.3 範圍界定原則（核心設計約束）

> **一個提案 = 一個版本的明確功能範圍**

| 原則 | 說明 |
|------|------|
| 單版本綁定 | 提案必須綁定到具體版本（target_version），禁止跨大版本設計 |
| 明確做與不做 | 必須列出 In Scope 和 Out of Scope，讓邊界一目了然 |
| 不做 → 新提案 | Out of Scope 的項目如果未來需要，建立獨立提案綁定到未來版本 |
| 驗收對應做 | 驗收條件必須與 In Scope 項目一一對應 |

**理由**：
- 避免過度設計 — 不為未來版本做預先設計
- 避免過早最佳化 — 等到真正需要時再設計
- 明確邊界 — 開發者和 PM 對「做到哪裡」有共識
- 可追蹤 — 每個功能都有明確的提案和版本歸屬

### 4.4 提案狀態流轉

```
draft → discussing → confirmed → implemented
                  ↘ withdrawn
```

| 狀態 | 說明 | 觸發動作 |
|------|------|---------|
| draft | 初始草稿 | 建立提案文件 |
| discussing | 討論中 | 開始評估可行性 |
| confirmed | 已確認 | 轉化為 spec/usecase，開 ticket |
| implemented | 已實作 | 所有相關 ticket 完成 |
| withdrawn | 已撤回 | 決定不做，記錄理由 |

---

## 5. 結構化追蹤機制（proposals-tracking.yaml）

### 5.1 檔案格式

```yaml
# docs/proposals-tracking.yaml
# 提案追蹤索引 — 單一檔案掌握所有提案狀態

version: "1.0"
last_updated: "2026-03-30"

proposals:
  PROP-001:
    title: "ISBN 掃描增強"
    status: confirmed
    proposed: "2026-03-15"
    confirmed: "2026-03-20"
    target_version: "v0.17.0"
    spec_refs:
      - spec/isbn-scan.md
    usecase_refs:
      - usecases/UC-02-scan.md
    ticket_refs:
      - 0.17.0-W1-001
      - 0.17.0-W1-002
    checklist:
      - item: "掃描準確率達 95%"
        status: done       # done / pending / in_progress
        verified_by: "0.17.0-W1-002"
      - item: "離線模式支援"
        status: pending
        verified_by: null
```

### 5.2 查詢工具（未來擴展）

追蹤檔案採用 YAML 格式，可透過以下方式查詢：

| 查詢方式 | 工具 | 範例 |
|---------|------|------|
| 手動查看 | Read 工具 | 直接閱讀 YAML |
| CLI 查詢 | yq / Python | `yq '.proposals[] \| select(.status == "confirmed")' proposals-tracking.yaml` |
| 未來整合 | ticket CLI 擴展 | `ticket proposal list --status confirmed` |

初期以手動維護 + Read 查詢為主，待提案數量增加再開發 CLI 工具。

---

## 6. 提案到 Ticket 的完整流程

### 6.1 生命週期流程

```
需求出現（任何來源）
    |
    v
[1] 建立提案 — docs/proposals/PROP-NNN-xxx.md（status: draft）
    |            更新 proposals-tracking.yaml
    v
[2] 討論評估 — 細化方案、確認可行性（status: discussing）
    |
    v
[3] 確認提案 — 轉化產出（status: confirmed）
    |   ├── 建立/更新 spec/{name}.md
    |   ├── 建立/更新 usecases/UC-XX.md
    |   └── 開立 ticket（/ticket create）
    |        └── ticket.why 引用 PROP-NNN
    v
[4] 實作追蹤 — ticket 執行中，更新 tracking.yaml checklist
    |
    v
[5] 驗收完成 — 所有 checklist 項目完成（status: implemented）
```

### 6.2 Ticket 與提案的引用關係

**Ticket → Proposal**：ticket 的 `why` 欄位引用提案 ID

```bash
ticket create --version 0.17.0 --wave 1 \
  --action "實作" --target "ISBN 掃描核心邏輯" \
  --why "PROP-001: ISBN 掃描增強"
```

**Proposal → Ticket**：tracking.yaml 的 `ticket_refs` 記錄相關 ticket

```yaml
ticket_refs:
  - 0.17.0-W1-001  # 掃描核心
  - 0.17.0-W1-002  # UI 整合
```

### 6.3 需求來源分類

| 來源 | 範例 | 處理方式 |
|------|------|---------|
| 原始規劃 | app-requirements-spec 中的功能 | 建立 PROP，標記來源為 spec |
| 開發中發現 | 重構時發現缺失功能 | 建立 PROP，標記來源為 development |
| Bug 衍生 | 修 bug 時發現設計缺陷 | 建立 PROP，標記來源為 bug-fix |
| 用戶回饋 | 使用者提出的新需求 | 建立 PROP，標記來源為 user-feedback |
| 技術債 | Phase 4 評估發現的架構問題 | 建立 PROP，標記來源為 tech-debt |

---

## 7. 與現有系統的整合

### 7.1 與 Ticket 系統

| 整合點 | 方式 |
|--------|------|
| ticket.why | 引用 PROP-NNN |
| tracking.yaml.ticket_refs | 記錄相關 ticket |
| ticket 完成時 | 更新 tracking.yaml checklist |

### 7.2 與 Worklog

| 整合點 | 方式 |
|--------|------|
| worklog 條目 | 引用 PROP-NNN 作為需求來源 |
| 版本 worklog | 列出該版本處理的提案 |

### 7.3 與 todolist

| 關係 | 說明 |
|------|------|
| todolist | 版本級短期任務清單，管「做什麼」 |
| proposal | 正規需求的完整生命週期，管「為什麼做、怎麼驗收」 |
| 互動 | todolist 項目若為正規需求，應建立對應 PROP |

---

## 8. 實作階段規劃

### Phase 1：基礎建設（本 Ticket）

- [x] 設計提案文件格式
- [x] 設計 proposals-tracking.yaml 格式
- [x] 設計四資料夾架構
- [x] 設計完整流程
- [x] 建立目錄結構（proposals/, spec/, usecases/）
- [x] 建立 proposals-tracking.yaml 初始檔案
- [x] 將本設計文件作為 PROP-000 存入 proposals/
- [x] 建立三種文件類型的標準模板（TEMPLATE.md）
  - proposals/TEMPLATE.md — 提案模板（YAML frontmatter + 完整討論/轉化記錄結構）
  - spec/TEMPLATE.md — 規格模板（FR/NFR 需求項、資料模型、介面規格）
  - usecases/TEMPLATE.md — 用例模板（場景/例外/驗收條件、UC 標準格式）

### Phase 2：現有文件遷移（後續 Ticket）

- [ ] 拆分 app-use-cases.md 為獨立 UC 檔案
- [ ] 搬移 app-requirements-spec.md 到 spec/
- [ ] 歸檔過時的 use-case 檔案
- [ ] 更新 docs/README.md 反映新架構

### Phase 3：工具整合（後續 Ticket）

- [ ] ticket CLI 新增 proposal 引用支援
- [ ] 開發 proposals-tracking.yaml 查詢工具
- [ ] 整合到 PM 流程規則

---

## 9. Spec Domain 組織架構

### 9.1 設計原則

> **Spec 是 domain knowledge 的載體**，usecase/ticket 是跨 domain 的實作細節。
> Spec 依 domain 組織，降低理解業務知識的心智負擔。

### 9.2 Domain 目錄結構

```
docs/spec/
├── README.md                          # 規格總覽（含 domain 地圖）
├── TEMPLATE.md                        # 規格模板
│
├── core/                              # 核心領域（跨 domain 共用）
│   ├── book-model.md                  # Book 資料模型、BookSource、Platform
│   ├── error-handling.md              # 錯誤處理系統設計
│   └── event-system.md                # 事件系統架構
│
├── extraction/                        # 資料提取領域
│   ├── extraction-pipeline.md         # 提取流程管線
│   └── data-processing.md            # 資料處理與驗證
│
├── platform/                          # 平台管理領域
│   ├── platform-registry.md           # 平台註冊與切換
│   └── adapter-system.md             # 平台適配器架構
│
├── data-management/                   # 資料管理領域
│   ├── storage.md                     # 儲存策略（Chrome Storage / IndexedDB）
│   ├── import-export.md              # 匯入匯出格式與流程
│   └── sync.md                        # 同步機制（跨設備）
│
├── messaging/                         # 通訊管理領域
│   └── message-routing.md            # 訊息路由與跨 context 通訊
│
├── page/                              # 頁面管理領域
│   ├── page-detection.md             # 頁面偵測與導航
│   └── content-script.md             # Content Script 協調
│
├── system/                            # 系統管理領域
│   ├── lifecycle.md                   # Extension 生命週期
│   └── health-monitoring.md          # 健康監控與診斷
│
├── user-experience/                   # 用戶體驗領域
│   ├── popup-ui.md                    # Popup 介面設計
│   ├── overview-ui.md                 # 書庫總覽介面
│   └── search-filter.md             # 搜尋與篩選
│
├── analytics/                         # 分析統計領域（v2.0+）
│   └── reading-analytics.md          # 閱讀分析
│
└── security/                          # 安全隱私領域（v2.0+）
    └── data-privacy.md               # 資料隱私保護
```

### 9.3 Domain 地圖

| Domain | 核心責任 | 依賴的 Domain | 關鍵 UC |
|--------|---------|--------------|---------|
| core | 資料模型、錯誤處理、事件系統 | 無（被所有 domain 依賴） | 全部 |
| extraction | 從網頁提取書籍資料 | core, platform, messaging | UC-01 |
| platform | 平台偵測、適配器管理 | core | UC-01, UC-07 |
| data-management | 儲存、匯入匯出、同步 | core | UC-01, UC-02, UC-07 |
| messaging | 跨 context 通訊 | core | 全部（基礎設施） |
| page | 頁面偵測、Content Script | core, messaging | UC-05 |
| system | 生命週期、健康監控 | core | UC-08 |
| user-experience | UI、搜尋、篩選 | core, data-management | UC-05, UC-06 |
| analytics | 閱讀統計分析 | core, data-management | 未定 |
| security | 資料隱私保護 | core | 未定 |

### 9.4 Domain 與 UseCase 的交叉引用

UseCase 是**跨 domain** 的使用場景。一個 UC 可能涉及多個 domain：

| UC | 涉及 Domain | 主要 Domain |
|----|------------|------------|
| UC-01 匯入 | extraction, data-management, platform | data-management |
| UC-02 匯出 | data-management, user-experience | data-management |
| UC-03 ISBN 掃描 | extraction, data-management | extraction |
| UC-04 搜尋補充 | extraction, data-management | extraction |
| UC-05 書庫展示 | user-experience, data-management, page | user-experience |
| UC-06 借閱管理 | data-management, user-experience | data-management |
| UC-07 跨平台同步 | data-management, platform | data-management |
| UC-08 錯誤處理 | system, core | system |

---

## 10. 文件系統 Skill 設計

### 10.1 Skill 定位

統一文件查詢與導航的入口，類似 ticket 系統的 `/ticket` 指令。

```bash
/doc <subcommand> [options]
```

### 10.2 子命令設計

| 子命令 | 用途 | 範例 |
|--------|------|------|
| `query` | 查詢單一文件 | `/doc query PROP-001` |
| `list` | 列出文件清單 | `/doc list spec --domain extraction` |
| `nav` | 跨文件導航 | `/doc nav UC-01` → 顯示相關 spec/proposal/ticket |
| `status` | 追蹤狀態總覽 | `/doc status` → proposals-tracking.yaml 摘要 |
| `search` | 全文搜尋 | `/doc search "ISBN 掃描"` |
| `domain` | Domain 地圖 | `/doc domain extraction` → 顯示 domain 規格和關聯 |

### 10.3 查詢範例

```bash
# 查詢提案
/doc query PROP-001
# → 顯示提案內容摘要 + 狀態 + 相關 spec/usecase/ticket

# 列出某 domain 的所有規格
/doc list spec --domain data-management
# → data-management/storage.md
#    data-management/import-export.md
#    data-management/sync.md

# 跨文件導航：從 UC 出發
/doc nav UC-01
# → 相關 Spec: spec/data-management/import-export.md, spec/extraction/...
#    相關 Proposal: PROP-XXX
#    相關 Ticket: 0.17.0-W1-001, 0.17.0-W1-002

# 從 domain 出發
/doc domain extraction
# → Domain: extraction（資料提取）
#    Spec: extraction-pipeline.md, data-processing.md
#    UC: UC-01, UC-03, UC-04
#    Tickets: ...

# 全域追蹤狀態
/doc status
# → Proposals: 3 draft, 2 confirmed, 1 implemented
#    Spec: 12 files across 8 domains
#    UseCases: 8 files (UC-01 ~ UC-08)
```

### 10.4 跨文件導航機制

導航基於 YAML frontmatter 中的引用欄位：

```
Proposal ──source_proposal──→ Spec
    │                          │
    │                     related_usecases
    │                          │
    └──outputs.usecase_refs──→ UseCase
    │                          │
    └──outputs.ticket_refs──→ Ticket
```

| 起點文件 | 可導航到 | 透過欄位 |
|---------|---------|---------|
| Proposal | Spec | outputs.spec_refs |
| Proposal | UseCase | outputs.usecase_refs |
| Proposal | Ticket | outputs.ticket_refs |
| Spec | Proposal | source_proposal |
| Spec | UseCase | related_usecases |
| UseCase | Proposal | source_proposal |
| UseCase | Spec | related_specs |
| UseCase | Ticket | ticket_refs |

### 10.5 實作策略

| 階段 | 內容 | 工具 |
|------|------|------|
| Phase 1 | YAML frontmatter 解析 + 基本 query/list | Python CLI（類似 ticket） |
| Phase 2 | 跨文件導航（nav）+ domain 查詢 | 擴展 CLI |
| Phase 3 | 全文搜尋（整合 ripgrep） | CLI + rg |
| Future | RAG 向量查詢 | 待評估 |

---

## 11. 設計約束與權衡

### 採用的約束

| 約束 | 理由 |
|------|------|
| YAML 而非資料庫 | 輕量、版控友好、與現有 ticket YAML 風格一致 |
| 手動維護追蹤檔 | 初期低成本，後續可自動化 |
| 提案先行而非即開 ticket | 確保需求經過思考和確認再進入開發 |

### 已知權衡

| 權衡 | 影響 | 緩解 |
|------|------|------|
| 手動維護 YAML 有同步風險 | 追蹤檔可能與實際狀態不一致 | 後續開發 Hook 自動同步 |
| 增加文件數量 | 開發者需要管理更多檔案 | 清晰的流程和工具支援 |
| 遷移現有文件有成本 | 需要投入時間做一次性遷移 | 分階段執行，不影響正常開發 |

---

**Last Updated**: 2026-03-30
**Version**: 1.0.0
