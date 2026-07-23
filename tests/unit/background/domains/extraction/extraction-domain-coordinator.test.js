/**
 * @fileoverview Extraction Domain Coordinator 單元測試
 *
 * 對應 domain-map 不變式：提取狀態機 idle -> extracting -> completed/failed；
 * 不可從 completed 直接回 extracting（協調器層級：服務生命週期管理）。
 */

const ExtractionDomainCoordinator = require('src/background/domains/extraction/extraction-domain-coordinator.js')
const DataProcessingService = require('src/background/domains/extraction/services/data-processing-service.js')
const ValidationService = require('src/background/domains/extraction/services/validation-service.js')
const ExportService = require('src/background/domains/extraction/services/export-service.js')
const ExtractionStateService = require('src/background/domains/extraction/services/extraction-state-service.js')
const QualityControlService = require('src/background/domains/extraction/services/quality-control-service.js')

describe('ExtractionDomainCoordinator', () => {
  let coordinator
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }

    coordinator = new ExtractionDomainCoordinator({ logger: mockLogger })
  })

  afterEach(async () => {
    if (coordinator.allServicesReady) {
      await coordinator.stop()
    }
  })

  describe('建構子初始化', () => {
    test('應該建立協調器且服務尚未建立', () => {
      expect(coordinator.moduleName).toBe('ExtractionDomainCoordinator')
      expect(coordinator.services.size).toBe(0)
      expect(coordinator.dataProcessingService).toBeNull()
      expect(coordinator.validationService).toBeNull()
      expect(coordinator.exportService).toBeNull()
      expect(coordinator.extractionStateService).toBeNull()
      expect(coordinator.qualityControlService).toBeNull()
      expect(coordinator.coordinatorReady).toBe(false)
      expect(coordinator.allServicesReady).toBe(false)
    })
  })

  describe('initialize() 建立並初始化五個微服務', () => {
    test('應該建立五個 Extraction 微服務', async () => {
      await coordinator.initialize()

      expect(coordinator.services.size).toBe(5)
      expect(coordinator.dataProcessingService).toBeInstanceOf(DataProcessingService)
      expect(coordinator.validationService).toBeInstanceOf(ValidationService)
      expect(coordinator.exportService).toBeInstanceOf(ExportService)
      expect(coordinator.extractionStateService).toBeInstanceOf(ExtractionStateService)
      expect(coordinator.qualityControlService).toBeInstanceOf(QualityControlService)
    })

    test('應該定義服務載入與啟動順序', async () => {
      await coordinator.initialize()

      expect(coordinator.serviceLoadOrder).toEqual([
        'dataProcessingService',
        'validationService',
        'exportService',
        'extractionStateService',
        'qualityControlService'
      ])
      expect(coordinator.serviceStartOrder).toEqual([
        'dataProcessingService',
        'validationService',
        'extractionStateService',
        'exportService',
        'qualityControlService'
      ])
    })

    test('初始化完成後 coordinatorReady 為 true', async () => {
      await coordinator.initialize()

      expect(coordinator.coordinatorReady).toBe(true)
      expect(coordinator.coordinatorStats.servicesInitialized).toBe(5)
    })
  })

  describe('提取狀態機（協調器生命週期）：idle -> extracting -> completed/failed', () => {
    test('start() 前必須先 initialize()，否則拋出錯誤（不可跳過 idle 狀態）', async () => {
      await expect(coordinator.start()).rejects.toThrow()
    })

    test('initialize() -> start() 後 allServicesReady 為 true（idle -> extracting 完成）', async () => {
      await coordinator.initialize()
      await coordinator.start()

      expect(coordinator.allServicesReady).toBe(true)
      expect(coordinator.coordinatorStats.servicesStarted).toBe(5)
    })

    test('stop() 後狀態重設為 idle（不可從 completed 直接回 extracting 需重新 initialize/start）', async () => {
      await coordinator.initialize()
      await coordinator.start()
      await coordinator.stop()

      expect(coordinator.coordinatorReady).toBe(false)
      expect(coordinator.allServicesReady).toBe(false)
    })
  })

  describe('微服務存取介面', () => {
    beforeEach(async () => {
      await coordinator.initialize()
    })

    test('getService() 依名稱回傳對應微服務', () => {
      expect(coordinator.getService('dataProcessingService')).toBe(coordinator.dataProcessingService)
      expect(coordinator.getService('not-exist')).toBeNull()
    })

    test('getDataProcessingService()/getValidationService()/getExportService() 回傳正確實例', () => {
      expect(coordinator.getDataProcessingService()).toBeInstanceOf(DataProcessingService)
      expect(coordinator.getValidationService()).toBeInstanceOf(ValidationService)
      expect(coordinator.getExportService()).toBeInstanceOf(ExportService)
    })

    test('getExtractionStateService()/getQualityControlService() 回傳正確實例', () => {
      expect(coordinator.getExtractionStateService()).toBeInstanceOf(ExtractionStateService)
      expect(coordinator.getQualityControlService()).toBeInstanceOf(QualityControlService)
    })
  })

  describe('診斷與健康狀態報告', () => {
    test('getAllServiceStatuses() 應回報所有已建立的服務', async () => {
      await coordinator.initialize()

      const statuses = coordinator.getAllServiceStatuses()

      expect(Object.keys(statuses.services)).toHaveLength(5)
      expect(statuses.coordinatorReady).toBe(true)
    })

    test('generateDiagnosticReport() 應包含 coordinator、services 與 healthSummary', async () => {
      await coordinator.initialize()

      const report = coordinator.generateDiagnosticReport()

      expect(report.coordinator).toBeDefined()
      expect(report.services).toBeDefined()
      expect(report.healthSummary.totalServices).toBe(5)
    })
  })
})
