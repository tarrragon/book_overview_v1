# Domain API 介面定義 - v2.0

**設計日期**: 2025-08-17  
**設計目標**: 定義 9 個 Domain 間的 API 協議，確保清楚的協作介面  
**設計者**: Claude Code

## 🎯 介面設計原則

### 設計原則

1. **明確性**: 每個 API 都有清楚的輸入輸出定義
2. **一致性**: 所有 Domain 使用統一的 API 模式
3. **可測試性**: 每個介面都可以獨立測試
4. **向後相容**: 介面變更不破壞現有功能
5. **事件驅動**: 基於事件系統的非同步協作

### 統一 API 模式

```typescript
interface DomainAPI {
  // 服務初始化
  initialize(): Promise<InitializationResult>

  // 服務狀態檢查
  getStatus(): Promise<ServiceStatus>

  // 服務清理
  cleanup(): Promise<void>

  // 統一錯誤處理
  handleError(error: Error): Promise<ErrorHandlingResult>
}

interface StandardResponse<T> {
  success: boolean
  data?: T
  error?: ErrorDetails
  timestamp: number
  metadata?: ResponseMetadata
}
```

## 🏗 Domain API 詳細定義

### 1. System Domain API

```typescript
interface SystemDomainAPI extends DomainAPI {
  // 配置管理
  getConfig(key: string): Promise<StandardResponse<any>>
  setConfig(key: string, value: any): Promise<StandardResponse<void>>
  validateConfig(config: Configuration): Promise<StandardResponse<ValidationResult>>

  // 生命週期管理
  startService(serviceName: string): Promise<StandardResponse<ServiceStatus>>
  stopService(serviceName: string): Promise<StandardResponse<void>>
  restartService(serviceName: string): Promise<StandardResponse<ServiceStatus>>

  // 健康監控
  getSystemHealth(): Promise<StandardResponse<HealthReport>>
  getServiceHealth(serviceName: string): Promise<StandardResponse<ServiceHealth>>

  // 診斷
  runDiagnostics(): Promise<StandardResponse<DiagnosticReport>>
  getPerformanceMetrics(): Promise<StandardResponse<PerformanceMetrics>>

  // 版本控制
  getCurrentVersion(): Promise<StandardResponse<VersionInfo>>
  checkForUpdates(): Promise<StandardResponse<UpdateInfo>>
}

// 相關型別定義
interface HealthReport {
  overall: 'healthy' | 'warning' | 'critical'
  services: ServiceHealth[]
  systemMetrics: SystemMetrics
  lastChecked: number
}

interface ServiceHealth {
  name: string
  status: 'running' | 'stopped' | 'error'
  uptime: number
  metrics: ServiceMetrics
}
```

### 2. Page Domain API

```typescript
interface PageDomainAPI extends DomainAPI {
  // 頁面檢測
  detectPage(url: string): Promise<StandardResponse<PageInfo>>
  getCurrentPageInfo(): Promise<StandardResponse<PageInfo>>
  isTargetPlatformPage(url: string): Promise<StandardResponse<boolean>>

  // 內容腳本協調
  getContentScriptStatus(tabId: number): Promise<StandardResponse<ContentScriptStatus>>
  injectContentScript(tabId: number): Promise<StandardResponse<InjectionResult>>
  communicateWithContentScript(tabId: number, message: any): Promise<StandardResponse<any>>

  // 導航管理
  onNavigationChange(callback: NavigationCallback): Promise<StandardResponse<void>>
  getNavigationHistory(): Promise<StandardResponse<NavigationHistory>>

  // 標籤狀態追蹤
  trackTabState(tabId: number): Promise<StandardResponse<TabState>>
  getTabState(tabId: number): Promise<StandardResponse<TabState>>

  // 權限管理
  checkPermissions(permissions: string[]): Promise<StandardResponse<PermissionStatus>>
  requestPermissions(permissions: string[]): Promise<StandardResponse<PermissionResult>>
}

// 相關型別定義
interface PageInfo {
  url: string
  title: string
  platform: string | null
  pageType: 'library' | 'book' | 'search' | 'unknown'
  extractable: boolean
  metadata: PageMetadata
}

interface ContentScriptStatus {
  injected: boolean
  ready: boolean
  version: string
  lastActivity: number
}
```

### 3. Extraction Domain API

