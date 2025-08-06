/**
 * BookGridRenderer - 書籍網格渲染器 (TDD循環 #27)
 * 
 * 負責功能：
 * - 響應式書籍網格渲染
 * - 虛擬滾動處理大量資料
 * - 多種檢視模式支援 (網格/清單)
 * - 效能優化和記憶體管理
 * - 使用者互動事件處理
 * 
 * 設計考量：
 * - 支援大量書籍資料的流暢渲染
 * - 響應式設計適應不同螢幕尺寸
 * - 虛擬滾動減少 DOM 節點數量
 * - 項目回收機制優化記憶體使用
 * - 平滑的視覺過渡效果
 * 
 * 使用情境：
 * - Overview 頁面的主要書籍展示組件
 * - 支援網格和清單兩種檢視模式
 * - 處理從數百到數千本書籍的渲染需求
 * 
 * @version 1.0.0
 * @since 2025-08-06
 */

// 常數定義 - 分層組織架構
const CONSTANTS = {
  // 配置管理
  CONFIG: {
    DEFAULT: {
      itemWidth: 180,
      itemHeight: 280,
      gap: 20,
      viewMode: 'grid', // 'grid' or 'list'
      virtualScrolling: true,
      bufferSize: 5,
      animationDuration: 300
    },
    BREAKPOINTS: {
      MOBILE: 480,
      TABLET: 768,
      DESKTOP: 1024,
      WIDE: 1440
    }
  },
  
  // 視覺介面
  UI: {
    CSS_CLASSES: {
      CONTAINER: 'book-grid-container',
      ITEM: 'book-grid-item',
      GRID_VIEW: 'grid-view',
      LIST_VIEW: 'list-view',
      VIRTUAL_SCROLLER: 'virtual-scroller',
      LOADING: 'loading',
      HOVER: 'hover',
      SELECTED: 'selected',
      ERROR: 'error',
      PLACEHOLDER: 'placeholder'
    },
    ELEMENT_CLASSES: {
      CONTENT: 'book-item-content',
      COVER: 'book-cover',
      INFO: 'book-info',
      TITLE: 'book-title',
      AUTHOR: 'book-author',
      STATUS: 'book-status',
      PROGRESS: 'progress-container',
      PROGRESS_BAR: 'progress-bar',
      PROGRESS_TEXT: 'progress-text'
    }
  },
  
  // 效能優化
  PERFORMANCE: {
    RENDER_BATCH_SIZE: 20,
    SCROLL_THROTTLE: 16, // ~60fps
    RESIZE_DEBOUNCE: 250,
    MAX_RENDERED_ITEMS: 100,
    MEMORY_POOL_SIZE: 50,
    GC_THRESHOLD: 200
  },
  
  // 事件類型
  EVENTS: {
    ITEM_CLICK: 'itemClick',
    ITEM_HOVER: 'itemHover',
    VIEW_MODE_CHANGE: 'viewModeChange',
    SCROLL: 'scroll',
    RESIZE: 'resize'
  },
  
  // 錯誤類型
  ERRORS: {
    INVALID_CONTAINER: 'Container element is required',
    INVALID_VIEW_MODE: 'Invalid view mode. Must be "grid" or "list"',
    RENDER_FAILED: 'Failed to render book item',
    MEMORY_EXCEEDED: 'Memory usage exceeded threshold'
  }
};

class BookGridRenderer {
  /**
   * 建構書籍網格渲染器
   * 
   * @param {HTMLElement} container - 容器元素
   * @param {Document} document - DOM 文檔物件
   * @param {Object} options - 配置選項
   */
  constructor(container, document, options = {}) {
    // 驗證必要參數
    if (!container) {
      throw new Error(CONSTANTS.ERRORS.INVALID_CONTAINER);
    }
    
    this.container = container;
    this.document = document;
    
    // 合併配置
    this.config = { ...CONSTANTS.CONFIG.DEFAULT, ...options };
    
    // 初始化狀態
    this.isRendering = false;
    this.isDestroyed = false;
    this.renderedItems = [];
    this.recycledItems = [];
    this.visibleRange = { start: 0, end: 0 };
    this.totalItems = 0;
    this.currentBooks = [];
    
    // 記憶體池化管理
    this.elementPool = {
      items: [],
      maxSize: CONSTANTS.PERFORMANCE.MEMORY_POOL_SIZE
    };
    
    // 效能統計
    this.stats = {
      renderTime: 0,
      renderedCount: 0,
      recycledCount: 0,
      poolHits: 0,
      memoryUsage: 0
    };
    
    // 錯誤統計
    this.errorStats = {
      renderErrors: 0,
      memoryErrors: 0,
      poolErrors: 0
    };
    
    // 事件處理器
    this.onItemClick = null;
    this.selectedItems = new Set();
    
    // 快取元素映射
    this.elementCache = new Map();
    
    // 初始化組件
    this.initializeContainer();
    this.setupVirtualScrolling();
    this.bindEvents();
  }

