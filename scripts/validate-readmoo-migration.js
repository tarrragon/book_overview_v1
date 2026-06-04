#!/usr/bin/env node

/**
 * @fileoverview Readmoo Migration Validation Script
 * @version v2.0.0
 * @since 2025-08-15
 *
 * 快速驗證腳本，用於驗證 Readmoo 平台遷移驗證系統的實作
 *
 * 功能：
 * - 快速執行核心驗證功能
 * - 驗證事件系統整合
 * - 檢查資料提取邏輯
 * - 產生簡要驗證報告
 */

const path = require('path')

// 設定路徑
const PROJECT_ROOT = path.resolve(__dirname, '..')
const SRC_PATH = path.join(PROJECT_ROOT, 'src')

// 引入必要模組
const ReadmooPlatformMigrationValidator = require(path.join(SRC_PATH, 'platform/readmoo-platform-migration-validator'))
const EventBus = require(path.join(SRC_PATH, 'core/event-bus'))
const PlatformDetectionService = require(path.join(SRC_PATH, 'background/domains/platform/services/platform-detection-service'))

// 模擬 Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: () => Promise.resolve(),
    onMessage: {
      addListener: () => {},
      removeListener: () => {}
    }
  },
  storage: {
    local: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve()
    }
  }
}

// 模擬 performance API
global.performance = {
  now: () => Date.now()
}

// 簡單的 Readmoo 適配器模擬
class MockReadmooAdapter {
  constructor () {
    this.mockBooks = [
      {
        id: 'readmoo-validation-book-1',
        title: '驗證測試書籍 1',
        author: '測試作者 1',
        progress: 35,
        platform: 'READMOO',
        cover: 'https://readmoo.com/cover1.jpg',
        lastRead: '2025-08-15'
      },
      {
        id: 'readmoo-validation-book-2',
        title: '驗證測試書籍 2',
        author: '測試作者 2',
        progress: 67,
        platform: 'READMOO',
        cover: 'https://readmoo.com/cover2.jpg',
        lastRead: '2025-08-14'
      }
    ]
  }

  async extractBookData (context) {
    // 模擬網路延遲
    await new Promise(resolve => setTimeout(resolve, 50))

    if (context.url && context.url.includes('readmoo.com')) {
      return [...this.mockBooks]
    } else {
      throw new Error('Invalid Readmoo URL')
    }
  }

  validateExtractedData (data) {
    if (!Array.isArray(data)) return false

    return data.every(item => {
      return item.id && item.title && item.author &&
             typeof item.progress === 'number' && item.platform === 'READMOO'
    })
  }

  isOnBookLibraryPage (url) {
    return url && url.includes('readmoo.com/library')
  }
}

/**
 * 主要驗證函數
 */
