# ⚡ Chrome Extension 載入效能優化指南

> **第三層參考文件** - 深度載入效能優化策略與實作技術  
> **目標讀者**: 前端效能工程師、Chrome Extension 開發者  
> **文件類型**: 技術實作參考手冊  

本文件提供 Readmoo 書庫提取器 Chrome Extension 的完整載入效能優化方案，涵蓋啟動優化、資料載入策略、懶載入技術等關鍵實作技術。

## 🎯 載入效能目標

### 效能基準設定
```javascript
// 載入效能基準
const LOADING_PERFORMANCE_TARGETS = {
  // Extension 啟動時間 (ms)
  EXTENSION_STARTUP: {
    excellent: 500,
    good: 1000,
    acceptable: 2000
  },
  
  // Popup 載入時間 (ms)
  POPUP_LOAD_TIME: {
    excellent: 300,
    good: 600,
    acceptable: 1000
  },
  
  // Content Script 注入時間 (ms)
  CONTENT_SCRIPT_INJECTION: {
    excellent: 100,
    good: 300,
    acceptable: 500
  },
  
  // 首次資料載入 (ms)
  FIRST_DATA_LOAD: {
    excellent: 2000,
    good: 4000,
    acceptable: 8000
  }
};
```

### 核心優化原則
- **漸進式載入**: 關鍵功能優先，次要功能延遲載入
- **並行處理**: 最大化並行請求，減少等待時間
- **快取策略**: 智能快取機制，避免重複載入
- **資源壓縮**: 最小化資源大小，加速傳輸

## 🚀 Extension 啟動優化

### Service Worker 快速啟動
```javascript
// src/background/fast-startup.js
class FastStartup {
  constructor() {
    this.startupTime = performance.now();
    this.criticalModulesLoaded = false;
    this.deferredInitTasks = [];
    
    this.initializeCriticalPath();
  }

  async initializeCriticalPath() {
    try {
      // Phase 1: 立即載入關鍵模組 (< 100ms)
      await this.loadCriticalModules();
      
      // Phase 2: 非同步載入次要模組
      this.deferNonCriticalInit();
      
      // 記錄啟動完成時間
      const startupDuration = performance.now() - this.startupTime;
      console.log(`🚀 Extension startup completed in ${startupDuration.toFixed(2)}ms`);
      
      // 發送啟動完成事件
      chrome.runtime.sendMessage({
        type: 'EXTENSION_READY',
        startupTime: startupDuration
      });
      
    } catch (error) {
      console.error('Extension startup failed:', error);
      this.fallbackInit();
    }
  }

  async loadCriticalModules() {
    const criticalTasks = [
      this.initializeStorage(),
      this.setupMessageHandlers(),
      this.initializeContextMenus()
    ];

    // 並行執行關鍵任務
    await Promise.all(criticalTasks);
    this.criticalModulesLoaded = true;
  }

  async initializeStorage() {
    // 載入必要的儲存配置
    const config = await chrome.storage.local.get(['user_config', 'cache_settings']);
    this.userConfig = config.user_config || this.getDefaultConfig();
    this.cacheSettings = config.cache_settings || this.getDefaultCacheSettings();
  }

  setupMessageHandlers() {
    // 設置關鍵的訊息處理器
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_STARTUP_STATUS') {
        sendResponse({
          ready: this.criticalModulesLoaded,
          startupTime: performance.now() - this.startupTime
        });
        return true;
      }
    });
  }

  initializeContextMenus() {
    // 建立必要的右鍵選單
    chrome.contextMenus.create({
      id: 'extract_books',
      title: '提取書籍資料',
      contexts: ['page']
    });
  }

  deferNonCriticalInit() {
    // 延遲執行非關鍵初始化任務
    setTimeout(async () => {
      await this.loadNonCriticalModules();
    }, 100);
  }

  async loadNonCriticalModules() {
    const nonCriticalTasks = [
      this.initializeAnalytics(),
      this.loadUserPreferences(),
      this.setupPeriodicTasks(),
      this.preloadCommonResources()
    ];

    // 順序執行非關鍵任務，避免資源競爭
    for (const task of nonCriticalTasks) {
      try {
        await task;
        await new Promise(resolve => setTimeout(resolve, 10)); // 小延遲，讓出執行權
      } catch (error) {
        console.warn('Non-critical task failed:', error);
      }
    }
  }

  async preloadCommonResources() {
    // 預載入常用資源
    const commonResources = [
      '/icons/icon-128.png',
      '/css/popup.css',
      '/js/popup.js'
    ];

    // 使用 fetch 預載入資源到瀏覽器快取
    const preloadTasks = commonResources.map(resource => 
      fetch(chrome.runtime.getURL(resource), { method: 'HEAD' }).catch(() => {})
    );

    await Promise.all(preloadTasks);
  }
}

// 立即啟動
new FastStartup();
```

