#!/usr/bin/env node

/**
 * 雙重錯誤系統測試腳本
 *
 * 功能：
 * - 測試 StandardError 和 ErrorCodes 雙重系統橋接
 * - 驗證不同模式下的錯誤轉換
 * - 檢查相容性和效能
 * - 模擬遷移過程中的各種情境
 */

const path = require('path')

// 設定模組路徑解析
const rootDir = path.join(__dirname, '..')
require('module').globalPaths.push(path.join(rootDir, 'src'))

// 模擬 src/ 路徑解析
const Module = require('module')
const originalRequire = Module.prototype.require

Module.prototype.require = function(id) {
  if (id.startsWith('src/')) {
    const resolvedPath = path.join(rootDir, id)
    return originalRequire.call(this, resolvedPath)
  }
  return originalRequire.call(this, id)
}

// 載入必要模組
const { DualErrorSystemBridge, DUAL_SYSTEM_MODES, COMPATIBILITY_LEVELS } = require('src/core/migration/DualErrorSystemBridge')

/**
 * 測試案例定義
 */
const TEST_CASES = {
  standardError: {
    name: 'StandardError',
    code: 'VALIDATION_ERROR',
    message: '輸入資料驗證失敗',
    category: 'validation',
    details: { field: 'email', value: 'invalid-email' },
    timestamp: Date.now()
  },

  errorCodesError: {
    message: 'DOM 元素存取失敗',
    errorCode: 'DOM_ERROR',
    subType: 'ElementNotFound',
    severity: 'MEDIUM',
    details: { selector: '#book-list', action: 'click' },
    timestamp: Date.now()
  },

  nativeError: new Error('未預期的網路錯誤'),

  customError: {
    message: '自訂錯誤格式',
    type: 'CUSTOM_ERROR',
    data: { custom: true }
  }
}

/**
 * 主要測試函式
 */
async function runDualSystemTests() {
  console.log('🧪 開始雙重錯誤系統測試...\n')

  try {
    // 測試所有模式
    for (const mode of Object.values(DUAL_SYSTEM_MODES)) {
      console.log(`🔧 測試模式: ${mode}`)
      await testBridgeMode(mode)
      console.log('')
    }

    // 測試相容性等級
    for (const level of Object.values(COMPATIBILITY_LEVELS)) {
      console.log(`📋 測試相容性等級: ${level}`)
      await testCompatibilityLevel(level)
      console.log('')
    }

    // 測試遷移過程模擬
    console.log('🚀 測試遷移過程模擬')
    await testMigrationSimulation()
    console.log('')

    // 效能測試
    console.log('⚡ 效能基準測試')
    await performanceTest()
    console.log('')

    // 壓力測試
    console.log('💪 壓力測試')
    await stressTest()

    console.log('✅ 所有測試完成！')

  } catch (error) {
    console.error('❌ 測試失敗:', error.message)
    process.exit(1)
  }
}

/**
 * 測試特定橋接模式
 * @param {string} mode - 橋接模式
 */
async function testBridgeMode(mode) {
  const bridge = new DualErrorSystemBridge({
    mode,
    enableLogging: false,
    enableMetrics: true
  })

  console.log(`   模式: ${mode}`)

  for (const [testName, testError] of Object.entries(TEST_CASES)) {
    try {
      const bridgedError = bridge.bridgeError(testError)

      console.log(`   ✅ ${testName}: 橋接成功`)

      // 驗證基本屬性
      if (!bridgedError.message) {
        throw new Error('缺少 message 屬性')
      }

      // 根據模式驗證特定屬性
      switch (mode) {
        case DUAL_SYSTEM_MODES.LEGACY_FIRST:
          if (!bridgedError.code && !bridgedError.name) {
            console.warn(`   ⚠️  ${testName}: 可能缺少 StandardError 格式屬性`)
          }
          break

        case DUAL_SYSTEM_MODES.ERRORCODES_FIRST:
          if (!bridgedError.errorCode && !bridgedError._legacyCompat) {
            console.warn(`   ⚠️  ${testName}: 可能缺少 ErrorCodes 格式屬性`)
          }
          break

        case DUAL_SYSTEM_MODES.PARALLEL:
          if (!bridgedError.legacy || !bridgedError.errorCodes) {
            console.warn(`   ⚠️  ${testName}: 平行模式缺少雙重格式`)
          }
          break
      }

    } catch (error) {
      console.log(`   ❌ ${testName}: ${error.message}`)
    }
  }

  // 顯示統計
  const report = bridge.getSystemStatusReport()
  console.log(`   📊 統計: ${report.statistics.totalErrors} 錯誤處理, 快取命中率 ${(report.statistics.cacheStats.hitRate * 100).toFixed(1)}%`)
}

