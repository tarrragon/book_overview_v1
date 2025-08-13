/**
 * Platform Detection Service 模擬物件
 * 提供平台檢測測試所需的模擬資料和工具函數
 *
 * Responsible for:
 * - 平台檢測相關的模擬資料
 * - DOM 元素模擬工具
 * - 測試場景建構器
 * - 檢測結果驗證器
 *
 * Design considerations:
 * - 涵蓋所有支援的平台類型
 * - 提供真實的測試資料
 * - 支援動態場景生成
 * - 便於測試案例維護
 *
 * Usage context:
 * - Platform Detection Service 單元測試
 * - 整合測試場景準備
 * - 效能基準測試資料
 */

/**
 * 平台 URL 模式測試資料
 * 包含各平台的典型 URL 範例
 */
const PLATFORM_URL_PATTERNS = {
  READMOO: {
    valid: [
      'https://readmoo.com/library',
      'https://www.readmoo.com/library',
      'https://readmoo.com/book/210285252000101',
      'https://readmoo.com/explore/category/fiction',
      'https://readmoo.com/member/favorites',
      'https://readmoo.com/search?q=小說',
      'https://readmoo.com/kf/library' // Readmoo for Kids
    ],
    invalid: [
      'https://readmoo.com/', // 首頁，非功能頁面
      'https://readmoo.com/about',
      'https://readmoo.com/contact'
    ]
  },
  
  KINDLE: {
    valid: [
      'https://read.amazon.com/library',
      'https://read.amazon.com/notebook',
      'https://kindle.amazon.com/library',
      'https://www.amazon.com/mn/dcw/myx.html',
      'https://read.amazon.com/kp/notebook',
      'https://read.amazon.com/?action=library'
    ],
    invalid: [
      'https://amazon.com/',
      'https://www.amazon.com/books'
    ]
  },
  
  KOBO: {
    valid: [
      'https://www.kobo.com/library',
      'https://kobo.com/library',
      'https://www.kobo.com/ebooks',
      'https://www.kobo.com/collections',
      'https://www.kobo.com/wishlist'
    ],
    invalid: [
      'https://kobo.com/',
      'https://www.kobo.com/about'
    ]
  },
  
  BOOKWALKER: {
    valid: [
      'https://global.bookwalker.jp/library',
      'https://bookwalker.jp/library',
      'https://global.bookwalker.jp/series',
      'https://bookwalker.jp/de/library'
    ],
    invalid: [
      'https://bookwalker.jp/',
      'https://global.bookwalker.jp/about'
    ]
  },
  
  BOOKS_COM: {
    valid: [
      'https://www.books.com.tw/products',
      'https://member.books.com.tw/library',
      'https://www.books.com.tw/web/sys_serialtext/books/',
      'https://member.books.com.tw/user/index/VipBooks'
    ],
    invalid: [
      'https://www.books.com.tw/',
      'https://www.books.com.tw/about'
    ]
  }
}

/**
 * DOM 元素特徵模擬資料
 * 包含各平台的典型 DOM 結構特徵
 */
