/**
 * Background Service Worker 模組協調器
 *
 * 負責功能：
 * - 協調所有 Background Service Worker 模組的生命週期
 * - 整合事件驅動架構和領域處理器
 * - 提供統一的模組管理和健康監控介面
 * - 實現模組間的依賴注入和協調機制
 *
 * 設計考量：
 * - 基於單一責任原則，將複雜的 background.js 重構為模組化架構
 * - 使用依賴注入模式實現模組間的鬆耦合
 * - 實現完整的生命週期管理（初始化、啟動、停止、清理）
 * - 整合多語言支援和錯誤處理機制
 *
 * 處理流程：
 * 1. 初始化核心依賴（事件系統、i18n、常數管理）
 * 2. 建立所有功能模組並注入依賴
 * 3. 按照相依順序初始化所有模組
 * 4. 啟動所有模組並開始服務
 * 5. 提供健康監控和診斷功能
 */

// 導入基礎模組
const BaseModule = require('./lifecycle/base-module')

// 導入核心系統模組
const LifecycleCoordinator = require('./lifecycle/lifecycle-coordinator')
const MessageRouter = require('./messaging/message-router')
const EventCoordinator = require('./events/event-coordinator')
const PageMonitor = require('./monitoring/page-monitor')
const ErrorHandler = require('./monitoring/error-handler')

// 導入領域協調器
const SystemDomainCoordinator = require('./domains/system/system-domain-coordinator')
const PageDomainCoordinator = require('./domains/page/page-domain-coordinator')
const ExtractionDomainCoordinator = require('./domains/extraction/extraction-domain-coordinator')
const MessagingDomainCoordinator = require('./domains/messaging/messaging-domain-coordinator')

// 導入支援服務
const I18nManager = require('./i18n/i18n-manager')

/**
 * Background Service Worker 主協調器
 *
 * 負責功能：
 * - 統一管理所有 Background 模組的生命週期
 * - 提供模組間的依賴注入和協調機制
 * - 實現完整的初始化、啟動、停止、清理流程
 * - 整合健康監控和錯誤處理系統
 *
 * 設計考量：
 * - 繼承 BaseModule 實現標準生命週期管理
 * - 使用依賴注入模式實現模組間鬆耦合
 * - 按照依賴關係順序管理模組初始化
 * - 提供統一的錯誤處理和監控介面
 */
class BackgroundCoordinator extends BaseModule {
  constructor () {
    super()
    this.moduleName = 'BackgroundCoordinator'

    // 核心依賴
    this.i18nManager = null
    this.eventCoordinator = null

    // 功能模組
    this.lifecycleCoordinator = null
    this.messageRouter = null
    this.pageMonitor = null
    this.errorHandler = null

    // 領域協調器
    this.systemDomainCoordinator = null
    this.pageDomainCoordinator = null
    this.extractionDomainCoordinator = null
    this.messagingDomainCoordinator = null

    // 模組管理
    this.modules = new Map()
    this.moduleLoadOrder = []
    this.moduleStartOrder = []

    // 協調狀態
    this.coordinatorReady = false
    this.allModulesReady = false
    this.initializationStartTime = null

    // 統計資料
    this.coordinatorStats = {
      modulesLoaded: 0,
      modulesInitialized: 0,
      modulesStarted: 0,
      initializationDuration: 0,
      startupDuration: 0,
      restartCount: 0
    }
  }

  /**
   * 初始化協調器
   * @returns {Promise<void>}
   * @protected
   */
  async _doInitialize () {
    this.initializationStartTime = Date.now()
    this.logger.log('🚀 開始初始化 Background Service Worker 協調器')

    try {
      // 1. 初始化核心依賴
      await this.initializeCoreDependencies()

      // 2. 建立所有功能模組
      await this.createFunctionalModules()

      // 3. 建立所有領域協調器
      await this.createDomainCoordinators()

      // 4. 註冊模組到監控系統
      await this.registerModulesForMonitoring()

      // 5. 按順序初始化所有模組
      await this.initializeAllModules()

      this.coordinatorStats.initializationDuration = Date.now() - this.initializationStartTime
      this.coordinatorReady = true

      this.logger.log('✅ Background Service Worker 協調器初始化完成')
      this.logInitializationSummary()
    } catch (error) {
      this.logger.error('❌ 協調器初始化失敗:', error)
      throw error
    }
  }

