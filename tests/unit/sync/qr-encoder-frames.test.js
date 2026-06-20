/**
 * 群組 C：Frame 切塊 + 15 bytes header 測試（qr-encoder.createFrames）
 *
 * 範圍（ticket 1.2.0-W1-001 Phase 2 群組 C）：
 * - 場景 N3：2000 bytes / chunkSize 800 → 3 frames，payload 800/800/400
 * - 場景 B3：1600 bytes（整除）→ 2 frames，每塊 800
 * - 場景 B4：500 bytes（單塊）→ 1 frame，total_frames=1
 * - 場景 N3-header：逐 byte 驗證 15 bytes header（magic/version/BE fields/CRC32）
 *
 * header 格式：[0-1] magic 0x51 0x52, [2] version 0x01,
 *   [3-4] total_frames BE uint16, [5-6] frame_index BE uint16,
 *   [7-10] total_size BE uint32, [11-14] crc32 BE uint32, [15+] payload
 *
 * 註：本檔為功能正確性測試，不含計時/精度斷言（test-assertion-design-rules）。
 */

'use strict'

const { createFrames, calculateCRC32 } = require('src/sync/qr-encoder')

const HEADER_SIZE = 15

function makeData (length) {
  const data = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    data[i] = i & 0xFF
  }
  return data
}

function readUint16BE (frame, offset) {
  return (frame[offset] << 8) | frame[offset + 1]
}

function readUint32BE (frame, offset) {
  return ((frame[offset] << 24) | (frame[offset + 1] << 16) |
    (frame[offset + 2] << 8) | frame[offset + 3]) >>> 0
}

describe('createFrames', () => {
  test('場景 N3：2000 bytes / chunkSize 800 切成 3 frames，payload 800/800/400', () => {
    const data = makeData(2000)
    const frames = createFrames(data, 800)

    expect(frames).toHaveLength(3)
    expect(frames[0].length - HEADER_SIZE).toBe(800)
    expect(frames[1].length - HEADER_SIZE).toBe(800)
    expect(frames[2].length - HEADER_SIZE).toBe(400)
  })

  test('場景 N3：每個 frame header total_frames=3 且 frame_index 遞增', () => {
    const data = makeData(2000)
    const frames = createFrames(data, 800)

    frames.forEach((frame, index) => {
      expect(frame[0]).toBe(0x51)
      expect(frame[1]).toBe(0x52)
      expect(frame[2]).toBe(0x01)
      expect(readUint16BE(frame, 3)).toBe(3)
      expect(readUint16BE(frame, 5)).toBe(index)
      expect(readUint32BE(frame, 7)).toBe(2000)
    })
  })

  test('場景 N3：payload 內容為原始資料對應切塊', () => {
    const data = makeData(2000)
    const frames = createFrames(data, 800)

    expect(Array.from(frames[0].slice(HEADER_SIZE)))
      .toEqual(Array.from(data.slice(0, 800)))
    expect(Array.from(frames[2].slice(HEADER_SIZE)))
      .toEqual(Array.from(data.slice(1600, 2000)))
  })

  test('場景 B3：1600 bytes（整除 chunkSize）切成 2 frames，每塊 800', () => {
    const data = makeData(1600)
    const frames = createFrames(data, 800)

    expect(frames).toHaveLength(2)
    expect(frames[0].length - HEADER_SIZE).toBe(800)
    expect(frames[1].length - HEADER_SIZE).toBe(800)
  })

  test('場景 B4：500 bytes（單塊）切成 1 frame，total_frames=1 frame_index=0', () => {
    const data = makeData(500)
    const frames = createFrames(data, 800)

    expect(frames).toHaveLength(1)
    expect(readUint16BE(frames[0], 3)).toBe(1)
    expect(readUint16BE(frames[0], 5)).toBe(0)
    expect(readUint32BE(frames[0], 7)).toBe(500)
    expect(frames[0].length - HEADER_SIZE).toBe(500)
  })

  test('場景 N3-header：crc32 欄位等於整段壓縮資料的 CRC32（BE uint32）', () => {
    const data = makeData(2000)
    const expectedCrc = calculateCRC32(data)
    const frames = createFrames(data, 800)

    frames.forEach((frame) => {
      expect(readUint32BE(frame, 11)).toBe(expectedCrc)
    })
  })

  test('場景 N3-header：第一個 frame 逐 byte 驗證 15 bytes header', () => {
    const data = makeData(2000)
    const crc = calculateCRC32(data)
    const frame = createFrames(data, 800)[0]

    const expectedHeader = [
      0x51, 0x52, 0x01,
      0x00, 0x03,
      0x00, 0x00,
      (2000 >>> 24) & 0xFF, (2000 >>> 16) & 0xFF, (2000 >>> 8) & 0xFF, 2000 & 0xFF,
      (crc >>> 24) & 0xFF, (crc >>> 16) & 0xFF, (crc >>> 8) & 0xFF, crc & 0xFF
    ]
    expect(Array.from(frame.slice(0, HEADER_SIZE))).toEqual(expectedHeader)
  })

  test('預設 chunkSize 為 800', () => {
    const data = makeData(1000)
    const frames = createFrames(data)

    expect(frames).toHaveLength(2)
    expect(frames[0].length - HEADER_SIZE).toBe(800)
    expect(frames[1].length - HEADER_SIZE).toBe(200)
  })
})
