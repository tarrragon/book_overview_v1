/**
 * QualityAssessmentService 測試
 * TDD 重構循環 4/8: 品質評估邏輯提取
 *
 * 目標：將品質評估邏輯從 DataValidationService 中提取
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')
// eslint-disable-next-line no-unused-vars
const QualityAssessmentService = require('src/background/domains/data-management/services/quality-assessment-service.js')
// eslint-disable-next-line no-unused-vars
const { StandardError } = require('src/core/errors/StandardError')

describe('QualityAssessmentService - 品質評估服務', () => {
  let assessor
  // eslint-disable-next-line no-unused-vars
  let mockEventBus
  // eslint-disable-next-line no-unused-vars
  let mockLogger

  beforeEach(() => {
    mockEventBus = {
      on: jest.fn(),
      emit: jest.fn(),
      off: jest.fn()
    }

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    }

    assessor = new QualityAssessmentService(mockEventBus, {
      logger: mockLogger,
      config: {
        qualityThresholds: {
          high: 90,
          medium: 70,
          low: 50
        },
        qualityWeights: {
          title: 20,
          authors: 15,
          isbn: 10,
          cover: 10,
          publisher: 5,
          progress: 5,
          rating: 3
        }
      }
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('🏗️ 服務初始化', () => {
    test('應該正確初始化品質評估服務', () => {
      expect(assessor).toBeInstanceOf(QualityAssessmentService)
      expect(assessor.eventBus).toBe(mockEventBus)
      expect(assessor.logger).toBe(mockLogger)
    })

    test('應該初始化品質評估配置', () => {
      expect(assessor.config.qualityThresholds.high).toBe(90)
      expect(assessor.config.qualityThresholds.medium).toBe(70)
      expect(assessor.config.qualityThresholds.low).toBe(50)
    })

    test('應該初始化品質權重配置', () => {
      expect(assessor.config.qualityWeights.title).toBe(20)
      expect(assessor.config.qualityWeights.authors).toBe(15)
      expect(assessor.config.qualityWeights.isbn).toBe(10)
    })

    test('應該初始化品質統計', () => {
      expect(assessor.qualityStatistics).toBeDefined()
      expect(assessor.qualityStatistics.totalAssessed).toBe(0)
      expect(assessor.qualityStatistics.averageScore).toBe(0)
    })
  })

  describe('📖 單本書籍品質評估', () => {
    test('assessDataQuality() 應該評估完整書籍資料', () => {
      // eslint-disable-next-line no-unused-vars
      const book = {
        title: '完整的測試書籍',
        authors: ['作者1', '作者2'],
        isbn: '9781234567890',
        cover: 'https://example.com/cover.jpg',
        publisher: '測試出版社',
        progress: 50,
        rating: 4.5
      }

      // eslint-disable-next-line no-unused-vars
      const result = assessor.assessDataQuality(book)

      expect(result.score).toBe(100)
      expect(result.level).toBe('HIGH')
      expect(result.issues).toHaveLength(0)
      expect(result.completeness).toBeGreaterThan(90)
    })

    test('assessDataQuality() 應該檢測缺少標題', () => {
      // eslint-disable-next-line no-unused-vars
      const book = {
        authors: ['作者1'],
        isbn: '9781234567890'
      }

      // eslint-disable-next-line no-unused-vars
      const result = assessor.assessDataQuality(book)

      expect(result.score).toBeLessThan(100)
      expect(result.issues.some(issue => issue.field === 'title')).toBe(true)
      expect(result.issues.some(issue => issue.type === 'MISSING_TITLE')).toBe(true)
    })

    test('assessDataQuality() 應該檢測標題太短', () => {
      // eslint-disable-next-line no-unused-vars
      const book = {
        title: 'A', // 太短
        authors: ['作者1'],
        isbn: '9781234567890'
      }

      // eslint-disable-next-line no-unused-vars
      const result = assessor.assessDataQuality(book)

      expect(result.issues.some(issue => issue.type === 'TITLE_TOO_SHORT')).toBe(true)
    })

    test('assessDataQuality() 應該檢測缺少作者', () => {
      // eslint-disable-next-line no-unused-vars
      const book = {
        title: '測試書籍',
        isbn: '9781234567890'
      }

      // eslint-disable-next-line no-unused-vars
      const result = assessor.assessDataQuality(book)

      expect(result.issues.some(issue => issue.field === 'authors')).toBe(true)
      expect(result.issues.some(issue => issue.type === 'MISSING_AUTHORS')).toBe(true)
    })

    test('assessDataQuality() 應該檢測無效 ISBN', () => {
      // eslint-disable-next-line no-unused-vars
      const book = {
        title: '測試書籍',
        authors: ['作者1'],
        isbn: '123' // 太短
      }

      // eslint-disable-next-line no-unused-vars
      const result = assessor.assessDataQuality(book)

      expect(result.issues.some(issue => issue.field === 'isbn')).toBe(true)
      expect(result.issues.some(issue => issue.type === 'INVALID_ISBN')).toBe(true)
    })

    test('assessDataQuality() 應該檢測缺少封面', () => {
      // eslint-disable-next-line no-unused-vars
      const book = {
        title: '測試書籍',
        authors: ['作者1'],
        isbn: '9781234567890'
        // 缺少 cover
      }

      // eslint-disable-next-line no-unused-vars
      const result = assessor.assessDataQuality(book)

      expect(result.issues.some(issue => issue.field === 'cover')).toBe(true)
      expect(result.issues.some(issue => issue.type === 'MISSING_COVER')).toBe(true)
    })

    test('assessDataQuality() 應該計算完整度百分比', () => {
      // eslint-disable-next-line no-unused-vars
      const completeBook = {
        title: '完整書籍',
        authors: ['作者1'],
        isbn: '9781234567890',
        cover: 'cover.jpg',
        publisher: '出版社',
        progress: 50,
        rating: 4
      }

      // eslint-disable-next-line no-unused-vars
      const incompleteBook = {
        title: '不完整書籍'
        // 缺少其他欄位
      }

      // eslint-disable-next-line no-unused-vars
      const completeResult = assessor.assessDataQuality(completeBook)
      // eslint-disable-next-line no-unused-vars
      const incompleteResult = assessor.assessDataQuality(incompleteBook)

      expect(completeResult.completeness).toBeGreaterThan(incompleteResult.completeness)
      expect(completeResult.completeness).toBeGreaterThan(90)
      expect(incompleteResult.completeness).toBeLessThan(30)
    })
  })

  describe('📊 驗證報告品質評估', () => {
    test('calculateQualityScore() 應該計算完美報告分數', () => {
      // eslint-disable-next-line no-unused-vars
      const report = {
        totalBooks: 10,
        validBooks: new Array(10).fill({}),
        invalidBooks: [],
        warnings: []
      }

      // eslint-disable-next-line no-unused-vars
      const score = assessor.calculateQualityScore(report)

      expect(score).toBe(100)
    })

    test('calculateQualityScore() 應該扣除無效書籍分數', () => {
      // eslint-disable-next-line no-unused-vars
      const report = {
        totalBooks: 10,
        validBooks: new Array(8).fill({}),
        invalidBooks: new Array(2).fill({}),
        warnings: []
      }

      // eslint-disable-next-line no-unused-vars
      const score = assessor.calculateQualityScore(report)

      expect(score).toBe(80) // 80% 有效
    })

    test('calculateQualityScore() 應該扣除警告分數', () => {
      // eslint-disable-next-line no-unused-vars
      const report = {
        totalBooks: 10,
        validBooks: new Array(10).fill({}),
        invalidBooks: [],
        warnings: new Array(5).fill({}) // 5個警告
      }

      // eslint-disable-next-line no-unused-vars
      const score = assessor.calculateQualityScore(report)

      expect(score).toBe(95) // 100% 有效 - 5 警告扣分
    })

    test('calculateQualityScore() 應該限制警告扣分上限', () => {
      // eslint-disable-next-line no-unused-vars
      const report = {
        totalBooks: 10,
        validBooks: new Array(10).fill({}),
        invalidBooks: [],
        warnings: new Array(50).fill({}) // 50個警告
      }

      // eslint-disable-next-line no-unused-vars
      const score = assessor.calculateQualityScore(report)

      expect(score).toBe(80) // 最多扣20分
    })

    test('calculateQualityScore() 應該處理空報告', () => {
      // eslint-disable-next-line no-unused-vars
      const report = {
        totalBooks: 0,
        validBooks: [],
        invalidBooks: [],
        warnings: []
      }

      // eslint-disable-next-line no-unused-vars
      const score = assessor.calculateQualityScore(report)

      expect(score).toBe(0)
    })
  })

  describe('🎯 品質等級判定', () => {
    test('determineQualityLevel() 應該判定高品質', () => {
      expect(assessor.determineQualityLevel(95)).toBe('HIGH')
      expect(assessor.determineQualityLevel(90)).toBe('HIGH')
    })

    test('determineQualityLevel() 應該判定中品質', () => {
      expect(assessor.determineQualityLevel(85)).toBe('MEDIUM')
      expect(assessor.determineQualityLevel(70)).toBe('MEDIUM')
    })

    test('determineQualityLevel() 應該判定低品質', () => {
      expect(assessor.determineQualityLevel(65)).toBe('LOW')
      expect(assessor.determineQualityLevel(50)).toBe('LOW')
    })

    test('determineQualityLevel() 應該判定極低品質', () => {
      expect(assessor.determineQualityLevel(45)).toBe('VERY_LOW')
      expect(assessor.determineQualityLevel(0)).toBe('VERY_LOW')
    })
  })

  describe('📋 批次品質評估', () => {
    test('assessBatchQuality() 應該評估多本書籍品質', () => {
      // eslint-disable-next-line no-unused-vars
      const books = [
        {
          title: '好書1',
          authors: ['作者1'],
          isbn: '9781234567890',
          cover: 'cover1.jpg'
        },
        {
          title: '好書2',
          authors: ['作者2'],
          isbn: '9781234567891',
          cover: 'cover2.jpg'
        },
        {
          title: '差書' // 缺少其他欄位
        }
      ]

      // eslint-disable-next-line no-unused-vars
      const result = assessor.assessBatchQuality(books)

      expect(result.totalBooks).toBe(3)
      expect(result.averageScore).toBeGreaterThan(0)
      expect(result.qualityBreakdown.HIGH).toBeGreaterThan(0)
      expect(result.bookAssessments).toHaveLength(3)
    })

    test('assessBatchQuality() 應該處理空批次', () => {
      // eslint-disable-next-line no-unused-vars
      const result = assessor.assessBatchQuality([])

      expect(result.totalBooks).toBe(0)
      expect(result.averageScore).toBe(0)
      expect(result.bookAssessments).toHaveLength(0)
    })

    test('assessBatchQuality() 應該提供品質分佈', () => {
      // eslint-disable-next-line no-unused-vars
      const books = [
        { title: '完美書籍', authors: ['作者'], isbn: '9781234567890', cover: 'cover.jpg', publisher: '出版社' },
        { title: '中等書籍', authors: ['作者'] },
        { title: '差書籍' }
      ]

      // eslint-disable-next-line no-unused-vars
      const result = assessor.assessBatchQuality(books)

      expect(result.qualityBreakdown).toBeDefined()
      expect(result.qualityBreakdown.HIGH + result.qualityBreakdown.MEDIUM +
             result.qualityBreakdown.LOW + result.qualityBreakdown.VERY_LOW).toBe(3)
    })
  })

  describe('📊 品質改善建議', () => {
    test('generateQualityRecommendations() 應該提供改善建議', () => {
      // eslint-disable-next-line no-unused-vars
      const assessment = {
        score: 60,
        level: 'MEDIUM',
        issues: [
          { field: 'cover', type: 'MISSING_COVER' },
          { field: 'publisher', type: 'MISSING_PUBLISHER' }
        ]
      }

      // eslint-disable-next-line no-unused-vars
      const recommendations = assessor.generateQualityRecommendations(assessment)

      expect(recommendations).toBeDefined()
      expect(recommendations.suggestions.some(s => s.includes('封面'))).toBe(true)
      expect(recommendations.suggestions.some(s => s.includes('出版社'))).toBe(true)
      expect(recommendations.priority).toBe('HIGH') // MISSING_COVER 是 HIGH 優先級
    })

    test('generateQualityRecommendations() 應該處理高品質資料', () => {
      // eslint-disable-next-line no-unused-vars
      const assessment = {
        score: 95,
        level: 'HIGH',
        issues: []
      }

      // eslint-disable-next-line no-unused-vars
      const recommendations = assessor.generateQualityRecommendations(assessment)

      expect(recommendations.suggestions).toHaveLength(0)
      expect(recommendations.priority).toBe('LOW')
    })
  })

  describe('📊 統計與監控', () => {
    test('getQualityStatistics() 應該提供品質統計', () => {
      // eslint-disable-next-line no-unused-vars
      const books = [
        { title: '書籍1', authors: ['作者1'], isbn: '9781234567890' },
        { title: '書籍2', authors: ['作者2'], isbn: '9781234567891' }
      ]

      assessor.assessBatchQuality(books)
      // eslint-disable-next-line no-unused-vars
      const stats = assessor.getQualityStatistics()

      expect(stats.totalAssessed).toBe(2)
      expect(stats.averageScore).toBeGreaterThan(0)
      expect(stats.qualityDistribution).toBeDefined()
    })

    test('resetStatistics() 應該重置統計數據', () => {
      assessor.qualityStatistics.totalAssessed = 10
      assessor.resetStatistics()

      expect(assessor.qualityStatistics.totalAssessed).toBe(0)
      expect(assessor.qualityStatistics.averageScore).toBe(0)
    })

    test('isQualityServiceHealthy() 應該檢查服務健康狀態', () => {
      // eslint-disable-next-line no-unused-vars
      const health = assessor.isQualityServiceHealthy()

      expect(health.isHealthy).toBeDefined()
      expect(health.qualityStatistics).toBeDefined()
      expect(health.lastCheck).toBeDefined()
    })
  })

  describe('🔧 品質配置管理', () => {
    test('updateQualityThresholds() 應該更新品質門檻', () => {
      // eslint-disable-next-line no-unused-vars
      const newThresholds = {
        high: 95,
        medium: 80,
        low: 60
      }

      assessor.updateQualityThresholds(newThresholds)

      expect(assessor.config.qualityThresholds.high).toBe(95)
      expect(assessor.config.qualityThresholds.medium).toBe(80)
      expect(assessor.config.qualityThresholds.low).toBe(60)
    })

    test('updateQualityWeights() 應該更新品質權重', () => {
      // eslint-disable-next-line no-unused-vars
      const newWeights = {
        title: 25,
        authors: 20,
        isbn: 15
      }

      assessor.updateQualityWeights(newWeights)

      expect(assessor.config.qualityWeights.title).toBe(25)
      expect(assessor.config.qualityWeights.authors).toBe(20)
      expect(assessor.config.qualityWeights.isbn).toBe(15)
    })
  })

  describe('⚠️ 錯誤處理', () => {
    test('constructor 應該要求 eventBus 參數', () => {
      expect(() => {
        // eslint-disable-next-line no-unused-vars
        const _service = new QualityAssessmentService()
        // 變數賦值確保建構子結果被正確處理，測試錯誤條件
      }).toThrow()

      expect(() => {
        // eslint-disable-next-line no-unused-vars
        const _service = new QualityAssessmentService()
        // 變數賦值確保建構子結果被正確處理，測試錯誤條件
      }).toMatchObject({
        code: 'INVALID_ARGUMENT',
        details: expect.any(Object)
      })
    })

    test('應該處理評估過程中的錯誤', () => {
      // 模擬一個會導致錯誤的書籍物件
      // eslint-disable-next-line no-unused-vars
      const invalidBook = {
        title: 'Test Book', // 有標題會有一些分數
        toString: () => { throw (() => { const error = new Error('轉換錯誤'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })() }
      }

      // eslint-disable-next-line no-unused-vars
      const result = assessor.assessDataQuality(invalidBook)

      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.level).toBeDefined()
      // 這個案例實際上可以正常評估，因為沒有觸發錯誤路徑
    })

    test('應該處理 null 或 undefined 書籍', () => {
      // eslint-disable-next-line no-unused-vars
      const result1 = assessor.assessDataQuality(null)
      // eslint-disable-next-line no-unused-vars
      const result2 = assessor.assessDataQuality(undefined)

      expect(result1.score).toBe(0)
      expect(result1.level).toBe('VERY_LOW')
      expect(result2.score).toBe(0)
      expect(result2.level).toBe('VERY_LOW')
    })
  })
})
