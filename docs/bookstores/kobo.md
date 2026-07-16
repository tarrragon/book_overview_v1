# Kobo 書城資訊

實機勘查目標：Kobo 書庫頁的 DOM 結構、分頁機制與適配器開發基礎。

---

## 基本資訊

| 項目 | 值 |
|------|----|
| 平台名稱 | 樂天 Kobo |
| 全球統一 domain | www.kobo.com |
| 官方網址（台灣） | https://www.kobo.com/tw/zh/ |
| 官方網址（日本） | https://www.kobo.com/jp/ja/ |
| 電子書庫頁（台灣） | https://www.kobo.com/tw/zh/library/books |
| 電子書庫頁（日本） | https://www.kobo.com/jp/ja/library/books |
| 閱讀方式 | Kobo APP / 網頁版閱讀器（readnow.kobo.com） |
| 是否需登入 | **是**（書庫頁強制登入，未登入 redirect 到 `authorize.kobo.com`） |
| 登入方式 | Kobo/Rakuten 帳號、Facebook、Google |
| 帳號體系 | **全球統一帳號**（台灣站帳號可直接登入日本站，書庫內容共用） |
| platformId | `kobo`（全地區共用，不拆分 kobo_jp） |
| 目標版本 | v1.6.0（台灣站適配器）、v1.6.1（多地區路徑擴展） |
| 對應提案 | PROP-001 |

### 多地區統一平台發現（2026-07-16 實測）

v1.6.1 規劃前實測發現 Kobo 已整合為全球統一平台：

| 觀察項 | 結論 |
|--------|------|
| Domain | 台灣站和日本站共用 `www.kobo.com`，僅路徑前綴不同（`/tw/zh/` vs `/jp/ja/`） |
| 帳號 | 台灣帳號可直接登入日本站，無需另外註冊 |
| 書庫 | 兩站顯示完全相同的書庫內容（同一本書、同一閱讀進度） |
| DOM 結構 | CSS class 完全一致（`li.item-wrapper.book`、`section.library-content.book-list` 等） |
| aria-label | 唯一差異：書庫容器的 aria-label 隨語系變化（台灣「書籍」、日本「本」） |
| 地區限制 | 部分書顯示「ご購入いただけません」（無法購買），但已購書目不受影響 |

**結論**：Kobo 台灣站和日本站不需要獨立的 platformId 或獨立適配器。
現有 `kobo` adapter 只需將 `bookContainer` 選擇器從語系依賴（`[aria-label="書籍"]`）改為
語系無關（`section.library-content.book-list`），並在 platform-registry 擴展路徑辨識即可。

---

## 測試目標 URL

URL 路徑格式：`/{region}/{lang}/...`。region/lang 組合隨地區不同，但頁面結構相同。

| 用途 | URL（台灣站範例） | 日本站對應 | 登入需求 |
|------|-------------------|-----------|---------|
| 官方首頁 | https://www.kobo.com/tw/zh | /jp/ja | 否 |
| **書庫頁（主要提取目標）** | https://www.kobo.com/tw/zh/library/books | /jp/ja/library/books | **是** |
| 我的書籍（總覽） | https://www.kobo.com/tw/zh/library | /jp/ja/library | 是 |
| 筆記本 | https://www.kobo.com/tw/zh/library/notebooks | /jp/ja/library/notebooks | 是 |
| 收藏系列 | https://www.kobo.com/tw/zh/library/collections | /jp/ja/library/collections | 是 |
| 封存 | https://www.kobo.com/tw/zh/library/archive | /jp/ja/library/archive | 是 |
| 帳戶設定 | https://www.kobo.com/tw/zh/account/settings | /jp/ja/account/settings | 是 |
| 網頁閱讀器 | https://readnow.kobo.com/{book-uuid} | 共用（無地區前綴） | 是 |
| 書籍詳情 | https://www.kobo.com/tw/zh/ebook/{slug} | /jp/ja/ebook/{slug} | 否 |

---

## 登入流程

### 認證機制

