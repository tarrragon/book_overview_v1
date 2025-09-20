/* eslint-disable no-console */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')
/**
 * Readmoo Page Simulator
 * 模擬真實的Readmoo書庫頁面環境，支援動態內容和使用者互動
 *
 * 主要功能：
 * - 真實DOM結構生成
 * - 書籍元素完整屬性設定
 * - 使用者互動事件模擬
 * - 頁面狀態動態變更
 *
 * @author TDD Phase 2 - sage-test-architect
 * @date 2025-08-25
 * @version v0.9.38
 */

class ReadmooPageSimulator {
  constructor () {
    this.mockDocument = null
    this.bookElements = []
    this.pageState = {
      loaded: false,
      bookCount: 0,
      userInteractions: []
    }
    this.domStructure = {
      selectors: {
        shelfContainer: '.shelf-container',
        bookItem: '.book-item',
        bookTitle: '.book-title',
        bookCover: '.book-cover img',
        readingProgress: '.reading-progress',
        bookAuthor: '.book-author',
        bookStatus: '.book-status'
      }
    }
  }

  /**
   * 建立模擬的書庫頁面DOM
   * @param {BookCollection} books - 要模擬的書籍集合
   * @returns {Document} 模擬的頁面DOM
   */
  createMockShelfPage (books = []) {
    try {
      // 基於真實Readmoo DOM結構創建模擬頁面
      this.mockDocument = this.generateRealisticDOMStructure(books)

      // 設定書籍元素的完整屬性和資料
      this.setupBookElementsWithCompleteData(books)

      // 支援動態載入和互動式元素
      this.enableDynamicBehaviorSimulation()

      // 更新頁面狀態
      this.pageState.loaded = true
      this.pageState.bookCount = books.length
      this.bookElements = books

      return this.mockDocument
    } catch (error) {
      throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
    }
  }

  /**
   * 生成真實的DOM結構
   * @param {Array} books - 書籍資料
   * @returns {Object} 模擬的Document物件
   * @private
   */
  generateRealisticDOMStructure (books) {
    // 創建基本的DOM結構模擬
    const mockDoc = this.createBaseMockDocument()

    // 創建主要容器
    const shelfContainer = this.createElement('div', {
      className: 'shelf-container',
      id: 'shelf-container'
    })

    // 創建頁面標題
    const pageTitle = this.createElement('h1', {
      className: 'page-title',
      textContent: '我的書庫'
    })

    // 創建書籍網格容器
    const bookGrid = this.createElement('div', {
      className: 'book-grid',
      id: 'book-grid'
    })

    // 生成書籍元素
    books.forEach((book, index) => {
      const bookElement = this.createBookElement(book, index)
      bookGrid.appendChild(bookElement)
    })

    // 組裝DOM結構
    shelfContainer.appendChild(pageTitle)
    shelfContainer.appendChild(bookGrid)
    mockDoc.body.appendChild(shelfContainer)

    return mockDoc
  }

  /**
   * 創建基礎的Mock Document物件
   * @returns {Object} Mock Document
   * @private
   */
  createBaseMockDocument () {
    const elements = new Map()
    let elementIdCounter = 1

    const mockDoc = {
      body: this.createElement('body', { id: 'mock-body' }),
      head: this.createElement('head', { id: 'mock-head' }),
      documentElement: null,

      getElementById: (id) => {
        for (const [, element] of elements) {
          if (element.id === id) {
            return element
          }
        }
        return null
      },

      querySelector: (selector) => {
        // 簡化的選擇器查詢
        if (selector.startsWith('#')) {
          return mockDoc.getElementById(selector.substring(1))
        }

        if (selector.startsWith('.')) {
          const className = selector.substring(1)
          for (const [, element] of elements) {
            if (element.className && element.className.includes(className)) {
              return element
            }
          }
        }

        return null
      },

      querySelectorAll: (selector) => {
        const results = []

        if (selector.startsWith('.')) {
          const className = selector.substring(1)
          for (const [, element] of elements) {
            if (element.className && element.className.includes(className)) {
              results.push(element)
            }
          }
        }

        return results
      },

      createElement: (tagName) => {
        return this.createElement(tagName, { id: `element-${elementIdCounter++}` })
      },

      addEventListener: (event, handler) => {
        // 模擬事件監聽器
      },

      removeEventListener: (event, handler) => {
        // 模擬事件監聽器移除
      },

      _addElement: (element) => {
        elements.set(element.id || `element-${elementIdCounter++}`, element)
      }
    }

    mockDoc.documentElement = mockDoc.body
    return mockDoc
  }

