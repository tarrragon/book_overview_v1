/**
 * 錯誤代碼常數定義 - 統一匯出入口
 *
 * 各域錯誤代碼定義在 src/core/errors/codes/ 目錄下，
 * 本檔案統一 re-export 為單一 ErrorCodes 物件，保持向後相容。
 *
 * 域分檔：
 * - validation.js    驗證相關
 * - network.js       網路相關
 * - storage.js       儲存與記憶體
 * - export.js        匯出相關
 * - security.js      安全與權限
 * - chrome-extension.js  Chrome Extension
 * - ui.js            UI 與通知顯示
 * - data-processing.js   資料處理
 * - messaging.js     訊息傳遞與事件總線
 * - system.js        系統與操作
 */
const { ValidationCodes } = require('./codes/validation')
const { NetworkCodes } = require('./codes/network')
const { StorageCodes } = require('./codes/storage')
const { ExportCodes } = require('./codes/export')
const { SecurityCodes } = require('./codes/security')
const { ChromeExtensionCodes } = require('./codes/chrome-extension')
const { UiCodes } = require('./codes/ui')
const { DataProcessingCodes } = require('./codes/data-processing')
const { MessagingCodes } = require('./codes/messaging')
const { SystemCodes } = require('./codes/system')

/**
 * 系統錯誤代碼常數 - 核心代碼與擴展代碼
 * @readonly
 * @enum {string}
 */
const ErrorCodes = {
  ...ValidationCodes,
  ...NetworkCodes,
  ...StorageCodes,
  ...ExportCodes,
  ...SecurityCodes,
  ...ChromeExtensionCodes,
  ...UiCodes,
  ...DataProcessingCodes,
  ...MessagingCodes,
  ...SystemCodes
}

// 凍結物件以防止意外修改
Object.freeze(ErrorCodes)

// CommonJS 支援
module.exports = {
  ErrorCodes
}
