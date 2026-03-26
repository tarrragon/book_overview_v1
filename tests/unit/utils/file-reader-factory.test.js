/**
 * FileReaderFactory 測試
 */

// eslint-disable-next-line no-unused-vars
const FileReaderFactory = require('src/utils/file-reader-factory')

describe('FileReaderFactory', () => {
  describe('createReader', () => {
    it('應該優先使用global.FileReader', () => {
      // eslint-disable-next-line no-unused-vars
      const mockFileReader = jest.fn()
      global.FileReader = mockFileReader

      FileReaderFactory.createReader()

      expect(mockFileReader).toHaveBeenCalled()
      delete global.FileReader
    })

    it('應該在無FileReader時拋出專業錯誤', () => {
      delete global.FileReader
      global.FileReader = undefined

      expect(() => FileReaderFactory.createReader()).toThrow()
    })
  })

  describe('isAvailable', () => {
    it('當global.FileReader存在時應返回true', () => {
      global.FileReader = jest.fn()

      expect(FileReaderFactory.isAvailable()).toBe(true)
      delete global.FileReader
    })

    it('當無FileReader時應返回false', () => {
      delete global.FileReader

      expect(FileReaderFactory.isAvailable()).toBe(false)
    })
  })
})
