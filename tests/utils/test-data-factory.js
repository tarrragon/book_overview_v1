/**
 * Test Data Factory - Stage 3整合測試資料工廠
 * 統一管理所有測試資料的生成，確保測試資料的一致性和可重現性
 * 
 * 功能:
 * - 標準化書籍測試資料生成
 * - Chrome Extension事件資料模擬
 * - 錯誤場景資料建立
 * - 使用者互動序列生成
 * - 效能測試資料生成
 *
 * @author Stage 3 TDD 主線程實作
 * @date 2025-08-27
 * @version v0.9.45
 */

class TestDataFactory {
  constructor() {
    this._initializeSeeds()
    this._initializeTemplates()
  }

  /**
   * 初始化種子資料
   */
  _initializeSeeds() {
    this.seeds = {
      bookTitles: [
        '人類大歷史',
        '原子習慣',
        '薩提爾的對話練習',
        '被討厭的勇氣',
        '思考的藝術',
        '快思慢想',
        '心流：高手都在研究的最優體驗心理學',
        '窮查理的普通常識',
        '投資最重要的事',
        '蛤蟆先生去看心理師'
      ],
      authors: [
        '哈拉瑞',
        '詹姆斯．克利爾',
        '李崇建',
        '岸見一郎',
        '魯爾夫．多貝里',
        '康納曼',
        '米哈里．契克森米哈伊',
        '查理．蒙格',
        '霍華．馬克斯',
        '羅伯特．狄波德'
      ],
      publishers: [
        '天下文化',
        '方智出版',
        '親子天下',
        '究竟出版',
        '商業周刊',
        '時報文化',
        '遠流出版',
        '商周出版',
        '大塊文化',
        '早安財經'
      ],
      categories: [
        '心理勵志',
        '商業理財',
        '社會科學',
        '生活風格',
        '藝術設計',
        '文學小說',
        '人文史地',
        '自然科普',
        '醫療保健',
        '電腦資訊'
      ]
    }
  }

  /**
   * 初始化模板
   */
  _initializeTemplates() {
    this.templates = {
      book: {
        id: '',
        title: '',
        author: '',
        publisher: '',
        category: '',
        progress: 0,
        totalPages: 300,
        currentPage: 0,
        lastReadDate: '',
        addedDate: '',
        rating: 0,
        notes: '',
        tags: [],
        isbn: '',
        price: 0,
        format: 'ebook'
      },
      
      chromeMessage: {
        type: '',
        action: '',
        data: {},
        sender: {
          tab: { id: 1 },
          frameId: 0,
          id: 'test-extension-id'
        },
        timestamp: 0
      },
      
      errorScenario: {
        type: '',
        message: '',
        code: '',
        context: {},
        recoverable: true,
        timestamp: 0
      },
      
      userInteraction: {
        type: '',
        target: '',
        data: {},
        timestamp: 0,
        moduleName: 'popup'
      }
    }
  }

  /**
   * 生成書籍測試資料集
   */
  createBookDataSet(count = 10, type = 'mixed') {
    const books = []
    
    for (let i = 0; i < count; i++) {
      books.push(this._createSingleBook(i, type))
    }
    
    return books
  }

  /**
   * 創建單一書籍資料
   */
  _createSingleBook(index, type) {
    const book = this._initializeBookTemplate()
    this._populateBasicBookInfo(book, index)
    this._populateBookMetadata(book, index)
    this._applyBookTypeData(book, index, type)
    return book
  }

  /**
   * 初始化書籍模板
   */
  _initializeBookTemplate() {
    return { ...this.templates.book }
  }

  /**
   * 填充基礎書籍資訊
   */
  _populateBasicBookInfo(book, index) {
    book.id = this._generateBookId(index)
    book.title = this._selectRandomFromSeed('bookTitles', index)
    book.author = this._selectRandomFromSeed('authors', index)
    book.publisher = this._selectRandomFromSeed('publishers', index)
    book.category = this._selectRandomFromSeed('categories', index)
  }

  /**
   * 填充書籍中繼資料
   */
  _populateBookMetadata(book, index) {
    book.isbn = this._generateISBN(index)
    book.price = this._generatePrice(index)
    book.totalPages = this._generatePageCount(index)
    book.rating = this._generateRating(index)
    book.tags = this._generateTags(index)
  }

  /**
   * 應用書籍類型資料
   */
  _applyBookTypeData(book, index, type) {
    const typeHandlers = this._getBookTypeHandlers()
    const handler = typeHandlers[type] || typeHandlers['mixed']
    handler(book, index)
  }

