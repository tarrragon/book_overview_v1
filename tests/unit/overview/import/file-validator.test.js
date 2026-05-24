/**
 * FileValidator helper class 單元測試
 *
 * 對應 ticket: 0.19.0-W1-048.10.1.1
 *
 * 測試範圍（Phase 2 sage-test-architect 設計）：
 * - validate(file) API：合併既有 _validateFileBasics + _validateFileSize 行為
 * - detectFormat(file) API：純函式格式偵測（取代 _isJSONFile / _isCSVFile）
 * - DI deps：showError（選用）/ maxFileSize（選用,預設 10MB）
 * - 純函式 Sociable Unit:無外部 mock,僅 stub showError callback
 *
 * 等價契約來源:src/overview/book-file-importer.js L146-206
 */

const { FileValidator } = require('src/overview/import/file-validator')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

/**
 * 建立測試用 File 物件
 * @param {string} name - 檔名
 * @param {string} type - MIME type
 * @param {number} [size] - 檔案大小（bytes）,若提供則覆寫 File.size
 * @returns {File}
 */
function makeFile (name, type, size) {
  const file = new File(['x'], name, { type })
  if (typeof size === 'number') {
    Object.defineProperty(file, 'size', { value: size, writable: false })
  }
  return file
}

const TEN_MB = 10 * 1024 * 1024

