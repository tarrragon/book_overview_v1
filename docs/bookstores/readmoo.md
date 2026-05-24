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

驗證 content script 是否注入：在目標頁開啟後執行 `list_console_messages`，應看到含關鍵字 `頁面檢測: Readmoo 頁面` 的 log（extension 實際輸出含位置圖示 emoji 開頭，但比對時可只看關鍵字）。

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

**書籍容器 DOM 結構**（每本書一個 `.library-item`）：

```
.library-item
├── .cover-outer
│   ├── .cover-container
│   │   └── .cover
│   │       └── a.reader-link[href="https://readmoo.com/api/reader/{dummy}"]   ← SPA 佔位 URL
│   │           └── img.cover-img[src="https://cdn.readmoo.com/cover/.../{filename}_210x315.jpg"]
│   └── .desktop-overlay
│       └── .openbook-overlay
│           └── div.privacy[id="privacy-{8位數字}"]                              ← 真實 book ID
└── .info
    └── .title
```

### Book ID 來源優先級（必讀）

| 優先級 | 來源 | 格式 | 穩定性 | 備註 |
|--------|------|------|--------|------|
| 1（首選） | `div.privacy#privacy-{digits}` 的 ID | `reader-{8位數字}` | 高 | Readmoo 內部穩定 book ID，與 reader URL 一一對應 |
| 2 | cover filename 前綴 | `cover-{slug}` | 低 | 封面 CDN 路徑改版會破壞 |
| 3 | 標題 hash | `title-{slug}` | 中 | 易受版本後綴（「【二版】」「（增訂版）」）影響 |
| 4（fallback） | 隨機 hash | `fallback-{hash}` | 不穩定 | 最後手段 |

**關鍵觀察**：

- `a.reader-link[href]` 在 SPA 載入時是**佔位 URL**（所有書共用同一 `/api/reader/210017268000101`），**不可作為 book ID 來源**。
- `div.privacy#privacy-{digits}` 是 Readmoo 在 DOM 暴露的真實 book ID 來源，雖位於 `openbook-overlay`（hover 後顯示的浮層）內部但 DOM 始終存在。
- 在 `.library-item` 容器內 `querySelector('[id^="privacy-"]')` 即可取得。
- Parser 應以 privacy ID 重建真實 reader URL：`https://readmoo.com/api/reader/{privacyBookId}`。
- 已知不穩定 cover 值：`openbook`（書庫預設預覽圖，多本書共用）、`undefined`、`placeholder`——需在 cover 策略中過濾。

### ID 演進歷程

本節記錄 `bookData.id` 從 `cover-XXX` 演進到 `reader-{privacyBookId}` 的決策脈絡，協助理解現行策略由來與升級遷移影響。

#### 1. 歷史 ID 策略：cover-XXX

早期實作中 `bookData.id` 預設取自封面 CDN 路徑前綴，格式為 `cover-{coverPathSegment}`。

- 來源：`src/content/adapters/readmoo-adapter.js` 的 `applyIdGenerationStrategiesWithInfo` 舊版本，cover 策略優先於其他來源。
- 假設：封面檔名穩定且每本書唯一，可作 stable identifier。
- 實際缺陷：封面 CDN 路徑會因書封改版被取代；同一本書封更新後 ID 跟著改變，且多本書共用 `openbook` placeholder 導致集體碰撞。

#### 2. 發現問題（W6-012.2 ANA）

用戶實機測試後反映 reader 深連結無法正確跳轉，下游同步 / 匯出功能受阻。W6-012.2 透過 chrome-devtools-mcp 在書庫頁 DOM 取證，確認下列事實：

