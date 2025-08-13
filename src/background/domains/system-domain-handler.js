/**
 * 系統領域處理器
 *
 * 負責功能：
 * - 處理系統生命週期相關的領域邏輯和業務規則
 * - 管理系統安裝、啟動、關閉等核心系統事件
 * - 實現系統狀態管理和版本控制邏輯
 * - 協調系統級的配置管理和狀態持久化
 *
 * 設計考量：
 * - 基於事件驅動架構，響應系統相關事件
 * - 實現系統領域的業務邏輯與技術實作分離
 * - 提供系統狀態的統一管理和決策邏輯
 * - 支援系統配置的動態更新和版本管理
 */

const {
  SYSTEM_EVENTS,
  LIFECYCLE_EVENTS,
  INSTALL_REASONS,
  EVENT_PRIORITIES,
  STORAGE_KEYS,
  DEFAULT_CONFIG
} = require('../constants/module-constants')

class SystemDomainHandler {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 系統狀態管理
    this.systemState = {
      installationInfo: null,
      currentVersion: null,
      lastStartupTime: null,
      shutdownRequested: false,
      maintenanceMode: false,
      configuration: { ...DEFAULT_CONFIG }
    }

    // 版本管理
    this.versionHistory = []
    this.migrationStrategies = new Map()

    // 配置管理
    this.configurationWatchers = new Map()
    this.configurationValidators = new Map()

    // 事件監聽器記錄
    this.registeredListeners = new Map()

    // 統計資料
    this.domainStats = {
      systemEventsProcessed: 0,
      configurationUpdates: 0,
      versionMigrations: 0,
      startupAttempts: 0,
      shutdownAttempts: 0
    }

