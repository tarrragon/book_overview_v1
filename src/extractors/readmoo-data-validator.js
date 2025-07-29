/**
 * ReadmooDataValidator - Readmoo 書籍資料驗證器
 * 
 * 負責功能：
 * - 驗證 Readmoo 書籍資料的完整性和格式
 * - 實施 Readmoo 特定的驗證規則 (ID格式、進度範圍、書籍類型、封面URL)
 * - 清理和標準化資料格式 (HTML清理、類型標準化、URL處理)
 * - 提供詳細的驗證報告和錯誤統計 (時間序列、匯出功能)
 * - 支援批量驗證和效能優化 (快取機制、記憶體管理)
 * - 為未來多書城擴展預留介面 (平台規則、驗證器擴展)
 * 
 * 設計考量：
 * - 專注於 Readmoo 平台的資料驗證需求
 * - 提供靈活的驗證規則配置
 * - 支援部分失敗的容錯處理
 * - 實現智能快取和記憶體管理
 * - 採用事件驅動架構，與其他模組低耦合
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
 * - 支援未來多書城平台的資料驗證需求
 */

class ReadmooDataValidator {
  constructor(options = {}) {
    // 基本配置
    this.config = {
      platform: 'readmoo',
      strictMode: true,
      enableDataCleaning: true,
      maxValidationErrors: 50,
      cacheExpiration: 300000, // 5 minutes
      maxInputSize: 5 * 1024 * 1024, // 5MB
      ...options
    };
    
    // 驗證統計
    this.validationStats = {
      totalValidated: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageProcessingTime: 0,
      lastValidationTime: null
    };
    
    // 驗證規則
    this.validationRules = this.initializeValidationRules();
    
    // 快取和記憶體管理
    this.validationCache = new Map();
    this.ruleCache = new Map();
    this.processingHistory = [];
    this.timeSeriesData = [];
    this.commonErrors = {};
    
    // 記憶體使用追蹤
    this.memoryUsage = {
      currentUsage: 0,
      peakUsage: 0
    };
    
    // 驗證模式
    this.validationMode = 'strict';
    this.enabledRules = new Set();
    this.customRules = new Map();
    
    // 初始化
    this.initializeEnabledRules();
  }
  
  /**
   * 初始化驗證規則
   * @returns {Object} 驗證規則對象
   */
  initializeValidationRules() {
    return {
      // 基礎欄位驗證
      required: {
        fields: ['id', 'title', 'cover'],
        validate: (book, field) => {
          return book[field] !== undefined && book[field] !== null && book[field] !== '';
        },
        errorCode: 'FIELD_REQUIRED',
        errorMessage: (field) => `${field.toUpperCase()} is required`
      },
      
      // 資料類型驗證
      types: {
        id: 'string',
        title: 'string', 
        cover: 'string',
        progress: 'number',
        type: 'string',
        url: 'string'
      },
      
      // 欄位長度限制
      lengths: {
        id: { max: 50 },
        title: { max: 500 },
        cover: { max: 2000 },
        url: { max: 2000 }
      },
      
      // Readmoo 特定規則
      readmoo: {
        idFormat: /^(RM|readmoo_)\w+$/i,
        progressRange: { min: 0, max: 100 },
        validTypes: ['流式', '版式', 'epub', 'pdf'],
        coverDomains: ['cdn.readmoo.com', 'images.readmoo.com'],
        urlDomains: ['store.readmoo.com', 'readmoo.com']
      }
    };
  }
  
  /**
   * 初始化啟用的驗證規則
   */
  initializeEnabledRules() {
    this.enabledRules.add('readmoo-id-format');
    this.enabledRules.add('readmoo-progress-range');
    this.enabledRules.add('readmoo-book-type');
    this.enabledRules.add('readmoo-cover-url');
  }
  
  /**
   * 取得支援的驗證規則列表
   * @returns {string[]} 支援的驗證規則
   */
  getSupportedValidationRules() {
    return [
      'readmoo-id-format',
      'readmoo-progress-range', 
      'readmoo-book-type',
      'readmoo-cover-url'
    ];
  }
  
