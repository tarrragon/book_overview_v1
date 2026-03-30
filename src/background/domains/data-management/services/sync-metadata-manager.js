/**
 * SyncMetadataManager - Chrome Storage Sync API 元資料同步管理
 *
 * 負責功能：
 * - 管理透過 chrome.storage.sync 同步的輕量元資料
 * - 使用者設定（顯示偏好、排序方式等）
 * - 最後同步時間戳
 * - 書庫版本號（用於判斷是否需要完整同步）
 * - 監聽 chrome.storage.onChanged 事件觸發同步通知
 * - 處理 QUOTA_BYTES_PER_ITEM 限制（8KB/key）
 *
 * 設計考量：
 * - 所有寫入操作前驗證資料大小，避免超過 Chrome 配額
 * - 事件驅動架構，透過 eventBus 通知元資料變更
 * - 依賴注入設計，方便測試和替換
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

/**
 * 同步元資料 storage key 常數
 * @readonly
 */
const STORAGE_KEYS = {
  SYNC_METADATA: 'sync_metadata',
  USER_SETTINGS: 'user_settings',
  LIBRARY_VERSION: 'library_version'
}

Object.freeze(STORAGE_KEYS)

/**
 * Chrome storage.sync 配額常數
 * @readonly
 */
const QUOTA_BYTES_PER_ITEM = 8192

/**
 * 同步元資料事件名稱
 * @readonly
 */
const SYNC_METADATA_EVENTS = {
  METADATA_UPDATED: 'SYNC.METADATA.UPDATED'
}

Object.freeze(SYNC_METADATA_EVENTS)

class SyncMetadataManager {
  /**
   * @param {Object} options - 建構選項
   * @param {Object} options.logger - Logger 實例（預設 console）
   * @param {Object|null} options.eventBus - 事件匯流排（可選）
   * @param {Object} options.chromeStorage - chrome.storage API（用於依賴注入/測試）
   */
  constructor (options = {}) {
    // Logger 後備方案: Background Service 初始化保護
    // 設計理念: 元資料同步管理器作為 storage.sync 協調中心
    // 執行環境: Service Worker 初始化階段，依賴注入可能不完整
    // 後備機制: console 確保同步事件和配額警告能被追蹤
    this.logger = options.logger || console
    this.eventBus = options.eventBus || null
    this.chromeStorage = Object.prototype.hasOwnProperty.call(options, 'chromeStorage')
      ? options.chromeStorage
      : (typeof chrome !== 'undefined' && chrome.storage ? chrome.storage : null)

    this.STORAGE_KEYS = STORAGE_KEYS
    this.QUOTA_LIMIT = QUOTA_BYTES_PER_ITEM

    this.state = {
      initialized: false,
      lastSyncTime: null,
      listenerRegistered: false
    }

    this._boundHandleStorageChanged = this._handleStorageChanged.bind(this)
  }

  /**
   * 初始化管理器：載入既有元資料，註冊 onChanged 監聽
   *
   * 需求：兩個 Chrome 實例間設定自動同步
   * 透過 chrome.storage.onChanged 監聽實現跨實例通知
   */
  async initialize () {
    if (this.state.initialized) {
      return
    }

    try {
      this.logger.log('初始化 SyncMetadataManager')

      if (this.chromeStorage && this.chromeStorage.onChanged) {
        this.chromeStorage.onChanged.addListener(this._boundHandleStorageChanged)
        this.state.listenerRegistered = true
      }

      this.state.initialized = true
      this.logger.log('SyncMetadataManager 初始化完成')
    } catch (error) {
      this.logger.error('SyncMetadataManager 初始化失敗:', error)
      const initError = new Error(`SyncMetadataManager 初始化失敗: ${error.message}`)
      initError.code = ErrorCodes.INITIALIZATION_ERROR
      initError.details = { category: 'sync-metadata', timestamp: Date.now() }
      throw initError
    }
  }

