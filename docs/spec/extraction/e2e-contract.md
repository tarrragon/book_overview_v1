---
id: SPEC-002a
title: "E2E 提取流程契約規格"
status: draft
source_proposal: null
created: "2026-05-25"
updated: "2026-05-25"
version: "1.0"
owner: ""

domain: extraction
subdomain: e2e-contract
parent_spec: SPEC-002

related_usecases: [UC-01, UC-02, UC-03, UC-04, UC-06]
related_specs: [SPEC-002, SPEC-001, SPEC-003]
implements_requirements: []
depends_on_domains: [core, platform, messaging, storage]
---

# E2E 提取流程契約規格

## 概述

本規格定義 Chrome Extension 提取 Readmoo 書庫的 E2E 流程契約，涵蓋 Service Worker → Content Script → Storage → Overview 完整鏈路的對外承諾。

**Why（規格動機）**：E2E 契約原本散落於 `tests/e2e/browser/`、`src/background/`、`src/content/`、`src/storage/`、`src/event-system/` 各處的硬編碼字串與常數。新人接手時無從掌握「跨進程邊界的對外承諾」，且 W1-001.2（SPA hash 路由誤判）與 W1-050（CE-Node 環境前提誤判）已證明缺契約成本極高。

**Consequence**：未契約化的 E2E 流程在實作演進過程中容易破壞既有測試的隱性假設；下游消費者（測試、新功能、debug）依賴口傳知識而非可驗證的規格。

**Action**：本規格集中定義 6 個契約，每個契約附 source of truth、JSON Schema / Mermaid diagram、grep 驗證指令；後續修改 E2E 行為時必須先更新本規格再改 code。

---

## 與 SPEC-002 的職責分離

| 規格 | 職責 | 內容類型 |
|------|------|---------|
| SPEC-002 (`extraction-pipeline.md`) | 實作元件清單（What is done） | FR-01/02/03 已實作微服務與檔案路徑 |
| SPEC-002a (本檔, `e2e-contract.md`) | E2E 契約規格（What is the contract） | URL / Storage / Console / Lifecycle / Book schema / DOM 6 契約 |

**邊界**：SPEC-002 回答「目前實作了什麼元件」，SPEC-002a 回答「跨進程邊界的對外承諾是什麼」。元件實作可以重構，契約必須保持向後相容（除非主動 bump 版本）。

---

## 範圍與 UC 對應

本規格涵蓋下列 Use Case 的契約面向（UC 詳見 `docs/use-cases.md` v1.1）：

| UC | 名稱 | 對應契約 |
|----|------|---------|
| UC-01 | 提取 Readmoo 書庫 | §1 URL、§4 Lifecycle、§5 Book schema、§6 DOM |
| UC-02 | 連續提取去重 | §5 Book schema（id 唯一性） |
| UC-03 | CSV / JSON 匯出 | §2 Storage、§5 Book schema |
| UC-04 | JSON 匯入 | §2 Storage、§5 Book schema |
| UC-06 | Overview 顯示 | §1 URL（chrome-extension URL）、§2 Storage、§5 Book schema |

UC-05（搜尋篩選）與 UC-07（Tag 管理）的契約聚焦於 UI 與 tag schema，由 SPEC-003（待建）涵蓋。

---

## 契約結構標準

每個契約章節（§1 ~ §6）必須包含以下項目，缺一不可：

| 項目 | 用途 | 形式 |
|------|------|------|
| **Name** | 契約名稱與適用範圍說明 | Markdown 段落 |
| **Source of Truth** | 契約權威來源與引用點清單 | 表格（檔案 / 行號 / 角色） |
| **契約定義** | 契約核心內容 | JSON Schema、Mermaid diagram、或結構化表格 |
| **變更影響** | 違反契約時的下游影響 | Markdown 段落（誰會壞、怎麼壞） |
| **Grep 驗證** | 確認契約常數對齊的可執行指令 | 程式碼區塊（可直接複製執行） |

**Why（為何強制結構標準）**：6 個契約由不同 sub-ticket 撰寫，沒有結構標準會導致風格不一、查詢不便；統一結構讓讀者可依固定位置定位資訊（grep 驗證指令永遠在最後一節）。

---

## 6 契約導航

| § | 契約 | 對應 sub-ticket | 撰寫狀態 |
|---|------|----------------|---------|
| §1 | URL 與 SPA 路由 | [W5-003.1](../../work-logs/v0/v0.19/v0.19.0/tickets/0.19.0-W5-003.1.md) | completed |
| §2 | Storage key 與 schema | [W5-003.2](../../work-logs/v0/v0.19/v0.19.0/tickets/0.19.0-W5-003.2.md) | completed |
| §3 | Console 訊息與事件格式 | [W5-003.3](../../work-logs/v0/v0.19/v0.19.0/tickets/0.19.0-W5-003.3.md) | completed |
| §4 | Lifecycle 與步驟順序 | [W5-003.4](../../work-logs/v0/v0.19/v0.19.0/tickets/0.19.0-W5-003.4.md) | pending |
| §5 | Book schema v1.1 model | [W5-003.5](../../work-logs/v0/v0.19/v0.19.0/tickets/0.19.0-W5-003.5.md) | pending |
| §6 | DOM 提取選擇器 | [W5-003.6](../../work-logs/v0/v0.19/v0.19.0/tickets/0.19.0-W5-003.6.md) | pending |

---

## §1 URL 與 SPA 路由契約

### Name

定義 Chrome Extension 與 Readmoo 平台之間所有 URL 邊界的契約，涵蓋 content script 注入範圍、page detector 偵測規則、SPA hash 路由處理、chrome-extension URL（Overview 頁）、以及 E2E 測試的 fixture URL。

**適用範圍**：所有與 URL 相關的 production code 與 E2E 測試。修改 Readmoo URL 結構、`manifest.json` matches、page detector 邏輯前必須先更新本契約。

### Source of Truth

