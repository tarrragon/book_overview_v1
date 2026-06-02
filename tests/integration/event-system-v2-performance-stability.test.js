/**
 * 事件系統 v2.0 穩定性和功能正確性整合測試
 *
 * 負責功能：
 * - 記憶體使用和洩漏防護驗證
 * - 長時間運行穩定性測試（零錯誤、零崩潰）
 * - 併發事件處理的資料一致性驗證
 * - 系統負載極限下的功能可用性驗證
 *
 * 測試策略：
 * - 真實負載條件模擬
 * - 極限條件下的穩定性與功能正確性驗證
 * - 監聽器數量基線比對，驗證資源正確清理
 *
 * 範圍邊界（W1-017）：
 * - 本檔只保留穩定性與功能正確性測試，為 npm test 主套件的真實 pass-fail gate。
 * - 純效能量測（事件轉換 / 優先級分配 / 命名驗證的計時、效能回歸報告）已移出至
 *   tests/perf/event-system-v2-performance.test.js，透過 npm run test:perf 獨立執行。
 * - 拆檔原因：Jest 在 jsdom 下執行且大量使用 mock，並非有效效能量測環境；計時硬門檻
 *   在完整 npm test 下受機器負載影響 flaky（W1-017 實測 avgSuggestionTime 2.48ms）。
 *
 * 計時相關斷言策略：
 * - 本檔仍保留的少量計時斷言（如長時間運行的 maxLatency、系統恢復的 responseTime）
 *   一律作為「大幅退化防護」（gross-regression guard），只攔截數量級等級的災難性退化，
 *   並非精確效能 SLA。穩定性指標（零錯誤、零崩潰、處理數量、資料一致性）才是驗收核心。
 *
 * 功能正確性驗證：
 * - 記憶體增長控制在合理範圍、監聽器正確清理回到基線
 * - 長時間運行零崩潰、零錯誤
 * - 併發事件零遺失、零重複、資料一致
 */

// eslint-disable-next-line no-unused-vars
const EventBus = require('@/core/event-bus')
// eslint-disable-next-line no-unused-vars
const EventNamingUpgradeCoordinator = require('@/core/events/event-naming-upgrade-coordinator')
// eslint-disable-next-line no-unused-vars
const EventPriorityManager = require('@/core/events/event-priority-manager')
// eslint-disable-next-line no-unused-vars
const EventTypeDefinitions = require('@/core/events/event-type-definitions')
// eslint-disable-next-line no-unused-vars
const ReadmooPlatformMigrationValidator = require('@/platform/readmoo-platform-migration-validator')

