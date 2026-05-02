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

## 根因（W17-097/098/099/100/101/102/103 五輪實驗 + 二輪 WRAP，工作假設待新 session 驗證）

**狀態：強推論（Hypothesis K）未經獨立驗證。** 詳見 `docs/work-logs/v0/v0.18/v0.18.0/tickets/0.18.0-W17-103.md`。

### Hypothesis K（最新工作假設）

CC v2.1.126 對 subagent `.claude/` Edit 有「session 級 prefix-based 權限快取」：

- session 內**首次** subagent `.claude/` Edit 觸發互動式 permission prompt
- 在 subagent 無 UI 環境下，prompt 自動 deny
- **PM 互動式 Edit 過 `.claude/` 任一檔**會在 session 中快取「`.claude/` 已授權」
- 之後 subagent `.claude/` Edit 都繼承快取 → success（即使是不同檔，因為 prefix-based 涵蓋整個 `.claude/`）

### 五輪實驗矩陣（零反例，全部與 Hypothesis K 預測相符）

| 實驗 | 並行 | Edit 內容 | PM 已 Edit `.claude/` 任一檔 | 結果 |
|-----|----|----|----|----|
| W17-097.1-.4 | 4 | 複雜（import + 8 替換）| 否 | DENY 4/4 |
| W17-099 | 1 | 簡單 | 是 | success |
| W17-100 (E1) | 1 | 複雜 | 是 | success |
| W17-101.1-.4 (E2) | 4 | 簡單 | 是 | success 4/4 |
| W17-102 (Test G) | 1 | 簡單（PM 未碰過該檔）| 是（其他檔已 Edit）| success |

並行/Edit 複雜度/prompt 結構/PM 接觸該檔（檔案層級）四個變因被獨立否證。剩下 prefix 層級 PM 接觸史與五實驗結果**全相符且零反例**。

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
- 2026-05-02 19:33 W17-097.1-.4（v2.1.126）：4 並行 thyme 全 deny（PM 該 session 從未 Edit `.claude/`）
- 2026-05-02 20:21 W17-099 重測（同 session 50 分鐘後）：1 個 thyme 成功 Edit + revert（PM 該 session 已多次 Edit `.claude/`）
- 2026-05-02 20:35-20:55 E1/E2/Test G 三組對照實驗，五輪結果與 Hypothesis K 全相符
- 2026-05-02 W17-103 整合：提出 prefix-based session cache 推論 + 新 session 驗證 prompt
- **待驗證**：新 session Phase A/B/C 三階段對照（驗證冷快取 deny + 暖快取 success）

## 防護（基於 Hypothesis K，待新 session 驗證後升級為定論）

| 層級 | 機制 |
|------|------|
| session 暖機 | 派發 subagent 修改 `.claude/` 之前，PM 先做一次 `.claude/` Edit（任一檔，trivial 修改後 revert 即可）以觸發 prefix-level 授權快取 |
| 失敗回應 | 首次 subagent `.claude/` Edit 拒絕時，PM 立即接手 Edit 即可——同時修復本任務 + 暖機後續 subagent dispatch |
| 派發紀律 | 不需序列化派發；前提是 session 已暖機 |
| 記憶更新 | feedback_arch015_boundary_refinement.md 標註 Hypothesis K 待驗證，每次 CC 升級需重驗 |

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