### 模組懶載入系統
```javascript
// src/core/lazy-loader.js
class LazyLoader {
  constructor() {
    this.moduleCache = new Map();
    this.loadingModules = new Map(); // 避免重複載入
  }

  async loadModule(moduleName, options = {}) {
    // 檢查快取
    if (this.moduleCache.has(moduleName)) {
      return this.moduleCache.get(moduleName);
    }

    // 檢查是否正在載入
    if (this.loadingModules.has(moduleName)) {
      return this.loadingModules.get(moduleName);
    }

    // 開始載入模組
    const loadingPromise = this.performModuleLoad(moduleName, options);
    this.loadingModules.set(moduleName, loadingPromise);

    try {
      const module = await loadingPromise;
      this.moduleCache.set(moduleName, module);
      return module;
    } finally {
      this.loadingModules.delete(moduleName);
    }
  }

  async performModuleLoad(moduleName, options) {
    const startTime = performance.now();
    
    try {
      // 動態導入模組
      const moduleUrl = this.getModuleUrl(moduleName);
      const module = await import(moduleUrl);
      
      // 初始化模組 (如果需要)
      if (options.initialize && module.default?.initialize) {
        await module.default.initialize(options.initOptions);
      }

      const loadTime = performance.now() - startTime;
      console.log(`📦 Module "${moduleName}" loaded in ${loadTime.toFixed(2)}ms`);
      
      return module.default || module;
    } catch (error) {
      console.error(`Failed to load module "${moduleName}":`, error);
      throw error;
    }
  }

  getModuleUrl(moduleName) {
    const moduleMap = {
      'book-extractor': '/js/modules/book-extractor.js',
      'data-processor': '/js/modules/data-processor.js',
      'export-manager': '/js/modules/export-manager.js',
      'ui-manager': '/js/modules/ui-manager.js'
    };

    return chrome.runtime.getURL(moduleMap[moduleName] || `/js/modules/${moduleName}.js`);
  }

  preloadModule(moduleName, options = {}) {
    // 預載入模組 (不等待結果)
    this.loadModule(moduleName, options).catch(error => {
      console.warn(`Preload failed for module "${moduleName}":`, error);
    });
  }

  clearCache() {
    this.moduleCache.clear();
  }
}

// 全域實例
window.lazyLoader = new LazyLoader();
```

## 📊 資料載入優化策略

