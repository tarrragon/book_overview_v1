# 新書城適配器開發指南

本文件說明如何為 Book Overview Chrome Extension 新增一個書城平台的支援。涵蓋 DOM 勘查、適配器實作、Registry 註冊、manifest 更新與測試要求。

---

## 1. 架構概覽

```
PlatformRegistry.detect(url)
        │
        ├── hostname 比對 → 找到 PlatformConfig
        │
        └── config.adapterFactory()(options) → adapter 實例
                │
                └── 繼承 PlatformAdapterInterface（17 個抽象方法）
```

| 元件 | 路徑 | 職責 |
|------|------|------|
| PlatformRegistry | `src/content/platform/platform-registry.js` | 書城配置清單 + URL 偵測路由 |
| PlatformAdapterInterface | `src/content/platform/platform-adapter-interface.js` | 抽象介面（17 個方法契約） |
| adapter-utils | `src/content/platform/adapter-utils.js` | 共用工具函式（sanitize / URL 處理 / 文字清理） |
| page-detector | `src/content/detectors/page-detector.js` | 透過 PlatformRegistry 偵測當前頁面書城 |
| content-modular.js | `src/content/content-modular.js` | Content Script 入口，動態建立 adapter |
| BookSchemaV2 | `src/data-management/BookSchemaV2.js` | 資料模型（`source` 欄位自動從 PlatformRegistry 取值） |

**資料流**：Content Script 啟動 → page-detector 呼叫 `PlatformRegistry.detect(url)` → 建立對應 adapter → adapter 提取書籍資料 → 透過 ChromeEventBridge 傳送至 Background Service Worker → 寫入 `chrome.storage.local`。

---

## 2. 新增書城步驟 Checklist

以下為新增一個書城（以 `<store>` 代稱）的完整步驟。每步完成後勾選。

### Phase A：DOM 勘查與規格記錄

- [ ] **A1** 建立書城規格文件 `docs/bookstores/<store>.md`（依 §3 模板）
- [ ] **A2** 以 chrome-devtools-mcp 實機勘查目標書城 DOM 結構（依 §4 SOP）
- [ ] **A3** 記錄書籍容器 / 項目 / 各欄位選擇器 / 載入機制至規格文件

### Phase B：適配器實作

- [ ] **B1** 建立 `src/content/adapters/<store>-adapter.js`（依 §5 骨架模板）
- [ ] **B2** 實作 17 個 PlatformAdapterInterface 抽象方法
- [ ] **B3** 建立模組專屬 MessageDictionary（日誌訊息解耦 GlobalMessages）
- [ ] **B4** 匯出工廠函式 `create<Store>Adapter(options)` + 具名匯出 class

### Phase C：Registry 註冊與 manifest 更新

- [ ] **C1** 在 `src/content/platform/platform-registry.js` 的 `PLATFORM_CONFIGS` 新增書城配置
- [ ] **C2** 在 `manifest.json` 的 `content_scripts[0].matches` 與 `host_permissions` 加入新書城 URL pattern
- [ ] **C3** 執行 `npm run build:dev` 驗證 manifest-registry 一致性檢查通過

### Phase D：測試

- [ ] **D1** 撰寫 adapter 單元測試（§6 測試要求）
- [ ] **D2** 所有既有測試通過 `npm test`
- [ ] **D3** 以 chrome-devtools-mcp 實機驗證（安裝 unpacked → 導航 → 提取 → 驗證 storage）

---

## 3. 書城規格文件模板

路徑：`docs/bookstores/<store>.md`

必含章節（順序固定，對齊 `docs/bookstores/README.md`）：

```markdown
# <書城名稱> 書城資訊

實機勘查目標：<書城>書庫頁的 DOM 結構、載入機制與適配器開發基礎。

---

## 基本資訊

| 項目 | 值 |
|------|----|
| 平台名稱 | <書城顯示名稱> |
| 官方網址 | <官方首頁 URL> |
| 電子書庫頁 | <書庫頁 URL>（Content Script 提取目標） |
| 是否需登入 | 是/否 |
| 登入方式 | <帳密 / Google / Facebook / Apple 等> |
| 目標版本 | v<版本號> |

---

## 測試目標 URL

| 用途 | URL | 登入需求 |
|------|-----|---------|
| 書庫頁（提取目標） | <URL> | 是/否 |
| 閱讀器頁 | <URL> | 是/否 |

---

## 登入流程

（手動測試流程、2FA 注意事項、session 過期行為）

---

## Content Script 注入點

manifest `content_scripts.matches` 應涵蓋的 URL pattern：
- `*://*.<domain>/*`

---

## DOM 結構

### 書籍容器與項目

