/**
 * DataValidationService 重構測試
 * TDD 重構循環 1/8: ValidationRuleManager 提取
 * 
 * 目標：將驗證規則管理邏輯從 DataValidationService 中提取
 */

const ValidationRuleManager = require('../../../../../../src/background/domains/data-management/services/validation-rule-manager.js')

describe('ValidationRuleManager - 驗證規則管理服務', () => {
  let ruleManager
  let mockEventBus
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

    ruleManager = new ValidationRuleManager(mockEventBus, {
      logger: mockLogger,
      config: {
        supportedPlatforms: ['READMOO', 'KINDLE', 'KOBO', 'BOOKWALKER', 'BOOKS_COM']
      }
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('🏗️ 服務初始化', () => {
    test('應該正確初始化驗證規則管理器', () => {
      expect(ruleManager).toBeInstanceOf(ValidationRuleManager)
      expect(ruleManager.eventBus).toBe(mockEventBus)
      expect(ruleManager.logger).toBe(mockLogger)
    })

    test('應該初始化支援的平台列表', () => {
      expect(ruleManager.supportedPlatforms).toEqual(['READMOO', 'KINDLE', 'KOBO', 'BOOKWALKER', 'BOOKS_COM'])
    })

    test('應該初始化驗證規則容器', () => {
      expect(ruleManager.validationRules).toBeInstanceOf(Map)
      expect(ruleManager.validationRules.size).toBe(0)
    })
  })

  describe('📋 平台規則載入', () => {
    test('loadPlatformValidationRules() 應該載入 READMOO 平台規則', async () => {
      const result = await ruleManager.loadPlatformValidationRules('READMOO')
      
      expect(result.success).toBe(true)
      expect(result.platform).toBe('READMOO')
      expect(ruleManager.validationRules.has('READMOO')).toBe(true)
      
      const rules = ruleManager.validationRules.get('READMOO')
      expect(rules.requiredFields).toBeDefined()
      expect(rules.dataTypes).toBeDefined()
      expect(rules.businessRules).toBeDefined()
    })

    test('loadPlatformValidationRules() 應該載入所有支援平台規則', async () => {
      const platforms = ['READMOO', 'KINDLE', 'KOBO', 'BOOKWALKER', 'BOOKS_COM']
      
      for (const platform of platforms) {
        const result = await ruleManager.loadPlatformValidationRules(platform)
        expect(result.success).toBe(true)
        expect(ruleManager.validationRules.has(platform)).toBe(true)
      }
      
      expect(ruleManager.validationRules.size).toBe(5)
    })

    test('loadPlatformValidationRules() 應該拒絕不支援的平台', async () => {
      await expect(ruleManager.loadPlatformValidationRules('UNSUPPORTED'))
        .rejects.toThrow('Platform UNSUPPORTED is not supported')
    })

    test('loadPlatformValidationRules() 應該支援規則快取', async () => {
      // 第一次載入
      await ruleManager.loadPlatformValidationRules('READMOO')
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('載入 READMOO 驗證規則'))
      
      // 第二次載入應該使用快取
      mockLogger.info.mockClear()
      const result = await ruleManager.loadPlatformValidationRules('READMOO')
      
      expect(result.cached).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('快取'))
    })
  })

  describe('🔍 規則檢索與驗證', () => {
    beforeEach(async () => {
      await ruleManager.loadPlatformValidationRules('READMOO')
    })

    test('getValidationRules() 應該返回平台的驗證規則', () => {
      const rules = ruleManager.getValidationRules('READMOO')
      
      expect(rules).toBeDefined()
      expect(rules.requiredFields).toContain('id')
      expect(rules.requiredFields).toContain('title')
      expect(rules.dataTypes.id).toBe('string')
      expect(rules.dataTypes.title).toBe('string')
    })

    test('getValidationRules() 應該處理未載入的平台', () => {
      const rules = ruleManager.getValidationRules('UNLOADED')
      expect(rules).toBeNull()
    })

    test('validateRuleStructure() 應該驗證規則結構完整性', () => {
      const validRules = {
        requiredFields: ['id', 'title'],
        dataTypes: { id: 'string', title: 'string' },
        businessRules: { progressRange: { min: 0, max: 100 } }
      }
      
      const isValid = ruleManager.validateRuleStructure(validRules)
      expect(isValid).toBe(true)
    })

    test('validateRuleStructure() 應該檢測無效的規則結構', () => {
      const invalidRules = {
        requiredFields: ['id'],
        // 缺少 dataTypes 和 businessRules
      }
      
      const isValid = ruleManager.validateRuleStructure(invalidRules)
      expect(isValid).toBe(false)
    })
  })

  describe('🔧 規則管理操作', () => {
    test('updatePlatformRules() 應該支援動態更新平台規則', async () => {
      await ruleManager.loadPlatformValidationRules('READMOO')
      
      const newRules = {
        requiredFields: ['id', 'title', 'authors'],
        dataTypes: { id: 'string', title: 'string', authors: 'array' },
        businessRules: { progressRange: { min: 0, max: 100 } }
      }
      
      const result = await ruleManager.updatePlatformRules('READMOO', newRules)
      
      expect(result.success).toBe(true)
      const updatedRules = ruleManager.getValidationRules('READMOO')
      expect(updatedRules.requiredFields).toContain('authors')
    })

    test('clearPlatformRules() 應該清除平台規則', () => {
      ruleManager.validationRules.set('TEST', { requiredFields: [] })
      
      const result = ruleManager.clearPlatformRules('TEST')
      
      expect(result.success).toBe(true)
      expect(ruleManager.validationRules.has('TEST')).toBe(false)
    })

    test('clearAllRules() 應該清除所有規則', () => {
      ruleManager.validationRules.set('TEST1', { requiredFields: [] })
      ruleManager.validationRules.set('TEST2', { requiredFields: [] })
      
      ruleManager.clearAllRules()
      
      expect(ruleManager.validationRules.size).toBe(0)
    })
  })

  describe('📊 統計與監控', () => {
    test('getRuleStatistics() 應該提供規則載入統計', async () => {
      await ruleManager.loadPlatformValidationRules('READMOO')
      await ruleManager.loadPlatformValidationRules('KINDLE')
      
      const stats = ruleManager.getRuleStatistics()
      
      expect(stats.loadedPlatforms).toBe(2)
      expect(stats.supportedPlatforms).toBe(5)
      expect(stats.loadedPlatformsList).toContain('READMOO')
      expect(stats.loadedPlatformsList).toContain('KINDLE')
    })

    test('isRuleManagerHealthy() 應該檢查服務健康狀態', () => {
      const health = ruleManager.isRuleManagerHealthy()
      
      expect(health.isHealthy).toBeDefined()
      expect(health.rulesLoaded).toBeDefined()
      expect(health.errorCount).toBeDefined()
    })
  })

  describe('🔊 事件處理', () => {
    test('應該發送規則載入完成事件', async () => {
      await ruleManager.loadPlatformValidationRules('READMOO')
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'VALIDATION.RULES.LOADED',
        expect.objectContaining({
          platform: 'READMOO',
          rulesCount: expect.any(Number)
        })
      )
    })

    test('應該處理規則更新請求事件', () => {
      expect(mockEventBus.on).toHaveBeenCalledWith(
        'VALIDATION.RULES.UPDATE_REQUEST',
        expect.any(Function)
      )
    })
  })

  describe('⚠️ 錯誤處理', () => {
    test('constructor 應該要求 eventBus 參數', () => {
      expect(() => {
        new ValidationRuleManager()
      }).toThrow('EventBus is required')
    })

    test('應該處理規則載入失敗', async () => {
      // 模擬規則載入失敗
      jest.spyOn(ruleManager, '_loadRulesForPlatform').mockRejectedValue(new Error('載入失敗'))
      
      await expect(ruleManager.loadPlatformValidationRules('READMOO'))
        .rejects.toThrow('載入失敗')
    })

    test('應該處理損壞的規則檔案', async () => {
      jest.spyOn(ruleManager, '_loadRulesForPlatform').mockResolvedValue(null)
      
      await expect(ruleManager.loadPlatformValidationRules('READMOO'))
        .rejects.toThrow('Failed to load validation rules for platform READMOO')
    })
  })
})