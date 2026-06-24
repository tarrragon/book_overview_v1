/**
 * Popup UI 常數 - 統一匯出入口
 *
 * - ui-text.js：UI 顯示文字（按功能分類）與語意枚舉
 * - layout.js：popup-specific 佈局尺寸與時序配置
 */

const uiText = require('./ui-text')
const layout = require('./layout')
const bookstoreConfig = require('./bookstore-config')

module.exports = {
  ...uiText,
  ...layout,
  ...bookstoreConfig
}
