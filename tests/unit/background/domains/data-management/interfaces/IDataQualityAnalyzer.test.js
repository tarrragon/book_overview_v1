/**
 * IDataQualityAnalyzer 介面測試
 *
 * 測試目標：
 * - 驗證資料品質分析介面契約
 * - 測試品質評估、分析和報告生成功能
 * - 確保分析結果的準確性和一致性
 * - 驗證品質改善建議和趨勢分析
 *
 * @jest-environment jsdom
 */

describe('IDataQualityAnalyzer TDD 介面契約測試', () => {
  let dataQualityAnalyzer
  let mockValidationEngine
  let mockDataNormalizer
  let mockPlatformRuleManager

  beforeEach(() => {
    // Mock 依賴服務
    mockValidationEngine = {
      validateSingleBook: jest.fn(),
      getStatistics: jest.fn()
    }

    mockDataNormalizer = {
      normalizeBook: jest.fn(),
      getStatistics: jest.fn()
    }

    mockPlatformRuleManager = {
      getRulesForPlatform: jest.fn(),
      getPlatformSchema: jest.fn(),
      isRuleSupported: jest.fn(),
      getFieldRequirements: jest.fn(),
      validatePlatformSupport: jest.fn().mockReturnValue({ isSupported: true })
    }

    // 這裡會實例化 DataQualityAnalyzer，目前會失敗因為類別尚未建立
    const DataQualityAnalyzer = require('../../../../../../src/background/domains/data-management/services/DataQualityAnalyzer.js')
    dataQualityAnalyzer = new DataQualityAnalyzer({
      validationEngine: mockValidationEngine,
      dataNormalizer: mockDataNormalizer,
      platformRuleManager: mockPlatformRuleManager
    })
  })

  describe('🔴 Red 階段：介面契約驗證', () => {
    test('應該正確實作 IDataQualityAnalyzer 介面', () => {
      // Given: DataQualityAnalyzer 實例

      // Then: 應該實作所有必要的介面方法
      expect(typeof dataQualityAnalyzer.analyzeBookQuality).toBe('function')
      expect(typeof dataQualityAnalyzer.analyzeBatchQuality).toBe('function')
      expect(typeof dataQualityAnalyzer.generateQualityReport).toBe('function')
      expect(typeof dataQualityAnalyzer.getQualityScore).toBe('function')
      expect(typeof dataQualityAnalyzer.getQualityTrends).toBe('function')
      expect(typeof dataQualityAnalyzer.getImprovementSuggestions).toBe('function')
      expect(dataQualityAnalyzer.isInitialized).toBeDefined()
    })

    test('analyzeBookQuality() 應該分析單本書籍品質', async () => {
      // Given: 書籍資料和平台資訊
      const book = {
        id: 'book_123',
        title: '高品質測試書籍',
        authors: ['作者A', '作者B'],
        progress: 65,
        lastUpdated: '2025-08-19T12:00:00Z',
        cover: 'https://example.com/cover.jpg',
        isbn: '978-1234567890'
      }
      const platform = 'READMOO'
      const options = { includeDetails: true }

      // Mock 依賴服務回應
      mockValidationEngine.validateSingleBook.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        processingTime: 50
      })

      mockDataNormalizer.normalizeBook.mockResolvedValue({
        normalizedData: book,
        normalizationReport: { qualityScore: 85 },
        processingTime: 30
      })

      // When: 分析書籍品質
      const analysis = await dataQualityAnalyzer.analyzeBookQuality(book, platform, options)

      // Then: 應該返回完整的品質分析
      expect(analysis).toHaveProperty('bookId', 'book_123')
      expect(analysis).toHaveProperty('platform', platform)
      expect(analysis).toHaveProperty('overallScore')
      expect(analysis).toHaveProperty('qualityDimensions')
      expect(analysis).toHaveProperty('strengths')
      expect(analysis).toHaveProperty('weaknesses')
      expect(analysis).toHaveProperty('improvementSuggestions')
      expect(analysis).toHaveProperty('processingTime')
      expect(typeof analysis.overallScore).toBe('number')
      expect(analysis.overallScore).toBeGreaterThanOrEqual(0)
      expect(analysis.overallScore).toBeLessThanOrEqual(100)
    })

    test('analyzeBatchQuality() 應該批次分析書籍品質', async () => {
      // Given: 書籍集合
      const books = [
        {
          id: 'book_1',
          title: '書籍一',
          authors: ['作者1'],
          progress: 100
        },
        {
          id: 'book_2',
          title: '書籍二',
          authors: ['作者2'],
          progress: 50
        },
        {
          id: 'book_3',
          title: '', // 低品質資料
          authors: [],
          progress: -10
        }
      ]
      const platform = 'READMOO'
      const options = { parallelProcessing: true, maxConcurrency: 3 }

      // Mock 依賴服務回應
      mockValidationEngine.validateSingleBook
        .mockResolvedValueOnce({ isValid: true, errors: [], warnings: [] })
        .mockResolvedValueOnce({ isValid: true, errors: [], warnings: [] })
        .mockResolvedValueOnce({ isValid: false, errors: ['title required'], warnings: [] })

      mockDataNormalizer.normalizeBook
        .mockResolvedValueOnce({
          normalizedData: books[0],
          normalizationReport: { qualityScore: 90, changesApplied: [], warningsGenerated: [] }
        })
        .mockResolvedValueOnce({
          normalizedData: books[1],
          normalizationReport: { qualityScore: 75, changesApplied: [], warningsGenerated: [] }
        })
        .mockResolvedValueOnce({
          normalizedData: books[2],
          normalizationReport: { qualityScore: 30, changesApplied: [], warningsGenerated: [] }
        })

      // When: 批次分析品質
      const batchAnalysis = await dataQualityAnalyzer.analyzeBatchQuality(books, platform, options)

      // Then: 應該返回批次分析結果
      expect(batchAnalysis).toHaveProperty('totalBooks', 3)
      expect(batchAnalysis).toHaveProperty('processedBooks', 2) // 第三本書應該失敗
      expect(batchAnalysis).toHaveProperty('averageScore')
      expect(batchAnalysis).toHaveProperty('qualityDistribution')
      expect(batchAnalysis).toHaveProperty('commonIssues')
      expect(batchAnalysis).toHaveProperty('batchSuggestions')
      expect(batchAnalysis).toHaveProperty('processingTime')
      expect(Array.isArray(batchAnalysis.individualAnalyses)).toBe(true)
      expect(batchAnalysis.individualAnalyses.length).toBe(2) // 只有成功的分析
    })

    test('generateQualityReport() 應該生成詳細品質報告', async () => {
      // Given: 分析資料
      const analysisData = {
        books: [
          { id: 'book_1', overallScore: 85 },
          { id: 'book_2', overallScore: 92 },
          { id: 'book_3', overallScore: 78 }
        ],
        platform: 'READMOO',
        timeRange: { start: '2025-08-01', end: '2025-08-19' }
      }
      const reportOptions = {
        includeCharts: true,
        includeTrends: true,
        detailLevel: 'comprehensive'
      }

      // When: 生成品質報告
      const report = await dataQualityAnalyzer.generateQualityReport(analysisData, reportOptions)

      // Then: 應該返回完整的品質報告
      expect(report).toHaveProperty('summary')
      expect(report).toHaveProperty('qualityMetrics')
      expect(report).toHaveProperty('trendAnalysis')
      expect(report).toHaveProperty('recommendations')
      expect(report).toHaveProperty('charts')
      expect(report).toHaveProperty('metadata')
      expect(report.summary).toHaveProperty('averageScore')
      expect(report.summary).toHaveProperty('totalBooks')
      expect(Array.isArray(report.recommendations)).toBe(true)
    })

    test('getQualityScore() 應該計算綜合品質分數', async () => {
      // Given: 書籍資料
      const book = {
        id: 'book_123',
        title: '完整資料書籍',
        authors: ['知名作者'],
        progress: 75,
        cover: 'https://valid-url.com/image.jpg',
        isbn: '978-1234567890',
        lastUpdated: '2025-08-19T10:00:00Z'
      }
      const analysisOptions = { weightingStrategy: 'balanced' }

      // Mock 品質分析結果
      mockValidationEngine.validateSingleBook.mockResolvedValue({
        isValid: true,
        errors: [],
        validationResults: {
          requiredFields: { passed: true },
          dataTypes: { passed: true },
          businessRules: { passed: true }
        }
      })

      // When: 計算品質分數
      const scoreResult = await dataQualityAnalyzer.getQualityScore(book, analysisOptions)

      // Then: 應該返回分數和詳細組成
      expect(scoreResult).toHaveProperty('overallScore')
      expect(scoreResult).toHaveProperty('dimensionScores')
      expect(scoreResult).toHaveProperty('weightings')
      expect(scoreResult).toHaveProperty('calculationMethod')
      expect(typeof scoreResult.overallScore).toBe('number')
      expect(scoreResult.overallScore).toBeGreaterThanOrEqual(0)
      expect(scoreResult.overallScore).toBeLessThanOrEqual(100)
      expect(scoreResult.dimensionScores).toHaveProperty('completeness')
      expect(scoreResult.dimensionScores).toHaveProperty('validity')
      expect(scoreResult.dimensionScores).toHaveProperty('consistency')
      expect(scoreResult.dimensionScores).toHaveProperty('accuracy')
    })

    test('getQualityTrends() 應該分析品質趨勢', async () => {
      // Given: 歷史品質資料
      const historicalData = [
        { date: '2025-08-15', averageScore: 75, booksCount: 10 },
        { date: '2025-08-16', averageScore: 78, booksCount: 12 },
        { date: '2025-08-17', averageScore: 82, booksCount: 15 },
        { date: '2025-08-18', averageScore: 80, booksCount: 18 },
        { date: '2025-08-19', averageScore: 85, booksCount: 20 }
      ]
      const trendOptions = {
        analysisWindow: 5,
        includeProjection: true
      }

      // When: 分析品質趨勢
      const trends = await dataQualityAnalyzer.getQualityTrends(historicalData, trendOptions)

      // Then: 應該返回趨勢分析
      expect(trends).toHaveProperty('overallTrend')
      expect(trends).toHaveProperty('trendDirection')
      expect(trends).toHaveProperty('changeRate')
      expect(trends).toHaveProperty('volatility')
      expect(trends).toHaveProperty('projection')
      expect(trends).toHaveProperty('significantChanges')
      expect(['improving', 'stable', 'declining'].includes(trends.trendDirection)).toBe(true)
      expect(typeof trends.changeRate).toBe('number')
    })

    test('getImprovementSuggestions() 應該提供改善建議', async () => {
      // Given: 品質分析結果
      const qualityAnalysis = {
        bookId: 'book_123',
        overallScore: 65,
        qualityDimensions: {
          completeness: 70,
          validity: 85,
          consistency: 60,
          accuracy: 45
        },
        weaknesses: ['missing_isbn', 'inconsistent_author_format', 'low_accuracy_progress'],
        platform: 'READMOO'
      }

      // When: 獲取改善建議
      const suggestions = await dataQualityAnalyzer.getImprovementSuggestions(qualityAnalysis)

      // Then: 應該返回具體的改善建議
      expect(Array.isArray(suggestions)).toBe(true)
      expect(suggestions.length).toBeGreaterThan(0)

      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('priority')
        expect(suggestion).toHaveProperty('category')
        expect(suggestion).toHaveProperty('issue')
        expect(suggestion).toHaveProperty('recommendation')
        expect(suggestion).toHaveProperty('expectedImprovement')
        expect(['high', 'medium', 'low'].includes(suggestion.priority)).toBe(true)
      })
    })

    test('應該支援不同的品質評估策略', async () => {
      // Given: 不同的評估策略
      const book = {
        id: 'book_test',
        title: '測試書籍',
        authors: ['作者'],
        progress: 50
      }
      const strategies = ['strict', 'balanced', 'lenient']

      // When: 使用不同策略評估
      const scores = []
      for (const strategy of strategies) {
        const result = await dataQualityAnalyzer.getQualityScore(book, {
          weightingStrategy: strategy
        })
        scores.push({ strategy, score: result.overallScore })
      }

      // Then: 不同策略應該產生不同分數
      expect(scores.length).toBe(3)
      const strictScore = scores.find(s => s.strategy === 'strict').score
      const lenientScore = scores.find(s => s.strategy === 'lenient').score

      // 嚴格策略通常給較低分數，寬鬆策略給較高分數
      expect(strictScore).toBeLessThanOrEqual(lenientScore)
    })

    test('應該處理無效輸入和錯誤情況', async () => {
      // Given: 無效輸入
      const invalidInputs = [
        { book: null, platform: 'READMOO' },
        { book: {}, platform: '' },
        { book: { id: 'test' }, platform: 'INVALID_PLATFORM' }
      ]

      // When & Then: 應該適當處理錯誤
      for (const input of invalidInputs) {
        await expect(
          dataQualityAnalyzer.analyzeBookQuality(input.book, input.platform)
        ).rejects.toThrow()
      }
    })

    test('應該支援配置和統計資訊', () => {
      // Given: 品質分析器實例

      // When: 獲取統計資訊
      const stats = dataQualityAnalyzer.getStatistics()

      // Then: 應該返回統計資訊
      expect(stats).toHaveProperty('totalAnalyses')
      expect(stats).toHaveProperty('averageProcessingTime')
      expect(stats).toHaveProperty('qualityDistribution')
      expect(stats).toHaveProperty('mostCommonIssues')
      expect(typeof stats.totalAnalyses).toBe('number')

      // When: 更新配置
      const newConfig = { enableDetailedAnalysis: false }
      dataQualityAnalyzer.updateConfig(newConfig)

      // Then: 配置應該更新
      expect(dataQualityAnalyzer.config.enableDetailedAnalysis).toBe(false)
    })

    test('應該支援品質歷史追蹤', async () => {
      // Given: 書籍品質歷史
      const book = { id: 'book_tracked', title: '追蹤書籍' }
      const platform = 'READMOO'

      // Mock 回應
      mockValidationEngine.validateSingleBook.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      })

      mockDataNormalizer.normalizeBook.mockResolvedValue({
        normalizedData: book,
        normalizationReport: {
          qualityScore: 85,
          changesApplied: [],
          warningsGenerated: []
        }
      })

      // When: 多次分析同一本書
      const analysis1 = await dataQualityAnalyzer.analyzeBookQuality(book, platform)
      const analysis2 = await dataQualityAnalyzer.analyzeBookQuality(book, platform)

      // When: 獲取品質歷史
      const history = dataQualityAnalyzer.getQualityHistory(book.id)

      // Then: 應該追蹤品質變化
      expect(Array.isArray(history)).toBe(true)
      expect(history.length).toBeGreaterThanOrEqual(2)

      history.forEach(record => {
        expect(record).toHaveProperty('timestamp')
        expect(record).toHaveProperty('score')
        expect(record).toHaveProperty('analysis')
      })
    })
  })
})