```typescript
interface ExtractionDomainAPI extends DomainAPI {
  // 提取操作
  startExtraction(config: ExtractionConfig): Promise<StandardResponse<ExtractionResult>>
  cancelExtraction(extractionId: string): Promise<StandardResponse<void>>
  getExtractionStatus(extractionId: string): Promise<StandardResponse<ExtractionStatus>>

  // 資料處理
  processExtractedData(data: RawData): Promise<StandardResponse<ProcessedData>>
  validateExtractedData(data: ExtractedData): Promise<StandardResponse<ValidationResult>>

  // 品質控制
  performQualityCheck(data: ExtractedData): Promise<StandardResponse<QualityReport>>
  getQualityMetrics(): Promise<StandardResponse<QualityMetrics>>

  // 匯出服務
  exportData(data: ExtractedData, format: ExportFormat): Promise<StandardResponse<ExportResult>>
  getExportHistory(): Promise<StandardResponse<ExportHistory>>

  // 提取狀態管理
  getActiveExtractions(): Promise<StandardResponse<ExtractionStatus[]>>
  getExtractionHistory(): Promise<StandardResponse<ExtractionHistory>>
}

// 相關型別定義
interface ExtractionConfig {
  platform: string
  extractionType: 'full' | 'incremental' | 'selective'
  options: ExtractionOptions
  filters?: DataFilters
}

interface ExtractionResult {
  extractionId: string
  status: 'completed' | 'partial' | 'failed'
  data: ExtractedData
  metadata: ExtractionMetadata
  duration: number
  errors?: ExtractionError[]
}
```

### 4. Messaging Domain API

```typescript
interface MessagingDomainAPI extends DomainAPI {
  // 訊息路由
  routeMessage(
    message: Message,
    destination: MessageDestination
  ): Promise<StandardResponse<MessageResult>>
  broadcastMessage(
    message: Message,
    targets: MessageTarget[]
  ): Promise<StandardResponse<BroadcastResult>>

  // 會話管理
  createSession(sessionConfig: SessionConfig): Promise<StandardResponse<Session>>
  getSession(sessionId: string): Promise<StandardResponse<Session>>
  closeSession(sessionId: string): Promise<StandardResponse<void>>

  // 訊息隊列
  enqueueMessage(message: Message): Promise<StandardResponse<void>>
  dequeueMessage(queueName: string): Promise<StandardResponse<Message>>
  getQueueStatus(queueName: string): Promise<StandardResponse<QueueStatus>>

  // 通訊統計
  getMessagingStats(): Promise<StandardResponse<MessagingStats>>
  getMessageHistory(filter?: MessageFilter): Promise<StandardResponse<MessageHistory>>
}

// 相關型別定義
interface Message {
  id: string
  type: string
  source: string
  destination: string
  data: any
  timestamp: number
  priority: 'low' | 'normal' | 'high' | 'urgent'
  metadata?: MessageMetadata
}

interface Session {
  id: string
  participants: string[]
  status: 'active' | 'idle' | 'closed'
  createdAt: number
  lastActivity: number
}
```

### 5. Platform Domain API

```typescript
interface PlatformDomainAPI extends DomainAPI {
  // 平台檢測
  detectPlatform(url: string): Promise<StandardResponse<PlatformInfo>>
  getSupportedPlatforms(): Promise<StandardResponse<PlatformList>>

  // 適配器管理
  getAdapter(platform: string): Promise<StandardResponse<PlatformAdapter>>
  registerAdapter(platform: string, adapter: PlatformAdapter): Promise<StandardResponse<void>>
  loadAdapter(platform: string): Promise<StandardResponse<AdapterLoadResult>>

  // 平台切換
  switchToPlatform(platform: string): Promise<StandardResponse<SwitchResult>>
  getCurrentPlatform(): Promise<StandardResponse<PlatformInfo>>

  // 跨平台路由
  routeToAllPlatforms(operation: string, data: any): Promise<StandardResponse<MultiPlatformResult>>
  routeToPlatforms(
    platforms: string[],
    operation: string,
    data: any
  ): Promise<StandardResponse<MultiPlatformResult>>

  // 平台隔離
  isolatePlatformData(platform: string): Promise<StandardResponse<IsolationResult>>
  validatePlatformIntegrity(platform: string): Promise<StandardResponse<IntegrityReport>>

  // 平台註冊
  registerPlatform(platform: PlatformDefinition): Promise<StandardResponse<RegistrationResult>>
  unregisterPlatform(platform: string): Promise<StandardResponse<void>>
}

// 相關型別定義
interface PlatformInfo {
  name: string
  displayName: string
  version: string
  capabilities: PlatformCapability[]
  status: 'active' | 'inactive' | 'error'
  adapter: AdapterInfo
}

interface PlatformAdapter {
  platform: string
  version: string
  extract(config: ExtractionConfig): Promise<ExtractionResult>
  validate(data: any): Promise<ValidationResult>
  transform(data: any): Promise<TransformedData>
}
```

