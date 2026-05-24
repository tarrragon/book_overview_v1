/**
 * validate-manifest.js 單元測試
 *
 * 涵蓋四類驗證邏輯（對應 W1-066 acceptance）：
 * 1. manifest_version=3 + SW (background.service_worker) 路徑存在
 * 2. content_scripts[].js 路徑存在
 * 3. permissions 白名單 (storage + activeTab) 嚴格比對
 * 4. host_permissions 限 *.readmoo.com
 *
 * 設計原則：
 * - 純函式優先，所有驗證邏輯接收 (manifest, buildDir, fsAdapter) 參數
 * - fsAdapter 注入便於測試 mock 檔案存在性
 * - 回傳結構化結果 { ok: boolean, errors: string[] }，避免 process.exit 干擾測試
 */

const path = require('path')
const {
  validateManifestVersionAndServiceWorker,
  validateContentScripts,
  validatePermissionsWhitelist,
  validateHostPermissions,
  validateAll
} = require('../../../scripts/validate-manifest')

/**
 * 建立 fsAdapter mock：fileExists 由 existingFiles 陣列決定
 * @param {string[]} existingFiles - 視為存在的檔案路徑（絕對路徑或相對路徑）
 */
function createMockFsAdapter (existingFiles) {
  return {
    fileExists: (filePath) => existingFiles.includes(filePath)
  }
}

const BUILD_DIR = '/fake/build/production'

