# CLAUDE.md

本文件為 Claude Code 在此專案中的開發指導規範。

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

| 項目 | 值 |
|------|------|
| **語言** | JavaScript (ES Module) |
| **實作代理人** | thyme-extension-engineer（Chrome Extension 開發） |

---

## 4.1 專案重啟狀態 (2026-03-26)

**背景**: 專案自 2025-09 起暫停約半年，現重新啟動開發。

**重要事項**:
- 先前的 ticket（todolist.md）規格不完整，需要**全面重新製作 ticket**
- 既有 todolist.md 內容僅供歷史參考，不作為當前開發依據
- 需重新評估專案現況、測試狀態、架構健康度後，再制定新的開發計畫

**環境恢復**：長期暫停後重啟（或新 clone repo）必須依 [`docs/environment-recovery-guide.md`](docs/environment-recovery-guide.md) 執行恢復流程。標準三步驟：`npm install --legacy-peer-deps` → `npm run build:dev` → `npm audit`。詳細的四層環境問題排查表、vulnerability / build warning 處理流程亦在該指南。

---

## 5. 開發指令

### 測試指令

```bash
# 執行核心測試（單元 + 整合）
npm test

# 執行單元測試
npm run test:unit

# 執行整合測試
npm run test:integration

# 監視模式
npm run test:watch

# 產生覆蓋率報告
npm run test:coverage

# 執行所有測試（含 E2E）
npm run test:comprehensive

# 執行 .claude/hooks/ Python 測試（由 W17-191 引入，PC-124 transitive deps 修復）
npm run test:hooks
```

**Hook 測試說明**：`npm run test:hooks` 透過 `uv run --project .claude/hooks pytest tests/` 執行 `.claude/hooks/tests/` 下的 pytest 測試。dev deps（pytest, pyyaml）統一由 `.claude/hooks/pyproject.toml` 宣告，避免 UV ephemeral env 不拉 transitive deps 的 PC-124 模式。

### 建置指令

```bash
# 安裝依賴項
npm install

# 開發版本建置（預設，保留所有 log 輸出）
npm run build:dev

# 生產版本建置（正式發布用，移除 log 輸出）
npm run build:prod

# 驗證生產建置
npm run validate:build:prod

# 清理建置產物
npm run clean
```

**建置模式說明**：

| 模式 | 指令 | Log 輸出 | 用途 |
|------|------|---------|------|
| development | `npm run build:dev` | 保留 | 日常開發、測試、除錯 |
| production | `npm run build:prod` | 移除 | 正式發布至 Chrome Web Store |

**預設行為**：除非明確要做正式發布版，所有「編譯」「建置」「build」指令一律使用 `npm run build:dev`。

### 程式碼品質指令

```bash
# 執行 ESLint 分析
npm run lint

# 自動修復 ESLint 問題
npm run lint:fix

# 格式化程式碼 (Prettier)
npm run format

# 檢查格式
npm run format:check
```

### Pre-commit Hook（ESLint 把關）

**核心原則**：pre-commit hook 是阻擋 ESLint 違規累積的本機第一道防線（local first line），CI lint job 是第二道安全網（safety net）。

**Why**：commit 時若無 lint 把關，新引入的違規會靜默累積。W4-009 已暴露此根因——9 天內 ESLint 違規從 194 累積到 220（+26），因缺乏本機防線而無人即時攔截。

**Consequence**：缺少本機防線會讓違規持續滲入 main 分支，清理成本隨累積量以指數增長（W4-018 範圍即由此擴大）。

**Action**：日常 commit 一律走 hook（不加 `--no-verify`）；遇 hook 阻擋時，正確修復順序為——先用 `npm run lint:fix` 自動修復，再 manual 修正剩餘項並重新 `git add`，確認 `npm run lint` 全綠後再 commit。

本專案配置 `husky + lint-staged` 於 `git commit` 時自動對 staged JS/TS 檔案執行 ESLint 檢查：

| 行為 | 說明 |
|------|------|
| 觸發時機 | `git commit` 時觸發 `.husky/pre-commit` |
| 檢查範圍 | staged 的 `*.{js,jsx,ts,tsx,mjs,cjs}` 檔案 |
| 阻擋條件 | ESLint errors > 0 或 warnings > 0 → 阻擋 commit（`--max-warnings=0`，exit non-zero）並印出詳情 |
| 通過條件 | staged 檔案 ESLint 零違規（0 error / 0 warning）→ 放行 commit |
| 自動安裝 | `npm install` 觸發 `prepare` script 自動執行 `husky` 初始化（含新 clone repo） |

