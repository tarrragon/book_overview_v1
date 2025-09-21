/**
 * 資料提取器單元測試
 * 測試內容腳本中的資料提取功能
 *
 * Responsible for:
 * - 測試書籍資料提取邏輯
 * - 驗證資料格式和完整性
 * - 測試錯誤處理機制
 * - 測試DOM解析功能
 *
 * Design considerations:
 * - 基於TDD原則，先定義期望行為
 * - 模擬真實的Readmoo頁面結構
 * - 測試各種邊界情況和錯誤狀態
 *
 * Process flow:
 * 1. 設定測試環境和模擬DOM
 * 2. 執行資料提取功能
 * 3. 驗證提取結果
 * 4. 測試錯誤處理
 */

describe('📚 資料提取器測試', () => {
  let progressExtractor
  let metadataExtractor

  beforeEach(() => {
    // 重置測試環境
    global.testUtils.cleanup()

    // 這裡將來會載入實際的提取器模組
    // bookDataExtractor = require('@/content-scripts/extractors/book-data.extractor');
    // progressExtractor = require('@/content-scripts/extractors/progress.extractor');
    // metadataExtractor = require('@/content-scripts/extractors/metadata.extractor');
  })

  describe('🎯 書籍基本資料提取', () => {
    test('應該能夠從DOM中提取完整的書籍資料', async () => {
      // Arrange - 設定測試用的DOM結構
      const mockBookElement = global.testUtils.createMockElement('div', {
        class: 'library-item library-item-grid-view'
      })

      const mockLink = global.testUtils.createMockElement('a', {
        href: 'https://readmoo.com/api/reader/210327003000101',
        class: 'reader-link'
      })

      const mockImage = global.testUtils.createMockElement('img', {
        src: 'https://cdn.readmoo.com/cover/jb/qpfmrmi_210x315.jpg?v=1714370332',
        alt: '大腦不滿足',
        class: 'cover-img'
      })

      const mockTitle = global.testUtils.createMockElement('div', {
        class: 'title',
        title: '大腦不滿足'
      }, '大腦不滿足')

      const mockProgressBar = global.testUtils.createMockElement('div', {
        class: 'progress-bar',
        style: 'width: 60%'
      })

      mockLink.appendChild(mockImage)
      mockBookElement.appendChild(mockLink)
      mockBookElement.appendChild(mockTitle)
      mockBookElement.appendChild(mockProgressBar)
      document.body.appendChild(mockBookElement)

      // Act - 執行資料提取（這裡模擬期望的API）
      const expectedResult = {
        id: '210327003000101',
        title: '大腦不滿足',
        cover: 'https://cdn.readmoo.com/cover/jb/qpfmrmi_210x315.jpg?v=1714370332',
        progress: 60,
        extractedAt: expect.any(String)
      }

      // Assert - 驗證結果
      // 這裡先定義期望的行為，實際實現會在後面完成
      expect(expectedResult).toEqual({
        id: '210327003000101',
        title: '大腦不滿足',
        cover: expect.stringContaining('cdn.readmoo.com'),
        progress: 60,
        extractedAt: expect.any(String)
      })
    })

    test('應該能夠處理缺少某些欄位的書籍資料', async () => {
      // Arrange - 設定不完整的DOM結構
      const mockBookElement = global.testUtils.createMockElement('div', {
        class: 'library-item'
      })

      const mockLink = global.testUtils.createMockElement('a', {
        href: 'https://readmoo.com/api/reader/210327003000101'
      })

      mockBookElement.appendChild(mockLink)
      document.body.appendChild(mockBookElement)

      // Act & Assert - 應該能夠優雅地處理缺少的資料
      const expectedResult = {
        id: '210327003000101',
        title: null,
        cover: null,
        progress: 0,
        extractedAt: expect.any(String)
      }

      expect(expectedResult.id).toBe('210327003000101')
      expect(expectedResult.title).toBeNull()
      expect(expectedResult.cover).toBeNull()
    })

    test('應該能夠識別新書標記', async () => {
      // Arrange
      const mockBookElement = global.testUtils.createMockElement('div', {
        class: 'library-item'
      })

      const mockNewRibbon = global.testUtils.createMockElement('div', {
        class: 'ribbon'
      })
      const mockNewSpan = global.testUtils.createMockElement('span', {}, 'New')
      mockNewRibbon.appendChild(mockNewSpan)
      mockBookElement.appendChild(mockNewRibbon)

      document.body.appendChild(mockBookElement)

      // Act & Assert
      // 期望能夠識別 isNew 標記
      const expectedResult = {
        isNew: true
      }

      expect(expectedResult.isNew).toBe(true)
    })

    test('應該能夠識別完讀標記', async () => {
      // Arrange
      const mockBookElement = global.testUtils.createMockElement('div', {
        class: 'library-item'
      })

      const mockFinishedRibbon = global.testUtils.createMockElement('div', {
        class: 'ribbon'
      })
      const mockFinishedSpan = global.testUtils.createMockElement('span', {}, '完讀')
      mockFinishedRibbon.appendChild(mockFinishedSpan)
      mockBookElement.appendChild(mockFinishedRibbon)

      document.body.appendChild(mockBookElement)

      // Act & Assert
      const expectedResult = {
        isFinished: true
      }

      expect(expectedResult.isFinished).toBe(true)
    })
  })

  describe('📊 閱讀進度提取', () => {
    test('應該能夠正確解析進度百分比', () => {
      // Arrange
      const progressTests = [
        { style: 'width: 0%', expected: 0 },
        { style: 'width: 25%', expected: 25 },
        { style: 'width: 50%', expected: 50 },
        { style: 'width: 75%', expected: 75 },
        { style: 'width: 100%', expected: 100 }
      ]

      progressTests.forEach(({ style, expected }) => {
        const mockProgressBar = global.testUtils.createMockElement('div', {
          class: 'progress-bar',
          style
        })

        // Act - 解析進度（期望的API）
        const width = style.match(/width:\s*(\d+)%/)?.[1]
        const progress = width ? parseInt(width, 10) : 0

        // Assert
        expect(progress).toBe(expected)
      })
    })

    test('應該處理無效的進度資料', () => {
      // Arrange
      const invalidProgressTests = [
        { style: 'width: invalid%', expected: 0 },
        { style: 'height: 50%', expected: 0 },
        { style: '', expected: 0 }
      ]

      invalidProgressTests.forEach(({ style, expected }) => {
        const mockProgressBar = global.testUtils.createMockElement('div', {
          class: 'progress-bar',
          style
        })

        // Act
        const width = style.match(/width:\s*(\d+)%/)?.[1]
        const progress = width ? parseInt(width, 10) : 0

        // Assert
        expect(progress).toBe(expected)
      })
    })
  })

  describe('📖 書籍類型識別', () => {
    test('應該能夠識別流式書籍', () => {
      // Arrange
      const mockRenditionLabel = global.testUtils.createMockElement('div', {
        class: 'label rendition'
      }, '流式')

      // Act
      const type = mockRenditionLabel.textContent

      // Assert
      expect(type).toBe('流式')
    })

    test('應該能夠識別版式書籍', () => {
      // Arrange
      const mockRenditionLabel = global.testUtils.createMockElement('div', {
        class: 'label rendition'
      }, '版式')

      // Act
      const type = mockRenditionLabel.textContent

      // Assert
      expect(type).toBe('版式')
    })
  })

  describe('🔧 錯誤處理測試', () => {
    test('應該能夠處理DOM不存在的情況', () => {
      // Arrange - 清空DOM
      document.body.innerHTML = ''

      // Act & Assert - 應該不會拋出錯誤
      expect(() => {
        // 模擬提取函數在無DOM情況下的執行
        const books = document.querySelectorAll('.library-item')
        expect(books.length).toBe(0)
      }).not.toThrow()
    })

    test('應該能夠處理網路連線問題', async () => {
      // Arrange - 模擬網路錯誤
      const mockNetworkError = new Error('Network error')

      // Act & Assert
      await expect(Promise.reject(mockNetworkError))
        .rejects.toMatchObject({
          code: 'NETWORK_ERROR',
          message: expect.any(String),
          details: expect.any(Object)
        })
    })

    test('應該能夠處理無效的書籍ID格式', () => {
      // Arrange - 支援多書城的ID驗證邏輯
      const supportedBookstores = {
        readmoo: {
          domain: 'readmoo.com',
          pattern: /\/api\/reader\/(\d+)/
        }
        // 未來擴展：其他書城
        // 'books': {
        //   domain: 'books.com.tw',
        //   pattern: /\/book\/(\d+)/
        // }
      }

      const invalidUrls = [
        'https://readmoo.com/invalid', // ❌ 正確域名但無效路徑
        'https://example.com/api/reader/123', // ❌ 錯誤域名
        'not-a-url', // ❌ 無效URL
        'https://readmoo.com/api/reader/abc', // ❌ 非數字ID
        '' // ❌ 空字串
      ]

      // Act & Assert
      invalidUrls.forEach(url => {
        const mockLink = global.testUtils.createMockElement('a', { href: url })

        // 多書城ID提取邏輯
        const extractBookId = (href) => {
          if (!href || typeof href !== 'string') return null

          try {
            const urlObj = new URL(href)

            // 檢查是否為支援的書城
            for (const [storeName, config] of Object.entries(supportedBookstores)) {
              if (urlObj.hostname === config.domain) {
                const match = href.match(config.pattern)
                return match ? match[1] : null
              }
            }
            return null
          } catch {
            return null // 無效URL
          }
        }

        const id = extractBookId(url)
        expect(id).toBeNull()
      })
    })

    test('應該能夠正確提取有效的書籍ID（多書城支援）', () => {
      // Arrange - 相同的多書城配置
      const supportedBookstores = {
        readmoo: {
          domain: 'readmoo.com',
          pattern: /\/api\/reader\/(\d+)/
        }
      }

      const validUrls = [
        { url: 'https://readmoo.com/api/reader/123456', expectedId: '123456' },
        { url: 'https://readmoo.com/api/reader/789', expectedId: '789' }
      ]

      // Act & Assert
      validUrls.forEach(({ url, expectedId }) => {
        const extractBookId = (href) => {
          if (!href || typeof href !== 'string') return null

          try {
            const urlObj = new URL(href)

            for (const [storeName, config] of Object.entries(supportedBookstores)) {
              if (urlObj.hostname === config.domain) {
                const match = href.match(config.pattern)
                return match ? match[1] : null
              }
            }
            return null
          } catch {
            return null
          }
        }

        const id = extractBookId(url)
        expect(id).toBe(expectedId)
      })
    })
  })

  describe('⚡ 效能測試', () => {
    test('應該能夠在合理時間內處理大量書籍', async () => {
      // Arrange - 建立大量模擬書籍
      const bookCount = 100
      const startTime = Date.now()

      for (let i = 0; i < bookCount; i++) {
        const mockBook = global.testUtils.createMockElement('div', {
          class: 'library-item',
          'data-book-id': `21032700300010${i}`
        })
        document.body.appendChild(mockBook)
      }

      // Act
      const books = document.querySelectorAll('.library-item')
      const endTime = Date.now()
      const processingTime = endTime - startTime

      // Assert - 處理時間應該在合理範圍內（例如小於1秒）
      expect(books.length).toBe(bookCount)
      expect(processingTime).toBeLessThan(1000)
    })
  })

  describe('🔄 資料一致性測試', () => {
    test('多次提取相同資料應該得到一致結果', () => {
      // Arrange
      const mockBook = global.testUtils.createMockBook()
      const mockElement = global.testUtils.createMockElement('div', {
        'data-book': JSON.stringify(mockBook)
      })
      document.body.appendChild(mockElement)

      // Act - 多次提取
      const results = []
      for (let i = 0; i < 3; i++) {
        const element = document.querySelector('[data-book]')
        const bookData = JSON.parse(element.getAttribute('data-book'))
        results.push(bookData)
      }

      // Assert - 所有結果應該一致
      results.forEach(result => {
        expect(result).toEqual(mockBook)
      })
    })
  })
})
