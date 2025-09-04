/**
 * 版本控制服務
 *
 * 負責功能：
 * - 版本資訊管理和追蹤
 * - 版本升級檢測和處理
 * - 資料遷移策略管理和執行
 * - 版本相容性檢查和驗證
 *
 * 設計考量：
 * - 語意化版本控制支援
 * - 可擴展的遷移策略架構
 * - 向後相容性保證
 * - 版本變更的事件通知
 *
 * 使用情境：
 * - 擴展版本升級處理
 * - 資料格式遷移
 * - 版本相容性檢查
 */

const {
  SYSTEM_EVENTS,
  STORAGE_KEYS,
  EVENT_PRIORITIES
} = require('../../../constants/module-constants')

class VersionControlService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false
    }

    // 版本管理
    this.currentVersion = null
    this.previousVersion = null
    this.versionHistory = []
    this.migrationStrategies = new Map()
    this.registeredListeners = new Map()

    // 統計資料
    this.stats = {
      versionChecks: 0,
      migrationsExecuted: 0,
      migrationFailures: 0,
      versionUpdates: 0
    }

    // 初始化預設遷移策略
    this.initializeDefaultMigrationStrategies()
  }

  /**
   * 初始化版本控制服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('⚠️ 版本控制服務已初始化')
      return
    }

    try {
      this.logger.log('📦 初始化版本控制服務')

      // 載入版本資訊
      await this.loadVersionInfo()

      // 檢測版本變更
      await this.detectVersionChange()

      // 註冊事件監聽器
      await this.registerEventListeners()

      this.state.initialized = true
      this.logger.log('✅ 版本控制服務初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.VERSION.INITIALIZED', {
          serviceName: 'VersionControlService',
          currentVersion: this.currentVersion,
          previousVersion: this.previousVersion
        })
      }
    } catch (error) {
      this.logger.error('❌ 初始化版本控制服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動版本控制服務
   */
  async start () {
    if (!this.state.initialized) {
      throw new Error('服務尚未初始化')
    }

    if (this.state.active) {
      this.logger.warn('⚠️ 版本控制服務已啟動')
      return
    }

    try {
      this.logger.log('🚀 啟動版本控制服務')

      this.state.active = true
      this.logger.log('✅ 版本控制服務啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.VERSION.STARTED', {
          serviceName: 'VersionControlService',
          version: this.currentVersion
        })
      }
    } catch (error) {
      this.logger.error('❌ 啟動版本控制服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止版本控制服務
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('⚠️ 版本控制服務未啟動')
      return
    }

    try {
      this.logger.log('🛑 停止版本控制服務')

      // 保存版本資訊
      await this.saveVersionInfo()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      this.state.active = false
      this.logger.log('✅ 版本控制服務停止完成')

      // 發送停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.VERSION.STOPPED', {
          serviceName: 'VersionControlService'
        })
      }
    } catch (error) {
      this.logger.error('❌ 停止版本控制服務失敗:', error)
      throw error
    }
  }

  /**
   * 載入版本資訊
   */
  async loadVersionInfo () {
    try {
      // 從 manifest.json 讀取當前版本
      this.currentVersion = this.getManifestVersion()

      // 從儲存載入版本歷史
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get([
          STORAGE_KEYS.VERSION_INFO,
          STORAGE_KEYS.VERSION_HISTORY
        ])

        if (result[STORAGE_KEYS.VERSION_INFO]) {
          this.previousVersion = result[STORAGE_KEYS.VERSION_INFO].version
        }

        if (result[STORAGE_KEYS.VERSION_HISTORY]) {
          this.versionHistory = result[STORAGE_KEYS.VERSION_HISTORY]
        }
      }

      this.logger.log(`✅ 版本資訊載入完成 - 當前: ${this.currentVersion}, 之前: ${this.previousVersion}`)
    } catch (error) {
      this.logger.error('❌ 載入版本資訊失敗:', error)
      // 設定預設值
      this.currentVersion = '0.0.0'
    }
  }

  /**
   * 保存版本資訊
   */
  async saveVersionInfo () {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const versionInfo = {
          version: this.currentVersion,
          timestamp: Date.now(),
          previousVersion: this.previousVersion
        }

        await chrome.storage.local.set({
          [STORAGE_KEYS.VERSION_INFO]: versionInfo,
          [STORAGE_KEYS.VERSION_HISTORY]: this.versionHistory
        })

        this.logger.log('✅ 版本資訊保存完成')
      } else {
        this.logger.warn('⚠️ Chrome storage API 不可用，無法保存版本資訊')
      }
    } catch (error) {
      this.logger.error('❌ 保存版本資訊失敗:', error)
    }
  }

  /**
   * 從 manifest.json 獲取版本
   */
  getManifestVersion () {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
        const manifest = chrome.runtime.getManifest()
        return manifest.version || '0.0.0'
      }

      // 在測試環境中的後備方案
      return '0.0.0'
    } catch (error) {
      this.logger.error('❌ 無法獲取 manifest 版本:', error)
      return '0.0.0'
    }
  }

  /**
   * 檢測版本變更
   */
  async detectVersionChange () {
    this.stats.versionChecks++

    const hasVersionChanged = this.previousVersion &&
                              this.currentVersion !== this.previousVersion

    if (hasVersionChanged) {
      this.logger.log(`🔄 檢測到版本變更: ${this.previousVersion} → ${this.currentVersion}`)

      // 記錄版本變更歷史
      this.versionHistory.push({
        fromVersion: this.previousVersion,
        toVersion: this.currentVersion,
        timestamp: Date.now(),
        reason: 'update'
      })

      // 限制歷史記錄數量
      if (this.versionHistory.length > 20) {
        this.versionHistory = this.versionHistory.slice(-20)
      }

      // 執行版本遷移
      await this.executeVersionMigration(this.previousVersion, this.currentVersion)

      this.stats.versionUpdates++

      // 發送版本變更事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.VERSION.CHANGED', {
          fromVersion: this.previousVersion,
          toVersion: this.currentVersion,
          timestamp: Date.now()
        })
      }
    }
  }

  /**
   * 執行版本遷移
   */
  async executeVersionMigration (fromVersion, toVersion) {
    try {
      this.logger.log(`🔄 執行版本遷移: ${fromVersion} → ${toVersion}`)

      // 查找適用的遷移策略
      const migrationKey = this.findMigrationStrategy(fromVersion, toVersion)

      if (migrationKey && this.migrationStrategies.has(migrationKey)) {
        const strategy = this.migrationStrategies.get(migrationKey)

        this.stats.migrationsExecuted++
        await strategy(fromVersion, toVersion)

        this.logger.log(`✅ 版本遷移完成: ${migrationKey}`)

        // 發送遷移完成事件
        if (this.eventBus) {
          await this.eventBus.emit('SYSTEM.VERSION.MIGRATION_COMPLETED', {
            fromVersion,
            toVersion,
            strategy: migrationKey
          })
        }
      } else {
        this.logger.log(`ℹ️ 未找到適用的遷移策略: ${fromVersion} → ${toVersion}`)
      }
    } catch (error) {
      this.stats.migrationFailures++
      this.logger.error('❌ 版本遷移失敗:', error)

      // 發送遷移失敗事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.VERSION.MIGRATION_FAILED', {
          fromVersion,
          toVersion,
          error: error.message
        })
      }

      throw error
    }
  }

  /**
   * 查找遷移策略
   */
  findMigrationStrategy (fromVersion, toVersion) {
    // 直接匹配
    const directKey = `${fromVersion}->${toVersion}`
    if (this.migrationStrategies.has(directKey)) {
      return directKey
    }

    // 模糊匹配（主版本號）
    const fromMajor = this.getMajorVersion(fromVersion)
    const toMajor = this.getMajorVersion(toVersion)

    const majorKey = `${fromMajor}.x->${toMajor}.x`
    if (this.migrationStrategies.has(majorKey)) {
      return majorKey
    }

    return null
  }

  /**
   * 獲取主版本號
   */
  getMajorVersion (version) {
    const parts = version.split('.')
    return `${parts[0] || '0'}.${parts[1] || '0'}`
  }

  /**
   * 初始化預設遷移策略
   */
  initializeDefaultMigrationStrategies () {
    // 0.8.x -> 0.9.x 遷移策略
    this.migrationStrategies.set('0.8.x->0.9.x', async (fromVersion, toVersion) => {
      this.logger.log('🔄 執行 0.8.x -> 0.9.x 遷移')

      // 遷移系統設定格式
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(['oldSystemConfig'])
        if (result.oldSystemConfig) {
          // 轉換舊格式到新格式
          const newConfig = this.convertLegacyConfig(result.oldSystemConfig)
          await chrome.storage.local.set({
            [STORAGE_KEYS.SYSTEM_CONFIG]: newConfig
          })
          await chrome.storage.local.remove(['oldSystemConfig'])
          this.logger.log('✅ 系統設定格式遷移完成')
        }
      }
    })

    // 0.9.x -> 1.0.x 遷移策略
    this.migrationStrategies.set('0.9.x->1.0.x', async (fromVersion, toVersion) => {
      this.logger.log('🔄 執行 0.9.x -> 1.0.x 遷移')

      // 重建索引和快取
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.CACHE.CLEAR_ALL', {
          reason: 'version_migration',
          fromVersion,
          toVersion
        })

        await this.eventBus.emit('SYSTEM.INDEX.REBUILD', {
          reason: 'version_migration',
          fromVersion,
          toVersion
        })
      }

      this.logger.log('✅ 索引和快取重建完成')
    })
  }

  /**
   * 轉換舊格式配置
   */
  convertLegacyConfig (oldConfig) {
    // 這裡實現舊配置格式到新格式的轉換邏輯
    const newConfig = {}

    // 範例轉換邏輯
    if (oldConfig.enableFeatureX) {
      newConfig.features = newConfig.features || {}
      newConfig.features.featureX = { enabled: oldConfig.enableFeatureX }
    }

    return newConfig
  }

  /**
   * 註冊遷移策略
   */
  registerMigrationStrategy (key, strategy) {
    if (typeof strategy !== 'function') {
      throw new Error('遷移策略必須是函數')
    }

    this.migrationStrategies.set(key, strategy)
    this.logger.log(`✅ 註冊遷移策略: ${key}`)
  }

  /**
   * 版本比較
   */
  compareVersions (version1, version2) {
    const v1Parts = version1.split('.').map(Number)
    const v2Parts = version2.split('.').map(Number)

    const maxLength = Math.max(v1Parts.length, v2Parts.length)

    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0
      const v2Part = v2Parts[i] || 0

      if (v1Part > v2Part) return 1
      if (v1Part < v2Part) return -1
    }

    return 0
  }

  /**
   * 檢查版本相容性
   */
  isVersionCompatible (requiredVersion, currentVersion = this.currentVersion) {
    return this.compareVersions(currentVersion, requiredVersion) >= 0
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners () {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 不可用，跳過事件監聽器註冊')
      return
    }

    const listeners = [
      {
        event: SYSTEM_EVENTS.VERSION_CHECK_REQUEST,
        handler: this.handleVersionCheckRequest.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      }
    ]

    for (const { event, handler, priority } of listeners) {
      const listenerId = await this.eventBus.on(event, handler, { priority })
      this.registeredListeners.set(event, listenerId)
    }

    this.logger.log(`✅ 註冊了 ${listeners.length} 個事件監聽器`)
  }

  /**
   * 取消註冊事件監聽器
   */
  async unregisterEventListeners () {
    if (!this.eventBus) return

    for (const [event, listenerId] of this.registeredListeners) {
      try {
        await this.eventBus.off(event, listenerId)
      } catch (error) {
        this.logger.error(`❌ 取消註冊事件監聽器失敗 (${event}):`, error)
      }
    }

    this.registeredListeners.clear()
    this.logger.log('✅ 所有事件監聽器已取消註冊')
  }

  /**
   * 處理版本檢查請求
   */
  async handleVersionCheckRequest (event) {
    try {
      const { requiredVersion } = event.data || {}

      if (requiredVersion) {
        const isCompatible = this.isVersionCompatible(requiredVersion)

        if (this.eventBus) {
          await this.eventBus.emit('SYSTEM.VERSION.CHECK_RESULT', {
            requiredVersion,
            currentVersion: this.currentVersion,
            compatible: isCompatible
          })
        }
      }
    } catch (error) {
      this.logger.error('❌ 處理版本檢查請求失敗:', error)
    }
  }

  /**
   * 獲取版本資訊
   */
  getVersionInfo () {
    return {
      currentVersion: this.currentVersion,
      previousVersion: this.previousVersion,
      versionHistory: [...this.versionHistory],
      migrationStrategies: Array.from(this.migrationStrategies.keys())
    }
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      currentVersion: this.currentVersion,
      previousVersion: this.previousVersion,
      migrationStrategiesCount: this.migrationStrategies.size,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const isHealthy = this.state.initialized &&
                     this.currentVersion &&
                     this.stats.migrationFailures === 0

    return {
      service: 'VersionControlService',
      healthy: isHealthy,
      status: this.state.active ? 'active' : 'inactive',
      version: this.currentVersion,
      metrics: {
        versionChecks: this.stats.versionChecks,
        migrationsExecuted: this.stats.migrationsExecuted,
        migrationFailures: this.stats.migrationFailures,
        versionUpdates: this.stats.versionUpdates
      }
    }
  }
}

module.exports = VersionControlService