### 智能資料載入管理
```javascript
// src/core/data-loader.js
class IntelligentDataLoader {
  constructor() {
    this.loadingQueue = [];
    this.concurrentLimit = 3; // 最大並發請求數
    this.activeRequests = 0;
    this.cache = new Map();
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000
    };
  }

  async loadData(dataType, params = {}, options = {}) {
    const cacheKey = this.generateCacheKey(dataType, params);
    
    // 檢查快取
    if (this.cache.has(cacheKey) && !options.forceReload) {
      const cachedData = this.cache.get(cacheKey);
      if (this.isCacheValid(cachedData)) {
        console.log(`📋 Using cached data for ${dataType}`);
        return cachedData.data;
      }
    }

    // 建立載入任務
    const loadTask = {
      id: Date.now() + Math.random(),
      dataType,
      params,
      options,
      cacheKey,
      priority: options.priority || 'normal',
      resolve: null,
      reject: null
    };

    return new Promise((resolve, reject) => {
      loadTask.resolve = resolve;
      loadTask.reject = reject;
      
      this.enqueueTask(loadTask);
      this.processQueue();
    });
  }

  enqueueTask(task) {
    // 根據優先級插入佇列
    const priorityMap = { high: 3, normal: 2, low: 1 };
    const taskPriority = priorityMap[task.priority] || 2;

    let insertIndex = this.loadingQueue.length;
    for (let i = 0; i < this.loadingQueue.length; i++) {
      const queuePriority = priorityMap[this.loadingQueue[i].priority] || 2;
      if (taskPriority > queuePriority) {
        insertIndex = i;
        break;
      }
    }

    this.loadingQueue.splice(insertIndex, 0, task);
  }

  async processQueue() {
    if (this.activeRequests >= this.concurrentLimit || this.loadingQueue.length === 0) {
      return;
    }

    const task = this.loadingQueue.shift();
    this.activeRequests++;

    try {
      const data = await this.executeDataLoad(task);
      
      // 快取結果
      this.cache.set(task.cacheKey, {
        data,
        timestamp: Date.now(),
        ttl: task.options.cacheTtl || 5 * 60 * 1000 // 5分鐘預設
      });

      task.resolve(data);
    } catch (error) {
      task.reject(error);
    } finally {
      this.activeRequests--;
      // 繼續處理佇列
      setTimeout(() => this.processQueue(), 10);
    }
  }

  async executeDataLoad(task) {
    const { dataType, params, options } = task;
    const startTime = performance.now();

    try {
      let data;
      
      switch (dataType) {
        case 'user_books':
          data = await this.loadUserBooks(params);
          break;
        case 'book_details':
          data = await this.loadBookDetails(params);
          break;
        case 'reading_progress':
          data = await this.loadReadingProgress(params);
          break;
        default:
          throw new Error(`Unknown data type: ${dataType}`);
      }

      const loadTime = performance.now() - startTime;
      console.log(`📊 Loaded ${dataType} in ${loadTime.toFixed(2)}ms`);
      
      return data;
    } catch (error) {
      // 重試機制
      if (task.retryCount < this.retryConfig.maxRetries) {
        task.retryCount = (task.retryCount || 0) + 1;
        const delay = this.retryConfig.baseDelay * Math.pow(2, task.retryCount - 1);
        
        console.warn(`Retrying ${dataType} (attempt ${task.retryCount}/${this.retryConfig.maxRetries}) after ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeDataLoad(task);
      }
      
      throw error;
    }
  }

  async loadUserBooks(params) {
    // 分頁載入書籍列表
    const { page = 1, limit = 20 } = params;
    
    const response = await this.makeRequest(`/api/books?page=${page}&limit=${limit}`);
    return response.books;
  }

  async loadBookDetails(params) {
    const { bookId } = params;
    
    const response = await this.makeRequest(`/api/books/${bookId}`);
    return response.book;
  }

  async makeRequest(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 10000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  generateCacheKey(dataType, params) {
    return `${dataType}_${JSON.stringify(params)}`;
  }

  isCacheValid(cachedData) {
    const now = Date.now();
    return (now - cachedData.timestamp) < cachedData.ttl;
  }
}

// 全域實例
window.dataLoader = new IntelligentDataLoader();
```

### 分頁載入與虛擬滾動
```javascript
// src/ui/virtualized-book-list.js
class VirtualizedBookList {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 80;
    this.bufferSize = options.bufferSize || 5;
    this.pageSize = options.pageSize || 20;
    
    this.data = [];
    this.renderedItems = new Map();
    this.loadedPages = new Set();
    this.isLoading = false;
    
