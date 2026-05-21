/**
 * 事件系統 v2.0 效能測試（非 npm test 主套件）
 *
 * 負責功能：
 * - 事件轉換 / 優先級分配 / 命名驗證的效能量測
 * - 高頻與並發場景下的效能趨勢觀察
 * - 效能回歸基準報告產生
 *
 * 執行方式：
 * - 本檔位於 tests/perf/，不在 npm test（jest tests/unit tests/integration）掃描範圍。
 * - 透過 npm run test:perf（jest tests/perf）獨立執行。
 *
 * 量測環境限制（W1-017）：
 * - Jest 在 jsdom 下執行，且測試大量使用 mock，並非有效的效能量測環境。
 * - 計時值受全套件機器負載、JIT 暖機狀態、GC 時序影響，絕對門檻在 CI / 全套件
 *   負載下會 flaky（W1-017 實測 avgSuggestionTime 2.4~2.48ms 超過原 < 2ms 門檻）。
 * - 因此本檔的計時斷言一律作為「大幅退化防護」（gross-regression guard），門檻刻意
 *   放寬到不受正常機器負載變異影響，只攔截數量級等級的災難性退化。
 * - 真正可靠的效能評估應在實機環境以專用 profiling 工具進行；本檔僅作開發期參考。
 *
 * 功能正確性驗證：
 * - 轉換產出有效的現代事件、優先級為合法數值、命名驗證與建議結果正確。
 * - 此類斷言為真正的 pass-fail gate，與計時無關。
 *
 * 來源：原 tests/integration/event-system-v2-performance-stability.test.js
 *       的效能 describe（W1-017 物理拆檔，效能測試移出 npm test 主套件）。
 */

const EventNamingUpgradeCoordinator = require('@/core/events/event-naming-upgrade-coordinator')
const EventPriorityManager = require('@/core/events/event-priority-manager')
const EventTypeDefinitions = require('@/core/events/event-type-definitions')
const EventBus = require('@/core/event-bus')

