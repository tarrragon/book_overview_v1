# Ticket 生命週期流程

> 操作指南：.claude/skills/ticket/SKILL.md
> AskUserQuestion 規則：.claude/pm-rules/askuserquestion-rules.md

---

## 狀態定義

```
pending → claim → in_progress → complete → completed
                                    ↑ release → blocked → 升級 PM
```

| 狀態 | 允許操作 |
|------|---------|
| pending | claim |
| in_progress | complete, release |
| completed | 就地修正（不變更狀態）或建立修正子 Ticket |
| blocked | claim（重新認領） |

> **completed 修正規則**：completed 狀態不可回退為 in_progress（歷史完整性）。
> 修正走「完成後發現」流程：`.claude/pm-rules/execution-discovery-rules.md` 3.5-B 層。

---

## 階段-標準流程總覽

| 階段 | 強制規則 | AskUserQuestion |
|------|---------|----------------|
| **建立** | 必須用 `/ticket create`，禁止直接寫 .md | 任務拆分確認（認知 > 10） |
| **建立後** | 強制並行審核：acceptance-auditor（品質）+ system-analyst（設計）→ creation_accepted: true | - |
| **認領** | 阻塞依賴檢查 + **5W1H 待定義欄位補全（強制）** + **簡化 WRAP 三問（W/A/P，強制）** | - |
| **執行** | 錯誤強制派發 incident-responder；日誌必填 | - |
| **驗收** | **主動勾選驗收條件**（`check-acceptance`）→ acceptance-gate-hook 事後驗證 | **驗收方式確認**（標準/簡化/先完成後補） |
| **完成** | 所有驗收條件已勾選後執行 `/ticket track complete`；complete 後處理 #17（錯誤學習） | **後續步驟選擇** |
| **收尾** | PM 主動告知變更狀態 + 查詢待處理 | **Wave 收尾確認** |

> 各階段詳細規則：.claude/references/ticket-lifecycle-phases.md

---

## Ticket 建立強制規則

| 規則 | 說明 |
|------|------|
| 必須使用命令 | `/ticket create` |
| 唯一存放路徑 | `docs/work-logs/v{version}/tickets/` |
| 子任務建立 | `/ticket create --parent {parent_id}` |
| 任務層級判斷 | 因執行現有 Ticket 產生 → 子任務；獨立問題 → 新任務鏈 |
| **ANA 衍生 Ticket 溯源驗證** | **AC 必須 1:1 對應來源 ANA Solution 修改項（PC-041）** |

### ANA 衍生 Ticket 溯源驗證（強制）

> **來源**：PC-041 — 分析 Ticket 結論的落地執行不完整，PM 只執行部分項目就標記完成。

從 ANA Ticket 衍生執行 Ticket 時，建立階段必須執行溯源驗證：

| 步驟 | 動作 | 說明 |
|------|------|------|
| 1 | 列出 ANA Solution 所有修改項 | 逐項列出，不遺漏 |
| 2 | 合併背景代理人分析結果 | 等待通知或查閱 output |
| 3 | 建立執行 Ticket 的 AC | 每個修改項對應一條 AC |
| 4 | 交叉驗證覆蓋率 | AC 合集覆蓋 Solution 所有項 = 100% |

**禁止行為**：

| 禁止 | 原因 |
|------|------|
| 依記憶建立 AC，不逐項對照 Solution | 容易遺漏（PC-041 根因） |
| 背景代理人未完成就建立執行 Ticket | 延遲分析結果被跳過 |
| 執行 Ticket AC 比 ANA Solution 少 | 修改不完整，驗收失效 |

---

## 建立後強制審核流程

Ticket 建立後、認領前，強制並行派發多代理人審核。

### 觸發條件

- Ticket 建立完成（`/ticket create` 執行成功）
- `creation_accepted` 為 false（預設）

### 審核內容

| 審核者 | 面向 | 檢查項目 |
|--------|------|---------|
| acceptance-auditor | 品質 | 驗收條件 4V 合規、where.files 完整性、數字正確性 |
| system-analyst | 設計 | 設計合理性、重複實作檢查、範圍適當性 |