    this.initializeContainer();
    this.setupScrollHandling();
  }

  initializeContainer() {
    this.container.style.position = 'relative';
    this.container.style.overflow = 'auto';
    
    // 建立虛擬容器
    this.virtualContainer = document.createElement('div');
    this.virtualContainer.style.position = 'relative';
    this.container.appendChild(this.virtualContainer);
  }

  async loadInitialData() {
    await this.loadPage(1);
    this.render();
  }

  async loadPage(pageNumber) {
    if (this.loadedPages.has(pageNumber) || this.isLoading) {
      return;
    }

    this.isLoading = true;
    console.log(`📖 Loading page ${pageNumber}`);

    try {
      const books = await window.dataLoader.loadData('user_books', {
        page: pageNumber,
        limit: this.pageSize
      });

      const startIndex = (pageNumber - 1) * this.pageSize;
      
      // 插入或更新資料
      for (let i = 0; i < books.length; i++) {
        this.data[startIndex + i] = books[i];
      }

      this.loadedPages.add(pageNumber);
      this.updateVirtualHeight();
      this.render();
      
    } catch (error) {
      console.error(`Failed to load page ${pageNumber}:`, error);
    } finally {
      this.isLoading = false;
    }
  }

  setupScrollHandling() {
    let ticking = false;

    this.container.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  async handleScroll() {
    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;
    
    // 計算當前可見範圍
    const startIndex = Math.floor(scrollTop / this.itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / this.itemHeight) + this.bufferSize,
      this.data.length
    );

    // 檢查是否需要載入更多資料
    const currentPage = Math.ceil(endIndex / this.pageSize);
    if (!this.loadedPages.has(currentPage + 1) && !this.isLoading) {
      await this.loadPage(currentPage + 1);
    }

    this.render(startIndex, endIndex);
  }

  render(startIndex = 0, endIndex = Math.min(20, this.data.length)) {
    // 清理不在可見範圍的項目
    for (const [index, element] of this.renderedItems) {
      if (index < startIndex || index >= endIndex) {
        element.remove();
        this.renderedItems.delete(index);
      }
    }

    // 渲染可見範圍內的項目
    for (let i = startIndex; i < endIndex; i++) {
      if (this.data[i] && !this.renderedItems.has(i)) {
        const element = this.createBookItem(this.data[i], i);
        this.virtualContainer.appendChild(element);
        this.renderedItems.set(i, element);
      }
    }
  }

  createBookItem(book, index) {
    const item = document.createElement('div');
    item.className = 'book-item';
    item.style.position = 'absolute';
    item.style.top = `${index * this.itemHeight}px`;
    item.style.height = `${this.itemHeight}px`;
    item.style.width = '100%';
    
    // 使用 DocumentFragment 提升效能
    const fragment = document.createDocumentFragment();
    
    const img = document.createElement('img');
    img.src = book.cover_url || '/images/default-book-cover.png';
    img.alt = book.title;
    img.style.width = '60px';
    img.style.height = '60px';
    img.loading = 'lazy'; // 原生懶載入
    
    const info = document.createElement('div');
    info.innerHTML = `
      <h3>${book.title}</h3>
      <p>作者: ${book.author}</p>
      <p>進度: ${book.reading_progress || 0}%</p>
    `;
    
    fragment.appendChild(img);
    fragment.appendChild(info);
    item.appendChild(fragment);
    
    return item;
  }

  updateVirtualHeight() {
    const totalHeight = this.data.length * this.itemHeight;
    this.virtualContainer.style.height = `${totalHeight}px`;
  }
}
```

## 🔄 懶載入與預載入策略

### 圖片懶載入優化
```javascript
// src/core/image-lazy-loader.js
class ImageLazyLoader {
  constructor(options = {}) {
    this.rootMargin = options.rootMargin || '50px';
    this.threshold = options.threshold || 0.1;
    this.imageCache = new Map();
    
    this.setupIntersectionObserver();
  }

