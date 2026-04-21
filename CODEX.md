# CODEX.md

本文件為 Codex 在此專案中的專案入口。Codex 應以本檔作為啟動入口，並主動讀取 `.claude/` 內仍具效力的規則與技能資料；不沿用 Claude 專屬工具語法，但保留其內容知識。

---

## 0. 載入來源

Codex 在此專案中，應將以下三個目錄視為**主要知識來源**：

- `.claude/rules/`：所有角色共用的基線規則
- `.claude/pm-rules/`：流程、決策、Ticket、TDD、驗證等 PM / 方法論規則
- `.claude/skills/`：可按任務需要主動讀取的技能與工作流程
- `.codex/skill-trigger-map.md`：skills 關鍵字 / 意圖觸發對照表

**讀取原則**：

- 不要求平台自動載入；Codex 應在每個對話 session 開始時主動完成本檔定義的預載。
- 若 `CODEX.md` 與 `.claude/` 內容衝突，以較具體、較接近任務的規則為準。
- 若規則依賴 Claude 專屬工具名稱或平台能力，保留其**意圖與流程**，改用 Codex 可用工具實作，不照抄平台語法。
- 不論當前任務是否立即涉及寫程式，session start 都必須先讀 `rules` 與 `pm-rules` 的必讀項，再進入後續判斷。

## 0.1 Session Start 預載要求

每個新 session 進入此專案時，Codex 都必須先完成以下預載：

1. `CODEX.md`
2. `.claude/rules/README.md`
3. `.claude/rules/core/*` 中與通用品質、溝通、工具使用、文件格式、語言約束相關的核心規則
4. `.claude/pm-rules/decision-tree.md`
5. `.claude/skills/ticket/SKILL.md`

以上五項屬於**session start 必讀**，不是按需建議。

完成預載後，所有基本決策邏輯應以 `.claude/pm-rules/decision-tree.md` 為主路由，再依路由結果補讀其他 `pm-rules` 或 `skills`。

**Session Start 後的讀取順序**：

1. 先讀 `CODEX.md`
2. 再讀 `.claude/rules/README.md`
3. 預載 `.claude/rules/core/*`
4. 預載 `.claude/pm-rules/decision-tree.md`
5. 預載 `.claude/skills/ticket/SKILL.md`
6. 依決策樹路由結果補讀其他 `.claude/pm-rules/*`
7. 若任務明顯對應某個 skill，再讀 `.claude/skills/<skill>/SKILL.md`

## 0.2 Skills 觸發規則

Codex 應將 [.codex/skill-trigger-map.md](/Users/mac-eric/project/book_overview_v1/.codex/skill-trigger-map.md:1) 視為 `.claude/skills/` 的正式觸發對照表。

當使用者提及某些關鍵字、工作動詞或任務意圖時，Codex 應主動比對該表並讀取對應 `SKILL.md`。

觸發規則如下：

1. 先比對意圖，再比對字面關鍵字
2. 若命中多個 skill，先讀主任務 skill，再補讀支援 skill
3. 若 skill 與決策流程都相關，先依 `.claude/pm-rules/decision-tree.md` 判路由，再依 trigger map 讀取 skill
4. 不得把 skill 載入責任推回給使用者的顯式 `/skill-name` 指令

## 0.3 Ticket Skill 觸發規則

`ticket` 是本專案的核心工作系統，不只在顯式輸入 `/ticket` 時使用。

若使用者提及以下任一詞彙或意圖，Codex 應立即確認 `ticket` skill 已載入，並依需要補讀對應規則：

- `ticket`
- `任務`、`工作項目`、`待辦`
- `claim`、`release`、`complete`、`resume`、`handoff`
- `pending`、`in_progress`、`done`
- `狀態`、`進度`、`排程`、`runqueue`
- `wave`
- `AC`、`acceptance criteria`、`驗收條件`
- `checkpoint`
- `plan to ticket`
- `追蹤`、`建立 ticket`、`查 ticket`、`接手任務`、`恢復任務`

若命中上述詞彙或意圖，至少執行以下讀取流程：

1. 確認 `.claude/skills/ticket/SKILL.md` 已載入
2. 若涉及 Ticket 狀態轉換，補讀 `.claude/pm-rules/ticket-lifecycle.md`
3. 若涉及規劃轉 Ticket 或執行中發現，補讀 `.claude/pm-rules/plan-to-ticket-flow.md`
4. 若涉及完成、驗收、階段收尾，補讀 `.claude/pm-rules/completion-checkpoint-rules.md`

不得將 ticket 系統視為一般自然語言待辦清單；凡命中上述情境，預設先走 ticket skill / ticket 規則，再決定後續操作。

## 0.4 Subagent 協作規則

Codex 在此專案中的多代理 / subagent 協作，應優先遵循 `ticket` skill 原文件與其 references，不在 `CODEX.md` 內重寫一套簡化版流程。