  /**
   * 儲存元資料到 storage.sync（含大小檢查）
   *
   * 需求：處理 QUOTA_BYTES_PER_ITEM 限制（8KB/key）
   * 寫入前先驗證序列化後大小不超過配額
   *
   * @param {Object} metadata - 要儲存的元資料物件
   */
  async saveMetadata (metadata) {
    this._validateSize(this.STORAGE_KEYS.SYNC_METADATA, metadata)

    try {
      await this._storageSet({
        [this.STORAGE_KEYS.SYNC_METADATA]: metadata
      })
      this.state.lastSyncTime = Date.now()
    } catch (error) {
      this.logger.error('儲存同步元資料失敗:', error)
      const storageError = new Error(`儲存同步元資料失敗: ${error.message}`)
      storageError.code = ErrorCodes.OPERATION_ERROR
      storageError.details = { category: 'sync-metadata', key: this.STORAGE_KEYS.SYNC_METADATA, timestamp: Date.now() }
      throw storageError
    }
  }

  /**
   * 從 storage.sync 讀取元資料
   *
   * @returns {Object|null} 元資料物件，若不存在回傳 null
   */
  async loadMetadata () {
    try {
      const result = await this._storageGet(this.STORAGE_KEYS.SYNC_METADATA)
      return result[this.STORAGE_KEYS.SYNC_METADATA] || null
    } catch (error) {
      this.logger.error('讀取同步元資料失敗:', error)
      const storageError = new Error(`讀取同步元資料失敗: ${error.message}`)
      storageError.code = ErrorCodes.OPERATION_ERROR
      storageError.details = { category: 'sync-metadata', key: this.STORAGE_KEYS.SYNC_METADATA, timestamp: Date.now() }
      throw storageError
    }
  }

  /**
   * 儲存使用者設定到 storage.sync
   *
   * 需求：使用者設定（顯示偏好、排序方式等）同步
   *
   * @param {Object} settings - 使用者設定物件
   */
  async saveUserSettings (settings) {
    this._validateSize(this.STORAGE_KEYS.USER_SETTINGS, settings)

    try {
      await this._storageSet({
        [this.STORAGE_KEYS.USER_SETTINGS]: settings
      })
    } catch (error) {
      this.logger.error('儲存使用者設定失敗:', error)
      const storageError = new Error(`儲存使用者設定失敗: ${error.message}`)
      storageError.code = ErrorCodes.OPERATION_ERROR
      storageError.details = { category: 'sync-metadata', key: this.STORAGE_KEYS.USER_SETTINGS, timestamp: Date.now() }
      throw storageError
    }
  }

  /**
   * 從 storage.sync 讀取使用者設定
   *
   * @returns {Object|null} 使用者設定物件，若不存在回傳 null
   */
  async loadUserSettings () {
    try {
      const result = await this._storageGet(this.STORAGE_KEYS.USER_SETTINGS)
      return result[this.STORAGE_KEYS.USER_SETTINGS] || null
    } catch (error) {
      this.logger.error('讀取使用者設定失敗:', error)
      const storageError = new Error(`讀取使用者設定失敗: ${error.message}`)
      storageError.code = ErrorCodes.OPERATION_ERROR
      storageError.details = { category: 'sync-metadata', key: this.STORAGE_KEYS.USER_SETTINGS, timestamp: Date.now() }
      throw storageError
    }
  }

  /**
   * 更新書庫版本號
   *
   * 需求：書庫版本號用於判斷是否需要完整同步
   *
   * @param {string} version - 書庫版本號
   */
  async updateLibraryVersion (version) {
    const versionData = {
      version,
      updatedAt: Date.now()
    }

    this._validateSize(this.STORAGE_KEYS.LIBRARY_VERSION, versionData)

    try {
      await this._storageSet({
        [this.STORAGE_KEYS.LIBRARY_VERSION]: versionData
      })
    } catch (error) {
      this.logger.error('更新書庫版本號失敗:', error)
      const storageError = new Error(`更新書庫版本號失敗: ${error.message}`)
      storageError.code = ErrorCodes.OPERATION_ERROR
      storageError.details = { category: 'sync-metadata', key: this.STORAGE_KEYS.LIBRARY_VERSION, timestamp: Date.now() }
      throw storageError
    }
  }