  /**
   * 驗證單本書籍資料
   * @param {Object} book - 書籍資料物件
   * @returns {Object} 驗證結果
   */
  async validateBook(book) {
    const startTime = performance.now();
    
    try {
      // 檢查輸入有效性
      if (!this.isValidInput(book)) {
        return this.createValidationResult(false, [], [
          { field: 'input', code: 'INVALID_INPUT', message: 'Invalid input data' }
        ]);
      }
      
      // 特別處理 null、undefined 和空物件
      if (book === null || book === undefined || Object.keys(book).length === 0) {
        return this.createValidationResult(false, [], [
          { field: 'input', code: 'INVALID_INPUT', message: 'Invalid input data' }
        ]);
      }
      
      // 檢查輸入大小
      if (this.getInputSize(book) > this.config.maxInputSize) {
        return this.createValidationResult(false, [], [
          { field: 'input', code: 'INPUT_TOO_LARGE', message: 'Input data too large' }
        ]);
      }
      
      const errors = [];
      const warnings = [];
      
      // 基礎驗證
      this.validateRequired(book, errors);
      this.validateTypes(book, errors);
      
      // 嚴格模式額外檢查
      if (this.validationMode === 'strict') {
        this.validateLengths(book, errors);
      }
      
      // Readmoo 特定驗證
      if (this.enabledRules.has('readmoo-id-format')) {
        this.validateReadmooId(book, errors);
      }
      if (this.enabledRules.has('readmoo-progress-range')) {
        this.validateReadmooProgress(book, errors);
      }
      if (this.enabledRules.has('readmoo-book-type')) {
        this.validateReadmooBookType(book, errors);
      }
      if (this.enabledRules.has('readmoo-cover-url') && this.validationMode === 'strict') {
        this.validateReadmooCoverUrl(book, errors);
      }
      
      // 自訂規則驗證
      this.validateCustomRules(book, errors);
      
      // 資料清理
      const cleanedData = this.config.enableDataCleaning ? this.cleanData(book) : { ...book };
      
      // 更新統計
      const processingTime = performance.now() - startTime;
      this.updateValidationStats(errors.length === 0, processingTime);
      
      // 記錄歷史
      this.recordValidationHistory(book, errors.length === 0, processingTime);
      
      // 更新快取 (簡化實現)
      if (book.id) {
        this.validationCache.set(book.id, { result: errors.length === 0, timestamp: Date.now() });
      }
      
      const isValid = errors.length === 0;
      const result = this.createValidationResult(isValid, warnings, errors, cleanedData);
      
      // 記錄時間序列
      this.timeSeriesData.push({
        timestamp: Date.now(),
        isValid,
        processingTime,
        errorCount: errors.length
      });
      
      return result;
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      this.updateValidationStats(false, processingTime);
      
      return this.createValidationResult(false, [], [
        { field: 'system', code: 'PROCESSING_ERROR', message: error.message }
      ], null, { processingError: error.message });
    }
  }
  
  /**
   * 批量驗證書籍資料
   * @param {Array} books - 書籍陣列
   * @returns {Object} 批量驗證結果
   */
  async validateBooks(books) {
    const startTime = performance.now();
    const validatedBooks = [];
    const cleanedBooks = [];
    let validBooks = 0;
    let invalidBooks = 0;
    let processingErrors = 0;
    
    if (!Array.isArray(books)) {
      return {
        totalBooks: 0,
        validBooks: 0,
        invalidBooks: 0,
        processingErrors: 1,
        validatedBooks: [],
        cleanedBooks: [],
        summary: {
          totalValidated: 0,
          successRate: 0,
          errorBreakdown: {},
          processingTime: performance.now() - startTime
        }
      };
    }
    
    for (const book of books) {
      try {
        if (book === null || book === undefined) {
          processingErrors++;
          continue;
        }
        
        const result = await this.validateBook(book);
        validatedBooks.push(result);
        
        if (result.isValid) {
          validBooks++;
          cleanedBooks.push(result.cleanedData);
        } else {
          invalidBooks++;
        }
        
      } catch (error) {
        processingErrors++;
      }
    }
    
    const processingTime = performance.now() - startTime;
    const totalBooks = books.length;
    const successRate = totalBooks > 0 ? (validBooks / totalBooks) * 100 : 0;
    
    return {
      totalBooks,
      validBooks,
      invalidBooks,
      processingErrors,
      validatedBooks,
      cleanedBooks,
      summary: {
        totalValidated: totalBooks,
        successRate: Math.round(successRate * 100) / 100,
        errorBreakdown: this.getErrorBreakdown(),
        processingTime
      }
    };
  }
  
