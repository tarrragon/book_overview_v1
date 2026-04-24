# PC-110: Body-Check False Negative via Schema Separator

**Category**: process-compliance
**Severity**: High
**Status**: Active (防護設計待 W17-070 ANA 完成後補完)
**Created**: 2026-04-24
**Source**: W17-056 事件 — IMP ticket 章節錯位（實作內容寫在自定義 H2 而非 Schema 必填章節），`ticket_validator._is_placeholder` 漏判放行空殼；W17-032（2026-04-21）已修 false positive 分支，W17-056 暴露 false negative 分支。

**Related Ticket**: `0.18.0-W17-070`（ANA，分析雙根因並設計防護 IMP）

---

## 症狀

IMP ticket complete 成功但實際 Schema 必填章節（`Problem Analysis` / `Solution` / `Test Results`）無實質內容，實作摘要與驗證結果寫在自定義 H2 章節（`## 實作摘要` / `## 驗證指令與結果`）。`ticket track validate` 顯示 4/4 合規，body-check hook 未擋。

典型訊號：

| 訊號 | 說明 |
|------|------|
| Schema 必填章節只剩 schema note 註解 + `---` 分隔符 | `<!-- Schema[...]: 必填 -->\n\n<!-- To be filled -->\n\n---` |
| Ticket 檔案含 `## 實作摘要` / `## 驗證指令與結果` 等非 schema 章節 | agent 未按 `agent-definition-standard` v1.1.0「執行責任」條款 |
| 自定義 H2 之間缺 `---` 分隔符 | `## Test Results` 直接黏在前一章節末尾 |
| `ticket track validate` 全數通過但肉眼審查發現 placeholder | 雙層共振掩蓋 |

## 根因（W17-070 ANA 將完整分析）

目前高信心定位兩層共振：

### 根因 A：`_is_placeholder` 邏輯漏洞

`.claude/skills/ticket/ticket_system/lib/ticket_validator.py` 函式 `_is_placeholder`（W17-032 修復位置 line 316-367）剝除 HTML 註解後判空，但未剝除 markdown 分隔符 `---`。章節內容為 `<!-- note -->\n\n<!-- placeholder -->\n\n---` 時，剝除註解剩 `---`，被判為非 placeholder 放行。

| 分支 | W17-032 狀態 |
|------|-------------|
| False positive（合法 ticket 被擋） | 2026-04-21 已修 |
| False negative（空殼 ticket 被放） | **未覆蓋**（W17-056 事件） |

### 根因 B：Agent 自定義 H2 切斷 Schema Section

`validate_execution_log`（line 406-452）擷取 section 內容邏輯：從 `## Section` 標題到**下一個** `##` 或 `###` 為止（line 439-443）。

當 agent 寫 `## 實作摘要` 作為 H2 章節（而非 `## Solution` 下的 H3），schema section 擷取範圍被切斷在 `## 實作摘要` 之前，僅含 schema note + 分隔符。結合根因 A 的漏洞，整張 ticket 繞過 body-check。

Agent 行為偏離來源：`.claude/rules/core/agent-definition-standard.md` v1.1.0「執行責任：Ticket body 填寫」條款可能未對 agent 明示「禁止自定義 H2 章節，必須用 schema 章節 + 視需要用 H3 子章節」。

## 暫時應變（W17-070 ANA 完成前）

發現 IMP / ANA / DOC ticket complete 後疑似章節錯位時：

| 動作 | 方法 |
|------|------|
| 快速檢測 | `grep -nE "^## (實作摘要\|驗證指令與結果\|Problem Analysis\|Solution\|Test Results)" <ticket.md>` |
| 確認漏擋 | 讀取 Schema 必填章節內容，確認剝除 schema note / placeholder 後仍有實質內容 |
| 手動修復 | `Edit` 工具搬移自定義 H2 內容至 Schema 章節，降為 H3 子章節；補 `---` 分隔符 |
| 追蹤根因 | 不回退已 complete 工作（規則 6）；另開 ANA ticket 追蹤 validator bug + agent 行為 |

## 防護（待 W17-070 ANA 結論設計）

W17-070 將產出 spawned IMP 涵蓋：

1. **症狀修復 IMP**：`_is_placeholder` 加入 markdown 分隔符剝除；`validate_execution_log` 可能需掃描全文而非僅 section 範圍
2. **根因防護 IMP**：`agent-definition-standard.md` 強化章節填寫條款；可能新增 pre-complete hook 檢查自定義 H2 章節

## 相關事件

| Ticket | 日期 | 事件 |
|--------|------|------|
| W17-032 | 2026-04-21 | Validator false positive 修復（thyme 選項 C，commit `21d53238`） |
| W17-056 | 2026-04-24 | IMP complete 漏擋（此 PC 的觸發事件） |
| W17-070 | 2026-04-24 | ANA 追蹤雙根因（此 PC 的防護依賴） |

## 相關文件

- `.claude/skills/ticket/ticket_system/lib/ticket_validator.py` — bug 位置
- `.claude/rules/core/agent-definition-standard.md` v1.1.0 — 「執行責任：Ticket body 填寫」條款
- `.claude/pm-rules/ticket-body-schema.md` — type-aware body schema 定義
- `.claude/rules/core/quality-baseline.md` 規則 5+6 — 所有發現必須追蹤 + 失敗案例學習原則
- Memory `feedback_body_check_false_negative_schema_separator.md` — 本事件的 memory feedback 記錄

---

**Last Updated**: 2026-04-24
**Version**: 0.1.0 — 初版症狀記錄；防護設計待 W17-070 ANA 結論