  setupIntersectionObserver() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadImage(entry.target);
          this.observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: this.rootMargin,
      threshold: this.threshold
    });
  }

  observe(img) {
    // 設置佔位符
    if (!img.src) {
      img.src = this.generatePlaceholder(img.dataset.width, img.dataset.height);
    }
    
    this.observer.observe(img);
  }

  async loadImage(img) {
    const src = img.dataset.src;
    if (!src) return;

    try {
      // 檢查快取
      if (this.imageCache.has(src)) {
        img.src = this.imageCache.get(src);
        img.classList.add('loaded');
        return;
      }

      // 預載入圖片
      const loadedImg = new Image();
      loadedImg.onload = () => {
        // 快取已載入的圖片
        this.imageCache.set(src, src);
        
        // 淡入效果
        img.style.transition = 'opacity 0.3s ease';
        img.style.opacity = '0';
        img.src = src;
        
        img.onload = () => {
          img.style.opacity = '1';
          img.classList.add('loaded');
        };
      };

      loadedImg.onerror = () => {
        // 載入失敗時使用預設圖片
        img.src = '/images/book-cover-error.png';
        img.classList.add('error');
      };

      loadedImg.src = src;
      
    } catch (error) {
      console.error('Image loading failed:', error);
      img.src = '/images/book-cover-error.png';
      img.classList.add('error');
    }
  }

  generatePlaceholder(width = 200, height = 300) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    
    // 漸層背景
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f0f0f0');
    gradient.addColorStop(1, '#e0e0e0');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // 載入指示器
    ctx.fillStyle = '#ccc';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('載入中...', width / 2, height / 2);
    
    return canvas.toDataURL();
  }

  preloadImages(urls) {
    urls.forEach(url => {
      if (!this.imageCache.has(url)) {
        const img = new Image();
        img.onload = () => this.imageCache.set(url, url);
        img.src = url;
      }
    });
  }
}

// 全域實例
window.imageLazyLoader = new ImageLazyLoader();
```

### 資源預載入管理
```javascript
// src/core/resource-preloader.js
class ResourcePreloader {
  constructor() {
    this.preloadCache = new Map();
    this.preloadQueue = [];
    this.isPreloading = false;
  }

  async preloadCriticalResources() {
    const criticalResources = [
      { type: 'image', url: '/icons/icon-128.png' },
      { type: 'style', url: '/css/popup.css' },
      { type: 'script', url: '/js/popup-main.js' },
      { type: 'data', url: '/api/user-preferences' }
    ];

    console.log('🚀 Starting critical resource preload');
    
    await Promise.all(criticalResources.map(resource => 
      this.preloadResource(resource)
    ));

    console.log('✅ Critical resources preloaded');
  }

  async preloadResource(resource) {
    if (this.preloadCache.has(resource.url)) {
      return this.preloadCache.get(resource.url);
    }

    const preloadPromise = this.performPreload(resource);
    this.preloadCache.set(resource.url, preloadPromise);
    
    return preloadPromise;
  }

  async performPreload(resource) {
    const startTime = performance.now();
    
    try {
      switch (resource.type) {
        case 'image':
          return await this.preloadImage(resource.url);
        case 'style':
          return await this.preloadStylesheet(resource.url);
        case 'script':
          return await this.preloadScript(resource.url);
        case 'data':
          return await this.preloadData(resource.url);
        default:
          return await this.preloadGeneric(resource.url);
      }
    } catch (error) {
      console.error(`Preload failed for ${resource.url}:`, error);
      throw error;
    } finally {
      const duration = performance.now() - startTime;
      console.log(`📦 Preloaded ${resource.url} in ${duration.toFixed(2)}ms`);
    }
  }

  preloadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  preloadStylesheet(url) {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'style';
      link.href = url;
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  preloadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      // 不執行，只預載入
      script.async = false;
      document.head.appendChild(script);
    });
  }

  async preloadData(url) {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'force-cache'
    });
    return await response.json();
  }

  async preloadGeneric(url) {
    const response = await fetch(url, {
      method: 'HEAD',
      cache: 'force-cache'
    });
    return response.ok;
  }

  // 智能預載入 - 根據使用者行為預測
  async intelligentPreload(userBehavior) {
    const predictions = this.predictNextResources(userBehavior);
    
    for (const resource of predictions) {
      this.preloadQueue.push(resource);
    }

    this.processPreloadQueue();
  }

  predictNextResources(behavior) {
    // 簡單的預測邏輯，實際可以更複雜
    const predictions = [];
    
    if (behavior.lastAction === 'view_book_list') {
      predictions.push(
        { type: 'data', url: '/api/books/popular' },
        { type: 'image', url: '/images/book-covers-batch-1.jpg' }
      );
    }
    
    if (behavior.currentPage === 'popup' && behavior.timeOnPage > 5000) {
      predictions.push(
        { type: 'script', url: '/js/book-detail-modal.js' },
        { type: 'style', url: '/css/book-detail.css' }
      );
    }

    return predictions;
  }

  async processPreloadQueue() {
    if (this.isPreloading || this.preloadQueue.length === 0) {
      return;
    }

    this.isPreloading = true;

    while (this.preloadQueue.length > 0) {
      const resource = this.preloadQueue.shift();
      try {
        await this.preloadResource(resource);
        // 小延遲避免阻塞主執行緒
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn('Queue preload failed:', error);
      }
    }

    this.isPreloading = false;
  }
}

// 全域實例
window.resourcePreloader = new ResourcePreloader();
```

## 📈 載入效能監控與優化

### 載入效能分析器
```javascript
// src/core/loading-performance-analyzer.js
class LoadingPerformanceAnalyzer {
  constructor() {
    this.metrics = [];
    this.observers = [];
    
    this.initializeObservers();
  }

  initializeObservers() {
    // 監控 Navigation Timing
    this.observeNavigationTiming();
    
    // 監控 Resource Timing
    this.observeResourceTiming();
    
    // 監控 First Paint, FCP
    this.observePaintTiming();
    
    // 監控 Largest Contentful Paint
    this.observeLCP();
  }

  observeNavigationTiming() {
    if ('navigation' in performance) {
      const navigation = performance.getEntriesByType('navigation')[0];
      
      this.recordMetric('navigation', {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        domComplete: navigation.domComplete - navigation.domLoading,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart
      });
    }
  }