Kobo 使用**同域 Cookie** 認證：

1. 訪問書庫頁 `www.kobo.com/tw/zh/library/books`
2. 未登入時 redirect 到 `authorize.kobo.com` 登入頁
3. 登入後 redirect 回原始頁面，Cookie 在 `www.kobo.com` 域名下

### 登入狀態偵測

| 偵測方式 | 說明 |
|---------|------|
| URL redirect | 未登入訪問書庫頁會 redirect 到 `authorize.kobo.com` |
| DOM 存在性 | 登入後書庫頁有 `li.item-wrapper.book` 書目卡片 |
| 帳戶選單 | 登入後頁面有「我的帳戶」按鈕 |

---

## Content Script 注入點

Extension `manifest.json` 需新增的 `content_scripts.matches`：

```json
"matches": [
  "*://*.kobo.com/*"
]
```

| URL | 是否注入 | 用途 |
|-----|---------|------|
| https://www.kobo.com/*/library/books* | 是 | 書庫頁（主要提取目標，涵蓋所有地區路徑） |
| https://authorize.kobo.com/* | 是 | 登入偵測 |

---

## 技術架構

| 項目 | 值 |
|------|----|
| 框架 | **無前端框架**（非 React/Vue/Angular/Next.js），傳統 SSR |
| 頁面類型 | SSR 多頁應用（書庫資料直接嵌在 HTML 中） |
| 資料來源 | **DOM 解析**（無 XHR/fetch API 取書目） |
| 分頁 | URL 參數 `pageNumber` + `pageSize`（SSR 換頁） |
| Feature flags | LaunchDarkly |
| Analytics | Bing Ads、TikTok Pixel、GTM |

---

## DOM 結構

### 頁面整體結構

```
body
├── banner                                    -- 頂部導航列
│   ├── .kobo-logo                            -- Rakuten Kobo logo
│   ├── nav > ul                              -- 主選單（電子書/有聲書/KOBO PLUS/樂天點數）
│   └── ul                                    -- 帳戶選單（我的書籍/帳戶設定/登出）
├── h1 "書籍"                                  -- 頁面標題
├── region                                    -- 主內容區
│   ├── nav .library-filters                  -- 篩選器
│   │   ├── .filter-chip（所有項目/所有狀態/所有類型）
│   │   └── input[type="search"]              -- 搜尋框
│   ├── nav .sort-filter                      -- 排序 + 每頁筆數 + 格線/清單切換
│   │   ├── button "新增日期"                   -- 排序下拉
│   │   ├── .pagination-filter-container      -- 每頁筆數（24/36/48/60）
│   │   └── button "格線" / button "清單"       -- 顯示模式
│   ├── section.library-content.book-list       -- 書目列表區（aria-label 隨語系變化：台灣「書籍」/日本「本」）
│   │   ├── table header（標題/作者/系列/狀態/新增日期）
│   │   └── ul > li.item-wrapper.book (repeat) -- 書目卡片
│   └── .page-navigation                      -- 分頁導航（有多頁時）
└── footer
```

### 書目卡片 DOM（`li.item-wrapper.book`）

```
li.item-wrapper.book
└── .item-detail
    ├── .item-image
    │   ├── .cover-image.book-image            -- 封面圖 img
    │   └── .product-type-icon                 -- 類型圖示
    ├── .item-info.main-meta
    │   ├── .title.product-field               -- 書名（含 h2 > a 連結到 /ebook/{slug}）
    │   ├── .item-bar.list-dropdown            -- 「更多行動」下拉
    │   │   └── .library-actions-list（檢視詳細/標記完成/發表評論/下載/移至封存）
    │   ├── .authors.product-field             -- 作者列表
    │   │   └── .contributor-name (repeat)     -- 每個作者（含翻譯者）
    │   ├── a[href*="/series/"]                -- 所屬系列（可能不存在）
    │   └── .genre.product-field               -- 類別（非小說/小說與文學/...）
    ├── .item-bar                              -- 行動列
    │   ├── button.readnow "立即閱讀"           -- readnow.kobo.com/{uuid} 連結
    │   └── .item-status-field                 -- 閱讀狀態（未閱讀/已閱讀 %）
    └── .date-field
        └── "YYYY/M/D"                        -- 新增日期
```