| 角色 | 檔案 | 行號 | 內容 |
|------|------|------|------|
| Readmoo 真實 URL（user-facing） | `docs/bookstores/readmoo.md` | §基本資訊 / §測試目標 URL | 官方首頁 / 書庫頁 / 閱讀器 / 帳號設定 |
| Content Script matches | `manifest.json` | L20-23 | `*://*.readmoo.com/*`、`*://readmoo.com/*` |
| Host permissions | `manifest.json` | L47-49 | `*://*.readmoo.com/*` |
| Web accessible resources matches | `manifest.json` | L57-60 | `*://*.readmoo.com/*` |
| Options page（Overview） | `manifest.json` | L63 | `src/overview/overview.html` |
| Page hostname 偵測 | `src/content/detectors/page-detector.js` | L55 | `hostname.includes('readmoo.com')` |
| Page type 偵測規則 | `src/content/detectors/page-detector.js` | L73-90 | `library` / `shelf` / `reader` / `unknown` 分類 |
| 可提取頁面定義 | `src/content/detectors/page-detector.js` | L132-134 | `isReadmooPage && ['library', 'shelf'].includes(pageType)` |
| URL 變更監聽 | `src/content/detectors/page-detector.js` | L142-232 | `onUrlChange` + MutationObserver |
| E2E Fixture URL | `tests/e2e/browser/helpers/extraction-flow.js` | L34 | `FIXTURE_URL = 'https://readmoo.com/library'` |
| Overview URL pattern | `tests/e2e/browser/extraction-pipeline.e2e.test.js` | L204 | `chrome-extension://${extensionId}/src/overview/overview.html` |
| SPA hash 路由規格 | `docs/bookstores/readmoo.md` | §SPA 路由 | Hash-based SPA（`#/library`）處理規則 |

### 契約定義

#### 1.1 Readmoo 真實 URL 表

| 用途 | URL | 登入需求 | 是否注入 CS |
|------|-----|---------|-----------|
| 官方首頁 | `https://readmoo.com/` | 否 | 是 |
| 書庫頁（提取主目標） | `https://read.readmoo.com/#/library` | 是 | 是 |
| 閱讀器頁（單書） | `https://read.readmoo.com/reader/{book-id}` | 是 | 是 |
| 閱讀器 API（DOM dummy） | `https://readmoo.com/api/reader/{book-id}` | — | 是 |
| 帳號設定 | `https://member.readmoo.com/` | 是 | 是 |

**核心契約**：書庫提取主目標 URL 為 `https://read.readmoo.com/#/library`（**SPA hash 路由**），非 `https://readmoo.com/`（首頁無書庫資料）。

#### 1.2 Content Script 注入規則（manifest.json）

```json
{
  "content_scripts": [
    {
      "matches": ["*://*.readmoo.com/*", "*://readmoo.com/*"],
      "js": ["src/content/content-modular.js"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ]
}
```

**注入時機**：`document_idle`（DOM 載入完成後）。

**涵蓋範圍**：

| URL pattern | 命中第 1 條（`*.readmoo.com`） | 命中第 2 條（`readmoo.com`） | 結論 |
|------------|---------------------------|---------------------------|------|
| `https://readmoo.com/*` | 否（subdomain 為空） | 是 | 注入 |
| `https://read.readmoo.com/*` | 是 | 否 | 注入 |
| `https://member.readmoo.com/*` | 是 | 否 | 注入 |
| `https://next.readmoo.com/*` | 是 | 否 | 注入（W6-012.9.4 驗證：未登入 redirect 後變 next 子網域） |
| 其他網域 | 否 | 否 | 不注入 |

#### 1.3 Page Detector 偵測規則

`src/content/detectors/page-detector.js` 兩階段偵測：

**階段 1：是否為 Readmoo 頁面**（`detectReadmooPage`, L53-66）：

```javascript
isReadmooPage = location.hostname && location.hostname.includes('readmoo.com')
```

**階段 2：頁面類型分類**（`detectPageType`, L73-90）：

| 條件（OR） | 分類 | 範例 URL |
|-----------|------|---------|
| `url.includes('/library')` OR `pathname.includes('/library')` | `library` | `https://read.readmoo.com/#/library` |
| `url.includes('/shelf')` OR `pathname.includes('/shelf')` | `shelf` | `https://read.readmoo.com/#/shelf` |
| `url.includes('/book/')` OR `pathname.includes('/book/')` OR `url.includes('/api/reader/')` OR `pathname.includes('/api/reader/')` | `reader` | `https://readmoo.com/api/reader/210017268000101` |
| 以上皆否 | `unknown` | `https://readmoo.com/`（首頁） |

**關鍵契約**：條件用 `url.includes()` **OR** `pathname.includes()` 雙重檢查。**Why**：SPA hash 路由（`#/library`）的 `pathname` 為 `/`，hash 在 `location.href` 中而不在 `pathname` 中；若只查 pathname 會誤判 unknown（W1-001.2 SPA hash 路由誤判事件根因）。

**可提取頁面範圍**（`isExtractablePage`, L132-134）：

```javascript
isExtractablePage = isReadmooPage && ['library', 'shelf'].includes(pageType)
```

即只有 `library` 與 `shelf` 兩種頁面類型會觸發提取流程。

#### 1.4 SPA Hash 路由處理規則

Readmoo 書庫頁採 Hash-based SPA（URL 含 `#/library`）。Content script 處理規則：

| 場景 | 觸發機制 | 對應 src 行 |
|------|---------|------------|
| 初次載入 | `content-modular.js` 啟動時呼叫 `detectReadmooPage()` | `page-detector.js#detectReadmooPage` L53-66 |
| URL hash 變化 | MutationObserver 偵測 DOM 變化，間接捕捉 `location.href` 變化 | `page-detector.js#onUrlChange` L142-232 |
| DOM 動態載入 | 提取流程等待 `.library-item` 出現 | `readmoo-adapter.js#waitForBookElements`（詳見 §6） |

**SPA 路由變更日誌契約**：URL 變更時 console 輸出 `URL 變更檢測:` 字面（page-detector.js L178），格式為：

```javascript
console.debug('URL 變更檢測:', { from, to, oldStatus, newStatus })
```

**警告**：MutationObserver 不直接監聽 `hashchange` 事件，而是觀察 DOM 子節點變動後比對 `location.href`。極端情況下純 hash 變更（無 DOM 變化）可能漏觸發。詳見 W6-012.9.4 ANA。

