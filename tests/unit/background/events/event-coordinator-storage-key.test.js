/**
 * EXTRACTION.COMPLETED 寫入哪一個 storage key
 *
 * content script 的提取完成事件經 content-message-handler 轉送到 background。
 * 轉送時曾把 data.source 換成轉送資訊物件（{ type: 'content-script', tabId, ... }），
 * 而這裡用 data.source 當書城 ID 組 key，書目被寫進 "[object Object]_books"，
 * overview 讀的 readmoo_books 不會更新。這裡只接受已知書城 ID 的字串，
 * 其次取書目自己的 source 欄位（adapter 會寫），最後才預設 readmoo。
 */

describe('EXTRACTION.COMPLETED 的 storage key', () => {
  async function emitCompleted (data) {
    const EventCoordinator = require('src/background/events/event-coordinator')
    const coordinator = new EventCoordinator()
    await coordinator.initialize()
    await coordinator.start()
    await coordinator.eventBusInstance.emit('EXTRACTION.COMPLETED', data)
  }

  function writtenKeys () {
    return chrome.storage.local.set.mock.calls.flatMap(call => Object.keys(call[0] || {}))
  }

  const FORWARDED_SOURCE = { type: 'content-script', tabId: 7, url: 'https://read.readmoo.com/#/library', frameId: 0 }

  beforeEach(() => {
    chrome.storage.local.get.mockImplementation((keys, cb) => {
      if (typeof cb === 'function') cb({})
      return Promise.resolve({})
    })
  })

  afterEach(() => {
    Object.keys(require.cache).forEach(key => {
      if (key.includes('src/background/')) delete require.cache[key]
    })
    jest.clearAllMocks()
  })

  test('data.source 是轉送資訊物件時，依書目的 source 寫進 readmoo_books', async () => {
    await emitCompleted({
      booksData: [{ id: 'reader-1', title: '書一', progress: 10, source: 'readmoo' }],
      count: 1,
      source: FORWARDED_SOURCE
    })
    expect(writtenKeys()).toContain('readmoo_books')
    expect(writtenKeys()).not.toContain('[object Object]_books')
  })

  test('Kobo 的書目寫進 kobo_books，tags 只含書城 ID 字串', async () => {
    await emitCompleted({
      booksData: [{ id: 'k-1', title: '書二', progress: 0, source: 'kobo' }],
      count: 1,
      source: FORWARDED_SOURCE
    })
    const write = chrome.storage.local.set.mock.calls.map(c => c[0]).find(arg => arg.kobo_books)
    expect(write).toBeDefined()
    expect(write.kobo_books.books[0].tags).toEqual(['kobo'])
  })

  test('data.source 是已知書城 ID 字串時照用', async () => {
    await emitCompleted({
      booksData: [{ id: 'b-1', title: '書三', progress: 0 }],
      count: 1,
      source: 'books_com_tw'
    })
    expect(writtenKeys()).toContain('books_com_tw_books')
  })
})
