# 📚 v0.2.0 資料提取器架構設計

**版本**: v0.2.0  
**基於**: v0.1.0 事件系統核心  
**設計日期**: 2025-01-29

## 🎯 設計目標

### 核心目標
- 基於 v0.1.0 事件系統實現資料提取器
- 支援多書城網站的擴展架構
- 事件驅動的提取流程
- 高度可測試和可維護的程式碼

### 技術目標
- 利用 EventHandler 基底類別建立提取器
- 使用 ChromeEventBridge 實現跨上下文通訊
- 通過 EventBus 實現模組間解耦
- 支援 Readmoo、博客來、金石堂等多個書城

---

## 🏗 整體架構

### 架構層次

```
📚 資料提取層 (v0.2.0)
├── BookDataExtractor (主要提取器)
├── BookstoreAdapters (書城適配器)
├── ExtractionHandlers (事件處理器)
└── DataValidators (資料驗證器)
                ↓ 基於事件系統
🎭 事件系統層 (v0.1.0) ✅
├── EventBus (事件總線)
├── EventHandler (處理器基底)
└── ChromeEventBridge (跨上下文橋接)
```

### 事件流程設計

```
1. 使用者觸發提取 → EXTRACTION.STARTED
2. 書城識別 → BOOKSTORE.DETECTED  
3. 適配器選擇 → ADAPTER.SELECTED
4. DOM解析開始 → PARSING.STARTED
5. 資料提取中 → EXTRACTION.PROGRESS
6. 資料驗證 → VALIDATION.COMPLETED
7. 提取完成 → EXTRACTION.COMPLETED
8. 儲存觸發 → STORAGE.SAVE.REQUESTED
```

---

## 📦 核心組件設計

### 1. BookDataExtractor (主要提取器)

```javascript
/**
 * 書籍資料提取器 - 基於 EventHandler
 */
class BookDataExtractor extends EventHandler {
  constructor() {
    super('BookDataExtractor', EVENT_PRIORITY.HIGH);
    this.adapters = new Map();
    this.validator = new DataValidator();
  }

  getSupportedEvents() {
    return [
      'EXTRACTION.STARTED',
      'TAB.UPDATED.BOOKSTORE',
      'USER.EXTRACT.REQUESTED'
    ];
  }

  async process(event) {
    switch (event.type) {
      case 'EXTRACTION.STARTED':
        return await this.handleExtractionStart(event);
      case 'TAB.UPDATED.BOOKSTORE':
        return await this.handleTabUpdate(event);
      case 'USER.EXTRACT.REQUESTED':
        return await this.handleUserRequest(event);
    }
  }

  async handleExtractionStart(event) {
    const { url, options } = event.data;
    
    // 1. 識別書城
    const bookstore = this.detectBookstore(url);
    await this.emitEvent('BOOKSTORE.DETECTED', { bookstore, url });
    
    // 2. 選擇適配器
    const adapter = this.selectAdapter(bookstore);
    await this.emitEvent('ADAPTER.SELECTED', { adapter: adapter.name });
    
    // 3. 執行提取
    const books = await this.extractWithAdapter(adapter, url, options);
    
    // 4. 驗證資料
    const validatedBooks = await this.validateBooks(books);
    
    // 5. 發布完成事件
    await this.emitEvent('EXTRACTION.COMPLETED', {
      books: validatedBooks,
      bookstore,
      extractedAt: new Date().toISOString(),
      count: validatedBooks.length
    });
    
    return validatedBooks;
  }
}
```

### 2. BookstoreAdapter (書城適配器)

```javascript
/**
 * 書城適配器基底類別
 */
class BookstoreAdapter {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.selectors = config.selectors;
  }

  /**
   * 檢查是否支援指定URL
   */
  canHandle(url) {
    return this.config.urlPatterns.some(pattern => 
      new RegExp(pattern).test(url)
    );
  }

  /**
   * 提取書籍資料
   */
  async extract(document, options = {}) {
    const books = [];
    const bookElements = this.findBookElements(document);
    
    for (const element of bookElements) {
      try {
        const book = await this.extractBookData(element);
        if (book && this.isValidBook(book)) {
          books.push(book);
        }
      } catch (error) {
        console.warn(`Failed to extract book from element:`, error);
      }
    }
    
    return books;
  }

  /**
   * 抽象方法 - 子類別必須實現
   */
  findBookElements(document) {
    throw new Error('findBookElements must be implemented by subclass');
  }

  extractBookData(element) {
    throw new Error('extractBookData must be implemented by subclass');
  }
}

/**
 * Readmoo 適配器
 */
class ReadmooAdapter extends BookstoreAdapter {
  constructor() {
    super('Readmoo', {
      urlPatterns: [
        'https://readmoo\\.com/.*',
        'https://.*\\.readmoo\\.com/.*'
      ],
      selectors: {
        bookContainer: 'a[href*="/api/reader/"]',
        bookImage: 'img',
        bookTitle: 'img[alt]',
        bookId: 'href',
        progressBar: '.progress-bar',
        newBookBadge: '.badge-new',
        finishedBadge: '.badge-finished'
      }
    });
  }

  findBookElements(document) {
    return document.querySelectorAll(this.selectors.bookContainer);
  }

  async extractBookData(element) {
    const img = element.querySelector(this.selectors.bookImage);
    if (!img) return null;

    // 提取基本資訊
    const id = this.extractBookId(element.getAttribute('href'));
    const title = img.getAttribute('alt') || '';
    const cover = img.getAttribute('src') || '';

    // 提取進度資訊
    const progress = this.extractProgress(element);
    
    // 提取狀態標記
    const isNew = !!element.querySelector(this.selectors.newBookBadge);
    const isFinished = !!element.querySelector(this.selectors.finishedBadge);

    return {
      id,
      title: title.trim(),
      cover,
      progress,
      isNew,
      isFinished,
      bookstore: 'readmoo',
      extractedAt: new Date().toISOString()
    };
  }
}
```

