/**
 * IValidationEngine 介面測試
 *
 * 測試目標：
 * - 驗證核心驗證引擎介面契約
 * - 測試單書驗證、欄位驗證和業務規則驗證
 * - 確保介面的一致性和可擴展性
 * - 驗證錯誤處理和驗證結果格式
 *
 * @jest-environment jsdom
 */

// Mock 類別定義（TDD Phase 1 - 測試先行）
class ValidationEngine {
  constructor (config = {}) {
    this.platformRuleManager = config.platformRuleManager
    this.config = {
      strictMode: config.strictMode || false,
      enableCache: config.enableCache || true,
      ...config
    }
  }

  validate (data) {
    return { valid: true, errors: [], warnings: [] }
  }

  validateBook (book) {
    return { valid: true, errors: [] }
  }

  validateSingleBook (book) {
    return {
      valid: true,
      errors: [],
      warnings: [],
      validatedFields: ['id', 'title', 'author']
    }
  }

  validateRequiredFields (book) {
    // eslint-disable-next-line no-unused-vars
    const requiredFields = ['id', 'title', 'author']
    // eslint-disable-next-line no-unused-vars
    const missing = requiredFields.filter(field => !book[field])
    return {
      valid: missing.length === 0,
      missingFields: missing,
      presentFields: requiredFields.filter(field => book[field])
    }
  }

  validateDataTypes (book) {
    return {
      valid: true,
      typeErrors: [],
      validatedFields: Object.keys(book)
    }
  }

  validateBusinessRules (book) {
    return {
      valid: true,
      ruleViolations: [],
      appliedRules: ['title_length', 'author_format']
    }
  }

  validateBatch (books) {
    return books.map(book => this.validateBook(book))
  }

  setValidationRules (rules) {
    this.rules = rules
  }

  getValidationRules (platform) {
    return this.platformRuleManager.getRulesForPlatform(platform)
  }

  get isInitialized () {
    return true
  }
}

