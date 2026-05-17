/**
 * Chrome Extension 安裝處理器
 *
 * 負責功能：
 * - 處理擴展的安裝、更新、啟用事件
 * - 初始化預設配置和儲存設定
 * - 觸發安裝相關的系統事件
 * - 管理版本遷移和相容性處理
 *
 * 設計考量：
 * - 基於 BaseModule 實現標準生命週期管理
 * - 支援不同安裝原因的差異化處理
 * - 實現版本遷移和資料備份機制
 * - 提供完整的錯誤處理和回滾能力
 */

const BaseModule = require('./base-module')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')
const MigrationService = require('src/background/domains/data-management/services/migration-service')

class InstallHandler extends BaseModule {
  constructor (dependencies = {}) {
    super(dependencies)

    // 安裝處理相關服務
    this.storageService = dependencies.storageService || null
    this.configService = dependencies.configService || null
    // MigrationService DI wire-up（W6-012.2.2.1）：
    // 若未注入則自動建立預設實例（綁定 chrome.storage.local），保證
    // onUpdated 路由必能執行 schema migration；測試環境可顯式注入 mock。
    this.migrationService = dependencies.migrationService ||
      this._createDefaultMigrationService()

    // 安裝狀態追蹤
    this.installationInProgress = false
    this.lastInstallDetails = null
    this.installationStartTime = null

    // 預設配置
    this.defaultConfig = {
      isEnabled: true,
      extractionSettings: {
        autoExtract: false,
        progressTracking: true,
        dataValidation: true
      },
      version: null // 將在運行時設定
    }
  }

  /**
   * 初始化安裝處理器
   * @returns {Promise<void>}
   * @protected
   */
  async _doInitialize () {
    this.logger.log('📦 初始化安裝處理器')

    // 設定當前版本
    const manifest = chrome.runtime.getManifest()
    if (!manifest) {
      const error = new Error('無法取得 Chrome Extension Manifest')
      error.code = ErrorCodes.CHROME_ERROR
      error.details = {
        category: 'general',
        component: 'InstallHandler',
        operation: 'getManifest'
      }
      throw error
    }
    this.defaultConfig.version = manifest.version

    // 初始化相關服務
    if (this.storageService && typeof this.storageService.initialize === 'function') {
      await this.storageService.initialize()
    }

    if (this.configService && typeof this.configService.initialize === 'function') {
      await this.configService.initialize()
    }

    if (this.migrationService && typeof this.migrationService.initialize === 'function') {
      await this.migrationService.initialize()
    }

    this.logger.log('✅ 安裝處理器初始化完成')
  }

