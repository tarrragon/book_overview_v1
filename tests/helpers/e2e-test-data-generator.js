const { ErrorCodesWithTest: ErrorCodes } = require('@tests/helpers/test-error-codes')
/**
 * E2E Test Data Generator
 * 產生端到端測試所需的各種測試資料和測試場景配置
 *
 * 主要功能：
 * - 生成各種類型的書籍測試資料
 * - 建立不同的測試場景配置
 * - 提供效能測試資料集
 * - 生成邊界條件和異常情況資料
 *
 * @author TDD Phase 2 - sage-test-architect
 * @date 2025-08-25
 * @version v0.9.38
 */

class E2ETestDataGenerator {
  constructor () {
    this.dataCache = new Map()
    this.scenarioTemplates = new Map()
    this.bookTemplates = {
      normal: [],
      edgeCase: [],
      performance: [],
      error: []
    }

    // 初始化基本資料模板
    this.initializeTemplates()
  }

  /**
   * 初始化資料模板
   * @private
   */
  initializeTemplates () {
    this.setupBookTemplates()
    this.setupScenarioTemplates()
  }

  /**
   * 設置書籍資料模板
   * @private
   */
  setupBookTemplates () {
    // 正常書籍模板
    this.bookTemplates.normal = [
      {
        title: '正常書籍標題',
        author: '作者姓名',
        progress: 75,
        status: '閱讀中',
        category: '文學小說'
      },
      {
        title: '科技趨勢分析',
        author: '科技專家',
        progress: 45,
        status: '閱讀中',
        category: '商業管理'
      },
      {
        title: '歷史回顧',
        author: '歷史學者',
        progress: 100,
        status: '已完成',
        category: '人文歷史'
      }
    ]

    // 邊界條件模板
    this.bookTemplates.edgeCase = [
      {
        title: '📚 這是包含emoji的超級長書籍標題測試用書籍 🌟 用於測試各種特殊情況處理 📖',
        author: '特殊字符作者名稱 <>&"\'',
        progress: 0,
        status: '未開始',
        category: '測試類別'
      },
      {
        title: '', // 空標題
        author: '',
        progress: null,
        status: undefined,
        category: null
      },
      {
        title: '超級長標題'.repeat(50),
        author: '超級長作者名稱'.repeat(20),
        progress: 101, // 超出範圍
        status: '異常狀態',
        category: '異常類別'
      }
    ]

    // 效能測試模板
    this.bookTemplates.performance = [
      {
        title: '效能測試書籍',
        author: '效能作者',
        progress: 50,
        status: '閱讀中',
        category: '效能測試'
      }
    ]
  }

  /**
   * 設置測試場景模板
   * @private
   */
  setupScenarioTemplates () {
    // 正常工作流程場景
    this.scenarioTemplates.set('normalWorkflow', {
      type: 'normal',
      pageContext: {
        url: 'https://readmoo.com/shelf',
        bookCount: 15,
        userLoggedIn: true,
        pageLoaded: true
      },
      extensionContext: {
        installed: true,
        permissions: ['storage', 'activeTab'],
        version: '1.0.0'
      },
      expectedResults: {
        success: true,
        extractionTime: 3000,
        memoryUsage: process.memoryUsage().heapUsed // Real memory usage in bytes
      }
    })

    // 事件序列測試場景
    this.scenarioTemplates.set('eventSequence', {
      type: 'eventTest',
      expectedEvents: [
        'POPUP.OPENED',
        'EXTRACTOR.REQUEST.STARTED',
        'CONTENT_SCRIPT.INJECTION.COMPLETED',
        'EXTRACTOR.PROGRESS.UPDATED',
        'EXTRACTOR.DATA.EXTRACTED',
        'STORAGE.SAVE.COMPLETED',
        'UI.SUCCESS.DISPLAYED'
      ]
    })

    // 錯誤處理場景
    this.scenarioTemplates.set('errorHandling', {
      type: 'error',
      errorType: 'permissionDenied',
      expectedBehavior: 'gracefulFailure'
    })
  }

