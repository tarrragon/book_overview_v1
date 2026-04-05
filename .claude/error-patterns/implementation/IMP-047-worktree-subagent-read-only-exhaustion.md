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

**在 prompt 中直接提供完整程式碼**（基於已有的功能規格），讓 agent 只需執行：
1. Write（寫入檔案）
2. Bash（跑測試）
3. Edit（修復失敗）

避免讓 agent 自行設計和研究程式碼結構。

## 防護措施

1. **Phase 3b prompt 必須包含完整程式碼或至少 80% 的骨架**
   - PM 在派發前根據 Phase 1 規格撰寫程式碼
   - 或使用前一階段（Phase 3a）的策略文件轉換為具體程式碼

2. **使用 general-purpose agent 而非 specialized agent**
   - General-purpose agent 更直接執行指令，不會過度研究
   - Specialized agent（如 thyme-extension-engineer）可能有額外的研究步驟

3. **明確指令「不要研究，直接寫」**
   - Prompt 開頭加入：「Do NOT read any other files first — just write these files and test」
   - 列出明確的檔案清單和完整內容

## 相關 Ticket

- 0.17.2-W2-002（首次發現，Phase 3b 派發 thyme-extension-engineer 3 次失敗）
- 0.17.2-W2-003（同上）

## 發現日期

2026-04-05

---

**Last Updated**: 2026-04-05
**Version**: 1.0.0
