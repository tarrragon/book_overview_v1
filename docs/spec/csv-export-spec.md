# CSV 匯出欄位規格

**版本**: v1.0
**建立日期**: 2026-05-17
**來源**: 0.18.0-W6-012.6 ANA 結論

---

## 背景與動機

v0.18 Overview CSV 匯出（`src/overview/book-exporter.js`）僅包含 5 欄人類可讀摘要（書名/書城來源/進度/狀態/封面URL），與 `docs/use-cases.md` UC-05/UC-03 定義的 v2.0+ 完整規格（含 tag 欄位、6 種閱讀狀態、identifiers）存在落差。

W6-012.6 ANA 確認此為「設計選擇 + 規格未對齊」共振：5 欄對 spreadsheet 使用情境合理，但阻斷 round-trip 匯入（缺 id）且未涵蓋 tag-based model 欄位。

本文件固化 v0.18 最小集與 v2.0+ 完整集的欄位定義，並規範物件/陣列欄位的 CSV 序列化策略。

---

## v0.18 最小集（8 欄）

W6-012.6.1 補齊後的最小可 round-trip 集：

| # | 欄位名稱 | 型別 | 來源 | 說明 |
|---|---------|------|------|------|
| 1 | id | string | book.id | 唯一識別符，round-trip 必要 |
| 2 | title | string | book.title | 書名 |
| 3 | authors | string[] | book.authors | 作者（序列化見下方） |
| 4 | source | string | book.source | 書城來源（如 "readmoo"） |
| 5 | progress | number | book.progress | 閱讀進度百分比 |
| 6 | readingStatus | string | book.readingStatus | 6 種閱讀狀態之一 |
| 7 | tagIds | string[] | book.tagIds | Tag ID 列表（序列化見下方） |
| 8 | cover | string | book.cover | 封面 URL |

**設計理由**：
- id 為 round-trip 匯入的必要欄位（importer 靠 id 做 dedup）
- authors/tagIds 為 tag-based model 核心欄位
- 保留 source/progress/readingStatus/cover 維持人類可讀性

---

## v2.0+ 完整集

對齊 UC-03 規格與 `book-data-exporter.js` COMPLETE_V2，含所有 book schema 欄位：

| # | 欄位名稱 | 型別 | 說明 |
|---|---------|------|------|
| 1 | id | string | 唯一識別符 |
| 2 | title | string | 書名 |
| 3 | authors | string[] | 作者列表 |
| 4 | source | string | 書城來源 |
| 5 | progress | number | 閱讀進度百分比 |
| 6 | readingStatus | string | 6 種狀態（unread/reading/finished/queued/abandoned/reference） |
| 7 | type | string | 書籍類型 |
| 8 | tagIds | string[] | Tag ID 列表 |
| 9 | cover | string | 封面 URL |
| 10 | isManualStatus | boolean | 是否手動設定狀態 |
| 11 | identifiers | object | 平台識別符（見序列化策略） |
| 12 | progressInfo | object | 詳細進度資訊（見序列化策略） |
| 13 | extractedAt | string | 首次提取時間（ISO 8601） |
| 14 | updatedAt | string | 最後更新時間（ISO 8601） |

**與 COMPLETE_V2 preset 差異**：新增 identifiers/progressInfo（COMPLETE_V2 因序列化策略未定而未納入）。

---

## 物件欄位序列化策略

### 決策：JSON-in-cell

identifiers 和 progressInfo 兩個 nested object 採用 **JSON-in-cell** 策略（欄位值為 JSON.stringify 結果）。

| 欄位 | 範例值（CSV cell 內容） |
|------|----------------------|
| identifiers | `{"privacyBookId":"abc123","readmooId":"456"}` |
| progressInfo | `{"currentPage":42,"totalPages":300,"lastReadAt":"2026-01-15"}` |

**選擇理由**：

| 策略 | 優點 | 缺點 |
|------|------|------|
| JSON-in-cell（採用） | 欄位數固定、import 對稱簡單、不因平台新增 key 而改 schema | Excel 內不可直接讀取子欄位 |
| 拍平為多欄（棄用） | Excel 友善 | 欄位數隨 key 變動、跨書城 key 不同需大量空欄、import 重組複雜 |

**import 對稱性**：importer 對 identifiers/progressInfo 欄做 `JSON.parse(cell)`，失敗時視為空物件 `{}`。

---

## 陣列序列化策略

### 決策：管道符 `|` 分隔

authors 和 tagIds 兩個陣列欄位採用 **管道符 `|`** 作為分隔符。

| 欄位 | 範例值（CSV cell 內容） |
|------|----------------------|
| authors | `作者A\|作者B` |
| tagIds | `tag-001\|tag-002\|tag-003` |

**選擇理由**：

| 分隔符 | 優點 | 缺點 |
|--------|------|------|
| 逗號 `,` | 直覺 | 與 CSV 欄位分隔符衝突，需額外引號處理 |
| 分號 `;` | 不衝突 | 部分 locale 的 CSV 用 `;` 作欄位分隔符 |
| 管道符 `\|`（採用） | 不與 CSV/locale 衝突、視覺明確 | 極少數書名含 `\|` 需 escape |

**escape 規則**：若值本身含 `|`，以 `\|` 表示（反斜線轉義）。

**import 對稱性**：importer 對陣列欄做 `cell.split('|').map(s => s.replace(/\\\\|/g, '|'))`。

---

## Import 對稱性（與 W6-012.6.2 對應）

CSV export 與 import 必須滿足 round-trip 一致性：

| 匯出行為 | 匯入行為 | 驗證 |
|---------|---------|------|
| id 欄位必輸出 | import 以 id 做 dedup | export → import 不重複 |
| 陣列用 `\|` 分隔 | import 用 `\|` split | 值含 `\|` 需 escape |
| 物件用 JSON.stringify | import 用 JSON.parse | parse 失敗 fallback 空物件 |
| boolean 輸出 `true`/`false` | import 用 `=== 'true'` | 不接受 0/1 |
| 空陣列輸出空字串 `""` | import 視空字串為 `[]` | 非 null/undefined |

---

## 版本演進路徑

| 版本 | CSV 欄位集 | 觸發條件 |
|------|-----------|---------|
| v0.18 | 最小集 8 欄 | W6-012.6.1 落地 |
| v2.0+ | 完整集 14 欄 | COMPLETE_V2 接線至 Overview UI + identifiers/progressInfo 序列化落地 |

---

## 相關文件

- `docs/use-cases.md` UC-03 — CSV 匯出用例規格
- `src/overview/book-exporter.js` — v0.18 實際 CSV 生產端
- `src/export/book-data-exporter.js` — v2 完整版（未接線）
- `docs/spec/export-interchange-format-v2.md` — JSON 匯出 Interchange Format v2
