/**
 * @fileoverview Health Monitoring Service 單元測試
 *
 * 對應 domain-map 不變式：健康狀態為 healthy/degraded/unhealthy 三態；心跳間隔可配置。
 *
 * 本實作以 healthData.system.score（0.0 ~ 1.0，healthThreshold 預設 0.8）與
 * healthy 布林值表達整體健康狀態，未直接使用 healthy/degraded/unhealthy 字面字串。
 * 三態對應關係如下（依 calculateOverallHealth 的分數衰減邏輯）：
 * - healthy：score >= healthThreshold（無問題或問題輕微）
 * - degraded：0 < score < healthThreshold（healthy 為 false，但服務仍部分運作）
 * - unhealthy：score 降至 0（大量高嚴重度問題疊加，視為完全不健康）
 */

const HealthMonitoringService = require('src/background/domains/system/services/health-monitoring-service.js')

describe('HealthMonitoringService', () => {
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
      on: jest.fn().mockResolvedValue('listener-id'),
      off: jest.fn().mockResolvedValue(true)
    }

    service = new HealthMonitoringService({ logger: mockLogger, eventBus: mockEventBus })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('健康狀態為 healthy/degraded/unhealthy 三態', () => {
    test('無任何問題時，分數應為滿分且標記為健康（healthy）', () => {
      service.calculateOverallHealth()

      expect(service.healthData.system.score).toBe(1.0)
      expect(service.healthData.system.healthy).toBe(true)
    })

    test('存在部分高嚴重度問題時，分數降低但未歸零，標記為不健康（degraded）', () => {
      service.recordIssue('memory', 'high_usage', '記憶體使用過高')
      service.calculateOverallHealth()

      expect(service.healthData.system.score).toBeCloseTo(0.7, 2)
      expect(service.healthData.system.score).toBeGreaterThan(0)
      expect(service.healthData.system.healthy).toBe(false)
    })

    test('累積大量高嚴重度問題時，分數歸零，標記為完全不健康（unhealthy）', () => {
      for (let i = 0; i < 4; i++) {
        service.recordIssue('memory', 'high_usage', '記憶體使用過高')
      }
      service.calculateOverallHealth()

      expect(service.healthData.system.score).toBe(0)
      expect(service.healthData.system.healthy).toBe(false)
    })
  })

  describe('心跳間隔可配置', () => {
    test('修改 checkInterval 設定後，定期監控應以新的間隔註冊計時器', async () => {
      jest.useFakeTimers()
      const setIntervalSpy = jest.spyOn(global, 'setInterval')

      await service.initialize()
      service.config.checkInterval = 5000

      await service.start()

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000)
    })
  })
})