#### 1.5 Chrome-extension URL（Overview 頁）

| 角色 | URL pattern |
|------|------------|
| Options page（manifest 定義） | `chrome-extension://{extensionId}/src/overview/overview.html` |
| Web accessible resources（注入用） | `chrome-extension://{extensionId}/assets/*`、`chrome-extension://{extensionId}/src/overview/overview.html` |
| E2E 測試導航 | 同 Options page pattern |

**Why path 是 `src/overview/`**：manifest 引用 source path 而非 build output path。實際載入 unpacked extension 時，`build/development/manifest.json` 內容相同，但 build 過程會把 `src/overview/overview.html` 複製到 build 目錄維持 path 結構。

#### 1.6 E2E Fixture URL（與真實 URL 的差異）

| 角色 | URL | 路由形式 |
|------|-----|---------|
| 真實書庫 | `https://read.readmoo.com/#/library` | Hash route |
| E2E Fixture | `https://readmoo.com/library` | Path route |

**Why 差異**：E2E 測試（`extraction-flow.js`）採 Puppeteer request interception 將 fixture HTML 服務於任意 readmoo.com URL，選用 path route 避免 hash route 觸發 SPA 行為混淆測試。`manifest.json` matches 同時涵蓋 path 與 hash，兩種 URL 都會觸發 CS 注入，因此 fixture URL 切換不影響 CS 注入契約。

**Consequence**：E2E 測試**無法直接驗證 SPA hash 路由偵測邏輯**。SPA hash 行為需透過實機驗證（`docs/bookstores/readmoo.md` MCP E2E Checklist Step 2-3）覆蓋。

### 變更影響

| 變更內容 | 影響 |
|---------|------|
| 修改 `manifest.json` matches | Content script 注入範圍變動，可能漏注入或誤注入；必須同步更新 §1.2 表格與 page-detector 測試 fixture |
| 修改 page-detector `detectPageType` | 提取觸發條件變動；必須同步更新 §1.3 規則表與 e2e 測試 PROGRESS_TO_STATUS（若新增 pageType） |
| Readmoo 改 URL 結構（例如棄用 hash route） | §1.1 與 §1.3 同步更新；page-detector 雙重 includes 邏輯可能需簡化 |
| 修改 `FIXTURE_URL` | §1.6 同步更新；確認新 URL 仍命中 manifest matches |
| 新增 chrome-extension 頁面（如 popup.html） | 在 §1.5 增列；確認 `web_accessible_resources` 是否需更新 |

### Grep 驗證

每次修改本契約後執行以下指令確認 source code 與規格一致：

```bash
# 1.1 真實 URL：確認 docs/bookstores/readmoo.md 與本規格一致
grep -E "read.readmoo.com/#/library|readmoo.com/api/reader" docs/bookstores/readmoo.md

# 1.2 manifest matches：確認 manifest.json matches 與規格表一致
grep -A2 '"matches"' manifest.json | head -20

# 1.3 page detector 規則：確認三類 page type 偵測邏輯與規格一致
grep -E "pageType|'library'|'shelf'|'reader'|'unknown'" src/content/detectors/page-detector.js | head -30

# 1.4 SPA hash log：確認 URL 變更檢測 log 字面與規格一致
grep -n "URL 變更檢測" src/content/detectors/page-detector.js

# 1.5 Overview URL：確認 manifest options_page 與 e2e 測試引用一致
grep -E "options_page|overview.html" manifest.json
grep -E "overview.html" tests/e2e/browser/extraction-pipeline.e2e.test.js

# 1.6 Fixture URL：確認 e2e helper 引用與規格一致
grep "FIXTURE_URL" tests/e2e/browser/helpers/extraction-flow.js
```

**驗證標準**：每條 grep 指令應命中本規格列出的引用點且無新增未列出的硬編碼點。若新增硬編碼，必須補入本契約 Source of Truth 表格。

---

## §2 Storage key 與 schema 契約

### Name

定義 Chrome Extension 使用 `chrome.storage.local` 的所有 key 命名、value schema、雙形態容錯規則、配額管理、與 schema 演進 migration 機制。

**適用範圍**：所有讀寫 `chrome.storage.local` 的 production code、E2E 測試、migration script。新增 / 修改 storage key 前必須先更新本契約。

### Source of Truth

| 角色 | 檔案 | 行號 | 內容 |
|------|------|------|------|
| 核心 STORAGE_KEYS（書籍/類別/標籤/版本） | `src/storage/adapters/tag-storage-adapter.js` | L24-29 | 4 個核心 key 集中定義 |
| 常數定義（READMOO_BOOKS） | `src/background/constants/module-constants.js` | L521 | 統一常數匯出 |
| 配額閾值 | `src/storage/adapters/tag-storage-adapter.js` | L31-39 | MAX_STORAGE_SIZE + QUOTA_THRESHOLDS |
| readmoo_books 雙形態容錯讀取 | `src/storage/adapters/tag-storage-adapter.js` | L128-135 | loadBooks 雙形態解析 |
| Book schema 版本常數 | `src/data-management/BookSchemaV2.js` | （L: SCHEMA_VERSION = '3.0.0'） | 當前 Book schema 版本 |
| cover-to-reader migration | `src/data-management/migration/cover-to-reader.js` | L33 / L260+ | BACKUP_KEY + migrate flow |
| v1-to-v2 migration | `src/data-management/migration/v1-to-v2.js` | L251 | 舊版升級 |
| E2E storage helper | `tests/e2e/browser/helpers/storage-reader.js` | L23 / L64-73 | STORAGE_KEY + 雙形態容錯讀取 |
| Service Worker retry 狀態 | `src/background/domains/data-management/services/RetryCoordinator.js` | L24 | retryCoordinator_state key |
| Tab 狀態追蹤 | `src/background/domains/page/services/tab-state-tracking-service.js` | L206 | tabStates / tabHistory keys |
| 同步 metadata | `src/background/domains/data-management/services/sync-metadata-manager.js` | L24 | SYNC_METADATA / USER_SETTINGS / LIBRARY_VERSION |
| 跨裝置同步 ID 演進歷程 | `docs/bookstores/readmoo.md` | §ID 演進歷程 | cover-XXX → reader-{privacyBookId} 遷移背景 |