/**
 * 測試相容性等級
 * @param {string} level - 相容性等級
 */
async function testCompatibilityLevel(level) {
  const bridge = new DualErrorSystemBridge({
    mode: DUAL_SYSTEM_MODES.PARALLEL,
    compatibilityLevel: level,
    enableLogging: false
  })

  console.log(`   相容性等級: ${level}`)

  let successCount = 0
  let warningCount = 0
  let errorCount = 0

  for (const [testName, testError] of Object.entries(TEST_CASES)) {
    try {
      const bridgedError = bridge.bridgeError(testError)
      successCount++
      console.log(`   ✅ ${testName}: 通過驗證`)
    } catch (error) {
      if (error.message.includes('警告')) {
        warningCount++
        console.log(`   ⚠️  ${testName}: ${error.message}`)
      } else {
        errorCount++
        console.log(`   ❌ ${testName}: ${error.message}`)
      }
    }
  }

  console.log(`   📊 結果: ${successCount} 成功, ${warningCount} 警告, ${errorCount} 錯誤`)
}

/**
 * 遷移過程模擬測試
 */
async function testMigrationSimulation() {
  const bridge = new DualErrorSystemBridge({
    mode: DUAL_SYSTEM_MODES.TRANSITIONAL,
    enableLogging: true,
    enableMetrics: true
  })

  console.log('   模擬遷移進度...')

  // 模擬遷移階段
  const migrationStages = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]

  for (const progress of migrationStages) {
    bridge.updateMigrationProgress(progress)

    // 在每個階段測試錯誤處理
    const testError = TEST_CASES.standardError
    const bridgedError = bridge.bridgeError(testError)

    console.log(`   📊 進度 ${(progress * 100).toFixed(0)}%: 橋接成功`)

    // 檢查不同階段的行為
    if (progress < 0.3) {
      // 早期階段應該偏向 Legacy
      if (!bridgedError.code && !bridgedError.name) {
        console.warn('   ⚠️  早期階段未偏向 Legacy 系統')
      }
    } else if (progress > 0.7) {
      // 後期階段應該偏向 ErrorCodes
      if (!bridgedError.errorCode && !bridgedError._legacyCompat) {
        console.warn('   ⚠️  後期階段未偏向 ErrorCodes 系統')
      }
    }
  }

  // 最終報告
  const finalReport = bridge.getSystemStatusReport()
  console.log(`   🎯 最終狀態: ${finalReport.systemState.currentState}`)
  console.log(`   📈 健康度: ${finalReport.healthIndicators.overall}`)
}

/**
 * 效能基準測試
 */
