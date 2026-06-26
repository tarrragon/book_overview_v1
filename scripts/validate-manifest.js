#!/usr/bin/env node
/**
 * Book Overview - Manifest 自動化前置驗證腳本
 *
 * 用途：作為 build/production/ 內測打包前的 gate-style 驗證，
 * 將原須手動驗證的四類項目自動化（W1-066 acceptance）：
 *   1. manifest_version=3 + SW (background.service_worker) 路徑存在
 *   2. content_scripts[].js 路徑存在
 *   3. permissions 白名單僅含 storage + activeTab（嚴格比對，非僅警告）
 *   4. host_permissions 限 *.readmoo.com
 *
 * 與 scripts/validate-build.js 的職責區分：
 *   - validate-build.js：完整建置健康度檢查（含 icons、檔案大小、目錄結構）
 *   - validate-manifest.js：聚焦 manifest 結構 + 路徑存在性 + 權限白名單嚴格性
 *     作為 W1-002.2 clean profile 手動驗證前置 gate（W1-064 ANA 方案 B）
 *
 * 設計原則：
 *   - 純函式驗證邏輯（validateXxx）：接收 (manifest, buildDir, fsAdapter) 並回傳 { ok, errors }
 *   - I/O 與驗證分離：fsAdapter 注入便於測試 mock
 *   - 失敗時 exit code 1，成功 exit code 0
 *
 * CLI 用法：
 *   node scripts/validate-manifest.js                  # 預設驗證 build/production/
 *   node scripts/validate-manifest.js --dir build/dev  # 自訂目錄
 */

const fs = require('fs')
const path = require('path')

/**
 * 預設權限白名單（W1-066 acceptance）
 */
const ALLOWED_PERMISSIONS = ['storage', 'activeTab']

/**
 * 允許的 host_permissions 模式（限 readmoo.com）
 * 接受 *://*.readmoo.com/* 與 *://readmoo.com/*（子網域 + 主網域）
 */
const READMOO_HOST_PATTERN = /^\*:\/\/(\*\.)?readmoo\.com\/\*$/

/**
 * 預設 fsAdapter：使用 Node.js fs 模組
 */
const defaultFsAdapter = {
  fileExists: (filePath) => fs.existsSync(filePath)
}

