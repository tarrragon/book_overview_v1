/**
 * 智能快取管理器
 * 
 * 負責功能：
 * - 多層次快取策略 (L1內存 + L2持久化)
 * - 智能快取失效和清理
 * - 快取效能監控和統計
 * - 記憶體壓力感知和自動清理
 */

class LRUCache {
  constructor(options = {}) {
    this.maxSize = options.max || 1000;
    this.cache = new Map();
    this.accessOrder = [];
  }

  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    // 更新訪問順序
    this.updateAccessOrder(key);
    return this.cache.get(key);
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      this.updateAccessOrder(key);
      return;
    }

    // 檢查容量
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  updateAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  evictLRU() {
    if (this.accessOrder.length === 0) return;
    
    const lruKey = this.accessOrder.shift();
    this.cache.delete(lruKey);
  }

  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  size() {
    return this.cache.size;
  }

  getMemoryUsage() {
    // 估算記憶體使用量
    let totalSize = 0;
    for (const [key, value] of this.cache) {
      totalSize += JSON.stringify(key).length + JSON.stringify(value).length;
    }
    return totalSize;
  }
}

class PersistentCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 50 * 1024 * 1024; // 50MB
    this.cache = new Map();
    this.currentSize = 0;
  }

  async get(key) {
    return this.cache.get(key) || null;
  }

  async set(key, value) {
    const serialized = JSON.stringify(value);
    const size = serialized.length;

    // 檢查是否需要清理空間
    if (this.currentSize + size > this.maxSize) {
      await this.cleanup();
    }

    this.cache.set(key, value);
    this.currentSize += size;
  }

  async cleanup() {
    // 簡單的FIFO清理策略
    const keys = Array.from(this.cache.keys());
    const keysToRemove = keys.slice(0, Math.floor(keys.length * 0.3));

    for (const key of keysToRemove) {
      const value = this.cache.get(key);
      if (value) {
        this.currentSize -= JSON.stringify(value).length;
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
    this.currentSize = 0;
  }

  getSize() {
    return this.currentSize;
  }
}

class IntelligentCacheManager {
  constructor(options = {}) {
    this.l1Cache = new LRUCache({ 
      max: options.l1Size || 1000 
    });
    
    this.l2Cache = new PersistentCache({ 
      maxSize: options.l2Size || 50 * 1024 * 1024 // 50MB
    });

    this.options = {
      ttl: options.ttl || 300000, // 5分鐘預設TTL
      memoryPressureThreshold: options.memoryPressureThreshold || 0.8,
      ...options
    };

    this.statistics = {
      l1Hits: 0,
      l2Hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };

    this.timestamps = new Map(); // 記錄設置時間用於TTL
  }

  async get(key) {
    const now = Date.now();
    
    // 檢查TTL
    if (this.isExpired(key, now)) {
      this.invalidate(key);
      this.statistics.misses++;
      return null;
    }

    // L1 快取檢查
    let result = this.l1Cache.get(key);
    if (result !== null) {
      this.statistics.l1Hits++;
      return result;
    }

    // L2 快取檢查
    result = await this.l2Cache.get(key);
    if (result !== null) {
      this.statistics.l2Hits++;
      // 提升到 L1 快取
      this.l1Cache.set(key, result);
      return result;
    }

    this.statistics.misses++;
    return null;
  }

  async set(key, value) {
    this.statistics.sets++;
    
    // 設置時間戳
    this.timestamps.set(key, Date.now());
    
    // 檢查記憶體壓力
    if (this.isMemoryPressureHigh()) {
      await this.performPressureRelief();
    }

    // 同時寫入 L1 和 L2
    this.l1Cache.set(key, value);
    await this.l2Cache.set(key, value);
  }

  isExpired(key, now) {
    const timestamp = this.timestamps.get(key);
    if (!timestamp) return true;
    
    return (now - timestamp) > this.options.ttl;
  }

  invalidate(key) {
    this.l1Cache.cache.delete(key);
    this.l2Cache.cache.delete(key);
    this.timestamps.delete(key);
  }

  isMemoryPressureHigh() {
    const l1Memory = this.l1Cache.getMemoryUsage();
    const l2Memory = this.l2Cache.getSize();
    const totalMemory = l1Memory + l2Memory;
    
    // 簡化的記憶體壓力檢測
    return totalMemory > (this.options.l2Size * this.options.memoryPressureThreshold);
  }

  async performPressureRelief() {
    this.statistics.evictions++;
    
    // 清理過期項目
    this.cleanupExpiredItems();
    
    // 如果仍有壓力，強制清理部分 L1 快取
    if (this.isMemoryPressureHigh()) {
      const currentSize = this.l1Cache.size();
      const targetSize = Math.floor(currentSize * 0.7);
      
      while (this.l1Cache.size() > targetSize) {
        this.l1Cache.evictLRU();
      }
    }
  }

  cleanupExpiredItems() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, timestamp] of this.timestamps) {
      if (now - timestamp > this.options.ttl) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.invalidate(key);
    }
  }

  getHitRates() {
    const total = this.statistics.l1Hits + this.statistics.l2Hits + this.statistics.misses;
    
    if (total === 0) {
      return { l1: 0, l2: 0, overall: 0 };
    }
    
    return {
      l1: this.statistics.l1Hits / total,
      l2: this.statistics.l2Hits / total,
      overall: (this.statistics.l1Hits + this.statistics.l2Hits) / total
    };
  }

  getStatistics() {
    return {
      ...this.statistics,
      hitRates: this.getHitRates(),
      cacheSize: {
        l1Items: this.l1Cache.size(),
        l2Items: this.l2Cache.cache.size,
        l1Memory: this.l1Cache.getMemoryUsage(),
        l2Memory: this.l2Cache.getSize()
      },
      memoryPressure: this.isMemoryPressureHigh()
    };
  }

  async cleanup() {
    this.l1Cache.clear();
    this.l2Cache.clear();
    this.timestamps.clear();
    
    this.statistics = {
      l1Hits: 0,
      l2Hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };
  }

  // 記憶體優化方法
  optimize() {
    // 1. 清理過期項目
    this.cleanupExpiredItems();
    
    // 2. 如果 L1 使用率低，縮小容量
    const hitRate = this.getHitRates().l1;
    if (hitRate < 0.3 && this.l1Cache.maxSize > 100) {
      this.l1Cache.maxSize = Math.max(100, Math.floor(this.l1Cache.maxSize * 0.8));
    }
    
    // 3. 如果命中率高，適度擴大容量
    if (hitRate > 0.8 && this.l1Cache.maxSize < 2000) {
      this.l1Cache.maxSize = Math.min(2000, Math.floor(this.l1Cache.maxSize * 1.2));
    }
  }
}

module.exports = IntelligentCacheManager;