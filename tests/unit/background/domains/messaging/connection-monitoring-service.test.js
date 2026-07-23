/**
 * @fileoverview Connection Monitoring Service 單元測試
 *
 * 對應 domain-map 不變式：連線中斷偵測後狀態標記為 disconnected；
 * 重連後恢復 connected。
 *
 * 本服務實作以 status: 'active' 表示已連線、health check 偵測閒置逾時後
 * 呼叫 closeConnection 將連線自 activeConnections 移除（等同斷線標記），
 * 重新呼叫 establishConnection 建立同 id 連線即恢復 active 狀態（等同重連）。
 */

const {
  ConnectionMonitoringService,
  TIMEOUTS
} = require('src/background/domains/messaging/services/connection-monitoring-service.js')

describe('ConnectionMonitoringService', () => {
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

    service = new ConnectionMonitoringService({ logger: mockLogger, eventBus: mockEventBus })
  })

  describe('連線中斷偵測後狀態標記為 disconnected', () => {
    test('健康檢查偵測到連線閒置超過逾時門檻時，應關閉並移除該連線', async () => {
      await service.establishConnection('conn-1', { type: 'popup' })

      const connection = service.getConnectionState('conn-1')
      connection.lastActivity = Date.now() - (TIMEOUTS.DEFAULT_CONNECTION_TIMEOUT + 1000)

      await service.performHealthCheck()

      expect(service.getConnectionState('conn-1')).toBeNull()

      const historyEntry = service.connectionHistory.find(conn => conn.id === 'conn-1')
      expect(historyEntry.status).toBe('closed')
      expect(historyEntry.closeReason).toBe('inactivity_timeout')
    })
  })

  describe('重連後恢復 connected', () => {
    test('連線關閉後以相同 id 重新建立連線，應恢復為 active 狀態', async () => {
      await service.establishConnection('conn-2', { type: 'popup' })
      await service.closeConnection('conn-2', 'inactivity_timeout')

      expect(service.getConnectionState('conn-2')).toBeNull()

      await service.establishConnection('conn-2', { type: 'popup' })

      const reconnected = service.getConnectionState('conn-2')
      expect(reconnected).not.toBeNull()
      expect(reconnected.status).toBe('active')
    })
  })
})
