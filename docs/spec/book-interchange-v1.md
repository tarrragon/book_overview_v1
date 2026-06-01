# Book Interchange Format v1（book-interchange-v1）

**版本**: 1.0.0（draft）
**建立日期**: 2026-06-02
**來源**: 0.19.0-W4-031 ANA contract 設計決策（D1-D6）+ 0.19.0-W4-031.1 撰寫
**定位**: 本專案（Chrome Extension, readmoo-book-extractor）與配套 Flutter APP（book_overview_app）**雙專案共同 SSOT** 的跨專案匯入匯出 canonical 格式

---

## 1. 定位與 SSOT 聲明

本規格定義 `book-interchange-v1` —— 兩專案間透過 JSON 檔案雙向同步書庫資料的**唯一權威格式（SSOT）**。

| 項目 | 說明 |
|------|------|
| 取代關係 | 取代/升版 `docs/spec/export-interchange-format-v2.md`（原僅本專案內部 v2 格式）；export-interchange-format-v2 降為「本專案 v2 內部格式」，新匯出改用本 canonical |
| 適用範圍 | 跨專案同步走 **JSON**（本格式）；CSV 為各專案人類可讀匯出，**不**走跨專案互通（見 §9，D6=A）|
| 兩專案責任 | 各專案實作 adapter：內部 model ↔ 本 canonical 雙向轉換（read/write）|

> **Why SSOT**：兩專案各自演進導致格式漂移（W4-031 確認雙向不一致 + 雙方規格書 stale/stub）。單一 canonical 格式 + 雙方 adapter 是消除漂移的根本解。

---

## 2. 設計約束（不可違反）

| # | 約束 | 落地機制 |
|---|------|---------|
| C1 | 雙向互通無損 | superset 欄位聯集 + pass-through（§7）；一端匯出經另一端再匯回不丟資料 |
| C2 | Extension 能展示 APP 分類 | classification 結構化物件（§5）為 first-class，Extension 至少唯讀存取 + 渲染 |
| C3 | 兩端內部模型刻意不同不強求統一 | adapter 各自映射，canonical 為交換層非內部模型 |
| C4 | id 保留 | 匯入保留原 id、禁重生（§8）|

---

## 3. Root 結構

```json
{
  "format": "book-interchange-v1",
  "formatVersion": "1.0.0",
  "metadata": {
    "exportedAt": "2026-06-02T10:00:00.000Z",
    "sourceApp": "readmoo-book-extractor",
    "totalBooks": 928
  },
  "tagCategories": [
    { "id": "cat-001", "name": "自訂標籤" }
  ],
  "tags": [
    { "id": "tag-001", "name": "科幻", "categoryId": "cat-001" }
  ],
  "books": [ /* Book 物件，見 §4 */ ]
}
```

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `format` | string | 是 | 固定字面 `"book-interchange-v1"`（detector 辨識用，§8）|
| `formatVersion` | string | 是 | semver，當前 `"1.0.0"` |
| `metadata.exportedAt` | string(ISO8601) | 是 | 匯出時間 |
| `metadata.sourceApp` | string | 是 | 枚舉：`readmoo-book-extractor` / `book_overview_app` |
| `metadata.totalBooks` | number | 是 | books 數量（交叉驗證）|
| `tagCategories` | array | 是（可空 `[]`）| 正規化 category pool |
| `tags` | array | 是（可空 `[]`）| 正規化 tag pool |
| `books` | array | 是 | 書籍陣列 |

---

## 4. Book 物件（superset 欄位）

```json
{
  "id": "210327003000101",
  "title": "大腦不滿足",
  "authors": ["作者A"],
  "source": "readmoo",
  "cover": "https://cdn.readmoo.com/cover/...",
  "readingStatus": "reading",
  "progress": 30,
  "classification": {
    "tagIds": ["tag-001"],
    "importanceLevel": null,
    "category": null,
    "genre": null
  },
  "identifiers": { "isbn": null },
  "publisher": null,
  "publishDate": null,
  "description": null,
  "rating": null,
  "addedDate": null,
  "apiEnriched": false,
  "activeLoan": null,
  "progressInfo": null,
  "extractedAt": null,
  "updatedAt": null,
  "_passthrough": {}
}
```

