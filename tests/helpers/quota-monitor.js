/**
 * Quota Monitor - 配額監控器
 */

class QuotaMonitor {
  constructor() {
    this.quotaUsage = {
      used: 0,
      total: 1000000, // 預設 1MB
      percentage: 0
    }
    this.quotaHistory = []
    this.warnings = []
  }

  /**
   * 更新配額使用量
   */
  updateUsage(bytesUsed) {
    this.quotaUsage.used = bytesUsed
    this.quotaUsage.percentage = (bytesUsed / this.quotaUsage.total) * 100

    // 記錄歷史
    this.quotaHistory.push({
      used: bytesUsed,
      percentage: this.quotaUsage.percentage,
      timestamp: new Date()
    })

    // 檢查警告條件
    this.checkWarningConditions()

    return this.quotaUsage
  }

  /**
   * 設置配額總量
   */
  setTotalQuota(totalBytes) {
    this.quotaUsage.total = totalBytes
    this.quotaUsage.percentage = (this.quotaUsage.used / totalBytes) * 100
  }

  /**
   * 檢查是否超出配額
   */
  isQuotaExceeded() {
    return this.quotaUsage.used > this.quotaUsage.total
  }

  /**
   * 檢查是否接近配額限制
   */
  isNearQuotaLimit(threshold = 80) {
    return this.quotaUsage.percentage > threshold
  }

  /**
   * 獲取配額狀態
   */
  getQuotaStatus() {
    return {
      ...this.quotaUsage,
      exceeded: this.isQuotaExceeded(),
      nearLimit: this.isNearQuotaLimit(),
      warningsCount: this.warnings.length
    }
  }

  /**
   * 檢查警告條件
   */
  checkWarningConditions() {
    if (this.quotaUsage.percentage > 90) {
      this.addWarning('QUOTA_CRITICAL', 'Quota usage is critical (>90%)')
    } else if (this.quotaUsage.percentage > 80) {
      this.addWarning('QUOTA_WARNING', 'Quota usage is high (>80%)')
    }
  }

  /**
   * 添加警告
   */
  addWarning(type, message) {
    // 避免重複警告
    const recentWarnings = this.warnings.filter(w => 
      w.type === type && 
      (new Date() - w.timestamp) < 5000 // 5秒內不重複
    )

    if (recentWarnings.length === 0) {
      this.warnings.push({
        type,
        message,
        percentage: this.quotaUsage.percentage,
        timestamp: new Date()
      })
    }
  }

  /**
   * 模擬配額變化
   */
  simulateUsageChange(deltaBytes) {
    const newUsage = Math.max(0, this.quotaUsage.used + deltaBytes)
    return this.updateUsage(newUsage)
  }

  /**
   * 獲取使用趨勢
   */
  getUsageTrend(timeWindow = 60000) { // 預設1分鐘
    const now = new Date()
    const windowStart = new Date(now.getTime() - timeWindow)
    
    const recentHistory = this.quotaHistory.filter(h => h.timestamp >= windowStart)
    
    if (recentHistory.length < 2) {
      return { trend: 'stable', change: 0 }
    }

    const oldestUsage = recentHistory[0].used
    const newestUsage = recentHistory[recentHistory.length - 1].used
    const change = newestUsage - oldestUsage

    return {
      trend: change > 0 ? 'increasing' : change < 0 ? 'decreasing' : 'stable',
      change,
      changePercentage: (change / this.quotaUsage.total) * 100
    }
  }

  /**
   * 重置監控器
   */
  reset() {
    this.quotaUsage = {
      used: 0,
      total: 1000000,
      percentage: 0
    }
    this.quotaHistory = []
    this.warnings = []
  }
}

module.exports = QuotaMonitor