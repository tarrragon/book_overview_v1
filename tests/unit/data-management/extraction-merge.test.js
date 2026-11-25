const { mergeExtractedBooks } = require('src/data-management/extraction-merge')

const NOW = '2026-11-26T00:00:00.000Z'

function localBook (overrides = {}) {
  return {
    id: 'b1',
    title: '書一',
    cover: 'https://img/1.jpg',
    progress: 20,
    tags: ['readmoo'],
    tagIds: [],
    readingStatus: 'reading',
    isManualStatus: false,
    source: 'readmoo',
    ...overrides
  }
}

function extractedBook (overrides = {}) {
  return {
    id: 'b1',
    title: '書一',
    cover: 'https://img/1.jpg',
    progress: 20,
    tags: ['readmoo'],
    tagIds: [],
    readingStatus: 'reading',
    isManualStatus: false,
    source: 'readmoo',
    extractedAt: '2026-11-26T00:00:00.000Z',
    schemaVersion: '3.0.0',
    ...overrides
  }
}

describe('mergeExtractedBooks', () => {
  test('沒有本機書目時，全部算新增', () => {
    const { books, summary } = mergeExtractedBooks(undefined, [extractedBook()], NOW)
    expect(books).toHaveLength(1)
    expect(summary).toEqual({ added: 1, updated: 0, unchanged: 0, notOnPage: 0 })
  })

  test('頁面欄位都沒變時，保留本機那一筆原物件，不算更新', () => {
    const local = localBook({ tagIds: ['t1'] })
    const { books, summary } = mergeExtractedBooks([local], [extractedBook()], NOW)
    expect(books[0]).toBe(local)
    expect(summary).toEqual({ added: 0, updated: 0, unchanged: 1, notOnPage: 0 })
  })

  test('進度變了：更新進度、重新推導非手動狀態、寫入 updatedAt，保留 tagIds', () => {
    const local = localBook({ tagIds: ['t1'] })
    const { books, summary } = mergeExtractedBooks(
      [local], [extractedBook({ progress: 100, readingStatus: 'finished' })], NOW)
    expect(books[0]).toMatchObject({ id: 'b1', progress: 100, readingStatus: 'finished', tagIds: ['t1'], updatedAt: NOW })
    expect(summary.updated).toBe(1)
  })

  test('手動狀態不被提取結果覆蓋', () => {
    const local = localBook({ readingStatus: 'abandoned', isManualStatus: true })
    const { books } = mergeExtractedBooks(
      [local], [extractedBook({ progress: 60, readingStatus: 'reading' })], NOW)
    expect(books[0]).toMatchObject({ progress: 60, readingStatus: 'abandoned', isManualStatus: true })
  })

  test('tags 取聯集', () => {
    const local = localBook({ tags: ['readmoo', '小說'] })
    const { books } = mergeExtractedBooks([local], [extractedBook({ progress: 30, tags: ['readmoo', '新'] })], NOW)
    expect(books[0].tags).toEqual(['readmoo', '小說', '新'])
  })

  test('頁面這次沒讀到的本機書目保留，計入 notOnPage', () => {
    const other = localBook({ id: 'b2', title: '書二', cover: 'c2' })
    const { books, summary } = mergeExtractedBooks([localBook(), other], [extractedBook()], NOW)
    expect(books.map(b => b.id)).toEqual(['b1', 'b2'])
    expect(summary.notOnPage).toBe(1)
  })

  test('id 每次重新產生的書（沒有書城書號）依書名加封面對上本機那一筆，沿用本機 id', () => {
    const local = localBook({ id: 'uuid-old', tagIds: ['t1'] })
    const { books, summary } = mergeExtractedBooks(
      [local], [extractedBook({ id: 'uuid-new', progress: 40 })], NOW)
    expect(books).toHaveLength(1)
    expect(books[0]).toMatchObject({ id: 'uuid-old', progress: 40, tagIds: ['t1'] })
    expect(summary.updated).toBe(1)
  })

  test('依 platformBookId 對上本機那一筆', () => {
    const local = localBook({ id: 'uuid-old', platformBookId: 'K-9', title: '舊書名' })
    const { books } = mergeExtractedBooks(
      [local], [extractedBook({ id: 'uuid-new', platformBookId: 'K-9', title: '新書名' })], NOW)
    expect(books).toHaveLength(1)
    expect(books[0]).toMatchObject({ id: 'uuid-old', title: '新書名' })
  })

  test('同一次提取裡重複出現的書，第二筆不覆蓋第一筆的合併結果', () => {
    const { books, summary } = mergeExtractedBooks(
      [localBook()], [extractedBook({ progress: 30 }), extractedBook({ progress: 30 })], NOW)
    expect(summary.updated).toBe(1)
    expect(summary.added).toBe(1)
    expect(books).toHaveLength(2)
  })
})
