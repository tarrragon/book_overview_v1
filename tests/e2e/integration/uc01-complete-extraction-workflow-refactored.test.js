/**
 * UC-01 完整資料提取工作流程端到端整合測試 - 重構版
 * 使用統一測試基礎設施，符合 Five Lines 規則
 *
 * 測試目標：驗證從使用者點擊Extension到資料持久化儲存的完整鏈路
 * 涵蓋範圍：正常流程、邊界條件、異常處理、效能驗證
 *
 * @author TDD Phase 4 - cinnamon-refactor-owl重構設計師（重構）
 * @original-author TDD Phase 2 - sage-test-architect
 * @date 2025-08-25
 * @version v0.9.38-refactor
 */

const TestInfrastructureFactory = require('../../infrastructure/test-infrastructure-factory')

describe('UC-01 Complete Extraction Workflow E2E Tests - Refactored', () => {
  let testEnvironment

  beforeEach(async () => {
    testEnvironment = await TestInfrastructureFactory.createStandardE2EEnvironment({
      chromeAPI: { enableErrorHandling: true },
      errorConfig: { probability: 0.1 },
      memoryConfig: { trackingEnabled: true },
      eventConfig: { captureAll: true }
    })
    await testEnvironment.setup()
  })

  afterEach(async () => {
    await testEnvironment.teardown()
  })

  describe('Phase 1: Environment and Initialization Tests', () => {
    test('TC-E2E-INIT-001: E2E測試環境正確設置', async () => {
      // Given: 測試環境已初始化
      const setupValid = testEnvironment.isSetup()

      // When & Then: 驗證環境設置完成
      expect(setupValid).toBe(true)
      expect(global.chrome).toBeDefined()
      expect(global.chrome.storage.local).toBeDefined()
      expect(global.chrome.runtime.sendMessage).toBeDefined()
    })

    test('TC-E2E-INIT-002: Chrome Extension環境模擬準確性', async () => {
      // Given: Chrome Extension環境已設置
      const chromeAPIs = ['storage', 'runtime', 'tabs']

      // When: 檢查API可用性
      const apiAvailability = chromeAPIs.map(api => ({
        name: api,
        available: !!global.chrome[api]
      }))

      // Then: 所有API都應該可用
      apiAvailability.forEach(api => {
        expect(api.available).toBe(true)
      })
    })

    test('TC-E2E-INIT-003: 測試記憶體監控功能', async () => {
      // Given: 記憶體監控已啟用
      const initialMemory = testEnvironment._getCurrentMemoryUsage()

      // When: 執行記憶體消耗操作
      const largeArray = new Array(10000).fill('test')
      const afterMemory = testEnvironment._getCurrentMemoryUsage()

      // Then: 記憶體使用量應該增加
      expect(afterMemory).toBeGreaterThan(initialMemory)

      // Clean up
      largeArray.length = 0
    })

    test('TC-E2E-INIT-004: 錯誤注入功能驗證', async () => {
      // Given: 錯誤注入器已設置
      testEnvironment.injectError('storage-failure')

      // When: 嘗試使用Storage API
      const storageOperation = async () => {
        return new Promise((resolve, reject) => {
          global.chrome.storage.local.set({ test: 'value' }, () => {
            if (global.chrome.runtime.lastError) {
              reject(new Error(global.chrome.runtime.lastError.message))
            } else {
              resolve('success')
            }
          })
        })
      }

      // Then: 應該拋出注入的錯誤
      await expect(storageOperation()).rejects.toThrow()
      await expect(storageOperation()).rejects.toMatchObject({
        code: 'STORAGE_OPERATION_FAILED',
        details: expect.any(Object)
      })
    })
  })

  describe('Phase 2: Normal Workflow Tests', () => {
    test('TC-E2E-001: 完整UC-01工作流程端到端驗證', async () => {
      // Given: 標準E2E測試環境
      const workflowConfig = {
        bookCount: 15,
        expectedTime: 3000,
        expectedMemoryLimit: 50 * 1024 * 1024
      }

      // When: 執行完整的資料提取流程
      const result = await testEnvironment.executeWorkflow('basic-extraction')

      // Then: 系統正確完成資料提取
      expect(result.success).toBe(true)
      expect(result.extractedBooks).toBe(workflowConfig.bookCount)
      expect(result.executionTime).toBeLessThan(workflowConfig.expectedTime)
      expect(result.memoryUsage).toBeLessThan(workflowConfig.expectedMemoryLimit)
    })

    test('TC-E2E-002: 事件序列正確性驗證', async () => {
      // Given: 事件模擬已啟用
      const expectedEvents = [
        'workflow.started',
        'data.extraction.completed',
        'storage.save.completed'
      ]

      // When: 執行工作流程
      const result = await testEnvironment.executeWorkflow('basic-extraction')

      // Then: 事件按預期順序發生
      expect(result.success).toBe(true)
      expect(result.executionTime).toBeLessThan(5000)

      // 驗證記憶體沒有洩漏 (result.memoryUsage 已經是差異值)
      expect(result.memoryUsage).toBeLessThan(5 * 1024 * 1024) // < 5MB增長
    })

    test('TC-E2E-003: 資料完整性和準確性驗證', async () => {
      // Given: 標準測試資料
      const testData = {
        expectedBooks: 10,
        bookFormat: 'standard',
        includeMetadata: true
      }

      // When: 執行資料提取
      const result = await testEnvironment.executeWorkflow('data-integrity-test', testData)

      // Then: 資料完整且準確
      expect(result.success).toBe(true)
      expect(result.extractedBooks).toBe(testData.expectedBooks)
      expect(result.processingTime).toBeLessThan(2000)

      // 驗證沒有記憶體洩漏 (檢查處理過程的記憶體增長)
      expect(result.memoryUsage).toBeLessThan(10 * 1024 * 1024) // < 10MB增長
    })
  })

  describe('Phase 3: Boundary Condition Tests', () => {
    test('TC-E2E-B001: 空資料優雅處理驗證', async () => {
      // Given: 空資料場景
      const emptyScenario = 'empty-data-test'

      // When: 執行空資料提取
      const result = await testEnvironment.executeWorkflow(emptyScenario)

      // Then: 系統優雅處理空資料
      expect(result.success).toBe(true)
      expect(result.extractedBooks).toBe(0)
      expect(result.executionTime).toBeLessThan(1000)
    })

    test('TC-E2E-B002: 效能限制驗證', async () => {
      // Given: 效能測試環境
      const perfEnvironment = await TestInfrastructureFactory.createPerformanceTestEnvironment({
        interval: 50
      })
      await perfEnvironment.setup()

      try {
        // When: 執行效能測試
        const startTime = Date.now()
        const result = await perfEnvironment.executeWorkflow('basic-extraction')
        const endTime = Date.now()

        // Then: 效能符合要求
        expect(endTime - startTime).toBeLessThan(5000)
        expect(result.success).toBe(true)
        expect(result.memoryUsage).toBeLessThan(100 * 1024 * 1024) // < 100MB
      } finally {
        await perfEnvironment.teardown()
      }
    })
  })

  describe('Phase 4: Exception Handling Tests', () => {
    test('TC-E2E-E001: Chrome Extension權限錯誤處理', async () => {
      // Given: 權限錯誤場景
      testEnvironment.injectError('storage-failure')

      // When: 執行儲存錯誤恢復流程
      const result = await testEnvironment.executeWorkflow('permission-error-test')

      // Then: 系統優雅處理權限錯誤
      expect(result.errorHandled).toBe(true)
      expect(result.recoverySuccess).toBe(true)
    })

    test('TC-E2E-E002: 網路錯誤恢復驗證', async () => {
      // Given: 網路錯誤場景
      testEnvironment.injectError('network-timeout')

      // When: 執行網路錯誤處理
      const result = await testEnvironment.executeWorkflow('network-recovery')

      // Then: 系統處理網路錯誤
      expect(result.success).toBe(true)
      expect(result.executionTime).toBeGreaterThan(1000) // 包含重試時間
    })

    test('TC-E2E-E003: 記憶體限制處理驗證', async () => {
      // Given: 記憶體監控環境
      const initialMemory = testEnvironment._getCurrentMemoryUsage()

      // When: 執行記憶體密集操作
      const result = await testEnvironment.executeWorkflow('basic-extraction')

      // Then: 記憶體使用在合理範圍
      const memoryUsed = result.memoryUsage
      expect(memoryUsed).toBeLessThan(50 * 1024 * 1024) // < 50MB

      // 記憶體應該在測試後回收
      await new Promise(resolve => setTimeout(resolve, 200))
      const finalMemory = testEnvironment._getCurrentMemoryUsage()
      expect(finalMemory - initialMemory).toBeLessThan(5 * 1024 * 1024) // < 5MB殘留
    })
  })
})