  /**
   * 獲取書籍類型處理器
   */
  _getBookTypeHandlers() {
    return {
      'reading': (book, index) => this._applyReadingBookData(book, index),
      'completed': (book, index) => this._applyCompletedBookData(book, index),
      'new': (book, index) => this._applyNewBookData(book, index),
      'mixed': (book, index) => this._applyMixedBookData(book, index)
    }
  }

  /**
   * 生成書籍ID
   */
  _generateBookId(index) {
    return `book-${String(index).padStart(4, '0')}-${Date.now()}`
  }

  /**
   * 從種子資料中選擇
   */
  _selectRandomFromSeed(seedName, index) {
    const seed = this.seeds[seedName]
    return seed[index % seed.length]
  }

  /**
   * 應用閱讀中書籍資料
   */
  _applyReadingBookData(book, index) {
    book.progress = Math.floor((index * 17) % 80) + 10 // 10-89%
    book.currentPage = Math.floor(book.totalPages * book.progress / 100)
    book.lastReadDate = this._generateRecentDate(index * 2)
    book.addedDate = this._generateOldDate(index * 7)
  }

  /**
   * 應用已完成書籍資料
   */
  _applyCompletedBookData(book, index) {
    // totalPages已在主函數中設定，這裡直接使用
    book.progress = 100
    book.currentPage = book.totalPages
    book.lastReadDate = this._generateRecentDate(index * 3)
    book.addedDate = this._generateOldDate(index * 10)
    book.notes = `讀完了這本書，很有收穫。 - 測試筆記 ${index}`
  }

  /**
   * 應用新書籍資料
   */
  _applyNewBookData(book, index) {
    book.progress = 0
    book.currentPage = 0
    book.lastReadDate = ''
    book.addedDate = this._generateRecentDate(index)
  }

  /**
   * 應用混合書籍資料
   */
  _applyMixedBookData(book, index) {
    const types = ['reading', 'completed', 'new']
    const selectedType = types[index % types.length]
    
    switch (selectedType) {
      case 'reading':
        this._applyReadingBookData(book, index)
        break
      case 'completed':
        this._applyCompletedBookData(book, index)
        break
      case 'new':
        this._applyNewBookData(book, index)
        break
    }
  }

  /**
   * 生成最近日期
   */
  _generateRecentDate(daysAgo) {
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    return date.toISOString().split('T')[0]
  }

  /**
   * 生成較舊日期
   */
  _generateOldDate(daysAgo) {
    const date = new Date()
    date.setDate(date.getDate() - daysAgo - 30)
    return date.toISOString().split('T')[0]
  }

  /**
   * 生成ISBN
   */
  _generateISBN(index) {
    const base = 9780000000000
    return String(base + index)
  }

  /**
   * 生成價格
   */
  _generatePrice(index) {
    const basePrices = [199, 299, 399, 499, 599]
    return basePrices[index % basePrices.length]
  }

  /**
   * 生成頁數
   */
  _generatePageCount(index) {
    const basePages = [200, 250, 300, 350, 400, 450, 500]
    return basePages[index % basePages.length]
  }

  /**
   * 生成評分
   */
  _generateRating(index) {
    const ratings = [3, 4, 4, 5, 4, 5, 5, 4, 3, 5]
    return ratings[index % ratings.length]
  }

  /**
   * 生成標籤
   */
  _generateTags(index) {
    const allTags = ['推薦', '必讀', '收藏', '重讀', '筆記多', '實用']
    const tagCount = (index % 3) + 1
    
    const tags = []
    for (let i = 0; i < tagCount; i++) {
      const tagIndex = (index + i) % allTags.length
      tags.push(allTags[tagIndex])
    }
    
    return tags
  }

  /**
   * 創建Chrome消息資料
   */
  createChromeMessages(count = 5, messageTypes = ['EXTRACTION', 'STORAGE', 'UI_UPDATE']) {
    const messages = []
    
    for (let i = 0; i < count; i++) {
      messages.push(this._createSingleChromeMessage(i, messageTypes))
    }
    
    return messages
  }

  /**
   * 創建單一Chrome消息
   */
  _createSingleChromeMessage(index, messageTypes) {
    const message = { ...this.templates.chromeMessage }
    
    message.type = messageTypes[index % messageTypes.length]
    message.action = this._generateMessageAction(message.type, index)
    message.data = this._generateMessageData(message.type, index)
    message.timestamp = Date.now() + index
    
    // 調整sender資訊
    message.sender.tab.id = (index % 5) + 1
    
    return message
  }

