/**
 * 📄 Overview 資料匯入功能 - 私有方法單元測試
 *
 * 目標：提升測試覆蓋率從 49.66% 至 90%
 * 重點：測試重構後的 20 個私有方法
 *
 * @jest-environment jsdom
 */

const { JSDOM } = require('jsdom')
const { StandardError } = require('src/core/errors/StandardError')

describe('🔧 私有方法單元測試 - FileReader 資料匯入功能', () => {
  let dom
  let document
  let window
  let controller
  let OverviewPageController

  // 測試資料集
  const testDataSets = {
    validBook: {
      id: 'test-book-1',
      title: '測試書籍',
      cover: 'http://example.com/cover.jpg',
      progress: 50,
      status: '閱讀中',
      source: 'readmoo',
      extractedAt: '2025-08-22T10:00:00.000Z',
      tags: ['readmoo'],
      type: '電子書'
    },
    largeBook: {
      id: 'large-book-1',
      title: '大型書籍'.repeat(100),
      cover: 'http://example.com/large.jpg',
      progress: 25,
      status: '閱讀中',
      source: 'readmoo',
      extractedAt: '2025-08-22T10:00:00.000Z',
      tags: ['readmoo', 'technical'],
      type: '電子書',
      metadata: { pages: 1000, genre: '技術' }
    },
    invalidBook: {
      title: '', // 缺少標題和 ID
      isbn: '123' // 無效 ISBN
    }
  }

  // Mock File 建立工具
  function createMockFile (content, name = 'test.json', type = 'application/json') {
    // 建立模擬的 File 物件，避免 JSDOM Blob 問題
    return {
      name,
      type,
      size: content.length,
      content, // 自定義屬性用於測試
      lastModified: Date.now(),
      // 新增必要的方法以支援 File API
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      text: () => Promise.resolve(content),
      stream: () => new ReadableStream()
    }
  }

  // 增強版 Mock FileReader 建立工具
  function createAdvancedMockFileReader (options = {}) {
    const {
      shouldError = false,
      delay = 0,
      errorType = 'generic',
      result = null
    } = options

    let onload, onerror, onloadstart, onprogress

    const mockReader = {
      readAsText: jest.fn((file) => {
        setTimeout(() => {
          if (onloadstart) onloadstart({ type: 'loadstart' })
          if (onprogress) onprogress({ loaded: 50, total: 100 })

          if (shouldError) {
            const errorTypes = {
              generic: new Error('FileReader 讀取失敗'),
              abort: new Error('讀取被中止'),
              security: new Error('安全性錯誤')
            }
            const error = errorTypes[errorType] || errorTypes.generic
            if (onerror) onerror({ type: 'error', error })
          } else {
            const content = result !== null ? result : (typeof file === 'string' ? file : '[]')
            if (onload) {
              onload({
                type: 'load',
                target: { result: content }
              })
            }
          }
        }, delay)
      }),

      set onload (callback) { onload = callback },
      set onerror (callback) { onerror = callback },
      set onloadstart (callback) { onloadstart = callback },
      set onprogress (callback) { onprogress = callback },

      get onload () { return onload },
      get onerror () { return onerror }
    }

    return mockReader
  }

  beforeEach(() => {
    // 創建基本的 DOM 環境
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html lang="zh-TW">
      <head>
        <meta charset="UTF-8">
        <title>Readmoo書籍目錄</title>
      </head>
      <body>
        <div class="container">
          <!-- 統計資訊區域 -->
          <div class="stats">
            <div class="stat-item">
              <div class="stat-number" id="totalBooks">0</div>
              <div class="stat-label">總書籍數</div>
            </div>
            <div class="stat-item">
              <div class="stat-number" id="displayedBooks">0</div>
              <div class="stat-label">顯示中</div>
            </div>
          </div>

          <!-- 操作按鈕區域 -->
          <div class="actions">
            <button class="export-btn" id="importJSONBtn">📥 匯入 JSON</button>
            <button class="export-btn" id="reloadBtn">🔄 重新載入</button>
          </div>

          <!-- 檔案載入區域 -->
          <div id="fileUploader" style="display: none;">
            <div class="file-uploader">
              <h3>📁 載入書籍 JSON 檔案</h3>
              <input type="file" id="jsonFileInput" accept=".json,application/json">
              <button class="export-btn" id="loadFileBtn">📂 載入檔案</button>
            </div>
          </div>

          <!-- 載入狀態指示器 -->
          <div id="loadingIndicator" style="display: none;">
            <div class="loading-spinner"></div>
            <div class="loading-text">載入中...</div>
          </div>

          <!-- 錯誤訊息容器 -->
          <div id="errorContainer" style="display: none;">
            <div id="errorMessage"></div>
            <button id="retryBtn">重試</button>
          </div>

          <!-- 書籍表格 -->
          <table id="booksTable">
            <thead>
              <tr>
                <th>封面</th>
                <th>書名</th>
                <th>來源</th>
                <th>進度</th>
                <th>狀態</th>
              </tr>
            </thead>
            <tbody id="tableBody">
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `)

    document = dom.window.document
    window = dom.window

    // Mock EventHandler class
    global.EventHandler = class EventHandler {
      constructor (name, priority = 2) {
        this.name = name
        this.priority = priority
        this.isEnabled = true
        this.executionCount = 0
        this.lastExecutionTime = null
      }

      async execute (eventData) {
        if (!this.isEnabled) return null
        this.executionCount++
        this.lastExecutionTime = new Date()
        return eventData
      }

      enable () { this.isEnabled = true }
      disable () { this.isEnabled = false }
    }

    // Mock EventBus
    global.mockEventBus = {
      listeners: new Map(),
      emit: jest.fn().mockImplementation((eventName, data) => {
        const handlers = global.mockEventBus.listeners.get(eventName) || []
        handlers.forEach(handler => handler(data))
        return Promise.resolve()
      }),
      on: jest.fn().mockImplementation((eventName, handler) => {
        if (!global.mockEventBus.listeners.has(eventName)) {
          global.mockEventBus.listeners.set(eventName, [])
        }
        global.mockEventBus.listeners.get(eventName).push(handler)
      }),
      subscribe: jest.fn().mockImplementation((eventName, handler) => {
        if (!global.mockEventBus.listeners.has(eventName)) {
          global.mockEventBus.listeners.set(eventName, [])
        }
        global.mockEventBus.listeners.get(eventName).push(handler)
      }),
      unsubscribe: jest.fn(),
      off: jest.fn()
    }

    // Mock console 以捕獲日誌輸出
    global.console = {
      ...console,
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }

    // 設置全域變數
    global.document = document
    global.window = window
    window.EventHandler = global.EventHandler

    // 現在載入 OverviewPageController
    const { OverviewPageController: OverviewPageControllerClass } = require('@/overview/overview-page-controller')
    OverviewPageController = OverviewPageControllerClass

    // 建立控制器實例，並傳入必要參數
    controller = new OverviewPageController(global.mockEventBus, document)
    controller.books = []
  })

  afterEach(() => {
    // 清理環境
    jest.clearAllMocks()

    // 清理全域變數
    delete global.EventHandler
    delete global.mockEventBus
    delete global.document
    delete global.window

    if (global.FileReader && global.FileReader.mockRestore) {
      global.FileReader.mockRestore()
    }

    // 清理 require cache 以避免模組快取問題
    delete require.cache[require.resolve('@/overview/overview-page-controller')]
  })

  // 🔧 目標 1: 檔案處理層私有方法測試
  describe('📁 檔案處理層私有方法測試', () => {
    describe('_validateFileBasics() 檔案基礎驗證', () => {
      test('應該通過有效JSON檔案驗證', async () => {
        // Given: 有效的 JSON 檔案
        const validFile = createMockFile('[]', 'valid.json', 'application/json')

        // When & Then: 透過 handleFileLoad 間接測試，不應拋出異常
        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: '[]' })
        )

        await expect(controller.handleFileLoad(validFile)).resolves.not.toThrow()
      })

      test('應該拒絕非JSON檔案', async () => {
        // Given: 非 JSON 檔案
        const invalidFile = createMockFile('content', 'invalid.txt', 'text/plain')

        // When & Then: 應該拋出格式錯誤
        await expect(controller.handleFileLoad(invalidFile))
          .rejects.toMatchObject({
            code: 'INVALID_FILE_FORMAT',
            message: expect.stringContaining('檔案格式不正確')
          })
      })

      test('應該拒絕空檔案名稱', async () => {
        // Given: 空檔案名稱的檔案
        const noNameFile = createMockFile('[]', '', 'application/json')

        // When & Then: 應該拋出驗證錯誤
        await expect(controller.handleFileLoad(noNameFile))
          .rejects.toThrow()
      })

      test('應該拒絕null檔案', async () => {
        // Given: null 檔案
        const nullFile = null

        // When & Then: 應該拋出檔案驗證錯誤
        await expect(controller.handleFileLoad(nullFile))
          .rejects.toMatchObject({
            code: 'FILE_NOT_FOUND',
            message: expect.stringContaining('檔案不存在')
          })
      })
    })

    describe('_validateFileSize() 檔案大小驗證', () => {
      test('應該通過正常大小檔案', async () => {
        // Given: 正常大小的檔案 (約1MB)
        const normalContent = JSON.stringify(Array(1000).fill(testDataSets.validBook))
        const normalFile = createMockFile(normalContent, 'normal.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: normalContent })
        )

        // When & Then: 應該成功處理
        await expect(controller.handleFileLoad(normalFile)).resolves.not.toThrow()
      })

      test('應該拒絕過大檔案', async () => {
        // Given: 過大的檔案 (超過限制)
        const hugeContent = 'x'.repeat(50 * 1024 * 1024) // 50MB
        const hugeFile = createMockFile(hugeContent, 'huge.json')

        // When & Then: 應該拋出檔案大小錯誤
        await expect(controller.handleFileLoad(hugeFile))
          .rejects.toMatchObject({
            code: 'FILE_SIZE_EXCEEDED',
            message: expect.stringContaining('檔案大小超出限制')
          })
      })

      test('應該通過空檔案（0大小）', async () => {
        // Given: 空檔案和 FileReader mock
        const emptyFile = createMockFile('', 'empty.json')

        // Mock FileReader 回傳空內容
        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: '' })
        )

        // When & Then: 應該成功處理（但內容驗證會失敗）
        await expect(controller.handleFileLoad(emptyFile))
          .rejects.toMatchObject({
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('檔案內容為空')
          })
      })
    })

    describe('_isJSONFile() 檔案格式檢查', () => {
      test('應該識別.json副檔名', async () => {
        // Given: .json 檔案
        const jsonFile = createMockFile('{}', 'test.json', 'application/json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: '{}' })
        )

        // When & Then: 應該通過檢查
        await expect(controller.handleFileLoad(jsonFile)).resolves.not.toThrow()
      })

      test('應該識別application/json MIME類型', async () => {
        // Given: 正確 MIME 類型但無副檔名的檔案
        const mimeFile = createMockFile('{}', 'noextension', 'application/json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: '{}' })
        )

        // When & Then: 應該通過檢查
        await expect(controller.handleFileLoad(mimeFile)).resolves.not.toThrow()
      })

      test('應該拒絕錯誤的副檔名和MIME類型', async () => {
        // Given: 完全不符合的檔案格式
        const wrongFile = createMockFile('content', 'test.txt', 'text/plain')

        // When & Then: 應該拋出格式錯誤
        await expect(controller.handleFileLoad(wrongFile))
          .rejects.toMatchObject({
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('檔案格式不正確')
          })
      })
    })
  })

  // ⚙️ 目標 2: FileReader 操作層私有方法測試
  describe('📡 FileReader 操作層私有方法測試', () => {
    describe('_createFileReader() FileReader 建立', () => {
      test('應該建立新的 FileReader 實例', async () => {
        // Given: 有效檔案
        const validFile = createMockFile('[]', 'test.json')

        // Given: Mock FileReader 建構函式
        const mockFileReader = createAdvancedMockFileReader({ result: '[]' })
        global.FileReader = jest.fn().mockImplementation(() => mockFileReader)

        // When: 執行檔案載入
        await controller.handleFileLoad(validFile)

        // Then: 應該建立 FileReader 實例
        expect(global.FileReader).toHaveBeenCalled()
      })

      test('應該處理 FileReader 不存在的情況', async () => {
        // Given: 移除 FileReader 支援
        const originalFileReader = global.FileReader
        global.FileReader = undefined

        try {
          // Given: 有效檔案
          const validFile = createMockFile('[]', 'test.json')

          // When & Then: 應該拋出不支援錯誤
          await expect(controller.handleFileLoad(validFile))
            .rejects.toThrow()
        } finally {
          // 恢復 FileReader
          global.FileReader = originalFileReader
        }
      })
    })

    describe('_setupReaderHandlers() 事件處理器設定', () => {
      test('應該正確設定 onload 事件處理器', async () => {
        // Given: 有效檔案和 mock FileReader
        const validFile = createMockFile('[]', 'test.json')
        const mockFileReader = createAdvancedMockFileReader({ result: '[]' })
        global.FileReader = jest.fn().mockImplementation(() => mockFileReader)

        // When: 執行檔案載入
        await controller.handleFileLoad(validFile)

        // Then: 應該設定事件處理器
        expect(mockFileReader.onload).toBeDefined()
        expect(mockFileReader.onerror).toBeDefined()
      })

      test('應該正確處理讀取成功事件', async () => {
        // Given: 包含書籍資料的檔案
        const bookData = JSON.stringify([testDataSets.validBook])
        const validFile = createMockFile(bookData, 'books.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: bookData })
        )

        // When: 執行檔案載入
        await controller.handleFileLoad(validFile)

        // Then: 應該成功處理書籍資料
        expect(controller.books).toHaveLength(1)
        expect(controller.books[0]).toMatchObject(testDataSets.validBook)
      })

      test('應該正確處理讀取錯誤事件', async () => {
        // Given: 會產生錯誤的檔案
        const validFile = createMockFile('[]', 'test.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ shouldError: true })
        )

        // When & Then: 應該拋出讀取錯誤
        await expect(controller.handleFileLoad(validFile))
          .rejects.toMatchObject({
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('讀取檔案時發生錯誤')
          })
      })
    })

    describe('_readFileWithReader() 檔案讀取協調', () => {
      test('應該協調完整的檔案讀取流程', async () => {
        // Given: 有效檔案
        const validContent = JSON.stringify([testDataSets.validBook])
        const validFile = createMockFile(validContent, 'test.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: validContent })
        )

        // When: 執行檔案載入
        await controller.handleFileLoad(validFile)

        // Then: 應該完成完整流程
        expect(controller.books).toHaveLength(1)
        expect(console.log).toHaveBeenCalledWith('✅ 成功載入 1 本書籍')
      })

      test('應該處理非同步讀取錯誤', async () => {
        // Given: 會在非同步過程中失敗的檔案
        const validFile = createMockFile('[]', 'test.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({
            shouldError: true,
            delay: 10,
            errorType: 'security'
          })
        )

        // When & Then: 應該正確處理非同步錯誤
        await expect(controller.handleFileLoad(validFile))
          .rejects.toMatchObject({
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('讀取檔案時發生錯誤')
          })
      })
    })
  })

  // 🧹 目標 3: 內容處理層私有方法測試
  describe('🧹 內容處理層私有方法測試', () => {
    describe('_validateAndCleanContent() 內容驗證與清理', () => {
      test('應該通過有效內容驗證', async () => {
        // Given: 有效 JSON 內容
        const validContent = JSON.stringify([testDataSets.validBook])
        const validFile = createMockFile(validContent, 'test.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: validContent })
        )

        // When & Then: 應該成功處理
        await expect(controller.handleFileLoad(validFile)).resolves.not.toThrow()
      })

      test('應該拒絕空內容', async () => {
        // Given: 空內容
        const emptyFile = createMockFile('', 'empty.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: '' })
        )

        // When & Then: 應該拋出空內容錯誤
        await expect(controller.handleFileLoad(emptyFile))
          .rejects.toMatchObject({
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('檔案內容為空')
          })
      })

      test('應該拒絕純空白內容', async () => {
        // Given: 純空白內容
        const whitespaceFile = createMockFile('   \n\t  ', 'whitespace.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: '   \n\t  ' })
        )

        // When & Then: 應該拋出空內容錯誤
        await expect(controller.handleFileLoad(whitespaceFile))
          .rejects.toMatchObject({
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('檔案內容為空')
          })
      })

      test('應該清理內容前後的空白', async () => {
        // Given: 前後有空白的有效 JSON
        const paddedContent = `  \n${JSON.stringify([testDataSets.validBook])}  \n`
        const paddedFile = createMockFile(paddedContent, 'padded.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: paddedContent })
        )

        // When: 執行處理
        await controller.handleFileLoad(paddedFile)

        // Then: 應該成功解析內容
        expect(controller.books).toHaveLength(1)
        expect(controller.books[0]).toMatchObject(testDataSets.validBook)
      })
    })

    describe('_removeBOM() BOM 移除', () => {
      test('應該移除 UTF-8 BOM 標記', async () => {
        // Given: 包含 BOM 的 JSON 內容
        const bomContent = '\uFEFF' + JSON.stringify([testDataSets.validBook])
        const bomFile = createMockFile(bomContent, 'bom.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: bomContent })
        )

        // When: 執行處理
        await controller.handleFileLoad(bomFile)

        // Then: 應該成功解析內容（BOM 已被移除）
        expect(controller.books).toHaveLength(1)
        expect(controller.books[0]).toMatchObject(testDataSets.validBook)
      })

      test('應該保持無 BOM 內容不變', async () => {
        // Given: 不包含 BOM 的正常內容
        const normalContent = JSON.stringify([testDataSets.validBook])
        const normalFile = createMockFile(normalContent, 'normal.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: normalContent })
        )

        // When: 執行處理
        await controller.handleFileLoad(normalFile)

        // Then: 應該正常處理
        expect(controller.books).toHaveLength(1)
        expect(controller.books[0]).toMatchObject(testDataSets.validBook)
      })
    })

    describe('_parseJSONContent() JSON 解析', () => {
      test('應該成功解析有效 JSON', async () => {
        // Given: 有效 JSON 字串
        const validJSON = JSON.stringify({ books: [testDataSets.validBook] })
        const validFile = createMockFile(validJSON, 'valid.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: validJSON })
        )

        // When: 執行處理
        await controller.handleFileLoad(validFile)

        // Then: 應該成功解析並載入書籍
        expect(controller.books).toHaveLength(1)
      })

      test('應該拋出 JSON 語法錯誤', async () => {
        // Given: 無效 JSON 語法
        const invalidJSON = '{ "books": [invalid json} '
        const invalidFile = createMockFile(invalidJSON, 'invalid.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: invalidJSON })
        )

        // When & Then: 應該拋出 JSON 格式錯誤
        await expect(controller.handleFileLoad(invalidFile))
          .rejects.toMatchObject({
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('JSON 檔案格式不正確')
          })
      })

      test('應該處理空 JSON 對象', async () => {
        // Given: 空 JSON 對象
        const emptyJSON = '{}'
        const emptyFile = createMockFile(emptyJSON, 'empty.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: emptyJSON })
        )

        // When: 執行處理
        await controller.handleFileLoad(emptyFile)

        // Then: 應該成功處理（但沒有書籍資料）
        expect(controller.books).toHaveLength(0)
        expect(console.log).toHaveBeenCalledWith('✅ 成功載入 0 本書籍')
      })

      test('應該處理包含特殊字符的 JSON', async () => {
        // Given: 包含特殊字符的書籍資料
        const specialBook = {
          ...testDataSets.validBook,
          title: '特殊字符📚測試\n"引號"\'單引號\'',
          description: '包含\t製表符\r\n換行符的描述'
        }
        const specialJSON = JSON.stringify([specialBook])
        const specialFile = createMockFile(specialJSON, 'special.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: specialJSON })
        )

        // When: 執行處理
        await controller.handleFileLoad(specialFile)

        // Then: 應該正確處理特殊字符
        expect(controller.books).toHaveLength(1)
        expect(controller.books[0].title).toBe(specialBook.title)
        expect(controller.books[0].description).toBe(specialBook.description)
      })
    })
  })
})
