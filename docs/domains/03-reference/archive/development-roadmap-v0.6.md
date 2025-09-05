# 🛠 v0.6.0 開發路線圖 - 書籍元資料增強

**目標版本**: v2.0.0 - v2.0.5 (🔴 **延後開發** - 等待 v1.0 成功上架後)  
**開發時程**: 預計 18 個 TDD 循環 (未來規劃)  
**主要目標**: 實現標籤系統、多平台支援、使用者元資料、優先權重系統

## 📋 開發優先序列

基於您的需求，按以下順序進行開發：

1. **標籤系統** (最高優先級) - 使用者可上 TAG 並篩選
2. **多平台來源** (高優先級) - 標記書籍來自哪個書城/實體書
3. **使用者元資料** (中優先級) - 完讀時間、心得等個人資料
4. **優先權重系統** (🆕 新增需求) - 未完讀書籍的排序權重
5. **匯出增強** (基礎優先級) - 包含新欄位的完整匯出

## 🔄 TDD 循環詳細規劃

### 階段一：標籤系統基礎架構 (v0.6.1)

#### TDD 循環 #31: 標籤資料模型設計

**預估時間**: 1-2 天

**🔴 Red 階段**:

```javascript
// tests/unit/models/tag.test.js
describe('Tag Model', () => {
  test('應該創建有效的標籤物件', () => {
    const tag = new Tag({
      name: '已完成',
      color: '#28a745',
      description: '已讀完的書籍'
    })

    expect(tag.id).toBeDefined()
    expect(tag.name).toBe('已完成')
    expect(tag.color).toBe('#28a745')
    expect(tag.isSystem).toBe(false)
  })
})
```

**🟢 Green 階段**:

- 實現 `src/models/tag.js` 標籤資料模型
- 基本的標籤 CRUD 功能
- 標籤驗證邏輯

**🔵 Refactor 階段**:

- 優化標籤資料結構
- 改善驗證和錯誤處理
- 程式碼品質提升

#### TDD 循環 #32: 標籤管理器實現

**預估時間**: 2-3 天

**🔴 Red 階段**:

```javascript
// tests/unit/managers/tag-manager.test.js
describe('TagManager', () => {
  test('應該能新增和管理標籤', async () => {
    const tagManager = new TagManager()
    const tag = await tagManager.createTag({
      name: '推薦',
      color: '#007bff'
    })

    expect(tag.id).toBeDefined()
    expect(await tagManager.getTag(tag.id)).toEqual(tag)
  })
})
```

**🟢 Green 階段**:

- 實現 `src/managers/tag-manager.js`
- 標籤 CRUD 操作
- 標籤搜尋和篩選邏輯

**🔵 Refactor 階段**:

- 事件驅動的標籤管理
- 快取機制優化
- 批量操作支援

#### TDD 循環 #33: 書籍-標籤關聯系統

**預估時間**: 2-3 天

**🔴 Red 階段**:

```javascript
// tests/unit/services/book-tag-service.test.js
describe('BookTagService', () => {
  test('應該能為書籍添加標籤', async () => {
    const service = new BookTagService()
    await service.addTagToBook('book-123', 'tag-456')

    const bookTags = await service.getBookTags('book-123')
    expect(bookTags).toContain('tag-456')
  })
})
```

**🟢 Green 階段**:

- 實現 `src/services/book-tag-service.js`
- 書籍標籤關聯邏輯
- 批量標籤操作

**🔵 Refactor 階段**:

- 優化關聯資料結構
- 事件系統整合
- 效能優化

#### TDD 循環 #34: 標籤篩選功能

**預估時間**: 2-3 天

**🔴 Red 階段**:

```javascript
// tests/unit/filters/tag-filter.test.js
describe('TagFilter', () => {
  test('應該根據標籤篩選書籍', () => {
    const filter = new TagFilter()
    const result = filter.filterBooksByTags(books, ['已完成', '推薦'])

    expect(result.length).toBeGreaterThan(0)
    expect(result.every((book) => book.tags.includes('已完成') || book.tags.includes('推薦'))).toBe(
      true
    )
  })
})
```

