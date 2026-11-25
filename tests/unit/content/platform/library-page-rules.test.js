const { isLibraryPageUrl, matchPlatformIdByUrl, LIBRARY_PAGE_RULES } = require('src/content/platform/library-page-rules')
const { getRegisteredPlatforms } = require('src/content/platform/platform-registry')
const { BOOKSTORE_LIST } = require('src/popup/constants/bookstore-config')

describe('isLibraryPageUrl', () => {
  // 防止規則與 popup 的「前往書庫」網址漂移：每一家的前往網址都要判為書庫頁
  test.each(BOOKSTORE_LIST.map(store => [store.id, store.url]))(
    'popup 前往書庫的網址判為書庫頁：%s', (id, url) => {
      expect(isLibraryPageUrl(id, url)).toBe(true)
    })

  test('每一家 popup 書城都有對應的規則', () => {
    for (const store of BOOKSTORE_LIST) {
      expect(LIBRARY_PAGE_RULES[store.id]).toBeDefined()
    }
  })

  test.each([
    ['readmoo', 'https://readmoo.com/'],
    ['readmoo', 'https://read.readmoo.com/#/'],
    ['readmoo', 'https://readmoo.com/book/210123456000101'],
    ['books-com-tw', 'https://www.books.com.tw/'],
    ['books-com-tw', 'https://viewer-ebook.books.com.tw/viewer/index.html'],
    ['kobo', 'https://www.kobo.com/tw/zh'],
    ['kobo', 'https://www.kobo.com/tw/zh/ebook/some-title']
  ])('書城的其他頁不是書庫頁：%s %s', (id, url) => {
    expect(isLibraryPageUrl(id, url)).toBe(false)
  })

  test('Readmoo 新網域的書庫頁（next.readmoo.com/read#/library）判為 Readmoo 書庫頁', () => {
    const url = 'https://next.readmoo.com/read#/library'
    expect(matchPlatformIdByUrl(url)).toBe('readmoo')
    expect(isLibraryPageUrl('readmoo', url)).toBe(true)
  })

  test('Kobo 日本站的書庫路徑也判為書庫頁', () => {
    expect(isLibraryPageUrl('kobo', 'https://www.kobo.com/jp/ja/library/books')).toBe(true)
  })

  test('未知書城、空值與無法解析的網址回傳 false', () => {
    expect(isLibraryPageUrl('unknown', 'https://read.readmoo.com/#/library')).toBe(false)
    expect(isLibraryPageUrl('readmoo', undefined)).toBe(false)
    expect(isLibraryPageUrl('readmoo', 'not a url')).toBe(false)
  })
})

describe('matchPlatformIdByUrl', () => {
  // 防止與 content 端 platform-registry 的主機清單分歧：registry 列的每個主機都要判為同一家
  test.each(getRegisteredPlatforms().flatMap(p => p.hostnames.map(h => [h, p.name])))(
    'platform-registry 的主機 %s 判為 %s', (hostname, name) => {
      expect(matchPlatformIdByUrl(`https://${hostname}/`)).toBe(name)
    })

  test('popup 前往書庫的網址都判得出所屬書城', () => {
    for (const store of BOOKSTORE_LIST) {
      expect(matchPlatformIdByUrl(store.url)).toBe(store.id)
    }
  })

  test.each([
    ['https://www.google.com/'],
    ['https://readmoo.com.evil.example/'],
    ['https://notreadmoo.com/'],
    ['not a url']
  ])('不屬於任何書城：%s', (url) => {
    expect(matchPlatformIdByUrl(url)).toBeNull()
  })
})
