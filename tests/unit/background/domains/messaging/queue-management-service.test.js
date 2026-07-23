/**
 * @fileoverview Queue Management Service 單元測試
 *
 * 對應 domain-map 不變式：高優先級訊息優先出隊；佇列容量超限時拒絕入隊。
 */

const {
  QueueManagementService,
  QUEUE_CONFIG
} = require('src/background/domains/messaging/services/queue-management-service.js')

describe('QueueManagementService', () => {
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

    service = new QueueManagementService({ logger: mockLogger, eventBus: mockEventBus })
  })

  describe('高優先級訊息優先出隊', () => {
    test('低優先級訊息先入隊、高優先級訊息後入隊時，出隊批次應優先取出高優先級訊息', async () => {
      await service.enqueueMessage({ type: 'LOW_MSG' }, QUEUE_CONFIG.PRIORITY_LEVELS.LOW)
      await service.enqueueMessage({ type: 'HIGH_MSG' }, QUEUE_CONFIG.PRIORITY_LEVELS.HIGH)

      const batch = service.getNextMessageBatch(1)

      expect(batch).toHaveLength(1)
      expect(batch[0].priority).toBe(QUEUE_CONFIG.PRIORITY_LEVELS.HIGH)
      expect(batch[0].message.type).toBe('HIGH_MSG')
    })
  })

  describe('佇列容量超限時拒絕入隊', () => {
    test('佇列總容量達到上限時，enqueueMessage 應回傳失敗並拒絕入隊', async () => {
      const normalQueue = service.messageQueues.get(QUEUE_CONFIG.PRIORITY_LEVELS.NORMAL)
      for (let i = 0; i < QUEUE_CONFIG.MAX_QUEUE_SIZE; i++) {
        normalQueue.push({
          id: `filler-${i}`,
          message: { type: 'FILLER' },
          priority: QUEUE_CONFIG.PRIORITY_LEVELS.NORMAL,
          enqueuedAt: Date.now(),
          attempts: 0,
          status: 'queued'
        })
      }

      const result = await service.enqueueMessage({ type: 'OVERFLOW_MSG' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Queue overflow')
    })
  })
})