### 6. Data Management Domain API

```typescript
interface DataManagementDomainAPI extends DomainAPI {
  // 資料驗證
  validateData(data: any, schema: DataSchema): Promise<StandardResponse<ValidationResult>>
  validateBulkData(
    dataArray: any[],
    schema: DataSchema
  ): Promise<StandardResponse<BulkValidationResult>>

  // 資料同步
  syncData(platforms: string[]): Promise<StandardResponse<SyncResult>>
  getSyncStatus(): Promise<StandardResponse<SyncStatus>>
  resolveSyncConflicts(
    conflicts: SyncConflict[]
  ): Promise<StandardResponse<ConflictResolutionResult>>

  // 衝突解決
  detectConflicts(data1: any, data2: any): Promise<StandardResponse<ConflictDetectionResult>>
  resolveConflict(
    conflict: DataConflict,
    strategy: ResolutionStrategy
  ): Promise<StandardResponse<ConflictResolutionResult>>

  // 儲存抽象
  store(key: string, data: any, options?: StorageOptions): Promise<StandardResponse<void>>
  retrieve(key: string, options?: StorageOptions): Promise<StandardResponse<any>>
  delete(key: string, options?: StorageOptions): Promise<StandardResponse<void>>
  exists(key: string, options?: StorageOptions): Promise<StandardResponse<boolean>>

  // 資料標準化
  normalizeData(data: any, format: DataFormat): Promise<StandardResponse<NormalizedData>>
  denormalizeData(
    normalizedData: NormalizedData,
    targetFormat: DataFormat
  ): Promise<StandardResponse<any>>

  // 備份管理
  createBackup(data: any, backupConfig: BackupConfig): Promise<StandardResponse<BackupResult>>
  restoreBackup(backupId: string): Promise<StandardResponse<RestoreResult>>
  listBackups(): Promise<StandardResponse<BackupList>>
}

// 相關型別定義
interface SyncResult {
  platforms: string[]
  syncedItems: number
  conflicts: SyncConflict[]
  duration: number
  status: 'completed' | 'partial' | 'failed'
}

interface DataConflict {
  id: string
  type: 'duplicate' | 'modified' | 'deleted'
  source: ConflictSource
  target: ConflictTarget
  severity: 'low' | 'medium' | 'high'
}
```

### 7. User Experience Domain API

```typescript
interface UserExperienceDomainAPI extends DomainAPI {
  // 主題管理
  setTheme(theme: Theme): Promise<StandardResponse<void>>
  getCurrentTheme(): Promise<StandardResponse<Theme>>
  getAvailableThemes(): Promise<StandardResponse<Theme[]>>
  registerThemeProvider(
    providerId: string,
    provider: ThemeProvider
  ): Promise<StandardResponse<void>>

  // 偏好管理
  setPreference(key: string, value: any): Promise<StandardResponse<void>>
  getPreference(key: string): Promise<StandardResponse<any>>
  getPreferences(): Promise<StandardResponse<UserPreferences>>
  resetPreferences(): Promise<StandardResponse<void>>

  // 通知管理
  showNotification(notification: Notification): Promise<StandardResponse<NotificationResult>>
  clearNotification(notificationId: string): Promise<StandardResponse<void>>
  getNotificationHistory(): Promise<StandardResponse<NotificationHistory>>

  // Popup UI 協調
  coordinatePopupState(state: PopupState): Promise<StandardResponse<PopupCoordinationResult>>
  updatePopupModule(moduleId: string, state: ModuleState): Promise<StandardResponse<void>>
  getPopupModuleStatus(): Promise<StandardResponse<PopupModuleStatus>>

  // 個人化
  getPersonalizationProfile(): Promise<StandardResponse<PersonalizationProfile>>
  updatePersonalizationProfile(profile: PersonalizationProfile): Promise<StandardResponse<void>>
  generatePersonalizedRecommendations(): Promise<StandardResponse<Recommendation[]>>

  // 無障礙
  enableAccessibilityMode(mode: AccessibilityMode): Promise<StandardResponse<void>>
  getAccessibilitySettings(): Promise<StandardResponse<AccessibilitySettings>>
  validateAccessibilityCompliance(): Promise<StandardResponse<ComplianceReport>>
}

// 相關型別定義
interface Theme {
  id: string
  name: string
  mode: 'light' | 'dark' | 'auto'
  colors: ThemeColors
  typography: ThemeTypography
}

interface PopupState {
  status: 'loading' | 'ready' | 'error' | 'extracting'
  currentPage: PageInfo
  extractionProgress?: ProgressInfo
  error?: ErrorInfo
}
```

