/**
 * 重新提取時保留使用者資料（UC-02）
 *
 * docs/use-cases.md UC-02 要求：重新提取已存在的書時只更新進度，
 * 使用者手動設定的狀態（isManualStatus）不被自動進度覆蓋，標籤取聯集不刪除。
 * 本測試從 EXTRACTION.COMPLETED 的真實 handler 路徑驅動，
 * 斷言寫入 storage 的同一本書保留既有的 tagIds 與手動狀態。
 */

describe('EXTRACTION.COMPLETED 重新提取既有書籍', () => {
  let coordinator

  async function createStartedCoordinator () {
    const EventCoordinator = require('src/background/events/event-coordinator')
    coordinator = new EventCoordinator()
    await coordinator.initialize()
    await coordinator.start()
    return coordinator.eventBusInstance
  }

  function storedReadmooBooks () {
    const writes = chrome.storage.local.set.mock.calls
      .map(call => call[0])
      .filter(arg => arg && arg.readmoo_books)
    return writes.length ? writes[writes.length - 1].readmoo_books.books : undefined
  }

  // 用 applyDefaults 產生：實際存在 storage 的書都走過同一條正規化流程
  const existingBook = {
    ...require('src/data-management/BookSchemaV2').applyDefaults({
      id: 'rm-1',
      title: '既有的書',
      progress: 20,
      tags: ['readmoo'],
      tagIds: ['tag-user-1'],
      readingStatus: 'abandoned',
      isManualStatus: true,
      source: 'readmoo'
    }),
    schemaVersion: '3.0.0'
  }

  beforeEach(() => {
    chrome.storage.local.get.mockImplementation((keys, cb) => {
      const data = { readmoo_books: { books: [existingBook], source: 'readmoo' } }
      if (typeof cb === 'function') cb(data)
      return Promise.resolve(data)
    })
  })

  afterEach(() => {
    Object.keys(require.cache).forEach(key => {
      if (key.includes('src/background/')) delete require.cache[key]
    })
    jest.clearAllMocks()
  })

  test('使用者加的標籤（tagIds）在重新提取後保留', async () => {
    const eventBus = await createStartedCoordinator()
    await eventBus.emit('EXTRACTION.COMPLETED', {
      booksData: [{ id: 'rm-1', title: '既有的書', progress: 50 }],
      count: 1,
      source: 'readmoo'
    })

    const book = storedReadmooBooks().find(b => b.id === 'rm-1')
    expect(book.tagIds).toEqual(['tag-user-1'])
  })

  test('手動設定的狀態不被進度覆蓋，進度照樣更新', async () => {
    const eventBus = await createStartedCoordinator()
    await eventBus.emit('EXTRACTION.COMPLETED', {
      booksData: [{ id: 'rm-1', title: '既有的書', progress: 50 }],
      count: 1,
      source: 'readmoo'
    })

    const book = storedReadmooBooks().find(b => b.id === 'rm-1')
    expect(book.progress).toBe(50)
    expect(book.isManualStatus).toBe(true)
    expect(book.readingStatus).toBe('abandoned')
  })

  test('書目沒有變化時照樣寫入摘要（popup 靠這次寫入判斷提取完成），書目原樣保留', async () => {
    const eventBus = await createStartedCoordinator()
    await eventBus.emit('EXTRACTION.COMPLETED', {
      booksData: [{ id: 'rm-1', title: '既有的書', progress: 20 }],
      count: 1,
      source: 'readmoo'
    })

    const writes = chrome.storage.local.set.mock.calls.map(c => c[0]).filter(a => a && a.readmoo_books)
    expect(writes).toHaveLength(1)
    expect(writes[0].readmoo_books.extractionSummary).toEqual({ added: 0, updated: 0, unchanged: 1, notOnPage: 0 })
    expect(writes[0].readmoo_books.books[0]).toEqual(existingBook)
  })
})
