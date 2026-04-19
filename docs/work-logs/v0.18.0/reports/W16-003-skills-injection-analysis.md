# W16-003 Claude Code Skills 注入成本分析

**Ticket**: 0.18.0-W16-003
**Type**: ANA
**Date**: 2026-04-19

---

## 1. 背景與目標

診斷配額異常消耗時發現，CC runtime 每 session 啟動在 system-reminder 注入龐大 skills 清單，估算佔啟動 context ~15K tokens。本報告量化成本並提出精簡策略。

---

## 2. Skills 來源分類

從 session start system-reminder 解析，共 **170 個 skills** 來自三類來源：

### 2.1 專案內建（本地 `.claude/skills/`）

| 數量 | 位置 | 註冊狀態 |
|------|------|---------|
| **41** | `.claude/skills/*/SKILL.md` | 40 註冊 + 1 排除（per SessionStart log） |

代表：`ticket`, `tdd`, `wrap-decision`, `parallel-evaluation`, `doc-flow`, `worktree`, `error-pattern` 等專案核心流程工具。

### 2.2 已安裝 Plugin（user scope，`~/.claude/plugins/`）

已安裝 14 個 plugin，其中**有 skills 注入**者：

| Plugin | Skills 數（估） | 用途 | 本專案使用？ |
|--------|---------------|------|------------|
| `document-skills@anthropic-agent-skills` | ~18 | PDF/Docx/PPTX/XLSX/設計/art 等 | **否** |
| `example-skills@anthropic-agent-skills` | ~14 | 同上（重複） | **否** |
| `plugin-dev@claude-plugins-official` | ~7 | Plugin 開發工具 | 偶爾 |
| `hookify@claude-plugins-official` | ~5 | Hook rules 管理 | **否**（本專案自有 hook 系統） |
| `commit-commands@claude-plugins-official` | ~3 | commit/PR 輔助 | 偶爾 |
| `doc-structure-plugin@japanese-learning-tools` | 1 | 文檔結構 | **否** |
| LSP plugins (dart/gopls/pyright/typescript/marksman/yaml) | 0（僅提供 LSP） | 語言伺服器 | 視語言 |
| `github/linear/playwright/greptile/ralph-wiggum` | 0 | MCP tools（非 skills） | 依需求 |

### 2.3 內建系統 Skills

| 數量 | 備註 |
|------|------|
| ~3 | `init`, `review`, `security-review` |

### 2.4 總計與佔比

| 來源 | 數量 | 佔比 |
|------|------|------|
| 專案內建 | 41 | 24% |
| Anthropic Agent Skills (document + example) | ~32 | **19%（重複內容！）** |
| 其他 plugin skills | ~16 | 9% |
| CC 內建 | 3 | 2% |
| LSP/MCP 無 skills 注入 | 0 | 0% |
| **總計** | **~92-170** | — |

**關鍵發現**：`document-skills` 與 `example-skills` 有 **14+ 個 skill 名稱幾乎完全重複**（pdf/docx/pptx/xlsx/canvas-design/frontend-design/claude-api/mcp-builder/...），重複注入浪費 context。

---

## 3. Token 成本量化

### 3.1 單一 skill description 平均長度

抽樣測量 system-reminder 中 skill 描述：

| Skill | Description 字元數 | 預估 tokens |
|-------|------------------|-----------|
| `ticket`（本地） | ~130 | ~35 |
| `wrap-decision`（本地） | ~480 | ~130 |
| `document-skills:pdf` | ~520 | ~140 |
| `document-skills:docx` | ~680 | ~180 |
| `example-skills:docx` | ~680（重複） | ~180 |
| **平均** | ~400 字元 | **~110 tokens** |

### 3.2 全量注入成本

```
170 skills × 110 tokens = 18,700 tokens/session
```

**實際驗證**：system-reminder 從「The following skills are available」到結尾約 400 行，每行平均 50 字元含 prefix，總計 ~20K 字元 ≈ **~7K tokens**（修正估算：中英混雜比純中文密度高，~2.8 char/token）。