**🟢 Green 階段**:

- 擴展 `src/search/book-search-filter.js`
- 標籤篩選邏輯整合
- 複合篩選條件支援

**🔵 Refactor 階段**:

- 篩選演算法優化
- 快取機制改善
- 搜尋性能提升

### 階段二：多平台來源支援 (v0.6.2)

#### TDD 循環 #35: 平台來源資料結構

**預估時間**: 1-2 天

**🔴 Red 階段**:

```javascript
// tests/unit/models/book-source.test.js
describe('BookSource', () => {
  test('應該正確識別數位平台來源', () => {
    const source = new BookSource({
      type: 'digital',
      platform: 'kindle',
      url: 'https://amazon.com/kindle/book-123'
    })

    expect(source.isDigital()).toBe(true)
    expect(source.platform).toBe('kindle')
  })
})
```

**🟢 Green 階段**:

- 實現 `src/models/book-source.js`
- 平台類型識別邏輯
- 來源驗證機制

**🔵 Refactor 階段**:

- 平台配置標準化
- 錯誤處理改善
- 擴展性設計優化

#### TDD 循環 #36: 實體書籍支援

**預估時間**: 2-3 天

**🔴 Red 階段**:

```javascript
// tests/unit/services/physical-book-service.test.js
describe('PhysicalBookService', () => {
  test('應該能手動新增實體書籍', async () => {
    const service = new PhysicalBookService()
    const book = await service.addPhysicalBook({
      title: '實體書標題',
      author: '作者',
      location: '書櫃A-第2層'
    })

    expect(book.source.type).toBe('physical')
    expect(book.source.location).toBe('書櫃A-第2層')
  })
})
```

**🟢 Green 階段**:

- 實現 `src/services/physical-book-service.js`
- 手動書籍新增功能
- 實體書籍管理邏輯

**🔵 Refactor 階段**:

- 書籍來源統一管理
- UI 整合優化
- 資料驗證增強

### 階段三：使用者元資料系統 (v0.6.3)

#### TDD 循環 #37: 個人評價系統

**預估時間**: 2-3 天

**🔴 Red 階段**:

```javascript
// tests/unit/services/user-rating-service.test.js
describe('UserRatingService', () => {
  test('應該能為書籍評分和寫心得', async () => {
    const service = new UserRatingService()
    await service.rateBook('book-123', {
      rating: 5,
      notes: '非常精彩的書籍，推薦閱讀！'
    })

    const userMeta = await service.getUserMetadata('book-123')
    expect(userMeta.rating).toBe(5)
    expect(userMeta.notes).toBe('非常精彩的書籍，推薦閱讀！')
  })
})
```

**🟢 Green 階段**:

- 實現 `src/services/user-rating-service.js`
- 評分和心得功能
- 個人元資料管理

**🔵 Refactor 階段**:

- 評價資料結構優化
- 驗證邏輯改善
- 使用者體驗提升

#### TDD 循環 #38: 完讀狀態管理

**預估時間**: 1-2 天

**🔴 Red 階段**:

```javascript
// tests/unit/services/reading-status-service.test.js
describe('ReadingStatusService', () => {
  test('應該能標記書籍為已完成', async () => {
    const service = new ReadingStatusService()
    await service.markAsCompleted('book-123', {
      completedDate: new Date('2025-08-06')
    })

    const status = await service.getReadingStatus('book-123')
    expect(status.isCompleted).toBe(true)
    expect(status.completedDate).toEqual(new Date('2025-08-06'))
  })
})
```

**🟢 Green 階段**:

- 實現 `src/services/reading-status-service.js`
- 完讀狀態切換邏輯
- 完讀時間記錄

**🔵 Refactor 階段**:

- 狀態管理優化
- 事件系統整合
- 統計功能增強

### 階段四：優先權重系統 (v0.6.4)

#### TDD 循環 #39: 書籍優先權重模型

**預估時間**: 1-2 天

**🔴 Red 階段**:

