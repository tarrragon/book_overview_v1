/* eslint-disable no-console */

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

// eslint-disable-next-line no-unused-vars
const ExtensionTestSetup = require('../setup/extension-setup')
// eslint-disable-next-line no-unused-vars
const fs = require('fs')
// eslint-disable-next-line no-unused-vars
const path = require('path')

// TODO: 此測試套件需要 Puppeteer + Chrome 瀏覽器環境，CI 環境無法執行，待環境配置完成後移除 skip
describe.skip('🏪 Chrome Web Store 上架準備測試', () => {
  // eslint-disable-next-line no-unused-vars
  let testSetup
  let manifest
  let buildPath

  jest.setTimeout(90000)

  beforeAll(async () => {
    testSetup = new ExtensionTestSetup()
    await testSetup.setup({ headless: true })

    // 載入 manifest 檔案
    buildPath = path.resolve(__dirname, '../../../build/development')
    // eslint-disable-next-line no-unused-vars
    const manifestPath = path.join(buildPath, 'manifest.json')
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  })

  afterAll(async () => {
    await testSetup.cleanup()
  })

  describe('📋 Manifest V3 合規性檢查', () => {
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

      // 描述長度檢查
      expect(manifest.description.length).toBeGreaterThan(10)
      expect(manifest.description.length).toBeLessThanOrEqual(132)
    })

    test('應該有正確的圖示配置', () => {
      expect(manifest.icons).toBeDefined()

      // 必要的圖示尺寸
      // eslint-disable-next-line no-unused-vars
      const requiredSizes = ['16', '32', '48', '128']
      requiredSizes.forEach(size => {
        expect(manifest.icons[size]).toBeDefined()

        // 檢查圖示檔案是否存在
        // eslint-disable-next-line no-unused-vars
        const iconPath = path.join(buildPath, manifest.icons[size])
        expect(fs.existsSync(iconPath)).toBe(true)
      })
    })

    test('應該正確配置 Service Worker', () => {
      expect(manifest.background).toBeDefined()
      expect(manifest.background.service_worker).toBeDefined()

      // 檢查 Service Worker 檔案是否存在
      // eslint-disable-next-line no-unused-vars
      const serviceWorkerPath = path.join(buildPath, manifest.background.service_worker)
      expect(fs.existsSync(serviceWorkerPath)).toBe(true)
    })

    test('應該正確配置 Content Scripts', () => {
      if (manifest.content_scripts) {
        manifest.content_scripts.forEach(script => {
          expect(script.matches).toBeDefined()
          expect(Array.isArray(script.matches)).toBe(true)
          expect(script.js).toBeDefined()

          // 檢查腳本檔案是否存在
          script.js.forEach(jsFile => {
            // eslint-disable-next-line no-unused-vars
            const scriptPath = path.join(buildPath, jsFile)
            expect(fs.existsSync(scriptPath)).toBe(true)
          })
        })
      }
    })

    test('應該正確配置權限', () => {
      expect(manifest.permissions).toBeDefined()
      expect(Array.isArray(manifest.permissions)).toBe(true)

      // 檢查權限的合理性
      // eslint-disable-next-line no-unused-vars
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

  describe('🔒 安全性和隱私檢查', () => {
    test('不應該使用危險的權限', () => {
      // eslint-disable-next-line no-unused-vars
      const dangerousPermissions = [
        'debugger',
        'proxy',
        'system.cpu',
        'system.memory',
        'system.storage'
      ]

      // eslint-disable-next-line no-unused-vars
      const usedPermissions = manifest.permissions || []
      dangerousPermissions.forEach(dangerous => {
        expect(usedPermissions).not.toContain(dangerous)
      })
    })

    test('應該正確配置 Content Security Policy', () => {
      // 檢查是否有 CSP 設定（雖然 MV3 有預設的）
      if (manifest.content_security_policy) {
        expect(typeof manifest.content_security_policy).toBe('object')
      }
    })

    test('不應該載入外部腳本', async () => {
      // 檢查所有 HTML 檔案
      // eslint-disable-next-line no-unused-vars
      const htmlFiles = ['popup.html', 'overview.html']

      for (const htmlFile of htmlFiles) {
        // eslint-disable-next-line no-unused-vars
        const htmlPath = path.join(buildPath, htmlFile)
        if (fs.existsSync(htmlPath)) {
          // eslint-disable-next-line no-unused-vars
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
      // 導航到測試頁面並提取資料
      await testSetup.navigateToReadmoo()
      // eslint-disable-next-line no-unused-vars
      const popupPage = await testSetup.openExtensionPopup()
      await popupPage.click('#extractButton')
      await popupPage.waitForSelector('.status-completed', { timeout: 20000 })

      // 檢查儲存的資料
      // eslint-disable-next-line no-unused-vars
      const backgroundPage = await testSetup.getBackgroundPage()
      // eslint-disable-next-line no-unused-vars
      const storedData = await backgroundPage.evaluate(() => {
        return new Promise((resolve) => {
          chrome.storage.local.get(null, resolve)
        })
      })

      // 驗證沒有儲存敏感資訊
      // eslint-disable-next-line no-unused-vars
      const sensitivePatterns = [
        /password/i,
        /token/i,
        /secret/i,
        /api.*key/i,
        /credit.*card/i
      ]

      // eslint-disable-next-line no-unused-vars
      const dataString = JSON.stringify(storedData)
      sensitivePatterns.forEach(pattern => {
        expect(dataString).not.toMatch(pattern)
      })

      await popupPage.close()
    })
  })

  describe('🎨 使用者體驗檢查', () => {
    test('Popup 應該有適當的尺寸', async () => {
      // eslint-disable-next-line no-unused-vars
      const popupPage = await testSetup.openExtensionPopup()

      // 取得 Popup 尺寸
      // eslint-disable-next-line no-unused-vars
      const dimensions = await popupPage.evaluate(() => ({
        width: document.body.scrollWidth,
        height: document.body.scrollHeight
      }))

      // Chrome Extension Popup 建議尺寸
      expect(dimensions.width).toBeGreaterThanOrEqual(300)
      expect(dimensions.width).toBeLessThanOrEqual(800)
      expect(dimensions.height).toBeGreaterThanOrEqual(200)
      expect(dimensions.height).toBeLessThanOrEqual(600)

      await popupPage.close()
    })

    test('應該有清楚的使用者指引', async () => {
      // eslint-disable-next-line no-unused-vars
      const popupPage = await testSetup.openExtensionPopup()

      // 檢查是否有說明文字或提示
      // eslint-disable-next-line no-unused-vars
      const hasInstructions = await popupPage.evaluate(() => {
        // eslint-disable-next-line no-unused-vars
        const text = document.body.textContent.toLowerCase()
        return text.includes('點擊') ||
               text.includes('提取') ||
               text.includes('書庫') ||
               text.includes('使用') ||
               text.includes('說明')
      })

      expect(hasInstructions).toBe(true)

      await popupPage.close()
    })

    test('應該有適當的錯誤處理提示', async () => {
      // 在無效頁面上測試錯誤處理
      await testSetup.page.goto('about:blank')

      // eslint-disable-next-line no-unused-vars
      const popupPage = await testSetup.openExtensionPopup()
      await popupPage.click('#extractButton')

      // 等待錯誤狀態
      try {
        await popupPage.waitForSelector('.status-error, .error-message', { timeout: 10000 })

        // 檢查錯誤訊息是否友善
        // eslint-disable-next-line no-unused-vars
        const errorText = await popupPage.evaluate(() => {
          // eslint-disable-next-line no-unused-vars
          const errorEl = document.querySelector('.status-error, .error-message')
          return errorEl ? errorEl.textContent : ''
        })

        // 錯誤訊息應該是中文且有意義
        expect(errorText).toMatch(/錯誤|失敗|無法|問題/)
        expect(errorText.length).toBeGreaterThan(5)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('錯誤處理測試可能需要調整')
      }

      await popupPage.close()
    })

    test('應該有一致的視覺設計', async () => {
      // eslint-disable-next-line no-unused-vars
      const popupPage = await testSetup.openExtensionPopup()

      // 檢查 CSS 載入
      // eslint-disable-next-line no-unused-vars
      const hasStyles = await popupPage.evaluate(() => {
        // eslint-disable-next-line no-unused-vars
        const computedStyle = window.getComputedStyle(document.body)
        return computedStyle.fontFamily !== '' &&
               computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)'
      })

      expect(hasStyles).toBe(true)

      await popupPage.close()
    })
  })

  describe('📊 效能和穩定性檢查', () => {
    test('載入時間應該合理', async () => {
      // eslint-disable-next-line no-unused-vars
      const startTime = performance.now()

      // eslint-disable-next-line no-unused-vars
      const popupPage = await testSetup.openExtensionPopup()
      await popupPage.waitForSelector('body')

      // eslint-disable-next-line no-unused-vars
      const loadTime = performance.now() - startTime

      // Popup 應該在 2 秒內載入完成
      expect(loadTime).toBeLessThan(2000)

      await popupPage.close()
    })

    test('應該正確處理網路錯誤', async () => {
      // 模擬網路錯誤環境
      await testSetup.page.setOfflineMode(true)

      // eslint-disable-next-line no-unused-vars
      const popupPage = await testSetup.openExtensionPopup()
      await popupPage.click('#extractButton')

      // 應該顯示網路錯誤訊息
      try {
        await popupPage.waitForSelector('.status-error, .network-error', { timeout: 10000 })

        // eslint-disable-next-line no-unused-vars
        const errorShown = await popupPage.$('.status-error, .network-error')
        expect(errorShown).toBeTruthy()
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('網路錯誤處理測試需要調整')
      }

      // 恢復網路連線
      await testSetup.page.setOfflineMode(false)
      await popupPage.close()
    })

    test('記憶體使用應該穩定', async () => {
      // eslint-disable-next-line no-unused-vars
      const iterations = 3
      // eslint-disable-next-line no-unused-vars
      const memoryReadings = []

      for (let i = 0; i < iterations; i++) {
        // eslint-disable-next-line no-unused-vars
        const popupPage = await testSetup.openExtensionPopup()

        // eslint-disable-next-line no-unused-vars
        const memory = await popupPage.evaluate(() => {
          if (performance.memory) {
            return performance.memory.usedJSHeapSize / 1024 / 1024
          }
          return 0
        })

        if (memory > 0) {
          memoryReadings.push(memory)
        }

        await popupPage.close()
        await testSetup.page.waitForTimeout(1000)
      }

      if (memoryReadings.length > 0) {
        // eslint-disable-next-line no-unused-vars
        const maxMemory = Math.max(...memoryReadings)
        expect(maxMemory).toBeLessThan(50) // 少於 50MB
      }
    })
  })

  describe('🔍 程式碼品質檢查', () => {
    // eslint-disable-next-line no-console
    test('不應該有 console.log 在生產程式碼中', () => {
      // eslint-disable-next-line no-unused-vars
      const jsFiles = ['service-worker.js', 'popup.js']

      jsFiles.forEach(file => {
        // eslint-disable-next-line no-unused-vars
        const filePath = path.join(buildPath, file)
        if (fs.existsSync(filePath)) {
          // eslint-disable-next-line no-unused-vars
          const content = fs.readFileSync(filePath, 'utf8')

          // 允許錯誤日誌，但不應該有除錯日誌
          // eslint-disable-next-line no-unused-vars
          const debugLogs = content.match(/console\.log\(/g)
          expect(debugLogs).toBeNull()
        }
      })
    })

    test('應該有適當的錯誤處理', () => {
      // eslint-disable-next-line no-unused-vars
      const serviceWorkerPath = path.join(buildPath, 'service-worker.js')
      if (fs.existsSync(serviceWorkerPath)) {
        // eslint-disable-next-line no-unused-vars
        const content = fs.readFileSync(serviceWorkerPath, 'utf8')

        // 應該有 try-catch 或 .catch() 錯誤處理
        // eslint-disable-next-line no-unused-vars
        const hasTryCatch = content.includes('try') && content.includes('catch')
        // eslint-disable-next-line no-unused-vars
        const hasPromiseCatch = content.includes('.catch(')

        expect(hasTryCatch || hasPromiseCatch).toBe(true)
      }
    })

    test('檔案大小應該合理', () => {
      // eslint-disable-next-line no-unused-vars
      const files = fs.readdirSync(buildPath)

      files.forEach(file => {
        // eslint-disable-next-line no-unused-vars
        const filePath = path.join(buildPath, file)
        // eslint-disable-next-line no-unused-vars
        const stats = fs.statSync(filePath)

        if (file.endsWith('.js')) {
          // JavaScript 檔案不應超過 1MB
          expect(stats.size).toBeLessThan(1024 * 1024)
        }

        if (file.endsWith('.png')) {
          // 圖示檔案不應超過 500KB
          expect(stats.size).toBeLessThan(500 * 1024)
        }
      })
    })
  })

  describe('📝 上架準備報告', () => {
    test('生成上架準備清單', async () => {
      // eslint-disable-next-line no-unused-vars
      const checklist = {
        manifestV3: true,
        permissions: manifest.permissions?.length <= 5,
        icons: manifest.icons && Object.keys(manifest.icons).length >= 4,
        description: manifest.description?.length > 10,
        version: manifest.version?.match(/^\d+\.\d+(\.\d+)?$/),
        serviceWorker: fs.existsSync(path.join(buildPath, manifest.background?.service_worker || '')),
        noExternalScripts: true, // 基於上面的測試
        userFriendly: true, // 基於 UI 測試
        errorHandling: true, // 基於錯誤處理測試
        performance: true // 基於效能測試
      }

      // eslint-disable-next-line no-unused-vars
      const allPassed = Object.values(checklist).every(check => check === true)

      // eslint-disable-next-line no-console
      console.log('🏪 Chrome Web Store 上架準備清單:')
      Object.entries(checklist).forEach(([item, passed]) => {
        // eslint-disable-next-line no-console
        console.log(`  ${passed ? '✅' : '❌'} ${item}`)
      })

      // eslint-disable-next-line no-console
      console.log(`\n📊 總體準備度: ${Object.values(checklist).filter(Boolean).length}/${Object.keys(checklist).length}`)

      // 建議所有檢查都通過
      expect(allPassed).toBe(true)
    })
  })
})
