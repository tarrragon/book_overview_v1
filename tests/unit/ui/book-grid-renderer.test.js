/**
 * BookGridRenderer 書籍網格渲染系統測試 - TDD循環 #27 (Red Phase)
 * 
 * 🔴 Red Phase 測試設計目標：
 * 
 * 核心功能測試覆蓋：
 * ========================
 * 1. 基本結構和初始化 (5個測試)
 * 2. 網格佈局計算系統 (4個測試) 
 * 3. 書籍項目渲染引擎 (4個測試)
 * 4. 網格渲染主邏輯 (4個測試)
 * 5. 虛擬滾動實現 (4個測試)
 * 6. 響應式佈局系統 (3個測試)
 * 7. 效能優化和記憶體管理 (4個測試)
 * 8. 事件處理和互動 (3個測試)
 * 9. 錯誤處理和邊界情況 (3個測試)
 * 
 * 測試架構特性：
 * ================
 * - 事件驅動架構整合測試
 * - 與 Overview 頁面控制器無縫銜接
 * - 虛擬滾動大量資料處理能力
 * - 響應式設計和多螢幕尺寸支援
 * - 完整的錯誤處理和邊界條件覆蓋
 * - 效能監控和記憶體管理驗證
 * 
 * TDD Red Phase 目標：
 * ===================
 * - 所有測試必須在紅燈階段失敗
 * - 測試案例完整涵蓋需求規格
 * - 清楚的測試分組和描述
 * - 為 Green Phase 實現提供明確指導
 * 
 * @version 1.0.0
 * @since 2025-08-07
 * @phase RED - 測試優先設計階段
 */

// ===============================
// 測試環境設定和模擬
// ===============================

// 設置測試環境
global.window = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

global.performance = {
  now: jest.fn(() => Date.now())
};

global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 16));

const BookGridRenderer = require('../../../src/ui/book-grid-renderer');

// 測試資料定義
const MOCK_BOOKS = {
  SINGLE: {
    id: 'test-001',
    title: '測試書籍',
    author: '測試作者',
    cover: 'https://example.com/cover.jpg',
    progress: 45,
    status: '閱讀中',
    category: '程式設計',
    publishDate: '2023-01-15',
    rating: 4.5
  },
  MULTIPLE: Array.from({ length: 10 }, (_, i) => ({
    id: `book-${i + 1}`,
    title: `書籍標題 ${i + 1}`,
    author: `作者 ${i + 1}`,
    cover: `https://example.com/cover-${i + 1}.jpg`,
    progress: (i + 1) * 10,
    status: i % 2 === 0 ? '閱讀中' : '已完成',
    category: i % 3 === 0 ? '程式設計' : '文學',
    publishDate: `2023-0${(i % 12) + 1}-15`,
    rating: 3 + (i % 3)
  })),
  LARGE_DATASET: Array.from({ length: 1000 }, (_, i) => ({
    id: `large-book-${i + 1}`,
    title: `大型資料集書籍 ${i + 1}`,
    author: `大型資料集作者 ${i + 1}`,
    progress: Math.floor(Math.random() * 100),
    status: ['未開始', '閱讀中', '已完成'][i % 3],
    category: ['程式設計', '文學', '商業', '科學'][i % 4]
  }))
};

