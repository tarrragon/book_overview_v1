# 博客來電子書 書城資訊

實機勘查目標：博客來電子書書庫頁的 DOM 結構、載入機制與適配器開發基礎。

---

## 基本資訊

| 項目 | 值 |
|------|----|
| 平台名稱 | 博客來電子書 |
| 官方網址 | https://www.books.com.tw/ |
| 電子書庫頁 | https://viewer-ebook.books.com.tw/viewer/index.html?readlist=all |
| 閱讀方式 | 博客來閱讀器 APP / 網頁版閱讀器 |
| 是否需登入 | **是**（書庫頁強制登入，未登入 redirect 到 `cart.books.com.tw/member/login`） |
| 登入方式 | 博客來帳號（Email + 密碼）、uniopen、Facebook、LINE |
| 是否支援匿名 | 官方首頁可匿名瀏覽，書庫頁必須登入 |
| 目標版本 | v1.5.0 |
| 對應提案 | PROP-001 |

---

## 測試目標 URL

| 用途 | URL | 登入需求 |
|------|-----|---------|
| 官方首頁（商品瀏覽） | https://www.books.com.tw/ | 否 |
| **書庫頁（資料提取主目標）** | https://viewer-ebook.books.com.tw/viewer/index.html?readlist=all | **是** |
| 閱讀紀錄 | https://viewer-ebook.books.com.tw/viewer/mybookmark.html | 是 |
| 訂閱管理 | https://viewer-ebook.books.com.tw/viewer/unlimited-read.html | 是 |
| 裝置管理 | https://viewer-ebook.books.com.tw/viewer/device-management.html | 是 |
| 會員登入 | https://cart.books.com.tw/member/login | 否 |

**核心測試 URL**：`https://viewer-ebook.books.com.tw/viewer/index.html?readlist=all` — 這是 Chrome Extension 提取書目的目標頁面。

---

## 登入流程

### 認證機制

博客來電子書庫使用 **跨域 OAuth + Cookie** 機制：

1. 訪問書庫頁 `viewer-ebook.books.com.tw`
2. 未登入時 redirect 到 `cart.books.com.tw/member/login`（含 OAuth 回調 URL）
3. 登入後 `cart.books.com.tw` 發行 session cookie
4. redirect 回 `viewer-ebook.books.com.tw`，Cookie 通過 OAuth flow 傳遞
5. 書庫頁 JS 呼叫 `appapi-ebook.books.com.tw` API 取得書目資料

### 登入方式

| 方式 | 說明 |
|------|------|
| 博客來帳號（Email/密碼） | 主要登入方式 |
| uniopen | 統一集團帳號 |
| Facebook 登入 | OAuth 跳轉 |
| LINE 登入 | OAuth 跳轉 |

### 登入狀態偵測

| 偵測方式 | 說明 |
|---------|------|
| URL redirect | 未登入訪問書庫頁會 redirect 到 `cart.books.com.tw/member/login`，可偵測 `location.hostname` 判斷 |
| DOM 存在性 | 登入後書庫頁有 `.bookshelf__main` 容器；登入頁有 `.login-box` 或類似登入表單 |
| API 回應 | `DeviceReg` API 成功回應表示已認證 |

### 注意事項

| 項目 | 說明 |
|------|------|
| 跨域 Cookie | `viewer-ebook.books.com.tw` 與 `cart.books.com.tw` 為不同子域，Cookie 透過 OAuth flow 傳遞 |
| Session 過期 | 長時間閒置可能需重新登入 |
| Cloudflare Turnstile | 首頁/登入頁有人機驗證；書庫頁登入後無額外反爬 |

---

## Content Script 注入點

Extension `manifest.json` 需新增的 `content_scripts.matches`：

```json
"matches": [
  "*://*.books.com.tw/*",
  "*://viewer-ebook.books.com.tw/*",
  "*://appapi-ebook.books.com.tw/*"
]
```

涵蓋範圍：

