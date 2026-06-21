/**
 * QR 動畫產生模組 — 傳輸編碼純邏輯（無 DOM / Canvas）
 *
 * 職責：書庫 JSON → gzip 壓縮 → CRC32 校驗 → 切塊加 frame header → QR 物件。
 * Canvas 輪播渲染由 src/popup/services/sync-qr-renderer.js 負責，兩者不互相依賴。
 *
 * 本檔涵蓋群組 A（壓縮）、B（CRC32）、C（切塊 + frame header）、D（QR 編碼）。
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

// 群組 C：frame header 固定 15 bytes（magic 2 + version 1 + total_frames 2 +
// frame_index 2 + total_size 4 + crc32 4）；App 端 PROP-014 §3 二進位格式。
const FRAME_HEADER_SIZE = 15
const FRAME_MAGIC_0 = 0x51
const FRAME_MAGIC_1 = 0x52
const FRAME_VERSION = 0x01
const DEFAULT_CHUNK_SIZE = 800

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

    const writeDone = writer.write(inputBytes).then(() => writer.close())
    const { chunks, totalLength } = await readStreamToBytes(stream.readable.getReader())
    await writeDone

    return concatChunks(chunks, totalLength)
  } catch (error) {
    logger.error('資料壓縮失敗：' + error.message, { component: 'QREncoder' })
    throw new Error('資料壓縮失敗')
  }
}

/**
 * 讀盡 reader 收集所有 chunk 並累計總長度。
 *
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader
 * @returns {Promise<{chunks: Uint8Array[], totalLength: number}>}
 */
async function readStreamToBytes (reader) {
  const chunks = []
  let totalLength = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    chunks.push(value)
    totalLength += value.length
  }
  return { chunks, totalLength }
}

/**
 * 合併多個 chunk 為單一連續 Uint8Array。
 *
 * @param {Uint8Array[]} chunks
 * @param {number} totalLength
 * @returns {Uint8Array}
 */
function concatChunks (chunks, totalLength) {
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
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
 * 群組 C：將壓縮資料切塊並加上 15 bytes frame header。
 *
 * 每幀 = 15 bytes header + payload（最後一幀允許 < chunkSize）。CRC32 與
 * total_size 取自整段壓縮資料，所有幀共用，供 App 端組裝後校驗完整性。
 *
 * @param {Uint8Array} compressedData - gzip 壓縮後的位元組
 * @param {number} [chunkSize=800] - 每幀 payload 上限
 * @returns {Uint8Array[]} 含 header 的 frame 陣列
 */
export function createFrames (compressedData, chunkSize = DEFAULT_CHUNK_SIZE) {
  const totalSize = compressedData.length
  const crc32 = calculateCRC32(compressedData)
  const totalFrames = Math.ceil(totalSize / chunkSize)
  const frames = []

  for (let i = 0; i < totalFrames; i++) {
    const offset = i * chunkSize
    const chunk = compressedData.subarray(offset, offset + chunkSize)

    const frame = new Uint8Array(FRAME_HEADER_SIZE + chunk.length)
    const view = new DataView(frame.buffer)
    frame[0] = FRAME_MAGIC_0
    frame[1] = FRAME_MAGIC_1
    frame[2] = FRAME_VERSION
    view.setUint16(3, totalFrames, false)
    view.setUint16(5, i, false)
    view.setUint32(7, totalSize, false)
    view.setUint32(11, crc32, false)
    frame.set(chunk, FRAME_HEADER_SIZE)

    frames.push(frame)
  }

  return frames
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
 * 群組 E：完整管線 — JSON 字串 → gzip 壓縮 → 切塊加 header → 逐幀 QR 編碼。
 *
 * 空書庫（books 陣列為空或缺失）阻止流程並拋出 Error，對應 Phase 1 場景 E1。
 * 壓縮後 <= chunkSize 時 isStatic=true 且僅產出單幀，供渲染器靜態顯示。
 *
 * @param {string} jsonString - 同步用 JSON 字串（含 books 陣列）
 * @param {Object} [options] - { chunkSize: 800, errorCorrectionLevel: 'M' }
 * @returns {Promise<{frames: Object[], totalSize: number, isStatic: boolean}>}
 * @throws {Error} 書庫為空、壓縮失敗或 QR 編碼失敗
 */
export async function encodeBookDataToQRFrames (jsonString, options = {}) {
  const parsed = JSON.parse(jsonString)
  if (!Array.isArray(parsed.books) || parsed.books.length === 0) {
    logger.error('書庫為空，無法產生 QR', { component: 'QREncoder' })
    throw new Error('書庫中沒有書籍，請先提取書庫資料')
  }

  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE
  const compressed = await compressData(jsonString)
  const isStatic = compressed.length <= chunkSize

  const rawFrames = createFrames(compressed, chunkSize)
  const frames = rawFrames.map((frame) => encodeFrameToQR(frame, options))

  return { frames, totalSize: compressed.length, isStatic }
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