  /**
   * 啟動協調器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStart () {
    const startTime = Date.now()
    this.logger.log('▶️ 啟動 Background Service Worker 協調器')

    try {
      // 按順序啟動所有模組
      await this.startAllModules()

      // 驗證所有模組狀態
      await this.verifyAllModulesHealthy()

      this.coordinatorStats.startupDuration = Date.now() - startTime
      this.allModulesReady = true

      this.logger.log('✅ Background Service Worker 協調器啟動完成')
      this.logStartupSummary()

      // 觸發系統就緒事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.READY', {
          timestamp: Date.now(),
          modules: Array.from(this.modules.keys()),
          stats: this.coordinatorStats
        })
      }
    } catch (error) {
      this.logger.error('❌ 協調器啟動失敗:', error)
      throw error
    }
  }

  /**
   * 停止協調器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStop () {
    this.logger.log('⏹️ 停止 Background Service Worker 協調器')

    try {
      // 反序停止所有模組
      await this.stopAllModules()

      // 重設狀態
      this.coordinatorReady = false
      this.allModulesReady = false

      this.logger.log('✅ Background Service Worker 協調器停止完成')
    } catch (error) {
      this.logger.error('❌ 協調器停止失敗:', error)
    }
  }

  /**
   * 初始化核心依賴
   * @returns {Promise<void>}
   * @private
   */
  async initializeCoreDependencies () {
    try {
      this.logger.log('🔧 初始化核心依賴')

      // 1. 初始化多語言管理器
      this.i18nManager = new I18nManager()
      await this.i18nManager.initialize()

      // 2. 初始化事件協調器
      this.eventCoordinator = new EventCoordinator({
        logger: this.logger,
        i18nManager: this.i18nManager
      })
      await this.eventCoordinator.initialize()

      // 3. 設定全域事件總線引用
      this.eventBus = this.eventCoordinator.getEventBus()

      this.logger.log('✅ 核心依賴初始化完成')
    } catch (error) {
      this.logger.error('❌ 核心依賴初始化失敗:', error)
      throw error
    }
  }

  /**
   * 建立功能模組
   * @returns {Promise<void>}
   * @private
   */
  async createFunctionalModules () {
    try {
      this.logger.log('🏗️ 建立功能模組')

      const commonDependencies = {
        eventBus: this.eventBus,
        logger: this.logger,
        i18nManager: this.i18nManager
      }

      // 建立生命週期協調器
      this.lifecycleCoordinator = new LifecycleCoordinator(commonDependencies)
      this.modules.set('lifecycleCoordinator', this.lifecycleCoordinator)

      // 建立訊息路由器
      this.messageRouter = new MessageRouter(commonDependencies)
      this.modules.set('messageRouter', this.messageRouter)

      // 建立頁面監控器
      this.pageMonitor = new PageMonitor(commonDependencies)
      this.modules.set('pageMonitor', this.pageMonitor)

      // 建立錯誤處理器
      this.errorHandler = new ErrorHandler(commonDependencies)
      this.modules.set('errorHandler', this.errorHandler)

      // 設定模組載入順序（依賴關係由低到高）
      this.moduleLoadOrder = [
        'lifecycleCoordinator',
        'messageRouter',
        'pageMonitor',
        'errorHandler'
      ]

      this.coordinatorStats.modulesLoaded = this.modules.size
      this.logger.log(`✅ 功能模組建立完成 (${this.modules.size} 個模組)`)
    } catch (error) {
      this.logger.error('❌ 功能模組建立失敗:', error)
      throw error
    }
  }

  /**
   * 建立領域協調器
   * @returns {Promise<void>}
   * @private
   */
  async createDomainCoordinators () {
    try {
      this.logger.log('🎭 建立領域協調器')

      const commonDependencies = {
        eventBus: this.eventBus,
        logger: this.logger,
        i18nManager: this.i18nManager
      }

      // 建立系統領域協調器
      this.systemDomainCoordinator = new SystemDomainCoordinator(commonDependencies)
      this.modules.set('systemDomainCoordinator', this.systemDomainCoordinator)

      // 建立頁面領域協調器
      this.pageDomainCoordinator = new PageDomainCoordinator(commonDependencies)
      this.modules.set('pageDomainCoordinator', this.pageDomainCoordinator)

      // 建立提取領域協調器
      this.extractionDomainCoordinator = new ExtractionDomainCoordinator(commonDependencies)
      this.modules.set('extractionDomainCoordinator', this.extractionDomainCoordinator)

      // 建立通訊領域協調器
      this.messagingDomainCoordinator = new MessagingDomainCoordinator(commonDependencies)
      this.modules.set('messagingDomainCoordinator', this.messagingDomainCoordinator)

      // 更新總模組數量
      this.coordinatorStats.modulesLoaded = this.modules.size
      this.logger.log(`✅ 領域協調器建立完成 (總共 ${this.modules.size} 個模組)`)
    } catch (error) {
      this.logger.error('❌ 領域協調器建立失敗:', error)
      throw error
    }
  }