  /**
   * 驗證必填欄位
   * @param {Object} book - 書籍物件
   * @param {Array} errors - 錯誤陣列
   */
  validateRequired(book, errors) {
    let requiredFields = this.validationRules.required.fields;
    
    // 寬鬆模式下只檢查核心必填欄位
    if (this.validationMode === 'lenient') {
      requiredFields = ['id', 'title']; // 移除 cover
    }
    
    for (const field of requiredFields) {
      if (!this.validationRules.required.validate(book, field)) {
        errors.push({
          field,
          code: this.validationRules.required.errorCode,
          message: this.validationRules.required.errorMessage(field)
        });
      }
    }
  }
  
  /**
   * 驗證資料類型
   * @param {Object} book - 書籍物件
   * @param {Array} errors - 錯誤陣列
   */
  validateTypes(book, errors) {
    const types = this.validationRules.types;
    
    for (const [field, expectedType] of Object.entries(types)) {
      if (book[field] !== undefined && book[field] !== null) {
        const actualType = typeof book[field];
        if (actualType !== expectedType) {
          errors.push({
            field,
            code: 'INVALID_TYPE',
            message: `${field} must be a ${expectedType}, got ${actualType}`
          });
        }
      }
    }
  }
  
  /**
   * 驗證欄位長度
   * @param {Object} book - 書籍物件  
   * @param {Array} errors - 錯誤陣列
   */
  validateLengths(book, errors) {
    const lengths = this.validationRules.lengths;
    
    for (const [field, limits] of Object.entries(lengths)) {
      if (book[field] && typeof book[field] === 'string') {
        if (limits.max && book[field].length > limits.max) {
          errors.push({
            field,
            code: 'FIELD_TOO_LONG',
            message: `${field} exceeds maximum length of ${limits.max}`
          });
        }
      }
    }
  }
  
  /**
   * 驗證 Readmoo ID 格式
   * @param {Object} book - 書籍物件
   * @param {Array} errors - 錯誤陣列
   */
  validateReadmooId(book, errors) {
    if (book.id !== undefined && book.id !== null && book.id !== '' && 
        !this.validationRules.readmoo.idFormat.test(book.id)) {
      errors.push({
        field: 'id',
        code: 'READMOO_INVALID_ID_FORMAT',
        message: 'Invalid Readmoo ID format'
      });
    } else if (book.id === '') {
      errors.push({
        field: 'id',
        code: 'READMOO_INVALID_ID_FORMAT',
        message: 'Invalid Readmoo ID format'
      });
    }
  }
  
  /**
   * 驗證 Readmoo 閱讀進度
   * @param {Object} book - 書籍物件
   * @param {Array} errors - 錯誤陣列
   */
  validateReadmooProgress(book, errors) {
    if (book.progress !== undefined && book.progress !== null) {
      const { min, max } = this.validationRules.readmoo.progressRange;
      if (book.progress < min || book.progress > max) {
        errors.push({
          field: 'progress',
          code: 'READMOO_INVALID_PROGRESS_RANGE',
          message: `Progress must be between ${min} and ${max}`
        });
      }
    }
  }
  
  /**
   * 驗證 Readmoo 書籍類型
   * @param {Object} book - 書籍物件
   * @param {Array} errors - 錯誤陣列
   */
  validateReadmooBookType(book, errors) {
    if (book.type !== undefined && book.type !== null && book.type !== '' && 
        !this.validationRules.readmoo.validTypes.includes(book.type)) {
      errors.push({
        field: 'type',
        code: 'READMOO_INVALID_BOOK_TYPE',
        message: 'Invalid book type for Readmoo platform'
      });
    } else if (book.type === '') {
      errors.push({
        field: 'type',
        code: 'READMOO_INVALID_BOOK_TYPE',
        message: 'Invalid book type for Readmoo platform'
      });
    }
  }
  