### 審核流程

```
/ticket create → creation_accepted: false
    |
    v
[強制] 並行派發 acceptance-auditor + system-analyst
    |
    v
彙整結果 → 通過（無高/中缺陷）→ creation_accepted: true → 可認領
         → 未通過 → 修正 → 重新審核
```

### 判定標準

| 缺陷等級 | 判定 | 處理 |
|---------|------|------|
| 無/僅低缺陷 | 通過 | creation_accepted: true |
| 中缺陷 | 不通過 | PM 修正後重新審核或確認 |
| 高缺陷 | 不通過 | 必須修正後重新審核 |

### 豁免條件

| 條件 | 說明 |
|------|------|
| 已審核父 Ticket 的子任務 | 範圍已確認，可跳過 |

> 來源：PC-002 錯誤模式 — Ticket 建立後未經審核直接派發

---

## 驗收流程

| 任務類型 | 驗收深度 |
|---------|---------|
| IMP/ADJ/TDD Phase/複雜/安全 | 完整驗收（acceptance-auditor） |
| DOC/簡單（任務範圍單純） | 簡化驗收 |

### Complete 前主動勾選驗收條件（強制）

> **來源**：用戶反饋 — 每次 complete 都被 CLI 擋回才補勾驗收條件，浪費 context 和耐心。

PM 執行 `ticket track complete` **前**，必須先主動勾選所有驗收條件。禁止依賴 CLI 的錯誤提示才補勾。

**強制步驟順序**：

```
任務執行完成
    |
    v
Step 1: 逐條確認驗收條件已滿足
    |
    v
Step 1.5: [IMP/ADJ] error-pattern 衝突檢查（PC-052 預防）
    |       列出修改的核心函式/模組 → /error-pattern query <函式名>
    |       有衝突 → 暫停，評估是否需調整方案
    |       無衝突 → 繼續
    |
    v
Step 2: 執行 ticket track check-acceptance <id>
    |
    v
Step 3: 執行 ticket track complete <id>
    |
    v
acceptance-gate-hook 事後驗證（最後防線）
```

### Complete 前 error-pattern 衝突檢查（IMP/ADJ 強制）

> **來源**：PC-052 — 修改核心函式完成後，才發現 IMP-049 已記錄相同修改失敗 2 次。如果 complete 前查詢 error-pattern，問題在驗收階段就能攔截。

**觸發條件**：IMP 或 ADJ 類型 Ticket 執行 complete 前。

**執行方式**：

| 步驟 | 動作 | 範例 |
|------|------|------|
| 1 | 列出 Ticket 修改的核心函式/模組 | `run_hook_safely`, `sys.exit` |
| 2 | 用每個名稱查詢 error-pattern | `/error-pattern query run_hook_safely` |
| 3 | 檢查是否有衝突 | 找到 IMP-049 警告不要修改 |
| 4a | 有衝突 → 暫停 complete，評估方案 | WRAP 決策或調整修改 |
| 4b | 無衝突 → 繼續正常 complete | — |

**與認領時查詢的差異**：

| 時機 | 查詢重點 | 目的 |
|------|---------|------|
| 認領時 | 問題描述關鍵字 | 了解歷史上類似問題的處理方式 |
| complete 前 | 修改的核心函式名 | 確認修改不與已知失敗經驗衝突 |

**豁免條件**：DOC/ANA/REF 類型 Ticket（不涉及程式碼修改）。

**禁止行為**：

| 禁止 | 說明 |
|------|------|
| 直接執行 complete 不先 check-acceptance | 會被 CLI 擋回，浪費 context |
| 被擋回後才補勾 | 應主動確認，不依賴被動提醒 |

---

## 完成階段錯誤學習驗證

`ticket track complete` 執行前，acceptance-gate-hook 會自動檢查是否有新增 error-pattern，並輸出場景 #17 提醒。

**強制時序**：先執行 complete，後處理 #17（避免死鎖）。

| 條件 | 處理 |
|------|------|
| 有新增 error-pattern | complete 後執行 AskUserQuestion #17 |
| 無新增 error-pattern | 跳過 #17，正常完成 |