### 契約定義

#### 2.1 Storage key 完整清單

**核心 key**（書籍提取與標籤管理）：

| Key | 型別 | 用途 | 來源 |
|-----|------|------|------|
| `readmoo_books` | Object \| Array | 書籍資料容器（詳見 §2.2 雙形態） | `tag-storage-adapter.js#STORAGE_KEYS.READMOO_BOOKS` |
| `tag_categories` | Array | 標籤類別清單 | `tag-storage-adapter.js#STORAGE_KEYS.TAG_CATEGORIES` |
| `tags` | Array | 標籤清單 | `tag-storage-adapter.js#STORAGE_KEYS.TAGS` |
| `schema_version` | String | 當前 Book schema 版本（例 `"3.1.0"`） | `BookSchemaV2.SCHEMA_VERSION` + migration |
| `migration_backup_v3_1` | Object | cover-to-reader migration 備份 | `cover-to-reader.js#BACKUP_KEY` L33 |

**輔助 key**（內部狀態與同步）：

| Key | 型別 | 用途 | 來源 |
|-----|------|------|------|
| `retryCoordinator_state` | Object | SW 重啟後的 retry queue / circuit breaker 狀態 | `RetryCoordinator.js` L24 |
| `tabStates` | Object | Tab 提取狀態追蹤 | `tab-state-tracking-service.js` L206 |
| `tabHistory` | Array | Tab 切換歷史 | `tab-state-tracking-service.js` L206 |
| `SYNC_METADATA` | Object | 跨裝置同步元資料 | `sync-metadata-manager.js#STORAGE_KEYS.SYNC_METADATA` |
| `USER_SETTINGS` | Object | 用戶設定 | `sync-metadata-manager.js#STORAGE_KEYS.USER_SETTINGS` |
| `LIBRARY_VERSION` | String | 書庫版本追蹤 | `sync-metadata-manager.js#STORAGE_KEYS.LIBRARY_VERSION` |

#### 2.2 readmoo_books 容器 JSON Schema

`readmoo_books` 採**雙形態**設計（歷史相容）：

**形態 A（物件容器，提取流程預設）**：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "readmoo_books (Object 形態)",
  "type": "object",
  "required": ["books"],
  "properties": {
    "books": {
      "type": "array",
      "items": { "$ref": "#/definitions/Book" },
      "description": "書籍陣列，每本書 schema 見 §5"
    },
    "extractionTimestamp": {
      "type": "string",
      "format": "date-time",
      "description": "提取完成時間（ISO 8601）"
    },
    "extractionCount": {
      "type": "integer",
      "minimum": 0,
      "description": "本次提取書籍總數"
    }
  }
}
```

**形態 B（直接陣列，部分舊路徑寫入）**：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "readmoo_books (Array 形態)",
  "type": "array",
  "items": { "$ref": "#/definitions/Book" },
  "description": "書籍陣列（無 metadata wrapper），每本書 schema 見 §5"
}
```

**Book 物件 schema**：詳見 §5 Book schema v1.1 model 契約（避免重複定義）。

#### 2.3 雙形態容錯讀取規則

所有讀取 `readmoo_books` 的程式碼必須遵循以下順序：

```javascript
function loadBooks(raw) {
  if (raw === null || raw === undefined) return []
  if (Array.isArray(raw)) return raw                     // 形態 B
  if (raw.books && Array.isArray(raw.books)) return raw.books  // 形態 A
  return []
}
```

**讀取規則**：

| Step | 判定 | 處理 |
|------|------|------|
| 1 | `raw == null` | 回傳 `[]`（無資料） |
| 2 | `Array.isArray(raw)` | 回傳 `raw`（形態 B） |
| 3 | `raw.books` 是陣列 | 回傳 `raw.books`（形態 A） |
| 4 | 以上皆否 | 回傳 `[]`（格式異常 fallback） |

**已知雙形態實作**：

| 位置 | 行號 | 角色 |
|------|------|------|
| `src/storage/adapters/tag-storage-adapter.js#loadBooks` | L128-135 | 核心讀取 helper |
| `tests/e2e/browser/helpers/storage-reader.js#readBooksFromStorage` | L64-73 | E2E 測試讀取 helper |

**寫入規則**（`tag-storage-adapter.js#saveBooksWrapper` L137-145）：

```javascript
// 保留原始容器結構：原本為形態 A 則回寫形態 A，否則寫形態 B
async function saveBooksWrapper(books) {
  const raw = await loadFromStorage(STORAGE_KEYS.READMOO_BOOKS)
  if (raw && !Array.isArray(raw) && raw.books) {
    await saveToStorage({ [STORAGE_KEYS.READMOO_BOOKS]: { ...raw, books } })
  } else {
    await saveToStorage({ [STORAGE_KEYS.READMOO_BOOKS]: books })
  }
}
```

**契約**：新增寫入路徑必須採同一保留原始結構策略，避免覆寫使形態退化。

#### 2.4 配額管理規則

**配額上限與閾值**（`tag-storage-adapter.js` L31-39）：

| 常數 | 值 | 用途 |
|------|----|------|
| `MAX_STORAGE_SIZE` | 5,242,880 (5MB) | chrome.storage.local 上限 |
| `QUOTA_THRESHOLDS.WARNING` | 0.8 (80%) | 顯示警告 |
| `QUOTA_THRESHOLDS.AUTO_CLEANUP` | 0.9 (90%) | 觸發自動清理（保留近期資料） |
| `QUOTA_THRESHOLDS.BLOCK` | 0.95 (95%) | 阻擋新寫入 |

**配額層級回傳**（`checkQuotaLevel` L102-116）：

```javascript
{ level: 'normal' | 'warning' | 'auto_cleanup' | 'blocked', usageRatio: 0.0-1.0 }
```

**契約**：寫入大量資料前必須先呼叫 `checkQuotaLevel()`；level=`blocked` 時必須拒絕寫入並回傳明確錯誤訊息給用戶。

#### 2.5 Schema 演進與 Migration 機制

**版本歷程**：

