/**
 * Extraction Domain 協調器
 * 
 * 負責功能：
 * - 協調所有 Extraction Domain 微服務的生命週期管理
 * - 整合資料處理、驗證、匯出、狀態管理和品質控制服務
 * - 提供統一的 Extraction Domain 介面和協調機制
 * - 實現依賴注入和服務間通訊協調
 * 
 * 設計考量：
 * - 基於微服務架構，每個服務都有明確的單一責任
 * - 使用依賴注入模式實現鬆耦合的服務整合
 * - 提供完整的生命週期管理（初始化、啟動、停止、清理）
 * - 實現事件驅動的服務間通訊協調
 * 
 * 處理流程：
 * 1. 初始化所有 Extraction 微服務並注入依賴
 * 2. 按照依賴順序啟動所有微服務
 * 3. 協調服務間的事件通訊和資料流
 * 4. 提供統一的健康監控和診斷介面
 * 5. 實現優雅的服務停止和清理機制
 */

const BaseModule = require('../../lifecycle/base-module')

// 導入所有 Extraction Domain 微服務
const DataProcessingService = require('./services/data-processing-service')
const ValidationService = require('./services/validation-service')
const ExportService = require('./services/export-service')
const ExtractionStateService = require('./services/extraction-state-service')
const QualityControlService = require('./services/quality-control-service')

/**
 * Extraction Domain 協調器
 * 
 * 負責功能：
 * - 管理 5 個 Extraction 微服務的完整生命週期
 * - 協調資料提取、處理、驗證、匯出和品質控制流程
 * - 提供統一的 Extraction Domain 服務介面
 * - 實現微服務間的依賴注入和事件協調
 * 
 * 設計考量：
 * - 繼承 BaseModule 實現標準生命週期管理
 * - 每個微服務都專注於單一責任領域
 * - 使用事件驅動架構實現服務間解耦
 * - 提供完整的健康監控和錯誤處理機制
 */
