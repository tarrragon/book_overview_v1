/**
 * @fileoverview Config Management Service 單元測試
 *
 * 對應 domain-map 不變式：配置必有預設值；使用者覆蓋不影響預設值完整性。
 *
 * 「使用者覆蓋不影響預設值完整性」在本實作對應兩層保證：
 * 1. 套用配置更新（applyConfigurationUpdates）不會修改模組常數 DEFAULT_CONFIG 本身。
 * 2. 更新內容未通過驗證器時，更新被拒且目前配置維持原值（不被部分套用）。
 */

const ConfigManagementService = require('src/background/domains/system/services/config-management-service.js')
const { DEFAULT_CONFIG } = require('src/background/constants/module-constants')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

describe('ConfigManagementService', () => {
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

    service = new ConfigManagementService({ logger: mockLogger, eventBus: mockEventBus })
  })

  describe('配置必有預設值', () => {
    test('服務建立時，目前配置應等於預設配置', () => {
      expect(service.getCurrentConfiguration()).toEqual(DEFAULT_CONFIG)
    })

    test('驗證預設配置本身應通過所有必要配置項檢查', async () => {
      const validation = await service.validateConfiguration(DEFAULT_CONFIG)

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toEqual([])
    })

    test('缺少必要配置項時，驗證應回報對應錯誤', async () => {
      const incompleteConfig = { ...DEFAULT_CONFIG }
      delete incompleteConfig.debugMode

      const validation = await service.validateConfiguration(incompleteConfig)

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('缺少必要配置項: debugMode')
    })
  })

  describe('使用者覆蓋不影響預設值完整性', () => {
    test('套用配置更新後，模組常數 DEFAULT_CONFIG 本身不應被修改', async () => {
      const originalDefaultConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG))

      await service.applyConfigurationUpdates({ debugMode: true })

      expect(DEFAULT_CONFIG).toEqual(originalDefaultConfig)
    })

    test('套用配置更新後，目前配置反映覆蓋值同時保留未覆蓋的預設值', async () => {
      await service.applyConfigurationUpdates({ debugMode: true })

      const current = service.getCurrentConfiguration()
      expect(current.debugMode).toBe(true)
      expect(current.logLevel).toBe(DEFAULT_CONFIG.logLevel)
      expect(current.isEnabled).toBe(DEFAULT_CONFIG.isEnabled)
    })

    test('註冊自訂驗證器後，套用不合法更新應被拒且目前配置維持原值', async () => {
      service.registerConfigurationValidator('logLevel_validator', (value) =>
        ['info', 'debug', 'warn', 'error'].includes(value)
      )

      await expect(
        service.applyConfigurationUpdates({ logLevel: 'invalid-level' })
      ).rejects.toMatchObject({
        code: ErrorCodes.VALIDATION_ERROR,
        details: { category: 'validation' }
      })

      expect(service.getCurrentConfiguration().logLevel).toBe(DEFAULT_CONFIG.logLevel)
    })
  })
})