| Schema 版本 | 標記 | Book.id 格式 | Migration 來源 |
|------------|------|-------------|---------------|
| v1.x | （無 schema_version） | `cover-{slug}` | （pre-history） |
| v2.0.0 / 3.0.0 | `'3.0.0'` | 過渡：仍含 cover-XXX | `v1-to-v2.js`（W6-012.2 之前） |
| **3.1.0**（當前） | `'3.1.0'` | `reader-{privacyBookId}` | `cover-to-reader.js`（W6-012.2.2.2） |

**當前 SCHEMA_VERSION**：`'3.0.0'`（`BookSchemaV2.SCHEMA_VERSION`）；但 cover-to-reader migration 觸發後寫入 `'3.1.0'`。

**Migration 觸發機制**（`cover-to-reader.js` L260-290 流程）：

```
install-handler.onUpdated 偵測版本升級
  │
  ▼
讀取 ['schema_version', 'readmoo_books']
  │
  ├── schema_version === '3.1.0'? → 跳過（已遷移）
  │
  ├── readmoo_books 不存在? → 直接寫 schema_version='3.1.0'
  │
  └── 執行遷移：
      1. 備份 readmoo_books → migration_backup_v3_1
      2. 套用 5 案例合併規則（詳見 docs/bookstores/readmoo.md §4 遷移流程）
      3. 寫入 readmoo_books + schema_version='3.1.0'
      4. 移除 migration_backup_v3_1
```

**5 案例合併規則**（cover-to-reader migration step）：

| 案例 | 觸發條件 | 處理 |
|------|---------|------|
| 1. 正常遷移 | identifiers.privacyBookId 存在 | 改寫 id 為 `reader-{privacyBookId}` |
| 2. privacyBookId 缺失 | 無 privacyBookId | 保留舊 `cover-XXX` id + 標記 `manual_review` |
| 3. cover-openbook 集體碰撞 | 多本書共用 ID | 以 secondary key（title+author）去重後再遷移 |
| 4. 同 privacyBookId 多筆 | 重複 ID | 取新並集 tag 後合併為單筆 |
| 5. cross-device sync 衝突 | （範圍外） | 由 follow-up ticket 處理 |

**Backup key 生命週期**：

| 階段 | `migration_backup_v3_1` 狀態 |
|------|----------------------------|
| Migration 開始前 | 不存在 |
| Migration 中 | 寫入備份 |
| Migration 成功 | 刪除（cleanup） |
| Migration 失敗 | 保留（供回滾） |
| 回滾觸發（`rollback()` L240-247） | 讀備份 → 還原 → 刪備份 |

**契約**：新增 schema 版本時必須建立新的 backup key（如 `migration_backup_v3_2`），並提供獨立的 forward + rollback function。

#### 2.6 Storage 讀寫者完整清單

**讀者**：

| 檔案 | 行號 | 讀取目的 |
|------|------|---------|
| `src/storage/adapters/tag-storage-adapter.js` | L128 | tag operation 前讀 readmoo_books |
| `src/background/messaging/popup-message-handler.js` | L385 / L750 | popup 查詢書籍數 / 清空前讀取 |
| `src/background/events/event-coordinator.js` | L588 | 提取完成後驗證 storage 寫入 |
| `src/overview/overview-page-controller.js` | L464 | overview 頁載入書籍清單 |
| `tests/e2e/browser/helpers/storage-reader.js` | L57-61 | E2E 測試斷言 |
| `src/data-management/migration/cover-to-reader.js` | L262 | migration 觸發判斷 |
| `src/data-management/migration/v1-to-v2.js` | L251 | migration 觸發判斷 |

**監聽者**（`chrome.storage.onChanged` 事件監聽，不主動讀取）：

| 檔案 | 行號 | 監聽目的 |
|------|------|---------|
| `src/popup/popup.js` | L785-787 | 偵測提取完成後 readmoo_books 變更，依新值更新 UI |

**寫者**：

| 檔案 | 行號 | 寫入時機 |
|------|------|---------|
| `src/storage/adapters/tag-storage-adapter.js` | L137-145 | saveBooksWrapper（保留容器結構） |
| `src/background/messaging/popup-message-handler.js` | L812 | popup 清空（remove） |
| `src/background/lifecycle/install-handler.js` | L322 | 安裝 / 升級時初始化 `readmoo_books: null` |
| `src/data-management/migration/cover-to-reader.js` | L286+ | migration 寫入新版資料 |
| `src/data-management/migration/v1-to-v2.js` | （migration step） | migration 寫入 v2 資料 |

**契約**：新增寫者必須使用 `saveBooksWrapper`（保留容器結構），不可繞過直接 `chrome.storage.local.set({ readmoo_books: books })`。

### 變更影響

| 變更內容 | 影響 |
|---------|------|
| 新增 storage key | §2.1 補列；確認 5MB 配額不會被擠壓 |
| 改變 readmoo_books 容器形態（例棄用形態 B） | §2.2 / §2.3 同步更新；所有讀取者（7 個）必須一次性升級；E2E helper 同步 |
| 修改 schema_version（例 3.1.0 → 3.2.0） | §2.5 補新 migration script + 新 backup key；提供 forward + rollback |
| 修改配額閾值 | §2.4 更新；UI 警告訊息門檻同步 |
| 修改 BookSchemaV2.SCHEMA_VERSION | §5 Book schema 同步；確認既有資料相容性 |

### Grep 驗證

```bash
# 2.1 核心 key 集中定義（4 個 + migration backup）
grep -n "READMOO_BOOKS\|TAG_CATEGORIES\|TAGS\|SCHEMA_VERSION" src/storage/adapters/tag-storage-adapter.js | head -10
grep -n "BACKUP_KEY" src/data-management/migration/cover-to-reader.js

# 2.2/2.3 雙形態容錯讀取
grep -A5 "function loadBooks" src/storage/adapters/tag-storage-adapter.js
grep -A8 "雙形態容錯" tests/e2e/browser/helpers/storage-reader.js

# 2.4 配額閾值
grep -E "MAX_STORAGE_SIZE|QUOTA_THRESHOLDS" src/storage/adapters/tag-storage-adapter.js | head -5

# 2.5 Schema 版本與 migration
grep -E "SCHEMA_VERSION = " src/data-management/BookSchemaV2.js
grep -n "schema_version.*3.1.0\|TARGET_SCHEMA_VERSION" src/data-management/migration/cover-to-reader.js

# 2.6 所有 readmoo_books 讀寫者
grep -rln "readmoo_books" src/ tests/e2e/ --include="*.js" | sort -u
```

