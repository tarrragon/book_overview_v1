/**
 * event-coordinator ID 正規化測試
 *
 * Ticket: 1.6.0-W4-002（source: 1.6.0-W3-007 ANA）
 *
 * 測試目標：
 *   驗證 EventCoordinator 的 EXTRACTION.COMPLETED handler 在寫入
 *   chrome.storage.local 前，對每本 book 正規化 id 欄位：
 *   1. bookId → platformBookId 映射（kobo/books-com-tw adapter 欄位）
 *   2. id 為 falsy 時自動生成 UUID（crypto.randomUUID）
 *   3. readmoo 既有 id（stable-id-generator 產生）不被覆蓋
 *
 * 涵蓋三種 adapter 欄位結構：
 *   - readmoo：id（stable-id-generator 保證 truthy）
 *   - kobo：bookId（DOM 提取 ebook slug）
 *   - books-com-tw：bookId（可能為空字串）
 */

describe('event-coordinator ID 正規化', () => {
  let coordinator

  function getStoredBooks (source = 'readmoo') {
    const calls = chrome.storage.local.set.mock.calls
    const key = `${source}_books`
    for (let i = calls.length - 1; i >= 0; i--) {
      if (calls[i][0] && calls[i][0][key]) {
        return calls[i][0][key].books
      }
    }
    return undefined
  }

  async function createStartedCoordinator () {
    const EventCoordinator = require('src/background/events/event-coordinator')
    coordinator = new EventCoordinator()
    await coordinator.initialize()
    await coordinator.start()
    return coordinator.eventBusInstance
  }

  afterEach(() => {
    Object.keys(require.cache).forEach(key => {
      if (key.includes('src/background/')) {
        delete require.cache[key]
      }
    })
    jest.clearAllMocks()
  })

  test('readmoo：既有 truthy id 保留不被覆蓋', async () => {
    const eventBus = await createStartedCoordinator()
    const mockBooks = [{ id: 'readmoo-stable-id-1', title: 'Readmoo 書', progress: 0 }]

    await eventBus.emit('EXTRACTION.COMPLETED', {
      booksData: mockBooks,
      count: 1,
      source: 'readmoo'
    })

    const stored = getStoredBooks('readmoo')
    expect(stored[0].id).toBe('readmoo-stable-id-1')
    expect(stored[0].platformBookId).toBeUndefined()
  })

  test('kobo：bookId 映射為 platformBookId，id 自動生成 UUID', async () => {
    const eventBus = await createStartedCoordinator()
    const mockBooks = [{ bookId: 'kobo-slug-abc', title: 'Kobo 書', progress: 10 }]

    await eventBus.emit('EXTRACTION.COMPLETED', {
      booksData: mockBooks,
      count: 1,
      source: 'kobo'
    })

    const stored = getStoredBooks('kobo')
    expect(stored[0].platformBookId).toBe('kobo-slug-abc')
    expect(stored[0].id).toBeTruthy()
    expect(typeof stored[0].id).toBe('string')
    // UUID 格式驗證
    expect(stored[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  test('books-com-tw：bookId 為空字串時仍生成 UUID id', async () => {
    const eventBus = await createStartedCoordinator()
    const mockBooks = [{ bookId: '', title: '博客來書', progress: 20 }]

    await eventBus.emit('EXTRACTION.COMPLETED', {
      booksData: mockBooks,
      count: 1,
      source: 'books-com-tw'
    })

    const stored = getStoredBooks('books-com-tw')
    // 空字串 bookId 為 falsy，不映射 platformBookId
    expect(stored[0].platformBookId).toBeUndefined()
    expect(stored[0].id).toBeTruthy()
    expect(stored[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  test('books-com-tw：bookId 為 truthy 字串時映射為 platformBookId', async () => {
    const eventBus = await createStartedCoordinator()
    const mockBooks = [{ bookId: 'books-com-tw-item-123', title: '博客來書2', progress: 30 }]

    await eventBus.emit('EXTRACTION.COMPLETED', {
      booksData: mockBooks,
      count: 1,
      source: 'books-com-tw'
    })

    const stored = getStoredBooks('books-com-tw')
    expect(stored[0].platformBookId).toBe('books-com-tw-item-123')
    expect(stored[0].id).toBeTruthy()
  })

  test('多本書：每本書生成不同的 UUID id（不共用同一值）', async () => {
    const eventBus = await createStartedCoordinator()
    const mockBooks = [
      { bookId: 'slug-1', title: '書一', progress: 0 },
      { bookId: 'slug-2', title: '書二', progress: 50 }
    ]

    await eventBus.emit('EXTRACTION.COMPLETED', {
      booksData: mockBooks,
      count: 2,
      source: 'kobo'
    })

    const stored = getStoredBooks('kobo')
    expect(stored[0].id).toBeTruthy()
    expect(stored[1].id).toBeTruthy()
    expect(stored[0].id).not.toBe(stored[1].id)
  })

  test('所有 adapter 結構寫入 storage 後皆有 truthy id（整合驗證）', async () => {
    const eventBus = await createStartedCoordinator()
    const mockBooks = [
      { id: 'readmoo-id-1', title: 'Readmoo', progress: 0 },
      { bookId: 'kobo-slug', title: 'Kobo', progress: 10 },
      { bookId: '', title: '博客來（空 bookId）', progress: 20 }
    ]

    await eventBus.emit('EXTRACTION.COMPLETED', {
      booksData: mockBooks,
      count: mockBooks.length,
      source: 'readmoo'
    })

    const stored = getStoredBooks('readmoo')
    stored.forEach(book => {
      expect(book.id).toBeTruthy()
    })
  })
})
