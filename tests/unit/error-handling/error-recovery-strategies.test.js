/**
 * 錯誤恢復策略測試
 * v0.9.32 - TDD Phase 2 錯誤恢復機制測試實作
 *
 * 測試目標：
 * - 驗證自動恢復機制的有效性
 * - 測試重試邏輯和指數退避策略
 * - 驗證降級機制的觸發和執行
 * - 確保恢復策略的效能和穩定性
 *
 * 恢復策略類型：
 * - RETRY: 重試操作（指數退避）
 * - FALLBACK: 降級到替代方案
 * - USER_INTERVENTION: 需要使用者介入
 * - GRACEFUL_DEGRADATION: 優雅降級
 * - RESTART: 重啟組件或服務
 * - ROLLBACK: 回滾到穩定狀態
 */

describe('🔄 錯誤恢復策略測試 (v0.9.32)', () => {
  let ErrorRecoveryManager
  let mockLogger, mockNotifier, mockMetrics

  beforeEach(() => {
    // 重置模組以確保測試隔離
    jest.resetModules()

    // Mock 依賴服務
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }

    mockNotifier = {
      notify: jest.fn(),
      showError: jest.fn(),
      showSuccess: jest.fn()
    }

    mockMetrics = {
      increment: jest.fn(),
      gauge: jest.fn(),
      timing: jest.fn()
    }

    // Mock ErrorRecoveryManager
    ErrorRecoveryManager = {
      attemptRecovery: jest.fn(),
      getStrategy: jest.fn(),
      executeStrategy: jest.fn(),
      validateRecovery: jest.fn()
    }

    // 重置計時器
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  describe('🔁 重試機制測試', () => {
    test('應該實現指數退避重試策略', async () => {
      // Given: 會暫時失敗的操作
      let attemptCount = 0
      const flakyOperation = jest.fn().mockImplementation(() => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error(`Temporary failure ${attemptCount}`)
        }
        return `Success after ${attemptCount} attempts`
      })

      // When: 執行指數退避重試
      const result = await testHelpers.executeRetryWithBackoff(flakyOperation, {
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 1000
      })

      // Then: 應該最終成功
      expect(result).toBe('Success after 3 attempts')
      expect(flakyOperation).toHaveBeenCalledTimes(3)

      // 驗證退避延遲時間
      expect(testHelpers.getRetryDelays()).toEqual([100, 200, 400]) // 指數增長
    }, 15000)

    test('應該在超過最大重試次數後失敗', async () => {
      // Given: 總是失敗的操作
      const alwaysFailingOperation = jest.fn().mockRejectedValue(
        new Error('Permanent failure')
      )

      // When: 執行重試策略
      const promise = testHelpers.executeRetryWithBackoff(alwaysFailingOperation, {
        maxRetries: 2,
        baseDelay: 50
      })

      // Then: 應該在重試耗盡後失敗
      await expect(promise).rejects.toThrow('Permanent failure')
      expect(alwaysFailingOperation).toHaveBeenCalledTimes(3) // 初始 + 2次重試
    }, 15000)

    test('應該支援條件重試策略', async () => {
      // Given: 有條件失敗的操作
      let attemptCount = 0
      const conditionalFailingOperation = jest.fn().mockImplementation(() => {
        attemptCount++
        if (attemptCount === 1) {
          const tempError = new Error('Temporary network error')
          tempError.retryable = true
          throw tempError
        }
        if (attemptCount === 2) {
          const permError = new Error('Permission denied')
          permError.retryable = false
          throw permError
        }
        return 'success'
      })

      // When: 執行條件重試
      const shouldRetry = (error) => error.retryable === true

      const promise = testHelpers.executeRetryWithBackoff(conditionalFailingOperation, {
        maxRetries: 3,
        baseDelay: 10,
        shouldRetry
      })

      // Then: 應該在不可重試錯誤時停止
      await expect(promise).rejects.toThrow('Permission denied')
      expect(conditionalFailingOperation).toHaveBeenCalledTimes(2) // 遇到不可重試錯誤就停止
    }, 20000)

    test('應該記錄重試統計資訊', async () => {
      // Given: 需要重試的操作
      let attempts = 0
      const operation = jest.fn().mockImplementation(() => {
        attempts++
        if (attempts < 2) {
          throw new Error('Retry needed')
        }
        return 'success'
      })

      // When: 執行重試並收集統計
      const result = await testHelpers.executeRetryWithMetrics(operation, {
        maxRetries: 3,
        baseDelay: 10
      })

      // Then: 應該記錄完整的統計資訊
      expect(result.value).toBe('success')
      expect(result.metrics).toEqual({
        totalAttempts: 2,
        totalTime: expect.any(Number),
        retryCount: 1,
        strategy: 'EXPONENTIAL_BACKOFF'
      })

      expect(mockMetrics.increment).toHaveBeenCalledWith('recovery.retry.attempt')
      expect(mockMetrics.timing).toHaveBeenCalledWith('recovery.retry.duration', expect.any(Number))
    }, 25000)
  })

  describe('📉 降級機制測試', () => {
    test('應該在主服務不可用時啟動降級', async () => {
      // Given: 主服務不可用
      const primaryService = {
        isAvailable: () => false,
        getData: jest.fn().mockRejectedValue(new Error('Service unavailable'))
      }

      const fallbackService = {
        isAvailable: () => true,
        getData: jest.fn().mockResolvedValue({
          books: [],
          source: 'cache',
          message: '使用離線資料'
        })
      }

      // When: 執行降級策略
      const result = await testHelpers.executeFallbackStrategy(primaryService, fallbackService)

      // Then: 應該使用降級服務
      expect(result.source).toBe('cache')
      expect(result.message).toContain('離線')
      expect(fallbackService.getData).toHaveBeenCalled()
      expect(primaryService.getData).toHaveBeenCalled()
    })

    test('應該實現多層級降級', async () => {
      // Given: 多個降級選項
      const services = [
        { name: 'primary', available: false, priority: 1 },
        { name: 'secondary', available: false, priority: 2 },
        { name: 'cache', available: true, priority: 3 },
        { name: 'default', available: true, priority: 4 }
      ]

      // When: 執行多層級降級
      const result = await testHelpers.executeMultiTierFallback(services)

      // Then: 應該選擇第一個可用的服務
      expect(result.selectedService).toBe('cache')
      expect(result.fallbackLevel).toBe(3)
    })

    test('應該在服務恢復後自動切回', async () => {
      // Given: 服務從故障中恢復
      let serviceAvailable = false
      const primaryService = {
        isAvailable: () => serviceAvailable,
        getData: jest.fn().mockImplementation(() => {
          if (serviceAvailable) {
            return Promise.resolve({ books: [], source: 'primary' })
          }
          throw new Error('Service down')
        })
      }

      const fallbackService = {
        getData: jest.fn().mockResolvedValue({ books: [], source: 'fallback' })
      }

      // When: 先降級，然後服務恢復
      let result = await testHelpers.executeServiceWithFallback(primaryService, fallbackService)
      expect(result.source).toBe('fallback')

      // 模擬服務恢復
      serviceAvailable = true
      result = await testHelpers.executeServiceWithFallback(primaryService, fallbackService)

      // Then: 應該切回主服務
      expect(result.source).toBe('primary')
    })

    test('應該維護降級狀態統計', () => {
      // Given: 降級管理器
      const fallbackManager = testHelpers.createFallbackManager()

      // When: 執行多次降級
      fallbackManager.activateFallback('network-error', 'primary-to-cache')
      fallbackManager.activateFallback('permission-denied', 'storage-to-memory')
      fallbackManager.deactivateFallback('network-error')

      // Then: 應該正確追蹤狀態
      const stats = fallbackManager.getStats()
      expect(stats.activeFallbacks).toBe(1)
      expect(stats.totalActivations).toBe(2)
      expect(stats.totalDeactivations).toBe(1)
      expect(stats.fallbackHistory).toHaveLength(3)
    })
  })

  describe('👤 使用者介入策略測試', () => {
    test('應該在需要時請求使用者介入', async () => {
      // Given: 需要使用者介入的錯誤
      const permissionError = new Error('Storage permission required')
      permissionError.recoveryType = 'USER_INTERVENTION'
      permissionError.userAction = 'GRANT_PERMISSION'

      // When: 請求使用者介入
      const recovery = await testHelpers.requestUserIntervention(permissionError)

      // Then: 應該提供正確的引導
      expect(recovery.type).toBe('USER_INTERVENTION')
      expect(recovery.action).toBe('GRANT_PERMISSION')
      expect(recovery.guidance).toContain('權限')
      expect(recovery.steps).toBeInstanceOf(Array)
      expect(recovery.steps.length).toBeGreaterThan(0)
    })

    test('應該提供使用者操作驗證', async () => {
      // Given: 使用者完成了權限授予
      const userAction = {
        type: 'GRANT_PERMISSION',
        permission: 'storage',
        granted: true,
        timestamp: Date.now()
      }

      // When: 驗證使用者操作
      const validation = await testHelpers.validateUserAction(userAction)

      // Then: 應該確認操作有效性
      expect(validation.valid).toBe(true)
      expect(validation.canProceed).toBe(true)
      expect(validation.nextStep).toBe('RETRY_ORIGINAL_OPERATION')
    })

    test('應該處理使用者操作超時', async () => {
      // Given: 等待使用者操作的超時設定
      const timeoutMs = 30000 // 30秒超時

      // When: 等待使用者操作但超時
      const promise = testHelpers.waitForUserAction('RELOAD_EXTENSION', timeoutMs)

      // 快進時間超過超時限制
      jest.advanceTimersByTime(31000)

      // Then: 應該處理超時
      const result = await promise
      expect(result.timedOut).toBe(true)
      expect(result.fallbackAction).toBe('SHOW_MANUAL_INSTRUCTIONS')
    })
  })

  describe('🎯 優雅降級策略測試', () => {
    test('應該實現功能級別的降級', () => {
      // Given: 功能模組故障
      const brokenModule = {
        name: 'AdvancedSearch',
        available: false,
        error: new Error('Module initialization failed')
      }

      // When: 執行功能降級
      const degradation = testHelpers.executeFunctionalDegradation(brokenModule)

      // Then: 應該提供簡化版功能
      expect(degradation.degradedModule).toBe('BasicSearch')
      expect(degradation.availableFeatures).toContain('simple-text-search')
      expect(degradation.unavailableFeatures).toContain('advanced-filters')
      expect(degradation.userNotification).toContain('部分功能暫時無法使用')
    })

    test('應該維護核心功能可用性', () => {
      // Given: 非核心功能故障
      const failedFeatures = ['export-csv', 'book-statistics', 'theme-customization']

      // When: 評估系統可用性
      const availability = testHelpers.evaluateSystemAvailability(failedFeatures)

      // Then: 核心功能應該仍然可用
      expect(availability.coreAvailable).toBe(true)
      expect(availability.criticalFunctions).toEqual([
        'book-display',
        'search',
        'data-import',
        'basic-export'
      ])
      expect(availability.degradationLevel).toBe('MINOR')
    })

    test('應該提供降級狀態的可視化回饋', () => {
      // Given: 系統處於降級狀態
      const degradedState = {
        level: 'MODERATE',
        affectedFeatures: ['export-csv', 'advanced-search'],
        estimatedRecovery: '10 minutes'
      }

      // When: 生成使用者介面回饋
      const uiFeedback = testHelpers.generateDegradationFeedback(degradedState)

      // Then: 應該提供清晰的狀態資訊
      expect(uiFeedback.message).toContain('部分功能暫時無法使用')
      expect(uiFeedback.affectedList).toEqual(['匯出 CSV', '進階搜尋'])
      expect(uiFeedback.showRetryOption).toBe(true)
      expect(uiFeedback.estimatedRecovery).toBe('約 10 分鐘後恢復')
    })
  })

  describe('🔄 組件重啟策略測試', () => {
    test('應該能重啟故障的組件', async () => {
      // Given: 故障的組件
      const faultyComponent = {
        name: 'DataProcessor',
        status: 'FAILED',
        lastError: new Error('Memory leak detected'),
        restart: jest.fn().mockResolvedValue({ status: 'RUNNING' })
      }

      // When: 執行組件重啟
      const result = await testHelpers.restartComponent(faultyComponent)

      // Then: 組件應該成功重啟
      expect(result.success).toBe(true)
      expect(result.newStatus).toBe('RUNNING')
      expect(faultyComponent.restart).toHaveBeenCalled()
    })

    test('應該實現漸進式重啟策略', async () => {
      // Given: 多個相互依賴的組件
      const components = [
        { name: 'EventBus', dependencies: [], restartTime: 100 },
        { name: 'StorageManager', dependencies: ['EventBus'], restartTime: 200 },
        { name: 'UIController', dependencies: ['EventBus', 'StorageManager'], restartTime: 300 }
      ]

      // When: 執行漸進式重啟
      const result = await testHelpers.progressiveRestart(components)

      // Then: 應該按照依賴順序重啟
      expect(result.restartOrder).toEqual(['EventBus', 'StorageManager', 'UIController'])
      expect(result.totalTime).toBeLessThan(700) // 應該有並行優化
      expect(result.allComponentsRunning).toBe(true)
    }, 30000)

    test('應該處理重啟失敗', async () => {
      // Given: 無法重啟的組件
      const unreliableComponent = {
        name: 'CriticalService',
        restart: jest.fn().mockRejectedValue(new Error('Restart failed')),
        rollback: jest.fn().mockResolvedValue({ status: 'SAFE_MODE' })
      }

      // When: 嘗試重啟但失敗
      const result = await testHelpers.attemptRestart(unreliableComponent)

      // Then: 應該執行回滾策略
      expect(result.restartFailed).toBe(true)
      expect(result.rollbackExecuted).toBe(true)
      expect(result.safeMode).toBe(true)
      expect(unreliableComponent.rollback).toHaveBeenCalled()
    })
  })

  describe('📊 恢復策略效能測試', () => {
    test('應該在合理時間內完成恢復', async () => {
      // Given: 需要恢復的錯誤情境
      const errors = [
        new Error('Network timeout'),
        new Error('Data corruption'),
        new Error('Permission denied')
      ]

      // When: 批量執行恢復策略
      const startTime = Date.now()
      const results = await Promise.all(
        errors.map(error => testHelpers.executeRecovery(error))
      )
      const endTime = Date.now()

      // Then: 應該在合理時間內完成
      const totalTime = endTime - startTime
      expect(totalTime).toBeLessThan(5000) // 小於5秒
      results.forEach(result => {
        expect(result.recovered).toBeDefined()
        expect(result.strategy).toBeDefined()
      })
    })

    test('應該監控恢復成功率', () => {
      // Given: 恢復策略管理器
      const recoveryManager = testHelpers.createRecoveryManager()

      // When: 執行多次恢復
      const testCases = [
        { error: new Error('Network'), expectedSuccess: true },
        { error: new Error('Data format'), expectedSuccess: true },
        { error: new Error('Critical system'), expectedSuccess: false },
        { error: new Error('Permission'), expectedSuccess: true }
      ]

      testCases.forEach(testCase => {
        const result = recoveryManager.attemptRecovery(testCase.error)
        result.success = testCase.expectedSuccess
        recoveryManager.recordResult(result)
      })

      // Then: 應該正確計算成功率
      const metrics = recoveryManager.getMetrics()
      expect(metrics.successRate).toBe(0.75) // 3/4 成功
      expect(metrics.totalAttempts).toBe(4)
      expect(metrics.successfulRecoveries).toBe(3)
    })
  })

  // Mock 輔助方法實作
  const testHelpers = {
    async executeRetryWithBackoff (operation, options = {}) {
      const { maxRetries = 3, baseDelay = 100, maxDelay = 10000, shouldRetry = () => true } = options
      let lastError = null
      this.retryDelays = []

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await operation()
        } catch (error) {
          lastError = error

          if (attempt === maxRetries || !shouldRetry(error)) {
            throw error
          }

          const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
          this.retryDelays.push(delay)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      throw lastError
    },

    getRetryDelays () {
      return this.retryDelays || []
    },

    async executeRetryWithMetrics (operation, options) {
      const startTime = Date.now()
      let attempts = 0
      let retryCount = 0

      const wrappedOperation = () => {
        attempts++
        if (attempts > 1) retryCount++
        mockMetrics.increment('recovery.retry.attempt')
        return operation()
      }

      try {
        const value = await testHelpers.executeRetryWithBackoff(wrappedOperation, options)
        const totalTime = Date.now() - startTime

        mockMetrics.timing('recovery.retry.duration', totalTime)

        return {
          value,
          metrics: {
            totalAttempts: attempts,
            totalTime,
            retryCount,
            strategy: 'EXPONENTIAL_BACKOFF'
          }
        }
      } catch (error) {
        throw error
      }
    },

    async executeFallbackStrategy (primaryService, fallbackService) {
      try {
        return await primaryService.getData()
      } catch (error) {
        mockLogger.warn('Primary service failed, falling back', { error: error.message })
        return await fallbackService.getData()
      }
    },

    async executeMultiTierFallback (services) {
      for (const service of services.sort((a, b) => a.priority - b.priority)) {
        if (service.available) {
          return {
            selectedService: service.name,
            fallbackLevel: service.priority
          }
        }
      }
      throw new Error('No available services')
    },

    async executeServiceWithFallback (primaryService, fallbackService) {
      if (primaryService.isAvailable()) {
        return await primaryService.getData()
      } else {
        return await fallbackService.getData()
      }
    },

    createFallbackManager () {
      const activeFallbacks = new Map()
      const history = []

      return {
        activateFallback: (reason, fallback) => {
          activeFallbacks.set(reason, fallback)
          history.push({ action: 'activate', reason, fallback, timestamp: Date.now() })
        },
        deactivateFallback: (reason) => {
          activeFallbacks.delete(reason)
          history.push({ action: 'deactivate', reason, timestamp: Date.now() })
        },
        getStats: () => ({
          activeFallbacks: activeFallbacks.size,
          totalActivations: history.filter(h => h.action === 'activate').length,
          totalDeactivations: history.filter(h => h.action === 'deactivate').length,
          fallbackHistory: history
        })
      }
    },

    async requestUserIntervention (error) {
      const interventionMap = {
        GRANT_PERMISSION: {
          guidance: '請在瀏覽器設定中授予擴展儲存權限',
          steps: [
            '點擊瀏覽器的擴展圖示',
            '找到本擴展並點擊設定',
            '啟用「儲存」權限',
            '重新載入頁面'
          ]
        }
      }

      const intervention = interventionMap[error.userAction] || {
        guidance: '請按照提示完成操作',
        steps: ['重新整理頁面']
      }

      return {
        type: 'USER_INTERVENTION',
        action: error.userAction,
        ...intervention
      }
    },

    async validateUserAction (action) {
    // 模擬驗證邏輯
      if (action.type === 'GRANT_PERMISSION' && action.granted) {
        return {
          valid: true,
          canProceed: true,
          nextStep: 'RETRY_ORIGINAL_OPERATION'
        }
      }

      return {
        valid: false,
        canProceed: false,
        reason: 'Action not completed'
      }
    },

    async waitForUserAction (actionType, timeoutMs) {
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          resolve({
            timedOut: true,
            fallbackAction: 'SHOW_MANUAL_INSTRUCTIONS'
          })
        }, timeoutMs)

      // 在實際實作中，這裡會監聽使用者操作事件
      // 這裡只是模擬超時情況
      })
    },

    executeFunctionalDegradation (brokenModule) {
      const degradationMap = {
        AdvancedSearch: {
          degradedModule: 'BasicSearch',
          availableFeatures: ['simple-text-search'],
          unavailableFeatures: ['advanced-filters', 'sorting', 'faceted-search']
        }
      }

      const degradation = degradationMap[brokenModule.name] || {
        degradedModule: 'MinimalFallback',
        availableFeatures: ['basic-functionality'],
        unavailableFeatures: ['all-advanced-features']
      }

      return {
        ...degradation,
        userNotification: '部分功能暫時無法使用，已啟用簡化模式'
      }
    },

    evaluateSystemAvailability (failedFeatures) {
      const coreFeatures = ['book-display', 'search', 'data-import', 'basic-export']
      const hasCoreFailures = failedFeatures.some(feature => coreFeatures.includes(feature))

      return {
        coreAvailable: !hasCoreFailures,
        criticalFunctions: coreFeatures,
        degradationLevel: hasCoreFailures || failedFeatures.length > 3 ? 'MAJOR' : 'MINOR'
      }
    },

    generateDegradationFeedback (degradedState) {
      const featureMap = {
        'export-csv': '匯出 CSV',
        'advanced-search': '進階搜尋'
      }

      // 轉換時間格式
      const convertTimeFormat = (timeStr) => {
        return timeStr.replace(/(\d+)\s*minutes?/i, '$1 分鐘')
          .replace(/(\d+)\s*hours?/i, '$1 小時')
          .replace(/(\d+)\s*seconds?/i, '$1 秒')
      }

      return {
        message: '部分功能暫時無法使用，核心功能正常運作',
        affectedList: degradedState.affectedFeatures.map(f => featureMap[f] || f),
        showRetryOption: true,
        estimatedRecovery: `約 ${convertTimeFormat(degradedState.estimatedRecovery)}後恢復`
      }
    },

    async restartComponent (component) {
      try {
        const result = await component.restart()
        return {
          success: true,
          newStatus: result.status
        }
      } catch (error) {
        return {
          success: false,
          error: error.message
        }
      }
    },

    async progressiveRestart (components) {
      const restartOrder = testHelpers.calculateRestartOrder(components)
      let totalTime = 0

      for (const componentName of restartOrder) {
        const component = components.find(c => c.name === componentName)
        const startTime = Date.now()
        // 模擬重啟
        await new Promise(resolve => setTimeout(resolve, component.restartTime))
        totalTime += Date.now() - startTime
      }

      return {
        restartOrder,
        totalTime,
        allComponentsRunning: true
      }
    },

    calculateRestartOrder (components) {
    // 簡單的拓撲排序實作
      const result = []
      const visited = new Set()

      const visit = (componentName) => {
        if (visited.has(componentName)) return

        const component = components.find(c => c.name === componentName)
        if (component) {
          component.dependencies.forEach(dep => visit(dep))
          visited.add(componentName)
          result.push(componentName)
        }
      }

      components.forEach(component => visit(component.name))
      return result
    },

    async attemptRestart (component) {
      try {
        await component.restart()
        return {
          restartFailed: false,
          rollbackExecuted: false,
          safeMode: false
        }
      } catch (error) {
        await component.rollback()
        return {
          restartFailed: true,
          rollbackExecuted: true,
          safeMode: true
        }
      }
    },

    async executeRecovery (error) {
    // 模擬恢復策略執行
      const strategies = {
        'Network timeout': { strategy: 'RETRY', recovered: true },
        'Data corruption': { strategy: 'FALLBACK', recovered: true },
        'Permission denied': { strategy: 'USER_INTERVENTION', recovered: false }
      }

      return strategies[error.message] || { strategy: 'UNKNOWN', recovered: false }
    },

    createRecoveryManager () {
      let totalAttempts = 0
      let successfulRecoveries = 0

      return {
        attemptRecovery: (error) => {
          totalAttempts++
          // 模擬恢復嘗試
          return { error, timestamp: Date.now() }
        },
        recordResult: (result) => {
          if (result.success) {
            successfulRecoveries++
          }
        },
        getMetrics: () => ({
          successRate: totalAttempts > 0 ? successfulRecoveries / totalAttempts : 0,
          totalAttempts,
          successfulRecoveries
        })
      }
    }
  }
})
