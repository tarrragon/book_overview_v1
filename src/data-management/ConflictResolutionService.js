const BaseModule = require('../background/lifecycle/base-module');
const ConflictDetectionEngine = require('./engines/ConflictDetectionEngine');

/**
 * Conflict Resolution Service
 * 
 * 負責功能：
 * - 智能衝突檢測與分析
 * - 多策略衝突解決方案
 * - 批次衝突處理和管理
 * - 用戶互動和手動解決
 * 
 * 設計考量：
 * - 事件驅動架構整合
 * - 支援多種衝突類型和解決策略
 * - 智能推薦和學習機制
 * - 高效能批次處理
 * 
 * 處理流程：
 * 1. 接收衝突檢測請求
 * 2. 分析衝突類型和嚴重程度
 * 3. 生成智能解決建議
 * 4. 執行解決策略
 * 5. 追蹤結果和用戶滿意度
 */
class ConflictResolutionService extends BaseModule {
  constructor(eventBus, logger, config, dependencies = {}) {
    if (!eventBus || (typeof eventBus === 'object' && Object.keys(eventBus).length === 0 && !eventBus.on)) {
      throw new Error('EventBus is required');
    }
    if (!logger) {
      throw new Error('Logger is required');
    }
    if (!config) {
      throw new Error('Config is required');
    }

    super({ eventBus, logger, config });
    
      // 依賴注入 - 統一檢測引擎模式
    this.detectionEngine = dependencies.detectionEngine || new ConflictDetectionEngine(config.detectionEngine || {});
    this.strategyEngine = dependencies.strategyEngine;
    this.userPreferences = dependencies.userPreferences;
    
    // 檢測引擎初始化驗證
    if (!this.detectionEngine || typeof this.detectionEngine.detectConflicts !== 'function') {
      throw new Error('DetectionEngine must implement detectConflicts method');
    }
    
    // 配置管理
    this.config = {
      conflict: {
        severityThresholds: {
          low: 0.3,
          medium: 0.6,
          high: 0.8
        },
        batchSize: 50,
        timeoutMs: 30000,
        ...config.conflict
      },
      ...config
    };

    // 狀態管理
    this.isInitialized = false;
    this.activeDetections = new Map();
    this.resolutionQueue = [];
    this.batchJobs = new Map();
    this.resolutionHistory = [];
    
    // 統計和監控
    this.statistics = {
      conflictsDetected: 0,
      conflictsResolved: 0,
      autoResolutionSuccessRate: 0,
      userSatisfactionScore: 0,
      averageResolutionTime: 0
    };
    
    // 用戶偏好和學習
    this.userPreferences = {
      defaultStrategy: 'USE_LATEST_TIMESTAMP',
      autoResolveThreshold: 0.8,
      preferredConflictTypes: [],
      learningEnabled: true
    };
    
    // 註冊事件監聽器
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.eventBus.on('DATA.CONFLICT.DETECT_REQUEST', this.handleConflictDetectionRequest.bind(this));
    this.eventBus.on('DATA.CONFLICT.RESOLVE_REQUEST', this.handleConflictResolutionRequest.bind(this));
    this.eventBus.on('DATA.CONFLICT.BATCH_REQUEST', this.handleBatchResolutionRequest.bind(this));
    this.eventBus.on('DATA.CONFLICT.MANUAL_RESOLUTION', this.handleManualResolution.bind(this));
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    this.logger.info('Initializing Conflict Resolution Service');
    
    // 初始化檢測引擎（確保有效初始化）
    if (typeof this.detectionEngine.initialize === 'function') {
      await this.detectionEngine.initialize();
      this.logger.info('Detection engine initialized successfully');
    }
    
    // 初始化其他依賴
    if (!this.strategyEngine) {
      this.strategyEngine = new MockStrategyEngine();
      this.logger.info('Using mock strategy engine');
    }

    this.isInitialized = true;
    this.logger.info('Conflict Resolution Service initialized successfully');
  }

