# 🧪 測試改進實施方案

**制定日期**: 2025-08-22  
**版本**: v0.9.26  
**基於**: [測試覆蓋分析報告](./test-coverage-analysis.md)

## 🎯 改進方案概述

針對測試覆蓋分析中發現的嚴重缺口，制定具體的測試補強計劃。重點解決資料匯入功能、Overview頁面功能和去重邏輯的測試不足問題。

## 🔥 Phase 1: 緊急補強 (極高優先級)

### 任務1.1: 資料匯入功能測試套件

**目標**: 為 `loadFromFile()` 功能建立完整測試覆蓋  
**時程**: 1天  
**檔案**: `tests/unit/ui/data-import.test.js`

#### 測試規格設計

```javascript
/**
 * 資料匯入功能完整測試套件
 * 覆蓋UC-04: 資料匯入與恢復的所有場景
 */

describe('📥 資料匯入功能測試', () => {
  let mockDocument, mockFileReader, mockBooksData

  beforeEach(() => {
    // 設置DOM mock環境
    mockDocument = {
      getElementById: jest.fn(),
      querySelector: jest.fn()
    }

    // 設置FileReader mock
    mockFileReader = {
      onload: jest.fn(),
      onerror: jest.fn(),
      readAsText: jest.fn()
    }
    global.FileReader = jest.fn(() => mockFileReader)

    // 模擬書籍資料陣列
    mockBooksData = []
    global.booksData = mockBooksData
  })

  describe('✅ 正常匯入流程', () => {
    test('應該能成功載入有效的JSON檔案', async () => {
      // 準備測試資料
      const validBookData = [
        {
          id: 'cover-123456',
          title: '測試書籍1',
          cover: 'https://example.com/cover1.jpg',
          progress: 50,
          source: 'readmoo',
          extractedAt: '2025-08-22T10:00:00.000Z'
        },
        {
          id: 'cover-789012',
          title: '測試書籍2',
          cover: 'https://example.com/cover2.jpg',
          progress: 100,
          source: 'readmoo',
          extractedAt: '2025-08-22T11:00:00.000Z'
        }
      ]

      // 模擬檔案選擇
      const mockFile = new File([JSON.stringify(validBookData)], 'readmoo-books-2025-08-22.json', {
        type: 'application/json'
      })

      const mockFileInput = {
        files: [mockFile]
      }

      mockDocument.getElementById.mockReturnValue(mockFileInput)

      // 執行匯入
      const result = await executeLoadFromFile()

      // 驗證結果
      expect(global.booksData).toHaveLength(2)
      expect(global.booksData[0]).toEqual(validBookData[0])
      expect(global.booksData[1]).toEqual(validBookData[1])
      expect(mockFileReader.readAsText).toHaveBeenCalledWith(mockFile, 'UTF-8')
    })

    test('應該在覆蓋模式下清空現有資料', async () => {
      // 準備現有資料
      global.booksData.push({ id: 'existing-1', title: '既有書籍' })

      const newBookData = [{ id: 'new-1', title: '新書籍', source: 'readmoo' }]

      // 執行覆蓋匯入
      await executeLoadFromFile(newBookData, 'overwrite')

      // 驗證現有資料被清空，只有新資料
      expect(global.booksData).toHaveLength(1)
      expect(global.booksData[0].id).toBe('new-1')
    })

    test('應該在合併模式下保留現有資料並去重', async () => {
      // 準備現有資料
      global.booksData.push({ id: 'cover-123', title: '既有書籍', progress: 30 })

      const newBookData = [
        { id: 'cover-123', title: '既有書籍', progress: 60 }, // 相同ID，應更新
        { id: 'cover-456', title: '新書籍', progress: 0 } // 新書籍，應添加
      ]

      // 執行合併匯入
      await executeLoadFromFile(newBookData, 'merge')

      // 驗證去重和合併
      expect(global.booksData).toHaveLength(2)
      expect(global.booksData.find((b) => b.id === 'cover-123').progress).toBe(60)
      expect(global.booksData.find((b) => b.id === 'cover-456')).toBeDefined()
    })
  })

  describe('❌ 錯誤處理測試', () => {
    test('應該拒絕非JSON檔案', async () => {
      const mockTextFile = new File(['invalid content'], 'test.txt', { type: 'text/plain' })
      const mockFileInput = { files: [mockTextFile] }
      mockDocument.getElementById.mockReturnValue(mockFileInput)

      const result = await executeLoadFromFile()

      expect(result.success).toBe(false)
      expect(result.error).toContain('請選擇 JSON 檔案')
    })

    test('應該處理無效的JSON格式', async () => {
      const invalidJSON = '{ invalid json content'
      const mockFile = new File([invalidJSON], 'invalid.json', { type: 'application/json' })

      // 模擬JSON.parse錯誤
      const originalParse = JSON.parse
      JSON.parse = jest.fn(() => {
        throw new Error('Invalid JSON')
      })

      const result = await executeLoadFromFile()

      expect(result.success).toBe(false)
      expect(result.error).toContain('JSON 檔案格式不正確')

      // 恢復原始JSON.parse
      JSON.parse = originalParse
    })

    test('應該驗證書籍資料結構', async () => {
      const invalidStructure = [
        { title: '缺少必要欄位的書籍' }, // 缺少id, source等必要欄位
        { id: 'valid-1', title: '正常書籍', source: 'readmoo' }
      ]

      const result = await executeLoadFromFile(invalidStructure)

      expect(result.success).toBe(false)
      expect(result.error).toContain('資料結構不符合規範')
      expect(result.invalidItems).toHaveLength(1)
    })

    test('應該處理空檔案', async () => {
      const emptyFile = new File([''], 'empty.json', { type: 'application/json' })

      const result = await executeLoadFromFile()

      expect(result.success).toBe(false)
      expect(result.error).toContain('檔案內容為空')
    })

    test('應該處理檔案讀取失敗', async () => {
      // 模擬FileReader錯誤
      mockFileReader.onerror = jest.fn((error) => {
        throw new Error('檔案讀取失敗')
      })

      const result = await executeLoadFromFile()

      expect(result.success).toBe(false)
      expect(result.error).toContain('檔案讀取失敗')
    })
  })

  describe('📊 效能和限制測試', () => {
    test('應該能處理大量資料匯入 (1000本書籍)', async () => {
      const largeDataSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `cover-${i}`,
        title: `測試書籍 ${i}`,
        source: 'readmoo',
        progress: Math.floor(Math.random() * 100)
      }))

      const startTime = Date.now()
      const result = await executeLoadFromFile(largeDataSet)
      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(global.booksData).toHaveLength(1000)
      expect(duration).toBeLessThan(5000) // 5秒內完成
    })

    test('應該在匯入過程中顯示進度', async () => {
      const mockProgressCallback = jest.fn()

      const result = await executeLoadFromFile([], 'merge', mockProgressCallback)

      expect(mockProgressCallback).toHaveBeenCalled()
    })
  })

  // 輔助函數
  async function executeLoadFromFile(data = [], mode = 'overwrite', progressCallback = null) {
    // 模擬loadFromFile函數的執行
    // 這裡需要根據實際的loadFromFile實現來調整
  }
})
```