| URL | 是否注入 | 用途 |
|-----|---------|------|
| https://viewer-ebook.books.com.tw/viewer/index.html* | 是 | 書庫頁（主要提取目標） |
| https://cart.books.com.tw/member/login* | 是 | 登入偵測（判斷是否已登入） |
| https://www.books.com.tw/* | 選擇性 | 導航按鈕（跳轉到書庫頁） |

---

## 技術架構

| 項目 | 值 |
|------|----|
| 框架 | jQuery 3.7.1（傳統 MPA，非 SPA） |
| 頁面類型 | 多頁應用（書櫃 / 閱讀紀錄 / 訂閱 / 設定 各自獨立頁面） |
| JS 架構 | 模組化 JS 檔案（`shelf/main.js`、`aBook.js`、`aList.js`、`aBookModel.js` 等） |
| 樣式 | 傳統 CSS（`shelf.css`） |
| 反爬機制 | Cloudflare Turnstile（首頁 / 登入頁人機驗證；書庫頁登入後無額外反爬） |
| 瀏覽器限制 | 僅支援 Chrome / Safari（UA 檢測，見 index.html 內 JS） |
| 根容器 | `div.panel`（body 直接子元素） |

---

## DOM 結構

### 頁面整體結構

```
body
└── div.panel
    ├── header[role="banner"]                    -- 頂部導航列
    │   ├── a[href="index.html?readlist=all"]    -- 書櫃 tab
    │   ├── a[href="mybookmark.html"]            -- 閱讀紀錄 tab
    │   ├── a[href="unlimited-read.html"]        -- 訂閱 tab
    │   └── a[href="device-management.html"]     -- 設定 tab
    ├── aside / .columns__left                   -- 側欄分類
    │   ├── form > input[placeholder="書名/作者/出版社"]  -- 搜尋框
    │   ├── ul.book_type_list                    -- 分類列表
    │   │   ├── .aside__link[data-name="all"]    -- 全部
    │   │   ├── .aside__link[data-name="book"]   -- 我的電子書
    │   │   ├── .aside__link[data-name="magazine"]  -- 我的電子雜誌
    │   │   ├── .aside__link[data-name="audiobook"] -- 我的有聲書
    │   │   └── .aside__link[data-name="mediabook"] -- 我的影音．課程
    │   ├── .aside__link[data-name="private"]    -- 密碼書單
    │   └── button "新增書單"                     -- 自訂書單
    └── main.columns__right                      -- 主內容區
        └── .bookshelf.grid
            ├── .bookshelf__buttons              -- 排序/篩選工具列
            ├── .bookshelf__main                 -- 書目容器
            │   └── .bookshelf__book (repeat)    -- 單本書籍
            └── .bookshelf__load-more            -- 載入更多
```

### 書籍卡片 DOM（`.bookshelf__book`）

```
.bookshelf__book
├── .book__cover
│   ├── a > img[src=封面URL, alt=書名]           -- 封面圖
│   ├── .book__progress > div[style="width:67%"] -- 閱讀進度條
│   └── .book__bookmark                          -- 書籤標記
├── .book__description                           -- 詳細資訊（展開時）
│   ├── .book__description__title                -- 書名
│   ├── .book__description__author               -- 作者（格式：作者：{name}）
│   └── .book__description__meta                 -- 元資料
│       └── div
│           ├── div "出版社：{name}"
│           ├── div "格式/大小：{format} / {size}"
│           └── div "適合：{devices}"
├── .book__title                                 -- 書名（卡片底部簡要）
└── .book__footer
    └── .book__controls                          -- 操作按鈕（加入書單/標示完讀/隱藏等）
```

### 選擇器速查

| 欄位 | 選擇器 | 說明 |
|------|--------|------|
| 書籍容器 | `.bookshelf__main` | 所有書籍的父容器 |
| 單本書籍 | `.bookshelf__book` | 每本書的根元素 |
| 書名 | `.book__description__title` | 書名文字（詳細區） |
| 書名（簡） | `.book__title` | 書名文字（卡片底部） |
| 作者 | `.book__description__author` | 格式：`作者：{name}` |
| 封面圖 | `.book__cover img` | `src` 屬性含封面 URL |
| 閱讀進度 | `.book__progress > div` | `style="width:67%"` |
| 載入更多 | `.bookshelf__load-more button` | 分頁載入按鈕 |