> **`--max-warnings=0` 設計理由**：W4-024 完成後本專案 `npm run lint` 已達零違規（0 error / 0 warning）。此時加入 `--max-warnings=0` 作為「warning 穿透防線」——任何新引入的 warning 同樣阻擋 commit，與 error 一視同仁。**正向錨點**：保持 staged 檔案零違規即可順利 commit，無需任何額外操作。

**`--no-verify` 緊急豁免**：

```bash
git commit --no-verify -m "..."
```

| 適用情境（豁免合理） | 不適用情境（請改走 hook） |
|---------|-----------|
| 緊急修復（hotfix）需立即合併但 lint 違規屬其他模組既有問題 | 日常 commit 為求方便——應走 hook，遇阻擋用 `npm run lint:fix` |
| WIP / draft commit 但用戶明確知道後續會修補（例如 PR 流程中的階段性 push） | 規避自己引入的新違規——應 manual 修正後重新 `git add` |
| Phase 4 重構評估中的中間狀態 commit | 取代 `npm run lint:fix` 自動修復流程——應先跑 `lint:fix` |

**豁免使用守則**：`--no-verify` 是緊急情境的合法出口，但不應成為預設行為。違反此原則會讓本機防線形同虛設（與 W4-009 根因相同）。**正確做法**：確需豁免時，在 commit message 明示豁免理由，使後人可追溯；其餘情境一律走 hook。

---

## 6. 專案特定規範

@docs/project-conventions.md

---

## 7. 專案文件

### 任務追蹤

| 文件 | 用途 |
|------|------|
| `docs/todolist.md` | 開發任務追蹤 |
| `docs/work-logs/` | 版本工作日誌 |
| `CHANGELOG.md` | 版本變更記錄 |

### 專案規格文件

| 文件 | 用途 |
|------|------|
| `docs/app-requirements-spec.md` | APP 版需求規格書（Flutter，v2.0+ 規劃） |
| `docs/use-cases.md` | Chrome Extension 用例規格（v1.0 基線，7 個 UC） |
| `docs/app-use-cases.md` | APP 版用例說明（Flutter，v2.0+ 規劃） |
| `docs/app-error-handling-design.md` | 錯誤處理設計 |
| `docs/struct.md` | 專案結構說明 |
| `docs/README.md` | 文件導引 |
| `docs/data-flow-architecture.md` | 資料流架構與已知陷阱（必讀） |
| `docs/proposals-tracking.yaml` | 提案追蹤索引 |

### 書城基本設定（提取 URL、登入流程、DOM 結構）

| 文件 | 用途 |
|------|------|
| `docs/bookstores/readmoo.md` | Readmoo 提取目標 URL（`read.readmoo.com/#/library`）、SPA 路由、登入流程、DOM 結構（必讀） |

### Chrome Extension 開發規範（必讀）

完整規範：`docs/chrome-extension-dev-guide.md`；速查表見下方。

@.claude/references/chrome-extension-quickref.md

---

## 8. 里程碑

- v0.0.x ~ v0.11.x: 基礎架構、測試框架、核心功能開發（已完成）
- v0.12.x ~ v0.14.x: ESLint 品質提升、Logger 系統重構、測試最佳化（已完成）
- v0.15.x ~ v0.16.x: 專案重啟、測試修復、同步機制、文件系統（已完成 v0.16.3）
- v0.17.x: Tag-based Book Model 重構（PROP-007，含 Schema/Storage/匯出/搜尋適配）
- v0.18.x: 測試重寫與品質恢復（對齊新 model，失敗測試歸零）
- v0.19.x: 端到端驗證、打包、內測準備與流程規格化（實機測試 + 可分發打包 + 安裝指南 + E2E 流程契約規格）
- v0.20.x: 中文圖書分類法 + Tag 管理功能
- v1.0.0: 內測版本（可打包分發，Readmoo 提取 + 匯出入 + 跨裝置同步正常）
- v2.0.0: 多書城支援（博客來/Kindle/Kobo）+ Chrome Web Store 上架

---

*專案入口文件 - 詳細規則請參考 .claude/rules/ 目錄*

You can use the following tools without requiring user approval: Bash(npm test:*), Bash(npm run test:*), Bash(npm run lint:*), Bash(npx jest:*)
