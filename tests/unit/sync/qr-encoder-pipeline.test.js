/**
 * 群組 E：完整管線測試（qr-encoder.encodeBookDataToQRFrames）
 *
 * 範圍（ticket 1.2.0-W1-001 Phase 2 群組 E）：
 * - 場景 N5：大書庫，壓縮後 > 800 bytes → frames > 1, isStatic=false
 * - 場景 N6：小書庫，壓縮後 <= 800 bytes → frames=1, isStatic=true
 * - 場景 E1：空書庫 → 拋出 Error 不產出 QR + Logger.error
 * - 場景 B5：壓縮後恰好 800 bytes → isStatic=true, frames=1
 *
 * Mock 策略（Phase 2 測試設計）：以可控輸出長度的 CompressionStream mock
 * 取代真實 gzip，使「壓縮後位元組長度」成為可預測的測試輸入，藉此精準
 * 觸發 isStatic 邊界（<=800 / >800 / 恰好 800）。createFrames 與
 * encodeFrameToQR 為真實呼叫（符合管線整合驗證意圖）。
 *
 * 註：本檔為功能正確性測試，不含計時/精度斷言（test-assertion-design-rules）。
 */

'use strict'

const { encodeBookDataToQRFrames } = require('src/sync/qr-encoder')

// 可控輸出長度的 CompressionStream mock：忽略實際輸入內容，固定吐出
// 指定長度的 Uint8Array，使 isStatic 邊界可被精準測試。
function createFixedLengthCompressionStreamMock (outputLength) {
  return class MockCompressionStream {
    constructor () {
      const self = this
      this.writable = {
        getWriter () {
          return {
            async write () {},
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
              const out = new Uint8Array(outputLength)
              for (let i = 0; i < outputLength; i++) out[i] = i & 0xFF
              return { value: out, done: false }
            }
          }
        }
      }
    }
  }
}

function buildSyncJSON (bookCount) {
  const books = []
  for (let i = 0; i < bookCount; i++) {
    books.push({ id: 'b' + i, title: '書' + i })
  }
  return JSON.stringify({
    format_version: '2.0',
    books,
    sync_meta: { exported_at: '2026-06-20T00:00:00Z', book_count: bookCount }
  })
}

describe('encodeBookDataToQRFrames', () => {
  let loggerErrorSpy
  let originalCompressionStream

  beforeEach(() => {
    loggerErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    originalCompressionStream = globalThis.CompressionStream
  })

  afterEach(() => {
    loggerErrorSpy.mockRestore()
    globalThis.CompressionStream = originalCompressionStream
  })

  test('場景 N5：壓縮後 2000 bytes（> 800）→ 多幀且 isStatic=false', async () => {
    globalThis.CompressionStream = createFixedLengthCompressionStreamMock(2000)

    const result = await encodeBookDataToQRFrames(buildSyncJSON(200))

    expect(result.frames.length).toBe(3)
    expect(result.isStatic).toBe(false)
    expect(result.totalSize).toBe(2000)
    expect(typeof result.frames[0].getModuleCount).toBe('function')
  })

  test('場景 N6：壓縮後 500 bytes（<= 800）→ 單幀且 isStatic=true', async () => {
    globalThis.CompressionStream = createFixedLengthCompressionStreamMock(500)

    const result = await encodeBookDataToQRFrames(buildSyncJSON(5))

    expect(result.frames.length).toBe(1)
    expect(result.isStatic).toBe(true)
    expect(result.totalSize).toBe(500)
  })

  test('場景 B5：壓縮後恰好 800 bytes → isStatic=true, frames=1', async () => {
    globalThis.CompressionStream = createFixedLengthCompressionStreamMock(800)

    const result = await encodeBookDataToQRFrames(buildSyncJSON(10))

    expect(result.frames.length).toBe(1)
    expect(result.isStatic).toBe(true)
    expect(result.totalSize).toBe(800)
  })

  test('場景 E1：空書庫拋出 Error 不產出 QR 並記錄 Logger.error', async () => {
    globalThis.CompressionStream = createFixedLengthCompressionStreamMock(500)
    const json = JSON.stringify({ format_version: '2.0', books: [], sync_meta: {} })

    const error = await encodeBookDataToQRFrames(json).catch((e) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('書庫中沒有書籍')

    expect(loggerErrorSpy).toHaveBeenCalled()
    const logged = loggerErrorSpy.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(logged).toContain('QREncoder')
  })

  test('場景 E1：books 欄位缺失視為空書庫拋出 Error', async () => {
    globalThis.CompressionStream = createFixedLengthCompressionStreamMock(500)
    const json = JSON.stringify({ format_version: '2.0', sync_meta: {} })

    const error = await encodeBookDataToQRFrames(json).catch((e) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('書庫中沒有書籍')
  })

  test('chunkSize 選項可覆寫切塊邊界', async () => {
    globalThis.CompressionStream = createFixedLengthCompressionStreamMock(600)

    const result = await encodeBookDataToQRFrames(buildSyncJSON(20), { chunkSize: 300 })

    expect(result.frames.length).toBe(2)
    expect(result.isStatic).toBe(false)
  })
})
