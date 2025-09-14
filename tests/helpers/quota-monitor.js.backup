/**
 * Chrome Storage 配額監控器
 * 用於監控和管理 Chrome Storage API 的配額使用
 */

class QuotaMonitor {
  constructor (options = {}) {
    this.options = {
      warningThreshold: options.warningThreshold || 0.8,
      criticalThreshold: options.criticalThreshold || 0.9,
      enableLogging: options.enableLogging || false,
      checkInterval: options.checkInterval || 5000,
      ...options
    }

    this.currentUsage = {
      usage: 0,
      quota: 10 * 1024 * 1024,
      percentage: 0,
      lastChecked: Date.now()
    }

    this.listeners = []
    this.checkTimer = null
  }

  async startMonitoring () {
    if (this.checkTimer) {
      this.stopMonitoring()
    }

    await this.checkQuota()
    return true
  }

  stopMonitoring () {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
  }

  async checkQuota () {
    try {
      const mockUsage = Math.floor(Math.random() * 5 * 1024 * 1024)
      const mockQuota = 10 * 1024 * 1024
      const percentage = mockUsage / mockQuota

      this.currentUsage = {
        usage: mockUsage,
        quota: mockQuota,
        percentage,
        lastChecked: Date.now()
      }

      return this.currentUsage
    } catch (error) {
      return null
    }
  }

  getCurrentUsage () {
    return { ...this.currentUsage }
  }

  async reset () {
    this.currentUsage = {
      usage: 0,
      quota: 10 * 1024 * 1024,
      percentage: 0,
      lastChecked: Date.now()
    }
  }

  async cleanup () {
    this.stopMonitoring()
    this.listeners = []
  }
}

module.exports = { QuotaMonitor }