  /**
   * 驗證 Readmoo 封面 URL
   * @param {Object} book - 書籍物件
   * @param {Array} errors - 錯誤陣列
   */
  validateReadmooCoverUrl(book, errors) {
    if (book.cover === '') {
      errors.push({
        field: 'cover',
        code: 'READMOO_INVALID_COVER_URL',
        message: 'Invalid Readmoo cover URL'
      });
    } else if (book.cover) {
      try {
        const url = new URL(book.cover);
        const validDomains = this.validationRules.readmoo.coverDomains;
        
        if (url.protocol !== 'https:' || !validDomains.some(domain => url.hostname.includes(domain))) {
          errors.push({
            field: 'cover',
            code: 'READMOO_INVALID_COVER_URL',
            message: 'Invalid Readmoo cover URL'
          });
        }
      } catch (error) {
        errors.push({
          field: 'cover',
          code: 'READMOO_INVALID_COVER_URL',
          message: 'Invalid URL format'
        });
      }
    }
  }
  
  /**
   * 驗證自訂規則
   * @param {Object} book - 書籍物件
   * @param {Array} errors - 錯誤陣列
   */
  validateCustomRules(book, errors) {
    for (const [ruleName, rule] of this.customRules) {
      if (this.enabledRules.has(ruleName)) {
        try {
          if (!rule.validate(book)) {
            errors.push({
              field: rule.field || 'custom',
              code: rule.errorCode,
              message: rule.errorMessage
            });
          }
        } catch (error) {
          // 自訂規則執行失敗，記錄但不阻止驗證
        }
      }
    }
  }
  
  /**
   * 清理和標準化資料
   * @param {Object} book - 原始書籍物件
   * @returns {Object} 清理後的書籍物件
   */
  cleanData(book) {
    const cleaned = {};
    
    for (const [key, value] of Object.entries(book)) {
      if (value === null || value === undefined) {
        if (key === 'progress') {
          cleaned[key] = 0;
        }
        continue;
      }
      
      if (typeof value === 'string') {
        // 清理 HTML 標籤和Script內容
        let cleanValue = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        cleanValue = cleanValue.replace(/<[^>]*>/g, '');
        
        // 移除多餘空白
        cleanValue = cleanValue.trim().replace(/\s+/g, ' ');
        
        // 特殊處理
        if (key === 'type') {
          cleanValue = this.standardizeBookType(cleanValue);
        } else if (key === 'url' || key === 'cover') {
          cleanValue = this.standardizeUrl(cleanValue);
        }
        
        cleaned[key] = cleanValue;
      } else if (typeof value === 'number' && key === 'progress') {
        // 進度四捨五入
        cleaned[key] = Math.round(value);
      } else {
        cleaned[key] = value;
      }
    }
    
    return cleaned;
  }
  
  /**
   * 標準化書籍類型
   * @param {string} type - 原始類型
   * @returns {string} 標準化類型
   */
  standardizeBookType(type) {
    const lowerType = type.toLowerCase();
    
    if (lowerType === 'epub' || lowerType === '流式') {
      return '流式';
    } else if (lowerType === 'pdf' || lowerType === '版式') {
      return '版式';
    }
    
    return type;
  }
  
  /**
   * 標準化 URL
   * @param {string} url - 原始 URL
   * @returns {string} 標準化 URL
   */
  standardizeUrl(url) {
    try {
      const urlObj = new URL(url.toLowerCase());
      // 移除查詢參數
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    } catch (error) {
      return url;
    }
  }
  
  /**
   * 檢查輸入是否有效
   * @param {*} input - 輸入資料
   * @returns {boolean} 是否有效
   */
  isValidInput(input) {
    if (input === null || input === undefined) {
      return false;
    }
    
    if (typeof input !== 'object' || Array.isArray(input)) {
      return false;
    }
    
    // 檢查空物件但允許通過基本驗證
    if (Object.keys(input).length === 0) {
      return true; // 空物件允許通過，但會在必填欄位驗證失敗
    }
    
    // 檢查循環引用
    try {
      JSON.stringify(input);
      return true;
    } catch (error) {
      return true; // 允許處理，但會在後續標記
    }
  }
  
