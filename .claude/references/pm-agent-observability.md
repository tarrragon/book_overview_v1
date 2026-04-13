# PM 背景代理人觀察指南

本文件整合 PM（主線程）可用於觀察背景代理人狀態的所有工具，指引正確使用時機和安全邊界。

> **核心問題**：PM 派發背景代理人後，如何知道「代理人現在在做什麼？完成了嗎？留下了什麼？何時完成？」而不違反 PC-050 防護規則？

---

## 四工具分工總覽

| 工具 | 回答的問題 | 資料類型 | 更新時機 | 誰維護 |
|------|-----------|---------|---------|-------|
| `dispatch-active.json` | 我派發了幾個？Hook 認為哪些仍活躍？ | 持久化（JSON 檔案） | 派發時寫入、代理人完成時 Hook 清理 | `active-dispatch-tracker-hook.py` |
| **TaskOutput** | 這個特定代理人現在還在執行嗎？ | 即時查詢（tool call） | 代理人生命週期內任意時刻 | CC runtime |
| `agent-commit-verification-hook` | 代理人留下了什麼 git 證據？ | 完成時觸發 | PostToolUse（代理人完成後） | Hook 自動 |
| completion notification | 代理人何時完成？結果是什麼？ | 事件驅動（system-reminder） | 代理人完成瞬間 | CC runtime |

**設計原則**：四工具**互補非替代**。PM 應在不同場景選擇對應工具，禁止以單一工具推論全部資訊。

---

## 工具使用範本

### 1. dispatch-active.json（計數 Source of Truth）

**適用場景**：
- 派發後清點（確認派發數量正確）
- Checkpoint 1.85 代理人清點（禁止繼續條件）
- 完成確認 SOP 步驟 1
- 失敗判斷前置步驟 Step 0

**呼叫範本**：

```bash
cat .claude/dispatch-active.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
if d:
    print('[WAIT] 仍有 {} 個代理人在執行：'.format(len(d)))
    for x in d:
        print('  - {}'.format(x.get('agent_description', '?')))
else:
    print('[OK] 所有代理人已完成。')
"
```

**限制**：
- 不能告訴你「某個特定代理人現在是否仍活著」（Hook 可能延遲清理或 race）
- 不能告訴你代理人進度（只有「有活躍派發」或「無活躍派發」二元狀態）

---

### 2. TaskOutput（即時狀態查詢）

> **注意**：TaskOutput 是 Claude Code **deferred tool**，新 session 首次使用前必須執行 `ToolSearch("select:TaskOutput")` 載入 schema，否則直接呼叫會得到 `InputValidationError`。deferred tools 概念和完整清單見 `.claude/skills/search-tools-guide/SKILL.md` 的「Claude Code Meta-Tools」章節。

**適用場景**：
- 懷疑某個背景代理人未完成但 task-notification 未到達
- 失敗判斷前置步驟 Step 0.5（見 pm-role.md）
- 多代理人派發時確認特定代理人是否仍在執行

**呼叫範本**：

```
# Step 1：首次使用前載入 schema（若本 session 已載入可跳過）
ToolSearch(query="select:TaskOutput")

# Step 2：呼叫（schema 載入後）
TaskOutput(
  task_id=<agentId>,      # Agent tool 返回的 agentId 即是 task_id
  block=false,            # 非阻塞，立即返回
  timeout=3000            # 3 秒超時
)
```

**返回值標籤解讀**：

| 標籤 | 允許讀取 | 用途 |
|------|---------|------|
| `<status>` | 允許 | `running` / `completed` / `error` — 唯一可信的狀態來源 |
| `<task_type>` | 允許 | 確認是 `local_agent`（非 bash / remote） |
| `<retrieval_status>` | 允許 | `not_ready` / `ready` — 指示 output 是否完整 |
| **`<output>` body** | **禁止推論** | 流式 JSONL transcript，可能數十 KB 污染 context；禁止從內容推論代理人狀態（PC-050 模式 D） |

**Context 污染警告**：

TaskOutput 返回值**包含截斷的 `<output>` body**（JSONL transcript）。即使標記 `<retrieval_status>not_ready</retrieval_status>`，transcript 仍會夾帶數十 KB 的工具呼叫歷史。

PM **必須紀律性只讀狀態標籤**，忽略 `<output>` 內容。若需深入檢視代理人工具呼叫，應等 `<task-notification>` 到達後做（完整摘要），而非從中間狀態推論。