describe('validate-manifest', () => {
  describe('validateManifestVersionAndServiceWorker', () => {
    it('應在 manifest_version=3 且 SW 路徑存在時通過', () => {
      const manifest = {
        manifest_version: 3,
        background: { service_worker: 'src/background/background.js' }
      }
      const swPath = path.join(BUILD_DIR, 'src/background/background.js')
      const fsAdapter = createMockFsAdapter([swPath])

      const result = validateManifestVersionAndServiceWorker(manifest, BUILD_DIR, fsAdapter)

      expect(result.ok).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('應在 manifest_version !== 3 時失敗', () => {
      const manifest = {
        manifest_version: 2,
        background: { service_worker: 'src/background/background.js' }
      }
      const fsAdapter = createMockFsAdapter([])

      const result = validateManifestVersionAndServiceWorker(manifest, BUILD_DIR, fsAdapter)

      expect(result.ok).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('manifest_version')])
      )
    })

    it('應在缺少 background 欄位時失敗', () => {
      const manifest = { manifest_version: 3 }
      const fsAdapter = createMockFsAdapter([])

      const result = validateManifestVersionAndServiceWorker(manifest, BUILD_DIR, fsAdapter)

      expect(result.ok).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('background.service_worker')])
      )
    })

    it('應在缺少 background.service_worker 時失敗', () => {
      const manifest = { manifest_version: 3, background: {} }
      const fsAdapter = createMockFsAdapter([])

      const result = validateManifestVersionAndServiceWorker(manifest, BUILD_DIR, fsAdapter)

      expect(result.ok).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('background.service_worker')])
      )
    })

    it('應在 SW 檔案不存在於 build 目錄時失敗', () => {
      const manifest = {
        manifest_version: 3,
        background: { service_worker: 'src/background/background.js' }
      }
      const fsAdapter = createMockFsAdapter([]) // 檔案不存在

      const result = validateManifestVersionAndServiceWorker(manifest, BUILD_DIR, fsAdapter)

      expect(result.ok).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('background/background.js')])
      )
    })
  })

  describe('validateContentScripts', () => {
    it('應在 content_scripts[].js 路徑全部存在時通過', () => {
      const manifest = {
        content_scripts: [{
          matches: ['*://*.readmoo.com/*'],
          js: ['src/content/content-modular.js']
        }]
      }
      const csPath = path.join(BUILD_DIR, 'src/content/content-modular.js')
      const fsAdapter = createMockFsAdapter([csPath])

      const result = validateContentScripts(manifest, BUILD_DIR, fsAdapter)

      expect(result.ok).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('應在缺少 content_scripts 欄位時失敗', () => {
      const manifest = {}
      const fsAdapter = createMockFsAdapter([])

      const result = validateContentScripts(manifest, BUILD_DIR, fsAdapter)

      expect(result.ok).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('content_scripts')])
      )
    })

    it('應在 content_scripts 不是陣列時失敗', () => {
      const manifest = { content_scripts: 'not-an-array' }
      const fsAdapter = createMockFsAdapter([])

      const result = validateContentScripts(manifest, BUILD_DIR, fsAdapter)

      expect(result.ok).toBe(false)
    })

    it('應在 CS js 檔案不存在於 build 目錄時失敗', () => {
      const manifest = {
        content_scripts: [{
          matches: ['*://*.readmoo.com/*'],
          js: ['src/content/content-modular.js']
        }]
      }
      const fsAdapter = createMockFsAdapter([]) // 檔案不存在

      const result = validateContentScripts(manifest, BUILD_DIR, fsAdapter)

      expect(result.ok).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('content-modular.js')])
      )
    })

    it('應驗證多個 content_scripts entry 的所有 js 檔案', () => {
      const manifest = {
        content_scripts: [
          { matches: ['*://*.readmoo.com/*'], js: ['src/content/a.js'] },
          { matches: ['*://readmoo.com/*'], js: ['src/content/b.js'] }
        ]
      }
      const existing = [path.join(BUILD_DIR, 'src/content/a.js')] // 只有 a 存在
      const fsAdapter = createMockFsAdapter(existing)

      const result = validateContentScripts(manifest, BUILD_DIR, fsAdapter)

      expect(result.ok).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('b.js')])
      )
    })

    it('應在 content_scripts entry 缺少 js 陣列時失敗', () => {
      const manifest = {
        content_scripts: [{ matches: ['*://*.readmoo.com/*'] }] // 缺 js
      }
      const fsAdapter = createMockFsAdapter([])

      const result = validateContentScripts(manifest, BUILD_DIR, fsAdapter)

      expect(result.ok).toBe(false)
    })
  })

  describe('validatePermissionsWhitelist', () => {
    it('應在 permissions 完全等於 [storage, activeTab] 時通過', () => {
      const manifest = { permissions: ['storage', 'activeTab'] }

      const result = validatePermissionsWhitelist(manifest)

      expect(result.ok).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('應在 permissions 順序不同但內容相同時通過', () => {
      const manifest = { permissions: ['activeTab', 'storage'] }

      const result = validatePermissionsWhitelist(manifest)

      expect(result.ok).toBe(true)
    })

    it('應在 permissions 含超出白名單項目時失敗', () => {
      const manifest = { permissions: ['storage', 'activeTab', 'tabs'] }

      const result = validatePermissionsWhitelist(manifest)

      expect(result.ok).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('tabs')])
      )
    })

    it('應在 permissions 缺少必要項目時失敗', () => {
      const manifest = { permissions: ['storage'] } // 缺 activeTab

      const result = validatePermissionsWhitelist(manifest)

      expect(result.ok).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('activeTab')])
      )
    })

    it('應在缺少 permissions 欄位時失敗', () => {
      const manifest = {}

      const result = validatePermissionsWhitelist(manifest)

      expect(result.ok).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('permissions')])
      )
    })

    it('應在 permissions 是空陣列時失敗', () => {
      const manifest = { permissions: [] }

      const result = validatePermissionsWhitelist(manifest)

      expect(result.ok).toBe(false)
    })
  })

  describe('validateHostPermissions', () => {
    it('應在 host_permissions 全部符合 *.readmoo.com 模式時通過', () => {
      const manifest = { host_permissions: ['*://*.readmoo.com/*'] }

      const result = validateHostPermissions(manifest)

      expect(result.ok).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('應在 host_permissions 含非 readmoo 網域時失敗', () => {
      const manifest = {
        host_permissions: ['*://*.readmoo.com/*', '*://*.example.com/*']
      }

      const result = validateHostPermissions(manifest)

      expect(result.ok).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('example.com')])
      )
    })

    it('應在缺少 host_permissions 時失敗', () => {
      const manifest = {}

      const result = validateHostPermissions(manifest)

      expect(result.ok).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('host_permissions')])
      )
    })

    it('應在 host_permissions 是空陣列時失敗', () => {
      const manifest = { host_permissions: [] }

      const result = validateHostPermissions(manifest)

      expect(result.ok).toBe(false)
    })

    it('應在 <all_urls> 等寬鬆權限時失敗', () => {
      const manifest = { host_permissions: ['<all_urls>'] }

      const result = validateHostPermissions(manifest)

      expect(result.ok).toBe(false)
    })
  })

  describe('validateAll (整合)', () => {
    function validManifest () {
      return {
        manifest_version: 3,
        background: { service_worker: 'src/background/background.js' },
        content_scripts: [{
          matches: ['*://*.readmoo.com/*'],
          js: ['src/content/content-modular.js']
        }],
        permissions: ['storage', 'activeTab'],
        host_permissions: ['*://*.readmoo.com/*']
      }
    }

    function validFsAdapter () {
      return createMockFsAdapter([
        path.join(BUILD_DIR, 'src/background/background.js'),
        path.join(BUILD_DIR, 'src/content/content-modular.js')
      ])
    }

    it('應在全部驗證通過時回傳 { ok: true }', () => {
      const result = validateAll(validManifest(), BUILD_DIR, validFsAdapter())

      expect(result.ok).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('應在任一驗證失敗時回傳 { ok: false } 並彙總所有 errors', () => {
      const manifest = validManifest()
      manifest.permissions = ['storage', 'activeTab', 'tabs'] // 違反白名單
      manifest.host_permissions = ['*://*.example.com/*'] // 違反網域

      const result = validateAll(manifest, BUILD_DIR, validFsAdapter())

      expect(result.ok).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
    })

    it('應在 manifest 解析錯誤時透過 fsAdapter 缺檔回報明確錯誤', () => {
      // 全部檔案不存在
      const result = validateAll(validManifest(), BUILD_DIR, createMockFsAdapter([]))

      expect(result.ok).toBe(false)
      // 應同時包含 SW + CS 缺檔錯誤
      expect(result.errors.some(e => e.includes('background.js'))).toBe(true)
      expect(result.errors.some(e => e.includes('content-modular.js'))).toBe(true)
    })
  })
})
