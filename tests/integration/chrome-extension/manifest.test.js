/**
 * Chrome Extension Manifest V3 配置整合測試
 *
 * 負責功能：
 * - 驗證 Manifest V3 格式正確性
 * - 確保 Service Worker 配置符合規範
 * - 驗證 Content Scripts 注入規則
 * - 檢查權限配置完整性
 * - 確認事件系統 API 可用性
 *
 * 測試策略：
 * - 載入並解析 manifest.json
 * - 驗證必要欄位和格式
 * - 檢查權限和 host_permissions 配置
 * - 確認 background service worker 設定
 * - 驗證 content_scripts 注入規則
 */

const fs = require('fs')
const path = require('path')

describe('Chrome Extension Manifest V3 Configuration', () => {
  let manifest
  let manifestPath

  beforeAll(() => {
    // 載入 manifest.json 文件
    manifestPath = path.join(__dirname, '../../../manifest.json')

    // 確保 manifest.json 存在
    expect(fs.existsSync(manifestPath)).toBe(true)

    // 解析 manifest 內容
    const manifestContent = fs.readFileSync(manifestPath, 'utf8')
    manifest = JSON.parse(manifestContent)
  })

  describe('🔧 基本 Manifest 格式驗證', () => {
    test('應該使用 Manifest V3 版本', () => {
      expect(manifest.manifest_version).toBe(3)
    })

    test('應該有必要的基本資訊', () => {
      expect(manifest.name).toBeDefined()
      expect(typeof manifest.name).toBe('string')
      expect(manifest.name).toContain('Readmoo')

      expect(manifest.version).toBeDefined()
      expect(typeof manifest.version).toBe('string')
      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/)

      expect(manifest.description).toBeDefined()
      expect(typeof manifest.description).toBe('string')
    })

    test('應該有正確的擴展圖示配置', () => {
      expect(manifest.icons).toBeDefined()
      expect(typeof manifest.icons).toBe('object')

      // 檢查標準尺寸
      expect(manifest.icons['16']).toBeDefined()
      expect(manifest.icons['48']).toBeDefined()
      expect(manifest.icons['128']).toBeDefined()
    })
  })

  describe('🔧 Service Worker 配置正確性', () => {
    test('應該配置 background service worker', () => {
      expect(manifest.background).toBeDefined()
      expect(manifest.background.service_worker).toBeDefined()
      expect(typeof manifest.background.service_worker).toBe('string')
      expect(manifest.background.service_worker).toMatch(/background\.js$/)
    })

    test('service worker 檔案應該存在', () => {
      const serviceWorkerPath = path.join(
        path.dirname(manifestPath),
        manifest.background.service_worker
      )
      expect(fs.existsSync(serviceWorkerPath)).toBe(true)
    })

    test('不應該使用已棄用的 background pages', () => {
      expect(manifest.background.page).toBeUndefined()
      expect(manifest.background.scripts).toBeUndefined()
      expect(manifest.background.persistent).toBeUndefined()
    })
  })

  describe('🔧 Content Scripts 注入規則', () => {
    test('應該配置 content scripts', () => {
      expect(manifest.content_scripts).toBeDefined()
      expect(Array.isArray(manifest.content_scripts)).toBe(true)
      expect(manifest.content_scripts.length).toBeGreaterThan(0)
    })

    test('應該針對 Readmoo 網站配置注入規則', () => {
      const readmooScript = manifest.content_scripts.find(script =>
        script.matches && script.matches.some(match =>
          match.includes('readmoo.com')
        )
      )

      expect(readmooScript).toBeDefined()
      expect(readmooScript.js).toBeDefined()
      expect(Array.isArray(readmooScript.js)).toBe(true)
      expect(readmooScript.js.length).toBeGreaterThan(0)
    })

    test('content script 檔案應該存在', () => {
      manifest.content_scripts.forEach(script => {
        script.js.forEach(jsFile => {
          const scriptPath = path.join(path.dirname(manifestPath), jsFile)
          expect(fs.existsSync(scriptPath)).toBe(true)
        })
      })
    })
  })

  describe('🔧 權限配置完整性', () => {
    test('應該包含基本擴展權限', () => {
      expect(manifest.permissions).toBeDefined()
      expect(Array.isArray(manifest.permissions)).toBe(true)

      // 檢查事件系統必要權限
      expect(manifest.permissions).toContain('storage')
      expect(manifest.permissions).toContain('activeTab')
    })

    test('應該配置 Readmoo 網站的 host permissions', () => {
      expect(manifest.host_permissions).toBeDefined()
      expect(Array.isArray(manifest.host_permissions)).toBe(true)

      const hasReadmooPermission = manifest.host_permissions.some(permission =>
        permission.includes('readmoo.com') || permission.includes('*.readmoo.com/*')
      )

      expect(hasReadmooPermission).toBe(true)
    })

    test('不應該請求過多的權限', () => {
      // 權限最小化原則 - 不應該有不必要的危險權限
      const dangerousPermissions = [
        'bookmarks', 'history', 'topSites', 'tabs', 'management'
      ]

      dangerousPermissions.forEach(permission => {
        expect(manifest.permissions).not.toContain(permission)
      })
    })
  })

  describe('🔧 事件系統 API 可用性', () => {
    test('應該包含事件系統所需的 Chrome API 權限', () => {
      const requiredPermissions = ['storage']

      requiredPermissions.forEach(permission => {
        expect(manifest.permissions).toContain(permission)
      })
    })

    test('應該支援跨上下文通訊所需的權限', () => {
      // runtime API 是內建的，不需要在 permissions 中聲明
      // 但需要確保沒有限制性配置
      expect(manifest.content_security_policy).toBeUndefined() // 使用預設即可
    })
  })

  describe('🔧 Popup 界面配置', () => {
    test('應該配置 action popup', () => {
      expect(manifest.action).toBeDefined()
      expect(manifest.action.default_popup).toBeDefined()
      expect(typeof manifest.action.default_popup).toBe('string')
      expect(manifest.action.default_popup).toMatch(/\.html$/)
    })

    test('popup 檔案應該存在', () => {
      const popupPath = path.join(
        path.dirname(manifestPath),
        manifest.action.default_popup
      )
      expect(fs.existsSync(popupPath)).toBe(true)
    })

    test('應該配置 action 圖示', () => {
      expect(manifest.action.default_icon).toBeDefined()
      expect(typeof manifest.action.default_icon).toBe('object')
    })
  })

  describe('🔧 開發與生產環境配置', () => {
    test('應該適當配置開發環境設定', () => {
      // 在開發階段，可能需要額外的權限或配置
      if (process.env.NODE_ENV === 'development') {
        // 開發環境可能需要 localhost 權限進行測試
        expect(manifest.host_permissions).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/localhost|127\.0\.0\.1/)
          ])
        )
      }
    })

    test('manifest 應該符合 Chrome Web Store 政策', () => {
      // 名稱不應該包含 "Chrome" 或 "Google"
      expect(manifest.name.toLowerCase()).not.toContain('chrome')
      expect(manifest.name.toLowerCase()).not.toContain('google')

      // 版本號應該符合規範
      expect(manifest.version).toMatch(/^\d+(\.\d+){0,3}$/)

      // 描述應該有意義且不過短
      expect(manifest.description.length).toBeGreaterThan(10)
    })
  })
})
