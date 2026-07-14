/**
 * 多書城 Storage 隔離單元測試 (Phase 2 RED)
 *
 * 業務情境：
 * - 1.6.0-W2-003: 多書城提取結果儲存隔離（防覆蓋）
 * - 用戶回報：先提取博客來再提取 Kobo，後者資料覆蓋前者
 * - 原因：單一 storage key `readmoo_books` 承載所有書城資料
 *
 * 測試範疇：
 * - PLATFORM_IDS 常數與 platformBooksKey() helper
 * - 各書城寫入獨立 storage key
 * - 讀取時合併所有書城書目
 * - 提取一個書城不影響其他書城資料
 */

describe('PLATFORM_IDS 常數', () => {
  let PLATFORM_IDS

  beforeAll(() => {
    const constants = require('../../../src/background/constants/module-constants')
    PLATFORM_IDS = constants.PLATFORM_IDS
  })

  test('PLATFORM_IDS 已匯出且包含 readmoo', () => {
    expect(PLATFORM_IDS).toBeDefined()
    expect(PLATFORM_IDS.READMOO).toBe('readmoo')
  })

  test('PLATFORM_IDS 包含所有已知書城', () => {
    expect(PLATFORM_IDS.READMOO).toBe('readmoo')
    expect(PLATFORM_IDS.BOOKS_COM_TW).toBe('books_com_tw')
    expect(PLATFORM_IDS.KOBO).toBe('kobo')
    expect(PLATFORM_IDS.BOOKWALKER).toBe('bookwalker')
    expect(PLATFORM_IDS.KINDLE).toBe('kindle')
  })
})

describe('platformBooksKey() helper', () => {
  let platformBooksKey

  beforeAll(() => {
    const constants = require('../../../src/background/constants/module-constants')
    platformBooksKey = constants.platformBooksKey
  })

  test('已匯出為函式', () => {
    expect(typeof platformBooksKey).toBe('function')
  })

  test('readmoo 回傳 readmoo_books（向後相容）', () => {
    expect(platformBooksKey('readmoo')).toBe('readmoo_books')
  })

  test('kobo 回傳 kobo_books', () => {
    expect(platformBooksKey('kobo')).toBe('kobo_books')
  })

  test('books_com_tw 回傳 books_com_tw_books', () => {
    expect(platformBooksKey('books_com_tw')).toBe('books_com_tw_books')
  })

  test('格式為 {platformId}_books', () => {
    expect(platformBooksKey('kindle')).toBe('kindle_books')
    expect(platformBooksKey('bookwalker')).toBe('bookwalker_books')
  })
})

describe('STORAGE_KEYS 向後相容', () => {
  let STORAGE_KEYS, platformBooksKey

  beforeAll(() => {
    const constants = require('../../../src/background/constants/module-constants')
    STORAGE_KEYS = constants.STORAGE_KEYS
    platformBooksKey = constants.platformBooksKey
  })

  test('READMOO_BOOKS 仍為 readmoo_books', () => {
    expect(STORAGE_KEYS.READMOO_BOOKS).toBe('readmoo_books')
  })

  test('platformBooksKey(readmoo) 與 STORAGE_KEYS.READMOO_BOOKS 一致', () => {
    expect(platformBooksKey('readmoo')).toBe(STORAGE_KEYS.READMOO_BOOKS)
  })
})

