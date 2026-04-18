# PC-088 v2 find_files Sub-class Validation (W15-015)

**Ticket**: 0.18.0-W15-015
**上游**: 0.18.0-W15-014 (E3 retrospective)
**上游結果**: find_files long_path_rate = 0.412 (n=136) > 0.3
**執行日期**: 2026-04-18

---

## 1. 路徑選擇

選擇 **Path A（enhanced retrospective）**。理由：

| 判準 | Path A | Path B (prospective A/B) | Path C |
|------|--------|--------------------------|--------|
| Session 成本 | 0（重用 E3 資料） | ≥10 新 session | A + B |
| Rule loading 污染 | 無（觀察既有行為） | 高（兩組皆載入同 .claude/） | 高 |
| 因果推論強度 | 觀察性（弱 causal） | 實驗性（強 causal） | 強 |
| 可重現性 | 完全（腳本掃描） | 低（單次 subagent） | 混合 |
| 能否區分 H1 支持 vs correlation | 可（透過 sub-pattern 分層 + 可替代性檢定） | 可 | 可 |

**關鍵洞察**：E3 的 `find_files` rate 0.412 已 > 0.3 閾值，問題不在「是否存在偏誤」而在「偏誤的機制」。
Path A 的分層分析可直接區分三種競爭假設：

- H1（步驟估算偏誤）：大多數 long path 是 Glob 可直接替代的 `find -name`，且 session 同時有用 Glob → 非「不知道」而是「未被觸發」。
- H2（工具等價性差異）：long path 多為 `ls -R`、帶 `-exec` 的 find，Glob 無法單步替代 → rate 高是任務性質非偏誤。
- H3（情境依賴）：混合使用（同 session 有 Glob 有 find）普遍 → 選擇與語境相關，非純習慣。

Path B 的致命缺陷：control 組與 treatment 組都會完整載入 `.claude/rules/`（含 search-tools-guide）。差異僅在 user prompt 是否明確提示 Glob，
這測的是「prompt 工程有效性」而非「預設啟發式是否有偏誤」。且 single-session × 單一 model 的樣本不足以支持 causal claim。

**放棄 Path C**：若 Path A 的分層分析足夠區分 H1/H2/H3，追加 Path B 的邊際資訊量低於其污染風險。

---

## 2. 方法

掃描最新 50 個 session transcript，將 E3 中歸類為 find_files long-path 的指令進一步分層：

### 2.1 Sub-pattern 分類

| 子類 | 範例 | Glob 可替代性 |
|------|------|--------------|
| `find_name`（單純 -name/-iname） | `find docs -name '*.md'` | 是（單步 Glob） |
| `find_name` + filter | `find . -name X -exec grep Y \;` | 否（涉及 exec/mtime/size） |
| `ls_recursive` | `ls -R dir/` | 是（Glob `**/*`） |
| `ls_simple`（排除） | `ls dir/` | 非 find_files 任務，自樣本排除 |

### 2.2 Session-level profile

對每個 session 統計：Glob 呼叫次數、find/ls -R long-path 次數。將 session 分為：

- **Mixed**: Glob ≥1 且 long-path ≥1
- **Glob-only**: Glob ≥1 且 long-path = 0
- **Long-only**: Glob = 0 且 long-path ≥1
- **Neither**: 兩者皆 0（不計入）

### 2.3 可替代性判準

Long-path 指令標記為「Glob 可替代」若：

- `find` 路徑：只有 `-name`/`-iname`，**無** `-exec`, `-mtime`, `-size`, `-newer`, `-type` (非 f/d) 等 predicate
- `ls -R` 路徑：無限制條件

「不可替代」代表 Glob 無法單步取代，rate 高屬於任務性質而非偏誤。

---

## 3. 結果

- Session 檔案數：50
- find_files long-path 觀察總數（排除 `ls_simple`）：57
- 納入樣本（find_name + ls_recursive）：57
- Session 中 Glob 呼叫總數：80

### 3.1 Sub-pattern 分布

| Sub-pattern | Count | Glob 可替代 | 替代率 | 含 pipe 後處理 |
|-------------|-------|-------------|--------|---------------|
| `find_name` | 56 | 40 | 0.714 | 0.714 |
| `ls_recursive` | 1 | 1 | 1.000 | 0.000 |
| `ls_simple`（排除） | 161 | 0 | 0.000 | 0.646 |
| **納入合計** | **57** | **41** | **0.719** | — |

### 3.2 Session-level profile

| Profile | Session 數 | 說明 |
|---------|-----------|------|
| Mixed（Glob + long-path 並用） | 9 | 選擇情境化 |
| Glob-only | 12 | 啟發式已傾向 Glob |
| Long-only（未用 Glob 卻用 find/ls -R） | 16 | 啟發式偏誤最強訊號 |
| Neither | 13 | 該 session 無 find_files 需求 |
| **Active total** | **37** | — |

### 3.3 H1 關鍵指標：Mixed session 中的可替代 long-path

