# CLAUDE.md

本文件為 Claude Code 在此專案中的開發指導規範。

---

## 0. Behavioral Core Principle

This Claude framework passes information through the ticket system. The reader of any
output or conversation is not necessarily a human — it is often the next session or
another agent. Therefore:

- Do not apologize, praise, encourage, or re-confirm information that is already known.
- When writing code or documentation, do not make assumptions beyond the task at hand.
- If something needs further analysis or adjustment, open a ticket and hand it to the
  next session or agent instead of expanding the current scope.
- Avoid reasoning or complexity that exceeds what the ticket requires.

---

## 1. 專案身份

**專案名稱**: Readmoo 書庫管理器 (readmoo-book-extractor)

**專案目標**: 專為 Readmoo 電子書平台設計的 Chrome 擴充功能，提供書庫資料自動提取、本地化書目管理、搜尋篩選和批量匯出功能

**專案類型**: Chrome Extension (Manifest V3)

| 項目 | 值 |
|------|------|
| 開發語言 | JavaScript (ES Module) |
| 編譯工具 | npm, Babel, 自訂 build.js |
| 測試框架 | Jest (單元/整合), Puppeteer (E2E) |
| 目標平台 | Chrome Web Store / Chromium 瀏覽器 |
| 專案識別 | `package.json`, `manifest.json`, `src/` 目錄 |

**啟用的 MCP/Plugin**:

- chrome-devtools - Chrome Extension 實機測試與 debug（專案層級 .mcp.json）
- codebase-memory-mcp - Codebase 知識圖譜 + ADR 管理 + 架構查詢（專案層級 .mcp.json）
- codegraph - Tree-sitter 解析的符號級程式碼搜尋與圖譜（專案層級 .mcp.json）
- serena - 語意程式碼操作 / LSP 級重構（user-level 配置）
- context7 - 文件查詢

> 安裝與驗證流程：`docs/development-setup.md`；三 MCP 工具選擇策略亦在該文件。

---

## 1.1 PM 強制原則（首要提醒）

> **列選項必用 AskUserQuestion**：PM 回覆中任何多選、二元確認或等待用戶決策的場景，必須使用 AskUserQuestion 工具（先 `ToolSearch("select:AskUserQuestion")` 載入 schema），禁止 Markdown 列表、純文字問句或「替用戶選擇」。
> 來源：`.claude/pm-rules/askuserquestion-rules.md`（規則 1、3）+ `.claude/error-patterns/process-compliance/PC-064-pm-text-options-without-askuserquestion.md`

---

## 2. 核心價值

@.claude/rules/core/quality-baseline.md

---

## 3. 規則系統

@.claude/rules/README.md

---

## 4. 語言特定規範

**語言**：JavaScript (ES Module)。**實作代理人**：thyme-extension-engineer（Chrome Extension 開發）。

---

## 4.1 專案重啟狀態 (2026-03-26)

**背景**：專案自 2025-09 暫停約半年後重啟。既有 `docs/todolist.md` 規格不完整，僅供歷史參考，不作當前開發依據——需重新評估現況（測試狀態、架構健康度）後製作新 ticket。

**環境恢復**：長期暫停後重啟（或新 clone repo）必須依 [`docs/environment-recovery-guide.md`](docs/environment-recovery-guide.md) 執行恢復。標準三步驟：`npm install --legacy-peer-deps` → `npm run build:dev` → `npm audit`；四層環境問題排查表、vulnerability / build warning 處理流程亦在該指南。

---

## 5. 開發指令

### 測試指令

| 指令 | 用途 |
|------|------|
| `npm test` | 核心測試（單元 + 整合） |
| `npm run test:unit` / `npm run test:integration` | 單元 / 整合測試 |
| `npm run test:watch` | 監視模式 |
| `npm run test:coverage` | 覆蓋率報告 |
| `npm run test:comprehensive` | 所有測試（含 E2E） |
| `npm run test:cross-project` | V1↔APP 跨端 round-trip 驗證 |
| `npm run fixture:v1-canonical` | 生成 V1 canonical v3 fixture（供 APP 消費） |
| `npm run verify:cross-project` | 完整跨端驗證流程（生成 fixture + 測試） |
| `npm run test:hooks` | `.claude/hooks/` Python 測試 |

**Hook 測試說明**：`npm run test:hooks` 透過 `uv run --project .claude/hooks pytest tests/` 執行 `.claude/hooks/tests/`。dev deps（pytest, pyyaml）統一由 `.claude/hooks/pyproject.toml` 宣告，避免 UV ephemeral env 不拉 transitive deps 的 PC-124 模式。

### 建置指令

| 指令 | 用途 |
|------|------|
| `npm install` | 安裝依賴項 |
| `npm run build:dev` | 開發版本建置（預設，保留 log 輸出） |
| `npm run build:prod` | 生產版本建置（正式發布用，移除 log 輸出） |
| `npm run validate:build:prod` | 驗證生產建置 |
| `npm run clean` | 清理建置產物 |

