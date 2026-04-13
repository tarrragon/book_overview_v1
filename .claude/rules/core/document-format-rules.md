# 文件格式規則

本文件定義專案中所有交接文件的格式規範。

---

## 適用範圍

**交接文件定義**：用於團隊協作和知識傳遞的文件

| 文件類型 | 存放位置 |
|---------|---------|
| 計畫文件 | `.claude/plans/` |
| 工作日誌 | `docs/work-logs/` |
| Ticket 文件 | `docs/work-logs/v{version}/tickets/` |
| 錯誤模式記錄 | `.claude/error-patterns/` |
| README 文件 | 各目錄下的 `README.md` |

---

## 強制規則

### 規則 1：禁止使用 Emoji

**所有交接文件禁止使用 emoji 符號**

| 禁止 | 替代方案 | 範例 |
|------|---------|------|
| :white_check_mark: / :heavy_check_mark: | `[x]` | `[x] 任務已完成` |
| :x: / :negative_squared_cross_mark: | `[ ]` | `[ ] 待處理項目` |
| :warning: | `[WARNING]` 或 `警告：` | `[WARNING] 注意事項` |
| :bulb: | `提示：` 或 `建議：` | `建議：考慮使用 LSP` |
| :fire: / :rocket: | 純文字描述 | `高優先級` |

**理由**：
- 確保跨平台相容性
- 維持專業性
- 避免渲染問題

### 規則 2：狀態標記

使用純文字標記狀態：

| 狀態 | 標記方式 | 範例 |
|------|---------|------|
| 完成 | `[x]` 或 `completed` | `- [x] 完成規格設計` |
| 未完成 | `[ ]` 或 `pending` | `- [ ] 待實作功能` |
| 進行中 | `in_progress` | `status: in_progress` |
| 阻塞 | `blocked` | `status: blocked` |

### 規則 3：優先級標記

使用文字而非符號標記優先級：

| 優先級 | 標記方式 | 說明 |
|-------|---------|------|
| P0 | `高` 或 `P0` | 緊急，立即處理 |
| P1 | `中` 或 `P1` | 重要，本版本處理 |
| P2 | `低` 或 `P2` | 一般，排入後續 |

### 規則 4：Markdown 格式規範

| 規範 | 說明 |
|------|------|
| 標題層級 | 使用 `#` 到 `####`，避免超過 4 層 |
| 清單縮排 | 使用 2 或 4 個空格 |
| 程式碼區塊 | 使用三個反引號並標明語言 |
| 表格對齊 | 使用 `|` 分隔，`:---` 控制對齊 |
| 連結格式 | `@path/to/file.md` 引用格式 |

### 規則 5：檔案命名規範

| 類型 | 格式 | 範例 |
|------|------|------|
| 工作日誌 | `v{版本}-{描述}.md` | `v0.29.0-ticket-system-refactor.md` |
| Ticket | `{版本}-W{波次}-{序號}.md` | `0.29.0-W1-001.md` |
| 規則檔案 | `{描述}-{類型}.md` | `language-constraints.md` |
| 方法論 | `{主題}-methodology.md` | `atomic-ticket-methodology.md` |

---

## YAML Frontmatter 規範

Ticket 和工作日誌應包含 YAML frontmatter：

```yaml
---
id: {文件 ID}
title: {標題}
type: {類型}
status: {狀態}
created: {建立日期}
updated: {更新日期}
---
```

---

## 跨檔案引用格式規範

### 規則 6：引用路徑格式

| 引用場景 | 格式 | 範例 |
|---------|------|------|
| Skill 內部引用（同 Skill 目錄） | 相對路徑 | `references/workflow-create.md` |
| 跨 Skill 引用 | 完整路徑（從 .claude/ 開始） | `.claude/skills/doc-flow/SKILL.md` |
| 引用 rules/references | 完整路徑 | `.claude/rules/core/quality-baseline.md` |
| 引用專案根目錄檔案 | 從根目錄開始 | `docs/work-logs/v{VERSION}/` |
| CLAUDE.md 中的引用 | `@` 前綴 | `@.claude/rules/core/quality-baseline.md` |

**理由**：
- 內部引用用相對路徑，搬移 Skill 目錄時只需改外部引用
- 跨 Skill 引用用完整路徑，避免閱讀者不知道要從哪個目錄起算

### 規則 7：規格文件引用穩定性

**規格文件（docs/spec/、docs/use-cases.md）禁止引用臨時性文件**

| 文件類型 | 穩定性 | 可被規格引用 |
|---------|--------|------------|
| 規格文件（docs/spec/） | 穩定 | 是 |
| Use Cases（docs/use-cases.md） | 穩定 | 是 |
| 提案文件（docs/proposals/） | 穩定 | 是 |
| CLAUDE.md | 穩定 | 是 |
| Worklog（docs/work-logs/） | 臨時 | **否** |
| Ticket 檔案 | 臨時 | **否** |
| Plan 檔案 | 臨時 | **否** |

**允許的例外**：
- 變更歷史中記錄 Ticket ID 作為「來源標注」（如：「本次變更由 0.17.0-W1-002 執行」）
- 這是記錄歷史事實，不是建立依賴

**禁止的模式**：

