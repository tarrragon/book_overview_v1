/**
 * @fileoverview Platform Domain Coordinator - 平台管理領域協調器
 * @version v2.0.0 (v1.0 重構版)
 * @since 2025-08-14
 *
 * 負責功能：
 * - Readmoo 平台檢測與識別協調
 * - 平台適配器生命週期管理 (僅 Readmoo)
 * - 平台狀態管理與監控
 * - 為未來多平台擴展保留架構彈性
 *
 * 設計考量：
 * - v1.0 階段專注 Readmoo 平台實作
 * - 架構設計保留多平台擴展能力
 * - 事件驅動架構整合
 * - 單一平台高效能協調
 *
 * 處理流程：
 * 1. 初始化 Readmoo 平台管理服務
 * 2. 協調平台檢測與註冊
 * 3. 管理適配器工廠（僅 Readmoo）
 * 4. 監控平台服務健康狀態
 * 5. 為未來多平台保留事件路由接口
 *
 * 使用情境：
 * - Background Service Worker 初始化時建立協調器
 * - 處理 Readmoo 平台操作和資料管理
 * - 管理平台狀態和適配器載入
 *
 * **v1.0 暫時擁擱置的功能**:
 * - crossPlatformRouter: 跨平台路由邏輯 (已標記為擱置)
 * - platformIsolation: 平台隔離機制 (v1.0 單平台不需要)
 * - 多平台切換與同步 (保留架構但不實作)
 */

const BaseModule = require('../../lifecycle/base-module.js')
const { createLogger } = require('../../../core/logging/Logger')

class PlatformDomainCoordinator extends BaseModule {
  /**
   * 初始化平台領域協調器
   * @param {EventBus} eventBus - 事件總線實例
   * @param {Object} dependencies - 依賴注入物件
   */
  constructor (eventBus, dependencies = {}) {
    super('PlatformDomainCoordinator')

    this.eventBus = eventBus
    this.logger = dependencies.logger || createLogger('PlatformDomainCoordinator')
    this.config = dependencies.config || {}

    // 平台管理服務實例
    this.services = {
      platformDetection: null,
      platformRegistry: null,
      platformSwitcher: null,
      adapterFactory: null,
      crossPlatformRouter: null,
      platformIsolation: null
    }

    // 平台狀態管理
    this.platformStates = new Map()
    this.activePlatforms = new Set()
    this.currentPlatform = null

    // 配置管理 - v1.0 僅支援 Readmoo
    this.supportedPlatforms = [
      'READMOO'
      // 未來擴展: 'KINDLE', 'KOBO', 'BOOKWALKER', 'BOOKS_COM'
    ]

    // 協調器狀態
    this.isInitialized = false
    this.isCoordinating = false
  }

  /**
   * 初始化協調器和所有服務
   */
  async initialize () {
    try {
      await this.log('開始初始化 Platform Domain Coordinator')

      // 初始化所有平台管理服務
      await this.initializePlatformServices()

      // 註冊事件監聽器
      await this.registerEventListeners()

      // 啟動平台檢測
      await this.startPlatformDetection()

      this.isInitialized = true
      await this.log('Platform Domain Coordinator 初始化完成')

      // 發送初始化完成事件
      await this.emitEvent('PLATFORM.COORDINATOR.INITIALIZED', {
        supportedPlatforms: this.supportedPlatforms,
        servicesReady: Object.keys(this.services).length,
        timestamp: Date.now()
      })
    } catch (error) {
      await this.logError('Platform Domain Coordinator 初始化失敗', error)
      throw error
    }
  }

