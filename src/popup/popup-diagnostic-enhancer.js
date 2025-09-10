/**
 * Popup 診斷增強模組
 *
 * 負責功能：
 * - 增強錯誤診斷信息收集
 * - 系統健康狀態檢查
 * - 詳細的故障排除指引
 * - 診斷數據匯出功能
 *
 * 設計考量：
 * - 提供更詳細的診斷信息幫助排除問題
 * - 智能分析系統狀態和建議解決方案
 * - 支援開發者調試和使用者自助診斷
 */

class PopupDiagnosticEnhancer {
  constructor () {
    this.diagnosticData = {}
    this.systemChecks = []
    this.isCollecting = false
    this.diagnosticTimeout = 30000 // 30秒診斷超時
  }

  /**
   * 初始化診斷系統
   */
  async initialize () {
    try {
      await this.setupSystemChecks()
      this.setupDiagnosticUI()
      return { success: true }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ [診斷系統] 初始化失敗:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 執行完整的系統健康檢查
   */
  async performSystemHealthCheck () {
    this.isCollecting = true

    const healthCheckResults = {
      timestamp: Date.now(),
      checks: {},
      summary: { passed: 0, failed: 0, warnings: 0 },
      recommendations: []
    }

    try {
      // 1. Chrome Extension API 檢查
      healthCheckResults.checks.chromeExtension = await this.checkChromeExtensionAPI()

      // 2. Background Service Worker 檢查
      healthCheckResults.checks.backgroundWorker = await this.checkBackgroundWorker()

      // 3. 儲存系統檢查
      healthCheckResults.checks.storage = await this.checkStorageSystem()

      // 4. 事件系統檢查
      healthCheckResults.checks.eventSystem = await this.checkEventSystem()

      // 5. 權限檢查
      healthCheckResults.checks.permissions = await this.checkPermissions()

      // 6. 網路連線檢查
      healthCheckResults.checks.network = await this.checkNetworkConnectivity()

      // 7. Readmoo 頁面檢查
      healthCheckResults.checks.readmooPage = await this.checkReadmooPageCompatibility()

      // 統計結果
      this.calculateHealthSummary(healthCheckResults)

      // 生成建議
      this.generateRecommendations(healthCheckResults)

      this.diagnosticData = healthCheckResults

      return healthCheckResults
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ [診斷系統] 健康檢查失敗:', error)
      return {
        ...healthCheckResults,
        error: error.message,
        success: false
      }
    } finally {
      this.isCollecting = false
    }
  }

  /**
   * Chrome Extension API 檢查
   */
  async checkChromeExtensionAPI () {
    const check = { name: 'Chrome Extension API', status: 'checking', details: [] }

    try {
      // 檢查 chrome 物件是否存在
      if (typeof chrome === 'undefined') {
        check.status = 'failed'
        check.details.push('chrome 物件不存在')
        check.recommendation = '請確認在 Chrome 瀏覽器環境中運行'
        return check
      }

      // 檢查基本 API
      const apis = ['runtime', 'storage', 'tabs', 'scripting']
      const missingApis = []

      for (const api of apis) {
        if (!chrome[api]) {
          missingApis.push(api)
        }
      }

      if (missingApis.length > 0) {
        check.status = 'warning'
        check.details.push(`缺少 API: ${missingApis.join(', ')}`)
        check.recommendation = '檢查 manifest.json 權限設定'
      } else {
        check.status = 'passed'
        check.details.push('所有必要 API 可用')
      }

      // 檢查擴展 ID
      if (chrome.runtime && chrome.runtime.id) {
        check.details.push(`擴展 ID: ${chrome.runtime.id}`)
      }

      // 檢查版本
      if (chrome.runtime && chrome.runtime.getManifest) {
        const manifest = chrome.runtime.getManifest()
        check.details.push(`版本: ${manifest.version}`)
        check.details.push(`Manifest 版本: ${manifest.manifest_version}`)
      }

      return check
    } catch (error) {
      check.status = 'failed'
      check.details.push(`檢查錯誤: ${error.message}`)
      check.recommendation = '重新載入擴展或重啟 Chrome'
      return check
    }
  }

  /**
   * Background Service Worker 檢查
   */
  async checkBackgroundWorker () {
    const check = { name: 'Background Service Worker', status: 'checking', details: [] }

    try {
      // 測試與 Background 的通訊
      const testMessage = { type: 'HEALTH_CHECK', timestamp: Date.now() }

      const response = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ error: 'timeout' })
        }, 5000)

