/**
 * 📄 Overview 資料匯入功能 - 私有方法單元測試
 *
 * 目標：提升測試覆蓋率從 49.66% 至 90%
 * 重點：測試重構後的 20 個私有方法
 *
 * @jest-environment jsdom
 */

const { JSDOM } = require('jsdom')

describe('🔧 私有方法單元測試 - FileReader 資料匯入功能', () => {
  let dom
  let document
  let window
  // eslint-disable-next-line no-unused-vars
  let controller
  let OverviewPageController

  // 測試資料集
  // validBook 為 v2 形狀 fixture（W1-047.1 IMP-A 起 JSON 匯入經 v1->v2 轉換）：
  // v1 欄位 status/tags 經 convertV1ToV2Book 轉為 readingStatus/tagIds，
  // status 字串不參與映射（mapV1StatusToV2 只讀 isFinished/isNew/progress）。
  // progress:50 -> readingStatus:'reading'；無 category -> tagIds:[]。
  // updatedAt 為轉換時 runtime timestamp，非確定值，不列入 toMatchObject 比對。
  // eslint-disable-next-line no-unused-vars
  const testDataSets = {
    validBook: {
      id: 'test-book-1',
      title: '測試書籍',
      cover: 'http://example.com/cover.jpg',
      progress: 50,
      readingStatus: 'reading',
      source: 'readmoo',
      extractedAt: '2025-08-22T10:00:00.000Z',
      tagIds: [],
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

    // eslint-disable-next-line no-unused-vars
    const mockReader = {
      readAsText: jest.fn((file) => {
        setTimeout(() => {
          if (onloadstart) onloadstart({ type: 'loadstart' })
          if (onprogress) onprogress({ loaded: 50, total: 100 })

          if (shouldError) {
            // eslint-disable-next-line no-unused-vars
            const errorTypes = {
              generic: new Error('FileReader 讀取失敗'),
              abort: new Error('讀取被中止'),
              security: new Error('安全性錯誤')
            }
            // eslint-disable-next-line no-unused-vars
            const error = errorTypes[errorType] || errorTypes.generic
            if (onerror) onerror({ type: 'error', error })
          } else {
            // eslint-disable-next-line no-unused-vars
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
      get onerror () { return onerror },
      get onloadstart () { return onloadstart },
      get onprogress () { return onprogress }
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
        // eslint-disable-next-line no-unused-vars
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

    // W1-047.5 / IMP-E：handleFileLoad 新增 promptImportMode 模式選擇步驟。
    // 本檔焦點為檔案讀取私有方法，stub promptImportMode 回 'overwrite' 保持覆蓋語意
    // （modal 互動由 import-mode-modal.test.js 專責覆蓋）。
    controller.promptImportMode = jest.fn().mockResolvedValue('overwrite')

    // W1-049：handleFileLoad 在覆蓋模式 + 空檔案時新增二次確認 Modal B 步驟。
    // 本檔多處使用 books: [] fixture（line 884/932 等），若不 stub 會 hang 在 Modal B。
    // stub 回 true 保持原覆蓋語意（Modal B 互動由 empty-file-confirm-modal.test.js 專責）。
    controller.confirmEmptyFileOverwrite = jest.fn().mockResolvedValue(true)
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
    // W1-048.1 Stage C.3：原 _validateFileBasics() 直呼測試已透過 handleFileLoad 走 public
    // validate()（Stage B 切換）。本 describe 行為斷言保留（VALIDATION_ERROR 訊息與檔案
    // 拒絕邊界）；不再直呼底線方法。
    describe('validate() 經由 handleFileLoad 檔案基礎驗證', () => {
      test('應該通過有效JSON檔案驗證', async () => {
        // Given: 有效的 JSON 檔案
        // eslint-disable-next-line no-unused-vars
        const validFile = createMockFile('[]', 'valid.json', 'application/json')

        // When & Then: 透過 handleFileLoad 間接測試，不應拋出異常
        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: '[]' })
        )

        await expect(controller.handleFileLoad(validFile)).resolves.not.toThrow()
      })

      test('應該拒絕非JSON檔案', async () => {
        // Given: 非 JSON 檔案
        // eslint-disable-next-line no-unused-vars
        const invalidFile = createMockFile('content', 'invalid.txt', 'text/plain')

        // When & Then: 應該拋出格式錯誤
        await expect(controller.handleFileLoad(invalidFile))
          .rejects.toMatchObject({
            code: 'VALIDATION_ERROR'
          })
      })

      test('應該拒絕空檔案名稱', async () => {
        // Given: 空檔案名稱的檔案
        // eslint-disable-next-line no-unused-vars
        const noNameFile = createMockFile('[]', '', 'application/json')

        // When & Then: 應該拋出驗證錯誤
        await expect(controller.handleFileLoad(noNameFile))
          .rejects.toThrow()
      })

      test('應該拒絕null檔案', async () => {
        // Given: null 檔案
        // eslint-disable-next-line no-unused-vars
        const nullFile = null

        // When & Then: 應該拋出檔案驗證錯誤
        await expect(controller.handleFileLoad(nullFile))
          .rejects.toMatchObject({
            code: 'VALIDATION_ERROR'
          })
      })
    })

    // W1-048.1 Stage C.3：原 _validateFileSize() 直呼測試已併入 public validate()
    // （Stage A：validate = basics + size 合併）。本 describe 行為斷言保留（大小邊界）。
    describe('validate() 經由 handleFileLoad 檔案大小驗證', () => {
      test('應該通過正常大小檔案', async () => {
        // Given: 正常大小的檔案 (約1MB)
        // eslint-disable-next-line no-unused-vars
        const normalContent = JSON.stringify(Array(1000).fill(testDataSets.validBook))
        // eslint-disable-next-line no-unused-vars
        const normalFile = createMockFile(normalContent, 'normal.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: normalContent })
        )

        // When & Then: 應該成功處理
        await expect(controller.handleFileLoad(normalFile)).resolves.not.toThrow()
      })

      test('應該拒絕過大檔案', async () => {
        // Given: 過大的檔案 (超過限制)
        // eslint-disable-next-line no-unused-vars
        const hugeContent = 'x'.repeat(50 * 1024 * 1024) // 50MB
        // eslint-disable-next-line no-unused-vars
        const hugeFile = createMockFile(hugeContent, 'huge.json')

        // When & Then: 應該拋出檔案大小錯誤
        await expect(controller.handleFileLoad(hugeFile))
          .rejects.toMatchObject({
            code: 'VALIDATION_ERROR'
          })
      })

      test('應該通過空檔案（0大小）', async () => {
        // Given: 空檔案和 FileReader mock
        // eslint-disable-next-line no-unused-vars
        const emptyFile = createMockFile('', 'empty.json')

        // Mock FileReader 回傳空內容
        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: '' })
        )

        // When & Then: 應該成功處理（但內容驗證會失敗）
        await expect(controller.handleFileLoad(emptyFile))
          .rejects.toMatchObject({
            code: expect.any(String)
          })
      })
    })

    describe('_isJSONFile() 檔案格式檢查', () => {
      test('應該識別.json副檔名', async () => {
        // Given: .json 檔案
        // eslint-disable-next-line no-unused-vars
        const jsonFile = createMockFile('{}', 'test.json', 'application/json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: '{}' })
        )

        // When & Then: 應該通過檢查
        await expect(controller.handleFileLoad(jsonFile)).resolves.not.toThrow()
      })

      test('應該識別application/json MIME類型', async () => {
        // Given: 正確 MIME 類型但無副檔名的檔案
        // eslint-disable-next-line no-unused-vars
        const mimeFile = createMockFile('{}', 'noextension', 'application/json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: '{}' })
        )

        // When & Then: 應該通過檢查
        await expect(controller.handleFileLoad(mimeFile)).resolves.not.toThrow()
      })

      test('應該拒絕錯誤的副檔名和MIME類型', async () => {
        // Given: 完全不符合的檔案格式
        // eslint-disable-next-line no-unused-vars
        const wrongFile = createMockFile('content', 'test.txt', 'text/plain')

        // When & Then: 應該拋出格式錯誤
        await expect(controller.handleFileLoad(wrongFile))
          .rejects.toMatchObject({
            code: expect.any(String)
          })
      })
    })
  })

  // ⚙️ 目標 2: FileReader 操作層私有方法測試
  describe('📡 FileReader 操作層私有方法測試', () => {
    describe('_createFileReader() FileReader 建立', () => {
      test('應該建立新的 FileReader 實例', async () => {
        // Given: 有效檔案
        // eslint-disable-next-line no-unused-vars
        const validFile = createMockFile('[]', 'test.json')

        // Given: Mock FileReader 建構函式
        // eslint-disable-next-line no-unused-vars
        const mockFileReader = createAdvancedMockFileReader({ result: '[]' })
        global.FileReader = jest.fn().mockImplementation(() => mockFileReader)

        // When: 執行檔案載入
        await controller.handleFileLoad(validFile)

        // Then: 應該建立 FileReader 實例
        expect(global.FileReader).toHaveBeenCalled()
      })

      test('應該處理 FileReader 不存在的情況', async () => {
        // Given: 移除 FileReader 支援
        // eslint-disable-next-line no-unused-vars
        const originalFileReader = global.FileReader
        global.FileReader = undefined

        try {
          // Given: 有效檔案
          // eslint-disable-next-line no-unused-vars
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
        // eslint-disable-next-line no-unused-vars
        const validFile = createMockFile('[]', 'test.json')
        // eslint-disable-next-line no-unused-vars
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
        // eslint-disable-next-line no-unused-vars
        const bookData = JSON.stringify([testDataSets.validBook])
        // eslint-disable-next-line no-unused-vars
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
        // eslint-disable-next-line no-unused-vars
        const validFile = createMockFile('[]', 'test.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ shouldError: true })
        )

        // When & Then: 應該拋出讀取錯誤
        await expect(controller.handleFileLoad(validFile))
          .rejects.toMatchObject({
            code: expect.any(String)
          })
      })
    })

    // W1-048.1 Stage C.3：原 _readFileWithReader() 直呼測試已透過 handleFileLoad 走 public
    // read()（Stage B 切換）。本 describe 行為斷言保留（端到端讀檔成功與非同步錯誤處理）。
    describe('read() 經由 handleFileLoad 檔案讀取協調', () => {
      test('應該協調完整的檔案讀取流程', async () => {
        // Given: 有效檔案
        // eslint-disable-next-line no-unused-vars
        const validContent = JSON.stringify([testDataSets.validBook])
        // eslint-disable-next-line no-unused-vars
        const validFile = createMockFile(validContent, 'test.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: validContent })
        )

        // When: 執行檔案載入
        await controller.handleFileLoad(validFile)

        // Then: 應該完成完整流程
        expect(controller.books).toHaveLength(1)
      })

      test('應該處理非同步讀取錯誤', async () => {
        // Given: 會在非同步過程中失敗的檔案
        // eslint-disable-next-line no-unused-vars
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
            code: expect.any(String)
          })
      })
    })
  })

  // 🧹 目標 3: 內容處理層私有方法測試
  describe('🧹 內容處理層私有方法測試', () => {
    describe('_validateAndCleanContent() 內容驗證與清理', () => {
      test('應該通過有效內容驗證', async () => {
        // Given: 有效 JSON 內容
        // eslint-disable-next-line no-unused-vars
        const validContent = JSON.stringify([testDataSets.validBook])
        // eslint-disable-next-line no-unused-vars
        const validFile = createMockFile(validContent, 'test.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: validContent })
        )

        // When & Then: 應該成功處理
        await expect(controller.handleFileLoad(validFile)).resolves.not.toThrow()
      })

      test('應該拒絕空內容', async () => {
        // Given: 空內容
        // eslint-disable-next-line no-unused-vars
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
        // eslint-disable-next-line no-unused-vars
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
        // eslint-disable-next-line no-unused-vars
        const paddedContent = `  \n${JSON.stringify([testDataSets.validBook])}  \n`
        // eslint-disable-next-line no-unused-vars
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
        // eslint-disable-next-line no-unused-vars
        const bomContent = '\uFEFF' + JSON.stringify([testDataSets.validBook])
        // eslint-disable-next-line no-unused-vars
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
        // eslint-disable-next-line no-unused-vars
        const normalContent = JSON.stringify([testDataSets.validBook])
        // eslint-disable-next-line no-unused-vars
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
        // eslint-disable-next-line no-unused-vars
        const validJSON = JSON.stringify({ books: [testDataSets.validBook] })
        // eslint-disable-next-line no-unused-vars
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
        // eslint-disable-next-line no-unused-vars
        const invalidJSON = '{ "books": [invalid json} '
        // eslint-disable-next-line no-unused-vars
        const invalidFile = createMockFile(invalidJSON, 'invalid.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: invalidJSON })
        )

        // When & Then: 應該拋出 JSON 格式錯誤
        await expect(controller.handleFileLoad(invalidFile))
          .rejects.toMatchObject({
            code: expect.any(String)
          })
      })

      test('應該處理空 JSON 對象', async () => {
        // Given: 空 JSON 對象
        // eslint-disable-next-line no-unused-vars
        const emptyJSON = '{}'
        // eslint-disable-next-line no-unused-vars
        const emptyFile = createMockFile(emptyJSON, 'empty.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: emptyJSON })
        )

        // When: 執行處理
        await controller.handleFileLoad(emptyFile)

        // Then: 應該成功處理（但沒有書籍資料）
        expect(controller.books).toHaveLength(0)
      })

      test('應該處理包含特殊字符的 JSON', async () => {
        // Given: 包含特殊字符的書籍資料
        // 註：v2 轉換產出固定 schema，v1-passthrough 自訂欄位（如 description）
        // 不保留。本測試核心驗證為「特殊字符經 JSON 解析正確保留」，
        // 由 v2 schema 內欄位 title（含特殊字符）驗證即足。
        // eslint-disable-next-line no-unused-vars
        const specialBook = {
          ...testDataSets.validBook,
          title: '特殊字符📚測試\n"引號"\'單引號\''
        }
        // eslint-disable-next-line no-unused-vars
        const specialJSON = JSON.stringify([specialBook])
        // eslint-disable-next-line no-unused-vars
        const specialFile = createMockFile(specialJSON, 'special.json')

        global.FileReader = jest.fn().mockImplementation(() =>
          createAdvancedMockFileReader({ result: specialJSON })
        )

        // When: 執行處理
        await controller.handleFileLoad(specialFile)

        // Then: 應該正確處理特殊字符
        expect(controller.books).toHaveLength(1)
        expect(controller.books[0].title).toBe(specialBook.title)
      })
    })
  })

  // W1-048.1 Stage C.6 / Phase 2 §3.3：controller 不再暴露 test-only proxy
  // 此 describe 為 regression：proxy 三方法已於 Stage C.7 移除（行 1482-1516）。
  describe('Controller test-only proxy 移除 regression（W1-048.1 Stage C.7）', () => {
    test('controller 不再暴露 _handleFileContent / _validateFileBasics / _validateFileSize', () => {
      expect(controller._handleFileContent).toBeUndefined()
      expect(controller._validateFileBasics).toBeUndefined()
      expect(controller._validateFileSize).toBeUndefined()
    })
  })

  // W1-048.10.1.4 Stage C：BookFileImporter 改 orchestrator 後，
  // 底線私有方法（_validateFileBasics / _validateFileSize / _readFileWithReader /
  // _handleFileContent）已隨 Stage B 移除；改採 DI 注入 validator / reader / parser 三個 helper class。
  // 本 describe 為反向斷言：確保未來 PR 不會誤把底線方法加回去。
  describe('BookFileImporter 不再暴露底線方法（W1-048.10.1.4 Stage B 後）', () => {
    let importer

    beforeAll(() => {
      // 動態 require，避免影響上方 describe 的 require 鏈
      const { BookFileImporter } = require('src/overview/book-file-importer')
      importer = new BookFileImporter({
        document: global.document,
        showError: () => {}
      })
    })

    test('importer 不再暴露 _validateFileBasics / _validateFileSize / _readFileWithReader / _handleFileContent', () => {
      expect(importer._validateFileBasics).toBeUndefined()
      expect(importer._validateFileSize).toBeUndefined()
      expect(importer._readFileWithReader).toBeUndefined()
      expect(importer._handleFileContent).toBeUndefined()
    })

    test('importer 不再暴露 17 個子 helper（CSV / JSON / 書籍處理）', () => {
      // 取樣關鍵子 helper，確認皆已搬遷至 ContentParser / FileValidator / FileContentReader
      expect(importer._isJSONFile).toBeUndefined()
      expect(importer._isCSVFile).toBeUndefined()
      expect(importer._parseCSVContent).toBeUndefined()
      expect(importer._parseJSONContent).toBeUndefined()
      expect(importer._extractBooksFromData).toBeUndefined()
      expect(importer._processBookData).toBeUndefined()
      expect(importer._filterValidBooks).toBeUndefined()
      expect(importer._validateRequiredFields).toBeUndefined()
      expect(importer._isValidBook).toBeUndefined()
      expect(importer._handleReaderSuccess).toBeUndefined()
      expect(importer._handleReaderError).toBeUndefined()
    })

    test('importer DI 注入點存在且為 helper class 實例', () => {
      const { FileValidator } = require('src/overview/import/file-validator')
      const { FileContentReader } = require('src/overview/import/file-reader')
      const { ContentParser } = require('src/overview/import/content-parser')

      expect(importer.validator).toBeInstanceOf(FileValidator)
      expect(importer.reader).toBeInstanceOf(FileContentReader)
      expect(importer.parser).toBeInstanceOf(ContentParser)

      // helper class 對應 method 存在（不檢內部實作）
      expect(typeof importer.validator.validate).toBe('function')
      expect(typeof importer.validator.detectFormat).toBe('function')
      expect(typeof importer.reader.read).toBe('function')
      expect(typeof importer.parser.parse).toBe('function')
    })

    test('importer public API 維持向後相容（4 個 thin wrapper + W1-048.10.1.5 public API）', () => {
      // 4 個 thin wrapper public API
      expect(typeof importer.handleFileLoad).toBe('function')
      expect(typeof importer.validate).toBe('function')
      expect(typeof importer.read).toBe('function')
      expect(typeof importer.parseContent).toBe('function')
      // W1-048.10.1.5 系列加入的 public API（delegate at Stage B）
      expect(typeof importer.isCSVFile).toBe('function')
      expect(typeof importer.extractBooksFromData).toBe('function')
      expect(typeof importer.processBookData).toBe('function')
      expect(typeof importer.validateRequiredFields).toBe('function')
      expect(typeof importer.filterValidBooks).toBe('function')
    })
  })

  // W1-048.10.1.4 Stage C：DI constructor 行為測試
  // 驗證 constructor 預設自建 helper / 注入時保留參考 / 預設 reader 依賴注入 parser
  describe('BookFileImporter constructor (DI)（W1-048.10.1.4 Stage A）', () => {
    let BookFileImporter
    let FileValidator
    let FileContentReader
    let ContentParser

    beforeAll(() => {
      BookFileImporter = require('src/overview/book-file-importer').BookFileImporter
      FileValidator = require('src/overview/import/file-validator').FileValidator
      FileContentReader = require('src/overview/import/file-reader').FileContentReader
      ContentParser = require('src/overview/import/content-parser').ContentParser
    })

    test('預設情境：constructor 僅傳 document/showError，自建三個 helper 實例', () => {
      const importer = new BookFileImporter({
        document: global.document,
        showError: () => {}
      })
      expect(importer.validator).toBeInstanceOf(FileValidator)
      expect(importer.reader).toBeInstanceOf(FileContentReader)
      expect(importer.parser).toBeInstanceOf(ContentParser)
    })

    test('注入 validator：importer.validator 為注入實例（identity check）', () => {
      const stubValidator = { validate: jest.fn(), detectFormat: jest.fn(() => 'json') }
      const importer = new BookFileImporter({
        document: global.document,
        showError: () => {},
        validator: stubValidator
      })
      expect(importer.validator).toBe(stubValidator)
    })

    test('注入 reader：importer.reader 為注入實例（identity check）', () => {
      const stubReader = { read: jest.fn().mockResolvedValue({ books: [], tagCategories: [], tags: [] }) }
      const importer = new BookFileImporter({
        document: global.document,
        showError: () => {},
        reader: stubReader
      })
      expect(importer.reader).toBe(stubReader)
    })

    test('注入 parser：importer.parser 為注入實例（identity check）', () => {
      const stubParser = { parse: jest.fn() }
      const importer = new BookFileImporter({
        document: global.document,
        showError: () => {},
        parser: stubParser
      })
      expect(importer.parser).toBe(stubParser)
    })

    test('僅注入 parser：預設 reader 內部仍使用注入的 parser（生產情境鏈一致）', () => {
      // 透過 reader.read 觸發 parser.parse 確認鏈是否一致
      const stubParser = {
        parse: jest.fn().mockReturnValue({ books: [{ id: 'p1', title: 'parsed' }], tagCategories: [], tags: [] })
      }
      const importer = new BookFileImporter({
        document: global.document,
        showError: () => {},
        parser: stubParser
      })
      // importer.parser 為注入的 stub
      expect(importer.parser).toBe(stubParser)
      // 預設 reader 的內部 parser 應為同一個 stub（鏈一致）
      // 透過 reader._parser 私有欄位驗證（FileContentReader 內部命名）
      expect(importer.reader._parser).toBe(stubParser)
    })
  })

  // W1-048.10.1.4 Stage C：4 public method thin wrapper delegate 驗證
  describe('BookFileImporter public method thin wrapper delegate（W1-048.10.1.4 Stage B）', () => {
    let BookFileImporter

    beforeAll(() => {
      BookFileImporter = require('src/overview/book-file-importer').BookFileImporter
    })

    function createImporter (overrides = {}) {
      const stubValidator = overrides.validator || { validate: jest.fn(), detectFormat: jest.fn(() => 'json') }
      const stubReader = overrides.reader || {
        read: jest.fn().mockResolvedValue({ books: [], tagCategories: [], tags: [] })
      }
      const stubParser = overrides.parser || {
        parse: jest.fn().mockReturnValue({ books: [], tagCategories: [], tags: [] })
      }
      const importer = new BookFileImporter({
        document: global.document,
        showError: () => {},
        validator: stubValidator,
        reader: stubReader,
        parser: stubParser
      })
      return { importer, stubValidator, stubReader, stubParser }
    }

    test('validate(file) delegate to validator.validate', () => {
      const { importer, stubValidator } = createImporter()
      const file = { name: 'x.json', type: 'application/json' }
      importer.validate(file)
      expect(stubValidator.validate).toHaveBeenCalledTimes(1)
      expect(stubValidator.validate).toHaveBeenCalledWith(file)
    })

    test('read(file) delegate to reader.read and 回傳值透傳', async () => {
      const fixture = { books: [{ id: 'b1', title: 't1' }], tagCategories: [], tags: [] }
      const { importer, stubReader } = createImporter({
        reader: { read: jest.fn().mockResolvedValue(fixture) }
      })
      const file = { name: 'x.json', type: 'application/json' }
      const result = await importer.read(file)
      expect(stubReader.read).toHaveBeenCalledTimes(1)
      expect(stubReader.read).toHaveBeenCalledWith(file)
      expect(result).toBe(fixture)
    })

    test('parseContent(content, fileFormat) delegate to parser.parse', () => {
      const fixture = { books: [{ id: 'p1', title: 'pt' }], tagCategories: [], tags: [] }
      const { importer, stubParser } = createImporter({
        parser: { parse: jest.fn().mockReturnValue(fixture) }
      })
      const result = importer.parseContent('{"x":1}', 'json')
      expect(stubParser.parse).toHaveBeenCalledTimes(1)
      expect(stubParser.parse).toHaveBeenCalledWith('{"x":1}', 'json')
      expect(result).toBe(fixture)
    })

    test('handleFileLoad(file) 順序：validate 先於 read', async () => {
      const { importer, stubValidator, stubReader } = createImporter()
      const file = { name: 'x.json', type: 'application/json' }
      await importer.handleFileLoad(file)
      expect(stubValidator.validate).toHaveBeenCalledTimes(1)
      expect(stubReader.read).toHaveBeenCalledTimes(1)
      // 順序驗證：validate.mock.invocationCallOrder[0] < read.mock.invocationCallOrder[0]
      expect(stubValidator.validate.mock.invocationCallOrder[0])
        .toBeLessThan(stubReader.read.mock.invocationCallOrder[0])
    })

    test('handleFileLoad validate throw → reader.read 不被呼叫（短路）', async () => {
      const validationError = new Error('validation fail')
      const { importer, stubReader } = createImporter({
        validator: {
          validate: jest.fn(() => { throw validationError }),
          detectFormat: jest.fn(() => 'json')
        }
      })
      const file = { name: 'x.json', type: 'application/json' }
      let caught = null
      try {
        await importer.handleFileLoad(file)
      } catch (err) {
        caught = err
      }
      expect(caught).toBe(validationError)
      expect(stubReader.read).not.toHaveBeenCalled()
    })

    test('isCSVFile(file) delegate to validator.detectFormat === "csv"', () => {
      const { importer, stubValidator } = createImporter({
        validator: { validate: jest.fn(), detectFormat: jest.fn(() => 'csv') }
      })
      expect(importer.isCSVFile({ name: 'x.csv', type: 'text/csv' })).toBe(true)
      expect(stubValidator.detectFormat).toHaveBeenCalledTimes(1)
    })
  })
})
