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
| §2 | Storage key 與 schema | [W5-003.2](../../work-logs/v0/v0.19/v0.19.0/tickets/0.19.0-W5-003.2.md) | pending |
| §3 | Console 訊息與事件格式 | [W5-003.3](../../work-logs/v0/v0.19/v0.19.0/tickets/0.19.0-W5-003.3.md) | pending |
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

> **撰寫者**：W5-003.2（pending）
>
> **預期範圍**：chrome.storage.local 完整 key 清單 / 每 key JSON Schema / schema_version 演進規則 / migration 觸發條件 / tests/e2e helpers/storage-reader.js 引用

（待 W5-003.2 撰寫）

---

## §3 Console 訊息與事件格式契約

> **撰寫者**：W5-003.3（pending）
>
> **預期範圍**：console log 前綴規則（`[DIAG]`、`頁面檢測` 等）/ event-system message JSON Schema / status string enum / src/event-system 引用

（待 W5-003.3 撰寫）

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