| 元素 | 選擇器 | 說明 |
|------|--------|------|
| 書籍容器 | | 所有書籍的父容器 |
| 單本書籍 | | 每本書的根元素 |
| 書名 | | |
| 作者 | | |
| 封面圖 | | |
| 閱讀進度 | | |

### 載入機制

（分頁按鈕 / infinite scroll / lazy load / 一次全載 — 記錄觀察結果）

---

## 常見 debug 觀察點

（SPA/MPA 判斷、API 端點、特殊 DOM 行為）
```

---

## 4. DOM 勘查 SOP

### 前置條件

- chrome-devtools-mcp 工具可用（session 啟動時 system-reminder 列出 `mcp__chrome-devtools__*`）
- 已準備目標書城的測試帳號（有購買書籍紀錄）

### 勘查步驟

| 步驟 | 操作 | 目的 |
|------|------|------|
| 1 | `mcp__chrome-devtools__navigate_page` 至書庫頁 | 確認 URL、觀察是否 redirect 至登入 |
| 2 | 手動完成登入 | 取得已認證 session |
| 3 | `mcp__chrome-devtools__take_snapshot` | 取得完整 DOM 結構 |
| 4 | 識別書籍容器與項目選擇器 | 用 `evaluate_script` 執行 `document.querySelectorAll` 測試候選選擇器 |
| 5 | 觀察載入機制 | 判斷分頁/scroll/lazy-load：捲動到底觀察是否有「載入更多」按鈕或自動追加 DOM |
| 6 | 逐一確認欄位選擇器 | 對每個欄位（書名/作者/封面/進度/ID）執行選擇器命中測試 |
| 7 | 記錄 source limitation | 若某欄位在 DOM 不存在（如 Readmoo 無作者），明確記錄 |
| 8 | 觀察 ID 來源 | 尋找穩定的書籍唯一識別符（DOM attribute、URL segment、API response） |
| 9 | 測試 SPA 路由行為 | hash / pushState / 整頁 reload — 影響 Content Script 重新注入策略 |

### 選擇器命中測試範例

```javascript
// 在 evaluate_script 中執行
(() => {
  const candidates = [
    '.book-item',
    '.bookshelf__book',
    '[class*="book"]',
    '[data-book-id]'
  ];
  return candidates.map(s => ({
    selector: s,
    count: document.querySelectorAll(s).length
  }));
})()
```

### 勘查產出

勘查完成後將結果寫入 `docs/bookstores/<store>.md`，須包含：

1. 各選擇器的命中數量與準確性
2. 載入機制的觀察結論（含測試用帳號的書籍總數作對照）
3. 無法取得的欄位列表及替代方案評估
4. Book ID 來源優先級表（參考 `docs/bookstores/readmoo.md` §Book ID 來源優先級）

---

## 5. Adapter 骨架模板

路徑：`src/content/adapters/<store>-adapter.js`

```javascript
/**
 * @fileoverview <StoreName> Adapter - <書城名稱>平台適配器
 * @version v1.0.0
 *
 * 資料來源勘查：docs/bookstores/<store>.md
 */

const PlatformAdapterInterface = require('../platform/platform-adapter-interface')
const { Logger } = require('src/core/logging/Logger')
const { MessageDictionary } = require('src/core/messages/MessageDictionary')

const adapterMessages = new MessageDictionary({
  // 依實際需求定義訊息 key（參考 books-com-tw-adapter.js 模式）
  STORE_INIT: '<書城>適配器初始化完成',
  STORE_EXTRACT_START: '開始提取書庫，初始書籍數：{count}',
  STORE_EXTRACT_DONE: '書庫提取完成，成功 {success} / 失敗 {fail}',
  STORE_BOOK_PARSE_FAILED: '單一書籍解析失敗：{reason}'
})

const PLATFORM_NAME = '<store>'  // 與 PlatformRegistry 配置的 name 一致
const LIBRARY_URL = '<書庫頁 URL>'
const VALID_HOSTNAME = '<hostname>'

const SELECTORS = {
  bookContainer: '',   // 填入勘查結果
  bookItem: '',
  bookTitle: '',
  bookAuthor: '',
  bookCover: '',
  bookProgress: ''
  // 依書城特性增減
}

class StoreAdapter extends PlatformAdapterInterface {
  constructor (options = {}) {
    super()
    this.platformName = PLATFORM_NAME
    this.options = options
    this.logger = new Logger('StoreAdapter', 'INFO', adapterMessages)
    this._stats = { totalExtracted: 0, successCount: 0, failCount: 0 }
    this.logger.info('STORE_INIT')
  }

  // === 平台識別（4 方法） ===

  getPlatformName () { return PLATFORM_NAME }
  getLibraryUrl () { return LIBRARY_URL }
  requiresLogin () { return true }
  getLoginCheckSelector () { return SELECTORS.bookContainer }

  // === 頁面檢測（3 方法） ===

