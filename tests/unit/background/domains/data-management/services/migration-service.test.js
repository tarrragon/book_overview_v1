/**
 * MigrationService 單元測試
 *
 * 測試範圍（W6-012.2.2.1）：
 * 1. constructor 驗證（storage 必填、預設步驟、logger 後備）
 * 2. initialize 行為
 * 3. registerStep 介面驗證與重複註冊偵測
 * 4. migrate 路由邏輯：
 *    - applies=false 的 step 應被跳過
 *    - applies=true 的 step 應被依序執行
 *    - step.run 拋例外 → 中止後續 + 回報 failed
 *    - step.run 回傳 { error } → 中止後續 + 回報 failed
 *    - applies 拋例外 → 中止後續 + 回報 failed.phase='applies'
 * 5. 預設 v1-to-v2 step 整合（透過 mock storage 驗證真實 migrateV1ToV2 被呼叫）
 */

const MigrationService = require('src/background/domains/data-management/services/migration-service')

describe('MigrationService', () => {
  let mockStorage
  let mockLogger

  function createMockStorage (initialData = {}) {
    const store = { ...initialData }
    return {
      get: jest.fn((keys) => {
        if (Array.isArray(keys)) {
          const result = {}
          keys.forEach(k => {
            if (k in store) result[k] = store[k]
          })
          return Promise.resolve(result)
        }
        return Promise.resolve({ ...store })
      }),
      set: jest.fn((items) => {
        Object.assign(store, items)
        return Promise.resolve()
      }),
      remove: jest.fn((keys) => {
        const arr = Array.isArray(keys) ? keys : [keys]
        arr.forEach(k => delete store[k])
        return Promise.resolve()
      }),
      _store: store
    }
  }

  beforeEach(() => {
    mockStorage = createMockStorage()
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }
  })

  describe('constructor', () => {
    it('storage 未提供時應拋出錯誤', () => {
      expect(() => new MigrationService()).toThrow('MigrationService requires storage dependency')
      expect(() => new MigrationService({})).toThrow('MigrationService requires storage dependency')
    })

    it('未提供 steps 時應載入預設步驟（含 v1-to-v2）', () => {
      const svc = new MigrationService({ storage: mockStorage, logger: mockLogger })
      expect(svc.steps.length).toBeGreaterThanOrEqual(1)
      expect(svc.steps.some(s => s.id === 'v1-to-v2')).toBe(true)
    })

    it('提供自訂 steps 時應覆蓋預設（用於測試）', () => {
      const customStep = { id: 'custom', applies: () => true, run: jest.fn() }
      const svc = new MigrationService({ storage: mockStorage, steps: [customStep] })
      expect(svc.steps).toHaveLength(1)
      expect(svc.steps[0].id).toBe('custom')
    })

    it('未提供 logger 應 fallback 至 console', () => {
      const svc = new MigrationService({ storage: mockStorage })
      expect(svc.logger).toBe(console)
    })
  })

  describe('initialize', () => {
    it('應將 isInitialized 設為 true 並寫入 info 日誌', async () => {
      const svc = new MigrationService({ storage: mockStorage, logger: mockLogger, steps: [] })
      await svc.initialize()
      expect(svc.isInitialized).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith('MigrationService initialized')
    })

    it('logger 缺 info 方法時不應丟錯', async () => {
      const minimalLogger = { error: jest.fn() }
      const svc = new MigrationService({ storage: mockStorage, logger: minimalLogger, steps: [] })
      await expect(svc.initialize()).resolves.toBeUndefined()
      expect(svc.isInitialized).toBe(true)
    })
  })

  describe('registerStep', () => {
    let svc

    beforeEach(() => {
      svc = new MigrationService({ storage: mockStorage, logger: mockLogger, steps: [] })
    })

    it('應允許註冊合法 step', () => {
      const step = { id: 'cover-to-reader', applies: () => true, run: async () => ({}) }
      svc.registerStep(step)
      expect(svc.steps).toHaveLength(1)
      expect(svc.steps[0].id).toBe('cover-to-reader')
    })

    it('id 重複時應拋錯', () => {
      const step = { id: 'dup', applies: () => true, run: async () => ({}) }
      svc.registerStep(step)
      expect(() => svc.registerStep({ ...step })).toThrow('Migration step already registered: dup')
    })

    it('缺少必填欄位時應拋錯', () => {
      expect(() => svc.registerStep(null)).toThrow('Invalid migration step')
      expect(() => svc.registerStep({ id: 'x' })).toThrow('Invalid migration step')
      expect(() => svc.registerStep({ id: 'x', applies: () => true })).toThrow('Invalid migration step')
      expect(() => svc.registerStep({ applies: () => true, run: async () => ({}) })).toThrow('Invalid migration step')
    })
  })

  describe('migrate - 路由邏輯', () => {
    it('應依序執行 applies=true 的 steps 並跳過 applies=false', async () => {
      const stepA = { id: 'a', applies: jest.fn(() => true), run: jest.fn().mockResolvedValue({ migrated: true }) }
      const stepB = { id: 'b', applies: jest.fn(() => false), run: jest.fn() }
      const stepC = { id: 'c', applies: jest.fn(() => true), run: jest.fn().mockResolvedValue({ migrated: false }) }

      const svc = new MigrationService({ storage: mockStorage, logger: mockLogger, steps: [stepA, stepB, stepC] })
      const report = await svc.migrate('1.0.0', '2.0.0')

      expect(report.success).toBe(true)
      expect(report.executed.map(e => e.id)).toEqual(['a', 'c'])
      expect(report.skipped).toEqual(['b'])
      expect(stepB.run).not.toHaveBeenCalled()
      expect(stepA.run).toHaveBeenCalledWith(mockStorage, mockLogger)
    })

    it('step.run 拋例外時應中止後續並回報 failed', async () => {
      const failing = { id: 'fail', applies: () => true, run: jest.fn().mockRejectedValue(new Error('boom')) }
      const after = { id: 'after', applies: () => true, run: jest.fn() }

      const svc = new MigrationService({ storage: mockStorage, logger: mockLogger, steps: [failing, after] })
      const report = await svc.migrate('1.0.0', '2.0.0')

      expect(report.success).toBe(false)
      expect(report.failed).toEqual({ id: 'fail', phase: 'run', error: 'boom' })
      expect(after.run).not.toHaveBeenCalled()
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('boom'))
    })

    it('step.run 回傳 { error } 時應中止後續並回報 failed', async () => {
      const failing = { id: 'soft-fail', applies: () => true, run: jest.fn().mockResolvedValue({ migrated: false, error: 'quota' }) }
      const after = { id: 'after', applies: () => true, run: jest.fn() }

      const svc = new MigrationService({ storage: mockStorage, logger: mockLogger, steps: [failing, after] })
      const report = await svc.migrate('1.0.0', '2.0.0')

      expect(report.success).toBe(false)
      expect(report.failed).toEqual({ id: 'soft-fail', phase: 'run', error: 'quota' })
      expect(after.run).not.toHaveBeenCalled()
    })

    it('step.applies 拋例外時應記錄 phase=applies 並中止', async () => {
      const broken = {
        id: 'broken-applies',
        applies: jest.fn(() => { throw new Error('bad-version') }),
        run: jest.fn()
      }
      const svc = new MigrationService({ storage: mockStorage, logger: mockLogger, steps: [broken] })
      const report = await svc.migrate('x', 'y')

      expect(report.success).toBe(false)
      expect(report.failed).toEqual({ id: 'broken-applies', phase: 'applies', error: 'bad-version' })
      expect(broken.run).not.toHaveBeenCalled()
    })

    it('report 應記錄 previousVersion 與 currentVersion', async () => {
      const svc = new MigrationService({ storage: mockStorage, logger: mockLogger, steps: [] })
      const report = await svc.migrate('0.17.0', '0.18.0')
      expect(report.previousVersion).toBe('0.17.0')
      expect(report.currentVersion).toBe('0.18.0')
      expect(report.success).toBe(true)
    })

    it('lastRunReport 應反映最近一次執行結果', async () => {
      const svc = new MigrationService({ storage: mockStorage, logger: mockLogger, steps: [] })
      const report = await svc.migrate(null, '0.18.0')
      expect(svc.lastRunReport).toBe(report)
    })
  })

  describe('migrate - 預設 v1-to-v2 整合', () => {
    it('storage 已 schema_version=3.0.0 時 v1-to-v2 應跳過遷移', async () => {
      const storage = createMockStorage({
        schema_version: '3.0.0',
        readmoo_books: []
      })
      const svc = new MigrationService({ storage, logger: mockLogger })
      const report = await svc.migrate('0.17.0', '0.18.0')

      expect(report.success).toBe(true)
      expect(report.executed).toHaveLength(1)
      const v1ToV2 = report.executed.find(e => e.id === 'v1-to-v2')
      expect(v1ToV2.result.migrated).toBe(false)
      expect(v1ToV2.result.reason).toBe('already_migrated')
    })

    it('schema_version 未設定時應觸發遷移並寫入新版本', async () => {
      const storage = createMockStorage({
        readmoo_books: [
          { id: 'b1', title: 't1', isNew: true, isFinished: false, progress: 0 }
        ]
      })
      const svc = new MigrationService({ storage, logger: mockLogger })
      const report = await svc.migrate(null, '0.18.0')

      expect(report.success).toBe(true)
      const v1ToV2 = report.executed.find(e => e.id === 'v1-to-v2')
      expect(v1ToV2.result.migrated).toBe(true)
      expect(storage._store.schema_version).toBe('3.0.0')
      expect(storage._store.readmoo_books[0]).toMatchObject({
        id: 'b1',
        readingStatus: expect.any(String),
        tagIds: []
      })
    })
  })
})