async function runValidation () {
  console.log('🚀 開始 Readmoo 平台遷移驗證...\n')

  try {
    // 初始化組件
    console.log('📦 初始化驗證組件...')
    const eventBus = new EventBus()
    const platformDetectionService = new PlatformDetectionService(eventBus)
    const readmooAdapter = new MockReadmooAdapter()

    const migrationValidator = new ReadmooPlatformMigrationValidator({
      eventBus,
      readmooAdapter,
      platformDetectionService
    })

    console.log('✅ 組件初始化完成\n')

    // 測試案例
    const testCases = [
      {
        name: '正常 Readmoo 庫頁面',
        context: {
          url: 'https://readmoo.com/library',
          hostname: 'readmoo.com',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        expectedValid: true
      },
      {
        name: 'Readmoo 書籍頁面',
        context: {
          url: 'https://readmoo.com/book/123',
          hostname: 'readmoo.com'
        },
        expectedValid: true
      },
      {
        name: '非 Readmoo 平台',
        context: {
          url: 'https://example.com',
          hostname: 'example.com'
        },
        expectedValid: false
      }
    ]

    const results = []

    // 執行驗證測試
    for (const testCase of testCases) {
      console.log(`🧪 測試案例: ${testCase.name}`)
      console.log(`   URL: ${testCase.context.url}`)

      const startTime = Date.now()

      try {
        const result = await migrationValidator.validateReadmooMigration(testCase.context)
        const endTime = Date.now()

        const testResult = {
          ...testCase,
          result,
          duration: endTime - startTime,
          success: result.isValid === testCase.expectedValid
        }

        results.push(testResult)

        if (testResult.success) {
          console.log(`   ✅ 測試通過 (${testResult.duration}ms)`)
        } else {
          console.log(`   ❌ 測試失敗 - 預期: ${testCase.expectedValid}, 實際: ${result.isValid}`)
        }

        if (result.errors.length > 0) {
          console.log(`   錯誤: ${result.errors.join(', ')}`)
        }
      } catch (error) {
        console.log(`   💥 測試異常: ${error.message}`)
        results.push({
          ...testCase,
          error: error.message,
          success: false,
          duration: Date.now() - startTime
        })
      }

      console.log('')
    }

    // 測試事件系統整合
    console.log('🎭 測試事件系統整合...')

    const eventPromises = []
    const testEvents = [
      'PLATFORM.READMOO.VALIDATION.COMPLETED',
      'EXTRACTION.READMOO.DATA.COMPLETED'
    ]

    testEvents.forEach(eventType => {
      eventPromises.push(new Promise(resolve => {
        const timeout = setTimeout(() => resolve({ received: false, eventType }), 2000)
        eventBus.on(eventType, (data) => {
          clearTimeout(timeout)
          resolve({ received: true, eventType, data })
        })
      }))
    })

    // 觸發事件
    await eventBus.emit('PLATFORM.READMOO.VALIDATION.COMPLETED', { test: true })
    await eventBus.emit('EXTRACTION.READMOO.DATA.COMPLETED', { test: true })

    const eventResults = await Promise.all(eventPromises)

    eventResults.forEach(eventResult => {
      if (eventResult.received) {
        console.log(`   ✅ 事件 ${eventResult.eventType} 正常`)
      } else {
        console.log(`   ❌ 事件 ${eventResult.eventType} 未收到`)
      }
    })

    console.log('')

    // 測試驗證報告生成
    console.log('📊 生成驗證報告...')
    const report = migrationValidator.getValidationReport()

    console.log(`   總驗證次數: ${report.overview.totalValidations}`)
    console.log(`   成功率: ${(report.overview.successRate * 100).toFixed(1)}%`)
    console.log(`   平均驗證時間: ${report.overview.averageValidationTime.toFixed(1)}ms`)

    // 測試總結
    console.log('\n📋 驗證總結:')
    const totalTests = results.length
    const passedTests = results.filter(r => r.success).length
    const failedTests = totalTests - passedTests

    console.log(`   總測試數: ${totalTests}`)
    console.log(`   通過: ${passedTests}`)
    console.log(`   失敗: ${failedTests}`)
    console.log(`   通過率: ${((passedTests / totalTests) * 100).toFixed(1)}%`)

    if (failedTests === 0) {
      console.log('\n🎉 所有測試通過！Readmoo 平台遷移驗證系統實作成功！')
      process.exit(0)
    } else {
      console.log('\n⚠️  部分測試失敗，請檢查實作。')
      process.exit(1)
    }
  } catch (error) {
    console.error('💥 驗證過程發生錯誤:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

/**
 * 資料完整性測試
 */
async function testDataIntegrity () {
  console.log('🔍 測試資料完整性驗證...')

  const eventBus = new EventBus()
  const platformDetectionService = new PlatformDetectionService(eventBus)
  const readmooAdapter = new MockReadmooAdapter()

  const migrationValidator = new ReadmooPlatformMigrationValidator({
    eventBus,
    readmooAdapter,
    platformDetectionService
  })

  // 測試資料完整性
  const beforeData = [
    { id: '1', title: '書籍1', author: '作者1', progress: 50 },
    { id: '2', title: '書籍2', author: '作者2', progress: 75 }
  ]

  const afterData = [
    { id: '1', title: '書籍1', author: '作者1', progress: 50 },
    { id: '2', title: '書籍2', author: '作者2', progress: 75 }
  ]

  const integrityResult = await migrationValidator.validateDataIntegrity(beforeData, afterData)

  if (integrityResult.isValid) {
    console.log('   ✅ 資料完整性驗證通過')
    console.log(`   完整性分數: ${integrityResult.data.integrityScore}`)
    console.log(`   資料遺失: ${integrityResult.data.dataLoss}`)
    console.log(`   資料損壞: ${integrityResult.data.dataCorruption}`)
  } else {
    console.log('   ❌ 資料完整性驗證失敗')
    console.log(`   錯誤: ${integrityResult.errors.join(', ')}`)
  }

  // 測試資料遺失檢測
  const incompleteAfterData = [
    { id: '1', title: '書籍1', author: '作者1', progress: 50 }
    // 缺少第二本書
  ]

  const lossResult = await migrationValidator.validateDataIntegrity(beforeData, incompleteAfterData)

  if (!lossResult.isValid && lossResult.data.dataLoss > 0) {
    console.log('   ✅ 資料遺失檢測正常')
  } else {
    console.log('   ❌ 資料遺失檢測失敗')
  }

  console.log('')
}

// 主程式入口
async function main () {
  console.log('🔧 Readmoo Platform Migration Validator 快速驗證腳本')
  console.log('=' * 60)
  console.log('')

  await testDataIntegrity()
  await runValidation()
}

// 執行主程式
if (require.main === module) {
  main().catch(error => {
    console.error('💥 腳本執行失敗:', error.message)
    process.exit(1)
  })
}

module.exports = {
  runValidation,
  testDataIntegrity
}
