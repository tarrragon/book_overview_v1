const { ErrorCodes } = require('src/core/errors/ErrorCodes')
/**
 * UC-04 資料匯入功能測試套件
 * 測試目標：loadFromFile() 完整功能覆蓋 10% → 90%
 */

// 移除 JSDOM 導入，使用簡單的 DOM 模擬

// 模擬全域變數和函數
global.alert = jest.fn()
global.booksData = []
global.renderTable = jest.fn()

// 模擬 DOM 元素 - 需要在模擬元素定義後設定
// let mockDocument - 移除未使用的變數

// 模擬檔案輸入元素
global.mockFileInput = {
  files: []
}

// 模擬檔案上傳介面元素
global.mockFileUploader = {
  style: { display: 'block' }
}

// 設定模擬 document 物件
global.document = {
  getElementById: (id) => {
    if (id === 'jsonFileInput') {
      return global.mockFileInput
    }
    if (id === 'fileUploader') {
      return global.mockFileUploader
    }
    return null
  }
}

// 要測試的 loadFromFile 函數
function loadFromFile () {
  // eslint-disable-next-line no-unused-vars
  const fileInput = document.getElementById('jsonFileInput')
  // eslint-disable-next-line no-unused-vars
  const file = fileInput.files[0]

  if (!file) {
    alert('請先選擇一個 JSON 檔案！')
    return
  }

  if (!file.name.toLowerCase().endsWith('.json')) {
    alert('請選擇 JSON 格式的檔案！')
    return
  }

  // eslint-disable-next-line no-unused-vars
  const reader = new FileReader()
  reader.onload = function (e) {
    try {
      // eslint-disable-next-line no-unused-vars
      const jsonData = JSON.parse(e.target.result)

      // 驗證 JSON 格式
      if (!Array.isArray(jsonData)) {
        throw (() => { const error = new Error('JSON 檔案應該包含一個陣列'); error.code = ErrorCodes.DATA_IMPORT_FORMAT_ERROR; error.details = { category: 'testing' }; return error })()
      }

      // 驗證每個書籍物件的格式
      for (let i = 0; i < jsonData.length; i++) {
        // eslint-disable-next-line no-unused-vars
        const book = jsonData[i]
        if (!book.id || !book.title || !book.cover) {
          throw (() => { const error = new Error(`第 ${i + 1} 個書籍缺少必要欄位 (id, title, cover)`); error.code = ErrorCodes.DATA_IMPORT_FIELD_ERROR; error.details = { category: 'testing' }; return error })()
        }
      }

      // 載入資料
      global.booksData.length = 0 // 清空現有資料
      global.booksData.push(...jsonData)

      // 隱藏檔案上傳介面
      document.getElementById('fileUploader').style.display = 'none'

      // 重新渲染表格
      global.renderTable()

      alert(`成功載入 ${jsonData.length} 本書籍資料！`)
    } catch (error) {
      alert(`載入檔案失敗：${error.message}`)
    }
  }

  reader.onerror = function () {
    alert('讀取檔案時發生錯誤！')
  }

  reader.readAsText(file, 'UTF-8')
}