  /**
   * 生成測試書籍集合
   * @param {DataGenerationConfig} config - 生成配置
   * @returns {BookCollection} 測試書籍資料
   */
  generateBookCollection (config = {}) {
    const {
      count = 10,
      type = 'normal',
      includeEdgeCases = false,
      seed = Date.now()
    } = config

    // 使用種子確保測試可重現
    this.setSeed(seed)

    const books = []
    const template = this.bookTemplates[type] || this.bookTemplates.normal

    for (let i = 0; i < count; i++) {
      const baseTemplate = template[i % template.length]
      const book = this.generateSingleBook(baseTemplate, i)
      books.push(book)
    }

    // 如果需要邊界條件，添加特殊書籍
    if (includeEdgeCases) {
      const edgeCaseBooks = this.generateEdgeCaseBooks()
      books.push(...edgeCaseBooks)
    }

    // 快取生成的資料
    const cacheKey = `books_${type}_${count}_${includeEdgeCases}`
    this.dataCache.set(cacheKey, books)

    return books
  }

  /**
   * 生成單一書籍資料
   * @param {Object} template - 書籍模板
   * @param {number} index - 索引
   * @returns {Object} 書籍資料
   * @private
   */
  generateSingleBook (template, index) {
    return {
      id: `stable-book-id-${index + 1}`,
      title: template.title || `測試書籍 ${index + 1}`,
      author: template.author || `作者 ${index + 1}`,
      cover: `https://example.com/cover-${index + 1}.jpg`,
      progress: template.progress !== undefined ? template.progress : this.randomInt(0, 100),
      status: template.status || (template.progress > 0 ? '閱讀中' : '未開始'),
      isbn: `978-986-${String(index + 1).padStart(7, '0')}`,
      publisher: template.publisher || `出版社 ${index + 1}`,
      publishDate: template.publishDate || `2023-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-01`,
      category: template.category || '一般書籍',
      description: template.description || `這是測試書籍 ${index + 1} 的描述`,
      rating: this.randomInt(1, 5),
      pageCount: this.randomInt(100, 500),
      // 測試用屬性
      _testMetadata: {
        generatedAt: Date.now(),
        templateType: template._type || 'normal',
        index
      }
    }
  }

  /**
   * 生成混合書籍集合
   * @param {Array} mixConfig - 混合配置
   * @returns {Array} 混合書籍資料
   */
  generateMixedBookCollection (mixConfig) {
    const books = []

    mixConfig.forEach((config, index) => {
      const book = this.generateBookFromConfig(config, index)
      books.push(book)
    })

    return books
  }

  /**
   * 根據配置生成書籍
   * @param {Object} config - 配置
   * @param {number} index - 索引
   * @returns {Object} 書籍資料
   * @private
   */
  generateBookFromConfig (config, index) {
    const baseBook = {
      id: `mixed-book-${index}`,
      title: `混合測試書籍 ${index}`,
      author: `混合作者 ${index}`,
      progress: 50
    }

    switch (config.type) {
      case 'unicode':
        return {
          ...baseBook,
          title: '📚 Unicode書籍 🌟',
          author: '🇹🇼 台灣作者',
          hasSpecialChars: true
        }

      case 'longTitle':
        return {
          ...baseBook,
          title: '超長標題測試書籍'.repeat(20),
          isLongTitle: true
        }

      case 'missingCover':
        return {
          ...baseBook,
          cover: null,
          hasMissingData: true
        }

      default:
        return baseBook
    }
  }

  /**
   * 生成測試場景配置
   * @param {string} scenarioType - 場景類型
   * @returns {TestScenario} 測試場景配置
   */
  generateTestScenario (scenarioType) {
    const template = this.scenarioTemplates.get(scenarioType)

    if (!template) {
      throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
    }

    // 克隆模板並添加動態資料
    const scenario = JSON.parse(JSON.stringify(template))

    // 添加動態生成的資料
    scenario.id = `scenario-${scenarioType}-${Date.now()}`
    scenario.createdAt = new Date().toISOString()
    scenario.testId = `test-${this.generateUUID()}`

    // 根據場景類型添加特定配置
    switch (scenarioType) {
      case 'normalWorkflow':
        scenario.books = this.generateBookCollection({ count: 15 })
        break

      case 'dataIntegrity':
        scenario.books = this.generateMixedBookCollection([
          { type: 'normal' },
          { type: 'unicode' },
          { type: 'longTitle' },
          { type: 'missingCover' }
        ])
        break

      case 'userFeedback':
        scenario.expectedFeedback = [
          '開始提取書籍資料',
          '正在處理第 1 本書籍',
          '提取完成，共找到 15 本書籍'
        ]
        break
    }

    return scenario
  }