describe('FileValidator', () => {
  describe('API 簽章', () => {
    test('FileValidator 為 class,可被 new 實例化', () => {
      expect(typeof FileValidator).toBe('function')
      const instance = new FileValidator()
      expect(instance).toBeInstanceOf(FileValidator)
    })

    test('instance 暴露 validate 與 detectFormat 方法', () => {
      const instance = new FileValidator()
      expect(typeof instance.validate).toBe('function')
      expect(typeof instance.detectFormat).toBe('function')
    })

    test('instance 不暴露舊底線方法（_validateFileBasics / _validateFileSize / _isJSONFile / _isCSVFile）', () => {
      const instance = new FileValidator()
      expect(instance._validateFileBasics).toBeUndefined()
      expect(instance._validateFileSize).toBeUndefined()
      expect(instance._isJSONFile).toBeUndefined()
      expect(instance._isCSVFile).toBeUndefined()
    })
  })

  describe('validate(file) - 檔案存在性', () => {
    test('null file 拋出 VALIDATION_ERROR', () => {
      const validator = new FileValidator()
      expect(() => validator.validate(null)).toThrow()
      try {
        validator.validate(null)
      } catch (err) {
        expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR)
        expect(err.details).toEqual({ category: 'validation' })
      }
    })

    test('undefined file 拋出 VALIDATION_ERROR', () => {
      const validator = new FileValidator()
      expect(() => validator.validate(undefined)).toThrow()
      try {
        validator.validate(undefined)
      } catch (err) {
        expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR)
      }
    })

    test('null file 時呼叫 showError 並傳遞提示訊息', () => {
      const showError = jest.fn()
      const validator = new FileValidator({ showError })
      expect(() => validator.validate(null)).toThrow()
      expect(showError).toHaveBeenCalledTimes(1)
      expect(showError).toHaveBeenCalledWith('請先選擇一個 JSON 或 CSV 檔案！')
    })
  })

  describe('validate(file) - 檔案格式', () => {
    test('接受 .json 副檔名', () => {
      const validator = new FileValidator()
      const file = makeFile('books.json', 'application/json')
      expect(() => validator.validate(file)).not.toThrow()
    })

    test('接受 .csv 副檔名', () => {
      const validator = new FileValidator()
      const file = makeFile('books.csv', 'text/csv')
      expect(() => validator.validate(file)).not.toThrow()
    })

    test('接受 application/json MIME type（即使副檔名非 .json）', () => {
      const validator = new FileValidator()
      const file = makeFile('books.txt', 'application/json')
      expect(() => validator.validate(file)).not.toThrow()
    })

    test('接受 text/csv;charset=utf-8 MIME type（瀏覽器變體）', () => {
      const validator = new FileValidator()
      const file = makeFile('books.dat', 'text/csv;charset=utf-8;')
      expect(() => validator.validate(file)).not.toThrow()
    })

    test('拒絕 .txt 檔案（非 JSON/CSV）', () => {
      const validator = new FileValidator()
      const file = makeFile('books.txt', 'text/plain')
      expect(() => validator.validate(file)).toThrow()
      try {
        validator.validate(file)
      } catch (err) {
        expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR)
        expect(err.details).toEqual({ category: 'validation' })
      }
    })

    test('格式錯誤時呼叫 showError', () => {
      const showError = jest.fn()
      const validator = new FileValidator({ showError })
      const file = makeFile('books.txt', 'text/plain')
      expect(() => validator.validate(file)).toThrow()
      expect(showError).toHaveBeenCalledWith('請選擇 JSON 或 CSV 格式的檔案！')
    })
  })

  describe('validate(file) - 檔案大小', () => {
    test('10MB 邊界（剛好 10485760 bytes）通過', () => {
      const validator = new FileValidator()
      const file = makeFile('books.json', 'application/json', TEN_MB)
      expect(() => validator.validate(file)).not.toThrow()
    })

    test('超過 10MB（10485761 bytes）拋出 VALIDATION_ERROR', () => {
      const validator = new FileValidator()
      const file = makeFile('books.json', 'application/json', TEN_MB + 1)
      expect(() => validator.validate(file)).toThrow()
      try {
        validator.validate(file)
      } catch (err) {
        expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR)
        expect(err.details).toEqual({ category: 'validation' })
      }
    })

    test('超大檔案時呼叫 showError', () => {
      const showError = jest.fn()
      const validator = new FileValidator({ showError })
      const file = makeFile('books.json', 'application/json', TEN_MB + 1)
      expect(() => validator.validate(file)).toThrow()
      expect(showError).toHaveBeenCalledWith('檔案過大，請選擇小於 10MB 的檔案！')
    })

    test('自訂 maxFileSize 生效:5MB 限制下 6MB 觸發錯誤', () => {
      const FIVE_MB = 5 * 1024 * 1024
      const SIX_MB = 6 * 1024 * 1024
      const validator = new FileValidator({ maxFileSize: FIVE_MB })
      const file = makeFile('books.json', 'application/json', SIX_MB)
      expect(() => validator.validate(file)).toThrow()
      try {
        validator.validate(file)
      } catch (err) {
        expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR)
      }
    })

    test('自訂 maxFileSize 上限內檔案通過', () => {
      const FIVE_MB = 5 * 1024 * 1024
      const validator = new FileValidator({ maxFileSize: FIVE_MB })
      const file = makeFile('books.json', 'application/json', 4 * 1024 * 1024)
      expect(() => validator.validate(file)).not.toThrow()
    })
  })

  describe('validate(file) - 前置鏈短路', () => {
    test('null file + 隱含過大:先觸發「不存在」錯誤而非「過大」', () => {
      const showError = jest.fn()
      const validator = new FileValidator({ showError })
      expect(() => validator.validate(null)).toThrow()
      expect(showError).toHaveBeenCalledTimes(1)
      expect(showError).toHaveBeenCalledWith('請先選擇一個 JSON 或 CSV 檔案！')
    })

    test('格式錯誤的超大檔案:先觸發「格式不正確」而非「過大」', () => {
      const showError = jest.fn()
      const validator = new FileValidator({ showError })
      const file = makeFile('books.txt', 'text/plain', TEN_MB + 1)
      expect(() => validator.validate(file)).toThrow()
      expect(showError).toHaveBeenCalledTimes(1)
      expect(showError).toHaveBeenCalledWith('請選擇 JSON 或 CSV 格式的檔案！')
    })
  })

  describe('validate(file) - showError 缺漏不二次錯誤', () => {
    test('不傳 showError 時 invalid file 仍 throw,但不因 callback 缺漏二次錯誤', () => {
      const validator = new FileValidator() // 不注入 showError
      expect(() => validator.validate(null)).toThrow()
      // 確認拋出的是預期 VALIDATION_ERROR,而非 TypeError: showError is not a function
      try {
        validator.validate(null)
      } catch (err) {
        expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR)
        expect(err.name).not.toBe('TypeError')
      }
    })
  })

  describe('detectFormat(file)', () => {
    test('.json 檔案回傳 "json"', () => {
      const validator = new FileValidator()
      const file = makeFile('books.json', 'application/json')
      expect(validator.detectFormat(file)).toBe('json')
    })

    test('.csv 檔案回傳 "csv"', () => {
      const validator = new FileValidator()
      const file = makeFile('books.csv', 'text/csv')
      expect(validator.detectFormat(file)).toBe('csv')
    })

    test('application/json MIME（非 .json 副檔名）回傳 "json"', () => {
      const validator = new FileValidator()
      const file = makeFile('books.dat', 'application/json')
      expect(validator.detectFormat(file)).toBe('json')
    })

    test('text/csv;charset=utf-8 MIME 回傳 "csv"', () => {
      const validator = new FileValidator()
      const file = makeFile('books.dat', 'text/csv;charset=utf-8;')
      expect(validator.detectFormat(file)).toBe('csv')
    })

    test('.txt 檔案回傳 null', () => {
      const validator = new FileValidator()
      const file = makeFile('books.txt', 'text/plain')
      expect(validator.detectFormat(file)).toBeNull()
    })

    test('null 輸入回傳 null（不 throw）', () => {
      const validator = new FileValidator()
      expect(() => validator.detectFormat(null)).not.toThrow()
      expect(validator.detectFormat(null)).toBeNull()
    })

    test('undefined 輸入回傳 null（不 throw）', () => {
      const validator = new FileValidator()
      expect(() => validator.detectFormat(undefined)).not.toThrow()
      expect(validator.detectFormat(undefined)).toBeNull()
    })
  })

  describe('純函式無 state', () => {
    test('同一 validator 連續多次呼叫 validate 行為一致', () => {
      const validator = new FileValidator()
      const validFile = makeFile('books.json', 'application/json')
      const invalidFile = makeFile('books.txt', 'text/plain')

      expect(() => validator.validate(validFile)).not.toThrow()
      expect(() => validator.validate(invalidFile)).toThrow()
      expect(() => validator.validate(validFile)).not.toThrow()
      expect(() => validator.validate(invalidFile)).toThrow()
    })

    test('同一 validator 連續多次呼叫 detectFormat 行為一致', () => {
      const validator = new FileValidator()
      const jsonFile = makeFile('books.json', 'application/json')

      expect(validator.detectFormat(jsonFile)).toBe('json')
      expect(validator.detectFormat(jsonFile)).toBe('json')
      expect(validator.detectFormat(null)).toBeNull()
      expect(validator.detectFormat(jsonFile)).toBe('json')
    })
  })
})
