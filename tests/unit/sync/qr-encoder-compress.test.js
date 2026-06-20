/**
 * 群組 A：gzip 壓縮測試（qr-encoder.compressData）
 *
 * 範圍（ticket 1.2.0-W1-001 Phase 2 群組 A）：
 * - 場景 N1：正常 JSON 壓縮 → Uint8Array，前兩 byte 為 gzip magic 0x1f 0x8b
 * - 場景 E2：CompressionStream 不可用 → 拋出 Error + Logger.error
 * - 場景 E3：壓縮過程 write 失敗 → 拋出 Error + Logger.error
 * - 場景 B1：空字串壓縮 → 回傳 gzip 空容器 Uint8Array
 *
 * Mock 策略（Phase 2 測試設計）：CompressionStream 為外部瀏覽器 API，
 * jsdom 環境不存在，以 Node zlib 為後端建構真實 gzip 行為的 mock，
 * 使壓縮輸出可逐 byte 驗證 magic number。
 *
 * 註：本檔為功能正確性測試，不含計時/精度斷言（test-assertion-design-rules）。
 */

'use strict'

const zlib = require('zlib')

const { compressData } = require('src/sync/qr-encoder')

// 以 Node zlib 為後端的 CompressionStream mock：累積寫入 → close 時 gzip →
// 經 readable 吐出。確保輸出為真實 gzip 串流，magic number 可驗證。
function createGzipCompressionStreamMock () {
  return class MockCompressionStream {
    constructor (format) {
      this._format = format
      this._inputChunks = []
      const self = this

      this.writable = {
        getWriter () {
          return {
            async write (chunk) { self._inputChunks.push(chunk) },
            async close () { self._closed = true }
          }
        }
      }

      this.readable = {
        getReader () {
          let delivered = false
          return {
            async read () {
              if (delivered) return { value: undefined, done: true }
              delivered = true
              const input = Buffer.concat(self._inputChunks.map((c) => Buffer.from(c)))
              const gzipped = zlib.gzipSync(input)
              return { value: new Uint8Array(gzipped), done: false }
            }
          }
        }
      }
    }
  }
}

describe('compressData', () => {
  let loggerErrorSpy

  const validJson = JSON.stringify({
    format_version: '2.0',
    books: [{ id: 'book-001', title: '挪威的森林' }],
    sync_meta: { exported_at: '2026-06-20T00:00:00.000Z', book_count: 1 }
  })

  beforeEach(() => {
    loggerErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    loggerErrorSpy.mockRestore()
    delete global.CompressionStream
  })

  test('場景 N1：正常 JSON 壓縮回傳 gzip Uint8Array（magic 0x1f 0x8b）', async () => {
    global.CompressionStream = createGzipCompressionStreamMock()

    const result = await compressData(validJson)

    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toBe(0x1f)
    expect(result[1]).toBe(0x8b)
  })

  test('場景 E2：CompressionStream 不可用時拋出 Error 並記錄 Logger.error', async () => {
    delete global.CompressionStream

    const error = await compressData(validJson).catch((e) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('壓縮功能不可用')

    expect(loggerErrorSpy).toHaveBeenCalled()
    const logged = loggerErrorSpy.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(logged).toContain('QREncoder')
  })

  test('場景 E3：壓縮過程 write 失敗時拋出 Error 並記錄 Logger.error', async () => {
    global.CompressionStream = class {
      constructor () {
        this.writable = {
          getWriter () {
            return {
              async write () { throw new TypeError('write failed') },
              async close () {}
            }
          }
        }
        this.readable = {
          getReader () {
            return { async read () { return { value: undefined, done: true } } }
          }
        }
      }
    }

    const error = await compressData(validJson).catch((e) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('資料壓縮失敗')
    expect(loggerErrorSpy).toHaveBeenCalled()
  })

  test('場景 B1：空字串壓縮回傳 gzip 空容器 Uint8Array', async () => {
    global.CompressionStream = createGzipCompressionStreamMock()

    const result = await compressData('')

    expect(result).toBeInstanceOf(Uint8Array)
    expect(result[0]).toBe(0x1f)
    expect(result[1]).toBe(0x8b)
  })
})