#### 實施步驟

1. **Day 1.1**: 建立測試檔案結構和基本mock設置
2. **Day 1.2**: 實現正常流程測試案例
3. **Day 1.3**: 實現錯誤處理測試案例
4. **Day 1.4**: 實現效能和邊界測試案例
5. **Day 1.5**: 執行測試並修正發現的問題

---

### 任務1.2: Overview頁面功能測試套件

**目標**: 為Overview頁面的核心功能建立測試覆蓋  
**時程**: 1天  
**檔案**: `tests/unit/ui/overview-page.test.js`

#### 測試規格設計

```javascript
/**
 * Overview頁面功能完整測試套件
 * 覆蓋UC-06: 書籍資料檢視與管理的所有場景
 */

describe('📋 Overview頁面功能測試', () => {
  let mockDocument, mockWindow, mockBooksData

  beforeEach(() => {
    // 設置DOM環境
    mockDocument = {
      getElementById: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(),
      createElement: jest.fn(),
      addEventListener: jest.fn()
    }

    mockWindow = {
      location: { reload: jest.fn() },
      alert: jest.fn()
    }

    global.document = mockDocument
    global.window = mockWindow

    // 準備測試資料
    mockBooksData = [
      {
        id: 'cover-1',
        title: 'JavaScript權威指南',
        progress: 45,
        source: 'readmoo',
        extractedAt: '2025-08-22T10:00:00.000Z',
        type: '電子書'
      },
      {
        id: 'cover-2',
        title: '深入淺出Vue.js',
        progress: 100,
        source: 'readmoo',
        extractedAt: '2025-08-21T15:30:00.000Z',
        type: '電子書'
      },
      {
        id: 'cover-3',
        title: 'Python機器學習',
        progress: 0,
        source: 'readmoo',
        extractedAt: '2025-08-20T09:15:00.000Z',
        type: '電子書'
      }
    ]

    global.booksData = [...mockBooksData]
  })

  describe('📚 書籍清單顯示', () => {
    test('應該正確顯示所有書籍資料', () => {
      // 模擬DOM元素
      const mockTableBody = {
        innerHTML: '',
        appendChild: jest.fn()
      }
      mockDocument.querySelector.mockReturnValue(mockTableBody)

      // 執行渲染
      renderTable()

      // 驗證所有書籍都被處理
      expect(mockTableBody.appendChild).toHaveBeenCalledTimes(3)
    })

    test('應該顯示正確的書籍資訊格式', () => {
      const mockRow = { innerHTML: '', cells: [] }
      mockDocument.createElement.mockReturnValue(mockRow)

      const book = mockBooksData[0]
      const renderedRow = createBookRow(book)

      expect(renderedRow.innerHTML).toContain(book.title)
      expect(renderedRow.innerHTML).toContain('45%')
      expect(renderedRow.innerHTML).toContain('readmoo')
    })

    test('應該支援分頁顯示 (每頁50本)', () => {
      // 準備大量資料
      const largeDataSet = Array.from({ length: 150 }, (_, i) => ({
        id: `cover-${i}`,
        title: `書籍 ${i}`,
        source: 'readmoo'
      }))

      global.booksData = largeDataSet

      const page1 = renderTablePage(1, 50)
      const page2 = renderTablePage(2, 50)
      const page3 = renderTablePage(3, 50)

      expect(page1).toHaveLength(50)
      expect(page2).toHaveLength(50)
      expect(page3).toHaveLength(50)
    })

    test('應該顯示書籍總數統計', () => {
      const stats = calculateBookStats(mockBooksData)

      expect(stats.total).toBe(3)
      expect(stats.completed).toBe(1) // progress = 100
      expect(stats.inProgress).toBe(1) // progress = 45
      expect(stats.notStarted).toBe(1) // progress = 0
    })
  })

  describe('🔍 搜尋功能', () => {
    test('應該能根據書名精確搜尋', () => {
      const searchTerm = 'JavaScript'
      const results = searchBooks(mockBooksData, searchTerm)

      expect(results).toHaveLength(1)
      expect(results[0].title).toContain('JavaScript')
    })

    test('應該支援模糊搜尋匹配', () => {
      // 測試容錯搜尋
      const searchTerm = 'javascrpt' // 故意拼錯
      const results = fuzzySearchBooks(mockBooksData, searchTerm)

      expect(results).toHaveLength(1)
      expect(results[0].title).toContain('JavaScript')
    })

    test('應該支援部分匹配搜尋', () => {
      const searchTerm = 'Vue'
      const results = searchBooks(mockBooksData, searchTerm)

      expect(results).toHaveLength(1)
      expect(results[0].title).toContain('Vue.js')
    })

    test('應該即時更新搜尋結果', () => {
      const mockSearchInput = {
        value: '',
        addEventListener: jest.fn()
      }
      mockDocument.getElementById.mockReturnValue(mockSearchInput)

      setupSearchFunctionality()

      // 模擬使用者輸入
      mockSearchInput.value = 'JavaScript'
      const inputHandler = mockSearchInput.addEventListener.mock.calls[0][1]
      inputHandler()

      // 驗證搜尋結果更新
      expect(mockDocument.querySelector).toHaveBeenCalled()
    })

    test('應該處理空搜尋結果', () => {
      const searchTerm = '不存在的書籍'
      const results = searchBooks(mockBooksData, searchTerm)

      expect(results).toHaveLength(0)
    })
  })

  describe('📋 篩選功能', () => {
    test('應該能按閱讀進度篩選', () => {
      const completedBooks = filterBooksByProgress(mockBooksData, 'completed')
      const inProgressBooks = filterBooksByProgress(mockBooksData, 'in-progress')
      const notStartedBooks = filterBooksByProgress(mockBooksData, 'not-started')

      expect(completedBooks).toHaveLength(1)
      expect(inProgressBooks).toHaveLength(1)
      expect(notStartedBooks).toHaveLength(1)
    })

    test('應該能按提取時間篩選', () => {
      const thisWeekBooks = filterBooksByDate(mockBooksData, 'this-week')
      const thisMonthBooks = filterBooksByDate(mockBooksData, 'this-month')

      expect(thisWeekBooks.length).toBeGreaterThan(0)
      expect(thisMonthBooks).toHaveLength(3)
    })

    test('應該能按書籍類型篩選', () => {
      const ebookResults = filterBooksByType(mockBooksData, '電子書')

      expect(ebookResults).toHaveLength(3)
    })

    test('應該支援多重篩選條件', () => {
      const results = filterBooks(mockBooksData, {
        progress: 'completed',
        dateRange: 'this-week',
        type: '電子書'
      })

      expect(results.length).toBeLessThanOrEqual(1)
    })
  })

  describe('✏️ 資料管理功能', () => {
    test('應該能編輯書籍標題', () => {
      const bookId = 'cover-1'
      const newTitle = '修改後的書名'

      const result = editBookTitle(bookId, newTitle)

      expect(result.success).toBe(true)
      expect(global.booksData.find((b) => b.id === bookId).title).toBe(newTitle)
    })

    test('應該能編輯閱讀進度', () => {
      const bookId = 'cover-1'
      const newProgress = 75

      const result = editBookProgress(bookId, newProgress)

      expect(result.success).toBe(true)
      expect(global.booksData.find((b) => b.id === bookId).progress).toBe(newProgress)
    })

    test('應該能刪除書籍記錄', () => {
      const bookId = 'cover-2'
      const originalLength = global.booksData.length

      const result = deleteBook(bookId)

      expect(result.success).toBe(true)
      expect(global.booksData).toHaveLength(originalLength - 1)
      expect(global.booksData.find((b) => b.id === bookId)).toBeUndefined()
    })

    test('應該支援批量刪除', () => {
      const bookIds = ['cover-1', 'cover-2']
      const originalLength = global.booksData.length

      const result = batchDeleteBooks(bookIds)

      expect(result.success).toBe(true)
      expect(global.booksData).toHaveLength(originalLength - 2)
    })

    test('應該在編輯後即時更新UI', () => {
      const mockRenderTable = jest.fn()
      global.renderTable = mockRenderTable

      editBookTitle('cover-1', '新標題')

      expect(mockRenderTable).toHaveBeenCalled()
    })
  })

  describe('🔧 UI互動功能', () => {
    test('應該能開啟/關閉編輯模式', () => {
      const mockEditButton = { disabled: false }
      const mockCancelButton = { style: { display: 'none' } }

      enterEditMode('cover-1')

      expect(isEditMode()).toBe(true)

      exitEditMode()

      expect(isEditMode()).toBe(false)
    })

    test('應該能處理鍵盤快捷鍵', () => {
      const mockEvent = {
        key: 'Delete',
        ctrlKey: true,
        preventDefault: jest.fn()
      }

      const keyHandler = setupKeyboardShortcuts()
      keyHandler(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
    })
  })

  // 輔助函數（需要實際實現）
  function renderTable() {
    /* 實際的渲染邏輯 */
  }
  function createBookRow(book) {
    /* 建立書籍行的邏輯 */
  }
  function searchBooks(books, term) {
    /* 搜尋邏輯 */
  }
  // ... 其他輔助函數
})
```

