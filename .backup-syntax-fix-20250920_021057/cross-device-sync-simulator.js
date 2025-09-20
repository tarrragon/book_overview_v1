const { ErrorCodes } = require('src/core/errors/ErrorCodes')
/**
 * Cross Device Sync Simulator - 跨裝置同步模擬器
 * 模擬跨裝置同步的各種情境
 */

class CrossDeviceSyncSimulator {
  constructor () {
    this.devices = new Map()
    this.syncStatus = 'idle'
  }

  /**
   * 模擬新增裝置
   */
  addDevice (deviceId, deviceInfo = {}) {
    this.devices.set(deviceId, {
      id: deviceId,
      name: deviceInfo.name || `Device ${deviceId}`,
      lastSync: new Date(),
      status: 'online',
      ...deviceInfo
    })
  }

  /**
   * 模擬同步過程
   */
  async simulateSync (fromDevice, toDevice, data) {
    this.syncStatus = 'syncing'

    // 模擬同步延遲
    await new Promise(resolve => setTimeout(resolve, 100))

    const fromDeviceData = this.devices.get(fromDevice)
    const toDeviceData = this.devices.get(toDevice)

    if (!fromDeviceData || !toDeviceData) {
      this.syncStatus = 'error'
      throw (() => { const error = new Error('Device not found'); error.code = ErrorCodes.NOT_FOUND_ERROR; error.details = { category: 'testing' }; return error })()
    }

    // 更新同步時間
    fromDeviceData.lastSync = new Date()
    toDeviceData.lastSync = new Date()

    this.syncStatus = 'completed'

    return {
      success: true,
      syncedAt: new Date(),
      dataCount: data ? data.length : 0
    }
  }

  /**
   * 模擬同步衝突
   */
  async simulateSyncConflict (deviceA, deviceB) {
    this.syncStatus = 'conflict'

    return {
      success: false,
      conflict: true,
      devices: [deviceA, deviceB],
      reason: 'Data conflict detected'
    }
  }

  /**
   * 獲取裝置狀態
   */
  getDeviceStatus (deviceId) {
    return this.devices.get(deviceId)
  }

  /**
   * 獲取同步狀態
   */
  getSyncStatus () {
    return this.syncStatus
  }

  /**
   * 重置模擬器
   */
  reset () {
    this.devices.clear()
    this.syncStatus = 'idle'
  }

  /**
   * 切換到設備B
   */
  async switchToDeviceB () {
    this.currentDevice = 'deviceB'
    this.addDevice('deviceB', { name: 'Device B', status: 'online' })

    // 模擬設備切換延遲
    await new Promise(resolve => setTimeout(resolve, 100))

    return {
      success: true,
      currentDevice: 'deviceB',
      deviceInfo: this.devices.get('deviceB')
    }
  }

  /**
   * 切換到替代設備（輪換使用）
   */
  async switchToAlternateDevice () {
    const currentDevice = this.currentDevice || 'deviceA'
    const alternateDevice = currentDevice === 'deviceA' ? 'deviceB' : 'deviceA'

    this.currentDevice = alternateDevice
    this.addDevice(alternateDevice, {
      name: `Device ${alternateDevice.slice(-1).toUpperCase()}`,
      status: 'online'
    })

    // 模擬設備切換延遲
    await new Promise(resolve => setTimeout(resolve, 100))

    return {
      success: true,
      currentDevice: alternateDevice,
      deviceInfo: this.devices.get(alternateDevice)
    }
  }

