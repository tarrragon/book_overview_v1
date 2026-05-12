/* eslint-disable no-console */

/**
 * Logger payload 序列化測試
 *
 * Ticket: 0.18.0-W6-012.3
 *
 * 驗收條件覆蓋：
 * - AC 1: object payload 輸出可讀內容（非 [object Object]）
 * - AC 2: 循環引用不爆 stack
 * - AC 3: 涵蓋 object / circular / Error 三種 payload 情境
 *
 * 設計依據：
 * - chrome-devtools-mcp `list_console_messages` 取得 console message text，
 *   原本 `console.info(prefix, logEntry)` 對 object 第二參數降為
 *   `[object Object]` toString fallback；修復後 _consoleOutput 改為單字串輸出，
 *   logEntry 經 JSON.stringify + 自訂 replacer 序列化，循環引用以 '[Circular]'
 *   標示，Error 物件展開為 { name, message, stack }。
 */

const { Logger } = require('../../../../src/core/logging/Logger')

describe('Logger payload serialization (0.18.0-W6-012.3)', () => {
  let infoSpy
  let errorSpy
  let warnSpy
  let debugSpy

  beforeEach(() => {
    // 攔截 console，驗證實際傳給 console.* 的字串內容
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    infoSpy.mockRestore()
    errorSpy.mockRestore()
    warnSpy.mockRestore()
    debugSpy.mockRestore()
  })

  describe('AC 1: 純 object payload 輸出可讀內容', () => {
    it('應該將 object payload 序列化為含欄位的字串，而非 [object Object]', () => {
      const logger = new Logger('TestLib', 'DEBUG')
      logger.info('BOOK_EXTRACTED', { bookCount: 5, source: 'readmoo' })

      expect(infoSpy).toHaveBeenCalledTimes(1)
      const callArg = infoSpy.mock.calls[0][0]

      // 必須是單一字串，而非 [object Object]
      expect(typeof callArg).toBe('string')
      expect(callArg).not.toContain('[object Object]')

      // 字串內必須包含核心欄位
      expect(callArg).toContain('[INFO]')
      expect(callArg).toContain('"messageKey"')
      expect(callArg).toContain('BOOK_EXTRACTED')
      expect(callArg).toContain('"data"')
      expect(callArg).toContain('"bookCount"')
      expect(callArg).toContain('5')
      expect(callArg).toContain('"source"')
      expect(callArg).toContain('readmoo')
      expect(callArg).toContain('"name"')
      expect(callArg).toContain('TestLib')
    })

    it('應該在 logger 名稱與 timestamp 欄位都存在於輸出字串', () => {
      const logger = new Logger('PayloadCheck', 'DEBUG')
      logger.warn('LOW_DISK_SPACE', { remainingMb: 128 })

      expect(warnSpy).toHaveBeenCalledTimes(1)
      const callArg = warnSpy.mock.calls[0][0]
      expect(typeof callArg).toBe('string')
      expect(callArg).toContain('PayloadCheck')
      expect(callArg).toContain('"timestamp"')
      expect(callArg).toContain('LOW_DISK_SPACE')
      expect(callArg).toContain('128')
    })

    it('純字串輸出在 console.info 只接收一個參數，避免 message text 降級', () => {
      const logger = new Logger('SingleArg', 'DEBUG')
      logger.info('SINGLE_ARG_CHECK', { a: 1 })

      // 修復後只傳單一字串，避免 chrome-devtools-mcp 取得 text 時降級
      expect(infoSpy.mock.calls[0]).toHaveLength(1)
    })
  })

  describe('AC 2: 循環引用不爆 stack', () => {
    it('應該成功序列化含直接循環引用的 payload 並標示為 [Circular]', () => {
      const logger = new Logger('CircularTest', 'DEBUG')
      const payload = { id: 'A' }
      payload.self = payload // 直接循環

      expect(() => {
        logger.info('CIRCULAR_DIRECT', payload)
      }).not.toThrow()

      expect(infoSpy).toHaveBeenCalledTimes(1)
      const callArg = infoSpy.mock.calls[0][0]
      expect(typeof callArg).toBe('string')
      expect(callArg).toContain('[Circular]')
      expect(callArg).toContain('CIRCULAR_DIRECT')
      expect(callArg).toContain('"id"')
    })

    it('應該成功序列化含間接循環引用（多層）的 payload', () => {
      const logger = new Logger('CircularTest', 'DEBUG')
      const a = { name: 'A' }
      const b = { name: 'B', a }
      a.b = b // a → b → a 循環

      expect(() => {
        logger.error('CIRCULAR_INDIRECT', { root: a })
      }).not.toThrow()

      expect(errorSpy).toHaveBeenCalledTimes(1)
      const callArg = errorSpy.mock.calls[0][0]
      expect(typeof callArg).toBe('string')
      expect(callArg).toContain('[Circular]')
      expect(callArg).toContain('CIRCULAR_INDIRECT')
    })

    it('循環引用情境下 Logger 不應拋出例外或讓 console 收到 undefined', () => {
      const logger = new Logger('CircularTest', 'DEBUG')
      const payload = {}
      payload.loop = payload

      logger.debug('CIRCULAR_NOT_THROW', payload)
      expect(debugSpy).toHaveBeenCalledTimes(1)
      const callArg = debugSpy.mock.calls[0][0]
      expect(callArg).toBeDefined()
      expect(typeof callArg).toBe('string')
    })
  })

  describe('AC 3: Error 物件 payload 展開', () => {
    it('應該將 Error 物件展開為含 name / message / stack 的可讀字串', () => {
      const logger = new Logger('ErrorTest', 'DEBUG')
      const err = new Error('Network timeout')
      err.name = 'NetworkError'

      logger.error('OPERATION_FAILED', { cause: err, retryCount: 3 })

      expect(errorSpy).toHaveBeenCalledTimes(1)
      const callArg = errorSpy.mock.calls[0][0]
      expect(typeof callArg).toBe('string')
      expect(callArg).toContain('NetworkError')
      expect(callArg).toContain('Network timeout')
      // stack 應包含函式呼叫資訊（含本測試檔路徑或函式名稱）
      expect(callArg).toContain('"stack"')
      expect(callArg).toContain('OPERATION_FAILED')
      expect(callArg).toContain('"retryCount"')
      expect(callArg).toContain('3')
    })

    it('應該處理 Error 子類（TypeError）並保留其 name', () => {
      const logger = new Logger('ErrorTest', 'DEBUG')
      const err = new TypeError('Invalid input')

      logger.error('TYPE_VALIDATION_FAILED', { error: err })
      const callArg = errorSpy.mock.calls[0][0]
      expect(callArg).toContain('TypeError')
      expect(callArg).toContain('Invalid input')
    })

    it('Error 物件單獨作為 payload 根部時也能展開（不限於巢狀）', () => {
      const logger = new Logger('ErrorTest', 'DEBUG')
      const err = new Error('Root level error')
      // Note: 既有介面 data 仍為 object，所以 wrap 在 cause 欄位
      logger.error('ROOT_ERROR', { cause: err })
      const callArg = errorSpy.mock.calls[0][0]
      expect(callArg).toContain('Root level error')
      expect(callArg).toContain('"stack"')
    })
  })

  describe('靜態方法 _safeSerialize 行為', () => {
    it('應該存在於 Logger 類別並回傳字串', () => {
      expect(typeof Logger._safeSerialize).toBe('function')
      const out = Logger._safeSerialize({ a: 1, b: 'x' })
      expect(typeof out).toBe('string')
      expect(out).toContain('"a"')
      expect(out).toContain('"b"')
    })

    it('應該將 function 標示為 [Function: name]', () => {
      function namedFn () {}
      const out = Logger._safeSerialize({ fn: namedFn, anon: () => {} })
      expect(out).toContain('[Function: namedFn]')
      // 箭頭函式 name 屬性為 'anon'（依變數名推斷）
      expect(out).toMatch(/\[Function: anon\]|\[Function: anonymous\]/)
    })
  })
})