### 排序選項（`.bubble[tosort]`）

| 屬性值 | 顯示名稱 |
|--------|---------|
| `ReadTimeDesc` | 最近閱讀 |
| `TimeDesc` / `TimeAsc` | 加入時間（新至舊 / 舊至新） |
| `ProgressDesc` / `ProgressAsc` | 閱讀進度（高至低 / 低至高） |
| `PubDateDesc` / `PubDateAsc` | 出版日期（新至舊 / 舊至新） |
| （無屬性值） | 書名 / 作者 / 出版社 / 檔案大小 |

### 篩選選項（`.bubble[tofilter]`）

| 屬性值 | 顯示名稱 |
|--------|---------|
| `all` | 全部 |
| `trial` | 試閱/試聽 |
| `bought` | 已購買 |
| `finish` | 已完讀 |
| `unfinish` | 尚未完讀 |
| `notInCustom` | 未加入自訂書單 |

---

## 載入機制

| 項目 | 值 |
|------|----|
| 載入方式 | 分頁載入（「看更多」按鈕，非 infinite scroll） |
| 按鈕選擇器 | `.bookshelf__load-more button` |
| 全部載入判定 | `.bookshelf__load-more` 的 `display` 為 `none` |
| API 分頁 | offset-based（`page_size=40`，`total_records` + `current_offset`） |
| 載入指示 | `.bookshelf__load-more img[src*="loading_grey.gif"]` |

---

## API 端點

**API Base**: `appapi-ebook.books.com.tw/V1.7/CMSAPIApp/`

### 端點清單

| API | Method | 用途 |
|-----|--------|------|
| `ReadList` | POST | **主要** — 取得書庫書目列表 |
| `ListMemberReadList` | GET | 會員閱讀清單（含自訂書單） |
| `ListDisplayNumber` | GET | 各分類顯示數量 |
| `classification` | GET | 分類資訊 |
| `DeviceReg` | GET | 裝置註冊（認證狀態確認） |
| `ePlanList` | GET | 訂閱方案列表 |

### ReadList API 請求

**Method**: POST
**URL**: `//appapi-ebook.books.com.tw/V1.7/CMSAPIApp/ReadList`

**Request Body**:

```json
{
  "offset": 0,
  "page_size": 40,
  "sort_order": "ReadTimeDesc",
  "last_updated_time": "1900-01-01T00:00:00+08:00",
  "eplanid": "all",
  "is_buyout": "",
  "listname": "[\"all\",\"trial\"]",
  "cat": "all"
}
```

### ReadList API 回應

**Response Structure**:

```json
{
  "total_records": 1,
  "current_offset": 0,
  "updated_time": "2026-07-13T16:31:02+08:00",
  "records": [{ "book_uni_id": "...", "item_type": "...", "item_info": {...} }]
}
```

### 完整 `item_info` 欄位（49 欄位）

#### 識別與書目資訊

| API 欄位 | 範例值 | 說明 |
|----------|--------|------|
| `item` | `G000034891` | 書籍唯一識別碼 |
| `book_uni_id`（頂層） | `G000034891_reflowable_normal` | 含格式的複合 ID |
| `c_title` | `(數位贈品)蜜蜂與遠雷【獨家試讀本+折價券】` | 書名 |
| `author` | `恩田陸` | 作者 |
| `publisher_id` | `bookland` | 出版社 ID |
| `publisher_name` | `博客來網路書店` | 出版社名稱 |
| `publish_date` | `2018/04/17` | 出版日期 |
| `edition` | `初版` | 版次 |
| `language` | `zh-tw` | 語言代碼 |
| `rank` | `1` | 排名 |
| `type` | `book` | 類型（book / magazine / audiobook） |
| `item_type`（頂層） | `book` | 項目類型 |

#### 閱讀狀態

