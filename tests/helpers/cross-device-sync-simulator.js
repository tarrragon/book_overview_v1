/**
 * Cross Device Sync Simulator - 跨裝置同步模擬器
 * 模擬跨裝置同步的各種情境
 */

class CrossDeviceSyncSimulator {
  constructor() {
    this.devices = new Map()
    this.syncStatus = 'idle'
  }

  /**
   * 模擬新增裝置
   */
  addDevice(deviceId, deviceInfo = {}) {
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
  async simulateSync(fromDevice, toDevice, data) {
    this.syncStatus = 'syncing'
    
    // 模擬同步延遲
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const fromDeviceData = this.devices.get(fromDevice)
    const toDeviceData = this.devices.get(toDevice)
    
    if (!fromDeviceData || !toDeviceData) {
      this.syncStatus = 'error'
      throw new Error('Device not found')
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
  async simulateSyncConflict(deviceA, deviceB) {
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
  getDeviceStatus(deviceId) {
    return this.devices.get(deviceId)
  }

  /**
   * 獲取同步狀態
   */
  getSyncStatus() {
    return this.syncStatus
  }

  /**
   * 重置模擬器
   */
  reset() {
    this.devices.clear()
    this.syncStatus = 'idle'
  }
}

module.exports = CrossDeviceSyncSimulator