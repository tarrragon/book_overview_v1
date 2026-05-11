# Readmoo 書城測試目標

實機驗證 Readmoo 書庫提取功能時的 URL、登入要求與注意事項。

---

## 基本資訊

| 項目 | 值 |
|------|----|
| 官方網址 | https://readmoo.com/ |
| 書庫實際頁 | https://read.readmoo.com/#/library |
| 是否需登入 | **是**（書庫頁強制登入） |
| 登入方式 | Email + 密碼、Google、Facebook、Apple |
| 是否支援匿名 | 首頁 / 商品頁可匿名瀏覽，書庫頁必須登入 |

---

## 測試目標 URL

| 用途 | URL | 登入需求 |
|------|-----|---------|
| 官方首頁（商品瀏覽） | https://readmoo.com/ | 否 |
| **書庫頁（資料提取主目標）** | https://read.readmoo.com/#/library | **是** |
| 閱讀器頁（單書） | https://read.readmoo.com/reader/{book-id} | 是 |
| 帳號設定 | https://member.readmoo.com/ | 是 |

**核心測試 URL**：`https://read.readmoo.com/#/library` — 這是 Chrome Extension 提取書目的目標頁面，**不是** `https://readmoo.com/`（首頁無書庫資料）。

---

## 登入流程

### 手動測試流程

1. chrome-devtools-mcp 啟動 Chrome（pipe + `--isolated`，profile 不持久）
2. 在 Chrome 中導航到 https://read.readmoo.com/#/library
3. 系統會 redirect 到登入頁
4. 手動輸入帳密 / 使用 Google 登入
5. 登入完成後重新導航回書庫頁
6. Extension content script 應自動注入並開始提取書目

### 注意事項

| 項目 | 說明 |
|------|------|
| profile 持久化 | 當前 `.mcp.json` 用 `--isolated`，每次啟動需重登。如需持久 profile 見 SKILL 「持久 profile 設定」 |
| 2FA | Readmoo 帳號可啟用 2FA，測試帳號建議停用以簡化流程 |
| Session 過期 | 長時間閒置會自動登出，重新導航時觸發重登 |
| Google 登入跨域 | 透過 Google OAuth 跳轉，需確保 chrome-devtools-mcp 不會誤關跳轉 tab |

---

## Content Script 注入點

當前 `manifest.json` `content_scripts.matches`：

```json
"matches": [
  "*://*.readmoo.com/*",
  "*://readmoo.com/*"
]
```

涵蓋範圍：

| URL | 是否注入 |
|-----|---------|
| https://readmoo.com/ | 是 |
| https://read.readmoo.com/#/library | 是（`*.readmoo.com` 涵蓋 `read.readmoo.com`） |
| https://member.readmoo.com/ | 是 |

驗證 content script 是否注入：在目標頁開啟後執行 `list_console_messages`，應看到 `📍 頁面檢測: Readmoo 頁面` 等專案特定 log。

---

## 常見 debug 觀察點

### SPA 路由

Readmoo 書庫頁 (`read.readmoo.com`) 是 Hash-based SPA（URL 含 `#/library`）。Content script 需處理：

- 初次載入時注入
- URL hash 變化時偵測（已有 `URL 變更檢測` log 證明此邏輯運作）
- DOM 動態載入完成的等待時機

### 書目資料結構

書庫頁的書目 DOM 結構由 Readmoo SPA 動態渲染，**不**透過 SSR。Content script 必須等待：

1. DOM 主容器出現（建議用 `chrome-devtools__wait_for`）
2. 書目清單渲染完成（觀察 list item 數量穩定）
3. 才開始提取

### API 端點

書庫資料來自 XHR/Fetch（非 SSR HTML）。用 `chrome-devtools__list_network_requests` 觀察：

- URL pattern：`*.readmoo.com/api/*`（具體端點以實際請求為準）
- 注意 Authorization header / Cookie（登入態識別）

### 常見錯誤

| 症狀 | 可能原因 |
|------|---------|
| Content script 注入了但抓不到書目 | DOM 未 ready 就執行，需加 wait_for |
| `unknown` 頁面類型 | URL pattern 未命中 page detector，檢查 hash 路由處理 |
| CORS / Authorization 失敗 | content script 跨 origin 抓 API，需走 background SW 代理 |

---

## 參考來源

- W6-007 chrome-devtools-mcp POC 結論
- W6-008 chrome-devtools-mcp 專案設定落地
- W6-010 chrome-extension-mcp-debug SKILL 通用工作流

---

**Last Updated**: 2026-05-12
**Version**: 1.0.0
