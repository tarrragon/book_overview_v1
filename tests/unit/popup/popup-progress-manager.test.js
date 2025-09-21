const { ErrorCodes } = require('src/core/errors/ErrorCodes')
/**
 * PopupProgressManager 單元測試
 *
 * 負責測試：
 * - 進度顯示和更新功能
 * - 進度條視覺效果管理
 * - 進度狀態生命週期
 * - 進度完成和取消處理
 */

describe('PopupProgressManager 核心功能', () => {
  let progressManager
  // eslint-disable-next-line no-unused-vars
  let mockUIComponents

  beforeEach(() => {
    // 建立 Mock UI 組件
    mockUIComponents = {
      updateProgress: jest.fn(),
      showProgress: jest.fn(),
      hideProgress: jest.fn(),
      showError: jest.fn()
    }

    // 重置所有 Mock
    jest.clearAllMocks()
  })

  describe('📊 基本進度管理功能', () => {
    test('應該正確初始化進度管理器', () => {
      // Given: 進度管理器初始化
      // eslint-disable-next-line no-unused-vars
      const PopupProgressManager = require('src/popup/components/popup-progress-manager.js')
      progressManager = new PopupProgressManager(mockUIComponents)

      // When: 取得初始狀態
      // eslint-disable-next-line no-unused-vars
      const initialState = progressManager.getCurrentProgress()

      // Then: 應有正確的初始狀態
      expect(initialState).toEqual({
        percentage: 0,
        status: 'idle',
        text: '',
        isVisible: false
      })
    })

    test('應該正確更新進度百分比', () => {
      // Given: 進度管理器
      // eslint-disable-next-line no-unused-vars
      const PopupProgressManager = require('src/popup/components/popup-progress-manager.js')
      progressManager = new PopupProgressManager(mockUIComponents)

      // When: 更新進度
      // eslint-disable-next-line no-unused-vars
      const progressData = {
        percentage: 45,
        status: 'extracting',
        text: '正在提取第 45/100 本書籍'
      }
      progressManager.updateProgress(progressData)

      // Then: 進度正確更新
      expect(mockUIComponents.updateProgress).toHaveBeenCalledWith(
        progressData.percentage,
        progressData.status,
        progressData.text
      )
      expect(progressManager.getCurrentProgress()).toMatchObject({
        percentage: 45,
        status: 'extracting',
        text: '正在提取第 45/100 本書籍',
        isVisible: true
      })
    })

    test('應該正確處理進度邊界值', () => {
      // Given: 進度管理器
      // eslint-disable-next-line no-unused-vars
      const PopupProgressManager = require('src/popup/components/popup-progress-manager.js')
      progressManager = new PopupProgressManager(mockUIComponents)

      // When: 測試邊界值
      // eslint-disable-next-line no-unused-vars
      const testCases = [
        { input: -10, expected: 0 }, // 負數應該被限制為 0
        { input: 0, expected: 0 }, // 最小值
        { input: 50, expected: 50 }, // 正常值
        { input: 100, expected: 100 }, // 最大值
        { input: 150, expected: 100 } // 超過 100 應該被限制
      ]

      testCases.forEach(({ input, expected }) => {
        progressManager.updateProgress({ percentage: input, status: 'extracting', text: 'test' })
        expect(progressManager.getCurrentProgress().percentage).toBe(expected)
      })
    })
  })

  describe('🎯 進度顯示生命週期', () => {
    test('應該正確開始進度顯示', () => {
      // Given: 進度管理器
      // eslint-disable-next-line no-unused-vars
      const PopupProgressManager = require('src/popup/components/popup-progress-manager.js')
      progressManager = new PopupProgressManager(mockUIComponents)

      // When: 開始進度顯示
      // eslint-disable-next-line no-unused-vars
      const startData = {
        title: '開始提取書庫資料',
        estimatedTotal: 100
      }
      progressManager.startProgress(startData)

      // Then: 進度顯示啟動
      expect(mockUIComponents.showProgress).toHaveBeenCalled()
      expect(progressManager.getCurrentProgress()).toMatchObject({
        percentage: 0,
        status: 'starting',
        isVisible: true,
        estimatedTotal: 100
      })
    })

    test('應該正確完成進度顯示', () => {
      // Given: 進行中的進度
      // eslint-disable-next-line no-unused-vars
      const PopupProgressManager = require('src/popup/components/popup-progress-manager.js')
      progressManager = new PopupProgressManager(mockUIComponents)
      progressManager.startProgress({ title: '測試', estimatedTotal: 100 })

      // When: 完成進度
      // eslint-disable-next-line no-unused-vars
      const completionData = {
        totalProcessed: 95,
        successCount: 93,
        failureCount: 2,
        duration: 45000 // 45 秒
      }
      progressManager.completeProgress(completionData)

      // Then: 進度完成狀態正確
      expect(progressManager.getCurrentProgress()).toMatchObject({
        percentage: 100,
        status: 'completed',
        isVisible: false,
        completionData
      })
    })

    test('應該正確取消進度顯示', () => {
      // Given: 進行中的進度
      // eslint-disable-next-line no-unused-vars
      const PopupProgressManager = require('src/popup/components/popup-progress-manager.js')
      progressManager = new PopupProgressManager(mockUIComponents)
      progressManager.startProgress({ title: '測試', estimatedTotal: 100 })
      progressManager.updateProgress({ percentage: 30, status: 'extracting', text: '進行中' })

      // When: 取消進度
      progressManager.cancelProgress('使用者取消')

      // Then: 進度被正確取消
      expect(mockUIComponents.hideProgress).toHaveBeenCalled()
      expect(progressManager.getCurrentProgress()).toMatchObject({
        status: 'cancelled',
        isVisible: false,
        cancellationReason: '使用者取消'
      })
    })
  })

  describe('🔄 進度狀態管理', () => {
    test('應該支援有效的進度狀態', () => {
      // Given: 進度管理器和有效狀態
      // eslint-disable-next-line no-unused-vars
      const PopupProgressManager = require('src/popup/components/popup-progress-manager.js')
      progressManager = new PopupProgressManager(mockUIComponents)

      // eslint-disable-next-line no-unused-vars
      const validStates = ['idle', 'starting', 'extracting', 'processing', 'completed', 'cancelled', 'error']

      // When & Then: 每個有效狀態都應該被接受
      validStates.forEach(status => {
        expect(() => {
          progressManager.updateProgress({ percentage: 50, status, text: `測試 ${status}` })
        }).not.toThrow()

        expect(progressManager.getCurrentProgress().status).toBe(status)
      })
    })

    test('應該拒絕無效的進度狀態', () => {
      // Given: 進度管理器
      // eslint-disable-next-line no-unused-vars
      const PopupProgressManager = require('src/popup/components/popup-progress-manager.js')
      progressManager = new PopupProgressManager(mockUIComponents)

      // When: 嘗試使用無效狀態
      // eslint-disable-next-line no-unused-vars
      const invalidStatus = 'invalid_status'

      // Then: 應該拋出錯誤
      expect(() => {
        progressManager.updateProgress({ percentage: 50, status: invalidStatus, text: '測試' })
      }).toThrow(Error)
    })

    test('應該正確處理進度狀態轉換', () => {
      // Given: 進度管理器
      // eslint-disable-next-line no-unused-vars
      const PopupProgressManager = require('src/popup/components/popup-progress-manager.js')
      progressManager = new PopupProgressManager(mockUIComponents)

      // When: 執行狀態轉換序列
      // eslint-disable-next-line no-unused-vars
      const stateTransitions = [
        { status: 'starting', percentage: 0 },
        { status: 'extracting', percentage: 25 },
        { status: 'processing', percentage: 75 },
        { status: 'completed', percentage: 100 }
      ]

      stateTransitions.forEach(({ status, percentage }) => {
        progressManager.updateProgress({ percentage, status, text: `${status} 狀態` })
      })

      // Then: 最終狀態正確
      expect(progressManager.getCurrentProgress()).toEqual(expect.objectContaining({
        status: 'completed',
        percentage: 100
      }))
    })
  })

  describe('⚠️ 錯誤處理', () => {
    test('應該處理進度更新時的錯誤', () => {
      // Given: 進度管理器，模擬 UI 組件錯誤
      // eslint-disable-next-line no-unused-vars
      const PopupProgressManager = require('src/popup/components/popup-progress-manager.js')
      progressManager = new PopupProgressManager(mockUIComponents)

      mockUIComponents.updateProgress.mockImplementation(() => {
        throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.POPUP_UI_UPDATE_ERROR; error.details = { category: 'testing' }; return error })()
      })

      // When: 嘗試更新進度
      // eslint-disable-next-line no-unused-vars
      const progressData = { percentage: 50, status: 'extracting', text: '測試' }

      // Then: 應該優雅處理錯誤
      expect(() => {
        progressManager.updateProgress(progressData)
      }).not.toThrow()

      // 錯誤應該被記錄但不影響內部狀態
      expect(progressManager.getCurrentProgress().percentage).toBe(50)
      expect(mockUIComponents.showError).toHaveBeenCalledWith({
        message: 'Progress update failed: UI update failed',
        type: 'ui_error'
      })
    })

    test('應該驗證必要的進度資料欄位', () => {
      // Given: 進度管理器
      // eslint-disable-next-line no-unused-vars
      const PopupProgressManager = require('src/popup/components/popup-progress-manager.js')
      progressManager = new PopupProgressManager(mockUIComponents)

      // When: 嘗試更新不完整的進度資料
      // eslint-disable-next-line no-unused-vars
      const incompleteData = { percentage: 50 } // 缺少 status

      // Then: 應該拋出驗證錯誤
      expect(() => {
        progressManager.updateProgress(incompleteData)
      }).toMatchObject({
        code: expect.any(String),
        message: expect.stringContaining('Progress data must include percentage and status fields'),
        details: expect.any(Object)
      })
    })
  })
})