- `a.reader-link[href]` 在 SPA 初始載入時是佔位 URL（範例：`/api/reader/210017268000101`），所有書共用同一 dummy 值。
- DOM 已存在 96 個 `[id^="privacy-"]` element，與 `.library-item` 1:1 對應，格式為 `privacy-{8位數字}`，即 Readmoo 內部真實 book ID。
- Extension 既有 privacy element 提取邏輯，但 `bookData.id` 主欄位被 cover 策略覆寫，真實 ID 僅落於 `identifiers.privacyBookId` 副欄位。
- 真根因：ID 策略順序錯誤（cover → title → reader-link），cover 永遠優先取得且 reader-link 為 dummy。

#### 3. 修復方案：reader-{privacyBookId}（W6-012.2.1，commit `d061f661`）

W6-012.2.1 調整 `bookData.id` 生成策略：

- 順序改為 reader-link > cover > title > fallback。
- 從 `div.privacy[id^="privacy-"]` 解析 privacyBookId 作為 reader-link 來源，產出 `reader-{8位數字}`。
- cover 策略加入 known-unstable 過濾（`openbook` / `undefined` / `placeholder` / `default`），避免集體碰撞。
- 修復後 `bookData.id` 與 Readmoo 內部 book ID 一一對應，可直接重建真實 reader URL `https://readmoo.com/api/reader/{privacyBookId}`。

#### 4. 遷移流程（W6-012.2.2 / .2.2.1 / .2.2.2）

為使升級用戶不丟失既有書目與 tag，導入 schema 演進的遷移機制：

- W6-012.2.2.1（commit `f97cae48`）：建立 `MigrationService` class，統一處理 schema_version 演進與備份隔離。
- W6-012.2.2.2（commit `44ed4e5e`）：實作 cover-to-reader migration step，依 5 案例合併規則：
  1. 正常遷移：`identifiers.privacyBookId` 存在 → 直接改寫 `bookData.id` 為 `reader-{privacyBookId}`。
  2. privacyBookId 為空：保留舊 `cover-XXX` ID + 標記 `manual_review`，UI 提示「待重新提取」。
  3. cover-openbook 共用 ID（多本書集體碰撞）：以 secondary key（title + author 等）去重後再遷移。
  4. 同 privacyBookId 多筆：取新並集 tag，合併為單筆。
  5. cross-device sync 衝突（範圍外，由後續 follow-up 處理）。
- 備份隔離 key：`migration_backup_v3_1`；schema_version 由舊版本升至 `3.1.0`。
- 觸發時機：`install-handler.onUpdated` 偵測版本升級時於背景執行，不阻擋 UI 啟動。

#### 5. 用戶可見影響

| 場景 | 升級前行為 | 升級後行為 |
|------|----------|----------|
| 首次啟動（升級後） | — | 背景自動執行遷移，完成後 UI 顯示通知 + 受影響書籍數 |
| `bookData.id` 為 `cover-XXX` 之書籍 | 深連結失效，匯出 id 為 cover-XXX | 多數遷移為 `reader-{privacyBookId}`；無 privacyBookId 者保留舊 ID 並顯示「待重新提取」徽章 |
| cover-openbook 集體碰撞書籍 | 多本書共用同一 ID 導致資料覆寫 | 依 secondary key 拆分為獨立筆數，列入 `legacy_duplicate` 清單建議人工確認 |
| CSV 匯出檔 `id` 欄位 | `cover-XXX` | `reader-XXX`（無 privacyBookId 者沿用舊 ID） |
| 升級前已匯出之 CSV | — | 外部資料無法自動遷移；可用 `identifiers.privacyBookId` 作為 cross-version key 比對 |

### 虛擬 scroll / lazy load

書庫頁採虛擬 scroll：944 本書時 DOM 僅渲染前 96 個 `.library-item`。完整提取需 scroll 觸發 lazy load（透過底部「更多...」按鈕或 scroll-to-end）。提取流程應等待 `.library-item` 數量穩定於目標總數（從「擁有 N 本書，其中封存 X 本，借出 Y 本」文字解析）後才開始。

**實作對照**（截至 v0.18.0）：

