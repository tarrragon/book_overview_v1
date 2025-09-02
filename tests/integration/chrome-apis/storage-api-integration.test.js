/**
 * Chrome Storage API 整合測試
 *
 * 測試目標：
 * - 驗證Chrome Storage API的正確使用和錯誤處理
 * - 確保儲存配額管理、資料同步、效能優化的有效性
 * - 檢查Storage API在真實Chrome環境下的行為一致性
 */

const { E2ETestSuite } = require('../../helpers/e2e-test-suite')
const { TestDataGenerator } = require('../../helpers/test-data-generator')
const { StorageAPIValidator } = require('../../helpers/storage-api-validator')
const { QuotaMonitor } = require('../../helpers/quota-monitor')

describe('Chrome Storage API 整合測試', () => {
  let testSuite
  let extensionController
  let testDataGenerator
  let storageValidator
  let quotaMonitor

  beforeAll(async () => {
    testSuite = new E2ETestSuite({
      headless: process.env.CI !== 'false',
      slowMo: 30,
      testDataSize: 'large',
      enableStorageTracking: true // 啟用Storage追蹤
    })

    await testSuite.setup()
    extensionController = testSuite.extensionController
    testDataGenerator = new TestDataGenerator()
    storageValidator = new StorageAPIValidator(testSuite)
    quotaMonitor = new QuotaMonitor()
  })

  afterAll(async () => {
    await storageValidator.cleanup()
    await quotaMonitor.cleanup()
    await testSuite.cleanup()
  })

  beforeEach(async () => {
    // 清理所有Storage資料以確保測試隔離性
    await testSuite.clearAllStorageData()
    await quotaMonitor.reset()

    // 驗證初始Storage狀態
    const initialStorage = await extensionController.getChromeStorageUsage()
    expect(initialStorage.local.used).toBe(0)
    expect(initialStorage.local.available).toBe(5 * 1024 * 1024) // 5MB quota
  })

  describe('Chrome Storage Local API 基礎功能', () => {
    test('應該正確執行基本的Storage讀寫操作', async () => {
      // Given: 準備測試資料
      const testData = {
        books: testDataGenerator.generateBooks(50, 'storage-basic-test'),
        metadata: {
          version: '0.9.34',
          lastUpdated: new Date().toISOString(),
          totalBooks: 50
        },
        userSettings: {
          theme: 'light',
          exportFormat: 'json',
          autoSync: true
        }
      }

      // When: 執行Storage寫入操作
      const writeStart = Date.now()
      const writeResult = await extensionController.setChromeStorageData(testData)
      const writeTime = Date.now() - writeStart

      // Then: 驗證寫入結果
      expect(writeResult.success).toBe(true)
      expect(writeTime).toBeLessThan(1000) // 寫入時間<1秒
      expect(writeResult.bytesWritten).toBeGreaterThan(0)

      // 驗證資料讀取
      const readStart = Date.now()
      const readResult = await extensionController.getChromeStorageData([
        'books', 'metadata', 'userSettings'
      ])
      const readTime = Date.now() - readStart

      expect(readResult.success).toBe(true)
      expect(readTime).toBeLessThan(500) // 讀取時間<500ms

      // 驗證資料完整性
      expect(readResult.data.books).toHaveLength(50)
      expect(readResult.data.metadata.version).toBe('0.9.34')
      expect(readResult.data.metadata.totalBooks).toBe(50)
      expect(readResult.data.userSettings.theme).toBe('light')

      // 逐一驗證書籍資料
      testData.books.forEach((originalBook, index) => {
        const storedBook = readResult.data.books[index]
        expect(storedBook.id).toBe(originalBook.id)
        expect(storedBook.title).toBe(originalBook.title)
        expect(storedBook.progress).toBe(originalBook.progress)
      })
    })

    test('應該處理大量資料的分批儲存', async () => {
      // Given: 準備大量測試資料
      const largeDataset = testDataGenerator.generateBooks(1000, 'large-storage-test')
      const batchSize = 100 // 每批100本書

      // 啟動Storage監控
      await quotaMonitor.startMonitoring()

      // When: 執行分批儲存
      const batchWriteStart = Date.now()
      const batchResults = []

      for (let i = 0; i < largeDataset.length; i += batchSize) {
        const batch = largeDataset.slice(i, i + batchSize)
        const batchKey = `books_batch_${Math.floor(i / batchSize)}`

        const batchWriteResult = await extensionController.setChromeStorageData({
          [batchKey]: batch
        })

        batchResults.push({
          batchIndex: Math.floor(i / batchSize),
          success: batchWriteResult.success,
          batchSize: batch.length,
          bytesWritten: batchWriteResult.bytesWritten,
          writeTime: batchWriteResult.duration
        })

        // 短暫延遲避免Storage API限流
        await testSuite.waitForTimeout(50)
      }

      const totalBatchTime = Date.now() - batchWriteStart
      const monitoringResults = await quotaMonitor.stopMonitoring()

      // Then: 驗證分批儲存結果
      expect(batchResults.length).toBe(10) // 1000/100 = 10批
      expect(batchResults.every(result => result.success)).toBe(true)

      // 檢查儲存效能
      expect(totalBatchTime).toBeLessThan(15000) // 總時間<15秒
      const avgBatchTime = batchResults.reduce((sum, result) => sum + result.writeTime, 0) / batchResults.length
      expect(avgBatchTime).toBeLessThan(1000) // 平均每批<1秒

      // 驗證Storage使用量
      const storageUsage = await extensionController.getChromeStorageUsage()
      expect(storageUsage.local.used).toBeGreaterThan(1024 * 1024) // 使用>1MB
      expect(storageUsage.local.used).toBeLessThan(3 * 1024 * 1024) // 使用<3MB

      // 檢查配額監控結果
      expect(monitoringResults.peakUsage).toBe(storageUsage.local.used)
      expect(monitoringResults.quotaUtilization).toBeLessThan(0.6) // 配額使用<60%

      // 驗證資料讀取完整性
      const allBatchKeys = Array.from({ length: 10 }, (_, i) => `books_batch_${i}`)
      const readResult = await extensionController.getChromeStorageData(allBatchKeys)

      expect(readResult.success).toBe(true)

      // 重組並驗證完整資料
      const reassembledBooks = []
      for (let i = 0; i < 10; i++) {
        const batchKey = `books_batch_${i}`
        if (readResult.data[batchKey]) {
          reassembledBooks.push(...readResult.data[batchKey])
        }
      }

      expect(reassembledBooks).toHaveLength(1000)
      expect(reassembledBooks[0].id).toBe(largeDataset[0].id)
      expect(reassembledBooks[999].id).toBe(largeDataset[999].id)
    })

    test('應該正確處理Storage資料的更新和合併', async () => {
      // Given: 準備初始資料
      const initialBooks = testDataGenerator.generateBooks(80, 'update-test-initial')
      await extensionController.setChromeStorageData({ books: initialBooks })

      // 準備更新資料
      const updatedBooks = initialBooks.slice(0, 40).map(book => ({
        ...book,
        progress: Math.min(book.progress + 20, 100), // 增加進度
        lastModified: new Date().toISOString()
      }))

      const newBooks = testDataGenerator.generateBooks(30, 'update-test-new')

      // When: 執行資料更新和合併
      const updateStart = Date.now()

      // 模擬增量更新操作
      const updateResult = await extensionController.updateChromeStorageData({
        updateStrategy: 'merge',
        updates: {
          books: [...updatedBooks, ...newBooks] // 更新的40本 + 新增的30本
        },
        mergeOptions: {
          keyField: 'id',
          conflictResolution: 'prefer_newer',
          preserveUnmodified: true
        }
      })

      const updateTime = Date.now() - updateStart

      // Then: 驗證更新結果
      expect(updateResult.success).toBe(true)
      expect(updateTime).toBeLessThan(2000) // 更新時間<2秒

      // 檢查更新統計
      expect(updateResult.statistics.updated).toBe(40) // 更新了40本
      expect(updateResult.statistics.added).toBe(30) // 新增了30本
      expect(updateResult.statistics.unchanged).toBe(40) // 40本未改變

      // 驗證最終資料狀態
      const finalData = await extensionController.getChromeStorageData(['books'])
      expect(finalData.success).toBe(true)
      expect(finalData.data.books).toHaveLength(110) // 80初始 + 30新增

      // 驗證更新的書籍
      const updatedBooksInStorage = finalData.data.books.filter(book =>
        updatedBooks.some(updated => updated.id === book.id)
      )
      expect(updatedBooksInStorage).toHaveLength(40)

      updatedBooksInStorage.forEach(book => {
        const originalUpdated = updatedBooks.find(updated => updated.id === book.id)
        expect(book.progress).toBe(originalUpdated.progress)
        expect(book.lastModified).toBe(originalUpdated.lastModified)
      })

      // 驗證新增的書籍
      const newBooksInStorage = finalData.data.books.filter(book =>
        newBooks.some(newBook => newBook.id === book.id)
      )
      expect(newBooksInStorage).toHaveLength(30)

      // 驗證未修改的書籍保持原狀
      const unchangedBooks = finalData.data.books.filter(book =>
        initialBooks.slice(40).some(initial => initial.id === book.id)
      )
      expect(unchangedBooks).toHaveLength(40)

      unchangedBooks.forEach(book => {
        const original = initialBooks.find(initial => initial.id === book.id)
        expect(book.progress).toBe(original.progress)
        expect(book.lastModified).toBe(original.lastModified || original.extractedAt)
      })
    })
  })

  describe('Chrome Storage 配額管理', () => {
    test('應該正確監控和管理Storage配額', async () => {
      // Given: 啟動詳細的配額監控
      await quotaMonitor.startDetailedMonitoring({
        trackUsageGrowth: true,
        predictQuotaExhaustion: true,
        enableAlerts: true
      })

      // 準備會逐漸填滿Storage的資料
      const largeBooksDataset = testDataGenerator.generateBooks(2000, 'quota-management-test')

      // When: 逐步填充Storage直到接近配額限制
      const quotaTestResults = []
      const batchSize = 200

      for (let i = 0; i < largeBooksDataset.length; i += batchSize) {
        const batch = largeBooksDataset.slice(i, i + batchSize)
        const batchIndex = Math.floor(i / batchSize)

        // 執行儲存操作
        const storeResult = await extensionController.setChromeStorageData({
          [`large_batch_${batchIndex}`]: batch
        })

        // 檢查當前配額使用情況
        const currentUsage = await extensionController.getChromeStorageUsage()
        const usagePercentage = currentUsage.local.used / currentUsage.local.quota

        quotaTestResults.push({
          batchIndex,
          storeSuccess: storeResult.success,
          bytesUsed: currentUsage.local.used,
          usagePercentage,
          nearQuotaLimit: usagePercentage > 0.8
        })

        // 如果接近配額限制，測試警告機制
        if (usagePercentage > 0.8 && usagePercentage < 0.9) {
          const quotaWarning = await extensionController.checkQuotaWarning()
          expect(quotaWarning.triggered).toBe(true)
          expect(quotaWarning.usagePercentage).toBeCloseTo(usagePercentage, 2)
          expect(quotaWarning.recommendedActions).toBeDefined()
        }

        // 如果非常接近限制，停止測試以避免實際超限
        if (usagePercentage > 0.85) {
          console.log(`Stopping quota test at ${(usagePercentage * 100).toFixed(1)}% usage`)
          break
        }

        await testSuite.waitForTimeout(100) // 避免API限流
      }

      const monitoringResults = await quotaMonitor.stopDetailedMonitoring()

      // Then: 驗證配額管理機制

      // 檢查配額使用增長模式
      expect(quotaTestResults.length).toBeGreaterThan(3) // 至少進行了3批測試
      expect(quotaTestResults.every(result => result.storeSuccess)).toBe(true) // 所有儲存操作成功

      // 驗證使用量遞增
      for (let i = 1; i < quotaTestResults.length; i++) {
        expect(quotaTestResults[i].bytesUsed).toBeGreaterThan(quotaTestResults[i - 1].bytesUsed)
      }

      // 檢查配額預警機制
      const nearLimitResults = quotaTestResults.filter(result => result.nearQuotaLimit)
      if (nearLimitResults.length > 0) {
        expect(monitoringResults.quotaWarningsTriggered).toBeGreaterThan(0)
        expect(monitoringResults.quotaManagementActivated).toBe(true)
      }

      // 驗證配額預測準確性
      if (monitoringResults.quotaExhaustionPredicted) {
        expect(monitoringResults.predictedExhaustionBatches).toBeCloseTo(
          Math.ceil(5 * 1024 * 1024 / (monitoringResults.averageBatchSize || 100000)),
          2
        )
      }

      // 檢查最終配額狀態
      const finalUsage = await extensionController.getChromeStorageUsage()
      expect(finalUsage.local.used).toBeLessThan(finalUsage.local.quota) // 未超過配額
      expect(finalUsage.local.available).toBeGreaterThan(0) // 仍有可用空間
    })

    test('應該處理Storage配額超限的降級策略', async () => {
      // Given: 模擬接近配額限制的情況
      await quotaMonitor.simulateNearQuotaLimit(0.9) // 模擬90%配額使用

      // 準備會觸發配額超限的大量資料
      const quotaExceedingData = testDataGenerator.generateBooks(1000, 'quota-exceed-test')

      // When: 嘗試儲存超過配額限制的資料
      const degradationResult = await extensionController.attemptStorageWithDegradation({
        data: { massiveBooks: quotaExceedingData },
        degradationStrategies: [
          'data_compression',
          'selective_storage',
          'cleanup_old_data',
          'batch_reduction'
        ]
      })

      // Then: 驗證降級策略效果
      expect(degradationResult.attempted).toBe(true)

      // 檢查降級策略執行
      const executedStrategies = degradationResult.executedStrategies
      expect(executedStrategies.length).toBeGreaterThan(0)

      if (executedStrategies.includes('data_compression')) {
        expect(degradationResult.compressionRatio).toBeGreaterThan(0.6) // 壓縮率>60%
        expect(degradationResult.compressionEffective).toBe(true)
      }

      if (executedStrategies.includes('selective_storage')) {
        expect(degradationResult.selectiveStorageApplied).toBe(true)
        expect(degradationResult.prioritizedDataSaved).toBeGreaterThan(0)
      }

      if (executedStrategies.includes('cleanup_old_data')) {
        expect(degradationResult.oldDataCleaned).toBeGreaterThan(0)
        expect(degradationResult.spaceReclaimed).toBeGreaterThan(0)
      }

      // 驗證最終儲存結果
      if (degradationResult.finalSuccess) {
        const finalData = await extensionController.getChromeStorageData(['massiveBooks'])
        expect(finalData.success).toBe(true)

        // 資料可能被壓縮或選擇性儲存，但應該保留核心資訊
        if (finalData.data.massiveBooks) {
          expect(finalData.data.massiveBooks.length).toBeGreaterThan(0)
          expect(finalData.data.massiveBooks.length).toBeLessThanOrEqual(1000)
        }
      } else {
        // 如果最終失敗，應該提供清楚的錯誤訊息和建議
        expect(degradationResult.errorMessage).toContain('配額')
        expect(degradationResult.userRecommendations).toBeDefined()
        expect(degradationResult.userRecommendations.length).toBeGreaterThan(0)
      }

      // 檢查系統穩定性
      const systemStability = await extensionController.checkSystemStabilityAfterQuotaIssue()
      expect(systemStability.stable).toBe(true)
      expect(systemStability.coreDataIntact).toBe(true)
      expect(systemStability.functionalityMaintained).toBe(true)
    })

    test('應該支援自動清理和空間回收機制', async () => {
      // Given: 建立包含舊資料的Storage狀態
      const oldBooks = testDataGenerator.generateBooks(300, 'old-data-test', {
        dateRange: {
          start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90天前
          end: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60天前
        }
      })

      const recentBooks = testDataGenerator.generateBooks(200, 'recent-data-test', {
        dateRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7天前
          end: new Date() // 現在
        }
      })

      // 儲存混合的新舊資料
      await extensionController.setChromeStorageData({
        books: [...oldBooks, ...recentBooks],
        metadata: {
          lastCleanup: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30天前清理
        }
      })

      // 記錄清理前狀態
      const preCleanupUsage = await extensionController.getChromeStorageUsage()

      // When: 觸發自動清理機制
      const cleanupResult = await extensionController.executeAutomaticCleanup({
        cleanupRules: {
          maxAge: 30 * 24 * 60 * 60 * 1000, // 保留30天內的資料
          maxItems: 1000, // 最多保留1000項
          preserveCriticalData: true, // 保留關鍵資料
          compressionThreshold: 0.8 // 80%使用率時啟動壓縮
        },
        cleanupStrategies: [
          'age_based_cleanup',
          'duplicate_removal',
          'unused_data_cleanup',
          'compression_optimization'
        ]
      })

      // Then: 驗證清理效果
      expect(cleanupResult.executed).toBe(true)
      expect(cleanupResult.strategies.length).toBeGreaterThan(0)

      // 檢查空間回收效果
      const postCleanupUsage = await extensionController.getChromeStorageUsage()
      const spaceReclaimed = preCleanupUsage.local.used - postCleanupUsage.local.used

      if (cleanupResult.strategies.includes('age_based_cleanup')) {
        expect(spaceReclaimed).toBeGreaterThan(0)
        expect(cleanupResult.ageBasedCleanup.itemsRemoved).toBeGreaterThan(0)

        // 驗證舊資料被清理
        const remainingData = await extensionController.getChromeStorageData(['books'])
        const remainingOldBooks = remainingData.data.books.filter(book =>
          book.extractedAt < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        )
        expect(remainingOldBooks.length).toBeLessThan(oldBooks.length)
      }

      if (cleanupResult.strategies.includes('duplicate_removal')) {
        expect(cleanupResult.duplicateRemoval.duplicatesFound).toBeGreaterThanOrEqual(0)
        if (cleanupResult.duplicateRemoval.duplicatesFound > 0) {
          expect(cleanupResult.duplicateRemoval.duplicatesRemoved).toBe(
            cleanupResult.duplicateRemoval.duplicatesFound
          )
        }
      }

      if (cleanupResult.strategies.includes('compression_optimization')) {
        expect(cleanupResult.compressionOptimization.applied).toBeDefined()
        if (cleanupResult.compressionOptimization.applied) {
          expect(cleanupResult.compressionOptimization.spaceSaved).toBeGreaterThan(0)
        }
      }

      // 驗證資料完整性
      const finalData = await extensionController.getChromeStorageData(['books', 'metadata'])
      expect(finalData.success).toBe(true)
      expect(finalData.data.books).toBeDefined()
      expect(finalData.data.books.length).toBeGreaterThan(0)

      // 確保重要資料未被誤刪
      const recentBooksRemaining = finalData.data.books.filter(book =>
        book.extractedAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      )
      expect(recentBooksRemaining.length).toBeCloseTo(recentBooks.length, 10) // 允許10本書的差異

      // 檢查清理元數據更新
      expect(finalData.data.metadata.lastCleanup).toBeDefined()
      const lastCleanupTime = new Date(finalData.data.metadata.lastCleanup)
      expect(lastCleanupTime.getTime()).toBeGreaterThan(Date.now() - 60000) // 1分鐘內
    })
  })

  describe('Storage API 錯誤處理和恢復', () => {
    test('應該處理Storage API的各種錯誤情況', async () => {
      // Given: 準備各種錯誤情境的測試
      const errorScenarios = [
        {
          name: 'QUOTA_EXCEEDED_ERR',
          setup: async () => {
            await quotaMonitor.simulateQuotaExceeded()
          },
          expectedHandling: 'quota_management_activation',
          recoverable: true
        },
        {
          name: 'STORAGE_UNAVAILABLE',
          setup: async () => {
            await storageValidator.simulateStorageUnavailable()
          },
          expectedHandling: 'fallback_storage_mechanism',
          recoverable: true
        },
        {
          name: 'DATA_CORRUPTION',
          setup: async () => {
            await storageValidator.simulateDataCorruption()
          },
          expectedHandling: 'data_validation_and_recovery',
          recoverable: true
        },
        {
          name: 'API_RATE_LIMITING',
          setup: async () => {
            await storageValidator.simulateRateLimiting()
          },
          expectedHandling: 'exponential_backoff_retry',
          recoverable: true
        }
      ]

      const errorHandlingResults = []
      const testBooks = testDataGenerator.generateBooks(100, 'error-handling-test')

      for (const scenario of errorScenarios) {
        // When: 設置錯誤條件並嘗試Storage操作
        await scenario.setup()

        const errorHandlingStart = Date.now()
        const operationResult = await extensionController.setChromeStorageData(
          { books: testBooks },
          {
            expectErrors: true,
            errorHandlingEnabled: true,
            maxRetries: 3,
            timeout: 10000
          }
        )
        const handlingTime = Date.now() - errorHandlingStart

        // 記錄錯誤處理結果
        errorHandlingResults.push({
          scenario: scenario.name,
          errorDetected: !operationResult.success,
          handlingStrategy: operationResult.errorHandling?.strategy,
          handlingTime,
          recovered: operationResult.recovered || operationResult.success,
          finalSuccess: operationResult.success
        })

        // 清理錯誤狀態
        await storageValidator.clearSimulatedErrors()
        await quotaMonitor.clearSimulation()
        await testSuite.waitForTimeout(500)
      }

      // Then: 驗證錯誤處理機制
      errorHandlingResults.forEach((result, index) => {
        const scenario = errorScenarios[index]

        // 檢查錯誤檢測
        if (scenario.recoverable) {
          expect(result.recovered || result.finalSuccess).toBe(true)
        }

        // 檢查處理策略
        expect(result.handlingStrategy).toBeDefined()
        expect(result.handlingTime).toBeLessThan(15000) // 處理時間<15秒

        // 驗證特定錯誤的處理方式
        switch (scenario.name) {
          case 'QUOTA_EXCEEDED_ERR':
            expect(result.handlingStrategy).toContain('quota')
            break
          case 'STORAGE_UNAVAILABLE':
            expect(result.handlingStrategy).toContain('fallback')
            break
          case 'DATA_CORRUPTION':
            expect(result.handlingStrategy).toContain('validation')
            break
          case 'API_RATE_LIMITING':
            expect(result.handlingStrategy).toContain('retry')
            break
        }
      })

      // 驗證最終系統狀態
      const finalSystemCheck = await extensionController.validateStorageSystemHealth()
      expect(finalSystemCheck.healthy).toBe(true)
      expect(finalSystemCheck.dataIntegrity).toBe('intact')
      expect(finalSystemCheck.functionalityAvailable).toBe(true)
    })

    test('應該支援Storage資料的備份和恢復機制', async () => {
      // Given: 建立需要備份的重要資料
      const criticalData = {
        books: testDataGenerator.generateBooks(150, 'backup-test'),
        userSettings: {
          exportFormat: 'json',
          theme: 'dark',
          autoBackup: true,
          backupInterval: 24 * 60 * 60 * 1000 // 24小時
        },
        metadata: {
          version: '0.9.34',
          lastBackup: null,
          backupCount: 0
        }
      }

      // 儲存初始資料
      await extensionController.setChromeStorageData(criticalData)

      // When: 執行自動備份
      const backupResult = await extensionController.executeStorageBackup({
        backupStrategy: 'incremental',
        compressionEnabled: true,
        encryptionEnabled: false, // 簡化測試
        retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7天
        backupLocation: 'chrome_storage_backup'
      })

      // Then: 驗證備份結果
      expect(backupResult.success).toBe(true)
      expect(backupResult.backupSize).toBeGreaterThan(0)
      expect(backupResult.backupId).toBeDefined()

      // 驗證備份完整性
      const backupValidation = await extensionController.validateBackup(backupResult.backupId)
      expect(backupValidation.valid).toBe(true)
      expect(backupValidation.dataIntegrity).toBe('intact')
      expect(backupValidation.itemCount).toBe(150) // 150本書籍

      // 模擬資料損壞或丟失
      await extensionController.simulateDataLoss({
        lossType: 'partial_corruption',
        affectedPercentage: 0.3 // 30%資料損壞
      })

      // 檢測資料損壞
      const corruptionDetection = await extensionController.detectDataCorruption()
      expect(corruptionDetection.detected).toBe(true)
      expect(corruptionDetection.severity).toBeGreaterThan(0.2)

      // When: 執行資料恢復
      const recoveryStart = Date.now()
      const recoveryResult = await extensionController.executeStorageRecovery({
        backupId: backupResult.backupId,
        recoveryStrategy: 'selective_restore', // 只恢復損壞的部分
        validateAfterRecovery: true,
        preserveRecentChanges: true
      })
      const recoveryTime = Date.now() - recoveryStart

      // Then: 驗證恢復效果
      expect(recoveryResult.success).toBe(true)
      expect(recoveryTime).toBeLessThan(10000) // 恢復時間<10秒

      // 檢查恢復統計
      expect(recoveryResult.itemsRecovered).toBeGreaterThan(0)
      expect(recoveryResult.dataIntegrityRestored).toBe(true)

      // 驗證最終資料完整性
      const postRecoveryData = await extensionController.getChromeStorageData([
        'books', 'userSettings', 'metadata'
      ])

      expect(postRecoveryData.success).toBe(true)
      expect(postRecoveryData.data.books).toHaveLength(150)
      expect(postRecoveryData.data.userSettings.exportFormat).toBe('json')
      expect(postRecoveryData.data.metadata.version).toBe('0.9.34')

      // 進行資料完整性深度驗證
      const integrityCheck = await storageValidator.performDeepIntegrityCheck(
        postRecoveryData.data,
        criticalData
      )

      expect(integrityCheck.overall).toBe('passed')
      expect(integrityCheck.corruptedItems).toBe(0)
      expect(integrityCheck.missingItems).toBe(0)
      expect(integrityCheck.integrityScore).toBeGreaterThan(0.98) // 98%以上完整性
    })
  })
})
