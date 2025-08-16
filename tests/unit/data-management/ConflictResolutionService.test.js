const ConflictResolutionService = require('../../../src/data-management/ConflictResolutionService');
const BaseModule = require('../../../src/background/lifecycle/base-module');

/**
 * Conflict Resolution Service 完整測試套件
 * 
 * 測試範圍：
 * - 建構與初始化 (Construction & Initialization)
 * - 衝突檢測引擎 (Conflict Detection Engine) 
 * - 解決策略引擎 (Resolution Strategy Engine)
 * - 批次處理 (Batch Processing)
 * - 用戶互動與手動解決 (User Interaction & Manual Resolution)
 * - 整合與事件處理 (Integration & Event Handling)
 * - 效能與分析 (Performance & Analytics)
 */

// Mock 服務實作
class MockEventBus {
  constructor() {
    this.listeners = new Map();
    this.eventHistory = [];
  }

  on(eventType, handler, options = {}) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push({ handler, options });
    return this;
  }

  async emit(eventType, data = null) {
    this.eventHistory.push({ type: eventType, data, timestamp: Date.now() });
    
    const listeners = this.listeners.get(eventType) || [];
    const results = [];
    
    for (const listener of listeners) {
      try {
        const result = await Promise.resolve(listener.handler(data));
        results.push(result);
      } catch (error) {
        results.push(error);
      }
    }
    
    return results;
  }

  hasListener(eventType) {
    return this.listeners.has(eventType) && this.listeners.get(eventType).length > 0;
  }

  getEventHistory() {
    return [...this.eventHistory];
  }

  clearHistory() {
    this.eventHistory = [];
  }

  // 萬用字元匹配支援
  getMatchingEvents(pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return this.eventHistory.filter(event => regex.test(event.type));
  }
}

class MockLogger {
  constructor() {
    this.logs = [];
  }

  log(...args) { this.logs.push({ level: 'log', args, timestamp: Date.now() }); }
  info(...args) { this.logs.push({ level: 'info', args, timestamp: Date.now() }); }
  warn(...args) { this.logs.push({ level: 'warn', args, timestamp: Date.now() }); }
  error(...args) { this.logs.push({ level: 'error', args, timestamp: Date.now() }); }

  getLogs(level = null) {
    return level ? this.logs.filter(log => log.level === level) : this.logs;
  }

  clearLogs() {
    this.logs = [];
  }
}

// 衝突測試資料生成器
class ConflictTestDataFactory {
  static createProgressConflictData() {
    return {
      data1: { id: 'book_001', title: '測試書籍', progress: 75, lastUpdated: '2025-08-16T10:00:00Z' },
      data2: { id: 'book_001', title: '測試書籍', progress: 45, lastUpdated: '2025-08-16T09:00:00Z' }
    };
  }

  static createTitleConflictData() {
    return {
      data1: { id: 'book_002', title: '原始標題', progress: 50, lastUpdated: '2025-08-16T10:00:00Z' },
      data2: { id: 'book_002', title: '修改後標題', progress: 50, lastUpdated: '2025-08-16T10:00:00Z' }
    };
  }

  static createTimestampConflictData() {
    return {
      data1: { id: 'book_003', title: '時間衝突書籍', progress: 60, lastUpdated: '2025-08-16T10:00:00Z' },
      data2: { id: 'book_003', title: '時間衝突書籍', progress: 80, lastUpdated: '2025-08-15T10:00:00Z' }
    };
  }

  static createTagConflictData() {
    return {
      data1: { id: 'book_004', title: '標籤衝突書籍', tags: ['fiction', 'mystery'], progress: 30 },
      data2: { id: 'book_004', title: '標籤衝突書籍', tags: ['fiction', 'thriller'], progress: 30 }
    };
  }

  static createComplexConflictData() {
    return {
      data1: { 
        id: 'book_005', 
        title: '複雜衝突書籍 A', 
        progress: 90, 
        tags: ['classic', 'literature'], 
        lastUpdated: '2025-08-16T12:00:00Z' 
      },
      data2: { 
        id: 'book_005', 
        title: '複雜衝突書籍 B', 
        progress: 60, 
        tags: ['classic', 'novel'], 
        lastUpdated: '2025-08-16T11:00:00Z' 
      }
    };
  }