const DOM_FEATURES = {
  READMOO: {
    selectors: [
      '.library-book',
      '.readmoo-header',
      '.book-shelf',
      '.rm-library-item',
      '.readmoo-navigation',
      '[data-book-id]',
      '.book-cover-wrapper',
      '.library-grid-view',
      '.reading-progress',
      '.readmoo-sidebar'
    ],
    attributes: [
      'data-book-id',
      'data-readmoo',
      'data-rm-book',
      'rm-book-item',
      'readmoo-element'
    ],
    textContent: [
      '讀墨',
      'Readmoo',
      '我的書庫',
      '電子書',
      '閱讀進度',
      '書籍管理',
      '讀書筆記',
      '我的收藏'
    ],
    metaTags: [
      { name: 'application-name', content: 'Readmoo' },
      { property: 'og:site_name', content: 'Readmoo 讀墨電子書' }
    ]
  },

  KINDLE: {
    selectors: [
      '.library-item',
      '.kindle-header',
      '#library',
      '.kfx-reading-header',
      '.library-book-item',
      '[data-asin]',
      '.book-main-details',
      '.kfx-toolbar-container'
    ],
    attributes: [
      'data-asin',
      'data-kindle',
      'kindle-book',
      'amazon-book-id'
    ],
    textContent: [
      'Kindle',
      'Amazon',
      'Your Library',
      'My Books',
      'Reading Progress',
      'Kindle Store',
      'Whispersync'
    ],
    metaTags: [
      { name: 'application-name', content: 'Kindle' },
      { property: 'og:site_name', content: 'Amazon Kindle' }
    ]
  },

  KOBO: {
    selectors: [
      '.kobo-book',
      '.library-book',
      '.kobo-header',
      '.reading-life-header',
      '[data-kobo-id]',
      '.book-item-wrapper',
      '.library-shelf'
    ],
    attributes: [
      'data-kobo-id',
      'data-book-isbn',
      'kobo-element'
    ],
    textContent: [
      'Kobo',
      'My Books',
      'Reading Life',
      'Library',
      'Collections',
      'Wishlist'
    ],
    metaTags: [
      { name: 'application-name', content: 'Kobo' },
      { property: 'og:site_name', content: 'Kobo Books' }
    ]
  },

  BOOKWALKER: {
    selectors: [
      '.bw-library-item',
      '.bookwalker-header',
      '.library-content',
      '[data-content-id]',
      '.volume-item',
      '.series-item'
    ],
    attributes: [
      'data-content-id',
      'data-series-id',
      'bw-book-item'
    ],
    textContent: [
      'BookWalker',
      'ライブラリ',
      'Library',
      'マイライブラリ',
      'シリーズ',
      'Series'
    ],
    metaTags: [
      { name: 'application-name', content: 'BookWalker' }
    ]
  },

  BOOKS_COM: {
    selectors: [
      '.book-item',
      '.books-header',
      '.member-library',
      '.vip-books',
      '[data-book-isbn]'
    ],
    attributes: [
      'data-book-isbn',
      'data-product-id',
      'books-com-item'
    ],
    textContent: [
      '博客來',
      'books.com.tw',
      '會員中心',
      'VIP電子書',
      '我的書庫',
      '數位內容'
    ],
    metaTags: [
      { name: 'application-name', content: '博客來' }
    ]
  }
}

/**
 * 建立模擬 DOM 文檔
 * @param {string} platformId - 平台標識符
 * @param {Object} options - 自訂選項
 * @returns {Object} 模擬的 DOM 物件
 */
function createMockDOM(platformId, options = {}) {
  const features = DOM_FEATURES[platformId] || {}
  const foundSelectors = new Set()
  const foundElements = new Map()

  // 模擬 querySelector 方法
  const querySelector = jest.fn((selector) => {
    if (features.selectors && features.selectors.includes(selector)) {
      foundSelectors.add(selector)
      const element = {
        textContent: `Mock ${selector} element`,
        getAttribute: jest.fn((attr) => {
          if (features.attributes && features.attributes.includes(attr)) {
            return `mock-${attr}-value`
          }
          return null
        }),
        hasAttribute: jest.fn((attr) => {
          return features.attributes && features.attributes.includes(attr)
        })
      }
      foundElements.set(selector, element)
      return element
    }
    return null
  })

  // 模擬 querySelectorAll 方法
  const querySelectorAll = jest.fn((selector) => {
    if (features.selectors && features.selectors.includes(selector)) {
      foundSelectors.add(selector)
      const elements = Array.from({ length: 3 }, (_, i) => ({
        textContent: `Mock ${selector} element ${i + 1}`,
        getAttribute: jest.fn((attr) => `mock-${attr}-value-${i + 1}`),
        hasAttribute: jest.fn((attr) => features.attributes && features.attributes.includes(attr))
      }))
      return elements
    }
    return []
  })

  // 建構頁面文字內容
  const textContent = features.textContent 
    ? features.textContent.slice(0, 3).join(' ') + ' Sample Page Content'
    : 'Generic Page Content'

  // 模擬 meta 標籤查詢
  const getMetaTags = jest.fn(() => {
    return features.metaTags || []
  })

  return {
    querySelector,
    querySelectorAll,
    documentElement: {
      innerHTML: `<html><body>Mock ${platformId} page</body></html>`,
      textContent,
      outerHTML: `<html lang="en"><head><title>Mock ${platformId}</title></head><body>Content</body></html>`
    },
    head: {
      querySelector: jest.fn((selector) => {
        if (selector.includes('meta') && features.metaTags) {
          return features.metaTags[0] ? { content: features.metaTags[0].content } : null
        }
        return null
      }),
      querySelectorAll: jest.fn(() => features.metaTags || [])
    },
    readyState: options.readyState || 'complete',
    location: {
      href: options.url || `https://mock-${platformId.toLowerCase()}.com`,
      hostname: options.hostname || `mock-${platformId.toLowerCase()}.com`
    },
    title: `Mock ${platformId} Page`,

    // 測試用輔助方法
    _getFoundSelectors: () => Array.from(foundSelectors),
    _getFoundElements: () => foundElements,
    _addSelector: (selector) => {
      if (!features.selectors) features.selectors = []
      features.selectors.push(selector)
    }
  }
}