  /**
   * 生成消息動作
   */
  _generateMessageAction(type, index) {
    const actions = {
      EXTRACTION: ['START', 'PROGRESS', 'COMPLETE', 'ERROR'],
      STORAGE: ['SAVE', 'LOAD', 'DELETE', 'SYNC'],
      UI_UPDATE: ['REFRESH', 'SHOW_PROGRESS', 'SHOW_ERROR', 'HIDE_LOADING']
    }
    
    const typeActions = actions[type] || ['DEFAULT']
    return typeActions[index % typeActions.length]
  }

  /**
   * 生成消息資料
   */
  _generateMessageData(type, index) {
    switch (type) {
      case 'EXTRACTION':
        return {
          bookId: `book-${index}`,
          progress: (index * 25) % 100,
          totalBooks: 10
        }
        
      case 'STORAGE':
        return {
          key: `storage-key-${index}`,
          value: `storage-value-${index}`,
          area: index % 2 === 0 ? 'local' : 'sync'
        }
        
      case 'UI_UPDATE':
        return {
          component: `component-${index}`,
          state: index % 2 === 0 ? 'visible' : 'hidden'
        }
        
      default:
        return {
          index,
          timestamp: Date.now()
        }
    }
  }

  /**
   * 創建錯誤場景資料
   */
  createErrorScenarios(count = 5) {
    const scenarios = []
    
    for (let i = 0; i < count; i++) {
      scenarios.push(this._createSingleErrorScenario(i))
    }
    
    return scenarios
  }

  /**
   * 創建單一錯誤場景
   */
  _createSingleErrorScenario(index) {
    const scenario = { ...this.templates.errorScenario }
    
    const errorTypes = [
      'NETWORK_ERROR',
      'PARSE_ERROR', 
      'PERMISSION_ERROR',
      'STORAGE_ERROR',
      'TIMEOUT_ERROR'
    ]
    
    scenario.type = errorTypes[index % errorTypes.length]
    scenario.message = this._generateErrorMessage(scenario.type, index)
    scenario.code = this._generateErrorCode(scenario.type, index)
    scenario.context = this._generateErrorContext(scenario.type, index)
    scenario.recoverable = index % 3 !== 0 // 2/3的錯誤可恢復
    scenario.timestamp = Date.now() + index
    
    return scenario
  }

  /**
   * 生成錯誤訊息
   */
  _generateErrorMessage(type, index) {
    const messages = {
      NETWORK_ERROR: [
        'Network request failed',
        'Connection timeout',
        'Server not responding',
        'DNS resolution failed'
      ],
      PARSE_ERROR: [
        'Invalid JSON format',
        'Unexpected token in JSON',
        'Data structure mismatch',
        'Required field missing'
      ],
      PERMISSION_ERROR: [
        'Access denied',
        'Insufficient permissions',
        'Origin not allowed',
        'API quota exceeded'
      ],
      STORAGE_ERROR: [
        'Storage quota exceeded',
        'Storage access denied',
        'Storage corruption detected',
        'Storage sync failed'
      ],
      TIMEOUT_ERROR: [
        'Operation timeout',
        'Request timeout',
        'Processing timeout',
        'Response timeout'
      ]
    }
    
    const typeMessages = messages[type] || ['Unknown error']
    return typeMessages[index % typeMessages.length]
  }

  /**
   * 生成錯誤代碼
   */
  _generateErrorCode(type, index) {
    const codes = {
      NETWORK_ERROR: ['NET_001', 'NET_002', 'NET_003', 'NET_004'],
      PARSE_ERROR: ['PARSE_001', 'PARSE_002', 'PARSE_003', 'PARSE_004'],
      PERMISSION_ERROR: ['PERM_001', 'PERM_002', 'PERM_003', 'PERM_004'],
      STORAGE_ERROR: ['STOR_001', 'STOR_002', 'STOR_003', 'STOR_004'],
      TIMEOUT_ERROR: ['TIME_001', 'TIME_002', 'TIME_003', 'TIME_004']
    }
    
    const typeCodes = codes[type] || ['ERR_000']
    return typeCodes[index % typeCodes.length]
  }

  /**
   * 生成錯誤上下文
   */
  _generateErrorContext(type, index) {
    return {
      operation: `test-operation-${index}`,
      module: ['background', 'content', 'popup'][index % 3],
      timestamp: Date.now(),
      attempt: (index % 3) + 1,
      maxRetries: 3,
      userAgent: 'Test Browser',
      url: `https://test.example.com/page${index}`
    }
  }

  /**
   * 創建使用者互動序列
   */
  createUserInteractionSequence(length = 10) {
    const sequence = []
    
    for (let i = 0; i < length; i++) {
      sequence.push(this._createSingleUserInteraction(i))
    }
    
    return sequence
  }

