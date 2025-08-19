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

const RetryCoordinator = require('../../../../../../src/background/domains/data-management/services/RetryCoordinator.js')

describe('RetryCoordinator TDD 測試', () => {
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
      const defaultCoordinator = new RetryCoordinator()

      // Then: 應該正確設置預設值
      expect(defaultCoordinator.config.maxRetryAttempts).toBe(3)
      expect(defaultCoordinator.config.baseDelay).toBe(1000)
      expect(defaultCoordinator.config.maxDelay).toBe(30000)
      expect(defaultCoordinator.isInitialized).toBe(true)
    })

    test('應該支援自訂配置', () => {
      // Given: 自訂配置
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
      const job1 = { retryCount: 0, error: 'network timeout' }
      const job2 = { retryCount: 2, error: 'connection failed' }
      const job3 = { retryCount: 3, error: 'server error' }
      const job4 = { retryCount: 1, error: 'permission denied' }

      // When & Then: 檢查重試可行性
      expect(coordinator.canRetry(job1)).toBe(true)
      expect(coordinator.canRetry(job2)).toBe(true)
      expect(coordinator.canRetry(job3)).toBe(false) // 超過最大重試次數
      expect(coordinator.canRetry(job4)).toBe(false) // 權限錯誤不可重試
    })

    test('analyzeFailureReason() 應該正確分析失敗原因', () => {
      // Given: 不同類型的失敗作業
      const networkError = { error: 'network timeout occurred' }
      const conflictError = { error: 'data conflict detected' }
      const authError = { error: 'permission denied' }
      const unknownError = { error: 'something went wrong' }

      // When: 分析失敗原因
      const networkAnalysis = coordinator.analyzeFailureReason(networkError)
      const conflictAnalysis = coordinator.analyzeFailureReason(conflictError)
      const authAnalysis = coordinator.analyzeFailureReason(authError)
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
      const networkAnalysis = { category: 'NETWORK', retryable: true }
      const conflictAnalysis = { category: 'DATA_CONFLICT', retryable: true }
      const unknownAnalysis = { category: 'UNKNOWN', retryable: true }
      const nonRetryableAnalysis = { category: 'AUTHORIZATION', retryable: false }

      // When & Then: 選擇重試策略
      expect(coordinator.selectRetryStrategy(networkAnalysis)).toBe('EXPONENTIAL_BACKOFF')
      expect(coordinator.selectRetryStrategy(conflictAnalysis)).toBe('CONFLICT_RESOLUTION_FIRST')
      expect(coordinator.selectRetryStrategy(unknownAnalysis)).toBe('LINEAR_BACKOFF')
      
      // 不可重試的錯誤應該拋出異常
      expect(() => coordinator.selectRetryStrategy(nonRetryableAnalysis))
        .toThrow('錯誤不可重試: AUTHORIZATION')
    })

    test('calculateBackoffDelay() 應該正確計算退避延遲', () => {
      // Given & When: 不同重試次數的延遲計算
      const delay0 = coordinator.calculateBackoffDelay(0)
      const delay1 = coordinator.calculateBackoffDelay(1)
      const delay2 = coordinator.calculateBackoffDelay(2)
      const delay10 = coordinator.calculateBackoffDelay(10) // 超過最大值

      // Then: 應該符合指數退避規則
      expect(delay0).toBeGreaterThanOrEqual(1000 * 0.9) // 考慮 jitter
      expect(delay0).toBeLessThanOrEqual(1000 * 1.1)
      expect(delay1).toBeGreaterThanOrEqual(2000 * 0.9)
      expect(delay1).toBeLessThanOrEqual(2000 * 1.1)
      expect(delay2).toBeGreaterThanOrEqual(4000 * 0.9)
      expect(delay2).toBeLessThanOrEqual(4000 * 1.1)
      expect(delay10).toBeLessThanOrEqual(30000) // 不應超過最大延遲
    })

    test('executeRetry() 應該執行成功的重試', async () => {
      // Given: 可重試的失敗作業和成功的執行函數
      const failedJob = {
        id: 'sync_123',
        retryCount: 1,
        error: 'network timeout',
        originalParams: { source: 'readmoo', target: 'local' }
      }
      
      const mockExecutor = jest.fn().mockResolvedValue({
        success: true,
        data: { synced: 10 }
      })

      // When: 執行重試
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
      const failedJob = {
        id: 'sync_456',
        retryCount: 0,
        error: 'server error',
        originalParams: { source: 'readmoo' }
      }
      
      const mockExecutor = jest.fn().mockRejectedValue(new Error('still failing'))

      // When: 執行重試
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
      const exponentialJitter = coordinator.shouldApplyJitter('EXPONENTIAL_BACKOFF')
      const linearJitter = coordinator.shouldApplyJitter('LINEAR_BACKOFF')
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
      const originalDelay = coordinator.config.baseDelay

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
      const nullJob = null
      const undefinedJob = undefined
      const emptyJob = {}

      // When & Then: 應該安全處理無效輸入
      expect(coordinator.canRetry(nullJob)).toBe(false)
      expect(coordinator.canRetry(undefinedJob)).toBe(false)
      expect(coordinator.canRetry(emptyJob)).toBe(true) // 新作業，重試次數為 0
    })

    test('calculateBackoffDelay() 應該處理負數重試次數', () => {
      // Given & When: 負數重試次數
      const negativeDelay = coordinator.calculateBackoffDelay(-1)

      // Then: 應該返回基礎延遲
      expect(negativeDelay).toBeGreaterThanOrEqual(1000 * 0.9)
      expect(negativeDelay).toBeLessThanOrEqual(1000 * 1.1)
    })

    test('executeRetry() 應該處理超過最大重試次數的作業', async () => {
      // Given: 已超過最大重試次數的作業
      const exhaustedJob = {
        id: 'sync_789',
        retryCount: 5, // 超過預設最大值 3
        error: 'persistent error',
        originalParams: {}
      }
      
      const mockExecutor = jest.fn()

      // When: 嘗試執行重試
      const result = await coordinator.executeRetry(exhaustedJob, mockExecutor)

      // Then: 應該拒絕重試
      expect(result.success).toBe(false)
      expect(result.error).toContain('超過最大重試次數')
      expect(mockExecutor).not.toHaveBeenCalled()
    })

    test('analyzeFailureReason() 應該處理空錯誤訊息', () => {
      // Given: 空錯誤訊息的作業
      const emptyErrorJob = { error: '' }
      const nullErrorJob = { error: null }
      const missingErrorJob = {}

      // When: 分析失敗原因
      const emptyAnalysis = coordinator.analyzeFailureReason(emptyErrorJob)
      const nullAnalysis = coordinator.analyzeFailureReason(nullErrorJob)
      const missingAnalysis = coordinator.analyzeFailureReason(missingErrorJob)

      // Then: 應該回傳預設分析結果
      expect(emptyAnalysis.category).toBe('UNKNOWN')
      expect(nullAnalysis.category).toBe('UNKNOWN')
      expect(missingAnalysis.category).toBe('UNKNOWN')
    })

    test('應該處理執行器拋出非 Error 物件', async () => {
      // Given: 執行器拋出字串而非 Error 物件
      const failedJob = {
        id: 'sync_string_error',
        retryCount: 0,
        error: 'initial error',
        originalParams: {}
      }
      
      const mockExecutor = jest.fn().mockRejectedValue('string error')

      // When: 執行重試
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
      const linearCoordinator = new RetryCoordinator({
        defaultStrategy: 'LINEAR_BACKOFF'
      })

      // When: 模擬線性退避行為（在實際實作中會有不同的計算）
      const analysis = { category: 'UNKNOWN', retryable: true }
      const strategy = linearCoordinator.selectRetryStrategy(analysis)

      // Then: 應該選擇線性退避策略
      expect(strategy).toBe('LINEAR_BACKOFF')
    })

    test('CONFLICT_RESOLUTION_FIRST 策略應該優先解決衝突', async () => {
      // Given: 資料衝突的作業
      const conflictJob = {
        id: 'sync_conflict',
        retryCount: 0,
        error: 'data conflict detected',
        originalParams: { conflictData: [] }
      }
      
      const mockExecutor = jest.fn().mockResolvedValue({
        success: true,
        conflictsResolved: true
      })

      // When: 執行衝突解決重試
      const result = await coordinator.executeRetry(conflictJob, mockExecutor)

      // Then: 應該使用衝突解決策略
      expect(result.retryStrategy).toBe('CONFLICT_RESOLUTION_FIRST')
      expect(result.success).toBe(true)
    })
  })
})