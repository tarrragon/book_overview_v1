/**
 * @fileoverview Quality Control Service 單元測試
 *
 * 對應 domain-map 不變式：品質分數 0-100（實作以 0-1 分數對應 0%-100%）；
 * 異常偵測閾值可配置。
 */

const QualityControlService = require('src/background/domains/extraction/services/quality-control-service.js')

describe('QualityControlService', () => {
  let service
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }

    service = new QualityControlService({ logger: mockLogger })
  })

  describe('analyzeDataQuality() 品質分數範圍 0-100（0-1 分數）', () => {
    test('整體品質分數應介於 0 與 1 之間', async () => {
      const data = {
        books: [
          { id: 'book-00001', title: '完整書名', author: '作者', publisher: '出版社', progress: 50, rating: 4 }
        ]
      }

      const result = await service.analyzeDataQuality(data)

      expect(result.overallScore).toBeGreaterThanOrEqual(0)
      expect(result.overallScore).toBeLessThanOrEqual(1)
    })

    test('無書籍資料時完整度分數應為 0', async () => {
      const result = await service.analyzeDataQuality({ books: [] })

      expect(result.metrics.data_completeness.score).toBe(0)
    })
  })

  describe('異常偵測閾值可配置', () => {
    test('降低 data_completeness 閾值後，原本不合格的資料應轉為合格', async () => {
      // 缺少 publisher 欄位，完整度為 3/4 = 0.75，低於預設閾值 0.9
      const data = {
        books: [{ id: 'book-00001', title: '書名', author: '作者' }]
      }

      const beforeResult = await service.analyzeDataQuality(data)
      expect(beforeResult.metrics.data_completeness.passed).toBe(false)

      const originalRule = service.monitoringRules.get('data_completeness')
      service.addQualityRule('data_completeness', {
        name: originalRule.name,
        description: originalRule.description,
        calculator: originalRule.calculator,
        threshold: 0.5
      })

      const afterResult = await service.analyzeDataQuality(data)
      expect(afterResult.metrics.data_completeness.passed).toBe(true)
    })
  })

  describe('calculateSeverity() 依分數與閾值差距回傳對應嚴重程度', () => {
    test('偏差大於 0.2 應回傳 CRITICAL', () => {
      expect(service.calculateSeverity(0.6, 0.9)).toBe(service.ALERT_LEVELS.CRITICAL)
    })

    test('偏差介於 0.1 到 0.2 之間應回傳 WARNING', () => {
      expect(service.calculateSeverity(0.75, 0.9)).toBe(service.ALERT_LEVELS.WARNING)
    })

    test('偏差小於等於 0.1 應回傳 INFO', () => {
      expect(service.calculateSeverity(0.85, 0.9)).toBe(service.ALERT_LEVELS.INFO)
    })
  })
})