  /**
   * 生成效能測試資料
   * @param {PerformanceTestConfig} config - 效能測試配置
   * @returns {PerformanceTestData} 效能測試資料
   */
  generatePerformanceTestData (config = {}) {
    const {
      bookCount = 100,
      complexity = 'medium',
      includeHeavyData = false
    } = config

    const testData = {
      books: [],
      expectedMetrics: {
        maxExtractionTime: this.calculateExpectedTime(bookCount),
        maxMemoryUsage: this.calculateExpectedMemory(bookCount),
        minThroughput: this.calculateMinThroughput(bookCount)
      },
      loadProfile: {
        bookCount,
        complexity,
        dataSize: 0
      }
    }

    // 生成效能測試書籍
    for (let i = 0; i < bookCount; i++) {
      const book = this.generatePerformanceTestBook(i, complexity)
      testData.books.push(book)
    }

    // 如果需要重資料，添加大型資料
    if (includeHeavyData) {
      testData.books = testData.books.map(book => ({
        ...book,
        largeDescription: 'A'.repeat(1000), // 1KB 描述
        metadata: this.generateLargeMetadata()
      }))
    }

    // 計算總資料大小
    testData.loadProfile.dataSize = this.estimateDataSize(testData.books)

    return testData
  }

  /**
   * 生成效能測試書籍
   * @param {number} index - 索引
   * @param {string} complexity - 複雜度
   * @returns {Object} 效能測試書籍
   * @private
   */
  generatePerformanceTestBook (index, complexity) {
    const baseBook = {
      id: `perf-book-${index}`,
      title: `效能測試書籍 ${index}`,
      author: `效能作者 ${index}`,
      progress: this.randomInt(0, 100)
    }

    switch (complexity) {
      case 'low':
        return baseBook

      case 'medium':
        return {
          ...baseBook,
          description: `這是中等複雜度的效能測試書籍描述 ${index}`,
          tags: [`標籤${index}`, `分類${index % 5}`, `主題${index % 3}`],
          metadata: {
            pageCount: this.randomInt(100, 300),
            publishYear: 2020 + (index % 4),
            language: index % 2 === 0 ? 'zh-TW' : 'en-US'
          }
        }

      case 'high':
        return {
          ...baseBook,
          title: `高複雜度效能測試書籍標題包含很多文字和特殊字符 ${index} 📚🌟`,
          description: '高複雜度書籍描述'.repeat(10),
          tags: Array.from({ length: 20 }, (_, i) => `複雜標籤${i}`),
          metadata: {
            pageCount: this.randomInt(500, 1000),
            chapters: Array.from({ length: 25 }, (_, i) => `章節${i + 1}`),
            reviews: Array.from({ length: 50 }, (_, i) => ({
              rating: this.randomInt(1, 5),
              comment: `評論內容${i}`,
              date: new Date(2023, i % 12, (i % 28) + 1).toISOString()
            }))
          },
          largeData: 'X'.repeat(5000) // 5KB 額外資料
        }

      default:
        return baseBook
    }
  }

  /**
   * 生成特殊字符書籍
   * @param {Object} config - 配置
   * @returns {Array} 特殊字符書籍
   */
  generateSpecialCharacterBooks (config = {}) {
    const {
      includeEmojis = true,
      includeUnicode = true,
      includeHtmlEntities = true,
      includeCJKCharacters = true
    } = config

    const books = []

    if (includeEmojis) {
      books.push({
        id: 'emoji-book',
        title: '📚 Emoji測試書籍 🌟📖✨🎯🔥💫🌈',
        author: '😊 Emoji作者 👤',
        progress: 50,
        description: '這本書包含各種emoji表情符號 🎉🎊🎁'
      })
    }

    if (includeUnicode) {
      books.push({
        id: 'unicode-book',
        title: '中文한글ひらがなالعربيةРусскийΕλληνικά',
        author: 'Unicode測試作者',
        progress: 25,
        description: '多語言Unicode字符測試 ñáéíóú çñü αβγδε'
      })
    }

    if (includeHtmlEntities) {
      books.push({
        id: 'html-entities-book',
        title: 'HTML實體測試：&lt;&gt;&amp;&quot;&apos;',
        author: 'HTML & XML 專家',
        progress: 75,
        description: '包含HTML實體字符的測試書籍'
      })
    }

    if (includeCJKCharacters) {
      books.push({
        id: 'cjk-book',
        title: '中日韓統一表意文字測試：漢字ひらがなカタカナ한글',
        author: 'CJK文字專家',
        progress: 60,
        description: 'CJK統一表意文字和表音文字測試'
      })
    }

    return books
  }