- 核心入口：`.claude/skills/ticket/SKILL.md`
- scheduler / 下一張 ticket：`.claude/skills/ticket/references/track-command.md`
- handoff / resume 流程：`.claude/skills/ticket/references/workflow-handoff.md`
- handoff 命令邊界：`.claude/skills/ticket/references/handoff-command.md`
- ticket 生命週期細節：`.claude/skills/ticket/references/ticket-lifecycle-details.md`

若任務涉及 subagent、平行處理、handoff、resume、claim、complete、runqueue、active agent、agent-status，Codex 應先讀上述原文件，再執行協作決策。

---

## 1. 專案身份

**專案名稱**: Readmoo 書庫管理器 (`readmoo-book-extractor`)

**專案目標**: 專為 Readmoo 電子書平台設計的 Chrome 擴充功能，提供書庫資料自動提取、本地化書目管理、搜尋篩選和批量匯出功能。

**專案類型**: Chrome Extension (Manifest V3)

| 項目 | 值 |
|------|------|
| 開發語言 | JavaScript (ES Module) |
| 建置工具 | npm、自訂 `scripts/build.js` |
| 測試框架 | Jest（單元 / 整合 / E2E） |
| 目標平台 | Chrome Web Store / Chromium 瀏覽器 |
| 主要入口 | `package.json`, `manifest.json`, `src/` |

---

## 2. 當前專案狀態

**專案重啟日期**: 2026-03-26

**重要背景**:

- 專案自 2025-09 起暫停約半年，現已重啟。
- 舊的 `docs/todolist.md` 只可作歷史參考，不應直接視為當前實作依據。
- 新工作開始前，應先確認目前程式碼、測試與架構狀態，再決定後續修改。

---

## 3. 常用指令

### 測試

```bash
# 核心測試（實際對應 test:core）
npm test

# 核心測試（單元 + 整合）
npm run test:core

# 單元測試
npm run test:unit

# 整合測試
npm run test:integration

# E2E 測試
npm run test:e2e

# 完整測試
npm run test:comprehensive

# 監視模式
npm run test:watch

# 覆蓋率
npm run test:coverage
```

### 建置

```bash
# 開發版本建置（預設）
npm run build:dev

# 正式版建置
npm run build:prod

# 驗證正式版建置
npm run validate:build:prod

# 清理產物
npm run clean
```

**預設行為**：除非明確要驗證發布版本，所有「build / 建置 / 編譯」預設使用 `npm run build:dev`。

### 品質

```bash
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

---

## 4. 專案特定實作規範

### 錯誤處理

專案採用集中式錯誤處理，核心檔案位於 `src/core/errors/`。

- 禁止 `throw 'error message'`
- 禁止隨意使用 `throw new Error('message')` 作為專案正式錯誤模型
- 優先使用既有錯誤類別、`ErrorCodes` 與相關 helper
- 需要統一回應格式時，使用 `OperationResult`

常見核心檔案：

- `src/core/errors/ErrorCodes.js`
- `src/core/errors/NetworkError.js`
- `src/core/errors/BookValidationError.js`
- `src/core/errors/ErrorHelper.js`
- `src/core/errors/OperationResult.js`

### 架構骨架

主要模組結構如下：

```text
src/
├── background/
├── content/
├── popup/
├── core/
├── extractors/
├── handlers/
├── storage/
├── export/
├── ui/
├── utils/
├── data-management/
├── overview/
├── performance/
└── platform/
```

修改前若不熟悉上下游，先讀 `docs/struct.md` 與 `docs/data-flow-architecture.md`。

---

## 5. 重要文件入口

- `docs/struct.md`：專案結構說明
- `docs/data-flow-architecture.md`：資料流架構與已知陷阱
- `docs/chrome-extension-dev-guide.md`：Chrome Extension 開發規範
- `.claude/references/chrome-extension-quickref.md`：Chrome Extension 速查
- `docs/use-cases.md`：Chrome Extension 用例基線
- `CHANGELOG.md`：版本變更

---

## 6. 遷移邊界

以下內容雖可能出現在 `.claude/` 規則或 skill 中，但在 Codex 內應以「等價意圖」理解，不直接照搬工具語法：

- `AskUserQuestion`、`ToolSearch(...)` 等 Claude 專屬工具規範
- `.claude/rules/**/*.md` 的自動載入 / lazy-load 機制
- Claude plugins、agents、hooks、dispatch 與 PM 流程規則
- 任何依賴 Claude 平台能力才成立的操作說明

如需參考完整歷史入口與原始脈絡，原始入口檔仍為 `CLAUDE.md`；但對 Codex 而言，`.claude/rules/`、`.claude/pm-rules/`、`.claude/skills/` 仍是應主動讀取的正式來源。
