/**
 * Readmoo Data Consistency Service 單元測試
 * TDD 循環 1: 抽象介面與基礎功能測試
 */

const ReadmooDataConsistencyService = require('src/background/domains/data-management/services/readmoo-data-consistency-service')

describe('ReadmooDataConsistencyService', () => {
  let service
  let mockEventBus
  let mockLogger

  beforeEach(() => {
    // 建立 Mock 物件
    mockEventBus = {
      on: jest.fn(),
      emit: jest.fn(),
      off: jest.fn()
    }

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    }

    // 初始化服務
    service = new ReadmooDataConsistencyService(mockEventBus, {
      logger: mockLogger,
      config: {
        checkInterval: 5000,
        maxHistoryEntries: 10
      }
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('🏗️ 服務初始化', () => {
    test('應該正確初始化服務實例', () => {
      expect(service).toBeInstanceOf(ReadmooDataConsistencyService)
      expect(service.eventBus).toBe(mockEventBus)
      expect(service.logger).toBe(mockLogger)
      expect(service.isInitialized).toBe(false)
    })

    test('應該正確合併預設配置', () => {
      expect(service.effectiveConfig.checkInterval).toBe(5000)
      expect(service.effectiveConfig.maxHistoryEntries).toBe(10)
      expect(service.effectiveConfig.autoFix).toBe(false)
      expect(service.effectiveConfig.enableReporting).toBe(true)
    })

    test('應該正確初始化資料結構', () => {
      expect(service.consistencyJobs).toBeInstanceOf(Map)
      expect(service.consistencyJobs.size).toBe(0)
      expect(service.checkHistory).toEqual([])
    })
  })

  describe('🔄 服務生命週期', () => {
    test('initialize() 應該正確初始化服務', async () => {
      await service.initialize()

      expect(service.isInitialized).toBe(true)
      expect(mockEventBus.on).toHaveBeenCalledWith('DATA.UPDATE', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('DATA.CONSISTENCY.CHECK_REQUEST', expect.any(Function))
      expect(mockEventBus.emit).toHaveBeenCalledWith('DATA.CONSISTENCY.SERVICE.INITIALIZED', expect.objectContaining({
        platform: 'READMOO',
        config: service.effectiveConfig,
        timestamp: expect.any(Number)
      }))
    })

    test('initialize() 失敗時應該拋出錯誤', async () => {
      // 模擬 eventBus.on 拋出錯誤
      mockEventBus.on.mockImplementation(() => {
        throw new Error('Event registration failed')
      })

      await expect(service.initialize()).rejects.toThrow('Event registration failed')
      expect(service.isInitialized).toBe(false)
    })

    test('cleanup() 應該正確清理資源', async () => {
      // 先初始化服務
      await service.initialize()

      // 添加一些測試資料
      service.consistencyJobs.set('test1', { status: 'running' })
      service.checkHistory.push({ checkId: 'test1' })

      await service.cleanup()

      expect(service.isInitialized).toBe(false)
      expect(service.isRunning).toBe(false)
      expect(service.consistencyJobs.size).toBe(0)
      expect(service.checkHistory).toEqual([])
    })
  })

  describe('📝 事件處理', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    test('handleDataUpdate() 應該排程一致性檢查', async () => {
      const scheduleCheckSpy = jest.spyOn(service, 'scheduleConsistencyCheck').mockResolvedValue('check123')

      await service.handleDataUpdate({
        platform: 'READMOO',
        data: { books: [] }
      })

      expect(scheduleCheckSpy).toHaveBeenCalledWith({
        source: 'data_update',
        trigger: expect.objectContaining({
          platform: 'READMOO'
        })
      })
    })

    test('handleDataUpdate() 應該忽略非 READMOO 平台事件', async () => {
      const scheduleCheckSpy = jest.spyOn(service, 'scheduleConsistencyCheck').mockResolvedValue('check123')

      await service.handleDataUpdate({
        platform: 'KINDLE',
        data: { books: [] }
      })

      expect(scheduleCheckSpy).not.toHaveBeenCalled()
    })

    test('handleConsistencyCheckRequest() 應該執行一致性檢查', async () => {
      const performCheckSpy = jest.spyOn(service, 'performConsistencyCheck').mockResolvedValue({})

      await service.handleConsistencyCheckRequest({
        checkId: 'test123',
        options: { autoFix: true }
      })

      expect(performCheckSpy).toHaveBeenCalledWith('test123', { autoFix: true })
    })
  })

  describe('🔍 一致性檢查功能', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    test('scheduleConsistencyCheck() 應該建立並排程檢查作業', async () => {
      const performCheckSpy = jest.spyOn(service, 'performConsistencyCheck').mockResolvedValue({})

      const checkId = await service.scheduleConsistencyCheck({
        source: 'manual'
      })

      expect(checkId).toMatch(/^readmoo_check_\d+_[a-z0-9]+$/)
      expect(service.consistencyJobs.has(checkId)).toBe(true)

      const job = service.consistencyJobs.get(checkId)
      expect(job.status).toBe('scheduled')
      expect(job.options.source).toBe('manual')
    })

    test('scheduleConsistencyCheck() 應該防止重複檢查', async () => {
      const testCheckId = 'test_check_123'
      service.consistencyJobs.set(testCheckId, { status: 'running' })

      const result = await service.scheduleConsistencyCheck({}, testCheckId)

      expect(result).toBe(testCheckId)
      expect(service.consistencyJobs.size).toBe(1)
    })

    test('performConsistencyCheck() 應該成功執行檢查', async () => {
      const checkId = 'test_check_456'

      const result = await service.performConsistencyCheck(checkId, {
        autoFix: false
      })

      // 驗證基本結構
      expect(result).toMatchObject({
        checkId,
        platform: 'READMOO',
        status: 'completed',
        timestamp: expect.any(Number)
      })

      // 驗證整合的專門服務結果
      expect(result).toHaveProperty('inconsistencies')
      expect(result).toHaveProperty('conflicts')
      expect(result).toHaveProperty('recommendations')
      expect(result).toHaveProperty('statistics')
      expect(Array.isArray(result.inconsistencies)).toBe(true)
      expect(Array.isArray(result.conflicts)).toBe(true)
      expect(Array.isArray(result.recommendations)).toBe(true)

      const job = service.consistencyJobs.get(checkId)
      expect(job.status).toBe('completed')
      expect(job.result).toEqual(result)
      expect(service.checkHistory).toContain(result)
    })

    test('performConsistencyCheck() 失敗時應該正確處理錯誤', async () => {
      const checkId = 'failing_check'

      // 模擬 emit 失敗
      mockEventBus.emit.mockImplementation(() => {
        throw new Error('Event emission failed')
      })

      await expect(service.performConsistencyCheck(checkId)).rejects.toThrow('Event emission failed')

      const job = service.consistencyJobs.get(checkId)
      expect(job.status).toBe('failed')
      expect(job.error).toBe('Event emission failed')
    })
  })

  describe('🔄 向後相容性', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    test('initiateCrossPlatformSync() 應該轉換為一致性檢查', async () => {
      const performCheckSpy = jest.spyOn(service, 'performConsistencyCheck').mockResolvedValue({
        checkId: 'sync123'
      })

      const result = await service.initiateCrossPlatformSync(
        'sync123',
        ['READMOO'],
        ['LOCAL'],
        { strategy: 'MERGE' }
      )

      expect(performCheckSpy).toHaveBeenCalledWith('sync123', {
        strategy: 'MERGE',
        compatibilityMode: true,
        originalMethod: 'initiateCrossPlatformSync'
      })
      expect(result.checkId).toBe('sync123')
    })
  })

  describe('📊 統計與監控', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    test('getServiceStatistics() 應該回傳正確的統計資訊', async () => {
      // 建立一些測試資料
      service.consistencyJobs.set('job1', { status: 'completed' })
      service.consistencyJobs.set('job2', { status: 'running' })
      service.consistencyJobs.set('job3', { status: 'failed' })
      service.checkHistory.push({ checkId: 'job1', timestamp: Date.now() })

      const stats = service.getServiceStatistics()

      expect(stats).toEqual({
        totalChecks: 1,
        activeJobs: 1,
        completedJobs: 1,
        failedJobs: 1,
        lastCheck: expect.objectContaining({ checkId: 'job1' }),
        serviceStatus: 'initialized'
      })
    })

    test('addToHistory() 應該正確管理歷史記錄', () => {
      const maxEntries = service.effectiveConfig.maxHistoryEntries

      // 添加超過最大數量的記錄
      for (let i = 0; i < maxEntries + 5; i++) {
        service.addToHistory({ checkId: `check${i}`, timestamp: Date.now() })
      }

      expect(service.checkHistory.length).toBe(maxEntries)
      expect(service.checkHistory[0].checkId).toBe('check5') // 最舊的 5 個應該被移除
      expect(service.checkHistory[maxEntries - 1].checkId).toBe(`check${maxEntries + 4}`)
    })
  })

  describe('🔧 工具方法', () => {
    test('generateCheckId() 應該產生唯一的檢查 ID', () => {
      const id1 = service.generateCheckId()
      const id2 = service.generateCheckId()

      expect(id1).toMatch(/^readmoo_check_\d+_[a-z0-9]+$/)
      expect(id2).toMatch(/^readmoo_check_\d+_[a-z0-9]+$/)
      expect(id1).not.toBe(id2)
    })
  })

  describe('⚠️ 錯誤處理', () => {
    test('constructor 應該要求 eventBus 參數', () => {
      expect(() => {
        new ReadmooDataConsistencyService()
      }).toThrow()
    })

    test('事件處理錯誤不應該影響服務穩定性', async () => {
      await service.initialize()

      // 模擬事件處理錯誤
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      await service.handleDataUpdate(null) // 傳入 null 應該不會崩潰

      expect(service.isInitialized).toBe(true) // 服務應該保持穩定
      consoleErrorSpy.mockRestore()
    })
  })
})
