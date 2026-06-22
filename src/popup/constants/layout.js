/**
 * Popup 佈局與時序常數 - popup-specific 值集中管理
 *
 * 僅放置 popup 專屬的尺寸、超時與輪詢時序。通用的 spacing / typography / radius
 * token 由 src/core/design-system/ 提供（HTML 透過 design-system.css 的 CSS 變數
 * 引用），不在此重複定義。
 */

/**
 * Popup 視窗尺寸（對應 popup.html body 的 width / min-height）
 */
const POPUP_DIMENSIONS = Object.freeze({
  WIDTH_PX: 350,
  MIN_HEIGHT_PX: 400
})

/**
 * 狀態輪詢與頁面偵測配置
 */
const STATUS_CONFIG = Object.freeze({
  STATUS_UPDATE_INTERVAL_MS: 3000,
  READMOO_DOMAIN: 'readmoo.com'
})

/**
 * popup↔SW 握手重試配置（1.1.0-W1-019 A+C 方案）
 */
const HANDSHAKE_CONFIG = Object.freeze({
  TIMEOUT_MS: 2000,
  MAX_RETRY_ATTEMPTS: 3,
  INITIAL_RETRY_DELAY_MS: 1000,
  RETRY_BACKOFF_MULTIPLIER: 2
})

module.exports = {
  POPUP_DIMENSIONS,
  STATUS_CONFIG,
  HANDSHAKE_CONFIG
}
