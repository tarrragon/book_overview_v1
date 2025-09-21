/**
 * User Experience Domain 協調器測試
 *
 * 測試範圍：
 * - UX Domain 協調器初始化和啟動
 * - 服務依賴管理和協調
 * - 主題變更協調功能
 * - Popup 狀態協調功能
 * - 偏好設定協調功能
 * - 事件處理和服務整合
 */

// eslint-disable-next-line no-unused-vars
const UXDomainCoordinator = require('src/background/domains/user-experience/ux-domain-coordinator')

// Mock 依賴服務
// eslint-disable-next-line no-unused-vars
const mockEventBus = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn()
}

// eslint-disable-next-line no-unused-vars
const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}

// 建立共用的 Mock 服務實例
// 這裡創建一個全局的 Mock 服務池，讓所有實例共用相同的 Mock 方法
// eslint-disable-next-line no-unused-vars
const mockServicesPool = {}

// eslint-disable-next-line no-unused-vars
const createMockService = (serviceName, extraMethods = {}) => {
  // 創建共用的 Mock 方法集合
  // eslint-disable-next-line no-unused-vars
  const mockMethods = {
    initialize: jest.fn().mockResolvedValue(),
    start: jest.fn().mockResolvedValue(),
    getHealthStatus: jest.fn().mockReturnValue({ healthy: true }),
    ...extraMethods
  }

  // 返回 Mock 構造函數
  // eslint-disable-next-line no-unused-vars
  const MockConstructor = jest.fn().mockImplementation(function () {
    // 將共用的 Mock 方法分配給實例
    // 使用 Object.defineProperties 來創建引用，確保動態更新
    // eslint-disable-next-line no-unused-vars
    const instance = this
    Object.keys(mockMethods).forEach(methodName => {
      Object.defineProperty(instance, methodName, {
        get () {
          return mockMethods[methodName]
        },
        set (value) {
          mockMethods[methodName] = value
        },
        configurable: true,
        enumerable: true
      })
    })
    return this
  })

  // 在構造函數上暴露 Mock 方法，方便測試中直接訪問
  MockConstructor.mockMethods = mockMethods

  return MockConstructor
}

// Mock UX 服務
jest.mock('../../../../../src/background/domains/user-experience/services/theme-management-service', () =>
  createMockService('ThemeManagementService', {
    setTheme: jest.fn().mockResolvedValue()
  })
)

jest.mock('../../../../../src/background/domains/user-experience/services/preference-service', () =>
  createMockService('PreferenceService', {
    setPreference: jest.fn().mockResolvedValue(),
    getPreference: jest.fn().mockResolvedValue('auto')
  })
)

jest.mock('../../../../../src/background/domains/user-experience/services/notification-service', () =>
  createMockService('NotificationService', {
    showNotification: jest.fn().mockResolvedValue()
  })
)

jest.mock('../../../../../src/background/domains/user-experience/services/popup-ui-coordination-service', () =>
  createMockService('PopupUICoordinationService', {
    coordinateState: jest.fn().mockResolvedValue({ success: true }),
    updateTheme: jest.fn().mockResolvedValue(),
    updatePreference: jest.fn().mockResolvedValue()
  })
)

jest.mock('../../../../../src/background/domains/user-experience/services/personalization-service', () =>
  createMockService('PersonalizationService')
)

jest.mock('../../../../../src/background/domains/user-experience/services/accessibility-service', () =>
  createMockService('AccessibilityService')
)

// Mock 常數檔案
jest.mock('../../../../../src/background/constants/module-constants', () => ({
  UX_EVENTS: {
    COORDINATOR_INITIALIZED: 'UX.COORDINATOR.INITIALIZED',
    COORDINATOR_STARTED: 'UX.COORDINATOR.STARTED',
    PREFERENCE_COORDINATED: 'UX.PREFERENCE.COORDINATED'
  },
  THEME_EVENTS: {
    CHANGE_COORDINATED: 'UX.THEME.CHANGE.COORDINATED'
  },
  POPUP_EVENTS: {
    STATE_COORDINATED: 'UX.POPUP.STATE.COORDINATED'
  },
  EVENT_PRIORITIES: {
    NORMAL: 200,
    HIGH: 100
  }
}))