### 選擇器速查

| 欄位 | 選擇器 | 說明 |
|------|--------|------|
| 單本書籍 | `li.item-wrapper.book` | 每本書的根元素 |
| 書名 | `.title.product-field` | 含 a 連結到書籍詳情 |
| 作者 | `.contributor-name` | 可能多個（作者 + 譯者） |
| 封面圖 | `.cover-image.book-image` | img 元素 |
| 類別 | `.genre.product-field` | 非小說/小說與文學 等 |
| 閱讀狀態 | `.item-status-field` | 未閱讀/已閱讀 % |
| 新增日期 | 文字 match `\d{4}/\d{1,2}/\d{1,2}` | 無獨立 class |
| 系列 | `a[href*="/series/"]` | 可能不存在 |
| 書籍 slug | `.title a[href*="/ebook/"]` 的 pathname 末段 | 如 `sg_oH_LrkTyJE1T8KsA29A` |
| readnow UUID | `a[href*="readnow.kobo.com/"]` 的 pathname | 如 `2b4e3f09-eab4-43c5-93a3-d3ca6211a77d` |
| 立即閱讀按鈕 | `button.readnow.library-action` | 連結到 readnow.kobo.com |
| 總筆數 | `.filter-chip` 內 `(N)` 文字 | 解析「所有項目 (40)」的數字 |

### Book ID 策略

Kobo 有兩種識別碼：

| ID 類型 | 來源 | 格式 | 範例 | 穩定性 |
|---------|------|------|------|--------|
| ebook slug（建議主 ID） | `.title a[href*="/ebook/"]` 路徑末段 | Base64-like 字串 | `sg_oH_LrkTyJE1T8KsA29A` | 高（書籍詳情 URL 穩定） |
| readnow UUID | `a[href*="readnow.kobo.com/"]` 路徑 | UUID v4 | `2b4e3f09-eab4-43c5-93a3-d3ca6211a77d` | 高（閱讀器 ID） |

---

## 載入機制

| 項目 | 值 |
|------|----|
| 載入方式 | **SSR 分頁**（URL 參數控制，非 AJAX/SPA） |
| 分頁參數 | `pageNumber=N`（從 1 開始） |
| 每頁筆數 | `pageSize=N`（可選 24/36/48/60） |
| 分頁導航 | `.page-navigation`（頁碼連結 + Next 按鈕） |
| 全部載入策略 | `pageSize=60`（最大），超過 60 本需翻頁 |
| 無更多頁面判定 | `.page-navigation` 消失或不存在 |

### 分頁處理策略

```
頁面 1: /library/books?pageSize=60&pageNumber=1
頁面 2: /library/books?pageSize=60&pageNumber=2
...
停止條件: DOM 中 li.item-wrapper.book 數量 < 60（最後一頁）或 .page-navigation 不存在
```

**總筆數**可從篩選器「所有項目 (N)」的 `(N)` 解析。

---

## 篩選與排序

### 排序選項（URL 參數 `sort`）

| 參數值 | 顯示名稱 |
|--------|---------|
| `DateAddedDesc` | 新增日期 |
| `TitleAsc` | 標題 |
| `AuthorAsc` | 作者 |
| `ReadingStatusAsc` | 狀態 |
| `SeriesAsc` | 系列 |

### 篩選選項

**項目類型**（`filter`）：`All` / `Books`

**狀態**（`state`）：`AllStates` / `Finished` / `InProgress` / `NotStarted`

**類別**（`genreFilterId`）：各類別以 UUID 識別

---

## API 欄位對應

Kobo 為純 DOM 解析，無 API。以下為 DOM 欄位對應 BookSchemaV2：

