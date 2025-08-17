# 缺失 Domain 設計方案 - v2.0

**設計日期**: 2025-08-17  
**設計目標**: 設計缺失的 3 個 Domain 架構，完成 9 個 Domain 的完整設計  
**設計者**: Claude Code

## 🎯 設計概覽

基於現況分析，我們需要設計以下 3 個 Domain：
1. **User Experience Domain** - 用戶體驗領域
2. **Analytics Domain** - 分析統計領域
3. **Security Domain** - 安全隱私領域

同時需要將三個重構工作融入對應的 Domain 架構中。

## 🎨 User Experience Domain 詳細設計

### 核心職責
- 統一的主題和外觀管理
- 跨平台用戶偏好同步和管理
- 智能通知系統和用戶回饋
- Popup 界面的模組化協調
- 個人化推薦和學習分析
- 無障礙功能支援

### 架構設計

```
src/background/domains/user-experience/
├── ux-domain-coordinator.js           # UX 領域協調器
└── services/
    ├── theme-management-service.js     # 主題管理服務
    ├── preference-service.js           # 偏好設定服務
    ├── notification-service.js         # 通知管理服務
    ├── popup-ui-coordination-service.js # Popup UI 協調服務 🔥
    ├── personalization-service.js      # 個人化服務
    └── accessibility-service.js        # 無障礙服務
```

### 服務詳細設計

#### 1. **ux-domain-coordinator.js**
```javascript
/**
 * User Experience Domain 協調器
 * 
 * 負責功能：
 * - 統籌 UX 相關服務的生命週期
 * - 協調主題切換和偏好同步
 * - 管理 Popup UI 模組化協調
 * - 處理跨 Domain 的 UX 事件
 */
class UXDomainCoordinator extends BaseDomainCoordinator {
  constructor() {
    super('UX')
    this.services = new Map()
  }

  async initialize() {
    // 初始化各 UX 服務
    await this.initializeThemeManagement()
    await this.initializePreferences()
    await this.initializeNotifications()
    await this.initializePopupCoordination()
    await this.initializePersonalization()
    await this.initializeAccessibility()
    
    // 設定跨服務協調
    await this.setupCrossServiceCoordination()
  }

  async handleThemeChange(theme) {
    // 協調主題變更到所有相關服務
    await this.emitEvent('UX.THEME.CHANGE.REQUESTED', { theme })
  }

  async coordinatePopupState(popupState) {
    // 協調 Popup 狀態到相關服務
    const result = await this.services.get('popup-ui-coordination').updateState(popupState)
    await this.emitEvent('UX.POPUP.STATE.UPDATED', { state: popupState, result })
    return result
  }
}
```

#### 2. **theme-management-service.js**
```javascript
/**
 * 主題管理服務
 * 
 * 負責功能：
 * - 深色/淺色主題切換
 * - 響應式主題適配
 * - 主題偏好持久化
 * - 跨組件主題同步
 */
class ThemeManagementService extends BaseService {
  constructor() {
    super('theme-management')
    this.currentTheme = 'auto'
    this.themeProviders = new Map()
  }

  async setTheme(theme) {
    // 驗證主題有效性
    if (!this.isValidTheme(theme)) {
      throw new Error(`Invalid theme: ${theme}`)
    }

    this.currentTheme = theme
    
    // 更新所有註冊的主題提供者
    for (const [providerId, provider] of this.themeProviders) {
      await provider.updateTheme(theme)
    }

    // 持久化主題偏好
    await this.persistThemePreference(theme)
    
    // 發送主題變更事件
    await this.emitEvent('UX.THEME.CHANGED', { 
      theme, 
      timestamp: Date.now(),
      providers: Array.from(this.themeProviders.keys())
    })
  }

  registerThemeProvider(providerId, provider) {
    this.themeProviders.set(providerId, provider)
  }

  async getSystemTheme() {
    // 檢測系統主題偏好
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
}
```

