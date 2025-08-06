/**
 * BookSearchFilter 單元測試 - TDD循環 #28
 * 
 * 測試範圍：
 * - 書籍搜尋功能
 * - 多條件篩選功能  
 * - 排序功能
 * - 搜尋結果管理
 * - 效能優化機制
 * 
 * 功能目標：
 * - 支援書名、作者、出版社搜尋
 * - 多重篩選條件組合
 * - 動態排序（書名、作者、出版日期、進度）
 * - 搜尋歷史記錄
 * - 即時搜尋建議
 * 
 * @version 1.0.0
 * @since 2025-08-06
 */

// 設置測試環境
global.window = {};

const BookSearchFilter = require('../../../src/search/book-search-filter');

describe('🔍 BookSearchFilter 書籍搜尋篩選器測試 (TDD循環 #28)', () => {
  let searchFilter;
  let mockBooks;

  beforeEach(() => {
    // 準備測試資料
    mockBooks = [
      {
        id: '1',
        title: 'JavaScript 高級程式設計',
        author: '張三',
        publisher: '電腦人出版社',
        publishDate: '2023-01-15',
        category: '程式設計',
        progress: 45,
        status: '閱讀中',
        isbn: '9789861234567',
        rating: 4.5,
        tags: ['前端', 'JavaScript', '程式設計']
      },
      {
        id: '2', 
        title: 'Python 機器學習',
        author: '李四',
        publisher: '科技出版社',
        publishDate: '2023-03-20',
        category: '機器學習',
        progress: 78,
        status: '已完成',
        isbn: '9789861234568',
        rating: 4.8,
        tags: ['Python', '機器學習', 'AI']
      },
      {
        id: '3',
        title: 'Web 前端開發實戰',
        author: '王五',
        publisher: '電腦人出版社',
        publishDate: '2022-11-10',
        category: '程式設計',
        progress: 20,
        status: '閱讀中',
        isbn: '9789861234569',
        rating: 4.2,
        tags: ['前端', 'HTML', 'CSS', 'JavaScript']
      },
      {
        id: '4',
        title: '深度學習基礎',
        author: '趙六',
        publisher: '學術出版社',
        publishDate: '2023-05-08',
        category: '人工智慧',
        progress: 0,
        status: '未開始',
        isbn: '9789861234570',
        rating: 4.6,
        tags: ['深度學習', 'AI', '神經網路']
      }
    ];

    // 清理所有模擬
    jest.clearAllMocks();
  });

  describe('🔴 Red Phase: 基本結構和初始化', () => {
    test('應該能創建 BookSearchFilter 實例', () => {
      expect(() => {
        searchFilter = new BookSearchFilter(mockBooks);
      }).not.toThrow();
      
      expect(searchFilter).toBeDefined();
      expect(searchFilter).toBeInstanceOf(BookSearchFilter);
    });

    test('應該能正確初始化搜尋配置', () => {
      const options = {
        caseSensitive: false,
        fuzzySearch: true,
        maxResults: 50,
        searchFields: ['title', 'author']
      };

      searchFilter = new BookSearchFilter(mockBooks, options);
      
      expect(searchFilter.config.caseSensitive).toBe(false);
      expect(searchFilter.config.fuzzySearch).toBe(true);
      expect(searchFilter.config.maxResults).toBe(50);
      expect(searchFilter.config.searchFields).toEqual(['title', 'author']);
    });

    test('應該設定預設配置值', () => {
      searchFilter = new BookSearchFilter(mockBooks);
      
      expect(searchFilter.config.caseSensitive).toBeDefined();
      expect(searchFilter.config.fuzzySearch).toBeDefined();
      expect(searchFilter.config.maxResults).toBeDefined();
      expect(searchFilter.config.searchFields).toBeDefined();
    });

    test('應該正確初始化搜尋狀態', () => {
      searchFilter = new BookSearchFilter(mockBooks);
      
      expect(searchFilter.originalBooks).toEqual(mockBooks);
      expect(searchFilter.filteredBooks).toEqual(mockBooks);
      expect(searchFilter.searchHistory).toEqual([]);
      expect(searchFilter.currentQuery).toBe('');
    });
  });

  describe('🔴 Red Phase: 基本搜尋功能', () => {
    beforeEach(() => {
      searchFilter = new BookSearchFilter(mockBooks);
    });

    test('應該能根據書名搜尋', () => {
      const results = searchFilter.searchByTitle('JavaScript');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // 檢查結果是否包含預期的書籍
      const hasJavaScriptBook = results.some(book => 
        book.title.includes('JavaScript')
      );
      expect(hasJavaScriptBook).toBe(true);
    });

    test('應該能根據作者搜尋', () => {
      const results = searchFilter.searchByAuthor('張三');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // 檢查結果是否包含預期的作者
      const hasAuthor = results.some(book => 
        book.author.includes('張三')
      );
      expect(hasAuthor).toBe(true);
    });

    test('應該能根據出版社搜尋', () => {
      const results = searchFilter.searchByPublisher('電腦人出版社');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // 檢查結果是否包含預期的出版社
      const hasPublisher = results.some(book => 
        book.publisher.includes('電腦人出版社')
      );
      expect(hasPublisher).toBe(true);
    });

    test('應該能進行通用搜尋', () => {
      const results = searchFilter.search('程式設計');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // 通用搜尋應該在多個欄位中尋找
      const hasMatch = results.some(book => 
        book.title.includes('程式設計') ||
        book.category.includes('程式設計') ||
        book.tags.some(tag => tag.includes('程式設計'))
      );
      expect(hasMatch).toBe(true);
    });

    test('應該能處理空搜尋查詢', () => {
      const results = searchFilter.search('');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results).toEqual(mockBooks);
    });

    test('應該能處理無結果的搜尋', () => {
      const results = searchFilter.search('不存在的書籍');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('🔴 Red Phase: 篩選功能', () => {
    beforeEach(() => {
      searchFilter = new BookSearchFilter(mockBooks);
    });

    test('應該能根據分類篩選', () => {
      const results = searchFilter.filterByCategory('程式設計');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // 檢查所有結果都屬於指定分類
      const allMatch = results.every(book => 
        book.category === '程式設計'
      );
      expect(allMatch).toBe(true);
    });

    test('應該能根據閱讀狀態篩選', () => {
      const results = searchFilter.filterByStatus('閱讀中');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // 檢查所有結果都是指定狀態
      const allMatch = results.every(book => 
        book.status === '閱讀中'
      );
      expect(allMatch).toBe(true);
    });

    test('應該能根據進度範圍篩選', () => {
      const results = searchFilter.filterByProgressRange(50, 100);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // 檢查所有結果都在指定進度範圍內
      const allInRange = results.every(book => 
        book.progress >= 50 && book.progress <= 100
      );
      expect(allInRange).toBe(true);
    });

    test('應該能根據出版日期範圍篩選', () => {
      const startDate = '2023-01-01';
      const endDate = '2023-12-31';
      
      const results = searchFilter.filterByDateRange(startDate, endDate);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // 檢查所有結果都在指定日期範圍內
      const allInRange = results.every(book => {
        const bookDate = new Date(book.publishDate);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return bookDate >= start && bookDate <= end;
      });
      expect(allInRange).toBe(true);
    });

    test('應該能根據標籤篩選', () => {
      const results = searchFilter.filterByTags(['JavaScript']);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // 檢查所有結果都包含指定標籤
      const allHaveTag = results.every(book => 
        book.tags.includes('JavaScript')
      );
      expect(allHaveTag).toBe(true);
    });

    test('應該能組合多個篩選條件', () => {
      const filters = {
        category: '程式設計',
        status: '閱讀中',
        progressMin: 0,
        progressMax: 50
      };
      
      const results = searchFilter.applyFilters(filters);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // 檢查結果符合所有篩選條件
      if (results.length > 0) {
        const allMatch = results.every(book => 
          book.category === filters.category &&
          book.status === filters.status &&
          book.progress >= filters.progressMin &&
          book.progress <= filters.progressMax
        );
        expect(allMatch).toBe(true);
      }
    });
  });

  describe('🔴 Red Phase: 排序功能', () => {
    beforeEach(() => {
      searchFilter = new BookSearchFilter(mockBooks);
    });

    test('應該能根據書名排序', () => {
      const results = searchFilter.sortBy('title', 'asc');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(mockBooks.length);
      
      // 檢查排序是否正確
      for (let i = 1; i < results.length; i++) {
        expect(results[i].title >= results[i-1].title).toBe(true);
      }
    });

    test('應該能根據作者排序', () => {
      const results = searchFilter.sortBy('author', 'desc');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(mockBooks.length);
      
      // 檢查降序排序是否正確
      for (let i = 1; i < results.length; i++) {
        expect(results[i].author <= results[i-1].author).toBe(true);
      }
    });

    test('應該能根據出版日期排序', () => {
      const results = searchFilter.sortBy('publishDate', 'desc');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(mockBooks.length);
      
      // 檢查日期降序排序是否正確
      for (let i = 1; i < results.length; i++) {
        const currentDate = new Date(results[i].publishDate);
        const prevDate = new Date(results[i-1].publishDate);
        expect(currentDate <= prevDate).toBe(true);
      }
    });

    test('應該能根據進度排序', () => {
      const results = searchFilter.sortBy('progress', 'asc');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(mockBooks.length);
      
      // 檢查進度升序排序是否正確
      for (let i = 1; i < results.length; i++) {
        expect(results[i].progress >= results[i-1].progress).toBe(true);
      }
    });

    test('應該能根據評分排序', () => {
      const results = searchFilter.sortBy('rating', 'desc');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(mockBooks.length);
      
      // 檢查評分降序排序是否正確
      for (let i = 1; i < results.length; i++) {
        expect(results[i].rating <= results[i-1].rating).toBe(true);
      }
    });
  });

  describe('🔴 Red Phase: 搜尋歷史和建議', () => {
    beforeEach(() => {
      searchFilter = new BookSearchFilter(mockBooks);
    });

    test('應該能記錄搜尋歷史', () => {
      searchFilter.search('JavaScript');
      searchFilter.search('Python');
      
      const history = searchFilter.getSearchHistory();
      
      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(2);
      expect(history).toContain('JavaScript');
      expect(history).toContain('Python');
    });

    test('應該能清除搜尋歷史', () => {
      searchFilter.search('JavaScript');
      searchFilter.search('Python');
      
      searchFilter.clearSearchHistory();
      
      const history = searchFilter.getSearchHistory();
      expect(history.length).toBe(0);
    });

    test('應該能提供搜尋建議', () => {
      const suggestions = searchFilter.getSuggestions('Java');
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      
      // 建議應該包含相關的搜尋詞
      const hasRelevant = suggestions.some(suggestion => 
        suggestion.toLowerCase().includes('java')
      );
      expect(hasRelevant).toBe(true);
    });

    test('應該能根據輸入提供即時建議', () => {
      const suggestions = searchFilter.getInstantSuggestions('程式');
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      
      // 建議應該基於現有書籍內容
      if (suggestions.length > 0) {
        const hasRelevant = suggestions.every(suggestion => 
          typeof suggestion === 'string' && suggestion.length > 0
        );
        expect(hasRelevant).toBe(true);
      }
    });
  });

  describe('🔴 Red Phase: 進階搜尋功能', () => {
    beforeEach(() => {
      searchFilter = new BookSearchFilter(mockBooks, {
        fuzzySearch: true,
        caseSensitive: false
      });
    });

    test('應該支援模糊搜尋', () => {
      const results = searchFilter.fuzzySearch('Javscript'); // 故意打錯字
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // 模糊搜尋應該能找到相似的結果
      const hasRelevant = results.some(book => 
        book.title.toLowerCase().includes('javascript')
      );
      expect(hasRelevant).toBe(true);
    });

    test('應該支援正則表達式搜尋', () => {
      const results = searchFilter.regexSearch(/^Java/i);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // 應該找到以 Java 開頭的內容
      if (results.length > 0) {
        const hasMatch = results.some(book => 
          /^Java/i.test(book.title) || 
          book.tags.some(tag => /^Java/i.test(tag))
        );
        expect(hasMatch).toBe(true);
      }
    });

    test('應該支援多關鍵字搜尋', () => {
      const results = searchFilter.multiKeywordSearch(['JavaScript', '程式設計']);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // 結果應該包含至少一個關鍵字
      if (results.length > 0) {
        const hasMatch = results.every(book => 
          book.title.includes('JavaScript') || 
          book.title.includes('程式設計') ||
          book.category.includes('程式設計') ||
          book.tags.includes('JavaScript')
        );
        expect(hasMatch).toBe(true);
      }
    });
  });

  describe('🔴 Red Phase: 效能優化和統計', () => {
    beforeEach(() => {
      searchFilter = new BookSearchFilter(mockBooks);
    });

    test('應該追蹤搜尋效能統計', () => {
      searchFilter.search('JavaScript');
      
      const stats = searchFilter.getPerformanceStats();
      
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('searchCount');
      expect(stats).toHaveProperty('averageSearchTime');
      expect(stats).toHaveProperty('totalResultsReturned');
      expect(stats.searchCount).toBeGreaterThan(0);
    });

    test('應該支援搜尋結果快取', () => {
      // 第一次搜尋
      const startTime1 = performance.now();
      const results1 = searchFilter.search('JavaScript');
      const endTime1 = performance.now();
      const firstSearchTime = endTime1 - startTime1;
      
      // 第二次相同搜尋（應該使用快取）
      const startTime2 = performance.now();
      const results2 = searchFilter.search('JavaScript');
      const endTime2 = performance.now();
      const secondSearchTime = endTime2 - startTime2;
      
      expect(results1).toEqual(results2);
      
      // 第二次搜尋應該更快（使用快取）
      expect(secondSearchTime).toBeLessThanOrEqual(firstSearchTime);
    });

    test('應該能處理大量資料的搜尋', () => {
      // 創建大量測試資料
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `book_${i}`,
        title: `Test Book ${i}`,
        author: `Author ${i % 10}`,
        category: `Category ${i % 5}`,
        publishDate: `2023-${String((i % 12) + 1).padStart(2, '0')}-01`,
        progress: i % 101,
        status: ['未開始', '閱讀中', '已完成'][i % 3],
        tags: [`tag${i % 20}`, `tag${(i + 1) % 20}`]
      }));
      
      const largeSearchFilter = new BookSearchFilter(largeDataset);
      
      const startTime = performance.now();
      const results = largeSearchFilter.search('Book');
      const endTime = performance.now();
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // 搜尋應該在合理時間內完成（1秒內）
      expect(endTime - startTime).toBeLessThan(1000);
    });

    test('應該能清除搜尋快取', () => {
      searchFilter.search('JavaScript');
      searchFilter.clearCache();
      
      // 清除快取後，相同搜尋應該重新執行
      const results = searchFilter.search('JavaScript');
      expect(results).toBeDefined();
    });
  });

  describe('🔴 Red Phase: 錯誤處理和邊界情況', () => {
    test('應該處理空的書籍陣列', () => {
      expect(() => {
        searchFilter = new BookSearchFilter([]);
      }).not.toThrow();
      
      const results = searchFilter.search('test');
      expect(results).toEqual([]);
    });

    test('應該處理無效的搜尋參數', () => {
      searchFilter = new BookSearchFilter(mockBooks);
      
      expect(() => {
        searchFilter.search(null);
      }).not.toThrow();
      
      expect(() => {
        searchFilter.search(undefined);
      }).not.toThrow();
      
      expect(() => {
        searchFilter.search(123);
      }).not.toThrow();
    });

    test('應該處理無效的排序參數', () => {
      searchFilter = new BookSearchFilter(mockBooks);
      
      expect(() => {
        searchFilter.sortBy('invalidField', 'asc');
      }).not.toThrow();
      
      expect(() => {
        searchFilter.sortBy('title', 'invalidDirection');
      }).not.toThrow();
    });

    test('應該處理書籍資料缺失的情況', () => {
      const incompleteBook = {
        id: '999',
        title: 'Incomplete Book'
        // 缺少其他必要欄位
      };
      
      const incompleteBooks = [...mockBooks, incompleteBook];
      searchFilter = new BookSearchFilter(incompleteBooks);
      
      expect(() => {
        searchFilter.search('Incomplete');
      }).not.toThrow();
      
      expect(() => {
        searchFilter.sortBy('author', 'asc');
      }).not.toThrow();
    });
  });
});