  /**
   * 生成邊界條件書籍
   * @param {Object} config - 配置
   * @returns {Array} 邊界條件書籍
   */
  generateEdgeCaseBooks (config = {}) {
    const {
      longTitles = true,
      missingData = true,
      corruptedData = true,
      oversizedData = true,
      includeUnicodeBooks = true
    } = config

    const books = []

    // Unicode和emoji書籍
    if (includeUnicodeBooks) {
      books.push(
        {
          id: 'unicode-book',
          title: '📚 Unicode測試書籍 🌟 包含各種特殊字符：中文、日文、韓文、阿拉伯文',
          author: 'Unicode作者 👤',
          progress: 50
        },
        {
          id: 'special-chars-book',
          title: '特殊字符測試：<>&"\'`~!@#$%^&*()_+-={}[]|\\:";\'<>?,./',
          author: 'HTML & XML 作者',
          progress: 75
        }
      )
    }

    if (longTitles) {
      books.push({
        id: 'long-title-book',
        title: '超級長標題測試書籍'.repeat(50),
        author: '長名稱作者'.repeat(10),
        progress: 30,
        isLongTitle: true
      })
    }

    if (missingData) {
      books.push(
        {
          id: 'missing-title-book',
          title: '',
          author: '有作者但沒標題',
          progress: 40
        },
        {
          id: 'missing-author-book',
          title: '有標題但沒作者',
          author: '',
          progress: 60
        },
        {
          id: 'null-data-book',
          title: null,
          author: null,
          progress: null,
          cover: null
        },
        {
          id: 'null-values-book',
          title: '',
          author: null,
          progress: null,
          cover: null,
          status: undefined
        }
      )
    }

    if (corruptedData) {
      books.push(
        {
          id: 'corrupted-book',
          title: 'JSON測試："\\u0000\\u0001\\u0002',
          author: '特殊控制字符作者',
          progress: 'invalid', // 非數字進度
          invalidField: { circular: null }
        },
        {
          id: 'extreme-values-book',
          title: '極端數值測試',
          author: '極端作者',
          progress: -1, // 負數
          rating: 10, // 超出範圍
          pageCount: 0 // 零頁
        }
      )
    }

    if (oversizedData) {
      books.push({
        id: 'oversized-book',
        title: '超大資料測試書籍',
        author: '大資料作者',
        progress: 50,
        massiveDescription: 'A'.repeat(100000), // 100KB 描述
        hugeArray: Array.from({ length: 10000 }, (_, i) => `項目${i}`)
      })
    }

    return books
  }

  /**
   * 生成複雜書籍集合
   * @param {Object} config - 配置
   * @returns {Array} 複雜書籍集合
   */
  generateComplexBookCollection (config = {}) {
    const {
      includeProgressVariations = true,
      includeMetadataVariations = true,
      includeFormatVariations = true
    } = config

    const books = []
    const baseCount = 20

    for (let i = 0; i < baseCount; i++) {
      const book = {
        id: `complex-book-${i}`,
        title: `複雜測試書籍 ${i}`,
        author: `複雜作者 ${i}`,
        progress: 50
      }

      if (includeProgressVariations) {
        // 各種進度值變化
        book.progress = [0, 25, 50, 75, 100, null, -1, 101][i % 8]
        book.progressHistory = Array.from({ length: 5 }, (_, j) => ({
          date: new Date(2023, j, 1).toISOString(),
          progress: j * 20
        }))
      }

      if (includeMetadataVariations) {
        // 各種元資料變化
        book.metadata = {
          isbn: i % 2 === 0 ? `978-${String(i).padStart(10, '0')}` : null,
          publishYear: i % 3 === 0 ? 2020 + (i % 5) : null,
          genre: ['小說', '科技', '歷史', '藝術', null][i % 5],
          language: ['zh-TW', 'en-US', 'ja-JP', null][i % 4]
        }
      }

      if (includeFormatVariations) {
        // 各種格式變化
        book.formats = [
          { type: 'epub', available: i % 2 === 0 },
          { type: 'pdf', available: i % 3 === 0 },
          { type: 'audio', available: i % 5 === 0 }
        ]
      }

      books.push(book)
    }

    return books
  }

