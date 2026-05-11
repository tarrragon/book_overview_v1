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

## MCP E2E 驗證 Checklist

**用途**：每次 build 後或重大變更後依序執行，確認核心 happy path 可運作。本 checklist 來自 W6-010 SKILL 實機落地經驗（W6-011/W6-012），未來新增書城時可複製改寫。

### 前置

| 步驟 | 命令 / 操作 | 預期 |
|------|------------|------|
| 1. Build dev | `npm run build:dev` | `build/development/manifest.json` 版本符合當前 `package.json` |
| 2. 確認 chrome-devtools-mcp 可用 | session 啟動時 system reminder 應列 `mcp__chrome-devtools__*` deferred tools | 工具清單可見 |
| 3. 清掉舊 Chrome（如有殘留卡死狀態） | `ps aux \| grep "puppeteer_dev_chrome_profile"`，必要時 `kill <PID>` | MCP 自動 respawn 新 Chrome |

### Step 1：安裝 unpacked extension

```
mcp__chrome-devtools__install_extension(path="/絕對路徑/build/development")
mcp__chrome-devtools__list_extensions()
```

**驗證**：Extension Enabled，version 與 manifest.json 一致，Service Worker URL 出現。

### Step 2：導航到登入流程

```
mcp__chrome-devtools__navigate_page(type="url", url="https://read.readmoo.com/#/library")
```

預期：自動 redirect 到 SSO 登入頁。

**人工步驟**：在 Chrome 視窗手動完成 Google / Email 登入，等系統 redirect 回 `read.readmoo.com/#/library`。

### Step 3：觸發瀑布流載入全部可見書目

書庫頁混合「更多...」按鈕 + lazy scroll。用以下 evaluate_script 自動跑：

```javascript
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const countBooks = () => document.querySelectorAll('a[href*="/api/reader/"]').length;
  const findMore = () => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '更多...');
  const log = [{ iter: 0, count: countBooks() }];
  for (let i = 1; i <= 30; i++) {
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(800);
    const btn = findMore();
    if (btn) { btn.scrollIntoView({ block: 'center' }); await sleep(100); btn.click(); await sleep(800); }
    const cur = countBooks();
    log.push({ iter: i, count: cur });
    if (i >= 3 && log[i].count === log[i-1].count && log[i].count === log[i-2].count) break;
  }
  return { finalCount: countBooks(), history: log.slice(-5) };
}
```

**驗證**：`finalCount` 等於 header 中「擁有 N 本書」減封存減借出（即「可見書目」），歷史 plateau 確認載入完成。

### Step 4：用 Popup 觸發提取

```
mcp__chrome-devtools__trigger_extension_action(id="<extension-id>")
mcp__chrome-devtools__list_pages()   # 確認 popup.html 出現
mcp__chrome-devtools__select_page(pageId=<popup-page-id>)
mcp__chrome-devtools__take_snapshot()
mcp__chrome-devtools__click(uid="<開始提取 button uid>")
```

**驗證**：library page console 出現 `[DIAG] performActualExtraction 收到資料`。

### Step 5：驗證 Storage 有完整資料

```
mcp__chrome-devtools__evaluate_script(
  serviceWorkerId="<sw-id>",
  function=`async () => {
    const data = await chrome.storage.local.get(['readmoo_books']);
    return {
      books_count: data.readmoo_books?.books?.length || 0,
      extractionTimestamp: data.readmoo_books?.extractionTimestamp,
      sample: data.readmoo_books?.books?.slice(0, 3).map(b => ({ title: b.title, id: b.id }))
    };
  }`
)
```

**驗證**：`books_count` 對齊 Step 3 的 `finalCount`，sample 含真實書名。

### Step 6：切換 overview.html 驗證顯示

```
mcp__chrome-devtools__navigate_page(type="url", url="chrome-extension://<id>/overview.html")
mcp__chrome-devtools__take_snapshot()
```

**驗證**：「總書籍數」顯示與 Step 5 一致（**W6-012.1 修復前此步會失敗，顯示 0**）。

### Step 7：CSV 匯出（等 W6-012.1 修復後可測）

```
mcp__chrome-devtools__click(uid="<匯出 CSV button uid>")
```

**驗證**：下載目錄出現 CSV 檔，欄位含書名 / id / 進度 / 狀態，列數對齊 Step 5。

### Common pitfalls

| 症狀 | 處置 |
|------|------|
| MCP 工具回 `selected page closed` 且不可恢復 | `kill <Chrome PID>` 後 MCP 自動 respawn；或重啟 Claude Code session |
| evaluate_script 在 library page 失敗（`chrome.* undefined`） | 該 API 不在 main world，改 `serviceWorkerId` 在 SW 跑 |
| `getExtensions` 工具不可用 | `.mcp.json` 缺 `--categoryExtensions`，或在 attach 模式（Chrome 149 前限制） |
| Content script log 全是 `[object Object]` | W6-012.3 logger 修復前已知現象 |

---

## 參考來源

- W6-007 chrome-devtools-mcp POC 結論
- W6-008 chrome-devtools-mcp 專案設定落地
- W6-010 chrome-extension-mcp-debug SKILL 通用工作流
- W6-011 docs/bookstores/ reference 架構建立
- W6-012 父 ticket 收斂實機驗證後續

---

**Last Updated**: 2026-05-12
**Version**: 1.1.0 — 新增「MCP E2E 驗證 Checklist」7 步驟章節（W6-012.4）