**修正後成本**：**~7-10K tokens/session** 啟動固定開銷，每 turn 重送（除非快取命中）。

### 3.3 可節省空間

| 移除對象 | 可省 tokens |
|---------|-----------|
| `example-skills` 全部（與 document-skills 重複） | ~1.5K |
| `document-skills`（本專案不處理 Office 檔案） | ~1.5K |
| `hookify`（本專案自有 hook 系統） | ~0.4K |
| `doc-structure-plugin`（日文學習工具誤裝） | ~0.1K |
| **小計** | **~3.5K tokens/session** |

---

## 4. 精簡方案

### 方案 A：卸載重複/無用 plugin（推薦）

**操作**：
```bash
claude plugin remove example-skills@anthropic-agent-skills
claude plugin remove document-skills@anthropic-agent-skills  # 若不處理 Office
claude plugin remove hookify@claude-plugins-official
claude plugin remove doc-structure-plugin@japanese-learning-tools
```

| 項目 | 評估 |
|------|------|
| 節省 tokens | ~3.5K/session（約 18% skills 注入） |
| 風險 | 未來需要 PDF/Office 處理時需重裝 |
| 可逆性 | 高（一行指令重裝） |
| 執行難度 | 低 |

### 方案 B：專案級 skills 過濾（settings.json）

**現況**：CC settings.json 目前無 `disabled_skills` 或等效欄位（官方未公開此 API）。

| 項目 | 評估 |
|------|------|
| 可行性 | **無**（需向 Anthropic 提 feature request） |
| 替代 | 以方案 A 取代 |

### 方案 C：scope=local 隔離

將非必要 plugin 從 `user scope` 改為僅在特定專案啟用：

| 項目 | 評估 |
|------|------|
| 節省 tokens | 依專案而異 |
| 風險 | 切專案時手動管理 |
| 執行難度 | 中（需 per-project settings） |

### 方案 D：向 Anthropic 反饋 skills 注入優化

長期方案：請 CC runtime 支援以下其一：

- 按 keyword 延遲注入（只在 prompt 含 trigger 時才載入 description）
- 專案級 skills allowlist/denylist
- Skills 描述 lazy-load（只注入名稱 + 一行摘要，完整 description 用時再讀）

---

## 5. Trade-off 總表

| 方案 | 節省 | 風險 | 可逆 | 建議 |
|------|------|------|------|------|
| A 卸載 plugin | 3.5K/session | 低 | 高 | **立即執行** |
| B settings 過濾 | — | — | — | 無此 API |
| C scope 隔離 | 視情況 | 中 | 高 | 次要優先 |
| D Anthropic 反饋 | 潛在 7K+ | 無 | 高 | 長期追蹤 |

---

## 6. 後續落地 Ticket 建議

| 編號 | 類型 | 標題 | 優先 |
|------|------|------|------|
| W16-003.1 | IMP | 卸載 example-skills + document-skills + hookify + doc-structure-plugin 並驗證節省 | P1 |
| W16-003.2 | DOC | 記錄 plugin 管理準則至 `.claude/references/plugin-management.md`（避免未來亂裝 plugin 膨脹 context） | P2 |
| W16-003.3 | ANA | 向 Anthropic 提 feature request：skills 注入優化（方案 D） | P3 |

---

## 7. 結論

- 170 skills 注入實際成本 **~7-10K tokens/session**（非原估 15K，但仍顯著）
- **~18% 為重複或無用 plugin 注入**，可透過卸載立即消除
- 專案內建 41 skills 為核心工具，不動
- CC runtime 目前無 skills 過濾 API，需走 plugin 層級管理

**建議執行順序**：
1. 立即執行方案 A（卸載無用 plugin）— 建 W16-003.1
2. 寫 plugin 管理準則 — 建 W16-003.2
3. 長期：W16-001（外移規則 5，省 5K）+ W16-002（file-size-guardian，省 1K）+ W16-003.1（省 3.5K）= **預期 auto-load 總降約 10K tokens/session**

---

**Report Author**: rosemary (PM 前台分析)
**Validation**: 基於 session start system-reminder 實測 + installed_plugins.json 交叉比對