---

## 🔄 Phase 2: 核心強化 (高優先級)

### 任務2.1: 去重邏輯測試套件

**目標**: 為穩定ID生成和去重邏輯建立完整測試  
**時程**: 1天  
**檔案**: `tests/unit/adapters/stable-id-generation.test.js`

#### 測試規格摘要

```javascript
describe('🔄 穩定ID生成與去重邏輯', () => {
  describe('generateStableBookId() 三層策略', () => {
    test('應該優先使用封面ID策略')
    test('應該在封面ID失敗時使用標題ID策略')
    test('應該在前兩者失敗時使用閱讀器ID策略')
    test('應該處理所有策略都失敗的情況')
  })

  describe('去重邏輯驗證', () => {
    test('應該正確識別相同ID的重複書籍')
    test('應該更新重複書籍的進度資訊')
    test('應該保留最新的extractedAt時間戳')
    test('應該處理ID衝突但內容不同的情況')
  })
})
```

### 任務2.2: 系統性錯誤處理測試

**目標**: 建立全面的錯誤處理和恢復測試  
**時程**: 1天  
**檔案**: `tests/integration/error-handling-scenarios.test.js`

---

## 📅 實施時程表

### Week 1: 緊急補強

- **Day 1**: 資料匯入功能測試套件
- **Day 2**: Overview頁面功能測試套件
- **Day 3**: 執行新測試並修正發現的問題
- **Day 4**: 去重邏輯測試套件
- **Day 5**: 系統性錯誤處理測試