### 3. ExtractionEventHandler (提取事件處理器)

```javascript
/**
 * 提取進度事件處理器
 */
class ExtractionProgressHandler extends EventHandler {
  constructor() {
    super('ExtractionProgressHandler', EVENT_PRIORITY.NORMAL);
  }

  getSupportedEvents() {
    return [
      'EXTRACTION.PROGRESS',
      'PARSING.STARTED',
      'PARSING.COMPLETED'
    ];
  }

  async process(event) {
    switch (event.type) {
      case 'EXTRACTION.PROGRESS':
        return await this.handleProgress(event);
      case 'PARSING.STARTED':
        return await this.handleParsingStart(event);
      case 'PARSING.COMPLETED':
        return await this.handleParsingComplete(event);
    }
  }

  async handleProgress(event) {
    const { current, total, bookstore } = event.data;
    const percentage = Math.round((current / total) * 100);
    
    // 更新UI進度
    await this.emitEvent('UI.PROGRESS.UPDATE', {
      percentage,
      current,
      total,
      message: `正在提取 ${bookstore} 書籍資料... ${percentage}%`
    });
  }
}

/**
 * 提取完成事件處理器
 */
class ExtractionCompletedHandler extends EventHandler {
  constructor() {
    super('ExtractionCompletedHandler', EVENT_PRIORITY.HIGH);
  }

  getSupportedEvents() {
    return ['EXTRACTION.COMPLETED'];
  }

  async process(event) {
    const { books, bookstore, count } = event.data;
    
    // 觸發儲存事件
    await this.emitEvent('STORAGE.SAVE.REQUESTED', {
      data: books,
      type: 'books',
      bookstore,
      timestamp: new Date().toISOString()
    });

    // 觸發UI更新事件
    await this.emitEvent('UI.NOTIFICATION.SHOW', {
      type: 'success',
      message: `成功提取 ${count} 本 ${bookstore} 書籍資料`,
      duration: 3000
    });

    // 觸發統計事件
    await this.emitEvent('ANALYTICS.EXTRACTION.COMPLETED', {
      bookstore,
      count,
      timestamp: new Date().toISOString()
    });

    return { success: true, processedCount: count };
  }
}
```

---

## 🎭 事件定義

### 提取相關事件

```javascript
// 提取生命週期事件
const EXTRACTION_EVENTS = {
  STARTED: 'EXTRACTION.STARTED',
  PROGRESS: 'EXTRACTION.PROGRESS', 
  COMPLETED: 'EXTRACTION.COMPLETED',
  FAILED: 'EXTRACTION.FAILED'
};

// 書城相關事件
const BOOKSTORE_EVENTS = {
  DETECTED: 'BOOKSTORE.DETECTED',
  ADAPTER_SELECTED: 'ADAPTER.SELECTED',
  UNSUPPORTED: 'BOOKSTORE.UNSUPPORTED'
};

// 解析相關事件
const PARSING_EVENTS = {
  STARTED: 'PARSING.STARTED',
  PROGRESS: 'PARSING.PROGRESS',
  COMPLETED: 'PARSING.COMPLETED',
  ERROR: 'PARSING.ERROR'
};

// 驗證相關事件
const VALIDATION_EVENTS = {
  STARTED: 'VALIDATION.STARTED',
  COMPLETED: 'VALIDATION.COMPLETED',
  FAILED: 'VALIDATION.FAILED'
};
```

### 事件資料結構

