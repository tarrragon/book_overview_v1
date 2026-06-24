const {
  createBookstoreNavSection
} = require('../../../src/popup/components/ui-factory')

describe('createBookstoreNavSection', () => {
  const sampleStores = [
    { id: 'readmoo', name: 'Readmoo', url: 'https://read.readmoo.com/#/library', enabled: true },
    { id: 'kobo', name: 'Kobo', url: 'https://www.kobo.com/library', enabled: false },
    { id: 'books', name: 'Books', url: 'https://books.example.com', enabled: true }
  ]

  test('produces a status-card container with id', () => {
    const section = createBookstoreNavSection({ bookstores: sampleStores })
    expect(section.tagName).toBe('DIV')
    expect(section.classList.contains('status-card')).toBe(true)
    expect(section.id).toBe('bookstoreNavSection')
  })

  test('renders section title when provided', () => {
    const section = createBookstoreNavSection({
      bookstores: sampleStores,
      sectionTitle: 'Navigate'
    })
    const strong = section.querySelector('.results-header strong')
    expect(strong).not.toBeNull()
    expect(strong.textContent).toBe('Navigate')
  })

  test('omits title header when sectionTitle is not provided', () => {
    const section = createBookstoreNavSection({ bookstores: sampleStores })
    const header = section.querySelector('.results-header')
    expect(header).toBeNull()
  })

  test('renders only enabled bookstores as buttons', () => {
    const section = createBookstoreNavSection({ bookstores: sampleStores })
    const buttons = section.querySelectorAll('button')
    expect(buttons.length).toBe(2)
    expect(buttons[0].textContent).toBe('Readmoo')
    expect(buttons[1].textContent).toBe('Books')
  })

  test('buttons have correct data-bookstore-id', () => {
    const section = createBookstoreNavSection({ bookstores: sampleStores })
    const buttons = section.querySelectorAll('button')
    expect(buttons[0].dataset.bookstoreId).toBe('readmoo')
    expect(buttons[1].dataset.bookstoreId).toBe('books')
  })

  test('buttons have secondary variant class', () => {
    const section = createBookstoreNavSection({ bookstores: sampleStores })
    const buttons = section.querySelectorAll('button')
    buttons.forEach(btn => {
      expect(btn.classList.contains('button')).toBe(true)
      expect(btn.classList.contains('secondary')).toBe(true)
    })
  })

  test('aria-label uses prefix + store name', () => {
    const section = createBookstoreNavSection({
      bookstores: sampleStores,
      ariaPrefix: 'Go to '
    })
    const buttons = section.querySelectorAll('button')
    expect(buttons[0].getAttribute('aria-label')).toBe('Go to Readmoo')
  })

  test('onNavigate callback fires with store object', () => {
    const onNavigate = jest.fn()
    const section = createBookstoreNavSection({
      bookstores: [sampleStores[0]],
      onNavigate
    })
    const btn = section.querySelector('button')
    btn.click()
    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(onNavigate).toHaveBeenCalledWith(sampleStores[0])
  })

  test('empty bookstore list renders no buttons', () => {
    const section = createBookstoreNavSection({ bookstores: [] })
    expect(section.querySelectorAll('button').length).toBe(0)
  })

  test('defaults to empty bookstores when called without options', () => {
    const section = createBookstoreNavSection()
    expect(section.querySelectorAll('button').length).toBe(0)
  })
})
