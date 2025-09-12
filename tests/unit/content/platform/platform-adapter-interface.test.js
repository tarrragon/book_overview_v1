/**
 * @fileoverview Platform Adapter Interface 測試
 * @version v1.0.0
 * @since 2025-08-16
 *
 * 測試目標：
 * - 驗證平台適配器抽象介面的設計契約
 * - 確保所有必要方法都有正確的抽象定義
 * - 測試介面繼承和錯誤處理機制
 * - 為 Readmoo 實作提供清楚的契約規範
 */

describe('PlatformAdapterInterface', () => {
  let PlatformAdapterInterface
  let adapter

  beforeAll(() => {
    // 載入抽象介面類別 (使用 CommonJS require)
    PlatformAdapterInterface = require('src/content/platform/platform-adapter-interface.js')
  })

  beforeEach(() => {
    adapter = new PlatformAdapterInterface()
  })

  describe('🔌 抽象介面定義', () => {
    test('應該是一個可實例化的類別', () => {
      expect(adapter).toBeInstanceOf(PlatformAdapterInterface)
      expect(typeof PlatformAdapterInterface).toBe('function')
    })

    test('應該定義平台名稱屬性', () => {
      expect(adapter.platformName).toBeDefined()
      expect(typeof adapter.platformName).toBe('string')
    })

    test('應該定義版本資訊', () => {
      expect(adapter.version).toBeDefined()
      expect(typeof adapter.version).toBe('string')
    })
  })

  describe('📋 頁面檢測方法契約', () => {
    test('getPageType() 應該拋出未實作錯誤', async () => {
      await expect(adapter.getPageType()).rejects.toMatchObject({
        code: expect.any(String),
        message: expect.stringContaining('Must implement getPageType()')
      })
    })

    test('isExtractablePage() 應該拋出未實作錯誤', async () => {
      await expect(adapter.isExtractablePage()).rejects.toMatchObject({
        code: expect.any(String),
        message: expect.stringContaining('Must implement isExtractablePage()')
      })
    })

    test('checkPageReady() 應該拋出未實作錯誤', async () => {
      await expect(adapter.checkPageReady()).rejects.toMatchObject({
        code: expect.any(String),
        message: expect.stringContaining('Must implement checkPageReady()')
      })
    })

    test('isValidDomain() 應該拋出未實作錯誤', () => {
      expect(() => adapter.isValidDomain()).toThrow(expect.objectContaining({
        code: expect.any(String),
        message: expect.stringContaining('Must implement isValidDomain()')
      }))
    })
  })

  describe('🔍 元素查找方法契約', () => {
    test('getBookElements() 應該拋出未實作錯誤', () => {
      expect(() => adapter.getBookElements()).toThrow(expect.objectContaining({
        code: expect.any(String),
        message: expect.stringContaining('Must implement getBookElements()')
      }))
    })

    test('getBookCount() 應該拋出未實作錯誤', () => {
      expect(() => adapter.getBookCount()).toThrow(expect.objectContaining({
        code: expect.any(String),
        message: expect.stringContaining('Must implement getBookCount()')
      }))
    })

    test('findBookContainer() 應該拋出未實作錯誤', () => {
      expect(() => adapter.findBookContainer()).toThrow(expect.objectContaining({
        code: expect.any(String),
        message: expect.stringContaining('Must implement findBookContainer()')
      }))
    })
  })

  describe('📚 資料提取方法契約', () => {
    test('parseBookElement() 應該拋出未實作錯誤', () => {
      const mockElement = document.createElement('div')
      expect(() => adapter.parseBookElement(mockElement)).toThrow(expect.objectContaining({
        code: expect.any(String),
        message: expect.stringContaining('Must implement parseBookElement()')
      }))
    })

    test('extractAllBooks() 應該拋出未實作錯誤', async () => {
      await expect(adapter.extractAllBooks()).rejects.toMatchObject({
        code: expect.any(String),
        message: expect.stringContaining('Must implement extractAllBooks()')
      })
    })

    test('extractBookData() 應該拋出未實作錯誤', () => {
      const mockElement = document.createElement('div')
      expect(() => adapter.extractBookData(mockElement)).toThrow(expect.objectContaining({
        code: expect.any(String),
        message: expect.stringContaining('Must implement extractBookData()')
      }))
    })
  })

  describe('🧹 工具方法契約', () => {
    test('sanitizeData() 應該拋出未實作錯誤', () => {
      expect(() => adapter.sanitizeData({})).toThrow(expect.objectContaining({
        code: expect.any(String),
        message: expect.stringContaining('Must implement sanitizeData()')
      }))
    })

    test('getStats() 應該拋出未實作錯誤', () => {
      expect(() => adapter.getStats()).toThrow(expect.objectContaining({
        code: expect.any(String),
        message: expect.stringContaining('Must implement getStats()')
      }))
    })

    test('reset() 應該拋出未實作錯誤', () => {
      expect(() => adapter.reset()).toThrow(expect.objectContaining({
        code: expect.any(String),
        message: expect.stringContaining('Must implement reset()')
      }))
    })
  })

  describe('⚠️ 錯誤處理測試', () => {
    test('抽象方法應該提供清楚的錯誤訊息', async () => {
      const errorChecks = [
        { method: 'getPageType', async: true },
        { method: 'isExtractablePage', async: true },
        { method: 'checkPageReady', async: true },
        { method: 'extractAllBooks', async: true },
        { method: 'isValidDomain', async: false },
        { method: 'getBookElements', async: false },
        { method: 'getBookCount', async: false },
        { method: 'sanitizeData', async: false, args: [{}] }
      ]

      for (const check of errorChecks) {
        if (check.async) {
          await expect(adapter[check.method](...(check.args || []))).rejects.toMatchObject({
            code: 'TEST_ERROR',
            message: expect.any(String),
            details: expect.any(Object)
          })
        } else {
          expect(() => adapter[check.method](...(check.args || []))).toThrow(
            `Must implement ${check.method}()`
          )
        }
      }
    })

    test('錯誤訊息應該包含方法名稱', () => {
      try {
        adapter.getBookElements()
      } catch (error) {
        expect(error.message).toContain('getBookElements')
        expect(error.message).toContain('Must implement')
      }
    })
  })

  describe('🔄 介面繼承測試', () => {
    test('應該支援類別繼承', () => {
      class MockAdapter extends PlatformAdapterInterface {
        constructor () {
          super()
          this.platformName = 'Mock'
        }

        getPageType () {
          return 'library'
        }

        isValidDomain () {
          return true
        }
      }

      const mockAdapter = new MockAdapter()
      expect(mockAdapter).toBeInstanceOf(PlatformAdapterInterface)
      expect(mockAdapter.platformName).toBe('Mock')
      expect(mockAdapter.getPageType()).toBe('library')
      expect(mockAdapter.isValidDomain()).toBe(true)
    })

    test('繼承類別未實作的方法仍應拋出錯誤', () => {
      class PartialAdapter extends PlatformAdapterInterface {
        getPageType () {
          return 'library'
        }
      }

      const partialAdapter = new PartialAdapter()
      expect(partialAdapter.getPageType()).toBe('library')
      expect(() => partialAdapter.getBookElements()).toThrow(expect.objectContaining({
        code: expect.any(String),
        message: expect.stringContaining('Must implement getBookElements()')
      }))
    })
  })

  describe('📊 介面契約驗證', () => {
    test('應該定義所有必需的抽象方法', () => {
      const requiredMethods = [
        'getPageType',
        'isExtractablePage',
        'checkPageReady',
        'isValidDomain',
        'getBookElements',
        'getBookCount',
        'findBookContainer',
        'parseBookElement',
        'extractAllBooks',
        'extractBookData',
        'sanitizeData',
        'getStats',
        'reset'
      ]

      for (const methodName of requiredMethods) {
        expect(typeof adapter[methodName]).toBe('function')
      }
    })

    test('應該具有正確的方法簽名', () => {
      // 檢查關鍵方法的參數長度
      expect(adapter.parseBookElement.length).toBe(1) // 接受一個 element 參數
      expect(adapter.extractBookData.length).toBe(1) // 接受一個 element 參數
      expect(adapter.sanitizeData.length).toBe(1) // 接受一個 data 參數
    })
  })

  describe('🔧 工具方法行為', () => {
    test('toString() 應該回傳平台資訊', () => {
      const result = adapter.toString()
      expect(typeof result).toBe('string')
      expect(result).toContain('PlatformAdapterInterface')
    })

    test('應該提供平台識別資訊', () => {
      expect(adapter.platformName).toBeDefined()
      expect(adapter.version).toBeDefined()
    })
  })
})