  // 事件處理器
  async handleConflictDetectionRequest(event) {
    try {
      const { data1, data2, options } = event.data || {};
      this.logger.info('Handling conflict detection request');
      
      const result = await this.detectConflicts(data1 || [], data2 || [], options || {});
      
      // 統一事件格式
      const eventPayload = {
        requestId: event.requestId || `req_${Date.now()}`,
        conflicts: result.conflicts,
        summary: result.summary,
        timestamp: new Date().toISOString()
      };
      
      this.eventBus.emit('DATA.CONFLICT.DETECTED', eventPayload);
      
      return result;
    } catch (error) {
      this.logger.error('Error handling conflict detection request:', error);
      
      // 發送錯誤事件
      this.eventBus.emit('DATA.CONFLICT.ERROR', {
        requestId: event.requestId || `req_${Date.now()}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  async handleConflictResolutionRequest(event) {
    try {
      const { conflicts, strategy, options } = event.data || {};
      this.logger.info('Handling conflict resolution request');
      
      const result = await this.resolveConflicts(conflicts || [], strategy, options || {});
      
      // 統一事件格式
      const eventPayload = {
        requestId: event.requestId || `req_${Date.now()}`,
        resolvedConflicts: result.resolvedConflicts,
        summary: result.summary,
        timestamp: new Date().toISOString()
      };
      
      this.eventBus.emit('DATA.CONFLICT.RESOLVED', eventPayload);
      
      return result;
    } catch (error) {
      this.logger.error('Error handling conflict resolution request:', error);
      
      // 發送錯誤事件
      this.eventBus.emit('DATA.CONFLICT.ERROR', {
        requestId: event.requestId || `req_${Date.now()}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  async handleBatchResolutionRequest(event) {
    try {
      const { conflictBatches, options } = event.data || {};
      this.logger.info('Handling batch resolution request');
      
      const result = await this.resolveBatchConflicts(conflictBatches || [], options || {});
      
      // 統一事件格式
      const eventPayload = {
        requestId: event.requestId || `req_${Date.now()}`,
        batchId: result.batchId,
        batchResults: result.results,
        summary: result.summary,
        timestamp: new Date().toISOString()
      };
      
      this.eventBus.emit('DATA.CONFLICT.BATCH_COMPLETED', eventPayload);
      
      return result;
    } catch (error) {
      this.logger.error('Error handling batch resolution request:', error);
      
      // 發送錯誤事件
      this.eventBus.emit('DATA.CONFLICT.ERROR', {
        requestId: event.requestId || `req_${Date.now()}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  async handleManualResolution(event) {
    try {
      const { conflictId, resolution, userSatisfaction } = event.data || {};
      this.logger.info('Handling manual resolution');
      
      const result = await this.recordManualResolution(conflictId, resolution, userSatisfaction);
      
      // 統一事件格式
      const eventPayload = {
        requestId: event.requestId || `req_${Date.now()}`,
        conflictId,
        resolution,
        learningUpdate: result.learningUpdate,
        timestamp: new Date().toISOString()
      };
      
      this.eventBus.emit('DATA.CONFLICT.MANUAL_RECORDED', eventPayload);
      
      return result;
    } catch (error) {
      this.logger.error('Error handling manual resolution:', error);
      
      // 發送錯誤事件
      this.eventBus.emit('DATA.CONFLICT.ERROR', {
        requestId: event.requestId || `req_${Date.now()}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  // 衝突檢測核心方法 - 統一委派給檢測引擎
  async detectConflicts(data1, data2, options = {}) {
    try {
      // 驗證輸入資料
      if (!Array.isArray(data1) || !Array.isArray(data2)) {
        this.logger.warn('Invalid input data for conflict detection');
        return {
          conflicts: [],
          summary: {
            totalConflicts: 0,
            conflictTypes: {},
            severityDistribution: {}
          }
        };
      }
      
      // 委派給檢測引擎
      const result = await this.detectionEngine.detectConflicts(data1, data2, options);
      
      // 更新服務統計
      this.statistics.conflictsDetected += result.conflicts.length;
      
      // 標準化結果格式
      return this.normalizeDetectionResult(result);
    } catch (error) {
      this.logger.error('Error in conflict detection:', error);
      throw error;
    }
  }

  // 標準化檢測結果格式
  normalizeDetectionResult(result) {
    // 確保結果包含必要的欄位
    const normalized = {
      conflicts: result.conflicts || [],
      summary: {
        totalConflicts: (result.conflicts || []).length,
        conflictTypes: {},
        severityDistribution: {}
      }
    };
    
    // 計算衝突類型統計
    normalized.conflicts.forEach(conflict => {
      const type = conflict.type || 'UNKNOWN';
      const severity = conflict.severity || 'MEDIUM';
      
      normalized.summary.conflictTypes[type] = (normalized.summary.conflictTypes[type] || 0) + 1;
      normalized.summary.severityDistribution[severity] = (normalized.summary.severityDistribution[severity] || 0) + 1;
    });
    
    return normalized;
  }
  
  // 向後相容性方法 - 委派給檢測引擎
  async detectItemConflicts(item1, item2, options = {}) {
    return await this.detectionEngine.detectItemConflicts(item1, item2, options);
  }

  // 向後相容的字串相似度方法
  calculateStringSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0.0;
    
    // 簡單的 Jaccard 相似度計算
    const set1 = new Set(str1.toLowerCase().split(' '));
    const set2 = new Set(str2.toLowerCase().split(' '));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  // 衝突解決核心方法
  async resolveConflicts(conflicts, strategy, options = {}) {
    if (!Array.isArray(conflicts) || conflicts.length === 0) {
      return {
        resolvedConflicts: [],
        summary: {
          totalResolved: 0,
          successRate: 1.0,
          strategiesUsed: {}
        }
      };
    }

    const resolvedConflicts = [];
    const strategiesUsed = {};

    for (const conflict of conflicts) {
      try {
        const resolution = await this.resolveConflict(conflict, strategy, options);
        resolvedConflicts.push({
          conflictId: conflict.id,
          resolution,
          strategy: resolution.strategy,
          confidence: resolution.confidence,
          resolvedAt: new Date().toISOString()
        });

        // 統計策略使用
        strategiesUsed[resolution.strategy] = (strategiesUsed[resolution.strategy] || 0) + 1;
        
      } catch (error) {
        this.logger.error(`Failed to resolve conflict ${conflict.id}:`, error);
        resolvedConflicts.push({
          conflictId: conflict.id,
          resolution: null,
          error: error.message,
          resolvedAt: new Date().toISOString()
        });
      }
    }

    // 生成摘要
    const summary = {
      totalResolved: resolvedConflicts.filter(r => r.resolution).length,
      successRate: resolvedConflicts.filter(r => r.resolution).length / conflicts.length,
      strategiesUsed
    };

    // 更新統計
    this.statistics.conflictsResolved += summary.totalResolved;

    return {
      resolvedConflicts,
      summary
    };
  }

  async resolveConflict(conflict, suggestedStrategy, options = {}) {
    // 生成解決建議
    const recommendations = await this.generateResolutionRecommendations(conflict);
    
    // 選擇策略
    const strategy = suggestedStrategy || recommendations[0]?.strategy || 'MANUAL_REVIEW';
    
    // 執行解決策略
    const resolution = await this.executeResolutionStrategy(conflict, strategy, options);
    
    return {
      strategy,
      resolution,
      confidence: resolution.confidence || 0.5,
      recommendations
    };
  }

  async generateResolutionRecommendations(conflict) {
    const recommendations = [];

    switch (conflict.type) {
      case 'PROGRESS_MISMATCH':
        recommendations.push({
          strategy: 'USE_LATEST_TIMESTAMP',
          confidence: 0.8,
          description: '使用時間戳較新的進度值'
        });
        recommendations.push({
          strategy: 'USE_SOURCE_PRIORITY',
          confidence: 0.6,
          description: '根據資料來源優先級選擇'
        });
        break;
        
      case 'TITLE_DIFFERENCE':
        recommendations.push({
          strategy: 'MANUAL_REVIEW',
          confidence: 0.9,
          description: '標題差異需要人工確認'
        });
        break;
        
      case 'TIMESTAMP_CONFLICT':
        recommendations.push({
          strategy: 'USE_LATEST_TIMESTAMP',
          confidence: 0.9,
          description: '使用最新時間戳'
        });
        break;
        
      case 'TAG_DIFFERENCE':
        recommendations.push({
          strategy: 'MERGE_VALUES',
          confidence: 0.7,
          description: '合併所有標籤'
        });
        break;
        
      default:
        recommendations.push({
          strategy: 'MANUAL_REVIEW',
          confidence: 0.5,
          description: '未知衝突類型，需要人工處理'
        });
    }

    return recommendations;
  }

  async executeResolutionStrategy(conflict, strategy, options = {}) {
    switch (strategy) {
      case 'USE_LATEST_TIMESTAMP':
        return this.useLatestTimestampStrategy(conflict);
      case 'USE_SOURCE_PRIORITY':
        return this.useSourcePriorityStrategy(conflict, options);
      case 'MERGE_VALUES':
        return this.mergeValuesStrategy(conflict);
      case 'MANUAL_REVIEW':
        return this.manualReviewStrategy(conflict);
      default:
        throw new Error(`Unknown resolution strategy: ${strategy}`);
    }
  }

  useLatestTimestampStrategy(conflict) {
    const data1 = conflict.data1;
    const data2 = conflict.data2;
    
    const timestamp1 = new Date(data1.lastUpdated || data1.timestamp || 0).getTime();
    const timestamp2 = new Date(data2.lastUpdated || data2.timestamp || 0).getTime();
    
    const selectedData = timestamp1 > timestamp2 ? data1 : data2;
    
    return {
      resolvedValue: selectedData,
      reason: `選擇時間戳較新的資料 (${selectedData.lastUpdated || selectedData.timestamp})`,
      confidence: 0.8
    };
  }

  useSourcePriorityStrategy(conflict, options = {}) {
    const sourcePriority = options.sourcePriority || ['readmoo', 'kindle', 'kobo'];
    const data1 = conflict.data1;
    const data2 = conflict.data2;
    
    const source1 = data1.source || 'unknown';
    const source2 = data2.source || 'unknown';
    
    const priority1 = sourcePriority.indexOf(source1);
    const priority2 = sourcePriority.indexOf(source2);
    
    const selectedData = (priority1 !== -1 && (priority2 === -1 || priority1 < priority2)) ? data1 : data2;
    
    return {
      resolvedValue: selectedData,
      reason: `根據來源優先級選擇 ${selectedData.source}`,
      confidence: 0.6
    };
  }

  mergeValuesStrategy(conflict) {
    const data1 = conflict.data1;
    const data2 = conflict.data2;
    
    // 合併邏輯依衝突類型而定
    let mergedValue;
    
    if (conflict.type === 'TAG_DIFFERENCE') {
      const tags1 = data1.tags || data1.categories || [];
      const tags2 = data2.tags || data2.categories || [];
      const allTags = [...new Set([...Array.isArray(tags1) ? tags1 : [tags1], ...Array.isArray(tags2) ? tags2 : [tags2]])];
      
      mergedValue = {
        ...data1,
        tags: allTags
      };
    } else {
      // 預設合併邏輯
      mergedValue = {
        ...data1,
        ...data2,
        mergedAt: new Date().toISOString()
      };
    }
    
    return {
      resolvedValue: mergedValue,
      reason: '智能合併兩個資料源的值',
      confidence: 0.7
    };
  }

  manualReviewStrategy(conflict) {
    return {
      resolvedValue: null,
      reason: '需要人工審核',
      confidence: 0.0,
      requiresManualReview: true,
      reviewOptions: [
        { label: '使用資料1', value: conflict.data1 },
        { label: '使用資料2', value: conflict.data2 },
        { label: '自定義合併', value: 'custom' }
      ]
    };
  }

  // 批次處理方法
  async resolveBatchConflicts(conflictBatches, options = {}) {
    const batchId = `batch_${Date.now()}`;
    const results = [];
    
    this.batchJobs.set(batchId, {
      status: 'RUNNING',
      startTime: Date.now(),
      totalBatches: conflictBatches.length,
      completedBatches: 0
    });

    try {
      for (let i = 0; i < conflictBatches.length; i++) {
        const batch = conflictBatches[i];
        
        // 發送進度事件
        this.eventBus.emit('DATA.CONFLICT.BATCH_PROGRESS', {
          batchId,
          progress: (i / conflictBatches.length) * 100,
          currentBatch: i,
          totalBatches: conflictBatches.length,
          timestamp: new Date().toISOString()
        });
        
        const batchResult = await this.processBatch(batch, options);
        results.push(batchResult);
        
        // 更新作業狀態
        const job = this.batchJobs.get(batchId);
        job.completedBatches = i + 1;
      }

      this.batchJobs.get(batchId).status = 'COMPLETED';
      
      return {
        batchId,
        results,
        summary: {
          totalBatches: conflictBatches.length,
          successfulBatches: results.filter(r => r.success).length,
          totalConflictsResolved: results.reduce((sum, r) => sum + (r.resolvedCount || 0), 0)
        }
      };
      
    } catch (error) {
      this.batchJobs.get(batchId).status = 'FAILED';
      throw error;
    }
  }

  async processBatch(batch, options = {}) {
    try {
      const conflicts = batch.conflicts || [];
      const strategy = batch.strategy || options.defaultStrategy || 'USE_LATEST_TIMESTAMP';
      
      const result = await this.resolveConflicts(conflicts, strategy, options);
      
      return {
        batchId: batch.id,
        success: true,
        resolvedCount: result.summary.totalResolved,
        details: result
      };
    } catch (error) {
      return {
        batchId: batch.id,
        success: false,
        error: error.message
      };
    }
  }

  // 用戶互動和學習方法
  async recordManualResolution(conflictId, resolution, userSatisfaction = null) {
    const record = {
      conflictId,
      resolution,
      userSatisfaction,
      timestamp: new Date().toISOString()
    };
    
    this.resolutionHistory.push(record);
    
    // 學習機制
    const learningUpdate = this.updateLearningModel(record);
    
    return {
      recorded: true,
      learningUpdate
    };
  }

  updateLearningModel(record) {
    if (!this.userPreferences.learningEnabled) {
      return { updated: false, reason: 'Learning disabled' };
    }
    
    // 簡單的學習機制：根據用戶滿意度調整策略偏好
    if (record.userSatisfaction !== null) {
      const satisfaction = parseFloat(record.userSatisfaction);
      
      if (satisfaction >= 0.8) {
        // 高滿意度：增加對這種解決方案的偏好
        return { updated: true, action: 'increase_preference' };
      } else if (satisfaction <= 0.3) {
        // 低滿意度：降低對這種解決方案的偏好
        return { updated: true, action: 'decrease_preference' };
      }
    }
    
    return { updated: false, reason: 'No significant satisfaction data' };
  }

  async getUserPreferences() {
    return { ...this.userPreferences };
  }

  async updateUserPreferences(newPreferences) {
    this.userPreferences = {
      ...this.userPreferences,
      ...newPreferences
    };
    
    return {
      success: true,
      preferences: this.userPreferences
    };
  }

  async getResolutionHistory(options = {}) {
    const { limit = 100, conflictType, fromDate, toDate } = options;
    
    let history = [...this.resolutionHistory];
    
    // 過濾條件
    if (conflictType) {
      history = history.filter(record => record.conflictType === conflictType);
    }
    
    if (fromDate) {
      history = history.filter(record => new Date(record.timestamp) >= new Date(fromDate));
    }
    
    if (toDate) {
      history = history.filter(record => new Date(record.timestamp) <= new Date(toDate));
    }
    
    // 限制數量
    history = history.slice(-limit);
    
    return history;
  }

  async undoResolution(resolutionId) {
    const historyIndex = this.resolutionHistory.findIndex(record => record.resolutionId === resolutionId);
    
    if (historyIndex === -1) {
      throw new Error('Resolution not found');
    }
    
    const record = this.resolutionHistory[historyIndex];
    
    // 執行撤銷邏輯
    const undoResult = {
      success: true,
      undoneResolution: record,
      undoneAt: new Date().toISOString()
    };
    
    // 從歷史記錄移除
    this.resolutionHistory.splice(historyIndex, 1);
    
    return undoResult;
  }

  async escalateConflict(conflictId, reason) {
    return {
      escalated: true,
      conflictId,
      reason,
      escalatedAt: new Date().toISOString(),
      assignedTo: 'expert_review_queue'
    };
  }

  // 效能監控和統計方法
  async getStatistics() {
    const totalResolutions = this.resolutionHistory.length;
    const recentResolutions = this.resolutionHistory.slice(-100);
    
    // 計算平均解決時間（模擬）
    this.statistics.averageResolutionTime = 2.5; // 秒
    
    // 計算用戶滿意度
    const satisfactionScores = recentResolutions
      .filter(r => r.userSatisfaction !== null)
      .map(r => parseFloat(r.userSatisfaction));
    
    this.statistics.userSatisfactionScore = satisfactionScores.length > 0 
      ? satisfactionScores.reduce((sum, score) => sum + score, 0) / satisfactionScores.length
      : 0;
    
    // 計算自動解決成功率
    this.statistics.autoResolutionSuccessRate = this.statistics.conflictsResolved > 0 
      ? this.statistics.conflictsResolved / this.statistics.conflictsDetected 
      : 0;

    return {
      ...this.statistics,
      totalResolutions,
      activeDetections: this.activeDetections.size,
      queuedResolutions: this.resolutionQueue.length,
      activeBatchJobs: this.batchJobs.size
    };
  }

  async getPerformanceMetrics() {
    return {
      memoryUsage: this.getMemoryUsage(),
      processingTime: this.getAverageProcessingTime(),
      throughput: this.getThroughput(),
      errorRate: this.getErrorRate()
    };
  }

  getMemoryUsage() {
    // 估算記憶體使用量
    const historySize = JSON.stringify(this.resolutionHistory).length;
    const activeSize = JSON.stringify(Array.from(this.activeDetections.values())).length;
    
    return {
      total: historySize + activeSize,
      history: historySize,
      active: activeSize,
      unit: 'bytes'
    };
  }

  getAverageProcessingTime() {
    return this.statistics.averageResolutionTime;
  }

  getThroughput() {
    // 每分鐘處理的衝突數量
    return this.statistics.conflictsResolved * 60 / (Date.now() / 1000);
  }

  getErrorRate() {
    const totalAttempts = this.statistics.conflictsDetected;
    const failures = totalAttempts - this.statistics.conflictsResolved;
    
    return totalAttempts > 0 ? failures / totalAttempts : 0;
  }

  async generatePerformanceReport() {
    const stats = await this.getStatistics();
    const metrics = await this.getPerformanceMetrics();
    
    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalConflictsDetected: stats.conflictsDetected,
        totalConflictsResolved: stats.conflictsResolved,
        successRate: stats.autoResolutionSuccessRate,
        userSatisfaction: stats.userSatisfactionScore
      },
      performance: metrics,
      recommendations: this.generateOptimizationRecommendations(stats, metrics)
    };
  }

  generateOptimizationRecommendations(stats, metrics) {
    const recommendations = [];
    
    if (metrics.errorRate > 0.1) {
      recommendations.push({
        type: 'ERROR_RATE',
        message: '錯誤率過高，建議檢查衝突檢測邏輯',
        priority: 'HIGH'
      });
    }
    
    if (metrics.memoryUsage.total > 1000000) {
      recommendations.push({
        type: 'MEMORY_USAGE',
        message: '記憶體使用量較高，建議清理歷史記錄',
        priority: 'MEDIUM'
      });
    }
    
    if (stats.userSatisfactionScore < 0.7) {
      recommendations.push({
        type: 'USER_SATISFACTION',
        message: '用戶滿意度較低，建議優化解決策略',
        priority: 'HIGH'
      });
    }
    
    return recommendations;
  }

  // 清理和維護方法 - 改善資源管理
  async cleanup() {
    const cleanupStats = {
      historyRecords: 0,
      expiredDetections: 0,
      completedBatchJobs: 0
    };
    
    try {
      // 清理歷史記錄（保留最近 1000 條）
      const originalHistoryLength = this.resolutionHistory.length;
      if (originalHistoryLength > 1000) {
        this.resolutionHistory = this.resolutionHistory.slice(-1000);
        cleanupStats.historyRecords = originalHistoryLength - 1000;
        this.logger.info(`Cleaned up ${cleanupStats.historyRecords} old resolution records`);
      }
      
      // 清理過期的活躍檢測
      const now = Date.now();
      const expiredDetections = [];
      for (const [id, detection] of this.activeDetections.entries()) {
        if (now - detection.startTime > 300000) { // 5分鐘過期
          expiredDetections.push(id);
        }
      }
      
      expiredDetections.forEach(id => {
        this.activeDetections.delete(id);
        cleanupStats.expiredDetections++;
      });
      
      if (cleanupStats.expiredDetections > 0) {
        this.logger.info(`Cleaned up ${cleanupStats.expiredDetections} expired detections`);
      }
      
      // 清理完成的批次作業
      const completedJobs = [];
      for (const [id, job] of this.batchJobs.entries()) {
        if (job.status === 'COMPLETED' || job.status === 'FAILED') {
          // 保留最近 10 分鐘的作業記錄
          if (now - job.startTime > 600000) {
            completedJobs.push(id);
          }
        }
      }
      
      completedJobs.forEach(id => {
        this.batchJobs.delete(id);
        cleanupStats.completedBatchJobs++;
      });
      
      if (cleanupStats.completedBatchJobs > 0) {
        this.logger.info(`Cleaned up ${cleanupStats.completedBatchJobs} completed batch jobs`);
      }
      
      // 清理檢測引擎的資源（如果支援）
      if (typeof this.detectionEngine.cleanup === 'function') {
        await this.detectionEngine.cleanup();
        this.logger.info('Detection engine cleanup completed');
      }
      
      return {
        success: true,
        cleanedItems: cleanupStats,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
      return {
        success: false,
        error: error.message,
        cleanedItems: cleanupStats,
        timestamp: new Date().toISOString()
      };
    }
  }

  async getHealthStatus() {
    const baseStatus = super.getHealthStatus();
    const memoryUsage = this.getMemoryUsage();
    
    // 檢查檢測引擎狀態
    let detectionEngineHealth = 'healthy';
    if (typeof this.detectionEngine.getHealthStatus === 'function') {
      try {
        const engineStatus = await this.detectionEngine.getHealthStatus();
        detectionEngineHealth = engineStatus.status || 'healthy';
      } catch (error) {
        detectionEngineHealth = 'error';
        this.logger.warn('Detection engine health check failed:', error);
      }
    }
    
    return {
      ...baseStatus,
      conflictResolution: {
        isProcessing: this.activeDetections.size > 0,
        queueLength: this.resolutionQueue.length,
        activeBatchJobs: this.batchJobs.size,
        detectionEngineHealth,
        memoryHealth: memoryUsage.total < 2000000 ? 'healthy' : 'warning',
        statistics: {
          conflictsDetected: this.statistics.conflictsDetected,
          conflictsResolved: this.statistics.conflictsResolved,
          successRate: this.statistics.autoResolutionSuccessRate
        }
      }
    };
  }
}

// Mock implementations for dependencies
class MockDetectionEngine {
  constructor(config = {}) {
    this.config = config;
    this.isInitialized = false;
  }
  
  async initialize() {
    this.isInitialized = true;
  }
  
  async detectConflicts(data1, data2, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Detection engine not initialized');
    }
    
    return {
      conflicts: [],
      summary: {
        totalConflicts: 0,
        conflictTypes: {},
        severityDistribution: {}
      }
    };
  }
  
  async detectItemConflicts(item1, item2, options = {}) {
    return null;
  }
  
  async cleanup() {
    // Mock cleanup
  }
  
  async getHealthStatus() {
    return { status: 'healthy' };
  }
}

class MockStrategyEngine {
  async generateStrategy(conflict) {
    return 'USE_LATEST_TIMESTAMP';
  }
  
  async getRecommendations(conflict) {
    return [
      {
        strategy: 'USE_LATEST_TIMESTAMP',
        confidence: 0.8,
        description: 'Use timestamp-based resolution'
      }
    ];
  }
}

module.exports = ConflictResolutionService;