  /**
   * 初始化 v1.0 平台管理服務 (僅 Readmoo)
   */
  async initializePlatformServices () {
    const PlatformDetectionService = require('./services/platform-detection-service.js')
    const PlatformRegistryService = require('./services/platform-registry-service.js')
    const PlatformSwitcherService = require('./services/platform-switcher-service.js')
    const AdapterFactoryService = require('./services/adapter-factory-service.js')

    // v1.0 暫時擱置的服務 - 保留架構但不實例化
    // const CrossPlatformRouter = require('./services/cross-platform-router.js')
    // const PlatformIsolationService = require('./services/platform-isolation-service.js')

    // 建立服務依賴注入物件
    const serviceConfig = {
      eventBus: this.eventBus,
      logger: this.logger,
      config: this.config.platformServices || {},
      supportedPlatforms: this.supportedPlatforms // 僅 Readmoo
    }

    // 初始化 v1.0 核心服務（按依賴順序）
    this.services.platformDetection = new PlatformDetectionService(
      this.eventBus, serviceConfig
    )

    this.services.platformRegistry = new PlatformRegistryService(
      this.eventBus, serviceConfig
    )

    this.services.adapterFactory = new AdapterFactoryService(
      this.eventBus, { ...serviceConfig, registry: this.services.platformRegistry }
    )

    this.services.platformSwitcher = new PlatformSwitcherService(
      this.eventBus, {
        ...serviceConfig,
        registry: this.services.platformRegistry,
        adapterFactory: this.services.adapterFactory
      }
    )

    // v1.0 暫時擱置的服務設為 null
    this.services.crossPlatformRouter = null // 擱置: 跨平台路由
    this.services.platformIsolation = null // 擱置: 平台隔離

    // 初始化已實作的服務
    for (const [serviceName, service] of Object.entries(this.services)) {
      if (service && typeof service.initialize === 'function') {
        await service.initialize()
        await this.log(`${serviceName} 服務初始化完成`)
      } else if (service === null) {
        await this.log(`${serviceName} 服務暫時擱置 (v1.0 不需要)`)
      }
    }

    await this.log('v1.0 平台服務初始化完成 - 專注 Readmoo 平台')
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners () {
    // 平台檢測事件
    this.eventBus.on('PLATFORM.DETECTION.COMPLETED',
      this.handlePlatformDetected.bind(this))

    // 平台切換事件
    this.eventBus.on('PLATFORM.SWITCH.REQUESTED',
      this.handlePlatformSwitchRequest.bind(this))

    // 跨平台協調事件
    this.eventBus.on('PLATFORM.CROSS_PLATFORM.COORDINATION.REQUESTED',
      this.handleCrossPlatformCoordination.bind(this))

    // 平台錯誤事件
    this.eventBus.on('PLATFORM.ERROR.OCCURRED',
      this.handlePlatformError.bind(this))

    // 系統事件
    this.eventBus.on('SYSTEM.SHUTDOWN.REQUESTED',
      this.handleSystemShutdown.bind(this))
  }

  /**
   * 啟動平台檢測
   */
  async startPlatformDetection () {
    if (this.services.platformDetection) {
      await this.services.platformDetection.startContinuousDetection()
      await this.log('平台檢測服務啟動')
    }
  }

  /**
   * 處理平台檢測完成事件
   * @param {Object} event - 平台檢測事件
   */
  async handlePlatformDetected (event) {
    try {
      const { platformId, confidence, context } = event.data || {}

      await this.log(`檢測到平台: ${platformId}, 信心度: ${confidence}`)

      // 更新平台狀態
      this.platformStates.set(platformId, {
        confidence,
        context,
        detectedAt: Date.now(),
        isActive: confidence > 0.8
      })

      // 如果是新的活躍平台
      if (confidence > 0.8 && !this.activePlatforms.has(platformId)) {
        await this.activatePlatform(platformId, context)
      }

      // 如果沒有當前平台，設定為當前平台
      if (!this.currentPlatform && confidence > 0.8) {
        await this.setCurrentPlatform(platformId)
      }
    } catch (error) {
      await this.logError('處理平台檢測事件失敗', error)
    }
  }

  /**
   * 啟動平台
   * @param {string} platformId - 平台標識符
   * @param {Object} context - 平台上下文
   */
  async activatePlatform (platformId, context) {
    try {
      // 註冊平台到註冊表
      if (this.services.platformRegistry) {
        await this.services.platformRegistry.registerPlatform(platformId, {
          context,
          activatedAt: Date.now()
        })
      }

      // 創建適配器
      if (this.services.adapterFactory) {
        const adapter = await this.services.adapterFactory.createAdapter(platformId)
        if (adapter) {
          await this.log(`${platformId} 適配器創建成功`)
        }
      }

      this.activePlatforms.add(platformId)

      // 發送平台啟動事件
      await this.emitEvent('PLATFORM.ACTIVATED', {
        platformId,
        context,
        activePlatforms: Array.from(this.activePlatforms),
        timestamp: Date.now()
      })
    } catch (error) {
      await this.logError(`啟動平台 ${platformId} 失敗`, error)
    }
  }

  /**
   * 設定當前平台
   * @param {string} platformId - 平台標識符
   */
  async setCurrentPlatform (platformId) {
    const previousPlatform = this.currentPlatform
    this.currentPlatform = platformId

    await this.log(`當前平台切換: ${previousPlatform} -> ${platformId}`)

    // 發送平台切換事件
    await this.emitEvent('PLATFORM.CURRENT.CHANGED', {
      previousPlatform,
      currentPlatform: platformId,
      timestamp: Date.now()
    })
  }

  /**
   * 處理平台切換請求
   * @param {Object} event - 平台切換請求事件
   */
  async handlePlatformSwitchRequest (event) {
    try {
      const { targetPlatform, options } = event.data || {}

      if (this.services.platformSwitcher) {
        const result = await this.services.platformSwitcher.switchToPlatform(
          targetPlatform, options
        )

        if (result.success) {
          await this.setCurrentPlatform(targetPlatform)
        }

        return result
      }
    } catch (error) {
      await this.logError('處理平台切換請求失敗', error)
      throw error
    }
  }

  /**
   * 處理跨平台協調請求 (v1.0 暫時擱置)
   * @param {Object} event - 跨平台協調事件
   */
  async handleCrossPlatformCoordination (event) {
    try {
      const { operation, platforms, options } = event.data || {}

      await this.log(`跨平台協調請求暫時擱置: ${operation}, 平台: ${platforms?.join(',') || '未指定'}`, 'warn')

      // v1.0 階段暫不支援跨平台協調
      if (this.services.crossPlatformRouter) {
        const result = await this.services.crossPlatformRouter.coordinateOperation(
          operation, platforms, options
        )
        return result
      } else {
        // 發送擱置通知事件
        await this.emitEvent('PLATFORM.CROSS_PLATFORM.COORDINATION.SHELVED', {
          operation,
          platforms,
          reason: 'V1_READMOO_ONLY',
          message: 'v1.0 階段僅支援 Readmoo 平台，跨平台功能暫時擱置',
          timestamp: Date.now()
        })

        return {
          success: false,
          reason: 'V1_READMOO_ONLY',
          message: '跨平台協調功能暫時擱置，v1.0 僅支援 Readmoo'
        }
      }
    } catch (error) {
      await this.logError('處理跨平台協調請求失敗', error)
      throw error
    }
  }

  /**
   * 處理平台錯誤
   * @param {Object} event - 平台錯誤事件
   */
  async handlePlatformError (event) {
    try {
      const { platformId, error, context } = event.data || {}

      await this.logError(`平台 ${platformId} 發生錯誤`, error)

      // 更新平台狀態
      if (this.platformStates.has(platformId)) {
        const state = this.platformStates.get(platformId)
        state.lastError = {
          error: error.message,
          timestamp: Date.now(),
          context
        }
        state.isActive = false
      }

      // 移除從活躍平台
      this.activePlatforms.delete(platformId)

      // 如果是當前平台，嘗試切換到其他平台
      if (this.currentPlatform === platformId) {
        await this.findAlternativePlatform()
      }
    } catch (err) {
      await this.logError('處理平台錯誤事件失敗', err)
    }
  }

  /**
   * 尋找替代平台
   */
  async findAlternativePlatform () {
    const activePlatforms = Array.from(this.activePlatforms)

    if (activePlatforms.length > 0) {
      // 選擇信心度最高的平台
      let bestPlatform = null
      let bestConfidence = 0

      for (const platformId of activePlatforms) {
        const state = this.platformStates.get(platformId)
        if (state && state.confidence > bestConfidence) {
          bestPlatform = platformId
          bestConfidence = state.confidence
        }
      }

      if (bestPlatform) {
        await this.setCurrentPlatform(bestPlatform)
      }
    } else {
      this.currentPlatform = null
      await this.log('無可用的替代平台')
    }
  }

  /**
   * 處理系統關閉
   * @param {Object} event - 系統關閉事件
   */
  async handleSystemShutdown (event) {
    await this.stop()
  }

  /**
   * 啟動協調器
   */
  async start () {
    if (!this.isInitialized) {
      await this.initialize()
    }

    this.isCoordinating = true
    await this.log('Platform Domain Coordinator 啟動')
  }

  /**
   * 停止協調器
   */
  async stop () {
    this.isCoordinating = false

    // 停止所有服務
    for (const [serviceName, service] of Object.entries(this.services)) {
      if (service && typeof service.stop === 'function') {
        try {
          await service.stop()
          await this.log(`${serviceName} 服務已停止`)
        } catch (error) {
          await this.logError(`停止 ${serviceName} 服務失敗`, error)
        }
      }
    }

    await this.log('Platform Domain Coordinator 已停止')
  }

  /**
   * 清理協調器資源
   */
  async cleanup () {
    // 清理平台狀態
    this.platformStates.clear()
    this.activePlatforms.clear()
    this.currentPlatform = null

    // 清理所有服務
    for (const [serviceName, service] of Object.entries(this.services)) {
      if (service && typeof service.cleanup === 'function') {
        try {
          await service.cleanup()
        } catch (error) {
          await this.logError(`清理 ${serviceName} 服務失敗`, error)
        }
      }
    }

    this.services = {}
    this.isInitialized = false

    await this.log('Platform Domain Coordinator 資源清理完成')
  }

  /**
   * 取得協調器健康狀態
   * @returns {Object} 健康狀態報告
   */
  getHealthStatus () {
    const serviceHealth = {}

    for (const [serviceName, service] of Object.entries(this.services)) {
      if (service && typeof service.getHealthStatus === 'function') {
        serviceHealth[serviceName] = service.getHealthStatus()
      } else {
        serviceHealth[serviceName] = { status: 'unknown' }
      }
    }

    return {
      coordinator: {
        status: this.isCoordinating ? 'active' : 'inactive',
        initialized: this.isInitialized,
        currentPlatform: this.currentPlatform,
        activePlatforms: Array.from(this.activePlatforms),
        supportedPlatforms: this.supportedPlatforms
      },
      services: serviceHealth,
      platformStates: Object.fromEntries(this.platformStates),
      timestamp: Date.now()
    }
  }

  /**
   * 取得平台統計資訊
   * @returns {Object} 平台統計
   */
  getPlatformStatistics () {
    return {
      totalSupportedPlatforms: this.supportedPlatforms.length,
      activePlatformsCount: this.activePlatforms.size,
      detectedPlatformsCount: this.platformStates.size,
      currentPlatform: this.currentPlatform,
      platformDetails: Array.from(this.platformStates.entries()).map(([id, state]) => ({
        platformId: id,
        confidence: state.confidence,
        isActive: state.isActive,
        detectedAt: state.detectedAt,
        lastError: state.lastError
      }))
    }
  }

  /**
   * 發送事件
   * @param {string} eventType - 事件類型
   * @param {Object} eventData - 事件資料
   */
  async emitEvent (eventType, eventData) {
    try {
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        await this.eventBus.emit(eventType, eventData)
      }
    } catch (error) {
      await this.logError(`發送事件 ${eventType} 失敗`, error)
    }
  }

  /**
   * 記錄日誌
   * @param {string} message - 日誌訊息
   */
  async log (message) {
    this.logger.info('PLATFORM_COORDINATOR_LOG', { message })
  }

  /**
   * 記錄錯誤日誌
   * @param {string} message - 錯誤訊息
   * @param {Error} error - 錯誤物件
   */
  async logError (message, error) {
    this.logger.error('PLATFORM_COORDINATOR_ERROR', { message, error: error?.message || error })
  }
}

module.exports = PlatformDomainCoordinator