| 欄位 | 型別 | 必填 | 來源端 | 說明 |
|------|------|------|--------|------|
| `id` | string | 是 | 兩端 | 唯一識別符，匯入保留禁重生（§8）|
| `title` | string | 是 | 兩端 | 書名 |
| `authors` | string[] | 是（可空）| Extension native；APP `author`(單)→`[author]` | 作者陣列（canonical 統一陣列）|
| `source` | string | 是 | 兩端 | 書城/來源名稱（如 `readmoo` / `imported`）。APP `source`(物件)→序列化為名稱字串 |
| `cover` | string | 否 | Extension `cover`；APP `coverImageUrl`→`cover` | 封面 URL |
| `readingStatus` | enum | 是 | 兩端正規化 | 6 態：`unread`/`reading`/`finished`/`queued`/`abandoned`/`reference`（§6 映射）|
| `progress` | number | 否 | Extension | 閱讀進度百分比 |
| `classification` | object | 是 | 兩端（§5）| 結構化分類物件 |
| `identifiers` | object | 否 | Extension `identifiers`；APP `isbn` 併入 | `{ isbn?, ... }` |
| `publisher` | string\|null | 否 | APP | 出版社 |
| `publishDate` | string(ISO8601)\|null | 否 | APP（ms epoch→ISO8601）| 出版日 |
| `description` | string\|null | 否 | APP | 簡介 |
| `rating` | number\|null | 否 | APP | 評分 |
| `addedDate` | string(ISO8601)\|null | 否 | APP | 加入日 |
| `apiEnriched` | boolean | 否 | APP | 是否經 API 補充 |
| `activeLoan` | object\|null | 否 | APP | 實體書借閱資訊（APP-only，Extension pass-through）|
| `progressInfo` | object\|null | 否 | Extension | 詳細進度（Extension-only，APP pass-through）|
| `extractedAt` | string(ISO8601)\|null | 否 | Extension | 首次提取時間 |
| `updatedAt` | string(ISO8601)\|null | 否 | Extension | 最後更新時間 |
| `_passthrough` | object | 否 | 兩端 | 未知欄位保留袋（§7）|

---

## 5. classification 結構化物件（D2=C）

分類採結構化物件，tag 維度用正規化 ID 圖（refs 進 root `tags`/`tagCategories`），純量屬性保語意。

```json
"classification": {
  "tagIds": ["tag-001", "tag-002"],
  "importanceLevel": "high",
  "category": "文學",
  "genre": "科幻"
}
```

| 欄位 | 型別 | 來源 | 說明 |
|------|------|------|------|
| `tagIds` | string[] | 兩端 | refs 進 root `tags[]`（正規化）。Extension native；APP tag 名稱→生成穩定 tag id 加入 pool |
| `importanceLevel` | string\|null | APP | 序數重要度（APP ImportanceLevel）。Extension 唯讀展示，不編輯 |
| `category` | string\|null | APP | APP 書級 category |
| `genre` | string\|null | APP | 類型 |

**映射規則**：
- Extension 匯出：`tagIds` 直填，純量屬性為 null（Extension 無此概念，除非由 APP 匯入後 carry）。
- APP 匯出：tag 名稱解析/生成為 tag node（穩定 id + 加入 root pool），`tagIds` 指向之；`importanceLevel`/`category`/`genre` 直填。
- Extension 匯入 APP 資料：保留整個 classification 物件（含純量），唯讀展示 APP 分類（滿足 C2）。

---

## 6. readingStatus 6 態正規化

canonical 6 態：`unread` / `reading` / `finished` / `queued` / `abandoned` / `reference`。

| canonical | Extension v2 | APP ReadingStatus |
|-----------|-------------|-------------------|
| unread | unread | notStarted |
| reading | reading | reading |
| finished | finished | finished |
| queued | queued | （APP 無 → 降 unread 或 pass-through 原值）|
| abandoned | abandoned | （APP 無 → pass-through）|
| reference | reference | （APP 無 → pass-through）|

> APP 端 readingStatus 枚舉若不含某 canonical 態，adapter 須記錄原值於 `_passthrough.readingStatusRaw` 避免遺失（C1）。

---

## 7. pass-through 機制（D3）

匯入端對**未知欄位**（不在本 canonical 定義內）**原樣保留**，禁止 strip。

