/**
 * @fileoverview Validation Service 單元測試
 *
 * 對應 domain-map 不變式：必填欄位（id, title）缺失時驗證失敗；
 * batch 驗證回傳每本書的個別結果。
 */

const ValidationService = require('src/background/domains/extraction/services/validation-service.js')

describe('ValidationService', () => {
  let service
  let mockLogger

  beforeEach(async () => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }

    service = new ValidationService({ logger: mockLogger })
    await service.initialize()
  })

  describe('validateData() 必填欄位驗證（book_basic 規則群組）', () => {
    test('缺少 id 時驗證應失敗', async () => {
      const result = await service.validateData({ title: '書名', author: '作者' }, 'book_basic')

      expect(result.valid).toBe(false)
      expect(result.errors.some(err => err.field === 'id')).toBe(true)
    })

    test('缺少 title 時驗證應失敗', async () => {
      const result = await service.validateData({ id: 'book-00001', author: '作者' }, 'book_basic')

      expect(result.valid).toBe(false)
      expect(result.errors.some(err => err.field === 'title')).toBe(true)
    })

    test('id、title、author 皆存在且格式正確時驗證應通過', async () => {
      const result = await service.validateData(
        { id: 'book-00001', title: '完整書名', author: '作者姓名' },
        'book_basic'
      )

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('validateBatch() 批次驗證回傳每筆資料的個別結果', () => {
    test('應回傳與輸入項目數量相同的個別驗證結果，且各自獨立判定', async () => {
      const dataItems = [
        { id: 'book-00001', title: '書名一', author: '作者一' }, // 合法
        { title: '缺少 id', author: '作者二' }, // 缺 id
        { id: 'book-00003', author: '作者三' } // 缺 title
      ]

      const { results, summary } = await service.validateBatch(dataItems, 'book_basic')

      expect(results).toHaveLength(3)
      expect(results[0].valid).toBe(true)
      expect(results[1].valid).toBe(false)
      expect(results[2].valid).toBe(false)
      expect(summary.total).toBe(3)
      expect(summary.valid).toBe(1)
      expect(summary.invalid).toBe(2)
    })
  })

  describe('calculateQualityScore() 品質分數計算', () => {
    test('無錯誤與警告時品質分數應為 1.0', () => {
      const score = service.calculateQualityScore({ errors: [], warnings: [] })
      expect(score).toBe(1.0)
    })

    test('有錯誤時品質分數應低於 1.0', () => {
      const score = service.calculateQualityScore({
        errors: [{ field: 'id' }],
        warnings: []
      })
      expect(score).toBeLessThan(1.0)
    })
  })
})
