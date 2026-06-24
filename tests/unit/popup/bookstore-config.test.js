const { BOOKSTORE_LIST } = require('../../../src/popup/constants/bookstore-config')

describe('bookstore-config', () => {
  test('BOOKSTORE_LIST is a frozen array', () => {
    expect(Array.isArray(BOOKSTORE_LIST)).toBe(true)
    expect(Object.isFrozen(BOOKSTORE_LIST)).toBe(true)
  })

  test('each entry has required fields: id, name, url, enabled', () => {
    BOOKSTORE_LIST.forEach(store => {
      expect(typeof store.id).toBe('string')
      expect(store.id.length).toBeGreaterThan(0)
      expect(typeof store.name).toBe('string')
      expect(store.name.length).toBeGreaterThan(0)
      expect(typeof store.url).toBe('string')
      expect(store.url).toMatch(/^https?:\/\//)
      expect(typeof store.enabled).toBe('boolean')
    })
  })

  test('contains Readmoo entry with correct URL', () => {
    const readmoo = BOOKSTORE_LIST.find(s => s.id === 'readmoo')
    expect(readmoo).toBeDefined()
    expect(readmoo.name).toBe('Readmoo')
    expect(readmoo.url).toBe('https://read.readmoo.com/#/library')
    expect(readmoo.enabled).toBe(true)
  })

  test('no duplicate ids', () => {
    const ids = BOOKSTORE_LIST.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
