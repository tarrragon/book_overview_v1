# BookWalker 書城資訊

實機勘查目標：BookWalker 書庫頁的 DOM 結構、載入機制與適配器開發基礎。

---

## 基本資訊

| 項目 | 值 |
|------|----|
| 平台名稱 | BookWalker（台灣/日本為獨立書城） |
| 官方網址（台灣） | https://www.bookwalker.com.tw/ |
| 官方網址（日本） | https://bookwalker.jp/ |
| 電子書庫頁（台灣） | https://www.bookwalker.com.tw/bookcase/available_book_list |
| 電子書庫頁（日本） | 待實機確認（域名為 `bookwalker.jp`） |
| 閱讀方式 | BookWalker APP / 網頁版閱讀器 |
| 是否需登入 | 是 |
| 登入方式 | BookWalker 帳號、其他 SSO 待確認 |
| 帳號隔離 | 台日帳號不同步，視為獨立書城 |
| 目標版本 | v1.7.0（台灣站）、v1.7.1（日本站） |
| 對應提案 | PROP-001 |
| 特殊注意 | 輕小說/漫畫為主，資料欄位可能含卷數/系列 |

---

## 待勘查項目（v1.7.0 ANA）

- [x] 台灣站 vs 日本站是否需分開處理（是，帳號不同步，視為獨立書城）
- [x] 書庫頁實際 URL 確認（台灣站：`bookwalker.com.tw/bookcase/available_book_list`）
- [ ] 日本站書庫頁 URL 確認
- [ ] 書庫頁 DOM 結構
- [ ] 載入機制
- [ ] 書目資料欄位（含系列/卷數等漫畫特有欄位）
- [ ] SPA 框架辨識
- [ ] Session 機制

---

## DOM 結構（待實機取證）

待 v1.7.0 ANA 勘查後填入。