/**
 * 建立檢測上下文
 * @param {string} platformId - 平台標識符
 * @param {Object} customOptions - 自訂選項
 * @returns {Object} 檢測上下文物件
 */
function createDetectionContext(platformId, customOptions = {}) {
  const urls = PLATFORM_URL_PATTERNS[platformId]?.valid || []
  const url = customOptions.url || urls[0] || `https://mock-${platformId.toLowerCase()}.com`
  
  let hostname
  try {
    hostname = new URL(url).hostname
  } catch (error) {
    hostname = `mock-${platformId.toLowerCase()}.com`
  }

  const dom = createMockDOM(platformId, { url, hostname, ...customOptions })

  return {
    url,
    hostname,
    DOM: dom,
    userAgent: customOptions.userAgent || 'Mozilla/5.0 (Chrome Extension Test)',
    timestamp: new Date(),
    ...customOptions
  }
}

/**
 * 檢測結果驗證器
 * @param {Object} result - 檢測結果
 * @param {string} expectedPlatform - 期望的平台
 * @returns {Object} 驗證結果
 */
function validateDetectionResult(result, expectedPlatform = null) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  }

  // 檢查基本結構
  const requiredFields = ['platformId', 'confidence', 'features', 'capabilities', 'metadata']
  requiredFields.forEach(field => {
    if (!(field in result)) {
      validation.isValid = false
      validation.errors.push(`Missing required field: ${field}`)
    }
  })

  // 檢查資料型別
  if (typeof result.platformId !== 'string') {
    validation.isValid = false
    validation.errors.push('platformId must be a string')
  }

  if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
    validation.isValid = false
    validation.errors.push('confidence must be a number between 0 and 1')
  }

  if (!Array.isArray(result.features)) {
    validation.isValid = false
    validation.errors.push('features must be an array')
  }

  if (!Array.isArray(result.capabilities)) {
    validation.isValid = false
    validation.errors.push('capabilities must be an array')
  }

  if (typeof result.metadata !== 'object' || result.metadata === null) {
    validation.isValid = false
    validation.errors.push('metadata must be an object')
  }

  // 檢查期望平台
  if (expectedPlatform && result.platformId !== expectedPlatform) {
    validation.warnings.push(`Expected platform ${expectedPlatform}, got ${result.platformId}`)
  }

  // 檢查信心度合理性
  if (result.platformId !== 'UNKNOWN' && result.confidence < 0.5) {
    validation.warnings.push('Low confidence for identified platform')
  }

  if (result.platformId === 'UNKNOWN' && result.confidence > 0.7) {
    validation.warnings.push('High confidence for unknown platform')
  }

  return validation
}

/**
 * 效能測試輔助工具
 */
