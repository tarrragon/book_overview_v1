# chrome-devtools-mcp 使用指南

> **用途**：本檔說明本專案如何用 chrome-devtools-mcp（已於 `.mcp.json` 註冊）做 Chrome Extension 開發期手動驗證與 installed extension debug。
>
> **定位**：開發期 LLM 驅動瀏覽器工具，**不**取代 Puppeteer 自動化 E2E（詳見 W6-007 POC 結論）。

---

## 設計範圍

| 工作流 | 使用情境 | 啟動模式 |
|--------|---------|---------|
| (a) Unpacked extension 載入驗證 | 看 popup / content script / background.js 行為 | chrome-devtools-mcp 自啟動 Chrome（pipe 模式） |
| (b) Installed extension debug | 看已從 Chrome Web Store 安裝（或 unpacked 已載入）的 extension 在實際使用中 console / network | attach 既有 Chrome（`--browserUrl` 或 `--wsEndpoint`） |

兩種工作流分別應對「開發中」（unpacked 變更頻繁）與「實機驗證」（packed / 已上架）兩種需求。

---

## .mcp.json 設定

專案根的 `.mcp.json` 已預先註冊 chrome-devtools-mcp：

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest",
        "--isolated",
        "--categoryExtensions",
        "--chromeArg=--load-extension=build/development"
      ]
    }
  }
}
```

**參數說明**：

| 參數 | 用途 |
|------|------|
| `--isolated` | 每次啟動使用臨時 user-data-dir，避免污染主 Chrome profile |
| `--categoryExtensions` | 啟用 extension 專屬工具（getExtensions / getExtensionLogs 等） |
| `--chromeArg=--load-extension=build/development` | 啟動時自動載入 unpacked extension（路徑相對於 cwd） |

Claude Code 啟動時會自動拉起此 MCP server；MCP server 收到 tool call 時才會啟動 Chrome。

---

## 工作流 (a)：載入 unpacked extension 看 popup / content script

### 前置

```bash
npm run build:dev    # 產出 build/development/
```

### 在 Claude Code 中

直接請 Claude Code 用 chrome-devtools-mcp 工具操作。例：

> 「用 chrome-devtools-mcp 開啟 chrome-extension://<id>/popup.html，看 console 有沒有錯誤」
> 「載入後導航到 https://read.readmoo.com/#/library，等 content script 注入完成，截圖並讀 console」

Claude Code 可呼叫的工具（categoryExtensions 啟用後可見）：

| 工具 | 用途 |
|------|------|
| `chrome-devtools__navigate` | 導航到 URL（含 `chrome-extension://`） |
| `chrome-devtools__getConsoleMessages` | 讀 console 輸出 |
| `chrome-devtools__getNetworkRequests` | 讀 network 請求 |
| `chrome-devtools__takeScreenshot` | 截圖 |
| `chrome-devtools__snapshot` | 取 DOM accessibility tree |
| `chrome-devtools__getExtensions` | 列出已載入 extension（含 ID、manifest） |
| `chrome-devtools__getExtensionLogs` | 讀指定 extension 的 background / service worker log |

---

## 工作流 (b)：attach 既有 Chrome debug installed extension

### 前置

啟動 Chrome 時開遠端 debug port（**用一般 Chrome 不是 chrome-devtools-mcp 啟動的隔離實例**）：

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=$HOME/Library/Application\ Support/Google/Chrome
```

> **重要**：此 Chrome 實例的 user-data-dir 必須包含已安裝的 extension（可以是從 Chrome Web Store 安裝的版本，或 `chrome://extensions` 載入的 unpacked）。

### 修改 .mcp.json 切到 attach 模式（暫時）

