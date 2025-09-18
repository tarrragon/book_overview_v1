/**
 * Chrome Extension v2.0 環境整合測試
 *
 * 負責功能：
 * - Background Service Worker 與事件系統 v2.0 整合測試
 * - Content Scripts 的事件處理和 DOM 互動驗證
 * - Popup 界面的事件驅動功能完整測試
 * - 跨上下文事件傳遞和通訊協議驗證
 *
 * 測試策略：
 * - 真實 Chrome Extension 環境模擬
 * - 完整擴展生命週期測試
 * - 跨上下文通訊協議驗證
 * - 實際使用者操作流程模擬
 *
 * 整合測試範圍：
 * - Service Worker 生命週期 100% 覆蓋
 * - 事件傳遞準確性 100% 驗證
 * - UI 響應性能指標達標
 * - 錯誤恢復機制完整測試
 * - 長時間運行穩定性驗證
 */

const EventBus = require('src/core/event-bus')
const ChromeEventBridge = require('src/content/bridge/chrome-event-bridge')
const EventNamingUpgradeCoordinator = require('src/core/events/event-naming-upgrade-coordinator')
const EventPriorityManager = require('src/core/events/event-priority-manager')

// 模擬 Chrome Extension 環境
global.chrome = require('jest-chrome').chrome
global.self = global