describe('🎨 UX Domain 協調器測試', () => {
  // eslint-disable-next-line no-unused-vars
  let coordinator
  let dependencies

  beforeEach(() => {
    jest.clearAllMocks()

    // 手動設定 Mock 服務池 - 確保所有 Mock 方法都可訪問
    // eslint-disable-next-line no-unused-vars
    const ThemeManagementService = require('src/background/domains/user-experience/services/theme-management-service')
    // eslint-disable-next-line no-unused-vars
    const PreferenceService = require('src/background/domains/user-experience/services/preference-service')
    // eslint-disable-next-line no-unused-vars
    const NotificationService = require('src/background/domains/user-experience/services/notification-service')
    // eslint-disable-next-line no-unused-vars
    const PopupUICoordinationService = require('src/background/domains/user-experience/services/popup-ui-coordination-service')
    // eslint-disable-next-line no-unused-vars
    const PersonalizationService = require('src/background/domains/user-experience/services/personalization-service')
    // eslint-disable-next-line no-unused-vars
    const AccessibilityService = require('src/background/domains/user-experience/services/accessibility-service')

    mockServicesPool.ThemeManagementService = ThemeManagementService.mockMethods
    mockServicesPool.PreferenceService = PreferenceService.mockMethods
    mockServicesPool.NotificationService = NotificationService.mockMethods
    mockServicesPool.PopupUICoordinationService = PopupUICoordinationService.mockMethods
    mockServicesPool.PersonalizationService = PersonalizationService.mockMethods
    mockServicesPool.AccessibilityService = AccessibilityService.mockMethods

    // 重置所有 Mock 方法為預設行為，避免測試間狀態污染
    mockServicesPool.ThemeManagementService.setTheme.mockResolvedValue()
    mockServicesPool.ThemeManagementService.initialize.mockResolvedValue()
    mockServicesPool.ThemeManagementService.start.mockResolvedValue()
    mockServicesPool.ThemeManagementService.getHealthStatus.mockReturnValue({ healthy: true })

    mockServicesPool.NotificationService.showNotification.mockResolvedValue()
    mockServicesPool.PopupUICoordinationService.coordinateState.mockResolvedValue({ success: true })
    mockServicesPool.PopupUICoordinationService.updateTheme.mockResolvedValue()
    mockServicesPool.PopupUICoordinationService.updatePreference.mockResolvedValue()
    mockServicesPool.PreferenceService.setPreference.mockResolvedValue()
    mockServicesPool.PreferenceService.getPreference.mockResolvedValue('auto')

    dependencies = {
      eventBus: mockEventBus,
      logger: mockLogger,
      i18nManager: null
    }

    coordinator = new UXDomainCoordinator(dependencies)
  })

  afterEach(() => {
    // 注意：jest.resetAllMocks() 會重置 Mock 實作，可能導致方法丟失
    // 先嘗試只清理調用歷史而不重置實作
    jest.clearAllMocks()
  })

  describe('🔧 基礎功能測試', () => {
    test('應該正確初始化 UX Domain 協調器', async () => {
      // 執行初始化
      await coordinator.initialize()

      // 驗證狀態
      expect(coordinator.state.initialized).toBe(true)
      expect(coordinator.services.size).toBe(6) // 6個 UX 服務

      // 驗證服務初始化調用 - 檢查服務實例的方法被調用
      expect(coordinator.services.get('theme').initialize).toHaveBeenCalled()
      expect(coordinator.services.get('preference').initialize).toHaveBeenCalled()
      expect(coordinator.services.get('notification').initialize).toHaveBeenCalled()
      expect(coordinator.services.get('popupUI').initialize).toHaveBeenCalled()
      expect(coordinator.services.get('personalization').initialize).toHaveBeenCalled()
      expect(coordinator.services.get('accessibility').initialize).toHaveBeenCalled()

      // 驗證事件發送
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'UX.COORDINATOR.INITIALIZED',
        expect.objectContaining({
          serviceName: 'UXDomainCoordinator',
          servicesCount: 6
        })
      )
    })

    test('應該正確啟動 UX Domain 協調器', async () => {
      // 先初始化
      await coordinator.initialize()

      // 執行啟動
      await coordinator.start()

      // 驗證狀態
      expect(coordinator.state.active).toBe(true)
      expect(coordinator.state.servicesReady).toBe(true)

      // 驗證服務啟動調用
      expect(coordinator.services.get('theme').start).toHaveBeenCalled()
      expect(coordinator.services.get('preference').start).toHaveBeenCalled()
      expect(coordinator.services.get('notification').start).toHaveBeenCalled()
      expect(coordinator.services.get('popupUI').start).toHaveBeenCalled()
      expect(coordinator.services.get('personalization').start).toHaveBeenCalled()
      expect(coordinator.services.get('accessibility').start).toHaveBeenCalled()

      // 驗證啟動事件發送
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'UX.COORDINATOR.STARTED',
        expect.objectContaining({
          serviceName: 'UXDomainCoordinator'
        })
      )
    })

    test('應該防止重複初始化', async () => {
      // 第一次初始化
      await coordinator.initialize()

      // 重複初始化
      await coordinator.initialize()

      // 驗證警告訊息
      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ UX 領域協調器已初始化')
    })

    test('應該防止重複啟動', async () => {
      await coordinator.initialize()
      await coordinator.start()

      // 重複啟動
      await coordinator.start()

      // 驗證警告訊息
      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ UX 領域協調器已啟動')
    })

    test('應該正確管理服務依賴關係', () => {
      // 驗證服務依賴設定
      expect(coordinator.serviceDependencies.get('preference')).toEqual([])
      expect(coordinator.serviceDependencies.get('theme')).toContain('preference')
      expect(coordinator.serviceDependencies.get('popupUI')).toContain('theme')
      expect(coordinator.serviceDependencies.get('popupUI')).toContain('preference')
      expect(coordinator.serviceDependencies.get('popupUI')).toContain('notification')
    })
  })

  describe('🎨 主題協調功能測試', () => {
    beforeEach(async () => {
      await coordinator.initialize()
      await coordinator.start()
    })

    test('應該正確協調主題變更', async () => {
      // eslint-disable-next-line no-unused-vars
      const theme = 'dark'

      // 記錄初始統計 - 因為初始化時可能已經設定過預設主題
      // eslint-disable-next-line no-unused-vars
      const initialThemeChanges = coordinator.stats.themeChanges

      // 執行主題協調
      // eslint-disable-next-line no-unused-vars
      const result = await coordinator.coordinateThemeChange(theme)

      // 驗證結果
      expect(result.success).toBe(true)
      expect(result.theme).toBe(theme)

      // 驗證當前主題狀態更新
      expect(coordinator.state.currentTheme).toBe(theme)

      // 驗證主題服務調用
      expect(coordinator.services.get('theme').setTheme).toHaveBeenCalledWith(theme)

      // 驗證 Popup UI 主題更新
      expect(coordinator.services.get('popupUI').updateTheme).toHaveBeenCalledWith(theme)

      // 驗證統計更新 - 檢查增量而非絕對值
      expect(coordinator.stats.themeChanges).toBe(initialThemeChanges + 1)

      // 驗證事件發送
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'UX.THEME.CHANGE.COORDINATED',
        expect.objectContaining({
          theme,
          coordinatedServices: ['theme', 'popupUI']
        })
      )
    })

    test('應該處理無效主題錯誤', async () => {
      // eslint-disable-next-line no-unused-vars
      const invalidTheme = 'invalid-theme'

      // Mock 主題服務拋出錯誤 - 使用 mockServicesPool 訪問
      mockServicesPool.ThemeManagementService.setTheme.mockRejectedValue(new Error('Invalid theme'))

      // 執行主題協調並期望錯誤
      await expect(coordinator.coordinateThemeChange(invalidTheme)).rejects.toMatchObject({
        code: 'INVALID_INPUT_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })

      // 驗證錯誤日誌
      expect(mockLogger.error).toHaveBeenCalledWith(
        `❌ 主題變更協調失敗: ${invalidTheme}`,
        expect.any(Error)
      )
    })
  })

  describe('🖼️ Popup 狀態協調功能測試', () => {
    beforeEach(async () => {
      await coordinator.initialize()
      await coordinator.start()
    })

    test('應該正確協調 Popup 狀態', async () => {
      // eslint-disable-next-line no-unused-vars
      const popupState = {
        status: 'ready',
        currentPage: { url: 'https://readmoo.com' }
      }

      // 執行 Popup 狀態協調
      // eslint-disable-next-line no-unused-vars
      const result = await coordinator.coordinatePopupState(popupState)

      // 驗證結果
      expect(result.success).toBe(true)

      // 驗證狀態更新
      expect(coordinator.state.popupState).toEqual(popupState)

      // 驗證 Popup UI 服務調用
      expect(coordinator.services.get('popupUI').coordinateState).toHaveBeenCalledWith(popupState)

      // 驗證統計更新
      expect(coordinator.stats.popupCoordinations).toBe(1)

      // 驗證事件發送
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'UX.POPUP.STATE.COORDINATED',
        expect.objectContaining({
          state: popupState,
          result
        })
      )
    })

    test('應該處理錯誤狀態並顯示通知', async () => {
      // eslint-disable-next-line no-unused-vars
      const errorState = {
        status: 'error',
        error: { message: '提取失敗' }
      }

      // Mock 通知服務 - 使用 mockServicesPool 更新 Mock 行為
      // eslint-disable-next-line no-unused-vars
      const showNotificationSpy = jest.fn().mockResolvedValue()
      mockServicesPool.NotificationService.showNotification = showNotificationSpy

      // 執行錯誤狀態協調
      await coordinator.coordinatePopupState(errorState)

      // 驗證通知服務被調用
      expect(showNotificationSpy).toHaveBeenCalledWith({
        type: 'error',
        title: '操作失敗',
        message: '提取失敗'
      })
    })
  })

  describe('⚙️ 偏好設定協調功能測試', () => {
    beforeEach(async () => {
      await coordinator.initialize()
      await coordinator.start()
    })

    test('應該正確協調偏好設定更新', async () => {
      // eslint-disable-next-line no-unused-vars
      const key = 'ui.language'
      // eslint-disable-next-line no-unused-vars
      const value = 'zh-TW'

      // 執行偏好設定協調
      // eslint-disable-next-line no-unused-vars
      const result = await coordinator.coordinatePreferenceUpdate(key, value)

      // 驗證結果
      expect(result.success).toBe(true)
      expect(result.key).toBe(key)
      expect(result.value).toBe(value)

      // 驗證偏好服務調用
      expect(coordinator.services.get('preference').setPreference).toHaveBeenCalledWith(key, value)

      // 驗證統計更新
      expect(coordinator.stats.preferencesUpdated).toBe(1)

      // 驗證事件發送
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'UX.PREFERENCE.COORDINATED',
        expect.objectContaining({
          key,
          value
        })
      )
    })

    test('應該協調主題相關偏好變更', async () => {
      // eslint-disable-next-line no-unused-vars
      const themeKey = 'theme'
      // eslint-disable-next-line no-unused-vars
      const themeValue = 'dark'

      // Mock coordinateThemeChange 方法
      // eslint-disable-next-line no-unused-vars
      const coordinateThemeChangeSpy = jest.spyOn(coordinator, 'coordinateThemeChange')
        .mockResolvedValue({ success: true })

      // 執行主題偏好協調
      await coordinator.coordinatePreferenceUpdate(themeKey, themeValue)

      // 驗證主題協調被調用
      expect(coordinateThemeChangeSpy).toHaveBeenCalledWith(themeValue)

      // 清理 spy
      coordinateThemeChangeSpy.mockRestore()
    })

    test('應該協調 Popup 相關偏好變更', async () => {
      // eslint-disable-next-line no-unused-vars
      const popupKey = 'popup.autoClose'
      // eslint-disable-next-line no-unused-vars
      const popupValue = true

      // 執行 Popup 偏好協調
      await coordinator.coordinatePreferenceUpdate(popupKey, popupValue)

      // 驗證 Popup UI 服務調用
      expect(coordinator.services.get('popupUI').updatePreference).toHaveBeenCalledWith(popupKey, popupValue)
    })
  })

  describe('📊 就緒檢查和健康監控測試', () => {
    beforeEach(async () => {
      await coordinator.initialize()
    })

    test('應該正確執行 UX 就緒檢查', async () => {
      // 執行就緒檢查
      // eslint-disable-next-line no-unused-vars
      const result = await coordinator.performUXReadinessCheck()

      // 驗證檢查結果
      expect(result.ready).toBe(true)
      expect(result.issues).toHaveLength(0)

      // 驗證關鍵服務健康檢查
      expect(coordinator.services.get('theme').getHealthStatus).toHaveBeenCalled()
      expect(coordinator.services.get('preference').getHealthStatus).toHaveBeenCalled()
      expect(coordinator.services.get('popupUI').getHealthStatus).toHaveBeenCalled()
    })

    test('應該檢測不健康的服務', async () => {
      // Mock 不健康的服務 - 使用 mockServicesPool 訪問
      mockServicesPool.ThemeManagementService.getHealthStatus.mockReturnValue({ healthy: false })

      // 執行就緒檢查
      // eslint-disable-next-line no-unused-vars
      const result = await coordinator.performUXReadinessCheck()

      // 驗證檢查結果
      expect(result.ready).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0]).toContain('theme')
    })

    test('應該獲取正確的狀態資訊', () => {
      // eslint-disable-next-line no-unused-vars
      const status = coordinator.getStatus()

      // 驗證狀態結構
      expect(status).toHaveProperty('coordinator')
      expect(status).toHaveProperty('services')
      expect(status).toHaveProperty('stats')

      // 驗證協調器狀態
      expect(status.coordinator.initialized).toBe(true)
      expect(status.coordinator.currentTheme).toBe('auto')

      // 驗證統計資訊
      expect(status.stats.servicesManaged).toBe(6)
    })

    test('應該獲取正確的健康狀態', () => {
      // eslint-disable-next-line no-unused-vars
      const healthStatus = coordinator.getHealthStatus()

      // 驗證健康狀態結構
      expect(healthStatus).toHaveProperty('service')
      expect(healthStatus).toHaveProperty('healthy')
      expect(healthStatus).toHaveProperty('status')
      expect(healthStatus).toHaveProperty('metrics')

      // 驗證基本資訊
      expect(healthStatus.service).toBe('UXDomainCoordinator')
      expect(healthStatus.healthy).toBe(false) // 尚未啟動，所以不健康
      expect(healthStatus.status).toBe('inactive') // 尚未啟動

      // 驗證指標
      expect(healthStatus.metrics.servicesManaged).toBe(6)
    })
  })

  describe('🚨 錯誤處理測試', () => {
    test('應該處理服務初始化失敗', async () => {
      // Mock 服務初始化失敗 - 使用 mockServicesPool 訪問
      mockServicesPool.ThemeManagementService.initialize.mockRejectedValue(new Error('Service init failed'))

      // 執行初始化並期望錯誤
      await expect(coordinator.initialize()).rejects.toThrow()

      // 驗證錯誤日誌
      expect(mockLogger.error).toHaveBeenCalledWith(
        '❌ 初始化 UX 領域協調器失敗:',
        expect.any(Error)
      )
    })

    test('應該處理服務啟動失敗', async () => {
      await coordinator.initialize()

      // Mock 服務啟動失敗 - 使用 mockServicesPool 訪問
      mockServicesPool.ThemeManagementService.start.mockRejectedValue(new Error('Service start failed'))

      // 執行啟動
      await coordinator.start()

      // 驗證服務降級處理
      expect(mockLogger.error).toHaveBeenCalledWith(
        '💥 UX 服務啟動失敗處理: theme',
        expect.any(Error)
      )

      // 驗證協調器仍然啟動
      expect(coordinator.state.active).toBe(true)
    })

    test('應該處理未初始化時的啟動請求', async () => {
      // 未初始化就啟動
      await expect(coordinator.start()).rejects.toMatchObject({
        code: 'TEST_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })
    })
  })

  describe('📈 統計和指標測試', () => {
    test('應該正確追蹤統計資訊', async () => {
      await coordinator.initialize()
      await coordinator.start()

      // 記錄初始統計值 - 因為初始化過程可能已執行某些操作
      // eslint-disable-next-line no-unused-vars
      const initialThemeChanges = coordinator.stats.themeChanges
      // eslint-disable-next-line no-unused-vars
      const initialPopupCoordinations = coordinator.stats.popupCoordinations
      // eslint-disable-next-line no-unused-vars
      const initialPreferencesUpdated = coordinator.stats.preferencesUpdated

      // 執行各種操作
      await coordinator.coordinateThemeChange('dark')
      await coordinator.coordinatePopupState({ status: 'ready' })
      await coordinator.coordinatePreferenceUpdate('test.key', 'test.value')

      // 驗證統計更新 - 檢查增量而非絕對值
      expect(coordinator.stats.themeChanges).toBe(initialThemeChanges + 1)
      expect(coordinator.stats.popupCoordinations).toBe(initialPopupCoordinations + 1)
      expect(coordinator.stats.preferencesUpdated).toBe(initialPreferencesUpdated + 1)
    })

    test('應該正確計算活躍服務數量', async () => {
      await coordinator.initialize()

      // 初始時所有服務都不活躍
      expect(coordinator.getActiveServicesCount()).toBe(0)

      await coordinator.start()

      // 啟動後所有服務都活躍
      expect(coordinator.getActiveServicesCount()).toBe(6)
    })
  })
})