#### 3. **popup-ui-coordination-service.js** 🔥 **重點整合**
```javascript
/**
 * Popup UI 協調服務
 * 
 * 負責功能：
 * - 整合 Popup 模組化重構成果
 * - 協調 Popup 各模組間的通訊
 * - 管理 Popup 生命週期
 * - 處理 Popup 與 Background 的協調
 */
class PopupUICoordinationService extends BaseService {
  constructor() {
    super('popup-ui-coordination')
    this.popupModules = new Map()
    this.popupState = new PopupStateManager()
    this.popupEventBus = new PopupEventBus()
  }

  async initializePopupModules() {
    // 初始化 Popup 各模組
    await this.loadModule('dom-manager', PopupDOMManager)
    await this.loadModule('status-display', PopupStatusDisplay)
    await this.loadModule('progress-display', PopupProgressDisplay)
    await this.loadModule('button-manager', PopupButtonManager)
    await this.loadModule('background-bridge', PopupBackgroundBridge)
    await this.loadModule('extraction-service', PopupExtractionService)
    
    // 設定模組間協調
    await this.setupModuleCoordination()
  }

  async updatePopupState(newState) {
    // 更新 Popup 狀態
    const oldState = this.popupState.getCurrentState()
    await this.popupState.setState(newState)
    
    // 通知相關模組
    await this.popupEventBus.emit('POPUP.STATE.CHANGED', {
      oldState,
      newState,
      timestamp: Date.now()
    })
    
    // 向上層報告狀態變更
    await this.emitEvent('UX.POPUP.STATE.COORDINATED', { newState })
  }

  async handleExtractionRequest(options) {
    // 協調提取流程
    const extractionService = this.popupModules.get('extraction-service')
    const result = await extractionService.startExtraction(options)
    
    // 更新 UI 狀態
    await this.updateProgressDisplay(result.progress)
    
    return result
  }

  private async setupModuleCoordination() {
    // 設定模組間事件協調
    this.popupEventBus.on('EXTRACTION.PROGRESS', async (event) => {
      const progressDisplay = this.popupModules.get('progress-display')
      await progressDisplay.updateProgress(event.data.percentage, event.data.text)
    })

    this.popupEventBus.on('STATUS.UPDATE', async (event) => {
      const statusDisplay = this.popupModules.get('status-display')
      await statusDisplay.updateStatus(event.data.status, event.data.text, event.data.info)
    })
  }
}
```

#### 4. **preference-service.js**
```javascript
/**
 * 偏好設定服務
 * 
 * 負責功能：
 * - 用戶偏好的持久化存儲
 * - 偏好設定的跨平台同步
 * - 偏好變更的事件通知
 * - 預設偏好的管理
 */
class PreferenceService extends BaseService {
  constructor() {
    super('preference')
    this.preferences = new Map()
    this.defaultPreferences = this.getDefaultPreferences()
  }

  async setPreference(key, value) {
    const oldValue = this.preferences.get(key)
    this.preferences.set(key, value)
    
    // 持久化偏好
    await this.persistPreference(key, value)
    
    // 發送偏好變更事件
    await this.emitEvent('UX.PREFERENCE.UPDATED', {
      key,
      oldValue,
      newValue: value,
      timestamp: Date.now()
    })
  }

  async getPreference(key, defaultValue = null) {
    if (this.preferences.has(key)) {
      return this.preferences.get(key)
    }
    
    // 從持久化存儲載入
    const persistedValue = await this.loadPersistedPreference(key)
    if (persistedValue !== null) {
      this.preferences.set(key, persistedValue)
      return persistedValue
    }
    
    // 返回預設值
    return defaultValue || this.defaultPreferences.get(key)
  }

  private getDefaultPreferences() {
    return new Map([
      ['theme', 'auto'],
      ['language', 'zh-TW'],
      ['notifications.enabled', true],
      ['popup.autoClose', false],
      ['extraction.showProgress', true],
      ['accessibility.highContrast', false]
    ])
  }
}
```

#### 5. **notification-service.js**
```javascript
/**
 * 通知管理服務
 * 
 * 負責功能：
 * - 統一的通知顯示管理
 * - 通知優先級和去重
 * - 通知歷史記錄
 * - 用戶通知偏好遵循
 */
class NotificationService extends BaseService {
  constructor() {
    super('notification')
    this.activeNotifications = new Map()
    this.notificationHistory = []
    this.notificationQueue = []
  }

  async showNotification(notification) {
    // 檢查用戶通知偏好
    const notificationsEnabled = await this.preferenceService.getPreference('notifications.enabled')
    if (!notificationsEnabled) {
      return { shown: false, reason: 'notifications_disabled' }
    }

    // 去重處理
    if (this.isDuplicateNotification(notification)) {
      return { shown: false, reason: 'duplicate' }
    }

    // 優先級處理
    const processedNotification = await this.processNotificationPriority(notification)

    // 顯示通知
    const result = await this.displayNotification(processedNotification)
    
    // 記錄通知歷史
    this.recordNotificationHistory(processedNotification, result)
    
    // 發送通知事件
    await this.emitEvent('UX.NOTIFICATION.SHOWN', {
      notification: processedNotification,
      result,
      timestamp: Date.now()
    })

    return result
  }

  async clearNotification(notificationId) {
    if (this.activeNotifications.has(notificationId)) {
      const notification = this.activeNotifications.get(notificationId)
      await this.hideNotification(notification)
      this.activeNotifications.delete(notificationId)
      
      await this.emitEvent('UX.NOTIFICATION.CLEARED', {
        notificationId,
        timestamp: Date.now()
      })
    }
  }
}
```

