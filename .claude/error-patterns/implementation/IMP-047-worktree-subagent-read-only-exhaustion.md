# IMP-047: Worktree Subagent 只讀不寫 — 回合耗盡前未產出程式碼

## 錯誤摘要

派發 worktree subagent 執行 Phase 3b 實作任務時，agent 持續讀取檔案理解 codebase，但在回合限制（約 15-20 輪）內未執行任何 Write 操作，導致 worktree 無任何程式碼產出。

## 症狀

- Worktree agent 完成後 `git diff --stat` 為空
- Agent output 中只有 Read/Grep/Bash(ls) 操作，Write 次數為 0
- Agent 最後一條訊息為 "Now let me check..." 或 "Let me create..." 但未實際執行

## 根因分析

1. **Subagent 預設行為**：傾向先完整理解 codebase 再動手寫程式碼
2. **回合數有限**：Worktree agent 的回合數約 15-20 輪，大型專案（100+ 檔案）的研究階段即可耗盡
3. **Specialized agent 更謹慎**：如 thyme-extension-engineer 比 general-purpose agent 更傾向先研究

## 觸發條件

- 派發 worktree subagent 實作程式碼（Phase 3b）
- 專案規模較大（src/ 目錄含 50+ 檔案）
- Prompt 未包含具體程式碼，只提供規格引用

## 解決方案

### 方案 A（v1.0.0 原始方案，已修正）

~~在 prompt 中直接提供完整程式碼~~ — 此方案在 W2-005 驗證中失敗：200+ 行程式碼佔用 prompt context，代理人仍在探索階段耗盡。

### 方案 B（v2.0.0 推薦，Ticket 中心化）

**將完整程式碼寫入 Ticket 或設計文件**，而非 prompt。代理人從 Ticket 讀取程式碼後注入目標檔案。

流程：
1. 設計代理人（sage）產出設計文件 + 完整程式碼片段，寫入 Ticket Solution 區段或獨立設計文件
2. 實作代理人收到精簡 prompt：「讀取 Ticket {path}，將 Solution 中的程式碼注入 {target_file} 的 {位置}」
3. 實作代理人操作：Read Ticket → Read 目標檔案尾部 → Edit 注入 → 執行測試 → commit

**好處**：
- 程式碼持久化在 Ticket 中，代理人失敗不遺失
- prompt 極短，代理人 context 充裕
- 探索量極小（只需確認注入位置）

## 防護措施

1. **Tool call 預算評估**：派發前估算 subagent 需要的 tool calls（Read/Grep/Edit/Bash），超過 15 次必須拆分（詳見 task-splitting.md）

2. **分工模式**：
   - 任務 A：探索與設計 — 產出程式碼到 Ticket（不寫 src/tests）
   - 任務 B：注入與驗證 — 從 Ticket 讀取程式碼並寫入（~5-6 tool calls）
   - 詳見 two-stage-dispatch.md

3. **代理人進度檢查點**：代理人完成每個步驟後，將中間結果寫入 Ticket（`ticket track append-log`），確保 context 耗盡時已完成的工作不遺失

4. **prompt 精簡原則**：prompt 只包含任務指令和 Ticket 路徑，不包含完整程式碼。程式碼放在 Ticket/設計文件中供代理人 Read

## 相關 Ticket

- 0.17.2-W2-002（首次發現，Phase 3b 派發 thyme-extension-engineer 3 次失敗）
- 0.17.2-W2-003（同上）
- 0.17.2-W2-005（二次驗證，4 次派發失敗，prompt 含完整程式碼方案失效）
- 0.17.2-W2-019（系統性分析，提出 Ticket 中心化方案）

## 發現日期

2026-04-05

---

**Last Updated**: 2026-04-06
**Version**: 2.0.0 - 從「prompt 含完整程式碼」修正為「Ticket 含完整程式碼」（0.17.2-W2-020）