/**
 * 驗證 manifest_version=3 且 SW (background.service_worker) 路徑存在
 *
 * @param {object} manifest - 解析後的 manifest 物件
 * @param {string} buildDir - build 目錄絕對路徑
 * @param {object} fsAdapter - 檔案存在性檢查介面，注入便於測試
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateManifestVersionAndServiceWorker (manifest, buildDir, fsAdapter = defaultFsAdapter) {
  const errors = []

  if (manifest.manifest_version !== 3) {
    errors.push(`manifest_version 必須為 3，目前為: ${manifest.manifest_version}`)
  }

  if (!manifest.background || typeof manifest.background !== 'object') {
    errors.push('缺少 background.service_worker 欄位（Manifest V3 必需）')
    return { ok: false, errors }
  }

  const swRelPath = manifest.background.service_worker
  if (typeof swRelPath !== 'string' || swRelPath.length === 0) {
    errors.push('缺少 background.service_worker 欄位（Manifest V3 必需）')
    return { ok: errors.length === 0, errors }
  }

  const swAbsPath = path.join(buildDir, swRelPath)
  if (!fsAdapter.fileExists(swAbsPath)) {
    errors.push(`Service Worker 檔案不存在於 build 目錄: ${swRelPath}`)
  }

  return { ok: errors.length === 0, errors }
}

/**
 * 驗證 content_scripts[].js 路徑全部存在於 build 目錄
 *
 * @param {object} manifest
 * @param {string} buildDir
 * @param {object} fsAdapter
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateContentScripts (manifest, buildDir, fsAdapter = defaultFsAdapter) {
  const errors = []

  if (!Array.isArray(manifest.content_scripts)) {
    errors.push('content_scripts 欄位缺失或不是陣列')
    return { ok: false, errors }
  }

  if (manifest.content_scripts.length === 0) {
    errors.push('content_scripts 為空陣列')
    return { ok: false, errors }
  }

  manifest.content_scripts.forEach((entry, idx) => {
    if (!Array.isArray(entry.js) || entry.js.length === 0) {
      errors.push(`content_scripts[${idx}] 缺少 js 陣列或為空`)
      return
    }

    entry.js.forEach((jsRelPath) => {
      const jsAbsPath = path.join(buildDir, jsRelPath)
      if (!fsAdapter.fileExists(jsAbsPath)) {
        errors.push(`Content Script 檔案不存在於 build 目錄: ${jsRelPath}`)
      }
    })
  })

  return { ok: errors.length === 0, errors }
}

/**
 * 驗證 permissions 嚴格符合白名單（storage + activeTab，順序無關，無多餘無缺漏）
 *
 * @param {object} manifest
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validatePermissionsWhitelist (manifest) {
  const errors = []

  if (!Array.isArray(manifest.permissions)) {
    errors.push('permissions 欄位缺失或不是陣列')
    return { ok: false, errors }
  }

  if (manifest.permissions.length === 0) {
    errors.push('permissions 為空陣列，至少需含 storage + activeTab')
    return { ok: false, errors }
  }

  const actualSet = new Set(manifest.permissions)
  const allowedSet = new Set(ALLOWED_PERMISSIONS)

  // 找出多餘的權限（actual 中不在 allowed）
  const extra = manifest.permissions.filter((p) => !allowedSet.has(p))
  if (extra.length > 0) {
    errors.push(`permissions 含超出白名單項目: ${extra.join(', ')}（白名單: ${ALLOWED_PERMISSIONS.join(', ')}）`)
  }

  // 找出缺少的權限（allowed 中不在 actual）
  const missing = ALLOWED_PERMISSIONS.filter((p) => !actualSet.has(p))
  if (missing.length > 0) {
    errors.push(`permissions 缺少必要項目: ${missing.join(', ')}`)
  }

  return { ok: errors.length === 0, errors }
}

/**
 * 驗證 host_permissions 限於 *.readmoo.com 模式
 *
 * @param {object} manifest
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateHostPermissions (manifest) {
  const errors = []

  if (!Array.isArray(manifest.host_permissions)) {
    errors.push('host_permissions 欄位缺失或不是陣列')
    return { ok: false, errors }
  }

  if (manifest.host_permissions.length === 0) {
    errors.push('host_permissions 為空陣列，至少需含 *://*.readmoo.com/*')
    return { ok: false, errors }
  }

  manifest.host_permissions.forEach((host) => {
    if (!READMOO_HOST_PATTERN.test(host)) {
      errors.push(`host_permissions 含非 readmoo.com 網域或過於寬鬆: ${host}`)
    }
  })

  return { ok: errors.length === 0, errors }
}

/**
 * 執行全部驗證，彙總結果
 *
 * @param {object} manifest
 * @param {string} buildDir
 * @param {object} fsAdapter
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateAll (manifest, buildDir, fsAdapter = defaultFsAdapter) {
  const results = [
    validateManifestVersionAndServiceWorker(manifest, buildDir, fsAdapter),
    validateContentScripts(manifest, buildDir, fsAdapter),
    validatePermissionsWhitelist(manifest),
    validateHostPermissions(manifest)
  ]

  const allErrors = results.flatMap((r) => r.errors)
  return {
    ok: allErrors.length === 0,
    errors: allErrors
  }
}

/**
 * 解析 CLI 參數
 */
function parseArgs (argv) {
  const args = { dir: 'build/production' }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir' && argv[i + 1]) {
      args.dir = argv[i + 1]
      i++
    }
  }
  return args
}

/**
 * CLI 主流程
 */
function main () {
  const args = parseArgs(process.argv.slice(2))
  const buildDir = path.isAbsolute(args.dir)
    ? args.dir
    : path.join(__dirname, '..', args.dir)
  const manifestPath = path.join(buildDir, 'manifest.json')

  console.log(`[validate-manifest] 驗證目錄: ${buildDir}`)

  if (!fs.existsSync(manifestPath)) {
    console.error(`[FAIL] manifest.json 不存在於: ${manifestPath}`)
    process.exit(1)
  }

  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    console.error(`[FAIL] manifest.json 解析失敗: ${err.message}`)
    process.exit(1)
  }

  const result = validateAll(manifest, buildDir)

  if (result.ok) {
    console.log('[OK] manifest 驗證全部通過：')
    console.log('  - manifest_version=3 + Service Worker 路徑存在')
    console.log('  - content_scripts[].js 路徑存在')
    console.log(`  - permissions 符合白名單 (${ALLOWED_PERMISSIONS.join(', ')})`)
    console.log('  - host_permissions 限 *.readmoo.com')
    process.exit(0)
  } else {
    console.error('[FAIL] manifest 驗證失敗，發現以下問題：')
    result.errors.forEach((err) => console.error(`  - ${err}`))
    process.exit(1)
  }
}

// 僅在直接執行時觸發 CLI；require 時僅匯出純函式
if (require.main === module) {
  main()
}

module.exports = {
  validateManifestVersionAndServiceWorker,
  validateContentScripts,
  validatePermissionsWhitelist,
  validateHostPermissions,
  validateAll,
  ALLOWED_PERMISSIONS,
  READMOO_HOST_PATTERN
}
