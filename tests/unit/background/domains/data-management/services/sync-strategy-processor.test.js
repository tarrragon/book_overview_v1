/**
 * @fileoverview SyncStrategyProcessor 測試檔案
 * @version TDD v4/8
 * @since 2025-08-21
 * 
 * 測試範圍：
 * - MERGE 策略執行邏輯
 * - OVERWRITE 策略執行邏輯  
 * - APPEND 策略執行邏輯
 * - 批量處理和錯誤處理
 * - 策略選擇和驗證
 */

const SyncStrategyProcessor = require('../../../../../../src/background/domains/data-management/services/sync-strategy-processor.js')

describe('SyncStrategyProcessor', () => {
  let processor
  let mockLogger
  let mockConfig

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }

    mockConfig = {
      batchSize: 10,
      enableProgressTracking: true,
      retryAttempts: 3,
      safetyChecks: true
    }

    processor = new SyncStrategyProcessor(mockLogger, mockConfig)
  })

  describe('建構函數', () => {
    test('應該正確初始化所有必要屬性', () => {
      expect(processor).toBeDefined()
      expect(processor.logger).toBe(mockLogger)
      expect(processor.config).toMatchObject(mockConfig)
      expect(processor.supportedStrategies).toContain('MERGE')
      expect(processor.supportedStrategies).toContain('OVERWRITE')
      expect(processor.supportedStrategies).toContain('APPEND')
    })

    test('應該使用預設配置當配置未提供時', () => {
      const defaultProcessor = new SyncStrategyProcessor(mockLogger)
      
      expect(defaultProcessor.config.batchSize).toBe(100)
      expect(defaultProcessor.config.enableProgressTracking).toBe(true)
      expect(defaultProcessor.config.retryAttempts).toBe(3)
    })

    test('應該在 logger 為 null 時拋出錯誤', () => {
      expect(() => new SyncStrategyProcessor(null)).toThrow('Logger is required')
    })
  })

  describe('策略驗證', () => {
    test('isStrategySupported() 應該正確識別支援的策略', () => {
      expect(processor.isStrategySupported('MERGE')).toBe(true)
      expect(processor.isStrategySupported('OVERWRITE')).toBe(true)
      expect(processor.isStrategySupported('APPEND')).toBe(true)
      expect(processor.isStrategySupported('INVALID_STRATEGY')).toBe(false)
    })

    test('validateStrategy() 應該拋出錯誤給不支援的策略', () => {
      expect(() => processor.validateStrategy('INVALID_STRATEGY'))
        .toThrow('Unsupported sync strategy: INVALID_STRATEGY')
      
      expect(() => processor.validateStrategy('MERGE')).not.toThrow()
    })
  })

  describe('MERGE 策略執行', () => {
    const mockChanges = {
      added: [
        { id: 'book1', title: '新書1', progress: 0 },
        { id: 'book2', title: '新書2', progress: 10 }
      ],
      modified: [
        {
          id: 'book3',
          source: { id: 'book3', title: '修改書3', progress: 50 },
          target: { id: 'book3', title: '原書3', progress: 30 },
          changes: { progress: { from: 30, to: 50 } }
        }
      ],
      deleted: [
        { id: 'book4', title: '刪除書4' }
      ]
    }

    test('applyMergeStrategy() 應該成功處理所有變更類型', async () => {
      const result = await processor.applyMergeStrategy('READMOO', mockChanges)

      expect(result).toMatchObject({
        platform: 'READMOO',
        strategy: 'MERGE',
        applied: {
          added: 2,
          modified: 1,
          deleted: 1
        },
        errors: []
      })

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('MERGE 策略應用完成')
      )
    })

    test('applyMergeStrategy() 應該正確處理空變更', async () => {
      const emptyChanges = { added: [], modified: [], deleted: [] }
      const result = await processor.applyMergeStrategy('READMOO', emptyChanges)

      expect(result.applied).toMatchObject({
        added: 0,
        modified: 0,
        deleted: 0
      })
    })

    test('applyMergeStrategy() 應該處理批量操作錯誤', async () => {
      // 模擬批量處理失敗
      jest.spyOn(processor, 'processBatchChanges')
        .mockRejectedValueOnce(new Error('批量處理失敗'))

      const result = await processor.applyMergeStrategy('READMOO', mockChanges)

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'STRATEGY_ERROR',
          message: expect.stringContaining('批量處理失敗')
        })
      )
    })
  })

  describe('OVERWRITE 策略執行', () => {
    const mockChanges = {
      added: [{ id: 'book1', title: '新書1' }],
      modified: [{ id: 'book2', source: { title: '覆寫書2' } }],
      deleted: [{ id: 'book3', title: '刪除書3' }]
    }

    test('applyOverwriteStrategy() 應該強制覆寫所有資料', async () => {
      const result = await processor.applyOverwriteStrategy('READMOO', mockChanges)

      expect(result).toMatchObject({
        platform: 'READMOO',
        strategy: 'OVERWRITE',
        applied: {
          added: 1,
          modified: 1,
          deleted: 1
        }
      })

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'DATA_LOSS_WARNING'
        })
      )
    })

    test('applyOverwriteStrategy() 應該記錄資料丟失警告', async () => {
      await processor.applyOverwriteStrategy('READMOO', mockChanges)

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('覆寫策略可能導致目標平台獨有資料丟失')
      )
    })
  })

  describe('APPEND 策略執行', () => {
    const mockChanges = {
      added: [
        { id: 'book1', title: '新書1' },
        { id: 'book2', title: '新書2' }
      ],
      modified: [{ id: 'book3', source: { title: '修改書3' } }],
      deleted: [{ id: 'book4', title: '刪除書4' }]
    }

    test('applyAppendStrategy() 應該只處理新增項目', async () => {
      const result = await processor.applyAppendStrategy('READMOO', mockChanges)

      expect(result).toMatchObject({
        platform: 'READMOO',
        strategy: 'APPEND',
        applied: {
          added: 2,
          modified: 0,
          deleted: 0
        }
      })

      expect(result.skipped).toContainEqual(
        expect.objectContaining({
          type: 'MODIFICATIONS_SKIPPED',
          count: 1
        })
      )

      expect(result.skipped).toContainEqual(
        expect.objectContaining({
          type: 'DELETIONS_SKIPPED',
          count: 1
        })
      )
    })

    test('applyAppendStrategy() 應該記錄跳過的操作', async () => {
      await processor.applyAppendStrategy('READMOO', mockChanges)

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('跳過修改: 1, 跳過刪除: 1')
      )
    })
  })

  describe('批量處理', () => {
    test('processBatchChanges() 應該按批量大小處理資料', async () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: `book${i}` }))
      
      const result = await processor.processBatchChanges('READMOO', 'ADD', items, 10)

      expect(result).toBe(25)
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('批量處理完成')
      )
    })

    test('processBatchChanges() 應該處理批量操作錯誤', async () => {
      const items = [{ id: 'book1' }]
      
      // 模擬連續失敗直到超過重試限制
      jest.spyOn(processor, 'executeBatchOperation')
        .mockRejectedValue(new Error('操作失敗'))

      await expect(processor.processBatchChanges('READMOO', 'ADD', items, 10))
        .rejects.toThrow('操作失敗')
    })
  })

  describe('錯誤處理和重試機制', () => {
    test('應該在達到重試限制後拋出錯誤', async () => {
      const items = [{ id: 'book1' }]
      
      jest.spyOn(processor, 'executeBatchOperation')
        .mockRejectedValue(new Error('持續失敗'))

      await expect(processor.processBatchChanges('READMOO', 'ADD', items, 10))
        .rejects.toThrow('持續失敗')

      expect(processor.executeBatchOperation).toHaveBeenCalledTimes(3) // 重試 3 次
    })

    test('應該在成功重試後繼續處理', async () => {
      const items = [{ id: 'book1' }]
      
      jest.spyOn(processor, 'executeBatchOperation')
        .mockRejectedValueOnce(new Error('第一次失敗'))
        .mockResolvedValueOnce(1)

      const result = await processor.processBatchChanges('READMOO', 'ADD', items, 10)

      expect(result).toBe(1)
      expect(processor.executeBatchOperation).toHaveBeenCalledTimes(2)
    })
  })

  describe('主要策略執行介面', () => {
    const mockChanges = {
      added: [{ id: 'book1', title: '新書1' }],
      modified: [],
      deleted: []
    }

    test('applySyncChanges() 應該委派給正確的策略方法', async () => {
      const mergeSpy = jest.spyOn(processor, 'applyMergeStrategy')
        .mockResolvedValue({ applied: { added: 1 } })

      await processor.applySyncChanges('READMOO', mockChanges, 'MERGE')

      expect(mergeSpy).toHaveBeenCalledWith('READMOO', mockChanges)
    })

    test('applySyncChanges() 應該拋出錯誤給不支援的策略', async () => {
      await expect(
        processor.applySyncChanges('READMOO', mockChanges, 'INVALID_STRATEGY')
      ).rejects.toThrow('Unsupported sync strategy: INVALID_STRATEGY')
    })

    test('applySyncChanges() 應該處理策略執行錯誤', async () => {
      jest.spyOn(processor, 'applyMergeStrategy')
        .mockRejectedValue(new Error('策略執行失敗'))

      await expect(
        processor.applySyncChanges('READMOO', mockChanges, 'MERGE')
      ).rejects.toThrow('策略執行失敗')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('應用同步變更失敗')
      )
    })
  })

  describe('統計和監控', () => {
    test('getProcessingStatistics() 應該返回處理統計資訊', () => {
      const stats = processor.getProcessingStatistics()

      expect(stats).toMatchObject({
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        strategiesUsed: {},
        averageProcessingTime: 0
      })
    })

    test('應該正確更新統計資訊', async () => {
      const mockChanges = {
        added: [{ id: 'book1' }],
        modified: [],
        deleted: []
      }

      await processor.applySyncChanges('READMOO', mockChanges, 'MERGE')

      const stats = processor.getProcessingStatistics()
      expect(stats.totalOperations).toBe(1)
      expect(stats.strategiesUsed.MERGE).toBe(1)
    })
  })
})