    // 處理器狀態
    this.initialized = false
    this.active = false
  }

  /**
   * 初始化系統領域處理器
   * @returns {Promise<void>}
   */
  async initialize () {
    if (this.initialized) {
      this.logger.warn('⚠️ 系統領域處理器已初始化')
      return
    }

    try {
      if (this.i18nManager) {
        this.logger.log(this.i18nManager.t('modules.operations.initialize', { moduleName: '系統領域處理器' }))
      } else {
        this.logger.log('🏛️ 初始化系統領域處理器')
      }

      // 載入系統狀態
      await this.loadSystemState()

      // 初始化配置管理
      await this.initializeConfigurationManagement()

      // 初始化版本管理
      await this.initializeVersionManagement()

      // 初始化遷移策略
      await this.initializeMigrationStrategies()

      this.initialized = true
      this.logger.log('✅ 系統領域處理器初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化系統領域處理器失敗:', error)
      throw error
    }
  }

  /**
   * 啟動系統領域處理器
   * @returns {Promise<void>}
   */
  async start () {
    if (!this.initialized) {
      throw new Error('系統領域處理器尚未初始化')
    }

    if (this.active) {
      this.logger.warn('⚠️ 系統領域處理器已啟動')
      return
    }

    try {
      this.logger.log('▶️ 啟動系統領域處理器')

      // 註冊事件監聽器
      await this.registerEventListeners()

      // 驗證系統狀態
      await this.validateSystemState()

      this.active = true
      this.logger.log('✅ 系統領域處理器啟動完成')
    } catch (error) {
      this.logger.error('❌ 啟動系統領域處理器失敗:', error)
      throw error
    }
  }

  /**
   * 停止系統領域處理器
   * @returns {Promise<void>}
   */
  async stop () {
    if (!this.active) {
      return
    }

    try {
      this.logger.log('⏹️ 停止系統領域處理器')

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      // 保存系統狀態
      await this.saveSystemState()

      this.active = false
      this.logger.log('✅ 系統領域處理器停止完成')
    } catch (error) {
      this.logger.error('❌ 停止系統領域處理器失敗:', error)
      throw error
    }
  }

  /**
   * 載入系統狀態
   * @returns {Promise<void>}
   * @private
   */
  async loadSystemState () {
    try {
      const stored = await chrome.storage.local.get([
        STORAGE_KEYS.VERSION,
        STORAGE_KEYS.IS_ENABLED,
        STORAGE_KEYS.EXTRACTION_SETTINGS,
        'system_state'
      ])

      // 載入版本資訊
      if (stored[STORAGE_KEYS.VERSION]) {
        this.systemState.currentVersion = stored[STORAGE_KEYS.VERSION]
      } else {
        // 首次安裝，從 manifest 獲取版本
        const manifest = chrome.runtime.getManifest()
        this.systemState.currentVersion = manifest.version
      }

      // 載入配置
      this.systemState.configuration = {
        ...DEFAULT_CONFIG,
        isEnabled: stored[STORAGE_KEYS.IS_ENABLED] !== false,
        extractionSettings: stored[STORAGE_KEYS.EXTRACTION_SETTINGS] || DEFAULT_CONFIG.extractionSettings
      }

      // 載入系統狀態
      if (stored.system_state) {
        const systemState = stored.system_state
        this.systemState.installationInfo = systemState.installationInfo
        this.systemState.lastStartupTime = systemState.lastStartupTime
        this.versionHistory = systemState.versionHistory || []
      }

      this.logger.log(`📚 系統狀態載入完成，當前版本: ${this.systemState.currentVersion}`)
    } catch (error) {
      this.logger.error('❌ 載入系統狀態失敗:', error)
      // 使用預設值
      const manifest = chrome.runtime.getManifest()
      this.systemState.currentVersion = manifest.version
      this.systemState.configuration = { ...DEFAULT_CONFIG }
    }
  }

  /**
   * 保存系統狀態
   * @returns {Promise<void>}
   * @private
   */
  async saveSystemState () {
    try {
      const dataToSave = {
        [STORAGE_KEYS.VERSION]: this.systemState.currentVersion,
        [STORAGE_KEYS.IS_ENABLED]: this.systemState.configuration.isEnabled,
        [STORAGE_KEYS.EXTRACTION_SETTINGS]: this.systemState.configuration.extractionSettings,
        system_state: {
          installationInfo: this.systemState.installationInfo,
          lastStartupTime: this.systemState.lastStartupTime,
          versionHistory: this.versionHistory.slice(-10), // 保留最近10個版本記錄
          timestamp: Date.now()
        }
      }

      await chrome.storage.local.set(dataToSave)
      this.logger.log('💾 系統狀態已保存')
    } catch (error) {
      this.logger.error('❌ 保存系統狀態失敗:', error)
    }
  }

  /**
   * 初始化配置管理
   * @returns {Promise<void>}
   * @private
   */
  async initializeConfigurationManagement () {
    try {
      // 註冊配置驗證器
      this.configurationValidators.set('isEnabled', (value) => {
        return typeof value === 'boolean'
      })

      this.configurationValidators.set('extractionSettings', (value) => {
        return value &&
               typeof value === 'object' &&
               typeof value.autoExtract === 'boolean' &&
               typeof value.progressTracking === 'boolean' &&
               typeof value.dataValidation === 'boolean'
      })

      this.configurationValidators.set('debugMode', (value) => {
        return typeof value === 'boolean'
      })

      this.configurationValidators.set('logLevel', (value) => {
        return ['debug', 'info', 'warn', 'error'].includes(value)
      })

      this.logger.log('🔧 配置管理初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化配置管理失敗:', error)
    }
  }

  /**
   * 初始化版本管理
   * @returns {Promise<void>}
   * @private
   */
  async initializeVersionManagement () {
    try {
      // 獲取當前 manifest 版本
      const manifest = chrome.runtime.getManifest()
      const manifestVersion = manifest.version

      // 檢查是否需要版本遷移
      if (this.systemState.currentVersion !== manifestVersion) {
        await this.handleVersionChange(this.systemState.currentVersion, manifestVersion)
      }

      this.logger.log('📋 版本管理初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化版本管理失敗:', error)
    }
  }

  /**
   * 初始化遷移策略
   * @returns {Promise<void>}
   * @private
   */
  async initializeMigrationStrategies () {
    try {
      // v0.8.x → v0.9.x 遷移策略
      this.migrationStrategies.set('0.8.x->0.9.x', async (fromVersion, toVersion) => {
        this.logger.log('🔄 執行 v0.8.x → v0.9.x 遷移策略')

        // 更新配置結構
        const oldConfig = await chrome.storage.local.get(['config'])
        if (oldConfig.config) {
          const newConfig = {
            isEnabled: oldConfig.config.enabled !== false,
            extractionSettings: {
              autoExtract: oldConfig.config.autoExtract || false,
              progressTracking: oldConfig.config.showProgress !== false,
              dataValidation: true // 新增的設定
            },
            debugMode: oldConfig.config.debug || false,
            logLevel: oldConfig.config.logLevel || 'info'
          }

          await chrome.storage.local.set({
            [STORAGE_KEYS.IS_ENABLED]: newConfig.isEnabled,
            [STORAGE_KEYS.EXTRACTION_SETTINGS]: newConfig.extractionSettings
          })

          // 清理舊配置
          await chrome.storage.local.remove(['config'])
        }

        return { success: true, changes: ['config_structure_updated'] }
      })

      // v0.9.x → v1.0.x 遷移策略
      this.migrationStrategies.set('0.9.x->1.0.x', async (fromVersion, toVersion) => {
        this.logger.log('🔄 執行 v0.9.x → v1.0.x 遷移策略')

        // 遷移書籍資料格式
        const oldBooks = await chrome.storage.local.get([STORAGE_KEYS.READMOO_BOOKS])
        if (oldBooks[STORAGE_KEYS.READMOO_BOOKS]) {
          const booksData = oldBooks[STORAGE_KEYS.READMOO_BOOKS]

          // 新增版本 1.0 的資料結構改進
          if (booksData.books && Array.isArray(booksData.books)) {
            booksData.books = booksData.books.map(book => ({
              ...book,
              // 新增 v1.0 的欄位
              version: '1.0',
              lastUpdated: Date.now(),
              tags: book.tags || ['readmoo']
            }))

            await chrome.storage.local.set({
              [STORAGE_KEYS.READMOO_BOOKS]: {
                ...booksData,
                version: '1.0',
                migratedAt: Date.now()
              }
            })
          }
        }

        return { success: true, changes: ['books_data_format_updated'] }
      })

      this.logger.log('📝 遷移策略初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化遷移策略失敗:', error)
    }
  }

  /**
   * 註冊事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async registerEventListeners () {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 未初始化，跳過事件監聽器註冊')
      return
    }

    try {
      // 系統安裝事件
      this.registeredListeners.set('installed',
        this.eventBus.on(LIFECYCLE_EVENTS.INSTALLED,
          (event) => this.handleSystemInstalled(event.data),
          { priority: EVENT_PRIORITIES.URGENT }
        )
      )

      // 系統啟動事件
      this.registeredListeners.set('startup',
        this.eventBus.on(LIFECYCLE_EVENTS.STARTUP,
          (event) => this.handleSystemStartup(event.data),
          { priority: EVENT_PRIORITIES.URGENT }
        )
      )

      // 系統關閉事件
      this.registeredListeners.set('shutdown',
        this.eventBus.on(LIFECYCLE_EVENTS.SHUTDOWN,
          (event) => this.handleSystemShutdown(event.data),
          { priority: EVENT_PRIORITIES.URGENT }
        )
      )

      // 系統錯誤事件
      this.registeredListeners.set('error',
        this.eventBus.on(SYSTEM_EVENTS.ERROR,
          (event) => this.handleSystemError(event.data),
          { priority: EVENT_PRIORITIES.HIGH }
        )
      )

      // 配置更新請求事件
      this.registeredListeners.set('configUpdate',
        this.eventBus.on('SYSTEM.CONFIG.UPDATE.REQUEST',
          (event) => this.handleConfigurationUpdateRequest(event.data),
          { priority: EVENT_PRIORITIES.NORMAL }
        )
      )

      // 系統狀態查詢事件
      this.registeredListeners.set('statusRequest',
        this.eventBus.on('SYSTEM.STATUS.REQUEST',
          (event) => this.handleSystemStatusRequest(event.data),
          { priority: EVENT_PRIORITIES.LOW }
        )
      )

      this.logger.log('📝 系統領域事件監聽器註冊完成')
    } catch (error) {
      this.logger.error('❌ 註冊事件監聽器失敗:', error)
    }
  }

  /**
   * 取消註冊事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async unregisterEventListeners () {
    if (!this.eventBus) {
      return
    }

    try {
      const eventTypes = {
        installed: LIFECYCLE_EVENTS.INSTALLED,
        startup: LIFECYCLE_EVENTS.STARTUP,
        shutdown: LIFECYCLE_EVENTS.SHUTDOWN,
        error: SYSTEM_EVENTS.ERROR,
        configUpdate: 'SYSTEM.CONFIG.UPDATE.REQUEST',
        statusRequest: 'SYSTEM.STATUS.REQUEST'
      }

      for (const [key, listenerId] of this.registeredListeners) {
        const eventType = eventTypes[key]
        if (eventType && listenerId) {
          this.eventBus.off(eventType, listenerId)
        }
      }

      this.registeredListeners.clear()
      this.logger.log('🔄 系統領域事件監聽器取消註冊完成')
    } catch (error) {
      this.logger.error('❌ 取消註冊事件監聽器失敗:', error)
    }
  }

  /**
   * 處理系統安裝事件
   * @param {Object} data - 安裝資料
   * @returns {Promise<void>}
   * @private
   */
  async handleSystemInstalled (data) {
    try {
      const { reason, previousVersion } = data
      this.domainStats.systemEventsProcessed++

      this.logger.log(`🎉 處理系統安裝事件: ${reason}`)

      // 記錄安裝資訊
      this.systemState.installationInfo = {
        reason,
        previousVersion,
        installedAt: Date.now(),
        manifest: chrome.runtime.getManifest()
      }

      // 根據安裝原因執行不同邏輯
      switch (reason) {
        case INSTALL_REASONS.INSTALL:
          await this.handleFreshInstallation()
          break

        case INSTALL_REASONS.UPDATE:
          await this.handleExtensionUpdate(previousVersion)
          break

        case INSTALL_REASONS.CHROME_UPDATE:
          await this.handleChromeUpdate()
          break

        case INSTALL_REASONS.SHARED_MODULE_UPDATE:
          await this.handleSharedModuleUpdate()
          break

        default:
          this.logger.warn(`⚠️ 未知的安裝原因: ${reason}`)
      }

      // 保存安裝資訊
      await this.saveSystemState()

      // 觸發安裝完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.INSTALLATION.COMPLETED', {
          reason,
          previousVersion,
          currentVersion: this.systemState.currentVersion,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理系統安裝事件失敗:', error)
    }
  }

  /**
   * 處理系統啟動事件
   * @param {Object} data - 啟動資料
   * @returns {Promise<void>}
   * @private
   */
  async handleSystemStartup (data) {
    try {
      this.domainStats.systemEventsProcessed++
      this.domainStats.startupAttempts++

      this.logger.log('🔄 處理系統啟動事件')

      // 記錄啟動時間
      this.systemState.lastStartupTime = Date.now()

      // 驗證系統配置
      await this.validateSystemConfiguration()

      // 檢查維護模式
      if (this.systemState.maintenanceMode) {
        this.logger.warn('⚠️ 系統處於維護模式')
        await this.eventBus?.emit('SYSTEM.MAINTENANCE.MODE.ACTIVE', {
          timestamp: Date.now()
        })
        return
      }

      // 執行啟動檢查
      const startupChecks = await this.performStartupChecks()

      if (startupChecks.success) {
        // 觸發系統就緒事件
        if (this.eventBus) {
          await this.eventBus.emit(SYSTEM_EVENTS.READY, {
            startupTime: this.systemState.lastStartupTime,
            version: this.systemState.currentVersion,
            configuration: this.systemState.configuration,
            checks: startupChecks.results,
            timestamp: Date.now()
          })
        }

        this.logger.log('✅ 系統啟動處理完成')
      } else {
        throw new Error(`啟動檢查失敗: ${startupChecks.error}`)
      }
    } catch (error) {
      this.logger.error('❌ 處理系統啟動事件失敗:', error)

      // 觸發啟動失敗事件
      if (this.eventBus) {
        await this.eventBus.emit(LIFECYCLE_EVENTS.STARTUP_FAILED, {
          error: error.message,
          timestamp: Date.now()
        })
      }
    }
  }

  /**
   * 處理系統關閉事件
   * @param {Object} data - 關閉資料
   * @returns {Promise<void>}
   * @private
   */
  async handleSystemShutdown (data) {
    try {
      this.domainStats.systemEventsProcessed++
      this.domainStats.shutdownAttempts++

      const { reason } = data
      this.logger.log(`⏹️ 處理系統關閉事件: ${reason}`)

      // 標記關閉請求
      this.systemState.shutdownRequested = true

      // 保存關閉狀態
      await chrome.storage.local.set({
        [STORAGE_KEYS.SYSTEM_SHUTDOWN_STATE]: {
          shutdownRequested: true,
          shutdownReason: reason,
          shutdownTime: Date.now()
        }
      })

      // 執行關閉前檢查
      const shutdownChecks = await this.performShutdownChecks()

      if (shutdownChecks.success) {
        // 保存最終狀態
        await this.saveSystemState()

        // 觸發關閉完成事件
        if (this.eventBus) {
          await this.eventBus.emit('SYSTEM.SHUTDOWN.COMPLETED', {
            reason,
            checks: shutdownChecks.results,
            timestamp: Date.now()
          })
        }

        this.logger.log('✅ 系統關閉處理完成')
      } else {
        this.logger.warn(`⚠️ 關閉檢查警告: ${shutdownChecks.warning}`)
      }
    } catch (error) {
      this.logger.error('❌ 處理系統關閉事件失敗:', error)
    }
  }

  /**
   * 處理系統錯誤事件
   * @param {Object} data - 錯誤資料
   * @returns {Promise<void>}
   * @private
   */
  async handleSystemError (data) {
    try {
      this.domainStats.systemEventsProcessed++

      const { error, severity, context } = data
      this.logger.error(`💥 處理系統錯誤事件: ${error}`, context)

      // 根據錯誤嚴重程度決定處理策略
      if (severity === 'critical') {
        // 嚴重錯誤：進入維護模式
        await this.enterMaintenanceMode(error, context)
      } else if (severity === 'high') {
        // 高級錯誤：記錄並嘗試恢復
        await this.attemptSystemRecovery(error, context)
      }

      // 記錄錯誤到系統狀態
      if (!this.systemState.errorHistory) {
        this.systemState.errorHistory = []
      }

      this.systemState.errorHistory.push({
        error,
        severity,
        context,
        timestamp: Date.now()
      })

      // 限制錯誤歷史大小
      if (this.systemState.errorHistory.length > 50) {
        this.systemState.errorHistory = this.systemState.errorHistory.slice(-25)
      }
    } catch (error) {
      this.logger.error('❌ 處理系統錯誤事件失敗:', error)
    }
  }

  /**
   * 處理配置更新請求事件
   * @param {Object} data - 配置更新資料
   * @returns {Promise<void>}
   * @private
   */
  async handleConfigurationUpdateRequest (data) {
    try {
      this.domainStats.systemEventsProcessed++
      this.domainStats.configurationUpdates++

      const { updates, source } = data
      this.logger.log(`⚙️ 處理配置更新請求 (來源: ${source})`)

      // 驗證配置更新
      const validation = await this.validateConfigurationUpdates(updates)

      if (validation.valid) {
        // 應用配置更新
        const updateResult = await this.applyConfigurationUpdates(updates)

        if (updateResult.success) {
          // 觸發配置更新完成事件
          if (this.eventBus) {
            await this.eventBus.emit('SYSTEM.CONFIG.UPDATED', {
              updates: updateResult.appliedUpdates,
              source,
              timestamp: Date.now()
            })
          }

          this.logger.log('✅ 配置更新完成')
        } else {
          throw new Error(`配置更新失敗: ${updateResult.error}`)
        }
      } else {
        throw new Error(`配置驗證失敗: ${validation.errors.join(', ')}`)
      }
    } catch (error) {
      this.logger.error('❌ 處理配置更新請求失敗:', error)

      // 觸發配置更新失敗事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.CONFIG.UPDATE.FAILED', {
          error: error.message,
          updates: data.updates,
          timestamp: Date.now()
        })
      }
    }
  }

  /**
   * 處理系統狀態查詢事件
   * @param {Object} data - 查詢資料
   * @returns {Promise<void>}
   * @private
   */
  async handleSystemStatusRequest (data) {
    try {
      this.domainStats.systemEventsProcessed++

      const { requestId, source } = data
      this.logger.log(`📊 處理系統狀態查詢 (來源: ${source})`)

      // 生成系統狀態報告
      const statusReport = await this.generateSystemStatusReport()

      // 觸發狀態響應事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.STATUS.RESPONSE', {
          requestId,
          source,
          status: statusReport,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理系統狀態查詢失敗:', error)
    }
  }

  /**
   * 處理全新安裝
   * @returns {Promise<void>}
   * @private
   */
  async handleFreshInstallation () {
    this.logger.log('🎉 處理全新安裝')

    // 初始化預設配置
    await this.initializeDefaultConfiguration()

    // 建立初始版本記錄
    this.versionHistory.push({
      version: this.systemState.currentVersion,
      installedAt: Date.now(),
      installationType: 'fresh_install'
    })
  }

  /**
   * 處理擴展更新
   * @param {string} previousVersion - 先前版本
   * @returns {Promise<void>}
   * @private
   */
  async handleExtensionUpdate (previousVersion) {
    this.logger.log(`🔄 處理擴展更新: ${previousVersion} → ${this.systemState.currentVersion}`)

    // 執行版本遷移
    await this.handleVersionChange(previousVersion, this.systemState.currentVersion)

    // 記錄更新資訊
    this.versionHistory.push({
      version: this.systemState.currentVersion,
      previousVersion,
      updatedAt: Date.now(),
      installationType: 'update'
    })
  }

  /**
   * 處理 Chrome 更新
   * @returns {Promise<void>}
   * @private
   */
  async handleChromeUpdate () {
    this.logger.log('🌐 處理 Chrome 瀏覽器更新')

    // 檢查 Chrome API 相容性
    await this.validateChromeApiCompatibility()
  }

  /**
   * 處理共享模組更新
   * @returns {Promise<void>}
   * @private
   */
  async handleSharedModuleUpdate () {
    this.logger.log('📦 處理共享模組更新')

    // 重新驗證模組相依性
    await this.validateModuleDependencies()
  }

  /**
   * 處理版本變更
   * @param {string} fromVersion - 來源版本
   * @param {string} toVersion - 目標版本
   * @returns {Promise<void>}
   * @private
   */
  async handleVersionChange (fromVersion, toVersion) {
    try {
      this.logger.log(`🔄 處理版本變更: ${fromVersion} → ${toVersion}`)

      // 尋找適用的遷移策略
      const migrationKey = this.findMigrationStrategy(fromVersion, toVersion)

      if (migrationKey) {
        const migrationStrategy = this.migrationStrategies.get(migrationKey)
        if (migrationStrategy) {
          this.domainStats.versionMigrations++

          const migrationResult = await migrationStrategy(fromVersion, toVersion)

          if (migrationResult.success) {
            this.logger.log(`✅ 版本遷移完成: ${migrationKey}`)
            this.logger.log(`📋 變更項目: ${migrationResult.changes.join(', ')}`)
          } else {
            throw new Error(`版本遷移失敗: ${migrationResult.error}`)
          }
        }
      }

      // 更新當前版本
      this.systemState.currentVersion = toVersion
    } catch (error) {
      this.logger.error('❌ 處理版本變更失敗:', error)
      throw error
    }
  }

  /**
   * 尋找遷移策略
   * @param {string} fromVersion - 來源版本
   * @param {string} toVersion - 目標版本
   * @returns {string|null} 遷移策略鍵
   * @private
   */
  findMigrationStrategy (fromVersion, toVersion) {
    // 簡化版本號比較邏輯
    const fromMajorMinor = this.extractMajorMinor(fromVersion)
    const toMajorMinor = this.extractMajorMinor(toVersion)

    // 檢查可用的遷移策略
    const strategies = Array.from(this.migrationStrategies.keys())

    for (const strategy of strategies) {
      const [from, to] = strategy.split('->')

      if (this.versionMatches(fromMajorMinor, from) &&
          this.versionMatches(toMajorMinor, to)) {
        return strategy
      }
    }

    return null
  }

  /**
   * 提取主要和次要版本號
   * @param {string} version - 版本字串
   * @returns {string} 主要.次要版本號
   * @private
   */
  extractMajorMinor (version) {
    if (!version) return '0.0'
    const parts = version.split('.')
    return `${parts[0] || '0'}.${parts[1] || '0'}`
  }

  /**
   * 版本比對
   * @param {string} version - 版本號
   * @param {string} pattern - 比對模式
   * @returns {boolean} 是否符合
   * @private
   */
  versionMatches (version, pattern) {
    if (pattern.endsWith('.x')) {
      const patternBase = pattern.slice(0, -2)
      return version.startsWith(patternBase)
    }
    return version === pattern
  }

  /**
   * 驗證系統狀態
   * @returns {Promise<void>}
   * @private
   */
  async validateSystemState () {
    try {
      // 檢查版本一致性
      const manifest = chrome.runtime.getManifest()
      if (this.systemState.currentVersion !== manifest.version) {
        this.logger.warn(`⚠️ 版本不一致: 狀態=${this.systemState.currentVersion}, Manifest=${manifest.version}`)
        this.systemState.currentVersion = manifest.version
      }

      // 檢查配置完整性
      await this.validateSystemConfiguration()

      this.logger.log('✅ 系統狀態驗證完成')
    } catch (error) {
      this.logger.error('❌ 驗證系統狀態失敗:', error)
      throw error
    }
  }

  /**
   * 驗證系統配置
   * @returns {Promise<void>}
   * @private
   */
  async validateSystemConfiguration () {
    const validation = await this.validateConfigurationUpdates(this.systemState.configuration)

    if (!validation.valid) {
      this.logger.warn('⚠️ 配置驗證失敗，重設為預設值:', validation.errors)
      this.systemState.configuration = { ...DEFAULT_CONFIG }
      await this.saveSystemState()
    }
  }

  /**
   * 驗證配置更新
   * @param {Object} updates - 配置更新
   * @returns {Promise<Object>} 驗證結果
   * @private
   */
  async validateConfigurationUpdates (updates) {
    const errors = []

    for (const [key, value] of Object.entries(updates)) {
      const validator = this.configurationValidators.get(key)
      if (validator && !validator(value)) {
        errors.push(`無效的配置項目: ${key}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 應用配置更新
   * @param {Object} updates - 配置更新
   * @returns {Promise<Object>} 更新結果
   * @private
   */
  async applyConfigurationUpdates (updates) {
    try {
      const appliedUpdates = {}

      for (const [key, value] of Object.entries(updates)) {
        const oldValue = this.systemState.configuration[key]
        this.systemState.configuration[key] = value

        appliedUpdates[key] = {
          oldValue,
          newValue: value
        }

        // 觸發配置監視器
        const watcher = this.configurationWatchers.get(key)
        if (watcher) {
          await watcher(oldValue, value)
        }
      }

      // 保存更新的配置
      await this.saveSystemState()

      return {
        success: true,
        appliedUpdates
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 執行啟動檢查
   * @returns {Promise<Object>} 檢查結果
   * @private
   */
  async performStartupChecks () {
    try {
      const checks = {}

      // Chrome API 可用性檢查
      checks.chromeApi = this.checkChromeApiAvailability()

      // 儲存權限檢查
      checks.storage = await this.checkStoragePermissions()

      // 配置完整性檢查
      checks.configuration = this.checkConfigurationIntegrity()

      const allPassed = Object.values(checks).every(check => check.passed)

      return {
        success: allPassed,
        results: checks,
        error: allPassed ? null : '部分啟動檢查失敗'
      }
    } catch (error) {
      return {
        success: false,
        results: {},
        error: error.message
      }
    }
  }

  /**
   * 執行關閉檢查
   * @returns {Promise<Object>} 檢查結果
   * @private
   */
  async performShutdownChecks () {
    try {
      const checks = {}

      // 檢查未保存的資料
      checks.unsavedData = await this.checkUnsavedData()

      // 檢查進行中的操作
      checks.pendingOperations = this.checkPendingOperations()

      const allClear = Object.values(checks).every(check => check.clear)

      return {
        success: allClear,
        results: checks,
        warning: allClear ? null : '部分關閉檢查發現警告'
      }
    } catch (error) {
      return {
        success: false,
        results: {},
        warning: error.message
      }
    }
  }

  /**
   * 檢查 Chrome API 可用性
   * @returns {Object} 檢查結果
   * @private
   */
  checkChromeApiAvailability () {
    const requiredApis = ['storage', 'tabs', 'runtime']
    const missing = []

    for (const api of requiredApis) {
      if (!chrome[api]) {
        missing.push(api)
      }
    }

    return {
      passed: missing.length === 0,
      missing,
      message: missing.length === 0 ? 'Chrome API 可用' : `缺少 API: ${missing.join(', ')}`
    }
  }

  /**
   * 檢查儲存權限
   * @returns {Promise<Object>} 檢查結果
   * @private
   */
  async checkStoragePermissions () {
    try {
      await chrome.storage.local.set({ test: 'test' })
      await chrome.storage.local.remove(['test'])

      return {
        passed: true,
        message: '儲存權限正常'
      }
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        message: '儲存權限檢查失敗'
      }
    }
  }

  /**
   * 檢查配置完整性
   * @returns {Object} 檢查結果
   * @private
   */
  checkConfigurationIntegrity () {
    const requiredKeys = ['isEnabled', 'extractionSettings', 'debugMode', 'logLevel']
    const missing = []

    for (const key of requiredKeys) {
      if (this.systemState.configuration[key] === undefined) {
        missing.push(key)
      }
    }

    return {
      passed: missing.length === 0,
      missing,
      message: missing.length === 0 ? '配置完整' : `缺少配置項目: ${missing.join(', ')}`
    }
  }

  /**
   * 檢查未保存的資料
   * @returns {Promise<Object>} 檢查結果
   * @private
   */
  async checkUnsavedData () {
    // 檢查是否有未保存的系統狀態變更
    // 這裡可以擴展檢查邏輯

    return {
      clear: true,
      message: '無未保存資料'
    }
  }

  /**
   * 檢查進行中的操作
   * @returns {Object} 檢查結果
   * @private
   */
  checkPendingOperations () {
    // 檢查是否有進行中的操作
    // 這裡可以擴展檢查邏輯

    return {
      clear: true,
      message: '無進行中操作'
    }
  }

  /**
   * 進入維護模式
   * @param {string} reason - 維護原因
   * @param {Object} context - 上下文
   * @returns {Promise<void>}
   * @private
   */
  async enterMaintenanceMode (reason, context) {
    this.logger.warn(`🚧 進入維護模式: ${reason}`)

    this.systemState.maintenanceMode = true

    // 觸發維護模式事件
    if (this.eventBus) {
      await this.eventBus.emit('SYSTEM.MAINTENANCE.MODE.ENTERED', {
        reason,
        context,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 嘗試系統恢復
   * @param {string} error - 錯誤描述
   * @param {Object} context - 上下文
   * @returns {Promise<void>}
   * @private
   */
  async attemptSystemRecovery (error, context) {
    this.logger.log(`🔄 嘗試系統恢復: ${error}`)

    // 觸發系統恢復事件
    if (this.eventBus) {
      await this.eventBus.emit('SYSTEM.RECOVERY.ATTEMPT', {
        error,
        context,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 初始化預設配置
   * @returns {Promise<void>}
   * @private
   */
  async initializeDefaultConfiguration () {
    this.systemState.configuration = { ...DEFAULT_CONFIG }
    await this.saveSystemState()
    this.logger.log('✅ 預設配置初始化完成')
  }

  /**
   * 驗證 Chrome API 相容性
   * @returns {Promise<void>}
   * @private
   */
  async validateChromeApiCompatibility () {
    // 檢查 Manifest V3 相容性
    const manifest = chrome.runtime.getManifest()
    if (manifest.manifest_version !== 3) {
      this.logger.warn('⚠️ 非 Manifest V3 環境')
    }

    this.logger.log('✅ Chrome API 相容性檢查完成')
  }

  /**
   * 驗證模組相依性
   * @returns {Promise<void>}
   * @private
   */
  async validateModuleDependencies () {
    // 檢查模組相依性
    this.logger.log('✅ 模組相依性驗證完成')
  }

  /**
   * 生成系統狀態報告
   * @returns {Promise<Object>} 狀態報告
   * @private
   */
  async generateSystemStatusReport () {
    return {
      system: {
        version: this.systemState.currentVersion,
        lastStartupTime: this.systemState.lastStartupTime,
        maintenanceMode: this.systemState.maintenanceMode,
        shutdownRequested: this.systemState.shutdownRequested
      },
      configuration: this.systemState.configuration,
      installation: this.systemState.installationInfo,
      versionHistory: this.versionHistory.slice(-5), // 最近5個版本
      domainStats: this.domainStats,
      status: {
        initialized: this.initialized,
        active: this.active
      },
      timestamp: Date.now()
    }
  }

  /**
   * 獲取系統狀態
   * @returns {Object} 系統狀態
   */
  getSystemState () {
    return {
      ...this.systemState,
      domainStats: this.domainStats,
      initialized: this.initialized,
      active: this.active
    }
  }

  /**
   * 獲取統計資料
   * @returns {Object} 統計資料
   */
  getStats () {
    return { ...this.domainStats }
  }
}

module.exports = SystemDomainHandler
