/**
 * ReadmooAdapter - Readmoo 書籍資料提取適配器
 * 
 * 負責功能：
 * - 專門處理 Readmoo 網站的書籍資料提取
 * - 解析 Readmoo 特定的 DOM 結構
 * - 提取完整的書籍資訊 (ID、標題、封面、進度、類型等)
 * - 提供標準化的適配器介面
 * - 統計和錯誤追蹤
 * 
 * 設計考量：
 * - 基於適配器模式，為未來的多書城支援做準備
 * - 專注於 Readmoo 的 DOM 結構和資料格式
 * - 完整的錯誤處理和容錯設計
 * - 詳細的統計追蹤和狀態管理
 * 
 * 處理流程：
 * 1. 驗證頁面 URL 是否為支援的 Readmoo 頁面
 * 2. 解析 DOM 文檔，尋找書籍容器元素
 * 3. 逐一解析每個書籍元素，提取完整資訊
 * 4. 驗證和清理提取的資料
 * 5. 更新統計和返回結果
 * 
 * 使用情境：
 * - 在 Readmoo 書庫頁面進行資料提取
 * - 批量處理多本書籍的資訊
 * - 監控提取過程的成功率和錯誤情況
 */

class ReadmooAdapter {
  /**
   * 建構函數
   * @param {Object} options - 適配器配置選項
   */
  constructor(options = {}) {
    // 適配器基本資訊
    this.name = 'ReadmooAdapter';
    this.version = '1.0.0';
    
    // 初始化狀態
    this.isInitialized = false;
    
         // 適配器配置
     this.config = {
       maxRetries: 3,
       timeout: 5000,
       enableDebug: false,
       strictMode: false, // 預設為非嚴格模式，允許部分失敗
       ...options
     };
    
    // 統計追蹤
    this.stats = {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      totalBooksExtracted: 0,
      averageExtractionTime: 0,
      lastExtractionTime: null,
      errors: []
    };
    
    // 支援的 URL 模式
    this.supportedUrls = [
      'readmoo.com',
      'member.readmoo.com',
      'www.readmoo.com'
    ];
    
         // Readmoo DOM 選擇器 (基於真實頁面結構設計)
     this.selectors = {
       bookContainer: '.library-item',           // 書籍容器
       readerLink: 'a[href*="/api/reader/"]',    // 閱讀器連結
       bookImage: '.cover-img',                  // 封面圖片
       bookTitle: '.title',                      // 書籍標題
       progressBar: '.progress-bar',             // 進度條
       renditionType: '.label.rendition'         // 書籍類型標籤
     };
  }

  /**
   * 取得支援的 URL 列表
   * @returns {string[]} 支援的 URL 列表
   */
  getSupportedUrls() {
    return [...this.supportedUrls];
  }

