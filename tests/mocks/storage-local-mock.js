/**
 * Storage Local Mock - 單一責任原則實現
 * 遵循 Five Lines 規則，每個方法職責明確
 * 提供精確的 Chrome Storage Local API 模擬
 *
 * @author TDD Phase 4 - cinnamon-refactor-owl重構設計師
 * @date 2025-08-25
 * @version v0.9.38-refactor
 */

/**
 * Chrome Storage Local API Mock
 * 精確模擬 chrome.storage.local 的行為
 */
class StorageLocalMock {
  constructor () {
    this._initializeStorage()
    this._initializeConfig()
  }

  /**
   * 初始化儲存容器
   */
  _initializeStorage () {
    this._data = new Map()
  }

  /**
   * 初始化配置參數
   */
  _initializeConfig () {
    this._quota = 5242880 // 5MB
    this._used = 0
  }

  /**
   * 獲取儲存資料
   * @param {string|Array|Object|null} keys - 要獲取的鍵
   * @param {Function} callback - 回調函數
   */
  get (keys, callback) {
    const result = this._getRequestedData(keys)
    this._executeCallback(callback, result)
  }

  /**
   * 獲取請求的資料
   */
  _getRequestedData (keys) {
    if (Array.isArray(keys)) {
      return this._getMultipleKeys(keys)
    }
    return this._getSingleOrAllKeys(keys)
  }

  /**
   * 獲取多個鍵的資料
   */
  _getMultipleKeys (keys) {
    const result = {}
    keys.forEach(key => {
      this._addKeyToResult(result, key)
    })
    return result
  }

  /**
   * 添加鍵到結果中
   */
  _addKeyToResult (result, key) {
    if (this._data.has(key)) {
      result[key] = this._data.get(key)
    }
  }

  /**
   * 獲取單個鍵或所有鍵的資料
   */
  _getSingleOrAllKeys (keys) {
    if (keys === null || keys === undefined) {
      return this._getAllData()
    }
    return this._getSingleKeyData(keys)
  }

  /**
   * 獲取所有資料
   */
  _getAllData () {
    const result = {}
    this._data.forEach((value, key) => {
      result[key] = value
    })
    return result
  }

  /**
   * 獲取單個鍵的資料
   */
  _getSingleKeyData (key) {
    const result = {}
    if (this._data.has(key)) {
      result[key] = this._data.get(key)
    }
    return result
  }

  /**
   * 儲存資料
   * @param {Object} items - 要儲存的項目
   * @param {Function} callback - 回調函數
   */
  set (items, callback) {
    this._validateItems(items)
    this._checkQuota(items)
    this._storeItems(items)
    this._executeCallback(callback)
  }

  /**
   * 驗證項目有效性
   */
  _validateItems (items) {
    if (!items || typeof items !== 'object') {
      throw new Error('Items must be an object')
    }
  }

  /**
   * 檢查儲存配額
   */
  _checkQuota (items) {
    const itemsSize = this._calculateSize(items)
    this._validateQuotaLimit(itemsSize)
  }

  /**
   * 計算項目大小
   */
  _calculateSize (items) {
    return JSON.stringify(items).length
  }

  /**
   * 驗證配額限制
   */
  _validateQuotaLimit (itemsSize) {
    if (this._used + itemsSize > this._quota) {
      throw new Error('Storage quota exceeded')
    }
  }

  /**
   * 儲存項目
   */
  _storeItems (items) {
    Object.entries(items).forEach(([key, value]) => {
      this._storeItem(key, value)
    })
  }

  /**
   * 儲存單個項目
   */
  _storeItem (key, value) {
    const oldSize = this._getKeySize(key)
    const newSize = this._calculateItemSize(key, value)

    this._updateUsedQuota(oldSize, newSize)
    this._data.set(key, value)
  }

  /**
   * 獲取鍵的大小
   */
  _getKeySize (key) {
    if (!this._data.has(key)) return 0
    return this._calculateItemSize(key, this._data.get(key))
  }

  /**
   * 計算項目大小
   */
  _calculateItemSize (key, value) {
    return JSON.stringify({ [key]: value }).length
  }

  /**
   * 更新已使用配額
   */
  _updateUsedQuota (oldSize, newSize) {
    this._used = this._used - oldSize + newSize
  }

  /**
   * 刪除資料
   * @param {string|Array} keys - 要刪除的鍵
   * @param {Function} callback - 回調函數
   */
  remove (keys, callback) {
    const keysToRemove = this._normalizeKeys(keys)
    this._removeKeys(keysToRemove)
    this._executeCallback(callback)
  }

  /**
   * 正規化鍵格式
   */
  _normalizeKeys (keys) {
    return Array.isArray(keys) ? keys : [keys]
  }

  /**
   * 刪除多個鍵
   */
  _removeKeys (keys) {
    keys.forEach(key => {
      this._removeKey(key)
    })
  }

  /**
   * 刪除單個鍵
   */
  _removeKey (key) {
    if (this._data.has(key)) {
      const size = this._getKeySize(key)
      this._updateUsedAfterRemoval(size)
      this._data.delete(key)
    }
  }

  /**
   * 更新刪除後的已使用配額
   */
  _updateUsedAfterRemoval (size) {
    this._used -= size
  }

  /**
   * 清除所有資料
   * @param {Function} callback - 回調函數
   */
  clear (callback) {
    this._clearAllData()
    this._resetUsedQuota()
    this._executeCallback(callback)
  }

  /**
   * 清除所有資料
   */
  _clearAllData () {
    this._data.clear()
  }

  /**
   * 重置已使用配額
   */
  _resetUsedQuota () {
    this._used = 0
  }

  /**
   * 獲取已使用的位元組數
   * @param {string|Array|null} keys - 要檢查的鍵
   * @param {Function} callback - 回調函數
   */
  getBytesInUse (keys, callback) {
    const size = this._calculateBytesInUse(keys)
    this._executeCallback(callback, size)
  }

  /**
   * 計算已使用的位元組數
   */
  _calculateBytesInUse (keys) {
    if (!keys) {
      return this._used
    }
    return this._calculateSpecificKeysSize(keys)
  }

  /**
   * 計算特定鍵的大小
   */
  _calculateSpecificKeysSize (keys) {
    const keysToCheck = this._normalizeKeys(keys)
    return keysToCheck.reduce((total, key) => {
      return total + this._getKeySize(key)
    }, 0)
  }

  /**
   * 執行回調函數
   * @param {Function} callback - 回調函數
   * @param {any} result - 回調結果
   */
  _executeCallback (callback, result = {}) {
    if (this._isValidCallback(callback)) {
      this._invokeCallback(callback, result)
    }
  }

  /**
   * 驗證回調函數有效性
   */
  _isValidCallback (callback) {
    return callback && typeof callback === 'function'
  }

  /**
   * 調用回調函數
   */
  _invokeCallback (callback, result) {
    setTimeout(() => callback(result), 0)
  }
}

module.exports = StorageLocalMock
