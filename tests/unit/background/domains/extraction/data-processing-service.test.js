/**
 * @fileoverview Data Processing Service 單元測試
 *
 * 對應 domain-map 不變式：管道處理順序固定（parse -> normalize -> validate）；
 * 快取命中時跳過 parse。
 */

const DataProcessingService = require('src/background/domains/extraction/services/data-processing-service.js')

describe('DataProcessingService', () => {
  let service
  let mockLogger

  beforeEach(async () => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }

    service = new DataProcessingService({ logger: mockLogger })
    await service.initialize()
  })

  describe('processThroughPipeline() 管道處理順序固定', () => {
    test('standard_book_processing 管道應依 validate -> normalize -> clean -> enrich -> validate 順序執行', async () => {
      const callOrder = []

      jest.spyOn(service, 'validateInput').mockImplementation(() => {
        callOrder.push('validate_input')
      })
      jest.spyOn(service, 'cleanData').mockImplementation((data) => {
        callOrder.push('clean_data')
        return data
      })
      jest.spyOn(service, 'enrichData').mockImplementation((data) => {
        callOrder.push('enrich_data')
        return data
      })
      jest.spyOn(service, 'validateOutput').mockImplementation(() => {
        callOrder.push('validate_output')
      })

      const dataType = 'book_metadata'
      const originalProcessor = service.dataProcessors.get(dataType)
      service.dataProcessors.set(dataType, async (rawData) => {
        callOrder.push('normalize_data')
        return originalProcessor(rawData)
      })

      await service.processData(dataType, { totalCount: 1, version: '1.0' })

      expect(callOrder).toEqual([
        'validate_input',
        'normalize_data',
        'clean_data',
        'enrich_data',
        'validate_output'
      ])
    })
  })

  describe('processData() 快取行為：命中時跳過處理管道（parse）', () => {
    test('相同資料重複處理時第二次應命中快取，不再呼叫資料處理器', async () => {
      const dataType = 'book_metadata'
      const processorSpy = jest.fn(service.dataProcessors.get(dataType))
      service.dataProcessors.set(dataType, processorSpy)

      const rawData = { totalCount: 5, version: '1.0', source: 'readmoo' }

      const first = await service.processData(dataType, rawData)
      const second = await service.processData(dataType, rawData)

      expect(processorSpy).toHaveBeenCalledTimes(1)
      expect(second).toBe(first)
      expect(service.stats.cacheHits).toBe(1)
    })

    test('不同資料內容不應命中快取，處理器應被重新呼叫', async () => {
      const dataType = 'book_metadata'
      const processorSpy = jest.fn(service.dataProcessors.get(dataType))
      service.dataProcessors.set(dataType, processorSpy)

      await service.processData(dataType, { totalCount: 1, version: '1.0' })
      await service.processData(dataType, { totalCount: 2, version: '1.0' })

      expect(processorSpy).toHaveBeenCalledTimes(2)
      expect(service.stats.cacheHits).toBe(0)
    })
  })

  describe('processData() 未知資料類型', () => {
    test('找不到對應資料處理器時應拋出錯誤', async () => {
      await expect(service.processData('unknown_type', {})).rejects.toMatchObject({
        message: expect.stringContaining('未找到資料處理器')
      })
    })
  })
})