| 規則 | 說明 |
|------|------|
| 保留位置 | 未知頂層 book 欄位移入 `_passthrough` 物件（或實作端保留完整原始欄位袋，覆寫已知欄位）|
| 匯出端 | 匯出時將 `_passthrough` 內容平鋪回頂層（或保留），確保下一端可讀 |
| 目的 | 一端不認識的欄位（對方版本新增/專屬）round-trip 不丟（C1）|

---

## 8. 版本協商 + detector 優先序（D4 / D5）

匯入 detector 辨識來源優先序（高→低）：

| 優先序 | 條件 | 判定 |
|--------|------|------|
| 1 | `format === "book-interchange-v1"` | 本 canonical（直接讀）|
| 2 | `metadata.formatVersion` 以 `2.` 開頭 | 本專案舊 v2（內部格式，相容讀）|
| 3 | 含 `backup_info` 或 `export_info` wrapper + `books[]` | APP legacy 格式（經 APP-legacy adapter）|
| 4 | 純陣列 或 `{books:[]}` 無版本標記 | flat v1（legacy converter）|

**id 保留（D5）**：所有來源匯入一律保留原 `id`，禁重生。跨來源 dedup 以 id 為鍵。APP 自建書（`book_{timestamp}` scheme）與 Extension readmoo stable id 各自保留，不互相重算。

---

## 9. CSV 定位（D6=A）

| 項目 | 決策 |
|------|------|
| 跨專案同步 | **僅走 JSON**（本 canonical），完整保真 |
| CSV | 各專案維持自身人類可讀 CSV 匯出，**不要求跨專案 round-trip** |
| 理由 | D2=C 結構化分類 + 正規化圖本質無法無損攤平為扁平 CSV |

> 各專案 CSV 欄位/分隔符規格各自維護（本專案見 `docs/spec/csv-export-spec.md`，tags 分隔符 `; `）。跨專案匯入 CSV **不在本 canonical 保證範圍**。

---

## 10. 兩端欄位對映總表（Extension v2 ↔ canonical ↔ APP）

| canonical | Extension v2 | APP Book.toJson | 無損註記 |
|-----------|-------------|-----------------|---------|
| id | id | id | 保留 |
| title | title | title | — |
| authors[] | authors[] | author(單)→[author] | APP 反向取 [0] |
| source | source(str) | source(物件)→名稱 | APP 反向須還原物件，差異存 _passthrough |
| cover | cover | coverImageUrl | 改名映射 |
| readingStatus | readingStatus | readingStatus(name) | §6 6 態正規化 |
| progress | progress | （無）→null | Extension-only |
| classification.tagIds | tagIds | tags(名稱)→生成 id | 正規化 |
| classification.importanceLevel/category/genre | （null）| importanceLevel/category/genre | APP-only，Ext carry+display |
| identifiers.isbn | identifiers | isbn | 結構併入 |
| publisher/publishDate/description/rating/addedDate/apiEnriched/activeLoan | （pass-through）| 同名 | APP-only，Ext pass-through |
| progressInfo/extractedAt/updatedAt | 同名 | （pass-through）| Extension-only，APP pass-through |

---

## 11. 落地（spawn 自 W4-031）

| ticket | 範圍 |
|--------|------|
| 0.19.0-W4-031.1（本 DOC）| 撰寫本規格 |
| S2 IMP（本專案 adapter）| read/write canonical + detector 四來源 + classification 存取 + APP 來源無損匯入（含「APP 誤判 v1」止血）|
| S3（APP 端，跨 repo 待辦）| APP adapter：emit/read canonical + classification 雙向映射 + formatVersion。須於 `book_overview_app` repo 另起 ticket |

---

## 相關文件

- `docs/work-logs/v0/v0.19/v0.19.0/tickets/0.19.0-W4-031.md` — 來源 ANA（設計決策 D1-D6 + 雙向欄位矩陣）
- `docs/spec/export-interchange-format-v2.md` — 本專案 v2 內部格式（被本 canonical 取代為跨專案 SSOT）
- `docs/spec/csv-export-spec.md` — 本專案 CSV 人類匯出規格（不跨專案互通）
- 配套 APP：`/Users/tarragon/Projects/book_overview_app`（`lib/domains/library/entities/book.dart` 等）

---

**Last Updated**: 2026-06-02 | **Version**: 1.0.0（draft）| **Status**: draft — 待 S2/S3 adapter 實作驗證後升 approved
