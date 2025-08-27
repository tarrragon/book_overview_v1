/**
 * Chrome Extension Mocks Enhanced V2 測試
 * 驗證新版本Chrome API Mock系統的正確性和穩定性
 * 
 * @author Stage 3 TDD 主線程實作
 * @date 2025-08-27
 * @version v0.9.45
 */

const ChromeExtensionMocksEnhancedV2 = require('../utils/chrome-extension-mocks-enhanced-v2')

describe('ChromeExtensionMocksEnhancedV2', () => {
  let mockSystem

  beforeEach(() => {
    mockSystem = new ChromeExtensionMocksEnhancedV2()
  })

  afterEach(() => {
    if (mockSystem) {
      mockSystem.resetAllStates()
    }
  })

  describe('🔧 基礎初始化和配置', () => {
    test('應該成功初始化Mock系統', () => {
      expect(mockSystem).toBeInstanceOf(ChromeExtensionMocksEnhancedV2)
      expect(typeof mockSystem.createCompleteChromeAPI).toBe('function')
    })

    test('應該創建完整的Chrome API Mock', () => {
      const chromeAPI = mockSystem.createCompleteChromeAPI()
      
      expect(chromeAPI).toHaveProperty('storage')
      expect(chromeAPI).toHaveProperty('tabs') 
      expect(chromeAPI).toHaveProperty('runtime')
      expect(chromeAPI).toHaveProperty('extension')
    })

    test('應該正確初始化V2新功能', () => {
      const stateSnapshot = mockSystem.getStateSnapshot()
      
      expect(stateSnapshot).toHaveProperty('storage')
      expect(stateSnapshot).toHaveProperty('tabs')
      expect(stateSnapshot).toHaveProperty('runtime')
      expect(stateSnapshot).toHaveProperty('serviceWorker')
    })
  })

  describe('💾 Storage API Mock增強測試', () => {
    let chromeAPI

    beforeEach(() => {
      chromeAPI = mockSystem.createCompleteChromeAPI()
    })

    test('應該支援chrome.storage.local操作', async () => {
      const testData = { key1: 'value1', key2: 'value2' }
      
      // 設定資料
      await chromeAPI.storage.local.set(testData)
      
      // 獲取資料
      const result = await chromeAPI.storage.local.get(['key1', 'key2'])
      
      expect(result).toEqual(testData)
    })

    test('應該支援chrome.storage.sync操作', async () => {
      const testData = { syncKey: 'syncValue' }
      
      await chromeAPI.storage.sync.set(testData)
      const result = await chromeAPI.storage.sync.get('syncKey')
      
      expect(result).toEqual(testData)
    })

    test('應該正確觸發storage.onChanged事件', (done) => {
      const testData = { changeKey: 'changeValue' }
      let changeEventReceived = false
      
      // 註冊變更監聽器
      chromeAPI.storage.onChanged.addListener((changes, areaName) => {
        expect(changes).toHaveProperty('changeKey')
        expect(changes.changeKey.newValue).toBe('changeValue')
        expect(areaName).toBe('local')
        changeEventReceived = true
        done()
      })
      
      // 觸發變更
      chromeAPI.storage.local.set(testData)
    })

    test('應該支援storage.clear操作', async () => {
      // 先設定一些資料
      await chromeAPI.storage.local.set({ key1: 'value1', key2: 'value2' })
      
      // 清空storage
      await chromeAPI.storage.local.clear()
      
      // 驗證已清空
      const result = await chromeAPI.storage.local.get(['key1', 'key2'])
      expect(result).toEqual({})
    })

    test('應該支援storage.remove操作', async () => {
      // 設定資料
      await chromeAPI.storage.local.set({ key1: 'value1', key2: 'value2' })
      
      // 移除一個key
      await chromeAPI.storage.local.remove('key1')
      
      // 驗證結果
      const result = await chromeAPI.storage.local.get(['key1', 'key2'])
      expect(result).toEqual({ key2: 'value2' })
    })
  })

  describe('📑 Tabs API Mock增強測試', () => {
    let chromeAPI

    beforeEach(() => {
      chromeAPI = mockSystem.createCompleteChromeAPI()
    })

    test('應該支援tabs.query操作', async () => {
      // 創建測試標籤頁
      const tab = await chromeAPI.tabs.create({ 
        url: 'https://readmoo.com/test',
        active: true 
      })
      
      // 查詢標籤頁
      const results = await chromeAPI.tabs.query({ active: true })
      
      expect(results).toHaveLength(1)
      expect(results[0].url).toBe('https://readmoo.com/test')
      expect(results[0].active).toBe(true)
    })

    test('應該支援tabs.sendMessage操作', async () => {
      // 創建標籤頁
      const tab = await chromeAPI.tabs.create({ url: 'https://test.com' })
      
      // 設定消息處理器
      mockSystem.setTabMessageHandler(tab.id, (message) => {
        return { received: message.data }
      })
      
      // 發送消息
      const response = await chromeAPI.tabs.sendMessage(tab.id, { data: 'test message' })
      
      expect(response).toEqual({ received: 'test message' })
    })

    test('應該支援tabs.executeScript操作', async () => {
      const tab = await chromeAPI.tabs.create({ url: 'https://test.com' })
      
      const result = await chromeAPI.tabs.executeScript(tab.id, {
        code: 'document.title'
      })
      
      expect(result).toEqual([{ result: 'script executed' }])
    })
  })

  describe('🔧 Runtime API Mock增強測試', () => {
    let chromeAPI

    beforeEach(() => {
      chromeAPI = mockSystem.createCompleteChromeAPI()
    })

    test('應該支援runtime.sendMessage操作', async () => {
      const testMessage = { type: 'TEST', data: 'message data' }
      
      // 註冊消息監聽器
      chromeAPI.runtime.onMessage.addListener((message) => {
        return { echo: message.data }
      })
      
      // 發送消息
      const response = await chromeAPI.runtime.sendMessage(testMessage)
      
      expect(response).toEqual({ echo: 'message data' })
    })

    test('應該提供正確的manifest資訊', () => {
      const manifest = chromeAPI.runtime.getManifest()
      
      expect(manifest).toHaveProperty('name')
      expect(manifest).toHaveProperty('version')
      expect(manifest).toHaveProperty('manifest_version')
      expect(manifest.manifest_version).toBe(3)
    })

    test('應該有正確的extension ID', () => {
      expect(chromeAPI.runtime.id).toBe('test-extension-id')
    })
  })

  describe('🔄 Service Worker生命週期測試', () => {
    test('應該支援Service Worker安裝模擬', async () => {
      const initialState = mockSystem.getStateSnapshot()
      expect(initialState.serviceWorker.isActive).toBe(true)
      
      // 模擬安裝過程
      await mockSystem.simulateServiceWorkerInstall()
      
      const finalState = mockSystem.getStateSnapshot()
      expect(finalState.serviceWorker.isActive).toBe(true)
    })

    test('應該支援Service Worker重啟模擬', async () => {
      const chromeAPI = mockSystem.createCompleteChromeAPI()
      
      // 設定一些狀態
      await chromeAPI.storage.local.set({ testKey: 'testValue' })
      
      // 模擬重啟
      await mockSystem.simulateServiceWorkerRestart()
      
      // 驗證狀態已重置
      const result = await chromeAPI.storage.local.get('testKey')
      expect(result).toEqual({})
    })
  })

  describe('✅ 狀態管理和一致性驗證', () => {
    test('應該正確重置所有狀態', async () => {
      const chromeAPI = mockSystem.createCompleteChromeAPI()
      
      // 設定各種狀態
      await chromeAPI.storage.local.set({ key: 'value' })
      await chromeAPI.tabs.create({ url: 'https://test.com' })
      chromeAPI.runtime.onMessage.addListener(() => {})
      
      // 重置狀態
      mockSystem.resetAllStates()
      
      // 驗證狀態已重置
      const snapshot = mockSystem.getStateSnapshot()
      expect(Object.keys(snapshot.storage.local)).toHaveLength(0)
      expect(Object.keys(snapshot.tabs.tabs)).toHaveLength(0)
      expect(snapshot.runtime.listenerCount).toBe(0)
    })

    test('應該驗證Mock狀態一致性', () => {
      const validation = mockSystem.validateMockConsistency()
      
      expect(validation.isValid).toBe(true)
      expect(validation.issues).toHaveLength(0)
    })

    test('應該檢測狀態不一致問題', async () => {
      const chromeAPI = mockSystem.createCompleteChromeAPI()
      
      // 創建多個標籤頁來測試ID一致性
      await chromeAPI.tabs.create({ url: 'https://test1.com' })
      await chromeAPI.tabs.create({ url: 'https://test2.com' })
      await chromeAPI.tabs.create({ url: 'https://test3.com' })
      
      const validation = mockSystem.validateMockConsistency()
      expect(validation.isValid).toBe(true)
      
      // 獲取狀態快照驗證
      const snapshot = mockSystem.getStateSnapshot()
      expect(snapshot.tabs.nextTabId).toBeGreaterThan(Object.keys(snapshot.tabs.tabs).length)
    })
  })

  describe('🎯 整合場景測試', () => {
    test('應該支援完整的Chrome Extension通訊流程', async () => {
      const chromeAPI = mockSystem.createCompleteChromeAPI()
      
      // 1. 創建標籤頁
      const tab = await chromeAPI.tabs.create({ 
        url: 'https://readmoo.com/library',
        active: true
      })
      
      // 2. 設定storage
      await chromeAPI.storage.local.set({
        extractionSettings: { autoExtract: true }
      })
      
      // 3. 設定消息處理
      mockSystem.setTabMessageHandler(tab.id, (message) => {
        if (message.action === 'EXTRACT_DATA') {
          return { success: true, bookCount: 25 }
        }
        return { success: false }
      })
      
      // 4. 模擬提取流程
      const settings = await chromeAPI.storage.local.get('extractionSettings')
      expect(settings.extractionSettings.autoExtract).toBe(true)
      
      const extractionResult = await chromeAPI.tabs.sendMessage(tab.id, {
        action: 'EXTRACT_DATA'
      })
      
      expect(extractionResult.success).toBe(true)
      expect(extractionResult.bookCount).toBe(25)
      
      // 5. 保存結果
      await chromeAPI.storage.local.set({
        lastExtraction: {
          tabId: tab.id,
          bookCount: extractionResult.bookCount,
          timestamp: Date.now()
        }
      })
      
      // 6. 驗證完整流程
      const finalState = await chromeAPI.storage.local.get(['extractionSettings', 'lastExtraction'])
      expect(finalState.extractionSettings).toBeDefined()
      expect(finalState.lastExtraction).toBeDefined()
      expect(finalState.lastExtraction.bookCount).toBe(25)
    })
  })

  describe('📊 效能和記憶體測試', () => {
    test('應該處理大量Storage操作', async () => {
      const chromeAPI = mockSystem.createCompleteChromeAPI()
      const startTime = performance.now()
      
      // 執行100個storage操作
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(chromeAPI.storage.local.set({ [`key${i}`]: `value${i}` }))
      }
      
      await Promise.all(promises)
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // 應該在合理時間內完成 (< 1000ms)
      expect(duration).toBeLessThan(1000)
      
      // 驗證所有資料都正確保存
      const result = await chromeAPI.storage.local.get()
      expect(Object.keys(result)).toHaveLength(100)
    })

    test('應該處理大量標籤頁操作', async () => {
      const chromeAPI = mockSystem.createCompleteChromeAPI()
      
      // 創建多個標籤頁
      const tabs = []
      for (let i = 0; i < 50; i++) {
        tabs.push(await chromeAPI.tabs.create({ 
          url: `https://test${i}.com`,
          active: i === 0
        }))
      }
      
      // 查詢所有標籤頁
      const allTabs = await chromeAPI.tabs.query({})
      expect(allTabs).toHaveLength(50)
      
      // 查詢活動標籤頁
      const activeTabs = await chromeAPI.tabs.query({ active: true })
      expect(activeTabs).toHaveLength(1)
      expect(activeTabs[0].url).toBe('https://test0.com')
    })
  })
})