  isValidDomain (url) {
    const target = typeof url === 'string' ? url : this._currentUrl()
    try {
      const hostname = new URL(target).hostname.toLowerCase()
      return hostname === VALID_HOSTNAME || hostname.endsWith(`.${VALID_HOSTNAME}`)
    } catch (error) {
      return false
    }
  }

  async getPageType (url) {
    // 依書城 URL 結構判斷：library / reader / unknown
    return 'unknown'
  }

  async isExtractablePage (url) {
    return (await this.getPageType(url)) === 'library'
  }

  async checkPageReady () {
    await this.waitForBookElements()
    return this.findBookContainer() !== null
  }

  // === 元素查找（3 方法） ===

  findBookContainer () {
    if (typeof document === 'undefined') return null
    return document.querySelector(SELECTORS.bookContainer)
  }

  getBookElements () {
    if (typeof document === 'undefined') return []
    return Array.from(document.querySelectorAll(SELECTORS.bookItem))
  }

  getBookCount () {
    return this.getBookElements().length
  }

  // === 資料提取（3 方法） ===

  parseBookElement (element) {
    return {
      title: this._extractText(element, SELECTORS.bookTitle),
      // 依勘查結果增減欄位
      source: PLATFORM_NAME
    }
  }

  extractBookData (element) {
    return this.sanitizeData(this.parseBookElement(element))
  }

  async extractAllBooks () {
    await this.checkPageReady()
    this.logger.info('STORE_EXTRACT_START', { count: this.getBookCount() })

    // 依書城載入機制選擇：
    // - 分頁按鈕：迴圈點擊（參考 books-com-tw-adapter._loadAllPages）
    // - lazy scroll：呼叫 this.loadAllBooksLazy()（繼承自 Interface）
    // - 一次全載：無需額外動作

    const books = []
    for (const element of this.getBookElements()) {
      this._stats.totalExtracted += 1
      try {
        books.push(this.extractBookData(element))
        this._stats.successCount += 1
      } catch (error) {
        this._stats.failCount += 1
        this.logger.warn('STORE_BOOK_PARSE_FAILED', { reason: error.message })
      }
    }

    this.logger.info('STORE_EXTRACT_DONE', {
      success: this._stats.successCount,
      fail: this._stats.failCount
    })
    return books
  }

  // === 工具方法（3 方法） ===

  sanitizeData (data) {
    const sanitized = { ...data }
    // URL 過濾、HTML 移除等安全處理
    return sanitized
  }

  getStats () { return { ...this._stats } }

  reset () {
    this._stats = { totalExtracted: 0, successCount: 0, failCount: 0 }
  }

  // === 私有 helper ===

  _extractText (element, selector) {
    if (!element || typeof element.querySelector !== 'function') return ''
    const target = element.querySelector(selector)
    return target ? target.textContent.trim() : ''
  }

  _currentUrl () {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.href
    }
    return ''
  }
}

function createStoreAdapter (options) {
  return new StoreAdapter(options)
}

