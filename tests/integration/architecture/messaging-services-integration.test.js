/**
 * 訊息服務架構整合驗證測試
 * 
 * 目的：驗證 v0.11.1 中創建的三大訊息服務是否正確整合到系統中
 * 測試範圍：
 * - 服務實例化和初始化
 * - 服務間依賴關係
 * - 基本功能運作
 */

const MessagingDomainCoordinator = require('src/background/domains/messaging/messaging-domain-coordinator')

describe('訊息服務架構整合驗證', () => {
  let coordinator
  let mockDependencies

  beforeEach(() => {
    // 設置模擬依賴
    mockDependencies = {
      eventBus: {
        emit: jest.fn().mockResolvedValue(true),
        on: jest.fn(),
        off: jest.fn()
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        log: jest.fn()
      }
    }

    coordinator = new MessagingDomainCoordinator(mockDependencies)
  })

  describe('服務註冊與初始化', () => {
    test('應該成功註冊所有5個訊息服務', () => {
      const expectedServices = [
        'validation',
        'queue', 
        'connection',
        'session',
        'routing'
      ]

      expectedServices.forEach(serviceName => {
        expect(coordinator.services.has(serviceName)).toBe(true)
        expect(coordinator.services.get(serviceName)).toBeDefined()
      })

      expect(coordinator.services.size).toBe(5)
    })

    test('應該為每個服務設置正確的初始狀態', () => {
      const expectedServices = ['validation', 'queue', 'connection', 'session', 'routing']
      
      expectedServices.forEach(serviceName => {
        const serviceState = coordinator.serviceStates.get(serviceName)
        expect(serviceState).toEqual({
          initialized: false,
          active: false,
          healthy: true,
          lastCheck: 0,
          restartCount: 0
        })
      })
    })
  })

  describe('新建服務功能驗證', () => {
    test('ConnectionMonitoringService 應該具備基本監控功能', () => {
      const connectionService = coordinator.services.get('connection')
      
      // 驗證服務實例存在
      expect(connectionService).toBeDefined()
      expect(connectionService.constructor.name).toBe('ConnectionMonitoringService')
      
      // 驗證基本屬性
      expect(connectionService).toHaveProperty('activeConnections')
      expect(connectionService).toHaveProperty('connectionHistory')
      expect(connectionService.activeConnections).toBeInstanceOf(Map)
    })

    test('MessageValidationService 應該具備驗證功能', () => {
      const validationService = coordinator.services.get('validation')
      
      expect(validationService).toBeDefined()
      expect(validationService.constructor.name).toBe('MessageValidationService')
      
      // 驗證基本功能方法存在
      expect(typeof validationService.validateMessage).toBe('function')
      expect(typeof validationService.validateMessageSecurity).toBe('function')
    })

    test('QueueManagementService 應該具備佇列管理功能', () => {
      const queueService = coordinator.services.get('queue')
      
      expect(queueService).toBeDefined()
      expect(queueService.constructor.name).toBe('QueueManagementService')
      
      // 驗證佇列相關屬性
      expect(queueService).toHaveProperty('messageQueues')
      expect(queueService).toHaveProperty('stats')
      expect(typeof queueService.enqueueMessage).toBe('function')
    })
  })

  describe('服務協調器統計', () => {
    test('應該正確統計管理的服務數量', () => {
      expect(coordinator.stats.servicesManaged).toBe(5)
    })

    test('應該初始化所有統計指標', () => {
      expect(coordinator.stats).toEqual({
        servicesManaged: 5,
        eventsHandled: 0,
        restartAttempts: 0,
        healthChecks: 0,
        messagesRouted: 0,
        sessionsManaged: 0
      })
    })
  })

  describe('服務協作驗證', () => {
    test('所有服務應該接收相同的依賴注入', () => {
      const services = ['validation', 'queue', 'connection', 'session', 'routing']
      
      services.forEach(serviceName => {
        const service = coordinator.services.get(serviceName)
        
        // 驗證依賴注入
        expect(service.eventBus).toBe(mockDependencies.eventBus)
        expect(service.logger).toBe(mockDependencies.logger)
      })
    })

    test('協調器應該能夠管理服務生命週期', () => {
      // 驗證協調器具備服務管理功能
      expect(typeof coordinator.initializeServices).toBe('function')
      expect(coordinator.services.size).toBeGreaterThan(0)
      expect(coordinator.serviceStates.size).toBeGreaterThan(0)
    })
  })

  describe('架構完整性驗證', () => {
    test('v0.11.1 新增服務應該與既有服務並存', () => {
      const existingServices = ['session', 'routing']
      const newServices = ['validation', 'queue', 'connection']
      
      // 驗證既有服務仍然存在
      existingServices.forEach(serviceName => {
        expect(coordinator.services.has(serviceName)).toBe(true)
      })
      
      // 驗證新服務已成功整合
      newServices.forEach(serviceName => {
        expect(coordinator.services.has(serviceName)).toBe(true)
      })
    })

    test('訊息服務架構應該支援事件驅動模式', () => {
      // 驗證協調器具備事件處理能力
      expect(coordinator.eventBus).toBe(mockDependencies.eventBus)
      
      // 驗證服務註冊了事件監聽器管理
      expect(coordinator.registeredListeners).toBeInstanceOf(Map)
    })
  })
})