> 執行時序詳細說明和死鎖防護：.claude/references/ticket-lifecycle-phases.md（完成階段錯誤學習驗證章節）
> 場景定義：.claude/pm-rules/askuserquestion-rules.md（場景 #17）

---

## 父 Ticket complete 前置檢查（強制）

> **來源**：`.claude/methodologies/atomic-ticket-methodology.md` 「任務鏈核心哲學 — 父子責任傳遞」+ `.claude/methodologies/ticket-lifecycle-management-methodology.md` 「父 complete 前置條件」。

**核心原則**：父文件完成 ≠ 父責任履行。父 complete 需滿足「所有子 Ticket 已 completed 或 closed」。

### 強制規則表

| 場景 | 父 Ticket 狀態 | PM 行為 |
|------|--------------|--------|
| 子 Ticket 全 completed/closed | 可 complete | 執行 `ticket track complete <父ID>` |
| 任一子 Ticket pending/in_progress/blocked | **禁止 complete** | 繼續處理子 Ticket，父保持 in_progress |
| 父需抽離 context（未準備 complete） | 保持 in_progress | 用 `ticket handoff <父ID>` 而非 `complete` |
| 父 AC 全勾但有子未完成 | **禁止 complete** | AC 勾選是文件完成，非責任履行 |

### 禁止行為

| 禁止 | 原因 |
|------|------|
| 子未完成時強制 complete 父 | 父責任尚未由子履行，違反任務鏈哲學 |
| 將父回退為 pending 等待子 | completed 不可回退（lifecycle 規則）；但父未 complete 時保持 in_progress 本身就是等待 |
| 以「只是個 ANA 分析完成了就 complete」為由越過 | ANA 父的責任是「分析結論被解決」，不是「分析報告寫完」 |

### CLI 層強制

acceptance-gate-hook 將於 0.18.0-W10-036.2 實作根任務 complete 前的遞迴子狀態檢查（exit 2 block）。在該 Hook 落地前，本規則由 PM 自律 + 方法論文件約束。

---

## ANA Ticket 完成階段衍生 Ticket 檢查（強制）

> **來源**：ANA Ticket 完成時未強制確認分析結論是否需要建立衍生 Ticket，導致建議被遺忘需事後人工補建。

`ticket track complete` 對 ANA 類型 Ticket 執行前，acceptance-gate-hook 自動檢查 `spawned_tickets` 和 `children` 欄位。

| 情況 | 處理方式 |
|------|---------|
| spawned_tickets/children 不為空 **且全 completed/closed** | 通過，可 complete |
| spawned_tickets/children 不為空 **但有未完成** | **阻止 complete**（適用父 complete 前置規則） |
| 兩者皆為空 | 輸出 WARNING，提醒 PM 確認是否需要建立衍生 Ticket |

**PM 在看到 WARNING 後必須二選一**：

| 選擇 | 動作 |
|------|------|
| 需要衍生 Ticket | 先建立 Ticket 並**等待其 completed/closed**後才 complete 父（非「建立後即可 complete」） |
| 不需要 | 在 Ticket 執行日誌中記錄理由（如「分析結論為維持現狀，無需修改」）|

> **重要澄清**：「建立衍生 Ticket」不等於「父責任已履行」。衍生 Ticket 須 completed/closed，父才可 complete。見本文件上方「父 Ticket complete 前置檢查」章節。

> acceptance-gate-hook 實作：步驟 2.5（check_ana_has_spawned_tickets），獨立於步驟 2 驗收記錄檢查。

---

## 相關文件

- .claude/references/ticket-lifecycle-phases.md - 各階段詳細規則
- .claude/skills/ticket/references/ticket-lifecycle-details.md - 格式和 Hook 技術細節
- .claude/pm-rules/decision-tree.md - 主線程決策樹
- .claude/pm-rules/incident-response.md - 事件回應流程

---

**Last Updated**: 2026-04-06
**Version**: 5.8.0 - 認領階段新增 5W1H 待定義欄位補全（強制）
