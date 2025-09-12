/**
 * FileReaderFactory 測試
 */

const FileReaderFactory = require('src/utils/file-reader-factory')
const { StandardError } = require('src/core/errors/StandardError')

describe('FileReaderFactory', () => {
  describe('createReader', () => {
    it('應該優先使用global.FileReader', () => {
      const mockFileReader = jest.fn()
      global.FileReader = mockFileReader

      FileReaderFactory.createReader()

      expect(mockFileReader).toHaveBeenCalled()
      delete global.FileReader
    })

    it('應該在無FileReader時拋出專業錯誤', () => {
      delete global.FileReader
      global.FileReader = undefined

      expect(() => FileReaderFactory.createReader()).toMatchObject({
        code: 'FEATURE_NOT_SUPPORTED_ERROR',
        message: '檔案讀取功能不支援',
        details: expect.any(Object)
      })
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
