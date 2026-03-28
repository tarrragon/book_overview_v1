/**
 * 權限管理服務
 *
 * 負責功能：
 * - Chrome Extension 權限的檢查和申請
 * - 頁面存取權限的驗證和管理
 * - 權限狀態的監控和更新
 * - 權限相關錯誤的處理和回報
 *
 * 設計考量：
 * - 最小權限原則的實施
 * - 動態權限請求和釋放機制
 * - 使用者友善的權限說明和引導
 * - 權限變更的即時通知和處理
 *
 * 使用情境：
 * - 檢查是否有存取 Readmoo 網站的權限
 * - 請求必要的 activeTab 或 tabs 權限
 * - 管理 storage 和 scripting 權限
 */

const {
  PERMISSION_EVENTS,
  EVENT_PRIORITIES
} = require('src/background/constants/module-constants')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

class PermissionManagementService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null

    // Logger 後備方案: Background Service 初始化保護
    // 設計理念: 權限管理服務作為安全存取控制中心，必須確保操作記錄完整性
    // 執行環境: Service Worker 初始化階段，依賴注入可能不完整
    // 後備機制: console 確保權限變更和安全事件能被追蹤
    // 風險考量: 理想上應確保 Logger 完整可用，此為過渡性保護
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false,
      monitoring: false
    }

    // 權限管理
    this.requiredPermissions = new Map()
    this.grantedPermissions = new Set()
    this.pendingRequests = new Map()
    this.permissionChecks = new Map()
    this.registeredListeners = new Map()

    // 權限監控
    this.permissionWatcher = null
    this.checkInterval = 300000 // 300秒（5分鐘）檢查一次，避免 console 洗版
    // 快取上次權限狀態，用於比對變更（只在狀態變更時輸出日誌）
    this.previousPermissionSnapshot = null

    // 配置
    this.config = {
      autoRequestPermissions: true,
      showPermissionPrompts: true,
      retryFailedRequests: true,
      maxRetryAttempts: 3,
      requestTimeout: 30000 // 30秒超時
    }

    // 統計資料
    this.stats = {
      permissionsGranted: 0,
      permissionsDenied: 0,
      permissionRequests: 0,
      permissionChecks: 0
    }

    // 初始化權限配置
    this.initializePermissionConfigs()
  }

  /**
   * 初始化權限管理服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('[WARNING] 權限管理服務已初始化')
      return
    }

    try {
      this.logger.log('[INFO] 初始化權限管理服務')

      // 檢查當前權限狀態
      await this.checkCurrentPermissions()

      // 註冊事件監聽器
      await this.registerEventListeners()

      // 註冊權限變更監聽器
      await this.registerPermissionListeners()

      this.state.initialized = true
      this.logger.log('✅ 權限管理服務初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.PERMISSION.INITIALIZED', {
          serviceName: 'PermissionManagementService',
          grantedPermissions: Array.from(this.grantedPermissions)
        })
      }
    } catch (error) {
      this.logger.error('❌ 初始化權限管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動權限管理服務
   */
  async start () {
    if (!this.state.initialized) {
      const error = new Error('服務尚未初始化')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
        category: 'permission'
      }
      throw error
    }

    if (this.state.active) {
      this.logger.warn('⚠️ 權限管理服務已啟動')
      return
    }

    try {
      this.logger.log('🚀 啟動權限管理服務')

      // 開始權限監控
      this.startPermissionMonitoring()

      // 自動請求必要權限
      if (this.config.autoRequestPermissions) {
        await this.requestEssentialPermissions()
      }

      this.state.active = true
      this.state.monitoring = true

      this.logger.log('✅ 權限管理服務啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.PERMISSION.STARTED', {
          serviceName: 'PermissionManagementService'
        })
      }
    } catch (error) {
      this.logger.error('❌ 啟動權限管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止權限管理服務
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('⚠️ 權限管理服務未啟動')
      return
    }

    try {
      this.logger.log('🛑 停止權限管理服務')

      // 停止權限監控
      this.stopPermissionMonitoring()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()
      await this.unregisterPermissionListeners()

      this.state.active = false
      this.state.monitoring = false

      this.logger.log('✅ 權限管理服務停止完成')

      // 發送停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.PERMISSION.STOPPED', {
          serviceName: 'PermissionManagementService',
          finalStats: { ...this.stats }
        })
      }
    } catch (error) {
      this.logger.error('❌ 停止權限管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 初始化權限配置
   */
  initializePermissionConfigs () {
    // activeTab 權限 - 存取當前活躍分頁
    this.requiredPermissions.set('activeTab', {
      name: 'activeTab',
      required: true,
      description: '存取當前分頁以提取書籍資料',
      category: 'essential'
    })

    // scripting 權限 - 注入內容腳本
    this.requiredPermissions.set('scripting', {
      name: 'scripting',
      required: true,
      description: '注入腳本以提取頁面資料',
      category: 'essential'
    })

    // storage 權限 - 儲存資料
    this.requiredPermissions.set('storage', {
      name: 'storage',
      required: true,
      description: '儲存書籍資料和設定',
      category: 'essential'
    })

    // tabs 權限 - 存取分頁資訊
    this.requiredPermissions.set('tabs', {
      name: 'tabs',
      required: false,
      description: '監控分頁狀態以提供更好的使用體驗',
      category: 'optional'
    })

    // Readmoo 網站權限
    this.requiredPermissions.set('readmoo_access', {
      name: '*://readmoo.com/*',
      required: true,
      description: '存取 Readmoo 網站以提取書籍資料',
      category: 'essential',
      origins: ['*://readmoo.com/*']
    })

    this.logger.log(`✅ 初始化了 ${this.requiredPermissions.size} 個權限配置`)
  }

  /**
   * 檢查當前權限狀態
   *
   * 設計考量：為避免定時監控造成 console 洗版，
   * 採用快取比對機制，只在權限狀態實際變更時輸出日誌。
   * 首次檢查時一定會輸出完整狀態（作為基線）。
   */
  async checkCurrentPermissions () {
    if (typeof chrome === 'undefined' || !chrome.permissions) {
      this.logger.warn('[WARNING] Chrome Permissions API 不可用')
      return
    }

    try {
      this.grantedPermissions.clear()
      const currentSnapshot = {}

      for (const [key, config] of this.requiredPermissions) {
        const hasPermission = await this.checkPermission(config)

        if (hasPermission) {
          this.grantedPermissions.add(key)
        }

        currentSnapshot[key] = hasPermission

        this.permissionChecks.set(key, {
          granted: hasPermission,
          lastCheck: Date.now()
        })
      }

      this.stats.permissionChecks++

      // 只在權限狀態變更時輸出日誌（首次檢查視為變更，輸出完整基線）
      const isFirstCheck = this.previousPermissionSnapshot === null
      const changes = this.detectPermissionChanges(currentSnapshot)

      if (isFirstCheck) {
        for (const [key, config] of this.requiredPermissions) {
          const granted = currentSnapshot[key]
          this.logger.log(`${granted ? '[GRANTED]' : '[DENIED]'} 權限: ${config.name}`)
        }
        this.logger.log(`[INFO] 權限初始檢查完成，已授予 ${this.grantedPermissions.size}/${this.requiredPermissions.size} 個權限`)
      } else if (changes.length > 0) {
        for (const change of changes) {
          const config = this.requiredPermissions.get(change.key)
          const statusLabel = change.granted ? '[GRANTED]' : '[REVOKED]'
          this.logger.log(`${statusLabel} 權限變更: ${config.name}`)
        }
        this.logger.log(`[INFO] 權限狀態變更，已授予 ${this.grantedPermissions.size}/${this.requiredPermissions.size} 個權限`)
      }
      // 狀態未變更時不輸出任何日誌

      this.previousPermissionSnapshot = currentSnapshot
    } catch (error) {
      this.logger.error('[ERROR] 檢查當前權限失敗:', error)
    }
  }

  /**
   * 比對權限快照，偵測狀態變更
   *
   * 設計考量：將變更偵測邏輯獨立為方法，
   * 便於測試和維護。回傳變更清單而非布林值，
   * 讓呼叫端可以精確輸出哪些權限發生了變更。
   */
  detectPermissionChanges (currentSnapshot) {
    if (!this.previousPermissionSnapshot) return []

    const changes = []
    for (const [key, granted] of Object.entries(currentSnapshot)) {
      if (this.previousPermissionSnapshot[key] !== granted) {
        changes.push({ key, granted })
      }
    }
    return changes
  }

  /**
   * 檢查單個權限
   */
  async checkPermission (config) {
    try {
      const checkData = {}

      if (config.origins) {
        checkData.origins = config.origins
      } else {
        checkData.permissions = [config.name]
      }

      return await chrome.permissions.contains(checkData)
    } catch (error) {
      this.logger.error(`❌ 檢查權限失敗 (${config.name}):`, error)
      return false
    }
  }

  /**
   * 請求權限
   */
  async requestPermission (permissionKey, userInitiated = false) {
    const config = this.requiredPermissions.get(permissionKey)
    if (!config) {
      const error = new Error(`未知的權限: ${permissionKey}`)
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'permission',
        permissionKey
      }
      throw error
    }

    if (this.grantedPermissions.has(permissionKey)) {
      return true
    }

    // 檢查是否已有待處理的請求
    if (this.pendingRequests.has(permissionKey)) {
      this.logger.log(`⏳ 權限請求已在處理中: ${permissionKey}`)
      return this.pendingRequests.get(permissionKey)
    }

    this.logger.log(`📋 請求權限: ${config.name}`)
    this.stats.permissionRequests++

    const requestPromise = this.executePermissionRequest(config, userInitiated)
    this.pendingRequests.set(permissionKey, requestPromise)

    try {
      const granted = await requestPromise

      if (granted) {
        this.grantedPermissions.add(permissionKey)
        this.stats.permissionsGranted++
        this.logger.log(`✅ 權限已授予: ${config.name}`)

        // 發送權限授予事件
        if (this.eventBus) {
          await this.eventBus.emit('PAGE.PERMISSION.GRANTED', {
            permission: permissionKey,
            config
          })
        }
      } else {
        this.stats.permissionsDenied++
        this.logger.log(`❌ 權限被拒絕: ${config.name}`)

        // 發送權限拒絕事件
        if (this.eventBus) {
          await this.eventBus.emit('PAGE.PERMISSION.DENIED', {
            permission: permissionKey,
            config
          })
        }
      }

      return granted
    } finally {
      this.pendingRequests.delete(permissionKey)
    }
  }

  /**
   * 執行權限請求
   */
  async executePermissionRequest (config, userInitiated) {
    if (typeof chrome === 'undefined' || !chrome.permissions) {
      return false
    }

    try {
      const requestData = {}

      if (config.origins) {
        requestData.origins = config.origins
      } else {
        requestData.permissions = [config.name]
      }

      // Chrome 要求某些權限請求必須由使用者互動觸發
      if (!userInitiated && this.requiresUserGesture(config.name)) {
        this.logger.warn(`⚠️ 權限 ${config.name} 需要使用者手勢觸發`)
        return false
      }

      return await chrome.permissions.request(requestData)
    } catch (error) {
      this.logger.error(`❌ 執行權限請求失敗 (${config.name}):`, error)
      return false
    }
  }

  /**
   * 檢查是否需要使用者手勢
   */
  requiresUserGesture (permissionName) {
    const userGestureRequired = [
      'tabs',
      'activeTab',
      'scripting'
    ]

    return userGestureRequired.includes(permissionName)
  }

  /**
   * 請求必要權限
   */
  async requestEssentialPermissions () {
    const essentialPermissions = Array.from(this.requiredPermissions.entries())
      .filter(([key, config]) => config.required)
      .map(([key]) => key)

    const results = []

    for (const permissionKey of essentialPermissions) {
      try {
        const granted = await this.requestPermission(permissionKey, false)
        results.push({ permission: permissionKey, granted })
      } catch (error) {
        this.logger.error(`❌ 請求必要權限失敗 (${permissionKey}):`, error)
        results.push({ permission: permissionKey, granted: false, error: error.message })
      }
    }

    const grantedCount = results.filter(r => r.granted).length
    this.logger.log(`📋 必要權限請求完成: ${grantedCount}/${essentialPermissions.length} 已授予`)

    return results
  }

  /**
   * 撤銷權限
   */
  async revokePermission (permissionKey) {
    const config = this.requiredPermissions.get(permissionKey)
    if (!config) {
      const error = new Error(`未知的權限: ${permissionKey}`)
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'permission',
        permissionKey
      }
      throw error
    }

    if (typeof chrome === 'undefined' || !chrome.permissions) {
      return false
    }

    try {
      const removeData = {}

      if (config.origins) {
        removeData.origins = config.origins
      } else {
        removeData.permissions = [config.name]
      }

      const removed = await chrome.permissions.remove(removeData)

      if (removed) {
        this.grantedPermissions.delete(permissionKey)
        this.logger.log(`🗑️ 權限已撤銷: ${config.name}`)

        // 發送權限撤銷事件
        if (this.eventBus) {
          await this.eventBus.emit('PAGE.PERMISSION.REVOKED', {
            permission: permissionKey,
            config
          })
        }
      }

      return removed
    } catch (error) {
      this.logger.error(`❌ 撤銷權限失敗 (${config.name}):`, error)
      return false
    }
  }

  /**
   * 開始權限監控
   */
  startPermissionMonitoring () {
    if (this.permissionWatcher) return

    this.permissionWatcher = setInterval(async () => {
      await this.checkCurrentPermissions()
    }, this.checkInterval)

    this.logger.log('👁️ 權限監控已啟動')
  }

  /**
   * 停止權限監控
   */
  stopPermissionMonitoring () {
    if (this.permissionWatcher) {
      clearInterval(this.permissionWatcher)
      this.permissionWatcher = null
      this.logger.log('👁️ 權限監控已停止')
    }
  }

  /**
   * 註冊權限變更監聽器
   */
  async registerPermissionListeners () {
    if (typeof chrome === 'undefined' || !chrome.permissions) {
      this.logger.warn('⚠️ Chrome Permissions API 不可用')
      return
    }

    try {
      // 權限添加事件
      chrome.permissions.onAdded.addListener(this.handlePermissionAdded.bind(this))

      // 權限移除事件
      chrome.permissions.onRemoved.addListener(this.handlePermissionRemoved.bind(this))

      this.logger.log('✅ Chrome 權限事件監聽器註冊完成')
    } catch (error) {
      this.logger.error('❌ 註冊權限監聽器失敗:', error)
    }
  }

  /**
   * 取消註冊權限監聽器
   */
  async unregisterPermissionListeners () {
    if (typeof chrome === 'undefined' || !chrome.permissions) return

    try {
      chrome.permissions.onAdded.removeListener(this.handlePermissionAdded.bind(this))
      chrome.permissions.onRemoved.removeListener(this.handlePermissionRemoved.bind(this))

      this.logger.log('✅ Chrome 權限事件監聽器取消註冊完成')
    } catch (error) {
      this.logger.error('❌ 取消註冊權限監聽器失敗:', error)
    }
  }

  /**
   * 處理權限添加事件
   */
  async handlePermissionAdded (permissions) {
    this.logger.log('🔐 檢測到權限添加:', permissions)

    // 更新內部狀態
    await this.checkCurrentPermissions()

    // 發送權限變更事件
    if (this.eventBus) {
      await this.eventBus.emit('PAGE.PERMISSION.CHANGED', {
        type: 'added',
        permissions
      })
    }
  }

  /**
   * 處理權限移除事件
   */
  async handlePermissionRemoved (permissions) {
    this.logger.log('🔐 檢測到權限移除:', permissions)

    // 更新內部狀態
    await this.checkCurrentPermissions()

    // 發送權限變更事件
    if (this.eventBus) {
      await this.eventBus.emit('PAGE.PERMISSION.CHANGED', {
        type: 'removed',
        permissions
      })
    }
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
        event: PERMISSION_EVENTS.REQUEST,
        handler: this.handlePermissionRequest.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      },
      {
        event: PERMISSION_EVENTS.CHECK,
        handler: this.handlePermissionCheck.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      },
      {
        event: PERMISSION_EVENTS.REVOKE,
        handler: this.handlePermissionRevoke.bind(this),
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
   * 處理權限請求事件
   */
  async handlePermissionRequest (event) {
    try {
      const { permission, userInitiated, requestId } = event.data || {}

      if (!permission) {
        const error = new Error('權限請求事件缺少 permission 參數')
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = {
          category: 'permission'
        }
        throw error
      }

      const granted = await this.requestPermission(permission, userInitiated)

      if (this.eventBus) {
        await this.eventBus.emit('PAGE.PERMISSION.REQUEST_RESULT', {
          requestId,
          permission,
          granted
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理權限請求事件失敗:', error)
    }
  }

  /**
   * 處理權限檢查事件
   */
  async handlePermissionCheck (event) {
    try {
      const { permission, requestId } = event.data || {}

      let result
      if (permission) {
        result = {
          permission,
          granted: this.grantedPermissions.has(permission),
          config: this.requiredPermissions.get(permission)
        }
      } else {
        result = {
          allPermissions: this.getAllPermissionStatus()
        }
      }

      if (this.eventBus) {
        await this.eventBus.emit('PAGE.PERMISSION.CHECK_RESULT', {
          requestId,
          result
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理權限檢查事件失敗:', error)
    }
  }

  /**
   * 處理權限撤銷事件
   */
  async handlePermissionRevoke (event) {
    try {
      const { permission, requestId } = event.data || {}

      if (!permission) {
        const error = new Error('權限撤銷事件缺少 permission 參數')
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = {
          category: 'permission'
        }
        throw error
      }

      const revoked = await this.revokePermission(permission)

      if (this.eventBus) {
        await this.eventBus.emit('PAGE.PERMISSION.REVOKE_RESULT', {
          requestId,
          permission,
          revoked
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理權限撤銷事件失敗:', error)
    }
  }

  /**
   * 獲取所有權限狀態
   */
  getAllPermissionStatus () {
    const status = {}

    for (const [key, config] of this.requiredPermissions) {
      status[key] = {
        granted: this.grantedPermissions.has(key),
        required: config.required,
        config
      }
    }

    return status
  }

  /**
   * 檢查是否有必要權限
   */
  hasEssentialPermissions () {
    const essentialPermissions = Array.from(this.requiredPermissions.entries())
      .filter(([key, config]) => config.required)
      .map(([key]) => key)

    return essentialPermissions.every(permission =>
      this.grantedPermissions.has(permission)
    )
  }

  /**
   * 獲取缺失的權限
   */
  getMissingPermissions () {
    const missing = []

    for (const [key, config] of this.requiredPermissions) {
      if (!this.grantedPermissions.has(key)) {
        missing.push({
          key,
          config
        })
      }
    }

    return missing
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      monitoring: this.state.monitoring,
      config: this.config,
      permissionsConfigured: this.requiredPermissions.size,
      permissionsGranted: this.grantedPermissions.size,
      hasEssentialPermissions: this.hasEssentialPermissions(),
      missingPermissions: this.getMissingPermissions().length,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const hasEssential = this.hasEssentialPermissions()
    const grantedRatio = this.grantedPermissions.size / this.requiredPermissions.size

    return {
      service: 'PermissionManagementService',
      healthy: this.state.initialized && hasEssential,
      status: this.state.active ? 'active' : 'inactive',
      monitoring: this.state.monitoring,
      metrics: {
        permissionsGranted: this.stats.permissionsGranted,
        permissionsDenied: this.stats.permissionsDenied,
        permissionRequests: this.stats.permissionRequests,
        permissionChecks: this.stats.permissionChecks,
        grantedRatio: (grantedRatio * 100).toFixed(1) + '%',
        hasEssentialPermissions: hasEssential
      }
    }
  }
}

module.exports = PermissionManagementService
