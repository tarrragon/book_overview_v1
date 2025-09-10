/**
 * EventNamingUpgradeCoordinator 測試檔案
 * 測試事件命名升級協調器的核心功能
 *
 * 測試重點：
 * - 事件轉換對應表驗證
 * - 雙軌並行事件處理
 * - 智能事件名稱推斷
 * - 轉換統計與監控
 * - 向後相容性保證
 */

const EventBus = require('src/core/event-bus')
const EventNamingUpgradeCoordinator = require('src/core/events/event-naming-upgrade-coordinator')

describe('EventNamingUpgradeCoordinator', () => {
  let eventBus
  let coordinator
  let mockEventData

  beforeEach(() => {
    eventBus = new EventBus()
    coordinator = new EventNamingUpgradeCoordinator(eventBus)
    mockEventData = {
      bookId: 'test-book-123',
      timestamp: Date.now(),
      source: 'test'
    }
  })

  afterEach(() => {
    eventBus.destroy()
  })

  describe('構造函數和初始化', () => {
    test('應該正確初始化預設設定', () => {
      expect(coordinator.eventBus).toBe(eventBus)
      expect(coordinator.conversionMode).toBe('DUAL_TRACK')
      expect(coordinator.conversionMap).toBeDefined()
      expect(coordinator.conversionStats).toBeDefined()
      expect(coordinator.modernEventRegistry).toBeInstanceOf(Set)
    })

    test('應該初始化轉換統計資料', () => {
      const stats = coordinator.conversionStats
      expect(stats.totalConversions).toBe(0)
      expect(stats.legacyTriggered).toBe(0)
      expect(stats.modernTriggered).toBe(0)
      expect(stats.conversionErrors).toBe(0)
    })

    test('應該載入事件轉換對應表', () => {
      const conversionMap = coordinator.conversionMap
      expect(conversionMap['EXTRACTION.COMPLETED']).toBe('EXTRACTION.READMOO.EXTRACT.COMPLETED')
      expect(conversionMap['STORAGE.SAVE.COMPLETED']).toBe('DATA.READMOO.SAVE.COMPLETED')
      expect(conversionMap['UI.POPUP.OPENED']).toBe('UX.GENERIC.OPEN.COMPLETED')
    })
  })

  describe('Legacy 事件轉換為 Modern 事件', () => {
    test('應該正確轉換已知的 Legacy 事件', () => {
      const legacyEvent = 'EXTRACTION.COMPLETED'
      const modernEvent = coordinator.convertToModernEvent(legacyEvent)
      expect(modernEvent).toBe('EXTRACTION.READMOO.EXTRACT.COMPLETED')
    })

    test('應該正確轉換多個已知 Legacy 事件', () => {
      const testCases = [
        ['EXTRACTION.PROGRESS', 'EXTRACTION.READMOO.EXTRACT.PROGRESS'],
        ['STORAGE.SAVE.COMPLETED', 'DATA.READMOO.SAVE.COMPLETED'],
        ['UI.POPUP.OPENED', 'UX.GENERIC.OPEN.COMPLETED'],
        ['BACKGROUND.INIT.COMPLETED', 'SYSTEM.GENERIC.INIT.COMPLETED']
      ]

      testCases.forEach(([legacy, expected]) => {
        const result = coordinator.convertToModernEvent(legacy)
        expect(result).toBe(expected)
      })
    })

    test('應該智能推斷未知 Legacy 事件的轉換', () => {
      const unknownLegacy = 'ANALYTICS.COUNT.UPDATED'
      const modernEvent = coordinator.convertToModernEvent(unknownLegacy)
      expect(modernEvent).toBe('ANALYTICS.GENERIC.COUNT.UPDATED')
    })

    test('應該處理無效格式的 Legacy 事件', () => {
      const invalidEvent = 'INVALID_FORMAT'
      const result = coordinator.convertToModernEvent(invalidEvent)
      expect(result).toBe(invalidEvent) // 保持原事件名稱
    })
  })

  describe('智能事件名稱推斷', () => {
    test('應該正確推斷 EXTRACTION 模組的領域和平台', () => {
      const legacyEvent = 'EXTRACTION.PROCESS.STARTED'
      const modernEvent = coordinator.buildModernEventName(legacyEvent)
      expect(modernEvent).toBe('EXTRACTION.READMOO.PROCESS.STARTED')
    })

    test('應該正確推斷 UI 模組的領域和平台', () => {
      const legacyEvent = 'UI.MODAL.CLOSED'
      const modernEvent = coordinator.buildModernEventName(legacyEvent)
      expect(modernEvent).toBe('UX.GENERIC.MODAL.CLOSED')
    })

    test('應該正確推斷 BACKGROUND 模組的領域和平台', () => {
      const legacyEvent = 'BACKGROUND.SERVICE.STARTED'
      const modernEvent = coordinator.buildModernEventName(legacyEvent)
      expect(modernEvent).toBe('SYSTEM.GENERIC.SERVICE.STARTED')
    })

    test('應該正確推斷 CONTENT 模組的領域和平台', () => {
      const legacyEvent = 'CONTENT.MESSAGE.SENT'
      const modernEvent = coordinator.buildModernEventName(legacyEvent)
      expect(modernEvent).toBe('MESSAGING.READMOO.MESSAGE.SENT')
    })
  })

  describe('雙軌並行事件處理', () => {
    test('應該註冊雙軌事件監聽器', async () => {
      const legacyEvent = 'EXTRACTION.COMPLETED'
      const modernEvent = 'EXTRACTION.READMOO.EXTRACT.COMPLETED'
      const handlerCalls = []

      const handler = (data) => {
        handlerCalls.push(data)
      }

      coordinator.registerDualTrackListener(legacyEvent, handler)

      // 檢查是否同時註冊了 Legacy 和 Modern 事件監聽器
      expect(eventBus.hasListener(legacyEvent)).toBe(true)
      expect(eventBus.hasListener(modernEvent)).toBe(true)
      expect(coordinator.modernEventRegistry.has(modernEvent)).toBe(true)
    })

    test('應該在觸發 Legacy 事件時同時觸發 Modern 事件', async () => {
      const legacyEvent = 'EXTRACTION.COMPLETED'
      const modernEvent = 'EXTRACTION.READMOO.EXTRACT.COMPLETED'
      const handlerCalls = []

      const handler = (eventObject) => {
        handlerCalls.push({ event: 'handled', eventObject })
      }

      coordinator.registerDualTrackListener(legacyEvent, handler)

      // 觸發 Legacy 事件
      await eventBus.emit(legacyEvent, mockEventData)

      // 應該呼叫處理器兩次（Legacy 和 Modern）
      expect(handlerCalls).toHaveLength(2)

      // 第一個呼叫應該是 Legacy 事件物件
      expect(handlerCalls[0].eventObject.type).toBe(legacyEvent)
      expect(handlerCalls[0].eventObject.data).toEqual(mockEventData)
      expect(handlerCalls[0].eventObject.isLegacy).toBe(true)
      expect(handlerCalls[0].eventObject.timestamp).toBeDefined()

      // 第二個呼叫應該是 Modern 事件物件
      expect(handlerCalls[1].eventObject.type).toBe(modernEvent)
      expect(handlerCalls[1].eventObject.data).toEqual(mockEventData)
      expect(handlerCalls[1].eventObject.isLegacy).toBe(false)
      expect(handlerCalls[1].eventObject.timestamp).toBeDefined()
    })

    test('應該記錄轉換統計', async () => {
      const legacyEvent = 'EXTRACTION.COMPLETED'
      const handler = () => {}

      coordinator.registerDualTrackListener(legacyEvent, handler)
      await eventBus.emit(legacyEvent, mockEventData)

      const stats = coordinator.getConversionStats()
      expect(stats.legacyEventCount).toBeGreaterThan(0)
      expect(stats.modernEventCount).toBeGreaterThan(0)
      expect(stats.totalConversions).toBeGreaterThan(0)
    })
  })

  describe('智能事件發射', () => {
    test('在 DUAL_TRACK 模式下應該同時發射 Legacy 和 Modern 事件', async () => {
      const legacyEvent = 'EXTRACTION.COMPLETED'
      const modernEvent = 'EXTRACTION.READMOO.EXTRACT.COMPLETED'
      const emittedEvents = []

      eventBus.on(legacyEvent, () => emittedEvents.push('legacy'))
      eventBus.on(modernEvent, () => emittedEvents.push('modern'))

      await coordinator.intelligentEmit(legacyEvent, mockEventData)

      expect(emittedEvents).toContain('legacy')
      expect(emittedEvents).toContain('modern')
    })

    test('在 MODERN_ONLY 模式下應該只發射 Modern 事件', async () => {
      coordinator.setConversionMode('MODERN_ONLY')

      const legacyEvent = 'EXTRACTION.COMPLETED'
      const modernEvent = 'EXTRACTION.READMOO.EXTRACT.COMPLETED'
      const emittedEvents = []

      eventBus.on(legacyEvent, () => emittedEvents.push('legacy'))
      eventBus.on(modernEvent, () => emittedEvents.push('modern'))

      await coordinator.intelligentEmit(legacyEvent, mockEventData)

      expect(emittedEvents).not.toContain('legacy')
      expect(emittedEvents).toContain('modern')
    })

    test('應該處理 Modern 事件的智能發射', async () => {
      // 確保處於雙軌模式
      coordinator.setConversionMode('DUAL_TRACK')

      const modernEvent = 'EXTRACTION.READMOO.EXTRACT.COMPLETED'
      const legacyEvent = 'EXTRACTION.COMPLETED'
      const emittedEvents = []

      eventBus.on(legacyEvent, () => emittedEvents.push('legacy'))
      eventBus.on(modernEvent, () => emittedEvents.push('modern'))

      await coordinator.intelligentEmit(modernEvent, mockEventData)

      expect(emittedEvents).toContain('legacy')
      expect(emittedEvents).toContain('modern')
    })
  })

  describe('事件識別和轉換', () => {
    test('應該正確識別 Legacy 事件', () => {
      expect(coordinator.isLegacyEvent('EXTRACTION.COMPLETED')).toBe(true)
      expect(coordinator.isLegacyEvent('UI.POPUP.OPENED')).toBe(true)
      expect(coordinator.isLegacyEvent('EXTRACTION.READMOO.EXTRACT.COMPLETED')).toBe(false)
    })

    test('應該正確轉換 Modern 事件為 Legacy 事件', () => {
      const modernEvent = 'EXTRACTION.READMOO.EXTRACT.COMPLETED'
      const legacyEvent = coordinator.convertToLegacyEvent(modernEvent)
      expect(legacyEvent).toBe('EXTRACTION.COMPLETED')
    })

    test('應該處理無對應 Legacy 事件的 Modern 事件', () => {
      const modernEvent = 'NEW_FEATURE.READMOO.ACTION.COMPLETED'
      const legacyEvent = coordinator.convertToLegacyEvent(modernEvent)
      expect(legacyEvent).toBeNull()
    })
  })

  describe('轉換統計與監控', () => {
    test('應該提供完整的轉換統計', () => {
      const stats = coordinator.getConversionStats()

      expect(stats).toHaveProperty('totalConversions')
      expect(stats).toHaveProperty('legacyEventCount')
      expect(stats).toHaveProperty('modernEventCount')
      expect(stats).toHaveProperty('conversionMode')
      expect(stats).toHaveProperty('modernEventsRegistered')
      expect(stats).toHaveProperty('conversionSuccessRate')
    })

    test('應該計算正確的轉換成功率', async () => {
      const handler = () => {}
      coordinator.registerDualTrackListener('EXTRACTION.COMPLETED', handler)

      await eventBus.emit('EXTRACTION.COMPLETED', mockEventData)

      const stats = coordinator.getConversionStats()
      expect(stats.conversionSuccessRate).toBeGreaterThan(0)
      expect(stats.conversionSuccessRate).toBeLessThanOrEqual(1)
    })

    test('應該追蹤 Modern 事件註冊數量', () => {
      coordinator.registerDualTrackListener('EXTRACTION.COMPLETED', () => {})
      coordinator.registerDualTrackListener('STORAGE.SAVE.COMPLETED', () => {})

      const stats = coordinator.getConversionStats()
      expect(stats.modernEventsRegistered).toBe(2)
    })
  })

  describe('轉換模式管理', () => {
    test('應該允許設定轉換模式', () => {
      coordinator.setConversionMode('MODERN_ONLY')
      expect(coordinator.conversionMode).toBe('MODERN_ONLY')

      coordinator.setConversionMode('DUAL_TRACK')
      expect(coordinator.conversionMode).toBe('DUAL_TRACK')
    })

    test('應該拒絕無效的轉換模式', () => {
      expect(() => {
        coordinator.setConversionMode('INVALID_MODE')
      }).toThrow('Invalid conversion mode')
    })

    test('應該提供轉換模式驗證', () => {
      expect(coordinator.isValidConversionMode('DUAL_TRACK')).toBe(true)
      expect(coordinator.isValidConversionMode('MODERN_ONLY')).toBe(true)
      expect(coordinator.isValidConversionMode('LEGACY_ONLY')).toBe(true)
      expect(coordinator.isValidConversionMode('INVALID')).toBe(false)
    })
  })

  describe('錯誤處理', () => {
    test('應該處理事件處理器中的錯誤', async () => {
      const errorHandler = () => {
        throw new Error('Handler error')
      }

      coordinator.registerDualTrackListener('EXTRACTION.COMPLETED', errorHandler)

      // 不應該拋出錯誤
      await expect(eventBus.emit('EXTRACTION.COMPLETED', mockEventData)).resolves.not.toThrow()

      const stats = coordinator.getConversionStats()
      expect(stats.conversionErrors).toBeGreaterThan(0)
    })

    test('應該記錄轉換錯誤統計', async () => {
      const initialStats = coordinator.getConversionStats()
      const initialErrors = initialStats.conversionErrors

      // 觸發轉換錯誤
      coordinator.recordConversionError('TEST_ERROR', 'Test error message')

      const updatedStats = coordinator.getConversionStats()
      expect(updatedStats.conversionErrors).toBe(initialErrors + 1)
    })
  })

  describe('向後相容性', () => {
    test('應該保持所有現有 Legacy 事件的功能', async () => {
      const legacyEvents = [
        'EXTRACTION.COMPLETED',
        'EXTRACTION.PROGRESS',
        'STORAGE.SAVE.COMPLETED',
        'UI.POPUP.OPENED',
        'BACKGROUND.INIT.COMPLETED'
      ]

      const handlerCalls = []
      const handler = (data) => handlerCalls.push(data)

      // 註冊所有 Legacy 事件
      legacyEvents.forEach(event => {
        coordinator.registerDualTrackListener(event, handler)
      })

      // 觸發所有 Legacy 事件
      for (const event of legacyEvents) {
        await eventBus.emit(event, mockEventData)
      }

      // 應該呼叫處理器（每個事件呼叫兩次：Legacy + Modern）
      expect(handlerCalls).toHaveLength(legacyEvents.length * 2)
    })

    test('應該不改變原有的事件處理器介面', () => {
      const originalHandler = jest.fn()

      // 使用原有的 EventBus API
      eventBus.on('EXTRACTION.COMPLETED', originalHandler)

      // 再使用新的雙軌 API
      coordinator.registerDualTrackListener('EXTRACTION.COMPLETED', originalHandler)

      // 兩者應該能共存
      expect(eventBus.hasListener('EXTRACTION.COMPLETED')).toBe(true)
    })
  })
})
