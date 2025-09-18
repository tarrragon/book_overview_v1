/**
 * UIDOMManager 測試
 * 測試 UI DOM 管理工具類的功能
 */

const UIDOMManager = require('src/ui/handlers/ui-dom-manager')

describe('UIDOMManager', () => {
  let domManager
  let mockDocument
  let mockElement

  beforeEach(() => {
    // 創建模擬 DOM 元素
    mockElement = {
      textContent: '',
      innerHTML: '',
      style: {},
      classList: {
        add: jest.fn(),
        remove: jest.fn()
      },
      setAttribute: jest.fn(),
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      addEventListener: jest.fn()
    }

    // 創建模擬文檔
    mockDocument = {
      createElement: jest.fn(() => mockElement),
      querySelector: jest.fn(() => mockElement),
      body: {
        appendChild: jest.fn()
      },
      contains: jest.fn(() => true)
    }

    domManager = new UIDOMManager(mockDocument)
  })

  describe('基本結構', () => {
    test('應該能夠創建實例', () => {
      expect(domManager).toBeInstanceOf(UIDOMManager)
      expect(domManager.document).toBe(mockDocument)
    })
  })

  describe('元素查找', () => {
    test('應該能夠查找單個元素', () => {
      const selectors = ['.test-class', '#test-id']
      const element = domManager.findElement(selectors)

      expect(element).toBe(mockElement)
      expect(mockDocument.querySelector).toHaveBeenCalledWith('.test-class')
    })

    test('應該支援多個選擇器備案', () => {
      mockDocument.querySelector
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockElement)

      const selectors = ['.not-found', '.found']
      const element = domManager.findElement(selectors)

      expect(element).toBe(mockElement)
      expect(mockDocument.querySelector).toHaveBeenCalledWith('.not-found')
      expect(mockDocument.querySelector).toHaveBeenCalledWith('.found')
    })

    test('應該支援快取機制', () => {
      const selectors = ['.test']

      // 第一次查找
      domManager.findElement(selectors, 'testCache')
      // 第二次查找應該使用快取
      const element = domManager.findElement(selectors, 'testCache')

      expect(element).toBe(mockElement)
      expect(mockDocument.querySelector).toHaveBeenCalledTimes(1)
    })
  })

  describe('元素創建', () => {
    test('應該能夠創建基本元素', () => {
      const element = domManager.createElement('div')

      expect(mockDocument.createElement).toHaveBeenCalledWith('div')
      expect(element).toBe(mockElement)
    })

    test('應該能夠設定元素屬性', () => {
      const options = {
        classes: ['test-class', 'another-class'],
        attributes: { id: 'test-id', 'data-test': 'value' },
        textContent: 'Test Content'
      }

      domManager.createElement('div', options)

      expect(mockElement.classList.add).toHaveBeenCalledWith('test-class')
      expect(mockElement.classList.add).toHaveBeenCalledWith('another-class')
      expect(mockElement.setAttribute).toHaveBeenCalledWith('id', 'test-id')
      expect(mockElement.setAttribute).toHaveBeenCalledWith('data-test', 'value')
      expect(mockElement.textContent).toBe('Test Content')
    })

    test('應該處理 innerHTML（經過轉義）', () => {
      const options = {
        innerHTML: '<script>alert("xss")</script>Hello'
      }

      domManager.createElement('div', options)

      expect(mockElement.innerHTML).toContain('&lt;script&gt;')
      expect(mockElement.innerHTML).toContain('Hello')
    })
  })

  describe('事件監聽', () => {
    test('應該能夠添加事件監聽器', () => {
      const handler = jest.fn()
      const result = domManager.addEventListener(mockElement, 'click', handler)

      expect(result).toBe(true)
      expect(mockElement.addEventListener).toHaveBeenCalledWith('click', handler, {})
    })

    test('應該處理無效元素', () => {
      const handler = jest.fn()
      const result = domManager.addEventListener(null, 'click', handler)

      expect(result).toBe(false)
    })
  })

  describe('元素移除', () => {
    test('應該能夠立即移除元素', async () => {
      mockElement.parentNode = {
        removeChild: jest.fn()
      }

      const result = await domManager.removeElement(mockElement, 0)

      expect(result).toBe(true)
      expect(mockElement.parentNode.removeChild).toHaveBeenCalledWith(mockElement)
    })

    test('應該能夠延遲移除元素', async () => {
      mockElement.remove = jest.fn()

      const promise = domManager.removeElement(mockElement, 50)

      // 等待延遲完成
      await promise

      expect(mockElement.remove).toHaveBeenCalled()
    })

    test('應該處理無效元素', async () => {
      const result = await domManager.removeElement(null)
      expect(result).toBe(false)
    })
  })

  describe('樣式更新', () => {
    test('應該能夠更新元素樣式', () => {
      const styles = {
        display: 'block',
        color: 'red',
        fontSize: '16px'
      }

      const result = domManager.updateStyles(mockElement, styles)

      expect(result).toBe(true)
      expect(mockElement.style.display).toBe('block')
      expect(mockElement.style.color).toBe('red')
      expect(mockElement.style.fontSize).toBe('16px')
    })

    test('應該處理無效元素', () => {
      const result = domManager.updateStyles(null, { color: 'red' })
      expect(result).toBe(false)
    })
  })

  describe('HTML 轉義', () => {
    test('應該轉義危險字符', () => {
      const dangerousHtml = '<script>alert("xss")</script>&"\''
      const safeHtml = domManager.escapeHtml(dangerousHtml)

      expect(safeHtml).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&amp;&quot;&#39;')
    })

    test('應該處理空值', () => {
      expect(domManager.escapeHtml(null)).toBe('')
      expect(domManager.escapeHtml(undefined)).toBe('')
      expect(domManager.escapeHtml('')).toBe('')
    })
  })

  describe('快取管理', () => {
    test('應該能夠清理特定快取', () => {
      domManager.cachedElements.set('test', mockElement)

      domManager.clearCache('test')

      expect(domManager.cachedElements.has('test')).toBe(false)
    })

    test('應該能夠清理所有快取', () => {
      domManager.cachedElements.set('test1', mockElement)
      domManager.cachedElements.set('test2', mockElement)

      domManager.clearCache()

      expect(domManager.cachedElements.size).toBe(0)
    })
  })

  describe('DOM 檢查', () => {
    test('應該檢查元素是否在 DOM 中', () => {
      const result = domManager.isElementInDOM(mockElement)

      expect(result).toBe(true)
      expect(mockDocument.contains).toHaveBeenCalledWith(mockElement)
    })

    test('應該處理無效元素', () => {
      const result = domManager.isElementInDOM(null)
      expect(result).toBe(false)
    })
  })
})