| API 欄位 | 範例值 | 說明 |
|----------|--------|------|
| `percent` | `67` | 閱讀進度百分比 |
| `start_read_time` | `2025-01-24T16:21:26+08:00` | 開始閱讀時間 |
| `last_read_time` | `2025-01-24T16:48:40+08:00` | 最後閱讀時間 |
| `last_loc` | `epubcfi(/6/18[ch02.xhtml]!/4/2...)` | 最後閱讀位置（EPUB CFI） |
| `finish_flag` | `N` | 完讀旗標（Y/N） |
| `finish_time` | `1900-01-01T00:00:00+08:00` | 完讀時間（未完讀時為預設值） |
| `status` | `UF` | 閱讀狀態 |

#### 檔案與格式

| API 欄位 | 範例值 | 說明 |
|----------|--------|------|
| `size` | `2783371` | 檔案大小（bytes） |
| `display_file_size` | `2.7 MB` | 顯示用檔案大小 |
| `book_format` | `reflowable` | 格式（reflowable / fixed） |
| `page_direction` | `0` | 頁面方向 |
| `is_comics` | `N` | 是否漫畫 |
| `efile_nofixed_name` | `bees02.epub` | EPUB 檔名 |
| `efile_url` | `aws-ebook/tmp/` | 檔案路徑 |
| `cur_version` | `V001.0002` | 當前版本 |
| `version_type` | `1` | 版本類型 |

#### 封面

| API 欄位 | 範例值 | 說明 |
|----------|--------|------|
| `efile_cover_url` | `https://s3public-ebook.books.com.tw/cover/.../G000034891.jpg` | 封面 URL（電子書庫用） |
| `src_cover_url` | `http://addons.books.com.tw/G/G00/1/G000034891.jpg` | 原始封面 URL |

#### 授權與購買

| API 欄位 | 範例值 | 說明 |
|----------|--------|------|
| `auth_time` | `2018-05-11T17:40:09+08:00` | 授權/購買時間 |
| `isbuyout` | `Y` | 是否買斷（Y/N） |
| `buffet_flag` | `N` | 吃到飽旗標 |
| `return_file_num` | `1` | 回傳檔案數 |
| `readlist_idnames` | `["all","book"]` | 所屬書單 |
| `eplanids` | `[]` | 訂閱方案 ID |

#### 功能旗標

| API 欄位 | 範例值 | 說明 |
|----------|--------|------|
| `like_flag` | `Y` | 可收藏 |
| `annotation_flag` | `Y` | 可標註 |
| `bookmark_flag` | `Y` | 可書籤 |
| `note_flag` | `Y` | 可筆記 |
| `public_flag` | `Y` | 可公開 |
| `share_flag` | `Y` | 可分享 |
| `tts_flag` | `N` | 可文字轉語音 |
| `book_highlight_status` | `N` | 有標記 |
| `book_bookmark_status` | `N` | 有書籤 |

#### 版本管理

| API 欄位 | 範例值 | 說明 |
|----------|--------|------|
| `ask_update_version` | `N` | 需要更新版本 |
| `bg_update_version` | `N` | 背景更新版本 |
| `version_locked` | `N` | 版本鎖定 |
| `action` | `update` | 動作類型 |
| `updated_time` | `2025-01-24T16:48:41+08:00` | 更新時間 |

#### DRM 資訊（`drm_info` 子物件）

| API 欄位 | 範例值 | 說明 |
|----------|--------|------|
| `drm_info.read_end_time` | `2099-12-31T23:59:59+08:00` | 閱讀授權到期時間 |
| `drm_info.drm_type` | `2` | DRM 類型 |
| `drm_info.book_uni_id` | `""` | DRM 書籍 ID |
| `drm_info.drm_info` | `""` | DRM 詳細資訊 |
| `drm_info.is_buyout` | `""` | DRM 買斷狀態 |

### API 欄位對應 BookSchemaV2

