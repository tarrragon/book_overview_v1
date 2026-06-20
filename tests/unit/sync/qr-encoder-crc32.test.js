/**
 * 群組 B：CRC32 計算測試（qr-encoder.calculateCRC32）
 *
 * 範圍（ticket 1.2.0-W1-001 Phase 2 群組 B）：
 * - 場景 N2：RFC 3720 已知向量 "123456789" → 0xCBF43926
 * - 場景 B2-a：空陣列 → 0x00000000
 * - 場景 B2-b：單 byte [0x00] → 已知值
 * - 場景 B2-c：回傳值範圍 0 ~ 0xFFFFFFFF（32-bit unsigned）
 *
 * 註：本檔為功能正確性測試，不含計時/精度斷言（test-assertion-design-rules）。
 */

'use strict'

const { calculateCRC32 } = require('src/sync/qr-encoder')

describe('calculateCRC32', () => {
  test('場景 N2：已知向量 "123456789" 回傳 0xCBF43926', () => {
    const data = new TextEncoder().encode('123456789')
    expect(calculateCRC32(data)).toBe(0xCBF43926)
  })

  test('場景 B2-a：空陣列回傳 0x00000000', () => {
    expect(calculateCRC32(new Uint8Array(0))).toBe(0x00000000)
  })

  test('場景 B2-b：單 byte [0x00] 回傳 0xD202EF8D', () => {
    expect(calculateCRC32(new Uint8Array([0x00]))).toBe(0xD202EF8D)
  })

  test('場景 B2-c：回傳值為 32-bit unsigned（0 ~ 0xFFFFFFFF）', () => {
    const data = new Uint8Array([0xFF, 0x80, 0x01, 0x00, 0xAB, 0xCD])
    const crc = calculateCRC32(data)
    expect(crc).toBeGreaterThanOrEqual(0)
    expect(crc).toBeLessThanOrEqual(0xFFFFFFFF)
    expect(Number.isInteger(crc)).toBe(true)
  })

  test('不同輸入產生不同 CRC32（碰撞辨識）', () => {
    const a = calculateCRC32(new TextEncoder().encode('hello'))
    const b = calculateCRC32(new TextEncoder().encode('world'))
    expect(a).not.toBe(b)
  })
})