```javascript
// 提取開始事件
{
  type: 'EXTRACTION.STARTED',
  data: {
    url: 'https://readmoo.com/library',
    options: {
      includeProgress: true,
      includeCover: true,
      batchSize: 50
    },
    requestedBy: 'user' | 'auto' | 'scheduled'
  }
}

// 提取完成事件
{
  type: 'EXTRACTION.COMPLETED',
  data: {
    books: [...],
    bookstore: 'readmoo',
    count: 150,
    extractedAt: '2025-01-29T10:30:00.000Z',
    duration: 1250, // 毫秒
    success: true
  }
}
```

---

## 🌐 多書城支援策略

### 支援的書城

1. **Readmoo** (v0.2.0 優先實現)
   - URL: `*.readmoo.com`
   - 特色: 完整的進度追蹤、新書標記

2. **博客來** (v0.2.1 規劃)
   - URL: `*.books.com.tw`
   - 特色: 豐富的書籍資訊、評分系統

3. **金石堂** (v0.2.2 規劃)
   - URL: `*.kingstone.com.tw`
   - 特色: 優惠資訊、庫存狀態

4. **Kobo** (v0.2.3 規劃)
   - URL: `*.kobo.com`
   - 特色: 國際化支援、多語言書籍

### 適配器擴展機制

```javascript
// 適配器註冊系統
class AdapterRegistry {
  constructor() {
    this.adapters = new Map();
  }

  register(adapter) {
    this.adapters.set(adapter.name, adapter);
  }

  findAdapter(url) {
    for (const adapter of this.adapters.values()) {
      if (adapter.canHandle(url)) {
        return adapter;
      }
    }
    return null;
  }
}

// 使用範例
const registry = new AdapterRegistry();
registry.register(new ReadmooAdapter());
registry.register(new BooksAdapter()); // 博客來
registry.register(new KingstoneAdapter()); // 金石堂
```

---

## 🧪 測試策略

### TDD 測試層次

1. **單元測試**
   - BookDataExtractor 核心邏輯
   - 各書城 Adapter 功能
   - 事件處理器邏輯
   - 資料驗證器功能

2. **整合測試**
   - 提取器與事件系統整合
   - 跨上下文通訊測試
   - 多適配器協作測試

3. **端對端測試**
   - 完整提取流程測試
   - 真實DOM環境測試
   - 錯誤恢復測試

### 測試資料準備

```javascript
// 測試用的DOM結構
const READMOO_MOCK_HTML = `
<div class="library">
  <a href="/api/reader/123456">
    <img src="cover1.jpg" alt="測試書籍1" />
    <div class="progress-bar" data-progress="75"></div>
    <span class="badge-new">新書</span>
  </a>
  <a href="/api/reader/789012">
    <img src="cover2.jpg" alt="測試書籍2" />
    <div class="progress-bar" data-progress="100"></div>
    <span class="badge-finished">完讀</span>
  </a>
</div>
`;

// 預期的提取結果
const EXPECTED_BOOKS = [
  {
    id: '123456',
    title: '測試書籍1',
    cover: 'cover1.jpg',
    progress: 75,
    isNew: true,
    isFinished: false,
    bookstore: 'readmoo'
  },
  // ...
];
```

---

## 📊 效能考量

### 提取效能優化

1. **批次處理**: 分批處理大量書籍資料
2. **非同步處理**: 使用 Promise.all 並行處理
3. **快取機制**: 快取適配器實例和DOM查詢結果
4. **懶載入**: 按需載入適配器

### 記憶體管理

1. **事件清理**: 完成後自動清理事件監聽器
2. **DOM清理**: 避免DOM元素洩漏
3. **資料結構**: 使用高效的資料結構

---

## 🔄 v0.2.0 開發階段

### Phase 1: 核心架構 (v0.2.0-alpha)
- BookDataExtractor 基礎實現
- ReadmooAdapter 完整實現
- 基本事件處理器

### Phase 2: 功能完善 (v0.2.0-beta)
- 資料驗證和錯誤處理
- 進度追蹤和通知
- 效能優化

### Phase 3: 穩定發布 (v0.2.0)
- 完整測試覆蓋
- 文檔完善
- 與 v0.1.0 事件系統完美整合

---

## 🎯 成功指標

### 功能指標
- ✅ 100% 基於事件系統實現
- ✅ Readmoo 完整支援
- ✅ 多書城架構準備
- ✅ 完整的錯誤處理

### 品質指標
- ✅ 測試覆蓋率 ≥ 90%
- ✅ 所有 TDD 循環完成
- ✅ 事件系統完美整合
- ✅ 詳細的繁體中文文檔

### 技術指標
- ✅ 事件處理延遲 < 100ms
- ✅ 提取效能 > 50 本書/秒
- ✅ 記憶體使用穩定
- ✅ 錯誤恢復能力

---

**此設計基於 v0.1.0 事件系統核心，確保與現有架構的完美整合** 