| DOM 來源 | BookSchemaV2 | 說明 |
|----------|-------------|------|
| `.title a` href 的 ebook slug | bookId | 書籍唯一識別碼 |
| `.title.product-field` 文字 | title | 書名 |
| `.contributor-name` 文字 | author | 作者（可能多人） |
| `.cover-image.book-image` src | coverUrl | 封面圖片 URL |
| `.genre.product-field` 文字 | genre | 類別 |
| `.item-status-field` 文字 | readStatus | 閱讀狀態 |
| 日期文字 match `\d{4}/\d{1,2}/\d{1,2}` | dateAdded | 新增日期 |
| `a[href*="/series/"]` 文字 | series | 所屬系列 |
| readnow UUID | readNowId | 網頁閱讀器 ID |

---

## 適配器策略建議

1. **純 DOM 解析**：Kobo 書庫是 SSR，書目資料直接嵌在 HTML 中，無 XHR API 可用
2. **分頁策略**：以 `pageSize=60`（最大值）+ `pageNumber` 翻頁，迴圈直到最後一頁
3. **翻頁方式**：SSR 換頁會整頁刷新，建議透過 background service worker 用 fetch 取得後續頁面 HTML 再解析（避免 content script 頁面跳轉）
4. **欄位豐富度**：DOM 提供書名、作者（含譯者）、類別、系列、閱讀狀態、新增日期、封面圖、ebook slug、readnow UUID

---

## 常見 debug 觀察點

### 與 Readmoo/博客來的關鍵差異

| 項目 | Readmoo | 博客來 | Kobo |
|------|---------|--------|------|
| 頁面類型 | Hash-based SPA | jQuery MPA | **SSR MPA** |
| 資料來源 | DOM 解析 | REST API (JSON) | **DOM 解析** |
| 書目載入 | 虛擬 scroll（首批 96） | 分頁按鈕（40/頁） | **SSR 分頁**（URL 參數） |
| 作者欄位 | DOM 無作者 | API 有作者 | **DOM 有作者**（含譯者） |
| Book ID | privacy-{digits} | item (G000034891) | **ebook slug** (Base64-like) |
| 認證 | 同域 Cookie | 跨域 OAuth | **同域 Cookie** |
| 類別資訊 | 無 | type (book/magazine) | **genre**（科幻/非小說等） |
| 系列資訊 | 無 | 無 | **有**（series 連結） |

### 常見錯誤

| 症狀 | 可能原因 |
|------|---------|
| 頁面 redirect 到 authorize.kobo.com | 未登入或 session 過期 |
| 書目數量與篩選器顯示不符 | pageSize 限制未翻頁 |
| 作者含譯者 | `.contributor-name` 包含所有貢獻者，需區分 |
| 系列欄位文字含換行 | DOM 內有多餘空白字元，需 trim + 清理 |
| readnow 連結不存在 | 部分書籍無網頁閱讀器版本 |

---

## 勘查紀錄

### v1.6.0 ANA 勘查項目（台灣站）

- [x] 書庫頁實際 URL 確認（`www.kobo.com/tw/zh/library/books`）
- [x] 書庫頁 DOM 結構（`li.item-wrapper.book` 卡片結構）
- [x] 載入機制（SSR 分頁，`pageNumber` + `pageSize` URL 參數）
- [x] 書目資料欄位（書名/作者/類別/系列/狀態/日期/封面/slug/UUID）
- [x] 是否為 SPA（否，傳統 SSR）
- [x] 是否有 API 端點（否，純 SSR DOM）
- [x] 登入流程與認證機制（同域 Cookie，authorize.kobo.com）
- [x] 分頁翻頁策略確認（pageSize=60 最大，超過需翻頁）
- [ ] 日本站書庫頁 URL 確認（v1.6.1）
- [ ] Session / Cookie 有效期實測

---

**Last Updated**: 2026-07-14
**Version**: 2.0.0 — 完整實機勘查落地：DOM 結構、SSR 分頁機制、選擇器速查、Book ID 策略、三書城差異比較表。
**Version**: 1.0.0 — 初始骨架建立
