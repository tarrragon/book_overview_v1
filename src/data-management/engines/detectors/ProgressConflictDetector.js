/**
 * 進度衝突檢測器
 * 
 * 負責功能：
 * - 檢測書籍閱讀進度的差異和衝突
 * - 支援多種進度比較策略和容忍度設定
 * - 提供智能的嚴重程度評估和信心度計算
 * - 處理邊界情況和異常數據
 */

class ProgressConflictDetector {
  constructor(options = {}) {
    this.options = {
      // 進度差異閾值 (百分比)
      lowThreshold: options.lowThreshold || 5,      // 5% 以下為輕微
      mediumThreshold: options.mediumThreshold || 15, // 15% 以下為中等
      highThreshold: options.highThreshold || 30,   // 30% 以下為高級
      
      // 時間權重因子
      timeDecayFactor: options.timeDecayFactor || 0.1,
      
      // 進度驗證設定
      allowableVariance: options.allowableVariance || 2, // 允許的測量誤差
      
      ...options
    };
  }

  async detect(item1, item2, options = {}) {
    // 提取和驗證進度資料
    const progress1 = this.extractProgress(item1);
    const progress2 = this.extractProgress(item2);
    
    // 資料有效性檢查
    if (!this.isValidProgress(progress1) || !this.isValidProgress(progress2)) {
      return null;
    }

    // 計算進度差異
    const difference = Math.abs(progress1.value - progress2.value);
    
    // 應用容忍度檢查
    if (difference <= this.options.allowableVariance) {
      return null; // 在容忍範圍內，不視為衝突
    }

    // 考慮時間因素的權重調整
    const timeAdjustedDifference = this.calculateTimeAdjustedDifference(
      difference, progress1, progress2
    );

    // 檢查是否構成衝突
    if (timeAdjustedDifference <= this.options.lowThreshold) {
      return null; // 不構成衝突
    }

    // 計算嚴重程度和信心度
    const severity = this.calculateSeverity(timeAdjustedDifference);
    const confidence = this.calculateConfidence(progress1, progress2, difference);

    return {
      severity,
      confidence,
      details: {
        progress1: progress1.value,
        progress2: progress2.value,
        difference,
        timeAdjustedDifference,
        timeFactors: {
          timestamp1: progress1.timestamp,
          timestamp2: progress2.timestamp,
          timeDifference: this.calculateTimeDifference(progress1, progress2)
        }
      },
      metadata: {
        detectorType: 'progress',
        algorithm: 'time-weighted-difference',
        version: '2.0'
      }
    };
  }

  extractProgress(item) {
    const progress = {
      value: this.normalizeProgress(item.progress),
      timestamp: this.extractTimestamp(item),
      source: item.source || 'unknown',
      confidence: item.progressConfidence || 1.0
    };

    return progress;
  }

  normalizeProgress(progress) {
    if (typeof progress !== 'number') {
      return 0;
    }

    // 處理百分比格式 (0-100) 和小數格式 (0-1)
    if (progress > 1) {
      return Math.min(100, Math.max(0, progress));
    } else {
      return Math.min(100, Math.max(0, progress * 100));
    }
  }

  extractTimestamp(item) {
    const timestamp = item.lastUpdated || 
                     item.timestamp || 
                     item.progressUpdated || 
                     item.updatedAt;
    
    if (!timestamp) {
      return Date.now(); // 使用當前時間作為後備
    }

    return new Date(timestamp).getTime();
  }

  isValidProgress(progress) {
    return progress && 
           typeof progress.value === 'number' && 
           progress.value >= 0 && 
           progress.value <= 100 &&
           progress.timestamp &&
           !isNaN(progress.timestamp);
  }

  calculateTimeDifference(progress1, progress2) {
    return Math.abs(progress1.timestamp - progress2.timestamp);
  }