```javascript
// tests/unit/models/book-priority.test.js
describe('BookPriority', () => {
  test('應該能設定和調整書籍優先權重', () => {
    const priority = new BookPriority({
      bookId: 'book-123',
      weight: 85,
      reason: '作者新書，想盡快閱讀'
    })

    expect(priority.weight).toBe(85)
    expect(priority.isHighPriority()).toBe(true)

    priority.adjustWeight(15) // 增加15點
    expect(priority.weight).toBe(100)
  })
})
```

**🟢 Green 階段**:

- 實現 `src/models/book-priority.js` 優先權重模型
- 權重調整和驗證邏輯
- 優先級別判斷方法

**🔵 Refactor 階段**:

- 權重計算演算法優化
- 自動權重調整建議
- 優先級視覺化改善

#### TDD 循環 #40: 書籍排序系統增強

**預估時間**: 2-3 天

**🔴 Red 階段**:

```javascript
// tests/unit/services/book-sort-service.test.js
describe('BookSortService', () => {
  test('應該根據優先權重排序未完讀書籍', () => {
    const service = new BookSortService()
    const unreadBooks = getUnreadBooks()

    const sorted = service.sortByPriority(unreadBooks)

    expect(sorted[0].userMetadata.priority.weight).toBeGreaterThanOrEqual(
      sorted[1].userMetadata.priority.weight
    )
  })

  test('應該支援複合排序條件', () => {
    const service = new BookSortService()
    const sorted = service.sort(books, [
      { field: 'priority.weight', order: 'desc' },
      { field: 'addedDate', order: 'asc' }
    ])

    expect(sorted).toBeDefined()
  })
})
```

**🟢 Green 階段**:

- 擴展 `src/services/book-sort-service.js`
- 優先權重排序邏輯
- 複合排序條件支援

**🔵 Refactor 階段**:

- 排序性能優化
- 排序設定持久化
- 智能排序建議

### 階段五：匯出功能增強 (v0.6.5)

#### TDD 循環 #41: 增強型匯出系統

**預估時間**: 3-4 天

**🔴 Red 階段**:

```javascript
// tests/unit/exporters/enhanced-exporter.test.js
describe('EnhancedExporter', () => {
  test('應該匯出包含所有新欄位的資料', async () => {
    const exporter = new EnhancedExporter()
    const result = await exporter.exportToCSV(books, {
      includeFields: ['tags', 'source', 'userMetadata']
    })

    expect(result).toContain('標籤')
    expect(result).toContain('來源平台')
    expect(result).toContain('個人評分')
  })
})
```

**🟢 Green 階段**:

- 擴展 `src/exporters/` 匯出系統
- 新增欄位匯出支援
- Excel 和 PDF 格式支援

**🔵 Refactor 階段**:

- 匯出效能優化
- 格式選項增強
- 錯誤處理改善

#### TDD 循環 #42: 備份與還原系統

**預估時間**: 2-3 天

**🔴 Red 階段**:

```javascript
// tests/unit/services/backup-service.test.js
describe('BackupService', () => {
  test('應該能完整備份並還原所有資料', async () => {
    const service = new BackupService()
    const backup = await service.createFullBackup()

    expect(backup.books).toBeDefined()
    expect(backup.tags).toBeDefined()
    expect(backup.version).toBe('0.6.4')

    await service.restoreFromBackup(backup)
    // 驗證還原完整性
  })
})
```

**🟢 Green 階段**:

- 實現 `src/services/backup-service.js`
- 完整備份功能
- 資料還原和驗證

**🔵 Refactor 階段**:

- 備份壓縮優化
- 增量備份支援
- 版本相容性處理

## 📊 開發時程規劃

### Sprint 1: 標籤系統 (2-3 週)

- **Week 1**: TDD 循環 #31-32 (標籤模型 + 管理器)
- **Week 2**: TDD 循環 #33-34 (關聯系統 + 篩選)
- **Week 3**: UI 整合 + 測試完善

### Sprint 2: 多平台來源 (1-2 週)

- **Week 1**: TDD 循環 #35-36 (來源結構 + 實體書支援)
- **Week 2**: UI 整合 + 資料遷移