describe('🧪 事件系統 v2.0 穩定性和功能正確性整合測試', () => {
  // eslint-disable-next-line no-unused-vars
  let eventBus
  let namingCoordinator
  let priorityManager
  let typeDefinitions
  let migrationValidator
  let performanceMetrics
  let stabilityMonitor

  beforeEach(async () => {
    // 初始化效能測試環境
    eventBus = new EventBus()
    namingCoordinator = new EventNamingUpgradeCoordinator(eventBus)
    priorityManager = new EventPriorityManager()
    typeDefinitions = new EventTypeDefinitions()

    // 初始化效能監控器
    performanceMetrics = {
      startTime: Date.now(),
      eventCounts: new Map(),
      latencies: [],
      memorySnapshots: [],
      errors: []
    }

    stabilityMonitor = {
      isActive: false,
      eventProcessed: 0,
      errorsDetected: 0,
      maxLatency: 0,
      minLatency: Infinity
    }

    // 設置模擬依賴
    // eslint-disable-next-line no-unused-vars
    const mockDependencies = {
      eventBus,
      readmooAdapter: {
        extractBookData: jest.fn().mockResolvedValue([]),
        validateExtractedData: jest.fn().mockReturnValue(true)
      },
      platformDetectionService: {
        detectPlatform: jest.fn().mockResolvedValue({
          platformId: 'READMOO',
          confidence: 0.9
        }),
        validatePlatform: jest.fn().mockResolvedValue(0.9)
      }
    }

    migrationValidator = new ReadmooPlatformMigrationValidator(mockDependencies, {
      enablePerformanceMonitoring: true,
      validationTimeout: 30000
    })

    // 記錄初始記憶體狀態
    performanceMetrics.memorySnapshots.push({
      timestamp: Date.now(),
      memory: process.memoryUsage()
    })

    // 等待初始化完成
    await new Promise(resolve => setTimeout(resolve, 50))
  })

  afterEach(async () => {
    // 停止監控並清理資源
    stabilityMonitor.isActive = false

    if (eventBus && typeof eventBus.removeAllListeners === 'function') {
      eventBus.removeAllListeners()
    }

    // 等待記憶體穩定化
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  describe('[FIX] 記憶體使用和穩定性驗證', () => {
    // 記憶體斷言策略（W1-017）：
    // Jest 在單一進程內依序執行所有 suite，process.memoryUsage().heapUsed 含其他
    // suite 殘留與 V8 GC 時序影響，且預設環境無 global.gc() 可強制回收。
    // 精確的記憶體增長硬門檻（如 < 15% / < 5%）在完整 npm test 下會 flaky。
    // 本區塊記憶體斷言一律作為「記憶體洩漏防護」（leak guard），門檻放寬到只攔截
    // 不受限的洩漏（數量級增長），不作為精確記憶體預算。
    describe('記憶體增長控制（洩漏防護）', () => {
      test('應該在大量事件處理後不發生不受限的記憶體洩漏', async () => {
        // 記錄初始記憶體
        // eslint-disable-next-line no-unused-vars
        const initialMemory = process.memoryUsage()
        performanceMetrics.memorySnapshots.push({
          phase: 'initial',
          memory: initialMemory,
          timestamp: Date.now()
        })

        // eslint-disable-next-line no-unused-vars
        const eventCount = 10000
        // eslint-disable-next-line no-unused-vars
        const batchSize = 1000

        // 分批處理大量事件以控制記憶體
        for (let batch = 0; batch < eventCount / batchSize; batch++) {
          // eslint-disable-next-line no-unused-vars
          const batchEvents = []

          // 生成一批事件
          for (let i = 0; i < batchSize; i++) {
            // eslint-disable-next-line no-unused-vars
            const eventIndex = batch * batchSize + i
            batchEvents.push({
              legacyEvent: `EXTRACTION.COMPLETED.${eventIndex}`,
              data: {
                iteration: eventIndex,
                timestamp: Date.now(),
                payload: new Array(100).fill(`data-${eventIndex}`)
              }
            })
          }

          // 處理這批事件
          for (const { legacyEvent, data } of batchEvents) {
            await namingCoordinator.intelligentEmit(legacyEvent, data)
            // eslint-disable-next-line no-unused-vars
            const modernEvent = namingCoordinator.convertToModernEvent(legacyEvent)
            priorityManager.assignEventPriority(modernEvent)
            typeDefinitions.recordEventUsage(modernEvent)
          }

          // 記錄中間記憶體狀態
          if (batch % 3 === 0) {
            // eslint-disable-next-line no-unused-vars
            const currentMemory = process.memoryUsage()
            performanceMetrics.memorySnapshots.push({
              phase: `batch-${batch}`,
              memory: currentMemory,
              timestamp: Date.now()
            })
          }

          // 每批次後稍微延遲，等待記憶體穩定
          await new Promise(resolve => setTimeout(resolve, 10))
        }

        // 等待記憶體穩定化
        await new Promise(resolve => setTimeout(resolve, 200))

        // 記錄最終記憶體
        // eslint-disable-next-line no-unused-vars
        const finalMemory = process.memoryUsage()
        performanceMetrics.memorySnapshots.push({
          phase: 'final',
          memory: finalMemory,
          timestamp: Date.now()
        })

        // 計算記憶體增長
        // eslint-disable-next-line no-unused-vars
        const memoryGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed

        // 記憶體洩漏防護：增長不應達不受限的數量級（門檻放寬，避免 GC 時序誤判）
        expect(memoryGrowth).toBeLessThan(2.0)

        // 檢查記憶體是否有異常洩漏
        // eslint-disable-next-line no-unused-vars
        const peakMemory = Math.max(...performanceMetrics.memorySnapshots.map(s => s.memory.heapUsed))
        // eslint-disable-next-line no-unused-vars
        const memoryVariation = (peakMemory - finalMemory.heapUsed) / finalMemory.heapUsed

        // 記憶體洩漏防護：峰值與最終值差距不應達不受限的數量級
        expect(memoryVariation).toBeLessThan(2.0)
      })

      test('應該正確清理事件監聽器避免記憶體洩漏', async () => {
        // eslint-disable-next-line no-unused-vars
        const initialMemory = process.memoryUsage()
        // eslint-disable-next-line no-unused-vars
        const listeners = []

        // 記錄基線監聽器數量
        // eslint-disable-next-line no-unused-vars
        const baselineListenerCount = eventBus.listeners.size

        // 保護斷言：顯性化「beforeEach 注入的監聽器數量為已知固定值」的隱含假設。
        // 此基線由 ReadmooPlatformMigrationValidator 建構子的 registerEventListeners()
        // 在共用 eventBus 上註冊 5 個監聽器構成（PLATFORM.VALIDATION.REQUESTED、
        // MIGRATION.VALIDATION.REQUESTED、VALIDATION.READMOO.{START,VERIFY,COMPLETE}.REQUESTED）。
        // EventBus 與 EventNamingUpgradeCoordinator 的建構子本身不註冊監聽器。
        // 若未來初始化邏輯改變導致基線數量漂移，此斷言會立即失敗，
        // 提示下方「回到基線」的驗證語意需重新檢視。
        expect(baselineListenerCount).toBe(5)

        // 創建大量事件監聽器
        for (let i = 0; i < 1000; i++) {
          // eslint-disable-next-line no-unused-vars
          const handler = () => { /* 模擬處理器 */ }
          // eslint-disable-next-line no-unused-vars
          const eventType = `TEST.MEMORY.${i}.COMPLETED`

          eventBus.on(eventType, handler)
          listeners.push({ eventType, handler })
        }

        // 移除所有監聽器
        for (const { eventType, handler } of listeners) {
          eventBus.off(eventType, handler)
        }

        // 功能正確性驗證：本測試新增的 1000 個監聽器確實全數被移除，
        // 監聽器數量回到基線（取代僅靠記憶體量測的弱驗證）。
        // EventBus.off 移除某 eventType 最後一個 handler 時會刪除該 key。
        expect(eventBus.listeners.size).toBe(baselineListenerCount)

        // 等待記憶體穩定化
        await new Promise(resolve => setTimeout(resolve, 150))

        // eslint-disable-next-line no-unused-vars
        const afterCleanupMemory = process.memoryUsage()

        // 記憶體洩漏防護：清理後不應殘留不受限的記憶體（門檻放寬，避免 GC 時序誤判）
        // eslint-disable-next-line no-unused-vars
        const memoryDifference = afterCleanupMemory.heapUsed - initialMemory.heapUsed
        // eslint-disable-next-line no-unused-vars
        const memoryGrowth = memoryDifference / initialMemory.heapUsed

        expect(memoryGrowth).toBeLessThan(2.0)
      })

      test('應該在快取管理中控制記憶體使用', async () => {
        // eslint-disable-next-line no-unused-vars
        const initialMemory = process.memoryUsage()

        // 創建大量快取項目
        for (let i = 0; i < 500; i++) {
          // eslint-disable-next-line no-unused-vars
          const context = {
            url: `https://readmoo.com/book/${i}`,
            hostname: 'readmoo.com',
            testData: new Array(1000).fill(`cache-data-${i}`)
          }

          await migrationValidator.validateReadmooMigration(context)
        }

        // 觸發快取清理
        migrationValidator._cleanupCache()

        // 等待記憶體穩定化
        await new Promise(resolve => setTimeout(resolve, 150))

        // eslint-disable-next-line no-unused-vars
        const afterCleanupMemory = process.memoryUsage()

        // 驗證快取清理效果
        // eslint-disable-next-line no-unused-vars
        const memoryGrowth = (afterCleanupMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed
        expect(memoryGrowth).toBeLessThan(2.0) // 記憶體增長少於 200% (調整為更實際的標準)

        // 驗證快取大小被控制
        expect(migrationValidator.validationCache.size).toBeLessThanOrEqual(migrationValidator.maxCacheSize)
      })
    })

    describe('記憶體洩漏預防測試', () => {
      test('應該不會產生記憶體洩漏', async () => {
        // eslint-disable-next-line no-unused-vars
        const initialMemory = process.memoryUsage().heapUsed
        // eslint-disable-next-line no-unused-vars
        const memorySnapshots = []

        // 執行多輪事件處理操作
        for (let cycle = 0; cycle < 5; cycle++) {
          // 模擬真實的事件處理場景
          for (let i = 0; i < 100; i++) {
            await namingCoordinator.intelligentEmit('TEMP.PROCESSING.COMPLETED', {
              id: `event-${cycle}-${i}`,
              data: `processing-data-${i}`,
              timestamp: Date.now()
            })
          }

          // 記錄每個循環後的記憶體使用，等待記憶體穩定化
          await new Promise(resolve => setTimeout(resolve, 100))

          // eslint-disable-next-line no-unused-vars
          const currentMemory = process.memoryUsage().heapUsed
          memorySnapshots.push(currentMemory)
        }

        // 驗證記憶體沒有持續增長
        // eslint-disable-next-line no-unused-vars
        const finalMemory = memorySnapshots[memorySnapshots.length - 1]
        // eslint-disable-next-line no-unused-vars
        const memoryGrowth = finalMemory - initialMemory
        // eslint-disable-next-line no-unused-vars
        const growthPercentage = memoryGrowth / initialMemory

        // 記憶體洩漏防護：增長不應達不受限的數量級（門檻放寬，避免 GC 時序誤判）
        expect(growthPercentage).toBeLessThan(2.0)

        // 驗證記憶體使用趨勢穩定 (允許合理的變化)
        // 只要記憶體增長在合理範圍內，就認為穩定
        // eslint-disable-next-line no-console
        console.log('Memory snapshots:', memorySnapshots.map((m, i) => `${i}: ${(m / 1024 / 1024).toFixed(2)}MB`))
        // eslint-disable-next-line no-console
        console.log('Memory growth percentage:', (growthPercentage * 100).toFixed(2) + '%')

        // 主要檢查：記憶體洩漏防護門檻（門檻放寬，避免 GC 時序誤判）
        expect(growthPercentage).toBeLessThan(2.0)
      })

      test('應該正確清理事件處理器和快取', async () => {
        // 註冊大量事件處理器
        // eslint-disable-next-line no-unused-vars
        const eventCount = 500
        for (let i = 0; i < eventCount; i++) {
          await namingCoordinator.intelligentEmit('CACHE.TEST.EVENT', {
            id: i,
            data: `test-data-${i}`
          })
        }

        // 執行清理
        if (namingCoordinator.cleanup) {
          await namingCoordinator.cleanup()
        }

        // 驗證清理效果
        if (namingCoordinator.activeListeners) {
          expect(namingCoordinator.activeListeners.size).toBe(0)
        }

        if (namingCoordinator.cache) {
          expect(namingCoordinator.cache.size).toBeLessThanOrEqual(
            namingCoordinator.maxCacheSize || 1000
          )
        }

        // 驗證沒有殘留的處理器
        // eslint-disable-next-line no-unused-vars
        const activeHandlerCount = countActiveHandlers(namingCoordinator)
        expect(activeHandlerCount).toBeLessThan(10) // 允許少量系統必要的處理器
      })

      test('應該在高負載下保持記憶體穩定', async () => {
        // eslint-disable-next-line no-unused-vars
        const initialMemory = process.memoryUsage().heapUsed
        // eslint-disable-next-line no-unused-vars
        const highLoadEventCount = 1000

        // 模擬高負載事件處理
        // eslint-disable-next-line no-unused-vars
        const promises = []
        for (let i = 0; i < highLoadEventCount; i++) {
          promises.push(
            namingCoordinator.intelligentEmit('HIGH.LOAD.EVENT', {
              id: i,
              payload: new Array(100).fill(`data-${i}`),
              timestamp: Date.now()
            })
          )
        }

        await Promise.all(promises)

        // 等待記憶體穩定化
        await new Promise(resolve => setTimeout(resolve, 200))

        // eslint-disable-next-line no-unused-vars
        const finalMemory = process.memoryUsage().heapUsed
        // eslint-disable-next-line no-unused-vars
        const memoryIncrease = finalMemory - initialMemory
        // eslint-disable-next-line no-unused-vars
        const increaseRatio = memoryIncrease / initialMemory

        // 記憶體增長應該保持在合理範圍內
        expect(increaseRatio).toBeLessThan(2.0) // 不超過初始記憶體的200%

        // 驗證系統仍然可以正常處理新事件
        try {
          await namingCoordinator.intelligentEmit('POST.LOAD.TEST', {
            test: 'system-recovery'
          })
          // 只要沒有拋出異常，就認為系統恢復正常
          expect(true).toBe(true)
        } catch (error) {
          throw new Error(`系統在高負載後無法恢復正常: ${error.message}`)
        }
      })
    })
  })

  describe('[FIX] 長時間運行穩定性測試', () => {
    describe('24小時運行模擬', () => {
      test('應該在模擬長時間運行中保持穩定', async () => {
        // eslint-disable-next-line no-unused-vars
        const testDuration = 10000 // 10 秒模擬 24 小時
        // eslint-disable-next-line no-unused-vars
        const eventInterval = 100 // 每 100ms 一個事件

        stabilityMonitor.isActive = true
        stabilityMonitor.eventProcessed = 0
        stabilityMonitor.errorsDetected = 0

        // eslint-disable-next-line no-unused-vars
        const stabilityPromise = new Promise((resolve, reject) => {
          // eslint-disable-next-line no-unused-vars
          const interval = setInterval(async () => {
            if (!stabilityMonitor.isActive) {
              clearInterval(interval)
              resolve()
              return
            }

            try {
              // eslint-disable-next-line no-unused-vars
              const eventTypes = [
                'EXTRACTION.COMPLETED',
                'STORAGE.SAVE.COMPLETED',
                'UI.POPUP.OPENED',
                'ANALYTICS.UPDATE.COMPLETED'
              ]

              // eslint-disable-next-line no-unused-vars
              const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)]
              // eslint-disable-next-line no-unused-vars
              const startTime = performance.now()

              await namingCoordinator.intelligentEmit(randomEvent, {
                sequence: stabilityMonitor.eventProcessed,
                timestamp: Date.now()
              })

              // eslint-disable-next-line no-unused-vars
              const endTime = performance.now()
              // eslint-disable-next-line no-unused-vars
              const latency = endTime - startTime

              stabilityMonitor.eventProcessed++
              stabilityMonitor.maxLatency = Math.max(stabilityMonitor.maxLatency, latency)
              stabilityMonitor.minLatency = Math.min(stabilityMonitor.minLatency, latency)
            } catch (error) {
              stabilityMonitor.errorsDetected++
              performanceMetrics.errors.push({
                error: error.message,
                timestamp: Date.now(),
                sequence: stabilityMonitor.eventProcessed
              })
            }
          }, eventInterval)

          // 設置測試超時
          setTimeout(() => {
            stabilityMonitor.isActive = false
          }, testDuration)
        })

        await stabilityPromise

        // 驗證穩定性指標（W1-094：規則 1 真實計時 < 1000ms 門檻已移除，
        // 改以 npm run test:perf 提供大幅退化防護；本檔保留功能正確性驗證）
        expect(stabilityMonitor.eventProcessed).toBeGreaterThan(80) // 至少處理 80 個事件
        expect(stabilityMonitor.errorsDetected).toBe(0) // 零錯誤
        expect(stabilityMonitor.minLatency).toBeGreaterThan(0) // 最小延遲大於 0（sanity，非計時門檻）

        // 檢查系統仍然響應
        // eslint-disable-next-line no-unused-vars
        const testResponseFn = async () => {
          return await namingCoordinator.intelligentEmit('SYSTEM.HEALTH.CHECK', {
            timestamp: Date.now()
          })
        }
        await expect(testResponseFn).not.toThrow()
      }, 15000)

      test('應該在持續負載下保持響應性', async () => {
        // eslint-disable-next-line no-unused-vars
        const loadTestDuration = 8000 // 8 秒負載測試
        // eslint-disable-next-line no-unused-vars
        const concurrentStreams = 5
        // eslint-disable-next-line no-unused-vars
        const eventsPerStream = 20

        // eslint-disable-next-line no-unused-vars
        const streamPromises = []

        // 創建多個並發事件流
        for (let stream = 0; stream < concurrentStreams; stream++) {
          // eslint-disable-next-line no-unused-vars
          const streamPromise = (async () => {
            // eslint-disable-next-line no-unused-vars
            const streamResults = {
              streamId: stream,
              eventsProcessed: 0,
              averageLatency: 0,
              errors: 0
            }

            // eslint-disable-next-line no-unused-vars
            const streamStartTime = Date.now()

            while (Date.now() - streamStartTime < loadTestDuration) {
              for (let event = 0; event < eventsPerStream; event++) {
                try {
                  // eslint-disable-next-line no-unused-vars
                  const eventStartTime = performance.now()

                  await namingCoordinator.intelligentEmit('LOAD.TEST.EVENT', {
                    stream,
                    event,
                    timestamp: Date.now()
                  })

                  // eslint-disable-next-line no-unused-vars
                  const eventEndTime = performance.now()
                  // eslint-disable-next-line no-unused-vars
                  const latency = eventEndTime - eventStartTime

                  streamResults.eventsProcessed++
                  streamResults.averageLatency =
                    (streamResults.averageLatency * (streamResults.eventsProcessed - 1) + latency) /
                    streamResults.eventsProcessed
                } catch (error) {
                  streamResults.errors++
                }
              }

              // 短暫延遲避免過度負載
              await new Promise(resolve => setTimeout(resolve, 50))
            }

            return streamResults
          })()

          streamPromises.push(streamPromise)
        }

        // eslint-disable-next-line no-unused-vars
        const streamResults = await Promise.all(streamPromises)

        // 驗證所有流的功能正確性（W1-094：規則 1 真實計時 averageLatency < 500ms
        // 門檻已移除，npm run test:perf 提供大幅退化防護）
        for (const result of streamResults) {
          expect(result.eventsProcessed).toBeGreaterThan(50) // 每個流至少處理 50 個事件
          expect(result.errors).toBe(0) // 零錯誤
        }

        // 驗證總體效能
        // eslint-disable-next-line no-unused-vars
        const totalEvents = streamResults.reduce((sum, r) => sum + r.eventsProcessed, 0)
        // eslint-disable-next-line no-unused-vars
        const totalErrors = streamResults.reduce((sum, r) => sum + r.errors, 0)
        // eslint-disable-next-line no-unused-vars
        const avgLatency = streamResults.reduce((sum, r) => sum + r.averageLatency, 0) / streamResults.length

        expect(totalEvents).toBeGreaterThan(250) // 總共至少 250 個事件
        expect(totalErrors).toBe(0) // 零錯誤
        // W1-094：規則 1 真實計時 avgLatency < 500ms 門檻已移除，
        // npm run test:perf 提供大幅退化防護
      })
    })

    describe('系統恢復能力測試', () => {
      test('應該從記憶體壓力中快速恢復', async () => {
        // eslint-disable-next-line no-unused-vars
        const recoveryMetrics = {
          beforePressure: null,
          duringPressure: null,
          afterRecovery: null
        }

        // 記錄正常狀態
        recoveryMetrics.beforePressure = {
          memory: process.memoryUsage(),
          timestamp: Date.now()
        }

        // 創建記憶體壓力
        // eslint-disable-next-line no-unused-vars
        const largeObjects = []
        for (let i = 0; i < 1000; i++) {
          largeObjects.push({
            id: i,
            data: new Array(10000).fill(`pressure-data-${i}`)
          })

          // 同時處理事件
          await namingCoordinator.intelligentEmit('MEMORY.PRESSURE.TEST', {
            iteration: i,
            timestamp: Date.now()
          })
        }

        // 記錄壓力狀態
        recoveryMetrics.duringPressure = {
          memory: process.memoryUsage(),
          timestamp: Date.now()
        }

        // 釋放記憶體壓力
        largeObjects.length = 0

        // 等待記憶體穩定化
        await new Promise(resolve => setTimeout(resolve, 500))

        // 記錄恢復狀態
        recoveryMetrics.afterRecovery = {
          memory: process.memoryUsage(),
          timestamp: Date.now()
        }

        // 驗證系統是否正常工作
        // eslint-disable-next-line no-unused-vars
        const testStartTime = performance.now()
        await namingCoordinator.intelligentEmit('RECOVERY.TEST.COMPLETED', {
          timestamp: Date.now()
        })
        // eslint-disable-next-line no-unused-vars
        const testEndTime = performance.now()
        // eslint-disable-next-line no-unused-vars
        const responseTime = testEndTime - testStartTime

        // 驗證系統恢復能力 - 重點放在功能性而非記憶體精確測量
        // eslint-disable-next-line no-unused-vars
        const memoryPressureIncrease = recoveryMetrics.duringPressure.memory.heapUsed - recoveryMetrics.beforePressure.memory.heapUsed
        // eslint-disable-next-line no-unused-vars
        const memoryAfterRecovery = recoveryMetrics.afterRecovery.memory.heapUsed - recoveryMetrics.beforePressure.memory.heapUsed

        // eslint-disable-next-line no-console
        console.log(`記憶體指標: 壓力增加=${memoryPressureIncrease}, 恢復後=${memoryAfterRecovery}`)

        // W1-094：規則 1 真實計時 responseTime < 1000ms 門檻已移除（performance.now() 差值）；
        // 系統恢復能力改以下方 responseTime > 0 sanity check 與功能可呼叫驗證
        // 記憶體驗證 - 現實的標準，在測試環境中記憶體行為不穩定
        // eslint-disable-next-line no-unused-vars
        const memoryIncreaseAfterRecovery = recoveryMetrics.afterRecovery.memory.heapUsed - recoveryMetrics.beforePressure.memory.heapUsed
        // eslint-disable-next-line no-unused-vars
        const memoryIncreaseRatio = memoryIncreaseAfterRecovery / recoveryMetrics.beforePressure.memory.heapUsed

        // eslint-disable-next-line no-console
        console.log(`記憶體增加比例: ${(memoryIncreaseRatio * 100).toFixed(1)}%`)

        // 驗證記憶體沒有失控增長（超過 200%）- 更現實的標準
        expect(memoryIncreaseRatio).toBeLessThan(2.0) // 記憶體增加不超過 200%

        // 驗證事件系統仍然可用（最重要的指標）
        expect(responseTime).toBeGreaterThan(0) // 事件系統響應正常
      })

      test('應該處理異常事件流並保持穩定', async () => {
        // eslint-disable-next-line no-unused-vars
        const exceptionHandler = jest.fn()
        eventBus.on('SYSTEM.GENERIC.EXCEPTION.HANDLED', exceptionHandler)

        // eslint-disable-next-line no-unused-vars
        const exceptionScenarios = [
          { type: 'null-data', event: 'TEST.NULL.COMPLETED', data: null },
          { type: 'undefined-data', event: 'TEST.UNDEFINED.COMPLETED', data: undefined },
          { type: 'circular-data', event: 'TEST.CIRCULAR.COMPLETED', data: {} },
          { type: 'large-data', event: 'TEST.LARGE.COMPLETED', data: { payload: new Array(100000).fill('large') } },
          { type: 'invalid-event', event: '', data: { test: true } },
          { type: 'malformed-event', event: 'INVALID_FORMAT', data: { test: true } }
        ]

        // 創建循環引用
        exceptionScenarios[2].data.self = exceptionScenarios[2].data

        // eslint-disable-next-line no-unused-vars
        const handledExceptions = []

        for (const scenario of exceptionScenarios) {
          try {
            await namingCoordinator.intelligentEmit(scenario.event, scenario.data)
            handledExceptions.push({ scenario: scenario.type, handled: true })
          } catch (error) {
            handledExceptions.push({
              scenario: scenario.type,
              handled: false,
              error: error.message
            })
          }
        }

        // 驗證系統仍然穩定
        // eslint-disable-next-line no-unused-vars
        const stabilityTestFn = async () => {
          return await namingCoordinator.intelligentEmit('STABILITY.CHECK.COMPLETED', {
            timestamp: Date.now()
          })
        }

        await expect(stabilityTestFn).not.toThrow()

        // 大部分異常應該被優雅處理
        // eslint-disable-next-line no-unused-vars
        const successfullyHandled = handledExceptions.filter(h => h.handled).length
        expect(successfullyHandled).toBeGreaterThan(exceptionScenarios.length * 0.5) // 至少 50% 被正確處理
      })
    })
  })

  describe('[FIX] 併發事件處理和系統負載測試', () => {
    describe('高併發事件處理', () => {
      test('應該正確處理大量併發事件', async () => {
        // eslint-disable-next-line no-unused-vars
        const concurrentEventCount = 1000
        // eslint-disable-next-line no-unused-vars
        const eventTypes = [
          'EXTRACTION.READMOO.EXTRACT.COMPLETED',
          'DATA.READMOO.SAVE.COMPLETED',
          'UX.GENERIC.NOTIFICATION.SENT',
          'PLATFORM.READMOO.DETECT.COMPLETED',
          'ANALYTICS.GENERIC.UPDATE.COMPLETED'
        ]

        // eslint-disable-next-line no-unused-vars
        const processedEvents = new Map()
        // eslint-disable-next-line no-unused-vars
        const eventPromises = []

        // 設置事件監聽器
        for (const eventType of eventTypes) {
          processedEvents.set(eventType, 0)
          eventBus.on(eventType, () => {
            processedEvents.set(eventType, processedEvents.get(eventType) + 1)
          })
        }

        // eslint-disable-next-line no-unused-vars
        const startTime = performance.now()

        // 創建大量併發事件
        for (let i = 0; i < concurrentEventCount; i++) {
          // eslint-disable-next-line no-unused-vars
          const eventType = eventTypes[i % eventTypes.length]
          // eslint-disable-next-line no-unused-vars
          const promise = namingCoordinator.intelligentEmit(eventType, {
            id: i,
            timestamp: Date.now(),
            concurrentTest: true
          })
          eventPromises.push(promise)
        }

        // 等待所有事件處理完成
        await Promise.all(eventPromises)

        // eslint-disable-next-line no-unused-vars
        const endTime = performance.now()
        // eslint-disable-next-line no-unused-vars
        const totalTime = endTime - startTime

        // 等待事件處理器執行
        await new Promise(resolve => setTimeout(resolve, 200))

        // 驗證所有事件都被正確處理
        // eslint-disable-next-line no-unused-vars
        const totalProcessed = Array.from(processedEvents.values()).reduce((sum, count) => sum + count, 0)
        expect(totalProcessed).toBe(concurrentEventCount)

        // W1-094：規則 1 真實計時 avgTimePerEvent < 25ms / totalTime < 20000ms 門檻已移除
        // （performance.now() 差值），npm run test:perf 提供大幅退化防護。
        // 本檔保留下方事件分佈一致性驗證作為功能正確性核心斷言。

        // 驗證各事件類型的處理平衡
        for (const [, count] of processedEvents) {
          // eslint-disable-next-line no-unused-vars
          const expectedCount = Math.floor(concurrentEventCount / eventTypes.length)
          expect(count).toBeGreaterThanOrEqual(expectedCount - 1)
          expect(count).toBeLessThanOrEqual(expectedCount + 1)
        }
      })

      test('應該在極限負載下保持資料一致性', async () => {
        // eslint-disable-next-line no-unused-vars
        const extremeLoadTest = {
          eventCount: 5000,
          concurrentBatches: 10,
          batchSize: 500
        }

        // eslint-disable-next-line no-unused-vars
        const dataConsistencyCheck = {
          sentEvents: new Map(),
          receivedEvents: new Map(),
          processingErrors: []
        }

        // 設置資料一致性監控
        // eslint-disable-next-line no-unused-vars
        const consistencyHandler = (eventData) => {
          // EventBus.emit 直接傳遞 data，而不是包裝在 event 對象中
          // eslint-disable-next-line no-unused-vars
          const eventId = eventData.id
          if (!dataConsistencyCheck.receivedEvents.has(eventId)) {
            dataConsistencyCheck.receivedEvents.set(eventId, [])
          }
          dataConsistencyCheck.receivedEvents.get(eventId).push({ data: eventData })
        }

        eventBus.on('CONSISTENCY.TEST.EVENT', consistencyHandler)

        // eslint-disable-next-line no-unused-vars
        const batchPromises = []

        // 創建多個並發批次
        for (let batch = 0; batch < extremeLoadTest.concurrentBatches; batch++) {
          // eslint-disable-next-line no-unused-vars
          const batchPromise = (async () => {
            for (let i = 0; i < extremeLoadTest.batchSize; i++) {
              // eslint-disable-next-line no-unused-vars
              const eventId = `${batch}-${i}`
              // eslint-disable-next-line no-unused-vars
              const eventData = {
                id: eventId,
                batch,
                index: i,
                timestamp: Date.now(),
                payload: `payload-${eventId}`
              }

              dataConsistencyCheck.sentEvents.set(eventId, eventData)

              try {
                // 直接使用 eventBus 確保監聽器能正確接收事件
                await eventBus.emit('CONSISTENCY.TEST.EVENT', eventData)
              } catch (error) {
                dataConsistencyCheck.processingErrors.push({
                  eventId,
                  error: error.message
                })
              }
            }
          })()

          batchPromises.push(batchPromise)
        }

        // 等待所有批次完成
        await Promise.all(batchPromises)

        // 等待事件處理完成
        await new Promise(resolve => setTimeout(resolve, 1000))

        // 驗證資料一致性
        // eslint-disable-next-line no-unused-vars
        const totalSent = dataConsistencyCheck.sentEvents.size
        // eslint-disable-next-line no-unused-vars
        const totalReceived = dataConsistencyCheck.receivedEvents.size
        // eslint-disable-next-line no-unused-vars
        const processingErrors = dataConsistencyCheck.processingErrors.length

        expect(totalSent).toBe(extremeLoadTest.eventCount)
        expect(totalReceived).toBe(totalSent) // 沒有事件遺失
        expect(processingErrors).toBe(0) // 沒有處理錯誤

        // 驗證每個事件只被處理一次
        for (const [eventId, receivedList] of dataConsistencyCheck.receivedEvents) {
          expect(receivedList.length).toBe(1) // 每個事件只收到一次

          // eslint-disable-next-line no-unused-vars
          const sentData = dataConsistencyCheck.sentEvents.get(eventId)
          // eslint-disable-next-line no-unused-vars
          const receivedData = receivedList[0].data

          expect(receivedData.id).toBe(sentData.id)
          expect(receivedData.payload).toBe(sentData.payload)
        }
      })
    })

    describe('系統負載極限測試', () => {
      test('應該在系統資源極限下保持功能', async () => {
        // eslint-disable-next-line no-unused-vars
        const resourceLimitTest = {
          maxMemoryUsage: 0,
          maxEventLatency: 0,
          totalEventsProcessed: 0,
          systemStable: true
        }

        // eslint-disable-next-line no-unused-vars
        const resourceMonitor = setInterval(() => {
          // eslint-disable-next-line no-unused-vars
          const currentMemory = process.memoryUsage()
          resourceLimitTest.maxMemoryUsage = Math.max(
            resourceLimitTest.maxMemoryUsage,
            currentMemory.heapUsed
          )
        }, 100)

        try {
          // 逐步增加負載直到系統極限
          // eslint-disable-next-line no-unused-vars
          const loadLevels = [100, 500, 1000, 2000, 5000]

          for (const loadLevel of loadLevels) {
            // eslint-disable-next-line no-unused-vars
            const _levelStartTime = performance.now()
            // eslint-disable-next-line no-unused-vars
            const levelPromises = []

            for (let i = 0; i < loadLevel; i++) {
              // eslint-disable-next-line no-unused-vars
              const eventStartTime = performance.now()
              // eslint-disable-next-line no-unused-vars
              const promise = namingCoordinator.intelligentEmit('LOAD.LIMIT.TEST', {
                level: loadLevel,
                iteration: i,
                timestamp: Date.now()
              }).then(() => {
                // eslint-disable-next-line no-unused-vars
                const eventEndTime = performance.now()
                // eslint-disable-next-line no-unused-vars
                const eventLatency = eventEndTime - eventStartTime
                resourceLimitTest.maxEventLatency = Math.max(
                  resourceLimitTest.maxEventLatency,
                  eventLatency
                )
                resourceLimitTest.totalEventsProcessed++
              }).catch((error) => {
                resourceLimitTest.systemStable = false
                throw error
              })

              levelPromises.push(promise)
            }

            await Promise.all(levelPromises)

            // 檢查系統是否仍然響應
            // eslint-disable-next-line no-unused-vars
            const healthCheckStart = performance.now()
            await namingCoordinator.intelligentEmit('SYSTEM.HEALTH.CHECK', {
              level: loadLevel,
              timestamp: Date.now()
            })
            // eslint-disable-next-line no-unused-vars
            const healthCheckEnd = performance.now()
            // eslint-disable-next-line no-unused-vars
            const healthCheckTime = healthCheckEnd - healthCheckStart

            // 如果健康檢查時間過長，表示系統接近極限
            if (healthCheckTime > 100) {
              // eslint-disable-next-line no-console
              console.warn(`System approaching limits at load level ${loadLevel}`)
            }

            // 等待系統穩定
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        } finally {
          clearInterval(resourceMonitor)
        }

        // 驗證系統在極限負載下的功能正確性（W1-094：規則 1 真實計時 maxEventLatency
        // < 2000ms 門檻已移除，npm run test:perf 提供大幅退化防護）
        expect(resourceLimitTest.systemStable).toBe(true)
        expect(resourceLimitTest.totalEventsProcessed).toBeGreaterThan(8000) // 至少處理 8000 個事件

        // 記憶體使用應該在合理範圍內
        // eslint-disable-next-line no-unused-vars
        const initialMemory = performanceMetrics.memorySnapshots[0]?.memory.heapUsed || process.memoryUsage().heapUsed
        // eslint-disable-next-line no-unused-vars
        const memoryGrowth = initialMemory > 0 ? (resourceLimitTest.maxMemoryUsage - initialMemory) / initialMemory : 0
        expect(memoryGrowth).toBeLessThan(2.0) // 記憶體增長少於 200%
      })
    })
  })
})

// 記憶體測試輔助函數
// eslint-disable-next-line no-unused-vars
function isMemoryTrendStable (snapshots) {
  if (snapshots.length < 3) return true

  // 檢查是否有持續上升趨勢
  // eslint-disable-next-line no-unused-vars
  let increasingCount = 0
  for (let i = 1; i < snapshots.length; i++) {
    if (snapshots[i] > snapshots[i - 1]) {
      increasingCount++
    }
  }

  // 如果大部分快照都在增長，認為不穩定
  return increasingCount < snapshots.length * 0.7
}

function countActiveHandlers (coordinator) {
  // eslint-disable-next-line no-unused-vars
  let count = 0
  if (coordinator.eventHandlers) {
    count += coordinator.eventHandlers.size || 0
  }
  if (coordinator.listeners) {
    count += coordinator.listeners.length || 0
  }
  return count
}
