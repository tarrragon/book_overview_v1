/**
 * SyncMetadataManager 測試
 *
 * 測試 chrome.storage.sync 元資料同步管理功能：
 * - 初始化與 onChanged 監聽註冊
 * - 元資料 CRUD 操作
 * - 使用者設定同步
 * - 書庫版本號管理
 * - QUOTA_BYTES_PER_ITEM 限制驗證
 * - storage.onChanged 事件處理
 * - 管理器狀態查詢
 */

const {
  SyncMetadataManager,
  STORAGE_KEYS,
  QUOTA_BYTES_PER_ITEM,
  SYNC_METADATA_EVENTS
} = require('src/background/domains/data-management/services/sync-metadata-manager.js')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

describe('SyncMetadataManager - Chrome Storage Sync 元資料同步管理', () => {
  let manager
  let mockLogger
  let mockEventBus
  let mockChromeStorage

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    }

    mockEventBus = {
      on: jest.fn(),
      emit: jest.fn(),
      off: jest.fn()
    }

    mockChromeStorage = {
      sync: {
        get: jest.fn(),
        set: jest.fn(),
        remove: jest.fn()
      },
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      }
    }

    manager = new SyncMetadataManager({
      logger: mockLogger,
      eventBus: mockEventBus,
      chromeStorage: mockChromeStorage
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('常數匯出', () => {
    test('STORAGE_KEYS 應包含所有必要的 key', () => {
      expect(STORAGE_KEYS.SYNC_METADATA).toBe('sync_metadata')
      expect(STORAGE_KEYS.USER_SETTINGS).toBe('user_settings')
      expect(STORAGE_KEYS.LIBRARY_VERSION).toBe('library_version')
    })

    test('QUOTA_BYTES_PER_ITEM 應為 8192', () => {
      expect(QUOTA_BYTES_PER_ITEM).toBe(8192)
    })

    test('SYNC_METADATA_EVENTS 應包含 METADATA_UPDATED', () => {
      expect(SYNC_METADATA_EVENTS.METADATA_UPDATED).toBe('SYNC.METADATA.UPDATED')
    })
  })

  describe('建構與初始化', () => {
    test('應正確建構管理器實例', () => {
      expect(manager).toBeInstanceOf(SyncMetadataManager)
      expect(manager.logger).toBe(mockLogger)
      expect(manager.eventBus).toBe(mockEventBus)
      expect(manager.QUOTA_LIMIT).toBe(8192)
    })

    test('無選項時應使用預設值', () => {
      const defaultManager = new SyncMetadataManager()
      expect(defaultManager.logger).toBe(console)
      expect(defaultManager.eventBus).toBeNull()
    })

    test('initialize 應註冊 onChanged 監聽器', async () => {
      await manager.initialize()

      expect(mockChromeStorage.onChanged.addListener).toHaveBeenCalledTimes(1)
      expect(mockChromeStorage.onChanged.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      )
      expect(manager.state.initialized).toBe(true)
      expect(manager.state.listenerRegistered).toBe(true)
    })

    test('重複 initialize 應為冪等操作', async () => {
      await manager.initialize()
      await manager.initialize()

      expect(mockChromeStorage.onChanged.addListener).toHaveBeenCalledTimes(1)
    })

    test('chromeStorage 不可用時 initialize 仍應成功', async () => {
      const noStorageManager = new SyncMetadataManager({
        logger: mockLogger,
        chromeStorage: null
      })

      await noStorageManager.initialize()

      expect(noStorageManager.state.initialized).toBe(true)
      expect(noStorageManager.state.listenerRegistered).toBe(false)
    })
  })

  describe('saveMetadata / loadMetadata', () => {
    test('saveMetadata 應將元資料寫入 storage.sync', async () => {
      mockChromeStorage.sync.set.mockImplementation((data, callback) => {
        callback()
      })

      const metadata = { lastSync: 1234567890, deviceId: 'test-device' }
      await manager.saveMetadata(metadata)

      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith(
        { [STORAGE_KEYS.SYNC_METADATA]: metadata },
        expect.any(Function)
      )
      expect(manager.state.lastSyncTime).not.toBeNull()
    })

    test('loadMetadata 應從 storage.sync 讀取元資料', async () => {
      const expectedMetadata = { lastSync: 1234567890, deviceId: 'test-device' }
      mockChromeStorage.sync.get.mockImplementation((keys, callback) => {
        callback({ [STORAGE_KEYS.SYNC_METADATA]: expectedMetadata })
      })

      const result = await manager.loadMetadata()

      expect(result).toEqual(expectedMetadata)
      expect(mockChromeStorage.sync.get).toHaveBeenCalledWith(
        STORAGE_KEYS.SYNC_METADATA,
        expect.any(Function)
      )
    })

    test('loadMetadata 不存在時應回傳 null', async () => {
      mockChromeStorage.sync.get.mockImplementation((keys, callback) => {
        callback({})
      })

      const result = await manager.loadMetadata()

      expect(result).toBeNull()
    })

    test('saveMetadata storage API 失敗應拋出 OPERATION_ERROR', async () => {
      mockChromeStorage.sync.set.mockImplementation((data, callback) => {
        // 模擬 chrome.runtime.lastError
        const originalChrome = global.chrome
        global.chrome = {
          runtime: { lastError: { message: 'Storage write failed' } }
        }
        callback()
        global.chrome = originalChrome
      })

      await expect(manager.saveMetadata({ test: true })).rejects.toThrow()
    })
  })

  describe('saveUserSettings / loadUserSettings', () => {
    test('saveUserSettings 應將設定寫入 storage.sync', async () => {
      mockChromeStorage.sync.set.mockImplementation((data, callback) => {
        callback()
      })

      const settings = { displayMode: 'grid', sortBy: 'title', theme: 'dark' }
      await manager.saveUserSettings(settings)

      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith(
        { [STORAGE_KEYS.USER_SETTINGS]: settings },
        expect.any(Function)
      )
    })

    test('loadUserSettings 應從 storage.sync 讀取設定', async () => {
      const expectedSettings = { displayMode: 'grid', sortBy: 'title' }
      mockChromeStorage.sync.get.mockImplementation((keys, callback) => {
        callback({ [STORAGE_KEYS.USER_SETTINGS]: expectedSettings })
      })

      const result = await manager.loadUserSettings()

      expect(result).toEqual(expectedSettings)
    })

    test('loadUserSettings 不存在時應回傳 null', async () => {
      mockChromeStorage.sync.get.mockImplementation((keys, callback) => {
        callback({})
      })

      const result = await manager.loadUserSettings()

      expect(result).toBeNull()
    })
  })

  describe('updateLibraryVersion / getLibraryVersion', () => {
    test('updateLibraryVersion 應將版本資訊寫入 storage.sync', async () => {
      mockChromeStorage.sync.set.mockImplementation((data, callback) => {
        callback()
      })

      await manager.updateLibraryVersion('1.2.3')

      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith(
        {
          [STORAGE_KEYS.LIBRARY_VERSION]: {
            version: '1.2.3',
            updatedAt: expect.any(Number)
          }
        },
        expect.any(Function)
      )
    })

    test('getLibraryVersion 應回傳版本資訊', async () => {
      const versionData = { version: '1.2.3', updatedAt: 1234567890 }
      mockChromeStorage.sync.get.mockImplementation((keys, callback) => {
        callback({ [STORAGE_KEYS.LIBRARY_VERSION]: versionData })
      })

      const result = await manager.getLibraryVersion()

      expect(result).toEqual(versionData)
    })

    test('getLibraryVersion 不存在時應回傳 null', async () => {
      mockChromeStorage.sync.get.mockImplementation((keys, callback) => {
        callback({})
      })

      const result = await manager.getLibraryVersion()

      expect(result).toBeNull()
    })
  })

  describe('_validateSize - 配額限制驗證', () => {
    test('資料在配額內不應拋錯', () => {
      const smallData = { key: 'value' }

      expect(() => manager._validateSize('test_key', smallData)).not.toThrow()
    })

    test('資料超過 8KB 配額限制應拋出 VALIDATION_ERROR', () => {
      // 產生超過 8KB 的資料
      const largeData = { content: 'x'.repeat(9000) }

      try {
        manager._validateSize('test_key', largeData)
        // 不應執行到這裡
        expect(true).toBe(false)
      } catch (error) {
        expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
        expect(error.details.key).toBe('test_key')
        expect(error.details.dataSize).toBeGreaterThan(QUOTA_BYTES_PER_ITEM)
        expect(error.details.quotaLimit).toBe(QUOTA_BYTES_PER_ITEM)
      }
    })

    test('剛好 8192 bytes 不應拋錯', () => {
      // 建構剛好在限制內的資料
      // JSON.stringify 會加上引號和括號，需要計算精確長度
      const targetSize = QUOTA_BYTES_PER_ITEM - 2 // 扣除 JSON 字串的引號
      const exactData = 'a'.repeat(targetSize)

      // 驗證大小確實在限制內
      expect(JSON.stringify(exactData).length).toBeLessThanOrEqual(QUOTA_BYTES_PER_ITEM)
      expect(() => manager._validateSize('test_key', exactData)).not.toThrow()
    })

    test('saveMetadata 超過配額時應拋出 VALIDATION_ERROR', async () => {
      const largeMetadata = { data: 'x'.repeat(9000) }

      try {
        await manager.saveMetadata(largeMetadata)
        expect(true).toBe(false)
      } catch (error) {
        expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      }

      // storage.sync.set 不應被呼叫
      expect(mockChromeStorage.sync.set).not.toHaveBeenCalled()
    })
  })

  describe('_handleStorageChanged - onChanged 事件處理', () => {
    test('sync area 的相關 key 變更應觸發 eventBus 事件', () => {
      const changes = {
        [STORAGE_KEYS.USER_SETTINGS]: {
          oldValue: { theme: 'light' },
          newValue: { theme: 'dark' }
        }
      }

      manager._handleStorageChanged(changes, 'sync')

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        SYNC_METADATA_EVENTS.METADATA_UPDATED,
        {
          changes: {
            [STORAGE_KEYS.USER_SETTINGS]: {
              oldValue: { theme: 'light' },
              newValue: { theme: 'dark' }
            }
          },
          timestamp: expect.any(Number)
        }
      )
    })

    test('非 sync area 的變更應被忽略', () => {
      const changes = {
        someKey: { oldValue: 1, newValue: 2 }
      }

      manager._handleStorageChanged(changes, 'local')

      expect(mockEventBus.emit).not.toHaveBeenCalled()
    })

    test('不相關的 key 變更應被忽略', () => {
      const changes = {
        unrelated_key: { oldValue: 'a', newValue: 'b' }
      }

      manager._handleStorageChanged(changes, 'sync')

      expect(mockEventBus.emit).not.toHaveBeenCalled()
    })

    test('無 eventBus 時不應拋錯', () => {
      const noEventBusManager = new SyncMetadataManager({
        logger: mockLogger,
        eventBus: null,
        chromeStorage: mockChromeStorage
      })

      const changes = {
        [STORAGE_KEYS.SYNC_METADATA]: {
          oldValue: null,
          newValue: { test: true }
        }
      }

      expect(() => {
        noEventBusManager._handleStorageChanged(changes, 'sync')
      }).not.toThrow()
    })

    test('多個相關 key 同時變更應全部包含在事件中', () => {
      const changes = {
        [STORAGE_KEYS.USER_SETTINGS]: {
          oldValue: null,
          newValue: { theme: 'dark' }
        },
        [STORAGE_KEYS.LIBRARY_VERSION]: {
          oldValue: { version: '1.0.0' },
          newValue: { version: '1.1.0' }
        },
        unrelated_key: {
          oldValue: 'a',
          newValue: 'b'
        }
      }

      manager._handleStorageChanged(changes, 'sync')

      const emitCall = mockEventBus.emit.mock.calls[0]
      const emittedChanges = emitCall[1].changes

      expect(Object.keys(emittedChanges)).toHaveLength(2)
      expect(emittedChanges[STORAGE_KEYS.USER_SETTINGS]).toBeDefined()
      expect(emittedChanges[STORAGE_KEYS.LIBRARY_VERSION]).toBeDefined()
      expect(emittedChanges.unrelated_key).toBeUndefined()
    })
  })

  describe('getStatus', () => {
    test('初始化前應回傳正確狀態', () => {
      const status = manager.getStatus()

      expect(status).toEqual({
        initialized: false,
        listenerRegistered: false,
        lastSyncTime: null,
        quotaLimit: 8192,
        storageKeys: STORAGE_KEYS
      })
    })

    test('初始化後應回傳更新後的狀態', async () => {
      await manager.initialize()

      const status = manager.getStatus()

      expect(status.initialized).toBe(true)
      expect(status.listenerRegistered).toBe(true)
    })
  })

  describe('storage API 不可用的錯誤處理', () => {
    test('chromeStorage 為 null 時 saveMetadata 應拋出 OPERATION_ERROR', async () => {
      const noStorageManager = new SyncMetadataManager({
        logger: mockLogger,
        chromeStorage: null
      })

      try {
        await noStorageManager.saveMetadata({ test: true })
        expect(true).toBe(false) // 不應執行到這裡
      } catch (error) {
        expect(error.code).toBe(ErrorCodes.OPERATION_ERROR)
        expect(error.message).toContain('chrome.storage.sync API 不可用')
      }
    })

    test('chromeStorage 為 null 時 loadMetadata 應拋出 OPERATION_ERROR', async () => {
      const noStorageManager = new SyncMetadataManager({
        logger: mockLogger,
        chromeStorage: null
      })

      try {
        await noStorageManager.loadMetadata()
        expect(true).toBe(false) // 不應執行到這裡
      } catch (error) {
        expect(error.code).toBe(ErrorCodes.OPERATION_ERROR)
        expect(error.message).toContain('chrome.storage.sync API 不可用')
      }
    })
  })
})