  /**
   * 生成現有儲存資料
   * @param {Object} config - 配置
   * @returns {Object} 現有儲存資料
   */
  generateExistingStorageData (config = {}) {
    const { count = 10 } = config

    const existingBooks = this.generateBookCollection({ count, type: 'normal' })

    return {
      books: existingBooks,
      metadata: {
        totalBooks: count,
        lastUpdate: new Date().toISOString(),
        version: '1.0.0'
      },
      userSettings: {
        autoSync: true,
        defaultView: 'grid',
        sortBy: 'title'
      }
    }
  }

  /**
   * 計算預期處理時間
   * @param {number} bookCount - 書籍數量
   * @returns {number} 預期時間 (毫秒)
   * @private
   */
  calculateExpectedTime (bookCount) {
    // 基於書籍數量的線性估算
    const baseTime = 1000 // 1秒基礎時間
    const perBookTime = 10 // 每本書10毫秒
    return baseTime + (bookCount * perBookTime)
  }

  /**
   * 計算預期記憶體使用
   * @param {number} bookCount - 書籍數量
   * @returns {number} 預期記憶體 (字節)
   * @private
   */
  calculateExpectedMemory (bookCount) {
    const baseMemory = 10 * 1024 * 1024 // 10MB 基礎記憶體
    const perBookMemory = 1024 // 每本書1KB
    return baseMemory + (bookCount * perBookMemory)
  }

  /**
   * 計算最小吞吐量
   * @param {number} bookCount - 書籍數量
   * @returns {number} 最小吞吐量 (books/second)
   * @private
   */
  calculateMinThroughput (bookCount) {
    return Math.max(1, bookCount / 10) // 至少每秒處理1本書
  }

  /**
   * 生成大型元資料
   * @returns {Object} 大型元資料
   * @private
   */
  generateLargeMetadata () {
    return {
      tags: Array.from({ length: 100 }, (_, i) => `標籤${i}`),
      reviews: Array.from({ length: 200 }, (_, i) => ({
        id: i,
        rating: this.randomInt(1, 5),
        comment: `評論內容${i}`.repeat(10),
        date: new Date(2023, i % 12, (i % 28) + 1).toISOString()
      })),
      statistics: Array.from({ length: 365 }, (_, i) => ({
        date: new Date(2023, 0, i + 1).toISOString(),
        readingTime: this.randomInt(0, 120),
        pagesRead: this.randomInt(0, 50)
      }))
    }
  }

  /**
   * 估算資料大小
   * @param {Array} data - 資料陣列
   * @returns {number} 估算大小 (字節)
   * @private
   */
  estimateDataSize (data) {
    // 簡單估算：序列化後的字符串長度
    try {
      return JSON.stringify(data).length
    } catch (error) {
      return data.length * 1000 // 每筆資料估算1KB
    }
  }

  /**
   * 生成UUID
   * @returns {string} UUID
   * @private
   */
  generateUUID () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  /**
   * 設定隨機種子 (簡化版)
   * @param {number} seed - 種子值
   * @private
   */
  setSeed (seed) {
    this.randomSeed = seed
  }

  /**
   * 生成隨機整數
   * @param {number} min - 最小值
   * @param {number} max - 最大值
   * @returns {number} 隨機整數
   * @private
   */
  randomInt (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  /**
   * 清除資料快取
   */
  clearCache () {
    this.dataCache.clear()
  }

  /**
   * 獲取快取統計
   * @returns {Object} 快取統計
   */
  getCacheStats () {
    return {
      size: this.dataCache.size,
      keys: Array.from(this.dataCache.keys())
    }
  }
}

module.exports = E2ETestDataGenerator