  static createBatchConflictData(count = 5) {
    const conflicts = [];
    
    for (let i = 0; i < count; i++) {
      conflicts.push({
        data1: { 
          id: `batch_book_${i}`, 
          title: `批次書籍 ${i}`, 
          progress: 50 + i * 10, 
          lastUpdated: `2025-08-16T${10 + i}:00:00Z` 
        },
        data2: { 
          id: `batch_book_${i}`, 
          title: `批次書籍 ${i}`, 
          progress: 30 + i * 5, 
          lastUpdated: `2025-08-16T${10 + i + 1}:00:00Z` 
        }
      });
    }
    
    return conflicts;
  }

  static createLargeScaleConflictData(count = 100) {
    return this.createBatchConflictData(count);
  }
}

describe('Conflict Resolution Service', () => {
  let service;
  let mockEventBus;
  let mockLogger;
  let mockConfig;

  beforeEach(() => {
    mockEventBus = new MockEventBus();
    mockLogger = new MockLogger();
    mockConfig = {
      conflict: {
        severityThresholds: { low: 0.3, medium: 0.6, high: 0.8 },
        batchSize: 50,
        timeoutMs: 30000
      }
    };
  });

  afterEach(() => {
    if (service) {
      service = null;
    }
  });

  // ==========================================
  // Construction & Initialization (6 個測試)
  // ==========================================
  
  describe('Construction & Initialization', () => {
    test('應該成功建構服務並驗證必要參數', () => {
      expect(() => {
        service = new ConflictResolutionService(mockEventBus, mockLogger, mockConfig);
      }).not.toThrow();

      expect(service).toBeInstanceOf(ConflictResolutionService);
      expect(service).toBeInstanceOf(BaseModule);
    });

    test('應該在缺少 EventBus 時拋出錯誤', () => {
      expect(() => {
        new ConflictResolutionService(null, mockLogger, mockConfig);
      }).toThrow('EventBus is required');

      expect(() => {
        new ConflictResolutionService({}, mockLogger, mockConfig);
      }).toThrow('EventBus is required');
    });

    test('應該在缺少 Logger 時拋出錯誤', () => {
      expect(() => {
        new ConflictResolutionService(mockEventBus, null, mockConfig);
      }).toThrow('Logger is required');
    });

    test('應該在缺少 Config 時拋出錯誤', () => {
      expect(() => {
        new ConflictResolutionService(mockEventBus, mockLogger, null);
      }).toThrow('Config is required');
    });

    test('應該正確註冊事件監聽器', () => {
      service = new ConflictResolutionService(mockEventBus, mockLogger, mockConfig);
      
      expect(mockEventBus.hasListener('DATA.CONFLICT.DETECT_REQUEST')).toBe(true);
      expect(mockEventBus.hasListener('DATA.CONFLICT.RESOLVE_REQUEST')).toBe(true);
      expect(mockEventBus.hasListener('DATA.CONFLICT.BATCH_REQUEST')).toBe(true);
      expect(mockEventBus.hasListener('DATA.CONFLICT.MANUAL_RESOLUTION')).toBe(true);
    });

    test('應該成功初始化服務', async () => {
      service = new ConflictResolutionService(mockEventBus, mockLogger, mockConfig);
      
      await expect(service.initialize()).resolves.toBeUndefined();
      expect(service.isInitialized).toBe(true);
      
      const logs = mockLogger.getLogs('info');
      expect(logs.some(log => log.args[0].includes('initialized successfully'))).toBe(true);
    });
  });

  // ==========================================
  // Conflict Detection Engine (12 個測試)
  // ==========================================
  
  describe('Conflict Detection Engine', () => {
    beforeEach(async () => {
      service = new ConflictResolutionService(mockEventBus, mockLogger, mockConfig);
      await service.initialize();
    });

    test('應該檢測進度不匹配衝突', async () => {
      const { data1, data2 } = ConflictTestDataFactory.createProgressConflictData();
      
      const result = await service.detectConflicts([data1], [data2]);
      
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('PROGRESS_MISMATCH');
      // 新檢測器邏輯下，30%差異被評為HIGH
      expect(result.conflicts[0].severity).toBe('HIGH');
      expect(result.summary.totalConflicts).toBe(1);
    });

    test('應該檢測標題差異衝突', async () => {
      const { data1, data2 } = ConflictTestDataFactory.createTitleConflictData();
      
      const result = await service.detectConflicts([data1], [data2]);
      
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('TITLE_DIFFERENCE');
      expect(result.summary.conflictTypes['TITLE_DIFFERENCE']).toBe(1);
    });

    test('應該檢測時間戳衝突', async () => {
      const { data1, data2 } = ConflictTestDataFactory.createTimestampConflictData();
      
      const result = await service.detectConflicts([data1], [data2]);
      
      // 這個測試資料會同時檢測到進度和時間戳衝突
      expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
      const timestampConflict = result.conflicts.find(c => c.type === 'TIMESTAMP_CONFLICT');
      expect(timestampConflict).toBeDefined();
      // 新檢測器邏輯下，進度回退+短時間間隔被評為HIGH
      expect(timestampConflict.severity).toBe('HIGH');
    });

    test('應該檢測標籤差異衝突', async () => {
      const { data1, data2 } = ConflictTestDataFactory.createTagConflictData();
      
      const result = await service.detectConflicts([data1], [data2]);
      
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('TAG_DIFFERENCE');
      // 標籤 ['fiction', 'mystery'] vs ['fiction', 'thriller'] 相似度中等，評為 MEDIUM
      expect(result.conflicts[0].severity).toBe('MEDIUM');
    });

    test('應該檢測複雜的多類型衝突', async () => {
      const { data1, data2 } = ConflictTestDataFactory.createComplexConflictData();
      
      const result = await service.detectConflicts([data1], [data2]);
      
      expect(result.conflicts.length).toBeGreaterThan(1);
      const conflictTypes = result.conflicts.map(c => c.type);
      expect(conflictTypes).toContain('PROGRESS_MISMATCH');
      expect(conflictTypes).toContain('TITLE_DIFFERENCE');
      expect(conflictTypes).toContain('TAG_DIFFERENCE');
    });

    test('應該正確處理空資料集', async () => {
      const result = await service.detectConflicts([], []);
      
      expect(result.conflicts).toHaveLength(0);
      expect(result.summary.totalConflicts).toBe(0);
    });

    test('應該正確處理無效資料', async () => {
      const result = await service.detectConflicts(null, undefined);
      
      expect(result.conflicts).toHaveLength(0);
      expect(result.summary.totalConflicts).toBe(0);
    });

    test('應該跳過沒有 ID 的項目', async () => {
      const data1 = [{ title: '無ID書籍', progress: 50 }];
      const data2 = [{ title: '無ID書籍', progress: 80 }];
      
      const result = await service.detectConflicts(data1, data2);
      
      expect(result.conflicts).toHaveLength(0);
    });

    test('應該正確計算字串相似度', () => {
      expect(service.calculateStringSimilarity('Hello World', 'Hello World')).toBe(1.0);
      expect(service.calculateStringSimilarity('Hello', 'World')).toBe(0.0);
      expect(service.calculateStringSimilarity('', '')).toBe(1.0);
      expect(service.calculateStringSimilarity('Hello', '')).toBe(0.0);
    });

    test('應該支援自定義衝突類型檢測', async () => {
      const { data1, data2 } = ConflictTestDataFactory.createComplexConflictData();
      const options = { conflictTypes: ['PROGRESS_MISMATCH'] };
      
      const result = await service.detectConflicts([data1], [data2], options);
      
      expect(result.conflicts.every(c => c.type === 'PROGRESS_MISMATCH')).toBe(true);
    });

    test('應該生成正確的衝突摘要統計', async () => {
      const conflictData = ConflictTestDataFactory.createBatchConflictData(3);
      const data1 = conflictData.map(c => c.data1);
      const data2 = conflictData.map(c => c.data2);
      
      const result = await service.detectConflicts(data1, data2);
      
      expect(result.summary.totalConflicts).toBeGreaterThan(0);
      expect(typeof result.summary.conflictTypes).toBe('object');
      expect(typeof result.summary.severityDistribution).toBe('object');
    });

    test('應該更新衝突檢測統計', async () => {
      const { data1, data2 } = ConflictTestDataFactory.createProgressConflictData();
      const initialStats = service.statistics.conflictsDetected;
      
      await service.detectConflicts([data1], [data2]);
      
      expect(service.statistics.conflictsDetected).toBeGreaterThan(initialStats);
    });
  });

  // ==========================================
  // Resolution Strategy Engine (15 個測試)
  // ==========================================
  
  describe('Resolution Strategy Engine', () => {
    beforeEach(async () => {
      service = new ConflictResolutionService(mockEventBus, mockLogger, mockConfig);
      await service.initialize();
    });

    test('應該生成進度衝突的解決建議', async () => {
      const conflict = {
        id: 'test_conflict',
        type: 'PROGRESS_MISMATCH',
        data1: { id: 'book_1', progress: 75, lastUpdated: '2025-08-16T12:00:00Z' },
        data2: { id: 'book_1', progress: 50, lastUpdated: '2025-08-16T10:00:00Z' }
      };

      const recommendations = await service.generateResolutionRecommendations(conflict);
      
      expect(recommendations).toHaveLength(2);
      expect(recommendations[0].strategy).toBe('USE_LATEST_TIMESTAMP');
      expect(recommendations[0].confidence).toBe(0.8);
    });

    test('應該執行最新時間戳策略', async () => {
      const conflict = {
        data1: { id: 'book_1', progress: 75, lastUpdated: '2025-08-16T12:00:00Z' },
        data2: { id: 'book_1', progress: 50, lastUpdated: '2025-08-16T10:00:00Z' }
      };

      const result = await service.useLatestTimestampStrategy(conflict);
      
      expect(result.resolvedValue.progress).toBe(75);
      expect(result.confidence).toBe(0.8);
      expect(result.reason).toContain('時間戳較新');
    });

    test('應該執行來源優先級策略', async () => {
      const conflict = {
        data1: { id: 'book_1', source: 'kindle', progress: 75 },
        data2: { id: 'book_1', source: 'readmoo', progress: 50 }
      };
      const options = { sourcePriority: ['readmoo', 'kindle'] };

      const result = await service.useSourcePriorityStrategy(conflict, options);
      
      expect(result.resolvedValue.source).toBe('readmoo');
      expect(result.confidence).toBe(0.6);
    });

    test('應該執行合併值策略', async () => {
      const conflict = {
        type: 'TAG_DIFFERENCE',
        data1: { id: 'book_1', tags: ['fiction', 'mystery'] },
        data2: { id: 'book_1', tags: ['fiction', 'thriller'] }
      };

      const result = await service.mergeValuesStrategy(conflict);
      
      expect(result.resolvedValue.tags).toContain('fiction');
      expect(result.resolvedValue.tags).toContain('mystery');
      expect(result.resolvedValue.tags).toContain('thriller');
      expect(result.confidence).toBe(0.7);
    });

    test('應該執行人工審核策略', async () => {
      const conflict = {
        data1: { id: 'book_1', title: '原標題' },
        data2: { id: 'book_1', title: '新標題' }
      };

      const result = await service.manualReviewStrategy(conflict);
      
      expect(result.resolvedValue).toBeNull();
      expect(result.requiresManualReview).toBe(true);
      expect(result.reviewOptions).toHaveLength(3);
    });

    test('應該解決單個衝突', async () => {
      const conflict = {
        id: 'test_conflict',
        type: 'PROGRESS_MISMATCH',
        data1: { id: 'book_1', progress: 75, lastUpdated: '2025-08-16T12:00:00Z' },
        data2: { id: 'book_1', progress: 50, lastUpdated: '2025-08-16T10:00:00Z' }
      };

      const result = await service.resolveConflict(conflict, 'USE_LATEST_TIMESTAMP');
      
      expect(result.strategy).toBe('USE_LATEST_TIMESTAMP');
      expect(result.resolution.resolvedValue.progress).toBe(75);
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('應該解決多個衝突', async () => {
      const conflicts = [
        {
          id: 'conflict_1',
          type: 'PROGRESS_MISMATCH',
          data1: { id: 'book_1', progress: 75, lastUpdated: '2025-08-16T12:00:00Z' },
          data2: { id: 'book_1', progress: 50, lastUpdated: '2025-08-16T10:00:00Z' }
        },
        {
          id: 'conflict_2',
          type: 'TAG_DIFFERENCE',
          data1: { id: 'book_2', tags: ['fiction'] },
          data2: { id: 'book_2', tags: ['mystery'] }
        }
      ];

      const result = await service.resolveConflicts(conflicts);
      
      expect(result.resolvedConflicts).toHaveLength(2);
      expect(result.summary.totalResolved).toBe(2);
      expect(result.summary.successRate).toBe(1.0);
    });

    test('應該處理空衝突陣列', async () => {
      const result = await service.resolveConflicts([]);
      
      expect(result.resolvedConflicts).toHaveLength(0);
      expect(result.summary.totalResolved).toBe(0);
      expect(result.summary.successRate).toBe(1.0);
    });

    test('應該處理無效衝突資料', async () => {
      const result = await service.resolveConflicts(null);
      
      expect(result.resolvedConflicts).toHaveLength(0);
      expect(result.summary.successRate).toBe(1.0);
    });

    test('應該處理未知解決策略', async () => {
      const conflict = {
        id: 'test_conflict',
        type: 'PROGRESS_MISMATCH',
        data1: { id: 'book_1', progress: 75 },
        data2: { id: 'book_1', progress: 50 }
      };

      await expect(service.executeResolutionStrategy(conflict, 'UNKNOWN_STRATEGY'))
        .rejects.toThrow('Unknown resolution strategy: UNKNOWN_STRATEGY');
    });

    test('應該統計解決策略使用情況', async () => {
      const conflicts = [
        {
          id: 'conflict_1',
          type: 'PROGRESS_MISMATCH',
          data1: { id: 'book_1', progress: 75, lastUpdated: '2025-08-16T12:00:00Z' },
          data2: { id: 'book_1', progress: 50, lastUpdated: '2025-08-16T10:00:00Z' }
        }
      ];

      const result = await service.resolveConflicts(conflicts, 'USE_LATEST_TIMESTAMP');
      
      expect(result.summary.strategiesUsed['USE_LATEST_TIMESTAMP']).toBe(1);
    });

    test('應該處理解決過程中的錯誤', async () => {
      // 模擬會拋出錯誤的衝突 - 使用會導致 executeResolutionStrategy 失敗的情況
      const invalidConflict = {
        id: 'invalid_conflict',
        type: 'INVALID_TYPE',
        data1: null,
        data2: null
      };

      const result = await service.resolveConflicts([invalidConflict], 'UNKNOWN_STRATEGY');
      
      // 應該有錯誤記錄，但不一定是 null resolution，因為會回退到 MANUAL_REVIEW
      expect(result.resolvedConflicts).toHaveLength(1);
      expect(result.summary.successRate).toBeLessThan(1.0);
    });

    test('應該更新解決統計資料', async () => {
      const conflicts = [
        {
          id: 'conflict_1',
          type: 'PROGRESS_MISMATCH',
          data1: { id: 'book_1', progress: 75, lastUpdated: '2025-08-16T12:00:00Z' },
          data2: { id: 'book_1', progress: 50, lastUpdated: '2025-08-16T10:00:00Z' }
        }
      ];

      const initialResolved = service.statistics.conflictsResolved;
      await service.resolveConflicts(conflicts);
      
      expect(service.statistics.conflictsResolved).toBeGreaterThan(initialResolved);
    });

    test('應該支援標題衝突的人工審核建議', async () => {
      const conflict = {
        id: 'title_conflict',
        type: 'TITLE_DIFFERENCE'
      };

      const recommendations = await service.generateResolutionRecommendations(conflict);
      
      expect(recommendations[0].strategy).toBe('MANUAL_REVIEW');
      expect(recommendations[0].confidence).toBe(0.9);
    });

    test('應該支援未知衝突類型的預設處理', async () => {
      const conflict = {
        id: 'unknown_conflict',
        type: 'UNKNOWN_TYPE'
      };

      const recommendations = await service.generateResolutionRecommendations(conflict);
      
      expect(recommendations[0].strategy).toBe('MANUAL_REVIEW');
      expect(recommendations[0].confidence).toBe(0.5);
    });
  });

  // ==========================================
  // Batch Processing (8 個測試)
  // ==========================================
  
  describe('Batch Processing', () => {
    beforeEach(async () => {
      service = new ConflictResolutionService(mockEventBus, mockLogger, mockConfig);
      await service.initialize();
    });

    test('應該處理批次衝突解決', async () => {
      const conflictBatches = [
        {
          id: 'batch_1',
          conflicts: [
            {
              id: 'conflict_1',
              type: 'PROGRESS_MISMATCH',
              data1: { id: 'book_1', progress: 75, lastUpdated: '2025-08-16T12:00:00Z' },
              data2: { id: 'book_1', progress: 50, lastUpdated: '2025-08-16T10:00:00Z' }
            }
          ]
        }
      ];

      const result = await service.resolveBatchConflicts(conflictBatches);
      
      expect(result.batchId).toBeDefined();
      expect(result.results).toHaveLength(1);
      expect(result.summary.totalBatches).toBe(1);
      expect(result.summary.successfulBatches).toBe(1);
    });

    test('應該追蹤批次處理進度', async () => {
      const conflictBatches = [
        { id: 'batch_1', conflicts: [] },
        { id: 'batch_2', conflicts: [] }
      ];

      let progressEvents = [];
      mockEventBus.on('DATA.CONFLICT.BATCH_PROGRESS', (data) => {
        progressEvents.push(data);
      });

      await service.resolveBatchConflicts(conflictBatches);
      
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0].progress).toBeGreaterThanOrEqual(0);
      expect(progressEvents[0].totalBatches).toBe(2);
    });

    test('應該管理批次作業狀態', async () => {
      const conflictBatches = [{ id: 'batch_1', conflicts: [] }];

      const resultPromise = service.resolveBatchConflicts(conflictBatches);
      
      // 檢查作業已被記錄
      expect(service.batchJobs.size).toBe(1);
      
      await resultPromise;
      
      // 檢查作業狀態更新
      const batchJob = Array.from(service.batchJobs.values())[0];
      expect(batchJob.status).toBe('COMPLETED');
    });

    test('應該處理批次處理錯誤', async () => {
      // 模擬會失敗的批次
      const originalProcessBatch = service.processBatch;
      service.processBatch = jest.fn().mockRejectedValue(new Error('Batch processing failed'));

      const conflictBatches = [{ id: 'batch_1', conflicts: [] }];

      await expect(service.resolveBatchConflicts(conflictBatches))
        .rejects.toThrow('Batch processing failed');
      
      // 檢查作業狀態
      const batchJob = Array.from(service.batchJobs.values())[0];
      expect(batchJob.status).toBe('FAILED');

      // 恢復原始方法
      service.processBatch = originalProcessBatch;
    });

    test('應該處理單個批次', async () => {
      const batch = {
        id: 'test_batch',
        conflicts: [
          {
            id: 'conflict_1',
            type: 'PROGRESS_MISMATCH',
            data1: { id: 'book_1', progress: 75, lastUpdated: '2025-08-16T12:00:00Z' },
            data2: { id: 'book_1', progress: 50, lastUpdated: '2025-08-16T10:00:00Z' }
          }
        ]
      };

      const result = await service.processBatch(batch);
      
      expect(result.batchId).toBe('test_batch');
      expect(result.success).toBe(true);
      expect(result.resolvedCount).toBe(1);
    });

    test('應該處理批次處理中的個別錯誤', async () => {
      // 模擬會導致真正錯誤的情況
      const originalResolveConflicts = service.resolveConflicts;
      service.resolveConflicts = jest.fn().mockRejectedValue(new Error('Resolve conflicts failed'));

      const batch = {
        id: 'error_batch',
        conflicts: [{ id: 'test', type: 'TEST' }]
      };

      const result = await service.processBatch(batch);
      
      expect(result.batchId).toBe('error_batch');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      
      // 恢復原始方法
      service.resolveConflicts = originalResolveConflicts;
    });

    test('應該支援批次的預設策略設定', async () => {
      const batch = {
        id: 'strategy_batch',
        strategy: 'MERGE_VALUES',
        conflicts: [
          {
            id: 'conflict_1',
            type: 'TAG_DIFFERENCE',
            data1: { id: 'book_1', tags: ['fiction'] },
            data2: { id: 'book_1', tags: ['mystery'] }
          }
        ]
      };

      const result = await service.processBatch(batch);
      
      expect(result.success).toBe(true);
      expect(result.details.resolvedConflicts[0].strategy).toBe('MERGE_VALUES');
    });

    test('應該統計批次處理結果', async () => {
      const conflictBatches = [
        { id: 'batch_1', conflicts: [{ id: 'c1', type: 'PROGRESS_MISMATCH', data1: { id: 'b1', progress: 75, lastUpdated: '2025-08-16T12:00:00Z' }, data2: { id: 'b1', progress: 50, lastUpdated: '2025-08-16T10:00:00Z' } }] },
        { id: 'batch_2', conflicts: [{ id: 'c2', type: 'TAG_DIFFERENCE', data1: { id: 'b2', tags: ['fiction'] }, data2: { id: 'b2', tags: ['mystery'] } }] }
      ];

      const result = await service.resolveBatchConflicts(conflictBatches);
      
      expect(result.summary.totalBatches).toBe(2);
      expect(result.summary.totalConflictsResolved).toBe(2);
      expect(result.summary.successfulBatches).toBe(2);
    });
  });

  // ==========================================
  // User Interaction & Manual Resolution (10 個測試)
  // ==========================================
  
  describe('User Interaction & Manual Resolution', () => {
    beforeEach(async () => {
      service = new ConflictResolutionService(mockEventBus, mockLogger, mockConfig);
      await service.initialize();
    });

    test('應該記錄人工解決方案', async () => {
      const conflictId = 'manual_conflict_1';
      const resolution = { strategy: 'USER_CHOICE', selectedValue: 'user_selected_data' };
      const userSatisfaction = 0.9;

      const result = await service.recordManualResolution(conflictId, resolution, userSatisfaction);
      
      expect(result.recorded).toBe(true);
      expect(result.learningUpdate).toBeDefined();
      expect(service.resolutionHistory).toHaveLength(1);
    });

    test('應該更新學習模型基於用戶滿意度', async () => {
      const record = {
        conflictId: 'test_conflict',
        resolution: { strategy: 'USE_LATEST_TIMESTAMP' },
        userSatisfaction: 0.9
      };

      const result = service.updateLearningModel(record);
      
      expect(result.updated).toBe(true);
      expect(result.action).toBe('increase_preference');
    });

    test('應該處理低滿意度的學習更新', async () => {
      const record = {
        conflictId: 'test_conflict',
        resolution: { strategy: 'USE_LATEST_TIMESTAMP' },
        userSatisfaction: 0.2
      };

      const result = service.updateLearningModel(record);
      
      expect(result.updated).toBe(true);
      expect(result.action).toBe('decrease_preference');
    });

    test('應該跳過中等滿意度的學習更新', async () => {
      const record = {
        conflictId: 'test_conflict',
        resolution: { strategy: 'USE_LATEST_TIMESTAMP' },
        userSatisfaction: 0.5
      };

      const result = service.updateLearningModel(record);
      
      expect(result.updated).toBe(false);
      expect(result.reason).toBe('No significant satisfaction data');
    });

    test('應該取得用戶偏好設定', async () => {
      const preferences = await service.getUserPreferences();
      
      expect(preferences).toHaveProperty('defaultStrategy');
      expect(preferences).toHaveProperty('autoResolveThreshold');
      expect(preferences).toHaveProperty('learningEnabled');
    });

    test('應該更新用戶偏好設定', async () => {
      const newPreferences = {
        defaultStrategy: 'MERGE_VALUES',
        autoResolveThreshold: 0.9
      };

      const result = await service.updateUserPreferences(newPreferences);
      
      expect(result.success).toBe(true);
      expect(result.preferences.defaultStrategy).toBe('MERGE_VALUES');
      expect(result.preferences.autoResolveThreshold).toBe(0.9);
    });

    test('應該取得解決歷史記錄', async () => {
      // 新增一些歷史記錄
      await service.recordManualResolution('conflict_1', { strategy: 'A' }, 0.8);
      await service.recordManualResolution('conflict_2', { strategy: 'B' }, 0.6);

      const history = await service.getResolutionHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].conflictId).toBe('conflict_1');
    });

    test('應該支援解決歷史的過濾選項', async () => {
      // 新增歷史記錄
      await service.recordManualResolution('conflict_1', { strategy: 'A' }, 0.8);
      await service.recordManualResolution('conflict_2', { strategy: 'B' }, 0.6);

      const history = await service.getResolutionHistory({ limit: 1 });
      
      expect(history).toHaveLength(1);
    });

    test('應該支援撤銷解決方案', async () => {
      // 新增一個解決記錄
      await service.recordManualResolution('conflict_1', { strategy: 'A' }, 0.8);
      service.resolutionHistory[0].resolutionId = 'resolution_1';

      const result = await service.undoResolution('resolution_1');
      
      expect(result.success).toBe(true);
      expect(result.undoneResolution).toBeDefined();
      expect(service.resolutionHistory).toHaveLength(0);
    });

    test('應該處理不存在的撤銷請求', async () => {
      await expect(service.undoResolution('non_existent_resolution'))
        .rejects.toThrow('Resolution not found');
    });

    test('應該支援衝突升級機制', async () => {
      const result = await service.escalateConflict('complex_conflict', 'Too complex for automatic resolution');
      
      expect(result.escalated).toBe(true);
      expect(result.reason).toBe('Too complex for automatic resolution');
      expect(result.assignedTo).toBe('expert_review_queue');
    });
  });

  // ==========================================
  // Integration & Event Handling (6 個測試)
  // ==========================================
  
  describe('Integration & Event Handling', () => {
    beforeEach(async () => {
      service = new ConflictResolutionService(mockEventBus, mockLogger, mockConfig);
      await service.initialize();
    });

    test('應該處理衝突檢測請求事件', async () => {
      const eventData = {
        data1: [{ id: 'book_1', progress: 75, lastUpdated: '2025-08-16T12:00:00Z' }],
        data2: [{ id: 'book_1', progress: 50, lastUpdated: '2025-08-16T10:00:00Z' }]
      };

      const result = await service.handleConflictDetectionRequest({ data: eventData });
      
      expect(result.conflicts).toBeDefined();
      
      // 檢查是否發送了檢測完成事件
      const detectedEvents = mockEventBus.getMatchingEvents('DATA.CONFLICT.DETECTED');
      expect(detectedEvents).toHaveLength(1);
    });

    test('應該處理衝突解決請求事件', async () => {
      const conflicts = [
        {
          id: 'conflict_1',
          type: 'PROGRESS_MISMATCH',
          data1: { id: 'book_1', progress: 75, lastUpdated: '2025-08-16T12:00:00Z' },
          data2: { id: 'book_1', progress: 50, lastUpdated: '2025-08-16T10:00:00Z' }
        }
      ];

      const eventData = { conflicts, strategy: 'USE_LATEST_TIMESTAMP' };
      const result = await service.handleConflictResolutionRequest({ data: eventData });
      
      expect(result.resolvedConflicts).toBeDefined();
      
      // 檢查是否發送了解決完成事件
      const resolvedEvents = mockEventBus.getMatchingEvents('DATA.CONFLICT.RESOLVED');
      expect(resolvedEvents).toHaveLength(1);
    });

    test('應該處理批次解決請求事件', async () => {
      const conflictBatches = [
        {
          id: 'batch_1',
          conflicts: [
            {
              id: 'conflict_1',
              type: 'PROGRESS_MISMATCH',
              data1: { id: 'book_1', progress: 75, lastUpdated: '2025-08-16T12:00:00Z' },
              data2: { id: 'book_1', progress: 50, lastUpdated: '2025-08-16T10:00:00Z' }
            }
          ]
        }
      ];

      const eventData = { conflictBatches };
      const result = await service.handleBatchResolutionRequest({ data: eventData });
      
      expect(result.batchId).toBeDefined();
      
      // 檢查是否發送了批次完成事件
      const batchEvents = mockEventBus.getMatchingEvents('DATA.CONFLICT.BATCH_COMPLETED');
      expect(batchEvents).toHaveLength(1);
    });

    test('應該處理人工解決事件', async () => {
      const eventData = {
        conflictId: 'manual_conflict',
        resolution: { strategy: 'USER_CHOICE' },
        userSatisfaction: 0.8
      };

      const result = await service.handleManualResolution({ data: eventData });
      
      expect(result.recorded).toBe(true);
      
      // 檢查是否發送了人工記錄事件
      const manualEvents = mockEventBus.getMatchingEvents('DATA.CONFLICT.MANUAL_RECORDED');
      expect(manualEvents).toHaveLength(1);
    });

    test('應該處理事件處理器中的錯誤', async () => {
      // 模擬會導致真正錯誤的情況
      const originalDetectConflicts = service.detectConflicts;
      service.detectConflicts = jest.fn().mockRejectedValue(new Error('Detection failed'));

      await expect(service.handleConflictDetectionRequest({ data: { data1: [], data2: [] } }))
        .rejects.toThrow('Detection failed');

      const errorLogs = mockLogger.getLogs('error');
      expect(errorLogs.length).toBeGreaterThan(0);
      
      // 恢復原始方法
      service.detectConflicts = originalDetectConflicts;
    });

    test('應該支援事件資料的預設值處理', async () => {
      // 測試空事件資料處理
      const result = await service.handleConflictDetectionRequest({});
      
      expect(result).toBeDefined();
      expect(result.conflicts).toHaveLength(0);
    });
  });

  // ==========================================
  // Performance & Analytics (4 個測試)
  // ==========================================
  
  describe('Performance & Analytics', () => {
    beforeEach(async () => {
      service = new ConflictResolutionService(mockEventBus, mockLogger, mockConfig);
      await service.initialize();
    });

    test('應該取得統計資料', async () => {
      // 執行一些操作來產生統計資料
      const { data1, data2 } = ConflictTestDataFactory.createProgressConflictData();
      await service.detectConflicts([data1], [data2]);

      const stats = await service.getStatistics();
      
      expect(stats).toHaveProperty('conflictsDetected');
      expect(stats).toHaveProperty('conflictsResolved');
      expect(stats).toHaveProperty('autoResolutionSuccessRate');
      expect(stats).toHaveProperty('averageResolutionTime');
      expect(stats.conflictsDetected).toBeGreaterThan(0);
    });

    test('應該取得效能指標', async () => {
      const metrics = await service.getPerformanceMetrics();
      
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('processingTime');
      expect(metrics).toHaveProperty('throughput');
      expect(metrics).toHaveProperty('errorRate');
    });

    test('應該生成效能報告', async () => {
      const report = await service.generatePerformanceReport();
      
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('performance');
      expect(report).toHaveProperty('recommendations');
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    test('應該處理大規模衝突資料', async () => {
      const largeConflictData = ConflictTestDataFactory.createLargeScaleConflictData(100);
      const data1 = largeConflictData.map(c => c.data1);
      const data2 = largeConflictData.map(c => c.data2);

      const startTime = Date.now();
      const result = await service.detectConflicts(data1, data2);
      const endTime = Date.now();
      
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(10000); // 應該在 10 秒內完成
    });
  });
});