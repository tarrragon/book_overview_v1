# 開發環境設置指南

本文件為 Readmoo 書庫管理器 Chrome Extension 專案的**開發環境設置 SOP**，涵蓋 Claude Code MCP（Model Context Protocol）servers 安裝與配置。

> **適用對象**：使用 Claude Code 進行本專案開發的開發者（含新加入成員 clone 後初始化、長期暫停後重新加入）。
>
> **與 `environment-recovery-guide.md` 的分工**：本文件處理 Claude Code session 層（MCP servers）；環境恢復指南處理 npm / build artifact 層。兩者皆為新環境必須完成的初始化。

> **安裝指令規範（PC-159）**：本文件所有 npm / pip / brew / uv 等套件安裝指令**必須使用完整 scoped package name**（如 `@scope/pkg-name`）或完整 registry URL，**禁止使用未驗證的短名**。**Why**：npm/PyPI 短名易被 placeholder package 占據，造成「指令通過但載入錯版本」的靜默失敗（W3-050 codegraph 短名實證案例）。**Consequence**：未遵守會導致 fresh shell 安裝後 MCP 載入失敗、deferred tools 不出現，新開發者環境初始化卡關。**Action**：每次新增或修改安裝指令時，在 fresh shell（新 terminal，無既有環境變數加成）執行驗證後才寫入本文件；package name 須附 `npm info <name>` / `pip show <name>` 等 registry 驗證結果於 commit message 或對應 ticket Test Results。

---

## MCP Servers 總覽

本專案配置四個 MCP servers，於 Claude Code session 啟動時自動載入：

| MCP Server | 用途 | 安裝層級 | 配置層級 |
|-----------|------|---------|---------|
| `chrome-devtools` | Chrome Extension 實機測試與 debug | `npx -y`（npm 自動拉取） | 專案 `.mcp.json` |
| `codebase-memory-mcp` | Codebase 知識圖譜、ADR 管理、架構查詢 | user-level binary | 專案 `.mcp.json` |
| `codegraph` | Tree-sitter 解析的符號級程式碼搜尋（callers / callees / impact analysis） | user-level binary（npm global） | 專案 `.mcp.json` |
| `serena` | 語意程式碼操作（symbol-level edit / search） | user-level（uvx） | user-level（`~/.claude.json` 專案 scope） |

**設計原則**：
- **Binary 安裝層級為 user-level**：跨專案共用、避免每個專案重複下載
- **Configuration 層級為專案**：寫入 `.mcp.json`（commit 到 repo），確保新開發者 clone 後 session 啟動即就緒，無需手動配置
- **例外**：`serena` 因為需要 `--project` 參數綁定特定路徑，目前仍保持 user-level 配置（`~/.claude.json` 內專案 scope mcpServers），未來可評估遷移至 `.mcp.json`

---

## 首次設置流程

### 步驟 1：安裝 MCP server binaries

#### `codebase-memory-mcp`

依官方文件安裝（user-level）。確認 binary 可執行：

```bash
codebase-memory-mcp --version
# 預期輸出：codebase-memory-mcp 0.6.1（或更新版本）
```

若找不到指令，常見安裝路徑：

| 工具 | 安裝指令範例 |
|------|------------|
| 從 release 下載 | 放至 `~/.local/bin/` 並加入 PATH |
| `codebase-memory-mcp install` | 由 binary 自身的 install 子命令處理 agent 註冊 |

#### `codegraph`

透過 npm global 安裝（user-level）：

```bash
npm install -g @astudioplus/codegraph-mcp
codegraph --version
```

#### `chrome-devtools`

無需預先安裝，`.mcp.json` 內以 `npx -y chrome-devtools-mcp@latest` 自動拉取最新版。

#### `serena`

透過 `uvx`（uv 工具執行器）執行，無需預先安裝。確認 `uv` 已安裝：

```bash
uv --version
# 若未安裝：brew install uv 或 pipx install uv
```

### 步驟 2：驗證 Claude Code session 載入

在本專案根目錄啟動 Claude Code session，session 啟動時 system-reminder 應列出以下 deferred tools 名稱：

| MCP | 預期 deferred tool 前綴 |
|-----|----------------------|
| chrome-devtools | `mcp__chrome-devtools__*` |
| codebase-memory-mcp | `mcp__codebase-memory-mcp__*` |
| codegraph | `mcp__codegraph__*` |
| serena | `mcp__plugin_serena_serena__*` |

四個前綴全部出現代表 session 載入成功。

### 步驟 3：初始化 codegraph 索引（按需執行）

首次使用 `codegraph` 在本專案查詢符號前，需先建立索引（耗時依 codebase 規模而定，本專案約數十秒）：

```bash
cd /path/to/book_overview_v1
codegraph init
codegraph index
codegraph status  # 確認 nodes / edges 統計
```

完成後 `.codegraph/` 目錄會出現在專案根目錄（已加入 `.gitignore`，不會 commit）。

之後檔案變動由 codegraph MCP 內建 file watcher 自動同步（debounce 約 500ms）。

### 步驟 4：初始化 codebase-memory-mcp 索引（按需執行）

首次使用 cbm 在本專案查詢架構或符號前，由 Claude Code 觸發 `index_repository` 工具（無需 CLI 操作）：

在 Claude Code session 內請求：
> 「對本專案執行 codebase-memory-mcp 的 index_repository」

cbm 會建立 codebase 知識圖譜（含 nodes/edges 統計）。完成後可用 `list_projects` / `index_status` 確認狀態。