  /**
   * 計算資料摘要（用於驗證資料一致性）
   */
  async calculateDataDigest (books) {
    if (!Array.isArray(books)) {
      throw (() => { const error = new Error('Books must be an array'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
    }

    // 創建用於計算摘要的標準化資料
    const normalizedBooks = books.map(book => ({
      id: book.id,
      title: book.title,
      progress: book.progress,
      status: book.status || 'unknown'
    })).sort((a, b) => a.id.localeCompare(b.id))

    // 計算簡單的摘要
    const dataString = JSON.stringify(normalizedBooks)
    let hash = 0
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 轉換為32位元整數
    }

    return {
      hash: hash.toString(16),
      bookCount: books.length,
      totalProgress: books.reduce((sum, book) => sum + (book.progress || 0), 0),
      lastCalculated: new Date().toISOString(),
      dataString: dataString.length > 1000 ? dataString.substring(0, 1000) + '...' : dataString
    }
  }

  /**
   * 清理資源
   */
  async cleanup () {
    // 停止所有進行中的同步
    this.syncStatus = 'stopped'

    // 清理所有設備狀態
    this.devices.clear()

    // 重置當前設備
    this.currentDevice = null

    // 模擬清理延遲
    await new Promise(resolve => setTimeout(resolve, 50))

    return {
      success: true,
      message: 'Cleanup completed',
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 模擬設備間資料衝突
   */
  async simulateConflict (deviceAData, deviceBData, conflictType = 'progress_mismatch') {
    const conflicts = []

    // 檢查相同書籍的衝突
    deviceAData.forEach(bookA => {
      const bookB = deviceBData.find(b => b.id === bookA.id)
      if (bookB) {
        switch (conflictType) {
          case 'progress_mismatch':
            if (Math.abs(bookA.progress - bookB.progress) > 10) {
              conflicts.push({
                bookId: bookA.id,
                type: 'progress_mismatch',
                deviceA: { progress: bookA.progress },
                deviceB: { progress: bookB.progress },
                suggestedResolution: 'use_higher_progress'
              })
            }
            break
          case 'status_conflict':
            if (bookA.status !== bookB.status) {
              conflicts.push({
                bookId: bookA.id,
                type: 'status_conflict',
                deviceA: { status: bookA.status },
                deviceB: { status: bookB.status },
                suggestedResolution: 'merge_statuses'
              })
            }
            break
        }
      }
    })

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      conflictCount: conflicts.length,
      resolutionStrategy: conflictType === 'progress_mismatch' ? 'auto_resolve' : 'manual_review'
    }
  }

  /**
   * 獲取當前設備
   */
  getCurrentDevice () {
    return this.currentDevice || 'deviceA'
  }

  /**
   * 比較兩個設備的資料差異
   * @param {Array} deviceAData - 設備A的資料
   * @param {Array} deviceBData - 設備B的資料
   * @returns {Object} 比較結果
   */
  async compareDeviceData (deviceAData, deviceBData) {
    const results = {
      identicalCount: 0,
      differences: [],
      missingInA: [],
      missingInB: [],
      totalA: deviceAData.length,
      totalB: deviceBData.length
    }

    // 建立資料索引以便快速比較
    const deviceAIndex = new Map()
    const deviceBIndex = new Map()

    deviceAData.forEach((item, index) => {
      const key = item.id || item.title || `item_${index}`
      deviceAIndex.set(key, item)
    })

    deviceBData.forEach((item, index) => {
      const key = item.id || item.title || `item_${index}`
      deviceBIndex.set(key, item)
    })

    // 比較 A 中的每個項目
    for (const [key, itemA] of deviceAIndex) {
      if (deviceBIndex.has(key)) {
        const itemB = deviceBIndex.get(key)
        // 深度比較
        if (JSON.stringify(itemA) === JSON.stringify(itemB)) {
          results.identicalCount++
        } else {
          results.differences.push({
            key,
            deviceA: itemA,
            deviceB: itemB,
            type: 'modified'
          })
        }
      } else {
        results.missingInB.push({
          key,
          data: itemA
        })
      }
    }

    // 檢查 B 中有但 A 中沒有的項目
    for (const [key, itemB] of deviceBIndex) {
      if (!deviceAIndex.has(key)) {
        results.missingInA.push({
          key,
          data: itemB
        })
      }
    }

    return results
  }

  /**
   * 模擬網路延遲
   */
  async simulateNetworkDelay (ms = 200) {
    await new Promise(resolve => setTimeout(resolve, ms))
  }
}

module.exports = CrossDeviceSyncSimulator