async function performanceTest() {
  const bridge = new DualErrorSystemBridge({
    mode: DUAL_SYSTEM_MODES.PARALLEL,
    enableMetrics: true,
    enableLogging: false
  })

  const iterations = 1000
  const testError = TEST_CASES.standardError

  console.log(`   執行 ${iterations} 次橋接操作...`)

  const startTime = process.hrtime.bigint()

  for (let i = 0; i < iterations; i++) {
    bridge.bridgeError(testError)
  }

  const endTime = process.hrtime.bigint()
  const totalTime = Number(endTime - startTime) / 1000000 // 轉換為毫秒

  const report = bridge.getSystemStatusReport()
  const avgConversionTime = report.statistics.performanceStats.averageConversionTime

  console.log(`   ⚡ 總時間: ${totalTime.toFixed(2)}ms`)
  console.log(`   📊 平均每次: ${(totalTime / iterations).toFixed(3)}ms`)
  console.log(`   🎯 內部測量平均: ${avgConversionTime.toFixed(3)}ms`)
  console.log(`   💾 快取命中率: ${(report.statistics.cacheStats.hitRate * 100).toFixed(1)}%`)

  // 效能基準驗證
  if (avgConversionTime > 1.0) {
    console.warn('   ⚠️  平均轉換時間過長 (>1ms)')
  } else {
    console.log('   ✅ 效能表現良好')
  }
}

/**
 * 壓力測試
 */
async function stressTest() {
  const bridge = new DualErrorSystemBridge({
    mode: DUAL_SYSTEM_MODES.PARALLEL,
    enableMetrics: true,
    enableLogging: false
  })

  const concurrentOperations = 100
  const operationsPerBatch = 50

  console.log(`   執行 ${concurrentOperations} 個併發操作...`)

  const promises = []

  for (let i = 0; i < concurrentOperations; i++) {
    const promise = new Promise((resolve, reject) => {
      try {
        const operations = []

        for (let j = 0; j < operationsPerBatch; j++) {
          const testError = Object.values(TEST_CASES)[j % Object.keys(TEST_CASES).length]
          const bridgedError = bridge.bridgeError(testError)
          operations.push(bridgedError)
        }

        resolve(operations.length)
      } catch (error) {
        reject(error)
      }
    })

    promises.push(promise)
  }

  try {
    const results = await Promise.all(promises)
    const totalOperations = results.reduce((sum, count) => sum + count, 0)

    console.log(`   ✅ 壓力測試完成: ${totalOperations} 次操作成功`)

    const report = bridge.getSystemStatusReport()
    console.log(`   📊 系統健康度: ${report.healthIndicators.overall}`)
    console.log(`   🔧 系統穩定性: ${report.healthIndicators.systemStability}`)

    if (report.healthIndicators.overall === 'poor') {
      console.warn('   ⚠️  系統在高負載下表現不佳')
    }

  } catch (error) {
    console.error('   ❌ 壓力測試失敗:', error.message)
  }
}

/**
 * 測試特定情境
 */
async function testSpecificScenarios() {
  console.log('🎭 特定情境測試')

  // 情境 1: 快取效能測試
  console.log('   情境 1: 快取效能測試')
  await testCachePerformance()

  // 情境 2: 錯誤鏈測試
  console.log('   情境 2: 錯誤鏈測試')
  await testErrorChaining()

  // 情境 3: 記憶體洩漏測試
  console.log('   情境 3: 記憶體洩漏測試')
  await testMemoryLeaks()
}

/**
 * 快取效能測試
 */
async function testCachePerformance() {
  const bridge = new DualErrorSystemBridge({
    mode: DUAL_SYSTEM_MODES.PARALLEL,
    enableMetrics: true,
    enableLogging: false
  })

  const sameError = TEST_CASES.standardError
  const iterations = 100

  // 第一次處理（冷快取）
  const coldStart = process.hrtime.bigint()
  bridge.bridgeError(sameError)
  const coldTime = Number(process.hrtime.bigint() - coldStart) / 1000000

  // 重複處理（熱快取）
  const warmStart = process.hrtime.bigint()
  for (let i = 0; i < iterations; i++) {
    bridge.bridgeError(sameError)
  }
  const warmTime = Number(process.hrtime.bigint() - warmStart) / 1000000

  const report = bridge.getSystemStatusReport()
  const hitRate = report.statistics.cacheStats.hitRate

  console.log(`     冷啟動: ${coldTime.toFixed(3)}ms`)
  console.log(`     熱快取平均: ${(warmTime / iterations).toFixed(3)}ms`)
  console.log(`     快取命中率: ${(hitRate * 100).toFixed(1)}%`)

  if (hitRate > 0.9) {
    console.log('     ✅ 快取效能優秀')
  } else {
    console.log('     ⚠️  快取效能需要改善')
  }
}