### Week 2: 整合驗證

- **Day 1-2**: 端到端整合測試
- **Day 3-4**: 效能和壓力測試
- **Day 5**: 測試報告和覆蓋率驗證

## 🎯 成功標準

### 量化指標

- **UC-04 (資料匯入)**: 10% → 90% 測試覆蓋
- **UC-06 (資料檢視管理)**: 15% → 85% 測試覆蓋
- **UC-02 (去重邏輯)**: 65% → 90% 測試覆蓋
- **整體測試覆蓋**: 52% → 85% 覆蓋

### 質量標準

- 所有核心功能達到100%測試覆蓋
- 所有錯誤處理場景有對應測試
- 所有測試案例執行時間 < 30秒
- 測試通過率 100%

## 🚀 執行建議

### 立即開始

1. **建立資料匯入測試** - 這是最關鍵的缺口
2. **設置測試環境** - 確保mock環境完整
3. **逐步實施** - 每完成一個測試套件就執行驗證

### 注意事項

- 測試應該獨立且可重複執行
- Mock設置應該準確反映真實環境
- 測試資料應該覆蓋各種邊界情況
- 錯誤訊息應該清楚且有助於除錯

完成這個測試改進計劃後，v1.0將具備生產級別的測試品質，確保功能的穩定性和可靠性。
