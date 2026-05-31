/**
 * w4-006-popup-launch-spike-v8.js — Logger 宣告衝突精確定位 + 變體驗證
 *
 * v7 重現：
 *   - 'Identifier \'Logger\' has already been declared' x 2
 *   - 'PopupInitializationTracker is not defined'
 *
 * v8 目的：
 *   1. 取得每筆 pageerror 的精確 source / line（透過 location 物件）
 *   2. 驗證真實宣告類型：
 *      - popup-ui-components.js: 無 Logger 宣告
 *      - popup-error-handler.js: `let Logger, ErrorCodes, MessageDictionary` 頂層
 *      - popup-diagnostic-enhancer.js: `if (typeof Logger === 'undefined') var Logger = ...`
 *      - popup-initialization-tracker.js: 同 diagnostic-enhancer
 *      - popup.js (bundled IIFE): IIFE 內部 var Logger，不洩漏到 global
 *   3. 探查：let 與 var 在 HTML <script> 共享 global scope 下的真實衝突行為
 *
 * 關鍵假設：
 *   - popup-error-handler.js 的 `let Logger` 將 Logger 放入 script global scope
 *   - popup-diagnostic-enhancer.js 的 `var Logger` 嘗試在 global scope 再宣告
 *   - var vs let 跨檔重宣告 → SyntaxError（同一個 script 物件 = 同一個 record）
 */

const puppeteer = require('puppeteer')
const path = require('path')
const fs = require('fs')

const EXTENSION_PATH = path.resolve(__dirname, '../../build/development')

function resolveChromePath () {
  const PATHS = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ]
  try { puppeteer.executablePath(); return undefined } catch { /* noop */ }
  for (const p of PATHS) if (fs.existsSync(p)) return p
  return undefined
}

async function launchBrowser () {
  const chromePath = resolveChromePath()
  const opts = {
    headless: false, devtools: false, protocolTimeout: 180000,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'
    ]
  }
  if (chromePath) opts.executablePath = chromePath
  return await puppeteer.launch(opts)
}

async function getExtensionId (browser) {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const t of browser.targets()) {
      if (t.type() === 'service_worker' && t.url().startsWith('chrome-extension://')) {
        return t.url().split('/')[2]
      }
    }
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error('SW timeout')
}

async function main () {
  const browser = await launchBrowser()
  try {
    const extensionId = await getExtensionId(browser)
    const popupPage = await browser.newPage()

    // 詳細捕捉 pageerror 含 stack
    const errors = []
    popupPage.on('pageerror', e => {
      errors.push({
        message: e.message,
        stack: e.stack,
        name: e.name
      })
    })

    // 捕捉所有 console 看載入順序
    const consoleLogs = []
    popupPage.on('console', msg => {
      if (msg.text().startsWith('[POPUP DEBUG]')) {
        consoleLogs.push(msg.text())
      }
    })

    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`,
      { waitUntil: 'domcontentloaded', timeout: 15000 })
    await new Promise(r => setTimeout(r, 2000))

    console.log('=== 載入順序（POPUP DEBUG） ===')
    consoleLogs.forEach((l, i) => console.log(`  ${i + 1}. ${l}`))

    console.log('\n=== Page Errors（含 stack） ===')
    errors.forEach((e, i) => {
      console.log(`\n[Error ${i + 1}] ${e.name}: ${e.message}`)
      if (e.stack) {
        console.log(`  Stack:\n    ${e.stack.split('\n').slice(0, 5).join('\n    ')}`)
      }
    })

    // 進一步診斷：使用 window 屬性訪問避免 TDZ ReferenceError
    // popup-error-handler.js 已執行 `let Logger` -> Logger 進入 script TDZ-aware lexical record
    //   typeof Logger 在 TDZ 內仍可能拋 ReferenceError（V8 嚴格實作）
    // 改用 window[name] 安全訪問（global object 屬性查詢不拋）
    const diagnose = await popupPage.evaluate(() => {
      return {
        // window.Logger 為 popup.js IIFE 內注入或 typeof guard fallback
        windowLogger: typeof window.Logger,
        windowPopupErrorHandler: typeof window.PopupErrorHandler,
        windowPopupDiagnosticEnhancer: typeof window.PopupDiagnosticEnhancer,
        windowPopupInitializationTracker: typeof window.PopupInitializationTracker,
        windowStartExtraction: typeof window.startExtraction,
        windowCheckCurrentTab: typeof window.checkCurrentTab,
        // 全域 (globalThis) 視角
        globalThisLogger: typeof globalThis.Logger,
        // Promise.race trick: try { return typeof Logger } catch { return 'TDZ' }
        loggerSafeProbe: (() => {
          try { return typeof Logger } catch (e) { return 'TDZ:' + e.message }
        })()
      }
    })

    console.log('\n=== Global 診斷 ===')
    console.log(JSON.stringify(diagnose, null, 2))

    // 嘗試 ESM POC：建立一個臨時 popup-esm-poc.html，5 個檔案改 type=module 載入
    console.log('\n=== ESM POC 探查 ===')
    console.log('注意：ESM POC 需手動建 popup-esm-poc.html + 改寫 4 檔為 export，本 spike 僅評估理論可行性。')
    console.log('關鍵限制：Manifest V3 popup 的 chrome-extension:// 協定支援 <script type="module">？')
    // 透過實際載入測試
    const esmTest = await popupPage.evaluate(async () => {
      // 動態建立 script type=module 測試是否能載入相對路徑
      try {
        const script = document.createElement('script')
        script.type = 'module'
        // 用 inline module 測試 import 是否可解析 chrome-extension://
        script.textContent = `
          window.__esmTestResult = 'esm-inline-executed';
          // 測試 dynamic import 相對路徑
          try {
            // 不能真的 import (檔案還沒改寫)，這裡只測 type=module 是否被執行
            window.__esmTestStatus = 'type-module-supported';
          } catch (e) {
            window.__esmTestStatus = 'type-module-error: ' + e.message;
          }
        `
        document.head.appendChild(script)
        await new Promise(r => setTimeout(r, 500))
        return {
          executed: window.__esmTestResult,
          status: window.__esmTestStatus
        }
      } catch (e) {
        return { error: e.message }
      }
    })
    console.log('ESM inline test:', esmTest)

  } catch (e) {
    console.error('Spike v8 失敗:', e)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

main()
