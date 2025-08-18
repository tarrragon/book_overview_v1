/**
 * PopupStatusManager 單元測試
 * 
 * 負責測試：
 * - 狀態管理核心功能
 * - 狀態類型驗證
 * - 與 Background Service Worker 同步
 * - 事件驅動狀態更新
 */

describe('PopupStatusManager 核心功能', () => {
  let statusManager
  let mockUIComponents

  beforeEach(() => {
    // 建立 Mock UI 組件
    mockUIComponents = {
      updateStatus: jest.fn(),
      showError: jest.fn(),
      hideError: jest.fn()
    }

    // 重置所有 Mock
    jest.clearAllMocks()
  })

  describe('📊 基本狀態更新功能', () => {
    test('應該正確更新擴展狀態', () => {
      // Given: 狀態管理器和初始狀態
      const PopupStatusManager = require('../../../src/popup/components/popup-status-manager.js')
      statusManager = new PopupStatusManager(mockUIComponents)

      // When: 呼叫狀態更新方法
      const statusData = {
        type: 'ready',
        text: '擴展就緒',
        info: '可以開始提取書庫資料'
      }
      statusManager.updateStatus(statusData)

      // Then: 狀態正確更新並觸發相關事件
      expect(mockUIComponents.updateStatus).toHaveBeenCalledWith(statusData)
      expect(statusManager.getCurrentStatus()).toEqual(statusData)
    })

    test('應該正確處理狀態類型驗證', () => {
      // Given: 無效的狀態類型
      const PopupStatusManager = require('../../../src/popup/components/popup-status-manager.js')
      statusManager = new PopupStatusManager(mockUIComponents)

      // When: 嘗試更新無效狀態
      const invalidStatusData = {
        type: 'invalid_type',
        text: '測試'
      }

      // Then: 應該拋出適當錯誤並保持原始狀態
      expect(() => {
        statusManager.updateStatus(invalidStatusData)
      }).toThrow('Invalid status type: invalid_type')
      
      expect(mockUIComponents.updateStatus).not.toHaveBeenCalled()
    })

    test('應該正確初始化默認狀態', () => {
      // Given: 新建狀態管理器
      const PopupStatusManager = require('../../../src/popup/components/popup-status-manager.js')
      statusManager = new PopupStatusManager(mockUIComponents)

      // When: 取得初始狀態
      const initialStatus = statusManager.getCurrentStatus()

      // Then: 應有正確的默認狀態
      expect(initialStatus).toEqual({
        type: 'loading',
        text: '正在檢查狀態...',
        info: '請稍候，正在初始化擴展功能'
      })
    })
  })

  describe('🔄 狀態同步功能', () => {
    test('應該與 Background Service Worker 狀態同步', () => {
      // Given: Background 狀態變化
      const PopupStatusManager = require('../../../src/popup/components/popup-status-manager.js')
      statusManager = new PopupStatusManager(mockUIComponents)
      
      const backgroundStatus = {
        type: 'ready',
        text: '背景服務就緒',
        info: 'Background Service Worker 正常運作'
      }

      // When: 接收狀態同步事件
      statusManager.syncFromBackground(backgroundStatus)

      // Then: 本地狀態正確更新
      expect(statusManager.getCurrentStatus()).toEqual(backgroundStatus)
      expect(mockUIComponents.updateStatus).toHaveBeenCalledWith(backgroundStatus)
    })

    test('應該正確處理背景狀態同步失敗', () => {
      // Given: 背景同步失敗
      const PopupStatusManager = require('../../../src/popup/components/popup-status-manager.js')
      statusManager = new PopupStatusManager(mockUIComponents)

      // When: 背景同步失敗
      statusManager.handleSyncFailure('Network timeout')

      // Then: 應顯示錯誤狀態
      expect(mockUIComponents.showError).toHaveBeenCalledWith({
        message: '與背景服務同步失敗: Network timeout',
        type: 'sync_error'
      })
    })
  })

  describe('🎯 狀態驗證與錯誤處理', () => {
    test('應該驗證必要的狀態欄位', () => {
      // Given: 缺少必要欄位的狀態
      const PopupStatusManager = require('../../../src/popup/components/popup-status-manager.js')
      statusManager = new PopupStatusManager(mockUIComponents)

      // When: 嘗試更新不完整狀態
      const incompleteStatus = { type: 'ready' } // 缺少 text

      // Then: 應該拋出驗證錯誤
      expect(() => {
        statusManager.updateStatus(incompleteStatus)
      }).toThrow('Status must include type and text fields')
    })

    test('應該支援有效的狀態類型', () => {
      // Given: 所有有效的狀態類型
      const PopupStatusManager = require('../../../src/popup/components/popup-status-manager.js')
      statusManager = new PopupStatusManager(mockUIComponents)

      const validTypes = ['loading', 'ready', 'error', 'extracting', 'completed']

      // When & Then: 每個有效類型都應該被接受
      validTypes.forEach(type => {
        const statusData = { type, text: `測試 ${type}`, info: 'test' }
        
        expect(() => {
          statusManager.updateStatus(statusData)
        }).not.toThrow()
        
        expect(statusManager.getCurrentStatus().type).toBe(type)
      })
    })
  })
})