  /**
   * 創建元素輔助方法
   * @param {string} tagName - 標籤名稱
   * @param {Object} properties - 元素屬性
   * @returns {Object} 模擬元素
   * @private
   */
  createElement (tagName, properties = {}) {
    const element = {
      tagName: tagName.toUpperCase(),
      nodeName: tagName.toUpperCase(),
      nodeType: 1,
      children: [],
      childNodes: [],
      parentNode: null,
      style: {},
      dataset: {},
      ...properties,

      appendChild: (child) => {
        child.parentNode = element
        element.children.push(child)
        element.childNodes.push(child)

        // 如果有mockDocument，將元素加入追蹤
        if (this.mockDocument && this.mockDocument._addElement) {
          this.mockDocument._addElement(child)
        }

        return child
      },

      removeChild: (child) => {
        const index = element.children.indexOf(child)
        if (index > -1) {
          element.children.splice(index, 1)
          element.childNodes.splice(index, 1)
          child.parentNode = null
        }
        return child
      },

      querySelector: (selector) => {
        // 在子元素中查詢
        for (const child of element.children) {
          if (this.matchesSelector(child, selector)) {
            return child
          }
          if (child.querySelector) {
            const result = child.querySelector(selector)
            if (result) return result
          }
        }
        return null
      },

      querySelectorAll: (selector) => {
        const results = []
        for (const child of element.children) {
          if (this.matchesSelector(child, selector)) {
            results.push(child)
          }
          if (child.querySelectorAll) {
            results.push(...child.querySelectorAll(selector))
          }
        }
        return results
      },

      getAttribute: (name) => {
        return element[name] || element.dataset[name] || null
      },

      setAttribute: (name, value) => {
        if (name.startsWith('data-')) {
          element.dataset[name.substring(5)] = value
        } else {
          element[name] = value
        }
      },

      addEventListener: (event, handler) => {
        if (!element._eventListeners) {
          element._eventListeners = {}
        }
        if (!element._eventListeners[event]) {
          element._eventListeners[event] = []
        }
        element._eventListeners[event].push(handler)
      },

      removeEventListener: (event, handler) => {
        if (element._eventListeners && element._eventListeners[event]) {
          const index = element._eventListeners[event].indexOf(handler)
          if (index > -1) {
            element._eventListeners[event].splice(index, 1)
          }
        }
      }
    }

    return element
  }

  /**
   * 檢查元素是否符合選擇器
   * @param {Object} element - 元素
   * @param {string} selector - 選擇器
   * @returns {boolean} 是否符合
   * @private
   */
  matchesSelector (element, selector) {
    if (selector.startsWith('#')) {
      return element.id === selector.substring(1)
    }
    if (selector.startsWith('.')) {
      const className = selector.substring(1)
      return element.className && element.className.includes(className)
    }
    return element.tagName === selector.toUpperCase()
  }