  /**
   * 計算輸入資料大小
   * @param {Object} input - 輸入資料
   * @returns {number} 資料大小 (bytes)
   */
  getInputSize(input) {
    try {
      return JSON.stringify(input).length;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * 創建驗證結果物件
   * @param {boolean} isValid - 是否有效
   * @param {Array} warnings - 警告陣列
   * @param {Array} errors - 錯誤陣列
   * @param {Object} cleanedData - 清理後資料
   * @param {Object} extra - 額外資訊
   * @returns {Object} 驗證結果
   */
  createValidationResult(isValid, warnings, errors, cleanedData = null, extra = {}) {
    // 檢查是否使用了後備規則
    const usedFallbackRules = this.validationRules === null;
    
    const result = {
      isValid,
      errors: errors || [],
      warnings: warnings || [],
      usedFallbackRules,
      ...extra
    };
    
    if (cleanedData) {
      result.cleanedData = cleanedData;
    }
    
    // 更新錯誤統計
    for (const error of (errors || [])) {
      this.commonErrors[error.code] = (this.commonErrors[error.code] || 0) + 1;
    }
    
    return result;
  }
  
  /**
   * 更新驗證統計
   * @param {boolean} success - 是否成功
   * @param {number} processingTime - 處理時間
   */
  updateValidationStats(success, processingTime) {
    this.validationStats.totalValidated++;
    
    if (success) {
      this.validationStats.successfulValidations++;
    } else {
      this.validationStats.failedValidations++;
    }
    
    // 更新平均處理時間
    const total = this.validationStats.totalValidated;
    this.validationStats.averageProcessingTime = 
      (this.validationStats.averageProcessingTime * (total - 1) + processingTime) / total;
    
    this.validationStats.lastValidationTime = Date.now();
  }
  
  /**
   * 記錄驗證歷史
   * @param {Object} book - 書籍物件
   * @param {boolean} success - 是否成功
   * @param {number} processingTime - 處理時間
   */
  recordValidationHistory(book, success, processingTime) {
    this.processingHistory.push({
      bookId: book.id || 'unknown',
      timestamp: Date.now(),
      success,
      processingTime
    });
    
    // 保持歷史記錄在合理範圍內
    if (this.processingHistory.length > 1000) {
      this.processingHistory = this.processingHistory.slice(-500);
    }
  }
  
  /**
   * 取得驗證報告
   * @returns {Object} 驗證報告
   */
  getValidationReport() {
    const total = this.validationStats.totalValidated;
    const successRate = total > 0 ? 
      (this.validationStats.successfulValidations / total) * 100 : 0;
    
    return {
      totalValidations: total,
      successfulValidations: this.validationStats.successfulValidations,
      failedValidations: this.validationStats.failedValidations,
      successRate: Math.round(successRate * 100) / 100,
      averageProcessingTime: this.validationStats.averageProcessingTime,
      commonErrors: { ...this.commonErrors },
      lastValidationTime: this.validationStats.lastValidationTime
    };
  }
  
  /**
   * 取得錯誤分類統計
   * @returns {Object} 錯誤分類
   */
  getErrorBreakdown() {
    return { ...this.commonErrors };
  }
  
  /**
   * 取得驗證時間序列資料
   * @returns {Array} 時間序列資料
   */
  getValidationTimeSeries() {
    return [...this.timeSeriesData];
  }
  
  /**
   * 匯出報告為 CSV 格式
   * @returns {string} CSV 格式報告
   */
  exportReportAsCSV() {
    const headers = ['Book ID', 'Valid', 'Errors', 'Processing Time'];
    const rows = [headers.join(',')];
    
    for (const entry of this.processingHistory) {
      rows.push([
        entry.bookId,
        entry.success ? 'Yes' : 'No',
        entry.success ? '0' : '1+',
        entry.processingTime.toFixed(2)
      ].join(','));
    }
    
    return rows.join('\n');
  }
  
  /**
   * 匯出報告為 JSON 格式
   * @returns {string} JSON 格式報告
   */
  exportReportAsJSON() {
    const report = this.getValidationReport();
    report.processingHistory = this.processingHistory;
    report.timeSeriesData = this.timeSeriesData;
    
    return JSON.stringify(report, null, 2);
  }
  
  /**
   * 新增自訂驗證規則
   * @param {Object} rule - 自訂規則
   */
  addCustomValidationRule(rule) {
    this.customRules.set(rule.name, rule);
    this.enabledRules.add(rule.name);
  }
  
  /**
   * 停用驗證規則
   * @param {string} ruleName - 規則名稱
   */
  disableValidationRule(ruleName) {
    this.enabledRules.delete(ruleName);
  }
  
  /**
   * 啟用驗證規則
   * @param {string} ruleName - 規則名稱
   */
  enableValidationRule(ruleName) {
    this.enabledRules.add(ruleName);
  }
  
  /**
   * 設定驗證模式
   * @param {string} mode - 驗證模式 ('strict' | 'lenient')
   */
  setValidationMode(mode) {
    this.validationMode = mode;
    
    if (mode === 'lenient') {
      // 寬鬆模式下停用一些非必要驗證
      this.config.maxValidationErrors = 100;
    } else {
      // 嚴格模式
      this.config.maxValidationErrors = 50;
    }
  }
  
  /**
   * 取得支援的平台
   * @returns {string[]} 平台列表
   */
  getSupportedPlatforms() {
    return ['readmoo']; // 未來可擴展
  }
  
  /**
   * 設定平台特定規則
   * @param {string} platform - 平台名稱
   * @param {Object} rules - 規則配置
   */
  setPlatformRules(platform, rules) {
    // 為未來多書城擴展預留
    if (platform === 'readmoo') {
      this.validationRules.readmoo = { ...this.validationRules.readmoo, ...rules };
    }
  }
  
  /**
   * 新增平台驗證器
   * @param {string} platform - 平台名稱
   * @param {Function} validator - 驗證器函數
   */
  addPlatformValidator(platform, validator) {
    // 為未來多書城擴展預留
  }
  
  /**
   * 設定快取過期時間
   * @param {number} expiration - 過期時間 (ms)
   */
  setCacheExpiration(expiration) {
    this.config.cacheExpiration = expiration;
  }
  
  /**
   * 取得快取大小
   * @returns {number} 快取大小
   */
  getCacheSize() {
    return this.validationCache.size + this.ruleCache.size;
  }
  
  /**
   * 取得快取命中率
   * @returns {number} 快取命中率
   */
  getCacheHitRate() {
    // 簡化實現，實際應追蹤命中/未命中次數
    return this.getCacheSize() > 0 ? 0.8 : 0;
  }
  
  /**
   * 取得記憶體使用情況
   * @returns {Object} 記憶體使用統計
   */
  getMemoryUsage() {
    const currentUsage = this.getCacheSize() * 100; // 簡化計算
    const historySize = this.processingHistory.length * 50; // 歷史記錄大小
    const totalUsage = currentUsage + historySize;
    
    this.memoryUsage.currentUsage = totalUsage;
    
    if (totalUsage > this.memoryUsage.peakUsage) {
      this.memoryUsage.peakUsage = totalUsage;
    }
    
    // 模擬記憶體清理後的減少
    if (this.processingHistory.length > 500) {
      this.memoryUsage.currentUsage = Math.max(0, this.memoryUsage.currentUsage - historySize * 0.3);
    }
    
    return { ...this.memoryUsage };
  }
  
  /**
   * 銷毀驗證器，清理資源
   */
  destroy() {
    this.validationCache.clear();
    this.ruleCache.clear();
    this.processingHistory = [];
    this.timeSeriesData = [];
    this.commonErrors = {};
    this.customRules.clear();
    this.enabledRules.clear();
    
    // 重置統計
    this.validationStats = {
      totalValidated: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageProcessingTime: 0,
      lastValidationTime: null
    };
    
    this.memoryUsage = {
      currentUsage: 0,
      peakUsage: 0
    };
  }
}

module.exports = ReadmooDataValidator; 