module.exports = createStoreAdapter
module.exports.StoreAdapter = StoreAdapter
```

### 骨架使用注意

1. **class 命名**：使用 PascalCase 書城名稱（如 `KoboAdapter`、`KindleJpAdapter`）
2. **PLATFORM_NAME**：使用 kebab-case（如 `kobo`、`kindle-jp`），與 PlatformRegistry `name` 一致
3. **工廠函式**：命名 `create<Store>Adapter`，與 PlatformRegistry `adapterFactory` 配合
4. **MessageDictionary**：每個 adapter 建立專屬 local dict，禁止依賴 GlobalMessages
5. **`typeof document === 'undefined'` 防護**：所有 DOM 操作方法必須加此判斷，因單元測試在 Node.js（jsdom）環境執行
6. **捲動載入**：若書城使用 lazy scroll，可直接呼叫繼承的 `loadAllBooksLazy(options)`；若需客製化捲動邏輯（如 Readmoo 的多策略捲動），考慮拆分為獨立 scroll-loader 模組

---

## 6. PlatformRegistry 註冊

在 `src/content/platform/platform-registry.js` 的 `PLATFORM_CONFIGS` 陣列新增一筆：

```javascript
{
  name: '<store>',                              // kebab-case 識別碼
  displayName: '<書城顯示名稱>',
  matchPatterns: ['*://*.<domain>/*'],           // manifest content_scripts.matches 用
  hostnames: ['<host1>', '<host2>'],             // 偵測比對用（完全比對 + 子網域後綴比對）
  adapterFactory: () => require('../adapters/<store>-adapter'),  // lazy require
  libraryUrl: '<書庫頁 URL>'
}
```

### 註冊後自動連動

| 元件 | 自動效果 | 手動動作 |
|------|---------|---------|
| BookSchemaV2 `source` 欄位 | `PLATFORM_NAMES` 自動從 `getRegisteredPlatforms()` 取值，新書城自動納入合法 source 值 | 無需修改 |
| page-detector | 透過 `PlatformRegistry.detect(url)` 自動偵測新書城 | 無需修改 |
| content-modular.js | 透過 `PlatformRegistry.detect(url)` 動態建立 adapter | 無需修改 |
| build.js | manifest-registry 一致性驗證自動檢查 matchPatterns 是否與 manifest 一致 | 需更新 manifest.json |

### manifest.json 更新

需手動更新兩處：

```json
{
  "content_scripts": [{
    "matches": [
      "*://*.readmoo.com/*",
      "*://readmoo.com/*",
      "*://*.<new-domain>/*"          // 新增
    ]
  }],
  "host_permissions": [
    "*://*.readmoo.com/*",
    "*://*.<new-domain>/*"            // 新增
  ]
}
```

更新後執行 `npm run build:dev`，build 流程會自動驗證 manifest `content_scripts.matches` 與 PlatformRegistry `matchPatterns` 的一致性，不一致會中斷建置並提示缺少的 patterns。

---

## 7. 測試要求

### 7.1 單元測試

路徑：`tests/unit/adapters/<store>-adapter.test.js`

最低覆蓋範圍：

| 測試類別 | 測試項目 |
|---------|---------|
| 平台識別 | `getPlatformName()` 回傳正確名稱 |
| 域名判斷 | `isValidDomain()` 對合法/非法 URL 的判斷 |
| 頁面類型 | `getPageType()` 對書庫頁/非書庫頁的判斷 |
| DOM 解析 | `parseBookElement()` 從模擬 DOM 提取各欄位 |
| 安全過濾 | `sanitizeData()` 過濾 `javascript:` URL、HTML 標籤 |
| 統計 | `getStats()` / `reset()` 正確運作 |
| 邊界 | `document === undefined` 時不拋錯 |

### 7.2 PlatformRegistry 測試

現有 `tests/unit/platform/platform-registry.test.js` 會自動驗證：
- 新書城 hostname 可被 `detect()` 正確識別
- `getAllMatchPatterns()` 包含新書城 patterns
- `getRegisteredPlatforms()` 包含新書城配置

新增書城後執行 `npm test` 確認既有 Registry 測試仍通過。

### 7.3 實機驗證

以 chrome-devtools-mcp 執行 MCP E2E Checklist（參考 `docs/bookstores/readmoo.md` §MCP E2E 驗證 Checklist）：

1. `npm run build:dev`
2. `install_extension` 安裝 unpacked
3. 導航至新書城書庫頁 → 完成登入
4. 觸發提取 → 驗證 console log 出現 adapter 初始化訊息
5. 驗證 `chrome.storage.local` 寫入的書籍數量與畫面一致

---

## 8. 現有書城參考

| 書城 | Adapter | 規格文件 | 載入機制 | 特殊處理 |
|------|---------|---------|---------|---------|
| Readmoo | `readmoo-adapter.js` + `readmoo-scroll-loader.js` | `docs/bookstores/readmoo.md` | 虛擬 scroll + 「更多...」按鈕 | ID 策略（privacy element）、作者欄位 source limitation、獨立 scroll-loader 模組 |
| 博客來 | `books-com-tw-adapter.js` | `docs/bookstores/books-com-tw.md` | 分頁「看更多」按鈕 | 作者前綴移除（`作者：`）、Cloudflare Turnstile（登入頁） |

---

## 9. 常見陷阱

| 陷阱 | 說明 | 防護 |
|------|------|------|
| Content Script 未注入 | manifest `matches` 未涵蓋新書城 URL | build 流程 manifest-registry 一致性驗證會攔截 |
| SPA 路由切換後 DOM 消失 | hash/pushState 導航不觸發 Content Script 重注入 | page-detector 已監聽 URL 變更，adapter 無需額外處理 |
| 選擇器過度具體 | 書城改版後選擇器失效 | 優先使用語意化 class（`.book-title`）而非結構性路徑（`div > div:nth-child(2) > span`） |
| ID 不穩定 | 封面 URL / 隨機 hash 作 ID 會在書城改版後改變 | 優先找 DOM 中的穩定 book ID（API ID / data attribute），建立優先級表 |
| 缺少 `typeof document` 防護 | 單元測試在 Node.js 環境拋 ReferenceError | 所有 DOM 操作方法加 `typeof document === 'undefined'` 判斷 |
| 日誌訊息混入 GlobalMessages | 跨模組詞彙污染，維護困難 | 每個 adapter 建立專屬 MessageDictionary |

---

**Last Updated**: 2026-06-26
**Version**: 1.0.0 — 初版，涵蓋架構概覽、checklist、DOM 勘查 SOP、adapter 骨架、Registry 註冊、測試要求