  calculateTimeAdjustedDifference(baseDifference, progress1, progress2) {
    const timeDiff = this.calculateTimeDifference(progress1, progress2);
    const hoursDiff = timeDiff / (1000 * 60 * 60); // 轉換為小時
    
    // 時間衰減因子：時間差距越大，衝突嚴重程度越低
    const timeDecay = Math.exp(-this.options.timeDecayFactor * hoursDiff);
    
    // 如果較新的進度較高，這是合理的，降低衝突程度
    const newerProgress = progress1.timestamp > progress2.timestamp ? progress1.value : progress2.value;
    const olderProgress = progress1.timestamp > progress2.timestamp ? progress2.value : progress1.value;
    
    let progressionFactor = 1.0;
    if (newerProgress > olderProgress) {
      // 進度有提升，這是正常的，降低衝突嚴重程度
      progressionFactor = 0.7;
    }

    return baseDifference * timeDecay * progressionFactor;
  }

  calculateSeverity(adjustedDifference) {
    if (adjustedDifference <= this.options.lowThreshold) {
      return 'LOW';
    } else if (adjustedDifference <= this.options.mediumThreshold) {
      return 'MEDIUM';
    } else if (adjustedDifference <= this.options.highThreshold) {
      return 'HIGH';
    } else {
      return 'CRITICAL';
    }
  }

  calculateConfidence(progress1, progress2, difference) {
    let confidence = 0.8; // 基礎信心度

    // 根據時間戳可靠性調整
    const now = Date.now();
    const age1 = (now - progress1.timestamp) / (1000 * 60 * 60 * 24); // 天數
    const age2 = (now - progress2.timestamp) / (1000 * 60 * 60 * 24);
    
    // 資料越新，信心度越高
    const maxAge = Math.max(age1, age2);
    if (maxAge > 30) { // 超過30天
      confidence *= 0.7;
    } else if (maxAge > 7) { // 超過7天
      confidence *= 0.85;
    }

    // 根據進度值的合理性調整
    const maxProgress = Math.max(progress1.value, progress2.value);
    const minProgress = Math.min(progress1.value, progress2.value);
    
    // 如果進度回退（較新的進度較低），提高衝突信心度
    const newerProgress = progress1.timestamp > progress2.timestamp ? progress1.value : progress2.value;
    const olderProgress = progress1.timestamp > progress2.timestamp ? progress2.value : progress1.value;
    
    if (newerProgress < olderProgress) {
      confidence *= 1.2; // 進度回退是明顯的衝突信號
    }

    // 根據差異程度調整
    if (difference > 50) {
      confidence *= 1.15; // 大差異通常是真實衝突
    } else if (difference < 10) {
      confidence *= 0.9; // 小差異可能是測量誤差
    }

    // 根據來源可靠性調整
    const sourceReliability = this.getSourceReliability(progress1.source, progress2.source);
    confidence *= sourceReliability;

    return Math.min(1.0, Math.max(0.1, confidence));
  }

  getSourceReliability(source1, source2) {
    const reliabilityMap = {
      'readmoo': 0.95,
      'kindle': 0.90,
      'kobo': 0.85,
      'manual': 0.80,
      'unknown': 0.70
    };

    const reliability1 = reliabilityMap[source1] || 0.70;
    const reliability2 = reliabilityMap[source2] || 0.70;

    return (reliability1 + reliability2) / 2;
  }

  // 效能優化：批次檢測
  async detectBatch(items1, items2, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 100;
    
    for (let i = 0; i < items1.length; i += batchSize) {
      const batch1 = items1.slice(i, i + batchSize);
      const batch2 = items2.slice(i, i + batchSize);
      
      const batchPromises = batch1.map(async (item1, index) => {
        const item2 = batch2[index];
        if (!item2) return null;
        
        return await this.detect(item1, item2, options);
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(result => result !== null));
    }
    
    return results;
  }

  // 配置更新
  updateConfiguration(newOptions) {
    this.options = {
      ...this.options,
      ...newOptions
    };
  }

  // 統計和診斷
  getDetectorInfo() {
    return {
      type: 'ProgressConflictDetector',
      version: '2.0.0',
      configuration: this.options,
      capabilities: [
        'time-weighted-detection',
        'source-reliability-assessment', 
        'confidence-scoring',
        'batch-processing'
      ]
    };
  }
}

module.exports = ProgressConflictDetector;