/**
 * 錯誤鏈測試
 */
async function testErrorChaining() {
  const bridge = new DualErrorSystemBridge({
    mode: DUAL_SYSTEM_MODES.PARALLEL,
    enableLogging: false
  })

  // 建立錯誤鏈
  const originalError = new Error('原始錯誤')
  const wrappedError = {
    message: '包裝錯誤',
    cause: originalError,
    code: 'WRAPPED_ERROR'
  }

  try {
    const bridgedError = bridge.bridgeError(wrappedError)

    if (bridgedError.legacy && bridgedError.errorCodes) {
      console.log('     ✅ 錯誤鏈橋接成功')
    } else {
      console.log('     ⚠️  錯誤鏈橋接可能不完整')
    }

    // 檢查是否保留了原始錯誤資訊
    const hasOriginalInfo = JSON.stringify(bridgedError).includes('原始錯誤')
    if (hasOriginalInfo) {
      console.log('     ✅ 保留原始錯誤資訊')
    } else {
      console.log('     ⚠️  可能遺失原始錯誤資訊')
    }

  } catch (error) {
    console.log(`     ❌ 錯誤鏈測試失敗: ${error.message}`)
  }
}

/**
 * 記憶體洩漏測試
 */
async function testMemoryLeaks() {
  const bridge = new DualErrorSystemBridge({
    mode: DUAL_SYSTEM_MODES.PARALLEL,
    enableMetrics: true,
    enableLogging: false
  })

  const initialMemory = process.memoryUsage()
  const iterations = 10000

  // 產生大量不同的錯誤以填滿快取
  for (let i = 0; i < iterations; i++) {
    const uniqueError = {
      message: `測試錯誤 ${i}`,
      code: `TEST_ERROR_${i}`,
      timestamp: Date.now() + i
    }
    bridge.bridgeError(uniqueError)
  }

  const afterProcessingMemory = process.memoryUsage()

  // 強制垃圾回收 (如果可用)
  if (global.gc) {
    global.gc()
  }

  const afterGCMemory = process.memoryUsage()

  const memoryGrowth = afterProcessingMemory.heapUsed - initialMemory.heapUsed
  const memoryAfterGC = afterGCMemory.heapUsed - initialMemory.heapUsed

  console.log(`     處理 ${iterations} 個錯誤`)
  console.log(`     記憶體增長: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`)
  console.log(`     GC 後記憶體: ${(memoryAfterGC / 1024 / 1024).toFixed(2)} MB`)

  // 清理並再次檢查
  bridge.cleanup()

  if (global.gc) {
    global.gc()
  }

  const finalMemory = process.memoryUsage()
  const finalGrowth = finalMemory.heapUsed - initialMemory.heapUsed

  console.log(`     清理後記憶體: ${(finalGrowth / 1024 / 1024).toFixed(2)} MB`)

  if (finalGrowth < memoryAfterGC * 0.5) {
    console.log('     ✅ 記憶體清理有效')
  } else {
    console.log('     ⚠️  可能存在記憶體洩漏')
  }
}

// 錯誤處理
process.on('uncaughtException', (error) => {
  console.error('💥 未捕獲的異常:', error.message)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 未處理的 Promise 拒絕:', reason)
  process.exit(1)
})

// 執行測試
if (require.main === module) {
  runDualSystemTests()
}

module.exports = { runDualSystemTests }