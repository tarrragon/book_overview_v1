/**
 * IPlatformRuleManager 介面測試
 *
 * 測試目標：
 * - 驗證平台規則管理介面契約
 * - 測試平台規則載入、快取和查詢功能
 * - 確保多平台支援的一致性
 * - 驗證規則格式和驗證邏輯
 *
 * @jest-environment jsdom
 */

describe('IPlatformRuleManager TDD 介面契約測試', () => {
  let platformRuleManager

  beforeEach(() => {
    // 這裡會實例化 PlatformRuleManager，目前會失敗因為類別尚未建立
    const PlatformRuleManager = require('src/background/domains/data-management/services/PlatformRuleManager.js')
    platformRuleManager = new PlatformRuleManager({
      enableCache: true,
      cacheTimeout: 300000,
      supportedPlatforms: ['READMOO', 'KINDLE', 'KOBO', 'BOOKWALKER', 'BOOKS_COM'],
      autoLoadOnInit: false // 測試時關閉自動載入
    })
  })

  describe('🔴 Red 階段：介面契約驗證', () => {
    test('應該正確實作 IPlatformRuleManager 介面', () => {
      // Given: PlatformRuleManager 實例

      // Then: 應該實作所有必要的介面方法
      expect(typeof platformRuleManager.getRulesForPlatform).toBe('function')
      expect(typeof platformRuleManager.getPlatformSchema).toBe('function')
      expect(typeof platformRuleManager.loadPlatformRules).toBe('function')
      expect(typeof platformRuleManager.isRuleSupported).toBe('function')
      expect(typeof platformRuleManager.getFieldRequirements).toBe('function')
      expect(typeof platformRuleManager.validatePlatformSupport).toBe('function')
      expect(platformRuleManager.isInitialized).toBeDefined()
    })

    test('getRulesForPlatform() 應該返回平台特定規則', () => {
      // Given: 支援的平台名稱
      const platforms = ['READMOO', 'KINDLE', 'KOBO', 'BOOKWALKER', 'BOOKS_COM']

      platforms.forEach(platform => {
        // When: 獲取平台規則
        const rules = platformRuleManager.getRulesForPlatform(platform)

        // Then: 應該返回標準化的規則結構
        expect(rules).toHaveProperty('requiredFields')
        expect(rules).toHaveProperty('dataTypes')
        expect(rules).toHaveProperty('businessRules')
        expect(rules).toHaveProperty('validationConfig')
        expect(Array.isArray(rules.requiredFields)).toBe(true)
        expect(typeof rules.dataTypes).toBe('object')
        expect(typeof rules.businessRules).toBe('object')
      })
    })

    test('getPlatformSchema() 應該返回平台資料架構', () => {
      // Given: 平台名稱
      const platform = 'READMOO'

      // When: 獲取平台架構
      const schema = platformRuleManager.getPlatformSchema(platform)

      // Then: 應該返回標準架構定義
      expect(schema).toHaveProperty('fields')
      expect(schema).toHaveProperty('constraints')
      expect(schema).toHaveProperty('relationships')
      expect(schema).toHaveProperty('metadata')
      expect(typeof schema.fields).toBe('object')
      expect(Array.isArray(schema.constraints)).toBe(true)
      expect(schema.metadata.platform).toBe(platform)
    })

    test('loadPlatformRules() 應該載入並快取平台規則', async () => {
      // Given: 未載入規則的平台
      const platform = 'KINDLE'

      // When: 載入平台規則
      const loadResult = await platformRuleManager.loadPlatformRules(platform)

      // Then: 應該成功載入並快取規則
      expect(loadResult.success).toBe(true)
      expect(loadResult.platform).toBe(platform)
      expect(loadResult).toHaveProperty('rulesLoaded')
      expect(loadResult).toHaveProperty('cacheStatus')
      expect(loadResult).toHaveProperty('loadTime')

      // 再次載入應該使用快取
      const cachedResult = await platformRuleManager.loadPlatformRules(platform)
      expect(cachedResult.cacheStatus).toBe('HIT')
    })

    test('isRuleSupported() 應該檢查規則支援狀態', () => {
      // Given: 不同的規則和平台組合
      const testCases = [
        { platform: 'READMOO', rule: 'progressValidation', expected: true },
        { platform: 'KINDLE', rule: 'coverImageValidation', expected: true },
        { platform: 'UNSUPPORTED_PLATFORM', rule: 'anyRule', expected: false },
        { platform: 'READMOO', rule: 'nonExistentRule', expected: false }
      ]

      testCases.forEach(({ platform, rule, expected }) => {
        // When: 檢查規則支援
        const isSupported = platformRuleManager.isRuleSupported(platform, rule)

        // Then: 應該返回正確的支援狀態
        expect(typeof isSupported).toBe('boolean')
        expect(isSupported).toBe(expected)
      })
    })

    test('getFieldRequirements() 應該返回欄位需求規格', () => {
      // Given: 平台和欄位
      const platform = 'READMOO'
      const fields = ['title', 'authors', 'progress', 'isbn']

      // When: 獲取欄位需求
      const requirements = platformRuleManager.getFieldRequirements(platform, fields)

      // Then: 應該返回詳細的欄位需求
      expect(Array.isArray(requirements)).toBe(true)
      expect(requirements.length).toBe(fields.length)

      requirements.forEach(requirement => {
        expect(requirement).toHaveProperty('field')
        expect(requirement).toHaveProperty('required')
        expect(requirement).toHaveProperty('type')
        expect(requirement).toHaveProperty('constraints')
        expect(requirement).toHaveProperty('validationRules')
        expect(typeof requirement.required).toBe('boolean')
      })
    })

    test('validatePlatformSupport() 應該驗證平台支援', () => {
      // Given: 不同的平台名稱
      const supportedPlatforms = ['READMOO', 'KINDLE', 'KOBO', 'BOOKWALKER', 'BOOKS_COM']
      const unsupportedPlatforms = ['UNKNOWN', '', null, undefined]

      // When & Then: 驗證支援的平台
      supportedPlatforms.forEach(platform => {
        const result = platformRuleManager.validatePlatformSupport(platform)
        expect(result.isSupported).toBe(true)
        expect(result.platform).toBe(platform)
        expect(result).toHaveProperty('capabilities')
      })

      // When & Then: 驗證不支援的平台
      unsupportedPlatforms.forEach(platform => {
        const result = platformRuleManager.validatePlatformSupport(platform)
        expect(result.isSupported).toBe(false)
        expect(result).toHaveProperty('reason')
      })
    })

    test('應該支援平台特定的驗證規則', () => {
      // Given: 不同平台的特殊需求
      const readmooRules = platformRuleManager.getRulesForPlatform('READMOO')
      const kindleRules = platformRuleManager.getRulesForPlatform('KINDLE')

      // Then: 每個平台應該有其特定規則
      expect(readmooRules).not.toEqual(kindleRules) // 規則應該不同

      // READMOO 特定規則檢查
      expect(readmooRules.requiredFields).toContain('id')
      expect(readmooRules.requiredFields).toContain('title')
      expect(readmooRules.dataTypes.progress).toBe('number')

      // KINDLE 特定規則檢查
      expect(kindleRules.requiredFields).toContain('asin') // Kindle特有ID
      expect(kindleRules.businessRules).toHaveProperty('kindleSpecificValidation')
    })

    test('應該處理規則快取和失效機制', async () => {
      // Given: 快取配置
      const platform = 'KOBO'

      // When: 首次載入規則
      const firstLoad = await platformRuleManager.loadPlatformRules(platform)
      expect(firstLoad.cacheStatus).toBe('MISS')

      // When: 再次載入（應該從快取）
      const secondLoad = await platformRuleManager.loadPlatformRules(platform)
      expect(secondLoad.cacheStatus).toBe('HIT')
      expect(secondLoad.loadTime).toBeLessThanOrEqual(firstLoad.loadTime)

      // When: 清除快取
      const clearResult = platformRuleManager.clearPlatformCache(platform)
      expect(clearResult.success).toBe(true)

      // When: 清除快取後再載入
      const afterClearLoad = await platformRuleManager.loadPlatformRules(platform)
      expect(afterClearLoad.cacheStatus).toBe('MISS')
    })

    test('應該處理無效輸入和錯誤情況', () => {
      // Given: 無效輸入
      const invalidPlatforms = [null, undefined, '', 'INVALID_PLATFORM']
      const invalidRules = [null, undefined, '']

      // When & Then: 應該優雅處理無效平台
      invalidPlatforms.forEach(platform => {
        expect(() => {
          platformRuleManager.getRulesForPlatform(platform)
        }).toThrow()
      })

      // When & Then: 應該優雅處理無效規則查詢
      invalidRules.forEach(rule => {
        expect(
          platformRuleManager.isRuleSupported('READMOO', rule)
        ).toBe(false)
      })
    })

    test('應該支援規則版本管理', () => {
      // Given: 平台規則版本資訊
      const platform = 'READMOO'

      // When: 獲取規則版本
      const versionInfo = platformRuleManager.getRuleVersion(platform)

      // Then: 應該包含版本資訊
      expect(versionInfo).toHaveProperty('version')
      expect(versionInfo).toHaveProperty('lastUpdated')
      expect(versionInfo).toHaveProperty('checksum')
      expect(typeof versionInfo.version).toBe('string')
      expect(versionInfo.lastUpdated instanceof Date).toBe(true)
      expect(typeof versionInfo.checksum).toBe('string')
    })

    test('應該支援批次載入和初始化', async () => {
      // Given: 多個平台
      const platforms = ['READMOO', 'KINDLE', 'KOBO']

      // When: 批次載入所有平台規則
      const batchResult = await platformRuleManager.loadAllPlatforms(platforms)

      // Then: 應該成功載入所有平台
      expect(batchResult.success).toBe(true)
      expect(batchResult.loaded).toEqual(platforms)
      expect(batchResult.failed).toEqual([])
      expect(batchResult).toHaveProperty('totalLoadTime')

      // 所有平台都應該可用
      platforms.forEach(platform => {
        expect(
          platformRuleManager.validatePlatformSupport(platform).isSupported
        ).toBe(true)
      })
    })

    test('應該提供規則統計和診斷資訊', () => {
      // Given: 已載入的規則管理器

      // When: 獲取統計資訊
      const stats = platformRuleManager.getStatistics()

      // Then: 應該包含完整統計資訊
      expect(stats).toHaveProperty('loadedPlatforms')
      expect(stats).toHaveProperty('cacheHitRate')
      expect(stats).toHaveProperty('totalRulesLoaded')
      expect(stats).toHaveProperty('averageLoadTime')
      expect(stats).toHaveProperty('memoryUsage')
      expect(Array.isArray(stats.loadedPlatforms)).toBe(true)
      expect(typeof stats.cacheHitRate).toBe('number')
      expect(typeof stats.totalRulesLoaded).toBe('number')
    })
  })
})
