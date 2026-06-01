# Book Interchange Format（book-interchange-v1）

**版本**: 2.0.0（draft）
**建立日期**: 2026-06-02
**來源**: 0.19.0-W4-031 ANA（D1-D6）+ 0.19.0-W4-031.1（v1 draft）+ 0.19.0-W4-031.3 reconciliation（PROP-007 對齊，方案 C）
**定位**: 本專案（Chrome Extension, readmoo-book-extractor）與配套 Flutter APP（book_overview_app）**雙專案共同 SSOT** 的跨專案匯入匯出 canonical 格式

---

## 0. v2.0.0 變更摘要（reconciliation 對齊 PROP-007）

W4-031.3 reconciliation 發現 APP 既存 `PROP-007`（everything-as-tags + CCL，draft 未實作）。經 WRAP 分析採**方案 C（結構化外殼 + 正規化 tag 內裡 + CCL first-class）**，自 v1 升級項：

| 項目 | v1.0.0 | v2.0.0 |
|------|--------|--------|
| cover | 單 URL | 多尺寸物件（相容單字串） |
| progress | 單數字 | 物件 {percentage/currentPage/totalPages/lastReadAt}（相容單數字） |
| authors | string[] | 物件陣列 [{name, lang?}]（相容 string[]） |
| identifiers.isbn | 單值 | 陣列（多版本 ISBN） |
| classification | tagIds + importanceLevel/category/genre | 加 **ccl first-class**（{code, path, locked}） |
| tagCategories | 僅 custom | 支援 system + custom（system 為 v2.0 擴展點） |
| dedup | 僅 id | id 主鍵 + crossPlatformId/dataFingerprint（軟連結） |

> reconciliation 完整 WRAP 與決策理由見 `docs/work-logs/.../0.19.0-W4-031.3.md` Solution 章節。

---

## 1. 定位與 SSOT 聲明

本規格定義 `book-interchange-v1` —— 兩專案間透過 JSON 檔案雙向同步書庫資料的**唯一權威格式（SSOT）**。

| 項目 | 說明 |
|------|------|
| 取代關係 | 取代/升版 `docs/spec/export-interchange-format-v2.md`（原僅本專案內部 v2 格式）；export-interchange-format-v2 降為「本專案 v2 內部格式」，新匯出改用本 canonical |
| 適用範圍 | 跨專案同步走 **JSON**（本格式）；CSV 為各專案人類可讀匯出，**不**走跨專案互通（見 §13，D6=A）|
| 兩專案責任 | 各專案實作 adapter：內部 model ↔ 本 canonical 雙向轉換（read/write）|

> **Why SSOT**：兩專案各自演進導致格式漂移（W4-031 確認雙向不一致 + 雙方規格書 stale/stub；W4-031.3 確認 D2=C 與 PROP-007 衝突）。單一 canonical + 雙方 adapter 是消除漂移的根本解。

---

## 2. 設計約束（不可違反）

| # | 約束 | 落地機制 |
|---|------|---------|
| C1 | 雙向互通無損 | superset 欄位聯集 + pass-through（§11）；一端匯出經另一端再匯回不丟資料 |
| C2 | Extension 能展示 APP 分類 | classification 結構化物件（§5）為 first-class，Extension 至少唯讀存取 + 渲染 |
| C3 | 兩端內部模型刻意不同不強求統一 | adapter 各自映射，canonical 為交換層非內部模型 |
| C4 | id 保留 | 匯入保留原 id、禁重生（§12）|
| C5 | 可擴展（向後相容演進） | formatVersion 版本協商 + pass-through，預留 v2.0 全面 tag 化路徑（§12） |

---

## 3. Root 結構

```json
{
  "format": "book-interchange-v1",
  "formatVersion": "2.0.0",
  "metadata": {
    "exportedAt": "2026-06-02T10:00:00.000Z",
    "sourceApp": "readmoo-book-extractor",
    "totalBooks": 928
  },
  "tagCategories": [
    { "id": "cat-custom", "name": "自訂標籤", "system": false, "allowTree": true }
  ],
  "tags": [
    { "id": "tag-001", "name": "科幻", "categoryId": "cat-custom", "parentId": null, "locked": false }
  ],
  "books": [ /* Book 物件，見 §4 */ ]
}
```

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `format` | string | 是 | 固定字面 `"book-interchange-v1"`（detector 辨識用，§12）|
| `formatVersion` | string | 是 | semver，當前 `"2.0.0"` |
| `metadata.exportedAt` | string(ISO8601) | 是 | 匯出時間 |
| `metadata.sourceApp` | string | 是 | 枚舉：`readmoo-book-extractor` / `book_overview_app` |
| `metadata.totalBooks` | number | 是 | books 數量（交叉驗證）|
| `tagCategories` | array | 是（可空 `[]`）| 正規化 category pool（§6）|
| `tags` | array | 是（可空 `[]`）| 正規化 tag pool（§6）|
| `books` | array | 是 | 書籍陣列 |