  /**
   * 創建書籍元素
   * @param {Object} book - 書籍資料
   * @param {number} index - 索引
   * @returns {Object} 書籍元素
   * @private
   */
  createBookElement (book, index) {
    const bookItem = this.createElement('div', {
      className: 'book-item',
      id: `book-${index}`,
      'data-book-id': book.id || `book-${index}`
    })

    // 書籍封面
    const coverContainer = this.createElement('div', {
      className: 'book-cover'
    })
    const coverImg = this.createElement('img', {
      className: 'cover-image',
      src: book.cover || `https://example.com/cover-${index}.jpg`,
      alt: `${book.title} 封面`
    })
    coverContainer.appendChild(coverImg)

    // 書籍標題
    const titleElement = this.createElement('h3', {
      className: 'book-title',
      textContent: book.title || `測試書籍 ${index + 1}`
    })

    // 作者
    const authorElement = this.createElement('p', {
      className: 'book-author',
      textContent: book.author || `作者 ${index + 1}`
    })

    // 閱讀進度
    const progressContainer = this.createElement('div', {
      className: 'reading-progress'
    })
    const progressBar = this.createElement('div', {
      className: 'progress-bar',
      style: { width: `${book.progress || 0}%` }
    })
    const progressText = this.createElement('span', {
      className: 'progress-text',
      textContent: `${book.progress || 0}%`
    })
    progressContainer.appendChild(progressBar)
    progressContainer.appendChild(progressText)

    // 狀態標籤
    const statusElement = this.createElement('div', {
      className: 'book-status',
      textContent: book.status || '未開始'
    })

    // 組裝書籍元素
    bookItem.appendChild(coverContainer)
    bookItem.appendChild(titleElement)
    bookItem.appendChild(authorElement)
    bookItem.appendChild(progressContainer)
    bookItem.appendChild(statusElement)

    return bookItem
  }

  /**
   * 設定書籍元素的完整屬性和資料
   * @param {Array} books - 書籍資料集合
   * @private
   */
  setupBookElementsWithCompleteData (books) {
    books.forEach((book, index) => {
      // 確保每本書都有完整的資料結構
      const completeBook = {
        id: book.id || `stable-book-id-${index + 1}`,
        title: book.title || `預設標題 ${index + 1}`,
        author: book.author || `預設作者 ${index + 1}`,
        cover: book.cover || `https://example.com/default-cover-${index + 1}.jpg`,
        progress: typeof book.progress === 'number' ? book.progress : Math.floor(Math.random() * 100),
        status: book.status || (book.progress > 0 ? '閱讀中' : '未開始'),
        isbn: book.isbn || `978-986-${String(index + 1).padStart(7, '0')}`,
        publisher: book.publisher || '預設出版社',
        publishDate: book.publishDate || '2023-01-01',
        category: book.category || '一般書籍',
        description: book.description || `這是書籍 ${index + 1} 的描述`,
        // 特殊情況處理
        hasSpecialChars: /[^\u0000-\u007F]/.test(book.title || ''),
        hasEmoji: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(book.title || ''),
        isLongTitle: (book.title || '').length > 50
      }

      this.bookElements[index] = completeBook
    })
  }

  /**
   * 支援動態載入和互動式元素
   * @private
   */
  enableDynamicBehaviorSimulation () {
    // 模擬動態載入行為
    this.setupDynamicLoading()

    // 模擬使用者互動響應
    this.setupInteractionHandlers()

    // 模擬頁面狀態變更
    this.setupStateChangeHandlers()
  }

  /**
   * 設定動態載入模擬
   * @private
   */
  setupDynamicLoading () {
    // 模擬AJAX載入新書籍的行為
    this.dynamicLoader = {
      loading: false,
      loadMoreBooks: (count = 10) => {
        return new Promise(resolve => {
          this.dynamicLoader.loading = true
          setTimeout(() => {
            const newBooks = this.generateMoreBooks(count)
            this.addBooksToPage(newBooks)
            this.dynamicLoader.loading = false
            resolve(newBooks)
          }, 1000) // 模擬載入時間
        })
      }
    }
  }

