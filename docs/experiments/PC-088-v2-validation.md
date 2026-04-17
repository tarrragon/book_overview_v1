# PC-088 v2 Retrospective Audit (E3)

**Ticket**: 0.18.0-W15-014
**來源 ANA**: 0.18.0-W15-011（E3 設計章節）
**執行日期**: 2026-04-18

---

## 1. 方法

掃描 `~/.claude/projects/-Users-tarragon-Projects-book-overview-v1/*.jsonl` 最新 50 個 session transcript，逐一解析 assistant 的 `tool_use` 事件，依 4 類 canonical task 編碼為 short/long path。

### 1.1 編碼規則

| Canonical task | Short path（單步） | Long path（多步） |
|----------------|-------------------|-------------------|
| 傳長文字 >1KB 到 CLI | Bash heredoc（指令長度 >1KB 即視為長文字內嵌） | Write `/tmp/*` 或 `cat > /tmp/`/`tee /tmp/` 後再讀回 |
| 修改檔案局部 | `Edit` / `MultiEdit` 工具 | （本版本不啟用 Read+Write 配對偵測，保留將來擴充） |
| 查字串 | `Grep` 工具 | Bash `grep`/`rg`/`ag`（首段命令）或 `find ... -exec grep` |
| 查檔案 | `Glob` 工具 | Bash `find ... -name`、`ls -R` |

### 1.2 已知限制（保守性聲明）

- `T_LOCAL_EDIT` 的 long path（Read+Write 整檔重寫）需要跨 tool_use 配對分析，v1 未啟用；該分類 long count 將保守為 0。
- Bash heredoc 被視為 short path 的判準為指令字串長度 >1KB（因 heredoc body 是 inline），可能低估（小於 1KB 的 heredoc 不算進樣本）。
- 不計入 Bash `| grep` 濾管（屬後處理，非 search task）。
- Subagent 內部 tool_use 已被計入（主 session JSONL 包含 subagent 副本）；若要排除需再增欄位過濾。

---

## 2. 樣本

- Session 檔案數：50
- 觀察事件總數：1157

按 canonical task 分組的樣本分佈見第 3 節。

---

## 3. long_path_rate 結果

| Task | short | long | total | long_path_rate |
|------|-------|------|-------|----------------|
| pass_long_text_to_cli | 63 | 5 | 68 | 0.074 |
| modify_file_locally | 468 | 0 | 468 | 0.000 |
| search_strings | 361 | 124 | 485 | 0.256 |
| find_files | 80 | 56 | 136 | 0.412 |
| **ALL** | **972** | **185** | **1157** | **0.160** |

---

## 4. 判讀

### 4.1 每類 task

- `pass_long_text_to_cli`：rate = 0.074 (n=68) → < 0.1 缺實證 → PC-088 v2 降級為 hypothesis
- `modify_file_locally`：rate = 0.000 (n=468) → < 0.1 缺實證 → PC-088 v2 降級為 hypothesis
- `search_strings`：rate = 0.256 (n=485) → 0.1–0.3 灰色地帶 → 說明限制、不作 causal claim
- `find_files`：rate = 0.412 (n=136) → > 0.3 支持偏誤 → 建議觸發 E2

### 4.2 整體

- overall long_path_rate = 0.160 (n=1157)
- 整體判讀：**0.1–0.3 灰色地帶 → 說明限制、不作 causal claim**

### 4.3 sample size tripwire 檢查

ANA 原設計要求「4 類各 >5 實例」；實測：

- `pass_long_text_to_cli`: total=68 → 符合
- `modify_file_locally`: total=468 → 符合
- `search_strings`: total=485 → 符合
- `find_files`: total=136 → 符合

樣本不足的分類應以「誠實報告限制、保守判讀」原則對待，不作 causal claim。

---

## 5. 證據樣本

### 5.1 pass_long_text_to_cli

**Short path 樣本**：

- `ticket track append-log 0.18.0-W15-014 --section "Problem Analysis" "$(cat <<'EOF' ### Context Bundle **來源**：從 W15-011 A...`
- `ticket track append-log 0.18.0-W15-011 --section "Problem Analysis" "$(cat <<'EOF' ## WRAP 分析 ### W — Widen（候選實驗方案） | # ...`
- `ticket track append-log 0.18.0-W15-011 --section "Solution" "$(cat <<'EOF' ## 實驗設計：PC-088 v2 雙軌驗證 ### 實驗假設 **主假設 H1（步驟數估...`
- `ticket track set-who 0.18.0-W15-012 "rosemary (PM 前台)" 2>&1 | tail -2 ticket track append-log 0.18.0-W15-012 --section "...`
- `ticket track append-log 0.18.0-W15-012 --section "Solution" "$(cat <<'EOF' ## 合併/劃分建議 ### 推薦策略：方案 4（訊號分層，共用 Hook 框架） **架...`

**Long path 樣本**：