| API 欄位 | BookSchemaV2 | 說明 |
|----------|-------------|------|
| `item` | bookId | 書籍唯一識別碼（如 `G000034891`） |
| `c_title` | title | 書名 |
| `author` | author | 作者 |
| `publisher_name` | publisher | 出版社 |
| `publish_date` | publishDate | 出版日期（格式 `YYYY/MM/DD`） |
| `efile_cover_url` | coverUrl | 封面圖片 URL |
| `percent` | readProgress | 閱讀進度百分比 |
| `last_read_time` | lastReadAt | 最後閱讀時間（ISO 8601） |
| `auth_time` | purchaseDate | 授權/購買時間（ISO 8601） |
| `book_format` | format | 格式（reflowable / fixed） |
| `language` | language | 語言代碼 |
| `type` | itemType | 類型（book / magazine / audiobook） |
| `isbuyout` | — | 是否買斷（Y/N） |
| `status` | — | 閱讀狀態（UF=未完讀） |
| `finish_flag` | — | 完讀旗標（Y/N） |

---

## 適配器策略建議

1. **優先使用 API 回應**而非 DOM 解析：API 欄位比 DOM 更完整（含出版日期、語言、DRM 資訊等），且結構化 JSON 比 DOM 解析穩定
2. **分頁策略**：POST `ReadList` API，以 `offset` + `page_size` 循環取得全部書目，直到 `current_offset + page_size >= total_records`
3. **DOM fallback**：API 不可用時從 `.bookshelf__book` 解析基本欄位
4. **認證依賴**：API 呼叫依賴 Cookie 認證，content script 在已登入的頁面上下文中發出 XHR 即可攜帶 Cookie

---

## 常見 debug 觀察點

### 與 Readmoo 的關鍵差異

| 項目 | Readmoo | 博客來 |
|------|---------|--------|
| 頁面類型 | Hash-based SPA | 傳統 MPA |
| 資料來源 | DOM 解析（`.library-item`） | **REST API**（JSON 回應） |
| 書目載入 | 虛擬 scroll（首批 96 筆） | 分頁按鈕（每頁 40 筆） |
| 作者欄位 | DOM 無作者（source limitation） | **API 有作者**（`item_info.author`） |
| Book ID | `privacy-{digits}`（DOM 內） | `item`（API 回傳，如 `G000034891`） |
| 認證 | 同域 Cookie | 跨域 OAuth（`cart.books.com.tw` → `viewer-ebook.books.com.tw`） |

### MPA 路由

博客來書庫頁是傳統多頁應用（非 SPA），每個功能頁面獨立：

- 書櫃：`index.html?readlist=all`
- 閱讀紀錄：`mybookmark.html`
- 訂閱：`unlimited-read.html`
- 設定：`device-management.html`

Content script 注入後無需處理 SPA 路由變化或 hash change，頁面載入即可開始工作。

### 常見錯誤

| 症狀 | 可能原因 |
|------|---------|
| 頁面 redirect 到登入頁 | Cookie 過期或未登入，需重新認證 |
| API 回傳空 records | `listname` 參數錯誤或帳號無書目 |
| 封面圖載入失敗 | `efile_cover_url` 的 S3 路徑過期，改用 `src_cover_url` |
| 「看更多」按鈕消失 | 已載入全部書目，`bookshelf__load-more` display: none |

---

## 勘查紀錄

### v1.5.0 ANA 勘查項目

- [x] 書庫頁實際 URL 確認（`viewer-ebook.books.com.tw`）
- [x] 書庫頁 DOM 結構（書目容器、書目項目選擇器）
- [x] 載入機制（分頁按鈕，每頁 40 筆）
- [x] 書目資料欄位（49 欄位完整記錄）
- [x] 是否為 SPA（否，jQuery 3.7.1 MPA）
- [x] 捲動容器定位（`.bookshelf__main`）
- [x] 是否有 API 端點可用（`appapi-ebook.books.com.tw/V1.7/CMSAPIApp/ReadList`）
- [x] 登入流程與認證機制（跨域 OAuth + Cookie）
- [ ] Session / Cookie 有效期實測

---

**Last Updated**: 2026-07-13
**Version**: 2.0.0 — 完整實機勘查落地：補齊測試目標 URL / 登入流程 / Content Script 注入點 / 完整 49 欄位 API 文件 / 頁面結構樹 / debug 觀察點 / Readmoo 差異比較表。
**Version**: 1.0.0 — 初始建立，基本 DOM 結構與 API 回應記錄