### 8. Analytics Domain API

```typescript
interface AnalyticsDomainAPI extends DomainAPI {
  // 資料收集
  collectEvent(event: AnalyticsEvent): Promise<StandardResponse<void>>
  collectBulkEvents(events: AnalyticsEvent[]): Promise<StandardResponse<BulkCollectionResult>>

  // 統計分析
  generateStats(query: StatsQuery): Promise<StandardResponse<Statistics>>
  generateCrossPlatformStats(): Promise<StandardResponse<CrossPlatformStats>>
  getReadingAnalytics(timeRange: TimeRange): Promise<StandardResponse<ReadingAnalytics>>

  // 報告生成
  generateReport(reportType: ReportType, config: ReportConfig): Promise<StandardResponse<Report>>
  getAvailableReports(): Promise<StandardResponse<ReportType[]>>
  scheduleReport(
    reportType: ReportType,
    schedule: ReportSchedule
  ): Promise<StandardResponse<ScheduledReport>>

  // 趨勢分析
  analyzeTrends(
    data: AnalyticsData,
    analysisType: TrendAnalysisType
  ): Promise<StandardResponse<TrendAnalysis>>
  predictTrends(historicalData: AnalyticsData): Promise<StandardResponse<TrendPrediction>>

  // 視覺化
  generateVisualization(
    data: AnalyticsData,
    chartType: ChartType
  ): Promise<StandardResponse<Visualization>>
  getVisualizationTemplates(): Promise<StandardResponse<VisualizationTemplate[]>>

  // 目標追蹤
  setReadingGoal(goal: ReadingGoal): Promise<StandardResponse<void>>
  getReadingGoalProgress(): Promise<StandardResponse<GoalProgress>>
  updateGoalProgress(progress: ProgressUpdate): Promise<StandardResponse<void>>
}

// 相關型別定義
interface AnalyticsEvent {
  type: string
  category: string
  action: string
  label?: string
  value?: number
  metadata?: EventMetadata
  timestamp: number
}

interface ReadingAnalytics {
  totalReadingTime: number
  booksCompleted: number
  averageDailyReading: number
  readingStreak: number
  preferredGenres: GenreStats[]
  readingEfficiency: number
}
```

### 9. Security Domain API

```typescript
interface SecurityDomainAPI extends DomainAPI {
  // 資料加密
  encrypt(data: any, encryptionLevel?: EncryptionLevel): Promise<StandardResponse<EncryptedData>>
  decrypt(encryptedData: EncryptedData): Promise<StandardResponse<any>>
  generateEncryptionKey(algorithm: EncryptionAlgorithm): Promise<StandardResponse<EncryptionKey>>

  // 隱私保護
  anonymizeData(
    data: any,
    anonymizationLevel: AnonymizationLevel
  ): Promise<StandardResponse<AnonymizedData>>
  validateDataPrivacy(data: any): Promise<StandardResponse<PrivacyValidationResult>>

  // 權限控制
  checkPermission(operation: string, resource?: string): Promise<StandardResponse<boolean>>
  grantPermission(
    operation: string,
    resource?: string
  ): Promise<StandardResponse<PermissionGrantResult>>
  revokePermission(operation: string, resource?: string): Promise<StandardResponse<void>>
  listPermissions(): Promise<StandardResponse<Permission[]>>

  // 審計日誌
  logSecurityEvent(event: SecurityEvent): Promise<StandardResponse<void>>
  getSecurityLogs(filter: LogFilter): Promise<StandardResponse<SecurityLog[]>>
  generateComplianceReport(timeRange: TimeRange): Promise<StandardResponse<ComplianceReport>>

  // 平台隔離
  isolatePlatformData(platform: string): Promise<StandardResponse<IsolationResult>>
  validateDataIntegrity(data: any): Promise<StandardResponse<IntegrityValidationResult>>

  // 安全策略
  applySecurityPolicy(policy: SecurityPolicy): Promise<StandardResponse<PolicyApplicationResult>>
  getActiveSecurityPolicies(): Promise<StandardResponse<SecurityPolicy[]>>
  validateSecurityCompliance(): Promise<StandardResponse<ComplianceReport>>
}

// 相關型別定義
interface SecurityEvent {
  type: 'access' | 'modification' | 'deletion' | 'encryption' | 'violation'
  severity: 'low' | 'medium' | 'high' | 'critical'
  source: string
  target: string
  details: SecurityEventDetails
  timestamp: number
}

interface EncryptedData {
  id: string
  algorithm: EncryptionAlgorithm
  keyId: string
  encryptedContent: string
  integrity: IntegrityHash
  metadata: EncryptionMetadata
}
```