### UX Domain 事件定義

```javascript
// 主題管理事件
'UX.THEME.CHANGED'              // 主題變更完成
'UX.THEME.CHANGE.REQUESTED'     // 主題變更請求
'UX.THEME.PROVIDER.REGISTERED'  // 主題提供者註冊

// 偏好管理事件
'UX.PREFERENCE.UPDATED'         // 偏好設定更新
'UX.PREFERENCE.SYNC.COMPLETED'  // 偏好同步完成
'UX.PREFERENCE.RESET'           // 偏好重置

// 通知管理事件
'UX.NOTIFICATION.SHOWN'         // 通知顯示
'UX.NOTIFICATION.CLEARED'       // 通知清除
'UX.NOTIFICATION.QUEUE.UPDATED' // 通知佇列更新

// Popup 協調事件
'UX.POPUP.STATE.COORDINATED'    // Popup 狀態協調完成
'UX.POPUP.MODULE.LOADED'        // Popup 模組載入
'UX.POPUP.EXTRACTION.STARTED'   // Popup 提取開始

// 個人化事件
'UX.PERSONALIZATION.APPLIED'    // 個人化設定應用
'UX.USER.ACTION.RECORDED'       // 用戶行為記錄
'UX.FEEDBACK.COLLECTED'         // 用戶回饋收集

// 無障礙事件
'UX.ACCESSIBILITY.ENABLED'      // 無障礙功能啟用
'UX.ACCESSIBILITY.MODE.CHANGED' // 無障礙模式變更
```

## 📊 Analytics Domain 詳細設計

### 核心職責
- 跨平台閱讀習慣分析和統計
- 書庫管理效率和趨勢分析
- 智能視覺化圖表和報告生成
- 個人閱讀目標追蹤和建議
- 用戶行為分析和優化建議

### 架構設計

```
src/background/domains/analytics/
├── analytics-domain-coordinator.js     # 分析領域協調器
└── services/
    ├── reading-analytics-service.js     # 閱讀分析服務
    ├── cross-platform-stats-service.js # 跨平台統計服務
    ├── visualization-service.js         # 視覺化服務
    ├── report-generation-service.js     # 報告生成服務
    └── trend-analysis-service.js        # 趨勢分析服務
```

### 關鍵服務設計

#### **reading-analytics-service.js**
```javascript
/**
 * 閱讀分析服務
 * 
 * 負責功能：
 * - 閱讀時間和進度統計
 * - 閱讀習慣模式分析
 * - 閱讀目標追蹤
 * - 個人化閱讀建議
 */
class ReadingAnalyticsService extends BaseService {
  async trackReadingSession(bookId, platform, duration, progress) {
    // 記錄閱讀會話
    const session = {
      bookId,
      platform,
      duration,
      progress,
      timestamp: Date.now()
    }
    
    await this.recordSession(session)
    await this.updateReadingStats(session)
    await this.checkReadingGoals(session)
  }

  async generateReadingInsights(timeRange) {
    // 生成閱讀洞察
    const insights = {
      totalReadingTime: await this.getTotalReadingTime(timeRange),
      booksCompleted: await this.getBooksCompleted(timeRange),
      averageDailyReading: await this.getAverageDailyReading(timeRange),
      readingStreak: await this.getCurrentReadingStreak(),
      preferredGenres: await this.getPreferredGenres(timeRange),
      readingEfficiency: await this.calculateReadingEfficiency(timeRange)
    }
    
    return insights
  }
}
```

#### **cross-platform-stats-service.js**
```javascript
/**
 * 跨平台統計服務
 * 
 * 負責功能：
 * - 多平台資料統計整合
 * - 平台使用偏好分析
 * - 跨平台同步效率統計
 * - 平台間資料比較
 */
class CrossPlatformStatsService extends BaseService {
  async generateCrossPlatformStats() {
    const stats = {
      platformUsage: await this.getPlatformUsageStats(),
      crossPlatformBooks: await this.getCrossPlatformBookStats(),
      syncEfficiency: await this.getSyncEfficiencyStats(),
      platformPreferences: await this.getPlatformPreferences()
    }
    
    return stats
  }
}
```

## 🔒 Security Domain 詳細設計

### 核心職責
- 跨平台資料的加密和隱私保護
- 平台間資料隔離和訪問控制
- 敏感操作的審計日誌和追蹤
- 權限管理和安全策略實施
- 資料完整性驗證

### 架構設計

```
src/background/domains/security/
├── security-domain-coordinator.js      # 安全領域協調器
└── services/
    ├── data-encryption-service.js       # 資料加密服務
    ├── privacy-protection-service.js    # 隱私保護服務
    ├── platform-isolation-service.js    # 平台隔離服務 (移入)
    ├── audit-logging-service.js         # 審計日誌服務
    └── permission-control-service.js    # 權限控制服務
```

