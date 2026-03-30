/**
 * UC-07 替代流程 7a: 資料不一致偵測與恢復測試
 * TDD Red Phase - 測試呼叫尚不存在的方法，預期失敗
 *
 * 涵蓋 UC-07 7a 流程：
 * - 7a1: 資料不一致偵測（DATA_ERROR, SEVERE）
 * - 7a2: 完整性檢查（邏輯一致性、外鍵約束、孤立記錄）
 * - 7a3: 自動修復策略
 * - 7a4: 使用者介入（標記無法自動修復的問題）
 * - 7a5: 預防機制（驗證規則阻止不一致資料寫入）
 *
 * 測試對象：ReadmooDataConsistencyService
 * 測試階段：Red Phase（方法尚未實作）
 */

const ReadmooDataConsistencyService = require('src/background/domains/data-management/services/readmoo-data-consistency-service')

describe('UC-07 7a: 資料不一致偵測與恢復流程', () => {
  let service
  let mockEventBus
  let mockLogger

  beforeEach(() => {
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

  // =========================================================================
  // 7a1: 資料不一致偵測
  // =========================================================================
  describe('7a1: 資料不一致偵測', () => {
    test('detectDataInconsistencies() 應該偵測書籍記錄缺少必要欄位', async () => {
      // 準備：書籍缺少 title 和 id
      const books = [
        { id: 'book-1', title: '正常書籍', authors: ['作者A'], status: 'READING' },
        { id: '', title: '缺少ID的書', authors: ['作者B'], status: 'READING' },
        { id: 'book-3', title: '', authors: ['作者C'], status: 'COMPLETED' }
      ]

      const result = await service.detectDataInconsistencies(books)

      expect(result).toBeDefined()
      expect(result.inconsistencies).toBeInstanceOf(Array)
      expect(result.inconsistencies.length).toBeGreaterThanOrEqual(2)
      expect(result.severity).toBe('SEVERE')
    })

    test('detectDataInconsistencies() 應該偵測借閱狀態與日期邏輯不一致', async () => {
      // 準備：COMPLETED 狀態但沒有完成日期；READING 狀態但有完成日期
      const books = [
        {
          id: 'book-1',
          title: '已完成但無完成日期',
          status: 'COMPLETED',
          startDate: '2025-01-01',
          completedDate: null
        },
        {
          id: 'book-2',
          title: '閱讀中但有完成日期',
          status: 'READING',
          startDate: '2025-01-01',
          completedDate: '2025-02-01'
        },
        {
          id: 'book-3',
          title: '完成日期早於開始日期',
          status: 'COMPLETED',
          startDate: '2025-03-01',
          completedDate: '2025-01-01'
        }
      ]

      const result = await service.detectDataInconsistencies(books)

      expect(result.inconsistencies).toBeInstanceOf(Array)
      expect(result.inconsistencies.length).toBeGreaterThanOrEqual(3)

      // 每個不一致項目應包含類型和描述
      for (const issue of result.inconsistencies) {
        expect(issue).toHaveProperty('type')
        expect(issue).toHaveProperty('bookId')
        expect(issue).toHaveProperty('description')
        expect(issue).toHaveProperty('severity')
      }
    })

    test('detectDataInconsistencies() 無不一致時應回傳空結果', async () => {
      const books = [
        {
          id: 'book-1',
          title: '正常書籍',
          authors: ['作者A'],
          status: 'READING',
          startDate: '2025-01-01',
          completedDate: null
        }
      ]

      const result = await service.detectDataInconsistencies(books)

      expect(result.inconsistencies).toEqual([])
      expect(result.severity).toBeNull()
    })

    test('detectDataInconsistencies() 應該觸發 DATA_ERROR 事件（嚴重程度 SEVERE）', async () => {
      const books = [
        { id: '', title: '', authors: null, status: 'INVALID' }
      ]

      await service.detectDataInconsistencies(books)

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'DATA.ERROR',
        expect.objectContaining({
          severity: 'SEVERE',
          type: 'DATA_INCONSISTENCY'
        })
      )
    })
  })

  // =========================================================================
  // 7a2: 完整性檢查機制
  // =========================================================================
  describe('7a2: 完整性檢查機制', () => {
    describe('邏輯一致性檢查', () => {
      test('checkLogicalConsistency() 應該驗證進度值在合理範圍', async () => {
        const books = [
          { id: 'book-1', title: 'A', progress: 150, status: 'READING' },
          { id: 'book-2', title: 'B', progress: -10, status: 'READING' },
          { id: 'book-3', title: 'C', progress: 50, status: 'READING' }
        ]

        const result = await service.checkLogicalConsistency(books)

        expect(result.issues).toBeInstanceOf(Array)
        expect(result.issues.length).toBe(2)
        expect(result.issues[0].type).toBe('INVALID_PROGRESS_VALUE')
      })

      test('checkLogicalConsistency() 應該驗證評分在有效範圍', async () => {
        const books = [
          { id: 'book-1', title: 'A', rating: 6, status: 'COMPLETED' },
          { id: 'book-2', title: 'B', rating: -1, status: 'COMPLETED' }
        ]

        const result = await service.checkLogicalConsistency(books)

        expect(result.issues.length).toBeGreaterThanOrEqual(2)
        expect(result.issues.some(issue => issue.type === 'INVALID_RATING_VALUE')).toBe(true)
      })
    })

    describe('外鍵約束檢查', () => {
      test('checkForeignKeyConstraints() 應該偵測引用不存在分類的書籍', async () => {
        const books = [
          { id: 'book-1', title: 'A', categoryId: 'cat-1' },
          { id: 'book-2', title: 'B', categoryId: 'cat-999' }
        ]
        const categories = [
          { id: 'cat-1', name: '小說' }
        ]

        const result = await service.checkForeignKeyConstraints(books, { categories })

        expect(result.violations).toBeInstanceOf(Array)
        expect(result.violations.length).toBe(1)
        expect(result.violations[0]).toMatchObject({
          type: 'FOREIGN_KEY_VIOLATION',
          bookId: 'book-2',
          field: 'categoryId',
          referencedId: 'cat-999'
        })
      })

      test('checkForeignKeyConstraints() 應該偵測引用不存在書架的書籍', async () => {
        const books = [
          { id: 'book-1', title: 'A', shelfId: 'shelf-1' },
          { id: 'book-2', title: 'B', shelfId: 'shelf-deleted' }
        ]
        const shelves = [
          { id: 'shelf-1', name: '我的書架' }
        ]

        const result = await service.checkForeignKeyConstraints(books, { shelves })

        expect(result.violations.length).toBe(1)
        expect(result.violations[0].field).toBe('shelfId')
      })
    })

    describe('孤立記錄偵測', () => {
      test('detectOrphanRecords() 應該識別沒有對應書籍的閱讀記錄', async () => {
        const books = [
          { id: 'book-1', title: '存在的書' }
        ]
        const readingRecords = [
          { id: 'record-1', bookId: 'book-1', progress: 50 },
          { id: 'record-2', bookId: 'book-deleted', progress: 30 },
          { id: 'record-3', bookId: 'book-removed', progress: 80 }
        ]

        const result = await service.detectOrphanRecords(books, readingRecords)

        expect(result.orphans).toBeInstanceOf(Array)
        expect(result.orphans.length).toBe(2)
        expect(result.orphans[0]).toMatchObject({
          type: 'ORPHAN_READING_RECORD',
          recordId: 'record-2',
          referencedBookId: 'book-deleted'
        })
      })

      test('detectOrphanRecords() 應該識別沒有對應書籍的標籤關聯', async () => {
        const books = [
          { id: 'book-1', title: '存在的書' }
        ]
        const bookTags = [
          { bookId: 'book-1', tagId: 'tag-1' },
          { bookId: 'book-gone', tagId: 'tag-2' }
        ]

        const result = await service.detectOrphanRecords(books, bookTags)

        expect(result.orphans.length).toBe(1)
        expect(result.orphans[0].type).toBe('ORPHAN_TAG_ASSOCIATION')
      })

      test('detectOrphanRecords() 無孤立記錄時應回傳空結果', async () => {
        const books = [
          { id: 'book-1', title: '存在的書' }
        ]
        const readingRecords = [
          { id: 'record-1', bookId: 'book-1', progress: 50 }
        ]

        const result = await service.detectOrphanRecords(books, readingRecords)

        expect(result.orphans).toEqual([])
      })
    })
  })

  // =========================================================================
  // 7a3: 自動修復策略
  // =========================================================================
  describe('7a3: 自動修復策略', () => {
    test('autoRepairInconsistencies() 應該修復明顯的進度值越界', async () => {
      const inconsistencies = [
        {
          type: 'INVALID_PROGRESS_VALUE',
          bookId: 'book-1',
          field: 'progress',
          currentValue: 150,
          severity: 'MEDIUM'
        },
        {
          type: 'INVALID_PROGRESS_VALUE',
          bookId: 'book-2',
          field: 'progress',
          currentValue: -10,
          severity: 'MEDIUM'
        }
      ]

      const result = await service.autoRepairInconsistencies(inconsistencies)

      expect(result.repaired).toBeInstanceOf(Array)
      expect(result.repaired.length).toBe(2)
      expect(result.repaired[0]).toMatchObject({
        bookId: 'book-1',
        field: 'progress',
        originalValue: 150,
        repairedValue: 100
      })
      expect(result.repaired[1]).toMatchObject({
        bookId: 'book-2',
        field: 'progress',
        originalValue: -10,
        repairedValue: 0
      })
    })

    test('autoRepairInconsistencies() 應該標記無法自動修復的問題', async () => {
      const inconsistencies = [
        {
          type: 'FOREIGN_KEY_VIOLATION',
          bookId: 'book-1',
          field: 'categoryId',
          referencedId: 'cat-999',
          severity: 'HIGH'
        },
        {
          type: 'ORPHAN_READING_RECORD',
          recordId: 'record-2',
          referencedBookId: 'book-deleted',
          severity: 'HIGH'
        }
      ]

      const result = await service.autoRepairInconsistencies(inconsistencies)

      expect(result.unresolved).toBeInstanceOf(Array)
      expect(result.unresolved.length).toBe(2)
      expect(result.unresolved[0]).toHaveProperty('reason')
      expect(result.unresolved[0].requiresUserIntervention).toBe(true)
    })

    test('autoRepairInconsistencies() 應該修復借閱狀態與日期的邏輯錯誤', async () => {
      const inconsistencies = [
        {
          type: 'STATUS_DATE_MISMATCH',
          bookId: 'book-1',
          field: 'completedDate',
          currentStatus: 'READING',
          currentDate: '2025-02-01',
          severity: 'MEDIUM'
        }
      ]

      const result = await service.autoRepairInconsistencies(inconsistencies)

      // READING 狀態不應有完成日期 -> 自動清除
      expect(result.repaired.length).toBe(1)
      expect(result.repaired[0]).toMatchObject({
        bookId: 'book-1',
        field: 'completedDate',
        repairedValue: null
      })
    })

    test('autoRepairInconsistencies() 應該回傳修復摘要報告', async () => {
      const inconsistencies = [
        { type: 'INVALID_PROGRESS_VALUE', bookId: 'book-1', field: 'progress', currentValue: 150, severity: 'MEDIUM' },
        { type: 'FOREIGN_KEY_VIOLATION', bookId: 'book-2', field: 'categoryId', referencedId: 'cat-999', severity: 'HIGH' }
      ]

      const result = await service.autoRepairInconsistencies(inconsistencies)

      expect(result).toHaveProperty('repaired')
      expect(result).toHaveProperty('unresolved')
      expect(result).toHaveProperty('summary')
      expect(result.summary).toMatchObject({
        totalIssues: 2,
        autoRepaired: expect.any(Number),
        requiresIntervention: expect.any(Number)
      })
    })
  })

  // =========================================================================
  // 7a4: 使用者介入（錯誤報告與建議修復方案）
  // =========================================================================
  describe('7a4: 使用者介入報告', () => {
    test('generateInconsistencyReport() 應該產生詳細的錯誤報告', async () => {
      const unresolvedIssues = [
        {
          type: 'FOREIGN_KEY_VIOLATION',
          bookId: 'book-1',
          field: 'categoryId',
          referencedId: 'cat-999',
          severity: 'HIGH',
          reason: '引用的分類不存在'
        }
      ]

      const report = await service.generateInconsistencyReport(unresolvedIssues)

      expect(report).toHaveProperty('issues')
      expect(report).toHaveProperty('recommendations')
      expect(report).toHaveProperty('timestamp')
      expect(report.issues.length).toBe(1)
      expect(report.recommendations).toBeInstanceOf(Array)
      expect(report.recommendations.length).toBeGreaterThan(0)
    })

    test('generateInconsistencyReport() 每個問題應包含建議修復方案', async () => {
      const unresolvedIssues = [
        {
          type: 'ORPHAN_READING_RECORD',
          recordId: 'record-1',
          referencedBookId: 'book-deleted',
          severity: 'HIGH',
          reason: '關聯書籍已刪除'
        }
      ]

      const report = await service.generateInconsistencyReport(unresolvedIssues)

      expect(report.issues[0]).toHaveProperty('suggestedAction')
      expect(typeof report.issues[0].suggestedAction).toBe('string')
    })
  })

  // =========================================================================
  // 7a5: 預防機制
  // =========================================================================
  describe('7a5: 預防機制', () => {
    test('validateBeforeWrite() 應該阻止不一致資料寫入', async () => {
      const invalidBook = {
        id: 'book-new',
        title: '',
        status: 'COMPLETED',
        completedDate: null,
        progress: 200
      }

      const result = await service.validateBeforeWrite(invalidBook)

      expect(result.isValid).toBe(false)
      expect(result.errors).toBeInstanceOf(Array)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    test('validateBeforeWrite() 應該允許一致的資料寫入', async () => {
      const validBook = {
        id: 'book-new',
        title: '有效書籍',
        authors: ['作者A'],
        status: 'READING',
        startDate: '2025-01-01',
        completedDate: null,
        progress: 50
      }

      const result = await service.validateBeforeWrite(validBook)

      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual([])
    })

    test('validateBeforeWrite() 應該驗證外鍵引用的有效性', async () => {
      const bookWithInvalidRef = {
        id: 'book-new',
        title: '有外鍵的書',
        authors: ['作者A'],
        status: 'READING',
        categoryId: 'cat-nonexistent'
      }

      const knownCategories = [{ id: 'cat-1', name: '小說' }]

      const result = await service.validateBeforeWrite(bookWithInvalidRef, {
        referenceData: { categories: knownCategories }
      })

      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.type === 'FOREIGN_KEY_VIOLATION')).toBe(true)
    })
  })

  // =========================================================================
  // 整合流程：完整不一致偵測與恢復
  // =========================================================================
  describe('整合流程：偵測 -> 檢查 -> 修復 -> 報告', () => {
    test('performIntegrityCheck() 應該執行完整的不一致偵測與恢復流程', async () => {
      const books = [
        { id: 'book-1', title: '正常書籍', status: 'READING', progress: 50 },
        { id: 'book-2', title: '', status: 'COMPLETED', progress: 150, completedDate: null },
        { id: 'book-3', title: '孤立引用', status: 'READING', categoryId: 'cat-deleted' }
      ]

      const referenceData = {
        categories: [{ id: 'cat-1', name: '小說' }],
        readingRecords: [
          { id: 'record-1', bookId: 'book-1', progress: 50 },
          { id: 'record-orphan', bookId: 'book-removed', progress: 30 }
        ]
      }

      const result = await service.performIntegrityCheck(books, referenceData)

      // 結果應包含所有階段
      expect(result).toHaveProperty('detection')
      expect(result).toHaveProperty('repair')
      expect(result).toHaveProperty('report')
      expect(result).toHaveProperty('timestamp')

      // 偵測階段應找到問題
      expect(result.detection.totalIssues).toBeGreaterThan(0)

      // 修復階段應有修復和未解決的分類
      expect(result.repair).toHaveProperty('repaired')
      expect(result.repair).toHaveProperty('unresolved')

      // 報告階段應有建議
      expect(result.report).toHaveProperty('recommendations')
    })

    test('performIntegrityCheck() 資料完全一致時應快速回傳', async () => {
      const books = [
        { id: 'book-1', title: '正常書籍', status: 'READING', progress: 50 }
      ]
      const referenceData = {
        categories: [],
        readingRecords: [
          { id: 'record-1', bookId: 'book-1', progress: 50 }
        ]
      }

      const result = await service.performIntegrityCheck(books, referenceData)

      expect(result.detection.totalIssues).toBe(0)
      expect(result.repair.repaired).toEqual([])
      expect(result.repair.unresolved).toEqual([])
    })
  })
})