## 🔄 跨 Domain 協作模式

### 標準協作流程

```typescript
// 1. 事件驅動協作
interface DomainEventCollaboration {
  // 發送跨 Domain 事件
  emitCrossDomainEvent(targetDomain: string, eventType: string, data: any): Promise<void>

  // 監聽跨 Domain 事件
  onCrossDomainEvent(sourceDomain: string, eventType: string, handler: EventHandler): void

  // 請求其他 Domain 服務
  requestDomainService(domain: string, service: string, method: string, params: any): Promise<any>
}

// 2. 鏈式協作模式
interface ChainedCollaboration {
  // 建立協作鏈
  createCollaborationChain(domains: string[], operation: string): Promise<CollaborationChain>

  // 執行協作鏈
  executeChain(chain: CollaborationChain, data: any): Promise<ChainResult>
}

// 3. 並行協作模式
interface ParallelCollaboration {
  // 並行執行多個 Domain 操作
  executeParallel(operations: DomainOperation[]): Promise<ParallelResult[]>

  // 聚合並行結果
  aggregateResults(results: ParallelResult[]): Promise<AggregatedResult>
}
```

### 協作範例：完整的書庫提取流程

```typescript
async function executeBookExtractionWorkflow(
  extractionRequest: ExtractionRequest
): Promise<WorkflowResult> {
  // 1. UX Domain: 檢查用戶偏好
  const userPreferences = await uxDomain.getPreference('extraction.preferences')

  // 2. Security Domain: 驗證權限
  const hasPermission = await securityDomain.checkPermission('EXTRACTION.EXECUTE')
  if (!hasPermission) {
    throw new SecurityError('Insufficient permissions for extraction')
  }

  // 3. Platform Domain: 獲取適配器
  const adapter = await platformDomain.getAdapter(extractionRequest.platform)

  // 4. Page Domain: 驗證頁面狀態
  const pageInfo = await pageDomain.getCurrentPageInfo()
  if (!pageInfo.data.extractable) {
    throw new ExtractionError('Current page is not extractable')
  }

  // 5. Extraction Domain: 執行提取
  const extractionResult = await extractionDomain.startExtraction({
    platform: extractionRequest.platform,
    adapter,
    preferences: userPreferences.data
  })

  // 6. Data Management Domain: 處理資料
  const processedData = await dataManagementDomain.store('extracted_books', extractionResult.data)

  // 7. Analytics Domain: 記錄統計
  await analyticsDomain.collectEvent({
    type: 'extraction_completed',
    category: 'user_action',
    action: 'extract_books',
    value: extractionResult.data.bookCount,
    metadata: { platform: extractionRequest.platform }
  })

  // 8. UX Domain: 更新界面
  await uxDomain.coordinatePopupState({
    status: 'ready',
    currentPage: pageInfo.data,
    lastExtraction: {
      success: true,
      bookCount: extractionResult.data.bookCount,
      timestamp: Date.now()
    }
  })

  return {
    success: true,
    data: processedData.data,
    analytics: extractionResult.data.bookCount
  }
}
```

這個完整的 API 介面定義確保了：

- 🎯 **明確的協作介面**: 每個 Domain 都知道如何與其他 Domain 協作
- 🔒 **型別安全**: TypeScript 介面提供編譯時型別檢查
- 🔄 **事件驅動**: 基於統一事件系統的非同步協作
- 📈 **可擴展**: 為未來功能擴展提供清楚的介面規範
- 🧪 **可測試**: 每個介面都可以獨立測試和 Mock
