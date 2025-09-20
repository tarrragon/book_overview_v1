/**
 * Storage Sync Mock - Chrome Storage Sync API 模擬
 * 遵循 Five Lines 規則和單一責任原則
 *
 * @author TDD Phase 4 - cinnamon-refactor-owl重構設計師
 * @date 2025-08-25
 * @version v0.9.38-refactor
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')
const StorageLocalMock = require('./storage-local-mock')
const { StandardError } = require('src/core/errors/StandardError')

/**
 * Chrome Storage Sync API Mock
 * 繼承 StorageLocalMock 並添加同步特有的限制和行為
 */
class StorageSyncMock extends StorageLocalMock {
  constructor () {
    super()
    this._initializeSyncConfig()
  }

  /**
   * 初始化同步特定配置
   */
  _initializeSyncConfig () {
    this._quota = 102400 // 100KB for sync
    this._maxItems = 512
    this._syncEnabled = true
  }

  /**
   * 檢查同步配額和項目數限制
   * @override
   */
  _checkQuota (items) {
    super._checkQuota(items)
    this._checkItemsLimit(items)
    this._checkSyncAvailability()
  }

  /**
   * 檢查項目數限制
   */
  _checkItemsLimit (items) {
    const newItemsCount = Object.keys(items).length
    const totalItems = this._data.size + newItemsCount

    this._validateItemsLimit(totalItems)
  }

  /**
   * 驗證項目數限制
   */
  _validateItemsLimit (totalItems) {
    if (totalItems > this._maxItems) {
      throw (() => { const error = new Error('Too many items in sync storage'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
    }
  }

  /**
   * 檢查同步可用性
   */
  _checkSyncAvailability () {
    if (!this._syncEnabled) {
      throw (() => { const error = new Error('Sync is disabled'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
    }
  }

  /**
   * 模擬同步延遲
   * @override
   */
  _invokeCallback (callback, result) {
    const syncDelay = this._calculateSyncDelay()
    setTimeout(() => callback(result), syncDelay)
  }

  /**
   * 計算同步延遲
   */
  _calculateSyncDelay () {
    return Math.random() * 100 + 50 // 50-150ms
  }
}

module.exports = StorageSyncMock
