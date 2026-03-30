/**
 * RetryCoordinator 測試
 *
 * 測試目標：
 * - 驗證智能重試機制和策略選擇
 * - 測試退避演算法和時間計算
 * - 確保錯誤分析和可重試性判斷
 * - 驗證重試限制和失敗處理
 *
 * @jest-environment jsdom
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')
// eslint-disable-next-line no-unused-vars
const { StandardError } = require('src/core/errors/StandardError')
// eslint-disable-next-line no-unused-vars
const RetryCoordinator = require('src/background/domains/data-management/services/RetryCoordinator.js')
const { CircuitState, STORAGE_KEY } = require('src/background/domains/data-management/services/RetryCoordinator.js')

describe('RetryCoordinator TDD 測試', () => {
  // eslint-disable-next-line no-unused-vars
  let coordinator

  beforeEach(() => {
    coordinator = new RetryCoordinator({
      maxRetryAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      jitterFactor: 0.1
    })
  })

  describe('🔴 Red 階段：基礎功能驗證', () => {
    test('應該正確初始化重試協調器', () => {
      // Given: 預設配置
      // eslint-disable-next-line no-unused-vars
      const defaultCoordinator = new RetryCoordinator()

      // Then: 應該正確設置預設值
      expect(defaultCoordinator.config.maxRetryAttempts).toBe(3)
      expect(defaultCoordinator.config.baseDelay).toBe(1000)
      expect(defaultCoordinator.config.maxDelay).toBe(30000)
      expect(defaultCoordinator.isInitialized).toBe(true)
    })

    test('應該支援自訂配置', () => {
      // Given: 自訂配置
      // eslint-disable-next-line no-unused-vars
      const customCoordinator = new RetryCoordinator({
        maxRetryAttempts: 5,
        baseDelay: 2000,
        maxDelay: 60000,
        jitterFactor: 0.2
      })

      // Then: 應該使用自訂配置
      expect(customCoordinator.config.maxRetryAttempts).toBe(5)
      expect(customCoordinator.config.baseDelay).toBe(2000)
      expect(customCoordinator.config.maxDelay).toBe(60000)
      expect(customCoordinator.config.jitterFactor).toBe(0.2)
    })

    test('canRetry() 應該正確判斷是否可重試', () => {
      // Given: 不同重試次數的作業
      // eslint-disable-next-line no-unused-vars
      const job1 = { retryCount: 0, error: 'network timeout' }
      // eslint-disable-next-line no-unused-vars
      const job2 = { retryCount: 2, error: 'connection failed' }
      // eslint-disable-next-line no-unused-vars
      const job3 = { retryCount: 3, error: 'server error' }
      // eslint-disable-next-line no-unused-vars
      const job4 = { retryCount: 1, error: 'permission denied' }

      // When & Then: 檢查重試可行性
      expect(coordinator.canRetry(job1)).toBe(true)
      expect(coordinator.canRetry(job2)).toBe(true)
      expect(coordinator.canRetry(job3)).toBe(false) // 超過最大重試次數
      expect(coordinator.canRetry(job4)).toBe(false) // 權限錯誤不可重試
    })

    test('analyzeFailureReason() 應該正確分析失敗原因', () => {
      // Given: 不同類型的失敗作業
      // eslint-disable-next-line no-unused-vars
      const networkError = { error: 'network timeout occurred' }
      // eslint-disable-next-line no-unused-vars
      const conflictError = { error: 'data conflict detected' }
      // eslint-disable-next-line no-unused-vars
      const authError = { error: 'permission denied' }
      // eslint-disable-next-line no-unused-vars
      const unknownError = { error: 'something went wrong' }

      // When: 分析失敗原因
      // eslint-disable-next-line no-unused-vars
      const networkAnalysis = coordinator.analyzeFailureReason(networkError)
      // eslint-disable-next-line no-unused-vars
      const conflictAnalysis = coordinator.analyzeFailureReason(conflictError)
      // eslint-disable-next-line no-unused-vars
      const authAnalysis = coordinator.analyzeFailureReason(authError)
      // eslint-disable-next-line no-unused-vars
      const unknownAnalysis = coordinator.analyzeFailureReason(unknownError)

      // Then: 應該正確分類錯誤
      expect(networkAnalysis.category).toBe('NETWORK')
      expect(networkAnalysis.retryable).toBe(true)
      expect(conflictAnalysis.category).toBe('DATA_CONFLICT')
      expect(conflictAnalysis.retryable).toBe(true)
      expect(authAnalysis.category).toBe('AUTHORIZATION')
      expect(authAnalysis.retryable).toBe(false)
      expect(unknownAnalysis.category).toBe('UNKNOWN')
      expect(unknownAnalysis.retryable).toBe(true)
    })

    test('selectRetryStrategy() 應該根據錯誤分析選擇策略', () => {
      // Given: 不同類型的錯誤分析結果
      // eslint-disable-next-line no-unused-vars
      const networkAnalysis = { category: 'NETWORK', retryable: true }
      // eslint-disable-next-line no-unused-vars
      const conflictAnalysis = { category: 'DATA_CONFLICT', retryable: true }
      // eslint-disable-next-line no-unused-vars
      const unknownAnalysis = { category: 'UNKNOWN', retryable: true }
      // eslint-disable-next-line no-unused-vars
      const nonRetryableAnalysis = { category: 'AUTHORIZATION', retryable: false }

      // When & Then: 選擇重試策略
      expect(coordinator.selectRetryStrategy(networkAnalysis)).toBe('EXPONENTIAL_BACKOFF')
      expect(coordinator.selectRetryStrategy(conflictAnalysis)).toBe('CONFLICT_RESOLUTION_FIRST')
      expect(coordinator.selectRetryStrategy(unknownAnalysis)).toBe('LINEAR_BACKOFF')

      // 不可重試的錯誤應該拋出異常
      expect(() => coordinator.selectRetryStrategy(nonRetryableAnalysis)).toThrowError(
        expect.objectContaining({
          code: expect.any(String),
          details: expect.any(Object)
        })
      )
    })

    test('calculateBackoffDelay() 應該正確計算退避延遲', () => {
      // Given & When: 不同重試次數的延遲計算
      // eslint-disable-next-line no-unused-vars
      const delay0 = coordinator.calculateBackoffDelay(0)
      // eslint-disable-next-line no-unused-vars
      const delay1 = coordinator.calculateBackoffDelay(1)
      // eslint-disable-next-line no-unused-vars
      const delay2 = coordinator.calculateBackoffDelay(2)
      // eslint-disable-next-line no-unused-vars
      const delay10 = coordinator.calculateBackoffDelay(10) // 超過最大值

      // Then: 應該符合指數退避規則
      expect(delay0).toBeGreaterThanOrEqual(1000 * 0.9) // 考慮 jitter
      expect(delay0).toBeLessThanOrEqual(1000 * 1.1)
      expect(delay1).toBeGreaterThanOrEqual(2000 * 0.9)
      expect(delay1).toBeLessThanOrEqual(2000 * 1.1)
      expect(delay2).toBeGreaterThanOrEqual(4000 * 0.9)
      expect(delay2).toBeLessThanOrEqual(4000 * 1.1)
      expect(delay10).toBeLessThanOrEqual(35000) // 不應超過最大延遲
    })

    test('executeRetry() 應該執行成功的重試', async () => {
      // Given: 可重試的失敗作業和成功的執行函數
      // eslint-disable-next-line no-unused-vars
      const failedJob = {
        id: 'sync_123',
        retryCount: 1,
        error: 'network timeout',
        originalParams: { source: 'readmoo', target: 'local' }
      }

      // eslint-disable-next-line no-unused-vars
      const mockExecutor = jest.fn().mockResolvedValue({
        success: true,
        data: { synced: 10 }
      })

      // When: 執行重試
      // eslint-disable-next-line no-unused-vars
      const result = await coordinator.executeRetry(failedJob, mockExecutor)

      // Then: 應該返回成功結果
      expect(result.success).toBe(true)
      expect(result.retryStrategy).toBe('EXPONENTIAL_BACKOFF')
      expect(result.retryCount).toBe(2)
      expect(result.delayApplied).toBeGreaterThan(0)
      expect(mockExecutor).toHaveBeenCalledWith(expect.objectContaining({
        source: 'readmoo',
        target: 'local',
        retryCount: 2,
        retryStrategy: 'EXPONENTIAL_BACKOFF'
      }))
    })

    test('executeRetry() 應該處理重試失敗', async () => {
      // Given: 重試仍然失敗的情況
      // eslint-disable-next-line no-unused-vars
      const failedJob = {
        id: 'sync_456',
        retryCount: 0,
        error: 'server error',
        originalParams: { source: 'readmoo' }
      }

      // eslint-disable-next-line no-unused-vars
      const mockExecutor = jest.fn().mockRejectedValue((() => { const error = new Error('still failing'); error.code = ErrorCodes.STILL_FAILING; error.details = { category: 'testing' }; return error })())

      // When: 執行重試
      // eslint-disable-next-line no-unused-vars
      const result = await coordinator.executeRetry(failedJob, mockExecutor)

      // Then: 應該返回失敗結果
      expect(result.success).toBe(false)
      expect(result.error).toContain('still failing')
      expect(result.retryCount).toBe(1)
    })
  })

  describe('⚙️ 進階策略和配置測試', () => {
    test('shouldApplyJitter() 應該根據策略決定是否使用抖動', () => {
      // Given & When: 不同策略的抖動判斷
      // eslint-disable-next-line no-unused-vars
      const exponentialJitter = coordinator.shouldApplyJitter('EXPONENTIAL_BACKOFF')
      // eslint-disable-next-line no-unused-vars
      const linearJitter = coordinator.shouldApplyJitter('LINEAR_BACKOFF')
      // eslint-disable-next-line no-unused-vars
      const conflictJitter = coordinator.shouldApplyJitter('CONFLICT_RESOLUTION_FIRST')

      // Then: 應該正確判斷是否使用抖動
      expect(exponentialJitter).toBe(true)
      expect(linearJitter).toBe(true)
      expect(conflictJitter).toBe(false) // 衝突解決優先不使用抖動
    })

    test('getRetryStatistics() 應該回傳統計資訊', () => {
      // Given: 執行一些重試操作後
      coordinator.stats.totalRetries = 5
      coordinator.stats.successfulRetries = 3
      coordinator.stats.failedRetries = 2

      // When: 獲取統計
      // eslint-disable-next-line no-unused-vars
      const stats = coordinator.getRetryStatistics()

      // Then: 應該包含統計資訊
      expect(stats.totalRetries).toBe(5)
      expect(stats.successfulRetries).toBe(3)
      expect(stats.failedRetries).toBe(2)
      expect(stats.successRate).toBe(0.6)
      expect(stats.config).toBeDefined()
    })

    test('resetStatistics() 應該重置統計計數器', () => {
      // Given: 設置一些統計值
      coordinator.stats.totalRetries = 10
      coordinator.stats.successfulRetries = 6

      // When: 重置統計
      coordinator.resetStatistics()

      // Then: 統計應該被重置
      expect(coordinator.stats.totalRetries).toBe(0)
      expect(coordinator.stats.successfulRetries).toBe(0)
      expect(coordinator.stats.failedRetries).toBe(0)
    })

    test('updateConfig() 應該正確更新配置', () => {
      // Given: 初始配置
      // eslint-disable-next-line no-unused-vars
      const _originalDelay = coordinator.config.baseDelay

      // When: 更新配置
      coordinator.updateConfig({
        baseDelay: 3000,
        newOption: 'test_value'
      })

      // Then: 配置應該被更新
      expect(coordinator.config.baseDelay).toBe(3000)
      expect(coordinator.config.newOption).toBe('test_value')
      expect(coordinator.config.maxRetryAttempts).toBe(3) // 保持舊配置
    })
  })

  describe('🔍 邊界條件和錯誤處理測試', () => {
    test('canRetry() 應該處理無效輸入', () => {
      // Given: 無效的作業物件
      // eslint-disable-next-line no-unused-vars
      const nullJob = null
      // eslint-disable-next-line no-unused-vars
      const undefinedJob = undefined
      // eslint-disable-next-line no-unused-vars
      const emptyJob = {}

      // When & Then: 應該安全處理無效輸入
      expect(coordinator.canRetry(nullJob)).toBe(false)
      expect(coordinator.canRetry(undefinedJob)).toBe(false)
      expect(coordinator.canRetry(emptyJob)).toBe(true) // 新作業，重試次數為 0
    })

    test('calculateBackoffDelay() 應該處理負數重試次數', () => {
      // Given & When: 負數重試次數
      // eslint-disable-next-line no-unused-vars
      const negativeDelay = coordinator.calculateBackoffDelay(-1)

      // Then: 應該返回基礎延遲
      expect(negativeDelay).toBeGreaterThanOrEqual(1000 * 0.9)
      expect(negativeDelay).toBeLessThanOrEqual(1000 * 1.1)
    })

    test('executeRetry() 應該處理超過最大重試次數的作業', async () => {
      // Given: 已超過最大重試次數的作業
      // eslint-disable-next-line no-unused-vars
      const exhaustedJob = {
        id: 'sync_789',
        retryCount: 5, // 超過預設最大值 3
        error: 'persistent error',
        originalParams: {}
      }

      // eslint-disable-next-line no-unused-vars
      const mockExecutor = jest.fn()

      // When: 嘗試執行重試
      // eslint-disable-next-line no-unused-vars
      const result = await coordinator.executeRetry(exhaustedJob, mockExecutor)

      // Then: 應該拒絕重試
      expect(result.success).toBe(false)
      expect(result.error).toContain('超過最大重試次數')
      expect(mockExecutor).not.toHaveBeenCalled()
    })

    test('analyzeFailureReason() 應該處理空錯誤訊息', () => {
      // Given: 空錯誤訊息的作業
      // eslint-disable-next-line no-unused-vars
      const emptyErrorJob = { error: '' }
      // eslint-disable-next-line no-unused-vars
      const nullErrorJob = { error: null }
      // eslint-disable-next-line no-unused-vars
      const missingErrorJob = {}

      // When: 分析失敗原因
      // eslint-disable-next-line no-unused-vars
      const emptyAnalysis = coordinator.analyzeFailureReason(emptyErrorJob)
      // eslint-disable-next-line no-unused-vars
      const nullAnalysis = coordinator.analyzeFailureReason(nullErrorJob)
      // eslint-disable-next-line no-unused-vars
      const missingAnalysis = coordinator.analyzeFailureReason(missingErrorJob)

      // Then: 應該回傳預設分析結果
      expect(emptyAnalysis.category).toBe('UNKNOWN')
      expect(nullAnalysis.category).toBe('UNKNOWN')
      expect(missingAnalysis.category).toBe('UNKNOWN')
    })

    test('應該處理執行器拋出非 Error 物件', async () => {
      // Given: 執行器拋出字串而非 Error 物件
      // eslint-disable-next-line no-unused-vars
      const failedJob = {
        id: 'sync_string_error',
        retryCount: 0,
        error: 'initial error',
        originalParams: {}
      }

      // eslint-disable-next-line no-unused-vars
      const mockExecutor = jest.fn().mockRejectedValue('string error')

      // When: 執行重試
      // eslint-disable-next-line no-unused-vars
      const result = await coordinator.executeRetry(failedJob, mockExecutor)

      // Then: 應該正確處理字串錯誤
      expect(result.success).toBe(false)
      expect(result.error).toContain('string error')
    })
  })

  describe('📊 策略特定行為測試', () => {
    test('EXPONENTIAL_BACKOFF 策略應該使用指數退避', () => {
      // Given: 指數退避策略的延遲計算

      // When: 計算不同重試次數的延遲
      // eslint-disable-next-line no-unused-vars
      const delays = [0, 1, 2, 3].map(count =>
        coordinator.calculateBackoffDelay(count)
      )

      // Then: 延遲應該呈指數增長（考慮抖動）
      expect(delays[1]).toBeGreaterThan(delays[0] * 1.5)
      expect(delays[2]).toBeGreaterThan(delays[1] * 1.5)
      expect(delays[3]).toBeGreaterThan(delays[2] * 1.5)
    })

    test('LINEAR_BACKOFF 策略應該使用線性退避', () => {
      // Given: 線性退避策略的協調器
      // eslint-disable-next-line no-unused-vars
      const linearCoordinator = new RetryCoordinator({
        defaultStrategy: 'LINEAR_BACKOFF'
      })

      // When: 模擬線性退避行為（在實際實作中會有不同的計算）
      // eslint-disable-next-line no-unused-vars
      const analysis = { category: 'UNKNOWN', retryable: true }
      // eslint-disable-next-line no-unused-vars
      const strategy = linearCoordinator.selectRetryStrategy(analysis)

      // Then: 應該選擇線性退避策略
      expect(strategy).toBe('LINEAR_BACKOFF')
    })

    test('CONFLICT_RESOLUTION_FIRST 策略應該優先解決衝突', async () => {
      // Given: 資料衝突的作業
      // eslint-disable-next-line no-unused-vars
      const conflictJob = {
        id: 'sync_conflict',
        retryCount: 0,
        error: 'data conflict detected',
        originalParams: { conflictData: [] }
      }

      // eslint-disable-next-line no-unused-vars
      const mockExecutor = jest.fn().mockResolvedValue({
        success: true,
        conflictsResolved: true
      })

      // When: 執行衝突解決重試
      // eslint-disable-next-line no-unused-vars
      const result = await coordinator.executeRetry(conflictJob, mockExecutor)

      // Then: 應該使用衝突解決策略
      expect(result.retryStrategy).toBe('CONFLICT_RESOLUTION_FIRST')
      expect(result.success).toBe(true)
    })
  })

  describe('斷路器（Circuit Breaker）測試', () => {
    test('初始狀態應為 CLOSED', () => {
      // Given: 預設建立的 coordinator
      // Then: 斷路器應為 CLOSED
      const state = coordinator.getCircuitState()
      expect(state.state).toBe(CircuitState.CLOSED)
      expect(state.failureCount).toBe(0)
      expect(state.lastFailureTime).toBeNull()
    })

    test('連續失敗超過閾值應觸發 OPEN 狀態', () => {
      // Given: 設定閾值為 3 的 coordinator
      const cbCoordinator = new RetryCoordinator({
        circuitBreakerThreshold: 3
      })

      // When: 連續記錄 3 次失敗
      cbCoordinator.recordFailure()
      cbCoordinator.recordFailure()
      expect(cbCoordinator.getCircuitState().state).toBe(CircuitState.CLOSED)

      cbCoordinator.recordFailure()

      // Then: 應進入 OPEN 狀態
      expect(cbCoordinator.getCircuitState().state).toBe(CircuitState.OPEN)
      expect(cbCoordinator.getCircuitState().failureCount).toBe(3)
    })

    test('OPEN 狀態下 executeRetry 應直接拒絕', async () => {
      // Given: 斷路器已 OPEN
      coordinator.circuitBreaker.state = CircuitState.OPEN
      coordinator.circuitBreaker.lastFailureTime = Date.now()

      const failedJob = {
        id: 'sync_cb_1',
        retryCount: 0,
        error: 'network timeout',
        originalParams: {}
      }
      const mockExecutor = jest.fn()

      // When: 嘗試執行重試
      const result = await coordinator.executeRetry(failedJob, mockExecutor)

      // Then: 應被拒絕，executor 不被呼叫
      expect(result.success).toBe(false)
      expect(result.error).toContain('斷路器已開啟')
      expect(result.circuitState).toBe(CircuitState.OPEN)
      expect(mockExecutor).not.toHaveBeenCalled()
    })

    test('recordSuccess 應重置斷路器為 CLOSED', () => {
      // Given: 斷路器處於 HALF_OPEN 且有失敗記錄
      coordinator.circuitBreaker.state = CircuitState.HALF_OPEN
      coordinator.circuitBreaker.failureCount = 5

      // When: 記錄成功
      coordinator.recordSuccess()

      // Then: 應恢復 CLOSED 且計數歸零
      expect(coordinator.getCircuitState().state).toBe(CircuitState.CLOSED)
      expect(coordinator.getCircuitState().failureCount).toBe(0)
    })

    test('OPEN 狀態冷卻期過後應轉為 HALF_OPEN', () => {
      // Given: 斷路器 OPEN，lastFailureTime 為很久以前
      coordinator.circuitBreaker.state = CircuitState.OPEN
      coordinator.circuitBreaker.lastFailureTime = Date.now() - 120000
      coordinator.circuitBreaker.cooldownPeriod = 60000

      // When: 檢查是否開啟
      const isOpen = coordinator.isCircuitOpen()

      // Then: 冷卻期已過，應允許試探（回傳 false）且狀態轉為 HALF_OPEN
      expect(isOpen).toBe(false)
      expect(coordinator.getCircuitState().state).toBe(CircuitState.HALF_OPEN)
    })

    test('HALF_OPEN 狀態下失敗應重新觸發 OPEN', () => {
      // Given: HALF_OPEN 且閾值為 1（已有 failureCount 接近閾值）
      const cbCoordinator = new RetryCoordinator({
        circuitBreakerThreshold: 1
      })
      cbCoordinator.circuitBreaker.state = CircuitState.HALF_OPEN

      // When: 記錄失敗
      cbCoordinator.recordFailure()

      // Then: 應回到 OPEN
      expect(cbCoordinator.getCircuitState().state).toBe(CircuitState.OPEN)
    })

    test('支援自訂斷路器配置', () => {
      // Given: 自訂 cooldown 和 threshold
      const customCoordinator = new RetryCoordinator({
        circuitBreakerCooldown: 120000,
        circuitBreakerThreshold: 10
      })

      // Then: 應使用自訂值
      const state = customCoordinator.getCircuitState()
      expect(state.cooldownPeriod).toBe(120000)
      expect(state.failureThreshold).toBe(10)
    })
  })

  describe('持久化（chrome.storage.local）測試', () => {
    let storageData

    beforeEach(() => {
      storageData = {}
      // Mock chrome.storage.local
      global.chrome = {
        storage: {
          local: {
            get: jest.fn((key) => {
              return Promise.resolve({ [key]: storageData[key] || undefined })
            }),
            set: jest.fn((data) => {
              Object.assign(storageData, data)
              return Promise.resolve()
            })
          }
        }
      }
    })

    afterEach(() => {
      delete global.chrome
    })

    test('saveState 應將狀態存到 chrome.storage.local', async () => {
      // Given: coordinator 有一些狀態
      coordinator.stats.totalRetries = 10
      coordinator.stats.successfulRetries = 7
      coordinator.stats.failedRetries = 3
      coordinator.circuitBreaker.state = CircuitState.OPEN
      coordinator.circuitBreaker.failureCount = 5
      coordinator.pendingRetries = [{ id: 'job1' }]

      // When: 儲存狀態
      await coordinator.saveState()

      // Then: chrome.storage.local.set 被呼叫且包含正確結構
      expect(global.chrome.storage.local.set).toHaveBeenCalledTimes(1)
      const savedData = storageData[STORAGE_KEY]
      expect(savedData).toBeDefined()
      expect(savedData.circuitBreaker.state).toBe(CircuitState.OPEN)
      expect(savedData.circuitBreaker.failureCount).toBe(5)
      expect(savedData.stats.totalRetries).toBe(10)
      expect(savedData.pendingRetries).toHaveLength(1)
      expect(savedData.savedAt).toBeGreaterThan(0)
    })

    test('loadState 應從 chrome.storage.local 恢復狀態', async () => {
      // Given: storage 中有存儲的狀態
      storageData[STORAGE_KEY] = {
        circuitBreaker: {
          state: CircuitState.OPEN,
          failureCount: 4,
          lastFailureTime: 1700000000000
        },
        pendingRetries: [{ id: 'job_restore' }],
        stats: {
          totalRetries: 20,
          successfulRetries: 15,
          failedRetries: 5
        },
        savedAt: 1700000000000
      }

      // When: 載入狀態
      const result = await coordinator.loadState()

      // Then: coordinator 的狀態應被恢復
      expect(result).not.toBeNull()
      expect(coordinator.circuitBreaker.state).toBe(CircuitState.OPEN)
      expect(coordinator.circuitBreaker.failureCount).toBe(4)
      expect(coordinator.pendingRetries).toHaveLength(1)
      expect(coordinator.pendingRetries[0].id).toBe('job_restore')
      expect(coordinator.stats.totalRetries).toBe(20)
      expect(coordinator.stats.successfulRetries).toBe(15)
    })

    test('loadState 在無存儲資料時應回傳 null', async () => {
      // Given: storage 中無資料（storageData 為空）

      // When: 載入狀態
      const result = await coordinator.loadState()

      // Then: 應回傳 null 且不影響現有狀態
      expect(result).toBeNull()
      expect(coordinator.circuitBreaker.state).toBe(CircuitState.CLOSED)
    })

    test('saveState 在 chrome.storage 不可用時不應拋出', async () => {
      // Given: chrome.storage.local.set 拋出錯誤
      global.chrome.storage.local.set = jest.fn().mockRejectedValue(new Error('storage error'))

      // When & Then: saveState 不應拋出
      await expect(coordinator.saveState()).resolves.not.toThrow()
    })

    test('loadState 在 chrome.storage 不可用時應回傳 null', async () => {
      // Given: chrome.storage.local.get 拋出錯誤
      global.chrome.storage.local.get = jest.fn().mockRejectedValue(new Error('storage error'))

      // When: 載入狀態
      const result = await coordinator.loadState()

      // Then: 應回傳 null
      expect(result).toBeNull()
    })
  })

  describe('UC-07 網路不穩定同步策略補強測試', () => {
    describe('指數退避延遲遞增驗證', () => {
      test('retryCount=0/1/2/3 時延遲應依 baseDelay * 2^retryCount 遞增', () => {
        // Given: jitterFactor=0 的協調器，排除隨機抖動干擾
        const noJitterCoordinator = new RetryCoordinator({
          baseDelay: 1000,
          maxDelay: 30000,
          jitterFactor: 0
        })

        // When: 計算不同 retryCount 的延遲
        const delay0 = noJitterCoordinator.calculateBackoffDelay(0) // 1000 * 2^0 = 1000
        const delay1 = noJitterCoordinator.calculateBackoffDelay(1) // 1000 * 2^1 = 2000
        const delay2 = noJitterCoordinator.calculateBackoffDelay(2) // 1000 * 2^2 = 4000
        const delay3 = noJitterCoordinator.calculateBackoffDelay(3) // 1000 * 2^3 = 8000

        // Then: 精確驗證指數遞增（無 jitter 時應完全等於理論值）
        expect(delay0).toBe(1000)
        expect(delay1).toBe(2000)
        expect(delay2).toBe(4000)
        expect(delay3).toBe(8000)
      })

      test('延遲不應超過 maxDelay 上限', () => {
        // Given: maxDelay=10000 且 jitterFactor=0 的協調器
        const cappedCoordinator = new RetryCoordinator({
          baseDelay: 1000,
          maxDelay: 10000,
          jitterFactor: 0
        })

        // When: retryCount 足夠大使理論延遲超過 maxDelay
        const delay5 = cappedCoordinator.calculateBackoffDelay(5) // 1000 * 2^5 = 32000 → capped to 10000
        const delay10 = cappedCoordinator.calculateBackoffDelay(10) // 1000 * 2^10 = 1024000 → capped to 10000

        // Then: 延遲應被限制在 maxDelay
        expect(delay5).toBe(10000)
        expect(delay10).toBe(10000)
      })

      test('maxDelay 剛好等於理論延遲時不應被截斷', () => {
        // Given: maxDelay=4000，retryCount=2 的理論值剛好為 4000
        const exactCoordinator = new RetryCoordinator({
          baseDelay: 1000,
          maxDelay: 4000,
          jitterFactor: 0
        })

        // When & Then
        expect(exactCoordinator.calculateBackoffDelay(2)).toBe(4000)
        // retryCount=3 理論值 8000 → capped to 4000
        expect(exactCoordinator.calculateBackoffDelay(3)).toBe(4000)
      })
    })

    describe('jitter 隨機抖動驗證', () => {
      test('有 jitter 時延遲不應完全等於理論值', () => {
        // Given: jitterFactor=0.1 的協調器
        const jitterCoordinator = new RetryCoordinator({
          baseDelay: 1000,
          maxDelay: 30000,
          jitterFactor: 0.1
        })

        // When: 多次計算同一 retryCount 的延遲
        const delays = []
        for (let i = 0; i < 20; i++) {
          delays.push(jitterCoordinator.calculateBackoffDelay(2))
        }

        // Then: 所有延遲應在 jitter 範圍內（4000 +/- 10%）
        const theoreticalDelay = 4000
        const tolerance = theoreticalDelay * 0.1
        for (const delay of delays) {
          expect(delay).toBeGreaterThanOrEqual(theoreticalDelay - tolerance)
          expect(delay).toBeLessThanOrEqual(theoreticalDelay + tolerance)
        }

        // 至少應有一些不同的值（統計上 20 次幾乎不可能全部相同）
        const uniqueDelays = new Set(delays)
        expect(uniqueDelays.size).toBeGreaterThan(1)
      })
    })

    describe('網路中斷恢復後自動重試', () => {
      test('前 2 次 NETWORK 錯誤後第 3 次成功應最終回傳成功', async () => {
        // Given: 快速退避的協調器（避免測試等待）
        const fastCoordinator = new RetryCoordinator({
          baseDelay: 10,
          maxDelay: 100,
          jitterFactor: 0,
          maxRetryAttempts: 5
        })

        // 模擬前 2 次失敗、第 3 次成功的執行器
        let callCount = 0
        const mockExecutor = jest.fn().mockImplementation(() => {
          callCount++
          if (callCount <= 2) {
            return Promise.reject(new Error('network timeout'))
          }
          return Promise.resolve({ success: true, synced: 10 })
        })

        // When: 模擬多輪重試（手動驅動重試迴圈）
        let currentJob = {
          id: 'sync_recovery',
          retryCount: 0,
          error: 'network timeout',
          originalParams: { source: 'readmoo' }
        }

        let result
        // 第一次重試：仍然失敗
        result = await fastCoordinator.executeRetry(currentJob, mockExecutor)
        expect(result.success).toBe(false)
        expect(result.retryCount).toBe(1)

        // 更新 job 狀態，準備第二次重試
        currentJob = {
          ...currentJob,
          retryCount: result.retryCount,
          error: result.error
        }

        // 第二次重試：仍然失敗
        result = await fastCoordinator.executeRetry(currentJob, mockExecutor)
        expect(result.success).toBe(false)
        expect(result.retryCount).toBe(2)

        // 更新 job 狀態，準備第三次重試
        currentJob = {
          ...currentJob,
          retryCount: result.retryCount,
          error: result.error
        }

        // 第三次重試：成功
        result = await fastCoordinator.executeRetry(currentJob, mockExecutor)
        expect(result.success).toBe(true)
        expect(result.retryCount).toBe(3)
        expect(result.retryStrategy).toBe('EXPONENTIAL_BACKOFF')

        // Then: 執行器共被呼叫 3 次
        expect(mockExecutor).toHaveBeenCalledTimes(3)
        // 成功重試應更新統計
        expect(fastCoordinator.stats.successfulRetries).toBe(1)
        expect(fastCoordinator.stats.failedRetries).toBe(2)
      })

      test('每次重試的延遲應遞增（驗證退避機制在重試流程中生效）', async () => {
        // Given: 記錄延遲的協調器
        const fastCoordinator = new RetryCoordinator({
          baseDelay: 10,
          maxDelay: 1000,
          jitterFactor: 0,
          maxRetryAttempts: 5
        })

        const appliedDelays = []
        const mockExecutor = jest.fn().mockRejectedValue(new Error('network error'))

        // When: 連續 3 次重試
        let currentJob = {
          id: 'sync_delays',
          retryCount: 0,
          error: 'network error',
          originalParams: {}
        }

        for (let i = 0; i < 3; i++) {
          const result = await fastCoordinator.executeRetry(currentJob, mockExecutor)
          appliedDelays.push(result.delayApplied)
          currentJob = {
            ...currentJob,
            retryCount: result.retryCount,
            error: result.error
          }
        }

        // Then: 延遲應遞增（10, 20, 40）
        expect(appliedDelays[0]).toBe(10)
        expect(appliedDelays[1]).toBe(20)
        expect(appliedDelays[2]).toBe(40)
      })
    })

    describe('連續失敗超過 maxRetryAttempts', () => {
      test('超過最大重試次數後 canRetry 回傳 false', () => {
        // Given: maxRetryAttempts=3 的協調器
        const limitedCoordinator = new RetryCoordinator({
          maxRetryAttempts: 3
        })

        // When & Then: retryCount 從 0 到 3
        expect(limitedCoordinator.canRetry({ retryCount: 0, error: 'network error' })).toBe(true)
        expect(limitedCoordinator.canRetry({ retryCount: 1, error: 'network error' })).toBe(true)
        expect(limitedCoordinator.canRetry({ retryCount: 2, error: 'network error' })).toBe(true)
        // retryCount=3 等於 maxRetryAttempts，不可重試
        expect(limitedCoordinator.canRetry({ retryCount: 3, error: 'network error' })).toBe(false)
        expect(limitedCoordinator.canRetry({ retryCount: 4, error: 'network error' })).toBe(false)
      })

      test('連續失敗耗盡重試次數後 executeRetry 拒絕執行', async () => {
        // Given: 快速協調器，maxRetryAttempts=2
        const fastCoordinator = new RetryCoordinator({
          baseDelay: 1,
          maxDelay: 10,
          jitterFactor: 0,
          maxRetryAttempts: 2
        })

        const mockExecutor = jest.fn().mockRejectedValue(new Error('persistent failure'))

        // When: 連續重試直到耗盡
        let currentJob = {
          id: 'sync_exhaust',
          retryCount: 0,
          error: 'persistent failure',
          originalParams: {}
        }

        // 第一次重試
        let result = await fastCoordinator.executeRetry(currentJob, mockExecutor)
        expect(result.success).toBe(false)
        expect(result.retryCount).toBe(1)
        expect(mockExecutor).toHaveBeenCalledTimes(1)

        // 更新 job
        currentJob = { ...currentJob, retryCount: result.retryCount, error: result.error }

        // 第二次重試
        result = await fastCoordinator.executeRetry(currentJob, mockExecutor)
        expect(result.success).toBe(false)
        expect(result.retryCount).toBe(2)
        expect(mockExecutor).toHaveBeenCalledTimes(2)

        // 更新 job（retryCount=2 == maxRetryAttempts）
        currentJob = { ...currentJob, retryCount: result.retryCount, error: result.error }

        // 第三次嘗試：應直接拒絕，不呼叫 executor
        result = await fastCoordinator.executeRetry(currentJob, mockExecutor)
        expect(result.success).toBe(false)
        expect(result.error).toContain('超過最大重試次數')
        // executor 不應被第三次呼叫
        expect(mockExecutor).toHaveBeenCalledTimes(2)
      })
    })

    describe('不可重試錯誤處理', () => {
      test.each([
        ['permission denied', 'AUTHORIZATION'],
        ['unauthorized', 'AUTHORIZATION'],
        ['forbidden', 'AUTHORIZATION'],
        ['access denied', 'AUTHORIZATION'],
        ['invalid credentials', 'AUTHORIZATION']
      ])('錯誤訊息 "%s" 應分類為 %s 且不可重試', (errorMessage, expectedCategory) => {
        // Given: 包含不可重試錯誤的作業
        const job = { error: errorMessage }

        // When: 分析失敗原因
        const analysis = coordinator.analyzeFailureReason(job)

        // Then: 應為不可重試的 AUTHORIZATION 類別
        expect(analysis.category).toBe(expectedCategory)
        expect(analysis.retryable).toBe(false)
        expect(analysis.recommendedDelay).toBe(0)
      })

      test('不可重試錯誤的作業 canRetry 應回傳 false', () => {
        // Given: 各種不可重試的作業（retryCount=0，理論上應可重試但錯誤類型不允許）
        const authJobs = [
          { retryCount: 0, error: 'permission denied' },
          { retryCount: 0, error: 'unauthorized access' },
          { retryCount: 0, error: 'request forbidden' },
          { retryCount: 0, error: 'access denied by server' },
          { retryCount: 0, error: 'invalid credentials provided' }
        ]

        // When & Then: 全部不可重試
        for (const job of authJobs) {
          expect(coordinator.canRetry(job)).toBe(false)
        }
      })

      test('不可重試錯誤的 executeRetry 應直接拒絕而不呼叫 executor', async () => {
        // Given: 權限錯誤的作業
        const authJob = {
          id: 'sync_auth_fail',
          retryCount: 0,
          error: 'permission denied',
          originalParams: {}
        }
        const mockExecutor = jest.fn()

        // When: 嘗試重試
        const result = await coordinator.executeRetry(authJob, mockExecutor)

        // Then: 應拒絕且不浪費 executor 呼叫
        expect(result.success).toBe(false)
        expect(result.error).toContain('超過最大重試次數')
        expect(mockExecutor).not.toHaveBeenCalled()
      })

      test('selectRetryStrategy 對不可重試分析結果應拋出錯誤', () => {
        // Given: 不可重試的分析結果
        const nonRetryableAnalysis = {
          category: 'AUTHORIZATION',
          retryable: false
        }

        // When & Then: 應拋出含錯誤碼的例外
        expect(() => coordinator.selectRetryStrategy(nonRetryableAnalysis)).toThrow()
        try {
          coordinator.selectRetryStrategy(nonRetryableAnalysis)
        } catch (error) {
          expect(error.code).toBe(ErrorCodes.OPERATION_ERROR)
          expect(error.details.category).toBe('general')
          expect(error.details.analysis).toBeDefined()
        }
      })
    })

    describe('SERVER_ERROR 錯誤分類', () => {
      test('server 和 500 錯誤應分類為 SERVER_ERROR 並選擇 LINEAR_BACKOFF', () => {
        // Given: 伺服器錯誤
        const serverJobs = [
          { error: 'internal server error' },
          { error: '500 internal error' }
        ]

        for (const job of serverJobs) {
          // When: 分析並選擇策略
          const analysis = coordinator.analyzeFailureReason(job)
          const strategy = coordinator.selectRetryStrategy(analysis)

          // Then
          expect(analysis.category).toBe('SERVER_ERROR')
          expect(analysis.retryable).toBe(true)
          expect(analysis.recommendedDelay).toBe(coordinator.config.baseDelay * 3)
          expect(strategy).toBe('LINEAR_BACKOFF')
        }
      })
    })
  })
})