  /**
   * 創建單一使用者互動
   */
  _createSingleUserInteraction(index) {
    const interaction = { ...this.templates.userInteraction }
    
    const interactionTypes = [
      'click', 'input', 'scroll', 'hover', 'keypress'
    ]
    
    const targets = [
      '#extract-button',
      '#search-input', 
      '.book-item',
      '#settings-menu',
      '#export-button'
    ]
    
    interaction.type = interactionTypes[index % interactionTypes.length]
    interaction.target = targets[index % targets.length]
    interaction.data = this._generateInteractionData(interaction.type, index)
    interaction.timestamp = Date.now() + (index * 1000)
    interaction.moduleName = ['popup', 'content'][index % 2]
    
    return interaction
  }

  /**
   * 生成互動資料
   */
  _generateInteractionData(type, index) {
    switch (type) {
      case 'click':
        return {
          button: index % 2 === 0 ? 'left' : 'right',
          coordinates: { x: 100 + index * 10, y: 200 + index * 5 }
        }
        
      case 'input':
        return {
          value: `test input ${index}`,
          inputType: 'text'
        }
        
      case 'scroll':
        return {
          direction: index % 2 === 0 ? 'down' : 'up',
          distance: (index + 1) * 100
        }
        
      case 'hover':
        return {
          duration: (index + 1) * 500
        }
        
      case 'keypress':
        return {
          key: ['Enter', 'Escape', 'Tab', 'Space'][index % 4],
          modifiers: index % 2 === 0 ? ['Ctrl'] : []
        }
        
      default:
        return { index }
    }
  }

  /**
   * 創建效能測試資料
   */
  createPerformanceTestData(size = 'medium') {
    const sizes = {
      small: { bookCount: 50, messageCount: 20, interactionCount: 30 },
      medium: { bookCount: 200, messageCount: 100, interactionCount: 150 },
      large: { bookCount: 1000, messageCount: 500, interactionCount: 800 }
    }
    
    const config = sizes[size] || sizes.medium
    
    return {
      books: this.createBookDataSet(config.bookCount, 'mixed'),
      messages: this.createChromeMessages(config.messageCount),
      interactions: this.createUserInteractionSequence(config.interactionCount),
      errors: this.createErrorScenarios(Math.floor(config.messageCount * 0.1))
    }
  }

  /**
   * 創建Readmoo頁面模擬資料
   */
  createReadmooPageData(pageType = 'bookshelf') {
    switch (pageType) {
      case 'bookshelf':
        return this._createBookshelfPageData()
        
      case 'reading':
        return this._createReadingPageData()
        
      case 'search':
        return this._createSearchPageData()
        
      default:
        return this._createBookshelfPageData()
    }
  }

  /**
   * 創建書架頁面資料
   */
  _createBookshelfPageData() {
    return {
      pageType: 'bookshelf',
      url: 'https://readmoo.com/library',
      books: this.createBookDataSet(20, 'mixed'),
      pagination: {
        currentPage: 1,
        totalPages: 5,
        hasNext: true,
        hasPrev: false
      },
      filters: {
        category: 'all',
        status: 'all',
        sortBy: 'lastRead'
      }
    }
  }

  /**
   * 創建閱讀頁面資料
   */
  _createReadingPageData() {
    return {
      pageType: 'reading',
      url: 'https://readmoo.com/read/book-001',
      currentBook: this.createBookDataSet(1, 'reading')[0],
      readingProgress: {
        currentChapter: 5,
        totalChapters: 20,
        currentPage: 125,
        totalPages: 300,
        readingTime: 1200, // seconds
        wordsPerMinute: 250
      }
    }
  }

  /**
   * 創建搜尋頁面資料
   */
  _createSearchPageData() {
    return {
      pageType: 'search',
      url: 'https://readmoo.com/search?q=history',
      searchQuery: 'history',
      results: this.createBookDataSet(15, 'new'),
      searchStats: {
        totalResults: 150,
        searchTime: 0.25,
        suggestions: ['historical fiction', 'world history', 'chinese history']
      }
    }
  }

  /**
   * 重置工廠狀態
   */
  reset() {
    // 重新初始化種子和模板
    this._initializeSeeds()
    this._initializeTemplates()
  }

  /**
   * 設定自訂種子資料
   */
  setCustomSeeds(customSeeds) {
    this.seeds = { ...this.seeds, ...customSeeds }
  }

  /**
   * 獲取工廠統計資訊
   */
  getFactoryStats() {
    return {
      availableBookTitles: this.seeds.bookTitles.length,
      availableAuthors: this.seeds.authors.length,
      availablePublishers: this.seeds.publishers.length,
      availableCategories: this.seeds.categories.length,
      templates: Object.keys(this.templates)
    }
  }
}

module.exports = TestDataFactory