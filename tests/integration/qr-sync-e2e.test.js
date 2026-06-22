/**
 * QR 離線同步端到端整合測試（Extension 端）
 *
 * Ticket: 1.2.0-W2-001
 *
 * 驗證鏈：
 *   AC-1: Extension QR 動畫輸出的 frame 格式符合 SPEC-009
 *   AC-2: App JSON 匯出的 sync_meta 格式可正確解析
 *   AC-3: 防舊蓋新：舊 exported_at 匯入時警告正確觸發
 *
 * 測試 fixtures:
 *   - docs/spec/synchronization/test-fixtures/frame-format-vectors.json
 *
 * @jest-environment jsdom
 */

'use strict'

const fs = require('fs')
const path = require('path')

const { calculateCRC32, createFrames } = require('src/sync/qr-encoder')
const { parseAndValidate, checkStaleness, executeImport, IMPORT_ERROR_CODES } = require('src/import/json-importer')
const { buildSyncJSON } = require('src/sync/sync-json-builder')

const SPEC_FIXTURES_DIR = path.resolve(__dirname, '../../docs/spec/synchronization/test-fixtures')
const frameVectors = JSON.parse(
  fs.readFileSync(path.join(SPEC_FIXTURES_DIR, 'frame-format-vectors.json'), 'utf8')
)

// Frame header 解析工具（模擬 App 端解碼）
function parseFrameHeader (frame) {
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength)
  return {
    magic: (frame[0] << 8) | frame[1],
    version: frame[2],
    totalFrames: view.getUint16(3, false),
    frameIndex: view.getUint16(5, false),
    totalSize: view.getUint32(7, false),
    crc32: view.getUint32(11, false)
  }
}

describe('AC-1: QR Frame 格式符合 SPEC-009', () => {
  test('CRC32 已知值驗證（SPEC-009 test vector: crc32-known-value）', () => {
    const vector = frameVectors.vectors.find(v => v.id === 'crc32-known-value')
    const inputBytes = new Uint8Array(
      vector.input_bytes_hex.match(/.{2}/g).map(b => parseInt(b, 16))
    )
    const result = calculateCRC32(inputBytes)
    expect(result).toBe(vector.expected_crc32_uint32)
  })

  test('單幀 frame header 結構正確（SPEC-009: magic/version/total_frames/frame_index）', () => {
    const testData = new Uint8Array([1, 2, 3, 4, 5])
    const frames = createFrames(testData, 800)

    expect(frames).toHaveLength(1)

    const header = parseFrameHeader(frames[0])
    expect(header.magic).toBe(0x5152)
    expect(header.version).toBe(0x01)
    expect(header.totalFrames).toBe(1)
    expect(header.frameIndex).toBe(0)
    expect(header.totalSize).toBe(5)
    expect(header.crc32).toBe(calculateCRC32(testData))
  })

  test('多幀 frame header 所有幀共用 crc32 和 total_size', () => {
    const bigData = new Uint8Array(2000)
    for (let i = 0; i < bigData.length; i++) bigData[i] = i % 256
    const frames = createFrames(bigData, 800)

    expect(frames.length).toBeGreaterThanOrEqual(2)

    const headers = frames.map(f => parseFrameHeader(f))
    const firstHeader = headers[0]

    headers.forEach((h, i) => {
      expect(h.magic).toBe(0x5152)
      expect(h.version).toBe(0x01)
      expect(h.totalFrames).toBe(frames.length)
      expect(h.frameIndex).toBe(i)
      expect(h.totalSize).toBe(firstHeader.totalSize)
      expect(h.crc32).toBe(firstHeader.crc32)
    })
  })

  test('所有 payload 拼接後長度等於 total_size 且 CRC32 一致', () => {
    const bigData = new Uint8Array(2000)
    for (let i = 0; i < bigData.length; i++) bigData[i] = i % 256
    const frames = createFrames(bigData, 800)

    const header = parseFrameHeader(frames[0])
    const payloads = frames.map(f => f.subarray(15))
    const totalLength = payloads.reduce((sum, p) => sum + p.length, 0)
    expect(totalLength).toBe(header.totalSize)

    const combined = new Uint8Array(totalLength)
    let offset = 0
    for (const p of payloads) {
      combined.set(p, offset)
      offset += p.length
    }
    expect(calculateCRC32(combined)).toBe(header.crc32)
  })

  test('header byte order 為 big-endian（createFrames 產出驗證）', () => {
    const data = new Uint8Array(1700)
    for (let i = 0; i < data.length; i++) data[i] = i % 256
    const frames = createFrames(data, 800)

    expect(frames.length).toBeGreaterThanOrEqual(2)

    const header = parseFrameHeader(frames[1])
    expect(header.magic).toBe(0x5152)
    expect(header.frameIndex).toBe(1)
    expect(header.totalFrames).toBe(frames.length)

    const raw = frames[1]
    const manualTotalFrames = (raw[3] << 8) | raw[4]
    expect(manualTotalFrames).toBe(header.totalFrames)
  })
})

