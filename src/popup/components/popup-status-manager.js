/**
 * PopupStatusManager - Popup 狀態管理器
 * 
 * 負責功能：
 * - 管理 Popup 擴展狀態的生命週期
 * - 提供狀態類型驗證和一致性檢查
 * - 與 Background Service Worker 進行狀態同步
 * - 支援事件驅動的狀態更新機制
 * 
 * 設計考量：
 * - 單一職責：只負責狀態管理，UI 更新委託給組件層
 * - 不可變性：所有狀態操作都保持數據不可變
 * - 錯誤處理：完整的驗證和錯誤恢復機制
 * - 擴展性：支援未來新增狀態類型
 * 
 * 使用情境：
 * - 作為 Popup 界面的核心狀態協調者
 * - 與 UX Domain 狀態服務整合的橋接
 * - 提供統一的狀態管理 API
 * 
 * @version 1.0.0
 * @since 2025-08-18
 */

class PopupStatusManager {
  /**
   * 建構 PopupStatusManager
   * @param {Object} uiComponents - UI 組件實例，用於更新界面
   */
  constructor(uiComponents) {
    this.uiComponents = uiComponents
    
    // 有效的狀態類型
    this.validStatusTypes = ['loading', 'ready', 'error', 'extracting', 'completed']
    
    // 初始化默認狀態
    this.currentStatus = {
      type: 'loading',
      text: '正在檢查狀態...',
      info: '請稍候，正在初始化擴展功能'
    }
  }

  /**
   * 更新擴展狀態
   * @param {Object} statusData - 狀態資料
   * @param {string} statusData.type - 狀態類型
   * @param {string} statusData.text - 狀態文字
   * @param {string} [statusData.info] - 狀態詳細資訊
   */
  updateStatus(statusData) {
    // 驗證必要欄位
    if (!statusData || !statusData.type || !statusData.text) {
      throw new Error('Status must include type and text fields')
    }

    // 驗證狀態類型
    if (!this.validStatusTypes.includes(statusData.type)) {
      throw new Error(`Invalid status type: ${statusData.type}`)
    }

    // 更新內部狀態
    this.currentStatus = { ...statusData }

    // 更新 UI 顯示
    this.uiComponents.updateStatus(statusData)
  }

  /**
   * 獲取當前狀態
   * @returns {Object} 當前狀態資料
   */
  getCurrentStatus() {
    return { ...this.currentStatus }
  }

  /**
   * 與 Background Service Worker 狀態同步
   * @param {Object} backgroundStatus - 來自背景的狀態資料
   */
  syncFromBackground(backgroundStatus) {
    // 直接使用背景狀態更新
    this.currentStatus = { ...backgroundStatus }
    
    // 更新 UI 顯示
    this.uiComponents.updateStatus(backgroundStatus)
  }

  /**
   * 處理背景同步失敗
   * @param {string} errorMessage - 錯誤訊息
   */
  handleSyncFailure(errorMessage) {
    const errorInfo = {
      message: `與背景服務同步失敗: ${errorMessage}`,
      type: 'sync_error'
    }
    
    // 顯示錯誤
    this.uiComponents.showError(errorInfo)
  }
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PopupStatusManager
}