  /**
   * 初始化容器設定
   */
  initializeContainer() {
    // 設定容器 CSS 類別
    this.container.classList.add(CONSTANTS.UI.CSS_CLASSES.CONTAINER);
    this.container.classList.add(CONSTANTS.UI.CSS_CLASSES.GRID_VIEW);
    
    // 設定容器樣式
    this.container.style.position = 'relative';
    this.container.style.overflow = 'auto';
  }

  /**
   * 設定虛擬滾動
   */
  setupVirtualScrolling() {
    if (this.config.virtualScrolling) {
      this.virtualScroller = {
        scrollTop: 0,
        visibleHeight: 0,
        totalHeight: 0,
        itemsPerRow: 1,
        rowHeight: this.config.itemHeight + this.config.gap
      };
    }
  }

  /**
   * 綁定事件監聽器
   */
  bindEvents() {
    // 滾動事件（節流處理）
    this.throttledScrollHandler = this._throttle(
      this.handleScroll.bind(this), 
      CONSTANTS.PERFORMANCE.SCROLL_THROTTLE
    );
    this.container.addEventListener('scroll', this.throttledScrollHandler);
    
    // 調整大小事件（防抖處理）
    this.debouncedResizeHandler = this._debounce(
      this.handleResize.bind(this), 
      CONSTANTS.PERFORMANCE.RESIZE_DEBOUNCE
    );
    global.window?.addEventListener('resize', this.debouncedResizeHandler);
    
    // 點擊事件
    this.container.addEventListener('click', this.handleItemClick.bind(this));
    
    // 鍵盤事件
    this.container.addEventListener('keydown', this.handleKeyNavigation.bind(this));
    this.container.setAttribute('tabindex', '0');
  }

  // ===============================
  // 私有方法 - 記憶體池化管理
  // ===============================

  /**
   * 從池中獲取元素
   * 
   * @returns {HTMLElement|null} 可重用的元素
   */
  _getFromPool() {
    try {
      if (this.elementPool.items.length > 0) {
        this.stats.poolHits++;
        return this.elementPool.items.pop();
      }
      return null;
    } catch (error) {
      this.errorStats.poolErrors++;
      return null;
    }
  }

  /**
   * 將元素回收到池中
   * 
   * @param {HTMLElement} element - 要回收的元素
   */
  _returnToPool(element) {
    try {
      if (this.elementPool.items.length < this.elementPool.maxSize) {
        // 清理元素內容但保留結構
        element.innerHTML = '';
        element.className = CONSTANTS.UI.CSS_CLASSES.ITEM;
        element.removeAttribute('data-book-id');
        
        this.elementPool.items.push(element);
      }
    } catch (error) {
      this.errorStats.poolErrors++;
    }
  }

  /**
   * 檢查記憶體使用量
   */
  _checkMemoryUsage() {
    const totalElements = this.renderedItems.length + this.elementPool.items.length;
    this.stats.memoryUsage = totalElements;
    
    if (totalElements > CONSTANTS.PERFORMANCE.GC_THRESHOLD) {
      this._garbageCollect();
    }
  }

  /**
   * 垃圾回收
   */
  _garbageCollect() {
    try {
      // 清理池中過多的元素
      const poolSizeToKeep = Math.floor(this.elementPool.maxSize * 0.5);
      if (this.elementPool.items.length > poolSizeToKeep) {
        this.elementPool.items.splice(poolSizeToKeep);
      }
      
      // 清理緩存
      if (this.elementCache.size > 100) {
        this.elementCache.clear();
      }
      
    } catch (error) {
      this.errorStats.memoryErrors++;
    }
  }