  observeResourceTiming() {
    const resourceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.initiatorType === 'img' || entry.initiatorType === 'script') {
          this.recordMetric('resource', {
            name: entry.name,
            type: entry.initiatorType,
            duration: entry.duration,
            size: entry.transferSize
          });
        }
      }
    });

    resourceObserver.observe({ entryTypes: ['resource'] });
    this.observers.push(resourceObserver);
  }

  observePaintTiming() {
    const paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.recordMetric('paint', {
          name: entry.name,
          startTime: entry.startTime
        });
      }
    });

    paintObserver.observe({ entryTypes: ['paint'] });
    this.observers.push(paintObserver);
  }

  observeLCP() {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      
      this.recordMetric('lcp', {
        startTime: lastEntry.startTime,
        element: lastEntry.element?.tagName,
        url: lastEntry.url
      });
    });

    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    this.observers.push(lcpObserver);
  }

  recordMetric(type, data) {
    const metric = {
      type,
      timestamp: Date.now(),
      data
    };

    this.metrics.push(metric);
    console.log(`📊 Performance metric recorded:`, metric);

    // 分析並提供優化建議
    this.analyzeMetric(metric);
  }

  analyzeMetric(metric) {
    switch (metric.type) {
      case 'navigation':
        if (metric.data.domContentLoaded > 1000) {
          console.warn('⚠️ DOM loading is slow, consider optimizing critical resources');
        }
        break;
        
      case 'resource':
        if (metric.data.duration > 2000) {
          console.warn(`⚠️ Slow resource loading: ${metric.data.name}`);
        }
        if (metric.data.size > 500000) { // 500KB
          console.warn(`⚠️ Large resource size: ${metric.data.name} (${(metric.data.size / 1024).toFixed(2)}KB)`);
        }
        break;
        
      case 'lcp':
        if (metric.data.startTime > 2500) {
          console.warn('⚠️ LCP is slow, optimize critical path rendering');
        }
        break;
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      metrics: this.metrics,
      recommendations: this.generateRecommendations()
    };

    console.group('📊 Loading Performance Report');
    console.table(report.summary);
    console.log('Recommendations:', report.recommendations);
    console.groupEnd();

    return report;
  }

  generateSummary() {
    const summary = {};
    
    // 按類型分組統計
    for (const metric of this.metrics) {
      if (!summary[metric.type]) {
        summary[metric.type] = { count: 0, totalTime: 0, avgTime: 0 };
      }
      
      summary[metric.type].count++;
      
      if (metric.data.duration) {
        summary[metric.type].totalTime += metric.data.duration;
        summary[metric.type].avgTime = summary[metric.type].totalTime / summary[metric.type].count;
      }
    }

    return summary;
  }

  generateRecommendations() {
    const recommendations = [];
    const summary = this.generateSummary();

    // 基於指標生成建議
    if (summary.resource?.avgTime > 1000) {
      recommendations.push('Consider implementing resource compression and CDN');
    }

    if (summary.lcp?.avgTime > 2500) {
      recommendations.push('Optimize critical path rendering and preload key resources');
    }

    if (this.metrics.filter(m => m.type === 'resource' && m.data.size > 500000).length > 0) {
      recommendations.push('Large resources detected, implement code splitting');
    }

    return recommendations;
  }

  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.metrics = [];
  }
}

// 全域實例
window.loadingAnalyzer = new LoadingPerformanceAnalyzer();
```

## 🛠️ 實施最佳實踐

### Popup 快速載入實作
```javascript
// src/popup/fast-popup.js
class FastPopup {
  constructor() {
    this.loadStartTime = performance.now();
    this.criticalDataLoaded = false;
    
    this.initializeFastLoad();
  }

  async initializeFastLoad() {
    try {
      // Phase 1: 立即顯示骨架屏
      this.showSkeleton();
      
      // Phase 2: 載入關鍵資料
      await this.loadCriticalData();
      
      // Phase 3: 渲染主要內容
      this.renderMainContent();
      
      // Phase 4: 懶載入次要內容
      this.lazyLoadSecondaryContent();
      
      const totalTime = performance.now() - this.loadStartTime;
      console.log(`🎉 Popup loaded in ${totalTime.toFixed(2)}ms`);
      
    } catch (error) {
      console.error('Popup loading failed:', error);
      this.showErrorState();
    }
  }

  showSkeleton() {
    const skeleton = `
      <div class="skeleton">
        <div class="skeleton-header"></div>
        <div class="skeleton-list">
          ${Array(5).fill('<div class="skeleton-item"></div>').join('')}
        </div>
      </div>
    `;
    
    document.body.innerHTML = skeleton;
  }

  async loadCriticalData() {
    // 並行載入關鍵資料
    const [userConfig, recentBooks] = await Promise.all([
      window.dataLoader.loadData('user_config', {}, { priority: 'high' }),
      window.dataLoader.loadData('user_books', { page: 1, limit: 10 }, { priority: 'high' })
    ]);

    this.userConfig = userConfig;
    this.recentBooks = recentBooks;
    this.criticalDataLoaded = true;
  }

