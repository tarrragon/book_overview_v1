/**
 * 事件系統 v2.0 核心整合測試
 *
 * 負責功能：
 * - EventNamingUpgradeCoordinator 與整個系統的整合驗證
 * - EventPriorityManager 的優先級處理整合測試
 * - EventTypeDefinitions 的類型系統整合驗證
 * - 三大核心組件的協作整合測試
 *
 * 測試策略：
 * - 真實環境模擬測試
 * - 端對端事件處理流程測試
 * - 效能和穩定性驗證
 * - 向後相容性完整驗證
 *
 * 整合測試範圍：
 * - 事件轉換準確性 100% 驗證
 * - 優先級管理完整性測試
 * - 事件類型驗證系統測試
 * - 統計和監控功能整合測試
 */

// eslint-disable-next-line no-unused-vars
const EventBus = require('@/core/event-bus')
// eslint-disable-next-line no-unused-vars
const EventNamingUpgradeCoordinator = require('@/core/events/event-naming-upgrade-coordinator')
// eslint-disable-next-line no-unused-vars
const EventPriorityManager = require('@/core/events/event-priority-manager')
// eslint-disable-next-line no-unused-vars
const EventTypeDefinitions = require('@/core/events/event-type-definitions')

describe('🧪 事件系統 v2.0 核心整合測試', () => {
  // eslint-disable-next-line no-unused-vars
  let eventBus
  let namingCoordinator
  let priorityManager
  let typeDefinitions

  beforeEach(async () => {
    // 初始化完整的事件系統 v2.0 整合環境
    eventBus = new EventBus()
    priorityManager = new EventPriorityManager()
    typeDefinitions = new EventTypeDefinitions()
    namingCoordinator = new EventNamingUpgradeCoordinator(eventBus)

    // 等待系統初始化完成
    await new Promise(resolve => setTimeout(resolve, 50))
  })

  afterEach(async () => {
    // 清理資源和重置狀態
    if (eventBus && typeof eventBus.removeAllListeners === 'function') {
      eventBus.removeAllListeners()
    }

    // 重置統計資料
    if (namingCoordinator) {
      namingCoordinator.conversionStats = namingCoordinator.initializeStats()
    }

    if (priorityManager) {
      priorityManager.priorityStats = priorityManager.initializePriorityStats()
    }
  })

  describe('🔧 EventNamingUpgradeCoordinator 整合測試', () => {
    describe('事件轉換準確性驗證', () => {
      test('應該正確轉換所有 Legacy 事件到 Modern 格式', async () => {
        // eslint-disable-next-line no-unused-vars
        const legacyEvents = [
          'EXTRACTION.COMPLETED',
          'EXTRACTION.PROGRESS',
          'EXTRACTION.STARTED',
          'EXTRACTION.FAILED',
          'STORAGE.SAVE.COMPLETED',
          'STORAGE.LOAD.COMPLETED',
          'UI.POPUP.OPENED',
          'BACKGROUND.INIT.COMPLETED'
        ]

        // eslint-disable-next-line no-unused-vars
        const expectedModernEvents = [
          'EXTRACTION.READMOO.EXTRACT.COMPLETED',
          'EXTRACTION.READMOO.EXTRACT.PROGRESS',
          'EXTRACTION.READMOO.EXTRACT.STARTED',
          'EXTRACTION.READMOO.EXTRACT.FAILED',
          'DATA.READMOO.SAVE.COMPLETED',
          'DATA.READMOO.LOAD.COMPLETED',
          'UX.GENERIC.OPEN.COMPLETED',
          'SYSTEM.GENERIC.INIT.COMPLETED'
        ]

        // 測試每個 Legacy 事件的轉換
        for (let i = 0; i < legacyEvents.length; i++) {
          // eslint-disable-next-line no-unused-vars
          const legacyEvent = legacyEvents[i]
          // eslint-disable-next-line no-unused-vars
          const expectedModern = expectedModernEvents[i]

          // eslint-disable-next-line no-unused-vars
          const actualModern = namingCoordinator.convertToModernEvent(legacyEvent)

          expect(actualModern).toBe(expectedModern)
        }

        // 驗證轉換統計
        // eslint-disable-next-line no-unused-vars
        const stats = namingCoordinator.getConversionStats()
        expect(stats.totalConversions).toBeGreaterThanOrEqual(0)
      })

      test('應該正確處理智能事件名稱推斷', async () => {
        // eslint-disable-next-line no-unused-vars
        const testCases = [
          {
            input: 'ANALYTICS.COUNT.UPDATED',
            expectedDomain: 'ANALYTICS',
            expectedPlatform: 'GENERIC',
            expectedAction: 'COUNT',
            expectedState: 'UPDATED'
          },
          {
            input: 'EXPORT.DATA.REQUESTED',
            expectedDomain: 'DATA',
            expectedPlatform: 'GENERIC',
            expectedAction: 'DATA',
            expectedState: 'REQUESTED'
          }
        ]

        for (const testCase of testCases) {
          // eslint-disable-next-line no-unused-vars
          const modernEvent = namingCoordinator.buildModernEventName(testCase.input)
          // eslint-disable-next-line no-unused-vars
          const parts = modernEvent.split('.')

          expect(parts).toHaveLength(4)
          expect(parts[0]).toBe(testCase.expectedDomain)
          expect(parts[1]).toBe(testCase.expectedPlatform)
          expect(parts[2]).toBe(testCase.expectedAction)
          expect(parts[3]).toBe(testCase.expectedState)
        }
      })

      test('應該支援雙軌並行事件處理', async () => {
        // eslint-disable-next-line no-unused-vars
        const testEventData = { testData: 'integration-test', timestamp: Date.now() }
        // eslint-disable-next-line no-unused-vars
        const legacyEventName = 'EXTRACTION.COMPLETED'

        // 設置監聽器來捕捉兩種格式的事件
        // eslint-disable-next-line no-unused-vars
        const legacyEventReceived = jest.fn()
        // eslint-disable-next-line no-unused-vars
        const modernEventReceived = jest.fn()

        // 註冊雙軌監聽器
        namingCoordinator.registerDualTrackListener(legacyEventName, (event) => {
          if (event.type === legacyEventName) {
            legacyEventReceived(event)
          } else {
            modernEventReceived(event)
          }
        })

        // 發射 Legacy 事件
        await namingCoordinator.intelligentEmit(legacyEventName, testEventData)

        // 等待事件處理完成
        await new Promise(resolve => setTimeout(resolve, 100))

        // 驗證雙軌事件都被正確處理
        expect(legacyEventReceived).toHaveBeenCalled()
        expect(modernEventReceived).toHaveBeenCalled()

        // 驗證事件資料正確性
        // eslint-disable-next-line no-unused-vars
        const legacyCall = legacyEventReceived.mock.calls[0][0]
        // eslint-disable-next-line no-unused-vars
        const modernCall = modernEventReceived.mock.calls[0][0]

        expect(legacyCall.data).toEqual(testEventData)
        expect(modernCall.data).toEqual(testEventData)
      })

      test('應該正確處理轉換模式切換', async () => {
        // eslint-disable-next-line no-unused-vars
        const testEventData = { mode: 'test' }
        // eslint-disable-next-line no-unused-vars
        const legacyEvent = 'STORAGE.SAVE.COMPLETED'

        // 測試 DUAL_TRACK 模式
        namingCoordinator.setConversionMode('DUAL_TRACK')
        await namingCoordinator.intelligentEmit(legacyEvent, testEventData)

        // 測試 MODERN_ONLY 模式
        namingCoordinator.setConversionMode('MODERN_ONLY')
        await namingCoordinator.intelligentEmit(legacyEvent, testEventData)

        // 測試 LEGACY_ONLY 模式
        namingCoordinator.setConversionMode('LEGACY_ONLY')
        await namingCoordinator.intelligentEmit(legacyEvent, testEventData)

        // 驗證統計資料反映了不同模式的使用
        // eslint-disable-next-line no-unused-vars
        const stats = namingCoordinator.getConversionStats()
        expect(stats.totalConversions).toBeGreaterThan(0)
        expect(stats.conversionMode).toBe('LEGACY_ONLY') // 最後設定的模式
      })
    })

    describe('轉換統計和監控整合', () => {
      test('應該準確記錄轉換統計資料', async () => {
        // eslint-disable-next-line no-unused-vars
        const initialStats = namingCoordinator.getConversionStats()
        // eslint-disable-next-line no-unused-vars
        const legacyEvents = ['EXTRACTION.COMPLETED', 'STORAGE.SAVE.COMPLETED', 'UI.POPUP.OPENED']

        // 觸發多個轉換
        for (const event of legacyEvents) {
          await namingCoordinator.intelligentEmit(event, { test: true })
        }

        // eslint-disable-next-line no-unused-vars
        const finalStats = namingCoordinator.getConversionStats()

        // 驗證統計資料更新
        expect(finalStats.totalConversions).toBeGreaterThan(initialStats.totalConversions)
        expect(finalStats.conversionSuccessRate).toBeGreaterThanOrEqual(0)
        expect(finalStats.conversionSuccessRate).toBeLessThanOrEqual(1)
        expect(finalStats.modernEventsRegistered).toBeGreaterThanOrEqual(0)
      })

      test('應該正確計算轉換成功率', async () => {
        // 執行一系列已知的成功轉換
        // eslint-disable-next-line no-unused-vars
        const successfulEvents = [
          'EXTRACTION.COMPLETED',
          'STORAGE.SAVE.COMPLETED',
          'UI.POPUP.OPENED'
        ]

        for (const event of successfulEvents) {
          await namingCoordinator.intelligentEmit(event, { success: true })
        }

        // eslint-disable-next-line no-unused-vars
        const stats = namingCoordinator.getConversionStats()

        // 由於這些都是預定義的轉換，成功率應該很高
        expect(stats.conversionSuccessRate).toBeGreaterThan(0.9)
        expect(stats.conversionErrors).toBe(0)
      })

      test('應該追蹤事件使用頻率統計', async () => {
        // eslint-disable-next-line no-unused-vars
        const testEvent = 'EXTRACTION.COMPLETED'
        // eslint-disable-next-line no-unused-vars
        const repeatCount = 5

        // 重複觸發相同事件
        for (let i = 0; i < repeatCount; i++) {
          await namingCoordinator.intelligentEmit(testEvent, { iteration: i })
        }

        // eslint-disable-next-line no-unused-vars
        const stats = namingCoordinator.getConversionStats()
        expect(stats.totalConversions).toBeGreaterThanOrEqual(repeatCount)
      })
    })
  })

  describe('🔧 EventPriorityManager 整合測試', () => {
    describe('優先級分配準確性驗證', () => {
      test('應該為不同類別的事件分配正確的優先級', async () => {
        // eslint-disable-next-line no-unused-vars
        const testEvents = [
          { event: 'SYSTEM.GENERIC.ERROR.CRITICAL', expectedCategory: 'SYSTEM_CRITICAL' },
          { event: 'PLATFORM.READMOO.SWITCH.STARTED', expectedCategory: 'PLATFORM_MANAGEMENT' },
          { event: 'UX.GENERIC.OPEN.STARTED', expectedCategory: 'USER_INTERACTION' },
          { event: 'EXTRACTION.READMOO.EXTRACT.PROGRESS', expectedCategory: 'BUSINESS_PROCESSING' },
          { event: 'ANALYTICS.GENERIC.UPDATE.COMPLETED', expectedCategory: 'BACKGROUND_PROCESSING' }
        ]

        for (const testCase of testEvents) {
          // eslint-disable-next-line no-unused-vars
          const priority = priorityManager.assignEventPriority(testCase.event)
          // eslint-disable-next-line no-unused-vars
          const category = priorityManager.inferPriorityCategory(testCase.event)

          expect(category).toBe(testCase.expectedCategory)
          expect(priority).toBeDefined()
          expect(typeof priority).toBe('number')
          expect(priority).toBeGreaterThanOrEqual(0)
          expect(priority).toBeLessThan(500)

          // 驗證優先級在正確的範圍內
          // eslint-disable-next-line no-unused-vars
          const config = priorityManager.priorityConfig[category]
          expect(priority).toBeGreaterThanOrEqual(config.range[0])
          expect(priority).toBeLessThanOrEqual(config.range[1])
        }
      })

      test('應該正確處理優先級衝突檢測', async () => {
        // eslint-disable-next-line no-unused-vars
        const testEvent = 'EXTRACTION.READMOO.EXTRACT.COMPLETED'

        // 分配初始優先級
        // eslint-disable-next-line no-unused-vars
        const priority1 = priorityManager.assignEventPriority(testEvent)

        // 手動調整優先級
        // eslint-disable-next-line no-unused-vars
        const newPriority = priority1 + 50
        priorityManager.adjustEventPriority(testEvent, newPriority)

        // 檢測衝突
        // eslint-disable-next-line no-unused-vars
        const conflicts = priorityManager.detectPriorityConflicts()

        // 應該檢測到這個事件有多個優先級歷史
        // eslint-disable-next-line no-unused-vars
        const eventConflict = conflicts.find(conflict => conflict.eventName === testEvent)
        expect(eventConflict).toBeDefined()
        expect(eventConflict.priorities).toContain(priority1)
        expect(eventConflict.priorities).toContain(newPriority)
      })

      test('應該支援動態優先級調整', async () => {
        // eslint-disable-next-line no-unused-vars
        const testEvent = 'UX.GENERIC.RENDER.COMPLETED'

        // 分配初始優先級
        // eslint-disable-next-line no-unused-vars
        const initialPriority = priorityManager.assignEventPriority(testEvent)

        // 記錄效能指標（模擬慢事件）
        priorityManager.recordPerformanceMetrics(testEvent, {
          avgExecutionTime: 400, // 超過 300ms 閾值
          callCount: 10
        })

        // 執行基於效能的最佳化
        priorityManager.optimizeBasedOnPerformance()

        // 檢查優先級是否被調整（降低優先級，即增加數值）
        // eslint-disable-next-line no-unused-vars
        const finalPriority = priorityManager.getEventPriority(testEvent)
        expect(finalPriority).toBeGreaterThan(initialPriority)
      })

      test('應該與 EventBus 正確整合註冊', async () => {
        // eslint-disable-next-line no-unused-vars
        const testEvent = 'PLATFORM.READMOO.DETECT.COMPLETED'
        // eslint-disable-next-line no-unused-vars
        const testHandler = jest.fn()

        // 使用優先級管理器註冊事件
        priorityManager.registerWithPriority(eventBus, testEvent, testHandler)

        // 觸發事件
        await eventBus.emit(testEvent, { integration: 'test' })

        // 驗證處理器被正確調用
        expect(testHandler).toHaveBeenCalled()

        // 驗證優先級被正確分配
        // eslint-disable-next-line no-unused-vars
        const assignedPriority = priorityManager.getEventPriority(testEvent)
        expect(assignedPriority).toBeDefined()
      })
    })

    describe('效能最佳化功能測試', () => {
      test('應該準確追蹤優先級分配效能', async () => {
        // eslint-disable-next-line no-unused-vars
        const testEvents = Array.from({ length: 100 }, (_, i) => `TEST.EVENT.${i}`)

        // 批量分配優先級
        for (const event of testEvents) {
          priorityManager.assignEventPriority(event)
        }

        // 驗證效能統計
        // eslint-disable-next-line no-unused-vars
        const stats = priorityManager.getPriorityStats()
        expect(stats.totalAssignments).toBe(testEvents.length)
        expect(stats.avgAssignmentTime).toBeGreaterThan(0)
        expect(stats.avgAssignmentTime).toBeLessThan(10) // 平均小於 10ms
      })

      test('應該正確處理優先級最佳化', async () => {
        // eslint-disable-next-line no-unused-vars
        const testEvents = ['TEST.OPT.1', 'TEST.OPT.2', 'TEST.OPT.3']

        // 為每個事件分配優先級並創建歷史
        for (const event of testEvents) {
          // eslint-disable-next-line no-unused-vars
          const priority1 = priorityManager.assignEventPriority(event)
          priorityManager.adjustEventPriority(event, priority1 + 10)
          priorityManager.adjustEventPriority(event, priority1 + 20)
        }

        // 執行最佳化
        // eslint-disable-next-line no-unused-vars
        const initialStats = priorityManager.getPriorityStats()
        priorityManager.optimizeEventPriorities()
        // eslint-disable-next-line no-unused-vars
        const finalStats = priorityManager.getPriorityStats()

        // 驗證最佳化計數器增加
        expect(finalStats.optimizations).toBeGreaterThan(initialStats.optimizations)
      })
    })
  })

  describe('🔧 EventTypeDefinitions 整合測試', () => {
    describe('事件類型驗證系統測試', () => {
      test('應該正確驗證 v2.0 事件格式', async () => {
        // eslint-disable-next-line no-unused-vars
        const validEvents = [
          'SYSTEM.GENERIC.INIT.COMPLETED',
          'PLATFORM.READMOO.DETECT.STARTED',
          'EXTRACTION.READMOO.EXTRACT.PROGRESS',
          'DATA.READMOO.SAVE.COMPLETED',
          'UX.GENERIC.RENDER.REQUESTED'
        ]

        // eslint-disable-next-line no-unused-vars
        const invalidEvents = [
          'INVALID',
          'INVALID.FORMAT',
          'TOO.MANY.PARTS.HERE.INVALID',
          'UNKNOWN_DOMAIN.READMOO.EXTRACT.COMPLETED',
          'EXTRACTION.UNKNOWN_PLATFORM.EXTRACT.COMPLETED'
        ]

        // 測試有效事件
        for (const event of validEvents) {
          // eslint-disable-next-line no-unused-vars
          const isValid = typeDefinitions.isValidEventName(event)
          expect(isValid).toBe(true)
        }

        // 測試無效事件
        for (const event of invalidEvents) {
          // eslint-disable-next-line no-unused-vars
          const isValid = typeDefinitions.isValidEventName(event)
          expect(isValid).toBe(false)
        }
      })

      test('應該提供智能命名建議', async () => {
        // eslint-disable-next-line no-unused-vars
        const invalidEvents = [
          'EXTRACTION.COMPLETED', // 缺少平台
          'INVALID.FORMAT.HERE', // 無效格式
          'EXTRACTION.UNKNOWN.EXTRACT.COMPLETED' // 未知平台
        ]

        for (const invalidEvent of invalidEvents) {
          // eslint-disable-next-line no-unused-vars
          const suggestions = typeDefinitions.suggestCorrections(invalidEvent)

          expect(Array.isArray(suggestions)).toBe(true)
          expect(suggestions.length).toBeGreaterThan(0)

          // 每個建議都應該是有效的格式
          for (const suggestion of suggestions) {
            // eslint-disable-next-line no-unused-vars
            const isValid = typeDefinitions.isValidEventName(suggestion)
            expect(isValid).toBe(true)
          }
        }
      })

      test('應該正確追蹤事件使用統計', async () => {
        // eslint-disable-next-line no-unused-vars
        const testEvents = [
          'PLATFORM.READMOO.DETECT.COMPLETED',
          'EXTRACTION.READMOO.EXTRACT.STARTED',
          'EXTRACTION.READMOO.EXTRACT.COMPLETED'
        ]

        // 使用事件多次
        for (const event of testEvents) {
          for (let i = 0; i < 3; i++) {
            typeDefinitions.recordEventUsage(event)
          }
        }

        // 驗證統計
        // eslint-disable-next-line no-unused-vars
        const stats = typeDefinitions.getUsageStats()
        expect(stats).toBeDefined()

        for (const event of testEvents) {
          expect(stats[event]).toBe(3)
        }
      })

      test('應該支援事件類型分析和報告', async () => {
        // eslint-disable-next-line no-unused-vars
        const modernEvents = [
          'SYSTEM.GENERIC.ERROR.CRITICAL',
          'PLATFORM.READMOO.SWITCH.STARTED',
          'UX.GENERIC.OPEN.COMPLETED',
          'EXTRACTION.READMOO.EXTRACT.PROGRESS',
          'ANALYTICS.GENERIC.UPDATE.COMPLETED'
        ]

        // 記錄事件使用
        for (const event of modernEvents) {
          typeDefinitions.recordEventUsage(event)
        }

        // 生成分析報告
        // eslint-disable-next-line no-unused-vars
        const analysis = typeDefinitions.analyzeEventPatterns()

        expect(analysis).toBeDefined()
        expect(analysis.totalEvents).toBe(modernEvents.length)
        expect(analysis.domainDistribution).toBeDefined()
        expect(analysis.platformDistribution).toBeDefined()
        expect(analysis.actionDistribution).toBeDefined()
        expect(analysis.stateDistribution).toBeDefined()
      })
    })

    describe('錯誤檢測和修正功能測試', () => {
      test('應該檢測常見的事件命名錯誤', async () => {
        // eslint-disable-next-line no-unused-vars
        const commonErrors = [
          'extraction.completed', // 小寫
          'EXTRACTION_COMPLETED', // 底線分隔
          'EXTRACTION-COMPLETED', // 破折號分隔
          'EXTRACTION COMPLETED', // 空格分隔
          'EXTRACTION.COMPLETE' // 狀態拼寫錯誤
        ]

        for (const errorEvent of commonErrors) {
          // eslint-disable-next-line no-unused-vars
          const errors = typeDefinitions.detectNamingErrors(errorEvent)

          expect(Array.isArray(errors)).toBe(true)
          expect(errors.length).toBeGreaterThan(0)

          // 應該包含相關的錯誤描述
          // eslint-disable-next-line no-unused-vars
          const hasRelevantError = errors.some(error =>
            error.includes('格式') ||
            error.includes('命名') ||
            error.includes('拼寫') ||
            error.includes('分隔符')
          )
          expect(hasRelevantError).toBe(true)
        }
      })

      test('應該提供事件命名最佳實踐建議', async () => {
        // eslint-disable-next-line no-unused-vars
        const bestPractices = typeDefinitions.getEventNamingBestPractices()

        expect(bestPractices).toBeDefined()
        expect(Array.isArray(bestPractices.rules)).toBe(true)
        expect(bestPractices.rules.length).toBeGreaterThan(0)

        // 應該包含基本規則
        // eslint-disable-next-line no-unused-vars
        const ruleTexts = bestPractices.rules.join(' ')
        expect(ruleTexts).toMatch(/4.*層級|layer/i)
        expect(ruleTexts).toMatch(/DOMAIN.*PLATFORM.*ACTION.*STATE/i)
        expect(ruleTexts).toMatch(/大寫|uppercase/i)
      })
    })
  })

  describe('🔧 三大核心組件協作整合測試', () => {
    describe('完整事件處理流程測試', () => {
      test('應該完整處理從 Legacy 到 Modern 的事件流程', async () => {
        // eslint-disable-next-line no-unused-vars
        const legacyEvent = 'EXTRACTION.COMPLETED'
        // eslint-disable-next-line no-unused-vars
        const testData = { bookId: 'test-book-123', extractedCount: 5 }

        // 設置完整的事件處理鏈
        // eslint-disable-next-line no-unused-vars
        const legacyHandler = jest.fn()
        // eslint-disable-next-line no-unused-vars
        const modernHandler = jest.fn()

        // 1. 使用 EventNamingUpgradeCoordinator 註冊雙軌監聽器
        namingCoordinator.registerDualTrackListener(legacyEvent, legacyHandler)

        // 2. 獲取對應的 Modern 事件名稱
        // eslint-disable-next-line no-unused-vars
        const modernEvent = namingCoordinator.convertToModernEvent(legacyEvent)
        expect(modernEvent).toBe('EXTRACTION.READMOO.EXTRACT.COMPLETED')

        // 3. 使用 EventPriorityManager 為 Modern 事件分配優先級
        // eslint-disable-next-line no-unused-vars
        const priority = priorityManager.assignEventPriority(modernEvent)
        expect(priority).toBeDefined()

        // 4. 使用 EventTypeDefinitions 驗證 Modern 事件格式
        // eslint-disable-next-line no-unused-vars
        const isValid = typeDefinitions.isValidEventName(modernEvent)
        expect(isValid).toBe(true)

        // 5. 註冊 Modern 事件處理器（帶優先級）
        priorityManager.registerWithPriority(eventBus, modernEvent, modernHandler)

        // 6. 觸發 Legacy 事件，應該同時觸發 Modern 事件
        await namingCoordinator.intelligentEmit(legacyEvent, testData)

        // 等待事件處理完成
        await new Promise(resolve => setTimeout(resolve, 100))

        // 7. 驗證完整流程
        expect(legacyHandler).toHaveBeenCalled()
        expect(modernHandler).toHaveBeenCalled()

        // 8. 驗證統計資料
        // eslint-disable-next-line no-unused-vars
        const conversionStats = namingCoordinator.getConversionStats()
        expect(conversionStats.totalConversions).toBeGreaterThan(0)

        // eslint-disable-next-line no-unused-vars
        const priorityStats = priorityManager.getPriorityStats()
        expect(priorityStats.totalAssignments).toBeGreaterThan(0)

        typeDefinitions.recordEventUsage(modernEvent)
        // eslint-disable-next-line no-unused-vars
        const usageStats = typeDefinitions.getUsageStats()
        expect(usageStats[modernEvent]).toBeGreaterThan(0)
      })

      test('應該處理複雜的事件處理場景', async () => {
        // eslint-disable-next-line no-unused-vars
        const complexScenario = [
          { event: 'EXTRACTION.STARTED', data: { url: 'https://readmoo.com/book/123' } },
          { event: 'EXTRACTION.PROGRESS', data: { completed: 3, total: 10 } },
          { event: 'STORAGE.SAVE.REQUESTED', data: { books: [] } },
          { event: 'STORAGE.SAVE.COMPLETED', data: { saved: 3 } },
          { event: 'UI.POPUP.OPENED', data: { timestamp: Date.now() } },
          { event: 'EXTRACTION.COMPLETED', data: { totalExtracted: 10 } }
        ]

        // eslint-disable-next-line no-unused-vars
        const handlerResults = []

        // 為每個事件設置處理器
        for (const scenario of complexScenario) {
          // eslint-disable-next-line no-unused-vars
          const handler = jest.fn((event) => {
            handlerResults.push({
              original: scenario.event,
              processed: event.type,
              data: event.data
            })
          })

          // 註冊雙軌監聽器
          namingCoordinator.registerDualTrackListener(scenario.event, handler)
        }

        // 按順序觸發所有事件
        for (const scenario of complexScenario) {
          await namingCoordinator.intelligentEmit(scenario.event, scenario.data)
          await new Promise(resolve => setTimeout(resolve, 10)) // 小延遲確保順序
        }

        // 等待所有事件處理完成
        await new Promise(resolve => setTimeout(resolve, 200))

        // 驗證所有事件都被正確處理
        expect(handlerResults.length).toBeGreaterThanOrEqual(complexScenario.length)

        // 驗證每個事件的資料完整性
        for (const scenario of complexScenario) {
          // eslint-disable-next-line no-unused-vars
          const relatedResults = handlerResults.filter(result =>
            result.original === scenario.event ||
            result.processed === scenario.event ||
            result.processed === namingCoordinator.convertToModernEvent(scenario.event)
          )
          expect(relatedResults.length).toBeGreaterThan(0)
        }
      })

      test('應該在高負載下保持系統穩定性', async () => {
        // eslint-disable-next-line no-unused-vars
        const startTime = performance.now()
        // eslint-disable-next-line no-unused-vars
        const eventCount = 200
        // eslint-disable-next-line no-unused-vars
        const promises = []

        // 生成大量並發事件
        for (let i = 0; i < eventCount; i++) {
          // eslint-disable-next-line no-unused-vars
          const eventType = i % 2 === 0 ? 'EXTRACTION.COMPLETED' : 'STORAGE.SAVE.COMPLETED'
          // eslint-disable-next-line no-unused-vars
          const promise = namingCoordinator.intelligentEmit(eventType, {
            iteration: i,
            timestamp: Date.now()
          })
          promises.push(promise)
        }

        // 等待所有事件處理完成
        await Promise.all(promises)

        // eslint-disable-next-line no-unused-vars
        const endTime = performance.now()
        // eslint-disable-next-line no-unused-vars
        const totalTime = endTime - startTime

        // 驗證效能指標
        expect(totalTime).toBeLessThan(5000) // 總時間少於 5 秒

        // 驗證系統狀態
        // eslint-disable-next-line no-unused-vars
        const conversionStats = namingCoordinator.getConversionStats()
        expect(conversionStats.totalConversions).toBeGreaterThanOrEqual(eventCount)
        expect(conversionStats.conversionErrors).toBe(0)

        // eslint-disable-next-line no-unused-vars
        const priorityStats = priorityManager.getPriorityStats()
        expect(priorityStats.errors).toBe(0)

        // 檢查平均處理時間
        // eslint-disable-next-line no-unused-vars
        const avgTimePerEvent = totalTime / eventCount
        expect(avgTimePerEvent).toBeLessThan(25) // 平均每個事件少於 25ms
      })
    })

    describe('錯誤處理和恢復整合測試', () => {
      test('應該優雅處理無效事件格式', async () => {
        // eslint-disable-next-line no-unused-vars
        const invalidEvents = [
          'INVALID',
          'INVALID.FORMAT',
          'TOO.MANY.PARTS.HERE.NOW',
          '',
          null,
          undefined
        ]

        // eslint-disable-next-line no-unused-vars
        const errorHandler = jest.fn()

        // 設置錯誤監聽器
        eventBus.on('SYSTEM.ERROR.VALIDATION.FAILED', errorHandler)

        for (const invalidEvent of invalidEvents) {
          if (invalidEvent !== null && invalidEvent !== undefined) {
            // 測試事件格式驗證
            // eslint-disable-next-line no-unused-vars
            const isValid = typeDefinitions.isValidEventName(invalidEvent)
            expect(isValid).toBe(false)

            // 測試優先級分配錯誤處理
            expect(() => {
              priorityManager.assignEventPriority(invalidEvent)
            }).not.toThrow() // 應該優雅處理，不拋出異常

            // 測試轉換錯誤處理
            // eslint-disable-next-line no-unused-vars
            const modernEvent = namingCoordinator.convertToModernEvent(invalidEvent)
            expect(modernEvent).toBeDefined() // 應該返回某種形式的結果
          }
        }
      })

      test('應該處理系統資源不足情況', async () => {
        // 模擬記憶體壓力情況
        // eslint-disable-next-line no-unused-vars
        const largeDataEvents = []

        // 創建大量大資料事件
        for (let i = 0; i < 50; i++) {
          // eslint-disable-next-line no-unused-vars
          const largeData = {
            iteration: i,
            payload: new Array(1000).fill(`data-${i}`), // 大量資料
            timestamp: Date.now()
          }
          largeDataEvents.push(largeData)
        }

        // 設置處理器
        // eslint-disable-next-line no-unused-vars
        const processedEvents = []
        namingCoordinator.registerDualTrackListener('EXTRACTION.COMPLETED', (event) => {
          processedEvents.push(event.data.iteration)
        })

        // 快速發送所有事件
        // eslint-disable-next-line no-unused-vars
        const promises = largeDataEvents.map((data, index) =>
          namingCoordinator.intelligentEmit('EXTRACTION.COMPLETED', data)
        )

        // 不應該因為記憶體壓力而失敗
        await expect(Promise.all(promises)).resolves.toBeDefined()

        // 等待處理完成
        await new Promise(resolve => setTimeout(resolve, 500))

        // 驗證大部分事件被正確處理
        expect(processedEvents.length).toBeGreaterThan(largeDataEvents.length * 0.8)
      })

      test('應該支援系統重啟後的狀態恢復', async () => {
        // 記錄初始狀態
        // eslint-disable-next-line no-unused-vars
        const testEvents = ['EXTRACTION.COMPLETED', 'STORAGE.SAVE.COMPLETED']

        for (const event of testEvents) {
          await namingCoordinator.intelligentEmit(event, { test: 'before-restart' })
          priorityManager.assignEventPriority(namingCoordinator.convertToModernEvent(event))
          typeDefinitions.recordEventUsage(event)
        }

        // 模擬系統重啟 (重新初始化組件)
        // eslint-disable-next-line no-unused-vars
        const newEventBus = new EventBus()
        // eslint-disable-next-line no-unused-vars
        const newNamingCoordinator = new EventNamingUpgradeCoordinator(newEventBus)
        // eslint-disable-next-line no-unused-vars
        const newPriorityManager = new EventPriorityManager()
        // eslint-disable-next-line no-unused-vars
        const newTypeDefinitions = new EventTypeDefinitions()

        // 模擬狀態恢復 (實際實作中可能從持久化儲存恢復)
        for (const event of testEvents) {
          await newNamingCoordinator.intelligentEmit(event, { test: 'after-restart' })
          newPriorityManager.assignEventPriority(newNamingCoordinator.convertToModernEvent(event))
          newTypeDefinitions.recordEventUsage(event)
        }

        // 驗證重啟後系統仍正常運作
        // eslint-disable-next-line no-unused-vars
        const postRestartConversionStats = newNamingCoordinator.getConversionStats()
        // eslint-disable-next-line no-unused-vars
        const postRestartPriorityStats = newPriorityManager.getPriorityStats()
        // eslint-disable-next-line no-unused-vars
        const postRestartUsageStats = newTypeDefinitions.getUsageStats()

        expect(postRestartConversionStats.totalConversions).toBeGreaterThan(0)
        expect(postRestartPriorityStats.totalAssignments).toBeGreaterThan(0)
        expect(Object.keys(postRestartUsageStats).length).toBeGreaterThan(0)
      })
    })
  })

  describe('🔧 系統整合效能驗證', () => {
    test('應該滿足事件轉換效能要求 (< 5ms)', async () => {
      // eslint-disable-next-line no-unused-vars
      const testEvents = [
        'EXTRACTION.COMPLETED',
        'STORAGE.SAVE.COMPLETED',
        'UI.POPUP.OPENED',
        'BACKGROUND.INIT.COMPLETED'
      ]

      // eslint-disable-next-line no-unused-vars
      const timings = []

      for (const event of testEvents) {
        // eslint-disable-next-line no-unused-vars
        const startTime = performance.now()
        namingCoordinator.convertToModernEvent(event)
        // eslint-disable-next-line no-unused-vars
        const endTime = performance.now()

        // eslint-disable-next-line no-unused-vars
        const conversionTime = endTime - startTime
        timings.push(conversionTime)

        // 每個轉換應該少於 5ms
        expect(conversionTime).toBeLessThan(5)
      }

      // 平均轉換時間應該更快
      // eslint-disable-next-line no-unused-vars
      const avgTime = timings.reduce((sum, time) => sum + time, 0) / timings.length
      expect(avgTime).toBeLessThan(2)
    })

    test('應該滿足優先級分配效能要求 (< 1ms)', async () => {
      // eslint-disable-next-line no-unused-vars
      const testEvents = [
        'SYSTEM.GENERIC.ERROR.CRITICAL',
        'PLATFORM.READMOO.DETECT.COMPLETED',
        'UX.GENERIC.OPEN.STARTED',
        'EXTRACTION.READMOO.EXTRACT.PROGRESS',
        'ANALYTICS.GENERIC.UPDATE.COMPLETED'
      ]

      // eslint-disable-next-line no-unused-vars
      const timings = []

      for (const event of testEvents) {
        // eslint-disable-next-line no-unused-vars
        const startTime = performance.now()
        priorityManager.assignEventPriority(event)
        // eslint-disable-next-line no-unused-vars
        const endTime = performance.now()

        // eslint-disable-next-line no-unused-vars
        const assignmentTime = endTime - startTime
        timings.push(assignmentTime)

        // 每個分配應該少於 1ms
        expect(assignmentTime).toBeLessThan(1)
      }

      // 平均分配時間應該更快
      // eslint-disable-next-line no-unused-vars
      const avgTime = timings.reduce((sum, time) => sum + time, 0) / timings.length
      expect(avgTime).toBeLessThan(0.5)
    })

    test('應該滿足命名驗證效能要求 (< 0.1ms)', async () => {
      // eslint-disable-next-line no-unused-vars
      const testEvents = [
        'SYSTEM.GENERIC.INIT.COMPLETED',
        'PLATFORM.READMOO.DETECT.STARTED',
        'EXTRACTION.READMOO.EXTRACT.PROGRESS',
        'DATA.READMOO.SAVE.COMPLETED',
        'UX.GENERIC.RENDER.REQUESTED'
      ]

      // eslint-disable-next-line no-unused-vars
      const timings = []

      for (const event of testEvents) {
        // eslint-disable-next-line no-unused-vars
        const startTime = performance.now()
        typeDefinitions.isValidEventName(event)
        // eslint-disable-next-line no-unused-vars
        const endTime = performance.now()

        // eslint-disable-next-line no-unused-vars
        const validationTime = endTime - startTime
        timings.push(validationTime)

        // 每個驗證應該少於 0.1ms
        expect(validationTime).toBeLessThan(0.1)
      }

      // 平均驗證時間應該更快
      // eslint-disable-next-line no-unused-vars
      const avgTime = timings.reduce((sum, time) => sum + time, 0) / timings.length
      expect(avgTime).toBeLessThan(0.05)
    })

    test('應該控制記憶體增長在 15% 以內', async () => {
      // 獲取初始記憶體使用 (模擬)
      // eslint-disable-next-line no-unused-vars
      const initialMemory = process.memoryUsage()

      // 執行大量事件處理
      // eslint-disable-next-line no-unused-vars
      const eventCount = 1000
      // eslint-disable-next-line no-unused-vars
      const promises = []

      for (let i = 0; i < eventCount; i++) {
        // eslint-disable-next-line no-unused-vars
        const event = i % 4 === 0
          ? 'EXTRACTION.COMPLETED'
          : i % 4 === 1
            ? 'STORAGE.SAVE.COMPLETED'
            : i % 4 === 2
              ? 'UI.POPUP.OPENED'
              : 'BACKGROUND.INIT.COMPLETED'

        // eslint-disable-next-line no-unused-vars
        const promise = namingCoordinator.intelligentEmit(event, { iteration: i })
        promises.push(promise)

        // 同時進行優先級分配和類型驗證
        // eslint-disable-next-line no-unused-vars
        const modernEvent = namingCoordinator.convertToModernEvent(event)
        priorityManager.assignEventPriority(modernEvent)
        typeDefinitions.isValidEventName(modernEvent)
      }

      await Promise.all(promises)

      // 等待記憶體穩定化
      await new Promise(resolve => setTimeout(resolve, 150))

      // 檢查最終記憶體使用
      // eslint-disable-next-line no-unused-vars
      const finalMemory = process.memoryUsage()

      // 計算記憶體增長率
      // eslint-disable-next-line no-unused-vars
      const memoryGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed

      // 記憶體增長應該控制在 15% 以內
      expect(memoryGrowth).toBeLessThan(0.15)
    })
  })
})