  // ===============================
  // 私有方法 - 佈局計算
  // ===============================

  /**
   * 獲取容器尺寸
   * 
   * @returns {Object} 容器尺寸 {width, height}
   */
  _getContainerDimensions() {
    const rect = this.container.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height
    };
  }

  /**
   * 計算項目總尺寸（包含間距）
   * 
   * @returns {Object} 項目尺寸 {width, height}
   */
  _getItemTotalSize() {
    return {
      width: this.config.itemWidth + this.config.gap,
      height: this.config.itemHeight + this.config.gap
    };
  }

  /**
   * 根據螢幕尺寸調整配置
   */
  _adaptToScreenSize() {
    const { width } = this._getContainerDimensions();
    
    if (width <= CONSTANTS.CONFIG.BREAKPOINTS.MOBILE) {
      this.config.itemWidth = Math.min(this.config.itemWidth, 150);
      this.config.gap = Math.min(this.config.gap, 10);
    } else if (width <= CONSTANTS.CONFIG.BREAKPOINTS.TABLET) {
      this.config.itemWidth = Math.min(this.config.itemWidth, 160);
      this.config.gap = Math.min(this.config.gap, 15);
    }
  }

  /**
   * 計算網格列數
   * 
   * @returns {number} 列數
   */
  calculateColumns() {
    const { width: containerWidth } = this._getContainerDimensions();
    const { width: itemTotalWidth } = this._getItemTotalSize();
    
    // 至少顯示一列
    const columns = Math.max(1, Math.floor(containerWidth / itemTotalWidth));
    
    // 根據檢視模式調整
    if (this.config.viewMode === 'list') {
      return 1;
    }
    
    return columns;
  }

  /**
   * 計算項目位置
   * 
   * @param {number} index - 項目索引
   * @returns {Object} 位置座標 {x, y}
   */
  calculateItemPosition(index) {
    const columns = this.calculateColumns();
    const { width: itemTotalWidth, height: itemTotalHeight } = this._getItemTotalSize();
    
    const row = Math.floor(index / columns);
    const col = index % columns;
    
    return {
      x: col * itemTotalWidth,
      y: row * itemTotalHeight
    };
  }

  /**
   * 計算可視範圍
   * 
   * @param {Array} books - 書籍陣列
   * @param {number} scrollTop - 滾動位置
   * @returns {Object} 可視範圍 {start, end}
   */
  calculateVisibleRange(books, scrollTop = 0) {
    if (!this.config.virtualScrolling || books.length === 0) {
      return { start: 0, end: Math.min(books.length, CONSTANTS.PERFORMANCE.MAX_RENDERED_ITEMS) };
    }
    
    const containerHeight = this.container.clientHeight;
    const itemHeight = this.config.itemHeight + this.config.gap;
    const columns = this.calculateColumns();
    
    const startRow = Math.floor(scrollTop / itemHeight);
    const endRow = Math.ceil((scrollTop + containerHeight) / itemHeight);
    
    // 加入緩衝區
    const buffer = this.config.bufferSize;
    const start = Math.max(0, (startRow - buffer) * columns);
    const end = Math.min(books.length, (endRow + buffer) * columns);
    
    return { start, end };
  }

  // ===============================
  // 私有方法 - DOM 元素創建
  // ===============================

  /**
   * 創建基礎項目元素
   * 
   * @returns {HTMLElement} 基礎項目元素
   */
  _createBaseItem() {
    // 嘗試從池中獲取元素
    let item = this._getFromPool();
    
    if (!item) {
      item = this.document.createElement('div');
    }
    
    item.className = CONSTANTS.UI.CSS_CLASSES.ITEM;
    item.style.width = `${this.config.itemWidth}px`;
    item.style.height = `${this.config.itemHeight}px`;
    
    return item;
  }

  /**
   * 驗證書籍資料
   * 
   * @param {Object} book - 書籍資料
   * @returns {boolean} 是否有效
   */
  _validateBookData(book) {
    return book && typeof book === 'object' && (book.id || book.title);
  }

  /**
   * 渲染單個書籍項目
   * 
   * @param {Object} book - 書籍資料
   * @returns {HTMLElement} DOM 元素
   */
  renderBookItem(book) {
    try {
      // 處理無效資料
      if (!this._validateBookData(book)) {
        return this._createPlaceholderItem();
      }
      
      // 創建項目容器
      const item = this._createBaseItem();
      item.dataset.bookId = book.id || '';
      
      // 渲染項目內容
      const content = this._renderItemContent(book);
      item.appendChild(content);
      
      // 添加互動事件
      this._attachItemEvents(item, book);
      
      return item;
      
    } catch (error) {
      this.errorStats.renderErrors++;
      return this._createErrorItem(error);
    }
  }

  /**
   * 渲染項目內容
   * 
   * @param {Object} book - 書籍資料
   * @returns {HTMLElement} 內容元素
   */
  _renderItemContent(book) {
    try {
      const content = this.document.createElement('div');
      content.className = CONSTANTS.UI.ELEMENT_CLASSES.CONTENT;
      
      // 封面圖片
      const cover = this._renderBookCover(book);
      content.appendChild(cover);
      
      // 書籍資訊
      const info = this._renderBookInfo(book);
      content.appendChild(info);
      
      // 進度指示器
      if (book.progress !== undefined) {
        const progress = this._renderProgressBar(book.progress);
        content.appendChild(progress);
      }
      
      return content;
    } catch (error) {
      // 如果渲染失敗，返回錯誤內容但不拋出錯誤
      return this._createErrorContent(error);
    }
  }

  /**
   * 創建錯誤內容
   * 
   * @param {Error} error - 錯誤物件
   * @returns {HTMLElement} 錯誤內容元素
   */
  _createErrorContent(error) {
    const errorContent = this.document.createElement('div');
    errorContent.className = `${CONSTANTS.UI.ELEMENT_CLASSES.CONTENT} ${CONSTANTS.UI.CSS_CLASSES.ERROR}`;
    errorContent.innerHTML = `<div class="error-message">渲染失敗: ${error.message}</div>`;
    return errorContent;
  }

  /**
   * 渲染書籍封面
   * 
   * @param {Object} book - 書籍資料
   * @returns {HTMLElement} 封面元素
   */
  _renderBookCover(book) {
    const coverContainer = this.document.createElement('div');
    coverContainer.className = CONSTANTS.UI.ELEMENT_CLASSES.COVER;
    
    if (book.cover) {
      const img = this.document.createElement('img');
      img.src = book.cover;
      img.alt = book.title || '書籍封面';
      img.loading = 'lazy';
      coverContainer.appendChild(img);
    } else {
      // 預設封面
      coverContainer.innerHTML = '📚';
      coverContainer.classList.add('default-cover');
    }
    
    return coverContainer;
  }

  /**
   * 渲染書籍資訊
   * 
   * @param {Object} book - 書籍資料
   * @returns {HTMLElement} 資訊元素
   */
  _renderBookInfo(book) {
    const info = this.document.createElement('div');
    info.className = CONSTANTS.UI.ELEMENT_CLASSES.INFO;
    
    // 書名
    if (book.title) {
      const title = this.document.createElement('h3');
      title.className = CONSTANTS.UI.ELEMENT_CLASSES.TITLE;
      title.textContent = book.title;
      title.title = book.title; // 工具提示
      info.appendChild(title);
    }
    
    // 作者
    if (book.author) {
      const author = this.document.createElement('p');
      author.className = CONSTANTS.UI.ELEMENT_CLASSES.AUTHOR;
      author.textContent = book.author;
      info.appendChild(author);
    }
    
    // 狀態
    if (book.status) {
      const status = this.document.createElement('span');
      status.className = CONSTANTS.UI.ELEMENT_CLASSES.STATUS;
      status.textContent = book.status;
      info.appendChild(status);
    }
    
    return info;
  }

  /**
   * 渲染進度條
   * 
   * @param {number} progress - 進度百分比
   * @returns {HTMLElement} 進度條元素
   */
  _renderProgressBar(progress) {
    const progressContainer = this.document.createElement('div');
    progressContainer.className = CONSTANTS.UI.ELEMENT_CLASSES.PROGRESS;
    
    const progressBar = this.document.createElement('div');
    progressBar.className = CONSTANTS.UI.ELEMENT_CLASSES.PROGRESS_BAR;
    progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    
    const progressText = this.document.createElement('span');
    progressText.className = CONSTANTS.UI.ELEMENT_CLASSES.PROGRESS_TEXT;
    progressText.textContent = `${progress}%`;
    
    progressContainer.appendChild(progressBar);
    progressContainer.appendChild(progressText);
    
    return progressContainer;
  }

  /**
   * 創建佔位符項目
   * 
   * @returns {HTMLElement} 佔位符元素
   */
  _createPlaceholderItem() {
    const item = this.document.createElement('div');
    item.className = `${CONSTANTS.UI.CSS_CLASSES.ITEM} ${CONSTANTS.UI.CSS_CLASSES.PLACEHOLDER}`;
    item.innerHTML = '<div class="placeholder-content">載入中...</div>';
    return item;
  }

  /**
   * 創建錯誤項目
   * 
   * @param {Error} error - 錯誤物件
   * @returns {HTMLElement} 錯誤元素
   */
  _createErrorItem(error) {
    const item = this.document.createElement('div');
    item.className = `${CONSTANTS.UI.CSS_CLASSES.ITEM} ${CONSTANTS.UI.CSS_CLASSES.ERROR}`;
    item.innerHTML = '<div class="error-content">載入失敗</div>';
    item.title = error.message;
    return item;
  }

  /**
   * 附加項目事件
   * 
   * @param {HTMLElement} item - 項目元素
   * @param {Object} book - 書籍資料
   */
  _attachItemEvents(item, book) {
    // 懸停效果
    item.addEventListener('mouseenter', () => this.handleItemHover(item, true));
    item.addEventListener('mouseleave', () => this.handleItemHover(item, false));
    
    // 點擊事件（委派給容器處理）
    item.dataset.book = JSON.stringify(book);
  }

  /**
   * 渲染書籍陣列
   * 
   * @param {Array} books - 書籍陣列
   */
  renderBooks(books) {
    const startTime = performance.now();
    
    try {
      this.isRendering = true;
      this.currentBooks = books || [];
      this.totalItems = this.currentBooks.length;
      
      // 清空容器
      this.clearContainer();
      
      // 計算可視範圍
      this.visibleRange = this.calculateVisibleRange(this.currentBooks);
      
      // 渲染可視項目
      this.renderVisibleItems();
      
      // 設定虛擬滾動容器高度
      this.updateVirtualScrollerHeight();
      
    } catch (error) {
      this.errorStats.renderErrors++;
      console.error('渲染書籍時發生錯誤:', error);
    } finally {
      this.isRendering = false;
      
      // 更新效能統計
      this.stats.renderTime = performance.now() - startTime;
      this.stats.renderedCount = this.renderedItems.length;
    }
  }

  /**
   * 渲染可視項目
   */
  renderVisibleItems() {
    const { start, end } = this.visibleRange;
    const visibleBooks = this.currentBooks.slice(start, end);
    
    // 批量渲染優化
    this._renderItemsBatch(visibleBooks, start);
  }

  // ===============================
  // 私有方法 - 效能優化
  // ===============================

  /**
   * 批量渲染項目
   * 
   * @param {Array} books - 書籍陣列
   * @param {number} startIndex - 起始索引
   */
  _renderItemsBatch(books, startIndex = 0) {
    const batchSize = CONSTANTS.PERFORMANCE.RENDER_BATCH_SIZE;
    
    // 優雅降級：優先使用 DocumentFragment，失敗時分批渲染
    const useFragment = typeof this.document.createDocumentFragment === 'function';
    
    if (useFragment) {
      try {
        const fragment = this.document.createDocumentFragment();
        
        books.forEach((book, index) => {
          const item = this._createAndPositionItem(book, startIndex + index);
          fragment.appendChild(item);
        });
        
        this.container.appendChild(fragment);
        this._checkMemoryUsage();
        return;
      } catch (error) {
        // Fragment 失敗，降級到分批渲染
      }
    }
    
    // 分批渲染避免 UI 阻塞
    this._renderInBatches(books, startIndex, batchSize);
  }

  /**
   * 創建並設定項目位置
   * 
   * @param {Object} book - 書籍資料
   * @param {number} index - 項目索引
   * @returns {HTMLElement} 配置好的項目元素
   */
  _createAndPositionItem(book, index) {
    const item = this.renderBookItem(book);
    
    // 設定項目位置
    const position = this.calculateItemPosition(index);
    item.style.position = 'absolute';
    item.style.left = `${position.x}px`;
    item.style.top = `${position.y}px`;
    
    this.renderedItems.push(item);
    return item;
  }

  /**
   * 分批渲染避免阻塞 UI
   * 
   * @param {Array} books - 書籍陣列
   * @param {number} startIndex - 起始索引
   * @param {number} batchSize - 批次大小
   */
  _renderInBatches(books, startIndex, batchSize) {
    let currentIndex = 0;
    
    const renderBatch = () => {
      const endIndex = Math.min(currentIndex + batchSize, books.length);
      
      // 渲染當前批次
      for (let i = currentIndex; i < endIndex; i++) {
        const item = this._createAndPositionItem(books[i], startIndex + i);
        this.container.appendChild(item);
      }
      
      currentIndex = endIndex;
      
      // 如果還有更多項目，在下一幀繼續
      if (currentIndex < books.length) {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(renderBatch);
        } else {
          // 測試環境或不支援 requestAnimationFrame 時使用 setTimeout
          setTimeout(renderBatch, 0);
        }
      } else {
        // 所有項目渲染完成，檢查記憶體使用
        this._checkMemoryUsage();
      }
    };
    
    renderBatch();
  }

  /**
   * 更新書籍資料
   * 
   * @param {Array} books - 新的書籍陣列
   */
  updateBooks(books) {
    this.renderBooks(books);
  }

  /**
   * 清空容器
   */
  clearContainer() {
    // 回收現有元素到池中
    this.renderedItems.forEach(item => {
      this._returnToPool(item);
    });
    
    this.container.innerHTML = '';
    this.renderedItems = [];
  }

  /**
   * 更新虛擬滾動容器高度
   */
  updateVirtualScrollerHeight() {
    if (this.config.virtualScrolling && this.totalItems > 0) {
      const columns = this.calculateColumns();
      const rows = Math.ceil(this.totalItems / columns);
      const totalHeight = rows * (this.config.itemHeight + this.config.gap);
      
      // 設定容器內部高度
      if (!this.virtualScrollContainer) {
        this.virtualScrollContainer = this.document.createElement('div');
        this.virtualScrollContainer.className = CONSTANTS.UI.CSS_CLASSES.VIRTUAL_SCROLLER;
        this.virtualScrollContainer.style.position = 'relative';
        this.container.appendChild(this.virtualScrollContainer);
      }
      
      this.virtualScrollContainer.style.height = `${totalHeight}px`;
    }
  }

  /**
   * 設定檢視模式
   * 
   * @param {string} mode - 檢視模式 ('grid' 或 'list')
   */
  setViewMode(mode) {
    if (mode !== 'grid' && mode !== 'list') {
      throw new Error(CONSTANTS.ERRORS.INVALID_VIEW_MODE);
    }
    
    this.config.viewMode = mode;
    
    // 更新容器 CSS 類別
    this.container.classList.remove(CONSTANTS.UI.CSS_CLASSES.GRID_VIEW, CONSTANTS.UI.CSS_CLASSES.LIST_VIEW);
    this.container.classList.add(
      mode === 'grid' ? CONSTANTS.UI.CSS_CLASSES.GRID_VIEW : CONSTANTS.UI.CSS_CLASSES.LIST_VIEW
    );
    
    // 重新渲染
    if (this.currentBooks.length > 0) {
      this.renderBooks(this.currentBooks);
    }
  }

  /**
   * 處理調整大小事件
   */
  handleResize() {
    if (this.currentBooks.length > 0) {
      // 重新計算佈局
      this.visibleRange = this.calculateVisibleRange(this.currentBooks);
      this.renderBooks(this.currentBooks);
    }
  }

  /**
   * 處理滾動事件
   * 
   * @param {Event} event - 滾動事件
   */
  handleScroll(event) {
    if (!this.config.virtualScrolling || this.isRendering || this.currentBooks.length === 0) return;
    
    const scrollTop = event.target.scrollTop || 0;
    const newRange = this.calculateVisibleRange(this.currentBooks, scrollTop);
    
    // 只在範圍變化時重新渲染
    if (newRange.start !== this.visibleRange.start || newRange.end !== this.visibleRange.end) {
      this.visibleRange = newRange;
      
      // 清空現有項目
      this.clearContainer();
      
      // 重新渲染可視項目
      this.renderVisibleItems();
    }
  }

  /**
   * 處理項目點擊事件
   * 
   * @param {Event} event - 點擊事件
   * @param {Object} book - 書籍資料
   */
  handleItemClick(event, book) {
    event.preventDefault();
    
    // 從事件委派中取得書籍資料
    let targetBook = book;
    if (!targetBook && event.target.closest('.book-grid-item')) {
      const item = event.target.closest('.book-grid-item');
      const bookData = item.dataset.book;
      if (bookData) {
        targetBook = JSON.parse(bookData);
      }
    }
    
    if (targetBook && this.onItemClick) {
      this.onItemClick(targetBook);
    }
  }

  /**
   * 處理項目懸停效果
   * 
   * @param {HTMLElement} element - 項目元素
   * @param {boolean} isHovering - 是否懸停
   */
  handleItemHover(element, isHovering) {
    if (isHovering) {
      element.classList.add(CONSTANTS.UI.CSS_CLASSES.HOVER);
    } else {
      element.classList.remove(CONSTANTS.UI.CSS_CLASSES.HOVER);
    }
  }

  /**
   * 處理鍵盤導航
   * 
   * @param {KeyboardEvent} event - 鍵盤事件
   */
  handleKeyNavigation(event) {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Space'];
    
    if (keys.includes(event.key)) {
      event.preventDefault();
      
      // 基本鍵盤導航實現
      // 可以根據需要擴展更複雜的導航邏輯
    }
  }

  /**
   * 設定項目點擊回調
   * 
   * @param {Function} callback - 點擊回調函數
   */
  setOnItemClick(callback) {
    this.onItemClick = callback;
  }

  /**
   * 取得虛擬滾動緩衝區大小
   * 
   * @returns {number} 緩衝區大小
   */
  getVirtualScrollBuffer() {
    return this.config.bufferSize;
  }

  /**
   * 項目回收機制
   */
  recycleItems() {
    // 回收不可視的項目到池中重複使用
    const recycledCount = this.renderedItems.length;
    this.recycledItems.push(...this.renderedItems);
    this.renderedItems = [];
    this.stats.recycledCount += recycledCount;
  }

  /**
   * 取得效能統計
   * 
   * @returns {Object} 效能統計資料
   */
  getPerformanceStats() {
    return { ...this.stats };
  }

  /**
   * 取得錯誤統計
   * 
   * @returns {Object} 錯誤統計資料
   */
  getErrorStats() {
    return { ...this.errorStats };
  }

  /**
   * 節流函數
   * 
   * @param {Function} func - 要節流的函數
   * @param {number} delay - 延遲時間
   * @returns {Function} 節流後的函數
   */
  // ===============================
  // 私有方法 - 工具函數
  // ===============================

  /**
   * 節流函數
   * 
   * @param {Function} func - 要節流的函數
   * @param {number} delay - 延遲時間
   * @returns {Function} 節流後的函數
   */
  _throttle(func, delay) {
    let timeoutId;
    let lastExecTime = 0;
    
    return function (...args) {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        func.apply(this, args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func.apply(this, args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }

  /**
   * 防抖函數
   * 
   * @param {Function} func - 要防抖的函數
   * @param {number} delay - 延遲時間
   * @returns {Function} 防抖後的函數
   */
  /**
   * 防抖函數
   * 
   * @param {Function} func - 要防抖的函數
   * @param {number} delay - 延遲時間
   * @returns {Function} 防抖後的函數
   */
  _debounce(func, delay) {
    let timeoutId;
    
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * 銷毀渲染器
   */
  destroy() {
    // 移除事件監聽器
    this.container.removeEventListener('scroll', this.throttledScrollHandler);
    this.container.removeEventListener('click', this.handleItemClick);
    this.container.removeEventListener('keydown', this.handleKeyNavigation);
    
    global.window?.removeEventListener('resize', this.debouncedResizeHandler);
    
    // 清理資源
    this.clearContainer();
    this.recycledItems = [];
    this.currentBooks = [];
    
    // 標記為已銷毀
    this.isDestroyed = true;
  }
}

// CommonJS 匯出
module.exports = BookGridRenderer;