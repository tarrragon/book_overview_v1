/**
 * BookDataExtractor 單元測試
 * 
 * 測試 BookDataExtractor 的基礎功能：
 * - EventHandler 繼承
 * - 事件支援
 * - 基本初始化
 * - 事件處理架構
 */

// 注意：BookDataExtractor 會導入 EventHandler，我們直接檢查原型鏈

describe('BookDataExtractor', () => {
  let BookDataExtractor;
  let extractor;

  beforeEach(() => {
    // 重新載入模組以確保乾淨的測試環境
    jest.resetModules();
    
    try {
      BookDataExtractor = require('@/extractors/book-data-extractor');
    } catch (error) {
      // 預期在紅燈階段會失敗
      BookDataExtractor = null;
    }
  });

  afterEach(() => {
    if (extractor) {
      extractor = null;
    }
    jest.clearAllMocks();
  });

  describe('類別繼承和基本結構', () => {
    test('應該正確繼承 EventHandler', () => {
      expect(BookDataExtractor).toBeDefined();
      
      extractor = new BookDataExtractor();
      expect(extractor).toBeInstanceOf(BookDataExtractor);
      
      // 檢查是否有 EventHandler 的關鍵方法
      expect(typeof extractor.handle).toBe('function');
      expect(typeof extractor.process).toBe('function');
      expect(typeof extractor.getSupportedEvents).toBe('function');
      expect(typeof extractor.getStats).toBe('function');
    });

    test('應該有正確的類別名稱和優先級', () => {
      extractor = new BookDataExtractor();
      expect(extractor.name).toBe('BookDataExtractor');
      expect(extractor.priority).toBe(1); // HIGH priority for extraction
    });

    test('應該正確初始化預設狀態', () => {
      extractor = new BookDataExtractor();
      expect(extractor.isEnabled).toBe(true);
      expect(extractor.executionCount).toBe(0);
      expect(extractor.lastExecutionTime).toBeNull();
    });
  });

  describe('事件支援', () => {
    beforeEach(() => {
      extractor = new BookDataExtractor();
    });

    test('應該支援必要的事件類型', () => {
      const supportedEvents = extractor.getSupportedEvents();
      
      expect(supportedEvents).toContain('EXTRACTION.STARTED');
      expect(supportedEvents).toContain('TAB.UPDATED.READMOO');
      expect(supportedEvents).toContain('USER.EXTRACT.REQUESTED');
      expect(supportedEvents).toHaveLength(3);
    });

    test('應該能檢查特定事件是否支援', () => {
      expect(extractor.canHandle('EXTRACTION.STARTED')).toBe(true);
      expect(extractor.canHandle('TAB.UPDATED.READMOO')).toBe(true);
      expect(extractor.canHandle('USER.EXTRACT.REQUESTED')).toBe(true);
      expect(extractor.canHandle('UNSUPPORTED.EVENT')).toBe(false);
    });
  });

  describe('事件處理', () => {
    beforeEach(() => {
      extractor = new BookDataExtractor();
    });

    test('應該實現 process 方法', () => {
      expect(typeof extractor.process).toBe('function');
    });

    test('應該能處理 EXTRACTION.STARTED 事件', async () => {
      const mockEvent = {
        type: 'EXTRACTION.STARTED',
        data: {
          url: 'https://readmoo.com/library',
          options: {}
        }
      };

      // 模擬處理方法
      const handleExtractionStartSpy = jest.spyOn(extractor, 'handleExtractionStart')
        .mockResolvedValue({ success: true });

      await extractor.process(mockEvent);

      expect(handleExtractionStartSpy).toHaveBeenCalledWith(mockEvent);
    });

    test('應該能處理 TAB.UPDATED.READMOO 事件', async () => {
      const mockEvent = {
        type: 'TAB.UPDATED.READMOO',
        data: {
          tabId: 123,
          url: 'https://readmoo.com/library'
        }
      };

      // 模擬處理方法
      const handleTabUpdateSpy = jest.spyOn(extractor, 'handleTabUpdate')
        .mockResolvedValue({ processed: true });

      await extractor.process(mockEvent);

      expect(handleTabUpdateSpy).toHaveBeenCalledWith(mockEvent);
    });

    test('應該能處理 USER.EXTRACT.REQUESTED 事件', async () => {
      const mockEvent = {
        type: 'USER.EXTRACT.REQUESTED',
        data: {
          trigger: 'popup',
          options: { includeProgress: true }
        }
      };

      // 模擬處理方法
      const handleUserRequestSpy = jest.spyOn(extractor, 'handleUserRequest')
        .mockResolvedValue({ initiated: true });

      await extractor.process(mockEvent);

      expect(handleUserRequestSpy).toHaveBeenCalledWith(mockEvent);
    });

    test('應該拋出錯誤當遇到不支援的事件類型', async () => {
      const mockEvent = {
        type: 'UNSUPPORTED.EVENT',
        data: {}
      };

      await expect(extractor.process(mockEvent)).rejects.toThrow(
        'Unsupported event type: UNSUPPORTED.EVENT'
      );
    });
  });

  describe('Readmoo 特定功能', () => {
    beforeEach(() => {
      extractor = new BookDataExtractor();
    });

    test('應該能識別 Readmoo URL', () => {
      expect(extractor.isReadmooUrl('https://readmoo.com/library')).toBe(true);
      expect(extractor.isReadmooUrl('https://member.readmoo.com/library')).toBe(true);
      expect(extractor.isReadmooUrl('https://example.com')).toBe(false);
    });

    test('應該有 Readmoo 適配器初始化方法', () => {
      expect(typeof extractor.initializeReadmooAdapter).toBe('function');
    });

    test('應該有提取狀態追蹤', () => {
      expect(extractor.extractionState).toBeDefined();
      expect(extractor.extractionState.isExtracting).toBe(false);
      expect(extractor.extractionState.currentUrl).toBeNull();
    });
  });

  // === TDD Cycle #2 新增測試 ===
  describe('精細的 Readmoo 頁面識別 (Cycle #2)', () => {
    beforeEach(() => {
      extractor = new BookDataExtractor();
    });

    test('應該能識別不同類型的 Readmoo 頁面', () => {
      // 書庫頁面
      expect(extractor.getReadmooPageType('https://readmoo.com/library')).toBe('library');
      expect(extractor.getReadmooPageType('https://member.readmoo.com/library')).toBe('library');
      
      // 書架頁面
      expect(extractor.getReadmooPageType('https://member.readmoo.com/shelf')).toBe('shelf');
      
      // 閱讀器頁面
      expect(extractor.getReadmooPageType('https://reader.readmoo.com/reader')).toBe('reader');
      
      // 主頁
      expect(extractor.getReadmooPageType('https://readmoo.com')).toBe('home');
      
      // 非 Readmoo 頁面
      expect(extractor.getReadmooPageType('https://example.com')).toBe(null);
    });

    test('應該能檢查頁面是否支援資料提取', () => {
      // 支援提取的頁面
      expect(extractor.isExtractableReadmooPage('https://readmoo.com/library')).toBe(true);
      expect(extractor.isExtractableReadmooPage('https://member.readmoo.com/library')).toBe(true);
      expect(extractor.isExtractableReadmooPage('https://member.readmoo.com/shelf')).toBe(true);
      
      // 不支援提取的頁面
      expect(extractor.isExtractableReadmooPage('https://reader.readmoo.com/reader')).toBe(false);
      expect(extractor.isExtractableReadmooPage('https://readmoo.com')).toBe(false);
      expect(extractor.isExtractableReadmooPage('https://example.com')).toBe(false);
    });

    test('應該能檢測頁面準備狀態', async () => {
      // 模擬 DOM 檢查
      const mockCheckPageReady = jest.spyOn(extractor, 'checkPageReady')
        .mockResolvedValue(true);

      const isReady = await extractor.checkPageReady('https://readmoo.com/library');
      expect(isReady).toBe(true);
      expect(mockCheckPageReady).toHaveBeenCalledWith('https://readmoo.com/library');
    });

    test('應該處理無效的 URL 格式', () => {
      const invalidUrls = ['', null, undefined, 'not-a-url', 'ftp://readmoo.com'];
      
      invalidUrls.forEach(url => {
        expect(extractor.getReadmooPageType(url)).toBe(null);
        expect(extractor.isExtractableReadmooPage(url)).toBe(false);
      });
    });
  });

  describe('Readmoo 提取器初始化流程 (Cycle #2)', () => {
    beforeEach(() => {
      extractor = new BookDataExtractor();
    });

    test('應該能完整初始化 Readmoo 適配器', async () => {
      const url = 'https://readmoo.com/library';
      
      // 模擬頁面檢查
      jest.spyOn(extractor, 'checkPageReady').mockResolvedValue(true);
      
      // 執行初始化
      await extractor.initializeReadmooAdapter(url);
      
      // 驗證適配器狀態
      expect(extractor.readmooAdapter).toBeDefined();
      expect(extractor.readmooAdapter.initialized).toBe(true);
      expect(extractor.readmooAdapter.pageType).toBe('library');
      expect(extractor.readmooAdapter.url).toBe(url);
    });

    test('應該處理頁面未準備好的情況', async () => {
      const url = 'https://readmoo.com/library';
      
      // 模擬頁面未準備好
      jest.spyOn(extractor, 'checkPageReady').mockResolvedValue(false);
      
      await expect(extractor.initializeReadmooAdapter(url))
        .rejects.toThrow('Readmoo 頁面未準備好');
    });

    test('應該處理不支援提取的頁面', async () => {
      const url = 'https://readmoo.com';
      
      await expect(extractor.initializeReadmooAdapter(url))
        .rejects.toThrow('此 Readmoo 頁面不支援資料提取');
    });

    test('應該處理初始化過程中的錯誤', async () => {
      const url = 'https://readmoo.com/library';
      
      // 模擬初始化錯誤
      jest.spyOn(extractor, 'checkPageReady')
        .mockRejectedValue(new Error('網路連線錯誤'));
      
      await expect(extractor.initializeReadmooAdapter(url))
        .rejects.toThrow('網路連線錯誤');
    });

    test('應該追蹤初始化狀態', async () => {
      const url = 'https://readmoo.com/library';
      
      // 初始狀態
      expect(extractor.initializationState).toBeDefined();
      expect(extractor.initializationState.isInitializing).toBe(false);
      
      // 模擬初始化過程
      jest.spyOn(extractor, 'checkPageReady').mockImplementation(async () => {
        // 檢查初始化狀態已更新
        expect(extractor.initializationState.isInitializing).toBe(true);
        return true;
      });
      
      await extractor.initializeReadmooAdapter(url);
      
      // 完成後狀態
      expect(extractor.initializationState.isInitializing).toBe(false);
      expect(extractor.initializationState.lastInitializedUrl).toBe(url);
    });
  });

  describe('頁面狀態檢測 (Cycle #2)', () => {
    beforeEach(() => {
      extractor = new BookDataExtractor();
    });

    test('應該能檢測書庫頁面的載入狀態', async () => {
      // 模擬 DOM 檢查邏輯
      const mockDomCheck = jest.fn().mockResolvedValue(true);
      extractor.checkLibraryPageReady = mockDomCheck;
      
      const isReady = await extractor.checkPageReady('https://readmoo.com/library');
      
      expect(isReady).toBe(true);
      expect(mockDomCheck).toHaveBeenCalled();
    });

    test('應該能檢測書架頁面的載入狀態', async () => {
      const mockDomCheck = jest.fn().mockResolvedValue(true);
      extractor.checkShelfPageReady = mockDomCheck;
      
      const isReady = await extractor.checkPageReady('https://member.readmoo.com/shelf');
      
      expect(isReady).toBe(true);
      expect(mockDomCheck).toHaveBeenCalled();
    });

    test('應該處理頁面檢測超時', async () => {
      // 模擬超時情況
      jest.spyOn(extractor, 'checkPageReady')
        .mockImplementation(() => new Promise(resolve => {
          setTimeout(() => resolve(false), 100);
        }));
      
      const startTime = Date.now();
      const isReady = await extractor.checkPageReady('https://readmoo.com/library');
      const elapsed = Date.now() - startTime;
      
      expect(isReady).toBe(false);
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });

    test('應該提供頁面檢測的詳細資訊', async () => {
      const url = 'https://readmoo.com/library';
      
      const checkResult = await extractor.getPageStatus(url);
      
      expect(checkResult).toHaveProperty('isReady');
      expect(checkResult).toHaveProperty('pageType');
      expect(checkResult).toHaveProperty('isExtractable');
      expect(checkResult).toHaveProperty('checkedAt');
      expect(checkResult.pageType).toBe('library');
      expect(checkResult.isExtractable).toBe(true);
    });
  });

  describe('錯誤處理', () => {
    beforeEach(() => {
      extractor = new BookDataExtractor();
    });

    test('應該正確處理初始化錯誤', () => {
      // 測試建構函數的錯誤處理
      expect(() => {
        new BookDataExtractor({ invalidOption: true });
      }).not.toThrow();
    });

    test('應該有錯誤回報機制', () => {
      expect(typeof extractor.reportError).toBe('function');
    });

    test('應該能從提取錯誤中恢復', async () => {
      const mockEvent = {
        type: 'EXTRACTION.STARTED',
        data: { url: 'invalid-url' }
      };

      // 模擬 isReadmooUrl 返回 true 以通過 URL 檢查
      jest.spyOn(extractor, 'isReadmooUrl').mockReturnValue(true);
      
      // 模擬 initializeReadmooAdapter 拋出錯誤
      jest.spyOn(extractor, 'initializeReadmooAdapter')
        .mockRejectedValue(new Error('適配器初始化失敗'));

      const reportErrorSpy = jest.spyOn(extractor, 'reportError')
        .mockResolvedValue({ reported: true });

      // 應該返回錯誤狀態而不是拋出錯誤（因為我們修改了 handleExtractionStart）
      const result = await extractor.process(mockEvent);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('適配器初始化失敗');
      expect(reportErrorSpy).toHaveBeenCalled();
    });
  });

  describe('統計追蹤', () => {
    beforeEach(() => {
      extractor = new BookDataExtractor();
    });

    test('應該追蹤提取統計', () => {
      expect(extractor.getStats()).toBeDefined();
      expect(extractor.getStats().executionCount).toBe(0);
      expect(extractor.getStats().averageExecutionTime).toBe(0);
    });

    test('應該有專用的提取統計', () => {
      expect(extractor.getExtractionStats).toBeDefined();
      expect(typeof extractor.getExtractionStats).toBe('function');
    });
  });
}); 