**驗證標準**：每條 grep 指令應命中本規格列出的引用點；新增讀寫者必須補入 §2.6 表格。

---

## §3 Console 訊息與事件格式契約

### Name

定義 Chrome Extension 跨進程通訊（content script ↔ background SW ↔ popup）的 message envelope 結構、v2.0 事件命名規範、核心 E2E message types、與 console log 前綴規則。

**適用範圍**：所有 `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage` 呼叫、事件系統發送/訂閱、用於 E2E 觀察的 console log。新增 message type 或 console log 前綴前必須先更新本契約。

**範圍邊界**：本契約只覆蓋 E2E 流程涉及的核心 message types 與結構化 log 前綴；專屬於 export / sync / 內部 telemetry 等場景的事件類型由各自 spec 文件管理。

### Source of Truth

| 角色 | 檔案 | 行號 | 內容 |
|------|------|------|------|
| v2.0 事件命名規範 | `src/core/events/event-type-definitions.js` | L34-77 | EVENT_TYPE_CONFIG（DOMAINS / PLATFORMS / ACTIONS / STATES）+ NAMING_PATTERN regex |
| 領域 × 平台 mapping | `src/core/events/event-type-definitions.js` | L82-91 | DOMAIN_PLATFORM_MAPPING |
| 平台 × 動作 mapping | `src/core/events/event-type-definitions.js` | L96+ | PLATFORM_ACTION_MAPPING |
| 核心 message router | `src/background/messaging/message-router.js` | L245-284 | routeMessage switch（PING / HEALTH_CHECK / GET_STATUS / EVENT.EMIT / EVENT.STATS / EVENT_SYSTEM_STATUS_CHECK） |
| Content script PING handler | `src/content/content-modular.js` | L314 | content-side PING 回應 |
| Content script START_EXTRACTION handler | `src/content/content-modular.js` | L296 | 提取觸發入口 |
| Popup START_EXTRACTION sender | `src/background/messaging/popup-message-handler.js` | L630 | popup 觸發提取 |
| SW SYSTEM.SHUTDOWN 廣播 | `src/background/messaging/content-message-handler.js` | L581 | SW 關閉時通知 content scripts |
| 頁面檢測 console log | `src/content/detectors/page-detector.js` | L63 | `📍 頁面檢測:` 前綴 |
| URL 變更 console log | `src/content/detectors/page-detector.js` | L178 | `URL 變更檢測:` 前綴 |
| 全域 SW 錯誤前綴 | `src/background/` | （多處） | `[SW] 未處理的 Promise 拒絕:` / `[SW] 未捕獲錯誤:` |
| 提取診斷前綴 | `src/background/`、`tests/e2e/` | （多處） | `[DIAG] performActualExtraction 收到資料` 等 |
| Logger Fallback | （多處） | （多處） | `[Logger Fallback]` 前綴 |

### 契約定義

#### 3.1 v2.0 事件命名規範（DOMAIN.PLATFORM.ACTION.STATE）

**格式**：四層大寫底線分隔，每層 ≤ 20 字元，總長 ≤ 100 字元。

**Regex**：`/^[A-Z][A-Z_]*\.[A-Z][A-Z_]*\.[A-Z][A-Z_]*\.[A-Z][A-Z_]*$/`

**九大領域（DOMAINS）**：

| 領域 | 用途 |
|------|------|
| `SYSTEM` | 系統管理（啟動 / 關閉 / 健康） |
| `PLATFORM` | 平台管理（多書城協調） |
| `EXTRACTION` | 資料提取主流程 |
| `DATA` | 資料管理（儲存 / 載入 / 驗證） |
| `MESSAGING` | 通訊訊息層 |
| `PAGE` | 頁面狀態與導航 |
| `UX` | 使用者體驗事件 |
| `SECURITY` | 安全驗證 |
| `ANALYTICS` | 統計分析 |

**八大平台（PLATFORMS）**：`READMOO` / `KINDLE` / `KOBO` / `BOOKS_COM` / `BOOKWALKER` / `UNIFIED`（跨平台）/ `MULTI`（多平台協調）/ `GENERIC`（平台無關）

**核心動作（ACTIONS）**：`INIT` / `START` / `STOP` / `EXTRACT` / `SAVE` / `LOAD` / `DETECT` / `SWITCH` / `VALIDATE` / `PROCESS` / `SYNC` / `OPEN` / `CLOSE` / `UPDATE` / `DELETE` / `CREATE` / `RENDER`

**狀態（STATES）**：`REQUESTED` / `STARTED` / `PROGRESS` / `COMPLETED` / `FAILED` / `CANCELLED` / `TIMEOUT` / `SUCCESS` / `ERROR`

**範例合法事件名**：

| 事件名 | 解讀 |
|--------|------|
| `EXTRACTION.READMOO.EXTRACT.COMPLETED` | Readmoo 提取流程完成 |
| `ANALYTICS.EXTRACTION.COMPLETED` | 提取統計完成（簡化版三層命名） |
| `CONTENT.STATUS.READY` | Content script 就緒（內部簡化命名） |
| `SYSTEM.SHUTDOWN` | 系統關閉（雙層命名） |

**契約**：所有新事件名應通過 `event-type-definitions.js` 的 `validateEventName()` 驗證；不符合 v2.0 規範的簡化命名（如 `START_EXTRACTION`、`CONTENT.STATUS.READY`）視為**遺留命名**，僅核心 message types 保留，新增事件必須採用 v2.0 規範。

#### 3.2 核心 E2E Message Types

由 `message-router.js#routeMessage` 統一分派的核心 message types（routing switch L245-284）：