describe('🎯 UC-04 資料匯入功能測試套件', () => {
  // eslint-disable-next-line no-unused-vars
  let mockFileReader
  let originalFileReader

  beforeAll(() => {
    originalFileReader = global.FileReader
  })

  beforeEach(() => {
    // 重置模擬函數
    jest.clearAllMocks()
    global.booksData.length = 0

    // 重置模擬 DOM 元素
    global.mockFileInput = {
      files: []
    }
    global.mockFileUploader = {
      style: { display: 'block' }
    }

    // 使用 jest.spyOn 模擬 document.getElementById
    jest.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'jsonFileInput') {
        return global.mockFileInput
      }
      if (id === 'fileUploader') {
        return global.mockFileUploader
      }
      return null
    })

    // 模擬 FileReader
    mockFileReader = {
      onload: null,
      onerror: null,
      result: '',
      readAsText: jest.fn()
    }

    global.FileReader = jest.fn(() => mockFileReader)
  })

  afterEach(() => {
    // 恢復所有模擬
    jest.restoreAllMocks()
  })

  afterAll(() => {
    global.FileReader = originalFileReader
  })

  /**
     * 建立模擬檔案對象
     */
  function createMockFile (content, name = 'test.json') {
    return {
      name,
      content
    }
  }

  /**
     * 模擬檔案輸入元素
     */
  function mockFileInput (file) {
    global.mockFileInput.files = file ? [file] : []
  }

  describe('📝 基本檔案驗證測試', () => {
    test('應該在沒有選擇檔案時顯示錯誤訊息', () => {
      mockFileInput(null)

      loadFromFile()

      expect(global.alert).toHaveBeenCalledWith('請先選擇一個 JSON 檔案！')
    })

    test('應該在選擇非 JSON 檔案時顯示錯誤訊息', () => {
      // eslint-disable-next-line no-unused-vars
      const txtFile = createMockFile('test content', 'test.txt')
      mockFileInput(txtFile)

      loadFromFile()

      expect(global.alert).toHaveBeenCalledWith('請選擇 JSON 格式的檔案！')
    })

    test('應該接受 JSON 檔案（小寫副檔名）', () => {
      // eslint-disable-next-line no-unused-vars
      const jsonFile = createMockFile('[]', 'test.json')
      mockFileInput(jsonFile)

      loadFromFile()

      expect(mockFileReader.readAsText).toHaveBeenCalledWith(jsonFile, 'UTF-8')
    })

    test('應該接受 JSON 檔案（大寫副檔名）', () => {
      // eslint-disable-next-line no-unused-vars
      const jsonFile = createMockFile('[]', 'TEST.JSON')
      mockFileInput(jsonFile)

      loadFromFile()

      expect(mockFileReader.readAsText).toHaveBeenCalledWith(jsonFile, 'UTF-8')
    })
  })

  describe('📚 JSON 內容驗證測試', () => {
    test('應該拒絕非陣列格式的 JSON', async () => {
      // eslint-disable-next-line no-unused-vars
      const jsonFile = createMockFile('{}', 'test.json')
      mockFileInput(jsonFile)

      loadFromFile()

      // 模擬 FileReader 載入完成
      mockFileReader.result = '{}'
      mockFileReader.onload({ target: { result: '{}' } })

      expect(global.alert).toHaveBeenCalledWith('載入檔案失敗：JSON 檔案應該包含一個陣列')
    })

    test('應該接受空陣列', async () => {
      // eslint-disable-next-line no-unused-vars
      const jsonFile = createMockFile('[]', 'test.json')
      mockFileInput(jsonFile)

      loadFromFile()

      mockFileReader.result = '[]'
      mockFileReader.onload({ target: { result: '[]' } })

      expect(global.alert).toHaveBeenCalledWith('成功載入 0 本書籍資料！')
    })

    test('應該驗證書籍物件必要欄位 - 缺少 id', async () => {
      // eslint-disable-next-line no-unused-vars
      const invalidBook = [{ title: 'Test Book', cover: 'test.jpg' }]
      // eslint-disable-next-line no-unused-vars
      const jsonFile = createMockFile(JSON.stringify(invalidBook), 'test.json')
      mockFileInput(jsonFile)

      loadFromFile()

      mockFileReader.result = JSON.stringify(invalidBook)
      mockFileReader.onload({ target: { result: JSON.stringify(invalidBook) } })

      expect(global.alert).toHaveBeenCalledWith('載入檔案失敗：第 1 個書籍缺少必要欄位 (id, title, cover)')
    })

    test('應該驗證書籍物件必要欄位 - 缺少 title', async () => {
      // eslint-disable-next-line no-unused-vars
      const invalidBook = [{ id: '123', cover: 'test.jpg' }]
      // eslint-disable-next-line no-unused-vars
      const jsonFile = createMockFile(JSON.stringify(invalidBook), 'test.json')
      mockFileInput(jsonFile)

      loadFromFile()

      mockFileReader.result = JSON.stringify(invalidBook)
      mockFileReader.onload({ target: { result: JSON.stringify(invalidBook) } })

      expect(global.alert).toHaveBeenCalledWith('載入檔案失敗：第 1 個書籍缺少必要欄位 (id, title, cover)')
    })

    test('應該驗證書籍物件必要欄位 - 缺少 cover', async () => {
      // eslint-disable-next-line no-unused-vars
      const invalidBook = [{ id: '123', title: 'Test Book' }]
      // eslint-disable-next-line no-unused-vars
      const jsonFile = createMockFile(JSON.stringify(invalidBook), 'test.json')
      mockFileInput(jsonFile)

      loadFromFile()

      mockFileReader.result = JSON.stringify(invalidBook)
      mockFileReader.onload({ target: { result: JSON.stringify(invalidBook) } })

      expect(global.alert).toHaveBeenCalledWith('載入檔案失敗：第 1 個書籍缺少必要欄位 (id, title, cover)')
    })
  })

  describe('✅ 成功載入測試', () => {
    test('應該成功載入有效的書籍資料', async () => {
      // eslint-disable-next-line no-unused-vars
      const validBooks = [
        { id: '1', title: '測試書籍1', cover: 'cover1.jpg' },
        { id: '2', title: '測試書籍2', cover: 'cover2.jpg' }
      ]
      // eslint-disable-next-line no-unused-vars
      const jsonFile = createMockFile(JSON.stringify(validBooks), 'test.json')
      mockFileInput(jsonFile)

      loadFromFile()

      mockFileReader.result = JSON.stringify(validBooks)
      mockFileReader.onload({ target: { result: JSON.stringify(validBooks) } })

      expect(global.booksData).toEqual(validBooks)
      expect(global.alert).toHaveBeenCalledWith('成功載入 2 本書籍資料！')
      expect(global.renderTable).toHaveBeenCalled()
    })

    test('應該清空原有資料並載入新資料', async () => {
      // 預先設置一些資料
      global.booksData.push({ id: 'old', title: 'Old Book', cover: 'old.jpg' })

      // eslint-disable-next-line no-unused-vars
      const newBooks = [
        { id: '1', title: '新書籍', cover: 'new.jpg' }
      ]
      // eslint-disable-next-line no-unused-vars
      const jsonFile = createMockFile(JSON.stringify(newBooks), 'test.json')
      mockFileInput(jsonFile)

      loadFromFile()

      mockFileReader.result = JSON.stringify(newBooks)
      mockFileReader.onload({ target: { result: JSON.stringify(newBooks) } })

      expect(global.booksData).toEqual(newBooks)
      expect(global.booksData).toHaveLength(1)
    })

    test('應該隱藏檔案上傳介面', async () => {
      // eslint-disable-next-line no-unused-vars
      const validBooks = [{ id: '1', title: 'Test', cover: 'test.jpg' }]
      // eslint-disable-next-line no-unused-vars
      const jsonFile = createMockFile(JSON.stringify(validBooks), 'test.json')
      mockFileInput(jsonFile)

      loadFromFile()

      mockFileReader.result = JSON.stringify(validBooks)
      mockFileReader.onload({ target: { result: JSON.stringify(validBooks) } })

      // eslint-disable-next-line no-unused-vars
      const fileUploader = document.getElementById('fileUploader')
      expect(fileUploader.style.display).toBe('none')
    })
  })

  describe('🔧 FileReader 錯誤處理測試', () => {
    test('應該處理 FileReader 讀取錯誤', () => {
      // eslint-disable-next-line no-unused-vars
      const jsonFile = createMockFile('[]', 'test.json')
      mockFileInput(jsonFile)

      loadFromFile()

      // 模擬 FileReader 錯誤
      mockFileReader.onerror()

      expect(global.alert).toHaveBeenCalledWith('讀取檔案時發生錯誤！')
    })

    test('應該處理 JSON 解析錯誤', async () => {
      // eslint-disable-next-line no-unused-vars
      const jsonFile = createMockFile('invalid json', 'test.json')
      mockFileInput(jsonFile)

      loadFromFile()

      mockFileReader.result = 'invalid json'
      mockFileReader.onload({ target: { result: 'invalid json' } })

      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('載入檔案失敗：'))
    })
  })

  describe('🎯 邊界情況測試', () => {
    test('應該處理包含完整書籍資訊的複雜物件', async () => {
      // eslint-disable-next-line no-unused-vars
      const complexBook = [{
        id: '123',
        title: '複雜測試書籍',
        cover: 'complex.jpg',
        author: '測試作者',
        description: '這是一個測試描述',
        pages: 300,
        genres: ['科幻', '冒險']
      }]
      // eslint-disable-next-line no-unused-vars
      const jsonFile = createMockFile(JSON.stringify(complexBook), 'test.json')
      mockFileInput(jsonFile)

      loadFromFile()

      mockFileReader.result = JSON.stringify(complexBook)
      mockFileReader.onload({ target: { result: JSON.stringify(complexBook) } })

      expect(global.booksData).toEqual(complexBook)
      expect(global.alert).toHaveBeenCalledWith('成功載入 1 本書籍資料！')
    })

    test('應該處理大量書籍資料', async () => {
      // eslint-disable-next-line no-unused-vars
      const manyBooks = Array.from({ length: 100 }, (_, i) => ({
        id: `book_${i}`,
        title: `書籍 ${i}`,
        cover: `cover_${i}.jpg`
      }))
      // eslint-disable-next-line no-unused-vars
      const jsonFile = createMockFile(JSON.stringify(manyBooks), 'test.json')
      mockFileInput(jsonFile)

      loadFromFile()

      mockFileReader.result = JSON.stringify(manyBooks)
      mockFileReader.onload({ target: { result: JSON.stringify(manyBooks) } })

      expect(global.booksData).toHaveLength(100)
      expect(global.alert).toHaveBeenCalledWith('成功載入 100 本書籍資料！')
    })

    test('應該處理包含特殊字符的書籍資料', async () => {
      // eslint-disable-next-line no-unused-vars
      const specialBook = [{
        id: 'special-123',
        title: '特殊字符書籍 "引號" & <標籤>',
        cover: 'special.jpg'
      }]
      // eslint-disable-next-line no-unused-vars
      const jsonFile = createMockFile(JSON.stringify(specialBook), 'test.json')
      mockFileInput(jsonFile)

      loadFromFile()

      mockFileReader.result = JSON.stringify(specialBook)
      mockFileReader.onload({ target: { result: JSON.stringify(specialBook) } })

      expect(global.booksData).toEqual(specialBook)
      expect(global.alert).toHaveBeenCalledWith('成功載入 1 本書籍資料！')
    })
  })

  describe('🔄 覆蓋/合併模式測試', () => {
    test('應該完全覆蓋現有資料（覆蓋模式）', async () => {
      // 設置初始資料
      global.booksData.push(
        { id: 'old1', title: '舊書1', cover: 'old1.jpg' },
        { id: 'old2', title: '舊書2', cover: 'old2.jpg' }
      )

      // eslint-disable-next-line no-unused-vars
      const newBooks = [
        { id: 'new1', title: '新書1', cover: 'new1.jpg' }
      ]
      // eslint-disable-next-line no-unused-vars
      const jsonFile = createMockFile(JSON.stringify(newBooks), 'test.json')
      mockFileInput(jsonFile)

      loadFromFile()

      mockFileReader.result = JSON.stringify(newBooks)
      mockFileReader.onload({ target: { result: JSON.stringify(newBooks) } })

      // 驗證舊資料被完全覆蓋
      expect(global.booksData).toEqual(newBooks)
      expect(global.booksData.find(book => book.id === 'old1')).toBeUndefined()
      expect(global.booksData.find(book => book.id === 'old2')).toBeUndefined()
    })
  })
})
