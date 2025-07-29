/**
 * ReadmooDataValidator 測試套件
 * 
 * 負責功能：
 * - 驗證 Readmoo 書籍資料的完整性和格式
 * - 實施 Readmoo 特定的驗證規則
 * - 清理和標準化資料格式
 * - 提供詳細的驗證報告和錯誤統計
 * - 支援批量驗證和效能優化
 * 
 * 設計考量：
 * - 專注於 Readmoo 平台的資料驗證需求
 * - 提供靈活的驗證規則配置
 * - 支援部分失敗的容錯處理
 * - 為未來多書城擴展預留介面
 * 
 * 處理流程：
 * 1. 接收 ReadmooAdapter 提取的原始資料
 * 2. 執行基礎格式和必填欄位驗證
 * 3. 應用 Readmoo 特定的驗證規則
 * 4. 進行資料清理和標準化處理
 * 5. 生成詳細的驗證報告
 * 6. 返回驗證結果和清理後的資料
 * 
 * 使用情境：
 * - BookDataExtractor 中驗證提取的書籍資料
 * - 確保資料品質符合系統要求
 * - 生成資料品質報告供分析
 */

const ReadmooDataValidator = jest.fn();

describe('ReadmooDataValidator', () => {
  let validator;
  let sampleValidBook;
  let sampleInvalidBook;
  let sampleBookSet;

  beforeEach(() => {
    // 動態載入以避免模組依賴問題
    try {
      const ValidatorClass = require('@/extractors/readmoo-data-validator');
      ReadmooDataValidator.mockImplementation(() => new ValidatorClass());
      validator = new ReadmooDataValidator();
    } catch (error) {
      // 紅燈階段：檔案尚未存在
    }

    // 測試資料設定
    sampleValidBook = {
      id: 'RM12345',
      title: '測試書籍標題',
      cover: 'https://cdn.readmoo.com/covers/12345.jpg',
      progress: 75,
      type: '流式',
      url: 'https://store.readmoo.com/api/reader/12345',
      extractedAt: '2025-01-29T10:00:00.000Z'
    };

    sampleInvalidBook = {
      id: '', // 無效 ID
      title: '', // 空標題
      cover: 'invalid-url', // 無效 URL
      progress: 150, // 超出範圍
      type: '未知類型', // 無效類型
      url: 'not-a-url'
    };

    sampleBookSet = [
      sampleValidBook,
      {
        id: 'RM67890',
        title: '另一本測試書籍',
        cover: 'https://cdn.readmoo.com/covers/67890.jpg',
        progress: 100,
        type: '版式'
      },
      sampleInvalidBook
    ];
  });

  afterEach(() => {
    if (validator && validator.destroy) {
      validator.destroy();
    }
    jest.clearAllMocks();
  });

  describe('驗證器基本結構和初始化 (Cycle #9)', () => {
    test('應該能創建 ReadmooDataValidator 實例', () => {
      expect(ReadmooDataValidator).toBeDefined();
      expect(validator).toBeDefined();
      expect(typeof validator.validateBook).toBe('function');
    });

    test('應該正確初始化驗證器設定', () => {
      expect(validator.validationRules).toBeDefined();
      expect(validator.validationStats).toBeDefined();
      expect(validator.validationStats.totalValidated).toBe(0);
      expect(validator.validationStats.successfulValidations).toBe(0);
      expect(validator.validationStats.failedValidations).toBe(0);
    });

    test('應該支援 Readmoo 特定驗證規則', () => {
      const supportedRules = validator.getSupportedValidationRules();
      expect(supportedRules).toContain('readmoo-id-format');
      expect(supportedRules).toContain('readmoo-progress-range');
      expect(supportedRules).toContain('readmoo-book-type');
      expect(supportedRules).toContain('readmoo-cover-url');
    });

    test('應該正確設定 Readmoo 特定的驗證配置', () => {
      expect(validator.config.platform).toBe('readmoo');
      expect(validator.config.strictMode).toBe(true);
      expect(validator.config.enableDataCleaning).toBe(true);
      expect(validator.config.maxValidationErrors).toBeGreaterThan(0);
    });
  });

  describe('基礎資料格式驗證 (Cycle #9)', () => {
    test('應該驗證有效的書籍資料', async () => {
      const result = await validator.validateBook(sampleValidBook);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.cleanedData).toBeDefined();
      expect(result.cleanedData.id).toBe(sampleValidBook.id);
    });

    test('應該檢測必填欄位缺失', async () => {
      const bookWithMissingFields = {
        title: '測試書籍'
        // 缺少 id, cover 等必填欄位
      };

      const result = await validator.validateBook(bookWithMissingFields);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'id',
          code: 'FIELD_REQUIRED',
          message: expect.stringContaining('ID is required')
        })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'cover',
          code: 'FIELD_REQUIRED'
        })
      );
    });

    test('應該驗證資料類型正確性', async () => {
      const bookWithWrongTypes = {
        id: 12345, // 應該是字串
        title: null, // 應該是字串
        progress: '75%', // 應該是數字
        type: ['流式'] // 應該是字串
      };

      const result = await validator.validateBook(bookWithWrongTypes);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'id',
          code: 'INVALID_TYPE',
          message: expect.stringContaining('must be a string')
        })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'progress',
          code: 'INVALID_TYPE'
        })
      );
    });

    test('應該驗證欄位長度限制', async () => {
      const bookWithLongFields = {
        id: 'RM' + 'x'.repeat(100), // 超長 ID
        title: 'x'.repeat(1000), // 超長標題
        cover: 'https://example.com/' + 'x'.repeat(2000) // 超長 URL
      };

      const result = await validator.validateBook(bookWithLongFields);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => 
        error.code === 'FIELD_TOO_LONG' && error.field === 'title'
      )).toBe(true);
    });
  });

  describe('Readmoo 特定驗證規則 (Cycle #9)', () => {
    test('應該驗證 Readmoo ID 格式', async () => {
      const testCases = [
        { id: 'RM12345', valid: true },
        { id: 'readmoo_67890', valid: true },
        { id: '12345', valid: false }, // 缺少前綴
        { id: 'BK12345', valid: false }, // 錯誤前綴
        { id: 'RM', valid: false }, // 缺少數字
        { id: '', valid: false }
      ];

      for (const testCase of testCases) {
        const book = { ...sampleValidBook, id: testCase.id };
        const result = await validator.validateBook(book);

        if (testCase.valid) {
          expect(result.errors.find(e => e.field === 'id')).toBeUndefined();
        } else {
          expect(result.errors).toContainEqual(
            expect.objectContaining({
              field: 'id',
              code: 'READMOO_INVALID_ID_FORMAT'
            })
          );
        }
      }
    });

    test('應該驗證閱讀進度範圍', async () => {
      const testCases = [
        { progress: 0, valid: true },
        { progress: 50, valid: true },
        { progress: 100, valid: true },
        { progress: -1, valid: false },
        { progress: 101, valid: false },
        { progress: null, valid: true }, // 允許空值
        { progress: undefined, valid: true }
      ];

      for (const testCase of testCases) {
        const book = { ...sampleValidBook, progress: testCase.progress };
        const result = await validator.validateBook(book);

        if (testCase.valid) {
          expect(result.errors.find(e => e.field === 'progress')).toBeUndefined();
        } else {
          expect(result.errors).toContainEqual(
            expect.objectContaining({
              field: 'progress',
              code: 'READMOO_INVALID_PROGRESS_RANGE'
            })
          );
        }
      }
    });

    test('應該驗證書籍類型', async () => {
      const validTypes = ['流式', '版式', 'epub', 'pdf'];
      const invalidTypes = ['未知', '圖書', 'unknown', ''];

      for (const type of validTypes) {
        const book = { ...sampleValidBook, type };
        const result = await validator.validateBook(book);
        expect(result.errors.find(e => e.field === 'type')).toBeUndefined();
      }

      for (const type of invalidTypes) {
        const book = { ...sampleValidBook, type };
        const result = await validator.validateBook(book);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'type',
            code: 'READMOO_INVALID_BOOK_TYPE'
          })
        );
      }
    });

    test('應該驗證封面 URL 格式', async () => {
      const testCases = [
        { cover: 'https://cdn.readmoo.com/covers/12345.jpg', valid: true },
        { cover: 'https://images.readmoo.com/book/67890.png', valid: true },
        { cover: 'http://example.com/image.jpg', valid: false }, // 非 HTTPS
        { cover: 'https://other-site.com/image.jpg', valid: false }, // 非 Readmoo 域名
        { cover: 'not-a-url', valid: false },
        { cover: '', valid: false }
      ];

      for (const testCase of testCases) {
        const book = { ...sampleValidBook, cover: testCase.cover };
        const result = await validator.validateBook(book);

        if (testCase.valid) {
          expect(result.errors.find(e => e.field === 'cover')).toBeUndefined();
        } else {
          expect(result.errors).toContainEqual(
            expect.objectContaining({
              field: 'cover',
              code: 'READMOO_INVALID_COVER_URL'
            })
          );
        }
      }
    });
  });

  describe('資料清理和標準化 (Cycle #9)', () => {
    test('應該清理 HTML 標籤', async () => {
      const bookWithHTML = {
        ...sampleValidBook,
        title: '<h1>測試書籍</h1><script>alert("xss")</script>',
        description: '<p>這是一本<strong>測試</strong>書籍</p>'
      };

      const result = await validator.validateBook(bookWithHTML);

      expect(result.cleanedData.title).toBe('測試書籍');
      expect(result.cleanedData.description).toBe('這是一本測試書籍');
    });

    test('應該標準化書籍類型', async () => {
      const testCases = [
        { input: '流式', expected: '流式' },
        { input: 'epub', expected: '流式' },
        { input: '版式', expected: '版式' },
        { input: 'pdf', expected: '版式' },
        { input: 'EPUB', expected: '流式' },
        { input: 'PDF', expected: '版式' }
      ];

      for (const testCase of testCases) {
        const book = { ...sampleValidBook, type: testCase.input };
        const result = await validator.validateBook(book);

        expect(result.cleanedData.type).toBe(testCase.expected);
      }
    });

    test('應該標準化進度格式', async () => {
      const testCases = [
        { input: 75.5, expected: 76 }, // 四捨五入
        { input: 0.0, expected: 0 },
        { input: 99.9, expected: 100 },
        { input: null, expected: 0 },
        { input: undefined, expected: 0 }
      ];

      for (const testCase of testCases) {
        const book = { ...sampleValidBook, progress: testCase.input };
        const result = await validator.validateBook(book);

        expect(result.cleanedData.progress).toBe(testCase.expected);
      }
    });

    test('應該清理和標準化 URL', async () => {
      const testCases = [
        {
          input: 'https://store.readmoo.com/api/reader/12345?utm_source=test',
          expected: 'https://store.readmoo.com/api/reader/12345'
        },
        {
          input: 'HTTPS://Store.READMOO.com/api/reader/12345',
          expected: 'https://store.readmoo.com/api/reader/12345'
        }
      ];

      for (const testCase of testCases) {
        const book = { ...sampleValidBook, url: testCase.input };
        const result = await validator.validateBook(book);

        expect(result.cleanedData.url).toBe(testCase.expected);
      }
    });

    test('應該移除多餘的空白字元', async () => {
      const bookWithWhitespace = {
        ...sampleValidBook,
        title: '  測試書籍標題  \n\t  ',
        author: '\n  作者姓名  \t',
        publisher: '  出版社  '
      };

      const result = await validator.validateBook(bookWithWhitespace);

      expect(result.cleanedData.title).toBe('測試書籍標題');
      expect(result.cleanedData.author).toBe('作者姓名');
      expect(result.cleanedData.publisher).toBe('出版社');
    });
  });

  describe('批量驗證功能 (Cycle #9)', () => {
    test('應該能批量驗證多本書籍', async () => {
      const result = await validator.validateBooks(sampleBookSet);

      expect(result.totalBooks).toBe(3);
      expect(result.validBooks).toBe(2);
      expect(result.invalidBooks).toBe(1);
      expect(result.validatedBooks).toHaveLength(3);
      expect(result.cleanedBooks).toHaveLength(2); // 只返回有效書籍
    });

    test('應該提供批量驗證的詳細報告', async () => {
      const result = await validator.validateBooks(sampleBookSet);

      expect(result.summary.totalValidated).toBe(3);
      expect(result.summary.successRate).toBeCloseTo(66.67, 2);
      expect(result.summary.errorBreakdown).toBeDefined();
      expect(result.summary.processingTime).toBeGreaterThan(0);
    });

    test('應該在批量驗證中隔離錯誤', async () => {
      const booksWithErrors = [
        sampleValidBook,
        null, // 無效輸入
        sampleInvalidBook,
        undefined, // 無效輸入
        { ...sampleValidBook, id: 'RM99999' }
      ];

      const result = await validator.validateBooks(booksWithErrors);

      expect(result.totalBooks).toBe(5);
      expect(result.validBooks).toBe(2); // 只有兩本有效
      expect(result.processingErrors).toBe(2); // 兩個處理錯誤
    });

    test('應該支援批量驗證的效能優化', async () => {
      const largeBooksSet = Array.from({ length: 100 }, (_, i) => ({
        ...sampleValidBook,
        id: `RM${10000 + i}`,
        title: `測試書籍 ${i + 1}`
      }));

      const startTime = performance.now();
      const result = await validator.validateBooks(largeBooksSet);
      const processingTime = performance.now() - startTime;

      expect(result.validBooks).toBe(100);
      expect(processingTime).toBeLessThan(1000); // 應該在1秒內完成
    });
  });

  describe('驗證報告和統計 (Cycle #9)', () => {
    test('應該生成詳細的驗證報告', async () => {
      await validator.validateBook(sampleValidBook);
      await validator.validateBook(sampleInvalidBook);

      const report = validator.getValidationReport();

      expect(report.totalValidations).toBe(2);
      expect(report.successfulValidations).toBe(1);
      expect(report.failedValidations).toBe(1);
      expect(report.successRate).toBe(50);
      expect(report.commonErrors).toBeDefined();
      expect(report.averageProcessingTime).toBeGreaterThan(0);
    });

    test('應該追蹤最常見的驗證錯誤', async () => {
      const invalidBooks = [
        { ...sampleInvalidBook, id: '' },
        { ...sampleInvalidBook, id: '', title: '' },
        { ...sampleInvalidBook, id: '', progress: 150 }
      ];

      for (const book of invalidBooks) {
        await validator.validateBook(book);
      }

      const report = validator.getValidationReport();
      const commonErrors = report.commonErrors;

      expect(commonErrors['READMOO_INVALID_ID_FORMAT']).toBeGreaterThan(0);
      expect(commonErrors['FIELD_REQUIRED']).toBeGreaterThan(0);
    });

    test('應該提供驗證統計的時間序列', async () => {
      await validator.validateBook(sampleValidBook);
      await new Promise(resolve => setTimeout(resolve, 10)); // 小延遲
      await validator.validateBook(sampleInvalidBook);

      const timeSeriesData = validator.getValidationTimeSeries();

      expect(timeSeriesData).toHaveLength(2);
      expect(timeSeriesData[0].timestamp).toBeLessThan(timeSeriesData[1].timestamp);
      expect(timeSeriesData[0].isValid).toBe(true);
      expect(timeSeriesData[1].isValid).toBe(false);
    });

    test('應該支援驗證報告的匯出功能', async () => {
      await validator.validateBooks(sampleBookSet);

      const csvReport = validator.exportReportAsCSV();
      const jsonReport = validator.exportReportAsJSON();

      expect(csvReport).toContain('Book ID,Valid,Errors,Processing Time');
      expect(jsonReport).toContain('"totalValidations"');
      expect(() => JSON.parse(jsonReport)).not.toThrow();
    });
  });

  describe('錯誤處理和復原機制 (Cycle #9)', () => {
    test('應該處理 null 或 undefined 輸入', async () => {
      const results = await Promise.all([
        validator.validateBook(null),
        validator.validateBook(undefined),
        validator.validateBook({})
      ]);

      results.forEach(result => {
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_INPUT'
          })
        );
      });
    });

    test('應該處理循環引用的物件', async () => {
      const circularBook = { ...sampleValidBook };
      circularBook.self = circularBook; // 循環引用

      const result = await validator.validateBook(circularBook);

      // 應該能處理而不會造成無限迴圈
      expect(result).toBeDefined();
      expect(result.processingError).toBeUndefined();
    });

    test('應該在驗證規則載入失敗時使用預設規則', async () => {
      // 模擬驗證規則載入失敗
      const originalRules = validator.validationRules;
      validator.validationRules = null;

      const result = await validator.validateBook(sampleValidBook);

      // 應該仍能進行基本驗證
      expect(result).toBeDefined();
      expect(result.usedFallbackRules).toBe(true);

      // 復原原始規則
      validator.validationRules = originalRules;
    });

    test('應該限制過度複雜的驗證請求', async () => {
      const oversizedBook = {
        ...sampleValidBook,
        metadata: 'x'.repeat(10000000) // 10MB 字串
      };

      const result = await validator.validateBook(oversizedBook);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INPUT_TOO_LARGE'
        })
      );
    });
  });

  describe('效能優化和記憶體管理 (Cycle #9)', () => {
    test('應該快取常用的驗證規則', async () => {
      const startTime = performance.now();

      // 第一次驗證 (建立快取)
      await validator.validateBook(sampleValidBook);
      const firstRunTime = performance.now() - startTime;

      const secondStartTime = performance.now();

      // 第二次驗證 (使用快取)
      await validator.validateBook(sampleValidBook);
      const secondRunTime = performance.now() - secondStartTime;

      // 第二次應該更快 (至少快 20%)
      expect(secondRunTime).toBeLessThan(firstRunTime * 0.8);
    });

    test('應該自動清理過期的驗證快取', async () => {
      // 設定短暫的快取時間進行測試
      validator.setCacheExpiration(50); // 50ms

      await validator.validateBook(sampleValidBook);
      expect(validator.getCacheSize()).toBeGreaterThan(0);

      // 等待快取過期
      await new Promise(resolve => setTimeout(resolve, 100));

      await validator.validateBook(sampleValidBook);
      // 快取應該已經被清理並重建
      expect(validator.getCacheHitRate()).toBeLessThan(1);
    });

    test('應該在記憶體壓力下自動清理資源', async () => {
      // 模擬記憶體壓力情況
      const largeBooksSet = Array.from({ length: 1000 }, (_, i) => ({
        ...sampleValidBook,
        id: `RM${i}`,
        largeData: 'x'.repeat(1000)
      }));

      await validator.validateBooks(largeBooksSet);

      const memoryUsage = validator.getMemoryUsage();
      expect(memoryUsage.peakUsage).toBeDefined();
      expect(memoryUsage.currentUsage).toBeLessThan(memoryUsage.peakUsage);
    });

    test('應該支援驗證器實例的正確銷毀', () => {
      const initialCacheSize = validator.getCacheSize();
      const initialMemoryUsage = validator.getMemoryUsage().currentUsage;

      validator.destroy();

      // 銷毀後快取和記憶體應該被清理
      expect(validator.getCacheSize()).toBe(0);
      expect(validator.validationStats.totalValidated).toBe(0);
    });
  });

  describe('配置和擴展性 (Cycle #9)', () => {
    test('應該支援自訂驗證規則', async () => {
      const customRule = {
        name: 'custom-title-length',
        validate: (book) => book.title && book.title.length >= 3,
        errorCode: 'CUSTOM_TITLE_TOO_SHORT',
        errorMessage: 'Title must be at least 3 characters'
      };

      validator.addCustomValidationRule(customRule);

      const shortTitleBook = { ...sampleValidBook, title: 'AB' };
      const result = await validator.validateBook(shortTitleBook);

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'CUSTOM_TITLE_TOO_SHORT'
        })
      );
    });

    test('應該支援驗證規則的啟用/停用', async () => {
      // 停用 ID 格式驗證
      validator.disableValidationRule('readmoo-id-format');

      const result = await validator.validateBook({
        ...sampleValidBook,
        id: 'invalid-id-format'
      });

      expect(result.errors.find(e => e.code === 'READMOO_INVALID_ID_FORMAT'))
        .toBeUndefined();

      // 重新啟用
      validator.enableValidationRule('readmoo-id-format');
    });

    test('應該支援不同的驗證嚴格度模式', async () => {
      const testBook = {
        id: 'RM12345',
        title: 'Test Book'
        // 缺少一些非必填欄位
      };

      // 嚴格模式
      validator.setValidationMode('strict');
      const strictResult = await validator.validateBook(testBook);

      // 寬鬆模式
      validator.setValidationMode('lenient');
      const lenientResult = await validator.validateBook(testBook);

      expect(strictResult.errors.length).toBeGreaterThan(lenientResult.errors.length);
    });

    test('應該為未來多書城支援預留介面', () => {
      // 檢查是否有預留的多書城介面
      expect(validator.getSupportedPlatforms).toBeDefined();
      expect(validator.setPlatformRules).toBeDefined();
      expect(validator.addPlatformValidator).toBeDefined();

      const platforms = validator.getSupportedPlatforms();
      expect(platforms).toContain('readmoo');
    });
  });
}); 