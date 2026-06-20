/**
 * QR 動畫產生模組 — 傳輸編碼純邏輯（無 DOM / Canvas）
 *
 * 職責：書庫 JSON → gzip 壓縮 → CRC32 校驗 → 切塊加 frame header → QR 物件。
 * Canvas 輪播渲染由 src/popup/services/sync-qr-renderer.js 負責，兩者不互相依賴。
 *
 * 本檔涵蓋群組 A（壓縮）、B（CRC32）、D（QR 編碼）。
 */

import { Logger } from '../core/logging/Logger.js'
import qrcode from 'qrcode-generator'

const logger = new Logger('QREncoder')

// 群組 B：CRC32 查找表（模組層級常數，載入時計算一次）
const CRC32_TABLE = buildCRC32Table()

// 群組 D：QR type number 上限。type 25 ECL M 的 Byte 模式容量約 1273 bytes，
// 涵蓋單幀最大 815 bytes（800 payload + 15 header）；超過則 make() 拋出，
// 對應 Phase 1 場景 E4「frame 超過 QR 容量」。
const QR_MAX_TYPE_NUMBER = 25
const QR_DEFAULT_EC_LEVEL = 'M'

/**
 * 群組 A：gzip 壓縮 JSON 字串。
 *
 * @param {string} jsonString - 待壓縮的 JSON 字串
 * @returns {Promise<Uint8Array>} gzip 壓縮後的位元組
 * @throws {Error} CompressionStream 不可用或壓縮過程失敗
 */
export async function compressData (jsonString) {
  if (typeof CompressionStream === 'undefined') {
    logger.error('壓縮功能不可用：CompressionStream API 不存在', { component: 'QREncoder' })
    throw new Error('壓縮功能不可用，請更新瀏覽器')
  }

  try {
    const inputBytes = new TextEncoder().encode(jsonString)
    const stream = new CompressionStream('gzip')
    const writer = stream.writable.getWriter()
    const reader = stream.readable.getReader()

    const writeDone = writer.write(inputBytes).then(() => writer.close())

    const chunks = []
    let totalLength = 0
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      chunks.push(value)
      totalLength += value.length
    }
    await writeDone

    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    return result
  } catch (error) {
    logger.error('資料壓縮失敗：' + error.message, { component: 'QREncoder' })
    throw new Error('資料壓縮失敗')
  }
}

/**
 * 群組 B：計算 CRC32 校驗值（32-bit unsigned）。
 *
 * @param {Uint8Array} data - 輸入位元組
 * @returns {number} CRC32 值（0 ~ 0xFFFFFFFF）
 */
export function calculateCRC32 (data) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

/**
 * 群組 D：將 frame 二進位編碼為 QR 物件（Byte 模式）。
 *
 * @param {Uint8Array} frameData - frame 位元組（含 header + payload）
 * @param {Object} [options] - { errorCorrectionLevel: 'M' }
 * @returns {Object} qrcode-generator QR 物件
 * @throws {Error} frame 超過 QR 容量或編碼失敗
 */
export function encodeFrameToQR (frameData, options = {}) {
  const ecLevel = options.errorCorrectionLevel || QR_DEFAULT_EC_LEVEL

  try {
    const qr = qrcode(QR_MAX_TYPE_NUMBER, ecLevel)
    qr.addData(bytesToBinaryString(frameData), 'Byte')
    qr.make()
    return qr
  } catch (error) {
    logger.error('QR 編碼失敗：' + frameData.length + ' bytes', {
      component: 'QREncoder',
      frameSize: frameData.length
    })
    throw new Error('QR 編碼失敗: ' + frameData.length + ' bytes')
  }
}

/**
 * 建構 CRC32 查找表（256 entries，IEEE 802.3 多項式 0xEDB88320）。
 *
 * @returns {Uint32Array} 256 entry 查找表
 */
function buildCRC32Table () {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c >>> 0
  }
  return table
}

/**
 * 將位元組陣列轉為 latin1 binary 字串。
 *
 * qrcode-generator 2.x Byte 模式以 charCodeAt 讀取輸入，需傳入字串而非
 * Uint8Array；逐 byte 經 String.fromCharCode 映射確保 0x00-0xFF 無失真。
 *
 * @param {Uint8Array} bytes - 輸入位元組
 * @returns {string} binary 字串
 */
function bytesToBinaryString (bytes) {
  let str = ''
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i])
  }
  return str
}