**限制**：
- 無法回答「代理人做了什麼 git commit」（需 agent-commit-verification-hook）
- 無法回答「派發總數」（需 dispatch-active.json）
- `<output>` body 若被讀入會觸發 PC-050 模式 D 防護規則

---

### 3. agent-commit-verification-hook（完成時 git 證據）

**適用場景**：
- 代理人完成後，PM 需要知道「在哪個分支做了什麼變更」
- 判斷代理人是否跳過 commit（PC-024）
- 判斷 worktree / feature 分支是否有未合併 commit

**觸發時機**：PostToolUse（Agent），自動觸發，無需 PM 手動呼叫。

**輸出形式**：代理人完成後的 system-reminder，格式：

```
[Agent Commit 驗證警告]
代理人描述: <description>
未 commit 的檔案: <list>
建議動作: git add / commit / discard
```

**限制**：
- 只在代理人完成時觸發，無法查詢執行中狀態
- 只檢查 git 變更，不檢查工作內容品質

---

### 4. completion notification（事件驅動）

**適用場景**：
- 代理人完成的權威通知（唯一可信代表「代理人真正完成」）
- 觸發 Checkpoint 1.85 代理人清點和後續驗收

**形式**：system-reminder，下一次 PM 回合開始時送達：

```
<task-notification>
<task-id>xxx</task-id>
<output-file>/private/tmp/.../tasks/xxx.output</output-file>
<status>completed</status>
<summary>Agent "..." completed</summary>
<result>...完整結果摘要...</result>
</task-notification>
```

**PM 處理規則**：
- `<status>completed</status>` + `<result>` 才是權威結果
- 禁止從 `<output-file>` 路徑自行讀取推論（PC-050 模式 D）
- 禁止在 task-notification 到達前寫失敗分析

**限制**：
- 事件驅動，PM 無法主動觸發
- 若代理人永遠不結束（卡住），notification 不會到達

---

## 決策樹：我該用哪個工具？

```
我需要知道什麼？
├── 派發了幾個代理人？還有幾個活躍？
│   └── dispatch-active.json
│
├── 某個特定代理人現在還在執行嗎？
│   └── TaskOutput（只讀 <status>）
│
├── 代理人完成了嗎？結果是什麼？
│   └── 等 completion notification（不主動查）
│
├── 代理人留下了什麼 git 證據？
│   └── agent-commit-verification-hook（自動觸發，讀 system-reminder）
│
└── 代理人在執行什麼 tool call / 讀什麼檔案？
    └── 禁止查詢（PC-050 模式 D 防護）
```

---

## 常見錯誤模式對照

| 錯誤 | 違反 | 正確做法 |
|------|------|---------|
| 看主倉庫 `git status` 沒變更就判失敗 | PC-050 模式 A | 先檢查 worktree + feature 分支（pm-role.md 失敗判斷前置步驟） |
| 讀 `/private/tmp/.../tasks/xxx.output` 推論代理人是否卡住 | PC-050 模式 D | 呼叫 TaskOutput 只讀 `<status>` |
| 代理人未即時完成就自己寫產品程式碼 | PC-045 | 派發後切去做其他 Ticket 準備工作，等通知 |
| 完成通知到達立刻 commit 忘記其他代理人 | PC-050 模式 B | 查 dispatch-active.json 確認全部完成（Checkpoint 1.85） |

---

## 與現有規則的銜接

| 文件 | 引用本指南的情境 |
|------|----------------|
| `.claude/rules/core/pm-role.md` 失敗判斷前置步驟 | Step 0.5 呼叫 TaskOutput 時引用本指南的安全範本 |
| `.claude/rules/core/pm-role.md` 代理人完成確認 SOP | 補充驗證工具章節引用本指南的 TaskOutput 限制 |
| `.claude/error-patterns/process-compliance/PC-050-...md` | 「TaskOutput 安全使用範本」章節 = 本指南章節 2 的子集 |
| `.claude/pm-rules/completion-checkpoint-rules.md` Checkpoint 1.85 | 代理人清點使用 dispatch-active.json（本指南章節 1） |

---

**Last Updated**: 2026-04-13
**Version**: 1.0.0 - 初版，整合四工具分工表和決策樹
**Source**: TaskOutput 對 local_agent 狀態查詢的實證結論 + pm-role.md 與 PC-050 的 TaskOutput 安全規則升級
