/**
 * UC-05 跨設備同步工作流程測試
 *
 * 測試目標：驗證完整的跨設備同步使用者工作流程
 * 測試範圍：從設備A匯出到設備B匯入的完整端到端流程
 *
 * 測試架構：
 * - 45個測試案例，涵蓋5大類別同步場景
 * - Mock Chrome Extension APIs
 * - 模擬多設備環境和網路狀況
 * - 效能基準測試和錯誤處理驗證
 *
 * 注意：所有測試初始狀態為失敗（TDD 紅燈階段）
 * 等待 TDD Phase 3 實作對應的同步功能
 */

const path = require('path')

// 導入測試工具和模擬
const {
  createSyncTestEnvironment,
  resetSyncTestEnvironment,
  generateTestBooks,
  createCorruptedData,
  simulateNetworkConditions,
  measurePerformance,
  validateDataIntegrity,
  setupDevice,
  executeFullSync,
  executeSmartMergeSync,
  executeBidirectionalSync,
  executeBatchSync,
  executeTrackedSync,
  getSyncHistory,
  executeUserWorkflow,
  calculateDataChecksum,
  createDataSnapshot,
  compareDataSnapshots,
  createExportData,
  validateSampleIntegrity,
  checkDataRaceConditions,
  detectSyncConflicts,
  setupConflictResolver,
  checkVersionCompatibility,
  calculateUpgradePath,
  validateDataPropagation
} = require('../../mocks/cross-device-sync.mock')

// 導入Chrome API模擬
const chromeMock = require('../../mocks/chrome-api.mock')

// 設定測試環境
beforeAll(async () => {
  global.chrome = chromeMock
  await createSyncTestEnvironment()
})

afterEach(async () => {
  // 清理測試環境，確保測試隔離
  await chromeMock.flush()
  await resetSyncTestEnvironment()
})

