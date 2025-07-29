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