| Type | 來源 | 目標 | 用途 | 處理器 |
|------|------|------|------|--------|
| `PING` | popup / E2E test | content script / SW | readiness check | content-modular.js L314 / message-router.js L252 |
| `HEALTH_CHECK` | popup | SW | 健康檢查 | message-router.js L255 |
| `EVENT_SYSTEM_STATUS_CHECK` | popup / dev tool | SW | 事件系統狀態 | message-router.js L258 |
| `GET_STATUS` | popup | SW | 取得 SW 狀態 | message-router.js L261 |
| `EVENT.EMIT` | content / popup | SW | 事件廣播 | message-router.js L264 |
| `EVENT.STATS` | popup | SW | 事件統計 | message-router.js L267 |
| `START_EXTRACTION` | popup / E2E test | content script | 觸發提取 | content-modular.js L296 / popup-message-handler.js L630 |
| `CANCEL_EXTRACTION` | popup | content script | 取消提取 | （content-modular handler） |
| `SYSTEM.SHUTDOWN` | SW | content scripts | SW 關閉廣播 | content-message-handler.js L581 |

**Source routing**（`message-router.js#routeBySource` L295-322）：

| Sender | 識別方式 | 對應處理器 |
|--------|---------|-----------|
| content-script | `sender.tab && sender.tab.id` | `contentMessageHandler.handleMessage` |
| popup | `sender.url` 含 `popup.html` | `popupMessageHandler.handleMessage` |
| background | 內部呼叫 | `handleInternalMessage` |

未匹配來源回傳 `{ success: false, error: '未知的訊息來源' }`。

#### 3.3 Message Envelope JSON Schema

**Request envelope**（所有 `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage` 採用）：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MessageEnvelope (Request)",
  "type": "object",
  "required": ["type"],
  "properties": {
    "type": {
      "type": "string",
      "description": "Message type，使用核心 message types (§3.2) 或 v2.0 事件名 (§3.1)"
    },
    "data": {
      "description": "Message payload，型別依 type 而定",
      "type": ["object", "array", "string", "number", "boolean", "null"]
    },
    "source": {
      "type": "string",
      "enum": ["content-script", "popup", "background", "options-page"],
      "description": "選填；不提供時由 sender 推導"
    },
    "timestamp": {
      "type": "integer",
      "description": "選填；發送時間（Unix ms）"
    }
  }
}
```

**Response envelope**（`sendResponse` callback 與 `chrome.tabs.sendMessage` 回傳）：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MessageEnvelope (Response)",
  "type": "object",
  "required": ["success"],
  "properties": {
    "success": {
      "type": "boolean",
      "description": "處理結果"
    },
    "data": {
      "description": "成功時的回傳資料"
    },
    "error": {
      "type": "string",
      "description": "失敗時的錯誤訊息（success=false 時必填）"
    },
    "messageType": {
      "type": "string",
      "description": "原始 request type（diagnostics 用，message-router L279 自動帶入）"
    },
    "timestamp": {
      "type": "integer",
      "description": "回應時間（Unix ms）"
    }
  }
}
```

**契約**：

- Response `success=false` 時 `error` 必填且為人類可讀字串
- `messageType` 由 router 自動帶入，handler 不需手動填
- E2E test 應斷言 `success === true` 而非 `!response.error`，避免 undefined 漏斷

#### 3.4 結構化 Console Log 前綴規則

E2E 觀察依賴的結構化前綴：

| 前綴 | 模組 | 用途 | 範例 |
|------|------|------|------|
| `📍 頁面檢測:` | page-detector.js L63 | Readmoo 頁面偵測結果 | `📍 頁面檢測: Readmoo 頁面 (library)` |
| `URL 變更檢測:` | page-detector.js L178 | SPA URL 變化 | `console.debug('URL 變更檢測:', { from, to, ... })` |
| `[DIAG]` | extraction 流程多處 | 提取診斷訊息 | `[DIAG] performActualExtraction 收到資料` |
| `[SW] 未處理的 Promise 拒絕:` | SW 全域 handler | unhandledrejection | `[SW] 未處理的 Promise 拒絕: <error>` |
| `[SW] 未捕獲錯誤:` | SW 全域 handler | global error handler | `[SW] 未捕獲錯誤: <error>` |
| `[Logger Fallback]` | logger 後備 | Logger 服務不可用時 | `[Logger Fallback] <msg>` |
| `[ErrorHandler]` | ErrorHandler | 錯誤處理過程 | `[ErrorHandler] Export error occurred:` |
| `[ERROR]` | 匯出 / 載入 | v2 匯出 / Chrome Storage 載入 | `[ERROR] v2 CSV 匯出失敗:` |
| `[tag-storage-adapter]` | tag-storage-adapter.js | 配額與並發控制 | `[tag-storage-adapter] mergeAllData blocked: quota exceeded` |
| `[UIDOMManager]` | UI DOM 管理 | DOM 操作失敗 | `[UIDOMManager] Failed to add event listener:` |
| `[DiagnosticModule]` | DiagnosticModule | 健康報告 | `[DiagnosticModule] Failed to generate health report:` |
| `❌ <名詞>失敗:` | 多處 console.error | 業務操作失敗 | `❌ 啟動提取流程失敗:` / `❌ URL 變更回調函數錯誤:` |

**契約**：

- 結構化前綴必須**完全相等**（含 emoji、空格、冒號）才視為合法 E2E 觀察點
- 修改前綴文字時必須同步更新本表 + 所有相關 E2E 觀察測試
- 新增前綴必須加入本表（避免散落硬編碼）

#### 3.5 Status string 集合

E2E 流程涉及的 status string（在 message data / event payload 中使用）：

| Status | 涵義 | 使用場景 |
|--------|------|---------|
| `success` | 操作成功 | response.success === true |
| `failed` | 操作失敗 | response.success === false |
| `progress` | 進行中 | extraction lifecycle 進度 |
| `completed` | 流程完成 | extraction lifecycle 完成 |
| `cancelled` | 已取消 | 用戶取消 |
| `timeout` | 已逾時 | 操作逾時 |
| `ready` | 已就緒 | content script 注入完成 |
| `error` | 錯誤狀態 | 異常分流 |

**對照 v2.0 STATES**：`REQUESTED` / `STARTED` / `PROGRESS` / `COMPLETED` / `FAILED` / `CANCELLED` / `TIMEOUT` / `SUCCESS` / `ERROR`（§3.1 第 9 種狀態）；event payload 用大寫，message response data 用小寫。

### 變更影響