  /**
   * 驗證頁面 URL 是否受支援
   * @param {string} url - 要驗證的 URL
   * @returns {boolean} 是否為支援的 Readmoo 頁面
   */
  validatePage(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      const urlObj = new URL(url);
      return this.supportedUrls.some(domain => 
        urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * 解析 DOM 文檔
   * @param {Document} document - DOM 文檔
   * @returns {Object} 解析結果
   */
  parseDocument(document) {
    if (!document) {
      return {
        isValid: true,
        bookElements: [],
        message: '文檔為空'
      };
    }

    try {
      const bookElements = this.findBookContainers(document);
      
      return {
        isValid: true,
        bookElements,
        totalFound: bookElements.length,
        message: `找到 ${bookElements.length} 個書籍元素`
      };
    } catch (error) {
      return {
        isValid: false,
        bookElements: [],
        error: error.message,
        message: '文檔解析失敗'
      };
    }
  }

  /**
   * 尋找書籍容器元素
   * @param {Document} document - DOM 文檔
   * @returns {Element[]} 書籍容器元素陣列
   */
  findBookContainers(document) {
    if (!document || !document.querySelectorAll) {
      return [];
    }

    const containers = document.querySelectorAll(this.selectors.bookContainer);
    return Array.from(containers);
  }

  /**
   * 提取書籍資料 (主要介面方法)
   * @param {Document} document - DOM 文檔
   * @returns {Promise<Object[]>} 提取的書籍資料陣列
   */
  async extractBooks(document) {
    const startTime = performance.now();
    
    try {
      this.stats.totalExtractions++;
      
      if (!document) {
        return [];
      }

      const parseResult = this.parseDocument(document);
      if (!parseResult.isValid) {
        throw new Error(parseResult.error || '文檔解析失敗');
      }

      const books = [];
      const bookElements = parseResult.bookElements;

             for (const element of bookElements) {
         try {
           const bookData = await this.parseBookElement(element);
           if (bookData) {
             books.push(bookData);
           }
         } catch (error) {
           this.recordError('parseBookElement', error);
           
           // 在非嚴格模式下繼續處理其他書籍
           if (this.config.strictMode) {
             throw error;
           }
           // 在非嚴格模式下記錄個別失敗但繼續處理
         }
       }

      // 更新成功統計
      this.stats.successfulExtractions++;
      this.stats.totalBooksExtracted += books.length;
      
      const executionTime = performance.now() - startTime;
      this.updateAverageExecutionTime(executionTime);
      this.stats.lastExtractionTime = new Date().toISOString();

      return books;

    } catch (error) {
      this.stats.failedExtractions++;
      this.recordError('extractBooks', error);
      
      // 在非嚴格模式下返回空陣列而不是拋出錯誤
      if (this.config.strictMode) {
        throw error;
      }
      return [];
    }
  }

  /**
   * 解析單個書籍元素
   * @param {Element} element - 書籍容器元素
   * @returns {Promise<Object|null>} 書籍資料物件
   */
  async parseBookElement(element) {
    if (!element || !element.querySelector) {
      return null;
    }

    try {
      // 提取書籍 ID
      const id = this.extractBookId(element);
      if (!id) {
        return null; // 沒有有效 ID 的書籍跳過
      }

      // 提取其他資訊
      const title = this.extractBookTitle(element);
      const cover = this.extractBookCover(element);
      const progress = this.extractBookProgress(element);
      const type = this.extractBookType(element);

      // 提取額外的識別資訊
      const additionalIds = this.extractAdditionalIdentifiers(element);
      
      // 建構書籍資料物件
      const bookData = {
        id,
        title: title || '未知標題',
        cover: cover || '',
        progress: progress !== null ? progress : 0,
        type: type || '未知',
        extractedAt: new Date().toISOString(),
        source: 'readmoo',
        // 新增的識別資訊
        identifiers: {
          coverId: additionalIds.coverId,
          titleBased: additionalIds.titleBased,
          readerLinkId: additionalIds.readerLinkId,
          primarySource: additionalIds.primarySource
        },
        // 完整的封面URL資訊
        coverInfo: {
          url: cover,
          filename: additionalIds.coverFilename,
          domain: this.extractDomain(cover)
        }
      };

      return bookData;

    } catch (error) {
      this.recordError('parseBookElement', error, { element: element.outerHTML });
      return null;
    }
  }

  /**
   * 提取書籍 ID - 使用封面圖片URL作為主要識別標準
   * @param {Element} element - 書籍元素
   * @returns {string|null} 書籍 ID
   */
  extractBookId(element) {
    try {
      // 主要策略：從封面圖片URL提取書籍ID
      const coverImageId = this.extractBookIdFromCover(element);
      if (coverImageId) {
        return coverImageId;
      }

      // 備用策略：使用標題屬性生成穩定ID
      const titleBasedId = this.extractBookIdFromTitle(element);
      if (titleBasedId) {
        return titleBasedId;
      }

      // 最後備用：使用閱讀器連結（但會註記這是不穩定的ID）
      const readerLinkId = this.extractBookIdFromReaderLink(element);
      if (readerLinkId) {
        return `unstable-${readerLinkId}`; // 標記為不穩定ID
      }

      return null;

    } catch (error) {
      return null;
    }
  }

  /**
   * 從封面圖片URL提取書籍ID（主要方法）
   * @param {Element} element - 書籍元素
   * @returns {string|null} 從封面URL提取的書籍ID
   */
  extractBookIdFromCover(element) {
    try {
      const imgElement = element.querySelector(this.selectors.bookImage);
      if (!imgElement) {
        return null;
      }

      const src = imgElement.getAttribute('src');
      if (!src) {
        return null;
      }

      // 只處理來自 cdn.readmoo.com 的封面 URL
      if (!src.includes('cdn.readmoo.com')) {
        return null;
      }

      // 解析封面URL格式：https://cdn.readmoo.com/cover/xx/xxxxx_210x315.jpg?v=xxxxxxxx
      // 提取核心識別碼部分
      const coverMatch = src.match(/\/cover\/[a-z0-9]+\/([^_]+)_/);
      if (coverMatch) {
        return `cover-${coverMatch[1]}`; // 使用 cover- 前綴標識來源
      }

      // 備用解析方式 - 只對有效域名進行解析
      const filenameMatch = src.match(/\/([^/]+)\.(jpg|png|jpeg)/i);
      if (filenameMatch) {
        const filename = filenameMatch[1].replace(/_\d+x\d+$/, ''); // 移除尺寸後綴
        return `cover-${filename}`;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 從書籍標題生成穩定ID（備用方法）
   * @param {Element} element - 書籍元素
   * @returns {string|null} 基於標題的書籍ID
   */
  extractBookIdFromTitle(element) {
    try {
      const titleElement = element.querySelector(this.selectors.bookTitle);
      if (!titleElement) {
        return null;
      }

      const title = titleElement.getAttribute('title') || titleElement.textContent;
      if (!title || !title.trim()) {
        return null;
      }

      // 生成基於標題的穩定ID
      const normalizedTitle = title.trim()
        .replace(/[^\u4e00-\u9fff\w\s]/g, '') // 保留中文、英文字母、數字、空格
        .replace(/\s+/g, '-') // 空格轉換為連字符
        .toLowerCase();

      if (normalizedTitle.length > 0) {
        return `title-${normalizedTitle.substring(0, 50)}`; // 限制長度並使用 title- 前綴
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 從閱讀器連結提取ID（最後備用方法）
   * 注意：這種方法提取的是用戶ID，不是真正的書籍ID
   * @param {Element} element - 書籍元素
   * @returns {string|null} 從閱讀器連結提取的ID
   */
  extractBookIdFromReaderLink(element) {
    try {
      const readerLink = element.querySelector(this.selectors.readerLink);
      if (!readerLink) {
        return null;
      }

      const href = readerLink.getAttribute('href');
      if (!href) {
        return null;
      }

      // 使用正規表達式提取 ID (支援字母數字組合)
      const idMatch = href.match(/\/api\/reader\/([^/?#]+)/);
      return idMatch ? idMatch[1] : null;

    } catch (error) {
      return null;
    }
  }

  /**
   * 提取書籍標題
   * @param {Element} element - 書籍元素
   * @returns {string|null} 書籍標題
   */
  extractBookTitle(element) {
    try {
      const titleElement = element.querySelector(this.selectors.bookTitle);
      if (titleElement) {
        return titleElement.textContent?.trim() || titleElement.getAttribute('title')?.trim();
      }

      // 備用方案：從圖片 alt 屬性提取
      const imgElement = element.querySelector(this.selectors.bookImage);
      if (imgElement) {
        return imgElement.getAttribute('alt')?.trim();
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 提取書籍封面 URL
   * @param {Element} element - 書籍元素
   * @returns {string|null} 封面 URL
   */
  extractBookCover(element) {
    try {
      const imgElement = element.querySelector(this.selectors.bookImage);
      if (imgElement) {
        return imgElement.getAttribute('src')?.trim();
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 提取閱讀進度
   * @param {Element} element - 書籍元素
   * @returns {number|null} 閱讀進度百分比 (0-100)
   */
  extractBookProgress(element) {
    try {
      const progressBar = element.querySelector(this.selectors.progressBar);
      if (!progressBar) {
        return 0; // 沒有進度條預設為 0%
      }

      const style = progressBar.getAttribute('style');
      if (!style) {
        return 0;
      }

      // 解析 CSS width 屬性
      const widthMatch = style.match(/width:\s*(\d+(?:\.\d+)?)%/);
      if (widthMatch) {
        return Math.round(parseFloat(widthMatch[1]));
      }

      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 提取書籍類型 (流式/版式)
   * @param {Element} element - 書籍元素
   * @returns {string} 書籍類型
   */
  extractBookType(element) {
    try {
      const typeElement = element.querySelector(this.selectors.renditionType);
      if (typeElement) {
        const typeText = typeElement.textContent?.trim();
        if (typeText) {
          return typeText;
        }
      }
      return '未知';
    } catch (error) {
      return '未知';
    }
  }

  /**
   * 提取額外的識別資訊
   * @param {Element} element - 書籍元素
   * @returns {Object} 額外的識別資訊
   */
  extractAdditionalIdentifiers(element) {
    try {
      const coverId = this.extractBookIdFromCover(element);
      const titleBased = this.extractBookIdFromTitle(element);
      const readerLinkId = this.extractBookIdFromReaderLink(element);
      
      // 確定主要來源
      let primarySource = 'unknown';
      if (coverId && coverId.startsWith('cover-')) {
        primarySource = 'cover';
      } else if (titleBased && titleBased.startsWith('title-')) {
        primarySource = 'title';
      } else if (readerLinkId) {
        primarySource = 'reader-link';
      }

      // 提取封面檔名
      const coverElement = element.querySelector(this.selectors.bookImage);
      const coverSrc = coverElement?.getAttribute('src') || '';
      const coverFilename = this.extractFilenameFromUrl(coverSrc);

      return {
        coverId: coverId?.replace(/^cover-/, '') || null,
        titleBased: titleBased?.replace(/^title-/, '') || null,
        readerLinkId: readerLinkId || null,
        primarySource,
        coverFilename
      };
    } catch (error) {
      return {
        coverId: null,
        titleBased: null,
        readerLinkId: null,
        primarySource: 'unknown',
        coverFilename: null
      };
    }
  }

  /**
   * 從URL提取檔名
   * @param {string} url - 完整URL
   * @returns {string|null} 檔名
   */
  extractFilenameFromUrl(url) {
    try {
      if (!url) return null;
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      return filename?.split('?')[0] || null; // 移除查詢參數
    } catch (error) {
      // 備用方法：使用正規表達式
      const match = url.match(/\/([^/]+\.(jpg|png|jpeg|gif|webp))(\?|$)/i);
      return match ? match[1] : null;
    }
  }

  /**
   * 從URL提取域名
   * @param {string} url - 完整URL
   * @returns {string|null} 域名
   */
  extractDomain(url) {
    try {
      if (!url) return null;
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return null;
    }
  }

     /**
    * 記錄錯誤
    * @param {string} operation - 操作名稱
    * @param {Error} error - 錯誤物件
    * @param {Object} context - 額外的上下文資訊
    */
   recordError(operation, error, context = {}) {
     const errorRecord = {
       operation,
       message: error.message,
       timestamp: new Date().toISOString(),
       context
     };

     this.stats.errors.push(errorRecord);
     
     // 針對 parseBookElement 錯誤增加失敗統計
     if (operation === 'parseBookElement') {
       this.stats.failedExtractions++;
     }
     
     // 保持錯誤記錄在合理數量內
     if (this.stats.errors.length > 100) {
       this.stats.errors = this.stats.errors.slice(-50);
     }

     if (this.config.enableDebug) {
       console.error(`[ReadmooAdapter] ${operation}:`, error);
     }
   }

  /**
   * 更新平均執行時間
   * @param {number} executionTime - 執行時間 (毫秒)
   */
  updateAverageExecutionTime(executionTime) {
    const totalExecutions = this.stats.successfulExtractions;
    if (totalExecutions === 1) {
      this.stats.averageExtractionTime = executionTime;
    } else {
      // 計算移動平均值
      this.stats.averageExtractionTime = 
        (this.stats.averageExtractionTime * (totalExecutions - 1) + executionTime) / totalExecutions;
    }
  }

  /**
   * 取得統計資訊
   * @returns {Object} 統計資訊
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalExtractions > 0 
        ? (this.stats.successfulExtractions / this.stats.totalExtractions * 100).toFixed(2) + '%'
        : '0%',
      averageBooksPerExtraction: this.stats.successfulExtractions > 0
        ? (this.stats.totalBooksExtracted / this.stats.successfulExtractions).toFixed(2)
        : '0'
    };
  }

  /**
   * 重置適配器狀態
   */
  reset() {
    this.stats = {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      totalBooksExtracted: 0,
      averageExtractionTime: 0,
      lastExtractionTime: null,
      errors: []
    };
    this.isInitialized = false;
  }

  /**
   * 取得適配器資訊
   * @returns {Object} 適配器資訊
   */
  getAdapterInfo() {
    return {
      name: this.name,
      version: this.version,
      supportedSites: this.getSupportedUrls(),
      features: [
        'DOM解析',
        '書籍資料提取',
        '進度追蹤',
        '類型識別',
        '錯誤處理',
        '統計追蹤'
      ],
      lastUpdated: '2025-01-29'
    };
  }
}

module.exports = ReadmooAdapter; 