---

## 4. Book 物件（superset 欄位）

```json
{
  "id": "210327003000101",
  "title": "挪威的森林",
  "authors": [{ "name": "村上春樹", "lang": "zh" }],
  "source": "readmoo",
  "cover": {
    "thumbnail": "https://cdn.readmoo.com/cover/...210x315.jpg",
    "medium": "https://cdn.readmoo.com/cover/...420x630.jpg",
    "original": "https://cdn.readmoo.com/cover/...full.jpg"
  },
  "readingStatus": "reading",
  "progress": {
    "percentage": 45.5,
    "currentPage": 120,
    "totalPages": 265,
    "lastReadAt": "2026-03-20T14:22:00.000Z"
  },
  "classification": {
    "tagIds": ["tag-001"],
    "importanceLevel": null,
    "genre": null,
    "ccl": null
  },
  "identifiers": { "isbn": [] },
  "crossPlatformId": null,
  "dataFingerprint": null,
  "publisher": null,
  "publishDate": null,
  "description": null,
  "rating": null,
  "addedDate": null,
  "createdAt": null,
  "updatedAt": null,
  "apiEnriched": false,
  "activeLoan": null,
  "_passthrough": {}
}
```

| 欄位 | 型別 | 必填 | 來源端 | 說明 |
|------|------|------|--------|------|
| `id` | string | 是 | 兩端 | 唯一識別符，匯入保留禁重生（§12）|
| `title` | string | 是 | 兩端 | 書名 |
| `authors` | object[] | 是（可空）| Extension `authors`→[{name}]；APP `author`(單)→[{name}] | `[{name, lang?}]`。相容 string[]（adapter 升級）|
| `source` | string | 是 | 兩端 | 書城/來源名稱（如 `readmoo`/`physical`）。APP `source`(物件)→序列化為名稱字串，細節存 `_passthrough.sourceObject` |
| `cover` | object\|string | 否 | Extension `cover`(URL)；APP `coverImageUrl`(URL) | 多尺寸 `{thumbnail?, medium?, original?}`。相容單字串（→`original`）（§8）|
| `readingStatus` | enum | 是 | 兩端正規化 | 6 態（§7）|
| `progress` | object | 否 | Extension `progress`/`progressInfo` | `{percentage?, currentPage?, totalPages?, lastReadAt?}`（§9）|
| `classification` | object | 是 | 兩端（§5）| 結構化分類物件（含 CCL first-class）|
| `identifiers` | object | 否 | Extension `identifiers`；APP `isbn` | `{ isbn: string[], ... }`（多版本 ISBN）|
| `crossPlatformId` | string\|null | 否 | APP（規劃）| 跨平台統一 ID（dedup 軟連結，§12）|
| `dataFingerprint` | string\|null | 否 | APP（規劃）| 資料指紋（dedup 輔助，§12）|
| `publisher` | string\|null | 否 | APP | 出版社 |
| `publishDate` | string(ISO8601)\|null | 否 | APP（ms epoch→ISO8601）| 出版日 |
| `description` | string\|null | 否 | APP | 簡介 |
| `rating` | number\|null | 否 | APP | 評分（0.0-5.0）|
| `addedDate` | string(ISO8601)\|null | 否 | APP | 加入日 |
| `createdAt` | string(ISO8601)\|null | 否 | 兩端 | 建立時間（PROP-007 created_at）|
| `updatedAt` | string(ISO8601)\|null | 否 | 兩端 | 最後更新時間（衝突解決比較用）|
| `apiEnriched` | boolean | 否 | APP | 是否經 API 補充 |
| `activeLoan` | object\|null | 否 | APP | 實體書借閱資訊（APP-only，Extension pass-through）|
| `_passthrough` | object | 否 | 兩端 | 未知欄位保留袋（§11）|

> Extension-only 欄位（如 `extractedAt`）由各端透過 `_passthrough` 保留，不列為 canonical first-class（避免單端欄位污染共用 schema）。

---

## 5. classification 結構化物件（方案 C：結構化 + CCL first-class）

