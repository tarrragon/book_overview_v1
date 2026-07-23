/**
 * @fileoverview Session Management Service 單元測試
 *
 * 對應 domain-map 不變式：session 建立後必須可查詢；銷毀後不可再查詢。
 */

const SessionManagementService = require('src/background/domains/messaging/services/session-management-service.js')

describe('SessionManagementService', () => {
  let service
  let mockLogger
  let mockEventBus

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }
    mockEventBus = {
      emit: jest.fn().mockResolvedValue(true),
      on: jest.fn(),
      off: jest.fn()
    }

    service = new SessionManagementService({ logger: mockLogger, eventBus: mockEventBus })
  })

  afterEach(() => {
    // 清除 startSession 建立的逾時計時器，避免測試結束後仍有殘留的真實 timer
    for (const timeoutId of service.sessionTimeouts.values()) {
      clearTimeout(timeoutId)
    }
  })

  describe('session 建立後必須可查詢', () => {
    test('startSession 後應可透過 getSessionState 查詢到該 session', async () => {
      await service.startSession('session-1', { tabId: 1 })

      const session = service.getSessionState('session-1')
      expect(session).not.toBeNull()
      expect(session.id).toBe('session-1')
      expect(session.status).toBe('active')
    })
  })

  describe('session 銷毀後不可再查詢', () => {
    test('endSession 後應無法再透過 getSessionState 查詢到該 session', async () => {
      await service.startSession('session-2', { tabId: 2 })
      await service.endSession('session-2')

      expect(service.getSessionState('session-2')).toBeNull()
    })
  })
})