  /**
   * 處理 Chrome Extension 安裝事件
   * @param {Object} details - Chrome Extension 安裝詳情
   * @param {string} details.reason - 安裝原因 ('install', 'update', 'chrome_update', 'shared_module_update')
   * @param {string} details.previousVersion - 前一版本號（僅在更新時提供）
   * @returns {Promise<void>}
   */
  async handleInstall (details) {
    if (this.installationInProgress) {
      this.logger.warn('⚠️ 安裝處理已在進行中，跳過重複處理')
      return
    }

    try {
      this.installationInProgress = true
      this.installationStartTime = Date.now()
      this.lastInstallDetails = details

      this.logger.log(`📦 開始處理安裝事件: ${details.reason}`)

      // 根據安裝原因執行不同處理
      switch (details.reason) {
        case 'install':
          await this.handleNewInstall(details)
          break

        case 'update':
          await this.handleUpdate(details)
          break

        case 'chrome_update':
          await this.handleChromeUpdate(details)
          break

        case 'shared_module_update':
          await this.handleSharedModuleUpdate(details)
          break

        default:
          this.logger.warn(`⚠️ 未知的安裝原因: ${details.reason}`)
          await this.handleUnknownInstall(details)
      }

      // 觸發安裝完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.INSTALLED', {
          reason: details.reason,
          previousVersion: details.previousVersion,
          version: chrome.runtime.getManifest().version,
          duration: Date.now() - this.installationStartTime,
          timestamp: Date.now()
        })
      }

      this.logger.log(`✅ 安裝事件處理完成: ${details.reason}`)
    } catch (error) {
      this.logger.error('❌ 安裝事件處理失敗:', error)

      // 觸發安裝失敗事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.INSTALL.FAILED', {
          reason: details.reason,
          error: error.message,
          timestamp: Date.now()
        })
      }

      throw error
    } finally {
      this.installationInProgress = false
      this.installationStartTime = null
    }
  }

  /**
   * 處理全新安裝
   * @param {Object} details - 安裝詳情
   * @returns {Promise<void>}
   * @private
   */
  async handleNewInstall (details) {
    this.logger.log('🆕 處理全新安裝')

    // 設定預設配置
    await this.setupDefaultConfiguration()

    // 初始化儲存系統
    await this.initializeStorage()

    // 觸發首次安裝事件
    if (this.eventBus) {
      await this.eventBus.emit('SYSTEM.FIRST.INSTALL', {
        version: chrome.runtime.getManifest().version,
        timestamp: Date.now()
      })
    }

    this.logger.log('✅ 全新安裝處理完成')
  }

  /**
   * 處理擴展更新
   * @param {Object} details - 安裝詳情
   * @returns {Promise<void>}
   * @private
   */
  async handleUpdate (details) {
    this.logger.log(`🔄 處理擴展更新: ${details.previousVersion} → ${chrome.runtime.getManifest().version}`)

    // 執行版本遷移
    if (this.migrationService) {
      await this.migrationService.migrate(details.previousVersion, chrome.runtime.getManifest().version)
    }

    // 更新配置版本號
    await this.updateConfigurationVersion()

    // 觸發更新事件
    if (this.eventBus) {
      await this.eventBus.emit('SYSTEM.UPDATED', {
        previousVersion: details.previousVersion,
        currentVersion: chrome.runtime.getManifest().version,
        timestamp: Date.now()
      })
    }

    this.logger.log('✅ 擴展更新處理完成')
  }

  /**
   * 處理 Chrome 瀏覽器更新
   * @param {Object} details - 安裝詳情
   * @returns {Promise<void>}
   * @private
   */
  async handleChromeUpdate (details) {
    this.logger.log('🌐 處理 Chrome 瀏覽器更新')

    // 檢查相容性
    await this.checkCompatibility()

    // 觸發 Chrome 更新事件
    if (this.eventBus) {
      await this.eventBus.emit('SYSTEM.CHROME.UPDATED', {
        timestamp: Date.now()
      })
    }

    this.logger.log('✅ Chrome 瀏覽器更新處理完成')
  }

  /**
   * 處理共享模組更新
   * @param {Object} details - 安裝詳情
   * @returns {Promise<void>}
   * @private
   */
  async handleSharedModuleUpdate (details) {
    this.logger.log('🔗 處理共享模組更新')

    // 重新初始化相關服務
    await this.reinitializeServices()

    // 觸發共享模組更新事件
    if (this.eventBus) {
      await this.eventBus.emit('SYSTEM.SHARED.MODULE.UPDATED', {
        timestamp: Date.now()
      })
    }

    this.logger.log('✅ 共享模組更新處理完成')
  }

  /**
   * 處理未知安裝原因
   * @param {Object} details - 安裝詳情
   * @returns {Promise<void>}
   * @private
   */
  async handleUnknownInstall (details) {
    this.logger.log(`❓ 處理未知安裝原因: ${details.reason}`)

    // 執行基本初始化
    await this.setupDefaultConfiguration()

    // 觸發未知安裝事件
    if (this.eventBus) {
      await this.eventBus.emit('SYSTEM.UNKNOWN.INSTALL', {
        reason: details.reason,
        timestamp: Date.now()
      })
    }

    this.logger.log('✅ 未知安裝原因處理完成')
  }

  /**
   * 設定預設配置
   * @returns {Promise<void>}
   * @private
   */
  async setupDefaultConfiguration () {
    try {
      this.logger.log('⚙️ 設定預設配置')

      // 使用 Chrome Storage API 直接設定
      await chrome.storage.local.set(this.defaultConfig)

      // 驗證配置是否正確設定
      const savedConfig = await chrome.storage.local.get(Object.keys(this.defaultConfig))
      this.logger.log('✅ 預設配置設定完成:', savedConfig)
    } catch (error) {
      this.logger.error('❌ 設定預設配置失敗:', error)
      throw error
    }
  }

  /**
   * 初始化儲存系統
   * @returns {Promise<void>}
   * @private
   */
  async initializeStorage () {
    try {
      this.logger.log('💾 初始化儲存系統')

      // 如果有儲存服務，使用它初始化
      if (this.storageService && typeof this.storageService.initialize === 'function') {
        await this.storageService.initialize()
      }

      // 設定基本儲存結構
      const storageInit = {
        readmoo_books: null,
        extraction_history: [],
        last_extraction: null
      }

      // 檢查並設定缺失的儲存項目
      const existing = await chrome.storage.local.get(Object.keys(storageInit))
      const toSet = {}

      for (const [key, defaultValue] of Object.entries(storageInit)) {
        if (!(key in existing)) {
          toSet[key] = defaultValue
        }
      }

      if (Object.keys(toSet).length > 0) {
        await chrome.storage.local.set(toSet)
        this.logger.log('✅ 儲存系統初始化完成:', toSet)
      } else {
        this.logger.log('✅ 儲存系統已存在，跳過初始化')
      }
    } catch (error) {
      this.logger.error('❌ 初始化儲存系統失敗:', error)
      throw error
    }
  }

  /**
   * 更新配置版本號
   * @returns {Promise<void>}
   * @private
   */
  async updateConfigurationVersion () {
    try {
      this.logger.log('🔄 更新配置版本號')

      await chrome.storage.local.set({
        version: chrome.runtime.getManifest().version
      })

      this.logger.log('✅ 配置版本號更新完成')
    } catch (error) {
      this.logger.error('❌ 更新配置版本號失敗:', error)
      throw error
    }
  }

  /**
   * 檢查相容性
   * @returns {Promise<void>}
   * @private
   */
  async checkCompatibility () {
    try {
      this.logger.log('🔍 檢查相容性')

      // 檢查 Manifest V3 支援
      const manifest = chrome.runtime.getManifest()
      if (manifest.manifest_version !== 3) {
        this.logger.warn('⚠️ 非 Manifest V3 環境')
      }

      // 檢查必要的 API
      const requiredAPIs = ['storage', 'tabs', 'runtime']
      const missingAPIs = requiredAPIs.filter(api => !chrome[api])

      if (missingAPIs.length > 0) {
        const error = new Error(`缺少必要的 Chrome API: ${missingAPIs.join(', ')}`)
        error.code = ErrorCodes.CHROME_ERROR
        error.details = {
          category: 'general',
          component: 'InstallHandler',
          missingAPIs
        }
        throw error
      }

      this.logger.log('✅ 相容性檢查通過')
    } catch (error) {
      this.logger.error('❌ 相容性檢查失敗:', error)
      throw error
    }
  }

  /**
   * 重新初始化服務
   * @returns {Promise<void>}
   * @private
   */
  async reinitializeServices () {
    try {
      this.logger.log('🔄 重新初始化服務')

      // 重新初始化相關服務
      const services = [this.storageService, this.configService, this.migrationService]

      for (const service of services) {
        if (service && typeof service.reinitialize === 'function') {
          await service.reinitialize()
        } else if (service && typeof service.initialize === 'function') {
          await service.initialize()
        }
      }

      this.logger.log('✅ 服務重新初始化完成')
    } catch (error) {
      this.logger.error('❌ 服務重新初始化失敗:', error)
      throw error
    }
  }

  /**
   * 取得安裝狀態資訊
   * @returns {Object} 安裝狀態報告
   */
  getInstallStatus () {
    return {
      installationInProgress: this.installationInProgress,
      lastInstallDetails: this.lastInstallDetails,
      installationStartTime: this.installationStartTime,
      defaultConfig: { ...this.defaultConfig },
      timestamp: Date.now()
    }
  }

  /**
   * 建立預設 MigrationService 實例
   *
   * 觸發時機：dependencies.migrationService 未提供時。
   * 設計理由：v0.18.0 起 schema migration 屬 install-handler 的核心職責，
   *   不再容許「未注入即靜默跳過」的歷史行為（W6-012.2.2.2 cover-to-reader
   *   遷移將強依賴此 service）。
   * 風險容忍：若 chrome.storage.local 不可用（如測試環境未 mock chrome），
   *   constructor 階段不丟錯（保留 null），由 _doInitialize 階段以 logger
   *   降級提示，避免阻斷整個 background 啟動。
   *
   * @returns {MigrationService|null}
   * @private
   */
  _createDefaultMigrationService () {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return null
      }
      return new MigrationService({
        storage: chrome.storage.local,
        logger: this.logger
      })
    } catch (creationError) {
      // 建立失敗不阻斷 background 啟動；後續 onUpdated 走無 migration 路徑
      this.logger.warn && this.logger.warn(
        `⚠️ 預設 MigrationService 建立失敗，將略過 schema migration: ${creationError.message}`
      )
      return null
    }
  }

  /**
   * 取得自訂健康狀態
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus () {
    return {
      installationInProgress: this.installationInProgress,
      hasLastInstallDetails: !!this.lastInstallDetails,
      servicesAvailable: !!(this.storageService || this.configService || this.migrationService),
      health: this.installationInProgress ? 'degraded' : 'healthy'
    }
  }
}

module.exports = InstallHandler
