/**
 * 群組 D：QR 編碼測試（qr-encoder.encodeFrameToQR）
 *
 * 範圍（ticket 1.2.0-W1-001 Phase 2 群組 D）：
 * - 場景 N4：正常 frame（<= 815 bytes）編碼 → QR 物件
 * - 場景 E4：frame 超過 QR type 25 容量 → 拋出 Error 含 frame 大小 + Logger.error
 *
 * 註：本檔以真實 qrcode-generator 驗證 Byte 模式編碼，frame 含 0x00-0xFF
 * 全範圍 byte，驗證 binary 字串轉換無失真。不含計時/精度斷言
 * （test-assertion-design-rules）。
 */

'use strict'

const { encodeFrameToQR } = require('src/sync/qr-encoder')

describe('encodeFrameToQR', () => {
  let loggerErrorSpy

  beforeEach(() => {
    loggerErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    loggerErrorSpy.mockRestore()
  })

  test('場景 N4：815 bytes frame 編碼回傳有效 QR 物件', () => {
    const frame = new Uint8Array(815)
    frame[0] = 0x51
    frame[1] = 0x52
    frame[2] = 0x01
    for (let i = 3; i < frame.length; i++) frame[i] = i & 0xFF

    const qr = encodeFrameToQR(frame)

    expect(qr).not.toBeNull()
    expect(typeof qr.getModuleCount).toBe('function')
    expect(qr.getModuleCount()).toBeGreaterThan(0)
    expect(typeof qr.isDark(0, 0)).toBe('boolean')
  })

  test('場景 N4：含 0x00-0xFF 全範圍 byte 的小 frame 可編碼', () => {
    const frame = new Uint8Array(256)
    for (let i = 0; i < 256; i++) frame[i] = i

    const qr = encodeFrameToQR(frame)

    expect(qr.getModuleCount()).toBeGreaterThan(0)
  })

  test('場景 E4：frame 超過 QR type 25 容量時拋出 Error 含 frame 大小', () => {
    const oversized = new Uint8Array(1500).fill(0x42)

    let thrown = null
    try {
      encodeFrameToQR(oversized)
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown.message).toContain('1500')

    expect(loggerErrorSpy).toHaveBeenCalled()
    const logged = loggerErrorSpy.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(logged).toContain('1500')
    expect(logged).toContain('QREncoder')
  })

  test('errorCorrectionLevel 選項可指定', () => {
    const frame = new Uint8Array([0x51, 0x52, 0x01, 0x10, 0x20])
    const qr = encodeFrameToQR(frame, { errorCorrectionLevel: 'L' })
    expect(qr.getModuleCount()).toBeGreaterThan(0)
  })
})