class ExtractionDomainCoordinator extends BaseModule {
  constructor(dependencies = {}) {
    super()
    this.moduleName = 'ExtractionDomainCoordinator'
    
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null
    
    // Extraction Domain 微服務
    this.dataProcessingService = null
    this.validationService = null
    this.exportService = null
    this.extractionStateService = null
    this.qualityControlService = null
    
    // 服務管理
    this.services = new Map()
    this.serviceLoadOrder = []
    this.serviceStartOrder = []
    
    // 協調狀態
    this.coordinatorReady = false
    this.allServicesReady = false
    this.initializationStartTime = null
    
    // 統計資料
    this.coordinatorStats = {
      servicesLoaded: 0,
      servicesInitialized: 0,
      servicesStarted: 0,
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
  async _doInitialize() {
    this.initializationStartTime = Date.now()
    this.logger.log('🏗️ 開始初始化 Extraction Domain 協調器')

    try {
      // 1. 建立所有微服務
      await this.createExtractionServices()
      
      // 2. 建立服務載入和啟動順序
      this.defineServiceOrders()
      
      // 3. 按順序初始化所有微服務
      await this.initializeAllServices()
      
      this.coordinatorStats.initializationDuration = Date.now() - this.initializationStartTime
      this.coordinatorReady = true
      
      this.logger.log('✅ Extraction Domain 協調器初始化完成')
      this.logInitializationSummary()
      
      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.DOMAIN.INITIALIZED', {
          coordinatorName: 'ExtractionDomainCoordinator',
          servicesCount: this.services.size
        })
      }
    } catch (error) {
      this.logger.error('❌ Extraction Domain 協調器初始化失敗:', error)
      throw error
    }
  }

  /**
   * 啟動協調器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStart() {
    const startTime = Date.now()
    this.logger.log('▶️ 啟動 Extraction Domain 協調器')

    try {
      // 按順序啟動所有微服務
      await this.startAllServices()
      
      // 驗證所有服務健康狀態
      await this.verifyAllServicesHealthy()
      
      this.coordinatorStats.startupDuration = Date.now() - startTime
      this.allServicesReady = true
      
      this.logger.log('✅ Extraction Domain 協調器啟動完成')
      this.logStartupSummary()
      
      // 觸發領域就緒事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.DOMAIN.READY', {
          timestamp: Date.now(),
          services: Array.from(this.services.keys()),
          stats: this.coordinatorStats
        })
      }
    } catch (error) {
      this.logger.error('❌ Extraction Domain 協調器啟動失敗:', error)
      throw error
    }
  }

  /**
   * 停止協調器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStop() {
    this.logger.log('⏹️ 停止 Extraction Domain 協調器')

    try {
      // 反序停止所有微服務
      await this.stopAllServices()
      
      // 重設狀態
      this.coordinatorReady = false
      this.allServicesReady = false
      
      this.logger.log('✅ Extraction Domain 協調器停止完成')
      
      // 發送停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.DOMAIN.STOPPED', {
          coordinatorName: 'ExtractionDomainCoordinator',
          finalStats: { ...this.coordinatorStats }
        })
      }
    } catch (error) {
      this.logger.error('❌ Extraction Domain 協調器停止失敗:', error)
    }
  }

  /**
   * 建立所有 Extraction 微服務
   * @returns {Promise<void>}
   * @private
   */
  async createExtractionServices() {
    try {
      this.logger.log('🔧 建立 Extraction Domain 微服務')
      
      const commonDependencies = {
        eventBus: this.eventBus,
        logger: this.logger,
        i18nManager: this.i18nManager
      }
      
      // 建立資料處理服務
      this.dataProcessingService = new DataProcessingService(commonDependencies)
      this.services.set('dataProcessingService', this.dataProcessingService)
      
      // 建立驗證服務
      this.validationService = new ValidationService(commonDependencies)
      this.services.set('validationService', this.validationService)
      
      // 建立匯出服務
      this.exportService = new ExportService(commonDependencies)
      this.services.set('exportService', this.exportService)
      
      // 建立提取狀態服務
      this.extractionStateService = new ExtractionStateService(commonDependencies)
      this.services.set('extractionStateService', this.extractionStateService)
      
      // 建立品質控制服務
      this.qualityControlService = new QualityControlService(commonDependencies)
      this.services.set('qualityControlService', this.qualityControlService)
      
      this.coordinatorStats.servicesLoaded = this.services.size
      this.logger.log(`✅ Extraction 微服務建立完成 (${this.services.size} 個服務)`)
    } catch (error) {
      this.logger.error('❌ Extraction 微服務建立失敗:', error)
      throw error
    }
  }

  /**
   * 定義服務順序
   * @private
   */
  defineServiceOrders() {
    // 載入順序（依賴關係由低到高）
    this.serviceLoadOrder = [
      'dataProcessingService',     // 基礎資料處理
      'validationService',         // 資料驗證
      'exportService',             // 資料匯出
      'extractionStateService',    // 狀態管理
      'qualityControlService'      // 品質控制
    ]
    
    // 啟動順序（確保依賴服務先啟動）
    this.serviceStartOrder = [
      'dataProcessingService',     // 資料處理服務先啟動
      'validationService',         // 驗證服務
      'extractionStateService',    // 狀態管理服務
      'exportService',             // 匯出服務
      'qualityControlService'      // 品質控制服務最後啟動
    ]
    
    this.logger.log('✅ 服務順序定義完成')
  }

  /**
   * 初始化所有微服務
   * @returns {Promise<void>}
   * @private
   */
  async initializeAllServices() {
    try {
      this.logger.log('🔧 開始初始化所有 Extraction 微服務')
      
      for (const serviceName of this.serviceLoadOrder) {
        const service = this.services.get(serviceName)
        if (service) {
          this.logger.log(`🔧 初始化微服務: ${serviceName}`)
          await service.initialize()
          this.coordinatorStats.servicesInitialized++
        }
      }
      
      this.logger.log(`✅ 所有微服務初始化完成 (${this.coordinatorStats.servicesInitialized}/${this.services.size})`)
    } catch (error) {
      this.logger.error('❌ 微服務初始化失敗:', error)
      throw error
    }
  }

  /**
   * 啟動所有微服務
   * @returns {Promise<void>}
   * @private
   */
  async startAllServices() {
    try {
      this.logger.log('▶️ 開始啟動所有 Extraction 微服務')
      
      for (const serviceName of this.serviceStartOrder) {
        const service = this.services.get(serviceName)
        if (service) {
          this.logger.log(`▶️ 啟動微服務: ${serviceName}`)
          await service.start()
          this.coordinatorStats.servicesStarted++
        }
      }
      
      this.logger.log(`✅ 所有微服務啟動完成 (${this.coordinatorStats.servicesStarted}/${this.services.size})`)
    } catch (error) {
      this.logger.error('❌ 微服務啟動失敗:', error)
      throw error
    }
  }

  /**
   * 停止所有微服務
   * @returns {Promise<void>}
   * @private
   */
  async stopAllServices() {
    try {
      this.logger.log('⏹️ 開始停止所有 Extraction 微服務')
      
      // 反序停止（與啟動順序相反）
      const stopOrder = [...this.serviceStartOrder].reverse()
      
      for (const serviceName of stopOrder) {
        const service = this.services.get(serviceName)
        if (service && typeof service.stop === 'function') {
          try {
            this.logger.log(`⏹️ 停止微服務: ${serviceName}`)
            await service.stop()
          } catch (error) {
            this.logger.error(`❌ 停止微服務失敗: ${serviceName}`, error)
          }
        }
      }
      
      this.logger.log('✅ 所有微服務停止完成')
    } catch (error) {
      this.logger.error('❌ 微服務停止失敗:', error)
    }
  }

  /**
   * 驗證所有服務健康狀態
   * @returns {Promise<void>}
   * @private
   */
  async verifyAllServicesHealthy() {
    try {
      this.logger.log('🔍 驗證 Extraction 微服務健康狀態')
      
      const healthStatuses = []
      
      for (const [serviceName, service] of this.services) {
        if (typeof service.getHealthStatus === 'function') {
          const healthStatus = service.getHealthStatus()
          healthStatuses.push({
            serviceName,
            healthy: healthStatus.healthy,
            status: healthStatus.status
          })
          
          if (!healthStatus.healthy) {
            this.logger.warn(`⚠️ 微服務健康狀態異常: ${serviceName}`, healthStatus)
          }
        }
      }
      
      const unhealthyServices = healthStatuses.filter(status => !status.healthy)
      
      if (unhealthyServices.length > 0) {
        this.logger.warn(`⚠️ 檢測到 ${unhealthyServices.length} 個不健康的微服務`)
      } else {
        this.logger.log('✅ 所有 Extraction 微服務狀態健康')
      }
    } catch (error) {
      this.logger.error('❌ 健康狀態驗證失敗:', error)
    }
  }

  /**
   * 記錄初始化摘要
   * @private
   */
  logInitializationSummary() {
    const summary = {
      微服務總數: this.services.size,
      初始化完成: this.coordinatorStats.servicesInitialized,
      初始化時間: `${this.coordinatorStats.initializationDuration}ms`,
      微服務列表: Array.from(this.services.keys())
    }
    
    this.logger.log('📊 Extraction Domain 初始化摘要:', summary)
  }

  /**
   * 記錄啟動摘要
   * @private
   */
  logStartupSummary() {
    const summary = {
      啟動完成: this.coordinatorStats.servicesStarted,
      啟動時間: `${this.coordinatorStats.startupDuration}ms`,
      總耗時: `${this.coordinatorStats.initializationDuration + this.coordinatorStats.startupDuration}ms`,
      領域狀態: '就緒'
    }
    
    this.logger.log('📊 Extraction Domain 啟動摘要:', summary)
  }

  /**
   * 重啟協調器
   * @returns {Promise<void>}
   */
  async restart() {
    try {
      this.logger.log('🔄 重啟 Extraction Domain 協調器')
      
      this.coordinatorStats.restartCount++
      
      // 停止所有微服務
      await this.stop()
      
      // 短暫延遲後重新啟動
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 重新初始化和啟動
      await this.initialize()
      await this.start()
      
      this.logger.log('✅ Extraction Domain 協調器重啟完成')
    } catch (error) {
      this.logger.error('❌ 協調器重啟失敗:', error)
      throw error
    }
  }

  /**
   * 獲取特定微服務實例
   * @param {string} serviceName - 微服務名稱
   * @returns {Object|null} 微服務實例
   */
  getService(serviceName) {
    return this.services.get(serviceName) || null
  }

  /**
   * 獲取資料處理服務
   * @returns {DataProcessingService} 資料處理服務實例
   */
  getDataProcessingService() {
    return this.dataProcessingService
  }

  /**
   * 獲取驗證服務
   * @returns {ValidationService} 驗證服務實例
   */
  getValidationService() {
    return this.validationService
  }

  /**
   * 獲取匯出服務
   * @returns {ExportService} 匯出服務實例
   */
  getExportService() {
    return this.exportService
  }

  /**
   * 獲取提取狀態服務
   * @returns {ExtractionStateService} 提取狀態服務實例
   */
  getExtractionStateService() {
    return this.extractionStateService
  }

  /**
   * 獲取品質控制服務
   * @returns {QualityControlService} 品質控制服務實例
   */
  getQualityControlService() {
    return this.qualityControlService
  }

  /**
   * 獲取所有微服務狀態
   * @returns {Object} 微服務狀態報告
   */
  getAllServiceStatuses() {
    const statuses = {}
    
    for (const [serviceName, service] of this.services) {
      statuses[serviceName] = {
        isHealthy: typeof service.getHealthStatus === 'function' ? 
          service.getHealthStatus().healthy : true,
        healthStatus: typeof service.getHealthStatus === 'function' ? 
          service.getHealthStatus() : { health: 'unknown' },
        status: typeof service.getStatus === 'function' ? 
          service.getStatus() : { status: 'unknown' }
      }
    }
    
    return {
      coordinatorReady: this.coordinatorReady,
      allServicesReady: this.allServicesReady,
      services: statuses,
      stats: this.coordinatorStats
    }
  }

  /**
   * 獲取協調器統計資料
   * @returns {Object} 統計資料
   */
  getCoordinatorStats() {
    return {
      ...this.coordinatorStats,
      uptime: Date.now() - (this.initializationStartTime || Date.now()),
      coordinatorReady: this.coordinatorReady,
      allServicesReady: this.allServicesReady,
      serviceCount: this.services.size
    }
  }

  /**
   * 生成 Extraction Domain 診斷報告
   * @returns {Object} 診斷報告
   */
  generateDiagnosticReport() {
    return {
      coordinator: this.getCoordinatorStats(),
      services: this.getAllServiceStatuses(),
      healthSummary: this.generateHealthSummary(),
      timestamp: Date.now()
    }
  }

  /**
   * 生成健康狀態摘要
   * @returns {Object} 健康狀態摘要
   * @private
   */
  generateHealthSummary() {
    const serviceHealthCount = {
      healthy: 0,
      degraded: 0,
      unknown: 0
    }
    
    // 統計各微服務健康狀態
    for (const [serviceName, service] of this.services) {
      if (typeof service.getHealthStatus === 'function') {
        const healthStatus = service.getHealthStatus()
        if (healthStatus.healthy) {
          serviceHealthCount.healthy++
        } else {
          serviceHealthCount.degraded++
        }
      } else {
        serviceHealthCount.unknown++
      }
    }
    
    const totalServices = this.services.size
    const healthyPercentage = serviceHealthCount.healthy / totalServices
    
    let overallHealth = 'healthy'
    if (healthyPercentage < 0.8) {
      overallHealth = 'degraded'
    }
    if (!this.coordinatorReady || !this.allServicesReady) {
      overallHealth = 'degraded'
    }
    
    return {
      coordinatorReady: this.coordinatorReady,
      allServicesReady: this.allServicesReady,
      totalServices,
      healthyServices: serviceHealthCount.healthy,
      degradedServices: serviceHealthCount.degraded,
      unknownServices: serviceHealthCount.unknown,
      healthyPercentage: (healthyPercentage * 100).toFixed(1) + '%',
      overallHealth
    }
  }

  /**
   * 取得自訂健康狀態
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus() {
    return this.generateHealthSummary()
  }
}

module.exports = ExtractionDomainCoordinator