| 元件 | 狀態 | 說明 |
|------|------|------|
| `src/content/adapters/readmoo-adapter.js#extractAllBooks` | 缺少 scroll-to-end loop | 僅呼叫 `waitForBookElements()`（任何 > 0 即 resolve），未驗證 count 達 target；首批 96 後直接消費，造成 96/944（約 10%）提取缺口 |
| `src/content/adapters/readmoo-adapter.js#waitForBookElements` | 設計為「等待出現」非「等待完整」 | resolve 條件 `length > 0`（adapter line 282），不等 count 穩定 |
| `src/content/content-modular.js` SPA 路由監聽 | 未串接 | `event-utils.onURLChange` 已備但未調用，路由切換返回 library 時只看到當下 DOM snapshot |
| `docs/bookstores/readmoo.md` §MCP E2E checklist Step 3 演算法 | 規格已書面化，未進入 production code | 僅用於手動 e2e 驗證 |

**修復追蹤**：W6-021 ANA 結論——需 spawn IMP 將 Step 3 演算法落地到 production extraction code（採 `loadAllBooksLazy()` 新 method 保留呼叫者選擇權；loop 結束條件：count == target OR 連續 3 輪無變化 OR 30 輪上限）。

**SPA 路由切換補充**（W6-012.9.4 + W6-021 ANA）：

| 進入方式 | 觀察到的初始 DOM count | 缺 lazy load 的影響 |
|----------|----------------------|---------------------|
| 直接 reload `/library` | 96（首批 render） | 提取 96/944（10%） |
| SPA 路由切換返回（從閱讀器返回書庫） | 96（MutationObserver 命中後 resolve） | 同上 |
| 小書庫帳號（< 96 本） | 全部 render | 無感（首批即完整） |

故「SPA 路由切換 96 命中」**並非路由切換特有缺陷**——而是提取流程普遍缺少 lazy load 處理；reload 路徑同樣受影響，只是 W6-012.9.4 未對照書庫總數所以漏看。

### WAIT_FOR_BOOK_ELEMENTS_TIMEOUT 觸發情境（W6-012.9.4 ANA 結論）

實機驗證四情境後判定常見路徑**不會觸發** finalCount:0 timeout：

| 情境 | 觸發 timeout？ | 證據來源 |
|------|--------------|---------|
| 已登入 baseline reload | 否（~90ms hydration） | W6-012.9.4 實機 |
| SPA 路由切換後返回 library | 否（MutationObserver 命中 96 items） | W6-012.9.4 實機 |
| 未登入訪問 library URL | 否（host 變 `next.readmoo.com`，content script 未注入） | W6-012.9.4 實機 |
| 空書庫帳號（0 books） | 推論觸發（無 .library-item 可命中）| W6-012.9.4 程式碼推論（無測試帳號） |
| 節流網路（Slow 3G） | 未驗證（mcp `emulate` permission denied） | 待後續調查 |

**結論**：方案 D（wait 策略調整）**不值得在 v0.18.0 實施**。W6-012.9.1 logger 級別調整（commit `909865a5`）已涵蓋多數雜訊；finalCount:0 warn 留作真實異常訊號（空書庫推論觸發為唯一已知情境）。

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

**Why absolute path is mandatory（W1-001.1 / W1-005 實證）**：`.mcp.json` 不再預設 `--chromeArg=--load-extension`——相對路徑在 chrome-devtools-mcp npx 啟動環境下不會生效（`list_extensions` 初次回空），絕對路徑寫進 tracked config 又不可移植。`install_extension(path=...)` 動態載入是唯一可靠步驟，且 `path` 必須是絕對路徑（如 `/Users/<user>/Projects/book_overview_v1/build/development`），相對路徑會被拒。

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

**Last Updated**: 2026-05-17
**Version**: 1.2.0 — 新增「ID 演進歷程」章節，記錄 `cover-XXX` → `reader-{privacyBookId}` 決策脈絡與遷移流程（W6-012.2.2.3）