  renderMainContent() {
    if (!this.criticalDataLoaded) return;

    const mainContent = `
      <header class="popup-header">
        <h1>我的書庫</h1>
        <div class="stats">
          <span>共 ${this.recentBooks.length} 本書</span>
        </div>
      </header>
      <main class="book-list" id="bookList">
        ${this.renderBookList(this.recentBooks)}
      </main>
      <footer class="popup-footer">
        <button id="viewAllBooks">查看全部書籍</button>
      </footer>
    `;

    document.body.innerHTML = mainContent;
    this.attachEventListeners();
  }

  renderBookList(books) {
    return books.map(book => `
      <div class="book-item" data-book-id="${book.id}">
        <img data-src="${book.cover_url}" 
             alt="${book.title}" 
             class="book-cover lazy-load"
             width="60" height="80">
        <div class="book-info">
          <h3>${book.title}</h3>
          <p>${book.author}</p>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${book.reading_progress || 0}%"></div>
          </div>
        </div>
      </div>
    `).join('');
  }

  lazyLoadSecondaryContent() {
    // 懶載入圖片
    const lazyImages = document.querySelectorAll('.lazy-load');
    lazyImages.forEach(img => window.imageLazyLoader.observe(img));

    // 預載入可能需要的資源
    setTimeout(() => {
      window.resourcePreloader.intelligentPreload({
        currentPage: 'popup',
        timeOnPage: performance.now() - this.loadStartTime,
        lastAction: 'view_recent_books'
      });
    }, 1000);
  }

  attachEventListeners() {
    document.getElementById('viewAllBooks')?.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('/pages/library.html') });
    });

    document.querySelectorAll('.book-item').forEach(item => {
      item.addEventListener('click', () => {
        const bookId = item.dataset.bookId;
        this.openBookDetail(bookId);
      });
    });
  }

  async openBookDetail(bookId) {
    // 立即顯示載入狀態
    const bookItem = document.querySelector(`[data-book-id="${bookId}"]`);
    bookItem.classList.add('loading');

    try {
      // 載入書籍詳情
      const bookDetail = await window.dataLoader.loadData('book_details', { bookId });
      this.showBookDetailModal(bookDetail);
    } catch (error) {
      console.error('Failed to load book detail:', error);
      this.showError('載入書籍詳情失敗');
    } finally {
      bookItem.classList.remove('loading');
    }
  }

  showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-toast';
    errorElement.textContent = message;
    document.body.appendChild(errorElement);

    setTimeout(() => {
      errorElement.remove();
    }, 3000);
  }
}

// 當 DOM 載入完成時啟動
document.addEventListener('DOMContentLoaded', () => {
  new FastPopup();
});
```

## 📚 相關資源

### 內部文件連結
- [效能監控體系](./monitoring-system.md)
- [記憶體最佳化指南](./memory-optimization.md)
- [效能測試方法](./performance-testing.md)
- [效能問題診斷](../troubleshooting/performance-troubleshooting.md)

### 外部參考資源
- [Web Performance Fundamentals](https://web.dev/performance/)
- [Chrome Extension Performance](https://developer.chrome.com/docs/extensions/mv3/performance/)
- [Resource Hints Specification](https://www.w3.org/TR/resource-hints/)
- [Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)

## ✅ 載入效能優化檢查清單

完整載入效能優化的檢查項目：

- [ ] **Extension 啟動優化**: 關鍵路徑分離，非關鍵功能延遲載入
- [ ] **模組懶載入**: 動態導入機制，按需載入功能模組  
- [ ] **資料載入策略**: 並發控制、優先級佇列、重試機制
- [ ] **虛擬滾動**: 大量列表資料虛擬化渲染
- [ ] **圖片懶載入**: Intersection Observer 實現高效圖片載入
- [ ] **資源預載入**: 智能預測與關鍵資源預載入
- [ ] **快取策略**: 多層次快取機制，減少重複請求
- [ ] **效能監控**: 載入時間監控與自動化效能分析
- [ ] **骨架屏設計**: 改善載入過程中的使用者體驗

---

**⚡ 載入效能優化體系已完成，開始實現極速的使用者體驗！**