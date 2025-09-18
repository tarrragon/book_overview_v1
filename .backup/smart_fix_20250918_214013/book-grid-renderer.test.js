/**
 * BookGridRenderer 單元測試 - TDD 循環 #27
 *
 * 負責功能：
 * - 書籍網格渲染和佈局管理
 * - 響應式設計適配不同螢幕尺寸
 * - 虛擬滾動支援大量資料處理
 * - 書籍卡片互動功能
 * - 效能優化和記憶體管理
 *
 * 測試涵蓋範圍：
 * - 基本結構和初始化
 * - 網格渲染和佈局計算
 * - 響應式設計和螢幕適配
 * - 虛擬滾動功能
 * - 資料更新和重新渲染
 * - 效能優化機制
 * - 錯誤處理和邊界條件
 *
 * @version 1.0.0
 * @since 2025-08-07
 */

// 測試環境設定
require('../../test-setup')
const { StandardError } = require('src/core/errors/StandardError')

describe('BookGridRenderer - TDD 循環 #27', () => {
  let renderer
  let mockDocument
  let mockContainer
  let mockEventBus

  // 測試輔助函數
  const setupRequestAnimationFrame = () => {
    global.requestAnimationFrame = jest.fn((callback) => {
      setTimeout(callback, 0)
      return 1
    })
  }

  const waitForAsyncRender = (callback, timeout = 10) => {
    setTimeout(callback, timeout)
  }

  beforeEach(() => {
    // 模擬 DOM 環境
    mockContainer = {
      appendChild: jest.fn().mockImplementation(function (element) {
        element.parentNode = this
        return element
      }),
      removeChild: jest.fn().mockImplementation(function (element) {
        element.parentNode = null
        return element
      }),
      scrollTop: 0,
      scrollHeight: 1000,
      clientHeight: 400,
      getBoundingClientRect: jest.fn().mockReturnValue({
        width: 800,
        height: 400
      }),
      style: {},
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn()
      },
      querySelector: jest.fn(),
      querySelectorAll: jest.fn().mockReturnValue([])
    }

    mockDocument = {
      createElement: jest.fn((tag) => {
        const element = {
          tagName: tag.toUpperCase(),
          style: {},
          className: '',
          attributes: new Map(),
          parentNode: null,
          classList: {
            add: jest.fn(function (cls) {
              element.className += (element.className ? ' ' : '') + cls
            }),
            remove: jest.fn(function (cls) {
              element.className = element.className.replace(cls, '').trim()
            }),
            contains: jest.fn(function (cls) {
              return element.className.includes(cls)
            })
          },
          setAttribute: jest.fn(function (name, value) {
            element.attributes.set(name, value)
          }),
          getAttribute: jest.fn(function (name) {
            return element.attributes.get(name)
          }),
          appendChild: jest.fn(),
          removeChild: jest.fn(),
          textContent: '',
          innerHTML: '',
          addEventListener: jest.fn(),
          removeEventListener: jest.fn()
        }
        return element
      }),
      querySelector: jest.fn().mockReturnValue(mockContainer),
      querySelectorAll: jest.fn().mockReturnValue([])
    }

    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    }

    // 清除 require 快取以確保每次測試都獲得新的實例
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('🏗 基本結構和初始化', () => {
    test('應該能夠創建 BookGridRenderer 實例', () => {
      expect(() => {
        const BookGridRenderer = require('src/ui/book-grid-renderer')
        renderer = new BookGridRenderer(mockContainer, mockEventBus, {}, mockDocument)
      }).not.toThrow()
    })

    test('應該支援 document 依賴注入', () => {
      const BookGridRenderer = require('src/ui/book-grid-renderer')
      renderer = new BookGridRenderer(mockContainer, mockEventBus, {}, mockDocument)

      // 驗證注入的 document 被正確設置
      expect(renderer.document).toBe(mockDocument)
    })

    test('應該在沒有注入 document 時使用全域 document', () => {
      const BookGridRenderer = require('src/ui/book-grid-renderer')
      const originalDocument = global.document

      // 模擬瀏覽器環境
      global.document = { createElement: jest.fn() }
      global.window = { document: global.document }

      // 不傳入 document 參數，期望使用全域 document
      renderer = new BookGridRenderer(mockContainer, mockEventBus, {})

      // 應該使用全域 document
      expect(renderer.document).toBe(global.document)

      // 清理
      global.document = originalDocument
      delete global.window
    })

    test('應該正確初始化基本屬性', () => {
      const BookGridRenderer = require('src/ui/book-grid-renderer')
      renderer = new BookGridRenderer(mockContainer, mockEventBus, {}, mockDocument)

      expect(renderer.container).toBe(mockContainer)
      expect(renderer.eventBus).toBe(mockEventBus)
      expect(renderer.books).toEqual([])
      expect(renderer.renderedBooks).toEqual([])
    })

    test('應該初始化預設配置', () => {
      const BookGridRenderer = require('src/ui/book-grid-renderer')
      renderer = new BookGridRenderer(mockContainer, mockEventBus, {}, mockDocument)

      expect(renderer.config).toBeDefined()
      expect(renderer.config.cardWidth).toBeGreaterThan(0)
      expect(renderer.config.cardHeight).toBeGreaterThan(0)
      expect(renderer.config.gap).toBeDefined()
      expect(renderer.config.virtualScrolling).toBe(true)
    })

    test('應該註冊事件監聽器', () => {
      const BookGridRenderer = require('src/ui/book-grid-renderer')
      renderer = new BookGridRenderer(mockContainer, mockEventBus, {}, mockDocument)

      expect(mockEventBus.on).toHaveBeenCalledWith('UI.BOOKS.UPDATE', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('UI.BOOKS.FILTER', expect.any(Function))
    })

    test('應該初始化統計追蹤', () => {
      const BookGridRenderer = require('src/ui/book-grid-renderer')
      renderer = new BookGridRenderer(mockContainer, mockEventBus, {}, mockDocument)

      expect(renderer.stats).toBeDefined()
      expect(renderer.stats.totalBooks).toBe(0)
      expect(renderer.stats.renderedBooks).toBe(0)
      expect(renderer.stats.renderTime).toBe(0)
    })
  })

  describe('📐 網格計算和佈局', () => {
    beforeEach(() => {
      const BookGridRenderer = require('src/ui/book-grid-renderer')
      renderer = new BookGridRenderer(mockContainer, mockEventBus, {}, mockDocument)
    })

    test('應該正確計算網格欄位數量', () => {
      const columns = renderer.calculateColumns(800) // 容器寬度

      expect(columns).toBeGreaterThan(0)
      expect(typeof columns).toBe('number')
    })

    test('應該根據螢幕寺寸調整欄位數量', () => {
      const mobileColumns = renderer.calculateColumns(320) // 手機
      const tabletColumns = renderer.calculateColumns(768) // 平板
      const desktopColumns = renderer.calculateColumns(1200) // 桌面

      expect(mobileColumns).toBeLessThan(tabletColumns)
      expect(tabletColumns).toBeLessThan(desktopColumns)
    })

    test('應該計算每個書籍卡片的位置', () => {
      const books = Array.from({ length: 10 }, (_, i) => ({
        id: `book-${i}`,
        title: `Book ${i}`
      }))

      const positions = renderer.calculatePositions(books, 3) // 3 欄位

      expect(positions).toHaveLength(10)
      expect(positions[0]).toEqual({ row: 0, col: 0, x: expect.any(Number), y: expect.any(Number) })
      expect(positions[3]).toEqual({ row: 1, col: 0, x: expect.any(Number), y: expect.any(Number) })
    })

    test('應該計算容器總高度', () => {
      const books = Array.from({ length: 10 }, (_, i) => ({ id: `book-${i}` }))
      const height = renderer.calculateTotalHeight(books, 3)

      expect(height).toBeGreaterThan(0)
      expect(typeof height).toBe('number')
    })
  })

  describe('🖼 書籍卡片渲染', () => {
    beforeEach(() => {
      const BookGridRenderer = require('src/ui/book-grid-renderer')
      // 使用依賴注入來支援測試
      renderer = new BookGridRenderer(mockContainer, mockEventBus, {}, mockDocument)
    })

    test('應該創建書籍卡片元素', () => {
      const book = {
        id: 'test-book',
        title: '測試書籍',
        coverImage: 'test-cover.jpg',
        progress: 50
      }

      const card = renderer.createBookCard(book)

      // 驗證 document.createElement 被調用
      expect(mockDocument.createElement).toHaveBeenCalledWith('div')

      // 驗證卡片元素被正確設置
      expect(card).toBeDefined()
      expect(card.tagName).toBe('DIV')

      // 驗證行為結果而非實現細節
      expect(card.classList.add).toHaveBeenCalledWith('book-card')
    })

    test('應該正確設定書籍卡片內容', () => {
      const book = {
        id: 'test-book',
        title: '測試書籍',
        author: '測試作者',
        coverImage: 'test-cover.jpg',
        progress: 75,
        status: 'reading'
      }

      const card = renderer.createBookCard(book)

      // 驗證 DOM 操作被正確調用
      expect(card.setAttribute).toHaveBeenCalledWith('data-book-id', 'test-book')

      // 額外驗證：檢查屬性是否真的被設置
      expect(card.getAttribute('data-book-id')).toBe('test-book')
    })

    test('應該處理缺少封面圖片的情況', () => {
      const book = {
        id: 'test-book',
        title: '無封面書籍'
      }

      const card = renderer.createBookCard(book)

      expect(card).toBeDefined()
      // 應該使用預設封面或佔位圖
    })

    test('應該添加書籍狀態樣式類別', () => {
      const book = {
        id: 'test-book',
        title: '測試書籍',
        status: 'completed'
      }

      const card = renderer.createBookCard(book)

      expect(card.classList.add).toHaveBeenCalledWith('status-completed')
    })

    test('應該添加進度指示器', () => {
      const book = {
        id: 'test-book',
        title: '測試書籍',
        progress: 60
      }

      renderer.createBookCard(book)

      // 檢查是否創建了進度指示器元素
      expect(mockDocument.createElement).toHaveBeenCalledWith('div')
    })
  })

  describe('📱 響應式設計', () => {
    beforeEach(() => {
      const BookGridRenderer = require('src/ui/book-grid-renderer')
      renderer = new BookGridRenderer(mockContainer, mockEventBus, {}, mockDocument)
    })

    test('應該響應容器尺寸變化', (done) => {
      const originalWidth = 800
      const newWidth = 400

      // 記錄原始欄位數
      const originalColumns = renderer.calculateColumns(originalWidth)

      // 模擬尺寸變化
      mockContainer.getBoundingClientRect = jest.fn().mockReturnValue({
        width: newWidth,
        height: 400
      })

      renderer.handleResize()

      // handleResize 是異步的，需要等待
      setTimeout(() => {
        const newColumns = renderer.currentColumns
        expect(newColumns).toBeLessThan(originalColumns)
        done()
      }, 150) // 等待 throttleDelay
    })

    test('應該在小螢幕上使用單欄佈局', () => {
      mockContainer.getBoundingClientRect = jest.fn().mockReturnValue({
        width: 320, // 手機寬度
        height: 400
      })

      const columns = renderer.calculateColumns(320)
      expect(columns).toBe(1)
    })

    test('應該在大螢幕上使用多欄佈局', () => {
      mockContainer.getBoundingClientRect = jest.fn().mockReturnValue({
        width: 1200, // 桌面寬度
        height: 800
      })

      const columns = renderer.calculateColumns(1200)
      expect(columns).toBeGreaterThan(3)
    })

    test('應該調整卡片間距適應不同螢幕', () => {
      const mobileGap = renderer.calculateGap(320)
      const desktopGap = renderer.calculateGap(1200)

      expect(mobileGap).toBeLessThan(desktopGap)
    })
  })

  describe('🔄 虛擬滾動功能', () => {
    beforeEach(() => {
      const BookGridRenderer = require('src/ui/book-grid-renderer')
      renderer = new BookGridRenderer(mockContainer, mockEventBus, {}, mockDocument)
    })

    test('應該計算可見區域範圍', () => {
      const books = Array.from({ length: 100 }, (_, i) => ({ id: `book-${i}` }))
      renderer.updateBooks(books)

      const visibleRange = renderer.calculateVisibleRange()

      expect(visibleRange.start).toBeGreaterThanOrEqual(0)
      expect(visibleRange.end).toBeLessThanOrEqual(100)
      expect(visibleRange.start).toBeLessThan(visibleRange.end)
    })

    test('應該只渲染可見的書籍', (done) => {
      const books = Array.from({ length: 100 }, (_, i) => ({ id: `book-${i}`, title: `Book ${i}` }))

      setupRequestAnimationFrame()

      renderer.updateBooks(books)
      renderer.renderVisibleBooks()

      waitForAsyncRender(() => {
        // 應該只渲染部分書籍，不是全部100本
        expect(mockContainer.appendChild.mock.calls.length).toBeLessThan(100)
        expect(mockContainer.appendChild.mock.calls.length).toBeGreaterThan(0)
        done()
      })
    })

    test('應該在滾動時更新可見範圍', () => {
      const books = Array.from({ length: 100 }, (_, i) => ({ id: `book-${i}` }))
      renderer.updateBooks(books)

      // 模擬滾動
      mockContainer.scrollTop = 500
      renderer.handleScroll()

      expect(renderer.visibleRange).toBeDefined()
    })

    test('應該重用 DOM 元素以提高效能', () => {
      const books = Array.from({ length: 50 }, (_, i) => ({ id: `book-${i}` }))
      renderer.updateBooks(books)

      renderer.renderVisibleBooks()
      const initialCallCount = mockDocument.createElement.mock.calls.length

      // 模擬滾動，應該重用現有元素
      mockContainer.scrollTop = 200
      renderer.handleScroll()

      // createElement 的調用次數不應該大幅增加
      expect(mockDocument.createElement.mock.calls.length).toBeLessThanOrEqual(initialCallCount * 1.5)
    })
  })

  describe('📊 資料更新和重新渲染', () => {
    beforeEach(() => {
      const BookGridRenderer = require('src/ui/book-grid-renderer')
      renderer = new BookGridRenderer(mockContainer, mockEventBus, {}, mockDocument)
    })

    test('應該更新書籍資料並重新渲染', (done) => {
      const books = [
        { id: 'book-1', title: 'Book 1' },
        { id: 'book-2', title: 'Book 2' }
      ]

      setupRequestAnimationFrame()

      renderer.updateBooks(books)

      expect(renderer.books).toEqual(books)

      waitForAsyncRender(() => {
        expect(mockContainer.appendChild).toHaveBeenCalled()
        done()
      })
    })

    test('應該處理空書籍清單', () => {
      renderer.updateBooks([])

      expect(renderer.books).toEqual([])
      expect(renderer.stats.totalBooks).toBe(0)
    })

    test('應該處理重複的書籍 ID', () => {
      const books = [
        { id: 'book-1', title: 'Book 1' },
        { id: 'book-1', title: 'Book 1 Duplicate' } // 重複 ID
      ]

      expect(() => renderer.updateBooks(books)).not.toThrow()
    })

    test('應該在資料變更時觸發重新渲染', () => {
      const books = [{ id: 'book-1', title: 'Book 1' }]
      renderer.updateBooks(books)

      // 更新書籍資料
      const updatedBooks = [{ id: 'book-1', title: 'Updated Book 1' }]
      renderer.updateBooks(updatedBooks)

      expect(renderer.books[0].title).toBe('Updated Book 1')
    })

    test('應該保持滾動位置', () => {
      const books = Array.from({ length: 50 }, (_, i) => ({ id: `book-${i}` }))
      mockContainer.scrollTop = 300

      renderer.updateBooks(books, { preserveScrollPosition: true })

      expect(mockContainer.scrollTop).toBe(300)
    })
  })

  describe('⚡ 效能優化', () => {
    beforeEach(() => {
      const BookGridRenderer = require('src/ui/book-grid-renderer')
      renderer = new BookGridRenderer(mockContainer, mockEventBus, {}, mockDocument)
    })

    test('應該使用 requestAnimationFrame 優化渲染', () => {
      global.requestAnimationFrame = jest.fn()

      const books = [{ id: 'book-1', title: 'Book 1' }]
      renderer.updateBooks(books)

      expect(global.requestAnimationFrame).toHaveBeenCalled()
    })

    test('應該防抖滾動事件', () => {
      jest.useFakeTimers()

      const books = Array.from({ length: 100 }, (_, i) => ({ id: `book-${i}` }))
      renderer.updateBooks(books)

      // 快速觸發多次滾動
      renderer.handleScroll()
      renderer.handleScroll()
      renderer.handleScroll()

      // 應該只執行一次真正的渲染更新
      jest.advanceTimersByTime(100)

      jest.useRealTimers()
    })

    test('應該追蹤渲染效能指標', (done) => {
      const books = Array.from({ length: 20 }, (_, i) => ({ id: `book-${i}`, title: `Book ${i}` }))

      setupRequestAnimationFrame()

      renderer.updateBooks(books)

      waitForAsyncRender(() => {
        expect(renderer.stats.renderTime).toBeGreaterThan(0)
        expect(renderer.stats.renderedBooks).toBeGreaterThan(0)
        done()
      })
    })

    test('應該清理未使用的 DOM 元素', (done) => {
      const books = Array.from({ length: 10 }, (_, i) => ({ id: `book-${i}`, title: `Book ${i}` }))

      setupRequestAnimationFrame()

      renderer.updateBooks(books)

      waitForAsyncRender(() => {
        // 清除之前的調用記錄
        mockContainer.removeChild.mockClear()

        // 減少書籍數量，觸發清理
        const fewerBooks = books.slice(0, 5)
        renderer.updateBooks(fewerBooks)

        waitForAsyncRender(() => {
          expect(mockContainer.removeChild).toHaveBeenCalled()
          done()
        })
      })
    })
  })

  describe('🔧 錯誤處理', () => {
    beforeEach(() => {
      const BookGridRenderer = require('src/ui/book-grid-renderer')
      renderer = new BookGridRenderer(mockContainer, mockEventBus, {}, mockDocument)
    })

    test('應該處理無效的書籍資料', () => {
      const invalidBooks = [
        null,
        undefined,
        {}, // 沒有 id
        { id: 'valid', title: 'Valid Book' }
      ]

      expect(() => renderer.updateBooks(invalidBooks)).not.toThrow()
      expect(renderer.books.length).toBe(1) // 只有有效的書籍
    })

    test('應該處理容器不存在的情況', () => {
      expect(() => {
        const BookGridRenderer = require('src/ui/book-grid-renderer')
        const renderer = new BookGridRenderer(null, mockEventBus)
        // 變數賦值確保 new 的結果被正確處理，測試建構子錯誤
      }).toThrow()
    })

    test('應該處理事件總線錯誤', () => {
      mockEventBus.emit = jest.fn().mockImplementation(() => {
        throw new StandardError('GRID_EVENT_BUS_ERROR', 'Event bus error', { category: 'testing' })
      })

      expect(() => {
        renderer.notifyRenderComplete()
      }).not.toThrow()
    })

    test('應該在 DOM 操作失敗時優雅降級', () => {
      mockContainer.appendChild = jest.fn().mockImplementation(() => {
        throw new StandardError('GRID_DOM_OPERATION_ERROR', 'DOM error', { category: 'testing' })
      })

      const books = [{ id: 'book-1', title: 'Book 1' }]

      expect(() => renderer.updateBooks(books)).not.toThrow()
    })
  })

  describe('🎯 邊界條件測試', () => {
    beforeEach(() => {
      const BookGridRenderer = require('src/ui/book-grid-renderer')
      renderer = new BookGridRenderer(mockContainer, mockEventBus, {}, mockDocument)
    })

    test('應該處理極大量書籍資料', () => {
      const manyBooks = Array.from({ length: 10000 }, (_, i) => ({
        id: `book-${i}`,
        title: `Book ${i}`
      }))

      expect(() => renderer.updateBooks(manyBooks)).not.toThrow()
      expect(renderer.stats.totalBooks).toBe(10000)
    })

    test('應該處理零寬度容器', () => {
      mockContainer.getBoundingClientRect = jest.fn().mockReturnValue({
        width: 0,
        height: 400
      })

      expect(() => {
        renderer.calculateColumns(0)
      }).not.toThrow()
    })

    test('應該處理負數進度值', () => {
      const book = {
        id: 'test-book',
        title: 'Test Book',
        progress: -10 // 負數進度
      }

      expect(() => renderer.createBookCard(book)).not.toThrow()
    })

    test('應該處理超過100%的進度值', () => {
      const book = {
        id: 'test-book',
        title: 'Test Book',
        progress: 150 // 超過100%
      }

      expect(() => renderer.createBookCard(book)).not.toThrow()
    })
  })
})