「既已知道用 Glob、但同 session 內仍選 find/ls -R」且「該 find/ls -R 是 Glob 單步可替代」的觀察 —— 這是 H1（步驟估算偏誤）最強訊號。

| 來源 | Long obs | 其中可替代 | 可替代率 |
|------|----------|------------|----------|
| Mixed sessions | 23 | 14 | 0.609 |
| Long-only sessions | 34 | 27 | 0.794 |
| 全部納入樣本 | 57 | 41 | 0.719 |

---

## 4. 判讀

### 4.1 三假設檢定

- **整體可替代率** = 0.719（41/57）
- **Mixed session 可替代率** = 0.609（14/23）
- **Session profile 比例**：mixed=9, glob-only=12, long-only=16

判讀：

- **H1（步驟估算偏誤）支持度：強**。多數 find/ls -R 是 Glob 單步可替代，且在已知用 Glob 的 session 中仍發生 —— 支持「未被觸發」而非「不知道」。
- **H2（工具等價性）支持度：弱**。多數 long-path 是 Glob 可替代的單純 find -name / ls -R。
- **H3（情境依賴）支持度：弱**。非 mixed 型 session 居多。

### 4.2 PC-088 v2 `find_files` 章節更新建議

**結論**：**因果支持（觀察性強證據）**

PC-088 v2 `find_files` 章節保留「步驟估算偏誤」主張，並附本實驗結果作為觀察性強證據。承認 single-model、觀察性方法的限制。

---

## 5. 方法限制（誠實聲明）

- **Single-model**：樣本來自 Claude Code 單一模型 session，不可推論到其他 LLM。
- **觀察性非實驗性**：本設計不操縱變因；不能完全排除遺漏變因（confounders），例如：
  - 用戶下游 prompt 可能誘導特定工具選擇
  - Subagent 行為與主 session 混入，未做 role 分離
- **Glob 可替代性是保守判準**：忽略 `-type`/`-maxdepth` 等可能仍可由 Glob 表示的變體；實際可替代比例可能被低估。
- **Rule loading 相同**：所有 session 都載入同套 `.claude/rules/`，無法分離「規則有無」對選擇的影響。要答這問題需要 cross-repo 比較，超出本 ticket scope。
- **樣本偏斜**：50 session 中有大量 PM / ticket 操作情境，find_files 出現的任務分佈可能不代表一般開發工作。

---

## 6. 證據樣本

### 6.1 Mixed session 中的可替代 long-path（H1 訊號）

- [find_name] `find docs/work-logs -name "*W15-001*" 2>&1`
- [find_name] `find docs/work-logs/v0.18.0/tickets -name "*W3-002*"`
- [find_name] `find .claude -name "hook_utils*" -type f 2>&1 | head -5`
- [find_name] `find .claude/skills/sync-pull -name "*.md" -o -name "*.py" -o -name "*.sh" -o -name "*.yaml" 2>/dev/null`
- [find_name] `# 找 sync-pull 腳本
find .claude -name "*sync*pull*" -o -name "*pull*sync*" 2>/dev/null`
- [find_name] `# 確認這些未來版本目錄是否有實際內容
for d in v0.18.0 v0.18.1 v0.19.0 v0.20.0; do
  count=$(find "docs/work-logs/v0/v0.${d#v0.}/v$d/tickets" -name "*.md" 2>/`
- [find_name] `find ~/.claude -name "*.log" 2>/dev/null | head -10`
- [find_name] `find .claude/hooks -name "hook_utils.py" -not -path "*__pycache__*" -not -path "*worktrees*" 2>/dev/null`

### 6.2 不可替代 long-path（H2 訊號）

- [find_name] `find .claude -name "*.md" -newer CLAUDE.md -not -path "*/hook-logs/*" 2>/dev/null | head -20 && echo "---" && find docs -name "*auq*" -o -na`
- [find_name] `find .claude/hook-logs -name "agent-ticket-validation*" -mmin -20 -exec tail -20 {} \; 2>/dev/null | head -30`
- [find_name] `find .claude/hook-logs -name "*.log" -mmin -10 -exec grep -l -E "ERROR|Exception|TypeError" {} \; 2>/dev/null | head -5 && echo "---" && cat`
- [find_name] `find .claude/hook-logs -name "*.log" -mmin -5 -exec grep -l -E "ERROR|Exception|TypeError|Traceback" {} \; 2>/dev/null | head -5`
- [find_name] `cat .claude/dispatch-active.json 2>/dev/null && echo "---" && find .claude/hook-logs -name "*.log" -mmin -3 -exec grep -l -E "ERROR|Exceptio`

---

## 7. Reproducibility

```bash
uv run scripts/experiments/pc088_v2_find_files_validation.py --sessions 50
```

Script：`scripts/experiments/pc088_v2_find_files_validation.py`
上游資料來源：同 E3 的 `~/.claude/projects/-Users-tarragon-Projects-book-overview-v1/*.jsonl`