const performanceHelpers = {
  /**
   * 測量檢測效能
   * @param {Function} detectionFunction - 檢測函數
   * @param {Object} context - 檢測上下文
   * @returns {Promise<Object>} 效能測試結果
   */
  async measureDetectionPerformance(detectionFunction, context) {
    const startTime = process.hrtime.bigint()
    const memBefore = process.memoryUsage()
    
    let result, error
    try {
      result = await detectionFunction(context)
    } catch (err) {
      error = err
    }
    
    const endTime = process.hrtime.bigint()
    const memAfter = process.memoryUsage()
    
    const duration = Number(endTime - startTime) / 1000000 // 轉換為毫秒
    const memoryDiff = {
      heapUsed: memAfter.heapUsed - memBefore.heapUsed,
      heapTotal: memAfter.heapTotal - memBefore.heapTotal,
      external: memAfter.external - memBefore.external
    }
    
    return {
      duration,
      memoryDiff,
      result,
      error,
      success: !error
    }
  },

  /**
   * 批量效能測試
   * @param {Function} detectionFunction - 檢測函數
   * @param {Array} contexts - 檢測上下文陣列
   * @returns {Promise<Object>} 批量效能測試結果
   */
  async measureBatchPerformance(detectionFunction, contexts) {
    const results = []
    const startTime = Date.now()
    
    for (const context of contexts) {
      const perf = await this.measureDetectionPerformance(detectionFunction, context)
      results.push(perf)
    }
    
    const totalTime = Date.now() - startTime
    const successful = results.filter(r => r.success).length
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length
    
    return {
      totalTime,
      averageDuration: avgDuration,
      totalTests: contexts.length,
      successfulTests: successful,
      successRate: successful / contexts.length,
      results
    }
  }
}

/**
 * 測試場景建構器
 */
const scenarioBuilder = {
  /**
   * 建立多平台檢測場景
   * @param {Array} platforms - 平台陣列
   * @returns {Array} 檢測場景陣列
   */
  createMultiPlatformScenarios(platforms = ['READMOO', 'KINDLE', 'KOBO']) {
    const scenarios = []
    
    platforms.forEach(platform => {
      const urls = PLATFORM_URL_PATTERNS[platform]?.valid || []
      urls.forEach(url => {
        scenarios.push({
          name: `${platform} - ${url}`,
          context: createDetectionContext(platform, { url }),
          expectedPlatform: platform
        })
      })
    })
    
    return scenarios
  },

  /**
   * 建立錯誤處理場景
   * @returns {Array} 錯誤場景陣列
   */
  createErrorScenarios() {
    return [
      {
        name: 'Null context',
        context: null,
        expectedError: 'Invalid detection context'
      },
      {
        name: 'Empty context',
        context: {},
        expectedError: 'Invalid detection context'
      },
      {
        name: 'Invalid URL',
        context: { url: 'not-a-url', hostname: '' },
        expectedError: null // 應該優雅處理
      },
      {
        name: 'Missing DOM',
        context: { url: 'https://readmoo.com/library', hostname: 'readmoo.com' },
        expectedError: null // DOM 是選用的
      }
    ]
  },

  /**
   * 建立邊界測試場景
   * @returns {Array} 邊界測試場景陣列
   */
  createBoundaryScenarios() {
    return [
      {
        name: 'Empty DOM',
        context: createDetectionContext('READMOO', {
          dom: {
            querySelector: () => null,
            querySelectorAll: () => [],
            documentElement: { textContent: '' }
          }
        }),
        expectedPlatform: 'UNKNOWN'
      },
      {
        name: 'Partial features',
        context: createDetectionContext('READMOO', {
          partialFeatures: true
        }),
        expectedPlatform: 'READMOO' // 應該仍能檢測到
      }
    ]
  }
}

module.exports = {
  PLATFORM_URL_PATTERNS,
  DOM_FEATURES,
  createMockDOM,
  createDetectionContext,
  validateDetectionResult,
  performanceHelpers,
  scenarioBuilder
}