| 禁止 | 原因 | 正確做法 |
|------|------|---------|
| `詳見 v0.17.1 W1-001` | Ticket 可能被遷移、刪除、重新編號 | `待定義於匯出規格章節` 或直接在此定義 |
| `參考 docs/work-logs/v0.17/...` | Worklog 會被歸檔，路徑可能失效 | 引用對應的 spec 文件 |
| `依 0.18.0-W2-001 的分析結論` | 結論應提煉為規格，而非依賴分析過程 | 將結論寫入規格文件 |

**理由**：
- 規格文件是開發的**唯一穩定依據**，worklog 和 ticket 是**過程記錄**
- 過程記錄可能遺失、修改、遷移，規格文件不應依賴不穩定來源
- 如果規格需要引用的資訊尚未定義，標記為「待定義」而非指向臨時文件

### 規則 8：框架文件禁止引用專案層級識別符

**`.claude/` 框架文件禁止引用專案特定的 ticket ID、commit hash、worklog 路徑等專案層級識別符**

`.claude/` 是**跨專案共用框架**，透過 sync 機制同步到多個專案（如 `.claude/skills/sync-push`、`sync-pull`）。專案層級識別符只存在於當前專案，sync 到其他專案後會變成死連結和誤導性資訊。

| 識別符類型 | 範例 | 可在框架文件引用？ |
|---------|------|-----------------|
| 專案 ticket ID | `0.18.0-W5-001`、`W2-007` | **否** |
| 專案 commit hash | `8f74d08`、`abc1234` | **否** |
| 專案 worklog 路徑 | `docs/work-logs/v0.17/...` | **否** |
| 專案 proposals ID | `PROP-007` | **否**（除非已提煉為方法論） |
| 框架 error-pattern ID | `PC-050`、`IMP-003`、`ARCH-002` | **是**（框架內部分類） |
| Claude Code 版本號 | `CC 2.1.97` | **是**（外部平台識別） |
| 框架檔案路徑 | `.claude/rules/core/pm-role.md` | **是**（框架內部結構） |

**適用範圍**：

| 目錄 | 適用規則 8？ |
|------|-------------|
| `.claude/rules/` | 是 |
| `.claude/pm-rules/` | 是 |
| `.claude/references/` | 是 |
| `.claude/methodologies/` | 是 |
| `.claude/error-patterns/` 內容（檔名除外） | 是 |
| `.claude/agents/` | 是 |
| `.claude/skills/` | 是 |
| `.claude/hooks/` Python docstring/comment | 是 |
| `.claude/best-practices/` | 是 |
| `.claude/handoff/archive/` | **否**（歷史紀錄，合理保留） |
| 專案 `docs/` | **否**（專案內部，可引用） |
| `CLAUDE.md` | **否**（專案入口，可引用） |

**Memory 和 ticket 也是專案層級**：

用戶/專案 auto-memory（`~/.claude/projects/<project>/memory/`）和 ticket（`docs/work-logs/`）**都不會跨專案 sync**，所以「把原則寫到 memory」不能取代框架規則。需要跨專案落實的原則必須寫入：
- `.claude/rules/`（自動載入規則）
- `.claude/error-patterns/`（錯誤學習經驗）
- `.claude/methodologies/`（方法論）

**禁止的模式**：

| 禁止 | 改為 |
|------|------|
| `（來源：0.18.0-W4-002）` | `（防範 Hook error 干擾代理人判斷）` |
| `（W5-021 教訓）` | `（多代理人 permissionMode 批次修復教訓）` |
| `**Ticket**: 0.17.3-W12-001`（在 error-pattern 內） | 移除整行（檔名 PC-XXX 已是足夠識別） |
| `來源：PROP-007` | 以提案內容的抽象描述取代 |

**允許的例外**：

| 例外 | 說明 |
|------|------|
| error-pattern 檔名本身 | `PC-050-premature-agent-completion-judgment.md` 是框架內部分類 |
| 觸發日期 | 「2026-04-12 新增」可保留，日期不是專案識別符 |
| 通用 CC 能力版本號 | 「CC 2.1.97 新增 /agents 分頁」屬外部平台能力 |

**理由**：
- `.claude/` 經 sync 跨專案共用，專案識別符在其他專案是死連結
- 框架文件的價值在於**抽象原則**，專案引用是耦合而非依賴
- Memory/ticket 也是專案內部，不能承擔跨專案原則的傳遞責任

---

## 檢查清單

建立交接文件時，確認：

- [ ] 無 emoji 符號
- [ ] 使用純文字狀態標記
- [ ] 優先級使用「高/中/低」或「P0/P1/P2」
- [ ] Markdown 格式正確
- [ ] 檔案命名符合規範
- [ ] 有適當的 frontmatter（如適用）
- [ ] 跨 Skill 引用使用完整路徑
- [ ] 規格文件未引用 worklog/ticket/plan 等臨時性文件
- [ ] 框架文件（`.claude/`）未引用專案 ticket ID / commit hash / worklog 路徑（規則 8）

---

**Last Updated**: 2026-04-13
**Version**: 1.4.0 - 新增規則 8：框架文件禁止引用專案層級識別符（確保跨專案 sync 不產生死連結）