describe('AC-2: sync_meta 格式可正確解析', () => {
  test('canonical 格式 JSON 的 metadata 正確解析', () => {
    const canonicalJSON = JSON.stringify({
      format: 'book-interchange-v1',
      metadata: {
        formatVersion: '3.0.0',
        exportedAt: '2026-06-22T10:00:00Z',
        sourceApp: 'book-overview-app',
        totalBooks: 2
      },
      books: [
        { id: 'b1', title: 'Test Book 1', readingStatus: 'reading' },
        { id: 'b2', title: 'Test Book 2', readingStatus: 'finished' }
      ]
    })

    const result = parseAndValidate(canonicalJSON)

    expect(result.code).toBeUndefined()
    expect(result.source).toBe('canonical')
    expect(result.metadata.exportedAt).toBe('2026-06-22T10:00:00Z')
    expect(result.metadata.sourceApp).toBe('book-overview-app')
    expect(result.metadata.totalBooks).toBe(2)
    expect(result.bookCount).toBe(2)
  })

  test('v2 格式 JSON 含 sync_meta 可正確解析', () => {
    const v2JSON = JSON.stringify({
      format_version: '2.0',
      sync_meta: {
        source: 'extension',
        exported_at: '2026-06-22T10:00:00Z',
        total_books: 3
      },
      books: [
        { id: 'b1', title: 'Book 1' },
        { id: 'b2', title: 'Book 2' },
        { id: 'b3', title: 'Book 3' }
      ]
    })

    const result = parseAndValidate(v2JSON)

    expect(result.code).toBeUndefined()
    expect(result.bookCount).toBe(3)
  })

  test('buildSyncJSON 產出含 sync_meta 的合法 JSON', () => {
    const books = [
      { id: 'b1', title: 'Book 1', updatedAt: '2026-06-22' }
    ]

    const jsonString = buildSyncJSON(books)
    const parsed = JSON.parse(jsonString)

    expect(parsed.format_version).toBe('2.0')
    expect(parsed.sync_meta).toBeDefined()
    expect(parsed.sync_meta.source_app).toBe('chrome-extension')
    expect(parsed.sync_meta.exported_at).toBeDefined()
    expect(parsed.sync_meta.book_count).toBe(1)
    expect(parsed.books).toHaveLength(1)
  })

  test('空書籍陣列被 parseAndValidate 拒絕', () => {
    const emptyJSON = JSON.stringify({
      format_version: '2.0',
      books: []
    })

    const result = parseAndValidate(emptyJSON)
    expect(result.code).toBe(IMPORT_ERROR_CODES.EMPTY_BOOKS)
  })

  test('無效 JSON 被 parseAndValidate 拒絕', () => {
    const result = parseAndValidate('not valid json {{{')
    expect(result.code).toBe(IMPORT_ERROR_CODES.PARSE_ERROR)
  })
})

describe('AC-3: 防舊蓋新機制', () => {
  let storageData

  beforeEach(() => {
    storageData = {}
    chrome.storage.local.get.mockImplementation((keys, cb) => {
      const result = {}
      const keyList = Array.isArray(keys) ? keys : [keys]
      for (const k of keyList) {
        if (storageData[k] !== undefined) {
          result[k] = storageData[k]
        }
      }
      if (cb) cb(result)
    })
    chrome.storage.local.set.mockImplementation((items, cb) => {
      Object.assign(storageData, items)
      if (cb) cb()
    })
  })

  test('exportedAt 較 lastImportedAt 舊時 isStale=true', async () => {
    storageData.last_imported_at = '2026-06-22T10:00:00Z'

    const result = await checkStaleness('2026-06-20T10:00:00Z')

    expect(result.isStale).toBe(true)
    expect(result.exportedAt).toBe('2026-06-20T10:00:00Z')
    expect(result.lastImportedAt).toBe('2026-06-22T10:00:00Z')
  })

  test('exportedAt 較 lastImportedAt 新時 isStale=false', async () => {
    storageData.last_imported_at = '2026-06-20T10:00:00Z'

    const result = await checkStaleness('2026-06-22T10:00:00Z')

    expect(result.isStale).toBe(false)
  })

  test('無 lastImportedAt（首次匯入）時 isStale=false', async () => {
    const result = await checkStaleness('2026-06-22T10:00:00Z')

    expect(result.isStale).toBe(false)
    expect(result.lastImportedAt).toBeNull()
  })

  test('exportedAt 為 null 時 isStale=false', async () => {
    storageData.last_imported_at = '2026-06-22T10:00:00Z'

    const result = await checkStaleness(null)

    expect(result.isStale).toBe(false)
  })

  test('executeImport 對 stale data 回傳 STALE_DATA 錯誤碼和 staleness 資訊', async () => {
    storageData.last_imported_at = '2026-06-22T10:00:00Z'

    const canonicalJSON = JSON.stringify({
      format: 'book-interchange-v1',
      metadata: {
        formatVersion: '3.0.0',
        exportedAt: '2026-06-20T10:00:00Z',
        sourceApp: 'book-overview-app',
        totalBooks: 1
      },
      books: [
        { id: 'b1', title: 'Test Book', readingStatus: 'reading' }
      ]
    })

    const result = await executeImport(canonicalJSON)

    expect(result.success).toBe(false)
    expect(result.error.code).toBe(IMPORT_ERROR_CODES.STALE_DATA)
    expect(result.staleness).toBeDefined()
    expect(result.staleness.isStale).toBe(true)
  })

  test('executeImport 帶 skipStalenessCheck 繞過防舊蓋新', async () => {
    storageData.last_imported_at = '2026-06-22T10:00:00Z'
    storageData.readmoo_books = { books: [] }

    const canonicalJSON = JSON.stringify({
      format: 'book-interchange-v1',
      metadata: {
        formatVersion: '3.0.0',
        exportedAt: '2026-06-20T10:00:00Z',
        sourceApp: 'book-overview-app',
        totalBooks: 1
      },
      books: [
        { id: 'b1', title: 'Test Book', readingStatus: 'reading' }
      ]
    })

    const result = await executeImport(canonicalJSON, { skipStalenessCheck: true })

    expect(result.success).toBe(true)
    expect(result.summary).toBeDefined()
    expect(result.summary.added).toBeGreaterThanOrEqual(0)
  })
})