| 變更內容 | 影響 |
|---------|------|
| 新增核心 message type | §3.2 補入；message-router.js routeMessage switch 新增 case；E2E test 確認新 type 不誤觸 default 分支 |
| 修改 message envelope schema | §3.3 更新；所有 sender / handler 同步調整；E2E 測試斷言更新 |
| 修改 v2.0 命名規範（DOMAINS / PLATFORMS 等） | §3.1 更新；既有事件名重新驗證；event-type-definitions.js 更新 mapping |
| 修改結構化 log 前綴 | §3.4 更新；對該前綴有依賴的 E2E 觀察測試同步調整 |
| 新增書城平台 | §3.1 PLATFORMS 新增；DOMAIN_PLATFORM_MAPPING 對齊 |

### Grep 驗證

```bash
# 3.1 v2.0 命名規範
grep -E "DOMAINS:|PLATFORMS:|ACTIONS:|STATES:|NAMING_PATTERN" src/core/events/event-type-definitions.js | head -10

# 3.2 核心 message router switch
grep -E "case 'PING'|case 'HEALTH_CHECK'|case 'GET_STATUS'|case 'EVENT.EMIT'|case 'EVENT.STATS'|case 'EVENT_SYSTEM_STATUS_CHECK'" src/background/messaging/message-router.js

# 3.2 content script handlers
grep -E "case 'START_EXTRACTION'|case 'PING'" src/content/content-modular.js

# 3.2 SYSTEM.SHUTDOWN 廣播
grep -n "SYSTEM.SHUTDOWN" src/background/messaging/content-message-handler.js

# 3.4 結構化 log 前綴（取樣）
grep -rn "頁面檢測:\|URL 變更檢測:\|\[DIAG\]\|\[SW\]\|\[Logger Fallback\]" src/ --include="*.js" | head -10

# 3.4 console.error 起手式分布（取樣，量大時用 head 限縮）
grep -roE "console\.(log|debug|info|warn|error)\(['\"][^'\"]+" src/ --include="*.js" | sort -u | wc -l
```

**驗證標準**：每條 grep 應命中本規格列出的引用點；新發現的硬編碼前綴 / message type 必須補入本契約對應子節。

---

## §4 Lifecycle 與步驟順序契約

> **撰寫者**：W5-003.4（pending）
>
> **預期範圍**：Mermaid sequenceDiagram（SW 啟動 → CS 注入 → 提取 → storage 寫入 → overview 顯示）/ 步驟順序表 / content script 注入時機規則 / 各步驟對應 src 檔案行號

（待 W5-003.4 撰寫）

---

## §5 Book schema v1.1 model 契約

> **撰寫者**：W5-003.5（pending）
>
> **預期範圍**：完整 v1.1 model JSON Schema / readingStatus 6 狀態 enum / Mermaid stateDiagram-v2 / progress → readingStatus auto-derive 規則 / 用戶覆寫優先級

（待 W5-003.5 撰寫）

---

## §6 DOM 提取選擇器契約

> **撰寫者**：W5-003.6（pending）
>
> **預期範圍**：.library-item DOM 結構樹 / 每欄位 selector + fallback 表 / Book ID 來源優先級 / cover 過濾規則 / 作者欄位 source limitation / src/content/adapters/readmoo-adapter.js 引用

（待 W5-003.6 撰寫）

---

## 跨契約引用矩陣

矩陣記錄每個契約引用其他契約的具體位置。**Why**：契約之間有隱性依賴（例如 Lifecycle §4 必然引用 URL §1.1 的 page detector 結果決定何時注入 CS），無矩陣導讀者無法判斷修改 §X 是否影響 §Y。

**讀法**：橫軸（被引用方）× 縱軸（引用方）。Cell 內容為「§X.Y 段落」+ 簡述引用關係。

|  | →§1 URL | →§2 Storage | →§3 Console | →§4 Lifecycle | →§5 Book | →§6 DOM |
|--|---------|-------------|-------------|----------------|----------|---------|
| **§1 URL ↓** | — | （無） | （無） | §1.SPA hash 變化觸發 §4 路由偵測 step | （無） | §1.matches 決定 §6 DOM 提取範圍 |
| **§2 Storage ↓** | （無） | — | （無） | §2.write 完成觸發 §4 Step "storage 寫入完成" 事件 | §2.value 結構 = §5 Book schema array 包裝 | （無） |
| **§3 Console ↓** | §3.訊息含 §1 URL pattern 識別 | §3.訊息含 §2 storage key 確認 | — | §3.訊息以 §4 step boundary 為分隔 | §3.訊息含 §5 book.id 識別 | §3.提取訊息含 §6 selector 命中 count |
| **§4 Lifecycle ↓** | §4.Step "CS 注入" 引用 §1.matches | §4.Step "storage 寫入" 引用 §2.key | §4.每 step 對應 §3 log 前綴 | — | §4.Step "提取" 產出 §5 Book object | §4.Step "提取" 使用 §6 selectors |
| **§5 Book ↓** | （無） | §5.序列化形式定義於 §2.readmoo_books schema | （無） | §5.derive 邏輯位於 §4 Step "正規化" | — | §5.id 來源優先級 = §6 Book ID 策略 |
| **§6 DOM ↓** | §6.URL 命中規則 = §1.matches | （無） | §6.selector 命中 log 對應 §3.提取訊息 | §6.提取時機 = §4 Step "提取" | §6.selector → §5 欄位映射 | — |

**矩陣填寫規則**：

| 規則 | 說明 |
|------|------|
| 同契約內 | cell = `—`（diagonal） |
| 無引用 | cell = `（無）` |
| 有引用 | cell = `§X.具體子節` + 一句話描述 |
| 雙向引用 | 兩格各自填寫，描述可不同（不同視角） |

**驗收條件**：sub-ticket 撰寫各契約時，必須同步檢查並更新對應行（橫軸）；本 ticket 完成階段三審查時再校對整體一致性。

---

## 變更歷史

| 版本 | 日期 | 變更內容 |
|------|------|---------|
| 1.0 | 2026-05-25 | 初始建立（W5-003）：骨架 + 6 契約導航 + 契約結構標準 + 跨契約引用矩陣 |