**預設行為**：除非明確要做正式發布版（送 Chrome Web Store），所有「編譯」「建置」「build」指令一律使用 `npm run build:dev`。生產版（`build:prod`）移除 log 輸出，開發版保留。

### 程式碼品質指令

| 指令 | 用途 |
|------|------|
| `npm run lint` / `npm run lint:fix` | ESLint 分析 / 自動修復 |
| `npm run format` / `npm run format:check` | Prettier 格式化 / 檢查 |

### Commit 把關（pre-commit hook + CI lint）

**核心原則**：日常 commit 一律走 pre-commit hook（本機第一道防線），勿用 `--no-verify`；hook 阻擋時先 `npm run lint:fix` 再 manual 修正，確認 `npm run lint` 全綠後再 commit。CI lint job（`.github/workflows/lint.yml`）是第二道安全網，攔截繞過本機 hook 後流入的違規。

> **完整規則**：husky + lint-staged 行為速查、`--max-warnings=0` 設計理由、`--no-verify` 豁免對照表、CI workflow 配置與 required status check 設定見 `docs/development-setup.md`「Pre-commit Hook（husky + lint-staged）」與「CI Lint（GitHub Actions）」章節。

---

## 6. 專案特定規範

> **載入時機**：寫產品程式碼（`src/`）前必 Read `docs/project-conventions.md`。內容為本專案特有的錯誤處理體系（ErrorCodes / OperationResult）、Messages 系統規範（GlobalMessages 納入標準 / 命名前綴）與架構骨架。改純路徑引用（非 `@` 自動載入）以省每回合 token，因其僅在寫 src 時需要。

### 6.1 常數與設計系統

| 路徑 | 用途 |
|------|------|
| `src/core/design-system/` | 通用 UI token（COLORS / SPACING / FONT_SIZES / SHADOWS） |
| `src/popup/constants/ui-text.js` | Popup UI 文字常數（按功能分類：status / extraction / import / diagnostic / navigation） |
| `src/popup/constants/layout.js` | Popup 佈局與時序常數（POPUP_DIMENSIONS / STATUS_CONFIG / HANDSHAKE_CONFIG） |
| `src/popup/components/ui-factory.js` | Popup UI 元件工廠（無狀態純函式 createButton / createCard / createStatusIndicator / createProgressSection / createResultsSection / createErrorSection；class 名稱對齊 popup.html `<style>`，不新增 CSS） |

新增 popup 文字或佈局常數時，寫入對應的 constants 檔案，禁止在 JS/HTML 中硬編碼。通用 spacing/typography 使用 design-system token。新增 popup UI 元件時優先以 `ui-factory.js` 工廠函式動態建立，避免在 popup.html 硬編碼結構。

---

## 7. 專案文件

| 分類 | 文件 | 用途 |
|------|------|------|
| 任務追蹤 | `docs/todolist.md` / `docs/work-logs/` / `CHANGELOG.md` | 任務追蹤 / 版本工作日誌 / 變更記錄 |
| 規格 | `docs/use-cases.md` | Chrome Extension 用例規格（v1.0 基線，7 個 UC） |
| 規格 | `docs/data-flow-architecture.md` | 資料流架構與已知陷阱（必讀） |
| 規格 | `docs/struct.md` / `docs/README.md` / `docs/proposals-tracking.yaml` | 專案結構 / 文件導引 / 提案追蹤索引 |
| 規格（Flutter v2.0+） | `docs/app-requirements-spec.md` / `docs/app-use-cases.md` / `docs/app-error-handling-design.md` | APP 版需求規格 / 用例 / 錯誤處理設計 |
| 書城設定 | `docs/bookstores/readmoo.md` | Readmoo 提取 URL（`read.readmoo.com/#/library`）、SPA 路由、登入流程、DOM 結構（必讀） |

### Chrome Extension 開發規範（必讀）

完整規範：`docs/chrome-extension-dev-guide.md`；速查表見下方。

@.claude/references/chrome-extension-quickref.md

---

## 8. 里程碑

| 版本 | 內容 | 狀態 |
|------|------|------|
| v0.0.x ~ v0.16.x | 基礎架構、測試框架、ESLint 品質、Logger 重構、專案重啟、同步機制、文件系統 | 已完成 v0.16.3 |
| v0.17.x | Tag-based Book Model 重構（PROP-007，含 Schema/Storage/匯出/搜尋適配） | — |
| v0.18.x | 測試重寫與品質恢復（對齊新 model，失敗測試歸零） | — |
| v0.19.x | 端到端驗證、打包、內測準備與流程規格化（實機測試 + 可分發打包 + 安裝指南 + E2E 契約規格） | — |
| v0.20.x | 中文圖書分類法 + Tag 管理功能 | — |
| v1.0.0 | 內測版本（可打包分發，Readmoo 提取 + 匯出入 + 跨裝置同步正常） | — |
| v2.0.0 | 多書城支援（博客來/Kindle/Kobo）+ Chrome Web Store 上架 | — |

---

*專案入口文件 - 詳細規則請參考 .claude/rules/ 目錄*
