/**
 * 效能測試閾值配置
 *
 * 需求：將硬編碼效能閾值提取為可配置常數，
 * 支援不同環境（CI/local）使用不同閾值，提高測試穩定性。
 *
 * 設計意圖：
 * - 時間閾值乘以環境乘數（CI 環境 CPU 較慢，需要寬鬆閾值）
 * - 記憶體閾值不乘環境乘數（記憶體較不受 CPU 速度影響）
 * - 比率閾值不乘環境乘數（比率是相對值，不受環境影響）
 */

// 環境偵測：CI 環境通常較慢，需要較寬鬆的閾值
const IS_CI = !!(process.env.CI || process.env.GITHUB_ACTIONS || process.env.JENKINS_URL)

// 環境乘數：CI 環境比 local 寬鬆
const ENV_MULTIPLIER = IS_CI ? 2.0 : 1.0

const PERFORMANCE_CONFIG = {
  environment: IS_CI ? 'ci' : 'local',
  multiplier: ENV_MULTIPLIER,

  // 時間閾值（毫秒）— 乘以環境乘數
  time: {
    // popup 相關
    popupLoad: 200 * ENV_MULTIPLIER,
    popupInteractive: 5000 * ENV_MULTIPLIER,
    buttonResponse: 100 * ENV_MULTIPLIER,
    searchResponse: 300 * ENV_MULTIPLIER,
    uiStateTransitionMax: 50 * ENV_MULTIPLIER,
    uiStateTransitionAvg: 30 * ENV_MULTIPLIER,
    errorRenderTime: 50 * ENV_MULTIPLIER,
    errorThrottleTime: 100 * ENV_MULTIPLIER,

    // 資料處理
    smallBookExtract: 1000 * ENV_MULTIPLIER,
    mediumBookExtract: 8000 * ENV_MULTIPLIER,
    jsonParse: 4000 * ENV_MULTIPLIER,
    cacheWarmup: 2000 * ENV_MULTIPLIER,
    lazyLoadResource: 1000 * ENV_MULTIPLIER,

    // 平台檢測
    platformDetectAvg: 500 * ENV_MULTIPLIER,
    platformDetectMax: 1000 * ENV_MULTIPLIER,
    concurrentDetectMax: 2000 * ENV_MULTIPLIER,
    cacheHitFast: 10 * ENV_MULTIPLIER,
    highLoadAvgTime: 800 * ENV_MULTIPLIER,
    highLoadMaxTime: 2000 * ENV_MULTIPLIER,

    // Chrome API
    chromeApiMaxDelay: 50 * ENV_MULTIPLIER,

    // ErrorCodes
    basicErrorCreateAvg: 2.0 * ENV_MULTIPLIER,
    basicErrorCreateP95: 5.0 * ENV_MULTIPLIER,
    basicErrorCreate1000Total: 500 * ENV_MULTIPLIER,
    complexErrorCreateAvg: 5.0 * ENV_MULTIPLIER,
    complexErrorCreateP95: 10.0 * ENV_MULTIPLIER,
    commonErrorsAvgAccess: 0.1 * ENV_MULTIPLIER,
    commonErrorsMaxAccess: 5.0 * ENV_MULTIPLIER,
    errorAdapterAvgTime: 2.0 * ENV_MULTIPLIER,
    errorCreate1000Time: 100 * ENV_MULTIPLIER,

    // 初始化
    uiManagerInit: 200 * ENV_MULTIPLIER,
    errorHandlerInit: 100 * ENV_MULTIPLIER,
    systemInit: 200 * ENV_MULTIPLIER,

    // 事件處理
    eventProcessTotal: 1000 * ENV_MULTIPLIER,
    errorProcessAvg: 5 * ENV_MULTIPLIER,
    errorProcess100Total: 500 * ENV_MULTIPLIER,

    // 效能最佳化測試
    optimizedLoadTotal: 5000 * ENV_MULTIPLIER,
    searchResponseTarget: 500 * ENV_MULTIPLIER,
    chromeStoreStartup: 3000 * ENV_MULTIPLIER,
    chromeStoreInteraction: 1000 * ENV_MULTIPLIER,
    cacheHitTime: 200 * ENV_MULTIPLIER,
  },

  // 記憶體閾值（bytes）— 不乘環境乘數（記憶體較不受 CPU 速度影響）
  memory: {
    singleErrorObject: 5 * 1024 * 1024,       // 5MB
    errorObjectGCTolerance: 5 * 1024 * 1024,   // 5MB
    perBookEfficiency: 50 * 1024,               // 50KB/book
    error1000Total: 10 * 1024 * 1024,          // 10MB
    avgPerError: 5 * 1024,                      // 5KB
    gcFinalIncrease: 5 * 1024 * 1024,          // 5MB
    leakDetectMax: 100 * 1024 * 1024,          // 100MB
    leakDetectThreshold: 100 * 1024,           // 100KB
    leakRateMax: 500 * 1024,                   // 500KB/ms

    popupOpen: 50 * 1024 * 1024,               // 50MB
    smallBookExtract: 20 * 1024 * 1024,        // 20MB
    mediumBookExtract: 50 * 1024 * 1024,       // 50MB
    platformDetectSingle: 5 * 1024 * 1024,     // 5MB

    searchResponse: 10 * 1024 * 1024,          // 10MB
    chromeStoreLimit: 50 * 1024 * 1024,        // 50MB

    errorHandlerInit: 5 * 1024 * 1024,         // 5MB
    diagnosticInit: 5 * 1024 * 1024,           // 5MB

    performanceDelta: 10 * 1024 * 1024,        // 10MB
  },

  // 比率閾值 — 不乘環境乘數
  ratio: {
    cacheHitRate: 0.8,                          // 80%
    concurrentSuccessRate: 0.95,                // 95%
    highLoadSuccessRate: 0.90,                  // 90%
    minGCRecoveryRate: 0.1,                     // 10%
    memoryGrowthVariance: 20,                   // 20 倍波動容忍
    commonErrorsPerformanceVariance: 50,        // 50%
    performanceRegressionTolerance: 2.0,        // 200%
    cachePerformanceImprovement: 2,             // 2 倍加速
    commonErrorsSpeedup: 2.0,                   // 2 倍
    errorAdapterOverhead: 3.0,                  // 3 倍
    errorHandlingImpact: 2.0,                   // 2 倍
    minFps: 30,                                 // 30fps
    maxDomQueries: 250,                         // 250 次
    maxErrorHistory: 100,                       // 100 條
    minEventsPerSecond: 1000,                   // 1000 事件/秒
    jsonParseMinSpeed: 0.5,                     // 0.5 MB/s
    memoryMaxIncrease: 2.0,                     // 最大記憶體增長 200%
    batchSuccessRate: 0.95,                     // 批量成功率 95%
  },
}

module.exports = { PERFORMANCE_CONFIG, IS_CI, ENV_MULTIPLIER }
