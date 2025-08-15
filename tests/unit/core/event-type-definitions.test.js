/**
 * EventTypeDefinitions 測試檔案
 * 測試事件類型定義的核心功能
 *
 * 測試重點：
 * - v2.0 事件命名格式驗證
 * - 事件類型定義和規範
 * - 命名約定驗證
 * - 事件結構完整性
 */

const EventTypeDefinitions = require('../../../src/core/events/event-type-definitions')

describe('EventTypeDefinitions', () => {
  let eventTypes

  beforeEach(() => {
    eventTypes = new EventTypeDefinitions()
  })

  describe('構造函數和初始化', () => {
    test('應該正確初始化事件類型定義', () => {
      expect(eventTypes.domains).toBeDefined()
      expect(eventTypes.platforms).toBeDefined()
      expect(eventTypes.actions).toBeDefined()
      expect(eventTypes.states).toBeDefined()
    })

    test('應該載入完整的領域定義', () => {
      const expectedDomains = [
        'SYSTEM', 'PLATFORM', 'EXTRACTION', 'DATA',
        'MESSAGING', 'PAGE', 'UX', 'SECURITY', 'ANALYTICS'
      ]

      expectedDomains.forEach(domain => {
        expect(eventTypes.domains).toContain(domain)
      })
    })

    test('應該載入完整的平台定義', () => {
      const expectedPlatforms = [
        'READMOO', 'KINDLE', 'KOBO', 'BOOKS_COM',
        'BOOKWALKER', 'UNIFIED', 'MULTI', 'GENERIC'
      ]

      expectedPlatforms.forEach(platform => {
        expect(eventTypes.platforms).toContain(platform)
      })
    })

    test('應該載入完整的動作定義', () => {
      const expectedActions = [
        'INIT', 'START', 'STOP', 'EXTRACT', 'SAVE', 'LOAD',
        'DETECT', 'SWITCH', 'VALIDATE', 'PROCESS', 'SYNC',
        'OPEN', 'CLOSE', 'UPDATE', 'DELETE', 'CREATE'
      ]

      expectedActions.forEach(action => {
        expect(eventTypes.actions).toContain(action)
      })
    })

    test('應該載入完整的狀態定義', () => {
      const expectedStates = [
        'REQUESTED', 'STARTED', 'PROGRESS', 'COMPLETED',
        'FAILED', 'CANCELLED', 'TIMEOUT', 'SUCCESS', 'ERROR'
      ]

      expectedStates.forEach(state => {
        expect(eventTypes.states).toContain(state)
      })
    })
  })

  describe('事件名稱格式驗證', () => {
    test('應該驗證正確的 v2.0 事件名稱格式', () => {
      const validEvents = [
        'EXTRACTION.READMOO.EXTRACT.COMPLETED',
        'DATA.READMOO.SAVE.COMPLETED',
        'UX.GENERIC.OPEN.COMPLETED',
        'SYSTEM.GENERIC.INIT.COMPLETED',
        'PLATFORM.READMOO.DETECT.COMPLETED'
      ]

      validEvents.forEach(eventName => {
        expect(eventTypes.isValidEventName(eventName)).toBe(true)
      })
    })

    test('應該拒絕無效的事件名稱格式', () => {
      const invalidEvents = [
        'EXTRACTION.COMPLETED', // 舊格式
        'EXTRACTION.READMOO.EXTRACT', // 缺少狀態
        'EXTRACTION.READMOO', // 缺少動作和狀態
        'extraction.readmoo.extract.completed', // 小寫
        'EXTRACTION_READMOO_EXTRACT_COMPLETED', // 使用底線
        'EXTRACTION.READMOO.EXTRACT.COMPLETED.EXTRA' // 過多部分
      ]

      invalidEvents.forEach(eventName => {
        expect(eventTypes.isValidEventName(eventName)).toBe(false)
      })
    })

    test('應該驗證事件名稱各部分的有效性', () => {
      const testCases = [
        ['EXTRACTION.READMOO.EXTRACT.COMPLETED', true],
        ['INVALID_DOMAIN.READMOO.EXTRACT.COMPLETED', false],
        ['EXTRACTION.INVALID_PLATFORM.EXTRACT.COMPLETED', false],
        ['EXTRACTION.READMOO.INVALID_ACTION.COMPLETED', false],
        ['EXTRACTION.READMOO.EXTRACT.INVALID_STATE', false]
      ]

      testCases.forEach(([eventName, expected]) => {
        expect(eventTypes.isValidEventName(eventName)).toBe(expected)
      })
    })
  })

  describe('事件類型分解和驗證', () => {
    test('應該正確分解事件名稱', () => {
      const eventName = 'EXTRACTION.READMOO.EXTRACT.COMPLETED'
      const parts = eventTypes.parseEventName(eventName)

      expect(parts.domain).toBe('EXTRACTION')
      expect(parts.platform).toBe('READMOO')
      expect(parts.action).toBe('EXTRACT')
      expect(parts.state).toBe('COMPLETED')
    })

    test('應該驗證領域部分', () => {
      expect(eventTypes.isValidDomain('EXTRACTION')).toBe(true)
      expect(eventTypes.isValidDomain('INVALID')).toBe(false)
      expect(eventTypes.isValidDomain('')).toBe(false)
    })

    test('應該驗證平台部分', () => {
      expect(eventTypes.isValidPlatform('READMOO')).toBe(true)
      expect(eventTypes.isValidPlatform('GENERIC')).toBe(true)
      expect(eventTypes.isValidPlatform('INVALID')).toBe(false)
      expect(eventTypes.isValidPlatform('')).toBe(false)
    })

    test('應該驗證動作部分', () => {
      expect(eventTypes.isValidAction('EXTRACT')).toBe(true)
      expect(eventTypes.isValidAction('SAVE')).toBe(true)
      expect(eventTypes.isValidAction('INVALID')).toBe(false)
      expect(eventTypes.isValidAction('')).toBe(false)
    })

    test('應該驗證狀態部分', () => {
      expect(eventTypes.isValidState('COMPLETED')).toBe(true)
      expect(eventTypes.isValidState('FAILED')).toBe(true)
      expect(eventTypes.isValidState('INVALID')).toBe(false)
      expect(eventTypes.isValidState('')).toBe(false)
    })
  })

  describe('事件類型建構', () => {
    test('應該建構有效的事件名稱', () => {
      const eventName = eventTypes.buildEventName('EXTRACTION', 'READMOO', 'EXTRACT', 'COMPLETED')
      expect(eventName).toBe('EXTRACTION.READMOO.EXTRACT.COMPLETED')
    })

    test('應該拒絕無效的事件建構參數', () => {
      expect(() => {
        eventTypes.buildEventName('INVALID', 'READMOO', 'EXTRACT', 'COMPLETED')
      }).toThrow('Invalid domain')

      expect(() => {
        eventTypes.buildEventName('EXTRACTION', 'INVALID', 'EXTRACT', 'COMPLETED')
      }).toThrow('Invalid platform')

      expect(() => {
        eventTypes.buildEventName('EXTRACTION', 'READMOO', 'INVALID', 'COMPLETED')
      }).toThrow('Invalid action')

      expect(() => {
        eventTypes.buildEventName('EXTRACTION', 'READMOO', 'EXTRACT', 'INVALID')
      }).toThrow('Invalid state')
    })

    test('應該支援部分事件名稱建構', () => {
      const partialName = eventTypes.buildPartialEventName('EXTRACTION', 'READMOO')
      expect(partialName).toBe('EXTRACTION.READMOO')
    })
  })

  describe('事件類型查詢', () => {
    test('應該根據領域查詢相關平台', () => {
      const extractionPlatforms = eventTypes.getPlatformsForDomain('EXTRACTION')
      expect(extractionPlatforms).toContain('READMOO')
      expect(extractionPlatforms).toContain('KINDLE')
      expect(extractionPlatforms).toContain('KOBO')
    })

    test('應該根據平台查詢相關動作', () => {
      const readmooActions = eventTypes.getActionsForPlatform('READMOO')
      expect(readmooActions).toContain('EXTRACT')
      expect(readmooActions).toContain('SAVE')
      expect(readmooActions).toContain('LOAD')
      expect(readmooActions).toContain('DETECT')
    })

    test('應該根據動作查詢相關狀態', () => {
      const extractStates = eventTypes.getStatesForAction('EXTRACT')
      expect(extractStates).toContain('STARTED')
      expect(extractStates).toContain('PROGRESS')
      expect(extractStates).toContain('COMPLETED')
      expect(extractStates).toContain('FAILED')
    })

    test('應該查詢事件類型的完整定義', () => {
      const definition = eventTypes.getEventDefinition('EXTRACTION.READMOO.EXTRACT.COMPLETED')

      expect(definition.domain).toBe('EXTRACTION')
      expect(definition.platform).toBe('READMOO')
      expect(definition.action).toBe('EXTRACT')
      expect(definition.state).toBe('COMPLETED')
      expect(definition.description).toBeDefined()
      expect(definition.category).toBeDefined()
    })
  })

  describe('事件類型分類', () => {
    test('應該正確分類系統相關事件', () => {
      const systemEvents = [
        'SYSTEM.GENERIC.INIT.COMPLETED',
        'SYSTEM.GENERIC.ERROR.DETECTED',
        'SECURITY.GENERIC.VIOLATION.DETECTED'
      ]

      systemEvents.forEach(eventName => {
        const category = eventTypes.getEventCategory(eventName)
        expect(category).toBe('SYSTEM')
      })
    })

    test('應該正確分類業務處理事件', () => {
      const businessEvents = [
        'EXTRACTION.READMOO.EXTRACT.COMPLETED',
        'DATA.READMOO.SAVE.COMPLETED',
        'DATA.READMOO.VALIDATE.COMPLETED'
      ]

      businessEvents.forEach(eventName => {
        const category = eventTypes.getEventCategory(eventName)
        expect(category).toBe('BUSINESS')
      })
    })

    test('應該正確分類使用者介面事件', () => {
      const uiEvents = [
        'UX.GENERIC.OPEN.COMPLETED',
        'UX.GENERIC.CLOSE.COMPLETED',
        'UX.GENERIC.RENDER.COMPLETED'
      ]

      uiEvents.forEach(eventName => {
        const category = eventTypes.getEventCategory(eventName)
        expect(category).toBe('UI')
      })
    })

    test('應該正確分類平台管理事件', () => {
      const platformEvents = [
        'PLATFORM.READMOO.DETECT.COMPLETED',
        'PLATFORM.READMOO.SWITCH.REQUESTED',
        'PLATFORM.UNIFIED.SYNC.REQUESTED'
      ]

      platformEvents.forEach(eventName => {
        const category = eventTypes.getEventCategory(eventName)
        expect(category).toBe('PLATFORM')
      })
    })
  })

  describe('事件類型驗證規則', () => {
    test('應該驗證事件名稱長度限制', () => {
      const longEventName = 'A'.repeat(100) + '.READMOO.EXTRACT.COMPLETED'
      expect(eventTypes.isValidEventName(longEventName)).toBe(false)
    })

    test('應該驗證事件名稱字符限制', () => {
      const invalidChars = [
        'EXTRACTION.READMOO.EXTRACT.COMPLETED!',
        'EXTRACTION.READMOO.EXTRACT.COMPLETED@',
        'EXTRACTION.READMOO.EXTRACT.COMPLETED#',
        'EXTRACTION.READMOO.EXTRACT.COMPLETED$'
      ]

      invalidChars.forEach(eventName => {
        expect(eventTypes.isValidEventName(eventName)).toBe(false)
      })
    })

    test('應該驗證事件各部分的命名規範', () => {
      // 測試小寫字母
      expect(eventTypes.isValidEventName('extraction.readmoo.extract.completed')).toBe(false)

      // 測試數字開頭
      expect(eventTypes.isValidEventName('1EXTRACTION.READMOO.EXTRACT.COMPLETED')).toBe(false)

      // 測試特殊字符
      expect(eventTypes.isValidEventName('EXTRACTION-.READMOO.EXTRACT.COMPLETED')).toBe(false)
    })
  })

  describe('事件類型建議', () => {
    test('應該為無效事件名稱提供建議', () => {
      const suggestions = eventTypes.suggestCorrections('EXTRACTION.COMPLETED')

      expect(suggestions).toHaveLength(1)
      expect(suggestions[0]).toContain('EXTRACTION.READMOO.EXTRACT.COMPLETED')
    })

    test('應該為拼寫錯誤提供建議', () => {
      const suggestions = eventTypes.suggestCorrections('EXTRACTOIN.READMOO.EXTRACT.COMPLETED')

      expect(suggestions).toContain('EXTRACTION.READMOO.EXTRACT.COMPLETED')
    })

    test('應該為部分匹配提供多個建議', () => {
      const suggestions = eventTypes.suggestCorrections('PLATFORM.READMOO.DET')

      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.some(s => s.includes('DETECT'))).toBe(true)
    })
  })

  describe('事件類型統計', () => {
    test('應該提供事件類型使用統計', () => {
      // 記錄一些事件使用
      eventTypes.recordEventUsage('EXTRACTION.READMOO.EXTRACT.COMPLETED')
      eventTypes.recordEventUsage('DATA.READMOO.SAVE.COMPLETED')
      eventTypes.recordEventUsage('EXTRACTION.READMOO.EXTRACT.COMPLETED')

      const stats = eventTypes.getUsageStats()
      expect(stats.totalEvents).toBe(3)
      expect(stats.uniqueEvents).toBe(2)
      expect(stats.mostUsedEvents[0].eventName).toBe('EXTRACTION.READMOO.EXTRACT.COMPLETED')
      expect(stats.mostUsedEvents[0].count).toBe(2)
    })

    test('應該提供領域分佈統計', () => {
      eventTypes.recordEventUsage('EXTRACTION.READMOO.EXTRACT.COMPLETED')
      eventTypes.recordEventUsage('DATA.READMOO.SAVE.COMPLETED')
      eventTypes.recordEventUsage('UX.GENERIC.OPEN.COMPLETED')

      const distribution = eventTypes.getDomainDistribution()
      expect(distribution.EXTRACTION).toBe(1)
      expect(distribution.DATA).toBe(1)
      expect(distribution.UX).toBe(1)
    })

    test('應該提供平台分佈統計', () => {
      eventTypes.recordEventUsage('EXTRACTION.READMOO.EXTRACT.COMPLETED')
      eventTypes.recordEventUsage('EXTRACTION.KINDLE.EXTRACT.COMPLETED')
      eventTypes.recordEventUsage('UX.GENERIC.OPEN.COMPLETED')

      const distribution = eventTypes.getPlatformDistribution()
      expect(distribution.READMOO).toBe(1)
      expect(distribution.KINDLE).toBe(1)
      expect(distribution.GENERIC).toBe(1)
    })
  })

  describe('錯誤處理', () => {
    test('應該處理 null 或 undefined 事件名稱', () => {
      expect(eventTypes.isValidEventName(null)).toBe(false)
      expect(eventTypes.isValidEventName(undefined)).toBe(false)
      expect(eventTypes.isValidEventName('')).toBe(false)
    })

    test('應該處理非字串類型的事件名稱', () => {
      expect(eventTypes.isValidEventName(123)).toBe(false)
      expect(eventTypes.isValidEventName({})).toBe(false)
      expect(eventTypes.isValidEventName([])).toBe(false)
    })

    test('應該記錄驗證錯誤統計', () => {
      eventTypes.isValidEventName('INVALID.FORMAT')
      eventTypes.isValidEventName('ANOTHER.INVALID')

      const errorStats = eventTypes.getValidationErrorStats()
      expect(errorStats.totalErrors).toBe(2)
      expect(errorStats.errorTypes.INVALID_FORMAT).toBeGreaterThan(0)
    })
  })

  describe('效能測試', () => {
    test('應該快速驗證大量事件名稱', () => {
      const eventNames = []
      for (let i = 0; i < 1000; i++) {
        eventNames.push(`EXTRACTION.READMOO.EXTRACT.COMPLETED_${i}`)
      }

      const startTime = performance.now()
      eventNames.forEach(name => eventTypes.isValidEventName(name))
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(100) // 應該在 100ms 內完成
    })

    test('應該快速建構大量事件名稱', () => {
      const startTime = performance.now()

      for (let i = 0; i < 1000; i++) {
        eventTypes.buildEventName('EXTRACTION', 'READMOO', 'EXTRACT', 'COMPLETED')
      }

      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(50) // 應該在 50ms 內完成
    })
  })
})
