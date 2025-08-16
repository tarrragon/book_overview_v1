/**
 * 時間戳衝突檢測器
 * 
 * 負責功能：
 * - 檢測時間戳相關的資料衝突
 * - 智能分析時間差異對資料一致性的影響
 * - 支援多時區和時間格式的處理
 * - 提供基於時間的衝突嚴重程度評估
 */

class TimestampConflictDetector {
  constructor(options = {}) {
    this.options = {
      // 時間差異閾值 (毫秒)
      minConflictThreshold: options.minConflictThreshold || 3600000, // 1小時
      mediumConflictThreshold: options.mediumConflictThreshold || 86400000, // 1天
      highConflictThreshold: options.highConflictThreshold || 604800000, // 7天
      
      // 資料一致性要求
      allowDataRegression: options.allowDataRegression !== false, // 是否允許資料回退
      maxReasonableAge: options.maxReasonableAge || 31536000000, // 1年
      
      // 時區處理
      defaultTimezone: options.defaultTimezone || 'UTC',
      timezoneDetection: options.timezoneDetection !== false,
      
      ...options
    };
  }

  async detect(item1, item2, options = {}) {
    // 提取時間戳資訊
    const timestamp1 = this.extractTimestampInfo(item1);
    const timestamp2 = this.extractTimestampInfo(item2);

    // 驗證時間戳有效性
    if (!this.isValidTimestamp(timestamp1) || !this.isValidTimestamp(timestamp2)) {
      return null; // 無效時間戳，無法比較
    }

    // 計算時間差異
    const timeDifference = Math.abs(timestamp1.normalized - timestamp2.normalized);

    // 檢查是否構成衝突
    if (timeDifference < this.options.minConflictThreshold) {
      return null; // 時間差異太小，不構成衝突
    }

    // 分析資料一致性
    const consistencyAnalysis = this.analyzeDataConsistency(item1, item2, timestamp1, timestamp2);

    // 如果資料與時間順序一致，不是衝突
    if (consistencyAnalysis.isConsistent && this.options.allowDataRegression) {
      return null;
    }

    // 計算嚴重程度和信心度
    const severity = this.calculateSeverity(timeDifference, consistencyAnalysis);
    const confidence = this.calculateConfidence(timestamp1, timestamp2, consistencyAnalysis);

    return {
      severity,
      confidence,
      details: {
        timestamp1: timestamp1.original,
        timestamp2: timestamp2.original,
        normalizedTimestamp1: new Date(timestamp1.normalized).toISOString(),
        normalizedTimestamp2: new Date(timestamp2.normalized).toISOString(),
        timeDifference,
        timeDifferenceHours: timeDifference / (1000 * 60 * 60),
        consistencyAnalysis,
        timezoneDifference: this.detectTimezoneDifference(timestamp1, timestamp2)
      },
      metadata: {
        detectorType: 'timestamp',
        algorithm: 'temporal-consistency-analysis',
        version: '2.0'
      }
    };
  }

  extractTimestampInfo(item) {
    // 嘗試多個可能的時間戳欄位
    const timestampFields = [
      'lastUpdated', 'timestamp', 'updatedAt', 
      'modifiedAt', 'progressUpdated', 'syncTime'
    ];

    let timestamp = null;
    let source = 'unknown';

    for (const field of timestampFields) {
      if (item[field]) {
        timestamp = item[field];
        source = field;
        break;
      }
    }

    if (!timestamp) {
      return null;
    }

    // 正規化時間戳
    const normalized = this.normalizeTimestamp(timestamp);
    
    return {
      original: timestamp,
      normalized,
      source,
      format: this.detectTimestampFormat(timestamp),
      timezone: this.detectTimezone(timestamp, item)
    };
  }