  /**
   * 註冊模組到監控系統
   * @returns {Promise<void>}
   * @private
   */
  async registerModulesForMonitoring () {
    try {
      this.logger.log('📊 註冊模組到監控系統')

      // 註冊所有模組到錯誤處理器進行健康監控
      for (const [moduleName, module] of this.modules) {
        if (moduleName !== 'errorHandler') {
          this.errorHandler.registerModuleForMonitoring(moduleName, module)
        }
      }

      // 註冊協調器自身
      this.errorHandler.registerModuleForMonitoring('backgroundCoordinator', this)

      this.logger.log('✅ 模組監控註冊完成')
    } catch (error) {
      this.logger.error('❌ 模組監控註冊失敗:', error)
      throw error
    }
  }

  /**
   * 初始化所有模組
   * @returns {Promise<void>}
   * @private
   */
  async initializeAllModules () {
    try {
      this.logger.log('🔧 開始初始化所有模組')

      // 先初始化功能模組（按載入順序）
      for (const moduleName of this.moduleLoadOrder) {
        const module = this.modules.get(moduleName)
        if (module) {
          this.logger.log(`🔧 初始化模組: ${moduleName}`)
          await module.initialize()
          this.coordinatorStats.modulesInitialized++
        }
      }

      // 再初始化領域協調器
      const domainCoordinators = [
        'systemDomainCoordinator',
        'pageDomainCoordinator',
        'extractionDomainCoordinator',
        'messagingDomainCoordinator'
      ]

      for (const domainName of domainCoordinators) {
        const domain = this.modules.get(domainName)
        if (domain) {
          this.logger.log(`🎭 初始化領域協調器: ${domainName}`)
          await domain.initialize()
          this.coordinatorStats.modulesInitialized++
        }
      }

      this.logger.log(`✅ 所有模組初始化完成 (${this.coordinatorStats.modulesInitialized}/${this.modules.size})`)
    } catch (error) {
      this.logger.error('❌ 模組初始化失敗:', error)
      throw error
    }
  }

  /**
   * 啟動所有模組
   * @returns {Promise<void>}
   * @private
   */
  async startAllModules () {
    try {
      this.logger.log('▶️ 開始啟動所有模組')

      // 啟動順序：核心模組 -> 功能模組 -> 領域處理器
      const startupOrder = [
        // 核心基礎設施
        'lifecycleCoordinator',
        'messageRouter',

        // 監控和錯誤處理
        'errorHandler',
        'pageMonitor',

        // 領域協調器
        'systemDomainCoordinator',
        'pageDomainCoordinator',
        'extractionDomainCoordinator',
        'messagingDomainCoordinator'
      ]

      this.moduleStartOrder = startupOrder

      for (const moduleName of startupOrder) {
        const module = this.modules.get(moduleName)
        if (module) {
          this.logger.log(`▶️ 啟動模組: ${moduleName}`)
          await module.start()
          this.coordinatorStats.modulesStarted++
        }
      }

      this.logger.log(`✅ 所有模組啟動完成 (${this.coordinatorStats.modulesStarted}/${this.modules.size})`)
    } catch (error) {
      this.logger.error('❌ 模組啟動失敗:', error)
      throw error
    }
  }

  /**
   * 停止所有模組
   * @returns {Promise<void>}
   * @private
   */
  async stopAllModules () {
    try {
      this.logger.log('⏹️ 開始停止所有模組')

      // 反序停止（與啟動順序相反）
      const stopOrder = [...this.moduleStartOrder].reverse()

      for (const moduleName of stopOrder) {
        const module = this.modules.get(moduleName)
        if (module && typeof module.stop === 'function') {
          try {
            this.logger.log(`⏹️ 停止模組: ${moduleName}`)
            await module.stop()
          } catch (error) {
            this.logger.error(`❌ 停止模組失敗: ${moduleName}`, error)
          }
        }
      }

      this.logger.log('✅ 所有模組停止完成')
    } catch (error) {
      this.logger.error('❌ 模組停止失敗:', error)
    }
  }

  /**
   * 驗證所有模組健康狀態
   * @returns {Promise<void>}
   * @private
   */
  async verifyAllModulesHealthy () {
    try {
      this.logger.log('🔍 驗證模組健康狀態')

      const healthReport = this.errorHandler.getSystemStatusReport()

      if (healthReport.overallHealth !== 'healthy') {
        this.logger.warn('⚠️ 檢測到不健康的模組:', healthReport)
      } else {
        this.logger.log('✅ 所有模組狀態健康')
      }
    } catch (error) {
      this.logger.error('❌ 健康狀態驗證失敗:', error)
    }
  }