### Sprint 3: 使用者元資料 (1-2 週)

- **Week 1**: TDD 循環 #37-38 (評價 + 完讀狀態)
- **Week 2**: UI 整合 + 使用者體驗優化

### Sprint 4: 優先權重系統 (1 週)

- **Week 1**: TDD 循環 #39-40 (權重模型 + 排序系統)

### Sprint 5: 匯出增強 (1-2 週)

- **Week 1**: TDD 循環 #41-42 (增強匯出 + 備份系統)
- **Week 2**: 整合測試 + 文件更新

## 🎯 成功標準

### 功能完整性

- [ ] 使用者可為書籍新增/移除標籤
- [ ] 支援標籤篩選和搜尋
- [ ] 支援多書城來源標記
- [ ] 支援實體書籍手動新增
- [ ] 完讀狀態和時間記錄
- [ ] 個人評分和心得功能
- [ ] 書籍優先權重設定和調整
- [ ] 未完讀書籍智能排序
- [ ] 完整的匯出備份功能

### 技術指標

- [ ] 所有新功能 TDD 覆蓋率 > 90%
- [ ] 資料遷移成功率 100%
- [ ] 匯出/匯入功能正確率 100%
- [ ] UI 回應時間 < 2 秒

### 使用者體驗

- [ ] 標籤操作流暢直觀
- [ ] 篩選結果即時更新
- [ ] 匯出過程有進度回饋
- [ ] 錯誤訊息清楚易懂

## 🔄 風險控制

### 技術風險

- **資料結構變更**: 完整的遷移測試和回滾機制
- **效能影響**: 分階段效能測試和優化
- **相容性問題**: 嚴格的向後相容性驗證

### 時程風險

- **功能範圍**: 可選擇性實現非核心功能
- **複雜度**: 分階段發布，逐步完善
- **測試時間**: 並行開發和測試流程

## 📋 後續維護

### v0.6.x 小版本更新

- 功能改善和錯誤修復
- 效能優化和使用者回饋
- 新增標籤模板和預設配置

### v0.7.x 規劃 (Firefox 支援)

- 跨平台架構重構
- Firefox WebExtension 適配
- 統一建置和部署流程
- 進階統計和分析功能

---

## 🦊 Firefox Extension 支援規劃 (v0.7.x)

### 跨平台架構設計

#### 共用核心架構

```
src/
├── core/              # 共用核心邏輯 (平台無關)
│   ├── models/        # 資料模型
│   ├── services/      # 業務邏輯
│   └── events/        # 事件系統
├── platforms/         # 平台特定實現
│   ├── chrome/        # Chrome Extension 特有
│   │   ├── manifest.json
│   │   ├── background/
│   │   └── storage/
│   └── firefox/       # Firefox WebExtension 特有
│       ├── manifest.json
│       ├── background/
│       └── storage/
└── shared/            # 共用 UI 和工具
    ├── ui/
    ├── utils/
    └── adapters/
```

#### Firefox 特有考量

- **Manifest 差異**: Firefox WebExtensions API 相容性
- **儲存適配**: Firefox 的 `browser.storage` API 差異
- **權限管理**: Firefox 特有的權限請求機制
- **Content Security Policy**: Firefox 的 CSP 限制

### 開發策略

1. **v0.6.x 完成**: 先完成 Chrome 版本的書籍元資料增強
2. **架構重構**: 抽象化平台特定代碼
3. **Firefox 適配**: 實現 Firefox 特有適配器
4. **統一建置**: 單一代碼庫支援雙平台

---

🔴 **重要策略調整通知**

基於優先上架策略，此開發路線圖已調整為 **v2.0+ 未來規劃**：

**優先策略**: v1.0 Readmoo 功能完成並成功上架 Chrome Web Store  
**延後開發**: 多書城擴展和 Firefox 支援在 v1.0 穩定後再進行

**規劃負責人**: 開發團隊  
**預計開始時間**: v1.0 Chrome Web Store 成功上架並穩定運行後  
**預計完成時間**: 7-9 週 (含 Firefox 支援準備)
