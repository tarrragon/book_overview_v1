# PC-050: PM 在代理人仍在工作時誤判（完成或失敗）

## 錯誤症狀

**變體 X — 誤判完成**（原始觸發案例）：
- PM 收到一個代理人的完成通知後，立刻開始驗收和 commit
- 實際上還有其他代理人在背景執行中
- 導致代理人工作結果被覆蓋、衝突、或遺漏

**變體 Y — 誤判失敗（新增 2026-04-12）**：
- PM 主動讀取背景代理人的 transcript output 檔案
- 看到 transcript 停留在某個「我即將做 X」的 text 宣告或中間狀態
- 誤判「代理人過早 stop 了/沒執行/失敗」
- 立刻啟動補救措施（建 handoff 準備重派、寫失敗分析）
- 實際上代理人仍在背景執行，稍後才完成並產出完整結果
- 後果：補救 Ticket/handoff/失敗記錄全部要回退或更正，浪費 PM 工作

## 根因分析

PM 缺乏「代理人完成確認」的系統性流程。具體表現：

**模式 A — 未檢查分支就判定失敗**（W2-001/002）：
1. PM 派發代理人（背景）
2. 代理人在 feature 分支上 commit
3. PM 在 main 上看 `git status`，沒有變更
4. PM 誤判「代理人沒做事」，重新派發
5. 浪費一次代理人執行

**模式 B — 多代理人只看一個就行動**（W11-002）：
1. PM 派發代理人 A（回合耗盡，未完成）
2. PM 重新派發代理人 B（簡化版）
3. 代理人 B 完成，PM 立刻 commit
4. 代理人 A 仍在背景執行（或已完成但 PM 未確認）
5. 兩個代理人可能在同一個分支上產生衝突

**模式 C — 共用分支**（W11-001/003）：
1. PM 建了一個 feature 分支
2. 並行派發兩個代理人
3. 兩個代理人都在同一個分支上工作
4. 失去分支隔離的意義

**模式 D — 看 transcript 中間狀態就判失敗**（W5-001 Phase 1，2026-04-12）：
1. PM 派發代理人（背景）
2. PM 主動讀取 `/private/tmp/claude-501/.../tasks/{agentId}.output`
3. transcript 是 JSONL，記錄 agent 每個 tool call，但**尚未到完成時刻**
4. PM 看到最後一行是 agent 的 text（如「I have sufficient context. Now I'll write...」）以為 agent stop
5. 實際上 agent 只是在 tool call 之間的 text response，後續還有 append-log 等工具執行
6. PM 誤判後開始補救流程（在 Ticket 寫失敗分析、建 handoff、準備重派）
7. task-notification 到達時發現 agent 早就完成且產出可用
8. PM 花時間撤回補救措施（刪 handoff、改 append-log 為更正記錄）

**根本原因**：transcript output 是流式寫入，讀取時可能只是代理人執行過程的快照，不是最終狀態。**只有 `<task-notification>` tag 才代表 agent 真正完成或失敗**。

## 防護措施

### PM 代理人完成確認 SOP（強制，已整合到決策樹）

**派發後**（dispatch-gate.md「派發後清點」）：
```bash
cat .claude/dispatch-active.json  # 確認派發數量正確
```

**收到完成通知時**（pm-role.md「代理人完成確認 SOP」）：
```bash
cat .claude/dispatch-active.json  # 確認剩餘活躍派發
```

**只有 dispatch-active.json 為空時，才能開始驗收和 commit。**

**針對模式 D（誤判失敗）的強制規則（2026-04-12 新增）**：

| 禁止行為 | 原因 | 替代做法 |
|---------|------|---------|
| 主動讀取 agent transcript output 檔（`/private/tmp/.../tasks/*.output`）推論 agent 是否失敗 | transcript 是流式快照，非最終狀態 | 等 `<task-notification>` tag 到達再判斷 |
| 看到 agent 在 transcript 中只做了少量 tool call 就判定「過早 stop」 | agent 可能仍在執行，transcript 只是當下狀態 | Hook 顯示「所有代理人已完成」不等於「這個代理人已完成」，必須等 task-notification |
| 在 task-notification 未到達前寫「失敗分析」到 Ticket | 事實未定，可能誤導 | 有疑慮時使用 SendMessage 確認，或直接等通知 |

**唯一授權讀取 transcript 的情境**：`<task-notification>` 已到達但 result 摘要不清楚，需深入檢視 agent 實際 tool calls 時。即便如此也禁止從中間狀態推論「仍在執行 vs 失敗」。

**完成 Checkpoint 中**（completion-checkpoint-rules.md「Checkpoint 1.85」）：
- 1.85 代理人清點：dispatch-active.json 非空 → 阻塞，禁止繼續

**判斷代理人失敗前**（pm-role.md「失敗判斷前置步驟」）：
1. `cat .claude/dispatch-active.json` — 代理人可能還在活躍派發中
2. `git branch | grep feat/` + `git worktree list` — 變更可能在其他分支
3. 只有 dispatch-active.json 為空且所有分支都無 commit 後，才判定失敗

### 並行派發分支隔離（強制，已整合到 dispatch-gate.md）

- 每個代理人使用獨立 feature 分支（N 個代理人 = N 個分支）
- 派發前切回 main 建新分支
- 或使用 `isolation: "worktree"` 自動隔離
- 禁止共用分支

## 實際案例

| Session | 場景 | 誤判類型 | 後果 |
|---------|------|---------|------|
| 2026-04-09 | W2-001 | 模式 A | 不必要的重新派發 |
| 2026-04-10 | W2-002 | 模式 A | 不必要的重新派發 |
| 2026-04-10 | W11-001/003 | 模式 C | 共用分支失去隔離 |
| 2026-04-10 | W11-002 | 模式 B | 代理人仍在執行時 commit |
| 2026-04-12 | W5-001 Phase 1 | 模式 D | 寫失敗分析/建 handoff，task-notification 到達後全部回退更正 |

## 關聯

- **Ticket**: 0.17.3-W12-001
- **相關模式**: PC-039（worktree 未合併不可見）
- **PM 規則**: .claude/rules/core/pm-role.md（代理人失敗判斷前置步驟）

---

**Created**: 2026-04-10
**Category**: process-compliance
**Severity**: P1（導致重複工作、潛在衝突、判斷錯誤）
**Key Lesson**: 派發時記錄數量，收到通知時比對，全部完成才行動
