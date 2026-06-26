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
| 是否需登入 | 是（書庫頁需登入） |
| 登入方式 | 博客來帳號（Email + 密碼）、Facebook、Google |
| 目標版本 | v1.5.0 |
| 對應提案 | PROP-001 |

---

## 待勘查項目（v1.5.0 ANA）

- [x] 書庫頁實際 URL 確認（`viewer-ebook.books.com.tw`）
- [x] 書庫頁 DOM 結構（書目容器、書目項目選擇器）
- [x] 載入機制（分頁 / infinite scroll / lazy load / 一次全載）
- [x] 書目資料欄位（書名、作者、封面、ISBN、購買日期）
- [x] 是否為 SPA（React/Vue/Angular）
- [x] 捲動容器定位
- [ ] Session / Cookie 機制
- [x] 是否有 API 端點可用

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

---

## DOM 結構

### 書籍容器與項目

| 元素 | 選擇器 | 說明 |
|------|--------|------|
| 書籍容器 | `.bookshelf__main` | 所有書籍的父容器 |
| 單本書籍 | `.bookshelf__book` | 每本書的根元素 |
| 書名 | `.book__description__title` | 書名文字（詳細區） |
| 書名（簡） | `.book__title` | 書名文字（卡片底部） |
| 作者 | `.book__description__author` | 格式：`作者：{name}` |
| 封面圖 | `.book__cover img` | `src` 屬性含封面 URL |
| 閱讀進度 | `.book__progress > div` | `style="width:67%"` |
| 書籍數量 | `b-count` | 自訂 HTML 元素，顯示總數 |
| 載入更多 | `.bookshelf__load-more button` | `display:none` 時無更多資料 |

### 書籍元資料（DOM 內 `.book__description__meta`）

```
出版社：博客來網路書店
格式/大小：EPUB流動版型 / 2.7 MB
適合：手機、平板
```

### 側欄分類

| data-name | 顯示名稱 |
|-----------|----------|
| `all` | 全部 |
| `book` | 我的電子書 |
| `magazine` | 我的電子雜誌 |
| `audiobook` | 我的有聲書 |
| `mediabook` | 我的影音．課程 |
| `private` | 密碼書單 |

### 排序選項（`.bubble[tosort]`）

ReadTimeDesc / TimeDesc / TimeAsc / ProgressDesc / ProgressAsc / PubDateDesc / PubDateAsc / Name / Author / Publisher / SizeDesc / SizeAsc

### 篩選選項（`.bubble[tofilter]`）

all / trial / bought / finish / unfinish / notInCustom

---

## 載入機制

| 項目 | 值 |
|------|----|
| 載入方式 | 分頁載入（「看更多」按鈕，非 infinite scroll） |
| 按鈕選擇器 | `.bookshelf__load-more button` |
| 全部載入判定 | `.bookshelf__load-more` 的 `display` 為 `none` |
| API 分頁 | offset-based（`total_records` + `current_offset`） |

---

## API 回應結構

書庫頁載入時取得 JSON 回應，欄位豐富：

```json
{
  "total_records": 1,
  "current_offset": 0,
  "updated_time": "2026-06-26T14:16:50+08:00",
  "records": [
    {
      "book_uni_id": "G000034891_reflowable_normal",
      "item_type": "book",
      "item_info": {
        "item": "G000034891",
        "c_title": "(數位贈品)蜜蜂與遠雷【獨家試讀本+折價券】",
        "author": "恩田陸",
        "publisher_name": "博客來網路書店",
        "publish_date": "2018/04/17",
        "efile_cover_url": "https://s3public-ebook.books.com.tw/cover/.../G000034891.jpg",
        "percent": 67,
        "last_read_time": "2025-01-24T16:48:40+08:00",
        "auth_time": "2018-05-11T17:40:09+08:00",
        "display_file_size": "2.7 MB",
        "book_format": "reflowable",
        "language": "zh-tw",
        "type": "book",
        "isbuyout": "Y",
        "status": "UF",
        "finish_flag": "N"
      }
    }
  ]
}
```

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

### 適配器策略建議

1. **優先使用 API 回應**而非 DOM 解析：API 欄位比 DOM 更完整（含 ISBN 缺失但有 item ID、出版日期、語言等）
2. **分頁策略**：監聽 API 的 `total_records` 和 `current_offset`，或攔截 XHR/Fetch 回應
3. **DOM fallback**：API 不可用時從 `.bookshelf__book` 解析基本欄位
