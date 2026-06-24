# Audible 有聲書書城資訊

實機勘查目標：Audible 書庫頁的 DOM 結構、載入機制與適配器開發基礎。

---

## 基本資訊

| 項目 | 值 |
|------|----|
| 平台名稱 | Audible（有聲書） |
| 官方網址 | https://www.audible.com/ |
| 電子書庫頁 | https://www.audible.com/library/titles （待實機確認） |
| 閱讀方式 | Audible APP / 網頁版播放器 |
| 是否需登入 | 是（Amazon 帳號） |
| 登入方式 | Amazon 帳號（與 Kindle 共用） |
| 目標版本 | v1.11.0 |
| 對應提案 | PROP-001 |
| 特殊注意 | 有聲書資料欄位與電子書不同（narrator、時長、章節數） |

---

## 待勘查項目（v1.11.0 ANA）

- [ ] 書庫頁實際 URL 確認
- [ ] 書庫頁 DOM 結構
- [ ] 載入機制
- [ ] 有聲書特有資料欄位（narrator、duration、chapters）
- [ ] 與 Kindle 帳號整合程度
- [ ] Book Model 擴充需求評估（有聲書 vs 電子書欄位差異）

---

## DOM 結構（待實機取證）

待 v1.11.0 ANA 勘查後填入。
