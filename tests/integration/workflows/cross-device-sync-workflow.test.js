/**
 * 跨設備同步工作流程整合測試
 *
 * 測試目標：
 * - 驗證資料匯出入功能的完整性和正確性
 * - 確保跨設備資料同步的一致性和可靠性
 * - 檢查衝突解決和錯誤處理機制
 */

const { E2ETestSuite } = require('../../helpers/e2e-test-suite')
const { ChromeExtensionController } = require('../../helpers/chrome-extension-controller')
const { TestDataGenerator } = require('../../helpers/test-data-generator')
const CrossDeviceSyncSimulator = require('../../helpers/cross-device-sync-simulator')

describe('跨設備同步工作流程整合測試', () => {
  let testSuite
  let extensionController
  let testDataGenerator
  let syncSimulator

  beforeAll(async () => {
    testSuite = new E2ETestSuite({
      headless: process.env.CI !== 'false',
      slowMo: 30,
      testDataSize: 'large' // 跨設備同步通常涉及較大資料集
    })

    await testSuite.setup()
    extensionController = testSuite.extensionController
    testDataGenerator = new TestDataGenerator()
    syncSimulator = new CrossDeviceSyncSimulator()
  })

  afterAll(async () => {
    await testSuite.cleanup()
    await syncSimulator.cleanup()
  })

  beforeEach(async () => {
    await testSuite.clearAllStorageData()
    await syncSimulator.reset()
  })

  describe('Given 設備A有書籍資料', () => {
    test('應該正確準備設備A的初始資料狀態', async () => {
      // Given: 在設備A建立豐富的書籍資料
      const deviceABooks = testDataGenerator.generateBooks(300, 'device-a')

      // 添加一些特殊情況的書籍
      const specialBooks = [
        testDataGenerator.generateSpecialBook('completed-book', { progress: 100 }),
        testDataGenerator.generateSpecialBook('new-book', { progress: 0 }),
        testDataGenerator.generateSpecialBook('half-read', { progress: 50 }),
        testDataGenerator.generateSpecialBook('unicode-title', { title: '測試書籍🔖📚' })
      ]

      const allDeviceABooks = [...deviceABooks, ...specialBooks]

      await testSuite.loadInitialData({
        books: allDeviceABooks,
        metadata: {
          deviceId: 'device-a',
          lastSync: new Date().toISOString(),
          version: '0.9.34'
        }
      })

      // When: 檢查資料載入狀態
      await extensionController.openPopup()
      const popupState = await extensionController.getPopupState()

      // Then: 驗證設備A資料正確載入
      expect(popupState.bookCount).toBe(304) // 300 + 4 特殊書籍
      expect(popupState.lastExtraction).toBeDefined()
      expect(popupState.exportButtonEnabled).toBe(true)

      // 驗證特殊書籍正確處理
      const storageData = await extensionController.getStorageData()
      const unicodeBook = storageData.books.find(book => book.title.includes('🔖'))
      expect(unicodeBook).toBeDefined()

      const completedBook = storageData.books.find(book => book.progress === 100)
      expect(completedBook).toBeDefined()
    })

    test('應該支援不同資料狀態的設備準備', async () => {
      // Given: 測試不同的設備資料情況
      const scenarios = [
        {
          name: 'heavy-reader-device',
          bookCount: 500,
          completedRatio: 0.3,
          averageProgress: 65
        },
        {
          name: 'light-reader-device',
          bookCount: 50,
          completedRatio: 0.1,
          averageProgress: 25
        },
        {
          name: 'new-device',
          bookCount: 5,
          completedRatio: 0,
          averageProgress: 10
        }
      ]

      for (const scenario of scenarios) {
        // When: 設定不同場景的資料
        const scenarioBooks = testDataGenerator.generateBooksWithProgress(
          scenario.bookCount,
          scenario.name,
          {
            completedRatio: scenario.completedRatio,
            averageProgress: scenario.averageProgress
          }
        )

        await testSuite.clearAllStorageData()
        await testSuite.loadInitialData({ books: scenarioBooks })

        // Then: 驗證不同場景資料正確載入
        const storageData = await extensionController.getStorageData()
        expect(storageData.books.length).toBe(scenario.bookCount)

        // 驗證進度分布符合預期
        const avgProgress = storageData.books.reduce((sum, book) =>
          sum + book.progress, 0) / storageData.books.length
        expect(avgProgress).toBeCloseTo(scenario.averageProgress, 5)

        const completedCount = storageData.books.filter(book => book.progress === 100).length
        const expectedCompleted = Math.floor(scenario.bookCount * scenario.completedRatio)
        expect(completedCount).toBeCloseTo(expectedCompleted, 2)
      }
    })
  })

  describe('When 設備A匯出資料 → 設備B匯入資料 → 驗證資料一致性', () => {
    test('應該成功執行完整的基本匯出入流程', async () => {
      // Given: 設備A準備完整資料
      const deviceABooks = testDataGenerator.generateBooks(200, 'basic-export-test')
      await testSuite.loadInitialData({ books: deviceABooks })

      await extensionController.openPopup()

      // When 步驟1: 設備A匯出資料
      const exportResult = await extensionController.clickExportButton()
      expect(exportResult.success).toBe(true)
      expect(exportResult.exportedFile).toBeDefined()

      // 驗證匯出檔案內容
      const exportedData = await testSuite.readExportedFile(exportResult.exportedFile)
      expect(exportedData.books.length).toBe(200)
      expect(exportedData.metadata).toBeDefined()
      expect(exportedData.metadata.exportedAt).toBeDefined()
      expect(exportedData.version).toBe('0.9.34')

      // When 步驟2: 模擬設備B環境
      await syncSimulator.switchToDeviceB()
      await testSuite.clearAllStorageData() // 清空模擬新設備

      // When 步驟3: 設備B匯入資料
      await extensionController.openPopup()
      const importResult = await extensionController.importDataFromFile(exportResult.exportedFile)

      expect(importResult.success).toBe(true)
      expect(importResult.importedCount).toBe(200)
      expect(importResult.conflicts.length).toBe(0) // 新設備無衝突

      // Then: 驗證設備B資料正確匯入
      const deviceBData = await extensionController.getStorageData()
      expect(deviceBData.books.length).toBe(200)

      // 驗證資料一致性
      const consistencyResult = await syncSimulator.compareDeviceData(deviceABooks, deviceBData.books)
      expect(consistencyResult.identicalCount).toBe(200)
      expect(consistencyResult.differences.length).toBe(0)
      expect(consistencyResult.missingInB.length).toBe(0)
      expect(consistencyResult.extraInB.length).toBe(0)
    })

    test('應該正確處理大量資料的匯出入效能', async () => {
      // Given: 大量書籍資料 (模擬重度使用者)
      const largeDataset = testDataGenerator.generateBooks(1500, 'large-export-test')
      await testSuite.loadInitialData({ books: largeDataset })

      // When: 執行大量資料匯出入並監控效能
      const performanceStart = Date.now()
      const startMemory = await testSuite.getMemoryUsage()

      await extensionController.openPopup()

      // 匯出階段效能監控
      const exportStart = Date.now()
      const exportResult = await extensionController.clickExportButton()
      const exportTime = Date.now() - exportStart

      expect(exportResult.success).toBe(true)
      expect(exportTime).toBeLessThan(15000) // 1500本書匯出<15秒

      // 驗證匯出檔案大小合理
      const fileSize = await testSuite.getFileSize(exportResult.exportedFile)
      expect(fileSize).toBeLessThan(20 * 1024 * 1024) // 檔案<20MB
      expect(fileSize).toBeGreaterThan(1024 * 1024) // 檔案>1MB (確保有資料)

      // 切換到設備B並匯入
      await syncSimulator.switchToDeviceB()
      await testSuite.clearAllStorageData()

      const importStart = Date.now()
      await extensionController.openPopup()
      const importResult = await extensionController.importDataFromFile(exportResult.exportedFile)
      const importTime = Date.now() - importStart

      const performanceEnd = Date.now()
      const endMemory = await testSuite.getMemoryUsage()

      // Then: 驗證大量資料處理效能
      expect(importResult.success).toBe(true)
      expect(importResult.importedCount).toBe(1500)
      expect(importTime).toBeLessThan(20000) // 匯入<20秒

      const totalTime = performanceEnd - performanceStart
      expect(totalTime).toBeLessThan(35000) // 總時間<35秒

      const memoryUsage = endMemory.used - startMemory.used
      expect(memoryUsage).toBeLessThan(100 * 1024 * 1024) // 記憶體增長<100MB

      // 驗證資料完整性
      const finalData = await extensionController.getStorageData()
      expect(finalData.books.length).toBe(1500)
    })

    test('應該正確處理增量同步情況', async () => {
      // Given: 設備A和設備B都有部分相同的資料
      const commonBooks = testDataGenerator.generateBooks(100, 'common-books')
      const deviceAOnlyBooks = testDataGenerator.generateBooks(150, 'device-a-only')
      const deviceBOnlyBooks = testDataGenerator.generateBooks(80, 'device-b-only')

      // 設備A資料: 共同書籍 + A獨有書籍
      const deviceABooks = [...commonBooks, ...deviceAOnlyBooks]
      await testSuite.loadInitialData({ books: deviceABooks })

      // 匯出設備A資料
      await extensionController.openPopup()
      const exportResult = await extensionController.clickExportButton()

      // 設定設備B初始資料: 共同書籍 + B獨有書籍
      await syncSimulator.switchToDeviceB()
      const deviceBInitialBooks = [...commonBooks, ...deviceBOnlyBooks]
      await testSuite.loadInitialData({ books: deviceBInitialBooks })

      // When: 設備B匯入設備A的資料 (合併模式)
      await extensionController.openPopup()
      const importResult = await extensionController.importDataFromFile(exportResult.exportedFile, {
        mode: 'merge' // 合併模式
      })

      // Then: 驗證增量同步結果
      expect(importResult.success).toBe(true)
      expect(importResult.importedCount).toBe(150) // 只匯入A獨有的150本
      expect(importResult.skippedCount).toBe(100) // 跳過100本共同書籍
      expect(importResult.conflicts.length).toBe(0)

      const mergedData = await extensionController.getStorageData()
      expect(mergedData.books.length).toBe(330) // 100共同 + 150A獨有 + 80B獨有

      // 驗證所有書籍都存在且沒有重複
      const bookIds = mergedData.books.map(book => book.id)
      const uniqueIds = [...new Set(bookIds)]
      expect(uniqueIds.length).toBe(bookIds.length) // 無重複ID

      // 驗證各類書籍都存在
      const commonBooksInResult = mergedData.books.filter(book =>
        book.id.includes('common-books'))
      const deviceAOnlyInResult = mergedData.books.filter(book =>
        book.id.includes('device-a-only'))
      const deviceBOnlyInResult = mergedData.books.filter(book =>
        book.id.includes('device-b-only'))

      expect(commonBooksInResult.length).toBe(100)
      expect(deviceAOnlyInResult.length).toBe(150)
      expect(deviceBOnlyInResult.length).toBe(80)
    })
  })

  describe('Then 兩設備的資料應該完全一致，無資料遺失', () => {
    test('應該實現完美的資料一致性', async () => {
      // Given: 複雜的真實場景資料
      const realWorldBooks = [
        ...testDataGenerator.generateBooks(200, 'novels'),
        ...testDataGenerator.generateBooks(50, 'technical-books'),
        ...testDataGenerator.generateBooks(30, 'academic-papers'),
        ...testDataGenerator.generateSpecialBooks([
          { title: '特殊字符書籍 & <tag>', progress: 45 },
          { title: 'English Book', progress: 80 },
          { title: '很長很長很長很長很長很長的書籍標題名稱測試', progress: 15 },
          { title: '數字123和符號!@#', progress: 90 }
        ])
      ]

      await testSuite.loadInitialData({ books: realWorldBooks })

      // When: 執行完整的跨設備同步
      await extensionController.openPopup()

      // 記錄原始資料的詳細資訊
      const originalData = await extensionController.getStorageData()
      const originalDigest = await syncSimulator.calculateDataDigest(originalData.books)

      // 匯出
      const exportResult = await extensionController.clickExportButton()

      // 切換到空白設備B
      await syncSimulator.switchToDeviceB()
      await testSuite.clearAllStorageData()

      // 匯入
      await extensionController.openPopup()
      const importResult = await extensionController.importDataFromFile(exportResult.exportedFile)

      // Then: 驗證完美一致性
      expect(importResult.success).toBe(true)
      expect(importResult.importedCount).toBe(284) // 200+50+30+4

      const syncedData = await extensionController.getStorageData()
      const syncedDigest = await syncSimulator.calculateDataDigest(syncedData.books)

      // 資料摘要完全一致
      expect(syncedDigest.bookCount).toBe(originalDigest.bookCount)
      expect(syncedDigest.totalProgress).toBe(originalDigest.totalProgress)
      expect(syncedDigest.uniqueTitles).toBe(originalDigest.uniqueTitles)
      expect(syncedDigest.dataHash).toBe(originalDigest.dataHash)

      // 逐一驗證每本書籍
      for (const originalBook of originalData.books) {
        const syncedBook = syncedData.books.find(book => book.id === originalBook.id)

        expect(syncedBook).toBeDefined()
        expect(syncedBook.title).toBe(originalBook.title)
        expect(syncedBook.author).toBe(originalBook.author)
        expect(syncedBook.progress).toBe(originalBook.progress)
        expect(syncedBook.extractedAt).toBe(originalBook.extractedAt)
      }

      // 驗證特殊字符處理正確
      const specialCharBook = syncedData.books.find(book =>
        book.title.includes('特殊字符'))
      expect(specialCharBook).toBeDefined()
      expect(specialCharBook.title).toBe('特殊字符書籍 & <tag>')
    })

    test('應該正確處理衝突解決並保證資料完整性', async () => {
      // Given: 兩個設備有相同書籍但不同進度的衝突情況
      const conflictingBooks = [
        {
          id: 'conflict-book-001',
          title: '衝突測試書籍A',
          progress: 30,
          lastModified: '2025-08-24T10:00:00Z'
        },
        {
          id: 'conflict-book-002',
          title: '衝突測試書籍B',
          progress: 60,
          lastModified: '2025-08-24T11:00:00Z'
        }
      ]

      const nonConflictingBooks = testDataGenerator.generateBooks(50, 'no-conflict')

      // 設備A: 較舊的進度
      const deviceAData = [
        { ...conflictingBooks[0], progress: 30, lastModified: '2025-08-24T10:00:00Z' },
        { ...conflictingBooks[1], progress: 60, lastModified: '2025-08-24T11:00:00Z' },
        ...nonConflictingBooks
      ]

      await testSuite.loadInitialData({ books: deviceAData })

      // 匯出設備A資料
      await extensionController.openPopup()
      const exportResult = await extensionController.clickExportButton()

      // 設備B: 較新的進度
      const deviceBData = [
        { ...conflictingBooks[0], progress: 55, lastModified: '2025-08-24T14:00:00Z' },
        { ...conflictingBooks[1], progress: 85, lastModified: '2025-08-24T15:00:00Z' },
        ...nonConflictingBooks.slice(0, 30) // 只有部分相同書籍
      ]

      await syncSimulator.switchToDeviceB()
      await testSuite.loadInitialData({ books: deviceBData })

      // When: 設備B匯入設備A資料，觸發衝突解決
      await extensionController.openPopup()
      const importResult = await extensionController.importDataFromFile(exportResult.exportedFile, {
        conflictResolution: 'keep-newer' // 保留較新版本
      })

      // Then: 驗證衝突解決正確性
      expect(importResult.success).toBe(true)
      expect(importResult.conflicts.length).toBe(2) // 2本衝突書籍
      expect(importResult.conflictsResolved).toBe(2)

      const finalData = await extensionController.getStorageData()

      // 驗證衝突書籍採用較新版本
      const resolvedBook1 = finalData.books.find(book => book.id === 'conflict-book-001')
      expect(resolvedBook1.progress).toBe(55) // 設備B的較新進度
      expect(resolvedBook1.lastModified).toBe('2025-08-24T14:00:00Z')

      const resolvedBook2 = finalData.books.find(book => book.id === 'conflict-book-002')
      expect(resolvedBook2.progress).toBe(85) // 設備B的較新進度
      expect(resolvedBook2.lastModified).toBe('2025-08-24T15:00:00Z')

      // 驗證總資料完整性
      expect(finalData.books.length).toBe(72) // 2衝突 + 30重疊 + 20設備A獨有 + 20設備B獨有

      // 驗證無資料遺失 - 所有非衝突書籍都應存在
      const nonConflictCount = finalData.books.filter(book =>
        book.id.includes('no-conflict')).length
      expect(nonConflictCount).toBe(50) // 所有非衝突書籍都保留
    })

    test('應該支援多輪同步並維持資料一致性', async () => {
      // Given: 模擬多次同步的真實使用場景
      const rounds = 3
      const initialBooks = testDataGenerator.generateBooks(100, 'multi-sync-base')

      await testSuite.loadInitialData({ books: initialBooks })

      for (let round = 1; round <= rounds; round++) {
        // 當前輪次添加的新書籍
        const newBooksThisRound = testDataGenerator.generateBooks(20, `round-${round}`)

        // When: 執行這一輪的同步

        // 1. 在當前設備添加新書籍 (模擬新提取的書籍)
        const currentData = await extensionController.getStorageData()
        const updatedData = [...currentData.books, ...newBooksThisRound]
        await testSuite.loadInitialData({ books: updatedData })

        // 2. 匯出當前資料
        await extensionController.openPopup()
        const exportResult = await extensionController.clickExportButton()

        // 3. 切換到另一設備並匯入
        await syncSimulator.switchToAlternateDevice()
        await extensionController.openPopup()
        const importResult = await extensionController.importDataFromFile(exportResult.exportedFile, {
          mode: 'merge'
        })

        // Then: 驗證這一輪同步的正確性
        expect(importResult.success).toBe(true)

        const syncedData = await extensionController.getStorageData()
        const expectedCount = 100 + (round * 20) // 初始100 + 每輪20
        expect(syncedData.books.length).toBe(expectedCount)

        // 驗證這一輪的新書籍都存在
        const thisRoundBooks = syncedData.books.filter(book =>
          book.id.includes(`round-${round}`))
        expect(thisRoundBooks.length).toBe(20)

        console.log(`✓ Round ${round}: ${syncedData.books.length} books synced`)
      }

      // 最終驗證：所有輪次的資料都完整保存
      const finalData = await extensionController.getStorageData()
      expect(finalData.books.length).toBe(160) // 100 + 3*20

      // 驗證各輪次書籍都存在
      for (let round = 1; round <= rounds; round++) {
        const roundBooks = finalData.books.filter(book =>
          book.id.includes(`round-${round}`))
        expect(roundBooks.length).toBe(20)
      }

      // 驗證基礎書籍仍然存在
      const baseBooks = finalData.books.filter(book =>
        book.id.includes('multi-sync-base'))
      expect(baseBooks.length).toBe(100)
    })
  })

  describe('錯誤處理和異常情況', () => {
    test('應該處理匯出檔案損壞的情況', async () => {
      // Given: 準備測試資料
      const testBooks = testDataGenerator.generateBooks(50, 'corruption-test')
      await testSuite.loadInitialData({ books: testBooks })

      await extensionController.openPopup()
      const exportResult = await extensionController.clickExportButton()

      // When: 模擬各種檔案損壞情況
      const corruptionScenarios = [
        {
          name: 'invalid-json',
          corruptFile: async (filePath) => {
            return testSuite.corruptFile(filePath, 'invalid-json')
          },
          expectedError: 'JSON 格式錯誤'
        },
        {
          name: 'truncated-file',
          corruptFile: async (filePath) => {
            return testSuite.corruptFile(filePath, 'truncate', { percentage: 0.5 })
          },
          expectedError: '檔案不完整'
        },
        {
          name: 'missing-metadata',
          corruptFile: async (filePath) => {
            return testSuite.corruptFile(filePath, 'remove-metadata')
          },
          expectedError: '檔案格式不正確'
        }
      ]

      for (const scenario of corruptionScenarios) {
        // 切換到新設備
        await syncSimulator.switchToDeviceB()
        await testSuite.clearAllStorageData()

        // 損壞檔案
        const corruptedFile = await scenario.corruptFile(exportResult.exportedFile)

        // Then: 嘗試匯入損壞檔案
        await extensionController.openPopup()
        const importResult = await extensionController.importDataFromFile(corruptedFile)

        expect(importResult.success).toBe(false)
        expect(importResult.errorMessage).toContain(scenario.expectedError)
        expect(importResult.importedCount).toBe(0)

        // 驗證損壞匯入不影響現有資料
        const storageData = await extensionController.getStorageData()
        expect(storageData.books.length).toBe(0) // 空設備應該保持空白

        console.log(`✓ ${scenario.name}: Correctly handled corruption`)
      }
    })

    test('應該處理匯入過程中的中斷情況', async () => {
      // Given: 準備大量資料用於中斷測試
      const largeDataset = testDataGenerator.generateBooks(500, 'interruption-test')
      await testSuite.loadInitialData({ books: largeDataset })

      await extensionController.openPopup()
      const exportResult = await extensionController.clickExportButton()

      // When: 在匯入過程中模擬中斷
      await syncSimulator.switchToDeviceB()
      await testSuite.clearAllStorageData()

      await extensionController.openPopup()

      // 開始匯入
      const importPromise = extensionController.importDataFromFile(exportResult.exportedFile)

      // 等待部分進度後中斷
      await testSuite.waitForTimeout(2000)
      await testSuite.simulateProcessInterruption() // 模擬瀏覽器崩潰等

      // Then: 驗證中斷處理
      const interruptionResult = await importPromise.catch(error => ({
        success: false,
        error: error.message
      }))

      expect(interruptionResult.success).toBe(false)
      expect(interruptionResult.error).toBeDefined()

      // 驗證中斷後的資料狀態安全
      const storageData = await extensionController.getStorageData()

      // 應該是部分匯入狀態，但資料結構完整
      const importedBooks = storageData.books || []
      importedBooks.forEach(book => {
        expect(book.id).toBeDefined()
        expect(book.title).toBeDefined()
        expect(typeof book.progress).toBe('number')
      })

      // 重啟後應該可以重新匯入
      await testSuite.restoreFromInterruption()
      const retryImportResult = await extensionController.importDataFromFile(
        exportResult.exportedFile, { mode: 'overwrite' }
      )

      expect(retryImportResult.success).toBe(true)
      expect(retryImportResult.importedCount).toBe(500)
    })

    test('應該處理版本不相容的檔案', async () => {
      // Given: 準備不同版本格式的測試檔案
      const currentBooks = testDataGenerator.generateBooks(30, 'version-test')
      const versionScenarios = [
        {
          version: '0.9.0', // 舊版本
          format: 'legacy',
          expectedResult: 'success-with-migration'
        },
        {
          version: '1.0.0', // 未來版本
          format: 'future',
          expectedResult: 'version-too-new-error'
        },
        {
          version: 'invalid', // 無效版本
          format: 'corrupted',
          expectedResult: 'format-error'
        }
      ]

      for (const scenario of versionScenarios) {
        // When: 建立特定版本的匯出檔案
        const versionedFile = await testSuite.createVersionedExportFile(
          currentBooks,
          scenario.version,
          scenario.format
        )

        await syncSimulator.switchToDeviceB()
        await testSuite.clearAllStorageData()

        // 嘗試匯入版本化檔案
        await extensionController.openPopup()
        const importResult = await extensionController.importDataFromFile(versionedFile)

        // Then: 驗證版本相容性處理
        switch (scenario.expectedResult) {
          case 'success-with-migration':
            expect(importResult.success).toBe(true)
            expect(importResult.migrationPerformed).toBe(true)
            expect(importResult.importedCount).toBe(30)
            expect(importResult.warnings).toContain('版本升級')
            break

          case 'version-too-new-error':
            expect(importResult.success).toBe(false)
            expect(importResult.errorMessage).toContain('版本過新')
            expect(importResult.suggestedAction).toContain('更新Extension')
            break

          case 'format-error':
            expect(importResult.success).toBe(false)
            expect(importResult.errorMessage).toContain('格式不支援')
            break
        }

        console.log(`✓ Version ${scenario.version}: ${scenario.expectedResult}`)
      }
    })
  })

  describe('使用者體驗和介面互動', () => {
    test('應該提供清楚的同步進度和狀態回饋', async () => {
      // Given: 準備中型資料集測試進度顯示
      const testBooks = testDataGenerator.generateBooks(200, 'progress-test')
      await testSuite.loadInitialData({ books: testBooks })

      await extensionController.openPopup()

      // When: 執行匯出並監控進度回饋
      const exportProgressUpdates = []
      const exportProgressSubscription = await extensionController.subscribeToExportProgress((progress) => {
        exportProgressUpdates.push({
          ...progress,
          timestamp: Date.now()
        })
      })

      const exportResult = await extensionController.clickExportButton()
      exportProgressSubscription.unsubscribe()

      // 切換設備並監控匯入進度
      await syncSimulator.switchToDeviceB()
      await testSuite.clearAllStorageData()

      const importProgressUpdates = []
      const importProgressSubscription = await extensionController.subscribeToImportProgress((progress) => {
        importProgressUpdates.push({
          ...progress,
          timestamp: Date.now()
        })
      })

      await extensionController.openPopup()
      const importResult = await extensionController.importDataFromFile(exportResult.exportedFile)
      importProgressSubscription.unsubscribe()

      // Then: 驗證進度回饋品質

      // 匯出進度檢查
      expect(exportProgressUpdates.length).toBeGreaterThan(2) // 至少開始、進行、完成
      expect(exportProgressUpdates[0].stage).toBe('preparing')
      expect(exportProgressUpdates[exportProgressUpdates.length - 1].stage).toBe('completed')

      // 匯入進度檢查
      expect(importProgressUpdates.length).toBeGreaterThan(3) // 驗證、處理、儲存、完成
      const stages = importProgressUpdates.map(update => update.stage)
      expect(stages).toContain('validating')
      expect(stages).toContain('processing')
      expect(stages).toContain('saving')
      expect(stages).toContain('completed')

      // 進度時間間隔檢查
      const importIntervals = []
      for (let i = 1; i < importProgressUpdates.length; i++) {
        importIntervals.push(importProgressUpdates[i].timestamp - importProgressUpdates[i - 1].timestamp)
      }
      const avgInterval = importIntervals.reduce((sum, interval) => sum + interval, 0) / importIntervals.length
      expect(avgInterval).toBeLessThan(2000) // 平均更新間隔<2秒
    })

    test('應該提供直觀的衝突解決介面', async () => {
      // Given: 準備衝突場景
      const conflictBooks = [
        {
          id: 'ui-conflict-001',
          title: '使用者介面衝突測試書籍',
          author: '測試作者',
          progress: 40,
          lastModified: '2025-08-24T10:00:00Z'
        }
      ]

      // 設備A版本
      await testSuite.loadInitialData({ books: conflictBooks })
      await extensionController.openPopup()
      const exportResult = await extensionController.clickExportButton()

      // 設備B版本 (不同進度)
      const deviceBVersion = [{
        ...conflictBooks[0],
        progress: 70,
        lastModified: '2025-08-24T14:00:00Z'
      }]

      await syncSimulator.switchToDeviceB()
      await testSuite.loadInitialData({ books: deviceBVersion })

      // When: 匯入並觸發衝突解決UI
      await extensionController.openPopup()
      const conflictUIPromise = extensionController.expectConflictResolutionUI()

      const importPromise = extensionController.importDataFromFile(exportResult.exportedFile, {
        conflictResolution: 'ask-user' // 讓使用者選擇
      })

      // 驗證衝突解決介面
      const conflictUI = await conflictUIPromise

      expect(conflictUI.displayed).toBe(true)
      expect(conflictUI.conflictCount).toBe(1)
      expect(conflictUI.conflictDetails).toBeDefined()

      const conflictDetail = conflictUI.conflictDetails[0]
      expect(conflictDetail.bookTitle).toBe('使用者介面衝突測試書籍')
      expect(conflictDetail.currentVersion.progress).toBe(70)
      expect(conflictDetail.incomingVersion.progress).toBe(40)
      expect(conflictDetail.recommendedAction).toBe('keep-current') // 建議保留較新版本

      // 模擬使用者選擇
      await extensionController.resolveConflict(conflictDetail.id, 'keep-current')

      const importResult = await importPromise

      // Then: 驗證衝突解決結果
      expect(importResult.success).toBe(true)
      expect(importResult.userChoices).toBeDefined()
      expect(importResult.userChoices[0].choice).toBe('keep-current')

      const finalData = await extensionController.getStorageData()
      const resolvedBook = finalData.books.find(book => book.id === 'ui-conflict-001')
      expect(resolvedBook.progress).toBe(70) // 使用者選擇的版本
    })
  })
})
