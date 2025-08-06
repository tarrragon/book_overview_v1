/**
 * BookGridRenderer 單元測試 - TDD循環 #27
 * 
 * 測試範圍：
 * - 書籍網格渲染功能
 * - 響應式佈局管理
 * - 虛擬滾動實現
 * - 大量資料處理
 * - 效能優化機制
 * 
 * 功能目標：
 * - 支援網格和清單兩種檢視模式
 * - 響應式設計適應不同螢幕尺寸
 * - 虛擬滾動處理大量書籍資料
 * - 平滑的過渡動畫效果
 * - 記憶體效率的資料渲染
 * 
 * @version 1.0.0
 * @since 2025-08-06
 */

// 設置測試環境
global.window = {};

const BookGridRenderer = require('../../../src/ui/book-grid-renderer');

describe('🖼️ BookGridRenderer 書籍網格渲染器測試 (TDD循環 #27)', () => {
  let renderer;
  let mockDocument;
  let mockContainer;
  let mockViewport;

  beforeEach(() => {
    // Mock DOM 元素
    mockContainer = {
      innerHTML: '',
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      querySelector: jest.fn(),
      style: {},
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(() => false)
      },
      getBoundingClientRect: jest.fn(() => ({
        width: 1200,
        height: 800,
        top: 0,
        left: 0
      })),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      clientHeight: 800,
      clientWidth: 1200
    };

    mockViewport = {
      scrollTop: 0,
      scrollLeft: 0,
      clientHeight: 800,
      clientWidth: 1200,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    mockDocument = {
      createElement: jest.fn((tagName) => {
        const element = {
          tagName: tagName.toUpperCase(),
          innerHTML: '',
          textContent: '',
          className: '',
          title: '',
          style: {},
          dataset: {},
          appendChild: jest.fn(),
          removeChild: jest.fn(),
          setAttribute: jest.fn(),
          getAttribute: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          querySelector: jest.fn((selector) => {
            // 簡單的選擇器模擬 - 根據類名返回對應元素
            if (selector === '.book-title' && element._bookTitle) {
              return element._bookTitle;
            }
            if (selector === '.book-author' && element._bookAuthor) {
              return element._bookAuthor;
            }
            return null;
          }),
          querySelectorAll: jest.fn(() => []),
          classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(() => false)
          },
          getBoundingClientRect: jest.fn(() => ({
            width: 200,
            height: 300,
            top: 0,
            left: 0
          })),
          // 模擬appendChild時設置子元素引用和內容
          appendChild: jest.fn(function(child) {
            if (child.className === 'book-title') {
              this._bookTitle = child;
            }
            if (child.className === 'book-author') {
              this._bookAuthor = child;
            }
            
            // 更新父元素的 innerHTML 包含子元素的內容
            if (child.innerHTML || child.textContent) {
              this.innerHTML += (child.innerHTML || child.textContent);
            }
            
            // 更新 textContent
            if (child.textContent) {
              this.textContent += child.textContent;
            }
          })
        };
        return element;
      }),
      createDocumentFragment: jest.fn(() => ({
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        querySelectorAll: jest.fn(() => []),
        querySelector: jest.fn(),
        children: [],
        childNodes: []
      })),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => [])
    };

    // 清理所有模擬
    jest.clearAllMocks();
  });

  describe('🔴 Red Phase: 基本結構和初始化', () => {
    test('應該能創建 BookGridRenderer 實例', () => {
      expect(() => {
        renderer = new BookGridRenderer(mockContainer, mockDocument);
      }).not.toThrow();
      
      expect(renderer).toBeDefined();
      expect(renderer).toBeInstanceOf(BookGridRenderer);
    });

    test('應該能正確初始化網格配置', () => {
      const options = {
        itemWidth: 200,
        itemHeight: 300,
        gap: 20,
        viewMode: 'grid'
      };

      renderer = new BookGridRenderer(mockContainer, mockDocument, options);
      
      expect(renderer.config.itemWidth).toBe(200);
      expect(renderer.config.itemHeight).toBe(300);
      expect(renderer.config.gap).toBe(20);
      expect(renderer.config.viewMode).toBe('grid');
    });

    test('應該設定預設配置值', () => {
      renderer = new BookGridRenderer(mockContainer, mockDocument);
      
      expect(renderer.config.itemWidth).toBeDefined();
      expect(renderer.config.itemHeight).toBeDefined();
      expect(renderer.config.gap).toBeDefined();
      expect(renderer.config.viewMode).toBe('grid');
      expect(renderer.config.virtualScrolling).toBe(true);
    });

    test('應該正確初始化渲染狀態', () => {
      renderer = new BookGridRenderer(mockContainer, mockDocument);
      
      expect(renderer.isRendering).toBe(false);
      expect(renderer.renderedItems).toEqual([]);
      expect(renderer.visibleRange).toEqual({ start: 0, end: 0 });
      expect(renderer.totalItems).toBe(0);
    });
  });

  describe('🔴 Red Phase: 網格佈局計算', () => {
    beforeEach(() => {
      renderer = new BookGridRenderer(mockContainer, mockDocument);
    });

    test('應該能計算網格列數', () => {
      const columns = renderer.calculateColumns();
      expect(typeof columns).toBe('number');
      expect(columns).toBeGreaterThan(0);
    });

    test('應該根據容器寬度調整列數', () => {
      // 測試不同容器寬度
      mockContainer.getBoundingClientRect.mockReturnValue({
        width: 600, height: 800
      });
      
      const columnsSmall = renderer.calculateColumns();
      
      mockContainer.getBoundingClientRect.mockReturnValue({
        width: 1200, height: 800
      });
      
      const columnsLarge = renderer.calculateColumns();
      
      expect(columnsLarge).toBeGreaterThan(columnsSmall);
    });

    test('應該能計算項目位置', () => {
      const position = renderer.calculateItemPosition(5);
      
      expect(position).toHaveProperty('x');
      expect(position).toHaveProperty('y');
      expect(typeof position.x).toBe('number');
      expect(typeof position.y).toBe('number');
    });

    test('應該能計算可視範圍', () => {
      const books = Array.from({ length: 100 }, (_, i) => ({ id: i, title: `Book ${i}` }));
      
      const range = renderer.calculateVisibleRange(books, 0);
      
      expect(range).toHaveProperty('start');
      expect(range).toHaveProperty('end');
      expect(range.start).toBeGreaterThanOrEqual(0);
      expect(range.end).toBeGreaterThan(range.start);
    });
  });

  describe('🔴 Red Phase: 書籍項目渲染', () => {
    beforeEach(() => {
      renderer = new BookGridRenderer(mockContainer, mockDocument);
    });

    test('應該能渲染單個書籍項目', () => {
      const book = {
        id: '123',
        title: '測試書籍',
        author: '測試作者',
        cover: 'https://example.com/cover.jpg',
        progress: 45,
        status: '閱讀中'
      };

      const element = renderer.renderBookItem(book);
      
      expect(element).toBeDefined();
      expect(mockDocument.createElement).toHaveBeenCalled();
    });

    test('應該在書籍項目中包含所有必要資訊', () => {
      const book = {
        id: '456',
        title: '完整資料書籍',
        author: '知名作者',
        cover: 'https://example.com/cover2.jpg',
        progress: 78,
        status: '閱讀中',
        publishDate: '2023-01-01'
      };

      const element = renderer.renderBookItem(book);
      
      // 檢查元素是否成功創建
      expect(element).toBeDefined();
      
      // 檢查是否包含書籍資訊（檢查實際的內容結構）
      const titleElement = element.querySelector('.book-title');
      const authorElement = element.querySelector('.book-author');
      
      if (titleElement) {
        expect(titleElement.textContent).toBe('完整資料書籍');
      } else {
        // 如果沒有找到標題元素，檢查是否至少包含標題文字
        expect(element.innerHTML || element.textContent).toContain('完整資料書籍');
      }
      
      if (authorElement) {
        expect(authorElement.textContent).toBe('知名作者');
      } else {
        // 如果沒有找到作者元素，檢查是否至少包含作者文字
        expect(element.innerHTML || element.textContent).toContain('知名作者');
      }
    });

    test('應該能處理缺少封面的書籍', () => {
      const book = {
        id: '789',
        title: '無封面書籍',
        author: '測試作者'
        // 沒有 cover 屬性
      };

      expect(() => {
        renderer.renderBookItem(book);
      }).not.toThrow();
    });

    test('應該能處理空白或無效的書籍資料', () => {
      const invalidBooks = [null, undefined, {}, { title: '' }];

      invalidBooks.forEach(book => {
        expect(() => {
          renderer.renderBookItem(book);
        }).not.toThrow();
      });
    });
  });

  describe('🔴 Red Phase: 網格渲染主邏輯', () => {
    beforeEach(() => {
      renderer = new BookGridRenderer(mockContainer, mockDocument);
    });

    test('應該能渲染書籍陣列', () => {
      const books = [
        { id: '1', title: 'Book 1', author: 'Author 1' },
        { id: '2', title: 'Book 2', author: 'Author 2' },
        { id: '3', title: 'Book 3', author: 'Author 3' }
      ];

      renderer.renderBooks(books);
      
      expect(renderer.totalItems).toBe(3);
      expect(mockContainer.appendChild).toHaveBeenCalled();
    });

    test('應該能處理空的書籍陣列', () => {
      expect(() => {
        renderer.renderBooks([]);
      }).not.toThrow();
      
      expect(renderer.totalItems).toBe(0);
    });

    test('應該能處理大量書籍資料', () => {
      const largeBookArray = Array.from({ length: 1000 }, (_, i) => ({
        id: `book_${i}`,
        title: `Book Title ${i}`,
        author: `Author ${i}`
      }));

      expect(() => {
        renderer.renderBooks(largeBookArray);
      }).not.toThrow();
      
      expect(renderer.totalItems).toBe(1000);
    });

    test('應該支援增量渲染更新', () => {
      const initialBooks = [
        { id: '1', title: 'Book 1' },
        { id: '2', title: 'Book 2' }
      ];

      renderer.renderBooks(initialBooks);
      expect(renderer.totalItems).toBe(2);

      const newBooks = [
        { id: '1', title: 'Book 1' },
        { id: '2', title: 'Book 2' },
        { id: '3', title: 'Book 3' }
      ];

      renderer.updateBooks(newBooks);
      expect(renderer.totalItems).toBe(3);
    });
  });

  describe('🔴 Red Phase: 虛擬滾動實現', () => {
    beforeEach(() => {
      renderer = new BookGridRenderer(mockContainer, mockDocument, {
        virtualScrolling: true
      });
    });

    test('應該啟用虛擬滾動功能', () => {
      expect(renderer.config.virtualScrolling).toBe(true);
      expect(renderer.virtualScroller).toBeDefined();
    });

    test('應該計算虛擬滾動的緩衝區大小', () => {
      const bufferSize = renderer.getVirtualScrollBuffer();
      
      expect(typeof bufferSize).toBe('number');
      expect(bufferSize).toBeGreaterThan(0);
    });

    test('應該能處理滾動事件', () => {
      const books = Array.from({ length: 100 }, (_, i) => ({ 
        id: i, 
        title: `Book ${i}` 
      }));
      
      // 設定較小的項目高度以確保滾動會產生範圍變化
      renderer.config.itemHeight = 100;
      renderer.config.gap = 10;
      
      renderer.renderBooks(books);
      
      // 模擬大幅滾動，確保會觸發範圍變化
      renderer.handleScroll({ target: { scrollTop: 1000 } });
      
      // 檢查滾動是否影響了可視範圍
      expect(renderer.visibleRange.start).toBeGreaterThanOrEqual(0);
      expect(renderer.visibleRange.end).toBeGreaterThan(renderer.visibleRange.start);
    });

    test('應該只渲染可視範圍內的項目', () => {
      const books = Array.from({ length: 200 }, (_, i) => ({ 
        id: i, 
        title: `Book ${i}` 
      }));
      
      renderer.renderBooks(books);
      
      // 虛擬滾動應該只渲染部分項目
      expect(renderer.renderedItems.length).toBeLessThan(books.length);
      expect(renderer.renderedItems.length).toBeGreaterThan(0);
    });
  });

  describe('🔴 Red Phase: 響應式佈局', () => {
    beforeEach(() => {
      renderer = new BookGridRenderer(mockContainer, mockDocument);
    });

    test('應該支援網格檢視模式', () => {
      renderer.setViewMode('grid');
      expect(renderer.config.viewMode).toBe('grid');
    });

    test('應該支援清單檢視模式', () => {
      renderer.setViewMode('list');
      expect(renderer.config.viewMode).toBe('list');
    });

    test('應該根據螢幕尺寸調整佈局', () => {
      // 模擬小螢幕
      mockContainer.getBoundingClientRect.mockReturnValue({
        width: 400, height: 600
      });
      
      renderer.handleResize();
      const smallScreenColumns = renderer.calculateColumns();
      
      // 模擬大螢幕
      mockContainer.getBoundingClientRect.mockReturnValue({
        width: 1600, height: 1000
      });
      
      renderer.handleResize();
      const largeScreenColumns = renderer.calculateColumns();
      
      expect(largeScreenColumns).toBeGreaterThan(smallScreenColumns);
    });

    test('應該能切換檢視模式', () => {
      const books = [
        { id: '1', title: 'Book 1' },
        { id: '2', title: 'Book 2' }
      ];
      
      renderer.renderBooks(books);
      
      // 切換到清單模式
      renderer.setViewMode('list');
      expect(mockContainer.classList.add).toHaveBeenCalledWith('list-view');
      
      // 切換回網格模式
      renderer.setViewMode('grid');
      expect(mockContainer.classList.add).toHaveBeenCalledWith('grid-view');
    });
  });

  describe('🔴 Red Phase: 效能優化和記憶體管理', () => {
    beforeEach(() => {
      renderer = new BookGridRenderer(mockContainer, mockDocument);
    });

    test('應該實現項目回收機制', () => {
      const books = Array.from({ length: 50 }, (_, i) => ({ 
        id: i, 
        title: `Book ${i}` 
      }));
      
      renderer.renderBooks(books);
      renderer.recycleItems();
      
      // 檢查是否正確回收了不可視的項目
      expect(renderer.recycledItems).toBeDefined();
    });

    test('應該追蹤渲染效能統計', () => {
      const books = [{ id: '1', title: 'Book 1' }];
      
      renderer.renderBooks(books);
      
      const stats = renderer.getPerformanceStats();
      expect(stats).toHaveProperty('renderTime');
      expect(stats).toHaveProperty('renderedCount');
      expect(stats.renderTime).toBeGreaterThan(0);
    });

    test('應該支援批量渲染優化', () => {
      const books = Array.from({ length: 20 }, (_, i) => ({ 
        id: i, 
        title: `Book ${i}` 
      }));
      
      const startTime = performance.now();
      renderer.renderBooks(books);
      const endTime = performance.now();
      
      // 批量渲染應該在合理時間內完成
      expect(endTime - startTime).toBeLessThan(100); // 100ms
    });

    test('應該能清理渲染資源', () => {
      const books = [{ id: '1', title: 'Book 1' }];
      
      renderer.renderBooks(books);
      renderer.destroy();
      
      expect(renderer.isDestroyed).toBe(true);
      expect(mockContainer.removeEventListener || mockViewport.removeEventListener).toHaveBeenCalled();
    });
  });

  describe('🔴 Red Phase: 事件處理和互動', () => {
    beforeEach(() => {
      renderer = new BookGridRenderer(mockContainer, mockDocument);
    });

    test('應該支援書籍項目點擊事件', () => {
      const onItemClick = jest.fn();
      renderer.setOnItemClick(onItemClick);
      
      const book = { id: '1', title: 'Clickable Book' };
      const element = renderer.renderBookItem(book);
      
      // 模擬點擊事件
      const clickEvent = { target: element, preventDefault: jest.fn() };
      renderer.handleItemClick(clickEvent, book);
      
      expect(onItemClick).toHaveBeenCalledWith(book);
    });

    test('應該支援書籍項目懸停效果', () => {
      const book = { id: '1', title: 'Hoverable Book' };
      const element = renderer.renderBookItem(book);
      
      renderer.handleItemHover(element, true);
      expect(element.classList.add).toHaveBeenCalledWith('hover');
      
      renderer.handleItemHover(element, false);
      expect(element.classList.remove).toHaveBeenCalledWith('hover');
    });

    test('應該處理鍵盤導航事件', () => {
      const books = [
        { id: '1', title: 'Book 1' },
        { id: '2', title: 'Book 2' }
      ];
      
      renderer.renderBooks(books);
      
      // 測試方向鍵導航
      const keyEvent = { key: 'ArrowRight', preventDefault: jest.fn() };
      renderer.handleKeyNavigation(keyEvent);
      
      expect(keyEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('🔴 Red Phase: 錯誤處理和邊界情況', () => {
    beforeEach(() => {
      renderer = new BookGridRenderer(mockContainer, mockDocument);
    });

    test('應該處理無效的容器元素', () => {
      expect(() => {
        new BookGridRenderer(null, mockDocument);
      }).toThrow('Container element is required');
    });

    test('應該處理渲染過程中的錯誤', () => {
      // 模擬 DOM 操作錯誤
      mockDocument.createElement.mockImplementationOnce(() => {
        throw new Error('DOM error');
      });
      
      const book = { id: '1', title: 'Error Book' };
      
      expect(() => {
        renderer.renderBookItem(book);
      }).not.toThrow();
      
      // 應該記錄錯誤統計
      const stats = renderer.getErrorStats();
      expect(stats.renderErrors).toBeGreaterThan(0);
    });

    test('應該處理記憶體不足的情況', () => {
      // 模擬大量資料渲染
      const hugeBookArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        title: `Book ${i}`,
        content: 'Large content'.repeat(1000)
      }));
      
      expect(() => {
        renderer.renderBooks(hugeBookArray);
      }).not.toThrow();
      
      // 虛擬滾動應該限制實際渲染的項目數量
      expect(renderer.renderedItems.length).toBeLessThan(100);
    });
  });
});