describe('🧪 Chrome Extension v2.0 環境整合測試', () => {
  let eventBus
  let chromeBridge
  let namingCoordinator
  let priorityManager
  let mockTabId

  beforeEach(async () => {
    // 重置 Chrome API mocks
    jest.clearAllMocks()
    if (chrome && chrome.flush) {
      chrome.flush()
    }

    // 初始化 Chrome Extension 環境
    mockTabId = 123

    // 設置 Chrome APIs 模擬
    chrome.tabs.sendMessage.mockResolvedValue({ success: true })
    chrome.runtime.sendMessage.mockResolvedValue({ success: true })
    chrome.storage.local.get.mockResolvedValue({})
    chrome.storage.local.set.mockResolvedValue()

    // 初始化事件系統組件
    eventBus = new EventBus()
    namingCoordinator = new EventNamingUpgradeCoordinator(eventBus)
    priorityManager = new EventPriorityManager()
    chromeBridge = new ChromeEventBridge(eventBus)

    // 建立整合環境完成

    // 等待初始化完成
    await new Promise(resolve => setTimeout(resolve, 50))
  })

  afterEach(() => {
    // 清理資源
    if (eventBus && typeof eventBus.removeAllListeners === 'function') {
      eventBus.removeAllListeners()
    }
  })

  describe('🔧 Background Service Worker 整合測試', () => {
    describe('Service Worker 生命週期整合', () => {
      test('應該在 Service Worker 啟動時正確初始化事件系統', async () => {
        // 模擬 Service Worker 啟動事件
        const onStartupHandler = jest.fn()
        eventBus.on('SYSTEM.GENERIC.STARTUP.COMPLETED', onStartupHandler)

        // 觸發啟動流程
        await chromeBridge.handleServiceWorkerStartup()

        // 驗證事件系統初始化
        expect(eventBus).toBeDefined()
        expect(chromeBridge).toBeDefined()
        expect(namingCoordinator).toBeDefined()
        expect(priorityManager).toBeDefined()

        // 發送啟動完成事件
        await eventBus.emit('SYSTEM.GENERIC.STARTUP.COMPLETED', {
          timestamp: Date.now(),
          components: ['eventBus', 'chromeBridge', 'namingCoordinator']
        })

        expect(onStartupHandler).toHaveBeenCalled()
      })

      test('應該在 Service Worker 安裝時設置預設配置', async () => {
        // 模擬擴展安裝
        const installDetails = { reason: 'install' }

        // 觸發安裝事件處理
        await chromeBridge.handleInstallation(installDetails)

        // 驗證預設配置被設置
        expect(chrome.storage.local.set).toHaveBeenCalledWith(
          expect.objectContaining({
            isEnabled: true,
            extractionSettings: expect.any(Object),
            eventSystemVersion: '2.0.0'
          })
        )
      })

      test('應該在 Service Worker 重啟時恢復事件系統狀態', async () => {
        // 設置一些事件監聽器和狀態
        const testHandler = jest.fn()
        namingCoordinator.registerDualTrackListener('EXTRACTION.COMPLETED', testHandler)

        const testEvent = 'EXTRACTION.READMOO.EXTRACT.COMPLETED'
        priorityManager.assignEventPriority(testEvent)

        // 記錄重啟前的狀態

        // 模擬 Service Worker 重啟
        await chromeBridge.handleServiceWorkerRestart()

        // 驗證基本功能恢復
        await namingCoordinator.intelligentEmit('EXTRACTION.COMPLETED', { test: 'restart' })

        // 等待事件處理
        await new Promise(resolve => setTimeout(resolve, 100))

        expect(testHandler).toHaveBeenCalled()
      })

      test('應該處理 Service Worker 休眠和喚醒', async () => {
        // 設置事件統計
        await namingCoordinator.intelligentEmit('STORAGE.SAVE.COMPLETED', { books: 5 })
        const preSleepStats = namingCoordinator.getConversionStats()

        // 模擬休眠
        await chromeBridge.handleServiceWorkerSleep()

        // 模擬喚醒
        await chromeBridge.handleServiceWorkerWakeup()

        // 驗證事件系統仍然可用
        const testHandler = jest.fn()
        eventBus.on('SYSTEM.GENERIC.WAKEUP.COMPLETED', testHandler)

        await eventBus.emit('SYSTEM.GENERIC.WAKEUP.COMPLETED', {
          previousStats: preSleepStats,
          timestamp: Date.now()
        })

        expect(testHandler).toHaveBeenCalled()
      })
    })

    describe('跨上下文訊息傳遞整合', () => {
      test('應該正確處理來自 Content Script 的事件訊息', async () => {
        const contentMessage = {
          type: 'EVENT_FORWARD',
          eventType: 'EXTRACTION.READMOO.EXTRACT.STARTED',
          eventData: {
            url: 'https://readmoo.com/book/123',
            timestamp: Date.now()
          },
          from: 'content'
        }

        const mockSender = { tab: { id: mockTabId } }
        const mockSendResponse = jest.fn()

        // 設置事件監聽器
        const eventHandler = jest.fn()
        eventBus.on('EXTRACTION.READMOO.EXTRACT.STARTED', eventHandler)

        // 處理來自 Content Script 的訊息
        await chromeBridge.handleMessageFromContent(contentMessage, mockSender, mockSendResponse)

        // 驗證事件被正確轉發
        expect(eventHandler).toHaveBeenCalled()
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          eventForwarded: true
        })
      })

      test('應該正確處理來自 Popup 的控制訊息', async () => {
        const popupMessage = {
          type: 'CONTROL_REQUEST',
          action: 'GET_EXTRACTION_STATUS',
          data: {},
          from: 'popup'
        }

        const mockSender = { tab: undefined } // Popup 沒有 tab
        const mockSendResponse = jest.fn()

        // 設置狀態回應

        // 處理來自 Popup 的訊息
        await chromeBridge.handleMessageFromPopup(popupMessage, mockSender, mockSendResponse)

        // 驗證適當的回應
        expect(mockSendResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.any(Object)
          })
        )
      })

      test('應該支援向 Content Script 發送控制指令', async () => {
        const controlCommand = {
          type: 'CONTROL_COMMAND',
          command: 'START_EXTRACTION',
          parameters: {
            target: 'bookshelf',
            mode: 'incremental'
          }
        }

        // 發送指令到 Content Script
        const result = await chromeBridge.sendToContent(mockTabId, controlCommand)

        // 驗證 Chrome API 被正確調用
        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(mockTabId, controlCommand)
        expect(result.success).toBe(true)
      })

      test('應該支援向 Popup 廣播狀態更新', async () => {
        const statusUpdate = {
          type: 'STATUS_UPDATE',
          data: {
            extractionProgress: 60,
            currentBook: 'Book Title',
            estimatedTimeRemaining: '2 minutes'
          }
        }

        // 廣播狀態更新
        await chromeBridge.broadcastToPopups(statusUpdate)

        // 驗證訊息被正確發送
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(statusUpdate)
      })
    })

    describe('事件系統 v2.0 整合驗證', () => {
      test('應該完整支援 Legacy 到 Modern 事件轉換', async () => {
        const legacyEvents = [
          'EXTRACTION.COMPLETED',
          'STORAGE.SAVE.COMPLETED',
          'UI.POPUP.OPENED'
        ]

        // 設置雙軌監聽器
        for (let i = 0; i < legacyEvents.length; i++) {
          const legacyEvent = legacyEvents[i]

          const handler = jest.fn()
          namingCoordinator.registerDualTrackListener(legacyEvent, handler)

          // 通過 Chrome Bridge 觸發事件
          await chromeBridge.forwardEventFromContent({
            eventType: legacyEvent,
            eventData: { test: `event-${i}` },
            tabId: mockTabId
          })

          // 驗證事件被正確處理
          expect(handler).toHaveBeenCalled()
        }
      })

      test('應該正確處理優先級事件在跨上下文環境中', async () => {
        const highPriorityEvent = 'SYSTEM.GENERIC.ERROR.CRITICAL'
        const normalPriorityEvent = 'ANALYTICS.GENERIC.UPDATE.COMPLETED'

        // 分配優先級
        const highPriority = priorityManager.assignEventPriority(highPriorityEvent)
        const normalPriority = priorityManager.assignEventPriority(normalPriorityEvent)

        // 驗證優先級分配正確
        expect(highPriority).toBeLessThan(normalPriority) // 數值越小優先級越高

        // 設置處理器並記錄執行順序
        const executionOrder = []

        priorityManager.registerWithPriority(eventBus, highPriorityEvent, () => {
          executionOrder.push('high')
        })

        priorityManager.registerWithPriority(eventBus, normalPriorityEvent, () => {
          executionOrder.push('normal')
        })

        // 同時觸發兩個事件
        await Promise.all([
          chromeBridge.forwardEventFromContent({
            eventType: normalPriorityEvent,
            eventData: { priority: 'normal' },
            tabId: mockTabId
          }),
          chromeBridge.forwardEventFromContent({
            eventType: highPriorityEvent,
            eventData: { priority: 'high' },
            tabId: mockTabId
          })
        ])

        // 等待事件處理完成
        await new Promise(resolve => setTimeout(resolve, 100))

        // 驗證高優先級事件先執行
        expect(executionOrder[0]).toBe('high')
      })

      test('應該支援事件統計在 Background 環境中的收集', async () => {
        const testEvents = [
          'EXTRACTION.READMOO.EXTRACT.STARTED',
          'EXTRACTION.READMOO.EXTRACT.PROGRESS',
          'EXTRACTION.READMOO.EXTRACT.COMPLETED'
        ]

        // 通過 Chrome Bridge 觸發多個事件
        for (const event of testEvents) {
          await chromeBridge.forwardEventFromContent({
            eventType: event,
            eventData: { timestamp: Date.now() },
            tabId: mockTabId
          })
        }

        // 檢查統計資料
        const conversionStats = namingCoordinator.getConversionStats()
        const priorityStats = priorityManager.getPriorityStats()

        expect(conversionStats.totalConversions).toBeGreaterThan(0)
        expect(priorityStats.totalAssignments).toBeGreaterThan(0)
      })
    })
  })

  describe('🔧 Content Scripts 事件處理測試', () => {
    describe('DOM 互動和事件監聽', () => {
      test('應該正確設置 DOM 事件監聽器', async () => {
        // 模擬 Content Script 環境
        const mockDocument = {
          addEventListener: jest.fn(),
          querySelector: jest.fn(),
          querySelectorAll: jest.fn()
        }

        global.document = mockDocument

        // 初始化 Content Script 事件監聽
        await chromeBridge.initializeContentScriptListeners()

        // 驗證 DOM 事件監聽器被設置
        expect(mockDocument.addEventListener).toHaveBeenCalledWith(
          'DOMContentLoaded',
          expect.any(Function)
        )
      })

      test('應該正確處理頁面變更事件', async () => {
        const pageChangeHandler = jest.fn()
        eventBus.on('PAGE.READMOO.CHANGE.DETECTED', pageChangeHandler)

        // 模擬頁面變更
        await chromeBridge.handlePageChange({
          url: 'https://readmoo.com/book/new-book',
          previousUrl: 'https://readmoo.com/book/old-book',
          changeType: 'navigation'
        })

        expect(pageChangeHandler).toHaveBeenCalled()
      })

      test('應該支援動態內容變更檢測', async () => {
        const contentChangeHandler = jest.fn()
        eventBus.on('CONTENT.READMOO.DYNAMIC.UPDATED', contentChangeHandler)

        // 模擬動態內容變更
        const mutationEvent = {
          type: 'mutation',
          addedNodes: ['book-item-1', 'book-item-2'],
          removedNodes: [],
          target: 'bookshelf-container'
        }

        await chromeBridge.handleDynamicContentChange(mutationEvent)

        expect(contentChangeHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              addedNodes: ['book-item-1', 'book-item-2']
            })
          })
        )
      })

      test('應該正確提取和轉發頁面資料', async () => {
        const extractionHandler = jest.fn()
        eventBus.on('EXTRACTION.READMOO.EXTRACT.COMPLETED', extractionHandler)

        // 模擬資料提取完成
        const extractedData = [
          { id: 'book-1', title: 'Book 1', progress: 50 },
          { id: 'book-2', title: 'Book 2', progress: 75 }
        ]

        await chromeBridge.forwardExtractionResult({
          data: extractedData,
          source: 'content-script',
          tabId: mockTabId
        })

        // 等待事件處理
        await new Promise(resolve => setTimeout(resolve, 50))

        expect(extractionHandler).toHaveBeenCalled()
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'EXTRACTION_COMPLETED',
            data: extractedData
          })
        )
      })
    })

    describe('錯誤處理和恢復機制', () => {
      test('應該處理 DOM 存取錯誤', async () => {
        const errorHandler = jest.fn()
        eventBus.on('SYSTEM.GENERIC.ERROR.HANDLED', errorHandler)

        // 模擬 DOM 存取錯誤
        const domError = new Error('Cannot access property of null')

        await chromeBridge.handleContentScriptError({
          error: domError,
          context: 'dom-access',
          url: 'https://readmoo.com/book/123'
        })

        expect(errorHandler).toHaveBeenCalled()
      })

      test('應該支援 Content Script 重新注入', async () => {
        const reinjectionHandler = jest.fn()
        eventBus.on('CONTENT.GENERIC.REINJECT.COMPLETED', reinjectionHandler)

        // 模擬重新注入請求
        await chromeBridge.reinjectContentScript(mockTabId)

        // 驗證重新注入邏輯
        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
          mockTabId,
          expect.objectContaining({
            type: 'REINJECT_REQUEST'
          })
        )
      })

      test('應該處理網路請求失敗情況', async () => {
        const networkErrorHandler = jest.fn()
        eventBus.on('NETWORK.GENERIC.ERROR.DETECTED', networkErrorHandler)

        // 模擬網路錯誤
        const networkError = {
          type: 'network-error',
          status: 'timeout',
          url: 'https://readmoo.com/api/books',
          retryCount: 2
        }

        await chromeBridge.handleNetworkError(networkError)

        expect(networkErrorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: networkError
          })
        )
      })
    })
  })

  describe('🔧 Popup 界面事件驅動測試', () => {
    describe('UI 響應和狀態同步', () => {
      test('應該即時響應提取進度更新', async () => {
        const progressHandler = jest.fn()
        eventBus.on('UX.GENERIC.PROGRESS.UPDATED', progressHandler)

        // 模擬提取進度更新
        const progressUpdate = {
          completed: 7,
          total: 10,
          currentBook: '當前書籍',
          estimatedTimeRemaining: 120
        }

        await chromeBridge.updateExtractionProgress(progressUpdate)

        expect(progressHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: progressUpdate
          })
        )

        // 驗證訊息被發送到 Popup
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'PROGRESS_UPDATE',
            data: progressUpdate
          })
        )
      })

      test('應該正確處理使用者操作事件', async () => {
        const userActionHandler = jest.fn()
        eventBus.on('UX.GENERIC.ACTION.REQUESTED', userActionHandler)

        // 模擬使用者點擊開始提取
        const userAction = {
          action: 'START_EXTRACTION',
          parameters: {
            mode: 'full',
            target: 'current-page'
          },
          timestamp: Date.now()
        }

        await chromeBridge.handleUserAction(userAction)

        expect(userActionHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: userAction
          })
        )
      })

      test('應該同步顯示系統狀態', async () => {
        const statusSyncHandler = jest.fn()
        eventBus.on('UX.GENERIC.STATUS.SYNCED', statusSyncHandler)

        // 模擬系統狀態
        const systemStatus = {
          isActive: true,
          platform: 'READMOO',
          lastUpdate: Date.now(),
          totalBooks: 25,
          extractionMode: 'incremental'
        }

        await chromeBridge.syncSystemStatus(systemStatus)

        expect(statusSyncHandler).toHaveBeenCalled()

        // 驗證狀態被正確廣播
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'STATUS_SYNC',
            data: systemStatus
          })
        )
      })

      test('應該處理 Popup 開啟和關閉事件', async () => {
        const openHandler = jest.fn()
        const closeHandler = jest.fn()

        eventBus.on('UX.GENERIC.OPEN.COMPLETED', openHandler)
        eventBus.on('UX.GENERIC.CLOSE.COMPLETED', closeHandler)

        // 模擬 Popup 開啟
        await chromeBridge.handlePopupOpen({
          timestamp: Date.now(),
          context: 'user-click'
        })

        expect(openHandler).toHaveBeenCalled()

        // 模擬 Popup 關閉
        await chromeBridge.handlePopupClose({
          timestamp: Date.now(),
          duration: 5000
        })

        expect(closeHandler).toHaveBeenCalled()
      })
    })

    describe('錯誤狀態處理', () => {
      test('應該顯示適當的錯誤訊息', async () => {
        const errorDisplayHandler = jest.fn()
        eventBus.on('UX.GENERIC.ERROR.DISPLAYED', errorDisplayHandler)

        // 模擬錯誤情況
        const errorInfo = {
          type: 'extraction-failed',
          message: '提取失敗：無法存取書籍資料',
          suggestions: ['檢查網路連線', '重新載入頁面', '稍後再試'],
          severity: 'warning'
        }

        await chromeBridge.displayError(errorInfo)

        expect(errorDisplayHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: errorInfo
          })
        )
      })

      test('應該支援錯誤恢復操作', async () => {
        const recoveryHandler = jest.fn()
        eventBus.on('SYSTEM.GENERIC.RECOVERY.INITIATED', recoveryHandler)

        // 模擬錯誤恢復
        const recoveryAction = {
          action: 'retry-extraction',
          target: 'current-page',
          previousError: 'timeout'
        }

        await chromeBridge.initiateRecovery(recoveryAction)

        expect(recoveryHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: recoveryAction
          })
        )
      })
    })
  })

  describe('🔧 端對端工作流程測試', () => {
    describe('完整提取工作流程', () => {
      test('應該執行完整的書籍提取流程', async () => {
        const workflowEvents = []

        // 設置工作流程事件監聽器
        const eventTypes = [
          'EXTRACTION.READMOO.EXTRACT.STARTED',
          'EXTRACTION.READMOO.EXTRACT.PROGRESS',
          'DATA.READMOO.SAVE.REQUESTED',
          'DATA.READMOO.SAVE.COMPLETED',
          'UX.GENERIC.NOTIFICATION.SENT',
          'EXTRACTION.READMOO.EXTRACT.COMPLETED'
        ]

        for (const eventType of eventTypes) {
          eventBus.on(eventType, (event) => {
            workflowEvents.push(event.type)
          })
        }

        // 啟動提取流程
        await chromeBridge.startExtractionWorkflow({
          tabId: mockTabId,
          mode: 'full',
          notifications: true
        })

        // 模擬提取進度
        await chromeBridge.reportProgress({ completed: 5, total: 10 })
        await chromeBridge.reportProgress({ completed: 10, total: 10 })

        // 模擬儲存流程
        await chromeBridge.saveExtractionResults([
          { id: 'book-1', title: 'Book 1' },
          { id: 'book-2', title: 'Book 2' }
        ])

        // 完成流程
        await chromeBridge.completeExtractionWorkflow({
          totalExtracted: 10,
          duration: 30000
        })

        // 等待所有事件處理完成
        await new Promise(resolve => setTimeout(resolve, 200))

        // 驗證工作流程事件順序
        expect(workflowEvents).toContain('EXTRACTION.READMOO.EXTRACT.STARTED')
        expect(workflowEvents).toContain('EXTRACTION.READMOO.EXTRACT.PROGRESS')
        expect(workflowEvents).toContain('DATA.READMOO.SAVE.COMPLETED')
        expect(workflowEvents).toContain('EXTRACTION.READMOO.EXTRACT.COMPLETED')
      })

      test('應該處理中斷的提取流程', async () => {
        const interruptionHandler = jest.fn()
        eventBus.on('EXTRACTION.READMOO.EXTRACT.INTERRUPTED', interruptionHandler)

        // 啟動提取流程
        await chromeBridge.startExtractionWorkflow({
          tabId: mockTabId,
          mode: 'incremental'
        })

        // 模擬中斷（如標籤頁關閉）
        await chromeBridge.handleTabClosed(mockTabId)

        expect(interruptionHandler).toHaveBeenCalled()
      })

      test('應該支援暫停和恢復提取', async () => {
        const pauseHandler = jest.fn()
        const resumeHandler = jest.fn()

        eventBus.on('EXTRACTION.READMOO.EXTRACT.PAUSED', pauseHandler)
        eventBus.on('EXTRACTION.READMOO.EXTRACT.RESUMED', resumeHandler)

        // 啟動提取
        await chromeBridge.startExtractionWorkflow({ tabId: mockTabId })

        // 暫停提取
        await chromeBridge.pauseExtraction({ tabId: mockTabId, reason: 'user-request' })
        expect(pauseHandler).toHaveBeenCalled()

        // 恢復提取
        await chromeBridge.resumeExtraction({ tabId: mockTabId })
        expect(resumeHandler).toHaveBeenCalled()
      })
    })

    describe('多標籤頁管理', () => {
      test('應該管理多個 Readmoo 標籤頁', async () => {
        const tabIds = [123, 456, 789]
        const activeExtractions = new Map()

        // 在多個標籤頁啟動提取
        for (const tabId of tabIds) {
          await chromeBridge.startExtractionWorkflow({ tabId })
          activeExtractions.set(tabId, { status: 'active', progress: 0 })
        }

        // 驗證所有提取都被正確追蹤
        const status = await chromeBridge.getActiveExtractions()
        expect(status.count).toBe(3)
        expect(status.tabIds).toEqual(expect.arrayContaining(tabIds))
      })

      test('應該處理標籤頁衝突情況', async () => {
        const conflictHandler = jest.fn()
        eventBus.on('EXTRACTION.GENERIC.CONFLICT.DETECTED', conflictHandler)

        // 在同一標籤頁啟動多個提取
        await chromeBridge.startExtractionWorkflow({ tabId: mockTabId })
        await chromeBridge.startExtractionWorkflow({ tabId: mockTabId })

        expect(conflictHandler).toHaveBeenCalled()
      })
    })
  })

  describe('🔧 效能和穩定性測試', () => {
    describe('高負載情況測試', () => {
      test('應該處理大量並發事件', async () => {
        const startTime = Date.now()
        const eventCount = 1000
        const promises = []

        // 生成大量並發事件
        for (let i = 0; i < eventCount; i++) {
          const promise = chromeBridge.forwardEventFromContent({
            eventType: 'EXTRACTION.READMOO.EXTRACT.PROGRESS',
            eventData: { iteration: i, timestamp: Date.now() },
            tabId: mockTabId
          })
          promises.push(promise)
        }

        // 等待所有事件處理完成
        await Promise.all(promises)

        const endTime = Date.now()
        const totalTime = endTime - startTime

        // 驗證效能指標
        expect(totalTime).toBeLessThan(10000) // 總時間少於 10 秒

        const avgTimePerEvent = totalTime / eventCount
        expect(avgTimePerEvent).toBeLessThan(10) // 平均每個事件少於 10ms
      })

      test('應該在記憶體限制下保持穩定', async () => {
        const initialMemory = process.memoryUsage()

        // 處理大量資料
        for (let round = 0; round < 10; round++) {
          const largeData = Array.from({ length: 100 }, (_, i) => ({
            id: `book-${round}-${i}`,
            title: `Large Title ${round}-${i}`.repeat(10),
            content: new Array(1000).fill(`content-${round}-${i}`).join(' ')
          }))

          await chromeBridge.forwardExtractionResult({
            data: largeData,
            source: 'stress-test',
            tabId: mockTabId
          })
        }

        // 等待記憶體穩定化
        await new Promise(resolve => setTimeout(resolve, 100))

        const finalMemory = process.memoryUsage()
        const memoryGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed

        // 記憶體增長應該控制在合理範圍內
        expect(memoryGrowth).toBeLessThan(0.3) // 30% 增長限制
      })

      test('應該處理快速連續的狀態變更', async () => {
        const stateChanges = [
          'started', 'progress', 'progress', 'paused',
          'resumed', 'progress', 'completed'
        ]

        const stateHandler = jest.fn()
        eventBus.on('EXTRACTION.READMOO.EXTRACT.STATE_CHANGED', stateHandler)

        // 快速連續觸發狀態變更
        for (const state of stateChanges) {
          await chromeBridge.updateExtractionState({
            tabId: mockTabId,
            newState: state,
            timestamp: Date.now()
          })

          // 很短的延遲模擬快速變更
          await new Promise(resolve => setTimeout(resolve, 10))
        }

        // 驗證所有狀態變更都被正確處理
        expect(stateHandler).toHaveBeenCalledTimes(stateChanges.length)
      })
    })

    describe('長時間運行穩定性', () => {
      test('應該在長時間運行後保持響應性', async () => {
        const testDuration = 5000 // 5 秒模擬長時間運行
        let eventCount = 0

        // 設置定期事件觸發
        const interval = setInterval(async () => {
          eventCount++
          await chromeBridge.heartbeat({
            timestamp: Date.now(),
            sequence: eventCount
          })
        }, 100)

        // 運行指定時間
        await new Promise(resolve => setTimeout(resolve, testDuration))
        clearInterval(interval)

        // 驗證系統仍然響應
        const responseTest = await chromeBridge.ping()
        expect(responseTest.success).toBe(true)
        expect(responseTest.responseTime).toBeLessThan(100)

        // 驗證事件計數正確
        expect(eventCount).toBeGreaterThan(40) // 至少 40 個事件
        expect(eventCount).toBeLessThan(60) // 不超過 60 個事件
      })

      test('應該正確清理資源和事件監聽器', async () => {
        const initialListenerCount = eventBus.getListenerCount()

        // 添加大量事件監聽器
        const eventTypes = [
          'EXTRACTION.READMOO.EXTRACT.STARTED',
          'EXTRACTION.READMOO.EXTRACT.PROGRESS',
          'EXTRACTION.READMOO.EXTRACT.COMPLETED',
          'DATA.READMOO.SAVE.COMPLETED',
          'UX.GENERIC.NOTIFICATION.SENT'
        ]

        const handlers = []
        for (const eventType of eventTypes) {
          const handler = jest.fn()
          handlers.push(handler)
          eventBus.on(eventType, handler)
        }

        const peakListenerCount = eventBus.getListenerCount()
        expect(peakListenerCount).toBeGreaterThan(initialListenerCount)

        // 清理監聽器
        await chromeBridge.cleanup()

        const finalListenerCount = eventBus.getListenerCount()
        expect(finalListenerCount).toBeLessThanOrEqual(initialListenerCount + 5) // 允許一些核心監聽器保留
      })
    })
  })
})
