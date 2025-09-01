/**
 * Content Script 注入整合測試
 *
 * 測試目標：
 * - 驗證Content Script在不同頁面環境下的正確注入
 * - 確保注入時機、權限檢查、錯誤處理的可靠性
 * - 檢查Content Script與頁面環境的隔離性和安全性
 */

const { E2ETestSuite } = require('../../helpers/e2e-test-suite')
const { ChromeExtensionController } = require('../../helpers/chrome-extension-controller')
const { TestDataGenerator } = require('../../helpers/test-data-generator')
const { ContentScriptValidator } = require('../../helpers/content-script-validator')
const { InjectionAnalyzer } = require('../../helpers/injection-analyzer')

describe('Content Script 注入整合測試', () => {
  let testSuite
  let extensionController
  let testDataGenerator
  let scriptValidator
  let injectionAnalyzer

  beforeAll(async () => {
    testSuite = new E2ETestSuite({
      headless: process.env.CI !== 'false',
      slowMo: 30,
      testDataSize: 'medium',
      enableScriptInjectionTracking: true // 啟用腳本注入追蹤
    })

    await testSuite.setup()
    extensionController = testSuite.extensionController
    testDataGenerator = new TestDataGenerator()
    scriptValidator = new ContentScriptValidator(testSuite)
    injectionAnalyzer = new InjectionAnalyzer()
  })

  afterAll(async () => {
    await scriptValidator.cleanup()
    await injectionAnalyzer.cleanup()
    await testSuite.cleanup()
  })

  beforeEach(async () => {
    await testSuite.clearAllStorageData()
    await scriptValidator.reset()
    await injectionAnalyzer.reset()
  })

  describe('基礎Content Script注入機制', () => {
    test('應該在支援的Readmoo頁面正確注入Content Script', async () => {
      // Given: 準備不同類型的Readmoo頁面
      const readmooPageTypes = [
        {
          url: 'https://readmoo.com/library',
          pageType: 'library',
          expectedScript: 'readmoo-library-extractor',
          shouldInject: true,
          expectedFeatures: ['book_extraction', 'pagination_handling', 'progress_tracking']
        },
        {
          url: 'https://readmoo.com/library?category=fiction',
          pageType: 'library_filtered',
          expectedScript: 'readmoo-library-extractor',
          shouldInject: true,
          expectedFeatures: ['book_extraction', 'filter_detection', 'category_handling']
        },
        {
          url: 'https://readmoo.com/book/210001234567890',
          pageType: 'book_detail',
          expectedScript: 'readmoo-book-detail-extractor',
          shouldInject: true,
          expectedFeatures: ['single_book_extraction', 'metadata_extraction']
        },
        {
          url: 'https://readmoo.com/search?q=programming',
          pageType: 'search_results',
          expectedScript: 'readmoo-search-extractor',
          shouldInject: true,
          expectedFeatures: ['search_results_extraction', 'pagination_handling']
        }
      ]

      const injectionResults = []

      for (const pageType of readmooPageTypes) {
        // When: 導航到特定頁面並觸發注入
        await testSuite.navigateToPage(pageType.url)

        const injectionStart = Date.now()
        const injectionResult = await extensionController.injectContentScript()
        const injectionTime = Date.now() - injectionStart

        // 驗證注入結果
        const scriptValidation = await scriptValidator.validateInjection({
          expectedScript: pageType.expectedScript,
          expectedFeatures: pageType.expectedFeatures
        })

        injectionResults.push({
          url: pageType.url,
          pageType: pageType.pageType,
          injectionSuccess: injectionResult.success,
          injectionTime,
          scriptType: injectionResult.scriptType,
          featuresAvailable: scriptValidation.availableFeatures,
          validationPassed: scriptValidation.passed
        })

        console.log(`✓ ${pageType.pageType}: Injection ${injectionResult.success ? 'successful' : 'failed'}`)
      }

      // Then: 驗證所有注入結果
      injectionResults.forEach((result, index) => {
        const pageType = readmooPageTypes[index]

        if (pageType.shouldInject) {
          expect(result.injectionSuccess).toBe(true)
          expect(result.injectionTime).toBeLessThan(2000) // 注入時間<2秒
          expect(result.scriptType).toBe(pageType.expectedScript)
          expect(result.validationPassed).toBe(true)

          // 檢查預期功能是否可用
          pageType.expectedFeatures.forEach(feature => {
            expect(result.featuresAvailable).toContain(feature)
          })
        }
      })

      // 檢查注入效能統計
      const avgInjectionTime = injectionResults.reduce((sum, r) => sum + r.injectionTime, 0) / injectionResults.length
      expect(avgInjectionTime).toBeLessThan(1000) // 平均注入時間<1秒
    })

    test('應該正確檢測並跳過不支援的頁面', async () => {
      // Given: 準備不支援的頁面類型
      const unsupportedPages = [
        {
          url: 'https://google.com',
          reason: 'not_readmoo_domain'
        },
        {
          url: 'https://readmoo.com/login',
          reason: 'authentication_page'
        },
        {
          url: 'https://readmoo.com/payment',
          reason: 'payment_page'
        },
        {
          url: 'https://readmoo.com/static/help',
          reason: 'static_content_page'
        },
        {
          url: 'about:blank',
          reason: 'browser_internal_page'
        }
      ]

      const skipResults = []

      for (const page of unsupportedPages) {
        // When: 導航到不支援的頁面
        await testSuite.navigateToPage(page.url)

        const detectionStart = Date.now()
        const injectionResult = await extensionController.attemptContentScriptInjection()
        const detectionTime = Date.now() - detectionStart

        skipResults.push({
          url: page.url,
          expectedReason: page.reason,
          injectionSkipped: !injectionResult.injected,
          actualReason: injectionResult.skipReason,
          detectionTime,
          errorMessage: injectionResult.errorMessage
        })
      }

      // Then: 驗證正確跳過不支援頁面
      skipResults.forEach((result, index) => {
        const page = unsupportedPages[index]

        expect(result.injectionSkipped).toBe(true)
        expect(result.detectionTime).toBeLessThan(500) // 檢測時間<500ms
        expect(result.actualReason).toBe(page.reason)

        // 檢查錯誤訊息的用戶友善性
        if (result.errorMessage) {
          expect(result.errorMessage).toMatch(/請在Readmoo|不支援|無法使用/)
        }
      })
    })

    test('應該處理Content Script注入失敗的各種情況', async () => {
      // Given: 準備各種注入失敗情境
      const injectionFailureScenarios = [
        {
          name: 'CSP_VIOLATION',
          setup: async () => {
            await testSuite.navigateToMockReadmooPage() // 先設置 Readmoo 頁面環境
            await testSuite.navigateToCSPRestrictedPage() // 然後設置 CSP 限制
          },
          expectedError: 'Content Security Policy violation',
          recoverable: false
        },
        {
          name: 'INSUFFICIENT_PERMISSIONS',
          setup: async () => {
            await testSuite.revokeTabPermissions()
            await testSuite.navigateToMockReadmooPage()
          },
          expectedError: 'Insufficient permissions',
          recoverable: true
        },
        {
          name: 'SCRIPT_LOADING_ERROR',
          setup: async () => {
            await scriptValidator.simulateScriptLoadingError()
            await testSuite.navigateToMockReadmooPage()
          },
          expectedError: 'Script loading failed',
          recoverable: true
        },
        {
          name: 'PAGE_NOT_READY',
          setup: async () => {
            await testSuite.navigateToIncompleteReadmooPage()
          },
          expectedError: 'Page not ready',
          recoverable: true
        }
      ]

      const failureHandlingResults = []

      for (const scenario of injectionFailureScenarios) {
        // When: 設置失敗情境並嘗試注入
        await scenario.setup()

        const failureTestStart = Date.now()
        const injectionResult = await extensionController.attemptContentScriptInjection({
          enableErrorHandling: true,
          retryOnFailure: scenario.recoverable,
          maxRetries: 3,
          // 對 CSP_VIOLATION 場景啟用 CSP 檢測
          enableCSPDetection: scenario.name === 'CSP_VIOLATION',
          detectCSPViolations: scenario.name === 'CSP_VIOLATION'
        })
        const handlingTime = Date.now() - failureTestStart

        failureHandlingResults.push({
          scenario: scenario.name,
          injectionFailed: !injectionResult.injected,
          errorMessage: injectionResult.originalError || injectionResult.errorMessage,
          errorHandled: injectionResult.errorHandled,
          recoveryAttempted: injectionResult.recoveryAttempted,
          finalSuccess: injectionResult.injected,
          handlingTime
        })

        // 調試信息
        console.log(`🔧 Scenario ${scenario.name}: errorHandled=${injectionResult.errorHandled}, injected=${injectionResult.injected}, errorMessage="${injectionResult.errorMessage}"`)

        // 清理錯誤狀態
        await scriptValidator.clearSimulatedErrors()
        await testSuite.restoreNormalConditions()
      }

      // Then: 驗證失敗處理機制
      failureHandlingResults.forEach((result, index) => {
        const scenario = injectionFailureScenarios[index]

        expect(result.errorHandled).toBe(true)
        expect(result.handlingTime).toBeLessThan(10000) // 處理時間<10秒
        expect(result.errorMessage).toContain(scenario.expectedError)

        if (scenario.recoverable) {
          expect(result.recoveryAttempted).toBe(true)
          // 可恢復情況下，多數應該最終成功
          if (['INSUFFICIENT_PERMISSIONS', 'SCRIPT_LOADING_ERROR'].includes(scenario.name)) {
            expect(result.finalSuccess).toBe(true)
          }
        } else {
          // 不可恢復的情況下，應該提供明確的錯誤說明
          expect(result.errorMessage).toMatch(/Content Security Policy|CSP|安全政策/)
        }
      })
    })
  })

  describe('Content Script生命周期管理', () => {
    test('應該正確管理Content Script的載入、初始化和清理', async () => {
      // Given: 設置生命周期監控
      await injectionAnalyzer.enableLifecycleTracking()
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(100, 'lifecycle-test'))

      // When: 執行完整的Content Script生命周期
      const lifecycleStart = Date.now()

      // 階段1: 注入和初始化
      const injectionResult = await extensionController.injectContentScript()
      expect(injectionResult.success).toBe(true)

      const initializationResult = await extensionController.waitForContentScriptInitialization({
        timeout: 5000
      })
      expect(initializationResult.initialized).toBe(true)

      // 階段2: 執行主要功能
      const extractionResult = await extensionController.executeContentScriptExtraction()
      expect(extractionResult.success).toBe(true)
      expect(extractionResult.extractedCount).toBe(100)

      // 階段3: 清理和卸載
      const cleanupResult = await extensionController.cleanupContentScript()
      expect(cleanupResult.cleaned).toBe(true)

      const lifecycleTime = Date.now() - lifecycleStart

      // 獲取生命周期分析結果
      const lifecycleAnalysis = await injectionAnalyzer.getLifecycleAnalysis()

      // Then: 驗證生命周期管理
      expect(lifecycleTime).toBeLessThan(15000) // 完整週期<15秒

      // 檢查各階段時間分配
      const phases = lifecycleAnalysis.phases
      expect(phases.injection.duration).toBeLessThan(2000) // 注入<2秒
      expect(phases.initialization.duration).toBeLessThan(1000) // 初始化<1秒
      expect(phases.execution.duration).toBeLessThan(10000) // 執行<10秒
      expect(phases.cleanup.duration).toBeLessThan(500) // 清理<500ms

      // 驗證資源管理
      expect(lifecycleAnalysis.resourceManagement.memoryLeaks).toBe(0)
      expect(lifecycleAnalysis.resourceManagement.unreleased.eventListeners).toBe(0)
      expect(lifecycleAnalysis.resourceManagement.unreleased.timers).toBe(0)
      expect(lifecycleAnalysis.resourceManagement.unreleased.domReferences).toBe(0)

      // 檢查錯誤處理
      expect(lifecycleAnalysis.errorHandling.unhandledErrors).toBe(0)
      expect(lifecycleAnalysis.errorHandling.recoveredErrors).toBeGreaterThanOrEqual(0)
    })

    test('應該支援多個分頁的Content Script並發管理', async () => {
      // Given: 建立多個分頁環境
      const tabConfigs = [
        {
          url: 'https://readmoo.com/library',
          books: testDataGenerator.generateBooks(80, 'tab1-books'),
          expectedFeatures: ['extraction', 'progress_tracking']
        },
        {
          url: 'https://readmoo.com/library?category=fiction',
          books: testDataGenerator.generateBooks(60, 'tab2-books'),
          expectedFeatures: ['extraction', 'category_filtering']
        },
        {
          url: 'https://readmoo.com/search?q=technical',
          books: testDataGenerator.generateBooks(40, 'tab3-books'),
          expectedFeatures: ['search_extraction', 'result_processing']
        }
      ]

      // 建立多個分頁
      const tabs = []
      for (let i = 0; i < tabConfigs.length; i++) {
        const tab = await testSuite.createNewTab(tabConfigs[i].url)
        await testSuite.injectMockBooks(tabConfigs[i].books, tab.id)
        tabs.push({ ...tab, config: tabConfigs[i] })
      }

      // When: 在所有分頁同時注入和執行Content Scripts
      const concurrentPromises = tabs.map(async (tab, index) => {
        const tabStart = Date.now()

        // 注入Content Script
        const injectionResult = await extensionController.injectContentScriptInTab(tab.id)

        // 執行提取
        const extractionResult = await extensionController.executeExtractionInTab(tab.id)

        const tabTime = Date.now() - tabStart

        return {
          tabIndex: index,
          tabId: tab.id,
          injectionSuccess: injectionResult.success,
          extractionSuccess: extractionResult.success,
          extractedCount: extractionResult.extractedCount,
          expectedCount: tab.config.books.length,
          executionTime: tabTime
        }
      })

      const concurrentResults = await Promise.all(concurrentPromises)

      // Then: 驗證並發執行結果
      concurrentResults.forEach((result, index) => {
        expect(result.injectionSuccess).toBe(true)
        expect(result.extractionSuccess).toBe(true)
        expect(result.extractedCount).toBe(result.expectedCount)
        expect(result.executionTime).toBeLessThan(12000) // 單個分頁<12秒
      })

      // 檢查並發執行效能
      const maxExecutionTime = Math.max(...concurrentResults.map(r => r.executionTime))
      const avgExecutionTime = concurrentResults.reduce((sum, r) => sum + r.executionTime, 0) / concurrentResults.length

      expect(maxExecutionTime).toBeLessThan(15000) // 最慢的<15秒
      expect(avgExecutionTime).toBeLessThan(10000) // 平均<10秒

      // 驗證資源隔離
      const resourceIsolationCheck = await scriptValidator.validateResourceIsolation(tabs.map(t => t.id))
      expect(resourceIsolationCheck.isolated).toBe(true)
      expect(resourceIsolationCheck.crossTabInterference).toBe(false)

      // 清理分頁
      for (const tab of tabs) {
        await testSuite.closeTab(tab.id)
      }
    })

    test('應該處理頁面重新載入和Content Script重新注入', async () => {
      // Given: 設置頁面重載測試環境
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(70, 'reload-test'))

      // 初始注入和執行
      const initialInjection = await extensionController.injectContentScript()
      expect(initialInjection.success).toBe(true)

      const initialState = await extensionController.getContentScriptState()
      expect(initialState.active).toBe(true)
      expect(initialState.initialized).toBe(true)

      // When: 模擬頁面重新載入
      const reloadStart = Date.now()

      // 重新載入頁面
      await testSuite.reloadCurrentPage()

      // 檢測Content Script狀態
      const postReloadState = await extensionController.getContentScriptState()
      expect(postReloadState.active).toBe(false) // 重載後應該不活躍

      // 重新注入Content Script
      const reinjectionResult = await extensionController.reinjectContentScript({
        detectPreviousScript: true,
        cleanupBefore: true,
        validateAfter: true
      })

      const reloadTime = Date.now() - reloadStart

      // Then: 驗證重新注入結果
      expect(reinjectionResult.success).toBe(true)
      expect(reinjectionResult.previousScriptDetected).toBe(false) // 重載後舊腳本應該消失
      expect(reinjectionResult.cleanupPerformed).toBe(true)
      expect(reloadTime).toBeLessThan(8000) // 重載和重注入<8秒

      // 驗證重新注入後的功能性
      const postReinjectionTest = await extensionController.testContentScriptFunctionality()
      expect(postReinjectionTest.functional).toBe(true)
      expect(postReinjectionTest.canExtract).toBe(true)
      expect(postReinjectionTest.canCommunicate).toBe(true)

      // 測試實際提取功能
      const extractionAfterReload = await extensionController.executeContentScriptExtraction()
      expect(extractionAfterReload.success).toBe(true)
      expect(extractionAfterReload.extractedCount).toBe(70)

      // 檢查狀態一致性
      const finalState = await extensionController.getContentScriptState()
      expect(finalState.active).toBe(true)
      expect(finalState.initialized).toBe(true)
      expect(finalState.version).toBeDefined()
    })
  })

  describe('Content Script安全性和隔離性', () => {
    test('應該維持Content Script與頁面JavaScript的隔離', async () => {
      // Given: 建立具有複雜JavaScript環境的測試頁面
      await testSuite.setupComplexJSEnvironmentPage({
        globalVariables: ['readmooData', 'bookList', 'userSettings'],
        libraryConflicts: ['jQuery', 'lodash', 'moment'],
        eventListeners: ['click', 'scroll', 'resize'],
        timers: 5,
        domModifications: true
      })

      await testSuite.injectMockBooks(testDataGenerator.generateBooks(50, 'isolation-test'))

      // When: 注入Content Script並執行功能
      const isolationStart = Date.now()

      const injectionResult = await extensionController.injectContentScript()
      expect(injectionResult.success).toBe(true)

      // 執行可能與頁面環境衝突的操作
      const isolationTests = [
        {
          test: 'variable_namespace_isolation',
          action: async () => {
            return await extensionController.testVariableIsolation([
              'readmooData', 'bookList', 'userSettings'
            ])
          }
        },
        {
          test: 'library_conflict_prevention',
          action: async () => {
            return await extensionController.testLibraryConflicts([
              'jQuery', 'lodash', 'moment'
            ])
          }
        },
        {
          test: 'event_listener_isolation',
          action: async () => {
            return await extensionController.testEventIsolation([
              'click', 'scroll', 'resize'
            ])
          }
        },
        {
          test: 'dom_modification_safety',
          action: async () => {
            return await extensionController.testDOMModificationSafety()
          }
        }
      ]

      const isolationResults = []

      for (const isolationTest of isolationTests) {
        const testStart = Date.now()
        const testResult = await isolationTest.action()
        const testTime = Date.now() - testStart

        isolationResults.push({
          testName: isolationTest.test,
          passed: testResult.passed,
          isolated: testResult.isolated,
          conflicts: testResult.conflicts,
          testTime
        })
      }

      const isolationTime = Date.now() - isolationStart

      // Then: 驗證隔離性結果
      expect(isolationTime).toBeLessThan(10000) // 隔離測試<10秒

      isolationResults.forEach(result => {
        expect(result.passed).toBe(true)
        expect(result.isolated).toBe(true)
        expect(result.conflicts.length).toBe(0)
        expect(result.testTime).toBeLessThan(3000)
      })

      // 檢查全域污染
      const globalPollutionCheck = await extensionController.checkGlobalPollution()
      expect(globalPollutionCheck.polluted).toBe(false)
      expect(globalPollutionCheck.addedGlobals).toEqual([])
      expect(globalPollutionCheck.modifiedGlobals).toEqual([])

      // 驗證頁面功能未受影響
      const pageFunctionalityCheck = await scriptValidator.validatePageFunctionality()
      expect(pageFunctionalityCheck.functional).toBe(true)
      expect(pageFunctionalityCheck.originalBehaviorMaintained).toBe(true)

      // 最終功能性驗證
      const extractionResult = await extensionController.executeContentScriptExtraction()
      expect(extractionResult.success).toBe(true)
      expect(extractionResult.extractedCount).toBe(50)
    })

    test('應該正確處理Content Security Policy限制', async () => {
      // Given: 準備具有不同CSP等級的頁面
      const cspTestScenarios = [
        {
          name: 'strict_csp',
          cspPolicy: "default-src 'self'; script-src 'self'; object-src 'none';",
          expectedBehavior: 'injection_blocked',
          fallbackAvailable: false
        },
        {
          name: 'moderate_csp',
          cspPolicy: "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval';",
          expectedBehavior: 'limited_injection',
          fallbackAvailable: true
        },
        {
          name: 'extension_allowed_csp',
          cspPolicy: "default-src 'self'; script-src 'self' chrome-extension:;",
          expectedBehavior: 'normal_injection',
          fallbackAvailable: false
        },
        {
          name: 'no_csp',
          cspPolicy: null,
          expectedBehavior: 'normal_injection',
          fallbackAvailable: false
        }
      ]

      const cspHandlingResults = []

      for (const scenario of cspTestScenarios) {
        // When: 設置特定CSP環境並測試注入
        await testSuite.setupCSPTestPage({
          cspPolicy: scenario.cspPolicy,
          pageContent: testDataGenerator.generateBooks(30, `csp-${scenario.name}-test`)
        })

        const cspTestStart = Date.now()

        const injectionResult = await extensionController.attemptContentScriptInjection({
          enableCSPDetection: true,
          enableFallbackMethods: scenario.fallbackAvailable,
          detectCSPViolations: true
        })

        const cspTestTime = Date.now() - cspTestStart

        console.log(`🔧 測試結果映射 ${scenario.name}: injectionResult.cspViolationDetected=${injectionResult.cspViolationDetected}, injectionResult.behavior=${injectionResult.behavior}, injectionResult.success=${injectionResult.success}`)

        cspHandlingResults.push({
          scenario: scenario.name,
          expectedBehavior: scenario.expectedBehavior,
          actualBehavior: injectionResult.behavior,
          injectionSuccess: injectionResult.success,
          cspViolationDetected: injectionResult.cspViolationDetected,
          fallbackUsed: injectionResult.fallbackUsed,
          testTime: cspTestTime
        })
      }

      // Then: 驗證CSP處理結果
      cspHandlingResults.forEach(result => {
        expect(result.testTime).toBeLessThan(5000) // CSP測試<5秒

        switch (result.expectedBehavior) {
          case 'injection_blocked':
            expect(result.injectionSuccess).toBe(false)
            expect(result.cspViolationDetected).toBe(true)
            break

          case 'limited_injection':
            expect(result.injectionSuccess).toBe(true)
            expect(result.fallbackUsed).toBe(true)
            break

          case 'normal_injection':
            expect(result.injectionSuccess).toBe(true)
            expect(result.cspViolationDetected).toBe(false)
            break
        }

        expect(result.actualBehavior).toBe(result.expectedBehavior)
      })

      // 檢查CSP處理策略效果
      const blockedScenarios = cspHandlingResults.filter(r => r.expectedBehavior === 'injection_blocked')
      const fallbackScenarios = cspHandlingResults.filter(r => r.fallbackUsed)

      if (blockedScenarios.length > 0) {
        blockedScenarios.forEach(scenario => {
          expect(scenario.cspViolationDetected).toBe(true)
          expect(scenario.injectionSuccess).toBe(false)
        })
      }

      if (fallbackScenarios.length > 0) {
        fallbackScenarios.forEach(scenario => {
          expect(scenario.injectionSuccess).toBe(true)
          expect(scenario.fallbackUsed).toBe(true)
        })
      }
    })

    test('應該防護惡意頁面對Content Script的干擾', async () => {
      // Given: 設置包含潛在惡意行為的測試頁面
      const maliciousInterferenceTypes = [
        {
          type: 'dom_manipulation',
          description: '惡意DOM修改',
          setup: async () => {
            await testSuite.setupMaliciousPage({
              behavior: 'aggressive_dom_modification',
              targets: ['book-list', 'pagination', 'book-item']
            })
          }
        },
        {
          type: 'event_interception',
          description: '事件攔截干擾',
          setup: async () => {
            await testSuite.setupMaliciousPage({
              behavior: 'event_interception',
              interceptedEvents: ['click', 'scroll', 'load']
            })
          }
        },
        {
          type: 'global_pollution',
          description: '全域變數污染',
          setup: async () => {
            await testSuite.setupMaliciousPage({
              behavior: 'global_pollution',
              pollutedGlobals: ['document', 'window', 'console']
            })
          }
        },
        {
          type: 'script_interference',
          description: '腳本執行干擾',
          setup: async () => {
            await testSuite.setupMaliciousPage({
              behavior: 'script_interference',
              interferencePatterns: ['function_override', 'prototype_modification']
            })
          }
        }
      ]

      const securityResults = []

      for (const interferenceType of maliciousInterferenceTypes) {
        // When: 設置惡意環境並測試防護
        await interferenceType.setup()
        await testSuite.injectMockBooks(testDataGenerator.generateBooks(40, `security-${interferenceType.type}-test`))

        const securityTestStart = Date.now()

        const injectionResult = await extensionController.injectContentScript({
          enableSecurityMode: true,
          detectMaliciousBehavior: true,
          enableCountermeasures: true
        })

        // 嘗試執行提取功能
        let extractionResult = { success: false, protected: false }
        if (injectionResult.success) {
          extractionResult = await extensionController.executeContentScriptExtraction({
            securityMode: true,
            validateDOMIntegrity: true,
            detectInterference: true
          })
        }

        const securityTestTime = Date.now() - securityTestStart

        securityResults.push({
          interferenceType: interferenceType.type,
          description: interferenceType.description,
          injectionSuccess: injectionResult.success,
          securityViolationsDetected: injectionResult.securityViolations || 0,
          countermeasuresActivated: injectionResult.countermeasuresActivated || [],
          extractionProtected: extractionResult.protected,
          finalSuccess: extractionResult.success,
          securityTestTime
        })

        // 清理惡意環境
        await testSuite.clearMaliciousPage()
      }

      // Then: 驗證安全防護效果
      securityResults.forEach(result => {
        expect(result.securityTestTime).toBeLessThan(8000) // 安全測試<8秒

        // 檢查安全違規檢測
        if (result.securityViolationsDetected > 0) {
          expect(result.countermeasuresActivated.length).toBeGreaterThan(0)
        }

        // 驗證防護效果
        switch (result.interferenceType) {
          case 'dom_manipulation':
            expect(result.countermeasuresActivated).toContain('dom_protection')
            break
          case 'event_interception':
            expect(result.countermeasuresActivated).toContain('event_isolation')
            break
          case 'global_pollution':
            expect(result.countermeasuresActivated).toContain('namespace_protection')
            break
          case 'script_interference':
            expect(result.countermeasuresActivated).toContain('execution_protection')
            break
        }

        // 大多數情況下應該能夠成功防護
        expect(result.extractionProtected).toBe(true)
      })

      // 檢查整體安全性表現
      const protectedCount = securityResults.filter(r => r.extractionProtected).length
      const protectionRate = protectedCount / securityResults.length

      expect(protectionRate).toBeGreaterThan(0.8) // 防護成功率>80%

      const avgSecurityResponseTime = securityResults.reduce((sum, r) => sum + r.securityTestTime, 0) / securityResults.length
      expect(avgSecurityResponseTime).toBeLessThan(6000) // 平均安全響應<6秒
    })
  })
})