分類採結構化物件：tag 維度用正規化 ID 圖（refs 進 root `tags`/`tagCategories`），純量分類屬性與 CCL 保語意。

```json
"classification": {
  "tagIds": ["tag-001", "tag-002"],
  "importanceLevel": 4,
  "genre": "文學",
  "ccl": { "code": "861", "path": "語言文學/東方文學/日本文學", "locked": true }
}
```

| 欄位 | 型別 | 來源 | 說明 |
|------|------|------|------|
| `tagIds` | string[] | 兩端 | refs 進 root `tags[]`（正規化）。Extension native；APP tag 名稱→生成穩定 tag id 加入 pool |
| `importanceLevel` | number(1-7)\|null | APP | 7 級重要度（§5.1）。Extension 唯讀展示，不編輯 |
| `genre` | string\|null | APP | 書級類型（APP `genre`；APP `category` 複用 `genre`，canonical 統一用 `genre`）|
| `ccl` | object\|null | 兩端（v0.20+）| 中文圖書分類法 first-class：`{code, path, locked}`（§5.2）|

### 5.1 importanceLevel 7 級語意（對齊 PROP-007 §3.3）

| level | 名稱 | 說明 |
|-------|------|------|
| 1 | 參考書 | 常查閱的工具書 |
| 2 | 重讀收藏 | 喜愛而想重複閱讀 |
| 3 | 文獻保存 | 學術或文獻價值 |
| 4 | 推薦分享 | 想推薦給他人 |
| 5 | 收藏價值 | 收藏目的 |
| 6 | 裝飾展示 | 家居裝飾 |
| 7 | 可清理 | 可清理或轉讓 |

APP `ImportanceLevel.value`(1-7) 直填；Extension carry+display（不編輯）。

### 5.2 ccl 中文圖書分類法（first-class，非 tag pool 成員）

CCL 是受控階層分類（is_locked，使用者不可改分類項），語意上不同於自訂 tag，故設為 classification 內 first-class 結構化欄位：

| 欄位 | 型別 | 說明 |
|------|------|------|
| `code` | string | CCL 分類號（如 `"861"` 日本文學）|
| `path` | string | 階層路徑（`大類/中類/小類`，使用者可只選到任一層）|
| `locked` | boolean | 固定 `true`（受控分類，不可由使用者改項）|

**Why first-class（非 tag）**：CCL 是受控詞彙的固定階層（10 大類→100→1000），與使用者自訂 tag tree 本質不同（PROP-007 自身也用 is_locked 特殊化）。結構化欄位讓 Extension 唯讀展示更直接（讀 `classification.ccl.path`），且與 V1 v0.20.x 中文分類里程碑對齊。

**映射規則**：
- Extension 匯出：`tagIds` 直填，純量/ccl 為 null（除非由 APP 匯入後 carry）。
- APP 匯出：tag 名稱解析/生成為 tag node（穩定 id + 加入 root pool），`tagIds` 指向之；`importanceLevel`/`genre`/`ccl` 直填。
- Extension 匯入 APP 資料：保留整個 classification 物件（含 ccl），唯讀展示 APP 分類（滿足 C2）。

---

## 6. tag pool 正規化（tagCategories + tags）

root `tagCategories` 與 `tags` 構成正規化 tag 圖。`classification.tagIds` 為書級 refs。

### tagCategories（分類類別）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | string | category id（如 `cat-custom`）|
| `name` | string | 顯示名稱 |
| `system` | boolean | `true`=系統類別 / `false`=使用者自訂 |
| `allowTree` | boolean | 是否允許巢狀（tags.parentId）|

**v1.0 必需**：至少支援 `custom`（使用者自訂）類別。
**v2.0 擴展點**：system 類別（author/publisher/platform/language/series/alias 等，對齊 PROP-007 §3.3 everything-as-tags）。pool 已正規化，未來加 system 類別是擴展非重構（C5）。

### tags（tag 項目）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | string | tag id |
| `name` | string | tag 名稱 |
| `categoryId` | string | 所屬 category（ref tagCategories）|
| `parentId` | string\|null | 巢狀父 tag（allowTree 類別用）|
| `locked` | boolean | 是否鎖定（一般 custom 為 false）|

> CCL 不放 tags pool（見 §5.2，CCL 為 classification first-class）。

---

## 7. readingStatus 6 態正規化

canonical 6 態：`unread` / `reading` / `finished` / `queued` / `abandoned` / `reference`。

