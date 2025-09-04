/**
 * 事件驅動統一化測試
 * 確保整個系統的事件驅動模式統一和一致
 * 
 * 測試重點：
 * 1. 事件命名規範統一性
 * 2. 跨模組事件協作一致性
 * 3. 事件系統效能優化
 * 4. 事件錯誤處理統一化
 * 5. 事件流程統一化
 */

const EventBus = require('../../../src/core/event-bus');
const EventHandler = require('../../../src/core/event-handler');
const EventSystemUnifier = require('../../../src/core/event-system-unifier');

describe('事件驅動統一化測試', () => {
  let eventBus;
  let eventUnifier;
  let mockHandlers;

  beforeEach(() => {
    eventBus = new EventBus();
    eventUnifier = new EventSystemUnifier(eventBus);
    mockHandlers = [];
  });

  afterEach(() => {
    // 清理所有測試資源
    mockHandlers.forEach(handler => {
      if (handler.cleanup) {
        handler.cleanup();
      }
    });
  });

  describe('1. 事件命名規範統一性測試', () => {
    test('應該驗證所有事件命名符合 MODULE.ACTION.STATE 格式', async () => {
      const validator = eventUnifier.namingValidator;

      // 測試有效事件命名
      expect(validator.validateEventName('EXTRACTION.DATA.COMPLETED')).toBe(true);
      expect(validator.validateEventName('UI.PROGRESS.UPDATE')).toBe(true);
      expect(validator.validateEventName('STORAGE.SAVE.REQUESTED')).toBe(true);

      // 測試無效事件命名
      expect(validator.validateEventName('INVALID_EVENT')).toBe(false);
      expect(validator.validateEventName('bad.format')).toBe(false);
      expect(validator.validateEventName('')).toBe(false);
      expect(validator.validateEventName(null)).toBe(false);

      // 測試模組名稱驗證
      expect(validator.isValidModuleName('EXTRACTION')).toBe(true);
      expect(validator.isValidModuleName('UI')).toBe(true);
      expect(validator.isValidModuleName('INVALID')).toBe(false);

      // 檢查無效事件名稱記錄
      const invalidNames = validator.getInvalidEventNames();
      expect(invalidNames).toContain('INVALID_EVENT');
      expect(invalidNames).toContain('bad.format');
    });

    test('應該檢查事件優先級分配的一致性', async () => {
      const validator = eventUnifier.priorityValidator;

      // 記錄一些事件優先級（模擬不一致情況）
      validator.recordEventPriority('EXTRACTION.COMPLETED', 100);
      validator.recordEventPriority('EXTRACTION.COMPLETED', 200);
      validator.recordEventPriority('UI.UPDATE', 150);

      // 驗證不一致的優先級
      expect(validator.validateEventPriorities()).toBe(false);
      
      const inconsistentPriorities = validator.getInconsistentPriorities();
      expect(inconsistentPriorities.length).toBe(1);
      expect(inconsistentPriorities[0].event).toBe('EXTRACTION.COMPLETED');

      // 測試標準化功能
      expect(validator.normalizeEventPriorities()).toBe(true);
      
      // 標準化後應該一致
      expect(validator.validateEventPriorities()).toBe(true);
    });

    test('應該統一事件payload結構規範', async () => {
      const validator = eventUnifier.payloadValidator;

      // 測試 payload 結構驗證
      expect(validator.validatePayloadStructure()).toBe(true);

      // 測試標準結構定義
      const schema = validator.getStandardPayloadSchema();
      expect(schema).not.toBeNull();
      expect(schema).toHaveProperty('type', 'string');
      expect(schema).toHaveProperty('timestamp', 'number');
      expect(schema).toHaveProperty('source', 'string');
      expect(schema).toHaveProperty('data', 'object');
      expect(schema).toHaveProperty('metadata', 'object');

      // 測試 payload 標準化
      expect(validator.normalizeEventPayloads()).toBe(true);
    });
  });

  describe('2. 跨模組事件協作統一化測試', () => {
    test('應該建立統一的事件協作模式', async () => {
      const manager = eventUnifier.collaborationManager;

      // 測試事件鏈建立
      expect(manager.setupEventChains()).toBe(true);

      // 驗證事件流程
      expect(manager.validateEventFlow()).toBe(true);

      // 檢查事件依賴關係
      const dependencies = manager.getEventDependencies();
      expect(dependencies).toBeInstanceOf(Array);
      expect(dependencies.length).toBeGreaterThan(0);

      // 測試事件鏈優化
      expect(manager.optimizeEventChains()).toBe(true);
    });

    test('應該統一模組間事件通訊協議', async () => {
      // 測試事件系統基礎通訊協議
      const manager = eventUnifier.collaborationManager;
      
      // 驗證事件協作指標
      expect(manager.collaborationMetrics).toHaveProperty('chainsCreated');
      expect(manager.collaborationMetrics).toHaveProperty('eventsRouted');
      expect(manager.collaborationMetrics).toHaveProperty('collaborationErrors');
    });

    test('應該實現事件流程追蹤和監控統一化', async () => {
      // 測試監控儀表板功能
      const dashboard = eventUnifier.monitoringDashboard;
      
      expect(dashboard.setupEventMetrics()).toBe(true);
      
      const report = dashboard.generateRealTimeReport();
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('totalEvents');
      expect(report).toHaveProperty('errorRate');
      expect(report).toHaveProperty('averageResponseTime');
    });
  });

  describe('3. 事件系統效能優化統一化測試', () => {
    test('應該統一事件處理效能優化策略', async () => {
      const optimizer = eventUnifier.performanceOptimizer;

      // 測試效能優化功能
      expect(optimizer.enableBatchProcessing()).toBe(true);
      expect(optimizer.optimizeEventListeners()).toBe(true);
      expect(optimizer.implementEventCoalescing()).toBe(true);
      
      const metrics = optimizer.getPerformanceMetrics();
      expect(metrics).toHaveProperty('averageProcessingTime');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('eventThroughput');
    });

    test('應該實現統一的記憶體管理策略', async () => {
      // 測試統一化管理器的記憶體管理
      expect(eventUnifier.isUnificationEnabled).toBeDefined();
      expect(eventUnifier.unificationMetrics).toHaveProperty('eventsUnified');
      expect(eventUnifier.unificationMetrics).toHaveProperty('rulesApplied');
      expect(eventUnifier.unificationMetrics).toHaveProperty('performanceImprovements');
    });

    test('應該統一事件處理並發模式', async () => {
      // 測試事件總線的並發處理能力
      expect(eventBus.options).toHaveProperty('maxListeners');
      expect(eventBus.stats).toHaveProperty('eventStats');
      expect(eventBus.stats).toHaveProperty('totalEmissions');
      expect(eventBus.stats).toHaveProperty('totalExecutionTime');
    });
  });

  describe('4. 事件錯誤處理統一化測試', () => {
    test('應該建立統一的錯誤處理和恢復機制', async () => {
      const errorManager = eventUnifier.errorManager;

      // 測試統一錯誤處理功能
      expect(errorManager.setupUnifiedErrorHandling()).toBe(true);
      expect(errorManager.implementErrorRecovery()).toBe(true);
      expect(errorManager.standardizeErrorReporting()).toBe(true);
      expect(errorManager.enableErrorIsolation()).toBe(true);
    });

    test('應該統一事件超時和重試策略', async () => {
      // 測試統一化常數配置
      const unifier = require('../../../src/core/event-system-unifier');
      expect(unifier).toBeDefined();
      
      // 驗證錯誤處理統一化指標
      expect(eventUnifier.unificationMetrics).toHaveProperty('errorsHandled');
    });

    test('應該實現統一的事件驗證和安全機制', async () => {
      // 測試命名驗證器的安全性
      const validator = eventUnifier.namingValidator;
      
      // 測試惡意事件名稱防護
      expect(validator.validateEventName('<script>alert(1)</script>')).toBe(false);
      expect(validator.validateEventName("'; DROP TABLE events; --")).toBe(false);
      expect(validator.validateEventName(null)).toBe(false);
      expect(validator.validateEventName(undefined)).toBe(false);
    });
  });

  describe('5. 事件系統監控和診斷統一化測試', () => {
    test('應該建立統一的事件監控儀表板', async () => {
      const dashboard = eventUnifier.monitoringDashboard;

      expect(dashboard.setupEventMetrics()).toBe(true);
      
      const report = dashboard.generateRealTimeReport();
      expect(report).not.toBeNull();
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('totalEvents');
      
      const monitoringData = dashboard.exportMonitoringData();
      expect(monitoringData).not.toBeNull();
      expect(monitoringData).toHaveProperty('format');
      expect(monitoringData).toHaveProperty('data');
    });

    test('應該統一事件診斷和除錯工具', async () => {
      // 測試統一化是否已啟用
      expect(eventUnifier.isUnificationEnabled).toBeDefined();
      
      // 測試統一化組件是否已初始化
      expect(eventUnifier.namingValidator).toBeDefined();
      expect(eventUnifier.priorityValidator).toBeDefined();
      expect(eventUnifier.collaborationManager).toBeDefined();
    });

    test('應該實現統一的事件系統健康檢查', async () => {
      // 執行基礎健康檢查
      eventUnifier.initializeUnification();
      
      const validationResult = eventUnifier.validateUnification();
      expect(validationResult).toBe(true);
      
      const compatibilityCheck = eventUnifier.checkBackwardCompatibility();
      expect(compatibilityCheck).toBe(true);
    });
  });

  describe('6. 事件系統統一化整合測試', () => {
    test('應該執行完整的事件系統統一化流程', async () => {
      // 測試完整的統一化流程
      expect(eventUnifier.initializeUnification()).toBe(true);
      expect(eventUnifier.applyUnificationRules()).toBe(true);
      expect(eventUnifier.validateUnification()).toBe(true);
      
      const report = eventUnifier.generateUnificationReport();
      expect(report).not.toBeNull();
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('duration');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('summary');
    });

    test('應該驗證向後相容性保持', async () => {
      // 測試向後相容性
      expect(eventUnifier.checkBackwardCompatibility()).toBe(true);
      
      // 確保統一化不會破壞現有功能
      expect(eventUnifier.unificationMetrics.compatibilityMaintained).toBe(true);
      
      // 驗證現有的 EventBus 和 EventHandler 仍然可以正常工作
      expect(eventBus).toBeInstanceOf(EventBus);
      expect(typeof eventBus.on).toBe('function');
      expect(typeof eventBus.emit).toBe('function');
    });

    test('應該測試統一化後的系統效能', async () => {
      // 初始化統一化
      eventUnifier.initializeUnification();
      
      // 測試效能指標
      const performanceMetrics = eventUnifier.performanceOptimizer.getPerformanceMetrics();
      expect(performanceMetrics).toHaveProperty('averageProcessingTime');
      expect(performanceMetrics).toHaveProperty('memoryUsage');
      expect(performanceMetrics).toHaveProperty('eventThroughput');
      
      // 驗證效能優化功能
      expect(eventUnifier.performanceOptimizer.enableBatchProcessing()).toBe(true);
      expect(eventUnifier.performanceOptimizer.optimizeEventListeners()).toBe(true);
      expect(eventUnifier.performanceOptimizer.implementEventCoalescing()).toBe(true);
    });
  });
});