- `Write /tmp/w15_001_solution.md (2024B)`
- `# 建立測試用的含 U+FFFD 的檔案 echo '統\xef\xbf\xbd\xef\xbf\xbd 修\xef\xbf\xbd' > /tmp/test_utf8_corrupt.md && python3 -c " with ope...`
- `echo '{"tool_name":"Bash","tool_input":{"command":"echo test"},"tool_output":"test"}' | python3 .claude/hooks/pre-fix-ev...`
- `# 模擬 4 個並行 Bash hook 觸發，檢查是否有 timeout 或錯誤 for i in 1 2 3 4; do (echo '{"tool_name":"Bash","tool_input":{"command":"(cd ....`
- `# macOS 沒有 timeout，用 gtimeout 或直接跑 for i in 1 2 3 4; do (echo '{"tool_name":"Bash","tool_input":{"command":"ticket track...`

### 5.2 modify_file_locally

**Short path 樣本**：

- `Edit /Users/tarragon/Projects/book_overview_v1/.claude/hooks/branch-verify-hook.py`
- `Edit /Users/tarragon/.claude/projects/-Users-tarragon-Projects-book-overview-v1/memory/MEMORY.md`
- `Edit /Users/tarragon/.claude/projects/-Users-tarragon-Projects-book-overview-v1/memory/MEMORY.md`
- `Edit /Users/tarragon/Projects/book_overview_v1/docs/work-logs/v0/v0.18/v0.18.0/tickets/0.18.0-W15-011.md`
- `Edit /Users/tarragon/Projects/book_overview_v1/docs/work-logs/v0/v0.18/v0.18.0/tickets/0.18.0-W15-011.md`

### 5.3 search_strings

**Short path 樣本**：

- `Grep 規則五|規則 5|heredoc`
- `Grep 無待恢復的交接檔案`
- `Grep 無待恢復的交接檔案|handoff.*file|pending.*handoff|resume_ticket|load_`
- `Grep -handoff\.json|handoff\.json|f\".*handoff.*\.json\"`
- `Grep handoff.*json|write_text|\.json['\"]`

**Long path 樣本**：

- `grep -n "exempt\|\.claude\|docs/" .claude/hooks/branch-verify-hook.py 2>&1 | head -40`
- `grep -n "^- 2026-04-18" docs/work-logs/v0/v0.18/v0.18.0/v0.18.0-main.md | tail -5`
- `grep -rn "wrap-triggers\|keyword\|trigger" .claude/config/wrap-triggers.yaml 2>/dev/null | head -30 && echo "---" && ls ...`
- `grep -n "isolation\|worktree\|主 repo\|dispatch" .claude/hooks/agent-dispatch-validation-hook.py 2>&1 | head -30`
- `grep -rn 'v.*handoff' .claude/hooks/ .claude/skills/ 2>&1 | grep -v 'Binary\|\.pyc' | head -20`

### 5.4 find_files

**Short path 樣本**：

- `Glob docs/work-logs/v0.18.0/**/0.18.0-W15-*.md`
- `Glob **/0.18.0-W15-01[1456].md`
- `Glob docs/work-logs/v0/v0.18/v0.18.0/tickets/0.18.0-W15-0{17,18,1`
- `Glob docs/work-logs/v0.18.0/tickets/**/0.18.0-W15-001*.md`
- `Glob .claude/skills/ticket/ticket_system/commands/track_chain*`

**Long path 樣本**：

- `find docs/work-logs -name "*W15-001*" 2>&1`
- `find . -name "*W14-023*" -not -path "*/node_modules/*" 2>/dev/null`
- `find docs/work-logs -name "*W14-019*" 2>&1 | head -20`
- `ls /Users/tarragon/Projects/book_overview_v1/docs/work-logs/v0/v0.18/v0.18.0/tickets/ 2>&1 | grep "W10-035\|W10-027\|W10...`
- `ls /Users/tarragon/Projects/book_overview_v1/.claude/methodologies/ 2>&1 | grep -iE "decision|wrap|consult|advise|cognit...`

---

## 6. 結論與下一步

判讀決策樹（對照 W15-011 E3）：

| 整體 long_path_rate | 行動 |
|--------------------|------|
| > 0.3 | 觸發 E2 A/B 因果實驗（W15-015） |
| 0.1–0.3 | 說明限制、PC-088 v2 維持但標註「機制未定」 |
| < 0.1 | PC-088 v2 降級為 hypothesis，建立回退 Ticket（W15-016） |

**本次 audit 結論**：overall rate = 0.160 → **0.1–0.3 灰色地帶 → 說明限制、不作 causal claim**

各 task 類別的異質性見 §4.1；若個別 task 出現極端值，應在 W15-016 的 PC-088 v2 更新中分類討論，不以整體 rate 一刀切。

---

## 7. Reproducibility

重新執行：

```bash
uv run scripts/experiments/pc088_v2_audit.py --sessions 50
```

Script 路徑：`scripts/experiments/pc088_v2_audit.py`
Transcript 來源：`~/.claude/projects/-Users-tarragon-Projects-book-overview-v1/*.jsonl`

