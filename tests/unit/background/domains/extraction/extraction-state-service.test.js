/**
 * @fileoverview Extraction State Service 單元測試
 *
 * 對應 domain-map 不變式：提取狀態機 idle -> extracting -> completed/failed；
 * 不可從 completed 直接回 extracting。
 */

const ExtractionStateService = require('src/background/domains/extraction/services/extraction-state-service.js')

describe('ExtractionStateService', () => {
  let service
  let mockLogger

  beforeEach(() => {
    jest.useFakeTimers()

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }

    service = new ExtractionStateService({ logger: mockLogger })
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  describe('createExtractionJob() 建立作業（idle 狀態）', () => {
    test('新建立的作業狀態應為 PENDING（idle）', async () => {
      const jobId = await service.createExtractionJob({ type: 'books', source: 'readmoo' })

      const job = service.getJobStatus(jobId)
      expect(job.state).toBe(service.JOB_STATES.PENDING)
    })
  })

  describe('startExtractionJob() 狀態轉換：idle -> extracting', () => {
    test('從 PENDING 啟動後狀態應轉為 RUNNING（extracting）', async () => {
      const jobId = await service.createExtractionJob({ type: 'books' })

      await service.startExtractionJob(jobId)

      const job = service.getJobStatus(jobId)
      expect(job.state).toBe(service.JOB_STATES.RUNNING)
      expect(service.activeJobs.has(jobId)).toBe(true)
    })

    test('對不存在的作業啟動應拋出錯誤', async () => {
      await expect(service.startExtractionJob('not-exist')).rejects.toMatchObject({
        message: expect.stringContaining('提取作業不存在')
      })
    })

    test('對已在 RUNNING 狀態的作業重複啟動應拋出錯誤（不可重複進入 extracting）', async () => {
      const jobId = await service.createExtractionJob({ type: 'books' })
      await service.startExtractionJob(jobId)

      await expect(service.startExtractionJob(jobId)).rejects.toMatchObject({
        message: expect.stringContaining('作業狀態無效，無法啟動')
      })
    })

    test('已達最大同時作業數量限制時應拋出錯誤', async () => {
      const jobIds = []
      for (let i = 0; i < service.config.maxActiveJobs; i++) {
        const jobId = await service.createExtractionJob({ type: 'books' })
        await service.startExtractionJob(jobId)
        jobIds.push(jobId)
      }

      const overflowJobId = await service.createExtractionJob({ type: 'books' })
      await expect(service.startExtractionJob(overflowJobId)).rejects.toMatchObject({
        message: expect.stringContaining('已達到最大同時作業數量限制')
      })
    })
  })

  describe('completeExtractionJob() 狀態轉換：extracting -> completed', () => {
    test('完成後狀態應轉為 COMPLETED 並移出活動作業清單', async () => {
      const jobId = await service.createExtractionJob({ type: 'books' })
      await service.startExtractionJob(jobId)

      await service.completeExtractionJob(jobId, { books: [] })

      const job = service.getJobStatus(jobId)
      expect(job.state).toBe(service.JOB_STATES.COMPLETED)
      expect(service.activeJobs.has(jobId)).toBe(false)
    })

    test('不可從 completed 直接回 extracting：完成後再次啟動應拋出「作業不存在」錯誤', async () => {
      const jobId = await service.createExtractionJob({ type: 'books' })
      await service.startExtractionJob(jobId)
      await service.completeExtractionJob(jobId, { books: [] })

      await expect(service.startExtractionJob(jobId)).rejects.toMatchObject({
        message: expect.stringContaining('提取作業不存在')
      })
    })
  })

  describe('failExtractionJob() 狀態轉換：extracting -> failed（或 retrying）', () => {
    test('嘗試次數未達上限時應轉為 RETRYING 而非 FAILED', async () => {
      const jobId = await service.createExtractionJob({ type: 'books', maxAttempts: 3 })
      await service.startExtractionJob(jobId)

      await service.failExtractionJob(jobId, new Error('提取失敗'))

      const job = service.getJobStatus(jobId)
      expect(job.state).toBe(service.JOB_STATES.RETRYING)
    })

    test('嘗試次數達上限時應轉為 FAILED（不可再回到 extracting）', async () => {
      const jobId = await service.createExtractionJob({ type: 'books', maxAttempts: 1 })
      await service.startExtractionJob(jobId)

      await service.failExtractionJob(jobId, new Error('提取失敗'))

      const job = service.getJobStatus(jobId)
      expect(job.state).toBe(service.JOB_STATES.FAILED)
    })
  })
})