describe('事件系統 v2.0 效能測試（大幅退化防護）', () => {
  let eventBus
  let namingCoordinator
  let priorityManager
  let typeDefinitions

  beforeEach(async () => {
    eventBus = new EventBus()
    namingCoordinator = new EventNamingUpgradeCoordinator(eventBus)
    priorityManager = new EventPriorityManager()
    typeDefinitions = new EventTypeDefinitions()

    // 等待初始化完成
    await new Promise(resolve => setTimeout(resolve, 50))
  })

  afterEach(async () => {
    if (eventBus && typeof eventBus.removeAllListeners === 'function') {
      eventBus.removeAllListeners()
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  })

  describe('事件轉換效能', () => {
    test('應該完成單個事件轉換且不發生數量級退化', () => {
      const testEvents = [
        'EXTRACTION.COMPLETED',
        'STORAGE.SAVE.COMPLETED',
        'UI.POPUP.OPENED',
        'BACKGROUND.INIT.COMPLETED',
        'PLATFORM.DETECTION.COMPLETED'
      ]

      const conversionTimes = []

      for (const event of testEvents) {
        const startTime = performance.now()
        const modernEvent = namingCoordinator.convertToModernEvent(event)
        const endTime = performance.now()

        conversionTimes.push(endTime - startTime)

        // 大幅退化防護：單個轉換不應達數量級退化
        expect(endTime - startTime).toBeLessThan(100)
        // 功能正確性驗證（pass-fail gate）
        expect(modernEvent).toBeDefined()
      }

      const avgConversionTime = conversionTimes.reduce((sum, time) => sum + time, 0) / conversionTimes.length
      expect(avgConversionTime).toBeLessThan(50)
    })

    test('應該在高頻轉換下保持效能', async () => {
      const eventCount = 1000
      const batchSize = 100
      const totalTimes = []

      for (let batch = 0; batch < eventCount / batchSize; batch++) {
        const batchStartTime = performance.now()

        const batchPromises = Array.from({ length: batchSize }, (_, i) => {
          const eventIndex = batch * batchSize + i
          return Promise.resolve(namingCoordinator.convertToModernEvent(`EXTRACTION.COMPLETED.${eventIndex}`))
        })

        await Promise.all(batchPromises)

        const batchTime = performance.now() - batchStartTime
        totalTimes.push(batchTime)

        // 每批處理時間：大幅退化防護門檻
        expect(batchTime).toBeLessThan(2000)
      }

      const totalTime = totalTimes.reduce((sum, time) => sum + time, 0)
      const avgTimePerEvent = totalTime / eventCount

      expect(avgTimePerEvent).toBeLessThan(25)
    })

    test('應該在並發轉換下保持線性效能', async () => {
      const concurrentBatches = [10, 50, 100, 200, 500]
      const performanceResults = []

      for (const batchSize of concurrentBatches) {
        const startTime = performance.now()

        const promises = Array.from({ length: batchSize }, (_, i) => {
          return new Promise(resolve => {
            const conversionStart = performance.now()
            const result = namingCoordinator.convertToModernEvent(`EXTRACTION.COMPLETED.${i}`)
            const conversionEnd = performance.now()
            resolve({ result, time: conversionEnd - conversionStart })
          })
        })

        const results = await Promise.all(promises)
        const totalTime = performance.now() - startTime
        const avgTimePerEvent = totalTime / batchSize
        const maxConversionTime = Math.max(...results.map(r => r.time))

        performanceResults.push({ batchSize, totalTime, avgTimePerEvent, maxConversionTime })

        // 大幅退化防護門檻
        expect(avgTimePerEvent).toBeLessThan(50)
        expect(maxConversionTime).toBeLessThan(100)
      }

      // 相對退化檢查：效能不會數量級退化
      const firstBatch = performanceResults[0]
      const lastBatch = performanceResults[performanceResults.length - 1]
      const performanceDegradation = lastBatch.avgTimePerEvent / firstBatch.avgTimePerEvent

      expect(performanceDegradation).toBeLessThan(3)
    })
  })

  describe('優先級分配效能', () => {
    test('應該完成優先級分配且不發生數量級退化', () => {
      const testEvents = [
        'SYSTEM.GENERIC.ERROR.CRITICAL',
        'PLATFORM.READMOO.DETECT.COMPLETED',
        'UX.GENERIC.OPEN.STARTED',
        'EXTRACTION.READMOO.EXTRACT.PROGRESS',
        'ANALYTICS.GENERIC.UPDATE.COMPLETED'
      ]

      const assignmentTimes = []

      for (const event of testEvents) {
        const startTime = performance.now()
        const priority = priorityManager.assignEventPriority(event)
        const endTime = performance.now()

        assignmentTimes.push(endTime - startTime)

        // 大幅退化防護門檻
        expect(endTime - startTime).toBeLessThan(50)
        // 功能正確性驗證
        expect(priority).toBeDefined()
        expect(typeof priority).toBe('number')
      }

      const avgAssignmentTime = assignmentTimes.reduce((sum, time) => sum + time, 0) / assignmentTimes.length
      expect(avgAssignmentTime).toBeLessThan(25)
    })

    test('應該在大量並發分配下保持效能', async () => {
      const eventCount = 2000
      const startTime = performance.now()

      const promises = Array.from({ length: eventCount }, (_, i) => {
        return new Promise(resolve => {
          const assignStart = performance.now()
          const priority = priorityManager.assignEventPriority(`TEST.EVENT.${i}.COMPLETED`)
          const assignEnd = performance.now()
          resolve({ priority, time: assignEnd - assignStart })
        })
      })

      const results = await Promise.all(promises)
      const totalTime = performance.now() - startTime
      const avgTimePerAssignment = totalTime / eventCount
      const maxAssignmentTime = Math.max(...results.map(r => r.time))

      // 大幅退化防護門檻
      expect(avgTimePerAssignment).toBeLessThan(25)
      expect(maxAssignmentTime).toBeLessThan(100)
      expect(totalTime).toBeLessThan(10000)

      // 功能正確性驗證：所有分配都成功
      const validPriorities = results.filter(r =>
        typeof r.priority === 'number' && r.priority >= 0 && r.priority < 500
      )
      expect(validPriorities.length).toBe(eventCount)
    })

    test('應該高效處理優先級衝突檢測', () => {
      const baseEvents = ['TEST.PRIORITY.A', 'TEST.PRIORITY.B', 'TEST.PRIORITY.C']

      for (const event of baseEvents) {
        priorityManager.assignEventPriority(event)
        priorityManager.adjustEventPriority(event, 100)
        priorityManager.adjustEventPriority(event, 200)
      }

      const startTime = performance.now()
      const conflicts = priorityManager.detectPriorityConflicts()
      const detectionTime = performance.now() - startTime

      // 大幅退化防護門檻
      expect(detectionTime).toBeLessThan(100)
      // 功能正確性驗證
      expect(conflicts.length).toBe(baseEvents.length)
    })
  })

  describe('命名驗證效能', () => {
    test('應該完成事件名稱驗證且不發生數量級退化', () => {
      const validEvents = [
        'SYSTEM.GENERIC.INIT.COMPLETED',
        'PLATFORM.READMOO.DETECT.STARTED',
        'EXTRACTION.READMOO.EXTRACT.PROGRESS',
        'DATA.READMOO.SAVE.COMPLETED',
        'UX.GENERIC.RENDER.REQUESTED'
      ]

      const validationTimes = []

      for (const event of validEvents) {
        const startTime = performance.now()
        const isValid = typeDefinitions.isValidEventName(event)
        const endTime = performance.now()

        validationTimes.push(endTime - startTime)

        // 大幅退化防護門檻
        expect(endTime - startTime).toBeLessThan(50)
        // 功能正確性驗證
        expect(isValid).toBe(true)
      }

      const avgValidationTime = validationTimes.reduce((sum, time) => sum + time, 0) / validationTimes.length
      expect(avgValidationTime).toBeLessThan(25)
    })

    test('應該高效處理大量驗證請求', async () => {
      const eventCount = 5000
      const events = Array.from({ length: eventCount }, () => 'EXTRACTION.READMOO.EXTRACT.COMPLETED')

      const startTime = performance.now()

      const promises = events.map(event =>
        Promise.resolve(typeDefinitions.isValidEventName(event))
      )

      const results = await Promise.all(promises)
      const totalTime = performance.now() - startTime
      const avgTimePerValidation = totalTime / eventCount

      // 大幅退化防護門檻
      expect(avgTimePerValidation).toBeLessThan(25)
      expect(totalTime).toBeLessThan(5000)
      // 功能正確性驗證
      expect(results.filter(r => r === true).length).toBe(eventCount)
    })

    test('應該高效提供智能命名建議', () => {
      const invalidEvents = [
        'EXTRACTION.COMPLETED',
        'INVALID.FORMAT.HERE',
        'TOO.MANY.PARTS.IN.THIS.NAME',
        'UNKNOWN_DOMAIN.READMOO.EXTRACT.COMPLETED'
      ]

      const suggestionTimes = []

      for (const event of invalidEvents) {
        const startTime = performance.now()
        const suggestions = typeDefinitions.suggestCorrections(event)
        const endTime = performance.now()

        suggestionTimes.push(endTime - startTime)

        // 大幅退化防護門檻
        expect(endTime - startTime).toBeLessThan(100)
        // 功能正確性驗證
        expect(Array.isArray(suggestions)).toBe(true)
        expect(suggestions.length).toBeGreaterThan(0)
      }

      // 平均建議生成時間：大幅退化防護門檻
      // 原 < 2ms 硬門檻受全套件機器負載影響 flaky（W1-017：實測 2.4~2.48ms）
      const avgSuggestionTime = suggestionTimes.reduce((sum, time) => sum + time, 0) / suggestionTimes.length
      expect(avgSuggestionTime).toBeLessThan(50)
    })
  })

  describe('效能回歸檢測和基準比較', () => {
    test('應該產生完整的效能報告', async () => {
      const performanceTestSuite = [
        { name: 'Event Conversion', test: () => namingCoordinator.convertToModernEvent('EXTRACTION.COMPLETED') },
        { name: 'Priority Assignment', test: () => priorityManager.assignEventPriority('TEST.EVENT.COMPLETED') },
        { name: 'Name Validation', test: () => typeDefinitions.isValidEventName('SYSTEM.GENERIC.INIT.COMPLETED') },
        { name: 'Event Emission', test: () => namingCoordinator.intelligentEmit('TEST.PERFORMANCE.COMPLETED', {}) }
      ]

      const performanceResults = []

      for (const testCase of performanceTestSuite) {
        const iterations = 1000
        const times = []

        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now()
          await testCase.test()
          times.push(performance.now() - startTime)
        }

        const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length
        const minTime = Math.min(...times)
        const maxTime = Math.max(...times)
        const medianTime = times.sort((a, b) => a - b)[Math.floor(times.length / 2)]

        performanceResults.push({ name: testCase.name, iterations, avgTime, minTime, maxTime, medianTime })
      }

      // 大幅退化防護門檻（數值有效性由 performanceResults 結構驗證）
      const conversionResult = performanceResults.find(r => r.name === 'Event Conversion')
      const priorityResult = performanceResults.find(r => r.name === 'Priority Assignment')
      const validationResult = performanceResults.find(r => r.name === 'Name Validation')

      expect(conversionResult.avgTime).toBeLessThan(50)
      expect(priorityResult.avgTime).toBeLessThan(25)
      expect(validationResult.avgTime).toBeLessThan(25)

      // 功能正確性驗證：報告結構完整
      const performanceReport = {
        timestamp: Date.now(),
        version: '2.0.0',
        testEnvironment: 'perf-test',
        results: performanceResults
      }

      expect(performanceReport.results.length).toBe(performanceTestSuite.length)
    })
  })
})