describe('多書城 Storage 隔離寫入', () => {
  let platformBooksKey
  let mockStorage

  beforeAll(() => {
    const constants = require('../../../src/background/constants/module-constants')
    platformBooksKey = constants.platformBooksKey
  })

  beforeEach(() => {
    mockStorage = {}
    global.chrome = {
      storage: {
        local: {
          get: jest.fn((keys, cb) => {
            const result = {}
            const keyList = Array.isArray(keys) ? keys : [keys]
            keyList.forEach(k => {
              if (mockStorage[k] !== undefined) result[k] = mockStorage[k]
            })
            if (cb) cb(result)
            return Promise.resolve(result)
          }),
          set: jest.fn((data, cb) => {
            Object.assign(mockStorage, data)
            if (cb) cb()
            return Promise.resolve()
          }),
          remove: jest.fn((keys, cb) => {
            const keyList = Array.isArray(keys) ? keys : [keys]
            keyList.forEach(k => delete mockStorage[k])
            if (cb) cb()
            return Promise.resolve()
          })
        }
      },
      runtime: { lastError: null }
    }
  })

  afterEach(() => {
    delete global.chrome
  })

  test('Readmoo 提取寫入 readmoo_books key', async () => {
    const key = platformBooksKey('readmoo')
    const books = [{ id: 'r1', title: 'Book A', source: 'readmoo' }]
    await chrome.storage.local.set({ [key]: { books } })

    expect(mockStorage.readmoo_books).toBeDefined()
    expect(mockStorage.readmoo_books.books).toHaveLength(1)
    expect(mockStorage.readmoo_books.books[0].source).toBe('readmoo')
  })

  test('Kobo 提取寫入 kobo_books key（不影響 readmoo）', async () => {
    mockStorage.readmoo_books = {
      books: [{ id: 'r1', title: 'Readmoo Book', source: 'readmoo' }]
    }

    const koboKey = platformBooksKey('kobo')
    const koboBooks = [{ id: 'k1', title: 'Kobo Book', source: 'kobo' }]
    await chrome.storage.local.set({ [koboKey]: { books: koboBooks } })

    expect(mockStorage.readmoo_books.books).toHaveLength(1)
    expect(mockStorage.readmoo_books.books[0].title).toBe('Readmoo Book')

    expect(mockStorage.kobo_books).toBeDefined()
    expect(mockStorage.kobo_books.books).toHaveLength(1)
    expect(mockStorage.kobo_books.books[0].title).toBe('Kobo Book')
  })

  test('三個書城資料互不影響', async () => {
    const platforms = ['readmoo', 'kobo', 'books_com_tw']
    for (const p of platforms) {
      const key = platformBooksKey(p)
      await chrome.storage.local.set({
        [key]: { books: [{ id: `${p}-1`, title: `${p} Book`, source: p }] }
      })
    }

    expect(Object.keys(mockStorage)).toHaveLength(3)
    expect(mockStorage.readmoo_books.books[0].source).toBe('readmoo')
    expect(mockStorage.kobo_books.books[0].source).toBe('kobo')
    expect(mockStorage.books_com_tw_books.books[0].source).toBe('books_com_tw')
  })
})

describe('多書城 Storage 合併讀取', () => {
  let loadAllPlatformBooks
  let mockStorage

  beforeAll(() => {
    try {
      const helpers = require('../../../src/storage/helpers/multi-platform-storage')
      loadAllPlatformBooks = helpers.loadAllPlatformBooks
    } catch (e) {
      // Phase 2 RED: 模組尚未建立
    }
  })

  beforeEach(() => {
    mockStorage = {
      readmoo_books: {
        books: [
          { id: 'r1', title: 'Readmoo A', source: 'readmoo' },
          { id: 'r2', title: 'Readmoo B', source: 'readmoo' }
        ]
      },
      kobo_books: {
        books: [
          { id: 'k1', title: 'Kobo A', source: 'kobo' }
        ]
      }
    }

    global.chrome = {
      storage: {
        local: {
          get: jest.fn((keys) => {
            const result = {}
            const keyList = Array.isArray(keys) ? keys : [keys]
            keyList.forEach(k => {
              if (mockStorage[k] !== undefined) result[k] = mockStorage[k]
            })
            return Promise.resolve(result)
          })
        }
      },
      runtime: { lastError: null }
    }
  })

  afterEach(() => {
    delete global.chrome
  })

  test('loadAllPlatformBooks 合併所有書城書目', async () => {
    expect(loadAllPlatformBooks).toBeDefined()

    const allBooks = await loadAllPlatformBooks()
    expect(allBooks).toHaveLength(3)

    const sources = allBooks.map(b => b.source)
    expect(sources).toContain('readmoo')
    expect(sources).toContain('kobo')
  })

  test('空書城不影響合併結果', async () => {
    expect(loadAllPlatformBooks).toBeDefined()

    mockStorage.kindle_books = { books: [] }
    const allBooks = await loadAllPlatformBooks()
    expect(allBooks).toHaveLength(3)
  })

  test('缺失書城 key 不報錯', async () => {
    expect(loadAllPlatformBooks).toBeDefined()

    const allBooks = await loadAllPlatformBooks()
    expect(allBooks).toHaveLength(3)
  })
})