describe('UC-05 跨設備同步工作流程測試', () => {
  describe('A. 完整同步流程測試 (8個案例)', () => {
    test('1. 基本同步流程驗證', async () => {
      // Given: 設備A有50本書籍資料
      const deviceA = await setupDevice('device-a')
      const testBooks = generateTestBooks(50)
      await deviceA.storage.setBooks(testBooks)

      const deviceB = await setupDevice('device-b') // 空白設備

      // When: 執行完整同步到設備B
      const syncResult = await executeFullSync(deviceA, deviceB)

      // Then: 設備B應有50本相同書籍，資料完整性100%
      expect(syncResult.success).toBe(true)
      expect(syncResult.bookCount.after).toBe(50)
      expect(syncResult.dataIntegrity.verified).toBe(true)

      const deviceBBooks = await deviceB.storage.getBooks()
      expect(deviceBBooks).toHaveLength(50)
      expect(validateDataIntegrity(testBooks, deviceBBooks)).toBe(100) // 100%一致性
    })

    test('2. 初次設備同步', async () => {
      // Given: 新設備（空白狀態）
      const newDevice = await setupDevice('new-device', { empty: true })
      const mainDevice = await setupDevice('main-device')

      const completeLibrary = generateTestBooks(100)
      await mainDevice.storage.setBooks(completeLibrary)

      // When: 從主設備匯入完整書庫備份
      const backupResult = await mainDevice.exportFullBackup()
      expect(backupResult.success).toBe(true)

      const importResult = await newDevice.importBackup(backupResult.file)

      // Then: 新設備資料狀態與主設備完全一致
      expect(importResult.success).toBe(true)

      const newDeviceBooks = await newDevice.storage.getBooks()
      const mainDeviceBooks = await mainDevice.storage.getBooks()

      expect(newDeviceBooks).toEqual(mainDeviceBooks)
      expect(validateDataIntegrity(mainDeviceBooks, newDeviceBooks)).toBe(100)
    })

    test('3. 增量資料同步', async () => {
      // Given: 設備A有100本書，設備B有90本書（部分重疊）
      const deviceA = await setupDevice('device-a')
      const deviceB = await setupDevice('device-b')

      const booksA = generateTestBooks(100)
      const booksB = [...generateTestBooks(80), ...generateTestBooks(10, 'unique-b')]

      await deviceA.storage.setBooks(booksA)
      await deviceB.storage.setBooks(booksB)

      // When: 執行智慧合併同步
      const mergeResult = await executeSmartMergeSync(deviceA, deviceB)

      // Then: 合併後應有110本書，無重複，進度取最新
      expect(mergeResult.success).toBe(true)
      expect(mergeResult.bookCount.after).toBe(110) // 100 + 10 新書
      expect(mergeResult.duplicatesSkipped).toBeGreaterThan(0)

      const mergedBooks = await deviceB.storage.getBooks()
      expect(mergedBooks).toHaveLength(110)

      // 驗證進度取最新邏輯
      const progressUpdates = mergeResult.progressUpdates
      expect(progressUpdates.length).toBeGreaterThan(0)
    })

    test('4. 雙向同步處理', async () => {
      // Given: 兩設備都有新增書籍和進度更新
      const deviceA = await setupDevice('device-a')
      const deviceB = await setupDevice('device-b')

      // 共同書籍，但進度不同
      const commonBooks = generateTestBooks(50)
      const deviceABooks = [...commonBooks, ...generateTestBooks(20, 'device-a-unique')]
      const deviceBBooks = [...commonBooks.map(book => ({ ...book, progress: book.progress + 20 })),
        ...generateTestBooks(15, 'device-b-unique')]

      await deviceA.storage.setBooks(deviceABooks)
      await deviceB.storage.setBooks(deviceBBooks)

      // When: 執行雙向同步
      const bidirectionalResult = await executeBidirectionalSync(deviceA, deviceB)

      // Then: 兩設備最終資料一致，衝突正確解決
      expect(bidirectionalResult.success).toBe(true)
      expect(bidirectionalResult.conflictsResolved).toBeGreaterThan(0)

      const finalDeviceABooks = await deviceA.storage.getBooks()
      const finalDeviceBBooks = await deviceB.storage.getBooks()

      expect(finalDeviceABooks).toEqual(finalDeviceBBooks)
      expect(finalDeviceABooks).toHaveLength(85) // 50 + 20 + 15
    })

    test('5. 批次匯出匯入', async () => {
      // Given: 1000本書籍的大型書庫
      const sourceDevice = await setupDevice('source-device')
      const targetDevice = await setupDevice('target-device')

      const largeBooksCollection = generateTestBooks(1000)
      await sourceDevice.storage.setBooks(largeBooksCollection)

      // When: 執行批次同步
      const startTime = Date.now()
      const batchSyncResult = await executeBatchSync(sourceDevice, targetDevice)
      const duration = Date.now() - startTime

      // Then: 同步時間<3分鐘，記憶體使用<200MB
      expect(batchSyncResult.success).toBe(true)
      expect(duration).toBeLessThan(3 * 60 * 1000) // 3分鐘 = 180,000ms
      expect(batchSyncResult.memoryUsage).toBeLessThan(200 * 1024 * 1024) // 200MB

      const targetBooks = await targetDevice.storage.getBooks()
      expect(targetBooks).toHaveLength(1000)
      expect(validateDataIntegrity(largeBooksCollection, targetBooks)).toBe(100)
    })

    test('6. 同步狀態追蹤', async () => {
      // Given: 同步過程中的各階段
      const deviceA = await setupDevice('device-a')
      const deviceB = await setupDevice('device-b')

      await deviceA.storage.setBooks(generateTestBooks(100))

      const stateTracker = new SyncStateTracker()

      // When: 監控同步狀態變化
      const syncPromise = executeTrackedSync(deviceA, deviceB, stateTracker)

      // Then: 狀態轉換正確，進度指示準確
      const expectedStates = [
        'IDLE', 'PREPARING', 'EXPORTING', 'TRANSFERRING',
        'IMPORTING', 'VERIFYING', 'COMPLETED'
      ]

      let stateIndex = 0
      stateTracker.on('stateChange', (state) => {
        expect(state).toBe(expectedStates[stateIndex])
        stateIndex++
      })

      const result = await syncPromise
      expect(result.success).toBe(true)
      expect(stateIndex).toBe(expectedStates.length)

      // 驗證進度指示準確性
      const progressEvents = stateTracker.getProgressHistory()
      expect(progressEvents.length).toBeGreaterThan(5)
      expect(progressEvents[progressEvents.length - 1].progress).toBe(100)
    })

    test('7. 同步歷史記錄', async () => {
      // Given: 多次同步操作
      const deviceA = await setupDevice('device-a')
      const deviceB = await setupDevice('device-b')

      await deviceA.storage.setBooks(generateTestBooks(50))

      // When: 執行多次同步並查看歷史
      const sync1 = await executeFullSync(deviceA, deviceB)
      await wait(100) // 確保時間戳不同

      await deviceA.storage.addBooks(generateTestBooks(25, 'batch2'))
      const sync2 = await executeFullSync(deviceA, deviceB)

      const syncHistory = await getSyncHistory(deviceB)

      // Then: 歷史記錄完整，包含時間戳、設備資訊、變更統計
      expect(syncHistory).toHaveLength(2)

      const [firstSync, secondSync] = syncHistory
      expect(firstSync.bookCount.added).toBe(50)
      expect(firstSync.sourceDevice).toBe('device-a')
      expect(firstSync.timestamp).toBeDefined()

      expect(secondSync.bookCount.added).toBe(25)
      expect(secondSync.bookCount.updated).toBe(50)

      // 驗證時間戳順序
      expect(new Date(secondSync.timestamp) > new Date(firstSync.timestamp)).toBe(true)
    })

    test('8. 使用者流程完整驗證', async () => {
      // Given: 典型使用者操作流程
      const officeDevice = await setupDevice('office-computer', {
        os: 'Windows 10',
        books: generateTestBooks(75)
      })
      const homeDevice = await setupDevice('home-computer', {
        os: 'macOS 12',
        books: generateTestBooks(60) // 部分重疊書籍
      })

      // When: 執行"辦公室→家用電腦"同步場景
      const userFlowResult = await executeUserWorkflow({
        source: officeDevice,
        target: homeDevice,
        scenario: 'office-to-home-evening-sync'
      })

      // Then: 流程順暢，錯誤處理友善，結果透明
      expect(userFlowResult.success).toBe(true)
      expect(userFlowResult.userExperience.flowSmoothness).toBeGreaterThan(0.9) // 90%+
      expect(userFlowResult.userExperience.errorFriendliness).toBeGreaterThan(0.9)
      expect(userFlowResult.userExperience.resultTransparency).toBeGreaterThan(0.9)

      // 驗證最終狀態
      const homeBooks = await homeDevice.storage.getBooks()
      expect(homeBooks.length).toBeGreaterThan(75) // 至少包含所有辦公室書籍

      // 驗證使用者反饋
      const userFeedback = userFlowResult.feedback
      expect(userFeedback.progressUpdates).toHaveLength.greaterThan(5)
      expect(userFeedback.completionMessage).toContain('成功同步')
      expect(userFeedback.summary.added).toBeGreaterThan(0)
    })
  })

  describe('B. 資料完整性驗證測試 (10個案例)', () => {
    test('9. 資料匯出完整性檢查', async () => {
      // Given: Chrome Storage中的完整書籍資料
      const device = await setupDevice('test-device')
      const originalBooks = generateTestBooks(100, 'comprehensive')
      await device.storage.setBooks(originalBooks)

      // When: 執行資料匯出
      const exportResult = await device.exportFullData()

      // Then: 匯出JSON包含所有必要欄位，checksum正確
      expect(exportResult.success).toBe(true)
      expect(exportResult.data).toBeDefined()
      expect(exportResult.metadata.bookCount).toBe(100)
      expect(exportResult.metadata.checksum).toBeDefined()

      // 驗證必要欄位完整性
      const exportedBooks = exportResult.data.books
      exportedBooks.forEach(book => {
        expect(book).toHaveProperty('id')
        expect(book).toHaveProperty('title')
        expect(book).toHaveProperty('progress')
        expect(book).toHaveProperty('extractedAt')
      })

      // 驗證checksum正確性
      const calculatedChecksum = await calculateDataChecksum(exportedBooks)
      expect(exportResult.metadata.checksum).toBe(calculatedChecksum)
    })

    test('10. 資料匯入驗證機制', async () => {
      // Given: 有效的書籍備份JSON檔案
      const sourceDevice = await setupDevice('source')
      const targetDevice = await setupDevice('target')

      const testBooks = generateTestBooks(75)
      await sourceDevice.storage.setBooks(testBooks)

      const exportFile = await sourceDevice.exportToFile()

      // When: 執行資料匯入驗證
      const validationResult = await targetDevice.validateImportFile(exportFile)

      // Then: 驗證通過，無格式錯誤，無資料遺失
      expect(validationResult.isValid).toBe(true)
      expect(validationResult.errors).toHaveLength(0)
      expect(validationResult.warnings).toHaveLength(0)
      expect(validationResult.bookCount).toBe(75)

      // 執行實際匯入
      const importResult = await targetDevice.importFromFile(exportFile)
      expect(importResult.success).toBe(true)

      const importedBooks = await targetDevice.storage.getBooks()
      expect(importedBooks).toHaveLength(75)
      expect(validateDataIntegrity(testBooks, importedBooks)).toBe(100)
    })

    test('11. 書籍ID一致性驗證', async () => {
      // Given: 匯入包含重複ID的書籍資料
      const device = await setupDevice('test-device')
      const originalBooks = generateTestBooks(50)
      await device.storage.setBooks(originalBooks)

      // 建立包含重複ID的匯入資料
      const duplicateBooks = [
        ...generateTestBooks(25, 'new-books'),
        ...originalBooks.slice(0, 10).map(book => ({
          ...book,
          title: book.title + ' (更新版)',
          progress: book.progress + 20,
          extractedAt: new Date().toISOString()
        }))
      ]

      // When: 執行ID一致性檢查
      const consistencyResult = await device.checkIDConsistency(duplicateBooks)

      // Then: 正確識別重複，保留最新資料，統計報告準確
      expect(consistencyResult.duplicatesFound).toBe(10)
      expect(consistencyResult.resolution.strategy).toBe('keep_latest')
      expect(consistencyResult.summary.kept).toBe(10)
      expect(consistencyResult.summary.replaced).toBe(10)

      // 執行合併匯入
      const mergeResult = await device.importWithMerge(duplicateBooks)
      expect(mergeResult.success).toBe(true)
      expect(mergeResult.bookCount.final).toBe(65) // 50 + 25 - 10 replaced

      const finalBooks = await device.storage.getBooks()
      expect(finalBooks).toHaveLength(65)

      // 驗證重複書籍使用最新資料
      const updatedBook = finalBooks.find(book => originalBooks.some(orig => orig.id === book.id))
      if (updatedBook) {
        expect(updatedBook.title).toContain('(更新版)')
      }
    })

    test('12. 資料格式驗證', async () => {
      // Given: 各種格式的書籍資料（正常、異常、邊界）
      const device = await setupDevice('validator-device')

      const testDataSets = {
        valid: generateTestBooks(20, 'valid'),
        missingFields: generateTestBooks(10, 'invalid').map(book => {
          delete book.id; return book // 缺少必要欄位
        }),
        invalidProgress: generateTestBooks(5).map(book => ({
          ...book, progress: -10 // 無效進度值
        })),
        invalidDate: generateTestBooks(5).map(book => ({
          ...book, extractedAt: 'invalid-date'
        })),
        specialChars: generateTestBooks(10, 'special').map(book => ({
          ...book, title: `${book.title} 📚🔥💯`
        }))
      }

      // When: 執行資料格式驗證
      for (const [dataType, testData] of Object.entries(testDataSets)) {
        const validationResult = await device.validateDataFormat(testData)

        // Then: 正確識別無效資料，提供具體錯誤訊息
        if (dataType === 'valid' || dataType === 'specialChars') {
          expect(validationResult.isValid).toBe(true)
          expect(validationResult.errors).toHaveLength(0)
        } else {
          expect(validationResult.isValid).toBe(false)
          expect(validationResult.errors.length).toBeGreaterThan(0)
          expect(validationResult.errors[0].message).toBeDefined()
          expect(validationResult.errors[0].suggestion).toBeDefined()
        }
      }
    })

    test('13. 同步前後資料比對', async () => {
      // Given: 同步前的原始資料狀態
      const sourceDevice = await setupDevice('source')
      const targetDevice = await setupDevice('target')

      const originalSourceBooks = generateTestBooks(80)
      const originalTargetBooks = generateTestBooks(60)

      await sourceDevice.storage.setBooks(originalSourceBooks)
      await targetDevice.storage.setBooks(originalTargetBooks)

      // 記錄同步前狀態
      const preSyncSnapshot = await createDataSnapshot({
        source: originalSourceBooks,
        target: originalTargetBooks
      })

      // When: 同步完成後比對資料
      const syncResult = await executeFullSync(sourceDevice, targetDevice)

      const postSyncSnapshot = await createDataSnapshot({
        source: await sourceDevice.storage.getBooks(),
        target: await targetDevice.storage.getBooks()
      })

      // Then: 資料一致性100%，變更記錄準確
      expect(syncResult.success).toBe(true)

      const comparisonResult = await compareDataSnapshots(preSyncSnapshot, postSyncSnapshot)
      expect(comparisonResult.dataIntegrity).toBe(100)
      expect(comparisonResult.changeLog.added).toBe(20) // 80 - 60 新增書籍
      expect(comparisonResult.changeLog.updated).toBeGreaterThanOrEqual(0)
      expect(comparisonResult.changeLog.removed).toBe(0) // 合併模式不刪除

      // 驗證變更記錄詳細性
      expect(comparisonResult.detailedChanges).toBeDefined()
      expect(comparisonResult.detailedChanges.length).toBeGreaterThan(0)
    })

    test('14. 重複資料處理', async () => {
      // Given: 包含重複書籍的匯入資料
      const device = await setupDevice('dedup-device')

      const uniqueBooks = generateTestBooks(30)
      const duplicatedBooks = [
        ...uniqueBooks,
        ...uniqueBooks.slice(0, 15), // 50% 重複
        ...generateTestBooks(20, 'additional')
      ]

      // When: 執行去重處理
      const deduplicationResult = await device.processDuplicates(duplicatedBooks)

      // Then: 保留最新資料，統計顯示跳過的重複項目
      expect(deduplicationResult.success).toBe(true)
      expect(deduplicationResult.originalCount).toBe(65)
      expect(deduplicationResult.duplicatesFound).toBe(15)
      expect(deduplicationResult.finalCount).toBe(50) // 30 + 20

      const processedBooks = deduplicationResult.books
      expect(processedBooks).toHaveLength(50)

      // 驗證統計報告
      const stats = deduplicationResult.statistics
      expect(stats.duplicatesSkipped).toBe(15)
      expect(stats.uniqueBooks).toBe(50)
      expect(stats.duplicateRate).toBeCloseTo(0.23, 2) // 15/65 ≈ 0.23
    })

    test('15. 資料損壞檢測', async () => {
      // Given: 部分損壞的JSON檔案
      const device = await setupDevice('corruption-detector')

      const corruptedDataSets = {
        jsonSyntaxError: '{"books": [{"id": "1", "title": "Test"} // 缺少結尾括號',
        missingMetadata: JSON.stringify({
          books: generateTestBooks(10)
          // 缺少 metadata 物件
        }),
        invalidChecksum: JSON.stringify({
          books: generateTestBooks(5),
          metadata: {
            checksum: 'invalid-checksum',
            bookCount: 5
          }
        }),
        truncatedData: JSON.stringify({
          books: generateTestBooks(20)
        }).slice(0, 500) // 截斷資料
      }

      // When: 執行資料完整性檢查
      for (const [corruptionType, corruptedData] of Object.entries(corruptedDataSets)) {
        const detectionResult = await device.detectDataCorruption(corruptedData)

        // Then: 正確檢測損壞位置，提供修復建議
        expect(detectionResult.isCorrupted).toBe(true)
        expect(detectionResult.corruptionType).toBe(corruptionType)
        expect(detectionResult.location).toBeDefined()
        expect(detectionResult.repairSuggestion).toBeDefined()
        expect(detectionResult.repairSuggestion.length).toBeGreaterThan(10) // 有意義的建議
      }
    })

    test('16. 資料恢復機制', async () => {
      // Given: 同步過程中發生錯誤
      const device = await setupDevice('recovery-device')
      const originalBooks = generateTestBooks(100)
      await device.storage.setBooks(originalBooks)

      // 建立備份點
      const backupPoint = await device.createBackupPoint('before-sync')
      expect(backupPoint.success).toBe(true)

      // 模擬同步過程中的錯誤
      await device.startSync()
      await device.storage.setBooks([...originalBooks, ...generateTestBooks(50, 'new')])

      // 模擬錯誤發生
      const errorResult = await device.simulateSyncError('NETWORK_FAILURE')
      expect(errorResult.errorOccurred).toBe(true)

      // When: 執行資料恢復
      const recoveryResult = await device.recoverFromBackup(backupPoint.id)

      // Then: 成功恢復到安全狀態，無資料遺失
      expect(recoveryResult.success).toBe(true)
      expect(recoveryResult.recoveredToState).toBe('before-sync')

      const recoveredBooks = await device.storage.getBooks()
      expect(recoveredBooks).toHaveLength(100)
      expect(validateDataIntegrity(originalBooks, recoveredBooks)).toBe(100)

      // 驗證恢復後狀態
      const deviceState = await device.getState()
      expect(deviceState.lastKnownGoodState).toBe(backupPoint.id)
      expect(deviceState.syncStatus).toBe('RECOVERED')
    })

    test('17. 空資料處理', async () => {
      // Given: 空書庫或null資料
      const deviceWithData = await setupDevice('device-with-data')
      const emptyDevice = await setupDevice('empty-device')

      const existingBooks = generateTestBooks(50)
      await deviceWithData.storage.setBooks(existingBooks)

      const emptyDataSets = [
        [], // 空陣列
        null, // null 值
        undefined, // undefined 值
        { books: [] }, // 空書籍物件
        { books: null } // null 書籍陣列
      ]

      // When: 執行同步操作
      for (const emptyData of emptyDataSets) {
        const syncResult = await emptyDevice.handleEmptyData(emptyData)

        // Then: 正確處理空資料，不影響現有資料
        expect(syncResult.success).toBe(true)
        expect(syncResult.handledEmptyData).toBe(true)

        // 確認現有資料未被影響
        const currentBooks = await deviceWithData.storage.getBooks()
        expect(currentBooks).toHaveLength(50)
        expect(validateDataIntegrity(existingBooks, currentBooks)).toBe(100)
      }

      // 測試從空設備到有資料設備的同步
      const emptyToFullSync = await executeFullSync(emptyDevice, deviceWithData)
      expect(emptyToFullSync.success).toBe(true)
      expect(emptyToFullSync.bookCount.added).toBe(0) // 空設備無新增內容
    })

    test('18. 大資料集處理', async () => {
      // Given: 10,000本書籍的極大資料集
      const hugeDataDevice = await setupDevice('huge-data-device')
      const targetDevice = await setupDevice('target-device')

      const hugeBookCollection = generateTestBooks(10000)
      await hugeDataDevice.storage.setBooks(hugeBookCollection)

      // When: 執行完整同步
      const performanceTracker = new PerformanceTracker()
      performanceTracker.start()

      const hugeSyncResult = await executeFullSync(hugeDataDevice, targetDevice, {
        performanceTracking: true,
        tracker: performanceTracker
      })

      performanceTracker.stop()

      // Then: 成功處理大資料集，效能符合基準
      expect(hugeSyncResult.success).toBe(true)
      expect(hugeSyncResult.bookCount.after).toBe(10000)

      const performance = performanceTracker.getMetrics()
      expect(performance.duration).toBeLessThan(180000) // <3分鐘
      expect(performance.memoryPeak).toBeLessThan(200 * 1024 * 1024) // <200MB
      expect(performance.throughput).toBeGreaterThan(55) // >55本/秒

      // 驗證資料完整性
      const targetBooks = await targetDevice.storage.getBooks()
      expect(targetBooks).toHaveLength(10000)

      // 抽樣驗證（驗證前100本和後100本）
      const sampleValidation = await validateSampleIntegrity(
        hugeBookCollection,
        targetBooks,
        { sampleSize: 200 }
      )
      expect(sampleValidation.integrity).toBeGreaterThan(99.9)
    })
  })

  describe('C. 效能和擴展性測試 (8個案例)', () => {
    test('19. 小資料集同步效能 (<100本)', async () => {
      // Given: 50本書籍資料
      const sourceDevice = await setupDevice('perf-source-small')
      const targetDevice = await setupDevice('perf-target-small')

      const smallCollection = generateTestBooks(50)
      await sourceDevice.storage.setBooks(smallCollection)

      // When: 執行完整同步
      const perfResult = await measurePerformance(async () => {
        return await executeFullSync(sourceDevice, targetDevice)
      })

      // Then: 匯出<5秒，匯入<10秒，檔案<1MB
      expect(perfResult.syncResult.success).toBe(true)
      expect(perfResult.timing.export).toBeLessThan(5000) // <5秒
      expect(perfResult.timing.import).toBeLessThan(10000) // <10秒
      expect(perfResult.fileSize).toBeLessThan(1024 * 1024) // <1MB
      expect(perfResult.memoryUsage.peak).toBeLessThan(50 * 1024 * 1024) // <50MB
    })

    test('20. 中資料集同步效能 (100-1000本)', async () => {
      // Given: 500本書籍資料
      const sourceDevice = await setupDevice('perf-source-medium')
      const targetDevice = await setupDevice('perf-target-medium')

      const mediumCollection = generateTestBooks(500)
      await sourceDevice.storage.setBooks(mediumCollection)

      // When: 執行完整同步
      const perfResult = await measurePerformance(async () => {
        return await executeFullSync(sourceDevice, targetDevice)
      })

      // Then: 匯出<15秒，匯入<30秒，檔案<5MB
      expect(perfResult.syncResult.success).toBe(true)
      expect(perfResult.timing.export).toBeLessThan(15000) // <15秒
      expect(perfResult.timing.import).toBeLessThan(30000) // <30秒
      expect(perfResult.fileSize).toBeLessThan(5 * 1024 * 1024) // <5MB
      expect(perfResult.memoryUsage.peak).toBeLessThan(100 * 1024 * 1024) // <100MB
    })

    test('21. 大資料集同步效能 (1000-5000本)', async () => {
      // Given: 2000本書籍資料
      const sourceDevice = await setupDevice('perf-source-large')
      const targetDevice = await setupDevice('perf-target-large')

      const largeCollection = generateTestBooks(2000)
      await sourceDevice.storage.setBooks(largeCollection)

      // When: 執行完整同步
      const perfResult = await measurePerformance(async () => {
        return await executeFullSync(sourceDevice, targetDevice)
      })

      // Then: 匯出<30秒，匯入<60秒，檔案<10MB
      expect(perfResult.syncResult.success).toBe(true)
      expect(perfResult.timing.export).toBeLessThan(30000) // <30秒
      expect(perfResult.timing.import).toBeLessThan(60000) // <60秒
      expect(perfResult.fileSize).toBeLessThan(10 * 1024 * 1024) // <10MB
      expect(perfResult.memoryUsage.peak).toBeLessThan(150 * 1024 * 1024) // <150MB
    })

    test('22. 極大資料集同步效能 (5000-10000本)', async () => {
      // Given: 8000本書籍資料
      const sourceDevice = await setupDevice('perf-source-huge')
      const targetDevice = await setupDevice('perf-target-huge')

      const hugeCollection = generateTestBooks(8000)
      await sourceDevice.storage.setBooks(hugeCollection)

      // When: 執行完整同步
      const perfResult = await measurePerformance(async () => {
        return await executeFullSync(sourceDevice, targetDevice, {
          enableOptimizations: true,
          batchSize: 1000
        })
      })

      // Then: 匯出<60秒，匯入<120秒，檔案<20MB
      expect(perfResult.syncResult.success).toBe(true)
      expect(perfResult.timing.export).toBeLessThan(60000) // <60秒
      expect(perfResult.timing.import).toBeLessThan(120000) // <120秒
      expect(perfResult.fileSize).toBeLessThan(20 * 1024 * 1024) // <20MB
      expect(perfResult.memoryUsage.peak).toBeLessThan(200 * 1024 * 1024) // <200MB
    })

    test('23. 同步速度基準測試', async () => {
      // Given: 標準測試資料集
      const benchmarkDevice = await setupDevice('benchmark-device')
      const testSizes = [100, 500, 1000, 2000, 5000]
      const benchmarkResults = []

      // When: 執行效能基準測試
      for (const size of testSizes) {
        const testBooks = generateTestBooks(size)
        await benchmarkDevice.storage.setBooks(testBooks)

        const startTime = Date.now()
        const exportResult = await benchmarkDevice.exportData()
        const endTime = Date.now()

        const throughput = size / ((endTime - startTime) / 1000) // 本/秒

        benchmarkResults.push({
          size,
          duration: endTime - startTime,
          throughput
        })
      }

      // Then: 處理速度≥50本/秒，符合效能基準
      benchmarkResults.forEach(result => {
        expect(result.throughput).toBeGreaterThanOrEqual(50) // ≥50本/秒

        // 驗證擴展性：大資料集不應該比小資料集慢太多
        if (result.size <= 1000) {
          expect(result.throughput).toBeGreaterThanOrEqual(80) // 小資料集應更快
        }
      })

      // 驗證線性擴展性
      const throughputVariation = Math.max(...benchmarkResults.map(r => r.throughput)) /
                                  Math.min(...benchmarkResults.map(r => r.throughput))
      expect(throughputVariation).toBeLessThan(3) // 效能差異不超過3倍
    })

    test('24. 記憶體使用監控', async () => {
      // Given: 大型資料集同步
      const memoryTestDevice = await setupDevice('memory-monitor-device')
      const largeBooks = generateTestBooks(3000)
      await memoryTestDevice.storage.setBooks(largeBooks)

      // When: 監控記憶體使用情況
      const memoryMonitor = new MemoryMonitor()
      memoryMonitor.start()

      const syncResult = await executeFullSync(
        memoryTestDevice,
        await setupDevice('memory-target-device'),
        { monitorMemory: true }
      )

      const memoryReport = memoryMonitor.stop()

      // Then: 記憶體使用<200MB，無記憶體洩漏
      expect(syncResult.success).toBe(true)
      expect(memoryReport.peakUsage).toBeLessThan(200 * 1024 * 1024) // <200MB
      expect(memoryReport.finalUsage).toBeLessThan(memoryReport.peakUsage * 1.1) // 無明顯洩漏

      // 檢查記憶體洩漏跡象
      expect(memoryReport.leakDetection.suspected).toBe(false)
      expect(memoryReport.gcEffectiveness).toBeGreaterThan(0.8) // GC 效果良好

      // 驗證記憶體使用模式
      const memoryPattern = memoryReport.usagePattern
      expect(memoryPattern.growthRate).toBeLessThan(1.5) // 線性成長，不超過1.5倍
      expect(memoryPattern.stabilityIndex).toBeGreaterThan(0.7) // 記憶體使用穩定
    })

    test('25. 並發同步處理', async () => {
      // Given: 多個同步請求同時進行
      const concurrentDevices = await Promise.all([
        setupDevice('concurrent-1'),
        setupDevice('concurrent-2'),
        setupDevice('concurrent-3')
      ])

      const sharedTargetDevice = await setupDevice('concurrent-target')

      // 為每個設備準備不同的資料
      await concurrentDevices[0].storage.setBooks(generateTestBooks(200, 'device-1'))
      await concurrentDevices[1].storage.setBooks(generateTestBooks(300, 'device-2'))
      await concurrentDevices[2].storage.setBooks(generateTestBooks(250, 'device-3'))

      // When: 執行並發同步
      const concurrentPromises = concurrentDevices.map(device =>
        executeFullSync(device, sharedTargetDevice)
      )

      const concurrentResults = await Promise.all(concurrentPromises)

      // Then: 正確排隊處理，無資料競爭
      concurrentResults.forEach(result => {
        expect(result.success).toBe(true)
      })

      // 驗證最終資料一致性
      const finalBooks = await sharedTargetDevice.storage.getBooks()
      expect(finalBooks).toHaveLength(750) // 200 + 300 + 250

      // 檢查資料競爭問題
      const dataIntegrityCheck = await checkDataRaceConditions(finalBooks)
      expect(dataIntegrityCheck.hasDataRace).toBe(false)
      expect(dataIntegrityCheck.duplicateEntries).toBe(0)

      // 驗證並發處理順序
      const processingOrder = concurrentResults.map(r => r.processedAt).sort()
      expect(processingOrder).toEqual(concurrentResults.map(r => r.processedAt).sort())
    })

    test('26. 效能降級機制', async () => {
      // Given: 低效能環境或大資料集
      const lowPerfDevice = await setupDevice('low-performance-device', {
        simulateSlowCPU: true,
        limitedMemory: 128 * 1024 * 1024 // 128MB 限制
      })

      const hugeDataset = generateTestBooks(7000)
      await lowPerfDevice.storage.setBooks(hugeDataset)

      // When: 觸發效能降級
      const degradationResult = await lowPerfDevice.performSync({
        enableDegradation: true,
        degradationThresholds: {
          memoryLimit: 100 * 1024 * 1024, // 100MB
          timeLimit: 90000 // 90秒
        }
      })

      // Then: 降級機制啟動，保持功能可用性
      expect(degradationResult.success).toBe(true)
      expect(degradationResult.degradationActivated).toBe(true)
      expect(degradationResult.degradationStrategies).toContain('batch_processing')
      expect(degradationResult.degradationStrategies).toContain('memory_optimization')

      // 驗證降級後仍能完成任務
      expect(degradationResult.bookCount.processed).toBe(7000)
      expect(degradationResult.dataIntegrity.verified).toBe(true)

      // 驗證降級機制效果
      const performanceMetrics = degradationResult.performanceMetrics
      expect(performanceMetrics.memoryUsage.peak).toBeLessThan(120 * 1024 * 1024)
      expect(performanceMetrics.batchSize.adaptive).toBe(true)
      expect(performanceMetrics.processingStrategy).toBe('conservative')

      // 驗證使用者體驗
      const userExperience = degradationResult.userExperience
      expect(userExperience.progressUpdatesFrequency).toBeGreaterThan(10)
      expect(userExperience.degradationNotification).toBeDefined()
      expect(userExperience.estimatedTimeRemaining).toBeGreaterThan(0)
    })
  })

  describe('D. 錯誤處理和恢復測試 (12個案例)', () => {
    test('27. 網路連接異常處理', async () => {
      // Given: 同步過程中網路中斷
      const sourceDevice = await setupDevice('network-source')
      const targetDevice = await setupDevice('network-target')

      await sourceDevice.storage.setBooks(generateTestBooks(100))

      // When: 檢測到網路異常
      await simulateNetworkConditions('disconnected')

      const networkErrorResult = await executeFullSync(sourceDevice, targetDevice)

      // Then: 顯示錯誤訊息，提供重試選項
      expect(networkErrorResult.success).toBe(false)
      expect(networkErrorResult.error.type).toBe('NETWORK_ERROR')
      expect(networkErrorResult.error.message).toContain('網路連接')
      expect(networkErrorResult.recovery.options).toContain('retry')
      expect(networkErrorResult.recovery.options).toContain('offline_backup')

      // 測試恢復網路後的重試
      await simulateNetworkConditions('normal')
      const retryResult = await networkErrorResult.retry()
      expect(retryResult.success).toBe(true)
    })

    test('28. 檔案讀取錯誤處理', async () => {
      // Given: 損壞或無效的匯入檔案
      const device = await setupDevice('file-error-device')

      const corruptedFiles = [
        createCorruptedFile('binary_corruption'),
        createCorruptedFile('permission_denied'),
        createCorruptedFile('file_not_found'),
        createCorruptedFile('disk_error')
      ]

      // When: 嘗試讀取檔案
      for (const corruptedFile of corruptedFiles) {
        const readResult = await device.readImportFile(corruptedFile)

        // Then: 錯誤訊息具體明確，提供解決建議
        expect(readResult.success).toBe(false)
        expect(readResult.error.type).toBeDefined()
        expect(readResult.error.message).toContain('檔案')
        expect(readResult.error.solution).toBeDefined()
        expect(readResult.error.solution.length).toBeGreaterThan(20)

        // 驗證錯誤分類正確
        expect(['FILE_CORRUPTED', 'PERMISSION_ERROR', 'FILE_NOT_FOUND', 'DISK_ERROR'])
          .toContain(readResult.error.type)
      }
    })

    test('29. 資料解析錯誤處理', async () => {
      // Given: JSON格式錯誤的匯入檔案
      const device = await setupDevice('parser-error-device')

      const malformedJSONs = [
        '{"books": [{"id": "1", "title": "Test"} // 缺少結尾',
        '{"books": [{"id": "1", "title": }]}', // 缺少值
        '{"books": [{"id": "1", "title": "Test",}]}', // 多餘逗號
        '{"books": [{"id": 1, "title": "Test"}]}', // 錯誤類型
        'not a json at all' // 完全不是JSON
      ]

      // When: 執行資料解析
      for (const malformedJSON of malformedJSONs) {
        const parseResult = await device.parseImportData(malformedJSON)

        // Then: 指出具體錯誤位置，提供格式修正建議
        expect(parseResult.success).toBe(false)
        expect(parseResult.error.type).toBe('JSON_PARSE_ERROR')
        expect(parseResult.error.location).toBeDefined()
        expect(parseResult.error.location.line).toBeGreaterThan(0)
        expect(parseResult.error.correction).toBeDefined()
        expect(parseResult.error.correction.suggestion).toContain('修正')

        // 驗證錯誤位置準確性
        if (parseResult.error.location.character) {
          expect(parseResult.error.location.character).toBeGreaterThan(0)
        }
      }
    })

    test('30. 儲存空間不足處理', async () => {
      // Given: Chrome Storage空間不足
      const device = await setupDevice('storage-full-device')

      // 模擬儲存空間不足
      await chromeMock._simulateStorageQuotaExceeded()

      const largeDataset = generateTestBooks(5000)

      // When: 執行資料匯入
      const importResult = await device.importBooks(largeDataset)

      // Then: 提示空間不足，建議清理或升級
      expect(importResult.success).toBe(false)
      expect(importResult.error.type).toBe('STORAGE_QUOTA_EXCEEDED')
      expect(importResult.error.message).toContain('儲存空間不足')
      expect(importResult.error.suggestions).toContain('清理舊資料')
      expect(importResult.error.suggestions).toContain('升級儲存配額')

      // 驗證提供的清理選項
      const cleanupOptions = importResult.error.cleanupOptions
      expect(cleanupOptions).toBeDefined()
      expect(cleanupOptions.estimatedSpaceGain).toBeGreaterThan(0)
      expect(cleanupOptions.safeToDelete).toBeInstanceOf(Array)
    })

    test('31. 權限不足處理', async () => {
      // Given: Chrome Extension權限受限
      const device = await setupDevice('permission-restricted-device')

      // 模擬權限問題
      chromeMock._setLastError(new Error('Permission denied'))

      // When: 嘗試存取儲存API
      const accessResult = await device.accessStorage()

      // Then: 指導使用者檢查權限設定
      expect(accessResult.success).toBe(false)
      expect(accessResult.error.type).toBe('PERMISSION_DENIED')
      expect(accessResult.error.message).toContain('權限')
      expect(accessResult.error.instructions).toBeDefined()
      expect(accessResult.error.instructions.steps).toBeInstanceOf(Array)
      expect(accessResult.error.instructions.steps.length).toBeGreaterThan(3)

      // 驗證說明詳細且可操作
      const instructions = accessResult.error.instructions.steps
      instructions.forEach(step => {
        expect(step).toContain('點擊')
        expect(step.length).toBeGreaterThan(10)
      })
    })

    test('32. 同步中斷恢復', async () => {
      // Given: 同步過程中瀏覽器崩潰
      const device = await setupDevice('crash-recovery-device')

      await device.storage.setBooks(generateTestBooks(200))

      // 開始同步並模擬中斷
      const syncProcess = await device.startSync()
      await device.simulateProgress(50) // 同步到50%

      // 模擬瀏覽器崩潰
      await device.simulateCrash()

      // When: 重新啟動應用
      const restartedDevice = await device.restart()
      const recoveryCheck = await restartedDevice.checkIncompleteSync()

      // Then: 檢測未完成同步，提供繼續或重新開始選項
      expect(recoveryCheck.incompleteSync).toBe(true)
      expect(recoveryCheck.progress).toBeCloseTo(50, 5)
      expect(recoveryCheck.options).toContain('continue')
      expect(recoveryCheck.options).toContain('restart')
      expect(recoveryCheck.options).toContain('rollback')

      // 測試繼續同步
      const continueResult = await restartedDevice.continuePreviousSync()
      expect(continueResult.success).toBe(true)
      expect(continueResult.resumedFrom).toBeCloseTo(50, 5)
    })

    test('33. 操作取消處理', async () => {
      // Given: 使用者中途取消同步
      const device = await setupDevice('cancel-test-device')
      await device.storage.setBooks(generateTestBooks(1000))

      // When: 取消操作觸發
      const syncProcess = await device.startLongRunningSync()
      await device.waitForProgress(25) // 等到25%進度

      const cancelResult = await syncProcess.cancel()

      // Then: 安全中止，保持資料狀態一致
      expect(cancelResult.cancelled).toBe(true)
      expect(cancelResult.safelyAborted).toBe(true)
      expect(cancelResult.dataIntegrity.maintained).toBe(true)

      // 驗證資料狀態一致性
      const postCancelState = await device.getDataState()
      expect(postCancelState.consistent).toBe(true)
      expect(postCancelState.partialData).toBe(false)

      // 驗證清理完成
      const cleanupStatus = cancelResult.cleanup
      expect(cleanupStatus.tempFilesRemoved).toBe(true)
      expect(cleanupStatus.memoryFreed).toBe(true)
      expect(cleanupStatus.locksReleased).toBe(true)
    })

    test('34. 錯誤訊息顯示', async () => {
      // Given: 各種錯誤情況發生
      const device = await setupDevice('error-message-device')

      const errorScenarios = [
        { type: 'NETWORK_ERROR', cause: 'connection_timeout' },
        { type: 'FILE_ERROR', cause: 'file_corrupted' },
        { type: 'PERMISSION_ERROR', cause: 'access_denied' },
        { type: 'STORAGE_ERROR', cause: 'quota_exceeded' },
        { type: 'DATA_ERROR', cause: 'invalid_format' }
      ]

      // When: 顯示錯誤訊息
      for (const scenario of errorScenarios) {
        const error = await device.simulateError(scenario.type, scenario.cause)
        const errorDisplay = await device.formatErrorMessage(error)

        // Then: 訊息中文顯示，具體明確，可操作
        expect(errorDisplay.language).toBe('zh-TW')
        expect(errorDisplay.message.length).toBeGreaterThan(20)
        expect(errorDisplay.message).not.toContain('undefined')
        expect(errorDisplay.message).not.toContain('null')

        // 驗證可操作性
        expect(errorDisplay.actionable).toBe(true)
        expect(errorDisplay.actions).toBeInstanceOf(Array)
        expect(errorDisplay.actions.length).toBeGreaterThan(0)

        // 驗證具體性
        expect(errorDisplay.specificity.level).toBeGreaterThan(0.7) // 70%以上具體性
        expect(errorDisplay.technicalDetails).toBeDefined()
        expect(errorDisplay.userFriendlyExplanation).toBeDefined()
      }
    })

    test('35. 自動重試機制', async () => {
      // Given: 暫時性網路或系統錯誤
      const device = await setupDevice('retry-test-device')

      // 模擬間歇性網路問題
      let attemptCount = 0
      const flakyNetwork = () => {
        attemptCount++
        if (attemptCount <= 2) {
          throw new Error('TEMPORARY_NETWORK_ERROR')
        }
        return { success: true }
      }

      device.networkCall = flakyNetwork

      // When: 錯誤發生
      const retryResult = await device.executeWithRetry(async () => {
        return device.networkCall()
      })

      // Then: 自動重試3次，間隔遞增，失敗後手動選項
      expect(retryResult.success).toBe(true)
      expect(retryResult.attemptCount).toBe(3)
      expect(retryResult.retryIntervals).toEqual([1000, 2000, 4000]) // 指數遞增

      // 測試最大重試次數
      const maxRetryResult = await device.executeWithRetry(
        () => { throw new Error('PERSISTENT_ERROR') },
        { maxRetries: 3 }
      )

      expect(maxRetryResult.success).toBe(false)
      expect(maxRetryResult.attemptCount).toBe(4) // 初始嘗試 + 3次重試
      expect(maxRetryResult.exhaustedRetries).toBe(true)
      expect(maxRetryResult.manualOptions).toBeDefined()
      expect(maxRetryResult.manualOptions).toContain('contact_support')
    })

    test('36. 使用者介入處理', async () => {
      // Given: 需要使用者決策的衝突情況
      const device = await setupDevice('user-intervention-device')

      const conflictData = {
        book1: { id: '123', title: '書A', progress: 50, lastModified: '2025-08-01' },
        book2: { id: '123', title: '書A', progress: 80, lastModified: '2025-08-02' }
      }

      // When: 系統無法自動解決
      const conflictResult = await device.handleDataConflict(conflictData)

      // Then: 清楚說明衝突，提供選擇介面
      expect(conflictResult.requiresUserIntervention).toBe(true)
      expect(conflictResult.conflictDescription).toBeDefined()
      expect(conflictResult.conflictDescription.summary).toContain('衝突')
      expect(conflictResult.conflictDescription.details).toBeInstanceOf(Array)

      // 驗證選擇介面
      const choiceInterface = conflictResult.userInterface
      expect(choiceInterface.options).toBeInstanceOf(Array)
      expect(choiceInterface.options.length).toBeGreaterThanOrEqual(3)

      const optionTypes = choiceInterface.options.map(opt => opt.type)
      expect(optionTypes).toContain('keep_local')
      expect(optionTypes).toContain('use_remote')
      expect(optionTypes).toContain('manual_merge')

      // 驗證說明清楚
      choiceInterface.options.forEach(option => {
        expect(option.description).toBeDefined()
        expect(option.description.length).toBeGreaterThan(15)
        expect(option.preview).toBeDefined()
      })
    })

    test('37. 降級方案啟動', async () => {
      // Given: 主要同步方式失敗
      const device = await setupDevice('fallback-device')

      await device.storage.setBooks(generateTestBooks(300))

      // 模擬主要同步方式失敗
      device.primarySync = jest.fn().mockRejectedValue(new Error('PRIMARY_SYNC_FAILED'))

      // When: 觸發降級機制
      const fallbackResult = await device.syncWithFallback()

      // Then: 啟用備用方案，使用者獲得通知
      expect(fallbackResult.success).toBe(true)
      expect(fallbackResult.usedFallback).toBe(true)
      expect(fallbackResult.fallbackMethod).toBe('local_backup_export')
      expect(fallbackResult.userNotification).toBeDefined()
      expect(fallbackResult.userNotification.message).toContain('備用方案')

      // 驗證備用方案的有效性
      const fallbackData = fallbackResult.backupData
      expect(fallbackData).toBeDefined()
      expect(fallbackData.books).toHaveLength(300)
      expect(fallbackData.metadata.method).toBe('local_fallback')
      expect(fallbackData.metadata.timestamp).toBeDefined()

      // 驗證使用者指導
      const guidance = fallbackResult.userGuidance
      expect(guidance.nextSteps).toBeInstanceOf(Array)
      expect(guidance.nextSteps.length).toBeGreaterThan(2)
      expect(guidance.nextSteps[0]).toContain('下載')
    })

    test('38. 錯誤日誌記錄', async () => {
      // Given: 同步過程中各種事件
      const device = await setupDevice('logging-device')
      const logger = device.getLogger()

      await device.storage.setBooks(generateTestBooks(100))

      // When: 記錄錯誤和警告
      const syncWithLogging = await device.syncWithLogging({
        simulateWarnings: true,
        simulateErrors: true
      })

      // Then: 日誌完整，便於問題診斷和分析
      const logs = logger.getLogs()
      expect(logs.length).toBeGreaterThan(5)

      // 驗證日誌結構
      logs.forEach(log => {
        expect(log.timestamp).toBeDefined()
        expect(log.level).toMatch(/^(INFO|WARN|ERROR|DEBUG)$/)
        expect(log.message).toBeDefined()
        expect(log.context).toBeDefined()
      })

      // 驗證日誌內容豐富度
      const errorLogs = logs.filter(log => log.level === 'ERROR')
      const warnLogs = logs.filter(log => log.level === 'WARN')
      const infoLogs = logs.filter(log => log.level === 'INFO')

      expect(errorLogs.length).toBeGreaterThan(0)
      expect(warnLogs.length).toBeGreaterThan(0)
      expect(infoLogs.length).toBeGreaterThan(0)

      // 驗證日誌可用於診斷
      const diagnosticValue = logger.analyzeDiagnosticValue()
      expect(diagnosticValue.completeness).toBeGreaterThan(0.8)
      expect(diagnosticValue.actionability).toBeGreaterThan(0.7)
      expect(diagnosticValue.traceability).toBeGreaterThan(0.9)
    })
  })

  describe('E. 跨設備一致性測試 (7個案例)', () => {
    test('39. 雙設備資料一致性', async () => {
      // Given: 兩設備執行相同匯入操作
      const deviceA = await setupDevice('consistency-device-a')
      const deviceB = await setupDevice('consistency-device-b')

      const testBooks = generateTestBooks(150)
      const exportData = await createExportData(testBooks)

      // When: 比較最終資料狀態
      const importResultA = await deviceA.importData(exportData)
      const importResultB = await deviceB.importData(exportData)

      expect(importResultA.success).toBe(true)
      expect(importResultB.success).toBe(true)

      const finalDataA = await deviceA.storage.getBooks()
      const finalDataB = await deviceB.storage.getBooks()

      // Then: 資料完全一致，包括順序和metadata
      expect(finalDataA).toEqual(finalDataB)
      expect(finalDataA).toHaveLength(150)

      // 驗證深度一致性
      for (let i = 0; i < finalDataA.length; i++) {
        const bookA = finalDataA[i]
        const bookB = finalDataB[i]

        expect(bookA.id).toBe(bookB.id)
        expect(bookA.title).toBe(bookB.title)
        expect(bookA.progress).toBe(bookB.progress)
        expect(bookA.extractedAt).toBe(bookB.extractedAt)
      }

      // 驗證metadata一致性
      const metadataA = await deviceA.getStorageMetadata()
      const metadataB = await deviceB.getStorageMetadata()

      expect(metadataA.checksum).toBe(metadataB.checksum)
      expect(metadataA.lastModified).toBe(metadataB.lastModified)
    })

    test('40. 多設備同步順序', async () => {
      // Given: A→B→C設備鏈式同步
      const deviceA = await setupDevice('chain-device-a')
      const deviceB = await setupDevice('chain-device-b')
      const deviceC = await setupDevice('chain-device-c')

      const initialBooks = generateTestBooks(100)
      await deviceA.storage.setBooks(initialBooks)

      // When: 執行連續同步
      // Step 1: A → B
      const syncAB = await executeFullSync(deviceA, deviceB)
      expect(syncAB.success).toBe(true)

      // Step 2: B → C
      const syncBC = await executeFullSync(deviceB, deviceC)
      expect(syncBC.success).toBe(true)

      // Then: 最終三設備資料一致
      const booksA = await deviceA.storage.getBooks()
      const booksB = await deviceB.storage.getBooks()
      const booksC = await deviceC.storage.getBooks()

      expect(booksA).toEqual(booksB)
      expect(booksB).toEqual(booksC)
      expect(booksC).toHaveLength(100)

      // 驗證傳播完整性
      const propagationCheck = await validateDataPropagation([deviceA, deviceB, deviceC])
      expect(propagationCheck.consistency).toBe(100)
      expect(propagationCheck.lostData).toBe(0)
      expect(propagationCheck.corruptedData).toBe(0)

      // 驗證同步順序記錄
      const syncHistoryB = await deviceB.getSyncHistory()
      const syncHistoryC = await deviceC.getSyncHistory()

      expect(syncHistoryB.length).toBe(1)
      expect(syncHistoryC.length).toBe(1)
      expect(syncHistoryB[0].sourceDevice).toBe('chain-device-a')
      expect(syncHistoryC[0].sourceDevice).toBe('chain-device-b')
    })

    test('41. 同步衝突檢測', async () => {
      // Given: 兩設備對同一書籍有不同更新
      const deviceA = await setupDevice('conflict-device-a')
      const deviceB = await setupDevice('conflict-device-b')

      // 建立衝突場景
      const baseBooks = generateTestBooks(50)

      // Device A: 更新進度但保持舊標題
      const booksA = baseBooks.map(book => ({
        ...book,
        progress: book.progress + 30,
        lastModified: '2025-08-24T10:00:00Z'
      }))

      // Device B: 更新標題但保持舊進度
      const booksB = baseBooks.map(book => ({
        ...book,
        title: book.title + ' (修訂版)',
        lastModified: '2025-08-24T11:00:00Z'
      }))

      await deviceA.storage.setBooks(booksA)
      await deviceB.storage.setBooks(booksB)

      // When: 執行衝突檢測
      const conflictDetection = await detectSyncConflicts(deviceA, deviceB)

      // Then: 正確識別衝突類型和位置
      expect(conflictDetection.hasConflicts).toBe(true)
      expect(conflictDetection.conflictCount).toBe(50)
      expect(conflictDetection.conflictTypes).toContain('PROGRESS_DIFF')
      expect(conflictDetection.conflictTypes).toContain('TITLE_DIFF')

      // 驗證衝突詳細資訊
      const conflictDetails = conflictDetection.conflicts
      expect(conflictDetails).toHaveLength(50)

      conflictDetails.forEach(conflict => {
        expect(conflict.bookId).toBeDefined()
        expect(conflict.fields).toContain('progress')
        expect(conflict.fields).toContain('title')
        expect(conflict.severity).toMatch(/^(LOW|MEDIUM|HIGH)$/)
        expect(conflict.autoResolvable).toBeDefined()
      })
    })

    test('42. 衝突解決策略', async () => {
      // Given: 檢測到的資料衝突
      const resolver = await setupConflictResolver()

      const conflicts = [
        {
          type: 'PROGRESS_DIFF',
          bookId: '123',
          localValue: 60,
          remoteValue: 80,
          strategy: 'keep_highest'
        },
        {
          type: 'TITLE_DIFF',
          bookId: '456',
          localValue: '原標題',
          remoteValue: '更新標題',
          strategy: 'keep_latest_timestamp'
        },
        {
          type: 'METADATA_DIFF',
          bookId: '789',
          localValue: { author: '作者A' },
          remoteValue: { author: '作者B' },
          strategy: 'user_intervention'
        }
      ]

      // When: 應用不同解決策略
      const resolutionResults = []

      for (const conflict of conflicts) {
        const resolution = await resolver.resolveConflict(conflict)
        resolutionResults.push(resolution)
      }

      // Then: 按策略正確解決，記錄解決過程
      expect(resolutionResults[0].resolvedValue).toBe(80) // keep_highest
      expect(resolutionResults[0].strategy).toBe('keep_highest')
      expect(resolutionResults[0].confidence).toBeGreaterThan(0.9)

      expect(resolutionResults[1].resolvedValue).toBe('更新標題') // keep_latest
      expect(resolutionResults[1].strategy).toBe('keep_latest_timestamp')

      expect(resolutionResults[2].requiresUserInput).toBe(true) // user_intervention
      expect(resolutionResults[2].options).toHaveLength.greaterThan(1)

      // 驗證解決過程記錄
      const resolutionLog = await resolver.getResolutionLog()
      expect(resolutionLog).toHaveLength(3)

      resolutionLog.forEach(logEntry => {
        expect(logEntry.timestamp).toBeDefined()
        expect(logEntry.strategy).toBeDefined()
        expect(logEntry.outcome).toBeDefined()
      })
    })

    test('43. 時間戳驗證', async () => {
      // Given: 不同時區和時間設定的設備
      const deviceTaipei = await setupDevice('device-taipei', {
        timezone: 'Asia/Taipei'
      })
      const deviceNewYork = await setupDevice('device-newyork', {
        timezone: 'America/New_York'
      })
      const deviceLondon = await setupDevice('device-london', {
        timezone: 'Europe/London'
      })

      // 在不同時區同時建立相同書籍
      const baseTime = new Date('2025-08-24T12:00:00Z')

      const bookTaipei = {
        id: 'time-test-001',
        title: '時間測試書籍',
        progress: 50,
        extractedAt: baseTime.toISOString(),
        timezone: 'Asia/Taipei'
      }

      const bookNewYork = {
        ...bookTaipei,
        progress: 70,
        extractedAt: new Date(baseTime.getTime() + 3600000).toISOString(), // +1小時
        timezone: 'America/New_York'
      }

      const bookLondon = {
        ...bookTaipei,
        progress: 30,
        extractedAt: new Date(baseTime.getTime() - 1800000).toISOString(), // -30分鐘
        timezone: 'Europe/London'
      }

      await deviceTaipei.storage.setBooks([bookTaipei])
      await deviceNewYork.storage.setBooks([bookNewYork])
      await deviceLondon.storage.setBooks([bookLondon])

      // When: 執行時間戳比較
      const timezoneValidator = new TimezoneValidator()
      const comparison = await timezoneValidator.compareTimestamps([
        bookTaipei, bookNewYork, bookLondon
      ])

      // Then: 正確處理時區差異，時間戳比較準確
      expect(comparison.success).toBe(true)
      expect(comparison.normalizedTimestamps).toBeDefined()
      expect(comparison.chronologicalOrder).toEqual([
        'device-london', // 最早
        'device-taipei', // 中間
        'device-newyork' // 最晚
      ])

      // 驗證時區正規化
      const normalized = comparison.normalizedTimestamps
      expect(normalized.length).toBe(3)
      normalized.forEach(timestamp => {
        expect(timestamp.utc).toBeDefined()
        expect(timestamp.originalTimezone).toBeDefined()
      })

      // 驗證時間戳準確性
      const timeDiffs = comparison.timeDifferences
      expect(timeDiffs.taipeiToNewYork).toBe(3600000) // 1小時差
      expect(timeDiffs.londonToTaipei).toBe(1800000) // 30分鐘差
    })

    test('44. 版本控制檢查', async () => {
      // Given: 不同Extension版本的設備
      const deviceV1 = await setupDevice('version-1-device', {
        extensionVersion: '1.0.0',
        dataFormat: 'v1.0'
      })

      const deviceV2 = await setupDevice('version-2-device', {
        extensionVersion: '1.1.0',
        dataFormat: 'v1.1'
      })

      const deviceV3 = await setupDevice('version-3-device', {
        extensionVersion: '2.0.0',
        dataFormat: 'v2.0'
      })

      // 建立不同版本格式的資料
      const v1Books = generateTestBooks(30, 'v1-format')
      const v2Books = generateTestBooks(40, 'v2-format').map(book => ({
        ...book,
        newField: 'v2-feature',
        formatVersion: '1.1'
      }))

      const v3Books = generateTestBooks(50, 'v3-format').map(book => ({
        ...book,
        newField: 'v2-feature',
        advancedMetadata: { version: '2.0', features: ['sync', 'search'] },
        formatVersion: '2.0'
      }))

      await deviceV1.storage.setBooks(v1Books)
      await deviceV2.storage.setBooks(v2Books)
      await deviceV3.storage.setBooks(v3Books)

      // When: 執行相容性檢查
      const compatibilityMatrix = [
        { from: deviceV1, to: deviceV2, expectedCompatible: true },
        { from: deviceV2, to: deviceV1, expectedCompatible: true }, // 向下相容
        { from: deviceV1, to: deviceV3, expectedCompatible: false }, // 跨大版本
        { from: deviceV3, to: deviceV1, expectedCompatible: false },
        { from: deviceV2, to: deviceV3, expectedCompatible: true },
        { from: deviceV3, to: deviceV2, expectedCompatible: true }
      ]

      const compatibilityResults = []

      for (const test of compatibilityMatrix) {
        const compatibility = await checkVersionCompatibility(test.from, test.to)
        compatibilityResults.push({
          ...test,
          result: compatibility
        })
      }

      // Then: 正確識別版本差異，提供相容性資訊
      compatibilityResults.forEach(testCase => {
        expect(testCase.result.compatible).toBe(testCase.expectedCompatible)
        expect(testCase.result.sourceVersion).toBeDefined()
        expect(testCase.result.targetVersion).toBeDefined()

        if (!testCase.result.compatible) {
          expect(testCase.result.incompatibilityReasons).toBeInstanceOf(Array)
          expect(testCase.result.migrationRequired).toBe(true)
          expect(testCase.result.migrationOptions).toBeDefined()
        } else {
          expect(testCase.result.dataTransformations).toBeDefined()
        }
      })

      // 驗證版本升級路徑
      const upgradePath = await calculateUpgradePath('1.0.0', '2.0.0')
      expect(upgradePath.steps).toEqual(['1.0.0', '1.1.0', '2.0.0'])
      expect(upgradePath.transformations.length).toBe(2)
    })

    test('45. 最終一致性驗證', async () => {
      // Given: 複雜的多設備同步場景
      const devices = await Promise.all([
        setupDevice('hub-device'), // 中央設備
        setupDevice('mobile-device'), // 行動設備
        setupDevice('work-device'), // 工作設備
        setupDevice('home-device'), // 家用設備
        setupDevice('backup-device') // 備份設備
      ])

      // 建立複雜的初始狀態
      const hubBooks = generateTestBooks(200, 'hub')
      const mobileBooks = [...generateTestBooks(150, 'mobile'), ...hubBooks.slice(0, 100)]
      const workBooks = [...generateTestBooks(180, 'work'), ...hubBooks.slice(50, 150)]
      const homeBooks = [...generateTestBooks(120, 'home'), ...mobileBooks.slice(0, 80)]
      const backupBooks = generateTestBooks(300, 'backup') // 最多但可能過時

      await devices[0].storage.setBooks(hubBooks) // hub: 200本
      await devices[1].storage.setBooks(mobileBooks) // mobile: 250本
      await devices[2].storage.setBooks(workBooks) // work: 280本
      await devices[3].storage.setBooks(homeBooks) // home: 200本
      await devices[4].storage.setBooks(backupBooks) // backup: 300本

      // When: 所有同步操作完成後
      const finalConsistencyProcess = new FinalConsistencyProcessor(devices)
      const convergenceResult = await finalConsistencyProcess.convergeToConsistentState()

      // Then: 所有設備達到最終一致狀態
      expect(convergenceResult.success).toBe(true)
      expect(convergenceResult.converged).toBe(true)
      expect(convergenceResult.consistencyLevel).toBeGreaterThan(99.9) // >99.9%

      // 驗證所有設備資料一致
      const allDeviceBooks = await Promise.all(
        devices.map(device => device.storage.getBooks())
      )

      const referenceBooks = allDeviceBooks[0]
      allDeviceBooks.forEach(deviceBooks => {
        expect(deviceBooks).toHaveLength(referenceBooks.length)
        expect(validateDataIntegrity(referenceBooks, deviceBooks)).toBe(100)
      })

      // 驗證最終狀態特性
      const finalState = convergenceResult.finalState
      expect(finalState.totalBooks).toBeGreaterThan(400) // 合併後的唯一書籍數
      expect(finalState.duplicatesEliminated).toBeGreaterThan(0)
      expect(finalState.conflictsResolved).toBeGreaterThanOrEqual(0)

      // 驗證一致性度量
      const consistencyMetrics = await finalConsistencyProcess.measureConsistency()
      expect(consistencyMetrics.hash).toBeDefined()
      expect(consistencyMetrics.checksum).toBeDefined()
      expect(consistencyMetrics.bookCount).toBe(finalState.totalBooks)

      // 所有設備應有相同的一致性度量
      for (let i = 1; i < devices.length; i++) {
        const deviceMetrics = await devices[i].getConsistencyMetrics()
        expect(deviceMetrics.hash).toBe(consistencyMetrics.hash)
        expect(deviceMetrics.checksum).toBe(consistencyMetrics.checksum)
      }
    })
  })
})

// 所有輔助函數和類別定義都在 cross-device-sync.mock.js 中實作
