/**
 * EventPriorityManager 測試檔案
 * 測試事件優先級管理器的核心功能
 *
 * 測試重點：
 * - v2.0 事件優先級系統
 * - 事件分類和優先級分配
 * - 優先級驗證和調整
 * - 效能和執行順序
 */

const EventBus = require('../../../src/core/event-bus')
const EventPriorityManager = require('../../../src/core/events/event-priority-manager')

describe('EventPriorityManager', () => {
  let eventBus
  let priorityManager

  beforeEach(() => {
    eventBus = new EventBus()
    priorityManager = new EventPriorityManager()
  })

  afterEach(() => {
    eventBus.destroy()
  })

  describe('構造函數和初始化', () => {
    test('應該正確初始化優先級配置', () => {
      expect(priorityManager.priorityConfig).toBeDefined()
      expect(priorityManager.priorityConfig.SYSTEM_CRITICAL).toBeDefined()
      expect(priorityManager.priorityConfig.PLATFORM_MANAGEMENT).toBeDefined()
      expect(priorityManager.priorityConfig.USER_INTERACTION).toBeDefined()
      expect(priorityManager.priorityConfig.BUSINESS_PROCESSING).toBeDefined()
      expect(priorityManager.priorityConfig.BACKGROUND_PROCESSING).toBeDefined()
    })

    test('應該初始化優先級統計', () => {
      const stats = priorityManager.getPriorityStats()
      expect(stats.totalAssignments).toBe(0)
      expect(stats.priorityDistribution).toEqual({})
      expect(stats.avgAssignmentTime).toBe(0)
    })
  })

  describe('事件優先級分配', () => {
    test('應該為系統關鍵事件分配 SYSTEM_CRITICAL 優先級', () => {
      const testEvents = [
        'SYSTEM.GENERIC.ERROR.CRITICAL',
        'SECURITY.GENERIC.VIOLATION.DETECTED',
        'PLATFORM.GENERIC.FAILURE.CRITICAL'
      ]

      testEvents.forEach(eventName => {
        const priority = priorityManager.assignEventPriority(eventName)
        expect(priority).toBeGreaterThanOrEqual(0)
        expect(priority).toBeLessThanOrEqual(99)
      })
    })

    test('應該為平台管理事件分配 PLATFORM_MANAGEMENT 優先級', () => {
      const testEvents = [
        'PLATFORM.READMOO.SWITCH.STARTED',
        'PLATFORM.KINDLE.DETECT.COMPLETED',
        'PLATFORM.UNIFIED.SYNC.REQUESTED'
      ]

      testEvents.forEach(eventName => {
        const priority = priorityManager.assignEventPriority(eventName)
        expect(priority).toBeGreaterThanOrEqual(100)
        expect(priority).toBeLessThanOrEqual(199)
      })
    })

    test('應該為使用者互動事件分配 USER_INTERACTION 優先級', () => {
      const testEvents = [
        'UX.GENERIC.OPEN.STARTED',
        'EXTRACTION.READMOO.EXTRACT.REQUESTED',
        'DATA.READMOO.SAVE.REQUESTED'
      ]

      testEvents.forEach(eventName => {
        const priority = priorityManager.assignEventPriority(eventName)
        expect(priority).toBeGreaterThanOrEqual(200)
        expect(priority).toBeLessThanOrEqual(299)
      })
    })

    test('應該為一般業務處理事件分配 BUSINESS_PROCESSING 優先級', () => {
      const testEvents = [
        'EXTRACTION.READMOO.EXTRACT.PROGRESS',
        'DATA.READMOO.VALIDATE.COMPLETED',
        'MESSAGING.READMOO.FORWARD.COMPLETED'
      ]

      testEvents.forEach(eventName => {
        const priority = priorityManager.assignEventPriority(eventName)
        expect(priority).toBeGreaterThanOrEqual(300)
        expect(priority).toBeLessThanOrEqual(399)
      })
    })

    test('應該為背景處理事件分配 BACKGROUND_PROCESSING 優先級', () => {
      const testEvents = [
        'ANALYTICS.GENERIC.UPDATE.COMPLETED',
        'SYSTEM.GENERIC.CLEANUP.STARTED',
        'DATA.GENERIC.SYNC.PROGRESS'
      ]

      testEvents.forEach(eventName => {
        const priority = priorityManager.assignEventPriority(eventName)
        expect(priority).toBeGreaterThanOrEqual(400)
        expect(priority).toBeLessThanOrEqual(499)
      })
    })
  })

  describe('智能優先級推斷', () => {
    test('應該根據事件名稱智能推斷優先級類別', () => {
      const testCases = [
        ['SYSTEM.GENERIC.ERROR.CRITICAL', 'SYSTEM_CRITICAL'],
        ['PLATFORM.READMOO.DETECT.COMPLETED', 'PLATFORM_MANAGEMENT'],
        ['UX.GENERIC.CLICK.STARTED', 'USER_INTERACTION'],
        ['EXTRACTION.READMOO.PROCESS.PROGRESS', 'BUSINESS_PROCESSING'],
        ['ANALYTICS.GENERIC.LOG.COMPLETED', 'BACKGROUND_PROCESSING']
      ]

      testCases.forEach(([eventName, expectedCategory]) => {
        const category = priorityManager.inferPriorityCategory(eventName)
        expect(category).toBe(expectedCategory)
      })
    })

    test('應該處理不明確的事件名稱', () => {
      const ambiguousEvent = 'CUSTOM.MODULE.ACTION.STATE'
      const category = priorityManager.inferPriorityCategory(ambiguousEvent)
      expect(category).toBe('BUSINESS_PROCESSING') // 預設類別
    })

    test('應該根據關鍵字判斷優先級', () => {
      const criticalKeywords = ['ERROR', 'CRITICAL', 'URGENT', 'SECURITY']

      criticalKeywords.forEach(keyword => {
        const eventName = `SYSTEM.GENERIC.${keyword}.DETECTED`
        const category = priorityManager.inferPriorityCategory(eventName)
        expect(category).toBe('SYSTEM_CRITICAL')
      })
    })
  })

  describe('優先級驗證', () => {
    test('應該驗證優先級是否在有效範圍內', () => {
      expect(priorityManager.isValidPriority(50)).toBe(true)
      expect(priorityManager.isValidPriority(150)).toBe(true)
      expect(priorityManager.isValidPriority(350)).toBe(true)
      expect(priorityManager.isValidPriority(-1)).toBe(false)
      expect(priorityManager.isValidPriority(500)).toBe(false)
    })

    test('應該驗證優先級是否符合類別範圍', () => {
      expect(priorityManager.isPriorityInCategory(50, 'SYSTEM_CRITICAL')).toBe(true)
      expect(priorityManager.isPriorityInCategory(150, 'PLATFORM_MANAGEMENT')).toBe(true)
      expect(priorityManager.isPriorityInCategory(250, 'USER_INTERACTION')).toBe(true)
      expect(priorityManager.isPriorityInCategory(50, 'USER_INTERACTION')).toBe(false)
    })

    test('應該檢測優先級衝突', () => {
      priorityManager.recordEventPriority('TEST.EVENT', 50)
      priorityManager.recordEventPriority('TEST.EVENT', 150)

      const conflicts = priorityManager.detectPriorityConflicts()
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].eventName).toBe('TEST.EVENT')
      expect(conflicts[0].priorities).toEqual([50, 150])
    })
  })

  describe('優先級調整和最佳化', () => {
    test('應該能夠調整事件優先級', () => {
      const eventName = 'TEST.READMOO.ACTION.COMPLETED'
      const originalPriority = priorityManager.assignEventPriority(eventName)

      const newPriority = 150
      priorityManager.adjustEventPriority(eventName, newPriority)

      const adjustedPriority = priorityManager.getEventPriority(eventName)
      expect(adjustedPriority).toBe(newPriority)
    })

    test('應該最佳化重複事件的優先級分配', () => {
      const eventName = 'EXTRACTION.READMOO.EXTRACT.PROGRESS'

      // 分配多次相同事件
      for (let i = 0; i < 5; i++) {
        priorityManager.assignEventPriority(eventName)
      }

      priorityManager.optimizeEventPriorities()

      // 應該只有一個優先級分配
      const priorities = priorityManager.getEventPriorities(eventName)
      expect(new Set(priorities).size).toBe(1)
    })

    test('應該根據效能統計調整優先級', () => {
      const slowEvent = 'SLOW.READMOO.PROCESS.COMPLETED'
      const fastEvent = 'FAST.READMOO.PROCESS.COMPLETED'

      // 記錄效能統計
      priorityManager.recordPerformanceMetrics(slowEvent, { avgExecutionTime: 500 })
      priorityManager.recordPerformanceMetrics(fastEvent, { avgExecutionTime: 50 })

      priorityManager.optimizeBasedOnPerformance()

      const slowPriority = priorityManager.getEventPriority(slowEvent)
      const fastPriority = priorityManager.getEventPriority(fastEvent)

      // 慢的事件應該有較低的優先級（較大的數字）
      expect(slowPriority).toBeGreaterThan(fastPriority)
    })
  })

  describe('優先級統計和監控', () => {
    test('應該記錄優先級分配統計', () => {
      priorityManager.assignEventPriority('TEST.READMOO.ACTION.COMPLETED')
      priorityManager.assignEventPriority('SYSTEM.GENERIC.ERROR.CRITICAL')

      const stats = priorityManager.getPriorityStats()
      expect(stats.totalAssignments).toBe(2)
      expect(stats.priorityDistribution).toBeDefined()
    })

    test('應該提供優先級分佈分析', () => {
      // 分配不同類別的事件
      priorityManager.assignEventPriority('SYSTEM.GENERIC.ERROR.CRITICAL')
      priorityManager.assignEventPriority('UX.GENERIC.CLICK.STARTED')
      priorityManager.assignEventPriority('ANALYTICS.GENERIC.LOG.COMPLETED')

      const distribution = priorityManager.getPriorityDistribution()
      expect(distribution.SYSTEM_CRITICAL).toBeGreaterThan(0)
      expect(distribution.USER_INTERACTION).toBeGreaterThan(0)
      expect(distribution.BACKGROUND_PROCESSING).toBeGreaterThan(0)
    })

    test('應該監控優先級調整歷史', () => {
      const eventName = 'TEST.READMOO.ACTION.COMPLETED'
      const originalPriority = priorityManager.assignEventPriority(eventName)

      priorityManager.adjustEventPriority(eventName, 150)
      priorityManager.adjustEventPriority(eventName, 200)

      const history = priorityManager.getPriorityHistory(eventName)
      expect(history).toHaveLength(3) // 原始 + 2次調整
      expect(history[0].priority).toBe(originalPriority)
      expect(history[1].priority).toBe(150)
      expect(history[2].priority).toBe(200)
    })
  })

  describe('與 EventBus 整合', () => {
    test('應該整合優先級到 EventBus 註冊', () => {
      const eventName = 'EXTRACTION.READMOO.EXTRACT.COMPLETED'
      const handler = jest.fn()

      priorityManager.registerWithPriority(eventBus, eventName, handler)

      expect(eventBus.hasListener(eventName)).toBe(true)

      const expectedPriority = priorityManager.getEventPriority(eventName)
      expect(expectedPriority).toBeGreaterThanOrEqual(300) // BUSINESS_PROCESSING
    })

    test('應該按優先級順序執行事件處理器', async () => {
      const executionOrder = []

      const urgentHandler = () => executionOrder.push('urgent')
      const normalHandler = () => executionOrder.push('normal')
      const lowHandler = () => executionOrder.push('low')

      // 註冊不同優先級的處理器
      priorityManager.registerWithPriority(eventBus, 'SYSTEM.GENERIC.ERROR.CRITICAL', urgentHandler)
      priorityManager.registerWithPriority(eventBus, 'EXTRACTION.READMOO.EXTRACT.COMPLETED', normalHandler)
      priorityManager.registerWithPriority(eventBus, 'ANALYTICS.GENERIC.LOG.COMPLETED', lowHandler)

      // 同時觸發所有事件
      await Promise.all([
        eventBus.emit('ANALYTICS.GENERIC.LOG.COMPLETED'),
        eventBus.emit('SYSTEM.GENERIC.ERROR.CRITICAL'),
        eventBus.emit('EXTRACTION.READMOO.EXTRACT.COMPLETED')
      ])

      // 應該按優先級順序執行
      expect(executionOrder).toEqual(['urgent', 'normal', 'low'])
    })
  })

  describe('錯誤處理', () => {
    test('應該處理無效的事件名稱', () => {
      expect(() => {
        priorityManager.assignEventPriority('')
      }).toThrow('Invalid event name')

      expect(() => {
        priorityManager.assignEventPriority(null)
      }).toThrow('Invalid event name')
    })

    test('應該處理無效的優先級調整', () => {
      const eventName = 'TEST.READMOO.ACTION.COMPLETED'

      expect(() => {
        priorityManager.adjustEventPriority(eventName, -1)
      }).toThrow('Invalid priority value')

      expect(() => {
        priorityManager.adjustEventPriority(eventName, 1000)
      }).toThrow('Invalid priority value')
    })

    test('應該記錄優先級錯誤統計', () => {
      try {
        priorityManager.adjustEventPriority('INVALID', -1)
      } catch (error) {
        // 預期錯誤
      }

      const stats = priorityManager.getPriorityStats()
      expect(stats.errors).toBeGreaterThan(0)
    })
  })

  describe('效能測試', () => {
    test('應該在合理時間內完成大量優先級分配', () => {
      const startTime = performance.now()

      for (let i = 0; i < 1000; i++) {
        priorityManager.assignEventPriority(`TEST.READMOO.ACTION.COMPLETED_${i}`)
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(100) // 應該在 100ms 內完成
    })

    test('應該有效地檢測大量事件的優先級衝突', () => {
      // 創建一些衝突
      for (let i = 0; i < 100; i++) {
        priorityManager.recordEventPriority('CONFLICT_EVENT', i)
      }

      const startTime = performance.now()
      const conflicts = priorityManager.detectPriorityConflicts()
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(50) // 應該在 50ms 內完成
      expect(conflicts).toHaveLength(1)
    })
  })
})