  normalizeTimestamp(timestamp) {
    if (typeof timestamp === 'number') {
      // 處理 Unix 時間戳
      if (timestamp < 1e12) {
        // 看起來是秒為單位
        return timestamp * 1000;
      }
      return timestamp;
    }

    if (typeof timestamp === 'string') {
      const parsed = Date.parse(timestamp);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    if (timestamp instanceof Date) {
      return timestamp.getTime();
    }

    throw new Error(`Cannot normalize timestamp: ${timestamp}`);
  }

  detectTimestampFormat(timestamp) {
    if (typeof timestamp === 'number') {
      return timestamp < 1e12 ? 'unix_seconds' : 'unix_milliseconds';
    }

    if (typeof timestamp === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timestamp)) {
        return 'iso8601';
      }
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(timestamp)) {
        return 'mysql_datetime';
      }
      if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(timestamp)) {
        return 'us_date_format';
      }
    }

    return 'unknown';
  }

  detectTimezone(timestamp, item) {
    // 簡化的時區檢測
    if (typeof timestamp === 'string') {
      if (timestamp.includes('Z')) {
        return 'UTC';
      }
      if (/[+-]\d{2}:\d{2}$/.test(timestamp)) {
        return 'offset_specified';
      }
    }

    // 從項目中尋找時區資訊
    if (item.timezone) {
      return item.timezone;
    }

    if (item.source) {
      // 根據來源推測時區
      const sourceTimezones = {
        'readmoo': 'Asia/Taipei',
        'kindle': 'user_local',
        'kobo': 'user_local'
      };
      return sourceTimezones[item.source] || this.options.defaultTimezone;
    }

    return this.options.defaultTimezone;
  }

  isValidTimestamp(timestampInfo) {
    if (!timestampInfo || !timestampInfo.normalized) {
      return false;
    }

    const now = Date.now();
    const timestamp = timestampInfo.normalized;

    // 檢查是否在合理範圍內
    const minValidTime = now - this.options.maxReasonableAge; // 1年前
    const maxValidTime = now + 86400000; // 明天

    return timestamp >= minValidTime && timestamp <= maxValidTime;
  }

  analyzeDataConsistency(item1, item2, timestamp1, timestamp2) {
    const analysis = {
      isConsistent: true,
      inconsistencies: [],
      dataRegression: false,
      progressRegression: false
    };

    // 確定哪個是較新的資料
    const isItem1Newer = timestamp1.normalized > timestamp2.normalized;
    const newerItem = isItem1Newer ? item1 : item2;
    const olderItem = isItem1Newer ? item2 : item1;

    // 檢查進度一致性
    if (newerItem.progress !== undefined && olderItem.progress !== undefined) {
      if (newerItem.progress < olderItem.progress) {
        analysis.isConsistent = false;
        analysis.progressRegression = true;
        analysis.inconsistencies.push('progress_regression');
      }
    }

    // 檢查其他可能的資料回退
    const comparableFields = ['bookmarks', 'notes', 'highlights'];
    
    for (const field of comparableFields) {
      if (newerItem[field] !== undefined && olderItem[field] !== undefined) {
        if (Array.isArray(newerItem[field]) && Array.isArray(olderItem[field])) {
          if (newerItem[field].length < olderItem[field].length) {
            analysis.isConsistent = false;
            analysis.dataRegression = true;
            analysis.inconsistencies.push(`${field}_regression`);
          }
        }
      }
    }

    // 檢查標題或其他不應該變化的欄位
    if (newerItem.title && olderItem.title && newerItem.title !== olderItem.title) {
      analysis.inconsistencies.push('title_change');
    }

    return analysis;
  }

  detectTimezoneDifference(timestamp1, timestamp2) {
    // 如果都有明確的時區資訊，比較差異
    if (timestamp1.timezone && timestamp2.timezone) {
      if (timestamp1.timezone === timestamp2.timezone) {
        return { hasDifference: false, timezone1: timestamp1.timezone, timezone2: timestamp2.timezone };
      } else {
        return { 
          hasDifference: true, 
          timezone1: timestamp1.timezone, 
          timezone2: timestamp2.timezone,
          potentialOffset: this.estimateTimezoneOffset(timestamp1, timestamp2)
        };
      }
    }

    return { hasDifference: false, reason: 'insufficient_timezone_info' };
  }

  estimateTimezoneOffset(timestamp1, timestamp2) {
    // 簡化的時區偏移估算
    const timeDiff = timestamp1.normalized - timestamp2.normalized;
    const hourDiff = timeDiff / (1000 * 60 * 60);
    
    // 檢查是否是常見的時區偏移量
    const commonOffsets = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12];
    
    for (const offset of commonOffsets) {
      if (Math.abs(hourDiff - offset) < 0.1) {
        return offset;
      }
    }

    return null; // 非標準偏移
  }

  calculateSeverity(timeDifference, consistencyAnalysis) {
    // 基於資料一致性的嚴重程度
    if (consistencyAnalysis.progressRegression || consistencyAnalysis.dataRegression) {
      return 'HIGH'; // 資料回退是嚴重問題
    }

    if (consistencyAnalysis.inconsistencies.length > 2) {
      return 'MEDIUM';
    }

    // 基於時間差異的嚴重程度
    if (timeDifference >= this.options.highConflictThreshold) {
      return 'LOW'; // 時間差異很大，可能是正常的不同步
    } else if (timeDifference >= this.options.mediumConflictThreshold) {
      return 'MEDIUM';
    } else {
      return 'HIGH'; // 短時間內的不一致更令人擔憂
    }
  }

  calculateConfidence(timestamp1, timestamp2, consistencyAnalysis) {
    let confidence = 0.8; // 基礎信心度

    // 根據時間戳格式可靠性調整
    const formatReliability = {
      'iso8601': 0.95,
      'unix_milliseconds': 0.90,
      'unix_seconds': 0.85,
      'mysql_datetime': 0.80,
      'us_date_format': 0.70,
      'unknown': 0.50
    };

    const reliability1 = formatReliability[timestamp1.format] || 0.50;
    const reliability2 = formatReliability[timestamp2.format] || 0.50;
    confidence *= (reliability1 + reliability2) / 2;

    // 根據時區資訊調整
    if (timestamp1.timezone && timestamp2.timezone) {
      confidence *= 1.1; // 有時區資訊更可靠
    } else {
      confidence *= 0.9; // 缺少時區資訊
    }

    // 根據一致性分析調整
    if (consistencyAnalysis.progressRegression) {
      confidence *= 1.3; // 進度回退是明確的衝突信號
    }

    if (consistencyAnalysis.inconsistencies.length === 0) {
      confidence *= 0.7; // 沒有其他不一致可能是時區問題
    }

    return Math.min(1.0, Math.max(0.1, confidence));
  }

  // 時間同步建議
  generateSyncRecommendations(timestamp1, timestamp2, timeDifference) {
    const recommendations = [];

    if (timeDifference > this.options.highConflictThreshold) {
      recommendations.push('建議檢查資料來源的時間同步設定');
      recommendations.push('可能需要考慮時區差異');
    }

    if (timestamp1.timezone !== timestamp2.timezone) {
      recommendations.push('建議統一時區設定');
      recommendations.push('考慮將所有時間戳正規化為UTC');
    }

    recommendations.push('建議定期檢查系統時間同步');

    return recommendations;
  }

  // 批次處理
  async detectBatch(items1, items2, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 200; // 時間戳比較相對簡單，可用較大批次

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

  getDetectorInfo() {
    return {
      type: 'TimestampConflictDetector',
      version: '2.0.0',
      configuration: this.options,
      capabilities: [
        'multi-format-timestamp-support',
        'timezone-detection',
        'data-consistency-analysis',
        'sync-recommendations'
      ]
    };
  }
}

module.exports = TimestampConflictDetector;