  /**
   * 生成更多書籍資料
   * @param {number} count - 要生成的書籍數量
   * @returns {Array} 新書籍資料
   * @private
   */
  generateMoreBooks (count) {
    const newBooks = []
    const currentCount = this.bookElements.length

    for (let i = 0; i < count; i++) {
      newBooks.push({
        id: `dynamic-book-${currentCount + i + 1}`,
        title: `動態載入書籍 ${currentCount + i + 1}`,
        author: `動態作者 ${currentCount + i + 1}`,
        progress: Math.floor(Math.random() * 100)
      })
    }

    return newBooks
  }

  /**
   * 新增書籍到頁面
   * @param {Array} books - 要新增的書籍
   * @private
   */
  addBooksToPage (books) {
    if (!this.mockDocument) return

    const bookGrid = this.mockDocument.querySelector('.book-grid')
    if (bookGrid) {
      books.forEach((book, index) => {
        const bookElement = this.createBookElement(book, this.bookElements.length + index)
        bookGrid.appendChild(bookElement)
      })

      this.bookElements.push(...books)
      this.pageState.bookCount += books.length
    }
  }

  /**
   * 設定互動處理器
   * @private
   */
  setupInteractionHandlers () {
    this.interactionHandlers = {
      click: new Map(),
      hover: new Map(),
      scroll: new Map()
    }
  }

  /**
   * 設定狀態變更處理器
   * @private
   */
  setupStateChangeHandlers () {
    this.stateChangeHandlers = {
      onBookAdded: [],
      onBookRemoved: [],
      onProgressUpdated: []
    }
  }

  /**
   * 模擬使用者互動事件
   * @param {string} action - 互動類型
   * @param {Object} target - 目標元素
   */
  simulateUserInteraction (action, target) {
    try {
      // 模擬真實使用者行為模式
      this.generateRealisticUserInteractionEvents(action, target)

      // 記錄使用者行為軌跡供分析
      this.trackUserBehaviorForAnalysis(action, target)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('User interaction simulation failed:', error.message)
    }
  }

  /**
   * 生成真實使用者互動事件
   * @param {string} action - 動作類型
   * @param {Object} target - 目標
   * @private
   */
  generateRealisticUserInteractionEvents (action, target) {
    const interaction = {
      action,
      target: typeof target === 'string' ? target : target.id || 'unknown',
      timestamp: Date.now(),
      realistic: true
    }

    switch (action) {
      case 'click':
        this.simulateClickEvent(target)
        break
      case 'hover':
        this.simulateHoverEvent(target)
        break
      case 'scroll':
        this.simulateScrollEvent(target)
        break
      case 'keydown':
        this.simulateKeyboardEvent(target)
        break
    }

    this.pageState.userInteractions.push(interaction)
  }

  /**
   * 模擬點擊事件
   * @param {Object} target - 目標元素
   * @private
   */
  simulateClickEvent (target) {
    if (target && target._eventListeners && target._eventListeners.click) {
      target._eventListeners.click.forEach(handler => {
        try {
          handler({
            type: 'click',
            target,
            currentTarget: target,
            preventDefault: () => {},
            stopPropagation: () => {}
          })
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Click handler error:', error)
        }
      })
    }
  }

  /**
   * 模擬懸停事件
   * @param {Object} target - 目標元素
   * @private
   */
  simulateHoverEvent (target) {
    if (target && target._eventListeners) {
      if (target._eventListeners.mouseenter) {
        target._eventListeners.mouseenter.forEach(handler => {
          try { handler({ type: 'mouseenter', target }) } catch (e) {}
        })
      }
    }
  }

  /**
   * 模擬滾動事件
   * @param {Object} target - 目標元素
   * @private
   */
  simulateScrollEvent (target) {
    // 模擬滾動載入更多內容
    if (this.dynamicLoader && !this.dynamicLoader.loading) {
      // 觸發動態載入
      setTimeout(() => {
        this.dynamicLoader.loadMoreBooks(5)
      }, 100)
    }
  }

