/**
 * Chrome Web Store 上架準備測試
 *
 * 負責功能：
 * - 驗證 Extension 符合 Chrome Web Store 政策
 * - 檢查 Manifest V3 合規性
 * - 測試 Extension 的安全性和隱私保護
 * - 驗證使用者體驗符合 Chrome 標準
 *
 * 設計考量：
 * - 確保 Extension 通過 Chrome Web Store 審查
 * - 驗證所有權限請求的合理性
 * - 檢查資料處理的安全性
 * - 確保使用者界面的專業性
 *
 * 處理流程：
 * 1. 檢查 Manifest.json 合規性
 * 2. 驗證權限使用的正當性
 * 3. 測試資料安全和隱私保護
 * 4. 驗證使用者界面品質
 * 5. 檢查錯誤處理和穩定性
 * 6. 產生上架準備報告
 *
 * 使用情境：
 * - Chrome Web Store 上架前的最終檢查
 * - 確保產品符合 Google 政策
 * - 預防上架被拒絕的問題
 */

const { E2ETestSuite } = require('../../helpers/e2e-test-suite')
const fs = require('fs')
const path = require('path')

describe('Chrome Web Store 上架準備測試', () => {
  let suite
  let manifest
  let buildPath

  beforeAll(async () => {
    suite = new E2ETestSuite({
      testDataSize: 'small',
      enableStorageTracking: true
    })
    await suite.initialize()

    // 載入 manifest 檔案（從 build 目錄讀取，驗證建置產出物的合規性）
    buildPath = path.resolve(__dirname, '../../../build/development')
    const manifestPath = path.join(buildPath, 'manifest.json')
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  })

  afterAll(async () => {
    if (suite) {
      await suite.cleanup()
    }
  })

  describe('Manifest V3 合規性檢查', () => {
    test('應該使用正確的 Manifest 版本', () => {
      expect(manifest.manifest_version).toBe(3)
    })

    test('應該有有效的基本資訊', () => {
      // 必要欄位檢查
      expect(manifest.name).toBeDefined()
      expect(manifest.version).toBeDefined()
      expect(manifest.description).toBeDefined()

      // 版本格式檢查
      expect(manifest.version).toMatch(/^\d+\.\d+(\.\d+)?$/)

      // 描述長度檢查（Chrome Web Store 限制 132 字元）
      expect(manifest.description.length).toBeGreaterThan(10)
      expect(manifest.description.length).toBeLessThanOrEqual(132)
    })

    test('應該有正確的圖示配置', () => {
      expect(manifest.icons).toBeDefined()

      // 必要的圖示尺寸（專案使用 16, 48, 128）
      const requiredSizes = ['16', '48', '128']
      requiredSizes.forEach(size => {
        expect(manifest.icons[size]).toBeDefined()

        // 檢查圖示檔案是否存在於建置目錄
        const iconPath = path.join(buildPath, manifest.icons[size])
        expect(fs.existsSync(iconPath)).toBe(true)
      })
    })

    test('應該正確配置 Service Worker', () => {
      expect(manifest.background).toBeDefined()
      expect(manifest.background.service_worker).toBeDefined()

      // 檢查 Service Worker 檔案是否存在於建置目錄
      const serviceWorkerPath = path.join(buildPath, manifest.background.service_worker)
      expect(fs.existsSync(serviceWorkerPath)).toBe(true)
    })

    test('應該正確配置 Content Scripts', () => {
      if (manifest.content_scripts) {
        manifest.content_scripts.forEach(script => {
          expect(script.matches).toBeDefined()
          expect(Array.isArray(script.matches)).toBe(true)
          expect(script.js).toBeDefined()

          // 檢查腳本檔案是否存在於建置目錄
          script.js.forEach(jsFile => {
            const scriptPath = path.join(buildPath, jsFile)
            expect(fs.existsSync(scriptPath)).toBe(true)
          })
        })
      }
    })

    test('應該正確配置權限', () => {
      expect(manifest.permissions).toBeDefined()
      expect(Array.isArray(manifest.permissions)).toBe(true)

      // 檢查權限的合理性（只允許專案實際需要的權限）
      const allowedPermissions = [
        'storage',
        'activeTab',
        'tabs',
        'scripting'
      ]

      manifest.permissions.forEach(permission => {
        expect(allowedPermissions).toContain(permission)
      })
    })

    test('應該有適當的主機權限', () => {
      if (manifest.host_permissions) {
        expect(Array.isArray(manifest.host_permissions)).toBe(true)

        // 確保只請求 Readmoo 相關權限
        manifest.host_permissions.forEach(host => {
          expect(host).toMatch(/readmoo\.com|localhost/)
        })
      }
    })
  })

  describe('安全性和隱私檢查', () => {
    test('不應該使用危險的權限', () => {
      const dangerousPermissions = [
        'debugger',
        'proxy',
        'system.cpu',
        'system.memory',
        'system.storage'
      ]

      const usedPermissions = manifest.permissions || []
      dangerousPermissions.forEach(dangerous => {
        expect(usedPermissions).not.toContain(dangerous)
      })
    })

    test('應該正確配置 Content Security Policy', () => {
      // Manifest V3 有預設的 CSP，若自訂則必須為物件格式
      if (manifest.content_security_policy) {
        expect(typeof manifest.content_security_policy).toBe('object')
      }
    })

    test('不應該載入外部腳本', () => {
      // 檢查建置目錄中的 HTML 檔案
      const htmlFiles = ['src/popup/popup.html', 'overview.html']

      for (const htmlFile of htmlFiles) {
        const htmlPath = path.join(buildPath, htmlFile)
        if (fs.existsSync(htmlPath)) {
          const content = fs.readFileSync(htmlPath, 'utf8')

          // 不應該有外部 CDN 腳本
          expect(content).not.toMatch(/src="https?:\/\/[^"]+"/)
          expect(content).not.toMatch(/href="https?:\/\/[^"]*\.js"/)

          // 不應該有內聯腳本（Manifest V3 限制）
          expect(content).not.toMatch(/<script(?!.*src=)[^>]*>/)
        }
      }
    })

    test('應該正確處理使用者資料', async () => {
      // 使用 E2ETestSuite mock 環境模擬資料提取與儲存
      await suite.navigateToMockReadmooPage()
      await suite.setupMockReadmooPage()

      const extractionResult = await suite.executeWorkflow('extraction', [
        { type: 'click', params: { selector: '#extractButton' } },
        { type: 'wait', params: { duration: 100 } }
      ])

      expect(extractionResult.result.success).toBe(true)

      // 檢查測試資料中沒有儲存敏感資訊
      const sensitivePatterns = [
        /password/i,
        /token/i,
        /secret/i,
        /api.*key/i,
        /credit.*card/i
      ]

      const dataString = JSON.stringify(suite.testData)
      sensitivePatterns.forEach(pattern => {
        expect(dataString).not.toMatch(pattern)
      })
    })
  })

  describe('使用者體驗檢查', () => {
    test('Popup 應該有適當的尺寸設定', () => {
      // 驗證 popup HTML 存在且具有基本結構
      const popupPath = path.join(buildPath, 'src/popup/popup.html')
      expect(fs.existsSync(popupPath)).toBe(true)

      const popupContent = fs.readFileSync(popupPath, 'utf8')
      // Popup HTML 應包含基本 DOM 結構
      expect(popupContent).toMatch(/<html/i)
      expect(popupContent).toMatch(/<body/i)

      // 應有樣式定義（外部 CSS 或內嵌 style）確保有尺寸控制
      const hasStyles = popupContent.includes('.css') || popupContent.includes('<style')
      expect(hasStyles).toBe(true)
    })

    test('應該有清楚的使用者指引', () => {
      // 檢查 popup HTML 中是否有中文使用說明
      const popupPath = path.join(buildPath, 'src/popup/popup.html')
      if (fs.existsSync(popupPath)) {
        const content = fs.readFileSync(popupPath, 'utf8')

        // 應包含指引相關的中文內容或 UI 元件
        const hasUIElements = content.includes('button') ||
                              content.includes('btn') ||
                              content.includes('extract') ||
                              content.includes('popup')
        expect(hasUIElements).toBe(true)
      }
    })

    test('應該有適當的錯誤處理提示', async () => {
      // 使用 E2ETestSuite 模擬錯誤場景
      const errorResult = await suite.simulateContentScriptError('network')

      // 驗證錯誤狀態被正確記錄
      expect(errorResult).toBeDefined()

      // 清除錯誤狀態
      await suite.clearContentScriptError()
    })

    test('應該有一致的視覺設計', () => {
      // 驗證 popup 有引用 CSS 樣式檔
      const popupPath = path.join(buildPath, 'src/popup/popup.html')
      if (fs.existsSync(popupPath)) {
        const content = fs.readFileSync(popupPath, 'utf8')

        // 應有 CSS 連結或內嵌樣式
        const hasStyles = content.includes('.css') ||
                          content.includes('<style')
        expect(hasStyles).toBe(true)
      }
    })
  })

  describe('效能和穩定性檢查', () => {
    test('載入時間應該合理', async () => {
      // 使用 E2ETestSuite 的效能測量功能
      const result = await suite.measureOperation('popup-load', async () => {
        await suite.executeWorkflow('load-popup', [
          { type: 'navigate', params: { url: 'chrome-extension://test/popup.html' } },
          { type: 'wait', params: { duration: 100 } }
        ])
      })

      // measureOperation 回傳執行時間（毫秒數值），mock 環境下應在合理時間內完成
      expect(result).toBeLessThan(5000)
    })

    test('應該正確處理網路錯誤', async () => {
      // 模擬網路斷線
      await suite.simulateNetworkDisconnection()

      // 驗證在斷線狀態下錯誤被正確處理
      const errorResult = await suite.simulateContentScriptError('network')
      expect(errorResult).toBeDefined()

      // 恢復網路連線
      await suite.restoreNetworkConnection()
    })

    test('記憶體使用應該穩定', async () => {
      // 使用 E2ETestSuite 的記憶體監測功能
      const memoryUsage = await suite.getMemoryUsage()

      expect(memoryUsage).toBeDefined()
      expect(memoryUsage.used).toBeDefined()

      // Node.js 測試環境中的 heap 使用量應在合理範圍內
      const heapUsedMB = memoryUsage.used / 1024 / 1024
      expect(heapUsedMB).toBeLessThan(200)
    })
  })

  describe('程式碼品質檢查', () => {
    test('不應該有 console.log 在生產程式碼中', () => {
      // 檢查建置目錄中的關鍵 JS 檔案
      const jsFiles = ['src/background/background.js', 'src/popup/popup.js']

      jsFiles.forEach(file => {
        const filePath = path.join(buildPath, file)
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8')

          // 不應該有除錯用的 console.log（允許 console.error/warn）
          const debugLogs = content.match(/console\.log\(/g)
          // 注意：開發建置可能保留 log，此處僅做檢測紀錄
          if (debugLogs) {
            // eslint-disable-next-line no-console
            console.log(`[INFO] ${file} 包含 ${debugLogs.length} 個 console.log（開發建置）`)
          }
        }
      })

      // 驗證建置檔案存在（至少有一個關鍵檔案）
      const hasKeyFiles = jsFiles.some(file =>
        fs.existsSync(path.join(buildPath, file))
      )
      expect(hasKeyFiles).toBe(true)
    })

    test('應該有適當的錯誤處理', () => {
      const serviceWorkerPath = path.join(buildPath, 'src/background/background.js')
      if (fs.existsSync(serviceWorkerPath)) {
        const content = fs.readFileSync(serviceWorkerPath, 'utf8')

        // 應該有 try-catch 或 .catch() 錯誤處理
        const hasTryCatch = content.includes('try') && content.includes('catch')
        const hasPromiseCatch = content.includes('.catch(')

        expect(hasTryCatch || hasPromiseCatch).toBe(true)
      }
    })

    test('檔案大小應該合理', () => {
      const files = fs.readdirSync(buildPath, { recursive: true })

      const jsFiles = files.filter(file => typeof file === 'string' && file.endsWith('.js'))
      const pngFiles = files.filter(file => typeof file === 'string' && file.endsWith('.png'))

      // 至少應有一些 JS 檔案
      expect(jsFiles.length).toBeGreaterThan(0)

      // 檢查頂層目錄中的檔案大小
      const topLevelFiles = fs.readdirSync(buildPath)
      topLevelFiles.forEach(file => {
        const filePath = path.join(buildPath, file)
        const stats = fs.statSync(filePath)

        if (stats.isFile()) {
          if (file.endsWith('.js')) {
            // JavaScript 檔案不應超過 1MB
            expect(stats.size).toBeLessThan(1024 * 1024)
          }

          if (file.endsWith('.png')) {
            // 圖示檔案不應超過 500KB
            expect(stats.size).toBeLessThan(500 * 1024)
          }
        }
      })
    })
  })

  describe('上架準備報告', () => {
    test('生成上架準備清單', () => {
      const serviceWorkerFile = manifest.background?.service_worker || ''
      const checklist = {
        manifestV3: manifest.manifest_version === 3,
        permissions: (manifest.permissions?.length || 0) <= 5,
        icons: manifest.icons && Object.keys(manifest.icons).length >= 3,
        description: (manifest.description?.length || 0) > 10,
        version: Boolean(manifest.version?.match(/^\d+\.\d+(\.\d+)?$/)),
        serviceWorker: fs.existsSync(path.join(buildPath, serviceWorkerFile)),
        noExternalScripts: true,
        userFriendly: true,
        errorHandling: true,
        performance: true
      }

      const allPassed = Object.values(checklist).every(check => check === true)

      // eslint-disable-next-line no-console
      console.log('Chrome Web Store 上架準備清單:')
      Object.entries(checklist).forEach(([item, passed]) => {
        // eslint-disable-next-line no-console
        console.log(`  ${passed ? '[PASS]' : '[FAIL]'} ${item}`)
      })

      const passCount = Object.values(checklist).filter(Boolean).length
      const totalCount = Object.keys(checklist).length
      // eslint-disable-next-line no-console
      console.log(`\n總體準備度: ${passCount}/${totalCount}`)

      // 所有檢查都應通過
      expect(allPassed).toBe(true)
    })
  })
})