### 關鍵服務設計

#### **data-encryption-service.js**
```javascript
/**
 * 資料加密服務
 * 
 * 負責功能：
 * - 敏感資料的加密/解密
 * - 加密金鑰管理
 * - 資料完整性驗證
 * - 安全的資料傳輸
 */
class DataEncryptionService extends BaseService {
  async encryptSensitiveData(data, encryptionLevel = 'standard') {
    // 根據加密級別選擇算法
    const algorithm = this.getEncryptionAlgorithm(encryptionLevel)
    
    // 生成加密金鑰
    const key = await this.generateEncryptionKey(algorithm)
    
    // 執行加密
    const encryptedData = await this.encrypt(data, key, algorithm)
    
    // 記錄加密操作
    await this.logEncryptionOperation(encryptedData.id, algorithm)
    
    return encryptedData
  }

  async decryptData(encryptedData) {
    // 驗證資料完整性
    await this.verifyDataIntegrity(encryptedData)
    
    // 獲取解密金鑰
    const key = await this.getDecryptionKey(encryptedData.keyId)
    
    // 執行解密
    const decryptedData = await this.decrypt(encryptedData, key)
    
    // 記錄解密操作
    await this.logDecryptionOperation(encryptedData.id)
    
    return decryptedData
  }
}
```

#### **audit-logging-service.js**
```javascript
/**
 * 審計日誌服務
 * 
 * 負責功能：
 * - 系統操作的審計記錄
 * - 安全事件的日誌追蹤
 * - 合規性報告生成
 * - 異常行為檢測
 */
class AuditLoggingService extends BaseService {
  async logSecurityEvent(eventType, details, severity = 'INFO') {
    const auditEvent = {
      id: this.generateEventId(),
      type: eventType,
      severity,
      details,
      timestamp: Date.now(),
      source: details.source || 'unknown',
      userId: details.userId || null,
      sessionId: details.sessionId || null
    }
    
    // 持久化審計日誌
    await this.persistAuditLog(auditEvent)
    
    // 檢查是否需要即時警報
    if (this.isHighSeverityEvent(severity)) {
      await this.triggerSecurityAlert(auditEvent)
    }
    
    // 發送審計事件
    await this.emitEvent('SECURITY.AUDIT.LOGGED', { event: auditEvent })
  }

  async generateComplianceReport(timeRange, reportType) {
    // 生成合規性報告
    const events = await this.getAuditEvents(timeRange)
    const report = await this.compileComplianceReport(events, reportType)
    
    return report
  }
}
```

## 🔗 Domain 整合與事件流程

### 跨 Domain 協作範例

#### **用戶執行書庫提取的完整流程**

1. **User Experience Domain** 接收用戶操作
```javascript
// Popup UI 協調服務處理用戶點擊
await uxDomain.coordinateExtractionRequest({
  platform: 'readmoo',
  options: userPreferences
})
```

2. **Security Domain** 進行權限檢查
```javascript
// 權限控制服務驗證操作權限
const hasPermission = await securityDomain.checkExtractionPermission()
await securityDomain.logSecurityEvent('EXTRACTION.PERMISSION.CHECKED', {
  granted: hasPermission
})
```

3. **Platform Domain** 協調平台適配器
```javascript
// 平台協調器啟動 Readmoo 適配器
const adapter = await platformDomain.getAdapter('readmoo')
await platformDomain.routeExtractionRequest(adapter, extractionConfig)
```

4. **Extraction Domain** 執行實際提取
```javascript
// 提取領域協調器執行提取流程
const extractionResult = await extractionDomain.startExtraction({
  adapter,
  config: extractionConfig
})
```

5. **Data Management Domain** 處理資料
```javascript
// 資料管理域驗證和存儲資料
const validatedData = await dataManagementDomain.validateExtractedData(extractionResult.data)
await dataManagementDomain.storeData(validatedData)
```

6. **Analytics Domain** 記錄統計
```javascript
// 分析域記錄使用統計
await analyticsDomain.trackExtractionEvent({
  platform: 'readmoo',
  success: true,
  duration: extractionResult.duration,
  bookCount: extractionResult.bookCount
})
```

7. **User Experience Domain** 更新 UI
```javascript
// UX 域更新 Popup 顯示結果
await uxDomain.updateExtractionResults({
  success: true,
  bookCount: extractionResult.bookCount,
  message: '提取完成！'
})
```

這個完整的 Domain 設計確保了：
- 🎯 **職責清晰**: 每個 Domain 都有明確的責任範圍
- 🔗 **協作明確**: Domain 間的協作模式和介面定義清楚
- 🔄 **事件驅動**: 統一的事件系統協調所有 Domain
- 📈 **可擴展**: 為未來功能擴展提供堅實基礎