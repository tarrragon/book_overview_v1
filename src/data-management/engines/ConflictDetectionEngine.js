/**
 * 衝突檢測引擎
 * 
 * 負責功能：
 * - 協調各種類型的衝突檢測器
 * - 提供統一的檢測接口和結果格式
 * - 管理檢測性能和快取機制
 * - 支援可擴展的檢測器註冊
 */

const ProgressConflictDetector = require('./detectors/ProgressConflictDetector');
const TitleConflictDetector = require('./detectors/TitleConflictDetector');
const TimestampConflictDetector = require('./detectors/TimestampConflictDetector');
const TagConflictDetector = require('./detectors/TagConflictDetector');
const IntelligentCacheManager = require('./utils/IntelligentCacheManager');

class ConflictDetectionEngine {
  constructor(options = {}) {
    this.detectors = new Map();
    this.cacheManager = new IntelligentCacheManager(options.cache || {});
    this.statistics = {
      totalDetections: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageDetectionTime: 0
    };
    
    // 註冊預設檢測器
    this.registerDefaultDetectors();
  }

  registerDefaultDetectors() {
    this.registerDetector('PROGRESS_MISMATCH', new ProgressConflictDetector());
    this.registerDetector('TITLE_DIFFERENCE', new TitleConflictDetector());
    this.registerDetector('TIMESTAMP_CONFLICT', new TimestampConflictDetector());
    this.registerDetector('TAG_DIFFERENCE', new TagConflictDetector());
  }

  registerDetector(type, detector) {
    this.detectors.set(type, detector);
  }

  async detectConflicts(data1, data2, options = {}) {
    const startTime = performance.now();
    
    if (!data1 || !data2) {
      return this.createEmptyResult();
    }

    // 確保資料是陣列格式
    const items1 = Array.isArray(data1) ? data1 : [data1];
    const items2 = Array.isArray(data2) ? data2 : [data2];

    // 建立高效索引
    const index2 = this.buildDataIndex(items2);
    
    const conflicts = [];
    const detectionPromises = [];

    // 並行檢測衝突
    for (const item1 of items1) {
      if (!item1 || !item1.id) continue;
      
      const item2 = index2.get(item1.id);
      if (!item2) continue;

      // 檢查快取
      const cacheKey = this.generateCacheKey(item1, item2, options);
      const cachedResult = await this.cacheManager.get(cacheKey);
      
      if (cachedResult) {
        this.statistics.cacheHits++;
        conflicts.push(...cachedResult);
        continue;
      }

      this.statistics.cacheMisses++;
      
      // 執行檢測
      const detectionPromise = this.detectItemConflicts(item1, item2, options)
        .then(itemConflicts => {
          // 快取結果
          this.cacheManager.set(cacheKey, itemConflicts);
          return itemConflicts;
        });
      
      detectionPromises.push(detectionPromise);
    }

    // 等待所有檢測完成
    const detectionResults = await Promise.all(detectionPromises);
    conflicts.push(...detectionResults.flat());

    // 更新統計
    const endTime = performance.now();
    this.updateStatistics(endTime - startTime);

    return {
      conflicts,
      summary: this.generateAdvancedSummary(conflicts),
      performance: {
        detectionTime: endTime - startTime,
        cacheHitRate: this.getCacheHitRate(),
        itemsProcessed: items1.length
      }
    };
  }

  async detectItemConflicts(item1, item2, options = {}) {
    const conflictTypes = options.conflictTypes || Array.from(this.detectors.keys());
    const conflicts = [];
    
    // 並行執行所有檢測器
    const detectionPromises = conflictTypes.map(async (type) => {
      const detector = this.detectors.get(type);
      if (!detector) return null;

      try {
        const conflict = await detector.detect(item1, item2, options);
        if (conflict) {
          return {
            id: `${item1.id}_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            itemId: item1.id,
            type,
            severity: conflict.severity,
            confidence: conflict.confidence || 0.8,
            details: conflict.details,
            data1: item1,
            data2: item2,
            detectedAt: new Date().toISOString(),
            metadata: conflict.metadata || {}
          };
        }
      } catch (error) {
        console.warn(`Detector ${type} failed:`, error);
      }
      
      return null;
    });

    const results = await Promise.all(detectionPromises);
    conflicts.push(...results.filter(result => result !== null));

    return conflicts;
  }

  buildDataIndex(items) {
    const index = new Map();
    
    for (const item of items) {
      if (item && item.id) {
        index.set(item.id, item);
      }
    }
    
    return index;
  }

  generateCacheKey(item1, item2, options) {
    const keyData = {
      id1: item1.id,
      id2: item2.id,
      hash1: this.calculateItemHash(item1),
      hash2: this.calculateItemHash(item2),
      types: options.conflictTypes?.sort()
    };
    
    return JSON.stringify(keyData);
  }

  calculateItemHash(item) {
    // 計算項目的簡單雜湊值用於快取
    const relevantFields = ['title', 'progress', 'lastUpdated', 'tags'];
    const hashInput = relevantFields
      .map(field => `${field}:${JSON.stringify(item[field])}`)
      .join('|');
    
    // 簡單雜湊函數
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 轉換為32位整數
    }
    
    return hash.toString(36);
  }

  generateAdvancedSummary(conflicts) {
    const summary = {
      totalConflicts: conflicts.length,
      conflictTypes: {},
      severityDistribution: {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0
      },
      averageConfidence: 0,
      riskScore: 0
    };

    let totalConfidence = 0;
    let highRiskConflicts = 0;

    conflicts.forEach(conflict => {
      // 統計衝突類型
      summary.conflictTypes[conflict.type] = (summary.conflictTypes[conflict.type] || 0) + 1;
      
      // 統計嚴重程度
      summary.severityDistribution[conflict.severity] = (summary.severityDistribution[conflict.severity] || 0) + 1;
      
      // 計算信心度
      totalConfidence += conflict.confidence || 0.5;
      
      // 計算風險評分
      if (conflict.severity === 'HIGH' || conflict.severity === 'CRITICAL') {
        highRiskConflicts++;
      }
    });

    // 計算平均信心度
    summary.averageConfidence = conflicts.length > 0 ? totalConfidence / conflicts.length : 0;
    
    // 計算風險評分 (0-100)
    summary.riskScore = conflicts.length > 0 ? (highRiskConflicts / conflicts.length) * 100 : 0;

    return summary;
  }

  createEmptyResult() {
    return {
      conflicts: [],
      summary: {
        totalConflicts: 0,
        conflictTypes: {},
        severityDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
        averageConfidence: 0,
        riskScore: 0
      },
      performance: {
        detectionTime: 0,
        cacheHitRate: 1.0,
        itemsProcessed: 0
      }
    };
  }

  updateStatistics(detectionTime) {
    this.statistics.totalDetections++;
    
    // 計算移動平均
    const alpha = 0.1; // 平滑因子
    this.statistics.averageDetectionTime = 
      (alpha * detectionTime) + ((1 - alpha) * this.statistics.averageDetectionTime);
  }

  getCacheHitRate() {
    const total = this.statistics.cacheHits + this.statistics.cacheMisses;
    return total > 0 ? this.statistics.cacheHits / total : 0;
  }

  getStatistics() {
    return {
      ...this.statistics,
      cacheHitRate: this.getCacheHitRate()
    };
  }

  async cleanup() {
    await this.cacheManager.cleanup();
    this.statistics = {
      totalDetections: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageDetectionTime: 0
    };
  }
}

module.exports = ConflictDetectionEngine;