describe('🖼️ BookGridRenderer 書籍網格渲染系統測試 (TDD循環 #27 - Red Phase)', () => {
  // 測試實例和模擬物件
  let renderer;
  let mockDocument;
  let mockContainer;
  let mockViewport;
  let mockEventBus;
  let consoleErrorSpy;

  // ===============================
  // 測試設定和清理
  // ===============================

  beforeEach(() => {
    // 重置效能計時器
    performance.now.mockReturnValue(1000);
    
    // 監控 console.error 以便測試錯誤處理
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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

  afterEach(() => {
    // 清理 renderer 資源
    if (renderer && typeof renderer.destroy === 'function') {
      renderer.destroy();
    }
    
    // 恢復 console.error
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
  });

  // ===============================
  // 測試組 1: 基本結構和初始化
  // ===============================

  describe('🔴 Red Phase: 基本結構和初始化 (5/5 測試)', () => {
    beforeEach(() => {
      renderer = new BookGridRenderer(mockContainer, mockDocument);
    });

    test('T27-001: 應該能創建 BookGridRenderer 實例並繼承 EventHandler', () => {
      // 測試目標：驗證 BookGridRenderer 正確創建並繼承 EventHandler 架構
      expect(() => {
        renderer = new BookGridRenderer(mockContainer, mockDocument);
      }).not.toThrow();
      
      // 基本實例驗證
      expect(renderer).toBeDefined();
      expect(renderer).toBeInstanceOf(BookGridRenderer);
      
      // 事件系統整合驗證 (這裡應該失敗，因為還未實現 EventHandler 繼承)
      expect(renderer.eventBus).toBeDefined();
      expect(typeof renderer.handle).toBe('function');
      expect(typeof renderer.emit).toBe('function');
    });

    test('T27-002: 應該能正確初始化網格配置和事件設定', () => {
      // 測試目標：驗證配置合併和事件系統初始化
      const options = {
        itemWidth: 200,
        itemHeight: 300,
        gap: 20,
        viewMode: 'grid',
        virtualScrolling: true,
        eventBus: mockEventBus
      };

      renderer = new BookGridRenderer(mockContainer, mockDocument, options);
      
      // 基本配置驗證
      expect(renderer.config.itemWidth).toBe(200);
      expect(renderer.config.itemHeight).toBe(300);
      expect(renderer.config.gap).toBe(20);
      expect(renderer.config.viewMode).toBe('grid');
      
      // 事件相關配置驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.eventHandlers).toBeDefined();
      expect(renderer.eventListeners).toBeDefined();
    });

    test('T27-003: 應該設定預設配置值和事件訂閱', () => {
      // 測試目標：驗證預設配置值和事件訂閱機制
      renderer = new BookGridRenderer(mockContainer, mockDocument);
      
      // 預設配置驗證
      expect(renderer.config.itemWidth).toBeDefined();
      expect(renderer.config.itemHeight).toBeDefined();
      expect(renderer.config.gap).toBeDefined();
      expect(renderer.config.viewMode).toBe('grid');
      expect(renderer.config.virtualScrolling).toBe(true);
      
      // 事件訂閱驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.subscribedEvents).toEqual([
        'UI.BOOKS.UPDATE',
        'STORAGE.LOAD.COMPLETED',
        'UI.GRID.REFRESH',
        'UI.VIEW_MODE.CHANGED'
      ]);
    });

    test('T27-004: 應該正確初始化渲染狀態和統計追蹤', () => {
      // 測試目標：驗證渲染狀態初始化和效能統計追蹤
      renderer = new BookGridRenderer(mockContainer, mockDocument);
      
      // 渲染狀態驗證
      expect(renderer.isRendering).toBe(false);
      expect(renderer.renderedItems).toEqual([]);
      expect(renderer.visibleRange).toEqual({ start: 0, end: 0 });
      expect(renderer.totalItems).toBe(0);
      
      // 效能統計初始化驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.performanceStats).toBeDefined();
      expect(renderer.performanceStats.renderTime).toBe(0);
      expect(renderer.performanceStats.renderedCount).toBe(0);
      expect(renderer.performanceStats.memoryUsage).toBe(0);
    });

    test('T27-005: 應該處理無效的容器元素並拋出錯誤', () => {
      // 測試目標：驗證錯誤處理和引數檢查機制
      expect(() => {
        new BookGridRenderer(null, mockDocument);
      }).toThrow('Container element is required');
      
      expect(() => {
        new BookGridRenderer(undefined, mockDocument);
      }).toThrow('Container element is required');
      
      // 測試 document 引數檢查 (這裡應該失敗，因為還未實現)
      expect(() => {
        new BookGridRenderer(mockContainer, null);
      }).toThrow('Document object is required');
    });
  });

  // ===============================
  // 測試組 2: 網格佈局計算系統
  // ===============================

  describe('🔴 Red Phase: 網格佈局計算系統 (4/4 測試)', () => {
    beforeEach(() => {
      renderer = new BookGridRenderer(mockContainer, mockDocument);
    });

    test('T27-006: 應該能計算網格列數並支援事件觸發', () => {
      // 測試目標：驗證網格列數計算和佈局變更事件
      const columns = renderer.calculateColumns();
      expect(typeof columns).toBe('number');
      expect(columns).toBeGreaterThan(0);
      
      // 事件觸發驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.emit).toHaveBeenCalledWith('UI.GRID.LAYOUT_CALCULATED', {
        columns,
        containerWidth: 1200,
        itemWidth: renderer.config.itemWidth
      });
    });

    test('T27-007: 應該根據容器寬度調整列數並觸發響應事件', () => {
      // 測試目標：驗證響應式設計和調整大小事件
      // 測試小螢幕寬度
      mockContainer.getBoundingClientRect.mockReturnValue({
        width: 600, height: 800
      });
      
      const columnsSmall = renderer.calculateColumns();
      
      // 測試大螢幕寬度
      mockContainer.getBoundingClientRect.mockReturnValue({
        width: 1200, height: 800
      });
      
      const columnsLarge = renderer.calculateColumns();
      
      expect(columnsLarge).toBeGreaterThan(columnsSmall);
      
      // 響應式事件觸發驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.emit).toHaveBeenCalledWith('UI.GRID.RESPONSIVE_UPDATE', {
        screenSize: 'large',
        columns: columnsLarge,
        breakpoint: 'desktop'
      });
    });

    test('T27-008: 應該能計算項目位置並支援動畫轉場', () => {
      // 測試目標：驗證項目位置計算和動畫轉場效果
      const index = 5;
      const position = renderer.calculateItemPosition(index);
      
      expect(position).toHaveProperty('x');
      expect(position).toHaveProperty('y');
      expect(typeof position.x).toBe('number');
      expect(typeof position.y).toBe('number');
      
      // 動畫支援驗證 (這裡應該失敗，因為還未實現)
      expect(position).toHaveProperty('animationDelay');
      expect(position).toHaveProperty('transitionDuration');
      expect(position.animationDelay).toBe(index * 50); // 50ms 間隔
    });

    test('T27-009: 應該能計算可視範圍並優化虛擬滾動', () => {
      // 測試目標：驗證虛擬滾動可視範圍計算和優化
      const books = Array.from({ length: 100 }, (_, i) => ({ id: i, title: `Book ${i}` }));
      
      const scrollTop = 500;
      const range = renderer.calculateVisibleRange(books, scrollTop);
      
      expect(range).toHaveProperty('start');
      expect(range).toHaveProperty('end');
      expect(range.start).toBeGreaterThanOrEqual(0);
      expect(range.end).toBeGreaterThan(range.start);
      
      // 虛擬滾動優化驗證 (這裡應該失敗，因為還未實現)
      expect(range.bufferSize).toBe(renderer.config.bufferSize);
      expect(range.estimatedHeight).toBeGreaterThan(0);
      expect(renderer.virtualScrollOptimizer).toBeDefined();
    });
  });

  // ===============================
  // 測試組 3: 書籍項目渲染引擎
  // ===============================

  describe('🔴 Red Phase: 書籍項目渲染引擎 (4/4 測試)', () => {
    beforeEach(() => {
      renderer = new BookGridRenderer(mockContainer, mockDocument);
    });

    test('T27-010: 應該能渲染單個書籍項目並支援多種格式', () => {
      // 測試目標：驗證單項目渲染和多種資料格式支援
      const book = MOCK_BOOKS.SINGLE;
      const element = renderer.renderBookItem(book);
      
      expect(element).toBeDefined();
      expect(mockDocument.createElement).toHaveBeenCalled();
      
      // 多格式支援驗證 (這裡應該失敗，因為還未實現)
      expect(element.dataset.bookId).toBe(book.id);
      expect(element.dataset.renderFormat).toBeDefined();
      expect(element.classList.contains('book-item-enhanced')).toBe(true);
    });

    test('T27-011: 應該在書籍項目中包含所有必要資訊和互動元素', () => {
      // 測試目標：驗證完整資訊包含和互動元素
      const book = {
        id: '456',
        title: '完整資料書籍',
        author: '知名作者',
        cover: 'https://example.com/cover2.jpg',
        progress: 78,
        status: '閱讀中',
        publishDate: '2023-01-01',
        category: '文學',
        rating: 4.5
      };

      const element = renderer.renderBookItem(book);
      expect(element).toBeDefined();
      
      // 檢查必要資訊元素
      const titleElement = element.querySelector('.book-title');
      const authorElement = element.querySelector('.book-author');
      
      if (titleElement) {
        expect(titleElement.textContent).toBe('完整資料書籍');
      } else {
        expect(element.innerHTML || element.textContent).toContain('完整資料書籍');
      }
      
      if (authorElement) {
        expect(authorElement.textContent).toBe('知名作者');
      } else {
        expect(element.innerHTML || element.textContent).toContain('知名作者');
      }
      
      // 互動元素驗證 (這裡應該失敗，因為還未實現)
      expect(element.querySelector('.book-actions')).toBeDefined();
      expect(element.querySelector('.progress-indicator')).toBeDefined();
      expect(element.getAttribute('tabindex')).toBe('0');
      expect(element.getAttribute('role')).toBe('button');
    });

    test('T27-012: 應該能處理缺少封面的書籍並提供預設封面', () => {
      // 測試目標：驗證缺失數據處理和預設封面支援
      const book = {
        id: '789',
        title: '無封面書籍',
        author: '測試作者'
        // 沒有 cover 屬性
      };

      expect(() => {
        const element = renderer.renderBookItem(book);
        
        // 預設封面驗證 (這裡應該失敗，因為還未實現)
        expect(element.querySelector('.default-cover')).toBeDefined();
        expect(element.querySelector('.cover-placeholder')).toBeDefined();
      }).not.toThrow();
    });

    test('T27-013: 應該能處理空白或無效的書籍資料並提供錯誤回退', () => {
      // 測試目標：驗證異常情況處理和錯誤回退機制
      const invalidBooks = [null, undefined, {}, { title: '' }];

      invalidBooks.forEach((book, index) => {
        expect(() => {
          const element = renderer.renderBookItem(book);
          
          // 錯誤回退驗證 (這裡應該失敗，因為還未實現)
          expect(element.classList.contains('error-placeholder')).toBe(true);
          expect(element.getAttribute('data-error-type')).toBe('invalid-data');
          expect(element.querySelector('.error-message')).toBeDefined();
        }).not.toThrow();
      });
      
      // 錯誤統計驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.getErrorStats().renderErrors).toBe(4);
    });
  });

  // ===============================
  // 測試組 4: 網格渲染主邏輯
  // ===============================

  describe('🔴 Red Phase: 網格渲染主邏輯 (4/4 測試)', () => {
    beforeEach(() => {
      renderer = new BookGridRenderer(mockContainer, mockDocument);
    });

    test('T27-014: 應該能渲染書籍陣列並觸發事件', () => {
      // 測試目標：驗證批量渲染和事件觸發機制
      const books = MOCK_BOOKS.MULTIPLE.slice(0, 3);

      renderer.renderBooks(books);
      
      expect(renderer.totalItems).toBe(3);
      expect(mockContainer.appendChild).toHaveBeenCalled();
      
      // 事件觸發驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.emit).toHaveBeenCalledWith('UI.BOOKS.RENDER_START', {
        totalBooks: 3,
        renderMode: 'grid'
      });
      
      expect(renderer.emit).toHaveBeenCalledWith('UI.BOOKS.RENDER_COMPLETE', {
        renderedCount: 3,
        totalTime: expect.any(Number)
      });
    });

    test('T27-015: 應該能處理空的書籍陣列並顯示空狀態', () => {
      // 測試目標：驗證空狀態處理和空狀態顯示
      expect(() => {
        renderer.renderBooks([]);
      }).not.toThrow();
      
      expect(renderer.totalItems).toBe(0);
      
      // 空狀態顯示驗證 (這裡應該失敗，因為還未實現)
      expect(mockContainer.querySelector('.empty-state')).toBeDefined();
      expect(renderer.emit).toHaveBeenCalledWith('UI.BOOKS.EMPTY_STATE', {
        message: '無書籍資料',
        showUploadHint: true
      });
    });

    test('T27-016: 應該能處理大量書籍資料並優化效能', () => {
      // 測試目標：驗證大量資料處理和效能優化
      const largeBookArray = MOCK_BOOKS.LARGE_DATASET;

      const startTime = performance.now();
      expect(() => {
        renderer.renderBooks(largeBookArray);
      }).not.toThrow();
      
      expect(renderer.totalItems).toBe(1000);
      
      // 效能優化驗證 (這裡應該失敗，因為還未實現)
      const stats = renderer.getPerformanceStats();
      expect(stats.renderTime).toBeLessThan(1000); // 1秒內完成
      expect(stats.memoryUsage).toBeLessThan(50); // 記憶體使用量控制
      expect(renderer.renderedItems.length).toBeLessThan(100); // 虛擬滾動限制
    });

    test('T27-017: 應該支援增量渲染更新和差分更新', () => {
      // 測試目標：驗證增量更新和差分更新機制
      const initialBooks = MOCK_BOOKS.MULTIPLE.slice(0, 2);

      renderer.renderBooks(initialBooks);
      expect(renderer.totalItems).toBe(2);

      const newBooks = MOCK_BOOKS.MULTIPLE.slice(0, 3);
      renderer.updateBooks(newBooks);
      expect(renderer.totalItems).toBe(3);
      
      // 差分更新驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.lastUpdateDiff).toEqual({
        added: [newBooks[2]],
        removed: [],
        updated: []
      });
      
      expect(renderer.emit).toHaveBeenCalledWith('UI.BOOKS.INCREMENTAL_UPDATE', {
        addedCount: 1,
        updatedCount: 0,
        removedCount: 0
      });
    });
  });

  // ===============================
  // 測試組 5: 虛擬滾動實現
  // ===============================

  describe('🔴 Red Phase: 虛擬滾動實現 (4/4 測試)', () => {
    beforeEach(() => {
      renderer = new BookGridRenderer(mockContainer, mockDocument, {
        virtualScrolling: true
      });
    });

    test('T27-018: 應該啟用虛擬滾動功能並初始化相關結構', () => {
      // 測試目標：驗證虛擬滾動初始化和配置
      expect(renderer.config.virtualScrolling).toBe(true);
      expect(renderer.virtualScroller).toBeDefined();
      
      // 虛擬滾動結構驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.virtualScroller.itemHeightCache).toBeDefined();
      expect(renderer.virtualScroller.scrollDirection).toBe('vertical');
      expect(renderer.virtualScroller.estimatedTotalHeight).toBeGreaterThanOrEqual(0);
    });

    test('T27-019: 應該計算虛擬滾動的緩衝區大小並動態調整', () => {
      // 測試目標：驗證緩衝區計算和動態調整機制
      const bufferSize = renderer.getVirtualScrollBuffer();
      
      expect(typeof bufferSize).toBe('number');
      expect(bufferSize).toBeGreaterThan(0);
      
      // 動態調整驗證 (這裡應該失敗，因為還未實現)
      const adaptiveBuffer = renderer.calculateAdaptiveBuffer(MOCK_BOOKS.LARGE_DATASET.length);
      expect(adaptiveBuffer).toBeGreaterThan(bufferSize);
      
      // 效能模式調整
      renderer.setPerformanceMode('high-performance');
      const highPerfBuffer = renderer.getVirtualScrollBuffer();
      expect(highPerfBuffer).toBeLessThan(bufferSize);
    });

    test('T27-020: 應該能處理滾動事件並優化效能', () => {
      // 測試目標：驗證滾動事件處理和效能優化
      const books = MOCK_BOOKS.LARGE_DATASET.slice(0, 100);
      
      renderer.config.itemHeight = 100;
      renderer.config.gap = 10;
      renderer.renderBooks(books);
      
      const initialRange = { ...renderer.visibleRange };
      
      // 模擬大幅滾動
      renderer.handleScroll({ target: { scrollTop: 1000 } });
      
      expect(renderer.visibleRange.start).toBeGreaterThanOrEqual(0);
      expect(renderer.visibleRange.end).toBeGreaterThan(renderer.visibleRange.start);
      
      // 效能優化驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.scrollPerformanceMetrics.throttledCalls).toBeGreaterThan(0);
      expect(renderer.scrollPerformanceMetrics.averageScrollTime).toBeLessThan(16); // 60fps
      
      // 範圍變更事件
      expect(renderer.emit).toHaveBeenCalledWith('UI.SCROLL.RANGE_CHANGED', {
        previousRange: initialRange,
        newRange: renderer.visibleRange,
        scrollDirection: 'down'
      });
    });

    test('T27-021: 應該只渲染可視範圍內的項目並管理記憶體', () => {
      // 測試目標：驗證虛擬滾動渲染範圍和記憶體管理
      const books = MOCK_BOOKS.LARGE_DATASET.slice(0, 200);
      
      renderer.renderBooks(books);
      
      // 虛擬滾動渲染範圍驗證
      expect(renderer.renderedItems.length).toBeLessThan(books.length);
      expect(renderer.renderedItems.length).toBeGreaterThan(0);
      
      // 記憶體管理驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.memoryPool.activeItems).toBeLessThan(100);
      expect(renderer.memoryPool.recycledItems).toBeDefined();
      expect(renderer.getMemoryUsage()).toBeLessThan(10 * 1024 * 1024); // 10MB 以下
    });
  });

  // ===============================
  // 測試組 6: 響應式佈局系統
  // ===============================

  describe('🔴 Red Phase: 響應式佈局系統 (3/3 測試)', () => {
    beforeEach(() => {
      renderer = new BookGridRenderer(mockContainer, mockDocument);
    });

    test('T27-022: 應該支援網格和清單檢視模式並觸發事件', () => {
      // 測試目標：驗證檢視模式切換和事件觸發
      
      // 網格模式測試
      renderer.setViewMode('grid');
      expect(renderer.config.viewMode).toBe('grid');
      
      // 清單模式測試
      renderer.setViewMode('list');
      expect(renderer.config.viewMode).toBe('list');
      
      // 事件觸發驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.emit).toHaveBeenCalledWith('UI.VIEW_MODE.CHANGED', {
        previousMode: 'grid',
        currentMode: 'list',
        layoutRecomputed: true
      });
      
      // 不正確模式測試
      expect(() => {
        renderer.setViewMode('invalid');
      }).toThrow('Invalid view mode. Must be "grid" or "list"');
    });

    test('T27-023: 應該根據螢幕尺寸調整佈局並支援多種斷點', () => {
      // 測試目標：驗證多螢幕斷點支援和響應式佈局
      const testBreakpoints = [
        { width: 320, expected: 'mobile', minColumns: 1 },
        { width: 768, expected: 'tablet', minColumns: 2 },
        { width: 1024, expected: 'desktop', minColumns: 3 },
        { width: 1440, expected: 'wide', minColumns: 4 }
      ];
      
      testBreakpoints.forEach(({ width, expected, minColumns }) => {
        mockContainer.getBoundingClientRect.mockReturnValue({
          width, height: 800
        });
        
        renderer.handleResize();
        const columns = renderer.calculateColumns();
        
        expect(columns).toBeGreaterThanOrEqual(minColumns);
        
        // 斷點事件驗證 (這裡應該失敗，因為還未實現)
        expect(renderer.emit).toHaveBeenCalledWith('UI.RESPONSIVE.BREAKPOINT_CHANGED', {
          breakpoint: expected,
          width,
          columns
        });
      });
    });

    test('T27-024: 應該能切換檢視模式並動畫轉場', () => {
      // 測試目標：驗證檢視模式切換和動畫轉場效果
      const books = MOCK_BOOKS.MULTIPLE.slice(0, 2);
      renderer.renderBooks(books);
      
      // 切換到清單模式
      renderer.setViewMode('list');
      expect(mockContainer.classList.add).toHaveBeenCalledWith('list-view');
      
      // 切換回網格模式
      renderer.setViewMode('grid');
      expect(mockContainer.classList.add).toHaveBeenCalledWith('grid-view');
      
      // 動畫轉場驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.transitionManager).toBeDefined();
      expect(renderer.transitionManager.activeTransitions).toBeGreaterThan(0);
      expect(mockContainer.classList.contains('view-mode-transitioning')).toBe(true);
    });
  });

  // ===============================
  // 測試組 7: 效能優化和記憶體管理
  // ===============================

  describe('🔴 Red Phase: 效能優化和記憶體管理 (4/4 測試)', () => {
    beforeEach(() => {
      renderer = new BookGridRenderer(mockContainer, mockDocument);
    });

    test('T27-025: 應該實現項目回收機制和記憶體池化', () => {
      // 測試目標：驗證項目回收和記憶體池化管理
      const books = MOCK_BOOKS.MULTIPLE.slice(0, 50);
      
      renderer.renderBooks(books);
      const initialMemoryUsage = renderer.getMemoryUsage();
      
      renderer.recycleItems();
      
      expect(renderer.recycledItems).toBeDefined();
      
      // 記憶體池化驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.memoryPool.availableItems).toBeGreaterThan(0);
      expect(renderer.getMemoryUsage()).toBeLessThan(initialMemoryUsage);
      expect(renderer.emit).toHaveBeenCalledWith('UI.MEMORY.RECYCLED', {
        recycledCount: expect.any(Number),
        memoryFreed: expect.any(Number)
      });
    });

    test('T27-026: 應該追蹤渲染效能統計和效能警告', () => {
      // 測試目標：驗證效能統計和效能監控機制
      const books = [MOCK_BOOKS.SINGLE];
      
      renderer.renderBooks(books);
      
      const stats = renderer.getPerformanceStats();
      expect(stats).toHaveProperty('renderTime');
      expect(stats).toHaveProperty('renderedCount');
      expect(stats.renderTime).toBeGreaterThan(0);
      
      // 效能監控驗證 (這裡應該失敗，因為還未實現)
      expect(stats).toHaveProperty('averageRenderTime');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('frameDropCount');
      
      // 效能警告機制
      expect(renderer.performanceMonitor.warnings).toBeDefined();
      expect(typeof renderer.onPerformanceWarning).toBe('function');
    });

    test('T27-027: 應該支援批量渲染優化和非同步渲染', () => {
      // 測試目標：驗證批量渲染和非同步渲染優化
      const books = MOCK_BOOKS.MULTIPLE.slice(0, 20);
      
      const startTime = performance.now();
      renderer.renderBooks(books);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // 100ms
      
      // 非同步渲染驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.asyncRenderQueue).toBeDefined();
      expect(renderer.asyncRenderQueue.length).toBeGreaterThanOrEqual(0);
      
      // requestAnimationFrame 使用驗證
      expect(global.requestAnimationFrame).toHaveBeenCalled();
      
      // 批量大小配置驗證
      expect(renderer.config.batchSize).toBeGreaterThan(0);
    });

    test('T27-028: 應該能清理渲染資源和事件監聽器', () => {
      // 測試目標：驗證資源清理和事件監聽器清理
      const books = [MOCK_BOOKS.SINGLE];
      
      renderer.renderBooks(books);
      
      // 記錄初始狀態
      const initialListenerCount = mockContainer.addEventListener.mock.calls.length;
      
      renderer.destroy();
      
      expect(renderer.isDestroyed).toBe(true);
      expect(mockContainer.removeEventListener || mockViewport.removeEventListener).toHaveBeenCalled();
      
      // 資源清理驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.memoryPool.clear).toHaveBeenCalled();
      expect(renderer.virtualScroller.destroy).toHaveBeenCalled();
      expect(renderer.eventHandlers.size).toBe(0);
    });
  });

  // ===============================
  // 測試組 8: 事件處理和互動
  // ===============================

  describe('🔴 Red Phase: 事件處理和互動 (3/3 測試)', () => {
    beforeEach(() => {
      renderer = new BookGridRenderer(mockContainer, mockDocument);
    });

    test('T27-029: 應該支援書籍項目點擊事件和事件委派', () => {
      // 測試目標：驗證項目點擊事件和事件委派機制
      const onItemClick = jest.fn();
      renderer.setOnItemClick(onItemClick);
      
      const book = MOCK_BOOKS.SINGLE;
      const element = renderer.renderBookItem(book);
      
      // 模擬點擊事件
      const clickEvent = { target: element, preventDefault: jest.fn() };
      renderer.handleItemClick(clickEvent, book);
      
      expect(onItemClick).toHaveBeenCalledWith(book);
      
      // 事件委派驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.emit).toHaveBeenCalledWith('UI.BOOK.CLICKED', {
        book,
        element,
        timestamp: expect.any(Number)
      });
      
      expect(clickEvent.preventDefault).toHaveBeenCalled();
    });

    test('T27-030: 應該支援書籍項目懸停效果和焦點管理', () => {
      // 測試目標：驗證懸停效果和焦點管理
      const book = MOCK_BOOKS.SINGLE;
      const element = renderer.renderBookItem(book);
      
      // 懸停開始
      renderer.handleItemHover(element, true);
      expect(element.classList.add).toHaveBeenCalledWith('hover');
      
      // 懸停結束
      renderer.handleItemHover(element, false);
      expect(element.classList.remove).toHaveBeenCalledWith('hover');
      
      // 焦點管理驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.focusManager).toBeDefined();
      expect(renderer.focusManager.currentFocusedItem).toBe(null);
      
      // 懸停事件觸發
      expect(renderer.emit).toHaveBeenCalledWith('UI.BOOK.HOVER', {
        book,
        element,
        isHovering: true
      });
    });

    test('T27-031: 應該處理鍵盤導航事件和無障礙支援', () => {
      // 測試目標：驗證鍵盤導航和無障礙支援
      const books = MOCK_BOOKS.MULTIPLE.slice(0, 2);
      renderer.renderBooks(books);
      
      // 測試方向鍵導航
      const keyEvents = [
        { key: 'ArrowRight', preventDefault: jest.fn() },
        { key: 'ArrowDown', preventDefault: jest.fn() },
        { key: 'Enter', preventDefault: jest.fn() },
        { key: 'Space', preventDefault: jest.fn() }
      ];
      
      keyEvents.forEach(keyEvent => {
        renderer.handleKeyNavigation(keyEvent);
        expect(keyEvent.preventDefault).toHaveBeenCalled();
      });
      
      // 無障礙支援驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.accessibilityManager).toBeDefined();
      expect(renderer.currentFocusIndex).toBeGreaterThanOrEqual(0);
      expect(renderer.emit).toHaveBeenCalledWith('UI.NAVIGATION.KEY_PRESSED', {
        key: expect.any(String),
        direction: expect.any(String)
      });
    });
  });

  // ===============================
  // 測試組 9: 錯誤處理和邊界情況
  // ===============================

  describe('🔴 Red Phase: 錯誤處理和邊界情況 (3/3 測試)', () => {
    beforeEach(() => {
      renderer = new BookGridRenderer(mockContainer, mockDocument);
    });

    test('T27-032: 應該處理無效的容器元素和參數驗證', () => {
      // 測試目標：驗證參數檢查和錯誤處理機制
      
      // 無效容器測試
      const invalidContainers = [null, undefined, '', 0, false];
      
      invalidContainers.forEach(container => {
        expect(() => {
          new BookGridRenderer(container, mockDocument);
        }).toThrow('Container element is required');
      });
      
      // 無效 document 測試 (這裡應該失敗，因為還未實現)
      expect(() => {
        new BookGridRenderer(mockContainer, null);
      }).toThrow('Document object is required');
      
      // 無效配置測試
      expect(() => {
        new BookGridRenderer(mockContainer, mockDocument, { itemWidth: -10 });
      }).toThrow('Invalid configuration: itemWidth must be positive');
    });

    test('T27-033: 應該處理渲染過程中的錯誤和強健性復原', () => {
      // 測試目標：驗證錯誤處理和強健性復原機制
      
      // 模擬 DOM 操作錯誤
      mockDocument.createElement.mockImplementationOnce(() => {
        throw new Error('DOM error');
      });
      
      const book = MOCK_BOOKS.SINGLE;
      
      expect(() => {
        const result = renderer.renderBookItem(book);
        
        // 強健性復原驗證 (這裡應該失敗，因為還未實現)
        expect(result.classList.contains('error-fallback')).toBe(true);
      }).not.toThrow();
      
      // 錯誤統計與事件觸發
      const stats = renderer.getErrorStats();
      expect(stats.renderErrors).toBeGreaterThan(0);
      expect(renderer.emit).toHaveBeenCalledWith('UI.ERROR.RENDER_FAILED', {
        bookId: book.id,
        error: expect.any(Error),
        recoveryAttempted: true
      });
    });

    test('T27-034: 應該處理記憶體不足的情況和效能降級', () => {
      // 測試目標：驗證記憶體管理和效能降級機制
      
      // 模擬大量資料渲染
      const hugeBookArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        title: `Book ${i}`,
        content: 'Large content'.repeat(1000)
      }));
      
      expect(() => {
        renderer.renderBooks(hugeBookArray);
      }).not.toThrow();
      
      // 虛擬滾動限制測試
      expect(renderer.renderedItems.length).toBeLessThan(100);
      
      // 效能降級機制驗證 (這裡應該失敗，因為還未實現)
      expect(renderer.performanceManager.degradationLevel).toBeGreaterThan(0);
      expect(renderer.emit).toHaveBeenCalledWith('UI.PERFORMANCE.MEMORY_PRESSURE', {
        memoryUsage: expect.any(Number),
        degradationLevel: expect.any(Number),
        mitigationActions: expect.any(Array)
      });
    });
  });

  // ===============================
  // 統計和總結訊息
  // ===============================

  afterAll(() => {
    console.log('\n🖼️ BookGridRenderer 測試統計 (TDD循環 #27 - Red Phase):');
    console.log('✨ 測試案例總數: 34 個');
    console.log('✨ 預期結果: 所有測試都應該失敗 (Red Phase)');
    console.log('✨ 下一階段: Green Phase - 實現最少可用程式碼讓測試通過');
    console.log('\n🚀 測試範圍全面涵蓋:');
    console.log('   - 基本結構和初始化 (5 測試)');
    console.log('   - 網格佈局計算系統 (4 測試)');
    console.log('   - 書籍項目渲染引擎 (4 測試)');
    console.log('   - 網格渲染主邏輯 (4 測試)');
    console.log('   - 虛擬滾動實現 (4 測試)');
    console.log('   - 響應式佈局系統 (3 測試)');
    console.log('   - 效能優化和記憶體管理 (4 測試)');
    console.log('   - 事件處理和互動 (3 測試)');
    console.log('   - 錯誤處理和邊界情況 (3 測試)');
    console.log('\n🎆 事件驅動架構整合完成！');
  });
});