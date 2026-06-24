const { NAVIGATION_TEXT } = require('../../../src/popup/constants/ui-text')

describe('NAVIGATION_TEXT', () => {
  test('is frozen', () => {
    expect(Object.isFrozen(NAVIGATION_TEXT)).toBe(true)
  })

  test('has SECTION_TITLE', () => {
    expect(typeof NAVIGATION_TEXT.SECTION_TITLE).toBe('string')
    expect(NAVIGATION_TEXT.SECTION_TITLE.length).toBeGreaterThan(0)
  })

  test('has GO_BUTTON_ARIA_PREFIX', () => {
    expect(typeof NAVIGATION_TEXT.GO_BUTTON_ARIA_PREFIX).toBe('string')
    expect(NAVIGATION_TEXT.GO_BUTTON_ARIA_PREFIX.length).toBeGreaterThan(0)
  })
})
