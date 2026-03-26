const { ErrorCodesWithTest: ErrorCodes } = require('@tests/helpers/test-error-codes')
/**
 * @fileoverview DOM Utils TDD 測試
 * @version v1.0.0
 * @since 2025-08-16
 *
 * TDD Red 階段：設計 dom-utils.js 的完整測試套件
 *
 * 測試目標：
 * - 安全的 DOM 查詢和元素操作
 * - 多選擇器策略和備用方案
 * - 元素存在性和可見性檢查
 * - DOM 結構分析和資料提取
 * - Content Script 環境優化
 */

describe('DOMUtils - TDD Red 階段測試', () => {
  let DOMUtils

  beforeAll(() => {
    // 測試執行前載入模組
    DOMUtils = require('src/content/utils/dom-utils.js')
  })

  beforeEach(() => {
    // 設定測試環境
    global.console = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn()
    }

    // 建立測試用的 DOM 環境
    document.body.innerHTML = ''
  })

  describe('🔍 DOM 查詢和選擇器', () => {
    test('應該安全執行 querySelector 查詢', () => {
      document.body.innerHTML = '<div class="test-element">測試內容</div>'

      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.safeQuerySelector('.test-element')

      expect(result.success).toBe(true)
      expect(result.element).toBeTruthy()
      expect(result.element.textContent).toBe('測試內容')
    })

    test('應該處理查詢失敗的情況', () => {
      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.safeQuerySelector('.non-existent')

      expect(result.success).toBe(false)
      expect(result.element).toBe(null)
      expect(result.error).toBeDefined()
    })

    test('應該支援 querySelectorAll 批量查詢', () => {
      document.body.innerHTML = `
        <div class="book">書籍1</div>
        <div class="book">書籍2</div>
        <div class="book">書籍3</div>
      `

      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.safeQuerySelectorAll('.book')

      expect(result.success).toBe(true)
      expect(result.elements).toHaveLength(3)
      expect(result.count).toBe(3)
    })

    test('應該支援多選擇器策略查詢', () => {
      document.body.innerHTML = '<div class="library-item">書籍容器</div>'

      // eslint-disable-next-line no-unused-vars
      const selectors = ['.book-container', '.library-item', '.book']
      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.findWithMultipleSelectors(selectors)

      expect(result.success).toBe(true)
      expect(result.element).toBeTruthy()
      expect(result.usedSelector).toBe('.library-item')
      expect(result.selectorIndex).toBe(1)
    })

    test('應該在所有選擇器都失敗時回傳適當結果', () => {
      // eslint-disable-next-line no-unused-vars
      const selectors = ['.non-existent-1', '.non-existent-2']
      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.findWithMultipleSelectors(selectors)

      expect(result.success).toBe(false)
      expect(result.element).toBe(null)
      expect(result.usedSelector).toBe(null)
      expect(result.triedSelectors).toEqual(selectors)
    })

    test('應該支援父容器查找策略', () => {
      document.body.innerHTML = `
        <div class="container">
          <a href="/read/book1">閱讀連結</a>
        </div>
      `

      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.findParentContainers('a[href*="/read/"]')

      expect(result.success).toBe(true)
      expect(result.containers).toHaveLength(1)
      expect(result.containers[0].className).toBe('container')
    })
  })

  describe('📋 元素檢查和驗證', () => {
    test('應該檢查元素是否存在', () => {
      document.body.innerHTML = '<div id="test">測試</div>'
      // eslint-disable-next-line no-unused-vars
      const element = document.getElementById('test')

      expect(DOMUtils.elementExists(element)).toBe(true)
      expect(DOMUtils.elementExists(null)).toBe(false)
      expect(DOMUtils.elementExists(undefined)).toBe(false)
    })

    test('應該檢查元素是否可見', () => {
      document.body.innerHTML = `
        <div id="visible" style="display: block;">可見元素</div>
        <div id="hidden" style="display: none;">隱藏元素</div>
      `

      // eslint-disable-next-line no-unused-vars
      const visible = document.getElementById('visible')
      // eslint-disable-next-line no-unused-vars
      const hidden = document.getElementById('hidden')

      expect(DOMUtils.isElementVisible(visible)).toBe(true)
      expect(DOMUtils.isElementVisible(hidden)).toBe(false)
    })

    test('應該檢查元素是否在視窗範圍內', () => {
      document.body.innerHTML = '<div id="test">測試元素</div>'
      // eslint-disable-next-line no-unused-vars
      const element = document.getElementById('test')

      // Mock getBoundingClientRect
      element.getBoundingClientRect = jest.fn(() => ({
        top: 100,
        left: 100,
        right: 200,
        bottom: 200,
        width: 100,
        height: 100
      }))

      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.isElementInViewport(element)
      expect(typeof result).toBe('boolean')
    })

    test('應該檢查元素是否包含必要屬性', () => {
      document.body.innerHTML = `
        <div class="book" data-book-id="123" title="測試書籍">
          <img src="cover.jpg" alt="封面">
        </div>
      `

      // eslint-disable-next-line no-unused-vars
      const element = document.querySelector('.book')
      // eslint-disable-next-line no-unused-vars
      const requiredAttrs = ['data-book-id', 'title']

      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.hasRequiredAttributes(element, requiredAttrs)

      expect(result.hasAll).toBe(true)
      expect(result.missing).toHaveLength(0)
      expect(result.found).toEqual(requiredAttrs)
    })

    test('應該檢測缺失的必要屬性', () => {
      document.body.innerHTML = '<div class="book" title="測試書籍"></div>'

      // eslint-disable-next-line no-unused-vars
      const element = document.querySelector('.book')
      // eslint-disable-next-line no-unused-vars
      const requiredAttrs = ['data-book-id', 'title', 'data-category']

      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.hasRequiredAttributes(element, requiredAttrs)

      expect(result.hasAll).toBe(false)
      expect(result.missing).toEqual(['data-book-id', 'data-category'])
      expect(result.found).toEqual(['title'])
    })
  })

  describe('📄 文字和資料提取', () => {
    test('應該安全提取元素文字內容', () => {
      document.body.innerHTML = `
        <h2 class="title">   JavaScript 程式設計   </h2>
      `

      // eslint-disable-next-line no-unused-vars
      const element = document.querySelector('.title')
      // eslint-disable-next-line no-unused-vars
      const text = DOMUtils.extractText(element)

      expect(text.success).toBe(true)
      expect(text.content).toBe('JavaScript 程式設計')
      expect(text.original).toBe('   JavaScript 程式設計   ')
      expect(text.length).toBe(15)
    })

    test('應該從多個候選元素中提取文字', () => {
      document.body.innerHTML = `
        <div class="book">
          <h3 class="title">主標題</h3>
          <p class="subtitle">副標題</p>
          <span class="fallback">備用標題</span>
        </div>
      `

      // eslint-disable-next-line no-unused-vars
      const container = document.querySelector('.book')
      // eslint-disable-next-line no-unused-vars
      const selectors = ['.main-title', '.title', '.subtitle']

      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.extractTextFromCandidates(container, selectors)

      expect(result.success).toBe(true)
      expect(result.content).toBe('主標題')
      expect(result.usedSelector).toBe('.title')
    })

    test('應該提取元素屬性值', () => {
      document.body.innerHTML = `
        <img src="https://example.com/cover.jpg" 
             alt="書籍封面" 
             data-lazy-src="lazy.jpg">
      `

      // eslint-disable-next-line no-unused-vars
      const img = document.querySelector('img')
      // eslint-disable-next-line no-unused-vars
      const attrs = ['src', 'alt', 'data-lazy-src', 'title']

      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.extractAttributes(img, attrs)

      expect(result.success).toBe(true)
      expect(result.attributes.src).toBe('https://example.com/cover.jpg')
      expect(result.attributes.alt).toBe('書籍封面')
      expect(result.attributes['data-lazy-src']).toBe('lazy.jpg')
      expect(result.attributes.title).toBe('')
      expect(result.foundCount).toBe(3)
    })

    test('應該從連結中提取 URL 和路徑', () => {
      document.body.innerHTML = `
        <a href="/read/book-123?chapter=1" class="reader-link">開始閱讀</a>
      `

      // eslint-disable-next-line no-unused-vars
      const link = document.querySelector('a')
      // eslint-disable-next-line no-unused-vars
      const urlInfo = DOMUtils.extractUrlInfo(link)

      expect(urlInfo.success).toBe(true)
      expect(urlInfo.href).toBe('/read/book-123?chapter=1')
      expect(urlInfo.pathname).toContain('/read/book-123')
      expect(urlInfo.search).toBe('?chapter=1')
      expect(urlInfo.isReaderLink).toBe(true)
    })
  })

  describe('🔧 DOM 操作和修改', () => {
    test('應該安全設定元素屬性', () => {
      document.body.innerHTML = '<div id="test"></div>'
      // eslint-disable-next-line no-unused-vars
      const element = document.getElementById('test')

      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.safeSetAttribute(element, 'data-processed', 'true')

      expect(result.success).toBe(true)
      expect(element.getAttribute('data-processed')).toBe('true')
    })

    test('應該安全添加 CSS 類別', () => {
      document.body.innerHTML = '<div id="test" class="existing"></div>'
      // eslint-disable-next-line no-unused-vars
      const element = document.getElementById('test')

      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.safeAddClass(element, 'new-class')

      expect(result.success).toBe(true)
      expect(element.classList.contains('new-class')).toBe(true)
      expect(element.classList.contains('existing')).toBe(true)
    })

    test('應該安全移除 CSS 類別', () => {
      document.body.innerHTML = '<div id="test" class="remove-me keep-me"></div>'
      // eslint-disable-next-line no-unused-vars
      const element = document.getElementById('test')

      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.safeRemoveClass(element, 'remove-me')

      expect(result.success).toBe(true)
      expect(element.classList.contains('remove-me')).toBe(false)
      expect(element.classList.contains('keep-me')).toBe(true)
    })

    test('應該建立新的 DOM 元素', () => {
      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.createElement('div', {
        className: 'test-element',
        'data-type': 'book',
        textContent: '測試內容'
      })

      expect(result.success).toBe(true)
      expect(result.element.tagName).toBe('DIV')
      expect(result.element.className).toBe('test-element')
      expect(result.element.getAttribute('data-type')).toBe('book')
      expect(result.element.textContent).toBe('測試內容')
    })

    test('應該插入元素到指定位置', () => {
      document.body.innerHTML = '<div id="container"><p>原有內容</p></div>'
      // eslint-disable-next-line no-unused-vars
      const container = document.getElementById('container')
      // eslint-disable-next-line no-unused-vars
      const newElement = document.createElement('span')
      newElement.textContent = '新內容'

      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.insertElement(container, newElement, 'beforeend')

      expect(result.success).toBe(true)
      expect(container.children).toHaveLength(2)
      expect(container.lastElementChild.textContent).toBe('新內容')
    })
  })

  describe('⚡ 效能和最佳化', () => {
    test('應該快取查詢結果', () => {
      document.body.innerHTML = '<div class="cached-element">快取測試</div>'

      // 第一次查詢
      // eslint-disable-next-line no-unused-vars
      const result1 = DOMUtils.cachedQuerySelector('.cached-element')

      // 第二次查詢應該使用快取
      // eslint-disable-next-line no-unused-vars
      const result2 = DOMUtils.cachedQuerySelector('.cached-element')

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      expect(result2.fromCache).toBe(true)
      expect(result1.element).toBe(result2.element)
    })

    test('應該支援清空快取', () => {
      document.body.innerHTML = '<div class="test">測試</div>'

      // 建立快取
      DOMUtils.cachedQuerySelector('.test')

      // 清空快取
      // eslint-disable-next-line no-unused-vars
      const clearResult = DOMUtils.clearQueryCache()

      expect(clearResult.success).toBe(true)
      expect(clearResult.clearedCount).toBeGreaterThan(0)

      // 再次查詢應該不是從快取
      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.cachedQuerySelector('.test')
      expect(result.fromCache).toBe(false)
    })

    test('應該批量處理多個元素', () => {
      document.body.innerHTML = `
        <div class="book" data-status="unprocessed">書籍1</div>
        <div class="book" data-status="unprocessed">書籍2</div>
        <div class="book" data-status="unprocessed">書籍3</div>
      `

      // eslint-disable-next-line no-unused-vars
      const elements = document.querySelectorAll('.book')
      // eslint-disable-next-line no-unused-vars
      const processor = (element) => {
        element.setAttribute('data-status', 'processed')
        return { success: true, id: element.textContent }
      }

      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.batchProcessElements(elements, processor)

      expect(result.success).toBe(true)
      expect(result.processed).toBe(3)
      expect(result.failed).toBe(0)
      expect(result.results).toHaveLength(3)

      // 驗證處理結果
      elements.forEach(el => {
        expect(el.getAttribute('data-status')).toBe('processed')
      })
    })

    test('應該處理批量處理中的錯誤', () => {
      document.body.innerHTML = `
        <div class="item">項目1</div>
        <div class="item">項目2</div>
      `

      // eslint-disable-next-line no-unused-vars
      const elements = document.querySelectorAll('.item')
      // eslint-disable-next-line no-unused-vars
      const processor = (element, index) => {
        if (index === 1) {
          throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
        }
        return { success: true, data: element.textContent }
      }

      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.batchProcessElements(elements, processor)

      expect(result.success).toBe(true)
      expect(result.processed).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toBeDefined()
    })
  })

  describe('🌐 Readmoo 特定功能', () => {
    test('應該識別書籍容器元素', () => {
      document.body.innerHTML = `
        <div class="library-item">
          <img src="cover.jpg" alt="書籍封面">
          <h3>書籍標題</h3>
          <a href="/read/123">開始閱讀</a>
        </div>
      `

      // eslint-disable-next-line no-unused-vars
      const container = document.querySelector('.library-item')
      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.isBookContainer(container)

      expect(result.isContainer).toBe(true)
      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.indicators.hasImage).toBe(true)
      expect(result.indicators.hasTitle).toBe(true)
      expect(result.indicators.hasReadLink).toBe(true)
    })

    test('應該提取書籍基本資訊', () => {
      document.body.innerHTML = `
        <div class="book-item" data-book-id="book-123">
          <img src="https://example.com/cover.jpg" alt="JavaScript 權威指南">
          <h3 class="title">JavaScript 權威指南</h3>
          <p class="author">David Flanagan</p>
          <a href="/read/book-123" class="read-link">開始閱讀</a>
          <span class="progress">已讀 30%</span>
        </div>
      `

      // eslint-disable-next-line no-unused-vars
      const container = document.querySelector('.book-item')
      // eslint-disable-next-line no-unused-vars
      const bookInfo = DOMUtils.extractBookInfo(container)

      expect(bookInfo.success).toBe(true)
      expect(bookInfo.id).toBe('book-123')
      expect(bookInfo.title).toBe('JavaScript 權威指南')
      expect(bookInfo.author).toBe('David Flanagan')
      expect(bookInfo.cover).toContain('cover.jpg')
      expect(bookInfo.readUrl).toBe('/read/book-123')
      expect(bookInfo.progress).toContain('30%')
    })

    test('應該檢測頁面載入狀態', () => {
      // Mock document.readyState
      Object.defineProperty(document, 'readyState', {
        value: 'complete',
        writable: true
      })

      // 確保 body 有內容
      document.body.innerHTML = '<div>測試內容</div>'

      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.checkPageReadiness()

      expect(result.isReady).toBe(true)
      expect(result.readyState).toBe('complete')
      expect(result.hasContent).toBe(true)
    })

    test('應該等待動態內容載入', async () => {
      document.body.innerHTML = '<div id="loading">載入中...</div>'

      // 模擬動態內容載入
      setTimeout(() => {
        document.body.innerHTML = '<div class="book">動態載入的書籍</div>'
      }, 100)

      // eslint-disable-next-line no-unused-vars
      const result = await DOMUtils.waitForContent('.book', { timeout: 500 })

      expect(result.found).toBe(true)
      expect(result.element).toBeTruthy()
      expect(result.waitTime).toBeLessThan(500)
    }, 1000)

    test('應該在超時後停止等待', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await DOMUtils.waitForContent('.never-exists', { timeout: 100 })

      expect(result.found).toBe(false)
      expect(result.element).toBe(null)
      expect(result.timedOut).toBe(true)
    }, 500)
  })

  describe('⚠️ 錯誤處理和邊界情況', () => {
    test('應該處理 null 和 undefined 元素', () => {
      expect(() => DOMUtils.safeQuerySelector(null)).not.toThrow()
      expect(() => DOMUtils.extractText(null)).not.toThrow()
      expect(() => DOMUtils.safeSetAttribute(null, 'test', 'value')).not.toThrow()

      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.extractText(null)
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    test('應該處理無效的選擇器', () => {
      // eslint-disable-next-line no-unused-vars
      const invalidSelectors = ['', null, undefined, '>>invalid<<', ':::bad:::']

      invalidSelectors.forEach(selector => {
        // eslint-disable-next-line no-unused-vars
        const result = DOMUtils.safeQuerySelector(selector)
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      })
    })

    test('應該處理 DOM 操作異常', () => {
      // 建立一個會拋出錯誤的 mock 元素
      // eslint-disable-next-line no-unused-vars
      const mockElement = {
        setAttribute: jest.fn(() => {
          throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
        })
      }

      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.safeSetAttribute(mockElement, 'test', 'value')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error.message).toBeDefined()
    })

    test('應該處理記憶體洩漏預防', () => {
      // 建立大量元素
      for (let i = 0; i < 100; i++) {
        document.body.appendChild(document.createElement('div'))
      }

      // 執行清理
      // eslint-disable-next-line no-unused-vars
      const result = DOMUtils.cleanup()

      expect(result.success).toBe(true)
      expect(result.clearedCache).toBe(true)
      expect(result.removedListeners).toBeGreaterThanOrEqual(0)
    })
  })

  describe('🧪 工具方法測試', () => {
    test('應該匯出所有必要的方法', () => {
      // eslint-disable-next-line no-unused-vars
      const requiredMethods = [
        'safeQuerySelector',
        'safeQuerySelectorAll',
        'findWithMultipleSelectors',
        'findParentContainers',
        'elementExists',
        'isElementVisible',
        'isElementInViewport',
        'hasRequiredAttributes',
        'extractText',
        'extractTextFromCandidates',
        'extractAttributes',
        'extractUrlInfo',
        'safeSetAttribute',
        'safeAddClass',
        'safeRemoveClass',
        'createElement',
        'insertElement',
        'cachedQuerySelector',
        'clearQueryCache',
        'batchProcessElements',
        'isBookContainer',
        'extractBookInfo',
        'checkPageReadiness',
        'waitForContent',
        'cleanup'
      ]

      requiredMethods.forEach(methodName => {
        expect(typeof DOMUtils[methodName]).toBe('function')
      })
    })

    test('所有方法都應該回傳一致的結果格式', () => {
      document.body.innerHTML = '<div class="test">測試</div>'
      // eslint-disable-next-line no-unused-vars
      const element = document.querySelector('.test')

      // eslint-disable-next-line no-unused-vars
      const methods = [
        () => DOMUtils.safeQuerySelector('.test'),
        () => DOMUtils.extractText(element),
        () => DOMUtils.safeSetAttribute(element, 'test', 'value')
      ]

      methods.forEach(method => {
        // eslint-disable-next-line no-unused-vars
        const result = method()
        expect(typeof result).toBe('object')
        expect(typeof result.success).toBe('boolean')
      })
    })

    test('應該安全處理各種錯誤輸入', () => {
      // eslint-disable-next-line no-unused-vars
      const invalidInputs = [null, undefined, '', 0, {}, [], NaN]

      invalidInputs.forEach(input => {
        expect(() => DOMUtils.safeQuerySelector(input)).not.toThrow()
        expect(() => DOMUtils.extractText(input)).not.toThrow()
        expect(() => DOMUtils.elementExists(input)).not.toThrow()
      })
    })
  })
})