attach 模式必須移除 `--categoryExtensions` 與 `--chromeArg`（兩者僅 pipe 模式支援），改用 `--browserUrl`：

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest",
        "--browserUrl",
        "http://127.0.0.1:9222"
      ]
    }
  }
}
```

重啟 Claude Code 載入新設定。

### 在 Claude Code 中

> 「attach 到 localhost:9222 的 Chrome，導航到 https://read.readmoo.com/#/library，看 extension 注入的 content script 輸出什麼到 console」

可用工具集（attach 模式）：

| 工具 | 是否可用 | 備註 |
|------|---------|------|
| `chrome-devtools__navigate` | ✅ | |
| `chrome-devtools__getConsoleMessages` | ✅ | 可看 page-level console（含 content script log） |
| `chrome-devtools__getNetworkRequests` | ✅ | |
| `chrome-devtools__takeScreenshot` | ✅ | |
| `chrome-devtools__snapshot` | ✅ | |
| `chrome-devtools__getExtensions` | ❌ | **categoryExtensions 不支援 attach 模式** |
| `chrome-devtools__getExtensionLogs` | ❌ | 同上 |

> **限制根因**：官方 CLI help 明示「categoryExtensions: ... currently only supported with a pipe connection. autoConnect, browserUrl, and wsEndpoint are not supported with this feature until 149 will be released.」
>
> **追蹤**：Chrome 149 stable 釋出後 attach 模式應可啟用 extension 工具；本限制由 W6-009（Chrome 149 監測 ticket）追蹤，屆時更新本文件與 `.mcp.json` 預設設定。

### Workaround：attach 模式看 service worker log

雖然 `getExtensionLogs` 在 attach 不可用，仍可用以下方式：

1. 開 `chrome://extensions/`，找到目標 extension，點「service worker」開啟 inspector
2. 在 Claude Code 中：「導航到 chrome://extensions/，看 extension 列表」（用基礎工具讀頁面）
3. 直接讀 service worker DevTools 視窗（人工，非 MCP 自動）

或：

- 用 `chrome-devtools__navigate` 開啟 `chrome-extension://<extension-id>/background.html`（若 extension 有 persistent background page，已不適用 Manifest V3）

Manifest V3 service worker debug 受 attach 模式限制較大，建議：「正在開發中的問題」用工作流 (a) unpacked 載入；「線上安裝版的問題」優先抓 content script / page console，service worker 細節等 Chrome 149。

---

## 與 Puppeteer 自動化 E2E 的邊界

| 工具 | 適用情境 |
|------|---------|
| Puppeteer (`tests/e2e/`) | CI 自動化、迴歸測試、機械可判定 pass/fail |
| chrome-devtools-mcp | 開發期手動驗證、LLM-assisted debug、互動探索 |

不要把 chrome-devtools-mcp 工作流寫入 `tests/e2e/`——MCP server 模式需 LLM 即時下指令，無法在 CI 跑出穩定斷言。

---

## 切換 .mcp.json 設定的建議

由於 pipe 模式與 attach 模式參數互斥，目前的設計選擇：

| 選項 | 做法 | 評估 |
|------|------|------|
| 預設 pipe 模式（目前選擇） | `.mcp.json` 用 unpacked 載入設定 | 適合開發中佔多數時間；attach 需臨時改 |
| 預設 attach 模式 | `.mcp.json` 用 `--browserUrl` | 要求使用者先啟 Chrome；不適合 fresh clone |
| 兩個 server 名稱並存 | `chrome-devtools-pipe` + `chrome-devtools-attach` | 設定複雜，Claude Code 工具命名空間衝突風險 |

選預設 pipe 模式：fresh clone 即用，attach 為進階情境需手改。

---

## 後續演進

| 觸發 | 動作 |
|------|------|
| Chrome 149 stable 釋出 | W6-009 重評：可能改採預設 attach 模式（保留 categoryExtensions） |
| 發現具體 debug 工作流痛點 | 補本文件「常見情境」章節 |
| chrome-devtools-mcp 新增工具 | 對應更新工具表 |

---

**Last Updated**: 2026-05-12
**Source**: W6-007 POC 結論 + W6-008 IMP 設定落地
**Related**: `.mcp.json`、W6-007（POC 結論）、W6-009（Chrome 149 監測）