  /**
   * 取得書庫版本號
   *
   * @returns {Object|null} 版本資訊物件 { version, updatedAt }，若不存在回傳 null
   */
  async getLibraryVersion () {
    try {
      const result = await this._storageGet(this.STORAGE_KEYS.LIBRARY_VERSION)
      return result[this.STORAGE_KEYS.LIBRARY_VERSION] || null
    } catch (error) {
      this.logger.error('讀取書庫版本號失敗:', error)
      const storageError = new Error(`讀取書庫版本號失敗: ${error.message}`)
      storageError.code = ErrorCodes.OPERATION_ERROR
      storageError.details = { category: 'sync-metadata', key: this.STORAGE_KEYS.LIBRARY_VERSION, timestamp: Date.now() }
      throw storageError
    }
  }

  /**
   * 驗證資料序列化後不超過 QUOTA_BYTES_PER_ITEM (8KB)
   *
   * 需求：處理 QUOTA_BYTES_PER_ITEM 限制
   * Chrome storage.sync 每個 key 最大 8,192 bytes
   *
   * @param {string} key - storage key 名稱
   * @param {Object} data - 要驗證的資料
   * @throws {Error} 當資料超過配額限制時拋出 VALIDATION_ERROR
   */
  _validateSize (key, data) {
    const serialized = JSON.stringify(data)
    const byteSize = serialized.length

    if (byteSize > this.QUOTA_LIMIT) {
      const error = new Error(
        `資料大小 ${byteSize} bytes 超過 chrome.storage.sync 單一 key 配額限制 ${this.QUOTA_LIMIT} bytes (key: ${key})`
      )
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'sync-metadata',
        key,
        dataSize: byteSize,
        quotaLimit: this.QUOTA_LIMIT,
        timestamp: Date.now()
      }
      throw error
    }
  }

  /**
   * 處理 chrome.storage.onChanged 事件
   *
   * 需求：監聽 chrome.storage.onChanged 事件觸發同步
   * 當 areaName === 'sync' 時處理，透過 eventBus 通知變更
   *
   * @param {Object} changes - storage 變更物件
   * @param {string} areaName - 變更的 storage area 名稱
   */
  _handleStorageChanged (changes, areaName) {
    if (areaName !== 'sync') {
      return
    }

    const relevantKeys = Object.values(this.STORAGE_KEYS)
    const relevantChanges = {}
    let hasRelevantChanges = false

    for (const key of relevantKeys) {
      if (changes[key]) {
        relevantChanges[key] = {
          oldValue: changes[key].oldValue,
          newValue: changes[key].newValue
        }
        hasRelevantChanges = true
      }
    }

    if (!hasRelevantChanges) {
      return
    }

    this.logger.log('偵測到 storage.sync 變更:', Object.keys(relevantChanges))
    this.state.lastSyncTime = Date.now()

    if (this.eventBus) {
      this.eventBus.emit(SYNC_METADATA_EVENTS.METADATA_UPDATED, {
        changes: relevantChanges,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 取得管理器狀態
   *
   * @returns {Object} 管理器狀態資訊
   */
  getStatus () {
    return {
      initialized: this.state.initialized,
      listenerRegistered: this.state.listenerRegistered,
      lastSyncTime: this.state.lastSyncTime,
      quotaLimit: this.QUOTA_LIMIT,
      storageKeys: { ...this.STORAGE_KEYS }
    }
  }

  /**
   * chrome.storage.sync.set 的 Promise 封裝
   * @private
   * @param {Object} data - 要儲存的資料
   * @returns {Promise<void>}
   */
  _storageSet (data) {
    return new Promise((resolve, reject) => {
      if (!this.chromeStorage || !this.chromeStorage.sync) {
        reject(new Error('chrome.storage.sync API 不可用'))
        return
      }

      this.chromeStorage.sync.set(data, () => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * chrome.storage.sync.get 的 Promise 封裝
   * @private
   * @param {string|string[]} keys - 要讀取的 key
   * @returns {Promise<Object>}
   */
  _storageGet (keys) {
    return new Promise((resolve, reject) => {
      if (!this.chromeStorage || !this.chromeStorage.sync) {
        reject(new Error('chrome.storage.sync API 不可用'))
        return
      }

      this.chromeStorage.sync.get(keys, (result) => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve(result)
        }
      })
    })
  }
}

module.exports = {
  SyncMetadataManager,
  STORAGE_KEYS,
  QUOTA_BYTES_PER_ITEM,
  SYNC_METADATA_EVENTS
}
