/**
 * Crypto Shim for Chrome Extension Environment
 *
 * 業務情境：
 * - Chrome Extension service worker / content script / popup 環境不支援 Node.js `crypto` 模組
 * - esbuild platform:browser 不會 polyfill `node:crypto`，原 `require('crypto')` 觸發即崩潰
 * - 既有 6 個 service / handler 使用 crypto.createHash('md5'|'sha256') 與 crypto.randomBytes
 *   均屬 cache key / ID 生成（非加密用途，無簽章 / 認證 / 密碼存儲）
 *
 * 設計決策：
 * - 採用 sync DJB2 hash 取代 crypto.createHash，避免 Web Crypto subtle.digest async 蔓延至所有 caller
 * - 採用 Web Crypto getRandomValues (sync) 取代 crypto.randomBytes
 * - DJB2 碰撞機率高於 md5/sha256，但 cache key / ID 場景可容忍碰撞（最差只是 cache miss 或重新計算）
 *
 * 變更影響範圍：
 * - 既有 cache key 與 crossPlatformId 在升級後將與舊版本不同（破壞性變更）
 * - 同一輸入仍保證輸出一致性（DJB2 為確定性 hash）
 * - 若未來需要加密強度 hash，必須改用 async crypto.subtle.digest 並重構 caller
 *
 * 變更同步位置：
 * - 直接呼叫者：6 個檔案使用 djb2Hex / randomHex 替代原 crypto.* API
 * - W1-050.4 ticket
 */

/**
 * 同步 DJB2 hash，輸出 8 字元 hex 字串
 *
 * 與原 `crypto.createHash('md5'|'sha256').update(str).digest('hex')` 介面對齊：
 * 輸入 string，輸出 hex string。但輸出長度固定 8 字元（不像 md5 32 字元 / sha256 64 字元），
 * 若 caller 需要更長 hex 請用 djb2HexLong。
 *
 * @param {string} str - 輸入字串
 * @returns {string} 8 字元 hex hash
 */
function djb2Hex (str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * 同步 DJB2 hash，輸出 16 字元 hex 字串
 *
 * 用於原本 .substring(0, 16) 或不切片的 sha256/md5 caller。
 * 透過 hash(str) + hash(str + 'salt') 拼接擴展 8→16 字元，仍非加密強度。
 *
 * @param {string} str - 輸入字串
 * @returns {string} 16 字元 hex hash
 */
function djb2Hex16 (str) {
  const h1 = djb2Hex(str)
  const h2 = djb2Hex(str + ':' + h1)
  return h1 + h2
}

/**
 * 同步隨機 hex 字串
 *
 * 與原 `crypto.randomBytes(n).toString('hex')` 介面對齊：
 * 輸入 byte 數，輸出 2*n 字元 hex 字串。
 * 使用 Web Crypto getRandomValues（CE service worker / browser 環境原生支援）。
 *
 * @param {number} n - 隨機 byte 數
 * @returns {string} 2*n 字元 hex 字串
 */
function randomHex (n) {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(n))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

module.exports = {
  djb2Hex,
  djb2Hex16,
  randomHex
}