| canonical | Extension v2 | APP ReadingStatus | PROP-007 |
|-----------|-------------|-------------------|----------|
| unread | unread | notStarted | not_started |
| reading | reading | reading | reading |
| finished | finished | finished | finished |
| queued | queued | queued | queued |
| abandoned | abandoned | abandoned | abandoned |
| reference | reference | （APP 無 → pass-through 原值）| reference |

> APP 端 readingStatus 枚舉若不含某 canonical 態，adapter 須記錄原值於 `_passthrough.readingStatusRaw` 避免遺失（C1）。

---

## 8. cover 多尺寸（reconcile #3）

```json
"cover": { "thumbnail": "...210x315.jpg", "medium": "...420x630.jpg", "original": "...full.jpg" }
```

| 規則 | 說明 |
|------|------|
| 物件形式 | `{thumbnail?, medium?, original?}`，各尺寸 optional |
| 相容單字串 | adapter 讀到 `cover: "url"`（字串）時，視為 `{original: "url"}` |
| Extension 升級 | Extension 當前單 `cover` URL → `{original: cover}`；多尺寸由 readmoo 來源 URL pattern 推導（adapter 實作評估）|
| APP | `coverImageUrl`(單) → `{original: coverImageUrl}`；PROP-007 規劃多尺寸後填 thumbnail/medium |

---

## 9. progress 物件（reconcile #4）

```json
"progress": { "percentage": 45.5, "currentPage": 120, "totalPages": 265, "lastReadAt": "2026-03-20T14:22:00.000Z" }
```

| 欄位 | 型別 | 來源 |
|------|------|------|
| `percentage` | number\|null | Extension `progress`(number) |
| `currentPage` | number\|null | Extension `progressInfo.currentPage` |
| `totalPages` | number\|null | Extension `progressInfo.totalPages` |
| `lastReadAt` | string(ISO8601)\|null | Extension `progressInfo.lastReadAt` |

| 規則 | 說明 |
|------|------|
| 相容單數字 | adapter 讀到 `progress: 45.5`（number）時，視為 `{percentage: 45.5}` |
| APP | 當前無 progress（PROP-007 §3.9 規劃加入 ReadingProgress VO）；匯入時 carry，匯出時若無則 null |

---

## 10. 兩端欄位對映總表（Extension v2 ↔ canonical ↔ APP）

| canonical | Extension v2 | APP Book.toJson | 無損註記 |
|-----------|-------------|-----------------|---------|
| id | id | id | 保留（§12）|
| title | title | title | — |
| authors[{name}] | authors[] | author(單)→[{name}] | APP 反向取 [0].name |
| source | source(str) | source(物件)→名稱 | APP 物件細節存 `_passthrough.sourceObject` |
| cover{} | cover(URL) | coverImageUrl(URL) | 單字串→{original}（§8）|
| readingStatus | readingStatus | readingStatus(name) | §7 6 態（APP notStarted↔unread）|
| progress{} | progress(num)+progressInfo | （無）→null | §9；Extension 反向拆 percentage/progressInfo |
| classification.tagIds | tagIds | tags(名稱)→生成 id | 正規化（§6）|
| classification.importanceLevel | （null）| importanceLevel(1-7) | APP-only，Ext carry+display |
| classification.genre | （null）| genre（=category）| APP-only，Ext carry+display |
| classification.ccl | （v0.20+）| （v0.20+ PROP-007）| first-class（§5.2），兩端 v0.20 落地 |
| identifiers.isbn[] | identifiers | isbn(單)→[isbn] | 多版本陣列 |
| crossPlatformId/dataFingerprint | （pass-through）| （規劃）| dedup 軟連結（§12）|
| publisher/publishDate/description/rating/addedDate/createdAt/apiEnriched/activeLoan | （pass-through）| 同名 | APP-only，Ext pass-through |
| _passthrough.extractedAt 等 | extractedAt 等 | （pass-through）| Extension-only，APP pass-through |

---

## 11. pass-through 機制（D3）

匯入端對**未知欄位**（不在本 canonical 定義內）**原樣保留**，禁止 strip。

| 規則 | 說明 |
|------|------|
| 保留位置 | 未知頂層 book 欄位移入 `_passthrough` 物件（或實作端保留完整原始欄位袋，覆寫已知欄位）|
| 匯出端 | 匯出時將 `_passthrough` 內容平鋪回頂層（或保留），確保下一端可讀 |
| 目的 | 一端不認識的欄位（對方版本新增/專屬）round-trip 不丟（C1）|
| 單端欄位 | Extension-only（extractedAt）/ APP-only（status/modificationHistory）皆走 pass-through |

---