describe('IValidationEngine TDD 介面契約測試', () => {
  let validationEngine
  // eslint-disable-next-line no-unused-vars
  let mockPlatformRuleManager

  beforeEach(() => {
    // Mock IPlatformRuleManager 依賴
    mockPlatformRuleManager = {
      getRulesForPlatform: jest.fn(),
      getPlatformSchema: jest.fn(),
      isRuleSupported: jest.fn(),
      getFieldRequirements: jest.fn()
    }

    validationEngine = new ValidationEngine({
      platformRuleManager: mockPlatformRuleManager
    })
  })

  describe('🔴 Red 階段：介面契約驗證', () => {
    test('應該正確實作 IValidationEngine 介面', () => {
      // Given: ValidationEngine 實例

      // Then: 應該實作所有必要的介面方法
      expect(typeof validationEngine.validateSingleBook).toBe('function')
      expect(typeof validationEngine.validateRequiredFields).toBe('function')
      expect(typeof validationEngine.validateDataTypes).toBe('function')
      expect(typeof validationEngine.validateBusinessRules).toBe('function')
      expect(typeof validationEngine.getValidationRules).toBe('function')
      expect(validationEngine.isInitialized).toBeDefined()
    })

    test('validateSingleBook() 應該返回標準化的驗證結果', async () => {
      // Given: 有效的書籍資料
      // eslint-disable-next-line no-unused-vars
      const book = {
        id: 'book_123',
        title: '測試書籍',
        authors: ['作者A'],
        progress: 75,
        platform: 'READMOO'
      }
      // eslint-disable-next-line no-unused-vars
      const platform = 'READMOO'
      // eslint-disable-next-line no-unused-vars
      const source = 'extraction'

      // Mock 平台規則
      mockPlatformRuleManager.getRulesForPlatform.mockReturnValue({
        requiredFields: ['id', 'title', 'authors'],
        dataTypes: {
          id: 'string',
          title: 'string',
          authors: 'array',
          progress: 'number'
        },
        businessRules: {
          progressRange: [0, 100],
          titleMinLength: 1
        }
      })

      // When: 驗證單本書籍
      // eslint-disable-next-line no-unused-vars
      const result = await validationEngine.validateSingleBook(book, platform, source)

      // Then: 應該返回標準格式的驗證結果
      expect(result).toHaveProperty('isValid')
      expect(result).toHaveProperty('bookId', 'book_123')
      expect(result).toHaveProperty('platform', platform)
      expect(result).toHaveProperty('validationResults')
      expect(result).toHaveProperty('warnings')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('processingTime')
      expect(typeof result.isValid).toBe('boolean')
      expect(Array.isArray(result.warnings)).toBe(true)
      expect(Array.isArray(result.errors)).toBe(true)
    })

    test('validateRequiredFields() 應該檢查必填欄位', async () => {
      // Given: 缺少必填欄位的書籍
      // eslint-disable-next-line no-unused-vars
      const validation = {
        book: {
          id: 'book_123',
          title: '測試書籍'
          // 缺少 authors 欄位
        },
        results: {
          requiredFields: { passed: false, errors: [] }
        }
      }
      // eslint-disable-next-line no-unused-vars
      const rules = {
        requiredFields: ['id', 'title', 'authors']
      }

      // When: 驗證必填欄位
      await validationEngine.validateRequiredFields(validation, rules)

      // Then: 應該識別缺少的欄位
      expect(validation.results.requiredFields.passed).toBe(false)
      expect(validation.results.requiredFields.errors).toContainEqual(
        expect.objectContaining({
          type: 'MISSING_REQUIRED_FIELD',
          field: 'authors'
        })
      )
    })

    test('validateDataTypes() 應該驗證資料類型', async () => {
      // Given: 有錯誤資料類型的書籍
      // eslint-disable-next-line no-unused-vars
      const validation = {
        book: {
          id: 'book_123',
          title: '測試書籍',
          authors: 'single_author_string', // 應該是陣列
          progress: '75' // 應該是數字
        },
        results: {
          dataTypes: { passed: false, errors: [] }
        }
      }
      // eslint-disable-next-line no-unused-vars
      const rules = {
        dataTypes: {
          id: 'string',
          title: 'string',
          authors: 'array',
          progress: 'number'
        }
      }

      // When: 驗證資料類型
      await validationEngine.validateDataTypes(validation, rules)

      // Then: 應該識別類型錯誤
      expect(validation.results.dataTypes.passed).toBe(false)
      expect(validation.results.dataTypes.errors).toContainEqual(
        expect.objectContaining({
          type: 'TYPE_MISMATCH',
          field: 'authors',
          expected: 'array',
          actual: 'string'
        })
      )
      expect(validation.results.dataTypes.errors).toContainEqual(
        expect.objectContaining({
          type: 'TYPE_MISMATCH',
          field: 'progress',
          expected: 'number',
          actual: 'string'
        })
      )
    })

    test('validateBusinessRules() 應該執行商業規則驗證', async () => {
      // Given: 違反商業規則的書籍
      // eslint-disable-next-line no-unused-vars
      const validation = {
        book: {
          id: 'book_123',
          title: '', // 太短
          progress: 150 // 超出範圍
        },
        results: {
          businessRules: { passed: false, errors: [] }
        }
      }
      // eslint-disable-next-line no-unused-vars
      const rules = {
        businessRules: {
          titleMinLength: 1,
          progressRange: [0, 100]
        }
      }

      // When: 驗證商業規則
      await validationEngine.validateBusinessRules(validation, rules)

      // Then: 應該識別商業規則違反
      expect(validation.results.businessRules.passed).toBe(false)
      expect(validation.results.businessRules.errors).toContainEqual(
        expect.objectContaining({
          type: 'BUSINESS_RULE_VIOLATION',
          rule: 'titleMinLength',
          field: 'title'
        })
      )
      expect(validation.results.businessRules.errors).toContainEqual(
        expect.objectContaining({
          type: 'BUSINESS_RULE_VIOLATION',
          rule: 'progressRange',
          field: 'progress'
        })
      )
    })

    test('getValidationRules() 應該獲取平台驗證規則', () => {
      // Given: 平台名稱
      // eslint-disable-next-line no-unused-vars
      const platform = 'READMOO'
      // eslint-disable-next-line no-unused-vars
      const expectedRules = {
        requiredFields: ['id', 'title'],
        dataTypes: { id: 'string' }
      }

      // Mock 規則管理器
      mockPlatformRuleManager.getRulesForPlatform.mockReturnValue(expectedRules)

      // When: 獲取驗證規則
      // eslint-disable-next-line no-unused-vars
      const rules = validationEngine.getValidationRules(platform)

      // Then: 應該返回平台特定規則
      expect(mockPlatformRuleManager.getRulesForPlatform).toHaveBeenCalledWith(platform)
      expect(rules).toEqual(expectedRules)
    })

    test('應該處理無效輸入和錯誤情況', async () => {
      // Given: 無效輸入
      // eslint-disable-next-line no-unused-vars
      const nullBook = null
      // eslint-disable-next-line no-unused-vars
      const emptyPlatform = ''
      // eslint-disable-next-line no-unused-vars
      const undefinedSource = undefined

      // When & Then: 應該拋出適當錯誤
      await expect(
        validationEngine.validateSingleBook(nullBook, 'READMOO', 'test')
      ).rejects.toMatchObject({
        code: 'INVALID_INPUT_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })

      await expect(
        validationEngine.validateSingleBook({ id: '1' }, emptyPlatform, 'test')
      ).rejects.toMatchObject({
        code: 'TEST_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })

      await expect(
        validationEngine.validateSingleBook({ id: '1' }, 'READMOO', undefinedSource)
      ).rejects.toMatchObject({
        code: 'TEST_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })
    })

    test('應該支援依賴注入配置', () => {
      // Given: 自訂配置
      // eslint-disable-next-line no-unused-vars
      const customConfig = {
        platformRuleManager: mockPlatformRuleManager,
        strictMode: true,
        enableCache: false,
        validationTimeout: 3000
      }

      // When: 建立驗證引擎
      // eslint-disable-next-line no-unused-vars
      const customEngine = new ValidationEngine(customConfig)

      // Then: 應該使用注入的依賴和配置
      expect(customEngine.platformRuleManager).toBe(mockPlatformRuleManager)
      expect(customEngine.config.strictMode).toBe(true)
      expect(customEngine.config.enableCache).toBe(false)
      expect(customEngine.config.validationTimeout).toBe(3000)
    })
  })
})