  /**
   * 記錄初始化摘要
   * @private
   */
  logInitializationSummary () {
    const summary = {
      模組總數: this.modules.size,
      初始化完成: this.coordinatorStats.modulesInitialized,
      初始化時間: `${this.coordinatorStats.initializationDuration}ms`,
      模組列表: Array.from(this.modules.keys())
    }

    this.logger.log('📊 初始化摘要:', summary)
  }

  /**
   * 記錄啟動摘要
   * @private
   */
  logStartupSummary () {
    const summary = {
      啟動完成: this.coordinatorStats.modulesStarted,
      啟動時間: `${this.coordinatorStats.startupDuration}ms`,
      總耗時: `${this.coordinatorStats.initializationDuration + this.coordinatorStats.startupDuration}ms`,
      系統狀態: '就緒'
    }

    this.logger.log('📊 啟動摘要:', summary)
  }

  /**
   * 重啟協調器
   * @returns {Promise<void>}
   */
  async restart () {
    try {
      this.logger.log('🔄 重啟 Background Service Worker 協調器')

      this.coordinatorStats.restartCount++

      // 停止所有模組
      await this.stop()

      // 短暫延遲後重新啟動
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 重新初始化和啟動
      await this.initialize()
      await this.start()

      this.logger.log('✅ Background Service Worker 協調器重啟完成')
    } catch (error) {
      this.logger.error('❌ 協調器重啟失敗:', error)
      throw error
    }
  }

  /**
   * 獲取特定模組實例
   * @param {string} moduleName - 模組名稱
   * @returns {Object|null} 模組實例
   */
  getModule (moduleName) {
    return this.modules.get(moduleName) || null
  }

  /**
   * 獲取所有模組狀態
   * @returns {Object} 模組狀態報告
   */
  getAllModuleStatuses () {
    const statuses = {}

    for (const [moduleName, module] of this.modules) {
      statuses[moduleName] = {
        isHealthy: typeof module.isHealthy === 'function' ? module.isHealthy() : true,
        healthStatus: typeof module._getCustomHealthStatus === 'function'
          ? module._getCustomHealthStatus()
          : { health: 'unknown' },
        isReady: typeof module.isReady === 'function' ? module.isReady() : true
      }
    }

    return {
      coordinatorReady: this.coordinatorReady,
      allModulesReady: this.allModulesReady,
      modules: statuses,
      stats: this.coordinatorStats
    }
  }

  /**
   * 獲取協調器統計資料
   * @returns {Object} 統計資料
   */
  getCoordinatorStats () {
    return {
      ...this.coordinatorStats,
      uptime: Date.now() - (this.initializationStartTime || Date.now()),
      coordinatorReady: this.coordinatorReady,
      allModulesReady: this.allModulesReady,
      moduleCount: this.modules.size
    }
  }

  /**
   * 生成綜合診斷報告
   * @returns {Object} 診斷報告
   */
  generateDiagnosticReport () {
    return {
      coordinator: this.getCoordinatorStats(),
      modules: this.getAllModuleStatuses(),
      systemHealth: this.errorHandler ? this.errorHandler.getSystemStatusReport() : null,
      errorStats: this.errorHandler ? this.errorHandler.getHandlingStats() : null,
      timestamp: Date.now()
    }
  }

  /**
   * 取得自訂健康狀態
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus () {
    const moduleHealthCount = {
      healthy: 0,
      degraded: 0,
      unknown: 0
    }

    // 統計各模組健康狀態
    for (const [, module] of this.modules) {
      if (typeof module._getCustomHealthStatus === 'function') {
        const status = module._getCustomHealthStatus()
        const health = status.health || 'unknown'
        moduleHealthCount[health] = (moduleHealthCount[health] || 0) + 1
      } else {
        moduleHealthCount.unknown++
      }
    }

    // 計算整體健康狀態
    const totalModules = this.modules.size
    const healthyPercentage = moduleHealthCount.healthy / totalModules

    let overallHealth = 'healthy'
    if (healthyPercentage < 0.8) {
      overallHealth = 'degraded'
    }
    if (!this.coordinatorReady || !this.allModulesReady) {
      overallHealth = 'degraded'
    }

    return {
      coordinatorReady: this.coordinatorReady,
      allModulesReady: this.allModulesReady,
      totalModules,
      healthyModules: moduleHealthCount.healthy,
      degradedModules: moduleHealthCount.degraded,
      unknownModules: moduleHealthCount.unknown,
      healthyPercentage: (healthyPercentage * 100).toFixed(1) + '%',
      health: overallHealth
    }
  }
}

module.exports = BackgroundCoordinator