## 12. 版本協商 + detector + dedup（D4 / D5 / C5）

匯入 detector 辨識來源優先序（高→低）：

| 優先序 | 條件 | 判定 |
|--------|------|------|
| 1 | `format === "book-interchange-v1"` | 本 canonical（讀 formatVersion 分流 1.x/2.x）|
| 2 | `metadata.formatVersion` 以 `2.` 開頭（無 `format` 欄位）| 本專案舊 v2 內部格式（相容讀）|
| 3 | 含 `backup_info` 或 `export_info` wrapper + `books[]` | APP legacy 格式（經 APP-legacy adapter）|
| 4 | 純陣列 或 `{books:[]}` 無版本標記 | flat v1（legacy converter）|

**id 保留（D5）**：所有來源匯入一律保留原 `id`，禁重生。

**dedup（C5）**：跨來源去重以 id 為主鍵；`crossPlatformId` 為跨平台軟連結（同一本書在不同平台的統一 ID）、`dataFingerprint` 為內容指紋（輔助偵測重複），兩者皆 optional，**不取代 id 主鍵**。APP 自建書（`book_{timestamp}` scheme）與 Extension readmoo stable id 各自保留，不互相重算。

**版本演進（C5）**：formatVersion semver 標記模型版本。未來若全面 tag 化（everything-as-tags），升 formatVersion major，detector 優先序 1 內依 formatVersion 分流；pass-through 保護舊資料不丟。

---

## 13. CSV 定位（D6=A）

| 項目 | 決策 |
|------|------|
| 跨專案同步 | **僅走 JSON**（本 canonical），完整保真 |
| CSV | 各專案維持自身人類可讀 CSV 匯出，**不要求跨專案 round-trip** |
| 理由 | 結構化分類（classification 物件 + ccl + 正規化 tag 圖）本質無法無損攤平為扁平 CSV |

**CSV 受眾定位**：CSV 給**想自行整理書目而不透過配套 APP 的用戶**（匯入 spreadsheet 自訂排序/篩選/標記）。故 CSV 欄位刻意單純、不含自訂欄位；跨專案無損不是 CSV 的保證——雙向無損同步一律走本 JSON canonical。CSV 的「無損不可能」是配合此受眾定位的刻意取捨，而非缺陷。本專案內部（自身匯出 → 自身匯入）仍支援 id-based round-trip，服務 spreadsheet 使用者的本地工作流。

> 各專案 CSV 欄位/分隔符規格各自維護（本專案見 `docs/spec/csv-export-spec.md`，tags 分隔符 `; `）。跨專案匯入 CSV **不在本 canonical 保證範圍**。

---

## 14. 落地（spawn 自 W4-031）

| ticket | 範圍 | 狀態 |
|--------|------|------|
| 0.19.0-W4-031.1 | 撰寫本規格 v1.0.0 draft | completed |
| 0.19.0-W4-031.3 | reconciliation 升版 v2.0.0（本次）| in_progress |
| 0.19.0-W4-031.2（本專案 adapter）| read/write canonical v2 + detector 四來源 + classification(含 ccl) + APP 來源無損匯入（含「APP 誤判 v1」止血）+ 多尺寸 cover/progress 物件/authors 升級 | pending（blockedBy 本 ANA）|
| APP repo DOC | PROP-007 + APP specs 對齊本 canonical | 待建（跨 repo）|
| APP repo IMP | APP adapter：emit/read canonical + 分類雙向映射 + ccl + formatVersion | 待建（跨 repo）|

---

## 相關文件

- `docs/work-logs/v0/v0.19/v0.19.0/tickets/0.19.0-W4-031.md` — 來源 ANA（D1-D6 + 雙向欄位矩陣）
- `docs/work-logs/v0/v0.19/v0.19.0/tickets/0.19.0-W4-031.3.md` — reconciliation ANA（WRAP + 方案 C 決策 + 逐欄 reconcile）
- `docs/spec/export-interchange-format-v2.md` — 本專案 v2 內部格式（被本 canonical 取代為跨專案 SSOT）
- `docs/spec/csv-export-spec.md` — 本專案 CSV 人類匯出規格（不跨專案互通）
- 配套 APP：`/Users/tarragon/Projects/book_overview_app/docs/proposals/PROP-007-cross-project-spec-alignment.md`（everything-as-tags 規劃，本 canonical reconcile 對象）

---

**Last Updated**: 2026-06-02 | **Version**: 2.0.0（draft）| **Status**: draft — 待兩端 adapter 實作驗證 + 用戶 review 分類模型方向後升 approved