---

## 驗證指引

### 驗證 codegraph 載入與索引就緒

```bash
codegraph status
# 預期輸出：含 nodes / edges 數字統計與 .codegraph/ 路徑
```

在 Claude Code session 內測試：
> 「用 codegraph 查詢符號 `BookRepository`」

預期回傳：符號定義位置 + 簽名 + 相關 callers/callees。

### 驗證 codebase-memory-mcp 載入與索引就緒

在 Claude Code session 內測試：
> 「列出 cbm 已索引的 projects」

預期回傳：含 `Users-mac-eric-project-book_overview_v1`（或對應路徑名稱）的條目，含 nodes/edges 統計。

### 驗證 chrome-devtools 載入

在 Claude Code session 內測試：
> 「列出 chrome-devtools mcp 的 list_pages 結果」

預期回傳：當前 Chrome 開啟的分頁列表（或空陣列若未啟動 Chrome）。

### 驗證 serena 載入

在 Claude Code session 內測試：
> 「用 serena 查詢本專案有哪些 memory」

預期回傳：serena 已記錄的 memory 清單。

---

## Troubleshooting

| 症狀 | 可能原因 | 排查方法 | 修復動作 |
|------|---------|---------|---------|
| Session 啟動沒看到某 MCP 的 deferred tools | `.mcp.json` 內 `command` 找不到（PATH 問題） | 在 shell 執行 `which <command>` 確認 binary 可被解析 | 補裝 binary 或調整 PATH；必要時把 `command` 改為絕對路徑 |
| `codegraph_status` 報 `No CodeGraph project is loaded` | session 啟動時 MCP server 沒拿到 workspace root | 確認 `.mcp.json` 內 codegraph 的 args 含 `--path .`（或絕對路徑） | 修正後 reload Claude Code session |
| `codegraph_status` 報 `CodeGraph not initialized` | 專案還沒 `codegraph init` | 執行步驟 3 | 同左 |
| `cbm index_status` 報 `project not found` | cbm 還沒索引本專案 | 執行步驟 4 | 同左 |
| MCP 之間衝突（同名 tool） | 兩個 MCP 暴露同名工具 | 看 session 啟動訊息哪個 MCP 被覆寫 | 重新命名或停用其一 |
| Chrome devtools 工具無法執行 | Chrome 未啟動 / port 不通 | 確認 Chrome 開啟 + remote debugging 已啟用 | 參考 `chrome-extension-dev-guide.md` Chrome 啟動章節 |

---

## 與既有 MCP（serena / chrome-devtools）的並行性

四個 MCP 設計上**無 tool 命名衝突**，可同時載入：

| MCP | 工具命名前綴 | 主要職責 | 與其他 MCP 重疊度 |
|-----|------------|---------|----------------|
| chrome-devtools | `mcp__chrome-devtools__*` | 瀏覽器自動化 / Chrome Extension debug | 無重疊（瀏覽器層獨佔） |
| serena | `mcp__plugin_serena_serena__*` | LSP 級符號搜尋 / 編輯 | 與 codegraph 在「查找符號」有功能重疊（見下方策略） |
| codegraph | `mcp__codegraph__*` | Tree-sitter 解析的知識圖譜（含 callers/callees/impact） | 與 serena 在「找符號定義」重疊 |
| codebase-memory-mcp | `mcp__codebase-memory-mcp__*` | 架構級查詢 + ADR 管理 + 自訂 trace ingestion | 與 codegraph 在「結構查詢」部分重疊（見下方策略） |

### 三 MCP 工具選擇策略（避免重複 query）

| 任務類型 | 首選 MCP | 理由 |
|---------|---------|------|
| 「X 函式的簽名 / 定義位置」 | codegraph | tree-sitter 直接給簽名 + 位置，一次 call |
| 「X 函式被誰呼叫」 | codegraph (`callers`) | 圖譜原生查詢 |
| 「修改 X 會影響什麼」 | codegraph (`impact`) | 圖譜原生查詢 |
| 「跨檔重新命名符號」 | serena (`rename_symbol`) | LSP 級重構，含 reference 自動更新 |
| 「查特定符號的程式碼內容」 | serena (`find_symbol`) | LSP 給完整符號 body |
| 「探索本專案有哪些 ADR / 架構決策」 | codebase-memory-mcp (`manage_adr`) | cbm 原生 ADR 管理 |
| 「查專案整體架構摘要」 | codebase-memory-mcp (`get_architecture`) | cbm 圖譜 + 文件摘要 |
| 「執行追蹤 / 自訂 ingest」 | codebase-memory-mcp (`ingest_traces`) | cbm 獨有 |

**rule of thumb**：先用 `codegraph_context` 拿整體 entry points（PRIMARY），有特定符號需要編輯再切 serena。架構級長期記憶查 cbm。

---

## 相關文件

| 文件 | 內容 |
|------|------|
| `environment-recovery-guide.md` | npm install / build 層的環境恢復（與本文件互補） |
| `chrome-extension-dev-guide.md` | Chrome Extension 開發限制與 chrome-devtools 使用情境 |
| `CLAUDE.md §1 啟用的 MCP/Plugin` | MCP 啟用清單（精簡版） |
| `.mcp.json` | 專案層級 MCP 配置（本文件描述的權威來源） |

---

**Last Updated**: 2026-05-25
**Version**: 1.0.0 — 建立 MCP 配置與安裝指南，含三 MCP 工具選擇策略（Source: `0.19.0-W6-001.1`）
