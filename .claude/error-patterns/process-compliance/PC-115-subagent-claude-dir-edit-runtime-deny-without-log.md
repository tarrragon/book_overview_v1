---
id: PC-115
title: subagent 對 .claude/ Edit 被 runtime 拒絕且無 hook 訊息
category: process-compliance
severity: high
created: 2026-05-02
source_ticket: 0.18.0-W17-097
related_pc:
  - PC-040
  - PC-114
related_arch:
  - ARCH-015
---

## 症狀

subagent 派發後嘗試 Edit/Write 主 repo `.claude/` 下檔案：

- Edit 工具回傳「Permission to use Edit has been denied」
- 無 hook stderr 訊息（非 exit 2 deny）
- `.claude/hook-logs/` 全目錄無相關紀錄
- 同 session 同檔案，PM 主線程 Edit 立即成功

## 根因（W17-098 受控驗證）

CC v2.1.126 runtime 層對 subagent Edit/Write 主 repo 內 `.claude/` 路徑有 **hardcoded deny**，獨立於所有 hook 與 permission 設定。

### 驗證對照（同一 session, 19:33:49 同一時點）

| Actor | Path | Branch | Hooks 結果 | permissionMode | Result |
|-------|------|--------|----------|----------------|--------|
| PM 主線程 | .claude/skills/ticket/lifecycle.py | main | 全 exit 0 | n/a | SUCCESS |
| thyme subagent | 同上 | main | 全 exit 0 | bypassPermissions | DENIED |

唯一差異 = `agentId`（subagent vs PM）。

### 不可覆蓋的三層

| 機制 | 是否影響 deny | 證據 |
|------|------------|------|
| Hook 系統（PreToolUse Edit）| 否 | 5 個 hook（main-thread-edit-restriction / branch-verify / file-type-permission / ticket-path-guard / ticket-file-access-guard）全 exit 0 allow |
| settings.json `permissions.allow` | 否 | 含 `Edit`/`Write` 但 subagent 仍拒 |
| agent frontmatter `permissionMode: bypassPermissions` | 否 | thyme 已設 bypassPermissions 仍拒 |

### 機制推論

CC runtime 設計層保護「框架資產自我修改」：subagent 若能任意改 `.claude/hooks/`、`.claude/agents/`、`.claude/skills/`，可繞過用戶授權系統。`permissionMode: bypassPermissions` 只覆蓋 hook 層 + settings 層，不覆蓋 runtime hardcoded protection。

### 診斷不可見性

deny 訊息為標準 CC 模板「Permission to use Edit has been denied. IMPORTANT: ...」，無 hook stderr 訊息，無 `.claude/hook-logs/` 紀錄。所有 PreToolUse hook 顯示 allow，故診斷時容易誤判為 hook 問題。

### 歷史軌跡

- 2026-04-13 ARCH-015 原結論：「.claude/ 一律被擋」
- 2026-04-18 重驗（v2.1.114）：「主 repo 樹內 .claude/ 可寫」（feedback_arch015_boundary_refinement）
- 2026-05-02 W17-097 + W17-098（v2.1.126）：再次驗證為「不可寫」，前次結論失效

CC 升級可能再次改變行為，建議每次主版本升級後重驗。

## 防護

| 層級 | 機制 |
|------|------|
| 派發決策 | PM 修改 `.claude/` 框架資產時**預設主線程直接執行**，不派發 subagent |
| 試探派發 | 必要時先派 1 個 subagent 試最小變更，成功才擴大；禁止一次並行 4+ |
| 失敗回應 | subagent Edit deny 立即 PM 接手，不重派、不拆細粒度 |
| 記憶更新 | feedback_arch015_boundary_refinement.md 已標註「不可靠」，每次 CC 升級需重驗 |

## 觸發案例

W17-097：ANA 規劃 5 個 IMP children，前 4 個並行派發 thyme-python-developer 修改 `.claude/skills/ticket/`，全部 Edit deny。PM 接手 W17-097.3 即時成功（commit d357fefd）。

## 鑑別診斷

| 訊號 | 對應 PC |
|------|---------|
| 主 repo `.claude/` Edit 被 runtime 拒絕（無 hook 訊息） | **本 PC-115** |
| 派發前 hook 阻擋（agent-dispatch-validation） | PC-114 |
| MCP write tool 對 text file 被擋 | PC-112 |
| Edit 成功但 prompt 缺 context | PC-040 |

## 後續觀察

- CC 升級或 setting 變更後重驗（記錄版本號 + 日期）
- 若用戶 setting 可關閉此限制，補充至本 PC