        chrome.runtime.sendMessage(testMessage, (response) => {
          clearTimeout(timeout)
          resolve(response || { error: 'no_response' })
        })
      })

      if (response.error) {
        check.status = 'failed'
        if (response.error === 'timeout') {
          check.details.push('背景服務回應超時（5秒）')
          check.recommendation = '背景 Service Worker 可能已停止，請重新載入擴展'
        } else if (response.error === 'no_response') {
          check.details.push('背景服務無回應')
          check.recommendation = '檢查背景腳本是否正確載入'
        } else {
          check.details.push(`通訊錯誤: ${response.error}`)
        }
      } else {
        check.status = 'passed'
        check.details.push('背景服務通訊正常')
        if (response.uptime) {
          check.details.push(`運行時間: ${Math.round(response.uptime / 1000)}秒`)
        }
      }

      return check
    } catch (error) {
      check.status = 'failed'
      check.details.push(`檢查錯誤: ${error.message}`)
      check.recommendation = '重新載入擴展'
      return check
    }
  }

  /**
   * 儲存系統檢查
   */
  async checkStorageSystem () {
    const check = { name: '儲存系統', status: 'checking', details: [] }

    try {
      // 檢查 Chrome Storage API
      if (!chrome.storage) {
        check.status = 'failed'
        check.details.push('Chrome Storage API 不可用')
        check.recommendation = '檢查 manifest.json 權限設定'
        return check
      }

      // 測試儲存讀寫
      const testKey = 'diagnostic_test_key'
      const testValue = { timestamp: Date.now(), test: true }

      // 寫入測試
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ [testKey]: testValue }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })

      // 讀取測試
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get(testKey, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(result)
          }
        })
      })

      // 清理測試資料
      chrome.storage.local.remove(testKey)

      if (result[testKey] && result[testKey].timestamp === testValue.timestamp) {
        check.status = 'passed'
        check.details.push('儲存讀寫功能正常')
      } else {
        check.status = 'warning'
        check.details.push('儲存功能異常')
        check.recommendation = '清除擴展資料並重新載入'
      }

      // 檢查儲存使用量
      chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        const usageKB = Math.round(bytesInUse / 1024)
        check.details.push(`儲存使用量: ${usageKB} KB`)

        if (usageKB > 5000) { // 5MB
          check.details.push('⚠️ 儲存使用量較高')
          check.recommendation = '建議清理舊資料或匯出備份'
        }
      })

      return check
    } catch (error) {
      check.status = 'failed'
      check.details.push(`檢查錯誤: ${error.message}`)
      check.recommendation = '檢查儲存權限或清除擴展資料'
      return check
    }
  }

  /**
   * 事件系統檢查
   */
  async checkEventSystem () {
    const check = { name: '事件系統', status: 'checking', details: [] }

    try {
      // 透過 Background 檢查事件系統狀態
      const response = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve({ error: 'timeout' }), 3000)

        chrome.runtime.sendMessage({
          type: 'EVENT_SYSTEM_STATUS_CHECK',
          timestamp: Date.now()
        }, (response) => {
          clearTimeout(timeout)
          resolve(response || { error: 'no_response' })
        })
      })

      if (response.error) {
        check.status = 'warning'
        check.details.push('無法獲取事件系統狀態')
        check.recommendation = '檢查背景服務是否正常運行'
      } else if (response.eventSystem) {
        const eventStatus = response.eventSystem

        if (eventStatus.initialized) {
          check.status = 'passed'
          check.details.push('事件系統已初始化')

          if (eventStatus.handlersCount) {
            check.details.push(`已註冊處理器: ${eventStatus.handlersCount} 個`)
          }

          if (eventStatus.eventsProcessed) {
            check.details.push(`已處理事件: ${eventStatus.eventsProcessed} 個`)
          }
        } else {
          check.status = 'failed'
          check.details.push('事件系統未初始化')
          check.recommendation = '重新載入擴展以重新初始化事件系統'
        }
      } else {
        check.status = 'warning'
        check.details.push('事件系統狀態未知')
      }

      return check
    } catch (error) {
      check.status = 'failed'
      check.details.push(`檢查錯誤: ${error.message}`)
      check.recommendation = '重新載入擴展'
      return check
    }
  }

  /**
   * 權限檢查
   */
  async checkPermissions () {
    const check = { name: '擴展權限', status: 'checking', details: [] }

    try {
      const manifest = chrome.runtime.getManifest()
      const permissions = manifest.permissions || []
      const hostPermissions = manifest.host_permissions || []

      check.details.push(`API 權限: ${permissions.join(', ')}`)
      check.details.push(`網站權限: ${hostPermissions.join(', ')}`)

      // 檢查必要權限
      const requiredPermissions = ['storage', 'activeTab']
      const missingPermissions = requiredPermissions.filter(p => !permissions.includes(p))

      if (missingPermissions.length > 0) {
        check.status = 'failed'
        check.details.push(`缺少必要權限: ${missingPermissions.join(', ')}`)
        check.recommendation = '重新安裝擴展以獲得完整權限'
      } else {
        check.status = 'passed'
        check.details.push('所有必要權限已獲得')
      }

      return check
    } catch (error) {
      check.status = 'failed'
      check.details.push(`檢查錯誤: ${error.message}`)
      return check
    }
  }

  /**
   * 網路連線檢查
   */
  async checkNetworkConnectivity () {
    const check = { name: '網路連線', status: 'checking', details: [] }

    try {
      // 檢查基本網路連線
      if (!navigator.onLine) {
        check.status = 'failed'
        check.details.push('瀏覽器報告離線狀態')
        check.recommendation = '檢查網路連線'
        return check
      }

      // 測試 Readmoo 連線
      const testUrls = [
        'https://readmoo.com',
        'https://member.readmoo.com'
      ]

      const testResults = []

      for (const url of testUrls) {
        try {
          const startTime = Date.now()
          const response = await fetch(url, {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-cache',
            signal: AbortSignal.timeout(5000)
          })
          const endTime = Date.now()

          testResults.push({
            url,
            success: true,
            responseTime: endTime - startTime
          })
        } catch (error) {
          testResults.push({
            url,
            success: false,
            error: error.message
          })
        }
      }

      const successfulTests = testResults.filter(t => t.success)

      if (successfulTests.length === testResults.length) {
        check.status = 'passed'
        check.details.push('Readmoo 網站連線正常')

        const avgResponseTime = successfulTests.reduce((sum, t) => sum + t.responseTime, 0) / successfulTests.length
        check.details.push(`平均回應時間: ${Math.round(avgResponseTime)}ms`)
      } else if (successfulTests.length > 0) {
        check.status = 'warning'
        check.details.push('部分網路連線異常')
        check.recommendation = '檢查防火牆設定或 DNS 配置'
      } else {
        check.status = 'failed'
        check.details.push('無法連接到 Readmoo 網站')
        check.recommendation = '檢查網路連線和防火牆設定'
      }

      return check
    } catch (error) {
      check.status = 'failed'
      check.details.push(`檢查錯誤: ${error.message}`)
      check.recommendation = '檢查網路連線'
      return check
    }
  }

  /**
   * Readmoo 頁面相容性檢查
   */
  async checkReadmooPageCompatibility () {
    const check = { name: 'Readmoo 頁面相容性', status: 'checking', details: [] }

    try {
      // 獲取當前頁面資訊
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve)
      })

      if (!tabs || tabs.length === 0) {
        check.status = 'warning'
        check.details.push('無法獲取當前頁面資訊')
        return check
      }

      const currentTab = tabs[0]
      const url = currentTab.url

      check.details.push(`當前頁面: ${url}`)

      // 檢查是否為 Readmoo 網站
      const isReadmooSite = url && (
        url.includes('readmoo.com') ||
        url.includes('member.readmoo.com')
      )

      if (!isReadmooSite) {
        check.status = 'warning'
        check.details.push('當前不在 Readmoo 網站')
        check.recommendation = '請導航到 Readmoo 網站以使用完整功能'
      } else {
        check.status = 'passed'
        check.details.push('當前在 Readmoo 網站')

        // 檢查頁面類型
        if (url.includes('/library')) {
          check.details.push('檢測到書庫頁面')
        } else if (url.includes('/book/')) {
          check.details.push('檢測到書籍詳細頁面')
        } else {
          check.details.push('其他 Readmoo 頁面')
        }
      }

      return check
    } catch (error) {
      check.status = 'failed'
      check.details.push(`檢查錯誤: ${error.message}`)
      return check
    }
  }

  /**
   * 計算健康檢查總結
   */
  calculateHealthSummary (results) {
    for (const checkName in results.checks) {
      const check = results.checks[checkName]
      switch (check.status) {
        case 'passed':
          results.summary.passed++
          break
        case 'failed':
          results.summary.failed++
          break
        case 'warning':
          results.summary.warnings++
          break
      }
    }
  }

  /**
   * 生成系統建議
   */
  generateRecommendations (results) {
    const recommendations = []

    // 根據失敗的檢查生成建議
    for (const checkName in results.checks) {
      const check = results.checks[checkName]
      if (check.status === 'failed' && check.recommendation) {
        recommendations.push({
          priority: 'high',
          category: checkName,
          action: check.recommendation,
          reason: check.details.join(', ')
        })
      } else if (check.status === 'warning' && check.recommendation) {
        recommendations.push({
          priority: 'medium',
          category: checkName,
          action: check.recommendation,
          reason: check.details.join(', ')
        })
      }
    }

    // 總體建議
    if (results.summary.failed > 0) {
      recommendations.unshift({
        priority: 'high',
        category: 'general',
        action: '建議重新載入擴展以解決系統問題',
        reason: `檢測到 ${results.summary.failed} 個嚴重問題`
      })
    } else if (results.summary.warnings > 2) {
      recommendations.push({
        priority: 'medium',
        category: 'general',
        action: '建議進行系統維護以優化效能',
        reason: `檢測到 ${results.summary.warnings} 個警告`
      })
    }

    results.recommendations = recommendations
  }

  /**
   * 設置診斷 UI 元素
   */
  setupDiagnosticUI () {
    // 這裡可以設置診斷相關的 UI 元素
    // 由於是增強模組，主要邏輯在 popup.js 中整合
  }

  /**
   * 匯出診斷資料
   */
  async exportDiagnosticData () {
    if (!this.diagnosticData || Object.keys(this.diagnosticData).length === 0) {
      await this.performSystemHealthCheck()
    }

    const exportData = {
      timestamp: Date.now(),
      version: chrome.runtime.getManifest().version,
      userAgent: navigator.userAgent,
      diagnosticData: this.diagnosticData,
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: 'PopupDiagnosticEnhancer'
      }
    }

    return JSON.stringify(exportData, null, 2)
  }

  /**
   * 生成 GitHub Issue 報告 URL
   */
  generateGitHubIssueURL (errorInfo) {
    const baseUrl = 'https://github.com/your-repo/chrome-extension/issues/new'
    const title = encodeURIComponent(`[Bug Report] ${errorInfo.title || '系統錯誤'}`)

    const body = encodeURIComponent(`
## 問題描述
${errorInfo.message || '用戶報告的系統錯誤'}

## 系統診斷資訊
\`\`\`json
${JSON.stringify(this.diagnosticData, null, 2)}
\`\`\`

## 瀏覽器資訊
- User Agent: ${navigator.userAgent}
- Chrome 版本: ${navigator.userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || '未知'}
- 擴展版本: ${chrome.runtime.getManifest().version}

## 重現步驟
1. [請詳細描述如何重現此問題]
2. 
3. 

## 預期行為
[請描述您預期應該發生什麼]

## 實際行為  
[請描述實際發生了什麼]

## 其他資訊
[請提供任何其他相關資訊]
    `)

    return `${baseUrl}?title=${title}&body=${body}&labels=bug,needs-investigation`
  }

  /**
   * 設置系統檢查項目
   */
  async setupSystemChecks () {
    this.systemChecks = [
      'chromeExtension',
      'backgroundWorker',
      'storage',
      'eventSystem',
      'permissions',
      'network',
      'readmooPage'
    ]
  }
}

// 匯出類別以供使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PopupDiagnosticEnhancer
} else if (typeof window !== 'undefined') {
  window.PopupDiagnosticEnhancer = PopupDiagnosticEnhancer
}