  /**
   * 模擬鍵盤事件
   * @param {Object} target - 目標元素
   * @private
   */
  simulateKeyboardEvent (target) {
    // 模擬鍵盤操作，如搜尋
    if (target && target._eventListeners && target._eventListeners.keydown) {
      target._eventListeners.keydown.forEach(handler => {
        try {
          handler({
            type: 'keydown',
            target,
            key: 'Enter',
            keyCode: 13
          })
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Keyboard handler error:', error)
        }
      })
    }
  }

  /**
   * 記錄使用者行為軌跡
   * @param {string} action - 動作
   * @param {Object} target - 目標
   * @private
   */
  trackUserBehaviorForAnalysis (action, target) {
    const behaviorData = {
      action,
      targetId: typeof target === 'string' ? target : target.id,
      timestamp: Date.now(),
      pageState: { ...this.pageState },
      sessionData: {
        totalInteractions: this.pageState.userInteractions.length,
        timeOnPage: Date.now() - (this.pageState.sessionStart || Date.now())
      }
    }

    // 在實際應用中，這裡會發送到分析服務
    // eslint-disable-next-line no-console
    console.log('User behavior tracked:', behaviorData)
  }

  /**
   * 動態修改頁面內容
   * @param {PageModification} modification - 頁面修改指令
   */
  modifyPageContent (modification) {
    try {
      switch (modification.type) {
        case 'addBooks':
          this.addBooksToPage(modification.books)
          break
        case 'removeBooks':
          this.removeBooksFromPage(modification.bookIds)
          break
        case 'updateProgress':
          this.updateBookProgress(modification.bookId, modification.progress)
          break
        case 'changeStructure':
          this.modifyDOMStructure(modification)
          break
      }
    } catch (error) {
      throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
    }
  }

  /**
   * 修改DOM結構 (用於測試適應性)
   * @param {Object} modification - 修改配置
   */
  modifyDOMStructure (modification) {
    if (!this.mockDocument) return

    switch (modification.changeType) {
      case 'selectorModification':
        this.modifySelectors(modification.affectedElements)
        break
      case 'elementRemoval':
        this.removeElements(modification.elementsToRemove)
        break
      case 'structureReorganization':
        this.reorganizeStructure(modification.newStructure)
        break
    }
  }

  /**
   * 修改選擇器 (測試DOM變更適應性)
   * @param {Array} affectedElements - 受影響的元素
   * @private
   */
  modifySelectors (affectedElements) {
    affectedElements.forEach(elementType => {
      const oldSelector = this.domStructure.selectors[elementType]
      let newSelector

      switch (elementType) {
        case 'bookTitle':
          newSelector = '.book-title-new'
          break
        case 'bookCover':
          newSelector = '.book-cover-img-new'
          break
        case 'readingProgress':
          newSelector = '.progress-bar-new'
          break
      }

      if (newSelector) {
        // 更新所有相關元素的className
        const elements = this.mockDocument.querySelectorAll(oldSelector)
        elements.forEach(element => {
          element.className = element.className.replace(
            oldSelector.substring(1),
            newSelector.substring(1)
          )
        })

        // 更新選擇器記錄
        this.domStructure.selectors[elementType] = newSelector
      }
    })
  }

  /**
   * 創建空書庫頁面
   */
  createEmptyShelfPage () {
    this.createMockShelfPage([])
  }

  /**
   * 獲取書籍數量
   * @returns {number} 書籍數量
   */
  getBookCount () {
    return this.pageState.bookCount
  }

  /**
   * 獲取頁面狀態
   * @returns {Object} 頁面狀態
   */
  getPageState () {
    return { ...this.pageState }
  }

  /**
   * 清理模擬器
   */
  cleanup () {
    this.mockDocument = null
    this.bookElements = []
    this.pageState = {
      loaded: false,
      bookCount: 0,
      userInteractions: []
    }

    if (this.dynamicLoader) {
      this.dynamicLoader.loading = false
    }
  }
}

module.exports = ReadmooPageSimulator
